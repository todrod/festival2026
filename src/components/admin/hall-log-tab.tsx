"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HallAttendance } from "@prisma/client";
import { useLang } from "@/components/i18n/language-provider";

// Hall Organization Panel — a daily attendance log, no hard scheduling.
export function HallLogTab() {
  const { t } = useLang();
  const [entries, setEntries] = useState<HallAttendance[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    date: format(new Date("2027-03-03T12:00:00Z"), "yyyy-MM-dd"),
    name: "",
    groupSize: 1,
    activity: "",
    hours: 2,
    notes: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/hall-attendance", { cache: "no-store" });
    if (res.ok) setEntries((await res.json()).entries ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form.name.trim() || !form.activity.trim()) {
      setMessage(t("Please fill in who showed up and what they did."));
      return;
    }
    const res = await fetch("/api/admin/hall-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, groupSize: Number(form.groupSize), hours: Number(form.hours) }),
    });
    if (res.ok) {
      setMessage(t("Logged. Thank you!"));
      setForm((p) => ({ ...p, name: "", groupSize: 1, activity: "", hours: 2, notes: "" }));
      await load();
    } else {
      setMessage(t("Could not save — please check the fields."));
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/hall-attendance?id=${id}`, { method: "DELETE" });
    await load();
  }

  const summary = useMemo(() => {
    const byDate = new Map<string, { people: number; hours: number }>();
    for (const e of entries) {
      const key = format(new Date(e.date), "yyyy-MM-dd");
      const row = byDate.get(key) ?? { people: 0, hours: 0 };
      row.people += e.groupSize;
      row.hours += e.hours * e.groupSize;
      byDate.set(key, row);
    }
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [entries]);

  const inputClass = "w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm";

  return (
    <section className="space-y-4">
      <div className="panel p-4">
        <h2 className="text-lg font-black text-leaf-700">🏛️ {t("Hall Daily Attendance Log")}</h2>
        <p className="text-xs text-foreground/70">
          {t("Record who showed up, what they did, and roughly how long. For groups, log one entry with the group size (e.g. 'Youth Group — 12 people, Berry Hulling, 2 hrs').")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold">{t("Date")}</span>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inputClass} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs font-bold">{t("Who (person or group)")}</span>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("e.g. Youth Group")} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold">{t("How many people")}</span>
            <input type="number" min={1} value={form.groupSize} onChange={(e) => setForm((p) => ({ ...p, groupSize: Number(e.target.value || 1) }))} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold">{t("What they did")}</span>
            <input value={form.activity} onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value }))} placeholder={t("e.g. Berry Hulling")} className={inputClass} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold">{t("About how many hours")}</span>
            <input type="number" min={0} step={0.5} value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: Number(e.target.value || 0) }))} className={inputClass} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-xs font-bold">{t("Notes (optional)")}</span>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inputClass} />
          </label>
          <button onClick={() => void save()} className="ops-btn ops-btn-primary px-6 py-2 text-sm">
            {t("Log Attendance")}
          </button>
        </div>
        {message && <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-sm">{message}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="panel p-4">
          <h3 className="font-black text-strawberry-900">{t("Entries")}</h3>
          <div className="mt-2 max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                  <th className="p-2">{t("Date")}</th>
                  <th className="p-2">{t("Who")}</th>
                  <th className="p-2 text-center">{t("People")}</th>
                  <th className="p-2">{t("Activity")}</th>
                  <th className="p-2 text-center">{t("Hours")}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-strawberry-50">
                    <td className="p-2 font-semibold">{format(new Date(e.date), "EEE M/d")}</td>
                    <td className="p-2">
                      {e.name}
                      {e.notes && <span className="block text-xs text-foreground/60">{e.notes}</span>}
                    </td>
                    <td className="p-2 text-center tabular-nums">{e.groupSize}</td>
                    <td className="p-2">{e.activity}</td>
                    <td className="p-2 text-center tabular-nums">{e.hours}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => void remove(e.id)} className="rounded border border-strawberry-200 px-2 py-0.5 text-xs text-strawberry-700">
                        {t("Delete")}
                      </button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-foreground/60">{t("No entries yet.")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="font-black text-strawberry-900">{t("Headcount by day")}</h3>
          <div className="mt-2 space-y-1 text-sm">
            {summary.length === 0 ? (
              <p className="text-foreground/60">{t("Nothing logged yet.")}</p>
            ) : (
              summary.map(([d, s]) => (
                <div key={d} className="flex items-center justify-between rounded-md bg-muted px-2 py-1.5">
                  <span className="font-bold">{format(new Date(`${d}T00:00:00`), "EEE MMM d")}</span>
                  <span className="tabular-nums">{s.people} {t("people")} · {s.hours.toFixed(0)} {t("person-hrs")}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
