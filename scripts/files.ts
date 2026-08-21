import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ACCOUNTS_REGISTRY_FILE_PATH = fileURLToPath(
    new URL("../data/accounts.json", import.meta.url),
);
export const CATEGORIES_REGISTRY_FILE_PATH = fileURLToPath(
    new URL("../data/categories.json", import.meta.url),
);
export const PARSED_DATA_FILE_PATH = fileURLToPath(
    new URL("../data/parsed-data.json", import.meta.url),
);

function isFileNotFoundError(error: unknown): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}

export async function readJsonFile(filePath: string): Promise<unknown> {
    let source: string;
    try {
        source = await readFile(filePath, "utf8");
    } catch (error) {
        throw new Error(`Could not read JSON file ${filePath}`, { cause: error });
    }

    try {
        return JSON.parse(source) as unknown;
    } catch (error) {
        throw new Error(`Invalid JSON in ${filePath}`, { cause: error });
    }
}

export async function readOptionalJsonFile(
    filePath: string,
): Promise<unknown | undefined> {
    try {
        return await readJsonFile(filePath);
    } catch (error) {
        if (
            error instanceof Error &&
            error.cause !== undefined &&
            isFileNotFoundError(error.cause)
        ) {
            return undefined;
        }
        throw error;
    }
}

export async function writeJsonAtomically(
    filePath: string,
    value: unknown,
    pretty = true,
): Promise<void> {
    const directoryPath = dirname(filePath);
    await mkdir(directoryPath, { recursive: true });
    const temporaryPath = join(
        directoryPath,
        `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );

    try {
        await writeFile(
            temporaryPath,
            JSON.stringify(value, null, pretty ? 2 : undefined),
            {
                encoding: "utf8",
                flag: "wx",
            },
        );
        await rename(temporaryPath, filePath);
    } finally {
        await rm(temporaryPath, { force: true });
    }
}
