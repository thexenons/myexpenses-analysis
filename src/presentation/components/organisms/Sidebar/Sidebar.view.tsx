import { Link } from "@tanstack/react-router"

import { Icon, type IconName } from "../../atoms/Icon"
import { compactSidebarDate } from "./Sidebar.helpers"
import styles from "./Sidebar.module.css"
import type { SidebarViewProps } from "./Sidebar.types"

interface NavigationItem {
  icon: IconName
  label: string
  mobileLabel: string
  to:
    | "/resumen"
    | "/flujo-de-caja"
    | "/deudas"
    | "/categorias"
    | "/cuentas"
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
  { to: "/deudas", label: "Deudas", mobileLabel: "Deudas", icon: "debt" },
  {
    to: "/categorias",
    label: "Categorías",
    mobileLabel: "Categorías",
    icon: "category",
  },
  { to: "/cuentas", label: "Cuentas", mobileLabel: "Cuentas", icon: "bank" },
  {
    to: "/transacciones",
    label: "Transacciones",
    mobileLabel: "Movimientos",
    icon: "receipt",
  },
]

export function SidebarView({
  accountCount,
  currentPath,
  maxDate,
  minDate,
}: SidebarViewProps) {
  const currentPageLabel =
    NAVIGATION_ITEMS.find((item) => item.to === currentPath)?.label ?? "Resumen"

  return (
    <aside className={styles.sidebar}>
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
                  activeOptions={{ exact: true }}
                  aria-label={item.label}
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
                  <span aria-hidden="true" className={styles.mobileLabel}>
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
        <p className={styles.dateRange}>
          <span>{compactSidebarDate(minDate)}</span>
          <span aria-hidden="true">—</span>
          <span>{compactSidebarDate(maxDate)}</span>
        </p>
      </div>
    </aside>
  )
}
