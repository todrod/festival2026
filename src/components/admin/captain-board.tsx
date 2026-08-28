"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { AdminDataResponse } from "@/types/app";
import { ABSENCE_OPTIONS, absenceLabel, type AbsenceReasonKey } from "@/lib/absence";
import { useLang } from "@/components/i18n/language-provider";

type CheckinStatus = "OUT" | "IN" | "ABSENT";
function checkinStatus(a: { noShow: boolean; checkedInAt: Date | string | null }): CheckinStatus {
  if (a.noShow) return "ABSENT";
  if (a.checkedInAt) return "IN";
  return "OUT";
}
const STATUS_WEIGHT: Record<CheckinStatus, number> = { OUT: 0, IN: 1, ABSENT: 2 };

export function CaptainBoard() {
  const { t } = useLang();
  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CheckinStatus>("ALL");

  async function load() {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (!res.ok) {
      setMessage(t("Failed to load supervisor data."));
      return;
    }
    const payload = (await res.json()) as AdminDataResponse;
    setData(payload);
    if (!shiftId && payload.shifts[0]) setShiftId(payload.shifts[0].id);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedShift = useMemo(() => data?.shifts.find((s) => s.id === shiftId) || null, [data, shiftId]);
  const assignments = useMemo(() => {
    if (!data) return [];
    return data.assignments.filter((a) => a.shiftId === shiftId);
  }, [data, shiftId]);

  const stats = useMemo(() => {
    let inCount = 0;
    let absentCount = 0;
    let outCount = 0;
    for (const a of assignments) {
      const s = checkinStatus(a);
      if (s === "IN") inCount += 1;
      else if (s === "ABSENT") absentCount += 1;
      else outCount += 1;
    }
    return { inCount, absentCount, outCount, total: assignments.length };
  }, [assignments]);

  const byRole = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = assignments.filter((a) => {
      if (statusFilter !== "ALL" && checkinStatus(a) !== statusFilter) return false;
      if (!q) return true;
      const name = `${a.volunteer.firstName} ${a.volunteer.lastName}`.toLowerCase();
      return name.includes(q) || a.volunteer.phone.toLowerCase().includes(q);
    });
    const grouped = filtered.reduce<Record<string, typeof assignments>>((acc, a) => {
      if (!acc[a.role.name]) acc[a.role.name] = [];
      acc[a.role.name].push(a);
      return acc;
    }, {});
    // Float people who still need attention (not checked in) to the top.
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => {
        const w = STATUS_WEIGHT[checkinStatus(a)] - STATUS_WEIGHT[checkinStatus(b)];
        return w !== 0 ? w : a.volunteer.lastName.localeCompare(b.volunteer.lastName);
      });
    }
    return grouped;
  }, [assignments, search, statusFilter]);

  async function updateCheckin(
    assignmentId: string,
    action: "check_in" | "undo_check_in" | "mark_absent" | "clear_absence",
    reason?: AbsenceReasonKey,
    note?: string,
  ) {
    setLoading(true);
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, action, reason, note }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? t("Updated") : payload.error || t("Update failed"));
    setLoading(false);
    await load();
  }

  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t("Shift Supervisor Mode")}</h1>
        <p className="text-sm text-foreground/90">{t("Mobile-first check-in and no-show handling during active shifts.")}</p>
      </div>
      <div className="panel sticky top-14 z-10 p-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">{t("Shift")}</span>
          <select className="w-full rounded-md border border-strawberry-200 px-2 py-2" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            {(data?.shifts || []).map((s) => (
              <option key={s.id} value={s.id}>
                {format(new Date(s.date), "EEE MMM d")} - {t(s.label)}
              </option>
            ))}
          </select>
        </label>
        {selectedShift && <p className="mt-2 text-xs text-foreground/85">{t("Active shift:")} {t(selectedShift.label)}</p>}
      </div>

      {selectedShift && (
        <div className="panel space-y-3 p-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-leaf-200 px-2.5 py-1 text-leaf-800">{stats.inCount}/{stats.total} {t("checked in")}</span>
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-amber-900">{stats.absentCount} {t("absent")}</span>
            <span className="rounded-full bg-strawberry-100 px-2.5 py-1 text-foreground dark:bg-strawberry-100/35">{stats.outCount} {t("to go")}</span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search name")}
            className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {([
              ["ALL", t("All")],
              ["OUT", t("Not in")],
              ["IN", t("In")],
              ["ABSENT", t("Absent")],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === key ? "bg-strawberry-500 text-white" : "border border-strawberry-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.entries(byRole).map(([role, list]) => (
        <div key={role} className="panel p-3">
          <h3 className="mb-2 text-lg font-bold">{t(role)}</h3>
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className="rounded-lg border border-strawberry-100 bg-card p-2 text-sm text-foreground">
                <p className="font-semibold">
                  {a.volunteer.firstName} {a.volunteer.lastName}
                  {a.confirmationStatus === "CONFIRMED" && (
                    <span className="ml-2 inline-block rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">✓ {t("Confirmed")}</span>
                  )}
                  {a.confirmationStatus === "CANCELLED" && (
                    <span className="ml-2 inline-block rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-900">✕ {t("Cancelled")}</span>
                  )}
                </p>
                <p className="text-xs opacity-80">{a.volunteer.phone}</p>
                <p className="mt-1 text-xs">
                  {t("Status:")}{" "}
                  {a.noShow
                    ? `${t("Absent —")} ${t(absenceLabel(a.absenceReason))}${a.absenceNote ? ` (${a.absenceNote})` : ""}`
                    : a.checkedInAt
                      ? `${t("Checked in at")} ${format(new Date(a.checkedInAt), "HH:mm")}`
                      : t("Pending")}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "check_in")}
                    className="rounded-md bg-leaf-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {t("Check In")}
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "undo_check_in")}
                    className="rounded-md border border-strawberry-300 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {t("Undo")}
                  </button>
                </div>
                <div className="mt-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{t("Mark absent")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ABSENCE_OPTIONS.map((opt) => {
                      const active = a.noShow && a.absenceReason === opt.key;
                      return (
                        <button
                          key={opt.key}
                          disabled={loading}
                          onClick={() => void updateCheckin(a.id, "mark_absent", opt.key)}
                          className={`rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-60 ${
                            active
                              ? opt.excused
                                ? "bg-emerald-500 text-white"
                                : "bg-amber-500 text-white"
                              : "border border-strawberry-300"
                          }`}
                        >
                          {t(opt.label)}
                        </button>
                      );
                    })}
                    <button
                      disabled={loading || !a.noShow}
                      onClick={() => void updateCheckin(a.id, "clear_absence")}
                      className="rounded-md border border-strawberry-300 px-2 py-1 text-xs disabled:opacity-40"
                    >
                      {t("Clear")}
                    </button>
                  </div>
                  {a.noShow && (
                    <input
                      defaultValue={a.absenceNote ?? ""}
                      onBlur={(e) => {
                        const note = e.target.value;
                        if (note.trim() !== (a.absenceNote ?? "").trim()) {
                          void updateCheckin(a.id, "mark_absent", (a.absenceReason as AbsenceReasonKey) ?? "NO_SHOW", note);
                        }
                      }}
                      placeholder={t("Add a note (optional)…")}
                      className="mt-2 w-full rounded-md border border-strawberry-300 bg-background px-2 py-1 text-xs"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {selectedShift && Object.keys(byRole).length === 0 && (
        <p className="panel p-3 text-sm text-foreground/85">{t("No one matches these filters.")}</p>
      )}

      {message && <p className="rounded-md bg-strawberry-50/80 px-3 py-2 text-sm text-foreground dark:bg-strawberry-100/25">{message}</p>}
    </section>
  );
}
