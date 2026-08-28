import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { previewRemindersForDate, sendRemindersForDate, tomorrowKey } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET ?date=yyyy-MM-dd → how many volunteers would be texted (no send).
export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || tomorrowKey();
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const preview = await previewRemindersForDate(date);
  return NextResponse.json({ date, ...preview });
}

// POST { date } → actually send the reminders for that date.
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
  if (!date) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const summary = await sendRemindersForDate(date);
  return NextResponse.json(summary);
}
