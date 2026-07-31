import assert from 'node:assert/strict'

import { createBootstrapProjectRelationSnapshot } from '../src/data/pcs-project-relation-bootstrap.ts'
import { getProjectStoreSnapshot, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()

const projectSnapshot = getProjectStoreSnapshot()
const relationSnapshot = createBootstrapProjectRelationSnapshot({
  version: 1,
  projects: projectSnapshot.projects,
  nodes: projectSnapshot.nodes,
})

const archiveRelations = relationSnapshot.relations.filter((relation) => relation.sourceModule === '项目资料归档')
assert.ok(archiveRelations.length > 0, '应保留项目资料归档初始化关系')
archiveRelations.forEach((relation) => {
  assert.ok(relation.projectId, '项目资料归档关系必须归属真实商品项目')
  assert.equal(relation.projectNodeId, null, '项目资料归档关系不得绑定商品项目立项步骤')
  assert.equal(relation.stepCode, '', '项目资料归档关系不得用 PROJECT_INIT 作为无来源步骤兜底')
  assert.equal(relation.stepName, '', '项目资料归档关系不得持久化步骤名称')
})

const archivePendingItems = relationSnapshot.pendingItems.filter((item) => item.sourceModule === '项目资料归档')
assert.equal(archivePendingItems.length, 0, '项目级归档关系不需要项目步骤，也不应产生缺步骤待处理项')

console.log('pcs-project-relation-bootstrap-project-level.spec.ts PASS')
