import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (path: string) => readFile(join(root, path), "utf8");

test("worker image installs locked runtime tools without copying repository secrets", async () => {
    const [dockerfile, ignored] = await Promise.all([
        source("Dockerfile"), source(".dockerignore"),
    ]);
    assert.match(dockerfile, /FROM node:24\.21\.0-bookworm-slim AS worker/u);
    assert.match(dockerfile, /apt-get install[^\n]*ca-certificates[^\n]*util-linux/u);
    assert.match(dockerfile, /pnpm@12\.6\.0/u);
    assert.match(dockerfile, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/u);
    assert.match(dockerfile, /COPY patches\/ patches\//u);
    assert.match(dockerfile, /pnpm install --frozen-lockfile/u);
    assert.match(dockerfile, /chown -R 1000:1000 \/srv\/myexpenses/u);
    assert.match(dockerfile, /chmod 0755 \/srv\/myexpenses \/srv\/myexpenses\/releases/u);
    assert.match(dockerfile, /chmod 0700 \/srv\/myexpenses\/\.work/u);
    assert.match(dockerfile, /USER 1000:1000/u);
    assert.match(dockerfile, /node", "--import", "tsx", "scripts\/sync-pcloud\/worker-main\.ts/u);
    assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./u);
    const rules = ignored.split("\n").filter((line) => line.length > 0 && !line.startsWith("#"));
    assert.equal(rules[0], "**", "build context must deny unknown files by default");
    for (const path of [
        "!Dockerfile", "!package.json", "!pnpm-lock.yaml", "!pnpm-workspace.yaml",
        "!index.html", "!vite.config.ts", "!vitest.config.ts",
        "!tsconfig.json", "!tsconfig.app.json", "!tsconfig.node.json",
        "!patches/", "!patches/**", "!src/", "!src/**",
        "!scripts/", "!scripts/**", "!tests/", "!tests/**",
        "!deploy/", "!deploy/nginx.coolify.conf",
    ]) {
        assert.ok(rules.includes(path), `${path} must be allowed into the build context`);
    }
    const finalAllow = rules.indexOf("!deploy/nginx.coolify.conf");
    for (const path of [
        "**/.env*", "**/app-dataset.json", "**/app-dataset.vault.json",
        "**/*.vault.json", "src/**/*.json", "scripts/**/*.json", "tests/**/*.json",
        "**/*.sql", "**/*.db", "**/*.sqlite*", "**/*.zip",
        "**/*.token", "**/*.passphrase", "**/*.pem", "**/*.key",
        "**/private/**", "**/secrets/**", "**/backups/**",
    ]) {
        assert.ok(rules.indexOf(path) > finalAllow, `${path} must override directory allowances`);
    }
    assert.doesNotMatch(ignored, /!deploy\/\*|!data\/|!backups\//u);
    assert.deepEqual(rules.filter((line) => line.startsWith("!deploy")), [
        "!deploy/", "!deploy/nginx.coolify.conf",
    ]);
});

test("Compose isolates secrets, ownership, health, and writable paths", async () => {
    const compose = await source("compose.yaml");
    const worker = compose.slice(compose.indexOf("  worker:"), compose.indexOf("  web:"));
    const web = compose.slice(compose.indexOf("  web:"), compose.indexOf("\nvolumes:"));
    assert.match(worker, /MYEXPENSES_APP_REVISION: \$\{MYEXPENSES_APP_REVISION:-\}/u);
    assert.match(worker, /SOURCE_COMMIT: \$\{SOURCE_COMMIT:-\}/u);
    assert.doesNotMatch(web, /MYEXPENSES_APP_REVISION|SOURCE_COMMIT/u);
    assert.match(compose, /target: worker/u);
    assert.match(compose, /target: web/u);
    assert.match(compose, /PCLOUD_TOKEN: \$\{PCLOUD_TOKEN:\?[^}]+\}/u);
    assert.match(compose, /MYEXPENSES_VAULT_PASSPHRASE: \$\{MYEXPENSES_VAULT_PASSPHRASE:\?[^}]+\}/u);
    assert.match(compose, /PCLOUD_FOLDER_ID: \$\{PCLOUD_FOLDER_ID:-\}/u);
    assert.match(compose, /PCLOUD_FOLDER_PATH: \$\{PCLOUD_FOLDER_PATH:-\}/u);
    assert.match(compose, /MYEXPENSES_SYNC_INTERVAL_SECONDS: \$\{MYEXPENSES_SYNC_INTERVAL_SECONDS:-3600\}/u);
    assert.match(compose, /MYEXPENSES_SYNC_TIMEOUT_SECONDS: \$\{MYEXPENSES_SYNC_TIMEOUT_SECONDS:-1800\}/u);
    for (const key of [
        "MYEXPENSES_NOTIFICATION_TO",
        "MYEXPENSES_NOTIFICATION_FROM",
        "MYEXPENSES_SMTP_PASSWORD",
    ]) {
        assert.ok(compose.includes(key + ": ${" + key + ":-}"));
    }
    assert.match(compose, /condition: service_healthy/u);
    assert.match(compose, /stop_grace_period: 45s/u);
    assert.match(compose, /nocopy: true/u);
    assert.match(compose, /read_only: true/u);
    assert.match(compose, /cap_drop:\s*\n\s*- ALL/u);
    assert.match(compose, /no-new-privileges:true/u);
    assert.match(compose, /\/run\/myexpenses:uid=1000,gid=1000,mode=0700/u);
    assert.match(compose, /\/app\/node_modules\/\.tmp:uid=1000,gid=1000/u);
    assert.match(compose, /\/app\/node_modules\/\.vite-temp:uid=1000,gid=1000/u);
    assert.match(compose, /\/run\/myexpenses\/ready/u);
    assert.match(compose, /start_period: 35m/u);
    assert.match(compose, /"-fsSI", "--max-time", "3", "http:\/\/127\.0\.0\.1:8080\/data\/app-dataset\.vault\.json"/u);
    assert.doesNotMatch(compose, /^\s*ports:/mu);
    assert.doesNotMatch(compose, /^\s*args:/mu);
    assert.doesNotMatch(compose, /MYEXPENSES_DEPLOY_ROOT|MYEXPENSES_REPOSITORY_ROOT/u);
    assert.doesNotMatch(web, /PCLOUD_|PASSPHRASE|NOTIFICATION|SMTP_PASSWORD/u);
});

test("web nginx serves only the vault and static assets behind the proxy", async () => {
    const [dockerfile, config] = await Promise.all([
        source("Dockerfile"), source("deploy/nginx.coolify.conf"),
    ]);
    assert.match(dockerfile, /FROM nginx:1\.30\.5-alpine-slim AS web/u);
    assert.match(dockerfile, /apk add --no-cache curl/u);
    assert.match(dockerfile, /USER 101:101/u);
    assert.match(dockerfile, /ENTRYPOINT \["nginx"\]/u);
    assert.match(config, /pid \/tmp\/nginx\.pid;/u);
    assert.match(config, /http \{\s*include \/etc\/nginx\/mime\.types;/u);
    assert.match(config, /default_type application\/octet-stream;/u);
    for (const path of ["client_body", "proxy", "fastcgi", "uwsgi", "scgi"]) {
        assert.match(config, new RegExp(`${path}_temp_path /tmp/`, "u"));
    }
    assert.match(config, /listen 8080;/u);
    assert.match(config, /location = \/data\/app-dataset\.vault\.json/u);
    assert.match(config, /location \^~ \/data\/ \{\s*return 404;/u);
    assert.match(config, /location \^~ \/assets\//u);
    assert.match(config, /try_files \$uri =404;/u);
    assert.match(config, /try_files \$uri \$uri\/ \/index\.html;/u);
    assert.match(config, /Content-Security-Policy/u);
    assert.match(config, /max-age=31536000, immutable/u);
    assert.doesNotMatch(config, /ssl_certificate|listen 443|return 308/u);
});
