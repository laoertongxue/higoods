import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  getProductionOrderBomItems,
  getProductionOrderPatternFiles,
  getProductionOrderProcessEntries,
  getProductionOrderTechPackSnapshot,
} from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { generateProductionArtifactsForOrder } from '../src/data/fcs/production-artifact-generation.ts'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  resetGeneratedOriginalCutOrderSourceCache,
} from '../src/data/fcs/cutting/generated-original-cut-orders.ts'
import { listMaterialRequestDraftsByOrder } from '../src/data/fcs/material-request-drafts.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const order = productionOrders.find(
  (item) => item.techPackSnapshot && listMaterialRequestDraftsByOrder(item.productionOrderId).length > 0,
)
assert.ok(order, '测试数据中必须存在已冻结技术包快照的生产单')

const snapshot = getProductionOrderTechPackSnapshot(order!.productionOrderId)
assert.ok(snapshot, '生产单快照访问器必须能读取正式快照')
assert.deepEqual(getProductionOrderBomItems(order!.productionOrderId), snapshot!.bomItems, '下游读取 BOM 必须来自生产单快照')
assert.deepEqual(getProductionOrderPatternFiles(order!.productionOrderId), snapshot!.patternFiles, '下游读取纸样必须来自生产单快照')
assert.deepEqual(getProductionOrderProcessEntries(order!.productionOrderId), snapshot!.processEntries, '下游读取工序必须来自生产单快照')

const artifacts = generateProductionArtifactsForOrder(order!.productionOrderId)
assert.ok(artifacts.length > 0, '任务拆解产物必须仍能从生产单快照工序生成')
assert.ok(
  artifacts.every((item) => item.techPackId === snapshot!.sourceTechPackVersionId),
  '任务拆解产物必须记录来源技术包版本主键',
)

resetGeneratedOriginalCutOrderSourceCache()
const cutOrders = listGeneratedOriginalCutOrderSourceRecords().filter(
  (item) => item.productionOrderId === order!.productionOrderId,
)
assert.ok(cutOrders.length > 0, '原始裁片单生成必须仍能从生产单快照纸样与款色映射生成')
assert.ok(
  cutOrders.every((item) => item.techPackVersionLabel === snapshot!.sourceTechPackVersionLabel),
  '原始裁片单必须带出快照来源版本标签',
)

const materialDrafts = listMaterialRequestDraftsByOrder(order!.productionOrderId)
assert.ok(materialDrafts.length > 0, '领料草稿必须仍能从生产单快照 BOM 生成')
assert.ok(
  read('src/data/fcs/material-request-drafts.ts').includes('来源技术包快照BOM'),
  '领料草稿生成逻辑必须明确从技术包快照 BOM 取数',
)

;[
  'src/data/fcs/material-request-drafts.ts',
  'src/data/fcs/task-detail-rows.ts',
  'src/data/fcs/production-artifact-generation.ts',
  'src/data/fcs/cutting/generated-original-cut-orders.ts',
  'src/data/fcs/cutting/generated-fei-tickets.ts',
  'src/domain/fcs-cutting-piece-truth/index.ts',
  'src/pages/process-factory/cutting/marker-piece-explosion.ts',
  'src/pages/process-factory/cutting/marker-spreading-model.ts',
].forEach((relativePath) => {
  const source = read(relativePath)
  assert.ok(source.includes('production-order-tech-pack-runtime'), `${relativePath} 必须改为走生产单快照访问器`)
  assert.ok(!source.includes('pcs-technical-data-runtime-source'), `${relativePath} 不得再引用旧的 spuCode 兼容源`)
})

console.log('fcs-downstream-read-order-tech-pack-snapshot.spec.ts PASS')
