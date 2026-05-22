import type { MarkerPlanRefRecord } from './marker-plan-ref-model.ts'
import { buildReplenishmentPreview } from './marker-spreading-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'
import {
  buildReplenishmentContextRecords,
  type ReplenishmentContextRecord,
  type ReplenishmentContextSourceType,
} from './replenishment-context.ts'
import type { MarkerSpreadingStore } from './marker-spreading-model.ts'
import {
  listPdaReplenishmentFeedbackWritebacks,
  type PdaReplenishmentFeedbackWritebackRecord,
} from '../../../data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { getBrowserLocalStorage } from '../../../data/browser-storage.ts'
import {
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
} from '../../../data/fcs/cutting/storage/replenishment-storage.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type ReplenishmentSourceType = ReplenishmentContextSourceType | 'pda-feedback'
export type ReplenishmentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ReplenishmentStatusKey =
  | 'NO_ACTION'
  | 'PENDING_REVIEW'
  | 'PENDING_SUPPLEMENT'
  | 'REJECTED'
  | 'APPROVED_PENDING_ACTION'
  | 'IN_ACTION'
  | 'COMPLETED'
export type ReplenishmentReviewStatus = 'APPROVED' | 'REJECTED' | 'PENDING_SUPPLEMENT'
export type ReplenishmentAuditAction =
  | 'SUGGESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'MARKED_SUPPLEMENT'
  | 'IMPACT_UPDATED'
  | 'ACTION_CONFIRMED'
  | 'ACTION_SKIPPED'
  | 'ACTION_DONE'

export type ReplenishmentFollowupActionType = 'CREATE_PENDING_PREP'

export type ReplenishmentFollowupActionStatus = 'PENDING' | 'CONFIRMED' | 'SKIPPED' | 'DONE'
export type ReplenishmentFollowupTargetPageKey = 'materialPrep' | 'cuttablePool' | 'cutOrders'
export type ReplenishmentNextOptionKey =
  | 'WAIT_NEXT_PICKUP'
  | 'REPLAN_MARKER'
  | 'CLOSE_CUT_ORDER'
  | 'CHECK_DATA'
  | 'NO_GAP'

export interface ReplenishmentSuggestion {
  suggestionId: string
  suggestionNo: string
  contextId: string
  sourceType: ReplenishmentSourceType
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSku: string
  materialSkus: string[]
  materialCategory: string
  materialAttr: string
  materialAlias: string
  materialImageUrl: string
  requiredGarmentQty: number
  theoreticalCutGarmentQty: number
  actualCutGarmentQty: number
  shortageGarmentQty: number
  actualLengthTotal: number
  summaryRuleText: string
  requiredQty: number
  estimatedCapacityQty: number
  shortageQty: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  usableLengthTotal: number
  shortageLengthTotal: number
  varianceLength: number
  suggestedAction: string
  riskLevel: ReplenishmentRiskLevel
  createdAt: string
  status: ReplenishmentStatusKey
  note: string
  lines: ReplenishmentSuggestionLine[]
}

export interface ReplenishmentSuggestionLine {
  lineId: string
  cutOrderId: string
  cutOrderNo: string
  materialSku: string
  materialAlias: string
  materialImageUrl: string
  color: string
  requiredGarmentQty: number
  actualCutGarmentQty: number
  claimedLengthTotal: number
  actualLengthTotal: number
  shortageGarmentQty: number
  suggestedAction: string
  actualCutGarmentQtyFormula: string
  shortageGarmentQtyFormula: string
  suggestedActionRuleText: string
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

export interface ReplenishmentFollowupAction {
  actionId: string
  suggestionId: string
  actionType: ReplenishmentFollowupActionType
  title: string
  status: ReplenishmentFollowupActionStatus
  targetPageKey: ReplenishmentFollowupTargetPageKey
  targetPath: string
  targetQuery: Record<string, string | undefined>
  note: string
  decidedAt: string
  decidedBy: string
  completedAt: string
  completedBy: string
}

export interface ReplenishmentImpactPlan {
  impactPlanId: string
  suggestionId: string
  needReconfigureMaterial: boolean
  needReclaimMaterial: boolean
  needPendingPrep: boolean
  impactSummary: string
  applied: boolean
  appliedAt: string
  appliedBy: string
  pendingActionCount: number
  completedActionCount: number
  manualConfirmCount: number
  blocking: boolean
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

export interface ReplenishmentFollowupActionStatusMeta {
  key: ReplenishmentFollowupActionStatus
  label: string
  className: string
}

export interface ReplenishmentFollowupActionTypeMeta {
  key: ReplenishmentFollowupActionType
  label: string
  shortLabel: string
  className: string
}

export interface ReplenishmentNextOption {
  key: ReplenishmentNextOptionKey
  label: string
  detailText: string
  target: keyof ReplenishmentNavigationPayload
  className: string
}

export interface ReplenishmentSuggestionRow extends ReplenishmentSuggestion {
  context: ReplenishmentContextRecord
  sourceLabel: string
  sourceSummary: string
  sourceProductionSummary: string
  sourceOrderSummary: string
  differenceSummary: string
  majorGapSummary: string
  review: ReplenishmentReview | null
  reviewSummary: string
  reviewStatusLabel: string
  impactPlan: ReplenishmentImpactPlan
  followupActions: ReplenishmentFollowupAction[]
  followupActionCount: number
  pendingActionCount: number
  completedActionCount: number
  skippedActionCount: number
  followupProgressText: string
  pdaFeedbacks: PdaReplenishmentFeedbackWritebackRecord[]
  pendingPdaFeedbackCount: number
  latestPdaFeedback: PdaReplenishmentFeedbackWritebackRecord | null
  latestPdaFeedbackSummary: string
  claimedBalanceLength: number
  materialGapLength: number
  nextOptions: ReplenishmentNextOption[]
  nextActionSummary: string
  blockingSummary: string
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
  pendingSupplementCount: number
  approvedPendingActionCount: number
  inActionCount: number
  rejectedCount: number
  completedCount: number
  highRiskCount: number
  waitNextPickupCount: number
  replanReadyCount: number
  closeCandidateCount: number
}

export interface ReplenishmentFilters {
  keyword: string
  sourceType: 'ALL' | ReplenishmentSourceType
  status: 'ALL' | ReplenishmentStatusKey
  riskLevel: 'ALL' | ReplenishmentRiskLevel
  pendingReviewOnly: boolean
  pendingActionOnly: boolean
}

export interface ReplenishmentPrefilter {
  cutOrderNo?: string
  cutOrderId?: string
  markerPlanNo?: string
  markerPlanId?: string
  productionOrderNo?: string
  materialSku?: string
  color?: string
  suggestionId?: string
  suggestionNo?: string
  riskLevel?: ReplenishmentRiskLevel
  replenishmentStatus?: ReplenishmentStatusKey
}

export interface ReplenishmentNavigationPayload {
  markerSpreading: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  cuttablePool: Record<string, string | undefined>
  cutOrders: Record<string, string | undefined>
  markerPlanRefs: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export const replenishmentSourceMeta: Record<ReplenishmentSourceType, { label: string; className: string }> = {
  'cut-order': { label: '裁片单', className: 'bg-slate-100 text-slate-700' },
  'marker-plan-ref': { label: '唛架方案', className: 'bg-violet-100 text-violet-700' },
  'spreading-session': { label: '铺布记录', className: 'bg-sky-100 text-sky-700' },
  'pda-feedback': { label: '现场补料反馈', className: 'bg-amber-100 text-amber-700' },
}

export const replenishmentStatusMetaMap: Record<ReplenishmentStatusKey, ReplenishmentStatusMeta> = {
  NO_ACTION: {
    key: 'NO_ACTION',
    label: '无需补料',
    className: 'bg-emerald-100 text-emerald-700',
    detailText: '当前差异未形成补料动作，可继续观察。',
  },
  PENDING_REVIEW: {
    key: 'PENDING_REVIEW',
    label: '待审核',
    className: 'bg-amber-100 text-amber-700',
    detailText: '补料建议已生成，等待人工审核。',
  },
  PENDING_SUPPLEMENT: {
    key: 'PENDING_SUPPLEMENT',
    label: '待补录',
    className: 'bg-orange-100 text-orange-700',
    detailText: '当前差异依据不足，需补录再判断。',
  },
  REJECTED: {
    key: 'REJECTED',
    label: '审核驳回',
    className: 'bg-slate-200 text-slate-700',
    detailText: '补料建议已驳回，当前不进入后续动作。',
  },
  APPROVED_PENDING_ACTION: {
    key: 'APPROVED_PENDING_ACTION',
    label: '已通过待动作',
    className: 'bg-blue-100 text-blue-700',
    detailText: '审核已通过，后续动作尚未开始。',
  },
  IN_ACTION: {
    key: 'IN_ACTION',
    label: '处理中',
    className: 'bg-violet-100 text-violet-700',
    detailText: '后续动作已启动，但仍未全部完成。',
  },
  COMPLETED: {
    key: 'COMPLETED',
    label: '已完成',
    className: 'bg-fuchsia-100 text-fuchsia-700',
    detailText: '审核与后续动作均已完成。',
  },
}

export const replenishmentRiskMetaMap: Record<ReplenishmentRiskLevel, ReplenishmentRiskMeta> = {
  HIGH: {
    key: 'HIGH',
    label: '高风险',
    className: 'bg-rose-100 text-rose-700',
    detailText: '当前缺口较大或会影响后续工艺，需优先处理。',
  },
  MEDIUM: {
    key: 'MEDIUM',
    label: '中风险',
    className: 'bg-orange-100 text-orange-700',
    detailText: '当前存在差异，需要人工确认与纠偏。',
  },
  LOW: {
    key: 'LOW',
    label: '低风险',
    className: 'bg-sky-100 text-sky-700',
    detailText: '当前无明显缺口，仅需常规观察。',
  },
}

export const replenishmentFollowupActionStatusMetaMap: Record<
  ReplenishmentFollowupActionStatus,
  ReplenishmentFollowupActionStatusMeta
> = {
  PENDING: { key: 'PENDING', label: '待处理', className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { key: 'CONFIRMED', label: '已确认', className: 'bg-blue-100 text-blue-700' },
  SKIPPED: { key: 'SKIPPED', label: '已跳过', className: 'bg-slate-100 text-slate-700' },
  DONE: { key: 'DONE', label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export const replenishmentFollowupActionTypeMetaMap: Record<
  ReplenishmentFollowupActionType,
  ReplenishmentFollowupActionTypeMeta
> = {
  CREATE_PENDING_PREP: {
    key: 'CREATE_PENDING_PREP',
    label: '等待再次领料',
    shortLabel: '再次领料',
    className: 'bg-blue-100 text-blue-700',
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

function lowerKeywordIndex(values: Array<string | undefined>): string[] {
  return uniqueStrings(values).map((item) => item.toLowerCase())
}

function collectContextMaterialSkus(context: ReplenishmentContextRecord): string[] {
  return uniqueStrings(
    context.materialRows.flatMap((row) =>
      row.materialLineItems.length ? row.materialLineItems.map((item) => item.materialSku) : [row.materialSkuSummary],
    ),
  )
}

function collectContextMaterialCategories(context: ReplenishmentContextRecord): string[] {
  return uniqueStrings(
    context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialCategory)),
  )
}

function collectContextMaterialAttrs(context: ReplenishmentContextRecord): string[] {
  return uniqueStrings(context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialAttr)))
}

function collectContextMaterialAliases(context: ReplenishmentContextRecord): string[] {
  return uniqueStrings(context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialAlias)))
}

function collectContextMaterialImageUrl(context: ReplenishmentContextRecord): string {
  return context.materialRows.flatMap((row) => row.materialLineItems).find((item) => item.materialImageUrl)?.materialImageUrl || ''
}

function findContextMaterialLine(context: ReplenishmentContextRecord, cutOrderId: string, materialSku: string) {
  const row =
    context.materialRows.find((item) => item.cutOrderId === cutOrderId) ||
    context.materialRows.find((item) => item.cutOrderNo === cutOrderId) ||
    null
  return (
    row?.materialLineItems.find((item) => item.materialSku === materialSku) ||
    context.materialRows.flatMap((item) => item.materialLineItems).find((item) => item.materialSku === materialSku) ||
    null
  )
}

function buildSuggestionNo(createdAt: string, index: number): string {
  return `BL-${formatDateToken(createdAt)}-${String(index + 1).padStart(3, '0')}`
}

function buildStableSuggestionId(context: ReplenishmentContextRecord): string {
  if (context.session?.spreadingSessionId) return `rep-session-${context.session.spreadingSessionId}`
  if (context.baseSourceType === 'marker-plan-ref' && context.markerPlanId) return `rep-merge-${context.markerPlanId}`
  return `rep-cut-order-${context.cutOrderIds[0] || context.contextId}`
}

function deriveEstimatedCapacityQty(options: {
  requiredQty: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  shortageLengthTotal: number
  usableLengthTotal: number
  varianceSummary: ReplenishmentContextRecord['varianceSummary']
}): number {
  if (options.varianceSummary) {
    return Math.max(options.varianceSummary.estimatedPieceCapacity, 0)
  }

  if (options.requiredQty <= 0) return 0
  const fulfilled = Math.max(options.configuredLengthTotal + options.claimedLengthTotal - options.shortageLengthTotal, 0)
  const baseline = Math.max(options.configuredLengthTotal, options.claimedLengthTotal, options.shortageLengthTotal, 1)
  const ratio = Math.max(Math.min(fulfilled / baseline, 1), 0)
  return Math.floor(options.requiredQty * ratio)
}

export function deriveReplenishmentRiskLevel(options: {
  shortageQty: number
  requiredQty: number
  varianceLength: number
  missingData: boolean
}): ReplenishmentRiskLevel {
  if (options.missingData) return 'MEDIUM'
  if (options.shortageQty >= Math.max(Math.ceil(options.requiredQty * 0.08), 5)) return 'HIGH'
  if (options.varianceLength < -20) return 'HIGH'
  if (options.shortageQty > 0 || options.varianceLength < 0) return 'MEDIUM'
  return 'LOW'
}

function buildSuggestedAction(options: {
  shortageQty: number
  varianceLength: number
  missingData: boolean
}): { status: ReplenishmentStatusKey; text: string } {
  if (options.missingData) {
    return {
      status: 'PENDING_SUPPLEMENT',
      text: '补录铺布、领料差异后审核。',
    }
  }

  if (options.shortageQty > 0 || options.varianceLength < 0) {
    return {
      status: 'PENDING_REVIEW',
      text: `建议补足 ${formatQty(options.shortageQty)} 件对应差异，并进入后续纠偏。`,
    }
  }

  return {
    status: 'NO_ACTION',
    text: '当前差异未形成补料动作，继续观察即可。',
  }
}

export function buildReplenishmentSuggestionFromContext(options: {
  index: number
  context: ReplenishmentContextRecord
  cutOrderRowsById: Record<string, CutOrderRow>
}): ReplenishmentSuggestion {
  const requiredQty = options.context.varianceSummary?.plannedCutGarmentQty || options.context.marker?.totalPieces || options.context.totalRequiredQty
  const estimatedCapacityQty = options.context.varianceSummary?.theoreticalCutGarmentQty
    ?? deriveEstimatedCapacityQty({
      requiredQty,
      configuredLengthTotal: options.context.totalConfiguredLength,
      claimedLengthTotal: options.context.totalClaimedLength,
      shortageLengthTotal: options.context.totalShortageLength,
      usableLengthTotal: options.context.totalUsableLength,
      varianceSummary: options.context.varianceSummary,
    })
  const actualCutGarmentQty = options.context.varianceSummary?.actualCutGarmentQty || 0
  const shortageQty = options.context.varianceSummary?.shortageGarmentQty ?? Math.max(requiredQty - actualCutGarmentQty, 0)
  const varianceLength = options.context.varianceSummary
    ? Number(options.context.varianceSummary.varianceLength.toFixed(2))
    : Number((options.context.totalClaimedLength - options.context.totalConfiguredLength).toFixed(2))
  const preview = buildReplenishmentPreview(options.context.varianceSummary)
  const missingData = !options.context.marker || !options.context.session || preview.level === 'MISSING'
  const riskLevel = deriveReplenishmentRiskLevel({
    shortageQty,
    requiredQty,
    varianceLength,
    missingData,
  })
  const suggested = buildSuggestedAction({
    shortageQty,
    varianceLength,
    missingData,
  })
  const createdAt =
    options.context.session?.updatedAt ||
    options.context.marker?.updatedAt ||
    options.context.materialRows[0]?.latestClaimRecordAt ||
    nowText()
  const materialSkus = collectContextMaterialSkus(options.context)
  const materialCategories = collectContextMaterialCategories(options.context)
  const materialAttrs = collectContextMaterialAttrs(options.context)
  const materialAliases = collectContextMaterialAliases(options.context)

  return {
    suggestionId: buildStableSuggestionId(options.context),
    suggestionNo: buildSuggestionNo(createdAt, options.index),
    contextId: options.context.contextId,
    sourceType: options.context.sourceType,
    cutOrderIds: options.context.cutOrderIds,
    cutOrderNos: options.context.cutOrderNos,
    markerPlanId: options.context.markerPlanId,
    markerPlanNo: options.context.markerPlanNo,
    productionOrderIds: uniqueStrings(options.context.materialRows.map((row) => row.productionOrderId)),
    productionOrderNos: options.context.productionOrderNos,
    styleCode: options.context.styleCode,
    spuCode: options.context.spuCode,
    styleName: options.context.styleName,
    materialSku: materialSkus.join(' / ') || options.context.materialRows[0]?.materialSkuSummary || '待补',
    materialSkus,
    materialCategory: materialCategories.join(' / ') || '待补',
    materialAttr: materialAttrs.join(' / ') || '待补',
    materialAlias: materialAliases.join(' / '),
    materialImageUrl: collectContextMaterialImageUrl(options.context),
    requiredGarmentQty: requiredQty,
    theoreticalCutGarmentQty: estimatedCapacityQty,
    actualCutGarmentQty,
    shortageGarmentQty: shortageQty,
    actualLengthTotal: options.context.varianceSummary?.spreadActualLengthM || 0,
    summaryRuleText: options.context.varianceSummary?.warningRuleText || '',
    requiredQty,
    estimatedCapacityQty,
    shortageQty,
    configuredLengthTotal: options.context.totalConfiguredLength,
    claimedLengthTotal: options.context.totalClaimedLength,
    usableLengthTotal: options.context.totalUsableLength,
    shortageLengthTotal: options.context.totalShortageLength,
    varianceLength,
    suggestedAction: suggested.text,
    riskLevel,
    createdAt,
    status: suggested.status,
    note: preview.detailText,
    lines: options.context.varianceSummary?.replenishmentLines.map((line) => {
      const materialLine = findContextMaterialLine(options.context, line.cutOrderId, line.materialSku)
      return {
        lineId: line.lineId,
        cutOrderId: line.cutOrderId,
        cutOrderNo: line.cutOrderNo,
        materialSku: line.materialSku,
        materialAlias: materialLine?.materialAlias || '',
        materialImageUrl: materialLine?.materialImageUrl || '',
        color: line.color,
        requiredGarmentQty: line.requiredGarmentQty,
        actualCutGarmentQty: line.actualCutGarmentQty,
        claimedLengthTotal: line.claimedLengthTotal,
        actualLengthTotal: line.actualLengthTotal,
        shortageGarmentQty: line.shortageGarmentQty,
        suggestedAction: line.suggestedAction,
        actualCutGarmentQtyFormula: line.actualCutGarmentQtyFormula,
        shortageGarmentQtyFormula: line.shortageGarmentQtyFormula,
        suggestedActionRuleText: line.suggestedActionRuleText,
      }
    }) || [],
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

function buildReplenishmentNavigationPayload(
  suggestion: Pick<
    ReplenishmentSuggestion,
    | 'cutOrderIds'
    | 'cutOrderNos'
    | 'markerPlanId'
    | 'markerPlanNo'
    | 'productionOrderIds'
    | 'productionOrderNos'
    | 'materialSku'
  >,
): ReplenishmentNavigationPayload {
  const cutOrderId = suggestion.cutOrderIds[0] || undefined
  const cutOrderNo = suggestion.cutOrderNos[0] || undefined
  const productionOrderId = suggestion.productionOrderIds[0] || undefined
  const productionOrderNo = suggestion.productionOrderNos[0] || undefined
  const markerPlanId = suggestion.markerPlanId || undefined
  const markerPlanNo = suggestion.markerPlanNo || undefined
  const materialSku = suggestion.materialSku.split(' / ')[0] || undefined

  return {
    markerSpreading: { cutOrderId, cutOrderNo, markerPlanId, markerPlanNo, productionOrderId, productionOrderNo, materialSku },
    materialPrep: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, materialSku },
    cuttablePool: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, markerPlanId, markerPlanNo, materialSku },
    cutOrders: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, markerPlanId, markerPlanNo, materialSku },
    markerPlanRefs: { markerPlanId, markerPlanNo, cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, materialSku },
    summary: { cutOrderId, cutOrderNo, markerPlanId, markerPlanNo, productionOrderId, productionOrderNo, materialSku },
  }
}

function buildActionTargetPath(targetPageKey: ReplenishmentFollowupTargetPageKey): string {
  if (targetPageKey === 'materialPrep') return '/fcs/craft/cutting/warehouse-management/wait-process'
  if (targetPageKey === 'cuttablePool') return '/fcs/craft/cutting/cuttable-pool'
  if (targetPageKey === 'cutOrders') return '/fcs/craft/cutting/cut-orders'
  return '/fcs/craft/cutting/replenishment'
}

function buildFollowupAction(options: {
  suggestion: ReplenishmentSuggestion
  navigationPayload: ReplenishmentNavigationPayload
  actionType: ReplenishmentFollowupActionType
  title: string
  targetPageKey: ReplenishmentFollowupTargetPageKey
  note: string
  status?: ReplenishmentFollowupActionStatus
  decidedAt?: string
  decidedBy?: string
  completedAt?: string
  completedBy?: string
}): ReplenishmentFollowupAction {
  return {
    actionId: `${options.suggestion.suggestionId}-${options.actionType}`,
    suggestionId: options.suggestion.suggestionId,
    actionType: options.actionType,
    title: options.title,
    status: options.status || 'PENDING',
    targetPageKey: options.targetPageKey,
    targetPath: buildActionTargetPath(options.targetPageKey),
    targetQuery: options.navigationPayload[options.targetPageKey],
    note: options.note,
    decidedAt: options.decidedAt || '',
    decidedBy: options.decidedBy || '',
    completedAt: options.completedAt || '',
    completedBy: options.completedBy || '',
  }
}

function buildDefaultFollowupActions(
  suggestion: ReplenishmentSuggestion,
  navigationPayload: ReplenishmentNavigationPayload,
): ReplenishmentFollowupAction[] {
  if (suggestion.status === 'NO_ACTION') return []
  return [
    buildFollowupAction({
      suggestion,
      navigationPayload,
      actionType: 'CREATE_PENDING_PREP',
      title: '等待再次领料',
      targetPageKey: 'materialPrep',
      note: '确认需要继续补裁后，等待裁床再次领料；有领料余额后再去补排唛架。',
    }),
  ]
}

function mergeStoredActions(options: {
  suggestion: ReplenishmentSuggestion
  context: ReplenishmentContextRecord
  navigationPayload: ReplenishmentNavigationPayload
  storedActions: ReplenishmentFollowupAction[]
}): ReplenishmentFollowupAction[] {
  const defaults = buildDefaultFollowupActions(options.suggestion, options.navigationPayload)
  if (!options.storedActions.length) return defaults

  const storedByType = new Map(options.storedActions.map((item) => [item.actionType, item]))
  const merged = defaults.map((item) => {
    const stored = storedByType.get(item.actionType)
    if (!stored) return item
    return {
      ...item,
      status: stored.status,
      note: stored.note || item.note,
      decidedAt: stored.decidedAt || '',
      decidedBy: stored.decidedBy || '',
      completedAt: stored.completedAt || '',
      completedBy: stored.completedBy || '',
    }
  })

  const extraStored = options.storedActions.filter(
    (item) => !merged.some((mergedItem) => mergedItem.actionType === item.actionType),
  )
  return [...merged, ...extraStored]
}

function buildImpactPlanFromActions(options: {
  suggestion: ReplenishmentSuggestion
  actions: ReplenishmentFollowupAction[]
  review: ReplenishmentReview | null
}): ReplenishmentImpactPlan {
  const completedCount = options.actions.filter((item) => item.status === 'DONE').length
  const skippedCount = options.actions.filter((item) => item.status === 'SKIPPED').length
  const pendingCount = options.actions.filter((item) => !['DONE', 'SKIPPED'].includes(item.status)).length
  const manualConfirmCount = options.actions.filter((item) => item.title.startsWith('确认是否')).length
  const impactSummary = options.actions.length
    ? options.actions
        .map((item) => `${replenishmentFollowupActionTypeMetaMap[item.actionType].shortLabel}·${replenishmentFollowupActionStatusMetaMap[item.status].label}`)
        .join(' / ')
    : '当前无后续动作。'

  const latestCompleted = [...options.actions]
    .filter((item) => item.completedAt)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt, 'zh-CN'))[0]

  const reviewAppliedAt = options.review?.reviewedAt || ''
  const reviewAppliedBy = options.review?.reviewedBy || ''
  const completed = options.review?.reviewStatus === 'APPROVED' && pendingCount === 0

  return {
    impactPlanId: `impact-${options.suggestion.suggestionId}`,
    suggestionId: options.suggestion.suggestionId,
    needReconfigureMaterial: options.actions.some((item) => item.actionType === 'CREATE_PENDING_PREP'),
    needReclaimMaterial: false,
    needPendingPrep: options.actions.some((item) => item.actionType === 'CREATE_PENDING_PREP'),
    impactSummary,
    applied: completed,
    appliedAt: latestCompleted?.completedAt || (completed && !options.actions.length ? reviewAppliedAt : ''),
    appliedBy: latestCompleted?.completedBy || (completed && !options.actions.length ? reviewAppliedBy : ''),
    pendingActionCount: pendingCount,
    completedActionCount: completedCount + skippedCount,
    manualConfirmCount,
    blocking: pendingCount > 0,
  }
}

function deriveStatusMeta(options: {
  suggestion: ReplenishmentSuggestion
  review: ReplenishmentReview | null
  actions: ReplenishmentFollowupAction[]
}): ReplenishmentStatusMeta {
  if (options.review?.reviewStatus === 'REJECTED') return replenishmentStatusMetaMap.REJECTED
  if (options.review?.reviewStatus === 'PENDING_SUPPLEMENT') return replenishmentStatusMetaMap.PENDING_SUPPLEMENT

  if (options.review?.reviewStatus === 'APPROVED') {
    if (!options.actions.length) return replenishmentStatusMetaMap.COMPLETED
    const completedCount = options.actions.filter((item) => ['DONE', 'SKIPPED'].includes(item.status)).length
    const pendingCount = options.actions.length - completedCount
    if (pendingCount <= 0) return replenishmentStatusMetaMap.COMPLETED
    if (completedCount === 0) return replenishmentStatusMetaMap.APPROVED_PENDING_ACTION
    return replenishmentStatusMetaMap.IN_ACTION
  }

  return replenishmentStatusMetaMap[options.suggestion.status]
}

function buildSourceSummary(context: ReplenishmentContextRecord): string {
  if (context.baseSourceType === 'marker-plan-ref') {
    return `唛架方案 ${context.markerPlanNo || '待补唛架方案号'} · ${context.cutOrderNos.length} 个裁片单`
  }
  return `裁片单 ${context.cutOrderNos[0] || '待补'}`
}

function buildDifferenceSummary(suggestion: ReplenishmentSuggestion): string {
  return [
    `计划裁剪成衣件数 ${formatQty(suggestion.requiredGarmentQty)} 件`,
    `理论裁剪成衣件数 ${formatQty(suggestion.theoreticalCutGarmentQty)} 件`,
    `缺口成衣件数 ${formatQty(suggestion.shortageGarmentQty)} 件`,
    `差异长度 ${numberFormatter.format(suggestion.varianceLength)} 米`,
  ].join(' / ')
}

function buildMajorGapSummary(suggestion: ReplenishmentSuggestion): string {
  if (suggestion.shortageGarmentQty > 0) {
    return `缺 ${formatQty(suggestion.shortageGarmentQty)} 件 / ${numberFormatter.format(suggestion.shortageLengthTotal)} 米`
  }
  if (suggestion.varianceLength < 0) {
    return `长度超出 ${numberFormatter.format(Math.abs(suggestion.varianceLength))} 米`
  }
  return '当前无明显缺口'
}

function buildClaimedBalanceLength(suggestion: ReplenishmentSuggestion): number {
  return Number(Math.max(Number(suggestion.claimedLengthTotal || 0) - Number(suggestion.actualLengthTotal || 0), 0).toFixed(2))
}

function buildMaterialGapLength(suggestion: ReplenishmentSuggestion): number {
  return Number(
    Math.max(
      Number(suggestion.shortageLengthTotal || 0),
      Number(suggestion.actualLengthTotal || 0) - Number(suggestion.claimedLengthTotal || 0),
      0,
    ).toFixed(2),
  )
}

function buildReplenishmentNextOptions(suggestion: ReplenishmentSuggestion): ReplenishmentNextOption[] {
  const claimedBalanceLength = buildClaimedBalanceLength(suggestion)
  const hasGap = suggestion.shortageGarmentQty > 0 || buildMaterialGapLength(suggestion) > 0 || suggestion.varianceLength < 0
  const missingData = suggestion.status === 'PENDING_SUPPLEMENT' || suggestion.lines.length === 0

  if (!hasGap && !missingData) {
    return [
      {
        key: 'NO_GAP',
        label: '无需补排',
        detailText: '当前没有形成面料缺口，不需要再次排唛架。',
        target: 'cutOrders',
        className: 'bg-emerald-100 text-emerald-700',
      },
    ]
  }

  if (missingData) {
    return [
      {
        key: 'CHECK_DATA',
        label: '补齐数据',
        detailText: '先补齐铺布、裁剪或领料数量，再判断是否补排。',
        target: 'markerSpreading',
        className: 'bg-orange-100 text-orange-700',
      },
    ]
  }

  const options: ReplenishmentNextOption[] = []
  if (claimedBalanceLength > 0) {
    options.push({
      key: 'REPLAN_MARKER',
      label: '去补排唛架',
      detailText: '已领面料仍有可用余额，可回到可排唛架裁片单继续补排。',
      target: 'cuttablePool',
      className: 'bg-blue-100 text-blue-700',
    })
  } else {
    options.push({
      key: 'WAIT_NEXT_PICKUP',
      label: '等待再次领料',
      detailText: '当前已领面料已消耗完，需要再次领料后才能继续补排。',
      target: 'materialPrep',
      className: 'bg-amber-100 text-amber-700',
    })
  }

  options.push({
    key: 'CLOSE_CUT_ORDER',
    label: '关闭裁片单',
    detailText: '如果确认后续不再来料，可关闭裁片单并填写关闭原因。',
    target: 'cutOrders',
    className: 'bg-zinc-100 text-zinc-700',
  })

  return options
}

function buildNextActionSummary(options: ReplenishmentNextOption[]): string {
  return options.map((item) => item.label).join(' / ') || '暂无后续动作'
}

function buildReviewSummary(review: ReplenishmentReview | null): string {
  if (!review) return '未审核'
  if (review.reviewStatus === 'APPROVED') return '审核通过'
  if (review.reviewStatus === 'REJECTED') return '审核驳回'
  return '待补录'
}

function buildBlockingSummary(row: {
  statusMeta: ReplenishmentStatusMeta
  pendingActionCount: number
  latestPdaFeedbackSummary?: string
}): string {
  if (row.latestPdaFeedbackSummary) return row.latestPdaFeedbackSummary
  if (row.statusMeta.key === 'NO_ACTION') return '当前不影响后续'
  if (row.statusMeta.key === 'REJECTED') return '已驳回，不进入后续动作'
  if (row.statusMeta.key === 'COMPLETED') return '纠偏动作已闭环'
  if (row.statusMeta.key === 'PENDING_SUPPLEMENT') return '待补录，仍影响下游'
  if (row.statusMeta.key === 'PENDING_REVIEW') return '待审核，仍影响下游'
  if (row.pendingActionCount > 0) return `仍有 ${row.pendingActionCount} 项动作未完成`
  return '待继续处理'
}

function buildPdaFeedbackSummary(record: PdaReplenishmentFeedbackWritebackRecord | null): string {
  if (!record) return ''
  return `现场反馈：${record.reasonLabel}，由 ${record.operatorName} 于 ${record.submittedAt} 提交`
}

function matchesPdaFeedbackWithSuggestion(
  feedback: PdaReplenishmentFeedbackWritebackRecord,
  suggestion: Pick<
    ReplenishmentSuggestion,
    'cutOrderIds' | 'cutOrderNos' | 'productionOrderIds' | 'productionOrderNos' | 'materialSkus' | 'markerPlanId' | 'markerPlanNo'
  >,
): boolean {
  const matchesCutOrder =
    suggestion.cutOrderIds.includes(feedback.cutOrderId) ||
    suggestion.cutOrderNos.includes(feedback.cutOrderNo)
  if (!matchesCutOrder) return false

  const matchesProduction =
    suggestion.productionOrderIds.includes(feedback.productionOrderId) ||
    suggestion.productionOrderNos.includes(feedback.productionOrderNo)
  if (!matchesProduction) return false

  if (!suggestion.materialSkus.includes(feedback.materialSku)) return false

  if (feedback.markerPlanId || feedback.markerPlanNo) {
    return suggestion.markerPlanId === feedback.markerPlanId || suggestion.markerPlanNo === feedback.markerPlanNo
  }

  return !suggestion.markerPlanId && !suggestion.markerPlanNo
}

function buildPdaFeedbackNavigationPayload(
  feedback: Pick<
    PdaReplenishmentFeedbackWritebackRecord,
    | 'cutOrderId'
    | 'cutOrderNo'
    | 'markerPlanId'
    | 'markerPlanNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'materialSku'
  >,
): ReplenishmentNavigationPayload {
  return buildReplenishmentNavigationPayload({
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    materialSku: feedback.materialSku,
  })
}

function buildSyntheticFeedbackContext(feedback: PdaReplenishmentFeedbackWritebackRecord): ReplenishmentContextRecord {
  return {
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: 'cut-order',
    baseSourceType: 'cut-order',
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    productionOrderNos: [feedback.productionOrderNo],
    styleCode: '',
    spuCode: '',
    styleName: '',
    materialRows: [],
    marker: null,
    session: null,
    totalRequiredQty: 0,
    totalConfiguredLength: 0,
    totalClaimedLength: 0,
    totalUsableLength: 0,
    totalShortageLength: 0,
    varianceSummary: null,
  }
}

function buildSyntheticFeedbackRow(
  feedback: PdaReplenishmentFeedbackWritebackRecord,
): ReplenishmentSuggestionRow {
  const navigationPayload = buildPdaFeedbackNavigationPayload(feedback)
  const statusMeta = replenishmentStatusMetaMap.PENDING_REVIEW
  const row = {
    suggestionId: `rep-pda-feedback-${feedback.writebackId}`,
    suggestionNo: `BL-${formatDateToken(feedback.submittedAt)}-${feedback.cutOrderNo.slice(-2) || '01'}`,
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: 'pda-feedback' as const,
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    styleCode: '',
    spuCode: '',
    styleName: '',
    materialSku: feedback.materialSku,
    materialSkus: [feedback.materialSku],
    materialCategory: '待跟进',
    materialAttr: '待跟进',
    materialAlias: '',
    materialImageUrl: '',
    requiredGarmentQty: 0,
    theoreticalCutGarmentQty: 0,
    actualCutGarmentQty: 0,
    shortageGarmentQty: 0,
    actualLengthTotal: 0,
    summaryRuleText: '待人工确认现场反馈后补齐判定依据',
    requiredQty: 0,
    estimatedCapacityQty: 0,
    shortageQty: 0,
    configuredLengthTotal: 0,
    claimedLengthTotal: 0,
    usableLengthTotal: 0,
    shortageLengthTotal: 0,
    varianceLength: 0,
    suggestedAction: '请先确认这条现场补料反馈，并补齐正式补料建议。',
    riskLevel: 'MEDIUM' as const,
    createdAt: feedback.submittedAt,
    status: 'PENDING_REVIEW' as const,
    note: feedback.note,
    lines: [],
    context: buildSyntheticFeedbackContext(feedback),
    sourceLabel: replenishmentSourceMeta['pda-feedback'].label,
    sourceSummary: `现场反馈 · ${feedback.cutOrderNo}`,
    sourceProductionSummary: feedback.productionOrderNo,
    sourceOrderSummary: feedback.cutOrderNo,
    differenceSummary: `原因 ${feedback.reasonLabel} / 凭证 ${feedback.photoProofCount} 个`,
    majorGapSummary: '待人工确认补料影响',
    review: null,
    reviewSummary: '待审核',
    reviewStatusLabel: '待审核',
    impactPlan: {
      impactPlanId: `impact-${feedback.writebackId}`,
      suggestionId: `rep-pda-feedback-${feedback.writebackId}`,
      needReconfigureMaterial: false,
      needReclaimMaterial: false,
      needPendingPrep: false,
      impactSummary: '待根据现场反馈确认影响范围。',
      applied: false,
      appliedAt: '',
      appliedBy: '',
      pendingActionCount: 0,
      completedActionCount: 0,
      manualConfirmCount: 0,
      blocking: true,
    },
    followupActions: [],
    followupActionCount: 0,
    pendingActionCount: 0,
    completedActionCount: 0,
    skippedActionCount: 0,
    followupProgressText: '待补料人员跟进',
    pdaFeedbacks: [feedback],
    pendingPdaFeedbackCount: 1,
    latestPdaFeedback: feedback,
    latestPdaFeedbackSummary: buildPdaFeedbackSummary(feedback),
    claimedBalanceLength: 0,
    materialGapLength: 0,
    nextOptions: [
      {
        key: 'CHECK_DATA' as const,
        label: '补齐数据',
        detailText: '先确认现场反馈，再补齐正式铺布、裁剪或领料数量。',
        target: 'markerSpreading' as const,
        className: 'bg-orange-100 text-orange-700',
      },
    ],
    nextActionSummary: '补齐数据',
    blockingSummary: '',
    statusMeta,
    riskMeta: replenishmentRiskMetaMap.MEDIUM,
    navigationPayload,
    keywordIndex: lowerKeywordIndex([
      feedback.writebackId,
      feedback.taskNo,
      feedback.productionOrderNo,
      feedback.cutOrderNo,
      feedback.markerPlanNo,
      feedback.materialSku,
      feedback.reasonLabel,
      feedback.note,
    ]),
  }

  return {
    ...row,
    blockingSummary: buildBlockingSummary(row),
  }
}

function buildFollowupProgressText(actions: ReplenishmentFollowupAction[]): string {
  if (!actions.length) return '无需后续动作'
  const completed = actions.filter((item) => ['DONE', 'SKIPPED'].includes(item.status)).length
  return `${completed}/${actions.length} 已处理`
}

function buildStatusFilterAliases(status: ReplenishmentStatusKey): ReplenishmentStatusKey[] {
  return [status]
}

function buildRiskMeta(riskLevel: ReplenishmentRiskLevel): ReplenishmentRiskMeta {
  return replenishmentRiskMetaMap[riskLevel]
}

export function buildReplenishmentAuditTrail(options: {
  suggestion: ReplenishmentSuggestion | ReplenishmentSuggestionRow
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
  return JSON['stringify'](records)
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
  return JSON['stringify'](records)
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
  return JSON['stringify'](records)
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

export function serializeReplenishmentActionsStorage(records: ReplenishmentFollowupAction[]): string {
  return JSON['stringify'](records)
}

export function deserializeReplenishmentActionsStorage(raw: string | null): ReplenishmentFollowupAction[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => {
        const suggestionId = String(item.suggestionId || '').trim()
        if (!suggestionId) return null
        return {
          actionId: String(item.actionId || `${suggestionId}-CREATE_PENDING_PREP`).trim() || `${suggestionId}-CREATE_PENDING_PREP`,
          suggestionId,
          actionType: 'CREATE_PENDING_PREP' as const,
          title: String(item.title || '等待再次领料').trim() || '等待再次领料',
          status: ['PENDING', 'CONFIRMED', 'SKIPPED', 'DONE'].includes(String(item.status || ''))
            ? (item.status as ReplenishmentFollowupActionStatus)
            : 'PENDING',
          targetPageKey: 'materialPrep' as const,
          targetPath: buildActionTargetPath('materialPrep'),
          targetQuery:
            item.targetQuery && typeof item.targetQuery === 'object'
              ? (item.targetQuery as Record<string, string | undefined>)
              : {},
          note:
            String(item.note || '').trim() ||
            '确认需要继续补裁后，等待裁床再次领料；有领料余额后再去补排唛架。',
          decidedAt: String(item.decidedAt || '').trim(),
          decidedBy: String(item.decidedBy || '').trim(),
          completedAt: String(item.completedAt || '').trim(),
          completedBy: String(item.completedBy || '').trim(),
        }
      })
      .filter((item): item is ReplenishmentFollowupAction => Boolean(item))

    return Object.values(
      normalized.reduce<Record<string, ReplenishmentFollowupAction>>((accumulator, item) => {
        const existing = accumulator[item.suggestionId]
        if (!existing) {
          accumulator[item.suggestionId] = item
          return accumulator
        }
        const existingRank =
          existing.status === 'DONE' ? 4 : existing.status === 'CONFIRMED' ? 3 : existing.status === 'SKIPPED' ? 2 : 1
        const nextRank = item.status === 'DONE' ? 4 : item.status === 'CONFIRMED' ? 3 : item.status === 'SKIPPED' ? 2 : 1
        accumulator[item.suggestionId] = nextRank >= existingRank ? item : existing
        return accumulator
      }, {}),
    )
  } catch {
    return []
  }
}

export function buildReplenishmentViewModel(options: {
  materialPrepRows: MaterialPrepRow[]
  cutOrderRows: CutOrderRow[]
  markerPlanRefs: MarkerPlanRefRecord[]
  markerStore: MarkerSpreadingStore
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
  actions: ReplenishmentFollowupAction[]
  pdaFeedbackWritebacks?: PdaReplenishmentFeedbackWritebackRecord[]
}): ReplenishmentViewModel {
  const cutOrderRowsById = Object.fromEntries(options.cutOrderRows.map((row) => [row.cutOrderId, row]))
  const reviewsBySuggestionId = Object.fromEntries(options.reviews.map((review) => [review.suggestionId, review]))
  const impactsBySuggestionId = Object.fromEntries(options.impactPlans.map((plan) => [plan.suggestionId, plan]))
  const actionsBySuggestionId = options.actions.reduce<Record<string, ReplenishmentFollowupAction[]>>((accumulator, action) => {
    accumulator[action.suggestionId] = accumulator[action.suggestionId] || []
    accumulator[action.suggestionId].push(action)
    return accumulator
  }, {})
  const pdaFeedbackWritebacks =
    options.pdaFeedbackWritebacks ?? listPdaReplenishmentFeedbackWritebacks(getBrowserLocalStorage() || undefined)
  const contexts = buildReplenishmentContextRecords({
    materialPrepRows: options.materialPrepRows,
    cutOrderRows: options.cutOrderRows,
    markerPlanRefs: options.markerPlanRefs,
    markerStore: options.markerStore,
  })

  const rows = contexts.map((context, index) => {
    const suggestion = buildReplenishmentSuggestionFromContext({
      index,
      context,
      cutOrderRowsById,
    })
    const navigationPayload = buildReplenishmentNavigationPayload(suggestion)
    const review = reviewsBySuggestionId[suggestion.suggestionId] || null
    const followupActions = mergeStoredActions({
      suggestion,
      context,
      navigationPayload,
      storedActions: actionsBySuggestionId[suggestion.suggestionId] || [],
    })
    const impactPlan = buildImpactPlanFromActions({
      suggestion,
      actions: followupActions,
      review,
    })
    const statusMeta = deriveStatusMeta({
      suggestion,
      review,
      actions: followupActions,
    })
    const riskMeta = buildRiskMeta(suggestion.riskLevel)
    const sourceLabel = replenishmentSourceMeta[suggestion.sourceType].label
    const followupActionCount = followupActions.length
    const pendingActionCount = followupActions.filter((item) => !['DONE', 'SKIPPED'].includes(item.status)).length
    const completedActionCount = followupActions.filter((item) => item.status === 'DONE').length
    const skippedActionCount = followupActions.filter((item) => item.status === 'SKIPPED').length
    const matchedPdaFeedbacks = pdaFeedbackWritebacks.filter((feedback) => matchesPdaFeedbackWithSuggestion(feedback, suggestion))
    const latestPdaFeedback = matchedPdaFeedbacks[0] ?? null
    const latestPdaFeedbackSummary = buildPdaFeedbackSummary(latestPdaFeedback)
    const claimedBalanceLength = buildClaimedBalanceLength(suggestion)
    const materialGapLength = buildMaterialGapLength(suggestion)
    const nextOptions = buildReplenishmentNextOptions(suggestion)
    const effectiveStatusMeta =
      latestPdaFeedback &&
      ['NO_ACTION', 'COMPLETED', 'REJECTED'].includes(statusMeta.key)
        ? replenishmentStatusMetaMap.PENDING_REVIEW
        : statusMeta
    const row = {
      ...suggestion,
      context,
      sourceLabel,
      sourceSummary: buildSourceSummary(context),
      sourceProductionSummary: context.productionOrderNos.join(' / ') || '待补',
      sourceOrderSummary:
        context.baseSourceType === 'marker-plan-ref'
          ? `${context.markerPlanNo || '待补唛架方案号'} · ${context.cutOrderNos.join(' / ')}`
          : context.cutOrderNos.join(' / ') || '待补',
      differenceSummary: buildDifferenceSummary(suggestion),
      majorGapSummary: buildMajorGapSummary(suggestion),
      review,
      reviewSummary: buildReviewSummary(review),
      reviewStatusLabel: buildReviewSummary(review),
      impactPlan,
      followupActions,
      followupActionCount,
      pendingActionCount,
      completedActionCount,
      skippedActionCount,
      followupProgressText: buildFollowupProgressText(followupActions),
      pdaFeedbacks: matchedPdaFeedbacks,
      pendingPdaFeedbackCount: matchedPdaFeedbacks.length,
      latestPdaFeedback,
      latestPdaFeedbackSummary,
      claimedBalanceLength,
      materialGapLength,
      nextOptions,
      nextActionSummary: buildNextActionSummary(nextOptions),
      statusMeta: effectiveStatusMeta,
      riskMeta,
      navigationPayload,
      blockingSummary: '',
      keywordIndex: lowerKeywordIndex([
        suggestion.suggestionNo,
        ...suggestion.cutOrderNos,
        suggestion.markerPlanNo,
        ...suggestion.productionOrderNos,
        ...suggestion.materialSkus,
        suggestion.materialAlias,
        suggestion.styleCode,
        suggestion.spuCode,
        buildNextActionSummary(nextOptions),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAlias)),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAttr)),
      ]),
    }

    return {
      ...row,
      blockingSummary: buildBlockingSummary(row),
    }
  })

  const matchedFeedbackIds = new Set(rows.flatMap((row) => row.pdaFeedbacks.map((item) => item.writebackId)))
  const unmatchedFeedbackRows = pdaFeedbackWritebacks
    .filter((feedback) => !matchedFeedbackIds.has(feedback.writebackId))
    .map((feedback) => buildSyntheticFeedbackRow(feedback))

  const allRows = [...rows, ...unmatchedFeedbackRows].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt, 'zh-CN'),
  )

  const rowsBySuggestionId = Object.fromEntries(allRows.map((row) => [row.suggestionId, row]))

  return {
    rows: allRows,
    rowsById: rowsBySuggestionId,
    stats: {
      totalCount: allRows.length,
      pendingReviewCount: allRows.filter((row) => row.statusMeta.key === 'PENDING_REVIEW').length,
      pendingSupplementCount: allRows.filter((row) => row.statusMeta.key === 'PENDING_SUPPLEMENT').length,
      approvedPendingActionCount: allRows.filter((row) => row.statusMeta.key === 'APPROVED_PENDING_ACTION').length,
      inActionCount: allRows.filter((row) => row.statusMeta.key === 'IN_ACTION').length,
      rejectedCount: allRows.filter((row) => row.statusMeta.key === 'REJECTED').length,
      completedCount: allRows.filter((row) => row.statusMeta.key === 'COMPLETED').length,
      highRiskCount: allRows.filter((row) => row.riskLevel === 'HIGH').length,
      waitNextPickupCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === 'WAIT_NEXT_PICKUP')).length,
      replanReadyCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === 'REPLAN_MARKER')).length,
      closeCandidateCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === 'CLOSE_CUT_ORDER')).length,
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
    if (prefilter?.suggestionId && row.suggestionId !== prefilter.suggestionId) return false
    if (prefilter?.suggestionNo && row.suggestionNo !== prefilter.suggestionNo) return false
    if (prefilter?.cutOrderNo && !row.cutOrderNos.includes(prefilter.cutOrderNo)) return false
    if (prefilter?.cutOrderId && !row.cutOrderIds.includes(prefilter.cutOrderId)) return false
    if (prefilter?.markerPlanNo && row.markerPlanNo !== prefilter.markerPlanNo) return false
    if (prefilter?.markerPlanId && row.markerPlanId !== prefilter.markerPlanId) return false
    if (prefilter?.productionOrderNo && !row.productionOrderNos.includes(prefilter.productionOrderNo)) return false
    if (prefilter?.materialSku && !row.materialSkus.includes(prefilter.materialSku)) return false
    if (prefilter?.color && !row.lines.some((line) => line.color === prefilter.color)) return false
    if (prefilter?.riskLevel && row.riskLevel !== prefilter.riskLevel) return false
    if (
      prefilter?.replenishmentStatus &&
      !buildStatusFilterAliases(prefilter.replenishmentStatus).includes(row.statusMeta.key)
    ) {
      return false
    }

    if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false
    if (filters.sourceType !== 'ALL' && row.sourceType !== filters.sourceType) return false
    if (filters.status !== 'ALL' && row.statusMeta.key !== filters.status) return false
    if (filters.riskLevel !== 'ALL' && row.riskLevel !== filters.riskLevel) return false
    if (filters.pendingReviewOnly && !['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(row.statusMeta.key)) return false
    if (filters.pendingActionOnly && !['APPROVED_PENDING_ACTION', 'IN_ACTION'].includes(row.statusMeta.key)) return false
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
      if (prefilter.suggestionId && row.suggestionId === prefilter.suggestionId) return true
      if (prefilter.suggestionNo && row.suggestionNo === prefilter.suggestionNo) return true
      if (prefilter.cutOrderNo && row.cutOrderNos.includes(prefilter.cutOrderNo)) return true
      if (prefilter.cutOrderId && row.cutOrderIds.includes(prefilter.cutOrderId)) return true
      if (prefilter.markerPlanNo && row.markerPlanNo === prefilter.markerPlanNo) return true
      if (prefilter.markerPlanId && row.markerPlanId === prefilter.markerPlanId) return true
      if (prefilter.productionOrderNo && row.productionOrderNos.includes(prefilter.productionOrderNo)) return true
      if (prefilter.materialSku && row.materialSkus.includes(prefilter.materialSku)) return true
      if (prefilter.color && row.lines.some((line) => line.color === prefilter.color)) return true
      return false
    }) || null
  )
}
