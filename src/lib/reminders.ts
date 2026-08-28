import { addDays, format } from "date-fns";
import { ConfirmationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FESTIVAL_NAME } from "@/lib/festival";
import { sendSms, toE164 } from "@/lib/sms";

// How long a reminder "counts" for dedupe (don't re-text the same volunteer for
// the same shift within this window) and for routing an inbound reply.
const DEDUPE_HOURS = 20;
const REPLY_WINDOW_HOURS = 48;

const CONFIRM_WORDS = new Set(["YES", "Y", "C", "CONFIRM", "CONFIRMED", "OK", "OKAY", "YEP", "YUP"]);
const CANCEL_WORDS = new Set(["NO", "N", "X", "CANCEL", "CANCELLED", "CANCELED", "CANT", "CAN'T", "NOPE"]);

// A calendar-day window [00:00, 23:59:59.999] in UTC for a yyyy-MM-dd key. Shift
// dates are anchored to UTC noon, so this range always contains them.
function dayRange(dateKey: string) {
  return {
    gte: new Date(`${dateKey}T00:00:00.000Z`),
    lte: new Date(`${dateKey}T23:59:59.999Z`),
  };
}

export function tomorrowKey(now: Date = new Date()) {
  return format(addDays(now, 1), "yyyy-MM-dd");
}

export function buildReminderBody(input: {
  firstName: string;
  roleName: string;
  shiftDate: Date;
  startAt: Date;
}) {
  const day = format(input.shiftDate, "EEE MMM d");
  const time = format(input.startAt, "h:mm a");
  return (
    `${FESTIVAL_NAME}: Hi ${input.firstName}, reminder — you're scheduled for ` +
    `${input.roleName} on ${day} at ${time}. Reply YES to confirm or NO to cancel. ` +
    `Reply STOP to opt out.`
  );
}

type PreviewCounts = { eligible: number; alreadyReminded: number; noOptIn: number; badPhone: number };

// Who would be texted for a given date, without sending anything.
export async function previewRemindersForDate(dateKey: string): Promise<PreviewCounts> {
  const range = dayRange(dateKey);
  const assignments = await prisma.assignment.findMany({
    where: { shift: { date: range }, volunteer: { status: "VERIFIED" } },
    include: { volunteer: true },
  });
  const since = new Date(Date.now() - DEDUPE_HOURS * 3600 * 1000);
  const recent = await prisma.reminderLog.findMany({
    where: { shift: { date: range }, createdAt: { gte: since } },
    select: { volunteerId: true, shiftId: true },
  });
  const recentKeys = new Set(recent.map((r) => `${r.volunteerId}:${r.shiftId}`));

  let eligible = 0;
  let alreadyReminded = 0;
  let noOptIn = 0;
  let badPhone = 0;
  for (const a of assignments) {
    if (!a.volunteer.textOk) { noOptIn += 1; continue; }
    if (!toE164(a.volunteer.phone)) { badPhone += 1; continue; }
    if (recentKeys.has(`${a.volunteerId}:${a.shiftId}`)) { alreadyReminded += 1; continue; }
    eligible += 1;
  }
  return { eligible, alreadyReminded, noOptIn, badPhone };
}

type SendSummary = {
  date: string;
  sent: number;
  skippedAlready: number;
  skippedNoOptIn: number;
  skippedBadPhone: number;
  failed: number;
};

// Text every assigned, opted-in volunteer for the shifts on `dateKey`, once.
export async function sendRemindersForDate(dateKey: string): Promise<SendSummary> {
  const range = dayRange(dateKey);
  const assignments = await prisma.assignment.findMany({
    where: { shift: { date: range }, volunteer: { status: "VERIFIED" } },
    include: { volunteer: true, role: true, shift: true },
  });

  const since = new Date(Date.now() - DEDUPE_HOURS * 3600 * 1000);
  const recent = await prisma.reminderLog.findMany({
    where: { shift: { date: range }, createdAt: { gte: since } },
    select: { volunteerId: true, shiftId: true },
  });
  const recentKeys = new Set(recent.map((r) => `${r.volunteerId}:${r.shiftId}`));

  const summary: SendSummary = {
    date: dateKey,
    sent: 0,
    skippedAlready: 0,
    skippedNoOptIn: 0,
    skippedBadPhone: 0,
    failed: 0,
  };

  for (const a of assignments) {
    if (!a.volunteer.textOk) { summary.skippedNoOptIn += 1; continue; }
    const to = toE164(a.volunteer.phone);
    if (!to) { summary.skippedBadPhone += 1; continue; }
    const key = `${a.volunteerId}:${a.shiftId}`;
    if (recentKeys.has(key)) { summary.skippedAlready += 1; continue; }

    try {
      const body = buildReminderBody({
        firstName: a.volunteer.firstName,
        roleName: a.role.name,
        shiftDate: a.shift.date,
        startAt: a.shift.startAt,
      });
      const res = await sendSms({ to, body });
      await prisma.reminderLog.create({
        data: { volunteerId: a.volunteerId, shiftId: a.shiftId, providerSid: res.sid ?? null },
      });
      recentKeys.add(key); // guard against duplicate assignments in the same run
      summary.sent += 1;
    } catch (err) {
      console.error("reminder send failed", a.volunteerId, err);
      summary.failed += 1;
    }
  }

  return summary;
}

type ReplyResult = { matched: boolean; action?: "confirmed" | "cancelled"; reply: string | null };

// Handle an inbound YES/NO reply: match the phone to a volunteer, find the shift
// they were most recently reminded about, and set that assignment's status.
export async function applyInboundReply(fromPhone: string, rawBody: string): Promise<ReplyResult> {
  const first = rawBody.trim().toUpperCase().split(/\s+/)[0] ?? "";
  const confirm = CONFIRM_WORDS.has(first);
  const cancel = CANCEL_WORDS.has(first);
  if (!confirm && !cancel) return { matched: false, reply: null };

  const e164 = toE164(fromPhone);
  if (!e164) return { matched: false, reply: null };

  // Match by normalized phone (handles formatting differences in stored numbers).
  const last10 = e164.replace(/\D/g, "").slice(-10);
  const candidates = await prisma.volunteer.findMany({
    where: { phone: { contains: last10.slice(-7) } },
  });
  const volunteer = candidates.find((v) => toE164(v.phone) === e164);
  if (!volunteer) return { matched: false, reply: null };

  const since = new Date(Date.now() - REPLY_WINDOW_HOURS * 3600 * 1000);
  const log = await prisma.reminderLog.findFirst({
    where: { volunteerId: volunteer.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return { matched: false, reply: null };

  const status = confirm ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.CANCELLED;
  await prisma.assignment.updateMany({
    where: { volunteerId: volunteer.id, shiftId: log.shiftId },
    data: { confirmationStatus: status, confirmationAt: new Date() },
  });

  const reply = confirm
    ? `Thanks ${volunteer.firstName}! You're confirmed — see you there. 🍓`
    : `Thanks ${volunteer.firstName}, we've noted you can't make it. A coordinator will follow up.`;
  return { matched: true, action: confirm ? "confirmed" : "cancelled", reply };
}
