import { PrismaClient } from "@prisma/client";
import { format } from "date-fns";
import {
  FESTIVAL_END,
  FESTIVAL_NAME,
  FESTIVAL_START,
  PACKUP_DATE,
  ROLE_SEEDS,
  SHIFT_SEEDS,
  atDayTime,
  festivalDates,
} from "../src/lib/festival";

const prisma = new PrismaClient();

// Destructive reset — ONLY runs when FORCE_RESEED is set. Wipes volunteers and
// everything else. Never runs on a normal deploy.
async function fullWipe() {
  await prisma.assignment.deleteMany();
  await prisma.roleTarget.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.training.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.volunteerFlag.deleteMany();
  await prisma.adminNote.deleteMany();
  await prisma.volunteerAcknowledgement.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.shiftNote.deleteMany();
  await prisma.schedulePublish.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.role.deleteMany();
  await prisma.event.deleteMany();
  await prisma.hallAttendance.deleteMany();
  await prisma.messageLog.deleteMany();
}

async function main() {
  const forceReseed = !!process.env.FORCE_RESEED;
  if (forceReseed) {
    console.log("FORCE_RESEED set — wiping ALL data (including volunteers) and reseeding.");
    await fullWipe();
  }

  const existingEvent = await prisma.event.findFirst();

  // Positions: upsert by key so ids are stable — trainings, approvals,
  // preferences, and assignments that reference positions all survive.
  const roleByKey = new Map<string, string>();
  for (const role of ROLE_SEEDS) {
    const data = {
      name: role.name,
      module: role.module,
      description: role.description,
      physicalDemands: role.physicalDemands ?? "",
      requiresStanding: !!role.requiresStanding,
      requiresHeavyLift: !!role.requiresHeavyLift,
      liftLimitLbs: role.liftLimitLbs ?? 0,
      minAge: role.minAge ?? 16,
      requiresCash: !!role.requiresCash,
      requiresOutdoor: !!role.requiresOutdoor,
      requiresTraining: !!role.requiresTraining,
      requiresApproval: !!role.requiresApproval,
      requiredGender: role.requiredGender ?? null,
      manualOnly: !!role.manualOnly,
      isRelief: !!role.isRelief,
      infoOnly: !!role.infoOnly,
      contactName: role.contactName ?? null,
      contactPhone: role.contactPhone ?? null,
      contactNote: role.contactNote ?? null,
      urgent: !!role.urgent,
    };
    const created = await prisma.role.upsert({
      where: { key: role.key },
      update: data,
      create: { key: role.key, ...data },
    });
    roleByKey.set(role.key, created.id);
  }

  // Remove positions no longer in the catalog (cascades their prefs/assignments).
  const staleRoles = await prisma.role.findMany({
    where: { key: { notIn: ROLE_SEEDS.map((r) => r.key) } },
    select: { id: true, key: true },
  });
  if (staleRoles.length > 0) {
    await prisma.role.deleteMany({ where: { id: { in: staleRoles.map((r) => r.id) } } });
    console.log(`Removed ${staleRoles.length} stale position(s): ${staleRoles.map((r) => r.key).join(", ")}`);
  }

  // Event: one row — update it in place, or create it the first time.
  const event = existingEvent
    ? await prisma.event.update({
        where: { id: existingEvent.id },
        data: { name: FESTIVAL_NAME, startDate: FESTIVAL_START, endDate: PACKUP_DATE },
      })
    : await prisma.event.create({
        data: { name: FESTIVAL_NAME, startDate: FESTIVAL_START, endDate: PACKUP_DATE },
      });

  const dates = festivalDates();
  const validKeys = new Set<string>();

  for (const seed of SHIFT_SEEDS) {
    const seedDates = seed.days === "packup" ? [PACKUP_DATE] : dates;
    for (const date of seedDates) {
      validKeys.add(`${date.getTime()}:${seed.shiftType}`);
      const shiftData = {
        eventId: event.id,
        module: seed.module,
        label: seed.label,
        startAt: atDayTime(date, seed.startHour, seed.startMinute),
        endAt: atDayTime(date, seed.endHour, seed.endMinute),
        arrivalAt:
          seed.arrivalHour === undefined ? null : atDayTime(date, seed.arrivalHour, seed.arrivalMinute ?? 0),
        conflictStartAt: atDayTime(date, seed.conflictStartHour, seed.conflictStartMinute),
        conflictEndAt: atDayTime(date, seed.conflictEndHour, seed.conflictEndMinute),
      };
      const createdShift = await prisma.shift.upsert({
        where: { date_shiftType: { date, shiftType: seed.shiftType } },
        update: shiftData,
        create: { date, shiftType: seed.shiftType, ...shiftData },
      });

      for (const roleSeed of ROLE_SEEDS) {
        const target = roleSeed.targets?.[seed.shiftType];
        if (typeof target !== "number") continue;
        const roleId = roleByKey.get(roleSeed.key)!;
        await prisma.roleTarget.upsert({
          where: { shiftId_roleId: { shiftId: createdShift.id, roleId } },
          update: { target },
          create: { shiftId: createdShift.id, roleId, target },
        });
      }
    }
  }

  // Remove shifts that no longer exist in the calendar (stale dates or types).
  const allShifts = await prisma.shift.findMany({ select: { id: true, date: true, shiftType: true } });
  const staleShiftIds = allShifts
    .filter((s) => !validKeys.has(`${s.date.getTime()}:${s.shiftType}`))
    .map((s) => s.id);
  if (staleShiftIds.length > 0) {
    await prisma.shift.deleteMany({ where: { id: { in: staleShiftIds } } });
    console.log(`Removed ${staleShiftIds.length} shift(s) outside the current calendar.`);
  }

  console.log(
    `Seed synced for festival dates ${format(FESTIVAL_START, "MMM d")} - ${format(FESTIVAL_END, "MMM d, yyyy")} + pack-up ${format(PACKUP_DATE, "MMM d")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
