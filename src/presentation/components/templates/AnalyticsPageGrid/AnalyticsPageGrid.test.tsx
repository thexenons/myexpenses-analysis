import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AnalyticsPageGrid } from "./AnalyticsPageGrid.tsx";

it("renders a composable analytical grid", () => {
  render(
    <AnalyticsPageGrid data-testid="grid" variant="two">
      Contenido
    </AnalyticsPageGrid>,
  );

  expect(screen.getByTestId("grid")).toHaveTextContent("Contenido");
});
