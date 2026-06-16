import { test, expect } from "@playwright/test";

test("two browsers in the same room see each other", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await a.goto("/");
  await a.getByRole("textbox").fill("Alice");
  await a.getByRole("button", { name: "Devam" }).click();
  await a.getByRole("button", { name: "Yeni Oda Kur" }).click();
  const code = (await a.getByTestId("room-code").innerText()).trim();
  expect(code.length).toBeGreaterThan(0);

  await b.goto("/");
  await b.getByRole("textbox").fill("Bob");
  await b.getByRole("button", { name: "Devam" }).click();
  // wait for the lobby to render before filling the room code
  await expect(b.getByRole("button", { name: "Yeni Oda Kur" })).toBeVisible();
  await b.getByRole("textbox").fill(code);
  await b.getByRole("button", { name: "Katıl" }).click();

  await expect(a.getByText(/\(2\/4\)/)).toBeVisible();
  await expect(b.getByText(/\(2\/4\)/)).toBeVisible();
  await expect(a.getByText("Alice")).toBeVisible();
  await expect(a.getByText("Bob")).toBeVisible();
  await expect(b.getByText("Alice")).toBeVisible();
  await expect(b.getByText("Bob")).toBeVisible();
  await expect(a.getByText(/Alice.*\(sen\)/)).toBeVisible();
  await expect(b.getByText(/Bob.*\(sen\)/)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
