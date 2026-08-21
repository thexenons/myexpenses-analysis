import { CategoriesPageView } from "./CategoriesPage.view.tsx";
import { useCategoriesPage } from "./hooks/CategoriesPage.hooks.ts";

export function CategoriesPage() {
  const viewModel = useCategoriesPage();

  return viewModel === null ? null : <CategoriesPageView {...viewModel} />;
}
