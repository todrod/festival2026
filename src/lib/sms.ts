import { FESTIVAL_NAME } from "@/lib/festival";

// SMS sending via Twilio. Mirrors src/lib/email.ts: if Twilio isn't configured
// we log instead of sending, so signups never break in local dev or before the
// A2P 10DLC campaign is approved in production.
//
// Env (set in Vercel + .env.local — see SMS_SETUP.md):
//   TWILIO_ACCOUNT_SID          AC... (the account the number lives in)
//   TWILIO_API_KEY_SID          SK... (API key, preferred over the auth token)
//   TWILIO_API_KEY_SECRET       the API key secret (shown once at creation)
//   TWILIO_MESSAGING_SERVICE_SID MG... (preferred sender — carries the 10DLC campaign)
//   TWILIO_FROM_NUMBER          +1727...  (fallback sender if no messaging service)
// If neither a messaging service SID nor a from-number is set, we log and skip.

type SendSmsArgs = { to: string; body: string };

// Normalize a US/CA phone to E.164 (+1XXXXXXXXXX). Returns null if it doesn't
// look like a dialable 10-digit (or 1 + 10) number.
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Already E.164-ish: keep the leading + and digits.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM_NUMBER;
  // Need account SID + API key credentials, and at least one sender.
  if (!accountSid || !apiKeySid || !apiKeySecret) return null;
  if (!messagingServiceSid && !from) return null;
  return { accountSid, apiKeySid, apiKeySecret, messagingServiceSid, from };
}

export async function sendSms({ to, body }: SendSmsArgs): Promise<{ sent: boolean; sid?: string }> {
  const cfg = getTwilioConfig();
  if (!cfg) {
    console.info(`[sms] Twilio not configured — would have texted ${to}: ${body}`);
    return { sent: false };
  }
  // Lazy import so the SDK is only loaded when we actually send.
  const twilio = (await import("twilio")).default;
  // API key auth: client(apiKeySid, apiKeySecret, { accountSid }).
  const client = twilio(cfg.apiKeySid, cfg.apiKeySecret, { accountSid: cfg.accountSid });
  const message = await client.messages.create({
    to,
    body,
    ...(cfg.messagingServiceSid
      ? { messagingServiceSid: cfg.messagingServiceSid }
      : { from: cfg.from }),
  });
  return { sent: true, sid: message.sid };
}

// Short signup-confirmation text. Kept concise and carries the STOP opt-out that
// carriers require. Recipients only get this if they checked "Text OK".
export function buildVolunteerSmsConfirmation(input: { firstName: string }) {
  return (
    `${FESTIVAL_NAME}: Hi ${input.firstName}, you're signed up to volunteer! ` +
    `A coordinator will confirm your shifts closer to the festival. Reply STOP to opt out.`
  );
}
