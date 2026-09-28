import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "./TransactionsPage.test.helpers.ts";
import { TransactionsPageView } from "./TransactionsPage.view.tsx";

const posting = TRANSACTION_POSTING_FIXTURE;

describe("TransactionsPageView", () => {
  it("offers page sizes independently from export and labels the selected date basis", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn<(size: number) => void>();
    render(
      <TransactionsPageView
        descending
        dateBasis="value"
        onDownload={vi.fn<() => void>()}
        onPageChange={vi.fn<(page: number) => void>()}
        onPageSizeChange={onPageSizeChange}
        onSort={vi.fn<(key: "amount" | "date") => void>()}
        page={1}
        pageCount={1}
        pageSize={50}
        postings={[posting]}
        resultCount={1}
        searchPending={false}
        sortKey="date"
      />,
    );
    await user.selectOptions(screen.getByLabelText("Filas por página"), "100");
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
    expect(screen.getByRole("button", { name: "Fecha valor" })).toBeVisible();
  });

  it("renders rows and forwards sorting and export actions", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn<() => void>();
    const onSort = vi.fn<(key: "amount" | "date") => void>();
    render(
      <TransactionsPageView
        descending
        onDownload={onDownload}
        onPageChange={vi.fn<(page: number) => void>()}
        onSort={onSort}
        page={1}
        pageCount={1}
        postings={[posting]}
        resultCount={1}
        searchPending={false}
        sortKey="date"
      />,
    );

    expect(screen.getAllByText("Restaurante")[0]).toBeVisible();
    expect(screen.getByText("Conciliado")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fecha" }));
    expect(onSort).toHaveBeenCalledWith("date");
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("states a shared non-VOID status once without hiding sort, export, or source detail", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn<() => void>();
    const onSort = vi.fn<(key: "amount" | "date") => void>();
    render(<TransactionsPageView
      descending
      onDownload={onDownload}
      onPageChange={vi.fn<(page: number) => void>()}
      onSort={onSort}
      page={1}
      pageCount={1}
      postings={[posting]}
      resultCount={1}
      searchPending={false}
      sortKey="date"
      uniformStatus="RECONCILED"
    />);
    expect(screen.getByText(/Estado de todos los resultados/)).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Importe" }));
    expect(onSort).toHaveBeenCalledWith("amount");
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(onDownload).toHaveBeenCalledOnce();
    await user.click(screen.getByText("Ver concepto completo y trazabilidad"));
    expect(screen.getByText("Estado MyExpenses").nextElementSibling).toHaveTextContent("RECONCILED");
  });

  it("keeps row status when this page is uniform but the full result is mixed", () => {
    render(<TransactionsPageView
      descending
      onDownload={vi.fn<() => void>()}
      onPageChange={vi.fn<(page: number) => void>()}
      onSort={vi.fn<(key: "amount" | "date") => void>()}
      page={1}
      pageCount={2}
      postings={[posting]}
      resultCount={2}
      searchPending={false}
      sortKey="date"
    />);
    expect(screen.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    expect(screen.getByText("Conciliado")).toBeVisible();
    expect(screen.queryByText(/Estado de todos los resultados/)).not.toBeInTheDocument();
  });

  it("provides an actionable empty state", () => {
    render(
      <TransactionsPageView
        descending
        onDownload={vi.fn<() => void>()}
        onPageChange={vi.fn<(page: number) => void>()}
        onSort={vi.fn<(key: "amount" | "date") => void>()}
        page={1}
        pageCount={1}
        postings={[]}
        resultCount={0}
        searchPending={false}
        sortKey="date"
      />,
    );

    expect(screen.getByText("No hay movimientos")).toBeVisible();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
  });

  it("shows the original amount of an annulled posting for audit consistency", () => {
    render(
      <TransactionsPageView
        descending
        onDownload={vi.fn<() => void>()}
        onPageChange={vi.fn<(page: number) => void>()}
        onSort={vi.fn<(key: "amount" | "date") => void>()}
        page={1}
        pageCount={1}
        postings={[{ ...posting, isVoid: true, status: "VOID" }]}
        resultCount={1}
        searchPending={false}
        sortKey="date"
      />,
    );

    expect(screen.getByText("Anulado")).toBeVisible();
    expect(screen.getByText(/-12,50/, { selector: "strong" })).toBeVisible();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it("keeps one polite result status through searching, completion and zero results", () => {
    const props = {
      descending: true,
      onDownload: vi.fn<() => void>(),
      onPageChange: vi.fn<(page: number) => void>(),
      onSort: vi.fn<(key: "amount" | "date") => void>(),
      page: 1,
      pageCount: 1,
      postings: [posting],
      resultCount: 1,
      searchPending: true,
      sortKey: "date" as const,
    };
    const { rerender } = render(<TransactionsPageView {...props} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/actualizando búsqueda/iu);

    rerender(<TransactionsPageView {...props} searchPending={false} resultCount={3} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(/3 resultados/u);
    expect(status).not.toHaveTextContent(/actualizando/iu);

    rerender(<TransactionsPageView {...props} searchPending={false} resultCount={0} postings={[]} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(/no hay resultados/iu);
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-live");
    expect(screen.getByRole("region", { name: "Movimientos filtrados" })).not.toHaveAttribute("aria-live");
  });
});
