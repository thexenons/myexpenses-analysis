import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import type { ChartInspectorHandle } from "../ChartInspector.types.ts";

export function useChartInspector(ref: Ref<ChartInspectorHandle> | undefined) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelScheduledDismiss = useCallback(() => {
    if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    cancelScheduledDismiss();
    setPosition(null);
  }, [cancelScheduledDismiss]);
  const scheduleDismiss = useCallback(() => {
    cancelScheduledDismiss();
    dismissTimer.current = setTimeout(() => {
      dismissTimer.current = null;
      setPosition(null);
    }, 180);
  }, [cancelScheduledDismiss]);
  useImperativeHandle(ref, () => ({
    inspect(id, x, y) {
      cancelScheduledDismiss();
      setSelectedId(id);
      setPosition({ x, y });
    },
    dismiss,
    scheduleDismiss,
  }), [cancelScheduledDismiss, dismiss, scheduleDismiss]);
  const tooltipOpen = position !== null;
  useEffect(() => {
    if (!tooltipOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [dismiss, tooltipOpen]);
  useEffect(() => cancelScheduledDismiss, [cancelScheduledDismiss]);
  return { cancelScheduledDismiss, dismiss, position, selectedId, setSelectedId };
}
