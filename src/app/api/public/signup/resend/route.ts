import { NextResponse } from "next/server";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "Signup verification is disabled. Resend is not required." },
    { status: 410 },
  );
}
