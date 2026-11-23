import type { Ingredient, ShoppingItem } from "./types";
import { newId } from "./ids";
import { unitBase } from "./scaling";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(es|s)$/, "");
}

/**
 * Add a recipe's ingredients to a shopping list, merging duplicates.
 * "1 cup milk" + "2 tbsp milk" merge (in the existing item's unit);
 * "2 cloves garlic" + "1 head garlic" stay separate. Checked items are never merged into.
 */
export function addToShoppingList(
  list: ShoppingItem[],
  ingredients: Ingredient[],
  recipeId: string,
  factor = 1,
): ShoppingItem[] {
  const result = list.map((i) => ({ ...i, recipeIds: [...i.recipeIds] }));
  for (const ing of ingredients) {
    const qty = ing.quantity === null ? null : ing.quantity * factor;
    const name = normalizeName(ing.name);
    const candidates = result.filter((i) => !i.checked && normalizeName(i.name) === name);

    const exact = candidates.find((i) => i.unit === ing.unit);
    const ingBase = unitBase(ing.unit);
    const compatible =
      !exact && ingBase && qty !== null
        ? candidates.find((i) => i.quantity !== null && unitBase(i.unit)?.base === ingBase.base)
        : undefined;

    if (exact) {
      exact.quantity = exact.quantity === null || qty === null ? (exact.quantity ?? qty) : exact.quantity + qty;
      if (!exact.recipeIds.includes(recipeId)) exact.recipeIds.push(recipeId);
    } else if (compatible && ingBase && qty !== null) {
      const target = unitBase(compatible.unit)!;
      compatible.quantity = (compatible.quantity as number) + (qty * ingBase.factor) / target.factor;
      if (!compatible.recipeIds.includes(recipeId)) compatible.recipeIds.push(recipeId);
    } else {
      result.push({
        id: newId(),
        name: ing.name,
        quantity: qty,
        unit: ing.unit,
        checked: false,
        recipeIds: [recipeId],
      });
    }
  }
  return result;
}

export function toggleItem(list: ShoppingItem[], id: string): ShoppingItem[] {
  return list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
}

export function clearChecked(list: ShoppingItem[]): ShoppingItem[] {
  return list.filter((i) => !i.checked);
}
