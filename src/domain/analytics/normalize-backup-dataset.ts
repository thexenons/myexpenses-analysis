import type {
  BackupAccountBalancesV1,
  BackupAccountV1,
  BackupBudgetFilterV1,
  BackupBudgetV1,
  BackupCategoryType,
  BackupCategoryV1,
  BackupCurrencyCode,
  BackupCurrencyV1,
  BackupDatasetV1,
  BackupFxSource,
  BackupPayeeV1,
  BackupPaymentMethodV1,
  BackupPostingV1,
  BackupSplitParentV1,
  BackupTagV1,
  BackupTransactionStatus,
} from "./backup-dataset.types.ts";
import type {
  AccountRegistryEntry,
  AnalyticsDataset,
  CategoriesRegistry,
  CategoryRegistryEntry,
  CategoryType,
  CurrencyCode,
  ExchangeRateSource,
  IsoDate,
  NormalizedAccount,
  NormalizedPosting,
  PostingBucket,
  TransactionStatus,
} from "./types.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CURRENCY_PATTERN = /^[A-Z][A-Z0-9]{2,11}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const validatedBackupDatasets = new WeakSet<object>();

type JsonObject = Record<string, unknown>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

function objectValue(value: unknown, context: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(context, "expected an object");
  }
  return value as JsonObject;
}

function exactKeys(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[],
  context: string,
): void {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      fail(context, `missing property ${JSON.stringify(key)}`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key)) {
      fail(context, `unexpected property ${JSON.stringify(key)}`);
    }
  }
}

function arrayValue(value: unknown, context: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return fail(context, "expected an array");
  }
  return value;
}

function stringValue(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(context, "expected a non-empty string");
  }
  return value;
}

function nullableString(value: unknown, context: string): string | null {
  return value === null ? null : stringValue(value, context);
}

function booleanValue(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    return fail(context, "expected a boolean");
  }
  return value;
}

function safeInteger(value: unknown, context: string, minimum?: number): number {
  if (!Number.isSafeInteger(value)) {
    return fail(context, "expected a safe integer");
  }
  const integer = value as number;
  if (minimum !== undefined && integer < minimum) {
    fail(context, `expected a value greater than or equal to ${minimum}`);
  }
  return integer === 0 ? 0 : integer;
}

function finiteNumber(value: unknown, context: string, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(context, "expected a finite number");
  }
  if (positive && value <= 0) {
    fail(context, "expected a positive number");
  }
  return value;
}

function nullableSafeInteger(value: unknown, context: string): number | null {
  return value === null ? null : safeInteger(value, context);
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  context: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    return fail(context, `expected one of ${values.join(", ")}`);
  }
  return value as Values[number];
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isoDate(value: unknown, context: string): IsoDate {
  if (typeof value !== "string") {
    return fail(context, "expected an ISO date string");
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return fail(context, `invalid ISO date ${JSON.stringify(value)}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    fail(context, `invalid calendar date ${value}`);
  }
  return value as IsoDate;
}

function nullableIsoDate(value: unknown, context: string): IsoDate | null {
  return value === null ? null : isoDate(value, context);
}

function localTime(value: unknown, context: string): string {
  if (typeof value !== "string" || !LOCAL_TIME_PATTERN.test(value)) {
    return fail(context, "expected local time HH:mm:ss");
  }
  return value;
}

function currencyCode(value: unknown, context: string): BackupCurrencyCode {
  if (typeof value !== "string" || !CURRENCY_PATTERN.test(value)) {
    return fail(context, "expected an uppercase currency or commodity code");
  }
  return value as BackupCurrencyCode;
}

function stringArray(value: unknown, context: string): readonly string[] {
  return arrayValue(value, context).map((entry, index) =>
    stringValue(entry, `${context}[${index}]`),
  );
}

function idArray(value: unknown, context: string): readonly number[] {
  const ids = arrayValue(value, context).map((entry, index) =>
    safeInteger(entry, `${context}[${index}]`, 0),
  );
  if (new Set(ids).size !== ids.length) {
    fail(context, "contains duplicate source ids");
  }
  return ids;
}

function validateCurrency(value: unknown, index: number): BackupCurrencyV1 {
  const context = `Backup dataset currencies[${index}]`;
  const object = objectValue(value, context);
  exactKeys(
    object,
    ["sourceId", "code", "fractionDigits", "label", "symbol", "commodityType"],
    [],
    context,
  );
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  currencyCode(object.code, `${context}.code`);
  const digits = safeInteger(object.fractionDigits, `${context}.fractionDigits`, 0);
  if (digits > 18) fail(`${context}.fractionDigits`, "must not exceed 18");
  if (object.label !== null) stringValue(object.label, `${context}.label`);
  if (object.symbol !== null) stringValue(object.symbol, `${context}.symbol`);
  if (object.commodityType !== null) {
    enumValue(
      object.commodityType,
      ["FIAT", "SECURITY", "CRYPTO"] as const,
      `${context}.commodityType`,
    );
  }
  return object as unknown as BackupCurrencyV1;
}

function validateAccount(value: unknown, index: number): BackupAccountV1 {
  const context = `Backup dataset accounts[${index}]`;
  const object = objectValue(value, context);
  exactKeys(
    object,
    [
      "uuid",
      "sourceId",
      "label",
      "description",
      "currency",
      "fractionDigits",
      "nativeType",
      "scope",
      "parentUuid",
      "openingNativeMinor",
      "openingHomeMinor",
      "exchangeRateMode",
      "exchangeRateToHome",
      "flags",
    ],
    ["balances"],
    context,
  );
  stringValue(object.uuid, `${context}.uuid`);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.label, `${context}.label`);
  nullableString(object.description, `${context}.description`);
  currencyCode(object.currency, `${context}.currency`);
  const digits = safeInteger(object.fractionDigits, `${context}.fractionDigits`, 0);
  if (digits > 18) fail(`${context}.fractionDigits`, "must not exceed 18");
  const nativeType = enumValue(
    object.nativeType,
    ["CASH", "BANK", "CCARD", "ASSET", "LIABILITY", "INVST"] as const,
    `${context}.nativeType`,
  );
  const scope = enumValue(
    object.scope,
    ["DEFAULT", "DEBT"] as const,
    `${context}.scope`,
  );
  if ((nativeType === "LIABILITY") !== (scope === "DEBT")) {
    fail(context, "LIABILITY native type and DEBT scope must agree");
  }
  nullableString(object.parentUuid, `${context}.parentUuid`);
  safeInteger(object.openingNativeMinor, `${context}.openingNativeMinor`);
  safeInteger(object.openingHomeMinor, `${context}.openingHomeMinor`);
  const mode = enumValue(
    object.exchangeRateMode,
    ["IDENTITY", "STATIC", "DYNAMIC"] as const,
    `${context}.exchangeRateMode`,
  );
  if (object.exchangeRateToHome !== null) {
    finiteNumber(object.exchangeRateToHome, `${context}.exchangeRateToHome`, true);
  }
  if (mode === "IDENTITY" && object.exchangeRateToHome !== 1) {
    fail(context, "IDENTITY account requires exchangeRateToHome=1");
  }
  if (mode === "STATIC" && object.exchangeRateToHome === null) {
    fail(context, "STATIC account requires exchangeRateToHome");
  }

  const flags = objectValue(object.flags, `${context}.flags`);
  exactKeys(
    flags,
    [
      "sourceId",
      "visible",
      "excludedFromTotals",
      "includedInAll",
      "isAsset",
      "supportsReconciliation",
    ],
    [],
    `${context}.flags`,
  );
  safeInteger(flags.sourceId, `${context}.flags.sourceId`, 0);
  for (const key of [
    "visible",
    "excludedFromTotals",
    "includedInAll",
    "isAsset",
    "supportsReconciliation",
  ] as const) {
    booleanValue(flags[key], `${context}.flags.${key}`);
  }

  if (object.balances !== undefined) {
    const balances = objectValue(object.balances, `${context}.balances`);
    exactKeys(
      balances,
      ["currentNativeMinor", "historicalHomeMinor", "valuationHomeMinor"],
      [],
      `${context}.balances`,
    );
    for (const key of [
      "currentNativeMinor",
      "historicalHomeMinor",
      "valuationHomeMinor",
    ] as const) {
      safeInteger(balances[key], `${context}.balances.${key}`);
    }
  }
  return object as unknown as BackupAccountV1;
}

function validateCategory(value: unknown, index: number): BackupCategoryV1 {
  const context = `Backup dataset categories[${index}]`;
  const object = objectValue(value, context);
  exactKeys(
    object,
    ["uuid", "sourceId", "name", "type", "parentUuid", "path", "color", "icon"],
    [],
    context,
  );
  stringValue(object.uuid, `${context}.uuid`);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  const name = stringValue(object.name, `${context}.name`);
  enumValue(
    object.type,
    ["TRANSFER", "EXPENSE", "INCOME", "NEUTRAL"] as const,
    `${context}.type`,
  );
  nullableString(object.parentUuid, `${context}.parentUuid`);
  const path = stringArray(object.path, `${context}.path`);
  if (path.length === 0 || path.at(-1) !== name) {
    fail(`${context}.path`, "must be non-empty and end with the category name");
  }
  if (object.color !== null) safeInteger(object.color, `${context}.color`);
  nullableString(object.icon, `${context}.icon`);
  return object as unknown as BackupCategoryV1;
}

function validateSplitParent(value: unknown, context: string): BackupSplitParentV1 {
  const object = objectValue(value, context);
  exactKeys(
    object,
    [
      "postingId",
      "sourceId",
      "transactionUuid",
      "epochSeconds",
      "localDate",
      "localTime",
      "amountNativeMinor",
      "comment",
      "payeeSourceId",
      "paymentMethodSourceId",
      "tagSourceIds",
    ],
    [],
    context,
  );
  stringValue(object.postingId, `${context}.postingId`);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.transactionUuid, `${context}.transactionUuid`);
  safeInteger(object.epochSeconds, `${context}.epochSeconds`);
  isoDate(object.localDate, `${context}.localDate`);
  localTime(object.localTime, `${context}.localTime`);
  safeInteger(object.amountNativeMinor, `${context}.amountNativeMinor`);
  nullableString(object.comment, `${context}.comment`);
  nullableSafeInteger(object.payeeSourceId, `${context}.payeeSourceId`);
  nullableSafeInteger(
    object.paymentMethodSourceId,
    `${context}.paymentMethodSourceId`,
  );
  idArray(object.tagSourceIds, `${context}.tagSourceIds`);
  return object as unknown as BackupSplitParentV1;
}

function validatePosting(value: unknown, index: number): BackupPostingV1 {
  const context = `Backup dataset postings[${index}]`;
  const object = objectValue(value, context);
  exactKeys(
    object,
    [
      "id",
      "sourceId",
      "transactionUuid",
      "sourceTransactionUuid",
      "accountUuid",
      "epochSeconds",
      "localDate",
      "localTime",
      "valueEpochSeconds",
      "valueLocalDate",
      "valueLocalTime",
      "amountNativeMinor",
      "amountHomeMinor",
      "categoryUuid",
      "categoryPath",
      "categoryType",
      "bucket",
      "status",
      "isVoid",
      "isArchivedContent",
      "payeeSourceId",
      "paymentMethodSourceId",
      "tagSourceIds",
      "comment",
      "referenceNumber",
      "originalAmountMinor",
      "originalCurrency",
      "split",
      "fxSource",
      "exchangeRateToHome",
    ],
    ["transferPeer"],
    context,
  );
  stringValue(object.id, `${context}.id`);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.transactionUuid, `${context}.transactionUuid`);
  stringValue(object.sourceTransactionUuid, `${context}.sourceTransactionUuid`);
  stringValue(object.accountUuid, `${context}.accountUuid`);
  safeInteger(object.epochSeconds, `${context}.epochSeconds`);
  isoDate(object.localDate, `${context}.localDate`);
  localTime(object.localTime, `${context}.localTime`);
  if (object.valueEpochSeconds !== null) {
    safeInteger(object.valueEpochSeconds, `${context}.valueEpochSeconds`);
  }
  if (object.valueLocalDate !== null) {
    isoDate(object.valueLocalDate, `${context}.valueLocalDate`);
  }
  if (object.valueLocalTime !== null) {
    localTime(object.valueLocalTime, `${context}.valueLocalTime`);
  }
  const valueDateParts = [
    object.valueEpochSeconds,
    object.valueLocalDate,
    object.valueLocalTime,
  ];
  if (
    !valueDateParts.every((part) => part === null) &&
    !valueDateParts.every((part) => part !== null)
  ) {
    fail(context, "value-date fields must either all exist or all be null");
  }
  const amount = safeInteger(object.amountNativeMinor, `${context}.amountNativeMinor`);
  safeInteger(object.amountHomeMinor, `${context}.amountHomeMinor`);
  nullableString(object.categoryUuid, `${context}.categoryUuid`);
  const path = stringArray(object.categoryPath, `${context}.categoryPath`);
  if ((object.categoryUuid === null) !== (path.length === 0)) {
    fail(context, "categoryUuid is null exactly when categoryPath is empty");
  }
  const validatedCategoryType = enumValue(
    object.categoryType,
    ["TRANSFER", "EXPENSE", "INCOME", "NEUTRAL"] as const,
    `${context}.categoryType`,
  );
  const bucket = enumValue(
    object.bucket,
    ["expense", "income", "transfer"] as const,
    `${context}.bucket`,
  );
  if (
    (validatedCategoryType === "TRANSFER" && bucket !== "transfer") ||
    (validatedCategoryType === "EXPENSE" && bucket !== "expense") ||
    (validatedCategoryType === "INCOME" && bucket !== "income") ||
    (validatedCategoryType === "NEUTRAL" && bucket === "transfer")
  ) {
    fail(context, "categoryType and bucket are inconsistent");
  }
  if (
    validatedCategoryType === "NEUTRAL" &&
    bucket !== (amount > 0 ? "income" : "expense")
  ) {
    fail(context, "neutral-category bucket must follow the amount sign");
  }
  const status = enumValue(
    object.status,
    ["UNRECONCILED", "CLEARED", "RECONCILED", "VOID"] as const,
    `${context}.status`,
  );
  const isVoid = booleanValue(object.isVoid, `${context}.isVoid`);
  if ((status === "VOID") !== isVoid) {
    fail(context, "status and isVoid disagree");
  }
  booleanValue(object.isArchivedContent, `${context}.isArchivedContent`);

  if (object.transferPeer !== undefined) {
    const peer = objectValue(object.transferPeer, `${context}.transferPeer`);
    exactKeys(
      peer,
      ["postingId", "sourceId", "transactionUuid", "accountUuid"],
      [],
      `${context}.transferPeer`,
    );
    stringValue(peer.postingId, `${context}.transferPeer.postingId`);
    safeInteger(peer.sourceId, `${context}.transferPeer.sourceId`, 0);
    stringValue(peer.transactionUuid, `${context}.transferPeer.transactionUuid`);
    stringValue(peer.accountUuid, `${context}.transferPeer.accountUuid`);
  }
  nullableSafeInteger(object.payeeSourceId, `${context}.payeeSourceId`);
  nullableSafeInteger(
    object.paymentMethodSourceId,
    `${context}.paymentMethodSourceId`,
  );
  idArray(object.tagSourceIds, `${context}.tagSourceIds`);
  nullableString(object.comment, `${context}.comment`);
  nullableString(object.referenceNumber, `${context}.referenceNumber`);
  nullableSafeInteger(object.originalAmountMinor, `${context}.originalAmountMinor`);
  if (object.originalCurrency !== null) {
    currencyCode(object.originalCurrency, `${context}.originalCurrency`);
  }
  if ((object.originalAmountMinor === null) !== (object.originalCurrency === null)) {
    fail(context, "original amount and currency must either both exist or both be null");
  }
  if (object.split !== null) {
    const split = objectValue(object.split, `${context}.split`);
    exactKeys(split, ["index", "count", "parent"], [], `${context}.split`);
    const splitIndex = safeInteger(split.index, `${context}.split.index`, 0);
    const splitCount = safeInteger(split.count, `${context}.split.count`, 1);
    if (splitIndex >= splitCount) {
      fail(`${context}.split`, "index must be smaller than count");
    }
    validateSplitParent(split.parent, `${context}.split.parent`);
  }
  const fxSource = enumValue(
    object.fxSource,
    [
      "HOME_CURRENCY",
      "STATIC_ACCOUNT_RATE",
      "DYNAMIC_EQUIVALENT",
      "DYNAMIC_SPLIT_PRORATION",
      "ZERO_AMOUNT_WITHOUT_RATE",
    ] as const,
    `${context}.fxSource`,
  );
  if (object.exchangeRateToHome !== null) {
    finiteNumber(object.exchangeRateToHome, `${context}.exchangeRateToHome`, true);
  }
  if (
    (fxSource === "ZERO_AMOUNT_WITHOUT_RATE") !==
    (object.exchangeRateToHome === null)
  ) {
    fail(
      context,
      "only ZERO_AMOUNT_WITHOUT_RATE may have a null exchangeRateToHome",
    );
  }
  if (
    fxSource === "ZERO_AMOUNT_WITHOUT_RATE" &&
    (object.amountNativeMinor !== 0 || object.amountHomeMinor !== 0)
  ) {
    fail(context, "ZERO_AMOUNT_WITHOUT_RATE requires zero native and home amounts");
  }
  return object as unknown as BackupPostingV1;
}

function validatePayee(value: unknown, index: number): BackupPayeeV1 {
  const context = `Backup dataset payees[${index}]`;
  const object = objectValue(value, context);
  exactKeys(object, ["sourceId", "name", "shortName", "parentSourceId"], [], context);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.name, `${context}.name`);
  nullableString(object.shortName, `${context}.shortName`);
  nullableSafeInteger(object.parentSourceId, `${context}.parentSourceId`);
  return object as unknown as BackupPayeeV1;
}

function validatePaymentMethod(
  value: unknown,
  index: number,
): BackupPaymentMethodV1 {
  const context = `Backup dataset paymentMethods[${index}]`;
  const object = objectValue(value, context);
  exactKeys(object, ["sourceId", "label", "type", "isNumbered", "icon"], [], context);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.label, `${context}.label`);
  enumValue(
    object.type,
    ["EXPENSE", "NEUTRAL", "INCOME"] as const,
    `${context}.type`,
  );
  booleanValue(object.isNumbered, `${context}.isNumbered`);
  nullableString(object.icon, `${context}.icon`);
  return object as unknown as BackupPaymentMethodV1;
}

function validateTag(value: unknown, index: number): BackupTagV1 {
  const context = `Backup dataset tags[${index}]`;
  const object = objectValue(value, context);
  exactKeys(object, ["sourceId", "name", "color"], [], context);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.name, `${context}.name`);
  if (object.color !== null) safeInteger(object.color, `${context}.color`);
  return object as unknown as BackupTagV1;
}

function validateBudgetFilter(
  value: unknown,
  context: string,
  depth = 0,
): BackupBudgetFilterV1 {
  if (depth > 32) fail(context, "filter nesting exceeds 32 levels");
  const object = objectValue(value, context);
  const type = stringValue(object.type, `${context}.type`);
  if (type === "and" || type === "or") {
    exactKeys(object, ["type", "criteria"], [], context);
    const criteria = arrayValue(object.criteria, `${context}.criteria`);
    if (criteria.length === 0 || criteria.length > 256) {
      fail(`${context}.criteria`, "expected between 1 and 256 criteria");
    }
    criteria.forEach((criterion, index) =>
      validateBudgetFilter(criterion, `${context}.criteria[${index}]`, depth + 1),
    );
  } else if (type === "not") {
    exactKeys(object, ["type", "criterion"], [], context);
    validateBudgetFilter(object.criterion, `${context}.criterion`, depth + 1);
  } else if (type === "account") {
    exactKeys(object, ["type", "accountUuids"], [], context);
    const uuids = stringArray(object.accountUuids, `${context}.accountUuids`);
    if (uuids.length === 0 || new Set(uuids).size !== uuids.length) {
      fail(`${context}.accountUuids`, "expected unique account UUIDs");
    }
  } else if (type === "category") {
    exactKeys(object, ["type", "categoryUuids"], [], context);
    const uuids = stringArray(object.categoryUuids, `${context}.categoryUuids`);
    if (uuids.length === 0 || new Set(uuids).size !== uuids.length) {
      fail(`${context}.categoryUuids`, "expected unique category UUIDs");
    }
  } else {
    fail(`${context}.type`, `unsupported budget filter ${JSON.stringify(type)}`);
  }
  return object as unknown as BackupBudgetFilterV1;
}

function validateBudgetFilterReferences(
  filter: BackupBudgetFilterV1,
  accountUuids: ReadonlySet<string>,
  categoryUuids: ReadonlySet<string>,
  context: string,
): void {
  if (filter.type === "and" || filter.type === "or") {
    filter.criteria.forEach((criterion, index) =>
      validateBudgetFilterReferences(
        criterion,
        accountUuids,
        categoryUuids,
        `${context}.criteria[${index}]`,
      ),
    );
  } else if (filter.type === "not") {
    validateBudgetFilterReferences(
      filter.criterion,
      accountUuids,
      categoryUuids,
      `${context}.criterion`,
    );
  } else if (filter.type === "account" || filter.type === "category") {
    const values = filter.type === "account" ? filter.accountUuids : filter.categoryUuids;
    const known = filter.type === "account" ? accountUuids : categoryUuids;
    for (const value of values) {
      if (!known.has(value)) fail(context, `unknown ${filter.type} UUID ${value}`);
    }
  } else {
    fail(context, "unsupported budget filter node");
  }
}

function validateBudget(value: unknown, index: number): BackupBudgetV1 {
  const context = `Backup dataset budgets[${index}]`;
  const object = objectValue(value, context);
  exactKeys(
    object,
    [
      "uuid",
      "sourceId",
      "title",
      "description",
      "grouping",
      "accountUuid",
      "currency",
      "startDate",
      "endDate",
      "isDefault",
      "filter",
      "aggregateNeutral",
      "allocations",
    ],
    [],
    context,
  );
  stringValue(object.uuid, `${context}.uuid`);
  safeInteger(object.sourceId, `${context}.sourceId`, 0);
  stringValue(object.title, `${context}.title`);
  if (typeof object.description !== "string") {
    fail(`${context}.description`, "expected a string");
  }
  enumValue(
    object.grouping,
    ["NONE", "DAY", "WEEK", "MONTH", "YEAR"] as const,
    `${context}.grouping`,
  );
  nullableString(object.accountUuid, `${context}.accountUuid`);
  if (object.currency !== null) currencyCode(object.currency, `${context}.currency`);
  nullableIsoDate(object.startDate, `${context}.startDate`);
  nullableIsoDate(object.endDate, `${context}.endDate`);
  booleanValue(object.isDefault, `${context}.isDefault`);
  if (object.filter !== null) {
    validateBudgetFilter(object.filter, `${context}.filter`);
  }
  booleanValue(object.aggregateNeutral, `${context}.aggregateNeutral`);
  for (const [allocationIndex, allocationValue] of arrayValue(
    object.allocations,
    `${context}.allocations`,
  ).entries()) {
    const allocationContext = `${context}.allocations[${allocationIndex}]`;
    const allocation = objectValue(allocationValue, allocationContext);
    exactKeys(
      allocation,
      [
        "categoryUuid",
        "year",
        "period",
        "amountMinor",
        "rolloverPreviousMinor",
        "rolloverNextMinor",
        "oneTime",
      ],
      [],
      allocationContext,
    );
    nullableString(allocation.categoryUuid, `${allocationContext}.categoryUuid`);
    nullableSafeInteger(allocation.year, `${allocationContext}.year`);
    nullableSafeInteger(allocation.period, `${allocationContext}.period`);
    nullableSafeInteger(allocation.amountMinor, `${allocationContext}.amountMinor`);
    safeInteger(
      allocation.rolloverPreviousMinor,
      `${allocationContext}.rolloverPreviousMinor`,
    );
    safeInteger(
      allocation.rolloverNextMinor,
      `${allocationContext}.rolloverNextMinor`,
    );
    booleanValue(allocation.oneTime, `${allocationContext}.oneTime`);
  }
  return object as unknown as BackupBudgetV1;
}

function uniqueBy<T>(
  values: readonly T[],
  key: (value: T) => string | number,
  context: string,
): void {
  const seen = new Set<string | number>();
  for (const value of values) {
    const candidate = key(value);
    if (seen.has(candidate)) fail(context, `duplicate value ${JSON.stringify(candidate)}`);
    seen.add(candidate);
  }
}

function validateTimeZone(value: unknown): string {
  const timeZone = stringValue(value, "Backup dataset preferences.timeZone");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
  } catch (error) {
    throw new Error(
      `Backup dataset preferences.timeZone: invalid IANA zone ${JSON.stringify(timeZone)}`,
      { cause: error },
    );
  }
  return timeZone;
}

function deepFreezeValidatedGraph(root: object): void {
  const pending: object[] = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const value of Object.values(current)) {
      if (typeof value === "object" && value !== null) pending.push(value);
    }
    Object.freeze(current);
  }
}

/** Strictly validates the complete, versioned browser boundary. */
export function parseBackupDataset(value: unknown): BackupDatasetV1 {
  if (
    typeof value === "object" &&
    value !== null &&
    validatedBackupDatasets.has(value)
  ) {
    return value as BackupDatasetV1;
  }
  const context = "Backup dataset";
  const root = objectValue(value, context);
  exactKeys(
    root,
    [
      "version",
      "source",
      "preferences",
      "currencies",
      "accounts",
      "categories",
      "postings",
      "payees",
      "paymentMethods",
      "tags",
      "budgets",
    ],
    [],
    context,
  );
  if (root.version !== 1) fail(context, "unsupported version; expected 1");

  const source = objectValue(root.source, `${context} source`);
  exactKeys(
    source,
    ["format", "schemaVersion", "backupSha256", "databaseSha256"],
    [],
    `${context} source`,
  );
  if (source.format !== "myexpenses-backup") {
    fail(`${context} source.format`, "expected myexpenses-backup");
  }
  if (source.schemaVersion !== 189) {
    fail(`${context} source.schemaVersion`, "expected schema 189");
  }
  for (const key of ["backupSha256", "databaseSha256"] as const) {
    if (typeof source[key] !== "string" || !SHA256_PATTERN.test(source[key])) {
      fail(`${context} source.${key}`, "expected a lowercase SHA-256 hex digest");
    }
  }

  const preferences = objectValue(root.preferences, `${context} preferences`);
  exactKeys(
    preferences,
    ["homeCurrency", "timeZone", "monthStart", "weekStart", "includeTransfers"],
    [],
    `${context} preferences`,
  );
  if (preferences.homeCurrency !== "EUR") {
    fail(`${context} preferences.homeCurrency`, "expected EUR");
  }
  validateTimeZone(preferences.timeZone);
  const monthStart = safeInteger(
    preferences.monthStart,
    `${context} preferences.monthStart`,
    1,
  );
  if (monthStart > 31) fail(`${context} preferences.monthStart`, "must not exceed 31");
  const weekStart = safeInteger(
    preferences.weekStart,
    `${context} preferences.weekStart`,
    1,
  );
  if (weekStart > 7) fail(`${context} preferences.weekStart`, "must not exceed 7");
  booleanValue(preferences.includeTransfers, `${context} preferences.includeTransfers`);

  const currencies = arrayValue(root.currencies, `${context} currencies`).map(
    validateCurrency,
  );
  const accounts = arrayValue(root.accounts, `${context} accounts`).map(validateAccount);
  const categories = arrayValue(root.categories, `${context} categories`).map(
    validateCategory,
  );
  const postings = arrayValue(root.postings, `${context} postings`).map(validatePosting);
  const payees = arrayValue(root.payees, `${context} payees`).map(validatePayee);
  const paymentMethods = arrayValue(
    root.paymentMethods,
    `${context} paymentMethods`,
  ).map(validatePaymentMethod);
  const tags = arrayValue(root.tags, `${context} tags`).map(validateTag);
  const budgets = arrayValue(root.budgets, `${context} budgets`).map(validateBudget);

  uniqueBy(currencies, (entry) => entry.sourceId, `${context} currency source ids`);
  uniqueBy(currencies, (entry) => entry.code, `${context} currency codes`);
  uniqueBy(accounts, (entry) => entry.sourceId, `${context} account source ids`);
  uniqueBy(accounts, (entry) => entry.uuid, `${context} account UUIDs`);
  uniqueBy(categories, (entry) => entry.sourceId, `${context} category source ids`);
  uniqueBy(categories, (entry) => entry.uuid, `${context} category UUIDs`);
  uniqueBy(postings, (entry) => entry.sourceId, `${context} posting source ids`);
  uniqueBy(postings, (entry) => entry.id, `${context} posting ids`);
  uniqueBy(payees, (entry) => entry.sourceId, `${context} payee source ids`);
  uniqueBy(
    paymentMethods,
    (entry) => entry.sourceId,
    `${context} payment-method source ids`,
  );
  uniqueBy(tags, (entry) => entry.sourceId, `${context} tag source ids`);
  uniqueBy(budgets, (entry) => entry.sourceId, `${context} budget source ids`);
  uniqueBy(budgets, (entry) => entry.uuid, `${context} budget UUIDs`);

  const currencyByCode = new Map(currencies.map((entry) => [entry.code, entry]));
  const accountByUuid = new Map(accounts.map((entry) => [entry.uuid, entry]));
  const categoryByUuid = new Map(categories.map((entry) => [entry.uuid, entry]));
  const postingById = new Map(postings.map((entry) => [entry.id, entry]));
  const payeeIds = new Set(payees.map((entry) => entry.sourceId));
  const paymentMethodIds = new Set(paymentMethods.map((entry) => entry.sourceId));
  const tagIds = new Set(tags.map((entry) => entry.sourceId));
  const homeCurrency = currencyByCode.get(preferences.homeCurrency);
  if (homeCurrency === undefined) {
    fail(context, "home currency is missing from the currency registry");
  }
  if (homeCurrency.fractionDigits !== 2) {
    fail(context, "EUR home currency must define fractionDigits=2");
  }

  for (const account of accounts) {
    const currency = currencyByCode.get(account.currency);
    if (currency === undefined) fail(`Account ${account.uuid}`, "unknown currency");
    if (currency.fractionDigits !== account.fractionDigits) {
      fail(`Account ${account.uuid}`, "fractionDigits disagree with currency metadata");
    }
    if (account.parentUuid !== null && !accountByUuid.has(account.parentUuid)) {
      fail(`Account ${account.uuid}`, "unknown parentUuid");
    }
    if (
      (account.exchangeRateMode === "IDENTITY") !==
      (account.currency === preferences.homeCurrency)
    ) {
      fail(
        `Account ${account.uuid}`,
        "IDENTITY mode must be used exactly for the home currency",
      );
    }
  }

  for (const category of categories) {
    if (category.parentUuid === null) {
      if (category.path.length !== 1) fail(`Category ${category.uuid}`, "invalid root path");
    } else {
      const parent = categoryByUuid.get(category.parentUuid);
      if (parent === undefined) fail(`Category ${category.uuid}`, "unknown parentUuid");
      const expected = [...parent.path, category.name];
      if (JSON.stringify(category.path) !== JSON.stringify(expected)) {
        fail(`Category ${category.uuid}`, "path does not extend its parent path");
      }
    }
  }

  for (const posting of postings) {
    const account = accountByUuid.get(posting.accountUuid);
    if (account === undefined) fail(`Posting ${posting.id}`, "unknown accountUuid");
    if (
      (posting.fxSource === "HOME_CURRENCY") !==
      (account.currency === preferences.homeCurrency)
    ) {
      fail(
        `Posting ${posting.id}`,
        "HOME_CURRENCY FX source must be used exactly for home-currency postings",
      );
    }
    if (
      posting.fxSource === "HOME_CURRENCY" &&
      posting.exchangeRateToHome !== 1
    ) {
      fail(`Posting ${posting.id}`, "HOME_CURRENCY requires exchangeRateToHome=1");
    }
    if (posting.categoryUuid !== null) {
      const category = categoryByUuid.get(posting.categoryUuid);
      if (category === undefined) fail(`Posting ${posting.id}`, "unknown categoryUuid");
      if (
        category.type !== posting.categoryType ||
        JSON.stringify(category.path) !== JSON.stringify(posting.categoryPath)
      ) {
        fail(`Posting ${posting.id}`, "category metadata disagrees with registry");
      }
    }
    if (
      posting.originalCurrency !== null &&
      !currencyByCode.has(posting.originalCurrency)
    ) {
      fail(`Posting ${posting.id}`, "unknown originalCurrency");
    }
    if (posting.payeeSourceId !== null && !payeeIds.has(posting.payeeSourceId)) {
      fail(`Posting ${posting.id}`, "unknown payeeSourceId");
    }
    if (
      posting.paymentMethodSourceId !== null &&
      !paymentMethodIds.has(posting.paymentMethodSourceId)
    ) {
      fail(`Posting ${posting.id}`, "unknown paymentMethodSourceId");
    }
    for (const tagId of posting.tagSourceIds) {
      if (!tagIds.has(tagId)) fail(`Posting ${posting.id}`, `unknown tag id ${tagId}`);
    }
    if (posting.transferPeer !== undefined) {
      const peer = postingById.get(posting.transferPeer.postingId);
      if (
        peer === undefined ||
        peer.sourceId !== posting.transferPeer.sourceId ||
        peer.transactionUuid !== posting.transferPeer.transactionUuid ||
        peer.accountUuid !== posting.transferPeer.accountUuid
      ) {
        fail(`Posting ${posting.id}`, "transferPeer does not identify an actual posting");
      }
      if (peer.transferPeer?.postingId !== posting.id) {
        fail(`Posting ${posting.id}`, "transferPeer relation is not reciprocal");
      }
    }
    if (posting.split !== null) {
      const parent = posting.split.parent;
      if (posting.sourceTransactionUuid !== parent.transactionUuid) {
        fail(`Posting ${posting.id}`, "split sourceTransactionUuid is not its parent UUID");
      }
      if (parent.payeeSourceId !== null && !payeeIds.has(parent.payeeSourceId)) {
        fail(`Posting ${posting.id}`, "split parent has unknown payeeSourceId");
      }
      if (
        parent.paymentMethodSourceId !== null &&
        !paymentMethodIds.has(parent.paymentMethodSourceId)
      ) {
        fail(`Posting ${posting.id}`, "split parent has unknown paymentMethodSourceId");
      }
      for (const tagId of parent.tagSourceIds) {
        if (!tagIds.has(tagId)) {
          fail(`Posting ${posting.id}`, `split parent has unknown tag id ${tagId}`);
        }
        if (!posting.tagSourceIds.includes(tagId)) {
          fail(
            `Posting ${posting.id}`,
            "effective tagSourceIds do not include every parent tag",
          );
        }
      }
    } else if (posting.sourceTransactionUuid !== posting.transactionUuid) {
      fail(`Posting ${posting.id}`, "direct posting has invalid sourceTransactionUuid");
    }
  }

  for (const payee of payees) {
    if (payee.parentSourceId !== null && !payeeIds.has(payee.parentSourceId)) {
      fail(`Payee ${payee.sourceId}`, "unknown parentSourceId");
    }
  }
  for (const budget of budgets) {
    if (budget.accountUuid !== null && !accountByUuid.has(budget.accountUuid)) {
      fail(`Budget ${budget.uuid}`, "unknown accountUuid");
    }
    if (budget.currency !== null && !currencyByCode.has(budget.currency)) {
      fail(`Budget ${budget.uuid}`, "unknown currency");
    }
    if (budget.filter !== null) {
      validateBudgetFilterReferences(
        budget.filter,
        new Set(accountByUuid.keys()),
        new Set(categoryByUuid.keys()),
        `Budget ${budget.uuid}.filter`,
      );
    }
    for (const allocation of budget.allocations) {
      if (
        allocation.categoryUuid !== null &&
        !categoryByUuid.has(allocation.categoryUuid)
      ) {
        fail(`Budget ${budget.uuid}`, "allocation has unknown categoryUuid");
      }
    }
  }

  deepFreezeValidatedGraph(root);
  validatedBackupDatasets.add(root);
  return root as unknown as BackupDatasetV1;
}

function addMinor(left: number, right: number, context: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) fail(context, "minor-unit sum exceeds safe range");
  return sum === 0 ? 0 : sum;
}

function transactionStatus(status: BackupTransactionStatus): TransactionStatus {
  return status;
}

function legacyFxSource(source: BackupFxSource): ExchangeRateSource {
  switch (source) {
    case "HOME_CURRENCY":
    case "ZERO_AMOUNT_WITHOUT_RATE":
      return "identity";
    case "STATIC_ACCOUNT_RATE":
      return "static";
    case "DYNAMIC_EQUIVALENT":
    case "DYNAMIC_SPLIT_PRORATION":
      return "dynamic-equivalent";
  }
}

function categoryType(value: BackupCategoryType): CategoryType {
  return value;
}

function postingBucket(value: BackupPostingV1["bucket"]): PostingBucket {
  return value;
}

function rateForMajorUnits(
  ratePerMinor: number,
  nativeFractionDigits: number,
  homeFractionDigits: number,
): number {
  const rate = ratePerMinor * 10 ** (nativeFractionDigits - homeFractionDigits);
  if (!Number.isFinite(rate) || rate <= 0) {
    fail("Backup dataset", "exchange rate cannot be represented safely");
  }
  return rate;
}

function categoriesRegistry(categories: readonly BackupCategoryV1[]): CategoriesRegistry {
  type MutableEntry = {
    categoryType: CategoryType;
    children?: Record<string, MutableEntry>;
  };
  const root: Record<string, MutableEntry> = {};
  const ordered = categories.toSorted((left, right) => left.path.length - right.path.length);
  for (const category of ordered) {
    let level = root;
    for (const [index, name] of category.path.entries()) {
      const existing = level[name];
      const entry =
        existing ??
        ({ categoryType: categoryType(category.type) } satisfies MutableEntry);
      level[name] = entry;
      if (index < category.path.length - 1) {
        entry.children ??= {};
        level = entry.children;
      } else {
        entry.categoryType = categoryType(category.type);
      }
    }
  }
  return root as Readonly<Record<string, CategoryRegistryEntry>>;
}

function accountRegistryEntry(
  account: BackupAccountV1,
  homeFractionDigits: number,
): AccountRegistryEntry {
  const rate = account.exchangeRateToHome;
  return {
    label: account.label,
    type: account.scope,
    ...(account.exchangeRateMode === "IDENTITY"
      ? {}
      : { exchangeRateMode: account.exchangeRateMode }),
    ...(rate === null
      ? {}
      : {
          exchangeRateToEur: rateForMajorUnits(
            rate,
            account.fractionDigits,
            homeFractionDigits,
          ),
        }),
  };
}

function normalizePosting(
  posting: BackupPostingV1,
  account: BackupAccountV1,
  homeFractionDigits: number,
  payees: ReadonlyMap<number, BackupPayeeV1>,
  methods: ReadonlyMap<number, BackupPaymentMethodV1>,
  tags: ReadonlyMap<number, BackupTagV1>,
  accounts: ReadonlyMap<string, BackupAccountV1>,
  currencies: ReadonlyMap<string, BackupCurrencyV1>,
): NormalizedPosting {
  const payee =
    posting.payeeSourceId === null ? undefined : payees.get(posting.payeeSourceId);
  const method =
    posting.paymentMethodSourceId === null
      ? undefined
      : methods.get(posting.paymentMethodSourceId);
  const tagNames = posting.tagSourceIds.map((id) => tags.get(id)!.name);
  const split = posting.split;
  const parentPayee =
    split?.parent.payeeSourceId === null || split === null
      ? undefined
      : payees.get(split.parent.payeeSourceId);
  const parentMethod =
    split?.parent.paymentMethodSourceId === null || split === null
      ? undefined
      : methods.get(split.parent.paymentMethodSourceId);
  const parentTags =
    split === null
      ? []
      : split.parent.tagSourceIds.map((id) => tags.get(id)!.name);
  const peerAccount =
    posting.transferPeer === undefined
      ? undefined
      : accounts.get(posting.transferPeer.accountUuid);
  const rate =
    posting.exchangeRateToHome === null
      ? 1
      : rateForMajorUnits(
          posting.exchangeRateToHome,
          account.fractionDigits,
          homeFractionDigits,
        );
  const searchAliases = [
    ...(payee?.shortName === null || payee?.shortName === undefined
      ? []
      : [payee.name]),
    ...(parentPayee?.shortName === null || parentPayee?.shortName === undefined
      ? []
      : [parentPayee.name]),
  ];

  return {
    id: posting.id,
    transactionId: posting.transactionUuid,
    sourceTransactionId: posting.sourceTransactionUuid,
    accountId: account.uuid,
    accountLabel: account.label,
    accountType: account.scope,
    currency: account.currency as CurrencyCode,
    fractionDigits: account.fractionDigits,
    date: posting.localDate as IsoDate,
    sourceRowId: posting.sourceId,
    epochSeconds: posting.epochSeconds,
    localTime: posting.localTime,
    ...(posting.valueLocalDate === null
      ? {}
      : {
          valueDate: posting.valueLocalDate as IsoDate,
          valueTime: posting.valueLocalTime!,
        }),
    amountNativeMinor: posting.amountNativeMinor,
    amountEurMinor: posting.amountHomeMinor,
    exchangeRateToEur: rate,
    exchangeRateSource: legacyFxSource(posting.fxSource),
    backupFxSource: posting.fxSource,
    ...(posting.categoryUuid === null ? {} : { categoryUuid: posting.categoryUuid }),
    categoryPath: [...posting.categoryPath],
    categoryType: categoryType(posting.categoryType),
    bucket: postingBucket(posting.bucket),
    status: transactionStatus(posting.status),
    backupStatus: posting.status,
    isVoid: posting.isVoid,
    isArchivedContent: posting.isArchivedContent,
    linked: posting.transferPeer !== undefined,
    ...(posting.transferPeer === undefined
      ? {}
      : {
          transferPeerPostingId: posting.transferPeer.postingId,
          ...(peerAccount === undefined ? {} : { transferAccount: peerAccount.label }),
        }),
    tags: [...new Set(tagNames)],
    tagSourceIds: [...posting.tagSourceIds],
    ...(posting.comment === null ? {} : { comment: posting.comment }),
    ...(payee === undefined
      ? {}
      : {
          payee: payee.shortName ?? payee.name,
          payeeSourceId: posting.payeeSourceId!,
        }),
    ...(method === undefined
      ? {}
      : {
          paymentMethod: method.label,
          paymentMethodSourceId: posting.paymentMethodSourceId!,
        }),
    ...(posting.referenceNumber === null
      ? {}
      : { referenceNumber: posting.referenceNumber }),
    ...(posting.originalAmountMinor === null
      ? {}
      : {
          originalAmountMinor: posting.originalAmountMinor,
          originalCurrency: posting.originalCurrency as CurrencyCode,
          originalFractionDigits: currencies.get(posting.originalCurrency!)!
            .fractionDigits,
        }),
    splitIndex: split?.index ?? null,
    splitCount: split?.count ?? null,
    ...(split === null
      ? {}
      : {
          splitParentSourceId: split.parent.sourceId,
          splitParentPostingId: split.parent.postingId,
          ...(parentMethod === undefined
            ? {}
            : { parentPaymentMethod: parentMethod.label }),
          parent: {
            date: split.parent.localDate as IsoDate,
            amount:
              split.parent.amountNativeMinor / 10 ** account.fractionDigits,
            amountNativeMinor: split.parent.amountNativeMinor,
            localTime: split.parent.localTime,
            ...(split.parent.comment === null
              ? {}
              : { comment: split.parent.comment }),
            ...(parentPayee === undefined
              ? {}
              : { payee: parentPayee.shortName ?? parentPayee.name }),
            ...(parentMethod === undefined
              ? {}
              : { paymentMethod: parentMethod.label }),
            ...(parentTags.length === 0 ? {} : { tags: [...new Set(parentTags)] }),
          },
        }),
    ...(searchAliases.length === 0 ? {} : { searchAliases }),
  };
}

function earliest(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate < current ? candidate : current;
}

function latest(current: IsoDate | null, candidate: IsoDate): IsoDate {
  return current === null || candidate > current ? candidate : current;
}

interface AccountAccumulator {
  activePostingCount: number;
  currentNativeMinor: number;
  historicalHomeMinor: number;
  postingCount: number;
}

function accountBalances(
  account: BackupAccountV1,
  accumulator: AccountAccumulator,
): BackupAccountBalancesV1 {
  const { currentNativeMinor, historicalHomeMinor } = accumulator;
  if (
    account.balances !== undefined &&
    (account.balances.currentNativeMinor !== currentNativeMinor ||
      account.balances.historicalHomeMinor !== historicalHomeMinor)
  ) {
    fail(`Account ${account.uuid}`, "declared balances disagree with canonical postings");
  }
  return (
    account.balances ?? {
      currentNativeMinor,
      historicalHomeMinor,
      valuationHomeMinor: historicalHomeMinor,
    }
  );
}

/** Adapts pre-converted backup postings without recalculating any FX amount. */
export function normalizeBackupDataset(value: BackupDatasetV1): AnalyticsDataset {
  // The HTTP repository validates immediately after JSON.parse. Reuse that
  // read-only object instead of walking ~13k postings a second time.
  const source = validatedBackupDatasets.has(value)
    ? value
    : parseBackupDataset(value);
  const homeCurrency = source.currencies.find(
    (currency) => currency.code === source.preferences.homeCurrency,
  )!;
  const accountByUuid = new Map(source.accounts.map((account) => [account.uuid, account]));
  const payeeById = new Map(source.payees.map((payee) => [payee.sourceId, payee]));
  const methodById = new Map(
    source.paymentMethods.map((method) => [method.sourceId, method]),
  );
  const tagById = new Map(source.tags.map((tag) => [tag.sourceId, tag]));
  const currencyByCode = new Map(
    source.currencies.map((currency) => [currency.code, currency]),
  );
  const accountAccumulators = new Map(
    source.accounts.map((account) => [
      account.uuid,
      {
        activePostingCount: 0,
        currentNativeMinor: account.openingNativeMinor,
        historicalHomeMinor: account.openingHomeMinor,
        postingCount: 0,
      },
    ]),
  );
  let minDate: IsoDate | null = null;
  let maxDate: IsoDate | null = null;

  const postings = source.postings.map((posting) => {
    const account = accountByUuid.get(posting.accountUuid)!;
    const normalized = normalizePosting(
      posting,
      account,
      homeCurrency.fractionDigits,
      payeeById,
      methodById,
      tagById,
      accountByUuid,
      currencyByCode,
    );
    const accumulator = accountAccumulators.get(account.uuid)!;
    accumulator.postingCount += 1;
    if (!normalized.isVoid) {
      accumulator.activePostingCount += 1;
      accumulator.currentNativeMinor = addMinor(
        accumulator.currentNativeMinor,
        normalized.amountNativeMinor,
        `Account ${account.uuid} current balance`,
      );
      accumulator.historicalHomeMinor = addMinor(
        accumulator.historicalHomeMinor,
        normalized.amountEurMinor,
        `Account ${account.uuid} historical balance`,
      );
    }
    minDate = earliest(minDate, normalized.date);
    maxDate = latest(maxDate, normalized.date);
    return normalized;
  });

  const accounts: NormalizedAccount[] = source.accounts.map((account) => {
    const accumulator = accountAccumulators.get(account.uuid)!;
    const balances = accountBalances(account, accumulator);
    return {
      id: account.uuid,
      label: account.label,
      currency: account.currency as CurrencyCode,
      fractionDigits: account.fractionDigits,
      type: account.scope,
      exchangeRateMode: account.exchangeRateMode,
      openingBalanceNativeMinor: account.openingNativeMinor,
      openingBalanceEurMinor: account.openingHomeMinor,
      currentBalanceNativeMinor: balances.currentNativeMinor,
      historicalBalanceEurMinor: balances.historicalHomeMinor,
      valuationBalanceEurMinor: balances.valuationHomeMinor,
      postingCount: accumulator.postingCount,
      activePostingCount: accumulator.activePostingCount,
      sourceRowId: account.sourceId,
      nativeType: account.nativeType,
      ...(account.description === null ? {} : { description: account.description }),
      visible: account.flags.visible,
      excludedFromTotals: account.flags.excludedFromTotals,
      includedInAll: account.flags.includedInAll,
      supportsReconciliation: account.flags.supportsReconciliation,
    };
  });

  return {
    currency: "EUR",
    source: {
      accounts: {
        version: 2,
        accounts: Object.fromEntries(
          source.accounts.map((account) => [
            account.uuid,
            accountRegistryEntry(account, homeCurrency.fractionDigits),
          ]),
        ),
      },
      categories: categoriesRegistry(source.categories),
    },
    accounts,
    postings,
    minDate,
    maxDate,
    backup: {
      source: source.source,
      preferences: source.preferences,
      currencies: source.currencies,
      accounts: source.accounts,
      categories: source.categories,
      payees: source.payees,
      paymentMethods: source.paymentMethods,
      tags: source.tags,
      budgets: source.budgets,
    },
  };
}
