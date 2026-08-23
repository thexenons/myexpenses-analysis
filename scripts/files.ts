import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function writeJsonAtomically(
    filePath: string,
    value: unknown,
    pretty = true,
    maximumBytes?: number,
): Promise<void> {
    if (
        maximumBytes !== undefined &&
        (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1)
    ) {
        throw new Error("JSON output size limit must be a positive safe integer");
    }
    const source = JSON.stringify(value, null, pretty ? 2 : undefined);
    if (source === undefined) {
        throw new Error("JSON output value is not serializable");
    }
    if (
        maximumBytes !== undefined &&
        Buffer.byteLength(source, "utf8") > maximumBytes
    ) {
        throw new Error("JSON output exceeds its size limit");
    }

    const directoryPath = dirname(filePath);
    await mkdir(directoryPath, { recursive: true });
    const directory = await lstat(directoryPath);
    if (!directory.isDirectory() || directory.isSymbolicLink()) {
        throw new Error("JSON output parent must be a real directory");
    }
    const temporaryPath = join(
        directoryPath,
        `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );

    try {
        await writeFile(
            temporaryPath,
            source,
            {
                encoding: "utf8",
                flag: "wx",
                mode: 0o600,
            },
        );
        await rename(temporaryPath, filePath);
    } finally {
        await rm(temporaryPath, { force: true });
    }
}
