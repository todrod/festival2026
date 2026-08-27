import { z } from "zod";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  assignmentId: z.string().min(1),
  action: z.enum(["check_in", "undo_check_in", "mark_absent", "clear_absence"]),
  reason: z.enum(["NO_SHOW", "SICK", "EXCUSED", "OTHER"]).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const current = await prisma.assignment.findUnique({ where: { id: parsed.assignmentId } });
    if (!current) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    const data =
      parsed.action === "check_in"
        ? { checkedInAt: new Date(), noShow: false, absenceReason: null, absenceNote: null }
        : parsed.action === "undo_check_in"
          ? { checkedInAt: null }
          : parsed.action === "mark_absent"
            ? {
                noShow: true,
                checkedInAt: null,
                absenceReason: parsed.reason ?? "NO_SHOW",
                absenceNote: parsed.note?.trim() ? parsed.note.trim() : null,
              }
            : { noShow: false, absenceReason: null, absenceNote: null };

    const updated = await prisma.assignment.update({ where: { id: parsed.assignmentId }, data });

    await logAdminAction({
      action: parsed.action,
      entityType: "Assignment",
      entityId: parsed.assignmentId,
      shiftId: current.shiftId,
    });

    return NextResponse.json({ ok: true, assignment: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Check-in update failed" }, { status: 400 });
  }
}
