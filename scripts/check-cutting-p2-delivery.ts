#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function listFiles(rootDir: string, matcher: (file: string) => boolean): string[] {
  const files: string[] = []

  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
        continue
      }
      if (entry.isFile() && matcher(nextPath)) files.push(nextPath)
    }
  }

  walk(abs(rootDir))
  return files
}

function runReleaseReadiness(): void {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--experimental-specifier-resolution=node', 'scripts/check-cutting-release-readiness.ts'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  assert(result.status === 0, `check-cutting-release-readiness.ts 执行失败\n${result.stdout || ''}${result.stderr || ''}`.trim())
}

function main(): void {
  const packageJson = read('package.json')
  ;[
    '"check:cutting:all"',
    '"check:cutting:release"',
    '"test:cutting:bootstrap"',
    '"test:cutting:install-browsers"',
    '"test:cutting:all:e2e"',
  ].forEach((scriptName) => {
    assert(packageJson.includes(scriptName), `package.json 缺少交付脚本：${scriptName}`)
  })

  assert(fs.existsSync(abs('tests/cutting-release-acceptance.spec.ts')), 'tests/cutting-release-acceptance.spec.ts 缺失')
  assert(fs.existsSync(abs('tests/bootstrap/cutting-bootstrap.ts')), 'tests/bootstrap/cutting-bootstrap.ts 缺失')
  assert(fs.existsSync(abs('tests/helpers/seed-cutting-runtime-state.ts')), 'tests/helpers/seed-cutting-runtime-state.ts 缺失')
  assert(fs.existsSync(abs('docs/cutting-e2e.md')), 'docs/cutting-e2e.md 缺失')
  assert(fs.existsSync(abs('playwright.config.ts')), 'playwright.config.ts 缺失')

  const docsText = `${read('README.md')}\n${read('docs/cutting-e2e.md')}`
  ;[
    'npm install',
    'npm run test:cutting:install-browsers',
    'npm run test:cutting:bootstrap',
    'npm run check:cutting:release',
    'npm run test:cutting:all:e2e',
  ].forEach((command) => {
    assert(docsText.includes(command), `文档缺少运行命令说明：${command}`)
  })

  const noiseFiles = listFiles('.', (file) => {
    const normalized = file.split(path.sep).join('/')
    return normalized.endsWith('.DS_Store') || normalized.endsWith('/__MACOSX') || normalized.endsWith('.zip')
  })
  assert(noiseFiles.length === 0, `仓库仍残留工程噪音：\n${noiseFiles.map((file) => path.relative(repoRoot, file)).join('\n')}`)

  const cuttingScripts = listFiles('scripts', (file) => path.basename(file).startsWith('check-cutting') && file.endsWith('.ts'))
  const scriptCoverageText = [packageJson, read('scripts/check-cutting-release-readiness.ts'), read('scripts/check-cutting-p2-delivery.ts')].join('\n')
  cuttingScripts.forEach((file) => {
    const basename = path.basename(file)
    assert(scriptCoverageText.includes(basename), `${basename} 未被 package 脚本或 release/delivery 入口引用`)
  })

  const helperCoverageText = [
    read('playwright.config.ts'),
    ...listFiles('tests', (file) => file.endsWith('.ts')).map((file) => fs.readFileSync(file, 'utf8')),
  ].join('\n')
  ;['tests/bootstrap/cutting-bootstrap.ts', 'tests/helpers/seed-cutting-runtime-state.ts'].forEach((rel) => {
    const basename = path.basename(rel)
    const stem = basename.replace(/\.ts$/, '')
    assert(helperCoverageText.includes(basename) || helperCoverageText.includes(stem), `${rel} 已无正式 consumer`)
  })

  runReleaseReadiness()

  console.log(
    JSON.stringify(
      {
        release脚本入口存在: '通过',
        Playwright自举入口存在: '通过',
        最终验收spec存在: '通过',
        文档运行顺序完整: '通过',
        工程噪音已清理: '通过',
        无失效cutting脚本残留: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
