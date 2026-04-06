#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = process.cwd()
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

export function buildPlaywrightPreflightMessage(detail?: string): string {
  const lines = [
    '当前环境缺少 Playwright 依赖，请先执行 npm install。',
    '如浏览器尚未安装，再执行 npm run test:cutting:install-browsers。',
    '请确认当前命令是在仓库根目录执行，并且 node_modules 已完整安装。',
  ]

  if (detail && detail.trim()) {
    lines.unshift(`Playwright 预检失败：${detail.trim()}`)
  }

  return lines.join('\n')
}

export function formatPlaywrightCollectabilityFailure(target: string, output: string): string {
  const lines = [
    `${target} 无法被 Playwright 收集。`,
    '请先确认已执行 npm install。',
    '如浏览器尚未安装，再执行 npm run test:cutting:install-browsers。',
  ]

  if (output.trim()) {
    lines.push(`原始输出：\n${output.trim()}`)
  }

  return lines.join('\n')
}

export function assertPlaywrightPreflight(): void {
  assert(fs.existsSync(abs('package.json')), buildPlaywrightPreflightMessage('package.json 缺失'))
  assert(fs.existsSync(abs('playwright.config.ts')), buildPlaywrightPreflightMessage('playwright.config.ts 缺失'))

  const packageJson = read('package.json')
  assert(packageJson.includes('"@playwright/test"'), buildPlaywrightPreflightMessage('package.json 未声明 @playwright/test 依赖'))

  const importResult = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import('@playwright/test').then(()=>console.log('ok')).catch((error)=>{console.error(error instanceof Error ? error.message : String(error));process.exit(1)})",
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  if (importResult.status !== 0) {
    throw new Error(
      buildPlaywrightPreflightMessage(`${importResult.stdout || ''}${importResult.stderr || ''}`.trim()),
    )
  }

  const cliResult = spawnSync(npxCommand, ['playwright', '--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (cliResult.status !== 0) {
    throw new Error(buildPlaywrightPreflightMessage(`${cliResult.stdout || ''}${cliResult.stderr || ''}`.trim()))
  }
}

function main(): void {
  assertPlaywrightPreflight()

  console.log(
    JSON.stringify(
      {
        package依赖声明: '通过',
        Playwright配置文件存在: '通过',
        Playwright模块可解析: '通过',
        Playwright命令可执行: '通过',
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
