#!/usr/bin/env node

import assert from 'node:assert/strict'

import { processTasks } from '../src/data/fcs/process-tasks.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getSpecialCraftOperationByCraftCode } from '../src/data/fcs/special-craft-operations.ts'
import { ensureSpecialCraftSourceTask } from '../src/data/fcs/special-craft-source-task-registry.ts'
import { generateSpecialCraftTaskOrdersFromProductionOrder } from '../src/data/fcs/special-craft-task-generation.ts'

const baseOrder = productionOrders.find((order) => {
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  return snapshot?.patternFiles.some((patternFile) =>
    patternFile.recordKind !== 'MATERIAL_ASSOCIATION'
    && patternFile.pieceRows.some((pieceRow) => (pieceRow.specialCrafts ?? []).some((craft) =>
      Boolean(getSpecialCraftOperationByCraftCode(craft.craftCode)),
    )),
  )
})
assert(baseOrder, '缺少可构造 route occurrence 对抗用例的生产单')
const baseSnapshot = getProductionOrderTechPackSnapshot(baseOrder.productionOrderId)
assert(baseSnapshot, 'route occurrence 对抗用例缺少技术包快照')

const productionOrder = JSON.parse(JSON.stringify(baseOrder)) as typeof baseOrder
const snapshot = JSON.parse(JSON.stringify(baseSnapshot)) as typeof baseSnapshot
productionOrder.productionOrderId = `${baseOrder.productionOrderId}-ROUTE-OCCURRENCE-CHECK`
productionOrder.productionOrderNo = `${baseOrder.productionOrderNo}-路线对抗`
snapshot.productionOrderId = productionOrder.productionOrderId
snapshot.productionOrderNo = productionOrder.productionOrderNo
snapshot.snapshotId = `${baseSnapshot.snapshotId}-ROUTE-OCCURRENCE-CHECK`

const patternFile = snapshot.patternFiles.find((item) =>
  item.recordKind !== 'MATERIAL_ASSOCIATION'
  && item.pieceRows.some((pieceRow) => (pieceRow.specialCrafts ?? []).some((craft) =>
    Boolean(getSpecialCraftOperationByCraftCode(craft.craftCode)),
  )),
)
assert(patternFile, '缺少带辅助/特种工艺的实体纸样')
const sourcePiece = patternFile.pieceRows.find((pieceRow) => (pieceRow.specialCrafts ?? []).some((craft) =>
  Boolean(getSpecialCraftOperationByCraftCode(craft.craftCode)),
))
assert(sourcePiece, '缺少带辅助/特种工艺的裁片部位')
const sourceCraft = sourcePiece.specialCrafts?.find((craft) => Boolean(getSpecialCraftOperationByCraftCode(craft.craftCode)))
assert(sourceCraft, '缺少有效辅助/特种工艺')
const operation = getSpecialCraftOperationByCraftCode(sourceCraft.craftCode)
assert(operation, '无法读取工艺 operation')

const sourceSku = productionOrder.demandSnapshot.skuLines[0]
assert(sourceSku, '生产单缺少 SKU')
productionOrder.demandSnapshot.skuLines = [
  { ...sourceSku, skuCode: `${sourceSku.skuCode}-OCC-A`, color: '路线对抗色', size: 'OCC-A', qty: 8 },
  { ...sourceSku, skuCode: `${sourceSku.skuCode}-OCC-B`, color: '路线对抗色', size: 'OCC-B', qty: 13 },
]
snapshot.patternFiles.forEach((item) => {
  item.pieceRows = []
})
patternFile.selectedSizeCodes = ['OCC-A', 'OCC-B']
const skuCodes = productionOrder.demandSnapshot.skuLines.map((line) => line.skuCode)
patternFile.pieceRows = ['A', 'B'].map((suffix) => ({
  ...sourcePiece,
  id: `PIECE-ROUTE-OCCURRENCE-${suffix}`,
  name: suffix === 'A' ? '前片路线对抗' : '后片路线对抗',
  specialCrafts: [{ ...sourceCraft, selectedTargetObject: '已裁部位' as const }],
  colorAllocations: [{ colorName: '路线对抗色', colorCode: 'OCC', skuCodes, pieceCount: 1 }],
}))

const routeEntryTemplate = snapshot.processEntries.find((entry) => entry.processCode === 'SPECIAL_CRAFT')
assert(routeEntryTemplate, '缺少工艺路线条目模板')
snapshot.processEntries = snapshot.processEntries
  .filter((entry) => entry.processCode !== 'SPECIAL_CRAFT' || entry.craftCode !== sourceCraft.craftCode)
snapshot.processEntries.push(...(['A', 'B'] as const).map((suffix) => ({
  ...routeEntryTemplate,
  id: `ENTRY-ROUTE-OCCURRENCE-${suffix}`,
  craftCode: sourceCraft.craftCode,
  craftName: sourceCraft.craftName,
  selectedTargetObject: '已裁部位' as const,
  linkedPatternIds: [patternFile.id],
  routeObjectKey: `PATTERN:${patternFile.id}:PIECE:PIECE-ROUTE-OCCURRENCE-${suffix}`,
  predecessorEntryIds: [`ENTRY-PREDECESSOR-${suffix}`],
  inputObjectType: 'CUT_PIECE' as const,
  outputObjectType: 'CUT_PIECE' as const,
})))

const result = generateSpecialCraftTaskOrdersFromProductionOrder({
  productionOrder,
  techPackSnapshot: snapshot,
  specialCraftOperations: [operation],
})
assert.equal(result.errors.length, 0, '同工艺双裁片 occurrence 不应产生生成错误')
const tasks = result.taskOrders.filter((task) => task.sourceEntryId?.startsWith('ENTRY-ROUTE-OCCURRENCE-'))
assert.equal(tasks.length, 2, '同款同工艺的两个裁片 route occurrence 必须生成两张加工单')
assert.equal(new Set(tasks.map((task) => task.generationKey)).size, 2, '两个 route occurrence 必须使用不同幂等键')
tasks.forEach((task) => {
  const suffix = task.sourceEntryId?.endsWith('-A') ? 'A' : 'B'
  assert.equal(task.demandLines?.length, 2, '同一 occurrence 下多个 SKU 必须保留在同一加工单')
  assert(task.demandLines?.every((line) => line.sourceEntryId === task.sourceEntryId), '加工单不得混入其他 occurrence 的明细')
  assert(task.demandLines?.every((line) => line.routeObjectKey === task.routeObjectKey), '明细与加工单 routeObjectKey 必须一致')
  assert.deepEqual(task.predecessorEntryIds, [`ENTRY-PREDECESSOR-${suffix}`], '不同裁片 occurrence 的前置 ID 不得混合')
  assert(task.demandLines?.every((line) =>
    line.inputObjectType === 'CUT_PIECE' && line.outputObjectType === 'CUT_PIECE',
  ), '需求明细必须保留技术包快照的投入/产出对象类型')
})

const linkedTasks = tasks.map((task) => {
  const sourceTask = ensureSpecialCraftSourceTask({
    workOrderId: task.taskOrderId,
    productionOrderId: task.productionOrderId,
    productionOrderNo: task.productionOrderNo,
    operationId: task.operationId,
    operationName: task.operationName,
    craftCode: task.craftCode,
    factoryId: 'WAIT_ASSIGN',
    factoryName: '待分配',
    planQty: task.planQty,
    qtyUnit: task.unit,
    createdAt: task.createdAt,
    dueAt: task.dueAt,
    sourceEntryId: task.sourceEntryId,
    routeObjectKey: task.routeObjectKey,
    predecessorEntryIds: task.predecessorEntryIds,
    inputObjectType: task.inputObjectType,
    outputObjectType: task.outputObjectType,
  })
  return { task, sourceTask }
})
assert.equal(new Set(linkedTasks.map(({ sourceTask }) => sourceTask.taskId)).size, 2, '两个 occurrence 必须关联不同 sourceTaskId')
linkedTasks.forEach(({ task, sourceTask }) => {
  const canonicalTask = processTasks.find((item) => item.taskId === sourceTask.taskId)
  assert(canonicalTask, `${task.sourceEntryId} 必须生成或命中对应来源任务`)
  assert.equal(canonicalTask.sourceEntryId, task.sourceEntryId, '来源任务必须优先按 sourceEntryId 匹配')
  assert.deepEqual(canonicalTask.predecessorEntryIds, task.predecessorEntryIds, '来源任务不得混入其他 occurrence 的前置 ID')
})

const legacyRequest = {
  workOrderId: 'LEGACY-WORK-ORDER-A',
  productionOrderId: productionOrder.productionOrderId,
  productionOrderNo: productionOrder.productionOrderNo,
  operationId: operation.operationId,
  operationName: operation.operationName,
  craftCode: operation.craftCode,
  factoryId: 'WAIT_ASSIGN',
  factoryName: '待分配',
  planQty: 1,
  qtyUnit: '片',
  createdAt: productionOrder.createdAt,
  dueAt: productionOrder.demandSnapshot.requiredDeliveryDate || productionOrder.updatedAt,
}
const legacySourceA = ensureSpecialCraftSourceTask(legacyRequest)
const legacySourceB = ensureSpecialCraftSourceTask({ ...legacyRequest, workOrderId: 'LEGACY-WORK-ORDER-B' })
assert.equal(legacySourceA.taskId, legacySourceB.taskId, '仅旧数据缺 occurrence 时按 craftCode 复用来源任务')
assert(!linkedTasks.some(({ sourceTask }) => sourceTask.taskId === legacySourceA.taskId), '旧 craftCode 兼容不得吞并 occurrence 来源任务')

console.log(JSON.stringify({
  routeOccurrenceTasks: tasks.length,
  skuLinesPerOccurrence: tasks.map((task) => task.demandLines?.length ?? 0),
  sourceTaskIds: linkedTasks.map(({ sourceTask }) => sourceTask.taskId),
  predecessorEntryIds: tasks.map((task) => task.predecessorEntryIds),
}, null, 2))
