import { FlagType, Gender, LanguagePreference, ShiftType, VerificationMethod } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { volunteerCodeFor } from "@/lib/festival";

const TEST_EMAIL_DOMAIN = "festival.test.local";
const TEST_ACTOR = "admin:seed-test-workers";

const F = Gender.FEMALE;
const M = Gender.MALE;

type Character = { name: string; gender: Gender };

// Character-accurate genders so gender-restricted positions (Berry Girl,
// Sticker Persons) and the volunteer demographics read sensibly in a demo.
const CHARACTERS: Character[] = [
  { name: "Mickey Mouse", gender: M },
  { name: "Minnie Mouse", gender: F },
  { name: "Donald Duck", gender: M },
  { name: "Daisy Duck", gender: F },
  { name: "Goofy Goof", gender: M },
  { name: "Elsa Arendelle", gender: F },
  { name: "Anna Arendelle", gender: F },
  { name: "Kristoff Bjorgman", gender: M },
  { name: "Moana Waialiki", gender: F },
  { name: "Maui Demigod", gender: M },
  { name: "Ariel Triton", gender: F },
  { name: "Eric Prince", gender: M },
  { name: "Belle French", gender: F },
  { name: "Aladdin Agrabah", gender: M },
  { name: "Jasmine Agrabah", gender: F },
  { name: "Simba Pride", gender: M },
  { name: "Nala Pride", gender: F },
  { name: "Tiana Rose", gender: F },
  { name: "Naveen Maldonia", gender: M },
  { name: "Rapunzel Corona", gender: F },
  { name: "Flynn Rider", gender: M },
  { name: "Merida DunBroch", gender: F },
  { name: "Hercules Olympus", gender: M },
  { name: "Megara Thebes", gender: F },
  { name: "Mulan Fa", gender: F },
  { name: "Li Shang", gender: M },
  { name: "Pocahontas Powhatan", gender: F },
  { name: "Woody Pride", gender: M },
  { name: "Buzz Lightyear", gender: M },
  { name: "Bo Peep", gender: F },
  { name: "Luke Skywalker", gender: M },
  { name: "Leia Organa", gender: F },
  { name: "Han Solo", gender: M },
  { name: "Rey Skywalker", gender: F },
  { name: "Finn Storm", gender: M },
  { name: "Poe Dameron", gender: M },
  { name: "Padme Amidala", gender: F },
  { name: "Anakin Skywalker", gender: M },
  { name: "ObiWan Kenobi", gender: M },
  { name: "Ahsoka Tano", gender: F },
  { name: "Din Djarin", gender: M },
  { name: "Lando Calrissian", gender: M },
  { name: "Rose Tico", gender: F },
  { name: "Cassian Andor", gender: M },
  { name: "Jyn Erso", gender: F },
  { name: "Mace Windu", gender: M },
  { name: "BoKatan Kryze", gender: F },
  { name: "Chewbacca Wookiee", gender: M },
  { name: "Wedge Antilles", gender: M },
  { name: "Zendaya Coleman", gender: F },
  { name: "Tom Holland", gender: M },
  { name: "Chris Pratt", gender: M },
  { name: "Scarlett Johansson", gender: F },
  { name: "Ryan Reynolds", gender: M },
  { name: "Blake Lively", gender: F },
  { name: "Dwayne Johnson", gender: M },
  { name: "Emma Stone", gender: F },
  { name: "Keanu Reeves", gender: M },
  { name: "Pedro Pascal", gender: M },
  { name: "Viola Davis", gender: F },
  { name: "Jennifer Lawrence", gender: F },
  { name: "Gal Gadot", gender: F },
  { name: "Chris Evans", gender: M },
  { name: "Brie Larson", gender: F },
  { name: "Serena Williams", gender: F },
  { name: "Simone Biles", gender: F },
  { name: "Stephen Curry", gender: M },
  { name: "LeBron James", gender: M },
  { name: "Margot Robbie", gender: F },
  { name: "Taylor Swift", gender: F },
  { name: "Beyonce Knowles", gender: F },
  { name: "Lionel Messi", gender: M },
  { name: "Patrick Mahomes", gender: M },
  { name: "Zoe Saldana", gender: F },
  { name: "Oscar Isaac", gender: M },
  { name: "Florence Pugh", gender: F },
  { name: "Timothee Chalamet", gender: M },
  { name: "Lupita Nyongo", gender: F },
  { name: "Michael Jordan", gender: M },
];

// Availability archetypes so not everyone is free for every shift.
type Profile = "FULL" | "DAY" | "NIGHT" | "SETUP";
const PROFILE_SEQUENCE: Profile[] = [
  "FULL", "DAY", "SETUP", "DAY", "NIGHT", "FULL", "DAY", "SETUP", "NIGHT", "DAY", "NIGHT", "FULL",
];

function profileShiftTypes(p: Profile): ShiftType[] {
  switch (p) {
    case "FULL":
      return [ShiftType.BOOTH_SETUP, ShiftType.BOOTH_DAY, ShiftType.BOOTH_NIGHT, ShiftType.BOOTH_PACKUP];
    case "DAY":
      return [ShiftType.BOOTH_DAY, ShiftType.BOOTH_PACKUP];
    case "NIGHT":
      return [ShiftType.BOOTH_NIGHT];
    case "SETUP":
      return [ShiftType.BOOTH_SETUP, ShiftType.BOOTH_DAY];
  }
}

// Deterministic pseudo-random 0..99 so re-seeding is stable/predictable.
function h(i: number, salt: number) {
  return ((Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0) % 100;
}

function normalizeName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shifts = await prisma.shift.findMany({
      select: { id: true, date: true, shiftType: true },
    });
    if (shifts.length === 0) {
      return NextResponse.json({ error: "No shifts found. Seed shifts first." }, { status: 400 });
    }

    const roles = await prisma.role.findMany();
    const supervisorRole = roles.find((r) => r.key === "SUPERVISOR");
    // Booth positions usable as ranked preferences (skip supervisor + info-only).
    const boothPrefRoles = roles.filter(
      (r) => r.module === "BOOTH" && !r.manualOnly && !r.infoOnly && !r.requiresTraining && !r.requiresApproval,
    );

    const dateList = [...new Set(shifts.map((s) => s.date.getTime()))].sort((a, b) => a - b);

    // Reset prior test workers to keep data clean/predictable for demos.
    await prisma.volunteer.deleteMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    });

    const availabilityRows: Array<{ volunteerId: string; shiftId: string }> = [];
    const preferenceRows: Array<{ volunteerId: string; shiftId: string; roleId: string; rank: number }> = [];
    const trainingRows: Array<{ volunteerId: string; roleId: string; trained: boolean }> = [];
    const approvalRows: Array<{ volunteerId: string; roleId: string; approved: boolean }> = [];
    const flagRows: Array<{ volunteerId: string; type: FlagType; detail: string }> = [];

    let supervisorCount = 0;

    for (let i = 0; i < CHARACTERS.length; i += 1) {
      const { name, gender } = CHARACTERS[i];
      const [firstRaw, ...lastParts] = name.split(" ");
      const firstName = firstRaw || `Volunteer${i + 1}`;
      const lastName = lastParts.join(" ") || "Volunteer";
      const email = `${normalizeName(`${firstName}.${lastName}`)}.${String(i + 1).padStart(3, "0")}@${TEST_EMAIL_DOMAIN}`;

      const profile = PROFILE_SEQUENCE[i % PROFILE_SEQUENCE.length];
      const types = new Set(profileShiftTypes(profile));

      // Varied capabilities so requirement checks actually filter people.
      const standing = h(i, 1) < 92;
      const lifting: 0 | 25 | 50 = h(i, 2) < 45 ? 50 : h(i, 2) < 75 ? 25 : 0;
      const cash = h(i, 3) < 52;
      const outdoor = h(i, 4) < 62;
      const years = h(i, 5) % 16;
      const willingAnyBoothDay = types.has(ShiftType.BOOTH_DAY) && h(i, 6) < 55;
      const willingAnyBoothNight = types.has(ShiftType.BOOTH_NIGHT) && h(i, 10) < 45;
      // A few teens (16–17) so age flags show up in demos; everyone else adult.
      const isTeen = i % 17 === 3;
      const birthYear = isTeen ? 2010 : 1965 + (h(i, 9) % 40);
      const parentConsent = isTeen && h(i, 14) < 50;

      // Available on ~78% of days that match the profile's shift types.
      const availableDayTimes = new Set(dateList.filter((_, d) => h(i, 200 + d) < 78));
      const availShifts = shifts.filter(
        (s) => types.has(s.shiftType) && availableDayTimes.has(s.date.getTime()),
      );

      const isSupervisor = !!supervisorRole && !isTeen && years >= 9 && h(i, 7) < 55;
      const supervisorApproved = isSupervisor && h(i, 8) < 80;

      const volunteer = await prisma.volunteer.create({
        data: {
          firstName,
          lastName,
          dob: new Date(Date.UTC(birthYear, i % 12, ((i * 7) % 27) + 1)),
          ageConfirmed: true,
          email,
          phone: `555-01${String((i + 10) % 90).padStart(2, "0")}`,
          address: `${100 + i} Festival Lane, Plant City, FL`,
          emergencyContactName: "Demo Contact",
          emergencyContactPhone: `555-99${String((i + 10) % 90).padStart(2, "0")}`,
          gender,
          language:
            h(i, 12) < 15
              ? LanguagePreference.SPANISH
              : h(i, 12) < 25
                ? LanguagePreference.BOTH
                : LanguagePreference.ENGLISH,
          firstTimeVolunteer: years === 0,
          orientationRsvp: years === 0 ? (h(i, 15) < 60 ? "WILL_ATTEND" : "WILL_NOT_ATTEND") : null,
          parentConsent,
          emergencyOptIn: h(i, 16) < 25,
          textOk: h(i, 13) < 70,
          emailOk: true,
          yearsExperience: years,
          willingAnyBoothDay,
          willingAnyBoothNight,
          status: "VERIFIED",
          verificationMethod: VerificationMethod.EMAIL,
          verifiedAt: new Date(),
          acknowledgement: {
            create: {
              age18Plus: !isTeen,
              standingWalking: standing,
              heavyLift50: lifting >= 50,
              liftingCapacityLbs: lifting,
              cashHandling: cash,
              outdoorSun: outdoor,
              liabilityAcknowledged: true,
              foodRulesAcknowledged: true,
            },
          },
        },
        select: { id: true, seq: true },
      });
      await prisma.volunteer.update({
        where: { id: volunteer.id },
        data: { volunteerCode: volunteerCodeFor(volunteer.seq) },
      });

      if (isTeen && !parentConsent) {
        flagRows.push({
          volunteerId: volunteer.id,
          type: FlagType.AGE_16_18_NO_CONSENT,
          detail: "Age 16–17 at festival start, no parent consent",
        });
      }

      for (const s of availShifts) {
        availabilityRows.push({ volunteerId: volunteer.id, shiftId: s.id });
      }

      // Rank up to three booth positions this person prefers (the sign-up flow
      // collects 1st/2nd/3rd choice), applied across their available shifts.
      const eligibleBooth = boothPrefRoles.filter(
        (r) => !r.requiredGender || r.requiredGender === gender,
      );
      const prefRoles: string[] = [];
      if (eligibleBooth.length > 0) {
        prefRoles.push(eligibleBooth[i % eligibleBooth.length].id);
        const second = eligibleBooth[(i + 1 + h(i, 11)) % eligibleBooth.length].id;
        if (!prefRoles.includes(second)) prefRoles.push(second);
        const third = eligibleBooth[(i + 3 + h(i, 17)) % eligibleBooth.length].id;
        if (!prefRoles.includes(third) && prefRoles.length < 3) prefRoles.push(third);
      }
      const boothAvailShifts = availShifts.filter((s) => s.shiftType !== ShiftType.BOOTH_SETUP);
      for (const s of boothAvailShifts) {
        prefRoles.forEach((roleId, idx) => {
          preferenceRows.push({ volunteerId: volunteer.id, shiftId: s.id, roleId, rank: idx + 1 });
        });
      }

      if (supervisorRole && isSupervisor) {
        supervisorCount += 1;
        trainingRows.push({ volunteerId: volunteer.id, roleId: supervisorRole.id, trained: true });
        approvalRows.push({ volunteerId: volunteer.id, roleId: supervisorRole.id, approved: supervisorApproved });
      }
    }

    if (availabilityRows.length > 0) {
      await prisma.availability.createMany({ data: availabilityRows, skipDuplicates: true });
    }
    if (preferenceRows.length > 0) {
      await prisma.preference.createMany({ data: preferenceRows, skipDuplicates: true });
    }
    if (trainingRows.length > 0) {
      await prisma.training.createMany({ data: trainingRows, skipDuplicates: true });
    }
    if (approvalRows.length > 0) {
      await prisma.approval.createMany({ data: approvalRows, skipDuplicates: true });
    }
    if (flagRows.length > 0) {
      await prisma.volunteerFlag.createMany({ data: flagRows, skipDuplicates: true });
    }

    await prisma.auditLog.create({
      data: {
        actor: TEST_ACTOR,
        action: "seed_test_workers",
        entityType: "Volunteer",
        details: `created:${CHARACTERS.length} supervisors:${supervisorCount}`,
      },
    });

    return NextResponse.json({ ok: true, created: CHARACTERS.length, supervisors: supervisorCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create test workers" }, { status: 400 });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.volunteer.deleteMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    });

    await prisma.auditLog.create({
      data: {
        actor: TEST_ACTOR,
        action: "clear_test_workers",
        entityType: "Volunteer",
        details: `deleted:${result.count}`,
      },
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to clear test workers" }, { status: 400 });
  }
}
