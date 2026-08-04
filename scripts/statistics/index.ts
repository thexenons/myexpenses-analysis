import { join } from "node:path";
import { getAccountsRegistry } from "../parse-export/accounts-registry.ts";
import { getCategoriesRegistry } from "../parse-export/categories-registry.ts";
import { getParsedData } from "../parse-export/parsed-data.ts";
import type { AccountsRegistry, CategoriesRegistry, ParsedData, ParsedTransaction } from "../types.ts";
import { readFile, writeFile } from "node:fs/promises";


const rootPath = process.cwd();
const dataPath = join(rootPath, "data");
const statisticsFilePath = join(dataPath, "statistics.json");

export async function getStatistics(): Promise<Statistics> {
    return JSON.parse(await readFile(statisticsFilePath, "utf-8"));
}

interface StatisticsAtom {
    total: number;
    expenses: number;
    incomes: number;
    transfers: number;
}
export function generateStatisticsAtom(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
): StatisticsAtom {
    let statistics: StatisticsAtom = {
        total: 0,
        expenses: 0,
        incomes: 0,
        transfers: 0,
    };

    for (const transaction of transactions) {
        if (transaction.category[0] === 'Transferencia') {
            statistics.transfers += transaction.amount;
        } else {
            const categoryType = categoriesRegistry[transaction.category[0]]?.categoryType;
            if (categoryType === 'EXPENSE') {
                statistics.expenses += transaction.amount;
            } else if (categoryType === 'INCOME') {
                statistics.incomes += transaction.amount;
            } else if (transaction.amount < 0) {
                statistics.expenses += transaction.amount;
            } else {
                statistics.incomes += transaction.amount;
            }
        }
    }

    statistics.total = statistics.incomes + statistics.expenses + statistics.transfers;

    return statistics;
}

interface CategoryStatistics {
    subCategories?: Record<string, CategoryStatistics>;
    statistics: StatisticsAtom;
}
function generateCategoryStatistics(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
    category: string[],
): CategoryStatistics {
    let statistics: CategoryStatistics = {
        statistics: generateStatisticsAtom(
            transactions.filter((transaction) => category.every((c, i) => transaction.category[i] === c)),
            categoriesRegistry,
        ),
    };

    const subCategories = categoriesRegistry[category.at(-1)!]?.children;
    if (subCategories) {
        statistics.subCategories = {};
        for (const subCategory in subCategories) {
            statistics.subCategories[subCategory] = generateCategoryStatistics(
                transactions.filter((transaction) => [...category, subCategory].every((c, i) => transaction.category[i] === c)),
                subCategories,
                [...category, subCategory],
            );
        }
    }

    return statistics;
}
function generateStatisticsCategories(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
): Record<string, CategoryStatistics> {
    const statisticsCategories: Record<string, CategoryStatistics> = {};

    for (const category in categoriesRegistry) {
        statisticsCategories[category] = generateCategoryStatistics(
            transactions,
            categoriesRegistry,
            [category],
        );
    }

    return statisticsCategories;
}

interface StatisticsMolecule {
    all: StatisticsAtom;
    categories: Record<string, CategoryStatistics>;
}
function generateStatisticsMolecule(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
): StatisticsMolecule {
    const statistics: StatisticsMolecule = {
        all: generateStatisticsAtom(transactions, categoriesRegistry),
        categories: generateStatisticsCategories(transactions, categoriesRegistry),
    };

    return statistics;
}

interface DayStatistics {
    statistics: StatisticsMolecule;
}
function generateDayStatistics(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
    date: Date,
): DayStatistics {
    const statistics: DayStatistics = {
        statistics: generateStatisticsMolecule(transactions.filter((transaction) => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getFullYear() === date.getFullYear() &&
                transactionDate.getMonth() === date.getMonth() &&
                transactionDate.getDate() === date.getDate();
        }), categoriesRegistry),
    };

    return statistics;
}

interface MonthStatistics {
    days: Record<number, DayStatistics>;
    statistics: StatisticsMolecule;
}
function generateMonthStatistics(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
    startDate: Date,
    endDate: Date,
): MonthStatistics {
    const statistics: MonthStatistics = {
        statistics: generateStatisticsMolecule(transactions.filter((transaction) => {
            const transactionDate = new Date(transaction.date);
            const transactionStartDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
            const transactionEndDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0);

            return startDate >= transactionStartDate && endDate < transactionEndDate;
        }), categoriesRegistry),
        days: {}
    };

    return statistics;
}

interface YearStatistics {
    months: Record<number, MonthStatistics>;
    statistics: StatisticsMolecule;
}

interface StatisticsWithYears extends StatisticsMolecule {
    years: Record<number, YearStatistics>;
}

interface Statistics {
    statistics: StatisticsWithYears;
    statisticsWithDebts: StatisticsWithYears;
    debtsStatistics: StatisticsWithYears;
}

export async function generateStatistics(
    parsedData: ParsedData,
    accountsRegistry: AccountsRegistry,
    categoriesRegistry: CategoriesRegistry,
): Promise<Statistics> {
    let statistics: Statistics = {
        statistics: {
            ...generateStatisticsMolecule(parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
                return [...prev, ...curr.transactions];
            }, []), categoriesRegistry),
            years: {}
        },
        statisticsWithDebts: {
            ...generateStatisticsMolecule(parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
                const accountType = accountsRegistry[curr.label];
                if (accountType === "DEBT") return prev;
                return [...prev, ...curr.transactions];
            }, []), categoriesRegistry),
            years: {}
        },
        debtsStatistics: {
            ...generateStatisticsMolecule(parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
                const accountType = accountsRegistry[curr.label];
                if (accountType !== "DEBT") return prev;
                return [...prev, ...curr.transactions];
            }, []), categoriesRegistry),
            years: {}
        }
    }

    await writeFile(statisticsFilePath, JSON.stringify(statistics, null, 2), "utf-8");

    return statistics;
}

console.log(
    await generateStatistics(await getParsedData(), await getAccountsRegistry(), await getCategoriesRegistry()),
);
