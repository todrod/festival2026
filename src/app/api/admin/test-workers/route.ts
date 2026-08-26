import { Gender, ShiftType, VerificationMethod } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TEST_EMAIL_DOMAIN = "festival.test.local";
const TEST_ACTOR = "admin:seed-test-workers";

const F = Gender.FEMALE;
const M = Gender.MALE;
const NB = Gender.NON_BINARY;
const P = Gender.PREFER_NOT_TO_SAY;

type Character = { name: string; gender: Gender };

// Character-accurate genders so gender-restricted roles (Berry Girl, Sticker
// Persons) and the volunteer demographics read sensibly in a demo.
const CHARACTERS: Character[] = [
  // Disney
  { name: "Mickey Mouse", gender: M },
  { name: "Minnie Mouse", gender: F },
  { name: "Donald Duck", gender: M },
  { name: "Daisy Duck", gender: F },
  { name: "Goofy Goof", gender: M },
  { name: "Elsa Arendelle", gender: F },
  { name: "Anna Arendelle", gender: F },
  { name: "Kristoff Bjorgman", gender: M },
  { name: "Olaf Snowman", gender: NB },
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
  { name: "Remy Ratatouille", gender: M },
  // Star Wars
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
  { name: "Grogu Child", gender: P },
  { name: "Lando Calrissian", gender: M },
  { name: "Rose Tico", gender: F },
  { name: "Cassian Andor", gender: M },
  { name: "Jyn Erso", gender: F },
  { name: "Mace Windu", gender: M },
  { name: "BoKatan Kryze", gender: F },
  { name: "Chewbacca Wookiee", gender: M },
  { name: "Wedge Antilles", gender: M },
  // Celebrities
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
type Profile = "FULL" | "DAY" | "NIGHT" | "HALL" | "BOOTH";
const PROFILE_SEQUENCE: Profile[] = [
  "FULL", "DAY", "BOOTH", "DAY", "HALL", "NIGHT", "FULL", "DAY", "BOOTH", "HALL", "DAY", "NIGHT",
];

const AM_HALL: ShiftType[] = [
  ShiftType.HALL_EARLY_SETUP,
  ShiftType.HALL_BERRY_HULLERS,
  ShiftType.HALL_BERRY_PRODUCTION,
  ShiftType.HALL_UNIFORMS_AM,
  ShiftType.HALL_HEAVY_HALL,
];
const PM_HALL: ShiftType[] = [ShiftType.HALL_UNIFORMS_PM, ShiftType.HALL_BUCKET_WASHERS];
const ALL_HALL: ShiftType[] = [...AM_HALL, ...PM_HALL, ShiftType.HALL_DRIVERS];

function profileShiftTypes(p: Profile): ShiftType[] {
  switch (p) {
    case "FULL":
      return [ShiftType.BOOTH_DAY, ShiftType.BOOTH_NIGHT, ...ALL_HALL];
    case "DAY":
      return [ShiftType.BOOTH_DAY, ...AM_HALL];
    case "NIGHT":
      return [ShiftType.BOOTH_NIGHT, ...PM_HALL];
    case "HALL":
      return ALL_HALL;
    case "BOOTH":
      return [ShiftType.BOOTH_DAY, ShiftType.BOOTH_NIGHT];
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
    // Booth roles usable as ranked preferences (skip supervisor + manual-only).
    const boothPrefRoles = roles.filter(
      (r) => r.module === "BOOTH" && !r.manualOnly && !r.requiresTraining && !r.requiresApproval,
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

    let supervisorCount = 0;

    for (let i = 0; i < CHARACTERS.length; i += 1) {
      const { name, gender } = CHARACTERS[i];
      const [firstRaw, ...lastParts] = name.split(" ");
      const firstName = firstRaw || `Volunteer${i + 1}`;
      const lastName = lastParts.join(" ") || "Volunteer";
      const email = `${normalizeName(`${firstName}.${lastName}`)}.${String(i + 1).padStart(3, "0")}@${TEST_EMAIL_DOMAIN}`;

      const profile = PROFILE_SEQUENCE[i % PROFILE_SEQUENCE.length];
      const types = new Set(profileShiftTypes(profile));

      // Varied capabilities so acknowledgement checks actually filter people.
      const standing = h(i, 1) < 92;
      const heavy = h(i, 2) < 45;
      const cash = h(i, 3) < 52;
      const outdoor = h(i, 4) < 62;
      const years = h(i, 5) % 16;
      const willingAnyBoothDay = types.has(ShiftType.BOOTH_DAY) && h(i, 6) < 55;
      const willingAnyBoothNight = types.has(ShiftType.BOOTH_NIGHT) && h(i, 10) < 45;
      const birthYear = 1965 + (h(i, 9) % 40); // everyone comfortably 18+

      // Available on ~78% of days that match the profile's shift types.
      const availableDayTimes = new Set(dateList.filter((_, d) => h(i, 200 + d) < 78));
      const availShifts = shifts.filter(
        (s) => types.has(s.shiftType) && availableDayTimes.has(s.date.getTime()),
      );

      const isSupervisor = !!supervisorRole && years >= 9 && h(i, 7) < 55;
      const supervisorApproved = isSupervisor && h(i, 8) < 80;

      const volunteer = await prisma.volunteer.create({
        data: {
          firstName,
          lastName,
          dob: new Date(Date.UTC(birthYear, (i % 12), ((i * 7) % 27) + 1)),
          ageConfirmed: true,
          email,
          phone: `555-01${String((i + 10) % 90).padStart(2, "0")}`,
          emergencyContactName: "Demo Contact",
          emergencyContactPhone: `555-99${String((i + 10) % 90).padStart(2, "0")}`,
          gender,
          language: h(i, 12) < 15 ? "Spanish" : "English",
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
              age18Plus: true,
              standingWalking: standing,
              heavyLift50: heavy,
              cashHandling: cash,
              outdoorSun: outdoor,
              liabilityAcknowledged: true,
              foodRulesAcknowledged: true,
            },
          },
        },
        select: { id: true },
      });

      for (const s of availShifts) {
        availabilityRows.push({ volunteerId: volunteer.id, shiftId: s.id });
      }

      // Rank up to two booth roles this person is actually eligible for, so
      // preference-based scoring in auto-assign has something to work with.
      const eligibleBooth = boothPrefRoles.filter(
        (r) =>
          (!r.requiredGender || r.requiredGender === gender) &&
          (!r.requiresStanding || standing) &&
          (!r.requiresHeavyLift || heavy) &&
          (!r.requiresCash || cash) &&
          (!r.requiresOutdoor || outdoor),
      );
      const prefRoles: string[] = [];
      if (eligibleBooth.length > 0) {
        prefRoles.push(eligibleBooth[i % eligibleBooth.length].id);
        if (eligibleBooth.length > 1) {
          const second = eligibleBooth[(i + 1 + h(i, 11)) % eligibleBooth.length].id;
          if (second !== prefRoles[0]) prefRoles.push(second);
        }
      }
      const boothAvailShifts = availShifts.filter(
        (s) => s.shiftType === ShiftType.BOOTH_DAY || s.shiftType === ShiftType.BOOTH_NIGHT,
      );
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
