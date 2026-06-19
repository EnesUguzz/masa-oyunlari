import { test, expect } from "@playwright/test";

test("drag a tile onto the discard pile to discard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox").fill("Ben");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: "Yeni Oda Kur" }).click();
  await page.getByRole("button", { name: "Botlarla Doldur" }).click();
  await page.getByRole("button", { name: "Oyunu Başlat" }).click();
  await expect(page.getByText(/Senin elin \(22/)).toBeVisible();

  const src = page.locator('[data-testid="hand"] button').first();
  const tgt = page.getByTestId("my-discard");

  const dt = await page.evaluateHandle(() => new DataTransfer());
  await src.dispatchEvent("dragstart", { dataTransfer: dt });
  await tgt.dispatchEvent("dragover", { dataTransfer: dt });
  await tgt.dispatchEvent("drop", { dataTransfer: dt });

  // after discarding one tile, seat 0 drops from 22; bots play; it returns to draw
  await expect(page.getByRole("button", { name: /Desteden çek/ })).toBeVisible({ timeout: 5000 });
});
