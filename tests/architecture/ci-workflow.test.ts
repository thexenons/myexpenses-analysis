import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("repository CI runs locked checks and isolated synthetic browser coverage", async () => {
    const workflow = await readFile(join(root, ".github/workflows/ci.yml"), "utf8");
    assert.match(workflow, /^permissions:\n  contents: read$/mu);
    assert.match(workflow, /^  checks:\n/mu);
    assert.match(workflow, /^  browser-smoke:\n/mu);
    for (const setting of ["persist-credentials: false", "require-lockfile: true", "runtime: node@24"]) {
        assert.equal(workflow.split(setting).length - 1, 2, `${setting} must apply to both jobs`);
    }
    for (const command of ["pnpm lint", "pnpm type-check", "pnpm test:node", "pnpm test:ui", "pnpm test:deployment"]) {
        assert.ok(workflow.includes(`run: ${command}`), `${command} must run in CI`);
    }
    assert.match(workflow, /playwright install --with-deps --only-shell chromium/u);
    assert.match(workflow, /tests\/browser\/run-isolated\.ts/u);
    assert.match(workflow, /--project=desktop --project=mobile-390/u);
    assert.match(workflow, /unlocks a synthetic vault/u);
    assert.match(workflow, /keeps VOID out of scoped transaction counts/u);
    assert.match(workflow, /explains linear budget allowance/u);
    assert.doesNotMatch(workflow, /pull_request_target|secrets\.|MYEXPENSES_PERF_COUNT|data\/|backups\/|\.env/u);
});
