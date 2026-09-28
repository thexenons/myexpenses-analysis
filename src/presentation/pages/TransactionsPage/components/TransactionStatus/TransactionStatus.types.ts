import type { NormalizedPosting } from "../../../../../domain/analytics/types.ts";

export interface TransactionStatusProps {
  readonly posting: Pick<NormalizedPosting, "status">;
}
