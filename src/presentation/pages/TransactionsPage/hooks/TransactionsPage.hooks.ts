import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { aggregateKpis } from "../../../../domain/analytics/aggregations.ts";
import type { NormalizedPosting } from "../../../../domain/analytics/types.ts";
import { useFilteredAnalytics } from "../../../hooks/filtered-analytics/filtered-analytics.hooks.ts";
import {
  downloadPostingsCsv,
  sortPostings,
  TRANSACTIONS_PAGE_SIZE,
} from "../TransactionsPage.helpers.ts";
import type {
  TransactionsPageViewProps,
  TransactionSortKey,
} from "../TransactionsPage.types.ts";

const EMPTY_POSTINGS: readonly NormalizedPosting[] = [];

export function useTransactionsPage(): TransactionsPageViewProps {
  const { filtered, searchPending } = useFilteredAnalytics();
  const navigate = useNavigate({ from: "/transacciones" });
  const search = useSearch({ from: "/transacciones" });
  const [pageSize, setPageSize] = useState(TRANSACTIONS_PAGE_SIZE);
  const previousPageSize = useRef(pageSize);
  const dateBasis = filtered?.filters.dateBasis ?? "operation";
  const descending = search.direction === "desc";
  const sortKey = search.sort;
  const sourcePostings = filtered?.postings ?? EMPTY_POSTINGS;
  const previousSourcePostings = useRef(sourcePostings);
  const postings = useMemo(
    () => sortPostings(sourcePostings, sortKey, descending, dateBasis),
    [dateBasis, descending, sortKey, sourcePostings],
  );
  const summary = useMemo(() => filtered === null ? undefined : aggregateKpis(filtered), [filtered]);
  const pageCount = Math.max(
    1,
    Math.ceil(postings.length / pageSize),
  );
  const safePage = Math.min(search.page, pageCount);
  const pagePostings = postings.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  useEffect(() => {
    const sourceChanged = previousSourcePostings.current !== sourcePostings;
    const pageSizeChanged = previousPageSize.current !== pageSize;
    previousSourcePostings.current = sourcePostings;
    previousPageSize.current = pageSize;
    const nextPage = sourceChanged || pageSizeChanged ? 1 : safePage;
    if (search.page === nextPage) return;

    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, page: nextPage }),
    });
  }, [navigate, pageSize, safePage, search.page, sourcePostings]);

  const onSort = useCallback(
    (key: TransactionSortKey) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          direction:
            key === previous.sort && previous.direction === "desc"
              ? "asc"
              : "desc",
          page: 1,
          sort: key,
        }),
      });
    },
    [navigate],
  );
  const onPageChange = useCallback(
    (page: number) => {
      void navigate({
        search: (previous) => ({ ...previous, page }),
      });
    },
    [navigate],
  );
  const onDownload = useCallback(
    () => downloadPostingsCsv(postings, filtered?.source),
    [filtered?.source, postings],
  );
  const onPageSizeChange = useCallback((size: number) => {
    if (![25, 50, 100, 250].includes(size)) return;
    setPageSize(size);
  }, []);

  return {
    dataset: filtered?.source,
    dateBasis,
    descending,
    onDownload,
    onPageChange,
    onPageSizeChange,
    page: safePage,
    pageCount,
    pageSize,
    postings: pagePostings,
    resultCount: postings.length,
    searchPending,
    sortKey,
    onSort,
    summary,
  };
}
