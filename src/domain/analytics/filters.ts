import { assertIsoDate, normalizeSearchText } from "./normalize.ts";
import type {
  AnalyticsScope,
  AnalyticsDataset,
  FilteredAnalyticsDataset,
  FilterState,
  IsoDate,
  LinkedFilter,
  NormalizedAccount,
  NormalizedPosting,
  TransactionStatus,
} from "./types.ts";

const VALID_STATUSES = new Set<TransactionStatus>([
  "UNRECONCILED",
  "RECONCILED",
  "VOID",
]);

const VALID_SCOPES = new Set<AnalyticsScope>([
  "all",
  "realCashFlow",
  "debtsOnly",
]);

const VALID_LINKED_FILTERS = new Set<LinkedFilter>([
  "all",
  "linked",
  "unlinked",
]);

export function createDefaultFilterState(): FilterState {
  return {
    scope: "all",
    dateRange: { from: null, to: null },
    accountIds: [],
    categoryPrefix: [],
    statuses: [],
    tags: [],
    search: "",
    linked: "all",
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isAnalyticsScope(value: unknown): value is AnalyticsScope {
  return isNonEmptyString(value) && VALID_SCOPES.has(value as AnalyticsScope);
}

function isLinkedFilter(value: unknown): value is LinkedFilter {
  return (
    isNonEmptyString(value) &&
    VALID_LINKED_FILTERS.has(value as LinkedFilter)
  );
}

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return (
    isNonEmptyString(value) && VALID_STATUSES.has(value as TransactionStatus)
  );
}

function restoreStringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(isNonEmptyString))]
    : [];
}

function restoreIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return assertIsoDate(value, "Persisted filter date");
  } catch {
    return null;
  }
}

/**
 * Restores the serializable filter subset from untrusted browser storage.
 * Unknown or malformed fields fall back independently to their safe defaults.
 */
export function restoreFilterState(value: unknown): FilterState {
  if (!isObject(value)) {
    return createDefaultFilterState();
  }

  const dateRange = isObject(value.dateRange) ? value.dateRange : {};
  let from = restoreIsoDate(dateRange.from);
  let to = restoreIsoDate(dateRange.to);
  if (from !== null && to !== null && from > to) {
    from = null;
    to = null;
  }

  return {
    scope: isAnalyticsScope(value.scope) ? value.scope : "all",
    dateRange: { from, to },
    accountIds: restoreStringList(value.accountIds),
    categoryPrefix: restoreStringList(value.categoryPrefix),
    statuses: Array.isArray(value.statuses)
      ? [...new Set(value.statuses.filter(isTransactionStatus))]
      : [],
    tags: restoreStringList(value.tags),
    search: typeof value.search === "string" ? value.search.trim() : "",
    linked: isLinkedFilter(value.linked) ? value.linked : "all",
  };
}

function validateStringList(values: readonly string[], context: string): void {
  for (const [index, value] of values.entries()) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${context}[${index}] must be a non-empty string`);
    }
  }
}

function snapshotFilters(filters: FilterState): FilterState {
  if (
    filters.scope !== "all" &&
    filters.scope !== "realCashFlow" &&
    filters.scope !== "debtsOnly"
  ) {
    throw new Error(`Unknown analytics scope ${JSON.stringify(filters.scope)}`);
  }
  if (
    filters.linked !== "all" &&
    filters.linked !== "linked" &&
    filters.linked !== "unlinked"
  ) {
    throw new Error(`Unknown linked filter ${JSON.stringify(filters.linked)}`);
  }
  const from =
    filters.dateRange.from === null
      ? null
      : assertIsoDate(filters.dateRange.from, "Filter start date");
  const to =
    filters.dateRange.to === null
      ? null
      : assertIsoDate(filters.dateRange.to, "Filter end date");
  if (from !== null && to !== null && from > to) {
    throw new Error(`Filter start date ${from} is after end date ${to}`);
  }

  validateStringList(filters.accountIds, "accountIds");
  validateStringList(filters.categoryPrefix, "categoryPrefix");
  validateStringList(filters.tags, "tags");
  for (const status of filters.statuses) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Unknown transaction status ${JSON.stringify(status)}`);
    }
  }

  return {
    scope: filters.scope,
    dateRange: { from, to },
    accountIds: [...new Set(filters.accountIds)],
    categoryPrefix: [...filters.categoryPrefix],
    statuses: [...new Set(filters.statuses)],
    tags: [...new Set(filters.tags)],
    search: filters.search.trim(),
    linked: filters.linked,
  };
}

export function accountMatchesScope(
  account: NormalizedAccount,
  scope: AnalyticsScope,
): boolean {
  if (scope === "realCashFlow") {
    return account.type === "DEFAULT";
  }
  if (scope === "debtsOnly") {
    return account.type === "DEBT";
  }
  return true;
}

function categoryStartsWith(
  categoryPath: readonly string[],
  prefix: readonly string[],
): boolean {
  if (prefix.length > categoryPath.length) {
    return false;
  }
  return prefix.every((name, index) => categoryPath[index] === name);
}

interface MatcherState {
  readonly accountIds: ReadonlySet<string>;
  readonly searchTokens: readonly string[];
  readonly statuses: ReadonlySet<TransactionStatus>;
  readonly tags: ReadonlySet<string>;
}

function createMatcherState(
  accounts: readonly NormalizedAccount[],
  filters: FilterState,
): MatcherState {
  const search = normalizeSearchText(filters.search);
  return {
    accountIds: new Set(accounts.map((account) => account.id)),
    searchTokens: search === "" ? [] : search.split(" "),
    statuses: new Set(filters.statuses),
    tags: new Set(filters.tags),
  };
}

function matchesPostingWithoutDate(
  posting: NormalizedPosting,
  filters: FilterState,
  matcher: MatcherState,
): boolean {
  if (!matcher.accountIds.has(posting.accountId)) {
    return false;
  }
  if (matcher.statuses.size > 0 && !matcher.statuses.has(posting.status)) {
    return false;
  }
  if (!categoryStartsWith(posting.categoryPath, filters.categoryPrefix)) {
    return false;
  }
  if (
    matcher.tags.size > 0 &&
    !posting.tags.some((tag) => matcher.tags.has(tag))
  ) {
    return false;
  }
  if (filters.linked === "linked" && !posting.linked) {
    return false;
  }
  if (filters.linked === "unlinked" && posting.linked) {
    return false;
  }
  return matcher.searchTokens.every((token) => posting.searchIndex.includes(token));
}

function matchesDate(posting: NormalizedPosting, filters: FilterState): boolean {
  const { from, to } = filters.dateRange;
  return !(
    (from !== null && posting.date < from) ||
    (to !== null && posting.date > to)
  );
}

function addMinor(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${context}: amount exceeds the safe integer range`);
  }
  return result;
}

/**
 * Applies every global filter in one pass. VOID postings remain in `postings`
 * so tables can audit them; all metric functions ignore them independently.
 */
export function applyFilters(
  dataset: AnalyticsDataset,
  rawFilters: FilterState,
): FilteredAnalyticsDataset {
  const filters = snapshotFilters(rawFilters);
  const requestedAccountIds = new Set(filters.accountIds);
  const accounts = dataset.accounts.filter(
    (account) =>
      accountMatchesScope(account, filters.scope) &&
      (requestedAccountIds.size === 0 || requestedAccountIds.has(account.id)),
  );
  const matcher = createMatcherState(accounts, filters);
  const postings: NormalizedPosting[] = [];
  const periodOpeningByAccount: Record<string, number> = Object.create(null);
  for (const account of accounts) {
    periodOpeningByAccount[account.id] = account.openingBalanceEurMinor;
  }

  for (const posting of dataset.postings) {
    if (
      !posting.isVoid &&
      filters.dateRange.from !== null &&
      posting.date < filters.dateRange.from
    ) {
      const current = periodOpeningByAccount[posting.accountId];
      if (current !== undefined) {
        periodOpeningByAccount[posting.accountId] = addMinor(
          current,
          posting.amountEurMinor,
          `Account ${posting.accountId}, period opening balance`,
        );
      }
    }
    if (!matchesPostingWithoutDate(posting, filters, matcher)) {
      continue;
    }
    if (matchesDate(posting, filters)) {
      postings.push(posting);
    }
  }

  let periodOpeningBalanceEurMinor = 0;
  for (const amount of Object.values(periodOpeningByAccount)) {
    periodOpeningBalanceEurMinor = addMinor(
      periodOpeningBalanceEurMinor,
      amount,
      "Filtered period opening balance",
    );
  }

  return {
    source: dataset,
    filters,
    accounts,
    postings,
    periodOpeningEurMinorByAccountId: periodOpeningByAccount,
    periodOpeningBalanceEurMinor,
  };
}

export function metricPostings(
  filtered: FilteredAnalyticsDataset,
): readonly NormalizedPosting[] {
  return filtered.postings.filter((posting) => !posting.isVoid);
}
