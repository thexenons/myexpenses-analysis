import { join } from "node:path";
import type { ExportData, AccountsRegistry } from "./types.ts";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const rootPath = process.cwd();
const dataPath = join(rootPath, 'data');
const accountsRegistryFilePath = join(dataPath, 'accounts.json');

async function preloadCurrentAccountsRegistrys(): Promise<AccountsRegistry | undefined> {
    if (!existsSync(accountsRegistryFilePath)) return;

    return JSON.parse(await readFile(accountsRegistryFilePath, 'utf-8'))
}

export async function updateAccountsRegistry(data: ExportData): Promise<AccountsRegistry> {
    let accountsRegistry: AccountsRegistry = await preloadCurrentAccountsRegistrys() ?? {};

    for (const exportAccount of data) {
        if (exportAccount.label in accountsRegistry) continue;

        accountsRegistry[exportAccount.label] = 'DEFAULT';
    }

    await writeFile(accountsRegistryFilePath, JSON.stringify(accountsRegistry, null, 2), 'utf-8');

    return accountsRegistry;
}