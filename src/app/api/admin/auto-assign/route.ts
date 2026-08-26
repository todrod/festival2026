import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { autoAssignShift } from "@/lib/festival";
import { logAdminAction } from "@/lib/audit";
import { autoAssignSchema } from "@/lib/validators";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { shiftId } = autoAssignSchema.parse(body);
    const assignments = await autoAssignShift(shiftId);
    await logAdminAction({
      action: "auto_assign",
      entityType: "Assignment",
      shiftId,
      details: `count:${assignments.length}`,
    });
    return NextResponse.json({ ok: true, assignments });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Auto-assignment failed" }, { status: 400 });
  }
}
