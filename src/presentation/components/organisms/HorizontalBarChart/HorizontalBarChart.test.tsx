import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HorizontalBarChart } from "./HorizontalBarChart.tsx";

describe("HorizontalBarChart", () => {
  it("exposes signed bar values in its exact-data table", async () => {
    const user = userEvent.setup();
    render(
      <HorizontalBarChart
        data={[{ id: "food", label: "Alimentación", value: -250 }]}
        labelHeader="Categoría"
        title="Gasto por categoría"
      />,
    );

    await user.click(screen.getByText("Ver datos exactos"));
    expect(
      screen.getByRole("columnheader", { name: "Categoría" }),
    ).toBeVisible();
    expect(screen.getByRole("row", { name: /Alimentación -250/ })).toBeVisible();
  });
});
