import { readFile } from "node:fs/promises";
import { isAbsolute, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const DATA_FILES = [
  "accounts.json",
  "categories.json",
  "parsed-data.json",
] as const;

type DataFile = (typeof DATA_FILES)[number];

const DATA_ROUTE_PREFIX = "/data/";
const DATA_DIRECTORY_URL = new URL("./data/", import.meta.url);
const DATA_DIRECTORY_PATH = normalize(fileURLToPath(DATA_DIRECTORY_URL));
const dataFileByRoute = new Map<string, DataFile>(
  DATA_FILES.map((fileName) => [`${DATA_ROUTE_PREFIX}${fileName}`, fileName]),
);

function dataFileUrl(fileName: DataFile): URL {
  return new URL(fileName, DATA_DIRECTORY_URL);
}

export function isPrivateDataFileSystemRoute(pathname: string): boolean {
  if (!pathname.startsWith("/@fs/")) {
    return false;
  }
  let routePath = pathname.slice("/@fs".length);
  if (sep === "\\" && /^\/[A-Za-z]:[\\/]/.test(routePath)) {
    routePath = routePath.slice(1);
  }
  const requestedPath = normalize(routePath);
  const relativePath = relative(DATA_DIRECTORY_PATH, requestedPath);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

function clientDataPlugin(): Plugin {
  let isBuild = false;

  return {
    name: "myexpenses-client-data",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === undefined) {
          next();
          return;
        }

        let pathname: string;
        try {
          pathname = decodeURIComponent(
            new URL(request.url, "http://vite.local").pathname,
          );
        } catch {
          response.statusCode = 400;
          response.end("Bad request");
          return;
        }

        if (isPrivateDataFileSystemRoute(pathname)) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        if (!pathname.startsWith(DATA_ROUTE_PREFIX)) {
          next();
          return;
        }

        const fileName = dataFileByRoute.get(pathname);
        if (fileName === undefined) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, HEAD");
          response.end("Method not allowed");
          return;
        }

        void readFile(dataFileUrl(fileName)).then(
          (source) => {
            response.statusCode = 200;
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.setHeader("Content-Length", source.byteLength);
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.end(
              request.method === "HEAD" ? undefined : source,
            );
          },
          () => {
            response.statusCode = 500;
            response.end("Could not read application data");
          },
        );
      });
    },
    async buildStart() {
      if (!isBuild) {
        return;
      }

      const assets = await Promise.all(
        DATA_FILES.map(async (fileName) => ({
          fileName: `${DATA_ROUTE_PREFIX.slice(1)}${fileName}`,
          source: await readFile(dataFileUrl(fileName)),
        })),
      );

      for (const asset of assets) {
        this.emitFile({
          type: "asset",
          fileName: asset.fileName,
          source: asset.source,
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    clientDataPlugin(),
  ],
});
