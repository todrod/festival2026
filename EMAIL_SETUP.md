# Email confirmations

Volunteers get a confirmation email after they sign up. Delivery uses plain
SMTP, so the **same code works locally (Mailpit) and in production (Resend)** —
you just point the env vars at a different SMTP server.

If no `SMTP_HOST` is set, the app **logs** the email instead of sending it, so
signups never break when email isn't configured.

## Environment variables

| Var | Purpose |
|-----|---------|
| `SMTP_HOST` | SMTP server host. Unset = log-only (no email sent). |
| `SMTP_PORT` | `1025` for Mailpit, `465` for Resend. |
| `SMTP_USER` | SMTP username (Resend: `resend`). Omit for Mailpit. |
| `SMTP_PASS` | SMTP password (Resend: your API key). Omit for Mailpit. |
| `SMTP_FROM` | From address, e.g. `St. Clement Strawberry Festival <noreply@yourdomain.com>`. |

## Local testing with Mailpit (free)

Mailpit is a local inbox that **catches** outgoing email so you can view it —
nothing is actually delivered. Run it with Docker:

```bash
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

(or download the single binary from https://mailpit.axllent.org)

Add to your local `.env`:

```env
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_FROM="St. Clement Strawberry Festival <festival@localhost>"
```

Run the app, sign up a volunteer, and open the inbox at **http://localhost:8025**
to see the confirmation email exactly as it will look.

## Production with Resend (free tier: 3,000/mo)

1. Create an account at https://resend.com and add an **API key**.
2. To send from your own domain, verify it in Resend (a couple of DNS records).
   Until then you can only send from `onboarding@resend.dev` to your own address.
3. In the Vercel project (Settings → Environment Variables) add:

```env
SMTP_HOST="smtp.resend.com"
SMTP_PORT="465"
SMTP_USER="resend"
SMTP_PASS="re_your_api_key"
SMTP_FROM="St. Clement Strawberry Festival <noreply@yourdomain.com>"
```

Redeploy and confirmation emails will start sending for real.
