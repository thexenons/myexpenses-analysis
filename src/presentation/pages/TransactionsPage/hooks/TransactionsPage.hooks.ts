import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
  const descending = search.direction === "desc";
  const sortKey = search.sort;
  const sourcePostings = filtered?.postings ?? EMPTY_POSTINGS;
  const previousSourcePostings = useRef(sourcePostings);
  const postings = useMemo(
    () => sortPostings(sourcePostings, sortKey, descending),
    [descending, sortKey, sourcePostings],
  );
  const pageCount = Math.max(
    1,
    Math.ceil(postings.length / TRANSACTIONS_PAGE_SIZE),
  );
  const safePage = Math.min(search.page, pageCount);
  const pagePostings = postings.slice(
    (safePage - 1) * TRANSACTIONS_PAGE_SIZE,
    safePage * TRANSACTIONS_PAGE_SIZE,
  );

  useEffect(() => {
    const sourceChanged = previousSourcePostings.current !== sourcePostings;
    previousSourcePostings.current = sourcePostings;
    const nextPage = sourceChanged ? 1 : safePage;
    if (search.page === nextPage) return;

    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, page: nextPage }),
    });
  }, [navigate, safePage, search.page, sourcePostings]);

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
    () => downloadPostingsCsv(postings),
    [postings],
  );

  return {
    descending,
    onDownload,
    onPageChange,
    page: safePage,
    pageCount,
    postings: pagePostings,
    resultCount: postings.length,
    searchPending,
    sortKey,
    onSort,
  };
}
