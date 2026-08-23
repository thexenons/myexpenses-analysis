import assert from "node:assert/strict";
import test from "node:test";

import { gzipDataset, gunzipDataset } from "./compression.ts";

test("gzip round-trips dataset bytes", async () => {
    const source = new TextEncoder().encode(
        JSON.stringify({ fixture: "private-data".repeat(100) }),
    );
    const compressed = await gzipDataset(source);
    const restored = await gunzipDataset(compressed);

    assert.deepEqual(Buffer.from(restored), Buffer.from(source));
    assert.equal(compressed[0], 0x1f);
    assert.equal(compressed[1], 0x8b);
});

test("gunzip rejects output that exceeds the configured decompression cap", async () => {
    const source = new TextEncoder().encode("decompression-limit".repeat(20));
    const compressed = await gzipDataset(source);

    await assert.rejects(
        gunzipDataset(compressed, { maxDecompressedBytes: 32 }),
        /invalid or exceeds its output limit/iu,
    );
});

test("compression rejects input and output limits before encryption", async () => {
    await assert.rejects(
        gzipDataset(new Uint8Array(33), { maxDecompressedBytes: 32 }),
        /uncompressed size limit/iu,
    );
    await assert.rejects(
        gzipDataset(new TextEncoder().encode("incompressible-ish"), {
            maxCompressedBytes: 1,
        }),
        /vault limit/iu,
    );
});
