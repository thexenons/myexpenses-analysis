import type {
  BackupDatasetV1,
  BackupFxSource,
  BackupNativeAccountType,
  BackupTransactionStatus,
} from "./backup-dataset.types.ts";

export type TransactionStatus =
  | "UNRECONCILED"
  | "CLEARED"
  | "RECONCILED"
  | "VOID";

export type CurrencyCode = Uppercase<string>;
export type IsoDate = `${number}-${number}-${number}`;
export type AccountType = "DEFAULT" | "DEBT";
export type ExchangeRateMode = "DYNAMIC" | "STATIC";
export type CategoryType = "EXPENSE" | "INCOME" | "TRANSFER" | "NEUTRAL";

export interface AccountRegistryEntry {
  readonly exchangeRateMode?: ExchangeRateMode;
  /** EUR obtained for one major unit of the account currency. */
  readonly exchangeRateToEur?: number;
  readonly label: string;
  readonly type: AccountType;
}

export interface AccountsRegistry {
  readonly version: 2;
  readonly accounts: Readonly<Record<string, AccountRegistryEntry>>;
}

export interface CategoryRegistryEntry {
  readonly categoryType: CategoryType;
  readonly children?: CategoriesRegistry;
}

export type CategoriesRegistry = Readonly<Record<string, CategoryRegistryEntry>>;

export interface ParsedParentTransactionContext {
  readonly date: IsoDate;
  readonly amount: number;
  readonly amountNativeMinor?: number;
  readonly localTime?: string;
  readonly comment?: string;
  readonly tags?: readonly string[];
  readonly payee?: string;
  readonly paymentMethod?: string;
}

interface ParsedTransactionFields {
  readonly uuid: string;
  readonly date: IsoDate;
  readonly amount: number;
  readonly category: readonly string[];
  readonly comment?: string;
  readonly tags?: readonly string[];
  readonly payee?: string;
  readonly transferAccount?: string;
  readonly sourceTransactionUuid: string;
  readonly sourceStatus: TransactionStatus;
}

export interface ParsedDirectTransaction extends ParsedTransactionFields {
  readonly splitIndex: null;
  readonly splitCount: null;
  readonly parent?: never;
}

export interface ParsedSplitTransaction extends ParsedTransactionFields {
  readonly splitIndex: number;
  readonly splitCount: number;
  readonly parent: ParsedParentTransactionContext;
}

export type ParsedTransaction =
  | ParsedDirectTransaction
  | ParsedSplitTransaction;

export interface ParsedAccount {
  readonly uuid: string;
  readonly label: string;
  readonly currency: CurrencyCode;
  readonly openingBalance: number;
  readonly transactions: readonly ParsedTransaction[];
}

export type ParsedData = readonly ParsedAccount[];

export interface AppDataset {
  readonly accounts: AccountsRegistry;
  readonly categories: CategoriesRegistry;
  readonly parsedData: ParsedData;
}

export type AnalyticsSourceData = Pick<
  AppDataset,
  "accounts" | "categories" | "parsedData"
>;

export type AnalyticsInputData = AnalyticsSourceData | BackupDatasetV1;

export type AnalyticsRegistries = Pick<AppDataset, "accounts" | "categories">;

export type PostingBucket = "expense" | "income" | "transfer";
export type ExchangeRateSource =
  | "identity"
  | "static"
  | "dynamic-equivalent"
  | "dynamic-rate";

export interface NormalizedAccount {
  readonly id: string;
  readonly label: string;
  readonly currency: CurrencyCode;
  readonly fractionDigits: number;
  readonly type: AccountType;
  readonly exchangeRateMode: ExchangeRateMode | "IDENTITY";
  readonly openingBalanceNativeMinor: number;
  readonly openingBalanceEurMinor: number;
  readonly currentBalanceNativeMinor: number;
  /** Opening balance plus all non-VOID postings, converted per posting. */
  readonly historicalBalanceEurMinor: number;
  /** Final native balance converted once, matching My Expenses account valuation. */
  readonly valuationBalanceEurMinor: number;
  readonly postingCount: number;
  readonly activePostingCount: number;
  readonly sourceRowId?: number;
  readonly nativeType?: BackupNativeAccountType;
  readonly description?: string;
  readonly visible?: boolean;
  readonly excludedFromTotals?: boolean;
  readonly includedInAll?: boolean;
  readonly supportsReconciliation?: boolean;
}

export interface NormalizedPosting {
  /** Stable within an export; includes the account because transfer UUIDs repeat. */
  readonly id: string;
  readonly transactionId: string;
  readonly sourceTransactionId: string;
  readonly accountId: string;
  readonly accountLabel: string;
  readonly accountType: AccountType;
  readonly currency: CurrencyCode;
  readonly fractionDigits: number;
  readonly date: IsoDate;
  readonly sourceRowId?: number;
  readonly epochSeconds?: number;
  readonly localTime?: string;
  readonly valueDate?: IsoDate;
  readonly valueTime?: string;
  readonly amountNativeMinor: number;
  readonly amountEurMinor: number;
  readonly exchangeRateToEur: number;
  readonly exchangeRateSource: ExchangeRateSource;
  /** Exact v1 source, including the zero-amount case without an invented rate. */
  readonly backupFxSource?: BackupFxSource;
  readonly categoryUuid?: string;
  readonly categoryPath: readonly string[];
  readonly categoryType: CategoryType;
  readonly bucket: PostingBucket;
  readonly status: TransactionStatus;
  /** Exact MyExpenses reconciliation status retained for source-level display. */
  readonly backupStatus?: BackupTransactionStatus;
  readonly isVoid: boolean;
  readonly isArchivedContent?: boolean;
  readonly linked: boolean;
  readonly transferPeerPostingId?: string;
  readonly transferAccount?: string;
  readonly tags: readonly string[];
  readonly tagSourceIds?: readonly number[];
  readonly comment?: string;
  readonly payee?: string;
  readonly payeeSourceId?: number;
  readonly paymentMethod?: string;
  readonly paymentMethodSourceId?: number;
  readonly referenceNumber?: string;
  readonly originalAmountMinor?: number;
  readonly originalCurrency?: CurrencyCode;
  readonly originalFractionDigits?: number;
  readonly splitIndex: number | null;
  readonly splitCount: number | null;
  readonly splitParentSourceId?: number;
  readonly splitParentPostingId?: string;
  readonly parentPaymentMethod?: string;
  readonly parent?: ParsedParentTransactionContext;
  /** Pre-normalized index for legacy rows; backup rows derive and cache it lazily. */
  readonly searchIndex?: string;
  /** Search-only aliases that are not represented by the display fields. */
  readonly searchAliases?: readonly string[];
}

export interface AnalyticsDataset {
  readonly currency: "EUR";
  /** Validated source registries remain available for filters and drill-down. */
  readonly source: AnalyticsRegistries;
  readonly accounts: readonly NormalizedAccount[];
  readonly postings: readonly NormalizedPosting[];
  readonly minDate: IsoDate | null;
  readonly maxDate: IsoDate | null;
  /** Rich backup metadata and registries retained by reference for future screens. */
  readonly backup?: Pick<
    BackupDatasetV1,
    | "source"
    | "preferences"
    | "currencies"
    | "accounts"
    | "categories"
    | "payees"
    | "paymentMethods"
    | "tags"
    | "budgets"
  >;
}

export interface NormalizeDatasetOptions {
  /** Exact converted cents take precedence over a historical rate. Key: posting id. */
  readonly dynamicEurMinorByPostingId?: Readonly<Record<string, number>>;
  /** EUR per one major currency unit. Key produced by dynamicRateKey(). */
  readonly dynamicRates?: Readonly<Record<string, number>>;
  /** Current account valuation, needed for a non-zero DYNAMIC final balance. */
  readonly dynamicValuationEurMinorByAccountId?: Readonly<Record<string, number>>;
}

export type AnalyticsScope = "all" | "realCashFlow" | "debtsOnly";
export type LinkedFilter = "all" | "linked" | "unlinked";
export type DatePeriodMode =
  | "all"
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

export interface DateRangeFilter {
  readonly from: IsoDate | null;
  readonly to: IsoDate | null;
}

/** Serializable state suitable for context, URL params, or local storage. */
export interface FilterState {
  readonly scope: AnalyticsScope;
  /** Describes how the user selected dateRange; filtering always uses dateRange. */
  readonly periodMode: DatePeriodMode;
  readonly dateRange: DateRangeFilter;
  /** Empty means every account allowed by scope. */
  readonly accountIds: readonly string[];
  /** Empty means all; otherwise a transaction starts with any selected path. */
  readonly categoryPrefixes: readonly (readonly string[])[];
  /** Empty means every status. VOID can remain visible in tables. */
  readonly statuses: readonly TransactionStatus[];
  /** Empty means every tag; otherwise a transaction matching any selected tag. */
  readonly tags: readonly string[];
  readonly search: string;
  readonly linked: LinkedFilter;
}

export interface FilteredAnalyticsDataset {
  readonly source: AnalyticsDataset;
  readonly filters: FilterState;
  readonly accounts: readonly NormalizedAccount[];
  /** Includes matching VOID rows for transaction tables. */
  readonly postings: readonly NormalizedPosting[];
  /** Matching non-VOID rows, retained once for every metric consumer. */
  readonly activePostings: readonly NormalizedPosting[];
  /** Per-account opening at the start of the selected period and filters. */
  readonly periodOpeningEurMinorByAccountId: Readonly<Record<string, number>>;
  readonly periodOpeningBalanceEurMinor: number;
}

export interface AmountSummary {
  readonly postingCount: number;
  readonly netEurMinor: number;
  /** Signed amount, matching My Expenses (normally negative). */
  readonly expensesEurMinor: number;
  /** Signed amount, matching My Expenses (normally positive). */
  readonly incomesEurMinor: number;
  readonly transfersEurMinor: number;
  readonly realCashFlowEurMinor: number;
  readonly debtFlowEurMinor: number;
}

export interface FlowComposition {
  readonly grossExpensesEurMinor: number;
  readonly expenseRefundsEurMinor: number;
  readonly netExpensesEurMinor: number;
  readonly grossIncomeEurMinor: number;
  readonly incomeReversalsEurMinor: number;
  readonly netIncomeEurMinor: number;
  readonly transferInflowsEurMinor: number;
  readonly transferOutflowsEurMinor: number;
  readonly netTransfersEurMinor: number;
}

export interface KpiSummary extends AmountSummary, FlowComposition {
  readonly accountCount: number;
  readonly periodOpeningBalanceEurMinor: number;
  readonly periodClosingBalanceEurMinor: number;
}

export interface StatusSummary {
  readonly count: number;
  readonly amountEurMinor: number;
}

export type StatusCounts = Readonly<Record<TransactionStatus, StatusSummary>>;

export type TimeGranularity = "day" | "week" | "month" | "year";
export type TimeGranularitySetting = "auto" | TimeGranularity;

export interface TimeSeriesPoint extends AmountSummary {
  readonly key: string;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
}

export interface TimeSeriesOptions {
  /** Fill the selected range, or the observed range when unbounded. Defaults to true. */
  readonly fillGaps?: boolean;
}

export interface CategoryBreakdownNode {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
  readonly categoryType: CategoryType;
  /** Includes this category and every descendant. */
  readonly summary: AmountSummary;
  /** Includes postings assigned exactly to this category path. */
  readonly directSummary: AmountSummary;
  readonly children: readonly CategoryBreakdownNode[];
}

export interface AccountBreakdownItem extends AmountSummary {
  readonly account: NormalizedAccount;
  readonly periodOpeningBalanceEurMinor: number;
  readonly periodClosingBalanceEurMinor: number;
}

export interface DebtBreakdownItem extends AccountBreakdownItem {
  readonly advancesEurMinor: number;
  readonly recoveriesEurMinor: number;
  readonly grossDebtExpensesEurMinor: number;
  readonly debtExpenseRefundsEurMinor: number;
}
