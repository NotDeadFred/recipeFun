import { expect, type Page } from "@playwright/test";

/** Write a recipe through the manual entry form and land on its page. */
export async function createRecipe(page: Page, title = "E2E Tomato Soup") {
  await page.goto("/recipes/new");
  await page.getByLabel("Recipe name").fill(title);
  await page.getByLabel("Servings").fill("2");
  await page.getByLabel(/ingredients — one per line/i).fill("2 tbsp olive oil\n1 onion, diced\n1 can crushed tomatoes\n1 cup vegetable stock");
  await page
    .getByLabel(/steps — one per line/i)
    .fill("Heat the olive oil in a pot.\nCook the onion for 5 minutes.\nAdd the tomatoes and stock and simmer for 15 minutes.\nBlend until smooth.");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Click if the element is in view; on narrow layouts some nav lives elsewhere. */
export function isWide(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 768;
}
