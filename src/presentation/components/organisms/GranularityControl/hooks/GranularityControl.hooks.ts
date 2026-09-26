import { resolveTimeGranularity } from "../../../../../domain/analytics/date-periods.ts";
import { datasetDateBounds } from "../../../../../domain/analytics/date-bounds.ts";
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts";
import type {
  GranularityControlProps,
  GranularityControlViewProps,
} from "../GranularityControl.types.ts";

export function useGranularityControl({
  className,
  compact = false,
}: GranularityControlProps): GranularityControlViewProps {
  const analytics = useAppStore((state) => state.analytics);
  const dateRange = useAppStore((state) => state.filters.dateRange);
  const dateBasis = useAppStore((state) => state.filters.dateBasis);
  const periodMode = useAppStore((state) => state.filters.periodMode);
  const setting = useAppStore((state) => state.granularity);
  const onChange = useAppStore((state) => state.actions.setGranularity);
  const bounds = analytics === null ? null : datasetDateBounds(analytics, dateBasis);

  return {
    className,
    compact,
    effectiveGranularity: resolveTimeGranularity(
      setting,
      periodMode,
      dateRange,
      bounds?.minDate ?? null,
      bounds?.maxDate ?? null,
    ),
    onChange,
    setting,
  };
}
