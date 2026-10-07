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
    <div className={cx(styles.root, compact && styles.compact, className)}>
      <SegmentedControl
        className={styles.segmented}
        hideLabel={compact}
        label="Granularidad de estadísticas y gráficas"
        onChange={onChange}
        options={GRANULARITY_OPTIONS}
        value={setting}
      />
      {compact ? (
        <select
          aria-label="Granularidad de estadísticas y gráficas"
          className={styles.mobileSelect}
          onChange={(event) => onChange(event.currentTarget.value as typeof setting)}
          value={setting}
        >
          {GRANULARITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.value === "auto" ? option.shortLabel : option.label}
            </option>
          ))}
        </select>
      ) : null}
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
