import { prisma } from "@/lib/prisma";
import { SignupWizard } from "@/components/public/signup-wizard";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const [shifts, roles] = await Promise.all([
    prisma.shift.findMany({ orderBy: [{ date: "asc" }, { shiftType: "asc" }] }),
    prisma.role.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
  ]);

  return <SignupWizard shifts={shifts} roles={roles} />;
}
