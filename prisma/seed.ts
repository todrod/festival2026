import { PrismaClient, RoleModule, ShiftType } from "@prisma/client";
import { format } from "date-fns";
import { FESTIVAL_END, FESTIVAL_NAME, FESTIVAL_START, ROLE_SEEDS, SHIFT_SEEDS, atDayTime, festivalDates } from "../src/lib/festival";

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
  await prisma.volunteerAcknowledgement.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.role.deleteMany();
  await prisma.event.deleteMany();
}

async function main() {
  const forceReseed = !!process.env.FORCE_RESEED;
  if (forceReseed) {
    console.log("FORCE_RESEED set — wiping ALL data (including volunteers) and reseeding.");
    await fullWipe();
  }

  const existingEvent = await prisma.event.findFirst();
  const windowMatches = existingEvent && existingEvent.startDate.getTime() === FESTIVAL_START.getTime();
  if (!forceReseed) {
    console.log(
      existingEvent
        ? windowMatches
          ? "Syncing festival calendar in place (volunteers and signups preserved)."
          : "Festival window changed — rebuilding the calendar (volunteers and signups preserved)."
        : "First-time seed — creating the festival calendar.",
    );
  }

  // Roles: upsert by key so role ids are stable — trainings, approvals,
  // preferences, and assignments that reference roles all survive.
  const roleByKey = new Map<string, string>();
  for (const role of ROLE_SEEDS) {
    const data = {
      name: role.name,
      module: role.module,
      description: role.description,
      requiresStanding: !!role.requiresStanding,
      requiresHeavyLift: !!role.requiresHeavyLift,
      requiresCash: !!role.requiresCash,
      requiresOutdoor: !!role.requiresOutdoor,
      requiresTraining: !!role.requiresTraining,
      requiresApproval: !!role.requiresApproval,
      requiredGender: role.requiredGender ?? null,
      manualOnly: !!role.manualOnly,
      isRelief: !!role.isRelief,
    };
    const created = await prisma.role.upsert({
      where: { key: role.key },
      update: data,
      create: { key: role.key, ...data },
    });
    roleByKey.set(role.key, created.id);
  }

  // Event: one row — update it in place, or create it the first time.
  const event = existingEvent
    ? await prisma.event.update({
        where: { id: existingEvent.id },
        data: { name: FESTIVAL_NAME, startDate: FESTIVAL_START, endDate: FESTIVAL_END },
      })
    : await prisma.event.create({
        data: { name: FESTIVAL_NAME, startDate: FESTIVAL_START, endDate: FESTIVAL_END },
      });

  const dates = festivalDates();
  const validDateTimes = new Set(dates.map((d) => d.getTime()));

  // Remove only shifts whose date is no longer in the festival window. This
  // cascades the availability/preferences/assignments tied to those stale dates
  // (which are meaningless once the date is gone) but leaves everything for
  // dates that still exist untouched.
  const allShifts = await prisma.shift.findMany({ select: { id: true, date: true } });
  const staleShiftIds = allShifts.filter((s) => !validDateTimes.has(s.date.getTime())).map((s) => s.id);
  if (staleShiftIds.length > 0) {
    await prisma.shift.deleteMany({ where: { id: { in: staleShiftIds } } });
    console.log(`Removed ${staleShiftIds.length} shift(s) for dates outside the current window.`);
  }

  // Shifts + role targets: upsert by their natural unique keys. Shifts on dates
  // that already exist are updated in place, so their availability/assignments
  // are preserved.
  for (const date of dates) {
    for (const shift of SHIFT_SEEDS) {
      const shiftData = {
        eventId: event.id,
        module: shift.module,
        label: shift.label,
        startAt: atDayTime(date, shift.startHour, shift.startMinute),
        endAt: atDayTime(date, shift.endHour, shift.endMinute),
        arrivalAt:
          shift.arrivalHour === undefined ? null : atDayTime(date, shift.arrivalHour, shift.arrivalMinute ?? 0),
        conflictStartAt: atDayTime(date, shift.conflictStartHour, shift.conflictStartMinute),
        conflictEndAt: atDayTime(date, shift.conflictEndHour, shift.conflictEndMinute),
      };
      const createdShift = await prisma.shift.upsert({
        where: { date_shiftType: { date, shiftType: shift.shiftType } },
        update: shiftData,
        create: { date, shiftType: shift.shiftType, ...shiftData },
      });

      if (shift.module === RoleModule.BOOTH && (shift.shiftType === ShiftType.BOOTH_DAY || shift.shiftType === ShiftType.BOOTH_NIGHT)) {
        for (const boothRole of ROLE_SEEDS.filter((r) => r.module === RoleModule.BOOTH && typeof r.boothTarget === "number")) {
          const roleId = roleByKey.get(boothRole.key)!;
          await prisma.roleTarget.upsert({
            where: { shiftId_roleId: { shiftId: createdShift.id, roleId } },
            update: { target: boothRole.boothTarget! },
            create: { shiftId: createdShift.id, roleId, target: boothRole.boothTarget! },
          });
        }
      }
    }
  }

  console.log(
    `Seed synced for festival dates ${format(FESTIVAL_START, "MMM d")} - ${format(FESTIVAL_END, "MMM d, yyyy")}`,
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
