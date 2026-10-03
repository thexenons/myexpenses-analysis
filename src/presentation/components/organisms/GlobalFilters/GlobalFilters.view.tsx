import { useLayoutEffect, useRef } from "react"
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
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "all", label: "Yo" },
  { value: "debtsOnly", label: "Deudas" },
]

export function GlobalFiltersView({
  activeFilterCount,
  activeSelections,
  filters,
  onOpenDrawer,
  onScopeChange,
  onSearchChange,
}: GlobalFiltersViewProps) {
  const drawerButtonRef = useRef<HTMLButtonElement>(null)
  const selectionsRef = useRef<HTMLUListElement>(null)
  const pendingFocusRef = useRef<{
    origin: HTMLButtonElement
    candidateIds: string[]
  } | null>(null)

  useLayoutEffect(() => {
    const pending = pendingFocusRef.current
    pendingFocusRef.current = null
    if (!pending || pending.origin.isConnected) return
    const document = pending.origin.ownerDocument
    if (document.activeElement !== document.body && document.activeElement !== pending.origin) return

    // Reconciliation can remove several chips in the same update.
    const survivingId = pending.candidateIds.find((id) => activeSelections.some((selection) => selection.id === id))
    const survivingIndex = activeSelections.findIndex((selection) => selection.id === survivingId)
    const destination = survivingIndex < 0
      ? drawerButtonRef.current
      : selectionsRef.current?.querySelectorAll<HTMLButtonElement>("button")[survivingIndex]
    destination?.focus()
  }, [activeSelections])

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
        ref={drawerButtonRef}
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
      {activeSelections.length > 0 ? <ul ref={selectionsRef} aria-label="Filtros aplicados" className={styles.activeSelections}>
        {activeSelections.map((selection, index) => <li key={selection.id}>
          <button type="button" onClick={(event) => {
            if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
              pendingFocusRef.current = {
                origin: event.currentTarget,
                candidateIds: [
                  ...activeSelections.slice(index + 1),
                  ...activeSelections.slice(0, index).reverse(),
                ].map((candidate) => candidate.id),
              }
            }
            selection.onRemove()
          }} aria-label={`Quitar filtro ${selection.label}`}>
            {selection.label} <span aria-hidden="true">×</span>
          </button>
        </li>)}
      </ul> : null}
    </section>
  )
}
