"use client";

import { RoleModule, type Role, type Shift } from "@prisma/client";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { seniorityTier } from "@/lib/seniority";
import { useLang } from "@/components/i18n/language-provider";

type Props = {
  shifts: Shift[];
  roles: Role[];
};

type PrefItem = { roleId: string; roleName: string; rank: number };
type PrefMode = "BOOTH_DAY" | "BOOTH_NIGHT" | "HALL";

const profileFields: Array<{
  label: string;
  key:
    | "firstName"
    | "lastName"
    | "dob"
    | "email"
    | "phone"
    | "emergencyContactName"
    | "emergencyContactPhone";
  type?: string;
}> = [
  { label: "Name", key: "firstName" },
  { label: "Last Name", key: "lastName" },
  { label: "Date of Birth", key: "dob", type: "date" },
  { label: "Phone", key: "phone" },
  { label: "Email", key: "email", type: "email" },
  { label: "Emergency Contact", key: "emergencyContactName" },
  { label: "Emergency Contact Phone", key: "emergencyContactPhone" },
];

// Positions that are scheduled by calling a coordinator directly. We still let
// volunteers register online, but show the contact so they can call to confirm.
// Keyed by the role's stable `key` from the seed.
const ROLE_CONTACTS: Record<string, { name: string; phone: string }> = {
  EARLY_SETUP: { name: "Trish", phone: "813-335-4299" },
  BERRY_HULLERS: { name: "Ted", phone: "813-334-9578" },
  BERRY_PRODUCTION: { name: "Tim", phone: "813-382-3455" },
  UNIFORMS_AM: { name: "Cathy", phone: "305-216-2806" },
  UNIFORMS_PM: { name: "Cathy", phone: "305-216-2806" },
  HEAVY_HALL: { name: "Ted", phone: "813-334-9578" },
  BUCKET_WASHERS: { name: "Ana", phone: "813-704-3098" },
};

function upsertPref(list: PrefItem[], role: Role) {
  if (list.some((x) => x.roleId === role.id)) {
    return list.filter((x) => x.roleId !== role.id).map((x, i) => ({ ...x, rank: i + 1 }));
  }
  const max = role.module === RoleModule.HALL ? 10 : 5;
  if (list.length >= max) return list;
  return [...list, { roleId: role.id, roleName: role.name, rank: list.length + 1 }];
}

function moveRank(list: PrefItem[], idx: number, dir: "up" | "down") {
  const next = [...list];
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= next.length) return list;
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next.map((x, i) => ({ ...x, rank: i + 1 }));
}

export function SignupWizard({ shifts, roles }: Props) {
  const { t } = useLang();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefMode, setPrefMode] = useState<PrefMode>("BOOTH_DAY");
  const [areaTab, setAreaTab] = useState<"BOOTH" | "HALL">("BOOTH");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [contactPopup, setContactPopup] = useState<{ name: string; phone: string; role: string } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    gender: "",
    language: "English",
    textOk: false,
    emailOk: true,
    yearsExperience: 0,
    willingAnyBoothDay: false,
    willingAnyBoothNight: false,
    acknowledgements: {
      age18Plus: false,
      standingWalking: false,
      heavyLift50: false,
      cashHandling: false,
      outdoorSun: false,
      liabilityAcknowledged: false,
      foodRulesAcknowledged: false,
    },
  });

  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [boothDayPref, setBoothDayPref] = useState<PrefItem[]>([]);
  const [boothNightPref, setBoothNightPref] = useState<PrefItem[]>([]);
  const [hallPref, setHallPref] = useState<PrefItem[]>([]);

  const shiftsByDate = useMemo(() => {
    const grouped = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = format(new Date(shift.date), "yyyy-MM-dd");
      grouped.set(key, [...(grouped.get(key) || []), shift]);
    }
    return [...grouped.entries()];
  }, [shifts]);

  const boothRoles = roles.filter((r) => r.module === RoleModule.BOOTH && !r.manualOnly);
  const hallRoles = roles.filter((r) => r.module === RoleModule.HALL && !r.manualOnly);
  const activeRoles = prefMode === "HALL" ? hallRoles : boothRoles;

  const activePrefs = prefMode === "BOOTH_DAY" ? boothDayPref : prefMode === "BOOTH_NIGHT" ? boothNightPref : hallPref;
  const requiredAcknowledgementsComplete =
    form.acknowledgements.age18Plus &&
    form.acknowledgements.standingWalking &&
    form.acknowledgements.liabilityAcknowledged &&
    form.acknowledgements.foodRulesAcknowledged;
  const step1Valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.dob.trim().length > 0 &&
    form.phone.trim().length >= 7 &&
    form.email.includes("@") &&
    form.emergencyContactName.trim().length > 0 &&
    form.emergencyContactPhone.trim().length >= 7 &&
    form.gender !== "";
  const step2Valid = selectedShiftIds.length > 0;
  const step3Valid =
    boothDayPref.length > 0 || boothNightPref.length > 0 || hallPref.length > 0 || form.willingAnyBoothDay || form.willingAnyBoothNight;
  const step4Valid = requiredAcknowledgementsComplete;

  function nextStep() {
    setError(null);
    if (activeStep === 1 && !step1Valid) {
      setError("Please complete all personal detail fields before continuing.");
      return;
    }
    if (activeStep === 2 && !step2Valid) {
      setError("Please select at least one available shift before continuing.");
      return;
    }
    if (activeStep === 3 && !step3Valid) {
      setError("Please select at least one position preference or mark willing-to-do-any for a booth shift.");
      return;
    }
    if (activeStep === 4 && !step4Valid) {
      setError("Please complete all required acknowledgements before continuing.");
      return;
    }
    setActiveStep((s) => (s < 5 ? ((s + 1) as 1 | 2 | 3 | 4 | 5) : s));
  }

  function prevStep() {
    setError(null);
    setActiveStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s));
  }

  function toggleShift(id: string) {
    setSelectedShiftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Booth and Hall are run in different areas; the area tab scopes the Dates and
  // Jobs steps. Switching areas keeps the job pref-mode valid for that area.
  function selectArea(area: "BOOTH" | "HALL") {
    setAreaTab(area);
    setPrefMode(area === "HALL" ? "HALL" : "BOOTH_DAY");
  }

  function applyRole(role: Role) {
    if (prefMode === "BOOTH_DAY") setBoothDayPref((prev) => upsertPref(prev, role));
    else if (prefMode === "BOOTH_NIGHT") setBoothNightPref((prev) => upsertPref(prev, role));
    else setHallPref((prev) => upsertPref(prev, role));
  }

  function removePref(roleId: string) {
    const fn = (list: PrefItem[]) => list.filter((x) => x.roleId !== roleId).map((x, i) => ({ ...x, rank: i + 1 }));
    if (prefMode === "BOOTH_DAY") setBoothDayPref(fn);
    else if (prefMode === "BOOTH_NIGHT") setBoothNightPref(fn);
    else setHallPref(fn);
  }

  function movePref(idx: number, dir: "up" | "down") {
    if (prefMode === "BOOTH_DAY") setBoothDayPref((prev) => moveRank(prev, idx, dir));
    else if (prefMode === "BOOTH_NIGHT") setBoothNightPref((prev) => moveRank(prev, idx, dir));
    else setHallPref((prev) => moveRank(prev, idx, dir));
  }

  async function submit() {
    if (!requiredAcknowledgementsComplete) {
      setError("Please complete all required acknowledgements before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const boothDayShiftIds = shifts.filter((s) => s.shiftType === "BOOTH_DAY").map((s) => s.id);
      const boothNightShiftIds = shifts.filter((s) => s.shiftType === "BOOTH_NIGHT").map((s) => s.id);
      const hallShiftIds = shifts.filter((s) => s.module === RoleModule.HALL).map((s) => s.id);

      const preferences = [
        ...boothDayPref.flatMap((p) => boothDayShiftIds.map((shiftId) => ({ shiftId, roleId: p.roleId, rank: p.rank }))),
        ...boothNightPref.flatMap((p) => boothNightShiftIds.map((shiftId) => ({ shiftId, roleId: p.roleId, rank: p.rank }))),
        ...hallPref.flatMap((p) => hallShiftIds.map((shiftId) => ({ shiftId, roleId: p.roleId, rank: p.rank }))),
      ];

      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, availabilityShiftIds: selectedShiftIds, preferences }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data.volunteerId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="panel rounded-3xl border border-strawberry-100 bg-card p-6">
        <h2 className="text-2xl font-black text-strawberry-900">{t("You're all signed up!")} 🍓</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">
          {t("Thank you for volunteering. A coordinator will review everyone's availability and confirm your specific shifts closer to the festival — nothing more to do for now.")}
        </p>
        <p className="mt-2 text-sm text-foreground/85">{t("Watch for a confirmation by text or email.")}</p>
        <p className="mt-3 text-xs text-foreground/60">{t("Confirmation number:")} {result}</p>
        <button onClick={() => window.print()} className="mt-4 rounded-full bg-strawberry-500 px-6 py-2 text-sm font-semibold text-white">
          {t("Print Confirmation")}
        </button>
      </section>
    );
  }

  const areaToggle = (
    <div className="mb-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-strawberry-300">{t("Which area?")}</p>
      <div className="flex gap-2">
        {(["BOOTH", "HALL"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => selectArea(a)}
            className={`rounded-full px-5 py-2 text-sm font-bold ${areaTab === a ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-strawberry-900 hover:bg-strawberry-50"}`}
          >
            {a === "BOOTH" ? t("Booth") : t("Hall")}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-strawberry-900">{t("Volunteer Sign-Up")}</h1>
      <p className="text-sm text-foreground/80">{t("Complete all steps to submit your volunteer profile, availability, and position preferences.")}</p>

      <section className="space-y-5 text-foreground">
      <div className="relative overflow-hidden rounded-3xl border border-strawberry-100 bg-gradient-to-br from-strawberry-50 via-card to-leaf-200 p-5">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="grid place-items-center rounded-2xl border border-strawberry-100 bg-white p-4 text-center">
            <div>
              <div aria-hidden className="text-5xl">🍓🍰🍓</div>
              <p className="mt-3 text-sm font-black text-strawberry-900">{t("St. Clement “Make Your Own Strawberry Shortcake Project.”")}</p>
              <p className="mt-1 text-xs font-semibold text-leaf-700">{t("53rd Year · March 4-14, 2027")}</p>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black leading-tight text-strawberry-900">{t("Volunteer for St. Clement")}{" "}<span className="text-[color:var(--gold)]">{t("“Make Your Own Strawberry Shortcake Project.”")}</span></h2>
            <p className="mt-2 text-lg text-foreground/85">{t("Pick your position below. Simple for young & old.")}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[
                [1, "1. Personal Details"],
                [2, "2. Dates & Availability"],
                [3, "3. Job Selection"],
                [4, "4. Acknowledgements"],
                [5, "5. Review & Submit"],
              ].map(([step, label]) => (
                <button
                  key={String(step)}
                  type="button"
                  onClick={() => setActiveStep(step as 1 | 2 | 3 | 4 | 5)}
                  className={`rounded-full px-3 py-1.5 font-semibold ${
                    activeStep === step ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-strawberry-900 hover:bg-strawberry-50"
                  }`}
                >
                  {t(label as string)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeStep === 1 && <div id="personal" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="mb-2 text-xl font-black text-strawberry-900">{t("1) Personal Details")}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {profileFields.map(({ label, key, type }) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-semibold text-strawberry-900">{t(label)}</span>
              <input
                type={type || "text"}
                className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">{t("Preferred Language")}</span>
            <select
              value={form.language}
              onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
            >
              <option value="English">{t("English")}</option>
              <option value="Spanish">{t("Spanish")}</option>
              <option value="French">{t("French")}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">{t("Gender")}</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
            >
              <option value="" disabled>{t("Select…")}</option>
              <option value="FEMALE">{t("Female")}</option>
              <option value="MALE">{t("Male")}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">{t("Years Experience")}</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
              value={form.yearsExperience}
              onChange={(e) => setForm((p) => ({ ...p, yearsExperience: Number(e.target.value || 0) }))}
            />
            {(() => {
              const tier = seniorityTier(form.yearsExperience);
              return (
                <span className="mt-1 block text-xs text-foreground/70">
                  {t("Your status:")}{" "}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tier.className}`}>
                    <span aria-hidden>{tier.emoji}</span> {t(tier.label)}
                  </span>
                  {" "}{t("— more years means higher priority when shifts are assigned.")}
                </span>
              );
            })()}
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.textOk} onChange={(e) => setForm((p) => ({ ...p, textOk: e.target.checked }))} /> {t("OK to text me reminders")}</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.emailOk} onChange={(e) => setForm((p) => ({ ...p, emailOk: e.target.checked }))} /> {t("OK to email me updates")}</label>
        </div>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground/60">
          {t("By checking \"OK to text me,\" you agree to receive volunteer scheduling texts (confirmations and shift reminders) from St. Clement Strawberry Festival. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.")}{" "}
          <a href="/sms-terms" target="_blank" rel="noreferrer" className="underline">{t("SMS Terms")}</a>
          {" · "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">{t("Privacy Policy")}</a>
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">{t("Next")}</button>
        </div>
      </div>}

      {activeStep === 2 && <div id="dates" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">{t("2) Festival Dates & Requirements")}</h3>
        <p className="text-sm text-foreground/85">{t("Festival runs March 4 - March 14, 2027")}</p>
        {areaToggle}
        <p className="mb-2 text-xs text-foreground/70">{t("Pick your days below. You can switch area to add shifts from the other area too.")}</p>
        <div className="mt-1 grid gap-2 md:grid-cols-3">
          {shiftsByDate.map(([date, items]) => {
            const areaItems = items.filter((s) => s.module === areaTab);
            if (areaItems.length === 0) return null;
            return (
              <div key={date} className="rounded-xl border border-strawberry-100 bg-background p-2">
                <p className="text-xs font-bold uppercase text-strawberry-300">{format(new Date(`${date}T00:00:00`), "EEE")}</p>
                <p className="text-lg font-black text-strawberry-900">{format(new Date(`${date}T00:00:00`), "d")}</p>
                <div className="mt-1 space-y-1">
                  {areaItems.map((shift) => (
                    <label key={shift.id} className="flex items-center gap-2 text-xs text-foreground/90">
                      <input type="checkbox" checked={selectedShiftIds.includes(shift.id)} onChange={() => toggleShift(shift.id)} />
                      {t(shift.label)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">{t("Back")}</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">{t("Next")}</button>
        </div>
      </div>}

      {activeStep === 3 && <div id="jobs" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-black text-strawberry-900">{t("3) Job Selection")}</h3>
          <a href="/positions" target="_blank" rel="noreferrer" className="text-xs font-semibold text-strawberry-500 underline">
            {t("What does each position do?")}
          </a>
        </div>
        {areaToggle}
        {areaTab === "BOOTH" && (
          <div className="mt-1 flex flex-wrap gap-2">
            <button onClick={() => setPrefMode("BOOTH_DAY")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${prefMode === "BOOTH_DAY" ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-foreground"}`}>{t("Booth Day")}</button>
            <button onClick={() => setPrefMode("BOOTH_NIGHT")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${prefMode === "BOOTH_NIGHT" ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-foreground"}`}>{t("Booth Night")}</button>
          </div>
        )}

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {activeRoles.map((role) => {
            const selected = activePrefs.some((x) => x.roleId === role.id);
            const contact = ROLE_CONTACTS[role.key];
            return (
              <article key={role.id} className={`rounded-xl border p-2 ${selected ? "border-leaf-500 bg-leaf-200/40" : "border-strawberry-100 bg-background"}`}>
                <p className="text-sm font-semibold text-strawberry-900">{t(role.name)}</p>
                <p className="mt-1 line-clamp-3 text-[11px] text-foreground/80">{t(role.description)}</p>
                <button onClick={() => applyRole(role)} className="mt-2 w-full rounded-lg bg-strawberry-500 px-2 py-1.5 text-xs font-semibold text-white">
                  {selected ? t("Selected") : t("Apply")}
                </button>
                {contact && (
                  <button
                    type="button"
                    onClick={() => setContactPopup({ ...contact, role: role.name })}
                    className="mt-1 w-full rounded-lg border border-leaf-500 bg-leaf-200 px-2 py-1.5 text-xs font-semibold text-leaf-700"
                  >
                    📞 {t("How to sign up")}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-3">
          <p className="text-sm font-semibold text-strawberry-900">{t("Selected preferences")}</p>
          {activePrefs.length === 0 ? (
            <p className="text-xs text-foreground/75">{t("No positions selected yet.")}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {activePrefs.map((pref, idx) => (
                <li key={pref.roleId} className="flex items-center justify-between rounded-lg border border-strawberry-100 px-2 py-1">
                  <span>{idx + 1}. {t(pref.roleName)}</span>
                  <span className="flex gap-1">
                    <button onClick={() => movePref(idx, "up")} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">↑</button>
                    <button onClick={() => movePref(idx, "down")} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">↓</button>
                    <button onClick={() => removePref(pref.roleId)} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">{t("Remove")}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {areaTab === "BOOTH" && (
          <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-3 text-sm">
            <p className="font-semibold text-strawberry-900">{t("Willing to do any position if needed")}</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.willingAnyBoothDay}
                  onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothDay: e.target.checked }))}
                />
                {t("Booth Day")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.willingAnyBoothNight}
                  onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothNight: e.target.checked }))}
                />
                {t("Booth Night")}
              </label>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">{t("Back")}</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">{t("Next")}</button>
        </div>
      </div>}

      {activeStep === 4 && <div id="acknowledgements" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">{t("4) Acknowledgements")}</h3>
        <p className="text-sm text-foreground/85">{t("Confirm the required acknowledgements below. The optional ones expand which positions you can be assigned to.")}</p>
        <div className="mt-4 space-y-2 text-sm">
          <p className="rounded-md border border-strawberry-100 bg-muted p-3 text-foreground">
            <AlertCircle className="mr-2 inline h-4 w-4 text-strawberry-300" />
            {t("Required: age 18+, standing/walking, liability and food-safety acknowledgements.")}
          </p>
          {[
            ["I confirm I am at least 18 years old", "age18Plus"],
            ["I can stand/walk for booth positions", "standingWalking"],
            ["I can perform heavy lifting up to 50 lbs if assigned", "heavyLift50"],
            ["I am comfortable handling cash if assigned", "cashHandling"],
            ["I can work outdoors/sun if assigned", "outdoorSun"],
            ["I accept volunteer participation responsibility/liability statement", "liabilityAcknowledged"],
            ["I agree to food handling and safety rules", "foodRulesAcknowledged"],
          ].map(([label, key]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-strawberry-100 bg-background p-2 text-foreground">
              <input
                type="checkbox"
                checked={(form.acknowledgements as Record<string, boolean>)[key as string]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, acknowledgements: { ...p.acknowledgements, [key as string]: e.target.checked } }))
                }
              />
              {t(label)}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">{t("Back")}</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">{t("Next")}</button>
        </div>
      </div>}

      {activeStep === 5 && <div className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">{t("5) Summary, Contact & Sign Up")}</h3>
        <p className="mt-1 text-sm text-foreground/85">{t("Complete the required acknowledgements before submitting.")}</p>

        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-lg bg-background p-2 text-foreground"><strong>{t("Volunteer:")}</strong> {form.firstName} {form.lastName || t("(last name missing)")}</p>
          <p className="rounded-lg bg-background p-2 text-foreground"><strong>{t("Contact:")}</strong> {form.phone || "-"} / {form.email || "-"}</p>
          <div className="rounded-lg bg-background p-2 text-foreground">
            <strong>{t("Your days:")}</strong>
            {selectedShiftIds.length === 0 ? (
              <span> {t("none selected")}</span>
            ) : (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {shifts
                  .filter((s) => selectedShiftIds.includes(s.id))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((s) => (
                    <li key={s.id}>{format(new Date(s.date), "EEE MMM d")} — {t(s.label)}</li>
                  ))}
              </ul>
            )}
          </div>
          {(() => {
            const prefLines = [
              ...boothDayPref.map((p) => `${t("Booth Day")}: ${t(p.roleName)}`),
              ...boothNightPref.map((p) => `${t("Booth Night")}: ${t(p.roleName)}`),
              ...hallPref.map((p) => `${t("Hall")}: ${t(p.roleName)}`),
            ];
            return (
              <div className="rounded-lg bg-background p-2 text-foreground">
                <strong>{t("Job preferences:")}</strong>
                {prefLines.length === 0 ? (
                  <span> {t("willing to help where needed")}</span>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {prefLines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{t(error)}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold text-foreground"
          >
            {t("Back")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !requiredAcknowledgementsComplete}
            className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? t("Submitting...") : t("Sign Up")}
          </button>
          <button
            type="button"
            className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold text-foreground"
            onClick={() => {
              setSelectedShiftIds([]);
              setBoothDayPref([]);
              setBoothNightPref([]);
              setHallPref([]);
            }}
          >
            {t("Clear Selections")}
          </button>
        </div>
      </div>}

      {error && activeStep !== 5 && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{t(error)}</p>
      )}
      </section>

      {contactPopup && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setContactPopup(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-strawberry-100 bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="text-4xl">📞</div>
            <h4 className="mt-2 text-lg font-black text-strawberry-900">{t(contactPopup.role)}</h4>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">
              {t("This position is scheduled by its coordinator.")}<br />
              {t("Call")} <strong>{contactPopup.name}</strong> {t("at")}{" "}
              <a
                href={`tel:${contactPopup.phone.replace(/[^0-9]/g, "")}`}
                className="font-bold text-strawberry-500 underline"
              >
                {contactPopup.phone}
              </a>{" "}
              {t("to schedule.")}
            </p>
            <button
              type="button"
              onClick={() => setContactPopup(null)}
              className="mt-4 rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white"
            >
              {t("Close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
