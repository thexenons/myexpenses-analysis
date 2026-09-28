import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { TransactionConcept } from "./TransactionConcept.tsx";

describe("TransactionConcept", () => {
  it("presents the payee, note and tags as the transaction concept", () => {
    render(<TransactionConcept posting={TRANSACTION_POSTING_FIXTURE} />);

    expect(screen.getAllByText("Restaurante")[0]).toBeVisible();
    expect(screen.getByText("Menú del día · Trabajo")).toBeVisible();
  });
});
