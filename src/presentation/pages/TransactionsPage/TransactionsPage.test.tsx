import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "./TransactionsPage.test.helpers.ts";
import { TransactionsPageView } from "./TransactionsPage.view.tsx";

const posting = TRANSACTION_POSTING_FIXTURE;

describe("TransactionsPageView", () => {
  it("renders rows and forwards sorting and export actions", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onSort = vi.fn();
    render(
      <TransactionsPageView
        descending
        onDownload={onDownload}
        onPageChange={vi.fn()}
        onSort={onSort}
        page={1}
        pageCount={1}
        postings={[posting]}
        resultCount={1}
        searchPending={false}
        sortKey="date"
      />,
    );

    expect(screen.getByText("Restaurante")).toBeVisible();
    expect(screen.getByText("Conciliado")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fecha" }));
    expect(onSort).toHaveBeenCalledWith("date");
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("provides an actionable empty state", () => {
    render(
      <TransactionsPageView
        descending
        onDownload={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
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
        onDownload={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
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
});
