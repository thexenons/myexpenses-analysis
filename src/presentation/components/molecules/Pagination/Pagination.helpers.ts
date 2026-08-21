import type {
  PaginationModel,
  PaginationToken,
} from "./Pagination.types"

export function defaultPaginationItemLabel(
  itemPage: number,
  current: boolean,
): string {
  return current ? `Página ${itemPage}, actual` : `Ir a la página ${itemPage}`
}

function paginationTokens(
  page: number,
  pageCount: number,
  siblingCount: number,
): ReadonlyArray<PaginationToken> {
  const visible = new Set<number>([1, pageCount])
  const boundedSiblingCount = Number.isFinite(siblingCount)
    ? Math.max(0, Math.floor(siblingCount))
    : 1

  for (
    let candidate = page - boundedSiblingCount;
    candidate <= page + boundedSiblingCount;
    candidate += 1
  ) {
    if (candidate >= 1 && candidate <= pageCount) visible.add(candidate)
  }

  const pages = Array.from(visible).sort((left, right) => left - right)
  const tokens: PaginationToken[] = []

  pages.forEach((visiblePage, index) => {
    const previousPage = pages[index - 1]

    if (previousPage !== undefined) {
      const gap = visiblePage - previousPage
      if (gap === 2) tokens.push(previousPage + 1)
      if (gap > 2) tokens.push(index === 1 ? "start-gap" : "end-gap")
    }

    tokens.push(visiblePage)
  })

  return tokens
}

export function getPaginationModel(
  page: number,
  pageCount: number,
  siblingCount: number,
): PaginationModel | null {
  const normalizedPageCount = Number.isFinite(pageCount)
    ? Math.max(0, Math.floor(pageCount))
    : 0
  if (normalizedPageCount <= 1) return null

  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1
  const currentPage = Math.min(Math.max(1, requestedPage), normalizedPageCount)

  return {
    currentPage,
    normalizedPageCount,
    tokens: paginationTokens(currentPage, normalizedPageCount, siblingCount),
  }
}
