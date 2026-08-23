import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REQUIRED_HEADERS = [
    "Cache-Control",
    "Content-Security-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-Permitted-Cross-Domain-Policies",
    "X-Robots-Tag",
] as const;

test("deployment examples enforce the static application's security boundary", async () => {
    const [nginx, portable] = await Promise.all([
        readFile(new URL("../../deploy/nginx.example.conf", import.meta.url), "utf8"),
        readFile(
            new URL("../../deploy/security-headers.example.txt", import.meta.url),
            "utf8",
        ),
    ]);

    for (const header of REQUIRED_HEADERS) {
        assert.match(nginx, new RegExp(`add_header ${header} `, "u"));
        assert.match(portable, new RegExp(`^${header}: `, "mu"));
    }
    for (const source of [nginx, portable]) {
        assert.match(source, /default-src 'none'/u);
        assert.match(source, /frame-ancestors 'none'/u);
        assert.match(source, /object-src 'none'/u);
        assert.match(source, /script-src 'self';/u);
        assert.doesNotMatch(source, /script-src[^;]*unsafe-(?:eval|inline)/u);
        assert.match(source, /style-src-attr 'unsafe-inline'/u);
        assert.match(source, /style-src-elem 'self'/u);
    }
    assert.match(
        nginx,
        /location = \/data\/app-dataset\.vault\.json \{[\s\S]*?limit_except GET \{/u,
    );
    assert.match(
        nginx,
        /map \$uri \$myexpenses_cache_control \{[\s\S]*?default "no-store";[\s\S]*?\/assets\/[\s\S]*?"public, max-age=31536000, immutable";/u,
    );
    assert.match(
        nginx,
        /location \^~ \/assets\/ \{[\s\S]*?try_files \$uri =404;/u,
    );
    assert.match(portable, /Cache-Control: no-store/u);
    assert.match(
        portable,
        /Cache-Control: public, max-age=31536000, immutable/u,
    );
    assert.match(nginx, /return 308 https:\/\/finances\.example\.com\$request_uri/u);
});
