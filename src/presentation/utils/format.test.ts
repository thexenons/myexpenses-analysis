import { describe, expect, it } from "vitest";

import { formatCount, formatCurrencyMinor } from "./format.ts";

describe("formatCurrencyMinor", () => {
  it("respects zero- and three-decimal currencies", () => {
    expect(formatCurrencyMinor(1_234, "JPY", 0)).toBe("1234 JPY");
    expect(formatCurrencyMinor(1_234, "GBP", 3)).toBe("1,234 GBP");
  });
});

describe("formatCount", () => {
  it("uses the singular only for one and keeps locale number formatting", () => {
    expect(formatCount(0, "apunte", "apuntes")).toBe("0 apuntes");
    expect(formatCount(1, "apunte", "apuntes")).toBe("1 apunte");
    expect(formatCount(2, "apunte", "apuntes")).toBe("2 apuntes");
    expect(formatCount(1_234, "resultado", "resultados")).toBe("1234 resultados");
  });
});
