import { CashFlowPageView } from "./CashFlowPage.view.tsx";
import { useCashFlowPage } from "./hooks/CashFlowPage.hooks.ts";

export function CashFlowPage() {
  const viewModel = useCashFlowPage();

  return viewModel === null ? null : <CashFlowPageView {...viewModel} />;
}
