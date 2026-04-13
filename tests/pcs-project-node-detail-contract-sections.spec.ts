import assert from 'node:assert/strict'

import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { prepareProjectWithPassedTesting } from './pcs-project-formal-chain-helper.ts'

const scenario = prepareProjectWithPassedTesting('节点详情业务视图测试项目')
const listingNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '测试项目应具备商品上架节点')

const html = renderPcsProjectWorkItemDetailPage(scenario.projectId, listingNode.projectNodeId)

assert.ok(!html.includes('节点业务定义'), '业务默认视图不应直接展示节点业务定义')
assert.ok(!html.includes('节点字段清单'), '业务默认视图不应直接展示字段清单')
assert.ok(!html.includes('节点可操作项'), '业务默认视图不应直接展示契约操作定义')
assert.ok(!html.includes('节点状态定义'), '业务默认视图不应直接展示契约状态定义')

console.log('pcs-project-node-detail-contract-sections.spec.ts PASS')
