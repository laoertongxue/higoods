import assert from 'node:assert/strict'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetFirstOrderSampleTaskRepository } from '../src/data/pcs-first-order-sample-repository.ts'
import {
  createOrUpdateFirstOrderSampleTaskFromProjectNode,
  getFirstOrderSampleTaskForProjectNode,
  listFirstOrderSourceFirstSampleOptions,
  listFirstOrderTechPackVersionOptions,
} from '../src/data/pcs-first-order-sample-project-writeback.ts'
import { FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS } from '../src/data/pcs-first-order-sample-field-policy.ts'
import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'
import { renderPcsProjectDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetFirstSampleTaskRepository()
resetFirstOrderSampleTaskRepository()
resetProjectRelationRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-028')
assert.ok(project, '缺少首单样衣未建任务 mock 项目')
const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'FIRST_ORDER_SAMPLE')
assert.ok(node, '缺少 FIRST_ORDER_SAMPLE 项目节点')
assert.equal(getFirstOrderSampleTaskForProjectNode(project.projectId, node.projectNodeId), null)

const sourceOptions = listFirstOrderSourceFirstSampleOptions(project.projectId)
const techPackOptions = listFirstOrderTechPackVersionOptions(project)
assert.ok(sourceOptions.length > 0, '首单样衣节点应有来源首版样衣下拉选项')
assert.ok(techPackOptions.length > 0, '首单样衣节点应有来源技术包版本下拉选项')

const contract = getProjectWorkItemContract('FIRST_ORDER_SAMPLE')
const fieldMap = new Map(contract.fieldDefinitions.map((field) => [field.fieldKey, field]))
assert.equal(fieldMap.get('sourceFirstSampleTaskId')?.type, 'single-select')
assert.equal(fieldMap.get('sourceTechPackVersionId')?.type, 'single-select')
assert.equal(fieldMap.get('sourceFirstSampleTaskCode')?.readonly, true)
assert.equal(fieldMap.get('sourceFirstSampleCode')?.readonly, true)
assert.equal(fieldMap.get('sourceTechPackVersionCode')?.readonly, true)
assert.equal(fieldMap.get('sourceTechPackVersionLabel')?.readonly, true)
assert.deepEqual(FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS.filter((item) => !item.conditional).map((item) => item.fieldKey), [
  'sourceFirstSampleTaskId',
  'sourceTechPackVersionId',
  'factoryId',
  'targetSite',
  'sampleChainMode',
])
assert.equal(FIRST_ORDER_SAMPLE_NODE_ENTRY_REQUIRED_FIELDS.find((item) => item.fieldKey === 'specialSceneReasonCodes')?.conditional, true)

const missing = createOrUpdateFirstOrderSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: node.projectNodeId,
  sourceFirstSampleTaskId: '',
  sourceTechPackVersionId: '',
  factoryId: '',
  targetSite: '',
  sampleChainMode: '',
  operatorName: '测试用户',
})
assert.equal(missing.ok, false)
assert.match(missing.message, /来源首版样衣任务/)
assert.match(missing.message, /来源技术包版本/)
assert.match(missing.message, /工厂/)

const created = createOrUpdateFirstOrderSampleTaskFromProjectNode({
  projectId: project.projectId,
  projectNodeId: node.projectNodeId,
  sourceFirstSampleTaskId: sourceOptions[0]!.firstSampleTaskId,
  sourceTechPackVersionId: techPackOptions[0]!.sourceTechPackVersionId,
  factoryId: 'factory-shenzhen-01',
  factoryName: '深圳工厂01',
  targetSite: '深圳',
  sampleChainMode: '复用首版结论',
  specialSceneReasonCodes: [],
  productionReferenceRequiredFlag: false,
  chinaReviewRequiredFlag: false,
  correctFabricRequiredFlag: false,
  ownerName: project.ownerName,
  note: '项目节点填写必要信息后创建。',
  operatorName: '测试用户',
})
assert.equal(created.ok, true)
assert.ok(created.task)
assert.equal(created.task?.sourceFirstSampleTaskId, sourceOptions[0]!.firstSampleTaskId)
assert.equal(created.task?.sourceFirstSampleTaskCode, sourceOptions[0]!.firstSampleTaskCode)
assert.equal(created.task?.sourceFirstSampleCode, sourceOptions[0]!.sampleCode)
assert.equal(created.task?.sourceTechPackVersionId, techPackOptions[0]!.sourceTechPackVersionId)
assert.equal(created.projectNode?.latestInstanceId, created.task?.firstOrderSampleTaskId)
assert.equal(created.projectNode?.pendingActionType, '补齐首单样衣详情')

const detailHtmlAfterCreate = await renderPcsProjectDetailPage(project.projectId)
assert.match(detailHtmlAfterCreate, /首单样衣打样任务/, '创建任务后商品项目节点应展示任务信息卡片')
assert.match(detailHtmlAfterCreate, new RegExp(created.task!.firstOrderSampleTaskCode), '创建任务后节点应展示任务编号')
assert.match(detailHtmlAfterCreate, /深圳工厂01/, '创建任务后节点应展示必要信息中的工厂')
assert.match(detailHtmlAfterCreate, /去首单样衣打样详情补齐/, '创建任务后节点应保留详情补齐入口')
assert.doesNotMatch(detailHtmlAfterCreate, /当前节点还没有正式首单样衣打样任务/, '创建任务后节点不应继续显示未建任务空状态')
