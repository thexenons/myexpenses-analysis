import type { NormalizedPosting } from "./types.ts";

/** Tagged JSON keys keep source IDs, legacy labels and missing values disjoint. */
export type PostingIdentityKey = string;

function identityKey(sourceId: number | null | undefined, label: string | undefined): PostingIdentityKey {
  if (sourceId !== undefined && sourceId !== null) return JSON.stringify(["source", sourceId]);
  if (label !== undefined && label !== "") return JSON.stringify(["legacy", label]);
  return JSON.stringify(["missing"]);
}

export function payeeIdentityKey(posting: NormalizedPosting): PostingIdentityKey {
  return identityKey(posting.payeeSourceId, posting.payee);
}

export function paymentMethodIdentityKey(posting: NormalizedPosting): PostingIdentityKey {
  return identityKey(posting.paymentMethodSourceId, posting.paymentMethod);
}

export function isPostingIdentityKey(value: unknown): value is PostingIdentityKey {
  if (typeof value !== "string") return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    if (parsed.length === 1 && parsed[0] === "missing") return value === '["missing"]';
    if (parsed.length !== 2) return false;
    if (parsed[0] === "source") {
      return Number.isSafeInteger(parsed[1]) && parsed[1] >= 0 && value === JSON.stringify(parsed);
    }
    return parsed[0] === "legacy" && typeof parsed[1] === "string" && parsed[1].length > 0 && value === JSON.stringify(parsed);
  } catch {
    return false;
  }
}
