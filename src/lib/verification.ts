import { VerificationMethod } from "@prisma/client";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function otpPepper() {
  return process.env.OTP_PEPPER || "local-dev-pepper";
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(`${code}:${otpPepper()}`).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

async function sendEmailOtp(destinationEmail: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    console.info(`[verification] EMAIL OTP ${code} -> ${destinationEmail} (SMTP not configured)`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: destinationEmail,
    subject: "Festival Volunteer Verification Code",
    text: `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });
}

async function sendSmsOtp(destinationPhone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.info(`[verification] SMS OTP ${code} -> ${destinationPhone} (Twilio not configured)`);
    return;
  }

  const form = new URLSearchParams({
    To: destinationPhone,
    From: from,
    Body: `Your festival verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text}`);
  }
}

export async function createOtpChallenge(input: {
  volunteerId: string;
  method: VerificationMethod;
  destination: string;
}) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpChallenge.create({
    data: {
      volunteerId: input.volunteerId,
      method: input.method,
      destination: input.destination,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  if (input.method === VerificationMethod.EMAIL) {
    await sendEmailOtp(input.destination, code);
  } else {
    await sendSmsOtp(input.destination, code);
  }
}

export async function verifyOtpChallenge(volunteerId: string, code: string) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      volunteerId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return { ok: false as const, error: "No active verification code. Please resend." };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false as const, error: "Too many attempts. Please resend a new code." };
  }

  const isMatch = hashCode(code) === challenge.codeHash;
  if (!isMatch) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, error: "Invalid code." };
  }

  await prisma.$transaction([
    prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    }),
    prisma.volunteer.update({
      where: { id: volunteerId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    }),
  ]);

  return { ok: true as const };
}

