import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeJsonAtomically } from "./files.ts";

test("JSON output limits leave an existing destination untouched", async () => {
    const directory = await mkdtemp(join(tmpdir(), "json-atomic-limit-test-"));
    const outputPath = join(directory, "output.json");
    try {
        await writeFile(outputPath, "existing", { mode: 0o600 });
        await assert.rejects(
            writeJsonAtomically(outputPath, { value: "too large" }, false, 4),
            /exceeds its size limit/iu,
        );
        assert.equal(await readFile(outputPath, "utf8"), "existing");
    } finally {
        await rm(directory, { force: true, recursive: true });
    }
});
