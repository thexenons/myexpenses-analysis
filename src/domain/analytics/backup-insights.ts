import type { BackupNativeAccountType } from "./backup-dataset.types.ts";
import type {
  FilteredAnalyticsDataset,
  IsoDate,
  NormalizedAccount,
  NormalizedPosting,
} from "./types.ts";

const DAY_MILLISECONDS = 86_400_000;
const PRECISE_TIME_PATTERN = /^(\d{2}):[0-5]\d:[0-5]\d$/;

export const INSIGHT_NATIVE_ACCOUNT_TYPES = [
  "CASH",
  "BANK",
  "CCARD",
  "ASSET",
  "LIABILITY",
  "INVST",
] as const satisfies readonly BackupNativeAccountType[];

export const INSIGHT_WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export interface InsightAmountBucket {
  readonly netEurMinor: number;
  readonly postingCount: number;
}

export interface PayeeInsight extends InsightAmountBucket {
  readonly expenseEurMinor: number;
  readonly incomeEurMinor: number;
  readonly name: string;
  readonly sourceId: number | null;
}

export interface PayeeInsights {
  readonly activePostingCount: number;
  readonly coverageRatio: number;
  readonly definedPayeeCount: number;
  readonly payeePostingCount: number;
  readonly topExpenses: readonly PayeeInsight[];
  readonly topIncome: readonly PayeeInsight[];
  readonly topNet: readonly PayeeInsight[];
  readonly usedPayeeCount: number;
}

export interface HourInsight extends InsightAmountBucket {
  readonly hour: number;
  readonly label: string;
}

export interface WeekdayInsight extends InsightAmountBucket {
  readonly isoWeekday: number;
  readonly label: (typeof INSIGHT_WEEKDAYS)[number];
}

export interface TimingInsights {
  readonly hourCoverageRatio: number;
  readonly hours: readonly HourInsight[];
  readonly midnightOrMissingTimeCount: number;
  readonly timedPostingCount: number;
  readonly totalPostingCount: number;
  readonly weekdays: readonly WeekdayInsight[];
}

export interface ValueDateLagInsight {
  readonly lagDays: number;
  readonly postingCount: number;
}

export interface ValueDateInsights {
  readonly coverageRatio: number;
  readonly distinctValueDateCount: number;
  readonly distinctValueDateFrom: IsoDate | null;
  readonly distinctValueDateTo: IsoDate | null;
  readonly lagDistribution: readonly ValueDateLagInsight[];
  readonly missingValueDateCount: number;
  readonly sameDayValueDateCount: number;
  readonly totalPostingCount: number;
  readonly valueDatePostingCount: number;
}

export interface PaymentMethodInsight extends InsightAmountBucket {
  readonly name: string;
}

export interface PaymentMethodInsights {
  readonly activePostingCount: number;
  readonly definedMethodCount: number;
  readonly methods: readonly PaymentMethodInsight[];
  readonly usedMethodCount: number;
  readonly usedPostingCount: number;
}

export interface NativeAccountTypeInsight {
  readonly accountCount: number;
  readonly hiddenCount: number;
  readonly nativeType: BackupNativeAccountType;
  readonly valuationEurMinor: number;
  readonly visibleCount: number;
}

export interface AccountCompositionInsights {
  readonly accountCount: number;
  readonly excludedFromTotalsCount: number;
  readonly hiddenCount: number;
  readonly includedInAllCount: number;
  readonly nativeTypes: readonly NativeAccountTypeInsight[];
  readonly visibleCount: number;
}

export interface BackupProvenanceInsights {
  readonly accountCount: number;
  readonly activePostingCount: number;
  readonly archivedContentCount: number;
  readonly backupHashShort: string;
  readonly categoryCount: number;
  readonly databaseHashShort: string;
  readonly definedPayeeCount: number;
  readonly filteredPostingCount: number;
  readonly linkedPostingCount: number;
  readonly paymentMethodCount: number;
  readonly schemaVersion: number;
  readonly sourcePostingCount: number;
  readonly splitPartCount: number;
  readonly tagCount: number;
  readonly timeZone: string;
  readonly voidPostingCount: number;
}

export interface BackupInsights {
  readonly accounts: AccountCompositionInsights;
  readonly paymentMethods: PaymentMethodInsights;
  readonly payees: PayeeInsights;
  readonly provenance: BackupProvenanceInsights;
  readonly timing: TimingInsights;
  readonly valueDates: ValueDateInsights;
}

export interface AggregateBackupInsightsOptions {
  readonly topPayeeLimit?: number;
}

interface MutableAmountBucket {
  netEurMinor: number;
  postingCount: number;
}

interface MutablePayeeInsight extends MutableAmountBucket {
  expenseEurMinor: number;
  incomeEurMinor: number;
  name: string;
  sourceId: number | null;
}

function addMinor(left: number, right: number, context: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${context}: amount exceeds the safe integer range`);
  }
  return result === 0 ? 0 : result;
}

function coverage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function addPostingAmount(
  bucket: MutableAmountBucket,
  posting: NormalizedPosting,
  context: string,
): void {
  bucket.postingCount += 1;
  if (!posting.isVoid) {
    bucket.netEurMinor = addMinor(
      bucket.netEurMinor,
      posting.amountEurMinor,
      context,
    );
  }
}

function payeeAmount(
  payee: MutablePayeeInsight,
  posting: NormalizedPosting,
): void {
  payee.postingCount += 1;
  payee.netEurMinor = addMinor(
    payee.netEurMinor,
    posting.amountEurMinor,
    `Payee ${payee.name} net`,
  );
  if (posting.bucket === "expense") {
    payee.expenseEurMinor = addMinor(
      payee.expenseEurMinor,
      posting.amountEurMinor,
      `Payee ${payee.name} expense`,
    );
  } else if (posting.bucket === "income") {
    payee.incomeEurMinor = addMinor(
      payee.incomeEurMinor,
      posting.amountEurMinor,
      `Payee ${payee.name} income`,
    );
  }
}

function rankPayees(
  payees: readonly PayeeInsight[],
  amount: (payee: PayeeInsight) => number,
  limit: number,
): readonly PayeeInsight[] {
  return payees
    .filter((payee) => amount(payee) !== 0)
    .toSorted((left, right) => {
      const difference = Math.abs(amount(right)) - Math.abs(amount(left));
      return difference === 0 ? left.name.localeCompare(right.name, "es") : difference;
    })
    .slice(0, limit);
}

interface DateFacts {
  readonly epochDay: number;
  readonly isoWeekday: number;
}

function dateFacts(
  date: IsoDate,
  cache: Map<IsoDate, DateFacts>,
): DateFacts {
  const cached = cache.get(date);
  if (cached !== undefined) return cached;
  const value = new Date(`${date}T00:00:00Z`);
  const weekday = value.getUTCDay();
  const result = {
    epochDay: value.getTime() / DAY_MILLISECONDS,
    isoWeekday: weekday === 0 ? 7 : weekday,
  };
  cache.set(date, result);
  return result;
}

function valueDateLag(
  posting: NormalizedPosting,
  cache: Map<IsoDate, DateFacts>,
): number | null {
  if (posting.valueDate === undefined) {
    return null;
  }
  const lag =
    dateFacts(posting.valueDate, cache).epochDay -
    dateFacts(posting.date, cache).epochDay;
  if (!Number.isSafeInteger(lag)) {
    throw new Error(`Posting ${posting.id}: invalid value-date lag`);
  }
  return lag;
}

function earliestDate(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate < current ? candidate : current;
}

function latestDate(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate > current ? candidate : current;
}

function accountComposition(
  accounts: readonly NormalizedAccount[],
): AccountCompositionInsights {
  const rows = new Map<BackupNativeAccountType, NativeAccountTypeInsight>();
  let excludedFromTotalsCount = 0;
  let hiddenCount = 0;
  let includedInAllCount = 0;
  for (const nativeType of INSIGHT_NATIVE_ACCOUNT_TYPES) {
    rows.set(nativeType, {
      accountCount: 0,
      hiddenCount: 0,
      nativeType,
      valuationEurMinor: 0,
      visibleCount: 0,
    });
  }
  for (const account of accounts) {
    if (account.nativeType === undefined || account.visible === undefined) {
      throw new Error("Backup account metadata is required for account insights");
    }
    const current = rows.get(account.nativeType);
    if (current === undefined) {
      throw new Error(`Unsupported native account type ${account.nativeType}`);
    }
    if (!account.visible) hiddenCount += 1;
    if (account.excludedFromTotals === true) excludedFromTotalsCount += 1;
    if (account.includedInAll === true) includedInAllCount += 1;
    rows.set(account.nativeType, {
      accountCount: current.accountCount + 1,
      hiddenCount: current.hiddenCount + (account.visible ? 0 : 1),
      nativeType: account.nativeType,
      valuationEurMinor: addMinor(
        current.valuationEurMinor,
        account.valuationBalanceEurMinor,
        `${account.nativeType} valuation`,
      ),
      visibleCount: current.visibleCount + (account.visible ? 1 : 0),
    });
  }
  return {
    accountCount: accounts.length,
    excludedFromTotalsCount,
    hiddenCount,
    includedInAllCount,
    nativeTypes: INSIGHT_NATIVE_ACCOUNT_TYPES.map(
      (nativeType) => rows.get(nativeType)!,
    ),
    visibleCount: accounts.length - hiddenCount,
  };
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function assertTopPayeeLimit(value: number | undefined): number {
  const limit = value ?? 5;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
    throw new Error("topPayeeLimit must be an integer from 1 through 25");
  }
  return limit;
}

/**
 * Derives descriptive patterns from the already-filtered rows. Counts used for
 * data coverage retain visible VOID rows; monetary and payee metrics exclude
 * VOID so an annulled posting cannot alter a ranking.
 */
export function aggregateBackupInsights(
  filtered: FilteredAnalyticsDataset,
  options: AggregateBackupInsightsOptions = {},
): BackupInsights | null {
  const backup = filtered.source.backup;
  if (backup === undefined) {
    return null;
  }
  const topPayeeLimit = assertTopPayeeLimit(options.topPayeeLimit);
  const payeeMap = new Map<string, MutablePayeeInsight>();
  const methodMap = new Map<string, MutableAmountBucket>();
  const hourBuckets: MutableAmountBucket[] = Array.from({ length: 24 }, () => ({
    netEurMinor: 0,
    postingCount: 0,
  }));
  const weekdayBuckets: MutableAmountBucket[] = Array.from({ length: 7 }, () => ({
    netEurMinor: 0,
    postingCount: 0,
  }));
  const lagCounts = new Map<number, number>();
  const dateCache = new Map<IsoDate, DateFacts>();
  let activePostingCount = 0;
  let archivedContentCount = 0;
  let linkedPostingCount = 0;
  let payeePostingCount = 0;
  let splitPartCount = 0;
  let usedMethodPostingCount = 0;
  let timedPostingCount = 0;
  let valueDatePostingCount = 0;
  let distinctValueDateCount = 0;
  let distinctValueDateFrom: IsoDate | null = null;
  let distinctValueDateTo: IsoDate | null = null;
  let voidPostingCount = 0;

  for (const posting of filtered.postings) {
    if (posting.isArchivedContent === true) archivedContentCount += 1;
    if (posting.linked) linkedPostingCount += 1;
    if (posting.splitIndex !== null) splitPartCount += 1;
    const weekdayBucket =
      weekdayBuckets[dateFacts(posting.date, dateCache).isoWeekday - 1]!;
    addPostingAmount(weekdayBucket, posting, "Weekday activity");

    const timeMatch =
      posting.localTime === undefined
        ? null
        : PRECISE_TIME_PATTERN.exec(posting.localTime);
    if (timeMatch !== null && posting.localTime !== "00:00:00") {
      const hour = Number(timeMatch[1]);
      const bucket = hourBuckets[hour];
      if (bucket === undefined) {
        throw new Error(`Posting ${posting.id}: invalid local hour`);
      }
      timedPostingCount += 1;
      addPostingAmount(bucket, posting, `Hour ${hour} activity`);
    }

    const lag = valueDateLag(posting, dateCache);
    if (lag !== null) {
      valueDatePostingCount += 1;
      lagCounts.set(lag, (lagCounts.get(lag) ?? 0) + 1);
      if (lag !== 0) {
        distinctValueDateCount += 1;
        const valueDate = posting.valueDate;
        if (valueDate === undefined) {
          throw new Error(`Posting ${posting.id}: missing value date`);
        }
        distinctValueDateFrom = earliestDate(distinctValueDateFrom, valueDate);
        distinctValueDateTo = latestDate(distinctValueDateTo, valueDate);
      }
    }

    if (posting.isVoid) {
      voidPostingCount += 1;
      continue;
    }
    activePostingCount += 1;
    if (posting.payee !== undefined) {
      payeePostingCount += 1;
      const payeeKey =
        posting.payeeSourceId === undefined
          ? `label:${posting.payee}`
          : `id:${posting.payeeSourceId}`;
      const current = payeeMap.get(payeeKey) ?? {
        expenseEurMinor: 0,
        incomeEurMinor: 0,
        name: posting.payee,
        netEurMinor: 0,
        postingCount: 0,
        sourceId: posting.payeeSourceId ?? null,
      };
      payeeAmount(current, posting);
      payeeMap.set(payeeKey, current);
    }
    if (posting.paymentMethod !== undefined) {
      usedMethodPostingCount += 1;
      const current = methodMap.get(posting.paymentMethod) ?? {
        netEurMinor: 0,
        postingCount: 0,
      };
      addPostingAmount(current, posting, `Method ${posting.paymentMethod}`);
      methodMap.set(posting.paymentMethod, current);
    }
  }

  const payees: readonly PayeeInsight[] = [...payeeMap.values()];
  const sourcePostings = filtered.source.postings;

  return {
    accounts: accountComposition(filtered.accounts),
    paymentMethods: {
      activePostingCount,
      definedMethodCount: backup.paymentMethods.length,
      methods: [...methodMap.entries()]
        .map(([name, bucket]) => ({
          name,
          netEurMinor: bucket.netEurMinor,
          postingCount: bucket.postingCount,
        }))
        .toSorted(
          (left, right) =>
            right.postingCount - left.postingCount ||
            left.name.localeCompare(right.name, "es"),
        ),
      usedMethodCount: methodMap.size,
      usedPostingCount: usedMethodPostingCount,
    },
    payees: {
      activePostingCount,
      coverageRatio: coverage(payeePostingCount, activePostingCount),
      definedPayeeCount: backup.payees.length,
      payeePostingCount,
      topExpenses: rankPayees(
        payees,
        (payee) => payee.expenseEurMinor,
        topPayeeLimit,
      ),
      topIncome: rankPayees(
        payees,
        (payee) => payee.incomeEurMinor,
        topPayeeLimit,
      ),
      topNet: rankPayees(payees, (payee) => payee.netEurMinor, topPayeeLimit),
      usedPayeeCount: payeeMap.size,
    },
    provenance: {
      accountCount: backup.accounts.length,
      activePostingCount,
      archivedContentCount,
      backupHashShort: shortHash(backup.source.backupSha256),
      categoryCount: backup.categories.length,
      databaseHashShort: shortHash(backup.source.databaseSha256),
      definedPayeeCount: backup.payees.length,
      filteredPostingCount: filtered.postings.length,
      linkedPostingCount,
      paymentMethodCount: backup.paymentMethods.length,
      schemaVersion: backup.source.schemaVersion,
      sourcePostingCount: sourcePostings.length,
      splitPartCount,
      tagCount: backup.tags.length,
      timeZone: backup.preferences.timeZone,
      voidPostingCount,
    },
    timing: {
      hourCoverageRatio: coverage(timedPostingCount, filtered.postings.length),
      hours: hourBuckets.map((bucket, hour) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        netEurMinor: bucket.netEurMinor,
        postingCount: bucket.postingCount,
      })),
      midnightOrMissingTimeCount: filtered.postings.length - timedPostingCount,
      timedPostingCount,
      totalPostingCount: filtered.postings.length,
      weekdays: weekdayBuckets.map((bucket, index) => ({
        isoWeekday: index + 1,
        label: INSIGHT_WEEKDAYS[index]!,
        netEurMinor: bucket.netEurMinor,
        postingCount: bucket.postingCount,
      })),
    },
    valueDates: {
      coverageRatio: coverage(valueDatePostingCount, filtered.postings.length),
      distinctValueDateCount,
      distinctValueDateFrom,
      distinctValueDateTo,
      lagDistribution: [...lagCounts.entries()]
        .map(([lagDays, postingCount]) => ({ lagDays, postingCount }))
        .toSorted((left, right) => left.lagDays - right.lagDays),
      missingValueDateCount: filtered.postings.length - valueDatePostingCount,
      sameDayValueDateCount: lagCounts.get(0) ?? 0,
      totalPostingCount: filtered.postings.length,
      valueDatePostingCount,
    },
  };
}
