import { pathToFileURL } from "node:url";

import { runSyncPCloudCli } from "./cli.ts";
import { processBackupForStaticRelease } from "./process-backup.ts";

export async function runSyncPCloudMain(
    args: readonly string[],
): Promise<number> {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    try {
        return await runSyncPCloudCli(args, {
            processBackup: processBackupForStaticRelease,
        }, undefined, controller.signal);
    } finally {
        process.off("SIGTERM", stop);
        process.off("SIGINT", stop);
    }
}

const entryPoint = process.argv[1];
if (
    entryPoint !== undefined &&
    import.meta.url === pathToFileURL(entryPoint).href
) {
    process.exitCode = await runSyncPCloudMain(process.argv.slice(2));
}
