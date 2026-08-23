import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    PCloudClient,
    PCloudError,
    type PCloudFetch,
    type PCloudVerifiedBackupFile,
} from "./pcloud.ts";

type FetchHandler = (
    url: URL,
    init: RequestInit | undefined,
) => Promise<Response> | Response;

function mockFetch(handler: FetchHandler): PCloudFetch {
    return (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
            typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
        );
        return handler(url, init);
    }) as PCloudFetch;
}

function json(value: unknown): Response {
    return new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json" },
        status: 200,
    });
}

function metadata(overrides: Record<string, unknown> = {}) {
    return {
        id: "f10",
        fileid: 10,
        hash: 18_000_000_000_000_000_000,
        isfolder: false,
        modified: 1_787_425_493,
        name: "myexpenses-backup-20260822-210453.zip",
        size: 4,
        ...overrides,
    };
}

test("uses regional Bearer API calls and deterministic backup selection", async () => {
    let calls = 0;
    const fetch = mockFetch((url, init) => {
        calls++;
        assert.equal(url.hostname, "eapi.pcloud.com");
        assert.equal(url.pathname, "/listfolder");
        assert.equal(url.searchParams.get("folderid"), "90071992547409930");
        assert.equal(url.searchParams.get("recursive"), "0");
        assert.equal(url.searchParams.get("showdeleted"), "0");
        assert.equal(url.searchParams.get("timeformat"), "timestamp");
        assert.equal(url.searchParams.has("access_token"), false);
        assert.equal(url.searchParams.has("auth"), false);
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token");
        assert.equal(init?.redirect, "error");
        return json({
            result: 0,
            metadata: {
                isfolder: true,
                contents: [
                    metadata({
                        id: "f99999999999999999",
                        fileid: Number("99999999999999999"),
                    }),
                    metadata({
                        id: "f11",
                        fileid: 11,
                    }),
                    metadata({
                        id: "f12",
                        fileid: 12,
                        isdeleted: true,
                        name: "myexpenses-backup-20260823-000000.zip",
                    }),
                    metadata({ name: "unrelated.zip" }),
                ],
            },
        });
    });
    const client = new PCloudClient({
        apiHost: "eapi.pcloud.com",
        fetch,
        token: "token",
    });
    const latest = await client.listLatestBackup({
        folderId: "90071992547409930",
    });
    assert.equal(calls, 1);
    assert.equal(latest.fileId, "99999999999999999");
});

test("validates folder paths, API hosts and lossless IDs", async () => {
    assert.throws(
        () => new PCloudClient({ apiHost: "evil.example", token: "token" }),
        /outside the allowlist/iu,
    );
    const client = new PCloudClient({
        apiHost: "api.pcloud.com",
        fetch: mockFetch(() => json({ result: 0, metadata: { isfolder: true, contents: [] } })),
        token: "token",
    });
    await assert.rejects(
        client.listLatestBackup({ path: "/safe/../escape" }),
        /safe absolute path/iu,
    );
    const unsafeIdClient = new PCloudClient({
        apiHost: "api.pcloud.com",
        fetch: mockFetch(() =>
            json({
                result: 0,
                metadata: {
                    isfolder: true,
                    contents: [
                        {
                            ...metadata(),
                            id: undefined,
                            fileid: Number("99999999999999999"),
                        },
                    ],
                },
            }),
        ),
        token: "token",
    });
    await assert.rejects(
        unsafeIdClient.listLatestBackup({ folderId: "1" }),
        /must be safe/iu,
    );
});

test("checksums and streams a verified download without forwarding auth", async () => {
    const bytes = new TextEncoder().encode("data");
    const expectedBytes = bytes.slice();
    const sha1 = createHash("sha1").update(bytes).digest("hex");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const calls: string[] = [];
    const fetch = mockFetch((url, init) => {
        calls.push(`${url.hostname}${url.pathname}`);
        if (url.pathname === "/checksumfile") {
            assert.equal(url.hostname, "eapi.pcloud.com");
            assert.equal(url.searchParams.get("fileid"), "10");
            assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token");
            return json({
                result: 0,
                sha1,
                sha256,
                metadata: metadata(),
            });
        }
        if (url.pathname === "/getfilelink") {
            assert.equal(url.searchParams.get("forcedownload"), "1");
            assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token");
            return json({
                result: 0,
                expires: "Thu, 03 Oct 2030 01:06:49 +0000",
                hosts: ["c1.pcloud.com"],
                path: "/content/signed?key=private",
            });
        }
        assert.equal(url.hostname, "c1.pcloud.com");
        assert.equal(new Headers(init?.headers).has("authorization"), false);
        assert.equal(init?.redirect, "error");
        return new Response(new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            },
        }), {
            headers: { "content-length": String(bytes.byteLength) },
        });
    });
    const client = new PCloudClient({
        apiHost: "eapi.pcloud.com",
        fetch,
        now: () => Date.parse("2026-08-23T00:00:00Z"),
        token: "token",
    });
    const verified = await client.getBackupChecksums({
        fileId: "10",
        modifiedEpochSeconds: 1_787_425_493,
        name: "myexpenses-backup-20260822-210453.zip",
        nameTimestamp: "20260822210453",
        size: 4,
    });
    const directory = await mkdtemp(join(tmpdir(), "pcloud-download-test-"));
    const destination = join(directory, "backup.zip");
    try {
        const result = await client.downloadBackup(verified, destination);
        assert.deepEqual(result, {
            bytes: 4,
            path: destination,
            sha1,
            sha256,
        });
        assert.deepEqual(await readFile(destination), Buffer.from(expectedBytes));
        assert.deepEqual(bytes, new Uint8Array(bytes.byteLength));
        assert.equal((await lstat(destination)).mode & 0o777, 0o600);
        assert.deepEqual(calls, [
            "eapi.pcloud.com/checksumfile",
            "eapi.pcloud.com/getfilelink",
            "c1.pcloud.com/content/signed",
        ]);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects SSRF, oversized metadata and partial downloads", async () => {
    const oversizeClient = new PCloudClient({
        apiHost: "api.pcloud.com",
        fetch: mockFetch(() =>
            json({
                result: 0,
                metadata: {
                    isfolder: true,
                    contents: [metadata({ size: 64 * 1024 * 1024 + 1 })],
                },
            }),
        ),
        token: "token",
    });
    await assert.rejects(
        oversizeClient.listLatestBackup({ folderId: "1" }),
        /64 MiB/iu,
    );

    const directory = await mkdtemp(join(tmpdir(), "pcloud-partial-test-"));
    const destination = join(directory, "backup.zip");
    const baseFile: PCloudVerifiedBackupFile = {
        checksumSha1: "a".repeat(40),
        fileId: "10",
        modifiedEpochSeconds: 1,
        name: "myexpenses-backup-20260822-210453.zip",
        nameTimestamp: "20260822210453",
        size: 4,
    };
    try {
        const ssrfClient = new PCloudClient({
            apiHost: "api.pcloud.com",
            fetch: mockFetch((url) => {
                assert.equal(url.pathname, "/getfilelink");
                return json({
                    result: 0,
                    expires: "Thu, 03 Oct 2030 01:06:49 +0000",
                    hosts: ["pcloud.com.evil.example"],
                    path: "/content",
                });
            }),
            now: () => 0,
            token: "token",
        });
        await assert.rejects(
            ssrfClient.downloadBackup(baseFile, destination),
            /outside the allowlist/iu,
        );

        const partialClient = new PCloudClient({
            apiHost: "api.pcloud.com",
            fetch: mockFetch((url) =>
                url.pathname === "/getfilelink"
                    ? json({
                          result: 0,
                          expires: "Thu, 03 Oct 2030 01:06:49 +0000",
                          hosts: ["c1.pcloud.com"],
                          path: "/partial",
                      })
                    : new Response(new Uint8Array([1, 2])),
            ),
            now: () => 0,
            token: "token",
        });
        await assert.rejects(
            partialClient.downloadBackup(baseFile, destination),
            /incomplete/iu,
        );
        assert.equal(
            await lstat(destination).then(
                () => true,
                (error: unknown) =>
                    !(error instanceof Error && "code" in error && error.code === "ENOENT"),
            ),
            false,
        );
        assert.deepEqual(await readdir(directory), []);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("rejects checksum drift before publishing the destination", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const file: PCloudVerifiedBackupFile = {
        checksumSha1: "0".repeat(40),
        fileId: "1",
        modifiedEpochSeconds: 1,
        name: "myexpenses-backup-20260822-210453.zip",
        nameTimestamp: "20260822210453",
        size: bytes.byteLength,
    };
    const client = new PCloudClient({
        apiHost: "api.pcloud.com",
        fetch: mockFetch((url) =>
            url.pathname === "/getfilelink"
                ? json({
                      result: 0,
                      expires: "Thu, 03 Oct 2030 01:06:49 +0000",
                      hosts: ["c1.pcloud.com"],
                      path: "/content",
                  })
                : new Response(bytes, {
                      headers: { "content-length": String(bytes.byteLength) },
                  }),
        ),
        now: () => 0,
        token: "token",
    });
    const directory = await mkdtemp(join(tmpdir(), "pcloud-hash-test-"));
    const destination = join(directory, "backup.zip");
    try {
        await assert.rejects(
            client.downloadBackup(file, destination),
            /SHA-1 disagrees/iu,
        );
        assert.deepEqual(await readdir(directory), []);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("aborts a stalled content download on timeout", async () => {
    const file: PCloudVerifiedBackupFile = {
        checksumSha1: "0".repeat(40),
        fileId: "1",
        modifiedEpochSeconds: 1,
        name: "myexpenses-backup-20260822-210453.zip",
        nameTimestamp: "20260822210453",
        size: 4,
    };
    const client = new PCloudClient({
        apiHost: "api.pcloud.com",
        fetch: mockFetch((url, init) => {
            if (url.pathname === "/getfilelink") {
                return json({
                    result: 0,
                    expires: "Thu, 03 Oct 2030 01:06:49 +0000",
                    hosts: ["c1.pcloud.com"],
                    path: "/stalled",
                });
            }
            return new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener(
                    "abort",
                    () => reject(new DOMException("Aborted", "AbortError")),
                    { once: true },
                );
            });
        }),
        now: () => 0,
        token: "token",
    });
    const directory = await mkdtemp(join(tmpdir(), "pcloud-timeout-test-"));
    try {
        await assert.rejects(
            client.downloadBackup(file, join(directory, "backup.zip"), {
                timeoutMs: 5,
            }),
            /download failed/iu,
        );
        assert.deepEqual(await readdir(directory), []);
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});

test("exposes typed errors without embedding download URLs", () => {
    const error = new PCloudError("pCloud content download failed");
    assert.doesNotMatch(error.message, /https|token|key=/iu);
});
