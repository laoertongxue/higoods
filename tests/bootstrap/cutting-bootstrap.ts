#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(currentFile), '../..')
const defaultHost = process.env.CUTTING_E2E_HOST || '127.0.0.1'
const defaultPort = process.env.CUTTING_E2E_PORT || '4173'
const defaultBaseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://${defaultHost}:${defaultPort}`

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

export interface CuttingBootstrapSummary {
  baseURL: string
  webServerCommand: string
  preparedPaths: string[]
}

export function prepareCuttingE2EEnvironment(options?: { quiet?: boolean }): CuttingBootstrapSummary {
  const preparedPaths = ['test-results', 'playwright-report']

  fs.rmSync(abs('test-results/playwright'), { recursive: true, force: true })
  fs.mkdirSync(abs('test-results'), { recursive: true })
  fs.mkdirSync(abs('playwright-report'), { recursive: true })

  process.env.PLAYWRIGHT_BASE_URL = defaultBaseUrl
  process.env.CUTTING_E2E_HOST = defaultHost
  process.env.CUTTING_E2E_PORT = defaultPort

  const summary: CuttingBootstrapSummary = {
    baseURL: defaultBaseUrl,
    webServerCommand: `npm run dev -- --host ${defaultHost} --port ${defaultPort} --strictPort`,
    preparedPaths,
  }

  if (!options?.quiet) {
    console.log(
      JSON.stringify(
        {
          裁片E2E环境: '已准备',
          baseURL: summary.baseURL,
          webServer: summary.webServerCommand,
          输出目录: summary.preparedPaths,
        },
        null,
        2,
      ),
    )
  }

  return summary
}

export default async function globalSetup(): Promise<void> {
  prepareCuttingE2EEnvironment({
    quiet: true,
  })
}

if (process.argv[1] === currentFile) {
  prepareCuttingE2EEnvironment()
}
