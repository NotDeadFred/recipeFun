import { expect, test } from "@playwright/test";
import { createRecipe } from "./helpers";

test.describe("Cooking with Claude", () => {
  test("sends preferences and previews the generated recipe", async ({ page }) => {
    // Claude is mocked so tests never spend API credits.
    let sent: Record<string, unknown> | null = null;
    await page.route("**/api/status", (route) => route.fulfill({ json: { claude: true, supabase: false } }));
    await page.route("**/api/generate", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        json: {
          recipe: {
            title: "Smoky Chipotle Chicken Tacos",
            description: "Charred, smoky and bright.",
            sourceType: "claude",
            sourceName: "Cooking with Claude",
            servings: 4,
            prepMinutes: 10,
            cookMinutes: 15,
            totalMinutes: 25,
            cuisine: "Mexican",
            tags: ["tacos"],
            ingredients: [
              { id: "i1", raw: "1 lb chicken thighs", quantity: 1, unit: "lb", name: "chicken thighs" },
              { id: "i2", raw: "8 corn tortillas", quantity: 8, unit: null, name: "corn tortillas" },
            ],
            steps: [
              { id: "s1", text: "Season the chicken thighs.", ingredientIds: ["i1"] },
              { id: "s2", text: "Grill for 12 minutes and warm the tortillas.", ingredientIds: ["i1", "i2"], timerSeconds: 720 },
            ],
            notes: null,
          },
        },
      });
    });

    await page.goto("/claude");
    await page.getByLabel(/ingredients you have/i).fill("chicken thighs");
    await page.getByLabel(/ingredients you have/i).press("Enter");
    await page.getByRole("button", { name: "Smoky" }).click();
    await page.getByRole("button", { name: "Mexican" }).click();
    await page.getByRole("button", { name: /create my recipe/i }).click();

    const preview = page.getByTestId("draft-preview");
    await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Smoky Chipotle Chicken Tacos");
    await expect(preview).toContainText("Made with Claude");
    expect(sent).toMatchObject({ ingredients: ["chicken thighs"], flavors: ["Smoky"], cuisine: "Mexican" });

    await preview.getByRole("button", { name: "Save to my recipes" }).click();
    await expect(page.getByRole("link", { name: /start cooking/i })).toBeVisible();
  });

  test("shows a friendly error when Claude declines", async ({ page }) => {
    await page.route("**/api/generate", (route) =>
      route.fulfill({ status: 422, json: { error: "Claude declined that request. Try rewording it." } }),
    );
    await page.goto("/claude");
    await page.getByRole("button", { name: /create my recipe/i }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Try rewording it");
  });
});

test.describe("groups and shared cookbooks", () => {
  test("create a group, share a cookbook with it, and add a recipe", async ({ page }) => {
    await page.goto("/groups");
    await page.getByLabel("Group name").fill("Schults Family");
    await page.getByRole("button", { name: "Create group" }).click();
    await page.getByRole("link", { name: /Schults Family/ }).click();
    await expect(page.getByTestId("invite-code")).toHaveText(/^[A-Z0-9]{8}$/);

    await page.goto("/cookbooks");
    await page.getByLabel("New cookbook").fill("Sunday Dinners");
    await page.getByLabel("Share with").selectOption({ label: "Schults Family" });
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("list", { name: "Cookbooks" })).toContainText("Shared with Schults Family");

    await createRecipe(page, "Pot Roast");
    await page.getByRole("button", { name: /add to cookbook/i }).click();
    await page.getByRole("dialog", { name: "Choose cookbooks" }).getByLabel("Sunday Dinners").check();

    await page.goto("/cookbooks");
    await page.getByRole("link", { name: /Sunday Dinners/ }).click();
    await expect(page.getByRole("link", { name: /Pot Roast/ })).toBeVisible();
  });
});

test.describe("shopping list", () => {
  test("adds a recipe's ingredients, merges duplicates, and checks items off", async ({ page }) => {
    await createRecipe(page);
    await page.getByRole("button", { name: /add to shopping list/i }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Added");
    await page.getByRole("button", { name: /add to shopping list/i }).click();

    await page.goto("/shopping");
    const list = page.getByRole("list", { name: "Shopping list" });
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list).toContainText("4 tbsp olive oil");

    await page.getByLabel("New item").fill("2 lemons");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(5);

    await list.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /remove checked/i }).click();
    await expect(list.getByRole("listitem")).toHaveCount(4);
  });
});

test.describe("saved sites and profile", () => {
  test("search a saved site and add a new one", async ({ page }) => {
    await page.goto("/discover");
    await page.getByLabel("Search recipe sites").fill("pad thai");
    const allrecipes = page.getByRole("list", { name: "Saved sites" }).getByRole("listitem").filter({ hasText: "Allrecipes" });
    await expect(allrecipes.getByRole("link", { name: "Search" })).toHaveAttribute("href", "https://www.allrecipes.com/search?q=pad%20thai");

    await page.getByLabel("Name", { exact: true }).fill("Smitten Kitchen");
    await page.getByLabel("Web address").fill("https://smittenkitchen.com");
    await page.getByLabel("Search link (optional)").fill("https://smittenkitchen.com/?s={query}");
    await page.getByRole("button", { name: "Add site" }).click();
    await expect(page.getByRole("list", { name: "Saved sites" })).toContainText("Smitten Kitchen");
  });

  test("update display name and preferred units", async ({ page }) => {
    await page.goto("/profile");
    await page.getByLabel("Display name").fill("Chef Fred");
    await page.getByLabel("Preferred units").selectOption("metric");
    await page.getByRole("button", { name: "Save" }).click();
    await page.goto("/");
    await expect(page.getByText("Hi Chef Fred")).toBeVisible();
  });
});

test("the app can be installed (manifest and icons)", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});
