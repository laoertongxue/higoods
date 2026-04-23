import type { MergeBatchRecord } from './merge-batches-model.ts'
import { buildReplenishmentPreview } from './marker-spreading-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { OriginalCutOrderRow } from './original-orders-model.ts'
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
export type ReplenishmentLegacyStatusKey = 'APPROVED' | 'APPLIED'
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
export type ReplenishmentFollowupTargetPageKey = 'materialPrep'

export interface ReplenishmentSuggestion {
  suggestionId: string
  suggestionNo: string
  contextId: string
  sourceType: ReplenishmentSourceType
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSku: string
  materialSkus: string[]
  materialCategory: string
  materialAttr: string
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
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSku: string
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
  originalCutOrderNo?: string
  originalCutOrderId?: string
  mergeBatchNo?: string
  mergeBatchId?: string
  productionOrderNo?: string
  materialSku?: string
  color?: string
  suggestionId?: string
  suggestionNo?: string
  riskLevel?: ReplenishmentRiskLevel
  replenishmentStatus?: ReplenishmentStatusKey | ReplenishmentLegacyStatusKey
}

export interface ReplenishmentNavigationPayload {
  markerSpreading: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export const replenishmentSourceMeta: Record<ReplenishmentSourceType, { label: string; className: string }> = {
  'original-order': { label: '原始裁片单', className: 'bg-slate-100 text-slate-700' },
  'merge-batch': { label: '合并裁剪批次', className: 'bg-violet-100 text-violet-700' },
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
    detailText: '当前缺口较大或直接阻塞后续工艺，需优先处理。',
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
    label: '生成补料待配料',
    shortLabel: '待配料',
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

function buildSuggestionNo(createdAt: string, index: number): string {
  return `BL-${formatDateToken(createdAt)}-${String(index + 1).padStart(3, '0')}`
}

function buildStableSuggestionId(context: ReplenishmentContextRecord): string {
  if (context.session?.spreadingSessionId) return `rep-session-${context.session.spreadingSessionId}`
  if (context.baseSourceType === 'merge-batch' && context.mergeBatchId) return `rep-merge-${context.mergeBatchId}`
  return `rep-original-${context.originalCutOrderIds[0] || context.contextId}`
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
      text: '补录铺布、配料或领料差异后审核。',
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
  originalRowsById: Record<string, OriginalCutOrderRow>
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

  return {
    suggestionId: buildStableSuggestionId(options.context),
    suggestionNo: buildSuggestionNo(createdAt, options.index),
    contextId: options.context.contextId,
    sourceType: options.context.sourceType,
    originalCutOrderIds: options.context.originalCutOrderIds,
    originalCutOrderNos: options.context.originalCutOrderNos,
    mergeBatchId: options.context.mergeBatchId,
    mergeBatchNo: options.context.mergeBatchNo,
    productionOrderIds: uniqueStrings(options.context.materialRows.map((row) => row.productionOrderId)),
    productionOrderNos: options.context.productionOrderNos,
    styleCode: options.context.styleCode,
    spuCode: options.context.spuCode,
    styleName: options.context.styleName,
    materialSku: materialSkus.join(' / ') || options.context.materialRows[0]?.materialSkuSummary || '待补',
    materialSkus,
    materialCategory: materialCategories.join(' / ') || '待补',
    materialAttr: materialAttrs.join(' / ') || '待补',
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
    lines: options.context.varianceSummary?.replenishmentLines.map((line) => ({
      lineId: line.lineId,
      originalCutOrderId: line.originalCutOrderId,
      originalCutOrderNo: line.originalCutOrderNo,
      materialSku: line.materialSku,
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
    })) || [],
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
    | 'originalCutOrderIds'
    | 'originalCutOrderNos'
    | 'mergeBatchId'
    | 'mergeBatchNo'
    | 'productionOrderIds'
    | 'productionOrderNos'
    | 'materialSku'
  >,
): ReplenishmentNavigationPayload {
  const originalCutOrderId = suggestion.originalCutOrderIds[0] || undefined
  const originalCutOrderNo = suggestion.originalCutOrderNos[0] || undefined
  const productionOrderId = suggestion.productionOrderIds[0] || undefined
  const productionOrderNo = suggestion.productionOrderNos[0] || undefined
  const mergeBatchId = suggestion.mergeBatchId || undefined
  const mergeBatchNo = suggestion.mergeBatchNo || undefined
  const materialSku = suggestion.materialSku.split(' / ')[0] || undefined

  return {
    markerSpreading: { originalCutOrderId, originalCutOrderNo, mergeBatchId, mergeBatchNo, productionOrderId, productionOrderNo, materialSku },
    materialPrep: { originalCutOrderId, originalCutOrderNo, productionOrderId, productionOrderNo, materialSku },
    originalOrders: { originalCutOrderId, originalCutOrderNo, productionOrderId, productionOrderNo, mergeBatchId, mergeBatchNo, materialSku },
    mergeBatches: { mergeBatchId, mergeBatchNo, originalCutOrderId, originalCutOrderNo, productionOrderId, productionOrderNo, materialSku },
    summary: { originalCutOrderId, originalCutOrderNo, mergeBatchId, mergeBatchNo, productionOrderId, productionOrderNo, materialSku },
  }
}

function buildActionTargetPath(targetPageKey: ReplenishmentFollowupTargetPageKey): string {
  if (targetPageKey === 'materialPrep') return '/fcs/craft/cutting/material-prep'
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
      title: '生成补料待配料',
      targetPageKey: 'materialPrep',
      note: '审核通过后，在原裁片任务的仓库配料领料记录下生成补料待配料，由仓库配料领料继续处理。',
    }),
  ]
}

function hydrateLegacyActionsFromImpactPlan(options: {
  suggestion: ReplenishmentSuggestion
  context: ReplenishmentContextRecord
  navigationPayload: ReplenishmentNavigationPayload
  legacyImpactPlan: ReplenishmentImpactPlan | null
}): ReplenishmentFollowupAction[] {
  const defaults = buildDefaultFollowupActions(options.suggestion, options.navigationPayload)
  const legacy = options.legacyImpactPlan
  if (!legacy) return defaults
  if (
    !legacy.needReconfigureMaterial &&
    !legacy.needReclaimMaterial &&
    !legacy.needPendingPrep &&
    !legacy.impactSummary
  ) {
    return defaults
  }

  const matched = defaults[0]
  if (!matched) return []
  return [
    {
      ...matched,
      status: legacy.applied ? 'DONE' : matched.status,
      completedAt: legacy.applied ? legacy.appliedAt : matched.completedAt,
      completedBy: legacy.applied ? legacy.appliedBy : matched.completedBy,
      note: legacy.impactSummary || matched.note,
    },
  ]
}

function mergeStoredActions(options: {
  suggestion: ReplenishmentSuggestion
  context: ReplenishmentContextRecord
  navigationPayload: ReplenishmentNavigationPayload
  storedActions: ReplenishmentFollowupAction[]
  legacyImpactPlan: ReplenishmentImpactPlan | null
}): ReplenishmentFollowupAction[] {
  const defaults = hydrateLegacyActionsFromImpactPlan({
    suggestion: options.suggestion,
    context: options.context,
    navigationPayload: options.navigationPayload,
    legacyImpactPlan: options.legacyImpactPlan,
  })
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
  legacyImpactPlan: ReplenishmentImpactPlan | null
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
    appliedAt: latestCompleted?.completedAt || (completed && !options.actions.length ? reviewAppliedAt : options.legacyImpactPlan?.appliedAt || ''),
    appliedBy: latestCompleted?.completedBy || (completed && !options.actions.length ? reviewAppliedBy : options.legacyImpactPlan?.appliedBy || ''),
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
  if (context.baseSourceType === 'merge-batch') {
    return `合并裁剪批次 ${context.mergeBatchNo || '待补合并裁剪批次号'} · ${context.originalCutOrderNos.length} 个原始裁片单`
  }
  return `原始裁片单 ${context.originalCutOrderNos[0] || '待补'}`
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
  if (row.statusMeta.key === 'NO_ACTION') return '当前不阻塞后续'
  if (row.statusMeta.key === 'REJECTED') return '已驳回，不进入后续动作'
  if (row.statusMeta.key === 'COMPLETED') return '纠偏动作已闭环'
  if (row.statusMeta.key === 'PENDING_SUPPLEMENT') return '待补录，仍阻塞下游'
  if (row.statusMeta.key === 'PENDING_REVIEW') return '待审核，仍阻塞下游'
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
    'originalCutOrderIds' | 'originalCutOrderNos' | 'productionOrderIds' | 'productionOrderNos' | 'materialSkus' | 'mergeBatchId' | 'mergeBatchNo'
  >,
): boolean {
  const matchesOriginal =
    suggestion.originalCutOrderIds.includes(feedback.originalCutOrderId) ||
    suggestion.originalCutOrderNos.includes(feedback.originalCutOrderNo)
  if (!matchesOriginal) return false

  const matchesProduction =
    suggestion.productionOrderIds.includes(feedback.productionOrderId) ||
    suggestion.productionOrderNos.includes(feedback.productionOrderNo)
  if (!matchesProduction) return false

  if (!suggestion.materialSkus.includes(feedback.materialSku)) return false

  if (feedback.mergeBatchId || feedback.mergeBatchNo) {
    return suggestion.mergeBatchId === feedback.mergeBatchId || suggestion.mergeBatchNo === feedback.mergeBatchNo
  }

  return !suggestion.mergeBatchId && !suggestion.mergeBatchNo
}

function buildPdaFeedbackNavigationPayload(
  feedback: Pick<
    PdaReplenishmentFeedbackWritebackRecord,
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
    | 'mergeBatchId'
    | 'mergeBatchNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'materialSku'
  >,
): ReplenishmentNavigationPayload {
  return buildReplenishmentNavigationPayload({
    originalCutOrderIds: [feedback.originalCutOrderId],
    originalCutOrderNos: [feedback.originalCutOrderNo],
    mergeBatchId: feedback.mergeBatchId,
    mergeBatchNo: feedback.mergeBatchNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    materialSku: feedback.materialSku,
  })
}

function buildSyntheticFeedbackContext(feedback: PdaReplenishmentFeedbackWritebackRecord): ReplenishmentContextRecord {
  return {
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: 'original-order',
    baseSourceType: 'original-order',
    mergeBatchId: feedback.mergeBatchId,
    mergeBatchNo: feedback.mergeBatchNo,
    originalCutOrderIds: [feedback.originalCutOrderId],
    originalCutOrderNos: [feedback.originalCutOrderNo],
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
    suggestionNo: `BL-${formatDateToken(feedback.submittedAt)}-${feedback.originalCutOrderNo.slice(-2) || '01'}`,
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: 'pda-feedback' as const,
    originalCutOrderIds: [feedback.originalCutOrderId],
    originalCutOrderNos: [feedback.originalCutOrderNo],
    mergeBatchId: feedback.mergeBatchId,
    mergeBatchNo: feedback.mergeBatchNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    styleCode: '',
    spuCode: '',
    styleName: '',
    materialSku: feedback.materialSku,
    materialSkus: [feedback.materialSku],
    materialCategory: '待跟进',
    materialAttr: '待跟进',
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
    sourceSummary: `现场反馈 · ${feedback.originalCutOrderNo}`,
    sourceProductionSummary: feedback.productionOrderNo,
    sourceOrderSummary: feedback.originalCutOrderNo,
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
    blockingSummary: '',
    statusMeta,
    riskMeta: replenishmentRiskMetaMap.MEDIUM,
    navigationPayload,
    keywordIndex: lowerKeywordIndex([
      feedback.writebackId,
      feedback.taskNo,
      feedback.productionOrderNo,
      feedback.originalCutOrderNo,
      feedback.mergeBatchNo,
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

function buildStatusFilterAliases(status: ReplenishmentStatusKey | ReplenishmentLegacyStatusKey): ReplenishmentStatusKey[] {
  if (status === 'APPROVED') return ['APPROVED_PENDING_ACTION', 'IN_ACTION']
  if (status === 'APPLIED') return ['COMPLETED']
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
          title: String(item.title || '生成补料待配料').trim() || '生成补料待配料',
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
            '审核通过后，在原裁片任务的仓库配料领料记录下生成补料待配料，由仓库配料领料继续处理。',
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
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
  actions: ReplenishmentFollowupAction[]
  pdaFeedbackWritebacks?: PdaReplenishmentFeedbackWritebackRecord[]
}): ReplenishmentViewModel {
  const originalRowsById = Object.fromEntries(options.originalRows.map((row) => [row.originalCutOrderId, row]))
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
    originalRows: options.originalRows,
    mergeBatches: options.mergeBatches,
    markerStore: options.markerStore,
  })

  const rows = contexts.map((context, index) => {
    const suggestion = buildReplenishmentSuggestionFromContext({
      index,
      context,
      originalRowsById,
    })
    const navigationPayload = buildReplenishmentNavigationPayload(suggestion)
    const review = reviewsBySuggestionId[suggestion.suggestionId] || null
    const followupActions = mergeStoredActions({
      suggestion,
      context,
      navigationPayload,
      storedActions: actionsBySuggestionId[suggestion.suggestionId] || [],
      legacyImpactPlan: impactsBySuggestionId[suggestion.suggestionId] || null,
    })
    const impactPlan = buildImpactPlanFromActions({
      suggestion,
      actions: followupActions,
      legacyImpactPlan: impactsBySuggestionId[suggestion.suggestionId] || null,
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
        context.baseSourceType === 'merge-batch'
          ? `${context.mergeBatchNo || '待补合并裁剪批次号'} · ${context.originalCutOrderNos.join(' / ')}`
          : context.originalCutOrderNos.join(' / ') || '待补',
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
      statusMeta: effectiveStatusMeta,
      riskMeta,
      navigationPayload,
      blockingSummary: '',
      keywordIndex: lowerKeywordIndex([
        suggestion.suggestionNo,
        ...suggestion.originalCutOrderNos,
        suggestion.mergeBatchNo,
        ...suggestion.productionOrderNos,
        ...suggestion.materialSkus,
        suggestion.styleCode,
        suggestion.spuCode,
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
    if (prefilter?.originalCutOrderNo && !row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter?.originalCutOrderId && !row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return false
    if (prefilter?.mergeBatchNo && row.mergeBatchNo !== prefilter.mergeBatchNo) return false
    if (prefilter?.mergeBatchId && row.mergeBatchId !== prefilter.mergeBatchId) return false
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
      if (prefilter.originalCutOrderNo && row.originalCutOrderNos.includes(prefilter.originalCutOrderNo)) return true
      if (prefilter.originalCutOrderId && row.originalCutOrderIds.includes(prefilter.originalCutOrderId)) return true
      if (prefilter.mergeBatchNo && row.mergeBatchNo === prefilter.mergeBatchNo) return true
      if (prefilter.mergeBatchId && row.mergeBatchId === prefilter.mergeBatchId) return true
      if (prefilter.productionOrderNo && row.productionOrderNos.includes(prefilter.productionOrderNo)) return true
      if (prefilter.materialSku && row.materialSkus.includes(prefilter.materialSku)) return true
      if (prefilter.color && row.lines.some((line) => line.color === prefilter.color)) return true
      return false
    }) || null
  )
}
