# St. Clement Strawberry Festival Volunteer Scheduler

Production-ready MVP for volunteer signup and scheduling.

## Stack
- Next.js 16 App Router + TypeScript
- Tailwind CSS
- Prisma ORM + MariaDB
- dnd-kit for drag/drop scheduling

## Features Delivered
- Public landing page + FAQ
- Public volunteer multi-step signup wizard:
  - Profile + 18+ DOB validation
  - Availability by date/shift (Feb 26 - Mar 8, 2026)
  - Ranked role preferences (drag reorder)
  - Required acknowledgements + review
  - Contact verification via Email OTP before account is usable (SMS wiring kept for later rollout)
- Admin password login (cookie session)
- Admin dashboard:
  - Coverage cards
  - Day detail scheduling board
  - Drag/drop pool to role columns
  - Auto-assignment for selected shift
  - Force-assign with required reason support
  - Training/approval toggles for Supervisor
- Print center:
  - Daily roster (check-in format)
  - Emergency contact sheet

## Scheduling Rules Enforced
- No overlapping assignment windows on same date (using shift conflict windows)
- Explicit Booth Day + Booth Night same-date block
- Early Setup treated as HALL role
- 18+ required at signup
- Role capability checks (standing/heavy/cash/outdoor)
- Supervisor assignment requires training + approval
- Gender-restricted roles enforced (Berry Girl, Sticker Persons)
- Relief role configured as universal capability role except Supervisor
- Drivers set as manual-only
- Only VERIFIED volunteers are eligible for scheduling and auto-assignment

## Project Structure
```text
festivalapp/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      page.tsx
      signup/page.tsx
      admin/page.tsx
      admin/print/page.tsx
      api/public/signup/route.ts
      api/admin/*
    components/
      public/signup-wizard.tsx
      admin/admin-dashboard.tsx
      ui/theme-toggle.tsx
    lib/
      prisma.ts
      auth.ts
      festival.ts
      validators.ts
```

## Local Setup
1. Install dependencies
```bash
npm install
```

2. Copy env file
```bash
cp .env.example .env
```

3. Run migrations + seed
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

4. Start app
```bash
npm run dev
```

Open `http://localhost:3000`.

## MariaDB on VPS (example)
```sql
CREATE DATABASE festival_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'festival_user'@'%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON festival_app.* TO 'festival_user'@'%';
FLUSH PRIVILEGES;
```

Set `DATABASE_URL` in `.env`:
```env
DATABASE_URL="mysql://festival_user:strong_password@YOUR_VPS_IP:3306/festival_app"
```

If remote DB access is restricted, use SSH tunnel:
```bash
ssh -N -L 3308:127.0.0.1:3306 root@YOUR_VPS_IP
```
Then use:
```env
DATABASE_URL="mysql://festival_user:strong_password@127.0.0.1:3308/festival_app"
```

## Admin Login
- Set `ADMIN_PASSWORD` in `.env`
- Visit `/admin` and sign in

## Volunteer Verification (Email/SMS)
- New signups are stored as `PENDING`
- Volunteer must enter a 6-digit OTP to become `VERIFIED`
- Only `VERIFIED` volunteers appear in scheduling pool/auto-assign

### OTP Delivery
- Email OTP uses SMTP if configured
- SMS OTP uses Twilio if configured
- If not configured, codes are logged to server console (dev fallback)

Add to `.env`:
```env
OTP_PEPPER="random_secret"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"
SMTP_FROM="Festival App <no-reply@example.com>"

TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM_NUMBER="+1..."
```

## Auto-Assignment Logic
`autoAssignShift(shiftId)` in `src/lib/festival.ts`:
- Reads role targets for selected shift
- Candidate filtering:
  - availability for shift
  - no overlap / no booth day+night same date
  - gender + acknowledgements + training/approval constraints
- Scoring:
  - role preference rank
  - yearsExperience (seniority)
  - stable deterministic tie-break
- Fills constrained roles first, then remaining

## Printing
- Open `/admin/print`
- Select shift
- Browser print (`Cmd/Ctrl + P`)

## Deployment Notes
- Run `npm run build`
- Run Prisma deploy on server:
```bash
npm run prisma:deploy
npm run prisma:seed
```
- Start app with process manager (pm2/systemd)

### GitHub Actions Deploy Workflow
This repo includes `.github/workflows/deploy.yml` for automatic deploys on `main` push (or manual run).

Required repository secrets:
- `VPS_HOST` (example: `187.77.193.9`)
- `VPS_USER` (example: `root`)
- `VPS_PORT` (optional, defaults to `22`)
- `VPS_SSH_KEY` (private key matching a key in server `authorized_keys`)
- `VPS_APP_DIR` (absolute deploy path on VPS, example: `/var/www/festivalapp`)
- `VPS_PM2_APP_NAME` (optional, defaults to `festivalapp`)
