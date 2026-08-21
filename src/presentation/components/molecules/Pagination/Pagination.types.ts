import type { HTMLAttributes, Ref } from "react"

export type PaginationToken = number | "start-gap" | "end-gap"

export interface PaginationModel {
  currentPage: number
  normalizedPageCount: number
  tokens: ReadonlyArray<PaginationToken>
}

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  itemLabel?: (page: number, current: boolean) => string
  label?: string
  nextLabel?: string
  onPageChange: (page: number) => void
  page: number
  pageCount: number
  previousLabel?: string
  siblingCount?: number
  ref?: Ref<HTMLElement>
}
