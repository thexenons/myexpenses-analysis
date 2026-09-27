import assert from "node:assert/strict";
import {
    access,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { encryptCompressedDataset, serializeStaticVaultEnvelope } from "../../src/domain/security/static-vault.ts";

import {
    createStaticBuildEnvironment,
    executeStaticBuildChild,
    processBackupForStaticRelease,
} from "./process-backup.ts";
import { acquireSyncLease, SyncLeaseBusyError } from "./lease.ts";

async function fixtureDirectories(): Promise<{
    readonly repositoryRoot: string;
    readonly root: string;
    readonly workspacePath: string;
}> {
    const root = await mkdtemp(join(tmpdir(), "myexpenses-static-release-"));
    const repositoryRoot = join(root, "repository");
    const workspacePath = join(root, "workspace");
    await Promise.all([
        mkdir(repositoryRoot, { mode: 0o700 }),
        mkdir(workspacePath, { mode: 0o700 }),
    ]);
    await writeFile(
        join(repositoryRoot, "package.json"),
        JSON.stringify({ name: "myexpenses-analysis" }),
        { encoding: "utf8", mode: 0o600 },
    );
    return { repositoryRoot, root, workspacePath };
}

async function writeSyntheticVault(path: string): Promise<void> {
    const compressed = Uint8Array.of(31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const envelope = await encryptCompressedDataset(compressed, "correct horse battery staple", globalThis.crypto);
    await writeFile(path, serializeStaticVaultEnvelope(envelope), { mode: 0o600 });
}

test("passes only an allowlisted environment to build tooling", () => {
    const environment = createStaticBuildEnvironment(
        {
            CI: "true",
            HOME: "/srv/myexpenses",
            LANG: "es_ES.UTF-8",
            PATH: "/usr/bin",
            PCLOUD_ACCESS_TOKEN: "must-not-leak",
            VAULT_PASSPHRASE: "must-not-leak-either",
            VITE_UNREVIEWED_VALUE: "must-not-be-injected",
        },
        "/private/workspace/app-dataset.vault.json",
    );

    assert.deepEqual(environment, {
        CI: "true",
        HOME: "/srv/myexpenses",
        LANG: "es_ES.UTF-8",
        MYEXPENSES_VAULT_SOURCE_PATH:
            "/private/workspace/app-dataset.vault.json",
        NODE_ENV: "production",
        PATH: "/usr/bin",
    });
    assert.deepEqual(createStaticBuildEnvironment({
        PATH: "/usr/bin",
        MYEXPENSES_VERIFIED_VAULT_SHA256: "0".repeat(64),
        MYEXPENSES_VAULT_PASSPHRASE: "must-not-leak",
        VITE_SYNTHETIC_CANARY: "must-not-leak",
    }, "/private/workspace/app-dataset.vault.json", "a".repeat(64)), {
        MYEXPENSES_VAULT_SOURCE_PATH: "/private/workspace/app-dataset.vault.json",
        MYEXPENSES_VERIFIED_VAULT_SHA256: "a".repeat(64),
        NODE_ENV: "production",
        PATH: "/usr/bin",
    });
});

test("build child holds the lease descriptor after parent closes it", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-child-lease-"));
    const script = join(root, "hold.mjs");
    const lease = await acquireSyncLease(root);
    try {
        await writeFile(script, "process.send?.('ready'); setTimeout(() => {}, 250);");
        const running = executeStaticBuildChild(script, [], {
            cwd: root,
            leaseFd: lease.fd,
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
        await lease.close();
        await assert.rejects(acquireSyncLease(root), SyncLeaseBusyError);
        await running;
        const next = await acquireSyncLease(root);
        await next.close();
    } finally {
        await lease.close();
        await rm(root, { force: true, recursive: true });
    }
});

test("aborting a build awaits child exit before returning", async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-child-abort-"));
    const script = join(root, "wait.mjs");
    const started = join(root, "started");
    const exited = join(root, "exited");
    const controller = new AbortController();
    try {
        await writeFile(script, `import { writeFileSync } from 'node:fs';
process.on('SIGTERM', () => { setTimeout(() => { writeFileSync(${JSON.stringify(exited)}, 'yes'); process.exit(0); }, 50); });
writeFileSync(${JSON.stringify(started)}, 'yes');
setInterval(() => {}, 1000);`);
        const running = executeStaticBuildChild(script, [], {
            cwd: root,
            signal: controller.signal,
        });
        for (let attempt = 0; attempt < 100; attempt++) {
            // oxlint-disable-next-line no-await-in-loop -- wait for the child to install its TERM handler.
            if (await access(started).then(() => true, () => false)) break;
            // oxlint-disable-next-line no-await-in-loop -- bounded fixture readiness poll.
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await access(started);
        controller.abort();
        await assert.rejects(running);
        assert.equal(await readFile(exited, "utf8"), "yes");
    } finally {
        controller.abort();
        await rm(root, { force: true, recursive: true });
    }
});

test("abort waits for SIGTERM-resistant descendants after the direct child exits", { timeout: 5_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-child-group-abort-"));
    const parentScript = join(root, "parent.mjs");
    const grandchildScript = join(root, "grandchild.mjs");
    const ready = join(root, "ready.json");
    const controller = new AbortController();
    const processState = async (pid: number) => {
        const raw = await readFile(`/proc/${pid}/stat`, "utf8").catch(() => undefined);
        if (raw === undefined) return undefined;
        const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
        return { state: fields[0], group: Number(fields[2]), start: fields[19] };
    };
    let grandchildPid: number | undefined;
    let grandchildStart: string | undefined;
    try {
        await writeFile(grandchildScript, `import { writeFileSync } from 'node:fs';
process.on('SIGTERM', () => {});
writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid }));
setInterval(() => {}, 1000);`);
        await writeFile(parentScript, `import { spawn } from 'node:child_process';
process.on('SIGTERM', () => process.exit(0));
spawn(process.execPath, [${JSON.stringify(grandchildScript)}], {
  stdio: 'ignore', detached: false,
}).unref();
setInterval(() => {}, 1000);`);
        const running = executeStaticBuildChild(parentScript, [], {
            cwd: root,
            signal: controller.signal,
            terminationGraceMs: 100,
        });
        for (let attempt = 0; attempt < 100; attempt++) {
            // oxlint-disable-next-line no-await-in-loop -- wait for descendant readiness before cancellation.
            if (await access(ready).then(() => true, () => false)) break;
            // oxlint-disable-next-line no-await-in-loop -- bounded fixture readiness poll.
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        grandchildPid = JSON.parse(await readFile(ready, "utf8")).pid as number;
        const before = await processState(grandchildPid);
        assert.ok(before !== undefined && before.state !== "Z");
        grandchildStart = before.start;
        controller.abort();
        await assert.rejects(running, /interrupted/iu);
        const after = await processState(grandchildPid);
        assert.ok(after === undefined || after.start !== grandchildStart ||
            after.state === "Z" || after.state === "X", "live descendant outlived build shutdown");
    } finally {
        controller.abort();
        if (grandchildPid !== undefined) {
            const state = await processState(grandchildPid);
            if (state !== undefined && state.start === grandchildStart &&
                state.state !== "Z" && state.state !== "X") {
                process.kill(grandchildPid, "SIGKILL");
            }
        }
        await rm(root, { force: true, recursive: true });
    }
});

test("normal direct-child exit cannot leave a live same-group writer", { timeout: 5_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), "sync-child-normal-exit-"));
    const grandchildScript = join(root, "grandchild.mjs");
    const parentScript = join(root, "parent.mjs");
    const ready = join(root, "ready.json");
    let grandchildPid: number | undefined;
    let grandchildStart: string | undefined;
    try {
        await writeFile(grandchildScript, `import { writeFileSync } from 'node:fs';
process.on('SIGTERM', () => {});
writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid }));
setInterval(() => {}, 1000);`);
        await writeFile(parentScript, `import { spawn } from 'node:child_process';
const child = spawn(process.execPath, [${JSON.stringify(grandchildScript)}], {
  stdio: 'ignore', detached: false,
});
child.unref();
setTimeout(() => process.exit(0), 75);`);
        const running = executeStaticBuildChild(parentScript, [], {
            cwd: root,
            terminationGraceMs: 100,
        });
        for (let attempt = 0; attempt < 100; attempt++) {
            // oxlint-disable-next-line no-await-in-loop -- wait for the descendant identity before its parent exits.
            if (await access(ready).then(() => true, () => false)) break;
            // oxlint-disable-next-line no-await-in-loop -- bounded fixture readiness poll.
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        grandchildPid = JSON.parse(await readFile(ready, "utf8")).pid as number;
        const before = await readFile(`/proc/${grandchildPid}/stat`, "utf8");
        grandchildStart = before.slice(before.lastIndexOf(")") + 2).split(" ")[19];
        await assert.rejects(running, /interrupted/iu);
        const raw = await readFile(`/proc/${grandchildPid}/stat`, "utf8").catch(() => undefined);
        const fields = raw?.slice(raw.lastIndexOf(")") + 2).split(" ");
        assert.ok(fields === undefined || fields[19] !== grandchildStart ||
            fields[0] === "Z" || fields[0] === "X");
    } finally {
        if (grandchildPid !== undefined) {
            const raw = await readFile(`/proc/${grandchildPid}/stat`, "utf8").catch(() => undefined);
            const fields = raw?.slice(raw.lastIndexOf(")") + 2).split(" ");
            if (fields !== undefined && fields[19] === grandchildStart &&
                fields[0] !== "Z" && fields[0] !== "X") {
                process.kill(grandchildPid, "SIGKILL");
            }
        }
        await rm(root, { force: true, recursive: true });
    }
});

test("imports, encrypts and builds without leaving plaintext in the release", async () => {
    const fixture = await fixtureDirectories();
    const calls: string[] = [];
    try {
        const result = await processBackupForStaticRelease(
            {
                backupPath: join(fixture.workspacePath, "source.zip"),
                repositoryRoot: fixture.repositoryRoot,
                timeZone: "Europe/Madrid",
                vaultPassphrase: "correct horse battery staple",
                workspacePath: fixture.workspacePath,
            },
            undefined,
            {
                import: async (options) => {
                    calls.push(`import:${options.timeZone}`);
                    await writeFile(options.outputPath, "private plaintext", {
                        mode: 0o600,
                    });
                    return {};
                },
                encrypt: async (options) => {
                    calls.push("encrypt");
                    assert.equal(
                        await readFile(options.inputPath, "utf8"),
                        "private plaintext",
                    );
                    await writeSyntheticVault(options.outputPath);
                    return {};
                },
                build: async (input) => {
                    calls.push("build");
                    await assert.rejects(
                        readFile(join(fixture.workspacePath, "app-dataset.json")),
                        /ENOENT/,
                    );
                    const vault = await readFile(input.vaultPath);
                    assert.equal(input.verifiedVaultSha256, createHash("sha256").update(vault).digest("hex"));
                    await mkdir(join(input.outputDirectory, "data"), {
                        recursive: true,
                    });
                    await Promise.all([
                        writeFile(
                            join(input.outputDirectory, "index.html"),
                            "<html></html>",
                        ),
                        writeFile(
                            join(
                                input.outputDirectory,
                                "data",
                                "app-dataset.vault.json",
                            ),
                            vault,
                        ),
                    ]);
                },
            },
        );

        assert.deepEqual(calls, ["import:Europe/Madrid", "encrypt", "build"]);
        assert.equal(result.buildDirectory, join(fixture.workspacePath, "static-release"));
    } finally {
        await rm(fixture.root, { force: true, recursive: true });
    }
});

test("rejects a build that publishes any plaintext data artifact", async () => {
    const fixture = await fixtureDirectories();
    try {
        await assert.rejects(
            processBackupForStaticRelease(
                {
                    backupPath: join(fixture.workspacePath, "source.zip"),
                    repositoryRoot: fixture.repositoryRoot,
                    timeZone: "Europe/Madrid",
                    vaultPassphrase: "correct horse battery staple",
                    workspacePath: fixture.workspacePath,
                },
                undefined,
                {
                    import: async (options) => {
                        await writeFile(options.outputPath, "plaintext");
                        return {};
                    },
                    encrypt: async (options) => {
                        await writeSyntheticVault(options.outputPath);
                        return {};
                    },
                    build: async (input) => {
                        await mkdir(join(input.outputDirectory, "data"), {
                            recursive: true,
                        });
                        await Promise.all([
                            writeFile(join(input.outputDirectory, "index.html"), "ok"),
                            writeFile(
                                join(
                                    input.outputDirectory,
                                    "data",
                                    "app-dataset.vault.json",
                                ),
                                "vault",
                            ),
                            writeFile(
                                join(
                                    input.outputDirectory,
                                    "data",
                                    "app-dataset.json",
                                ),
                                "plaintext",
                            ),
                        ]);
                    },
                },
            ),
            /unexpected private data artifact/,
        );
    } finally {
        await rm(fixture.root, { force: true, recursive: true });
    }
});

test("sync refuses an unauthenticated vault before invoking its builder", async () => {
    const fixture = await fixtureDirectories();
    let built = false;
    try {
        await assert.rejects(processBackupForStaticRelease({
            backupPath: join(fixture.workspacePath, "source.zip"),
            repositoryRoot: fixture.repositoryRoot,
            timeZone: "Europe/Madrid",
            vaultPassphrase: "another valid but incorrect phrase",
            workspacePath: fixture.workspacePath,
        }, undefined, {
            import: async (options) => {
                await writeFile(options.outputPath, "synthetic plaintext", { mode: 0o600 });
                return {};
            },
            encrypt: async (options) => {
                await writeSyntheticVault(options.outputPath);
                return {};
            },
            build: async () => { built = true; },
        }), /authentication failed/iu);
        assert.equal(built, false);
    } finally {
        await rm(fixture.root, { force: true, recursive: true });
    }
});

test("sync rejects output vault bytes that differ from the authenticated input", async () => {
    const fixture = await fixtureDirectories();
    try {
        await assert.rejects(processBackupForStaticRelease({
            backupPath: join(fixture.workspacePath, "source.zip"),
            repositoryRoot: fixture.repositoryRoot,
            timeZone: "Europe/Madrid",
            vaultPassphrase: "correct horse battery staple",
            workspacePath: fixture.workspacePath,
        }, undefined, {
            import: async (options) => {
                await writeFile(options.outputPath, "synthetic plaintext", { mode: 0o600 });
                return {};
            },
            encrypt: async (options) => {
                await writeSyntheticVault(options.outputPath);
                return {};
            },
            build: async (input) => {
                await mkdir(join(input.outputDirectory, "data"), { recursive: true });
                await writeFile(join(input.outputDirectory, "index.html"), "ok");
                await writeFile(join(input.outputDirectory, "data", "app-dataset.vault.json"), "different bytes");
            },
        }), /different from its authenticated source/iu);
    } finally {
        await rm(fixture.root, { force: true, recursive: true });
    }
});

test("honours cancellation before touching the repository or backup", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        processBackupForStaticRelease(
            {
                backupPath: "/not/read.zip",
                repositoryRoot: "/not/read",
                timeZone: "UTC",
                vaultPassphrase: "correct horse battery staple",
                workspacePath: "/not/read",
            },
            controller.signal,
        ),
        (error: unknown) =>
            error instanceof Error && error.name === "AbortError",
    );
});
