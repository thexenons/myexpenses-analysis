import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createBackupZipFixture, createImportDatabaseFixture } from "../../scripts/import-backup/test-fixtures.ts";
import { importBackup } from "../../scripts/import-backup/import-backup.ts";
import type { BackupDatasetV1, BackupPostingV1 } from "../../src/domain/analytics/backup-dataset.types.ts";
import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";

const FIRST_DAY = Date.UTC(2024, 8, 1, 12);
const DAY_MS = 86_400_000;
const DAY_SPAN = 729;
const LOCAL_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  timeZone: "Europe/Madrid",
});

function uuid(index: number): string {
  return `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

/** Use the real synthetic importer once; all measured sizes extend the same seed. */
export async function createImportedHistorySeed(directory: string): Promise<BackupDatasetV1> {
  const archive = join(directory, "synthetic-history.zip");
  const output = join(directory, "synthetic-history.json");
  const database = await createImportDatabaseFixture({ extraSql: [
    "INSERT INTO categories (_id, uuid, label, parent_id, type) VALUES (14, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Food', 10, 1)",
    "INSERT INTO budget_allocations (budget_id, cat_id, year, second, budget, rollOverPrevious, rollOverNext, oneTime) VALUES (1, 10, 2026, 7, 100, 0, 0, 0)",
  ] });
  await writeFile(archive, await createBackupZipFixture({ database }), { mode: 0o600 });
  await importBackup({
    inputPath: archive, outputPath: output, timeZone: "Europe/Madrid",
    backupFilenameTimestamp: "20260822210453", importedAt: "2026-08-23T10:00:00.000Z",
  });
  return parseBackupDataset(JSON.parse(await readFile(output, "utf8")));
}

/** Exact posting count; hashes identify this deterministic synthetic derivative, not a real backup. */
export function makeSyntheticHistory(seed: BackupDatasetV1, count: number): BackupDatasetV1 {
  if (!Number.isSafeInteger(count) || count < 10 || count % 10 !== 0) {
    throw new Error("Synthetic history count must be a positive multiple of 10");
  }
  const cash = seed.accounts.find((account) => account.scope === "DEFAULT" && account.currency === "EUR");
  const debt = seed.accounts.find((account) => account.scope === "DEBT" && account.currency === "EUR");
  const expense = seed.categories.find((category) => category.type === "EXPENSE" && category.parentUuid === null);
  const food = seed.categories.find((category) => category.name === "Food");
  const income = seed.categories.find((category) => category.type === "INCOME");
  const transfer = seed.categories.find((category) => category.type === "TRANSFER");
  if (!cash || !debt || !expense || !food || !income || !transfer) throw new Error("Incomplete imported fixture");
  const categories = [expense, food, income, expense, expense, expense, transfer, transfer, income, expense];
  const amounts = [-100, -250, 300, -75, 25, -50, -40, 40, 150, -120];
  const postings: BackupPostingV1[] = Array.from({ length: count }, (_, index) => {
    const kind = index % 10;
    const cohort = Math.floor(index / 10);
    const date = new Date(FIRST_DAY + Math.floor(cohort * DAY_SPAN / Math.max(1, count / 10 - 1)) * DAY_MS);
    const valueDate = new Date(date.getTime() + (index % 4 === 0 ? DAY_MS : 0));
    const account = kind === 3 || kind === 7 || kind === 8 ? debt : cash;
    const category = categories[kind]!;
    const transferIndex = kind === 7 ? index - 1 : index;
    const transactionUuid = uuid(transferIndex);
    const peerIndex = kind === 6 ? index + 1 : index - 1;
    const peerAccount = kind === 6 ? debt : cash;
    const isTransfer = kind === 6 || kind === 7;
    return {
      id: `${account.uuid}:${transactionUuid}`,
      sourceId: 1_000 + index,
      transactionUuid,
      sourceTransactionUuid: transactionUuid,
      accountUuid: account.uuid,
      epochSeconds: date.getTime() / 1_000,
      localDate: date.toISOString().slice(0, 10),
      localTime: LOCAL_TIME.format(date),
      valueEpochSeconds: valueDate.getTime() / 1_000,
      valueLocalDate: valueDate.toISOString().slice(0, 10),
      valueLocalTime: LOCAL_TIME.format(valueDate),
      amountNativeMinor: amounts[kind]!,
      amountHomeMinor: amounts[kind]!,
      categoryUuid: category.uuid,
      categoryPath: category.path,
      categoryType: category.type,
      bucket: isTransfer ? "transfer" : kind === 2 || kind === 8 ? "income" : "expense",
      status: kind === 5 ? "VOID" : kind % 2 === 0 ? "RECONCILED" : "CLEARED",
      isVoid: kind === 5,
      isArchivedContent: false,
      ...(isTransfer ? { transferPeer: {
        postingId: `${peerAccount.uuid}:${uuid(Math.min(index, peerIndex))}`,
        sourceId: 1_000 + peerIndex,
        transactionUuid,
        accountUuid: peerAccount.uuid,
      } } : {}),
      payeeSourceId: kind === 0 ? seed.payees[0]?.sourceId ?? null : null,
      paymentMethodSourceId: kind === 1 ? seed.paymentMethods[0]?.sourceId ?? null : null,
      tagSourceIds: kind === 1 ? [seed.tags[0]?.sourceId ?? 1] : [],
      comment: kind === 0 ? "perf-marker synthetic expense" : null,
      referenceNumber: null,
      originalAmountMinor: null,
      originalCurrency: null,
      split: null,
      fxSource: "HOME_CURRENCY",
      exchangeRateToHome: 1,
    };
  });
  const accounts = seed.accounts.map((account) => {
    const copy = { ...account };
    Reflect.deleteProperty(copy, "balances");
    return copy;
  });
  const fingerprint = createHash("sha256")
    .update(`synthetic-history-v1:${seed.source.databaseSha256}:${count}`)
    .digest("hex");
  return {
    ...seed,
    source: { ...seed.source, backupSha256: fingerprint, databaseSha256: fingerprint },
    accounts,
    postings,
  };
}
