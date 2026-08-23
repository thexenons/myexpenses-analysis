import { useId, useState } from "react";

import { categoryBranchContainsSelection } from "../CategoryTreeNode.helpers.ts";
import type { CategoryTreeNodeProps } from "../CategoryTreeNode.types.ts";

export function useCategoryTreeNode({
  category,
  depth,
  selectedCategoryIds,
}: Pick<CategoryTreeNodeProps, "category" | "depth" | "selectedCategoryIds">) {
  const childrenId = useId();
  const hasChildren = category.children.length > 0;
  const containsSelection = categoryBranchContainsSelection(
    category,
    selectedCategoryIds,
  );
  const [expanded, setExpanded] = useState(
    () => hasChildren && (depth === 0 || containsSelection),
  );

  return {
    childrenId,
    expanded,
    hasChildren,
    onToggleExpanded: () => setExpanded((value) => !value),
    selected: selectedCategoryIds.has(category.id),
  };
}
