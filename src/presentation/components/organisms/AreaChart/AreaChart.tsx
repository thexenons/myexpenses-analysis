import { SeriesChart } from "../SeriesChart/index.ts";
import type { AreaChartProps } from "./AreaChart.types.ts";

export function AreaChart(props: AreaChartProps) {
  return <SeriesChart {...props} variant="area" />;
}
