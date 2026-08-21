import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { appStore } from "./composition/app-store.ts";
import { AppStoreProvider } from "./presentation/providers/AppStoreProvider/index.ts";
import { appRouter } from "./presentation/router/app-router.ts";
import "./presentation/styles/global.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <AppStoreProvider store={appStore}>
      <RouterProvider router={appRouter} />
    </AppStoreProvider>
  </StrictMode>,
);
