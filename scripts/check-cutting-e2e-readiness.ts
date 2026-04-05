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
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/material-prep.ts',
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/navigation-context.ts',
    'src/pages/process-factory/cutting/meta.ts',
    'src/pages/process-factory/cutting/replenishment.ts',
    'src/pages/process-factory/cutting/fei-tickets.ts',
    'src/pages/process-factory/cutting/transfer-bags.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse.ts',
    'src/pages/process-factory/cutting/marker-spreading.ts',
    'src/pages/process-factory/cutting/marker-spreading-model.ts',
    'src/pages/process-factory/cutting/marker-spreading-projection.ts',
    'src/pages/process-factory/cutting/marker-spreading-utils.ts',
    'src/pages/process-factory/cutting/marker-spreading-draft-actions.ts',
    'src/pages/process-factory/cutting/marker-spreading-submit-actions.ts',
    'src/pages/process-factory/cutting/marker-plan-model.ts',
    'src/pages/pda-cutting-task-detail.ts',
    'src/pages/pda-cutting-task-detail-helpers.ts',
    'src/pages/pda-cutting-execution-unit.ts',
    'src/pages/pda-cutting-spreading.ts',
    'src/pages/pda-cutting-spreading-projection.ts',
    'src/data/fcs/pda-cutting-execution-source.ts',
    'src/domain/cutting-pda-writeback/bridge.ts',
    'src/data/app-shell-config.ts',
    'src/router/routes.ts',
    'scripts/check-cutting-final-cleanup.ts',
    'scripts/check-cutting-main-pages-cutover.ts',
    'scripts/check-cutting-p1-closure.ts',
    'scripts/check-cutting-e2e-readiness.ts',
    'playwright.config.ts',
    'tests/cutting-marker-spreading-list.spec.ts',
    'tests/cutting-marker-spreading-list-tabs.spec.ts',
    'tests/cutting-marker-spreading-cross-module-navigation.spec.ts',
    'tests/cutting-marker-spreading-editor-actions.spec.ts',
    'tests/cutting-pda-spreading-entry.spec.ts',
    'tests/cutting-pda-spreading.spec.ts',
    'tests/cutting-pda-spreading-flow.spec.ts',
    'tests/cutting-pda-spreading-writeback.spec.ts',
    'tests/cutting-pda-execution-unit.spec.ts',
    'tests/cutting-pda-task-detail-routing.spec.ts',
    'tests/cutting-release-acceptance.spec.ts',
  ].forEach(assertFileExists)
}

function assertRetiredFiles(): void {
  ;[
    'src/pages/process-factory/cutting/order-progress.ts',
    'src/pages/process-factory/cutting/cut-piece-orders.ts',
  ].forEach(assertFileMissing)
}

function assertLegacyResidueRetired(): void {
  ;[
    'resolveRouteFromNextAction',
    "targetType: 'context'",
  ].forEach(assertNoStringInSrc)
}

function assertFormalAnchorsUnified(): void {
  const keyFiles = [
    'src/pages/process-factory/cutting/production-progress.ts',
    'src/pages/process-factory/cutting/original-orders.ts',
    'src/pages/process-factory/cutting/merge-batches.ts',
    'src/pages/process-factory/cutting/material-prep.ts',
    'src/pages/process-factory/cutting/replenishment.ts',
    'src/pages/process-factory/cutting/fei-tickets.ts',
    'src/pages/process-factory/cutting/transfer-bags.ts',
    'src/pages/pda-cutting-task-detail.ts',
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

  const pdaHelpers = read('src/pages/pda-cutting-task-detail-helpers.ts')
  assert(pdaHelpers.includes('line.primaryExecutionRouteKey'), 'PDA 任务详情主动作应显式使用 primaryExecutionRouteKey')

  const pdaSource = read('src/data/fcs/pda-cutting-execution-source.ts')
  assert(pdaSource.includes('listWorkerVisiblePdaSpreadingTargets'), 'PDA source 缺少普通工人可见目标收口 helper')
  assert(pdaSource.includes('FOLD_NORMAL'), 'PDA source 缺少 FOLD_NORMAL 模式')
  assert(pdaSource.includes('FOLD_HIGH_LOW'), 'PDA source 缺少 FOLD_HIGH_LOW 模式')
  assert(pdaSource.includes('面料主料'), 'PDA source 缺少中文化面料主料文案')

  const pdaSpreading = read('src/pages/pda-cutting-spreading.ts')
  assert(pdaSpreading.includes('allowManualEntry'), 'PDA 铺布页缺少 manual-entry 权限隔离')
  assert(pdaSpreading.includes("target.targetType === 'manual-entry'"), 'PDA 铺布页缺少 manual-entry 隐藏逻辑')
  assert(pdaSpreading.includes('FOLD_NORMAL'), 'PDA 铺布页缺少 FOLD_NORMAL 模式文案')
  assert(pdaSpreading.includes('FOLD_HIGH_LOW'), 'PDA 铺布页缺少 FOLD_HIGH_LOW 模式文案')

  const routes = read('src/router/routes.ts')
  assert(
    routes.includes('renderPdaCuttingExecutionUnitPage') &&
      routes.includes('pattern: /^\\/fcs\\/pda\\/cutting\\/unit\\/([^/]+)\\/([^/]+)$/'),
    'routes.ts 缺少 PDA execution-unit route',
  )

  const releaseAcceptance = read('tests/cutting-release-acceptance.spec.ts')
  assert(releaseAcceptance.includes('进入执行单元'), 'tests/cutting-release-acceptance.spec.ts 缺少 execution-unit acceptance')
  assert(releaseAcceptance.includes('按唛架新建铺布'), 'tests/cutting-release-acceptance.spec.ts 缺少 marker-first 创建 acceptance')
  assert(releaseAcceptance.includes('补料管理'), 'tests/cutting-release-acceptance.spec.ts 缺少补料闭环 acceptance')
  assert(releaseAcceptance.includes('补料待配料'), 'tests/cutting-release-acceptance.spec.ts 缺少补料回仓库待配料 acceptance')
  assert(releaseAcceptance.includes('来源铺布：'), 'tests/cutting-release-acceptance.spec.ts 缺少来源铺布链路断言')
  assert(releaseAcceptance.includes('来源补料：'), 'tests/cutting-release-acceptance.spec.ts 缺少来源补料链路断言')
  assert(releaseAcceptance.includes('先装袋后入仓'), 'tests/cutting-release-acceptance.spec.ts 缺少先装袋后入仓链路断言')
  assert(releaseAcceptance.includes("countViewportRows(page, 'cutting-spreading-list-table')"), 'tests/cutting-release-acceptance.spec.ts 缺少铺布列表低分辨率断言')
  assert(releaseAcceptance.includes("countViewportRows(page, 'marker-plan-list-table')"), 'tests/cutting-release-acceptance.spec.ts 缺少唛架列表低分辨率断言')
  assert(releaseAcceptance.includes('[data-pda-cutting-unit-step="SPREADING"]'), 'tests/cutting-release-acceptance.spec.ts 缺少 execution-unit 首屏铺布入口断言')
  assert(
    releaseAcceptance.includes("expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))"),
    'tests/cutting-release-acceptance.spec.ts 缺少 PDA 铺布页保存按钮首屏断言',
  )

  const replenishmentStorage = read('src/data/fcs/cutting/storage/replenishment-storage.ts')
  assert(replenishmentStorage.includes('sourceSpreadingSessionId'), 'replenishment-storage.ts 缺少 sourceSpreadingSessionId')
  assert(replenishmentStorage.includes('sourceReplenishmentRequestId'), 'replenishment-storage.ts 缺少 sourceReplenishmentRequestId')

  const feiStorage = read('src/data/fcs/cutting/storage/fei-tickets-storage.ts')
  assert(feiStorage.includes('sourceSpreadingSessionId'), 'fei-tickets-storage.ts 缺少 sourceSpreadingSessionId')
  assert(feiStorage.includes('sourceWritebackId'), 'fei-tickets-storage.ts 缺少 sourceWritebackId')

  const generatedFeiTickets = read('src/data/fcs/cutting/generated-fei-tickets.ts')
  assert(generatedFeiTickets.includes('sourceSpreadingSessionId'), 'generated-fei-tickets.ts 缺少来源铺布锚点')
  assert(generatedFeiTickets.includes('garmentQty'), 'generated-fei-tickets.ts 缺少成衣件数主数据')

  const transferStorage = read('src/data/fcs/cutting/storage/transfer-bags-storage.ts')
  assert(transferStorage.includes('buildTransferBagRuntimeTraceMatrix'), 'transfer-bags-storage.ts 缺少正式装袋 trace matrix')

  const transferRuntime = read('src/data/fcs/cutting/transfer-bag-runtime.ts')
  assert(transferRuntime.includes('sourceSpreadingSessionId'), 'transfer-bag-runtime.ts 缺少来源铺布锚点')
  assert(transferRuntime.includes('feiTicketId'), 'transfer-bag-runtime.ts 缺少来源菲票锚点')

  const warehouseRuntime = read('src/data/fcs/cutting/warehouse-runtime.ts')
  assert(warehouseRuntime.includes('spreadingSessionId'), 'warehouse-runtime.ts 缺少来源铺布锚点')
  assert(warehouseRuntime.includes('feiTicketId'), 'warehouse-runtime.ts 缺少来源菲票锚点')
  assert(warehouseRuntime.includes('bagId'), 'warehouse-runtime.ts 缺少来源周转口袋锚点')
  assert(warehouseRuntime.includes('transferBatchId'), 'warehouse-runtime.ts 缺少来源装袋批次锚点')
}

function assertUnifiedEntrypoints(): void {
  const packageJson = read('package.json')
  assert(packageJson.includes('"build"'), 'package.json 缺少 build 脚本')
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
    'scripts/check-cutting-main-pages-cutover.ts',
    'scripts/check-cutting-p1-closure.ts',
    'scripts/check-cutting-final-cleanup.ts',
    'scripts/check-cutting-marker-spreading-actions.ts',
    'scripts/check-cutting-low-res-density.ts',
    'scripts/check-cutting-flow-matrix.ts',
    'scripts/check-cutting-release-acceptance.ts',
  ].forEach(runTypeStripScript)

  console.log(
    JSON.stringify(
      {
        正式链路文件存在: '通过',
        旧文件与旧平行源退场: '通过',
        legacy关键字符串退场: '通过',
        正式主锚点统一: '通过',
        acceptance规格存在并已收口: '通过',
        低分辨率与流程矩阵检查可联跑: '通过',
        统一脚本入口存在: '通过',
        当前有效检查脚本联跑: '通过',
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
