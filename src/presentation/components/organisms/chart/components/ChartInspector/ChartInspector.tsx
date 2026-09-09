import { formatNumber } from "../../../../../utils/component.helpers.ts";
import { identityLabel } from "../../chart.helpers.ts";
import type { ChartInspectorProps } from "./ChartInspector.types.ts";
import { useChartInspector } from "./hooks/ChartInspector.hooks.ts";
import styles from "./ChartInspector.module.css";

export function ChartInspector({ title, items, getValues, formatLabel = identityLabel, formatValue, ref }: ChartInspectorProps) {
  const { position, selectedId, setSelectedId } = useChartInspector(ref);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  if (selected === undefined) return null;
  const label = formatLabel(selected.label);
  const exactLabel = label === selected.label ? label : `${label} · ${selected.label}`;
  const values = getValues(selected.id);
  const content = <>
    <strong>{exactLabel}</strong>
    <dl className={styles.values}>
      {values.map((value) => <div className={styles.value} key={value.id}>
        <dt><span aria-hidden="true" className={styles.swatch} style={{ background: value.color }} />{value.label}</dt>
        <dd>{value.value === null ? "Sin dato" : formatNumber(value.value, formatValue)}</dd>
        {value.detail ? <dd className={styles.detail}>{value.detail}</dd> : null}
      </div>)}
    </dl>
  </>;
  return <>
    <details className={styles.root}>
      <summary className={styles.summary}>Consultar un punto</summary>
      <label className={styles.label}>
        Punto de {title}
        <select onChange={(event) => setSelectedId(event.target.value)} value={selected.id}>
          {items.map((item) => <option key={item.id} value={item.id}>{formatLabel(item.label)}{formatLabel(item.label) === item.label ? "" : ` · ${item.label}`}</option>)}
        </select>
      </label>
      <section aria-label={`Valores de ${title}`} aria-live="polite" className={styles.readout}>{content}</section>
    </details>
    {position === null ? null : <div
      className={styles.tooltip}
      role="tooltip"
      style={{ left: Math.max(8, Math.min(position.x + 14, window.innerWidth - 310)), top: Math.max(8, Math.min(position.y + 14, window.innerHeight - 250)) }}
    >{content}</div>}
  </>;
}
