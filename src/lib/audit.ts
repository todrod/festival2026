import { prisma } from "@/lib/prisma";

export async function logAdminAction(input: {
  action: string;
  entityType: string;
  entityId?: string;
  shiftId?: string;
  details?: string;
  actor?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actor: input.actor || "admin",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        shiftId: input.shiftId,
        details: input.details,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
