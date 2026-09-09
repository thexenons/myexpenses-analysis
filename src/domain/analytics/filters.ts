import { assertIsoDate, normalizeSearchText } from "./validation.ts";
import { resolvePostingAccounts } from "./transfer-relations.ts";
import type {
  AnalyticsScope,
  AnalyticsDataset,
  DatePeriodMode,
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
  "CLEARED",
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
const VALID_PERIOD_MODES = new Set<DatePeriodMode>([
  "all",
  "day",
  "week",
  "month",
  "year",
  "custom",
]);
const derivedSearchIndexes = new WeakMap<NormalizedPosting, string>();

export function createDefaultFilterState(): FilterState {
  return {
    scope: "all",
    periodMode: "all",
    dateRange: { from: null, to: null },
    accountIds: [],
    originAccountIds: [],
    destinationAccountIds: [],
    dateBasis: "operation",
    categoryMatch: "posting",
    categoryDepth: "subtree",
    categoryPrefixes: [],
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

function isDatePeriodMode(value: unknown): value is DatePeriodMode {
  return (
    isNonEmptyString(value) &&
    VALID_PERIOD_MODES.has(value as DatePeriodMode)
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

function restoreCategoryPath(value: unknown): readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
    ? [...value]
    : [];
}

function restoreCategoryPrefixes(value: unknown): readonly (readonly string[])[] {
  if (!Array.isArray(value)) return [];
  const result: string[][] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const path = restoreCategoryPath(candidate);
    if (path.length === 0) continue;
    const key = JSON.stringify(path);
    if (!seen.has(key)) {
      seen.add(key);
      result.push([...path]);
    }
  }
  return result;
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

  const categoryPrefixes = restoreCategoryPrefixes(value.categoryPrefixes);
  const legacyCategoryPrefix = restoreCategoryPath(value.categoryPrefix);
  return {
    scope: isAnalyticsScope(value.scope) ? value.scope : "all",
    periodMode: isDatePeriodMode(value.periodMode)
      ? value.periodMode
      : "all",
    dateRange: { from, to },
    accountIds: restoreStringList(value.accountIds),
    originAccountIds: restoreStringList(value.originAccountIds),
    destinationAccountIds: restoreStringList(value.destinationAccountIds),
    dateBasis: value.dateBasis === "value" ? "value" : "operation",
    categoryMatch: value.categoryMatch === "either" ? "either" : "posting",
    categoryDepth: value.categoryDepth === "exact" ? "exact" : "subtree",
    categoryPrefixes:
      categoryPrefixes.length > 0
        ? categoryPrefixes
        : legacyCategoryPrefix.length > 0
          ? [legacyCategoryPrefix]
          : [],
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

function snapshotCategoryPrefixes(
  values: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  const result: string[][] = [];
  const seen = new Set<string>();
  for (const [index, path] of values.entries()) {
    if (!Array.isArray(path) || path.length === 0) {
      throw new Error(`categoryPrefixes[${index}] must be a non-empty path`);
    }
    validateStringList(path, `categoryPrefixes[${index}]`);
    const key = JSON.stringify(path);
    if (!seen.has(key)) {
      seen.add(key);
      result.push([...path]);
    }
  }
  return result;
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
  if (!VALID_PERIOD_MODES.has(filters.periodMode)) {
    throw new Error(
      `Unknown date period mode ${JSON.stringify(filters.periodMode)}`,
    );
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
  validateStringList(filters.originAccountIds ?? [], "originAccountIds");
  validateStringList(filters.destinationAccountIds ?? [], "destinationAccountIds");
  if (filters.dateBasis !== undefined && filters.dateBasis !== "operation" && filters.dateBasis !== "value") {
    throw new Error("Unknown date basis");
  }
  if (filters.categoryMatch !== undefined && filters.categoryMatch !== "posting" && filters.categoryMatch !== "either") {
    throw new Error("Unknown category matching mode");
  }
  const categoryPrefixes = snapshotCategoryPrefixes(filters.categoryPrefixes);
  if (filters.categoryDepth !== undefined && filters.categoryDepth !== "subtree" && filters.categoryDepth !== "exact") {
    throw new Error("Unknown category depth");
  }
  validateStringList(filters.tags, "tags");
  for (const status of filters.statuses) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Unknown transaction status ${JSON.stringify(status)}`);
    }
  }

  return {
    scope: filters.scope,
    periodMode: filters.periodMode,
    dateRange: { from, to },
    accountIds: [...new Set(filters.accountIds)],
    originAccountIds: [...new Set(filters.originAccountIds ?? [])],
    destinationAccountIds: [...new Set(filters.destinationAccountIds ?? [])],
    dateBasis: filters.dateBasis ?? "operation",
    categoryMatch: filters.categoryMatch ?? "posting",
    categoryDepth: filters.categoryDepth ?? "subtree",
    categoryPrefixes,
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
  // The importer retains account metadata for references, but intentionally
  // omits movements of accounts outside MyExpenses' supported total scope.
  // Including only their opening balance would present a fictitious balance.
  if (account.includedInAll === false) return false;
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

export function categoryPathsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

export function toggleCategoryPath(
  selectedPaths: readonly (readonly string[])[],
  path: readonly string[],
): readonly (readonly string[])[] {
  const selected = selectedPaths.some((candidate) =>
    categoryPathsEqual(candidate, path),
  );
  return selected
    ? selectedPaths.filter((candidate) => !categoryPathsEqual(candidate, path))
    : [...selectedPaths.map((candidate) => [...candidate]), [...path]];
}

function categoryMatchesPrefixes(
  categoryPath: readonly string[],
  prefixes: readonly (readonly string[])[],
  depth: FilterState["categoryDepth"],
): boolean {
  return (
    prefixes.length === 0 ||
    prefixes.some((prefix) => depth === "exact"
      ? categoryPathsEqual(categoryPath, prefix)
      : categoryStartsWith(categoryPath, prefix))
  );
}

interface MatcherState {
  readonly accountIds: ReadonlySet<string>;
  readonly originIds: ReadonlySet<string>;
  readonly destinationIds: ReadonlySet<string>;
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
    originIds: new Set(filters.originAccountIds ?? []),
    destinationIds: new Set(filters.destinationAccountIds ?? []),
    searchTokens: search === "" ? [] : search.split(" "),
    statuses: new Set(filters.statuses),
    tags: new Set(filters.tags),
  };
}

function matchesPostingWithoutDate(
  posting: NormalizedPosting,
  filters: FilterState,
  matcher: MatcherState,
  dataset: AnalyticsDataset,
): boolean {
  if (!matcher.accountIds.has(posting.accountId)) {
    return false;
  }
  if (matcher.statuses.size > 0 && !matcher.statuses.has(posting.status)) {
    return false;
  }
  const relation = matcher.originIds.size > 0 || matcher.destinationIds.size > 0 || filters.categoryMatch === "either"
    ? resolvePostingAccounts(posting, dataset)
    : undefined;
  if (matcher.originIds.size > 0 && (relation?.originAccount === undefined || !matcher.originIds.has(relation.originAccount.id))) {
    return false;
  }
  if (matcher.destinationIds.size > 0 && (relation?.destinationAccount === undefined || !matcher.destinationIds.has(relation.destinationAccount.id))) {
    return false;
  }
  if (!categoryMatchesPrefixes(posting.categoryPath, filters.categoryPrefixes, filters.categoryDepth) &&
    !(filters.categoryMatch === "either" && relation?.peer !== undefined &&
      categoryMatchesPrefixes(relation.peer.categoryPath, filters.categoryPrefixes, filters.categoryDepth))) {
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
  if (matcher.searchTokens.length === 0) return true;
  const searchIndex = postingSearchIndex(posting);
  return matcher.searchTokens.every((token) => searchIndex.includes(token));
}

function postingSearchIndex(posting: NormalizedPosting): string {
  if (posting.searchIndex !== undefined) return posting.searchIndex;
  const cached = derivedSearchIndexes.get(posting);
  if (cached !== undefined) return cached;
  const result = normalizeSearchText(
    [
      posting.id,
      posting.transactionId,
      posting.sourceTransactionId,
      posting.accountLabel,
      posting.currency,
      posting.date,
      posting.localTime ?? "",
      String(posting.amountNativeMinor),
      String(posting.amountEurMinor),
      ...posting.categoryPath,
      ...posting.tags,
      posting.comment ?? "",
      posting.referenceNumber ?? "",
      posting.payee ?? "",
      posting.paymentMethod ?? "",
      posting.transferAccount ?? "",
      posting.backupStatus ?? posting.status,
      posting.parent?.comment ?? "",
      posting.parent?.payee ?? "",
      posting.parent?.paymentMethod ?? posting.parentPaymentMethod ?? "",
      ...(posting.parent?.tags ?? []),
      ...(posting.searchAliases ?? []),
    ].join(" "),
  );
  derivedSearchIndexes.set(posting, result);
  return result;
}

export function postingDate(posting: NormalizedPosting, filters: FilterState): IsoDate {
  return filters.dateBasis === "value" ? posting.valueDate ?? posting.date : posting.date;
}

function matchesDate(posting: NormalizedPosting, filters: FilterState): boolean {
  const { from, to } = filters.dateRange;
  const date = postingDate(posting, filters);
  return !(
    (from !== null && date < from) ||
    (to !== null && date > to)
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
  const activePostings: NormalizedPosting[] = [];
  const periodOpeningByAccount: Record<string, number> = Object.create(null);
  const periodClosingByAccount: Record<string, number> = Object.create(null);
  for (const account of accounts) {
    periodOpeningByAccount[account.id] = account.openingBalanceEurMinor;
    periodClosingByAccount[account.id] = account.openingBalanceEurMinor;
  }

  for (const posting of dataset.postings) {
    if (
      !posting.isVoid &&
      filters.dateRange.from !== null &&
      postingDate(posting, filters) < filters.dateRange.from
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
    if (!posting.isVoid && (filters.dateRange.to === null || postingDate(posting, filters) <= filters.dateRange.to)) {
      const current = periodClosingByAccount[posting.accountId];
      if (current !== undefined) {
        periodClosingByAccount[posting.accountId] = addMinor(current, posting.amountEurMinor, "Account closing balance");
      }
    }
    if (!matchesPostingWithoutDate(posting, filters, matcher, dataset)) {
      continue;
    }
    if (matchesDate(posting, filters)) {
      postings.push(posting);
      if (!posting.isVoid) activePostings.push(posting);
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

  let periodClosingBalanceEurMinor = 0;
  for (const amount of Object.values(periodClosingByAccount)) {
    periodClosingBalanceEurMinor = addMinor(periodClosingBalanceEurMinor, amount, "Closing balance");
  }

  return {
    source: dataset,
    filters,
    accounts,
    postings,
    activePostings,
    periodOpeningEurMinorByAccountId: periodOpeningByAccount,
    periodOpeningBalanceEurMinor,
    periodClosingEurMinorByAccountId: periodClosingByAccount,
    periodClosingBalanceEurMinor,
  };
}

export function metricPostings(
  filtered: FilteredAnalyticsDataset,
): readonly NormalizedPosting[] {
  return filtered.activePostings;
}
