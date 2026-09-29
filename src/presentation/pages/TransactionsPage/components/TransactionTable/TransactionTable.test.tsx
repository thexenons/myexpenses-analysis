import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionTable } from "./TransactionTable.tsx";

describe("TransactionTable", () => {
  it("omits the status column for mixed active rows", () => {
    render(<TransactionTable descending onSort={vi.fn<(key: "amount" | "date") => void>()} postings={[TRANSACTION_POSTING_FIXTURE, { ...TRANSACTION_POSTING_FIXTURE, id: "cleared", status: "CLEARED" }]} sortKey="date" />);
    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.queryByText("Conciliado")).not.toBeInTheDocument();
  });

  it("renders posting cells and forwards column sorting", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn<(key: "amount" | "date") => void>();
    render(
      <TransactionTable
        descending
        onSort={onSort}
        postings={[TRANSACTION_POSTING_FIXTURE]}
        sortKey="date"
      />,
    );

    expect(screen.getAllByText("Restaurante")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fecha" }));
    expect(onSort).toHaveBeenCalledWith("date");
  });
});
