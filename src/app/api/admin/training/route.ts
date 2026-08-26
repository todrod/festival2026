import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { trainingSchema } from "@/lib/validators";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = trainingSchema.parse(body);

    const item = await prisma.training.upsert({
      where: { volunteerId_roleId: { volunteerId: parsed.volunteerId, roleId: parsed.roleId } },
      create: parsed,
      update: { trained: parsed.trained },
    });
    await logAdminAction({
      action: parsed.trained ? "training_enable" : "training_disable",
      entityType: "Training",
      entityId: item.id,
      details: `${parsed.volunteerId}:${parsed.roleId}`,
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
