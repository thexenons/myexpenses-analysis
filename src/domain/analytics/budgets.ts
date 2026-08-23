import type {
  BackupBudgetAllocationV1,
  BackupBudgetFilterV1,
  BackupBudgetGrouping,
  BackupBudgetV1,
  BackupCategoryType,
  BackupCategoryV1,
  BackupDatasetPreferencesV1,
} from "./backup-dataset.types.ts";
import type {
  AnalyticsDataset,
  FilteredAnalyticsDataset,
  IsoDate,
  NormalizedPosting,
} from "./types.ts";
import { monthPeriodForLabel } from "./periods.ts";

export type BudgetHealth = "on-track" | "watch" | "exceeded" | "unallocated";
export type BudgetAllocationSource = "EXACT" | "FALLBACK" | "NONE";

export interface BudgetPeriod {
  readonly key: string;
  readonly grouping: BackupBudgetGrouping;
  readonly year: number | null;
  readonly second: number | null;
  readonly startDate: IsoDate;
  readonly endDate: IsoDate;
  readonly label: string;
}

export type BudgetPeriodsResult =
  | { readonly status: "ready"; readonly periods: readonly BudgetPeriod[] }
  | { readonly status: "unsupported"; readonly reason: string };

export interface ResolvedBudgetAllocation {
  readonly baseMinor: number;
  readonly rolloverPreviousMinor: number;
  readonly rolloverNextMinor: number;
  readonly totalMinor: number;
  readonly oneTime: boolean;
  readonly source: BudgetAllocationSource;
  readonly sourceYear: number | null;
  readonly sourceSecond: number | null;
}

export interface BudgetTotals {
  readonly baseMinor: number;
  readonly rolloverPreviousMinor: number;
  readonly rolloverNextMinor: number;
  readonly assignedMinor: number;
  readonly consumedMinor: number;
  readonly availableMinor: number;
  readonly utilization: number | null;
  readonly health: BudgetHealth;
}

export interface BudgetAllocationNode extends BudgetTotals {
  readonly id: string;
  readonly categoryUuid: string;
  readonly name: string;
  readonly path: readonly string[];
  readonly categoryType: BackupCategoryType;
  readonly depth: number;
  readonly hasDirectAllocation: boolean;
  readonly allocationSource: BudgetAllocationSource | "ROLLUP";
  readonly oneTime: boolean;
  readonly childAssignedMinor: number;
  readonly directConsumedMinor: number;
  readonly postingCount: number;
  readonly children: readonly BudgetAllocationNode[];
}

export interface BudgetAnalysis {
  readonly budget: BackupBudgetV1;
  readonly period: BudgetPeriod;
  readonly periods: readonly BudgetPeriod[];
  readonly currency: string;
  readonly fractionDigits: number;
  readonly global: BudgetTotals;
  readonly allocations: readonly BudgetAllocationNode[];
  readonly categoryAssignedMinor: number;
  readonly categorizedConsumedMinor: number;
  readonly unallocatedConsumedMinor: number;
  readonly filteredPostingCount: number;
  readonly ownFilterApplied: boolean;
  readonly aggregateNeutral: boolean;
  readonly filterSummary: BudgetFilterSummary | null;
}

export interface BudgetFilterSummary {
  readonly rootOperator: "AND" | "OR" | "NOT" | "ACCOUNT" | "CATEGORY";
  readonly accountCount: number;
  readonly categoryCount: number;
}

export type BudgetAnalysisResult =
  | { readonly status: "ready"; readonly analysis: BudgetAnalysis }
  | { readonly status: "unsupported"; readonly reason: string };

interface MutableAllocationNode {
  category: BackupCategoryV1;
  directAllocation?: ResolvedBudgetAllocation;
  children: Map<string, MutableAllocationNode>;
}

interface BudgetScope {
  readonly accountUuid: string | null;
  readonly currency: string;
  readonly fractionDigits: number;
  readonly homeCurrency: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const periodDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const periodMonthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function unsupported(reason: string): BudgetAnalysisResult {
  return { status: "unsupported", reason };
}

function addMinor(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${context}: minor-unit sum exceeds the safe integer range`);
  }
  return result === 0 ? 0 : result;
}

function sumMinor(
  values: Iterable<number>,
  context: string,
): number {
  let result = 0;
  for (const value of values) {
    result = addMinor(result, value, context);
  }
  return result;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

function isoFromDate(date: Date): IsoDate {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDate;
}

function dateFromIso(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = utcDate(year, month - 1, day);
  return isoFromDate(date) === value ? date : null;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateRange(startDate: IsoDate, endDate: IsoDate): string {
  const start = dateFromIso(startDate)!;
  const end = dateFromIso(endDate)!;
  return `${periodDateFormatter.format(start)} – ${periodDateFormatter.format(end)}`;
}

function periodKey(
  grouping: BackupBudgetGrouping,
  year: number | null,
  second: number | null,
): string {
  return `${grouping}:${year ?? "all"}:${second ?? "all"}`;
}

function monthPeriod(
  year: number,
  second: number,
  monthStart: number,
): BudgetPeriod | null {
  if (second < 0 || second > 11) return null;
  const month = utcDate(year, second, 1);
  const { startDate, endDate } = monthPeriodForLabel(
    year,
    second,
    monthStart,
  );
  return {
    key: periodKey("MONTH", year, second),
    grouping: "MONTH",
    year,
    second,
    startDate,
    endDate,
    label:
      monthStart === 1
        ? periodMonthFormatter.format(month).replace(/^./, (value) => value.toUpperCase())
        : formatDateRange(startDate, endDate),
  };
}

function dayPeriod(year: number, second: number): BudgetPeriod | null {
  if (second < 1 || second > 366) return null;
  const date = addDays(utcDate(year, 0, 1), second - 1);
  if (date.getUTCFullYear() !== year) return null;
  const localDate = isoFromDate(date);
  return {
    key: periodKey("DAY", year, second),
    grouping: "DAY",
    year,
    second,
    startDate: localDate,
    endDate: localDate,
    label: periodDateFormatter.format(date),
  };
}

function weekPeriod(
  year: number,
  second: number,
  weekStart: number,
): BudgetPeriod | null {
  if (second < 1 || second > 53) return null;
  const firstDay = utcDate(year, 0, 1);
  const firstDayIso = firstDay.getUTCDay() === 0 ? 7 : firstDay.getUTCDay();
  const firstStart = addDays(firstDay, (weekStart - firstDayIso + 7) % 7);
  const start = addDays(firstStart, (second - 1) * 7);
  if (start.getUTCFullYear() !== year) return null;
  const end = addDays(start, 6);
  const startDate = isoFromDate(start);
  const endDate = isoFromDate(end);
  return {
    key: periodKey("WEEK", year, second),
    grouping: "WEEK",
    year,
    second,
    startDate,
    endDate,
    label: `Semana ${second} · ${formatDateRange(startDate, endDate)}`,
  };
}

function yearPeriod(year: number): BudgetPeriod | null {
  if (!Number.isInteger(year) || year < 1) return null;
  return {
    key: periodKey("YEAR", year, 0),
    grouping: "YEAR",
    year,
    second: 0,
    startDate: `${String(year).padStart(4, "0")}-01-01` as IsoDate,
    endDate: `${String(year).padStart(4, "0")}-12-31` as IsoDate,
    label: String(year),
  };
}

function nonePeriod(budget: BackupBudgetV1): BudgetPeriod | null {
  if (budget.startDate === null || budget.endDate === null) return null;
  if (
    dateFromIso(budget.startDate) === null ||
    dateFromIso(budget.endDate) === null ||
    budget.startDate > budget.endDate
  ) {
    return null;
  }
  return {
    key: periodKey("NONE", null, null),
    grouping: "NONE",
    year: null,
    second: null,
    startDate: budget.startDate as IsoDate,
    endDate: budget.endDate as IsoDate,
    label: formatDateRange(budget.startDate as IsoDate, budget.endDate as IsoDate),
  };
}

function periodFromParts(
  grouping: BackupBudgetGrouping,
  year: number,
  second: number,
  preferences: BackupDatasetPreferencesV1,
): BudgetPeriod | null {
  switch (grouping) {
    case "DAY":
      return dayPeriod(year, second);
    case "WEEK":
      return weekPeriod(year, second, preferences.weekStart);
    case "MONTH":
      return monthPeriod(year, second, preferences.monthStart);
    case "YEAR":
      return yearPeriod(year);
    case "NONE":
      return null;
  }
}

export function resolveBudgetPeriods(
  budget: BackupBudgetV1,
  preferences: BackupDatasetPreferencesV1,
): BudgetPeriodsResult {
  if (budget.grouping === "NONE") {
    const period = nonePeriod(budget);
    return period === null
      ? {
          status: "unsupported",
          reason: "El presupuesto sin agrupación no tiene un intervalo de fechas seguro.",
        }
      : { status: "ready", periods: [period] };
  }

  const parts = new Map<string, { year: number; second: number }>();
  for (const allocation of budget.allocations) {
    if (allocation.year === null) continue;
    const second =
      budget.grouping === "YEAR" ? (allocation.period ?? 0) : allocation.period;
    if (second === null) {
      return {
        status: "unsupported",
        reason: `Una asignación ${budget.grouping} no declara su periodo secundario.`,
      };
    }
    parts.set(`${allocation.year}:${second}`, {
      year: allocation.year,
      second,
    });
  }
  if (parts.size === 0) {
    return {
      status: "unsupported",
      reason: "No hay periodos configurados que puedan representarse sin inferencias.",
    };
  }

  const periods: BudgetPeriod[] = [];
  for (const { year, second } of parts.values()) {
    const period = periodFromParts(
      budget.grouping,
      year,
      second,
      preferences,
    );
    if (period === null) {
      return {
        status: "unsupported",
        reason: `El periodo ${year}/${second} no es válido para ${budget.grouping}.`,
      };
    }
    periods.push(period);
  }
  periods.sort((left, right) => right.startDate.localeCompare(left.startDate));
  return { status: "ready", periods };
}

function normalizedAllocationSecond(
  allocation: BackupBudgetAllocationV1,
): number {
  return allocation.period ?? 0;
}

function isExactAllocation(
  allocation: BackupBudgetAllocationV1,
  period: BudgetPeriod,
): boolean {
  if (period.grouping === "NONE") {
    return allocation.year === null && allocation.period === null;
  }
  return (
    allocation.year === period.year &&
    normalizedAllocationSecond(allocation) === period.second
  );
}

function isPriorAllocation(
  allocation: BackupBudgetAllocationV1,
  period: BudgetPeriod,
): boolean {
  if (period.year === null || period.second === null || allocation.oneTime) {
    return false;
  }
  const year = allocation.year ?? 0;
  const second = normalizedAllocationSecond(allocation);
  return year < period.year || (year === period.year && second < period.second);
}

/** Mirrors r871's exact-period lookup followed by the latest non-one-time fallback. */
export function resolveBudgetAllocation(
  allocations: readonly BackupBudgetAllocationV1[],
  period: BudgetPeriod,
): ResolvedBudgetAllocation {
  const exact = allocations.find((allocation) =>
    isExactAllocation(allocation, period),
  );
  const fallback = allocations
    .filter((allocation) => isPriorAllocation(allocation, period))
    .toSorted(
      (left, right) =>
        (right.year ?? 0) - (left.year ?? 0) ||
        normalizedAllocationSecond(right) - normalizedAllocationSecond(left),
    )[0];
  const baseSource =
    exact?.amountMinor !== null && exact?.amountMinor !== undefined
      ? exact
      : fallback;
  const baseMinor = baseSource?.amountMinor ?? 0;
  const rolloverPreviousMinor = exact?.rolloverPreviousMinor ?? 0;
  const rolloverNextMinor = exact?.rolloverNextMinor ?? 0;
  return {
    baseMinor,
    rolloverPreviousMinor,
    rolloverNextMinor,
    totalMinor: addMinor(
      baseMinor,
      rolloverPreviousMinor,
      "Budget allocation",
    ),
    oneTime: baseSource?.oneTime ?? false,
    source:
      baseSource === exact
        ? "EXACT"
        : baseSource === fallback
          ? "FALLBACK"
          : "NONE",
    sourceYear: baseSource?.year ?? null,
    sourceSecond: baseSource?.period ?? null,
  };
}

function healthFor(assignedMinor: number, consumedMinor: number): BudgetHealth {
  // Presentation policy of this web app; MyExpenses does not define this 75% threshold.
  if (assignedMinor <= 0) return "unallocated";
  const utilization = consumedMinor / assignedMinor;
  if (utilization > 1) return "exceeded";
  if (utilization >= 0.75) return "watch";
  return "on-track";
}

function totals(
  baseMinor: number,
  rolloverPreviousMinor: number,
  rolloverNextMinor: number,
  consumedMinor: number,
): BudgetTotals {
  const assignedMinor = addMinor(
    baseMinor,
    rolloverPreviousMinor,
    "Budget total allocation",
  );
  return {
    baseMinor,
    rolloverPreviousMinor,
    rolloverNextMinor,
    assignedMinor,
    consumedMinor,
    availableMinor: addMinor(
      assignedMinor,
      -consumedMinor,
      "Budget available amount",
    ),
    utilization: assignedMinor > 0 ? consumedMinor / assignedMinor : null,
    health: healthFor(assignedMinor, consumedMinor),
  };
}

function resolveBudgetScope(
  analytics: AnalyticsDataset,
  budget: BackupBudgetV1,
): BudgetScope | string {
  const backup = analytics.backup;
  if (backup === undefined) return "El dataset no conserva el modelo de backup.";
  const account =
    budget.accountUuid === null
      ? undefined
      : backup.accounts.find((candidate) => candidate.uuid === budget.accountUuid);
  if (budget.accountUuid !== null && account === undefined) {
    return "El presupuesto referencia una cuenta que no existe.";
  }
  if (
    account !== undefined &&
    budget.currency !== null &&
    budget.currency !== account.currency
  ) {
    return "La moneda del presupuesto no coincide con la de su cuenta.";
  }
  const currency = budget.currency ?? account?.currency ?? backup.preferences.homeCurrency;
  const currencyInfo = backup.currencies.find((candidate) => candidate.code === currency);
  if (currencyInfo === undefined) {
    return `No hay metadatos para la moneda ${currency}.`;
  }
  return {
    accountUuid: budget.accountUuid,
    currency,
    fractionDigits: currencyInfo.fractionDigits,
    homeCurrency: backup.preferences.homeCurrency,
  };
}

function postingInBudgetScope(
  posting: NormalizedPosting,
  scope: BudgetScope,
): boolean {
  if (scope.accountUuid !== null) return posting.accountId === scope.accountUuid;
  if (scope.currency !== scope.homeCurrency) return posting.currency === scope.currency;
  return true;
}

function postingAmountForBudget(
  posting: NormalizedPosting,
  scope: BudgetScope,
): number {
  return scope.currency === scope.homeCurrency
    ? posting.amountEurMinor
    : posting.amountNativeMinor;
}

function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

function pathsStartWith(
  path: readonly string[],
  prefix: readonly string[],
): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, index) => segment === path[index])
  );
}

function scopedExpensePostings(
  filtered: FilteredAnalyticsDataset,
  period: BudgetPeriod,
  scope: BudgetScope,
  budget: BackupBudgetV1,
  categoryByUuid: ReadonlyMap<string, BackupCategoryV1>,
): readonly NormalizedPosting[] {
  return filtered.postings.filter(
    (posting) =>
      !posting.isVoid &&
      (posting.bucket === "expense" ||
        (budget.aggregateNeutral && posting.categoryType === "NEUTRAL")) &&
      posting.date >= period.startDate &&
      posting.date <= period.endDate &&
      postingInBudgetScope(posting, scope) &&
      matchesBudgetFilter(budget.filter, posting, categoryByUuid),
  );
}

function matchesBudgetFilter(
  filter: BackupBudgetFilterV1 | null,
  posting: NormalizedPosting,
  categoryByUuid: ReadonlyMap<string, BackupCategoryV1>,
): boolean {
  if (filter === null) return true;
  switch (filter.type) {
    case "and":
      return filter.criteria.every((criterion) =>
        matchesBudgetFilter(criterion, posting, categoryByUuid),
      );
    case "or":
      return filter.criteria.some((criterion) =>
        matchesBudgetFilter(criterion, posting, categoryByUuid),
      );
    case "not":
      return !matchesBudgetFilter(filter.criterion, posting, categoryByUuid);
    case "account":
      return filter.accountUuids.includes(posting.accountId);
    case "category":
      return filter.categoryUuids.some((uuid) => {
        const category = categoryByUuid.get(uuid);
        return (
          category !== undefined &&
          pathsStartWith(posting.categoryPath, category.path)
        );
      });
  }
}

function summarizeBudgetFilter(
  filter: BackupBudgetFilterV1 | null,
): BudgetFilterSummary | null {
  if (filter === null) return null;
  const accounts = new Set<string>();
  const categories = new Set<string>();
  const collect = (criterion: BackupBudgetFilterV1): void => {
    if (criterion.type === "and" || criterion.type === "or") {
      criterion.criteria.forEach(collect);
    } else if (criterion.type === "not") {
      collect(criterion.criterion);
    } else if (criterion.type === "account") {
      criterion.accountUuids.forEach((uuid) => accounts.add(uuid));
    } else if (criterion.type === "category") {
      criterion.categoryUuids.forEach((uuid) => categories.add(uuid));
    }
  };
  collect(filter);
  return {
    rootOperator:
      filter.type === "and"
        ? "AND"
        : filter.type === "or"
          ? "OR"
          : filter.type === "not"
            ? "NOT"
            : filter.type === "account"
              ? "ACCOUNT"
              : "CATEGORY",
    accountCount: accounts.size,
    categoryCount: categories.size,
  };
}

function isSupportedAllocationType(type: BackupCategoryType): boolean {
  return type === "EXPENSE" || type === "NEUTRAL";
}

function ensureAllocationNode(
  category: BackupCategoryV1,
  categoryByPath: ReadonlyMap<string, BackupCategoryV1>,
  roots: Map<string, MutableAllocationNode>,
): MutableAllocationNode {
  let level = roots;
  let current: MutableAllocationNode | undefined;
  const path: string[] = [];
  for (const segment of category.path) {
    path.push(segment);
    const ancestor = categoryByPath.get(pathKey(path));
    if (ancestor === undefined) {
      throw new Error(`Missing category metadata for ${path.join(" > ")}`);
    }
    current = level.get(ancestor.uuid);
    if (current === undefined) {
      current = { category: ancestor, children: new Map() };
      level.set(ancestor.uuid, current);
    }
    level = current.children;
  }
  return current!;
}

function postingSpend(posting: NormalizedPosting, scope: BudgetScope): number {
  return -postingAmountForBudget(posting, scope);
}

function spentForPath(
  postings: readonly NormalizedPosting[],
  path: readonly string[],
  scope: BudgetScope,
  exact: boolean,
): { consumedMinor: number; postingCount: number } {
  let consumedMinor = 0;
  let postingCount = 0;
  for (const posting of postings) {
    const matches = exact
      ? pathKey(posting.categoryPath) === pathKey(path)
      : pathsStartWith(posting.categoryPath, path);
    if (!matches) continue;
    consumedMinor = addMinor(
      consumedMinor,
      postingSpend(posting, scope),
      `Budget category ${path.join(" > ")}`,
    );
    postingCount += 1;
  }
  return { consumedMinor, postingCount };
}

function finalizeAllocationNode(
  mutable: MutableAllocationNode,
  postings: readonly NormalizedPosting[],
  scope: BudgetScope,
  depth: number,
): BudgetAllocationNode {
  const children = [...mutable.children.values()]
    .map((child) => finalizeAllocationNode(child, postings, scope, depth + 1))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  const childAssignedMinor = sumMinor(
    children.map((child) => child.assignedMinor),
    `Child allocations for ${mutable.category.uuid}`,
  );
  const direct = mutable.directAllocation;
  const baseMinor = direct?.baseMinor ?? childAssignedMinor;
  const rolloverPreviousMinor =
    direct?.rolloverPreviousMinor ??
    sumMinor(
      children.map((child) => child.rolloverPreviousMinor),
      `Child rollovers for ${mutable.category.uuid}`,
    );
  const rolloverNextMinor =
    direct?.rolloverNextMinor ??
    sumMinor(
      children.map((child) => child.rolloverNextMinor),
      `Next child rollovers for ${mutable.category.uuid}`,
    );
  const consumed = spentForPath(
    postings,
    mutable.category.path,
    scope,
    false,
  );
  const directConsumed = spentForPath(
    postings,
    mutable.category.path,
    scope,
    true,
  );
  return {
    id: mutable.category.uuid,
    categoryUuid: mutable.category.uuid,
    name: mutable.category.name,
    path: mutable.category.path,
    categoryType: mutable.category.type,
    depth,
    hasDirectAllocation: direct !== undefined,
    allocationSource: direct?.source ?? "ROLLUP",
    oneTime: direct?.oneTime ?? false,
    childAssignedMinor,
    directConsumedMinor: directConsumed.consumedMinor,
    postingCount: consumed.postingCount,
    children,
    ...totals(
      baseMinor,
      rolloverPreviousMinor,
      rolloverNextMinor,
      consumed.consumedMinor,
    ),
  };
}

export function flattenBudgetAllocationNodes(
  nodes: readonly BudgetAllocationNode[],
): readonly BudgetAllocationNode[] {
  const result: BudgetAllocationNode[] = [];
  const append = (items: readonly BudgetAllocationNode[]) => {
    for (const item of items) {
      result.push(item);
      append(item.children);
    }
  };
  append(nodes);
  return result;
}

export function analyzeBudgetPeriod(
  analytics: AnalyticsDataset,
  filtered: FilteredAnalyticsDataset,
  budget: BackupBudgetV1,
  selectedPeriodKey?: string,
): BudgetAnalysisResult {
  const backup = analytics.backup;
  if (backup === undefined) return unsupported("El dataset no contiene presupuestos de backup.");
  const periodResult = resolveBudgetPeriods(budget, backup.preferences);
  if (periodResult.status === "unsupported") return periodResult;
  const period =
    periodResult.periods.find((candidate) => candidate.key === selectedPeriodKey) ??
    periodResult.periods[0];
  if (period === undefined) return unsupported("El presupuesto no tiene periodos disponibles.");
  const scope = resolveBudgetScope(analytics, budget);
  if (typeof scope === "string") return unsupported(scope);

  const categoryByUuid = new Map(
    backup.categories.map((category) => [category.uuid, category]),
  );
  const categoryByPath = new Map(
    backup.categories.map((category) => [pathKey(category.path), category]),
  );
  const allocationsByCategory = new Map<string, BackupBudgetAllocationV1[]>();
  const globalAllocations: BackupBudgetAllocationV1[] = [];
  for (const allocation of budget.allocations) {
    if (allocation.categoryUuid === null) {
      globalAllocations.push(allocation);
    } else {
      const entries = allocationsByCategory.get(allocation.categoryUuid) ?? [];
      entries.push(allocation);
      allocationsByCategory.set(allocation.categoryUuid, entries);
    }
  }

  const roots = new Map<string, MutableAllocationNode>();
  for (const [categoryUuid, allocations] of allocationsByCategory) {
    const category = categoryByUuid.get(categoryUuid);
    if (category === undefined) return unsupported("Una asignación referencia una categoría inexistente.");
    if (!isSupportedAllocationType(category.type)) {
      return unsupported(
        `La semántica de presupuestos para categorías ${category.type} no está soportada.`,
      );
    }
    const resolved = resolveBudgetAllocation(allocations, period);
    if (
      resolved.source === "NONE" &&
      resolved.rolloverPreviousMinor === 0 &&
      resolved.rolloverNextMinor === 0
    ) {
      continue;
    }
    ensureAllocationNode(category, categoryByPath, roots).directAllocation = resolved;
  }

  const postings = scopedExpensePostings(
    filtered,
    period,
    scope,
    budget,
    categoryByUuid,
  );
  const allocationNodes = [...roots.values()]
    .map((node) => finalizeAllocationNode(node, postings, scope, 0))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  const globalResolved = resolveBudgetAllocation(globalAllocations, period);
  const exactAllocations = budget.allocations.filter((allocation) =>
    isExactAllocation(allocation, period),
  );
  const globalRolloverPreviousMinor = sumMinor(
    exactAllocations.map((allocation) => allocation.rolloverPreviousMinor),
    "Global previous rollovers",
  );
  const globalRolloverNextMinor = sumMinor(
    exactAllocations.map((allocation) => allocation.rolloverNextMinor),
    "Global next rollovers",
  );
  const globalConsumedMinor = sumMinor(
    postings.map((posting) => postingSpend(posting, scope)),
    "Global budget consumption",
  );
  const global = totals(
    globalResolved.baseMinor,
    globalRolloverPreviousMinor,
    globalRolloverNextMinor,
    globalConsumedMinor,
  );
  const categoryAssignedMinor = sumMinor(
    allocationNodes.map((node) => node.assignedMinor),
    "Categorized allocation",
  );
  const categorizedConsumedMinor = sumMinor(
    allocationNodes.map((node) => node.consumedMinor),
    "Categorized consumption",
  );

  return {
    status: "ready",
    analysis: {
      budget,
      period,
      periods: periodResult.periods,
      currency: scope.currency,
      fractionDigits: scope.fractionDigits,
      global,
      allocations: allocationNodes,
      categoryAssignedMinor,
      categorizedConsumedMinor,
      unallocatedConsumedMinor: addMinor(
        globalConsumedMinor,
        -categorizedConsumedMinor,
        "Unallocated budget consumption",
      ),
      filteredPostingCount: postings.length,
      ownFilterApplied: budget.filter !== null,
      aggregateNeutral: budget.aggregateNeutral,
      filterSummary: summarizeBudgetFilter(budget.filter),
    },
  };
}
