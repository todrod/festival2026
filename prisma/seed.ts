import { PrismaClient, RoleModule, ShiftType } from "@prisma/client";
import { FESTIVAL_END, FESTIVAL_NAME, FESTIVAL_START, ROLE_SEEDS, SHIFT_SEEDS, atDayTime, festivalDates } from "../src/lib/festival";

const prisma = new PrismaClient();

async function main() {
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

  const event = await prisma.event.create({
    data: {
      name: FESTIVAL_NAME,
      startDate: FESTIVAL_START,
      endDate: FESTIVAL_END,
    },
  });

  const roleByKey = new Map<string, string>();
  for (const role of ROLE_SEEDS) {
    const created = await prisma.role.create({
      data: {
        key: role.key,
        name: role.name,
        module: role.module,
        description: role.description,
        requiresStanding: !!role.requiresStanding,
        requiresHeavyLift: !!role.requiresHeavyLift,
        requiresCash: !!role.requiresCash,
        requiresOutdoor: !!role.requiresOutdoor,
        requiresTraining: !!role.requiresTraining,
        requiresApproval: !!role.requiresApproval,
        requiredGender: role.requiredGender,
        manualOnly: !!role.manualOnly,
        isRelief: !!role.isRelief,
      },
    });
    roleByKey.set(role.key, created.id);
  }

  const dates = festivalDates();
  for (const date of dates) {
    for (const shift of SHIFT_SEEDS) {
      const createdShift = await prisma.shift.create({
        data: {
          eventId: event.id,
          date,
          shiftType: shift.shiftType,
          module: shift.module,
          label: shift.label,
          startAt: atDayTime(date, shift.startHour, shift.startMinute),
          endAt: atDayTime(date, shift.endHour, shift.endMinute),
          arrivalAt:
            shift.arrivalHour === undefined
              ? null
              : atDayTime(date, shift.arrivalHour, shift.arrivalMinute ?? 0),
          conflictStartAt: atDayTime(date, shift.conflictStartHour, shift.conflictStartMinute),
          conflictEndAt: atDayTime(date, shift.conflictEndHour, shift.conflictEndMinute),
        },
      });

      if (shift.module === RoleModule.BOOTH && (shift.shiftType === ShiftType.BOOTH_DAY || shift.shiftType === ShiftType.BOOTH_NIGHT)) {
        for (const boothRole of ROLE_SEEDS.filter((r) => r.module === RoleModule.BOOTH && typeof r.boothTarget === "number")) {
          await prisma.roleTarget.create({
            data: {
              shiftId: createdShift.id,
              roleId: roleByKey.get(boothRole.key)!,
              target: boothRole.boothTarget!,
            },
          });
        }
      }
    }
  }

  console.log("Seed completed for festival dates Feb 26 - Mar 8, 2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
