import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl.tsx";

it("behaves as an accessible single-choice group", async () => {
  const onChange = vi.fn();
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
