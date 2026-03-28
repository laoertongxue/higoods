import fs from 'node:fs'
import path from 'node:path'

import type { FullConfig } from '@playwright/test'

const host = process.env.CUTTING_E2E_HOST || '127.0.0.1'
const port = process.env.CUTTING_E2E_PORT || '4173'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`

function abs(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath)
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  ;['test-results/playwright', 'playwright-report'].forEach((dir) => {
    fs.mkdirSync(abs(dir), { recursive: true })
  })
  process.env.PLAYWRIGHT_BASE_URL = baseURL
}
