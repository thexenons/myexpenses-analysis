import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionAccount } from "./TransactionAccount.tsx";

describe("TransactionAccount", () => {
  it("shows the account label and identifies debt accounts", () => {
    render(
      <TransactionAccount
        posting={{ ...TRANSACTION_POSTING_FIXTURE, accountType: "DEBT" }}
      />,
    );

    expect(screen.getByText("Cuenta diaria")).toBeVisible();
    expect(screen.getByText("D")).toBeVisible();
  });
});
