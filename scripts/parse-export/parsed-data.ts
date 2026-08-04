import { join, parse } from "node:path";
import type { ExportData, ParsedAccount, ParsedData } from "./types.ts";
import { writeFile } from "node:fs/promises";


const rootPath = process.cwd();
const dataPath = join(rootPath, 'data');
const parsedDataFilePath = join(dataPath, 'parsed-data.json');

export async function updateParsedData(exportData: ExportData): Promise<ParsedData> {
    let parsedData: ParsedData = [];

    for (const exportAccount of exportData) {
        const { transactions: exportTransactions, ...rest } = exportAccount;

        let parsedAccount: ParsedAccount = {
            ...rest,
            transactions: [],
        }
        let newTransactionsCount = 0;
        let deletedTransactionsCount = 0;
        for (const exportTransaction of exportTransactions) {
            if (exportTransaction.status === 'VOID') {
                deletedTransactionsCount++;
                continue;
            }
            if (!('splits' in exportTransaction)) {
                const { status: _status, ...parsedTransaction } = exportTransaction;
                parsedAccount.transactions.push(parsedTransaction);
                continue;
            }

            const { splits: exportSplits, status: _status, ...parsedTransaction } = exportTransaction;
            newTransactionsCount--;
            for (const split of exportSplits) {
                newTransactionsCount++;
                parsedAccount.transactions.push({
                    ...parsedTransaction,
                    ...split,
                })
            }
        }

        parsedData.push(parsedAccount);
    }

    await writeFile(parsedDataFilePath, JSON.stringify(parsedData, null, 2), 'utf-8');

    return parsedData;
}