import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoutePending } from "./RoutePending.tsx";

describe("RoutePending", () => {
  it("announces a pending route without exposing decorative motion", () => {
    render(<RoutePending />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando sección…")).toBeVisible();
  });
});
