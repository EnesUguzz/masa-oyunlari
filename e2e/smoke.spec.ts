import { test, expect } from "@playwright/test";

test("app loads the nickname screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Masa Oyunları" })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
});
