import type {
  AnalyticsScope,
  TimeGranularity,
} from "../../../../domain/analytics/types"
import { Button } from "../../atoms/Button"
import { Icon } from "../../atoms/Icon"
import { SearchField } from "../../molecules/SearchField"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../../molecules/SegmentedControl"
import styles from "./GlobalFilters.module.css"
import type { GlobalFiltersViewProps } from "./GlobalFilters.types"

const SCOPE_OPTIONS: readonly SegmentedControlOption<AnalyticsScope>[] = [
  { value: "all", label: "Todo" },
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "debtsOnly", label: "Deudas" },
]

const GRANULARITY_OPTIONS: readonly SegmentedControlOption<TimeGranularity>[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana", shortLabel: "Sem." },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
]

export function GlobalFiltersView({
  activeFilterCount,
  filters,
  granularity,
  maxDate,
  minDate,
  onDateChange,
  onGranularityChange,
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

      <div className={styles.dateRange}>
        <Icon className={styles.calendarIcon} name="calendar" size={17} />
        <label>
          <span>Desde</span>
          <input
            max={filters.dateRange.to ?? maxDate ?? undefined}
            min={minDate ?? undefined}
            onChange={(event) => onDateChange("from", event.currentTarget.value)}
            type="date"
            value={filters.dateRange.from ?? ""}
          />
        </label>
        <span aria-hidden="true" className={styles.dateSeparator}>
          →
        </span>
        <label>
          <span>Hasta</span>
          <input
            max={maxDate ?? undefined}
            min={filters.dateRange.from ?? minDate ?? undefined}
            onChange={(event) => onDateChange("to", event.currentTarget.value)}
            type="date"
            value={filters.dateRange.to ?? ""}
          />
        </label>
      </div>

      <SegmentedControl
        className={styles.granularity}
        hideLabel
        label="Agrupar estadísticas por periodo"
        onChange={onGranularityChange}
        options={GRANULARITY_OPTIONS}
        value={granularity}
      />

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
