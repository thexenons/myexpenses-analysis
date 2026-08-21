import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    ACCOUNTS_REGISTRY_FILE_PATH,
    CATEGORIES_REGISTRY_FILE_PATH,
    PARSED_DATA_FILE_PATH,
    readJsonFile,
    writeJsonAtomically,
} from "../files.ts";
import type {
    AccountsRegistry,
    CategoriesRegistry,
    ParsedData,
} from "../types.ts";
import { FrankfurterExchangeRateProvider } from "./exchange-rates.ts";
import { generateStatistics } from "./index.ts";

const dataDirectory = fileURLToPath(new URL("../../data/", import.meta.url));
const exchangeRatesFilePath = resolve(dataDirectory, "exchange-rates.json");
const statisticsFilePath = resolve(dataDirectory, "statistics.json");

async function readJson<T>(path: string): Promise<T> {
    return (await readJsonFile(path)) as T;
}

export async function main(): Promise<void> {
    const [parsedData, accountsRegistry, categoriesRegistry] =
        await Promise.all([
            readJson<ParsedData>(PARSED_DATA_FILE_PATH),
            readJson<AccountsRegistry>(ACCOUNTS_REGISTRY_FILE_PATH),
            readJson<CategoriesRegistry>(CATEGORIES_REGISTRY_FILE_PATH),
        ]);

    const exchangeRateProvider = new FrankfurterExchangeRateProvider({
        cacheFilePath: exchangeRatesFilePath,
    });
    let generationError: unknown;

    try {
        const statistics = await generateStatistics(
            parsedData,
            accountsRegistry,
            categoriesRegistry,
            exchangeRateProvider,
        );
        await exchangeRateProvider.flush();
        await writeJsonAtomically(statisticsFilePath, statistics, false);
    } catch (error) {
        generationError = error;
    }

    let flushError: unknown;
    try {
        await exchangeRateProvider.flush();
    } catch (error) {
        flushError = error;
    }

    if (generationError !== undefined && flushError !== undefined) {
        throw new AggregateError(
            [generationError, flushError],
            "Statistics generation and exchange-rate cache flush failed",
        );
    }
    if (flushError !== undefined) {
        throw new Error("Exchange-rate cache flush failed", {
            cause: flushError,
        });
    }

    if (generationError !== undefined) {
        throw new Error("Statistics generation failed", {
            cause: generationError,
        });
    }
}

const entryPoint = process.argv[1];
if (
    entryPoint !== undefined &&
    import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
    await main();
}
