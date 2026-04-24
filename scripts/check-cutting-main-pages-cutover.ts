#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function readRouteSources(): string {
  return [
    'src/router/routes.ts',
    'src/router/routes-fcs.ts',
  ]
    .map((file) => readRepoFile(file))
    .join('\n')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertFileExists(relativePath: string): void {
  assert(fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} 应存在`)
}

function assertFileMissing(relativePath: string): void {
  assert(!fs.existsSync(path.join(repoRoot, relativePath)), `${relativePath} 应已删除或退场`)
}

function assertIncludes(source: string, snippet: string, message: string): void {
  assert(source.includes(snippet), message)
}

function assertNotIncludes(source: string, snippet: string, message: string): void {
  assert(!source.includes(snippet), message)
}

function assertCanonicalPageFiles(): void {
  assertFileExists('src/pages/process-factory/cutting/production-progress.ts')
  assertFileExists('src/pages/process-factory/cutting/original-orders.ts')
  assertFileExists('src/pages/process-factory/cutting/production-progress-projection.ts')
  assertFileExists('src/pages/process-factory/cutting/cuttable-pool-projection.ts')
  assertFileExists('src/pages/process-factory/cutting/original-orders-projection.ts')
  assertFileExists('src/pages/process-factory/cutting/merge-batches-projection.ts')

  assertFileMissing('src/pages/process-factory/cutting/order-progress.ts')
  assertFileMissing('src/pages/process-factory/cutting/order-progress.helpers.ts')
  assertFileMissing('src/pages/process-factory/cutting/cut-piece-orders.ts')
  assertFileMissing('src/pages/process-factory/cutting/cut-piece-orders.helpers.ts')
}

function assertCanonicalExportsAndRoutes(): void {
  const cuttingIndex = readRepoFile('src/pages/process-factory/cutting/index.ts')
  const processFactoryIndex = readRepoFile('src/pages/process-factory/index.ts')
  const routes = readRouteSources()
  const handlers = readRepoFile('src/main-handlers/fcs-handlers.ts')
  const meta = readRepoFile('src/pages/process-factory/cutting/meta.ts')
  const appShell = readRepoFile('src/data/app-shell-config.ts')
  const navigationContext = readRepoFile('src/pages/process-factory/cutting/navigation-context.ts')
  const originalOrders = readRepoFile('src/pages/process-factory/cutting/original-orders.ts')
  const materialPrep = readRepoFile('src/pages/process-factory/cutting/material-prep.ts')
  const mergeBatches = readRepoFile('src/pages/process-factory/cutting/merge-batches.ts')
  const productionProgress = readRepoFile('src/pages/process-factory/cutting/production-progress.ts')
  const replenishment = readRepoFile('src/pages/process-factory/cutting/replenishment.ts')

  assertIncludes(cuttingIndex, "from './production-progress.ts'", 'cutting/index.ts 应从 production-progress.ts 导出正式页面')
  assertIncludes(cuttingIndex, "from './original-orders.ts'", 'cutting/index.ts 应从 original-orders.ts 导出正式页面')
  assertIncludes(cuttingIndex, "from './marker-spreading.ts'", 'cutting/index.ts 应从 marker-spreading.ts 导出铺布正式页面')
  assertNotIncludes(cuttingIndex, "from './order-progress'", 'cutting/index.ts 不应再从旧 order-progress.ts 导出')
  assertNotIncludes(cuttingIndex, "from './cut-piece-orders'", 'cutting/index.ts 不应再从旧 cut-piece-orders.ts 导出')

  assertIncludes(processFactoryIndex, 'renderCraftCuttingProductionProgressPage', 'process-factory/index.ts 应导出 canonical production-progress renderer')
  assertIncludes(processFactoryIndex, 'renderCraftCuttingOriginalOrdersPage', 'process-factory/index.ts 应导出 canonical original-orders renderer')
  assertIncludes(processFactoryIndex, 'renderCraftCuttingSpreadingListPage', 'process-factory/index.ts 应导出 canonical spreading-list renderer')
  assertIncludes(processFactoryIndex, 'renderCraftCuttingSpreadingCreatePage', 'process-factory/index.ts 应导出 canonical spreading-create renderer')
  assertNotIncludes(processFactoryIndex, 'renderCraftCuttingOrderProgressPage', 'process-factory/index.ts 不应保留旧 order-progress renderer 名称')
  assertNotIncludes(processFactoryIndex, 'renderCraftCuttingPieceOrdersPage', 'process-factory/index.ts 不应保留旧 piece-orders renderer 名称')

  assertIncludes(routes, 'renderCraftCuttingProductionProgressPage', '路由文件应使用 canonical production-progress renderer')
  assertIncludes(routes, 'renderCraftCuttingOriginalOrdersPage', '路由文件应使用 canonical original-orders renderer')
  assertIncludes(routes, "'/fcs/craft/cutting/spreading-list': () => renderCraftCuttingSpreadingListPage()", '路由文件应使用 canonical spreading-list renderer')
  assertIncludes(routes, "'/fcs/craft/cutting/spreading-create': () => renderCraftCuttingSpreadingCreatePage()", '路由文件应使用 canonical spreading-create renderer')
  assertIncludes(routes, "'/fcs/craft/cutting/marker-spreading': () => renderCraftCuttingMarkerSpreadingPage()", '旧 marker-spreading 应仅保留兼容入口')
  assertNotIncludes(routes, 'renderCraftCuttingOrderProgressPage', '路由文件不应继续使用旧 order-progress renderer')
  assertNotIncludes(routes, 'renderCraftCuttingPieceOrdersPage', '路由文件不应继续使用旧 piece-orders renderer')

  assertIncludes(handlers, 'handleCraftCuttingProductionProgressEvent', 'fcs-handlers.ts 应使用 canonical production-progress handler')
  assertIncludes(handlers, 'handleCraftCuttingOriginalOrdersEvent', 'fcs-handlers.ts 应使用 canonical original-orders handler')
  assertNotIncludes(handlers, 'handleCraftCuttingOrderProgressEvent', 'fcs-handlers.ts 不应继续使用旧 order-progress handler')
  assertNotIncludes(handlers, 'handleCraftCuttingPieceOrdersEvent', 'fcs-handlers.ts 不应继续使用旧 piece-orders handler')

  assertIncludes(meta, "canonicalPath: '/fcs/craft/cutting/spreading-list'", 'meta.ts 缺少 spreading-list canonicalPath')
  assertIncludes(meta, "pageTitle: '铺布列表'", 'meta.ts 缺少 spreading-list 页面标题')
  assertIncludes(meta, "canonicalPath: '/fcs/craft/cutting/spreading-create'", 'meta.ts 缺少 spreading-create canonicalPath')
  assertIncludes(meta, "pageTitle: '新建铺布'", 'meta.ts 缺少 spreading-create 页面标题')

  assertIncludes(appShell, "title: '裁前准备'", 'app-shell-config.ts 缺少裁前准备组')
  assertIncludes(appShell, "title: '铺布执行'", 'app-shell-config.ts 缺少铺布执行组')
  assertIncludes(appShell, "title: '裁后处理'", 'app-shell-config.ts 缺少裁后处理组')
  assertIncludes(appShell, "title: '唛架列表'", '菜单里应保留唛架列表')
  assertIncludes(appShell, "title: '铺布列表'", '菜单里应存在铺布列表')
  assertIncludes(appShell, "title: '补料管理'", '菜单里应存在补料管理')

  const prepStart = appShell.indexOf("title: '裁前准备'")
  const inProgressStart = appShell.indexOf("title: '铺布执行'")
  const closedLoopStart = appShell.indexOf("title: '裁后处理'")
  assert(prepStart >= 0 && inProgressStart > prepStart && closedLoopStart > inProgressStart, 'app-shell-config.ts 的裁片菜单分组顺序不正确')
  const prepSegment = appShell.slice(prepStart, inProgressStart)
  const inProgressSegment = appShell.slice(inProgressStart, closedLoopStart)
  const closedLoopSegment = appShell.slice(closedLoopStart)
  assertIncludes(prepSegment, "title: '原始裁片单'", '裁前准备组缺少原始裁片单')
  assertIncludes(prepSegment, "title: '仓库配料领料'", '裁前准备组缺少仓库配料领料')
  assertIncludes(prepSegment, "title: '唛架列表'", '裁前准备组缺少唛架列表')
  assertNotIncludes(prepSegment, "title: '打印菲票'", '打印菲票不应再留在裁前准备组')
  assertIncludes(inProgressSegment, "title: '铺布列表'", '铺布执行组缺少铺布列表')
  assertIncludes(closedLoopSegment, "title: '补料管理'", '裁后处理组缺少补料管理')
  assertIncludes(closedLoopSegment, "title: '打印菲票'", '裁后处理组缺少打印菲票')

  assertIncludes(navigationContext, "spreadingList: '去铺布'", 'navigation-context.ts 应提供显式 spreadingList 动作文案')
  assertIncludes(navigationContext, "if (target === 'spreadingList')", 'navigation-context.ts 应支持显式 spreadingList target')

  assertIncludes(originalOrders, "return navigateToRecordTarget(actionNode.dataset.recordId, 'spreadingList')", 'original-orders.ts 的去铺布动作应走 spreadingList')
  assertIncludes(originalOrders, '打印任务流转卡', 'original-orders.ts 应存在打印任务流转卡入口')
  assertIncludes(originalOrders, "buildTaskRouteCardPrintLink('CUTTING_ORIGINAL_ORDER', row.originalCutOrderId)", '原始裁片单打印任务流转卡必须使用 originalCutOrderId')
  assertIncludes(materialPrep, "return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'spreadingList')", 'material-prep.ts 的去铺布动作应走 spreadingList')
  assertIncludes(mergeBatches, "getCanonicalCuttingPath('spreading-list')", 'merge-batches.ts 的去铺布动作应走 spreading-list')
  assertIncludes(mergeBatches, '打印任务流转卡', 'merge-batches.ts 应存在打印任务流转卡入口')
  assertIncludes(mergeBatches, "buildTaskRouteCardPrintLink('CUTTING_MERGE_BATCH', batch.mergeBatchId)", '裁片批次打印任务流转卡必须使用 mergeBatchId')
  assertIncludes(productionProgress, "return navigateToRecordTarget(actionNode.dataset.recordId, 'spreading-list')", 'production-progress.ts 的去铺布动作应走 spreading-list')
  assertIncludes(replenishment, "return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || undefined, 'spreadingList')", 'replenishment.ts 的去铺布动作应走 spreadingList')
}

function assertProjectionCutover(): void {
  const productionPage = readRepoFile('src/pages/process-factory/cutting/production-progress.ts')
  const cuttablePage = readRepoFile('src/pages/process-factory/cutting/cuttable-pool.ts')
  const originalPage = readRepoFile('src/pages/process-factory/cutting/original-orders.ts')
  const mergePage = readRepoFile('src/pages/process-factory/cutting/merge-batches.ts')
  const productionProjection = readRepoFile('src/pages/process-factory/cutting/production-progress-projection.ts')
  const cuttableProjection = readRepoFile('src/pages/process-factory/cutting/cuttable-pool-projection.ts')
  const originalProjection = readRepoFile('src/pages/process-factory/cutting/original-orders-projection.ts')
  const mergeProjection = readRepoFile('src/pages/process-factory/cutting/merge-batches-projection.ts')

  assertIncludes(productionPage, "from './production-progress-projection.ts'", 'production-progress.ts 应消费 production-progress projection')
  assertNotIncludes(productionPage, 'cuttingOrderProgressRecords', 'production-progress.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(productionPage, 'materialLineId', 'production-progress.ts 不应使用 materialLineId 作为 drill-down 锚点')
  assertNotIncludes(productionPage, 'cutPieceOrderNo', 'production-progress.ts 不应使用 cutPieceOrderNo 作为主 drill-down 参数')

  assertIncludes(cuttablePage, "from './cuttable-pool-projection.ts'", 'cuttable-pool.ts 应消费 cuttable-pool projection')
  assertNotIncludes(cuttablePage, 'cuttingOrderProgressRecords', 'cuttable-pool.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(cuttablePage, 'materialLineId', 'cuttable-pool.ts 不应使用 materialLineId 作为 drill-down 锚点')

  assertIncludes(originalPage, "from './original-orders-projection.ts'", 'original-orders.ts 应消费 original-orders projection')
  assertNotIncludes(originalPage, 'cuttingOrderProgressRecords', 'original-orders.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(originalPage, 'buildOriginalCutOrderViewModel', 'original-orders.ts 不应直接回退到旧 model builder 作为主源')
  assertNotIncludes(originalPage, 'buildSystemSeedMergeBatches', 'original-orders.ts 不应继续自己构造旧 merge batch seed')
  assertNotIncludes(originalPage, 'materialLineId', 'original-orders.ts 不应使用 materialLineId 作为 drill-down 锚点')

  assertIncludes(mergePage, "from './merge-batches-projection.ts'", 'merge-batches.ts 应消费 merge-batches projection')
  assertNotIncludes(mergePage, 'buildSystemSeedMergeBatches', 'merge-batches.ts 不应继续使用旧 merge batch seed builder 作为主源')
  assertNotIncludes(mergePage, 'buildCuttablePoolViewModel', 'merge-batches.ts 不应直接拼 cuttable view model')
  assertNotIncludes(mergePage, 'readStoredFeiTicketRecords', 'merge-batches.ts 不应继续直接读取旧 fei storage source')

  assertIncludes(productionProjection, 'export function buildProductionProgressProjection', '缺少 buildProductionProgressProjection')
  assertIncludes(cuttableProjection, 'export function buildCuttablePoolProjection', '缺少 buildCuttablePoolProjection')
  assertIncludes(originalProjection, 'export function buildOriginalOrdersProjection', '缺少 buildOriginalOrdersProjection')
  assertIncludes(mergeProjection, 'export function buildMergeBatchesProjection', '缺少 buildMergeBatchesProjection')
}

function assertDrillDownParameters(): void {
  const productionPage = readRepoFile('src/pages/process-factory/cutting/production-progress.ts')
  const cuttablePage = readRepoFile('src/pages/process-factory/cutting/cuttable-pool.ts')
  const mergePage = readRepoFile('src/pages/process-factory/cutting/merge-batches.ts')
  const originalModel = readRepoFile('src/pages/process-factory/cutting/original-orders-model.ts')

  assertIncludes(productionPage, 'productionOrderId: row.productionOrderId', '生产单进度 -> 原始裁片单 应传 productionOrderId')
  assertIncludes(cuttablePage, 'originalCutOrderId: item.originalCutOrderId', '可裁排产 -> 原始裁片单详情 应传 originalCutOrderId')
  assertIncludes(mergePage, 'mergeBatchId: batchId', '合并裁剪批次 -> 原始裁片单 应传 mergeBatchId')
  assertIncludes(mergePage, 'productionOrderId: actionNode.dataset.productionOrderId', '合并裁剪批次 -> 原始裁片单 应传 productionOrderId 过滤')
  assertIncludes(originalModel, 'mergeBatchId: row.activeMergeBatchId || undefined', '原始裁片单 -> 合并裁剪批次 应传 mergeBatchId')
}

function main(): void {
  assertCanonicalPageFiles()
  assertCanonicalExportsAndRoutes()
  assertProjectionCutover()
  assertDrillDownParameters()

  console.log(
    JSON.stringify(
      {
        正式页面文件已切到canonical语义: '通过',
        旧页面壳与旧helper已删除: '通过',
        主页面projection已建立: '通过',
        drillDown参数已切正式对象: '通过',
        路由导出与handler已切canonical命名: '通过',
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
