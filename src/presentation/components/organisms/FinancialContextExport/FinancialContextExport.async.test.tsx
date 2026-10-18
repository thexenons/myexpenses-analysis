import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appStore } from "../../../../composition/app-store.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts";
import { FinancialContextExport } from "./FinancialContextExport.tsx";

beforeEach(() => {
  vi.resetModules();
  appStore.setState(appStore.getInitialState(), true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event("close")); } });
});

afterEach(() => vi.doUnmock("../../../../domain/analytics/financial-context.ts"));

it.each(["filter", "close", "lock"])("rejects pending generation after %s", async (invalidation) => {
  let resolveImport: () => void = () => {};
  const gate = new Promise<void>((resolve) => { resolveImport = resolve; });
  const builder = vi.fn<() => { transactions: unknown[]; privateSentinel: string }>(() => ({ transactions: [], privateSentinel: "old-snapshot" }));
  vi.doMock("../../../../domain/analytics/financial-context.ts", async () => {
    await gate;
    return { createFinancialContext: builder };
  });
  const analytics = normalizeDataset({ accounts: { version: 2, accounts: {} }, categories: {}, parsedData: [] });
  appStore.setState({ analytics, loadPhase: "ready" });
  render(<AppStoreProvider store={appStore}><FinancialContextExport /></AppStoreProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
  fireEvent.click(screen.getByRole("button", { name: "Generar JSON" }));
  expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();

  if (invalidation === "filter") act(() => appStore.getState().actions.patchFilters({ search: "new-filter" }));
  if (invalidation === "close") {
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
  }
  if (invalidation === "lock") await act(async () => { await appStore.getState().actions.lock(); });
  await act(async () => { resolveImport(); await gate; await new Promise((resolve) => setTimeout(resolve, 0)); });

  expect(builder).not.toHaveBeenCalled();
  expect(screen.queryByText("old-snapshot")).not.toBeInTheDocument();
  const preview = screen.queryByRole("textbox") as HTMLTextAreaElement | null;
  const copy = screen.queryByRole("button", { name: "Copiar JSON" });
  expect(preview?.value).toBe(invalidation === "lock" ? undefined : "");
  expect(copy?.hasAttribute("disabled")).toBe(invalidation === "lock" ? undefined : true);
});
