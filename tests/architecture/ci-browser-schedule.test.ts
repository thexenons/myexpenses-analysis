import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const smokeName = "Synthetic vault, VOID and budget pace on desktop and mobile";
const fullName = "Full synthetic browser regression on all three viewports";

function job(name: string): string {
  const body = workflow.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:|(?![\\s\\S]))`, "mu"))?.[1];
  assert.ok(body, `Missing CI job: ${name}`);
  return body;
}

function step(name: string): string {
  const body = workflow.match(new RegExp(`^      - name: ${name}\\n([\\s\\S]*?)(?=^      - |(?![\\s\\S]))`, "mu"))?.[1];
  assert.ok(body, `Missing CI step: ${name}`);
  return body;
}

// Interpret only the explicit event-name OR comparisons supported by this workflow.
function selects(body: string, event: string): boolean {
  const expression = body.match(/^\s+if: (.+)$/mu)?.[1];
  assert.ok(expression, "An explicit event selector must guard this job or step");
  const comparisons = expression.split(" || ");
  return comparisons.map((comparison) => {
    const match = /^github\.event_name == '([a-z_]+)'$/u.exec(comparison);
    assert.ok(match, `Unexpected event-selector syntax: ${comparison}`);
    return match[1] === event;
  }).some(Boolean);
}

test("CI offers a weekly scheduled and manual full-browser run", () => {
  assert.match(workflow, /^on:\n  push:\n  pull_request:\n  schedule:\n    - cron: "17 4 \* \* 1"\n  workflow_dispatch:/mu);
});

for (const event of ["push", "pull_request", "schedule", "workflow_dispatch", "release"]) {
  test(`CI selects the appropriate quick or full checks for ${event}`, () => {
    const quick = event === "push" || event === "pull_request";
    const full = event === "schedule" || event === "workflow_dispatch";
    assert.equal(selects(job("checks"), event), quick);
    assert.equal(selects(step(smokeName), event), quick);
    assert.equal(selects(step(fullName), event), full);
  });
}

test("full regression uses every configured viewport without narrowing the suite", () => {
  assert.match(step(fullName), /^        run: pnpm test:browser$/mu);
  assert.doesNotMatch(step(fullName), /--grep|--project|MYEXPENSES_PERF_COUNT/u);
  assert.match(step(smokeName), /--project=desktop --project=mobile-390/u);
  assert.match(step(smokeName), /--grep="unlocks a synthetic vault\|keeps VOID out of scoped transaction counts\|explains linear budget allowance"/u);
  const config = readFileSync(new URL("../browser/playwright.config.ts", import.meta.url), "utf8");
  for (const viewport of ["desktop", "mobile-390", "narrow-320"]) {
    assert.ok(config.includes(`name: "${viewport}"`), `Missing viewport: ${viewport}`);
  }
});

test("scheduled browsers retain the existing isolated CI security and resource limits", () => {
  const browser = job("browser-smoke");
  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  assert.match(browser, /^    timeout-minutes: 35$/mu);
  assert.match(browser, /persist-credentials: false/u);
  assert.match(browser, /require-lockfile: true/u);
  assert.match(browser, /playwright install --with-deps --only-shell chromium/u);
  for (const action of workflow.matchAll(/uses: (.+)$/gmu)) {
    assert.match(action[1]!, /@[a-f0-9]{40} /u, "CI actions must remain SHA-pinned");
  }
  assert.doesNotMatch(workflow, /pull_request_target|secrets\.|data\/|backups\/|\.env/u);
});
