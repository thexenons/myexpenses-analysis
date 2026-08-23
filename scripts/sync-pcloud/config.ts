import { lstat, open } from "node:fs/promises";
import { isAbsolute, normalize, relative, sep } from "node:path";

import {
    STATIC_VAULT_MAX_PASSPHRASE_BYTES,
    validateStaticVaultPassphrase,
} from "../../src/domain/security/static-vault.ts";

import {
    normalizePCloudId,
    type PCloudApiHost,
    type PCloudFolderSelector,
    validateApiHost,
    validateFolderPath,
} from "./pcloud.ts";

const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_TOKEN_BYTES = 4 * 1024;

export interface SyncPCloudConfig {
    readonly apiHost: PCloudApiHost;
    readonly deployRoot: string;
    readonly folder: PCloudFolderSelector;
    readonly repositoryRoot: string;
    readonly timeZone: string;
    readonly tokenFile: string;
    readonly vaultPassphraseFile: string;
}

export interface SyncPCloudSecrets {
    readonly token: string;
    readonly vaultPassphrase: string;
}

export class SyncConfigError extends Error {
    override readonly name = "SyncConfigError";
}

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown, context: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new SyncConfigError(`${context}: expected an object`);
    }
    return value as JsonObject;
}

function exactKeys(
    object: JsonObject,
    required: readonly string[],
    optional: readonly string[],
): void {
    const allowed = new Set([...required, ...optional]);
    for (const key of required) {
        if (!Object.hasOwn(object, key)) {
            throw new SyncConfigError(`Sync config is missing ${key}`);
        }
    }
    for (const key of Object.keys(object)) {
        if (!allowed.has(key)) {
            throw new SyncConfigError(`Sync config contains unexpected key ${key}`);
        }
    }
}

function stringValue(value: unknown, context: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new SyncConfigError(`${context}: expected a non-empty string`);
    }
    return value;
}

function absoluteTarget(value: unknown, context: string): string {
    const path = normalize(stringValue(value, context));
    if (!isAbsolute(path) || path === "/" || path.includes("\0")) {
        throw new SyncConfigError(`${context}: expected a safe absolute path`);
    }
    return path;
}

function pathContains(parent: string, child: string): boolean {
    const path = relative(parent, child);
    return (
        path === "" ||
        (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
    );
}

async function readRegularFile(
    path: string,
    maxBytes: number,
    context: string,
    requirePrivateMode = false,
): Promise<Buffer> {
    const metadata = await lstat(path).catch((error: unknown) => {
        throw new SyncConfigError(`${context} cannot be inspected`, {
            cause: error,
        });
    });
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new SyncConfigError(`${context} must be a regular non-symlink file`);
    }
    if (!requirePrivateMode && (metadata.mode & 0o022) !== 0) {
        throw new SyncConfigError(
            `${context} must not be writable by group or other users`,
        );
    }
    if (requirePrivateMode && (metadata.mode & 0o777) !== 0o600) {
        throw new SyncConfigError(`${context} file mode must be 0600`);
    }
    if (metadata.size < 1 || metadata.size > maxBytes) {
        throw new SyncConfigError(`${context} file size is invalid`);
    }
    let handle: Awaited<ReturnType<typeof open>>;
    try {
        handle = await open(path, "r");
    } catch (error) {
        throw new SyncConfigError(`${context} cannot be opened`, { cause: error });
    }
    try {
        const opened = await handle.stat();
        if (
            !opened.isFile() ||
            opened.dev !== metadata.dev ||
            opened.ino !== metadata.ino ||
            opened.size > maxBytes ||
            (!requirePrivateMode && (opened.mode & 0o022) !== 0) ||
            (requirePrivateMode && (opened.mode & 0o777) !== 0o600)
        ) {
            throw new SyncConfigError(`${context} changed while being opened`);
        }
        const bytes = await handle.readFile();
        if (bytes.byteLength > maxBytes) {
            bytes.fill(0);
            throw new SyncConfigError(`${context} exceeds its size limit`);
        }
        return bytes;
    } finally {
        await handle.close();
    }
}

function decodeUtf8(bytes: Uint8Array, context: string): string {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
        throw new SyncConfigError(`${context}: invalid UTF-8`, { cause: error });
    }
}

export async function loadSyncPCloudConfig(
    configPathInput: string,
): Promise<SyncPCloudConfig> {
    const configPath = absoluteTarget(configPathInput, "Config path");
    const source = decodeUtf8(
        await readRegularFile(configPath, MAX_CONFIG_BYTES, "Sync config"),
        "Sync config",
    );
    let parsed: unknown;
    try {
        parsed = JSON.parse(source) as unknown;
    } catch (error) {
        throw new SyncConfigError("Sync config is not valid JSON", { cause: error });
    }
    const object = objectValue(parsed, "Sync config");
    exactKeys(
        object,
        [
            "apiHost",
            "tokenFile",
            "vaultPassphraseFile",
            "deployRoot",
            "repositoryRoot",
            "timeZone",
        ],
        ["folderId", "path"],
    );
    const hasFolderId = object.folderId !== undefined;
    const hasPath = object.path !== undefined;
    if (hasFolderId === hasPath) {
        throw new SyncConfigError("Sync config requires exactly one of folderId or path");
    }
    const deployRoot = absoluteTarget(object.deployRoot, "deployRoot");
    const repositoryRoot = absoluteTarget(object.repositoryRoot, "repositoryRoot");
    if (
        pathContains(deployRoot, repositoryRoot) ||
        pathContains(repositoryRoot, deployRoot)
    ) {
        throw new SyncConfigError(
            "deployRoot and repositoryRoot must be separate directory trees",
        );
    }
    const timeZone = stringValue(object.timeZone, "timeZone");
    try {
        new Intl.DateTimeFormat("en", { timeZone }).format(0);
    } catch (error) {
        throw new SyncConfigError("timeZone must be a valid IANA zone", {
            cause: error,
        });
    }
    return {
        apiHost: validateApiHost(stringValue(object.apiHost, "apiHost")),
        deployRoot,
        folder: hasFolderId
            ? {
                  folderId: normalizePCloudId(
                      object.folderId,
                      "Config folderId",
                  ),
              }
            : { path: validateFolderPath(stringValue(object.path, "path")) },
        repositoryRoot,
        timeZone,
        tokenFile: absoluteTarget(object.tokenFile, "tokenFile"),
        vaultPassphraseFile: absoluteTarget(
            object.vaultPassphraseFile,
            "vaultPassphraseFile",
        ),
    };
}

async function readPrivateSecret(
    path: string,
    maximumBytes: number,
    context: string,
): Promise<string> {
    const bytes = await readRegularFile(
        path,
        maximumBytes,
        context,
        true,
    );
    try {
        let value = decodeUtf8(bytes, context);
        if (value.endsWith("\r\n")) value = value.slice(0, -2);
        else if (value.endsWith("\n")) value = value.slice(0, -1);
        if (
            value.length < 1 ||
            value.includes("\0") ||
            value.includes("\n") ||
            value.includes("\r")
        ) {
            throw new SyncConfigError(`${context} file contains an invalid value`);
        }
        return value;
    } finally {
        bytes.fill(0);
    }
}

export async function loadSyncPCloudSecrets(
    config: SyncPCloudConfig,
): Promise<SyncPCloudSecrets> {
    const [token, vaultPassphrase] = await Promise.all([
        readPrivateSecret(
            config.tokenFile,
            MAX_TOKEN_BYTES,
            "pCloud token",
        ),
        readPrivateSecret(
            config.vaultPassphraseFile,
            STATIC_VAULT_MAX_PASSPHRASE_BYTES + 2,
            "Vault passphrase",
        ),
    ]);
    try {
        validateStaticVaultPassphrase(vaultPassphrase);
    } catch (error) {
        throw new SyncConfigError(
            "Vault passphrase does not satisfy the static-vault policy",
            { cause: error },
        );
    }
    return { token, vaultPassphrase };
}
