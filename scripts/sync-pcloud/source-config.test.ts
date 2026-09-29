import assert from "node:assert/strict";
import test from "node:test";

import { loadPCloudSourceConfig } from "./source-config.ts";

const environment = {
    PCLOUD_API_HOST: "eapi.pcloud.com",
    PCLOUD_FOLDER_ID: "90071992547409930",
    PCLOUD_TOKEN: "  $token'\"ñ  ",
};

test("source-only configuration preserves lossless IDs and literal tokens", () => {
    assert.deepEqual(loadPCloudSourceConfig({ ...environment, PCLOUD_FOLDER_PATH: "" }), {
        apiHost: "eapi.pcloud.com",
        folder: { folderId: "90071992547409930" },
        token: environment.PCLOUD_TOKEN,
    });
    assert.deepEqual(loadPCloudSourceConfig({
        ...environment, PCLOUD_FOLDER_ID: "", PCLOUD_FOLDER_PATH: "/Backups/MyExpenses",
    }).folder, { path: "/Backups/MyExpenses" });
});

test("source validation rejects malformed settings without exposing supplied values", () => {
    for (const patch of [
        { PCLOUD_API_HOST: undefined },
        { PCLOUD_API_HOST: "private.invalid" },
        { PCLOUD_FOLDER_ID: undefined },
        { PCLOUD_FOLDER_ID: "18446744073709551616" },
        { PCLOUD_FOLDER_PATH: "/backup" },
        { PCLOUD_FOLDER_ID: "", PCLOUD_FOLDER_PATH: "/private/../backup" },
        { PCLOUD_TOKEN: undefined },
        { PCLOUD_TOKEN: "" },
        { PCLOUD_TOKEN: "private\ntoken" },
        { PCLOUD_TOKEN: "private\rtoken" },
        { PCLOUD_TOKEN: "private\0token" },
        { PCLOUD_TOKEN: "private\ud800token" },
        { PCLOUD_TOKEN: "private".repeat(1_000) },
    ]) {
        assert.throws(() => loadPCloudSourceConfig({ ...environment, ...patch }),
            (error: unknown) => error instanceof Error && !String(error).includes("private"));
    }
});
