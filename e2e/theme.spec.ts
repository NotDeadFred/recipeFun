import { expect, test } from "@playwright/test";

test("light theme by default; dark choice is remembered across reloads", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(lightBg).toBe("rgb(255, 255, 255)");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  // Applied by the inline head script, before the app loads.
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("radio", { name: /light/i }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});
