"use client";

/* eslint-disable @next/next/no-img-element */
import { RoleModule, type Role, type Shift } from "@prisma/client";
import { differenceInYears, format } from "date-fns";
import { useMemo, useState } from "react";
import { useLang } from "@/components/i18n/language-provider";

type Props = {
  shifts: Shift[];
  roles: Role[];
};

type Choice = { roleId: string; roleName: string };

const FESTIVAL_START_FOR_AGE = new Date("2027-03-04T12:00:00Z");

function shiftShortLabel(shiftType: string) {
  if (shiftType === "BOOTH_SETUP") return "Early Setup (6 AM)";
  if (shiftType === "BOOTH_DAY") return "Day (9:30–5:30)";
  if (shiftType === "BOOTH_NIGHT") return "Night (5–11)";
  if (shiftType === "BOOTH_PACKUP") return "Pack-Up Morning";
  return shiftType;
}

export function SignupWizard({ shifts, roles }: Props) {
  const { t } = useLang();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [areaTab, setAreaTab] = useState<"BOOTH" | "HALL">("BOOTH");
  const [confirmRole, setConfirmRole] = useState<Role | null>(null);
  const [hallPopup, setHallPopup] = useState<Role | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    address: "",
    gender: "" as "" | "FEMALE" | "MALE",
    language: "ENGLISH" as "ENGLISH" | "SPANISH" | "BOTH",
    firstTimeVolunteer: null as boolean | null,
    orientationRsvp: null as null | "WILL_ATTEND" | "WILL_NOT_ATTEND",
    parentConsent: false,
    yearsExperience: 0,
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyOptIn: false,
    emergencyDates: [] as string[],
    textOk: false,
    emailOk: true,
    willingAnyBoothDay: false,
    willingAnyBoothNight: false,
  });

  const [physical, setPhysical] = useState({
    standingWalking: false,
    liftingCapacityLbs: 0 as 0 | 25 | 50,
    cashHandling: false,
    outdoorSun: false,
    liabilityAcknowledged: false,
    foodRulesAcknowledged: false,
  });

  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);

  const age = useMemo(() => {
    if (!form.dob) return null;
    const d = new Date(`${form.dob}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return differenceInYears(FESTIVAL_START_FOR_AGE, d);
  }, [form.dob]);

  const shiftsByDate = useMemo(() => {
    const grouped = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = format(new Date(shift.date), "yyyy-MM-dd");
      grouped.set(key, [...(grouped.get(key) || []), shift]);
    }
    return [...grouped.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [shifts]);

  const allDateKeys = useMemo(() => shiftsByDate.map(([d]) => d), [shiftsByDate]);

  const boothPositions = roles.filter((r) => r.module === RoleModule.BOOTH && !r.manualOnly && !r.infoOnly);
  const hallPositions = roles.filter((r) => r.module === RoleModule.HALL);

  const step1Valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.dob.trim().length > 0 &&
    form.phone.trim().length >= 7 &&
    form.address.trim().length > 0 &&
    form.email.includes("@") &&
    form.emergencyContactName.trim().length > 0 &&
    form.emergencyContactPhone.trim().length >= 7 &&
    form.gender !== "" &&
    form.firstTimeVolunteer !== null;
  const step2Valid = selectedShiftIds.length > 0;
  const step3Valid = choices.length > 0 || form.willingAnyBoothDay || form.willingAnyBoothNight;
  const step4Valid = physical.liabilityAcknowledged && physical.foodRulesAcknowledged;

  function nextStep() {
    setError(null);
    if (activeStep === 1 && !step1Valid) {
      setError("Please fill in every box in this step — that way we can reach you about your shifts.");
      return;
    }
    if (activeStep === 2 && !step2Valid) {
      setError("Please pick at least one day you can help.");
      return;
    }
    if (activeStep === 3 && !step3Valid) {
      setError("Please pick at least one job, or check a \"put me anywhere\" box.");
      return;
    }
    if (activeStep === 4 && !step4Valid) {
      setError("Please check the two required boxes (responsibility and food safety) to continue.");
      return;
    }
    setActiveStep((s) => (s < 5 ? ((s + 1) as 1 | 2 | 3 | 4 | 5) : s));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prevStep() {
    setError(null);
    setActiveStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s));
  }

  function toggleShift(id: string) {
    setSelectedShiftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleEmergencyDate(dateKey: string) {
    setForm((p) => ({
      ...p,
      emergencyDates: p.emergencyDates.includes(dateKey)
        ? p.emergencyDates.filter((d) => d !== dateKey)
        : [...p.emergencyDates, dateKey],
    }));
  }

  function addChoice(role: Role) {
    setChoices((prev) => {
      if (prev.some((c) => c.roleId === role.id) || prev.length >= 3) return prev;
      return [...prev, { roleId: role.id, roleName: role.name }];
    });
    setConfirmRole(null);
  }

  function removeChoice(roleId: string) {
    setChoices((prev) => prev.filter((c) => c.roleId !== roleId));
  }

  function moveChoice(idx: number, dir: "up" | "down") {
    setChoices((prev) => {
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function submit() {
    if (!step4Valid) {
      setError("Please check the two required boxes (responsibility and food safety) before signing up.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const preferences = choices.flatMap((choice, idx) =>
        selectedShiftIds.map((shiftId) => ({ shiftId, roleId: choice.roleId, rank: idx + 1 })),
      );

      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          email: form.email,
          phone: form.phone,
          address: form.address,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          gender: form.gender,
          language: form.language,
          firstTimeVolunteer: !!form.firstTimeVolunteer,
          orientationRsvp: form.firstTimeVolunteer ? form.orientationRsvp : null,
          parentConsent: form.parentConsent,
          emergencyOptIn: form.emergencyOptIn,
          emergencyDates: form.emergencyOptIn ? form.emergencyDates : [],
          textOk: form.textOk,
          emailOk: form.emailOk,
          yearsExperience: form.yearsExperience,
          willingAnyBoothDay: form.willingAnyBoothDay,
          willingAnyBoothNight: form.willingAnyBoothNight,
          acknowledgements: physical,
          availabilityShiftIds: selectedShiftIds,
          preferences,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong — please try again.");
      setResult(data.volunteerId as string);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="panel mx-auto max-w-xl p-6 text-center">
        <img src="/brand/tipper.svg" alt="" className="mx-auto w-28" />
        <h2 className="mt-2 text-3xl font-black text-strawberry-700">{t("You're all signed up!")} 🍓</h2>
        <p className="mt-3 rounded-xl bg-sunny-100 p-3 text-lg font-black tracking-wide text-strawberry-900">
          {t("Your Volunteer ID:")} {result}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">
          {t("Keep this number — it's how we'll list you on schedules. A coordinator will confirm your shifts closer to the festival. Watch for a confirmation by text or email.")}
        </p>
        <button onClick={() => window.print()} className="ops-btn ops-btn-primary tap-target mt-4 px-6 py-2 text-sm">
          {t("Print Confirmation")}
        </button>
      </section>
    );
  }

  const stepChips = (
    <div className="flex flex-wrap gap-2 text-xs">
      {[
        [1, "1. About You"],
        [2, "2. Your Days"],
        [3, "3. Your Jobs"],
        [4, "4. Health & Safety"],
        [5, "5. Review & Sign Up"],
      ].map(([step, label]) => (
        <button
          key={String(step)}
          type="button"
          onClick={() => setActiveStep(step as 1 | 2 | 3 | 4 | 5)}
          className={`tap-target rounded-full px-4 py-2 font-bold ${
            activeStep === step ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-strawberry-900 hover:bg-strawberry-50"
          }`}
        >
          {t(label as string)}
        </button>
      ))}
    </div>
  );

  const inputClass =
    "w-full rounded-xl border border-strawberry-100 bg-background px-3 py-3 text-base text-foreground";

  return (
    <div className="space-y-4">
      {confirmRole && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmRole(null)}>
          <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-strawberry-900">{t(confirmRole.name)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{t(confirmRole.description)}</p>
            <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
              <p className="font-bold text-strawberry-700">{t("Before you pick this job, please know:")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
                {confirmRole.physicalDemands && <li>{t(confirmRole.physicalDemands)}</li>}
                {confirmRole.minAge > 0 && <li>{t("Minimum age:")} {confirmRole.minAge}</li>}
                {confirmRole.liftLimitLbs > 0 && <li>{t("Lifting up to")} {confirmRole.liftLimitLbs} lbs</li>}
                {confirmRole.requiredGender && (
                  <li>{confirmRole.requiredGender === "FEMALE" ? t("This position is for female volunteers") : t("This position is for male volunteers")}</li>
                )}
                {confirmRole.requiresTraining && <li>{t("Training required before scheduling")}</li>}
                {confirmRole.requiresCash && <li>{t("Handles cash")}</li>}
                {confirmRole.requiresOutdoor && <li>{t("Outdoors in the sun")}</li>}
              </ul>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmRole(null)} className="ops-btn ops-btn-ghost tap-target flex-1 px-4 py-2 text-sm">
                {t("Go Back")}
              </button>
              <button onClick={() => addChoice(confirmRole)} className="ops-btn ops-btn-primary tap-target flex-1 px-4 py-2 text-sm">
                {t("Add as choice")} #{choices.length + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {hallPopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setHallPopup(null)}>
          <div className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-leaf-700">{t(hallPopup.name)}</h3>
            <p className="mt-2 text-sm text-foreground/90">{t(hallPopup.description)}</p>
            {hallPopup.contactNote && <p className="mt-2 text-sm font-semibold text-leaf-700">{t(hallPopup.contactNote)}</p>}
            {hallPopup.contactName && hallPopup.contactPhone ? (
              <div className="mt-4 rounded-xl bg-leaf-200 p-4 text-center">
                <p className="text-sm font-bold text-leaf-700">{t("To sign up, call")} {hallPopup.contactName}</p>
                <a href={`tel:${hallPopup.contactPhone}`} className="mt-1 block text-2xl font-black text-strawberry-700 underline">
                  {hallPopup.contactPhone}
                </a>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{t("Ask at the hall — no phone sign-up needed.")}</p>
            )}
            <button onClick={() => setHallPopup(null)} className="ops-btn ops-btn-primary tap-target mt-4 w-full px-4 py-2 text-sm">
              {t("Close")}
            </button>
          </div>
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-strawberry-700">
              {t("Volunteer for St. Clement Make Your Own Strawberry Shortcake Project.")}
            </h1>
            <p className="mt-2 text-base text-foreground/85">{t("Five easy steps. Simple for young and old.")}</p>
            <div className="mt-4">{stepChips}</div>
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <img src="/brand/tipper.svg" alt="" className="w-24" />
            <img src="/brand/topper.svg" alt="" className="w-24" />
          </div>
        </div>
      </section>

      <section className="space-y-5 text-foreground">
      {activeStep === 1 && (
        <div className="panel p-5">
          <h3 className="text-xl font-black text-strawberry-900">{t("1) About You")}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(
              [
                ["First Name", "firstName", "text"],
                ["Last Name", "lastName", "text"],
                ["Date of Birth", "dob", "date"],
                ["Cell Phone", "phone", "tel"],
                ["Email", "email", "email"],
                ["Home Address", "address", "text"],
                ["Emergency Contact Name", "emergencyContactName", "text"],
                ["Emergency Contact Phone", "emergencyContactPhone", "tel"],
              ] as const
            ).map(([label, key, type]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block font-bold text-strawberry-900">{t(label)}</span>
                <input
                  type={type}
                  className={inputClass}
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-1 block font-bold text-strawberry-900">{t("Preferred Language")}</span>
              <select
                value={form.language}
                onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as typeof form.language }))}
                className={inputClass}
              >
                <option value="ENGLISH">{t("English")}</option>
                <option value="SPANISH">{t("Spanish")}</option>
                <option value="BOTH">{t("Both English & Spanish")}</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-strawberry-900">{t("Gender")}</span>
              <select
                value={form.gender}
                onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as typeof form.gender }))}
                className={inputClass}
              >
                <option value="" disabled>{t("Select…")}</option>
                <option value="FEMALE">{t("Female")}</option>
                <option value="MALE">{t("Male")}</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-bold text-strawberry-900">{t("How many years have you volunteered with us before?")}</span>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.yearsExperience}
                onChange={(e) => setForm((p) => ({ ...p, yearsExperience: Math.max(0, Number(e.target.value || 0)) }))}
              />
              <span className="mt-1 block text-xs text-foreground/70">
                {t("Returning volunteers get scheduled first — thank you for coming back!")}
              </span>
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-bold text-strawberry-900">{t("Is this your first time volunteering with us?")}</span>
              <div className="flex gap-2">
                {[
                  [true, "Yes"],
                  [false, "No"],
                ].map(([val, label]) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, firstTimeVolunteer: val as boolean, yearsExperience: val ? 0 : p.yearsExperience }))}
                    className={`tap-target flex-1 rounded-xl border px-4 py-2 font-bold ${
                      form.firstTimeVolunteer === val ? "border-leaf-500 bg-leaf-200 text-leaf-700" : "border-strawberry-100 bg-background"
                    }`}
                  >
                    {t(label as string)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {form.firstTimeVolunteer === true && (
            <div className="mt-4 rounded-2xl border-2 border-sunny-400 bg-sunny-100 p-4">
              <p className="font-black text-strawberry-700">{t("Welcome! Orientation is for you.")}</p>
              <p className="mt-1 text-sm">{t("Sunday, January 31, 2027 · St. Clement Cronin Hall · 5:00–7:00 PM.")}</p>
              <div className="mt-2 flex gap-2">
                {(
                  [
                    ["WILL_ATTEND", "I will attend"],
                    ["WILL_NOT_ATTEND", "I can't attend"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, orientationRsvp: val }))}
                    className={`tap-target flex-1 rounded-xl border px-4 py-2 text-sm font-bold ${
                      form.orientationRsvp === val ? "border-leaf-500 bg-leaf-200 text-leaf-700" : "border-sunny-400 bg-card"
                    }`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {age !== null && age >= 16 && age < 18 && (
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-strawberry-100 bg-background p-4 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={form.parentConsent}
                onChange={(e) => setForm((p) => ({ ...p, parentConsent: e.target.checked }))}
              />
              <span>
                <span className="font-bold text-strawberry-900">{t("I have a parent or guardian's OK to volunteer.")}</span>{" "}
                {t("(For volunteers age 16–17.)")}
              </span>
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="tap-target inline-flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={form.textOk} onChange={(e) => setForm((p) => ({ ...p, textOk: e.target.checked }))} />
              {t("OK to text me reminders")}
            </label>
            <label className="tap-target inline-flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={form.emailOk} onChange={(e) => setForm((p) => ({ ...p, emailOk: e.target.checked }))} />
              {t("OK to email me updates")}
            </label>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground/60">
            {t("By checking \"OK to text me,\" you agree to receive volunteer scheduling texts (confirmations and shift reminders) from St. Clement Strawberry Festival. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.")}{" "}
            <a href="/sms-terms" target="_blank" rel="noreferrer" className="underline">{t("SMS Terms")}</a>
            {" · "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">{t("Privacy Policy")}</a>
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={nextStep} className="ops-btn ops-btn-primary tap-target px-8 py-3 text-base">{t("Next")}</button>
          </div>
        </div>
      )}

      {activeStep === 2 && (
        <div className="panel p-5">
          <h3 className="text-xl font-black text-strawberry-900">{t("2) Your Days")}</h3>
          <p className="mt-1 text-sm text-foreground/85">
            {t("The festival runs March 4–14, 2027, plus pack-up on the morning of March 15. Tap every shift you could work — picking a day doesn't lock you in, it just tells us when you're free.")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {shiftsByDate.map(([date, items]) => (
              <div key={date} className="rounded-xl border border-strawberry-100 bg-background p-3">
                <p className="text-xs font-black uppercase text-strawberry-300">{format(new Date(`${date}T00:00:00`), "EEEE")}</p>
                <p className="text-2xl font-black text-strawberry-900">{format(new Date(`${date}T00:00:00`), "MMM d")}</p>
                <div className="mt-2 space-y-1.5">
                  {items.map((shift) => {
                    const on = selectedShiftIds.includes(shift.id);
                    return (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => toggleShift(shift.id)}
                        className={`tap-target w-full rounded-lg border px-2 py-2 text-left text-sm font-semibold ${
                          on ? "border-leaf-500 bg-leaf-200 text-leaf-700" : "border-strawberry-100 bg-card text-foreground hover:bg-strawberry-50"
                        }`}
                      >
                        {on ? "✓ " : ""}{t(shiftShortLabel(shift.shiftType))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-strawberry-100 bg-background p-4">
            <label className="tap-target flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={form.emergencyOptIn}
                onChange={(e) => setForm((p) => ({ ...p, emergencyOptIn: e.target.checked }))}
              />
              <span>
                <span className="font-bold text-strawberry-900">{t("Add me to the emergency call list.")}</span>{" "}
                {t("If someone can't make it, we may call you last-minute on the days you choose.")}
              </span>
            </label>
            {form.emergencyOptIn && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {allDateKeys.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleEmergencyDate(d)}
                    className={`tap-target rounded-full border px-3 py-1.5 text-xs font-bold ${
                      form.emergencyDates.includes(d) ? "border-strawberry-500 bg-strawberry-50 text-strawberry-700" : "border-strawberry-100 bg-card"
                    }`}
                  >
                    {format(new Date(`${d}T00:00:00`), "MMM d")}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between">
            <button type="button" onClick={prevStep} className="ops-btn ops-btn-ghost tap-target px-6 py-3 text-base">{t("Back")}</button>
            <button type="button" onClick={nextStep} className="ops-btn ops-btn-primary tap-target px-8 py-3 text-base">{t("Next")}</button>
          </div>
        </div>
      )}

      {activeStep === 3 && (
        <div className="panel p-5">
          <h3 className="text-xl font-black text-strawberry-900">{t("3) Your Jobs")}</h3>
          <p className="mt-1 text-sm text-foreground/85">
            {t("Pick up to three booth jobs in the order you'd like them — 1st, 2nd, and 3rd choice. Tap a job to read what it involves before you add it.")}
          </p>
          <div className="mb-3 mt-3 flex gap-2">
            {(["BOOTH", "HALL"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAreaTab(a)}
                className={`tap-target rounded-full px-6 py-2 text-sm font-black ${
                  areaTab === a ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-background text-strawberry-900 hover:bg-strawberry-50"
                }`}
              >
                {a === "BOOTH" ? t("Booth Jobs") : t("Hall Jobs (call to sign up)")}
              </button>
            ))}
          </div>

          {areaTab === "BOOTH" && (
            <>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {boothPositions.map((role) => {
                  const chosenIdx = choices.findIndex((c) => c.roleId === role.id);
                  const chosen = chosenIdx !== -1;
                  return (
                    <article key={role.id} className={`rounded-xl border p-3 ${chosen ? "border-leaf-500 bg-leaf-200/50" : "border-strawberry-100 bg-background"}`}>
                      <p className="font-bold text-strawberry-900">{t(role.name)}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-foreground/85">{t(role.description)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] font-bold">
                        {role.physicalDemands && <span className="rounded-full bg-sunny-100 px-2 py-0.5 text-sunny-600">{t(role.physicalDemands)}</span>}
                        {role.minAge > 0 && <span className="rounded-full bg-leaf-200 px-2 py-0.5 text-leaf-700">{role.minAge}+</span>}
                      </div>
                      <button
                        onClick={() => (chosen ? removeChoice(role.id) : setConfirmRole(role))}
                        className={`tap-target mt-2 w-full rounded-lg px-2 py-2 text-sm font-bold ${
                          chosen ? "border border-leaf-500 bg-card text-leaf-700" : "bg-strawberry-500 text-white"
                        }`}
                      >
                        {chosen ? `${t("Choice")} #${chosenIdx + 1} — ${t("tap to remove")}` : t("Pick this job")}
                      </button>
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-4">
                <p className="font-bold text-strawberry-900">{t("Your choices (in order)")}</p>
                {choices.length === 0 ? (
                  <p className="mt-1 text-sm text-foreground/75">{t("No jobs picked yet.")}</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {choices.map((choice, idx) => (
                      <li key={choice.roleId} className="flex items-center justify-between rounded-lg border border-strawberry-100 px-3 py-2">
                        <span className="font-semibold">{idx + 1}. {t(choice.roleName)}</span>
                        <span className="flex gap-1">
                          <button onClick={() => moveChoice(idx, "up")} className="tap-target rounded-lg border border-strawberry-100 bg-muted px-3 text-base">↑</button>
                          <button onClick={() => moveChoice(idx, "down")} className="tap-target rounded-lg border border-strawberry-100 bg-muted px-3 text-base">↓</button>
                          <button onClick={() => removeChoice(choice.roleId)} className="tap-target rounded-lg border border-strawberry-100 bg-muted px-3 text-sm">{t("Remove")}</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-strawberry-100 bg-background p-4 text-sm">
                <p className="font-bold text-strawberry-900">{t("Happy to help anywhere?")}</p>
                <div className="mt-2 flex flex-wrap gap-5">
                  <label className="tap-target inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={form.willingAnyBoothDay}
                      onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothDay: e.target.checked }))}
                    />
                    {t("Put me anywhere — Day shifts")}
                  </label>
                  <label className="tap-target inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={form.willingAnyBoothNight}
                      onChange={(e) => setForm((p) => ({ ...p, willingAnyBoothNight: e.target.checked }))}
                    />
                    {t("Put me anywhere — Night shifts")}
                  </label>
                </div>
              </div>
            </>
          )}

          {areaTab === "HALL" && (
            <div>
              <p className="rounded-xl bg-leaf-200/50 p-3 text-sm text-leaf-700">
                {t("Hall jobs (March 3–14, lunch provided) are organized by phone — tap a job to see who to call. There's nothing to select here.")}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {hallPositions.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setHallPopup(role)}
                    className="tap-target rounded-xl border border-leaf-500/40 bg-background p-3 text-left hover:bg-leaf-200/40"
                  >
                    <p className="font-bold text-leaf-700">
                      {t(role.name)}{" "}
                      {role.urgent && <span className="rounded bg-strawberry-500 px-1.5 py-0.5 text-[10px] font-black text-white">{t("URGENTLY NEEDED")}</span>}
                    </p>
                    <p className="mt-1 text-xs text-foreground/85">{t(role.description)}</p>
                    <p className="mt-1.5 text-xs font-bold text-strawberry-700 underline">📞 {t("Tap for contact info")}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <button type="button" onClick={prevStep} className="ops-btn ops-btn-ghost tap-target px-6 py-3 text-base">{t("Back")}</button>
            <button type="button" onClick={nextStep} className="ops-btn ops-btn-primary tap-target px-8 py-3 text-base">{t("Next")}</button>
          </div>
        </div>
      )}

      {activeStep === 4 && (
        <div className="panel p-5">
          <h3 className="text-xl font-black text-strawberry-900">{t("4) Health & Safety")}</h3>
          <p className="mt-1 text-sm text-foreground/85">
            {t("These answers help us place you in a job that fits. There are no wrong answers.")}
          </p>

          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-xl border border-strawberry-100 bg-background p-4">
              <p className="font-bold text-strawberry-900">{t("Can you stand and walk for most of a shift?")}</p>
              <div className="mt-2 flex gap-2">
                {[
                  [true, "Yes"],
                  [false, "No / I'd rather not"],
                ].map(([val, label]) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setPhysical((p) => ({ ...p, standingWalking: val as boolean }))}
                    className={`tap-target flex-1 rounded-xl border px-4 py-2 font-bold ${
                      physical.standingWalking === val ? "border-leaf-500 bg-leaf-200 text-leaf-700" : "border-strawberry-100 bg-card"
                    }`}
                  >
                    {t(label as string)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-strawberry-100 bg-background p-4">
              <p className="font-bold text-strawberry-900">{t("How much can you comfortably lift?")}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    [0, "Light things only"],
                    [25, "Up to 25 lbs"],
                    [50, "Up to 50 lbs"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPhysical((p) => ({ ...p, liftingCapacityLbs: val }))}
                    className={`tap-target rounded-xl border px-2 py-2 font-bold ${
                      physical.liftingCapacityLbs === val ? "border-leaf-500 bg-leaf-200 text-leaf-700" : "border-strawberry-100 bg-card"
                    }`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>

            <label className="tap-target flex items-center gap-3 rounded-xl border border-strawberry-100 bg-background p-4">
              <input type="checkbox" className="h-5 w-5" checked={physical.cashHandling} onChange={(e) => setPhysical((p) => ({ ...p, cashHandling: e.target.checked }))} />
              {t("I'm comfortable handling cash (for Cashier / Coffee jobs)")}
            </label>
            <label className="tap-target flex items-center gap-3 rounded-xl border border-strawberry-100 bg-background p-4">
              <input type="checkbox" className="h-5 w-5" checked={physical.outdoorSun} onChange={(e) => setPhysical((p) => ({ ...p, outdoorSun: e.target.checked }))} />
              {t("I'm OK working outdoors in the sun (for Crowd Control)")}
            </label>

            <p className="rounded-xl bg-sunny-100 p-3 text-sm font-semibold text-strawberry-900">
              {t("These last two are required for everyone:")}
            </p>
            <label className="tap-target flex items-start gap-3 rounded-xl border border-strawberry-100 bg-background p-4">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={physical.liabilityAcknowledged} onChange={(e) => setPhysical((p) => ({ ...p, liabilityAcknowledged: e.target.checked }))} />
              {t("I accept the volunteer participation responsibility statement")}
            </label>
            <label className="tap-target flex items-start gap-3 rounded-xl border border-strawberry-100 bg-background p-4">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={physical.foodRulesAcknowledged} onChange={(e) => setPhysical((p) => ({ ...p, foodRulesAcknowledged: e.target.checked }))} />
              {t("I agree to follow the food handling and safety rules")}
            </label>
          </div>

          <div className="mt-4 flex justify-between">
            <button type="button" onClick={prevStep} className="ops-btn ops-btn-ghost tap-target px-6 py-3 text-base">{t("Back")}</button>
            <button type="button" onClick={nextStep} className="ops-btn ops-btn-primary tap-target px-8 py-3 text-base">{t("Next")}</button>
          </div>
        </div>
      )}

      {activeStep === 5 && (
        <div className="panel p-5">
          <h3 className="text-xl font-black text-strawberry-900">{t("5) Review & Sign Up")}</h3>
          <p className="mt-1 text-sm text-foreground/85">{t("One quick look before you finish.")}</p>

          <div className="mt-3 space-y-2 text-sm">
            <p className="rounded-xl bg-background p-3"><strong>{t("Volunteer:")}</strong> {form.firstName} {form.lastName}</p>
            <p className="rounded-xl bg-background p-3"><strong>{t("Contact:")}</strong> {form.phone || "-"} · {form.email || "-"}</p>
            <div className="rounded-xl bg-background p-3">
              <strong>{t("Your days:")}</strong>
              {selectedShiftIds.length === 0 ? (
                <span> {t("none selected")}</span>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {shifts
                    .filter((s) => selectedShiftIds.includes(s.id))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((s) => (
                      <li key={s.id}>{format(new Date(s.date), "EEE MMM d")} — {t(shiftShortLabel(s.shiftType))}</li>
                    ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl bg-background p-3">
              <strong>{t("Job choices:")}</strong>
              {choices.length === 0 ? (
                <span> {t("willing to help where needed")}</span>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {choices.map((c, i) => (
                    <li key={c.roleId}>{i + 1}. {t(c.roleName)}</li>
                  ))}
                </ul>
              )}
              {(form.willingAnyBoothDay || form.willingAnyBoothNight) && (
                <p className="mt-1 text-xs text-leaf-700">
                  {t("Put me anywhere:")} {[form.willingAnyBoothDay && t("Day"), form.willingAnyBoothNight && t("Night")].filter(Boolean).join(" + ")}
                </p>
              )}
            </div>
            {form.emergencyOptIn && (
              <p className="rounded-xl bg-background p-3 text-xs">
                <strong>{t("Emergency call list:")}</strong>{" "}
                {form.emergencyDates.length > 0
                  ? form.emergencyDates.map((d) => format(new Date(`${d}T00:00:00`), "MMM d")).join(", ")
                  : t("any day")}
              </p>
            )}
          </div>

          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{t(error)}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={prevStep} className="ops-btn ops-btn-ghost tap-target px-6 py-3 text-base">
              {t("Back")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !step4Valid}
              className="ops-btn ops-btn-primary tap-target px-8 py-3 text-base disabled:opacity-60"
            >
              {submitting ? t("Signing you up…") : `🍓 ${t("Sign Me Up!")}`}
            </button>
          </div>
        </div>
      )}

      {error && activeStep !== 5 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{t(error)}</p>
      )}
      </section>
    </div>
  );
}
