import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { appStore } from "../../../composition/app-store.ts";
import { AppStoreProvider } from "../../providers/AppStoreProvider/index.ts";
import { createAppRouter } from "../app-router.ts";

describe("RootRedirect", () => {
  beforeEach(() => {
    window.localStorage.clear();
    appStore.setState(appStore.getInitialState(), true);
    appStore.setState({ loadPhase: "ready" });
  });

  it("replaces the root URL with the overview URL", async () => {
    const history = createMemoryHistory({ initialEntries: ["/"] });
    const router = createAppRouter({ history });

    render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/resumen");
      expect(router.state.matches.at(-1)?.status).toBe("success");
    });
    expect(router.history.length).toBe(1);
  });
});
