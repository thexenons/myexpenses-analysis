import { Button } from "../../components/atoms/Button/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { Pagination } from "../../components/molecules/Pagination/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { countFormatter } from "../../utils/format.ts";
import { TransactionTable } from "./components/TransactionTable/index.ts";
import type { TransactionsPageViewProps } from "./TransactionsPage.types.ts";

export function TransactionsPageView({
  descending,
  onDownload,
  onPageChange,
  onSort,
  page,
  pageCount,
  postings,
  resultCount,
  searchPending,
  sortKey,
}: TransactionsPageViewProps) {
  return (
    <AnalyticsPage
      description="Libro mayor completo, incluidas las partes de splits y las operaciones anuladas cuando el filtro de estado las solicita."
      title="Transacciones"
    >
      <Panel
        actions={
          <Button
            disabled={resultCount === 0}
            icon={<Icon name="download" size={15} />}
            onClick={onDownload}
            variant="secondary"
          >
            Exportar CSV
          </Button>
        }
        description={`${countFormatter.format(resultCount)} resultados${searchPending ? " · actualizando búsqueda" : ""}`}
        title="Movimientos filtrados"
      >
        <TransactionTable
          descending={descending}
          onSort={onSort}
          postings={postings}
          sortKey={sortKey}
        />
        <Pagination
          label="Páginas de movimientos"
          onPageChange={onPageChange}
          page={page}
          pageCount={pageCount}
        />
      </Panel>
    </AnalyticsPage>
  );
}
