import { SeriesChart } from "../SeriesChart/index.ts";
import type { LineChartProps } from "./LineChart.types.ts";

export function LineChart(props: LineChartProps) {
  return <SeriesChart {...props} variant="line" />;
}
