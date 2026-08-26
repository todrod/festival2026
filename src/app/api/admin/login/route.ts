import { NextResponse } from "next/server";
import { checkAdminPassword, createAdminSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password } = loginSchema.parse(body);
    if (!checkAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
