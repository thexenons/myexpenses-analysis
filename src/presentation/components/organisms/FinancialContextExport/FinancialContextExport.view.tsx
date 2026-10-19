import { useEffect, useId, useRef } from "react";
import { Button } from "../../atoms/Button/index.ts";
import type { useFinancialContextExport } from "./hooks/FinancialContextExport.hooks.ts";
import styles from "./FinancialContextExport.module.css";

export function FinancialContextExportView({
  available, open, mode, text, notice, busy, onOpen, onClose, onModeChange, onGenerate, onCopy, onDownload,
}: ReturnType<typeof useFinancialContextExport>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function close() {
    onClose();
    trigger.current?.focus();
  }

  return <>
    <Button ref={trigger} fullWidth disabled={!available} onClick={onOpen}>Exportar contexto JSON</Button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={noteId}
      onCancel={(event) => { event.preventDefault(); close(); }} onClose={onClose}>
      {open ? <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId}>Contexto financiero para IA</h2>
          <Button onClick={close} size="compact">Cerrar</Button>
        </header>
        <p id={noteId}>Se genera en este dispositivo, sin enviar datos a ninguna IA. Puede incluir nombres, notas y referencias sensibles. Revisa el texto antes de compartirlo.</p>
        <label className={styles.field}>
          Datos que incluir
          <select value={mode} onChange={(event) => onModeChange(event.currentTarget.value === "all" ? "all" : "filtered")}>
            <option value="filtered">Filtros activos</option>
            <option value="all">Todos los datos</option>
          </select>
        </label>
        <p>{mode === "filtered"
          ? "Solo los movimientos seleccionados y sus resúmenes. No incluye saldos históricos, presupuestos ni comparativas que requieren información fuera del filtro."
          : "Incluye todos los movimientos, cuentas, saldos y análisis disponibles, sin aplicar los filtros actuales. No modifica tu vista."}</p>
        <div className={styles.actions}>
          <Button variant="primary" disabled={busy} onClick={() => { void onGenerate(); }}>{busy ? "Procesando…" : "Generar JSON"}</Button>
          <Button disabled={!text || busy} onClick={onDownload}>Descargar JSON</Button>
          <Button disabled={!text || busy} onClick={() => { void onCopy(); }}>Copiar JSON</Button>
        </div>
        <output aria-live="polite" className={styles.notice}>{notice}</output>
        <label className={styles.field}>
          Contexto financiero JSON
          <textarea readOnly spellCheck={false} value={text} rows={12} placeholder="Genera el JSON para revisarlo o copiarlo manualmente." />
        </label>
        <small>Cerrar elimina esta vista previa. El archivo descargado no está cifrado. Las descargas y las copias compartidas o guardadas en el portapapeles no se eliminan al bloquear la bóveda.</small>
      </div> : null}
    </dialog>
  </>;
}
