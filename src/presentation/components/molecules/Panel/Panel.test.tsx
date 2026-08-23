import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./Panel.tsx";

describe("Panel", () => {
  it("composes a labelled region with heading, body and footer", () => {
    render(
      <Panel
        actions={<button type="button">Ver detalle</button>}
        description="Resumen del periodo"
        footer="Datos convertidos a EUR"
        title="Balance"
      >
        78.755,61 €
      </Panel>,
    );

    expect(screen.getByRole("region", { name: "Balance" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Balance", level: 2 }),
    ).toBeVisible();
    expect(screen.getByText("78.755,61 €")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ver detalle" })).toBeVisible();
    expect(screen.getByText("Datos convertidos a EUR")).toBeVisible();
  });

  it("preserves an explicit accessible label when a visual title exists", () => {
    render(
      <Panel aria-label="Balance consolidado" title="Balance">
        Contenido
      </Panel>,
    );

    expect(
      screen.getByRole("region", { name: "Balance consolidado" }),
    ).toBeVisible();
  });
});
