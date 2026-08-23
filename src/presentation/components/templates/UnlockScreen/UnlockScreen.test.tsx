import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getAxeViolations } from "../../../../../tests/setup/axe.ts";
import { UnlockScreen } from "./UnlockScreen.tsx";

describe("UnlockScreen", () => {
  it("submits the phrase only to the handler and clears the input immediately", async () => {
    const user = userEvent.setup();
    let finish: (() => void) | undefined;
    const onUnlock = vi.fn<(passphrase: string) => Promise<void>>(
      async () =>
        await new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <UnlockScreen
        blockedReason={null}
        error={null}
        onUnlock={onUnlock}
        phase="locked"
      />,
    );
    const input = screen.getByLabelText("Frase de desbloqueo");
    expect(input).toHaveFocus();

    await user.type(input, "frase secreta");
    await user.click(screen.getByRole("button", { name: "Abrir bóveda" }));

    expect(onUnlock).toHaveBeenCalledWith("frase secreta");
    expect(input).toHaveValue("");
    finish?.();
  });

  it("toggles visibility accessibly without storing a controlled value", async () => {
    const user = userEvent.setup();
    render(
      <UnlockScreen
        blockedReason={null}
        error={null}
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="locked"
      />,
    );
    const input = screen.getByLabelText("Frase de desbloqueo");
    const toggle = screen.getByRole("button", { name: "Mostrar frase" });

    expect(input).toHaveAttribute("type", "password");
    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar frase" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("submits an empty phrase only when development mode explicitly allows it", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn<(passphrase: string) => Promise<void>>();
    render(
      <UnlockScreen
        allowEmptyPassphrase
        blockedReason={null}
        error={null}
        onUnlock={onUnlock}
        phase="locked"
      />,
    );

    const input = screen.getByLabelText("Frase de desbloqueo");
    expect(input).not.toBeRequired();
    expect(input).toHaveAccessibleDescription(/puedes dejarla vacía/iu);
    await user.click(screen.getByRole("button", { name: "Abrir bóveda" }));
    expect(onUnlock).toHaveBeenCalledWith("");
  });

  it("renders the same generic unlock error and a pending state", () => {
    const { rerender } = render(
      <UnlockScreen
        blockedReason={null}
        error="No se pudo abrir la bóveda. Comprueba la frase e inténtalo de nuevo."
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="error"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo abrir la bóveda",
    );
    expect(screen.getByLabelText("Frase de desbloqueo")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Frase de desbloqueo")).toHaveAccessibleDescription(
      expect.stringContaining("No se pudo abrir la bóveda"),
    );

    rerender(
      <UnlockScreen
        blockedReason={null}
        error={null}
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="unlocking"
      />,
    );
    expect(screen.getByText("Desbloqueando…")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Desbloqueando la bóveda",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Frase de desbloqueo")).toBeDisabled();
  });

  it("blocks submission in an insecure remote context with an HTTPS explanation", () => {
    render(
      <UnlockScreen
        blockedReason="Esta bóveda necesita HTTPS para usar Web Crypto."
        error={null}
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="locked"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/necesita HTTPS/);
    expect(screen.getByRole("button", { name: "Abrir bóveda" })).toBeDisabled();
    expect(screen.getByLabelText("Frase de desbloqueo")).toBeDisabled();
  });

  it("has no detectable WCAG violations in locked and error states", async () => {
    const { container, rerender } = render(
      <UnlockScreen
        blockedReason={null}
        error={null}
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="locked"
      />,
    );
    expect(await getAxeViolations(container)).toEqual([]);

    rerender(
      <UnlockScreen
        blockedReason={null}
        error="No se pudo abrir la bóveda. Comprueba la frase e inténtalo de nuevo."
        onUnlock={vi.fn<(passphrase: string) => Promise<void>>()}
        phase="error"
      />,
    );
    expect(await getAxeViolations(container)).toEqual([]);
  });
});
