import { expect, test, type Locator, type Page } from "@playwright/test";
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

test("makes provenance reachable on mobile and comparison scrolling keyboard accessible", async ({ page }) => {
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
  await expect(page.locator("main output")).toContainText("1 resultados.");
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Moneda: EUR/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toBeVisible();
  expect(page.url()).not.toContain("Synthetic food");
  expect(await page.evaluate(() => Object.values(localStorage).join(" "))).not.toContain("Synthetic food");
  await expectNoDocumentOverflow(page);

  await page.getByRole("link", { name: "Patrones" }).click();
  await page.getByRole("button", { name: "Ver 1 movimiento computado de Neutral method" }).click();
  await expect(page.locator("main output")).toContainText("1 resultados.");
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Método:/ })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  await page.getByRole("dialog", { name: "Filtros del análisis" }).getByRole("button", { name: "Restablecer" }).click();
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Beneficiario:/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Quitar filtro Método:/ })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Ver apuntes consumidos de Expense", exact: true }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Expense · apuntes" });
  await expect(categoryDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await expect(categoryDialog.getByText(/4 apuntes · -0,95/)).toBeVisible();
  await categoryDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await page.getByRole("button", { name: "Ver apuntes consumidos de Expense › Food" }).click();
  const foodDialog = page.getByRole("dialog", { name: "Expense › Food · apuntes" });
  await expect(foodDialog.getByText(/1 apunte · 0,25/)).toBeVisible();
  await expect(foodDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await foodDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("button", { name: "Filtrar: Expense" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});
