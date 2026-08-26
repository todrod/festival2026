import { NextResponse } from "next/server";
import { format } from "date-fns";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const shiftType = url.searchParams.get("shiftType");

    const whereShift = {
      ...(date ? { date: new Date(date) } : {}),
      ...(shiftType ? { shiftType: shiftType as never } : {}),
    };

    const [shifts, volunteers, roles, assignments, trainings, approvals] = await Promise.all([
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
    ]);

    const availability = await prisma.availability.findMany({
      where: { shiftId: { in: shifts.map((s) => s.id) }, volunteer: { status: "VERIFIED" } },
      include: { volunteer: true },
    });

    const roleTargets = await prisma.roleTarget.findMany({ where: { shiftId: { in: shifts.map((s) => s.id) } } });

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

    return NextResponse.json({ shifts, volunteers, roles, assignments, trainings, approvals, availability, roleTargets, coverage, auditLogs });
  } catch (err) {
    console.error("admin data route failed", err);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}
