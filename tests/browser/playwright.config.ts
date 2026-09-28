import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeLibraryDirectory = process.env.MYEXPENSES_BROWSER_RUNTIME_LIB_DIR;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "../../node_modules/.tmp/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:41789",
    browserName: "chromium",
    timezoneId: "Europe/Madrid",
    serviceWorkers: "block",
    proxy: { server: "http://127.0.0.1:9", bypass: "127.0.0.1,localhost" },
    launchOptions: {
      args: [
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
      ],
      ...(runtimeLibraryDirectory === undefined ? {} : {
        env: { ...process.env, LD_LIBRARY_PATH: runtimeLibraryDirectory },
      }),
    },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "narrow-320", use: { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node node_modules/tsx/dist/cli.mjs tests/browser/synthetic-server.ts",
    cwd: ROOT,
    url: "http://127.0.0.1:41789/",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    timeout: 180_000,
  },
});
