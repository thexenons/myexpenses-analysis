import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = join(ROOT, "tests/browser/run-isolated.ts");

const invalidConfigurations = [
  {
    name: "relative browser cache",
    variable: "PLAYWRIGHT_BROWSERS_PATH",
    value: "browser-cache",
    diagnostic: /Browser cache must be outside the repository/u,
  },
  {
    name: "repository-internal browser cache",
    variable: "PLAYWRIGHT_BROWSERS_PATH",
    value: join(ROOT, "node_modules/.tmp/browser-cache"),
    diagnostic: /Browser cache must be outside the repository/u,
  },
  {
    name: "relative runtime library directory",
    variable: "MYEXPENSES_BROWSER_RUNTIME_LIB_DIR",
    value: "runtime-libs",
    diagnostic: /Browser runtime library directory must be outside the repository/u,
  },
  {
    name: "repository-internal runtime library directory",
    variable: "MYEXPENSES_BROWSER_RUNTIME_LIB_DIR",
    value: join(ROOT, "node_modules/.tmp/runtime-libs"),
    diagnostic: /Browser runtime library directory must be outside the repository/u,
  },
] as const;

for (const configuration of invalidConfigurations) {
  test(`isolated browser runner rejects ${configuration.name} without allocating source`, async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "browser-runner-config-"));
    const home = join(sandbox, "home");
    const temporary = join(sandbox, "tmp");
    try {
      await mkdir(home);
      await mkdir(temporary);
      const env = {
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        HOME: home,
        TMPDIR: temporary,
        CI: "true",
        TZ: "Europe/Madrid",
        COREPACK_ENABLE_NETWORK: "0",
        PLAYWRIGHT_BROWSERS_PATH: join(sandbox, "browser-cache"),
        [configuration.variable]: configuration.value,
      };
      await assert.rejects(
        execFileAsync(process.execPath, [join(ROOT, "node_modules/tsx/dist/cli.mjs"), RUNNER], {
          cwd: ROOT,
          env,
          timeout: 20_000,
        }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          const failure = error as Error & { code: number; stderr: string };
          assert.equal(typeof failure.code, "number", "runner must exit nonzero");
          assert.notEqual(failure.code, 0);
          assert.match(failure.stderr, configuration.diagnostic);
          return true;
        },
      );
      const sourceDirectories = (await readdir(temporary)).filter((name) => name.startsWith("myexpenses-browser-source-"));
      assert.deepEqual(sourceDirectories, [], "rejected configuration must not create a temporary source");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
}
