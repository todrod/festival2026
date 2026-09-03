import { addDays, differenceInCalendarDays, differenceInYears, format, set } from "date-fns";
import {
  AssignmentSource,
  Gender,
  RoleModule,
  ShiftType,
  type Role,
  type Volunteer,
  type VolunteerAcknowledgement,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FESTIVAL_NAME = "St. Clement Strawberry Festival";
export const PROJECT_NAME = "St. Clement Make Your Own Strawberry Shortcake Project";
// Anchored to UTC noon so the calendar date is stable regardless of the
// viewer's (or the build server's) timezone. See audit finding DATA-1.
export const FESTIVAL_START = new Date("2027-03-04T12:00:00Z");
export const FESTIVAL_END = new Date("2027-03-14T12:00:00Z");
export const PACKUP_DATE = new Date("2027-03-15T12:00:00Z");
export const HALL_START = new Date("2027-03-03T12:00:00Z");

export const ORIENTATION = {
  label: "Volunteer Orientation",
  date: new Date("2027-01-31T12:00:00Z"),
  place: "St. Clement Cronin Hall",
  timeLabel: "5:00–7:00 PM",
  dateLabel: "Sunday, January 31, 2027",
};

// Volunteer ID: [2-letter location][4-digit year][6-digit sequence].
export const LOCATION_CODE = "SC";
export const ID_YEAR = "2027";
export function volunteerCodeFor(seq: number) {
  return `${LOCATION_CODE}${ID_YEAR}${String(seq).padStart(6, "0")}`;
}

export function ageOn(dob: Date, onDate: Date = FESTIVAL_START) {
  return differenceInYears(onDate, dob);
}

export type ShiftSeed = {
  shiftType: ShiftType;
  module: RoleModule;
  label: string;
  // Which calendar days this shift exists on.
  days: "festival" | "packup";
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
    shiftType: ShiftType.BOOTH_SETUP,
    module: RoleModule.BOOTH,
    label: "Early Morning Setup",
    days: "festival",
    startHour: 6,
    startMinute: 0,
    endHour: 9,
    endMinute: 30,
    conflictStartHour: 6,
    conflictStartMinute: 0,
    conflictEndHour: 9,
    conflictEndMinute: 30,
  },
  {
    shiftType: ShiftType.BOOTH_DAY,
    module: RoleModule.BOOTH,
    label: "Day Shift (9:30 AM – 5:30 PM)",
    days: "festival",
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
    label: "Night Shift (5:00 PM – 11:00 PM)",
    days: "festival",
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
    shiftType: ShiftType.BOOTH_PACKUP,
    module: RoleModule.BOOTH,
    label: "Pack-Up Morning (March 15)",
    days: "packup",
    startHour: 8,
    startMinute: 0,
    endHour: 12,
    endMinute: 0,
    conflictStartHour: 8,
    conflictStartMinute: 0,
    conflictEndHour: 12,
    conflictEndMinute: 0,
  },
];

export type RoleSeed = {
  key: string;
  name: string;
  module: RoleModule;
  description: string;
  physicalDemands?: string;
  requiresStanding?: boolean;
  requiresHeavyLift?: boolean;
  liftLimitLbs?: number;
  minAge?: number;
  requiresCash?: boolean;
  requiresOutdoor?: boolean;
  requiresTraining?: boolean;
  requiresApproval?: boolean;
  requiredGender?: Gender;
  manualOnly?: boolean;
  isRelief?: boolean;
  infoOnly?: boolean;
  contactName?: string;
  contactPhone?: string;
  contactNote?: string;
  urgent?: boolean;
  // Slots needed per shift type (the Position Catalog headcount).
  targets?: Partial<Record<ShiftType, number>>;
};

// Booth positions (March 4–14) — descriptions from the paper job sheet.
export const ROLE_SEEDS: RoleSeed[] = [
  {
    key: "EARLY_BOOTH_SETUP",
    name: "Early Morning Booth Setup",
    module: RoleModule.BOOTH,
    description: "Booth setup starting at 6 AM daily. Lifting required.",
    physicalDemands: "Lifting required",
    requiresStanding: true,
    requiresHeavyLift: true,
    liftLimitLbs: 50,
    targets: { BOOTH_SETUP: 6 },
  },
  {
    key: "SUPERVISOR",
    name: "Supervisor",
    module: RoleModule.BOOTH,
    description: "Leads shift operations and escalations. Must be trained.",
    physicalDemands: "Standing",
    requiresStanding: true,
    requiresTraining: true,
    requiresApproval: true,
    targets: { BOOTH_DAY: 1, BOOTH_NIGHT: 1 },
  },
  {
    key: "CROWD_CONTROL",
    name: "Crowd Control",
    module: RoleModule.BOOTH,
    description: "Keeps lines moving, holds signs, and supports guests.",
    physicalDemands: "Standing, walking, sign-holding, outdoor sun exposure",
    requiresStanding: true,
    requiresOutdoor: true,
    targets: { BOOTH_DAY: 5, BOOTH_NIGHT: 5 },
  },
  {
    key: "CASHIER",
    name: "Cashier",
    module: RoleModule.BOOTH,
    description: "Handles payments and reconciles the drawer. Speed and efficiency.",
    physicalDemands: "Speed and efficiency, standing",
    requiresStanding: true,
    requiresCash: true,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "TICKET_TAKER",
    name: "Ticket Taker",
    module: RoleModule.BOOTH,
    description: "Checks and tears tickets at the service area.",
    physicalDemands: "Standing",
    requiresStanding: true,
    targets: { BOOTH_DAY: 4, BOOTH_NIGHT: 4 },
  },
  {
    key: "SHORTCAKE_GIRL",
    name: "Shortcake Girl",
    module: RoleModule.BOOTH,
    description: "Prepares and serves shortcake portions.",
    physicalDemands: "Standing",
    requiresStanding: true,
    targets: { BOOTH_DAY: 4, BOOTH_NIGHT: 4 },
  },
  {
    key: "BERRY_GIRL",
    name: "Berry Girl",
    module: RoleModule.BOOTH,
    description: "Handles the berry topping stations.",
    physicalDemands: "Standing",
    requiresStanding: true,
    requiredGender: Gender.FEMALE,
    targets: { BOOTH_DAY: 4, BOOTH_NIGHT: 4 },
  },
  {
    key: "LIGHT_DUTY_FOOD_HANDLER",
    name: "Light Duty Food Handler",
    module: RoleModule.BOOTH,
    description: "Supports food prep with light duties. Any gender.",
    physicalDemands: "Standing, walking",
    requiresStanding: true,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "HEAVY_DUTY_FOOD_HANDLER",
    name: "Heavy Duty Food Handler",
    module: RoleModule.BOOTH,
    description: "Moves heavier food items and supplies. Walking and lifting up to 50 lbs.",
    physicalDemands: "Walking and lifting up to 50 lbs",
    requiresStanding: true,
    requiresHeavyLift: true,
    liftLimitLbs: 50,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "STICKER_PERSON",
    name: "Sticker Persons",
    module: RoleModule.BOOTH,
    description: "Preps and places stickers for orders. Standing — no chairs.",
    physicalDemands: "Standing, no chairs",
    requiresStanding: true,
    requiredGender: Gender.FEMALE,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "SHORTCAKE_STACKER",
    name: "Shortcake Stacker",
    module: RoleModule.BOOTH,
    description: "Stacks and stages shortcake trays. Speed, efficiency, some lifting.",
    physicalDemands: "Speed, efficiency, some lifting",
    requiresStanding: true,
    liftLimitLbs: 25,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "CREAM_WHIPPER",
    name: "Cream Whippers",
    module: RoleModule.BOOTH,
    description: "Prepares cream stations and restocks. Speed, efficiency, some lifting.",
    physicalDemands: "Speed, efficiency, some lifting",
    requiresStanding: true,
    liftLimitLbs: 25,
    targets: { BOOTH_DAY: 4, BOOTH_NIGHT: 4 },
  },
  {
    key: "KITCHEN_HELPER",
    name: "Kitchen Helper",
    module: RoleModule.BOOTH,
    description: "Assists kitchen throughput and sanitation. Some lifting.",
    physicalDemands: "Some lifting",
    requiresStanding: true,
    liftLimitLbs: 25,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "RELIEF",
    name: "Relief Persons (4 types)",
    module: RoleModule.BOOTH,
    description: "Relieves other positions on breaks. Must understand all positions they relieve.",
    physicalDemands: "Standing",
    requiresStanding: true,
    isRelief: true,
    targets: { BOOTH_DAY: 4, BOOTH_NIGHT: 4 },
  },
  {
    key: "COFFEE_PERSON",
    name: "Coffee Person",
    module: RoleModule.BOOTH,
    description: "Runs the coffee station, including cash transactions.",
    physicalDemands: "Standing",
    requiresStanding: true,
    requiresCash: true,
    targets: { BOOTH_DAY: 2, BOOTH_NIGHT: 2 },
  },
  {
    key: "CUSTOMER_SERVICE",
    name: "Customer Service / Floaters",
    module: RoleModule.BOOTH,
    description: "Guest support and line help wherever needed.",
    physicalDemands: "Standing, walking",
    requiresStanding: true,
    targets: { BOOTH_DAY: 5, BOOTH_NIGHT: 5 },
  },
  {
    key: "PACKUP_CREW",
    name: "Pack-Up Crew (March 15)",
    module: RoleModule.BOOTH,
    description: "Pack-up morning after the festival — breaking down and storing the booth.",
    physicalDemands: "Lifting",
    requiresStanding: true,
    liftLimitLbs: 25,
    targets: { BOOTH_PACKUP: 12 },
  },

  // Hall positions (March 3–14, lunch provided) — informational only.
  // Sign-up is by phone with the contact person; no online scheduling.
  {
    key: "BERRY_HULLERS",
    name: "Berry Hullers",
    module: RoleModule.HALL,
    description: "Hull berries for the production flow. 7:30 AM until done. Bring your own knife.",
    physicalDemands: "Standing",
    infoOnly: true,
    contactName: "Ted",
    contactPhone: "813-334-9578",
    contactNote: "7:30 AM until done · bring your own knife",
  },
  {
    key: "BERRY_PRODUCTION",
    name: "Berry Production Line",
    module: RoleModule.HALL,
    description: "Production line processing. Lifting required.",
    physicalDemands: "Lifting required",
    infoOnly: true,
    contactName: "Tim",
    contactPhone: "813-382-3455",
  },
  {
    key: "CAKES_DEPT",
    name: "Cakes Department",
    module: RoleModule.HALL,
    description: "Cake preparation. Standing, some lifting. 8–8:30 AM start.",
    physicalDemands: "Standing, some lifting",
    infoOnly: true,
    contactNote: "8–8:30 AM start",
  },
  {
    key: "UNIFORM_DEPT",
    name: "Uniform Department",
    module: RoleModule.HALL,
    description: "Uniform distribution and tracking. Standing.",
    physicalDemands: "Standing",
    infoOnly: true,
    contactName: "Cathy",
    contactPhone: "305-216-2806",
  },
  {
    key: "HEAVY_HALL",
    name: "Heavy Duty Hall Workers",
    module: RoleModule.HALL,
    description: "Heavy moving and hall support, 6:30 AM – 1 PM. Lifting to 50 lbs. URGENTLY NEEDED.",
    physicalDemands: "Lifting to 50 lbs",
    infoOnly: true,
    contactName: "Ted",
    contactPhone: "813-334-9578",
    contactNote: "6:30 AM – 1 PM",
    urgent: true,
  },
  {
    key: "BUCKET_WASHING",
    name: "Nightly Bucket Washing",
    module: RoleModule.HALL,
    description:
      "Nightly bucket washdown, 6:30 PM until done. No age requirement — family-friendly. Sign-up required. Morning Bucket Washers also needed Feb 28.",
    physicalDemands: "Standing",
    minAge: 0,
    infoOnly: true,
    contactName: "Ana",
    contactPhone: "813-704-3098",
    contactNote: "6:30 PM until done · Morning Bucket Washers also needed Feb 28",
  },
  {
    key: "EARLY_SETUP_HALL_INFO",
    name: "Early Morning Booth Setup",
    module: RoleModule.HALL,
    description: "This is a Booth position — sign up on the Booth tab, or call Trish.",
    physicalDemands: "Lifting required",
    infoOnly: true,
    contactName: "Trish",
    contactPhone: "813-335-4299",
    contactNote: "This is a Booth position",
  },
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

// ---------------------------------------------------------------------------
// Hard blocks vs. soft flags.
//
// Hard blocks stop a placement outright: gender restriction, minimum age,
// training/approval gates, time conflicts, and the booth day+night rule.
// Soft flags never block — they are surfaced inline to the scheduler:
// lifting declaration below the position's requirement, no extended-standing
// declaration, and age 16–18 without parent consent.
// ---------------------------------------------------------------------------

export type VolunteerLite = Pick<Volunteer, "id" | "gender" | "dob" | "parentConsent">;
export type AckLite = Pick<
  VolunteerAcknowledgement,
  "standingWalking" | "heavyLift50" | "liftingCapacityLbs" | "cashHandling" | "outdoorSun"
> | null;

export function hardBlockReasons(volunteer: VolunteerLite, role: Role): string[] {
  const reasons: string[] = [];
  if (role.requiredGender && volunteer.gender !== role.requiredGender) {
    reasons.push(`Position is restricted to ${role.requiredGender === "FEMALE" ? "female" : "male"} volunteers`);
  }
  const age = ageOn(new Date(volunteer.dob));
  if (role.minAge > 0 && age < role.minAge) {
    reasons.push(`Volunteer is under the minimum age of ${role.minAge}`);
  }
  return reasons;
}

export function softFlagWarnings(volunteer: VolunteerLite, ack: AckLite, role: Role): string[] {
  const warnings: string[] = [];
  const age = ageOn(new Date(volunteer.dob));
  if (age >= 16 && age < 18 && !volunteer.parentConsent) {
    warnings.push("Age 16–18 without parent consent on file");
  }
  if (role.liftLimitLbs > 0 && (ack?.liftingCapacityLbs ?? 0) < role.liftLimitLbs) {
    warnings.push(`Lifting declaration (${ack?.liftingCapacityLbs ?? 0} lbs) may not meet the ${role.liftLimitLbs} lbs requirement`);
  }
  if (role.requiresStanding && !ack?.standingWalking) {
    warnings.push("Has not declared they can stand/walk for extended periods");
  }
  return warnings;
}

type Eligibility = { ok: boolean; reason?: string; warnings?: string[] };

export async function checkAssignmentEligibility(input: {
  volunteerId: string;
  shiftId: string;
  roleId: string;
  forceAssign?: boolean;
}): Promise<Eligibility> {
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

  if (!volunteer || !shift || !role) return { ok: false, reason: "Missing records" };
  if (role.infoOnly) return { ok: false, reason: "Hall positions are organized by phone — not schedulable here" };
  if (volunteer.status !== "VERIFIED") return { ok: false, reason: "Volunteer not verified yet" };
  if (!availability && !forceAssign) return { ok: false, reason: "Volunteer not available for this shift" };

  const hardBlocks = hardBlockReasons(volunteer, role);
  if (hardBlocks.length > 0 && !forceAssign) return { ok: false, reason: hardBlocks[0] };

  if (role.requiresTraining && !training?.trained && !forceAssign) return { ok: false, reason: "Training required" };
  if (role.requiresApproval && !approval?.approved && !forceAssign) return { ok: false, reason: "Approval required" };

  const dayAssignments = await prisma.assignment.findMany({
    where: { volunteerId, shift: { date: shift.date } },
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

  return { ok: true, warnings: softFlagWarnings(volunteer, ack, role) };
}

export type AutoAssignWarning = {
  volunteerId: string;
  volunteerCode: string;
  volunteerName: string;
  roleName: string;
  warnings: string[];
};

// Autofill per spec:
//   1. Pool: available for the shift, position in their preference list, and no
//      hard block (gender restriction, age). DO_NOT_SCHEDULE-tagged volunteers
//      are excluded. Soft flags do NOT exclude anyone.
//   2. Sort: legacy score DESC, then sign-up timestamp ASC.
//   3. Fill to the position's target headcount, collecting soft-flag warnings
//      for the scheduler to review inline.
export async function autoAssignShift(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new Error("Shift not found");
  const shiftRecord = shift;

  const roleTargets = await prisma.roleTarget.findMany({ where: { shiftId }, include: { role: true } });
  const existing = await prisma.assignment.findMany({ where: { shiftId } });

  const roleMap = new Map(roleTargets.map((rt) => [rt.roleId, { ...rt, assigned: 0 }]));
  for (const asg of existing) {
    const rt = roleMap.get(asg.roleId);
    if (rt) rt.assigned += 1;
  }

  const available = await prisma.availability.findMany({
    where: { shiftId, volunteer: { status: "VERIFIED" } },
    include: {
      volunteer: {
        include: {
          acknowledgement: true,
          trainings: true,
          approvals: true,
          preferences: { include: { role: true } },
          notes: { where: { category: "DO_NOT_SCHEDULE" }, select: { id: true } },
        },
      },
    },
  });

  const availableVolunteers = available
    .map((row) => row.volunteer)
    .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
    .filter((v) => v.notes.length === 0);

  const availableVolunteerIds = availableVolunteers.map((v) => v.id);

  const sameDayAssignments = await prisma.assignment.findMany({
    where: { volunteerId: { in: availableVolunteerIds }, shift: { date: shift.date } },
    include: { shift: true },
  });
  const dayAssignmentMap = new Map<string, typeof sameDayAssignments>();
  for (const a of sameDayAssignments) {
    const list = dayAssignmentMap.get(a.volunteerId) ?? [];
    list.push(a);
    dayAssignmentMap.set(a.volunteerId, list);
  }

  const takenVolunteerIds = new Set(existing.map((a) => a.volunteerId));
  const warnings: AutoAssignWarning[] = [];

  function isEligible(volunteer: (typeof availableVolunteers)[number], role: Role) {
    if (hardBlockReasons(volunteer, role).length > 0) return false;
    if (role.requiresTraining && !volunteer.trainings.some((t) => t.roleId === role.id && t.trained)) return false;
    if (role.requiresApproval && !volunteer.approvals.some((a) => a.roleId === role.id && a.approved)) return false;

    for (const existingAssignment of dayAssignmentMap.get(volunteer.id) ?? []) {
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

  const byRole = [...roleMap.values()].filter((r) => !r.role.manualOnly && !r.role.infoOnly);

  for (const target of byRole) {
    while (target.assigned < target.target) {
      const candidates = availableVolunteers
        .filter((v) => !takenVolunteerIds.has(v.id))
        .filter((v) => {
          const hasPref = v.preferences.some((p) => p.roleId === target.roleId);
          // "Willing to do any" counts as having every booth position in the list.
          const willingAny =
            shiftRecord.shiftType === ShiftType.BOOTH_DAY
              ? v.willingAnyBoothDay
              : shiftRecord.shiftType === ShiftType.BOOTH_NIGHT
                ? v.willingAnyBoothNight
                : v.willingAnyBoothDay || v.willingAnyBoothNight;
          return hasPref || willingAny;
        })
        .filter((v) => isEligible(v, target.role));

      // Legacy score DESC, then sign-up timestamp ASC; ranked preference for the
      // position breaks remaining ties.
      candidates.sort((a, b) => {
        if (b.yearsExperience !== a.yearsExperience) return b.yearsExperience - a.yearsExperience;
        const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (createdDiff !== 0) return createdDiff;
        const rankA = a.preferences.find((p) => p.roleId === target.roleId)?.rank ?? 99;
        const rankB = b.preferences.find((p) => p.roleId === target.roleId)?.rank ?? 99;
        return rankA - rankB;
      });

      const winner = candidates[0];
      if (!winner) break;

      await prisma.assignment.create({
        data: {
          volunteerId: winner.id,
          shiftId,
          roleId: target.roleId,
          source: AssignmentSource.AUTO,
        },
      });

      const soft = softFlagWarnings(winner, winner.acknowledgement, target.role);
      if (soft.length > 0) {
        warnings.push({
          volunteerId: winner.id,
          volunteerCode: winner.volunteerCode ?? volunteerCodeFor(winner.seq),
          volunteerName: `${winner.firstName} ${winner.lastName}`,
          roleName: target.role.name,
          warnings: soft,
        });
      }

      target.assigned += 1;
      takenVolunteerIds.add(winner.id);
    }
  }

  const assignments = await prisma.assignment.findMany({
    where: { shiftId },
    include: { volunteer: true, role: true },
    orderBy: [{ role: { name: "asc" } }, { volunteer: { lastName: "asc" } }],
  });

  return { assignments, warnings };
}

export function formatFestivalDate(d: Date) {
  return format(d, "EEE, MMM d");
}
