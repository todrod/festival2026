import { format } from "date-fns";
import type { Assignment, Role, Shift, Volunteer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FESTIVAL_NAME } from "@/lib/festival";
import { sendSms, toE164 } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

export type Audience =
  | { type: "all" }
  | { type: "date"; date: string }
  | { type: "shift"; shiftId: string }
  | { type: "volunteer"; volunteerCode: string };

type AssignmentFull = Assignment & { volunteer: Volunteer; role: Role; shift: Shift };

function dayRange(dateKey: string) {
  return { gte: new Date(`${dateKey}T00:00:00.000Z`), lte: new Date(`${dateKey}T23:59:59.999Z`) };
}

// Recipients + (for schedule messages) the assignments that put them there.
export async function resolveRecipients(audience: Audience): Promise<{
  volunteers: Volunteer[];
  assignments: AssignmentFull[];
  label: string;
}> {
  if (audience.type === "all") {
    const volunteers = await prisma.volunteer.findMany({ where: { status: "VERIFIED" } });
    return { volunteers, assignments: [], label: "All volunteers" };
  }
  if (audience.type === "volunteer") {
    const volunteer = await prisma.volunteer.findFirst({
      where: { volunteerCode: audience.volunteerCode.trim().toUpperCase() },
    });
    const assignments = volunteer
      ? await prisma.assignment.findMany({
          where: { volunteerId: volunteer.id },
          include: { volunteer: true, role: true, shift: true },
        })
      : [];
    return {
      volunteers: volunteer ? [volunteer] : [],
      assignments,
      label: `Volunteer ${audience.volunteerCode}`,
    };
  }
  if (audience.type === "date") {
    const assignments = await prisma.assignment.findMany({
      where: { shift: { date: dayRange(audience.date) }, volunteer: { status: "VERIFIED" } },
      include: { volunteer: true, role: true, shift: true },
    });
    const volunteers = [...new Map(assignments.map((a) => [a.volunteerId, a.volunteer])).values()];
    return { volunteers, assignments, label: `Scheduled ${audience.date}` };
  }
  const assignments = await prisma.assignment.findMany({
    where: { shiftId: audience.shiftId, volunteer: { status: "VERIFIED" } },
    include: { volunteer: true, role: true, shift: true },
  });
  const volunteers = [...new Map(assignments.map((a) => [a.volunteerId, a.volunteer])).values()];
  const shift = assignments[0]?.shift;
  return {
    volunteers,
    assignments,
    label: shift ? `${format(shift.date, "EEE MMM d")} — ${shift.label}` : "Shift",
  };
}

// Full schedule block for the shifts a recipient is part of, with the
// recipient's own line highlighted: '>>>' in plain text, bold + color in HTML.
export function buildScheduleBlock(assignments: AssignmentFull[], recipientId: string) {
  const byShift = new Map<string, AssignmentFull[]>();
  for (const a of assignments) {
    const list = byShift.get(a.shiftId) ?? [];
    list.push(a);
    byShift.set(a.shiftId, list);
  }

  const textParts: string[] = [];
  const htmlParts: string[] = [];
  for (const list of byShift.values()) {
    const shift = list[0].shift;
    const header = `${format(shift.date, "EEEE, MMM d")} — ${shift.label}`;
    textParts.push(header);
    htmlParts.push(`<p style="margin:14px 0 4px;font-weight:700;color:#2a1e22;">${header}</p>`);
    const sorted = [...list].sort((a, b) => a.role.name.localeCompare(b.role.name));
    for (const a of sorted) {
      const line = `${a.role.name}: ${a.volunteer.firstName} ${a.volunteer.lastName} (${a.volunteer.volunteerCode ?? ""})`;
      const mine = a.volunteerId === recipientId;
      textParts.push(mine ? `>>> ${line}` : `    ${line}`);
      htmlParts.push(
        mine
          ? `<p style="margin:2px 0;padding:4px 8px;background:#fde7e5;border-radius:6px;color:#b3122f;font-weight:700;">★ ${line}</p>`
          : `<p style="margin:2px 0;padding:0 8px;color:#4a3a3e;">${line}</p>`,
      );
    }
  }
  return { text: textParts.join("\n"), html: htmlParts.join("") };
}

export type SendResult = {
  recipients: number;
  smsSent: number;
  emailSent: number;
  errors: string[];
};

export async function deployMessage(input: {
  kind: "SCHEDULE" | "REMINDER" | "ANNOUNCEMENT";
  channel: "sms" | "email" | "both";
  audience: Audience;
  subject?: string;
  body: string;
  includeSchedule: boolean;
  sentBy: string;
}): Promise<SendResult & { audienceLabel: string }> {
  const { volunteers, assignments, label } = await resolveRecipients(input.audience);
  const result: SendResult = { recipients: volunteers.length, smsSent: 0, emailSent: 0, errors: [] };

  for (const volunteer of volunteers) {
    const personalBody = input.body.replaceAll("{name}", volunteer.firstName);
    const schedule = input.includeSchedule ? buildScheduleBlock(assignments, volunteer.id) : null;

    if ((input.channel === "sms" || input.channel === "both") && volunteer.textOk) {
      const to = toE164(volunteer.phone);
      if (to) {
        try {
          const smsBody = `${FESTIVAL_NAME}: ${personalBody} Reply STOP to opt out.`;
          await sendSms({ to, body: smsBody });
          result.smsSent += 1;
        } catch (err) {
          result.errors.push(`SMS to ${volunteer.volunteerCode ?? volunteer.id}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    }

    if ((input.channel === "email" || input.channel === "both") && volunteer.emailOk) {
      try {
        const subject = input.subject?.trim() || `${FESTIVAL_NAME} — Volunteer Update`;
        const text = schedule ? `${personalBody}\n\nYour schedule (your line is marked >>>):\n${schedule.text}` : personalBody;
        const html = `
          <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
            <div style="background:#c4223f;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-weight:700;font-size:18px;">🍓 ${FESTIVAL_NAME}</div>
            <div style="border:1px solid #f0e2dc;border-top:none;border-radius:0 0 12px 12px;padding:22px;">
              <p style="font-size:15px;line-height:1.6;color:#2a1e22;white-space:pre-wrap;">${personalBody}</p>
              ${schedule ? `<div style="margin-top:12px;border-top:1px solid #f0e2dc;padding-top:8px;">${schedule.html}</div>` : ""}
            </div>
          </div>`;
        await sendEmail({ to: volunteer.email, subject, html, text });
        result.emailSent += 1;
      } catch (err) {
        result.errors.push(`Email to ${volunteer.volunteerCode ?? volunteer.id}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
  }

  await prisma.messageLog.create({
    data: {
      kind: input.kind,
      channel: input.channel,
      audience: label,
      recipientCount: result.recipients,
      errorCount: result.errors.length,
      errors: result.errors.length > 0 ? result.errors.join("\n") : null,
      subject: input.subject ?? null,
      body: input.body,
      sentBy: input.sentBy,
    },
  });

  return { ...result, audienceLabel: label };
}
