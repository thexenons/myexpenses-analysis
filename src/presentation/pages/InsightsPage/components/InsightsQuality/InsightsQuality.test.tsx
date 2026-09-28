import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "../../InsightsPage.test.helpers.ts";
import { InsightsQuality } from "./InsightsQuality.tsx";

describe("InsightsQuality", () => {
  it("renders effective value-date coverage, exact lags and sparse methods", async () => {
    const user = userEvent.setup();
    render(
      <InsightsQuality
        lagBars={INSIGHTS_PAGE_PROPS.lagBars}
        paymentMethods={INSIGHTS_PAGE_PROPS.insights.paymentMethods}
        valueDates={INSIGHTS_PAGE_PROPS.insights.valueDates}
      />,
    );

    expect(screen.getByText("Operación frente a fecha valor")).toBeVisible();
    expect(screen.getByText("Métodos de pago")).toBeVisible();
    await user.click(screen.getByText("Ver desfases exactos"));
    expect(
      screen.getByRole("table", {
        name: "Distribución exacta del desfase de fecha valor",
      }),
    ).toBeVisible();
  });

  it("omits the method block when no active posting uses one", () => {
    render(
      <InsightsQuality
        lagBars={INSIGHTS_PAGE_PROPS.lagBars}
        paymentMethods={{
          ...INSIGHTS_PAGE_PROPS.insights.paymentMethods,
          methods: [],
          usedMethodCount: 0,
          usedPostingCount: 0,
        }}
        valueDates={INSIGHTS_PAGE_PROPS.insights.valueDates}
      />,
    );

    expect(screen.queryByText("Métodos de pago")).not.toBeInTheDocument();
  });

  it("keeps same-label method actions separate and pauses navigation during deferred search", async () => {
    const onViewMethod = vi.fn<(identityKey: string) => void>();
    const first = { identityKey: '["source",1]', name: "Card", netEurMinor: -100, postingCount: 2 };
    const second = { identityKey: '["source",2]', name: "Card", netEurMinor: -200, postingCount: 1 };
    const props = { lagBars: INSIGHTS_PAGE_PROPS.lagBars, paymentMethods: { ...INSIGHTS_PAGE_PROPS.insights.paymentMethods, methods: [first, second] }, valueDates: INSIGHTS_PAGE_PROPS.insights.valueDates };
    const user = userEvent.setup();
    const { rerender } = render(<InsightsQuality {...props} onViewMethod={onViewMethod} searchPending />);
    const firstAction = screen.getByRole("button", { name: "Ver 2 movimientos computados de Card (ID 1)" });
    expect(firstAction).toBeDisabled();
    rerender(<InsightsQuality {...props} onViewMethod={onViewMethod} />);
    await user.click(firstAction);
    await user.click(screen.getByRole("button", { name: "Ver 1 movimiento computado de Card (ID 2)" }));
    expect(onViewMethod.mock.calls).toEqual([[first.identityKey], [second.identityKey]]);
  });
});
