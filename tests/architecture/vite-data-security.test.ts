import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isPrivateDataFileSystemRoute } from "../../vite.config.ts";

const projectPath = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("Vite blocks normalized /@fs variants that resolve inside private data", () => {
  const privateRoutes = [
    `/@fs${projectPath}/data/myexpenses-backup-private.zip`,
    `/@fs/${projectPath}/data/BACKUP`,
    `/@fs/${projectPath}//data/BACKUP_PREF`,
    `/@fs//${projectPath.replace(/^\//, "")}///data/app-dataset.json`,
    `/@fs/${projectPath}/data/app-dataset.vault.json`,
    `/@fs/${projectPath}/data/../data/ui_settings.preferences_pb`,
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
