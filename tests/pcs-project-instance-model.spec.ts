import assert from 'node:assert/strict'

import { getProjectInstanceModel } from '../src/data/pcs-project-instance-model.ts'
import {
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'
import { appStore } from '../src/state/store.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()
resetRevisionTaskRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetFirstSampleTaskRepository()
resetPreProductionSampleTaskRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
resetProjectArchiveRepository()

const project = listProjects().find((item) => item.projectCode === 'PRJ-20251216-015')
assert.ok(project, '应存在 PRJ-20251216-015 演示项目')

const model = getProjectInstanceModel(project!.projectId)
assert.ok(model, '应能生成统一项目实例模型')
assert.ok(model!.totalCount > 0, '统一项目实例模型应包含实例')
assert.ok(model!.formalRecordCount > 0, '统一项目实例模型应包含项目主记录或项目内正式记录')
assert.ok(model!.relatedObjectCount > 0, '统一项目实例模型应包含正式业务对象')
assert.ok(model!.instances.some((item) => item.sourceLayer === '项目主记录'), '实例模型应纳入 PROJECT_INIT 的项目主记录')
assert.ok(model!.instances.some((item) => item.sourceLayer === '项目内正式记录'), '实例模型应纳入项目内正式记录')
assert.ok(model!.instances.some((item) => item.sourceLayer === '正式业务对象'), '实例模型应纳入正式业务对象')

const projectInitNode = listProjectNodes(project!.projectId).find((item) => item.workItemTypeCode === 'PROJECT_INIT')
assert.ok(projectInitNode, '应存在项目立项节点')
const projectInitInstanceModel = model!.nodes.find((item) => item.projectNodeId === projectInitNode!.projectNodeId)
assert.ok(projectInitInstanceModel, '项目立项节点应生成实例模型')
assert.equal(projectInitInstanceModel!.projectRecordCount, 1, '项目立项节点应由项目主记录承载 1 条正式实例')
assert.equal(projectInitInstanceModel!.totalCount, 1, '项目立项节点应只有 1 条统一实例')

const channelListingNode = listProjectNodes(project!.projectId).find((item) => item.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING')
assert.ok(channelListingNode, '应存在渠道商品上架节点')
const channelListingInstanceModel = model!.nodes.find((item) => item.projectNodeId === channelListingNode!.projectNodeId)
assert.ok(channelListingInstanceModel, '渠道商品上架节点应生成实例模型')
assert.ok(channelListingInstanceModel!.relatedObjectCount >= 1, '渠道商品上架节点应纳入正式渠道商品对象')
assert.ok(
  channelListingInstanceModel!.instances.some((item) => item.objectType === '渠道商品'),
  '渠道商品上架节点应能识别渠道商品正式对象',
)
assert.ok(
  channelListingInstanceModel!.instances.some((item) => item.targetRoute?.includes('/pcs/products/channel-products/')),
  '渠道商品实例应提供正式详情跳转路径',
)

appStore.navigate(`/pcs/projects/${project!.projectId}/work-items/${projectInitNode!.projectNodeId}?tab=attachments`, {
  historyMode: 'replace',
})
const initHtml = renderPcsProjectWorkItemDetailPage(project!.projectId, projectInitNode!.projectNodeId)
assert.match(initHtml, /项目实例总览/, '项目立项详情页应渲染统一实例总览')
assert.match(initHtml, /项目主记录/, '项目立项详情页应展示项目主记录来源层')

appStore.navigate(`/pcs/projects/${project!.projectId}/work-items/${channelListingNode!.projectNodeId}?tab=attachments`, {
  historyMode: 'replace',
})
const channelListingHtml = renderPcsProjectWorkItemDetailPage(project!.projectId, channelListingNode!.projectNodeId)
assert.match(channelListingHtml, /项目实例总览/, '渠道商品上架详情页应渲染统一实例总览')
assert.match(channelListingHtml, /正式业务对象/, '渠道商品上架详情页应展示正式业务对象来源层')
assert.match(channelListingHtml, /打开/, '统一实例总览应保留跳转动作')

console.log('pcs-project-instance-model.spec.ts PASS')
