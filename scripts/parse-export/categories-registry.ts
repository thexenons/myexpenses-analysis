import type {
    CategoriesRegistry,
    CategoryType,
    ParsedData,
} from "../types.ts";
import {
    CATEGORIES_REGISTRY_FILE_PATH,
    writeJsonAtomically,
} from "../files.ts";

function createRegistry(): CategoriesRegistry {
    return Object.create(null) as CategoriesRegistry;
}

function categoryTypeForRoot(category: string): CategoryType {
    if (category === "Transferencia") {
        return "TRANSFER";
    }
    if (category === "Gastos") {
        return "EXPENSE";
    }
    if (category === "Ingresos") {
        return "INCOME";
    }
    return "NEUTRAL";
}

/** Pure derivation that never uses externally controlled keys on prototypes. */
export function buildCategoriesRegistry(data: ParsedData): CategoriesRegistry {
    const categoriesRegistry = createRegistry();

    for (const account of data) {
        for (const transaction of account.transactions) {
            let parentRegistry = categoriesRegistry;
            const rootCategory = transaction.category[0];
            if (rootCategory === undefined) {
                throw new Error(`Transaction ${transaction.uuid} has no category`);
            }
            const categoryType = categoryTypeForRoot(rootCategory);
            for (const [index, category] of transaction.category.entries()) {
                if (!Object.hasOwn(parentRegistry, category)) {
                    parentRegistry[category] = { categoryType };
                }
                if (index < transaction.category.length - 1) {
                    const entry = parentRegistry[category];
                    if (entry === undefined) {
                        throw new Error("Category entry disappeared during construction");
                    }
                    entry.children ??= createRegistry();
                    parentRegistry = entry.children;
                }
            }
        }
    }

    return categoriesRegistry;
}

export async function saveCategoriesRegistry(
    categoriesRegistry: CategoriesRegistry,
    filePath = CATEGORIES_REGISTRY_FILE_PATH,
): Promise<void> {
    await writeJsonAtomically(filePath, categoriesRegistry);
}
