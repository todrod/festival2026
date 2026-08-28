import { NextResponse } from "next/server";
import { sendRemindersForDate, tomorrowKey } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Daily Vercel Cron (see vercel.json) — texts tomorrow's assigned, opted-in
// volunteers. Secured with CRON_SECRET: Vercel sends it as a Bearer token when
// the env var is set. If CRON_SECRET is unset we allow the call (dev only).
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const date = tomorrowKey();
  const summary = await sendRemindersForDate(date);
  console.info("[cron] reminders", JSON.stringify(summary));
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
