import { resolvePostingAccounts } from "../../../../../domain/analytics/transfer-relations.ts";
import type { AnalyticsDataset, NormalizedPosting } from "../../../../../domain/analytics/types.ts";

/** The original account and recorded split parent identify a purchase, not its date or payee. */
export function relatedTransactionPostings(posting: NormalizedPosting, dataset: AnalyticsDataset): readonly NormalizedPosting[] {
  const peer = resolvePostingAccounts(posting, dataset).peer;
  const split = posting.splitIndex !== null ? posting : peer?.splitIndex !== null ? peer : undefined;
  const related = new Map<string, NormalizedPosting>();
  if (peer !== undefined) related.set(peer.id, peer);
  if (split !== undefined) {
    for (const candidate of dataset.postings) {
      if (candidate.accountId !== split.accountId || candidate.splitIndex === null) continue;
      const sameParent = split.splitParentPostingId !== undefined
        ? candidate.splitParentPostingId === split.splitParentPostingId
        : candidate.sourceTransactionId === split.sourceTransactionId;
      if (sameParent) related.set(candidate.id, candidate);
    }
  }
  related.delete(posting.id);
  return [...related.values()];
}
