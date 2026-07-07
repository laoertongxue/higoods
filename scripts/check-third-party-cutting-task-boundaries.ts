import assert from 'node:assert/strict'

import { productionOrders, type ProductionOrder, type TaskBreakdownSummary } from '../src/data/fcs/production-orders.ts'
import {
  hasFormalTechPackForCutting,
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedCutOrderSourceRecords,
} from '../src/data/fcs/cutting/generated-cut-orders.ts'
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from '../src/data/fcs/task-generation-boundaries.ts'

function makeSyntheticOrder(productionOrderId: string, taskBreakdownSummary: TaskBreakdownSummary): ProductionOrder {
  const baseOrder = productionOrders[0]
  assert(baseOrder, '必须存在生产单样本用于合成边界输入')
  return {
    ...baseOrder,
    productionOrderId,
    productionOrderNo: productionOrderId,
    taskBreakdownSummary,
  }
}

const wholeOrder = productionOrders.find((order) => (order.taskBreakdownSummary.wholeOrderTaskCount ?? 0) > 0)
assert(wholeOrder, '必须存在整单任务生产单样本')
assert.equal(resolveProductionOrderTaskBoundary(wholeOrder).kind, 'WHOLE_ORDER')
assert.equal(shouldGenerateCutOrderForProductionOrder(wholeOrder), false, '整单任务不得生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(wholeOrder), false, '整单任务不得生成我方辅助/特种工艺加工单')

const continuousWithCutting = productionOrders.find((order) =>
  (order.taskBreakdownSummary.combinedProcessTaskCount ?? 0) > 0
  && (order.taskBreakdownSummary.coveredProcessNames ?? []).some((name) => name.includes('裁')),
)
assert(continuousWithCutting, '必须存在含裁片连续工序任务生产单样本')
assert.notEqual(continuousWithCutting.productionOrderId, 'PO-202603-0007', 'PO-202603-0007 已有多任务事实，不得作为含裁片连续工序任务样本')
assert.equal(resolveProductionOrderTaskBoundary(continuousWithCutting).kind, 'CONTINUOUS_WITH_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(continuousWithCutting), true, '含裁片连续工序任务必须生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(continuousWithCutting), false, '含裁片连续工序任务不得生成我方加工单')

const independentCutting = productionOrders.find((order) =>
  (order.taskBreakdownSummary.wholeOrderTaskCount ?? 0) === 0
  && (order.taskBreakdownSummary.combinedProcessTaskCount ?? 0) === 0
  && (order.taskBreakdownSummary.coveredProcessNames ?? []).some((name) => name.includes('裁')),
)
assert(independentCutting, '必须存在独立裁片任务生产单样本')
assert.equal(resolveProductionOrderTaskBoundary(independentCutting).kind, 'INDEPENDENT_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(independentCutting), true, '独立裁片任务必须生成裁片单')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(independentCutting), true, '独立裁片任务回我方链路时必须生成我方加工单')

const legacyTaskTypeOnlyCutting = productionOrders.find((order) =>
  (order.taskBreakdownSummary.coveredProcessNames ?? []).length === 0
  && order.taskBreakdownSummary.taskTypesTop3.some((name) => name.includes('裁')),
)
assert(legacyTaskTypeOnlyCutting, '必须存在仅 taskTypesTop3 标识裁片的旧摘要样本')
assert.equal(resolveProductionOrderTaskBoundary(legacyTaskTypeOnlyCutting).kind, 'INDEPENDENT_CUTTING')

const continuousWithoutCutting = makeSyntheticOrder('PO-CHECK-CONTINUOUS-WITHOUT-CUTTING', {
  isBrokenDown: false,
  taskTypesTop3: ['车缝+后道连续任务'],
  combinedProcessTaskCount: 1,
  wholeOrderTaskCount: 0,
  coveredProcessNames: ['车缝', '后道'],
})
assert.equal(resolveProductionOrderTaskBoundary(continuousWithoutCutting).kind, 'CONTINUOUS_WITHOUT_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(continuousWithoutCutting), false, '不含裁片连续任务不得生成裁片单')

const independentNonCutting = makeSyntheticOrder('PO-CHECK-INDEPENDENT-NON-CUTTING', {
  isBrokenDown: true,
  taskTypesTop3: ['车缝'],
  combinedProcessTaskCount: 0,
  wholeOrderTaskCount: 0,
  coveredProcessNames: ['车缝'],
})
assert.equal(resolveProductionOrderTaskBoundary(independentNonCutting).kind, 'INDEPENDENT_NON_CUTTING')
assert.equal(shouldGenerateCutOrderForProductionOrder(independentNonCutting), false, '独立非裁片任务不得生成裁片单')

const cutOrders = listGeneratedCutOrderSourceRecords()
const cutOrderProductionOrderIds = new Set(cutOrders.map((record) => record.productionOrderId))
const eligibleCutOrderProductionOrders = productionOrders.filter((order) =>
  hasFormalTechPackForCutting(order) && shouldGenerateCutOrderForProductionOrder(order),
)
const canonicalCutOrderProductionOrderIds = new Set(listCuttingProductionOrdersWithFormalTechPack().map((order) => order.productionOrderId))
assert(eligibleCutOrderProductionOrders.length > 0, '必须存在正式技术包且应生成裁片单的真实生产单样本')
assert.equal(canonicalCutOrderProductionOrderIds.size, eligibleCutOrderProductionOrders.length, '裁片单候选列表必须只包含应生成裁片单的真实生产单')
eligibleCutOrderProductionOrders.forEach((order) => {
  assert(
    canonicalCutOrderProductionOrderIds.has(order.productionOrderId),
    `应生成裁片单的真实生产单 ${order.productionOrderId} 不得被候选列表截断`,
  )
  assert(
    cutOrderProductionOrderIds.has(order.productionOrderId),
    `应生成裁片单的真实生产单 ${order.productionOrderId} 必须出现在裁片单列表`,
  )
})
productionOrders
  .filter((order) => hasFormalTechPackForCutting(order) && !shouldGenerateCutOrderForProductionOrder(order))
  .forEach((order) => {
    assert(
      !cutOrderProductionOrderIds.has(order.productionOrderId),
      `不应生成裁片单的真实生产单 ${order.productionOrderId} 不得出现在裁片单列表`,
    )
  })
assert(
  cutOrders.every((record) => record.productionOrderId !== wholeOrder.productionOrderId),
  '整单任务生产单不得出现在裁片单列表',
)
assert(
  cutOrders.every((record) => record.productionOrderId !== continuousWithoutCutting.productionOrderId),
  '不含裁片连续任务生产单不得出现在裁片单列表',
)
assert(
  cutOrders.every((record) => record.productionOrderId !== independentNonCutting.productionOrderId),
  '独立非裁片任务生产单不得出现在裁片单列表',
)
const continuousWithCuttingCutOrder = cutOrders.find((record) =>
  record.productionOrderId === continuousWithCutting.productionOrderId
  && record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK'
  && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY'
  && record.internalCraftOrderPolicy === 'DO_NOT_GENERATE',
)
assert(
  continuousWithCuttingCutOrder,
  '含裁片连续任务裁片单必须标记为三方上报裁片完成，且不生成我方加工单',
)
assert.equal(continuousWithCuttingCutOrder.cutOrderSourceLabel, '含裁片连续任务')
assert.equal(continuousWithCuttingCutOrder.cutReturnModeLabel, '三方上报裁片完成')
assert.equal(continuousWithCuttingCutOrder.internalCraftOrderPolicyLabel, '不生成我方加工单')

const independentCuttingCutOrder = cutOrders.find((record) =>
  record.productionOrderId === independentCutting.productionOrderId
  && record.cutOrderSourceType === 'INDEPENDENT_CUTTING_TASK'
  && record.cutReturnMode === 'RETURN_TO_OWN_CUTTING_WAREHOUSE'
  && record.internalCraftOrderPolicy === 'GENERATE_AFTER_RETURN',
)
assert(
  independentCuttingCutOrder,
  '独立裁片任务裁片单必须标记为回我方裁床待交出仓，且回仓后生成我方加工单',
)
assert.equal(independentCuttingCutOrder.cutOrderSourceLabel, '独立裁片任务')
assert.equal(independentCuttingCutOrder.cutReturnModeLabel, '回我方裁床待交出仓')
assert.equal(independentCuttingCutOrder.internalCraftOrderPolicyLabel, '回仓后生成我方加工单')

console.log('check-third-party-cutting-task-boundaries PASS')
