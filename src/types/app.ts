import type { Assignment, Approval, AuditLog, Availability, Role, RoleTarget, Shift, Training, Volunteer, VolunteerAcknowledgement } from "@prisma/client";

export type VolunteerWithAck = Volunteer & { acknowledgement: VolunteerAcknowledgement | null };
export type AssignmentWithRelations = Assignment & {
  volunteer: Volunteer;
  role: Role;
  shift: Shift;
};

export type AdminDataResponse = {
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
};
