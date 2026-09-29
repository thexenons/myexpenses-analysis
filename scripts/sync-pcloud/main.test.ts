import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("entrypoint automatically reads cwd .env and sanitizes failures without network", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pcloud-main-test-"));
    const main = fileURLToPath(new URL("./main.ts", import.meta.url));
    const run = (...args: string[]) => spawnSync(process.execPath, [main, ...args], {
        cwd, env: {}, encoding: "utf8", timeout: 10_000,
    });
    try {
        await writeFile(join(cwd, ".env"), "PCLOUD_FOLDER_ID=1\nPCLOUD_API_HOST=private-invalid-host\n");
        const invalid = run();
        assert.equal(invalid.status, 1);
        assert.match(invalid.stderr, /Runtime pCloud settings are invalid/);
        assert.doesNotMatch(invalid.stderr, /private-invalid-host/);
        const obsolete = run("--config", "private-path");
        assert.equal(obsolete.status, 1);
        assert.doesNotMatch(obsolete.stderr, /private-path/);
        await writeFile(join(cwd, ".env"),
            "PCLOUD_API_HOST=eapi.pcloud.com\nPCLOUD_FOLDER_ID=1\nPCLOUD_TOKEN=synthetic-token\n");
        await mkdir(join(cwd, "outside"));
        await symlink(join(cwd, "outside"), join(cwd, "data"));
        const local = run();
        assert.equal(local.status, 1);
        assert.match(local.stderr, /project data path must be a directory/);
        assert.doesNotMatch(local.stderr, /synthetic-token|VAULT|deployment/);
        await rm(join(cwd, ".env"));
        await mkdir(join(cwd, ".env"));
        const unreadable = run();
        assert.equal(unreadable.status, 1);
        assert.match(unreadable.stderr, /The \.env file could not be loaded/);
        assert.doesNotMatch(unreadable.stderr, /pcloud-main-test/);
    } finally {
        await rm(cwd, { recursive: true, force: true });
    }
});
