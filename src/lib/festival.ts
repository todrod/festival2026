import { addDays, differenceInCalendarDays, format, set } from "date-fns";
import {
  AssignmentSource,
  Gender,
  type Prisma,
  RoleModule,
  ShiftType,
  type Volunteer,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seniorityTier } from "@/lib/seniority";

export const FESTIVAL_NAME = "St. Clement Strawberry Festival";
// Anchored to UTC noon so the calendar date is stable regardless of the
// viewer's (or the build server's) timezone. See audit finding DATA-1.
export const FESTIVAL_START = new Date("2027-03-04T12:00:00Z");
export const FESTIVAL_END = new Date("2027-03-14T12:00:00Z");

export type ShiftSeed = {
  shiftType: ShiftType;
  module: RoleModule;
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  arrivalHour?: number;
  arrivalMinute?: number;
  conflictStartHour: number;
  conflictStartMinute: number;
  conflictEndHour: number;
  conflictEndMinute: number;
};

export const SHIFT_SEEDS: ShiftSeed[] = [
  {
    shiftType: ShiftType.BOOTH_DAY,
    module: RoleModule.BOOTH,
    label: "Booth Day",
    startHour: 9,
    startMinute: 30,
    endHour: 17,
    endMinute: 30,
    arrivalHour: 9,
    arrivalMinute: 0,
    conflictStartHour: 9,
    conflictStartMinute: 30,
    conflictEndHour: 17,
    conflictEndMinute: 30,
  },
  {
    shiftType: ShiftType.BOOTH_NIGHT,
    module: RoleModule.BOOTH,
    label: "Booth Night",
    startHour: 17,
    startMinute: 0,
    endHour: 23,
    endMinute: 0,
    arrivalHour: 16,
    arrivalMinute: 30,
    conflictStartHour: 17,
    conflictStartMinute: 0,
    conflictEndHour: 23,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_EARLY_SETUP,
    module: RoleModule.HALL,
    label: "Early Setup",
    startHour: 6,
    startMinute: 0,
    endHour: 8,
    endMinute: 0,
    conflictStartHour: 6,
    conflictStartMinute: 0,
    conflictEndHour: 8,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_BERRY_HULLERS,
    module: RoleModule.HALL,
    label: "Berry Hullers",
    startHour: 7,
    startMinute: 30,
    endHour: 13,
    endMinute: 0,
    conflictStartHour: 7,
    conflictStartMinute: 30,
    conflictEndHour: 13,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_BERRY_PRODUCTION,
    module: RoleModule.HALL,
    label: "Berry Production",
    startHour: 9,
    startMinute: 30,
    endHour: 14,
    endMinute: 0,
    conflictStartHour: 9,
    conflictStartMinute: 30,
    conflictEndHour: 14,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_UNIFORMS_AM,
    module: RoleModule.HALL,
    label: "Uniforms AM",
    startHour: 8,
    startMinute: 0,
    endHour: 13,
    endMinute: 0,
    conflictStartHour: 8,
    conflictStartMinute: 0,
    conflictEndHour: 13,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_UNIFORMS_PM,
    module: RoleModule.HALL,
    label: "Uniforms PM",
    startHour: 15,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    conflictStartHour: 15,
    conflictStartMinute: 0,
    conflictEndHour: 19,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_HEAVY_HALL,
    module: RoleModule.HALL,
    label: "Heavy Hall",
    startHour: 6,
    startMinute: 30,
    endHour: 13,
    endMinute: 0,
    conflictStartHour: 6,
    conflictStartMinute: 30,
    conflictEndHour: 13,
    conflictEndMinute: 0,
  },
  {
    shiftType: ShiftType.HALL_BUCKET_WASHERS,
    module: RoleModule.HALL,
    label: "Bucket Washers",
    startHour: 18,
    startMinute: 30,
    endHour: 21,
    endMinute: 30,
    conflictStartHour: 18,
    conflictStartMinute: 30,
    conflictEndHour: 21,
    conflictEndMinute: 30,
  },
  {
    shiftType: ShiftType.HALL_DRIVERS,
    module: RoleModule.HALL,
    label: "Drivers (Manual)",
    startHour: 12,
    startMinute: 0,
    endHour: 16,
    endMinute: 0,
    conflictStartHour: 12,
    conflictStartMinute: 0,
    conflictEndHour: 16,
    conflictEndMinute: 0,
  },
];

export type RoleSeed = {
  key: string;
  name: string;
  module: RoleModule;
  description: string;
  requiresStanding?: boolean;
  requiresHeavyLift?: boolean;
  requiresCash?: boolean;
  requiresOutdoor?: boolean;
  requiresTraining?: boolean;
  requiresApproval?: boolean;
  requiredGender?: Gender;
  manualOnly?: boolean;
  isRelief?: boolean;
  boothTarget?: number;
};

export const ROLE_SEEDS: RoleSeed[] = [
  { key: "SUPERVISOR", name: "Supervisor", module: RoleModule.BOOTH, description: "Leads shift operations and escalations.", requiresStanding: true, requiresTraining: true, requiresApproval: true, boothTarget: 1 },
  { key: "CROWD_CONTROL", name: "Crowd Control / Floater", module: RoleModule.BOOTH, description: "Keeps lines moving and supports guests.", requiresStanding: true, requiresOutdoor: true, boothTarget: 5 },
  { key: "CASHIER", name: "Cashier", module: RoleModule.BOOTH, description: "Handles payments and reconciles drawer.", requiresStanding: true, requiresCash: true, boothTarget: 2 },
  { key: "TICKET_TAKER", name: "Ticket Taker", module: RoleModule.BOOTH, description: "Checks and tears tickets at service area.", requiresStanding: true, boothTarget: 4 },
  { key: "SHORTCAKE_GIRL", name: "Shortcake Girl", module: RoleModule.BOOTH, description: "Prepares and serves shortcake portions.", requiresStanding: true, boothTarget: 4 },
  { key: "BERRY_GIRL", name: "Berry Girl", module: RoleModule.BOOTH, description: "Handles berry topping stations.", requiresStanding: true, requiredGender: Gender.FEMALE, boothTarget: 4 },
  { key: "LIGHT_DUTY_FOOD_HANDLER", name: "Light Duty Food Handler", module: RoleModule.BOOTH, description: "Supports food prep with light lifting.", requiresStanding: true, boothTarget: 2 },
  { key: "HEAVY_DUTY_FOOD_HANDLER", name: "Heavy Duty Food Handler", module: RoleModule.BOOTH, description: "Moves heavier food items and supplies.", requiresStanding: true, requiresHeavyLift: true, boothTarget: 2 },
  { key: "STICKER_PERSON", name: "Sticker Persons", module: RoleModule.BOOTH, description: "Preps and places stickers for orders.", requiresStanding: true, requiredGender: Gender.FEMALE, boothTarget: 2 },
  { key: "SHORTCAKE_STACKER", name: "Shortcake Stacker", module: RoleModule.BOOTH, description: "Stacks and stages shortcake trays.", requiresStanding: true, requiresHeavyLift: true, boothTarget: 2 },
  { key: "CREAM_WHIPPER", name: "Cream Whippers", module: RoleModule.BOOTH, description: "Prepares cream stations and restocks.", requiresStanding: true, requiresHeavyLift: true, boothTarget: 4 },
  { key: "KITCHEN_HELPER", name: "Kitchen Helper", module: RoleModule.BOOTH, description: "Assists kitchen throughput and sanitation.", requiresStanding: true, requiresHeavyLift: true, boothTarget: 2 },
  { key: "RELIEF", name: "Relief", module: RoleModule.BOOTH, description: "Universal backup for all non-supervisor booth roles.", requiresStanding: true, requiresHeavyLift: true, requiresCash: true, requiresOutdoor: true, isRelief: true, boothTarget: 4 },
  { key: "COFFEE_PERSON", name: "Coffee Person", module: RoleModule.BOOTH, description: "Coffee station + cash transactions.", requiresStanding: true, requiresCash: true, boothTarget: 2 },
  { key: "CUSTOMER_SERVICE", name: "Customer Service / Floaters", module: RoleModule.BOOTH, description: "Guest support and line help.", requiresStanding: true, requiresOutdoor: true, boothTarget: 5 },

  { key: "EARLY_SETUP", name: "Early Setup", module: RoleModule.HALL, description: "Setup before opening; lifting required.", requiresHeavyLift: true, requiresStanding: true },
  { key: "BERRY_HULLERS", name: "Berry Hullers", module: RoleModule.HALL, description: "Hull berries for production flow.", requiresStanding: true },
  { key: "BERRY_PRODUCTION", name: "Berry Production", module: RoleModule.HALL, description: "Production line processing.", requiresStanding: true },
  { key: "UNIFORMS_AM", name: "Uniforms AM", module: RoleModule.HALL, description: "Morning uniforms distribution.", requiresStanding: true },
  { key: "UNIFORMS_PM", name: "Uniforms PM", module: RoleModule.HALL, description: "Afternoon uniforms distribution.", requiresStanding: true },
  { key: "HEAVY_HALL", name: "Heavy Hall Worker", module: RoleModule.HALL, description: "Heavy moving and hall support.", requiresStanding: true, requiresHeavyLift: true },
  { key: "BUCKET_WASHERS", name: "Bucket Washers", module: RoleModule.HALL, description: "Night bucket washdown team.", requiresStanding: true },
  { key: "DRIVERS", name: "Drivers", module: RoleModule.HALL, description: "Manual assignment only until times finalized.", manualOnly: true },
];

export const constrainedRoleOrder = [
  "SUPERVISOR",
  "CASHIER",
  "COFFEE_PERSON",
  "HEAVY_DUTY_FOOD_HANDLER",
  "SHORTCAKE_STACKER",
  "CREAM_WHIPPER",
  "KITCHEN_HELPER",
  "BERRY_GIRL",
  "STICKER_PERSON",
];

export const festivalDates = () => {
  const days = differenceInCalendarDays(FESTIVAL_END, FESTIVAL_START) + 1;
  const dates: Date[] = [];
  for (let i = 0; i < days; i += 1) dates.push(addDays(FESTIVAL_START, i));
  return dates;
};

export function atDayTime(date: Date, hour: number, minute: number) {
  return set(date, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

type Eligibility = { ok: boolean; reason?: string };

export async function checkAssignmentEligibility(input: {
  volunteerId: string;
  shiftId: string;
  roleId: string;
  forceAssign?: boolean;
}) {
  const { volunteerId, shiftId, roleId, forceAssign } = input;

  const [volunteer, ack, shift, role, availability, training, approval] = await Promise.all([
    prisma.volunteer.findUnique({ where: { id: volunteerId } }),
    prisma.volunteerAcknowledgement.findUnique({ where: { volunteerId } }),
    prisma.shift.findUnique({ where: { id: shiftId } }),
    prisma.role.findUnique({ where: { id: roleId } }),
    prisma.availability.findUnique({ where: { volunteerId_shiftId: { volunteerId, shiftId } } }),
    prisma.training.findUnique({ where: { volunteerId_roleId: { volunteerId, roleId } } }),
    prisma.approval.findUnique({ where: { volunteerId_roleId: { volunteerId, roleId } } }),
  ]);

  if (!volunteer || !ack || !shift || !role) return { ok: false, reason: "Missing records" } satisfies Eligibility;
  if (volunteer.status !== "VERIFIED") return { ok: false, reason: "Volunteer not verified yet" } satisfies Eligibility;
  if (!availability && !forceAssign) return { ok: false, reason: "Volunteer not available for this shift" };

  if (role.requiredGender && volunteer.gender !== role.requiredGender && !forceAssign) {
    return { ok: false, reason: `Role requires ${role.requiredGender}` };
  }

  if (role.requiresStanding && !ack.standingWalking && !forceAssign) return { ok: false, reason: "Standing/walking acknowledgement required" };
  if (role.requiresHeavyLift && !ack.heavyLift50 && !forceAssign) return { ok: false, reason: "Heavy-lift acknowledgement required" };
  if (role.requiresCash && !ack.cashHandling && !forceAssign) return { ok: false, reason: "Cash-handling acknowledgement required" };
  if (role.requiresOutdoor && !ack.outdoorSun && !forceAssign) return { ok: false, reason: "Outdoor/sun acknowledgement required" };

  if (role.requiresTraining && !training?.trained && !forceAssign) return { ok: false, reason: "Training required" };
  if (role.requiresApproval && !approval?.approved && !forceAssign) return { ok: false, reason: "Approval required" };

  const dayAssignments = await prisma.assignment.findMany({
    where: {
      volunteerId,
      shift: {
        date: shift.date,
      },
    },
    include: { shift: true },
  });

  for (const existing of dayAssignments) {
    if (existing.shiftId === shift.id) continue;

    if (
      (existing.shift.shiftType === ShiftType.BOOTH_DAY && shift.shiftType === ShiftType.BOOTH_NIGHT) ||
      (existing.shift.shiftType === ShiftType.BOOTH_NIGHT && shift.shiftType === ShiftType.BOOTH_DAY)
    ) {
      if (!forceAssign) return { ok: false, reason: "Cannot assign booth day and booth night same date" };
    }

    if (
      overlap(existing.shift.conflictStartAt, existing.shift.conflictEndAt, shift.conflictStartAt, shift.conflictEndAt) &&
      !forceAssign
    ) {
      return { ok: false, reason: "Time conflict with existing assignment" };
    }
  }

  return { ok: true } satisfies Eligibility;
}

function roleWeight(roleKey: string) {
  const idx = constrainedRoleOrder.indexOf(roleKey);
  return idx === -1 ? 100 + idx : idx;
}

export async function autoAssignShift(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new Error("Shift not found");
  const shiftRecord = shift;

  const roleTargets = await prisma.roleTarget.findMany({ where: { shiftId }, include: { role: true } });
  const locked = await prisma.assignment.findMany({ where: { shiftId, locked: true } });

  const roleMap = new Map(
    roleTargets
      .sort((a, b) => roleWeight(a.role.key) - roleWeight(b.role.key))
      .map((rt) => [rt.roleId, { ...rt, assigned: 0 }]),
  );

  const existing = await prisma.assignment.findMany({ where: { shiftId }, include: { role: true } });
  for (const asg of existing) {
    const rt = roleMap.get(asg.roleId);
    if (rt) rt.assigned += 1;
  }

  const available = await prisma.availability.findMany({
    where: {
      shiftId,
      volunteer: { status: "VERIFIED" },
    },
    include: {
      volunteer: {
        include: {
          acknowledgement: true,
          trainings: true,
          approvals: true,
          preferences: { where: { shiftId }, include: { role: true } },
        },
      },
    },
  });

  const availableVolunteers = available
    .map((row) => row.volunteer)
    .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx);

  const availableVolunteerIds = availableVolunteers.map((v) => v.id);

  // Reliability: count prior no-shows so chronic no-shows are gently
  // deprioritized in the score (seniority still wins across tiers).
  const noShowAssignments = await prisma.assignment.findMany({
    where: { volunteerId: { in: availableVolunteerIds }, noShow: true },
    select: { volunteerId: true },
  });
  const noShowCountByVolunteer = new Map<string, number>();
  for (const a of noShowAssignments) {
    noShowCountByVolunteer.set(a.volunteerId, (noShowCountByVolunteer.get(a.volunteerId) ?? 0) + 1);
  }

  const sameDayAssignments = await prisma.assignment.findMany({
    where: {
      volunteerId: { in: availableVolunteerIds },
      shift: { date: shift.date },
    },
    include: { shift: true },
  });

  const dayAssignmentMap = new Map<string, typeof sameDayAssignments>();
  for (const a of sameDayAssignments) {
    const list = dayAssignmentMap.get(a.volunteerId) ?? [];
    list.push(a);
    dayAssignmentMap.set(a.volunteerId, list);
  }

  // Block reassignment for anyone already assigned in this shift and preserve locked picks.
  const takenVolunteerIds = new Set([...locked.map((a) => a.volunteerId), ...existing.map((a) => a.volunteerId)]);

  const byRole = [...roleMap.values()]
    .filter((r) => !r.role.manualOnly)
    .sort((a, b) => roleWeight(a.role.key) - roleWeight(b.role.key));

  function isEligible(volunteer: (typeof availableVolunteers)[number], role: typeof byRole[number]["role"]) {
    const ack = volunteer.acknowledgement;
    if (!ack) return false;
    if (role.requiredGender && volunteer.gender !== role.requiredGender) return false;
    if (role.requiresStanding && !ack.standingWalking) return false;
    if (role.requiresHeavyLift && !ack.heavyLift50) return false;
    if (role.requiresCash && !ack.cashHandling) return false;
    if (role.requiresOutdoor && !ack.outdoorSun) return false;
    if (role.requiresTraining && !volunteer.trainings.some((t) => t.roleId === role.id && t.trained)) return false;
    if (role.requiresApproval && !volunteer.approvals.some((a) => a.roleId === role.id && a.approved)) return false;

    const dayAssignments = dayAssignmentMap.get(volunteer.id) ?? [];
    for (const existingAssignment of dayAssignments) {
      const existingShift = existingAssignment.shift;
      if (
        (existingShift.shiftType === ShiftType.BOOTH_DAY && shiftRecord.shiftType === ShiftType.BOOTH_NIGHT) ||
        (existingShift.shiftType === ShiftType.BOOTH_NIGHT && shiftRecord.shiftType === ShiftType.BOOTH_DAY)
      ) {
        return false;
      }
      if (
        overlap(
          existingShift.conflictStartAt,
          existingShift.conflictEndAt,
          shiftRecord.conflictStartAt,
          shiftRecord.conflictEndAt,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  for (const target of byRole) {
    while (target.assigned < target.target) {
      const candidates = availableVolunteers
        .filter((v) => !takenVolunteerIds.has(v.id))
        .filter((v) => {
          const pref = v.preferences.find((p) => p.roleId === target.roleId);
          const score = pref ? 1 / Math.max(pref.rank, 1) : 0;
          return target.role.isRelief ? v.willingAnyBoothDay || v.willingAnyBoothNight || score >= 0 : true;
        });

      const scored: Array<{ volunteer: Volunteer; score: number }> = [];
      for (const volunteer of candidates) {
        if (!isEligible(volunteer, target.role)) continue;
        const pref = (volunteer as Prisma.VolunteerGetPayload<{
          include: { preferences: true };
        }>).preferences.find((p) => p.roleId === target.roleId);
        // Seniority is the primary priority: tier first, then years within the
        // tier, then a no-show penalty and role preference as tie-breaks, then a
        // stable jitter. A no-show costs ~1.2 years of standing within the tier,
        // but never bumps someone below a lower tier.
        const tier = seniorityTier(volunteer.yearsExperience);
        const rankScore = pref ? 11 - pref.rank : 0; // 1..10 for a ranked pick, 0 otherwise
        const noShowPenalty = (noShowCountByVolunteer.get(volunteer.id) ?? 0) * 120;
        const stable = Number.parseInt(volunteer.id.slice(-3), 36) % 7;
        const score = tier.rank * 100000 + volunteer.yearsExperience * 100 - noShowPenalty + rankScore + stable / 10;
        scored.push({ volunteer, score });
      }

      scored.sort((a, b) => b.score - a.score);
      const winner = scored[0];
      if (!winner) break;

      await prisma.assignment.create({
        data: {
          volunteerId: winner.volunteer.id,
          shiftId,
          roleId: target.roleId,
          source: AssignmentSource.AUTO,
        },
      });
      target.assigned += 1;
      takenVolunteerIds.add(winner.volunteer.id);
    }
  }

  return prisma.assignment.findMany({
    where: { shiftId },
    include: { volunteer: true, role: true },
    orderBy: [{ role: { name: "asc" } }, { volunteer: { lastName: "asc" } }],
  });
}

export function formatFestivalDate(d: Date) {
  return format(d, "EEE, MMM d");
}
