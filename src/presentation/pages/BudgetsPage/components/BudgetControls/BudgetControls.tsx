import styles from "./BudgetControls.module.css";
import type { BudgetControlsProps } from "./BudgetControls.types.ts";

export function BudgetControls({
  budgets,
  onBudgetChange,
  onPeriodChange,
  periods,
  selectedBudgetUuid,
  selectedPeriodKey,
}: BudgetControlsProps) {
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>Marco del presupuesto</legend>
      <label className={styles.field}>
        <span className={styles.label}>Presupuesto</span>
        <select
          className={styles.select}
          disabled={budgets.length < 2}
          onChange={(event) => onBudgetChange(event.currentTarget.value)}
          value={selectedBudgetUuid}
        >
          {budgets.map((budget) => (
            <option key={budget.value} value={budget.value}>
              {budget.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Periodo</span>
        <select
          className={styles.select}
          disabled={periods.length < 2}
          onChange={(event) => onPeriodChange(event.currentTarget.value)}
          value={selectedPeriodKey}
        >
          {periods.length === 0 ? (
            <option value="">Sin periodo seguro</option>
          ) : (
            periods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))
          )}
        </select>
      </label>
    </fieldset>
  );
}
