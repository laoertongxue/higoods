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

function listTsFiles(rootDir: string): string[] {
  const result: string[] = []
  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const next = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(next)
        continue
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        result.push(next)
      }
    }
  }
  walk(abs(rootDir))
  return result
}

function assertFileMissing(rel: string): void {
  assert(!fs.existsSync(abs(rel)), `${rel} 应已删除`) 
}

function assertNoStringInSrc(value: string): void {
  for (const file of listTsFiles('src')) {
    const source = fs.readFileSync(file, 'utf8')
    assert(!source.includes(value), `${path.relative(repoRoot, file)} 仍残留旧字符串：${value}`)
  }
}

function assertDomainBoundary(): void {
  for (const file of listTsFiles('src/domain')) {
    const source = fs.readFileSync(file, 'utf8')
    assert(!source.includes('/pages/'), `${path.relative(repoRoot, file)} 不应 import src/pages/**`)
    assert(!source.includes('../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('../../../pages/'), `${path.relative(repoRoot, file)} 不应反向依赖 src/pages/**`)
    assert(!source.includes('localStorage'), `${path.relative(repoRoot, file)} 不应直读 localStorage`)
    assert(!source.includes('sessionStorage'), `${path.relative(repoRoot, file)} 不应直读 sessionStorage`)
  }
}

function assertLegacyAnchorsRetired(): void {
  assert(!read('src/pages/pda-cutting-nav-context.ts').includes("params.set('cutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy cutPieceOrderNo')
  assert(!read('src/pages/pda-cutting-nav-context.ts').includes("params.set('focusCutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy focusCutPieceOrderNo')
  assert(!read('src/data/fcs/pda-cutting-execution-source.ts').includes("params.set('cutPieceOrderNo'"), 'pda-cutting-execution-source.ts 不应继续写出 legacy cutPieceOrderNo')

  const mainPages = [
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/cuttable-pool.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/fei-tickets.ts',
    'src/pages/process-factory/cutting/transfer-bags.ts',
  ]
  mainPages.forEach((file) => {
    const source = read(file)
    assert(!source.includes('data-row-index'), `${file} 不应继续使用旧 row index 作为正式锚点`)
  })
}

function assertLegacySourcesRetired(): void {
  const srcFiles = listTsFiles('src')
  const forbiddenImports = [
    'pda-cutting-special',
    'pda-execution-writeback-model',
    'pda-writeback-model',
    'fcs-cutting-runtime/sources',
    'cutting-identity',
  ]
  for (const file of srcFiles) {
    const source = fs.readFileSync(file, 'utf8')
    for (const value of forbiddenImports) {
      assert(!source.includes(value), `${path.relative(repoRoot, file)} 仍残留旧实现引用：${value}`)
    }
  }
}

function assertUnifiedScriptEntrypoints(): void {
  const packageJson = read('package.json')
  assert(packageJson.includes('"check:cutting:cleanup"'), 'package.json 缺少统一最终清理检查入口')
  assert(packageJson.includes('"test:cutting-final-cleanup:e2e"'), 'package.json 缺少最终 Playwright 收口验收入口')
}

function runScript(rel: string): void {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--experimental-specifier-resolution=node', rel], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`${rel} 执行失败\n${result.stdout || ''}${result.stderr || ''}`.trim())
  }
}

function main(): void {
  const deletedFiles = [
    'src/pages/process-factory/cutting/order-progress.ts',
    'src/pages/process-factory/cutting/order-progress.helpers.ts',
    'src/pages/process-factory/cutting/cut-piece-orders.ts',
    'src/pages/process-factory/cutting/cut-piece-orders.helpers.ts',
    'src/pages/process-factory/cutting/warehouse-management.ts',
    'src/pages/process-factory/cutting/warehouse-management.helpers.ts',
    'src/domain/cutting-identity/index.ts',
    'src/domain/fcs-cutting-runtime/sources.ts',
    'src/data/fcs/pda-cutting-special.ts',
    'src/pages/process-factory/cutting/pda-execution-writeback-model.ts',
    'src/pages/process-factory/cutting/pda-writeback-model.ts',
  ]
  deletedFiles.forEach(assertFileMissing)

  ;[
    'PRODUCTION_ORDER_NO_ALIASES',
    'PDA_CUTTING_TASK_IDENTITY_SEEDS',
    'forceReleased',
    'go-order-progress',
    'go-cut-piece-orders',
    'go-warehouse-management',
    'operatorAccountId = operatorName',
    'buildFcsCuttingRuntimeSources',
    'buildFcsCuttingRuntimeSummaryResult',
    'buildFcsCuttingRuntimeDetailData',
  ].forEach(assertNoStringInSrc)

  assertDomainBoundary()
  assertLegacyAnchorsRetired()
  assertLegacySourcesRetired()
  assertUnifiedScriptEntrypoints()

  const scripts = [
    'scripts/check-cutting-entry-cleanup.ts',
    'scripts/check-cutting-core-identity.ts',
    'scripts/check-fcs-upstream-cutting-chain.ts',
    'scripts/check-cutting-runtime-boundary.ts',
    'scripts/check-cutting-main-pages-cutover.ts',
    'scripts/check-cutting-execution-prep-chain.ts',
    'scripts/check-cutting-pda-projection-writeback.ts',
    'scripts/check-cutting-traceability-chain.ts',
  ]
  scripts.forEach(runScript)

  console.log(JSON.stringify({
    旧文件退场: '通过',
    旧关键字符串退场: '通过',
    domain边界收口: '通过',
    legacy主锚点退场: '通过',
    旧平行宇宙退场: '通过',
    统一脚本入口存在: '通过',
    分步检查脚本联跑: '通过',
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
