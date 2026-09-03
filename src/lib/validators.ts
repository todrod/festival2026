import { ShiftType } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(1),
  emergencyContactName: z.string().min(1),
  emergencyContactPhone: z.string().min(7),
  gender: z.enum(["FEMALE", "MALE"]),
  language: z.enum(["ENGLISH", "SPANISH", "BOTH"]),
  firstTimeVolunteer: z.boolean(),
  orientationRsvp: z.enum(["WILL_ATTEND", "WILL_NOT_ATTEND"]).nullable().optional(),
  parentConsent: z.boolean().optional().default(false),
  emergencyOptIn: z.boolean().optional().default(false),
  emergencyDates: z.array(z.string()).optional().default([]),
  textOk: z.boolean(),
  emailOk: z.boolean(),
  yearsExperience: z.number().int().min(0),
  willingAnyBoothDay: z.boolean(),
  willingAnyBoothNight: z.boolean(),
  acknowledgements: z.object({
    standingWalking: z.boolean(),
    liftingCapacityLbs: z.union([z.literal(0), z.literal(25), z.literal(50)]),
    cashHandling: z.boolean(),
    outdoorSun: z.boolean(),
    // Required to submit signup.
    liabilityAcknowledged: z.literal(true),
    foodRulesAcknowledged: z.literal(true),
  }),
  availabilityShiftIds: z.array(z.string().min(1)),
  // Ranked position choices (1st, 2nd, 3rd) applied across selected shifts.
  preferences: z.array(
    z.object({
      shiftId: z.string().min(1),
      roleId: z.string().min(1),
      rank: z.number().int().min(1).max(3),
    }),
  ),
});

export const loginSchema = z.object({
  name: z.string().max(60).default(""),
  password: z.string().min(1),
});

export const autoAssignSchema = z.object({
  shiftId: z.string().min(1),
});

export const assignmentSchema = z.object({
  volunteerId: z.string().min(1),
  shiftId: z.string().min(1),
  roleId: z.string().min(1),
  lock: z.boolean().optional(),
  forceAssign: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export const trainingSchema = z.object({
  volunteerId: z.string().min(1),
  roleId: z.string().min(1),
  trained: z.boolean(),
});

export const approvalSchema = z.object({
  volunteerId: z.string().min(1),
  roleId: z.string().min(1),
  approved: z.boolean(),
});

export const roleTargetSchema = z.object({
  shiftId: z.string().min(1),
  roleId: z.string().min(1),
  target: z.number().int().min(0).max(30),
});

export const shiftsQuerySchema = z.object({
  date: z.string().optional(),
  shiftType: z.nativeEnum(ShiftType).optional(),
});

export const adminNoteSchema = z.object({
  volunteerId: z.string().min(1),
  category: z.enum([
    "EXCELLENT",
    "NEEDS_GUIDANCE",
    "CALLOUT_HISTORY",
    "PHYSICAL_LIMITATION",
    "LANGUAGE_ONLY_SPANISH",
    "VIP_RETURN",
    "DO_NOT_SCHEDULE",
    "GENERAL",
  ]),
  text: z.string().max(2000),
  isPrivate: z.boolean().optional().default(false),
});

export const shiftNoteSchema = z.object({
  shiftId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export const publishSchema = z.object({
  shiftId: z.string().min(1),
  action: z.enum(["publish", "unpublish"]),
});

export const hallAttendanceSchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1).max(120),
  groupSize: z.number().int().min(1).max(500),
  activity: z.string().min(1).max(200),
  hours: z.number().min(0).max(24),
  notes: z.string().max(1000).optional(),
});

export const sendMessageSchema = z.object({
  kind: z.enum(["SCHEDULE", "REMINDER", "ANNOUNCEMENT"]),
  channel: z.enum(["sms", "email", "both"]),
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("date"), date: z.string().min(1) }),
    z.object({ type: z.literal("shift"), shiftId: z.string().min(1) }),
    z.object({ type: z.literal("volunteer"), volunteerCode: z.string().min(1) }),
  ]),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(3000),
  // For SCHEDULE messages: attach the full day/shift schedule with the
  // recipient's line highlighted.
  includeSchedule: z.boolean().optional().default(false),
});
