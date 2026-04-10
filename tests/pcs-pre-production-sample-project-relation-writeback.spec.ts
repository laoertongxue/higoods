import assert from 'node:assert/strict'
import { createPreProductionSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  getPreProductionSampleTaskById,
  resetPreProductionSampleTaskRepository,
} from '../src/data/pcs-pre-production-sample-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProjectNode,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  getProjectNodeRecordById,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { normalizePreProductionSampleTaskSourceType } from '../src/data/pcs-task-source-normalizer.ts'

resetProjectRepository()
resetPreProductionSampleTaskRepository()
clearProjectRelationStore()

assert.equal(
  normalizePreProductionSampleTaskSourceType('首单'),
  '首版样衣打样',
  '产前版样衣旧来源类型中的“首单”必须统一成“首版样衣打样”',
)

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'PRE_PRODUCTION_SAMPLE'))
assert.ok(project, '应存在可用于产前版样衣创建的商品项目')
const node = findProjectNodeByWorkItemTypeCode(project!.projectId, 'PRE_PRODUCTION_SAMPLE')!
updateProjectNodeRecord(project!.projectId, node.projectNodeId, { currentStatus: '已完成' }, '测试脚本')

const relationCountBefore = listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length
const result = createPreProductionSampleTaskWithProjectRelation({
  preProductionSampleTaskId: 'PP-TST-001',
  preProductionSampleTaskCode: 'PP-TST-001',
  projectId: project!.projectId,
  title: `产前版样衣-${project!.projectName}`,
  sourceType: '首版样衣打样',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: 'FS-UP-001',
  upstreamObjectCode: 'FS-UP-001',
  ownerName: '测试跟单',
  factoryName: '雅加达工厂02',
  targetSite: '雅加达',
  operatorName: '测试脚本',
})

assert.ok(result.ok, '满足条件时应能正式创建产前版样衣任务')
assert.ok(getPreProductionSampleTaskById('PP-TST-001'), '正式创建后应写入产前版样衣仓储')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '产前版样衣正式创建后应写入 PRE_PRODUCTION_SAMPLE 项目关系',
)

const updatedNode = getProjectNodeRecordById(project!.projectId, node.projectNodeId)
assert.equal(updatedNode?.currentStatus, '进行中', '节点已完成后再次创建产前版样衣任务时，应重新写为进行中')
assert.equal(updatedNode?.latestInstanceCode, 'PP-TST-001', '应回写产前版样衣最新实例编号')
assert.equal(updatedNode?.latestResultType, '已创建产前版样衣任务', '应回写产前版样衣最新结果')

const duplicate = createPreProductionSampleTaskWithProjectRelation({
  preProductionSampleTaskId: 'PP-TST-001',
  preProductionSampleTaskCode: 'PP-TST-001',
  projectId: project!.projectId,
  title: `产前版样衣-${project!.projectName}`,
  sourceType: '首版样衣打样',
  upstreamModule: '首版样衣打样',
  upstreamObjectType: '首版样衣打样任务',
  upstreamObjectId: 'FS-UP-001',
  upstreamObjectCode: 'FS-UP-001',
  ownerName: '测试跟单',
  factoryName: '雅加达工厂02',
  targetSite: '雅加达',
  operatorName: '测试脚本',
})
assert.ok(duplicate.ok, '重复提交同一产前版样衣任务时仍应返回成功结果')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '同一产前版样衣任务重复提交时，不会重复写项目关系记录',
)

console.log('pcs-pre-production-sample-project-relation-writeback.spec.ts PASS')
