import { test, expect } from "@playwright/test";

test("a single human fills with bots, starts a game, and plays a move", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox").fill("Ben");
  await page.getByRole("button", { name: "Devam" }).click();

  await page.getByRole("button", { name: "Yeni Oda Kur" }).click();
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByText(/\(1\/4\)/)).toBeVisible();

  await page.getByRole("button", { name: "Botlarla Doldur" }).click();
  await expect(page.getByText(/\(4\/4\)/)).toBeVisible();

  await page.getByRole("button", { name: "Oyunu Başlat" }).click();

  await expect(page.getByText(/Senin elin \(22/)).toBeVisible();
  // The starting player holds 22 tiles and opens in the "act" phase: it must
  // discard without drawing, so there is no draw button yet — only Aç / At.
  await expect(page.getByRole("button", { name: /^Aç/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Desteden çek/ })).toHaveCount(0);

  // select the first tile and discard it
  await page.locator('[data-testid="hand"] button').first().click();
  await page.getByRole("button", { name: /^At/ }).click();

  // bots auto-play; the turn returns to you in the draw phase
  await expect(page.getByRole("button", { name: /Desteden çek/ })).toBeVisible();
  await page.getByRole("button", { name: /Desteden çek/ }).click();
  await expect(page.getByText(/Senin elin \(22/)).toBeVisible();
});
