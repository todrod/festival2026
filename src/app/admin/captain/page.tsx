import { CaptainBoard } from "@/components/admin/captain-board";
import { isAdminAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CaptainPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  return (
    <div className="space-y-4">
      <CaptainBoard />
    </div>
  );
}
