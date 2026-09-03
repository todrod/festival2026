"use client";

import type { AdminNote, Role, VolunteerFlag } from "@prisma/client";
import { DndContext, type DragEndEvent, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { addDays, differenceInYears, format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminDataResponse, AutoAssignWarningPayload, VolunteerWithAck } from "@/types/app";
import { seniorityTier } from "@/lib/seniority";
import { isUnexcusedAbsence } from "@/lib/absence";
import { useLang } from "@/components/i18n/language-provider";
import { CommsTab } from "@/components/admin/comms-tab";
import { AnalyticsTab } from "@/components/admin/analytics-tab";
import { HallLogTab } from "@/components/admin/hall-log-tab";
import { SupervisorTab } from "@/components/admin/supervisor-tab";

type Tab = "coverage" | "schedule" | "volunteers" | "training" | "supervisor" | "hall" | "analytics" | "comms";
type ShiftFilter = "ALL" | string;

const AGE_REFERENCE = new Date("2027-03-04T12:00:00Z");

const NOTE_CATEGORIES = [
  "EXCELLENT",
  "NEEDS_GUIDANCE",
  "CALLOUT_HISTORY",
  "PHYSICAL_LIMITATION",
  "LANGUAGE_ONLY_SPANISH",
  "VIP_RETURN",
  "DO_NOT_SCHEDULE",
  "GENERAL",
] as const;

function noteCategoryTone(category: string) {
  if (category === "EXCELLENT" || category === "VIP_RETURN") return "bg-leaf-200 text-leaf-700";
  if (category === "DO_NOT_SCHEDULE") return "bg-strawberry-500 text-white";
  if (category === "CALLOUT_HISTORY" || category === "NEEDS_GUIDANCE") return "bg-amber-200 text-amber-950";
  return "bg-muted text-foreground";
}

function volunteerAge(v: { dob: Date | string }) {
  return differenceInYears(AGE_REFERENCE, new Date(v.dob));
}

// Hard blocks stop a placement (drag is refused without Force assign).
function hardReasonsFor(volunteer: VolunteerWithAck, role: Role): string[] {
  const reasons: string[] = [];
  if (role.requiredGender && volunteer.gender !== role.requiredGender) {
    reasons.push(role.requiredGender === "FEMALE" ? "Female-restricted position" : "Male-restricted position");
  }
  const age = volunteerAge(volunteer);
  if (role.minAge > 0 && age < role.minAge) reasons.push(`Under minimum age ${role.minAge}`);
  return reasons;
}

// Soft flags never block — they show as warnings the scheduler can confirm.
function softWarningsFor(volunteer: VolunteerWithAck, role: Role): string[] {
  const warnings: string[] = [];
  const ack = volunteer.acknowledgement;
  const age = volunteerAge(volunteer);
  if (age >= 16 && age < 18 && !volunteer.parentConsent) warnings.push("Age 16–17, no parent consent");
  if (role.liftLimitLbs > 0 && (ack?.liftingCapacityLbs ?? 0) < role.liftLimitLbs) {
    warnings.push(`Lifting declaration (${ack?.liftingCapacityLbs ?? 0} lbs) below ${role.liftLimitLbs} lbs`);
  }
  if (role.requiresStanding && !ack?.standingWalking) warnings.push("No extended-standing declaration");
  return warnings;
}

function shiftShortLabel(shiftType: string) {
  if (shiftType === "BOOTH_SETUP") return "Early Setup";
  if (shiftType === "BOOTH_DAY") return "Day";
  if (shiftType === "BOOTH_NIGHT") return "Night";
  if (shiftType === "BOOTH_PACKUP") return "Pack-Up";
  return shiftType;
}

function shiftToneClasses(shiftType: string) {
  if (shiftType === "BOOTH_SETUP") return "border-sunny-400 bg-sunny-100";
  if (shiftType === "BOOTH_DAY") return "border-strawberry-300 bg-strawberry-50";
  if (shiftType === "BOOTH_NIGHT") return "border-leaf-500 bg-leaf-200/50";
  return "border-strawberry-100 bg-muted";
}

function PoolCard({
  volunteer,
  selected,
  fitSummary,
  reliability,
  flagCount,
}: {
  volunteer: VolunteerWithAck;
  selected: boolean;
  fitSummary: string;
  reliability: ReturnType<typeof reliabilityInfo>;
  flagCount: number;
}) {
  const { t } = useLang();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool:${volunteer.id}`,
  });
  const tier = seniorityTier(volunteer.yearsExperience);

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      {...attributes}
      {...listeners}
      className={`w-full cursor-grab rounded-md border px-2 py-2 text-left text-xs ${isDragging ? "opacity-50" : ""} ${selected ? "border-leaf-500 bg-leaf-200/60" : "border-strawberry-100 bg-card"}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-black text-strawberry-700">{volunteer.volunteerCode ?? volunteer.id.slice(-6)}</span>
        {flagCount > 0 && (
          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-950" title={t("Has sign-up flags")}>
            ⚑ {flagCount}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-foreground/80">
        {volunteer.firstName} {volunteer.lastName}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tier.className}`} title={`${t("Legacy score")}: ${volunteer.yearsExperience}`}>
          <span aria-hidden>{tier.emoji}</span> {volunteer.yearsExperience}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${reliability.className}`}>
          <span aria-hidden>{reliability.emoji}</span> {t(reliability.label)}
        </span>
      </div>
      <div className="mt-1 truncate text-[10px] text-foreground/70" title={fitSummary}>{fitSummary}</div>
    </button>
  );
}

type ReliabilityStats = { assigned: number; attended: number; noShows: number; excused: number };

function reliabilityInfo(stats?: ReliabilityStats) {
  const s = stats ?? { assigned: 0, attended: 0, noShows: 0, excused: 0 };
  if (s.assigned === 0) {
    return { ...s, label: "New", emoji: "🆕", className: "bg-slate-200 text-slate-800" };
  }
  if (s.noShows > 0) {
    return { ...s, label: "Watch", emoji: "⚠️", className: "bg-amber-200 text-amber-950" };
  }
  return { ...s, label: "Reliable", emoji: "✅", className: "bg-emerald-200 text-emerald-950" };
}

function roleHealth(count: number, target: number) {
  if (target <= 0) return { label: "No target", className: "bg-card text-foreground border border-strawberry-100" };
  if (count < target) return { label: "Under", className: "bg-amber-200 text-amber-950 border border-amber-300" };
  if (count === target) return { label: "Full", className: "bg-emerald-200 text-emerald-950 border border-emerald-300" };
  return { label: "Over", className: "bg-rose-200 text-rose-950 border border-rose-300" };
}

function RoleColumn({
  role,
  count,
  target,
  selected,
  onSelect,
  dropState,
  children,
}: {
  role: Role;
  count: number;
  target: number;
  selected: boolean;
  onSelect: () => void;
  dropState: "idle" | "eligible" | "ineligible";
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const { setNodeRef, isOver } = useDroppable({ id: `role:${role.id}`, disabled: dropState === "ineligible" });
  const health = roleHealth(count, target);
  return (
    <div
      ref={setNodeRef}
      className={`mb-1.5 break-inside-avoid rounded-lg border p-2 ${
        dropState === "eligible"
          ? "border-green-500 bg-green-100/50"
          : dropState === "ineligible"
            ? "border-red-500 bg-red-100/40"
            : isOver
              ? "border-leaf-500 bg-leaf-200/30"
              : "border-strawberry-100"
      } ${selected ? "ring-2 ring-leaf-500" : ""}`}
    >
      <button type="button" className="mb-1 flex w-full items-center justify-between text-left" onClick={onSelect}>
        <h3 className="text-sm font-semibold">{t(role.name)}</h3>
        <span className="rounded-full bg-strawberry-50 px-2 py-0.5 text-xs font-bold text-strawberry-700">
          {count}/{target}
        </span>
      </button>
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${health.className}`}>{t(health.label)}</span>
        {role.requiredGender && (
          <span className="text-[10px] font-bold text-strawberry-700">{role.requiredGender === "FEMALE" ? t("Female only") : t("Male only")}</span>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NotesEditor({
  volunteer,
  notes,
  onClose,
  onSaved,
}: {
  volunteer: VolunteerWithAck;
  notes: AdminNote[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useLang();
  const [category, setCategory] = useState<(typeof NOTE_CATEGORIES)[number]>("GENERAL");
  const [text, setText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId: volunteer.id, category, text, isPrivate }),
    });
    setText("");
    setBusy(false);
    await onSaved();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/notes?id=${id}`, { method: "DELETE" });
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="panel max-h-[85vh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-strawberry-900">{t("Admin Notes")}</h3>
            <p className="font-mono text-xs font-bold text-strawberry-700">{volunteer.volunteerCode}</p>
            <p className="text-sm">{volunteer.firstName} {volunteer.lastName}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-strawberry-200 px-2 py-1 text-sm">✕</button>
        </div>

        <div className="mt-3 space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-foreground/60">{t("No notes yet.")}</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-strawberry-100 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${noteCategoryTone(n.category)}`}>
                    {n.category.replaceAll("_", " ")}
                    {n.isPrivate && " 🔒"}
                  </span>
                  <button onClick={() => void remove(n.id)} className="text-xs text-strawberry-700 underline">{t("delete")}</button>
                </div>
                <p className="mt-1">{n.text}</p>
                <p className="mt-0.5 text-[10px] text-foreground/50">
                  {n.author} · {format(new Date(n.createdAt), "MMM d, yyyy HH:mm")}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-lg bg-muted p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Add note")}</p>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mt-1 w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm">
            {NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
            ))}
          </select>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-2 w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm" placeholder={t("Freeform note…")} />
          <label className="mt-1 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            {t("Private — only I can see this note")}
          </label>
          <button disabled={busy || !text.trim()} onClick={() => void save()} className="ops-btn ops-btn-primary mt-2 w-full px-4 py-2 text-sm disabled:opacity-50">
            {t("Save Note")}
          </button>
        </div>
      </div>
    </div>
  );
}

function VolunteerDetail({ volunteer, flags, onClose }: { volunteer: VolunteerWithAck; flags: VolunteerFlag[]; onClose: () => void }) {
  const { t } = useLang();
  const ack = volunteer.acknowledgement;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="panel max-h-[85vh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-sm font-black text-strawberry-700">{volunteer.volunteerCode}</p>
            <h3 className="text-xl font-black text-strawberry-900">{volunteer.firstName} {volunteer.lastName}</h3>
          </div>
          <button onClick={onClose} className="rounded-md border border-strawberry-200 px-2 py-1 text-sm">✕</button>
        </div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p><strong>{t("Age at festival:")}</strong> {volunteerAge(volunteer)}</p>
          <p><strong>{t("Gender:")}</strong> {volunteer.gender === "FEMALE" ? t("Female") : t("Male")}</p>
          <p><strong>{t("Phone:")}</strong> {volunteer.phone}</p>
          <p><strong>{t("Email:")}</strong> {volunteer.email}</p>
          <p className="md:col-span-2"><strong>{t("Address:")}</strong> {volunteer.address || "—"}</p>
          <p><strong>{t("Language:")}</strong> {volunteer.language === "BOTH" ? t("English & Spanish") : volunteer.language === "SPANISH" ? t("Spanish") : t("English")}</p>
          <p><strong>{t("Legacy score:")}</strong> {volunteer.yearsExperience}</p>
          <p><strong>{t("First time:")}</strong> {volunteer.firstTimeVolunteer ? t("Yes") : t("No")}</p>
          <p><strong>{t("Orientation:")}</strong> {volunteer.orientationRsvp === "WILL_ATTEND" ? t("Will attend") : volunteer.orientationRsvp === "WILL_NOT_ATTEND" ? t("Will not attend") : "—"}</p>
          <p><strong>{t("Emergency contact:")}</strong> {volunteer.emergencyContactName} · {volunteer.emergencyContactPhone}</p>
          <p><strong>{t("Emergency call list:")}</strong> {volunteer.emergencyOptIn ? (volunteer.emergencyDates.length > 0 ? volunteer.emergencyDates.join(", ") : t("Yes")) : t("No")}</p>
          <p><strong>{t("Sign-up time:")}</strong> {format(new Date(volunteer.createdAt), "MMM d, yyyy HH:mm")}</p>
          <p className="md:col-span-2">
            <strong>{t("Physical declaration:")}</strong>{" "}
            {t("Standing:")} {ack?.standingWalking ? t("Yes") : t("No")} · {t("Lifting:")} {ack?.liftingCapacityLbs ?? 0} lbs · {t("Cash:")} {ack?.cashHandling ? t("Yes") : t("No")} · {t("Outdoor:")} {ack?.outdoorSun ? t("Yes") : t("No")}
          </p>
        </div>
        {flags.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-amber-900">{t("Sign-up flags")}</p>
            <ul className="mt-1 space-y-1 text-sm text-amber-950">
              {flags.map((f) => (
                <li key={f.id}>⚑ {f.detail ?? f.type.replaceAll("_", " ")}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useLang();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [tab, setTab] = useState<Tab>("coverage");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [shiftId, setShiftId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>("ALL");
  const [search, setSearch] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [autoWarnings, setAutoWarnings] = useState<AutoAssignWarningPayload[]>([]);
  const [force, setForce] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>("");
  const [inspectorRoleId, setInspectorRoleId] = useState<string>("");
  const [selectedRoleFilterIds, setSelectedRoleFilterIds] = useState<string[]>([]);
  const [activeDragVolunteerId, setActiveDragVolunteerId] = useState<string>("");
  const [coverageDateFilter, setCoverageDateFilter] = useState<string>("ALL");
  const [openCoverageDate, setOpenCoverageDate] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [reminderDate, setReminderDate] = useState<string>(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [reminderPreview, setReminderPreview] = useState<{ eligible: number; alreadyReminded: number; noOptIn: number; badPhone: number } | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [notesVolunteerId, setNotesVolunteerId] = useState<string>("");
  const [detailVolunteerId, setDetailVolunteerId] = useState<string>("");
  const [shiftNoteText, setShiftNoteText] = useState("");
  const [commsPrefillShiftId, setCommsPrefillShiftId] = useState<string | undefined>(undefined);
  const [replacementSuggestions, setReplacementSuggestions] = useState<
    Record<string, Array<{ volunteerId: string; volunteerCode: string; name: string; reasons: string[] }>>
  >({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setData(null);
      return;
    }
    if (!res.ok) {
      setMessage(`Failed to load admin data (${res.status}).`);
      return;
    }
    let payload: AdminDataResponse;
    try {
      payload = (await res.json()) as AdminDataResponse;
    } catch {
      setMessage(t("Failed to parse admin response. Check server/API error logs."));
      return;
    }
    setData(payload);
    if (!shiftId && payload.shifts[0]) setShiftId(payload.shifts[0].id);
    setAuthed(true);
  }, [shiftId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = data?.session.role ?? "SCHEDULER";
  const isSupervisorPlus = role === "SUPERVISOR" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const allDates = useMemo(() => {
    if (!data) return [];
    const unique = new Set(data.shifts.map((s) => format(new Date(s.date), "yyyy-MM-dd")));
    return [...unique].sort();
  }, [data]);

  const filteredShifts = useMemo(() => {
    if (!data) return [];
    return data.shifts.filter((s) => {
      const dateKey = format(new Date(s.date), "yyyy-MM-dd");
      if (selectedDate !== "ALL" && dateKey !== selectedDate) return false;
      if (shiftFilter !== "ALL" && s.shiftType !== shiftFilter) return false;
      return true;
    });
  }, [data, selectedDate, shiftFilter]);

  useEffect(() => {
    if (!filteredShifts.length) return;
    if (!filteredShifts.some((s) => s.id === shiftId)) {
      setShiftId(filteredShifts[0].id);
    }
  }, [filteredShifts, shiftId]);

  useEffect(() => {
    setOpenCoverageDate(coverageDateFilter !== "ALL" ? coverageDateFilter : null);
  }, [coverageDateFilter]);

  const previewReminders = useCallback(async (date: string) => {
    const res = await fetch(`/api/admin/send-reminders?date=${date}`, { cache: "no-store" });
    setReminderPreview(res.ok ? await res.json() : null);
  }, []);

  useEffect(() => {
    if (authed) void previewReminders(reminderDate);
  }, [authed, reminderDate, previewReminders]);

  const selectedShift = useMemo(() => data?.shifts.find((s) => s.id === shiftId) ?? null, [data, shiftId]);
  const roleTargets = useMemo(() => (data ? data.roleTargets.filter((r) => r.shiftId === shiftId) : []), [data, shiftId]);
  const shiftPublished = useMemo(() => data?.publishes.find((p) => p.shiftId === shiftId) ?? null, [data, shiftId]);
  const scheduleLocked = !!shiftPublished && !isSupervisorPlus;

  const displayedRoles = useMemo(() => {
    if (!data || !selectedShift) return [];
    const roleIds = new Set(roleTargets.map((r) => r.roleId));
    if (roleIds.size > 0) return data.roles.filter((r) => roleIds.has(r.id));
    return data.roles.filter((r) => r.module === "BOOTH" && !r.manualOnly && !r.infoOnly);
  }, [data, roleTargets, selectedShift]);

  useEffect(() => {
    if (selectedRoleFilterIds.length === 0) return;
    const validIds = new Set(displayedRoles.map((r) => r.id));
    setSelectedRoleFilterIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [displayedRoles, selectedRoleFilterIds.length]);

  const assigned = useMemo(() => {
    if (!data) return [];
    return data.assignments.filter((a) => a.shiftId === shiftId);
  }, [data, shiftId]);

  const selectedVolunteer = useMemo(() => {
    if (!data || !selectedVolunteerId) return null;
    return data.volunteers.find((v) => v.id === selectedVolunteerId) || null;
  }, [data, selectedVolunteerId]);

  const selectedRole = useMemo(() => {
    if (!inspectorRoleId) return null;
    return displayedRoles.find((r) => r.id === inspectorRoleId) || null;
  }, [displayedRoles, inspectorRoleId]);

  const availabilitySet = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.availability.filter((a) => a.shiftId === shiftId).map((a) => a.volunteerId));
  }, [data, shiftId]);

  const flagsByVolunteer = useMemo(() => {
    const m = new Map<string, VolunteerFlag[]>();
    if (data) {
      for (const f of data.flags) {
        const list = m.get(f.volunteerId) ?? [];
        list.push(f);
        m.set(f.volunteerId, list);
      }
    }
    return m;
  }, [data]);

  const notesByVolunteer = useMemo(() => {
    const m = new Map<string, AdminNote[]>();
    if (data) {
      for (const n of data.adminNotes) {
        const list = m.get(n.volunteerId) ?? [];
        list.push(n);
        m.set(n.volunteerId, list);
      }
    }
    return m;
  }, [data]);

  // Eligibility per volunteer × position: hard reasons block the drop; soft
  // warnings surface inline without blocking (per the 2027 autofill spec).
  const roleEligibilityMap = useMemo(() => {
    const map = new Map<string, { eligible: boolean; hard: string[]; soft: string[] }>();
    if (!data || !selectedShift) return map;
    const shiftDay = format(new Date(selectedShift.date), "yyyy-MM-dd");

    for (const volunteer of data.volunteers) {
      for (const roleRow of displayedRoles) {
        const hard: string[] = [];
        if (!availabilitySet.has(volunteer.id)) hard.push("Not available");
        hard.push(...hardReasonsFor(volunteer, roleRow));

        if (roleRow.requiresTraining) {
          const trained = data.trainings.find((tr) => tr.volunteerId === volunteer.id && tr.roleId === roleRow.id)?.trained || false;
          if (!trained) hard.push("Training required");
        }
        if (roleRow.requiresApproval) {
          const approved = data.approvals.find((a) => a.volunteerId === volunteer.id && a.roleId === roleRow.id)?.approved || false;
          if (!approved) hard.push("Approval required");
        }

        const dayAssignments = data.assignments.filter(
          (a) => a.volunteerId === volunteer.id && format(new Date(a.shift.date), "yyyy-MM-dd") === shiftDay,
        );
        for (const a of dayAssignments) {
          if (a.shiftId === selectedShift.id) continue;
          const aStart = new Date(a.shift.conflictStartAt).getTime();
          const aEnd = new Date(a.shift.conflictEndAt).getTime();
          const sStart = new Date(selectedShift.conflictStartAt).getTime();
          const sEnd = new Date(selectedShift.conflictEndAt).getTime();
          if (aStart < sEnd && sStart < aEnd) hard.push("Time conflict");
          if (
            (a.shift.shiftType === "BOOTH_DAY" && selectedShift.shiftType === "BOOTH_NIGHT") ||
            (a.shift.shiftType === "BOOTH_NIGHT" && selectedShift.shiftType === "BOOTH_DAY")
          ) {
            hard.push("Day/Night same-date rule");
          }
        }

        map.set(`${volunteer.id}:${roleRow.id}`, {
          eligible: hard.length === 0,
          hard,
          soft: softWarningsFor(volunteer, roleRow),
        });
      }
    }
    return map;
  }, [availabilitySet, data, displayedRoles, selectedShift]);

  const availablePool = useMemo(() => {
    if (!data || !selectedShift) return [];
    const assignedIds = new Set(assigned.map((a) => a.volunteerId));
    const q = `${search} ${poolSearch}`.trim().toLowerCase();

    const basePool = data.volunteers
      .filter((v) => availabilitySet.has(v.id) && !assignedIds.has(v.id))
      .filter((v) => {
        if (!q) return true;
        const full = `${v.firstName} ${v.lastName} ${v.volunteerCode ?? ""}`.toLowerCase();
        return full.includes(q) || v.email.toLowerCase().includes(q) || v.phone.toLowerCase().includes(q);
      })
      // Autofill priority order: legacy score DESC, sign-up time ASC.
      .sort((a, b) => b.yearsExperience - a.yearsExperience || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (selectedRoleFilterIds.length === 0) return basePool;
    return basePool.filter((v) =>
      selectedRoleFilterIds.some((roleId) => roleEligibilityMap.get(`${v.id}:${roleId}`)?.eligible),
    );
  }, [assigned, availabilitySet, data, poolSearch, roleEligibilityMap, search, selectedRoleFilterIds, selectedShift]);

  const coverageSummary = useMemo(() => {
    if (!data) return [];
    return data.coverage.map((item) => ({ ...item, health: roleHealth(item.filled, item.targets) }));
  }, [data]);

  const volunteerCounts = useMemo(() => {
    const availByVolunteer = new Map<string, number>();
    const assignByVolunteer = new Map<string, number>();
    if (data) {
      for (const a of data.availability) availByVolunteer.set(a.volunteerId, (availByVolunteer.get(a.volunteerId) ?? 0) + 1);
      for (const a of data.assignments) assignByVolunteer.set(a.volunteerId, (assignByVolunteer.get(a.volunteerId) ?? 0) + 1);
    }
    return { availByVolunteer, assignByVolunteer };
  }, [data]);

  const reliabilityByVolunteer = useMemo(() => {
    const m = new Map<string, ReliabilityStats>();
    if (data) {
      for (const a of data.assignments) {
        const r = m.get(a.volunteerId) ?? { assigned: 0, attended: 0, noShows: 0, excused: 0 };
        r.assigned += 1;
        if (a.checkedInAt) r.attended += 1;
        if (a.noShow) {
          if (isUnexcusedAbsence(a.noShow, a.absenceReason)) r.noShows += 1;
          else r.excused += 1;
        }
        m.set(a.volunteerId, r);
      }
    }
    return m;
  }, [data]);

  const roster = useMemo(() => {
    if (!data) return [];
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return data.volunteers;
    return data.volunteers.filter((v) => {
      const full = `${v.firstName} ${v.lastName} ${v.volunteerCode ?? ""}`.toLowerCase();
      return full.includes(q) || v.email.toLowerCase().includes(q) || v.phone.toLowerCase().includes(q);
    });
  }, [data, rosterSearch]);

  const scheduleSummary = useMemo(() => {
    if (!selectedShift) return null;
    const totalTarget = roleTargets.reduce((sum, rt) => sum + rt.target, 0);
    const assignedCount = assigned.length;
    return {
      totalTarget,
      assignedCount,
      unfilled: Math.max(0, totalTarget - assignedCount),
      availableCount: availablePool.length,
      lockedCount: assigned.filter((a) => a.locked).length,
    };
  }, [assigned, availablePool.length, roleTargets, selectedShift]);

  const currentShiftNotes = useMemo(
    () => (data ? data.shiftNotes.filter((n) => n.shiftId === shiftId) : []),
    [data, shiftId],
  );

  const demoActive = useMemo(
    () => !!data?.volunteers.some((v) => v.email.endsWith("@festival.demo.local")),
    [data],
  );

  // Slots that need a replacement: the volunteer cancelled via text or is a
  // recorded no-show for this shift.
  const needsReplacement = useMemo(
    () => assigned.filter((a) => a.confirmationStatus === "CANCELLED" || a.noShow),
    [assigned],
  );

  const getVolunteerFit = useCallback(
    (volunteerId: string, roleIds?: string[]) => {
      const sourceRoles =
        roleIds && roleIds.length > 0 ? displayedRoles.filter((r) => roleIds.includes(r.id)) : displayedRoles;
      const eligibleNames = sourceRoles
        .filter((r) => roleEligibilityMap.get(`${volunteerId}:${r.id}`)?.eligible)
        .map((r) => r.name);
      return {
        count: eligibleNames.length,
        summary: eligibleNames.length
          ? `${t("Fits")} ${eligibleNames.length}: ${eligibleNames.slice(0, 3).join(", ")}${eligibleNames.length > 3 ? "…" : ""}`
          : t("Fits 0 positions"),
      };
    },
    [displayedRoles, roleEligibilityMap, t],
  );

  function toggleRoleFilter(roleId: string) {
    setSelectedRoleFilterIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  const getRoleDropState = useCallback(
    (roleId: string): "idle" | "eligible" | "ineligible" => {
      if (!activeDragVolunteerId) return "idle";
      const eligible = roleEligibilityMap.get(`${activeDragVolunteerId}:${roleId}`)?.eligible;
      return eligible === true ? "eligible" : "ineligible";
    },
    [activeDragVolunteerId, roleEligibilityMap],
  );

  async function login() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: loginName, password }),
    });
    if (res.ok) {
      await load();
      setMessage("");
    } else {
      setMessage(t("Login failed"));
    }
  }

  async function runAutoAssign() {
    if (!shiftId) return;
    setLoading(true);
    const res = await fetch("/api/admin/auto-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId }),
    });
    const payload = await res.json();
    if (res.ok) {
      setAutoWarnings(payload.warnings ?? []);
      setMessage(
        payload.warnings?.length
          ? `${t("Autofill complete")} — ${payload.warnings.length} ${t("placement(s) need your confirmation below.")}`
          : t("Autofill complete"),
      );
    } else {
      setMessage(payload.error || t("Autofill failed"));
    }
    setLoading(false);
    await load();
  }

  async function assignSelectedFromInspector() {
    if (!selectedVolunteer || !selectedRole || !selectedShift) {
      setMessage(t("Select a volunteer and position first."));
      return;
    }
    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        volunteerId: selectedVolunteer.id,
        shiftId: selectedShift.id,
        roleId: selectedRole.id,
        forceAssign: force,
        overrideReason: force ? overrideReason : undefined,
      }),
    });
    const payload = await res.json();
    setMessage(res.ok ? payload.warning || t("Assigned.") : payload.error || t("Assignment failed"));
    await load();
  }

  async function runBulkAction(action: "clear_unlocked" | "lock_all" | "unlock_all" | "auto_assign_unfilled") {
    if (!shiftId) return;
    setLoading(true);
    const res = await fetch("/api/admin/assignments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, action }),
    });
    const payload = await res.json();
    if (res.ok) {
      if (action === "auto_assign_unfilled") setAutoWarnings(payload.warnings ?? []);
      setMessage(`${t("Done")} (${payload.count ?? 0})`);
    } else {
      setMessage(payload.error || t("Bulk action failed"));
    }
    setLoading(false);
    await load();
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/admin/assignments?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function loadReplacements(assignmentId: string, roleId: string) {
    const res = await fetch("/api/admin/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, roleId, limit: 3 }),
    });
    const payload = await res.json().catch(() => ({ suggestions: [] }));
    setReplacementSuggestions((prev) => ({ ...prev, [assignmentId]: payload.suggestions ?? [] }));
    if (!payload.suggestions?.length) setMessage(t("No eligible replacements available for this position."));
  }

  // Swap: remove the cancelled/no-show assignment, place the suggested
  // volunteer into the same position.
  async function applyReplacement(assignmentId: string, roleId: string, volunteerId: string) {
    await fetch(`/api/admin/assignments?id=${assignmentId}`, { method: "DELETE" });
    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId, shiftId, roleId }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? payload.warning || t("Replacement placed.") : payload.error || t("Replacement failed"));
    setReplacementSuggestions((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    await load();
  }

  async function enterDemoMode() {
    setLoading(true);
    const res = await fetch("/api/admin/demo", { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? `${t("Demo Mode on:")} ${payload.created ?? 0} ${t("fake volunteers")} · ${payload.flags ?? 0} ${t("flags")} · ${payload.notes ?? 0} ${t("notes")} · ${payload.triggers ?? 0} ${t("replacement triggers")}`
        : payload.error || t("Failed to load demo volunteers"),
    );
    setLoading(false);
    await load();
  }

  async function exitDemoMode() {
    setLoading(true);
    const res = await fetch("/api/admin/demo", { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${t("Demo Mode off — removed")} ${payload.deleted ?? 0} ${t("fake volunteers.")}` : payload.error || t("Failed to remove demo volunteers"));
    setLoading(false);
    await load();
  }

  async function saveShiftNote() {
    if (!shiftNoteText.trim() || !shiftId) return;
    await fetch("/api/admin/shift-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, text: shiftNoteText }),
    });
    setShiftNoteText("");
    await load();
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveDragVolunteerId("");
    if (!event.over) return;
    const active = String(event.active.id);
    const over = String(event.over.id);
    if (!active.startsWith("pool:") || !over.startsWith("role:")) return;

    const volunteerId = active.replace("pool:", "");
    const roleId = over.replace("role:", "");
    const eligibility = roleEligibilityMap.get(`${volunteerId}:${roleId}`);
    if (!eligibility?.eligible && !force) {
      setMessage(`${t("Cannot assign:")} ${eligibility?.hard.map((r) => t(r)).join(", ") || t("Not eligible for this position")}`);
      setSelectedVolunteerId(volunteerId);
      setInspectorRoleId(roleId);
      return;
    }

    const res = await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        volunteerId,
        shiftId,
        roleId,
        forceAssign: force,
        overrideReason: force ? overrideReason : undefined,
      }),
    });
    const payload = await res.json();
    setMessage(res.ok ? payload.warning || t("Assigned") : payload.error || t("Assignment failed"));
    setSelectedVolunteerId(volunteerId);
    setInspectorRoleId(roleId);
    await load();
  }

  async function toggleTraining(volunteerId: string, roleId: string, trained: boolean) {
    await fetch("/api/admin/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId, roleId, trained }),
    });
    await load();
  }

  async function toggleApproval(volunteerId: string, roleId: string, approved: boolean) {
    await fetch("/api/admin/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId, roleId, approved }),
    });
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
  }

  async function sendReminders() {
    setReminderBusy(true);
    const res = await fetch("/api/admin/send-reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: reminderDate }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? `${t("Reminders sent:")} ${payload.sent ?? 0} · ${payload.skippedAlready ?? 0} ${t("already")} · ${payload.skippedNoOptIn ?? 0} ${t("no opt-in")}`
        : payload.error || t("Failed to send reminders"),
    );
    setReminderBusy(false);
    await previewReminders(reminderDate);
    await load();
  }

  if (!authed) {
    return (
      <section className="panel mx-auto max-w-md p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/topper.svg" alt="" className="mx-auto w-24" />
        <h2 className="mt-2 text-center text-2xl font-black text-strawberry-900">{t("Staff Login")}</h2>
        <p className="mt-1 text-center text-xs text-foreground/60">{t("Schedulers, supervisors, and admins")}</p>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-bold">{t("Your name")}</span>
          <input
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            className="w-full rounded-lg border border-strawberry-200 px-3 py-2"
            placeholder={t("e.g. Trish")}
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-bold">{t("Password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void login()}
            className="w-full rounded-lg border border-strawberry-200 px-3 py-2"
          />
        </label>
        <button onClick={() => void login()} className="ops-btn ops-btn-primary mt-4 w-full px-4 py-3 text-sm">
          {t("Sign In")}
        </button>
        {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
      </section>
    );
  }

  const tabs: Array<[Tab, string, boolean]> = [
    ["coverage", "Coverage Calendar", true],
    ["schedule", "Scheduler", true],
    ["volunteers", "Volunteers", true],
    ["training", "Training & Approvals", true],
    ["supervisor", "Supervisor", true],
    ["hall", "Hall Log", true],
    ["comms", "Communication", true],
    ["analytics", "Analytics", isAdmin],
  ];

  return (
    <div className="space-y-4">
      {data && notesVolunteerId && (() => {
        const v = data.volunteers.find((x) => x.id === notesVolunteerId);
        if (!v) return null;
        return (
          <NotesEditor
            volunteer={v}
            notes={notesByVolunteer.get(v.id) ?? []}
            onClose={() => setNotesVolunteerId("")}
            onSaved={load}
          />
        );
      })()}
      {data && detailVolunteerId && (() => {
        const v = data.volunteers.find((x) => x.id === detailVolunteerId);
        if (!v) return null;
        return <VolunteerDetail volunteer={v} flags={flagsByVolunteer.get(v.id) ?? []} onClose={() => setDetailVolunteerId("")} />;
      })()}

      {demoActive && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-dashed border-strawberry-500 bg-sunny-100 px-4 py-2">
          <p className="text-sm font-black text-strawberry-700">
            🎭 {t("DEMO MODE")} — {t("fake Disney volunteers are loaded (flags, notes, and replacement triggers included). Real sign-ups are unaffected.")}
          </p>
          {isAdmin && (
            <button
              disabled={loading}
              onClick={() => void exitDemoMode()}
              className="rounded-md border border-strawberry-500 bg-card px-3 py-1.5 text-xs font-black text-strawberry-700 disabled:opacity-60"
            >
              {t("Exit Demo Mode")}
            </button>
          )}
        </div>
      )}

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs
            .filter(([, , show]) => show)
            .map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === id ? "bg-strawberry-500 text-white" : "bg-strawberry-50 text-strawberry-900"}`}
              >
                {t(label)}
              </button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-leaf-200 px-3 py-1 text-xs font-bold text-leaf-700">
            {data?.session.name} · {t(role)}
          </span>
          <Link href="/admin/print" className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            {t("Print Center")}
          </Link>
          <Link href="/admin/captain" className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            {t("Check-In Mode")}
          </Link>
          <button onClick={() => void logout()} className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            {t("Logout")}
          </button>
        </div>
      </div>

      {tab === "coverage" && data && (
        <section className="space-y-3">
          <div className="panel p-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">{t("Coverage Date")}</span>
              <select
                value={coverageDateFilter}
                onChange={(e) => setCoverageDateFilter(e.target.value)}
                className="w-full rounded-md border border-strawberry-200 px-2 py-2 md:max-w-xs"
              >
                <option value="ALL">{t("All dates")}</option>
                {allDates.map((d) => (
                  <option key={d} value={d}>
                    {format(new Date(`${d}T00:00:00`), "EEE MMM d")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(() => {
            const grouped = Object.entries(
              coverageSummary
                .filter((item) => coverageDateFilter === "ALL" || item.date === coverageDateFilter)
                .reduce<Record<string, typeof coverageSummary>>((acc, item) => {
                  if (!acc[item.date]) acc[item.date] = [];
                  acc[item.date].push(item);
                  return acc;
                }, {}),
            ).sort(([a], [b]) => (a < b ? -1 : 1));

            if (grouped.length === 0) {
              return <p className="panel p-3 text-sm">{t("No coverage rows match the current filters.")}</p>;
            }

            return grouped.map(([date, items]) => {
              const isOpen = openCoverageDate === date || coverageDateFilter === "ALL";
              return (
                <div key={date} className="panel p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenCoverageDate((current) => (current === date ? null : date))}
                      className="flex flex-1 items-center justify-between rounded-md border border-strawberry-100 bg-card px-3 py-2 text-left"
                    >
                      <span className="text-sm font-bold">{format(new Date(`${date}T00:00:00`), "EEEE, MMM d")}</span>
                      <span className="text-xs font-semibold">{items.length} {t("shifts")}</span>
                    </button>
                  </div>
                  {isOpen && (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {items.map((item) => {
                        const published = data.publishes.some((p) => p.shiftId === item.shiftId);
                        return (
                          <button
                            key={item.shiftId}
                            onClick={() => {
                              setShiftId(item.shiftId);
                              setTab("schedule");
                            }}
                            className={`rounded-lg border-2 p-3 text-left ${shiftToneClasses(item.shiftType)}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-black">{t(shiftShortLabel(item.shiftType))}</p>
                              {published && <span className="rounded-full bg-leaf-500 px-1.5 py-0.5 text-[10px] font-black text-white">✓</span>}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                              <span className="font-black">{item.filled}/{item.targets > 0 ? item.targets : "—"}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.health.className}`}>{t(item.health.label)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </section>
      )}

      {tab === "schedule" && data && (
        <section className="space-y-4">
          <div className="no-print panel p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold">{t("Send Shift Reminders")}</p>
                <p className="text-xs text-foreground/70">{t("Texts assigned volunteers who opted in. They can reply YES to confirm or NO to cancel.")}</p>
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold">{t("Date")}</span>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="rounded-md border border-strawberry-200 px-2 py-2 text-sm"
                />
              </label>
              <button
                disabled={reminderBusy || !reminderPreview || reminderPreview.eligible === 0}
                onClick={() => void sendReminders()}
                className="rounded-md bg-strawberry-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {reminderBusy ? t("Sending…") : `${t("Send")}${reminderPreview ? ` (${reminderPreview.eligible})` : ""}`}
              </button>
            </div>
            {reminderPreview && (
              <p className="mt-2 text-xs text-foreground/70">
                {reminderPreview.eligible} {t("to text")} · {reminderPreview.alreadyReminded} {t("already")} · {reminderPreview.noOptIn} {t("no opt-in")} · {reminderPreview.badPhone} {t("no valid phone")}
              </p>
            )}
          </div>

          {shiftPublished && (
            <p className="panel border-leaf-500 bg-leaf-200/40 p-3 text-sm font-semibold text-leaf-700">
              ✓ {t("This shift's schedule was published by")} {shiftPublished.publishedBy} ({format(new Date(shiftPublished.publishedAt), "MMM d HH:mm")}).
              {scheduleLocked ? ` ${t("It is locked — a supervisor or admin can unpublish it to make changes.")}` : ` ${t("You can still override as supervisor/admin.")}`}
            </p>
          )}

          {scheduleSummary && (
            <div className="panel grid gap-2 p-3 text-sm md:grid-cols-5">
              <div className="rounded-md bg-strawberry-50 px-3 py-2">
                <p className="text-xs uppercase">{t("Slots Needed")}</p>
                <p className="text-lg font-black text-strawberry-700">{scheduleSummary.totalTarget}</p>
              </div>
              <div className="rounded-md bg-leaf-200/50 px-3 py-2">
                <p className="text-xs uppercase">{t("Filled")}</p>
                <p className="text-lg font-black text-leaf-700">{scheduleSummary.assignedCount}</p>
              </div>
              <div className="rounded-md bg-amber-100 px-3 py-2">
                <p className="text-xs uppercase">{t("Unfilled")}</p>
                <p className="text-lg font-black text-amber-700">{scheduleSummary.unfilled}</p>
              </div>
              <div className="rounded-md bg-card px-3 py-2">
                <p className="text-xs uppercase">{t("Available Pool")}</p>
                <p className="text-lg font-black">{scheduleSummary.availableCount}</p>
              </div>
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs uppercase">{t("Locked")}</p>
                <p className="text-lg font-black">{scheduleSummary.lockedCount}</p>
              </div>
            </div>
          )}

          <div className="no-print sticky top-14 z-10 panel border-2 border-strawberry-100 p-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">{t("Date")}</span>
                <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  <option value="ALL">{t("All dates")}</option>
                  {allDates.map((d) => (
                    <option key={d} value={d}>{format(new Date(`${d}T00:00:00`), "EEE MMM d")}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">{t("Shift Type")}</span>
                <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  <option value="ALL">{t("All")}</option>
                  {[...new Set(data.shifts.map((s) => s.shiftType))].map((st) => (
                    <option key={st} value={st}>{t(shiftShortLabel(st))}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm xl:col-span-2">
                <span className="mb-1 block font-semibold">{t("Shift")}</span>
                <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  {filteredShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {format(new Date(s.date), "EEE MMM d")} - {t(s.label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                className="rounded-md border border-strawberry-200 px-2 py-2 text-sm md:col-span-2"
                placeholder={t("Search by Volunteer ID, name, email, phone")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className="inline-flex items-center gap-2 rounded-md border border-strawberry-200 px-2 py-2 text-xs">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> {t("Force assign")}
              </label>
              <input
                className="rounded-md border border-strawberry-200 px-2 py-2 text-sm"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("Override reason (if force)")}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">{t("Fill")}</span>
                <div className="flex flex-wrap gap-2">
                  <button disabled={loading || !shiftId || scheduleLocked} onClick={() => void runAutoAssign()} className="rounded-md bg-leaf-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {t("Run Autofill")}
                  </button>
                  <button
                    disabled={loading || !shiftId || scheduleLocked}
                    onClick={() => void runBulkAction("auto_assign_unfilled")}
                    className="rounded-md border border-leaf-500 px-3 py-2 text-sm font-semibold text-leaf-700 disabled:opacity-60"
                  >
                    {t("Fill Unfilled")}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">{t("Locks")}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={loading || !shiftId || scheduleLocked}
                    onClick={() => void runBulkAction("clear_unlocked")}
                    className="rounded-md border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60"
                  >
                    {t("Clear Unlocked")}
                  </button>
                  <button
                    disabled={loading || !shiftId || scheduleLocked}
                    onClick={() => void runBulkAction("lock_all")}
                    className="rounded-md border border-strawberry-300 px-3 py-2 text-sm disabled:opacity-60"
                  >
                    {t("Lock All")}
                  </button>
                  <button
                    disabled={loading || !shiftId || scheduleLocked}
                    onClick={() => void runBulkAction("unlock_all")}
                    className="rounded-md border border-strawberry-300 px-3 py-2 text-sm disabled:opacity-60"
                  >
                    {t("Unlock All")}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">{t("View")}</span>
                <button onClick={() => void load()} className="rounded-md border border-strawberry-300 px-3 py-2 text-sm">
                  {t("Refresh")}
                </button>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-1 rounded-lg border border-dashed border-strawberry-300 p-2 md:ml-auto">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">🎭 {t("Demo Mode")}</span>
                  <div className="flex flex-wrap gap-2">
                    {demoActive ? (
                      <button
                        disabled={loading}
                        onClick={() => void exitDemoMode()}
                        className="rounded-md border border-rose-500 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                      >
                        {t("Exit Demo Mode (remove fake volunteers)")}
                      </button>
                    ) : (
                      <button
                        disabled={loading}
                        onClick={() => void enterDemoMode()}
                        className="rounded-md border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-700 disabled:opacity-60"
                      >
                        {t("Load Demo Volunteers (Disney cast)")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {autoWarnings.length > 0 && (
            <div className="panel border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-amber-900">⚠ {t("Autofill placed these volunteers with warnings — confirm or reassign:")}</p>
                <button onClick={() => setAutoWarnings([])} className="rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-900">{t("Dismiss")}</button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {autoWarnings.map((w) => (
                  <li key={`${w.volunteerId}:${w.roleName}`}>
                    <button className="underline" onClick={() => setSelectedVolunteerId(w.volunteerId)}>
                      {w.volunteerCode}
                    </button>{" "}
                    ({w.volunteerName}) → {t(w.roleName)}: {w.warnings.join("; ")} — {t("confirm?")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {needsReplacement.length > 0 && (
            <div className="panel border-2 border-red-400 bg-red-50 p-3">
              <p className="text-sm font-black text-red-800">
                🚨 {t("Needs replacement")} ({needsReplacement.length}) — {t("these volunteers cancelled or no-showed for this shift:")}
              </p>
              <div className="mt-2 space-y-2">
                {needsReplacement.map((a) => {
                  const suggestions = replacementSuggestions[a.id];
                  return (
                    <div key={a.id} className="rounded-lg border border-red-200 bg-card p-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p>
                          <span className="font-mono text-xs font-black text-strawberry-700">
                            {a.volunteer.volunteerCode ?? a.volunteerId.slice(-6)}
                          </span>{" "}
                          <span className="font-semibold">{a.volunteer.firstName} {a.volunteer.lastName}</span>
                          {" — "}{t(a.role.name)} ·{" "}
                          <span className="font-bold text-red-700">
                            {a.confirmationStatus === "CANCELLED" ? t("cancelled via text") : t("no-show")}
                          </span>
                        </p>
                        <span className="flex gap-1.5">
                          <button
                            onClick={() => void loadReplacements(a.id, a.roleId)}
                            className="rounded-md border border-leaf-500 px-2 py-1 text-xs font-bold text-leaf-700"
                          >
                            {t("Suggest replacement")}
                          </button>
                          <button
                            onClick={() => void removeAssignment(a.id)}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-bold text-red-700"
                          >
                            {t("Remove from slot")}
                          </button>
                        </span>
                      </div>
                      {suggestions && suggestions.length > 0 && (
                        <div className="mt-2 grid gap-1.5 md:grid-cols-3">
                          {suggestions.map((s) => (
                            <button
                              key={s.volunteerId}
                              onClick={() => void applyReplacement(a.id, a.roleId, s.volunteerId)}
                              className="rounded-md border border-leaf-300 bg-leaf-200/40 p-2 text-left text-xs hover:bg-leaf-200"
                            >
                              <p>
                                <span className="font-mono font-black text-strawberry-700">{s.volunteerCode}</span>{" "}
                                <span className="font-semibold">{s.name}</span>
                              </p>
                              <p className="mt-0.5 text-foreground/70">{s.reasons.join(" · ")}</p>
                              <p className="mt-1 font-bold text-leaf-700">→ {t("Tap to place")}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="panel p-3">
            <p className="text-xs font-black uppercase tracking-wide text-foreground/60">{t("Shift notes (visible to supervisors & admins)")}</p>
            <div className="mt-1 space-y-1 text-sm">
              {currentShiftNotes.map((n) => (
                <p key={n.id} className="rounded-md bg-sunny-100 px-2 py-1">
                  {n.text} <span className="text-xs text-foreground/50">— {n.author}, {format(new Date(n.createdAt), "MMM d HH:mm")}</span>
                </p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={shiftNoteText}
                onChange={(e) => setShiftNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void saveShiftNote()}
                placeholder={t("Add a note about this shift…")}
                className="flex-1 rounded-md border border-strawberry-200 px-2 py-2 text-sm"
              />
              <button onClick={() => void saveShiftNote()} className="rounded-md border border-strawberry-300 px-3 py-2 text-sm font-semibold">
                {t("Add Note")}
              </button>
            </div>
          </div>

          {selectedShift && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => {
                const active = String(event.active.id);
                if (active.startsWith("pool:")) setActiveDragVolunteerId(active.replace("pool:", ""));
              }}
              onDragCancel={() => setActiveDragVolunteerId("")}
              onDragEnd={onDragEnd}
            >
              <div className="grid gap-4 xl:grid-cols-[280px_1fr_300px]">
                <div className="panel xl:col-span-3 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">{t("Position Legend")}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded border border-strawberry-200 bg-card px-2 py-0.5">
                        {t("Filter:")} {selectedRoleFilterIds.length === 0 ? t("All positions") : `${selectedRoleFilterIds.length} ${t("selected")}`}
                      </span>
                      {selectedRoleFilterIds.length > 0 && (
                        <button type="button" onClick={() => setSelectedRoleFilterIds([])} className="rounded border border-strawberry-300 px-2 py-0.5">
                          {t("Clear")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayedRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setInspectorRoleId(r.id);
                          toggleRoleFilter(r.id);
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                          selectedRoleFilterIds.includes(r.id)
                            ? "border-leaf-500 bg-leaf-200/40 ring-1 ring-leaf-500"
                            : inspectorRoleId === r.id
                              ? "border-cyan-500 bg-cyan-100/30"
                              : "border-strawberry-200 bg-card"
                        }`}
                      >
                        {t(r.name)}
                      </button>
                    ))}
                  </div>
                </div>

                <aside className="panel no-print p-3">
                  <h3 className="font-semibold">{t("Available Pool")}</h3>
                  <p className="mb-2 text-xs text-foreground/85">
                    {t("Sorted by legacy score, then sign-up time. Drag onto a green position; red positions are blocked by a hard rule.")}
                  </p>
                  <input
                    className="mb-2 w-full rounded-md border border-strawberry-200 px-2 py-2 text-xs"
                    placeholder={t("Search pool")}
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                  />
                  <div className="max-h-[40rem] space-y-2 overflow-auto">
                    {availablePool.map((vol) => (
                      <div key={vol.id} onClick={() => setSelectedVolunteerId(vol.id)}>
                        <PoolCard
                          volunteer={vol}
                          selected={selectedVolunteerId === vol.id}
                          fitSummary={getVolunteerFit(vol.id, selectedRoleFilterIds).summary}
                          reliability={reliabilityInfo(reliabilityByVolunteer.get(vol.id))}
                          flagCount={(flagsByVolunteer.get(vol.id) ?? []).length}
                        />
                      </div>
                    ))}
                    {availablePool.length === 0 && (
                      <p className="text-xs text-foreground/90">{t("No available volunteers after filters.")}</p>
                    )}
                  </div>
                </aside>

                <div className="columns-1 gap-2 md:columns-2 xl:columns-3">
                  {displayedRoles.map((r) => {
                    const roleAssigned = assigned.filter((a) => a.roleId === r.id);
                    const target = roleTargets.find((rt) => rt.roleId === r.id)?.target || 0;
                    return (
                      <RoleColumn
                        key={r.id}
                        role={r}
                        count={roleAssigned.length}
                        target={target}
                        selected={inspectorRoleId === r.id}
                        onSelect={() => {
                          setInspectorRoleId(r.id);
                          toggleRoleFilter(r.id);
                        }}
                        dropState={getRoleDropState(r.id)}
                      >
                        {roleAssigned.map((a) => {
                          const vol = data.volunteers.find((v) => v.id === a.volunteerId);
                          const hard = vol ? hardReasonsFor(vol, r) : [];
                          const soft = vol ? softWarningsFor(vol, r) : [];
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setSelectedVolunteerId(a.volunteerId);
                                setInspectorRoleId(r.id);
                              }}
                              className={`flex w-full items-center justify-between gap-1 rounded border px-2 py-1 text-left text-xs ${
                                hard.length > 0 ? "border-red-400 bg-red-50" : "border-strawberry-100 bg-card"
                              } ${selectedVolunteerId === a.volunteerId ? "ring-1 ring-leaf-500" : ""}`}
                            >
                              <span className="truncate">
                                <span className="font-mono font-bold text-strawberry-700">{vol?.volunteerCode ?? a.volunteerId.slice(-6)}</span>
                                <span className="ml-1 text-foreground/70">{a.volunteer.firstName}</span>
                                {a.confirmationStatus === "CONFIRMED" && <span title={t("Confirmed via text")} className="ml-1 text-emerald-600">✓</span>}
                                {a.confirmationStatus === "CANCELLED" && <span title={t("Cancelled via text")} className="ml-1 font-bold text-rose-600">✕</span>}
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                {hard.length > 0 && (
                                  <span className="rounded bg-red-500 px-1 py-0.5 text-[9px] font-black text-white" title={hard.join("; ")}>
                                    {t("RULE")}
                                  </span>
                                )}
                                {hard.length === 0 && soft.length > 0 && (
                                  <span className="rounded bg-amber-300 px-1 py-0.5 text-[9px] font-black text-amber-950" title={soft.join("; ")}>
                                    ⚠
                                  </span>
                                )}
                                {a.locked && <span title={t("Locked")}>🔒</span>}
                                {!scheduleLocked && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void removeAssignment(a.id);
                                    }}
                                    className="rounded border border-strawberry-200 px-1 text-[10px] text-strawberry-700"
                                    title={t("Remove from this position")}
                                  >
                                    ✕
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </RoleColumn>
                    );
                  })}
                </div>

                <aside className="panel p-3">
                  <h3 className="font-semibold">{t("Inspector")}</h3>
                  {!selectedVolunteer ? (
                    <p className="mt-2 text-xs text-foreground/90">{t("Select a volunteer card to inspect eligibility and today's assignments.")}</p>
                  ) : (
                    <div className="mt-2 space-y-2 text-xs">
                      <p className="font-mono text-sm font-black text-strawberry-700">{selectedVolunteer.volunteerCode}</p>
                      <p className="font-semibold">
                        {selectedVolunteer.firstName} {selectedVolunteer.lastName}
                        <button onClick={() => setDetailVolunteerId(selectedVolunteer.id)} className="ml-2 rounded border border-strawberry-200 px-1.5 py-0.5 text-[10px] underline">
                          {t("full info")}
                        </button>
                        <button onClick={() => setNotesVolunteerId(selectedVolunteer.id)} className="ml-1 rounded border border-strawberry-200 px-1.5 py-0.5 text-[10px] underline">
                          {t("notes")} ({(notesByVolunteer.get(selectedVolunteer.id) ?? []).length})
                        </button>
                      </p>
                      <p className="rounded border border-leaf-300 bg-leaf-200/30 px-2 py-1">
                        {t("Legacy score:")} <strong>{selectedVolunteer.yearsExperience}</strong> · {t("signed up")} {format(new Date(selectedVolunteer.createdAt), "MMM d HH:mm")}
                      </p>
                      {(flagsByVolunteer.get(selectedVolunteer.id) ?? []).length > 0 && (
                        <div className="rounded border border-amber-300 bg-amber-50 p-2">
                          <p className="font-bold text-amber-900">{t("Sign-up flags")}</p>
                          {(flagsByVolunteer.get(selectedVolunteer.id) ?? []).map((f) => (
                            <p key={f.id} className="text-amber-950">⚑ {f.detail ?? f.type}</p>
                          ))}
                        </div>
                      )}
                      {selectedRole && (
                        <div className="rounded border border-leaf-300 bg-leaf-200/40 p-2">
                          <p className="font-semibold">{t("Selected Position")}</p>
                          <p>{t(selectedRole.name)}</p>
                          {selectedRole.physicalDemands && <p className="mt-0.5 text-foreground/70">{t(selectedRole.physicalDemands)}</p>}
                          <p className="mt-1">{t("Minimum age:")} {selectedRole.minAge > 0 ? selectedRole.minAge : t("none")}</p>
                          {selectedRole.liftLimitLbs > 0 && <p>{t("Lifting:")} {selectedRole.liftLimitLbs} lbs</p>}
                          <p>{t("Gender:")} {selectedRole.requiredGender ? (selectedRole.requiredGender === "FEMALE" ? t("Female only") : t("Male only")) : t("Any")}</p>
                        </div>
                      )}
                      {selectedRole && (() => {
                        const elig = roleEligibilityMap.get(`${selectedVolunteer.id}:${selectedRole.id}`);
                        return (
                          <div className={`rounded border p-2 ${elig?.eligible ? (elig.soft.length ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50") : "border-red-300 bg-red-50"}`}>
                            <p className="font-semibold">{t("Placement Check")}</p>
                            {!elig || elig.eligible ? (
                              elig && elig.soft.length > 0 ? (
                                <ul className="list-disc pl-4 text-amber-900">
                                  {elig.soft.map((w) => (
                                    <li key={w}>{t(w)} — {t("allowed, please confirm")}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-green-700">{t("Good to go for this position and shift.")}</p>
                              )
                            ) : (
                              <ul className="list-disc pl-4 text-red-800">
                                {elig.hard.map((rr) => (
                                  <li key={rr}>{t(rr)}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                      {selectedRole && !scheduleLocked && (
                        <button
                          type="button"
                          onClick={() => void assignSelectedFromInspector()}
                          className="w-full rounded-md bg-strawberry-500 px-3 py-2 text-xs font-semibold text-white"
                        >
                          {t("Assign to")} {t(selectedRole.name)}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="mt-4 rounded-md border border-strawberry-100 bg-strawberry-50/70 p-2">
                    <p className="text-xs font-semibold">{t("Recent Activity")}</p>
                    <div className="mt-2 max-h-44 space-y-1 overflow-auto text-xs">
                      {data.auditLogs.length === 0 ? (
                        <p>{t("No audit entries yet.")}</p>
                      ) : (
                        data.auditLogs.slice(0, 20).map((log) => (
                          <div key={log.id} className="rounded border border-strawberry-100 bg-card px-2 py-1">
                            <p className="font-semibold">{log.action}</p>
                            <p className="text-foreground/70">{log.entityType} {log.details ? `• ${log.details}` : ""}</p>
                            <p className="text-foreground/70">{format(new Date(log.createdAt), "MMM d HH:mm")}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </DndContext>
          )}
        </section>
      )}

      {tab === "volunteers" && data && (
        <section className="panel p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{t("Volunteer Database")}</h2>
              <p className="text-xs text-foreground/70">
                {t("Showing")} {roster.length} {t("of")} {data.volunteers.length} · {t("Volunteer ID first — tap a row for personal info")}
              </p>
            </div>
            <input
              className="w-full max-w-xs rounded-md border border-strawberry-200 px-3 py-2 text-sm"
              placeholder={t("Search ID / name / email / phone")}
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                  <th className="p-2">{t("Volunteer ID")}</th>
                  <th className="p-2">{t("Name")}</th>
                  <th className="p-2 text-center">{t("Legacy")}</th>
                  <th className="p-2">{t("Tier")}</th>
                  <th className="p-2">{t("Flags")}</th>
                  <th className="p-2 text-center">{t("Avail")}</th>
                  <th className="p-2 text-center">{t("Assigned")}</th>
                  <th className="p-2">{t("Reliability")}</th>
                  <th className="p-2">{t("Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((v) => {
                  const flags = flagsByVolunteer.get(v.id) ?? [];
                  const notes = notesByVolunteer.get(v.id) ?? [];
                  const tier = seniorityTier(v.yearsExperience);
                  return (
                    <tr key={v.id} className="border-b border-strawberry-50 align-top">
                      <td className="p-2">
                        <button onClick={() => setDetailVolunteerId(v.id)} className="font-mono text-xs font-black text-strawberry-700 underline">
                          {v.volunteerCode ?? v.id.slice(-6)}
                        </button>
                      </td>
                      <td className="p-2 font-semibold">
                        <button onClick={() => setDetailVolunteerId(v.id)} className="text-left hover:underline">
                          {v.firstName} {v.lastName}
                        </button>
                        {v.firstTimeVolunteer && <span className="ml-1 rounded bg-sunny-100 px-1.5 py-0.5 text-[10px] font-bold text-sunny-600">{t("1st year")}</span>}
                      </td>
                      <td className="p-2 text-center tabular-nums">{v.yearsExperience}</td>
                      <td className="p-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tier.className}`}>
                          <span aria-hidden>{tier.emoji}</span> {t(tier.label)}
                        </span>
                      </td>
                      <td className="p-2">
                        {flags.length === 0 ? (
                          <span className="text-xs text-foreground/40">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((f) => (
                              <span key={f.id} className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-950" title={f.detail ?? ""}>
                                {f.type.replaceAll("_", " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center tabular-nums">{volunteerCounts.availByVolunteer.get(v.id) ?? 0}</td>
                      <td className="p-2 text-center tabular-nums">{volunteerCounts.assignByVolunteer.get(v.id) ?? 0}</td>
                      <td className="p-2">
                        {(() => {
                          const info = reliabilityInfo(reliabilityByVolunteer.get(v.id));
                          return (
                            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
                              <span aria-hidden>{info.emoji}</span> {t(info.label)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2">
                        <button onClick={() => setNotesVolunteerId(v.id)} className="rounded-md border border-strawberry-200 px-2 py-1 text-xs font-semibold">
                          {notes.length > 0 ? `📝 ${notes.length}` : t("+ note")}
                        </button>
                        {notes.some((n) => n.category === "DO_NOT_SCHEDULE") && (
                          <span className="ml-1 rounded bg-strawberry-500 px-1.5 py-0.5 text-[10px] font-black text-white">{t("DNS")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-foreground/60">
                      {t("No volunteers match your search.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "training" && data && (() => {
        const gatedRoles = data.roles.filter((r) => r.requiresTraining || r.requiresApproval);
        return (
          <section className="panel p-3">
            <div className="mb-3">
              <h2 className="text-lg font-bold">{t("Training & Approvals")}</h2>
              <p className="text-xs text-foreground/70">
                {gatedRoles.length === 0
                  ? t("No positions currently require training or approval.")
                  : `${t("Positions needing sign-off:")} ${gatedRoles.map((r) => t(r.name)).join(", ")}`}
              </p>
            </div>
            {gatedRoles.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                      <th className="p-2">{t("Volunteer")}</th>
                      {gatedRoles.map((r) => (
                        <th key={r.id} className="p-2 text-center">{t(r.name)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.volunteers.map((v) => (
                      <tr key={v.id} className="border-b border-strawberry-50">
                        <td className="p-2 font-semibold">
                          <span className="font-mono text-xs font-bold text-strawberry-700">{v.volunteerCode}</span> {v.firstName} {v.lastName}
                        </td>
                        {gatedRoles.map((r) => {
                          const trained = data.trainings.find((tr) => tr.volunteerId === v.id && tr.roleId === r.id)?.trained || false;
                          const approved = data.approvals.find((a) => a.volunteerId === v.id && a.roleId === r.id)?.approved || false;
                          return (
                            <td key={r.id} className="p-2">
                              <div className="flex items-center justify-center gap-3 text-xs">
                                {r.requiresTraining && (
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" checked={trained} onChange={(e) => void toggleTraining(v.id, r.id, e.target.checked)} />
                                    <span className="text-foreground/70">{t("Trained")}</span>
                                  </label>
                                )}
                                {r.requiresApproval && (
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" checked={approved} onChange={(e) => void toggleApproval(v.id, r.id, e.target.checked)} />
                                    <span className="text-foreground/70">{t("Approved")}</span>
                                  </label>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

      {tab === "supervisor" && data && (
        <SupervisorTab
          data={data}
          canPublish={isSupervisorPlus}
          onOpenShift={(id) => {
            setShiftId(id);
            setTab("schedule");
          }}
          onPublished={(id) => {
            setCommsPrefillShiftId(id);
            setTab("comms");
          }}
          reload={load}
        />
      )}

      {tab === "hall" && <HallLogTab />}

      {tab === "comms" && data && <CommsTab data={data} prefillShiftId={commsPrefillShiftId} canSend={isSupervisorPlus} />}

      {tab === "analytics" && data && isAdmin && <AnalyticsTab data={data} />}

      {message && <p className="rounded-md bg-strawberry-50 px-3 py-2 text-sm">{message}</p>}
    </div>
  );
}
