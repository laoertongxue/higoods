import assert from 'node:assert/strict'

import { listProjects, getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { renderPcsProjectDetailPage } from '../src/pages/pcs-project-detail.ts'
import {
  createProjectForBusinessChain,
  prepareProjectWithPassedTesting,
  resetProjectBusinessChainRepositories,
} from '../tests/pcs-project-formal-chain-helper.ts'

function getNodeId(projectId: string, workItemTypeCode: string): string {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  assert.ok(node, `项目 ${projectId} 应存在节点 ${workItemTypeCode}`)
  return node!.projectNodeId
}

resetProjectBusinessChainRepositories()

const inlineProject = createProjectForBusinessChain('节点可见性检查项目')
const aggregateProject = prepareProjectWithPassedTesting('聚合节点可见性检查项目')

const singleHtml = renderPcsProjectWorkItemDetailPage(
  inlineProject.projectId,
  getNodeId(inlineProject.projectId, 'PROJECT_INIT'),
)
assert.ok(singleHtml.includes('data-pcs-node-detail-section="field-definitions"'), 'PROJECT_INLINE_SINGLE 默认业务视图必须展示字段清单')
assert.ok(singleHtml.includes('data-pcs-node-detail-section="statuses"'), 'PROJECT_INLINE_SINGLE 默认业务视图必须展示状态定义')
assert.ok(singleHtml.includes('data-pcs-node-detail-section="operations"'), 'PROJECT_INLINE_SINGLE 默认业务视图必须展示操作定义')

const recordsHtml = renderPcsProjectWorkItemDetailPage(
  inlineProject.projectId,
  getNodeId(inlineProject.projectId, 'SAMPLE_ACQUIRE'),
)
assert.ok(recordsHtml.includes('data-pcs-node-detail-section="field-definitions"'), 'PROJECT_INLINE_RECORDS 默认业务视图必须展示字段清单')
assert.ok(recordsHtml.includes('data-pcs-node-detail-section="statuses"'), 'PROJECT_INLINE_RECORDS 默认业务视图必须展示状态定义')
assert.ok(recordsHtml.includes('data-pcs-node-detail-section="operations"'), 'PROJECT_INLINE_RECORDS 默认业务视图必须展示操作定义')
assert.ok(recordsHtml.includes('记录列表'), 'PROJECT_INLINE_RECORDS 默认业务视图必须展示记录列表')

const standaloneHtml = renderPcsProjectWorkItemDetailPage(
  aggregateProject.projectId,
  getNodeId(aggregateProject.projectId, 'CHANNEL_PRODUCT_LISTING'),
)
assert.ok(
  !standaloneHtml.includes('data-pcs-node-detail-section="field-definitions"'),
  'STANDALONE_INSTANCE_LIST 默认业务视图不应铺满字段定义表',
)
assert.ok(
  standaloneHtml.includes('关联实例') || standaloneHtml.includes('相关去向 / 查看入口'),
  'STANDALONE_INSTANCE_LIST 默认业务视图必须展示关联实例或查看入口',
)

const aggregateHtml = renderPcsProjectWorkItemDetailPage(
  aggregateProject.projectId,
  getNodeId(aggregateProject.projectId, 'PROJECT_TRANSFER_PREP'),
)
assert.ok(
  aggregateHtml.includes('技术包版本关联') || aggregateHtml.includes('项目资料归档'),
  'PROJECT_AGGREGATE 默认业务视图必须展示聚合对象区块',
)

const projectWithTechPack = listProjects().find((item) => Boolean(item.linkedTechPackVersionId))
assert.ok(projectWithTechPack, '应存在至少一个已关联技术包版本的项目')
const projectHtml = renderPcsProjectDetailPage(projectWithTechPack!.projectId)
assert.ok(projectHtml.includes('查看技术包版本'), '只要项目已有 linkedTechPackVersionId，项目详情页源码必须包含“查看技术包版本”')

console.log('check-pcs-project-node-record-visibility.ts PASS')
