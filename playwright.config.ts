import { defineConfig, devices } from '@playwright/test'

const host = process.env.CUTTING_E2E_HOST || '127.0.0.1'
const port = process.env.CUTTING_E2E_PORT || '4173'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`
const reuseExistingServer = !process.env.CI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== 'false'
const expectTimeout = Number(process.env.CUTTING_E2E_EXPECT_TIMEOUT || '10000')
const testTimeout = Number(process.env.CUTTING_E2E_TEST_TIMEOUT || '60000')
const previewOutDir = process.env.CUTTING_E2E_PREVIEW_OUT_DIR?.trim()
const previewOutDirArg = previewOutDir ? ` --outDir ${JSON.stringify(previewOutDir)}` : ''
const webServerCommand = process.env.CUTTING_E2E_USE_PREVIEW === 'true'
  ? `npm run preview -- --host ${host} --port ${port} --strictPort${previewOutDirArg}`
  : `npm run dev -- --host ${host} --port ${port} --strictPort`

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: Number.isFinite(testTimeout) && testTimeout > 0 ? testTimeout : 60_000,
  expect: {
    timeout: Number.isFinite(expectTimeout) && expectTimeout > 0 ? expectTimeout : 10_000,
  },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/playwright',
  globalSetup: './tests/bootstrap/cutting-bootstrap.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
})
