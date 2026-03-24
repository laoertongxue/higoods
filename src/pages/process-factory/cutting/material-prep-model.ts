import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
  CuttingReviewStatus,
} from '../../../data/fcs/cutting/types'
import {
  buildCraftClaimDisputeSummary,
  formatClaimQty as formatDisputeQty,
  getClaimDisputeStatusLabel,
} from '../../../helpers/fcs-claim-dispute'
import type { ClaimDisputeRecord } from '../../../models/fcs-claim-dispute'
import { getLatestClaimDisputeByOriginalCutOrderNo, listClaimDisputesByOriginalCutOrderNo } from '../../../state/fcs-claim-dispute-store'
import {
  canViewPrepQr,
  getPrepQrHiddenText,
  shouldDisplayQrByPrepStatus,
  shouldDisplayQrLabelByPrepStatus,
  shouldPrintPrepQr,
} from './material-prep.helpers'
import { summarizeMergeBatchParticipation } from './original-orders-model'
import type { MergeBatchRecord } from './merge-batches-model'
import { buildProductionProgressRows, type ProductionProgressUrgencyKey, urgencyMeta } from './production-progress-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type MaterialPrepClaimAggregateKey = CuttingReceiveStatus | 'EXCEPTION'
export type MaterialPrepSchedulingKey = 'UNASSIGNED' | 'ASSIGNED'
export type MaterialPrepStageKey =
  | 'WAITING_REVIEW'
  | 'WAITING_PREP'
  | 'WAITING_CLAIM'
  | 'WAITING_SCHEDULING'
  | 'ASSIGNED'
  | 'CUTTING'
  | 'WAITING_INBOUND'
  | 'DONE'
export type MaterialPrepRiskKey =
  | 'PENDING_REVIEW'
  | 'PREP_DELAY'
  | 'CLAIM_EXCEPTION'
  | 'SHIP_URGENT'
  | 'DATE_MISSING'
  | 'STATUS_CONFLICT'
  | 'UNASSIGNED'

export interface MaterialPrepSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface MaterialPrepRiskTag {
  key: MaterialPrepRiskKey
  label: string
  className: string
}

export interface MaterialClaimRecord {
  claimRecordId: string
  originalCutOrderId: string
  claimedAt: string
  claimedBy: string
  result: 'SUCCESS' | 'PARTIAL' | 'EXCEPTION'
  summary: string
  note: string
}

export interface MaterialPrepLineItem {
  materialLineId: string
  materialSku: string
  materialName: string
  materialCategory: string
  materialAttr: string
  requiredQty: number
  configuredQty: number
  claimedQty: number
  shortageQty: number
  configuredRollCount: number
  claimedRollCount: number
  auditStatus: MaterialPrepSummaryMeta<CuttingReviewStatus>
  linePrepStatus: MaterialPrepSummaryMeta<CuttingConfigStatus>
  lineClaimStatus: MaterialPrepSummaryMeta<MaterialPrepClaimAggregateKey>
  hasClaimException: boolean
  note: string
  latestActionText: string
}

export interface MaterialPrepNavigationPayload {
  originalOrders: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  productionProgress: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
}

export interface MaterialPrepRow {
  id: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSkuSummary: string
  plannedShipDate: string
  urgencyKey: ProductionProgressUrgencyKey
  urgencyLabel: string
  urgencyClassName: string
  sameCodeValue: string
  qrCodeValue: string
  qrCodeLabel: string
  shouldDisplayQr: boolean
  shouldDisplayQrLabel: boolean
  canViewQr: boolean
  shouldPrintQr: boolean
  qrHiddenHint: string
  materialAuditStatus: MaterialPrepSummaryMeta<CuttingReviewStatus>
  materialPrepStatus: MaterialPrepSummaryMeta<CuttingConfigStatus>
  materialClaimStatus: MaterialPrepSummaryMeta<MaterialPrepClaimAggregateKey>
  schedulingStatus: MaterialPrepSummaryMeta<MaterialPrepSchedulingKey>
  assignedCuttingGroup: string
  currentStage: MaterialPrepSummaryMeta<MaterialPrepStageKey>
  riskTags: MaterialPrepRiskTag[]
  materialLineItems: MaterialPrepLineItem[]
  claimRecords: MaterialClaimRecord[]
  claimRecordCount: number
  latestClaimRecordAt: string
  latestClaimRecordSummary: string
  claimDisputes: ClaimDisputeRecord[]
  claimDisputeCount: number
  latestClaimDispute: ClaimDisputeRecord | null
  hasClaimDispute: boolean
  claimDisputeStatusLabel: string
  claimDisputeSummary: string
  claimDisputeDiscrepancyText: string
  claimDisputeEvidenceCount: number
  claimDisputeHandleSummary: string
  printedAt: string
  printedBy: string
  latestMergeBatchNo: string
  mergeBatchNos: string[]
  mergeBatchIds: string[]
  currentStageText: string
  navigationPayload: MaterialPrepNavigationPayload
  keywordIndex: string[]
}

export interface MaterialPrepViewModel {
  rows: MaterialPrepRow[]
  rowsById: Record<string, MaterialPrepRow>
}

export interface MaterialPrepFilters {
  keyword: string
  productionOrderNo: string
  styleKeyword: string
  materialPrepStatus: 'ALL' | CuttingConfigStatus
  materialClaimStatus: 'ALL' | MaterialPrepClaimAggregateKey
  materialAuditStatus: 'ALL' | CuttingReviewStatus
  schedulingStatus: 'ALL' | MaterialPrepSchedulingKey
  cuttingGroup: string
  materialSku: string
  issuesOnly: boolean
  onlyPrintable: boolean
  onlyPendingScheduling: boolean
}

export interface MaterialPrepPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
  schedulingStatus?: MaterialPrepSchedulingKey
  materialPrepStatus?: CuttingConfigStatus
  materialClaimStatus?: MaterialPrepClaimAggregateKey
}

export interface MaterialPrepStats {
  totalCount: number
  configuredCount: number
  partialConfigCount: number
  waitingClaimCount: number
  claimSuccessCount: number
  claimExceptionCount: number
  pendingSchedulingCount: number
  assignedCount: number
}

export interface IssueListPrintPayload {
  title: string
  printTime: string
  originalCutOrderNo: string
  sameCodeValue: string
  qrCodeValue: string
  qrCodeLabel: string
  shouldPrintQr: boolean
  qrHiddenHint: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  materialLineItems: Array<{
    materialSku: string
    materialCategory: string
    requiredQty: number
    configuredQty: number
    claimedQty: number
    shortageQty: number
  }>
}

export const materialAuditMeta: Record<CuttingReviewStatus, { label: string; className: string }> = {
  NOT_REQUIRED: { label: '无需审核', className: 'bg-slate-100 text-slate-700' },
  PENDING: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  PARTIAL: { label: '部分已审核', className: 'bg-orange-100 text-orange-700' },
  APPROVED: { label: '已审核', className: 'bg-emerald-100 text-emerald-700' },
}

export const materialPrepMeta: Record<CuttingConfigStatus, { label: string; className: string }> = {
  NOT_CONFIGURED: { label: '未配置', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分配置', className: 'bg-orange-100 text-orange-700' },
  CONFIGURED: { label: '已配置', className: 'bg-emerald-100 text-emerald-700' },
}

export const materialClaimMeta: Record<MaterialPrepClaimAggregateKey, { label: string; className: string }> = {
  NOT_RECEIVED: { label: '待领料', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分领取', className: 'bg-orange-100 text-orange-700' },
  RECEIVED: { label: '领料成功', className: 'bg-emerald-100 text-emerald-700' },
  EXCEPTION: { label: '领料不齐', className: 'bg-rose-100 text-rose-700' },
}

export const materialSchedulingMeta: Record<MaterialPrepSchedulingKey, { label: string; className: string }> = {
  UNASSIGNED: { label: '待排单', className: 'bg-slate-100 text-slate-700' },
  ASSIGNED: { label: '已排单', className: 'bg-blue-100 text-blue-700' },
}

export const materialPrepStageMeta: Record<MaterialPrepStageKey, { label: string; className: string }> = {
  WAITING_REVIEW: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  WAITING_PREP: { label: '待配料', className: 'bg-slate-100 text-slate-700' },
  WAITING_CLAIM: { label: '待领料', className: 'bg-blue-100 text-blue-700' },
  WAITING_SCHEDULING: { label: '待排单', className: 'bg-sky-100 text-sky-700' },
  ASSIGNED: { label: '已排单', className: 'bg-cyan-100 text-cyan-700' },
  CUTTING: { label: '裁剪中', className: 'bg-violet-100 text-violet-700' },
  WAITING_INBOUND: { label: '待入仓', className: 'bg-indigo-100 text-indigo-700' },
  DONE: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export const materialPrepRiskMeta: Record<MaterialPrepRiskKey, { label: string; className: string }> = {
  PENDING_REVIEW: { label: '审核未完成', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  PREP_DELAY: { label: '配料滞后', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  UNASSIGNED: { label: '待排单', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
}

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

function buildSummaryMeta<Key extends string>(
  key: Key,
  label: string,
  className: string,
  detailText: string,
): MaterialPrepSummaryMeta<Key> {
  return { key, label, className, detailText }
}

function materialCategoryLabel(line: CuttingMaterialLine): string {
  if (line.materialCategory) return line.materialCategory
  if (line.materialType === 'PRINT') return '印花主料'
  if (line.materialType === 'DYE') return '染色主料'
  if (line.materialType === 'LINING') return '里辅料'
  return '主布 / 拼接料'
}

function inferRequiredQty(line: CuttingMaterialLine): number {
  const baseline = Math.max(line.configuredLength, line.receivedLength, 60)
  if (line.configStatus === 'CONFIGURED' && line.receiveStatus === 'RECEIVED') return baseline
  if (line.configStatus === 'PARTIAL' && line.receiveStatus === 'PARTIAL') return Math.max(baseline, Math.ceil(baseline * 1.5))
  if (line.configStatus === 'PARTIAL') return Math.max(baseline, Math.ceil(baseline * 1.35))
  if (line.receiveStatus === 'PARTIAL') return Math.max(baseline, Math.ceil(baseline * 1.2))
  if (line.configStatus === 'NOT_CONFIGURED') return Math.max(baseline, 180)
  return baseline
}

function inferAssignedCuttingGroup(record: CuttingOrderProgressRecord, line: CuttingMaterialLine): string {
  if (record.hasSpreadingRecord || /裁片中|裁剪中|待入仓|已完成/.test(record.cuttingStage)) {
    return `${record.assignedFactoryName} / 裁床一组`
  }
  if (line.batchOccupancyStatus === 'IN_BATCH') {
    return `${record.assignedFactoryName} / 待排床`
  }
  return ''
}

function buildKeywordIndex(values: Array<string | undefined | null>): string[] {
  return values
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.toLowerCase())
}

function createReviewSummary(status: CuttingReviewStatus): MaterialPrepSummaryMeta<CuttingReviewStatus> {
  const meta = materialAuditMeta[status]
  const detailText =
    status === 'APPROVED'
      ? '当前面料审核已完成。'
      : status === 'PARTIAL'
        ? '当前面料审核仅部分完成。'
        : status === 'NOT_REQUIRED'
          ? '当前面料无需额外审核。'
          : '当前面料仍待审核。'

  return buildSummaryMeta(status, meta.label, meta.className, detailText)
}

export function deriveMaterialPrepStatus(lineItems: MaterialPrepLineItem[]): MaterialPrepSummaryMeta<CuttingConfigStatus> {
  const total = lineItems.length
  const configuredCount = lineItems.filter((item) => item.configuredQty >= item.requiredQty && item.requiredQty > 0).length
  const partialCount = lineItems.filter((item) => item.configuredQty > 0 && item.configuredQty < item.requiredQty).length

  if (configuredCount === total && total > 0) {
    return buildSummaryMeta('CONFIGURED', materialPrepMeta.CONFIGURED.label, materialPrepMeta.CONFIGURED.className, `已完成 ${configuredCount}/${total} 项配置。`)
  }

  if (configuredCount > 0 || partialCount > 0) {
    return buildSummaryMeta('PARTIAL', materialPrepMeta.PARTIAL.label, materialPrepMeta.PARTIAL.className, `已配置 ${configuredCount + partialCount}/${total} 项，仍有剩余待补齐。`)
  }

  return buildSummaryMeta('NOT_CONFIGURED', materialPrepMeta.NOT_CONFIGURED.label, materialPrepMeta.NOT_CONFIGURED.className, `当前共 ${total} 项面料待进入配料。`)
}

export function deriveMaterialClaimStatus(lineItems: MaterialPrepLineItem[]): MaterialPrepSummaryMeta<MaterialPrepClaimAggregateKey> {
  if (lineItems.some((item) => item.hasClaimException)) {
    return buildSummaryMeta('EXCEPTION', materialClaimMeta.EXCEPTION.label, materialClaimMeta.EXCEPTION.className, '当前存在领料不齐 / 差异，需仓库复核。')
  }

  const total = lineItems.length
  const receivedCount = lineItems.filter((item) => item.claimedQty >= item.requiredQty && item.requiredQty > 0).length
  const partialCount = lineItems.filter((item) => item.claimedQty > 0 && item.claimedQty < item.requiredQty).length

  if (receivedCount === total && total > 0) {
    return buildSummaryMeta('RECEIVED', materialClaimMeta.RECEIVED.label, materialClaimMeta.RECEIVED.className, `已完成 ${receivedCount}/${total} 项领料。`)
  }

  if (receivedCount > 0 || partialCount > 0) {
    return buildSummaryMeta('PARTIAL', materialClaimMeta.PARTIAL.label, materialClaimMeta.PARTIAL.className, `已领取 ${receivedCount + partialCount}/${total} 项，仍有余量待补齐。`)
  }

  return buildSummaryMeta('NOT_RECEIVED', materialClaimMeta.NOT_RECEIVED.label, materialClaimMeta.NOT_RECEIVED.className, `当前共 ${total} 项面料待领料。`)
}

export function deriveSchedulingStatus(assignedCuttingGroup: string): MaterialPrepSummaryMeta<MaterialPrepSchedulingKey> {
  if (assignedCuttingGroup.trim()) {
    return buildSummaryMeta('ASSIGNED', materialSchedulingMeta.ASSIGNED.label, materialSchedulingMeta.ASSIGNED.className, `当前已分配至 ${assignedCuttingGroup}。`)
  }
  return buildSummaryMeta('UNASSIGNED', materialSchedulingMeta.UNASSIGNED.label, materialSchedulingMeta.UNASSIGNED.className, '当前尚未分配裁床组。')
}

export function buildSameCodeValue(originalCutOrderNo: string): string {
  return originalCutOrderNo
}

function buildQrCodeValue(originalCutOrderNo: string): string {
  return `QR-${originalCutOrderNo}`
}

function deriveCurrentStage(
  record: CuttingOrderProgressRecord,
  row: Pick<MaterialPrepRow, 'materialAuditStatus' | 'materialPrepStatus' | 'materialClaimStatus' | 'schedulingStatus'>,
): MaterialPrepSummaryMeta<MaterialPrepStageKey> {
  if (record.hasInboundRecord || /已完成|已入仓/.test(record.cuttingStage)) {
    return buildSummaryMeta('DONE', materialPrepStageMeta.DONE.label, materialPrepStageMeta.DONE.className, '当前原始裁片单已进入入仓 / 完成后续。')
  }
  if (/待入仓/.test(record.cuttingStage)) {
    return buildSummaryMeta('WAITING_INBOUND', materialPrepStageMeta.WAITING_INBOUND.label, materialPrepStageMeta.WAITING_INBOUND.className, '裁片已完成当前执行，等待入仓确认。')
  }
  if (record.hasSpreadingRecord || /裁片中|裁剪中/.test(record.cuttingStage)) {
    return buildSummaryMeta('CUTTING', materialPrepStageMeta.CUTTING.label, materialPrepStageMeta.CUTTING.className, '当前已进入裁剪执行上下文。')
  }
  if (row.materialAuditStatus.key === 'PENDING' || row.materialAuditStatus.key === 'PARTIAL') {
    return buildSummaryMeta('WAITING_REVIEW', materialPrepStageMeta.WAITING_REVIEW.label, materialPrepStageMeta.WAITING_REVIEW.className, '面料审核未齐，当前仍停留在待审核阶段。')
  }
  if (row.materialPrepStatus.key === 'NOT_CONFIGURED' || row.materialPrepStatus.key === 'PARTIAL') {
    return buildSummaryMeta('WAITING_PREP', materialPrepStageMeta.WAITING_PREP.label, materialPrepStageMeta.WAITING_PREP.className, '当前仍处于配料准备阶段。')
  }
  if (row.materialClaimStatus.key === 'NOT_RECEIVED' || row.materialClaimStatus.key === 'PARTIAL' || row.materialClaimStatus.key === 'EXCEPTION') {
    return buildSummaryMeta('WAITING_CLAIM', materialPrepStageMeta.WAITING_CLAIM.label, materialPrepStageMeta.WAITING_CLAIM.className, '当前仍待领料回写完成。')
  }
  if (row.schedulingStatus.key === 'UNASSIGNED') {
    return buildSummaryMeta('WAITING_SCHEDULING', materialPrepStageMeta.WAITING_SCHEDULING.label, materialPrepStageMeta.WAITING_SCHEDULING.className, '领料已到位，等待分配裁床组。')
  }
  return buildSummaryMeta('ASSIGNED', materialPrepStageMeta.ASSIGNED.label, materialPrepStageMeta.ASSIGNED.className, '当前已具备进入唛架 / 铺布的执行准备。')
}

function buildInitialClaimRecords(
  record: CuttingOrderProgressRecord,
  lineItem: MaterialPrepLineItem,
  originalCutOrderId: string,
): MaterialClaimRecord[] {
  if (lineItem.claimedQty <= 0 && !lineItem.hasClaimException) return []

  const result: MaterialClaimRecord['result'] =
    lineItem.hasClaimException ? 'EXCEPTION' : lineItem.claimedQty >= lineItem.requiredQty ? 'SUCCESS' : 'PARTIAL'

  return [
    {
      claimRecordId: `${originalCutOrderId}-claim-seed`,
      originalCutOrderId,
      claimedAt: record.lastPickupScanAt || record.lastFieldUpdateAt || '',
      claimedBy: record.lastOperatorName || '仓库领料员',
      result,
      summary:
        result === 'SUCCESS'
          ? `已回写 ${formatQty(lineItem.claimedQty)} 米领料结果。`
          : result === 'PARTIAL'
            ? `已回写部分领料 ${formatQty(lineItem.claimedQty)} 米。`
            : '领料存在差异，待仓库复核。',
      note: lineItem.latestActionText,
    },
  ].filter((item) => item.claimedAt)
}

function buildLineItem(record: CuttingOrderProgressRecord, line: CuttingMaterialLine): MaterialPrepLineItem {
  const requiredQty = inferRequiredQty(line)
  const configuredQty = line.configuredLength
  const claimedQty = line.receivedLength
  const hasClaimException = line.issueFlags.includes('RECEIVE_DIFF')

  const linePrepStatus = deriveMaterialPrepStatus([
    {
      materialLineId: line.cutPieceOrderNo,
      materialSku: line.materialSku,
      materialName: line.materialLabel,
      materialCategory: materialCategoryLabel(line),
      materialAttr: line.color || '待补',
      requiredQty,
      configuredQty,
      claimedQty,
      shortageQty: Math.max(requiredQty - claimedQty, 0),
      configuredRollCount: line.configuredRollCount,
      claimedRollCount: line.receivedRollCount,
      auditStatus: createReviewSummary(line.reviewStatus),
      linePrepStatus: buildSummaryMeta('NOT_CONFIGURED', '', '', ''),
      lineClaimStatus: buildSummaryMeta('NOT_RECEIVED', '', '', ''),
      hasClaimException,
      note: line.latestActionText,
      latestActionText: line.latestActionText,
    },
  ])

  const lineClaimStatus = deriveMaterialClaimStatus([
    {
      materialLineId: line.cutPieceOrderNo,
      materialSku: line.materialSku,
      materialName: line.materialLabel,
      materialCategory: materialCategoryLabel(line),
      materialAttr: line.color || '待补',
      requiredQty,
      configuredQty,
      claimedQty,
      shortageQty: Math.max(requiredQty - claimedQty, 0),
      configuredRollCount: line.configuredRollCount,
      claimedRollCount: line.receivedRollCount,
      auditStatus: createReviewSummary(line.reviewStatus),
      linePrepStatus,
      lineClaimStatus: buildSummaryMeta('NOT_RECEIVED', '', '', ''),
      hasClaimException,
      note: line.latestActionText,
      latestActionText: line.latestActionText,
    },
  ])

  return {
    materialLineId: line.cutPieceOrderNo,
    materialSku: line.materialSku,
    materialName: line.materialLabel,
    materialCategory: materialCategoryLabel(line),
    materialAttr: line.color || '待补',
    requiredQty,
    configuredQty,
    claimedQty,
    shortageQty: Math.max(requiredQty - claimedQty, 0),
    configuredRollCount: line.configuredRollCount,
    claimedRollCount: line.receivedRollCount,
    auditStatus: createReviewSummary(line.reviewStatus),
    linePrepStatus,
    lineClaimStatus,
    hasClaimException,
    note: line.latestActionText,
    latestActionText: line.latestActionText,
  }
}

function buildMaterialSkuSummary(lineItems: MaterialPrepLineItem[]): string {
  const labels = Array.from(new Set(lineItems.map((item) => item.materialSku)))
  return labels.join(' / ')
}

export function summarizeMaterialLineItems(lineItems: MaterialPrepLineItem[]): string {
  if (!lineItems.length) return '暂无面料行项目'
  const required = lineItems.reduce((sum, item) => sum + item.requiredQty, 0)
  const configured = lineItems.reduce((sum, item) => sum + item.configuredQty, 0)
  const claimed = lineItems.reduce((sum, item) => sum + item.claimedQty, 0)
  const shortage = lineItems.reduce((sum, item) => sum + item.shortageQty, 0)
  return `需求 ${formatQty(required)} 米 / 已配置 ${formatQty(configured)} 米 / 已领取 ${formatQty(claimed)} 米 / 缺口 ${formatQty(shortage)} 米`
}

export function buildMaterialPrepNavigationPayload(row: Pick<
  MaterialPrepRow,
  | 'originalCutOrderId'
  | 'originalCutOrderNo'
  | 'productionOrderId'
  | 'productionOrderNo'
  | 'styleCode'
  | 'spuCode'
  | 'materialSkuSummary'
  | 'latestMergeBatchNo'
>): MaterialPrepNavigationPayload {
  return {
    originalOrders: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderNo: row.productionOrderNo,
    },
    markerSpreading: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      mergeBatchNo: row.latestMergeBatchNo || undefined,
      productionOrderNo: row.productionOrderNo,
      tab: 'spreadings',
    },
    summary: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      originalCutOrderNo: row.originalCutOrderNo,
    },
    productionProgress: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    },
    mergeBatches: {
      mergeBatchNo: row.latestMergeBatchNo || undefined,
      originalCutOrderNo: row.originalCutOrderNo,
      originalCutOrderId: row.originalCutOrderId,
    },
  }
}

function summarizeAuditStatus(lineItems: MaterialPrepLineItem[]): MaterialPrepSummaryMeta<CuttingReviewStatus> {
  const total = lineItems.length
  const approvedCount = lineItems.filter((item) => item.auditStatus.key === 'APPROVED').length
  const partialExists = lineItems.some((item) => item.auditStatus.key === 'PARTIAL')
  const pendingExists = lineItems.some((item) => item.auditStatus.key === 'PENDING')

  if (!total) return createReviewSummary('NOT_REQUIRED')
  if (approvedCount === total) return buildSummaryMeta('APPROVED', materialAuditMeta.APPROVED.label, materialAuditMeta.APPROVED.className, `已审核 ${approvedCount}/${total} 项。`)
  if (approvedCount > 0 || partialExists) return buildSummaryMeta('PARTIAL', materialAuditMeta.PARTIAL.label, materialAuditMeta.PARTIAL.className, `已审核 ${approvedCount}/${total} 项，仍有待补齐。`)
  if (pendingExists) return buildSummaryMeta('PENDING', materialAuditMeta.PENDING.label, materialAuditMeta.PENDING.className, `待审核 ${total} 项。`)
  return createReviewSummary('NOT_REQUIRED')
}

function buildRiskTags(
  record: CuttingOrderProgressRecord,
  row: Pick<MaterialPrepRow, 'materialAuditStatus' | 'materialPrepStatus' | 'materialClaimStatus' | 'schedulingStatus' | 'plannedShipDate'>,
): MaterialPrepRiskTag[] {
  const keys = new Set<MaterialPrepRiskKey>()

  if (row.materialAuditStatus.key === 'PENDING' || row.materialAuditStatus.key === 'PARTIAL') keys.add('PENDING_REVIEW')
  if (row.materialPrepStatus.key === 'NOT_CONFIGURED' || row.materialPrepStatus.key === 'PARTIAL') keys.add('PREP_DELAY')
  if (row.materialClaimStatus.key === 'PARTIAL' || row.materialClaimStatus.key === 'EXCEPTION') keys.add('CLAIM_EXCEPTION')
  if (!row.plannedShipDate) keys.add('DATE_MISSING')
  if (record.urgencyLevel === 'AA' || record.urgencyLevel === 'A') keys.add('SHIP_URGENT')
  if (row.materialClaimStatus.key === 'RECEIVED' && row.schedulingStatus.key === 'UNASSIGNED') keys.add('UNASSIGNED')
  if (/已完成/.test(record.cuttingStage) && !record.hasInboundRecord) keys.add('STATUS_CONFLICT')

  return Array.from(keys).map((key) => ({
    key,
    label: materialPrepRiskMeta[key].label,
    className: materialPrepRiskMeta[key].className,
  }))
}

function createRow(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  ledger: MergeBatchRecord[],
): MaterialPrepRow {
  const progressRows = buildProductionProgressRows([record])
  const urgency = urgencyMeta[progressRows[0]?.urgency.key ?? 'UNKNOWN']
  const lineItems = [buildLineItem(record, line)]
  const batchSummary = summarizeMergeBatchParticipation(line.cutPieceOrderNo, ledger)
  const claimRecords = buildInitialClaimRecords(record, lineItems[0], line.cutPieceOrderNo)
  const materialAuditStatus = summarizeAuditStatus(lineItems)
  const materialPrepStatus = deriveMaterialPrepStatus(lineItems)
  const materialClaimStatus = deriveMaterialClaimStatus(lineItems)
  const assignedCuttingGroup = inferAssignedCuttingGroup(record, line)
  const schedulingStatus = deriveSchedulingStatus(assignedCuttingGroup)

  const baseRow: MaterialPrepRow = {
    id: line.cutPieceOrderNo,
    originalCutOrderId: line.cutPieceOrderNo,
    originalCutOrderNo: line.cutPieceOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    styleName: record.styleName,
    color: line.color || '待补',
    materialSkuSummary: buildMaterialSkuSummary(lineItems),
    plannedShipDate: record.plannedShipDate,
    urgencyKey: progressRows[0]?.urgency.key ?? 'UNKNOWN',
    urgencyLabel: urgency.label,
    urgencyClassName: urgency.className,
    sameCodeValue: buildSameCodeValue(line.cutPieceOrderNo),
    qrCodeValue: buildQrCodeValue(line.cutPieceOrderNo),
    qrCodeLabel: '原始裁片单二维码',
    shouldDisplayQr: false,
    shouldDisplayQrLabel: false,
    canViewQr: false,
    shouldPrintQr: false,
    qrHiddenHint: getPrepQrHiddenText('NOT_CONFIGURED'),
    materialAuditStatus,
    materialPrepStatus,
    materialClaimStatus,
    schedulingStatus,
    assignedCuttingGroup,
    currentStage: buildSummaryMeta('WAITING_PREP', '', '', ''),
    riskTags: [],
    materialLineItems: lineItems,
    claimRecords,
    claimRecordCount: claimRecords.length,
    latestClaimRecordAt: claimRecords[0]?.claimedAt || '',
    latestClaimRecordSummary: claimRecords[0]?.summary || '暂无领料记录',
    claimDisputes: [],
    claimDisputeCount: 0,
    latestClaimDispute: null,
    hasClaimDispute: false,
    claimDisputeStatusLabel: '暂无异议',
    claimDisputeSummary: '当前暂无领料数量异议。',
    claimDisputeDiscrepancyText: '差异 0 米',
    claimDisputeEvidenceCount: 0,
    claimDisputeHandleSummary: '待平台处理结果',
    printedAt: line.printSlipStatus === 'PRINTED' ? record.lastFieldUpdateAt || record.lastPickupScanAt || '' : '',
    printedBy: line.printSlipStatus === 'PRINTED' ? `${record.lastOperatorName || '系统'} / 打印回写` : '',
    latestMergeBatchNo: batchSummary.latestMergeBatchNo || line.mergeBatchNo || '',
    mergeBatchNos: batchSummary.mergeBatchNos,
    mergeBatchIds: batchSummary.mergeBatchIds,
    currentStageText: record.cuttingStage || '待补',
    navigationPayload: buildMaterialPrepNavigationPayload({
      originalCutOrderId: line.cutPieceOrderNo,
      originalCutOrderNo: line.cutPieceOrderNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      styleCode: record.styleCode,
      spuCode: record.spuCode,
      materialSkuSummary: line.materialSku,
      latestMergeBatchNo: batchSummary.latestMergeBatchNo || line.mergeBatchNo || '',
    }),
    keywordIndex: buildKeywordIndex([
      line.cutPieceOrderNo,
      record.productionOrderId,
      record.productionOrderNo,
      record.styleCode,
      record.spuCode,
      record.styleName,
      line.materialSku,
      line.materialLabel,
      line.color,
      line.materialCategory,
    ]),
  }

  return recalculateMaterialPrepRow(baseRow, record)
}

export function recalculateMaterialPrepRow(
  row: MaterialPrepRow,
  sourceRecord?: CuttingOrderProgressRecord,
): MaterialPrepRow {
  row.materialLineItems = row.materialLineItems.map((item) => {
    const shortageQty = Math.max(item.requiredQty - item.claimedQty, 0)
    const nextPrepStatus =
      item.configuredQty >= item.requiredQty
        ? buildSummaryMeta('CONFIGURED', materialPrepMeta.CONFIGURED.label, materialPrepMeta.CONFIGURED.className, `已配置 ${formatQty(item.configuredQty)} 米。`)
        : item.configuredQty > 0
          ? buildSummaryMeta('PARTIAL', materialPrepMeta.PARTIAL.label, materialPrepMeta.PARTIAL.className, `已配置 ${formatQty(item.configuredQty)} 米，仍需补齐。`)
          : buildSummaryMeta('NOT_CONFIGURED', materialPrepMeta.NOT_CONFIGURED.label, materialPrepMeta.NOT_CONFIGURED.className, '当前尚未配置。')

    const nextClaimStatus = item.hasClaimException
      ? buildSummaryMeta('EXCEPTION', materialClaimMeta.EXCEPTION.label, materialClaimMeta.EXCEPTION.className, '领料存在差异，需复核。')
      : item.claimedQty >= item.requiredQty
        ? buildSummaryMeta('RECEIVED', materialClaimMeta.RECEIVED.label, materialClaimMeta.RECEIVED.className, `已领取 ${formatQty(item.claimedQty)} 米。`)
        : item.claimedQty > 0
          ? buildSummaryMeta('PARTIAL', materialClaimMeta.PARTIAL.label, materialClaimMeta.PARTIAL.className, `已领取 ${formatQty(item.claimedQty)} 米，仍有余量待补齐。`)
          : buildSummaryMeta('NOT_RECEIVED', materialClaimMeta.NOT_RECEIVED.label, materialClaimMeta.NOT_RECEIVED.className, '当前尚未完成领料。')

    return {
      ...item,
      shortageQty,
      linePrepStatus: nextPrepStatus,
      lineClaimStatus: nextClaimStatus,
    }
  })

  row.materialSkuSummary = buildMaterialSkuSummary(row.materialLineItems)
  row.materialAuditStatus = summarizeAuditStatus(row.materialLineItems)
  row.materialPrepStatus = deriveMaterialPrepStatus(row.materialLineItems)
  row.materialClaimStatus = deriveMaterialClaimStatus(row.materialLineItems)
  row.schedulingStatus = deriveSchedulingStatus(row.assignedCuttingGroup)
  row.shouldDisplayQr = shouldDisplayQrByPrepStatus(row.materialPrepStatus.key)
  row.shouldDisplayQrLabel = shouldDisplayQrLabelByPrepStatus(row.materialPrepStatus.key)
  row.canViewQr = canViewPrepQr(row.materialPrepStatus.key)
  row.shouldPrintQr = shouldPrintPrepQr(row.materialPrepStatus.key)
  row.qrHiddenHint = getPrepQrHiddenText(row.materialPrepStatus.key)
  row.claimRecordCount = row.claimRecords.length
  row.latestClaimRecordAt = row.claimRecords[0]?.claimedAt || ''
  row.latestClaimRecordSummary = row.claimRecords[0]?.summary || '暂无领料记录'
  row.claimDisputes = listClaimDisputesByOriginalCutOrderNo(row.originalCutOrderNo)
  row.claimDisputeCount = row.claimDisputes.length
  row.latestClaimDispute = getLatestClaimDisputeByOriginalCutOrderNo(row.originalCutOrderNo)
  row.hasClaimDispute = Boolean(row.latestClaimDispute)
  row.claimDisputeStatusLabel = row.latestClaimDispute ? getClaimDisputeStatusLabel(row.latestClaimDispute.status) : '暂无异议'
  row.claimDisputeSummary = row.latestClaimDispute ? buildCraftClaimDisputeSummary(row.latestClaimDispute) : '当前暂无领料数量异议。'
  row.claimDisputeDiscrepancyText = row.latestClaimDispute ? `差异 ${formatDisputeQty(row.latestClaimDispute.discrepancyQty)}` : '差异 0 米'
  row.claimDisputeEvidenceCount = row.latestClaimDispute?.evidenceCount ?? 0
  row.claimDisputeHandleSummary = row.latestClaimDispute
    ? row.latestClaimDispute.handleConclusion || row.latestClaimDispute.handleNote || '待平台处理结果'
    : '待平台处理结果'

  const fallbackRecord: CuttingOrderProgressRecord = sourceRecord || {
    id: row.productionOrderId,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    actualOrderDate: '',
    purchaseDate: '',
    orderQty: 0,
    plannedShipDate: row.plannedShipDate,
    spuCode: row.spuCode,
    styleCode: row.styleCode,
    styleName: row.styleName,
    urgencyLevel: row.urgencyKey === 'UNKNOWN' ? 'D' : row.urgencyKey,
    cuttingTaskNo: '',
    assignedFactoryName: '',
    cuttingStage: row.currentStageText,
    riskFlags: [],
    lastPickupScanAt: row.latestClaimRecordAt,
    lastFieldUpdateAt: row.printedAt || row.latestClaimRecordAt,
    lastOperatorName: row.printedBy,
    hasSpreadingRecord: row.currentStage.key === 'CUTTING',
    hasInboundRecord: row.currentStage.key === 'DONE',
    materialLines: [],
  }

  row.currentStage = deriveCurrentStage(fallbackRecord, row)
  row.riskTags = buildRiskTags(fallbackRecord, row)
  return row
}

export function buildMaterialPrepViewModel(
  records: CuttingOrderProgressRecord[],
  ledger: MergeBatchRecord[] = [],
): MaterialPrepViewModel {
  const rows = records
    .flatMap((record) => record.materialLines.map((line) => createRow(record, line, ledger)))
    .sort((left, right) => {
      const leftWeight = urgencyMeta[left.urgencyKey].sortWeight
      const rightWeight = urgencyMeta[right.urgencyKey].sortWeight
      return (
        rightWeight - leftWeight ||
        left.plannedShipDate.localeCompare(right.plannedShipDate, 'zh-CN') ||
        left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN') ||
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
      )
    })

  return {
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
  }
}

function matchesText(row: MaterialPrepRow, search: string): boolean {
  const keyword = search.trim().toLowerCase()
  return row.keywordIndex.some((value) => value.includes(keyword))
}

function applyPrefilter(rows: MaterialPrepRow[], prefilter: MaterialPrepPrefilter | null): MaterialPrepRow[] {
  if (!prefilter) return rows
  return rows.filter((row) => {
    if (prefilter.productionOrderId && row.productionOrderId !== prefilter.productionOrderId) return false
    if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter.originalCutOrderId && row.originalCutOrderId !== prefilter.originalCutOrderId) return false
    if (prefilter.originalCutOrderNo && row.originalCutOrderNo !== prefilter.originalCutOrderNo) return false
    if (prefilter.styleCode && row.styleCode !== prefilter.styleCode) return false
    if (prefilter.spuCode && row.spuCode !== prefilter.spuCode) return false
    if (prefilter.materialSku && !row.materialLineItems.some((item) => item.materialSku === prefilter.materialSku)) return false
    if (prefilter.schedulingStatus && row.schedulingStatus.key !== prefilter.schedulingStatus) return false
    if (prefilter.materialPrepStatus && row.materialPrepStatus.key !== prefilter.materialPrepStatus) return false
    if (prefilter.materialClaimStatus && row.materialClaimStatus.key !== prefilter.materialClaimStatus) return false
    return true
  })
}

export function filterMaterialPrepRows(
  rows: MaterialPrepRow[],
  filters: MaterialPrepFilters,
  prefilter: MaterialPrepPrefilter | null,
): MaterialPrepRow[] {
  return applyPrefilter(rows, prefilter).filter((row) => {
    if (filters.keyword && !matchesText(row, filters.keyword)) return false
    if (filters.productionOrderNo && !row.productionOrderNo.includes(filters.productionOrderNo.trim())) return false
    if (filters.styleKeyword) {
      const keyword = filters.styleKeyword.trim().toLowerCase()
      if (![row.styleCode, row.spuCode, row.styleName].some((value) => value.toLowerCase().includes(keyword))) return false
    }
    if (filters.materialSku) {
      const keyword = filters.materialSku.trim().toLowerCase()
      const matched = row.materialLineItems.some((item) =>
        [item.materialSku, item.materialCategory, item.materialName, item.materialAttr].some((value) =>
          value.toLowerCase().includes(keyword),
        ),
      )
      if (!matched) return false
    }
    if (filters.materialPrepStatus !== 'ALL' && row.materialPrepStatus.key !== filters.materialPrepStatus) return false
    if (filters.materialClaimStatus !== 'ALL' && row.materialClaimStatus.key !== filters.materialClaimStatus) return false
    if (filters.materialAuditStatus !== 'ALL' && row.materialAuditStatus.key !== filters.materialAuditStatus) return false
    if (filters.schedulingStatus !== 'ALL' && row.schedulingStatus.key !== filters.schedulingStatus) return false
    if (filters.cuttingGroup && !row.assignedCuttingGroup.toLowerCase().includes(filters.cuttingGroup.trim().toLowerCase())) return false
    if (filters.issuesOnly && !row.riskTags.length) return false
    if (filters.onlyPrintable && !row.shouldPrintQr) return false
    if (filters.onlyPendingScheduling && row.schedulingStatus.key !== 'UNASSIGNED') return false
    return true
  })
}

export function buildMaterialPrepStats(rows: MaterialPrepRow[]): MaterialPrepStats {
  return {
    totalCount: rows.length,
    configuredCount: rows.filter((row) => row.materialPrepStatus.key === 'CONFIGURED').length,
    partialConfigCount: rows.filter((row) => row.materialPrepStatus.key === 'PARTIAL').length,
    waitingClaimCount: rows.filter((row) => row.materialClaimStatus.key === 'NOT_RECEIVED').length,
    claimSuccessCount: rows.filter((row) => row.materialClaimStatus.key === 'RECEIVED').length,
    claimExceptionCount: rows.filter((row) => row.materialClaimStatus.key === 'EXCEPTION' || row.riskTags.some((tag) => tag.key === 'CLAIM_EXCEPTION')).length,
    pendingSchedulingCount: rows.filter((row) => row.schedulingStatus.key === 'UNASSIGNED').length,
    assignedCount: rows.filter((row) => row.schedulingStatus.key === 'ASSIGNED').length,
  }
}

export function findMaterialPrepRowByPrefilter(
  rows: MaterialPrepRow[],
  prefilter: MaterialPrepPrefilter | null,
): MaterialPrepRow | null {
  if (!prefilter) return null
  return (
    rows.find((row) => {
      if (prefilter.originalCutOrderId) return row.originalCutOrderId === prefilter.originalCutOrderId
      if (prefilter.originalCutOrderNo) return row.originalCutOrderNo === prefilter.originalCutOrderNo
      return false
    }) ?? null
  )
}

export function buildIssueListPrintPayload(row: MaterialPrepRow): IssueListPrintPayload {
  return {
    title: '发料清单',
    printTime: new Date().toLocaleString('zh-CN', { hour12: false }),
    originalCutOrderNo: row.originalCutOrderNo,
    sameCodeValue: row.sameCodeValue,
    qrCodeValue: row.qrCodeValue,
    qrCodeLabel: row.qrCodeLabel,
    shouldPrintQr: row.shouldPrintQr,
    qrHiddenHint: getPrepQrHiddenText(row.materialPrepStatus.key, 'print'),
    productionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    styleName: row.styleName,
    materialLineItems: row.materialLineItems.map((item) => ({
      materialSku: item.materialSku,
      materialCategory: item.materialCategory,
      requiredQty: item.requiredQty,
      configuredQty: item.configuredQty,
      claimedQty: item.claimedQty,
      shortageQty: item.shortageQty,
    })),
  }
}
