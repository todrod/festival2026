export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="admin-theme admin-theme-shell rounded-2xl border p-4 md:p-6">
      {children}
    </section>
  );
}

