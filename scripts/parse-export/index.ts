import { exportData } from "../../data/export.ts";
import { updateAccountsRegistry } from "./accounts-registry.ts";
import { updateParsedData } from "./parsed-data.ts";

await Promise.all([
    updateAccountsRegistry(exportData),
    updateParsedData(exportData),
]);
