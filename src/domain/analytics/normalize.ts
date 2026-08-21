import type {
  AccountRegistryEntry,
  AnalyticsDataset,
  AnalyticsSourceData,
  CategoriesRegistry,
  CategoryRegistryEntry,
  CategoryType,
  CurrencyCode,
  ExchangeRateMode,
  ExchangeRateSource,
  IsoDate,
  NormalizeDatasetOptions,
  NormalizedAccount,
  NormalizedPosting,
  ParsedAccount,
  ParsedTransaction,
  PostingBucket,
  TransactionStatus,
} from "./types.ts";

const BASE_CURRENCY = "EUR" as const;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const VALID_STATUSES = new Set<TransactionStatus>([
  "UNRECONCILED",
  "RECONCILED",
  "VOID",
]);
const VALID_CATEGORY_TYPES = new Set<CategoryType>([
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "NEUTRAL",
]);

export function postingIdFor(accountId: string, transactionId: string): string {
  return `${accountId}:${transactionId}`;
}

export function dynamicRateKey(
  date: IsoDate,
  currency: CurrencyCode,
): string {
  return `${date}|${currency}|${BASE_CURRENCY}`;
}

export function toMinorUnits(value: number, context = "Amount"): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context}: expected a finite number`);
  }
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-7) {
    throw new Error(`${context}: expected at most two decimal places`);
  }
  return rounded === 0 ? 0 : rounded;
}

export function minorToMajor(value: number): number {
  assertMinorUnits(value, "Minor-unit amount");
  return value / 100;
}

function assertMinorUnits(value: number, context: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${context}: expected safe integer minor units`);
  }
  return value === 0 ? 0 : value;
}

function addMinor(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${context}: amount exceeds the safe integer range`);
  }
  return result === 0 ? 0 : result;
}

function roundHalfAwayFromZero(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context}: conversion produced a non-finite amount`);
  }
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return assertMinorUnits(rounded, context);
}

function convertMinorUnits(
  amountMinor: number,
  exchangeRateToEur: number,
  context: string,
): number {
  if (!Number.isFinite(exchangeRateToEur) || exchangeRateToEur <= 0) {
    throw new Error(`${context}: exchange rate must be a positive finite number`);
  }
  return roundHalfAwayFromZero(amountMinor * exchangeRateToEur, context);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function assertIsoDate(value: string, context = "Date"): IsoDate {
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
  return value as IsoDate;
}

function assertCurrency(value: string, context: string): CurrencyCode {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new Error(`${context}: invalid currency ${JSON.stringify(value)}`);
  }
  return value as CurrencyCode;
}

function categoryDetails(
  categoryPath: readonly string[],
  categories: CategoriesRegistry,
  amountNativeMinor: number,
  context: string,
): { categoryType: CategoryType; bucket: PostingBucket } {
  if (categoryPath.length === 0) {
    throw new Error(`${context}: category path cannot be empty`);
  }

  let level: CategoriesRegistry | undefined = categories;
  let rootType: CategoryType | undefined;
  for (const [index, name] of categoryPath.entries()) {
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      level === undefined ||
      !Object.hasOwn(level, name)
    ) {
      throw new Error(
        `${context}: unknown category path ${JSON.stringify(categoryPath.slice(0, index + 1))}`,
      );
    }
    const entry: CategoryRegistryEntry | undefined = level[name];
    if (entry === undefined || !VALID_CATEGORY_TYPES.has(entry.categoryType)) {
      throw new Error(`${context}: category ${JSON.stringify(name)} has an invalid type`);
    }
    rootType ??= entry.categoryType;
    level = entry.children;
  }

  if (rootType === undefined) {
    throw new Error(`${context}: category path cannot be empty`);
  }
  let bucket: PostingBucket;
  if (categoryPath[0] === "Transferencia") {
    bucket = "transfer";
  } else if (rootType === "EXPENSE") {
    bucket = "expense";
  } else if (rootType === "INCOME") {
    bucket = "income";
  } else {
    bucket = amountNativeMinor < 0 ? "expense" : "income";
  }
  return { categoryType: rootType, bucket };
}

function normalizeSearchPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function normalizeSearchText(value: string): string {
  return normalizeSearchPart(value.trim()).replace(/\s+/g, " ");
}

function earliestDate(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate < current ? candidate : current;
}

function latestDate(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate > current ? candidate : current;
}

function createSearchIndex(
  account: ParsedAccount,
  transaction: ParsedTransaction,
  amountEurMinor: number,
): string {
  return normalizeSearchText(
    [
      account.label,
      account.currency,
      transaction.uuid,
      transaction.sourceTransactionUuid,
      transaction.date,
      String(transaction.amount),
      String(minorToMajor(amountEurMinor)),
      ...transaction.category,
      ...(transaction.tags ?? []),
      transaction.comment ?? "",
      transaction.payee ?? "",
      transaction.transferAccount ?? "",
      transaction.sourceStatus,
      transaction.parent?.comment ?? "",
      transaction.parent?.payee ?? "",
      ...(transaction.parent?.tags ?? []),
    ].join(" "),
  );
}

function validateRegistryEntry(
  entry: AccountRegistryEntry | undefined,
  account: ParsedAccount,
): AccountRegistryEntry {
  const context = `Account "${account.label}" (${account.uuid})`;
  if (entry === undefined) {
    throw new Error(`${context}: missing accounts-registry entry`);
  }
  if (entry.type !== "DEFAULT" && entry.type !== "DEBT") {
    throw new Error(`${context}: invalid account type`);
  }
  if (
    entry.exchangeRateMode !== undefined &&
    entry.exchangeRateMode !== "STATIC" &&
    entry.exchangeRateMode !== "DYNAMIC"
  ) {
    throw new Error(`${context}: invalid exchange-rate mode`);
  }
  if (
    entry.exchangeRateToEur !== undefined &&
    (!Number.isFinite(entry.exchangeRateToEur) || entry.exchangeRateToEur <= 0)
  ) {
    throw new Error(`${context}: invalid EUR exchange rate`);
  }
  return entry;
}

function accountExchangeMode(
  currency: CurrencyCode,
  entry: AccountRegistryEntry,
  context: string,
): ExchangeRateMode | "IDENTITY" {
  if (currency === BASE_CURRENCY) {
    return "IDENTITY";
  }
  if (entry.exchangeRateMode === undefined) {
    throw new Error(`${context}: foreign account requires an exchange-rate mode`);
  }
  if (entry.exchangeRateMode === "STATIC" && entry.exchangeRateToEur === undefined) {
    throw new Error(`${context}: STATIC account requires exchangeRateToEur`);
  }
  return entry.exchangeRateMode;
}

function dynamicPostingConversion(
  amountNativeMinor: number,
  account: ParsedAccount,
  transaction: ParsedTransaction,
  postingId: string,
  options: NormalizeDatasetOptions,
): { amountEurMinor: number; rate: number; source: ExchangeRateSource } {
  const exactEquivalent = options.dynamicEurMinorByPostingId?.[postingId];
  const rateDate = assertIsoDate(
    transaction.parent?.date ?? transaction.date,
    `Posting ${postingId}, exchange-rate date`,
  );
  const key = dynamicRateKey(rateDate, account.currency);
  const historicalRate = options.dynamicRates?.[key];
  if (
    historicalRate !== undefined &&
    (!Number.isFinite(historicalRate) || historicalRate <= 0)
  ) {
    throw new Error(`Posting ${postingId}: invalid dynamic EUR exchange rate ${key}`);
  }

  if (exactEquivalent !== undefined) {
    assertMinorUnits(exactEquivalent, `Posting ${postingId}, dynamic EUR equivalent`);
    if (
      amountNativeMinor !== 0 &&
      exactEquivalent !== 0 &&
      Math.sign(exactEquivalent) !== Math.sign(amountNativeMinor)
    ) {
      throw new Error(`Posting ${postingId}: dynamic EUR equivalent has the wrong sign`);
    }
    const derivedRate =
      historicalRate ??
      (amountNativeMinor === 0 ? 1 : Math.abs(exactEquivalent / amountNativeMinor));
    if (!Number.isFinite(derivedRate) || derivedRate < 0) {
      throw new Error(`Posting ${postingId}: invalid dynamic EUR equivalent`);
    }
    return {
      amountEurMinor: exactEquivalent,
      rate: derivedRate,
      source: "dynamic-equivalent",
    };
  }

  if (historicalRate !== undefined) {
    let amountEurMinor: number;
    if (transaction.splitIndex === null) {
      amountEurMinor = convertMinorUnits(
        amountNativeMinor,
        historicalRate,
        `Posting ${postingId}, dynamic conversion`,
      );
    } else {
      const parentNativeMinor = toMinorUnits(
        transaction.parent.amount,
        `Posting ${postingId}, parent amount`,
      );
      if (parentNativeMinor === 0) {
        throw new Error(
          `Posting ${postingId}: cannot prorate a DYNAMIC split from a zero parent amount`,
        );
      }
      // My Expenses converts the parent equivalent first, then prorates each
      // child from that rounded equivalent.
      const parentEurMinor = convertMinorUnits(
        parentNativeMinor,
        historicalRate,
        `Posting ${postingId}, dynamic parent conversion`,
      );
      amountEurMinor = roundHalfAwayFromZero(
        (parentEurMinor / parentNativeMinor) * amountNativeMinor,
        `Posting ${postingId}, dynamic split proration`,
      );
    }
    return {
      amountEurMinor,
      rate: historicalRate,
      source: "dynamic-rate",
    };
  }

  throw new Error(
    `Posting ${postingId}: DYNAMIC ${account.currency}/EUR equivalent is unavailable; provide dynamicEurMinorByPostingId[${JSON.stringify(postingId)}] or dynamicRates[${JSON.stringify(key)}]`,
  );
}

function normalizePosting(
  account: ParsedAccount,
  entry: AccountRegistryEntry,
  mode: ExchangeRateMode | "IDENTITY",
  transaction: ParsedTransaction,
  categories: CategoriesRegistry,
  options: NormalizeDatasetOptions,
): NormalizedPosting {
  const id = postingIdFor(account.uuid, transaction.uuid);
  const context = `Posting ${id}`;
  const date = assertIsoDate(transaction.date, `${context}, date`);
  const amountNativeMinor = toMinorUnits(transaction.amount, `${context}, amount`);
  if (!VALID_STATUSES.has(transaction.sourceStatus)) {
    throw new Error(`${context}: invalid source status ${JSON.stringify(transaction.sourceStatus)}`);
  }
  if (transaction.uuid.length === 0 || transaction.sourceTransactionUuid.length === 0) {
    throw new Error(`${context}: invalid transaction provenance`);
  }
  if (transaction.splitIndex === null) {
    if (transaction.splitCount !== null || transaction.parent !== undefined) {
      throw new Error(`${context}: invalid direct-transaction provenance`);
    }
  } else if (
    !Number.isInteger(transaction.splitIndex) ||
    !Number.isInteger(transaction.splitCount) ||
    transaction.splitIndex < 0 ||
    transaction.splitCount <= transaction.splitIndex ||
    transaction.parent === undefined
  ) {
    throw new Error(`${context}: invalid split provenance`);
  }
  if (transaction.parent !== undefined) {
    assertIsoDate(transaction.parent.date, `${context}, parent date`);
    toMinorUnits(transaction.parent.amount, `${context}, parent amount`);
  }

  const { bucket, categoryType } = categoryDetails(
    transaction.category,
    categories,
    amountNativeMinor,
    context,
  );

  let amountEurMinor: number;
  let exchangeRateToEur: number;
  let exchangeRateSource: ExchangeRateSource;
  const linkedDynamicDirectPosting =
    mode === "DYNAMIC" &&
    transaction.splitIndex === null &&
    transaction.transferAccount !== undefined;
  if (mode === "IDENTITY") {
    amountEurMinor = amountNativeMinor;
    exchangeRateToEur = 1;
    exchangeRateSource = "identity";
  } else if (mode === "STATIC" || linkedDynamicDirectPosting) {
    if (entry.exchangeRateToEur === undefined) {
      throw new Error(
        `${context}: linked DYNAMIC posting requires account exchangeRateToEur`,
      );
    }
    exchangeRateToEur = entry.exchangeRateToEur;
    amountEurMinor = convertMinorUnits(
      amountNativeMinor,
      exchangeRateToEur,
      `${context}, static conversion`,
    );
    exchangeRateSource = "static";
  } else {
    const conversion = dynamicPostingConversion(
      amountNativeMinor,
      account,
      transaction,
      id,
      options,
    );
    amountEurMinor = conversion.amountEurMinor;
    exchangeRateToEur = conversion.rate;
    exchangeRateSource = conversion.source;
  }

  for (const [tagIndex, tag] of (transaction.tags ?? []).entries()) {
    if (typeof tag !== "string" || tag.length === 0) {
      throw new Error(`${context}: invalid tag at index ${tagIndex}`);
    }
  }
  if (
    transaction.transferAccount !== undefined &&
    transaction.transferAccount.length === 0
  ) {
    throw new Error(`${context}: invalid linked-account label`);
  }

  return {
    id,
    transactionId: transaction.uuid,
    sourceTransactionId: transaction.sourceTransactionUuid,
    accountId: account.uuid,
    accountLabel: account.label,
    accountType: entry.type,
    currency: account.currency,
    date,
    amountNativeMinor,
    amountEurMinor,
    exchangeRateToEur,
    exchangeRateSource,
    categoryPath: [...transaction.category],
    categoryType,
    bucket,
    status: transaction.sourceStatus,
    isVoid: transaction.sourceStatus === "VOID",
    linked: transaction.transferAccount !== undefined,
    ...(transaction.transferAccount === undefined
      ? {}
      : { transferAccount: transaction.transferAccount }),
    tags: [...(transaction.tags ?? [])],
    ...(transaction.comment === undefined ? {} : { comment: transaction.comment }),
    ...(transaction.payee === undefined ? {} : { payee: transaction.payee }),
    splitIndex: transaction.splitIndex,
    splitCount: transaction.splitCount,
    ...(transaction.parent === undefined
      ? {}
      : {
          parent: {
            ...transaction.parent,
            ...(transaction.parent.tags === undefined
              ? {}
              : { tags: [...transaction.parent.tags] }),
          },
        }),
    searchIndex: createSearchIndex(account, transaction, amountEurMinor),
  };
}

function openingBalanceInEur(
  account: ParsedAccount,
  entry: AccountRegistryEntry,
  mode: ExchangeRateMode | "IDENTITY",
  openingBalanceNativeMinor: number,
): number {
  if (mode === "IDENTITY") {
    return openingBalanceNativeMinor;
  }
  if (openingBalanceNativeMinor === 0) {
    return 0;
  }
  if (entry.exchangeRateToEur === undefined) {
    throw new Error(
      `Account ${account.uuid}: non-zero foreign opening balance requires account exchangeRateToEur`,
    );
  }
  return convertMinorUnits(
    openingBalanceNativeMinor,
    entry.exchangeRateToEur,
    `Account ${account.uuid}, opening balance`,
  );
}

function accountValuationInEur(
  account: ParsedAccount,
  entry: AccountRegistryEntry,
  mode: ExchangeRateMode | "IDENTITY",
  currentBalanceNativeMinor: number,
  options: NormalizeDatasetOptions,
): number {
  if (mode === "IDENTITY") {
    return currentBalanceNativeMinor;
  }
  if (mode === "STATIC") {
    return convertMinorUnits(
      currentBalanceNativeMinor,
      entry.exchangeRateToEur!,
      `Account ${account.uuid}, current valuation`,
    );
  }
  if (currentBalanceNativeMinor === 0) {
    return 0;
  }
  const exact = options.dynamicValuationEurMinorByAccountId?.[account.uuid];
  if (exact === undefined) {
    throw new Error(
      `Account ${account.uuid}: non-zero DYNAMIC final balance has no EUR valuation; provide dynamicValuationEurMinorByAccountId[${JSON.stringify(account.uuid)}]`,
    );
  }
  assertMinorUnits(exact, `Account ${account.uuid}, dynamic EUR valuation`);
  if (exact !== 0 && Math.sign(exact) !== Math.sign(currentBalanceNativeMinor)) {
    throw new Error(`Account ${account.uuid}: dynamic EUR valuation has the wrong sign`);
  }
  return exact;
}

/**
 * Converts the auditable export into browser-friendly postings. All arithmetic
 * after this boundary uses integer EUR cents. VOID postings are preserved here;
 * metric aggregators deliberately ignore them.
 */
export function normalizeDataset(
  source: AnalyticsSourceData,
  options: NormalizeDatasetOptions = {},
): AnalyticsDataset {
  if (source.accounts.version !== 2) {
    throw new Error("Unsupported accounts registry: expected version 2");
  }

  const normalizedAccounts: NormalizedAccount[] = [];
  const postings: NormalizedPosting[] = [];
  const accountIds = new Set<string>();
  const postingIds = new Set<string>();
  let minDate: IsoDate | null = null;
  let maxDate: IsoDate | null = null;

  for (const account of source.parsedData) {
    if (account.uuid.length === 0 || accountIds.has(account.uuid)) {
      throw new Error(`Invalid or duplicate account UUID ${JSON.stringify(account.uuid)}`);
    }
    accountIds.add(account.uuid);
    const currency = assertCurrency(
      account.currency,
      `Account "${account.label}" (${account.uuid})`,
    );
    const entry = validateRegistryEntry(source.accounts.accounts[account.uuid], account);
    const context = `Account "${account.label}" (${account.uuid})`;
    const mode = accountExchangeMode(currency, entry, context);
    const openingBalanceNativeMinor = toMinorUnits(
      account.openingBalance,
      `${context}, opening balance`,
    );
    const openingBalanceEurMinor = openingBalanceInEur(
      account,
      entry,
      mode,
      openingBalanceNativeMinor,
    );
    let historicalBalanceEurMinor = openingBalanceEurMinor;
    let currentBalanceNativeMinor = openingBalanceNativeMinor;
    let activePostingCount = 0;

    for (const transaction of account.transactions) {
      const posting = normalizePosting(
        account,
        entry,
        mode,
        transaction,
        source.categories,
        options,
      );
      if (postingIds.has(posting.id)) {
        throw new Error(`Duplicate posting id ${posting.id}`);
      }
      postingIds.add(posting.id);
      postings.push(posting);
      minDate = earliestDate(minDate, posting.date);
      maxDate = latestDate(maxDate, posting.date);
      if (!posting.isVoid) {
        activePostingCount += 1;
        currentBalanceNativeMinor = addMinor(
          currentBalanceNativeMinor,
          posting.amountNativeMinor,
          `${context}, native balance`,
        );
        historicalBalanceEurMinor = addMinor(
          historicalBalanceEurMinor,
          posting.amountEurMinor,
          `${context}, historical balance`,
        );
      }
    }

    const valuationBalanceEurMinor = accountValuationInEur(
      account,
      entry,
      mode,
      currentBalanceNativeMinor,
      options,
    );

    normalizedAccounts.push({
      id: account.uuid,
      label: account.label,
      currency,
      type: entry.type,
      exchangeRateMode: mode,
      openingBalanceNativeMinor,
      openingBalanceEurMinor,
      currentBalanceNativeMinor,
      historicalBalanceEurMinor,
      valuationBalanceEurMinor,
      postingCount: account.transactions.length,
      activePostingCount,
    });
  }

  return {
    currency: BASE_CURRENCY,
    source: {
      accounts: source.accounts,
      categories: source.categories,
    },
    accounts: normalizedAccounts,
    postings,
    minDate,
    maxDate,
  };
}
