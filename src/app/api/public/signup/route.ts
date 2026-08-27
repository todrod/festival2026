import { NextResponse } from "next/server";
import { VerificationMethod } from "@prisma/client";
import { parseISO } from "date-fns";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validators";
import { buildVolunteerConfirmation, sendEmail } from "@/lib/email";

function isAtLeast18(dob: Date) {
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) return age - 1 >= 18;
  return age >= 18;
}

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
    const verificationMethod = VerificationMethod.EMAIL;

    if (!isAtLeast18(dob) || !parsed.acknowledgements.age18Plus) {
      return NextResponse.json({ error: "Volunteer must be 18+" }, { status: 400 });
    }
    if (looksFakeName(parsed.firstName) || looksFakeName(parsed.lastName)) {
      return NextResponse.json({ error: "Please provide a valid first and last name." }, { status: 400 });
    }

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
        emergencyContactName: parsed.emergencyContactName,
        emergencyContactPhone: parsed.emergencyContactPhone,
        gender: parsed.gender,
        language: parsed.language,
        textOk: parsed.textOk,
        emailOk: parsed.emailOk,
        verificationMethod,
        yearsExperience: parsed.yearsExperience,
        willingAnyBoothDay: parsed.willingAnyBoothDay,
        willingAnyBoothNight: parsed.willingAnyBoothNight,
        status: "VERIFIED" as const,
        verifiedAt: new Date(),
      };

      if (!existing) {
        const createdVolunteer = await tx.volunteer.create({
          data: {
            ...volunteerData,
            acknowledgement: {
              create: parsed.acknowledgements,
            },
          },
        });
        return createdVolunteer;
      }

      await tx.availability.deleteMany({ where: { volunteerId: existing.id } });
      await tx.preference.deleteMany({ where: { volunteerId: existing.id } });

      if (existing.acknowledgement) {
        await tx.volunteerAcknowledgement.update({
          where: { volunteerId: existing.id },
          data: parsed.acknowledgements,
        });
      } else {
        await tx.volunteerAcknowledgement.create({
          data: {
            volunteerId: existing.id,
            ...parsed.acknowledgements,
          },
        });
      }

      return tx.volunteer.update({
        where: { id: existing.id },
        data: volunteerData,
      });
    });

    if (parsed.availabilityShiftIds.length > 0) {
      await prisma.availability.createMany({
        data: parsed.availabilityShiftIds.map((shiftId) => ({ volunteerId: created.id, shiftId })),
        skipDuplicates: true,
      });
    }

    if (parsed.preferences.length > 0) {
      await prisma.preference.createMany({
        data: parsed.preferences.map((p) => ({ volunteerId: created.id, shiftId: p.shiftId, roleId: p.roleId, rank: p.rank })),
        skipDuplicates: true,
      });
    }

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
        confirmationId: created.id,
      });
      await sendEmail({ to: parsed.email, subject, html, text });
    } catch (emailErr) {
      console.error("confirmation email failed", emailErr);
    }

    return NextResponse.json({ ok: true, volunteerId: created.id, updatedExisting: !!existing });
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
