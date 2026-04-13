import assert from 'node:assert/strict'

import { upsertProjectInlineNodeRecord, resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-project-work-item-detail.ts'
import { createProjectForBusinessChain, prepareProjectWithPassedTesting, resetProjectBusinessChainRepositories } from './pcs-project-formal-chain-helper.ts'

function getNodeId(projectId: string, workItemTypeCode: string): string {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  assert.ok(node, `项目 ${projectId} 应存在节点 ${workItemTypeCode}`)
  return node!.projectNodeId
}

resetProjectBusinessChainRepositories()
resetProjectInlineNodeRecordRepository()

const inlineProject = createProjectForBusinessChain('无独立实例列表节点默认详情测试项目')
const passedProject = prepareProjectWithPassedTesting('结论节点默认详情测试项目')

const inboundNodeId = getNodeId(inlineProject.projectId, 'SAMPLE_INBOUND_CHECK')
const confirmNodeId = getNodeId(inlineProject.projectId, 'SAMPLE_CONFIRM')

upsertProjectInlineNodeRecord({
  recordId: 'test-inline-inbound-001',
  recordCode: 'INR-INBOUND-001',
  projectId: inlineProject.projectId,
  projectCode: inlineProject.projectCode,
  projectName: inlineProject.projectName,
  projectNodeId: inboundNodeId,
  workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
  workItemTypeName: '到样入库与核对',
  businessDate: '2026-04-13',
  recordStatus: '已完成',
  ownerId: 'user-test',
  ownerName: '测试用户',
  payload: {
    sampleCode: 'SMP-IN-001',
    arrivalTime: '2026-04-13 10:30',
    checkResult: '到样无破损',
  },
  detailSnapshot: {
    warehouseLocation: '留样仓 A-01',
    receiver: '测试用户',
  },
  sourceModule: '样衣资产',
  sourceDocType: '到样登记单',
  sourceDocId: 'DOC-IN-001',
  sourceDocCode: 'DOC-IN-001',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-13 10:30',
  createdBy: '测试用户',
  updatedAt: '2026-04-13 10:30',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

upsertProjectInlineNodeRecord({
  recordId: 'test-inline-confirm-001',
  recordCode: 'INR-CONFIRM-001',
  projectId: inlineProject.projectId,
  projectCode: inlineProject.projectCode,
  projectName: inlineProject.projectName,
  projectNodeId: confirmNodeId,
  workItemTypeCode: 'SAMPLE_CONFIRM',
  workItemTypeName: '样衣确认',
  businessDate: '2026-04-13',
  recordStatus: '已完成',
  ownerId: 'user-test',
  ownerName: '测试用户',
  payload: {
    confirmResult: '通过',
    confirmNote: '样衣确认通过，可进入后续流程。',
  },
  detailSnapshot: {
    proceedToNextStage: true,
  },
  sourceModule: '商品项目',
  sourceDocType: '样衣确认单',
  sourceDocId: 'DOC-CONFIRM-001',
  sourceDocCode: 'DOC-CONFIRM-001',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-13 11:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-13 11:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

const cases = [
  { projectId: inlineProject.projectId, workItemTypeCode: 'PROJECT_INIT' },
  { projectId: inlineProject.projectId, workItemTypeCode: 'SAMPLE_INBOUND_CHECK' },
  { projectId: inlineProject.projectId, workItemTypeCode: 'SAMPLE_COST_REVIEW' },
  { projectId: inlineProject.projectId, workItemTypeCode: 'SAMPLE_CONFIRM' },
  { projectId: passedProject.projectId, workItemTypeCode: 'TEST_CONCLUSION' },
] as const

cases.forEach(({ projectId, workItemTypeCode }) => {
  const html = renderPcsProjectWorkItemDetailPage(projectId, getNodeId(projectId, workItemTypeCode))
  assert.ok(
    html.includes('data-pcs-node-detail-section="field-definitions"'),
    `${workItemTypeCode} 默认业务视图应直接展示字段清单`,
  )
  assert.ok(
    html.includes('data-pcs-node-detail-section="statuses"'),
    `${workItemTypeCode} 默认业务视图应直接展示状态定义`,
  )
  assert.ok(
    html.includes('data-pcs-node-detail-section="operations"'),
    `${workItemTypeCode} 默认业务视图应直接展示操作定义`,
  )
})

const inboundHtml = renderPcsProjectWorkItemDetailPage(inlineProject.projectId, inboundNodeId)
assert.ok(inboundHtml.includes('当前正式记录'), 'PROJECT_INLINE_SINGLE 节点默认业务视图应展示当前正式记录')
assert.ok(inboundHtml.includes('INR-INBOUND-001'), 'PROJECT_INLINE_SINGLE 节点应展示正式记录编号')

const confirmHtml = renderPcsProjectWorkItemDetailPage(inlineProject.projectId, confirmNodeId)
assert.ok(confirmHtml.includes('当前正式记录'), '样衣确认节点应展示当前正式记录区块')
assert.ok(confirmHtml.includes('DOC-CONFIRM-001'), '样衣确认节点应展示来源单据')

console.log('pcs-project-node-no-standalone-detail.spec.ts PASS')
