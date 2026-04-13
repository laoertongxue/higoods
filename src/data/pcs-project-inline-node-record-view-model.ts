import {
  getLatestProjectInlineNodeRecord,
  listProjectInlineNodeRecordsByNode,
} from './pcs-project-inline-node-record-repository.ts'
import type {
  PcsProjectInlineNodeRecord,
  PcsProjectInlineNodeRecordWorkItemTypeCode,
} from './pcs-project-inline-node-record-types.ts'

export interface ProjectInlineNodeRecordSummaryFieldViewModel {
  label: string
  value: string
}

export interface ProjectInlineNodeRecordSummaryItemViewModel {
  itemId: string
  title: string
  summary: string
  time: string
  recordCode: string
  businessDate: string
  recordStatus: string
  ownerName: string
  sourceDocText: string
  metaRows: ProjectInlineNodeRecordSummaryFieldViewModel[]
}

const PAYLOAD_LABEL_MAP: Record<string, string> = {
  sampleSourceType: '样衣来源方式',
  sampleSupplierId: '来源方',
  sampleLink: '外采链接',
  sampleUnitPrice: '样衣单价',
  sampleCode: '样衣编号',
  arrivalTime: '到样时间',
  checkResult: '核对结果',
  reviewConclusion: '可行性结论',
  reviewRisk: '风险说明',
  shootPlan: '拍摄安排',
  fitFeedback: '试穿反馈',
  confirmResult: '确认结果',
  confirmNote: '确认说明',
  costTotal: '核价金额',
  costNote: '核价说明',
  priceRange: '价格带',
  pricingNote: '定价说明',
  summaryText: '汇总结论',
  totalExposureQty: '总曝光量',
  totalClickQty: '总点击量',
  totalOrderQty: '总下单量',
  totalGmvAmount: '总销售额',
  conclusion: '测款结论',
  conclusionNote: '结论说明',
  linkedChannelProductCode: '关联渠道商品编码',
  invalidationPlanned: '是否计划作废',
  retainResult: '留存结论',
  retainNote: '评估说明',
  returnResult: '处理结果',
}

const DETAIL_SNAPSHOT_FIELD_MAP: Partial<
  Record<PcsProjectInlineNodeRecordWorkItemTypeCode, Record<string, string>>
> = {
  SAMPLE_ACQUIRE: {
    sampleCode: 'sampleCode',
  },
  SAMPLE_INBOUND_CHECK: {
    sampleCode: 'sampleCode',
  },
  SAMPLE_RETAIN_REVIEW: {
    sampleCode: 'sampleCode',
  },
  SAMPLE_RETURN_HANDLE: {
    sampleCode: 'sampleCode',
  },
}

function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined) return '当前无实例值'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '当前无实例值'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) {
    const text = value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join('、')
    return text || '当前无实例值'
  }
  const text = String(value).trim()
  return text || '当前无实例值'
}

function getPayloadHighlightEntries(record: PcsProjectInlineNodeRecord): Array<[string, unknown]> {
  return Object.entries(record.payload as Record<string, unknown>).filter(([, value]) => {
    if (value === null || value === undefined) return false
    if (Array.isArray(value)) return value.length > 0
    return String(value).trim() !== ''
  })
}

function buildRecordSummaryItem(record: PcsProjectInlineNodeRecord): ProjectInlineNodeRecordSummaryItemViewModel {
  const payloadHighlights = getPayloadHighlightEntries(record)
    .slice(0, 4)
    .map(([fieldKey, value]) => ({
      label: PAYLOAD_LABEL_MAP[fieldKey] || fieldKey,
      value: formatRecordValue(value),
    }))

  return {
    itemId: record.recordId,
    title: record.recordCode || record.workItemTypeName,
    summary: record.workItemTypeName,
    time: record.businessDate || record.updatedAt || record.createdAt || '',
    recordCode: record.recordCode,
    businessDate: record.businessDate,
    recordStatus: record.recordStatus,
    ownerName: record.ownerName,
    sourceDocText:
      record.sourceDocCode && record.sourceDocType
        ? `${record.sourceDocType} · ${record.sourceDocCode}`
        : record.sourceDocCode || record.sourceDocType || '当前无来源单据',
    metaRows: [
      { label: '记录编号', value: record.recordCode || '当前无实例值' },
      { label: '业务日期', value: record.businessDate || '当前无实例值' },
      { label: '记录状态', value: record.recordStatus || '当前无实例值' },
      { label: '负责人', value: record.ownerName || '当前无实例值' },
      { label: '来源单据', value: record.sourceDocCode || record.sourceDocType ? `${record.sourceDocType || '来源单据'} · ${record.sourceDocCode || '未编号'}` : '当前无来源单据' },
      ...payloadHighlights,
    ],
  }
}

export function listProjectInlineNodeRecordSummaryItems(
  projectNodeId: string,
): ProjectInlineNodeRecordSummaryItemViewModel[] {
  return listProjectInlineNodeRecordsByNode(projectNodeId).map((record) => buildRecordSummaryItem(record))
}

export function resolveLatestProjectInlineNodeRecordFieldValue(
  projectNodeId: string,
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode,
  fieldKey: string,
): unknown {
  const latestRecord = getLatestProjectInlineNodeRecord(projectNodeId)
  if (!latestRecord || latestRecord.workItemTypeCode !== workItemTypeCode) return undefined

  const payload = latestRecord.payload as Record<string, unknown>
  if (fieldKey in payload && payload[fieldKey] !== undefined) {
    return payload[fieldKey]
  }

  const snapshotFieldKey = DETAIL_SNAPSHOT_FIELD_MAP[workItemTypeCode]?.[fieldKey]
  if (!snapshotFieldKey) return undefined

  const detailSnapshot = latestRecord.detailSnapshot as Record<string, unknown>
  return detailSnapshot[snapshotFieldKey]
}
