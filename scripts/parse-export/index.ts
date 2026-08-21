import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { exportData } from "../../data/export.ts";
import type {
    AccountsRegistry,
    CategoriesRegistry,
    ParsedData,
} from "../types.ts";
import {
    buildAccountsRegistry,
    loadAccountsRegistrySource,
    saveAccountsRegistry,
} from "./accounts-registry.ts";
import {
    buildCategoriesRegistry,
    saveCategoriesRegistry,
} from "./categories-registry.ts";
import { parseExportData, saveParsedData } from "./parsed-data.ts";
import { validateExportData } from "./validation.ts";

export interface ParseExportArtifacts {
    accountsRegistry: AccountsRegistry;
    categoriesRegistry: CategoriesRegistry;
    parsedData: ParsedData;
}

/** Validates first, then derives every artifact without I/O or partial state. */
export function buildParseExportArtifacts(
    value: unknown,
    previousAccountsRegistry?: unknown,
): ParseExportArtifacts {
    const validatedExportData = validateExportData(value);
    const parsedData = parseExportData(validatedExportData);
    return {
        accountsRegistry: buildAccountsRegistry(
            validatedExportData,
            previousAccountsRegistry,
        ),
        categoriesRegistry: buildCategoriesRegistry(parsedData),
        parsedData,
    };
}

export async function runParseExport(
    value: unknown = exportData,
): Promise<ParseExportArtifacts> {
    const previousAccountsRegistry = await loadAccountsRegistrySource();
    const artifacts = buildParseExportArtifacts(
        value,
        previousAccountsRegistry,
    );

    await Promise.all([
        saveAccountsRegistry(artifacts.accountsRegistry),
        saveCategoriesRegistry(artifacts.categoriesRegistry),
        saveParsedData(artifacts.parsedData),
    ]);
    return artifacts;
}

const entryPoint = process.argv[1];
if (
    entryPoint !== undefined &&
    pathToFileURL(resolve(entryPoint)).href === import.meta.url
) {
    void runParseExport().catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    });
}
