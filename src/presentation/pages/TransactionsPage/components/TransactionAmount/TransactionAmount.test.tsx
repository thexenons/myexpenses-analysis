import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionAmount } from "./TransactionAmount.tsx";

describe("TransactionAmount", () => {
  it("keeps the auditable amount when the posting is annulled", () => {
    render(
      <TransactionAmount
        posting={{
          ...TRANSACTION_POSTING_FIXTURE,
          isVoid: true,
          status: "VOID",
        }}
      />,
    );

    expect(screen.getByText(/-12,50/)).toBeVisible();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });
});
