import nodemailer from "nodemailer";
import { format } from "date-fns";
import { FESTIVAL_END, FESTIVAL_NAME, FESTIVAL_START } from "@/lib/festival";
import { seniorityTier } from "@/lib/seniority";

type SendArgs = { to: string; subject: string; html: string; text: string };

// One SMTP path for both worlds:
//   • Local dev  → Mailpit (SMTP_HOST=localhost, SMTP_PORT=1025, no auth), inbox at http://localhost:8025
//   • Production → Resend (SMTP_HOST=smtp.resend.com, SMTP_PORT=465, SMTP_USER=resend, SMTP_PASS=<api key>)
// If SMTP is not configured at all, we log instead of sending so signups never break.
function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<{ sent: boolean }> {
  const from = process.env.SMTP_FROM || "St. Clement Strawberry Festival <onboarding@resend.dev>";
  const transport = getTransport();
  if (!transport) {
    console.info(`[email] SMTP not configured — would have sent "${subject}" to ${to}`);
    return { sent: false };
  }
  await transport.sendMail({ from, to, subject, html, text });
  return { sent: true };
}

type ShiftLite = { date: Date; label: string };

// Build the signup confirmation email (subject + plain text + HTML).
export function buildVolunteerConfirmation(input: {
  firstName: string;
  yearsExperience: number;
  shifts: ShiftLite[];
  confirmationId: string;
}) {
  const tier = seniorityTier(input.yearsExperience);
  const window = `${format(FESTIVAL_START, "MMMM d")} – ${format(FESTIVAL_END, "MMMM d, yyyy")}`;
  const shiftLines =
    input.shifts.length > 0
      ? input.shifts.map((s) => `${format(s.date, "EEE, MMM d")} — ${s.label}`)
      : ["You haven't marked any shifts yet — reply to let us know your availability."];

  const subject = `You're signed up — ${FESTIVAL_NAME}`;

  const text = [
    `Hi ${input.firstName},`,
    ``,
    `Thanks for volunteering for the ${FESTIVAL_NAME} (${window})!`,
    ``,
    `Your volunteer status: ${tier.emoji} ${tier.label} (${input.yearsExperience} year${input.yearsExperience === 1 ? "" : "s"} of service).`,
    ``,
    `You told us you're available for:`,
    ...shiftLines.map((l) => `  • ${l}`),
    ``,
    `A coordinator will review everyone's availability and confirm your specific role assignments closer to the festival. No action needed for now.`,
    ``,
    `Confirmation ID: ${input.confirmationId}`,
    ``,
    `See you at the festival!`,
    `— St. Clement Strawberry Festival`,
  ].join("\n");

  const rows = shiftLines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f0e2dc;color:#3a2a2e;font-size:15px;">${l}</td></tr>`,
    )
    .join("");

  const html = `
  <div style="margin:0;background:#fbf5f1;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #f0e2dc;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#c4223f;padding:22px 28px;">
          <div style="color:#ffffff;font-size:20px;font-weight:700;">🍓 St. Clement Strawberry Festival</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:16px;color:#2a1e22;">Hi ${input.firstName},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4a3a3e;">
            Thanks for volunteering for the <strong>${FESTIVAL_NAME}</strong> (${window})! You're all signed up.
          </p>
          <p style="margin:0 0 6px;font-size:13px;color:#8a7a7e;text-transform:uppercase;letter-spacing:.05em;">Your volunteer status</p>
          <p style="margin:0 0 20px;">
            <span style="display:inline-block;background:#fde7e5;color:#7a1329;font-weight:700;font-size:14px;padding:6px 12px;border-radius:999px;">
              ${tier.emoji} ${tier.label}
            </span>
            <span style="color:#8a7a7e;font-size:13px;">&nbsp;· ${input.yearsExperience} year${input.yearsExperience === 1 ? "" : "s"} of service</span>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#8a7a7e;text-transform:uppercase;letter-spacing:.05em;">You're available for</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${rows}</table>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4a3a3e;">
            A coordinator will review everyone's availability and confirm your specific role assignments closer to the festival. No action needed for now.
          </p>
          <p style="margin:0;font-size:12px;color:#a89a9d;">Confirmation ID: ${input.confirmationId}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#a89a9d;">St. Clement Strawberry Festival · ${window}</p>
    </td></tr></table>
  </div>`;

  return { subject, html, text };
}
