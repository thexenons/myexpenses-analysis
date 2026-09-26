FROM node:24.21.0-bookworm-slim AS worker

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@12.6.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ patches/
RUN pnpm install --frozen-lockfile

COPY index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src/ src/
COPY scripts/ scripts/
COPY tests/ tests/

# Docker copies this owner-only directory into a fresh named volume. Existing
# volumes keep their own metadata and must already be safe for the worker UID.
RUN mkdir -p /srv/myexpenses/releases /srv/myexpenses/.work \
    /app/node_modules/.tmp /app/node_modules/.vite-temp /run/myexpenses \
    && chown -R 1000:1000 /srv/myexpenses \
    && chmod 0755 /srv/myexpenses /srv/myexpenses/releases \
    && chmod 0700 /srv/myexpenses/.work

USER 1000:1000
ENTRYPOINT ["node", "--import", "tsx", "scripts/sync-pcloud/worker-main.ts"]

FROM nginx:1.30.5-alpine-slim AS web

RUN apk add --no-cache curl
COPY deploy/nginx.coolify.conf /etc/nginx/nginx.conf

USER 101:101
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
