import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PPIC_DAILY_E2E_PORT || '5482')
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PPIC浏览器验收端口无效')
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: '.',
  testMatch: ['ppic-daily-return-pages.spec.ts', 'ppic-daily-return-receipts.spec.ts', 'ppic-shared-consumers.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  outputDir: '../output/ppic-adversarial-20261014/browser-' + Date.now(),
  use: {
    baseURL,
    browserName: 'chromium',
    timezoneId: 'Asia/Jakarta',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
