import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../src/data/fcs/cutting/pda-cutting-task-source.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../src/data/fcs/factory-mock-data.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getPdaSession, setPdaSession } from '../src/data/fcs/store-domain-pda.ts'
import { shouldGenerateCutOrderForProductionOrder } from '../src/data/fcs/task-generation-boundaries.ts'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source.ts'
import { renderPdaCuttingTaskDetailPage } from '../src/pages/pda-cutting-task-detail.ts'
import { renderPdaExecDetailPage } from '../src/pages/pda-exec-detail.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'

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
requiredStableCutOrderNos.forEach((cutOrderNo) => {
  const record = generatedCutOrderByNo.get(cutOrderNo)
  assert.ok(record, `PDA 稳定裁片单 fixture 必须真实存在：${cutOrderNo}`)
  const order = productionOrders.find((item) => item.productionOrderId === record.productionOrderId)
  assert.ok(order, `PDA 稳定裁片单 ${cutOrderNo} 必须能回溯真实生产单`)
  assert.ok(shouldGenerateCutOrderForProductionOrder(order), `PDA 稳定裁片单 ${cutOrderNo} 必须绑定到合法裁片任务边界`)
  if (record.cutOrderSourceType === 'CUTTING_SEWING_IRON_PACK_TASK') {
    assert.equal(record.cutOrderSourceLabel, '保留三方裁剪执行所需裁片单和唛架依据', `PDA 固定合并任务裁片单 ${cutOrderNo} 来源标签错误`)
    assert.equal(record.cutReturnModeLabel, '三方工厂上报裁片完成', `PDA 固定合并任务裁片单 ${cutOrderNo} 上报方式标签错误`)
    assert.equal(record.internalCraftOrderPolicyLabel, '辅助/特种工艺随合并任务交三方，不生成中央加工单', `PDA 固定合并任务裁片单 ${cutOrderNo} 中央加工单策略标签错误`)
  } else {
    assert.equal(record.cutOrderSourceLabel, '独立裁剪任务', `PDA 稳定裁片单 ${cutOrderNo} 来源标签错误`)
    assert.equal(record.cutReturnModeLabel, '回我方裁床待交出仓', `PDA 稳定裁片单 ${cutOrderNo} 回流方式标签错误`)
    assert.equal(record.internalCraftOrderPolicyLabel, '按中央辅助/特种工艺要求生成加工单', `PDA 稳定裁片单 ${cutOrderNo} 我方加工单策略标签错误`)
  }
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

const mergedCutOrder = generatedCutOrders.find((record) =>
  record.cutOrderSourceType === 'CUTTING_SEWING_IRON_PACK_TASK'
  && record.cutReturnMode === 'THIRD_PARTY_REPORT_ONLY'
)
assert.ok(mergedCutOrder, '必须存在当前生成的裁剪+车缝+烫包合并任务裁片单')

assert.equal(
  listPdaCuttingTaskSourceRecords().some((item) => item.taskId === mergedCutOrder.cuttingTaskId),
  false,
  '固定合并任务不得再生成独立裁剪 PDA 执行来源',
)

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
assert.ok(getPdaSession(), 'PDA 固定合并任务验收前必须建立有效工厂会话')
const fixedMergedTask = listRuntimeProcessTasks().find((task) => task.mergedTaskType === 'CUTTING_SEWING_IRON_PACK')
assert.ok(fixedMergedTask, '必须存在裁剪+车缝+烫包固定合并任务')
const fixedMergedHtml = renderPdaExecDetailPage(fixedMergedTask.taskId)
;['裁剪+车缝+烫包', '本厂责任范围', '完整 SKU', 'PDA 只负责接单、开始和交出', '开始生产'].forEach((snippet) => {
  assert.ok(fixedMergedHtml.includes(snippet), `PDA 固定合并任务详情缺少：${snippet}`)
})
;['裁片完成上报', '开始铺布', '完成铺布', '开始裁剪', '完成裁剪', '上传进度', '>单独完工<'].forEach((snippet) => {
  assert.equal(fixedMergedHtml.includes(snippet), false, `PDA 固定合并任务不得出现执行步骤：${snippet}`)
})

console.log('check-pda-cutting-task-spreading-orders PASS')
