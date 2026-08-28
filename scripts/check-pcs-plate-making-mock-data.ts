import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  listEngineeringMasterOrders,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskRecord } from '../src/data/pcs-engineering-master-types.ts'
import { renderPcsPlateMakingTaskPage, resetPcsEngineeringTaskState } from '../src/pages/pcs-engineering-tasks.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPcsEngineeringTaskState()

const style = listStyleArchives()[0]
assert.ok(style, '制版任务检查必须存在款式档案')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单A',
  createdById: 'USER-M-A',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '专项检查固定事实',
    formalProductionSource: '专项检查固定事实',
    checkedAt: '2026-08-27 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: `CHECK-${style.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-27 09:00:00',
    reason: '专项检查已满足做大货要求',
    uniqueTriggerKey: `CHECK-${style.styleCode}`,
  },
  creationReason: '专项检查人工创建',
}).masterOrderId)
const plateTypes = new Set(['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'])
const tasks = master.tasks.filter((task) => plateTypes.has(task.taskType))
const totalPlateTaskCount = listEngineeringMasterOrders()
  .flatMap((item) => item.tasks)
  .filter((task) => plateTypes.has(task.taskType)).length

assert.equal(tasks.length, 4, '工程主单发布后必须一次生成 4 类制版任务')
for (const task of tasks) {
  assert.equal(task.masterOrderId, master.masterOrderId, `${task.taskId} 必须关联当前工程主单`)
  assert.ok(task.taskName, `${task.taskId} 必须带任务名称`)
  assert.ok(task.ownerTeamName, `${task.taskId} 必须带负责团队`)
  assert.ok(['未启用', '待前置', '待开始'].includes(task.status), `${task.taskId} 必须使用工程任务初始状态`)
  assert.ok(Array.isArray(task.dependsOnTaskIds), `${task.taskId} 必须保留固定前置任务结构`)
  assert.equal('plateTaskCode' in task, false, `${task.taskId} 不得读取旧制版任务对象`)
  assert.equal('sampleReviewStatus' in task, false, `${task.taskId} 不得保留旧样板确认事实`)
}

const pageHtml = renderPcsPlateMakingTaskPage()
assert.match(pageHtml, new RegExp(master.masterOrderCode), '制版任务列表必须展示工程主单编号')
assert.match(pageHtml, new RegExp(master.styleCode), '制版任务列表必须展示工程主单款式')
for (const task of tasks as EngineeringTaskRecord[]) {
  assert.match(pageHtml, new RegExp(task.taskId), `${task.taskId} 必须由工程主单任务渲染`)
}
for (const status of ['未启用', '待前置', '待开始', '进行中', '待审核', '返工中', '已完成', '因需求变更结束']) {
  assert.match(pageHtml, new RegExp(`<option value="${status}"`), `制版状态筛选缺少工程任务状态：${status}`)
}
assert.doesNotMatch(pageHtml, /异常待处理|已取消|待样板确认|样板已通过|样板已驳回/, '制版页面不得显示旧状态或旧样板确认事实')
assert.match(pageHtml, new RegExp(`全部任务[\\s\\S]*?>${totalPlateTaskCount}<`), '制版任务列表必须展示真实总数')
assert.match(pageHtml, /条\/页/, '制版任务列表必须保留分页口径')
assert.match(pageHtml, /data-standard-list-page/, '制版任务列表必须使用标准列表页')

console.log('check-pcs-plate-making-mock-data PASS')
