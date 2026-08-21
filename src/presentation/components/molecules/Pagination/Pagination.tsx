import { Icon } from "../../atoms/Icon"
import styles from "./Pagination.module.css"
import { cx } from "../../../utils/component.helpers.ts"
import {
  defaultPaginationItemLabel,
  getPaginationModel,
} from "./Pagination.helpers"
import type { PaginationProps } from "./Pagination.types"

export function Pagination({
  className,
  itemLabel = defaultPaginationItemLabel,
  label = "Paginación",
  nextLabel = "Página siguiente",
  onPageChange,
  page,
  pageCount,
  previousLabel = "Página anterior",
  ref,
  siblingCount = 1,
  ...props
}: PaginationProps) {
  const model = getPaginationModel(page, pageCount, siblingCount)
  if (!model) return null
  const { currentPage, normalizedPageCount, tokens } = model

  return (
    <nav
      {...props}
      aria-label={label}
      className={cx(styles.root, className)}
      ref={ref}
    >
      <button
        aria-label={previousLabel}
        className={cx(styles.button, styles.previous)}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        <Icon name="chevron-left" />
      </button>

      <ol className={styles.pages}>
        {tokens.map((token) =>
          typeof token === "number" ? (
            <li className={styles.item} key={token}>
              <button
                aria-current={token === currentPage ? "page" : undefined}
                aria-label={itemLabel(token, token === currentPage)}
                className={cx(
                  styles.button,
                  styles.page,
                  token === currentPage && styles.current,
                )}
                onClick={() => onPageChange(token)}
                type="button"
              >
                {token}
              </button>
            </li>
          ) : (
            <li aria-hidden="true" className={styles.gap} key={token}>
              …
            </li>
          ),
        )}
      </ol>

      <button
        aria-label={nextLabel}
        className={cx(styles.button, styles.next)}
        disabled={currentPage === normalizedPageCount}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        <Icon name="chevron-right" />
      </button>
    </nav>
  )
}
