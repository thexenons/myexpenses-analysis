import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppState } from "./AppState.tsx";

describe("AppState", () => {
  it("announces the loading state", () => {
    render(<AppState state="loading" />);

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { name: /ordenando/i })).toBeVisible();
  });

  it("lets the user retry after an error", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<AppState message="Sin datos" onRetry={onRetry} state="error" />);

    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "No pudimos abrir los datos" }),
    ).toBeVisible();
    expect(within(alert).getByText("Sin datos")).toBeVisible();
    expect(screen.getByText("Sin datos")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /volver a intentarlo/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
