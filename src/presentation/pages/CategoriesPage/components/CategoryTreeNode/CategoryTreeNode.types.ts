import type { CategoryBreakdownNode } from "../../../../../domain/analytics/types.ts";

export interface CategoryTreeNodeProps {
  readonly category: CategoryBreakdownNode;
  readonly depth: number;
  readonly onToggleCategory: (path: readonly string[]) => void;
  readonly selectedCategoryIds: ReadonlySet<string>;
}
