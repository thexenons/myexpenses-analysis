import { BudgetsPageView } from "./BudgetsPage.view.tsx";
import { useBudgetsPage } from "./hooks/BudgetsPage.hooks.ts";

export function BudgetsPage() {
  const viewModel = useBudgetsPage();
  return viewModel === null ? null : <BudgetsPageView {...viewModel} />;
}
