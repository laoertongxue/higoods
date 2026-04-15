import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  findLatestProjectInstance,
  getProjectInstanceFieldValue,
  getProjectInstanceModel,
} from '../src/data/pcs-project-instance-model.ts'
import {
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()

const pageSource = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')

assert.ok(
  !pageSource.includes('collectRelationNoteMeta(node.relations)'),
  '项目页不应再通过 ProjectRelationRecord.note 聚合节点实例字段',
)
assert.ok(
  !pageSource.includes('parseRelationNoteMeta(currentChannelProduct?.note)'),
  '项目页不应再通过渠道商品 relation.note 读取实例本体信息',
)
assert.ok(
  !pageSource.includes('listProjectRelationsByProjectNode(projectId, node.projectNodeId)'),
  '项目页节点视图不应再直接挂载 relation 列表作为实例数据源',
)

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const model = getProjectInstanceModel(project!.projectId)
assert.ok(model, '应能生成统一实例模型')

const channelProductInstance = findLatestProjectInstance(
  project!.projectId,
  (instance) => instance.sourceLayer === '正式业务对象' && instance.objectType === '渠道商品',
)
assert.ok(channelProductInstance, '应能在统一实例模型中获取正式渠道商品实例')
assert.ok(channelProductInstance!.sourceObjectId, '正式实例应带源对象 ID，而不是只靠 relation 标题')
assert.ok(channelProductInstance!.sourceObjectCode, '正式实例应带源对象编码，而不是只靠 relation 标题')
assert.ok(
  getProjectInstanceFieldValue(channelProductInstance, 'channelCode'),
  '正式渠道商品实例应携带结构化字段 channelCode',
)
assert.ok(
  getProjectInstanceFieldValue(channelProductInstance, 'storeId'),
  '正式渠道商品实例应携带结构化字段 storeId',
)
assert.ok(
  getProjectInstanceFieldValue(channelProductInstance, 'channelProductStatus'),
  '正式渠道商品实例应携带结构化字段 channelProductStatus',
)

const styleInstance = findLatestProjectInstance(
  project!.projectId,
  (instance) => instance.sourceLayer === '正式业务对象' && instance.objectType === '款式档案',
)
if (styleInstance) {
  assert.ok(styleInstance.sourceObjectId, '款式档案实例应带源对象 ID')
  assert.ok(
    getProjectInstanceFieldValue(styleInstance, 'archiveStatus'),
    '款式档案实例应携带结构化档案状态字段',
  )
}

console.log('pcs-project-relation-index-boundary.spec.ts PASS')
