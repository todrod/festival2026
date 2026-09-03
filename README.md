# St. Clement "Make Your Own" Strawberry Shortcake Project — Volunteer System (2027)

Volunteer sign-up, scheduling, communications, and analytics for the parish
shortcake booth (March 4–14, 2027, plus pack-up on the morning of March 15).

## Stack
- Next.js 16 App Router + TypeScript
- Tailwind CSS (warm red/yellow/green festival theme, Tipper & Topper mascots)
- Prisma ORM + Postgres (Vercel Postgres in production; `prisma db push` on deploy)
- Twilio SMS (Messaging Service) + SMTP email (Mailpit locally, Resend in prod)
- dnd-kit for drag/drop scheduling

## What's here (2027 redesign)
- **Public sign-up** (5 plain-English steps, EN/ES): personal details incl.
  address + language (English/Spanish/Both), first-time flag with orientation
  RSVP (Jan 31, 2027, Cronin Hall, 5–7 PM), availability grid (Setup/Day/Night
  per date + March 15 pack-up), ranked position choices (1st/2nd/3rd) with
  inline requirement confirmation, emergency call-list opt-in with dates,
  physical declaration (standing, lifting 0/25/50 lbs).
- **Volunteer IDs**: `SC2027000001` format, generated at submission, primary
  display identifier everywhere; personal info is behind a click.
- **Silent sign-up flags** (never block, never shown to the volunteer): gender
  mismatch, under 16, 16–18 without parent consent, lifting/standing mismatch.
- **Position catalog**: booth positions with verbatim descriptions, physical
  demands, min age 16, lift limits, gender restrictions; hall positions are
  informational-only with call-to-sign-up contact pop-ups (Ted, Tim, Cathy,
  Ana, Trish).
- **Scheduler**: day/shift picker, position grid (needed/filled/unfilled),
  autofill (legacy score DESC, then sign-up time ASC; hard rules block, soft
  flags warn inline), drag-drop with hard-rule blocking + force override,
  persistent RULE/⚠ badges on slots, shift notes.
- **Supervisor**: full schedule across all dates, final-publish per shift
  (locks assignments + routes into Communication pre-filled), unpublish,
  shift notes visibility.
- **Volunteer database**: flags, legacy score, categorized admin notes
  (EXCELLENT … DO_NOT_SCHEDULE; DO_NOT_SCHEDULE excludes from autofill),
  private supervisor notes visible only to their author.
- **Hall Organization Panel**: daily attendance log (person or group + size +
  activity + hours) with headcount summaries.
- **Communication tab**: Schedule Notification / Reminder / Announcement to
  all volunteers, a date, a shift, or one Volunteer ID; SMS + email preview
  side by side; schedule emails highlight the recipient's own line (plain-text
  fallback uses `>>>`); every deploy is logged with counts and errors.
- **Analytics (admin only)**: shifts/hours per volunteer, callouts, no-shows,
  filled-vs-needed by day, legacy distribution, flag frequency, hall totals,
  top contributors, never-scheduled — all with CSV export.
- Existing Twilio reminder flow (YES/NO confirmations), check-in mode, print
  center, and Vercel cron reminders carried forward unchanged.

## Auth (additive roles)
Password decides the role at `/admin` login (name is free text, used for note
authorship and audit):
- `ADMIN_PASSWORD` → Admin (everything, incl. Analytics + demo data)
- `SUPERVISOR_PASSWORD` (optional) → Supervisor (publish, comms deploy, notes)
- `SCHEDULER_PASSWORD` (optional) → Scheduler (scheduling; drafts comms, can't
  deploy; locked out of published shifts)

## Env
```
POSTGRES_PRISMA_URL=...
POSTGRES_URL_NON_POOLING=...
ADMIN_PASSWORD=...
SUPERVISOR_PASSWORD=...        # optional
SCHEDULER_PASSWORD=...         # optional
ADMIN_SESSION_SECRET=...
TWILIO_ACCOUNT_SID=...         # see SMS_SETUP.md
TWILIO_API_KEY_SID=...
TWILIO_API_KEY_SECRET=...
TWILIO_MESSAGING_SERVICE_SID=...
SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=... SMTP_FROM=...  # see EMAIL_SETUP.md
CRON_SECRET=...
```

## Local dev
```
npm install
npx prisma db push && npm run prisma:seed
npm run dev
```
Admin → Scheduler tab → "Add Test Workers" seeds 79 demo volunteers.

## Deploy notes (2027 schema)
`vercel-build` runs `prisma db push --accept-data-loss` + seed. The 2027 schema
**removes** the NON_BINARY / PREFER_NOT_TO_SAY gender values and the HALL_*
shift types — a production database still holding 2026 rows with those values
needs to be cleared (or those rows migrated) before the first 2027 deploy.
The seed automatically rebuilds the 2027 calendar and position catalog and
removes stale positions/shifts.

## Brand assets
`public/brand/` holds SVG recreations of the parish logo and the Tipper and
Topper berry-people mascots. To use the original artwork instead, replace
`logo.svg`, `tipper.svg`, and `topper.svg` with the source files (same names).
