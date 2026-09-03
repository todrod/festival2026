"use client";

import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Role } from "@prisma/client";
import { useLang } from "@/components/i18n/language-provider";

// Booth and hall rules — statement form (replaces the old FAQ per the 2027 spec).
const boothRules: string[] = [
  "Booth volunteers must be at least 16 years old. Volunteers 16–18 need a parent's OK.",
  "Booth shifts run March 4–14: Day 9:30 AM – 5:30 PM and Night 5:00 PM – 11:00 PM, plus pack-up on the morning of March 15.",
  "You cannot work the Day shift and the Night shift on the same date.",
  "Every position stands for most of the shift. Some positions also lift up to 25 or 50 lbs — each position tells you before you pick it.",
  "Supervisors must be trained and approved before they can be scheduled.",
  "Wear a white shirt; a white hat is preferred.",
  "All food positions follow the food handling and safety rules.",
];

const hallRules: string[] = [
  "Hall jobs run March 3–14 and lunch is provided.",
  "Hall jobs are organized by phone — tap a hall position below to see who to call.",
  "Nightly Bucket Washing has no age requirement and is family-friendly.",
  "Heavy Duty Hall Workers are urgently needed.",
];

function ContactPopup({ position, onClose }: { position: Role; onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-black text-strawberry-900">{t(position.name)}</h3>
        <p className="mt-2 text-sm text-foreground/85">{t(position.description)}</p>
        {position.contactNote && <p className="mt-2 text-sm font-semibold text-leaf-700">{t(position.contactNote)}</p>}
        {position.contactName && position.contactPhone ? (
          <div className="mt-4 rounded-xl bg-leaf-200 p-4 text-center">
            <p className="text-sm font-bold text-leaf-700">
              {t("To sign up, call")} {position.contactName}
            </p>
            <a href={`tel:${position.contactPhone}`} className="mt-1 block text-2xl font-black text-strawberry-700 underline">
              {position.contactPhone}
            </a>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{t("Ask at the hall — no phone sign-up needed.")}</p>
        )}
        <button onClick={onClose} className="ops-btn ops-btn-primary tap-target mt-4 w-full px-4 py-2 text-sm">
          {t("Close")}
        </button>
      </div>
    </div>
  );
}

export function LandingContent({ datesLabel, positions }: { datesLabel: string; positions: Role[] }) {
  const { t } = useLang();
  const [popup, setPopup] = useState<Role | null>(null);
  const boothPositions = positions.filter((p) => p.module === "BOOTH");
  const hallPositions = positions.filter((p) => p.module === "HALL");

  return (
    <div className="space-y-8">
      {popup && <ContactPopup position={popup} onClose={() => setPopup(null)} />}

      <section className="panel ops-surface overflow-hidden">
        <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="ops-chip mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide">
              {t("Volunteer Sign-Up Open")} · {datesLabel}
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-strawberry-700">
              {t("Volunteer for St. Clement Make Your Own Strawberry Shortcake Project.")}
            </h1>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-foreground/85">
              {t("Pick your days, choose the jobs you like, and we'll take care of the rest. Simple for young and old.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="ops-btn ops-btn-primary tap-target flex items-center px-6 py-3 text-base">
                🍓 {t("Start Volunteer Sign-Up")}
              </Link>
              <a href="#jobs" className="ops-btn ops-btn-ghost tap-target flex items-center px-6 py-3 text-base">
                {t("See Job Descriptions")}
              </a>
            </div>
            <div className="mt-6 rounded-2xl border-2 border-sunny-400 bg-sunny-100 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-strawberry-700">{t("First time volunteering?")}</p>
              <p className="mt-1 text-sm text-foreground/90">
                {t("Come to Volunteer Orientation: Sunday, January 31, 2027 · St. Clement Cronin Hall · 5:00–7:00 PM.")}
              </p>
            </div>
          </div>
          <div className="flex items-end justify-center gap-2">
            <img src="/brand/tipper.svg" alt={t("Tipper the strawberry mascot")} className="hidden w-36 md:block" />
            <img src="/brand/logo.svg" alt="" className="w-44" />
            <img src="/brand/topper.svg" alt={t("Topper the strawberry mascot")} className="hidden w-36 md:block" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-xl font-black text-strawberry-700">🎪 {t("Booth Rules")}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {boothRules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="text-strawberry-500">🍓</span>
                <span>{t(rule)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <h2 className="text-xl font-black text-leaf-700">🏛️ {t("Hall Rules")}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {hallRules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden className="text-leaf-500">🌿</span>
                <span>{t(rule)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="jobs" className="panel p-6">
        <h2 className="text-2xl font-black text-strawberry-700">{t("Job Descriptions")}</h2>
        <p className="mt-1 text-sm text-foreground/80">
          {t("Every position, straight from the job sheet — so you know exactly what you're signing up for.")}
        </p>

        <h3 className="mt-5 text-lg font-black text-strawberry-900">{t("Booth Positions")} <span className="text-sm font-semibold text-foreground/70">({t("March 4–14 — sign up online below")})</span></h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {boothPositions.map((p) => (
            <article key={p.id} className="rounded-xl border border-strawberry-100 bg-background p-3">
              <p className="font-bold text-strawberry-900">{t(p.name)}</p>
              <p className="mt-1 text-sm text-foreground/85">{t(p.description)}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                {p.physicalDemands && (
                  <span className="rounded-full bg-sunny-100 px-2 py-0.5 text-sunny-600">{t(p.physicalDemands)}</span>
                )}
                {p.minAge > 0 && <span className="rounded-full bg-leaf-200 px-2 py-0.5 text-leaf-700">{t("Age")} {p.minAge}+</span>}
                {p.liftLimitLbs > 0 && (
                  <span className="rounded-full bg-strawberry-50 px-2 py-0.5 text-strawberry-700">{t("Lifts")} {p.liftLimitLbs} lbs</span>
                )}
              </div>
            </article>
          ))}
        </div>

        <h3 className="mt-6 text-lg font-black text-leaf-700">{t("Hall Positions")} <span className="text-sm font-semibold text-foreground/70">({t("March 3–14 · lunch provided · sign up by phone")})</span></h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {hallPositions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPopup(p)}
              className="tap-target rounded-xl border border-leaf-500/40 bg-leaf-200/40 p-3 text-left hover:bg-leaf-200"
            >
              <p className="font-bold text-leaf-700">
                {t(p.name)} {p.urgent && <span className="rounded bg-strawberry-500 px-1.5 py-0.5 text-[10px] font-black text-white">{t("URGENTLY NEEDED")}</span>}
              </p>
              <p className="mt-1 text-sm text-foreground/85">{t(p.description)}</p>
              <p className="mt-2 text-xs font-bold text-strawberry-700 underline">
                📞 {p.contactName ? `${t("Tap for contact info")} (${p.contactName})` : t("Tap for details")}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
