import type {
  AnalyticsScope,
  LinkedFilter,
  TransactionStatus,
} from "../../../../domain/analytics/types"
import { categoryPathsEqual } from "../../../../domain/analytics/filters.ts"
import { Button } from "../../atoms/Button"
import { Icon } from "../../atoms/Icon"
import { IconButton } from "../../atoms/IconButton"
import { SearchField } from "../../molecules/SearchField"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "../../molecules/SegmentedControl"
import { GranularityControl } from "../GranularityControl/index.ts"
import { PeriodSelector } from "../PeriodSelector/index.ts"
import styles from "./FilterDrawer.module.css"
import type { FilterDrawerViewProps } from "./FilterDrawer.types"

const SCOPE_OPTIONS: readonly SegmentedControlOption<AnalyticsScope>[] = [
  { value: "all", label: "Todas" },
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "debtsOnly", label: "Solo deudas", shortLabel: "Deudas" },
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
  { value: "CLEARED", label: "Compensadas" },
  { value: "RECONCILED", label: "Conciliadas" },
  { value: "VOID", label: "Anuladas" },
]

export function FilterDrawerView({
  accounts,
  endpointAccounts,
  categoryPaths,
  allAccountsSelected,
  allStatusesSelected,
  availableTags,
  closeButtonRef,
  dialogRef,
  filters,
  hasActiveFilters,
  onAccountToggle,
  onOriginToggle,
  onDestinationToggle,
  onDateBasisChange,
  onCategoryMatchChange,
  onCategoryDepthChange,
  onCategoryToggle,
  onClose,
  onLinkedChange,
  onReset,
  onScopeChange,
  onSearchChange,
  onStatusToggle,
  onTagToggle,
  rootCategories,
}: FilterDrawerViewProps) {
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
            <p>Filtros compartidos por todas las pantallas. Los saldos mantienen el historial completo de las cuentas hasta la fecha final.</p>
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
                <p>Acota las fechas sin limitar la resolución de las gráficas.</p>
              </div>
            </div>
            <PeriodSelector />
            <GranularityControl />
            <SegmentedControl
              label="Fecha utilizada"
              onChange={onDateBasisChange}
              options={[{ value: "operation", label: "Operación" }, { value: "value", label: "Valor" }]}
              value={filters.dateBasis ?? "operation"}
            />
            <p>Si un movimiento no tiene fecha valor, se utiliza su fecha de operación.</p>
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
            <fieldset className={styles.choiceGroup}>
              <legend>Categorías raíz</legend>
              <p>
                {filters.categoryPrefixes.length === 0
                  ? "Todas las categorías incluidas"
                  : `${filters.categoryPrefixes.length} rutas seleccionadas`}
              </p>
              <div className={styles.compactChoices}>
                {rootCategories.map((category) => (
                  <label className={styles.choice} key={category}>
                    <input
                      checked={filters.categoryPrefixes.some((path) =>
                        categoryPathsEqual(path, [category]),
                      )}
                      onChange={() => onCategoryToggle([category])}
                      type="checkbox"
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
              <label className={styles.pathSelector}>
                Añadir categoría o subcategoría
                <select
                  value=""
                  onChange={(event) => {
                    const path = categoryPaths.find((candidate) => JSON.stringify(candidate) === event.target.value)
                    if (path !== undefined) onCategoryToggle(path)
                  }}
                >
                  <option value="">Selecciona una ruta…</option>
                  {categoryPaths.filter((path) => !filters.categoryPrefixes.some((selected) => categoryPathsEqual(selected, path))).map((path) => (
                    <option key={JSON.stringify(path)} value={JSON.stringify(path)}>{path.join(" › ")}</option>
                  ))}
                </select>
              </label>
              <SegmentedControl
                label="Nivel de categoría"
                onChange={onCategoryDepthChange}
                options={[{ value: "subtree", label: "Con subcategorías" }, { value: "exact", label: "Solo ruta exacta" }]}
                value={filters.categoryDepth ?? "subtree"}
              />
              <label className={styles.choice}>
                <input type="checkbox" checked={filters.categoryMatch === "either"} onChange={(event) => onCategoryMatchChange(event.target.checked ? "either" : "posting")} />
                <span>También buscar la categoría en la contrapartida vinculada</span>
              </label>
              {filters.categoryPrefixes.length > 0 ? (
                <ul
                  aria-label="Rutas de categoría seleccionadas"
                  className={styles.selectedCategories}
                >
                  {filters.categoryPrefixes.map((path) => (
                    <li key={JSON.stringify(path)}>
                      <button
                        aria-label={`Quitar ${path.join(" › ")}`}
                        onClick={() => onCategoryToggle(path)}
                        type="button"
                      >
                        <span>{path.join(" › ")}</span>
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </fieldset>

            <fieldset className={styles.choiceGroup}>
              <legend>Cuentas</legend>
              <p>
                {allAccountsSelected
                  ? "Todas las cuentas incluidas"
                  : `${filters.accountIds.length} de ${accounts.length} cuentas`}
              </p>
              <p>Selecciona al menos una cuenta. Origen y destino se filtran por separado.</p>
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
                      disabled={(allAccountsSelected ? accounts.length : filters.accountIds.length) === 1 && (allAccountsSelected || filters.accountIds.includes(account.id))}
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
            <p>Origen y destino se combinan entre sí y con las cuentas del ámbito. Sin selección no limitan los resultados; una contrapartida solo se identifica si existe un vínculo verificable.</p>
            {([
              { label: "Cuenta de origen", ids: filters.originAccountIds ?? [], onToggle: onOriginToggle },
              { label: "Cuenta de destino", ids: filters.destinationAccountIds ?? [], onToggle: onDestinationToggle },
            ] as const).map(({ label, ids, onToggle }) => (
              <fieldset className={styles.choiceGroup} key={label}>
                <legend>{label}</legend>
                <p>{ids.length === 0 ? "Sin limitar" : `${ids.length} seleccionadas`}</p>
                <div className={styles.choiceList}>
                  {endpointAccounts.map((account) => (
                    <label className={styles.choice} key={account.id}>
                      <input type="checkbox" checked={ids.includes(account.id)} onChange={() => onToggle(account.id)} aria-label={`${label}: ${account.label}, ${account.currency}`} />
                      <span className={styles.choiceCopy}><strong>{account.label}</strong><small>{account.currency} · {account.type === "DEBT" ? "Deuda" : "Efectivo"}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
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
                      disabled={filters.statuses.length === 1 && filters.statuses.includes(option.value)}
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
