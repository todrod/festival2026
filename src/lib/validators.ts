import { ShiftType } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  emergencyContactName: z.string().min(1),
  emergencyContactPhone: z.string().min(7),
  gender: z.enum(["FEMALE", "MALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
  language: z.string().min(1),
  textOk: z.boolean(),
  emailOk: z.boolean(),
  yearsExperience: z.number().int().min(0),
  willingAnyBoothDay: z.boolean(),
  willingAnyBoothNight: z.boolean(),
  acknowledgements: z.object({
    // Required to submit signup.
    age18Plus: z.literal(true),
    standingWalking: z.literal(true),
    heavyLift50: z.boolean(),
    cashHandling: z.boolean(),
    outdoorSun: z.boolean(),
    liabilityAcknowledged: z.literal(true),
    foodRulesAcknowledged: z.literal(true),
  }),
  availabilityShiftIds: z.array(z.string().min(1)),
  preferences: z.array(
    z.object({
      shiftId: z.string().min(1),
      roleId: z.string().min(1),
      rank: z.number().int().min(1).max(10),
    }),
  ),
});

export const loginSchema = z.object({
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
