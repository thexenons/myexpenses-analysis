import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseBackupDataset } from "../../src/domain/analytics/normalize-backup-dataset.ts";
import { importBackup } from "./import-backup.ts";
import {
    createBackupZipFixture,
    createImportDatabaseFixture,
    SAFE_PREFERENCES_XML_FIXTURE,
} from "./test-fixtures.ts";

function sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

test("imports a synthetic v189 backup deterministically with complete provenance", async () => {
    const directoryPath = await mkdtemp(
        join(tmpdir(), "myexpenses-import-backup-test-"),
    );
    const inputPath = join(directoryPath, "backup.zip");
    const firstOutputPath = join(directoryPath, "first.json");
    const secondOutputPath = join(directoryPath, "second.json");
    try {
        const database = await createImportDatabaseFixture();
        const backup = await createBackupZipFixture({ database });
        await writeFile(inputPath, backup);

        const firstResult = await importBackup({
            inputPath,
            outputPath: firstOutputPath,
            timeZone: "Europe/Madrid",
        });
        const secondResult = await importBackup({
            inputPath,
            outputPath: secondOutputPath,
            timeZone: "Europe/Madrid",
        });
        const [firstBytes, secondBytes] = await Promise.all([
            readFile(firstOutputPath),
            readFile(secondOutputPath),
        ]);

        assert.deepEqual(firstBytes, secondBytes);
        assert.equal((await lstat(firstOutputPath)).mode & 0o777, 0o600);
        assert.equal((await lstat(secondOutputPath)).mode & 0o777, 0o600);
        assert.doesNotMatch(firstBytes.toString("utf8"), /\r|\n/u);
        assert.deepEqual(firstResult, {
            accountCount: 4,
            budgetCount: 1,
            categoryCount: 4,
            outputPath: firstOutputPath,
            postingCount: 11,
        });
        assert.equal(secondResult.postingCount, 11);

        const dataset = parseBackupDataset(
            JSON.parse(firstBytes.toString("utf8")) as unknown,
        );
        assert.equal(dataset.source.backupSha256, sha256(backup));
        assert.equal(dataset.source.databaseSha256, sha256(database));
        assert.deepEqual(dataset.preferences, {
            homeCurrency: "EUR",
            timeZone: "Europe/Madrid",
            monthStart: 1,
            weekStart: 1,
            includeTransfers: false,
        });

        const debt = dataset.accounts.find((account) => account.sourceId === 2);
        assert.equal(debt?.nativeType, "LIABILITY");
        assert.equal(debt?.scope, "DEBT");
        assert.deepEqual(debt?.balances, {
            currentNativeMinor: 250,
            historicalHomeMinor: 250,
            valuationHomeMinor: 250,
        });

        const transfer = dataset.postings.find((posting) => posting.sourceId === 4);
        const peer = dataset.postings.find((posting) => posting.sourceId === 5);
        assert.equal(transfer?.categoryType, "TRANSFER");
        assert.equal(transfer?.bucket, "transfer");
        assert.equal(transfer?.transferPeer?.postingId, peer?.id);
        assert.equal(peer?.transferPeer?.postingId, transfer?.id);

        const voidPosting = dataset.postings.find(
            (posting) => posting.sourceId === 3,
        );
        assert.equal(voidPosting?.status, "VOID");
        assert.equal(voidPosting?.isVoid, true);
        assert.equal(voidPosting?.amountNativeMinor, 999);
        assert.equal(voidPosting?.valueEpochSeconds, null);
        assert.equal(voidPosting?.valueLocalDate, null);
        assert.equal(voidPosting?.valueLocalTime, null);

        const split = dataset.postings.find((posting) => posting.sourceId === 7);
        assert.equal(split?.sourceTransactionUuid, split?.split?.parent.transactionUuid);
        assert.equal(split?.payeeSourceId, 1);
        assert.equal(split?.paymentMethodSourceId, 1);
        assert.equal(split?.comment, "Parent comment");
        assert.deepEqual(split?.tagSourceIds, [1, 2]);
        assert.equal(split?.split?.parent.payeeSourceId, 2);
        assert.equal(split?.split?.parent.paymentMethodSourceId, 2);
        assert.deepEqual(split?.split?.parent.tagSourceIds, [2]);

        const staticFx = dataset.postings.find(
            (posting) => posting.sourceId === 9,
        );
        const dynamicFx = dataset.postings.find(
            (posting) => posting.sourceId === 10,
        );
        const dynamicSplit = dataset.postings.find(
            (posting) => posting.sourceId === 12,
        );
        assert.equal(staticFx?.fxSource, "STATIC_ACCOUNT_RATE");
        assert.equal(staticFx?.amountHomeMinor, 20);
        assert.equal(dynamicFx?.fxSource, "DYNAMIC_EQUIVALENT");
        assert.equal(dynamicFx?.amountHomeMinor, 30);
        assert.equal(dynamicSplit?.fxSource, "DYNAMIC_SPLIT_PRORATION");
        assert.equal(dynamicSplit?.amountHomeMinor, 100);

        assert.deepEqual(
            dataset.paymentMethods.map((method) => method.type),
            ["NEUTRAL", "EXPENSE", "INCOME"],
        );
        assert.equal(dataset.budgets[0]?.currency, null);
        assert.equal(dataset.budgets[0]?.allocations[0]?.categoryUuid, null);
        assert.equal(
            dataset.budgets[0]?.allocations[1]?.categoryUuid,
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        );

        const serialized = firstBytes.toString("utf8");
        assert.doesNotMatch(
            serialized,
            /PRIVATE-IBAN|PRIVATE-BIC|fixture-secret|licence_email/iu,
        );
        assert.deepEqual((await readdir(directoryPath)).toSorted(), [
            "backup.zip",
            "first.json",
            "second.json",
        ]);
    } finally {
        await rm(directoryPath, { force: true, recursive: true });
    }
});

test("leaves an existing output untouched when required preferences are missing", async () => {
    const directoryPath = await mkdtemp(
        join(tmpdir(), "myexpenses-import-backup-atomic-test-"),
    );
    const inputPath = join(directoryPath, "backup.zip");
    const outputPath = join(directoryPath, "dataset.json");
    try {
        const database = await createImportDatabaseFixture();
        const preferencesWithoutWeekStart = SAFE_PREFERENCES_XML_FIXTURE.replace(
            /\s*<string name="group_week_start">2<\/string>/u,
            "",
        );
        await writeFile(
            inputPath,
            await createBackupZipFixture({
                database,
                preferencesXml: preferencesWithoutWeekStart,
            }),
        );
        await writeFile(outputPath, "existing-output", "utf8");

        await assert.rejects(
            importBackup({
                inputPath,
                outputPath,
                timeZone: "Europe/Madrid",
            }),
            /group_week_start.*missing/iu,
        );
        assert.equal(await readFile(outputPath, "utf8"), "existing-output");
    } finally {
        await rm(directoryPath, { force: true, recursive: true });
    }
});

test("requires explicit distinct paths and an explicit valid time zone", async () => {
    await assert.rejects(
        importBackup({ inputPath: "", outputPath: "out.json", timeZone: "UTC" }),
        /inputPath.*explicit/iu,
    );
    await assert.rejects(
        importBackup({
            inputPath: "same.zip",
            outputPath: "same.zip",
            timeZone: "UTC",
        }),
        /output path must differ/iu,
    );
    await assert.rejects(
        importBackup({
            inputPath: "backup.zip",
            outputPath: "out.json",
            timeZone: "",
        }),
        /timeZone is required/iu,
    );
});
