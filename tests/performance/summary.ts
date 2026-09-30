export interface SampleSummary {
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export function summarizeSamples(values: readonly number[]): SampleSummary {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Expected finite non-negative sample timings");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const center = Math.floor(sorted.length / 2);
  return {
    medianMs: sorted.length % 2 === 0 ? (sorted[center - 1]! + sorted[center]!) / 2 : sorted[center]!,
    minMs: sorted[0]!,
    maxMs: sorted.at(-1)!,
  };
}
