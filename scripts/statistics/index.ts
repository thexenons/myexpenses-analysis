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

// Parses 'DD/MM/YYYY ' (trim, split on '/'). Returns null on invalid → bucket skip.
function parseExpenseDate(date: string): Date | null {
    const [day, month, year] = date.trim().split("/");
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
        return null;
    }

    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
        return null;
    }

    return parsed;
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
            const transactionDate = parseExpenseDate(transaction.date);
            return transactionDate !== null &&
                transactionDate.getFullYear() === date.getFullYear() &&
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
    year: number,
    month: number,
): MonthStatistics | null {
    const monthTransactions = transactions.filter((transaction) => {
        const transactionDate = parseExpenseDate(transaction.date);
        return transactionDate !== null &&
            transactionDate >= new Date(year, month, 1) &&
            transactionDate < new Date(year, month + 1, 1);
    });

    if (monthTransactions.length === 0) {
        return null;
    }

    const days: Record<number, DayStatistics> = {};
    for (const transaction of monthTransactions) {
        const transactionDate = parseExpenseDate(transaction.date);
        if (transactionDate !== null && days[transactionDate.getDate()] === undefined) {
            days[transactionDate.getDate()] = generateDayStatistics(monthTransactions, categoriesRegistry, transactionDate);
        }
    }

    return {
        statistics: generateStatisticsMolecule(monthTransactions, categoriesRegistry),
        days,
    };
}

interface YearStatistics {
    months: Record<number, MonthStatistics>;
    statistics: StatisticsMolecule;
}
function generateYearStatistics(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
    year: number,
): YearStatistics | null {
    const months: Record<number, MonthStatistics> = {};
    for (let month = 0; month < 12; month++) {
        const monthStatistics = generateMonthStatistics(transactions, categoriesRegistry, year, month);
        if (monthStatistics !== null) {
            months[month] = monthStatistics;
        }
    }

    if (Object.keys(months).length === 0) {
        return null;
    }

    return {
        statistics: generateStatisticsMolecule(transactions.filter((transaction) => {
            const transactionDate = parseExpenseDate(transaction.date);
            return transactionDate !== null && transactionDate.getFullYear() === year;
        }), categoriesRegistry),
        months,
    };
}
function generateYears(
    transactions: ParsedTransaction[],
    categoriesRegistry: CategoriesRegistry,
): Record<number, YearStatistics> {
    const years: Record<number, YearStatistics> = {};
    const distinctYears = new Set<number>();
    for (const transaction of transactions) {
        const transactionDate = parseExpenseDate(transaction.date);
        if (transactionDate !== null) {
            distinctYears.add(transactionDate.getFullYear());
        }
    }

    for (const year of distinctYears) {
        const yearStatistics = generateYearStatistics(transactions, categoriesRegistry, year);
        if (yearStatistics !== null) {
            years[year] = yearStatistics;
        }
    }

    return years;
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
    const allTransactions = parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
        return [...prev, ...curr.transactions];
    }, []);
    const nonDebtTransactions = parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
        const accountType = accountsRegistry[curr.label];
        if (accountType === "DEBT") return prev;
        return [...prev, ...curr.transactions];
    }, []);
    const debtTransactions = parsedData.reduce<ParsedTransaction[]>((prev, curr) => {
        const accountType = accountsRegistry[curr.label];
        if (accountType !== "DEBT") return prev;
        return [...prev, ...curr.transactions];
    }, []);

    /*
     * View semantics (intentional — do not rename):
     * - statistics: ALL accounts, debt accounts included.
     * - statisticsWithDebts: REAL cash flow — DEBT accounts excluded, because debt-account
     *   mirror transactions (created via transfers) cancel the original transfer amount,
     *   so keeping them would distort the totals; the name means "statistics as if the
     *   debt mirrors were not cancelling the originals", i.e. true cash flow.
     * - debtsStatistics: only debt accounts.
     * Because of the mirror cancellation, `statistics` shows LOWER expenses than
     * `statisticsWithDebts`. The behavior is intentional; the names are not renamed.
     */
    let statistics: Statistics = {
        statistics: {
            ...generateStatisticsMolecule(allTransactions, categoriesRegistry),
            years: generateYears(allTransactions, categoriesRegistry),
        },
        statisticsWithDebts: {
            ...generateStatisticsMolecule(nonDebtTransactions, categoriesRegistry),
            years: generateYears(nonDebtTransactions, categoriesRegistry),
        },
        debtsStatistics: {
            ...generateStatisticsMolecule(debtTransactions, categoriesRegistry),
            years: generateYears(debtTransactions, categoriesRegistry),
        }
    }

    await writeFile(statisticsFilePath, JSON.stringify(statistics, null, 2), "utf-8");

    return statistics;
}

await generateStatistics(await getParsedData(), await getAccountsRegistry(), await getCategoriesRegistry());
