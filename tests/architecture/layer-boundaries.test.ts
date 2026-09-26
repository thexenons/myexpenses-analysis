import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseSync, traverse, types as t } from "@babel/core";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_ROOT = join(PROJECT_ROOT, "src");
const AUDITED_ROOTS = [
  SOURCE_ROOT,
  join(PROJECT_ROOT, "scripts"),
  join(PROJECT_ROOT, "tests"),
] as const;
const LAYER_DEPENDENCIES: Readonly<Record<string, ReadonlySet<string>>> = {
  application: new Set(["application", "domain"]),
  composition: new Set(["application", "composition", "domain", "infrastructure"]),
  domain: new Set(["domain"]),
  infrastructure: new Set(["application", "domain", "infrastructure"]),
  presentation: new Set(["application", "domain", "presentation"]),
};
const TECHNICAL_NAME = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

function filesBelow(root: string): readonly string[] {
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.tsx?$/u.test(entry.name)) result.push(path);
    }
  };
  visit(root);
  return result;
}

function projectPath(path: string): string {
  return relative(PROJECT_ROOT, path).split(sep).join("/");
}

function sourceFile(path: string, contents = readFileSync(path, "utf8")): t.File {
  const source = parseSync(contents, {
    babelrc: false,
    configFile: false,
    filename: path,
    parserOpts: {
      sourceType: "module",
      createImportExpressions: true,
      plugins: extname(path) === ".tsx" ? ["typescript", "jsx"] : ["typescript"],
    },
  });
  assert.ok(source, `Could not parse ${projectPath(path)}`);
  return source;
}

function moduleSpecifiers(source: t.File): readonly string[] {
  const result: string[] = [];
  traverse(source, {
    noScope: true,
    enter({ node }) {
      if (
        (t.isImportDeclaration(node) ||
          t.isExportNamedDeclaration(node) ||
          t.isExportAllDeclaration(node) ||
          t.isImportExpression(node)) &&
        t.isStringLiteral(node.source)
      ) {
        result.push(node.source.value);
      }
    },
  });
  return result;
}

function isWildcardExport(statement: t.Statement): boolean {
  return (
    t.isExportAllDeclaration(statement) ||
    (t.isExportNamedDeclaration(statement) &&
      statement.specifiers.some((specifier) => t.isExportNamespaceSpecifier(specifier)))
  );
}

test("architecture parser preserves imports and wildcard exports across TypeScript and JSX", () => {
  const source = sourceFile(join(SOURCE_ROOT, "architecture-fixture.tsx"), `
    import type { Props } from "./types";
    import "./side-effect";
    export { value } from "./named";
    export * from "./all";
    export * as namespace from "./namespace";
    export const View = (props: Props) => <div>{props.value}</div>;
    async function load() { return import("./lazy"); }
    const unrelated = "import('./text-only')";
    // export * from "./comment-only";
  `);

  assert.deepEqual(moduleSpecifiers(source), [
    "./types", "./side-effect", "./named", "./all", "./namespace", "./lazy",
  ]);
  assert.deepEqual(source.program.body.filter(isWildcardExport).map((node) => node.type), [
    "ExportAllDeclaration", "ExportNamedDeclaration",
  ]);
  assert.equal(
    sourceFile(join(SOURCE_ROOT, "architecture-fixture.ts"), "const value = <number>1;").type,
    "File",
  );
});

test("production modules respect clean-architecture dependency direction", () => {
  const violations: string[] = [];
  for (const path of filesBelow(SOURCE_ROOT)) {
    if (basename(path).includes(".test.")) continue;
    const sourceLayer = relative(SOURCE_ROOT, path).split(sep)[0];
    const allowed = LAYER_DEPENDENCIES[sourceLayer as keyof typeof LAYER_DEPENDENCIES];
    if (allowed === undefined) {
      if (dirname(path) !== SOURCE_ROOT) {
        violations.push(`${projectPath(path)} belongs to an unknown source layer`);
      }
      continue;
    }

    for (const specifier of moduleSpecifiers(sourceFile(path))) {
      if (!specifier.startsWith(".")) continue;
      const target = normalize(resolve(dirname(path), specifier.split("?", 1)[0]!));
      const targetRelative = relative(SOURCE_ROOT, target);
      if (targetRelative.startsWith("..") || targetRelative === "") continue;
      const targetLayer = targetRelative.split(sep)[0]!;
      if (!allowed.has(targetLayer)) {
        violations.push(
          `${projectPath(path)} imports ${targetLayer} through ${JSON.stringify(specifier)}`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("TypeScript modules never use wildcard exports", () => {
  const violations = AUDITED_ROOTS.flatMap(filesBelow).flatMap((path) =>
    sourceFile(path).program.body.flatMap((statement) =>
      isWildcardExport(statement) ? [projectPath(path)] : [],
    ),
  );

  assert.deepEqual(violations, []);
});

test("non-presentation TypeScript paths use lowercase technical names", () => {
  const roots = [
    join(SOURCE_ROOT, "application"),
    join(SOURCE_ROOT, "composition"),
    join(SOURCE_ROOT, "domain"),
    join(SOURCE_ROOT, "infrastructure"),
    join(PROJECT_ROOT, "scripts"),
    join(PROJECT_ROOT, "tests"),
  ];
  const violations = roots.flatMap(filesBelow).flatMap((path) => {
    const relativePath = projectPath(path);
    const segments = relativePath.split("/");
    return segments
      .filter((segment) => !TECHNICAL_NAME.test(segment.replace(/\.tsx?$/u, "")))
      .map((segment) => `${relativePath}: invalid technical name ${JSON.stringify(segment)}`);
  });

  assert.deepEqual(violations, []);
});
