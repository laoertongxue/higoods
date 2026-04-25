import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import {
  getFirstOrderSampleTaskById,
  listFirstOrderSampleTasksByProjectNode,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  createOrUpdateFirstOrderSampleTaskFromProjectNode,
  listFirstOrderSourceFirstSampleOptions,
  listFirstOrderTechPackVersionOptions,
  updateFirstOrderSampleTaskDetailAndSync,
} from '../src/data/pcs-first-order-sample-project-writeback.ts'

// FIRST_ORDER_SAMPLE 的确认结果不能只依赖 firstOrderConclusionMap；这里直接检查正式仓储和项目节点回写。
resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const projects = new Map(listProjects().map((project) => [project.projectCode, project]))

const entryProject = projects.get('PRJ-20251216-028')
assert.ok(entryProject, '缺少首单样衣节点进入场景项目')
const entryNode = getProjectNodeRecordByWorkItemTypeCode(entryProject.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(entryNode, '缺少 FIRST_ORDER_SAMPLE 节点')
const sourceFirstSample = listFirstOrderSourceFirstSampleOptions(entryProject.projectId)[0]
const sourceTechPack = listFirstOrderTechPackVersionOptions(entryProject)[0]
assert.ok(sourceFirstSample, '缺少可选来源首版样衣')
assert.ok(sourceTechPack?.sourceTechPackVersionId, '缺少 sourceTechPackVersionId 下拉选项')

const created = createOrUpdateFirstOrderSampleTaskFromProjectNode({
  projectId: entryProject.projectId,
  projectNodeId: entryNode.projectNodeId,
  sourceFirstSampleTaskId: sourceFirstSample.firstSampleTaskId,
  sourceTechPackVersionId: sourceTechPack.sourceTechPackVersionId,
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  sampleChainMode: '复用首版结论',
  specialSceneReasonCodes: [],
  productionReferenceRequiredFlag: false,
  chinaReviewRequiredFlag: false,
  correctFabricRequiredFlag: false,
  ownerName: entryProject.ownerName,
  operatorName: '检查脚本',
})
assert.equal(created.ok, true, created.message)
assert.ok(created.task, '必要信息创建后应生成正式首单样衣任务')
assert.equal(created.projectNode?.latestInstanceId, created.task?.firstOrderSampleTaskId)

const detailProject = projects.get('PRJ-20251216-029')
assert.ok(detailProject, '缺少首单样衣详情回写场景项目')
const detailNode = getProjectNodeRecordByWorkItemTypeCode(detailProject.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(detailNode)
const detailTask = listFirstOrderSampleTasksByProjectNode(detailProject.projectId, detailNode.projectNodeId)[0]
assert.ok(detailTask)
const detailSaved = updateFirstOrderSampleTaskDetailAndSync(detailTask.firstOrderSampleTaskId, {
  status: '已通过',
  samplePlanLines: [
    {
      lineId: 'check-line-01',
      sampleRole: '正确布确认样',
      materialMode: '正确布',
      quantity: 1,
      targetFactoryId: 'factory-shenzhen-01',
      targetFactoryName: '深圳工厂01',
      linkedSampleCode: 'FOS-CHECK-001',
      status: '已确认',
      note: '检查脚本补齐样衣计划行。',
    },
  ],
  finalReferenceNote: '检查脚本补齐最终参照说明。',
  sampleCode: 'FOS-CHECK-001',
  conclusionResult: '通过',
  conclusionNote: '检查脚本确认首单样衣通过。',
  confirmedAt: '2026-04-25 12:30',
  confirmedBy: '检查脚本',
}, '检查脚本')
assert.equal(detailSaved.ok, true, detailSaved.message)
assert.equal(detailSaved.projectNode?.currentStatus, '已完成')
const detailReloaded = getFirstOrderSampleTaskById(detailTask.firstOrderSampleTaskId)
assert.equal(detailReloaded?.conclusionResult, '通过')
assert.ok(
  detailReloaded?.samplePlanLines.some((line) => line.linkedSampleCode === 'FOS-CHECK-001'),
  '补齐后的样衣计划行必须写入正式首单样衣任务仓储',
)

const completedProject = projects.get('PRJ-20251216-030')
assert.ok(completedProject, '缺少完成展示场景项目')
const completedNode = getProjectNodeRecordByWorkItemTypeCode(completedProject.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(completedNode)
const completedTask = listFirstOrderSampleTasksByProjectNode(completedProject.projectId, completedNode.projectNodeId)[0]
assert.ok(completedTask)
assert.equal(completedTask.status, '已通过')
assert.equal(completedTask.sourceTechPackVersionId, 'TDV-ID-0008')
assert.equal(completedTask.samplePlanLines[0]?.sampleRole, '复用首版结论')
assert.equal(completedTask.conclusionResult, '通过')

console.log('FIRST_ORDER_SAMPLE 首单样衣节点创建、详情保存、正式仓储和项目回写检查通过。')
