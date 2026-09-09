import { createRef } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChartInspector } from "./ChartInspector.tsx";
import type { ChartInspectorHandle } from "./ChartInspector.types.ts";

describe("ChartInspector", () => {
  it("offers signed, formatted values by keyboard and an Escape-dismissible pointer tooltip", async () => {
    const user = userEvent.setup();
    const ref = createRef<ChartInspectorHandle>();
    render(<ChartInspector
      formatValue={new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })}
      getValues={(id) => [{ id: "cash", label: "Flujo real", value: id === "jan" ? -10 : 20 }]}
      items={[{ id: "jan", label: "Enero" }, { id: "feb", label: "Febrero" }]}
      ref={ref}
      title="Evolución"
    />);
    await user.click(screen.getByText("Consultar un punto"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Punto de Evolución" }), "feb");
    expect(screen.getByRole("region", { name: "Valores de Evolución" })).toHaveTextContent("20,00");
    act(() => ref.current?.inspect("jan", 20, 20));
    expect(within(screen.getByRole("tooltip")).getByText(/-10,00/)).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
