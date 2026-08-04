import { join } from "node:path";
import type { CategoriesRegistry, ParsedData } from "../types.ts";
import { readFile, writeFile } from "node:fs/promises";

const rootPath = process.cwd();
const dataPath = join(rootPath, "data");
const categoriesRegistryFilePath = join(dataPath, "categories.json");

export async function getCategoriesRegistry(): Promise<CategoriesRegistry> {
    return JSON.parse(await readFile(categoriesRegistryFilePath, "utf-8"));
}

export async function updateCategoriesRegistry(
    data: ParsedData,
): Promise<CategoriesRegistry> {
    let categoriesRegistry: CategoriesRegistry = {};

    for (const exportAccount of data) {
        for (const transaction of exportAccount.transactions) {
            let parentCategory: CategoriesRegistry | undefined = categoriesRegistry;
            let categoryType: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'NEUTRAL' = 'NEUTRAL';
            for (const [index, category] of transaction.category.entries()) {
                if (categoryType === 'NEUTRAL') {
                    if (category === 'Transferencia') {
                        categoryType = 'TRANSFER';
                    } else if (category === 'Gastos') {
                        categoryType = 'EXPENSE';
                    } else if (category === 'Ingresos') {
                        categoryType = 'INCOME';
                    }
                }
                if (!parentCategory[category]) {
                    parentCategory[category] = {
                        categoryType,
                    };
                }
                if (index !== transaction.category.length - 1) {
                    parentCategory = parentCategory[category].children ??= {};
                }
            }
        }
    }

    await writeFile(
        categoriesRegistryFilePath,
        JSON.stringify(categoriesRegistry, null, 2),
        "utf-8",
    );

    return categoriesRegistry;
}
