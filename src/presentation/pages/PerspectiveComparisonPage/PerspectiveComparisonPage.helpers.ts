import { aggregateKpis } from "../../../domain/analytics/aggregations.ts";
import { applyFilters } from "../../../domain/analytics/filters.ts";
import type { AnalyticsDataset, AnalyticsScope, FilterState } from "../../../domain/analytics/types.ts";

export interface PerspectiveComparisonRow {
  readonly scope: AnalyticsScope;
  readonly incomesEurMinor: number;
  readonly expensesEurMinor: number;
  readonly transfersEurMinor: number;
  readonly netEurMinor: number;
  readonly postingCount: number;
}

const SCOPES: readonly AnalyticsScope[] = ["realCashFlow", "all", "debtsOnly"];

export function createPerspectiveComparisonModel(
  source: AnalyticsDataset,
  filters: FilterState,
): readonly PerspectiveComparisonRow[] {
  return SCOPES.map((scope) => {
    const kpis = aggregateKpis(applyFilters(source, { ...filters, scope }));
    return {
      scope,
      incomesEurMinor: kpis.incomesEurMinor,
      expensesEurMinor: kpis.expensesEurMinor,
      transfersEurMinor: kpis.transfersEurMinor,
      netEurMinor: kpis.netEurMinor,
      postingCount: kpis.postingCount,
    };
  });
}
