import assert from 'node:assert/strict'
import { appStore } from '../src/state/store.ts'
import { resetProjectRepository, listProjects } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { listRevisionTasks, getRevisionTaskById } from '../src/data/pcs-revision-task-repository.ts'
import { listPlateMakingTasks, getPlateMakingTaskById } from '../src/data/pcs-plate-making-repository.ts'
import { listPatternTasks, getPatternTaskById } from '../src/data/pcs-pattern-task-repository.ts'
import { listFirstSampleTasks } from '../src/data/pcs-first-sample-repository.ts'
import { listFirstOrderSampleTasks } from '../src/data/pcs-first-order-sample-repository.ts'
import { listPatternAssets, resetPatternLibraryStore, waitForPatternLibraryPersistence } from '../src/data/pcs-pattern-library.ts'
import { isTechPackGenerationAllowedStatus } from '../src/data/pcs-tech-pack-task-generation.ts'
import {
  handlePcsEngineeringTaskEvent,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  renderPcsFirstOrderSampleTaskDetailPage,
  renderPcsFirstOrderSampleTaskPage,
  renderPcsPatternTaskDetailPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskDetailPage,
  renderPcsPlateMakingTaskPage,
  renderPcsRevisionTaskDetailPage,
  renderPcsRevisionTaskPage,
  resetPcsEngineeringTaskRepositories,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'

function makeActionTarget(
  action: string,
  extraDataset: Record<string, string> = {},
): HTMLElement {
  return {
    dataset: {
      pcsEngineeringAction: action,
      ...extraDataset,
    },
    closest() {
      return this
    },
  } as unknown as HTMLElement
}

resetProjectRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
resetProjectRelationRepository()
resetPatternLibraryStore()
resetPcsEngineeringTaskRepositories()
resetPcsEngineeringTaskState()

assert.ok(listProjects().length > 0, '商品项目 bootstrap 不应为空')

const revisionListHtml = renderPcsRevisionTaskPage()
const plateActionLabel = ['生成', '技术包版本'].join('')
const revisionDemoTask = listRevisionTasks()[0]
const revisionTask = listRevisionTasks().find((item) => item.projectId && isTechPackGenerationAllowedStatus(item.status))
assert.ok(revisionDemoTask, '应存在改版任务演示数据')
assert.match(revisionListHtml, /改版任务/, '应渲染改版任务列表标题')
assert.ok(revisionListHtml.includes(revisionDemoTask.revisionTaskCode), '应渲染改版任务演示数据')
if (revisionTask) {
  assert.ok(
    revisionListHtml.includes('生成改版技术包版本') || revisionListHtml.includes(plateActionLabel) || revisionListHtml.includes('写入技术包花型'),
    '应提供正式技术包动作',
  )
}
assert.doesNotMatch(revisionListHtml, /创建下游/, '改版任务列表不应再显示创建下游入口')

if (revisionTask) {
  handlePcsEngineeringTaskEvent(makeActionTarget('revision-generate-tech-pack', { taskId: revisionTask.revisionTaskId }))
  const revisionAfter = getRevisionTaskById(revisionTask.revisionTaskId)
  assert.ok(revisionAfter?.linkedTechPackVersionId, '改版任务应写入正式技术包版本')
}
handlePcsEngineeringTaskEvent(makeActionTarget('set-revision-tab', { tab: 'issues' }))
const revisionIssueHtml = renderPcsRevisionTaskDetailPage((revisionTask || revisionDemoTask).revisionTaskId)
assert.match(revisionIssueHtml, /改版内容/, '改版任务详情应渲染改版内容页签')
assert.match(revisionIssueHtml, /下游任务/, '改版任务详情应渲染下游任务页签')
assert.match(revisionIssueHtml, /问题点/, '改版任务详情应展示问题点')
assert.match(revisionIssueHtml, /证据说明/, '改版任务详情应展示证据说明')
assert.doesNotMatch(revisionIssueHtml, /创建下游/, '改版任务详情不应再显示创建下游入口')
handlePcsEngineeringTaskEvent(makeActionTarget('set-revision-tab', { tab: 'outputs' }))
const revisionOutputHtml = renderPcsRevisionTaskDetailPage((revisionTask || revisionDemoTask).revisionTaskId)
if (revisionTask) {
  assert.match(revisionOutputHtml, /技术包写回|\/technical-data\//, '改版任务详情应显示技术包关联')
} else {
  assert.match(revisionOutputHtml, /技术包产出|尚未建立技术包版本/, '改版任务详情应显示技术包产出状态')
}

const plateListHtml = renderPcsPlateMakingTaskPage()
const plateDemoTask = listPlateMakingTasks()[0]
assert.match(plateListHtml, /制版任务/, '应渲染制版任务列表标题')
if (plateDemoTask) {
  assert.ok(plateListHtml.includes(plateDemoTask.plateTaskCode), '应渲染制版任务演示数据')
} else {
  assert.match(plateListHtml, /暂无制版任务数据|暂无数据/, '没有制版任务时应渲染空态')
}

const plateTask = listPlateMakingTasks().find((item) => isTechPackGenerationAllowedStatus(item.status))
if (plateTask) {
  handlePcsEngineeringTaskEvent(makeActionTarget('plate-generate-tech-pack', { taskId: plateTask.plateTaskId }))
  const plateAfter = getPlateMakingTaskById(plateTask.plateTaskId)
  assert.ok(plateAfter?.linkedTechPackVersionId, '制版任务应写入正式技术包版本')
  const plateDetailHtml = renderPcsPlateMakingTaskDetailPage(plateTask.plateTaskId)
  assert.match(plateDetailHtml, /技术包写回/, '制版任务详情应渲染技术包写回页签')
  assert.match(plateDetailHtml, /纸样版本/, '制版任务详情应渲染纸样版本页签')
}

const patternListHtml = renderPcsPatternTaskPage()
assert.match(patternListHtml, /花型任务/, '应渲染花型任务列表标题')
assert.match(patternListHtml, /花型库/, '花型任务列表应出现花型库相关能力')

const assetsBefore = listPatternAssets().length
const patternTask = listPatternTasks().find((item) => !listPatternAssets().some((asset) => asset.source_task_id === item.patternTaskId))
if (patternTask) {
  handlePcsEngineeringTaskEvent(makeActionTarget('pattern-publish-library', { taskId: patternTask.patternTaskId }))
  await waitForPatternLibraryPersistence()
  const patternAfter = getPatternTaskById(patternTask.patternTaskId)
  assert.ok(listPatternAssets().length > assetsBefore, '花型任务沉淀后应新增花型库资产')
  assert.ok(listPatternAssets().some((asset) => asset.source_task_id === patternTask.patternTaskId), '花型资产应回写来源任务')
  assert.equal(patternAfter?.status, '已完成', '花型沉淀后任务应进入已完成')
  assert.match(appStore.getState().pathname, /\/pcs\/pattern-library\//, '沉淀完成后应跳转到花型库详情')
}
const patternDetailTask = patternTask || listPatternTasks()[0]
if (patternDetailTask) {
  const patternDetailHtml = renderPcsPatternTaskDetailPage(patternDetailTask.patternTaskId)
  assert.match(patternDetailHtml, /花型方案/, '花型任务详情应渲染花型方案页签')
  assert.match(patternDetailHtml, /花型库沉淀/, '花型任务详情应渲染花型库沉淀页签')
}

const firstSampleListHtml = renderPcsFirstSampleTaskPage()
const firstSampleDemoTask = listFirstSampleTasks()[0]
assert.match(firstSampleListHtml, /首版样衣打样/, '应渲染首版样衣打样列表标题')
if (firstSampleDemoTask) {
  assert.ok(firstSampleListHtml.includes(firstSampleDemoTask.firstSampleTaskCode), '应渲染首版样衣任务演示数据')
  const firstSampleTask = renderPcsFirstSampleTaskPage().match(/\/pcs\/samples\/first-sample\/([^"]+)/)?.[1]
  assert.ok(firstSampleTask, '应存在首版样衣详情入口')
  const firstSampleDetailHtml = renderPcsFirstSampleTaskDetailPage(firstSampleTask)
  assert.match(firstSampleDetailHtml, /物流与到样/, '首版样衣详情应渲染物流页签')
  assert.match(firstSampleDetailHtml, /验收与结论/, '首版样衣详情应渲染验收页签')
} else {
  assert.match(firstSampleListHtml, /暂无首版样衣打样数据|暂无数据/, '没有首版样衣任务时应渲染空态')
}

const firstOrderListHtml = renderPcsFirstOrderSampleTaskPage()
const firstOrderDemoTask = listFirstOrderSampleTasks()[0]
assert.match(firstOrderListHtml, /首单样衣打样/, '应渲染首单样衣打样列表标题')
if (firstOrderDemoTask) {
  assert.ok(firstOrderListHtml.includes(firstOrderDemoTask.firstOrderSampleTaskCode), '应渲染首单样衣任务演示数据')
  const firstOrderTask = renderPcsFirstOrderSampleTaskPage().match(/\/pcs\/samples\/first-order\/([^"]+)/)?.[1]
  assert.ok(firstOrderTask, '应存在首单样衣详情入口')
  const firstOrderDetailHtml = renderPcsFirstOrderSampleTaskDetailPage(firstOrderTask)
  assert.match(firstOrderDetailHtml, /首单确认/, '首单样衣详情应渲染首单确认页签')
  assert.match(firstOrderDetailHtml, /版本与输入/, '首单样衣详情应渲染版本与输入页签')
} else {
  assert.match(firstOrderListHtml, /暂无首单样衣打样数据|暂无数据/, '没有首单样衣任务时应渲染空态')
}

console.log('pcs-engineering-tasks.spec.ts PASS')
