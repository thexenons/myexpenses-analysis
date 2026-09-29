import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadSyncPCloudCliEnvironment } from "./cli-environment.ts";

test("loads cwd .env with native quoting and exported values taking precedence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pcloud-env-test-"));
    try {
        await writeFile(join(cwd, ".env"), [
            'PCLOUD_TOKEN="literal # $TOKEN" # comment',
            "MYEXPENSES_VAULT_PASSPHRASE='  literal passphrase  '",
            "PCLOUD_API_HOST=api.pcloud.com",
            "PCLOUD_FOLDER_ID=123",
        ].join("\n"));
        const environment = { PCLOUD_API_HOST: "eapi.pcloud.com", PCLOUD_FOLDER_ID: "" };
        const result = await loadSyncPCloudCliEnvironment({ cwd, environment });
        assert.equal(result.PCLOUD_TOKEN, "literal # $TOKEN");
        assert.equal(result.MYEXPENSES_VAULT_PASSPHRASE, "  literal passphrase  ");
        assert.equal(result.PCLOUD_API_HOST, "eapi.pcloud.com");
        assert.equal(result.PCLOUD_FOLDER_ID, "");
        assert.deepEqual(environment, { PCLOUD_API_HOST: "eapi.pcloud.com", PCLOUD_FOLDER_ID: "" });
    } finally {
        await rm(cwd, { recursive: true, force: true });
    }
});

test("missing .env uses only the supplied environment; other read errors fail safely", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pcloud-env-private-"));
    try {
        assert.deepEqual(await loadSyncPCloudCliEnvironment({ cwd, environment: { PCLOUD_TOKEN: "exported" } }), { PCLOUD_TOKEN: "exported" });
        await mkdir(join(cwd, ".env"));
        await assert.rejects(loadSyncPCloudCliEnvironment({ cwd, environment: {} }), (error: Error) => {
            assert.equal(error.message, "The .env file could not be loaded");
            assert.equal(error.cause, undefined);
            assert.doesNotMatch(error.message, /pcloud-env-private/);
            return true;
        });
    } finally {
        await rm(cwd, { recursive: true, force: true });
    }
});
