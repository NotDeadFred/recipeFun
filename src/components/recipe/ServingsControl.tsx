"use client";

import type { UnitSystem } from "@/lib/types";

export function ServingsControl({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Servings">
      <button className="btn size-11 p-0" onClick={() => onChange(Math.max(1, servings - 1))} aria-label="Fewer servings">
        −
      </button>
      <span className="min-w-20 text-center font-medium" aria-live="polite">
        {servings} {servings === 1 ? "serving" : "servings"}
      </span>
      <button className="btn size-11 p-0" onClick={() => onChange(servings + 1)} aria-label="More servings">
        +
      </button>
    </div>
  );
}

export function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem | null;
  onChange: (value: UnitSystem | null) => void;
}) {
  const options: Array<[UnitSystem | null, string]> = [
    [null, "As written"],
    ["us", "US"],
    ["metric", "Metric"],
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Units">
      {options.map(([v, label]) => (
        <button
          key={label}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="min-h-9 rounded-lg px-3 text-sm aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
