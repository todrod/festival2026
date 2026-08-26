import { CaptainBoard } from "@/components/admin/captain-board";
import { isAdminAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CaptainPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-foreground">Shift Captain Mode</h1>
      <p className="text-sm text-foreground/90">Mobile-first check-in and no-show handling during active shifts.</p>
      <CaptainBoard />
    </div>
  );
}
