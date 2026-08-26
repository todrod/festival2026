import { Gender, VerificationMethod } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TEST_EMAIL_DOMAIN = "festival.test.local";
const TEST_ACTOR = "admin:seed-test-workers";

const DISNEY_NAMES = [
  "Mickey Mouse",
  "Minnie Mouse",
  "Donald Duck",
  "Daisy Duck",
  "Goofy Goof",
  "Pluto Pup",
  "Elsa Arendelle",
  "Anna Arendelle",
  "Kristoff Bjorgman",
  "Olaf Snowman",
  "Moana Waialiki",
  "Maui Demigod",
  "Ariel Mermaid",
  "Eric Prince",
  "Belle French",
  "Beast Castle",
  "Aladdin Agrabah",
  "Jasmine Agrabah",
  "Simba Pride",
  "Nala Pride",
  "Tiana Neworleans",
  "Naveen Maldonia",
  "Rapunzel Corona",
  "Flynn Rider",
  "Merida Dunbroch",
  "Hercules Olympus",
  "Megara Thebes",
];

const STAR_WARS_NAMES = [
  "Luke Skywalker",
  "Leia Organa",
  "Han Solo",
  "Chewbacca Wookiee",
  "Rey Skywalker",
  "Finn Storm",
  "Poe Dameron",
  "Padme Amidala",
  "Anakin Skywalker",
  "Obiwan Kenobi",
  "Ahsoka Tano",
  "Din Djarin",
  "Grogu Child",
  "Lando Calrissian",
  "Rose Tico",
  "Cassian Andor",
  "Jyn Erso",
  "Mace Windu",
  "QuiGon Jinn",
  "BoKatan Kryze",
];

const CELEB_NAMES = [
  "Zendaya Coleman",
  "Tom Holland",
  "Chris Pratt",
  "Scarlett Johansson",
  "Ryan Reynolds",
  "Blake Lively",
  "Dwayne Johnson",
  "Emma Stone",
  "Keanu Reeves",
  "Pedro Pascal",
  "Viola Davis",
  "Will Smith",
  "Jennifer Lawrence",
  "Gal Gadot",
  "Chris Evans",
  "Brie Larson",
  "Michael Jordan",
  "Serena Williams",
  "Taylor Swift",
  "Beyonce Knowles",
  "Adele Adkins",
  "Bad Bunny",
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Patrick Mahomes",
  "Simone Biles",
  "Stephen Curry",
  "LeBron James",
  "Margot Robbie",
  "Sydney Sweeney",
];

function normalizeName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

function buildSeedNames() {
  const base = [...DISNEY_NAMES, ...STAR_WARS_NAMES, ...CELEB_NAMES];
  const target = 120;
  if (base.length >= target) return base;
  const extra: string[] = [];
  for (let i = 1; base.length + extra.length <= target; i += 1) {
    extra.push(`Demo Worker${i}`);
  }
  return [...base, ...extra];
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shifts = await prisma.shift.findMany({ select: { id: true } });
    if (shifts.length === 0) {
      return NextResponse.json({ error: "No shifts found. Seed shifts first." }, { status: 400 });
    }

    const supervisorRole = await prisma.role.findUnique({
      where: { key: "SUPERVISOR" },
      select: { id: true },
    });

    // Reset prior test workers to keep data clean/predictable for demos.
    await prisma.volunteer.deleteMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    });

    const names = buildSeedNames();
    const createdIds: string[] = [];

    for (let i = 0; i < names.length; i += 1) {
      const fullName = names[i];
      const [firstNameRaw, ...lastParts] = fullName.split(" ");
      const firstName = firstNameRaw || `Test${i + 1}`;
      const lastName = lastParts.join(" ") || "Volunteer";
      const email = `${normalizeName(`${firstName}.${lastName}`)}.${String(i + 1).padStart(3, "0")}@${TEST_EMAIL_DOMAIN}`;
      const gender = i % 3 === 0 ? Gender.FEMALE : i % 3 === 1 ? Gender.MALE : Gender.NON_BINARY;
      const now = new Date();

      const volunteer = await prisma.volunteer.create({
        data: {
          firstName,
          lastName,
          dob: new Date("1990-01-01"),
          ageConfirmed: true,
          email,
          phone: `555-01${String((i + 10) % 90).padStart(2, "0")}`,
          emergencyContactName: "Demo Contact",
          emergencyContactPhone: `555-99${String((i + 10) % 90).padStart(2, "0")}`,
          gender,
          language: "English",
          textOk: true,
          emailOk: true,
          yearsExperience: i % 8,
          willingAnyBoothDay: true,
          willingAnyBoothNight: true,
          status: "VERIFIED",
          verificationMethod: VerificationMethod.EMAIL,
          verifiedAt: now,
          acknowledgement: {
            create: {
              age18Plus: true,
              standingWalking: true,
              heavyLift50: true,
              cashHandling: true,
              outdoorSun: true,
              liabilityAcknowledged: true,
              foodRulesAcknowledged: true,
            },
          },
        },
        select: { id: true },
      });
      createdIds.push(volunteer.id);
    }

    if (createdIds.length > 0) {
      const availabilityRows = createdIds.flatMap((volunteerId) => shifts.map((s) => ({ volunteerId, shiftId: s.id })));
      await prisma.availability.createMany({
        data: availabilityRows,
        skipDuplicates: true,
      });
    }

    if (supervisorRole && createdIds.length > 0) {
      await prisma.training.createMany({
        data: createdIds.map((volunteerId) => ({ volunteerId, roleId: supervisorRole.id, trained: true })),
        skipDuplicates: true,
      });
      await prisma.approval.createMany({
        data: createdIds.map((volunteerId) => ({ volunteerId, roleId: supervisorRole.id, approved: true })),
        skipDuplicates: true,
      });
    }

    await prisma.auditLog.create({
      data: {
        actor: TEST_ACTOR,
        action: "seed_test_workers",
        entityType: "Volunteer",
        details: `created:${createdIds.length}`,
      },
    });

    return NextResponse.json({ ok: true, created: createdIds.length });
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
