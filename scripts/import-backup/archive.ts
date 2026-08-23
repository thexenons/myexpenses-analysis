import { open, lstat } from "node:fs/promises";

import yauzl from "yauzl";
import type { Entry, ZipFile } from "yauzl";

const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const REQUIRED_ENTRY_NAMES = new Set(["BACKUP", "BACKUP_PREF"]);
const DATABASE_ENTRY_NAME = "BACKUP";
const PREFERENCES_ENTRY_NAME = "BACKUP_PREF";
const UI_SETTINGS_ENTRY_NAME = "ui_settings.preferences_pb";
const PICTURES_DIRECTORY = "Pictures/";
const SUPPORTED_COMPRESSION_METHODS = new Set([0, 8]);
const ZIP_ENCRYPTED_FLAG = 0x0001;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMBOLIC_LINK = 0o120000;

function createCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index++) {
        let value = index;
        for (let bit = 0; bit < 8; bit++) {
            value =
                (value & 1) === 1
                    ? 0xedb88320 ^ (value >>> 1)
                    : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
}

const CRC32_TABLE = createCrc32Table();

export interface BackupArchiveLimits {
    maxArchiveBytes: number;
    maxCompressionRatio: number;
    maxDatabaseBytes: number;
    maxEntryCount: number;
    maxPictureBytes: number;
    maxPicturesBytes: number;
    maxPreferencesBytes: number;
    maxTotalUncompressedBytes: number;
    maxUiSettingsBytes: number;
}

const DEFAULT_BACKUP_ARCHIVE_LIMITS: Readonly<BackupArchiveLimits> =
    Object.freeze({
        maxArchiveBytes: 64 * 1024 * 1024,
        maxCompressionRatio: 200,
        maxDatabaseBytes: 128 * 1024 * 1024,
        maxEntryCount: 4_096,
        maxPictureBytes: 64 * 1024 * 1024,
        maxPicturesBytes: 256 * 1024 * 1024,
        maxPreferencesBytes: 4 * 1024 * 1024,
        maxTotalUncompressedBytes: 512 * 1024 * 1024,
        maxUiSettingsBytes: 4 * 1024 * 1024,
    });

export type BackupArchiveErrorCode =
    | "ARCHIVE_LIMIT_EXCEEDED"
    | "DUPLICATE_ENTRY"
    | "ENCRYPTED_ENTRY"
    | "INVALID_ARCHIVE_PATH"
    | "INVALID_ENTRY_PATH"
    | "INVALID_ZIP"
    | "MISSING_ENTRY"
    | "SYMBOLIC_LINK"
    | "UNEXPECTED_ENTRY"
    | "UNSUPPORTED_COMPRESSION";

export class BackupArchiveError extends Error {
    readonly code: BackupArchiveErrorCode;

    constructor(
        code: BackupArchiveErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.code = code;
        this.name = "BackupArchiveError";
    }
}

export interface BackupArchiveMetadata {
    archiveBytes: number;
    entryCount: number;
    ignoredPictureBytes: number;
    pictureCount: number;
    totalUncompressedBytes: number;
}

export interface BackupArchiveContents {
    database: Uint8Array;
    metadata: BackupArchiveMetadata;
    preferencesXml: Uint8Array;
    uiSettings?: Uint8Array;
}

export interface ReadBackupArchiveOptions {
    limits?: Partial<BackupArchiveLimits>;
}

type EntryKind = "database" | "picture" | "preferences" | "ui-settings";

function archiveError(
    code: BackupArchiveErrorCode,
    message: string,
    cause?: unknown,
): BackupArchiveError {
    return new BackupArchiveError(
        code,
        message,
        cause === undefined ? undefined : { cause },
    );
}

function resolveLimits(
    overrides: Partial<BackupArchiveLimits> | undefined,
): BackupArchiveLimits {
    const limits = { ...DEFAULT_BACKUP_ARCHIVE_LIMITS, ...overrides };
    for (const [name, value] of Object.entries(limits)) {
        if (!Number.isFinite(value) || value < 1) {
            throw archiveError(
                "ARCHIVE_LIMIT_EXCEEDED",
                `Archive limit ${name} must be a positive finite number`,
            );
        }
    }
    return limits;
}

function isSafeEntryPath(fileName: string): boolean {
    if (
        fileName.length === 0 ||
        fileName.includes("\0") ||
        fileName.includes("\\") ||
        fileName.startsWith("/") ||
        /^[A-Za-z]:/.test(fileName)
    ) {
        return false;
    }

    const parts = fileName.split("/");
    const lastPartIndex = parts.length - 1;
    return parts.every(
        (part, index) =>
            (part.length > 0 || index === lastPartIndex) &&
            part !== "." &&
            part !== "..",
    );
}

function isSymbolicLink(entry: Entry): boolean {
    const unixMode = entry.externalFileAttributes >>> 16;
    return (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMBOLIC_LINK;
}

function classifyEntry(fileName: string): EntryKind {
    if (fileName === DATABASE_ENTRY_NAME) {
        return "database";
    }
    if (fileName === PREFERENCES_ENTRY_NAME) {
        return "preferences";
    }
    if (fileName === UI_SETTINGS_ENTRY_NAME) {
        return "ui-settings";
    }
    if (
        fileName === PICTURES_DIRECTORY ||
        fileName.startsWith(PICTURES_DIRECTORY)
    ) {
        return "picture";
    }
    throw archiveError(
        "UNEXPECTED_ENTRY",
        "The backup contains an entry outside the allowlist",
    );
}

function assertSafeSize(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw archiveError(
            "ARCHIVE_LIMIT_EXCEEDED",
            "The backup declares an invalid entry size",
        );
    }
}

function entrySizeLimit(
    kind: EntryKind,
    limits: BackupArchiveLimits,
): number {
    switch (kind) {
        case "database":
            return limits.maxDatabaseBytes;
        case "picture":
            return limits.maxPictureBytes;
        case "preferences":
            return limits.maxPreferencesBytes;
        case "ui-settings":
            return limits.maxUiSettingsBytes;
    }
}

function validateEntry(
    entry: Entry,
    kind: EntryKind,
    limits: BackupArchiveLimits,
): void {
    if ((entry.generalPurposeBitFlag & ZIP_ENCRYPTED_FLAG) !== 0) {
        throw archiveError(
            "ENCRYPTED_ENTRY",
            "Encrypted backup entries are not supported",
        );
    }
    if (!SUPPORTED_COMPRESSION_METHODS.has(entry.compressionMethod)) {
        throw archiveError(
            "UNSUPPORTED_COMPRESSION",
            "The backup uses an unsupported compression method",
        );
    }
    if (isSymbolicLink(entry)) {
        throw archiveError(
            "SYMBOLIC_LINK",
            "Symbolic links are not allowed in backups",
        );
    }

    assertSafeSize(entry.compressedSize);
    assertSafeSize(entry.uncompressedSize);
    if (entry.uncompressedSize > entrySizeLimit(kind, limits)) {
        throw archiveError(
            "ARCHIVE_LIMIT_EXCEEDED",
            "A backup entry exceeds its uncompressed size limit",
        );
    }

    const compressionRatio =
        entry.uncompressedSize === 0
            ? 0
            : entry.uncompressedSize / Math.max(entry.compressedSize, 1);
    if (compressionRatio > limits.maxCompressionRatio) {
        throw archiveError(
            "ARCHIVE_LIMIT_EXCEEDED",
            "A backup entry exceeds the compression ratio limit",
        );
    }
}

async function readEntryBuffer(
    zipFile: ZipFile,
    entry: Entry,
    maximumBytes: number,
): Promise<Buffer> {
    let stream: NodeJS.ReadableStream;
    try {
        stream = await zipFile.openReadStreamPromise(entry);
    } catch (error) {
        throw archiveError("INVALID_ZIP", "Could not read a backup entry", error);
    }

    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let contents: Buffer;
    try {
        for await (const chunk of stream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytesRead += buffer.byteLength;
            if (bytesRead > maximumBytes) {
                throw archiveError(
                    "ARCHIVE_LIMIT_EXCEEDED",
                    "A backup entry exceeded its read limit",
                );
            }
            chunks.push(buffer);
        }
        if (bytesRead !== entry.uncompressedSize) {
            throw archiveError(
                "INVALID_ZIP",
                "A backup entry size does not match its ZIP metadata",
            );
        }
        contents = Buffer.concat(chunks, bytesRead);
    } catch (error) {
        if (error instanceof BackupArchiveError) {
            throw error;
        }
        throw archiveError("INVALID_ZIP", "Could not decode a backup entry", error);
    } finally {
        for (const chunk of chunks) chunk.fill(0);
    }

    try {
        let crc = 0xffffffff;
        for (const byte of contents) {
            const tableValue = CRC32_TABLE[(crc ^ byte) & 0xff];
            if (tableValue === undefined) {
                throw archiveError(
                    "INVALID_ZIP",
                    "Could not verify a backup entry",
                );
            }
            crc = tableValue ^ (crc >>> 8);
        }
        if (((crc ^ 0xffffffff) >>> 0) !== (entry.crc32 >>> 0)) {
            throw archiveError(
                "INVALID_ZIP",
                "A backup entry failed its ZIP integrity check",
            );
        }
        return contents;
    } catch (error) {
        contents.fill(0);
        throw error;
    }
}

async function assertZipMagic(
    fileHandle: Awaited<ReturnType<typeof open>>,
    archiveBytes: number,
): Promise<void> {
    if (archiveBytes < ZIP_LOCAL_FILE_HEADER.byteLength) {
        throw archiveError("INVALID_ZIP", "The backup is not a ZIP archive");
    }
    const magic = Buffer.alloc(ZIP_LOCAL_FILE_HEADER.byteLength);
    const { bytesRead } = await fileHandle.read(
        magic,
        0,
        magic.byteLength,
        0,
    );
    if (
        bytesRead !== magic.byteLength ||
        !magic.equals(ZIP_LOCAL_FILE_HEADER)
    ) {
        throw archiveError("INVALID_ZIP", "The backup is not a ZIP archive");
    }
}

/**
 * Reads one explicitly selected MyExpenses backup without extracting it.
 * Only the database, SharedPreferences XML and optional UI DataStore entry are
 * materialized; picture entries are validated and ignored.
 */
export async function readBackupArchive(
    filePath: string,
    options: ReadBackupArchiveOptions = {},
): Promise<BackupArchiveContents> {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
        throw archiveError(
            "INVALID_ARCHIVE_PATH",
            "An explicit backup file path is required",
        );
    }
    const limits = resolveLimits(options.limits);

    let pathStat: Awaited<ReturnType<typeof lstat>>;
    try {
        pathStat = await lstat(filePath);
    } catch (error) {
        throw archiveError(
            "INVALID_ARCHIVE_PATH",
            "The backup path could not be opened",
            error,
        );
    }
    if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
        throw archiveError(
            "INVALID_ARCHIVE_PATH",
            "The backup path must reference a regular file",
        );
    }

    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    let archiveBuffer: Buffer | undefined;
    let selectedEntries: Map<string, Buffer> | undefined;
    let keepSelectedEntries = false;
    try {
        fileHandle = await open(filePath, "r");
    } catch (error) {
        throw archiveError(
            "INVALID_ARCHIVE_PATH",
            "The backup path could not be opened",
            error,
        );
    }

    let zipFile: ZipFile | undefined;
    try {
        const fileStat = await fileHandle.stat();
        if (!fileStat.isFile()) {
            throw archiveError(
                "INVALID_ARCHIVE_PATH",
                "The backup path must reference a regular file",
            );
        }
        if (fileStat.dev !== pathStat.dev || fileStat.ino !== pathStat.ino) {
            throw archiveError(
                "INVALID_ARCHIVE_PATH",
                "The backup path changed while it was being opened",
            );
        }
        if (fileStat.size > limits.maxArchiveBytes) {
            throw archiveError(
                "ARCHIVE_LIMIT_EXCEEDED",
                "The backup exceeds the compressed archive size limit",
            );
        }
        await assertZipMagic(fileHandle, fileStat.size);
        archiveBuffer = await fileHandle.readFile();
        if (archiveBuffer.byteLength !== fileStat.size) {
            throw archiveError(
                "INVALID_ARCHIVE_PATH",
                "The backup file changed while it was being read",
            );
        }
        await fileHandle.close();
        fileHandle = undefined;

        try {
            zipFile = await yauzl.fromBufferPromise(archiveBuffer, {
                autoClose: false,
                decodeStrings: true,
                lazyEntries: true,
                strictFileNames: true,
                validateEntrySizes: true,
            });
        } catch (error) {
            throw archiveError("INVALID_ZIP", "The backup ZIP is invalid", error);
        }
        if (zipFile.fileSize !== archiveBuffer.byteLength) {
            throw archiveError(
                "INVALID_ARCHIVE_PATH",
                "The backup file changed while it was being opened",
            );
        }
        if (zipFile.entryCount > limits.maxEntryCount) {
            throw archiveError(
                "ARCHIVE_LIMIT_EXCEEDED",
                "The backup contains too many entries",
            );
        }

        const seenNames = new Set<string>();
        selectedEntries = new Map<string, Buffer>();
        let entryCount = 0;
        let ignoredPictureBytes = 0;
        let pictureCount = 0;
        let totalUncompressedBytes = 0;

        try {
            for await (const entry of zipFile.eachEntry()) {
                entryCount++;
                if (entryCount > limits.maxEntryCount) {
                    throw archiveError(
                        "ARCHIVE_LIMIT_EXCEEDED",
                        "The backup contains too many entries",
                    );
                }

                const normalizedName = entry.fileName.normalize("NFC");
                if (!isSafeEntryPath(normalizedName)) {
                    throw archiveError(
                        "INVALID_ENTRY_PATH",
                        "The backup contains an unsafe entry path",
                    );
                }
                if (seenNames.has(normalizedName)) {
                    throw archiveError(
                        "DUPLICATE_ENTRY",
                        "The backup contains duplicate entries",
                    );
                }
                seenNames.add(normalizedName);

                const kind = classifyEntry(normalizedName);
                validateEntry(entry, kind, limits);
                totalUncompressedBytes += entry.uncompressedSize;
                if (
                    !Number.isSafeInteger(totalUncompressedBytes) ||
                    totalUncompressedBytes > limits.maxTotalUncompressedBytes
                ) {
                    throw archiveError(
                        "ARCHIVE_LIMIT_EXCEEDED",
                        "The backup exceeds the total uncompressed size limit",
                    );
                }

                if (kind === "picture") {
                    ignoredPictureBytes += entry.uncompressedSize;
                    pictureCount++;
                    if (ignoredPictureBytes > limits.maxPicturesBytes) {
                        throw archiveError(
                            "ARCHIVE_LIMIT_EXCEEDED",
                            "The backup exceeds the ignored pictures size limit",
                        );
                    }
                    continue;
                }

                selectedEntries.set(
                    normalizedName,
                    await readEntryBuffer(
                        zipFile,
                        entry,
                        entrySizeLimit(kind, limits),
                    ),
                );
            }
        } catch (error) {
            if (error instanceof BackupArchiveError) {
                throw error;
            }
            throw archiveError("INVALID_ZIP", "The backup ZIP is invalid", error);
        }

        for (const entryName of REQUIRED_ENTRY_NAMES) {
            if (!selectedEntries.has(entryName)) {
                throw archiveError(
                    "MISSING_ENTRY",
                    "The backup is missing a required entry",
                );
            }
        }
        const database = selectedEntries.get(DATABASE_ENTRY_NAME);
        const preferencesXml = selectedEntries.get(PREFERENCES_ENTRY_NAME);
        if (database === undefined || preferencesXml === undefined) {
            throw archiveError(
                "MISSING_ENTRY",
                "The backup is missing a required entry",
            );
        }

        const uiSettings = selectedEntries.get(UI_SETTINGS_ENTRY_NAME);
        keepSelectedEntries = true;
        return {
            database,
            metadata: {
                archiveBytes: fileStat.size,
                entryCount,
                ignoredPictureBytes,
                pictureCount,
                totalUncompressedBytes,
            },
            preferencesXml,
            ...(uiSettings === undefined ? {} : { uiSettings }),
        };
    } finally {
        zipFile?.close();
        await fileHandle?.close();
        archiveBuffer?.fill(0);
        if (!keepSelectedEntries) {
            for (const entry of selectedEntries?.values() ?? []) entry.fill(0);
        }
    }
}
