import {
    SyncConfigError,
    validateSyncPCloudSettings,
    type SyncPCloudSecrets,
    type SyncPCloudSettings,
} from "./config.ts";
import { validateStaticVaultPassphrase } from "../../src/domain/security/static-vault.ts";

export interface SyncPCloudRuntimeConfig {
    readonly config: SyncPCloudSettings;
    readonly secrets: SyncPCloudSecrets;
}

export function loadSyncPCloudRuntimeConfig(
    environment: NodeJS.ProcessEnv,
): SyncPCloudRuntimeConfig {
    const folderId = environment.PCLOUD_FOLDER_ID || undefined;
    const folderPath = environment.PCLOUD_FOLDER_PATH || undefined;
    const hasFolderId = folderId !== undefined;
    const hasFolderPath = folderPath !== undefined;
    if (hasFolderId === hasFolderPath) {
        throw new SyncConfigError(
            "Exactly one of PCLOUD_FOLDER_ID or PCLOUD_FOLDER_PATH is required",
        );
    }
    if (environment.PCLOUD_API_HOST === undefined) {
        throw new SyncConfigError("PCLOUD_API_HOST is required");
    }

    let config: SyncPCloudSettings;
    try {
        config = validateSyncPCloudSettings({
            apiHost: environment.PCLOUD_API_HOST,
            deployRoot: environment.MYEXPENSES_DEPLOY_ROOT ?? "/srv/myexpenses",
            folderId,
            path: folderPath,
            repositoryRoot: environment.MYEXPENSES_REPOSITORY_ROOT ?? "/app",
            timeZone: environment.MYEXPENSES_TIME_ZONE ?? "Europe/Madrid",
        });
    } catch {
        // Do not retain validator causes: a platform error can contain env values.
        throw new SyncConfigError("Runtime pCloud settings are invalid");
    }

    const token = environment.PCLOUD_TOKEN;
    if (
        token === undefined ||
        token.length === 0 ||
        Buffer.byteLength(token, "utf8") > 4_096 ||
        token.includes("\0") ||
        token.includes("\n") ||
        token.includes("\r") ||
        new TextDecoder("utf-8", { fatal: true }).decode(
            new TextEncoder().encode(token),
        ) !== token
    ) {
        throw new SyncConfigError("PCLOUD_TOKEN is missing or invalid");
    }

    const vaultPassphrase = environment.MYEXPENSES_VAULT_PASSPHRASE;
    if (
        vaultPassphrase === undefined ||
        vaultPassphrase.includes("\0") ||
        vaultPassphrase.includes("\n") ||
        vaultPassphrase.includes("\r")
    ) {
        throw new SyncConfigError("MYEXPENSES_VAULT_PASSPHRASE is missing or invalid");
    }
    try {
        validateStaticVaultPassphrase(vaultPassphrase);
    } catch {
        throw new SyncConfigError("MYEXPENSES_VAULT_PASSPHRASE is missing or invalid");
    }
    return { config, secrets: { token, vaultPassphrase } };
}
