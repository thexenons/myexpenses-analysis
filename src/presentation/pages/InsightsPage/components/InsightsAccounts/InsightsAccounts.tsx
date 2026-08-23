import { Badge } from "../../../../components/atoms/Badge/Badge.tsx";
import { Panel } from "../../../../components/molecules/Panel/Panel.tsx";
import { HorizontalBarChart } from "../../../../components/organisms/HorizontalBarChart/HorizontalBarChart.tsx";
import { AnalyticsPageGrid } from "../../../../components/templates/AnalyticsPageGrid/AnalyticsPageGrid.tsx";
import { countFormatter } from "../../../../utils/format.ts";
import styles from "./InsightsAccounts.module.css";
import type { InsightsAccountsProps } from "./InsightsAccounts.types.ts";

export function InsightsAccounts({
  accountBars,
  insights,
}: InsightsAccountsProps) {
  const { accounts, provenance } = insights;

  return (
    <div className={styles.accountSection}>
      <AnalyticsPageGrid variant="two">
        <Panel className={`${styles.chartPanel} ${styles.deferredPanel}`}>
          <HorizontalBarChart
            data={accountBars}
            description="Número de cuentas por tipo nativo de MyExpenses; los tipos sin cuentas permanecen visibles."
            formatValue={countFormatter}
            labelHeader="Tipo nativo"
            title="Composición de cuentas"
          />
        </Panel>
        <Panel
          actions={<Badge tone="warning">{accounts.hiddenCount} ocultas</Badge>}
          className={styles.deferredPanel}
          description="Visibilidad y exclusión son metadatos de cuenta; no se infieren a partir del saldo."
          title="Visibilidad del inventario"
        >
          <div className={styles.visibilityHero}>
            <strong>{countFormatter.format(accounts.accountCount)}</strong>
            <span>cuentas en el ámbito</span>
          </div>
          <dl className={styles.compactFacts}>
            <div>
              <dt>Visibles</dt>
              <dd>{countFormatter.format(accounts.visibleCount)}</dd>
            </div>
            <div>
              <dt>Ocultas</dt>
              <dd>{countFormatter.format(accounts.hiddenCount)}</dd>
            </div>
            <div>
              <dt>Excluidas de totales</dt>
              <dd>{countFormatter.format(accounts.excludedFromTotalsCount)}</dd>
            </div>
            <div>
              <dt>Incluidas en ALL</dt>
              <dd>{countFormatter.format(accounts.includedInAllCount)}</dd>
            </div>
          </dl>
        </Panel>
      </AnalyticsPageGrid>

      <Panel
        className={styles.deferredPanel}
        description="Trazabilidad del artefacto y del conjunto visible. Los hashes se muestran truncados; no contienen datos de preferencias."
        title="Procedencia y calidad"
      >
        <dl className={styles.provenanceGrid}>
          <div>
            <dt>Esquema</dt>
            <dd>v{provenance.schemaVersion}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd>{provenance.timeZone}</dd>
          </div>
          <div>
            <dt>ZIP</dt>
            <dd><code>{provenance.backupHashShort}</code></dd>
          </div>
          <div>
            <dt>SQLite</dt>
            <dd><code>{provenance.databaseHashShort}</code></dd>
          </div>
          <div>
            <dt>Apuntes visibles</dt>
            <dd>
              {countFormatter.format(provenance.filteredPostingCount)} /{" "}
              {countFormatter.format(provenance.sourcePostingCount)}
            </dd>
          </div>
          <div>
            <dt>VOID</dt>
            <dd>{countFormatter.format(provenance.voidPostingCount)}</dd>
          </div>
          <div>
            <dt>Peers vinculados</dt>
            <dd>{countFormatter.format(provenance.linkedPostingCount)}</dd>
          </div>
          <div>
            <dt>Partes split</dt>
            <dd>{countFormatter.format(provenance.splitPartCount)}</dd>
          </div>
          <div>
            <dt>Categorías</dt>
            <dd>{countFormatter.format(provenance.categoryCount)}</dd>
          </div>
          <div>
            <dt>Payees definidos</dt>
            <dd>{countFormatter.format(provenance.definedPayeeCount)}</dd>
          </div>
          <div>
            <dt>Métodos definidos</dt>
            <dd>{countFormatter.format(provenance.paymentMethodCount)}</dd>
          </div>
          <div>
            <dt>Etiquetas</dt>
            <dd>{countFormatter.format(provenance.tagCount)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
