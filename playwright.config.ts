import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The offline service worker would hide requests from page.route() mocks.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    // iPad uses Safari's engine (WebKit), so this is the closest thing to the real device.
    { name: "ipad-landscape", use: { ...devices["iPad Pro 11 landscape"] } },
    { name: "ipad-portrait", use: { ...devices["iPad Pro 11"] } },
  ],
  webServer: {
    // Runs the production build in local mode (no Supabase/Claude keys) so tests are self-contained.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      ALLOW_PRIVATE_IMPORTS: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
