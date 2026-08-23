import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionStatus } from "./TransactionStatus.tsx";

describe("TransactionStatus", () => {
  it("labels every audit status in plain language", () => {
    const { rerender } = render(
      <TransactionStatus posting={TRANSACTION_POSTING_FIXTURE} />,
    );
    expect(screen.getByText("Conciliado")).toBeVisible();

    rerender(
      <TransactionStatus
        posting={{ ...TRANSACTION_POSTING_FIXTURE, status: "CLEARED" }}
      />,
    );
    expect(screen.getByText("Compensado")).toBeVisible();

    rerender(
      <TransactionStatus
        posting={{ ...TRANSACTION_POSTING_FIXTURE, status: "VOID" }}
      />,
    );
    expect(screen.getByText("Anulado")).toBeVisible();

    rerender(
      <TransactionStatus
        posting={{ ...TRANSACTION_POSTING_FIXTURE, status: "UNRECONCILED" }}
      />,
    );
    expect(screen.getByText("Pendiente")).toBeVisible();
  });
});
