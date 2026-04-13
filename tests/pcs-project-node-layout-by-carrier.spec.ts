import assert from 'node:assert/strict'

import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { createProjectForBusinessChain, prepareProjectWithPassedTesting, resetProjectBusinessChainRepositories } from './pcs-project-formal-chain-helper.ts'

function getNodeId(projectId: string, workItemTypeCode: string): string {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  assert.ok(node, `项目 ${projectId} 应存在节点 ${workItemTypeCode}`)
  return node!.projectNodeId
}

resetProjectBusinessChainRepositories()

const inlineProject = createProjectForBusinessChain('节点承载方式布局测试项目')
const standaloneProject = prepareProjectWithPassedTesting('独立实例承载方式布局测试项目')

const singleHtml = renderPcsProjectWorkItemDetailPage(
  inlineProject.projectId,
  getNodeId(inlineProject.projectId, 'PROJECT_INIT'),
)
assert.ok(
  singleHtml.includes('data-pcs-node-detail-section="field-definitions"'),
  'PROJECT_INLINE_SINGLE 节点默认应展示字段清单',
)
assert.ok(
  singleHtml.includes('data-pcs-node-detail-section="statuses"'),
  'PROJECT_INLINE_SINGLE 节点默认应展示状态定义',
)
assert.ok(
  singleHtml.includes('data-pcs-node-detail-section="operations"'),
  'PROJECT_INLINE_SINGLE 节点默认应展示操作定义',
)

const recordsHtml = renderPcsProjectWorkItemDetailPage(
  inlineProject.projectId,
  getNodeId(inlineProject.projectId, 'SAMPLE_ACQUIRE'),
)
assert.ok(recordsHtml.includes('记录列表'), 'PROJECT_INLINE_RECORDS 节点默认应展示记录列表')
assert.ok(
  recordsHtml.includes('data-pcs-node-detail-section="field-definitions"'),
  'PROJECT_INLINE_RECORDS 节点默认应展示字段清单',
)
assert.ok(
  recordsHtml.includes('data-pcs-node-detail-section="operations"'),
  'PROJECT_INLINE_RECORDS 节点默认应展示操作定义',
)

const standaloneHtml = renderPcsProjectWorkItemDetailPage(
  standaloneProject.projectId,
  getNodeId(standaloneProject.projectId, 'CHANNEL_PRODUCT_LISTING'),
)
assert.ok(standaloneHtml.includes('关联实例'), 'STANDALONE_INSTANCE_LIST 节点默认应展示当前关联实例摘要')
assert.ok(standaloneHtml.includes('相关去向 / 查看入口'), 'STANDALONE_INSTANCE_LIST 节点默认应展示跳转入口')
assert.ok(
  !standaloneHtml.includes('data-pcs-node-detail-section="field-definitions"'),
  'STANDALONE_INSTANCE_LIST 节点默认不应铺满字段定义表',
)

const aggregateHtml = renderPcsProjectWorkItemDetailPage(
  standaloneProject.projectId,
  getNodeId(standaloneProject.projectId, 'PROJECT_TRANSFER_PREP'),
)
assert.ok(aggregateHtml.includes('技术包版本关联'), 'PROJECT_AGGREGATE 节点默认应展示聚合对象摘要')
assert.ok(aggregateHtml.includes('项目资料归档'), 'PROJECT_AGGREGATE 节点默认应展示项目资料归档摘要')

console.log('pcs-project-node-layout-by-carrier.spec.ts PASS')
