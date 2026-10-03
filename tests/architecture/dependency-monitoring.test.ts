import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  const url = new URL(`../../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const dependabot = source(".github/dependabot.yml");
const workflow = source(".github/workflows/dependency-monitoring.yml");
const documentation = source("docs/dependency-monitoring.md");

function step(name: string): string {
  const body = workflow.match(new RegExp(`^      - name: ${name}\\n([\\s\\S]*?)(?=^      - |(?![\\s\\S]))`, "mu"))?.[1];
  assert.ok(body, `Missing monitoring step: ${name}`);
  return body;
}

test("Dependabot proposes only supported, weekly grouped action updates with a small PR cap", () => {
  assert.match(dependabot, /^version: 2$/mu);
  assert.deepEqual([...dependabot.matchAll(/package-ecosystem: "([^"]+)"/gu)].map((match) => match[1]), ["github-actions"]);
  assert.match(dependabot, /directory: "\/"/u);
  assert.match(dependabot, /interval: "weekly"/u);
  assert.match(dependabot, /open-pull-requests-limit: 2/u);
  assert.match(dependabot, /groups:\n      github-actions:\n        patterns:\n          - "\*"/u);
});

test("package monitoring is weekly and manual, not additional push or PR work", () => {
  assert.match(workflow, /^on:\n  schedule:\n    - cron: "37 5 \* \* 1"\n  workflow_dispatch:/mu);
  assert.doesNotMatch(workflow, /^\s+(?:push|pull_request|pull_request_target):/mu);
});

test("monitoring preserves locked setup, SHA-pinned actions, least privilege and timeout", () => {
  assert.match(workflow, /^permissions:\n  contents: read$/mu);
  assert.match(workflow, /^    runs-on: ubuntu-24.04$/mu);
  assert.match(workflow, /^    timeout-minutes: 15$/mu);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /id: setup/u);
  assert.match(workflow, /runtime: node@24/u);
  assert.match(workflow, /require-lockfile: true/u);
  const actions = [...workflow.matchAll(/uses: (.+)$/gmu)];
  assert.equal(actions.length, 2);
  for (const action of actions) assert.match(action[1]!, /@[a-f0-9]{40} /u);
});

test("both unfiltered JSON reports preserve native failure signals", () => {
  assert.match(step("Outdated package report"), /^        run: pnpm outdated --json$/mu);
  assert.match(step("Security advisory report"), /^        run: pnpm audit --json$/mu);
  assert.doesNotMatch(workflow, /continue-on-error|ignore-registry-errors|ignore-unfixable|--prod|--dev|--no-optional|--fix|\|\|\s*true/u);
  assert.doesNotMatch(workflow, /pnpm (?:update|add)|auto-merge|gh pr merge|secrets\.|data\/|backups\/|\.env/u);
});

test("the advisory report remains eligible after an outdated report failure", () => {
  const advisory = step("Security advisory report");
  // A status function overrides Actions' implicit success() after a prior step failure.
  assert.match(advisory, /^        if: always\(\) && steps\.setup\.outcome == 'success'$/mu);
  assert.ok(workflow.indexOf("name: Outdated package report") < workflow.indexOf("name: Security advisory report"));
});

test("maintainers can distinguish support gaps, updates, advisories and registry errors", () => {
  const manifest = JSON.parse(source("package.json")) as { packageManager: string };
  assert.equal(manifest.packageManager, "pnpm@12.6.0");
  for (const phrase of ["pnpm 12.6.0", "pnpm versions 7–10", "exit 1", "registry", "No automatic updates", "Actions logs"]) {
    assert.ok(documentation.includes(phrase), `Missing monitoring guidance: ${phrase}`);
  }
  assert.match(documentation, /https:\/\/docs\.github\.com\/en\/code-security\/reference\/supply-chain-security\/supported-ecosystems-and-repositories/u);
});
