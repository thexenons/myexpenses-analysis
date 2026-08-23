import { aggregateBackupInsights } from "../../../domain/analytics/backup-insights.ts";
import type { FilteredAnalyticsDataset } from "../../../domain/analytics/types.ts";
import type { InsightsPageViewProps } from "./InsightsPage.types.ts";

const ACCOUNT_TYPE_LABELS = {
  ASSET: "Activos",
  BANK: "Bancos",
  CASH: "Efectivo",
  CCARD: "Tarjetas",
  INVST: "Inversión",
  LIABILITY: "Pasivos",
} as const;

interface LagBand {
  readonly id: string;
  readonly label: string;
  readonly matches: (lagDays: number) => boolean;
}

const LAG_BANDS: readonly LagBand[] = [
  { id: "early-long", label: "Antes de −7 días", matches: (lag) => lag < -7 },
  {
    id: "early-week",
    label: "De −7 a −1 días",
    matches: (lag) => lag >= -7 && lag < 0,
  },
  { id: "same-day", label: "Mismo día", matches: (lag) => lag === 0 },
  {
    id: "late-week",
    label: "De +1 a +7 días",
    matches: (lag) => lag > 0 && lag <= 7,
  },
  {
    id: "late-month",
    label: "De +8 a +30 días",
    matches: (lag) => lag > 7 && lag <= 30,
  },
  { id: "late-long", label: "Más de +30 días", matches: (lag) => lag > 30 },
];

export function createInsightsPageModel(
  filtered: FilteredAnalyticsDataset,
  searchPending: boolean,
): InsightsPageViewProps | null {
  const insights = aggregateBackupInsights(filtered);
  if (insights === null) {
    return null;
  }

  return {
    accountBars: insights.accounts.nativeTypes.map((item) => ({
      color:
        item.nativeType === "LIABILITY"
          ? "#bd7d2f"
          : item.nativeType === "CCARD"
            ? "#a33f36"
            : "#35698b",
      id: item.nativeType,
      label: ACCOUNT_TYPE_LABELS[item.nativeType],
      value: item.accountCount,
    })),
    hourSeries: [
      {
        color: "#35698b",
        data: insights.timing.hours.map((hour) => ({
          label: hour.label,
          value: hour.postingCount,
        })),
        id: "hour-count",
        label: "Apuntes",
      },
    ],
    insights,
    lagBars: LAG_BANDS.map((band) => ({
      color: band.id === "same-day" ? "#286a4c" : "#bd7d2f",
      id: band.id,
      label: band.label,
      value: insights.valueDates.lagDistribution.reduce(
        (total, item) =>
          total + (band.matches(item.lagDays) ? item.postingCount : 0),
        0,
      ),
    })),
    searchPending,
    weekdayBars: insights.timing.weekdays.map((weekday) => ({
      color: weekday.isoWeekday > 5 ? "#bd7d2f" : "#286a4c",
      id: String(weekday.isoWeekday),
      label: weekday.label,
      value: weekday.postingCount,
    })),
  };
}
