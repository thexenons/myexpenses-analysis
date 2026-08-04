import { join } from "node:path";
import type { ExportData, AccountsRegistry } from "../types.ts";
import { readFile, writeFile } from "node:fs/promises";

const rootPath = process.cwd();
const dataPath = join(rootPath, "data");
const accountsRegistryFilePath = join(dataPath, "accounts.json");

export async function getAccountsRegistry(): Promise<AccountsRegistry> {
	return JSON.parse(await readFile(accountsRegistryFilePath, "utf-8"));
}

export async function updateAccountsRegistry(
	data: ExportData,
): Promise<AccountsRegistry> {
	let accountsRegistry: AccountsRegistry = (await getAccountsRegistry()) ?? {};

	for (const exportAccount of data) {
		if (exportAccount.label in accountsRegistry) continue;

		accountsRegistry[exportAccount.label] = "DEFAULT";
	}

	await writeFile(
		accountsRegistryFilePath,
		JSON.stringify(accountsRegistry, null, 2),
		"utf-8",
	);

	return accountsRegistry;
}
