import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicAppRevision } from "./public-revision.ts";

test("publishes only a validated public hex revision", () => {
    assert.equal(resolvePublicAppRevision(undefined, "ABCDEF1234567"), "abcdef1234567");
    assert.equal(resolvePublicAppRevision("", "ABCDEF1234567"), "abcdef1234567");
    assert.equal(resolvePublicAppRevision("fedcba9876543", "ABCDEF1234567"), "fedcba9876543");
    assert.equal(resolvePublicAppRevision(undefined, undefined), null);
    assert.equal(resolvePublicAppRevision("not-a-git-id", "ABCDEF1234567"), null);
    assert.equal(resolvePublicAppRevision(undefined, "a".repeat(65)), null);
});
