import type {
    CurrencyCode,
    ExportData,
    IsoDate,
    TransactionStatus,
} from "../types.ts";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EXPORT_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TRANSACTION_STATUSES = new Set<TransactionStatus>([
    "UNRECONCILED",
    "RECONCILED",
    "VOID",
]);

const ACCOUNT_KEYS = new Set([
    "uuid",
    "label",
    "currency",
    "openingBalance",
    "transactions",
]);
const DIRECT_TRANSACTION_KEYS = new Set([
    "uuid",
    "status",
    "date",
    "amount",
    "comment",
    "tags",
    "payee",
    "category",
    "transferAccount",
]);
const SPLIT_TRANSACTION_KEYS = new Set([
    "uuid",
    "status",
    "date",
    "amount",
    "comment",
    "tags",
    "payee",
    "splits",
]);
const SPLIT_KEYS = new Set([
    "uuid",
    "date",
    "amount",
    "comment",
    "tags",
    "payee",
    "category",
    "transferAccount",
]);

interface PostingReference {
    accountLabel: string;
    amountInCents: number;
    categoryPath: string;
    currency: CurrencyCode;
    date: IsoDate;
    path: string;
    transferAccount?: string;
}

export class ExportDataValidationError extends Error {
    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = "ExportDataValidationError";
    }
}

function fail(path: string, message: string): never {
    throw new ExportDataValidationError(path, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
    value: unknown,
    path: string,
): asserts value is Record<string, unknown> {
    if (!isRecord(value)) {
        fail(path, "expected an object");
    }
}

function assertExactKeys(
    value: Record<string, unknown>,
    allowedKeys: ReadonlySet<string>,
    path: string,
): void {
    for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
            fail(`${path}.${key}`, "unexpected property");
        }
    }
}

function getRequired(
    value: Record<string, unknown>,
    key: string,
    path: string,
): unknown {
    if (!Object.hasOwn(value, key)) {
        fail(`${path}.${key}`, "missing required property");
    }
    return value[key];
}

function validateNonEmptyString(value: unknown, path: string): string {
    if (typeof value !== "string" || value.length === 0) {
        fail(path, "expected a non-empty string");
    }
    if (value !== value.trim()) {
        fail(path, "must not contain leading or trailing whitespace");
    }
    return value;
}

function validateOptionalString(
    value: Record<string, unknown>,
    key: string,
    path: string,
): void {
    if (Object.hasOwn(value, key) && typeof value[key] !== "string") {
        fail(`${path}.${key}`, "expected a string");
    }
}

function validateUuid(value: unknown, path: string): string {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        fail(path, "expected a canonical UUID");
    }
    return value;
}

function validateCurrency(value: unknown, path: string): CurrencyCode {
    if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
        fail(path, "expected a three-letter uppercase currency code");
    }
    return value as CurrencyCode;
}

function validateStatus(value: unknown, path: string): TransactionStatus {
    if (
        typeof value !== "string" ||
        !TRANSACTION_STATUSES.has(value as TransactionStatus)
    ) {
        fail(path, "expected UNRECONCILED, RECONCILED or VOID");
    }
    return value as TransactionStatus;
}

export function parseExportDate(value: unknown, path = "date"): IsoDate {
    if (typeof value !== "string") {
        fail(path, "expected a DD/MM/YYYY date string");
    }

    const match = EXPORT_DATE_PATTERN.exec(value.trim());
    if (match === null) {
        fail(path, "expected an exact DD/MM/YYYY date");
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
        fail(path, "date does not exist in the calendar");
    }

    return `${match[3]}-${match[2]}-${match[1]}` as IsoDate;
}

export function moneyToCents(value: unknown, path = "amount"): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(path, "expected a finite number");
    }

    const roundedCents = Math.round(value * 100);
    if (
        !Number.isSafeInteger(roundedCents) ||
        Math.abs(value - roundedCents / 100) > 1e-9
    ) {
        fail(path, "must be representable as a safe integer number of cents");
    }
    return roundedCents;
}

function validateTags(value: Record<string, unknown>, path: string): void {
    if (!Object.hasOwn(value, "tags")) {
        return;
    }
    if (!Array.isArray(value.tags)) {
        fail(`${path}.tags`, "expected an array");
    }
    for (const [index, tag] of value.tags.entries()) {
        validateNonEmptyString(tag, `${path}.tags[${index}]`);
    }
}

function validateCategory(value: unknown, path: string): void {
    if (!Array.isArray(value) || value.length === 0) {
        fail(path, "expected a non-empty category path");
    }
    for (const [index, segment] of value.entries()) {
        validateNonEmptyString(segment, `${path}[${index}]`);
    }
}

function validateBaseTransaction(
    value: Record<string, unknown>,
    path: string,
): { amountInCents: number; date: IsoDate; uuid: string } {
    const uuid = validateUuid(getRequired(value, "uuid", path), `${path}.uuid`);
    validateStatus(getRequired(value, "status", path), `${path}.status`);
    const date = parseExportDate(
        getRequired(value, "date", path),
        `${path}.date`,
    );
    const amountInCents = moneyToCents(
        getRequired(value, "amount", path),
        `${path}.amount`,
    );
    validateOptionalString(value, "comment", path);
    validateOptionalString(value, "payee", path);
    validateTags(value, path);
    return { amountInCents, date, uuid };
}

function validatePosting(
    value: unknown,
    path: string,
    accountLabel: string,
    currency: CurrencyCode,
    postingReferences: Map<string, PostingReference[]>,
): { amountInCents: number; date: IsoDate } {
    assertRecord(value, path);
    assertExactKeys(value, SPLIT_KEYS, path);

    const uuid = validateUuid(getRequired(value, "uuid", path), `${path}.uuid`);
    const date = parseExportDate(
        getRequired(value, "date", path),
        `${path}.date`,
    );
    const amountInCents = moneyToCents(
        getRequired(value, "amount", path),
        `${path}.amount`,
    );
    validateCategory(getRequired(value, "category", path), `${path}.category`);
    validateOptionalString(value, "comment", path);
    validateOptionalString(value, "payee", path);
    validateTags(value, path);

    const transferAccount = Object.hasOwn(value, "transferAccount")
        ? validateNonEmptyString(
              value.transferAccount,
              `${path}.transferAccount`,
          )
        : undefined;
    const references = postingReferences.get(uuid) ?? [];
    references.push({
        accountLabel,
        amountInCents,
        categoryPath: JSON.stringify(value.category),
        currency,
        date,
        path,
        transferAccount,
    });
    postingReferences.set(uuid, references);
    return { amountInCents, date };
}

function validateDirectTransaction(
    value: Record<string, unknown>,
    path: string,
    accountLabel: string,
    currency: CurrencyCode,
    postingReferences: Map<string, PostingReference[]>,
): void {
    assertExactKeys(value, DIRECT_TRANSACTION_KEYS, path);
    const { amountInCents, date } = validateBaseTransaction(value, path);
    validateCategory(getRequired(value, "category", path), `${path}.category`);

    const transferAccount = Object.hasOwn(value, "transferAccount")
        ? validateNonEmptyString(
              value.transferAccount,
              `${path}.transferAccount`,
          )
        : undefined;
    const uuid = value.uuid as string;
    const references = postingReferences.get(uuid) ?? [];
    references.push({
        accountLabel,
        amountInCents,
        categoryPath: JSON.stringify(value.category),
        currency,
        date,
        path,
        transferAccount,
    });
    postingReferences.set(uuid, references);
}

function validateSplitTransaction(
    value: Record<string, unknown>,
    path: string,
    accountLabel: string,
    currency: CurrencyCode,
    postingReferences: Map<string, PostingReference[]>,
    splitParentUuids: Map<string, string>,
): void {
    assertExactKeys(value, SPLIT_TRANSACTION_KEYS, path);
    const { amountInCents, date: parentDate, uuid } = validateBaseTransaction(
        value,
        path,
    );
    const previousParentPath = splitParentUuids.get(uuid);
    if (previousParentPath !== undefined) {
        fail(`${path}.uuid`, `duplicates split parent at ${previousParentPath}`);
    }
    splitParentUuids.set(uuid, path);

    const splits = getRequired(value, "splits", path);
    if (!Array.isArray(splits) || splits.length === 0) {
        fail(`${path}.splits`, "expected at least one split");
    }

    let splitSumInCents = 0;
    for (const [index, split] of splits.entries()) {
        const splitPath = `${path}.splits[${index}]`;
        const validatedSplit = validatePosting(
            split,
            splitPath,
            accountLabel,
            currency,
            postingReferences,
        );
        if (validatedSplit.date !== parentDate) {
            fail(`${splitPath}.date`, "must match the split parent date");
        }
        splitSumInCents += validatedSplit.amountInCents;
        if (!Number.isSafeInteger(splitSumInCents)) {
            fail(`${path}.splits`, "sum exceeds the safe cents range");
        }
    }
    if (splitSumInCents !== amountInCents) {
        fail(
            `${path}.splits`,
            `sum is ${splitSumInCents} cents but parent is ${amountInCents} cents`,
        );
    }
}

function validateReferences(
    accountLabels: ReadonlySet<string>,
    postingReferences: ReadonlyMap<string, PostingReference[]>,
    splitParentUuids: ReadonlyMap<string, string>,
): void {
    for (const [parentUuid, parentPath] of splitParentUuids) {
        if (postingReferences.has(parentUuid)) {
            fail(
                `${parentPath}.uuid`,
                "split parent UUID is also used by a posting",
            );
        }
    }

    for (const [uuid, references] of postingReferences) {
        for (const reference of references) {
            if (
                reference.transferAccount !== undefined &&
                !accountLabels.has(reference.transferAccount)
            ) {
                fail(
                    `${reference.path}.transferAccount`,
                    `unknown account label ${JSON.stringify(reference.transferAccount)}`,
                );
            }
            if (reference.transferAccount === reference.accountLabel) {
                fail(
                    `${reference.path}.transferAccount`,
                    "cannot reference its own account",
                );
            }
        }

        if (references.length === 1) {
            if (references[0]?.transferAccount !== undefined) {
                fail(
                    `${references[0].path}.uuid`,
                    `transfer UUID ${uuid} has no reciprocal posting`,
                );
            }
            continue;
        }
        if (references.length !== 2) {
            fail(
                `${references[0]?.path ?? "exportData"}.uuid`,
                `posting UUID ${uuid} occurs ${references.length} times`,
            );
        }

        const [left, right] = references;
        if (
            left === undefined ||
            right === undefined ||
            left.transferAccount !== right.accountLabel ||
            right.transferAccount !== left.accountLabel
        ) {
            fail(
                `${left?.path ?? "exportData"}.uuid`,
                `duplicate posting UUID ${uuid} is not a reciprocal transfer pair`,
            );
        }
        if (left.date !== right.date) {
            fail(`${left.path}.date`, `transfer pair ${uuid} has different dates`);
        }
        if (left.categoryPath !== right.categoryPath) {
            fail(
                `${left.path}.category`,
                `transfer pair ${uuid} has different category paths`,
            );
        }
        if (
            left.currency === right.currency &&
            left.amountInCents + right.amountInCents !== 0
        ) {
            fail(
                `${left.path}.amount`,
                `same-currency transfer pair ${uuid} does not cancel`,
            );
        }
        if (
            left.currency !== right.currency &&
            !(
                (left.amountInCents < 0 && right.amountInCents > 0) ||
                (left.amountInCents > 0 && right.amountInCents < 0) ||
                (left.amountInCents === 0 && right.amountInCents === 0)
            )
        ) {
            fail(
                `${left.path}.amount`,
                `cross-currency transfer pair ${uuid} must have opposite signs`,
            );
        }
    }
}

/**
 * Validates the complete external-data boundary before any derived artifact is
 * built. It returns the same value; normalization happens in parseExportData.
 */
export function validateExportData(value: unknown): ExportData {
    if (!Array.isArray(value)) {
        fail("exportData", "expected an array of accounts");
    }

    const accountUuids = new Map<string, string>();
    const accountLabels = new Set<string>();
    const postingReferences = new Map<string, PostingReference[]>();
    const splitParentUuids = new Map<string, string>();

    for (const [accountIndex, accountValue] of value.entries()) {
        const accountPath = `exportData[${accountIndex}]`;
        assertRecord(accountValue, accountPath);
        assertExactKeys(accountValue, ACCOUNT_KEYS, accountPath);

        const uuid = validateUuid(
            getRequired(accountValue, "uuid", accountPath),
            `${accountPath}.uuid`,
        );
        const previousUuidPath = accountUuids.get(uuid);
        if (previousUuidPath !== undefined) {
            fail(`${accountPath}.uuid`, `duplicates account at ${previousUuidPath}`);
        }
        accountUuids.set(uuid, accountPath);

        const label = validateNonEmptyString(
            getRequired(accountValue, "label", accountPath),
            `${accountPath}.label`,
        );
        if (accountLabels.has(label)) {
            fail(`${accountPath}.label`, `duplicate account label ${JSON.stringify(label)}`);
        }
        accountLabels.add(label);

        const currency = validateCurrency(
            getRequired(accountValue, "currency", accountPath),
            `${accountPath}.currency`,
        );
        moneyToCents(
            getRequired(accountValue, "openingBalance", accountPath),
            `${accountPath}.openingBalance`,
        );

        const transactions = getRequired(
            accountValue,
            "transactions",
            accountPath,
        );
        if (!Array.isArray(transactions)) {
            fail(`${accountPath}.transactions`, "expected an array");
        }
        for (const [transactionIndex, transactionValue] of transactions.entries()) {
            const transactionPath = `${accountPath}.transactions[${transactionIndex}]`;
            assertRecord(transactionValue, transactionPath);
            if (Object.hasOwn(transactionValue, "splits")) {
                validateSplitTransaction(
                    transactionValue,
                    transactionPath,
                    label,
                    currency,
                    postingReferences,
                    splitParentUuids,
                );
            } else {
                validateDirectTransaction(
                    transactionValue,
                    transactionPath,
                    label,
                    currency,
                    postingReferences,
                );
            }
        }
    }

    validateReferences(accountLabels, postingReferences, splitParentUuids);
    return value as ExportData;
}
