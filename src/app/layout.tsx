import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { SiteHeader } from "@/components/ui/site-header";

export const metadata: Metadata = {
  title: "St. Clement Strawberry Shortcake Project — Volunteers",
  description:
    "Volunteer sign-up and scheduling for the St. Clement 'Make Your Own' Strawberry Shortcake Project (March 4–14, 2027)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <SiteHeader />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
