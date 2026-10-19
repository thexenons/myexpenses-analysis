import { useLayoutEffect, useRef, useState } from "react";
import type { FinancialContextMode } from "../../../../../domain/analytics/financial-context.ts";
import { useAppStore } from "../../../../providers/AppStoreProvider/index.ts";

export function useFinancialContextExport() {
  const analytics = useAppStore((state) => state.analytics);
  const filters = useAppStore((state) => state.filters);
  const granularity = useAppStore((state) => state.granularity);
  const loadPhase = useAppStore((state) => state.loadPhase);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FinancialContextMode>("filtered");
  const [snapshot, setSnapshot] = useState<{ key: string; text: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const available = analytics !== null && loadPhase === "ready";
  const key = JSON.stringify({ mode, filters, granularity });
  const [input, setInput] = useState({ analytics, available, key });
  const currentInput = useRef(input);
  const text = available && open && snapshot?.key === key ? snapshot.text : "";

  // Reset before committing a different dataset/scope, rather than showing a stale frame.
  if (input.analytics !== analytics || input.available !== available || input.key !== key) {
    setInput({ analytics, available, key });
    setSnapshot(null);
    setNotice("");
    setBusy(false);
    if (!available) setOpen(false);
  }

  useLayoutEffect(() => { currentInput.current = input; }, [input]);

  useLayoutEffect(() => () => { revision.current += 1; }, []);

  function onClose() {
    revision.current += 1;
    setOpen(false);
    setSnapshot(null);
    setNotice("");
    setBusy(false);
  }

  async function onGenerate() {
    if (!available || analytics === null || busy) return;
    const request = ++revision.current;
    setBusy(true);
    setSnapshot(null);
    setNotice("");
    try {
      // Budget/history calculators are loaded only when an export is requested.
      const [{ createFinancialContext }, { serializeFinancialContext }] = await Promise.all([
        import("../../../../../domain/analytics/financial-context.ts"),
        import("../../../../../domain/analytics/financial-context-format.ts"),
      ]);
      if (request !== revision.current || currentInput.current !== input) return;
      const context = createFinancialContext(analytics, { mode, filters, granularity, exportedAt: new Date().toISOString() });
      setSnapshot({ key, text: serializeFinancialContext(context) });
      setNotice(`JSON generado: ${context.transactions.length} movimientos. Revisa el contenido antes de compartirlo.`);
    } catch {
      if (request === revision.current && currentInput.current === input) setNotice("No se pudo generar el JSON. Los datos y filtros no se han modificado.");
    } finally {
      if (request === revision.current && currentInput.current === input) setBusy(false);
    }
  }

  async function onCopy() {
    if (!text || busy) return;
    const request = ++revision.current;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(text);
      if (request === revision.current && currentInput.current === input) setNotice("JSON copiado. El portapapeles conserva la copia aunque bloquees la bóveda.");
    } catch {
      if (request === revision.current && currentInput.current === input) setNotice("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    } finally {
      if (request === revision.current && currentInput.current === input) setBusy(false);
    }
  }

  function onDownload() {
    if (!text || busy) return;
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `contexto-financiero-${mode}.json`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      setNotice("Descarga iniciada. El archivo contiene datos financieros sin cifrar.");
    } catch {
      setNotice("No se pudo iniciar la descarga. Puedes copiar el JSON o seleccionar el texto.");
    } finally {
      anchor?.remove();
      if (url !== undefined) URL.revokeObjectURL(url);
    }
  }

  return {
    available, open: open && available, mode, text, notice, busy,
    onOpen: () => { setMode("filtered"); setOpen(true); },
    onClose, onModeChange: setMode, onGenerate, onCopy, onDownload,
  };
}
