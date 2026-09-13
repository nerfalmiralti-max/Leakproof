import { defineConfig, devices } from "@playwright/test";

const real = process.env.E2E_ANALYSIS_PROVIDER === "openai";
const port = process.env.E2E_PORT ?? (real ? "3002" : "3000");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: real ? "test-results/real" : "test-results/demo",
  testMatch: real ? "**/real-flow.spec.ts" : "**/workflow.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: {
      ANALYSIS_PROVIDER: real ? "openai" : "demo",
      ...(real ? { OPENAI_API_KEY: "" } : {}),
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
