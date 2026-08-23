import assert from "node:assert/strict";
import {
    chmod,
    mkdir,
    mkdtemp,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    loadSyncPCloudConfig,
    loadSyncPCloudSecrets,
} from "./config.ts";

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "sync-pcloud-config-test-"));
    const repositoryRoot = join(root, "repository");
    const deployRoot = join(root, "deploy");
    const tokenFile = join(root, "token");
    const vaultPassphraseFile = join(root, "passphrase");
    const configPath = join(root, "config.json");
    await Promise.all([
        mkdir(repositoryRoot),
        mkdir(deployRoot),
        writeFile(tokenFile, "oauth-token\n", { mode: 0o600 }),
        writeFile(vaultPassphraseFile, "vault-passphrase\n", { mode: 0o600 }),
    ]);
    const config = {
        apiHost: "eapi.pcloud.com",
        folderId: "90071992547409930",
        tokenFile,
        vaultPassphraseFile,
        deployRoot,
        repositoryRoot,
        timeZone: "Europe/Madrid",
    };
    await writeFile(configPath, JSON.stringify(config));
    return { config, configPath, root, tokenFile };
}

test("loads non-secret configuration and private secret files", async () => {
    const value = await fixture();
    try {
        const config = await loadSyncPCloudConfig(value.configPath);
        assert.deepEqual(config, {
            apiHost: "eapi.pcloud.com",
            deployRoot: value.config.deployRoot,
            folder: { folderId: "90071992547409930" },
            repositoryRoot: value.config.repositoryRoot,
            timeZone: "Europe/Madrid",
            tokenFile: value.config.tokenFile,
            vaultPassphraseFile: value.config.vaultPassphraseFile,
        });
        assert.deepEqual(await loadSyncPCloudSecrets(config), {
            token: "oauth-token",
            vaultPassphrase: "vault-passphrase",
        });
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("accepts an absolute folder path instead of folderId", async () => {
    const value = await fixture();
    try {
        const config = {
            ...value.config,
            folderId: undefined,
            path: "/Backups/MyExpenses",
        };
        await writeFile(value.configPath, JSON.stringify(config));
        assert.deepEqual(
            (await loadSyncPCloudConfig(value.configPath)).folder,
            { path: "/Backups/MyExpenses" },
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects symlinked, permissive and multiline secret files", async () => {
    const value = await fixture();
    try {
        const config = await loadSyncPCloudConfig(value.configPath);
        await chmod(value.tokenFile, 0o644);
        await assert.rejects(
            loadSyncPCloudSecrets(config),
            /mode must be 0600/iu,
        );
        await chmod(value.tokenFile, 0o600);
        await writeFile(value.tokenFile, "first\nsecond", { mode: 0o600 });
        await assert.rejects(
            loadSyncPCloudSecrets(config),
            /contains an invalid value/iu,
        );
        const real = join(value.root, "real-token");
        const link = join(value.root, "link-token");
        await writeFile(real, "secret", { mode: 0o600 });
        await symlink(real, link);
        await writeFile(
            value.configPath,
            JSON.stringify({ ...value.config, tokenFile: link }),
        );
        await assert.rejects(
            loadSyncPCloudSecrets(await loadSyncPCloudConfig(value.configPath)),
            /regular non-symlink/iu,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects a configuration writable by group or other users", async () => {
    const value = await fixture();
    try {
        await chmod(value.configPath, 0o666);
        await assert.rejects(
            loadSyncPCloudConfig(value.configPath),
            /must not be writable by group or other users/iu,
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});

test("rejects host, selector and path confinement mistakes", async () => {
    const value = await fixture();
    try {
        const patches = [
            { apiHost: "evil.example" },
            { path: "/also-set" },
            { folderId: undefined },
            { deployRoot: value.config.repositoryRoot },
            { tokenFile: "relative-token" },
            { timeZone: "Mars/Olympus" },
        ];
        await patches.reduce(
            (previous, patch) =>
                previous.then(async () => {
                    await writeFile(
                        value.configPath,
                        JSON.stringify({ ...value.config, ...patch }),
                    );
                    await assert.rejects(
                        loadSyncPCloudConfig(value.configPath),
                    );
                }),
            Promise.resolve(),
        );
    } finally {
        await rm(value.root, { force: true, recursive: true });
    }
});
