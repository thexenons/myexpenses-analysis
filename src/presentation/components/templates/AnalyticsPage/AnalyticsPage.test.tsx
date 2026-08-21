import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AnalyticsPage } from "./AnalyticsPage.tsx";

it("provides the page metadata, heading and content", () => {
  render(
    <AnalyticsPage description="Descripción" title="Resumen">
      Contenido
    </AnalyticsPage>,
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "Resumen" }),
  ).toBeVisible();
  expect(document.title).toBe("Resumen · My Expenses");
  expect(screen.getByText("Descripción")).toBeVisible();
  expect(screen.getByText("Contenido")).toBeVisible();
});
