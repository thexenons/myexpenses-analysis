import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { InformationDisclosure } from "./InformationDisclosure.tsx";

it("keeps explanatory content behind an initially closed native disclosure", async () => {
  const user = userEvent.setup();
  render(<InformationDisclosure label="Información del análisis"><p>Detalle del método</p></InformationDisclosure>);

  const summary = screen.getByText("Información del análisis");
  const disclosure = summary.closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  expect(screen.getByText("Detalle del método")).toBeInTheDocument();

  await user.click(summary);
  expect(disclosure).toHaveAttribute("open");
  expect(summary).toHaveFocus();
  await user.click(summary);
  expect(disclosure).not.toHaveAttribute("open");
});
