import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

test("add photos to a new recipe, choose the cover, and view them", async ({ page }) => {
  await page.goto("/recipes/new");
  const form = page.getByRole("form", { name: "Recipe form" }).filter({ visible: true });
  await form.getByLabel("Recipe name").fill("Photo Pie");
  await form.getByLabel(/steps — one per line/i).fill("Bake the pie for 45 minutes.");

  // Same file input the iPad uses for Camera / Photo Library.
  await form.getByLabel("Choose photos").setInputFiles([fixture("dish.jpg"), fixture("salad.jpg")]);
  const photos = form.getByRole("list", { name: "Recipe photos" }).getByRole("img");
  await expect(photos).toHaveCount(2);

  // Photos are resized on the device before saving (fixtures are 1600x1200).
  const width = await photos.first().evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(width).toBeLessThanOrEqual(1024);

  await form.getByRole("button", { name: "Make photo 2 the cover" }).click();
  const cover = await photos.first().getAttribute("src");
  await form.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Photo Pie" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Photo Pie" })).toHaveAttribute("src", cover!);
  await page.getByRole("button", { name: "View photo 2 of 2" }).click();
  await expect(page.getByRole("dialog", { name: "Photo 2 of 2" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The cover shows on the library card too.
  await page.goto("/");
  const card = page.getByRole("link", { name: /Photo Pie/ });
  await expect(card.locator("img")).toHaveAttribute("src", cover!);
});

test("photos survive editing", async ({ page }) => {
  await page.goto("/recipes/new");
  const form = page.getByRole("form", { name: "Recipe form" }).filter({ visible: true });
  await form.getByLabel("Recipe name").fill("Edit Photos");
  await form.getByLabel(/steps — one per line/i).fill("Serve.");
  await form.getByLabel("Choose photos").setInputFiles(fixture("dish.jpg"));
  await expect(form.getByRole("list", { name: "Recipe photos" }).getByRole("img")).toHaveCount(1);
  await form.getByRole("button", { name: "Save recipe" }).click();

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.waitForURL(/\/edit$/);
  const editForm = page.getByRole("form", { name: "Recipe form" }).filter({ visible: true });
  await expect(editForm.getByRole("list", { name: "Recipe photos" }).getByRole("img")).toHaveCount(1);
  await editForm.getByLabel("Choose photos").setInputFiles(fixture("salad.jpg"));
  await expect(editForm.getByRole("list", { name: "Recipe photos" }).getByRole("img")).toHaveCount(2);
  await editForm.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("button", { name: "View photo 2 of 2" })).toBeVisible();
});
