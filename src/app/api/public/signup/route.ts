import { NextResponse } from "next/server";
import { FlagType, VerificationMethod, type Prisma } from "@prisma/client";
import { parseISO } from "date-fns";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators";
import { ageOn, volunteerCodeFor } from "@/lib/festival";
import { buildVolunteerConfirmation, sendEmail } from "@/lib/email";
import { buildVolunteerSmsConfirmation, sendSms, toE164 } from "@/lib/sms";

function looksFakeName(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  const blocked = ["test", "asdf", "qwerty", "unknown", "none", "fake", "sample"];
  return blocked.includes(v) || /^(.)\1{3,}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = signupSchema.parse(raw);
    const dob = parseISO(parsed.dob);

    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
    }
    if (looksFakeName(parsed.firstName) || looksFakeName(parsed.lastName)) {
      return NextResponse.json({ error: "Please provide a valid first and last name." }, { status: 400 });
    }

    const age = ageOn(dob);
    const acknowledgementData = {
      age18Plus: age >= 18,
      standingWalking: parsed.acknowledgements.standingWalking,
      heavyLift50: parsed.acknowledgements.liftingCapacityLbs >= 50,
      liftingCapacityLbs: parsed.acknowledgements.liftingCapacityLbs,
      cashHandling: parsed.acknowledgements.cashHandling,
      outdoorSun: parsed.acknowledgements.outdoorSun,
      liabilityAcknowledged: parsed.acknowledgements.liabilityAcknowledged,
      foodRulesAcknowledged: parsed.acknowledgements.foodRulesAcknowledged,
    };

    const existing = await prisma.volunteer.findUnique({
      where: { email: parsed.email },
      include: { acknowledgement: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const volunteerData = {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        dob,
        ageConfirmed: true,
        email: parsed.email,
        phone: parsed.phone,
        address: parsed.address,
        emergencyContactName: parsed.emergencyContactName,
        emergencyContactPhone: parsed.emergencyContactPhone,
        gender: parsed.gender,
        language: parsed.language,
        firstTimeVolunteer: parsed.firstTimeVolunteer,
        orientationRsvp: parsed.orientationRsvp ?? null,
        parentConsent: parsed.parentConsent,
        emergencyOptIn: parsed.emergencyOptIn,
        emergencyDates: parsed.emergencyDates,
        textOk: parsed.textOk,
        emailOk: parsed.emailOk,
        verificationMethod: VerificationMethod.EMAIL,
        yearsExperience: parsed.yearsExperience,
        willingAnyBoothDay: parsed.willingAnyBoothDay,
        willingAnyBoothNight: parsed.willingAnyBoothNight,
        status: "VERIFIED" as const,
        verifiedAt: new Date(),
      };

      let volunteer;
      if (!existing) {
        volunteer = await tx.volunteer.create({
          data: {
            ...volunteerData,
            acknowledgement: { create: acknowledgementData },
          },
        });
        // Volunteer ID from the sequential counter, e.g. SC2027000001.
        volunteer = await tx.volunteer.update({
          where: { id: volunteer.id },
          data: { volunteerCode: volunteerCodeFor(volunteer.seq) },
        });
      } else {
        await tx.availability.deleteMany({ where: { volunteerId: existing.id } });
        await tx.preference.deleteMany({ where: { volunteerId: existing.id } });
        await tx.volunteerFlag.deleteMany({ where: { volunteerId: existing.id } });

        if (existing.acknowledgement) {
          await tx.volunteerAcknowledgement.update({
            where: { volunteerId: existing.id },
            data: acknowledgementData,
          });
        } else {
          await tx.volunteerAcknowledgement.create({
            data: { volunteerId: existing.id, ...acknowledgementData },
          });
        }

        volunteer = await tx.volunteer.update({
          where: { id: existing.id },
          data: {
            ...volunteerData,
            volunteerCode: existing.volunteerCode ?? volunteerCodeFor(existing.seq),
          },
        });
      }

      if (parsed.availabilityShiftIds.length > 0) {
        await tx.availability.createMany({
          data: parsed.availabilityShiftIds.map((shiftId) => ({ volunteerId: volunteer.id, shiftId })),
          skipDuplicates: true,
        });
      }

      if (parsed.preferences.length > 0) {
        await tx.preference.createMany({
          data: parsed.preferences.map((p) => ({
            volunteerId: volunteer.id,
            shiftId: p.shiftId,
            roleId: p.roleId,
            rank: p.rank,
          })),
          skipDuplicates: true,
        });
      }

      // Silent flags — stored, never blocking, never shown to the volunteer.
      const flags: Prisma.VolunteerFlagCreateManyInput[] = [];
      if (age < 16) {
        flags.push({ volunteerId: volunteer.id, type: FlagType.AGE_UNDER_16, detail: `Age ${age} at festival start` });
      } else if (age < 18 && !parsed.parentConsent) {
        flags.push({
          volunteerId: volunteer.id,
          type: FlagType.AGE_16_18_NO_CONSENT,
          detail: `Age ${age} at festival start, no parent consent`,
        });
      }

      const preferredRoleIds = [...new Set(parsed.preferences.map((p) => p.roleId))];
      if (preferredRoleIds.length > 0) {
        const roles = await tx.role.findMany({ where: { id: { in: preferredRoleIds } } });
        for (const role of roles) {
          if (role.requiredGender && parsed.gender !== role.requiredGender) {
            flags.push({
              volunteerId: volunteer.id,
              type: FlagType.GENDER_MISMATCH,
              positionKey: role.key,
              detail: `${role.name} is restricted to ${role.requiredGender === "FEMALE" ? "female" : "male"} volunteers`,
            });
          }
          if (role.liftLimitLbs > 0 && parsed.acknowledgements.liftingCapacityLbs < role.liftLimitLbs) {
            flags.push({
              volunteerId: volunteer.id,
              type: FlagType.LIFTING_MISMATCH,
              positionKey: role.key,
              detail: `${role.name} needs ${role.liftLimitLbs} lbs; declared ${parsed.acknowledgements.liftingCapacityLbs} lbs`,
            });
          }
          if (role.requiresStanding && !parsed.acknowledgements.standingWalking) {
            flags.push({
              volunteerId: volunteer.id,
              type: FlagType.STANDING_MISMATCH,
              positionKey: role.key,
              detail: `${role.name} requires extended standing; not declared`,
            });
          }
        }
      }
      if (flags.length > 0) await tx.volunteerFlag.createMany({ data: flags });

      return volunteer;
    });

    // Best-effort confirmation email — never fail the signup if email breaks.
    try {
      const shifts = parsed.availabilityShiftIds.length
        ? await prisma.shift.findMany({
            where: { id: { in: parsed.availabilityShiftIds } },
            orderBy: [{ date: "asc" }, { shiftType: "asc" }],
            select: { date: true, label: true },
          })
        : [];
      const { subject, html, text } = buildVolunteerConfirmation({
        firstName: parsed.firstName,
        yearsExperience: parsed.yearsExperience,
        shifts,
        confirmationId: created.volunteerCode ?? created.id,
      });
      await sendEmail({ to: parsed.email, subject, html, text });
    } catch (emailErr) {
      console.error("confirmation email failed", emailErr);
    }

    // Best-effort confirmation text — only for volunteers who opted in to texts
    // and gave a dialable number. Never fail the signup if SMS breaks.
    if (parsed.textOk) {
      try {
        const smsTo = toE164(parsed.phone);
        if (smsTo) {
          await sendSms({ to: smsTo, body: buildVolunteerSmsConfirmation({ firstName: parsed.firstName }) });
        }
      } catch (smsErr) {
        console.error("confirmation SMS failed", smsErr);
      }
    }

    return NextResponse.json({
      ok: true,
      volunteerId: created.volunteerCode ?? created.id,
      updatedExisting: !!existing,
    });
  } catch (err) {
    console.error(err);
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Please complete all required fields and acknowledgements before submitting." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
}
