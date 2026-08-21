import type {
    DefaultExportTransaction,
    ExportData,
    ParsedAccount,
    ParsedData,
    ParsedDirectTransaction,
    ParsedParentTransactionContext,
    ParsedSplitTransaction,
    ParsedTransaction,
    SplitExportTransaction,
    SplitExportTransactionDefaultSplit,
} from "../types.ts";
import {
    PARSED_DATA_FILE_PATH,
    writeJsonAtomically,
} from "../files.ts";
import { parseExportDate } from "./validation.ts";

interface OptionalTransactionFields {
    comment?: string;
    tags?: string[];
    payee?: string;
}

function getOptionalFields(
    primary: {
        comment?: string;
        tags?: string[];
        payee?: string;
    },
    fallback?: {
        comment?: string;
        tags?: string[];
        payee?: string;
    },
): OptionalTransactionFields {
    const comment = primary.comment ?? fallback?.comment;
    const tags = primary.tags ?? fallback?.tags;
    const payee = primary.payee ?? fallback?.payee;
    return {
        ...(comment === undefined ? {} : { comment }),
        ...(tags === undefined ? {} : { tags: [...tags] }),
        ...(payee === undefined ? {} : { payee }),
    };
}

function parseDirectTransaction(
    transaction: DefaultExportTransaction,
): ParsedDirectTransaction {
    return {
        uuid: transaction.uuid,
        date: parseExportDate(transaction.date),
        amount: transaction.amount,
        category: [...transaction.category],
        ...getOptionalFields(transaction),
        ...(transaction.transferAccount === undefined
            ? {}
            : { transferAccount: transaction.transferAccount }),
        sourceTransactionUuid: transaction.uuid,
        sourceStatus: transaction.status,
        splitIndex: null,
        splitCount: null,
    };
}

function parseParentContext(
    transaction: SplitExportTransaction,
): ParsedParentTransactionContext {
    return {
        date: parseExportDate(transaction.date),
        amount: transaction.amount,
        ...getOptionalFields(transaction),
    };
}

function parseSplitTransaction(
    parent: SplitExportTransaction,
    split: SplitExportTransactionDefaultSplit,
    splitIndex: number,
): ParsedSplitTransaction {
    return {
        uuid: split.uuid,
        date: parseExportDate(split.date),
        amount: split.amount,
        category: [...split.category],
        ...getOptionalFields(split, parent),
        ...(split.transferAccount === undefined
            ? {}
            : { transferAccount: split.transferAccount }),
        sourceTransactionUuid: parent.uuid,
        sourceStatus: parent.status,
        splitIndex,
        splitCount: parent.splits.length,
        parent: parseParentContext(parent),
    };
}

/** Pure transformation from validated export accounts to auditable postings. */
export function parseExportData(exportData: ExportData): ParsedData {
    return exportData.map<ParsedAccount>((exportAccount) => {
        const transactions: ParsedTransaction[] = [];
        for (const transaction of exportAccount.transactions) {
            if (!("splits" in transaction)) {
                transactions.push(parseDirectTransaction(transaction));
                continue;
            }

            for (const [splitIndex, split] of transaction.splits.entries()) {
                transactions.push(
                    parseSplitTransaction(transaction, split, splitIndex),
                );
            }
        }

        return {
            uuid: exportAccount.uuid,
            label: exportAccount.label,
            currency: exportAccount.currency,
            openingBalance: exportAccount.openingBalance,
            transactions,
        };
    });
}

export async function saveParsedData(
    parsedData: ParsedData,
    filePath = PARSED_DATA_FILE_PATH,
): Promise<void> {
    await writeJsonAtomically(filePath, parsedData);
}
