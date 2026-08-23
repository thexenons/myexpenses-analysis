import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { INSIGHTS_PAGE_PROPS } from "../../InsightsPage.test.helpers.ts";
import { InsightsAccounts } from "./InsightsAccounts.tsx";

describe("InsightsAccounts", () => {
  it("renders native composition, visibility and truncated provenance", () => {
    render(
      <InsightsAccounts
        accountBars={INSIGHTS_PAGE_PROPS.accountBars}
        insights={INSIGHTS_PAGE_PROPS.insights}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Composición de cuentas" }),
    ).toBeVisible();
    expect(screen.getByText("Visibilidad del inventario")).toBeVisible();
    expect(screen.getByText("aaaaaaaa…aaaaaa")).toBeVisible();
    expect(screen.getByText("Europe/Madrid")).toBeVisible();
  });
});
