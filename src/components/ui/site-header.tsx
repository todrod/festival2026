"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLang } from "@/components/i18n/language-provider";

export function SiteHeader() {
  const { t } = useLang();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-strawberry-100 bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-strawberry-900">
          St. Clement Strawberry Festival
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <Link className="ops-btn ops-btn-ghost px-3 py-1.5" href="/signup">
            {t("Volunteer Sign Up")}
          </Link>
          <Link className="ops-btn ops-btn-ghost px-3 py-1.5" href="/admin">
            {t("Admin")}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
