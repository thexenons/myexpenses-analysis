import { SegmentedControl } from "../../molecules/SegmentedControl/index.ts";
import { cx } from "../../../utils/component.helpers.ts";
import {
  GRANULARITY_LABELS,
  GRANULARITY_OPTIONS,
} from "./GranularityControl.helpers.ts";
import styles from "./GranularityControl.module.css";
import type { GranularityControlViewProps } from "./GranularityControl.types.ts";

export function GranularityControlView({
  className,
  compact = false,
  effectiveGranularity,
  onChange,
  setting,
}: GranularityControlViewProps) {
  return (
    <div className={cx(styles.root, className)}>
      <SegmentedControl
        hideLabel={compact}
        label="Granularidad de estadísticas y gráficas"
        onChange={onChange}
        options={GRANULARITY_OPTIONS}
        value={setting}
      />
      {compact ? null : (
        <p aria-live="polite" className={styles.detail}>
          {setting === "auto"
            ? `Resolución automática actual: ${GRANULARITY_LABELS[effectiveGranularity]}.`
            : `Resolución manual: ${GRANULARITY_LABELS[effectiveGranularity]}.`}
        </p>
      )}
    </div>
  );
}
