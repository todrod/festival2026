import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { approvalSchema } from "@/lib/validators";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = approvalSchema.parse(body);

    const item = await prisma.approval.upsert({
      where: { volunteerId_roleId: { volunteerId: parsed.volunteerId, roleId: parsed.roleId } },
      create: parsed,
      update: { approved: parsed.approved },
    });
    await logAdminAction({
      action: parsed.approved ? "approval_enable" : "approval_disable",
      entityType: "Approval",
      entityId: item.id,
      details: `${parsed.volunteerId}:${parsed.roleId}`,
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
