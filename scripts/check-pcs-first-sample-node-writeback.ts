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
  listFirstSampleTasks,
  listFirstSampleTasksByProjectNode,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import {
  createDownstreamTasksFromRevision,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
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
resetRevisionTaskRepository()
resetProjectRelationRepository()

const firstSampleNodeCandidates = listProjects()
  .map((project) => ({
    project,
    node: getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_SAMPLE'),
  }))
  .filter((item): item is { project: NonNullable<typeof item.project>; node: NonNullable<typeof item.node> } => Boolean(item.node))

if (firstSampleNodeCandidates.length > 0) {
  const { project: entryProject, node: entryNode } = firstSampleNodeCandidates[0]

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

  const completedCandidate = firstSampleNodeCandidates.find(({ project, node }) =>
    listFirstSampleTasksByProjectNode(project.projectId, node.projectNodeId).length > 0,
  )
  if (completedCandidate) {
    const completedTask = listFirstSampleTasksByProjectNode(
      completedCandidate.project.projectId,
      completedCandidate.node.projectNodeId,
    )[0]
    const syncResult = syncFirstSampleTaskToProjectNode({
      firstSampleTaskId: completedTask.firstSampleTaskId,
      operatorName: '检查脚本',
    })
    assert.equal(syncResult.ok, true)
    assert.ok(getFirstSampleTaskById(completedTask.firstSampleTaskId), '完成展示任务应可反查')

    const detailResult = updateFirstSampleTaskDetailAndSync(completedTask.firstSampleTaskId, {
      fitConfirmationSummary: '版型确认通过，肩线与胸围合适。',
      productionReadinessNote: '可作为首单复用候选。',
    }, '检查脚本')
    assert.equal(detailResult.ok, true)
    const relation = listProjectRelationsByProjectNode(completedCandidate.project.projectId, completedCandidate.node.projectNodeId)
      .find((item) => item.sourceObjectId === completedTask.firstSampleTaskId)
    assert.ok(relation?.note.includes('fitConfirmationSummary'), '项目关系快照应包含验收字段')
  }
} else {
  const revisionProject = listProjects().find((item) => item.templateName.includes('万隆改版'))
  assert.ok(revisionProject, '缺少可验证改版产出样衣的万隆改版项目')
  const revision = createRevisionTaskWithProjectRelation({
    projectId: revisionProject.projectId,
    title: '首版样衣 fallback 验收改版任务',
    sourceType: '测款结论返改',
    ownerName: revisionProject.ownerName,
    dueAt: '2026-06-30 18:00',
    revisionScopeCodes: ['PATTERN'],
    revisionScopeNames: ['版型结构'],
    issueSummary: '当前模板无 FIRST_SAMPLE 项目节点，需验证改版任务产出样衣 fallback。',
    evidenceSummary: '万隆改版项目默认要求改版出样衣。',
    sampleQty: 0,
    operatorName: '检查脚本',
  })
  assert.equal(revision.ok, true, '万隆改版项目应能创建改版任务')
  if (!revision.ok) throw new Error(revision.message)

  const downstream = createDownstreamTasksFromRevision(revision.task.revisionTaskId, ['FIRST_SAMPLE'])
  assert.equal(downstream.successCount, 1, '无 FIRST_SAMPLE 项目节点时应通过改版任务产出首版样衣')
  const producedSample = listFirstSampleTasks().find((item) => item.upstreamObjectId === revision.task.revisionTaskId)
  assert.ok(producedSample, '应生成由改版任务产出的首版样衣')
  assert.equal(producedSample.projectId, revisionProject.projectId)
  assert.equal(producedSample.projectNodeId, '', 'fallback 首版样衣不应伪造项目节点')
  assert.equal(producedSample.sourceTaskId, revision.task.revisionTaskId)
}

console.log('FIRST_SAMPLE 首版样衣打样节点进入、正式任务写回和完成展示检查通过。')
