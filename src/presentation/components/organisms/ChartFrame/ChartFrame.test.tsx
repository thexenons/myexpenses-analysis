import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartFrame } from "./ChartFrame.tsx";

describe("ChartFrame", () => {
  it("replaces the canvas with an explicit empty state", () => {
    render(
      <ChartFrame empty emptyMessage="Sin datos" title="Evolución">
        <span>Gráfico</span>
      </ChartFrame>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Evolución" }),
    ).toBeVisible();
    expect(screen.getByText("Sin datos")).toBeVisible();
    expect(screen.queryByText("Gráfico")).not.toBeInTheDocument();
  });
});
