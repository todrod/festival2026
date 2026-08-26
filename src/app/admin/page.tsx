import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight text-foreground">Admin Scheduler</h1>
      <AdminDashboard />
    </div>
  );
}
