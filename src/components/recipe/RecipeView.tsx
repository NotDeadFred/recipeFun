"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Recipe, RecipeDraft, UnitSystem } from "@/lib/types";
import { adjustIngredients } from "@/lib/scaling";
import { formatClock, formatMinutes } from "@/lib/timers";
import { IngredientList } from "./IngredientList";
import { ServingsControl, UnitToggle } from "./ServingsControl";

export const SOURCE_LABEL: Record<string, string> = {
  imported: "Imported",
  manual: "My recipe",
  claude: "Made with Claude",
};

interface Props {
  recipe: Recipe | RecipeDraft;
  actions?: ReactNode;
  servings: number;
  onServingsChange: (n: number) => void;
  unitSystem: UnitSystem | null;
  onUnitSystemChange: (u: UnitSystem | null) => void;
}

/**
 * The recipe page: ingredients on the left, steps on the right. Tapping a step
 * selects it and highlights the ingredients it uses.
 */
export function RecipeView({ recipe, actions, servings, onServingsChange, unitSystem, onUnitSystemChange }: Props) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const factor = servings / (recipe.servings || 1);
  const ingredients = useMemo(
    () => adjustIngredients(recipe.ingredients, factor, unitSystem),
    [recipe.ingredients, factor, unitSystem],
  );
  const highlightIds = selectedStep !== null ? recipe.steps[selectedStep]?.ingredientIds ?? [] : [];
  const meta = [
    recipe.prepMinutes ? `Prep ${formatMinutes(recipe.prepMinutes)}` : null,
    recipe.cookMinutes ? `Cook ${formatMinutes(recipe.cookMinutes)}` : null,
    recipe.totalMinutes ? `Total ${formatMinutes(recipe.totalMinutes)}` : null,
    recipe.cuisine,
  ].filter(Boolean);

  return (
    <article>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {recipe.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary recipe sites
          <img
            src={recipe.imageUrl}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover sm:w-64"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-brand">
            {SOURCE_LABEL[recipe.sourceType]}
            {recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
          </p>
          <h1 className="page-title mt-1">{recipe.title}</h1>
          {recipe.description && <p className="mt-2 text-muted">{recipe.description}</p>}
          {meta.length > 0 && <p className="mt-2 text-sm text-muted">{meta.join(" · ")}</p>}
          {recipe.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
          {recipe.sourceUrl && (
            <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand underline">
              View original
            </a>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(260px,2fr)_3fr]">
        <section className="card h-fit p-4 md:sticky md:top-20" aria-labelledby="ingredients-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="ingredients-heading" className="text-lg font-semibold">
              Ingredients
            </h2>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ServingsControl servings={servings} onChange={onServingsChange} />
            <UnitToggle value={unitSystem} onChange={onUnitSystemChange} />
          </div>
          <IngredientList ingredients={ingredients} highlightIds={highlightIds} />
        </section>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="mb-3 text-lg font-semibold">
            Steps <span className="text-sm font-normal text-muted">— tap a step to see its ingredients</span>
          </h2>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => {
              const header = step.group && step.group !== recipe.steps[i - 1]?.group ? step.group : null;
              const selected = selectedStep === i;
              return (
                <li key={step.id}>
                  {header && <h3 className="mt-4 mb-2 font-semibold text-muted">{header}</h3>}
                  <button
                    onClick={() => setSelectedStep(selected ? null : i)}
                    aria-pressed={selected}
                    className={[
                      "flex w-full gap-4 rounded-2xl border p-4 text-left transition-colors",
                      selected ? "border-highlight-ring bg-highlight" : "border-border bg-surface hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-strong">
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      {step.text}
                      {step.timerSeconds ? (
                        <span className="mt-2 block text-sm text-muted">⏱ {formatClock(step.timerSeconds)}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {recipe.notes && (
            <div className="card mt-6 p-4">
              <h3 className="font-semibold">Notes</h3>
              <p className="mt-1 whitespace-pre-line text-muted">{recipe.notes}</p>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
