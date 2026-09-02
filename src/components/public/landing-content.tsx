"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";

// Booth and hall rules in statement form — these replace the old FAQ per the
// parish change sheet. Wording follows the 2027 paper sign-up sheet.
const boothRules: string[] = [
  "Volunteers must be 16 or older. Workers 16, 17, or 18 who are in high school or still living at home must work alongside a parent.",
  "Wear a white button-down shirt or blouse with a collar (white shirts are available if you need one).",
  "Men wear dark long pants. Ladies wear pants, shorts, or leggings — a skirt, apron, hat, and doily head covering are provided.",
  "Wear comfortable shoes. A lot of standing is required, and there is no sitting in food serving or prep areas.",
  "Smiling is required! Breaks are provided.",
  "Transportation to and from the festival grounds is provided by church bus.",
];

const hallRules: string[] = [
  "Hall work runs March 3 through March 14. Lunch is provided for all hall workers.",
  "A free dinner is provided for nighttime bucket washers.",
  "You sign up for each hall position by calling the coordinator listed for that job.",
  "Bring your own knife if you are hulling berries.",
  "Shift times vary by job — for example, berry hulling starts at 7:30 AM.",
];

function BerryFriends() {
  // Simple, cheerful "berry people" made from emoji so the page feels like the
  // bulletin ads without needing image assets. Decorative only.
  return (
    <div aria-hidden className="pointer-events-none flex select-none items-end justify-center gap-1 text-4xl">
      <span className="translate-y-1">🍓</span>
      <span className="text-5xl">🍓</span>
      <span className="translate-y-1">🍰</span>
      <span className="text-5xl">🍓</span>
      <span className="translate-y-1">🍓</span>
    </div>
  );
}

export function LandingContent({ datesLabel }: { datesLabel: string }) {
  const { t } = useLang();
  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden border-strawberry-100">
        <div className="grid gap-8 bg-gradient-to-br from-strawberry-50 via-card to-leaf-200 p-8 md:grid-cols-2">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-leaf-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              🍓 {t("Volunteer Sign-Up Open")} · {t("53rd Year")}
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-strawberry-900">
              {t("Volunteer for St. Clement")}{" "}
              <span className="text-[color:var(--gold)]">
                {t("“Make Your Own Strawberry Shortcake Project.”")}
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/85">
              {t(
                "Join the parish for our 53rd Strawberry Festival! Choose the days you can help, pick the positions you'd like, and we'll take care of the schedule.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="ops-btn ops-btn-primary px-6 py-3 text-sm shadow-sm">
                {t("Start Volunteer Sign-Up")}
              </Link>
              <Link href="/positions" className="ops-btn ops-btn-ghost px-5 py-3 text-sm">
                {t("Position Descriptions")}
              </Link>
              <Link href="/admin" className="ops-btn ops-btn-ghost px-5 py-3 text-sm">
                {t("Admin Dashboard")}
              </Link>
            </div>
            <div className="mt-6">
              <BerryFriends />
            </div>
          </div>
          <div className="rounded-2xl border border-strawberry-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-strawberry-900">🎪 {t("Festival Snapshot")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <span className="font-semibold text-strawberry-900">{t("Booth Dates:")}</span> {datesLabel}
              </li>
              <li>
                <span className="font-semibold text-strawberry-900">{t("Hall Dates:")}</span> {t("Mar 3 - Mar 14, 2027")}
              </li>
              <li>
                <span className="font-semibold text-strawberry-900">{t("Orientation:")}</span>{" "}
                {t("Sun, Jan 31, 2027 · 5:00-7:00 PM · Cronin Hall")}
              </li>
              <li>
                <span className="font-semibold text-strawberry-900">{t("Two areas:")}</span>{" "}
                {t("Booth (festival grounds) and Hall (berry prep)")}
              </li>
              <li>
                <span className="font-semibold text-strawberry-900">{t("Bus:")}</span>{" "}
                {t("Transportation provided to and from the grounds")}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel border-strawberry-100 p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-strawberry-900">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-strawberry-500 text-white">🍓</span>
            {t("Booth Worker Rules")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {boothRules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="mt-0.5 text-leaf-500">✔</span>
                <span>{t(rule)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel border-strawberry-100 p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-strawberry-900">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-leaf-500 text-white">🥣</span>
            {t("Hall Worker Rules")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {hallRules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="mt-0.5 text-leaf-500">✔</span>
                <span>{t(rule)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
