import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { listProjectRelationsByTechnicalVersion } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import {
  getPlateMakingTaskById,
  updatePlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'
import { generateTechPackVersionFromPlateTask } from '../src/data/pcs-project-technical-data-writeback.ts'
import { listTechnicalDataVersionsByStyleId } from '../src/data/pcs-technical-data-version-repository.ts'
import { prepareTechPackTaskScenario } from './pcs-tech-pack-test-helper.ts'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const scenario = prepareTechPackTaskScenario()

const pageSource = read('src/pages/pcs-plate-making.ts')
assert.ok(pageSource.includes('data-plate-action="generate-tech-pack"'), '制版任务页应保留正式生成按钮')
assert.ok(pageSource.includes('getTechPackGenerationBlockedReason'), '制版任务页应接入任务状态阻断逻辑')

const result = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
assert.equal(result.record.createdFromTaskType, 'PLATE', '制版任务生成的草稿应记录首次来源任务类型')
assert.equal(result.record.createdFromTaskId, scenario.plateTaskId, '制版任务生成的草稿应记录首次来源任务主键')
assert.ok(result.record.createdFromTaskCode, '制版任务生成的草稿应记录首次来源任务编号')
assert.deepEqual(result.record.linkedPatternTaskIds, [scenario.plateTaskId], '制版任务应追加到制版来源链')

const plateTask = getPlateMakingTaskById(scenario.plateTaskId)
assert.equal(plateTask!.linkedTechPackVersionId, result.record.technicalVersionId, '制版任务应回写技术包版本主键')
assert.equal(plateTask!.linkedTechPackVersionCode, result.record.technicalVersionCode, '制版任务应回写技术包版本编号')
assert.equal(plateTask!.linkedTechPackVersionStatus, '草稿中', '制版任务页展示状态应为中文')
assert.ok(plateTask!.linkedTechPackUpdatedAt, '制版任务应回写最近写入时间')

const relations = listProjectRelationsByTechnicalVersion(result.record.technicalVersionId)
assert.equal(relations.length, 1, '制版任务生成技术包版本后应写入正式项目关系')
assert.equal(relations[0].projectId, scenario.projectId, '项目关系应绑定到任务所属项目')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestInstanceId, result.record.technicalVersionId, '项目转档准备节点应回写技术包版本实例')

updatePlateMakingTask(scenario.plateTaskId, { status: '未开始' })
assert.throws(
  () => generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户'),
  /当前任务尚未确认产出，不能生成技术包版本/,
  '制版任务未确认时不应允许硬触发生成技术包版本',
)
assert.equal(
  listTechnicalDataVersionsByStyleId(scenario.styleId).filter((item) => item.versionStatus === 'DRAFT').length,
  1,
  '制版任务被阻断后不应额外生成新的草稿技术包版本',
)

console.log('pcs-plate-task-generate-tech-pack.spec.ts PASS')
