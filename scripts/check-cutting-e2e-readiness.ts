#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function listTsFiles(rootDir: string): string[] {
  const result: string[] = []

  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
        continue
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        result.push(nextPath)
      }
    }
  }

  walk(abs(rootDir))
  return result
}

function assertFileExists(rel: string): void {
  assert(fs.existsSync(abs(rel)), `${rel} 缺失，正式链路文件不完整`)
}

function assertFileMissing(rel: string): void {
  assert(!fs.existsSync(abs(rel)), `${rel} 仍未退场`)
}

function assertNoStringInSrc(value: string): void {
  for (const file of listTsFiles('src')) {
    const source = fs.readFileSync(file, 'utf8')
    assert(!source.includes(value), `${path.relative(repoRoot, file)} 仍残留旧字符串：${value}`)
  }
}

function assertKeyFormalFiles(): void {
  ;[
    'src/domain/cutting-core/types.ts',
    'src/domain/cutting-core/repository.ts',
    'src/domain/cutting-core/registry.ts',
    'src/data/fcs/production-upstream-chain.ts',
    'src/data/fcs/cutting/generated-original-cut-orders.ts',
    'src/data/fcs/cutting/warehouse-runtime.ts',
    'src/domain/fcs-cutting-runtime/domain-snapshot.ts',
    'src/data/fcs/cutting/runtime-inputs.ts',
    'src/pages/process-factory/cutting/runtime-projections.ts',
    'src/domain/cutting-platform/overview-prep-projection.ts',
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/cuttable-pool.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/material-prep-projection.ts',
    'src/pages/process-factory/cutting/marker-spreading-projection.ts',
    'src/pages/process-factory/cutting/fabric-warehouse-projection.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts',
    'src/pages/process-factory/cutting/sample-warehouse-projection.ts',
    'src/pages/process-factory/cutting/replenishment-projection.ts',
    'src/pages/process-factory/cutting/special-processes-projection.ts',
    'src/data/fcs/pda-cutting-execution-source.ts',
    'src/data/fcs/pda-cutting-writeback-inputs.ts',
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/fcs/cutting/warehouse-writeback-ledger.ts',
    'src/data/fcs/cutting/warehouse-writeback-inputs.ts',
    'src/domain/cutting-warehouse-writeback/bridge.ts',
    'src/data/fcs/cutting/storage/fei-tickets-storage.ts',
    'src/data/fcs/cutting/storage/replenishment-storage.ts',
    'src/data/fcs/cutting/storage/special-processes-storage.ts',
    'src/data/fcs/cutting/storage/transfer-bags-storage.ts',
    'src/data/fcs/cutting/storage/merge-batches-storage.ts',
    'src/data/fcs/cutting/transfer-bag-legacy-normalizer.ts',
    'src/data/fcs/pda-cutting-legacy-compat.ts',
    'src/data/fcs/cutting/generated-fei-tickets.ts',
    'src/data/fcs/cutting/qr-payload.ts',
    'src/data/fcs/cutting/qr-codes.ts',
    'src/data/fcs/cutting/transfer-bag-runtime.ts',
    'scripts/check-cutting-final-cleanup.ts',
    'scripts/check-cutting-source-provenance.ts',
    'scripts/check-cutting-writeback-integrity.ts',
    'scripts/check-cutting-release-readiness.ts',
    'scripts/check-cutting-p2-delivery.ts',
    'scripts/check-cutting-runtime-no-legacy-warehouse.ts',
    'scripts/check-cutting-platform-no-legacy-pickup.ts',
    'scripts/check-cutting-warehouse-writeback-chain.ts',
    'scripts/check-cutting-p1-closure.ts',
    'scripts/check-cutting-e2e-readiness.ts',
    'playwright.config.ts',
    'tests/bootstrap/cutting-bootstrap.ts',
    'tests/helpers/seed-cutting-runtime-state.ts',
    'tests/cutting-final-cleanup.spec.ts',
    'tests/cutting-runtime-no-legacy-warehouse.spec.ts',
    'tests/cutting-platform-overview-formal-pickup.spec.ts',
    'tests/cutting-warehouse-writeback-chain.spec.ts',
    'tests/cutting-p1-closure.spec.ts',
    'tests/cutting-full-chain-acceptance.spec.ts',
    'tests/cutting-release-acceptance.spec.ts',
    'docs/cutting-e2e.md',
  ].forEach(assertFileExists)
}

function assertRetiredFiles(): void {
  ;[
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
  ].forEach(assertFileMissing)
}

function assertLegacyResidueRetired(): void {
  ;[
    'PRODUCTION_ORDER_NO_ALIASES',
    'PDA_CUTTING_TASK_IDENTITY_SEEDS',
    'forceReleased',
    'operatorAccountId = operatorName',
    'buildFcsCuttingRuntimeSources',
    'buildFcsCuttingRuntimeSummaryResult',
    'buildFcsCuttingRuntimeDetailData',
  ].forEach(assertNoStringInSrc)
}

function assertFormalAnchorsUnified(): void {
  const keyFiles = [
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/cuttable-pool.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/material-prep.ts',
    'src/pages/process-factory/cutting/replenishment.ts',
    'src/pages/process-factory/cutting/fei-tickets.ts',
    'src/pages/process-factory/cutting/transfer-bags.ts',
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-cutting-pickup.ts',
  ]

  keyFiles.forEach((file) => {
    const source = read(file)
    assert(
      source.includes('productionOrderId') ||
        source.includes('originalCutOrderId') ||
        source.includes('mergeBatchId') ||
        source.includes('executionOrderId') ||
        source.includes('feiTicketId') ||
        source.includes('carrierId'),
      `${file} 未体现正式主锚点字段`,
    )
  })

  const navFile = read('src/pages/pda-cutting-nav-context.ts')
  assert(!navFile.includes("params.set('cutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy cutPieceOrderNo')
  assert(!navFile.includes("params.set('focusCutPieceOrderNo'"), 'pda-cutting-nav-context.ts 不应继续写出 legacy focusCutPieceOrderNo')
}

function assertUnifiedEntrypoints(): void {
  const packageJson = read('package.json')
  assert(packageJson.includes('"check:cutting:all"'), 'package.json 缺少 check:cutting:all')
  assert(packageJson.includes('"check:cutting:release"'), 'package.json 缺少 check:cutting:release')
  assert(packageJson.includes('"test:cutting:bootstrap"'), 'package.json 缺少 test:cutting:bootstrap')
  assert(packageJson.includes('"test:cutting:install-browsers"'), 'package.json 缺少 test:cutting:install-browsers')
  assert(packageJson.includes('"test:cutting:all:e2e"'), 'package.json 缺少 test:cutting:all:e2e')
}

function runTypeStripScript(rel: string): void {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--experimental-specifier-resolution=node', rel], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`${rel} 执行失败\n${result.stdout || ''}${result.stderr || ''}`.trim())
  }
}

function main(): void {
  assertKeyFormalFiles()
  assertRetiredFiles()
  assertLegacyResidueRetired()
  assertFormalAnchorsUnified()
  assertUnifiedEntrypoints()

  ;[
    'scripts/check-cutting-entry-cleanup.ts',
    'scripts/check-cutting-core-identity.ts',
    'scripts/check-fcs-upstream-cutting-chain.ts',
    'scripts/check-cutting-runtime-boundary.ts',
    'scripts/check-cutting-main-pages-cutover.ts',
    'scripts/check-cutting-runtime-no-legacy-warehouse.ts',
    'scripts/check-cutting-platform-no-legacy-pickup.ts',
    'scripts/check-cutting-warehouse-writeback-chain.ts',
    'scripts/check-cutting-p1-closure.ts',
    'scripts/check-cutting-execution-prep-chain.ts',
    'scripts/check-cutting-pda-projection-writeback.ts',
    'scripts/check-cutting-traceability-chain.ts',
    'scripts/check-cutting-final-cleanup.ts',
  ].forEach(runTypeStripScript)

  console.log(
    JSON.stringify(
      {
        正式链路文件存在: '通过',
        旧文件与旧平行源退场: '通过',
        legacy关键字符串退场: '通过',
        正式主锚点统一: '通过',
        统一脚本入口存在: '通过',
        当前有效检查脚本联跑: '通过',
        E2E自举与文档入口存在: '通过',
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
