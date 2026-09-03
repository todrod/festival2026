"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import type { AdminDataResponse } from "@/types/app";
import { useLang } from "@/components/i18n/language-provider";

// Supervisor interface: full schedule across all dates and shifts, with
// final-publish per shift. Publishing locks the schedule and routes into the
// Communication tab to notify volunteers.
export function SupervisorTab({
  data,
  canPublish,
  onOpenShift,
  onPublished,
  reload,
}: {
  data: AdminDataResponse;
  canPublish: boolean;
  onOpenShift: (shiftId: string) => void;
  onPublished: (shiftId: string) => void;
  reload: () => Promise<void>;
}) {
  const { t } = useLang();
  const [busyShiftId, setBusyShiftId] = useState("");
  const [message, setMessage] = useState("");

  const publishedByShift = useMemo(() => new Map(data.publishes.map((p) => [p.shiftId, p])), [data.publishes]);
  const notesByShift = useMemo(() => {
    const m = new Map<string, typeof data.shiftNotes>();
    for (const n of data.shiftNotes) {
      const list = m.get(n.shiftId) ?? [];
      list.push(n);
      m.set(n.shiftId, list);
    }
    return m;
  }, [data.shiftNotes]);

  const byDate = useMemo(() => {
    const m = new Map<string, typeof data.shifts>();
    for (const s of data.shifts) {
      const key = format(new Date(s.date), "yyyy-MM-dd");
      const list = m.get(key) ?? [];
      list.push(s);
      m.set(key, list);
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [data.shifts]);

  async function setPublish(shiftId: string, action: "publish" | "unpublish") {
    setBusyShiftId(shiftId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, action }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Publish failed");
      await reload();
      if (action === "publish") {
        setMessage(t("Schedule published and locked. Ready to notify volunteers."));
        onPublished(shiftId);
      } else {
        setMessage(t("Schedule unpublished — assignments are unlocked again."));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("Publish failed"));
    } finally {
      setBusyShiftId("");
    }
  }

  return (
    <section className="space-y-3">
      {!canPublish && (
        <p className="panel border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("You can review the full schedule here. Publishing is for supervisors and admins.")}
        </p>
      )}
      {message && <p className="panel bg-leaf-200/40 p-3 text-sm font-semibold">{message}</p>}

      {byDate.map(([date, shifts]) => (
        <div key={date} className="panel p-3">
          <h3 className="text-base font-black text-strawberry-900">{format(new Date(`${date}T00:00:00`), "EEEE, MMMM d")}</h3>
          <div className="mt-2 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {shifts.map((shift) => {
              const assignments = data.assignments
                .filter((a) => a.shiftId === shift.id)
                .sort((a, b) => a.role.name.localeCompare(b.role.name));
              const targets = data.roleTargets.filter((rt) => rt.shiftId === shift.id).reduce((s, rt) => s + rt.target, 0);
              const publish = publishedByShift.get(shift.id);
              const notes = notesByShift.get(shift.id) ?? [];
              return (
                <div key={shift.id} className={`rounded-xl border p-3 ${publish ? "border-leaf-500 bg-leaf-200/25" : "border-strawberry-100"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">{t(shift.label)}</p>
                      <p className="text-xs text-foreground/70">
                        {assignments.length}/{targets || "—"} {t("filled")}
                      </p>
                    </div>
                    {publish ? (
                      <span className="rounded-full bg-leaf-500 px-2 py-0.5 text-[10px] font-black text-white" title={`${t("by")} ${publish.publishedBy}`}>
                        ✓ {t("PUBLISHED")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground/60">{t("DRAFT")}</span>
                    )}
                  </div>

                  <div className="mt-2 max-h-40 space-y-0.5 overflow-auto text-xs">
                    {assignments.length === 0 ? (
                      <p className="text-foreground/50">{t("No one assigned yet.")}</p>
                    ) : (
                      assignments.map((a) => (
                        <p key={a.id} className="flex items-center justify-between rounded bg-card px-1.5 py-1">
                          <span className="truncate">{t(a.role.name)}</span>
                          <span className="ml-1 font-mono text-[10px] font-bold text-strawberry-700">
                            {a.volunteer.volunteerCode ?? a.volunteer.id.slice(-6)}
                          </span>
                        </p>
                      ))
                    )}
                  </div>

                  {notes.length > 0 && (
                    <div className="mt-2 rounded-md bg-sunny-100 p-2 text-xs">
                      <p className="font-bold text-sunny-600">{t("Shift notes")}</p>
                      {notes.map((n) => (
                        <p key={n.id} className="mt-0.5">
                          {n.text} <span className="text-foreground/50">— {n.author}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => onOpenShift(shift.id)} className="flex-1 rounded-md border border-strawberry-200 px-2 py-1.5 text-xs font-bold">
                      {t("Open board")}
                    </button>
                    {canPublish &&
                      (publish ? (
                        <button
                          disabled={busyShiftId === shift.id}
                          onClick={() => void setPublish(shift.id, "unpublish")}
                          className="flex-1 rounded-md border border-amber-400 px-2 py-1.5 text-xs font-bold text-amber-800 disabled:opacity-50"
                        >
                          {t("Unpublish")}
                        </button>
                      ) : (
                        <button
                          disabled={busyShiftId === shift.id}
                          onClick={() => void setPublish(shift.id, "publish")}
                          className="flex-1 rounded-md bg-leaf-500 px-2 py-1.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          {busyShiftId === shift.id ? t("…") : t("Final Publish")}
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
