import { prisma } from "@/lib/prisma";
import { SignupWizard } from "@/components/public/signup-wizard";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const [shifts, roles] = await Promise.all([
    prisma.shift.findMany({ orderBy: [{ date: "asc" }, { shiftType: "asc" }] }),
    prisma.role.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-strawberry-900">Volunteer Signup</h1>
      <p className="text-sm text-foreground/80">Complete all steps to submit your volunteer profile, availability, and role preferences.</p>
      <SignupWizard shifts={shifts} roles={roles} />
    </div>
  );
}
