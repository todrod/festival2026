import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema } from "@/lib/validators";
import { deployMessage, resolveRecipients } from "@/lib/communications";
import { logAdminAction } from "@/lib/audit";
import { z } from "zod";

const requestSchema = sendMessageSchema.extend({
  // dryRun = preview: resolve recipients without sending anything.
  dryRun: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await prisma.messageLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ ok: true, logs });
}

export async function POST(req: Request) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "SCHEDULER") {
    return NextResponse.json({ error: "Only supervisors and admins can send messages" }, { status: 403 });
  }
  try {
    const parsed = requestSchema.parse(await req.json());

    if (parsed.dryRun) {
      const { volunteers, label } = await resolveRecipients(parsed.audience);
      const smsEligible = volunteers.filter((v) => v.textOk).length;
      const emailEligible = volunteers.filter((v) => v.emailOk).length;
      return NextResponse.json({ ok: true, dryRun: true, recipients: volunteers.length, smsEligible, emailEligible, label });
    }

    const result = await deployMessage({
      kind: parsed.kind,
      channel: parsed.channel,
      audience: parsed.audience,
      subject: parsed.subject,
      body: parsed.body,
      includeSchedule: parsed.includeSchedule,
      sentBy: session.name,
    });
    await logAdminAction({
      actor: session.name,
      action: "message_deploy",
      entityType: "MessageLog",
      details: `${parsed.kind}/${parsed.channel} → ${result.audienceLabel} (${result.recipients})`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Message send failed" }, { status: 400 });
  }
}
