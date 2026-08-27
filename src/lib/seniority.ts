// Seniority tiers — higher rank = more years of service = higher priority when
// auto-assign fills positions. Renaming/retiering is intentionally just this
// array (no other code cares about the specific labels).
export type SeniorityTier = {
  key: string;
  label: string;
  emoji: string;
  min: number;
  max: number;
  rank: number;
  blurb: string;
  className: string;
};

export const SENIORITY_TIERS: SeniorityTier[] = [
  {
    key: "SPROUT",
    label: "Sprout",
    emoji: "🌱",
    min: 0,
    max: 0,
    rank: 1,
    blurb: "First-year volunteer",
    className: "bg-leaf-200 text-leaf-700",
  },
  {
    key: "BERRY_PICKER",
    label: "Berry Picker",
    emoji: "🍓",
    min: 1,
    max: 5,
    rank: 2,
    blurb: "1–5 years of service",
    className: "bg-strawberry-50 text-strawberry-900",
  },
  {
    key: "ALL_STAR",
    label: "All-Star Berry",
    emoji: "⭐",
    min: 6,
    max: 10,
    rank: 3,
    blurb: "6–10 years of service",
    className: "bg-strawberry-500 text-white",
  },
  {
    key: "LEGEND",
    label: "Berry Legend",
    emoji: "👑",
    min: 11,
    max: Number.POSITIVE_INFINITY,
    rank: 4,
    blurb: "11+ years — a festival legend",
    className: "bg-amber-400 text-amber-950",
  },
];

export function seniorityTier(years: number): SeniorityTier {
  const y = Number.isFinite(years) ? Math.max(0, Math.floor(years)) : 0;
  return SENIORITY_TIERS.find((t) => y >= t.min && y <= t.max) ?? SENIORITY_TIERS[0];
}
