"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("festival-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("festival-theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full border border-strawberry-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-strawberry-900 shadow-sm transition hover:bg-strawberry-50 dark:border-strawberry-100 dark:bg-card dark:text-foreground"
      aria-label="Toggle dark mode"
      type="button"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}
