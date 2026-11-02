import { defineConfig } from "@playwright/test";

const siteOrigin = "http://127.0.0.1:3210";
const apiOrigin = "http://127.0.0.1:3211";

export default defineConfig({
  testDir: "./a11y",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: siteOrigin,
    browserName: "chromium",
    headless: true,
    launchOptions: process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : undefined,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/support/accessibility-api.mjs",
      url: `${apiOrigin}/health`,
      reuseExistingServer: false,
      timeout: 10_000,
    },
    {
      command: "node .next/standalone/server.js",
      url: siteOrigin,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        BACKEND_API_URL: apiOrigin,
        PUBLIC_SITE_ORIGIN: siteOrigin,
        UMAMI_ENABLED: "false",
        HOSTNAME: "127.0.0.1",
        PORT: "3210",
      },
    },
  ],
});
