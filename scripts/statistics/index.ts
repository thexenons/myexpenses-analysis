import { getAccountsRegistry } from "../parse-export/accounts-registry.ts";
import { getParsedData } from "../parse-export/parsed-data.ts";
import type { AccountsRegistry, ParsedData } from "../types.ts";

interface StatisticsAtom {
    total: number;
    default: number;
    debt: number;
}

interface CategoryStatistics {
    subCategories?: Record<string, CategoryStatistics>;
    statistics: StatisticsAtom;
}

interface StatisticsMolecule {
    all: StatisticsAtom;
    categories: Record<string, CategoryStatistics>;
}

interface DayStatistics {
    statistics: StatisticsMolecule;
}

interface MonthStatistics {
    days: Record<number, DayStatistics>;
    statistics: StatisticsMolecule;
}

interface YearStatistics {
    months: Record<number, MonthStatistics>;
    statistics: StatisticsMolecule;
}

interface Statistics {
    years: Record<number, YearStatistics>;
    statistics: StatisticsMolecule;
}

export function generateStatisticsAtom(
    parsedData: ParsedData,
    accountsRegistry: AccountsRegistry,
): StatisticsAtom {
    let statistics: StatisticsAtom = {
        total: 0,
        default: 0,
        debt: 0,
    };

    for (const account of parsedData) {
        statistics.total += account.transactions.length;
        if (accountsRegistry[account.label] === "DEBT") {
            statistics.debt += account.transactions.length;
        } else {
            statistics.default += account.transactions.length;
        }
    }

    return statistics;
}

export function generateStatistics(
    parsedData: ParsedData,
    accountsRegistry: AccountsRegistry,
): StatisticsAtom {
    return generateStatisticsAtom(parsedData, accountsRegistry);
}

console.log(
    generateStatistics(await getParsedData(), await getAccountsRegistry()),
);
