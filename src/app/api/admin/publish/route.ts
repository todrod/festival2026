import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishSchema } from "@/lib/validators";
import { logAdminAction } from "@/lib/audit";

// Supervisor final-publish: locks every assignment on the shift and records the
// publish. The UI then routes into the Communication tab to notify volunteers.
export async function POST(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "SCHEDULER") {
    return NextResponse.json({ error: "Only supervisors and admins can publish a schedule" }, { status: 403 });
  }
  try {
    const { shiftId, action } = publishSchema.parse(await req.json());

    if (action === "publish") {
      await prisma.$transaction([
        prisma.assignment.updateMany({ where: { shiftId }, data: { locked: true } }),
        prisma.schedulePublish.upsert({
          where: { shiftId },
          update: { publishedBy: session.name, publishedAt: new Date() },
          create: { shiftId, publishedBy: session.name },
        }),
      ]);
      await logAdminAction({
        actor: session.name,
        action: "schedule_publish",
        entityType: "Shift",
        entityId: shiftId,
        shiftId,
      });
      return NextResponse.json({ ok: true, published: true });
    }

    await prisma.$transaction([
      prisma.schedulePublish.deleteMany({ where: { shiftId } }),
      prisma.assignment.updateMany({ where: { shiftId }, data: { locked: false } }),
    ]);
    await logAdminAction({
      actor: session.name,
      action: "schedule_unpublish",
      entityType: "Shift",
      entityId: shiftId,
      shiftId,
    });
    return NextResponse.json({ ok: true, published: false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Publish failed" }, { status: 400 });
  }
}
