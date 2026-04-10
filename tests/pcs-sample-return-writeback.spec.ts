import assert from 'node:assert/strict'
import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  findProjectNodeByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { listSampleLedgerEvents, resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import { resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { recordSampleLedgerEvent } from '../src/data/pcs-sample-project-writeback.ts'

resetProjectRepository()
clearProjectRelationStore()
resetSampleAssetRepository()
resetSampleLedgerRepository()

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

const returnNode = listProjectNodes(returnProject!.projectId).find((item) => item.projectNodeId === returnNodeIdentity.projectNodeId)
assert.ok(returnNode, '退货事件应能回写到样衣退回处理节点')
assert.equal(returnNode!.currentStatus, '已完成', '样衣退回处理完成后应回写节点状态')
assert.equal(returnNode!.latestResultType, '样衣已退回', '样衣退回处理完成后应回写最近结果类型')

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

const disposalNode = listProjectNodes(disposalProject!.projectId).find((item) => item.projectNodeId === disposalNodeIdentity.projectNodeId)
assert.ok(disposalNode, '处置事件应能回写到样衣留存评估节点')
assert.equal(disposalNode!.currentStatus, '已完成', '样衣处置完成后应回写节点状态')
assert.equal(disposalNode!.latestResultType, '样衣处置完成', '样衣处置完成后应回写最近结果类型')

console.log('pcs-sample-return-writeback.spec.ts PASS')
