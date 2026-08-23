import type {
    BackupAccountV1,
    BackupBudgetGrouping,
    BackupBudgetFilterV1,
    BackupBudgetV1,
    BackupCategoryType,
    BackupCategoryV1,
    BackupCommodityType,
    BackupCurrencyCode,
    BackupCurrencyV1,
    BackupDatasetV1,
    BackupExchangeRateMode,
    BackupFxSource,
    BackupNativeAccountType,
    BackupPaymentMethodType,
    BackupPaymentMethodV1,
    BackupPostingBucket,
    BackupPostingV1,
    BackupSplitProvenanceV1,
    BackupTransactionStatus,
} from "../../src/domain/analytics/backup-dataset.types.ts";
import type {
    V189Account,
    V189Budget,
    V189CanonicalDataset,
    V189Category,
    V189CategoryType,
    V189Currency,
    V189FxSource,
    V189PaymentMethod,
    V189Posting,
    V189PostingBucket,
    V189ReconciliationStatus,
} from "./v189/models.ts";
import type {
    BudgetFilterSource,
    BudgetUiSettings,
} from "./ui-settings.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY_PATTERN = /^[A-Z][A-Z0-9]{2,11}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export interface AppDatasetPreferenceInput {
    homeCurrency: string;
    includeTransfers: boolean;
    monthStart: number;
    unmappedTransactionsAsTransfers: boolean;
    /** java.util.Calendar weekday: Sunday=1 through Saturday=7. */
    weekStart: number;
}

export interface CreateAppDatasetOptions {
    backupSha256: string;
    canonical: V189CanonicalDataset;
    databaseSha256: string;
    budgetUiSettings: ReadonlyMap<number, BudgetUiSettings>;
    preferences: AppDatasetPreferenceInput;
    timeZone: string;
}

function fail(context: string, message: string): never {
    throw new Error(`${context}: ${message}`);
}

function safeInteger(value: number, context: string): number {
    if (!Number.isSafeInteger(value)) {
        fail(context, "expected a safe integer");
    }
    return value === 0 ? 0 : value;
}

function nonNegativeInteger(value: number, context: string): number {
    const integer = safeInteger(value, context);
    if (integer < 0) {
        fail(context, "expected a non-negative integer");
    }
    return integer;
}

function nonEmptyString(value: string, context: string): string {
    if (value.length === 0) {
        fail(context, "expected a non-empty string");
    }
    return value;
}

function optionalText(value: string | null): string | null {
    return value === null || value.length === 0 ? null : value;
}

function uuid(value: string | null, context: string): string {
    if (value === null || !UUID_PATTERN.test(value)) {
        fail(context, "expected a canonical UUID");
    }
    return value;
}

function currencyCode(value: string, context: string): BackupCurrencyCode {
    if (!CURRENCY_PATTERN.test(value)) {
        fail(context, "expected an uppercase currency or commodity code");
    }
    return value as BackupCurrencyCode;
}

function positiveRate(value: number | null, context: string): number {
    if (value === null || !Number.isFinite(value) || value <= 0) {
        fail(context, "expected a positive exchange rate");
    }
    return value;
}

function uniqueMap<T>(
    values: readonly T[],
    key: (value: T) => number | string,
    context: string,
): Map<number | string, T> {
    const result = new Map<number | string, T>();
    for (const value of values) {
        const id = key(value);
        if (result.has(id)) {
            fail(context, `duplicate identifier ${String(id)}`);
        }
        result.set(id, value);
    }
    return result;
}

function requiredReference<T>(
    values: ReadonlyMap<number | string, T>,
    id: number | string,
    context: string,
): T {
    return values.get(id) ?? fail(context, `unknown reference ${String(id)}`);
}

function sameIds(
    actual: readonly number[],
    expected: readonly number[],
): boolean {
    return (
        actual.length === expected.length &&
        actual.every((value, index) => value === expected[index])
    );
}

function stableIds(ids: readonly number[], context: string): number[] {
    const result = [...new Set(ids.map((id) => nonNegativeInteger(id, context)))];
    return result.toSorted((left, right) => left - right);
}

function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
            ? 29
            : 28;
    }
    return month === 4 || month === 6 || month === 9 || month === 11
        ? 30
        : 31;
}

function isoDate(value: string, context: string): string {
    const match = ISO_DATE_PATTERN.exec(value);
    if (match === null) {
        fail(context, "expected an ISO date");
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
        year < 1 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > daysInMonth(year, month)
    ) {
        fail(context, "expected an existing calendar date");
    }
    return value;
}

function localTime(value: string, context: string): string {
    if (!LOCAL_TIME_PATTERN.test(value)) {
        fail(context, "expected a local time in HH:mm:ss form");
    }
    return value;
}

function mapCommodityType(
    value: string | null,
    context: string,
): BackupCommodityType | null {
    if (value === null) {
        return null;
    }
    if (value === "FIAT" || value === "SECURITY" || value === "CRYPTO") {
        return value;
    }
    return fail(context, "unsupported commodity type");
}

function mapCurrency(currency: V189Currency): BackupCurrencyV1 {
    const context = `Currency ${currency.id}`;
    const fractionDigits = nonNegativeInteger(
        currency.fractionDigits,
        `${context} fractionDigits`,
    );
    if (fractionDigits > 18) {
        fail(context, "fractionDigits must not exceed 18");
    }
    return {
        sourceId: nonNegativeInteger(currency.id, `${context} sourceId`),
        code: currencyCode(currency.code, `${context} code`),
        fractionDigits,
        label: optionalText(currency.label),
        symbol: optionalText(currency.symbol),
        commodityType: mapCommodityType(
            currency.commodityType,
            `${context} commodityType`,
        ),
    };
}

function mapNativeAccountType(
    value: number,
    context: string,
): BackupNativeAccountType {
    switch (value) {
        case 1:
            return "CASH";
        case 2:
            return "BANK";
        case 3:
            return "CCARD";
        case 4:
            return "ASSET";
        case 5:
            return "LIABILITY";
        case 6:
            return "INVST";
        default:
            return fail(context, "unsupported native account type");
    }
}

function accountExchangeRateMode(
    account: V189Account,
    homeCurrency: string,
): BackupExchangeRateMode {
    if (account.currency === homeCurrency) {
        if (account.dynamicExchangeRates || account.exchangeRateToHome !== 1) {
            fail(`Account ${account.id}`, "invalid home-currency FX metadata");
        }
        return "IDENTITY";
    }
    if (account.dynamicExchangeRates) {
        return "DYNAMIC";
    }
    positiveRate(
        account.exchangeRateToHome,
        `Account ${account.id} exchangeRateToHome`,
    );
    return "STATIC";
}

interface MappingIndexes {
    accountById: ReadonlyMap<number | string, V189Account>;
    categoryById: ReadonlyMap<number | string, V189Category>;
    currencyByCode: ReadonlyMap<number | string, V189Currency>;
    methodById: ReadonlyMap<number | string, V189PaymentMethod>;
    payeeIds: ReadonlySet<number>;
    postingById: ReadonlyMap<number | string, V189Posting>;
    tagIds: ReadonlySet<number>;
}

function mapAccount(
    account: V189Account,
    indexes: MappingIndexes,
    homeCurrency: string,
): BackupAccountV1 {
    const context = `Account ${account.id}`;
    const nativeType = mapNativeAccountType(account.typeId, `${context} type`);
    const isLiability = nativeType === "LIABILITY";
    if (account.isLiability !== isLiability) {
        fail(context, "liability flag disagrees with native type 5");
    }
    const accountUuid = uuid(account.uuid, `${context} UUID`);
    const currency = requiredReference(
        indexes.currencyByCode,
        account.currency,
        `${context} currency`,
    );
    const parent =
        account.parentId === null
            ? null
            : requiredReference(
                  indexes.accountById,
                  account.parentId,
                  `${context} parent`,
              );
    return {
        uuid: accountUuid,
        sourceId: nonNegativeInteger(account.id, `${context} sourceId`),
        label: nonEmptyString(account.label, `${context} label`),
        description: optionalText(account.description),
        currency: currencyCode(account.currency, `${context} currency code`),
        fractionDigits: currency.fractionDigits,
        nativeType,
        scope: isLiability ? "DEBT" : "DEFAULT",
        parentUuid: parent === null ? null : uuid(parent.uuid, `${context} parent UUID`),
        openingNativeMinor: safeInteger(
            account.openingBalanceMinor,
            `${context} opening native balance`,
        ),
        openingHomeMinor: safeInteger(
            account.openingBalanceHomeMinor,
            `${context} opening home balance`,
        ),
        exchangeRateMode: accountExchangeRateMode(account, homeCurrency),
        exchangeRateToHome:
            account.exchangeRateToHome === null
                ? null
                : positiveRate(
                      account.exchangeRateToHome,
                      `${context} exchangeRateToHome`,
                  ),
        flags: {
            sourceId: nonNegativeInteger(account.flagId, `${context} flag id`),
            visible: account.visible,
            excludedFromTotals: account.excludedFromTotals,
            includedInAll: account.includedInAll,
            isAsset: account.isAsset,
            supportsReconciliation: account.supportsReconciliation,
        },
        balances: {
            currentNativeMinor: safeInteger(
                account.nativeClosingBalanceMinor,
                `${context} current native balance`,
            ),
            historicalHomeMinor: safeInteger(
                account.historicalClosingBalanceHomeMinor,
                `${context} historical home balance`,
            ),
            valuationHomeMinor: safeInteger(
                account.valuationBalanceHomeMinor,
                `${context} valuation home balance`,
            ),
        },
    };
}

function mapCategoryType(
    value: V189CategoryType,
    context: string,
): BackupCategoryType {
    switch (value) {
        case 0:
            return "TRANSFER";
        case 1:
            return "EXPENSE";
        case 2:
            return "INCOME";
        case 3:
            return "NEUTRAL";
        default:
            return fail(context, "unsupported category type");
    }
}

function mapCategory(
    category: V189Category,
    indexes: MappingIndexes,
): BackupCategoryV1 {
    const context = `Category ${category.id}`;
    const categoryUuid = uuid(category.uuid, `${context} UUID`);
    const parent =
        category.parentId === null
            ? null
            : requiredReference(
                  indexes.categoryById,
                  category.parentId,
                  `${context} parent`,
              );
    const name = nonEmptyString(category.label, `${context} name`);
    if (
        category.path.length === 0 ||
        category.path.at(-1) !== name ||
        category.path.some((part) => part.length === 0)
    ) {
        fail(context, "invalid category path");
    }
    if (parent !== null) {
        const expectedPath = [...parent.path, name];
        if (JSON.stringify(expectedPath) !== JSON.stringify(category.path)) {
            fail(context, "category path does not extend its parent");
        }
    } else if (category.path.length !== 1) {
        fail(context, "root category path must have one component");
    }
    return {
        uuid: categoryUuid,
        sourceId: nonNegativeInteger(category.id, `${context} sourceId`),
        name,
        type: mapCategoryType(category.type, `${context} type`),
        parentUuid:
            parent === null ? null : uuid(parent.uuid, `${context} parent UUID`),
        path: [...category.path],
        color:
            category.color === null
                ? null
                : safeInteger(category.color, `${context} color`),
        icon: optionalText(category.icon),
    };
}

function mapPostingBucket(
    value: V189PostingBucket,
    context: string,
): BackupPostingBucket {
    switch (value) {
        case "EXPENSE":
            return "expense";
        case "INCOME":
            return "income";
        case "TRANSFER":
            return "transfer";
        default:
            return fail(context, "unsupported posting bucket");
    }
}

function mapStatus(
    value: V189ReconciliationStatus,
    context: string,
): BackupTransactionStatus {
    if (
        value === "UNRECONCILED" ||
        value === "CLEARED" ||
        value === "RECONCILED" ||
        value === "VOID"
    ) {
        return value;
    }
    return fail(context, "unsupported reconciliation status");
}

function mapFxSource(value: V189FxSource, context: string): BackupFxSource {
    if (
        value === "HOME_CURRENCY" ||
        value === "STATIC_ACCOUNT_RATE" ||
        value === "DYNAMIC_EQUIVALENT" ||
        value === "DYNAMIC_SPLIT_PRORATION" ||
        value === "ZERO_AMOUNT_WITHOUT_RATE"
    ) {
        return value;
    }
    return fail(context, "unsupported FX source");
}

function canonicalPostingId(accountUuid: string, transactionUuid: string): string {
    return `${accountUuid}:${transactionUuid}`;
}

function assertKnownIds(
    ids: readonly number[],
    knownIds: ReadonlySet<number>,
    context: string,
): void {
    for (const id of ids) {
        if (!knownIds.has(id)) {
            fail(context, `unknown reference ${id}`);
        }
    }
}

function mapSplit(
    posting: V189Posting,
    accountUuid: string,
    indexes: MappingIndexes,
    context: string,
): BackupSplitProvenanceV1 | null {
    if (!posting.isSplitPart) {
        if (posting.splitIndex !== null || posting.splitCount !== null) {
            fail(context, "non-split posting contains split indexes");
        }
        return null;
    }
    if (
        posting.parentTransactionId === null ||
        posting.parentUuid === null ||
        posting.parentDate === null ||
        posting.parentAmountMinor === null ||
        posting.splitIndex === null ||
        posting.splitCount === null
    ) {
        return fail(context, "split parent provenance is incomplete");
    }
    const parentUuid = uuid(posting.parentUuid, `${context} parent UUID`);
    const index = nonNegativeInteger(posting.splitIndex, `${context} split index`);
    const count = nonNegativeInteger(posting.splitCount, `${context} split count`);
    if (count < 1 || index >= count) {
        fail(context, "split index and count are inconsistent");
    }
    if (
        posting.parentPayeeId !== null &&
        !indexes.payeeIds.has(posting.parentPayeeId)
    ) {
        fail(context, "split parent references an unknown payee");
    }
    if (
        posting.parentMethodId !== null &&
        !indexes.methodById.has(posting.parentMethodId)
    ) {
        fail(context, "split parent references an unknown payment method");
    }
    const parentTagIds = stableIds(
        posting.parentTagIds,
        `${context} split parent tags`,
    );
    assertKnownIds(parentTagIds, indexes.tagIds, `${context} split parent tags`);
    return {
        index,
        count,
        parent: {
            postingId: canonicalPostingId(accountUuid, parentUuid),
            sourceId: nonNegativeInteger(
                posting.parentTransactionId,
                `${context} split parent sourceId`,
            ),
            transactionUuid: parentUuid,
            epochSeconds: nonNegativeInteger(
                posting.parentDate.epochSeconds,
                `${context} split parent epoch`,
            ),
            localDate: isoDate(
                posting.parentDate.localDate,
                `${context} split parent date`,
            ),
            localTime: localTime(
                posting.parentDate.localTime,
                `${context} split parent time`,
            ),
            amountNativeMinor: safeInteger(
                posting.parentAmountMinor,
                `${context} split parent amount`,
            ),
            comment: optionalText(posting.parentComment),
            payeeSourceId: posting.parentPayeeId,
            paymentMethodSourceId: posting.parentMethodId,
            tagSourceIds: parentTagIds,
        },
    };
}

function mapPosting(
    posting: V189Posting,
    indexes: MappingIndexes,
    postingIdBySourceId: ReadonlyMap<number, string>,
    homeCurrency: string,
): BackupPostingV1 {
    const context = `Posting ${posting.id}`;
    const account = requiredReference(
        indexes.accountById,
        posting.accountId,
        `${context} account`,
    );
    const accountUuid = uuid(account.uuid, `${context} account UUID`);
    if (posting.accountCurrency !== account.currency) {
        fail(context, "account currency metadata disagrees");
    }
    const transactionUuid = uuid(posting.uuid, `${context} transaction UUID`);
    const id =
        postingIdBySourceId.get(posting.id) ??
        fail(context, "canonical posting id is missing");
    const category =
        posting.categoryId === null
            ? null
            : requiredReference(
                  indexes.categoryById,
                  posting.categoryId,
                  `${context} category`,
              );
    if (
        category === null
            ? posting.categoryPath.length !== 0
            : category.type !== posting.categoryType ||
              JSON.stringify(category.path) !== JSON.stringify(posting.categoryPath)
    ) {
        fail(context, "category metadata disagrees with the category registry");
    }
    const categoryType = mapCategoryType(
        posting.categoryType,
        `${context} category type`,
    );
    const bucket = mapPostingBucket(posting.bucket, `${context} bucket`);
    if (
        (categoryType === "TRANSFER" && bucket !== "transfer") ||
        (categoryType === "EXPENSE" && bucket !== "expense") ||
        (categoryType === "INCOME" && bucket !== "income") ||
        (categoryType === "NEUTRAL" && bucket === "transfer")
    ) {
        fail(context, "category type and bucket disagree");
    }
    const status = mapStatus(posting.reconciliationStatus, `${context} status`);
    if ((status === "VOID") !== posting.isVoid) {
        fail(context, "VOID status and flag disagree");
    }

    if (posting.payeeId !== null && !indexes.payeeIds.has(posting.payeeId)) {
        fail(context, "unknown payee reference");
    }
    if (posting.methodId !== null && !indexes.methodById.has(posting.methodId)) {
        fail(context, "unknown payment-method reference");
    }
    const tagSourceIds = stableIds(posting.effectiveTagIds, `${context} tags`);
    assertKnownIds(tagSourceIds, indexes.tagIds, `${context} tags`);
    const expectedEffectiveTags = stableIds(
        [...posting.tagIds, ...posting.parentTagIds],
        `${context} effective tags`,
    );
    if (!sameIds(tagSourceIds, expectedEffectiveTags)) {
        fail(context, "effective tags disagree with child and parent tags");
    }

    const expectedPayees = stableIds(
        [posting.payeeId, posting.parentPayeeId].filter(
            (value): value is number => value !== null,
        ),
        `${context} effective payees`,
    );
    if (!sameIds(stableIds(posting.effectivePayeeIds, context), expectedPayees)) {
        fail(context, "effective payees disagree with child and parent payees");
    }
    const expectedMethods = stableIds(
        [posting.methodId, posting.parentMethodId].filter(
            (value): value is number => value !== null,
        ),
        `${context} effective methods`,
    );
    if (!sameIds(stableIds(posting.effectiveMethodIds, context), expectedMethods)) {
        fail(context, "effective methods disagree with child and parent methods");
    }

    let transferPeer: BackupPostingV1["transferPeer"];
    if (posting.transferPeerId !== null) {
        const peer = requiredReference(
            indexes.postingById,
            posting.transferPeerId,
            `${context} transfer peer`,
        );
        const peerAccount = requiredReference(
            indexes.accountById,
            peer.accountId,
            `${context} transfer peer account`,
        );
        const peerUuid = uuid(peer.uuid, `${context} transfer peer UUID`);
        if (
            peer.transferPeerId !== posting.id ||
            peerUuid !== transactionUuid ||
            posting.transferAccountId !== peer.accountId ||
            peer.transferAccountId !== posting.accountId
        ) {
            fail(context, "transfer peer is not reciprocal and complete");
        }
        transferPeer = {
            postingId:
                postingIdBySourceId.get(peer.id) ??
                fail(context, "transfer peer canonical id is missing"),
            sourceId: nonNegativeInteger(peer.id, `${context} peer sourceId`),
            transactionUuid: peerUuid,
            accountUuid: uuid(peerAccount.uuid, `${context} peer account UUID`),
        };
    } else if (posting.transferAccountId !== null) {
        fail(context, "transfer account exists without a transfer peer");
    }

    const amountNativeMinor = safeInteger(
        posting.amountMinor,
        `${context} native amount`,
    );
    const amountHomeMinor = safeInteger(
        posting.amountHomeMinor,
        `${context} home amount`,
    );
    const fxSource = mapFxSource(posting.fxSource, `${context} FX source`);
    let exchangeRateToHome: number | null;
    if (fxSource === "ZERO_AMOUNT_WITHOUT_RATE") {
        if (
            posting.fxRateToHome !== null ||
            amountNativeMinor !== 0 ||
            amountHomeMinor !== 0 ||
            account.currency === homeCurrency
        ) {
            fail(context, "invalid zero-amount missing-rate metadata");
        }
        exchangeRateToHome = null;
    } else {
        exchangeRateToHome = positiveRate(
            posting.fxRateToHome,
            `${context} exchangeRateToHome`,
        );
    }
    if (
        account.currency === homeCurrency &&
        (fxSource !== "HOME_CURRENCY" ||
            exchangeRateToHome !== 1 ||
            amountHomeMinor !== amountNativeMinor)
    ) {
        fail(context, "home-currency posting has invalid FX metadata");
    }
    if (account.currency !== homeCurrency && fxSource === "HOME_CURRENCY") {
        fail(context, "foreign posting uses home-currency FX source");
    }

    if (
        (posting.originalAmountMinor === null) !==
        (posting.originalCurrency === null)
    ) {
        fail(context, "original amount and currency must both be null or present");
    }
    if (posting.originalCurrency !== null) {
        requiredReference(
            indexes.currencyByCode,
            posting.originalCurrency,
            `${context} original currency`,
        );
    }
    const split = mapSplit(posting, accountUuid, indexes, context);
    const sourceTransactionUuid =
        split === null
            ? transactionUuid
            : uuid(posting.parentUuid, `${context} source transaction UUID`);

    return {
        id,
        sourceId: nonNegativeInteger(posting.id, `${context} sourceId`),
        transactionUuid,
        sourceTransactionUuid,
        accountUuid,
        epochSeconds: nonNegativeInteger(
            posting.date.epochSeconds,
            `${context} epoch`,
        ),
        localDate: isoDate(posting.date.localDate, `${context} localDate`),
        localTime: localTime(posting.date.localTime, `${context} localTime`),
        valueEpochSeconds:
            posting.valueDate === null
                ? null
                : nonNegativeInteger(
                      posting.valueDate.epochSeconds,
                      `${context} value epoch`,
                  ),
        valueLocalDate:
            posting.valueDate === null
                ? null
                : isoDate(
                      posting.valueDate.localDate,
                      `${context} value localDate`,
                  ),
        valueLocalTime:
            posting.valueDate === null
                ? null
                : localTime(
                      posting.valueDate.localTime,
                      `${context} value localTime`,
                  ),
        amountNativeMinor,
        amountHomeMinor,
        categoryUuid:
            category === null ? null : uuid(category.uuid, `${context} category UUID`),
        categoryPath: [...posting.categoryPath],
        categoryType,
        bucket,
        status,
        isVoid: posting.isVoid,
        isArchivedContent: posting.isArchivedContent,
        ...(transferPeer === undefined ? {} : { transferPeer }),
        payeeSourceId: posting.payeeId ?? posting.parentPayeeId,
        paymentMethodSourceId: posting.methodId ?? posting.parentMethodId,
        tagSourceIds,
        comment:
            optionalText(posting.comment) ?? optionalText(posting.parentComment),
        referenceNumber: optionalText(posting.referenceNumber),
        originalAmountMinor:
            posting.originalAmountMinor === null
                ? null
                : safeInteger(
                      posting.originalAmountMinor,
                      `${context} original amount`,
                  ),
        originalCurrency:
            posting.originalCurrency === null
                ? null
                : currencyCode(
                      posting.originalCurrency,
                      `${context} original currency`,
                  ),
        split,
        fxSource,
        exchangeRateToHome,
    };
}

function mapPaymentMethodType(
    value: number | null,
    context: string,
): BackupPaymentMethodType {
    switch (value) {
        case -1:
            return "NEUTRAL";
        case 0:
            return "EXPENSE";
        case 1:
            return "INCOME";
        default:
            return fail(context, "unsupported payment-method type");
    }
}

function mapPaymentMethod(
    method: V189PaymentMethod,
): BackupPaymentMethodV1 {
    const context = `Payment method ${method.id}`;
    return {
        sourceId: nonNegativeInteger(method.id, `${context} sourceId`),
        label: nonEmptyString(method.label, `${context} label`),
        type: mapPaymentMethodType(method.type, `${context} type`),
        isNumbered: method.isNumbered,
        icon: optionalText(method.icon),
    };
}

function mapBudgetGrouping(
    value: string,
    context: string,
): BackupBudgetGrouping {
    if (
        value === "NONE" ||
        value === "DAY" ||
        value === "WEEK" ||
        value === "MONTH" ||
        value === "YEAR"
    ) {
        return value;
    }
    return fail(context, "unsupported budget grouping");
}

function mapBudgetFilter(
    filter: BudgetFilterSource,
    indexes: MappingIndexes,
    context: string,
): BackupBudgetFilterV1 {
    if (filter.type === "and" || filter.type === "or") {
        if (filter.criteria.length === 0) {
            return fail(context, "filter group cannot be empty");
        }
        return {
            type: filter.type,
            criteria: filter.criteria.map((criterion, index) =>
                mapBudgetFilter(
                    criterion,
                    indexes,
                    `${context}.criteria[${index}]`,
                ),
            ),
        };
    }
    if (filter.type === "not") {
        return {
            type: "not",
            criterion: mapBudgetFilter(
                filter.criterion,
                indexes,
                `${context}.criterion`,
            ),
        };
    }
    if (filter.type === "account_id") {
        return {
            type: "account",
            accountUuids: stableIds(filter.values, `${context}.values`).map(
                (id) =>
                    uuid(
                        requiredReference(
                            indexes.accountById,
                            id,
                            `${context} account`,
                        ).uuid,
                        `${context} account UUID`,
                    ),
            ),
        };
    }
    if (filter.type === "cat_id") {
        return {
            type: "category",
            categoryUuids: stableIds(filter.values, `${context}.values`).map(
                (id) =>
                    uuid(
                        requiredReference(
                            indexes.categoryById,
                            id,
                            `${context} category`,
                        ).uuid,
                        `${context} category UUID`,
                    ),
            ),
        };
    }
    return fail(
        context,
        `unsupported persisted budget filter type ${filter.type}`,
    );
}

function budgetDate(
    value: string | number | null,
    context: string,
): string | null {
    if (value === null) {
        return null;
    }
    if (typeof value !== "string") {
        return fail(context, "numeric budget dates are not valid v189 ISO dates");
    }
    return isoDate(value, context);
}

function mapBudget(
    budget: V189Budget,
    indexes: MappingIndexes,
    uiSettings: BudgetUiSettings,
): BackupBudgetV1 {
    const context = `Budget ${budget.id}`;
    const account =
        budget.accountId === null
            ? null
            : requiredReference(
                  indexes.accountById,
                  budget.accountId,
                  `${context} account`,
              );
    if (budget.currency !== null) {
        requiredReference(
            indexes.currencyByCode,
            budget.currency,
            `${context} currency`,
        );
    }
    return {
        uuid: uuid(budget.uuid, `${context} UUID`),
        sourceId: nonNegativeInteger(budget.id, `${context} sourceId`),
        title: nonEmptyString(budget.title, `${context} title`),
        description: budget.description,
        grouping: mapBudgetGrouping(budget.grouping, `${context} grouping`),
        accountUuid:
            account === null ? null : uuid(account.uuid, `${context} account UUID`),
        currency:
            budget.currency === null
                ? null
                : currencyCode(budget.currency, `${context} currency`),
        startDate: budgetDate(budget.start, `${context} startDate`),
        endDate: budgetDate(budget.end, `${context} endDate`),
        isDefault: budget.isDefault,
        filter:
            uiSettings.filter === null
                ? null
                : mapBudgetFilter(
                      uiSettings.filter,
                      indexes,
                      `${context} filter`,
                  ),
        aggregateNeutral: uiSettings.aggregateNeutral,
        allocations: budget.allocations.map((allocation, index) => {
            const allocationContext = `${context} allocation ${index}`;
            const category =
                allocation.categoryId === 0
                    ? null
                    : requiredReference(
                          indexes.categoryById,
                          allocation.categoryId,
                          `${allocationContext} category`,
                      );
            return {
                categoryUuid:
                    category === null
                        ? null
                        : uuid(category.uuid, `${allocationContext} category UUID`),
                year:
                    allocation.year === null
                        ? null
                        : safeInteger(allocation.year, `${allocationContext} year`),
                period:
                    allocation.second === null
                        ? null
                        : safeInteger(
                              allocation.second,
                              `${allocationContext} period`,
                          ),
                amountMinor:
                    allocation.budgetMinor === null
                        ? null
                        : safeInteger(
                              allocation.budgetMinor,
                              `${allocationContext} amount`,
                          ),
                rolloverPreviousMinor: safeInteger(
                    allocation.rolloverPreviousMinor,
                    `${allocationContext} previous rollover`,
                ),
                rolloverNextMinor: safeInteger(
                    allocation.rolloverNextMinor,
                    `${allocationContext} next rollover`,
                ),
                oneTime: allocation.oneTime,
            };
        }),
    };
}

function calendarWeekdayToIso(value: number): number {
    const weekday = nonNegativeInteger(value, "Preferences weekStart");
    if (weekday < 1 || weekday > 7) {
        fail("Preferences weekStart", "expected Calendar weekday 1 through 7");
    }
    return weekday === 1 ? 7 : weekday - 1;
}

function assertCanonicalMetadata(
    canonical: V189CanonicalDataset,
    options: CreateAppDatasetOptions,
): void {
    if (canonical.metadata.schemaVersion !== 189) {
        fail("Canonical dataset", "expected schema 189");
    }
    const preferences = canonical.metadata.preferences;
    if (
        canonical.metadata.timeZone !== options.timeZone ||
        preferences.homeCurrency !== options.preferences.homeCurrency ||
        preferences.monthStart !== options.preferences.monthStart ||
        preferences.weekStart !== options.preferences.weekStart ||
        preferences.includeTransfers !== options.preferences.includeTransfers ||
        preferences.unmappedTransactionsAsTransfers !==
            options.preferences.unmappedTransactionsAsTransfers ||
        preferences.aggregateNeutral !== false ||
        preferences.dynamicExchangeRatesMode !== "PER_ACCOUNT"
    ) {
        fail("Canonical dataset", "adapter policies disagree with import options");
    }
    for (const [name, values] of [
        ["currencies", canonical.currencies],
        ["accounts", canonical.accounts],
        ["categories", canonical.categories],
        ["postings", canonical.postings],
        ["payees", canonical.payees],
        ["paymentMethods", canonical.paymentMethods],
        ["tags", canonical.tags],
        ["budgets", canonical.budgets],
    ] as const) {
        if (canonical.metadata.counts[name] !== values.length) {
            fail("Canonical dataset", `${name} count is inconsistent`);
        }
    }
    for (const property of [
        "openingBalanceHomeMinor",
        "incomesHomeMinor",
        "expensesHomeMinor",
        "transfersHomeMinor",
        "movementHomeMinor",
        "closingFlowBalanceHomeMinor",
        "valuationBalanceHomeMinor",
    ] as const) {
        const partition =
            canonical.scopes.DEBT[property] + canonical.scopes.REAL_CASH[property];
        if (
            !Number.isSafeInteger(partition) ||
            canonical.scopes.ALL[property] !== partition
        ) {
            fail("Canonical dataset", `scope partition failed for ${property}`);
        }
    }
}

function validateTimeZone(value: string): string {
    nonEmptyString(value, "Import timeZone");
    try {
        new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    } catch (error) {
        throw new Error("Import timeZone must be a valid IANA time zone", {
            cause: error,
        });
    }
    return value;
}

/** Strictly maps the private v189 canonical model to the public app dataset. */
export function createAppDataset(
    options: CreateAppDatasetOptions,
): BackupDatasetV1 {
    if (!SHA256_PATTERN.test(options.backupSha256)) {
        fail("Backup hash", "expected lowercase SHA-256 hex");
    }
    if (!SHA256_PATTERN.test(options.databaseSha256)) {
        fail("Database hash", "expected lowercase SHA-256 hex");
    }
    if (options.preferences.homeCurrency !== "EUR") {
        fail("Preferences homeCurrency", "expected EUR");
    }
    const monthStart = nonNegativeInteger(
        options.preferences.monthStart,
        "Preferences monthStart",
    );
    if (monthStart < 1 || monthStart > 31) {
        fail("Preferences monthStart", "expected 1 through 31");
    }
    const timeZone = validateTimeZone(options.timeZone);
    assertCanonicalMetadata(options.canonical, options);

    const accountById = uniqueMap(
        options.canonical.accounts,
        (account) => account.id,
        "Account source ids",
    );
    uniqueMap(
        options.canonical.accounts,
        (account) => uuid(account.uuid, `Account ${account.id} UUID`),
        "Account UUIDs",
    );
    const categoryById = uniqueMap(
        options.canonical.categories,
        (category) => category.id,
        "Category source ids",
    );
    uniqueMap(
        options.canonical.categories,
        (category) => uuid(category.uuid, `Category ${category.id} UUID`),
        "Category UUIDs",
    );
    const currencyByCode = uniqueMap(
        options.canonical.currencies,
        (currency) => currency.code,
        "Currency codes",
    );
    uniqueMap(
        options.canonical.currencies,
        (currency) => currency.id,
        "Currency source ids",
    );
    const homeCurrency = requiredReference(
        currencyByCode,
        options.preferences.homeCurrency,
        "Home currency",
    );
    if (
        nonNegativeInteger(
            homeCurrency.fractionDigits,
            "Home currency EUR fractionDigits",
        ) !== 2
    ) {
        fail("Home currency EUR", "expected fractionDigits=2");
    }
    const postingById = uniqueMap(
        options.canonical.postings,
        (posting) => posting.id,
        "Posting source ids",
    );
    const methodById = uniqueMap(
        options.canonical.paymentMethods,
        (method) => method.id,
        "Payment-method source ids",
    );
    const payeeIds = new Set(
        uniqueMap(
            options.canonical.payees,
            (payee) => payee.id,
            "Payee source ids",
        ).keys() as MapIterator<number>,
    );
    const tagIds = new Set(
        uniqueMap(
            options.canonical.tags,
            (tag) => tag.id,
            "Tag source ids",
        ).keys() as MapIterator<number>,
    );
    const indexes: MappingIndexes = {
        accountById,
        categoryById,
        currencyByCode,
        methodById,
        payeeIds,
        postingById,
        tagIds,
    };

    if (options.budgetUiSettings.size !== options.canonical.budgets.length) {
        fail("Budget UI settings", "expected one entry per budget");
    }
    for (const budget of options.canonical.budgets) {
        if (!options.budgetUiSettings.has(budget.id)) {
            fail("Budget UI settings", `missing budget ${budget.id}`);
        }
    }

    const postingIdBySourceId = new Map<number, string>();
    const canonicalPostingIds = new Set<string>();
    for (const posting of options.canonical.postings) {
        const account = requiredReference(
            accountById,
            posting.accountId,
            `Posting ${posting.id} account`,
        );
        const id = canonicalPostingId(
            uuid(account.uuid, `Posting ${posting.id} account UUID`),
            uuid(posting.uuid, `Posting ${posting.id} transaction UUID`),
        );
        if (canonicalPostingIds.has(id)) {
            fail("Posting ids", `duplicate canonical posting id ${id}`);
        }
        canonicalPostingIds.add(id);
        postingIdBySourceId.set(posting.id, id);
    }

    const currencies = options.canonical.currencies
        .map(mapCurrency)
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const accounts = options.canonical.accounts
        .map((account) =>
            mapAccount(account, indexes, options.preferences.homeCurrency),
        )
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const categories = options.canonical.categories
        .map((category) => mapCategory(category, indexes))
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const postings = options.canonical.postings
        .map((posting) =>
            mapPosting(
                posting,
                indexes,
                postingIdBySourceId,
                options.preferences.homeCurrency,
            ),
        )
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const payees = options.canonical.payees
        .map((payee) => {
            const context = `Payee ${payee.id}`;
            if (
                payee.parentId !== null &&
                !payeeIds.has(payee.parentId)
            ) {
                fail(context, "unknown parent payee");
            }
            return {
                sourceId: nonNegativeInteger(payee.id, `${context} sourceId`),
                name: nonEmptyString(payee.name, `${context} name`),
                shortName: optionalText(payee.shortName),
                parentSourceId: payee.parentId,
            };
        })
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const paymentMethods = options.canonical.paymentMethods
        .map(mapPaymentMethod)
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const tags = options.canonical.tags
        .map((tag) => ({
            sourceId: nonNegativeInteger(tag.id, `Tag ${tag.id} sourceId`),
            name: nonEmptyString(tag.label, `Tag ${tag.id} name`),
            color:
                tag.color === null
                    ? null
                    : safeInteger(tag.color, `Tag ${tag.id} color`),
        }))
        .toSorted((left, right) => left.sourceId - right.sourceId);
    const budgets = options.canonical.budgets
        .map((budget) =>
            mapBudget(
                budget,
                indexes,
                options.budgetUiSettings.get(budget.id)!,
            ),
        )
        .toSorted((left, right) => left.sourceId - right.sourceId);

    return {
        version: 1,
        source: {
            format: "myexpenses-backup",
            schemaVersion: 189,
            backupSha256: options.backupSha256,
            databaseSha256: options.databaseSha256,
        },
        preferences: {
            homeCurrency: "EUR",
            timeZone,
            monthStart,
            weekStart: calendarWeekdayToIso(options.preferences.weekStart),
            includeTransfers: options.preferences.includeTransfers,
        },
        currencies,
        accounts,
        categories,
        postings,
        payees,
        paymentMethods,
        tags,
        budgets,
    };
}
