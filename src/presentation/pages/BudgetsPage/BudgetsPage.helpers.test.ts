import { describe, expect, it } from "vitest";

import { budgetAmountFormatter, formatBudgetMinor } from "./BudgetsPage.helpers.ts";

describe("budget monetary formatting", () => {
  it("omits negative rounded zero without changing negative consumption", () => {
    expect(formatBudgetMinor(-0, "EUR", 2)).toBe("0,00 €");
    expect(budgetAmountFormatter("EUR", 2).format(-0.004)).toBe("0,00 €");
    expect(budgetAmountFormatter("EUR", 2).format(-0.005)).toBe("-0,01 €");
    expect(formatBudgetMinor(-1, "EUR", 2)).toBe("-0,01 €");
  });

  it("preserves zero- and three-decimal budget precision", () => {
    expect(formatBudgetMinor(-0.4, "JPY", 0)).toBe("0 JPY");
    expect(formatBudgetMinor(-1, "JPY", 0)).toBe("-1 JPY");
    expect(formatBudgetMinor(-0.4, "GBP", 3)).toBe("0,000 GBP");
    expect(formatBudgetMinor(-1, "GBP", 3)).toBe("-0,001 GBP");
  });
});
