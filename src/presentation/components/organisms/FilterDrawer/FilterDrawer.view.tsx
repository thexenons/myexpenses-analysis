import type {
  AnalyticsScope,
  CategoryType,
  LinkedFilter,
} from "../../../../domain/analytics/types"
import { useCallback, useRef, useState } from "react"
import { formatCategoryPath } from "../../../utils/format.ts"
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
import { CategoryFilterTree } from "./components/CategoryFilterTree/index.ts"

const SCOPE_OPTIONS: readonly SegmentedControlOption<AnalyticsScope>[] = [
  { value: "realCashFlow", label: "Flujo real", shortLabel: "Real" },
  { value: "all", label: "Yo" },
  { value: "debtsOnly", label: "Solo deudas", shortLabel: "Deudas" },
]

const LINKED_OPTIONS: readonly SegmentedControlOption<LinkedFilter>[] = [
  { value: "all", label: "Todos" },
  { value: "linked", label: "Vinculados" },
  { value: "unlinked", label: "Sin vínculo", shortLabel: "Sueltos" },
]

const CATEGORY_TYPE_OPTIONS: readonly { value: CategoryType; label: string }[] = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "NEUTRAL", label: "Neutral" },
]

export function FilterDrawerView({
  accounts,
  endpointAccounts,
  categoryPaths,
  allAccountsSelected,
  availableTags,
  payeeOptions,
  methodOptions,
  availableCurrencies,
  amountMinInput,
  amountMaxInput,
  amountError,
  closeButtonRef,
  dialogRef,
  filterPresets, presetError, presetBusy, onPresetSave, onPresetApply, onPresetDelete,
  filters,
  hasActiveFilters,
  onAccountToggle,
  onAccountModeChange,
  onOriginToggle,
  onDestinationToggle,
  onDateBasisChange,
  onCategoryMatchChange,
  onCategoryDepthChange,
  onCategoryModeChange,
  onCategoryToggle,
  onClose,
  onLinkedChange,
  onReset,
  onScopeChange,
  onSearchChange,
  onTagToggle,
  onTagModeChange,
  onPayeeToggle,
  onMethodToggle,
  onCategoryTypeToggle,
  onCurrencyToggle,
  onAmountInput,
  onCommentSearchChange,
  onReferenceSearchChange,
}: FilterDrawerViewProps) {
  const [presetName, setPresetName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState("")
  const [presetNotice, setPresetNotice] = useState("")
  const [confirmation, setConfirmation] = useState<{ kind: "overwrite" | "delete"; name: string } | null>(null)
  const presetSelectorRef = useRef<HTMLSelectElement>(null)
  const confirmationOriginRef = useRef<HTMLButtonElement | null>(null)
  const focusConfirmationCancel = useCallback((element: HTMLButtonElement | null) => { element?.focus() }, [])
  const selectedPresetExists = filterPresets.some((preset) => preset.name === selectedPreset)
  const savePreset = async () => {
    setPresetNotice("")
    if (await onPresetSave(presetName)) {
      setSelectedPreset(presetName.trim())
      setPresetNotice("Filtro guardado en este navegador.")
    }
  }
  const confirmPreset = async () => {
    if (confirmation === null) return
    const origin = document.activeElement
    setPresetNotice("")
    const succeeded = confirmation.kind === "overwrite"
      ? await onPresetSave(confirmation.name, true)
      : await onPresetDelete(confirmation.name)
    if (!succeeded) return
    setPresetNotice(confirmation.kind === "overwrite" ? "Filtro sobrescrito." : "Filtro eliminado.")
    setConfirmation(null)
    if (document.activeElement === origin) presetSelectorRef.current?.focus()
  }
  const categoryTreeRef = useRef<HTMLElement>(null)
  const [payeeQuery, setPayeeQuery] = useState("")
  const [methodQuery, setMethodQuery] = useState("")
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
          <details className={styles.additionalCriteria}>
            <summary>Filtros guardados</summary>
            <p id="filter-presets-help">Solo en este navegador. Guardan todos los criterios, búsquedas y resolución; aplicar sustituye los filtros actuales. Máximo 20 nombres de 80 caracteres y 64 KiB en total.</p>
            <div className={styles.presetBody}>
              <form className={styles.presetForm} onSubmit={(event) => { event.preventDefault(); void savePreset() }}>
                <label className={styles.presetLabel}>Nombre del filtro
                  <input aria-describedby="filter-presets-help filter-presets-status" disabled={presetBusy} onChange={(event) => setPresetName(event.currentTarget.value)} value={presetName} />
                </label>
                <Button disabled={presetBusy} type="submit" variant="secondary">Guardar filtro actual</Button>
              </form>
              <label className={styles.presetLabel}>Filtro guardado
                <select aria-describedby="filter-presets-help" disabled={presetBusy} onChange={(event) => { setSelectedPreset(event.currentTarget.value); setConfirmation(null) }} ref={presetSelectorRef} value={selectedPresetExists ? selectedPreset : ""}>
                  <option value="">Seleccionar filtro…</option>
                  {filterPresets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
                </select>
              </label>
              <div className={styles.presetActions}>
                <Button disabled={presetBusy || !selectedPresetExists} onClick={async () => {
                  setPresetNotice("")
                  if (await onPresetApply(selectedPreset)) setPresetNotice("Filtro aplicado; los criterios no disponibles se han reconciliado con los datos cargados.")
                }} variant="secondary">Aplicar filtro guardado</Button>
                <Button disabled={presetBusy || !selectedPresetExists} onClick={(event) => {
                  confirmationOriginRef.current = event.currentTarget
                  setConfirmation({ kind: "overwrite", name: selectedPreset })
                }} variant="ghost">Sobrescribir filtro guardado</Button>
                <Button disabled={presetBusy || !selectedPresetExists} onClick={(event) => {
                  confirmationOriginRef.current = event.currentTarget
                  setConfirmation({ kind: "delete", name: selectedPreset })
                }} variant="ghost">Eliminar filtro guardado</Button>
              </div>
              {confirmation ? <fieldset className={styles.presetConfirmation}>
                <legend>{confirmation.kind === "overwrite" ? "¿Sobrescribir" : "¿Eliminar"} «{confirmation.name}»?</legend>
                <p>{confirmation.kind === "overwrite" ? "Sustituirá la copia guardada por los filtros actuales." : "Se eliminará únicamente esta copia local."}</p>
                <div className={styles.presetActions}>
                  <Button disabled={presetBusy} onClick={() => void confirmPreset()} variant="secondary">{confirmation.kind === "overwrite" ? "Confirmar sobrescritura" : "Confirmar eliminación"}</Button>
                  <Button disabled={presetBusy} onClick={() => { setConfirmation(null); confirmationOriginRef.current?.focus() }} ref={focusConfirmationCancel} variant="ghost">Cancelar</Button>
                </div>
              </fieldset> : null}
              <p className={presetError ? styles.amountError : undefined}><output aria-live={presetError ? "assertive" : "polite"} id="filter-presets-status">{presetError ?? presetNotice}</output></p>
            </div>
          </details>
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
              <legend>Categorías</legend>
              <p>
                {filters.categoryPrefixes.length === 0
                  ? "Todas las categorías incluidas"
                  : filters.categoryMode === "exclude"
                    ? `${filters.categoryPrefixes.length} ${filters.categoryPrefixes.length === 1 ? "ruta excluida" : "rutas excluidas"}`
                    : `${filters.categoryPrefixes.length} rutas seleccionadas`}
              </p>
              <label className={styles.pathSelector}>
                Modo de categorías
                <select aria-describedby="category-mode-help" value={filters.categoryMode ?? "include"} onChange={(event) => onCategoryModeChange(event.target.value === "exclude" ? "exclude" : "include")}>
                  <option value="include">Incluir seleccionadas</option>
                  <option value="exclude">Excluir seleccionadas</option>
                </select>
              </label>
              <p id="category-mode-help">Sin selección no se limita por categoría. Excluir conserva las demás; cada botón indica solo su selección explícita.</p>
              <p>Con subcategorías, una ruta seleccionada abarca sus descendientes. Desplegar no selecciona.</p>
              <CategoryFilterTree paths={categoryPaths} selectedPaths={filters.categoryPrefixes}
                onToggle={onCategoryToggle} focusRef={categoryTreeRef} />
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
                        aria-label={`Quitar ${filters.categoryMode === "exclude" ? "exclusión " : ""}${formatCategoryPath(path)}`}
                        onClick={(event) => {
                          if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
                            const item = event.currentTarget.parentElement
                            const destination = item?.nextElementSibling?.querySelector<HTMLButtonElement>("button")
                              ?? item?.previousElementSibling?.querySelector<HTMLButtonElement>("button")
                              ?? categoryTreeRef.current
                            destination?.focus()
                          }
                          onCategoryToggle(path)
                        }}
                        type="button"
                      >
                        <span>{filters.categoryMode === "exclude" ? "Excluir: " : ""}{formatCategoryPath(path)}</span>
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
                {filters.accountIds.length === 0
                  ? "Todas las cuentas del ámbito incluidas"
                  : filters.accountMode === "exclude"
                    ? `${filters.accountIds.length} cuentas excluidas`
                    : `${filters.accountIds.length} de ${accounts.length} cuentas`}
              </p>
              <label className={styles.pathSelector}>
                Modo de cuentas
                <select aria-describedby="account-mode-help" value={filters.accountMode ?? "include"} onChange={(event) => onAccountModeChange(event.target.value === "exclude" ? "exclude" : "include")}>
                  <option value="include">Incluir seleccionadas</option>
                  <option value="exclude">Excluir seleccionadas</option>
                </select>
              </label>
              <p id="account-mode-help">Sin selección se incluyen todas las cuentas del ámbito. En modo excluir, las casillas marcadas se omiten, incluso si marcas todas. Origen y destino se filtran por separado.</p>
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
                      disabled={filters.accountMode !== "exclude" && (allAccountsSelected ? accounts.length : filters.accountIds.length) === 1 && (allAccountsSelected || filters.accountIds.includes(account.id))}
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
                <h3>Relación</h3>
                <p>Limita los movimientos según sus vínculos con otras cuentas.</p>
              </div>
            </div>

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
                <p>Incluye o excluye movimientos con cualquiera de las etiquetas seleccionadas.</p>
              </div>
            </div>
            {availableTags.length > 0 ? (
              <fieldset className={styles.choiceGroup}>
                <legend>Etiquetas disponibles</legend>
                <p>
                  {filters.tags.length === 0
                    ? "Sin limitar por etiqueta"
                    : `${filters.tags.length} ${filters.tagMode === "exclude" ? "excluidas" : "seleccionadas"}`}
                </p>
                <label className={styles.pathSelector}>
                  Modo de etiquetas
                  <select aria-describedby="tag-mode-help" value={filters.tagMode ?? "include"} onChange={(event) => onTagModeChange(event.target.value === "exclude" ? "exclude" : "include")}>
                    <option value="include">Incluir seleccionadas</option>
                    <option value="exclude">Excluir seleccionadas</option>
                  </select>
                </label>
                <p id="tag-mode-help">Sin selección no se limita por etiqueta. Excluir omite movimientos con cualquiera de las etiquetas marcadas.</p>
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
          <details className={styles.additionalCriteria}>
            <summary>Criterios adicionales</summary>
            <p>Los criterios se combinan entre sí. Dentro de cada lista, basta con coincidir con una selección.</p>
            <div className={styles.additionalBody}>
              {([
                { title: "Beneficiarios", emptyMessage: "No hay beneficiarios disponibles.", options: payeeOptions, selected: filters.payeeKeys ?? [], query: payeeQuery, setQuery: setPayeeQuery, toggle: onPayeeToggle },
                { title: "Métodos de pago", emptyMessage: "No hay métodos de pago disponibles.", options: methodOptions, selected: filters.paymentMethodKeys ?? [], query: methodQuery, setQuery: setMethodQuery, toggle: onMethodToggle },
              ] as const).map(({ title, emptyMessage, options, selected, query, setQuery, toggle }) => {
                const visibleOptions = options.filter((option) => option.label.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")) || selected.includes(option.key))
                return (
                  <fieldset className={styles.choiceGroup} key={title}>
                    <legend>{title}</legend>
                    <p>{selected.length === 0 ? "Sin limitar" : `${selected.length} seleccionados`}</p>
                    <SearchField label={`Buscar ${title.toLowerCase()}`} onValueChange={setQuery} value={query} />
                    {visibleOptions.length > 0 ? (
                      <div className={styles.choiceList}>
                        {visibleOptions.map((option) => (
                          <label className={styles.choice} key={option.key}>
                            <input checked={selected.includes(option.key)} onChange={() => toggle(option.key)} type="checkbox" />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.empty}><output>{query.length > 0 ? "No hay coincidencias." : emptyMessage}</output></p>
                    )}
                  </fieldset>
                )
              })}
              <fieldset className={styles.choiceGroup}>
                <legend>Tipo de movimiento</legend>
                <div className={styles.compactChoices}>
                  {CATEGORY_TYPE_OPTIONS.map(({ value, label }) => <label className={styles.choice} key={value}>
                    <input checked={(filters.categoryTypes ?? []).includes(value)} onChange={() => onCategoryTypeToggle(value)} type="checkbox" />
                    <span>{label}</span>
                  </label>)}
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}>
                <legend>Moneda del movimiento</legend>
                <div className={styles.compactChoices}>
                  {availableCurrencies.map((currency) => <label className={styles.choice} key={currency}>
                    <input checked={(filters.currencies ?? []).includes(currency)} onChange={() => onCurrencyToggle(currency)} type="checkbox" />
                    <span>{currency}</span>
                  </label>)}
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}>
                <legend>Importe absoluto en EUR</legend>
                <p>Magnitud sin signo, incluidos los límites. Admite coma o punto y hasta dos decimales.</p>
                <div className={styles.amountFields}>
                  <label>Importe absoluto mínimo (EUR)
                    <span className={styles.amountControl}><input aria-describedby={amountError !== null ? "amount-filter-error" : undefined} aria-invalid={amountError !== null} inputMode="decimal" onChange={(event) => onAmountInput("min", event.target.value)} type="text" value={amountMinInput} /></span>
                  </label>
                  <label>Importe absoluto máximo (EUR)
                    <span className={styles.amountControl}><input aria-describedby={amountError !== null ? "amount-filter-error" : undefined} aria-invalid={amountError !== null} inputMode="decimal" onChange={(event) => onAmountInput("max", event.target.value)} type="text" value={amountMaxInput} /></span>
                  </label>
                </div>
                {amountError !== null ? <p aria-live="polite" className={styles.amountError} id="amount-filter-error">{amountError} Se mantienen los límites anteriores hasta corregirlo.</p> : null}
              </fieldset>
              <SearchField label="Buscar en comentarios" onValueChange={onCommentSearchChange} placeholder="Buscar comentarios…" value={filters.commentSearch ?? ""} />
              <SearchField label="Buscar en referencias" onValueChange={onReferenceSearchChange} placeholder="Buscar referencias…" value={filters.referenceSearch ?? ""} />
            </div>
          </details>
        </div>

        <footer className={styles.footer}>
          <Button
            disabled={!hasActiveFilters}
            onClick={onReset}
            variant="ghost"
          >
            Restablecer
          </Button>
          <Button disabled={amountError !== null} onClick={onClose} variant="primary">
            Ver resultados
          </Button>
        </footer>
      </div>
    </dialog>
  )
}
