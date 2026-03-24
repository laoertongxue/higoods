import type { MergeBatchRecord } from './merge-batches-model'
import type { MarkerRecord, MarkerSpreadingStore, SpreadingSession } from './marker-spreading-model'
import { buildReplenishmentPreview, buildSpreadingVarianceSummary } from './marker-spreading-model'
import type { MaterialPrepRow } from './material-prep-model'
import type { OriginalCutOrderRow } from './original-orders-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export const CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY = 'cuttingReplenishmentReviews'
export const CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY = 'cuttingReplenishmentImpactPlans'
export const CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY = 'cuttingReplenishmentAuditTrail'

export type ReplenishmentSourceType = 'original-order' | 'merge-batch' | 'spreading-session'
export type ReplenishmentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ReplenishmentStatusKey =
  | 'NO_ACTION'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_SUPPLEMENT'
  | 'APPLIED'
export type ReplenishmentReviewStatus = 'APPROVED' | 'REJECTED' | 'PENDING_SUPPLEMENT'
export type ReplenishmentAuditAction =
  | 'SUGGESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'MARKED_SUPPLEMENT'
  | 'IMPACT_UPDATED'
  | 'MARKED_APPLIED'

export interface ReplenishmentSuggestion {
  suggestionId: string
  suggestionNo: string
  sourceType: ReplenishmentSourceType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSku: string
  materialCategory: string
  materialAttr: string
  requiredQty: number
  estimatedCapacityQty: number
  shortageQty: number
  configuredLengthTotal: number
  usableLengthTotal: number
  varianceLength: number
  suggestedAction: string
  riskLevel: ReplenishmentRiskLevel
  createdAt: string
  status: ReplenishmentStatusKey
  note: string
}

export interface ReplenishmentReview {
  reviewId: string
  suggestionId: string
  reviewStatus: ReplenishmentReviewStatus
  reviewedBy: string
  reviewedAt: string
  decisionReason: string
  note: string
}

export interface ReplenishmentImpactPlan {
  impactPlanId: string
  suggestionId: string
  needReconfigureMaterial: boolean
  needReclaimMaterial: boolean
  affectPrintingOrder: boolean
  affectDyeingOrder: boolean
  affectSpecialProcess: boolean
  impactSummary: string
  applied: boolean
  appliedAt: string
  appliedBy: string
}

export interface ReplenishmentAuditTrail {
  auditTrailId: string
  suggestionId: string
  action: ReplenishmentAuditAction
  actionAt: string
  actionBy: string
  payloadSummary: string
  note: string
}

export interface ReplenishmentStatusMeta {
  key: ReplenishmentStatusKey
  label: string
  className: string
  detailText: string
}

export interface ReplenishmentRiskMeta {
  key: ReplenishmentRiskLevel
  label: string
  className: string
  detailText: string
}

export interface ReplenishmentSuggestionRow extends ReplenishmentSuggestion {
  sourceLabel: string
  sourceSummary: string
  differenceSummary: string
  impactSummary: string
  review: ReplenishmentReview | null
  impactPlan: ReplenishmentImpactPlan
  statusMeta: ReplenishmentStatusMeta
  riskMeta: ReplenishmentRiskMeta
  navigationPayload: ReplenishmentNavigationPayload
  keywordIndex: string[]
}

export interface ReplenishmentViewModel {
  rows: ReplenishmentSuggestionRow[]
  rowsById: Record<string, ReplenishmentSuggestionRow>
  stats: ReplenishmentStats
}

export interface ReplenishmentStats {
  totalCount: number
  pendingReviewCount: number
  approvedCount: number
  rejectedCount: number
  pendingApplyCount: number
  highRiskCount: number
}

export interface ReplenishmentFilters {
  keyword: string
  sourceType: 'ALL' | ReplenishmentSourceType
  status: 'ALL' | ReplenishmentStatusKey
  riskLevel: 'ALL' | ReplenishmentRiskLevel
  craftImpact: 'ALL' | 'PRINTING' | 'DYEING'
  pendingReviewOnly: boolean
  pendingApplyOnly: boolean
}

export interface ReplenishmentPrefilter {
  originalCutOrderNo?: string
  originalCutOrderId?: string
  mergeBatchNo?: string
  mergeBatchId?: string
  productionOrderNo?: string
  materialSku?: string
  riskLevel?: ReplenishmentRiskLevel
  replenishmentStatus?: ReplenishmentStatusKey
}

export interface ReplenishmentNavigationPayload {
  markerSpreading: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  summary: Record<string, string | undefined>
  printing: Record<string, string | undefined>
  dyeing: Record<string, string | undefined>
}

export interface ReplenishmentSuggestionBuildContext {
  sourceType: ReplenishmentSourceType
  mergeBatchId: string
  mergeBatchNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
  allocationRatio: number
}

export const replenishmentSourceMeta: Record<ReplenishmentSourceType, { label: string; className: string }> = {
  'original-order': { label: '原始裁片单', className: 'bg-slate-100 text-slate-700' },
  'merge-batch': { label: '合并裁剪批次', className: 'bg-violet-100 text-violet-700' },
  'spreading-session': { label: '铺布记录', className: 'bg-sky-100 text-sky-700' },
}

export const replenishmentStatusMetaMap: Record<ReplenishmentStatusKey, ReplenishmentStatusMeta> = {
  NO_ACTION: {
    key: 'NO_ACTION',
    label: '无需补料',
    className: 'bg-emerald-100 text-emerald-700',
    detailText: '当前差异未识别明显缺口，继续观察即可。',
  },
  PENDING_REVIEW: {
    key: 'PENDING_REVIEW',
    label: '待审核',
    className: 'bg-amber-100 text-amber-700',
    detailText: '已生成补料建议，但仍需人工审核后才能生效。',
  },
  APPROVED: {
    key: 'APPROVED',
    label: '审核通过',
    className: 'bg-blue-100 text-blue-700',
    detailText: '补料建议已通过审核，等待回写到后续配料 / 领料链路。',
  },
  REJECTED: {
    key: 'REJECTED',
    label: '审核驳回',
    className: 'bg-slate-200 text-slate-700',
    detailText: '补料建议被驳回，当前不进入后续回写。',
  },
  PENDING_SUPPLEMENT: {
    key: 'PENDING_SUPPLEMENT',
    label: '待补录',
    className: 'bg-orange-100 text-orange-700',
    detailText: '差异依据仍不完整，需要补录铺布或领料信息。',
  },
  APPLIED: {
    key: 'APPLIED',
    label: '已回写',
    className: 'bg-fuchsia-100 text-fuchsia-700',
    detailText: '补料影响计划已确认并标记回写。',
  },
}

export const replenishmentRiskMetaMap: Record<ReplenishmentRiskLevel, ReplenishmentRiskMeta> = {
  HIGH: {
    key: 'HIGH',
    label: '高风险',
    className: 'bg-rose-100 text-rose-700',
    detailText: '当前缺口较大或会直接影响后续工艺，需优先处理。',
  },
  MEDIUM: {
    key: 'MEDIUM',
    label: '中风险',
    className: 'bg-orange-100 text-orange-700',
    detailText: '当前存在可见差异，建议结合现场再确认是否补料。',
  },
  LOW: {
    key: 'LOW',
    label: '低风险',
    className: 'bg-sky-100 text-sky-700',
    detailText: '当前无明显缺口或仅需继续观察。',
  },
}

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatDateToken(value: string): string {
  const matched = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!matched) return '00000000'
  return `${matched[1]}${matched[2]}${matched[3]}`
}

function getContextRowsByMergeBatch(batch: MergeBatchRecord, rowsById: Record<string, MaterialPrepRow>): MaterialPrepRow[] {
  return batch.items
    .map((item) => rowsById[item.originalCutOrderId] || rowsById[item.originalCutOrderNo])
    .filter((row): row is MaterialPrepRow => Boolean(row))
}

function findRelevantSession(context: ReplenishmentSuggestionBuildContext, store: MarkerSpreadingStore): SpreadingSession | null {
  const matched = store.sessions
    .filter((session) => {
      if (context.mergeBatchId) return session.contextType === 'merge-batch' && session.mergeBatchId === context.mergeBatchId
      return session.contextType === 'original-order' && session.originalCutOrderIds[0] === context.originalCutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  return matched[0] || null
}

function findRelevantMarker(context: ReplenishmentSuggestionBuildContext, store: MarkerSpreadingStore): MarkerRecord | null {
  const matched = store.markers
    .filter((marker) => {
      if (context.mergeBatchId) return marker.contextType === 'merge-batch' && marker.mergeBatchId === context.mergeBatchId
      return marker.contextType === 'original-order' && marker.originalCutOrderIds[0] === context.originalCutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  return matched[0] || null
}

function buildContextForSuggestion(
  row: MaterialPrepRow,
  rowsById: Record<string, MaterialPrepRow>,
  originalRowsById: Record<string, OriginalCutOrderRow>,
  mergeBatches: MergeBatchRecord[],
): ReplenishmentSuggestionBuildContext {
  const mergeBatch =
    (row.mergeBatchIds[0] && mergeBatches.find((batch) => batch.mergeBatchId === row.mergeBatchIds[0])) ||
    (row.latestMergeBatchNo && mergeBatches.find((batch) => batch.mergeBatchNo === row.latestMergeBatchNo)) ||
    null

  if (mergeBatch) {
    const batchRows = getContextRowsByMergeBatch(mergeBatch, rowsById)
    const totalRequiredQty = batchRows.reduce(
      (sum, item) => sum + (originalRowsById[item.originalCutOrderId]?.plannedQty || originalRowsById[item.originalCutOrderId]?.orderQty || 0),
      0,
    )
    const selfRequiredQty = originalRowsById[row.originalCutOrderId]?.plannedQty || originalRowsById[row.originalCutOrderId]?.orderQty || 0
    return {
      sourceType: 'merge-batch',
      mergeBatchId: mergeBatch.mergeBatchId,
      mergeBatchNo: mergeBatch.mergeBatchNo,
      originalCutOrderIds: batchRows.map((item) => item.originalCutOrderId),
      originalCutOrderNos: batchRows.map((item) => item.originalCutOrderNo),
      productionOrderNos: uniqueStrings(batchRows.map((item) => item.productionOrderNo)),
      styleCode: mergeBatch.styleCode || row.styleCode,
      spuCode: mergeBatch.spuCode || row.spuCode,
      styleName: mergeBatch.styleName || row.styleName,
      materialRows: batchRows,
      allocationRatio: totalRequiredQty > 0 ? Math.max(selfRequiredQty / totalRequiredQty, 0.1) : 1,
    }
  }

  return {
    sourceType: 'original-order',
    mergeBatchId: '',
    mergeBatchNo: row.latestMergeBatchNo || '',
    originalCutOrderIds: [row.originalCutOrderId],
    originalCutOrderNos: [row.originalCutOrderNo],
    productionOrderNos: [row.productionOrderNo],
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    styleName: row.styleName,
    materialRows: [row],
    allocationRatio: 1,
  }
}

function deriveEstimatedCapacityQty(options: {
  requiredQty: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  shortageLengthTotal: number
  varianceSummary: ReturnType<typeof buildSpreadingVarianceSummary>
  allocationRatio: number
}): number {
  if (options.varianceSummary) {
    const allocated = Math.floor(options.varianceSummary.estimatedPieceCapacity * options.allocationRatio)
    return Math.max(allocated, 0)
  }

  if (options.requiredQty <= 0) return 0
  const fulfilled = Math.max(options.configuredLengthTotal + options.claimedLengthTotal - options.shortageLengthTotal, 0)
  const baseline = Math.max(options.configuredLengthTotal, options.claimedLengthTotal, options.shortageLengthTotal, 1)
  const ratio = Math.max(Math.min(fulfilled / baseline, 1), 0)
  return Math.floor(options.requiredQty * ratio)
}

function buildSuggestionNo(createdAt: string, index: number): string {
  return `BL-${formatDateToken(createdAt)}-${String(index + 1).padStart(3, '0')}`
}

export function deriveReplenishmentRiskLevel(options: {
  shortageQty: number
  requiredQty: number
  varianceLength: number
  missingData: boolean
  materialSku: string
}): ReplenishmentRiskLevel {
  if (options.missingData) return 'MEDIUM'
  if (options.shortageQty >= Math.max(Math.ceil(options.requiredQty * 0.08), 5)) return 'HIGH'
  if (options.varianceLength < -20) return 'HIGH'
  if (options.shortageQty > 0 || options.varianceLength < 0) return 'MEDIUM'
  return 'LOW'
}

export function buildReplenishmentSuggestionFromSpreading(options: {
  index: number
  row: MaterialPrepRow
  originalRow: OriginalCutOrderRow | undefined
  context: ReplenishmentSuggestionBuildContext
  marker: MarkerRecord | null
  session: SpreadingSession | null
}): ReplenishmentSuggestion {
  const requiredQty = options.marker?.totalPieces || options.originalRow?.plannedQty || options.originalRow?.orderQty || 0
  const configuredLengthTotal = options.row.materialLineItems.reduce((sum, item) => sum + item.configuredQty, 0)
  const claimedLengthTotal = options.row.materialLineItems.reduce((sum, item) => sum + item.claimedQty, 0)
  const shortageLengthTotal = options.row.materialLineItems.reduce((sum, item) => sum + item.shortageQty, 0)
  const varianceSummary = buildSpreadingVarianceSummary(
    {
      contextType: options.context.mergeBatchId ? 'merge-batch' : 'original-order',
      originalCutOrderIds: options.context.originalCutOrderIds,
      originalCutOrderNos: options.context.originalCutOrderNos,
      mergeBatchId: options.context.mergeBatchId,
      mergeBatchNo: options.context.mergeBatchNo,
      productionOrderNos: options.context.productionOrderNos,
      styleCode: options.context.styleCode,
      spuCode: options.context.spuCode,
      styleName: options.context.styleName,
      materialSkuSummary: uniqueStrings(options.context.materialRows.map((item) => item.materialSkuSummary)).join(' / '),
      materialPrepRows: options.context.materialRows,
    },
    options.marker,
    options.session,
  )
  const preview = buildReplenishmentPreview(varianceSummary)
  const estimatedCapacityQty = deriveEstimatedCapacityQty({
    requiredQty,
    configuredLengthTotal,
    claimedLengthTotal,
    shortageLengthTotal,
    varianceSummary,
    allocationRatio: options.context.allocationRatio,
  })
  const shortageQty = Math.max(requiredQty - estimatedCapacityQty, 0)
  const usableLengthTotal = varianceSummary
    ? Number((varianceSummary.usableLengthTotal * options.context.allocationRatio).toFixed(2))
    : 0
  const varianceLength = varianceSummary
    ? Number((varianceSummary.varianceLength * options.context.allocationRatio).toFixed(2))
    : Number((claimedLengthTotal - configuredLengthTotal).toFixed(2))
  const missingData = !options.session || !options.marker || preview.level === 'MISSING'
  const riskLevel = deriveReplenishmentRiskLevel({
    shortageQty,
    requiredQty,
    varianceLength,
    missingData,
    materialSku: options.row.materialSkuSummary,
  })

  let status: ReplenishmentStatusKey = 'NO_ACTION'
  let suggestedAction = '当前无明显缺口，建议继续观察。'
  if (missingData) {
    status = 'PENDING_SUPPLEMENT'
    suggestedAction = '先补录唛架或铺布数据，再确认是否进入补料审核。'
  } else if (shortageQty > 0 || varianceLength < 0) {
    status = 'PENDING_REVIEW'
    suggestedAction = `建议补料 ${formatQty(shortageQty)} 件对应长度，并回到仓库配料 / 领料链路复核。`
  }

  const createdAt = options.session?.updatedAt || options.marker?.updatedAt || options.row.latestClaimRecordAt || nowText()
  const sourceType = options.session ? 'spreading-session' : options.context.sourceType

  return {
    suggestionId: `rep-${sourceType}-${options.row.originalCutOrderId}`,
    suggestionNo: buildSuggestionNo(createdAt, options.index),
    sourceType,
    originalCutOrderIds: options.context.originalCutOrderIds,
    originalCutOrderNos: options.context.originalCutOrderNos,
    mergeBatchId: options.context.mergeBatchId,
    mergeBatchNo: options.context.mergeBatchNo,
    productionOrderNos: options.context.productionOrderNos,
    styleCode: options.row.styleCode,
    spuCode: options.row.spuCode,
    styleName: options.row.styleName,
    materialSku: options.row.materialLineItems[0]?.materialSku || options.row.materialSkuSummary,
    materialCategory: options.row.materialLineItems[0]?.materialCategory || '待补',
    materialAttr: options.row.materialLineItems[0]?.materialAttr || options.row.color,
    requiredQty,
    estimatedCapacityQty,
    shortageQty,
    configuredLengthTotal,
    usableLengthTotal,
    varianceLength,
    suggestedAction,
    riskLevel,
    createdAt,
    status,
    note: preview.detailText,
  }
}

export function validateReplenishmentReviewAction(options: {
  suggestion: ReplenishmentSuggestionRow
  reviewStatus: ReplenishmentReviewStatus
  decisionReason: string
}): { ok: boolean; message: string } {
  const reason = options.decisionReason.trim()
  if (options.suggestion.statusMeta.key === 'NO_ACTION' && options.reviewStatus === 'APPROVED') {
    return { ok: false, message: '当前建议为“无需补料”，不能直接审核通过。' }
  }
  if ((options.reviewStatus === 'REJECTED' || options.reviewStatus === 'PENDING_SUPPLEMENT') && !reason) {
    return { ok: false, message: '驳回或标记待补录时必须填写原因。' }
  }
  return { ok: true, message: '' }
}

export function buildReplenishmentImpactPlan(suggestion: ReplenishmentSuggestion): ReplenishmentImpactPlan {
  const affectPrintingOrder = suggestion.materialCategory.includes('印花') || suggestion.materialSku.includes('PRINT')
  const affectDyeingOrder = suggestion.materialCategory.includes('染色') || suggestion.materialSku.includes('DYE')
  const needReconfigureMaterial = suggestion.shortageQty > 0 || suggestion.varianceLength < 0
  const needReclaimMaterial = suggestion.shortageQty > 0 && suggestion.usableLengthTotal < suggestion.configuredLengthTotal
  const affectSpecialProcess = suggestion.mergeBatchNo.length > 0 || suggestion.shortageQty >= 8
  const summaries = [
    needReconfigureMaterial ? '需重新配料' : '',
    needReclaimMaterial ? '需重新领料' : '',
    affectPrintingOrder ? '影响印花工单' : '',
    affectDyeingOrder ? '影响染色工单' : '',
    affectSpecialProcess ? '需同步特殊工艺关注' : '',
  ].filter(Boolean)

  return {
    impactPlanId: `impact-${suggestion.suggestionId}`,
    suggestionId: suggestion.suggestionId,
    needReconfigureMaterial,
    needReclaimMaterial,
    affectPrintingOrder,
    affectDyeingOrder,
    affectSpecialProcess,
    impactSummary: summaries.join(' / ') || '当前无需额外回写动作。',
    applied: false,
    appliedAt: '',
    appliedBy: '',
  }
}

export function deriveReplenishmentStatus(options: {
  suggestion: ReplenishmentSuggestion
  review: ReplenishmentReview | null
  impactPlan: ReplenishmentImpactPlan
}): ReplenishmentStatusMeta {
  if (options.impactPlan.applied) return replenishmentStatusMetaMap.APPLIED
  if (options.review?.reviewStatus === 'APPROVED') return replenishmentStatusMetaMap.APPROVED
  if (options.review?.reviewStatus === 'REJECTED') return replenishmentStatusMetaMap.REJECTED
  if (options.review?.reviewStatus === 'PENDING_SUPPLEMENT') return replenishmentStatusMetaMap.PENDING_SUPPLEMENT
  return replenishmentStatusMetaMap[options.suggestion.status]
}

export function buildReplenishmentNavigationPayload(
  suggestion: Pick<ReplenishmentSuggestion, 'originalCutOrderNos' | 'mergeBatchNo' | 'productionOrderNos' | 'materialSku'>,
): ReplenishmentNavigationPayload {
  const originalCutOrderNo = suggestion.originalCutOrderNos[0] || undefined
  const productionOrderNo = suggestion.productionOrderNos[0] || undefined
  const mergeBatchNo = suggestion.mergeBatchNo || undefined
  const materialSku = suggestion.materialSku || undefined

  return {
    markerSpreading: { originalCutOrderNo, mergeBatchNo, productionOrderNo, materialSku },
    materialPrep: { originalCutOrderNo, productionOrderNo, materialSku },
    originalOrders: { originalCutOrderNo, productionOrderNo, mergeBatchNo, materialSku },
    mergeBatches: { mergeBatchNo, originalCutOrderNo },
    summary: { originalCutOrderNo, mergeBatchNo, productionOrderNo, materialSku },
    printing: { originalCutOrderNo, mergeBatchNo, materialSku },
    dyeing: { originalCutOrderNo, mergeBatchNo, materialSku },
  }
}

export function buildReplenishmentAuditTrail(options: {
  suggestion: ReplenishmentSuggestion
  action: ReplenishmentAuditAction
  actionBy: string
  payloadSummary: string
  note?: string
  actionAt?: string
}): ReplenishmentAuditTrail {
  return {
    auditTrailId: `audit-${options.suggestion.suggestionId}-${options.action}-${Date.now()}`,
    suggestionId: options.suggestion.suggestionId,
    action: options.action,
    actionAt: options.actionAt || nowText(),
    actionBy: options.actionBy,
    payloadSummary: options.payloadSummary,
    note: options.note || '',
  }
}

export function serializeReplenishmentReviewsStorage(records: ReplenishmentReview[]): string {
  return JSON.stringify(records)
}

export function deserializeReplenishmentReviewsStorage(raw: string | null): ReplenishmentReview[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializeReplenishmentImpactPlansStorage(records: ReplenishmentImpactPlan[]): string {
  return JSON.stringify(records)
}

export function deserializeReplenishmentImpactPlansStorage(raw: string | null): ReplenishmentImpactPlan[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializeReplenishmentAuditTrailStorage(records: ReplenishmentAuditTrail[]): string {
  return JSON.stringify(records)
}

export function deserializeReplenishmentAuditTrailStorage(raw: string | null): ReplenishmentAuditTrail[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function buildReplenishmentViewModel(options: {
  materialPrepRows: MaterialPrepRow[]
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
}): ReplenishmentViewModel {
  const rowsById = Object.fromEntries(options.materialPrepRows.map((row) => [row.originalCutOrderId, row]))
  const originalRowsById = Object.fromEntries(options.originalRows.map((row) => [row.originalCutOrderId, row]))
  const reviewsBySuggestionId = Object.fromEntries(options.reviews.map((review) => [review.suggestionId, review]))
  const impactsBySuggestionId = Object.fromEntries(options.impactPlans.map((plan) => [plan.suggestionId, plan]))

  const rows = options.materialPrepRows.map((row, index) => {
    const originalRow = originalRowsById[row.originalCutOrderId]
    const context = buildContextForSuggestion(row, rowsById, originalRowsById, options.mergeBatches)
    const marker = findRelevantMarker(context, options.markerStore)
    const session = findRelevantSession(context, options.markerStore)
    const suggestion = buildReplenishmentSuggestionFromSpreading({
      index,
      row,
      originalRow,
      context,
      marker,
      session,
    })
    const review = reviewsBySuggestionId[suggestion.suggestionId] || null
    const impactPlan = impactsBySuggestionId[suggestion.suggestionId] || buildReplenishmentImpactPlan(suggestion)
    const statusMeta = deriveReplenishmentStatus({ suggestion, review, impactPlan })
    const riskMeta = replenishmentRiskMetaMap[suggestion.riskLevel]
    const sourceLabel = replenishmentSourceMeta[suggestion.sourceType].label
    const sourceSummary = suggestion.sourceType === 'merge-batch'
      ? `来自批次 ${suggestion.mergeBatchNo || '待补批次号'}，回落 ${suggestion.originalCutOrderNos.length} 个原始裁片单。`
      : suggestion.sourceType === 'spreading-session'
        ? `来源于铺布记录，当前回落到原始裁片单 ${suggestion.originalCutOrderNos[0] || '待补'}。`
        : `来源于原始裁片单 ${suggestion.originalCutOrderNos[0] || '待补'}。`

    const differenceSummary = [
      `需求 ${formatQty(suggestion.requiredQty)} 件`,
      `预计可裁 ${formatQty(suggestion.estimatedCapacityQty)} 件`,
      `缺口 ${formatQty(suggestion.shortageQty)} 件`,
      `长度差 ${numberFormatter.format(suggestion.varianceLength)} 米`,
    ].join(' / ')

    return {
      ...suggestion,
      sourceLabel,
      sourceSummary,
      differenceSummary,
      impactSummary: impactPlan.impactSummary,
      review,
      impactPlan,
      statusMeta,
      riskMeta,
      navigationPayload: buildReplenishmentNavigationPayload(suggestion),
      keywordIndex: [
        suggestion.suggestionNo,
        suggestion.originalCutOrderNos.join(' '),
        suggestion.mergeBatchNo,
        suggestion.productionOrderNos.join(' '),
        suggestion.materialSku,
        suggestion.styleCode,
        suggestion.spuCode,
      ]
        .filter(Boolean)
        .map((item) => item.toLowerCase()),
    }
  })

  const rowsBySuggestionId = Object.fromEntries(rows.map((row) => [row.suggestionId, row]))

  return {
    rows,
    rowsById: rowsBySuggestionId,
    stats: {
      totalCount: rows.length,
      pendingReviewCount: rows.filter((row) => row.statusMeta.key === 'PENDING_REVIEW' || row.statusMeta.key === 'PENDING_SUPPLEMENT').length,
      approvedCount: rows.filter((row) => row.statusMeta.key === 'APPROVED').length,
      rejectedCount: rows.filter((row) => row.statusMeta.key === 'REJECTED').length,
      pendingApplyCount: rows.filter((row) => row.statusMeta.key === 'APPROVED' && !row.impactPlan.applied).length,
      highRiskCount: rows.filter((row) => row.riskLevel === 'HIGH').length,
    },
  }
}

export function filterReplenishmentRows(
  rows: ReplenishmentSuggestionRow[],
  filters: ReplenishmentFilters,
  prefilter: ReplenishmentPrefilter | null,
): ReplenishmentSuggestionRow[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (prefilter?.originalCutOrderNo && !row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter?.originalCutOrderId && !row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return false
    if (prefilter?.mergeBatchNo && row.mergeBatchNo !== prefilter.mergeBatchNo) return false
    if (prefilter?.mergeBatchId && row.mergeBatchId !== prefilter.mergeBatchId) return false
    if (prefilter?.productionOrderNo && !row.productionOrderNos.includes(prefilter.productionOrderNo)) return false
    if (prefilter?.materialSku && row.materialSku !== prefilter.materialSku) return false
    if (prefilter?.riskLevel && row.riskLevel !== prefilter.riskLevel) return false
    if (prefilter?.replenishmentStatus && row.statusMeta.key !== prefilter.replenishmentStatus) return false

    if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false
    if (filters.sourceType !== 'ALL' && row.sourceType !== filters.sourceType) return false
    if (filters.status !== 'ALL' && row.statusMeta.key !== filters.status) return false
    if (filters.riskLevel !== 'ALL' && row.riskLevel !== filters.riskLevel) return false
    if (filters.pendingReviewOnly && !['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(row.statusMeta.key)) return false
    if (filters.pendingApplyOnly && !(row.statusMeta.key === 'APPROVED' && !row.impactPlan.applied)) return false
    if (filters.craftImpact === 'PRINTING' && !row.impactPlan.affectPrintingOrder) return false
    if (filters.craftImpact === 'DYEING' && !row.impactPlan.affectDyeingOrder) return false
    return true
  })
}

export function findReplenishmentByPrefilter(
  rows: ReplenishmentSuggestionRow[],
  prefilter: ReplenishmentPrefilter | null,
): ReplenishmentSuggestionRow | null {
  if (!prefilter) return null
  return (
    rows.find((row) => {
      if (prefilter.originalCutOrderNo && row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return true
      if (prefilter.originalCutOrderId && row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return true
      if (prefilter.mergeBatchNo && row.mergeBatchNo === prefilter.mergeBatchNo) return true
      if (prefilter.mergeBatchId && row.mergeBatchId === prefilter.mergeBatchId) return true
      if (prefilter.productionOrderNo && row.productionOrderNos.includes(prefilter.productionOrderNo)) return true
      if (prefilter.materialSku && row.materialSku === prefilter.materialSku) return true
      return false
    }) || null
  )
}
