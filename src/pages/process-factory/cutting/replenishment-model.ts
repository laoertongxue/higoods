import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
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
import {
  listSpreadingDifferences,
  type ReplenishmentNextAction,
  type ReplenishmentReviewResult,
  type SpreadingDifference,
  type SpreadingDifferenceType,
} from '../../../data/fcs/cutting/spreading-differences.ts'

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

export type ReplenishmentFollowupActionType =
  | 'CREATE_PENDING_PREP'
  | 'SUPPLEMENT_BACKFILL'
  | 'REPLAN_MARKER'
  | 'CLOSE_CUT_ORDER'
  | 'RECORD_ONLY'

export type ReplenishmentFollowupActionStatus = 'PENDING' | 'CONFIRMED' | 'SKIPPED' | 'DONE'
export type ReplenishmentFollowupTargetPageKey =
  | 'materialPrep'
  | 'cuttablePool'
  | 'cutOrders'
  | 'markerSpreading'
  | 'markerPlanSources'
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

export type ReplenishmentReviewItemSourceType =
  | '领料差异'
  | 'PDA 铺布回写'
  | 'PDA 裁剪回写'
  | 'Web 处理'
  | '现场反馈'
  | '卷记录异常'
  | '布头布尾异常'
  | '面料余额不足'
  | '其他异常'

export type ReplenishmentReviewItemStatus = '待审核' | '审核中' | '已处理' | '已关闭' | '已取消'

export interface ReplenishmentEvidenceItem {
  evidenceId: string
  evidenceType: 'PDA 反馈' | '照片' | '备注' | '卷记录' | '系统计算'
  summary: string
  operatorName: string
  occurredAt: string
}

export interface ReplenishmentReviewItem {
  replenishmentId: string
  replenishmentNo: string
  sourceDifferenceId: string
  sourceType: ReplenishmentReviewItemSourceType
  differenceType: string
  differenceLevel: string
  productionOrderIds: string[]
  cutOrderIds: string[]
  spreadingOrderId: string
  spreadingOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialIdentity: {
    materialSku: string
    materialName: string
    materialColor: string
    materialAlias: string
    materialImageUrl: string
    materialUnit: string
  }
  patternIdentity: {
    patternFileName: string
    patternVersion: string
    effectiveWidthText: string
  }
  plannedValue: number
  actualValue: number
  differenceValue: number
  unit: string
  evidenceItems: ReplenishmentEvidenceItem[]
  pdaFeedbackId: string
  reviewStatus: ReplenishmentReviewItemStatus
  reviewResult: ReplenishmentReviewResult | ''
  nextAction: ReplenishmentNextAction | ''
  linkedLedgerEventIds: string[]
  closeCutOrderRequired: boolean
  closeReasonCode: ReplenishmentReview['closeReasonCode'] | ''
  closeReasonText: string
  createdAt: string
  createdBy: string
  reviewedAt: string
  reviewedBy: string
  remark: string
}

export interface ReplenishmentReview {
  reviewId: string
  suggestionId: string
  reviewStatus: ReplenishmentReviewStatus
  reviewResult?: ReplenishmentReviewResult
  nextAction?: ReplenishmentNextAction
  closeReasonCode?: 'MATERIAL_NO_MORE_ARRIVAL' | 'BUSINESS_STOP_RECUT' | 'FORCED_CLOSE' | 'STYLE_CANCELLED' | 'DEMAND_CANCELLED' | 'MATERIAL_REPLACED_UNUSED' | 'OTHER'
  closeReason?: string
  linkedLedgerEventIds?: string[]
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
  sourceDifferences: SpreadingDifference[]
  sourceDifferenceCount: number
  differenceTypeSummary: string
  handlingStatusLabel: string
  reviewResultLabel: string
  nextActionLabel: string
  closeReason: string
  linkedLedgerEventIds: string[]
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
  spreadingSessionId?: string
  spreadingOrderId?: string
  riskLevel?: ReplenishmentRiskLevel
  replenishmentStatus?: ReplenishmentStatusKey
}

export interface ReplenishmentNavigationPayload {
  markerSpreading: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  cuttablePool: Record<string, string | undefined>
  cutOrders: Record<string, string | undefined>
  markerPlanSources: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export const replenishmentSourceMeta: Record<ReplenishmentSourceType, { label: string; className: string }> = {
  'cut-order': { label: '裁片单', className: 'bg-slate-100 text-slate-700' },
  'marker-plan': { label: '唛架方案', className: 'bg-violet-100 text-violet-700' },
  'spreading-session': { label: '铺布记录', className: 'bg-sky-100 text-sky-700' },
  'pda-feedback': { label: '现场补料反馈', className: 'bg-amber-100 text-amber-700' },
}

export const replenishmentStatusMetaMap: Record<ReplenishmentStatusKey, ReplenishmentStatusMeta> = {
  NO_ACTION: {
    key: 'NO_ACTION',
    label: '无需发起布料',
    className: 'bg-emerald-100 text-emerald-700',
    detailText: '当前差异未形成发起布料动作，可继续观察。',
  },
  PENDING_REVIEW: {
    key: 'PENDING_REVIEW',
    label: '待处理',
    className: 'bg-amber-100 text-amber-700',
    detailText: '实际差异已进入处理工作台。',
  },
  PENDING_SUPPLEMENT: {
    key: 'PENDING_SUPPLEMENT',
    label: '待处理',
    className: 'bg-orange-100 text-orange-700',
    detailText: '当前差异等待处理。',
  },
  REJECTED: {
    key: 'REJECTED',
    label: '已忽略',
    className: 'bg-slate-200 text-slate-700',
    detailText: '差异已忽略，当前不创建配料。',
  },
  APPROVED_PENDING_ACTION: {
    key: 'APPROVED_PENDING_ACTION',
    label: '待发起布料',
    className: 'bg-blue-100 text-blue-700',
    detailText: '处理结果已保存，等待发起布料。',
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
    label: '发起布料',
    shortLabel: '发起布料',
    className: 'bg-blue-100 text-blue-700',
  },
  SUPPLEMENT_BACKFILL: {
    key: 'SUPPLEMENT_BACKFILL',
    label: '忽略',
    shortLabel: '忽略',
    className: 'bg-slate-100 text-slate-700',
  },
  REPLAN_MARKER: {
    key: 'REPLAN_MARKER',
    label: '忽略',
    shortLabel: '忽略',
    className: 'bg-slate-100 text-slate-700',
  },
  CLOSE_CUT_ORDER: {
    key: 'CLOSE_CUT_ORDER',
    label: '忽略',
    shortLabel: '忽略',
    className: 'bg-slate-100 text-slate-700',
  },
  RECORD_ONLY: {
    key: 'RECORD_ONLY',
    label: '忽略',
    shortLabel: '忽略',
    className: 'bg-slate-100 text-slate-700',
  },
}

export function normalizeReplenishmentReviewResult(result: ReplenishmentReviewResult | '' | undefined): ReplenishmentReviewResult {
  return result === '需要补料' ? '需要补料' : '仅记录差异'
}

export function formatReplenishmentReviewResultLabel(result: ReplenishmentReviewResult | '' | undefined): string {
  if (!result) return '待处理'
  return normalizeReplenishmentReviewResult(result) === '需要补料' ? '发起布料' : '忽略'
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
  if (context.baseSourceType === 'marker-plan' && context.markerPlanId) return `rep-merge-${context.markerPlanId}`
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
      text: '差异资料不足，先进入处理。',
    }
  }

  if (options.shortageQty > 0 || options.varianceLength < 0) {
    return {
      status: 'PENDING_REVIEW',
      text: `存在 ${formatQty(options.shortageQty)} 件对应差异，处理结果只能选择发起布料或忽略。`,
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
  reviewResult?: ReplenishmentReviewResult
  decisionReason: string
  closeReason?: string
}): { ok: boolean; message: string } {
  const reason = options.decisionReason.trim()
  const reviewResult = normalizeReplenishmentReviewResult(options.reviewResult)
  if (
    options.suggestion.statusMeta.key === 'NO_ACTION' &&
    options.reviewStatus === 'APPROVED' &&
    reviewResult !== '仅记录差异'
  ) {
    return { ok: false, message: '当前建议为“无需发起布料”，不能直接发起布料。' }
  }
  if ((options.reviewStatus === 'REJECTED' || options.reviewStatus === 'PENDING_SUPPLEMENT') && !reason) {
    return { ok: false, message: '处理差异必须填写原因。' }
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
    markerPlanSources: { markerPlanId, markerPlanNo, cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, materialSku },
    summary: { cutOrderId, cutOrderNo, markerPlanId, markerPlanNo, productionOrderId, productionOrderNo, materialSku },
  }
}

function buildActionTargetPath(targetPageKey: ReplenishmentFollowupTargetPageKey): string {
  if (targetPageKey === 'materialPrep') return '/fcs/craft/cutting/warehouse-management/wait-process'
  if (targetPageKey === 'cuttablePool') return '/fcs/craft/cutting/cuttable-pool'
  if (targetPageKey === 'cutOrders') return '/fcs/craft/cutting/cut-orders'
  if (targetPageKey === 'markerSpreading') return '/fcs/craft/cutting/spreading-list'
  if (targetPageKey === 'markerPlanSources') return '/fcs/craft/cutting/marker-list'
  return '/fcs/craft/cutting/replenishment'
}

export function resolveReviewStatusFromResult(result: ReplenishmentReviewResult): ReplenishmentReviewStatus {
  return 'APPROVED'
}

export function resolveNextActionFromReviewResult(result: ReplenishmentReviewResult): ReplenishmentNextAction {
  if (normalizeReplenishmentReviewResult(result) === '需要补料') return '回到中转仓配料'
  return '无后续动作'
}

function resolveFollowupActionFromReviewResult(
  result: ReplenishmentReviewResult | undefined,
): {
  actionType: ReplenishmentFollowupActionType
  title: string
  targetPageKey: ReplenishmentFollowupTargetPageKey
  note: string
} | null {
  if (!result) return null
  if (normalizeReplenishmentReviewResult(result) === '需要补料') {
    return {
      actionType: 'CREATE_PENDING_PREP',
      title: '发起布料',
      targetPageKey: 'materialPrep',
      note: '处理结果为发起布料，WMS 中转仓将创建新的配料，裁床后续重新领料。',
    }
  }
  return {
    actionType: 'RECORD_ONLY',
    title: '忽略',
    targetPageKey: 'cutOrders',
    note: '处理结果为忽略，不创建配料，不改变数量账。',
  }
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

export function buildReplenishmentFollowupActionForResult(options: {
  suggestion: ReplenishmentSuggestion
  navigationPayload: ReplenishmentNavigationPayload
  result: ReplenishmentReviewResult
  decidedAt: string
  decidedBy: string
}): ReplenishmentFollowupAction | null {
  const actionMeta = resolveFollowupActionFromReviewResult(options.result)
  if (!actionMeta) return null
  return buildFollowupAction({
    suggestion: options.suggestion,
    navigationPayload: options.navigationPayload,
    actionType: actionMeta.actionType,
    title: actionMeta.title,
    targetPageKey: actionMeta.targetPageKey,
    note: actionMeta.note,
    decidedAt: options.decidedAt,
    decidedBy: options.decidedBy,
  })
}

function buildDefaultFollowupActions(
  suggestion: ReplenishmentSuggestion,
  navigationPayload: ReplenishmentNavigationPayload,
): ReplenishmentFollowupAction[] {
  void suggestion
  void navigationPayload
  return []
}

function mergeStoredActions(options: {
  suggestion: ReplenishmentSuggestion
  context: ReplenishmentContextRecord
  navigationPayload: ReplenishmentNavigationPayload
  storedActions: ReplenishmentFollowupAction[]
}): ReplenishmentFollowupAction[] {
  if (options.storedActions.length) return options.storedActions
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
    needReclaimMaterial: options.actions.some((item) => item.actionType === 'CREATE_PENDING_PREP'),
    needPendingPrep: options.actions.some((item) => item.actionType === 'CREATE_PENDING_PREP' || item.actionType === 'REPLAN_MARKER'),
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
  if (context.baseSourceType === 'marker-plan') {
    return `唛架方案 ${context.markerPlanNo || '待补唛架方案号'} · ${context.cutOrderNos.length} 个裁片单`
  }
  return `裁片单 ${context.cutOrderNos[0] || '待补'}`
}

function buildDifferenceSummary(suggestion: ReplenishmentSuggestion): string {
  return [
    `计划裁剪成衣件数 ${formatQty(suggestion.requiredGarmentQty)} 件`,
    `理论裁剪成衣件数 ${formatQty(suggestion.theoreticalCutGarmentQty)} 件`,
    `差异成衣件数 ${formatQty(suggestion.shortageGarmentQty)} 件`,
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
        label: '忽略',
        detailText: '当前没有形成明确缺口，不创建配料。',
        target: 'cutOrders',
        className: 'bg-emerald-100 text-emerald-700',
      },
    ]
  }

  if (missingData) {
    return [
      {
        key: 'CHECK_DATA',
        label: '忽略',
        detailText: '当前资料不足，不创建配料。',
        target: 'markerSpreading',
        className: 'bg-orange-100 text-orange-700',
      },
    ]
  }

  const options: ReplenishmentNextOption[] = []
  options.push({
    key: 'WAIT_NEXT_PICKUP',
    label: '发起布料',
    detailText: '对接 WMS 中转仓创建新的配料，裁床后续重新领料。',
    target: 'materialPrep',
    className: 'bg-blue-100 text-blue-700',
  })

  options.push({
    key: 'NO_GAP',
    label: '忽略',
    detailText: '不创建配料，不改变数量账。',
    target: 'cutOrders',
    className: 'bg-slate-100 text-slate-700',
  })

  return options
}

function buildNextActionSummary(options: ReplenishmentNextOption[]): string {
  return options.map((item) => item.label).join(' / ') || '暂无后续动作'
}

function buildReviewSummary(review: ReplenishmentReview | null): string {
  if (!review) return '未处理'
  if (review.reviewStatus === 'APPROVED') return '已处理'
  if (review.reviewStatus === 'REJECTED') return '已忽略'
  return '待处理'
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
  if (row.statusMeta.key === 'PENDING_SUPPLEMENT') return '待处理，仍影响下游'
  if (row.statusMeta.key === 'PENDING_REVIEW') return '待处理，仍影响下游'
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

function matchesSpreadingDifferenceWithSuggestion(
  difference: SpreadingDifference,
  suggestion: Pick<
    ReplenishmentSuggestion,
    | 'cutOrderIds'
    | 'cutOrderNos'
    | 'productionOrderIds'
    | 'productionOrderNos'
    | 'materialSkus'
    | 'markerPlanId'
    | 'markerPlanNo'
  >,
  context?: ReplenishmentContextRecord,
): boolean {
  const matchesCutOrder =
    difference.cutOrderIds.some((id) => suggestion.cutOrderIds.includes(id)) ||
    difference.cutOrderNos.some((no) => suggestion.cutOrderNos.includes(no))
  if (!matchesCutOrder) return false

  const matchesProduction =
    difference.productionOrderIds.some((id) => suggestion.productionOrderIds.includes(id)) ||
    difference.productionOrderNos.some((no) => suggestion.productionOrderNos.includes(no))
  if (!matchesProduction) return false

  if (suggestion.materialSkus.length && !suggestion.materialSkus.includes(difference.materialSku)) return false

  if (context?.session?.spreadingSessionId || context?.session?.sessionNo) {
    return (
      difference.spreadingOrderId === context.session.spreadingSessionId ||
      difference.spreadingOrderNo === context.session.sessionNo ||
      difference.sourceObjectId === context.session.spreadingSessionId
    )
  }

  if (difference.spreadingOrderId || difference.spreadingOrderNo) return false

  if (suggestion.markerPlanId || suggestion.markerPlanNo) {
    return suggestion.markerPlanId === difference.markerPlanId || suggestion.markerPlanNo === difference.markerPlanNo
  }

  return true
}

function matchesSpreadingDifferenceWithPrefilter(
  difference: SpreadingDifference,
  prefilter: ReplenishmentPrefilter,
): boolean {
  if (prefilter.spreadingSessionId) {
    return (
      difference.spreadingOrderId === prefilter.spreadingSessionId ||
      difference.spreadingOrderNo === prefilter.spreadingSessionId ||
      difference.sourceObjectId === prefilter.spreadingSessionId
    )
  }
  if (prefilter.spreadingOrderId) {
    return difference.spreadingOrderId === prefilter.spreadingOrderId || difference.spreadingOrderNo === prefilter.spreadingOrderId
  }
  return false
}

function summarizeDifferenceTypes(differences: SpreadingDifference[]): string {
  if (!differences.length) return '无铺布差异'
  return uniqueStrings(differences.map((difference) => difference.differenceType)).join(' / ')
}

function buildDifferenceSummaryFromDifferences(
  differences: SpreadingDifference[],
  fallback: string,
): string {
  if (!differences.length) return fallback
  return differences
    .slice(0, 3)
    .map((difference) => {
      const planned = `${numberFormatter.format(difference.plannedValue)} ${difference.unit}`
      const actual = `${numberFormatter.format(difference.actualValue)} ${difference.unit}`
      const gap = `${numberFormatter.format(Math.abs(difference.differenceValue))} ${difference.unit}`
      return `${difference.differenceType}：计划 ${planned} / 实际 ${actual} / 差异 ${gap}`
    })
    .join('；')
}

function buildMajorGapSummaryFromDifferences(
  differences: SpreadingDifference[],
  fallback: string,
): string {
  const major = differences.find((difference) => difference.differenceLevel === '需处理') || differences[0]
  if (!major) return fallback
  return `${major.differenceType} ${numberFormatter.format(Math.abs(major.differenceValue))} ${major.unit}`
}

function buildHandlingStatusLabel(differences: SpreadingDifference[], review: ReplenishmentReview | null): string {
  if (review?.reviewResult) return `已处理：${formatReplenishmentReviewResultLabel(review.reviewResult)}`
  if (!differences.length) return '无差异事项'
  return uniqueStrings(differences.map((difference) => difference.handlingStatus)).join(' / ')
}

function buildReviewResultLabel(review: ReplenishmentReview | null): string {
  return formatReplenishmentReviewResultLabel(review?.reviewResult)
}

function buildNextActionLabel(review: ReplenishmentReview | null, nextOptions: ReplenishmentNextOption[]): string {
  return review?.reviewResult ? resolveNextActionFromReviewResult(normalizeReplenishmentReviewResult(review.reviewResult)) : buildNextActionSummary(nextOptions)
}

function collectLinkedLedgerEventIds(
  differences: SpreadingDifference[],
  review: ReplenishmentReview | null,
): string[] {
  return uniqueStrings([
    ...(review?.linkedLedgerEventIds || []),
    ...differences.flatMap((difference) => difference.linkedLedgerEventIds),
  ])
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
    suggestedAction: '请先确认这条现场反馈，并补齐差异处理依据。',
    riskLevel: 'MEDIUM' as const,
    createdAt: feedback.submittedAt,
    status: 'PENDING_REVIEW' as const,
    note: feedback.note,
    lines: [],
    context: buildSyntheticFeedbackContext(feedback),
    sourceDifferences: [],
    sourceDifferenceCount: 0,
    differenceTypeSummary: '现场反馈',
    handlingStatusLabel: '待处理',
    reviewResultLabel: '待判断',
    nextActionLabel: '补齐数据',
    closeReason: '',
    linkedLedgerEventIds: [],
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

function buildSyntheticDifferenceContext(difference: SpreadingDifference): ReplenishmentContextRecord {
  return {
    contextId: `ctx-${difference.differenceId}`,
    sourceType: 'spreading-session',
    baseSourceType: 'spreading-session',
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    productionOrderNos: [...difference.productionOrderNos],
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

function buildSyntheticDifferenceRow(difference: SpreadingDifference): ReplenishmentSuggestionRow {
  const suggestionId = difference.linkedReplenishmentId
  const navigationPayload = buildReplenishmentNavigationPayload({
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    productionOrderIds: [...difference.productionOrderIds],
    productionOrderNos: [...difference.productionOrderNos],
    materialSku: difference.materialSku,
  })
  const statusMeta = replenishmentStatusMetaMap.PENDING_REVIEW
  const row = {
    suggestionId,
    suggestionNo: `BL-${formatDateToken(difference.detectedAt)}-${difference.differenceId.slice(-2) || '01'}`,
    contextId: `ctx-${difference.differenceId}`,
    sourceType: 'spreading-session' as const,
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    productionOrderIds: [...difference.productionOrderIds],
    productionOrderNos: [...difference.productionOrderNos],
    styleCode: '',
    spuCode: '',
    styleName: '',
    materialSku: difference.materialSku,
    materialSkus: [difference.materialSku],
    materialCategory: '面料',
    materialAttr: difference.patternFileName,
    materialAlias: difference.materialAlias,
    materialImageUrl: difference.materialImageUrl,
    requiredGarmentQty: 0,
    theoreticalCutGarmentQty: 0,
    actualCutGarmentQty: 0,
    shortageGarmentQty: Math.max(difference.plannedValue - difference.actualValue, 0),
    actualLengthTotal: difference.actualValue,
    summaryRuleText: difference.evidence.summary,
    requiredQty: difference.plannedValue,
    estimatedCapacityQty: difference.actualValue,
    shortageQty: Math.max(difference.plannedValue - difference.actualValue, 0),
    configuredLengthTotal: difference.plannedValue,
    claimedLengthTotal: difference.actualValue,
    usableLengthTotal: 0,
    shortageLengthTotal: Math.max(difference.plannedValue - difference.actualValue, 0),
    varianceLength: difference.differenceValue,
    suggestedAction: '差异进入补料管理后，先审核处理结果，再决定是否补料。',
    riskLevel: difference.differenceLevel === '需处理' ? ('HIGH' as const) : ('MEDIUM' as const),
    createdAt: difference.detectedAt,
    status: 'PENDING_REVIEW' as const,
    note: difference.evidence.note || difference.evidence.summary,
    lines: [],
    context: buildSyntheticDifferenceContext(difference),
    sourceDifferences: [difference],
    sourceDifferenceCount: 1,
    differenceTypeSummary: difference.differenceType,
    handlingStatusLabel: difference.handlingStatus,
    reviewResultLabel: '待判断',
    nextActionLabel: '待审核',
    closeReason: '',
    linkedLedgerEventIds: [...difference.linkedLedgerEventIds],
    sourceLabel: replenishmentSourceMeta['spreading-session'].label,
    sourceSummary: `铺布单 ${difference.spreadingOrderNo}`,
    sourceProductionSummary: difference.productionOrderNos.join(' / ') || '待补',
    sourceOrderSummary: `${difference.spreadingOrderNo} · ${difference.cutOrderNos.join(' / ')}`,
    differenceSummary: buildDifferenceSummaryFromDifferences([difference], ''),
    majorGapSummary: buildMajorGapSummaryFromDifferences([difference], ''),
    review: null,
    reviewSummary: '待审核',
    reviewStatusLabel: '待审核',
    impactPlan: {
      impactPlanId: `impact-${suggestionId}`,
      suggestionId,
      needReconfigureMaterial: false,
      needReclaimMaterial: false,
      needPendingPrep: false,
      impactSummary: '待审核差异处理结果；由审核结果决定后续动作。',
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
    pdaFeedbacks: [],
    pendingPdaFeedbackCount: 0,
    latestPdaFeedback: null,
    latestPdaFeedbackSummary: '',
    claimedBalanceLength: 0,
    materialGapLength: Math.max(difference.plannedValue - difference.actualValue, 0),
    nextOptions: [
      {
        key: 'CHECK_DATA' as const,
        label: '处理差异',
        detailText: '处理结果只能选择发起布料或忽略。',
        target: 'markerSpreading' as const,
        className: 'bg-orange-100 text-orange-700',
      },
    ],
    nextActionSummary: '处理差异',
    blockingSummary: '',
    statusMeta,
    riskMeta: replenishmentRiskMetaMap[difference.differenceLevel === '需处理' ? 'HIGH' : 'MEDIUM'],
    navigationPayload,
    keywordIndex: lowerKeywordIndex([
      suggestionId,
      difference.differenceId,
      difference.spreadingOrderNo,
      difference.markerPlanNo,
      ...difference.cutOrderNos,
      ...difference.productionOrderNos,
      difference.materialSku,
      difference.materialAlias,
      difference.patternFileName,
      difference.differenceType,
      difference.evidence.summary,
    ]),
  }

  return {
    ...row,
    blockingSummary: buildBlockingSummary(row),
  }
}

function applyReviewToSyntheticDifferenceRow(
  row: ReplenishmentSuggestionRow,
  review: ReplenishmentReview | null | undefined,
): ReplenishmentSuggestionRow {
  if (!review) return row
  const followupAction =
    review.reviewResult
      ? buildReplenishmentFollowupActionForResult({
          suggestion: row,
          navigationPayload: row.navigationPayload,
          result: review.reviewResult,
          decidedAt: review.reviewedAt || row.createdAt,
          decidedBy: review.reviewedBy || '系统预置审核',
        })
      : null
  const followupActions = followupAction ? [followupAction] : []
  const impactPlan = buildImpactPlanFromActions({
    suggestion: row,
    actions: followupActions,
    review,
  })
  const statusMeta = deriveStatusMeta({
    suggestion: row,
    review,
    actions: followupActions,
  })
  const linkedLedgerEventIds = collectLinkedLedgerEventIds(row.sourceDifferences, review)
  const nextActionLabel = buildNextActionLabel(review, row.nextOptions)
  const nextRow = {
    ...row,
    review,
    reviewResultLabel: buildReviewResultLabel(review),
    nextActionLabel,
    closeReason: review.closeReason || '',
    linkedLedgerEventIds,
    reviewSummary: buildReviewSummary(review),
    reviewStatusLabel: buildReviewSummary(review),
    impactPlan,
    followupActions,
    followupActionCount: followupActions.length,
    pendingActionCount: followupActions.filter((item) => !['DONE', 'SKIPPED'].includes(item.status)).length,
    completedActionCount: followupActions.filter((item) => item.status === 'DONE').length,
    skippedActionCount: followupActions.filter((item) => item.status === 'SKIPPED').length,
    followupProgressText: buildFollowupProgressText(followupActions),
    nextActionSummary: nextActionLabel,
    statusMeta,
  }

  return {
    ...nextRow,
    blockingSummary: buildBlockingSummary(nextRow),
  }
}

function resolveReviewItemSourceType(row: ReplenishmentSuggestionRow): ReplenishmentReviewItemSourceType {
  const difference = row.sourceDifferences[0]
  if (difference?.differenceType === '卷记录异常') return '卷记录异常'
  if (difference?.differenceType === '布头布尾异常') return '布头布尾异常'
  if (difference?.differenceType === '面料余额不足') return '面料余额不足'
  if (difference?.sourceType === '领料差异延续') return '领料差异'
  if (difference?.sourceType === 'PDA 铺布回写') return 'PDA 铺布回写'
  if (difference?.sourceType === 'PDA 裁剪回写') return 'PDA 裁剪回写'
  if (difference?.sourceType === 'Web 处理') return 'Web 处理'
  if (row.latestPdaFeedback) return '现场反馈'
  return '其他异常'
}

function resolveReviewItemStatus(row: ReplenishmentSuggestionRow): ReplenishmentReviewItemStatus {
  if (row.review?.reviewStatus === 'APPROVED') return '已处理'
  if (row.review?.reviewStatus === 'PENDING_SUPPLEMENT') return '审核中'
  if (row.review?.reviewStatus === 'REJECTED') return '已取消'
  return '待审核'
}

function buildReviewEvidenceItems(row: ReplenishmentSuggestionRow): ReplenishmentEvidenceItem[] {
  const differenceEvidence = row.sourceDifferences.flatMap((difference) => {
    const items: ReplenishmentEvidenceItem[] = [
      {
        evidenceId: `${difference.differenceId}-summary`,
        evidenceType: difference.sourceType.includes('PDA') ? 'PDA 反馈' : difference.sourceType === '系统计算' ? '系统计算' : '备注',
        summary: difference.evidence.summary,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt,
      },
    ]
    if (difference.evidence.rollNos?.length) {
      items.push({
        evidenceId: `${difference.differenceId}-rolls`,
        evidenceType: '卷记录',
        summary: `关联布卷 ${difference.evidence.rollNos.join(' / ')}`,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt,
      })
    }
    if (difference.evidence.photoProofCount) {
      items.push({
        evidenceId: `${difference.differenceId}-photo`,
        evidenceType: '照片',
        summary: `现场照片 / 凭证 ${difference.evidence.photoProofCount} 个`,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt,
      })
    }
    return items
  })

  const feedbackEvidence = row.pdaFeedbacks.map((feedback) => ({
    evidenceId: feedback.writebackId,
    evidenceType: 'PDA 反馈' as const,
    summary: `${feedback.reasonLabel}；${feedback.note || '无补充说明'}；照片 / 凭证 ${feedback.photoProofCount} 个`,
    operatorName: feedback.operatorName,
    occurredAt: feedback.submittedAt,
  }))

  return [...differenceEvidence, ...feedbackEvidence]
}

export function buildReplenishmentReviewItem(row: ReplenishmentSuggestionRow): ReplenishmentReviewItem {
  const difference = row.sourceDifferences[0]
  const feedback = row.latestPdaFeedback
  const plannedValue = difference?.plannedValue ?? row.requiredQty
  const actualValue = difference?.actualValue ?? row.actualCutGarmentQty
  const differenceValue = difference?.differenceValue ?? row.varianceLength
  const materialColor = Array.from(new Set(row.lines.map((line) => line.color).filter(Boolean))).join(' / ') || '待补'

  return {
    replenishmentId: row.suggestionId,
    replenishmentNo: row.suggestionNo,
    sourceDifferenceId: difference?.differenceId || feedback?.writebackId || row.contextId,
    sourceType: resolveReviewItemSourceType(row),
    differenceType: difference?.differenceType || (feedback ? '现场反馈' : '其他异常'),
    differenceLevel: difference?.differenceLevel || row.riskMeta.label,
    productionOrderIds: [...row.productionOrderIds],
    cutOrderIds: [...row.cutOrderIds],
    spreadingOrderId: difference?.spreadingOrderId || row.context.session?.spreadingSessionId || '',
    spreadingOrderNo: difference?.spreadingOrderNo || row.context.session?.sessionNo || '',
    markerPlanId: row.markerPlanId,
    markerPlanNo: row.markerPlanNo,
    materialIdentity: {
      materialSku: row.materialSku,
      materialName: row.materialCategory || row.materialSku,
      materialColor,
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl,
      materialUnit: difference?.unit || '米',
    },
    patternIdentity: {
      patternFileName: difference?.patternFileName || row.materialAttr || '纸样待补',
      patternVersion: '技术包当前版',
      effectiveWidthText: '按裁片单纸样幅宽',
    },
    plannedValue,
    actualValue,
    differenceValue,
    unit: difference?.unit || '米',
    evidenceItems: buildReviewEvidenceItems(row),
    pdaFeedbackId: feedback?.writebackId || '',
    reviewStatus: resolveReviewItemStatus(row),
    reviewResult: row.review?.reviewResult ? normalizeReplenishmentReviewResult(row.review.reviewResult) : '',
    nextAction: row.review?.reviewResult ? resolveNextActionFromReviewResult(normalizeReplenishmentReviewResult(row.review.reviewResult)) : '',
    linkedLedgerEventIds: [...row.linkedLedgerEventIds],
    closeCutOrderRequired: false,
    closeReasonCode: '',
    closeReasonText: '',
    createdAt: row.createdAt,
    createdBy: difference?.detectedBy || feedback?.operatorName || '系统',
    reviewedAt: row.review?.reviewedAt || '',
    reviewedBy: row.review?.reviewedBy || '',
    remark: row.review?.note || row.note,
  }
}

function buildSeedReplenishmentReviews(differences: SpreadingDifference[]): ReplenishmentReview[] {
  const usedResults = new Set<ReplenishmentReviewResult>()
  const resultByDifferenceType: Partial<Record<SpreadingDifferenceType, ReplenishmentReviewResult>> = {
    面料余额不足: '需要补料',
    实际用量差异: '需要补料',
    实铺小于计划: '需要补料',
    实裁小于计划: '需要补料',
    卷记录异常: '仅记录差异',
  }

  return differences
    .map((difference): ReplenishmentReview | null => {
      const result = resultByDifferenceType[difference.differenceType]
      if (!result || usedResults.has(result)) return null
      usedResults.add(result)
      const nextAction = resolveNextActionFromReviewResult(result)
      return {
        reviewId: `seed-review-${difference.linkedReplenishmentId}`,
        suggestionId: difference.linkedReplenishmentId,
        reviewStatus: resolveReviewStatusFromResult(result),
        reviewResult: result,
        nextAction,
        closeReasonCode: undefined,
        closeReason: '',
        linkedLedgerEventIds: result === '仅记录差异' ? [] : difference.linkedLedgerEventIds,
        reviewedBy: '系统预置审核',
        reviewedAt: difference.detectedAt,
        decisionReason:
          result === '需要补料'
            ? '处理结果为发起布料，WMS 中转仓将创建新的配料。'
            : '处理结果为忽略，不创建配料，不改变数量账。',
        note: '用于原型覆盖差异处理的发起布料和忽略两种结果。',
      }
    })
    .filter((review): review is ReplenishmentReview => Boolean(review))
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

function normalizeFollowupActionType(value: unknown): ReplenishmentFollowupActionType {
  const candidate = String(value || '')
  if (
    candidate === 'CREATE_PENDING_PREP' ||
    candidate === 'SUPPLEMENT_BACKFILL' ||
    candidate === 'REPLAN_MARKER' ||
    candidate === 'CLOSE_CUT_ORDER' ||
    candidate === 'RECORD_ONLY'
  ) {
    return candidate
  }
  return 'CREATE_PENDING_PREP'
}

function normalizeFollowupTargetPageKey(
  value: unknown,
  actionType: ReplenishmentFollowupActionType,
): ReplenishmentFollowupTargetPageKey {
  const candidate = String(value || '')
  if (
    candidate === 'materialPrep' ||
    candidate === 'cuttablePool' ||
    candidate === 'cutOrders' ||
    candidate === 'markerSpreading' ||
    candidate === 'markerPlanSources'
  ) {
    return candidate
  }
  if (actionType === 'CREATE_PENDING_PREP') return 'materialPrep'
  if (actionType === 'SUPPLEMENT_BACKFILL') return 'markerSpreading'
  if (actionType === 'REPLAN_MARKER') return 'cuttablePool'
  return 'cutOrders'
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
        const actionType = normalizeFollowupActionType(item.actionType)
        const targetPageKey = normalizeFollowupTargetPageKey(item.targetPageKey, actionType)
        const actionMeta = replenishmentFollowupActionTypeMetaMap[actionType]
        return {
          actionId: String(item.actionId || `${suggestionId}-${actionType}`).trim() || `${suggestionId}-${actionType}`,
          suggestionId,
          actionType,
          title: String(item.title || actionMeta.label).trim() || actionMeta.label,
          status: ['PENDING', 'CONFIRMED', 'SKIPPED', 'DONE'].includes(String(item.status || ''))
            ? (item.status as ReplenishmentFollowupActionStatus)
            : 'PENDING',
          targetPageKey,
          targetPath: buildActionTargetPath(targetPageKey),
          targetQuery:
            item.targetQuery && typeof item.targetQuery === 'object'
              ? (item.targetQuery as Record<string, string | undefined>)
              : {},
          note:
            String(item.note || '').trim() ||
            (actionType === 'CREATE_PENDING_PREP'
              ? '发起布料后，WMS 中转仓创建新的配料，裁床后续重新领料。'
              : '忽略本次差异，不创建配料，不改变数量账。'),
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
  markerPlanSources: MarkerPlanSourceRecord[]
  markerStore: MarkerSpreadingStore
  reviews: ReplenishmentReview[]
  impactPlans: ReplenishmentImpactPlan[]
  actions: ReplenishmentFollowupAction[]
  pdaFeedbackWritebacks?: PdaReplenishmentFeedbackWritebackRecord[]
}): ReplenishmentViewModel {
  const cutOrderRowsById = Object.fromEntries(options.cutOrderRows.map((row) => [row.cutOrderId, row]))
  const impactsBySuggestionId = Object.fromEntries(options.impactPlans.map((plan) => [plan.suggestionId, plan]))
  const actionsBySuggestionId = options.actions.reduce<Record<string, ReplenishmentFollowupAction[]>>((accumulator, action) => {
    accumulator[action.suggestionId] = accumulator[action.suggestionId] || []
    accumulator[action.suggestionId].push(action)
    return accumulator
  }, {})
  const pdaFeedbackWritebacks =
    options.pdaFeedbackWritebacks ?? listPdaReplenishmentFeedbackWritebacks(getBrowserLocalStorage() || undefined)
  const spreadingDifferences = listSpreadingDifferences({ sessions: options.markerStore.sessions })
  const reviewsBySuggestionId = Object.fromEntries(
    [...buildSeedReplenishmentReviews(spreadingDifferences), ...options.reviews].map((review) => [review.suggestionId, review]),
  )
  const contexts = buildReplenishmentContextRecords({
    materialPrepRows: options.materialPrepRows,
    cutOrderRows: options.cutOrderRows,
    markerPlanSources: options.markerPlanSources,
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
    const matchedDifferences = spreadingDifferences.filter((difference) =>
      matchesSpreadingDifferenceWithSuggestion(difference, suggestion, context),
    )
    const claimedBalanceLength = buildClaimedBalanceLength(suggestion)
    const materialGapLength = buildMaterialGapLength(suggestion)
    const nextOptions = buildReplenishmentNextOptions(suggestion)
    const effectiveStatusMeta =
      (latestPdaFeedback || matchedDifferences.length > 0) &&
      ['NO_ACTION', 'COMPLETED', 'REJECTED'].includes(statusMeta.key)
        ? replenishmentStatusMetaMap.PENDING_REVIEW
        : statusMeta
    const linkedLedgerEventIds = collectLinkedLedgerEventIds(matchedDifferences, review)
    const row = {
      ...suggestion,
      context,
      sourceDifferences: matchedDifferences,
      sourceDifferenceCount: matchedDifferences.length,
      differenceTypeSummary: summarizeDifferenceTypes(matchedDifferences),
      handlingStatusLabel: buildHandlingStatusLabel(matchedDifferences, review),
      reviewResultLabel: buildReviewResultLabel(review),
      nextActionLabel: buildNextActionLabel(review, nextOptions),
      closeReason: review?.closeReason || '',
      linkedLedgerEventIds,
      sourceLabel,
      sourceSummary: buildSourceSummary(context),
      sourceProductionSummary: context.productionOrderNos.join(' / ') || '待补',
      sourceOrderSummary:
        context.baseSourceType === 'marker-plan'
          ? `${context.markerPlanNo || '待补唛架方案号'} · ${context.cutOrderNos.join(' / ')}`
          : context.cutOrderNos.join(' / ') || '待补',
      differenceSummary: buildDifferenceSummaryFromDifferences(matchedDifferences, buildDifferenceSummary(suggestion)),
      majorGapSummary: buildMajorGapSummaryFromDifferences(matchedDifferences, buildMajorGapSummary(suggestion)),
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
        summarizeDifferenceTypes(matchedDifferences),
        review?.reviewResult,
        review?.nextAction,
        review?.closeReason,
        ...matchedDifferences.flatMap((difference) => [
          difference.differenceId,
          difference.spreadingOrderNo,
          difference.differenceType,
          difference.handlingStatus,
          difference.evidence.summary,
        ]),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAlias)),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAttr)),
      ]),
    }

    return {
      ...row,
      blockingSummary: buildBlockingSummary(row),
    }
  }).filter((row) => row.sourceDifferences.length > 0 || row.pdaFeedbacks.length > 0 || Boolean(row.review) || row.followupActions.length > 0)

  const matchedFeedbackIds = new Set(rows.flatMap((row) => row.pdaFeedbacks.map((item) => item.writebackId)))
  const unmatchedFeedbackRows = pdaFeedbackWritebacks
    .filter((feedback) => !matchedFeedbackIds.has(feedback.writebackId))
    .map((feedback) => buildSyntheticFeedbackRow(feedback))
  const matchedDifferenceIds = new Set(rows.flatMap((row) => row.sourceDifferences.map((item) => item.differenceId)))
  const unmatchedDifferenceRows = spreadingDifferences
    .filter((difference) => !matchedDifferenceIds.has(difference.differenceId))
    .map((difference) => {
      const row = buildSyntheticDifferenceRow(difference)
      return applyReviewToSyntheticDifferenceRow(row, reviewsBySuggestionId[row.suggestionId])
    })

  const allRows = [...rows, ...unmatchedFeedbackRows, ...unmatchedDifferenceRows].sort((left, right) =>
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
    if (prefilter?.spreadingSessionId || prefilter?.spreadingOrderId) {
      const matchesSpreading =
        row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) ||
        row.context.session?.spreadingSessionId === prefilter.spreadingSessionId ||
        row.context.session?.sessionNo === prefilter.spreadingSessionId ||
        row.context.session?.spreadingSessionId === prefilter.spreadingOrderId ||
        row.context.session?.sessionNo === prefilter.spreadingOrderId
      if (!matchesSpreading) return false
      if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false
      if (filters.sourceType !== 'ALL' && row.sourceType !== filters.sourceType) return false
      if (filters.status !== 'ALL' && row.statusMeta.key !== filters.status) return false
      if (filters.riskLevel !== 'ALL' && row.riskLevel !== filters.riskLevel) return false
      if (filters.pendingReviewOnly && !['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(row.statusMeta.key)) return false
      if (filters.pendingActionOnly && !['APPROVED_PENDING_ACTION', 'IN_ACTION'].includes(row.statusMeta.key)) return false
      return true
    }

    if (prefilter?.suggestionId && row.suggestionId !== prefilter.suggestionId) return false
    if (prefilter?.suggestionNo && row.suggestionNo !== prefilter.suggestionNo) return false
    if (prefilter?.cutOrderNo && !row.cutOrderNos.includes(prefilter.cutOrderNo)) return false
    if (prefilter?.cutOrderId && !row.cutOrderIds.includes(prefilter.cutOrderId)) return false
    if (prefilter?.markerPlanNo && row.markerPlanNo !== prefilter.markerPlanNo) return false
    if (prefilter?.markerPlanId && row.markerPlanId !== prefilter.markerPlanId) return false
    if (prefilter?.productionOrderNo && !row.productionOrderNos.includes(prefilter.productionOrderNo)) return false
    if (prefilter?.materialSku && !row.materialSkus.includes(prefilter.materialSku)) return false
    if (prefilter?.color && !row.lines.some((line) => line.color === prefilter.color)) return false
    if (
      (prefilter?.spreadingSessionId || prefilter?.spreadingOrderId) &&
      !row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) &&
      row.context.session?.spreadingSessionId !== prefilter.spreadingSessionId &&
      row.context.session?.sessionNo !== prefilter.spreadingSessionId &&
      row.context.session?.spreadingSessionId !== prefilter.spreadingOrderId &&
      row.context.session?.sessionNo !== prefilter.spreadingOrderId
    ) {
      return false
    }
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
  if (prefilter.spreadingSessionId || prefilter.spreadingOrderId) {
    return (
      rows.find((row) =>
        row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) ||
        row.context.session?.spreadingSessionId === prefilter.spreadingSessionId ||
        row.context.session?.sessionNo === prefilter.spreadingSessionId ||
        row.context.session?.spreadingSessionId === prefilter.spreadingOrderId ||
        row.context.session?.sessionNo === prefilter.spreadingOrderId,
      ) || null
    )
  }
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
      if (
        (prefilter.spreadingSessionId || prefilter.spreadingOrderId) &&
        (row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) ||
          row.context.session?.spreadingSessionId === prefilter.spreadingSessionId ||
          row.context.session?.sessionNo === prefilter.spreadingSessionId ||
          row.context.session?.spreadingSessionId === prefilter.spreadingOrderId ||
          row.context.session?.sessionNo === prefilter.spreadingOrderId)
      ) {
        return true
      }
      return false
    }) || null
  )
}
