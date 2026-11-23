import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createRecipe } from "./helpers";

test.describe("recipe library", () => {
  test("starts with sample recipes and filters by search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your recipes" })).toBeVisible();
    const grid = page.getByTestId("recipe-grid");
    await expect(grid.getByRole("link")).toHaveCount(2);
    await page.getByLabel("Search recipes").fill("lemon");
    await expect(grid.getByRole("link")).toHaveCount(1);
    await expect(grid).toContainText("Sheet-Pan Lemon Herb Chicken");
  });
});

test.describe("manual recipes", () => {
  test("write a recipe, scale it and switch units", async ({ page }) => {
    await createRecipe(page);
    const ingredients = page.getByRole("list", { name: "Ingredients" });
    await expect(ingredients).toContainText("2 tbsp olive oil");
    await page.getByRole("button", { name: "More servings" }).click();
    await page.getByRole("button", { name: "More servings" }).click();
    await expect(ingredients).toContainText("4 tbsp olive oil");
    await page.getByRole("button", { name: "Metric" }).click();
    await expect(ingredients).toContainText("473 ml vegetable stock");
  });

  test("tapping a step highlights the ingredients it uses", async ({ page }) => {
    await createRecipe(page);
    await page.getByRole("button", { name: /add the tomatoes and stock/i }).click();
    const highlighted = page.locator('[data-highlighted="true"]');
    await expect(highlighted).toHaveCount(2);
    await expect(highlighted.nth(0)).toContainText("crushed tomatoes");
    await expect(highlighted.nth(1)).toContainText("vegetable stock");
  });

  test("edit a recipe", async ({ page }) => {
    await createRecipe(page);
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.waitForURL(/\/edit$/);
    // Earlier pages stay mounted (hidden), so target the visible form.
    await page.getByLabel("Recipe name").filter({ visible: true }).fill("Roasted Tomato Soup");
    await page.getByRole("button", { name: "Save recipe" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Roasted Tomato Soup" })).toBeVisible();
  });
});

test.describe("cook mode", () => {
  test("walks through every step with highlighting, timers and a finish screen", async ({ page }) => {
    await createRecipe(page);
    await page.getByRole("link", { name: /start cooking/i }).click();
    const cook = page.getByTestId("cook-mode");
    await expect(cook).toBeVisible();
    const current = cook.locator('[aria-current="step"]');

    await expect(current).toContainText("Heat the olive oil");
    await expect(page.getByText("Step 1 of 4")).toBeVisible();

    await page.getByRole("button", { name: /next/i }).click();
    await expect(current).toContainText("Cook the onion");
    await page.getByRole("button", { name: /start 5:00/i }).click();
    await expect(page.getByRole("timer")).toContainText(/[45]:\d\d/);

    // Keyboard works too (iPad keyboard or a page-turner pedal).
    await page.keyboard.press("ArrowRight");
    await expect(current).toContainText("simmer for 15 minutes");
    await page.keyboard.press("ArrowLeft");
    await expect(current).toContainText("Cook the onion");

    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await page.getByRole("button", { name: /finish/i }).click();
    await expect(page.getByRole("dialog")).toContainText("Enjoy your meal!");
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "E2E Tomato Soup" })).toBeVisible();
  });

  test("shows ingredients and steps side by side on iPad, or as tabs on narrow screens", async ({ page }) => {
    await createRecipe(page);
    await page.getByRole("link", { name: /start cooking/i }).click();
    const ingredientsPane = page.getByRole("complementary", { name: "Ingredients" });
    const stepsPane = page.getByRole("region", { name: "Steps" });
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(ingredientsPane).toBeVisible();
      await expect(stepsPane).toBeVisible();
      const a = await ingredientsPane.boundingBox();
      const b = await stepsPane.boundingBox();
      expect(a!.x).toBeLessThan(b!.x);
    } else {
      await expect(stepsPane).toBeVisible();
      await page.getByRole("tab", { name: /ingredients/i }).click();
      await expect(ingredientsPane).toBeVisible();
    }
  });
});

test.describe("importing", () => {
  let server: Server;
  let base: string;

  test.beforeAll(async () => {
    // A stand-in recipe website with schema.org data, like most real recipe sites.
    server = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html><head><title>Best Banana Bread</title>
        <script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: "Best Banana Bread",
          recipeYield: "8",
          totalTime: "PT1H10M",
          recipeIngredient: ["3 ripe bananas, mashed", "1/3 cup melted butter", "3/4 cup sugar", "1 egg", "1 1/2 cups flour"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Heat the oven to 350°F." },
            { "@type": "HowToStep", text: "Mix the bananas and butter, then the sugar and egg." },
            { "@type": "HowToStep", text: "Stir in the flour and bake for 60 minutes." },
          ],
        })}</script></head><body><h1>Best Banana Bread</h1></body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(() => server.close());

  test("import a recipe from a link and save it", async ({ page }) => {
    await page.goto("/import");
    await page.getByLabel("Recipe link").fill(`${base}/banana-bread`);
    await page.getByRole("button", { name: "Import" }).click();
    const preview = page.getByTestId("draft-preview");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Best Banana Bread");
    await expect(preview).toContainText("8 servings");
    await expect(preview.locator("dl")).toContainText(/Total\s*1 hr 10 min/i);
    await preview.getByRole("button", { name: "Save to my recipes" }).click();
    await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
    await page.goto("/");
    await expect(page.getByTestId("recipe-grid")).toContainText("Best Banana Bread");
  });

  test("the bookmarklet link (?url=) imports straight away", async ({ page }) => {
    await page.goto(`/import?url=${encodeURIComponent(`${base}/banana-bread`)}`);
    await expect(page.getByTestId("draft-preview")).toContainText("Best Banana Bread");
  });

  test("explains when a page has no recipe", async ({ page }) => {
    await page.route("**/api/import", (route) =>
      route.fulfill({ status: 422, json: { error: "No recipe data found on that page. Try pasting the recipe text instead." } }),
    );
    await page.goto("/import");
    await page.getByLabel("Recipe link").fill("https://example.com/not-a-recipe");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Try pasting the recipe text");
  });
});

test("starting a new recipe after saving one gives a blank form", async ({ page }) => {
  await createRecipe(page, "First Recipe");
  await page.getByRole("link", { name: "Recipes" }).filter({ visible: true }).first().click();
  await page.getByRole("link", { name: /write a recipe/i }).click();
  await expect(page.getByLabel("Recipe name").filter({ visible: true })).toHaveValue("");
});
