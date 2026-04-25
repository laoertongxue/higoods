import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByProjectNode,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasksByProjectNode,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  createOrUpdateFirstSampleTaskFromProjectNode,
  syncFirstSampleTaskToProjectNode,
  updateFirstSampleTaskDetailAndSync,
} from '../src/data/pcs-first-sample-project-writeback.ts'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const engineeringPage = readSource('src/pages/pcs-engineering-tasks.ts')
const projectPage = readSource('src/pages/pcs-projects.ts')
const writebackService = readSource('src/data/pcs-first-sample-project-writeback.ts')

assert.match(writebackService, /createOrUpdateFirstSampleTaskFromProjectNode/)
assert.match(writebackService, /syncFirstSampleTaskToProjectNode/)
assert.match(writebackService, /buildFirstSampleProjectMeta/)
assert.match(projectPage, /sourceTechPackVersionCode/)
assert.match(projectPage, /sampleCode/)
assert.match(projectPage, /fitConfirmationSummary/)
assert.match(engineeringPage, /firstSampleAcceptanceMap/)
assert.match(engineeringPage, /updateFirstSampleTaskDetailAndSync/)

resetProjectRepository()
resetPlateMakingTaskRepository()
resetFirstSampleTaskRepository()
resetProjectRelationRepository()

const entryProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-017')
assert.ok(entryProject, '缺少 FIRST_SAMPLE 未建任务项目')
const entryNode = getProjectNodeRecordByWorkItemTypeCode(entryProject.projectId, 'FIRST_SAMPLE')
assert.ok(entryNode, '缺少 FIRST_SAMPLE 未建任务节点')

const blocked = createOrUpdateFirstSampleTaskFromProjectNode({
  projectId: entryProject.projectId,
  projectNodeId: entryNode.projectNodeId,
  sourceTechPackVersionId: '',
  factoryId: '',
  targetSite: '',
  sampleMaterialMode: '',
  samplePurpose: '',
  operatorName: '检查脚本',
})
assert.equal(blocked.ok, false, '必要信息缺失时不应创建任务')

const created = createOrUpdateFirstSampleTaskFromProjectNode({
  projectId: entryProject.projectId,
  projectNodeId: entryNode.projectNodeId,
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
  ownerName: entryProject.ownerName,
  operatorName: '检查脚本',
})
assert.equal(created.ok, true, '必要信息完整时应创建任务')
assert.ok(created.task, '创建结果应返回正式任务')
assert.equal(created.task?.sampleCode, '', '项目节点入口不应要求或伪造结果编号')

const completedProject = listProjects().find((item) => item.projectCode === 'PRJ-20251216-027')
assert.ok(completedProject, '缺少 FIRST_SAMPLE 完成展示项目')
const completedNode = getProjectNodeRecordByWorkItemTypeCode(completedProject.projectId, 'FIRST_SAMPLE')
assert.ok(completedNode, '缺少 FIRST_SAMPLE 完成展示节点')
const completedTask = listFirstSampleTasksByProjectNode(completedProject.projectId, completedNode.projectNodeId)[0]
assert.ok(completedTask, '缺少 FIRST_SAMPLE 完成展示任务')
const syncResult = syncFirstSampleTaskToProjectNode({
  firstSampleTaskId: completedTask.firstSampleTaskId,
  operatorName: '检查脚本',
})
assert.equal(syncResult.ok, true)
assert.equal(syncResult.projectNode?.currentStatus, '已完成')
assert.equal(getFirstSampleTaskById(completedTask.firstSampleTaskId)?.sourceTechPackVersionCode, 'TDV-20260425-008')

const detailResult = updateFirstSampleTaskDetailAndSync(completedTask.firstSampleTaskId, {
  fitConfirmationSummary: '版型确认通过，肩线与胸围合适。',
  productionReadinessNote: '可作为首单复用候选。',
}, '检查脚本')
assert.equal(detailResult.ok, true)
const relation = listProjectRelationsByProjectNode(completedProject.projectId, completedNode.projectNodeId)
  .find((item) => item.sourceObjectId === completedTask.firstSampleTaskId)
assert.ok(relation?.note.includes('FS-RESULT-25001'), '项目关系快照应包含结果编号')
assert.ok(relation?.note.includes('fitConfirmationSummary'), '项目关系快照应包含验收字段')

console.log('FIRST_SAMPLE 首版样衣打样节点进入、正式任务写回和完成展示检查通过。')
