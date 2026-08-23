import type { BackupDatasetV1 } from "../../src/domain/analytics/backup-dataset.types.ts";

export function createDatasetFixture(): BackupDatasetV1 {
    return {
        version: 1,
        source: {
            format: "myexpenses-backup",
            schemaVersion: 189,
            backupSha256: "a".repeat(64),
            databaseSha256: "b".repeat(64),
        },
        preferences: {
            homeCurrency: "EUR",
            timeZone: "Europe/Madrid",
            monthStart: 1,
            weekStart: 1,
            includeTransfers: false,
        },
        currencies: [
            {
                sourceId: 1,
                code: "EUR",
                fractionDigits: 2,
                label: "Fixture secret label",
                symbol: "€",
                commodityType: "FIAT",
            },
        ],
        accounts: [],
        categories: [],
        postings: [],
        payees: [],
        paymentMethods: [],
        tags: [],
        budgets: [],
    };
}
