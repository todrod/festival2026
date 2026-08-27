"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";

const faqs: Array<[string, string]> = [
  ["Who can volunteer?", "Volunteers must be 18+ and complete acknowledgements before scheduling."],
  ["Can I work more than one role?", "Yes. You can take multiple roles as long as time windows do not overlap."],
  ["Can I do booth day and booth night on same date?", "No. Booth day and night cannot both be assigned for the same date."],
  ["Are heavy roles optional?", "Yes. Heavy-lift acknowledgement is only required for flagged heavy roles and Relief."],
  ["Do some roles require approval?", "Supervisor requires both training and explicit admin approval."],
];

export function LandingContent({ datesLabel }: { datesLabel: string }) {
  const { t } = useLang();
  return (
    <div className="space-y-8">
      <section className="panel ops-surface overflow-hidden">
        <div className="grid gap-8 bg-gradient-to-br from-strawberry-50 via-card to-leaf-200/40 p-8 md:grid-cols-2">
          <div>
            <p className="ops-chip mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-strawberry-900">
              {t("Volunteer Signup Open")}
            </p>
            <h1 className="text-4xl font-black tracking-tight text-strawberry-900">
              {t("Volunteer for St. Clement Strawberry Festival")}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/85">
              {t(
                "Digital volunteer scheduling for booth and hall operations. Choose your days, rank role preferences, and get assigned with fair rules and seniority tie-breaks.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="ops-btn ops-btn-primary px-5 py-3 text-sm shadow-sm">
                {t("Start Volunteer Signup")}
              </Link>
              <Link href="/admin" className="ops-btn ops-btn-ghost px-5 py-3 text-sm">
                {t("Admin Dashboard")}
              </Link>
            </div>
          </div>
          <div className="ops-surface rounded-2xl p-5">
            <h2 className="text-lg font-bold">{t("Festival Snapshot")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <span className="font-semibold">{t("Dates:")}</span> {datesLabel}
              </li>
              <li>
                <span className="font-semibold">{t("Modules:")}</span> {t("BOOTH + HALL with shared volunteer pool")}
              </li>
              <li>
                <span className="font-semibold">{t("Shift policy:")}</span> {t("no overlapping windows")}
              </li>
              <li>
                <span className="font-semibold">{t("Safety:")}</span> {t("18+ only, role capability checks enforced")}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {faqs.map(([q, a]) => (
          <details key={q} className="panel ops-surface p-4">
            <summary className="cursor-pointer text-base font-semibold">{t(q)}</summary>
            <p className="mt-2 text-sm text-foreground/80">{t(a)}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
