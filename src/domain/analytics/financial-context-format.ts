import type { createFinancialContext } from "./financial-context.ts";

type Cell = string | number | boolean | null | readonly string[];
type Row = Record<string, Cell | undefined>;
interface Column {
  name: string;
  values: Cell[];
  dictionary?: Cell[];
  cost: number;
}

const utf8 = new TextEncoder();
const bytes = (value: unknown) => utf8.encode(JSON.stringify(value)).length;
const cellsCost = (values: readonly Cell[]) => values.reduce<number>((sum, value) => sum + bytes(value), 0);

/** Dictionaries only encode strings/arrays. Numeric financial values stay literal. */
function encodeColumn(name: string, values: Cell[]): Column {
  const literal = { name, values, cost: cellsCost(values) };
  if (!values.every((value) => value === null || typeof value === "string" || Array.isArray(value))) return literal;
  const dictionary: Cell[] = [];
  const indexes = new Map<string, number>();
  const encoded = values.map((value) => {
    if (value === null) return null;
    const key = JSON.stringify(value);
    let index = indexes.get(key);
    if (index === undefined) {
      index = dictionary.length;
      indexes.set(key, index);
      dictionary.push(value);
    }
    return index;
  });
  const cost = cellsCost(encoded) + bytes({ [name]: dictionary });
  return cost < literal.cost ? { name, values: encoded, dictionary, cost } : literal;
}

function compactTransactions(rows: readonly Row[]) {
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const defaults: Record<string, Cell> = {};
  const missing: Record<string, number[]> = {};
  const columns: Column[] = [];
  const rawColumns = new Map<string, Cell[]>();
  for (const name of fields) {
    const absent: number[] = [];
    const present: Cell[] = [];
    const values = rows.map((row, index) => {
      const value = row[name];
      if (value === undefined) absent.push(index);
      else present.push(value);
      return value ?? null;
    });
    // Undefined fields were already absent in the original JSON.
    if (present.length === 0) continue;
    if (absent.length > 0) missing[name] = absent;
    const first = present[0]!;
    const key = JSON.stringify(first);
    if (present.every((value) => JSON.stringify(value) === key)) {
      defaults[name] = first;
    } else {
      rawColumns.set(name, values);
      columns.push(encodeColumn(name, values));
    }
  }

  // Original identifiers remain available once, not replaced with invented IDs.
  const idColumns = columns.filter(({ name }) => (name === "id" || name.endsWith("Id"))
    && rawColumns.get(name)!.every((value) => value === null || typeof value === "string"));
  const idValues: string[] = [];
  const idIndexes = new Map<string, number>();
  const pooled = idColumns.map((column) => rawColumns.get(column.name)!.map((value) => {
    if (value === null) return null;
    const id = value as string;
    let index = idIndexes.get(id);
    if (index === undefined) {
      index = idValues.length;
      idIndexes.set(id, index);
      idValues.push(id);
    }
    return index;
  }));
  const pool = { columns: idColumns.map(({ name }) => name), values: idValues };
  const poolCost = bytes({ identifiers: pool }) + pooled.reduce((sum, values) => sum + cellsCost(values), 0);
  const usePool = idColumns.length > 1 && poolCost < idColumns.reduce((sum, column) => sum + column.cost, 0);
  if (usePool) idColumns.forEach((column, index) => { column.values = pooled[index]!; delete column.dictionary; });

  const dictionaries = Object.fromEntries(columns.filter((column) => column.dictionary).map((column) => [column.name, column.dictionary]));
  return {
    columns: columns.map(({ name }) => name),
    ...(Object.keys(defaults).length ? { defaults } : {}),
    ...(Object.keys(dictionaries).length ? { dictionaries } : {}),
    ...(usePool ? { identifiers: pool } : {}),
    ...(Object.keys(missing).length ? { missing } : {}),
    rows: rows.map((_, index) => columns.map((column) => column.values[index]!)),
  };
}

/** Versioned wire format only: calculations, scope selection and original values are unchanged. */
export function serializeFinancialContext(context: ReturnType<typeof createFinancialContext>): string {
  const { schemaVersion, transactions, ...rest } = context;
  return JSON.stringify({
    schemaVersion: 2,
    encoding: {
      sourceSchemaVersion: schemaVersion,
      transactions: "Table: each rows[r][c] is the value of columns[c] for posting r; all indexes are zero-based. Row order is preserved. Start each posting with literal defaults, then assign its row cells. Default fields have no row cells.",
      references: "For non-null cells only: columns listed in identifiers.columns use identifiers.values[cell]; columns in dictionaries use dictionaries[columnName][cell]; all other cells are literal. Defaults are always literal, never references. Identifier values are the original IDs. Dictionary arrays are whole values, not further references.",
      missing: "Finally, delete field f from rows listed in missing[f]. Those fields were absent, not null. Null cells otherwise mean null; zero, false and empty strings/arrays remain distinct. Omitted defaults/dictionaries/identifiers/missing mean none.",
      interpretation: "All other sections retain their original structure and units. Read semantics and scope before analysis; do not add summaries to their supporting transactions. To reconstruct the original JSON, expand transactions, restore sourceSchemaVersion and remove encoding.",
    },
    ...rest,
    transactions: compactTransactions(transactions),
  });
}
