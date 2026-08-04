export interface BaseExportTransaction {
    uuid: string;
    status: 'UNRECONCILED' | 'RECONCILED' | 'VOID';
    date: string;
    amount: number;
    comment?: string;
    tags?: string[];
}

export interface DefaultExportTransaction extends BaseExportTransaction {
    payee?: string;
    category: string[];
}

export interface TransferExportTransaction extends BaseExportTransaction {
    category: string[];
    transferAccount: string;
}

export type SplitExportTransactionDefaultSplit = Omit<DefaultExportTransaction, 'status'>;
export type SplitExportTransactionTransferSplit = Omit<TransferExportTransaction, 'status'>;

export interface SplitExportTransaction extends BaseExportTransaction {
    payee?: string;
    splits: (SplitExportTransactionDefaultSplit | SplitExportTransactionTransferSplit)[];
}

export type ExportTransaction = DefaultExportTransaction | TransferExportTransaction | SplitExportTransaction;

export interface ExportAccount {
    uuid: string;
    label: string;
    currency: 'EUR' | 'GBP' | 'USD';
    openingBalance: number;
    transactions: ExportTransaction[];
}

export type ExportData = ExportAccount[];

export type ParsedTransaction = Omit<DefaultExportTransaction, 'status'> | Omit<TransferExportTransaction, 'status'>;

export interface ParsedAccount {
    uuid: string;
    label: string;
    currency: 'EUR' | 'GBP' | 'USD';
    openingBalance: number;
    transactions: ParsedTransaction[];
}

export type ParsedData = ParsedAccount[];

export type AccountType = 'DEFAULT' | 'DEBT'

export type AccountsRegistry = Record<string, AccountType>;
