import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 4,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    css: true,
    coverage: {
      thresholds: {
        branches: 60,
        functions: 85,
        lines: 85,
        statements: 75,
      },
    },
  },
});
