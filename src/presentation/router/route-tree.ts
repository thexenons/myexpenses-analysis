import {
  createRootRoute,
  createRoute,
  lazyRouteComponent,
} from "@tanstack/react-router";

import { App } from "../App/index.ts";
import { NotFoundPage } from "../pages/NotFoundPage/index.ts";
import { RootRedirect } from "./RootRedirect/index.ts";
import { validateTransactionsSearch } from "./transactions-search.ts";

export function createRouteTree() {
  const rootRoute = createRootRoute({
    component: App,
    notFoundComponent: NotFoundPage,
  });

  const indexRoute = createRoute({
    component: RootRedirect,
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const overviewRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/OverviewPage/index.ts"),
      "OverviewPage",
    ),
    getParentRoute: () => rootRoute,
    path: "resumen",
  });

  const cashFlowRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/CashFlowPage/index.ts"),
      "CashFlowPage",
    ),
    getParentRoute: () => rootRoute,
    path: "flujo-de-caja",
  });

  const debtsRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/DebtsPage/index.ts"),
      "DebtsPage",
    ),
    getParentRoute: () => rootRoute,
    path: "deudas",
  });

  const categoriesRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/CategoriesPage/index.ts"),
      "CategoriesPage",
    ),
    getParentRoute: () => rootRoute,
    path: "categorias",
  });

  const accountsRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/AccountsPage/index.ts"),
      "AccountsPage",
    ),
    getParentRoute: () => rootRoute,
    path: "cuentas",
  });

  const transactionsRoute = createRoute({
    component: lazyRouteComponent(
      () => import("../pages/TransactionsPage/index.ts"),
      "TransactionsPage",
    ),
    getParentRoute: () => rootRoute,
    path: "transacciones",
    validateSearch: validateTransactionsSearch,
  });

  return rootRoute.addChildren([
    indexRoute,
    overviewRoute,
    cashFlowRoute,
    debtsRoute,
    categoriesRoute,
    accountsRoute,
    transactionsRoute,
  ]);
}
