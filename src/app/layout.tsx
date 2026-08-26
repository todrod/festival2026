import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "St. Clement Strawberry Festival Scheduler",
  description: "Volunteer signup and scheduling for the St. Clement Strawberry Festival",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="no-print sticky top-0 z-20 border-b border-strawberry-100 bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-strawberry-900">
              St. Clement Strawberry Festival
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link className="ops-btn ops-btn-ghost px-3 py-1.5" href="/signup">
                Volunteer Sign Up
              </Link>
              <Link className="ops-btn ops-btn-ghost px-3 py-1.5" href="/admin">
                Admin
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
