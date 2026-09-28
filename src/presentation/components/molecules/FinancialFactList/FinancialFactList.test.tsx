import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinancialFactList } from "./FinancialFactList.tsx";

describe("FinancialFactList", () => {
  it("associates labels with values without changing their content", () => {
    const { container } = render(<FinancialFactList items={[{ id: "inflows", label: "Entradas", value: "12,00 €" }]} />);
    const list = container.querySelector("dl");
    expect(list).not.toBeNull();
    expect(within(list!).getByText("Entradas").tagName).toBe("DT");
    expect(within(list!).getByText("12,00 €").tagName).toBe("DD");
  });
});
