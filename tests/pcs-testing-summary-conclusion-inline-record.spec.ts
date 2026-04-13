import assert from 'node:assert/strict'

import { resetProjectRepository, findProjectByCode, findProjectNodeByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import {
  generateProjectTestingSummaryFromRelations,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
} from '../src/data/pcs-channel-product-project-repository.ts'
import { resetProjectInlineNodeRecordRepository, getLatestProjectInlineNodeRecord } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()
resetRevisionTaskRepository()
resetProjectInlineNodeRecordRepository()

const project = findProjectByCode('PRJ-20251216-005')
assert.ok(project, '应存在可用于测款汇总与结论写回验证的项目 PRJ-20251216-005')

const summaryNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'TEST_DATA_SUMMARY')
const conclusionNode = findProjectNodeByWorkItemTypeCode(project!.projectId, 'TEST_CONCLUSION')
assert.ok(summaryNode, '项目应存在 TEST_DATA_SUMMARY 节点')
assert.ok(conclusionNode, '项目应存在 TEST_CONCLUSION 节点')

const summaryResult = generateProjectTestingSummaryFromRelations(project!.projectId, '测试用户')
assert.ok(summaryResult.ok, `生成测款汇总应成功，当前返回：${summaryResult.message}`)

const summaryRecord = getLatestProjectInlineNodeRecord(summaryNode!.projectNodeId)
assert.ok(summaryRecord, '生成测款汇总后应写入 TEST_DATA_SUMMARY inline record')
assert.equal(summaryRecord!.projectId, project!.projectId)
assert.equal(summaryRecord!.projectNodeId, summaryNode!.projectNodeId)
assert.equal(summaryRecord!.workItemTypeCode, 'TEST_DATA_SUMMARY')
assert.ok((summaryRecord!.payload as Record<string, unknown>).summaryText)
assert.ok(Number((summaryRecord!.payload as Record<string, unknown>).totalExposureQty) > 0)
assert.ok(Number((summaryRecord!.payload as Record<string, unknown>).totalClickQty) > 0)
assert.ok(Number((summaryRecord!.payload as Record<string, unknown>).totalOrderQty) > 0)
assert.ok(Number((summaryRecord!.payload as Record<string, unknown>).totalGmvAmount) > 0)
assert.ok(((summaryRecord!.detailSnapshot as Record<string, unknown>).liveRelationIds as string[]).length > 0)
assert.ok(((summaryRecord!.detailSnapshot as Record<string, unknown>).videoRelationIds as string[]).length > 0)
assert.ok((summaryRecord!.detailSnapshot as Record<string, unknown>).channelProductId)
assert.ok((summaryRecord!.detailSnapshot as Record<string, unknown>).channelProductCode)
assert.ok(summaryRecord!.upstreamRefs.some((ref) => ref.refType === '直播测款关系'))
assert.ok(summaryRecord!.upstreamRefs.some((ref) => ref.refType === '短视频测款关系'))

const conclusionResult = submitProjectTestingConclusion(
  project!.projectId,
  {
    conclusion: '调整',
    note: '测试结论为调整，需要改版后重新进入测款。',
  },
  '测试用户',
)
assert.ok(conclusionResult.ok, `提交测款结论应成功，当前返回：${conclusionResult.message}`)

const conclusionRecord = getLatestProjectInlineNodeRecord(conclusionNode!.projectNodeId)
assert.ok(conclusionRecord, '提交测款结论后应写入 TEST_CONCLUSION inline record')
assert.equal(conclusionRecord!.projectId, project!.projectId)
assert.equal(conclusionRecord!.projectNodeId, conclusionNode!.projectNodeId)
assert.equal(conclusionRecord!.workItemTypeCode, 'TEST_CONCLUSION')
assert.equal((conclusionRecord!.payload as Record<string, unknown>).conclusion, '调整')
assert.equal((conclusionRecord!.payload as Record<string, unknown>).linkedChannelProductCode, conclusionResult.record?.channelProductCode)
assert.equal((conclusionRecord!.detailSnapshot as Record<string, unknown>).summaryRecordId, summaryRecord!.recordId)
assert.equal((conclusionRecord!.detailSnapshot as Record<string, unknown>).summaryRecordCode, summaryRecord!.recordCode)
assert.equal(
  (conclusionRecord!.detailSnapshot as Record<string, unknown>).invalidatedChannelProductId,
  conclusionResult.record?.channelProductId,
)
assert.ok((conclusionRecord!.detailSnapshot as Record<string, unknown>).revisionTaskId)
assert.ok((conclusionRecord!.detailSnapshot as Record<string, unknown>).revisionTaskCode)
assert.ok(conclusionRecord!.upstreamRefs.some((ref) => ref.refId === summaryRecord!.recordId))
assert.ok(conclusionRecord!.upstreamRefs.some((ref) => ref.refId === conclusionResult.record?.channelProductId))
assert.ok(
  conclusionRecord!.downstreamRefs.some(
    (ref) => ref.refId === (conclusionRecord!.detailSnapshot as Record<string, unknown>).revisionTaskId,
  ),
)
assert.ok(
  conclusionRecord!.downstreamRefs.some(
    (ref) => ref.refId === (conclusionRecord!.detailSnapshot as Record<string, unknown>).invalidatedChannelProductId,
  ),
)

console.log('pcs-testing-summary-conclusion-inline-record.spec.ts PASS')
