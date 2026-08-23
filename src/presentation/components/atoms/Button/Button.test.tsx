import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Button } from "./Button.tsx";

it("renders a safe button and forwards interaction", async () => {
  const onClick = vi.fn<() => void>();
  const user = userEvent.setup();
  render(<Button onClick={onClick}>Aplicar</Button>);

  const button = screen.getByRole("button", { name: "Aplicar" });
  expect(button).toHaveAttribute("type", "button");
  await user.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});
