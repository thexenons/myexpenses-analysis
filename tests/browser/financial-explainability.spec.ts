import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://127.0.0.1:41789";
const PASSPHRASE = "synthetic-browser-only-passphrase";
const outboundByPage = new WeakMap<Page, string[]>();

function toolbarGranularity(toolbar: Locator): Locator {
  return toolbar.getByRole("group", { name: "Granularidad de estadísticas y gráficas" })
    .or(toolbar.getByRole("combobox", { name: "Granularidad de estadísticas y gráficas" }));
}

async function selectToolbarGranularity(toolbar: Locator, value: string): Promise<void> {
  const select = toolbar.getByRole("combobox", { name: "Granularidad de estadísticas y gráficas" });
  if (await select.isVisible()) await select.selectOption(value);
  else await toolbarGranularity(toolbar).locator(`input[value="${value}"]`).check();
}

async function setAppTime(page: Page, date: string): Promise<void> {
  await page.clock.setFixedTime(new Date(date));
  // Mounted calendar snapshots refresh on focus, not arbitrary re-renders.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}

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
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  expect(outbound).toEqual([]);
});

test.afterEach(async ({ page }) => {
  expect(outboundByPage.get(page)).toEqual([]);
});

test("compacts the mobile toolbar into two rows while preserving desktop and custom dates", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const mode = toolbar.getByRole("combobox", { name: "Tipo de periodo" });
  const month = toolbar.getByLabel("Mes seleccionado");
  const perspective = toolbar.getByRole("group", { name: "Ámbito de las estadísticas" });
  const filter = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  const select = toolbar.getByRole("combobox", { name: "Granularidad de estadísticas y gráficas", includeHidden: true });
  const segmented = toolbar.getByRole("group", { name: "Granularidad de estadísticas y gráficas", includeHidden: true });
  await mode.selectOption("month");
  const mobile = page.viewportSize()!.width <= 672;
  const boxes = await Promise.all([toolbar, mode, month, perspective, filter].map((control) => control.boundingBox()));
  if (mobile) {
    await expect(select).toBeVisible();
    await expect(segmented).toBeHidden();
    const granularityBox = (await select.boundingBox())!;
    const [toolbarBox, modeBox, monthBox, perspectiveBox, filterBox] = boxes;
    expect(Math.abs(modeBox!.y - monthBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(granularityBox.y - perspectiveBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(filterBox!.y - perspectiveBox!.y)).toBeLessThanOrEqual(1);
    expect(granularityBox.y).toBeGreaterThan(modeBox!.y + modeBox!.height);
    expect(granularityBox.x + granularityBox.width).toBeLessThanOrEqual(perspectiveBox!.x);
    expect(perspectiveBox!.x + perspectiveBox!.width).toBeLessThanOrEqual(filterBox!.x);
    expect(filterBox!.y + filterBox!.height - toolbarBox!.y).toBeLessThan(130);
    for (const control of [mode, month, select, perspective]) {
      // oxlint-disable-next-line no-await-in-loop -- Inspect each rendered control independently.
      const dimensions = await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { label: element.getAttribute("aria-label") ?? "month value", left: box.left, right: box.right, width: element.clientWidth, content: element.scrollWidth };
      });
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(dimensions.content, dimensions.label).toBeLessThanOrEqual(dimensions.width + 1);
    }
    const targets = await toolbar.locator('label:has(input[type="radio"]):visible, select:visible, button:visible').evaluateAll((elements) =>
      elements.map((element) => ({ label: element.getAttribute("aria-label") ?? element.textContent, height: element.getBoundingClientRect().height })));
    expect(targets.every((target) => target.height >= 24), JSON.stringify(targets)).toBe(true);
    await select.focus();
    const outline = await select.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  } else {
    await expect(segmented).toBeVisible();
    await expect(select).toBeHidden();
  }
  await selectToolbarGranularity(toolbar, "year");
  await page.setViewportSize({ width: mobile ? 1280 : 390, height: 844 });
  const otherControl = toolbarGranularity(toolbar);
  if (mobile) await expect(otherControl.getByRole("radio", { checked: true })).toHaveValue("year");
  else await expect(otherControl).toHaveValue("year");
  await page.setViewportSize(testInfo.project.use.viewport!);
  await mode.selectOption("custom");
  await toolbar.getByLabel("Desde", { exact: true }).fill("2026-07-01");
  await toolbar.getByLabel("Hasta", { exact: true }).fill("2026-08-31");
  await expect(toolbar.getByLabel("Desde", { exact: true })).toHaveValue("2026-07-01");
  await expect(toolbar.getByLabel("Hasta", { exact: true })).toHaveValue("2026-08-31");
  await selectToolbarGranularity(toolbar, "week");
  await perspective.getByRole("radio", { name: "Yo" }).check();
  await expect(toolbar.getByRole("button", { name: "Quitar filtro Yo" })).toBeVisible();
  await toolbar.getByRole("button", { name: "Quitar filtro Yo" }).click();
  await expect(perspective.locator('input[value="realCashFlow"]')).toBeChecked();
  await filter.click();
  await expect(page.getByRole("dialog", { name: "Filtros del análisis" }).getByRole("group", { name: "Granularidad de estadísticas y gráficas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByText("Comparar periodos", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Comparación de periodos" })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("prioritizes selected period highlights while keeping warnings and full statistics keyboard-accessible", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  const disclosure = page.getByText("Comparar periodos", { exact: true });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  const comparison = page.getByRole("region", { name: "Comparación de periodos" });
  await comparison.getByRole("combobox", { name: "Comparar con" }).selectOption("previousPeriod");
  await comparison.screenshot({ path: `/tmp/a7h-after-${testInfo.project.name}.png`, animations: "disabled" });
  const highlights = comparison.getByRole("region", { name: "Indicadores destacados" });
  await expect(highlights.getByRole("heading")).toHaveCount(3);
  await expect(highlights.getByRole("heading", { name: "Ingreso neto seleccionado" })).toBeVisible();
  await expect(highlights.getByRole("heading", { name: "Gasto neto seleccionado" })).toBeVisible();
  await expect(highlights.getByRole("heading", { name: "Neto seleccionado", exact: true })).toBeVisible();
  await expect(comparison.getByRole("table")).not.toBeVisible();
  await highlights.screenshot({ path: `/tmp/a7h-highlights-${testInfo.project.name}.png`, animations: "disabled" });
  const allStatistics = comparison.getByText("Todas las estadísticas", { exact: true });
  await allStatistics.screenshot({ path: `/tmp/a7h-disclosure-after-${testInfo.project.name}.png`, animations: "disabled" });
  const affordance = await allStatistics.evaluate((summary) => {
    const style = getComputedStyle(summary);
    return { display: style.display, marker: style.listStyleType, height: summary.getBoundingClientRect().height };
  });
  expect(affordance.display).toBe("list-item");
  expect(affordance.marker).toBe("disclosure-closed");
  expect(affordance.height).toBeGreaterThanOrEqual(44);

  await comparison.getByRole("combobox", { name: "Comparar con" }).selectOption("custom");
  await comparison.getByLabel("Referencia desde").fill("2024-01-01");
  await comparison.getByLabel("Referencia hasta").fill("2024-01-31");
  const warning = comparison.getByText(/Los ceros no garantizan que el historial esté completo/);
  await expect(warning).toBeVisible();
  await expect(comparison.getByText(/No hay movimientos no anulados en la referencia/)).toBeVisible();
  expect(await warning.evaluate((element, next) => Boolean(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), await highlights.elementHandle())).toBe(true);
  await allStatistics.focus();
  await page.keyboard.press("Space");
  await expect(allStatistics.locator("..")).toHaveAttribute("open", "");
  expect(await allStatistics.evaluate((summary) => getComputedStyle(summary).listStyleType)).toBe("disclosure-open");
  await expect(comparison.getByRole("table")).toBeVisible();
  await expect(comparison.getByRole("row")).toHaveCount(18);
  await expectNoDocumentOverflow(page);
});

test("compares cumulative recorded activity on demand with inspectable endpoints and bounded long ranges", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await page.getByText("Comparar periodos", { exact: true }).click();
  const comparison = page.getByRole("region", { name: "Comparación de periodos" });
  await comparison.getByRole("combobox", { name: "Comparar con" }).selectOption("previousPeriod");
  const curveSummary = comparison.locator("summary").filter({ hasText: "Actividad registrada acumulada" });
  await expect(comparison.getByRole("img", { name: "Actividad registrada acumulada" })).toHaveCount(0);
  const affordance = await curveSummary.evaluate((summary) => ({
    height: summary.getBoundingClientRect().height,
    display: getComputedStyle(summary).display,
    marker: getComputedStyle(summary).listStyleType,
  }));
  expect(affordance).toMatchObject({ display: "list-item", marker: "disclosure-closed" });
  expect(affordance.height).toBeGreaterThanOrEqual(44);
  await curveSummary.focus();
  await page.keyboard.press("Enter");
  await expect(comparison.getByRole("img", { name: "Actividad registrada acumulada" })).toBeVisible();
  await expect(comparison.getByText(/no saldo disponible ni garantía de historial completo/)).toBeVisible();
  await curveSummary.locator("..").screenshot({ path: `/tmp/a7c-chart-${testInfo.project.name}.png`, animations: "disabled" });
  await comparison.getByText("Ver datos exactos", { exact: true }).click();
  const table = comparison.getByRole("table", { name: "Datos exactos de Actividad registrada acumulada" });
  const last = table.getByRole("row", { name: /Día 31/ });
  await expect(last).toBeVisible();
  const metric = comparison.getByRole("region", { name: "Indicadores destacados" }).getByRole("heading", { name: "Gasto neto seleccionado" }).locator("..");
  expect((await last.getByRole("cell").first().textContent())?.trim()).toBe((await metric.locator("dd").first().textContent())?.trim());
  await comparison.getByRole("combobox", { name: "Estadística de la curva" }).selectOption("net");
  await expect(comparison.getByRole("combobox", { name: "Estadística de la curva" })).toHaveValue("net");
  const netMetric = comparison.getByRole("region", { name: "Indicadores destacados" }).getByRole("heading", { name: "Neto seleccionado", exact: true }).locator("..");
  await comparison.getByText("Consultar un punto").click();
  await comparison.getByRole("combobox", { name: "Punto de Actividad registrada acumulada" }).selectOption("Día 31");
  await expect(last.getByRole("cell").first()).toHaveText((await netMetric.locator("dd").first().textContent())!.trim());
  await expect(comparison.getByRole("region", { name: "Valores de Actividad registrada acumulada" })).toContainText("31 ago 2026");
  await comparison.getByRole("combobox", { name: "Comparar con" }).selectOption("custom");
  await comparison.getByLabel("Referencia desde").fill("2024-01-01");
  await comparison.getByLabel("Referencia hasta").fill("2026-08-31");
  await expect(comparison.getByText(/hitos muestreados/)).toBeVisible();
  expect(await table.getByRole("row").count()).toBeLessThanOrEqual(121);
  await expectNoDocumentOverflow(page);
  const outerSummary = page.locator("summary").filter({ hasText: /^Comparar periodos/ });
  const outerDetails = outerSummary.locator("..");
  await outerSummary.focus();
  await page.keyboard.press("Space");
  await expect(outerDetails.locator('svg[role="img"]')).toHaveCount(0);
  await outerSummary.focus();
  await page.keyboard.press("Enter");
  await expect(comparison.getByRole("img", { name: "Actividad registrada acumulada" })).toBeVisible();
  await curveSummary.focus();
  await page.keyboard.press("Space");
  await expect(comparison.getByRole("img", { name: "Actividad registrada acumulada" })).toHaveCount(0);
});

test("wraps long filter category names without hiding selection or removal", async ({ page }) => {
  await page.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  const category = drawer.getByRole("button", { name: "Seleccionar Expense", exact: true });
  await category.click();
  const rootLabel = category;
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  const child = drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true });
  const removal = drawer.getByRole("button", { name: "Quitar Expense", exact: true });
  // Change only visible synthetic text: these assertions exercise CSS containment,
  // not category matching, which keeps the fixture's original accessible identity.
  const longLabel = "MantenimientoextraordinariodelhogarSharedHouseholdExpensesWithUniqueIdentifyingSuffix123456789";
  await rootLabel.locator("span").first().evaluate((span, text) => { span.textContent = text; }, longLabel);
  await child.locator("span").first().evaluate((span, text) => { span.textContent = text; }, longLabel);
  await removal.locator("span").first().evaluate((span, text) => { span.textContent = text; }, longLabel);
  for (const control of [rootLabel, child, removal]) {
    // oxlint-disable-next-line no-await-in-loop -- Each real control has its own text and bounds.
    await control.scrollIntoViewIfNeeded();
    // oxlint-disable-next-line no-await-in-loop -- Compare rendered glyphs, not just element widths.
    const clipped = await control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll("span")].some((span) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        return [...range.getClientRects()].some((text) => text.left < box.left - 1 || text.right > box.right + 1);
      }) || box.right > window.innerWidth;
    });
    expect(clipped).toBe(false);
  }
  await removal.focus();
  await page.keyboard.press("Space");
  await expect(removal).toHaveCount(0);
  await expect(category).toHaveAttribute("aria-pressed", "false");
});

test("preserves the component cascade across routes and drawer controls", async ({ page }, testInfo) => {
  const assertControl = async (control: Locator, fontRem: number, bordered = false) => {
    const appearance = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontRem: Number.parseFloat(style.fontSize) / Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        borderWidth: Number.parseFloat(style.borderTopWidth),
        borderStyle: style.borderTopStyle,
      };
    });
    expect.soft(appearance.fontRem, "component typography must override the font reset").toBeCloseTo(fontRem, 2);
    if (bordered) {
      expect.soft(appearance.borderWidth, "component boundaries must override the base border reset").toBeGreaterThanOrEqual(1);
      expect.soft(appearance.borderStyle).toBe("solid");
    }
  };
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const drawerButton = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  const period = toolbar.getByRole("combobox", { name: "Tipo de periodo" });
  const routes = [
    { path: "/cuentas", heading: "Cuentas" },
    { path: "/transacciones", heading: "Transacciones" },
    { path: "/resumen", heading: "Resumen general" },
  ];
  // oxlint-disable no-await-in-loop -- Visit lazy routes sequentially to detect cascade changes after navigation.
  for (const route of routes) {
    await page.locator(`a[href="${route.path}"]`).click();
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    await assertControl(drawerButton, 0.78, true);
    await assertControl(period, 0.68);
    const search = toolbar.getByRole("searchbox");
    if (await search.isVisible()) await assertControl(search, 0.82);
    await expectNoDocumentOverflow(page);
  }
  // oxlint-enable no-await-in-loop
  await page.screenshot({ path: testInfo.outputPath("cascade-overview.png"), animations: "disabled" });
  await period.selectOption("custom");
  await drawerButton.click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await expect(drawer).toBeVisible();
  await assertControl(drawer.getByRole("searchbox", { name: "Buscar en movimientos", exact: true }), 0.82);
  await assertControl(drawer.getByLabel("Desde", { exact: true }), 0.68, true);
  await assertControl(drawer.getByLabel("Hasta", { exact: true }), 0.68, true);
  await assertControl(drawer.getByRole("button", { name: "Ver resultados", exact: true }), 0.78, true);
  await drawer.screenshot({ path: testInfo.outputPath("cascade-drawer.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(drawerButton).toBeFocused();
});

test("keeps shared control geometry coherent without flattening semantic variants", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const period = toolbar.locator('[data-variant="compact"]');
  const sharedRadius = await period.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  const expectSharedRadius = async (control: Locator) => {
    expect.soft(await control.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(sharedRadius);
  };
  const expectCircle = async (control: Locator) => {
    const shape = await control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const radius = getComputedStyle(element).borderTopLeftRadius;
      const pixels = Number.parseFloat(radius) * (radius.endsWith("%") ? box.width / 100 : 1);
      return { radius: Math.min(pixels, box.width / 2, box.height / 2), width: box.width, height: box.height };
    });
    expect(shape.radius).toBeCloseTo(shape.width / 2, 0);
    expect(shape.width).toBeCloseTo(shape.height, 0);
  };
  const scope = toolbar.getByRole("group", { name: "Ámbito de las estadísticas" });
  const granularity = toolbarGranularity(toolbar);
  await expectSharedRadius(scope.locator(":scope > div"));
  await expectSharedRadius(page.viewportSize()!.width <= 672 ? granularity : granularity.locator(":scope > div"));
  const search = toolbar.getByRole("searchbox");
  if (await search.isVisible()) await expectSharedRadius(search.locator(".."));
  const drawerButton = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  if (page.viewportSize()!.width <= 672) await expectCircle(drawerButton);
  else await expectSharedRadius(drawerButton);
  await drawerButton.click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await expectSharedRadius(drawer.getByRole("button", { name: "Ver resultados", exact: true }));
  await expectCircle(drawer.getByRole("button", { name: "Cerrar filtros", exact: true }));
  const expandedModes = drawer.getByRole("group", { name: "Tipo de periodo" }).locator(":scope > div");
  await expectSharedRadius(expandedModes);
  const selectedInside = await expandedModes.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const radius = Math.min(Number.parseFloat(getComputedStyle(element).borderTopLeftRadius), box.width / 2, box.height / 2);
    const selected = element.querySelector("input:checked + span")!;
    const child = selected.getBoundingClientRect();
    const childRadius = Math.min(Number.parseFloat(getComputedStyle(selected).borderTopLeftRadius), child.width / 2, child.height / 2);
    const corners = [
      [child.left + childRadius, child.top + childRadius, Math.PI],
      [child.right - childRadius, child.top + childRadius, Math.PI * 1.5],
      [child.right - childRadius, child.bottom - childRadius, 0],
      [child.left + childRadius, child.bottom - childRadius, Math.PI / 2],
    ];
    return corners.every(([centerX, centerY, start]) => [0, Math.PI / 4, Math.PI / 2].every((angle) => {
      const x = centerX! + Math.cos(start! + angle) * childRadius;
      const y = centerY! + Math.sin(start! + angle) * childRadius;
      const outerX = Math.max(box.left + radius, Math.min(x, box.right - radius));
      const outerY = Math.max(box.top + radius, Math.min(y, box.bottom - radius));
      return Math.hypot(x - outerX, y - outerY) <= radius + 0.5;
    }));
  });
  expect.soft(selectedInside, "selected segments must remain inside the curved group when options wrap").toBe(true);
  const footerSurface = await drawer.locator("footer").evaluate((element) => ({
    footer: getComputedStyle(element).backgroundColor,
    sheet: getComputedStyle(element.parentElement!).backgroundColor,
  }));
  expect.soft(footerSurface.footer).toBe(footerSurface.sheet);
  const custom = expandedModes.locator('input[value="custom"]');
  await custom.focus();
  await page.keyboard.press("Space");
  await expect(custom).toBeChecked();
  const focus = await custom.evaluate((element) => {
    const style = getComputedStyle(element.nextElementSibling!);
    return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).toBe("solid");
  await drawer.screenshot({ path: testInfo.outputPath("shared-control-geometry.png"), animations: "disabled" });
  const drawerSearch = drawer.getByRole("searchbox", { name: "Buscar en movimientos", exact: true });
  await expectSharedRadius(drawerSearch.locator(".."));
  await drawerSearch.fill("Cash");
  const clear = drawer.getByRole("button", { name: "Limpiar búsqueda", exact: true });
  await expectCircle(clear);
  await clear.click();
  await expect(drawerSearch).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(drawerButton).toBeFocused();
  await expectNoDocumentOverflow(page);
});

// oxlint-disable no-await-in-loop -- Verify each responsive layout against the same locked state.
test("keeps the lock screen minimal and unlocks by keyboard after a generic failure", async ({ page }) => {
  await page.getByRole("button", { name: "Bloquear bóveda", exact: true }).click();
  const viewport = page.viewportSize()!;
  for (const width of viewport.width === 1280 ? [1280, 1024] : [viewport.width]) {
    await page.setViewportSize({ ...viewport, width });
    await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
    const input = page.getByLabel("Frase de desbloqueo");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("required");
    expect(await page.getByRole("main").innerText()).not.toMatch(/desarrollo local|cifrado autenticado|no se persiste|archivo financiero|Web Crypto|HTTPS|copias públicas|introduce la frase/iu);
    await expect(page.locator('main > section > div[aria-hidden="true"]')).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    if (width === 1280 || width === 320) {
      await mkdir("/tmp/minimal-lock-screen-visual", { recursive: true });
      await page.screenshot({ path: `/tmp/minimal-lock-screen-visual/locked-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
  const input = page.getByLabel("Frase de desbloqueo");
  await input.fill("incorrecta");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Mostrar frase", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(input).toHaveAttribute("type", "text");
  await page.keyboard.press("Tab");
  const remember = page.getByRole("checkbox", { name: "Recordar en este dispositivo" });
  await expect(remember).toBeFocused();
  await expect(remember).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Abrir bóveda", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("No se pudo abrir la bóveda.");
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expectNoDocumentOverflow(page);
  if (viewport.width === 1280 || viewport.width === 320) {
    await page.screenshot({ path: `/tmp/minimal-lock-screen-visual/error-${viewport.width}.png`, fullPage: true, animations: "disabled" });
  }
  await input.fill(PASSPHRASE);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
});

test("keeps expanded account actions readable at every viewport", async ({ page }, testInfo) => {
  await page.locator('a[href="/cuentas"]').click();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Cash", exact: true }) });
  await card.getByText("Detalles de Cash", { exact: true }).click();
  const viewport = page.viewportSize()!;
  for (const width of viewport.width === 1280 ? [1280, 1024] : [viewport.width]) {
    await page.setViewportSize({ ...viewport, width });
    const clipped = await card.getByRole("button").evaluateAll((buttons) => buttons.filter((button) => {
      const box = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      return [...range.getClientRects()].some((text) => text.left < box.left - 1 || text.right > box.right + 1);
    }).map((button) => button.textContent));
    expect.soft(clipped, `expanded account labels at ${width}px`).toEqual([]);
    const detailsWidth = await card.locator("details").evaluate((details) => ({
      actual: details.getBoundingClientRect().width,
      available: details.parentElement!.getBoundingClientRect().width,
    }));
    expect.soft(detailsWidth.actual).toBeCloseTo(detailsWidth.available, 0);
    await expectNoDocumentOverflow(page);
    await card.screenshot({ path: testInfo.outputPath(`${width}-expanded-account.png`), animations: "disabled" });
  }
});
// oxlint-enable no-await-in-loop

// oxlint-disable no-await-in-loop -- Resize and select each real control state in order.
test("keeps period selector labels inside rounded borders in every mode", async ({ page }) => {
  const viewport = page.viewportSize()!;
  const widths = viewport.width === 1280 ? [1280, 1024] : [viewport.width];
  const selector = page.getByRole("region", { name: "Filtros globales" }).locator('[data-variant="compact"]');
  for (const width of widths) {
    await page.setViewportSize({ ...viewport, width });
    for (const mode of ["all", "day", "week", "month", "year", "custom"]) {
      await selector.getByRole("combobox", { name: "Tipo de periodo" }).selectOption(mode);
      const outside = await selector.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const radius = Math.min(Number.parseFloat(getComputedStyle(element).borderTopLeftRadius), box.width / 2, box.height / 2);
        const contains = (x: number, y: number) => {
          if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
          const centerX = Math.max(box.left + radius, Math.min(x, box.right - radius));
          const centerY = Math.max(box.top + radius, Math.min(y, box.bottom - radius));
          return Math.hypot(x - centerX, y - centerY) <= radius + 0.5;
        };
        return [...element.querySelectorAll("label > span")].filter((label) => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return [...range.getClientRects()].some((text) =>
            !contains(text.left, text.top) || !contains(text.right, text.top) ||
            !contains(text.left, text.bottom) || !contains(text.right, text.bottom));
        }).map((label) => label.textContent);
      });
      expect.soft(outside, `${mode} labels at ${width}px must fit the curved border`).toEqual([]);
      await expectNoDocumentOverflow(page);
    }
  }
});

test("keeps period selector values readable and keyboard focus visible", async ({ page }, testInfo) => {
  const viewport = page.viewportSize()!;
  const widths = viewport.width === 1280 ? [1280, 1024] : [viewport.width];
  const selector = page.getByRole("region", { name: "Filtros globales" }).locator('[data-variant="compact"]');
  for (const width of widths) {
    await page.setViewportSize({ ...viewport, width });
    for (const mode of ["all", "day", "week", "month", "year", "custom"]) {
      const modeControl = selector.getByRole("combobox", { name: "Tipo de periodo" });
      await modeControl.selectOption(mode);
      const sizes = await selector.locator("input, select").evaluateAll((controls) => controls.map((control) => {
        const clone = control.cloneNode(true) as HTMLElement;
        // A closed native select only needs room for its selected label, not its longest option.
        if (control instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
          [...clone.options].forEach((option, index) => {
            if (index !== control.selectedIndex) option.remove();
          });
        }
        clone.removeAttribute("id");
        clone.setAttribute("aria-hidden", "true");
        clone.style.cssText = "position:absolute;visibility:hidden;width:max-content;min-width:0;max-width:none";
        control.parentElement!.append(clone);
        const intrinsic = clone.getBoundingClientRect().width;
        clone.remove();
        return { label: control.getAttribute("aria-label") ?? control.parentElement!.textContent, actual: control.getBoundingClientRect().width, intrinsic };
      }));
      for (const size of sizes) {
        expect.soft(size.actual, `${size.label} at ${width}px needs its native readable width`).toBeGreaterThanOrEqual(size.intrinsic - 1);
      }
      await modeControl.focus();
      await expect(modeControl).toBeFocused();
      const outline = await modeControl.evaluate((element) => {
        const style = getComputedStyle(element);
        return { visible: element.matches(":focus-visible"), width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
      });
      expect(outline).toMatchObject({ visible: true, style: "solid" });
      expect(outline.width).toBeGreaterThanOrEqual(2);
      if (mode === "custom") {
        await page.keyboard.press("Tab");
        await expect(selector.getByRole("button", { name: "Mes actual" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(selector.getByLabel("Desde")).toBeFocused();
        await selector.getByLabel("Desde").fill("2026-08-01");
        await selector.getByLabel("Hasta").fill("2026-08-22");
        await expect(selector.getByLabel("Desde")).toHaveValue("2026-08-01");
        await expect(selector.getByLabel("Hasta")).toHaveValue("2026-08-22");
        await selector.screenshot({ path: testInfo.outputPath(`${width}-custom-focused.png`) });
      }
      await expectNoDocumentOverflow(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await selector.screenshot({ path: testInfo.outputPath(`${width}-${mode}.png`) });
    }
    await page.screenshot({ path: testInfo.outputPath(`${width}-page.png`) });
  }
});
// oxlint-enable no-await-in-loop

// oxlint-disable no-await-in-loop -- Real chart holds, pan and pinch must run in input order.
test("keeps mobile chart inspection visible during a real touch hold without selecting plot text", async ({ page, browserName }) => {
  test.skip(page.viewportSize()!.width > 390 || browserName !== "chromium", "Mobile Chromium touch coverage");
  await page.locator('a[href="/flujo-de-caja"]').click();
  await page.getByText("Composición del flujo", { exact: true }).click();
  const client = await page.context().newCDPSession(page);
  const charts = [
    { title: "Flujo neto por periodo", target: "circle" },
    { title: "Tensión entre entradas y salidas", target: "rect[class*='bar']" },
    { title: "Presión por categoría", target: "rect[class*='bar']" },
  ];
  const chartStyles: { title: string; userSelect: string; webkitUserSelect: string; touchAction: string }[] = [];

  for (const { title, target } of charts) {
    const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    const svg = figure.locator("svg");
    const point = svg.locator(target).first();
    await point.scrollIntoViewIfNeeded();
    const box = await point.boundingBox();
    expect(box, `${title} needs a visible touch target`).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const value = await point.evaluate((element) =>
      (element.querySelector("title") ?? element.parentElement?.querySelector("title"))?.textContent?.split(":").at(-1)?.trim(),
    );
    expect(value, `${title} needs an exact native data label`).toBeTruthy();
    const selection = await svg.evaluate((element) => {
      const style = getComputedStyle(element);
      return { userSelect: style.userSelect, webkitUserSelect: style.webkitUserSelect, touchAction: style.touchAction };
    });
    chartStyles.push({ title, ...selection });
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    try {
      await expect(figure.getByRole("tooltip")).toBeVisible();
      await expect(figure.getByRole("tooltip")).toContainText(value!);
      await page.waitForTimeout(850);
      await expect(figure.getByRole("tooltip")).toBeVisible();
      await expect(figure.getByRole("tooltip")).toContainText(value!);
      expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
    } finally {
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  }
  for (const { title, ...selection } of chartStyles) {
    expect(selection, `${title} must suppress selection only on its SVG`).toMatchObject({
      userSelect: "none", webkitUserSelect: "none", touchAction: "auto",
    });
  }
  const outside = page.getByRole("heading", { name: "Flujo de caja", exact: true });
  expect(await outside.evaluate((element) => getComputedStyle(element).userSelect)).not.toBe("none");
  await outside.scrollIntoViewIfNeeded();
  const outsideBox = await outside.boundingBox();
  expect(outsideBox).not.toBeNull();
  await page.mouse.move(outsideBox!.x + 4, outsideBox!.y + outsideBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(outsideBox!.x + outsideBox!.width - 4, outsideBox!.y + outsideBox!.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString().trim() ?? "")).not.toBe("");

  const panChart = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Flujo neto por periodo" }) });
  const panSvg = panChart.locator("svg");
  await panSvg.scrollIntoViewIfNeeded();
  const panBox = await panSvg.boundingBox();
  expect(panBox).not.toBeNull();
  const beforePan = await page.evaluate(() => window.scrollY);
  expect(beforePan).toBeGreaterThan(0);
  const panX = panBox!.x + panBox!.width / 2;
  const panY = panBox!.y + panBox!.height / 2;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: panX, y: panY }] });
  try {
    for (const delta of [25, 50, 75, 100, 125]) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: panX, y: panY + delta }] });
      await page.waitForTimeout(16);
    }
  } finally {
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforePan);
  await expect(panChart.getByRole("tooltip")).toHaveCount(0);

  await panSvg.scrollIntoViewIfNeeded();
  const pinchBox = await panSvg.boundingBox();
  expect(pinchBox).not.toBeNull();
  const pinchX = pinchBox!.x + pinchBox!.width / 2;
  const pinchY = pinchBox!.y + pinchBox!.height / 2;
  const beforePinch = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
    { x: pinchX - 20, y: pinchY }, { x: pinchX + 20, y: pinchY },
  ] });
  try {
    for (const distance of [40, 60, 80, 100]) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
        { x: pinchX - distance, y: pinchY }, { x: pinchX + distance, y: pinchY },
      ] });
      await page.waitForTimeout(16);
    }
  } finally {
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBeGreaterThan(beforePinch);
});
// oxlint-enable no-await-in-loop

test("preserves desktop chart hover and keyboard dismissal", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1000, "Desktop pointer regression");
  await page.locator('a[href="/flujo-de-caja"]').click();
  const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: "Flujo neto por periodo" }) });
  await figure.locator("circle").last().hover();
  const tooltip = figure.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await figure.getByText("Consultar un punto").click();
  await expect(figure.getByRole("combobox", { name: "Punto de Flujo neto por periodo" })).toBeVisible();
});

test("keeps overview balances scoped visibly and method information secondary", async ({ page }, testInfo) => {
  await page.locator('a[href="/resumen"]').click();
  const summary = page.locator("summary").filter({ hasText: "Información del resumen" });
  const information = summary.locator("..");
  const measurements: Array<{ scope: string; kpiTop: number; chartTop: number; informationTop: number }> = [];
  const checkScope = async (scope: string) => {
    await page.getByRole("region", { name: "Filtros globales" })
      .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${scope}"]`).check();
    await expect(page.getByText(/El flujo usa los apuntes filtrados; los saldos de apertura, cierre y deuda/)).toBeVisible();
    await expect(information).not.toHaveAttribute("open");
    const boxes = await Promise.all([
      page.getByRole("article", { name: "Flujo del periodo" }).boundingBox(),
      page.getByRole("heading", { name: "Pulso financiero" }).boundingBox(), summary.boundingBox(),
    ]);
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
    return { scope, kpiTop: boxes[0]!.y, chartTop: boxes[1]!.y, informationTop: boxes[2]!.y };
  };
  for (const scope of ["realCashFlow", "all", "debtsOnly"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each perspective is measured after its own render.
    measurements.push(await checkScope(scope));
  }
  await writeFile(testInfo.outputPath("overview-hierarchy.json"), JSON.stringify(measurements, null, 2));
  await page.getByRole("region", { name: "Filtros globales" })
    .getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="realCashFlow"]').check();
  await page.getByRole("main").screenshot({ path: testInfo.outputPath("overview-clarity.png"), animations: "disabled" });
  await summary.press("Enter");
  await expect(information).toHaveAttribute("open");
  await expect(information.getByText(/Gasto neto = bruto/)).toBeVisible();
  await expect(summary).toBeFocused();
  await summary.press("Space");
  await expect(information).not.toHaveAttribute("open");
  await page.getByText("Saldos y deuda", { exact: true }).click();
  await expect(information).not.toHaveAttribute("open");
  await expectNoDocumentOverflow(page);
});

test("keeps cash-flow scope and available-cash warning ahead of methods", async ({ page }, testInfo) => {
  await page.locator('a[href="/flujo-de-caja"]').click();
  const summary = page.locator("summary").filter({ hasText: "Información del flujo de caja" });
  const information = summary.locator("..");
  const measurements: Array<{ scope: string; kpiTop: number; chartTop: number; informationTop: number }> = [];
  const checkScope = async (scope: string) => {
    await page.getByRole("region", { name: "Filtros globales" })
      .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${scope}"]`).check();
    await expect(page.getByText(/El flujo real usa cuentas sin deuda e incluye pagos transferidos hacia cuentas de deuda/)).toBeVisible();
    await expect(page.getByText(/se compensan en el neto cuando ambos extremos/)).toBeVisible();
    await expect(page.getByText(/no equivale al efectivo disponible/)).toBeVisible();
    await expect(information).not.toHaveAttribute("open");
    const boxes = await Promise.all([
      page.getByRole("article", { name: "Flujo real" }).boundingBox(),
      page.getByRole("heading", { name: "Flujo neto por periodo" }).boundingBox(), summary.boundingBox(),
    ]);
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
    return { scope, kpiTop: boxes[0]!.y, chartTop: boxes[1]!.y, informationTop: boxes[2]!.y };
  };
  for (const scope of ["realCashFlow", "all", "debtsOnly"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each perspective is measured after its own render.
    measurements.push(await checkScope(scope));
  }
  await writeFile(testInfo.outputPath("cash-flow-hierarchy.json"), JSON.stringify(measurements, null, 2));
  await page.getByRole("region", { name: "Filtros globales" })
    .getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="realCashFlow"]').check();
  await page.getByRole("main").screenshot({ path: testInfo.outputPath("cash-flow-clarity.png"), animations: "disabled" });
  await summary.press("Enter");
  await expect(information).toHaveAttribute("open");
  await expect(information.getByText(/Ingresos y gastos brutos conservan sus importes/)).toBeVisible();
  await expect(summary).toBeFocused();
  await summary.press("Space");
  await expect(information).not.toHaveAttribute("open");
  await page.getByText("Composición del flujo", { exact: true }).click();
  await expect(information).not.toHaveAttribute("open");
  await expectNoDocumentOverflow(page);
});

test("reveals perspective-specific completed-month trends on demand", async ({ page }, testInfo) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u7-budget-history.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await page.locator('a[href="/flujo-de-caja"]').click();
  const summary = page.getByText("Tendencia mensual", { exact: true });
  const disclosure = summary.locator("xpath=..");
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(page.getByRole("heading", { name: "Tasa mensual de retención de efectivo" })).toHaveCount(0);
  const affordance = await summary.evaluate((element) => ({
    display: getComputedStyle(element).display,
    height: element.getBoundingClientRect().height,
  }));
  expect(affordance.display).toBe("list-item");
  expect(affordance.height).toBeGreaterThanOrEqual(44);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosure.getByRole("heading", { name: "Tasa mensual de retención de efectivo" })).toBeVisible();
  const realTable = disclosure.getByRole("table", { name: "Detalle mensual de retención de efectivo" });
  await expect(realTable.locator("tbody tr")).toHaveCount(4);
  await expect(realTable.getByRole("columnheader", { name: "Entradas reales (base)" })).toBeVisible();
  await expect(realTable.getByRole("row", { name: /may 26/ })).toContainText(/1000,00\s*€.*990,00\s*€.*\+99\s*%/);
  await disclosure.screenshot({ path: `/tmp/a9r-real-${testInfo.project.name}.png`, animations: "disabled" });
  const scope = page.getByRole("region", { name: "Filtros globales" })
    .getByRole("group", { name: "Ámbito de las estadísticas" });
  await scope.locator('input[value="all"]').check();
  await expect(disclosure.getByRole("heading", { name: "Tasa mensual de ahorro contable" })).toBeVisible();
  const table = disclosure.getByRole("table", { name: "Detalle mensual del ahorro contable" });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /may 26/ })).toContainText(/1000,00\s*€.*-10,00\s*€.*990,00\s*€.*\+99\s*%/);
  await disclosure.screenshot({ path: `/tmp/a9r-yo-${testInfo.project.name}.png`, animations: "disabled" });
  await scope.locator('input[value="debtsOnly"]').check();
  await expect(disclosure.getByRole("heading", { name: "Variación mensual de deudas" })).toBeVisible();
  const debtTable = disclosure.getByRole("table", { name: "Detalle mensual de variación de deudas" });
  await expect(debtTable.locator("tbody tr")).toHaveCount(4);
  await expect(debtTable.getByRole("columnheader", { name: "Variación contable" })).toBeVisible();
  await expect(debtTable.getByRole("columnheader")).toHaveCount(2);
  await expect(debtTable.getByRole("row", { name: /ago 26/ })).toContainText(/0,50\s*€/);
  await expect(disclosure.getByText(/Los saldos contables no implican importes recuperables/)).toBeVisible();
  await disclosure.screenshot({ path: `/tmp/a9r-debt-${testInfo.project.name}.png`, animations: "disabled" });
  await scope.locator('input[value="all"]').check();
  await expect(table.locator("tbody tr")).toHaveCount(4);
  if (page.viewportSize()!.width <= 390) {
    const scrollRegion = table.locator("xpath=..");
    await scrollRegion.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scrollRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scrollRegion.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await table.evaluate((element) => { element.scrollIntoView({ block: "start", inline: "nearest" }); });
    const rateHeader = table.getByRole("columnheader", { name: "Tasa" });
    const horizontalGeometry = await rateHeader.evaluate((element) => {
      const header = element.getBoundingClientRect();
      const region = element.closest("section")!.getBoundingClientRect();
      return { headerLeft: header.left, headerRight: header.right, regionLeft: region.left, regionRight: region.right };
    });
    expect(horizontalGeometry.headerLeft).toBeGreaterThanOrEqual(horizontalGeometry.regionLeft - 1);
    expect(horizontalGeometry.headerRight).toBeLessThanOrEqual(horizontalGeometry.regionRight + 1);
    await page.evaluate(() => window.scrollBy(0, -250));
    await page.screenshot({ path: `/tmp/a9r-savings-mobile-right-page.png`, animations: "disabled" });
  }
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await toolbar.getByLabel("Mes seleccionado").fill("2026-09");
  await expect(disclosure.getByText(/No hay meses calendario completos/)).toBeVisible();
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(disclosure.getByRole("heading", { name: "Tasa mensual de ahorro contable" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test("keeps comparison reconciliation and hierarchy caveats before methods", async ({ page }, testInfo) => {
  await page.locator('a[href="/comparativa"]').click();
  const summary = page.locator("summary").filter({ hasText: "Información de la comparativa" });
  const information = summary.locator("..");
  const comparison = page.getByRole("region", { name: "Resumen de perspectivas" });
  const categories = page.getByRole("region", { name: "Categorías por perspectiva" });
  const measurements: Array<{ scope: string; summaryTop: number; categoriesTop: number; informationTop: number }> = [];
  const checkScope = async (scope: string) => {
    await page.getByRole("region", { name: "Filtros globales" })
      .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${scope}"]`).check();
    await expect(page.getByText(/Son movimientos del mismo periodo, no saldos/)).toBeVisible();
    await expect(comparison.getByText(/Yo \+ Ajuste por deudas = Flujo real/)).toBeVisible();
    await expect(comparison.getByText(/no es un saldo ni necesariamente dinero gastado/)).toBeVisible();
    await expect(categories.getByText(/Los hijos detallan el total del padre/)).toBeVisible();
    await expect(information).not.toHaveAttribute("open");
    expect(await comparison.locator("data").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("value"))))
      .toEqual(["4.52", "-0.5", "4.02"]);
    const boxes = await Promise.all([comparison.boundingBox(), categories.boundingBox(), summary.boundingBox()]);
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
    return { scope, summaryTop: boxes[0]!.y, categoriesTop: boxes[1]!.y, informationTop: boxes[2]!.y };
  };
  for (const scope of ["realCashFlow", "all", "debtsOnly"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each perspective is measured after its own render.
    measurements.push(await checkScope(scope));
  }
  await writeFile(testInfo.outputPath("comparison-hierarchy.json"), JSON.stringify(measurements, null, 2));
  await page.getByRole("region", { name: "Filtros globales" })
    .getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="realCashFlow"]').check();
  await page.getByRole("main").screenshot({ path: testInfo.outputPath("comparison-clarity.png"), animations: "disabled" });
  await summary.press("Enter");
  await expect(information).toHaveAttribute("open");
  await expect(information.getByText(/Los tipos de ingreso, gasto y transferencia no se reclasifican/)).toBeVisible();
  await expect(summary).toBeFocused();
  await summary.press("Space");
  await expect(information).not.toHaveAttribute("open");
  await categories.getByRole("button", { name: "Contraer Expense" }).click();
  await expect(information).not.toHaveAttribute("open");
  await expectNoDocumentOverflow(page);
});

test("keeps summary and cash-flow detail reachable without obscuring primary figures", async ({ page }) => {
  const summary = page.getByText("Saldos y deuda", { exact: true });
  await expect(page.getByText("Flujo del periodo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pulso financiero" })).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(summary.locator("xpath=..")).not.toHaveAttribute("open");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("xpath=..")).toHaveAttribute("open", "");
  await expect(page.getByText("Saldo en deudas", { exact: true })).toBeVisible();
  await expect(page.getByText("Anulados visibles", { exact: true })).toHaveCount(0);
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
  expect(await perspectives.getByRole("heading").allTextContents()).toEqual(["Yo", "Ajuste por deudas", "Flujo real"]);
  await expect(perspectives.nth(0).locator("data")).toHaveAttribute("value", "4.52");
  await expect(perspectives.nth(1).locator("data")).toHaveAttribute("value", "-0.5");
  await expect(perspectives.nth(2).locator("data")).toHaveAttribute("value", "4.02");
  await expect(comparisonSummary.getByText("Yo + Ajuste por deudas = Flujo real, con los mismos filtros.", { exact: true })).toBeVisible();
  await expect(perspectives.nth(1).getByText(/no es un saldo ni necesariamente dinero gastado/)).toBeVisible();
  await expect(categories.getByRole("button", { name: "Contraer Expense" })).toBeVisible();
  await expect(categories.getByText("Expense › Food", { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("reconciles every comparison metric and category depth under date filters", async ({ page }) => {
  await page.getByRole("link", { name: "Comparativa", exact: true }).click();
  const table = page.getByRole("table", { name: "Comparación de movimientos por perspectiva" });
  const categories = page.getByRole("region", { name: "Categorías por perspectiva" });
  const metric = categories.getByRole("combobox", { name: /^Métrica de categorías/ });
  const labels = ["Yo", "Ajuste por deudas", "Flujo real"];
  const cents = (text: string) => Math.round(Number(text.replace(/[^\d,-]/g, "").replace(",", ".")) * 100);
  const assertAdditive = (values: string[]) => {
    expect(values).toHaveLength(3);
    const amounts = values.map(cents);
    expect(amounts[0]! + amounts[1]!).toBe(amounts[2]);
  };
  // oxlint-disable no-await-in-loop -- Each filter and metric changes the rendered comparison.
  for (const month of [null, "2026-07"]) {
    if (month !== null) {
      const toolbar = page.getByRole("region", { name: "Filtros globales" });
      await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
      await toolbar.getByLabel("Mes seleccionado").fill(month);
    }
    await expect(table.getByRole("columnheader")).toHaveText(["Concepto", ...labels]);
    await expect.poll(async () => (await table.getByRole("row", { name: /^Movimiento neto / }).getByRole("cell").allTextContents()).map(cents))
      .toEqual(month === null ? [452, -50, 402] : [-10, 0, -10]);
    for (const concept of ["Movimiento neto", "Ingresos", "Gastos", "Transferencias"]) {
      assertAdditive(await table.getByRole("row", { name: new RegExp(`^${concept} `) }).getByRole("cell").allTextContents());
    }
    for (const value of ["netEurMinor", "incomesEurMinor", "expensesEurMinor", "transfersEurMinor"]) {
      await metric.selectOption(value);
      const rows = await categories.locator("dl").evaluateAll((elements) => elements.map((element) => ({
        labels: [...element.querySelectorAll("dt")].map((label) => label.textContent!.trim()),
        values: [...element.querySelectorAll("dd")].map((amount) => amount.textContent!.trim()),
      })));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.labels).toEqual(labels);
        assertAdditive(row.values);
      }
    }
    await expectNoDocumentOverflow(page);
  }
  // oxlint-enable no-await-in-loop
});

test("keeps signed expense selector labels readable without changing financial values", async ({ page }, testInfo) => {
  // oxlint-disable no-await-in-loop -- The same signed metric must be clear on both routes.
  for (const name of ["Categorías", "Cuentas"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const metric = page.getByRole("combobox", { name: name === "Categorías" ? /^Métrica de categorías/ : /^Métrica de cuentas/ });
    const amounts = await page.locator("main data").evaluateAll((elements) => elements.map((element) => element.getAttribute("value")));
    await metric.selectOption("expensesEurMinor");
    await expect(metric.locator("option:checked")).toHaveText("Movimiento contable de gastos");
    expect(await page.locator("main data").evaluateAll((elements) => elements.map((element) => element.getAttribute("value")))).toEqual(amounts);
    await metric.scrollIntoViewIfNeeded();
    const layout = await metric.evaluate((element) => {
      const select = element as HTMLSelectElement;
      const style = getComputedStyle(select);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      return {
        textWidth: context.measureText(select.selectedOptions[0]!.textContent!).width,
        availableWidth: select.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) - 16,
      };
    });
    expect(layout.textWidth, `${name} selected label must fit beside its native arrow`).toBeLessThanOrEqual(layout.availableWidth);
    await expectNoDocumentOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`signed-expense-${name}.png`), animations: "disabled" });
  }
  // oxlint-enable no-await-in-loop
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
  await expect(toolbarGranularity(toolbar)).toBeVisible();
  const toolbarSearch = toolbar.getByRole("searchbox", { name: "Buscar en todos los movimientos" });
  if (page.viewportSize()!.width <= 832) await expect(toolbarSearch).toBeHidden();
  else await expect(toolbarSearch).toBeVisible();

  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await expect(drawer.getByRole("group", { name: "Estado", exact: true })).toHaveCount(0);
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
  const preferences = await page.evaluate(() => localStorage.getItem("myexpenses-analysis:filters:v1"));
  expect(preferences).toContain("Synthetic food");
  expect(preferences).toContain("ABC");
  expect(preferences).not.toMatch(/synthetic-browser-only-passphrase|"postings"|"analytics"/u);
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
  expect(await page.evaluate(() => localStorage.getItem("myexpenses-analysis:filters:v1"))).toContain("Synthetic food");
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

for (const scopeValue of ["realCashFlow", "all", "debtsOnly"] as const) {
  test(`settles every primary route with ${scopeValue} global scope`, async ({ page }) => {
    test.setTimeout(90_000);
    const toolbar = page.getByRole("region", { name: "Filtros globales" });
    const scope = toolbar.getByRole("group", { name: "Ámbito de las estadísticas" })
      .locator(`input[value="${scopeValue}"]`);
    const period = toolbar.getByRole("combobox", { name: "Tipo de periodo" });
    const granularity = toolbarGranularity(toolbar);
    const navigation = page.getByRole("navigation", { name: "Secciones principales" });
    const routes = [
      "/resumen", "/flujo-de-caja", "/comparativa", "/deudas", "/presupuestos",
      "/categorias", "/cuentas", "/patrones", "/transacciones",
    ];
    await scope.check();
    // oxlint-disable no-await-in-loop -- Each scope/route state must settle before the next navigation.
    for (const route of routes) {
      await test.step(`${scopeValue} ${route}`, async () => {
        const link = navigation.locator(`a[href="${route}"]`);
        await link.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(route);
        await expect(link).toHaveAttribute("aria-current", "page");
        const heading = page.locator("main h1");
        await expect(heading).toBeVisible();
        expect((await heading.textContent())?.trim()).toBeTruthy();
        await expect(scope).toBeChecked();
        await expect(period).toBeVisible();
        await expect(period).toHaveValue("all");
        await expect(granularity).toBeVisible();
        if (page.viewportSize()!.width <= 672) await expect(granularity).toHaveValue("auto");
        else await expect(granularity.getByRole("radio", { checked: true })).toHaveCount(1);
        await period.focus();
        await expect(period).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.locator(":focus")).toHaveCount(1);
        await expectNoDocumentOverflow(page);
      });
    }
    // oxlint-enable no-await-in-loop
  });
}

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
    await expect(toolbarGranularity(toolbar)).toBeVisible();
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
  const details = page.getByText("Saldos y deuda", { exact: true });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main").getByText(/Sin conciliar|Reconciliados|Compensados/)).toHaveCount(0);
  await details.scrollIntoViewIfNeeded();
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

test("keeps VOID out of scoped transaction counts, rows and CSV without transaction-state columns", async ({ page }) => {
  await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const scope = toolbar.getByRole("group", { name: "Ámbito de las estadísticas" });
  const table = page.getByRole("table", { name: "Transacciones que coinciden con los filtros globales" });
  const results = page.getByRole("region", { name: "Movimientos filtrados" });

  for (const { value, count } of [
    { value: "realCashFlow", count: 12 },
    { value: "all", count: 13 },
    { value: "debtsOnly", count: 1 },
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- Each scope must be observed before selecting the next.
    await scope.locator(`input[type="radio"][value="${value}"]`).check();
    // oxlint-disable-next-line no-await-in-loop -- Wait for the rendered scope, not a guessed store delay.
    await expect(results).toContainText(`${count} ${count === 1 ? "resultado" : "resultados"}`);
    // oxlint-disable-next-line no-await-in-loop -- The active row count is part of each scope's contract.
    await expect(table.locator("tbody tr")).toHaveCount(count);
    // oxlint-disable-next-line no-await-in-loop -- The obsolete column must stay absent across scope changes.
    await expect(table.getByRole("columnheader", { name: "Estado" })).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    // oxlint-disable-next-line no-await-in-loop -- Download uses the currently rendered scope.
    await results.getByRole("button", { name: "Exportar CSV" }).click();
    // oxlint-disable-next-line no-await-in-loop -- Await the matching download event before changing scope.
    const download = await downloadPromise;
    // oxlint-disable-next-line no-await-in-loop -- The isolated browser runner owns this temporary artifact.
    const csv = await readFile(await download.path(), "utf8");
    const headers = csv.split(/\r?\n/u)[0]!.split(",");
    expect(headers).not.toContain("estado");
    expect(headers).not.toContain("estado_myexpenses");
    expect(csv).not.toMatch(/(?:^|,)(?:UNRECONCILED|CLEARED|RECONCILED)(?:,|$)/mu);
    expect(csv.split(/\r?\n/u)).toHaveLength(count + 1);
    expect(csv).not.toMatch(/(?:^|,)VOID(?:,|$)/mu);
  }
});

test("reveals complete transaction text without transaction states by keyboard at every viewport", async ({ page }, testInfo) => {
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
  await expect(page.getByText(/Estado de todos los resultados:/)).toHaveCount(0);
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
  await expect(row.getByText(/Estado MyExpenses|UNRECONCILED|CLEARED|RECONCILED/)).toHaveCount(0);
  const textLayout = await row.getByText("Comentario del apunte").locator("..").locator("dd").evaluate((element) => ({
    visible: element.getBoundingClientRect().height > 0,
    scroll: element.scrollWidth,
    width: element.clientWidth,
  }));
  expect(textLayout.visible).toBe(true);
  expect(textLayout.scroll, JSON.stringify(textLayout)).toBeLessThanOrEqual(textLayout.width + 1);
  await row.screenshot({ path: testInfo.outputPath("transaction-details-no-state.png"), animations: "disabled", style: '[aria-label="Filtros globales"] { visibility: hidden; }' });
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
  await expect(table.getByRole("columnheader", { name: "Estado" })).toHaveCount(0);
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
  await selectToolbarGranularity(toolbar, "month");
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

test("shows category expense composition on demand without changing tree filters or overflow", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: "Categorías" }).click();
  const tree = page.getByRole("region", { name: "Explorador jerárquico" });
  const rootRow = tree.getByRole("button", { name: "Filtrar: Expense", exact: true }).locator("xpath=..");
  const rootDetail = rootRow.locator("details");
  const summary = rootDetail.locator("summary");
  await expect(summary).toHaveText("Desglose del gasto");
  await expect(rootDetail).not.toHaveAttribute("open");
  const affordance = await summary.evaluate((element) => ({
    display: getComputedStyle(element).display,
    height: element.getBoundingClientRect().height,
  }));
  expect(affordance.display).toBe("list-item");
  expect(affordance.height).toBeGreaterThanOrEqual(44);
  const balance = await rootRow.locator("span[class*='amount'] > span").first().textContent();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(rootDetail).toHaveAttribute("open", "");
  await Promise.all(["Gasto bruto", "Devoluciones", "Gasto neto seleccionado"]
    .map((label) => expect(rootDetail.getByText(label, { exact: true })).toBeVisible()));
  await expect(rootDetail.locator("dl > div").nth(0)).toContainText("1,35");
  await expect(rootDetail.locator("dl > div").nth(1)).toContainText("2,20");
  await expect(rootDetail.locator("dl > div").nth(2)).toContainText("-0,85");
  await rootRow.screenshot({ path: `/tmp/a8-category-detail-${testInfo.project.name}.png`, animations: "disabled" });
  await expect(rootRow.locator("span[class*='amount'] > span").first()).toHaveText(balance!);
  const childRow = tree.getByRole("button", { name: "Filtrar: Expense › Food" }).locator("xpath=..");
  const childDetail = childRow.locator("details");
  await expect(childDetail).not.toHaveAttribute("open");
  await childDetail.locator("summary").click();
  await expect(childDetail).toHaveAttribute("open", "");
  await tree.getByRole("button", { name: "Contraer Expense" }).click();
  await expect(rootDetail).toHaveAttribute("open", "");
  await expect(childRow).toHaveCount(0);
  await tree.getByRole("button", { name: "Desplegar Expense" }).click();
  await expect(tree.getByRole("button", { name: "Filtrar: Expense › Food" })).toBeVisible();
  await tree.getByRole("button", { name: "Filtrar: Expense", exact: true }).click();
  await expect(tree.getByRole("button", { name: "Quitar filtro: Expense", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectNoDocumentOverflow(page);
});

test("keeps category amounts inside their rows and panel at intermediate widths", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: "Categorías" }).click();
  const tree = page.getByRole("region", { name: "Explorador jerárquico" });
  const widths = testInfo.project.name === "desktop" ? [900, 768, 1024, 1280] : [page.viewportSize()!.width];
  const measurements = [];

  /* oxlint-disable no-await-in-loop -- Layout and perspective checks must observe each sequential browser state. */
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    for (const scope of ["realCashFlow", "all", "debtsOnly"]) {
      await page.getByRole("region", { name: "Filtros globales" })
        .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${scope}"]`).check();
      const geometry = await tree.evaluate((element) => {
        const panel = element.closest("section")!.getBoundingClientRect();
        const rows = [...element.querySelectorAll("li > div")].flatMap((row) => {
          const selection = row.querySelector<HTMLButtonElement>('button[aria-label^="Filtrar:"]');
          if (selection === null) return [];
          const amount = row.lastElementChild!;
          const disclosure = row.querySelector<HTMLButtonElement>("button[aria-expanded]");
          const rect = row.getBoundingClientRect();
          const value = amount.firstElementChild!.getBoundingClientRect();
          const average = amount.lastElementChild!.getBoundingClientRect();
          return [{
            name: selection.getAttribute("aria-label"),
            row: { left: rect.left, right: rect.right, client: row.clientWidth, scroll: row.scrollWidth },
            amount: { left: amount.getBoundingClientRect().left, right: amount.getBoundingClientRect().right, client: amount.clientWidth, scroll: amount.scrollWidth },
            value: { left: value.left, right: value.right, client: amount.firstElementChild!.clientWidth, scroll: amount.firstElementChild!.scrollWidth },
            valueText: amount.firstElementChild!.textContent?.replaceAll("\u00a0", " ").trim(),
            average: { left: average.left, right: average.right, client: amount.lastElementChild!.clientWidth, scroll: amount.lastElementChild!.scrollWidth },
            selectionHeight: selection.getBoundingClientRect().height,
            disclosureHeight: disclosure?.getBoundingClientRect().height ?? null,
          }];
        });
        return { panel: { left: panel.left, right: panel.right }, rows };
      });
      expect(geometry.rows.length).toBeGreaterThanOrEqual(1);
      if (scope === "realCashFlow") expect(geometry.rows.some(({ name }) => name?.includes("Expense › Food"))).toBe(true);
      if (width === 900 && scope === "realCashFlow") {
        expect(geometry.rows.find(({ name }) => name === "Filtrar: Expense")?.valueText).toBe("0,85 €");
        expect(geometry.rows.find(({ name }) => name === "Filtrar: Expense › Food")?.valueText).toBe("-0,25 €");
      }
      for (const row of geometry.rows) {
        expect(row.row.scroll, `${width}/${scope}/${row.name} row`).toBeLessThanOrEqual(row.row.client);
        expect(row.selectionHeight, `${width}/${scope}/${row.name} selection`).toBeGreaterThanOrEqual(44);
        if (row.disclosureHeight !== null) expect(row.disclosureHeight, `${width}/${scope}/${row.name} disclosure`).toBeGreaterThanOrEqual(44);
        for (const part of [row.amount, row.value, row.average]) {
          expect(part.left, `${width}/${scope}/${row.name} left`).toBeGreaterThanOrEqual(row.row.left);
          expect(part.right, `${width}/${scope}/${row.name} right`).toBeLessThanOrEqual(row.row.right);
          expect(part.right, `${width}/${scope}/${row.name} panel`).toBeLessThanOrEqual(geometry.panel.right);
          expect(part.scroll, `${width}/${scope}/${row.name} text`).toBeLessThanOrEqual(part.client);
        }
      }
      measurements.push({ width, scope, ...geometry });
      if (scope === "realCashFlow") {
        await tree.screenshot({ path: testInfo.outputPath(`categories-${width}-contained.png`), animations: "disabled" });
      }
    }
  }
  /* oxlint-enable no-await-in-loop */

  await writeFile(testInfo.outputPath("category-row-containment.json"), JSON.stringify(measurements, null, 2));
  await expectNoDocumentOverflow(page);
});

test("keeps budget decisions ahead of closed method information across perspectives", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  const controls = page.getByRole("group", { name: "Marco del presupuesto" });
  await controls.getByLabel("Periodo").selectOption("MONTH:2026:7");
  const tree = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
  const infoSummary = page.locator("summary").filter({ hasText: "Información del presupuesto" });
  const info = infoSummary.locator("..");
  const reference = page.locator("summary").filter({ hasText: /^(Referencias ·|Sin referencias$)/ });
  const measurements: Array<{ scope: string; kpiTop: number; treeTop: number; informationTop: number }> = [];

  const checkPerspective = async (scope: string) => {
    await page.getByRole("region", { name: "Filtros globales" })
      .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${scope}"]`).check();
    await expect(page.getByText(/Consumo consultado:/)).toBeVisible();
    await expect(tree.getByText("Referencia").first()).toBeVisible();
    await expect(tree.getByText("Media").first()).toBeVisible();
    await expect(info).not.toHaveAttribute("open");
    const boxes = await Promise.all([
      page.getByRole("article", { name: "Asignado total" }).boundingBox(),
      tree.boundingBox(), infoSummary.boundingBox(),
    ]);
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
    return { scope, kpiTop: boxes[0]!.y, treeTop: boxes[1]!.y, informationTop: boxes[2]!.y };
  };
  for (const scope of ["realCashFlow", "all", "debtsOnly"]) {
    // oxlint-disable-next-line no-await-in-loop -- Perspectives share one unlocked synthetic browser session.
    measurements.push(await checkPerspective(scope));
  }
  await writeFile(testInfo.outputPath("budget-hierarchy-measurements.json"), JSON.stringify(measurements, null, 2));

  const summaryBox = await infoSummary.boundingBox();
  expect(summaryBox!.height).toBeGreaterThanOrEqual(44);
  await reference.press("Enter");
  await expect(info).not.toHaveAttribute("open");
  await reference.press("Space");
  await expect(reference.locator("..")).not.toHaveAttribute("open");
  await infoSummary.press("Enter");
  await expect(info).toHaveAttribute("open");
  await expect(info.getByText("Asignaciones categorizadas")).toBeVisible();
  await expect(infoSummary).toBeFocused();
  expect(await infoSummary.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("budget-information-open.png"), fullPage: true, animations: "disabled" });
  await info.screenshot({ path: testInfo.outputPath("budget-information-content.png"), animations: "disabled" });
  await infoSummary.press("Space");
  await expect(info).not.toHaveAttribute("open");

  const row = tree.locator(":scope > li > div").first();
  await row.getByRole("button", { name: "Detalles de Expense" }).click();
  await expect(info).not.toHaveAttribute("open");
  await row.getByRole("button", { name: /^Ver apuntes consumidos de Expense:/ }).click();
  await expect(page.getByRole("dialog", { name: "Expense · apuntes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(info).not.toHaveAttribute("open");
  await row.getByRole("button", { name: "Detalles de Expense" }).click();
  await expectNoDocumentOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("budget-information-hierarchy.png"), fullPage: true, animations: "disabled" });
  await tree.screenshot({ path: testInfo.outputPath("budget-decision-tree.png"), animations: "disabled" });
});

test("explains linear budget allowance by keyboard without overflowing the budget tree", async ({ page }, testInfo) => {
  await setAppTime(page, "2026-08-23T12:00:00.000Z");
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await toolbar.getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="all"]').check();
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  await expect(page.getByText(/Consumo consultado:/)).toContainText("Consumo consultado: 01 ago 2026 – 23 ago 2026");
  const pace = page.getByRole("region", { name: "Referencia lineal hasta la fecha" });
  await expect(pace).toBeVisible();
  await expect(pace).toContainText("Al 23 ago 2026");
  await expect(pace).toContainText("consumo registrado");
  const explanation = pace.getByText("Cómo se calcula");
  await explanation.focus();
  await page.keyboard.press("Enter");
  await expect(pace).toContainText("23 días de 31 días");
  await expect(pace).toContainText(/No garantiza que el historial esté completo/);
  await expect(explanation).toBeFocused();
  const row = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" }).locator(":scope > li > div").first();
  const toggle = row.getByRole("button", { name: "Detalles de Expense" });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(row.getByText("Referencia lineal hasta la fecha")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.screenshot({ path: `/tmp/myexpenses-a3-synthetic-${testInfo.project.name}.png`, fullPage: true, animations: "disabled" });
});

test("aligns budget disclosure glyph with the first category title line", async ({ page }, testInfo) => {
  await setAppTime(page, "2026-08-23T12:00:00.000Z");
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");

  const row = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" }).locator(":scope > li > div").first();
  const disclosure = row.locator(":scope > button");
  const details = row.getByRole("button", { name: "Detalles de Expense" });
  const title = row.locator("strong").first();
  const measure = async (scenario: string) => {
    const geometry = await row.evaluate((element) => {
      const button = element.querySelector(":scope > button");
      const glyph = button?.querySelector("svg");
      const name = element.querySelector("strong");
      if (!button || !glyph || !name) throw new Error("Budget category geometry is unavailable");
      const range = document.createRange();
      range.selectNodeContents(name);
      const lines = [...range.getClientRects()];
      const iconRect = glyph.getBoundingClientRect();
      const targetRect = button.getBoundingClientRect();
      return {
        glyphCenterY: iconRect.top + iconRect.height / 2,
        firstLineCenterY: lines[0]!.top + lines[0]!.height / 2,
        lineCount: lines.length,
        targetWidth: targetRect.width,
        targetHeight: targetRect.height,
      };
    });
    const delta = Math.abs(geometry.glyphCenterY - geometry.firstLineCenterY);
    console.info(`A3F ${testInfo.project.name} ${scenario}: delta=${delta.toFixed(2)}px lines=${geometry.lineCount}`);
    expect(geometry.targetWidth, `${scenario} disclosure hit target width`).toBeGreaterThanOrEqual(44);
    expect(geometry.targetHeight, `${scenario} disclosure hit target height`).toBeGreaterThanOrEqual(44);
    expect(delta, `${scenario} glyph must align with first title line`).toBeLessThanOrEqual(5);
    return geometry;
  };

  await row.screenshot({ path: `/tmp/a3f-after-${testInfo.project.name}.png`, animations: "disabled" });
  await measure("pace absent, children open, details closed");
  await disclosure.focus();
  await page.keyboard.press("Space");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await measure("pace absent, children closed");
  await details.focus();
  await page.keyboard.press("Space");
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await measure("pace absent, details open");

  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await toolbar.getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="all"]').check();
  await expect(row.getByText(/Referencia lineal:/)).toBeVisible();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await measure("pace present, details open");
  await details.focus();
  await page.keyboard.press("Space");
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await disclosure.focus();
  await page.keyboard.press("Space");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await measure("pace present, children open, single-line title");

  await title.evaluate((element) => {
    element.textContent = "Mantenimiento del hogar";
  });
  const wrapped = await measure("pace present, wrapped title");
  expect(wrapped.lineCount).toBeGreaterThan(1);
  await row.screenshot({ path: `/tmp/a3f-after-wrapped-${testInfo.project.name}.png`, animations: "disabled" });
  await expectNoDocumentOverflow(page);
});

test("matches category-tree disclosure spacing in budget rows", async ({ page }, testInfo) => {
  const measure = async (row: Locator) => row.evaluate((element) => {
    const button = element.querySelector(":scope > button");
    const glyph = button?.querySelector("svg");
    if (!button || !glyph) throw new Error("Tree disclosure is unavailable");
    const rowRect = element.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const glyphRect = glyph.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      buttonTopInset: buttonRect.top - rowRect.top,
      buttonLeftInset: buttonRect.left - rowRect.left,
      glyphTopInset: glyphRect.top - rowRect.top,
      targetWidth: buttonRect.width,
      targetHeight: buttonRect.height,
    };
  });

  await page.getByRole("link", { name: "Categorías" }).click();
  const categoryRow = page.getByRole("region", { name: "Explorador jerárquico" })
    .getByRole("button", { name: "Filtrar: Expense", exact: true }).locator("xpath=..");
  await categoryRow.scrollIntoViewIfNeeded();
  const categories = await measure(categoryRow);
  await categoryRow.screenshot({ path: `/tmp/a3f-spacing-after-categories-${testInfo.project.name}.png`, animations: "disabled" });

  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  const budgetRow = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" }).locator(":scope > li > div").first();
  await budgetRow.scrollIntoViewIfNeeded();
  const budget = await measure(budgetRow);
  await budgetRow.screenshot({ path: `/tmp/a3f-spacing-after-budget-${testInfo.project.name}.png`, animations: "disabled" });

  console.info(`A3F spacing ${testInfo.project.name}: categories=${JSON.stringify(categories)} budget=${JSON.stringify(budget)}`);
  // Categories center the glyph against a two-line selection; Budget aligns it to one title line.
  expect(budget.paddingTop, "budget top padding must provide at least the shared row spacing").toBeGreaterThanOrEqual(categories.paddingTop);
  expect(budget.paddingLeft, "horizontal row padding must match Categories").toBeCloseTo(categories.paddingLeft, 1);
  expect(Math.abs(budget.buttonTopInset - categories.buttonTopInset), "disclosure-to-border top spacing must match Categories").toBeLessThanOrEqual(1);
  expect(budget.buttonLeftInset, "disclosure-to-border left spacing must match Categories").toBeCloseTo(categories.buttonLeftInset, 1);
  expect(Math.abs(budget.glyphTopInset - categories.glyphTopInset), "glyph-to-border top spacing must match Categories").toBeLessThanOrEqual(1);
  expect(budget.targetWidth).toBeGreaterThanOrEqual(44);
  expect(budget.targetHeight).toBeGreaterThanOrEqual(44);
});

test("keeps current, reference and mean visible in compact rows without coupling disclosures", async ({ page }, testInfo) => {
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");

  const tree = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
  const root = tree.locator(":scope > li").first();
  const row = root.locator(":scope > div");
  await expect(row.getByText("Referencia", { exact: true })).toBeVisible();
  await expect(row.getByText("Media", { exact: true })).toBeVisible();
  const width = page.viewportSize()!.width;
  const height = (await row.boundingBox())!.height;
  // The mobile row retains a compact bound after matching Categories' disclosure top inset.
  expect(height, `closed comparison row at ${width}px`).toBeLessThanOrEqual(width >= 900 ? 110 : 195);
  const current = await row.locator("dl").first().boundingBox();
  const utilization = await row.locator("meter").first().locator("xpath=../..").boundingBox();
  expect(current).not.toBeNull();
  expect(utilization).not.toBeNull();
  const separated = current!.x + current!.width <= utilization!.x || utilization!.x + utilization!.width <= current!.x ||
    current!.y + current!.height <= utilization!.y || utilization!.y + utilization!.height <= current!.y;
  expect(separated, `current amount and utilization must not overlap at ${width}px`).toBe(true);
  const consumed = row.getByRole("button", { name: /Ver apuntes consumidos de Expense:/ });
  await consumed.scrollIntoViewIfNeeded();
  expect(await consumed.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return button === hit || button.contains(hit);
  }), `consumed amount must receive pointer events at ${width}px`).toBe(true);
  await row.screenshot({ path: testInfo.outputPath(`budget-row-closed-${width}.png`) });
  await consumed.click();
  const consumptionDialog = page.getByRole("dialog", { name: "Expense · apuntes" });
  await expect(consumptionDialog).toBeVisible();
  await consumptionDialog.getByRole("button", { name: "Cerrar detalle" }).click();

  if (width === 1280) {
    // oxlint-disable no-await-in-loop -- Each viewport needs a settled layout before measuring its rows.
    for (const intermediateWidth of [1024, 900, 768]) {
      await page.setViewportSize({ width: intermediateWidth, height: 800 });
      const extents = await tree.locator("li > div").evaluateAll((rows) => rows.map((element) => ({
        name: element.querySelector("strong")?.textContent,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })));
      for (const extent of extents) {
        expect(extent.scrollWidth, `${extent.name} row at ${intermediateWidth}px`).toBeLessThanOrEqual(extent.clientWidth);
      }
      if (intermediateWidth === 900) await tree.screenshot({ path: testInfo.outputPath("budget-rows-900.png") });
      await expectNoDocumentOverflow(page);
    }
    // oxlint-enable no-await-in-loop
    await page.setViewportSize({ width, height: 800 });
  }

  const treeToggle = row.locator(":scope > button");
  const detailToggle = row.locator('[aria-label="Detalles de Expense"]');
  await expect(detailToggle).toBeVisible();
  await expect(detailToggle).toHaveAttribute("aria-expanded", "false");
  await detailToggle.click();
  await expect(detailToggle).toHaveAttribute("aria-expanded", "true");
  await expect(row.getByText("Periodo")).toBeVisible();
  await expect(treeToggle).toHaveAttribute("aria-expanded", "true");
  await treeToggle.click();
  await expect(treeToggle).toHaveAttribute("aria-expanded", "false");
  await expect(treeToggle).toHaveAttribute("aria-label", "Desplegar Expense");
  await expect(detailToggle).toHaveAttribute("aria-expanded", "true");
  await expect(row.getByText("Periodo")).toBeVisible();
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
  const technicalDetails = dialog.locator("ol > li details");
  await expect(technicalDetails).toHaveCount(4);
  for (const detail of await technicalDetails.all()) {
    // oxlint-disable-next-line no-await-in-loop -- Inspect each native disclosure before opening it.
    expect(await detail.getAttribute("open")).toBeNull();
    // oxlint-disable-next-line no-await-in-loop -- Reveal one row at a time to check its native disclosure.
    await detail.locator("summary").click();
  }
  const actualIds = await dialog.getByText(/^ID: /).allTextContents();
  expect(actualIds.toSorted()).toEqual([1, 8, 15, 17].map((number) =>
    `ID: 11111111-1111-4111-8111-111111111111:10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  ).toSorted());
  const signedAmounts = await dialog.locator("ol > li data[value]").evaluateAll((elements) =>
    elements.map((element) => Number(element.getAttribute("value"))));
  expect(signedAmounts).toEqual([1, -2, 0.25, -0.2]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(overallTrigger).toBeFocused();
  await page.getByRole("button", { name: /Ver apuntes consumidos de Expense:/ }).click();
  const categoryDialog = page.getByRole("dialog", { name: "Expense · apuntes" });
  await categoryDialog.getByText(/10000000-0000-4000-8000-000000000015/).locator("xpath=ancestor::li").locator("details summary").click();
  await expect(categoryDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await expect(categoryDialog.getByText(/4 apuntes · -0,95/)).toBeVisible();
  await categoryDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await page.getByRole("button", { name: /Ver apuntes consumidos de Expense › Food:/ }).click();
  const foodDialog = page.getByRole("dialog", { name: "Expense › Food · apuntes" });
  await expect(foodDialog.getByText(/1 apunte · 0,25/)).toBeVisible();
  await foodDialog.locator("ol > li details summary").first().click();
  await expect(foodDialog.getByText(/10000000-0000-4000-8000-000000000015/)).toBeVisible();
  await foodDialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(page.getByRole("button", { name: "Filtrar: Expense" })).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test("shows categorized transfer endpoints and long comments in the compact budget dialog", async ({ page }, testInfo) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u6-transactions.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  await page.getByRole("group", { name: "Marco del presupuesto" }).getByLabel("Periodo").selectOption("MONTH:2026:7");
  const trigger = page.getByRole("button", { name: "Ver apuntes del gasto neto" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Gasto neto · apuntes" });
  const row = dialog.locator("ol > li").filter({ hasText: "Synthetic categorized transfer comment" });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(/Synthetic categorized transfer payee with a long identifying suffix/)).toBeVisible();
  await expect(row.getByText(/Synthetic categorized transfer comment/)).toBeVisible();
  await expect(row.getByText("Origen", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("Cash");
  await expect(row.getByText("Destino", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("Debt");
  await expect(row.locator("data[value]")).toHaveAttribute("value", "0.5");
  const details = row.locator("details");
  await expect(details).not.toHaveAttribute("open");
  await row.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expectNoDocumentOverflow(page);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  if (testInfo.project.name !== "mobile-390") {
    await mkdir("/tmp/transaction-t2-visual", { recursive: true });
    await dialog.screenshot({ path: `/tmp/transaction-t2-visual/budget-dialog-closed-${testInfo.project.name}.png`, animations: "disabled" });
  }
  await details.locator("summary").click();
  const rowId = row.getByText(/ID: .*000000000004/);
  await expect(rowId).toBeVisible();
  if (testInfo.project.name !== "mobile-390") {
    await rowId.scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: `/tmp/transaction-t2-visual/budget-dialog-expanded-${testInfo.project.name}.png`, animations: "disabled" });
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("keeps debt selection next to balance and preserves budget action names", async ({ page }, testInfo) => {
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
  await expect(balance.locator("..").getByText(/el signo del saldo por sí solo no indica quién debe a quién/i)).toBeVisible();
  await expect(trend).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.getByRole("main").screenshot({ path: testInfo.outputPath("debt-balance-context.png"), animations: "disabled" });
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
  const totalAllocation = page.getByRole("article", { name: "Asignado total" });
  await expect(totalAllocation).toBeVisible();
  await expect(totalAllocation.getByText(/No se calcula sumando categorías/)).toBeVisible();
  await totalAllocation.screenshot({ path: testInfo.outputPath("budget-total-card.png"), animations: "disabled" });
  await page.getByRole("main").screenshot({ path: testInfo.outputPath("budget-total-context.png"), animations: "disabled" });
  const information = page.locator("summary").filter({ hasText: "Información del presupuesto" });
  await expect(information.locator("..")).not.toHaveAttribute("open");
  await information.press("Enter");
  await expect(page.getByText("Arrastre recibido")).toBeVisible();
  await information.press("Space");
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
  await expect(utilization).toContainText("Sin límite total");
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
  const arrowDownFinished = scrollRegion.evaluate((element) => new Promise<number>((resolve) => {
    const onScrollEnd = () => {
      if (element.scrollTop <= 0) return;
      element.removeEventListener("scrollend", onScrollEnd);
      resolve(element.scrollTop);
    };
    element.addEventListener("scrollend", onScrollEnd);
  }));
  await page.keyboard.press("ArrowDown");
  const afterArrowDown = await arrowDownFinished;
  expect(afterArrowDown).toBeGreaterThan(0);
  await expect(scrollRegion).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(afterArrowDown);
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

const budgetHistoryMoney = new Intl.NumberFormat("es-ES", {
  currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2, style: "currency",
});
const historyAmount = (minor: number) => budgetHistoryMoney.format(minor / 100);

for (const { scope, current, reference: expectedReference, mean, incomeCurrent, incomeReference, incomeMean, postingCount } of [
  { scope: "realCashFlow", current: -95, reference: 5_010, mean: 6_010 / 3,
    incomeCurrent: 177, incomeReference: 200_000, incomeMean: 100_000, postingCount: 4 },
  { scope: "all", current: -95, reference: 5_010, mean: 6_010 / 3,
    incomeCurrent: 177, incomeReference: 200_000, incomeMean: 100_000, postingCount: 4 },
  { scope: "debtsOnly", current: 0, reference: 0, mean: 0,
    incomeCurrent: 0, incomeReference: 0, incomeMean: 0, postingCount: 0 },
] as const) {
  test(`keeps synthetic budget history, reference controls and scoped income coherent in ${scope}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-08-15T12:00:00.000Z"));
    await page.route("**/data/app-dataset.vault.json", async (route) => {
      const variant = await route.fetch({ url: `${BASE}/data/u7-budget-history.vault.json` });
      await route.fulfill({ response: variant });
    });
    await page.reload();
    await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Abrir bóveda" }).click();
    await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
    const controls = page.getByRole("group", { name: "Marco del presupuesto" });
    await controls.getByRole("combobox", { name: "Presupuesto", exact: true }).selectOption({ label: "Monthly" });
    await controls.getByRole("combobox", { name: "Periodo", exact: true }).selectOption("MONTH:2026:7");
    const selectScope = (value: string) => page.getByRole("region", { name: "Filtros globales" })
      .getByRole("group", { name: "Ámbito de las estadísticas" }).locator(`input[value="${value}"]`).check();
    await selectScope(scope);

    const tree = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
    const root = tree.locator(":scope > li > div").first();
    const child = tree.locator(":scope > li > ul > li > div").first();
    const reference = (row: Locator) => row.locator("dl[class*=referenceMetric] dd");
    const meanValue = (row: Locator) => row.locator("dl[class*=meanMetric] dd");
    const consumed = root.getByRole("button", { name: /^Ver apuntes consumidos de Expense:/ });
    await expect(consumed).toHaveText(historyAmount(current));
    await expect(child.getByRole("button", { name: /^Ver apuntes consumidos de Expense › Food:/ })).toHaveText(historyAmount(scope === "debtsOnly" ? 0 : 25));
    await expect(reference(root)).toHaveText(historyAmount(expectedReference));
    await expect(reference(child)).toHaveText(historyAmount(scope === "debtsOnly" ? 0 : 5_000));
    await expect(meanValue(root)).toHaveText(historyAmount(mean));
    await expect(meanValue(child)).toHaveText(historyAmount(scope === "debtsOnly" ? 0 : 2_000));
    await expect(page.getByText(/3 meses completos/)).toHaveCount(1);

    const income = page.getByRole("region", { name: "Ingresos en el mismo ámbito" });
    const incomeMetric = (label: string) => income.getByText(label, { exact: true }).locator("xpath=following-sibling::dd");
    await expect(income).toContainText("no reducen el consumo del presupuesto");
    await expect(incomeMetric("Actual")).toHaveText(historyAmount(incomeCurrent));
    await expect(incomeMetric("Referencia completa")).toHaveText(historyAmount(incomeReference));
    await expect(incomeMetric("Media")).toHaveText(historyAmount(incomeMean));
    const rows = await tree.locator("li > div").evaluateAll((elements) => elements.map((element) => ({
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    })));
    for (const row of rows) expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    await expectNoDocumentOverflow(page);
    await tree.screenshot({ path: testInfo.outputPath(`budget-history-${scope}.png`), animations: "disabled" });

    const details = root.getByRole("button", { name: "Detalles de Expense" });
    await details.press("Enter");
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(root.getByText("Mismo tramo transcurrido")).toBeVisible();
    const treeToggle = root.getByRole("button", { name: "Contraer Expense" });
    await treeToggle.press("Enter");
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(child).toHaveCount(0);
    await page.getByRole("button", { name: "Desplegar Expense" }).press("Enter");
    await details.press("Space");
    await consumed.click();
    const dialog = page.getByRole("dialog", { name: "Expense · apuntes" });
    await expect(dialog.locator("ol > li")).toHaveCount(postingCount);
    if (postingCount > 0) {
      const ids = await dialog.getByText(/^ID: /).allTextContents();
      expect(ids.toSorted()).toEqual([1, 8, 15, 17].map((id) =>
        `ID: 11111111-1111-4111-8111-111111111111:10000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      ).toSorted());
    }
    await page.keyboard.press("Escape");
    await expect(consumed).toBeFocused();

    const summary = page.locator("summary").filter({ hasText: /^(Referencias ·|Sin referencias$)/ });
    await summary.press("Enter");
    const panel = summary.locator("..");
    const primary = panel.getByLabel("Referencia principal");
    const addPeriod = async (date: string) => {
      if (await panel.getAttribute("open") === null) await summary.press("Enter");
      await panel.getByLabel("Fecha del periodo de referencia").fill(date);
      await panel.getByRole("button", { name: "Añadir periodo" }).click();
    };
    await expect(primary).toHaveValue("MONTH:2026:6");
    await addPeriod("2026-06-15");
    await primary.selectOption("MONTH:2026:5");
    await expect(reference(root)).toHaveText(historyAmount(0));
    await expect(meanValue(root)).toHaveText(historyAmount(mean));
    const otherScope = scope === "debtsOnly" ? "realCashFlow" : "debtsOnly";
    await selectScope(otherScope);
    await expect(primary).toHaveValue("MONTH:2026:5");
    await expect(primary.locator("option")).toHaveCount(2);
    await selectScope(scope);
    await addPeriod("2026-04-15");
    await primary.selectOption("MONTH:2026:3");
    await expect(reference(root)).toHaveText("Sin datos");
    await expect(meanValue(root)).toHaveText(historyAmount(mean));
    for (const label of ["Julio de 2026", "Junio de 2026", "Abril de 2026"]) {
      // oxlint-disable-next-line no-await-in-loop -- Remove each selected calendar reference through its own control.
      await panel.getByRole("button", { name: `Quitar referencia ${label}` }).press("Enter");
    }
    await expect(summary).toHaveText("Sin referencias");
    await expect(reference(root)).toHaveText("Sin referencia");
    await expect(meanValue(root)).toHaveText(historyAmount(mean));
    await addPeriod("2026-05-15");
    await controls.getByRole("combobox", { name: "Periodo", exact: true }).selectOption("MONTH:2026:6");
    await expect(primary).toHaveValue("MONTH:2026:5");
    await expect(reference(root)).toHaveText(historyAmount(0));
    await controls.getByRole("combobox", { name: "Periodo", exact: true }).selectOption("MONTH:2026:7");
    await expect(primary).toHaveValue("MONTH:2026:6");
    await addPeriod("2026-05-15");
    await controls.getByRole("combobox", { name: "Presupuesto", exact: true }).selectOption({ label: "Alternate monthly" });
    await expect(primary).toHaveValue("MONTH:2026:6");
    await expect(primary.locator("option")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("shows an accessible annual savings trajectory on Plans at desktop and mobile widths", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-08-15T12:00:00.000Z"));
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/u7-budget-history.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await page.getByRole("link", { name: /^(Presupuestos|Planes)$/ }).click();
  const controls = page.getByRole("group", { name: "Marco del presupuesto" });
  await controls.getByRole("combobox", { name: "Presupuesto", exact: true }).selectOption({ label: "Annual outlook" });
  const projection = page.getByRole("region", { name: "Proyección anual de ahorro" });
  await expect(projection.getByRole("img", { name: "Ahorro acumulado en 2026" })).toBeVisible();
  await expect(projection.getByText(/Diciembre:/)).toBeVisible();
  const interpretation = projection.locator("p").filter({ hasText: "Escenario condicionado al presupuesto" });
  await expect(interpretation).toBeVisible();
  await expect(interpretation).toContainText("ingresos previstos menos la asignación mensual completa");
  await expect(interpretation).toContainText("El gasto observado en esos meses no modifica el aporte");
  await expect(interpretation).toContainText("Los meses cerrados del intervalo observado usan el flujo registrado");
  await expect(interpretation).toContainText("ni saldo actual ni dinero disponible");
  const coverage = projection.locator("p").filter({ hasText: "Cobertura no verificada" });
  await expect(coverage).toBeVisible();
  await expect(coverage).toContainText("Las fechas observadas no garantizan un historial completo");
  await expect(coverage).toContainText("Sin registros puede faltar información, no necesariamente actividad");
  await expect(projection).not.toContainText("cobertura completa");
  await expect(projection).not.toContainText("meses completos");
  const noteBounds = await interpretation.boundingBox();
  const coverageBounds = await coverage.boundingBox();
  const chartBounds = await projection.getByRole("img", { name: "Ahorro acumulado en 2026" }).boundingBox();
  expect(noteBounds!.y + noteBounds!.height).toBeLessThanOrEqual(coverageBounds!.y);
  expect(coverageBounds!.y + coverageBounds!.height).toBeLessThanOrEqual(chartBounds!.y);
  await projection.screenshot({
    path: testInfo.outputPath("annual-projection-interpretation.png"), animations: "disabled",
    style: '[aria-label="Filtros globales"] { visibility: hidden; }',
  });
  await expect(projection.getByText(/Presupuesto anual:/)).toContainText("12 meses naturales");
  await projection.locator("summary").filter({ hasText: "Desglose mensual" }).press("Enter");
  const table = projection.getByRole("table", { name: "Aportes y acumulado por mes" });
  await expect(table.getByRole("row")).toHaveCount(13);
  await expect(table.getByRole("row", { name: /2026-05/ })).toContainText("Real");
  await expect(table.getByRole("row", { name: /2026-08/ })).toContainText("Estimado");
  const globalRows = await table.getByRole("row").allTextContents();
  const globalIncomeAssumption = await projection.getByText(/Ingresos estimados:/).textContent();
  const expectGlobalProjection = async (title: string) => {
    await controls.getByRole("combobox", { name: "Presupuesto", exact: true }).selectOption({ label: title });
    await expect(projection.getByRole("img", { name: "Ahorro acumulado en 2026" })).toBeVisible();
    await expect(projection.getByText(/El flujo real y los ingresos son globales/)).toContainText("asignación completa del presupuesto seleccionado");
    await expect(projection).not.toContainText("no se puede comparar con el flujo real total");
    await expect(projection.getByText(/Ingresos estimados:/)).toHaveText(globalIncomeAssumption!);
    const summary = projection.locator("summary").filter({ hasText: "Desglose mensual" });
    if (await summary.evaluate((element) => !element.parentElement!.hasAttribute("open"))) await summary.press("Enter");
    await expect(table.getByRole("row")).toHaveText(globalRows);
  };
  await expectGlobalProjection("Account annual outlook");
  await expectGlobalProjection("Category annual outlook");

  await expectNoDocumentOverflow(page);
  const paragraphsFit = await projection.locator("p").evaluateAll((elements) =>
    elements.every((element) => element.scrollWidth <= element.clientWidth + 1));
  expect(paragraphsFit, "projection explanations must wrap within the panel").toBe(true);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await projection.evaluate(async (element) => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(element, { runOnly: { type: "rule", values: ["color-contrast", "scrollable-region-focusable", "button-name"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await projection.screenshot({
    path: testInfo.outputPath("annual-projection-details.png"), animations: "disabled",
    style: '[aria-label="Filtros globales"] { visibility: hidden; }',
  });
});

test("keeps keyboard focus on adjacent filter removals and stable fallbacks", async ({ page }) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const opener = toolbar.getByRole("button", { name: /Abrir todos los filtros/ });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  const selector = drawer.getByRole("region", { name: "Selector de categorías" });
  await drawer.getByRole("button", { name: "Seleccionar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Desplegar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Income", exact: true }).click();
  const drawerMiddle = drawer.getByRole("button", { name: "Quitar Expense › Food", exact: true });
  const drawerLast = drawer.getByRole("button", { name: "Quitar Income", exact: true });
  const drawerFirst = drawer.getByRole("button", { name: "Quitar Expense", exact: true });
  await drawerMiddle.focus();
  await expect(drawerMiddle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(drawerMiddle).toHaveCount(0);
  await expect(drawerLast).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(drawerLast).toHaveCount(0);
  await expect(drawerFirst).toBeFocused();
  await page.keyboard.press("Space");
  await expect(drawerFirst).toHaveCount(0);
  await expect(selector).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(opener).toBeFocused();

  await opener.click();
  await drawer.getByRole("button", { name: "Seleccionar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Expense › Food", exact: true }).click();
  await drawer.getByRole("button", { name: "Seleccionar Income", exact: true }).click();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  const globalMiddle = toolbar.getByRole("button", { name: "Quitar filtro Expense › Food", exact: true });
  const globalLast = toolbar.getByRole("button", { name: "Quitar filtro Income", exact: true });
  const globalFirst = toolbar.getByRole("button", { name: "Quitar filtro Expense", exact: true });
  await globalMiddle.focus();
  await expect(globalMiddle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(globalMiddle).toHaveCount(0);
  await expect(globalLast).toBeFocused();
  await page.keyboard.press("Space");
  await expect(globalLast).toHaveCount(0);
  await expect(globalFirst).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(globalFirst).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await drawer.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("exclude");
  const scope = drawer.getByRole("group", { name: "Ámbito de las estadísticas" });
  await scope.locator('input[value="all"]').check();
  const accounts = drawer.getByRole("group", { name: "Cuentas", exact: true });
  await accounts.getByRole("checkbox", { name: /Cash, EUR/ }).check();
  await accounts.getByRole("checkbox", { name: /Debt, EUR/ }).check();
  await scope.locator('input[value="realCashFlow"]').check();
  await drawer.getByRole("combobox", { name: "Modo de cuentas" }).selectOption("include");
  await drawer.getByRole("button", { name: "Seleccionar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  const cashChip = toolbar.getByRole("button", { name: "Quitar filtro Cuenta: Cash", exact: true });
  const debtChip = toolbar.getByRole("button", { name: "Quitar filtro Cuenta: Debt", exact: true });
  await expect(debtChip).toBeVisible();
  await cashChip.focus();
  await page.keyboard.press("Enter");
  await expect(cashChip).toHaveCount(0);
  await expect(debtChip).toHaveCount(0);
  await expect(globalFirst).toBeFocused();
  await page.keyboard.press("Space");
  await expect(globalFirst).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("accumulates filtered flow curves with exact tables and CSV at the selected interval", async ({ page }) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("custom");
  await toolbar.getByLabel("Desde", { exact: true }).fill("2026-07-01");
  await toolbar.getByLabel("Hasta", { exact: true }).fill("2026-08-31");
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByRole("button", { name: "Seleccionar Expense", exact: true }).click();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();

  const downloadRows = async (figure: Locator) => {
    const disclosure = figure.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Ver datos exactos$/ }) });
    if (!(await disclosure.evaluate((element) => element.hasAttribute("open")))) {
      await disclosure.locator("summary").click();
    }
    const downloadPromise = page.waitForEvent("download");
    await figure.getByRole("button", { name: /Descargar CSV:/ }).click();
    const csv = await readFile(await (await downloadPromise).path(), "utf8");
    return csv.replace(/^\uFEFF/u, "").split(/\r?\n/u).slice(1).map((line) => {
      const [key, ...cells] = line.split(",");
      return { key, values: cells.map(Number) };
    });
  };
  // oxlint-disable no-await-in-loop -- Each route/mode/granularity must settle before its matching CSV comparison.
  for (const scenario of [
    { route: "/resumen", group: "Vista del pulso financiero", period: "Pulso financiero", cumulative: "Pulso financiero acumulado", columns: 3 },
    { route: "/flujo-de-caja", group: "Vista del flujo neto", period: "Flujo neto por periodo", cumulative: "Flujo neto acumulado", columns: 2 },
  ]) {
    await page.locator(`a[href="${scenario.route}"]`).click();
    const mode = page.getByRole("group", { name: scenario.group });
    await expect(mode.getByRole("radio", { name: "Por período" })).toBeChecked();
    for (const resolution of ["month", "day"]) {
      await mode.getByRole("radio", { name: "Por período" }).check();
      await selectToolbarGranularity(toolbar, resolution);
      const periodFigure = page.locator("figure").filter({ has: page.getByRole("heading", { name: scenario.period, exact: true }) });
      const periodRows = await downloadRows(periodFigure);
      expect(periodRows).toHaveLength(resolution === "month" ? 2 : 62);
      expect(periodRows.every((row) => row.values.length === scenario.columns && row.values.every(Number.isFinite))).toBe(true);
      if (resolution === "month") expect(periodRows[0]!.values.at(-1)).toBe(-0.1);
      const totals = Array<number>(scenario.columns).fill(0);
      const expected = periodRows.map((row) => ({ key: row.key, values: row.values.map((value, index) => {
        totals[index] = totals[index]! + Math.round(value * 100);
        return totals[index]! / 100;
      }) }));
      await mode.getByRole("radio", { name: "Acumulado" }).focus();
      await page.keyboard.press("Space");
      const cumulativeFigure = page.locator("figure").filter({ has: page.getByRole("heading", { name: scenario.cumulative, exact: true }) });
      await expect(cumulativeFigure.locator("figcaption p")).toContainText("No incluye el saldo de apertura ni representa patrimonio");
      expect(await downloadRows(cumulativeFigure)).toEqual(expected);
      await expect(cumulativeFigure.getByRole("table").getByRole("row")).toHaveCount(periodRows.length + 1);
      const lastValues = await cumulativeFigure.getByRole("table").locator("tbody tr").last().locator("td").allTextContents();
      const expectedLast = expected.at(-1)!.values.map((value) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value));
      expect(lastValues).toEqual(expectedLast);
      await expectNoDocumentOverflow(page);
    }
    await toolbar.getByLabel("Desde", { exact: true }).fill("2026-08-01");
    const cumulativeFigure = page.locator("figure").filter({ has: page.getByRole("heading", { name: scenario.cumulative, exact: true }) });
    const narrowed = await downloadRows(cumulativeFigure);
    expect(narrowed).toHaveLength(31);
    expect(narrowed[0]!.values).toEqual(Array<number>(scenario.columns).fill(0));
    await toolbar.getByLabel("Desde", { exact: true }).fill("2026-07-01");
  }
  // oxlint-enable no-await-in-loop
});


test("overview review cautions preserve the effective cut and offer keyboard drilldowns", async ({ page }, testInfo) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/s06-review.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  const panel = page.getByRole("region", { name: "Qué revisar" });
  await expect(panel).toContainText("Sin categoría · 2 apuntes");
  await expect(panel.locator("li").first()).toContainText("Sin categoría");
  await expect(panel.getByRole("button")).toHaveCount(1);
  await expect(panel).not.toContainText("Sin conciliar");
  await expectNoDocumentOverflow(page);
  const targetSizes = await panel.getByRole("button").evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await page.addScriptTag({ path: join(process.cwd(), "node_modules/axe-core/axe.min.js") });
  const violations = await panel.evaluate(async (element) => {
    const axe = (window as unknown as { axe: { run: (context: Element, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
    return (await axe.run(element, { runOnly: { type: "rule", values: ["button-name", "color-contrast", "aria-valid-attr-value"] } })).violations.map(({ id }) => id);
  });
  expect(violations).toEqual([]);
  await panel.screenshot({ path: testInfo.outputPath("overview-review-cautions.png"), animations: "disabled",
    style: '[aria-label="Filtros globales"] { visibility: hidden; }' });
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByText("Criterios adicionales").click();
  await drawer.getByRole("searchbox", { name: "Buscar en comentarios" }).fill("review-marker");
  await drawer.getByRole("group", { name: "Moneda del movimiento" }).getByRole("checkbox", { name: "EUR" }).check();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("myexpenses-analysis:filters:v1")!));
  const action = panel.getByRole("button", { name: "Ver apuntes sin categoría" });
  await expect(action).toBeEnabled();
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Transacciones", exact: true })).toBeVisible();
  await expect(page.locator("main output")).toContainText("2 resultados.");
  await expect(page.getByText("review-marker-1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("review-marker-2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("review-marker-5", { exact: true })).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("myexpenses-analysis:filters:v1")!));
  expect(after).toMatchObject({ ...before, filters: { ...before.filters,
    categoryPrefixes: [[]], categoryDepth: "exact", categoryMode: "include", categoryMatch: "posting",
    categoryTypes: ["EXPENSE", "INCOME", "NEUTRAL"], linked: "unlinked",
  } });
  await expectNoDocumentOverflow(page);
});


test("ignores legacy transaction statuses in saved filters and presets", async ({ page }) => {
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const variant = await route.fetch({ url: `${BASE}/data/s06-review.vault.json` });
    await route.fulfill({ response: variant });
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  const flow = page.getByRole("article", { name: "Flujo del periodo" });
  const baseline = await flow.textContent();
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  await drawer.getByText("Filtros guardados", { exact: true }).click();
  await drawer.getByRole("textbox", { name: "Nombre del filtro" }).fill("Legacy VOID");
  await drawer.getByRole("button", { name: "Guardar filtro actual" }).click();
  await expect(drawer.getByRole("option", { name: "Legacy VOID" })).toHaveCount(1);
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await page.evaluate(() => {
    const key = "myexpenses-analysis:filter-presets:v1";
    const saved = JSON.parse(localStorage.getItem(key)!);
    const preset = saved.presets[0];
    preset.snapshot.filters.statuses = ["VOID"];
    saved.presets.push({ ...preset, name: "Legacy RECONCILED", snapshot: { ...preset.snapshot,
      filters: { ...preset.snapshot.filters, statuses: ["RECONCILED"] } } });
    localStorage.setItem(key, JSON.stringify(saved));
    const preferencesKey = "myexpenses-analysis:filters:v1";
    const preferences = JSON.parse(localStorage.getItem(preferencesKey)!);
    preferences.filters.statuses = ["VOID"];
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  });
  await page.reload();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(flow).toHaveText(baseline!);
  for (const name of ["Legacy VOID", "Legacy RECONCILED"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each persisted legacy preset is restored and observed independently.
    await test.step(name, async () => {
      await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
      const savedFilters = drawer.locator("summary").filter({ hasText: /^Filtros guardados$/ });
      if (!(await savedFilters.evaluate((summary) => summary.parentElement!.hasAttribute("open")))) {
        await savedFilters.click();
      }
      await drawer.getByRole("combobox", { name: "Filtro guardado", exact: true }).selectOption(name);
      await drawer.getByRole("button", { name: "Aplicar filtro guardado" }).click();
      await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
      await expect(flow).toHaveText(baseline!);
      await expect(page.getByRole("region", { name: "Qué revisar" })).toContainText("Sin categoría · 2 apuntes");
      await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/ }).click();
      await expect(page.locator("main output")).toContainText("4 resultados.");
      const table = page.getByRole("table", { name: "Transacciones que coinciden con los filtros globales" });
      await expect(table.locator("tbody tr")).toHaveCount(4);
      await expect(page.getByText("review-marker-5", { exact: true })).toHaveCount(0);
      await table.getByText("Ver concepto completo y trazabilidad").first().click();
      await expect(table.getByText(/Estado MyExpenses|UNRECONCILED|RECONCILED|CLEARED/)).toHaveCount(0);
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar CSV" }).click();
      const csv = await readFile(await (await downloadPromise).path(), "utf8");
      expect(csv.split(/\r?\n/u)).toHaveLength(5);
      const headers = csv.split(/\r?\n/u)[0]!.split(",");
      expect(headers).not.toContain("estado");
      expect(headers).not.toContain("estado_myexpenses");
      expect(csv).not.toMatch(/(?:^|,)(?:VOID|UNRECONCILED|RECONCILED|CLEARED)(?:,|$)/mu);
      await expectNoDocumentOverflow(page);
      await page.getByRole("link", { name: "Resumen", exact: true }).click();
    });
  }
});


test("period category contributions expose both evidence ranges without widening filters", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await selectToolbarGranularity(toolbar, "week");
  const outer = page.locator("summary").filter({ hasText: /^Comparar periodos/ });
  await outer.focus();
  await page.keyboard.press("Enter");
  const comparison = page.getByRole("region", { name: "Comparación de periodos" });
  await comparison.getByRole("combobox", { name: "Comparar con" }).selectOption("previousPeriod");
  const summary = comparison.locator("summary").filter({ hasText: /^Contribuciones por categoría$/ });
  await expect(summary.locator("..")).not.toHaveAttribute("open");
  await summary.focus();
  await page.keyboard.press("Space");
  const detail = comparison.getByRole("region", { name: "Contribuciones por categoría" });
  await expect(detail).toContainText("cambia el periodo global y recalcula");
  const expense = detail.locator("li").filter({ has: page.getByRole("heading", { name: "Expense", exact: true }) });
  const current = expense.getByRole("button", { name: "Ver apuntes actuales de Expense" });
  const reference = expense.getByRole("button", { name: "Ver apuntes de referencia de Expense" });
  await expect(current).toBeEnabled();
  await expect(reference).toBeEnabled();
  const sizes = await expense.getByRole("button").evaluateAll((buttons) => buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await expectNoDocumentOverflow(page);
  await detail.screenshot({ path: testInfo.outputPath("period-category-contributions.png"), animations: "disabled",
    style: '[aria-label="Filtros globales"], a[href="#main-content"] { visibility: hidden; }' });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("myexpenses-analysis:filters:v1")!));
  await reference.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Transacciones", exact: true })).toBeVisible();
  await expect(page.getByText("July coverage", { exact: true }).first()).toBeVisible();
  const afterReference = await page.evaluate(() => JSON.parse(localStorage.getItem("myexpenses-analysis:filters:v1")!));
  expect(afterReference).toMatchObject({ ...before, filters: { ...before.filters, periodMode: "custom", dateRange: { from: "2026-07-01", to: "2026-07-31" }, categoryPrefixes: [["Expense"]], categoryMode: "include", categoryMatch: "posting", categoryDepth: "subtree" } });
  await expect(comparison).toContainText("Actual: 01 jul 2026 – 31 jul 2026");
  await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("month");
  await toolbar.getByLabel("Mes seleccionado").fill("2026-08");
  await current.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Synthetic food", { exact: true }).first()).toBeVisible();
  const afterCurrent = await page.evaluate(() => JSON.parse(localStorage.getItem("myexpenses-analysis:filters:v1")!));
  expect(afterCurrent).toMatchObject({ ...afterReference, filters: { ...afterReference.filters, dateRange: { from: "2026-08-01", to: "2026-08-31" } } });
  await toolbar.getByRole("button", { name: /Abrir todos los filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
  await drawer.getByRole("checkbox", { name: "También buscar la categoría en la contrapartida vinculada" }).check();
  await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  await expect(detail).toContainText("sin ampliar la selección");
  await expect(current).toBeDisabled();
  await expect(reference).toBeDisabled();
  await expectNoDocumentOverflow(page);
});
