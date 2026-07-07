import assert from 'node:assert/strict'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
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

console.log('check-third-party-cutting-task-boundaries PASS')
