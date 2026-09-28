import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { INSIGHTS_FIXTURE } from "../../InsightsPage.test.helpers.ts";
import { InsightsMethods } from "./InsightsMethods.tsx";

const partial = INSIGHTS_FIXTURE.paymentMethods;

describe("InsightsMethods", () => {
  it("omits the ranking when no active posting has a method", () => {
    render(<InsightsMethods methods={{ ...partial, methods: [], usedMethodCount: 0, usedPostingCount: 0 }} />);
    expect(screen.queryByRole("region", { name: "Métodos de pago" })).not.toBeInTheDocument();
  });

  it("states partial coverage without a scarcity claim and labels count versus signed net", () => {
    render(<InsightsMethods methods={partial} />);
    const ranking = screen.getByRole("region", { name: "Métodos de pago" });
    expect(ranking).toHaveTextContent("Apuntes activos con método: 1 de 10");
    expect(ranking).toHaveTextContent("Métodos usados: 1 · Definidos: 2");
    expect(ranking).toHaveTextContent("Ranking por número de movimientos computados");
    expect(ranking).toHaveTextContent("Neto con signo");
    expect(ranking).not.toHaveTextContent(/apenas aparece|escas/);
    expect(within(ranking).getAllByRole("listitem")).toHaveLength(1);
  });

  it("reports complete coverage without implying methods are rare", () => {
    render(<InsightsMethods methods={{ ...partial, activePostingCount: 1, definedMethodCount: 1 }} />);
    const ranking = screen.getByRole("region", { name: "Métodos de pago" });
    expect(ranking).toHaveTextContent("Apuntes activos con método: 1 de 1");
    expect(ranking).not.toHaveTextContent(/apenas aparece|escas/);
  });

  it("keeps same-label identities distinct and pauses navigation during deferred search", async () => {
    const onViewMethod = vi.fn<(identityKey: string) => void>();
    const first = { identityKey: '["source",1]', name: "Card", netEurMinor: -100, postingCount: 2 };
    const second = { identityKey: '["source",2]', name: "Card", netEurMinor: -200, postingCount: 1 };
    const methods = { ...partial, methods: [first, second], usedMethodCount: 2, usedPostingCount: 3 };
    const user = userEvent.setup();
    const { rerender } = render(<InsightsMethods methods={methods} onViewMethod={onViewMethod} searchPending />);
    const firstAction = screen.getByRole("button", { name: "Ver 2 movimientos computados de Card (ID 1)" });
    expect(firstAction).toBeDisabled();
    rerender(<InsightsMethods methods={methods} onViewMethod={onViewMethod} />);
    await user.click(firstAction);
    await user.click(screen.getByRole("button", { name: "Ver 1 movimiento computado de Card (ID 2)" }));
    expect(onViewMethod.mock.calls).toEqual([[first.identityKey], [second.identityKey]]);
  });
});
