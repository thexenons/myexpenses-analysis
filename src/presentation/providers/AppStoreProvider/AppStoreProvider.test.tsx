import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { DatasetRepository } from "../../../application/ports/dataset-repository.ts";
import { createAppStore } from "../../../application/store/app-store/app-store.ts";
import { AppStoreProvider } from "./AppStoreProvider.tsx";
import { useAppStore } from "./hooks/AppStoreProvider.hooks.ts";

function StoreProbe() {
  const granularity = useAppStore((state) => state.granularity);
  return <output>{granularity}</output>;
}

beforeEach(() => window.localStorage.clear());

it("provides an injected Zustand store to presentation hooks", () => {
  const repository: DatasetRepository = { load: vi.fn() };
  const store = createAppStore(repository, window.localStorage);
  store.getState().actions.setGranularity("year");

  render(
    <AppStoreProvider store={store}>
      <StoreProbe />
    </AppStoreProvider>,
  );

  expect(screen.getByText("year")).toBeVisible();
});
