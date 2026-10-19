import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appStore } from "../../../../composition/app-store.ts";
import { normalizeDataset } from "../../../../domain/analytics/normalize.ts";
import { createDefaultFilterState } from "../../../../domain/analytics/filters.ts";
import { AppStoreProvider } from "../../../providers/AppStoreProvider/index.ts";
import { FinancialContextExport } from "./FinancialContextExport.tsx";

function setup() {
  const analytics = normalizeDataset({
    accounts: { version: 2, accounts: { bank: { label: "Bank", type: "DEFAULT" } } },
    categories: { Food: { categoryType: "EXPENSE" } },
    parsedData: [{ uuid: "bank", label: "Bank", currency: "EUR", openingBalance: 100, transactions: ([
      { uuid: "old", date: "2024-01-01", amount: -10, category: ["Food"], comment: "Older" },
      { uuid: "new", date: "2024-02-01", amount: -20, category: ["Food"], comment: "Recent" },
    ] as const).map((row) => Object.assign({}, row, { sourceStatus: "RECONCILED" as const, sourceTransactionUuid: row.uuid, splitIndex: null, splitCount: null })) }],
  });
  appStore.setState({ loadPhase: "ready", analytics, filters: { ...createDefaultFilterState(), search: "Recent" } });
  render(<AppStoreProvider store={appStore}><FinancialContextExport /></AppStoreProvider>);
  return userEvent.setup();
}

beforeEach(() => {
  window.localStorage.clear();
  appStore.setState(appStore.getInitialState(), true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event("close")); } });
});

afterEach(() => vi.unstubAllGlobals());

describe("FinancialContextExport", () => {
  it.each(["filtered", "all"] as const)("downloads the exact %s snapshot without copying or changing filters", async (mode) => {
    const user = setup();
    const before = appStore.getState().filters;
    const createObjectURL = vi.fn<(_blob: Blob) => string>(() => "blob:financial-context");
    const revokeObjectURL = vi.fn<(_url: string) => void>();
    vi.stubGlobal("URL", class extends URL {
      static override createObjectURL = createObjectURL;
      static override revokeObjectURL = revokeObjectURL;
    });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    let filename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
      expect(this).toHaveAttribute("href", "blob:financial-context");
      expect(this).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    expect(screen.getByRole("button", { name: "Descargar JSON" })).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox"), mode);
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    const text = (screen.getByRole("textbox") as HTMLTextAreaElement).value;
    expect(createObjectURL).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Descargar JSON" }));
    expect(click).toHaveBeenCalledOnce();
    expect(filename).toBe(`contexto-financiero-${mode}.json`);
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("application/json;charset=utf-8");
    const downloaded = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    expect(downloaded).toBe(text);
    expect(writeText).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:financial-context");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Descarga iniciada");
    expect(appStore.getState().filters).toBe(before);
    act(() => appStore.getState().actions.patchFilters({ search: "Older" }));
    expect(screen.getByRole("button", { name: "Descargar JSON" })).toBeDisabled();
  });

  it("cleans up a failed download and leaves the snapshot available", async () => {
    const user = setup();
    const revokeObjectURL = vi.fn<(_url: string) => void>();
    vi.stubGlobal("URL", class extends URL {
      static override createObjectURL = () => "blob:failed-download";
      static override revokeObjectURL = revokeObjectURL;
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { throw new Error("private-download-detail"); });
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    const text = (screen.getByRole("textbox") as HTMLTextAreaElement).value;
    await user.click(screen.getByRole("button", { name: "Descargar JSON" }));
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo iniciar la descarga");
    expect(screen.queryByText(/private-download-detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue(text);
    expect(screen.getByRole("button", { name: "Copiar JSON" })).toBeEnabled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:failed-download");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("defaults to filtered text, copies valid JSON, and makes all-data export explicit", async () => {
    const user = setup();
    const before = appStore.getState().filters;
    const storage = JSON.stringify(window.localStorage);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    expect(screen.getByRole("combobox", { name: "Datos que incluir" })).toHaveValue("filtered");
    expect(screen.getByRole("button", { name: "Copiar JSON" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    const preview = screen.getByRole("textbox", { name: "Contexto financiero JSON" });
    const json = (preview as HTMLTextAreaElement).value;
    expect(JSON.parse(json).schemaVersion).toBe(2);
    expect(JSON.parse(json).transactions.defaults.transactionId).toBe("new");
    expect(JSON.parse(json).transactions.rows).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Copiar JSON" }));
    expect(writeText).toHaveBeenCalledWith(json);
    expect(screen.getByRole("status")).toHaveTextContent("JSON copiado");
    await user.selectOptions(screen.getByRole("combobox", { name: "Datos que incluir" }), "all");
    expect(preview).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    expect(JSON.parse((preview as HTMLTextAreaElement).value).transactions.rows).toHaveLength(2);
    expect(appStore.getState().filters).toBe(before);
    expect(JSON.stringify(window.localStorage)).toBe(storage);
  });

  it("invalidates previews when filters change and generates from current search immediately", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    act(() => appStore.getState().actions.patchFilters({ search: "Older" }));
    expect(screen.getByRole("textbox", { name: "Contexto financiero JSON" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Copiar JSON" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    expect(JSON.parse((screen.getByRole("textbox", { name: "Contexto financiero JSON" }) as HTMLTextAreaElement).value).transactions.defaults.transactionId).toBe("old");
  });

  it("keeps manual copying available after a clipboard denial and clears content on close", async () => {
    const user = setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    await user.click(screen.getByRole("button", { name: "Copiar JSON" }));
    expect(screen.getByRole("status")).toHaveTextContent("Selecciona el texto");
    expect(screen.getByRole("textbox", { name: "Contexto financiero JSON" })).not.toHaveValue("");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar contexto JSON" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    expect(screen.getByRole("textbox", { name: "Contexto financiero JSON" })).toHaveValue("");
  });

  it("removes plaintext when the vault locks and prevents exporting without loaded data", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    await act(async () => { await appStore.getState().actions.lock(); });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar contexto JSON" })).toBeDisabled();
  });

  it("ignores a late clipboard completion after closing and reopening the dialog", async () => {
    const user = setup();
    let finishCopy: () => void = () => {};
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValue(new Promise<void>((resolve) => { finishCopy = resolve; }));
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    await user.click(screen.getByRole("button", { name: "Copiar JSON" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await act(async () => { finishCopy(); });
    expect(screen.getByRole("status")).not.toHaveTextContent("JSON copiado");
    expect(screen.getByRole("textbox", { name: "Contexto financiero JSON" })).toHaveValue("");
  });

  it("reports generation failure without exposing errors or changing filters", async () => {
    const user = setup();
    const before = appStore.getState().filters;
    const builder = await import("../../../../domain/analytics/financial-context.ts");
    vi.spyOn(builder, "createFinancialContext").mockImplementation(() => { throw new Error("private-internal-value"); });
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo generar"));
    expect(screen.queryByText(/private-internal-value/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Contexto financiero JSON" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Copiar JSON" })).toBeDisabled();
    expect(appStore.getState().filters).toBe(before);
  });

  it("discards a late clipboard failure after a scope change without mutating data", async () => {
    const user = setup();
    const before = JSON.stringify({ analytics: appStore.getState().analytics, filters: appStore.getState().filters });
    let rejectCopy: (error: Error) => void = () => {};
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValue(new Promise<void>((_resolve, reject) => { rejectCopy = reject; }));
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    await user.click(screen.getByRole("button", { name: "Copiar JSON" }));
    await user.selectOptions(screen.getByRole("combobox"), "all");
    await act(async () => { rejectCopy(new Error("private-copy-error")); });
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Copiar JSON" })).toBeDisabled();
    expect(JSON.stringify({ analytics: appStore.getState().analytics, filters: appStore.getState().filters })).toBe(before);
  });

  it("discards a late clipboard completion after locking the vault", async () => {
    const user = setup();
    let finishCopy: () => void = () => {};
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValue(new Promise<void>((resolve) => { finishCopy = resolve; }));
    await user.click(screen.getByRole("button", { name: "Exportar contexto JSON" }));
    await user.click(screen.getByRole("button", { name: "Generar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON generado"));
    await user.click(screen.getByRole("button", { name: "Copiar JSON" }));
    await act(async () => { await appStore.getState().actions.lock(); finishCopy(); });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar contexto JSON" })).toBeDisabled();
  });
});
