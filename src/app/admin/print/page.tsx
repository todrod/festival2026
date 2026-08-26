import { format } from "date-fns";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ shiftId?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin");

  const { shiftId } = await searchParams;
  const shifts = await prisma.shift.findMany({ orderBy: [{ date: "asc" }, { shiftType: "asc" }] });
  const activeShift = shiftId ? shifts.find((s) => s.id === shiftId) || shifts[0] : shifts[0];

  if (!activeShift) {
    return <p>No shifts available. Run seed first.</p>;
  }

  const assignments = await prisma.assignment.findMany({
    where: { shiftId: activeShift.id },
    include: { role: true, volunteer: true },
    orderBy: [{ role: { name: "asc" } }, { volunteer: { lastName: "asc" } }],
  });

  const roleEntries = Array.from(
    new Map(assignments.map((a) => [a.role.id, a.role])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const roleCodeById = new Map(roleEntries.map((role, idx) => [role.id, `R${idx + 1}`]));

  const grouped = assignments.reduce<Record<string, typeof assignments>>((acc, a) => {
    if (!acc[a.roleId]) acc[a.roleId] = [];
    acc[a.roleId].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="no-print panel p-3">
        <form className="flex items-center gap-2" method="get">
          <label className="text-sm font-semibold">Shift</label>
          <select name="shiftId" defaultValue={activeShift.id} className="rounded-md border border-strawberry-200 px-2 py-1 text-sm">
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {format(s.date, "EEE MMM d")} - {s.label}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-strawberry-500 px-3 py-1.5 text-sm font-semibold text-white" type="submit">
            Load
          </button>
          <span className="rounded-md border border-strawberry-200 px-3 py-1.5 text-sm">Use browser print: Cmd/Ctrl + P</span>
        </form>
      </div>

      <section className="panel p-5">
        <h1 className="text-2xl font-black">Daily Roster</h1>
        <p className="text-sm">
          {format(activeShift.date, "EEEE, MMM d, yyyy")} - {activeShift.label}
        </p>
        <div className="mt-3 rounded-md border border-strawberry-100 bg-strawberry-50/80 p-3 text-xs text-foreground dark:bg-strawberry-100/25">
          <p className="mb-2 font-semibold uppercase tracking-wide text-foreground/85">Role Legend</p>
          <div className="flex flex-wrap gap-2">
            {roleEntries.map((role) => (
              <span key={role.id} className="inline-flex items-center gap-2 rounded-full border border-strawberry-200 bg-card px-2 py-1">
                <span className="rounded-full bg-strawberry-100 px-1.5 py-0.5 text-xs font-semibold text-foreground dark:bg-strawberry-100/35">
                  {roleCodeById.get(role.id)}
                </span>
                <span>{role.name}</span>
              </span>
            ))}
          </div>
        </div>

        {Object.entries(grouped).map(([roleId, list]) => {
          const role = roleEntries.find((r) => r.id === roleId);
          if (!role) return null;
          return (
          <div key={roleId} className="mt-4">
            <h2 className="mb-2 text-lg font-semibold">
              <span className="mr-2 rounded-full bg-strawberry-100 px-2 py-0.5 text-xs text-foreground dark:bg-strawberry-100/35">
                {roleCodeById.get(roleId)}
              </span>
              {role.name}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-strawberry-200 p-2 text-left">Volunteer</th>
                  <th className="border border-strawberry-200 p-2 text-left">Phone</th>
                  <th className="border border-strawberry-200 p-2 text-left">Check-In</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-strawberry-100 p-2">
                      {item.volunteer.firstName} {item.volunteer.lastName}
                    </td>
                    <td className="border border-strawberry-100 p-2">{item.volunteer.phone}</td>
                    <td className="border border-strawberry-100 p-2">__________</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )})}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-bold">Emergency Contacts</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-strawberry-200 p-2 text-left">Volunteer</th>
              <th className="border border-strawberry-200 p-2 text-left">Emergency Contact</th>
              <th className="border border-strawberry-200 p-2 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((item) => (
              <tr key={`em-${item.id}`}>
                <td className="border border-strawberry-100 p-2">
                  {item.volunteer.firstName} {item.volunteer.lastName}
                </td>
                <td className="border border-strawberry-100 p-2">{item.volunteer.emergencyContactName}</td>
                <td className="border border-strawberry-100 p-2">{item.volunteer.emergencyContactPhone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
