import { lstat, open } from "node:fs/promises";
import { isAbsolute, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import {
  decryptCompressedDataset,
  parseStaticVaultEnvelopeJson,
  STATIC_VAULT_MAX_ENVELOPE_BYTES,
  StaticVaultUnlockError,
} from "./src/domain/security/static-vault.ts";

const DATA_FILES = ["app-dataset.vault.json"] as const;

type DataFile = (typeof DATA_FILES)[number];

const DATA_ROUTE_PREFIX = "/data/";
const DATA_DIRECTORY_URL = new URL("./data/", import.meta.url);
const DATA_DIRECTORY_PATH = normalize(fileURLToPath(DATA_DIRECTORY_URL));
const configuredVaultPath = process.env.MYEXPENSES_VAULT_SOURCE_PATH;
if (configuredVaultPath !== undefined && !isAbsolute(configuredVaultPath)) {
  throw new Error("MYEXPENSES_VAULT_SOURCE_PATH must be absolute");
}
const VAULT_SOURCE =
  configuredVaultPath === undefined
    ? new URL(DATA_FILES[0], DATA_DIRECTORY_URL)
    : normalize(configuredVaultPath);
const dataFileByRoute = new Map<string, DataFile>(
  DATA_FILES.map((fileName) => [`${DATA_ROUTE_PREFIX}${fileName}`, fileName]),
);

interface CachedVaultSource {
  readonly device: number;
  readonly inode: number;
  readonly modifiedAt: number;
  readonly size: number;
  readonly source: Buffer;
}

let cachedVaultSource: CachedVaultSource | undefined;

function dataFileSource(fileName: DataFile): URL | string {
  if (fileName !== DATA_FILES[0]) {
    throw new Error("Unsupported client data file");
  }
  return VAULT_SOURCE;
}

export async function readValidatedVaultFile(
  filePath: URL | string,
): Promise<Buffer> {
  let pathStat: Awaited<ReturnType<typeof lstat>>;
  try {
    pathStat = await lstat(filePath);
  } catch (error) {
    throw new Error(
      "Encrypted dataset vault is unavailable; run pnpm data:encrypt first",
      { cause: error },
    );
  }
  if (
    !pathStat.isFile() ||
    pathStat.isSymbolicLink() ||
    pathStat.size > STATIC_VAULT_MAX_ENVELOPE_BYTES
  ) {
    throw new Error("Encrypted dataset vault is invalid");
  }
  if (
    cachedVaultSource !== undefined &&
    cachedVaultSource.device === pathStat.dev &&
    cachedVaultSource.inode === pathStat.ino &&
    cachedVaultSource.modifiedAt === pathStat.mtimeMs &&
    cachedVaultSource.size === pathStat.size
  ) {
    return cachedVaultSource.source;
  }

  let fileHandle: Awaited<ReturnType<typeof open>>;
  try {
    fileHandle = await open(filePath, "r");
  } catch (error) {
    throw new Error(
      "Encrypted dataset vault is unavailable; run pnpm data:encrypt first",
      { cause: error },
    );
  }
  try {
    const fileStat = await fileHandle.stat();
    if (
      !fileStat.isFile() ||
      fileStat.dev !== pathStat.dev ||
      fileStat.ino !== pathStat.ino ||
      fileStat.size > STATIC_VAULT_MAX_ENVELOPE_BYTES
    ) {
      throw new Error("Encrypted dataset vault changed while opening");
    }
    const source = await fileHandle.readFile();
    if (source.byteLength > STATIC_VAULT_MAX_ENVELOPE_BYTES) {
      throw new Error("Encrypted dataset vault exceeds its size limit");
    }
    const json = new TextDecoder("utf-8", { fatal: true }).decode(source);
    parseStaticVaultEnvelopeJson(json);
    cachedVaultSource = {
      device: fileStat.dev,
      inode: fileStat.ino,
      modifiedAt: fileStat.mtimeMs,
      size: fileStat.size,
      source,
    };
    return source;
  } catch (error) {
    throw new Error("Encrypted dataset vault is invalid", { cause: error });
  } finally {
    await fileHandle.close();
  }
}

async function readClientDataFile(
  fileName: DataFile,
  productionBuild = false,
): Promise<Buffer> {
  const source = await readValidatedVaultFile(dataFileSource(fileName));
  if (productionBuild) await assertVaultRequiresPassphrase(source);
  return source;
}

export async function assertVaultRequiresPassphrase(
  source: Uint8Array,
): Promise<void> {
  const envelope = parseStaticVaultEnvelopeJson(
    new TextDecoder("utf-8", { fatal: true }).decode(source),
  );
  let decrypted: Uint8Array | undefined;
  try {
    decrypted = await decryptCompressedDataset(
      envelope,
      "",
      globalThis.crypto,
      { allowEmptyPassphraseForDevelopment: true },
    );
  } catch (error) {
    if (error instanceof StaticVaultUnlockError) return;
    throw error;
  } finally {
    decrypted?.fill(0);
  }
  throw new Error(
    "Production build refuses a development vault with an empty passphrase",
  );
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

        void readClientDataFile(fileName).then(
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
          (error: unknown) => {
            response.statusCode = 500;
            response.end(
              error instanceof Error
                ? error.message
                : "Could not read encrypted application data",
            );
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
          source: await readClientDataFile(fileName, true),
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
