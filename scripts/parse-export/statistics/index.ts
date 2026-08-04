import type { AccountsRegistry, ParsedData } from "../types.ts";

interface StatisticsObject {
    total: number;
    default: number;
    debt: number;
}

export function generateStatisticsObject(parsedData: ParsedData, accountsRegistry: AccountsRegistry): StatisticsObject {
    let statistics: StatisticsObject = {
        total: 0,
        default: 0,
        debt: 0,
    }

    for (const account of parsedData) {
        statistics.total += account.transactions.length;
        if (accountsRegistry[account.label] === 'DEBT') {
            statistics.debt += account.transactions.length;
        } else {
            statistics.default += account.transactions.length;
        }
    }

    return statistics;
}

export function generateStatistics(parsedData: ParsedData, accountsRegistry: AccountsRegistry): void {
    console.log({ statistics: generateStatisticsObject(parsedData, accountsRegistry) })
}