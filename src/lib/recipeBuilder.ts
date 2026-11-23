import type { Ingredient, RecipeDraft, RecipeSource, Step } from "./types";
import { newId } from "./ids";
import { linkIngredientsToStep, parseIngredientLine } from "./ingredients";
import { primaryTimerSeconds } from "./timers";

export interface LooseRecipeInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  photos?: string[];
  sourceType: RecipeSource;
  sourceUrl?: string | null;
  sourceName?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  cuisine?: string | null;
  tags?: string[];
  /** Plain lines, or { line, group } for sectioned lists. */
  ingredients: Array<string | { line: string; group?: string | null }>;
  steps: Array<string | { text: string; group?: string | null }>;
  notes?: string | null;
}

/** Build steps from text, detecting timers and linking ingredients. */
export function buildSteps(
  steps: Array<string | { text: string; group?: string | null }>,
  ingredients: Ingredient[],
): Step[] {
  return steps
    .map((s) => (typeof s === "string" ? { text: s, group: null } : s))
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0)
    .map((s) => ({
      id: newId(),
      text: s.text,
      group: s.group ?? null,
      ingredientIds: linkIngredientsToStep(s.text, ingredients),
      timerSeconds: primaryTimerSeconds(s.text),
    }));
}

/** Turn loosely-structured input (from import, Claude or a form) into a recipe draft. */
export function buildRecipeDraft(input: LooseRecipeInput): RecipeDraft {
  const ingredients = input.ingredients
    .map((i) => (typeof i === "string" ? { line: i, group: null } : i))
    .filter((i) => i.line.trim().length > 0)
    .map((i) => parseIngredientLine(i.line, i.group ?? null));

  const prep = input.prepMinutes ?? null;
  const cook = input.cookMinutes ?? null;
  return {
    title: input.title.trim() || "Untitled recipe",
    description: input.description ?? null,
    imageUrl: input.photos?.[0] ?? input.imageUrl ?? null,
    photos: input.photos ?? (input.imageUrl ? [input.imageUrl] : []),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    sourceName: input.sourceName ?? null,
    servings: input.servings && input.servings > 0 ? input.servings : 4,
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: input.totalMinutes ?? (prep || cook ? (prep ?? 0) + (cook ?? 0) : null),
    cuisine: input.cuisine ?? null,
    tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))),
    ingredients,
    steps: buildSteps(input.steps, ingredients),
    notes: input.notes ?? null,
  };
}

/**
 * Parse the form's textarea format: one item per line, and "# Heading" lines
 * start a section. For ingredients, "Heading:" lines also start a section.
 * Steps may be numbered ("1. Do this") — the numbers are dropped.
 */
export function parseSectionedText(text: string, kind: "ingredients" | "steps"): Array<{ line: string; group: string | null }> {
  const items: Array<{ line: string; group: string | null }> = [];
  let group: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      group = line.replace(/^#+\s*/, "").replace(/:$/, "") || null;
      continue;
    }
    if (kind === "ingredients" && /:$/.test(line) && line.split(/\s+/).length <= 5) {
      group = line.replace(/:$/, "");
      continue;
    }
    const cleaned =
      kind === "steps" ? line.replace(/^(step\s*)?\d+[.):]\s*/i, "") : line.replace(/^[-*•]\s*/, "");
    if (cleaned) items.push({ line: cleaned, group });
  }
  return items;
}

/** The inverse of parseSectionedText, for filling the edit form. */
export function toSectionedText(items: Array<{ text: string; group?: string | null }>): string {
  const lines: string[] = [];
  let group: string | null | undefined = undefined;
  for (const item of items) {
    if ((item.group ?? null) !== (group ?? null)) {
      if (item.group) lines.push(`# ${item.group}`);
      group = item.group ?? null;
    }
    lines.push(item.text);
  }
  return lines.join("\n");
}

/** Recompute links and timers after a user edits ingredients or steps. */
export function relinkSteps(steps: Step[], ingredients: Ingredient[]): Step[] {
  return steps.map((s) => ({
    ...s,
    ingredientIds: linkIngredientsToStep(s.text, ingredients),
    timerSeconds: primaryTimerSeconds(s.text),
  }));
}

/** A recipe's photos in order, including older recipes that only have a cover. */
export function recipePhotos(recipe: { photos?: string[]; imageUrl?: string | null }): string[] {
  if (recipe.photos && recipe.photos.length > 0) return recipe.photos;
  return recipe.imageUrl ? [recipe.imageUrl] : [];
}
