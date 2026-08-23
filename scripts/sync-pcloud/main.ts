import { pathToFileURL } from "node:url";

import { runSyncPCloudCli } from "./cli.ts";
import { processBackupForStaticRelease } from "./process-backup.ts";

export async function runSyncPCloudMain(
    args: readonly string[],
): Promise<number> {
    return runSyncPCloudCli(args, {
        processBackup: processBackupForStaticRelease,
    });
}

const entryPoint = process.argv[1];
if (
    entryPoint !== undefined &&
    import.meta.url === pathToFileURL(entryPoint).href
) {
    process.exitCode = await runSyncPCloudMain(process.argv.slice(2));
}
