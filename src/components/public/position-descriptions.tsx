"use client";

import Link from "next/link";
import { useLang } from "@/components/i18n/language-provider";

// Verbatim from the 2027 paper "Job Positions Descriptions" back page.
// Text is kept as printed (the sheet's "shorcake" typo corrected to
// "shortcake"). The cut-off refrigerated-truck driver note at the very bottom
// of the sheet was illegible in the source photo and is intentionally omitted.
const boothDescriptions: Array<[string, string]> = [
  ["Early Morning Booth Setup", "Setup at 6:00 AM every day. Involves preparing the booth tables, moving ice, filling the bowls with berries, begin making whip cream, etc. Volunteers can do this before going to work or school in the morning. Lifting required."],
  ["Supervisor", "Looks after booth volunteers and ensures everything runs smoothly. Familiar with all booth positions, keeps Project Coordinator updated on any issues. (Must be trained)"],
  ["Crowd Control", "Greets guests. Ensures that guests get in proper lines and stay out of the flow of traffic. Standing, Walking, Holding Sign Required. Requires being out in the sun at times."],
  ["Cashier", "Sells tickets at booth during Festival. Speed and efficiency required."],
  ["Ticket Takers", "Allows “advanced ticket” guests entry, collects tickets, and directs guests to shortest serving lines. Standing Required."],
  ["Shortcake Girls", "Hands out bowl with cake or biscuit to guest. Standing Required."],
  ["Berry Girls", "Place berry topper on guest's shortcake. Remind each guest to take a napkin and a spoon. Standing Required."],
  ["Light Duty Food Handlers", "Keep the serving line stocked with bowls, napkins, spoons, etc. (Can be Male or Female). Standing/Walking Required."],
  ["Heavy Duty Food Handlers", "Keep the serving lines stocked with cakes & biscuits, strawberries and whipped cream. Ensure floor and serving lines are always clean. A LOT OF WALKING & LIFTING REQUIRED UP TO 50 LBS."],
  ["Sticker Persons", "Applies sticker as guests exits booth area. Standing Required. NO chairs allowed in booth area."],
  ["Shortcake Stacker", "Stacks cakes and biscuits on trays in the booth kitchen. Speed, efficiency and some lifting required."],
  ["Cream Whippers", "Makes the whipped cream for the shortcakes in the booth kitchen. Speed, efficiency and some lifting required."],
  ["Kitchen Helper", "Keeps all utensils, buckets, etc. rinsed/washed. Help in kitchen as needed. Some lifting Required."],
  ["Relief Persons", "Relieves positions as needed. Needs to fully understand the positions they relieve. Standing Required."],
  ["Coffee Person", "Makes coffee. Keeps sugar, cream, stirrers supplied. Sells water and soft drinks."],
  ["Customer Service", "Clean tables and floor in eating area of any spills. Pick up trash left on tables. Wipe tables. Assist guests if needed. Standing/Walking Required."],
];

const hallDescriptions: Array<[string, string]> = [
  ["Berry Hulling", "May arrive as early as 7:30 am until completed. Stem berries, prepare berries for booth. Clean up work area when finished and setup for the next day."],
  ["Berry Production Line", "Work on production line that washes, slices and sugars berries. Lifting Required."],
  ["Cakes Department", "May arrive between 8:00 and 8:30 am until completed. Prepare cakes and repack for use at the booth. Clean area and setup for next day. Standing and some Lifting Required."],
  ["Uniform Department", "Repair and replace existing uniforms. Daily wash, dry and fold uniforms for use by booth workers. Assist booth workers getting dressed. Standing Required."],
  ["Heavy Duty Hall Workers", "Capable of lifting up to 50 lbs. We need 4-5 men in the hall from 6:30 am until about 1:00 pm. Distribute flats of fresh berries to tables, load trucks, gather hulled berries for processing, wash and dry topper berries. Standing, Walking, Lifting Required."],
  ["Nightly Bucket Washing", "Good opportunity for children and families to work together every evening around 6:00 pm till completed. No age requirement. Meal provided. (MORNING BUCKET WASHERS NEEDED FEBRUARY 28). Standing, Walking, Lifting Required."],
];

function DescriptionList({ items, accent }: { items: Array<[string, string]>; accent: "berry" | "leaf" }) {
  const { t } = useLang();
  const dot = accent === "berry" ? "bg-strawberry-500" : "bg-leaf-500";
  return (
    <ul className="space-y-3">
      {items.map(([name, desc]) => (
        <li key={name} className="rounded-xl border border-strawberry-100 bg-white p-3">
          <p className="flex items-center gap-2 text-sm font-black text-strawberry-900">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
            {t(name)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">{t(desc)}</p>
        </li>
      ))}
    </ul>
  );
}

export function PositionDescriptions() {
  const { t } = useLang();
  return (
    <div className="space-y-6">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-strawberry-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          🍓 {t("Job Positions Descriptions")}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-strawberry-900">
          {t("What each position does")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">
          {t("Here is what is expected of each position so you know what you are signing up for. Descriptions are from the parish sign-up sheet.")}
        </p>
        <Link href="/signup" className="ops-btn ops-btn-primary mt-4 inline-block px-5 py-2.5 text-sm">
          {t("Go to Volunteer Sign-Up")}
        </Link>
      </div>

      <section className="panel border-strawberry-100 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-strawberry-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-strawberry-500 text-white">🍓</span>
          {t("Booth Positions")}
        </h2>
        <DescriptionList items={boothDescriptions} accent="berry" />
      </section>

      <section className="panel border-strawberry-100 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-black text-strawberry-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-leaf-500 text-white">🥣</span>
          {t("Hall Positions")}
        </h2>
        <DescriptionList items={hallDescriptions} accent="leaf" />
      </section>
    </div>
  );
}
