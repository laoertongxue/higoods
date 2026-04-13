import assert from 'node:assert/strict'

import { findProjectByCode } from '../src/data/pcs-project-repository.ts'
import { buildProjectChannelProductChainSummary } from '../src/data/pcs-channel-product-project-repository.ts'

const pendingProjectId = findProjectByCode('PRJ-20251216-006')?.projectId || ''
const pendingProject = buildProjectChannelProductChainSummary(pendingProjectId)
assert.ok(pendingProject, 'PRJ-20251216-006 必须存在正式渠道商品链路摘要')
assert.equal(pendingProject?.linkedStyleStatus, '技术包待完善', '测款通过但技术包未启用时，款式档案状态必须为技术包待完善')
assert.equal(pendingProject?.currentChannelProductStatus, '已生效', '测款通过并创建款式档案后，渠道商品必须为已生效')
assert.equal(pendingProject?.currentUpstreamSyncStatus, '待更新', '技术包未启用前，上游更新状态必须为待更新')

const activatedProjectId = findProjectByCode('PRJ-20251216-002')?.projectId || ''
const activatedProject = buildProjectChannelProductChainSummary(activatedProjectId)
assert.ok(activatedProject, 'PRJ-20251216-002 必须存在正式渠道商品链路摘要')
assert.equal(activatedProject?.linkedStyleStatus, '可生产', '技术包启用后，款式档案状态必须为可生产')
assert.equal(activatedProject?.currentUpstreamSyncStatus, '已更新', '技术包启用后，上游更新状态必须为已更新')
assert.ok(activatedProject?.currentUpstreamSyncTime, '技术包启用后必须记录上游最终更新时间')
assert.ok(
  activatedProject?.summaryText.includes('上游商品已完成最终更新'),
  '技术包启用后的链路摘要必须明确显示上游商品已完成最终更新',
)

console.log('check-pcs-channel-product-upstream-chain.ts PASS')
