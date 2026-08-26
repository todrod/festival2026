"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { AdminDataResponse } from "@/types/app";

export function CaptainBoard() {
  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (!res.ok) {
      setMessage("Failed to load captain data.");
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

  const byRole = useMemo(() => {
    return assignments.reduce<Record<string, typeof assignments>>((acc, a) => {
      if (!acc[a.role.name]) acc[a.role.name] = [];
      acc[a.role.name].push(a);
      return acc;
    }, {});
  }, [assignments]);

  async function updateCheckin(assignmentId: string, action: "check_in" | "undo_check_in" | "mark_no_show" | "clear_no_show") {
    setLoading(true);
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, action }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Updated" : payload.error || "Update failed");
    setLoading(false);
    await load();
  }

  return (
    <section className="space-y-3">
      <div className="panel sticky top-14 z-10 p-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Shift</span>
          <select className="w-full rounded-md border border-strawberry-200 px-2 py-2" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            {(data?.shifts || []).map((s) => (
              <option key={s.id} value={s.id}>
                {format(new Date(s.date), "EEE MMM d")} - {s.label}
              </option>
            ))}
          </select>
        </label>
        {selectedShift && <p className="mt-2 text-xs text-foreground/85">Active shift: {selectedShift.label}</p>}
      </div>

      {Object.entries(byRole).map(([role, list]) => (
        <div key={role} className="panel p-3">
          <h3 className="mb-2 text-lg font-bold">{role}</h3>
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className="rounded-lg border border-strawberry-100 bg-card p-2 text-sm text-foreground">
                <p className="font-semibold">
                  {a.volunteer.firstName} {a.volunteer.lastName}
                </p>
                <p className="text-xs opacity-80">{a.volunteer.phone}</p>
                <p className="mt-1 text-xs">
                  Status: {a.noShow ? "No-show" : a.checkedInAt ? `Checked in at ${format(new Date(a.checkedInAt), "HH:mm")}` : "Pending"}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "check_in")}
                    className="rounded-md bg-leaf-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Check In
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "undo_check_in")}
                    className="rounded-md border border-strawberry-300 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Undo
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "mark_no_show")}
                    className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Mark No-Show
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void updateCheckin(a.id, "clear_no_show")}
                    className="rounded-md border border-strawberry-300 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Clear No-Show
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {message && <p className="rounded-md bg-strawberry-50/80 px-3 py-2 text-sm text-foreground dark:bg-strawberry-100/25">{message}</p>}
    </section>
  );
}
