import assert from 'node:assert/strict'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { listProjectRelationsByTechnicalVersion } from '../src/data/pcs-project-relation-repository.ts'
import { getPatternTaskById } from '../src/data/pcs-pattern-task-repository.ts'
import { getPlateMakingTaskById } from '../src/data/pcs-plate-making-repository.ts'
import {
  generateTechPackVersionFromPatternTask,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { getRevisionTaskById } from '../src/data/pcs-revision-task-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByStyleId,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { prepareTechPackTaskScenario } from './pcs-tech-pack-test-helper.ts'

const scenario = prepareTechPackTaskScenario()

const revisionResult = generateTechPackVersionFromRevisionTask(scenario.revisionTaskId, '测试用户')
assert.equal(revisionResult.action, 'CREATED', '首次由任务写入时应创建草稿技术包版本')
assert.equal(revisionResult.record.createdFromTaskType, 'REVISION', '首次创建来源任务类型应记录为改版任务')
assert.equal(revisionResult.record.createdFromTaskId, scenario.revisionTaskId, '首次创建来源任务主键应回写')
assert.ok(revisionResult.record.createdFromTaskCode, '首次创建来源任务编号应回写')
assert.deepEqual(revisionResult.record.linkedRevisionTaskIds, [scenario.revisionTaskId], '改版任务应写入改版来源链')

const plateResult = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
assert.equal(plateResult.action, 'WRITTEN', '已有草稿时制版任务应写入当前草稿')
assert.equal(
  plateResult.record.technicalVersionId,
  revisionResult.record.technicalVersionId,
  '同一款式已有草稿时不应新建第二个草稿版本',
)
assert.deepEqual(plateResult.record.linkedPatternTaskIds, [scenario.plateTaskId], '制版任务应写入制版来源链')

const patternResult = generateTechPackVersionFromPatternTask(scenario.patternTaskId, '测试用户')
assert.equal(patternResult.action, 'WRITTEN', '已有草稿时花型任务应写入当前草稿')
assert.equal(
  patternResult.record.technicalVersionId,
  revisionResult.record.technicalVersionId,
  '花型任务写入时仍应复用同一条草稿技术包版本',
)
assert.deepEqual(patternResult.record.linkedArtworkTaskIds, [scenario.patternTaskId], '花型任务应写入花型来源链')

const repeatedRevision = generateTechPackVersionFromRevisionTask(scenario.revisionTaskId, '测试用户')
assert.equal(repeatedRevision.record.linkedRevisionTaskIds.length, 1, '同一任务重复写入时不应重复追加相同任务 ID')

const drafts = listTechnicalDataVersionsByStyleId(scenario.styleId).filter((item) => item.versionStatus === 'DRAFT')
assert.equal(drafts.length, 1, '同一款式同一时间最多只允许存在一个草稿技术包版本')

const draftRecord = getTechnicalDataVersionById(revisionResult.record.technicalVersionId)
assert.ok(draftRecord, '技术包版本应已正式落仓')
assert.deepEqual(draftRecord!.linkedRevisionTaskIds, [scenario.revisionTaskId], '技术包版本应保留改版任务来源链')
assert.deepEqual(draftRecord!.linkedPatternTaskIds, [scenario.plateTaskId], '技术包版本应保留制版任务来源链')
assert.deepEqual(draftRecord!.linkedArtworkTaskIds, [scenario.patternTaskId], '技术包版本应保留花型任务来源链')

const revisionTask = getRevisionTaskById(scenario.revisionTaskId)
const plateTask = getPlateMakingTaskById(scenario.plateTaskId)
const patternTask = getPatternTaskById(scenario.patternTaskId)
assert.equal(revisionTask!.linkedTechPackVersionId, draftRecord!.technicalVersionId, '改版任务应回写关联技术包版本')
assert.equal(plateTask!.linkedTechPackVersionId, draftRecord!.technicalVersionId, '制版任务应回写关联技术包版本')
assert.equal(patternTask!.linkedTechPackVersionId, draftRecord!.technicalVersionId, '花型任务应回写关联技术包版本')

const relations = listProjectRelationsByTechnicalVersion(draftRecord!.technicalVersionId)
assert.equal(relations.length, 1, '同一项目、同一技术包版本不得重复写项目关系')
assert.equal(relations[0].relationRole, '产出对象', '项目关系角色应固定为产出对象')
assert.equal(relations[0].sourceModule, '技术包', '项目关系来源模块应固定为技术包')
assert.equal(relations[0].sourceObjectType, '技术包版本', '项目关系对象类型应固定为技术包版本')
assert.equal(relations[0].workItemTypeCode, 'PROJECT_TRANSFER_PREP', '项目关系应挂到项目转档准备节点')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestInstanceId, draftRecord!.technicalVersionId, '项目转档准备节点应回写最新技术包版本实例 ID')
assert.equal(transferNode!.latestResultType, '技术包版本已建立', '项目转档准备节点应回写建立结果')
assert.equal(transferNode!.latestResultText, '已由任务产出技术包版本草稿', '项目转档准备节点应回写草稿建立说明')
assert.equal(transferNode!.pendingActionType, '完善技术包内容', '项目转档准备节点应回写下一步动作类型')
assert.equal(transferNode!.pendingActionText, '请继续补齐技术包内容并准备发布', '项目转档准备节点应回写下一步动作说明')

console.log('pcs-tech-pack-generation-entry.spec.ts PASS')
