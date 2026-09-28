import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionTable } from "./TransactionTable.tsx";

describe("TransactionTable", () => {
  it("keeps mixed and VOID statuses in their rows while omitting a uniform non-VOID status column", () => {
    const props = { descending: true, onSort: vi.fn<(key: "amount" | "date") => void>(), postings: [TRANSACTION_POSTING_FIXTURE], sortKey: "date" as const };
    const { rerender } = render(<TransactionTable {...props} uniformStatus="RECONCILED" />);
    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    rerender(<TransactionTable {...props} postings={[TRANSACTION_POSTING_FIXTURE, { ...TRANSACTION_POSTING_FIXTURE, id: "void", isVoid: true, status: "VOID" }]} />);
    expect(screen.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    expect(screen.getByText("Anulado")).toBeVisible();
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
