import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:41789";
const PASSPHRASE = "synthetic-browser-only-passphrase";
const PREFERENCE_KEY = "myexpenses-analysis:filters:v1";
const CASH_ID = "11111111-1111-4111-8111-111111111111";
const DEBT_ID = "22222222-2222-4222-8222-222222222222";

async function unlock(page: Page, phrase = PASSPHRASE): Promise<void> {
  await page.getByLabel("Frase de desbloqueo").fill(phrase);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
}

async function openDrawer(page: Page): Promise<Locator> {
  await page.getByRole("region", { name: "Filtros globales" })
    .getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function expectTransactions(page: Page, count: number): Promise<void> {
  await expect(page.getByRole("heading", { name: "Transacciones" })).toBeVisible();
  const results = page.getByRole("region", { name: "Movimientos filtrados" });
  await expect(results).toContainText(`${count} ${count === 1 ? "resultado" : "resultados"}`);
  if (count === 0) {
    await expect(results.getByText("No hay movimientos")).toBeVisible();
  } else {
    await expect(page.getByRole("table", { name: "Transacciones que coinciden con los filtros globales" })
      .locator("tbody tr")).toHaveCount(count);
  }
}

test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== BASE) await route.abort();
    else await route.continue();
  });
  await page.clock.setFixedTime(new Date("2026-09-27T12:00:00.000Z"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
});

test("filter persistence restores visible scope, search and matching rows after reload", async ({ page }, testInfo) => {
  const scopes = [
    { value: "realCashFlow", count: 1 },
    { value: "all", count: 1 },
    { value: "debtsOnly", count: 0 },
  ];
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const scope = toolbar.getByRole("group", { name: "Ámbito de las estadísticas" });
  // oxlint-disable no-await-in-loop -- Every perspective must settle before saving and reloading its browser state.
  for (const scenario of scopes) {
    await scope.locator(`input[value="${scenario.value}"]`).check();
    const drawer = await openDrawer(page);
    await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
    await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
    await expectTransactions(page, scenario.count);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain("Synthetic food");
    await unlock(page);
    await expect(scope.locator(`input[value="${scenario.value}"]`)).toBeChecked();
    const restored = await openDrawer(page);
    await expect(restored.getByRole("searchbox", { name: "Buscar en movimientos" })).toHaveValue("Synthetic food");
    await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
    await expectTransactions(page, scenario.count);
    await page.screenshot({ path: testInfo.outputPath(`restored-${scenario.value}.png`), animations: "disabled" });
    await page.getByRole("region", { name: "Movimientos filtrados" })
      .screenshot({ path: testInfo.outputPath(`restored-results-${scenario.value}.png`), animations: "disabled" });
  }
  // oxlint-enable no-await-in-loop
  const serialized = await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY);
  expect(serialized).toContain("Synthetic food");
  expect(serialized).not.toMatch(/synthetic-browser-only-passphrase|"postings"|"analytics"|"accounts"|"budgets"/u);
});

test("filter persistence restores advanced controls and a fixture-backed result", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("custom");
  await toolbar.getByLabel("Desde", { exact: true }).fill("2026-08-22");
  await toolbar.getByLabel("Hasta", { exact: true }).fill("2026-08-22");
  const drawer = await openDrawer(page);
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("group", { name: "Fecha utilizada" }).getByRole("radio", { name: "Valor" }).check();
  await drawer.getByLabel("Añadir categoría o subcategoría").selectOption('["Expense","Food"]');
  await drawer.getByText("Criterios adicionales").click();
  await drawer.getByRole("group", { name: "Moneda del movimiento" }).getByRole("checkbox", { name: "EUR" }).check();
  await drawer.getByRole("group", { name: "Beneficiarios" }).getByRole("checkbox", { name: "Child payee (ID 1)" }).check();
  await drawer.getByRole("group", { name: "Métodos de pago" }).getByRole("checkbox", { name: "Neutral method (ID 1)" }).check();
  await drawer.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" }).fill("0,20");
  await drawer.getByRole("textbox", { name: "Importe absoluto máximo (EUR)" }).fill("0,30");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
  await page.reload();
  await unlock(page);
  await expectTransactions(page, 1);
  await expect(toolbar.getByRole("combobox", { name: "Tipo de periodo" })).toHaveValue("custom");
  await expect(toolbar.getByLabel("Desde", { exact: true })).toHaveValue("2026-08-22");
  await expect(toolbar.getByLabel("Hasta", { exact: true })).toHaveValue("2026-08-22");
  const restored = await openDrawer(page);
  await expect(restored.getByRole("group", { name: "Fecha utilizada" }).getByRole("radio", { name: "Valor" })).toBeChecked();
  await expect(restored.getByRole("button", { name: "Quitar Expense › Food" })).toBeVisible();
  await restored.getByText("Criterios adicionales").click();
  await expect(restored.getByRole("group", { name: "Moneda del movimiento" }).getByRole("checkbox", { name: "EUR" })).toBeChecked();
  await expect(restored.getByRole("group", { name: "Beneficiarios" }).getByRole("checkbox", { name: "Child payee (ID 1)" })).toBeChecked();
  await expect(restored.getByRole("group", { name: "Métodos de pago" }).getByRole("checkbox", { name: "Neutral method (ID 1)" })).toBeChecked();
  await expect(restored.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" })).toHaveValue("0,20");
  await expect(restored.getByRole("textbox", { name: "Importe absoluto máximo (EUR)" })).toHaveValue("0,30");
  const saved = await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY);
  expect(saved).toContain('"minAmountEurMinor":20');
  expect(saved).toContain('"maxAmountEurMinor":30');
  expect(saved).not.toMatch(/synthetic-browser-only-passphrase|"postings"|"analytics"|"accounts"|"budgets"/u);
  await restored.getByRole("textbox", { name: "Importe absoluto máximo (EUR)" }).scrollIntoViewIfNeeded();
  await restored.screenshot({ path: testInfo.outputPath("restored-advanced.png"), animations: "disabled" });
});

test("filter persistence prunes unavailable options without losing independent valid selections", async ({ page }) => {
  await page.evaluate(({ key, cash, debt }) => {
    const saved = JSON.parse(localStorage.getItem(key)!) as { filters: Record<string, unknown> };
    saved.filters = {
      ...saved.filters,
      scope: "all",
      accountIds: [cash, "missing-account"],
      originAccountIds: [cash, "missing-origin"],
      destinationAccountIds: [debt, "missing-destination"],
      categoryPrefixes: [["Expense", "Food"], ["Unavailable"]],
      tags: ["Parent tag", "Unavailable tag"],
      currencies: ["EUR", "GBP"],
      payeeKeys: ['["source",1]', '["source",999]'],
      paymentMethodKeys: ['["source",1]', '["source",999]'],
      search: "Synthetic food",
    };
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: PREFERENCE_KEY, cash: CASH_ID, debt: DEBT_ID });
  await page.reload();
  await unlock(page);
  const drawer = await openDrawer(page);
  await expect(drawer.getByRole("group", { name: "Ámbito de las estadísticas" }).getByRole("radio", { name: "Yo" })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Cuentas", exact: true }).getByRole("checkbox", { name: /Cash, EUR/ })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Cuenta de origen" }).getByRole("checkbox", { name: /Cash, EUR/ })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Cuenta de destino" }).getByRole("checkbox", { name: /Debt, EUR/ })).toBeChecked();
  await expect(drawer.getByRole("button", { name: "Quitar Expense › Food" })).toBeVisible();
  await expect(drawer.getByRole("checkbox", { name: "Parent tag" })).toBeChecked();
  await drawer.getByText("Criterios adicionales").click();
  await expect(drawer.getByRole("group", { name: "Moneda del movimiento" }).getByRole("checkbox", { name: "EUR" })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Beneficiarios" }).getByRole("checkbox", { name: "Child payee (ID 1)" })).toBeChecked();
  await expect(drawer.getByRole("group", { name: "Métodos de pago" }).getByRole("checkbox", { name: "Neutral method (ID 1)" })).toBeChecked();
  expect(await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!) as { filters: Record<string, unknown> };
    return saved.filters;
  }, PREFERENCE_KEY)).toMatchObject({
    accountIds: [CASH_ID], originAccountIds: [CASH_ID], destinationAccountIds: [DEBT_ID],
    categoryPrefixes: [["Expense", "Food"]], tags: ["Parent tag"], currencies: ["EUR"],
    payeeKeys: ['["source",1]'], paymentMethodKeys: ['["source",1]'],
  });
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!) as { databaseSha256: string; filters: Record<string, unknown> };
    saved.databaseSha256 = "f".repeat(64);
    localStorage.setItem(key, JSON.stringify(saved));
  }, PREFERENCE_KEY);
  await page.reload();
  await unlock(page);
  const changed = await openDrawer(page);
  await changed.getByText("Criterios adicionales").click();
  await expect(changed.getByRole("group", { name: "Beneficiarios" }).getByRole("checkbox", { name: "Child payee (ID 1)" })).not.toBeChecked();
  await expect(changed.getByRole("group", { name: "Métodos de pago" }).getByRole("checkbox", { name: "Neutral method (ID 1)" })).not.toBeChecked();
  await expect(changed.getByRole("group", { name: "Cuentas", exact: true }).getByRole("checkbox", { name: /Cash, EUR/ })).toBeChecked();
});

test("filter persistence survives failed unlock, preserves an empty date, and resets across reload", async ({ page }) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("custom");
  await toolbar.getByLabel("Desde", { exact: true }).fill("2026-09-01");
  await toolbar.getByLabel("Hasta", { exact: true }).fill("2026-09-02");
  const drawer = await openDrawer(page);
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.getByRole("button", { name: "Bloquear bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  const saved = await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY);
  await unlock(page, "incorrect phrase");
  await expect(page.getByRole("alert")).toHaveText("No se pudo abrir la bóveda.");
  expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY)).toBe(saved);
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  await expect(toolbar.getByLabel("Desde", { exact: true })).toHaveValue("2026-09-01");
  await expect(toolbar.getByLabel("Hasta", { exact: true })).toHaveValue("2026-09-02");
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  await expectTransactions(page, 0);
  const reset = await openDrawer(page);
  await reset.getByRole("button", { name: "Restablecer" }).click();
  await reset.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.reload();
  await unlock(page);
  await expect(toolbar.getByRole("combobox", { name: "Tipo de periodo" })).toHaveValue("all");
  const cleared = await openDrawer(page);
  await expect(cleared.getByRole("searchbox", { name: "Buscar en movimientos" })).toHaveValue("");
});

test("filter persistence leaves a future snapshot untouched and recovers from corrupt input", async ({ page }) => {
  const future = JSON.stringify({ version: 99, filters: { futureField: "keep" } });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: PREFERENCE_KEY, value: future });
  await page.reload();
  await unlock(page);
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await expect(toolbar.getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="realCashFlow"]')).toBeChecked();
  const drawer = await openDrawer(page);
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("changed");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY)).toBe(future);
  await page.evaluate((key) => localStorage.setItem(key, "{broken"), PREFERENCE_KEY);
  await page.reload();
  await unlock(page);
  const recovered = await openDrawer(page);
  await expect(recovered.getByRole("searchbox", { name: "Buscar en movimientos" })).toHaveValue("");
  expect(await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY)).toContain('"version":1');
});
