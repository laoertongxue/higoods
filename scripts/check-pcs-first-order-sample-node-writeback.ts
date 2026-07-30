import assert from 'node:assert/strict'

import {
  getFirstOrderSampleTaskById,
  resetFirstOrderSampleTaskRepository,
} from '../src/data/pcs-first-order-sample-repository.ts'
import {
  listFirstSampleTasks,
  resetFirstSampleTaskRepository,
} from '../src/data/pcs-first-sample-repository.ts'
import {
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { updateFirstOrderSampleTaskDetailAndSync } from '../src/data/pcs-first-order-sample-project-writeback.ts'
import { createFirstOrderSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const sourceFirstSample = listFirstSampleTasks().find((task) => task.projectId && task.sampleCode)
assert.ok(sourceFirstSample, '缺少可作为首单来源的正式首版样衣')
const project = listProjects().find((item) => item.projectId === sourceFirstSample.projectId)
assert.ok(project, '首版样衣必须关联真实商品项目')
const projectNodesBefore = listProjectNodes(project.projectId)

const created = createFirstOrderSampleTaskWithProjectRelation({
  firstOrderSampleTaskId: 'FOS-INDEPENDENT-CHECK',
  firstOrderSampleTaskCode: 'FOS-INDEPENDENT-CHECK',
  projectId: project.projectId,
  title: '首单样衣独立入口检查',
  sourceType: '首版样衣打样',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: sourceFirstSample.firstSampleTaskId,
  upstreamObjectCode: sourceFirstSample.firstSampleTaskCode,
  sourceFirstSampleTaskId: sourceFirstSample.firstSampleTaskId,
  sourceFirstSampleTaskCode: sourceFirstSample.firstSampleTaskCode,
  sourceFirstSampleCode: sourceFirstSample.sampleCode,
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  sampleChainMode: '复用首版结论',
  specialSceneReasonCodes: [],
  productionReferenceRequiredFlag: false,
  chinaReviewRequiredFlag: false,
  correctFabricRequiredFlag: false,
  samplePlanLines: [],
  ownerName: project.ownerName,
  operatorName: '检查脚本',
})
assert.equal(created.ok, true, created.message)
assert.ok(created.task)
assert.equal(created.task.projectNodeId, '')
assert.equal(created.relation, null)

const detailSaved = updateFirstOrderSampleTaskDetailAndSync(created.task.firstOrderSampleTaskId, {
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
assert.equal(detailSaved.projectNode, null)

const reloaded = getFirstOrderSampleTaskById(created.task.firstOrderSampleTaskId)
assert.equal(reloaded?.projectNodeId, '')
assert.equal(reloaded?.sourceFirstSampleTaskId, sourceFirstSample.firstSampleTaskId)
assert.equal(reloaded?.conclusionResult, '通过')
assert.ok(reloaded?.samplePlanLines.some((line) => line.linkedSampleCode === 'FOS-CHECK-001'))
assert.deepEqual(
  listProjectNodes(project.projectId),
  projectNodesBefore,
  '首单创建与详情保存不得改写商品项目固定节点',
)

console.log('首单样衣独立入口、详情保存和项目节点隔离检查通过。')
