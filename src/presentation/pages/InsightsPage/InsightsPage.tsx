import { InsightsPageView } from "./InsightsPage.view.tsx";
import { useInsightsPage } from "./hooks/InsightsPage.hooks.ts";

export function InsightsPage() {
  const viewModel = useInsightsPage();

  return viewModel === null ? null : <InsightsPageView {...viewModel} />;
}
