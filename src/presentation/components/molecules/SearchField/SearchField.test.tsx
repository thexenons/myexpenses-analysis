import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SearchField } from "./SearchField.tsx";

it("reports typing and exposes an accessible clear action", async () => {
  const onValueChange = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(
    <SearchField label="Buscar" onValueChange={onValueChange} value="" />,
  );

  await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "café");
  expect(onValueChange).toHaveBeenCalled();

  rerender(
    <SearchField label="Buscar" onValueChange={onValueChange} value="café" />,
  );
  await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(onValueChange).toHaveBeenLastCalledWith("");
});
