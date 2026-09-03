import { NextResponse } from "next/server";
import { createAdminSession, roleForPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, password } = loginSchema.parse(body);
    const role = roleForPassword(password);
    if (!role) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await createAdminSession({ name: name.trim() || "staff", role });
    return NextResponse.json({ ok: true, role });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
