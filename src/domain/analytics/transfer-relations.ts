import type { AnalyticsDataset, NormalizedAccount, NormalizedPosting } from "./types.ts";

interface DatasetIndex {
  readonly accounts: ReadonlyMap<string, NormalizedAccount>;
  readonly postings: ReadonlyMap<string, NormalizedPosting>;
}

const indexes = new WeakMap<AnalyticsDataset, DatasetIndex>();

export interface PostingAccounts {
  readonly originAccount?: NormalizedAccount;
  readonly destinationAccount?: NormalizedAccount;
  readonly peer?: NormalizedPosting;
}

/** Resolves recorded links, never guesses a counterparty from a name or a comment. */
export function resolvePostingAccounts(
  posting: NormalizedPosting,
  dataset: AnalyticsDataset,
): PostingAccounts {
  let index = indexes.get(dataset);
  if (index === undefined) {
    index = {
      accounts: new Map(dataset.accounts.map((account) => [account.id, account])),
      postings: new Map(dataset.postings.map((row) => [row.id, row])),
    };
    indexes.set(dataset, index);
  }
  const candidate = posting.transferPeerPostingId === undefined
    ? undefined
    : index.postings.get(posting.transferPeerPostingId);
  const peer = candidate?.transferPeerPostingId === posting.id ? candidate : undefined;
  const ownAccount = index.accounts.get(posting.accountId);
  const amount = posting.amountNativeMinor;
  // Keep the recorded peer for auditing, but do not invent a payment direction
  // when the two sides have inconsistent signs or identify the same account.
  const peerAccount = peer !== undefined && peer.accountId !== posting.accountId &&
    amount !== 0 && Math.sign(peer.amountNativeMinor) === -Math.sign(amount)
    ? index.accounts.get(peer.accountId)
    : undefined;
  return {
    ...(peer === undefined ? {} : { peer }),
    ...(amount < 0
      ? { originAccount: ownAccount, destinationAccount: peerAccount }
      : amount > 0
        ? { originAccount: peerAccount, destinationAccount: ownAccount }
        : {}),
  };
}
