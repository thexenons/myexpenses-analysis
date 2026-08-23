import type {
  CategoryBreakdownNode,
  CategoryType,
} from "../../../../../domain/analytics/types.ts";
import type { Tone } from "../../../../components/atoms/Badge/Badge.types.ts";

export const CATEGORY_TYPE_LABELS: Readonly<Record<CategoryType, string>> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  NEUTRAL: "Neutral",
  TRANSFER: "Transferencia",
};

export function categoryTypeTone(categoryType: CategoryType): Tone {
  return categoryType === "EXPENSE"
    ? "negative"
    : categoryType === "INCOME"
      ? "positive"
      : "info";
}

export function categoryBranchContainsSelection(
  category: CategoryBreakdownNode,
  selectedCategoryIds: ReadonlySet<string>,
): boolean {
  return (
    selectedCategoryIds.has(category.id) ||
    category.children.some((child) =>
      categoryBranchContainsSelection(child, selectedCategoryIds),
    )
  );
}
