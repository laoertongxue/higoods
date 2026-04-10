import assert from 'node:assert/strict'
import { createFirstSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'
import { getFirstSampleTaskById, resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
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
import { renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
clearProjectRelationStore()

const project = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'FIRST_SAMPLE'))
assert.ok(project, '应存在可用于首版样衣打样创建的商品项目')
const node = findProjectNodeByWorkItemTypeCode(project!.projectId, 'FIRST_SAMPLE')!
updateProjectNodeRecord(project!.projectId, node.projectNodeId, { currentStatus: '已完成' }, '测试脚本')

const relationCountBefore = listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length
const result = createFirstSampleTaskWithProjectRelation({
  firstSampleTaskId: 'FS-TST-001',
  firstSampleTaskCode: 'FS-TST-001',
  projectId: project!.projectId,
  title: `首版样衣打样-${project!.projectName}`,
  sourceType: '人工创建',
  ownerName: '测试跟单',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  operatorName: '测试脚本',
})

assert.ok(result.ok, '满足条件时应能正式创建首版样衣打样任务')
assert.ok(getFirstSampleTaskById('FS-TST-001'), '正式创建后应写入首版样衣打样仓储')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '首版样衣打样正式创建后应写入 FIRST_SAMPLE 项目关系',
)

const updatedNode = getProjectNodeRecordById(project!.projectId, node.projectNodeId)
assert.equal(updatedNode?.currentStatus, '进行中', '节点已完成后再次创建首版样衣打样任务时，应重新写为进行中')
assert.equal(updatedNode?.latestInstanceCode, 'FS-TST-001', '应回写首版样衣打样最新实例编号')
assert.equal(updatedNode?.latestResultType, '已创建首版样衣打样任务', '应回写首版样衣打样最新结果')

const duplicate = createFirstSampleTaskWithProjectRelation({
  firstSampleTaskId: 'FS-TST-001',
  firstSampleTaskCode: 'FS-TST-001',
  projectId: project!.projectId,
  title: `首版样衣打样-${project!.projectName}`,
  sourceType: '人工创建',
  ownerName: '测试跟单',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  operatorName: '测试脚本',
})
assert.ok(duplicate.ok, '重复提交同一首版样衣打样任务时仍应返回成功结果')
assert.equal(
  listProjectRelationsByProjectNode(project!.projectId, node.projectNodeId).length,
  relationCountBefore + 1,
  '同一首版样衣打样任务重复提交时，不会重复写项目关系记录',
)

const detailHtml = renderPcsProjectDetailPage(project!.projectId)
assert.ok(detailHtml.includes('FS-TST-001'), '项目详情页应能看到新创建的首版样衣打样正式任务关系')

const nodeHtml = renderPcsProjectWorkItemDetailPage(project!.projectId, node.projectNodeId)
assert.ok(nodeHtml.includes('FS-TST-001'), '项目节点详情页应能看到新创建的首版样衣打样正式任务关系')

console.log('pcs-first-sample-project-relation-writeback.spec.ts PASS')
