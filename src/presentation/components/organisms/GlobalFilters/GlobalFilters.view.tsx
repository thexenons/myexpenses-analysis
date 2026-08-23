import type { AnalyticsScope } from "../../../../domain/analytics/types"
import { Button } from "../../atoms/Button"
import { Icon } from "../../atoms/Icon"
import { SearchField } from "../../molecules/SearchField"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../../molecules/SegmentedControl"
import { GranularityControl } from "../GranularityControl/index.ts"
import { PeriodSelector } from "../PeriodSelector/index.ts"
import styles from "./GlobalFilters.module.css"
import type { GlobalFiltersViewProps } from "./GlobalFilters.types"

const SCOPE_OPTIONS: readonly SegmentedControlOption<AnalyticsScope>[] = [
  { value: "all", label: "Todo" },
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "debtsOnly", label: "Deudas" },
]

export function GlobalFiltersView({
  activeFilterCount,
  filters,
  onOpenDrawer,
  onScopeChange,
  onSearchChange,
}: GlobalFiltersViewProps) {
  return (
    <section aria-label="Filtros globales" className={styles.filters}>
      <div className={styles.filterIdentity}>
        <span className={styles.eyebrow}>Explorar</span>
        <strong>Vista global</strong>
      </div>

      <SearchField
        className={styles.search}
        hideLabel
        label="Buscar en todos los movimientos"
        onValueChange={onSearchChange}
        value={filters.search}
      />

      <SegmentedControl
        className={styles.scope}
        hideLabel
        label="Ámbito de las estadísticas"
        onChange={onScopeChange}
        options={SCOPE_OPTIONS}
        value={filters.scope}
      />

      <PeriodSelector className={styles.period} variant="compact" />

      <GranularityControl className={styles.granularity} compact />

      <Button
        aria-label={
          activeFilterCount === 0
            ? "Abrir todos los filtros"
            : `Abrir todos los filtros, ${activeFilterCount} ${
                activeFilterCount === 1 ? "activo" : "activos"
              }`
        }
        className={styles.drawerButton}
        icon={<Icon name="filter" size={18} />}
        onClick={onOpenDrawer}
        variant={activeFilterCount > 0 ? "primary" : "secondary"}
      >
        <span className={styles.drawerButtonLabel}>Filtros</span>
        {activeFilterCount > 0 ? (
          <span aria-hidden="true" className={styles.filterCount}>
            {activeFilterCount}
          </span>
        ) : null}
      </Button>
    </section>
  )
}
