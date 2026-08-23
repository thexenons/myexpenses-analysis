import { describe, expect, it } from "vitest";

import { formatCurrencyMinor } from "./format.ts";

describe("formatCurrencyMinor", () => {
  it("respects zero- and three-decimal currencies", () => {
    expect(formatCurrencyMinor(1_234, "JPY", 0)).toBe("1234 JPY");
    expect(formatCurrencyMinor(1_234, "GBP", 3)).toBe("1,234 GBP");
  });
});
