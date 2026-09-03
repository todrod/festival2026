"use client";

import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { useLang } from "@/components/i18n/language-provider";

export function SiteHeader() {
  const { t } = useLang();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-strawberry-100 bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <img src="/brand/logo.svg" alt="" className="h-12 w-12" />
          <span className="leading-tight">
            <span className="block text-base font-black tracking-tight text-strawberry-500">St. Clement</span>
            <span className="block text-xs font-bold text-leaf-700">
              {t("“Make Your Own” Strawberry Shortcake Project")}
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
          <Link className="ops-btn ops-btn-primary tap-target flex items-center px-4 py-2" href="/signup">
            {t("Volunteer Sign Up")}
          </Link>
          <Link className="ops-btn ops-btn-ghost tap-target flex items-center px-4 py-2" href="/admin">
            {t("Staff Login")}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
