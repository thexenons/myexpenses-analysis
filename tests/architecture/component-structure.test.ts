import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PRESENTATION_ROOT = join(PROJECT_ROOT, "src/presentation");
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

interface PresentationTree {
  readonly directories: readonly string[];
  readonly files: readonly string[];
}

function readTree(root: string): PresentationTree {
  const directories: string[] = [];
  const files: string[] = [];

  function visit(directory: string): void {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of entries) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        directories.push(path);
        visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }

  visit(root);

  return { directories, files };
}

function presentationPath(path: string): string {
  return relative(PRESENTATION_ROOT, path).split(sep).join("/");
}

function assertNoViolations(message: string, violations: readonly string[]): void {
  assert.equal(
    violations.length,
    0,
    `${message}${violations.length === 0 ? "" : `:\n- ${violations.join("\n- ")}`}`,
  );
}

function isComponentDirectory(directory: string): boolean {
  const name = basename(directory);
  return PASCAL_CASE.test(name) && presentationFiles.has(join(directory, `${name}.tsx`));
}

function sourceFileFor(path: string): ts.SourceFile {
  const scriptKind = extname(path) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

  return ts.createSourceFile(
    presentationPath(path),
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}

function sourceLocation(sourceFile: ts.SourceFile, node: ts.Node): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${sourceFile.fileName}:${line + 1}`;
}

function isReactComponentWrapper(expression: ts.Expression): boolean {
  if (!ts.isCallExpression(expression)) {
    return false;
  }

  const callee = expression.expression;
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : "";

  return name === "forwardRef" || name === "lazy" || name === "memo";
}

function isReactClass(node: ts.ClassDeclaration): boolean {
  return (
    node.heritageClauses?.some((clause) =>
      clause.types.some((heritageType) => {
        const expression = heritageType.expression;
        const name = ts.isIdentifier(expression)
          ? expression.text
          : ts.isPropertyAccessExpression(expression)
            ? expression.name.text
            : "";

        return name === "Component" || name === "PureComponent";
      }),
    ) ?? false
  );
}

function reactComponentDeclarations(sourceFile: ts.SourceFile): readonly string[] {
  const declarations = new Map<string, string>();

  function register(name: ts.Identifier, node: ts.Node): void {
    if (PASCAL_CASE.test(name.text) && !declarations.has(name.text)) {
      declarations.set(name.text, sourceLocation(sourceFile, node));
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined && node.body !== undefined) {
      register(node.name, node);
    } else if (ts.isClassDeclaration(node) && node.name !== undefined && isReactClass(node)) {
      register(node.name, node);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;

      if (
        initializer !== undefined &&
        (ts.isArrowFunction(initializer) ||
          ts.isFunctionExpression(initializer) ||
          ts.isClassExpression(initializer) ||
          isReactComponentWrapper(initializer))
      ) {
        register(node.name, node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return [...declarations].map(([name, location]) => `${name} (${location})`);
}

const tree = readTree(PRESENTATION_ROOT);
const presentationFiles = new Set(tree.files);
const indexFiles = tree.files.filter((path) => basename(path) === "index.ts");
const componentDirectories = tree.directories.filter((directory) => {
  const name = basename(directory);
  return presentationFiles.has(join(directory, `${name}.tsx`));
});

test("components use a local named-export entry point", () => {
  const violations = [
    ...indexFiles.flatMap((indexFile) => {
      const directory = dirname(indexFile);
      const name = basename(directory);
      const componentFile = join(directory, `${name}.tsx`);
      const reasons: string[] = [];

      if (!PASCAL_CASE.test(name)) {
        reasons.push(`component directory "${name}" is not PascalCase`);
      }

      if (!presentationFiles.has(componentFile)) {
        reasons.push(`missing ${name}.tsx`);
      }

      return reasons.map((reason) => `${presentationPath(indexFile)}: ${reason}`);
    }),
    ...componentDirectories.flatMap((directory) =>
      presentationFiles.has(join(directory, "index.ts"))
        ? []
        : [`${presentationPath(directory)}: missing index.ts`],
    ),
  ];

  assertNoViolations("Invalid public component entry points", violations);
});

test("public components have a colocated component test", () => {
  const violations = indexFiles.flatMap((indexFile) => {
    const directory = dirname(indexFile);
    const name = basename(directory);
    const expectedTest = join(directory, `${name}.test.tsx`);

    return presentationFiles.has(expectedTest)
      ? []
      : [`${presentationPath(indexFile)}: missing ${name}.test.tsx`];
  });

  assertNoViolations("Public components without a colocated test", violations);
});

test("component folders and their related files follow the component name", () => {
  const violations = componentDirectories.flatMap((directory) => {
    const name = basename(directory);
    const reasons: string[] = [];

    if (!PASCAL_CASE.test(name)) {
      reasons.push(`${presentationPath(directory)}: component directory is not PascalCase`);
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name !== "index.ts" && !entry.name.startsWith(`${name}.`)) {
        reasons.push(
          `${presentationPath(join(directory, entry.name))}: related file must start with ${name}.`,
        );
      }
    }

    const hooksDirectory = join(directory, "hooks");

    if (existsSync(hooksDirectory)) {
      const expectedHook = `${name}.hooks.ts`;

      if (!presentationFiles.has(join(hooksDirectory, expectedHook))) {
        reasons.push(`${presentationPath(hooksDirectory)}: missing ${expectedHook}`);
      }

      for (const entry of readdirSync(hooksDirectory, { withFileTypes: true })) {
        const isProductionHook =
          entry.isFile() &&
          (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
          !entry.name.includes(".test.");

        if (isProductionHook && entry.name !== expectedHook) {
          reasons.push(
            `${presentationPath(join(hooksDirectory, entry.name))}: component hook must be ${expectedHook}`,
          );
        }
      }
    }

    return reasons;
  });

  assertNoViolations("Invalid component folder structure", violations);
});

test("technical directories do not use component-style names", () => {
  const violations = tree.directories
    .filter((directory) => PASCAL_CASE.test(basename(directory)))
    .filter((directory) => !isComponentDirectory(directory))
    .map(
      (directory) =>
        `${presentationPath(directory)}: PascalCase directories must contain ${basename(directory)}.tsx`,
    );

  assertNoViolations("Technical directories using PascalCase", violations);
});

test("presentation modules do not use wildcard exports", () => {
  const violations = tree.files
    .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
    .flatMap((path) => {
      const sourceFile = sourceFileFor(path);

      return sourceFile.statements.flatMap((statement) => {
        const isWildcardExport =
          ts.isExportDeclaration(statement) &&
          (statement.exportClause === undefined || ts.isNamespaceExport(statement.exportClause));

        return isWildcardExport
          ? [`${sourceLocation(sourceFile, statement)}: replace export * with named exports`]
          : [];
      });
    });

  assertNoViolations("Wildcard exports found", violations);
});

test("production TSX files declare at most one PascalCase React component", () => {
  const violations = tree.files
    .filter((path) => path.endsWith(".tsx") && !basename(path).includes(".test."))
    .flatMap((path) => {
      const declarations = reactComponentDeclarations(sourceFileFor(path));

      return declarations.length > 1
        ? [
            `${presentationPath(path)}: declares ${declarations.length} components (${declarations.join(
              ", ",
            )})`,
          ]
        : [];
    });

  assertNoViolations("TSX files with multiple React components", violations);
});
