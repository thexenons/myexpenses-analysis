export const V189_SCHEMA_VERSION = 189 as const;

export const CATEGORY_TYPE = {
    TRANSFER: 0,
    EXPENSE: 1,
    INCOME: 2,
    NEUTRAL: 3,
} as const;

export type V189CategoryType =
    (typeof CATEGORY_TYPE)[keyof typeof CATEGORY_TYPE];

export type V189PostingBucket = "EXPENSE" | "INCOME" | "TRANSFER";
export type V189ScopeName = "ALL" | "DEBT" | "REAL_CASH";
export type V189LeafScopeName = Exclude<V189ScopeName, "ALL">;
export type V189ReconciliationStatus =
    | "UNRECONCILED"
    | "CLEARED"
    | "RECONCILED"
    | "VOID";
export type V189DynamicExchangeRatesMode =
    | "PER_ACCOUNT"
    | "ALL_DYNAMIC"
    | "ALL_STATIC";
export type V189FxSource =
    | "HOME_CURRENCY"
    | "DYNAMIC_EQUIVALENT"
    | "DYNAMIC_SPLIT_PRORATION"
    | "STATIC_ACCOUNT_RATE"
    | "ZERO_AMOUNT_WITHOUT_RATE";

/** All monetary values are safe integers in the database's native minor units. */
export type MinorUnits = number;

export interface V189Preferences {
    homeCurrency: string;
    monthStart: number;
    weekStart: number;
    aggregateNeutral: boolean;
    includeTransfers: boolean;
    unmappedTransactionsAsTransfers: boolean;
    dynamicExchangeRatesMode: V189DynamicExchangeRatesMode;
}

export interface V189AdapterOptions {
    /** Required IANA zone. Pass `Europe/Madrid` for this application's dataset. */
    timeZone: string;
    preferences: {
        homeCurrency: string;
        monthStart?: number;
        weekStart?: number;
        aggregateNeutral?: boolean;
        includeTransfers?: boolean;
        unmappedTransactionsAsTransfers?: boolean;
        dynamicExchangeRatesMode?: V189DynamicExchangeRatesMode;
    };
    /** Mirrors MyExpenses' `includeAll`; portfolio children remain excluded. */
    includeExcludedAccounts?: boolean;
}

export interface V189LocalTimestamp {
    epochSeconds: number;
    localDate: string;
    localTime: string;
    localDateTime: string;
}

export interface V189Metadata {
    source: "MyExpenses";
    schemaVersion: typeof V189_SCHEMA_VERSION;
    timeZone: string;
    preferences: V189Preferences;
    policies: {
        splitParents: "EXCLUDED";
        archiveParents: "EXCLUDED_CONTENT_INCLUDED";
        voidTransactions: "PRESERVED_ZERO_FOR_METRICS";
        debtScope: "ACCOUNT_TYPE_5_LIABILITY";
        allPartition: "ALL_EQUALS_DEBT_PLUS_REAL_CASH";
        staticEquivalentGuard: "ENABLED";
    };
    counts: {
        currencies: number;
        accounts: number;
        categories: number;
        postings: number;
        payees: number;
        paymentMethods: number;
        tags: number;
        budgets: number;
    };
}

export interface V189Currency {
    id: number;
    code: string;
    label: string | null;
    symbol: string | null;
    fractionDigits: number;
    commodityType: string | null;
}

export interface V189Account {
    id: number;
    uuid: string;
    label: string;
    description: string | null;
    currency: string;
    typeId: number;
    typeLabel: string;
    isAsset: boolean;
    isLiability: boolean;
    supportsReconciliation: boolean;
    flagId: number;
    visible: boolean;
    excludedFromTotals: boolean;
    includedInAll: boolean;
    dynamicExchangeRates: boolean;
    parentId: number | null;
    openingBalanceMinor: MinorUnits;
    openingBalanceHomeMinor: MinorUnits;
    exchangeRateToHome: number | null;
    valuationRateToHome: number | null;
    nativeClosingBalanceMinor: MinorUnits;
    historicalClosingBalanceHomeMinor: MinorUnits;
    valuationBalanceHomeMinor: MinorUnits;
}

export interface V189Category {
    id: number;
    uuid: string | null;
    parentId: number | null;
    label: string;
    path: readonly string[];
    /** Physical value stored on this category row. */
    nativeType: V189CategoryType;
    /** Analytical type inherited from the root category. */
    type: V189CategoryType;
    color: number | null;
    icon: string | null;
}

export interface V189Payee {
    id: number;
    name: string;
    shortName: string | null;
    parentId: number | null;
}

export interface V189PaymentMethod {
    id: number;
    label: string;
    type: number | null;
    isNumbered: boolean;
    icon: string | null;
}

export interface V189Tag {
    id: number;
    label: string;
    color: number | null;
}

export interface V189BudgetAllocation {
    categoryId: number;
    year: number | null;
    second: number | null;
    budgetMinor: MinorUnits | null;
    rolloverPreviousMinor: MinorUnits;
    rolloverNextMinor: MinorUnits;
    oneTime: boolean;
}

export interface V189Budget {
    id: number;
    uuid: string | null;
    title: string;
    description: string;
    grouping: string;
    accountId: number | null;
    currency: string | null;
    start: string | number | null;
    end: string | number | null;
    isDefault: boolean;
    allocations: readonly V189BudgetAllocation[];
}

export interface V189Posting {
    id: number;
    uuid: string | null;
    parentTransactionId: number | null;
    parentUuid: string | null;
    parentDate: V189LocalTimestamp | null;
    parentValueDate: V189LocalTimestamp | null;
    parentAmountMinor: MinorUnits | null;
    isSplitPart: boolean;
    splitIndex: number | null;
    splitCount: number | null;
    sourceStatusCode: number;
    isArchivedContent: boolean;
    accountId: number;
    accountCurrency: string;
    leafScope: V189LeafScopeName;
    date: V189LocalTimestamp;
    /** Exact child-row value, including MyExpenses sentinel values. */
    rawValueDateEpochSeconds: number;
    /** Child-row value normalized for display; sentinels are null. */
    rawValueDate: V189LocalTimestamp | null;
    /** Effective logical value date; split parts inherit it from their parent. */
    valueDate: V189LocalTimestamp | null;
    amountMinor: MinorUnits;
    amountHomeMinor: MinorUnits;
    fxRateToHome: number | null;
    fxSource: V189FxSource;
    categoryId: number | null;
    categoryPath: readonly string[];
    nativeCategoryType: V189CategoryType;
    categoryType: V189CategoryType;
    effectiveType: V189CategoryType;
    bucket: V189PostingBucket;
    reconciliationStatus: V189ReconciliationStatus;
    isVoid: boolean;
    transferPeerId: number | null;
    transferAccountId: number | null;
    debtId: number | null;
    payeeId: number | null;
    parentPayeeId: number | null;
    effectivePayeeIds: readonly number[];
    methodId: number | null;
    parentMethodId: number | null;
    effectiveMethodIds: readonly number[];
    tagIds: readonly number[];
    parentTagIds: readonly number[];
    effectiveTagIds: readonly number[];
    comment: string | null;
    parentComment: string | null;
    referenceNumber: string | null;
    originalAmountMinor: MinorUnits | null;
    originalCurrency: string | null;
}

export interface V189Scope {
    name: V189ScopeName;
    accountIds: readonly number[];
    postingIds: readonly number[];
    openingBalanceHomeMinor: MinorUnits;
    incomesHomeMinor: MinorUnits;
    expensesHomeMinor: MinorUnits;
    transfersHomeMinor: MinorUnits;
    movementHomeMinor: MinorUnits;
    closingFlowBalanceHomeMinor: MinorUnits;
    valuationBalanceHomeMinor: MinorUnits;
}

export interface V189CanonicalDataset {
    metadata: V189Metadata;
    currencies: readonly V189Currency[];
    accounts: readonly V189Account[];
    categories: readonly V189Category[];
    postings: readonly V189Posting[];
    postingsByScope: Readonly<
        Record<V189ScopeName, readonly V189Posting[]>
    >;
    scopes: Readonly<Record<V189ScopeName, V189Scope>>;
    payees: readonly V189Payee[];
    paymentMethods: readonly V189PaymentMethod[];
    tags: readonly V189Tag[];
    budgets: readonly V189Budget[];
}
