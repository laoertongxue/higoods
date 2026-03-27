#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
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
  const routes = readRepoFile('src/router/routes.ts')
  const handlers = readRepoFile('src/main-handlers/fcs-handlers.ts')

  assertIncludes(cuttingIndex, "from './production-progress'", 'cutting/index.ts 应从 production-progress.ts 导出正式页面')
  assertIncludes(cuttingIndex, "from './original-orders'", 'cutting/index.ts 应从 original-orders.ts 导出正式页面')
  assertNotIncludes(cuttingIndex, "from './order-progress'", 'cutting/index.ts 不应再从旧 order-progress.ts 导出')
  assertNotIncludes(cuttingIndex, "from './cut-piece-orders'", 'cutting/index.ts 不应再从旧 cut-piece-orders.ts 导出')

  assertIncludes(processFactoryIndex, 'renderCraftCuttingProductionProgressPage', 'process-factory/index.ts 应导出 canonical production-progress renderer')
  assertIncludes(processFactoryIndex, 'renderCraftCuttingOriginalOrdersPage', 'process-factory/index.ts 应导出 canonical original-orders renderer')
  assertNotIncludes(processFactoryIndex, 'renderCraftCuttingOrderProgressPage', 'process-factory/index.ts 不应保留旧 order-progress renderer 名称')
  assertNotIncludes(processFactoryIndex, 'renderCraftCuttingPieceOrdersPage', 'process-factory/index.ts 不应保留旧 piece-orders renderer 名称')

  assertIncludes(routes, 'renderCraftCuttingProductionProgressPage', 'routes.ts 应使用 canonical production-progress renderer')
  assertIncludes(routes, 'renderCraftCuttingOriginalOrdersPage', 'routes.ts 应使用 canonical original-orders renderer')
  assertNotIncludes(routes, 'renderCraftCuttingOrderProgressPage', 'routes.ts 不应继续使用旧 order-progress renderer')
  assertNotIncludes(routes, 'renderCraftCuttingPieceOrdersPage', 'routes.ts 不应继续使用旧 piece-orders renderer')

  assertIncludes(handlers, 'handleCraftCuttingProductionProgressEvent', 'fcs-handlers.ts 应使用 canonical production-progress handler')
  assertIncludes(handlers, 'handleCraftCuttingOriginalOrdersEvent', 'fcs-handlers.ts 应使用 canonical original-orders handler')
  assertNotIncludes(handlers, 'handleCraftCuttingOrderProgressEvent', 'fcs-handlers.ts 不应继续使用旧 order-progress handler')
  assertNotIncludes(handlers, 'handleCraftCuttingPieceOrdersEvent', 'fcs-handlers.ts 不应继续使用旧 piece-orders handler')
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

  assertIncludes(productionPage, "from './production-progress-projection'", 'production-progress.ts 应消费 production-progress projection')
  assertNotIncludes(productionPage, 'cuttingOrderProgressRecords', 'production-progress.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(productionPage, 'materialLineId', 'production-progress.ts 不应使用 materialLineId 作为 drill-down 锚点')
  assertNotIncludes(productionPage, 'cutPieceOrderNo', 'production-progress.ts 不应使用 cutPieceOrderNo 作为主 drill-down 参数')

  assertIncludes(cuttablePage, "from './cuttable-pool-projection'", 'cuttable-pool.ts 应消费 cuttable-pool projection')
  assertNotIncludes(cuttablePage, 'cuttingOrderProgressRecords', 'cuttable-pool.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(cuttablePage, 'materialLineId', 'cuttable-pool.ts 不应使用 materialLineId 作为 drill-down 锚点')

  assertIncludes(originalPage, "from './original-orders-projection'", 'original-orders.ts 应消费 original-orders projection')
  assertNotIncludes(originalPage, 'cuttingOrderProgressRecords', 'original-orders.ts 不应再直接消费 order-progress 平行源')
  assertNotIncludes(originalPage, 'buildOriginalCutOrderViewModel', 'original-orders.ts 不应直接回退到旧 model builder 作为主源')
  assertNotIncludes(originalPage, 'buildSystemSeedMergeBatches', 'original-orders.ts 不应继续自己构造旧 merge batch seed')
  assertNotIncludes(originalPage, 'materialLineId', 'original-orders.ts 不应使用 materialLineId 作为 drill-down 锚点')

  assertIncludes(mergePage, "from './merge-batches-projection'", 'merge-batches.ts 应消费 merge-batches projection')
  assertNotIncludes(mergePage, 'buildSystemSeedMergeBatches', 'merge-batches.ts 不应继续使用旧 merge batch seed builder 作为主源')
  assertNotIncludes(mergePage, 'buildCuttablePoolViewModel', 'merge-batches.ts 不应直接拼 cuttable view model')
  assertNotIncludes(mergePage, 'readStoredFeiTicketRecords', 'merge-batches.ts 不应继续直接读取旧 fei storage source')

  assertIncludes(productionProjection, 'export function buildProductionProgressProjection', '缺少 buildProductionProgressProjection')
  assertIncludes(cuttableProjection, 'export function buildCuttablePoolProjection', '缺少 buildCuttablePoolProjection')
  assertIncludes(originalProjection, 'export function buildOriginalOrdersProjection', '缺少 buildOriginalOrdersProjection')
  assertIncludes(mergeProjection, 'export function buildMergeBatchesProjection', '缺少 buildMergeBatchesProjection')
}

function assertModelsUseCanonicalMainSource(): void {
  const cuttableModel = readRepoFile('src/pages/process-factory/cutting/cuttable-pool-model.ts')
  const originalModel = readRepoFile('src/pages/process-factory/cutting/original-orders-model.ts')
  const mergeModel = readRepoFile('src/pages/process-factory/cutting/merge-batches-model.ts')

  assertIncludes(cuttableModel, 'listGeneratedOriginalCutOrderSourceRecords', 'cuttable-pool-model.ts 应从 generated original cut orders 起步')
  assertIncludes(originalModel, 'listGeneratedOriginalCutOrderSourceRecords', 'original-orders-model.ts 应从 generated original cut orders 起步')
  assertNotIncludes(cuttableModel, "from './cut-piece-orders'", 'cuttable-pool-model.ts 不应依赖旧 cut-piece-orders 页面壳')
  assertNotIncludes(originalModel, "from './cut-piece-orders'", 'original-orders-model.ts 不应依赖旧 cut-piece-orders 页面壳')
  assertNotIncludes(mergeModel, 'CuttableOriginalOrderItem', 'merge-batches-model.ts 不应继续绑定旧 cuttable 壳类型')
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
  assertModelsUseCanonicalMainSource()
  assertDrillDownParameters()

  console.log(
    JSON.stringify(
      {
        正式页面文件已切到canonical语义: '通过',
        旧页面壳与旧helper已删除: '通过',
        主页面projection已建立: '通过',
        主页面不再直接依赖旧平行源: '通过',
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
