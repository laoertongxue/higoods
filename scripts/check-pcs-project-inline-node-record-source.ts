import assert from 'node:assert/strict'

import { buildProjectNodeContractDetailViewModel } from '../src/data/pcs-project-node-detail-contract-view-model.ts'
import { buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import { getPcsWorkItemRuntimeCarrierDefinition } from '../src/data/pcs-work-item-runtime-carrier.ts'
import {
  listProjectInlineNodeRecordsByNode,
  listProjectInlineNodeRecordsByWorkItemType,
  type PcsProjectInlineNodeRecord,
  upsertProjectInlineNodeRecord,
} from '../src/data/pcs-project-inline-node-record-repository.ts'

const INLINE_SOURCE_CHECK_PLAN = [
  { workItemTypeCode: 'SAMPLE_ACQUIRE', payloadFieldKey: 'sampleLink', sentinelValue: 'https://inline-source-check.local/sample-acquire' },
  { workItemTypeCode: 'SAMPLE_INBOUND_CHECK', payloadFieldKey: 'checkResult', sentinelValue: 'inline-source-check-inbound' },
  { workItemTypeCode: 'FEASIBILITY_REVIEW', payloadFieldKey: 'reviewRisk', sentinelValue: 'inline-source-check-review-risk' },
  { workItemTypeCode: 'SAMPLE_SHOOT_FIT', payloadFieldKey: 'fitFeedback', sentinelValue: 'inline-source-check-fit-feedback' },
  { workItemTypeCode: 'SAMPLE_CONFIRM', payloadFieldKey: 'confirmNote', sentinelValue: 'inline-source-check-confirm-note' },
  { workItemTypeCode: 'SAMPLE_COST_REVIEW', payloadFieldKey: 'costNote', sentinelValue: 'inline-source-check-cost-note' },
  { workItemTypeCode: 'SAMPLE_PRICING', payloadFieldKey: 'pricingNote', sentinelValue: 'inline-source-check-pricing-note' },
  { workItemTypeCode: 'TEST_DATA_SUMMARY', payloadFieldKey: 'summaryText', sentinelValue: 'inline-source-check-summary-text' },
  { workItemTypeCode: 'TEST_CONCLUSION', payloadFieldKey: 'conclusionNote', sentinelValue: 'inline-source-check-conclusion-note' },
  { workItemTypeCode: 'SAMPLE_RETAIN_REVIEW', payloadFieldKey: 'retainNote', sentinelValue: 'inline-source-check-retain-note' },
  { workItemTypeCode: 'SAMPLE_RETURN_HANDLE', payloadFieldKey: 'returnResult', sentinelValue: 'inline-source-check-return-result' },
] as const

function cloneRecord<T extends PcsProjectInlineNodeRecord>(record: T): T {
  return JSON.parse(JSON.stringify(record)) as T
}

function expectNodeDetailUsesInlineRecords(workItemTypeCode: (typeof INLINE_SOURCE_CHECK_PLAN)[number]['workItemTypeCode']): void {
  const records = listProjectInlineNodeRecordsByWorkItemType(workItemTypeCode)
  assert.ok(records.length > 0, `${workItemTypeCode} 缺少正式 inline record，无法校验来源`)

  const latestRecord = cloneRecord(records[0])
  const detail = buildProjectNodeDetailViewModel(latestRecord.projectId, latestRecord.projectNodeId)
  assert.ok(detail, `${workItemTypeCode} 无法生成节点详情`)
  assert.ok(detail!.records.length > 0, `${workItemTypeCode} 的节点详情 records 不能为空`)
  const carrier = getPcsWorkItemRuntimeCarrierDefinition(workItemTypeCode)

  if (
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_SINGLE' ||
    carrier.projectDisplayRequirementCode === 'PROJECT_INLINE_RECORDS'
  ) {
    assert.ok(detail!.records.some((item) => !item.isPlaceholder), `${workItemTypeCode} 的节点详情 records 不能全部是占位项`)
    const repoRecordsByNode = listProjectInlineNodeRecordsByNode(latestRecord.projectNodeId)
    const repoRecordIds = new Set(repoRecordsByNode.map((item) => item.recordId))
    const detailRecordIds = new Set(detail!.records.filter((item) => !item.isPlaceholder).map((item) => item.itemId))
    assert.deepEqual(detailRecordIds, repoRecordIds, `${workItemTypeCode} 的节点详情 records 必须直接来自正式 inline record repository`)
    return
  }

  assert.ok(
    detail!.records.every((item) => item.isPlaceholder),
    `${workItemTypeCode} 当前按聚合节点承载时，records 应展示聚合占位说明`,
  )
}

function expectPayloadFieldWinsOverFallback(
  workItemTypeCode: (typeof INLINE_SOURCE_CHECK_PLAN)[number]['workItemTypeCode'],
  payloadFieldKey: string,
  sentinelValue: string,
): void {
  const records = listProjectInlineNodeRecordsByWorkItemType(workItemTypeCode)
  assert.ok(records.length > 0, `${workItemTypeCode} 缺少正式 inline record，无法校验字段取值优先级`)

  const originalRecord = cloneRecord(records[0])
  const mutatedRecord = cloneRecord(records[0])
  mutatedRecord.payload = {
    ...(mutatedRecord.payload as Record<string, unknown>),
    [payloadFieldKey]: sentinelValue,
  }
  mutatedRecord.updatedAt = '2099-12-31 23:59:59'
  mutatedRecord.updatedBy = 'check-script'

  try {
    upsertProjectInlineNodeRecord(mutatedRecord)
    const detail = buildProjectNodeDetailViewModel(mutatedRecord.projectId, mutatedRecord.projectNodeId)
    assert.ok(detail, `${workItemTypeCode} 在写入校验值后无法生成节点详情`)

    const contractDetail = buildProjectNodeContractDetailViewModel(detail!)
    const fieldRow = contractDetail.fieldRows.find((item) => item.fieldKey === payloadFieldKey)
    assert.ok(fieldRow, `${workItemTypeCode} 缺少字段 ${payloadFieldKey} 的定义行`)
    assert.equal(
      fieldRow!.currentValueText,
      sentinelValue,
      `${workItemTypeCode} 的字段 ${payloadFieldKey} 当前值没有优先取自 inline record.payload`,
    )
  } finally {
    upsertProjectInlineNodeRecord(originalRecord)
  }
}

function expectTestingRefs(): void {
  const summaryRecord = listProjectInlineNodeRecordsByWorkItemType('TEST_DATA_SUMMARY')[0]
  const conclusionRecord = listProjectInlineNodeRecordsByWorkItemType('TEST_CONCLUSION')[0]
  assert.ok(summaryRecord, '缺少 TEST_DATA_SUMMARY 正式记录')
  assert.ok(conclusionRecord, '缺少 TEST_CONCLUSION 正式记录')

  const summaryDetail = summaryRecord.detailSnapshot as Record<string, unknown>
  assert.ok(Array.isArray(summaryDetail.liveRelationIds) && summaryDetail.liveRelationIds.length > 0, 'TEST_DATA_SUMMARY 必须带 liveRelationIds')
  assert.ok(Array.isArray(summaryDetail.videoRelationIds) && summaryDetail.videoRelationIds.length > 0, 'TEST_DATA_SUMMARY 必须带 videoRelationIds')
  assert.ok(summaryDetail.channelProductId, 'TEST_DATA_SUMMARY 必须带 channelProductId')
  assert.ok(summaryDetail.channelProductCode, 'TEST_DATA_SUMMARY 必须带 channelProductCode')
  assert.ok(summaryDetail.upstreamChannelProductCode, 'TEST_DATA_SUMMARY 必须带 upstreamChannelProductCode')
  assert.ok(summaryRecord.upstreamRefs.some((item) => item.refType === '直播测款记录'), 'TEST_DATA_SUMMARY 必须带直播测款记录引用')
  assert.ok(summaryRecord.upstreamRefs.some((item) => item.refType === '短视频测款记录'), 'TEST_DATA_SUMMARY 必须带短视频测款记录引用')

  const conclusionDetail = conclusionRecord.detailSnapshot as Record<string, unknown>
  assert.ok(conclusionDetail.summaryRecordId, 'TEST_CONCLUSION 必须带 summaryRecordId')
  assert.ok(conclusionDetail.summaryRecordCode, 'TEST_CONCLUSION 必须带 summaryRecordCode')
  assert.ok(conclusionDetail.channelProductId, 'TEST_CONCLUSION 必须带 channelProductId')
  assert.ok(conclusionDetail.channelProductCode, 'TEST_CONCLUSION 必须带 channelProductCode')
  assert.ok(
    conclusionRecord.upstreamRefs.some((item) => item.refType === '测款汇总记录'),
    'TEST_CONCLUSION 必须带测款汇总记录引用',
  )
  assert.ok(
    conclusionRecord.upstreamRefs.some((item) => item.refType === '渠道商品'),
    'TEST_CONCLUSION 必须带渠道商品引用',
  )

  const linkedSummaryRecord = listProjectInlineNodeRecordsByWorkItemType('TEST_DATA_SUMMARY').find(
    (item) => item.recordId === conclusionDetail.summaryRecordId,
  )
  assert.ok(linkedSummaryRecord, 'TEST_CONCLUSION 引用的测款汇总记录不存在')
  assert.ok(linkedSummaryRecord!.upstreamRefs.some((item) => item.refType === '直播测款记录'), 'TEST_CONCLUSION 的汇总上游必须可追到直播测款记录')
  assert.ok(linkedSummaryRecord!.upstreamRefs.some((item) => item.refType === '短视频测款记录'), 'TEST_CONCLUSION 的汇总上游必须可追到短视频测款记录')
}

function expectSampleRefs(): void {
  const retainRecord = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETAIN_REVIEW')[0]
  const returnRecord = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE')[0]
  assert.ok(retainRecord, '缺少 SAMPLE_RETAIN_REVIEW 正式记录')
  assert.ok(returnRecord, '缺少 SAMPLE_RETURN_HANDLE 正式记录')

  const retainDetail = retainRecord.detailSnapshot as Record<string, unknown>
  assert.ok(retainDetail.sampleAssetId, 'SAMPLE_RETAIN_REVIEW 必须带 sampleAssetId')
  assert.ok(retainDetail.sampleLedgerEventId, 'SAMPLE_RETAIN_REVIEW 必须带 sampleLedgerEventId')
  assert.ok(retainDetail.disposalDocId, 'SAMPLE_RETAIN_REVIEW 必须带 disposalDocId')
  assert.ok(retainRecord.upstreamRefs.some((item) => item.refType === '样衣资产'), 'SAMPLE_RETAIN_REVIEW 必须带样衣资产引用')
  assert.ok(retainRecord.upstreamRefs.some((item) => item.refType === '样衣台账事件'), 'SAMPLE_RETAIN_REVIEW 必须带样衣台账事件引用')
  assert.ok(retainRecord.downstreamRefs.some((item) => item.refType === '样衣处置单'), 'SAMPLE_RETAIN_REVIEW 必须带样衣处置单引用')

  const returnDetail = returnRecord.detailSnapshot as Record<string, unknown>
  assert.ok(returnDetail.sampleAssetId, 'SAMPLE_RETURN_HANDLE 必须带 sampleAssetId')
  assert.ok(returnDetail.sampleLedgerEventId, 'SAMPLE_RETURN_HANDLE 必须带 sampleLedgerEventId')
  assert.ok(returnDetail.returnDocId, 'SAMPLE_RETURN_HANDLE 必须带 returnDocId')
  assert.ok(returnDetail.returnRecipient, 'SAMPLE_RETURN_HANDLE 必须带 returnRecipient')
  assert.ok(returnDetail.logisticsProvider, 'SAMPLE_RETURN_HANDLE 必须带 logisticsProvider')
  assert.ok(returnDetail.trackingNumber, 'SAMPLE_RETURN_HANDLE 必须带 trackingNumber')
  assert.ok(returnRecord.upstreamRefs.some((item) => item.refType === '样衣资产'), 'SAMPLE_RETURN_HANDLE 必须带样衣资产引用')
  assert.ok(returnRecord.upstreamRefs.some((item) => item.refType === '样衣台账事件'), 'SAMPLE_RETURN_HANDLE 必须带样衣台账事件引用')
  assert.ok(returnRecord.downstreamRefs.some((item) => item.refType === '样衣退回单'), 'SAMPLE_RETURN_HANDLE 必须带样衣退回单引用')
}

INLINE_SOURCE_CHECK_PLAN.forEach((item) => {
  expectNodeDetailUsesInlineRecords(item.workItemTypeCode)
  expectPayloadFieldWinsOverFallback(item.workItemTypeCode, item.payloadFieldKey, item.sentinelValue)
})

expectTestingRefs()
expectSampleRefs()

console.log('check-pcs-project-inline-node-record-source.ts PASS')
