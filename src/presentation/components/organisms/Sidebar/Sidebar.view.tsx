import { Link } from "@tanstack/react-router"

import { Icon, type IconName } from "../../atoms/Icon"
import { compactSidebarDate, formatBackupFilenameTimestamp, formatImportedAt } from "./Sidebar.helpers"
import styles from "./Sidebar.module.css"
import type { SidebarViewProps } from "./Sidebar.types"

interface NavigationItem {
  icon: IconName
  label: string
  mobileLabel: string
  to:
    | "/resumen"
    | "/flujo-de-caja"
    | "/comparativa"
    | "/deudas"
    | "/presupuestos"
    | "/categorias"
    | "/cuentas"
    | "/patrones"
    | "/transacciones"
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { to: "/resumen", label: "Resumen", mobileLabel: "Resumen", icon: "trend" },
  {
    to: "/flujo-de-caja",
    label: "Flujo de caja",
    mobileLabel: "Flujo",
    icon: "transfer",
  },
  { to: "/comparativa", label: "Comparativa", mobileLabel: "Comparativa", icon: "trend" },
  { to: "/deudas", label: "Deudas", mobileLabel: "Deudas", icon: "debt" },
  {
    to: "/presupuestos",
    label: "Presupuestos",
    mobileLabel: "Planes",
    icon: "wallet",
  },
  {
    to: "/categorias",
    label: "Categorías",
    mobileLabel: "Categorías",
    icon: "category",
  },
  { to: "/cuentas", label: "Cuentas", mobileLabel: "Cuentas", icon: "bank" },
  {
    to: "/patrones",
    label: "Patrones y calidad",
    mobileLabel: "Patrones",
    icon: "trend",
  },
  {
    to: "/transacciones",
    label: "Transacciones",
    mobileLabel: "Movimientos",
    icon: "receipt",
  },
]

export function SidebarView({
  accountCount,
  appRevision,
  currentPath,
  maxDate,
  minDate,
  onLock,
  source,
}: SidebarViewProps) {
  const currentPageLabel =
    NAVIGATION_ITEMS.find((item) => item.to === currentPath)?.label ??
    "Página no encontrada"

  return (
    <aside
      aria-label="Navegación y estado de la aplicación"
      className={styles.sidebar}
    >
      <div className={styles.brand}>
        <span aria-hidden="true" className={styles.brandMark}>
          €
        </span>
        <span className={styles.brandCopy}>
          <strong>My Expenses</strong>
          <small>Análisis local</small>
        </span>
      </div>

      <p className={styles.sectionLabel}>Cuaderno financiero</p>
      <nav aria-label="Secciones principales" className={styles.navigation}>
        <ul className={styles.navigationList}>
          {NAVIGATION_ITEMS.map((item, index) => {
            return (
              <li key={item.to}>
                <Link
                  activeOptions={{ exact: true, includeSearch: false }}
                  className={styles.navigationButton}
                  to={item.to}
                >
                  <span aria-hidden="true" className={styles.index}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon
                    className={styles.navigationIcon}
                    name={item.icon}
                    size={18}
                  />
                  <span className={styles.desktopLabel}>{item.label}</span>
                  <span className={styles.mobileLabel}>
                    {item.mobileLabel}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <p aria-atomic="true" aria-live="polite" className={styles.visuallyHidden}>
        Sección actual: {currentPageLabel}
      </p>

      <div className={styles.snapshot}>
        <p className={styles.snapshotHeading}>Instantánea local</p>
        <dl className={styles.snapshotGrid}>
          <div>
            <dt>Cuentas</dt>
            <dd>{accountCount || "—"}</dd>
          </div>
          <div>
            <dt>Divisa base</dt>
            <dd>EUR</dd>
          </div>
        </dl>
        <p className={styles.coverageLabel}>Cobertura de movimientos</p>
        <p className={styles.dateRange}>
          <span>{compactSidebarDate(minDate)}</span>
          <span aria-hidden="true">—</span>
          <span>{compactSidebarDate(maxDate)}</span>
        </p>
        <dl className={styles.freshnessList}>
          <div>
            <dt>Fecha del nombre (no confirma la captura)</dt>
            <dd>{formatBackupFilenameTimestamp(source?.backupFilenameTimestamp)}</dd>
          </div>
          <div>
            <dt>Importado</dt>
            <dd>{formatImportedAt(source?.importedAt)}</dd>
          </div>
          <div>
            <dt>Revisión de la aplicación</dt>
            <dd>{appRevision ?? "No disponible"}</dd>
          </div>
        </dl>
      </div>
      <button
        aria-describedby="automatic-lock-note"
        aria-label="Bloquear bóveda"
        className={styles.lockButton}
        onClick={onLock}
        type="button"
      >
        <span aria-hidden="true" className={styles.lockMark} />
        <span className={styles.lockLabel}>Bloquear bóveda</span>
        <span aria-hidden="true" className={styles.mobileLockLabel}>Bloquear</span>
      </button>
      <p className={styles.visuallyHidden} id="automatic-lock-note">
        La bóveda también se bloquea tras 15 minutos sin actividad.
      </p>
    </aside>
  )
}
