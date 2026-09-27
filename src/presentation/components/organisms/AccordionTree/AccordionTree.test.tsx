import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccordionTree, AccordionTreeItem } from "./index.ts";

describe("AccordionTree", () => {
  it("keeps disclosure separate from row actions and supports keyboard toggling", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<() => void>();
    render(
      <AccordionTree aria-label="Árbol de prueba">
        <AccordionTreeItem label="Gastos" header={<button onClick={onSelect} type="button">Filtrar Gastos</button>}>
          <AccordionTreeItem label="Comida" header={<span>Comida</span>} />
        </AccordionTreeItem>
      </AccordionTree>,
    );

    const tree = screen.getByRole("list", { name: "Árbol de prueba" });
    const disclosure = within(tree).getByRole("button", { name: "Desplegar Gastos" });
    const childrenId = disclosure.getAttribute("aria-controls");
    expect(childrenId).toBeTruthy();
    expect(document.getElementById(childrenId!)).toHaveAttribute("hidden");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(within(tree).queryByText("Comida")).not.toBeInTheDocument();

    disclosure.focus();
    await user.keyboard("{Enter}");
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(within(tree).getByText("Comida")).toBeVisible();
    expect(within(tree).queryByRole("button", { name: /Comida/ })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(within(tree).getByRole("button", { name: "Filtrar Gastos" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    disclosure.focus();
    await user.keyboard(" ");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(childrenId!)).toHaveAttribute("hidden");
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("uses distinct controlled child-list IDs across independent trees", () => {
    render(
      <>
        {["Uno", "Dos"].map((name) => (
          <AccordionTree aria-label={name} key={name}>
            <AccordionTreeItem label="Gastos" header={<span>Gastos</span>}>
              <AccordionTreeItem label="Comida" header={<span>Comida</span>} />
            </AccordionTreeItem>
          </AccordionTree>
        ))}
      </>,
    );
    const controls = screen.getAllByRole("button", { name: "Desplegar Gastos" })
      .map((button) => button.getAttribute("aria-controls"));
    expect(new Set(controls).size).toBe(2);
    controls.forEach((id) => expect(document.getElementById(id!)).toBeInTheDocument());
  });
});
