import assert from 'node:assert/strict'
import { listProjectRelationsByTechnicalVersion } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import {
  getRevisionTaskById,
  updateRevisionTask,
} from '../src/data/pcs-revision-task-repository.ts'
import { generateTechPackVersionFromRevisionTask } from '../src/data/pcs-project-technical-data-writeback.ts'
import { listTechnicalDataVersionsByStyleId } from '../src/data/pcs-technical-data-version-repository.ts'
import {
  handleRevisionTaskEvent,
  renderRevisionTaskPage,
} from '../src/pages/pcs-revision-task.ts'
import { prepareTechPackTaskScenario } from './pcs-tech-pack-test-helper.ts'

const scenario = prepareTechPackTaskScenario()

const htmlBefore = renderRevisionTaskPage()
assert.ok(htmlBefore.includes('技术包版本'), '改版任务页应展示技术包版本区块')
assert.ok(htmlBefore.includes('生成技术包版本'), '改版任务页在允许状态下应展示生成技术包版本动作')

const result = generateTechPackVersionFromRevisionTask(scenario.revisionTaskId, '测试用户')
assert.equal(result.record.createdFromTaskType, 'REVISION', '改版任务生成的草稿应记录首次来源任务类型')
assert.equal(result.record.createdFromTaskId, scenario.revisionTaskId, '改版任务生成的草稿应记录首次来源任务主键')
assert.ok(result.record.createdFromTaskCode, '改版任务生成的草稿应记录首次来源任务编号')
assert.deepEqual(result.record.linkedRevisionTaskIds, [scenario.revisionTaskId], '改版任务应追加到改版来源链')

const revisionTask = getRevisionTaskById(scenario.revisionTaskId)
assert.equal(revisionTask!.linkedTechPackVersionId, result.record.technicalVersionId, '改版任务应回写技术包版本主键')
assert.equal(revisionTask!.linkedTechPackVersionCode, result.record.technicalVersionCode, '改版任务应回写技术包版本编号')
assert.equal(revisionTask!.linkedTechPackVersionStatus, '草稿中', '改版任务页展示状态应为中文')
assert.ok(revisionTask!.linkedTechPackUpdatedAt, '改版任务应回写最近写入时间')

const relations = listProjectRelationsByTechnicalVersion(result.record.technicalVersionId)
assert.equal(relations.length, 1, '改版任务生成技术包版本后应写入正式项目关系')
assert.equal(relations[0].projectId, scenario.projectId, '项目关系应绑定到任务所属项目')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestInstanceId, result.record.technicalVersionId, '项目转档准备节点应回写技术包版本实例')

const htmlAfter = renderRevisionTaskPage()
assert.ok(htmlAfter.includes(result.record.technicalVersionCode), '改版任务页应展示已关联技术包版本编号')
assert.ok(htmlAfter.includes('data-revision-action="view-tech-pack"'), '改版任务页应提供查看技术包版本入口')

updateRevisionTask(scenario.revisionTaskId, { status: '未开始' })
handleRevisionTaskEvent({
  closest: () => ({
    dataset: { revisionAction: 'generate-tech-pack', taskId: scenario.revisionTaskId },
  }),
} as unknown as Element)
const blockedHtml = renderRevisionTaskPage()
assert.ok(blockedHtml.includes('当前任务尚未确认产出，不能生成技术包版本'), '改版任务未确认时应提示不可生成')
assert.equal(
  listTechnicalDataVersionsByStyleId(scenario.styleId).filter((item) => item.versionStatus === 'DRAFT').length,
  1,
  '改版任务被阻断后不应额外生成新的草稿技术包版本',
)

console.log('pcs-revision-task-generate-tech-pack.spec.ts PASS')
