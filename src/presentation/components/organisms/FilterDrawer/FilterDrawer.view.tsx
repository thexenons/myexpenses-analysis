import type {
  AnalyticsScope,
  LinkedFilter,
  TimeGranularity,
  TransactionStatus,
} from "../../../../domain/analytics/types"
import { Button } from "../../atoms/Button"
import { Icon } from "../../atoms/Icon"
import { IconButton } from "../../atoms/IconButton"
import { SearchField } from "../../molecules/SearchField"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../../molecules/SegmentedControl"
import styles from "./FilterDrawer.module.css"
import type { FilterDrawerViewProps } from "./FilterDrawer.types"

const SCOPE_OPTIONS: readonly SegmentedControlOption<AnalyticsScope>[] = [
  { value: "all", label: "Todas" },
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "debtsOnly", label: "Solo deudas", shortLabel: "Deudas" },
]

const GRANULARITY_OPTIONS: readonly SegmentedControlOption<TimeGranularity>[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana", shortLabel: "Sem." },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
]

const LINKED_OPTIONS: readonly SegmentedControlOption<LinkedFilter>[] = [
  { value: "all", label: "Todos" },
  { value: "linked", label: "Vinculados" },
  { value: "unlinked", label: "Sin vínculo", shortLabel: "Sueltos" },
]

const STATUS_OPTIONS: readonly {
  label: string
  value: TransactionStatus
}[] = [
  { value: "UNRECONCILED", label: "Sin conciliar" },
  { value: "RECONCILED", label: "Conciliadas" },
  { value: "VOID", label: "Anuladas" },
]

export function FilterDrawerView({
  accounts,
  allAccountsSelected,
  allStatusesSelected,
  availableTags,
  closeButtonRef,
  dialogRef,
  filters,
  granularity,
  hasActiveFilters,
  maxDate,
  minDate,
  onAccountToggle,
  onCategoryChange,
  onClose,
  onDateChange,
  onGranularityChange,
  onLinkedChange,
  onReset,
  onScopeChange,
  onSearchChange,
  onStatusToggle,
  onTagToggle,
  rootCategories,
}: FilterDrawerViewProps) {
  const rootCategory = filters.categoryPrefix[0] ?? ""

  return (
    <dialog
      aria-labelledby="filter-drawer-title"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <button
        aria-label="Cerrar filtros al pulsar fuera del panel"
        className={styles.backdropButton}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Control global</span>
            <h2 id="filter-drawer-title">Filtros del análisis</h2>
            <p>Cualquier cambio se aplica a todas las pantallas y métricas.</p>
          </div>
          <IconButton
            className={styles.closeButton}
            icon={<Icon name="close" />}
            label="Cerrar filtros"
            onClick={onClose}
            ref={closeButtonRef}
          />
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span aria-hidden="true">01</span>
              <div>
                <h3>Perspectiva</h3>
                <p>Separa el patrimonio completo, el efectivo real o las deudas.</p>
              </div>
            </div>
            <SegmentedControl
              label="Ámbito de las estadísticas"
              onChange={onScopeChange}
              options={SCOPE_OPTIONS}
              value={filters.scope}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span aria-hidden="true">02</span>
              <div>
                <h3>Periodo</h3>
                <p>Acota las fechas y decide la resolución de las gráficas.</p>
              </div>
            </div>
            <div className={styles.dateFields}>
              <label className={styles.fieldLabel}>
                <span>Desde</span>
                <input
                  max={filters.dateRange.to ?? maxDate ?? undefined}
                  min={minDate ?? undefined}
                  onChange={(event) => onDateChange("from", event.currentTarget.value)}
                  type="date"
                  value={filters.dateRange.from ?? ""}
                />
              </label>
              <label className={styles.fieldLabel}>
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
              label="Agrupar por"
              onChange={onGranularityChange}
              options={GRANULARITY_OPTIONS}
              value={granularity}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span aria-hidden="true">03</span>
              <div>
                <h3>Contenido</h3>
                <p>Busca texto y limita cuentas o categorías concretas.</p>
              </div>
            </div>
            <SearchField
              label="Buscar en movimientos"
              onValueChange={onSearchChange}
              value={filters.search}
            />
            <label className={styles.fieldLabel}>
              <span>Categoría raíz</span>
              <select
                onChange={(event) => onCategoryChange(event.currentTarget.value)}
                value={rootCategory}
              >
                <option value="">Todas las categorías</option>
                {rootCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className={styles.choiceGroup}>
              <legend>Cuentas</legend>
              <p>
                {allAccountsSelected
                  ? "Todas las cuentas incluidas"
                  : `${filters.accountIds.length} de ${accounts.length} cuentas`}
              </p>
              <div className={styles.choiceList}>
                {accounts.map((account) => (
                  <label className={styles.choice} key={account.id}>
                    <input
                      aria-label={`${account.label}, ${account.currency}, ${
                        account.type === "DEBT" ? "Deuda" : "Efectivo"
                      }`}
                      checked={
                        allAccountsSelected || filters.accountIds.includes(account.id)
                      }
                      onChange={() => onAccountToggle(account.id)}
                      type="checkbox"
                    />
                    <span className={styles.choiceCopy}>
                      <strong>{account.label}</strong>
                      <small>
                        {account.currency} · {account.type === "DEBT" ? "Deuda" : "Efectivo"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span aria-hidden="true">04</span>
              <div>
                <h3>Estado y relación</h3>
                <p>Audita conciliaciones, anulaciones y movimientos vinculados.</p>
              </div>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>Estado</legend>
              <p>{allStatusesSelected ? "Todos los estados" : "Selección personalizada"}</p>
              <div className={styles.compactChoices}>
                {STATUS_OPTIONS.map((option) => (
                  <label className={styles.choice} key={option.value}>
                    <input
                      checked={
                        allStatusesSelected || filters.statuses.includes(option.value)
                      }
                      onChange={() => onStatusToggle(option.value)}
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <SegmentedControl
              label="Vínculo con otra cuenta"
              onChange={onLinkedChange}
              options={LINKED_OPTIONS}
              value={filters.linked}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span aria-hidden="true">05</span>
              <div>
                <h3>Etiquetas</h3>
                <p>Una selección incluye movimientos con cualquiera de ellas.</p>
              </div>
            </div>
            {availableTags.length > 0 ? (
              <fieldset className={styles.choiceGroup}>
                <legend>Etiquetas disponibles</legend>
                <p>
                  {filters.tags.length === 0
                    ? "Sin limitar por etiqueta"
                    : `${filters.tags.length} seleccionadas`}
                </p>
                <div className={styles.tagList}>
                  {availableTags.map((tag) => (
                    <label className={styles.tag} key={tag}>
                      <input
                        checked={filters.tags.includes(tag)}
                        onChange={() => onTagToggle(tag)}
                        type="checkbox"
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className={styles.empty}>Esta exportación no contiene etiquetas.</p>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <Button
            disabled={!hasActiveFilters}
            onClick={onReset}
            variant="ghost"
          >
            Restablecer
          </Button>
          <Button onClick={onClose} variant="primary">
            Ver resultados
          </Button>
        </footer>
      </div>
    </dialog>
  )
}
