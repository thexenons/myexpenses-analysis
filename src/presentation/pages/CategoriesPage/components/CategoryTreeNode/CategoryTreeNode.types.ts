import type { CategoryBreakdownNode, TimeGranularity } from "../../../../../domain/analytics/types.ts";

export interface CategoryTreeNodeProps {
  readonly category: CategoryBreakdownNode;
  readonly averageEurMinorByCategoryId: ReadonlyMap<string, number>;
  readonly averageUnit: TimeGranularity;
  readonly averageScope: "filtered" | "historical";
  readonly completedPeriodCount: number;
  readonly depth: number;
  readonly onToggleCategory: (path: readonly string[]) => void;
  readonly selectedCategoryIds: ReadonlySet<string>;
}
