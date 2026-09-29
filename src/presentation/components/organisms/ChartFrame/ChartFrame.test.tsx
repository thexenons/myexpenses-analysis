import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartFrame } from "./ChartFrame.tsx";

describe("ChartFrame", () => {
  it("adds a named keyboard entry only for an overflowing canvas", () => {
    const { rerender } = render(<ChartFrame empty={false} emptyMessage="Sin datos" scrollable title="Evolución"><span>Gráfico</span></ChartFrame>);
    const region = screen.getByRole("region", { name: "Gráfico desplazable: Evolución" });
    expect(region).toHaveAttribute("tabindex", "0");
    region.focus();
    expect(region).toHaveFocus();
    rerender(<ChartFrame empty={false} emptyMessage="Sin datos" title="Evolución"><span>Gráfico</span></ChartFrame>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByText("Gráfico").parentElement).not.toHaveAttribute("tabindex");
  });

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
