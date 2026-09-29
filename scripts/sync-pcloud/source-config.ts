import { SyncConfigError } from "./config.ts";
import {
    normalizePCloudId,
    validateApiHost,
    validateFolderPath,
    type PCloudApiHost,
    type PCloudFolderSelector,
} from "./pcloud.ts";

export interface PCloudSourceConfig {
    readonly apiHost: PCloudApiHost;
    readonly folder: PCloudFolderSelector;
    readonly token: string;
}

/** Shared source credentials only; deployment policy belongs to the worker. */
export function loadPCloudSourceConfig(environment: NodeJS.ProcessEnv): PCloudSourceConfig {
    const folderId = environment.PCLOUD_FOLDER_ID || undefined;
    const folderPath = environment.PCLOUD_FOLDER_PATH || undefined;
    if ((folderId === undefined) === (folderPath === undefined)) {
        throw new SyncConfigError("Exactly one of PCLOUD_FOLDER_ID or PCLOUD_FOLDER_PATH is required");
    }
    if (environment.PCLOUD_API_HOST === undefined) {
        throw new SyncConfigError("PCLOUD_API_HOST is required");
    }
    let apiHost: PCloudApiHost;
    let folder: PCloudFolderSelector;
    try {
        apiHost = validateApiHost(environment.PCLOUD_API_HOST);
        folder = folderId !== undefined
            ? { folderId: normalizePCloudId(folderId, "pCloud folderId") }
            : { path: validateFolderPath(folderPath!) };
    } catch {
        // Validator/platform causes can contain supplied environment values.
        throw new SyncConfigError("Runtime pCloud settings are invalid");
    }
    const token = environment.PCLOUD_TOKEN;
    if (
        token === undefined || token.length === 0 ||
        Buffer.byteLength(token, "utf8") > 4_096 ||
        token.includes("\0") || token.includes("\n") || token.includes("\r") ||
        new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(token)) !== token
    ) {
        throw new SyncConfigError("PCLOUD_TOKEN is missing or invalid");
    }
    return { apiHost, folder, token };
}
