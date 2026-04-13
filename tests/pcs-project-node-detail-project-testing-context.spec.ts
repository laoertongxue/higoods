import assert from 'node:assert/strict'

import { buildProjectChannelProductChainSummary } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { resolveProjectNodeBusinessActions } from '../src/pages/pcs-project-work-item-detail-actions.ts'
import { resetProjectBusinessChainRepositories } from './pcs-project-formal-chain-helper.ts'

function getActionKeys(html: string): string[] {
  return [...html.matchAll(/data-pcs-node-action-key="([^"]+)"/g)].map((item) => item[1])
}

resetProjectBusinessChainRepositories()

const summaryNode005 = getProjectNodeRecordByWorkItemTypeCode('prj_20251216_005', 'TEST_DATA_SUMMARY')
assert.ok(summaryNode005, '应存在 005 的测款汇总节点')

const summaryDetail005 = buildProjectNodeDetailViewModel('prj_20251216_005', summaryNode005.projectNodeId)
assert.ok(summaryDetail005, '应能读取 005 的测款汇总节点详情')
assert.equal(
  summaryDetail005!.relationSection.items.filter((item) => item.sourceObjectType === '直播商品明细').length,
  0,
  '测款汇总节点不应依赖节点自身的直播测款关系条数',
)
assert.equal(
  summaryDetail005!.relationSection.items.filter((item) => item.sourceObjectType === '短视频记录').length,
  0,
  '测款汇总节点不应依赖节点自身的短视频测款关系条数',
)
assert.ok(summaryDetail005!.projectTestingContext.formalLiveRelationCount > 0, '005 的项目级直播测款记录数应大于 0')
assert.ok(summaryDetail005!.projectTestingContext.formalVideoRelationCount > 0, '005 的项目级短视频测款记录数应大于 0')

const summaryActions005 = resolveProjectNodeBusinessActions(
  summaryDetail005!,
  buildProjectChannelProductChainSummary('prj_20251216_005'),
)
assert.ok(
  summaryActions005.currentActions.some((item) => item.key === 'generate-testing-summary' || item.key === 'view-testing-relations'),
  '005 的测款汇总节点应基于项目级测款记录显示生成汇总或查看测款关系动作',
)

const summaryHtml005 = renderPcsProjectWorkItemDetailPage('prj_20251216_005', summaryNode005.projectNodeId)
assert.ok(summaryHtml005.includes('直播测款记录'), '测款汇总节点页应展示项目级直播测款记录')
assert.ok(summaryHtml005.includes('短视频测款记录'), '测款汇总节点页应展示项目级短视频测款记录')
assert.ok(!summaryHtml005.includes('正式直播测款关系'), '测款汇总节点页不应继续显示技术化的正式直播测款关系文案')
assert.ok(!summaryHtml005.includes('正式短视频测款关系'), '测款汇总节点页不应继续显示技术化的正式短视频测款关系文案')

const conclusionNode024 = getProjectNodeRecordByWorkItemTypeCode('prj_20251216_024', 'TEST_CONCLUSION')
assert.ok(conclusionNode024, '应存在 024 的测款结论节点')

const conclusionDetail024 = buildProjectNodeDetailViewModel('prj_20251216_024', conclusionNode024.projectNodeId)
assert.ok(conclusionDetail024, '应能读取 024 的测款结论节点详情')
assert.equal(
  conclusionDetail024!.relationSection.items.filter((item) => item.sourceObjectType === '直播商品明细').length,
  0,
  '测款结论节点不应要求节点自身挂直播测款关系',
)
assert.equal(
  conclusionDetail024!.relationSection.items.filter((item) => item.sourceObjectType === '短视频记录').length,
  0,
  '测款结论节点不应要求节点自身挂短视频测款关系',
)
assert.ok(conclusionDetail024!.projectTestingContext.formalLiveRelationCount > 0, '024 的项目级直播测款记录数应大于 0')
assert.ok(conclusionDetail024!.projectTestingContext.formalVideoRelationCount > 0, '024 的项目级短视频测款记录数应大于 0')

const conclusionActions024 = resolveProjectNodeBusinessActions(
  conclusionDetail024!,
  buildProjectChannelProductChainSummary('prj_20251216_024'),
)
assert.ok(
  conclusionActions024.currentActions.some((item) => item.key === 'view-live-testing-detail'),
  '结论节点应能从项目级测款上下文查看直播测款记录',
)
assert.ok(
  conclusionActions024.currentActions.some((item) => item.key === 'view-video-testing-detail'),
  '结论节点应能从项目级测款上下文查看短视频记录',
)

const conclusionNode025 = getProjectNodeRecordByWorkItemTypeCode('prj_20251216_025', 'TEST_CONCLUSION')
assert.ok(conclusionNode025, '应存在 025 的测款结论节点')

const conclusionDetail025 = buildProjectNodeDetailViewModel('prj_20251216_025', conclusionNode025.projectNodeId)
assert.ok(conclusionDetail025, '应能读取 025 的测款结论节点详情')
const conclusionActions025 = resolveProjectNodeBusinessActions(
  conclusionDetail025!,
  buildProjectChannelProductChainSummary('prj_20251216_025'),
)
assert.ok(
  conclusionActions025.currentActions.some((item) => item.key === 'view-channel-product'),
  '终止项目 025 的测款结论节点应保留查看渠道商品入口',
)
assert.ok(
  conclusionActions025.currentActions.some((item) => item.key === 'view-testing-summary'),
  '终止项目 025 的测款结论节点应保留查看测款汇总入口',
)
assert.ok(
  conclusionActions025.currentActions.some((item) => item.key === 'view-live-testing-detail'),
  '终止项目 025 的测款结论节点应能从项目级测款上下文查看直播测款记录',
)
assert.ok(
  !conclusionActions025.currentActions.some((item) => item.key === 'generate-style-archive'),
  '终止项目 025 的测款结论节点不应重新出现生成款式档案动作',
)

const conclusionHtml025 = renderPcsProjectWorkItemDetailPage('prj_20251216_025', conclusionNode025.projectNodeId)
const conclusionActionKeys025 = getActionKeys(conclusionHtml025)
assert.ok(conclusionActionKeys025.includes('view-live-testing-detail'), '025 的结论节点页面应渲染查看直播测款记录入口')

console.log('pcs-project-node-detail-project-testing-context.spec.ts PASS')
