import { useEffect, useImperativeHandle, useState } from "react";
import type { Ref } from "react";
import type { ChartInspectorHandle } from "../ChartInspector.types.ts";

export function useChartInspector(ref: Ref<ChartInspectorHandle> | undefined) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  useImperativeHandle(ref, () => ({
    inspect(id, x, y) {
      setSelectedId(id);
      setPosition({ x, y });
    },
    dismiss() { setPosition(null); },
  }), []);
  const tooltipOpen = position !== null;
  useEffect(() => {
    if (!tooltipOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [tooltipOpen]);
  return { position, selectedId, setSelectedId };
}
