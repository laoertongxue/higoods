import assert from 'node:assert/strict'
import { appStore } from '../src/state/store.ts'
import { resetProjectRepository, listProjects } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { listRevisionTasks, getRevisionTaskById } from '../src/data/pcs-revision-task-repository.ts'
import { listPlateMakingTasks, getPlateMakingTaskById } from '../src/data/pcs-plate-making-repository.ts'
import { listPatternTasks, getPatternTaskById } from '../src/data/pcs-pattern-task-repository.ts'
import { listPatternAssets, resetPatternLibraryStore, waitForPatternLibraryPersistence } from '../src/data/pcs-pattern-library.ts'
import { isTechPackGenerationAllowedStatus } from '../src/data/pcs-tech-pack-task-generation.ts'
import {
  handlePcsEngineeringTaskEvent,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskDetailPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskDetailPage,
  renderPcsPlateMakingTaskPage,
  renderPcsPreProductionSampleTaskDetailPage,
  renderPcsPreProductionSampleTaskPage,
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
assert.match(revisionListHtml, /改版任务/, '应渲染改版任务列表标题')
assert.match(revisionListHtml, /RT-20260402-018/, '应渲染改版任务演示数据')
assert.match(revisionListHtml, /生成技术包版本|写入当前草稿技术包/, '应提供正式技术包动作')
assert.match(revisionListHtml, /是否有下游任务/, '改版任务列表应展示下游任务字段')
assert.doesNotMatch(revisionListHtml, /创建下游/, '改版任务列表不应再显示创建下游入口')

const revisionTask = listRevisionTasks().find((item) => item.projectId && isTechPackGenerationAllowedStatus(item.status))
assert.ok(revisionTask, '应存在可生成技术包的改版任务')
handlePcsEngineeringTaskEvent(makeActionTarget('revision-generate-tech-pack', { taskId: revisionTask.revisionTaskId }))
const revisionAfter = getRevisionTaskById(revisionTask.revisionTaskId)
assert.ok(revisionAfter?.linkedTechPackVersionId, '改版任务应写入正式技术包版本')
handlePcsEngineeringTaskEvent(makeActionTarget('set-revision-tab', { tab: 'issues' }))
const revisionIssueHtml = renderPcsRevisionTaskDetailPage(revisionTask.revisionTaskId)
assert.match(revisionIssueHtml, /改版方案/, '改版任务详情应渲染方案页签')
assert.match(revisionIssueHtml, /下游任务/, '改版任务详情应渲染下游任务页签')
assert.match(revisionIssueHtml, /问题点/, '改版任务详情应展示问题点')
assert.match(revisionIssueHtml, /证据说明/, '改版任务详情应展示证据说明')
assert.doesNotMatch(revisionIssueHtml, /创建下游/, '改版任务详情不应再显示创建下游入口')
handlePcsEngineeringTaskEvent(makeActionTarget('set-revision-tab', { tab: 'outputs' }))
const revisionOutputHtml = renderPcsRevisionTaskDetailPage(revisionTask.revisionTaskId)
assert.match(revisionOutputHtml, /技术包写回|\/technical-data\//, '改版任务详情应显示技术包关联')

const plateListHtml = renderPcsPlateMakingTaskPage()
assert.match(plateListHtml, /制版任务/, '应渲染制版任务列表标题')
assert.match(plateListHtml, /PT-20260404-014/, '应渲染制版任务演示数据')

const plateTask = listPlateMakingTasks().find((item) => isTechPackGenerationAllowedStatus(item.status))
assert.ok(plateTask, '应存在可生成技术包的制版任务')
handlePcsEngineeringTaskEvent(makeActionTarget('plate-generate-tech-pack', { taskId: plateTask.plateTaskId }))
const plateAfter = getPlateMakingTaskById(plateTask.plateTaskId)
assert.ok(plateAfter?.linkedTechPackVersionId, '制版任务应写入正式技术包版本')
const plateDetailHtml = renderPcsPlateMakingTaskDetailPage(plateTask.plateTaskId)
assert.match(plateDetailHtml, /技术包写回/, '制版任务详情应渲染技术包写回页签')
assert.match(plateDetailHtml, /纸样版本/, '制版任务详情应渲染纸样版本页签')

const patternListHtml = renderPcsPatternTaskPage()
assert.match(patternListHtml, /花型任务/, '应渲染花型任务列表标题')
assert.match(patternListHtml, /花型库/, '花型任务列表应出现花型库相关能力')

const assetsBefore = listPatternAssets().length
const patternTask = listPatternTasks().find((item) => !listPatternAssets().some((asset) => asset.source_task_id === item.patternTaskId))
assert.ok(patternTask, '应存在尚未沉淀到花型库的花型任务')
handlePcsEngineeringTaskEvent(makeActionTarget('pattern-publish-library', { taskId: patternTask.patternTaskId }))
await waitForPatternLibraryPersistence()
const patternAfter = getPatternTaskById(patternTask.patternTaskId)
assert.ok(listPatternAssets().length > assetsBefore, '花型任务沉淀后应新增花型库资产')
assert.ok(listPatternAssets().some((asset) => asset.source_task_id === patternTask.patternTaskId), '花型资产应回写来源任务')
assert.equal(patternAfter?.status, '已完成', '花型沉淀后任务应进入已完成')
assert.match(appStore.getState().pathname, /\/pcs\/pattern-library\//, '沉淀完成后应跳转到花型库详情')
const patternDetailHtml = renderPcsPatternTaskDetailPage(patternTask.patternTaskId)
assert.match(patternDetailHtml, /花型方案/, '花型任务详情应渲染花型方案页签')
assert.match(patternDetailHtml, /花型库沉淀/, '花型任务详情应渲染花型库沉淀页签')

const firstSampleListHtml = renderPcsFirstSampleTaskPage()
assert.match(firstSampleListHtml, /首版样衣打样/, '应渲染首版样衣打样列表标题')
assert.match(firstSampleListHtml, /FS-20260404-013|FS-20260403-005/, '应渲染首版样衣任务演示数据')

const firstSampleTask = renderPcsFirstSampleTaskPage().match(/\/pcs\/samples\/first-sample\/([^"]+)/)?.[1]
assert.ok(firstSampleTask, '应存在首版样衣详情入口')
const firstSampleDetailHtml = renderPcsFirstSampleTaskDetailPage(firstSampleTask)
assert.match(firstSampleDetailHtml, /物流与到样/, '首版样衣详情应渲染物流页签')
assert.match(firstSampleDetailHtml, /验收与结论/, '首版样衣详情应渲染验收页签')

const preProductionListHtml = renderPcsPreProductionSampleTaskPage()
assert.match(preProductionListHtml, /产前版样衣打样/, '应渲染产前版样衣打样列表标题')
assert.match(preProductionListHtml, /PP-20260406-013|PP-20260405-005/, '应渲染产前版样衣任务演示数据')

const preProductionTask = renderPcsPreProductionSampleTaskPage().match(/\/pcs\/samples\/pre-production\/([^"]+)/)?.[1]
assert.ok(preProductionTask, '应存在产前版样衣详情入口')
const preProductionDetailHtml = renderPcsPreProductionSampleTaskDetailPage(preProductionTask)
assert.match(preProductionDetailHtml, /产前验收/, '产前版样衣详情应渲染产前验收页签')
assert.match(preProductionDetailHtml, /门禁与下游/, '产前版样衣详情应渲染门禁页签')

console.log('pcs-engineering-tasks.spec.ts PASS')
