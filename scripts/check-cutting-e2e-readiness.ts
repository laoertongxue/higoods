#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { assertPlaywrightPreflight, formatPlaywrightCollectabilityFailure } from './check-playwright-preflight.ts'

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

function readRouteSources(): string {
  return [
    'src/router/routes.ts',
    'src/router/routes-pda.ts',
  ]
    .map((file) => read(file))
    .join('\n')
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

function assertAcceptanceSpecCollectable(): void {
  const result = spawnSync('npx', ['playwright', 'test', '--list', 'tests/cutting-release-acceptance.spec.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(
      formatPlaywrightCollectabilityFailure(
        'tests/cutting-release-acceptance.spec.ts',
        `${result.stdout || ''}${result.stderr || ''}`,
      ),
    )
  }

  const output = `${result.stdout || ''}${result.stderr || ''}`
  ;[
    'release acceptance：supervisor IA、铺布列表状态与菜单闭环可见',
    'release acceptance：铺布只能 marker-first 创建，异常补录必须填写原因',
    'release acceptance：PDA 从任务到执行单元到铺布录入，写回后 supervisor 可见',
    'release acceptance：补料审批通过后，仓库配料领料可见补料待配料',
  ].forEach((token) => {
    assert(output.includes(token), `cutting-release-acceptance.spec.ts 缺少关键场景：${token}`)
  })
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
  assert(pdaSpreading.includes('canUseManualSpreadingEntry'), 'PDA 铺布页缺少 manual-entry 权限隔离')
  assert(pdaSpreading.includes('listWorkerVisiblePdaSpreadingTargets(detail)'), 'PDA 铺布页缺少普通工人目标收口逻辑')
  assert(pdaSpreading.includes("target.targetType === 'manual-entry'"), 'PDA 铺布页缺少 manual-entry supervisor 可见逻辑')
  assert(pdaSpreading.includes('FOLD_NORMAL'), 'PDA 铺布页缺少 FOLD_NORMAL 模式文案')
  assert(pdaSpreading.includes('FOLD_HIGH_LOW'), 'PDA 铺布页缺少 FOLD_HIGH_LOW 模式文案')

  const routes = readRouteSources()
  const releaseAcceptanceCheck = read('scripts/check-cutting-release-acceptance.ts')
  const playwrightPreflight = read('scripts/check-playwright-preflight.ts')
  assert(
    routes.includes('renderPdaCuttingExecutionUnitPage') &&
      routes.includes('pattern: /^\\/fcs\\/pda\\/cutting\\/unit\\/([^/]+)\\/([^/]+)$/'),
    '路由文件缺少 PDA execution-unit route',
  )

  const releaseAcceptance = read('tests/cutting-release-acceptance.spec.ts')
  assert(releaseAcceptance.includes('进入当前任务'), 'tests/cutting-release-acceptance.spec.ts 缺少 execution-unit acceptance')
  assert(releaseAcceptance.includes('按唛架新建铺布'), 'tests/cutting-release-acceptance.spec.ts 缺少 marker-first 创建 acceptance')
  assert(releaseAcceptance.includes('补料管理'), 'tests/cutting-release-acceptance.spec.ts 缺少补料闭环 acceptance')
  assert(releaseAcceptance.includes('补料待配料'), 'tests/cutting-release-acceptance.spec.ts 缺少补料回仓库待配料 acceptance')
  assert(releaseAcceptance.includes('来源铺布：'), 'tests/cutting-release-acceptance.spec.ts 缺少来源铺布链路断言')
  assert(releaseAcceptance.includes('来源补料单：'), 'tests/cutting-release-acceptance.spec.ts 缺少来源补料链路断言')
  assert(releaseAcceptance.includes('铺布完成结果'), 'tests/cutting-release-acceptance.spec.ts 缺少菲票主真相源断言')
  assert(releaseAcceptance.includes('实际成衣件数'), 'tests/cutting-release-acceptance.spec.ts 缺少菲票成衣件数断言')
  assert(releaseAcceptance.includes('理论成衣件数（件）'), 'tests/cutting-release-acceptance.spec.ts 缺少裁剪总结成衣件数字段断言')
  assert(releaseAcceptance.includes('已裁片片数（片）'), 'tests/cutting-release-acceptance.spec.ts 缺少裁剪总结裁片片数字段断言')
  assert(releaseAcceptance.includes('已入仓裁片片数（片）'), 'tests/cutting-release-acceptance.spec.ts 缺少裁剪总结入仓片数字段断言')
  assert(releaseAcceptance.includes('计划捆条产出数量'), 'tests/cutting-release-acceptance.spec.ts 缺少捆条工艺计划产出字段断言')
  assert(releaseAcceptance.includes('实际捆条产出'), 'tests/cutting-release-acceptance.spec.ts 缺少捆条工艺实际产出字段断言')
  assert(releaseAcceptance.includes('先装袋后入仓'), 'tests/cutting-release-acceptance.spec.ts 缺少先装袋后入仓链路断言')
  assert(releaseAcceptance.includes("countViewportRows(page, 'cutting-spreading-list-table')"), 'tests/cutting-release-acceptance.spec.ts 缺少铺布列表低分辨率断言')
  assert(releaseAcceptance.includes("countViewportRows(page, 'marker-plan-list-table')"), 'tests/cutting-release-acceptance.spec.ts 缺少唛架列表低分辨率断言')
  assert(releaseAcceptance.includes('[data-pda-cutting-unit-step="SPREADING"]'), 'tests/cutting-release-acceptance.spec.ts 缺少 execution-unit 首屏铺布入口断言')
  assert(
    releaseAcceptance.includes("expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))"),
    'tests/cutting-release-acceptance.spec.ts 缺少 PDA 铺布页保存按钮首屏断言',
  )
  assert(releaseAcceptance.includes("not.toContainText('manual-entry')"), 'tests/cutting-release-acceptance.spec.ts 缺少 manual-entry 隐藏断言')
  assert(releaseAcceptance.includes("not.toContainText('context-only')"), 'tests/cutting-release-acceptance.spec.ts 缺少 context-only 隐藏断言')
  assert(releaseAcceptance.includes("not.toContainText('sourceWritebackId')"), 'tests/cutting-release-acceptance.spec.ts 缺少工人端技术 ID 隐藏断言')
  assert(releaseAcceptance.includes('交接结果'), 'tests/cutting-release-acceptance.spec.ts 缺少工人端交接结果断言')
  assert(releaseAcceptance.includes('补料待配料'), 'tests/cutting-release-acceptance.spec.ts 缺少补料待配料断言')
  assert(releaseAcceptance.includes('去仓库配料领料'), 'tests/cutting-release-acceptance.spec.ts 缺少补料回仓库动作断言')
  assert(releaseAcceptance.includes('参考理论值'), 'tests/cutting-release-acceptance.spec.ts 缺少菲票 fallback basis 断言')

  assert(releaseAcceptanceCheck.includes('补料待配料'), 'check-cutting-release-acceptance.ts 未纳入补料待配料规则')
  assert(releaseAcceptanceCheck.includes('铺布完成结果'), 'check-cutting-release-acceptance.ts 未纳入菲票主真相源规则')
  assert(releaseAcceptanceCheck.includes('manual-entry'), 'check-cutting-release-acceptance.ts 未纳入 manual-entry 收口规则')
  assert(releaseAcceptanceCheck.includes('context-only'), 'check-cutting-release-acceptance.ts 未纳入 context-only 收口规则')
  assert(!releaseAcceptanceCheck.includes('裁片执行闭环'), 'check-cutting-release-acceptance.ts 不应再检查旧菜单名')
  assert(!releaseAcceptanceCheck.includes('订单数量折算'), 'check-cutting-release-acceptance.ts 不应再检查旧菲票 basis 文案')
  assert(!releaseAcceptanceCheck.includes('唛架总件数'), 'check-cutting-release-acceptance.ts 不应再检查旧菲票主 basis 文案')
  assert(playwrightPreflight.includes('@playwright/test'), 'check-playwright-preflight.ts 未纳入 Playwright 依赖解析检查')
  assert(playwrightPreflight.includes('npm install'), 'check-playwright-preflight.ts 未给出 npm install preflight 提示')
  assert(playwrightPreflight.includes('test:cutting:install-browsers'), 'check-playwright-preflight.ts 未给出浏览器安装 preflight 提示')

  const replenishmentStorage = read('src/data/fcs/cutting/storage/replenishment-storage.ts')
  assert(replenishmentStorage.includes('sourceSpreadingSessionId'), 'replenishment-storage.ts 缺少 sourceSpreadingSessionId')
  assert(replenishmentStorage.includes('sourceReplenishmentRequestId'), 'replenishment-storage.ts 缺少 sourceReplenishmentRequestId')
  assert(replenishmentStorage.includes('PENDING_PREP'), 'replenishment-storage.ts 缺少补料待配料状态')

  const cuttingSummary = read('src/data/fcs/cutting/cutting-summary.ts')
  assert(cuttingSummary.includes('pendingPrepCount'), 'cutting-summary.ts 缺少 pendingPrepCount 统一补料计数')
  assert(!cuttingSummary.includes('mayAffectPrintingCount'), 'cutting-summary.ts 不应再统计 mayAffectPrintingCount')
  assert(!cuttingSummary.includes('mayAffectDyeingCount'), 'cutting-summary.ts 不应再统计 mayAffectDyeingCount')

  const platformOverview = read('src/domain/cutting-platform/overview.adapter.ts')
  assert(platformOverview.includes('pendingPrepCount'), 'overview.adapter.ts 缺少 pendingPrepCount 平台概览')
  assert(!platformOverview.includes('mayAffectPrintingCount'), 'overview.adapter.ts 不应再统计 mayAffectPrintingCount')
  assert(!platformOverview.includes('mayAffectDyeingCount'), 'overview.adapter.ts 不应再统计 mayAffectDyeingCount')

  const platformDetail = read('src/domain/cutting-platform/detail.helpers.ts')
  assert(platformDetail.includes('待仓库配料领料'), 'detail.helpers.ts 缺少待仓库配料领料提示')
  assert(!platformDetail.includes('影响印花'), 'detail.helpers.ts 不应再显示影响印花')
  assert(!platformDetail.includes('影响染色'), 'detail.helpers.ts 不应再显示影响染色')

  const feiStorage = read('src/data/fcs/cutting/storage/fei-tickets-storage.ts')
  assert(feiStorage.includes('sourceSpreadingSessionId'), 'fei-tickets-storage.ts 缺少 sourceSpreadingSessionId')
  assert(feiStorage.includes('sourceWritebackId'), 'fei-tickets-storage.ts 缺少 sourceWritebackId')

  const generatedFeiTickets = read('src/data/fcs/cutting/generated-fei-tickets.ts')
  assert(generatedFeiTickets.includes('sourceSpreadingSessionId'), 'generated-fei-tickets.ts 缺少来源铺布锚点')
  assert(generatedFeiTickets.includes('garmentQty'), 'generated-fei-tickets.ts 缺少成衣件数主数据')

  const feiTicketsModel = read('src/pages/process-factory/cutting/fei-tickets-model.ts')
  assert(feiTicketsModel.includes('铺布完成结果'), 'fei-tickets-model.ts 缺少铺布完成结果主 basis 文案')
  assert(feiTicketsModel.includes('实际成衣件数'), 'fei-tickets-model.ts 缺少实际成衣件数主 basis 文案')
  assert(!feiTicketsModel.includes('唛架总件数'), 'fei-tickets-model.ts 不应再以唛架总件数作为主 basis')
  assert(!feiTicketsModel.includes('订单数量折算'), 'fei-tickets-model.ts 不应再以订单数量折算作为主 basis')

  const transferStorage = read('src/data/fcs/cutting/storage/transfer-bags-storage.ts')
  assert(transferStorage.includes('buildTransferBagRuntimeTraceMatrix'), 'transfer-bags-storage.ts 缺少正式装袋 trace matrix')

  const transferRuntime = read('src/data/fcs/cutting/transfer-bag-runtime.ts')
  assert(transferRuntime.includes('sourceSpreadingSessionId'), 'transfer-bag-runtime.ts 缺少来源铺布锚点')
  assert(transferRuntime.includes('feiTicketId'), 'transfer-bag-runtime.ts 缺少来源菲票锚点')

  const warehouseRuntime = read('src/data/fcs/cutting/warehouse-runtime.ts')
  assert(warehouseRuntime.includes('spreadingSessionId'), 'warehouse-runtime.ts 缺少来源铺布锚点')
  assert(warehouseRuntime.includes('feiTicketId'), 'warehouse-runtime.ts 缺少来源菲票锚点')
  assert(warehouseRuntime.includes('bagId'), 'warehouse-runtime.ts 缺少来源中转袋锚点')
  assert(warehouseRuntime.includes('transferBatchId'), 'warehouse-runtime.ts 缺少来源装袋批次锚点')
}

function assertUnifiedEntrypoints(): void {
  const packageJson = read('package.json')
  assert(packageJson.includes('"build"'), 'package.json 缺少 build 脚本')
  assert(packageJson.includes('"@playwright/test"'), 'package.json 缺少 @playwright/test 依赖')
  assert(packageJson.includes('"test:cutting-release-acceptance:e2e"'), 'package.json 缺少裁片 release acceptance e2e 入口')
  assert(packageJson.includes('"check:cutting:playwright-preflight"'), 'package.json 缺少 Playwright 预检脚本入口')
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
  assertPlaywrightPreflight()
  assertAcceptanceSpecCollectable()
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
        Playwright依赖可解析: '通过',
        acceptance可被Playwright收集: '通过',
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
