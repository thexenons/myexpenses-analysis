import { INSIGHT_NATIVE_ACCOUNT_TYPES, INSIGHT_WEEKDAYS } from "../../../domain/analytics/backup-insights.ts";
import type { BackupInsights } from "../../../domain/analytics/backup-insights.ts";
import type { InsightsPageViewProps } from "./InsightsPage.types.ts";

export const INSIGHTS_FIXTURE: BackupInsights = {
  accounts: {
    accountCount: 2,
    excludedFromTotalsCount: 0,
    hiddenCount: 1,
    includedInAllCount: 2,
    nativeTypes: INSIGHT_NATIVE_ACCOUNT_TYPES.map((nativeType, index) => ({
      accountCount: index < 2 ? 1 : 0,
      hiddenCount: index === 1 ? 1 : 0,
      nativeType,
      valuationEurMinor: index === 0 ? 10_000 : 0,
      visibleCount: index === 0 ? 1 : 0,
    })),
    visibleCount: 1,
  },
  paymentMethods: {
    activePostingCount: 10,
    definedMethodCount: 2,
    methods: [{ name: "Domiciliación", netEurMinor: -808, postingCount: 1 }],
    usedMethodCount: 1,
    usedPostingCount: 1,
  },
  payees: {
    activePostingCount: 10,
    coverageRatio: 0.6,
    definedPayeeCount: 3,
    payeePostingCount: 6,
    topExpenses: [
      {
        expenseEurMinor: -1_000,
        incomeEurMinor: 0,
        name: "Tienda",
        netEurMinor: -1_000,
        postingCount: 2,
        sourceId: 1,
      },
    ],
    topIncome: [
      {
        expenseEurMinor: 0,
        incomeEurMinor: 5_000,
        name: "Empresa",
        netEurMinor: 5_000,
        postingCount: 1,
        sourceId: 2,
      },
    ],
    topNet: [
      {
        expenseEurMinor: 0,
        incomeEurMinor: 5_000,
        name: "Empresa",
        netEurMinor: 5_000,
        postingCount: 1,
        sourceId: 2,
      },
    ],
    usedPayeeCount: 2,
  },
  provenance: {
    accountCount: 2,
    activePostingCount: 10,
    archivedContentCount: 0,
    backupHashShort: "aaaaaaaa…aaaaaa",
    categoryCount: 4,
    databaseHashShort: "bbbbbbbb…bbbbbb",
    definedPayeeCount: 3,
    filteredPostingCount: 11,
    linkedPostingCount: 4,
    paymentMethodCount: 2,
    schemaVersion: 189,
    sourcePostingCount: 11,
    splitPartCount: 2,
    tagCount: 1,
    timeZone: "Europe/Madrid",
    voidPostingCount: 1,
  },
  timing: {
    hourCoverageRatio: 10 / 11,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      netEurMinor: hour === 9 ? -1_000 : 0,
      postingCount: hour === 9 ? 2 : 0,
    })),
    midnightOrMissingTimeCount: 1,
    timedPostingCount: 10,
    totalPostingCount: 11,
    weekdays: INSIGHT_WEEKDAYS.map((label, index) => ({
      isoWeekday: index + 1,
      label,
      netEurMinor: 0,
      postingCount: index === 0 ? 3 : 1,
    })),
  },
  valueDates: {
    coverageRatio: 8 / 11,
    distinctValueDateCount: 2,
    distinctValueDateFrom: "2024-02-22",
    distinctValueDateTo: "2025-10-21",
    lagDistribution: [
      { lagDays: 0, postingCount: 6 },
      { lagDays: 1, postingCount: 1 },
      { lagDays: 4, postingCount: 1 },
    ],
    missingValueDateCount: 3,
    sameDayValueDateCount: 6,
    totalPostingCount: 11,
    valueDatePostingCount: 8,
  },
};

export const INSIGHTS_PAGE_PROPS: InsightsPageViewProps = {
  accountBars: INSIGHTS_FIXTURE.accounts.nativeTypes.map((item) => ({
    id: item.nativeType,
    label: item.nativeType,
    value: item.accountCount,
  })),
  hourSeries: [
    {
      id: "hours",
      label: "Apuntes",
      data: INSIGHTS_FIXTURE.timing.hours.map((item) => ({
        label: item.label,
        value: item.postingCount,
      })),
    },
  ],
  insights: INSIGHTS_FIXTURE,
  lagBars: [
    { id: "same", label: "Mismo día", value: 6 },
    { id: "later", label: "Después", value: 2 },
  ],
  searchPending: true,
  weekdayBars: INSIGHTS_FIXTURE.timing.weekdays.map((item) => ({
    id: String(item.isoWeekday),
    label: item.label,
    value: item.postingCount,
  })),
};
