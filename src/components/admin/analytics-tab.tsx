"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { HallAttendance } from "@prisma/client";
import type { AdminDataResponse } from "@/types/app";
import { isUnexcusedAbsence } from "@/lib/absence";
import { useLang } from "@/components/i18n/language-provider";

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{label}</p>
      <p className="text-2xl font-black text-strawberry-700">{value}</p>
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  const { t } = useLang();
  return (
    <button onClick={onClick} className="rounded-md border border-leaf-500 px-2 py-1 text-xs font-bold text-leaf-700">
      ⬇ {t("Export CSV")}
    </button>
  );
}

export function AnalyticsTab({ data }: { data: AdminDataResponse }) {
  const { t } = useLang();
  const [hall, setHall] = useState<HallAttendance[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/hall-attendance", { cache: "no-store" });
      if (res.ok) setHall((await res.json()).entries ?? []);
    })();
  }, []);

  const stats = useMemo(() => {
    const perVolunteer = new Map<
      string,
      { code: string; name: string; legacy: number; shifts: number; hours: number; callouts: number; noShows: number; assigned: number }
    >();
    for (const v of data.volunteers) {
      perVolunteer.set(v.id, {
        code: v.volunteerCode ?? v.id.slice(-6),
        name: `${v.firstName} ${v.lastName}`,
        legacy: v.yearsExperience,
        shifts: 0,
        hours: 0,
        callouts: 0,
        noShows: 0,
        assigned: 0,
      });
    }
    for (const a of data.assignments) {
      const row = perVolunteer.get(a.volunteerId);
      if (!row) continue;
      row.assigned += 1;
      if (a.checkedInAt) {
        row.shifts += 1;
        row.hours += (new Date(a.shift.endAt).getTime() - new Date(a.shift.startAt).getTime()) / 3600000;
      }
      if (a.confirmationStatus === "CANCELLED") row.callouts += 1;
      if (isUnexcusedAbsence(a.noShow, a.absenceReason)) row.noShows += 1;
    }

    const rows = [...perVolunteer.values()];
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const neverScheduled = rows.filter((r) => r.assigned === 0);
    const topByShifts = [...rows].sort((a, b) => b.shifts - a.shifts || b.hours - a.hours).slice(0, 10);
    const topByHours = [...rows].sort((a, b) => b.hours - a.hours || b.shifts - a.shifts).slice(0, 10);

    // Positions filled vs needed by day.
    const byDay = new Map<string, { filled: number; needed: number }>();
    for (const c of data.coverage) {
      const row = byDay.get(c.date) ?? { filled: 0, needed: 0 };
      row.filled += c.filled;
      row.needed += c.targets;
      byDay.set(c.date, row);
    }

    // Legacy score distribution.
    const legacyDist = new Map<string, number>();
    for (const r of rows) {
      const bucket = r.legacy === 0 ? "0 (first year)" : r.legacy <= 5 ? "1–5" : r.legacy <= 10 ? "6–10" : "11+";
      legacyDist.set(bucket, (legacyDist.get(bucket) ?? 0) + 1);
    }

    // Flag frequency by type.
    const flagFreq = new Map<string, number>();
    for (const f of data.flags) flagFreq.set(f.type, (flagFreq.get(f.type) ?? 0) + 1);

    const hallPeople = hall.reduce((s, h) => s + h.groupSize, 0);
    const hallHours = hall.reduce((s, h) => s + h.hours * h.groupSize, 0);

    return { rows, totalHours, neverScheduled, topByShifts, topByHours, byDay, legacyDist, flagFreq, hallPeople, hallHours };
  }, [data, hall]);

  const dayRows = [...stats.byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label={t("Volunteers")} value={data.volunteers.length} />
        <StatCard label={t("Total hours worked")} value={stats.totalHours.toFixed(0)} />
        <StatCard label={t("Hall attendance (people)")} value={stats.hallPeople} />
        <StatCard label={t("Never scheduled")} value={stats.neverScheduled.length} />
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-black text-strawberry-900">{t("Per-volunteer totals")}</h2>
          <ExportButton
            onClick={() =>
              downloadCsv(
                "volunteer-totals.csv",
                ["Volunteer ID", "Name", "Legacy Score", "Shifts Worked", "Hours", "Callouts", "No-Shows", "Times Scheduled"],
                stats.rows.map((r) => [r.code, r.name, r.legacy, r.shifts, r.hours.toFixed(1), r.callouts, r.noShows, r.assigned]),
              )
            }
          />
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                <th className="p-2">{t("Volunteer ID")}</th>
                <th className="p-2">{t("Name")}</th>
                <th className="p-2 text-center">{t("Legacy")}</th>
                <th className="p-2 text-center">{t("Shifts worked")}</th>
                <th className="p-2 text-center">{t("Hours")}</th>
                <th className="p-2 text-center">{t("Callouts")}</th>
                <th className="p-2 text-center">{t("No-shows")}</th>
                <th className="p-2 text-center">{t("Scheduled")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r) => (
                <tr key={r.code} className="border-b border-strawberry-50">
                  <td className="p-2 font-mono text-xs font-bold">{r.code}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-center tabular-nums">{r.legacy}</td>
                  <td className="p-2 text-center tabular-nums">{r.shifts}</td>
                  <td className="p-2 text-center tabular-nums">{r.hours.toFixed(1)}</td>
                  <td className="p-2 text-center tabular-nums">{r.callouts}</td>
                  <td className="p-2 text-center tabular-nums">{r.noShows}</td>
                  <td className="p-2 text-center tabular-nums">{r.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black text-strawberry-900">{t("Positions filled vs. needed by day")}</h2>
            <ExportButton
              onClick={() =>
                downloadCsv(
                  "coverage-by-day.csv",
                  ["Date", "Filled", "Needed"],
                  dayRows.map(([d, r]) => [d, r.filled, r.needed]),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            {dayRows.map(([d, r]) => {
              const pct = r.needed > 0 ? Math.min(100, Math.round((r.filled / r.needed) * 100)) : 0;
              return (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-16 font-bold">{format(new Date(`${d}T00:00:00`), "EEE M/d")}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${pct >= 100 ? "bg-leaf-500" : pct >= 60 ? "bg-sunny-400" : "bg-strawberry-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums">{r.filled}/{r.needed} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black text-strawberry-900">{t("Legacy score & flags")}</h2>
            <ExportButton
              onClick={() =>
                downloadCsv(
                  "legacy-and-flags.csv",
                  ["Metric", "Bucket", "Count"],
                  [
                    ...[...stats.legacyDist.entries()].map(([bucket, count]) => ["Legacy score", bucket, count] as [string, string, number]),
                    ...[...stats.flagFreq.entries()].map(([type, count]) => ["Flag", type, count] as [string, string, number]),
                  ],
                )
              }
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Legacy score distribution")}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            {[...stats.legacyDist.entries()].map(([bucket, count]) => (
              <span key={bucket} className="rounded-full bg-leaf-200 px-3 py-1 font-bold text-leaf-700">
                {bucket}: {count}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Flag frequency by type")}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            {stats.flagFreq.size === 0 ? (
              <span className="text-xs text-foreground/60">{t("No flags recorded.")}</span>
            ) : (
              [...stats.flagFreq.entries()].map(([type, count]) => (
                <span key={type} className="rounded-full bg-strawberry-50 px-3 py-1 font-bold text-strawberry-700">
                  {type.replaceAll("_", " ")}: {count}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black text-strawberry-900">{t("Top contributors")}</h2>
            <ExportButton
              onClick={() =>
                downloadCsv(
                  "top-contributors.csv",
                  ["Volunteer ID", "Name", "Shifts Worked", "Hours"],
                  stats.topByShifts.map((r) => [r.code, r.name, r.shifts, r.hours.toFixed(1)]),
                )
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <p className="text-xs font-bold uppercase text-foreground/60">{t("Most shifts")}</p>
              <ol className="mt-1 list-decimal pl-5">
                {stats.topByShifts.map((r) => (
                  <li key={r.code}>{r.name} — {r.shifts}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-foreground/60">{t("Most hours")}</p>
              <ol className="mt-1 list-decimal pl-5">
                {stats.topByHours.map((r) => (
                  <li key={r.code}>{r.name} — {r.hours.toFixed(1)}h</li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black text-strawberry-900">{t("Signed up but never scheduled")}</h2>
            <ExportButton
              onClick={() =>
                downloadCsv(
                  "never-scheduled.csv",
                  ["Volunteer ID", "Name", "Legacy Score"],
                  stats.neverScheduled.map((r) => [r.code, r.name, r.legacy]),
                )
              }
            />
          </div>
          <div className="max-h-56 overflow-auto text-sm">
            {stats.neverScheduled.length === 0 ? (
              <p className="text-foreground/60">{t("Everyone has at least one assignment. 🎉")}</p>
            ) : (
              <ul className="space-y-1">
                {stats.neverScheduled.map((r) => (
                  <li key={r.code} className="rounded-md bg-muted px-2 py-1">
                    <span className="font-mono text-xs font-bold">{r.code}</span> · {r.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-black text-strawberry-900">{t("Hall attendance totals")}</h2>
          <ExportButton
            onClick={() =>
              downloadCsv(
                "hall-attendance.csv",
                ["Date", "Name/Group", "People", "Activity", "Hours", "Notes"],
                hall.map((h) => [format(new Date(h.date), "yyyy-MM-dd"), h.name, h.groupSize, h.activity, h.hours, h.notes ?? ""]),
              )
            }
          />
        </div>
        <p className="text-sm">
          {t("Total people:")} <strong>{stats.hallPeople}</strong> · {t("Total person-hours:")} <strong>{stats.hallHours.toFixed(0)}</strong> · {t("Entries:")} <strong>{hall.length}</strong>
        </p>
      </div>
    </section>
  );
}
