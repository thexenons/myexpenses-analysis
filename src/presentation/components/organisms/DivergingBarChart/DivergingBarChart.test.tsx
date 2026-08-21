import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DivergingBarChart } from "./DivergingBarChart.tsx";

describe("DivergingBarChart", () => {
  it("labels both sides in the exact-data alternative", async () => {
    const user = userEvent.setup();
    render(
      <DivergingBarChart
        data={[{ id: "jan", label: "Enero", leftValue: 80, rightValue: 120 }]}
        leftLabel="Gastos"
        rightLabel="Ingresos"
        title="Entradas y salidas"
      />,
    );

    await user.click(screen.getByText("Ver datos exactos"));
    expect(screen.getByRole("columnheader", { name: "Gastos" })).toBeVisible();
    expect(screen.getByRole("row", { name: /Enero 80 120/ })).toBeVisible();
  });
});
