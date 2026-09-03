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

// Replacement suggestions for a position on a shift, in the same priority
// order autofill uses: legacy score DESC, then sign-up timestamp ASC, with the
// volunteer's ranked preference for the position as context. DO_NOT_SCHEDULE
// volunteers are excluded.
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { shiftId, roleId, limit = 3 } = schema.parse(body);

    const [role, availability, existingAssignments] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.availability.findMany({
        where: { shiftId },
        include: {
          volunteer: {
            include: {
              preferences: true,
              notes: { where: { category: "DO_NOT_SCHEDULE" }, select: { id: true } },
            },
          },
        },
      }),
      prisma.assignment.findMany({ where: { shiftId }, select: { volunteerId: true } }),
    ]);

    if (!role) return NextResponse.json({ error: "Position not found" }, { status: 404 });

    const assignedSet = new Set(existingAssignments.map((a) => a.volunteerId));
    const candidates: Array<{
      volunteerId: string;
      volunteerCode: string;
      name: string;
      legacy: number;
      signedUpAt: Date;
      reasons: string[];
    }> = [];

    for (const row of availability) {
      const volunteer = row.volunteer;
      if (assignedSet.has(volunteer.id)) continue;
      if (volunteer.notes.length > 0) continue; // DO_NOT_SCHEDULE

      const eligible = await checkAssignmentEligibility({ volunteerId: volunteer.id, shiftId, roleId });
      if (!eligible.ok) continue;

      const pref = volunteer.preferences.find((p) => p.roleId === roleId);
      const reasons = [
        pref ? `Choice #${pref.rank} for this position` : "No stated preference",
        `Legacy score ${volunteer.yearsExperience}`,
        ...(eligible.warnings ?? []),
      ];
      candidates.push({
        volunteerId: volunteer.id,
        volunteerCode: volunteer.volunteerCode ?? volunteer.id.slice(-6),
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        legacy: volunteer.yearsExperience,
        signedUpAt: volunteer.createdAt,
        reasons,
      });
    }

    candidates.sort(
      (a, b) => b.legacy - a.legacy || a.signedUpAt.getTime() - b.signedUpAt.getTime(),
    );

    return NextResponse.json({
      ok: true,
      suggestions: candidates.slice(0, limit).map(({ volunteerId, volunteerCode, name, reasons }) => ({
        volunteerId,
        volunteerCode,
        name,
        reasons,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Suggestions failed" }, { status: 400 });
  }
}
