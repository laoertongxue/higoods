import assert from 'node:assert/strict'

import { createTestingRelationBootstrapSnapshot } from '../src/data/pcs-testing-relation-bootstrap.ts'
import {
  listProjectInlineNodeRecordsByWorkItemType,
} from '../src/data/pcs-project-inline-node-record-repository.ts'

const summaryRecords = listProjectInlineNodeRecordsByWorkItemType('TEST_DATA_SUMMARY')
const conclusionRecords = listProjectInlineNodeRecordsByWorkItemType('TEST_CONCLUSION')

assert.ok(summaryRecords.length >= 4, `TEST_DATA_SUMMARY 仅有 ${summaryRecords.length} 条，至少需要 4 条`)
assert.ok(conclusionRecords.length >= 4, `TEST_CONCLUSION 仅有 ${conclusionRecords.length} 条，至少需要 4 条`)

const relationSnapshot = createTestingRelationBootstrapSnapshot()
const relationIds = new Set(relationSnapshot.relations.map((item) => item.projectRelationId))

summaryRecords.forEach((record) => {
  assert.ok(record.projectId, `${record.recordCode} 缺少 projectId`)
  assert.ok(record.projectNodeId, `${record.recordCode} 缺少 projectNodeId`)
  assert.ok(record.payload.summaryText, `${record.recordCode} 缺少 summaryText`)
  assert.ok(Number(record.payload.totalExposureQty) > 0, `${record.recordCode} 缺少曝光汇总`)
  assert.ok(Number(record.payload.totalClickQty) > 0, `${record.recordCode} 缺少点击汇总`)
  assert.ok(Number(record.payload.totalOrderQty) > 0, `${record.recordCode} 缺少下单汇总`)
  assert.ok(Number(record.payload.totalGmvAmount) > 0, `${record.recordCode} 缺少成交汇总`)

  const liveRelationIds = Array.isArray(record.detailSnapshot.liveRelationIds) ? record.detailSnapshot.liveRelationIds : []
  const videoRelationIds = Array.isArray(record.detailSnapshot.videoRelationIds) ? record.detailSnapshot.videoRelationIds : []
  assert.ok(liveRelationIds.length > 0, `${record.recordCode} 缺少直播测款关系引用`)
  assert.ok(videoRelationIds.length > 0, `${record.recordCode} 缺少短视频测款关系引用`)
  liveRelationIds.forEach((relationId) => {
    assert.ok(relationIds.has(relationId), `${record.recordCode} 引用了不存在的直播关系 ${relationId}`)
  })
  videoRelationIds.forEach((relationId) => {
    assert.ok(relationIds.has(relationId), `${record.recordCode} 引用了不存在的短视频关系 ${relationId}`)
  })

  assert.ok(record.detailSnapshot.channelProductId, `${record.recordCode} 缺少 channelProductId`)
  assert.ok(record.detailSnapshot.channelProductCode, `${record.recordCode} 缺少 channelProductCode`)
  assert.ok(record.detailSnapshot.upstreamChannelProductCode, `${record.recordCode} 缺少 upstreamChannelProductCode`)
})

const summaryIndex = new Map(summaryRecords.map((record) => [record.recordId, record]))
const conclusionBranches = new Set(conclusionRecords.map((record) => record.payload.conclusion))
;['通过', '调整', '暂缓', '淘汰'].forEach((branch) => {
  assert.ok(conclusionBranches.has(branch), `缺少 ${branch} 分支的 TEST_CONCLUSION demo record`)
})

const distinctProjectIds = new Set(conclusionRecords.map((record) => record.projectId))
assert.ok(distinctProjectIds.size >= 3, `TEST_CONCLUSION 仅覆盖 ${distinctProjectIds.size} 个项目，至少需要 3 个`)

conclusionRecords.forEach((record) => {
  assert.ok(record.projectId, `${record.recordCode} 缺少 projectId`)
  assert.ok(record.projectNodeId, `${record.recordCode} 缺少 projectNodeId`)
  assert.ok(record.detailSnapshot.summaryRecordId, `${record.recordCode} 缺少 summaryRecordId`)
  assert.ok(record.detailSnapshot.summaryRecordCode, `${record.recordCode} 缺少 summaryRecordCode`)
  assert.ok(summaryIndex.has(record.detailSnapshot.summaryRecordId), `${record.recordCode} 关联的 summary 不存在`)
  assert.ok(record.detailSnapshot.channelProductId, `${record.recordCode} 缺少 channelProductId`)
  assert.ok(record.detailSnapshot.channelProductCode, `${record.recordCode} 缺少 channelProductCode`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '测款汇总记录'), `${record.recordCode} 缺少测款汇总上游引用`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '渠道商品'), `${record.recordCode} 缺少渠道商品上游引用`)

  if (record.payload.conclusion === '通过') {
    assert.equal(record.payload.invalidationPlanned, false, `${record.recordCode} 通过分支不应计划作废渠道商品`)
    assert.ok(record.detailSnapshot.linkedStyleId, `${record.recordCode} 通过分支缺少 linkedStyleId`)
    assert.ok(record.detailSnapshot.linkedStyleCode, `${record.recordCode} 通过分支缺少 linkedStyleCode`)
  }

  if (record.payload.conclusion === '调整') {
    assert.equal(record.payload.invalidationPlanned, true, `${record.recordCode} 调整分支必须计划作废渠道商品`)
    assert.ok(record.detailSnapshot.invalidatedChannelProductId, `${record.recordCode} 调整分支缺少 invalidatedChannelProductId`)
    assert.ok(record.detailSnapshot.revisionTaskId, `${record.recordCode} 调整分支缺少 revisionTaskId`)
    assert.ok(record.detailSnapshot.revisionTaskCode, `${record.recordCode} 调整分支缺少 revisionTaskCode`)
  }

  if (record.payload.conclusion === '暂缓') {
    assert.equal(record.payload.invalidationPlanned, true, `${record.recordCode} 暂缓分支必须计划作废渠道商品`)
    assert.ok(record.detailSnapshot.invalidatedChannelProductId, `${record.recordCode} 暂缓分支缺少 invalidatedChannelProductId`)
    assert.equal(record.detailSnapshot.projectTerminated, false, `${record.recordCode} 暂缓分支不应终止项目`)
  }

  if (record.payload.conclusion === '淘汰') {
    assert.equal(record.payload.invalidationPlanned, true, `${record.recordCode} 淘汰分支必须计划作废渠道商品`)
    assert.ok(record.detailSnapshot.invalidatedChannelProductId, `${record.recordCode} 淘汰分支缺少 invalidatedChannelProductId`)
    assert.equal(record.detailSnapshot.projectTerminated, true, `${record.recordCode} 淘汰分支必须终止项目`)
    assert.ok(record.detailSnapshot.projectTerminatedAt, `${record.recordCode} 淘汰分支缺少 projectTerminatedAt`)
  }
})

console.log('pcs-project-inline-bootstrap-testing-branches.spec.ts PASS')
