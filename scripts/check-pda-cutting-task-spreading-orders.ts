import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../src/data/fcs/cutting/pda-cutting-task-source.ts'
import { getPdaCuttingTaskSnapshot } from '../src/data/fcs/pda-cutting-execution-source.ts'
import { renderPdaCuttingTaskDetailPage } from '../src/pages/pda-cutting-task-detail.ts'

const targetTaskId = 'TASK-CUT-000201'

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

console.log('check-pda-cutting-task-spreading-orders PASS')
