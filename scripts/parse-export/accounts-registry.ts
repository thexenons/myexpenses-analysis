import type {
    AccountRegistryEntry,
    AccountsRegistry,
    AccountType,
    ExchangeRateMode,
    ExportAccount,
} from "../types.ts";
import {
    ACCOUNTS_REGISTRY_FILE_PATH,
    readOptionalJsonFile,
    writeJsonAtomically,
} from "../files.ts";

export const ACCOUNTS_REGISTRY_VERSION = 2 as const;

export type AccountIdentity = Pick<ExportAccount, "uuid" | "label">;

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAccountType(value: unknown): value is AccountType {
    return value === "DEFAULT" || value === "DEBT";
}

function isExchangeRateMode(value: unknown): value is ExchangeRateMode {
    return value === "DYNAMIC" || value === "STATIC";
}

function validateAccountIdentities(accounts: readonly AccountIdentity[]): {
    byLabel: Map<string, AccountIdentity>;
    byUuid: Map<string, AccountIdentity>;
} {
    const byLabel = new Map<string, AccountIdentity>();
    const byUuid = new Map<string, AccountIdentity>();
    for (const [index, account] of accounts.entries()) {
        if (!UUID_PATTERN.test(account.uuid)) {
            throw new Error(`accounts[${index}].uuid is not a canonical UUID`);
        }
        if (account.label.length === 0 || account.label !== account.label.trim()) {
            throw new Error(`accounts[${index}].label is invalid`);
        }
        if (byUuid.has(account.uuid)) {
            throw new Error(`Duplicate account UUID ${account.uuid}`);
        }
        if (byLabel.has(account.label)) {
            throw new Error(`Duplicate account label ${JSON.stringify(account.label)}`);
        }
        byUuid.set(account.uuid, account);
        byLabel.set(account.label, account);
    }
    return { byLabel, byUuid };
}

function parseVersionedRegistry(value: Record<string, unknown>): AccountsRegistry {
    for (const key of Object.keys(value)) {
        if (key !== "version" && key !== "accounts") {
            throw new Error(`Unexpected accounts registry property ${key}`);
        }
    }
    if (value.version !== ACCOUNTS_REGISTRY_VERSION || !isRecord(value.accounts)) {
        throw new Error("Invalid or unsupported accounts registry version");
    }

    const entries: Record<string, AccountRegistryEntry> = Object.create(null);
    for (const [uuid, rawEntry] of Object.entries(value.accounts)) {
        if (!UUID_PATTERN.test(uuid) || !isRecord(rawEntry)) {
            throw new Error(`Invalid accounts registry entry ${uuid}`);
        }
        for (const key of Object.keys(rawEntry)) {
            if (
                key !== "exchangeRateMode" &&
                key !== "exchangeRateToEur" &&
                key !== "label" &&
                key !== "type"
            ) {
                throw new Error(
                    `Unexpected property ${key} in accounts registry entry ${uuid}`,
                );
            }
        }
        const exchangeRateMode = rawEntry.exchangeRateMode;
        const exchangeRateToEur = rawEntry.exchangeRateToEur;
        if (
            typeof rawEntry.label !== "string" ||
            rawEntry.label.length === 0 ||
            rawEntry.label !== rawEntry.label.trim() ||
            !isAccountType(rawEntry.type) ||
            (exchangeRateMode !== undefined &&
                !isExchangeRateMode(exchangeRateMode)) ||
            (exchangeRateToEur !== undefined &&
                (typeof exchangeRateToEur !== "number" ||
                    !Number.isFinite(exchangeRateToEur) ||
                    exchangeRateToEur <= 0))
        ) {
            throw new Error(`Invalid accounts registry entry ${uuid}`);
        }
        entries[uuid] = {
            ...(exchangeRateMode === undefined ? {} : { exchangeRateMode }),
            ...(exchangeRateToEur === undefined ? {} : { exchangeRateToEur }),
            label: rawEntry.label,
            type: rawEntry.type,
        };
    }
    return {
        version: ACCOUNTS_REGISTRY_VERSION,
        accounts: entries,
    };
}

function migrateLegacyRegistry(
    value: Record<string, unknown>,
    byLabel: ReadonlyMap<string, AccountIdentity>,
    byUuid: ReadonlyMap<string, AccountIdentity>,
): Record<string, AccountRegistryEntry> {
    const entries: Record<string, AccountRegistryEntry> = Object.create(null);
    for (const [legacyKey, rawType] of Object.entries(value)) {
        if (!isAccountType(rawType)) {
            throw new Error(
                `Invalid legacy account type for ${JSON.stringify(legacyKey)}`,
            );
        }

        const account = byUuid.get(legacyKey) ?? byLabel.get(legacyKey);
        if (account === undefined) {
            throw new Error(
                `Cannot migrate legacy account ${JSON.stringify(legacyKey)}: no matching UUID or label`,
            );
        }
        const previous = entries[account.uuid];
        if (previous !== undefined && previous.type !== rawType) {
            throw new Error(
                `Conflicting legacy account types for UUID ${account.uuid}`,
            );
        }
        entries[account.uuid] = {
            label: account.label,
            type: rawType,
        };
    }
    return entries;
}

/**
 * Pure migration/update. UUID entries survive account renames; legacy labels are
 * resolved only when the mapping is unambiguous and complete.
 */
export function buildAccountsRegistry(
    accounts: readonly AccountIdentity[],
    previousValue?: unknown,
): AccountsRegistry {
    const { byLabel, byUuid } = validateAccountIdentities(accounts);
    let entries: Record<string, AccountRegistryEntry> = Object.create(null);

    if (previousValue !== undefined) {
        if (!isRecord(previousValue)) {
            throw new Error("Accounts registry must be a JSON object");
        }
        if (previousValue.version === ACCOUNTS_REGISTRY_VERSION) {
            entries = parseVersionedRegistry(previousValue).accounts;
        } else {
            entries = migrateLegacyRegistry(previousValue, byLabel, byUuid);
        }
    }

    const updatedEntries: Record<string, AccountRegistryEntry> =
        Object.create(null);
    for (const [uuid, entry] of Object.entries(entries)) {
        updatedEntries[uuid] = { ...entry };
    }
    for (const account of accounts) {
        const previousEntry = entries[account.uuid];
        updatedEntries[account.uuid] = {
            ...(previousEntry?.exchangeRateMode === undefined
                ? {}
                : { exchangeRateMode: previousEntry.exchangeRateMode }),
            ...(previousEntry?.exchangeRateToEur === undefined
                ? {}
                : { exchangeRateToEur: previousEntry.exchangeRateToEur }),
            label: account.label,
            type: previousEntry?.type ?? "DEFAULT",
        };
    }

    return {
        version: ACCOUNTS_REGISTRY_VERSION,
        accounts: updatedEntries,
    };
}

export async function loadAccountsRegistrySource(
    filePath = ACCOUNTS_REGISTRY_FILE_PATH,
): Promise<unknown | undefined> {
    return readOptionalJsonFile(filePath);
}

export async function saveAccountsRegistry(
    accountsRegistry: AccountsRegistry,
    filePath = ACCOUNTS_REGISTRY_FILE_PATH,
): Promise<void> {
    await writeJsonAtomically(filePath, accountsRegistry);
}
