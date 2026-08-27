"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ES } from "@/lib/i18n-es";

export type Lang = "en" | "es";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
};

const LanguageContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("festival-lang");
      if (saved === "es" || saved === "en") {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("festival-lang", l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  // English strings are the keys; Spanish looked up in ES (falls back to English).
  const t = useCallback((s: string) => (lang === "es" ? ES[s] ?? s : s), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}
