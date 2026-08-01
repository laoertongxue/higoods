import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import { listRevisionTasks } from '../src/data/pcs-revision-task-repository.ts'
import {
  handlePcsEngineeringTaskEvent,
  renderPcsFirstOrderSampleTaskDetailPage,
  renderPcsFirstOrderSampleTaskPage,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskDetailPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskDetailPage,
  renderPcsPlateMakingTaskPage,
  renderPcsRevisionTaskDetailPage,
  renderPcsRevisionTaskPage,
  resetPcsEngineeringTaskRepositories,
  resetPcsEngineeringTaskState,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks.ts'
import { handlePatternTaskEvent } from '../src/pages/pcs-engineering-tasks/pattern-task.ts'
import { handleColorTaskEvent } from '../src/pages/pcs-engineering-tasks/color-task.ts'

function makeActionTarget(action: string, extraDataset: Record<string, string> = {}): HTMLElement {
  return {
    dataset: { pcsEngineeringAction: action, ...extraDataset },
    closest(selector: string) {
      if (selector === '[data-pcs-engineering-action]') return this
      if (selector === '[data-pcs-engineering-list-module]' && this.dataset.pcsEngineeringListModule) return this
      return null
    },
  } as unknown as HTMLElement
}

function makeInvalidClosestTarget(action: string, extraDataset: Record<string, string> = {}): HTMLElement {
  return {
    dataset: { pcsEngineeringAction: action, ...extraDataset },
    closest() { return this },
  } as unknown as HTMLElement
}

function masterTaskId(masterOrderId: string, taskType: string): string {
  return `${masterOrderId}-${taskType}`
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPcsEngineeringTaskRepositories()
resetPcsEngineeringTaskState()

const style = listStyleArchives()[0]
assert.ok(style, '应存在用于工程主单的款式档案')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单回归测试',
}).masterOrderId)

const plateTaskId = masterTaskId(master.masterOrderId, 'BASE_PATTERN_WOVEN')
const knitPlateTaskId = masterTaskId(master.masterOrderId, 'BASE_PATTERN_KNIT')
const patternTaskId = masterTaskId(master.masterOrderId, 'PATTERN_ARTWORK')
const sampleTaskId = masterTaskId(master.masterOrderId, 'PRE_PRODUCTION_SAMPLE')

// 三个专业页只读取同一工程主单生成的任务 ID 和状态，不能再各自读取旧仓库。
const plateListHtml = renderPcsPlateMakingTaskPage()
const patternListHtml = renderPcsPatternTaskPage()
const sampleListHtml = renderPcsFirstSampleTaskPage()
for (const [html, taskId, title] of [
  [plateListHtml, plateTaskId, '制版任务'],
  [patternListHtml, patternTaskId, '花型任务'],
  [sampleListHtml, sampleTaskId, '产前版样衣任务'],
] as const) {
  assert.match(html, new RegExp(title), `${title}页面应使用当前业务名称`)
  assert.ok(html.includes(taskId), `${title}页面应展示工程主单任务 ID`)
  assert.ok(html.includes(master.masterOrderCode), `${title}页面应展示所属工程主单`)
}
assert.match(patternListHtml, /未启用/, '未带入印花物料时花型任务应保持未启用')
assert.doesNotMatch(sampleListHtml, /首版样衣|首单确认|验收与结论/, '产前版样衣页面不应保留旧样衣事实或验收')

// 制版成果提交即完成，并为产前版样衣解锁其全部固定前置。
const plateResult = submitEngineeringTaskResult(master.masterOrderId, plateTaskId)
assert.equal(plateResult.task.status, '已完成', '制版任务提交成果即完成')
submitEngineeringTaskResult(master.masterOrderId, knitPlateTaskId)
const plateDetailHtml = renderPcsPlateMakingTaskDetailPage(plateTaskId)
assert.match(plateDetailHtml, /已完成/, '制版详情应读取工程主单完成状态')

// 花型任务的提交目标为待审核；当前未带入印花物料时，提交必须被真实门禁阻止。
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, patternTaskId),
  /未启用/,
  '未满足 BOM 印花条件的花型任务不得伪造为已提交',
)
const patternDetailHtml = renderPcsPatternTaskDetailPage(patternTaskId)
assert.match(patternDetailHtml, /未启用/, '花型详情应读取工程主单任务状态')

// 产前版样衣只接受完整成果；制作团队提交后即完成，无任务级验收。
assert.throws(
  () => submitEngineeringFirstSampleResult(sampleTaskId, { resultImageIds: [], resultQuantity: 1, submittedBy: '制作团队A' }),
  /至少上传一张结果图片/,
  '产前版样衣成果必须包含图片',
)
const sampleResult = submitEngineeringFirstSampleResult(sampleTaskId, {
  resultImageIds: ['mock://pre-production-sample/front.png', 'mock://pre-production-sample/back.png'],
  resultQuantity: 1,
  submittedBy: '制作团队A',
})
assert.equal(sampleResult.status, '已完成', '完整产前版样衣成果提交后应完成任务')
assert.deepEqual(sampleResult.resultImageIds, ['mock://pre-production-sample/front.png', 'mock://pre-production-sample/back.png'])
assert.equal(sampleResult.resultSubmittedBy, '制作团队A')
const sampleDetailHtml = renderPcsFirstSampleTaskDetailPage(sampleTaskId)
assert.match(sampleDetailHtml, /2 张/, '产前版样衣详情应读取已提交的图片成果')
assert.match(sampleDetailHtml, /制作团队A/, '产前版样衣详情应读取成果提交人')
assert.doesNotMatch(sampleDetailHtml, /验收|首单确认/, '产前版样衣详情不应出现旧验收或首单确认')

// 首单旧路由只是静默别名，必须与产前版样衣共用同一任务详情和业务文案。
assert.equal(renderPcsFirstOrderSampleTaskPage(), renderPcsFirstSampleTaskPage(), '首单任务列表入口应静默复用产前版样衣页面')
assert.equal(
  renderPcsFirstOrderSampleTaskDetailPage(sampleTaskId),
  renderPcsFirstSampleTaskDetailPage(sampleTaskId),
  '首单任务详情入口应静默复用产前版样衣详情',
)

// 改款和设计打样仍是工程主单外的独立任务，但页面不再提供取消、异常或验收语义。
const revisionListHtml = renderPcsRevisionTaskPage()
const revisionTask = listRevisionTasks()[0]
assert.ok(revisionTask, '应存在改款与设计打样演示任务')
assert.match(revisionListHtml, /改款与设计打样任务/, '独立任务页面应区分改款和设计打样')
assert.ok(revisionListHtml.includes(revisionTask.revisionTaskCode), '独立任务列表应展示真实任务编号')
assert.doesNotMatch(revisionListHtml, /取消|异常|验收/, '独立任务列表不应保留已删除的旧动作')
const revisionDetailHtml = renderPcsRevisionTaskDetailPage(revisionTask.revisionTaskId)
assert.match(revisionDetailHtml, /样衣物料/, '独立任务详情应保留样衣物料维护')
assert.doesNotMatch(revisionDetailHtml, /取消|异常|验收/, '独立任务详情不应保留已删除的旧动作')

// 统一事件入口继续处理标准列表轻交互；成果提交走专业页公开动作而非已删除的旧事件名。
const quickFilterTarget = makeActionTarget('set-first-sample-quick-filter', {
  pcsEngineeringListModule: 'firstSample',
  quickFilter: 'completed',
})
assert.equal(handlePcsEngineeringTaskEvent(quickFilterTarget), true, '统一事件入口应处理产前版样衣列表快捷筛选')
assert.match(renderPcsFirstSampleTaskPage(), /已完成/, '快捷筛选后的列表应仍显示当前工程任务状态')

// 非真实 DOM 目标即使错误地让 closest 命中自身，也不能被花型或调色处理器误捕获；
// 聚合入口仍须把事件交给原本的标准列表处理器。
const invalidClosestTarget = makeInvalidClosestTarget('set-first-sample-quick-filter', {
  pcsEngineeringListModule: 'firstSample',
  quickFilter: 'completed',
})
assert.equal(handlePatternTaskEvent(invalidClosestTarget), false, '无 ParentNode 能力的目标不得被花型处理器捕获')
assert.equal(handleColorTaskEvent(invalidClosestTarget), false, '无 ParentNode 能力的目标不得被调色处理器捕获')
assert.doesNotThrow(
  () => handlePcsEngineeringTaskEvent(invalidClosestTarget),
  '无效 closest 返回值不得导致统一事件入口抛错',
)
assert.equal(handlePcsEngineeringTaskEvent(invalidClosestTarget), true, '无效目标应继续交给原有标准列表事件处理器')

const noClosestTarget = { dataset: {} } as unknown as HTMLElement
assert.equal(handlePatternTaskEvent(noClosestTarget), false, '缺少 closest 能力的目标不得被花型处理器捕获')
assert.equal(handleColorTaskEvent(noClosestTarget), false, '缺少 closest 能力的目标不得被调色处理器捕获')

const storedMaster = getEngineeringMasterOrderById(master.masterOrderId)
assert.equal(storedMaster?.tasks.find((task) => task.taskId === sampleTaskId)?.status, '已完成', '专业页面提交必须写回工程主单唯一事实源')
console.log('pcs-engineering-tasks.spec.ts PASS')
