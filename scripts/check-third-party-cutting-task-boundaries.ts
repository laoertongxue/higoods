import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ProductionOrder, TaskBreakdownSummary } from '../src/data/fcs/production-orders.ts'

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

function taskCoversCutting(task: { processNameZh?: string; coveredProcesses?: Array<{ processName?: string }> }): boolean {
  return Boolean(
    task.processNameZh?.includes('裁')
    || task.coveredProcesses?.some((process) => process.processName?.includes('裁')),
  )
}

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
})

const { productionOrders } = await import('../src/data/fcs/production-orders.ts')
const {
  hasFormalTechPackForCutting,
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedCutOrderSourceRecords,
} = await import('../src/data/fcs/cutting/generated-cut-orders.ts')
const { getProductionOrderTechPackSnapshot } = await import('../src/data/fcs/production-order-tech-pack-runtime.ts')
const { generateSpecialCraftTaskOrdersFromProductionOrder } = await import('../src/data/fcs/special-craft-task-generation.ts')
const {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
  shouldGenerateInternalCraftOrderForProductionOrder,
} = await import('../src/data/fcs/task-generation-boundaries.ts')
const { listRuntimeProcessTasks } = await import('../src/data/fcs/runtime-process-tasks.ts')
const { handleContinuousDispatchEvent, renderContinuousDispatchPage } = await import('../src/pages/continuous-dispatch.ts')
const { renderTaskBreakdownPage } = await import('../src/pages/task-breakdown.ts')

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

function generateCraftOrderResult(order: ProductionOrder) {
  return generateSpecialCraftTaskOrdersFromProductionOrder({
    productionOrder: order,
    techPackSnapshot: getProductionOrderTechPackSnapshot(order.productionOrderId),
  })
}

function assertSkippedInternalCraftOrder(order: ProductionOrder, message: string): void {
  const result = generateCraftOrderResult(order)
  assert.equal(result.taskOrders.length, 0, `${message}，不得生成任务`)
  assert.equal(result.demandLines.length, 0, `${message}，不得拆解任务明细`)
  assert.equal(result.generationBatch.status, '已跳过', `${message}，生成批次状态必须为已跳过`)
  assert(
    result.warnings.some((warning) =>
      warning.includes('已跳过') && warning.includes('不生成我方辅助/特种工艺加工单'),
    ),
    `${message}，warning 必须说明已跳过且不生成我方辅助/特种工艺加工单`,
  )
}

assertSkippedInternalCraftOrder(wholeOrder, '整单任务')
assertSkippedInternalCraftOrder(continuousWithCutting, '含裁片连续工序任务')
assertSkippedInternalCraftOrder(continuousWithoutCutting, '不含裁片连续工序任务')

const independentCuttingWithCraft = productionOrders.find((order) =>
  shouldGenerateInternalCraftOrderForProductionOrder(order) && generateCraftOrderResult(order).taskOrders.length > 0,
)
assert(independentCuttingWithCraft, '必须存在有技术包工艺标记的独立裁片任务样本')
assert(
  generateCraftOrderResult(independentCuttingWithCraft).taskOrders.length > 0,
  '独立裁片任务存在技术包工艺标记时必须生成我方加工单',
)

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

const internalCraftExcludedCutOrders = cutOrders.filter((record) =>
  record.internalCraftOrderPolicy === 'DO_NOT_GENERATE'
  || record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY',
)
assert(internalCraftExcludedCutOrders.length > 0, '必须存在不生成我方加工单的裁片单样本')
assert(
  internalCraftExcludedCutOrders.some((record) =>
    record.productionOrderNo === 'PO-202603-0008' && record.cutOrderNo === 'CUT-260304-008-01',
  ),
  '必须存在 PO-202603-0008 / CUT-260304-008-01 三方连续任务裁片单样本',
)

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

const taskBreakdownSource = readFileSync(resolve('src/pages/task-breakdown.ts'), 'utf8')
const continuousDispatchSource = readFileSync(resolve('src/pages/continuous-dispatch.ts'), 'utf8')
const cutOrdersPageSource = readFileSync(resolve('src/pages/process-factory/cutting/cut-orders.ts'), 'utf8')
const markerPlanSource = readFileSync(resolve('src/pages/process-factory/cutting/marker-plan.ts'), 'utf8')
const specialProcessesSource = readFileSync(resolve('src/pages/process-factory/cutting/special-processes.ts'), 'utf8')

;[
  'listGeneratedCutOrderSourceRecords',
  '裁片单状态',
  '唛架状态',
  '可做成衣数',
  '我方加工单策略',
  'cutOrderSourceLabel',
  'internalCraftOrderPolicyLabel',
].forEach((token) => {
  assert(taskBreakdownSource.includes(token), `任务清单缺少 ${token}`)
})

;[
  '含裁片连续任务',
  '三方上报裁片完成数量和可做成衣数',
  '不生成我方加工单',
].forEach((token) => {
  assert(continuousDispatchSource.includes(token), `连续工序任务分配页缺少 ${token}`)
})

const taskBreakdownHtml = renderTaskBreakdownPage()
assert(taskBreakdownHtml.includes('裁片单状态'), '任务清单渲染结果必须包含裁片单状态')
assert(taskBreakdownHtml.includes('唛架状态'), '任务清单渲染结果必须包含唛架状态')
assert(taskBreakdownHtml.includes('可做成衣数'), '任务清单渲染结果必须包含可做成衣数')
assert(taskBreakdownHtml.includes('我方加工单策略'), '任务清单渲染结果必须包含我方加工单策略')

const continuousDispatchHtml = renderContinuousDispatchPage()
assert(continuousDispatchHtml.includes('含裁片连续任务'), '连续分配渲染结果必须包含含裁片连续任务')
assert(continuousDispatchHtml.includes('三方上报裁片完成数量和可做成衣数'), '连续分配渲染结果必须包含三方上报裁片完成数量和可做成衣数')
assert(continuousDispatchHtml.includes('不生成我方加工单'), '连续分配渲染结果必须包含不生成我方加工单')

;[
  '裁片单来源',
  '回流方式',
  '我方加工单策略',
].forEach((token) => {
  assert(cutOrdersPageSource.includes(token), `裁片单页面缺少 ${token}`)
})

assert(markerPlanSource.includes('三方连续任务用唛架'), '唛架页面必须说明含裁片连续任务只使用我方唛架')
assert(specialProcessesSource.includes('只展示我方内部加工对象'), '特殊工艺页面必须说明不展示三方连续任务内部工艺')

const { renderCraftCuttingCutOrdersPage } = await import('../src/pages/process-factory/cutting/cut-orders.ts')
const { renderCraftCuttingMarkerListPage } = await import('../src/pages/process-factory/cutting/marker-plan.ts')
const { renderCraftCuttingSpecialProcessesPage } = await import('../src/pages/process-factory/cutting/special-processes.ts')
const { buildBindingProcessOrders } = await import('../src/pages/process-factory/cutting/binding-strip-orders.ts')

const cutOrdersHtml = renderCraftCuttingCutOrdersPage()
assert(cutOrdersHtml.includes('裁片单来源'), '裁片单渲染结果必须包含裁片单来源')
assert(cutOrdersHtml.includes('回流方式'), '裁片单渲染结果必须包含回流方式')
assert(cutOrdersHtml.includes('我方加工单策略'), '裁片单渲染结果必须包含我方加工单策略')

const markerPlanHtml = renderCraftCuttingMarkerListPage()
assert(markerPlanHtml.includes('三方连续任务用唛架'), '唛架渲染结果必须包含三方连续任务用唛架说明')

const specialProcessesHtml = renderCraftCuttingSpecialProcessesPage()
assert(specialProcessesHtml.includes('只展示我方内部加工对象'), '特殊工艺渲染结果必须包含我方内部加工对象说明')
assert(specialProcessesHtml.includes('三方连续任务内部工艺不生成我方加工单'), '特殊工艺渲染结果必须包含三方连续任务加工单边界')
assert(!specialProcessesHtml.includes('PO-202603-0008'), '特殊工艺页面不得渲染三方连续任务生产单 PO-202603-0008')
assert(!specialProcessesHtml.includes('CUT-260304-008-01'), '特殊工艺页面不得渲染三方连续任务裁片单 CUT-260304-008-01')
assert(!specialProcessesHtml.includes('BT-260304-008-01-04'), '特殊工艺页面不得渲染三方连续任务捆条单 BT-260304-008-01-04')

const bindingProcessOrders = buildBindingProcessOrders()
internalCraftExcludedCutOrders.forEach((record) => {
  const leakedOrder = bindingProcessOrders.find((order) =>
    order.sourceCutOrderId === record.cutOrderId
    || order.sourceCutOrderNo === record.cutOrderNo
    || order.sourceProductionOrderId === record.productionOrderId
    || order.sourceProductionOrderNo === record.productionOrderNo,
  )
  assert(
    !leakedOrder,
    `不生成我方加工单的裁片单 ${record.cutOrderNo} 不得生成捆条加工单 ${leakedOrder?.bindingOrderNo || ''}`,
  )
  assert(!specialProcessesHtml.includes(record.productionOrderNo), `特殊工艺页面不得包含 ${record.productionOrderNo}`)
  assert(!specialProcessesHtml.includes(record.cutOrderNo), `特殊工艺页面不得包含 ${record.cutOrderNo}`)
})

const runtimeTasks = listRuntimeProcessTasks()
const runtimeCuttingContinuousTasks = runtimeTasks.filter((task) =>
  task.taskUnitType === 'COMBINED_PROCESS_TASK' && taskCoversCutting(task),
)
assert(runtimeCuttingContinuousTasks.length > 0, 'runtime 必须存在至少 1 条含裁片连续任务')

const cuttingContinuousTask = runtimeCuttingContinuousTasks[0]
handleContinuousDispatchEvent({
  closest(selector: string) {
    if (selector === '[data-continuous-dispatch-action]') {
      return {
        dataset: {
          continuousDispatchAction: 'switch-tab',
          tab: 'OTHER',
        },
      }
    }
    return null
  },
} as unknown as HTMLElement)
const continuousDispatchWithCuttingHtml = renderContinuousDispatchPage()
const taskAnchor = cuttingContinuousTask.taskNo || cuttingContinuousTask.taskId
const anchorIndex = continuousDispatchWithCuttingHtml.indexOf(taskAnchor)
assert(anchorIndex >= 0, '其他连续工序任务 Tab 必须渲染真实含裁片任务行')
const rowEndIndex = continuousDispatchWithCuttingHtml.indexOf('</tr>', anchorIndex)
const cuttingContinuousRowHtml = continuousDispatchWithCuttingHtml.slice(anchorIndex, rowEndIndex >= 0 ? rowEndIndex : undefined)
;[
  '我方裁床提供唛架方案',
  '三方上报裁片完成数量和可做成衣数',
  '不生成我方加工单',
].forEach((token) => {
  assert(cuttingContinuousRowHtml.includes(token), `含裁片连续任务行缺少 ${token}`)
})

console.log('check-third-party-cutting-task-boundaries PASS')
