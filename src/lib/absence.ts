// Absence reasons for Captain Mode. "excused" reasons are recorded for context
// but do NOT count against a volunteer's reliability or auto-assign priority —
// only a plain, unexcused No-show does.
export type AbsenceReasonKey = "NO_SHOW" | "SICK" | "EXCUSED" | "OTHER";

export type AbsenceOption = { key: AbsenceReasonKey; label: string; excused: boolean };

export const ABSENCE_OPTIONS: AbsenceOption[] = [
  { key: "NO_SHOW", label: "No-show", excused: false },
  { key: "SICK", label: "Sick", excused: true },
  { key: "EXCUSED", label: "Excused", excused: true },
  { key: "OTHER", label: "Other", excused: true },
];

export function absenceLabel(reason: string | null | undefined): string {
  return ABSENCE_OPTIONS.find((o) => o.key === reason)?.label ?? "No-show";
}

export function isExcusedReason(reason: string | null | undefined): boolean {
  return ABSENCE_OPTIONS.find((o) => o.key === reason)?.excused ?? false;
}

// An absence counts against reliability only when the volunteer was absent and
// the reason is unexcused (or a legacy no-show with no reason recorded).
export function isUnexcusedAbsence(noShow: boolean, reason: string | null | undefined): boolean {
  return noShow && !isExcusedReason(reason);
}
