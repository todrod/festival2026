import { z } from "zod";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { checkAssignmentEligibility } from "@/lib/festival";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  shiftId: z.string().min(1),
  roleId: z.string().min(1),
  limit: z.number().int().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { shiftId, roleId, limit = 3 } = schema.parse(body);

    const [role, availability, existingAssignments] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.availability.findMany({ where: { shiftId }, include: { volunteer: { include: { preferences: true } } } }),
      prisma.assignment.findMany({ where: { shiftId }, select: { volunteerId: true } }),
    ]);

    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    const assignedSet = new Set(existingAssignments.map((a) => a.volunteerId));
    const scored: Array<{ volunteerId: string; name: string; score: number; reasons: string[] }> = [];

    for (const row of availability) {
      const volunteer = row.volunteer;
      if (assignedSet.has(volunteer.id)) continue;

      const eligible = await checkAssignmentEligibility({ volunteerId: volunteer.id, shiftId, roleId });
      if (!eligible.ok) continue;

      const pref = volunteer.preferences.find((p) => p.roleId === roleId);
      const rankScore = pref ? 100 - pref.rank * 10 : 0;
      const seniority = volunteer.yearsExperience;
      const stable = Number.parseInt(volunteer.id.slice(-3), 36) % 7;
      const score = rankScore + seniority + stable / 10;

      const reasons = [
        pref ? `Preference rank #${pref.rank}` : "No explicit preference",
        `${seniority} years experience`,
      ];

      scored.push({
        volunteerId: volunteer.id,
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        score,
        reasons,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ ok: true, suggestions: scored.slice(0, limit) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Suggestions failed" }, { status: 400 });
  }
}
