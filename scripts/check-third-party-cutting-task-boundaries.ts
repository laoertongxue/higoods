import assert from 'node:assert/strict'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from '../src/data/fcs/task-generation-boundaries.ts'

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

const cutOrders = listGeneratedCutOrderSourceRecords()
assert(
  cutOrders.every((record) => record.productionOrderId !== wholeOrder.productionOrderId),
  '整单任务生产单不得出现在裁片单列表',
)
assert(
  cutOrders.some((record) =>
    record.productionOrderId === continuousWithCutting.productionOrderId
    && record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK'
    && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY'
    && record.internalCraftOrderPolicy === 'DO_NOT_GENERATE',
  ),
  '含裁片连续任务裁片单必须标记为三方上报裁片完成，且不生成我方加工单',
)
assert(
  cutOrders.some((record) =>
    record.productionOrderId === independentCutting.productionOrderId
    && record.cutOrderSourceType === 'INDEPENDENT_CUTTING_TASK'
    && record.cutReturnMode === 'RETURN_TO_OWN_CUTTING_WAREHOUSE'
    && record.internalCraftOrderPolicy === 'GENERATE_AFTER_RETURN',
  ),
  '独立裁片任务裁片单必须标记为回我方裁床待交出仓，且回仓后生成我方加工单',
)

console.log('check-third-party-cutting-task-boundaries PASS')
