import { exportData } from "../../data/export.ts";
import { updateAccountsRegistry } from "./accounts-registry.ts";
import { updateCategoriesRegistry } from "./categories-registry.ts";
import { updateParsedData } from "./parsed-data.ts";

const [, parsedData] = await Promise.all([
    updateAccountsRegistry(exportData),
    updateParsedData(exportData),
]);

await updateCategoriesRegistry(parsedData);