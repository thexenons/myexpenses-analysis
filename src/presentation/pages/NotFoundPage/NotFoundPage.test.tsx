import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appStore } from "../../../composition/app-store.ts";
import { getAxeViolations } from "../../../../tests/setup/axe.ts";
import {
  APP_TEST_PASSPHRASE,
  installAppFetchMock,
} from "../../App/App.test.helpers.ts";
import { AppStoreProvider } from "../../providers/AppStoreProvider/index.ts";
import { createAppRouter } from "../../router/app-router.ts";

describe("NotFoundPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    appStore.setState(appStore.getInitialState(), true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("offers a routed recovery link without nesting main landmarks", async () => {
    installAppFetchMock();
    const user = userEvent.setup();
    const history = createMemoryHistory({
      initialEntries: ["/seccion-inexistente"],
    });
    const router = createAppRouter({ history });

    render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    );

    await waitFor(() => {
      expect(router.state.matches.at(-1)?.status).toBe("success");
    });

    await user.type(
      await screen.findByLabelText("Frase de desbloqueo"),
      APP_TEST_PASSPHRASE,
    );
    await user.click(screen.getByRole("button", { name: "Abrir bóveda" }));

    expect(
      await screen.findByRole("heading", { name: "Esta página no existe" }),
    ).toBeVisible();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByText("Sección actual: Página no encontrada")).toBeInTheDocument();
    expect(document.title).toBe("Página no encontrada · My Expenses");
    expect(await getAxeViolations(document)).toEqual([]);

    await user.click(screen.getByRole("link", { name: "Volver al resumen" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/resumen");
      expect(router.state.matches.at(-1)?.status).toBe("success");
    });
    expect(
      await screen.findByRole("heading", { name: "Resumen general" }),
    ).toBeVisible();
  }, 15_000);
});
