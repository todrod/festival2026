"use client";

import type { Role, Volunteer } from "@prisma/client";
import { DndContext, type DragEndEvent, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminDataResponse } from "@/types/app";
import { seniorityTier } from "@/lib/seniority";
import { isUnexcusedAbsence } from "@/lib/absence";

type Tab = "coverage" | "schedule" | "training" | "volunteers";
type ModuleFilter = "ALL" | "BOOTH" | "HALL";
type ShiftFilter = "ALL" | string;

function formatShiftTypeLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shiftSortWeight(shiftType: string) {
  const order = [
    "BOOTH_DAY",
    "BOOTH_NIGHT",
    "HALL_EARLY_SETUP",
    "HALL_BERRY_HULLERS",
    "HALL_BERRY_PRODUCTION",
    "HALL_UNIFORMS_AM",
    "HALL_HEAVY_HALL",
    "HALL_UNIFORMS_PM",
    "HALL_BUCKET_WASHERS",
    "HALL_DRIVERS",
  ];
  const idx = order.indexOf(shiftType);
  return idx === -1 ? 999 : idx;
}

function shiftToneClasses(shiftType: string) {
  const base = "bg-slate-950 text-white border";
  if (shiftType === "BOOTH_DAY") return `${base} border-amber-400/80`;
  if (shiftType === "BOOTH_NIGHT") return `${base} border-fuchsia-400/80`;
  if (shiftType === "HALL_EARLY_SETUP") return `${base} border-sky-400/80`;
  if (shiftType.includes("UNIFORMS")) return `${base} border-indigo-400/80`;
  if (shiftType.includes("BERRY")) return `${base} border-pink-400/80`;
  if (shiftType === "HALL_HEAVY_HALL") return `${base} border-orange-400/80`;
  if (shiftType === "HALL_BUCKET_WASHERS") return `${base} border-teal-400/80`;
  return `${base} border-strawberry-300/80`;
}

function shiftDescription(shiftType: string) {
  const map: Record<string, string> = {
    BOOTH_DAY: "Main daytime booth service window.",
    BOOTH_NIGHT: "Evening booth operations and closeout.",
    HALL_EARLY_SETUP: "Early setup before service starts.",
    HALL_BERRY_HULLERS: "Berry hulling prep line until complete.",
    HALL_BERRY_PRODUCTION: "Berry production workflow until complete.",
    HALL_UNIFORMS_AM: "Morning uniform issue and tracking.",
    HALL_UNIFORMS_PM: "Afternoon/evening uniform support.",
    HALL_HEAVY_HALL: "Heavy-lift hall support shift.",
    HALL_BUCKET_WASHERS: "Night bucket wash and reset.",
    HALL_DRIVERS: "Manual assignment only (times TBD).",
  };
  return map[shiftType] || "Festival shift block.";
}

function PoolCard({
  volunteer,
  selected,
  volunteerCode,
  fitSummary,
  reliability,
}: {
  volunteer: Volunteer;
  selected: boolean;
  volunteerCode: string;
  fitSummary: string;
  reliability: ReturnType<typeof reliabilityInfo>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool:${volunteer.id}`,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      {...attributes}
      {...listeners}
      className={`w-full cursor-grab rounded-md border px-2 py-2 text-left text-xs ${isDragging ? "opacity-50" : ""} ${selected ? "border-leaf-500 bg-leaf-200/60 text-foreground dark:bg-leaf-700/40" : "border-strawberry-200 bg-card text-foreground"}`}
    >
      <div className="font-semibold">
        {volunteer.firstName} {volunteer.lastName}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-xs text-foreground/85">{volunteer.phone}</span>
        {(() => {
          const t = seniorityTier(volunteer.yearsExperience);
          return (
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.className}`} title={`${t.blurb} (${volunteer.yearsExperience} yr)`}>
              <span aria-hidden>{t.emoji}</span> {t.label}
            </span>
          );
        })()}
      </div>
      <div className="mt-0.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${reliability.className}`}
          title={reliability.assigned > 0 ? `${reliability.attended} checked in · ${reliability.noShows} no-show` : "No shifts yet"}
        >
          <span aria-hidden>{reliability.emoji}</span> {reliability.label}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="rounded bg-strawberry-100 px-1.5 py-0.5 text-xs font-semibold text-foreground dark:bg-strawberry-100/35">
          {volunteerCode}
        </span>
        <span className="truncate text-xs text-foreground/85" title={fitSummary}>
          {fitSummary}
        </span>
      </div>
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
  if (target <= 0) return { label: "No target", className: "bg-white text-slate-900 border border-slate-300" };
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
  roleCode,
  dropState,
  children,
}: {
  role: Role;
  count: number;
  target: number;
  selected: boolean;
  onSelect: () => void;
  roleCode: string;
  dropState: "idle" | "eligible" | "ineligible";
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `role:${role.id}`, disabled: dropState === "ineligible" });
  const health = roleHealth(count, target);
  return (
    <div
      ref={setNodeRef}
      className={`mb-1.5 break-inside-avoid rounded-lg border p-2 ${
        dropState === "eligible"
          ? "border-green-500 bg-green-100/50 dark:bg-green-900/20"
          : dropState === "ineligible"
            ? "border-red-500 bg-red-100/40 dark:bg-red-900/20"
            : isOver
              ? "border-leaf-500 bg-leaf-200/30"
              : "border-strawberry-100"
      } ${selected ? "ring-2 ring-leaf-500" : ""}`}
    >
      <button type="button" className="mb-2 flex w-full items-center justify-between text-left" onClick={onSelect}>
        <h3 className="text-sm font-semibold">
          {role.name} <span className="text-xs opacity-70">({roleCode})</span>
        </h3>
        <span className="rounded-full bg-strawberry-100 px-2 py-0.5 text-xs text-foreground dark:bg-strawberry-100/35">
          {count}/{target}
        </span>
      </button>
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${health.className}`}>{health.label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function AdminDashboard() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [tab, setTab] = useState<Tab>("coverage");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<AdminDataResponse | null>(null);
  const [shiftId, setShiftId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("ALL");
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>("ALL");
  const [search, setSearch] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [force, setForce] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>("");
  const [inspectorRoleId, setInspectorRoleId] = useState<string>("");
  const [selectedRoleFilterIds, setSelectedRoleFilterIds] = useState<string[]>([]);
  const [roleSuggestions, setRoleSuggestions] = useState<Array<{ volunteerId: string; name: string; score: number; reasons: string[] }>>([]);
  const [activeDragVolunteerId, setActiveDragVolunteerId] = useState<string>("");
  const [coverageDateFilter, setCoverageDateFilter] = useState<string>("ALL");
  const [coverageModuleFilter, setCoverageModuleFilter] = useState<ModuleFilter>("ALL");
  const [openCoverageDate, setOpenCoverageDate] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setData(null);
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setMessage(`Failed to load admin data (${res.status}). ${text ? "See server logs." : ""}`);
      return;
    }

    let payload: AdminDataResponse;
    try {
      payload = (await res.json()) as AdminDataResponse;
    } catch {
      setMessage("Failed to parse admin response. Check server/API error logs.");
      return;
    }
    setData(payload);
    if (!shiftId && payload.shifts[0]) setShiftId(payload.shifts[0].id);
    setAuthed(true);
  }, [shiftId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (moduleFilter !== "ALL" && s.module !== moduleFilter) return false;
      if (shiftFilter !== "ALL" && s.shiftType !== shiftFilter) return false;
      return true;
    });
  }, [data, moduleFilter, selectedDate, shiftFilter]);

  useEffect(() => {
    if (!filteredShifts.length) return;
    if (!filteredShifts.some((s) => s.id === shiftId)) {
      setShiftId(filteredShifts[0].id);
    }
  }, [filteredShifts, shiftId]);

  useEffect(() => {
    if (coverageDateFilter !== "ALL") {
      setOpenCoverageDate(coverageDateFilter);
    } else {
      setOpenCoverageDate(null);
    }
  }, [coverageDateFilter]);

  const selectedShift = useMemo(() => data?.shifts.find((s) => s.id === shiftId) ?? null, [data, shiftId]);
  const roleTargets = useMemo(() => (data ? data.roleTargets.filter((r) => r.shiftId === shiftId) : []), [data, shiftId]);

  const displayedRoles = useMemo(() => {
    if (!data || !selectedShift) return [];
    const roleIds = new Set(roleTargets.map((r) => r.roleId));
    if (selectedShift.module === "BOOTH" && roleIds.size > 0) {
      return data.roles.filter((r) => roleIds.has(r.id));
    }
    return data.roles.filter((r) => r.module === selectedShift.module && !r.manualOnly);
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

  const selectedVolunteerAssignmentsToday = useMemo(() => {
    if (!data || !selectedVolunteer || !selectedShift) return [];
    const shiftDate = format(new Date(selectedShift.date), "yyyy-MM-dd");
    return data.assignments.filter(
      (a) =>
        a.volunteerId === selectedVolunteer.id &&
        format(new Date(a.shift.date), "yyyy-MM-dd") === shiftDate,
    );
  }, [data, selectedShift, selectedVolunteer]);

  const availabilitySet = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.availability.filter((a) => a.shiftId === shiftId).map((a) => a.volunteerId));
  }, [data, shiftId]);

  const roleCodeMap = useMemo(() => {
    const m = new Map<string, string>();
    displayedRoles.forEach((role, idx) => m.set(role.id, `R${idx + 1}`));
    return m;
  }, [displayedRoles]);

  const volunteerCodeMap = useMemo(() => {
    if (!data) return new Map<string, string>();
    const m = new Map<string, string>();
    data.volunteers.forEach((v, idx) => {
      const short = v.id.slice(-3).toUpperCase();
      m.set(v.id, `V${String(idx + 1).padStart(3, "0")}-${short}`);
    });
    return m;
  }, [data]);

  const roleEligibilityMap = useMemo(() => {
    const map = new Map<string, { eligible: boolean; reasons: string[] }>();
    if (!data || !selectedShift) return map;
    const shiftDay = format(new Date(selectedShift.date), "yyyy-MM-dd");

    for (const volunteer of data.volunteers) {
      const ack = volunteer.acknowledgement;
      for (const role of displayedRoles) {
        const reasons: string[] = [];

        if (!availabilitySet.has(volunteer.id)) reasons.push("Not available");
        if (role.requiredGender && volunteer.gender !== role.requiredGender) reasons.push("Gender mismatch");
        if (role.requiresStanding && !ack?.standingWalking) reasons.push("No standing ack");
        if (role.requiresHeavyLift && !ack?.heavyLift50) reasons.push("No heavy ack");
        if (role.requiresCash && !ack?.cashHandling) reasons.push("No cash ack");
        if (role.requiresOutdoor && !ack?.outdoorSun) reasons.push("No outdoor ack");

        if (role.requiresTraining) {
          const trained = data.trainings.find((t) => t.volunteerId === volunteer.id && t.roleId === role.id)?.trained || false;
          if (!trained) reasons.push("Training required");
        }
        if (role.requiresApproval) {
          const approved = data.approvals.find((a) => a.volunteerId === volunteer.id && a.roleId === role.id)?.approved || false;
          if (!approved) reasons.push("Approval required");
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
          if (aStart < sEnd && sStart < aEnd) reasons.push("Time conflict");
          if (
            (a.shift.shiftType === "BOOTH_DAY" && selectedShift.shiftType === "BOOTH_NIGHT") ||
            (a.shift.shiftType === "BOOTH_NIGHT" && selectedShift.shiftType === "BOOTH_DAY")
          ) {
            reasons.push("Booth day/night conflict");
          }
        }

        map.set(`${volunteer.id}:${role.id}`, { eligible: reasons.length === 0, reasons });
      }
    }
    return map;
  }, [availabilitySet, data, displayedRoles, selectedShift]);

  const availablePool = useMemo(() => {
    if (!data || !selectedShift) return [];
    const availableVolunteerIds = new Set(data.availability.filter((a) => a.shiftId === shiftId).map((a) => a.volunteerId));
    const assignedIds = new Set(assigned.map((a) => a.volunteerId));
    const q = `${search} ${poolSearch}`.trim().toLowerCase();

    const basePool = data.volunteers
      .filter((v) => availableVolunteerIds.has(v.id) && !assignedIds.has(v.id))
      .filter((v) => {
        if (!q) return true;
        const full = `${v.firstName} ${v.lastName}`.toLowerCase();
        return full.includes(q) || v.email.toLowerCase().includes(q) || v.phone.toLowerCase().includes(q);
      });
    if (selectedRoleFilterIds.length === 0) return basePool;
    return basePool.filter((v) =>
      selectedRoleFilterIds.some((roleId) => roleEligibilityMap.get(`${v.id}:${roleId}`)?.eligible),
    );
  }, [assigned, data, poolSearch, roleEligibilityMap, search, selectedRoleFilterIds, selectedShift, shiftId]);

  const roleForAttention = useMemo(() => {
    if (selectedRole) return selectedRole;
    return displayedRoles[0] || null;
  }, [displayedRoles, selectedRole]);

  const needsAttention = useMemo(() => {
    if (!data || !selectedShift || !roleForAttention) return [] as Array<{ volunteer: Volunteer; reasons: string[] }>;
    const shiftDay = format(new Date(selectedShift.date), "yyyy-MM-dd");
    const assignedIds = new Set(assigned.map((a) => a.volunteerId));

    const pool = data.volunteers.filter((v) => availabilitySet.has(v.id) && !assignedIds.has(v.id));
    const records = pool
      .map((volunteer) => {
        const reasons: string[] = [];
        const ack = volunteer.acknowledgement;
        if (roleForAttention.requiredGender && volunteer.gender !== roleForAttention.requiredGender) {
          reasons.push(`Gender mismatch (${roleForAttention.requiredGender})`);
        }
        if (roleForAttention.requiresStanding && !ack?.standingWalking) reasons.push("Missing standing ack");
        if (roleForAttention.requiresHeavyLift && !ack?.heavyLift50) reasons.push("Missing heavy-lift ack");
        if (roleForAttention.requiresCash && !ack?.cashHandling) reasons.push("Missing cash ack");
        if (roleForAttention.requiresOutdoor && !ack?.outdoorSun) reasons.push("Missing outdoor ack");

        if (roleForAttention.requiresTraining) {
          const trained = data.trainings.find((t) => t.volunteerId === volunteer.id && t.roleId === roleForAttention.id)?.trained || false;
          if (!trained) reasons.push("Training required");
        }
        if (roleForAttention.requiresApproval) {
          const approved = data.approvals.find((a) => a.volunteerId === volunteer.id && a.roleId === roleForAttention.id)?.approved || false;
          if (!approved) reasons.push("Approval required");
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
          if (aStart < sEnd && sStart < aEnd) reasons.push("Time overlap conflict");
          if (
            (a.shift.shiftType === "BOOTH_DAY" && selectedShift.shiftType === "BOOTH_NIGHT") ||
            (a.shift.shiftType === "BOOTH_NIGHT" && selectedShift.shiftType === "BOOTH_DAY")
          ) {
            reasons.push("Booth day/night same date rule");
          }
        }

        return { volunteer, reasons };
      })
      .filter((x) => x.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length);

    return records.slice(0, 10);
  }, [assigned, availabilitySet, data, roleForAttention, selectedShift]);

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
      const full = `${v.firstName} ${v.lastName}`.toLowerCase();
      return full.includes(q) || v.email.toLowerCase().includes(q) || v.phone.toLowerCase().includes(q);
    });
  }, [data, rosterSearch]);

  const scheduleSummary = useMemo(() => {
    if (!selectedShift) return null;
    const totalTarget = roleTargets.reduce((sum, t) => sum + t.target, 0);
    const assignedCount = assigned.length;
    const unfilled = Math.max(0, totalTarget - assignedCount);
    const lockedCount = assigned.filter((a) => a.locked).length;
    return {
      totalTarget,
      assignedCount,
      unfilled,
      availableCount: availablePool.length,
      lockedCount,
    };
  }, [assigned, availablePool.length, roleTargets, selectedShift]);

  const eligibilityReasons = useMemo(() => {
    if (!selectedVolunteer || !selectedRole || !selectedShift || !data) return [] as string[];
    const reasons: string[] = [];
    const ack = selectedVolunteer.acknowledgement;

    if (!availabilitySet.has(selectedVolunteer.id)) reasons.push("Not marked available for this shift.");
    if (selectedRole.requiredGender && selectedVolunteer.gender !== selectedRole.requiredGender) {
      reasons.push(`Requires gender: ${selectedRole.requiredGender}.`);
    }
    if (selectedRole.requiresStanding && !ack?.standingWalking) reasons.push("Missing standing/walking acknowledgement.");
    if (selectedRole.requiresHeavyLift && !ack?.heavyLift50) reasons.push("Missing heavy-lift acknowledgement.");
    if (selectedRole.requiresCash && !ack?.cashHandling) reasons.push("Missing cash-handling acknowledgement.");
    if (selectedRole.requiresOutdoor && !ack?.outdoorSun) reasons.push("Missing outdoor/sun acknowledgement.");

    if (selectedRole.requiresTraining) {
      const trained = data.trainings.find((t) => t.volunteerId === selectedVolunteer.id && t.roleId === selectedRole.id)?.trained || false;
      if (!trained) reasons.push("Training required but not completed.");
    }
    if (selectedRole.requiresApproval) {
      const approved = data.approvals.find((a) => a.volunteerId === selectedVolunteer.id && a.roleId === selectedRole.id)?.approved || false;
      if (!approved) reasons.push("Approval required but not granted.");
    }

    const shiftDay = format(new Date(selectedShift.date), "yyyy-MM-dd");
    const volunteerDayAssignments = data.assignments.filter(
      (a) => a.volunteerId === selectedVolunteer.id && format(new Date(a.shift.date), "yyyy-MM-dd") === shiftDay,
    );

    for (const a of volunteerDayAssignments) {
      if (a.shiftId === selectedShift.id) continue;
      const aStart = new Date(a.shift.conflictStartAt).getTime();
      const aEnd = new Date(a.shift.conflictEndAt).getTime();
      const sStart = new Date(selectedShift.conflictStartAt).getTime();
      const sEnd = new Date(selectedShift.conflictEndAt).getTime();
      const overlaps = aStart < sEnd && sStart < aEnd;
      if (overlaps) reasons.push(`Time overlap with existing assignment: ${a.shift.label} (${a.role.name}).`);
      const boothDual =
        (a.shift.shiftType === "BOOTH_DAY" && selectedShift.shiftType === "BOOTH_NIGHT") ||
        (a.shift.shiftType === "BOOTH_NIGHT" && selectedShift.shiftType === "BOOTH_DAY");
      if (boothDual) reasons.push("Cannot assign Booth Day and Booth Night on the same date.");
    }

    return reasons;
  }, [availabilitySet, data, selectedRole, selectedShift, selectedVolunteer]);

  const getVolunteerFit = useCallback(
    (volunteerId: string, roleIds?: string[]) => {
      const sourceRoles =
        roleIds && roleIds.length > 0
          ? displayedRoles.filter((role) => roleIds.includes(role.id))
          : displayedRoles;
      const eligibleCodes = sourceRoles
        .filter((role) => roleEligibilityMap.get(`${volunteerId}:${role.id}`)?.eligible)
        .map((role) => roleCodeMap.get(role.id) || role.name);
      return {
        count: eligibleCodes.length,
        codes: eligibleCodes,
        summary: eligibleCodes.length ? `Fits ${eligibleCodes.length}: ${eligibleCodes.slice(0, 4).join(", ")}${eligibleCodes.length > 4 ? "…" : ""}` : "Fits 0 roles",
      };
    },
    [displayedRoles, roleCodeMap, roleEligibilityMap],
  );

  function toggleRoleFilter(roleId: string) {
    setSelectedRoleFilterIds((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  const getRoleDropState = useCallback(
    (roleId: string): "idle" | "eligible" | "ineligible" => {
      if (!activeDragVolunteerId) return "idle";
      const eligible = roleEligibilityMap.get(`${activeDragVolunteerId}:${roleId}`)?.eligible;
      if (eligible === true) return "eligible";
      return "ineligible";
    },
    [activeDragVolunteerId, roleEligibilityMap],
  );

  async function login() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      await load();
      setMessage("");
    } else {
      setMessage("Login failed");
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
    setMessage(res.ok ? "Auto-assignment complete" : payload.error || "Auto-assignment failed");
    setLoading(false);
    await load();
  }

  async function assignSelectedFromInspector() {
    if (!selectedVolunteer || !selectedRole || !selectedShift) {
      setMessage("Select a volunteer and role first.");
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
    setMessage(res.ok ? payload.warning || "Assigned from inspector." : payload.error || "Assignment failed");
    await load();
  }

  async function loadSuggestionsForRole() {
    if (!selectedShift || !selectedRole) {
      setMessage("Select a shift and role first.");
      return;
    }
    const res = await fetch("/api/admin/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: selectedShift.id, roleId: selectedRole.id, limit: 3 }),
    });
    const payload = await res.json().catch(() => ({ suggestions: [] }));
    if (!res.ok) {
      setMessage(payload.error || "Failed to load suggestions");
      return;
    }
    setRoleSuggestions(payload.suggestions || []);
    setMessage(`Loaded ${payload.suggestions?.length ?? 0} replacement suggestions.`);
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
      const msg =
        action === "clear_unlocked"
          ? `Cleared ${payload.count ?? 0} unlocked assignments`
          : action === "lock_all"
            ? `Locked ${payload.count ?? 0} assignments`
            : action === "unlock_all"
              ? `Unlocked ${payload.count ?? 0} assignments`
              : `Auto-assigned unfilled roles (${payload.count ?? 0} total assignments now)`;
      setMessage(msg);
    } else {
      setMessage(payload.error || "Bulk action failed");
    }
    setLoading(false);
    await load();
  }

  async function seedTestWorkers() {
    setLoading(true);
    const res = await fetch("/api/admin/test-workers", { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Created ${payload.created ?? 0} test workers.` : payload.error || "Failed to create test workers");
    setLoading(false);
    await load();
  }

  async function clearTestWorkers() {
    setLoading(true);
    const res = await fetch("/api/admin/test-workers", { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Removed ${payload.deleted ?? 0} test workers.` : payload.error || "Failed to remove test workers");
    setLoading(false);
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
    if (!eligibility?.eligible) {
      setMessage(`Cannot assign: ${eligibility?.reasons.join(", ") || "Ineligible for role"}`);
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
    setMessage(res.ok ? payload.warning || "Assigned" : payload.error || "Assignment failed");
    setSelectedVolunteerId(volunteerId);
    setInspectorRoleId(roleId);
    await load();
  }

  async function saveNote(volunteerId: string, notes: string) {
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerId, notes }),
    });
    setMessage(res.ok ? "Note saved." : "Failed to save note.");
    if (res.ok) await load();
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

  if (!authed) {
    return (
      <section className="panel max-w-md p-5">
        <h2 className="text-xl font-bold">Admin Login</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-3 w-full rounded-lg border border-strawberry-200 px-3 py-2"
          placeholder="Admin password"
        />
        <button onClick={login} className="mt-3 rounded-lg bg-strawberry-500 px-4 py-2 text-sm font-semibold text-white">
          Sign In
        </button>
        {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {([
            ["coverage", "Coverage Calendar"],
            ["schedule", "Day Detail + Board"],
            ["volunteers", "Volunteers"],
            ["training", "Training & Approvals"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === id ? "bg-strawberry-500 text-white" : "bg-strawberry-50/80 text-foreground dark:bg-strawberry-100/25"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/print" className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            Print Center
          </Link>
          <Link href="/admin/captain" className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            Captain Mode
          </Link>
          <button onClick={logout} className="rounded-md border border-strawberry-300 px-3 py-1.5 text-sm">
            Logout
          </button>
        </div>
      </div>

      {tab === "coverage" && data && (
        <section className="space-y-3">
          <div className="panel p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Coverage Date</span>
                <select
                  value={coverageDateFilter}
                  onChange={(e) => setCoverageDateFilter(e.target.value)}
                  className="w-full rounded-md border border-strawberry-200 px-2 py-2"
                >
                  <option value="ALL">All dates</option>
                  {allDates.map((d) => (
                    <option key={d} value={d}>
                      {format(new Date(`${d}T00:00:00`), "EEE MMM d")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Coverage Module</span>
                <select
                  value={coverageModuleFilter}
                  onChange={(e) => setCoverageModuleFilter(e.target.value as ModuleFilter)}
                  className="w-full rounded-md border border-strawberry-200 px-2 py-2"
                >
                  <option value="ALL">All modules</option>
                  <option value="BOOTH">Booth only</option>
                  <option value="HALL">Hall only</option>
                </select>
              </label>
            </div>
          </div>

          {(() => {
            const grouped = Object.entries(
              coverageSummary
                .filter((item) => {
                  if (coverageDateFilter !== "ALL" && item.date !== coverageDateFilter) return false;
                  if (coverageModuleFilter === "BOOTH" && !item.shiftType.startsWith("BOOTH_")) return false;
                  if (coverageModuleFilter === "HALL" && !item.shiftType.startsWith("HALL_")) return false;
                  return true;
                })
                .reduce<Record<string, typeof coverageSummary>>((acc, item) => {
                  if (!acc[item.date]) acc[item.date] = [];
                  acc[item.date].push(item);
                  return acc;
                }, {}),
            ).sort(([a], [b]) => (a < b ? -1 : 1));

            if (grouped.length === 0) {
              return <p className="panel p-3 text-sm text-foreground/90">No coverage rows match the current filters.</p>;
            }

            return grouped.map(([date, items]) => {
            const isOpen = openCoverageDate === date;
            return (
            <div key={date} className="panel p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpenCoverageDate((current) => (current === date ? null : date))}
                  className="flex flex-1 items-center justify-between rounded-md border border-strawberry-100 bg-card px-3 py-2 text-left"
                >
                  <span className="text-sm font-semibold">{format(new Date(`${date}T00:00:00`), "EEEE, MMM d")}</span>
                  <span className="text-xs font-semibold text-foreground">{isOpen ? "Hide" : "Show"}</span>
                </button>
                <span className="rounded-full bg-strawberry-100/80 px-2 py-0.5 text-xs font-semibold text-foreground dark:bg-strawberry-100/25">
                  {items.length} shifts
                </span>
              </div>
              {isOpen && (
              <div className="grid gap-3 lg:grid-cols-2">
                {[
                  { title: "Booth", list: items.filter((i) => i.shiftType.startsWith("BOOTH_")) },
                  { title: "Hall", list: items.filter((i) => i.shiftType.startsWith("HALL_")) },
                ].map((group) => (
                  <div key={group.title} className="rounded-lg border border-strawberry-100/80 p-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">{group.title}</p>
                    <div className="space-y-2">
                      {group.list
                        .sort((a, b) => shiftSortWeight(a.shiftType) - shiftSortWeight(b.shiftType))
                        .map((item) => (
                          <button
                            key={item.shiftId}
                            onClick={() => {
                              setShiftId(item.shiftId);
                              setTab("schedule");
                            }}
                            className={`w-full rounded-lg border p-3 text-left ${shiftToneClasses(item.shiftType)}`}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-white">Shift</p>
                            <p className="text-sm font-semibold tracking-wide text-white">{formatShiftTypeLabel(item.shiftType)}</p>
                            <p className="mt-1 text-xs text-slate-100">{shiftDescription(item.shiftType)}</p>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <div className="rounded-md bg-slate-700/95 px-2 py-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Filled</p>
                                <p className="text-base font-black text-white">{item.filled}</p>
                              </div>
                              <div className="rounded-md bg-slate-700/95 px-2 py-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Target</p>
                                <p className="text-base font-black text-white">{item.targets > 0 ? item.targets : "Not set"}</p>
                              </div>
                              <div className="rounded-md bg-slate-700/95 px-2 py-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Status</p>
                                <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.health.className}`}>{item.health.label}</span>
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-100">Click card to open this shift in Day Detail.</p>
                          </button>
                        ))}
                      {group.list.length === 0 && (
                        <p className="rounded-md border border-strawberry-100 bg-card px-2 py-2 text-xs text-foreground/90">No {group.title.toLowerCase()} shifts for this date.</p>
                      )}
                    </div>
                  </div>
                ))}
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
          {scheduleSummary && (
            <div className="panel grid gap-2 p-3 text-sm md:grid-cols-5">
              <div className="rounded-md bg-strawberry-50/80 px-3 py-2 text-foreground dark:bg-strawberry-100/25">
                <p className="text-xs uppercase text-foreground/90">Target Slots</p>
                <p className="text-lg font-black text-strawberry-700">{scheduleSummary.totalTarget}</p>
              </div>
              <div className="rounded-md bg-leaf-200/35 px-3 py-2 text-foreground dark:bg-leaf-200/25">
                <p className="text-xs uppercase text-foreground/90">Assigned</p>
                <p className="text-lg font-black text-leaf-700">{scheduleSummary.assignedCount}</p>
              </div>
              <div className="rounded-md bg-amber-100 px-3 py-2 text-foreground dark:bg-amber-700/40 dark:text-amber-100">
                <p className="text-xs uppercase text-foreground/90">Unfilled</p>
                <p className="text-lg font-black text-amber-700">{scheduleSummary.unfilled}</p>
              </div>
              <div className="rounded-md bg-card px-3 py-2 text-foreground">
                <p className="text-xs uppercase text-foreground/90">Available Pool</p>
                <p className="text-lg font-black">{scheduleSummary.availableCount}</p>
              </div>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-foreground dark:bg-slate-700/40">
                <p className="text-xs uppercase text-foreground/90">Locked</p>
                <p className="text-lg font-black text-foreground">{scheduleSummary.lockedCount}</p>
              </div>
            </div>
          )}

          <div className="no-print sticky top-14 z-10 panel border-2 border-strawberry-100 p-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Date</span>
                <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  <option value="ALL">All dates</option>
                  {allDates.map((d) => (
                    <option key={d} value={d}>{format(new Date(`${d}T00:00:00`), "EEE MMM d")}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Module</span>
                <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  <option value="ALL">All</option>
                  <option value="BOOTH">Booth</option>
                  <option value="HALL">Hall</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Shift Type</span>
                <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  <option value="ALL">All</option>
                  {[...new Set(data.shifts.map((s) => s.shiftType))].map((st) => (
                    <option key={st} value={st}>{formatShiftTypeLabel(st)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm xl:col-span-2">
                <span className="mb-1 block font-semibold">Shift</span>
                <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2">
                  {filteredShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {format(new Date(s.date), "EEE MMM d")} - {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                className="rounded-md border border-strawberry-200 px-2 py-2 text-sm md:col-span-2"
                placeholder="Search volunteer name/email/phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className="inline-flex items-center gap-2 rounded-md border border-strawberry-200 px-2 py-2 text-xs">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Force assign
              </label>
              <input
                className="rounded-md border border-strawberry-200 px-2 py-2 text-sm"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Override reason (if force)"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">Assign</span>
                <div className="flex flex-wrap gap-2">
                  <button disabled={loading || !shiftId} onClick={runAutoAssign} className="rounded-md bg-leaf-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    Run Auto-Assign
                  </button>
                  <button
                    disabled={loading || !shiftId}
                    onClick={() => void runBulkAction("auto_assign_unfilled")}
                    className="rounded-md border border-leaf-500 px-3 py-2 text-sm font-semibold text-leaf-700 disabled:opacity-60"
                  >
                    Fill Unfilled
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">Locks</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={loading || !shiftId}
                    onClick={() => void runBulkAction("clear_unlocked")}
                    className="rounded-md border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60"
                  >
                    Clear Unlocked
                  </button>
                  <button
                    disabled={loading || !shiftId}
                    onClick={() => void runBulkAction("lock_all")}
                    className="rounded-md border border-strawberry-300 px-3 py-2 text-sm disabled:opacity-60"
                  >
                    Lock All
                  </button>
                  <button
                    disabled={loading || !shiftId}
                    onClick={() => void runBulkAction("unlock_all")}
                    className="rounded-md border border-strawberry-300 px-3 py-2 text-sm disabled:opacity-60"
                  >
                    Unlock All
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">View</span>
                <div className="flex gap-2">
                  <button onClick={() => void load()} className="rounded-md border border-strawberry-300 px-3 py-2 text-sm">
                    Refresh
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-dashed border-strawberry-300 p-2 md:ml-auto">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">Demo data</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={loading}
                    onClick={() => void seedTestWorkers()}
                    className="rounded-md border border-cyan-500 px-3 py-2 text-sm font-semibold text-cyan-700 disabled:opacity-60"
                  >
                    Add Test Workers
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void clearTestWorkers()}
                    className="rounded-md border border-rose-500 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Remove Test Workers
                  </button>
                </div>
              </div>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">Role Legend</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded border border-strawberry-200 bg-card px-2 py-0.5">
                        Filter: {selectedRoleFilterIds.length === 0 ? "All roles" : `${selectedRoleFilterIds.length} selected`}
                      </span>
                      {selectedRoleFilterIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRoleFilterIds([])}
                          className="rounded border border-strawberry-300 px-2 py-0.5"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {displayedRoles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setInspectorRoleId(role.id);
                          toggleRoleFilter(role.id);
                        }}
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
                          selectedRoleFilterIds.includes(role.id)
                            ? "border-leaf-500 bg-leaf-200/40 ring-1 ring-leaf-500"
                            : inspectorRoleId === role.id
                              ? "border-cyan-500 bg-cyan-100/30"
                              : "border-strawberry-200 bg-card"
                        }`}
                      >
                        <span className="rounded-full bg-strawberry-100 px-1.5 py-0.5 text-xs font-semibold text-foreground dark:bg-strawberry-100/35">
                          {roleCodeMap.get(role.id) || "R?"}
                        </span>
                        <span>{role.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <aside className="panel no-print p-3">
                  <h3 className="font-semibold">Available Pool</h3>
                  <p className="mb-2 text-xs text-foreground/85">
                    Drag into a green role, red roles are blocked.
                    {selectedRoleFilterIds.length > 0 ? " Pool is filtered by selected role chips." : ""}
                  </p>
                  <input
                    className="mb-2 w-full rounded-md border border-strawberry-200 px-2 py-2 text-xs"
                    placeholder="Search available pool"
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                  />
                  {selectedRoleFilterIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {selectedRoleFilterIds.map((roleId) => {
                        const role = displayedRoles.find((r) => r.id === roleId);
                        if (!role) return null;
                        return (
                          <button
                            key={roleId}
                            type="button"
                            onClick={() => toggleRoleFilter(roleId)}
                            className="rounded-full border border-leaf-500 bg-leaf-200/40 px-2 py-0.5 text-[11px]"
                          >
                            {roleCodeMap.get(roleId) || "R?"} {role.name} ×
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="space-y-2">
                    {availablePool.map((vol) => (
                      <div key={vol.id} onClick={() => setSelectedVolunteerId(vol.id)}>
                        <PoolCard
                          volunteer={vol}
                          selected={selectedVolunteerId === vol.id}
                          volunteerCode={volunteerCodeMap.get(vol.id) || `V-${vol.id.slice(-4).toUpperCase()}`}
                          fitSummary={getVolunteerFit(vol.id, selectedRoleFilterIds).summary}
                          reliability={reliabilityInfo(reliabilityByVolunteer.get(vol.id))}
                        />
                      </div>
                    ))}
                    {availablePool.length === 0 && (
                      <p className="text-xs text-foreground/90">
                        No available volunteers after filters.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-foreground dark:bg-amber-700/25 dark:text-amber-100">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                      Needs Attention{roleForAttention ? `: ${roleForAttention.name}` : ""}
                    </p>
                    <div className="mt-2 space-y-1 text-xs">
                      {needsAttention.length === 0 ? (
                        <p className="text-amber-900 dark:text-amber-100">No blockers detected in current pool.</p>
                      ) : (
                        needsAttention.map((item) => (
                          <button
                            key={item.volunteer.id}
                            type="button"
                            onClick={() => setSelectedVolunteerId(item.volunteer.id)}
                            className="w-full rounded border border-amber-200 bg-card px-2 py-1 text-left text-foreground"
                          >
                            <p className="font-semibold">
                              {item.volunteer.firstName} {item.volunteer.lastName}
                            </p>
                            <p className="text-amber-900 dark:text-amber-100">{item.reasons.slice(0, 2).join(" • ")}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </aside>

                <div className="columns-1 gap-2 md:columns-2 xl:columns-3">
                  {displayedRoles.map((role) => {
                    const roleAssigned = assigned.filter((a) => a.roleId === role.id);
                    const target = roleTargets.find((r) => r.roleId === role.id)?.target || 0;
                    return (
                      <RoleColumn
                        key={role.id}
                        role={role}
                        count={roleAssigned.length}
                        target={target}
                        selected={inspectorRoleId === role.id}
                        onSelect={() => {
                          setInspectorRoleId(role.id);
                          toggleRoleFilter(role.id);
                        }}
                        roleCode={roleCodeMap.get(role.id) || role.name}
                        dropState={getRoleDropState(role.id)}
                      >
                        {roleAssigned.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setSelectedVolunteerId(a.volunteerId);
                              setInspectorRoleId(role.id);
                            }}
                            className={`flex w-full items-center justify-between rounded border border-strawberry-100 bg-card px-2 py-1 text-left text-xs text-foreground ${selectedVolunteerId === a.volunteerId ? "ring-1 ring-leaf-500" : ""}`}
                          >
                            <span>
                              {a.volunteer.firstName} {a.volunteer.lastName}
                            </span>
                            {a.forceAssigned && <span className="text-xs text-orange-700 dark:text-orange-200">FORCED</span>}
                          </button>
                        ))}
                      </RoleColumn>
                    );
                  })}
                </div>

                <aside className="panel p-3">
                  <h3 className="font-semibold">Inspector</h3>
                  {!selectedVolunteer ? (
                    <p className="mt-2 text-xs text-foreground/90">Select a volunteer card to inspect eligibility and today&apos;s assignments.</p>
                  ) : (
                    <div className="mt-2 space-y-2 text-xs">
                      <p className="font-semibold">
                        {selectedVolunteer.firstName} {selectedVolunteer.lastName}
                      </p>
                      <p className="rounded bg-strawberry-100 px-2 py-1 text-xs font-semibold text-foreground dark:bg-strawberry-100/35">
                        {volunteerCodeMap.get(selectedVolunteer.id) || `V-${selectedVolunteer.id.slice(-4).toUpperCase()}`}
                      </p>
                      <p>{selectedVolunteer.email}</p>
                      <p>{selectedVolunteer.phone}</p>
                      <p className="rounded border border-leaf-300 bg-leaf-200/30 px-2 py-1 text-xs text-foreground">
                        {getVolunteerFit(selectedVolunteer.id).summary}
                      </p>
                      <div className="rounded border border-strawberry-100 bg-strawberry-50 p-2">
                        <p className="font-semibold">Acknowledgements</p>
                        <p>Standing: {selectedVolunteer.acknowledgement?.standingWalking ? "Yes" : "No"}</p>
                        <p>Heavy lift: {selectedVolunteer.acknowledgement?.heavyLift50 ? "Yes" : "No"}</p>
                        <p>Cash: {selectedVolunteer.acknowledgement?.cashHandling ? "Yes" : "No"}</p>
                        <p>Outdoor: {selectedVolunteer.acknowledgement?.outdoorSun ? "Yes" : "No"}</p>
                      </div>
                      <div className="rounded border border-strawberry-100 p-2">
                        <p className="font-semibold">Reliability</p>
                        {(() => {
                          const info = reliabilityInfo(reliabilityByVolunteer.get(selectedVolunteer.id));
                          return (
                            <p className="mt-1">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
                                <span aria-hidden>{info.emoji}</span> {info.label}
                              </span>
                              {info.assigned > 0
                                ? ` · ${info.attended} in / ${info.noShows} no-show${info.excused > 0 ? ` / ${info.excused} excused` : ""} of ${info.assigned}`
                                : " · no shifts yet"}
                            </p>
                          );
                        })()}
                        {selectedVolunteer.adminNotes && (
                          <p className="mt-1">
                            <span className="font-semibold">Note:</span> {selectedVolunteer.adminNotes}
                          </p>
                        )}
                      </div>
                      {selectedRole && (
                        <div className="rounded border border-leaf-300 bg-leaf-200/40 p-2">
                          <p className="font-semibold">Selected Role</p>
                          <p>{selectedRole.name}</p>
                          <p className="mt-1">Requires training: {selectedRole.requiresTraining ? "Yes" : "No"}</p>
                          <p>Requires approval: {selectedRole.requiresApproval ? "Yes" : "No"}</p>
                          <p>Required gender: {selectedRole.requiredGender || "Any"}</p>
                        </div>
                      )}
                      {selectedRole && (
                        <div className={`rounded border p-2 ${eligibilityReasons.length === 0 ? "border-green-300 bg-green-50 text-green-900 dark:bg-green-700/30 dark:text-green-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-700/30 dark:text-amber-100"}`}>
                          <p className="font-semibold">Eligibility Check</p>
                          {eligibilityReasons.length === 0 ? (
                            <p className="text-green-700 dark:text-green-100">Eligible for selected role and shift.</p>
                          ) : (
                            <ul className="list-disc pl-4 text-amber-900 dark:text-amber-100">
                              {eligibilityReasons.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      <div className="rounded border border-strawberry-100 p-2">
                        <p className="mb-1 font-semibold">Assignments this date</p>
                        {selectedVolunteerAssignmentsToday.length === 0 ? (
                          <p>None</p>
                        ) : (
                          selectedVolunteerAssignmentsToday.map((a) => (
                            <p key={a.id}>
                              {a.shift.label} - {a.role.name}
                            </p>
                          ))
                        )}
                      </div>
                      {selectedRole && (
                        <button
                          type="button"
                          onClick={() => void assignSelectedFromInspector()}
                          className="w-full rounded-md bg-strawberry-500 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Assign Selected Volunteer to {selectedRole.name}
                        </button>
                      )}
                      {selectedRole && (
                        <button
                          type="button"
                          onClick={() => void loadSuggestionsForRole()}
                          className="w-full rounded-md border border-leaf-500 px-3 py-2 text-xs font-semibold text-leaf-700"
                        >
                          Suggest Replacements for {selectedRole.name}
                        </button>
                      )}
                      {selectedRole && roleSuggestions.length > 0 && (
                        <div className="rounded border border-leaf-300 bg-leaf-200/30 p-2">
                          <p className="font-semibold">Top Suggestions</p>
                          <div className="mt-1 space-y-1">
                            {roleSuggestions.map((s) => (
                              <button
                                key={s.volunteerId}
                                type="button"
                                onClick={() => setSelectedVolunteerId(s.volunteerId)}
                                className="w-full rounded border border-leaf-200 bg-card px-2 py-1 text-left text-xs text-foreground"
                              >
                                <p className="font-semibold">{s.name}</p>
                                <p className="text-xs">Score: {s.score.toFixed(1)}</p>
                                <p className="text-xs">{s.reasons.join(" • ")}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 rounded-md border border-strawberry-100 bg-strawberry-50/80 p-2 text-foreground dark:bg-strawberry-100/25">
                    <p className="text-xs font-semibold">Recent Activity</p>
                    <div className="mt-2 max-h-44 space-y-1 overflow-auto text-xs">
                      {data.auditLogs.length === 0 ? (
                        <p className="text-foreground/90">No audit entries yet.</p>
                      ) : (
                        data.auditLogs.slice(0, 20).map((log) => (
                          <div key={log.id} className="rounded border border-strawberry-100 bg-card px-2 py-1 text-foreground">
                            <p className="font-semibold">{log.action}</p>
                            <p className="text-foreground/85">{log.entityType} {log.details ? `• ${log.details}` : ""}</p>
                            <p className="text-foreground/85">{format(new Date(log.createdAt), "MMM d HH:mm")}</p>
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
              <h2 className="text-lg font-bold">Volunteer Roster</h2>
              <p className="text-xs text-foreground/70">
                Showing {roster.length} of {data.volunteers.length} verified volunteers
              </p>
            </div>
            <input
              className="w-full max-w-xs rounded-md border border-strawberry-200 px-3 py-2 text-sm"
              placeholder="Search name / email / phone"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                  <th className="p-2">Name</th>
                  <th className="p-2">Contact</th>
                  <th className="p-2">Gender</th>
                  <th className="p-2 text-center">Exp</th>
                  <th className="p-2">Tier</th>
                  <th className="p-2">Can do</th>
                  <th className="p-2 text-center">Avail</th>
                  <th className="p-2 text-center">Assigned</th>
                  <th className="p-2">Reliability</th>
                  <th className="p-2">Notes (admin only)</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((v) => {
                  const ack = v.acknowledgement;
                  const caps: Array<[string, boolean]> = [
                    ["Stand", !!ack?.standingWalking],
                    ["Heavy", !!ack?.heavyLift50],
                    ["Cash", !!ack?.cashHandling],
                    ["Outdoor", !!ack?.outdoorSun],
                  ];
                  return (
                    <tr key={v.id} className="border-b border-strawberry-50 align-top">
                      <td className="p-2 font-semibold">
                        {v.firstName} {v.lastName}
                      </td>
                      <td className="p-2 text-xs text-foreground/80">
                        <div>{v.email}</div>
                        <div>{v.phone}</div>
                      </td>
                      <td className="p-2 text-xs capitalize">{v.gender.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="p-2 text-center tabular-nums">{v.yearsExperience}</td>
                      <td className="p-2">
                        {(() => {
                          const t = seniorityTier(v.yearsExperience);
                          return (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.className}`}>
                              <span aria-hidden>{t.emoji}</span> {t.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {caps.map(([label, on]) => (
                            <span
                              key={label}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${on ? "bg-leaf-200 text-leaf-700" : "bg-muted text-foreground/40"}`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-center tabular-nums">{volunteerCounts.availByVolunteer.get(v.id) ?? 0}</td>
                      <td className="p-2 text-center tabular-nums">{volunteerCounts.assignByVolunteer.get(v.id) ?? 0}</td>
                      <td className="p-2">
                        {(() => {
                          const info = reliabilityInfo(reliabilityByVolunteer.get(v.id));
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
                                <span aria-hidden>{info.emoji}</span> {info.label}
                              </span>
                              {info.assigned > 0 && (
                                <span className="text-[10px] text-foreground/60">
                                  {info.attended} in · {info.noShows} no-show{info.noShows === 1 ? "" : "s"}
                                  {info.excused > 0 ? ` · ${info.excused} excused` : ""}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={v.adminNotes ?? ""}
                          onBlur={(e) => {
                            if (e.target.value.trim() !== (v.adminNotes ?? "").trim()) void saveNote(v.id, e.target.value);
                          }}
                          placeholder="Add a note…"
                          className="w-44 rounded-md border border-strawberry-200 bg-background px-2 py-1 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-4 text-center text-foreground/60">
                      No volunteers match your search.
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
              <h2 className="text-lg font-bold">Training &amp; Approvals</h2>
              <p className="text-xs text-foreground/70">
                {gatedRoles.length === 0
                  ? "No roles currently require training or approval."
                  : `Roles needing sign-off: ${gatedRoles.map((r) => r.name).join(", ")}`}
              </p>
            </div>
            {gatedRoles.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-strawberry-100 text-left text-xs uppercase tracking-wide text-foreground/60">
                      <th className="p-2">Volunteer</th>
                      {gatedRoles.map((r) => (
                        <th key={r.id} className="p-2 text-center">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.volunteers.map((v) => (
                      <tr key={v.id} className="border-b border-strawberry-50">
                        <td className="p-2 font-semibold">
                          {v.firstName} {v.lastName}
                        </td>
                        {gatedRoles.map((r) => {
                          const trained = data.trainings.find((t) => t.volunteerId === v.id && t.roleId === r.id)?.trained || false;
                          const approved = data.approvals.find((a) => a.volunteerId === v.id && a.roleId === r.id)?.approved || false;
                          return (
                            <td key={r.id} className="p-2">
                              <div className="flex items-center justify-center gap-3 text-xs">
                                {r.requiresTraining && (
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" checked={trained} onChange={(e) => void toggleTraining(v.id, r.id, e.target.checked)} />
                                    <span className="text-foreground/70">Trained</span>
                                  </label>
                                )}
                                {r.requiresApproval && (
                                  <label className="inline-flex items-center gap-1">
                                    <input type="checkbox" checked={approved} onChange={(e) => void toggleApproval(v.id, r.id, e.target.checked)} />
                                    <span className="text-foreground/70">Approved</span>
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

      {message && <p className="rounded-md bg-strawberry-50/80 px-3 py-2 text-sm text-foreground dark:bg-strawberry-100/25">{message}</p>}
    </div>
  );
}
