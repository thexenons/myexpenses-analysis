import { pathToFileURL } from "node:url";

import { runSyncPCloudWorker } from "./worker.ts";

export async function runSyncPCloudWorkerMain(): Promise<number> {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    try {
        await runSyncPCloudWorker(process.env, {
            logger: { info: (message) => process.stdout.write(`${message}\n`) },
            signal: controller.signal,
        });
        return 0;
    } catch {
        process.stderr.write("pCloud worker failed to start or bootstrap.\n");
        return 1;
    } finally {
        process.off("SIGTERM", stop);
        process.off("SIGINT", stop);
    }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
    process.exitCode = await runSyncPCloudWorkerMain();
}
