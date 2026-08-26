import { AssignmentSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { checkAssignmentEligibility } from "@/lib/festival";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { assignmentSchema } from "@/lib/validators";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = assignmentSchema.parse(body);

    const forceAssign = parsed.forceAssign || false;
    if (forceAssign && !parsed.overrideReason?.trim()) {
      return NextResponse.json({ error: "Override reason required for force assign" }, { status: 400 });
    }

    const eligible = await checkAssignmentEligibility({
      volunteerId: parsed.volunteerId,
      shiftId: parsed.shiftId,
      roleId: parsed.roleId,
      forceAssign,
    });

    if (!eligible.ok && !forceAssign) {
      return NextResponse.json({ error: eligible.reason || "Constraint violation" }, { status: 409 });
    }

    const assignment = await prisma.assignment.upsert({
      where: {
        volunteerId_shiftId_roleId: {
          volunteerId: parsed.volunteerId,
          shiftId: parsed.shiftId,
          roleId: parsed.roleId,
        },
      },
      create: {
        volunteerId: parsed.volunteerId,
        shiftId: parsed.shiftId,
        roleId: parsed.roleId,
        source: AssignmentSource.MANUAL,
        forceAssigned: forceAssign,
        overrideReason: parsed.overrideReason,
        locked: !!parsed.lock,
      },
      update: {
        source: AssignmentSource.MANUAL,
        forceAssigned: forceAssign,
        overrideReason: parsed.overrideReason,
        locked: parsed.lock,
      },
    });

    await logAdminAction({
      action: "assignment_upsert",
      entityType: "Assignment",
      entityId: assignment.id,
      shiftId: parsed.shiftId,
      details: `${parsed.volunteerId}:${parsed.roleId}${forceAssign ? ":FORCE" : ""}`,
    });

    return NextResponse.json({ ok: true, assignment, warning: !eligible.ok ? eligible.reason : null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save assignment" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const existing = await prisma.assignment.findUnique({ where: { id } });
  await prisma.assignment.delete({ where: { id } });
  await logAdminAction({
    action: "assignment_delete",
    entityType: "Assignment",
    entityId: id,
    shiftId: existing?.shiftId,
  });
  return NextResponse.json({ ok: true });
}
