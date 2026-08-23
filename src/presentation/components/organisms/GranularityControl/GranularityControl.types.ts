import type {
  TimeGranularity,
  TimeGranularitySetting,
} from "../../../../domain/analytics/types.ts";

export interface GranularityControlProps {
  readonly className?: string;
  readonly compact?: boolean;
}

export interface GranularityControlViewProps extends GranularityControlProps {
  readonly effectiveGranularity: TimeGranularity;
  readonly onChange: (setting: TimeGranularitySetting) => void;
  readonly setting: TimeGranularitySetting;
}
