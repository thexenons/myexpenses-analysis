import { assertIsoDate, normalizeSearchText } from "./validation.ts";
import { resolvePostingAccounts } from "./transfer-relations.ts";
import {
  isPostingIdentityKey,
  payeeIdentityKey,
  paymentMethodIdentityKey,
} from "./identity-keys.ts";
import type {
  AnalyticsScope,
  AnalyticsDataset,
  CategoryType,
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
const VALID_CATEGORY_TYPES = new Set<CategoryType>([
  "EXPENSE", "INCOME", "TRANSFER", "NEUTRAL",
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
    accountMode: "include",
    originAccountIds: [],
    destinationAccountIds: [],
    dateBasis: "operation",
    categoryMatch: "posting",
    categoryDepth: "subtree",
    categoryMode: "include",
    categoryPrefixes: [],
    statuses: [],
    tags: [],
    tagMode: "include",
    search: "",
    linked: "all",
    payeeKeys: [],
    paymentMethodKeys: [],
    categoryTypes: [],
    currencies: [],
    minAmountEurMinor: null,
    maxAmountEurMinor: null,
    commentSearch: "",
    referenceSearch: "",
  };
}

export type AmountRangeError = "invalidMinimum" | "invalidMaximum" | "reversed";

/** UI and domain share the same inclusive absolute-EUR-cent boundary rule. */
export function validateAmountRange(min: unknown, max: unknown): AmountRangeError | null {
  const validBound = (value: unknown) => value === undefined || value === null ||
    (Number.isSafeInteger(value) && (value as number) >= 0);
  if (!validBound(min)) return "invalidMinimum";
  if (!validBound(max)) return "invalidMaximum";
  if (typeof min === "number" && typeof max === "number" && min > max) return "reversed";
  return null;
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

function restoreIdentityList(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isPostingIdentityKey)) {
    throw new Error("Invalid posting identity selection");
  }
  return [...new Set(value)];
}

function restoreCategoryTypes(value: unknown): readonly CategoryType[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((candidate) => VALID_CATEGORY_TYPES.has(candidate))) {
    throw new Error("Invalid category type selection");
  }
  return [...new Set(value as CategoryType[])];
}

function restoreCurrencies(value: unknown): readonly Uppercase<string>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((candidate) =>
    typeof candidate === "string" && candidate.length > 0 && candidate === candidate.toUpperCase()
  )) {
    throw new Error("Invalid currency selection");
  }
  return [...new Set(value as Uppercase<string>[])];
}

function restoreAmount(value: unknown, context: string): number | null {
  if (value === undefined || value === null) return null;
  if (validateAmountRange(value, null) !== null) {
    throw new Error(`${context}: invalid amount in EUR cents`);
  }
  return value as number;
}

function restoreText(value: unknown, context: string): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new Error(`${context}: invalid search text`);
  return value.trim();
}

function restoreCategoryPath(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every(isNonEmptyString)
    ? [...value]
    : null;
}

function restoreCategoryPrefixes(value: unknown): readonly (readonly string[])[] {
  if (!Array.isArray(value)) return [];
  const result: string[][] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const path = restoreCategoryPath(candidate);
    if (path === null) continue;
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
  const minAmountEurMinor = restoreAmount(value.minAmountEurMinor, "Minimum");
  const maxAmountEurMinor = restoreAmount(value.maxAmountEurMinor, "Maximum");
  const amountError = validateAmountRange(minAmountEurMinor, maxAmountEurMinor);
  if (amountError !== null) throw new Error(`Invalid amount range: ${amountError}`);
  return {
    scope: isAnalyticsScope(value.scope) ? value.scope : "all",
    periodMode: isDatePeriodMode(value.periodMode)
      ? value.periodMode
      : "all",
    dateRange: { from, to },
    accountIds: restoreStringList(value.accountIds),
    accountMode: value.accountMode === "exclude" ? "exclude" : "include",
    originAccountIds: restoreStringList(value.originAccountIds),
    destinationAccountIds: restoreStringList(value.destinationAccountIds),
    dateBasis: value.dateBasis === "value" ? "value" : "operation",
    categoryMatch: value.categoryMatch === "either" ? "either" : "posting",
    categoryDepth: value.categoryDepth === "exact" ? "exact" : "subtree",
    categoryMode: value.categoryMode === "exclude" ? "exclude" : "include",
    categoryPrefixes:
      categoryPrefixes.length > 0
        ? categoryPrefixes
        : legacyCategoryPrefix !== null && legacyCategoryPrefix.length > 0
          ? [legacyCategoryPrefix]
          : [],
    statuses: Array.isArray(value.statuses)
      ? [...new Set(value.statuses.filter(isTransactionStatus))]
      : [],
    tags: restoreStringList(value.tags),
    tagMode: value.tagMode === "exclude" ? "exclude" : "include",
    search: typeof value.search === "string" ? value.search.trim() : "",
    linked: isLinkedFilter(value.linked) ? value.linked : "all",
    payeeKeys: restoreIdentityList(value.payeeKeys),
    paymentMethodKeys: restoreIdentityList(value.paymentMethodKeys),
    categoryTypes: restoreCategoryTypes(value.categoryTypes),
    currencies: restoreCurrencies(value.currencies),
    minAmountEurMinor,
    maxAmountEurMinor,
    commentSearch: restoreText(value.commentSearch, "Comment"),
    referenceSearch: restoreText(value.referenceSearch, "Reference"),
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
    if (!Array.isArray(path)) {
      throw new Error(`categoryPrefixes[${index}] must be a category path`);
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
  if (filters.accountMode !== undefined && filters.accountMode !== "include" && filters.accountMode !== "exclude") {
    throw new Error("Unknown account mode");
  }
  validateStringList(filters.originAccountIds ?? [], "originAccountIds");
  validateStringList(filters.destinationAccountIds ?? [], "destinationAccountIds");
  if (filters.dateBasis !== undefined && filters.dateBasis !== "operation" && filters.dateBasis !== "value") {
    throw new Error("Unknown date basis");
  }
  if (filters.categoryMatch !== undefined && filters.categoryMatch !== "posting" && filters.categoryMatch !== "either") {
    throw new Error("Unknown category matching mode");
  }
  if (filters.categoryMode !== undefined && filters.categoryMode !== "include" && filters.categoryMode !== "exclude") {
    throw new Error("Unknown category mode");
  }
  const categoryPrefixes = snapshotCategoryPrefixes(filters.categoryPrefixes);
  if (filters.categoryDepth !== undefined && filters.categoryDepth !== "subtree" && filters.categoryDepth !== "exact") {
    throw new Error("Unknown category depth");
  }
  validateStringList(filters.tags, "tags");
  if (filters.tagMode !== undefined && filters.tagMode !== "include" && filters.tagMode !== "exclude") {
    throw new Error("Unknown tag mode");
  }
  validateStringList(filters.payeeKeys ?? [], "payeeKeys");
  validateStringList(filters.paymentMethodKeys ?? [], "paymentMethodKeys");
  for (const key of [...(filters.payeeKeys ?? []), ...(filters.paymentMethodKeys ?? [])]) {
    if (!isPostingIdentityKey(key)) {
      throw new Error(`Invalid posting identity key ${JSON.stringify(key)}`);
    }
  }
  for (const categoryType of filters.categoryTypes ?? []) {
    if (!VALID_CATEGORY_TYPES.has(categoryType)) {
      throw new Error(`Unknown category type ${JSON.stringify(categoryType)}`);
    }
  }
  validateStringList(filters.currencies ?? [], "currencies");
  for (const currency of filters.currencies ?? []) {
    if (currency !== currency.toUpperCase()) {
      throw new Error(`Invalid currency ${JSON.stringify(currency)}`);
    }
  }
  const amountError = validateAmountRange(filters.minAmountEurMinor, filters.maxAmountEurMinor);
  if (amountError !== null) throw new Error(`Invalid amount range: ${amountError}`);
  if (filters.commentSearch !== undefined && typeof filters.commentSearch !== "string") {
    throw new Error("Invalid comment search");
  }
  if (filters.referenceSearch !== undefined && typeof filters.referenceSearch !== "string") {
    throw new Error("Invalid reference search");
  }
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
    accountMode: filters.accountMode ?? "include",
    originAccountIds: [...new Set(filters.originAccountIds ?? [])],
    destinationAccountIds: [...new Set(filters.destinationAccountIds ?? [])],
    dateBasis: filters.dateBasis ?? "operation",
    categoryMatch: filters.categoryMatch ?? "posting",
    categoryDepth: filters.categoryDepth ?? "subtree",
    categoryMode: filters.categoryMode ?? "include",
    categoryPrefixes,
    statuses: [...new Set(filters.statuses)],
    tags: [...new Set(filters.tags)],
    tagMode: filters.tagMode ?? "include",
    search: filters.search.trim(),
    linked: filters.linked,
    payeeKeys: [...new Set(filters.payeeKeys ?? [])],
    paymentMethodKeys: [...new Set(filters.paymentMethodKeys ?? [])],
    categoryTypes: [...new Set(filters.categoryTypes ?? [])],
    currencies: [...new Set(filters.currencies ?? [])],
    minAmountEurMinor: filters.minAmountEurMinor ?? null,
    maxAmountEurMinor: filters.maxAmountEurMinor ?? null,
    commentSearch: (filters.commentSearch ?? "").trim(),
    referenceSearch: (filters.referenceSearch ?? "").trim(),
  };
}

export function accountMatchesScope(
  account: NormalizedAccount,
  scope: AnalyticsScope,
): boolean {
  // Canonical postings retain every account for balances and transfer links.
  // Normalization includes all root accounts, regardless of native total flags.
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
  // An empty selected path means uncategorized, not every category subtree.
  if (prefix.length === 0) return categoryPath.length === 0;
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
  readonly payeeKeys: ReadonlySet<string>;
  readonly paymentMethodKeys: ReadonlySet<string>;
  readonly categoryTypes: ReadonlySet<CategoryType>;
  readonly currencies: ReadonlySet<string>;
  readonly commentTokens: readonly string[];
  readonly referenceTokens: readonly string[];
}

function searchTokens(value: string): readonly string[] {
  const normalized = normalizeSearchText(value);
  return normalized === "" ? [] : normalized.split(" ");
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
    payeeKeys: new Set(filters.payeeKeys ?? []),
    paymentMethodKeys: new Set(filters.paymentMethodKeys ?? []),
    categoryTypes: new Set(filters.categoryTypes ?? []),
    currencies: new Set(filters.currencies ?? []),
    commentTokens: searchTokens(filters.commentSearch ?? ""),
    referenceTokens: searchTokens(filters.referenceSearch ?? ""),
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
  if (matcher.payeeKeys.size > 0 && !matcher.payeeKeys.has(payeeIdentityKey(posting))) return false;
  if (matcher.paymentMethodKeys.size > 0 && !matcher.paymentMethodKeys.has(paymentMethodIdentityKey(posting))) return false;
  if (matcher.categoryTypes.size > 0 && !matcher.categoryTypes.has(posting.categoryType)) return false;
  if (matcher.currencies.size > 0 && !matcher.currencies.has(posting.currency)) return false;
  const magnitude = Math.abs(posting.amountEurMinor);
  if (filters.minAmountEurMinor != null && magnitude < filters.minAmountEurMinor) return false;
  if (filters.maxAmountEurMinor != null && magnitude > filters.maxAmountEurMinor) return false;
  if (matcher.commentTokens.length > 0) {
    const comment = normalizeSearchText([posting.comment ?? "", posting.parent?.comment ?? ""].join(" "));
    if (!matcher.commentTokens.every((token) => comment.includes(token))) return false;
  }
  if (matcher.referenceTokens.length > 0) {
    const reference = normalizeSearchText(posting.referenceNumber ?? "");
    if (!matcher.referenceTokens.every((token) => reference.includes(token))) return false;
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
  if (filters.categoryPrefixes.length > 0) {
    const categoryMatches = categoryMatchesPrefixes(posting.categoryPath, filters.categoryPrefixes, filters.categoryDepth) ||
      (filters.categoryMatch === "either" && relation?.peer !== undefined &&
        categoryMatchesPrefixes(relation.peer.categoryPath, filters.categoryPrefixes, filters.categoryDepth));
    if (filters.categoryMode === "exclude" ? categoryMatches : !categoryMatches) return false;
  }
  if (matcher.tags.size > 0) {
    const tagMatches = posting.tags.some((tag) => matcher.tags.has(tag));
    if (filters.tagMode === "exclude" ? tagMatches : !tagMatches) return false;
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
      (requestedAccountIds.size === 0 || (filters.accountMode === "exclude"
        ? !requestedAccountIds.has(account.id)
        : requestedAccountIds.has(account.id))),
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
