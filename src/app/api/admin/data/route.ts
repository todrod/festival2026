import { NextResponse } from "next/server";
import { format } from "date-fns";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getStaffSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const shiftType = url.searchParams.get("shiftType");

    const whereShift = {
      ...(date ? { date: new Date(date) } : {}),
      ...(shiftType ? { shiftType: shiftType as never } : {}),
    };

    const [shifts, volunteers, roles, assignments, trainings, approvals, flags, publishes] = await Promise.all([
      prisma.shift.findMany({ where: whereShift, orderBy: [{ date: "asc" }, { shiftType: "asc" }] }),
      prisma.volunteer.findMany({
        where: { status: "VERIFIED" },
        include: { acknowledgement: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.assignment.findMany({
        where: {
          ...(date ? { shift: { date: new Date(date) } } : {}),
          volunteer: { status: "VERIFIED" },
        },
        include: { volunteer: true, role: true, shift: true },
        orderBy: [{ shift: { date: "asc" } }, { role: { name: "asc" } }],
      }),
      prisma.training.findMany(),
      prisma.approval.findMany(),
      prisma.volunteerFlag.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.schedulePublish.findMany(),
    ]);

    const availability = await prisma.availability.findMany({
      where: { shiftId: { in: shifts.map((s) => s.id) }, volunteer: { status: "VERIFIED" } },
      include: { volunteer: true },
    });

    const roleTargets = await prisma.roleTarget.findMany({ where: { shiftId: { in: shifts.map((s) => s.id) } } });

    const shiftNotes = await prisma.shiftNote.findMany({ orderBy: { createdAt: "desc" } });

    // Notes: private notes are only visible to their author. Everything else is
    // visible to any signed-in staff member (scheduler and up).
    const allNotes = await prisma.adminNote.findMany({ orderBy: { createdAt: "desc" } });
    const adminNotes = allNotes.filter((n) => !n.isPrivate || n.author === session.name);

    // If migration for AuditLog has not been applied yet, keep admin data usable.
    const auditLogs = await prisma.auditLog
      .findMany({ orderBy: { createdAt: "desc" }, take: 40 })
      .catch(() => []);

    const coverage = shifts.map((shift) => {
      const targets = roleTargets.filter((t) => t.shiftId === shift.id).reduce((acc, t) => acc + t.target, 0);
      const filled = assignments.filter((a) => a.shiftId === shift.id).length;
      return {
        shiftId: shift.id,
        date: format(shift.date, "yyyy-MM-dd"),
        shiftType: shift.shiftType,
        filled,
        targets,
      };
    });

    return NextResponse.json({
      session,
      shifts,
      volunteers,
      roles,
      assignments,
      trainings,
      approvals,
      availability,
      roleTargets,
      coverage,
      auditLogs,
      flags,
      adminNotes,
      shiftNotes,
      publishes,
    });
  } catch (err) {
    console.error("admin data route failed", err);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}
