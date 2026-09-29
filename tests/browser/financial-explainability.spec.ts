import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://127.0.0.1:41789";
const PASSPHRASE = "synthetic-browser-only-passphrase";
const outboundByPage = new WeakMap<Page, string[]>();

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document, `document width at ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function readAmountBoundary(input: Locator) {
  return input.evaluate((element) => {
    const candidates: Element[] = element.parentElement ? [element, element.parentElement] : [element];
    const borders = candidates.map((candidate) => {
      const computed = getComputedStyle(candidate);
      return { width: computed.borderTopWidth, style: computed.borderTopStyle, color: computed.borderTopColor };
    });
    return { focused: document.activeElement === element, borders };
  });
}

function hasUnfocusedAmountBoundary(boundary: Awaited<ReturnType<typeof readAmountBoundary>>): boolean {
  return !boundary.focused && boundary.borders.some((border) => Number.parseFloat(border.width) >= 1 && border.style === "solid" && border.color !== "rgba(0, 0, 0, 0)");
}

test.beforeEach(async ({ context, page }) => {
  const outbound: string[] = [];
  outboundByPage.set(page, outbound);
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin !== BASE) {
      outbound.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin !== BASE) outbound.push(request.url());
  });
  await page.clock.setFixedTime(new Date("2026-09-27T12:00:00.000Z"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Abrir el libro cifrado" })).toBeVisible();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  expect(outbound).toEqual([]);
});

test.afterEach(async ({ page }) => {
  expect(outboundByPage.get(page)).toEqual([]);
});

test("keeps summary and cash-flow detail reachable without obscuring primary figures", async ({ page }) => {
  const summary = page.getByText("Saldos, deuda y conciliación", { exact: true });
  await expect(page.getByText("Flujo del periodo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pulso financiero" })).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(summary.locator("xpath=..")).not.toHaveAttribute("open");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("xpath=..")).toHaveAttribute("open", "");
  await expect(page.getByText("Saldo en deudas", { exact: true })).toBeVisible();
  await expect(page.getByText("Anulados visibles", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(summary.locator("xpath=..")).not.toHaveAttribute("open");
  await page.getByText("Composición y categorías", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Categorías dominantes" })).toBeVisible();
  await expectNoDocumentOverflow(page);

  await page.locator('a[href="/flujo-de-caja"]').click();
  await expect(page.getByRole("article", { name: "Flujo real" })).toBeVisible();
  await expect(page.getByText("Resultado consolidado", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flujo neto por periodo" })).toBeVisible();
  const composition = page.getByText("Composición del flujo", { exact: true });
  await composition.focus();
  await page.keyboard.press("Enter");
  await expect(composition.locator("xpath=..")).toHaveAttribute("open", "");
  await expect(page.getByRole("heading", { name: "Presión por categoría" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transferencias" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "aria-hidden-focus"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
});

test("unlocks a synthetic vault and exposes separate provenance labels", async ({ page }) => {
  const snapshot = page.getByLabel("Navegación y estado de la aplicación");
  if (page.viewportSize()!.width > 896) {
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeVisible();
    await expect(snapshot.getByText("Fecha del nombre (no confirma la captura)")).toBeVisible();
    await expect(snapshot.getByText("22/08/2026 21:04:53 · zona no indicada")).toBeVisible();
    await expect(snapshot.getByText("Importado")).toBeVisible();
    await expect(snapshot.getByText("23/08/2026 10:00:00 UTC")).toBeVisible();
    await expect(snapshot.getByText("Revisión de la aplicación")).toBeVisible();
    await expect(snapshot.getByText("b".repeat(40))).toBeVisible();
  } else {
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeHidden();
  }
  await expectNoDocumentOverflow(page);
});

test("makes provenance reachable on mobile and comparison scrolling keyboard accessible", async ({ page }, testInfo) => {
  const snapshot = page.getByLabel("Navegación y estado de la aplicación");
  const summary = snapshot.locator("summary").filter({ hasText: /Instantánea local|Datos/ });
  await expect(summary).toBeVisible();
  if (page.viewportSize()!.width <= 896) {
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeHidden();
    await summary.click();
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeVisible();
    await expect(snapshot.getByText("Fecha del nombre (no confirma la captura)")).toBeVisible();
    await expect(snapshot.getByText("Revisión de la aplicación")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeHidden();
    await expect(summary).toBeFocused();
  } else {
    await expect(snapshot.getByText("Cobertura de movimientos")).toBeVisible();
  }
  await page.getByRole("link", { name: "Comparativa" }).click();
  const region = page.getByRole("region", { name: "Comparación de movimientos por perspectiva" });
  await expect(region).toBeVisible();
  await region.focus();
  await expect(region).toBeFocused();
  if (page.viewportSize()!.width <= 390) {
    const before = await region.evaluate((element) => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
    await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
      return (await axe.run(document.body, { runOnly: { type: "rule", values: ["scrollable-region-focusable"] } })).violations.map(({ id }) => id);
    });
    expect(violations).toEqual([]);
  }
  const categories = page.getByRole("region", { name: "Categorías por perspectiva" });
  await categories.scrollIntoViewIfNeeded();
  await expect(categories.getByRole("list", { name: "Categorías comparadas" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("comparison.png"), fullPage: true });
  const comparisonSummary = page.getByRole("region", { name: "Resumen de perspectivas" });
  const perspectives = comparisonSummary.getByRole("article");
  await expect(perspectives).toHaveCount(3);
  expect(await perspectives.getByRole("heading").allTextContents()).toEqual(["Yo", "Flujo real", "Deudas"]);
  await expect(perspectives.nth(0).locator("data")).toHaveAttribute("value", "4.52");
  await expect(perspectives.nth(1).locator("data")).toHaveAttribute("value", "4.02");
  await expect(perspectives.nth(2).locator("data")).toHaveAttribute("value", "0.5");
  await expect(comparisonSummary.getByText(/reúne los movimientos de Flujo real y Deudas/)).toBeVisible();
  await expect(comparisonSummary.getByText(/no es gasto atribuido ni saldo/)).toBeVisible();
  await expect(categories.getByRole("button", { name: "Contraer Expense" })).toBeVisible();
  await expect(categories.getByText("Expense › Food", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("shows unavailable source and import provenance for a legacy encrypted dataset", async ({ page }) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const legacy = await route.fetch({ url: `${BASE}/data/legacy.vault.json` });
    await route.fulfill({ response: legacy });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  const snapshot = page.getByLabel("Navegación y estado de la aplicación");
  await expect(snapshot.getByText("No disponible")).toHaveCount(2);
  await expect(snapshot.getByText("b".repeat(40))).toHaveCount(1);
  expect((await page.request.get(`${BASE}/package.json`)).status()).toBe(404);
});

test("keeps mobile time controls outside the filter drawer and search inside it", async ({ page }) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await expect(toolbar.getByRole("combobox", { name: "Tipo de periodo" })).toBeVisible();
  await expect(toolbar.getByRole("group", { name: "Granularidad de estadísticas y gráficas" })).toBeVisible();
  const toolbarSearch = toolbar.getByRole("searchbox", { name: "Buscar en todos los movimientos" });
  if (page.viewportSize()!.width <= 832) await expect(toolbarSearch).toBeHidden();
  else await expect(toolbarSearch).toBeVisible();

  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await expect(drawer.getByRole("searchbox", { name: "Buscar en movimientos" })).toBeVisible();
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("group", { name: "Ámbito de las estadísticas" }).getByRole("radio", { name: "Yo" }).check();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  await expect(page.getByRole("heading", { name: "Transacciones" })).toBeVisible();
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  await expect(drawer.getByRole("searchbox", { name: "Buscar en movimientos" })).toHaveValue("Synthetic food");
  await expect(drawer.getByRole("group", { name: "Ámbito de las estadísticas" }).getByRole("radio", { name: "Yo" })).toBeChecked();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expectNoDocumentOverflow(page);
});

test("combines additional filter controls, exposes chips and rejects invalid EUR ranges", async ({ page }) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const opener = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByText("Criterios adicionales").click();
  const min = drawer.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" });
  const max = drawer.getByRole("textbox", { name: "Importe absoluto máximo (EUR)" });
  const emptyMinBoundary = await readAmountBoundary(min);
  const emptyMaxBoundary = await readAmountBoundary(max);
  await expect(drawer.getByRole("group", { name: "Beneficiarios" }).getByRole("checkbox", { name: "Sin beneficiario" })).toBeVisible();
  await drawer.getByRole("group", { name: "Métodos de pago" }).getByRole("checkbox", { name: "Sin método de pago" }).check();
  await drawer.getByRole("checkbox", { name: "Gasto" }).check();
  await drawer.getByRole("checkbox", { name: "EUR", exact: true }).check();
  await drawer.getByRole("searchbox", { name: "Buscar en comentarios" }).fill("Synthetic food");
  await drawer.getByRole("searchbox", { name: "Buscar en referencias" }).fill("ABC");
  await min.fill("0");
  await max.fill("25,00");
  await max.evaluate((element) => element.blur());
  const populatedMaxBoundary = await readAmountBoundary(max);
  const amountBoundaries = { emptyMinBoundary, emptyMaxBoundary, populatedMaxBoundary };
  expect(Object.values(amountBoundaries).every(hasUnfocusedAmountBoundary), JSON.stringify(amountBoundaries)).toBe(true);
  await expect(drawer.getByText(/Rango no aplicado/)).toHaveCount(0);
  await min.fill("30");
  await expect(drawer.getByText(/Rango no aplicado/)).toBeVisible();
  await expect(min).toHaveAttribute("aria-invalid", "true");
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.querySelector("dialog")!, { runOnly: { type: "rule", values: ["label", "aria-valid-attr-value", "color-contrast"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await min.fill("20");
  await expect(drawer.getByText(/Rango no aplicado/)).toHaveCount(0);
  if (page.viewportSize()!.width === 1280) await page.screenshot({ path: "/tmp/myexpenses-t2-filter-drawer-synthetic.png" });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(toolbar.getByRole("button", { name: "Quitar filtro Moneda: EUR" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Importe absoluto ≥ 20,00 EUR/ })).toBeVisible();
  expect(page.url()).not.toContain("Synthetic food");
  expect(await page.evaluate(() => Object.values(localStorage).join(" "))).not.toContain("Synthetic food");
  expect(await page.evaluate(() => Object.values(localStorage).join(" "))).not.toContain("ABC");
  await expectNoDocumentOverflow(page);
  await opener.click();
  await drawer.getByRole("button", { name: "Restablecer" }).click();
  await expect(min).toHaveValue("");
  await expect(max).toHaveValue("");
  await expect(toolbar.getByRole("button", { name: "Quitar filtro Moneda: EUR" })).toHaveCount(0);
});

test("drills from exact Patterns identities without dropping other facets", async ({ page }) => {
  await page.getByRole("link", { name: "Patrones" }).click();
  await expect(page.getByRole("button", { name: /movimientos computados de Child payee \(ID 1\)/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /movimiento computado de Child payee \(ID 3\)/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /movimientos computados de Neutral method \(ID 1\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /movimiento computado de Neutral method \(ID 4\)/ })).toBeVisible();
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const actionViolations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast"] } })).violations.map(({ id }) => id);
  });
  expect(actionViolations).toEqual([]);
  if (page.viewportSize()!.width === 1280) await page.screenshot({ path: "/tmp/myexpenses-t3-patterns-synthetic.png" });
  if (page.viewportSize()!.width === 390) {
    await page.getByRole("button", { name: /Ver 3 movimientos computados de Child payee \(ID 1\)/ }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/myexpenses-t3-patterns-synthetic-mobile.png" });
  }
  await expectNoDocumentOverflow(page);

  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByText("Criterios adicionales").click();
  await drawer.getByRole("group", { name: "Moneda del movimiento" }).getByRole("checkbox", { name: "EUR" }).check();
  await drawer.getByRole("searchbox", { name: "Buscar en comentarios" }).fill("Synthetic food");
  await drawer.getByRole("textbox", { name: "Importe absoluto mínimo (EUR)" }).fill("0,25");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();

  const payeeAction = page.getByRole("button", { name: "Ver 1 movimiento computado de Child payee" }).first();
  await expect(payeeAction).toBeEnabled();
  await payeeAction.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Transacciones" })).toBeVisible();
  await expect(page.locator("main output")).toContainText("1 resultado.");
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Moneda: EUR/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toBeVisible();
  expect(page.url()).not.toContain("Synthetic food");
  expect(await page.evaluate(() => Object.values(localStorage).join(" "))).not.toContain("Synthetic food");
  await expectNoDocumentOverflow(page);

  await page.getByRole("link", { name: "Patrones" }).click();
  await page.getByRole("button", { name: "Ver 1 movimiento computado de Neutral method" }).click();
  await expect(page.locator("main output")).toContainText("1 resultado.");
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Método:/ })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  await page.getByRole("dialog", { name: "Filtros del análisis" }).getByRole("button", { name: "Restablecer" }).click();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Método:/ })).toHaveCount(0);
});

test("keeps Patterns rankings primary and their actions readable at every width", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: "Patrones" }).click();
  const payees = page.getByRole("region", { name: "Contrapartes con más actividad" });
  const methods = page.getByRole("region", { name: "Métodos de pago" });
  const dates = page.getByRole("region", { name: "Operación frente a fecha valor" });
  await expect(payees).toBeVisible();
  await expect(methods).toBeVisible();
  await expect(dates).toBeVisible();
  const headings = await page.locator("main h2").allTextContents();
  expect(headings.indexOf("Métodos de pago")).toBeGreaterThan(headings.indexOf("Contrapartes con más actividad"));
  expect(headings.indexOf("Métodos de pago")).toBeLessThan(headings.indexOf("Operación frente a fecha valor"));
  await expect(methods).toContainText("Ranking por número de movimientos computados");
  await expect(methods).toContainText("Neto con signo");
  await expect(methods).not.toContainText("apenas aparece");
  await expect(page.getByRole("region", { name: "Procedencia y calidad" })).toBeVisible();
  const rowBounds = await methods.getByRole("listitem").evaluateAll((rows) => rows.map((row) => {
    const outer = row.getBoundingClientRect();
    return [...row.querySelectorAll("strong, button")].map((child) => {
      const inner = child.getBoundingClientRect();
      return inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
    });
  }));
  expect(rowBounds.flat().every(Boolean)).toBe(true);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "scrollable-region-focusable"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await expectNoDocumentOverflow(page);
  await payees.getByRole("heading", { name: "Contrapartes con más actividad" }).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: testInfo.outputPath("patterns-payees.png") });
  await methods.getByRole("heading", { name: "Métodos de pago" }).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: testInfo.outputPath("patterns-methods.png") });
  const action = methods.getByRole("button", { name: /Ver 1 movimiento computado de Neutral method \(ID 4\)/ });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Transacciones" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Filtros globales" }).getByRole("button", { name: /Quitar filtro Método:/ })).toBeVisible();
});

test("keeps every primary route inside the document viewport", async ({ page }) => {
  const routes = [
    "/flujo-de-caja", "/comparativa", "/deudas", "/presupuestos",
    "/categorias", "/cuentas", "/patrones", "/transacciones", "/resumen",
  ];
  const navigation = page.getByRole("navigation", { name: "Secciones principales" });
  for (const route of routes) {
    // oxlint-disable-next-line no-await-in-loop -- each route must finish rendering before the next navigation.
    await navigation.locator(`a[href="${route}"]`).click();
    // oxlint-disable-next-line no-await-in-loop -- wait for this exact route before measuring its viewport.
    await expect.poll(() => new URL(page.url()).pathname).toBe(route);
    // oxlint-disable-next-line no-await-in-loop -- measure after each route transition.
    await expect(page.locator("main h1")).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- each route is a separate overflow assertion.
    await expectNoDocumentOverflow(page);
  }
});

test("keeps shared navigation, controls and serious accessibility checks consistent across routes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const routes = [
    "/resumen", "/flujo-de-caja", "/comparativa", "/deudas", "/presupuestos",
    "/categorias", "/cuentas", "/patrones", "/transacciones",
  ];
  const navigation = page.getByRole("navigation", { name: "Secciones principales" });
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  for (const route of routes) {
    const link = navigation.locator(`a[href="${route}"]`);
    // oxlint-disable-next-line no-await-in-loop -- each route's active state follows its navigation.
    await link.click();
    // oxlint-disable-next-line no-await-in-loop -- wait for the selected route before checking shared UI.
    await expect.poll(() => new URL(page.url()).pathname).toBe(route);
    // oxlint-disable-next-line no-await-in-loop -- route-specific current location is announced once.
    await expect(link).toHaveAttribute("aria-current", "page");
    // oxlint-disable-next-line no-await-in-loop -- shared controls must remain available after every transition.
    await expect(toolbar.getByRole("combobox", { name: "Tipo de periodo" })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- granularity must remain reachable on mobile.
    await expect(toolbar.getByRole("group", { name: "Granularidad de estadísticas y gráficas" })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- each route needs an independent rendered accessibility result.
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: Element) => Promise<{ violations: { id: string; impact: string | null }[] }> } }).axe;
      return (await axe.run(document.body)).violations
        .filter(({ impact }) => impact === "critical" || impact === "serious")
        .map(({ id, impact }) => ({ id, impact }));
    });
    expect(violations, `${route} axe critical/serious`).toEqual([]);
    // oxlint-disable-next-line no-await-in-loop -- one representative focus target per route checks the fixed chrome boundary.
    const focusTarget = page.locator("main button:not([disabled]):visible, main select:not([disabled]):visible, main summary:visible").last();
    // oxlint-disable-next-line no-await-in-loop -- focus and measurement belong to this route.
    await focusTarget.focus();
    // oxlint-disable-next-line no-await-in-loop -- focus must survive scrolling below sticky chrome.
    await expect(focusTarget).toBeFocused();
    // oxlint-disable-next-line no-await-in-loop -- measure the focused target, not an unrelated element.
    const focus = await focusTarget.evaluate((target) => {
      const rect = target.getBoundingClientRect();
      const filters = document.querySelector<HTMLElement>("[aria-label='Filtros globales']")?.getBoundingClientRect();
      const nav = document.querySelector<HTMLElement>("nav[aria-label='Secciones principales']")?.getBoundingClientRect();
      const bottom = nav && nav.top > window.innerHeight / 2 ? nav.top : window.innerHeight;
      return Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, filters?.bottom ?? 0));
    });
    expect(focus, `${route} focus not fully covered`).toBeGreaterThan(0);
    // oxlint-disable-next-line no-await-in-loop -- route content may change after focus scroll.
    await expectNoDocumentOverflow(page);
  }
});

test("reaches the end of a long filter drawer by keyboard and restores its trigger", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const opener = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByText("Criterios adicionales").click();
  const reference = drawer.getByRole("searchbox", { name: "Buscar en referencias" });
  await reference.focus();
  await expect(reference).toBeFocused();
  const bodyScroll = await reference.evaluate((element) => {
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto") parent = parent.parentElement;
    return parent?.scrollTop ?? 0;
  });
  expect(bodyScroll).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("button", { name: "Ver resultados" })).toBeFocused();
  await mkdir("/tmp/myexpenses-u8-visual", { recursive: true });
  await page.screenshot({ path: `/tmp/myexpenses-u8-visual/filter-drawer-${testInfo.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expectNoDocumentOverflow(page);
});

test("uses consistent reconciliation and singular result copy in the rendered routes", async ({ page }, testInfo) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u6-transactions.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  const details = page.getByText("Saldos, deuda y conciliación", { exact: true });
  await details.focus();
  await page.keyboard.press("Enter");
  const reconciliationLabel = page.locator("main").getByText("Sin conciliar", { exact: true });
  await expect(reconciliationLabel).toBeVisible();
  await reconciliationLabel.scrollIntoViewIfNeeded();
  await mkdir("/tmp/myexpenses-u8-visual", { recursive: true });
  await page.screenshot({ path: `/tmp/myexpenses-u8-visual/overview-copy-${testInfo.project.name}.png` });
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const results = page.getByRole("region", { name: "Movimientos filtrados" });
  await expect(results).toContainText("1 resultado");
  await expect(page.locator("main").getByRole("status")).toContainText("1 resultado.");
  await results.getByText("1 resultado", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/myexpenses-u8-visual/transaction-copy-${testInfo.project.name}.png` });
  await expectNoDocumentOverflow(page);
});

test("reveals complete transaction text and source status by keyboard at every viewport", async ({ page }, testInfo) => {
  const visualDirectory = "/tmp/myexpenses-u6-visual";
  await mkdir(visualDirectory, { recursive: true });
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u6-transactions.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("Synthetic food");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();

  const table = page.getByRole("table", { name: "Transacciones que coinciden con los filtros globales" });
  const row = table.getByRole("row", { name: /Synthetic payee with an identifying suffix/ });
  await expect(row).toBeVisible();
  expect(await table.getByRole("columnheader").allTextContents()).toEqual([
    "Fecha", "Concepto", "Categoría", "Cuenta", "Importe", "Cuenta de origen", "Cuenta de destino",
  ]);
  await expect(page.getByText(/Estado de todos los resultados:/)).toContainText("Sin conciliar");
  const summary = row.getByText("Ver concepto completo y trazabilidad");
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(visualDirectory, `transaction-row-closed-${testInfo.project.name}.png`) });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("..")).toHaveAttribute("open", "");
  const fullPayee = "Synthetic payee with an identifying suffix that extends beyond the compact row 123456789";
  const fullComment = "Synthetic food comment with complete context that extends beyond the compact row 987654321";
  await expect(row.getByText("Payee del apunte").locator("..")).toContainText(fullPayee);
  await expect(row.getByText("Comentario del apunte").locator("..")).toContainText(fullComment);
  await expect(row.getByText("Estado MyExpenses").locator("..")).toContainText("Sin conciliar (UNRECONCILED)");
  const textLayout = await row.getByText("Comentario del apunte").locator("..").locator("dd").evaluate((element) => ({
    visible: element.getBoundingClientRect().height > 0,
    scroll: element.scrollWidth,
    width: element.clientWidth,
  }));
  expect(textLayout.visible).toBe(true);
  expect(textLayout.scroll, JSON.stringify(textLayout)).toBeLessThanOrEqual(textLayout.width + 1);
  await page.screenshot({ path: join(visualDirectory, `transaction-row-open-${testInfo.project.name}.png`) });
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "scrollable-region-focusable", "aria-valid-attr-value"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await page.keyboard.press("Space");
  await expect(summary.locator("..")).not.toHaveAttribute("open");
  const scroller = page.getByRole("region", { name: "Transacciones que coinciden con los filtros globales" });
  await scroller.focus();
  await expect(scroller).toBeFocused();
  if (page.viewportSize()!.width < 500) {
    const before = await scroller.evaluate((element) => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  }
  await expectNoDocumentOverflow(page);

  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("");
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expect.poll(() => table.locator("tbody tr").count()).toBeGreaterThan(1);
  await expect(table.getByRole("columnheader", { name: "Estado" })).toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("..")).toHaveAttribute("open", "");
  const factTops = await row.evaluate((element) => {
    const cells = Array.from(element.querySelectorAll(":scope > td"));
    const textTop = (index: number) => {
      const cell = cells[index];
      if (cell === undefined) throw new Error(`Missing transaction cell ${index}`);
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node !== null && !node.textContent?.trim()) node = walker.nextNode();
      if (node === null) throw new Error("Expected a visible transaction fact");
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().top;
    };
    return {
      date: textTop(0),
      concept: textTop(1),
      category: textTop(2),
      account: textTop(3),
      amount: textTop(4),
    };
  });
  for (const fact of ["date", "category", "account", "amount"] as const) {
    expect(Math.abs(factTops[fact] - factTops.concept), `${fact} should align with concept when details expand: ${JSON.stringify(factTops)}`).toBeLessThanOrEqual(20);
  }
});

test("opens the shared average disclosure by keyboard and keeps accordion actions separate", async ({ page }) => {
  await page.getByRole("link", { name: "Categorías" }).click();
  await expect(page.getByRole("heading", { name: "Categorías", exact: true })).toBeVisible();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await toolbar.getByRole("group", { name: "Granularidad de estadísticas y gráficas" }).getByRole("radio", { name: "Mes" }).check();
  const summary = page.getByText("Cómo se calcula el promedio", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("..")).toHaveAttribute("open", "");
  await expect(page.getByText(/Divisor: 1 mes completo, incluidos los períodos sin actividad/)).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /Ventana incluida:.*01\/08\/2026.*31\/08\/2026/ })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /Ventana incluida:.*01\/07\/2026.*31\/07\/2026/ })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.keyboard.press("Space");
  await expect(summary.locator("..")).not.toHaveAttribute("open", "");

  await toolbar.getByLabel("Mes seleccionado").fill("2026-09");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/no terminó antes de hoy/)).toBeVisible();
  await page.keyboard.press("Space");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");

  await expect(page.getByRole("button", { name: "Filtrar: Expense", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Contraer Expense" }).click();
  await expect(page.getByRole("button", { name: "Desplegar Expense" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtrar: Expense", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expectNoDocumentOverflow(page);
});

test("puts category paths and account balances before charts without losing keyboard context", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: "Categorías" }).click();
  const tree = page.getByRole("region", { name: "Explorador jerárquico" });
  const comparison = page.getByRole("region", { name: "Consultar categorías" });
  await tree.scrollIntoViewIfNeeded();
  expect(await tree.evaluate((element, next) => Boolean(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), await comparison.elementHandle())).toBe(true);
  const rootSelection = tree.getByRole("button", { name: "Filtrar: Expense", exact: true });
  const rootRow = rootSelection.locator("xpath=..");
  const counts = rootRow.getByText(/\d+ dir\. \/ \d+ total/);
  await expect(counts).toBeVisible();
  await expect(rootRow.getByText(/Promedio.*períodos? completos?/)).toBeVisible();
  const countsLayout = await counts.evaluate((element) => ({ scroll: element.scrollWidth, width: element.clientWidth }));
  expect(countsLayout.scroll, JSON.stringify(countsLayout)).toBeLessThanOrEqual(countsLayout.width + 1);
  await rootSelection.focus();
  await page.keyboard.press("Space");
  await expect(tree.getByRole("button", { name: "Quitar filtro: Expense", exact: true })).toHaveAttribute("aria-pressed", "true");
  const collapse = tree.getByRole("button", { name: "Contraer Expense" });
  await collapse.focus();
  await page.keyboard.press("Enter");
  await expect(tree.getByRole("button", { name: "Desplegar Expense" })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Quitar filtro: Expense", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ver todas las categorías" }).click();
  await tree.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("categories.png"), fullPage: true });
  await expectNoDocumentOverflow(page);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const categoryViolations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "scrollable-region-focusable", "aria-valid-attr-value"] } })).violations.map(({ id }) => id);
  });
  expect(categoryViolations).toEqual([]);

  await page.getByRole("link", { name: "Cuentas" }).click();
  const inventory = page.getByRole("region", { name: "Inventario de cuentas" });
  await inventory.scrollIntoViewIfNeeded();
  await expect(inventory.getByRole("article").first()).toBeVisible();
  expect(await inventory.evaluate((element) => {
    const chart = [...document.querySelectorAll("h2, h3")].find((heading) => heading.textContent === "Mapa de saldos");
    return chart !== undefined && Boolean(element.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  const account = inventory.getByRole("article").first();
  await expect(account.getByText("Saldo real al cierre", { exact: true })).toBeVisible();
  await expect(account.getByText(/Flujo filtrado/)).toBeVisible();
  const balance = account.locator("strong").first();
  const balanceLayout = await balance.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(balanceLayout.height, JSON.stringify(balanceLayout)).toBeLessThanOrEqual(balanceLayout.lineHeight * 1.25);
  expect(balanceLayout.scrollWidth, JSON.stringify(balanceLayout)).toBeLessThanOrEqual(balanceLayout.clientWidth + 1);
  await page.screenshot({ path: testInfo.outputPath("accounts.png"), fullPage: true });
  const details = account.locator("summary");
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(details.locator("..")).toHaveAttribute("open", "");
  await expect(account.getByText("Saldo histórico EUR")).toBeVisible();
  if (page.viewportSize()!.width > 760) {
    const cardHeights = await Promise.all([
      account.evaluate((element) => element.getBoundingClientRect().height),
      inventory.getByRole("article").nth(1).evaluate((element) => element.getBoundingClientRect().height),
    ]);
    expect(cardHeights[1], JSON.stringify(cardHeights)).toBeLessThan(cardHeights[0]!);
  }
  await expectNoDocumentOverflow(page);
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "scrollable-region-focusable", "aria-valid-attr-value"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
});

test("budget details retain exact movement IDs and native close returns focus", async ({ page }) => {
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await expect(page.getByRole("heading", { name: "Presupuestos" })).toBeVisible();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  const overallTrigger = page.getByRole("button", { name: "Ver apuntes del gasto neto" });
  await overallTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Gasto neto · apuntes" });
  await expect(dialog).toBeVisible();
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const accessibilityViolations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: {
      run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }>;
    } }).axe;
    const result = await axe.run(document.querySelector("dialog")!, {
      runOnly: { type: "rule", values: ["aria-dialog-name", "button-name", "aria-hidden-focus"] },
    });
    return result.violations.map(({ id }) => id);
  });
  expect(accessibilityViolations).toEqual([]);
  await expectNoDocumentOverflow(page);
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(dialog.getByText(/4 apuntes · -0,95/)).toBeVisible();
  const actualIds = await dialog.getByText(/^ID: /).allTextContents();
  expect(actualIds.toSorted()).toEqual([1, 8, 15, 17].map((number) =>
    `ID: 11111111-1111-4111-8111-111111111111:10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  ).toSorted());
  const signedAmounts = await dialog.locator("ol > li > div:last-child > strong").allTextContents();
  expect(signedAmounts.map((amount) => Number(amount.replace(/[^\d,-]/gu, "").replace(",", "."))))
    .toEqual([1, -2, 0.25, -0.2]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(overallTrigger).toBeFocused();
  await page.getByRole("button", { name: /Ver apuntes consumidos de Expense:/ }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Expense · apuntes" });
  await expect(categoryDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await expect(categoryDialog.getByText(/4 apuntes · -0,95/)).toBeVisible();
  await categoryDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await page.getByRole("button", { name: /Ver apuntes consumidos de Expense › Food:/ }).click();
  const foodDialog = page.getByRole("dialog", { name: "Expense › Food · apuntes" });
  await expect(foodDialog.getByText(/1 apunte · 0,25/)).toBeVisible();
  await expect(foodDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await foodDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("button", { name: "Filtrar: Expense" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test("keeps debt selection next to balance and preserves budget action names", async ({ page }) => {
  await page.getByRole("link", { name: "Deudas" }).click();
  const selection = page.getByRole("region", { name: "Seleccionar cuentas de deuda" });
  await expect(selection).toBeVisible();
  const balance = page.getByText("Saldo conjunto en deudas");
  const trend = page.getByRole("heading", { name: "Evolución de la selección" });
  const inOrder = await selection.evaluate((element, references) => {
    const before = document.querySelector(references.balance)!;
    const after = document.querySelector(references.trend)!;
    return Boolean(before.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      Boolean(element.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, { balance: "[class*='debtSummaryLabel']", trend: "[class*='chartPanel'] h2" });
  expect(inOrder).toBe(true);
  await expect(selection.getByText("Deuda", { exact: true })).toHaveCount(0);
  await expect(balance).toBeVisible();
  await expect(trend).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const debtViolations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "aria-hidden-focus"] } })).violations.map(({ id }) => id);
  });
  expect(debtViolations).toEqual([]);
  await page.screenshot({ path: `/tmp/myexpenses-u3-visual/debts-after-${page.viewportSize()!.width}.png`, fullPage: true });
  const accountCard = selection.locator("article").first();
  await accountCard.scrollIntoViewIfNeeded();
  await expect(accountCard.getByRole("button", { name: "Incluir" })).toBeVisible();
  await expect.poll(() => accountCard.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(240);
  await accountCard.screenshot({ path: `/tmp/myexpenses-u3-visual/debts-account-${page.viewportSize()!.width}.png` });

  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  const action = page.getByRole("button", { name: /Ver apuntes consumidos de Expense:/ });
  await expect(action).toBeVisible();
  expect(await action.getAttribute("aria-label")).toContain((await action.textContent())!.trim());
  await expect(page.getByText("Asignado global")).toBeVisible();
  await expect(page.getByText("Arrastre recibido")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.body, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "aria-hidden-focus"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await Promise.all(([
    ["Utilización del corte de Expense", /-95\s*%/],
    ["Utilización del corte de Expense › Food", /125\s*%/],
  ] as const).map(async ([label, amount]) => {
    const meter = page.getByRole("meter", { name: label, exact: true });
    await expect(meter).toHaveAttribute("aria-valuetext", amount);
    const layout = await meter.evaluate((element) => {
      const heading = element.previousElementSibling!;
      const text = heading.firstElementChild as HTMLElement;
      const value = heading.lastElementChild as HTMLElement;
      return {
        labelFits: text.scrollWidth <= text.clientWidth + 1,
        valueHeight: value.getBoundingClientRect().height,
        singleLineHeight: Number.parseFloat(getComputedStyle(value).fontSize) * 1.6,
      };
    });
    expect(layout.labelFits, `${label} label must wrap inside its cell`).toBe(true);
    expect(layout.valueHeight, `${label} percentage must stay on one line`).toBeLessThanOrEqual(layout.singleLineHeight);
  }));
  await page.screenshot({ path: `/tmp/myexpenses-u3-visual/budgets-after-${page.viewportSize()!.width}.png`, fullPage: true });
});

test("keeps the no-limit budget honest and moves focus into the final 27-item batch", async ({ page }) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u3-budget.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  const utilization = page.getByRole("article", { name: "Utilización" });
  await expect(utilization).toContainText("Sin límite global");
  await expect(utilization).not.toContainText("0 %");
  const trigger = page.getByRole("button", { name: "Ver apuntes del gasto neto" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Gasto neto · apuntes" });
  await expect(dialog.getByText(/27 apuntes/)).toBeVisible();
  await expect(dialog.locator("ol > li")).toHaveCount(25);
  const more = dialog.getByRole("button", { name: /Mostrar más/ });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.locator("ol > li")).toHaveCount(27);
  await expect(more).toHaveCount(0);
  await expect(dialog.locator("ol > li").nth(25)).toBeFocused();
  const scrollRegion = dialog.getByRole("region", { name: "Gasto neto · apuntes" });
  await dialog.getByRole("button", { name: "Cerrar detalle" }).focus();
  await page.keyboard.press("Tab");
  await expect(scrollRegion).toBeFocused();
  await scrollRegion.evaluate((element) => { element.scrollTop = 0; });
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await scrollRegion.evaluate((element) => { element.scrollTop = 0; });
  await page.keyboard.press("PageDown");
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectNoDocumentOverflow(page);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(document.querySelector("dialog")!, { runOnly: { type: "rule", values: ["aria-dialog-name", "button-name", "aria-hidden-focus", "scrollable-region-focusable"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await page.screenshot({ path: `/tmp/myexpenses-u3-visual/budget-no-limit-dialog-${page.viewportSize()!.width}.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
