import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isPrivateDataFileSystemRoute } from "../../vite.config.ts";

const projectPath = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("Vite blocks normalized /@fs variants that resolve inside private data", () => {
  const privateRoutes = [
    `/@fs${projectPath}/data/export.ts`,
    `/@fs/${projectPath}/data/export.ts`,
    `/@fs/${projectPath}//data/export-20260821-092252.json`,
    `/@fs//${projectPath.replace(/^\//, "")}///data/statistics.json`,
    `/@fs/${projectPath}/data/../data/exchange-rates.json`,
  ];

  for (const route of privateRoutes) {
    assert.equal(
      isPrivateDataFileSystemRoute(route),
      true,
      `Expected private route to be blocked: ${route}`,
    );
  }

  assert.equal(
    isPrivateDataFileSystemRoute(`/@fs/${projectPath}/database/example.json`),
    false,
  );
  assert.equal(isPrivateDataFileSystemRoute("/src/main.tsx"), false);
});
