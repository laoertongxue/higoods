import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByStepCode,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  getFirstSampleTaskById,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { createOrUpdateFirstSampleTaskFromProjectNode } from '../src/data/pcs-first-sample-project-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()

const task = getFirstSampleTaskById('FS-20260425-002')
assert.ok(task, '缺少独立首版样衣任务')
assert.equal(task.projectNodeId, '')
const project = getProjectById(task.projectId)
assert.ok(project, '独立首版样衣任务应保留来源项目关联')
assert.equal(getProjectNodeRecordByStepCode(project.projectId, 'FIRST_SAMPLE'), null)

const nodeEntry = createOrUpdateFirstSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: '',
  sourceTechPackVersionId: 'tdv_first_sample_entry_001',
  factoryId: 'factory-shenzhen-02',
  targetSite: '深圳',
  sampleMaterialMode: '正确布',
  samplePurpose: '首版确认',
  operatorName: '测试用户',
})
assert.equal(nodeEntry.ok, false)
assert.match(nodeEntry.message, /未找到首版样衣打样节点/)
