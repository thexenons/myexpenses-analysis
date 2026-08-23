import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

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

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(
    projectPath(path),
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    extname(path) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function moduleSpecifiers(source: ts.SourceFile): readonly string[] {
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (node.arguments.length === 1 && argument !== undefined && ts.isStringLiteral(argument)) {
        result.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

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
    sourceFile(path).statements.flatMap((statement) =>
      ts.isExportDeclaration(statement) &&
      (statement.exportClause === undefined || ts.isNamespaceExport(statement.exportClause))
        ? [projectPath(path)]
        : [],
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
