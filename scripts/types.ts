export type TransactionStatus = "UNRECONCILED" | "RECONCILED" | "VOID";

/** Validated at runtime as exactly three uppercase ASCII letters. */
export type CurrencyCode = Uppercase<string>;

/** Validated at runtime as an existing calendar date in YYYY-MM-DD format. */
export type IsoDate = `${number}-${number}-${number}`;

export interface BaseExportTransaction {
    uuid: string;
    status: TransactionStatus;
    date: string;
    amount: number;
    comment?: string;
    tags?: string[];
}

export interface DefaultExportTransaction extends BaseExportTransaction {
    payee?: string;
    category: string[];
    transferAccount?: string;
}

export interface TransferExportTransaction extends DefaultExportTransaction {
    transferAccount: string;
}

export type SplitExportTransactionDefaultSplit = Omit<
    DefaultExportTransaction,
    "status"
>;
export type SplitExportTransactionTransferSplit = Omit<
    TransferExportTransaction,
    "status"
>;

export interface SplitExportTransaction extends BaseExportTransaction {
    payee?: string;
    splits: (
        | SplitExportTransactionDefaultSplit
        | SplitExportTransactionTransferSplit
    )[];
}

export type ExportTransaction =
    | DefaultExportTransaction
    | TransferExportTransaction
    | SplitExportTransaction;

export interface ExportAccount {
    uuid: string;
    label: string;
    currency: CurrencyCode;
    openingBalance: number;
    transactions: ExportTransaction[];
}

export type ExportData = ExportAccount[];

interface ParsedTransactionFields {
    uuid: string;
    date: IsoDate;
    amount: number;
    category: string[];
    comment?: string;
    tags?: string[];
    payee?: string;
    transferAccount?: string;
    sourceTransactionUuid: string;
    sourceStatus: TransactionStatus;
}

export interface ParsedParentTransactionContext {
    date: IsoDate;
    amount: number;
    comment?: string;
    tags?: string[];
    payee?: string;
}

export interface ParsedDirectTransaction extends ParsedTransactionFields {
    splitIndex: null;
    splitCount: null;
    parent?: never;
}

export interface ParsedSplitTransaction extends ParsedTransactionFields {
    splitIndex: number;
    splitCount: number;
    parent: ParsedParentTransactionContext;
}

export type ParsedTransaction =
    | ParsedDirectTransaction
    | ParsedSplitTransaction;

export interface ParsedAccount {
    uuid: string;
    label: string;
    currency: CurrencyCode;
    openingBalance: number;
    transactions: ParsedTransaction[];
}

export type ParsedData = ParsedAccount[];

export type AccountType = "DEFAULT" | "DEBT";
export type ExchangeRateMode = "DYNAMIC" | "STATIC";

export interface AccountRegistryEntry {
    exchangeRateMode?: ExchangeRateMode;
    /** EUR obtained for one unit of this account's currency. */
    exchangeRateToEur?: number;
    label: string;
    type: AccountType;
}

export interface AccountsRegistry {
    version: 2;
    accounts: Record<string, AccountRegistryEntry>;
}

export type CategoryType = "EXPENSE" | "INCOME" | "TRANSFER" | "NEUTRAL";

export type CategoriesRegistry = Record<
    string,
    {
        children?: CategoriesRegistry;
        categoryType: CategoryType;
    }
>;
