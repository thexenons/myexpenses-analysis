import { Button } from "../../components/atoms/Button/index.ts";
import { Icon } from "../../components/atoms/Icon/index.ts";
import { Pagination } from "../../components/molecules/Pagination/index.ts";
import { Panel } from "../../components/molecules/Panel/index.ts";
import { AnalyticsPage } from "../../components/templates/AnalyticsPage/index.ts";
import { formatCount, formatEuroMinor } from "../../utils/format.ts";
import { TransactionTable } from "./components/TransactionTable/index.ts";
import { TransactionStatus } from "./components/TransactionStatus/index.ts";
import type { TransactionsPageViewProps } from "./TransactionsPage.types.ts";
import styles from "./TransactionsPage.module.css";

export function TransactionsPageView({
  dataset,
  dateBasis,
  descending,
  onDownload,
  onPageChange,
  onPageSizeChange,
  onSort,
  page,
  pageCount,
  pageSize,
  postings,
  resultCount,
  searchPending,
  sortKey,
  summary,
  uniformStatus,
}: TransactionsPageViewProps) {
  return (
    <AnalyticsPage
      description="Libro mayor completo, incluidas las partes de splits y las operaciones anuladas cuando el filtro de estado las solicita."
      title="Transacciones"
    >
      <output aria-atomic="true" aria-live="polite" className={styles.resultStatus}>
        {searchPending
          ? `Actualizando búsqueda. ${formatCount(resultCount, "resultado actual", "resultados actuales")}.`
          : resultCount === 0
            ? "No hay resultados."
            : `${formatCount(resultCount, "resultado", "resultados")}.`}
      </output>
      {summary === undefined ? null : (
        <Panel description="Importes de todos los resultados, sin anulados. Las transferencias pueden compensarse entre cuentas; el flujo real sólo suma las cuentas reales seleccionadas." title="Totales del corte">
          <dl className={styles.totals}>
            <div><dt>Flujo de cuentas reales</dt><dd>{formatEuroMinor(summary.realCashFlowEurMinor)}</dd></div>
            <div><dt>Neto seleccionado</dt><dd>{formatEuroMinor(summary.netEurMinor)}</dd></div>
            <div><dt>Gasto neto seleccionado</dt><dd>{formatEuroMinor(-summary.expensesEurMinor || 0)}</dd></div>
            <div><dt>Ingreso neto seleccionado</dt><dd>{formatEuroMinor(summary.incomesEurMinor)}</dd></div>
            <div><dt>Movimiento de deuda</dt><dd>{formatEuroMinor(summary.debtFlowEurMinor)}</dd></div>
          </dl>
        </Panel>
      )}
      <Panel
        actions={
          <div className={styles.actions}>
          {onPageSizeChange === undefined ? null : (
            <label className={styles.pageSize}>
              <span>Filas por página</span>
              <select onChange={(event) => onPageSizeChange(Number(event.currentTarget.value))} value={pageSize}>
                {[25, 50, 100, 250].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          )}
          <Button
            disabled={resultCount === 0}
            icon={<Icon name="download" size={15} />}
            onClick={onDownload}
            variant="secondary"
          >
            Exportar CSV
          </Button>
          </div>
        }
        description={`${formatCount(resultCount, "resultado", "resultados")}${searchPending ? " · actualizando búsqueda" : ""}`}
        title="Movimientos filtrados"
      >
        {uniformStatus === undefined ? null : (
          <p className={styles.commonStatus}>
            Estado de todos los resultados: <TransactionStatus posting={{ status: uniformStatus }} />
          </p>
        )}
        <TransactionTable
          dataset={dataset}
          dateBasis={dateBasis}
          descending={descending}
          onSort={onSort}
          postings={postings}
          sortKey={sortKey}
          uniformStatus={uniformStatus}
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
