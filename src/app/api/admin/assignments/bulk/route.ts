import { z } from "zod";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { autoAssignShift } from "@/lib/festival";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

const schema = z.object({
  shiftId: z.string().min(1),
  action: z.enum(["clear_unlocked", "lock_all", "unlock_all", "auto_assign_unfilled"]),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { shiftId, action } = schema.parse(body);

    if (action === "clear_unlocked") {
      const result = await prisma.assignment.deleteMany({ where: { shiftId, locked: false } });
      await logAdminAction({
        action,
        entityType: "Assignment",
        shiftId,
        details: `count:${result.count}`,
      });
      return NextResponse.json({ ok: true, action, count: result.count });
    }

    if (action === "lock_all") {
      const result = await prisma.assignment.updateMany({ where: { shiftId }, data: { locked: true } });
      await logAdminAction({
        action,
        entityType: "Assignment",
        shiftId,
        details: `count:${result.count}`,
      });
      return NextResponse.json({ ok: true, action, count: result.count });
    }

    if (action === "unlock_all") {
      const result = await prisma.assignment.updateMany({ where: { shiftId }, data: { locked: false } });
      await logAdminAction({
        action,
        entityType: "Assignment",
        shiftId,
        details: `count:${result.count}`,
      });
      return NextResponse.json({ ok: true, action, count: result.count });
    }

    if (action === "auto_assign_unfilled") {
      const assignments = await autoAssignShift(shiftId);
      await logAdminAction({
        action,
        entityType: "Assignment",
        shiftId,
        details: `count:${assignments.length}`,
      });
      return NextResponse.json({ ok: true, action, count: assignments.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Bulk action failed" }, { status: 400 });
  }
}
