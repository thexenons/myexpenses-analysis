import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AnalyticsDataset } from "../../../../../domain/analytics/types.ts";
import { TRANSACTION_POSTING_FIXTURE } from "../../TransactionsPage.test.helpers.ts";
import { relatedTransactionPostings } from "./TransactionLinks.helpers.ts";
import { TransactionLinks } from "./TransactionLinks.tsx";

const own = { ...TRANSACTION_POSTING_FIXTURE, id: "cash:own", sourceTransactionId: "purchase", splitIndex: 0, splitCount: 2 };
const advance = { ...own, id: "cash:advance", splitIndex: 1, transferPeerPostingId: "debt:advance" };
const peer = { ...TRANSACTION_POSTING_FIXTURE, id: "debt:advance", accountId: "debt", accountLabel: "Pareja", accountType: "DEBT" as const, transferPeerPostingId: advance.id, amountEurMinor: 1250, amountNativeMinor: 1250 };
const unrelated = { ...own, id: "other:own", accountId: "other" };
const dataset: AnalyticsDataset = { currency: "EUR", source: { accounts: { version: 2, accounts: {} }, categories: {} }, accounts: [], postings: [own, advance, peer, unrelated], minDate: own.date, maxDate: own.date };

describe("TransactionLinks", () => {
  it("traces a debt counterpart to the original split operation without guessing by date", () => {
    expect(relatedTransactionPostings(peer, dataset).map((row) => row.id)).toEqual([advance.id, own.id]);
    expect(relatedTransactionPostings(advance, dataset).map((row) => row.id)).toEqual([peer.id, own.id]);
  });

  it("shows linked context on demand and explicitly separates it from filtered totals", () => {
    render(<TransactionLinks dataset={dataset} posting={advance} />);
    expect(screen.queryByText(/Pareja/)).not.toBeInTheDocument();
    const summary = screen.getByText("Ver operación y contrapartida");
    const details = summary.closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByText(/Pareja/)).toBeVisible();
    expect(screen.getByText(/puede incluir movimientos fuera de los filtros/)).toBeVisible();
    expect(screen.getByText(`Parte de la misma operación · ${own.id}`)).toBeVisible();
  });
});
