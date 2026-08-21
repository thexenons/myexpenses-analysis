import type {
    AccountType,
    AccountsRegistry,
    CategoriesRegistry,
    CategoryType,
    CurrencyCode,
    ExchangeRateMode,
    IsoDate,
    ParsedAccount,
    ParsedData,
    ParsedTransaction,
} from "../types.ts";
import {
    convertMinorUnits,
    DEFAULT_CURRENCY,
    type ExchangeRate,
    type ExchangeRateProvider,
} from "./exchange-rates.ts";

const TRANSFER_CATEGORY = "Transferencia";
const MAX_EXCHANGE_RATE_CONCURRENCY = 4;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const VALID_CATEGORY_TYPES = new Set<CategoryType>([
    "EXPENSE",
    "INCOME",
    "TRANSFER",
    "NEUTRAL",
]);

export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface StatisticsAtom {
    total: number;
    expenses: number;
    incomes: number;
    transfers: number;
}

export interface CategoryStatistics {
    subCategories?: Record<string, CategoryStatistics>;
    statistics: StatisticsAtom;
}

export interface StatisticsMolecule {
    all: StatisticsAtom;
    categories: Record<string, CategoryStatistics>;
}

export interface DayStatistics {
    statistics: StatisticsMolecule;
}

export interface MonthStatistics {
    days: Record<number, DayStatistics>;
    statistics: StatisticsMolecule;
}

export interface YearStatistics {
    months: Partial<Record<MonthNumber, MonthStatistics>>;
    statistics: StatisticsMolecule;
}

export interface StatisticsWithYears extends StatisticsMolecule {
    /**
     * Sum of each account's final native-currency balance converted once.
     * It can differ from `historicalFlowBalance` because conversion and
     * rounding happen at a different boundary.
     */
    accountValuationBalance: number;
    /** Converted opening balances plus individually converted postings. */
    historicalFlowBalance: number;
    openingBalance: number;
    years: Record<number, YearStatistics>;
}

export interface Statistics {
    metadata: {
        currency: typeof DEFAULT_CURRENCY;
        exchangeRates: {
            source: string;
            staticRates: "accountsRegistry";
            version: 1;
        };
        views: {
            debtsStatistics: "debtsOnly";
            statistics: "appCompatible";
            statisticsWithDebts: "realCashFlow";
        };
    };
    statistics: StatisticsWithYears;
    statisticsWithDebts: StatisticsWithYears;
    debtsStatistics: StatisticsWithYears;
}

interface ParsedDateParts {
    day: number;
    isoDate: IsoDate;
    month: MonthNumber;
    year: number;
}

type StatisticsBucket = "expenses" | "incomes" | "transfers";

interface PendingTransaction {
    accountType: AccountType;
    amountMinorUnits: number;
    bucket: StatisticsBucket;
    category: readonly string[];
    context: string;
    currency: CurrencyCode;
    date: ParsedDateParts;
    exchangeRateMode: ExchangeRateMode | null;
    exchangeRateToEur: number | null;
    linked: boolean;
    parentAmountMinorUnits: number | null;
    rateDate: IsoDate;
    sourceGroupKey: string;
    splitCount: number | null;
    splitIndex: number | null;
}

interface NormalizedTransaction
    extends Omit<
        PendingTransaction,
        | "exchangeRateToEur"
        | "exchangeRateMode"
        | "linked"
        | "parentAmountMinorUnits"
        | "rateDate"
    > {
    amountMinorUnits: number;
}

interface MinorStatisticsAtom {
    total: number;
    expenses: number;
    incomes: number;
    transfers: number;
}

interface CategoryAccumulator {
    statistics: MinorStatisticsAtom;
    subCategories: Map<string, CategoryAccumulator>;
}

interface MoleculeAccumulator {
    all: MinorStatisticsAtom;
    categories: Map<string, CategoryAccumulator>;
}

interface DayAccumulator {
    statistics: MoleculeAccumulator;
}

interface MonthAccumulator {
    days: Map<number, DayAccumulator>;
    statistics: MoleculeAccumulator;
}

interface YearAccumulator {
    months: Map<MonthNumber, MonthAccumulator>;
    statistics: MoleculeAccumulator;
}

interface ViewAccumulator {
    accountValuationBalanceMinorUnits: number;
    openingBalanceMinorUnits: number;
    statistics: MoleculeAccumulator;
    years: Map<number, YearAccumulator>;
}

interface OpeningBalances {
    all: number;
    debt: number;
    nonDebt: number;
}

interface AccountValuationBalances {
    all: number;
    debt: number;
    nonDebt: number;
}

interface PendingStatisticsInput {
    accountValuationBalances: AccountValuationBalances;
    openingBalances: OpeningBalances;
    transactions: PendingTransaction[];
}

interface RateRequest {
    base: CurrencyCode;
    date: IsoDate;
    key: string;
}

function transactionContext(
    account: ParsedAccount,
    transaction: ParsedTransaction,
): string {
    const sourceSuffix =
        transaction.sourceTransactionUuid === transaction.uuid
            ? ""
            : `, source ${transaction.sourceTransactionUuid}`;
    return `Account "${account.label}" (${account.uuid}), transaction ${transaction.uuid}${sourceSuffix}`;
}

function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        const leapYear =
            year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        return leapYear ? 29 : 28;
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function parseIsoDate(
    value: unknown,
    context = "Date",
): ParsedDateParts {
    if (typeof value !== "string") {
        throw new Error(`${context}: expected an ISO date string`);
    }

    const match = ISO_DATE_PATTERN.exec(value);
    if (match === null) {
        throw new Error(`${context}: invalid ISO date ${JSON.stringify(value)}`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
        year < 1 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > daysInMonth(year, month)
    ) {
        throw new Error(`${context}: invalid calendar date ${value}`);
    }

    return {
        day,
        isoDate: value as IsoDate,
        month: month as MonthNumber,
        year,
    };
}

export function toMinorUnits(amount: unknown, context = "Amount"): number {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
        throw new Error(`${context}: expected a finite numeric amount`);
    }

    const scaled = amount * 100;
    const rounded = Math.round(scaled);
    if (
        !Number.isSafeInteger(rounded) ||
        Math.abs(scaled - rounded) > 1e-7
    ) {
        throw new Error(`${context}: amount must have at most two decimal places`);
    }

    return rounded === 0 ? 0 : rounded;
}

function fromMinorUnits(amount: number): number {
    if (!Number.isSafeInteger(amount)) {
        throw new Error(`Unsafe accumulated amount in minor units: ${amount}`);
    }
    return amount / 100;
}

function roundHalfAwayFromZero(value: number, context: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`${context}: conversion produced a non-finite amount`);
    }

    const result = Math.sign(value) * Math.round(Math.abs(value));
    if (!Number.isSafeInteger(result)) {
        throw new Error(`${context}: conversion produced an unsafe amount`);
    }
    return result === 0 ? 0 : result;
}

function assertCurrency(value: unknown, context: string): CurrencyCode {
    if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
        throw new Error(`${context}: invalid currency ${JSON.stringify(value)}`);
    }
    return value as CurrencyCode;
}

function assertAccountType(value: unknown, context: string): AccountType {
    if (value !== "DEFAULT" && value !== "DEBT") {
        throw new Error(`${context}: invalid account type ${JSON.stringify(value)}`);
    }
    return value;
}

function validateCategoryPath(
    category: unknown,
    categoriesRegistry: CategoriesRegistry,
    amountMinorUnits: number,
    context: string,
): { bucket: StatisticsBucket; path: readonly string[] } {
    if (!Array.isArray(category) || category.length === 0) {
        throw new Error(`${context}: category path cannot be empty`);
    }

    let registryLevel: CategoriesRegistry | undefined = categoriesRegistry;
    let rootCategoryType: CategoryType | undefined;
    const path: string[] = [];

    for (const [index, categoryName] of category.entries()) {
        if (typeof categoryName !== "string" || categoryName.length === 0) {
            throw new Error(`${context}: invalid category at index ${index}`);
        }
        if (
            registryLevel === undefined ||
            !Object.hasOwn(registryLevel, categoryName)
        ) {
            throw new Error(
                `${context}: unknown category path ${JSON.stringify([...path, categoryName])}`,
            );
        }

        const categoryEntry: CategoriesRegistry[string] | undefined =
            registryLevel[categoryName];
        if (
            typeof categoryEntry !== "object" ||
            categoryEntry === null ||
            !VALID_CATEGORY_TYPES.has(categoryEntry.categoryType)
        ) {
            throw new Error(
                `${context}: category ${JSON.stringify(categoryName)} has an invalid type`,
            );
        }

        rootCategoryType ??= categoryEntry.categoryType;
        path.push(categoryName);
        registryLevel = categoryEntry.children;
    }

    if (path[0] === TRANSFER_CATEGORY) {
        return { bucket: "transfers", path };
    }
    if (rootCategoryType === "EXPENSE") {
        return { bucket: "expenses", path };
    }
    if (rootCategoryType === "INCOME") {
        return { bucket: "incomes", path };
    }
    return {
        bucket: amountMinorUnits < 0 ? "expenses" : "incomes",
        path,
    };
}

function validateAccountsRegistry(accountsRegistry: AccountsRegistry): void {
    if (
        typeof accountsRegistry !== "object" ||
        accountsRegistry === null ||
        accountsRegistry.version !== 2 ||
        typeof accountsRegistry.accounts !== "object" ||
        accountsRegistry.accounts === null ||
        Array.isArray(accountsRegistry.accounts)
    ) {
        throw new Error("Unsupported accounts registry: expected schema version 2");
    }
}

function rateKey(date: IsoDate, currency: CurrencyCode): string {
    return `${date}|${currency}|${DEFAULT_CURRENCY}`;
}

function sourceGroupKey(accountUuid: string, sourceTransactionUuid: string): string {
    return `${accountUuid}\u0000${sourceTransactionUuid}`;
}

function createPendingTransactions(
    parsedData: ParsedData,
    accountsRegistry: AccountsRegistry,
    categoriesRegistry: CategoriesRegistry,
): PendingStatisticsInput {
    validateAccountsRegistry(accountsRegistry);
    if (
        typeof categoriesRegistry !== "object" ||
        categoriesRegistry === null ||
        Array.isArray(categoriesRegistry)
    ) {
        throw new Error("Invalid categories registry");
    }

    const pendingTransactions: PendingTransaction[] = [];
    const openingBalances: OpeningBalances = { all: 0, debt: 0, nonDebt: 0 };
    const accountValuationBalances: AccountValuationBalances = {
        all: 0,
        debt: 0,
        nonDebt: 0,
    };
    const accountUuids = new Set<string>();
    const leafTransactionKeys = new Set<string>();

    for (const account of parsedData) {
        if (typeof account.uuid !== "string" || account.uuid.length === 0) {
            throw new Error(`Account ${JSON.stringify(account.label)} has an invalid UUID`);
        }
        if (accountUuids.has(account.uuid)) {
            throw new Error(`Duplicate account UUID ${account.uuid}`);
        }
        accountUuids.add(account.uuid);

        const accountEntry = Object.hasOwn(accountsRegistry.accounts, account.uuid)
            ? accountsRegistry.accounts[account.uuid]
            : undefined;
        if (accountEntry === undefined) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) is missing from accounts registry`,
            );
        }
        if (
            typeof accountEntry !== "object" ||
            accountEntry === null ||
            Array.isArray(accountEntry) ||
            typeof accountEntry.label !== "string" ||
            accountEntry.label.length === 0
        ) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) has an invalid accounts registry entry`,
            );
        }
        const accountType = assertAccountType(
            accountEntry.type,
            `Account "${account.label}" (${account.uuid})`,
        );
        const currency = assertCurrency(
            account.currency,
            `Account "${account.label}" (${account.uuid})`,
        );
        const rawExchangeRate = accountEntry.exchangeRateToEur;
        if (
            rawExchangeRate !== undefined &&
            (typeof rawExchangeRate !== "number" ||
                !Number.isFinite(rawExchangeRate) ||
                rawExchangeRate <= 0)
        ) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) has an invalid static EUR exchange rate`,
            );
        }
        const exchangeRateToEur = rawExchangeRate ?? null;
        const rawExchangeRateMode = accountEntry.exchangeRateMode;
        if (
            rawExchangeRateMode !== undefined &&
            rawExchangeRateMode !== "DYNAMIC" &&
            rawExchangeRateMode !== "STATIC"
        ) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) has an invalid exchange-rate mode`,
            );
        }
        const exchangeRateMode = rawExchangeRateMode ?? null;
        if (currency !== DEFAULT_CURRENCY && exchangeRateMode === null) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) requires an exchange-rate mode`,
            );
        }
        if (
            currency !== DEFAULT_CURRENCY &&
            exchangeRateMode === "STATIC" &&
            exchangeRateToEur === null
        ) {
            throw new Error(
                `Account "${account.label}" (${account.uuid}) requires a static EUR exchange rate in STATIC mode`,
            );
        }
        const openingBalanceMinorUnits = toMinorUnits(
            account.openingBalance,
            `Account "${account.label}" (${account.uuid}), opening balance`,
        );
        let openingBalanceInEur = openingBalanceMinorUnits;
        if (currency !== DEFAULT_CURRENCY && openingBalanceMinorUnits !== 0) {
            if (exchangeRateToEur === null) {
                throw new Error(
                    `Account "${account.label}" (${account.uuid}) requires a static EUR exchange rate for its non-zero opening balance`,
                );
            }
            openingBalanceInEur = convertMinorUnits(
                openingBalanceMinorUnits,
                exchangeRateToEur,
            );
        }
        openingBalances.all = addSafeMinorUnits(
            openingBalances.all,
            openingBalanceInEur,
            `Account "${account.label}" (${account.uuid}), opening balance`,
        );
        const accountOpeningBucket =
            accountType === "DEBT" ? "debt" : "nonDebt";
        openingBalances[accountOpeningBucket] = addSafeMinorUnits(
            openingBalances[accountOpeningBucket],
            openingBalanceInEur,
            `Account "${account.label}" (${account.uuid}), opening balance`,
        );

        let accountMovementsMinorUnits = 0;
        for (const transaction of account.transactions) {
            const context = transactionContext(account, transaction);
            if (
                transaction.sourceStatus !== "UNRECONCILED" &&
                transaction.sourceStatus !== "RECONCILED" &&
                transaction.sourceStatus !== "VOID"
            ) {
                throw new Error(`${context}: invalid source status`);
            }
            if (transaction.sourceStatus === "VOID") {
                continue;
            }
            if (
                typeof transaction.uuid !== "string" ||
                transaction.uuid.length === 0 ||
                typeof transaction.sourceTransactionUuid !== "string" ||
                transaction.sourceTransactionUuid.length === 0
            ) {
                throw new Error(`${context}: invalid transaction provenance`);
            }

            const leafKey = `${account.uuid}\u0000${transaction.uuid}`;
            if (leafTransactionKeys.has(leafKey)) {
                throw new Error(`${context}: duplicate leaf transaction UUID`);
            }
            leafTransactionKeys.add(leafKey);

            const date = parseIsoDate(transaction.date, `${context}, date`);
            const amountMinorUnits = toMinorUnits(
                transaction.amount,
                `${context}, amount`,
            );
            accountMovementsMinorUnits = addSafeMinorUnits(
                accountMovementsMinorUnits,
                amountMinorUnits,
                context,
            );
            const category = validateCategoryPath(
                transaction.category,
                categoriesRegistry,
                amountMinorUnits,
                context,
            );
            const linked = transaction.transferAccount !== undefined;
            if (
                linked &&
                (typeof transaction.transferAccount !== "string" ||
                    transaction.transferAccount.length === 0)
            ) {
                throw new Error(`${context}: invalid linked account reference`);
            }

            let parentAmountMinorUnits: number | null = null;
            let rateDate = date.isoDate;
            if (transaction.splitIndex === null) {
                if (
                    transaction.splitCount !== null ||
                    transaction.sourceTransactionUuid !== transaction.uuid
                ) {
                    throw new Error(`${context}: invalid direct-transaction provenance`);
                }
            } else {
                if (
                    !Number.isInteger(transaction.splitIndex) ||
                    !Number.isInteger(transaction.splitCount) ||
                    transaction.splitCount <= 0 ||
                    transaction.splitIndex < 0 ||
                    transaction.splitIndex >= transaction.splitCount ||
                    typeof transaction.parent !== "object" ||
                    transaction.parent === null
                ) {
                    throw new Error(`${context}: invalid split provenance`);
                }

                const parentDate = parseIsoDate(
                    transaction.parent.date,
                    `${context}, parent date`,
                );
                parentAmountMinorUnits = toMinorUnits(
                    transaction.parent.amount,
                    `${context}, parent amount`,
                );
                rateDate = parentDate.isoDate;
                if (
                    currency !== DEFAULT_CURRENCY &&
                    exchangeRateMode === "DYNAMIC" &&
                    parentAmountMinorUnits === 0
                ) {
                    throw new Error(
                        `${context}: cannot convert a foreign-currency split with a zero parent amount`,
                    );
                }
            }
            if (
                currency !== DEFAULT_CURRENCY &&
                transaction.splitIndex === null &&
                linked &&
                exchangeRateToEur === null
            ) {
                throw new Error(
                    `${context}: linked foreign-currency posting requires a static EUR exchange rate`,
                );
            }

            pendingTransactions.push({
                accountType,
                amountMinorUnits,
                bucket: category.bucket,
                category: category.path,
                context,
                currency,
                date,
                exchangeRateMode,
                exchangeRateToEur,
                linked,
                parentAmountMinorUnits,
                rateDate,
                sourceGroupKey: sourceGroupKey(
                    account.uuid,
                    transaction.sourceTransactionUuid,
                ),
                splitCount: transaction.splitCount,
                splitIndex: transaction.splitIndex,
            });
        }

        const nativeAccountBalance = addSafeMinorUnits(
            openingBalanceMinorUnits,
            accountMovementsMinorUnits,
            `Account "${account.label}" (${account.uuid}), native balance`,
        );
        let accountBalanceInEur = nativeAccountBalance;
        if (currency !== DEFAULT_CURRENCY && nativeAccountBalance !== 0) {
            if (exchangeRateMode === "DYNAMIC") {
                throw new Error(
                    `Account "${account.label}" (${account.uuid}) has a non-zero DYNAMIC balance, but the export does not contain its latest EUR valuation rate`,
                );
            }
            accountBalanceInEur = convertMinorUnits(
                nativeAccountBalance,
                exchangeRateToEur!,
            );
        }
        accountValuationBalances.all = addSafeMinorUnits(
            accountValuationBalances.all,
            accountBalanceInEur,
            `Account "${account.label}" (${account.uuid}), account balance`,
        );
        accountValuationBalances[accountOpeningBucket] = addSafeMinorUnits(
            accountValuationBalances[accountOpeningBucket],
            accountBalanceInEur,
            `Account "${account.label}" (${account.uuid}), account balance`,
        );
    }

    validateSplitGroups(pendingTransactions);
    return {
        accountValuationBalances,
        openingBalances,
        transactions: pendingTransactions,
    };
}

function validateSplitGroups(transactions: readonly PendingTransaction[]): void {
    const groups = new Map<string, PendingTransaction[]>();
    for (const transaction of transactions) {
        if (transaction.splitIndex === null) {
            continue;
        }
        const group = groups.get(transaction.sourceGroupKey);
        if (group === undefined) {
            groups.set(transaction.sourceGroupKey, [transaction]);
        } else {
            group.push(transaction);
        }
    }

    for (const transactionsInGroup of groups.values()) {
        const first = transactionsInGroup[0]!;
        const expectedCount = first.splitCount!;
        const indices = new Set<number>();
        let childrenTotal = 0;

        for (const transaction of transactionsInGroup) {
            if (
                transaction.splitCount !== expectedCount ||
                transaction.parentAmountMinorUnits !== first.parentAmountMinorUnits ||
                transaction.rateDate !== first.rateDate ||
                transaction.currency !== first.currency ||
                transaction.exchangeRateMode !== first.exchangeRateMode ||
                transaction.accountType !== first.accountType
            ) {
                throw new Error(`${transaction.context}: inconsistent split group`);
            }
            if (indices.has(transaction.splitIndex!)) {
                throw new Error(`${transaction.context}: duplicate split index`);
            }
            indices.add(transaction.splitIndex!);
            childrenTotal = addSafeMinorUnits(
                childrenTotal,
                transaction.amountMinorUnits,
                transaction.context,
            );
        }

        if (transactionsInGroup.length !== expectedCount) {
            throw new Error(
                `${first.context}: expected ${expectedCount} split parts, found ${transactionsInGroup.length}`,
            );
        }
        if (childrenTotal !== first.parentAmountMinorUnits) {
            throw new Error(
                `${first.context}: split parts do not add up to the parent amount`,
            );
        }
    }
}

function collectRateRequests(
    transactions: readonly PendingTransaction[],
): RateRequest[] {
    const requests = new Map<string, RateRequest>();
    for (const transaction of transactions) {
        if (
            transaction.currency === DEFAULT_CURRENCY ||
            transaction.exchangeRateMode === "STATIC" ||
            (transaction.exchangeRateMode === "DYNAMIC" &&
                transaction.splitIndex === null &&
                transaction.linked)
        ) {
            continue;
        }
        const key = rateKey(transaction.rateDate, transaction.currency);
        if (!requests.has(key)) {
            requests.set(key, {
                base: transaction.currency,
                date: transaction.rateDate,
                key,
            });
        }
    }
    return [...requests.values()];
}

async function runWithConcurrency<T>(
    values: readonly T[],
    concurrency: number,
    callback: (value: T) => Promise<void>,
): Promise<void> {
    let nextIndex = 0;
    let failure: { error: unknown } | undefined;
    const workerCount = Math.min(concurrency, values.length);
    const runWorker = async (): Promise<void> => {
        if (failure !== undefined) {
            return;
        }
        const value = values[nextIndex++];
        if (value !== undefined) {
            try {
                await callback(value);
            } catch (error) {
                failure ??= { error };
                return;
            }
            await runWorker();
        }
    };
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);
    if (failure !== undefined) {
        throw failure.error;
    }
}

function validateRate(rate: ExchangeRate, request: RateRequest): ExchangeRate {
    const effectiveDate = parseIsoDate(
        rate.effectiveDate,
        `Exchange rate ${request.key}, effective date`,
    ).isoDate;
    if (
        rate.requestedDate !== request.date ||
        rate.base !== request.base ||
        rate.quote !== DEFAULT_CURRENCY ||
        typeof rate.rate !== "number" ||
        !Number.isFinite(rate.rate) ||
        rate.rate <= 0 ||
        effectiveDate > request.date
    ) {
        throw new Error(`Exchange-rate provider returned an invalid rate for ${request.key}`);
    }
    return rate;
}

async function prefetchRates(
    transactions: readonly PendingTransaction[],
    provider: ExchangeRateProvider,
): Promise<Map<string, ExchangeRate>> {
    const requests = collectRateRequests(transactions);
    const rates = new Map<string, ExchangeRate>();
    await runWithConcurrency(
        requests,
        MAX_EXCHANGE_RATE_CONCURRENCY,
        async (request) => {
            const rate = validateRate(
                await provider.getRate(
                    request.date,
                    request.base,
                    DEFAULT_CURRENCY,
                ),
                request,
            );
            rates.set(request.key, rate);
        },
    );
    return rates;
}

function normalizeAmounts(
    transactions: readonly PendingTransaction[],
    rates: ReadonlyMap<string, ExchangeRate>,
): NormalizedTransaction[] {
    const convertedParents = new Map<string, number>();

    return transactions.map((transaction) => {
        let amountMinorUnits = transaction.amountMinorUnits;
        if (transaction.currency !== DEFAULT_CURRENCY) {
            if (
                transaction.exchangeRateMode === "STATIC" ||
                (transaction.exchangeRateMode === "DYNAMIC" &&
                    transaction.splitIndex === null &&
                    transaction.linked)
            ) {
                amountMinorUnits = convertMinorUnits(
                    transaction.amountMinorUnits,
                    transaction.exchangeRateToEur!,
                );
            } else {
                const key = rateKey(transaction.rateDate, transaction.currency);
                const exchangeRate = rates.get(key);
                if (exchangeRate === undefined) {
                    throw new Error(
                        `${transaction.context}: missing exchange rate ${key}`,
                    );
                }

                if (transaction.splitIndex === null) {
                    amountMinorUnits = convertMinorUnits(
                        transaction.amountMinorUnits,
                        exchangeRate.rate,
                    );
                } else {
                    // My Expenses first prorates a split from its parent's historical
                    // equivalent, even when the individual split is account-linked.
                    const parentMinorUnits = transaction.parentAmountMinorUnits!;
                    let convertedParent = convertedParents.get(
                        transaction.sourceGroupKey,
                    );
                    if (convertedParent === undefined) {
                        convertedParent = convertMinorUnits(
                            parentMinorUnits,
                            exchangeRate.rate,
                        );
                        convertedParents.set(
                            transaction.sourceGroupKey,
                            convertedParent,
                        );
                    }
                    amountMinorUnits = roundHalfAwayFromZero(
                        (convertedParent / parentMinorUnits) *
                            transaction.amountMinorUnits,
                        `${transaction.context}, split conversion`,
                    );
                }
            }
        }

        const {
            exchangeRateToEur: _exchangeRateToEur,
            linked: _linked,
            parentAmountMinorUnits: _parentAmountMinorUnits,
            rateDate: _rateDate,
            ...normalized
        } = transaction;
        return { ...normalized, amountMinorUnits };
    });
}

function createMinorAtom(): MinorStatisticsAtom {
    return { total: 0, expenses: 0, incomes: 0, transfers: 0 };
}

function createMoleculeAccumulator(): MoleculeAccumulator {
    return { all: createMinorAtom(), categories: new Map() };
}

function createViewAccumulator(
    accountValuationBalanceMinorUnits: number,
    openingBalanceMinorUnits: number,
): ViewAccumulator {
    return {
        accountValuationBalanceMinorUnits,
        openingBalanceMinorUnits,
        statistics: createMoleculeAccumulator(),
        years: new Map(),
    };
}

function addSafeMinorUnits(left: number, right: number, context: string): number {
    const result = left + right;
    if (!Number.isSafeInteger(result)) {
        throw new Error(`${context}: accumulated amount exceeds safe integer range`);
    }
    return result;
}

function addToAtom(
    atom: MinorStatisticsAtom,
    transaction: NormalizedTransaction,
): void {
    atom.total = addSafeMinorUnits(
        atom.total,
        transaction.amountMinorUnits,
        transaction.context,
    );
    atom[transaction.bucket] = addSafeMinorUnits(
        atom[transaction.bucket],
        transaction.amountMinorUnits,
        transaction.context,
    );
}

function addToMolecule(
    molecule: MoleculeAccumulator,
    transaction: NormalizedTransaction,
): void {
    addToAtom(molecule.all, transaction);
    let categoryLevel = molecule.categories;

    for (const categoryName of transaction.category) {
        let category = categoryLevel.get(categoryName);
        if (category === undefined) {
            category = {
                statistics: createMinorAtom(),
                subCategories: new Map(),
            };
            categoryLevel.set(categoryName, category);
        }
        addToAtom(category.statistics, transaction);
        categoryLevel = category.subCategories;
    }
}

function addToView(
    view: ViewAccumulator,
    transaction: NormalizedTransaction,
): void {
    addToMolecule(view.statistics, transaction);

    let year = view.years.get(transaction.date.year);
    if (year === undefined) {
        year = { months: new Map(), statistics: createMoleculeAccumulator() };
        view.years.set(transaction.date.year, year);
    }
    addToMolecule(year.statistics, transaction);

    let month = year.months.get(transaction.date.month);
    if (month === undefined) {
        month = { days: new Map(), statistics: createMoleculeAccumulator() };
        year.months.set(transaction.date.month, month);
    }
    addToMolecule(month.statistics, transaction);

    let day = month.days.get(transaction.date.day);
    if (day === undefined) {
        day = { statistics: createMoleculeAccumulator() };
        month.days.set(transaction.date.day, day);
    }
    addToMolecule(day.statistics, transaction);
}

function finalizeAtom(atom: MinorStatisticsAtom): StatisticsAtom {
    if (atom.total !== atom.expenses + atom.incomes + atom.transfers) {
        throw new Error("Statistics atom invariant failed");
    }
    return {
        total: fromMinorUnits(atom.total),
        expenses: fromMinorUnits(atom.expenses),
        incomes: fromMinorUnits(atom.incomes),
        transfers: fromMinorUnits(atom.transfers),
    };
}

function finalizeCategories(
    categories: ReadonlyMap<string, CategoryAccumulator>,
): Record<string, CategoryStatistics> {
    const result: Record<string, CategoryStatistics> = Object.create(null);
    for (const [name, category] of categories) {
        const finalized: CategoryStatistics = {
            statistics: finalizeAtom(category.statistics),
        };
        if (category.subCategories.size > 0) {
            finalized.subCategories = finalizeCategories(category.subCategories);
        }
        result[name] = finalized;
    }
    return result;
}

function finalizeMolecule(molecule: MoleculeAccumulator): StatisticsMolecule {
    return {
        all: finalizeAtom(molecule.all),
        categories: finalizeCategories(molecule.categories),
    };
}

function finalizeView(view: ViewAccumulator): StatisticsWithYears {
    const years: Record<number, YearStatistics> = Object.create(null);
    for (const [yearNumber, year] of view.years) {
        const months: Partial<Record<MonthNumber, MonthStatistics>> =
            Object.create(null);
        for (const [monthNumber, month] of year.months) {
            const days: Record<number, DayStatistics> = Object.create(null);
            for (const [dayNumber, day] of month.days) {
                days[dayNumber] = {
                    statistics: finalizeMolecule(day.statistics),
                };
            }
            months[monthNumber] = {
                days,
                statistics: finalizeMolecule(month.statistics),
            };
        }
        years[yearNumber] = {
            months,
            statistics: finalizeMolecule(year.statistics),
        };
    }

    const statistics = finalizeMolecule(view.statistics);
    const historicalFlowBalanceMinorUnits = addSafeMinorUnits(
        view.openingBalanceMinorUnits,
        view.statistics.all.total,
        "Historical flow balance",
    );
    return {
        ...statistics,
        accountValuationBalance: fromMinorUnits(
            view.accountValuationBalanceMinorUnits,
        ),
        historicalFlowBalance: fromMinorUnits(
            historicalFlowBalanceMinorUnits,
        ),
        openingBalance: fromMinorUnits(view.openingBalanceMinorUnits),
        years,
    };
}

export async function generateStatistics(
    parsedData: ParsedData,
    accountsRegistry: AccountsRegistry,
    categoriesRegistry: CategoriesRegistry,
    exchangeRateProvider: ExchangeRateProvider,
): Promise<Statistics> {
    const pendingInput = createPendingTransactions(
        parsedData,
        accountsRegistry,
        categoriesRegistry,
    );
    const rates = await prefetchRates(
        pendingInput.transactions,
        exchangeRateProvider,
    );
    const transactions = normalizeAmounts(pendingInput.transactions, rates);

    const allAccounts = createViewAccumulator(
        pendingInput.accountValuationBalances.all,
        pendingInput.openingBalances.all,
    );
    const nonDebtAccounts = createViewAccumulator(
        pendingInput.accountValuationBalances.nonDebt,
        pendingInput.openingBalances.nonDebt,
    );
    const debtAccounts = createViewAccumulator(
        pendingInput.accountValuationBalances.debt,
        pendingInput.openingBalances.debt,
    );

    for (const transaction of transactions) {
        addToView(allAccounts, transaction);
        addToView(
            transaction.accountType === "DEBT"
                ? debtAccounts
                : nonDebtAccounts,
            transaction,
        );
    }

    return {
        metadata: {
            currency: DEFAULT_CURRENCY,
            exchangeRates: {
                source: exchangeRateProvider.source,
                staticRates: "accountsRegistry",
                version: 1,
            },
            views: {
                debtsStatistics: "debtsOnly",
                statistics: "appCompatible",
                statisticsWithDebts: "realCashFlow",
            },
        },
        statistics: finalizeView(allAccounts),
        statisticsWithDebts: finalizeView(nonDebtAccounts),
        debtsStatistics: finalizeView(debtAccounts),
    };
}
