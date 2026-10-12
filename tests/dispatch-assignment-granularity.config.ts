import path from 'node:path'
import { defineConfig } from '@playwright/test'
import base from '../playwright.config'

// Both servers belong to this checkout; the preview fixtures use current source save actions.
// Measure the preview first, before the longer source suite; both use one active worker.
const runId = process.env.DISPATCH_VERIFICATION_RUN_ID ||= String(Date.now())
export default defineConfig({
  ...base,
  testDir: path.resolve('tests'),
  globalSetup: undefined,
  workers: 1,
  retries: 0,
  outputDir: path.resolve(`test-results/dispatch-receipt-${runId}`),
  projects: [
    {
      name: 'dispatch-source',
      dependencies: ['dispatch-preview'],
      testMatch: /(?:dispatch-assignment-granularity|fcs-unified-dispatch-preparation-return-preview)\.spec\.ts$/,
      use: { ...base.use, baseURL: 'http://127.0.0.1:43234' },
    },
    {
      name: 'dispatch-preview',
      testMatch: /dispatch-assignment-granularity-preview\.spec\.ts$/,
      use: { ...base.use, baseURL: 'http://127.0.0.1:43233' },
    },
  ],
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 43234 --strictPort', url: 'http://127.0.0.1:43234', reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run preview -- --host 127.0.0.1 --port 43233 --strictPort', url: 'http://127.0.0.1:43233', reuseExistingServer: false, timeout: 120000 },
  ],
})
