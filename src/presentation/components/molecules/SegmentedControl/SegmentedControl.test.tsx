import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl.tsx";

it("behaves as an accessible single-choice group", async () => {
  const onChange = vi.fn<(value: string) => void>();
  const user = userEvent.setup();
  render(
    <SegmentedControl
      label="Ámbito"
      onChange={onChange}
      options={[
        { value: "all", label: "Todo" },
        { value: "debt", label: "Deuda" },
      ]}
      value="all"
    />,
  );

  expect(screen.getByRole("group", { name: "Ámbito" })).toBeVisible();
  await user.click(screen.getByRole("radio", { name: "Deuda" }));
  expect(onChange).toHaveBeenCalledWith("debt");
});

it("uses the visible radio label at desktop and mobile widths", () => {
  render(
    <SegmentedControl
      label="Periodo y vínculo"
      onChange={vi.fn<(value: string) => void>()}
      options={[
        { value: "custom", label: "Personalizado", shortLabel: "Rango" },
        { value: "unlinked", label: "Sin vínculo", shortLabel: "Sueltos" },
      ]}
      value="custom"
    />,
  );

  for (const [desktopName, mobileName] of [
    ["Personalizado", "Rango"],
    ["Sin vínculo", "Sueltos"],
  ]) {
    const radio = screen.getByRole("radio", { name: desktopName });
    const label = radio.closest("label");
    const longLabel = label?.querySelector<HTMLElement>("[class*='longLabel']");
    const shortLabel = label?.querySelector<HTMLElement>("[class*='shortLabel']");
    expect(longLabel).not.toBeNull();
    expect(shortLabel).not.toBeNull();
    longLabel!.style.display = "none";
    shortLabel!.style.display = "inline";
    expect(radio).toHaveAccessibleName(mobileName);
  }
});
