import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listPlateMakingTaskPendingItems,
  listPlateMakingTasks,
  resetPlateMakingTaskRepository,
} from '../src/data/pcs-plate-making-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsEngineeringTaskEvent,
  renderPcsPlateMakingTaskPage,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'

function actionTarget(action: string, dataset: Record<string, string> = {}): HTMLElement {
  return {
    dataset: {
      pcsEngineeringAction: action,
      ...dataset,
    },
    closest() {
      return this
    },
  } as unknown as HTMLElement
}

function countRenderedRows(html: string): number {
  return (html.match(/<tr class="hover:bg-slate-50\/70">/g) || []).length
}

resetProjectRepository()
resetStyleArchiveRepository()
resetPlateMakingTaskRepository()
resetPcsEngineeringTaskState()

const tasks = listPlateMakingTasks()
assert.ok(tasks.length > 8, '制版任务 mock 数据应超过单页数量以触发分页')
assert.ok(tasks.length <= 20, '制版任务 mock 数据不得超过 20 行')
assert.equal(listPlateMakingTaskPendingItems().length, 0, '制版任务不应保留历史脏 pending mock 数据')

const requiredStatuses = ['进行中', '待确认', '已确认', '已生成技术包', '已完成', '异常待处理', '已取消']
for (const status of requiredStatuses) {
  assert.ok(tasks.some((task) => task.status === status), `制版任务 mock 缺少状态：${status}`)
}

for (const task of tasks) {
  assert.ok(task.projectId, `${task.plateTaskCode} 必须关联正式商品项目`)
  assert.ok(task.projectCode, `${task.plateTaskCode} 必须带商品项目编码`)
  assert.ok(task.projectNodeId, `${task.plateTaskCode} 必须关联正式制版项目节点`)
  assert.ok(task.styleCode || task.productStyleCode || task.spuCode, `${task.plateTaskCode} 必须带款式/SPU 信息`)
  assert.ok((task.materialRequirementLines || []).length > 0, `${task.plateTaskCode} 必须带制版面辅料输入`)

  const node = getProjectNodeRecordByWorkItemTypeCode(task.projectId, 'PATTERN_TASK')
  assert.equal(node?.projectNodeId, task.projectNodeId, `${task.plateTaskCode} 的项目节点必须是 PATTERN_TASK`)

  if (task.status === '待确认') {
    assert.equal(task.sampleReviewStatus, '待样板确认', `${task.plateTaskCode} 待确认状态必须对应待样板确认`)
    assert.ok(task.sampleReviewSubmittedAt, `${task.plateTaskCode} 待确认状态必须有样板提交时间`)
    assert.equal(task.linkedTechPackVersionId, '', `${task.plateTaskCode} 待样板确认时不能已有技术包`)
  }

  if (task.status === '已确认') {
    assert.equal(task.sampleReviewStatus, '样板已通过', `${task.plateTaskCode} 已确认状态必须对应样板已通过`)
    assert.equal(task.linkedTechPackVersionId, '', `${task.plateTaskCode} 已确认待写包时不能已有技术包`)
  }

  if (task.status === '已生成技术包' || task.status === '已完成') {
    assert.equal(task.sampleReviewStatus, '样板已通过', `${task.plateTaskCode} 写包或完成前必须样板已通过`)
    assert.ok(task.linkedTechPackVersionId, `${task.plateTaskCode} 写包或完成状态必须有技术包版本 ID`)
    assert.ok(task.linkedTechPackVersionCode, `${task.plateTaskCode} 写包或完成状态必须有技术包版本编码`)
    assert.ok(task.linkedTechPackUpdatedAt, `${task.plateTaskCode} 写包或完成状态必须有技术包更新时间`)
  }

  if (task.status === '异常待处理') {
    assert.equal(task.sampleReviewStatus, '未提交', `${task.plateTaskCode} 异常阻塞状态不应提前显示样板已通过`)
    assert.equal(task.linkedTechPackVersionId, '', `${task.plateTaskCode} 异常阻塞状态不应提前生成技术包`)
  }

  if (task.status === '已取消') {
    assert.equal(task.sampleReviewStatus, '未提交', `${task.plateTaskCode} 已取消状态不应保留样板确认结果`)
    assert.equal(task.linkedTechPackVersionId, '', `${task.plateTaskCode} 已取消状态不应保留技术包版本`)
  }

  if (task.sampleReviewStatus === '样板已驳回') {
    assert.ok(task.reworkReason, `${task.plateTaskCode} 样板驳回必须有返工原因`)
    assert.equal(task.status, '进行中', `${task.plateTaskCode} 样板驳回后应回到制版执行中`)
  }
}

const page1Html = renderPcsPlateMakingTaskPage()
assert.ok(page1Html.includes(`共 ${tasks.length} 条，当前第 1 / 2 页`), '制版任务列表第一页应显示分页页脚')
assert.equal(countRenderedRows(page1Html), 8, '制版任务第一页应只渲染 8 行')
assert.ok(page1Html.includes('异常待处理'), '制版任务状态筛选应包含异常待处理')
assert.ok(page1Html.includes('已取消'), '制版任务状态筛选应包含已取消')

const filterIndex = page1Html.indexOf('data-pcs-engineering-field="plate-search"')
const metricIndex = page1Html.indexOf('data-pcs-engineering-action="set-plate-quick-filter"')
const tableIndex = page1Html.indexOf('<thead class="bg-slate-50">', metricIndex)
assert.ok(filterIndex >= 0, '制版任务列表应渲染搜索条件')
assert.ok(metricIndex > filterIndex, '统计卡片必须位于搜索条件下方')
assert.ok(tableIndex > metricIndex, '制版任务表格必须位于统计卡片下方')

handlePcsEngineeringTaskEvent(actionTarget('change-plate-page', { pageStep: '1' }))
const page2Html = renderPcsPlateMakingTaskPage()
assert.ok(page2Html.includes(`共 ${tasks.length} 条，当前第 2 / 2 页`), '制版任务列表应支持切换到第二页')
assert.equal(countRenderedRows(page2Html), tasks.length - 8, '制版任务第二页应渲染剩余行')

console.log('check-pcs-plate-making-mock-data PASS')
