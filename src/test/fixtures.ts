import type { Recipe } from "@/lib/types";
import { buildRecipeDraft } from "@/lib/recipeBuilder";

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const draft = buildRecipeDraft({
    title: "Test Pancakes",
    sourceType: "manual",
    servings: 4,
    ingredients: ["2 cups flour", "2 eggs", "1 1/2 cups milk", "2 tbsp butter"],
    steps: [
      "Whisk the flour in a bowl.",
      "Beat the eggs and milk together.",
      "Rest the batter for 5 minutes.",
      "Cook in butter until golden.",
    ],
  });
  return {
    ...draft,
    id: "recipe-1",
    ownerId: "local-user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
