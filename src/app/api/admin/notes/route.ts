import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const notesSchema = z.object({
  volunteerId: z.string().min(1),
  notes: z.string().max(2000),
});

// Admin-only: save a coordinator note on a volunteer. Never exposed publicly.
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { volunteerId, notes } = notesSchema.parse(await req.json());
    const trimmed = notes.trim();
    await prisma.volunteer.update({
      where: { id: volunteerId },
      data: { adminNotes: trimmed.length > 0 ? trimmed : null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 400 });
  }
}
