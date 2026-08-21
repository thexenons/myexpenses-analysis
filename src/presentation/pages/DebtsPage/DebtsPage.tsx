import { DebtsPageView } from "./DebtsPage.view.tsx";
import { useDebtsPage } from "./hooks/DebtsPage.hooks.ts";

export function DebtsPage() {
  const viewModel = useDebtsPage();

  return viewModel === null ? null : <DebtsPageView {...viewModel} />;
}
