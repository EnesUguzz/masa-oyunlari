import { test, expect, type Locator } from "@playwright/test";

test("a single human fills with bots, starts a game, and plays a move", async ({ page }) => {
  const dragTo = async (src: Locator, tgt: Locator): Promise<void> => {
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await src.dispatchEvent("dragstart", { dataTransfer: dt });
    await tgt.dispatchEvent("dragover", { dataTransfer: dt });
    await tgt.dispatchEvent("drop", { dataTransfer: dt });
  };

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
  // The starting player holds 22 tiles in the "act" phase: it must discard without
  // drawing. Drawing is drag-only (no buttons) and its hint shows only in the draw
  // phase, so it must be absent now; the assist helper "Seri Diz" is visible.
  await expect(page.getByText(/Çekmek için/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Seri Diz/ })).toBeVisible();

  // discard by dragging the first rack tile onto the discard pile
  await dragTo(page.locator('[data-testid="hand"] button').first(), page.getByTestId("my-discard"));

  // bots auto-play; the turn returns to you in the draw phase → the draw hint appears
  await expect(page.getByText(/Çekmek için/)).toBeVisible({ timeout: 5000 });

  // draw by dragging the deck onto a rack tile (lands in the first empty slot)
  await dragTo(page.getByTestId("draw-pile"), page.locator('[data-testid="hand"] button').first());
  await expect(page.getByText(/Senin elin \(22/)).toBeVisible();
});
