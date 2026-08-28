# SMS confirmations (Twilio)

Volunteers who check **"Text OK"** on the signup form get a short confirmation
text after they sign up. Delivery uses Twilio.

If Twilio isn't configured, the app **logs** the text instead of sending it, so
signups never break — exactly like the email path (`EMAIL_SETUP.md`).

Sending is best-effort and gated two ways:

- only if the volunteer checked **Text OK** (`textOk`), and
- only if their phone normalizes to a valid E.164 number (`toE164` in `src/lib/sms.ts`).

## What's already set up (Twilio console)

- **Number:** `+1 727 220 2167` (St. Petersburg / Tampa Bay), in the main Twilio
  account (its Account SID `AC…` is shown on the console home page).
- **Messaging Service:** created and the number assigned to it.
- These live in the main account, isolated from the other project by using their
  own dedicated number + Messaging Service.

## Remaining Twilio steps (must be done in the console by an account owner)

US app-to-person SMS requires **A2P 10DLC registration** before texts deliver:

1. **A2P Brand registration** — your org/identity (Nonprofit path if you're a
   registered 501(c)(3); otherwise Sole Proprietor).
2. **A2P Campaign registration** — use case + sample messages (small fees).

Until the campaign is **approved**, texts are filtered/blocked by carriers even
though the code and number are ready. Approval usually takes a day or a few.

## Environment variables

Set these in **Vercel → Settings → Environment Variables** (and `.env.local` for
local testing). Unset = log-only (no text sent).

| Var | Purpose |
|-----|---------|
| `TWILIO_ACCOUNT_SID` | `AC…` — shown on the Twilio console home page (not secret). |
| `TWILIO_API_KEY_SID` | `SK...` — create at **Account → API keys & tokens → Create API key**. |
| `TWILIO_API_KEY_SECRET` | The API key secret. **Shown only once** at creation — copy it straight into the env. |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG...` — preferred sender; carries the 10DLC campaign. Find it under **Messaging → Services**. |
| `TWILIO_FROM_NUMBER` | `+1727...` — fallback sender if you don't set a messaging service. |
| `CRON_SECRET` | Any long random string. Protects the daily reminder cron; Vercel sends it as a Bearer token. |
| `SMS_WEBHOOK_SECRET` | Any random string. Require `?key=<this>` on the Twilio inbound webhook URL so only Twilio can post to it. |

We use an **API key** (SID + secret) rather than the account Auth Token so the
master token is never embedded in the app. Prefer the **Messaging Service SID**
over the from-number — that's what the 10DLC campaign is attached to.

## Shift reminders + confirm/cancel

The app can text assigned volunteers a **day-before reminder** and let them reply
**YES** (confirm) or **NO** (cancel):

- **Manual:** Admin → **Day Detail + Board** tab → **Send Shift Reminders** panel.
  Pick a date (defaults to tomorrow), see how many will be texted, and Send.
- **Automatic:** a daily Vercel Cron (`vercel.json` → `/api/cron/send-reminders`,
  13:00 UTC ≈ 9am ET) texts *tomorrow's* assigned volunteers. Re-sends are
  de-duped, so the cron and a manual send won't double-text.
- **Replies:** a volunteer's YES/NO updates their assignment to **Confirmed** or
  **Cancelled**, shown as a ✓/✕ on the board and a "Confirmed via text" badge in
  the supervisor check-in board. Cancellations are flagged so you can backfill.

### One-time Twilio setup for replies (inbound webhook)

Point the number's inbound handler at the deployed app so replies are processed:

1. Twilio console → **Phone Numbers → Manage → Active numbers → +1 727 220 2167**
   → **Messaging** → "A message comes in" → **Webhook (HTTP POST)**:
   `https://festival2026-ten.vercel.app/api/sms/inbound?key=<SMS_WEBHOOK_SECRET>`
   (If the number is in a Messaging Service, set the same URL under the Messaging
   Service's **Integration** → "Send a webhook" instead.)
2. Set `SMS_WEBHOOK_SECRET` and `CRON_SECRET` in Vercel env.

## Testing before 10DLC is approved

While the campaign is pending you can still verify the wiring: with the env vars
set, Twilio trial/verified numbers can receive messages, and the Twilio console's
**Monitor → Logs → Messaging** shows each attempt (including carrier filtering).
Without the env vars, sign up a volunteer with "Text OK" checked and the server
logs will show `[sms] Twilio not configured — would have texted ...`.
