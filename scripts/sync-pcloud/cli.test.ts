import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { parseSyncPCloudArguments, runSyncPCloudCli } from "./cli.ts";
import { PCloudClient, type PCloudFetch } from "./pcloud.ts";

const name = "myexpenses-backup-20260822-210453.zip";
const olderName = "myexpenses-backup-20260821-210453.zip";
const bytes = Buffer.from("PK\x03\x04synthetic-backup");
const environment = {
    PCLOUD_API_HOST: "eapi.pcloud.com",
    PCLOUD_FOLDER_ID: "1",
    PCLOUD_TOKEN: "literal # $token",
};

async function fixture(t: TestContext) {
    const cwd = await mkdtemp(join(tmpdir(), "pcloud-local-test-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const data = join(cwd, "data");
    await mkdir(data);
    const output: string[] = [];
    const calls: string[] = [];
    let responseBytes = bytes;
    let beforeContent: (() => Promise<void>) | undefined;
    let contentResponse: (() => Response) | undefined;
    const metadata = {
        id: "f10", fileid: 10, isfolder: false, modified: 1_787_425_493,
        name, size: bytes.length,
    };
    const json = (value: unknown) => new Response(JSON.stringify(value));
    const fetch: PCloudFetch = async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        calls.push(url.pathname);
        if (url.pathname === "/listfolder") {
            assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${environment.PCLOUD_TOKEN}`);
            return json({ result: 0, metadata: { isfolder: true, contents: [
                { ...metadata, id: "f9", fileid: 9, name: olderName }, metadata,
            ] } });
        }
        if (url.pathname === "/checksumfile") return json({
            result: 0, metadata,
            sha1: createHash("sha1").update(bytes).digest("hex"),
            sha256: createHash("sha256").update(bytes).digest("hex"),
        });
        if (url.pathname === "/getfilelink") return json({
            result: 0, hosts: ["c1.pcloud.com"], path: "/content", expires: 2_000_000_000,
        });
        assert.equal(url.pathname, "/content");
        assert.equal(new Headers(init?.headers).has("authorization"), false);
        await beforeContent?.();
        return contentResponse?.() ?? new Response(Buffer.from(responseBytes));
    };
    const dependencies = {
        createClient: (options: { apiHost: string; token: string }) => new PCloudClient({ ...options, fetch }),
    };
    const run = (args: string[] = [], signal?: AbortSignal, env: NodeJS.ProcessEnv = environment) =>
        runSyncPCloudCli(args, dependencies, {
            stdout: (message) => output.push(message), stderr: (message) => output.push(message),
        }, signal, { cwd, environment: env });
    return {
        cwd, data, output, calls, run,
        corrupt: () => { responseBytes = Buffer.alloc(bytes.length, 33); },
        truncate: () => { responseBytes = bytes.subarray(0, 4); },
        beforeContent: (callback: () => Promise<void>) => { beforeContent = callback; },
        contentResponse: (callback: () => Response) => { contentResponse = callback; },
    };
}

test("accepts only optional force, including the pnpm separator", () => {
    assert.deepEqual(parseSyncPCloudArguments([]), { force: false });
    assert.deepEqual(parseSyncPCloudArguments(["--", "--force"]), { force: true });
    assert.throws(() => parseSyncPCloudArguments(["--config", "/tmp/config.json"]));
    assert.throws(() => parseSyncPCloudArguments(["unexpected"]));
});

test("source-only .env downloads the newest original ZIP to data without processing", async (t) => {
    const f = await fixture(t);
    await writeFile(join(f.cwd, ".env"), [
        "PCLOUD_API_HOST=eapi.pcloud.com", "PCLOUD_FOLDER_ID=1", 'PCLOUD_TOKEN="literal # $token"',
    ].join("\n"));
    await writeFile(join(f.data, olderName), "previous backup");
    await writeFile(join(f.data, "app-dataset.json"), "local dataset");
    assert.equal(await f.run([], undefined, {}), 0, f.output.join(""));
    assert.deepEqual(await readFile(join(f.data, name)), bytes);
    assert.equal((await lstat(join(f.data, name))).mode & 0o777, 0o600);
    assert.equal(await readFile(join(f.data, olderName), "utf8"), "previous backup");
    assert.equal(await readFile(join(f.data, "app-dataset.json"), "utf8"), "local dataset");
    assert.deepEqual((await readdir(f.cwd)).sort(), [".env", "data"]);
    assert.deepEqual((await readdir(f.data)).sort(), ["app-dataset.json", olderName, name]);
    assert.match(f.output.join(""), /downloaded/iu);
    assert.doesNotMatch(f.output.join(""), /publication|literal|\$token/iu);
});

test("creates data locally and ignores invalid worker-only settings", async (t) => {
    const f = await fixture(t);
    await rm(f.data, { recursive: true });
    assert.equal(await f.run([], undefined, {
        ...environment,
        MYEXPENSES_VAULT_PASSPHRASE: "x", MYEXPENSES_REPOSITORY_ROOT: "relative",
        MYEXPENSES_DEPLOY_ROOT: "relative", MYEXPENSES_TIME_ZONE: "invalid",
        MYEXPENSES_NOTIFICATION_TO: "invalid", MYEXPENSES_SMTP_PASSWORD: "\n",
        MYEXPENSES_SYNC_INTERVAL_SECONDS: "invalid",
    }), 0, f.output.join(""));
    assert.deepEqual(await readFile(join(f.data, name)), bytes);
});

test("matching local checksums skip download; force re-downloads only the same ZIP", async (t) => {
    const f = await fixture(t);
    assert.equal(await f.run(), 0);
    assert.equal(await f.run(), 0);
    assert.equal(f.calls.filter((call) => call === "/content").length, 1);
    assert.match(f.output.join(""), /already present/iu);
    assert.equal(await f.run(["--force"]), 0);
    assert.equal(f.calls.filter((call) => call === "/content").length, 2);
    assert.deepEqual(await readFile(join(f.data, name)), bytes);
    assert.deepEqual(await readdir(f.data), [name]);
});

test("different same-name content fails safely unless force is explicit", async (t) => {
    const f = await fixture(t);
    const original = Buffer.alloc(bytes.length, 42);
    await writeFile(join(f.data, name), original);
    assert.equal(await f.run(), 1);
    assert.deepEqual(await readFile(join(f.data, name)), original);
    assert.equal(f.calls.includes("/content"), false);
    assert.match(f.output.join(""), /--force/);
    assert.equal(await f.run(["--force"]), 0);
    assert.deepEqual(await readFile(join(f.data, name)), bytes);
});

for (const failure of ["checksum", "partial"] as const) {
    test(`${failure} failure leaves existing data intact and removes staging`, async (t) => {
        const f = await fixture(t);
        await writeFile(join(f.data, name), "original");
        if (failure === "checksum") f.corrupt(); else f.truncate();
        assert.equal(await f.run(["--force"]), 1);
        assert.equal(await readFile(join(f.data, name), "utf8"), "original");
        assert.deepEqual(await readdir(f.data), [name]);
        assert.match(f.output.join(""), failure === "checksum" ? /SHA-1/ : /incomplete/);
    });
}

test("cancellation before publication preserves the old backup and cleans staging", async (t) => {
    const f = await fixture(t);
    const controller = new AbortController();
    await writeFile(join(f.data, name), "original");
    f.beforeContent(async () => { controller.abort(); });
    assert.equal(await f.run(["--force"], controller.signal), 1);
    assert.equal(await readFile(join(f.data, name), "utf8"), "original");
    assert.deepEqual(await readdir(f.data), [name]);
});

test("pre-cancelled operations make no network request", async (t) => {
    const f = await fixture(t);
    assert.equal(await f.run([], AbortSignal.abort()), 1);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(await readdir(f.data), []);
});

test("a competing destination is not overwritten without force", async (t) => {
    const f = await fixture(t);
    f.beforeContent(() => writeFile(join(f.data, name), "concurrent backup"));
    assert.equal(await f.run(), 1);
    assert.equal(await readFile(join(f.data, name), "utf8"), "concurrent backup");
    assert.deepEqual(await readdir(f.data), [name]);
});

for (const target of ["data symlink", "data file", "backup symlink", "backup directory"] as const) {
    test(`rejects ${target} even with force`, async (t) => {
        const f = await fixture(t);
        const outside = join(f.cwd, "outside");
        await mkdir(outside);
        await writeFile(join(outside, "original"), "untouched");
        if (target.startsWith("data")) {
            await rm(f.data, { recursive: true });
            if (target === "data symlink") await symlink(outside, f.data);
            else await writeFile(f.data, "untouched");
        } else if (target === "backup symlink") {
            await symlink(join(outside, "original"), join(f.data, name));
        } else await mkdir(join(f.data, name));
        assert.equal(await f.run(["--force"]), 1);
        assert.equal(f.calls.includes("/content"), false);
        assert.equal(await readFile(join(outside, "original"), "utf8"), "untouched");
    });
}

test("rejects a symlink introduced during download without touching its target", async (t) => {
    const f = await fixture(t);
    const outside = join(f.cwd, "original");
    await writeFile(outside, "untouched");
    f.beforeContent(() => symlink(outside, join(f.data, name)));
    assert.equal(await f.run(["--force"]), 1);
    assert.equal(await readFile(outside, "utf8"), "untouched");
    assert.equal((await lstat(join(f.data, name))).isSymbolicLink(), true);
    assert.deepEqual(await readdir(f.data), [name]);
});

test("never logs unknown download failures or configured secrets", async (t) => {
    const f = await fixture(t);
    f.beforeContent(async () => { throw new Error("literal # $token https://c1.pcloud.com/file?key=private"); });
    assert.equal(await f.run(), 1);
    assert.doesNotMatch(f.output.join(""), /literal|\$token|key=private|c1\.pcloud/);
    assert.deepEqual(await readdir(f.data), []);
    f.output.length = 0;
    assert.equal(await f.run([], undefined, { ...environment, PCLOUD_TOKEN: "" }), 1);
    assert.match(f.output.join(""), /PCLOUD_TOKEN is missing or invalid/);
});

test("a failed stream removes partial bytes without replacing an existing backup", async (t) => {
    const f = await fixture(t);
    await writeFile(join(f.data, name), "original");
    f.contentResponse(() => {
        let reads = 0;
        return new Response(new ReadableStream({
            pull(controller) {
                if (reads++ === 0) controller.enqueue(Uint8Array.from(bytes.subarray(0, 4)));
                else controller.error(new Error("private signed URL"));
            },
        }));
    });
    assert.equal(await f.run(["--force"]), 1);
    assert.equal(await readFile(join(f.data, name), "utf8"), "original");
    assert.deepEqual(await readdir(f.data), [name]);
    assert.doesNotMatch(f.output.join(""), /private signed URL/);
});
