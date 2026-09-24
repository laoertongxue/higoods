import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeEngineeringTaskItems } from '../../src/data/pcs-engineering-task-item-progress.ts'
import { evaluateAccessoryPurchaseCompletion } from '../../src/data/pcs-engineering-purchase-linkage.ts'
import type { EngineeringTaskMaterialLine, EngineeringTaskRecord } from '../../src/data/pcs-engineering-master-types.ts'
const line = (id: string, reviewStatus: EngineeringTaskMaterialLine['reviewStatus'], requirementType: EngineeringTaskMaterialLine['requirementType'] = '印花', status: EngineeringTaskMaterialLine['status'] = '正常') => ({ materialLineId: id, materialSkuId: id.startsWith('same') ? 'SAME-SKU' : id, reviewStatus, requirementType, status } as EngineeringTaskMaterialLine)
for (const taskType of ['PATTERN_ARTWORK', 'COLOR_FABRIC', 'COLOR_YARN'] as const) test(`${taskType} 多明细全部有效项通过才完成，同SKU不同要求不合并`, () => {
  const requirement = taskType === 'PATTERN_ARTWORK' ? '印花' : '染色'
  const task = { taskType, materialLines: [line('same-red', '通过', requirement), line('same-blue', '未通过', requirement), line('old', '待提交', requirement, '因需求变更结束')] }
  let result = summarizeEngineeringTaskItems(task)
  assert.equal(result.total, 2); assert.equal(result.completed, 1); assert.equal(result.rework, 1); assert.equal(result.allCompleted, false)
  task.materialLines[1].reviewStatus = '待审核'; result = summarizeEngineeringTaskItems(task)
  assert.equal(result.pendingReview, 1); assert.equal(result.allCompleted, false)
  task.materialLines[1].reviewStatus = '通过'; result = summarizeEngineeringTaskItems(task)
  assert.equal(result.completed, 2); assert.equal(result.allCompleted, true)
  assert.equal(summarizeEngineeringTaskItems({ taskType, materialLines: [] }).allCompleted, false)
})
test('多辅料分单覆盖，第一张下单不足以完成，失效单不能提供覆盖', () => {
  const task = { taskType: 'ACCESSORY_PURCHASE', materialLines: [line('ACC-A', '待提交', '辅料'), line('ACC-B', '待提交', '辅料')] } as EngineeringTaskRecord
  const orders = [{ orderNo: 'PO-A', materialSkuIds: ['ACC-A'], orderedAt: '2026-09-25 09:00', status: '已下单' as const }, { orderNo: 'PO-B', materialSkuIds: ['ACC-B'], orderedAt: '2026-09-25 10:00', status: '已下单' as const }]
  const partial = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: ['ACC-A', 'ACC-B'], purchaseOrders: orders.slice(0, 1) })
  assert.equal(partial.complete, false); assert.equal(summarizeEngineeringTaskItems(task, partial.coveredMaterialSkuIds).completed, 1)
  const full = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: ['ACC-A', 'ACC-B'], purchaseOrders: orders })
  assert.equal(full.complete, true); assert.equal(full.completedAt, orders[1].orderedAt); assert.equal(summarizeEngineeringTaskItems(task, full.coveredMaterialSkuIds).allCompleted, true)
  const invalid = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: ['ACC-A', 'ACC-B'], purchaseOrders: [orders[0], { ...orders[1], status: '已作废' }] })
  assert.equal(invalid.complete, false); assert.equal(summarizeEngineeringTaskItems(task, invalid.coveredMaterialSkuIds).completed, 1)
})
