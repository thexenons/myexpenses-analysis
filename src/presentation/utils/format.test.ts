import { describe, expect, it } from "vitest";

import { euroFormatter, formatCount, formatCurrencyMinor, formatEuroMinor } from "./format.ts";

describe("monetary zero formatting", () => {
  it("omits the negative sign only when the displayed euro amount rounds to zero", () => {
    expect(formatEuroMinor(-0)).toBe("0,00 €");
    expect(euroFormatter.format(-0.004)).toBe("0,00 €");
    expect(euroFormatter.format(-0.005)).toBe("-0,01 €");
    expect(formatEuroMinor(-1)).toBe("-0,01 €");
    expect(formatEuroMinor(1)).toBe("0,01 €");
  });

  it("retains currency precision and real negative amounts", () => {
    expect(formatCurrencyMinor(-0, "JPY", 0)).toBe("0 JPY");
    expect(formatCurrencyMinor(-0.4, "JPY", 0)).toBe("0 JPY");
    expect(formatCurrencyMinor(-1, "JPY", 0)).toBe("-1 JPY");
    expect(formatCurrencyMinor(-0.4, "GBP", 3)).toBe("0,000 GBP");
    expect(formatCurrencyMinor(-1, "GBP", 3)).toBe("-0,001 GBP");
  });
});

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
