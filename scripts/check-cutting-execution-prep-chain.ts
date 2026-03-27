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

function assertWarehouseLegacyRetired(): void {
  assertFileMissing('src/pages/process-factory/cutting/warehouse-management.ts')
  assertFileMissing('src/pages/process-factory/cutting/warehouse-management.helpers.ts')

  const warehouseShared = readRepoFile('src/pages/process-factory/cutting/warehouse-shared.ts')
  assertNotIncludes(warehouseShared, 'buildWarehouseOriginalRows', 'warehouse-shared.ts 不应继续承载旧总页主取数逻辑')
  assertNotIncludes(warehouseShared, 'readWarehouseMergeBatchLedger', 'warehouse-shared.ts 不应继续承载旧总页批次取数逻辑')
}

function assertProjectionFiles(): void {
  const projections = [
    'src/pages/process-factory/cutting/material-prep-projection.ts',
    'src/pages/process-factory/cutting/marker-spreading-projection.ts',
    'src/pages/process-factory/cutting/fabric-warehouse-projection.ts',
    'src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts',
    'src/pages/process-factory/cutting/sample-warehouse-projection.ts',
    'src/pages/process-factory/cutting/replenishment-projection.ts',
    'src/pages/process-factory/cutting/special-processes-projection.ts',
  ]
  projections.forEach(assertFileExists)

  assertIncludes(readRepoFile(projections[0]), 'buildMaterialPrepProjection', '缺少 buildMaterialPrepProjection')
  assertIncludes(readRepoFile(projections[1]), 'buildMarkerSpreadingProjection', '缺少 buildMarkerSpreadingProjection')
  assertIncludes(readRepoFile(projections[2]), 'buildFabricWarehouseProjection', '缺少 buildFabricWarehouseProjection')
  assertIncludes(readRepoFile(projections[3]), 'buildCutPieceWarehouseProjection', '缺少 buildCutPieceWarehouseProjection')
  assertIncludes(readRepoFile(projections[4]), 'buildSampleWarehouseProjection', '缺少 buildSampleWarehouseProjection')
  assertIncludes(readRepoFile(projections[5]), 'buildReplenishmentProjection', '缺少 buildReplenishmentProjection')
  assertIncludes(readRepoFile(projections[6]), 'buildSpecialProcessesProjection', '缺少 buildSpecialProcessesProjection')
}

function assertPagesConsumeProjection(): void {
  const materialPrepPage = readRepoFile('src/pages/process-factory/cutting/material-prep.ts')
  const cutPieceWarehousePage = readRepoFile('src/pages/process-factory/cutting/cut-piece-warehouse.ts')
  const sampleWarehousePage = readRepoFile('src/pages/process-factory/cutting/sample-warehouse.ts')
  const replenishmentPage = readRepoFile('src/pages/process-factory/cutting/replenishment.ts')
  const specialProcessesPage = readRepoFile('src/pages/process-factory/cutting/special-processes.ts')
  const markerUtils = readRepoFile('src/pages/process-factory/cutting/marker-spreading-utils.ts')

  assertIncludes(materialPrepPage, "from './material-prep-projection'", 'material-prep.ts 应消费 material-prep projection')
  assertIncludes(cutPieceWarehousePage, "from './cut-piece-warehouse-projection'", 'cut-piece-warehouse.ts 应消费 cut-piece-warehouse projection')
  assertIncludes(sampleWarehousePage, "from './sample-warehouse-projection'", 'sample-warehouse.ts 应消费 sample-warehouse projection')
  assertIncludes(replenishmentPage, "from './replenishment-projection'", 'replenishment.ts 应消费 replenishment projection')
  assertIncludes(specialProcessesPage, "from './special-processes-projection'", 'special-processes.ts 应消费 special-processes projection')
  assertIncludes(markerUtils, "from './marker-spreading-projection'", 'marker-spreading-utils.ts 应消费 marker-spreading projection')

  for (const source of [materialPrepPage, cutPieceWarehousePage, sampleWarehousePage, replenishmentPage, specialProcessesPage, markerUtils]) {
    assertNotIncludes(source, 'buildWarehouseOriginalRows', '执行准备链页面不应继续依赖旧 buildWarehouseOriginalRows')
    assertNotIncludes(source, 'readWarehouseMergeBatchLedger', '执行准备链页面不应继续依赖旧 readWarehouseMergeBatchLedger')
    assertNotIncludes(source, 'cuttingOrderProgressRecords', '执行准备链页面不应继续直接依赖旧 production-progress 平行源')
  }
}

function assertMainObjectAnchors(): void {
  const materialPrepModel = readRepoFile('src/pages/process-factory/cutting/material-prep-model.ts')
  const markerSpreadingModel = readRepoFile('src/pages/process-factory/cutting/marker-spreading-model.ts')
  const fabricWarehouseModel = readRepoFile('src/pages/process-factory/cutting/fabric-warehouse-model.ts')
  const cutPieceWarehouseModel = readRepoFile('src/pages/process-factory/cutting/cut-piece-warehouse-model.ts')
  const sampleWarehouseModel = readRepoFile('src/pages/process-factory/cutting/sample-warehouse-model.ts')
  const replenishmentModel = readRepoFile('src/pages/process-factory/cutting/replenishment-model.ts')
  const specialProcessesModel = readRepoFile('src/pages/process-factory/cutting/special-processes-model.ts')

  assertIncludes(materialPrepModel, 'originalCutOrderId', 'material-prep-model.ts 应以 originalCutOrderId 为主对象字段')
  assertIncludes(markerSpreadingModel, 'originalCutOrderIds', 'marker-spreading-model.ts 应以 originalCutOrderIds 为主链字段')
  assertIncludes(fabricWarehouseModel, 'originalCutOrderId', 'fabric-warehouse-model.ts 应以 originalCutOrderId 为主对象字段')
  assertIncludes(cutPieceWarehouseModel, 'originalCutOrderId', 'cut-piece-warehouse-model.ts 应以 originalCutOrderId 为主对象字段')
  assertIncludes(sampleWarehouseModel, 'relatedOriginalCutOrderId', 'sample-warehouse-model.ts 应以 relatedOriginalCutOrderId 绑定主链')
  assertIncludes(replenishmentModel, 'originalCutOrderIds', 'replenishment-model.ts 应以 originalCutOrderIds 绑定补料建议')
  assertIncludes(specialProcessesModel, 'originalCutOrderIds', 'special-processes-model.ts 应以 originalCutOrderIds 绑定专项工艺')

  assertNotIncludes(cutPieceWarehouseModel, 'originalCutOrderId: row?.originalCutOrderId || record.cutPieceOrderNo', 'cut-piece-warehouse-model.ts 不应再把 cutPieceOrderNo 默认回填为原始裁片单 id')
  assertNotIncludes(sampleWarehouseModel, 'relatedOriginalCutOrderNo: record.relatedCutPieceOrderNo', 'sample-warehouse-model.ts 不应再直接把 legacy cutPieceOrderNo 当主对象')
}

function assertMaterialSkuPrimary(): void {
  const materialPrepPage = readRepoFile('src/pages/process-factory/cutting/material-prep.ts')
  const fabricWarehousePage = readRepoFile('src/pages/process-factory/cutting/fabric-warehouse.ts')
  const cutPieceWarehousePage = readRepoFile('src/pages/process-factory/cutting/cut-piece-warehouse.ts')
  const sampleWarehousePage = readRepoFile('src/pages/process-factory/cutting/sample-warehouse.ts')
  const replenishmentPage = readRepoFile('src/pages/process-factory/cutting/replenishment.ts')
  const specialProcessesPage = readRepoFile('src/pages/process-factory/cutting/special-processes.ts')

  assertIncludes(materialPrepPage, 'materialSku', 'material-prep 页面应围绕 materialSku 展示')
  assertIncludes(fabricWarehousePage, 'materialSku', 'fabric-warehouse 页面应围绕 materialSku 展示')
  assertIncludes(cutPieceWarehousePage, 'materialSku', 'cut-piece-warehouse 页面应围绕 materialSku 展示')
  assertIncludes(sampleWarehousePage, 'materialSku', 'sample-warehouse 页面应围绕 materialSku 展示')
  assertIncludes(replenishmentPage, 'materialSku', 'replenishment 页面应围绕 materialSku 展示')
  assertIncludes(specialProcessesPage, 'materialSku', 'special-processes 页面应围绕 materialSku 展示')
}

function assertReplenishmentAndSpecialProcesses(): void {
  const replenishmentModel = readRepoFile('src/pages/process-factory/cutting/replenishment-model.ts')
  const specialProcessesModel = readRepoFile('src/pages/process-factory/cutting/special-processes-model.ts')

  assertIncludes(replenishmentModel, 'buildReplenishmentContextRecords', '补料建议仍应来自铺布执行上下文')
  assertIncludes(replenishmentModel, 'markerStore', 'replenishment-model.ts 应从铺布执行结果推导补料')
  assertNotIncludes(replenishmentModel, 'feedback.cutPieceOrderNo', 'replenishment-model.ts 不应再把 legacy cutPieceOrderNo 当补料主锚点')

  assertNotIncludes(specialProcessesModel, "processType: 'WASH'", 'special-processes-model.ts 不应再泛化生成洗水占位工艺单')
  assertNotIncludes(specialProcessesModel, 'sp-seed-wash-placeholder', 'special-processes-model.ts 不应再保留洗水占位工艺单 seed')
}

function main(): void {
  assertWarehouseLegacyRetired()
  assertProjectionFiles()
  assertPagesConsumeProjection()
  assertMainObjectAnchors()
  assertMaterialSkuPrimary()
  assertReplenishmentAndSpecialProcesses()

  console.log(
    JSON.stringify(
      {
        执行准备链projection已建立: '通过',
        仓务旧总页已退场: '通过',
        页面主源已切snapshot_projection: '通过',
        主对象锚点已切原始裁片单: '通过',
        面料主识别已切materialSku: '通过',
        补料来源已切到铺布执行结果: '通过',
        特殊工艺已去掉冗余预留工艺单: '通过',
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
