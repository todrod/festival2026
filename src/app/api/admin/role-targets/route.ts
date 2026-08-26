import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleTargetSchema } from "@/lib/validators";

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = roleTargetSchema.parse(body);

    const item = await prisma.roleTarget.upsert({
      where: { shiftId_roleId: { shiftId: parsed.shiftId, roleId: parsed.roleId } },
      create: parsed,
      update: { target: parsed.target },
    });

    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
