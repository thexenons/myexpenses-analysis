# Synthetic browser regression tests

The Playwright suite exercises a freshly imported and encrypted **synthetic** backup. It never uses the repository's `data/`, `public/`, backup files, vaults, or a running development server. The runner copies only allowlisted tracked source files into a temporary source-only tree, links installed package directories, builds a temporary static release, and serves only that release on `127.0.0.1:41789`. It refuses an existing server on that port. On normal completion or test failure, Playwright shuts the server down gracefully and the runner removes its temporary source/build directories and browser traces. A forced process kill can interrupt cleanup.

After installing the pinned repository dependencies, install only the Chromium headless shell with the local CLI:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/myexpenses-browser-cache \
  node node_modules/@playwright/test/cli.js install chromium --only-shell

PLAYWRIGHT_BROWSERS_PATH=/tmp/myexpenses-browser-cache \
  node node_modules/tsx/dist/cli.mjs tests/browser/run-isolated.ts
```

The equivalent package script is `test:browser`; the direct Node command above avoids package-manager wrappers. An existing default Playwright cache also works when `PLAYWRIGHT_BROWSERS_PATH` is unset. The runner passes only a sanitized environment to the isolated build/test process. If this host lacks Chromium runtime libraries, provision them outside the repository and pass `MYEXPENSES_BROWSER_RUNTIME_LIB_DIR` as an absolute path; the runner applies that directory as `LD_LIBRARY_PATH` **only to the browser process**. Do not use `apt`, `sudo`, global installs, or a private development server to make this suite pass.

The suite covers Chromium desktop (1280px) and mobile emulation (390px and 320px). It freezes the browser clock in `Europe/Madrid`, blocks unexpected outbound browser requests, and checks unlock, navigation/filter controls, budget detail, freshness, average disclosure, keyboard actions, and document overflow. Emulation is not proof on physical devices, Safari, Firefox, or a live deployment.

## Repository CI

`.github/workflows/ci.yml` runs on pushes and pull requests. Its `checks` job runs lint, all three TypeScript projects, Node and UI tests, and the synthetic deployment-pipeline test. The separate `browser-smoke` job runs this isolated runner for synthetic vault unlock, VOID exclusion, and budget pace on desktop and 390px mobile emulation. The opt-in performance scenario is not part of CI.

Both jobs install the `packageManager` version from `package.json` and require a frozen `pnpm-lock.yaml` on Node 24. The browser job installs only Chromium's headless shell and its Linux libraries. Neither job needs deployment credentials, a private backup, Docker, or a running development server. Local tests validate the workflow contract, but the first GitHub-hosted run is still needed to confirm runner installation and browser dependencies.
