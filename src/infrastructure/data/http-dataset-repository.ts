import type { DatasetRepository } from "../../application/ports/dataset-repository.ts";
import type { AppDataset } from "../../domain/analytics/types.ts";

const DATA_ENDPOINTS = {
  accounts: "accounts.json",
  categories: "categories.json",
  parsedData: "parsed-data.json",
} as const satisfies Readonly<Record<keyof AppDataset, string>>;

type DatasetKey = keyof typeof DATA_ENDPOINTS;
type JsonValidator = (value: unknown) => boolean;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const validators: Record<DatasetKey, JsonValidator> = {
  accounts: (value) =>
    isJsonObject(value) && value.version === 2 && isJsonObject(value.accounts),
  categories: isJsonObject,
  parsedData: Array.isArray,
};

function endpointUrl(fileName: string): string {
  return `${import.meta.env.BASE_URL}data/${fileName}`;
}

async function fetchJson<Key extends DatasetKey>(
  datasetKey: Key,
  signal?: AbortSignal,
): Promise<AppDataset[Key]> {
  let response: Response;
  try {
    response = await fetch(endpointUrl(DATA_ENDPOINTS[datasetKey]), {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    throw new Error(`Could not fetch ${datasetKey} data`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Could not fetch ${datasetKey} data: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  if (contentType === null || !/\bapplication\/json\b/i.test(contentType)) {
    throw new Error(
      `Could not fetch ${datasetKey} data: expected a JSON response`,
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    throw new Error(`Could not parse ${datasetKey} data as JSON`, {
      cause: error,
    });
  }
  if (!validators[datasetKey](value)) {
    throw new Error(`Invalid ${datasetKey} data shape`);
  }
  return value as AppDataset[Key];
}

export const httpDatasetRepository: DatasetRepository = {
  async load(signal) {
    const [accounts, categories, parsedData] = await Promise.all([
      fetchJson("accounts", signal),
      fetchJson("categories", signal),
      fetchJson("parsedData", signal),
    ]);
    return { accounts, categories, parsedData };
  },
};
