import assert from 'node:assert/strict'

import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  listProjectInlineNodeRecordsByWorkItemType,
  resetProjectInlineNodeRecordRepository,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import { getSampleAssetById, resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { getSampleLedgerEventById, resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import { ensureSampleBootstrapInitialized } from '../src/data/pcs-sample-project-writeback.ts'

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()
resetProjectInlineNodeRecordRepository()

ensureSampleBootstrapInitialized()

const retainRecords = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETAIN_REVIEW')
const returnRecords = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE')

assert.ok(retainRecords.length >= 4, `SAMPLE_RETAIN_REVIEW 仅有 ${retainRecords.length} 条，至少需要 4 条`)
assert.ok(returnRecords.length >= 4, `SAMPLE_RETURN_HANDLE 仅有 ${returnRecords.length} 条，至少需要 4 条`)

const distinctNodeIds = new Set([
  ...retainRecords.map((item) => item.projectNodeId),
  ...returnRecords.map((item) => item.projectNodeId),
])
assert.ok(distinctNodeIds.size >= 4, `样衣收尾 inline record 仅覆盖 ${distinctNodeIds.size} 个项目节点，至少需要 4 个`)

retainRecords.forEach((record) => {
  const detail = record.detailSnapshot as Record<string, unknown>
  assert.ok(record.projectId, `${record.recordCode} 缺少 projectId`)
  assert.ok(record.projectNodeId, `${record.recordCode} 缺少 projectNodeId`)
  assert.ok(detail.sampleAssetId, `${record.recordCode} 缺少 sampleAssetId`)
  assert.ok(detail.sampleLedgerEventId, `${record.recordCode} 缺少 sampleLedgerEventId`)
  assert.ok(detail.disposalDocId, `${record.recordCode} 缺少 disposalDocId`)
  assert.ok(detail.disposalDocCode, `${record.recordCode} 缺少 disposalDocCode`)

  const asset = getSampleAssetById(String(detail.sampleAssetId))
  const event = getSampleLedgerEventById(String(detail.sampleLedgerEventId))
  assert.ok(asset, `${record.recordCode} 引用的样衣资产不存在`)
  assert.ok(event, `${record.recordCode} 引用的样衣台账事件不存在`)
  assert.equal(event!.eventType, 'DISPOSAL', `${record.recordCode} 必须对应 DISPOSAL 台账事件`)
  assert.equal(event!.sourceDocType, '样衣处置单', `${record.recordCode} 必须绑定样衣处置单`)
  assert.equal(event!.sourceDocId, detail.disposalDocId, `${record.recordCode} 样衣处置单编号不一致`)
  assert.equal(event!.sourceDocCode, detail.disposalDocCode, `${record.recordCode} 样衣处置单编码不一致`)
  assert.equal(asset!.inventoryStatus, detail.inventoryStatusAfter, `${record.recordCode} 样衣库存状态与 inline record 不一致`)
  assert.equal(asset!.availabilityStatus, detail.availabilityAfter, `${record.recordCode} 样衣可用状态与 inline record 不一致`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '样衣资产'), `${record.recordCode} 缺少样衣资产引用`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '样衣台账事件'), `${record.recordCode} 缺少样衣台账事件引用`)
  assert.ok(record.downstreamRefs.some((item) => item.refType === '样衣处置单'), `${record.recordCode} 缺少样衣处置单引用`)
})

returnRecords.forEach((record) => {
  const detail = record.detailSnapshot as Record<string, unknown>
  assert.ok(record.projectId, `${record.recordCode} 缺少 projectId`)
  assert.ok(record.projectNodeId, `${record.recordCode} 缺少 projectNodeId`)
  assert.ok(detail.sampleAssetId, `${record.recordCode} 缺少 sampleAssetId`)
  assert.ok(detail.sampleLedgerEventId, `${record.recordCode} 缺少 sampleLedgerEventId`)
  assert.ok(detail.returnDocId, `${record.recordCode} 缺少 returnDocId`)
  assert.ok(detail.returnDocCode, `${record.recordCode} 缺少 returnDocCode`)
  assert.ok(detail.returnRecipient, `${record.recordCode} 缺少 returnRecipient`)
  assert.ok(detail.returnDepartment, `${record.recordCode} 缺少 returnDepartment`)
  assert.ok(detail.returnAddress, `${record.recordCode} 缺少 returnAddress`)
  assert.ok(detail.returnDate, `${record.recordCode} 缺少 returnDate`)
  assert.ok(detail.logisticsProvider, `${record.recordCode} 缺少 logisticsProvider`)
  assert.ok(detail.trackingNumber, `${record.recordCode} 缺少 trackingNumber`)

  const asset = getSampleAssetById(String(detail.sampleAssetId))
  const event = getSampleLedgerEventById(String(detail.sampleLedgerEventId))
  assert.ok(asset, `${record.recordCode} 引用的样衣资产不存在`)
  assert.ok(event, `${record.recordCode} 引用的样衣台账事件不存在`)
  assert.equal(event!.eventType, 'RETURN_SUPPLIER', `${record.recordCode} 必须对应 RETURN_SUPPLIER 台账事件`)
  assert.equal(event!.sourceDocType, '样衣退回单', `${record.recordCode} 必须绑定样衣退回单`)
  assert.equal(event!.sourceDocId, detail.returnDocId, `${record.recordCode} 样衣退回单编号不一致`)
  assert.equal(event!.sourceDocCode, detail.returnDocCode, `${record.recordCode} 样衣退回单编码不一致`)
  assert.equal(asset!.inventoryStatus, '已退货', `${record.recordCode} 样衣库存状态应为已退货`)
  assert.equal(asset!.availabilityStatus, '不可用', `${record.recordCode} 样衣可用状态应为不可用`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '样衣资产'), `${record.recordCode} 缺少样衣资产引用`)
  assert.ok(record.upstreamRefs.some((item) => item.refType === '样衣台账事件'), `${record.recordCode} 缺少样衣台账事件引用`)
  assert.ok(record.downstreamRefs.some((item) => item.refType === '样衣退回单'), `${record.recordCode} 缺少样衣退回单引用`)
})

console.log('pcs-project-inline-bootstrap-sample-closeout.spec.ts PASS')
