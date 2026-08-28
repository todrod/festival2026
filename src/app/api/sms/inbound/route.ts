import { applyInboundReply } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function twiml(message: string | null) {
  const body = message
    ? `<Response><Message>${escapeXml(message)}</Message></Response>`
    : `<Response></Response>`;
  return new Response(body, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

// Twilio inbound-message webhook (set as the Messaging Service / number's
// "A message comes in" URL). Handles YES/NO confirmation replies.
//
// Security: if SMS_WEBHOOK_SECRET is set, the webhook URL must include
// ?key=<secret> (configure it that way in the Twilio console). Twilio's own
// STOP/START/HELP keywords are handled by Twilio before reaching us.
export async function POST(req: Request) {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (secret) {
    const key = new URL(req.url).searchParams.get("key");
    if (key !== secret) return new Response("Forbidden", { status: 403 });
  }

  let from = "";
  let body = "";
  try {
    const form = await req.formData();
    from = String(form.get("From") ?? "");
    body = String(form.get("Body") ?? "");
  } catch {
    return twiml(null);
  }
  if (!from) return twiml(null);

  try {
    const result = await applyInboundReply(from, body);
    return twiml(result.reply);
  } catch (err) {
    console.error("inbound sms handling failed", err);
    return twiml(null);
  }
}
