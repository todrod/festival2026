import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hallAttendanceSchema } from "@/lib/validators";

// Hall Organization Panel: a light-touch daily attendance log — who showed up,
// what they did, approximate hours. Groups welcome (groupSize > 1).
export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await prisma.hallAttendance.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const parsed = hallAttendanceSchema.parse(await req.json());
    const entry = await prisma.hallAttendance.create({
      data: {
        date: new Date(`${parsed.date}T12:00:00Z`),
        name: parsed.name.trim(),
        groupSize: parsed.groupSize,
        activity: parsed.activity.trim(),
        hours: parsed.hours,
        notes: parsed.notes?.trim() || null,
        author: session.name,
      },
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save attendance entry" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.hallAttendance.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
