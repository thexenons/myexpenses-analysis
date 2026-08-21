import { OverviewPageView } from "./OverviewPage.view.tsx";
import { useOverviewPage } from "./hooks/OverviewPage.hooks.ts";

export function OverviewPage() {
  const viewModel = useOverviewPage();

  return viewModel === null ? null : <OverviewPageView {...viewModel} />;
}
