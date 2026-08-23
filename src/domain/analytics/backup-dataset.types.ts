const BACKUP_DATASET_VERSION = 1 as const;
const BACKUP_SCHEMA_VERSION = 189 as const;

export type BackupCurrencyCode = Uppercase<string>;
export type BackupNativeAccountType =
  | "CASH"
  | "BANK"
  | "CCARD"
  | "ASSET"
  | "LIABILITY"
  | "INVST";
export type BackupAccountScope = "DEFAULT" | "DEBT";
export type BackupExchangeRateMode = "IDENTITY" | "STATIC" | "DYNAMIC";
export type BackupCommodityType = "FIAT" | "SECURITY" | "CRYPTO";
export type BackupCategoryType = "TRANSFER" | "EXPENSE" | "INCOME" | "NEUTRAL";
export type BackupPostingBucket = "expense" | "income" | "transfer";
export type BackupTransactionStatus =
  | "UNRECONCILED"
  | "CLEARED"
  | "RECONCILED"
  | "VOID";
export type BackupFxSource =
  | "HOME_CURRENCY"
  | "STATIC_ACCOUNT_RATE"
  | "DYNAMIC_EQUIVALENT"
  | "DYNAMIC_SPLIT_PRORATION"
  | "ZERO_AMOUNT_WITHOUT_RATE";

export interface BackupDatasetSourceV1 {
  readonly format: "myexpenses-backup";
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly backupSha256: string;
  readonly databaseSha256: string;
}

export interface BackupDatasetPreferencesV1 {
  readonly homeCurrency: "EUR";
  /** IANA time-zone used to derive every posting's local date and time. */
  readonly timeZone: string;
  /** Day of month, in the inclusive range 1..31. */
  readonly monthStart: number;
  /** ISO weekday, Monday=1 through Sunday=7. */
  readonly weekStart: number;
  readonly includeTransfers: boolean;
}

export interface BackupCurrencyV1 {
  readonly sourceId: number;
  readonly code: BackupCurrencyCode;
  readonly fractionDigits: number;
  readonly label: string | null;
  readonly symbol: string | null;
  readonly commodityType: BackupCommodityType | null;
}

export interface BackupAccountFlagsV1 {
  readonly sourceId: number;
  readonly visible: boolean;
  readonly excludedFromTotals: boolean;
  readonly includedInAll: boolean;
  readonly isAsset: boolean;
  readonly supportsReconciliation: boolean;
}

export interface BackupAccountBalancesV1 {
  readonly currentNativeMinor: number;
  readonly historicalHomeMinor: number;
  readonly valuationHomeMinor: number;
}

export interface BackupAccountV1 {
  readonly uuid: string;
  readonly sourceId: number;
  readonly label: string;
  readonly description: string | null;
  readonly currency: BackupCurrencyCode;
  readonly fractionDigits: number;
  readonly nativeType: BackupNativeAccountType;
  readonly scope: BackupAccountScope;
  readonly parentUuid: string | null;
  readonly openingNativeMinor: number;
  readonly openingHomeMinor: number;
  readonly exchangeRateMode: BackupExchangeRateMode;
  readonly exchangeRateToHome: number | null;
  readonly flags: BackupAccountFlagsV1;
  readonly balances?: BackupAccountBalancesV1;
}

export interface BackupCategoryV1 {
  readonly uuid: string;
  readonly sourceId: number;
  readonly name: string;
  readonly type: BackupCategoryType;
  readonly parentUuid: string | null;
  readonly path: readonly string[];
  readonly color: number | null;
  readonly icon: string | null;
}

export interface BackupTransferPeerV1 {
  readonly postingId: string;
  readonly sourceId: number;
  readonly transactionUuid: string;
  readonly accountUuid: string;
}

export interface BackupSplitParentV1 {
  readonly postingId: string;
  readonly sourceId: number;
  readonly transactionUuid: string;
  readonly epochSeconds: number;
  readonly localDate: string;
  readonly localTime: string;
  readonly amountNativeMinor: number;
  readonly comment: string | null;
  readonly payeeSourceId: number | null;
  readonly paymentMethodSourceId: number | null;
  readonly tagSourceIds: readonly number[];
}

export interface BackupSplitProvenanceV1 {
  readonly index: number;
  readonly count: number;
  readonly parent: BackupSplitParentV1;
}

export interface BackupPostingV1 {
  /** Stable canonical id; transfer UUIDs are only unique together with the account. */
  readonly id: string;
  readonly sourceId: number;
  readonly transactionUuid: string;
  readonly sourceTransactionUuid: string;
  readonly accountUuid: string;
  readonly epochSeconds: number;
  readonly localDate: string;
  readonly localTime: string;
  readonly valueEpochSeconds: number | null;
  readonly valueLocalDate: string | null;
  readonly valueLocalTime: string | null;
  readonly amountNativeMinor: number;
  readonly amountHomeMinor: number;
  readonly categoryUuid: string | null;
  readonly categoryPath: readonly string[];
  readonly categoryType: BackupCategoryType;
  readonly bucket: BackupPostingBucket;
  readonly status: BackupTransactionStatus;
  readonly isVoid: boolean;
  readonly isArchivedContent: boolean;
  readonly transferPeer?: BackupTransferPeerV1;
  readonly payeeSourceId: number | null;
  readonly paymentMethodSourceId: number | null;
  /** Effective tags: stable, deduplicated union of child and split parent tags. */
  readonly tagSourceIds: readonly number[];
  readonly comment: string | null;
  readonly referenceNumber: string | null;
  readonly originalAmountMinor: number | null;
  readonly originalCurrency: BackupCurrencyCode | null;
  readonly split: BackupSplitProvenanceV1 | null;
  readonly fxSource: BackupFxSource;
  /** Home-currency minor units obtained for one native minor unit. */
  readonly exchangeRateToHome: number | null;
}

export interface BackupPayeeV1 {
  readonly sourceId: number;
  readonly name: string;
  readonly shortName: string | null;
  readonly parentSourceId: number | null;
}

export type BackupPaymentMethodType = "EXPENSE" | "NEUTRAL" | "INCOME";

export interface BackupPaymentMethodV1 {
  readonly sourceId: number;
  readonly label: string;
  readonly type: BackupPaymentMethodType;
  readonly isNumbered: boolean;
  readonly icon: string | null;
}

export interface BackupTagV1 {
  readonly sourceId: number;
  readonly name: string;
  readonly color: number | null;
}

export type BackupBudgetGrouping = "NONE" | "DAY" | "WEEK" | "MONTH" | "YEAR";

export type BackupBudgetFilterV1 =
  | {
      readonly type: "and" | "or";
      readonly criteria: readonly BackupBudgetFilterV1[];
    }
  | { readonly type: "not"; readonly criterion: BackupBudgetFilterV1 }
  | { readonly type: "account"; readonly accountUuids: readonly string[] }
  | { readonly type: "category"; readonly categoryUuids: readonly string[] };

export interface BackupBudgetAllocationV1 {
  /** Null represents MyExpenses' category-id 0 total/unallocated sentinel. */
  readonly categoryUuid: string | null;
  readonly year: number | null;
  readonly period: number | null;
  readonly amountMinor: number | null;
  readonly rolloverPreviousMinor: number;
  readonly rolloverNextMinor: number;
  readonly oneTime: boolean;
}

export interface BackupBudgetV1 {
  readonly uuid: string;
  readonly sourceId: number;
  readonly title: string;
  readonly description: string;
  readonly grouping: BackupBudgetGrouping;
  readonly accountUuid: string | null;
  readonly currency: BackupCurrencyCode | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly isDefault: boolean;
  /** Filter persisted by MyExpenses in AndroidX DataStore. */
  readonly filter: BackupBudgetFilterV1 | null;
  readonly aggregateNeutral: boolean;
  readonly allocations: readonly BackupBudgetAllocationV1[];
}

export interface BackupDatasetV1 {
  readonly version: typeof BACKUP_DATASET_VERSION;
  readonly source: BackupDatasetSourceV1;
  readonly preferences: BackupDatasetPreferencesV1;
  readonly currencies: readonly BackupCurrencyV1[];
  readonly accounts: readonly BackupAccountV1[];
  readonly categories: readonly BackupCategoryV1[];
  readonly postings: readonly BackupPostingV1[];
  readonly payees: readonly BackupPayeeV1[];
  readonly paymentMethods: readonly BackupPaymentMethodV1[];
  readonly tags: readonly BackupTagV1[];
  readonly budgets: readonly BackupBudgetV1[];
}
