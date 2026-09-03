import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shiftNoteSchema } from "@/lib/validators";
import { logAdminAction } from "@/lib/audit";

// Scheduler shift notes — visible to supervisors and admins.
export async function POST(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = shiftNoteSchema.parse(await req.json());
    const note = await prisma.shiftNote.create({
      data: { shiftId: parsed.shiftId, text: parsed.text.trim(), author: session.name },
    });
    await logAdminAction({
      actor: session.name,
      action: "shift_note_create",
      entityType: "ShiftNote",
      entityId: note.id,
      shiftId: parsed.shiftId,
    });
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save shift note" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const note = await prisma.shiftNote.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.author !== session.name && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the author or an admin can delete this note" }, { status: 403 });
  }
  await prisma.shiftNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
