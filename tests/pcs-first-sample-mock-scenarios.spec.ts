import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { listPlateMakingTasksByProject, resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { listFirstSampleTasksByProjectNode, resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { getFirstSampleTaskForProjectNode } from '../src/data/pcs-first-sample-project-writeback.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const scenario1 = listProjects().find((item) => item.projectCode === 'PRJ-20251216-017')
assert.ok(scenario1, '缺少场景1项目')
const scenario1Node = getProjectNodeRecordByWorkItemTypeCode(scenario1.projectId, 'FIRST_SAMPLE')
assert.ok(scenario1Node, '场景1缺少 FIRST_SAMPLE 节点')
assert.equal(getFirstSampleTaskForProjectNode(scenario1.projectId, scenario1Node.projectNodeId), null)
const scenario1Plate = listPlateMakingTasksByProject(scenario1.projectId).find((item) => item.plateTaskCode === 'PT-20260425-001')
assert.ok(scenario1Plate, '场景1缺少来源制版任务')
assert.equal(scenario1Plate?.linkedTechPackVersionCode, 'TDV-20260425-001')

const scenario2 = listProjects().find((item) => item.projectCode === 'PRJ-20251216-026')
assert.ok(scenario2, '缺少场景2项目')
const scenario2Node = getProjectNodeRecordByWorkItemTypeCode(scenario2.projectId, 'FIRST_SAMPLE')
assert.ok(scenario2Node, '场景2缺少 FIRST_SAMPLE 节点')
const scenario2Task = listFirstSampleTasksByProjectNode(scenario2.projectId, scenario2Node.projectNodeId)[0]
assert.ok(scenario2Task, '场景2缺少首版样衣任务')
assert.equal(scenario2Task.sourceTaskType, '制版任务')
assert.equal(scenario2Task.sourceTechPackVersionCode, 'TDV-20260425-002')
assert.equal(scenario2Task.factoryName, '深圳工厂01')
assert.equal(scenario2Task.sampleCode, '')
assert.deepEqual(scenario2Task.sampleImageIds, [])
assert.equal(scenario2Task.fitConfirmationSummary, '')

const scenario3 = listProjects().find((item) => item.projectCode === 'PRJ-20251216-027')
assert.ok(scenario3, '缺少场景3项目')
const scenario3Node = getProjectNodeRecordByWorkItemTypeCode(scenario3.projectId, 'FIRST_SAMPLE')
assert.ok(scenario3Node, '场景3缺少 FIRST_SAMPLE 节点')
const scenario3Task = listFirstSampleTasksByProjectNode(scenario3.projectId, scenario3Node.projectNodeId)[0]
assert.ok(scenario3Task, '场景3缺少首版样衣任务')
assert.equal(scenario3Task.sourceTaskType, '制版任务')
assert.equal(scenario3Task.sourceTaskCode, 'PT-20260425-008')
assert.equal(scenario3Task.sourceTechPackVersionCode, 'TDV-20260425-008')
assert.equal(scenario3Task.factoryName, '深圳工厂02')
assert.equal(scenario3Task.sampleCode, 'FS-RESULT-25001')
assert.deepEqual(scenario3Task.sampleImageIds, ['mock://sample-result/fs-25001-1', 'mock://sample-result/fs-25001-2'])
assert.equal(scenario3Task.reuseAsFirstOrderBasisFlag, true)
assert.equal(scenario3Task.confirmedAt, '2026-04-25 10:30')
