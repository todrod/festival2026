import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "festival_admin";

// Additive staff roles. Each level can do everything below it:
//   SCHEDULER < SUPERVISOR < ADMIN
// (Volunteers use the public sign-up only and never log in here.)
export type StaffRole = "SCHEDULER" | "SUPERVISOR" | "ADMIN";
const ROLE_ORDER: Record<StaffRole, number> = { SCHEDULER: 1, SUPERVISOR: 2, ADMIN: 3 };

export type StaffSession = { name: string; role: StaffRole };

function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function createAdminSession(session: StaffSession) {
  const payload = Buffer.from(JSON.stringify({ ...session, t: crypto.randomBytes(12).toString("hex") })).toString(
    "base64url",
  );
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!parsed?.role || !(parsed.role in ROLE_ORDER)) return null;
    return { name: String(parsed.name || "staff"), role: parsed.role as StaffRole };
  } catch {
    return null;
  }
}

export async function hasRole(minimum: StaffRole): Promise<boolean> {
  const session = await getStaffSession();
  if (!session) return false;
  return ROLE_ORDER[session.role] >= ROLE_ORDER[minimum];
}

// Any signed-in staff member (scheduler and up). Kept as the common gate used
// by most admin API routes.
export async function isAdminAuthenticated() {
  return (await getStaffSession()) !== null;
}

// The password entered at login decides the role. SUPERVISOR_PASSWORD and
// SCHEDULER_PASSWORD are optional — if unset, only the admin password works.
export function roleForPassword(password: string): StaffRole | null {
  const admin = process.env.ADMIN_PASSWORD || "strawberry-admin";
  if (password === admin) return "ADMIN";
  const supervisor = process.env.SUPERVISOR_PASSWORD;
  if (supervisor && password === supervisor) return "SUPERVISOR";
  const scheduler = process.env.SCHEDULER_PASSWORD;
  if (scheduler && password === scheduler) return "SCHEDULER";
  return null;
}
