import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import {
  createOrUpdateFirstSampleTaskFromProjectNode,
  getFirstSampleTaskForProjectNode,
} from '../src/data/pcs-first-sample-project-writeback.ts'

resetProjectRepository()
resetPlateMakingTaskRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-017')
assert.ok(project, '缺少首版样衣未建任务 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_SAMPLE')
assert.ok(node, '缺少 FIRST_SAMPLE 项目节点')
assert.equal(getFirstSampleTaskForProjectNode(project.projectId, node.projectNodeId), null)

const missing = createOrUpdateFirstSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: node.projectNodeId,
  sourceTaskType: '制版任务',
  sourceTaskId: 'PT-20260425-001',
  sourceTaskCode: 'PT-20260425-001',
  sourceTechPackVersionId: '',
  sourceTechPackVersionCode: 'TDV-20260425-001',
  sourceTechPackVersionLabel: '首版样衣输入版',
  factoryId: '',
  factoryName: '',
  targetSite: '',
  sampleMaterialMode: '',
  samplePurpose: '',
  ownerName: project.ownerName,
  note: '',
  operatorName: '测试用户',
})
assert.equal(missing.ok, false)
assert.match(missing.message, /来源技术包版本/)
assert.match(missing.message, /工厂/)

const created = createOrUpdateFirstSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: node.projectNodeId,
  sourceTaskType: '制版任务',
  sourceTaskId: 'PT-20260425-001',
  sourceTaskCode: 'PT-20260425-001',
  sourceTechPackVersionId: 'tdv_first_sample_entry_001',
  sourceTechPackVersionCode: 'TDV-20260425-001',
  sourceTechPackVersionLabel: '首版样衣输入版',
  factoryId: 'factory-shenzhen-02',
  factoryName: '深圳工厂02',
  targetSite: '深圳',
  sampleMaterialMode: '正确布',
  samplePurpose: '首版确认',
  ownerName: project.ownerName,
  note: '项目节点填写必要信息后创建。',
  operatorName: '测试用户',
})
assert.equal(created.ok, true)
assert.ok(created.task)
assert.equal(created.task?.sourceTechPackVersionCode, 'TDV-20260425-001')
assert.equal(created.task?.factoryName, '深圳工厂02')
assert.equal(created.task?.sampleCode, '')
assert.equal(created.projectNode?.latestInstanceId, created.task?.firstSampleTaskId)
assert.equal(created.projectNode?.pendingActionType, '补齐首版样衣详情')
