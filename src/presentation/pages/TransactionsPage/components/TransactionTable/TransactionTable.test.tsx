import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionTable } from "./TransactionTable.tsx";

describe("TransactionTable", () => {
  it("renders posting cells and forwards column sorting", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <TransactionTable
        descending
        onSort={onSort}
        postings={[TRANSACTION_POSTING_FIXTURE]}
        sortKey="date"
      />,
    );

    expect(screen.getByText("Restaurante")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fecha" }));
    expect(onSort).toHaveBeenCalledWith("date");
  });
});
