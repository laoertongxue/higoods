import assert from 'node:assert/strict'
import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectInlineNodeRecordsByWorkItemType,
  resetProjectInlineNodeRecordRepository,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import { listSampleLedgerEvents, resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import { getSampleAssetByCode, resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { recordSampleLedgerEvent } from '../src/data/pcs-sample-project-writeback.ts'

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()
resetProjectInlineNodeRecordRepository()

const returnProject = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_RETURN_HANDLE'))
const disposalProject = listProjects().find((item) => findProjectNodeByWorkItemTypeCode(item.projectId, 'SAMPLE_RETAIN_REVIEW'))
assert.ok(returnProject && disposalProject, '应存在可用于退回与处置验证的商品项目')

const returnNodeIdentity = findProjectNodeByWorkItemTypeCode(returnProject!.projectId, 'SAMPLE_RETURN_HANDLE')!
const disposalNodeIdentity = findProjectNodeByWorkItemTypeCode(disposalProject!.projectId, 'SAMPLE_RETAIN_REVIEW')!

recordSampleLedgerEvent({
  ledgerEventId: 'sample_return_001',
  ledgerEventCode: 'LE-RT-001',
  eventType: 'RETURN_SUPPLIER',
  sampleCode: 'SY-RT-0001',
  sampleName: '退回样衣测试样',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣退货与处理',
  sourceModule: '样衣退货与处理',
  sourceDocType: '样衣退回单',
  sourceDocId: 'RETURN-DOC-001',
  sourceDocCode: 'RETURN-DOC-001',
  projectId: returnProject!.projectId,
  projectCode: returnProject!.projectCode,
  projectName: returnProject!.projectName,
  businessDate: '2026-02-05 10:00:00',
  operatorName: '测试用户',
})

const returnEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'sample_return_001')
assert.ok(returnEvent, '样衣退回处理应生成退货事件')
assert.equal(returnEvent!.eventType, 'RETURN_SUPPLIER', '样衣退回处理必须写 RETURN_SUPPLIER 台账事件')
assert.equal(returnEvent!.sourceDocType, '样衣退回单', '样衣退回处理必须绑定样衣退回单')

const returnAsset = getSampleAssetByCode('SY-RT-0001')
assert.ok(returnAsset, '样衣退回处理应生成真实样衣资产')
assert.equal(returnAsset!.inventoryStatus, '已退货')
assert.equal(returnAsset!.availabilityStatus, '不可用')

const returnNode = listProjectNodes(returnProject!.projectId).find((item) => item.projectNodeId === returnNodeIdentity.projectNodeId)
assert.ok(returnNode, '退货事件应能回写到样衣退回处理节点')
assert.equal(returnNode!.currentStatus, '已完成', '样衣退回处理完成后应回写节点状态')
assert.equal(returnNode!.latestResultType, '样衣已退回', '样衣退回处理完成后应回写最近结果类型')

const returnInlineRecord = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETURN_HANDLE').find(
  (item) => item.sourceDocId === 'RETURN-DOC-001',
)
assert.ok(returnInlineRecord, '样衣退回处理后应写入 SAMPLE_RETURN_HANDLE inline record')
assert.equal(returnInlineRecord!.projectId, returnProject!.projectId)
assert.equal(returnInlineRecord!.projectNodeId, returnNodeIdentity.projectNodeId)
assert.equal(returnInlineRecord!.workItemTypeCode, 'SAMPLE_RETURN_HANDLE')
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).sampleAssetId ? true : false, true)
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).sampleLedgerEventId, 'sample_return_001')
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).returnDocId, 'RETURN-DOC-001')
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).returnRecipient, '供应商收货人')
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).logisticsProvider, '线下回寄')
assert.equal((returnInlineRecord!.detailSnapshot as Record<string, unknown>).trackingNumber, 'RETURN-DOC-001')
assert.ok(returnInlineRecord!.upstreamRefs.some((ref) => ref.refType === '样衣资产'))
assert.ok(returnInlineRecord!.upstreamRefs.some((ref) => ref.refType === '样衣台账事件'))
assert.ok(returnInlineRecord!.downstreamRefs.some((ref) => ref.refType === '样衣退回单'))

recordSampleLedgerEvent({
  ledgerEventId: 'sample_disposal_001',
  ledgerEventCode: 'LE-DSP-001',
  eventType: 'DISPOSAL',
  sampleCode: 'SY-DSP-0001',
  sampleName: '处置样衣测试样',
  sampleType: '样衣',
  responsibleSite: '深圳',
  sourcePage: '样衣退货与处理',
  sourceModule: '样衣退货与处理',
  sourceDocType: '样衣处置单',
  sourceDocId: 'DISPOSAL-DOC-001',
  sourceDocCode: 'DISPOSAL-DOC-001',
  projectId: disposalProject!.projectId,
  projectCode: disposalProject!.projectCode,
  projectName: disposalProject!.projectName,
  businessDate: '2026-02-05 11:00:00',
  operatorName: '测试用户',
})

const disposalEvent = listSampleLedgerEvents().find((item) => item.ledgerEventId === 'sample_disposal_001')
assert.ok(disposalEvent, '样衣处置处理应生成处置事件')
assert.equal(disposalEvent!.eventType, 'DISPOSAL', '样衣处置处理必须写 DISPOSAL 台账事件')
assert.equal(disposalEvent!.sourceDocType, '样衣处置单', '样衣处置处理必须绑定样衣处置单')

const disposalAsset = getSampleAssetByCode('SY-DSP-0001')
assert.ok(disposalAsset, '样衣处置处理应生成真实样衣资产')
assert.equal(disposalAsset!.inventoryStatus, '已处置')
assert.equal(disposalAsset!.availabilityStatus, '不可用')

const disposalNode = listProjectNodes(disposalProject!.projectId).find((item) => item.projectNodeId === disposalNodeIdentity.projectNodeId)
assert.ok(disposalNode, '处置事件应能回写到样衣留存评估节点')
assert.equal(disposalNode!.currentStatus, '已完成', '样衣处置完成后应回写节点状态')
assert.equal(disposalNode!.latestResultType, '样衣处置完成', '样衣处置完成后应回写最近结果类型')

const retainInlineRecord = listProjectInlineNodeRecordsByWorkItemType('SAMPLE_RETAIN_REVIEW').find(
  (item) => item.sourceDocId === 'DISPOSAL-DOC-001',
)
assert.ok(retainInlineRecord, '样衣处置后应写入 SAMPLE_RETAIN_REVIEW inline record')
assert.equal(retainInlineRecord!.projectId, disposalProject!.projectId)
assert.equal(retainInlineRecord!.projectNodeId, disposalNodeIdentity.projectNodeId)
assert.equal(retainInlineRecord!.workItemTypeCode, 'SAMPLE_RETAIN_REVIEW')
assert.equal((retainInlineRecord!.detailSnapshot as Record<string, unknown>).sampleLedgerEventId, 'sample_disposal_001')
assert.equal((retainInlineRecord!.detailSnapshot as Record<string, unknown>).disposalDocId, 'DISPOSAL-DOC-001')
assert.ok(retainInlineRecord!.upstreamRefs.some((ref) => ref.refType === '样衣资产'))
assert.ok(retainInlineRecord!.upstreamRefs.some((ref) => ref.refType === '样衣台账事件'))
assert.ok(retainInlineRecord!.downstreamRefs.some((ref) => ref.refType === '样衣处置单'))

console.log('pcs-sample-return-writeback.spec.ts PASS')
