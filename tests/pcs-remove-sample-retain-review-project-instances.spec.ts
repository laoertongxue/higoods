import assert from 'node:assert/strict'

import {
  ensureSampleReturnHandleNode,
  removeSampleRetainReviewFromProjectSnapshot,
  removeSampleRetainReviewFromRelations,
} from '../src/data/pcs-remove-sample-retain-review-migration.ts'
import { listProjectInlineNodeRecords, resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { listProjectRelations, resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import type { ProjectRelationStoreSnapshot } from '../src/data/pcs-project-relation-types.ts'
import { getProjectStoreSnapshot, listProjectNodes, listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import type { PcsProjectStoreSnapshot } from '../src/data/pcs-project-types.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()

const projectSnapshot = getProjectStoreSnapshot()
const projects = listProjects()

assert.ok(projects.length > 0, '应存在演示商品项目')

for (const project of projects) {
  const nodes = listProjectNodes(project.projectId)
  assert.ok(
    !nodes.some((node) => node.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW' || node.workItemTypeName === '样衣留存评估'),
    `${project.projectCode} 不应再存在样衣留存评估节点`,
  )
  assert.ok(
    nodes.some((node) => node.workItemTypeCode === 'SAMPLE_RETURN_HANDLE' && node.phaseCode === 'PHASE_05'),
    `${project.projectCode} 应存在项目收尾阶段的样衣退回处理节点`,
  )
}

assert.ok(
  !listProjectInlineNodeRecords().some((record) => record.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW'),
  '项目内正式记录中不应再存在 SAMPLE_RETAIN_REVIEW',
)
assert.ok(
  !listProjectRelations().some((relation) => relation.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW'),
  '项目关系中不应再存在 SAMPLE_RETAIN_REVIEW',
)

const sampleProject = projects[0]!
const legacySnapshot: PcsProjectStoreSnapshot = {
  version: 999,
  projects: [{ ...projectSnapshot.projects.find((item) => item.projectId === sampleProject.projectId)! }],
  phases: projectSnapshot.phases.filter((item) => item.projectId === sampleProject.projectId).map((item) => ({ ...item })),
  nodes: [
    ...projectSnapshot.nodes
      .filter((item) => item.projectId === sampleProject.projectId && item.workItemTypeCode !== 'SAMPLE_RETURN_HANDLE')
      .map((item) => ({ ...item })),
    {
      ...projectSnapshot.nodes.find((item) => item.projectId === sampleProject.projectId && item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE')!,
      projectNodeId: `${sampleProject.projectId}-legacy-retain-node`,
      workItemId: 'WI-020',
      workItemTypeCode: 'SAMPLE_RETAIN_REVIEW' as never,
      workItemTypeName: '样衣留存评估',
      currentStatus: '进行中',
      sequenceNo: 99,
    },
  ],
}

const migratedSnapshot = removeSampleRetainReviewFromProjectSnapshot(legacySnapshot)
const migratedNodes = migratedSnapshot.nodes.filter((item) => item.projectId === sampleProject.projectId)
assert.ok(!migratedNodes.some((item) => item.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW'), '清理后旧节点应被移除')
assert.equal(
  migratedNodes.filter((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE').length,
  1,
  '清理后应只保留一个样衣退回处理节点',
)
assert.equal(
  ensureSampleReturnHandleNode(sampleProject, migratedNodes).nodes.filter((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE').length,
  1,
  '清理函数重复执行不得重复新增样衣退回处理节点',
)

const returnNode = migratedNodes.find((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE')!
const legacyRelationSnapshot: ProjectRelationStoreSnapshot = {
  version: 1,
  relations: [
    {
      projectRelationId: 'rel-retain-sample',
      projectId: sampleProject.projectId,
      projectCode: sampleProject.projectCode,
      projectNodeId: 'missing-retain-node',
      workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
      workItemTypeName: '样衣留存评估',
      relationRole: '执行记录',
      sourceModule: '样衣台账',
      sourceObjectType: '样衣台账事件',
      sourceObjectId: 'ledger-001',
      sourceObjectCode: 'LE-001',
      sourceLineId: 'asset-001',
      sourceLineCode: 'SY-001',
      sourceTitle: '主推色样衣处置',
      sourceStatus: '已处置',
      businessDate: '2026-04-10 10:00',
      ownerName: '系统演示',
      createdAt: '2026-04-10 10:00',
      createdBy: '系统演示',
      updatedAt: '2026-04-10 10:00',
      updatedBy: '系统演示',
      note: '样衣处置完成',
      legacyRefType: '',
      legacyRefValue: '',
    },
    {
      projectRelationId: 'rel-retain-unknown',
      projectId: sampleProject.projectId,
      projectCode: sampleProject.projectCode,
      projectNodeId: 'missing-retain-node',
      workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
      workItemTypeName: '样衣留存评估',
      relationRole: '执行记录',
      sourceModule: '技术资料',
      sourceObjectType: '技术包版本',
      sourceObjectId: 'tdv-001',
      sourceObjectCode: 'TDV-001',
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: '无关关系',
      sourceStatus: 'DRAFT',
      businessDate: '2026-04-10 11:00',
      ownerName: '系统演示',
      createdAt: '2026-04-10 11:00',
      createdBy: '系统演示',
      updatedAt: '2026-04-10 11:00',
      updatedBy: '系统演示',
      note: '',
      legacyRefType: '',
      legacyRefValue: '',
    },
  ],
  pendingItems: [],
}

const migratedRelations = removeSampleRetainReviewFromRelations(legacyRelationSnapshot, migratedSnapshot)
assert.ok(
  migratedRelations.relations.some(
    (item) => item.sourceObjectId === 'ledger-001' && item.projectNodeId === returnNode.projectNodeId && item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE',
  ),
  '样衣相关旧关系应转移到样衣退回处理节点',
)
assert.ok(
  !migratedRelations.relations.some((item) => item.sourceObjectId === 'tdv-001'),
  '无法识别来源的旧关系应被删除',
)
assert.ok(
  migratedRelations.pendingItems.some((item) => item.sourceObjectCode === 'TDV-001'),
  '无法识别来源的旧关系应记录清理结果',
)
