import type { TimeSeriesPoint } from "./types.ts";

const FLOW_KEYS = [
  "incomesEurMinor", "expensesEurMinor", "netEurMinor",
  "transfersEurMinor", "realCashFlowEurMinor", "debtFlowEurMinor",
] as const;

/** Accumulate signed minor units; dates, keys and counts remain per-period metadata. */
export function buildCumulativeTimeSeries(points: readonly TimeSeriesPoint[]): readonly TimeSeriesPoint[] | null {
  const totals = { incomesEurMinor: 0, expensesEurMinor: 0, netEurMinor: 0,
    transfersEurMinor: 0, realCashFlowEurMinor: 0, debtFlowEurMinor: 0 };
  const result: TimeSeriesPoint[] = [];
  for (const point of points.toSorted((left, right) => left.startDate.localeCompare(right.startDate))) {
    for (const key of FLOW_KEYS) {
      const value = point[key];
      const next = totals[key] + value;
      if (!Number.isSafeInteger(value) || !Number.isSafeInteger(next)) return null;
      totals[key] = next === 0 ? 0 : next;
    }
    result.push({ ...point, ...totals });
  }
  return result;
}
