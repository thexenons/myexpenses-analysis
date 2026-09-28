import { describe, expect, it } from "vitest";

import { createDefaultFilterState } from "../../../domain/analytics/filters.ts";
import { createIdentityDrilldownPatch } from "./InsightsPage.helpers.ts";

describe("createIdentityDrilldownPatch", () => {
  it("targets one exact identity and excludes VOID without broadening current statuses", () => {
    const filters = { ...createDefaultFilterState(), statuses: ["RECONCILED", "VOID"] as const, accountIds: ["cash"], payeeKeys: ['["source",2]'], paymentMethodKeys: ['["source",1]'] };
    expect(createIdentityDrilldownPatch(filters, "payee", '["source",1]')).toEqual({
      payeeKeys: ['["source",1]'], statuses: ["RECONCILED"],
    });
    expect(createIdentityDrilldownPatch(filters, "method", '["legacy","Card"]')).toEqual({
      paymentMethodKeys: ['["legacy","Card"]'], statuses: ["RECONCILED"],
    });
    expect(filters.accountIds).toEqual(["cash"]);
    expect(createIdentityDrilldownPatch(createDefaultFilterState(), "payee", '["missing"]').statuses)
      .toEqual(["UNRECONCILED", "CLEARED", "RECONCILED"]);
  });
});
