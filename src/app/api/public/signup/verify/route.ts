import { NextResponse } from "next/server";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "Signup verification is disabled. Submissions are active immediately." },
    { status: 410 },
  );
}
