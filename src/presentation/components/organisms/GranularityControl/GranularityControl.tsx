import { GranularityControlView } from "./GranularityControl.view.tsx";
import type { GranularityControlProps } from "./GranularityControl.types.ts";
import { useGranularityControl } from "./hooks/GranularityControl.hooks.ts";

export function GranularityControl(props: GranularityControlProps) {
  return <GranularityControlView {...useGranularityControl(props)} />;
}
