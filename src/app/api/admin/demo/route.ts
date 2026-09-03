import { FlagType, Gender, LanguagePreference, NoteCategory, ShiftType, VerificationMethod, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { volunteerCodeFor } from "@/lib/festival";

// -----------------------------------------------------------------------------
// Demo Mode: loads a curated cast of fake Disney-character volunteers whose
// demographics are engineered so that every flag and scheduler trigger in the
// system fires at least once — and removes them again cleanly.
//
// All demo volunteers share the DEMO_EMAIL_DOMAIN, which is how the UI detects
// demo mode and how DELETE removes them (notes/flags/assignments cascade).
// -----------------------------------------------------------------------------

const DEMO_EMAIL_DOMAIN = "festival.demo.local";
const DEMO_AUTHOR = "Demo Coordinator";

const F = Gender.FEMALE;
const M = Gender.MALE;

type Profile = "FULL" | "DAY" | "NIGHT" | "SETUP";

type DemoNote = { category: NoteCategory; text: string };

type CastMember = {
  first: string;
  last: string;
  gender: Gender;
  /** Age at festival start (Mar 4, 2027). */
  age: number;
  parentConsent?: boolean;
  standing?: boolean; // default true
  lifting: 0 | 25 | 50;
  cash?: boolean;
  outdoor?: boolean;
  legacy: number;
  language?: LanguagePreference;
  firstTime?: boolean;
  profile: Profile;
  /** Ranked position choices (1st, 2nd, 3rd) by Role.key. */
  prefs: string[];
  notes?: DemoNote[];
  supervisor?: "READY" | "TRAINED_ONLY";
  /** Seed a Mar 4 assignment in a state that alerts the scheduler. */
  history?: { roleKey: string; shiftType: ShiftType; kind: "CANCELLED" | "NO_SHOW" };
};

const CAST: CastMember[] = [
  // ---- Reliable veterans (legacy priority + happy paths) ----
  { first: "Mickey", last: "Mouse", gender: M, age: 58, lifting: 25, cash: true, legacy: 15, profile: "FULL",
    prefs: ["CASHIER", "TICKET_TAKER", "COFFEE_PERSON"],
    notes: [{ category: "VIP_RETURN", text: "15th year — booth royalty. Schedule him first." }] },
  { first: "Minnie", last: "Mouse", gender: F, age: 56, lifting: 25, legacy: 15, profile: "FULL",
    prefs: ["BERRY_GIRL", "SHORTCAKE_GIRL", "STICKER_PERSON"],
    notes: [{ category: "EXCELLENT", text: "Fastest Berry Girl on record. Guests ask for her by name." }] },
  { first: "Goofy", last: "Goof", gender: M, age: 52, lifting: 50, legacy: 13, profile: "SETUP",
    prefs: ["EARLY_BOOTH_SETUP", "HEAVY_DUTY_FOOD_HANDLER", "PACKUP_CREW"],
    notes: [{ category: "NEEDS_GUIDANCE", text: "Strong and willing, but drops one tray per shift. Pair with a steady partner." }] },
  { first: "Donald", last: "Duck", gender: M, age: 55, lifting: 25, outdoor: true, legacy: 12, profile: "DAY",
    prefs: ["CROWD_CONTROL", "TICKET_TAKER", "CUSTOMER_SERVICE"],
    notes: [{ category: "NEEDS_GUIDANCE", text: "Short fuse with long lines — keep him off the front of the queue at peak." }] },
  { first: "Daisy", last: "Duck", gender: F, age: 54, lifting: 25, legacy: 11, profile: "NIGHT",
    prefs: ["SHORTCAKE_GIRL", "CREAM_WHIPPER"] },
  { first: "Tiana", last: "Rose", gender: F, age: 32, lifting: 25, legacy: 10, profile: "FULL",
    prefs: ["KITCHEN_HELPER", "CREAM_WHIPPER", "SHORTCAKE_STACKER"],
    notes: [{ category: "EXCELLENT", text: "Runs the kitchen like her restaurant. Can train new helpers." }] },
  { first: "Woody", last: "Pride", gender: M, age: 45, lifting: 25, legacy: 9, profile: "FULL",
    prefs: ["SUPERVISOR", "TICKET_TAKER"], supervisor: "READY" },
  { first: "Buzz", last: "Lightyear", gender: M, age: 42, lifting: 50, outdoor: true, legacy: 8, profile: "FULL",
    prefs: ["SUPERVISOR", "CROWD_CONTROL"], supervisor: "TRAINED_ONLY" },
  { first: "Belle", last: "French", gender: F, age: 33, lifting: 0, cash: true, legacy: 8, profile: "DAY",
    prefs: ["CASHIER", "CUSTOMER_SERVICE"] },
  { first: "Cinderella", last: "Tremaine", gender: F, age: 35, lifting: 0, legacy: 9, profile: "NIGHT",
    prefs: ["SHORTCAKE_GIRL", "BERRY_GIRL", "CREAM_WHIPPER"] },
  { first: "Mulan", last: "Fa", gender: F, age: 29, lifting: 50, legacy: 7, profile: "FULL",
    prefs: ["HEAVY_DUTY_FOOD_HANDLER", "SHORTCAKE_STACKER"] },
  { first: "Hercules", last: "Olympus", gender: M, age: 30, lifting: 50, legacy: 6, profile: "SETUP",
    prefs: ["EARLY_BOOTH_SETUP", "HEAVY_DUTY_FOOD_HANDLER", "PACKUP_CREW"] },
  { first: "Elsa", last: "Arendelle", gender: F, age: 31, lifting: 25, cash: true, legacy: 5, profile: "NIGHT",
    prefs: ["CASHIER", "COFFEE_PERSON"] },
  { first: "Anna", last: "Arendelle", gender: F, age: 28, lifting: 25, legacy: 4, profile: "DAY",
    prefs: ["BERRY_GIRL", "CUSTOMER_SERVICE"] },
  { first: "Rapunzel", last: "Corona", gender: F, age: 24, lifting: 25, legacy: 3, profile: "DAY",
    prefs: ["STICKER_PERSON", "BERRY_GIRL"] },
  { first: "Maui", last: "Demigod", gender: M, age: 40, lifting: 50, legacy: 3, profile: "FULL",
    prefs: ["HEAVY_DUTY_FOOD_HANDLER", "PACKUP_CREW", "EARLY_BOOTH_SETUP"] },
  { first: "Simba", last: "Pride", gender: M, age: 26, lifting: 25, outdoor: true, legacy: 2, profile: "DAY",
    prefs: ["CROWD_CONTROL", "CUSTOMER_SERVICE"] },
  { first: "Merida", last: "DunBroch", gender: F, age: 22, lifting: 25, outdoor: true, legacy: 2, profile: "DAY",
    prefs: ["CROWD_CONTROL", "TICKET_TAKER"] },
  { first: "Pocahontas", last: "Powhatan", gender: F, age: 27, lifting: 25, outdoor: true, legacy: 6, profile: "DAY",
    prefs: ["CROWD_CONTROL", "CUSTOMER_SERVICE"] },
  { first: "Miguel", last: "Rivera", gender: M, age: 19, lifting: 25, legacy: 1, profile: "NIGHT",
    language: LanguagePreference.SPANISH,
    prefs: ["TICKET_TAKER", "CROWD_CONTROL"],
    notes: [{ category: "LANGUAGE_ONLY_SPANISH", text: "Spanish only — pair with a bilingual volunteer at the ticket line." }] },
  { first: "Quasimodo", last: "Bell", gender: M, age: 34, lifting: 50, legacy: 3, profile: "SETUP",
    prefs: ["EARLY_BOOTH_SETUP", "PACKUP_CREW"],
    notes: [{ category: "EXCELLENT", text: "Strongest setup volunteer we have. Ask him about the bell cart." }] },

  // ---- Age flags ----
  { first: "Lilo", last: "Pelekai", gender: F, age: 12, lifting: 0, legacy: 0, firstTime: true, profile: "DAY",
    prefs: ["STICKER_PERSON", "BERRY_GIRL"] }, // AGE_UNDER_16 — hard block on 16+ positions
  { first: "Peter", last: "Pan", gender: M, age: 15, lifting: 25, legacy: 0, firstTime: true, profile: "NIGHT",
    prefs: ["TICKET_TAKER", "CROWD_CONTROL"] }, // AGE_UNDER_16
  { first: "Moana", last: "Waialiki", gender: F, age: 17, parentConsent: false, lifting: 25, legacy: 1, profile: "DAY",
    prefs: ["SHORTCAKE_GIRL", "TICKET_TAKER"] }, // AGE_16_18_NO_CONSENT — soft warning
  { first: "Wendy", last: "Darling", gender: F, age: 16, parentConsent: true, lifting: 0, legacy: 0, firstTime: true, profile: "DAY",
    prefs: ["SHORTCAKE_GIRL", "STICKER_PERSON"] }, // consent on file — no flag (contrast case)

  // ---- Position-mismatch flags ----
  { first: "Gaston", last: "LeGume", gender: M, age: 35, lifting: 50, legacy: 0, profile: "DAY",
    prefs: ["BERRY_GIRL", "HEAVY_DUTY_FOOD_HANDLER"], // GENDER_MISMATCH on Berry Girl
    notes: [{ category: "NEEDS_GUIDANCE", text: "Insists he would be the best Berry Girl. He cannot be the Berry Girl." }] },
  { first: "Kristoff", last: "Bjorgman", gender: M, age: 31, lifting: 0, legacy: 5, profile: "SETUP",
    prefs: ["HEAVY_DUTY_FOOD_HANDLER", "EARLY_BOOTH_SETUP"], // LIFTING_MISMATCH ×2
    notes: [{ category: "PHYSICAL_LIMITATION", text: "Back injury from ice harvesting — no heavy lifting this season." }] },
  { first: "Odie", last: "Mama", gender: F, age: 97, standing: false, lifting: 0, cash: true, legacy: 8, profile: "DAY",
    prefs: ["TICKET_TAKER", "CASHIER"], // STANDING_MISMATCH on both
    notes: [{ category: "PHYSICAL_LIMITATION", text: "Needs a chair at her station — do not schedule standing-only spots." }] },

  // ---- Scheduler triggers: exclusions and needs-replacement ----
  { first: "Scar", last: "Pridelands", gender: M, age: 48, lifting: 25, cash: true, legacy: 10, profile: "DAY",
    prefs: ["CASHIER", "TICKET_TAKER"],
    notes: [{ category: "DO_NOT_SCHEDULE", text: "Cash drawer came up short twice in 2026. Do not place him — despite 10 years of legacy." }] },
  { first: "Hades", last: "Underworld", gender: M, age: 44, lifting: 25, outdoor: true, legacy: 4, profile: "DAY",
    prefs: ["CROWD_CONTROL", "CUSTOMER_SERVICE"],
    notes: [{ category: "CALLOUT_HISTORY", text: "Cancels whenever things get too hot. Two callouts in 2026." }],
    history: { roleKey: "CROWD_CONTROL", shiftType: ShiftType.BOOTH_DAY, kind: "CANCELLED" } },
  { first: "Ursula", last: "Seawitch", gender: F, age: 51, lifting: 25, cash: true, legacy: 6, profile: "DAY",
    prefs: ["CASHIER", "COFFEE_PERSON"],
    notes: [{ category: "CALLOUT_HISTORY", text: "Texted NO an hour before her 2026 shift. Have a backup ready." }],
    history: { roleKey: "CASHIER", shiftType: ShiftType.BOOTH_DAY, kind: "CANCELLED" } },
  { first: "James", last: "Hook", gender: M, age: 49, lifting: 25, cash: true, legacy: 7, profile: "NIGHT",
    prefs: ["TICKET_TAKER", "COFFEE_PERSON"],
    notes: [{ category: "CALLOUT_HISTORY", text: "No-showed opening night 2026 — 'crocodile trouble'." }],
    history: { roleKey: "TICKET_TAKER", shiftType: ShiftType.BOOTH_NIGHT, kind: "NO_SHOW" } },
];

function profileShiftTypes(p: Profile): ShiftType[] {
  switch (p) {
    case "FULL":
      return [ShiftType.BOOTH_SETUP, ShiftType.BOOTH_DAY, ShiftType.BOOTH_NIGHT, ShiftType.BOOTH_PACKUP];
    case "DAY":
      return [ShiftType.BOOTH_DAY, ShiftType.BOOTH_PACKUP];
    case "NIGHT":
      return [ShiftType.BOOTH_NIGHT];
    case "SETUP":
      return [ShiftType.BOOTH_SETUP, ShiftType.BOOTH_DAY, ShiftType.BOOTH_PACKUP];
  }
}

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shifts = await prisma.shift.findMany({ select: { id: true, date: true, shiftType: true } });
    if (shifts.length === 0) {
      return NextResponse.json({ error: "No shifts found. Seed the calendar first." }, { status: 400 });
    }
    const roles = await prisma.role.findMany();
    const roleByKey = new Map(roles.map((r) => [r.key, r]));
    const supervisorRole = roleByKey.get("SUPERVISOR");

    // Idempotent: clear any previous demo cast first.
    await prisma.volunteer.deleteMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } });

    const firstDayShifts = new Map(
      shifts
        .filter((s) => s.date.getTime() === Math.min(...shifts.map((x) => x.date.getTime())))
        .map((s) => [s.shiftType, s]),
    );

    const baseSignup = Date.now() - CAST.length * 60_000;
    let flagCount = 0;
    let noteCount = 0;
    let historyCount = 0;

    for (let i = 0; i < CAST.length; i += 1) {
      const c = CAST[i];
      const standing = c.standing ?? true;
      const dob = new Date(Date.UTC(2027 - c.age, 0, 15)); // exact age on Mar 4, 2027
      const email = `${c.first.toLowerCase()}.${c.last.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`;
      const phone = `813-555-${String(100 + i).padStart(4, "0")}`;

      const volunteer = await prisma.volunteer.create({
        data: {
          firstName: c.first,
          lastName: c.last,
          dob,
          ageConfirmed: true,
          email,
          phone,
          address: `${100 + i} Magic Kingdom Way, Plant City, FL`,
          emergencyContactName: "Walt Disney",
          emergencyContactPhone: "813-555-9999",
          gender: c.gender,
          language: c.language ?? LanguagePreference.ENGLISH,
          firstTimeVolunteer: !!c.firstTime,
          orientationRsvp: c.firstTime ? "WILL_ATTEND" : null,
          parentConsent: !!c.parentConsent,
          emergencyOptIn: c.legacy >= 8, // veterans volunteer for the call list
          textOk: true,
          emailOk: true,
          yearsExperience: c.legacy,
          willingAnyBoothDay: c.profile === "FULL" || c.profile === "DAY",
          willingAnyBoothNight: c.profile === "FULL" || c.profile === "NIGHT",
          status: "VERIFIED",
          verificationMethod: VerificationMethod.EMAIL,
          verifiedAt: new Date(),
          createdAt: new Date(baseSignup + i * 60_000), // deterministic sign-up order
          acknowledgement: {
            create: {
              age18Plus: c.age >= 18,
              standingWalking: standing,
              heavyLift50: c.lifting >= 50,
              liftingCapacityLbs: c.lifting,
              cashHandling: !!c.cash,
              outdoorSun: !!c.outdoor,
              liabilityAcknowledged: true,
              foodRulesAcknowledged: true,
            },
          },
        },
        select: { id: true, seq: true },
      });
      await prisma.volunteer.update({
        where: { id: volunteer.id },
        data: { volunteerCode: volunteerCodeFor(volunteer.seq) },
      });

      // Availability: every date for the profile's shift types.
      const types = new Set(profileShiftTypes(c.profile));
      const availShifts = shifts.filter((s) => types.has(s.shiftType));
      await prisma.availability.createMany({
        data: availShifts.map((s) => ({ volunteerId: volunteer.id, shiftId: s.id })),
        skipDuplicates: true,
      });

      // Ranked position choices, applied across their available shifts.
      const prefRows: Prisma.PreferenceCreateManyInput[] = [];
      c.prefs.forEach((key, idx) => {
        const role = roleByKey.get(key);
        if (!role) return;
        for (const s of availShifts) {
          prefRows.push({ volunteerId: volunteer.id, shiftId: s.id, roleId: role.id, rank: idx + 1 });
        }
      });
      if (prefRows.length > 0) await prisma.preference.createMany({ data: prefRows, skipDuplicates: true });

      // Silent sign-up flags — same rules as the public sign-up route.
      const flags: Prisma.VolunteerFlagCreateManyInput[] = [];
      if (c.age < 16) {
        flags.push({ volunteerId: volunteer.id, type: FlagType.AGE_UNDER_16, detail: `Age ${c.age} at festival start` });
      } else if (c.age < 18 && !c.parentConsent) {
        flags.push({
          volunteerId: volunteer.id,
          type: FlagType.AGE_16_18_NO_CONSENT,
          detail: `Age ${c.age} at festival start, no parent consent`,
        });
      }
      for (const key of c.prefs) {
        const role = roleByKey.get(key);
        if (!role) continue;
        if (role.requiredGender && c.gender !== role.requiredGender) {
          flags.push({
            volunteerId: volunteer.id,
            type: FlagType.GENDER_MISMATCH,
            positionKey: role.key,
            detail: `${role.name} is restricted to ${role.requiredGender === "FEMALE" ? "female" : "male"} volunteers`,
          });
        }
        if (role.liftLimitLbs > 0 && c.lifting < role.liftLimitLbs) {
          flags.push({
            volunteerId: volunteer.id,
            type: FlagType.LIFTING_MISMATCH,
            positionKey: role.key,
            detail: `${role.name} needs ${role.liftLimitLbs} lbs; declared ${c.lifting} lbs`,
          });
        }
        if (role.requiresStanding && !standing) {
          flags.push({
            volunteerId: volunteer.id,
            type: FlagType.STANDING_MISMATCH,
            positionKey: role.key,
            detail: `${role.name} requires extended standing; not declared`,
          });
        }
      }
      if (flags.length > 0) {
        await prisma.volunteerFlag.createMany({ data: flags });
        flagCount += flags.length;
      }

      // Coordinator notes (EXCELLENT … DO_NOT_SCHEDULE).
      if (c.notes?.length) {
        await prisma.adminNote.createMany({
          data: c.notes.map((n) => ({
            volunteerId: volunteer.id,
            category: n.category,
            text: n.text,
            author: DEMO_AUTHOR,
          })),
        });
        noteCount += c.notes.length;
      }

      // Supervisor gating demo.
      if (supervisorRole && c.supervisor) {
        await prisma.training.create({ data: { volunteerId: volunteer.id, roleId: supervisorRole.id, trained: true } });
        await prisma.approval.create({
          data: { volunteerId: volunteer.id, roleId: supervisorRole.id, approved: c.supervisor === "READY" },
        });
      }

      // Needs-replacement triggers: opening-day assignments already in a
      // cancelled / no-show state so the scheduler sees live alerts.
      if (c.history) {
        const shift = firstDayShifts.get(c.history.shiftType);
        const role = roleByKey.get(c.history.roleKey);
        if (shift && role) {
          await prisma.assignment.create({
            data: {
              volunteerId: volunteer.id,
              shiftId: shift.id,
              roleId: role.id,
              source: "MANUAL",
              ...(c.history.kind === "CANCELLED"
                ? { confirmationStatus: "CANCELLED", confirmationAt: new Date() }
                : { noShow: true, absenceReason: "NO_SHOW" }),
            },
          });
          historyCount += 1;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        actor: DEMO_AUTHOR,
        action: "demo_mode_on",
        entityType: "Volunteer",
        details: `cast:${CAST.length} flags:${flagCount} notes:${noteCount} triggers:${historyCount}`,
      },
    });

    return NextResponse.json({ ok: true, created: CAST.length, flags: flagCount, notes: noteCount, triggers: historyCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load demo volunteers" }, { status: 400 });
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Cascades acknowledgements, availability, preferences, flags, notes,
    // trainings, approvals, and assignments for the demo cast.
    const result = await prisma.volunteer.deleteMany({
      where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    });
    await prisma.auditLog.create({
      data: { actor: DEMO_AUTHOR, action: "demo_mode_off", entityType: "Volunteer", details: `deleted:${result.count}` },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to remove demo volunteers" }, { status: 400 });
  }
}
