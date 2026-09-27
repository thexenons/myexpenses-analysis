import { aggregateCategoryBreakdown, aggregateKpis } from "../../../domain/analytics/aggregations.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import type {
  AmountSummary,
  AnalyticsDataset,
  AnalyticsScope,
  CategoryBreakdownNode,
  FilterState,
} from "../../../domain/analytics/types.ts";

export interface PerspectiveComparisonRow {
  readonly scope: AnalyticsScope;
  readonly incomesEurMinor: number;
  readonly expensesEurMinor: number;
  readonly transfersEurMinor: number;
  readonly netEurMinor: number;
  readonly postingCount: number;
}

const SCOPES: readonly AnalyticsScope[] = ["realCashFlow", "all", "debtsOnly"];

export type CategoryMetric =
  | "netEurMinor"
  | "incomesEurMinor"
  | "expensesEurMinor"
  | "transfersEurMinor";

type CategoryAmounts = Pick<AmountSummary, CategoryMetric>;

export interface PerspectiveCategoryRow {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
  readonly amounts: Readonly<Record<AnalyticsScope, CategoryAmounts>>;
  readonly children: readonly PerspectiveCategoryRow[];
}

interface MutableCategoryRow {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
  readonly amounts: Record<AnalyticsScope, CategoryAmounts>;
  readonly children: Map<string, MutableCategoryRow>;
}

const ZERO_AMOUNTS: CategoryAmounts = {
  netEurMinor: 0,
  incomesEurMinor: 0,
  expensesEurMinor: 0,
  transfersEurMinor: 0,
};

function mergeCategory(
  level: Map<string, MutableCategoryRow>,
  category: CategoryBreakdownNode,
  scope: AnalyticsScope,
): void {
  let row = level.get(category.id);
  if (row === undefined) {
    row = {
      id: category.id,
      name: category.name,
      path: category.path,
      amounts: { realCashFlow: ZERO_AMOUNTS, all: ZERO_AMOUNTS, debtsOnly: ZERO_AMOUNTS },
      children: new Map(),
    };
    level.set(category.id, row);
  }
  const { netEurMinor, incomesEurMinor, expensesEurMinor, transfersEurMinor } = category.summary;
  row.amounts[scope] = { netEurMinor, incomesEurMinor, expensesEurMinor, transfersEurMinor };
  for (const child of category.children) mergeCategory(row.children, child, scope);
}

function finishCategories(level: Map<string, MutableCategoryRow>): readonly PerspectiveCategoryRow[] {
  return [...level.values()]
    .sort((left, right) => left.name.localeCompare(right.name, "es") || left.id.localeCompare(right.id))
    .map(({ id, name, path, amounts, children }) => ({
      id,
      name,
      path,
      amounts,
      children: finishCategories(children),
    }));
}

export function createPerspectiveComparisonPageModel(
  source: AnalyticsDataset,
  filters: FilterState,
): { readonly rows: readonly PerspectiveComparisonRow[]; readonly categories: readonly PerspectiveCategoryRow[] } {
  const categories = new Map<string, MutableCategoryRow>();
  const rows = SCOPES.map((scope) => {
    const filtered = applyFilters(source, { ...filters, scope });
    const kpis = aggregateKpis(filtered);
    for (const category of aggregateCategoryBreakdown(filtered)) {
      mergeCategory(categories, category, scope);
    }
    return {
      scope,
      incomesEurMinor: kpis.incomesEurMinor,
      expensesEurMinor: kpis.expensesEurMinor,
      transfersEurMinor: kpis.transfersEurMinor,
      netEurMinor: kpis.netEurMinor,
      postingCount: kpis.postingCount,
    };
  });
  return { rows, categories: finishCategories(categories) };
}

export function createPerspectiveComparisonModel(
  source: AnalyticsDataset,
  filters: FilterState,
): readonly PerspectiveComparisonRow[] {
  return createPerspectiveComparisonPageModel(source, filters).rows;
}
