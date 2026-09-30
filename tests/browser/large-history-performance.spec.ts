import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { summarizeSamples } from "../performance/summary.ts";

/* oxlint-disable no-await-in-loop -- benchmark interactions must finish before the next sample starts. */

const PASSPHRASE = "synthetic-browser-only-passphrase";
const COUNT = Number(process.env.MYEXPENSES_PERF_COUNT);

interface FixtureCounts {
  readonly postings: number;
  readonly real: number;
  readonly search: number;
  readonly debts: number;
  readonly date: number;
}

async function resultCount(page: Page, count: number): Promise<void> {
  const label = count.toLocaleString("es-ES");
  await expect(page.getByRole("region", { name: "Movimientos filtrados" }))
    .toContainText(`${label} ${count === 1 ? "resultado" : "resultados"}`);
  await expect(page.locator("main").getByRole("status")).not.toContainText("Actualizando búsqueda");
}

test("measures opt-in synthetic history interactions without latency thresholds", async ({ page, context }, testInfo) => {
  test.setTimeout(12 * 60_000);
  expect([1_000, 10_000, 50_000]).toContain(COUNT);
  const throttleRate = testInfo.project.name === "mobile-390" ? 4 : 1;
  if (throttleRate > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttleRate });
  }
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00.000Z"));
  const response = await page.request.get("/data/performance-meta.json");
  expect(response.status()).toBe(200);
  const fixture = await response.json() as FixtureCounts;
  expect(fixture.postings).toBe(COUNT);
  const samples: Record<string, number[]> = {};
  const measure = async (name: string, action: () => Promise<void>) => {
    const start = performance.now();
    await action();
    (samples[name] ??= []).push(performance.now() - start);
  };

  for (let index = 0; index < 3; index++) {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
    await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
    await measure("manual-submit-to-ready", async () => {
      await page.getByRole("button", { name: "Abrir bóveda" }).click();
      await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
    });
    await page.getByRole("button", { name: "Bloquear bóveda" }).click();
    await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  }
  await page.reload();
  await page.getByRole("checkbox", { name: "Recordar en este dispositivo" }).check();
  await page.getByLabel("Frase de desbloqueo").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => await new Promise<boolean>((resolve) => {
    const opening = indexedDB.open("myexpenses-remembered-vault", 1);
    opening.onerror = () => resolve(false);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction("key", "readonly").objectStore("key").get("current");
      request.onsuccess = () => { resolve(request.result?.key instanceof CryptoKey); db.close(); };
      request.onerror = () => { resolve(false); db.close(); };
    };
  }))).toBe(true);
  for (let index = 0; index < 3; index++) {
    await measure("remembered-reload-to-ready", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
    });
  }

  await measure("transactions-navigation", async () => {
    await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/u }).click();
    await resultCount(page, fixture.real);
  });
  const toolbar = page.getByRole("region", { name: "Filtros globales" });
  for (let index = 0; index < 3; index++) {
    await toolbar.getByRole("button", { name: /Abrir todos los filtros/u }).click();
    const drawer = page.getByRole("dialog", { name: "Filtros del análisis" });
    await measure("search-drawer-to-results", async () => {
      await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("perf-marker");
      await resultCount(page, fixture.search);
    });
    await drawer.getByRole("searchbox", { name: "Buscar en movimientos" }).fill("");
    await resultCount(page, fixture.real);
    await drawer.getByRole("button", { name: "Cerrar filtros", exact: true }).click();
  }
  for (let index = 0; index < 3; index++) {
    await measure("perspective-real-to-debts", async () => {
      await toolbar.getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="debtsOnly"]').check();
      await resultCount(page, fixture.debts);
    });
    await toolbar.getByRole("group", { name: "Ámbito de las estadísticas" }).locator('input[value="realCashFlow"]').check();
    await resultCount(page, fixture.real);
  }
  for (let index = 0; index < 3; index++) {
    await measure("date-controls-to-results", async () => {
      await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("custom");
      await toolbar.getByLabel("Desde", { exact: true }).fill("2026-07-01");
      await toolbar.getByLabel("Hasta", { exact: true }).fill("2026-08-31");
      await resultCount(page, fixture.date);
    });
    await toolbar.getByRole("combobox", { name: "Tipo de periodo" }).selectOption("all");
    await resultCount(page, fixture.real);
  }
  for (let index = 0; index < 3; index++) {
    await measure("categories-navigation-to-tree", async () => {
      await page.getByRole("link", { name: "Categorías" }).click();
      await expect(page.getByRole("heading", { name: "Explorador jerárquico" })).toBeVisible();
      await expect(page.locator("main").getByText("Food", { exact: true }).first()).toBeVisible();
    });
    await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/u }).click();
    await resultCount(page, fixture.real);
  }
  for (let index = 0; index < 3; index++) {
    await measure("budgets-navigation-to-comparison", async () => {
      await page.getByRole("link", { name: /^(Presupuestos|Planes)$/u }).click();
      const tree = page.getByRole("list", { name: "Asignaciones jerárquicas del presupuesto" });
      await expect(tree.getByText("Referencia").first()).toBeVisible();
      await expect(tree.getByText("Media").first()).toBeVisible();
    });
    await page.getByRole("link", { name: /^(Transacciones|Movimientos)$/u }).click();
    await resultCount(page, fixture.real);
  }
  const measured = Object.fromEntries(Object.entries(samples).map(([name, values]) => {
    const warmups = Math.min(1, values.length - 1);
    return [name, {
      warmups, repeats: values.length - warmups,
      ...summarizeSamples(values.slice(warmups)), samplesMs: values,
    }];
  }));
  const report = {
    fixture: "imported schema-189 seed plus deterministic synthetic postings v1",
    requestedPostings: COUNT, actualPostings: fixture.postings,
    project: testInfo.project.name, viewport: page.viewportSize(),
    browser: page.context().browser()?.version() ?? "unknown",
    cpuThrottleRate: throttleRate, emulatedNotPhysicalDevice: true,
    node: process.version, generatedAt: new Date().toISOString(), measured,
  };
  await writeFile(testInfo.outputPath("performance.json"), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report)}\n`);
});
