import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.RECORDING_BASE_URL ?? "http://127.0.0.1:3001",
    storageState: existsSync(authPath) ? authPath : undefined,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
