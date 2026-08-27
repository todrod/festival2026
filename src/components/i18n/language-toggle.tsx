"use client";

import { useLang } from "@/components/i18n/language-provider";

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="inline-flex items-center gap-1 rounded-full border border-strawberry-300 bg-white/90 px-1 py-1 shadow-sm dark:border-strawberry-100 dark:bg-card"
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
            lang === l
              ? "bg-strawberry-500 text-white"
              : "text-strawberry-900 hover:bg-strawberry-50 dark:text-foreground"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
