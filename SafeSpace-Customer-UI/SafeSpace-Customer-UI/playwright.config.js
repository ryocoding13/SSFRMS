import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "auth-support.spec.js",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5273",
    browserName: "chromium",
    viewport: { width: 1440, height: 922 },
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {},
  },
  webServer: {
    command: "npm run dev -- --port 5273 --strictPort",
    url: "http://127.0.0.1:5273",
    reuseExistingServer: false,
    env: { VITE_USE_API: "true", VITE_API_URL: "http://127.0.0.1:5273" },
  },
});
