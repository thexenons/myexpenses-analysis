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
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true }).click();
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

test("category exclusion persists its mode and keeps all other categories", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const results = page.getByRole("region", { name: "Movimientos filtrados" });
  await expect(results).toContainText(/\d+ resultados/u);
  const baselineCount = Number((await results.innerText()).match(/(\d+) resultados/u)?.[1]);
  expect(baselineCount).toBeGreaterThan(1);
  const drawer = await openDrawer(page);
  const mode = drawer.getByRole("combobox", { name: "Modo de categorías" });
  await expect(mode).toHaveValue("include");
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true }).click();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);

  const excluding = await openDrawer(page);
  await excluding.getByRole("combobox", { name: "Modo de categorías" }).selectOption("exclude");
  await excluding.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expect(results).toContainText(`${baselineCount - 1} resultados`);
  await expect(page.getByRole("button", { name: "Quitar filtro Excluir: Expense › Food" })).toBeVisible();
  await expect(results.getByText("Synthetic food", { exact: true })).toHaveCount(0);
  await expect(results.getByRole("table").locator("tbody tr").first()).toBeVisible();
  await page.reload();
  await unlock(page);
  await expect(results).toContainText(`${baselineCount - 1} resultados`);
  const restored = await openDrawer(page);
  await expect(restored.getByRole("combobox", { name: "Modo de categorías" })).toHaveValue("exclude");
  await expect(restored.getByRole("button", { name: "Quitar exclusión Expense › Food" })).toBeVisible();
  const serialized = await page.evaluate((key) => localStorage.getItem(key), PREFERENCE_KEY);
  expect(JSON.parse(serialized!)).toMatchObject({ version: 1, filters: { categoryMode: "exclude" } });

  await restored.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  const including = await openDrawer(page);
  await including.getByRole("combobox", { name: "Modo de categorías" }).selectOption("include");
  await including.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
  const emptySelection = await openDrawer(page);
  await emptySelection.getByRole("combobox", { name: "Modo de categorías" }).selectOption("exclude");
  await emptySelection.getByRole("button", { name: "Quitar exclusión Expense › Food" }).click();
  await expect(emptySelection.getByRole("combobox", { name: "Modo de categorías" })).toHaveValue("exclude");
  await emptySelection.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
});

test("owning account exclusion persists IDs across scopes and can exclude every account", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const drawer = await openDrawer(page);
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("exclude");
  const cash = drawer.getByRole("group", { name: "Cuentas", exact: true })
    .getByRole("checkbox", { name: /Cash, EUR/ });
  await expect(cash).not.toBeChecked();
  await cash.check();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  await expect(page.getByRole("button", { name: "Quitar filtro Excluir cuenta: Cash" })).toBeVisible();
  const narrowed = await openDrawer(page);
  await narrowed.getByRole("group", { name: "Ámbito de las estadísticas" })
    .locator('input[value="debtsOnly"]').check();
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCE_KEY);
  expect(persisted).toMatchObject({ version: 1, filters: { accountMode: "exclude", accountIds: [CASH_ID] } });
  await narrowed.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.reload();
  await unlock(page);
  const restored = await openDrawer(page);
  await expect(restored.getByRole("combobox", { name: "Modo de cuentas" })).toHaveValue("exclude");
  await restored.getByRole("group", { name: "Ámbito de las estadísticas" })
    .locator('input[value="realCashFlow"]').check();
  const restoredCash = restored.getByRole("group", { name: "Cuentas", exact: true })
    .getByRole("checkbox", { name: /Cash, EUR/ });
  await expect(restoredCash).toBeChecked();
  await restored.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("include");
  await expect(restoredCash).toBeChecked();
  await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
  const allExcluded = await openDrawer(page);
  await allExcluded.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("");
  await allExcluded.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("exclude");
  const accounts = allExcluded.getByRole("group", { name: "Cuentas", exact: true }).getByRole("checkbox");
  // oxlint-disable-next-line no-await-in-loop -- Each account selection must settle before selecting the next visible account.
  for (const account of await accounts.all()) await account.check();
  await allExcluded.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
});

test("hierarchical category selection persists multiple explicit paths and modes across pages", async ({ page }) => {
  const drawer = await openDrawer(page);
  const root = drawer.getByRole("button", { name: "Seleccionar Expense", exact: true });
  await expect(root).toHaveAttribute("aria-pressed", "false");
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("aria-pressed", "false");
  const child = drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true });
  await child.focus();
  await page.keyboard.press("Space");
  await expect(child).toHaveAttribute("aria-pressed", "true");
  await expect(root).toHaveAttribute("aria-pressed", "false");
  await root.click();
  await drawer.getByRole("button", { name: "Seleccionar Income", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Sin categoría", exact: true }).click();
  await drawer.getByRole("group", { name: "Nivel de categoría" })
    .getByRole("radio", { name: "Solo ruta exacta" }).check();
  await drawer.getByRole("combobox", { name: "Modo de categorías" }).selectOption("exclude");
  await expect(child).toHaveAttribute("aria-pressed", "true");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  await expect(page.getByRole("button", { name: "Quitar filtro Excluir: Expense › Food", exact: true })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCE_KEY);
  expect(saved.filters).toMatchObject({
    categoryMode: "exclude", categoryDepth: "exact",
    categoryPrefixes: [["Expense", "Food"], ["Expense"], ["Income"], []],
  });
  await page.reload();
  await unlock(page);
  const restored = await openDrawer(page);
  await expect(restored.getByRole("combobox", { name: "Modo de categorías" })).toHaveValue("exclude");
  await expect(restored.getByRole("radio", { name: "Solo ruta exacta" })).toBeChecked();
  await expect(restored.getByRole("button", { name: "Seleccionar Expense", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(restored.getByRole("button", { name: "Seleccionar Sin categoría", exact: true })).toHaveAttribute("aria-pressed", "true");
  await restored.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  await expect(restored.getByRole("button", { name: "Seleccionar Expense › Food", exact: true })).toHaveAttribute("aria-pressed", "true");
  await restored.getByRole("combobox", { name: "Modo de categorías" }).selectOption("include");
  await expect(restored.getByRole("button", { name: "Seleccionar Expense › Food", exact: true })).toHaveAttribute("aria-pressed", "true");
});


test("off-scope owning inclusion remains empty after reloading a mode transition", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const drawer = await openDrawer(page);
  const scope = drawer.getByRole("group", { name: "Ámbito de las estadísticas" });
  await scope.locator('input[value="debtsOnly"]').check();
  await drawer.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("exclude");
  await drawer.getByRole("group", { name: "Cuentas", exact: true })
    .getByRole("checkbox", { name: /Debt, EUR/ }).check();
  await scope.locator('input[value="realCashFlow"]').check();
  await drawer.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("include");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCE_KEY);
  expect(before.filters).toMatchObject({ scope: "realCashFlow", accountMode: "include", accountIds: [DEBT_ID] });
  await page.reload();
  await unlock(page);
  await expectTransactions(page, 0);
  const restored = await openDrawer(page);
  await expect(restored.getByRole("combobox", { name: "Modo de cuentas" })).toHaveValue("include");
  await expect(restored.getByRole("group", { name: "Ámbito de las estadísticas" })
    .locator('input[value="realCashFlow"]')).toBeChecked();
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCE_KEY);
  expect(after.filters.accountIds).toEqual([DEBT_ID]);
});

test("tag exclusion persists inherited split tags and keeps untagged movements", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const results = page.getByRole("region", { name: "Movimientos filtrados" });
  await expect(results).toContainText(/\d+ resultados/u);
  const baselineCount = Number((await results.innerText()).match(/(\d+) resultados/u)?.[1]);
  expect(baselineCount).toBeGreaterThan(3);
  const drawer = await openDrawer(page);
  const mode = drawer.getByRole("combobox", { name: "Modo de etiquetas" });
  await expect(mode).toHaveValue("include");
  await drawer.getByRole("group", { name: "Etiquetas disponibles" })
    .getByRole("checkbox", { name: "Parent tag" }).check();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 2);
  const excluding = await openDrawer(page);
  await excluding.getByRole("combobox", { name: "Modo de etiquetas" }).selectOption("exclude");
  await excluding.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expect(results).toContainText(`${baselineCount - 2} resultados`);
  await expect(page.getByRole("button", { name: "Quitar filtro Excluir etiqueta: Parent tag" })).toBeVisible();
  await page.reload();
  await unlock(page);
  await expect(results).toContainText(`${baselineCount - 2} resultados`);
  const restored = await openDrawer(page);
  await expect(restored.getByRole("combobox", { name: "Modo de etiquetas" })).toHaveValue("exclude");
  await expect(restored.getByRole("group", { name: "Etiquetas disponibles" })
    .getByRole("checkbox", { name: "Parent tag" })).toBeChecked();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCE_KEY);
  expect(saved).toMatchObject({ version: 1, filters: { tagMode: "exclude", tags: ["Parent tag"] } });
  await restored.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
  const including = await openDrawer(page);
  await including.getByRole("combobox", { name: "Modo de etiquetas" }).selectOption("include");
  await including.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  const emptySelection = await openDrawer(page);
  await emptySelection.getByRole("combobox", { name: "Modo de etiquetas" }).selectOption("exclude");
  await emptySelection.getByRole("group", { name: "Etiquetas disponibles" })
    .getByRole("checkbox", { name: "Parent tag" }).uncheck();
  await emptySelection.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
});

const PRESET_KEY = "myexpenses-analysis:filter-presets:v1";

test("named filter presets restore the full local view across reload and require explicit CRUD confirmation", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const drawer = await openDrawer(page);
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true }).click();
  await drawer.getByRole("group", { name: "Nivel de categoría" }).getByRole("radio", { name: "Solo ruta exacta" }).check();
  await drawer.getByRole("group", { name: "Granularidad de estadísticas y gráficas" }).locator('input[value="week"]').check();
  await drawer.locator("summary").filter({ hasText: /^Criterios adicionales$/ }).click();
  await drawer.getByRole("searchbox", { name: "Buscar en comentarios" }).fill("No matching comment");
  await drawer.getByRole("searchbox", { name: "Buscar en referencias" }).fill("No matching reference");
  await drawer.locator("summary").filter({ hasText: /^Filtros guardados$/ }).click();
  await drawer.getByRole("textbox", { name: "Nombre del filtro" }).fill("  Monthly  ");
  await drawer.getByRole("button", { name: "Guardar filtro actual" }).click();
  await expect(drawer.getByRole("option", { name: "Monthly", exact: true })).toHaveCount(1);
  const original = await page.evaluate((key) => localStorage.getItem(key), PRESET_KEY);
  expect(JSON.parse(original!).presets[0]).toMatchObject({ name: "Monthly", granularity: "week", snapshot: { filters: {
    search: "Synthetic food", commentSearch: "No matching comment", referenceSearch: "No matching reference",
    categoryPrefixes: [["Expense", "Food"]], categoryDepth: "exact",
  } } });
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  await page.reload();
  await unlock(page);
  const restored = await openDrawer(page);
  await restored.getByRole("button", { name: "Restablecer", exact: true }).click();
  await restored.locator("summary").filter({ hasText: /^Filtros guardados$/ }).click();
  await restored.getByRole("combobox", { name: "Filtro guardado", exact: true }).selectOption("Monthly");
  await restored.getByRole("button", { name: "Aplicar filtro guardado" }).click();
  await expect(restored.getByRole("searchbox", { name: "Buscar en movimientos" })).toHaveValue("Synthetic food");
  await expect(restored.getByRole("group", { name: "Granularidad de estadísticas y gráficas" }).locator('input[value="week"]')).toBeChecked();
  await expect(restored.getByRole("button", { name: "Quitar Expense › Food", exact: true })).toBeVisible();
  await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 0);
  await openDrawer(page);
  await restored.getByRole("button", { name: "Restablecer", exact: true }).click();
  await restored.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await restored.getByRole("button", { name: "Sobrescribir filtro guardado" }).click();
  await expect(restored.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), PRESET_KEY)).toBe(original);
  await restored.getByRole("button", { name: "Confirmar sobrescritura" }).click();
  await expect(restored.getByRole("combobox", { name: "Filtro guardado", exact: true })).toBeFocused();
  const replaced = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PRESET_KEY);
  expect(replaced.presets[0]).toMatchObject({ granularity: "auto", snapshot: { filters: { categoryPrefixes: [], commentSearch: "", referenceSearch: "", search: "Synthetic food" } } });
  await restored.getByRole("button", { name: "Restablecer", exact: true }).click();
  await restored.getByRole("button", { name: "Aplicar filtro guardado" }).click();
  await restored.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectTransactions(page, 1);
  await openDrawer(page);
  await restored.getByRole("button", { name: "Eliminar filtro guardado" }).click();
  await restored.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(restored.getByRole("option", { name: "Monthly", exact: true })).toHaveCount(1);
  await restored.getByRole("button", { name: "Eliminar filtro guardado" }).click();
  await restored.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(restored.getByRole("combobox", { name: "Filtro guardado", exact: true })).toBeFocused();
  await expect(restored.getByRole("option", { name: "Monthly", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).presets, PRESET_KEY)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("named filter presets preserve future payloads and visibly reject durable quota failures", async ({ page }) => {
  const raw = JSON.stringify({ version: 2, presets: [] });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: PRESET_KEY, value: raw });
  await page.reload();
  await unlock(page);
  const drawer = await openDrawer(page);
  await drawer.locator("summary").filter({ hasText: /^Filtros guardados$/ }).click();
  await drawer.getByRole("textbox", { name: "Nombre del filtro" }).fill("Preserved");
  await drawer.getByRole("button", { name: "Guardar filtro actual" }).click();
  await expect(drawer.getByText(/No se pueden utilizar los filtros guardados/)).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), PRESET_KEY)).toBe(raw);
  await page.evaluate((key) => localStorage.removeItem(key), PRESET_KEY);
  await page.reload();
  await unlock(page);
  const fresh = await openDrawer(page);
  await fresh.locator("summary").filter({ hasText: /^Filtros guardados$/ }).click();
  await fresh.getByRole("textbox", { name: "Nombre del filtro" }).fill("Quota");
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      original.call(this, name, value);
    };
  }, PRESET_KEY);
  await fresh.getByRole("button", { name: "Guardar filtro actual" }).click();
  await expect(fresh.getByText(/No se pudieron guardar los filtros locales/)).toBeVisible();
  await expect(fresh.getByRole("option", { name: "Quota", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), PRESET_KEY)).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const redirected of [false, true]) {
  test(`pending preset confirmation ${redirected ? "preserves redirected focus" : "recovers owned focus"}`, async ({ page }) => {
    const drawer = await openDrawer(page);
    await drawer.locator("summary").filter({ hasText: /^Filtros guardados$/ }).click();
    await drawer.getByRole("textbox", { name: "Nombre del filtro" }).fill("Pending");
    await drawer.getByRole("button", { name: "Guardar filtro actual" }).click();
    const selector = drawer.getByRole("combobox", { name: "Filtro guardado", exact: true });
    await expect(selector).toHaveValue("Pending");
    // Native localStorage is synchronous; inject the supported async storage contract.
    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name !== key) return original.call(this, name, value);
        document.documentElement.dataset.presetWritePending = "true";
        return new Promise<void>((resolve) => {
          document.addEventListener("synthetic-preset-write-release", () => {
            original.call(this, name, value);
            resolve();
          }, { once: true });
        });
      };
    }, PRESET_KEY);
    await drawer.getByRole("button", { name: "Eliminar filtro guardado" }).click();
    const confirm = drawer.getByRole("button", { name: "Confirmar eliminación" });
    await confirm.focus();
    await confirm.press("Enter");
    await expect(confirm).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-preset-write-pending", "true");
    await confirm.evaluate((element) => {
      const button = element as HTMLButtonElement;
      button.disabled = false;
      button.blur();
      button.disabled = true;
    });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    const search = drawer.getByRole("searchbox", { name: "Buscar en movimientos" });
    if (redirected) await search.focus();
    await page.evaluate(() => document.dispatchEvent(new Event("synthetic-preset-write-release")));
    await expect(confirm).toHaveCount(0);
    await expect(redirected ? search : selector).toBeFocused();
    await expect(drawer).toBeVisible();
  });
}
