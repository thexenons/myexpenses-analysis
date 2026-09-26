import {
    SyncConfigError,
    validateSyncPCloudSettings,
    type SyncPCloudSecrets,
    type SyncPCloudSettings,
} from "./config.ts";
import { validateStaticVaultPassphrase } from "../../src/domain/security/static-vault.ts";
import type { NotificationSettings } from "./notification-mail.ts";

export interface SyncPCloudRuntimeConfig {
    readonly config: SyncPCloudSettings;
    readonly secrets: SyncPCloudSecrets;
    readonly notifications?: NotificationSettings;
}

function notificationAddress(value: string): boolean {
    if (
        value.length < 3 || value.length > 254 ||
        /\s/.test(value) ||
        !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(value)
    ) return false;
    const domain = value.slice(value.lastIndexOf("@") + 1);
    return domain.length <= 253 && domain.includes(".") &&
        domain.split(".").every((label) =>
            label.length > 0 && label.length <= 63 &&
            /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
        );
}

function loadNotificationSettings(
    environment: NodeJS.ProcessEnv,
): NotificationSettings | undefined {
    const to = environment.MYEXPENSES_NOTIFICATION_TO;
    const from = environment.MYEXPENSES_NOTIFICATION_FROM;
    const password = environment.MYEXPENSES_SMTP_PASSWORD;
    if ([to, from, password].every((value) => value === undefined || value === "")) {
        return undefined;
    }
    if (
        to === undefined || from === undefined || password === undefined ||
        !notificationAddress(to) || !notificationAddress(from) ||
        password.length < 1 || Buffer.byteLength(password, "utf8") > 4_096 ||
        Array.from(password).some((character) => {
            const code = character.codePointAt(0)!;
            return code < 32 || code === 127;
        })
    ) {
        throw new SyncConfigError("Runtime notification configuration is invalid");
    }
    return { to, from, password };
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
    const notifications = loadNotificationSettings(environment);
    return { config, secrets: { token, vaultPassphrase }, ...(notifications === undefined ? {} : { notifications }) };
}
