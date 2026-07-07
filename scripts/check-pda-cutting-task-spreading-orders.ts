import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../src/data/fcs/cutting/pda-cutting-task-source.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../src/data/fcs/factory-mock-data.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { setPdaSession } from '../src/data/fcs/store-domain-pda.ts'
import { shouldGenerateCutOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source.ts'
import { renderPdaCuttingTaskDetailPage } from '../src/pages/pda-cutting-task-detail.ts'
import { renderPdaCuttingSpreadingPage } from '../src/pages/pda-cutting-spreading.ts'

const targetTaskId = 'TASK-CUT-000201'
const requiredStableCutOrderNos = [
  'CUT-260306-101-01',
  'CUT-260306-101-02',
  'CUT-260307-102-01',
  'CUT-260307-102-03',
  'CUT-260302-006-01',
  'CUT-260301-005-01',
  'CUT-260303-007-01',
]

const generatedCutOrders = listGeneratedCutOrderSourceRecords()
const generatedCutOrderByNo = new Map(generatedCutOrders.map((record) => [record.cutOrderNo, record] as const))
const continuousClosedLoopSnippets = ['铺布单', '开始铺布', '完成铺布', '入仓', '待交出', '交出', '入待交出仓']
requiredStableCutOrderNos.forEach((cutOrderNo) => {
  const record = generatedCutOrderByNo.get(cutOrderNo)
  assert.ok(record, `PDA 稳定裁片单 fixture 必须真实存在：${cutOrderNo}`)
  const order = productionOrders.find((item) => item.productionOrderId === record.productionOrderId)
  assert.ok(order, `PDA 稳定裁片单 ${cutOrderNo} 必须能回溯真实生产单`)
  assert.ok(shouldGenerateCutOrderForProductionOrder(order), `PDA 稳定裁片单 ${cutOrderNo} 必须绑定到合法裁片任务边界`)
  assert.equal(record.cutOrderSourceLabel, '独立裁片任务', `PDA 稳定裁片单 ${cutOrderNo} 来源标签错误`)
  assert.equal(record.cutReturnModeLabel, '回我方裁床待交出仓', `PDA 稳定裁片单 ${cutOrderNo} 回流方式标签错误`)
  assert.equal(record.internalCraftOrderPolicyLabel, '回仓后生成我方加工单', `PDA 稳定裁片单 ${cutOrderNo} 我方加工单策略标签错误`)
})

const taskSource = listPdaCuttingTaskSourceRecords().find((item) => item.taskId === targetTaskId)
assert.ok(taskSource, `缺少 PDA 裁片任务 mock：${targetTaskId}`)
assert.equal(taskSource.cutOrderIds.length, 2, 'TASK-CUT-000201 应体现一个裁片任务下多张裁片单')
assert.equal(taskSource.executionOrderIds.length, 4, 'TASK-CUT-000201 应体现一个裁片任务下多张铺布单')
assert.deepEqual(taskSource.cutOrderNos, ['CUT-260306-101-01', 'CUT-260306-101-02'])
assert.deepEqual(taskSource.executionOrderNos, ['CPO-20260318-A1', 'CPO-20260318-A2', 'CPO-20260318-A3', 'CPO-20260318-A4'])

const spreadingOrders = listPdaCuttingExecutionSourceRecords().filter((item) => item.taskId === targetTaskId)
assert.equal(spreadingOrders.length, 4, '铺布单来源记录数量应与任务来源一致')
spreadingOrders.forEach((item) => {
  assert.equal(item.executionObjectType, 'SPREADING_ORDER', `${item.executionOrderNo} 应明确为铺布单`)
  assert.ok(['CUT-260306-101-01', 'CUT-260306-101-02'].includes(item.cutOrderNo), `${item.executionOrderNo} 应绑定目标裁片单`)
})
assert.equal(spreadingOrders.filter((item) => item.cutOrderNo === 'CUT-260306-101-01').length, 2, '第一张裁片单下应有 2 张铺布单')
assert.equal(spreadingOrders.filter((item) => item.cutOrderNo === 'CUT-260306-101-02').length, 2, '第二张裁片单下应有 2 张铺布单')

const detail = getPdaCuttingTaskSnapshot(targetTaskId)
assert.ok(detail, `缺少 PDA 裁片任务详情投影：${targetTaskId}`)
assert.equal(detail.cutOrderGroups.length, 2, '详情投影应按 2 张裁片单分组')
assert.equal(detail.cutPieceOrderCount, 4, '详情投影应展示 4 张铺布单')
assert.equal(detail.completedCutPieceOrderCount, 1, '详情投影应有 1 张已完成铺布单')
assert.equal(detail.pendingCutPieceOrderCount, 3, '详情投影应有 3 张未完成铺布单')
assert.ok(detail.cutPieceOrders.every((line) => line.executionObjectType === 'SPREADING_ORDER'), '详情行应保留铺布单类型')
assert.ok(detail.cutPieceOrders.every((line) => line.executionObjectTypeLabel === '铺布单'), '详情行应显示铺布单标签')
assert.deepEqual(detail.cutOrderGroups.map((group) => group.cutOrderNo), ['CUT-260306-101-01', 'CUT-260306-101-02'])
assert.ok(detail.cutOrderGroups.every((group) => group.spreadingOrderCount === 2), '每张裁片单下应有 2 张铺布单')

const html = renderPdaCuttingTaskDetailPage(targetTaskId)
;[
  'TASK-CUT-000201',
  '下一步',
  '裁片单与铺布单',
  '按裁片单分组，避免选错',
  'CUT-260306-101-01',
  'CUT-260306-101-02',
  '铺布单',
  '4 张',
  '未完成',
  '3 张',
  'CPO-20260318-A1',
  'CPO-20260318-A2',
  'CPO-20260318-A3',
  'CPO-20260318-A4',
].forEach((snippet) => {
  assert.ok(html.includes(snippet), `PDA 裁片任务详情缺少：${snippet}`)
})

assert.equal(html.includes('裁片执行单'), false, 'PDA 裁片任务详情不应再显示裁片执行单')
assert.equal(html.includes('铺布执行单'), false, 'PDA 裁片任务详情不应再显示铺布执行单')
assert.equal(html.includes('执行对象'), false, 'PDA 裁片任务详情不应再显示执行对象')
assert.equal(html.includes('统一追踪 ID'), false, 'PDA 裁片任务详情首屏不应展示管理追踪块')

const execSource = readFileSync(new URL('../src/pages/pda-exec.ts', import.meta.url), 'utf8')
;[
  'getCuttingTaskListSummary',
  '进入裁片',
  '裁片单',
  '铺布单',
  '下一步',
].forEach((snippet) => {
  assert.ok(execSource.includes(snippet), `PDA 执行列表缺少裁片入口摘要守卫：${snippet}`)
})
assert.equal(execSource.includes('裁片执行单'), false, 'PDA 执行列表不应再显示裁片执行单')
assert.equal(execSource.includes('铺布执行单'), false, 'PDA 执行列表不应再显示铺布执行单')

const continuousCutOrder = generatedCutOrders.find((record) =>
  record.cutOrderSourceType === 'CONTINUOUS_WITH_CUTTING_TASK'
  && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY'
)
assert.ok(continuousCutOrder, '必须存在当前生成的含裁片连续任务裁片单')

const continuousTaskSource = listPdaCuttingTaskSourceRecords().find((item) =>
  item.taskId === continuousCutOrder.cuttingTaskId
  && item.cutOrderIds.includes(continuousCutOrder.cutOrderId)
)
assert.ok(continuousTaskSource, 'PDA 连续裁片任务必须从当前生成的连续裁片单动态派生')
assert.deepEqual(continuousTaskSource.cutOrderNos, [continuousCutOrder.cutOrderNo])

const continuousDetail = getPdaCuttingTaskSnapshot(continuousTaskSource.taskId)
assert.ok(continuousDetail, 'PDA 连续裁片任务必须生成详情投影')
assert.equal(continuousDetail.cuttingReportMode, 'CONTINUOUS_TASK_CUTTING_COMPLETION')
assert.equal(continuousDetail.nextRecommendedAction, '上报裁片完成')
assert.ok(continuousDetail.cutPieceOrders.every((line) => line.nextActionLabel === '上报裁片完成'), '连续裁片执行行下一步必须是上报裁片完成')
assert.ok(continuousDetail.cutPieceOrders.every((line) => line.primaryExecutionRouteKey === 'spreading'), '连续裁片执行行走铺布入口但页面内切换为上报表单')
assert.ok(continuousDetail.cutCompletionPartRows.length > 0, '连续裁片详情必须包含部位完成上报行')
assert.ok(continuousDetail.cutCompletionPartRows.every((row) => row.partName && row.colorName && row.cutPieceQty > 0 && row.garmentAvailableQty > 0), '连续裁片完成上报行必须包含部位、颜色、裁出片数和可做成衣数')

const continuousDetailHtml = renderPdaCuttingTaskDetailPage(continuousTaskSource.taskId)
;[
  '裁片完成上报',
  '可做成衣数',
  continuousCutOrder.cutOrderNo,
  continuousCutOrder.productionOrderNo,
].forEach((snippet) => {
  assert.ok(continuousDetailHtml.includes(snippet), `PDA 连续裁片详情缺少：${snippet}`)
})
assert.equal(continuousDetailHtml.includes('裁片单与铺布单'), false, '连续裁片详情不应展示裁片单与铺布单分组')
continuousClosedLoopSnippets.forEach((snippet) => {
  assert.equal(continuousDetailHtml.includes(snippet), false, `连续裁片详情不应出现闭环动作词：${snippet}`)
})

const pdaStorage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => pdaStorage.get(key) ?? null,
    setItem: (key: string, value: string) => pdaStorage.set(key, String(value)),
    removeItem: (key: string) => pdaStorage.delete(key),
    clear: () => pdaStorage.clear(),
  },
})
setPdaSession({
  userId: `${TEST_FACTORY_ID}_operator`,
  loginId: `${TEST_FACTORY_ID}_operator`,
  userName: '裁片操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: TEST_FACTORY_ID,
  factoryName: TEST_FACTORY_NAME,
  loggedAt: '2026-03-18 08:00:00',
})
const continuousSpreadingHtml = renderPdaCuttingSpreadingPage(continuousTaskSource.taskId)
assert.ok(continuousSpreadingHtml.includes('裁片完成上报'), '连续裁片铺布入口必须改为裁片完成上报')
assert.ok(continuousSpreadingHtml.includes('可做成衣数'), '连续裁片铺布入口必须显示可做成衣数')
assert.ok(continuousSpreadingHtml.includes('data-pda-cut-completion-feedback'), '连续裁片上报入口必须有局部反馈容器')
continuousClosedLoopSnippets.forEach((snippet) => {
  assert.equal(continuousSpreadingHtml.includes(snippet), false, `连续裁片铺布入口不应出现闭环动作词：${snippet}`)
})

;[
  '上报裁片完成',
  'cuttingReportMode',
].forEach((snippet) => {
  assert.ok(execSource.includes(snippet), `PDA 执行列表缺少连续裁片入口守卫：${snippet}`)
})

const spreadingSource = readFileSync(new URL('../src/pages/pda-cutting-spreading.ts', import.meta.url), 'utf8')
assert.ok(spreadingSource.includes('data-pda-cut-completion-feedback'), '连续裁片上报页源码必须保留局部反馈容器')
assert.ok(spreadingSource.includes('syncCutCompletionReportDom'), '连续裁片上报提交后必须走局部反馈同步')

console.log('check-pda-cutting-task-spreading-orders PASS')
