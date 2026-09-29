import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";

import { SyncConfigError } from "./config.ts";

export interface SyncPCloudCliEnvironmentOptions {
    readonly cwd?: string;
    readonly environment?: NodeJS.ProcessEnv;
}

/** Parse data, never execute shell code or mutate the process environment. */
export async function loadSyncPCloudCliEnvironment({
    cwd = process.cwd(),
    environment = process.env,
}: SyncPCloudCliEnvironmentOptions = {}): Promise<NodeJS.ProcessEnv> {
    let contents: string;
    try {
        contents = await readFile(join(cwd, ".env"), "utf8");
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return { ...environment };
        }
        throw new SyncConfigError("The .env file could not be loaded");
    }
    try {
        const result = parseEnv(contents);
        for (const [key, value] of Object.entries(environment)) {
            if (value !== undefined) result[key] = value;
        }
        return result;
    } catch {
        throw new SyncConfigError("The .env file could not be loaded");
    }
}
