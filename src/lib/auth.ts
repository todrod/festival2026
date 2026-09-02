import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "festival_admin";

function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function createAdminSession() {
  const token = crypto.randomBytes(24).toString("hex");
  const value = `${token}.${sign(token)}`;
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

export async function isAdminAuthenticated() {
  // Local-review bypass: when DISABLE_ADMIN_AUTH=1 is set in a NON-production
  // environment (e.g. .env.local), every request is treated as signed in so the
  // admin pages can be reviewed without a password. The NODE_ENV guard means
  // this can never take effect on the deployed site, even if the flag leaks.
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_ADMIN_AUTH === "1") {
    return true;
  }
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [token, sig] = raw.split(".");
  if (!token || !sig) return false;
  return crypto.timingSafeEqual(Buffer.from(sign(token)), Buffer.from(sig));
}

export function checkAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || "strawberry-admin";
  return password === expected;
}
