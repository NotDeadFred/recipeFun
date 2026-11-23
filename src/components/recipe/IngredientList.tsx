"use client";

import { useEffect, useRef } from "react";
import type { Ingredient } from "@/lib/types";
import { formatIngredient } from "@/lib/scaling";

interface Props {
  ingredients: Ingredient[];
  /** Ingredients used by the current/selected step. */
  highlightIds?: string[];
  checkedIds?: string[];
  onToggle?: (id: string) => void;
  /** Scroll the first highlighted ingredient into view when highlights change. */
  autoScroll?: boolean;
  large?: boolean;
}

export function IngredientList({ ingredients, highlightIds = [], checkedIds = [], onToggle, autoScroll, large }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const highlightKey = highlightIds.join(",");

  useEffect(() => {
    if (!autoScroll || !highlightKey) return;
    const el = listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]');
    el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [autoScroll, highlightKey]);

  if (ingredients.length === 0) return <p className="text-muted">No ingredients listed.</p>;

  return (
    <ul ref={listRef} className="space-y-1" aria-label="Ingredients">
      {ingredients.map((ing, i) => {
        const header = ing.group && ing.group !== ingredients[i - 1]?.group ? ing.group : null;
        const highlighted = highlightIds.includes(ing.id);
        const checked = checkedIds.includes(ing.id);
        return (
          <li key={ing.id}>
            {header && <h4 className="mt-3 mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{header}</h4>}
            <label
              data-highlighted={highlighted}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors",
                large ? "text-lg" : "",
                highlighted ? "bg-highlight ring-2 ring-highlight-ring" : "hover:bg-surface-2",
                checked ? "text-muted line-through" : "",
              ].join(" ")}
            >
              {onToggle && (
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-brand"
                  checked={checked}
                  onChange={() => onToggle(ing.id)}
                  aria-label={`Mark ${ing.name} as done`}
                />
              )}
              <span>{formatIngredient(ing)}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
