import { createHash, randomUUID } from "node:crypto";
import { lstat, open, rename, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import {
    BackupFileNameError,
    parseBackupFileName,
} from "../backup-file.ts";

const API_HOSTS = new Set(["api.pcloud.com", "eapi.pcloud.com"]);
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)$/;
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_API_RESPONSE_BYTES = 8 * 1024 * 1024;
const DEFAULT_API_TIMEOUT_MS = 30_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120_000;
const CONTENT_HOST_PATTERN =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pcloud\.com$/;

export type PCloudApiHost = "api.pcloud.com" | "eapi.pcloud.com";
export type PCloudFetch = typeof fetch;

export interface PCloudFolderSelector {
    readonly folderId?: string;
    readonly path?: string;
}

export interface PCloudBackupFile {
    readonly fileId: string;
    readonly modifiedEpochSeconds: number;
    readonly name: string;
    readonly nameTimestamp: string;
    readonly size: number;
}

export interface PCloudVerifiedBackupFile extends PCloudBackupFile {
    readonly checksumSha1: string;
    readonly checksumSha256?: string;
}

export interface PCloudDownloadResult {
    readonly bytes: number;
    readonly path: string;
    readonly sha1: string;
    readonly sha256: string;
}

export interface PCloudClientOptions {
    readonly apiTimeoutMs?: number;
    readonly apiHost: string;
    readonly fetch?: PCloudFetch;
    readonly now?: () => number;
    readonly token: string;
}

export interface PCloudDownloadOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs?: number;
}

export class PCloudError extends Error {
    override readonly name = "PCloudError";
}

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown, context: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new PCloudError(`${context}: expected an object`);
    }
    return value as JsonObject;
}

function booleanValue(value: unknown, context: string): boolean {
    if (typeof value !== "boolean") {
        throw new PCloudError(`${context}: expected a boolean`);
    }
    return value;
}

function stringValue(value: unknown, context: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new PCloudError(`${context}: expected a non-empty string`);
    }
    return value;
}

function safeInteger(value: unknown, context: string): number {
    if (!Number.isSafeInteger(value)) {
        throw new PCloudError(`${context}: expected a safe integer`);
    }
    return value as number;
}

export function normalizePCloudId(value: unknown, context: string): string {
    let decimal: string;
    if (typeof value === "number") {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new PCloudError(
                `${context}: numeric 64-bit identifiers must be safe non-negative integers`,
            );
        }
        decimal = String(value);
    } else if (typeof value === "string" && DECIMAL_PATTERN.test(value)) {
        decimal = value;
    } else {
        throw new PCloudError(`${context}: expected an unsigned decimal identifier`);
    }
    const parsed = BigInt(decimal);
    if (parsed > MAX_UINT64) {
        throw new PCloudError(`${context}: identifier exceeds uint64`);
    }
    return parsed.toString();
}

export function validateApiHost(value: string): PCloudApiHost {
    if (!API_HOSTS.has(value)) {
        throw new PCloudError("pCloud API host is outside the allowlist");
    }
    return value as PCloudApiHost;
}

export function validateFolderPath(value: string): string {
    if (
        !value.startsWith("/") ||
        value.length > 1_024 ||
        value.includes("\\") ||
        value.includes("\0") ||
        value.split("/").some((part) => part === "." || part === "..")
    ) {
        throw new PCloudError("pCloud folder path must be a safe absolute path");
    }
    return value;
}

function fileIdFromMetadata(metadata: JsonObject, context: string): string {
    let idFromString: string | undefined;
    if (metadata.id !== undefined) {
        const id = stringValue(metadata.id, `${context}.id`);
        const match = /^f(\d+)$/.exec(id);
        if (match === null) {
            throw new PCloudError(`${context}.id: expected canonical file id`);
        }
        idFromString = normalizePCloudId(match[1], `${context}.id`);
    }
    let idFromFileId: string | undefined;
    if (metadata.fileid !== undefined) {
        if (
            idFromString !== undefined &&
            typeof metadata.fileid === "number" &&
            !Number.isSafeInteger(metadata.fileid)
        ) {
            // JSON already rounded this optional compatibility field. The canonical
            // string metadata.id remains lossless and authoritative.
            idFromFileId = undefined;
        } else {
            idFromFileId = normalizePCloudId(
                metadata.fileid,
                `${context}.fileid`,
            );
        }
    }
    if (idFromString === undefined && idFromFileId === undefined) {
        throw new PCloudError(`${context}: file identifier is missing`);
    }
    if (
        idFromString !== undefined &&
        idFromFileId !== undefined &&
        idFromString !== idFromFileId
    ) {
        throw new PCloudError(`${context}: id and fileid disagree`);
    }
    return idFromString ?? idFromFileId!;
}

function modifiedTimestamp(value: unknown, context: string): number {
    if (typeof value === "number") {
        const result = safeInteger(value, context);
        if (result < 0) throw new PCloudError(`${context}: timestamp is negative`);
        return result;
    }
    if (typeof value === "string" && DECIMAL_PATTERN.test(value)) {
        const result = Number(value);
        if (!Number.isSafeInteger(result)) {
            throw new PCloudError(`${context}: timestamp exceeds safe range`);
        }
        return result;
    }
    if (typeof value === "string") {
        const milliseconds = Date.parse(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 0) {
            throw new PCloudError(`${context}: invalid timestamp`);
        }
        return Math.floor(milliseconds / 1_000);
    }
    throw new PCloudError(`${context}: invalid timestamp`);
}

function parseBackupMetadata(value: unknown, index: number): PCloudBackupFile | null {
    const metadata = objectValue(value, `pCloud metadata ${index}`);
    if (metadata.isfolder === true || metadata.isdeleted === true) return null;
    if (metadata.isfolder !== false) {
        throw new PCloudError(`pCloud metadata ${index}: file marker is missing`);
    }
    if (metadata.isdeleted !== undefined && metadata.isdeleted !== false) {
        throw new PCloudError(`pCloud metadata ${index}: invalid deletion marker`);
    }
    const name = stringValue(metadata.name, `pCloud metadata ${index}.name`);
    let parsedName: ReturnType<typeof parseBackupFileName>;
    try {
        parsedName = parseBackupFileName(name);
    } catch (error) {
        if (error instanceof BackupFileNameError) {
            throw new PCloudError(
                "pCloud backup filename contains an invalid timestamp",
                { cause: error },
            );
        }
        throw error;
    }
    if (parsedName === null) return null;
    const size =
        typeof metadata.size === "string" && DECIMAL_PATTERN.test(metadata.size)
            ? Number(metadata.size)
            : safeInteger(metadata.size, `pCloud metadata ${index}.size`);
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BACKUP_BYTES) {
        throw new PCloudError(
            `pCloud metadata ${index}: backup size must be from 1 through 64 MiB`,
        );
    }
    return {
        fileId: fileIdFromMetadata(metadata, `pCloud metadata ${index}`),
        modifiedEpochSeconds: modifiedTimestamp(
            metadata.modified,
            `pCloud metadata ${index}.modified`,
        ),
        name,
        nameTimestamp: parsedName.timestamp,
        size,
    };
}

function compareBackups(left: PCloudBackupFile, right: PCloudBackupFile): number {
    const byName = right.nameTimestamp.localeCompare(left.nameTimestamp);
    if (byName !== 0) return byName;
    const byModified = right.modifiedEpochSeconds - left.modifiedEpochSeconds;
    if (byModified !== 0) return byModified;
    const leftId = BigInt(left.fileId);
    const rightId = BigInt(right.fileId);
    return rightId > leftId ? 1 : rightId < leftId ? -1 : 0;
}

function checksum(value: unknown, length: number, context: string): string {
    if (
        typeof value !== "string" ||
        value.length !== length ||
        !/^[a-f0-9]+$/.test(value)
    ) {
        throw new PCloudError(`${context}: invalid checksum`);
    }
    return value;
}

async function responseBytes(
    response: Response,
    limit: number,
    context: string,
): Promise<Uint8Array> {
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader !== null) {
        if (!DECIMAL_PATTERN.test(lengthHeader) || Number(lengthHeader) > limit) {
            throw new PCloudError(`${context}: response exceeds its size limit`);
        }
    }
    if (response.body === null) {
        throw new PCloudError(`${context}: response body is missing`);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            // oxlint-disable-next-line no-await-in-loop -- Web streams are consumed sequentially by contract.
            const item = await reader.read();
            if (item.done) break;
            total += item.value.byteLength;
            if (total > limit) {
                // oxlint-disable-next-line no-await-in-loop -- cancellation must finish before rejecting the response.
                await reader.cancel();
                throw new PCloudError(`${context}: response exceeds its size limit`);
            }
            chunks.push(item.value);
        }
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return result;
    } finally {
        for (const chunk of chunks) chunk.fill(0);
    }
}

async function jsonResponse(response: Response, context: string): Promise<JsonObject> {
    if (!response.ok) {
        throw new PCloudError(`${context}: HTTP request failed`);
    }
    const bytes = await responseBytes(response, MAX_API_RESPONSE_BYTES, context);
    let value: unknown;
    try {
        value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    } catch (error) {
        throw new PCloudError(`${context}: response is not valid JSON`, {
            cause: error,
        });
    } finally {
        bytes.fill(0);
    }
    const object = objectValue(value, context);
    const result =
        typeof object.result === "string" && DECIMAL_PATTERN.test(object.result)
            ? Number(object.result)
            : safeInteger(object.result, `${context}.result`);
    if (result !== 0) {
        throw new PCloudError(`${context}: pCloud returned error code ${result}`);
    }
    return object;
}

function validateContentHost(host: string): string {
    const normalized = host.toLowerCase();
    if (
        host !== normalized ||
        normalized.length > 253 ||
        !CONTENT_HOST_PATTERN.test(normalized) ||
        normalized.includes("..")
    ) {
        throw new PCloudError("pCloud content host is outside the allowlist");
    }
    return normalized;
}

function expiryMilliseconds(value: unknown): number {
    if (typeof value === "number") {
        return safeInteger(value, "pCloud download expiry") * 1_000;
    }
    if (typeof value === "string" && DECIMAL_PATTERN.test(value)) {
        const seconds = Number(value);
        if (!Number.isSafeInteger(seconds)) {
            throw new PCloudError("pCloud download expiry exceeds safe range");
        }
        return seconds * 1_000;
    }
    if (typeof value === "string") {
        const result = Date.parse(value);
        if (Number.isFinite(result)) return result;
    }
    throw new PCloudError("pCloud download expiry is invalid");
}

function contentUrl(host: string, path: unknown): URL {
    const safeHost = validateContentHost(host);
    const safePath = stringValue(path, "pCloud download path");
    if (
        !safePath.startsWith("/") ||
        safePath.startsWith("//") ||
        safePath.includes("\\") ||
        [...safePath].some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
        })
    ) {
        throw new PCloudError("pCloud download path is unsafe");
    }
    const result = new URL(`https://${safeHost}${safePath}`);
    if (
        result.protocol !== "https:" ||
        result.hostname !== safeHost ||
        result.username !== "" ||
        result.password !== ""
    ) {
        throw new PCloudError("pCloud download URL is unsafe");
    }
    return result;
}

async function assertDestinationParent(path: string): Promise<void> {
    if (!isAbsolute(path)) {
        throw new PCloudError("Download destination must be absolute");
    }
    const parent = path.slice(0, path.lastIndexOf("/")) || "/";
    const metadata = await lstat(parent);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new PCloudError("Download parent must be a real directory");
    }
}

function timeoutSignal(
    external: AbortSignal | undefined,
    timeoutMs: number,
): { cleanup: () => void; signal: AbortSignal } {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
        throw new PCloudError("Download timeout is outside the allowed range");
    }
    const controller = new AbortController();
    const abort = () => controller.abort(external?.reason);
    if (external?.aborted) abort();
    else external?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Download timed out")), timeoutMs);
    return {
        cleanup: () => {
            clearTimeout(timer);
            external?.removeEventListener("abort", abort);
        },
        signal: controller.signal,
    };
}

export class PCloudClient {
    private readonly apiTimeoutMs: number;
    private readonly apiHost: PCloudApiHost;
    private readonly fetchImplementation: PCloudFetch;
    private readonly now: () => number;
    private readonly token: string;

    constructor(options: PCloudClientOptions) {
        this.apiHost = validateApiHost(options.apiHost);
        if (options.token.length < 1 || options.token.length > 4_096) {
            throw new PCloudError("pCloud token length is invalid");
        }
        this.token = options.token;
        this.apiTimeoutMs = options.apiTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
        if (
            !Number.isSafeInteger(this.apiTimeoutMs) ||
            this.apiTimeoutMs < 1 ||
            this.apiTimeoutMs > 600_000
        ) {
            throw new PCloudError("pCloud API timeout is outside the allowed range");
        }
        this.fetchImplementation = options.fetch ?? fetch;
        this.now = options.now ?? Date.now;
    }

    private async apiJson(
        method: string,
        parameters: URLSearchParams,
        context: string,
        externalSignal?: AbortSignal,
    ): Promise<JsonObject> {
        const timeout = timeoutSignal(externalSignal, this.apiTimeoutMs);
        try {
            const response = await this.fetchImplementation(
                `https://${this.apiHost}/${method}?${parameters}`,
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                    method: "GET",
                    redirect: "error",
                    signal: timeout.signal,
                },
            );
            return await jsonResponse(response, context);
        } catch (error) {
            throw error instanceof PCloudError
                ? error
                : new PCloudError(`${context}: HTTP request failed`, {
                      cause: error,
                  });
        } finally {
            timeout.cleanup();
        }
    }

    async listLatestBackup(
        selector: PCloudFolderSelector,
        signal?: AbortSignal,
    ): Promise<PCloudBackupFile> {
        const parameters = new URLSearchParams({
            recursive: "0",
            showdeleted: "0",
            timeformat: "timestamp",
        });
        if (selector.folderId !== undefined && selector.path !== undefined) {
            throw new PCloudError("Use either pCloud folderId or path, not both");
        }
        if (selector.folderId !== undefined) {
            parameters.set(
                "folderid",
                normalizePCloudId(selector.folderId, "pCloud folderId"),
            );
        } else if (selector.path !== undefined) {
            parameters.set("path", validateFolderPath(selector.path));
        } else {
            throw new PCloudError("pCloud folder selector is missing");
        }
        const body = await this.apiJson(
            "listfolder",
            parameters,
            "pCloud listfolder",
            signal,
        );
        const metadata = objectValue(body.metadata, "pCloud listfolder.metadata");
        if (booleanValue(metadata.isfolder, "pCloud listfolder.metadata.isfolder") !== true) {
            throw new PCloudError("pCloud listfolder did not return a folder");
        }
        if (!Array.isArray(metadata.contents)) {
            throw new PCloudError("pCloud listfolder contents are missing");
        }
        const backups = metadata.contents
            .map(parseBackupMetadata)
            .filter((item): item is PCloudBackupFile => item !== null)
            .sort(compareBackups);
        const latest = backups[0];
        if (latest === undefined) {
            throw new PCloudError("pCloud folder contains no valid MyExpenses backup");
        }
        return latest;
    }

    async downloadBackup(
        file: PCloudVerifiedBackupFile,
        destinationPath: string,
        options: PCloudDownloadOptions = {},
    ): Promise<PCloudDownloadResult> {
        await assertDestinationParent(destinationPath);
        const parameters = new URLSearchParams({
            fileid: normalizePCloudId(file.fileId, "pCloud fileId"),
            forcedownload: "1",
        });
        const link = await this.apiJson(
            "getfilelink",
            parameters,
            "pCloud getfilelink",
            options.signal,
        );
        if (!Array.isArray(link.hosts) || link.hosts.length === 0) {
            throw new PCloudError("pCloud getfilelink hosts are missing");
        }
        const host = stringValue(link.hosts[0], "pCloud content host");
        const url = contentUrl(host, link.path);
        if (expiryMilliseconds(link.expires) <= this.now()) {
            throw new PCloudError("pCloud download link has expired");
        }

        const timeout = timeoutSignal(
            options.signal,
            options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
        );
        const temporaryPath = join(
            destinationPath.slice(0, destinationPath.lastIndexOf("/")) || "/",
            `.${destinationPath.slice(destinationPath.lastIndexOf("/") + 1)}.${randomUUID()}.tmp`,
        );
        let handle: Awaited<ReturnType<typeof open>> | undefined;
        try {
            const response = await this.fetchImplementation(url, {
                method: "GET",
                redirect: "error",
                signal: timeout.signal,
            });
            if (!response.ok || response.body === null) {
                throw new PCloudError("pCloud content download failed");
            }
            const declaredLength = response.headers.get("content-length");
            if (declaredLength !== null) {
                if (!DECIMAL_PATTERN.test(declaredLength)) {
                    throw new PCloudError("pCloud content length is invalid");
                }
                const length = Number(declaredLength);
                if (!Number.isSafeInteger(length) || length !== file.size) {
                    throw new PCloudError("pCloud content length disagrees with metadata");
                }
            }
            handle = await open(temporaryPath, "wx", 0o600);
            const outputHandle = handle;
            const reader = response.body.getReader();
            const sha1Hash = createHash("sha1");
            const sha256Hash = createHash("sha256");
            let total = 0;
            const writeChunk = async (chunk: Uint8Array): Promise<void> => {
                let offset = 0;
                while (offset < chunk.byteLength) {
                    // oxlint-disable-next-line no-await-in-loop -- partial file writes must be completed in order.
                    const write = await outputHandle.write(
                        chunk,
                        offset,
                        chunk.byteLength - offset,
                    );
                    if (write.bytesWritten < 1) {
                        throw new PCloudError("Could not persist pCloud download");
                    }
                    offset += write.bytesWritten;
                }
            };
            while (true) {
                // oxlint-disable-next-line no-await-in-loop -- Web streams are consumed sequentially by contract.
                const item = await reader.read();
                if (item.done) break;
                const chunk = item.value;
                try {
                    total += chunk.byteLength;
                    if (total > file.size || total > MAX_BACKUP_BYTES) {
                        // oxlint-disable-next-line no-await-in-loop -- cancellation must finish before rejecting the download.
                        await reader.cancel();
                        throw new PCloudError(
                            "pCloud download exceeds the expected size",
                        );
                    }
                    sha1Hash.update(chunk);
                    sha256Hash.update(chunk);
                    // oxlint-disable-next-line no-await-in-loop -- download chunks must be persisted in stream order.
                    await writeChunk(chunk);
                } finally {
                    chunk.fill(0);
                }
            }
            if (total !== file.size) {
                throw new PCloudError("pCloud download is incomplete");
            }
            const sha1 = sha1Hash.digest("hex");
            const sha256 = sha256Hash.digest("hex");
            if (sha1 !== file.checksumSha1) {
                throw new PCloudError(
                    "Downloaded SHA-1 disagrees with pCloud checksum",
                );
            }
            if (
                file.checksumSha256 !== undefined &&
                sha256 !== file.checksumSha256
            ) {
                throw new PCloudError(
                    "Downloaded SHA-256 disagrees with pCloud checksum",
                );
            }
            await handle.sync();
            await handle.close();
            handle = undefined;
            await rename(temporaryPath, destinationPath);
            return {
                bytes: total,
                path: destinationPath,
                sha1,
                sha256,
            };
        } catch (error) {
            throw error instanceof PCloudError
                ? error
                : new PCloudError("pCloud content download failed", {
                      cause: error,
                  });
        } finally {
            timeout.cleanup();
            await handle?.close().catch(() => undefined);
            await rm(temporaryPath, { force: true }).catch(() => undefined);
        }
    }

    async getBackupChecksums(
        selectedFile: PCloudBackupFile,
        signal?: AbortSignal,
    ): Promise<PCloudVerifiedBackupFile> {
        const parameters = new URLSearchParams({
            fileid: normalizePCloudId(selectedFile.fileId, "pCloud fileId"),
            timeformat: "timestamp",
        });
        const body = await this.apiJson(
            "checksumfile",
            parameters,
            "pCloud checksumfile",
            signal,
        );
        const refreshed = parseBackupMetadata(body.metadata, 0);
        if (
            refreshed === null ||
            refreshed.fileId !== selectedFile.fileId ||
            refreshed.name !== selectedFile.name
        ) {
            throw new PCloudError(
                "pCloud checksum metadata disagrees with selected backup",
            );
        }
        const checksumSha1 = checksum(body.sha1, 40, "pCloud SHA-1");
        const checksumSha256 =
            body.sha256 === undefined
                ? undefined
                : checksum(body.sha256, 64, "pCloud SHA-256");
        return {
            ...refreshed,
            checksumSha1,
            ...(checksumSha256 === undefined ? {} : { checksumSha256 }),
        };
    }
}
