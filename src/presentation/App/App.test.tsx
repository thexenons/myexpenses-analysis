import {
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appStore } from "../../composition/app-store.ts";
import { AppStoreProvider } from "../providers/AppStoreProvider/index.ts";
import { createAppRouter } from "../router/app-router.ts";
import { installAppFetchMock } from "./App.test.helpers.ts";

function renderAppAt(pathname = "/resumen") {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = createAppRouter({ history });

  return {
    router,
    ...render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    ),
  };
}

async function waitForRouterReady(
  router: ReturnType<typeof createAppRouter>,
  pathname?: string,
) {
  await waitFor(
    () => {
      if (pathname !== undefined) {
        expect(router.state.location.pathname).toBe(pathname);
      }
      expect(router.state.matches.at(-1)?.status).toBe("success");
    },
    { timeout: 3_000 },
  );
}

describe("App integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    appStore.setState(appStore.getInitialState(), true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads the dataset and navigates through every analytical screen", async () => {
    installAppFetchMock();
    const user = userEvent.setup();
    const { router } = renderAppAt();

    await waitForRouterReady(router, "/resumen");
    expect(
      await screen.findByRole("heading", { name: "Resumen general" }),
    ).toBeVisible();
    async function navigateTo(
      navigationName: string,
      pathname: string,
      headingName: string,
    ) {
      await user.click(screen.getByRole("link", { name: navigationName }));
      await waitForRouterReady(router, pathname);
      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: headingName,
        }),
      ).toBeVisible();
    }

    expect(router.state.location.pathname).toBe("/resumen");
    await navigateTo("Flujo de caja", "/flujo-de-caja", "Flujo de caja");
    await navigateTo("Deudas", "/deudas", "Deudas");
    await navigateTo("Categorías", "/categorias", "Categorías");
    await navigateTo("Cuentas", "/cuentas", "Cuentas");
    await navigateTo("Transacciones", "/transacciones", "Transacciones");
    await navigateTo("Resumen", "/resumen", "Resumen general");
  }, 15_000);

  it("applies a global search to statistics and transaction data", async () => {
    installAppFetchMock();
    const user = userEvent.setup();
    const { router } = renderAppAt();
    await waitForRouterReady(router, "/resumen");
    await screen.findByRole("heading", { name: "Resumen general" });

    await user.type(
      screen.getByRole("searchbox", { name: /buscar en todos/i }),
      "tienda",
    );

    expect(appStore.getState().filters.search).toBe("tienda");

    await waitFor(() => {
      const flowCard = screen.getByText("Flujo del periodo").closest("article");
      expect(flowCard?.querySelector("data")).toHaveAttribute("value", "-20");
    });

    await user.click(screen.getByRole("link", { name: "Transacciones" }));
    await waitForRouterReady(router, "/transacciones");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Transacciones" }),
    ).toBeVisible();
    expect(screen.getByText("Tienda")).toBeVisible();
    expect(screen.getByText("1 resultados")).toBeVisible();
    expect(screen.queryByText("Empresa")).not.toBeInTheDocument();
  });

  it("shows load failures and retries the complete application flow", async () => {
    const fetchMock = installAppFetchMock({ failOnceFor: "accounts.json" });
    const user = userEvent.setup();
    const { router } = renderAppAt();
    await waitForRouterReady(router, "/resumen");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No pudimos abrir los datos",
      }),
    ).toBeVisible();
    expect(screen.getByText(/accounts data: HTTP 503/)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Volver a intentarlo" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Resumen general" }),
    ).toBeVisible();
    const accountRequests = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/accounts.json"),
    );
    expect(accountRequests).toHaveLength(2);
  });

  it("opens a direct URL below a Vite base path", async () => {
    installAppFetchMock();
    const history = createMemoryHistory({
      initialEntries: ["/finanzas/deudas"],
    });
    const router = createAppRouter({ basepath: "/finanzas", history });

    render(
      <AppStoreProvider store={appStore}>
        <RouterProvider router={router} />
      </AppStoreProvider>,
    );

    await waitForRouterReady(router);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Deudas" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Resumen" })).toHaveAttribute(
      "href",
      "/finanzas/resumen",
    );
  });

  it("follows browser back and forward history between URLs", async () => {
    installAppFetchMock();
    const user = userEvent.setup();
    const { router } = renderAppAt("/resumen");

    await waitForRouterReady(router, "/resumen");
    await screen.findByRole("heading", { name: "Resumen general" });
    await user.click(screen.getByRole("link", { name: "Deudas" }));
    await waitForRouterReady(router, "/deudas");
    await screen.findByRole("heading", { level: 1, name: "Deudas" });
    await user.click(screen.getByRole("link", { name: "Cuentas" }));
    await waitForRouterReady(router, "/cuentas");
    await screen.findByRole("heading", { level: 1, name: "Cuentas" });

    await act(async () => router.history.back());
    await waitForRouterReady(router, "/deudas");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Deudas" }),
    ).toBeVisible();

    await act(async () => router.history.forward());
    await waitForRouterReady(router, "/cuentas");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Cuentas" }),
    ).toBeVisible();
  });

  it("uses defaults for invalid transaction search and keeps sorting in history", async () => {
    installAppFetchMock();
    const user = userEvent.setup();
    const { router } = renderAppAt(
      "/transacciones?page=nope&sort=unknown&direction=sideways",
    );

    await waitForRouterReady(router, "/transacciones");
    await screen.findByRole("heading", { level: 1, name: "Transacciones" });
    expect(router.state.matches.at(-1)?.search).toEqual({
      direction: "desc",
      page: 1,
      sort: "date",
    });

    await user.click(screen.getByRole("button", { name: "Importe" }));
    await waitForRouterReady(router, "/transacciones");
    await waitFor(() => {
      expect(router.state.matches.at(-1)?.search).toEqual({
        direction: "desc",
        page: 1,
        sort: "amount",
      });
    });
    expect(router.state.location.searchStr).toContain("sort=amount");

    await act(async () => router.history.back());
    await waitForRouterReady(router, "/transacciones");
    await waitFor(() => {
      expect(router.state.matches.at(-1)?.search).toEqual({
        direction: "desc",
        page: 1,
        sort: "date",
      });
    });
  });
});
