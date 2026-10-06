import { Icon } from "../../atoms/Icon/Icon.tsx";
import { SegmentedControl } from "../../molecules/SegmentedControl/index.ts";
import { cx } from "../../../utils/component.helpers.ts";
import {
  PERIOD_MODE_OPTIONS,
  periodInputLabel,
  periodInputType,
} from "./PeriodSelector.helpers.ts";
import styles from "./PeriodSelector.module.css";
import type { PeriodSelectorViewProps } from "./PeriodSelector.types.ts";

export function PeriodSelectorView({
  className,
  customMax,
  customMin,
  customDateRange,
  inputMax,
  inputMin,
  inputValue,
  onCustomDateChange,
  onCurrentMonthClick,
  onModeChange,
  onPeriodValueChange,
  periodMode,
  rangeDescription,
  variant = "expanded",
  yearOptions,
}: PeriodSelectorViewProps) {
  return (
    <div className={cx(styles.root, className)} data-variant={variant}>
      <fieldset
        aria-label="Controles del periodo"
        className={styles.modeGroup}
      >
        {variant === "expanded" ? (
          <>
            <span aria-hidden="true" className={styles.modeHeading}>
              Tipo de periodo
            </span>
            <SegmentedControl
              className={styles.modeControl}
              hideLabel
              label="Tipo de periodo"
              onChange={onModeChange}
              options={PERIOD_MODE_OPTIONS}
              value={periodMode}
            />
          </>
        ) : (
          <label className={styles.compactMode}>
            <span>Periodo</span>
            <select
              aria-label="Tipo de periodo"
              onChange={(event) =>
                onModeChange(event.currentTarget.value as typeof periodMode)
              }
              value={periodMode}
            >
              {PERIOD_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          aria-label="Mes actual"
          className={styles.currentMonth}
          onClick={onCurrentMonthClick}
          title="Seleccionar el mes actual"
          type="button"
        >
          <Icon name="calendar" size={16} />
        </button>
      </fieldset>

      {periodMode === "all" ? (
        <p className={styles.allPeriod}>Sin límite de fechas</p>
      ) : periodMode === "custom" ? (
        <div className={styles.customFields}>
          <label className={styles.field}>
            <span>Desde</span>
            <input
              max={customDateRange.to ?? customMax}
              min={customMin}
              onChange={(event) =>
                onCustomDateChange("from", event.currentTarget.value)
              }
              type="date"
              value={customDateRange.from ?? ""}
            />
          </label>
          <span aria-hidden="true" className={styles.separator}>
            →
          </span>
          <label className={styles.field}>
            <span>Hasta</span>
            <input
              max={customMax}
              min={customDateRange.from ?? undefined}
              onChange={(event) =>
                onCustomDateChange("to", event.currentTarget.value)
              }
              type="date"
              value={customDateRange.to ?? ""}
            />
          </label>
        </div>
      ) : periodMode === "year" ? (
        <label className={styles.field}>
          <span>{periodInputLabel(periodMode)}</span>
          <select
            onChange={(event) => onPeriodValueChange(event.currentTarget.value)}
            value={inputValue}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className={styles.field}>
          <span>{periodInputLabel(periodMode)}</span>
          <input
            max={inputMax}
            min={inputMin}
            onChange={(event) => onPeriodValueChange(event.currentTarget.value)}
            required
            type={periodInputType(periodMode)}
            value={inputValue}
          />
        </label>
      )}

      <output aria-live="polite" className={styles.summary}>
        {rangeDescription}
      </output>
    </div>
  );
}
