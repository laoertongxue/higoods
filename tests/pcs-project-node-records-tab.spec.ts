import assert from 'node:assert/strict'

import { buildProjectNodeContractDetailViewModel } from '../src/data/pcs-project-node-detail-contract-view-model.ts'
import { resetProjectInlineNodeRecordRepository, upsertProjectInlineNodeRecord } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { getProjectNodeRecordByWorkItemTypeCode } from '../src/data/pcs-project-repository.ts'
import { buildProjectNodeDetailViewModel } from '../src/data/pcs-project-view-model.ts'
import {
  handlePcsProjectWorkItemDetailEvent,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-project-work-item-detail.ts'
import { createProjectForBusinessChain, resetProjectBusinessChainRepositories } from './pcs-project-formal-chain-helper.ts'

function getNodeId(projectId: string, workItemTypeCode: string): string {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  assert.ok(node, `项目 ${projectId} 应存在节点 ${workItemTypeCode}`)
  return node!.projectNodeId
}

function buildActionTarget(action: string, data: Record<string, string>): HTMLElement {
  const target = {
    dataset: {
      pcsWorkItemAction: action,
      ...data,
    },
    closest() {
      return this
    },
  }
  return target as unknown as HTMLElement
}

resetProjectBusinessChainRepositories()
resetProjectInlineNodeRecordRepository()

const inlineProject = createProjectForBusinessChain('节点正式记录页签测试项目')
const sampleAcquireNodeId = getNodeId(inlineProject.projectId, 'SAMPLE_ACQUIRE')

upsertProjectInlineNodeRecord({
  recordId: 'test-inline-acquire-001',
  recordCode: 'INR-ACQUIRE-001',
  projectId: inlineProject.projectId,
  projectCode: inlineProject.projectCode,
  projectName: inlineProject.projectName,
  projectNodeId: sampleAcquireNodeId,
  workItemTypeCode: 'SAMPLE_ACQUIRE',
  workItemTypeName: '样衣获取',
  businessDate: '2026-04-12',
  recordStatus: '已完成',
  ownerId: 'user-test',
  ownerName: '测试用户',
  payload: {
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-a',
    sampleLink: 'https://example.com/old-sample',
    sampleUnitPrice: '188',
  },
  detailSnapshot: {
    acquireMethod: '外采',
  },
  sourceModule: '商品项目',
  sourceDocType: '样衣获取登记',
  sourceDocId: 'DOC-ACQUIRE-001',
  sourceDocCode: 'DOC-ACQUIRE-001',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-12 10:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-12 10:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

upsertProjectInlineNodeRecord({
  recordId: 'test-inline-acquire-002',
  recordCode: 'INR-ACQUIRE-002',
  projectId: inlineProject.projectId,
  projectCode: inlineProject.projectCode,
  projectName: inlineProject.projectName,
  projectNodeId: sampleAcquireNodeId,
  workItemTypeCode: 'SAMPLE_ACQUIRE',
  workItemTypeName: '样衣获取',
  businessDate: '2026-04-13',
  recordStatus: '已完成',
  ownerId: 'user-test',
  ownerName: '测试用户',
  payload: {
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-b',
    sampleLink: 'https://example.com/new-sample',
    sampleUnitPrice: 268,
  },
  detailSnapshot: {
    acquireMethod: '委托打样',
    sampleCode: 'SMP-ACQ-001',
  },
  sourceModule: '商品项目',
  sourceDocType: '样衣获取登记',
  sourceDocId: 'DOC-ACQUIRE-002',
  sourceDocCode: 'DOC-ACQUIRE-002',
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-13 11:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-13 11:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
  legacyWorkItemInstanceId: null,
} as never)

const detail = buildProjectNodeDetailViewModel(inlineProject.projectId, sampleAcquireNodeId)
assert.ok(detail, '应能构建样衣获取节点详情')
assert.ok(detail!.records.some((item) => !item.isPlaceholder), 'inline 节点 records 不应为空壳')

const contractDetail = buildProjectNodeContractDetailViewModel(detail!)
const sampleSourceField = contractDetail.fieldRows.find((row) => row.fieldKey === 'sampleSourceType')
assert.ok(sampleSourceField, '字段清单中应包含 sampleSourceType')
assert.equal(sampleSourceField!.currentValueText, '委托打样', '字段当前值应优先来自正式 record')

const basicHtml = renderPcsProjectWorkItemDetailPage(inlineProject.projectId, sampleAcquireNodeId)
assert.ok(basicHtml.includes('记录列表'), 'PROJECT_INLINE_RECORDS 基本视图里应出现记录列表')
assert.ok(basicHtml.includes('INR-ACQUIRE-002'), '基本视图应展示最新正式记录编号')

handlePcsProjectWorkItemDetailEvent(buildActionTarget('set-tab', { tab: 'records' }))
const recordsHtml = renderPcsProjectWorkItemDetailPage(inlineProject.projectId, sampleAcquireNodeId)

assert.ok(recordsHtml.includes('INR-ACQUIRE-002'), 'records tab 应展示正式记录编号')
assert.ok(recordsHtml.includes('2026-04-13'), 'records tab 应展示业务日期')
assert.ok(recordsHtml.includes('测试用户'), 'records tab 应展示负责人')
assert.ok(recordsHtml.includes('来源单据'), 'records tab 应展示来源单据')
assert.ok(recordsHtml.includes('样衣来源方式'), 'records tab 应展示 payload 关键字段')
assert.ok(!recordsHtml.includes('当前暂无正式记录'), 'records tab 不应继续是空壳')

console.log('pcs-project-node-records-tab.spec.ts PASS')
