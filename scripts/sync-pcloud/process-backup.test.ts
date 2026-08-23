import assert from "node:assert/strict";
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import {
    createStaticBuildEnvironment,
    processBackupForStaticRelease,
} from "./process-backup.ts";

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
                    await writeFile(options.outputPath, "encrypted envelope", {
                        mode: 0o600,
                    });
                    return {};
                },
                build: async (input) => {
                    calls.push("build");
                    await assert.rejects(
                        readFile(join(fixture.workspacePath, "app-dataset.json")),
                        /ENOENT/,
                    );
                    assert.equal(
                        await readFile(input.vaultPath, "utf8"),
                        "encrypted envelope",
                    );
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
                            "encrypted envelope",
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
                        await writeFile(options.outputPath, "vault");
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
