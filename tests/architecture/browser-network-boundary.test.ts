import assert from "node:assert/strict";
import test from "node:test";

import config from "../browser/playwright.config.ts";

test("the synthetic browser keeps non-local traffic behind a dead local proxy", () => {
  assert.equal(config.use?.serviceWorkers, "block");
  assert.deepEqual(config.use?.proxy, {
    server: "http://127.0.0.1:9",
    bypass: "127.0.0.1,localhost",
  });
  assert.ok(config.use?.launchOptions?.args?.includes("--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"));
  assert.ok(config.use?.launchOptions?.args?.includes("--disable-background-networking"));
  assert.ok(config.use?.launchOptions?.args?.includes("--disable-component-update"));
});
