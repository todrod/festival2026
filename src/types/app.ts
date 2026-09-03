import type {
  AdminNote,
  Assignment,
  Approval,
  AuditLog,
  Availability,
  Role,
  RoleTarget,
  SchedulePublish,
  Shift,
  ShiftNote,
  Training,
  Volunteer,
  VolunteerAcknowledgement,
  VolunteerFlag,
} from "@prisma/client";
import type { StaffSession } from "@/lib/auth";

export type VolunteerWithAck = Volunteer & { acknowledgement: VolunteerAcknowledgement | null };
export type AssignmentWithRelations = Assignment & {
  volunteer: Volunteer;
  role: Role;
  shift: Shift;
};

export type AdminDataResponse = {
  session: StaffSession;
  shifts: Shift[];
  volunteers: VolunteerWithAck[];
  roles: Role[];
  assignments: AssignmentWithRelations[];
  trainings: Training[];
  approvals: Approval[];
  availability: (Availability & { volunteer: Volunteer })[];
  roleTargets: RoleTarget[];
  coverage: Array<{ shiftId: string; date: string; shiftType: string; filled: number; targets: number }>;
  auditLogs: AuditLog[];
  flags: VolunteerFlag[];
  adminNotes: AdminNote[];
  shiftNotes: ShiftNote[];
  publishes: SchedulePublish[];
};

export type AutoAssignWarningPayload = {
  volunteerId: string;
  volunteerCode: string;
  volunteerName: string;
  roleName: string;
  warnings: string[];
};
