"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** Current theme; "light" during server rendering (the default). */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  return [theme, applyTheme];
}

/** Compact sun/moon button for the header. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex size-11 items-center justify-center rounded-md text-lg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}

/** Light / Dark choice for the profile page. */
export function ThemeChooser() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="flex gap-1 rounded-md bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => setTheme(t)}
          className="min-h-10 flex-1 rounded px-4 text-sm font-semibold capitalize aria-checked:bg-surface aria-checked:shadow-sm"
        >
          {t === "light" ? "☀️ Light" : "🌙 Dark"}
        </button>
      ))}
    </div>
  );
}
