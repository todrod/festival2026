"use client";

import { RoleModule, ShiftType, type Role, type Shift } from "@prisma/client";
import { format } from "date-fns";
import { AlertCircle, CakeSlice, CircleCheck, Star } from "lucide-react";
import { useMemo, useState } from "react";

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
  { label: "DOB", key: "dob", type: "date" },
  { label: "Phone", key: "phone" },
  { label: "Email", key: "email", type: "email" },
  { label: "Emergency Contact", key: "emergencyContactName" },
  { label: "Emergency Contact Phone", key: "emergencyContactPhone" },
];

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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefMode, setPrefMode] = useState<PrefMode>("BOOTH_DAY");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    gender: "FEMALE",
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
    form.emergencyContactPhone.trim().length >= 7;
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
      setError("Please select at least one role preference or mark willing-to-do-any for a booth shift.");
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
        <h2 className="text-2xl font-black text-strawberry-900">You&apos;re signed up!</h2>
        <p className="mt-2 text-sm">Confirmation ID: {result}</p>
        <button onClick={() => window.print()} className="mt-4 rounded-full bg-strawberry-500 px-6 py-2 text-sm font-semibold text-white">
          Print Confirmation
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-5 text-foreground">
      <div className="relative overflow-hidden rounded-3xl border border-strawberry-100 bg-card p-5">
        <div className="absolute -right-2 -top-2 text-strawberry-500"><Star className="h-10 w-10" /></div>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-strawberry-100 bg-gradient-to-br from-strawberry-50 to-muted p-3">
            <div className="h-full min-h-40 rounded-xl border border-strawberry-100 bg-background/70 p-3 text-xs text-foreground/90">
              <p className="font-semibold text-strawberry-900">Festival Volunteer Poster</p>
              <p className="mt-2">Family-friendly, simple signup, role-first scheduling.</p>
              <CakeSlice className="mt-4 h-8 w-8 text-strawberry-500" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black leading-tight text-strawberry-900">Volunteer for the 2026 St. Clement Strawberry Festival!</h2>
            <p className="mt-2 text-lg text-foreground/85">Select your role below. Simple for young & old.</p>
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
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeStep === 1 && <div id="personal" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="mb-2 text-xl font-black text-strawberry-900">1) Personal Details</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {profileFields.map(({ label, key, type }) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-semibold text-strawberry-900">{label}</span>
              <input
                type={type || "text"}
                className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">Preferred Language</span>
            <select
              value={form.language}
              onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
            >
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">Gender</span>
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="NON_BINARY">Non-binary</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-strawberry-900">Years Experience</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-strawberry-100 bg-background px-3 py-2 text-foreground"
              value={form.yearsExperience}
              onChange={(e) => setForm((p) => ({ ...p, yearsExperience: Number(e.target.value || 0) }))}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.textOk} onChange={(e) => setForm((p) => ({ ...p, textOk: e.target.checked }))} /> Text OK</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.emailOk} onChange={(e) => setForm((p) => ({ ...p, emailOk: e.target.checked }))} /> Email OK</label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">Next</button>
        </div>
      </div>}

      {activeStep === 2 && <div id="dates" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">2) Festival Dates & Requirements</h3>
        <p className="text-sm text-foreground/85">Start date is Feb 26 - March 8, 2026</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {shiftsByDate.map(([date, items]) => (
            <div key={date} className="rounded-xl border border-strawberry-100 bg-background p-2">
              <p className="text-xs font-bold uppercase text-strawberry-300">{format(new Date(`${date}T00:00:00`), "EEE")}</p>
              <p className="text-lg font-black text-strawberry-900">{format(new Date(`${date}T00:00:00`), "d")}</p>
              <div className="mt-1 space-y-1">
                {items
                  .filter(
                    (s) =>
                      s.shiftType === ShiftType.BOOTH_DAY ||
                      s.shiftType === ShiftType.BOOTH_NIGHT ||
                      s.shiftType === ShiftType.HALL_EARLY_SETUP,
                  )
                  .map((shift) => (
                    <label key={shift.id} className="flex items-center gap-2 text-xs text-foreground/90">
                      <input type="checkbox" checked={selectedShiftIds.includes(shift.id)} onChange={() => toggleShift(shift.id)} />
                      {shift.label}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-xl border border-strawberry-100 bg-muted p-2"><strong>Orientation</strong><br />Choose your orientation slot during signup.</div>
          <div className="rounded-xl border border-strawberry-100 bg-muted p-2"><strong>Dress Code</strong><br />White shirt + white hat preferred.</div>
          <div className="rounded-xl border border-strawberry-100 bg-muted p-2"><strong>Physical</strong><br />Lifting options are acknowledged below.</div>
        </div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">Back</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">Next</button>
        </div>
      </div>}

      {activeStep === 3 && <div id="jobs" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">3) Job Selection</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setPrefMode("BOOTH_DAY")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${prefMode === "BOOTH_DAY" ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-foreground"}`}>Booth Day</button>
          <button onClick={() => setPrefMode("BOOTH_NIGHT")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${prefMode === "BOOTH_NIGHT" ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-foreground"}`}>Booth Night</button>
          <button onClick={() => setPrefMode("HALL")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${prefMode === "HALL" ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-foreground"}`}>Hall</button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {activeRoles.map((role) => {
            const selected = activePrefs.some((x) => x.roleId === role.id);
            return (
              <article key={role.id} className={`rounded-xl border p-2 ${selected ? "border-leaf-500 bg-leaf-200/40" : "border-strawberry-100 bg-background"}`}>
                <p className="text-sm font-semibold text-strawberry-900">{role.name}</p>
                <p className="mt-1 line-clamp-3 text-[11px] text-foreground/80">{role.description}</p>
                <button onClick={() => applyRole(role)} className="mt-2 w-full rounded-lg bg-strawberry-500 px-2 py-1.5 text-xs font-semibold text-white">
                  {selected ? "Selected" : "Apply"}
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-3">
          <p className="text-sm font-semibold text-strawberry-900">Selected {prefMode.replace("_", " ")} preferences</p>
          {activePrefs.length === 0 ? (
            <p className="text-xs text-foreground/75">No roles selected yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {activePrefs.map((pref, idx) => (
                <li key={pref.roleId} className="flex items-center justify-between rounded-lg border border-strawberry-100 px-2 py-1">
                  <span>{idx + 1}. {pref.roleName}</span>
                  <span className="flex gap-1">
                    <button onClick={() => movePref(idx, "up")} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">↑</button>
                    <button onClick={() => movePref(idx, "down")} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">↓</button>
                    <button onClick={() => removePref(pref.roleId)} className="rounded border border-strawberry-100 bg-muted px-2 text-xs">Remove</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-3 text-sm">
          <p className="font-semibold text-strawberry-900">Willing to do any role if needed</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.willingAnyBoothDay}
                onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothDay: e.target.checked }))}
              />
              Booth Day
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.willingAnyBoothNight}
                onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothNight: e.target.checked }))}
              />
              Booth Night
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">Back</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">Next</button>
        </div>
      </div>}

      {activeStep === 4 && <div id="acknowledgements" className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">4) Acknowledgements</h3>
        <p className="text-sm text-foreground/85">Confirm the required acknowledgements below. The optional ones expand which roles you can be assigned to.</p>
        <div className="mt-4 space-y-2 text-sm">
          <p className="rounded-md border border-strawberry-100 bg-muted p-3 text-foreground">
            <AlertCircle className="mr-2 inline h-4 w-4 text-strawberry-300" />
            Required: age 18+, standing/walking, liability and food-safety acknowledgements.
          </p>
          {[
            ["I confirm I am at least 18 years old", "age18Plus"],
            ["I can stand/walk for booth roles", "standingWalking"],
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
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={prevStep} className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold">Back</button>
          <button type="button" onClick={nextStep} className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white">Next</button>
        </div>
      </div>}

      {activeStep === 5 && <div className="panel rounded-2xl border border-strawberry-100 p-4 shadow-sm">
        <h3 className="text-xl font-black text-strawberry-900">5) Summary, Contact & Sign Up</h3>
        <p className="mt-1 text-sm text-foreground/85">Complete the required acknowledgements before submitting.</p>

        <div className="mt-3 space-y-2 text-sm">
          <p className="rounded-lg bg-background p-2 text-foreground"><strong>Volunteer:</strong> {form.firstName} {form.lastName || "(last name missing)"}</p>
          <p className="rounded-lg bg-background p-2 text-foreground"><strong>Contact:</strong> {form.phone || "-"} / {form.email || "-"}</p>
          <p className="rounded-lg bg-background p-2 text-foreground"><strong>Selected shifts:</strong> {selectedShiftIds.length}</p>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={prevStep}
            className="rounded-full border border-strawberry-100 bg-background px-6 py-2 text-sm font-semibold text-foreground"
          >
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !requiredAcknowledgementsComplete}
            className="rounded-full bg-strawberry-500 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Sign Up"}
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
            Clear Selections
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf-500 px-3 py-1 text-xs font-semibold text-white">
            <CircleCheck className="h-4 w-4" /> Menus and action buttons active
          </span>
        </div>
      </div>}

      {error && activeStep !== 5 && (
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
