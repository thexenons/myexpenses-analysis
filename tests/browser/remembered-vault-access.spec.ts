import { expect, test, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:41789";
const PASSPHRASE = "synthetic-browser-only-passphrase";
const LOCK_MARKER = "myexpenses-analysis:remembered-lock:v1";

async function unlock(page: Page, remember = false, phrase = PASSPHRASE) {
  if (remember) await page.getByRole("checkbox", { name: "Recordar en este dispositivo" }).check();
  await page.getByLabel("Frase de desbloqueo").fill(phrase);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
}

async function rememberedRecord(page: Page) {
  return page.evaluate(async () => await new Promise<{
    hasKey: boolean; digest: string | null; decryptOnly: boolean; extractable: boolean;
    exportRejected: boolean; fence: string | null;
  }>((resolve, reject) => {
    const opening = indexedDB.open("myexpenses-remembered-vault", 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const request = db.transaction("key", "readonly").objectStore("key").get("current");
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = async () => {
        const entry = request.result as { digest?: string; key?: CryptoKey; fence?: string | null } | undefined;
        let exportRejected = false;
        if (entry?.key) {
          try { await crypto.subtle.exportKey("raw", entry.key); }
          catch { exportRejected = true; }
        }
        resolve({
          hasKey: entry?.key instanceof CryptoKey,
          digest: entry?.digest ?? null,
          decryptOnly: entry?.key?.usages.length === 1 && entry.key.usages[0] === "decrypt",
          extractable: entry?.key?.extractable ?? false,
          exportRejected,
          fence: entry?.fence ?? null,
        });
        db.close();
      };
    };
  }));
}

test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== BASE) await route.abort();
    else await route.continue();
  });
  await page.clock.setFixedTime(new Date("2026-09-27T12:00:00.000Z"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
});

test("remembering is off by default; an opted-in key survives reload and a new tab", async ({ context, page }, testInfo) => {
  const checkbox = page.getByRole("checkbox", { name: "Recordar en este dispositivo" });
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByText(/quien use este navegador podrá abrir la bóveda/iu)).toBeVisible();
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  expect((await rememberedRecord(page)).hasKey).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await unlock(page, true);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  const saved = await rememberedRecord(page);
  expect(saved.digest).toMatch(/^[a-f0-9]{64}$/u);
  expect(saved.decryptOnly).toBe(true);
  expect(saved.extractable).toBe(false);
  expect(saved.exportRejected).toBe(true);
  const local = await page.evaluate(() => Object.entries(localStorage).map(([name, value]) => `${name}:${value}`).join("\n"));
  expect(local).not.toMatch(/synthetic-browser-only-passphrase|"postings"|"analytics"|"accounts"|"budgets"/u);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  const nextTab = await context.newPage();
  try {
    await nextTab.goto("/");
    await expect(nextTab.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  } finally { await nextTab.close(); }
  await page.screenshot({ path: testInfo.outputPath("remembered-ready.png"), animations: "disabled" });
});

test("a different fetched vault and wrong phrase cannot reuse or overwrite the remembered key", async ({ page }, testInfo) => {
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  const original = await rememberedRecord(page);
  await page.route("**/data/app-dataset.vault.json", async (route) => {
    const changed = await route.fetch({ url: `${BASE}/data/u3-budget.vault.json` });
    await route.fulfill({ response: changed });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Recordar en este dispositivo" }).check();
  await unlock(page, false, "incorrect synthetic phrase");
  await expect(page.getByRole("alert")).toContainText("No se pudo abrir la bóveda");
  expect((await rememberedRecord(page)).digest).toBe(original.digest);
  await page.screenshot({ path: testInfo.outputPath("changed-vault-manual.png"), animations: "disabled" });
});

test("explicit lock revokes the key; failed deletion is visible and a marker blocks reload", async ({ page }, testInfo) => {
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  await page.getByRole("button", { name: "Bloquear bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(false);
  expect(await page.evaluate((name) => localStorage.getItem(name), LOCK_MARKER)).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("locked-forgotten.png"), animations: "disabled" });
});

test("a delayed restore in another tab cannot reopen after revocation", async ({ context, page }) => {
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  const nextTab = await context.newPage();
  let release: (() => void) | undefined;
  let intercepted: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => { intercepted = resolve; });
  await nextTab.route("**/data/app-dataset.vault.json", async (route) => {
    intercepted?.();
    await new Promise<void>((resolve) => { release = resolve; });
    await route.continue();
  });
  const navigation = nextTab.goto("/");
  await reached;
  await page.getByRole("button", { name: "Bloquear bóveda" }).click();
  release?.();
  await navigation;
  await expect(nextTab.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await nextTab.close();
});

test("a manual opt-in pending in another tab cannot resave after lock", async ({ context, page }) => {
  const nextTab = await context.newPage();
  await nextTab.goto("/");
  await expect(nextTab.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  let release: (() => void) | undefined;
  let intercepted: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => { intercepted = resolve; });
  await nextTab.route("**/data/app-dataset.vault.json", async (route) => {
    intercepted?.();
    await new Promise<void>((resolve) => { release = resolve; });
    await route.continue();
  });
  const pending = unlock(nextTab, true);
  await reached;
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  await page.getByRole("button", { name: "Bloquear bóveda" }).click();
  release?.();
  await pending;
  await expect(nextTab.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await expect.poll(async () => (await rememberedRecord(nextTab)).hasKey).toBe(false);
  await nextTab.close();
});

test("idle lock forgets remembered access after 15 minutes", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T12:00:00.000Z") });
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  await page.clock.fastForward(15 * 60 * 1_000 + 1);
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
});

test("an aborted real IndexedDB revocation leaves an honest warning and blocks automatic reload", async ({ page }, testInfo) => {
  await unlock(page, true);
  await expect.poll(async () => (await rememberedRecord(page)).hasKey).toBe(true);
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = originalPut.call(this, value, key);
      this.transaction.abort();
      return request;
    };
  });
  await page.getByRole("button", { name: "Bloquear bóveda" }).click();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await expect(page.getByText(/no se pudo confirmar que este dispositivo haya olvidado el acceso/iu)).toBeVisible();
  expect(await page.evaluate((name) => localStorage.getItem(name), LOCK_MARKER)).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  expect((await rememberedRecord(page)).hasKey).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("failed-revoke-locked.png"), animations: "disabled" });
});

test("an aborted real IndexedDB save never claims or retains remembered access", async ({ page }) => {
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = originalPut.call(this, value, key);
      this.transaction.abort();
      return request;
    };
  });
  await unlock(page, true);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  const notice = page.getByText("La bóveda está abierta, pero no se pudo recordar este dispositivo.");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS("display", "block");
  expect((await rememberedRecord(page)).hasKey).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
});

test("unavailable key storage cannot block manual unlock or claim remembered access", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: { open: () => { throw new Error("synthetic unavailable storage"); } },
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await unlock(page, true);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  await expect(page.getByText("La bóveda está abierta, pero no se pudo recordar este dispositivo.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("storage-unavailable.png"), animations: "disabled" });
});

test("a blocked IndexedDB getter cannot prevent manual unlock", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get: () => { throw new DOMException("Synthetic blocked IndexedDB", "SecurityError"); },
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bóveda bloqueada" })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Resumen general" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("blocked-idb-manual.png"), animations: "disabled" });
});
