import assert from 'node:assert/strict'
import { createBootstrapProjectRelationSnapshot } from '../src/data/pcs-project-relation-bootstrap.ts'
import {
  clearProjectRelationStore,
  getProjectRelationStoreSnapshot,
  listProjectRelationPendingItems,
  listProjectRelationsByProject,
  listProjectRelationsByProjectNode,
  resetProjectRelationRepository,
  upsertProjectRelation,
} from '../src/data/pcs-project-relation-repository.ts'
import { getProjectStoreSnapshot, listProjectNodes, resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import type { PcsProjectNodeRecord, PcsProjectRecord } from '../src/data/pcs-project-types.ts'

function buildProject(project: PcsProjectRecord, projectId: string, projectCode: string, projectName: string): PcsProjectRecord {
  return {
    ...project,
    projectId,
    projectCode,
    projectName,
  }
}

function buildNode(
  node: PcsProjectNodeRecord,
  projectId: string,
  projectNodeId: string,
  workItemTypeCode: string,
  workItemTypeName: string,
): PcsProjectNodeRecord {
  return {
    ...node,
    projectNodeId,
    projectId,
    phaseCode: node.phaseCode,
    phaseName: node.phaseName,
    workItemTypeCode,
    workItemTypeName,
    currentStatus: '未开始',
  }
}

resetProjectRepository()
resetProjectRelationRepository()

const projectSnapshot = getProjectStoreSnapshot()
const relationSnapshot = getProjectRelationStoreSnapshot()
assert.ok(relationSnapshot.relations.length > 0, '项目关系仓储初始化后应存在正式关系记录')
assert.ok(relationSnapshot.pendingItems.length > 0, '项目关系仓储初始化后应存在待补齐清单')

const firstProject = projectSnapshot.projects.find((project) => project.projectCode === 'PRJ-20251216-001')
assert.ok(firstProject, '应存在初始化商品项目')

const projectRelations = listProjectRelationsByProject(firstProject!.projectId)
assert.ok(projectRelations.length > 0, '应能按项目查询正式关系记录')

const patternNode = listProjectNodes(firstProject!.projectId).find((node) => node.workItemTypeCode === 'PATTERN_TASK')
assert.ok(patternNode, '应能找到制版任务节点')

const nodeRelations = listProjectRelationsByProjectNode(firstProject!.projectId, patternNode!.projectNodeId)
assert.ok(nodeRelations.some((item) => item.sourceObjectCode === 'PT-20260109-002'), '应能按项目节点查询到制版任务关系')

const beforeCount = nodeRelations.length
upsertProjectRelation({ ...nodeRelations[0], note: '重复写入去重验证' })
const afterCount = listProjectRelationsByProjectNode(firstProject!.projectId, patternNode!.projectNodeId).length
assert.equal(afterCount, beforeCount, '同一来源对象重复写入时应只保留一条正式关系记录')

const pendingItems = listProjectRelationPendingItems()
assert.ok(
  pendingItems.some((item) => item.sourceObjectCode === 'RT-20260109-003'),
  '引用不存在项目的旧关系应进入待补齐清单',
)

const projectSeed = projectSnapshot.projects[0]
const nodeSeed = projectSnapshot.nodes[0]
const customProjects = [
  buildProject(projectSeed, 'custom-project-1', 'PRJ-20260105-001', '改版映射验证项目'),
  buildProject(projectSeed, 'custom-project-2', 'PRJ-20260103-008', '首版映射验证项目'),
  buildProject(projectSeed, 'custom-project-3', 'PRJ-20260108-003', '制版映射验证项目'),
  buildProject(projectSeed, 'custom-project-4', 'PRJ-20251216-001', '花型映射验证项目'),
  buildProject(projectSeed, 'custom-project-5', 'PRJ-20260110-005', '产前版映射验证项目'),
]

const customNodes = [
  buildNode(nodeSeed, 'custom-project-1', 'node-test-conclusion', 'TEST_CONCLUSION', '测款结论判定'),
  buildNode(nodeSeed, 'custom-project-2', 'node-first-sample', 'FIRST_SAMPLE', '首版样衣打样'),
  buildNode(nodeSeed, 'custom-project-3', 'node-pattern-task', 'PATTERN_TASK', '制版任务'),
  buildNode(nodeSeed, 'custom-project-4', 'node-pattern-artwork', 'PATTERN_ARTWORK_TASK', '花型任务'),
  buildNode(nodeSeed, 'custom-project-5', 'node-pre-production', 'PRE_PRODUCTION_SAMPLE', '产前版样衣'),
]

const bootstrapSnapshot = createBootstrapProjectRelationSnapshot({
  version: 1,
  projects: customProjects,
  nodes: customNodes,
})

const findByCode = (sourceObjectCode: string) =>
  bootstrapSnapshot.relations.find((item) => item.sourceObjectCode === sourceObjectCode)

assert.equal(findByCode('RT-20260109-003')?.workItemTypeCode, 'TEST_CONCLUSION', '改版任务关系应默认挂到测款结论判定')
assert.equal(findByCode('PT-20260109-002')?.workItemTypeCode, 'PATTERN_TASK', '制版任务关系应默认挂到制版任务')
assert.equal(findByCode('AT-20260109-001')?.workItemTypeCode, 'PATTERN_ARTWORK_TASK', '花型任务关系应默认挂到花型任务')
assert.equal(findByCode('FS-20260109-005')?.workItemTypeCode, 'FIRST_SAMPLE', '首版样衣打样关系应默认挂到首版样衣打样')
assert.equal(findByCode('PP-20260115-001')?.workItemTypeCode, 'PRE_PRODUCTION_SAMPLE', '产前版样衣关系应默认挂到产前版样衣')

clearProjectRelationStore()
const clearedSnapshot = getProjectRelationStoreSnapshot()
assert.equal(clearedSnapshot.relations.length, 0, '清空关系仓储后应允许保留空快照')

console.log('pcs-project-relation-repository.spec.ts PASS')
