"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Recipe, RecipeDraft, UnitSystem } from "@/lib/types";
import { adjustIngredients } from "@/lib/scaling";
import { formatClock, formatMinutes } from "@/lib/timers";
import { IngredientList } from "./IngredientList";
import { ServingsControl, UnitToggle } from "./ServingsControl";
import { PhotoGallery } from "./PhotoGallery";
import { recipePhotos } from "@/lib/recipeBuilder";

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
  const details = [
    ["Prep", recipe.prepMinutes ? formatMinutes(recipe.prepMinutes) : null],
    ["Cook", recipe.cookMinutes ? formatMinutes(recipe.cookMinutes) : null],
    ["Total", recipe.totalMinutes ? formatMinutes(recipe.totalMinutes) : null],
    ["Servings", String(recipe.servings)],
  ].filter((d): d is [string, string] => Boolean(d[1]));
  const crumbs = ["Recipes", recipe.cuisine, recipe.tags[0]].filter(Boolean) as string[];

  return (
    <article>
      <header>
        <nav aria-label="Breadcrumb" className="text-xs font-bold tracking-[0.12em] text-muted uppercase">
          {crumbs.map((c, i) => (
            <span key={`${c}-${i}`}>
              {i > 0 && <span className="mx-2 text-brand" aria-hidden>›</span>}
              {c}
            </span>
          ))}
        </nav>
        <h1 className="mt-3 text-4xl leading-tight font-black tracking-tight sm:text-5xl">{recipe.title}</h1>
        {recipe.description && <p className="mt-3 max-w-3xl text-lg text-foreground/80">{recipe.description}</p>}
        <p className="mt-3 text-sm text-muted">
          <span className="font-semibold text-foreground">{SOURCE_LABEL[recipe.sourceType]}</span>
          {recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
          {recipe.sourceUrl && (
            <>
              {" · "}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-2">
                View original
              </a>
            </>
          )}
        </p>
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </header>

      <div className="mt-6">
        <PhotoGallery photos={recipePhotos(recipe)} title={recipe.title} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-md bg-surface-2 p-5 sm:grid-cols-4">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">{label}</dt>
            <dd className="mt-1 text-lg font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {recipe.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
          {recipe.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-[minmax(260px,2fr)_3fr]">
        <section className="h-fit border-t-4 border-brand pt-4 md:sticky md:top-24" aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="section-title">
            Ingredients
          </h2>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
            <ServingsControl servings={servings} onChange={onServingsChange} />
            <UnitToggle value={unitSystem} onChange={onUnitSystemChange} />
          </div>
          <IngredientList ingredients={ingredients} highlightIds={highlightIds} />
        </section>

        <section aria-labelledby="steps-heading" className="border-t-4 border-brand pt-4">
          <h2 id="steps-heading" className="section-title">
            Directions
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">Tap a step to highlight the ingredients it uses.</p>
          <ol className="space-y-2">
            {recipe.steps.map((step, i) => {
              const header = step.group && step.group !== recipe.steps[i - 1]?.group ? step.group : null;
              const selected = selectedStep === i;
              return (
                <li key={step.id}>
                  {header && <h3 className="mt-6 mb-2 text-base font-extrabold">{header}</h3>}
                  <button
                    onClick={() => setSelectedStep(selected ? null : i)}
                    aria-pressed={selected}
                    className={[
                      "block w-full rounded-md border-l-4 px-4 py-3 text-left transition-colors",
                      selected ? "border-highlight-ring bg-highlight" : "border-transparent hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-extrabold">Step {i + 1}</span>
                    <span className="mt-1 block text-[17px] leading-relaxed">
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
            <div className="mt-8 rounded-md bg-surface-2 p-5">
              <h3 className="text-base font-extrabold">Cook&apos;s notes</h3>
              <p className="mt-1 whitespace-pre-line text-muted">{recipe.notes}</p>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
