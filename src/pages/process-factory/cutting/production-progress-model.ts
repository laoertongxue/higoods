import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingUrgencyLevel,
  CuttingSkuRequirementLine,
} from '../../../data/fcs/cutting/types'
import { listGeneratedOriginalCutOrderSourceRecords } from '../../../data/fcs/cutting/generated-original-cut-orders.ts'
import {
  buildProductionPieceProgressViewModelFromTruth,
  type ProductionPieceProgressViewModel,
} from './production-piece-progress'
import {
  buildProductionPieceTruth,
  buildProductionPieceTruthCompletion,
  productionPieceTruthCompletionMetaMap,
  type PieceTruthOverlaySignal,
  type ProductionPieceTruthCompletionKey,
  type ProductionPieceTruthResult,
} from '../../../domain/fcs-cutting-piece-truth'
import {
  listPdaPickupWritebacks,
  listPdaInboundWritebacks,
  listPdaHandoverWritebacks,
  listPdaReplenishmentFeedbackWritebacks,
  type PdaCutPieceHandoverWritebackRecord,
  type PdaCutPieceInboundWritebackRecord,
  type PdaPickupWritebackRecord,
  type PdaReplenishmentFeedbackWritebackRecord,
} from '../../../data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { getBrowserLocalStorage } from '../../../data/browser-storage'

const PRODUCTION_PROGRESS_REFERENCE_DATE = '2026-03-24'
const DAY_IN_MS = 24 * 60 * 60 * 1000

// 试运行规则：距离发货 8 / 10 / 13 天内分别落 AA / A / B，超出后再按订单大小划 C / D。
// 后续如业务调整紧急度阈值，应只改这组常量，不要把规则散落到页面渲染层。
export const LARGE_ORDER_QTY_THRESHOLD = 4500

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type ProductionProgressUrgencyKey = CuttingUrgencyLevel | 'UNKNOWN'
export type ProductionProgressReceiveKey = 'NOT_RECEIVED' | 'PARTIAL' | 'RECEIVED' | 'EXCEPTION'
export type ProductionProgressStageKey = 'WAITING_PREP' | 'PREPPING' | 'WAITING_CLAIM' | 'CUTTING' | 'WAITING_INBOUND' | 'DONE'
export type ProductionProgressCompletionKey = ProductionPieceTruthCompletionKey
export type ProductionPieceCompletionKey = ProductionPieceTruthCompletionKey
export type ProductionProgressShipDeltaDirection = 'BEFORE' | 'OVERDUE' | 'UNKNOWN'
export type ProductionProgressShipDeltaRangeKey =
  | 'BEFORE_0_3'
  | 'BEFORE_4_6'
  | 'BEFORE_7_9'
  | 'BEFORE_10_13'
  | 'BEFORE_14_PLUS'
  | 'OVERDUE_0_3'
  | 'OVERDUE_4_6'
  | 'OVERDUE_7_PLUS'
  | 'SHIP_DATE_MISSING'
export type ProductionProgressRiskKey =
  | 'CONFIG_DELAY'
  | 'SHIP_URGENT'
  | 'REPLENISH_PENDING'
  | 'PIECE_GAP'
export type ProductionProgressSortKey = 'URGENCY_THEN_SHIP' | 'SHIP_DATE_ASC' | 'ORDER_QTY_DESC'

export interface ProductionProgressSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface ProductionProgressRiskTag {
  key: ProductionProgressRiskKey
  label: string
  className: string
}

export interface ProductionProgressMaterialPrepLine {
  materialLabel: string
  materialSku: string
  preparedQty: number
  totalQty: number
}

export interface ProductionProgressMaterialClaimLine {
  materialLabel: string
  materialSku: string
  claimedQty: number
  preparedQty: number
}

export interface ProductionProgressSkuProgressLine {
  skuLabel: string
  skuDetailLabel: string
  demandQty: number
  cutQty: number
  inboundQty: number
  completionLabel: string
  completionClassName: string
}

export interface ProductionProgressPartDifferenceSummary {
  completedPieceQty: number
  incompletePieceQty: number
}

export interface ProductionProgressSourceOrderProgressLine {
  originalCutOrderNo: string
  materialSku: string
  skuCount: number
  incompletePieceQty: number
  currentStateLabel: string
}

export interface ProductionProgressRow {
  id: string
  productionOrderId: string
  productionOrderNo: string
  purchaseDate: string
  actualOrderDate: string
  plannedShipDate: string
  plannedShipDateDisplay: string
  orderQty: number
  spuCode: string
  styleCode: string
  styleName: string
  cuttingTaskNo: string
  assignedFactoryName: string
  urgency: {
    key: ProductionProgressUrgencyKey
    label: string
    className: string
    sortWeight: number
    detailText: string
  }
  shipDeltaDays: number | null
  shipDeltaDirection: ProductionProgressShipDeltaDirection
  shipDeltaRange: ProductionProgressShipDeltaRangeKey
  shipCountdownText: string
  materialPrepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>
  materialClaimSummary: ProductionProgressSummaryMeta<ProductionProgressReceiveKey>
  materialPrepLines: ProductionProgressMaterialPrepLine[]
  materialClaimLines: ProductionProgressMaterialClaimLine[]
  currentStage: {
    key: ProductionProgressStageKey
    label: string
    className: string
  }
  cuttingCompletionSummary: ProductionProgressSummaryMeta<ProductionProgressCompletionKey>
  pieceCompletionSummary: ProductionProgressSummaryMeta<ProductionPieceCompletionKey>
  pieceTruth: ProductionPieceTruthResult
  skuProgressLines: ProductionProgressSkuProgressLine[]
  sourceOrderProgressLines: ProductionProgressSourceOrderProgressLine[]
  partDifferenceSummary: ProductionProgressPartDifferenceSummary
  riskTags: ProductionProgressRiskTag[]
  originalCutOrderCount: number
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  techPackSpuCode: string
  skuRequirementLines: CuttingSkuRequirementLine[]
  pieceProgress: ProductionPieceProgressViewModel
  skuTotalCount: number
  completedSkuCount: number
  incompleteSkuCount: number
  incompleteOriginalOrderCount: number
  incompletePartCount: number
  affectedMaterialCount: number
  pieceGapQty: number
  inboundGapQty: number
  pieceMappingWarningCount: number
  pieceDataIssueCount: number
  primaryGapObjectLabel: string
  primaryGapMaterialSku: string
  primaryGapPartName: string
  mainNextActionLabel: string
  dataStateLabel: string
  hasPieceGap: boolean
  hasMappingWarnings: boolean
  filterPayloadForOriginalOrders: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForMaterialPrep: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForCuttablePool: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForSummary: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForMarkerSpreading: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForFeiTickets: {
    productionOrderId: string
    productionOrderNo: string
  }
  latestUpdatedAt: string
  latestPickupScanAt: string
  latestOperatorName: string
  rawStageText: string
  hasSpreadingRecord: boolean
  hasInboundRecord: boolean
  materialLines: CuttingMaterialLine[]
  keywordIndex: string[]
}

export interface ProductionProgressFilters {
  keyword: string
  productionOrderNo: string
  urgencyLevel: 'ALL' | ProductionProgressUrgencyKey
  shipDeltaRange: 'ALL' | ProductionProgressShipDeltaRangeKey
  currentStage: 'ALL' | ProductionProgressStageKey
  completionState: 'ALL' | ProductionPieceTruthCompletionKey
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | ProductionProgressReceiveKey
  riskFilter: 'ALL' | 'ANY' | ProductionProgressRiskKey
  sortBy: ProductionProgressSortKey
}

export interface ProductionProgressSummary {
  totalCount: number
  urgentCount: number
  prepExceptionCount: number
  claimExceptionCount: number
  cuttingCount: number
  doneCount: number
}

export const urgencyMeta: Record<ProductionProgressUrgencyKey, { label: string; className: string; sortWeight: number }> = {
  AA: { label: 'AA 紧急', className: 'bg-rose-100 text-rose-700 border border-rose-200', sortWeight: 5 },
  A: { label: 'A 紧急', className: 'bg-orange-100 text-orange-700 border border-orange-200', sortWeight: 4 },
  B: { label: 'B 紧急', className: 'bg-amber-100 text-amber-700 border border-amber-200', sortWeight: 3 },
  C: { label: 'C 优先', className: 'bg-sky-100 text-sky-700 border border-sky-200', sortWeight: 2 },
  D: { label: 'D 常规', className: 'bg-slate-100 text-slate-700 border border-slate-200', sortWeight: 1 },
  UNKNOWN: { label: '待补日期', className: 'bg-slate-100 text-slate-600 border border-slate-200', sortWeight: 0 },
}

export const configMeta: Record<CuttingConfigStatus, { label: string; className: string }> = {
  NOT_CONFIGURED: { label: '未配置', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分配置', className: 'bg-orange-100 text-orange-700' },
  CONFIGURED: { label: '已配置', className: 'bg-emerald-100 text-emerald-700' },
}

export const receiveMeta: Record<ProductionProgressReceiveKey, { label: string; className: string }> = {
  NOT_RECEIVED: { label: '待领取', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分领取', className: 'bg-orange-100 text-orange-700' },
  RECEIVED: { label: '领料成功', className: 'bg-emerald-100 text-emerald-700' },
  EXCEPTION: { label: '领取异常', className: 'bg-rose-100 text-rose-700' },
}

export const stageMeta: Record<ProductionProgressStageKey, { label: string; className: string }> = {
  WAITING_PREP: { label: '待配料', className: 'bg-slate-100 text-slate-700' },
  PREPPING: { label: '配料中', className: 'bg-amber-100 text-amber-700' },
  WAITING_CLAIM: { label: '待领料', className: 'bg-blue-100 text-blue-700' },
  CUTTING: { label: '裁剪中', className: 'bg-violet-100 text-violet-700' },
  WAITING_INBOUND: { label: '待入仓', className: 'bg-sky-100 text-sky-700' },
  DONE: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export const completionMeta: Record<ProductionProgressCompletionKey, { label: string; className: string }> =
  productionPieceTruthCompletionMetaMap

export const pieceCompletionMeta: Record<ProductionPieceCompletionKey, { label: string; className: string }> =
  productionPieceTruthCompletionMetaMap

export const riskMeta: Record<ProductionProgressRiskKey, { label: string; className: string }> = {
  CONFIG_DELAY: { label: '配料滞后', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  PIECE_GAP: { label: '裁片缺口', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
}

export const shipDeltaRangeMeta: Record<ProductionProgressShipDeltaRangeKey, { label: string }> = {
  BEFORE_0_3: { label: '距计划发货 0~3 天' },
  BEFORE_4_6: { label: '距计划发货 4~6 天' },
  BEFORE_7_9: { label: '距计划发货 7~9 天' },
  BEFORE_10_13: { label: '距计划发货 10~13 天' },
  BEFORE_14_PLUS: { label: '距计划发货 14 天以上' },
  OVERDUE_0_3: { label: '超计划发货 0~3 天' },
  OVERDUE_4_6: { label: '超计划发货 4~6 天' },
  OVERDUE_7_PLUS: { label: '超计划发货 7 天以上' },
  SHIP_DATE_MISSING: { label: '计划发货日期待补' },
}

export function formatQty(value: number): string {
  return numberFormatter.format(value)
}

function formatCountSummary(done: number, total: number, suffix: string): string {
  return `${done}/${total} ${suffix}`
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

function makeProductionProgressSkuKey(line: { skuCode?: string; color?: string; size?: string }): string {
  const skuCode = String(line.skuCode || '').trim().toLowerCase()
  if (skuCode) return `sku:${skuCode}`
  return `color-size:${String(line.color || '').trim().toLowerCase()}::${String(line.size || '').trim().toLowerCase()}`
}

function makeProductionProgressOriginalOrderKey(line: {
  productionOrderId: string
  originalCutOrderNo: string
  materialSku: string
}): string {
  return [line.productionOrderId, line.originalCutOrderNo, line.materialSku].map((item) => String(item || '').trim().toLowerCase()).join('::')
}

function getDaysToShip(plannedShipDate: string, referenceDate = PRODUCTION_PROGRESS_REFERENCE_DATE): number | null {
  const plannedDate = parseDateOnly(plannedShipDate)
  const reference = parseDateOnly(referenceDate)
  if (!plannedDate || !reference) return null
  return Math.ceil((plannedDate.getTime() - reference.getTime()) / DAY_IN_MS)
}

function buildUrgencyView(plannedShipDate: string, orderQty: number) {
  const daysToShip = getDaysToShip(plannedShipDate)
  if (daysToShip === null) {
    const meta = urgencyMeta.UNKNOWN
    return {
      key: 'UNKNOWN' as const,
      label: meta.label,
      className: meta.className,
      sortWeight: meta.sortWeight,
      detailText: '计划发货日期待补',
    }
  }

  let key: ProductionProgressUrgencyKey
  if (daysToShip <= 8) {
    key = 'AA'
  } else if (daysToShip <= 10) {
    key = 'A'
  } else if (daysToShip <= 13) {
    key = 'B'
  } else if (orderQty >= LARGE_ORDER_QTY_THRESHOLD) {
    key = 'C'
  } else {
    key = 'D'
  }

  const meta = urgencyMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    sortWeight: meta.sortWeight,
    detailText: daysToShip >= 0 ? `距计划发货 ${daysToShip} 天` : `已超计划发货 ${Math.abs(daysToShip)} 天`,
  }
}

function buildShipCountdownText(plannedShipDate: string): string {
  const daysToShip = getDaysToShip(plannedShipDate)
  if (daysToShip === null) return '计划发货日期待补'
  if (daysToShip >= 0) return `距计划发货 ${daysToShip} 天`
  return `已超计划发货 ${Math.abs(daysToShip)} 天`
}

function buildShipDeltaDirection(daysToShip: number | null): ProductionProgressShipDeltaDirection {
  if (daysToShip === null) return 'UNKNOWN'
  if (daysToShip >= 0) return 'BEFORE'
  return 'OVERDUE'
}

function buildShipDeltaRange(daysToShip: number | null): ProductionProgressShipDeltaRangeKey {
  if (daysToShip === null) return 'SHIP_DATE_MISSING'
  if (daysToShip >= 0) {
    if (daysToShip <= 3) return 'BEFORE_0_3'
    if (daysToShip <= 6) return 'BEFORE_4_6'
    if (daysToShip <= 9) return 'BEFORE_7_9'
    if (daysToShip <= 13) return 'BEFORE_10_13'
    return 'BEFORE_14_PLUS'
  }

  const overdueDays = Math.abs(daysToShip)
  if (overdueDays <= 3) return 'OVERDUE_0_3'
  if (overdueDays <= 6) return 'OVERDUE_4_6'
  return 'OVERDUE_7_PLUS'
}

function buildConfigSummary(lines: CuttingMaterialLine[]): ProductionProgressSummaryMeta<CuttingConfigStatus> {
  const configuredCount = lines.filter((line) => line.configStatus === 'CONFIGURED').length
  const partialCount = lines.filter((line) => line.configStatus === 'PARTIAL').length
  const total = lines.length

  if (configuredCount === total) {
    const meta = configMeta.CONFIGURED
    return { key: 'CONFIGURED', label: meta.label, className: meta.className, detailText: formatCountSummary(configuredCount, total, '已配置') }
  }
  if (configuredCount > 0 || partialCount > 0) {
    const meta = configMeta.PARTIAL
    return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: formatCountSummary(configuredCount + partialCount, total, '已介入') }
  }

  const meta = configMeta.NOT_CONFIGURED
  return { key: 'NOT_CONFIGURED', label: meta.label, className: meta.className, detailText: `待配置 ${total} 项` }
}

function buildReceiveSummary(lines: CuttingMaterialLine[]): ProductionProgressSummaryMeta<ProductionProgressReceiveKey> {
  const total = lines.length
  const receivedCount = lines.filter((line) => line.receiveStatus === 'RECEIVED').length
  const partialCount = lines.filter((line) => line.receiveStatus === 'PARTIAL').length
  const exceptionCount = lines.filter((line) => line.issueFlags.includes('RECEIVE_DIFF')).length

  if (exceptionCount > 0) {
    const meta = receiveMeta.EXCEPTION
    return {
      key: 'EXCEPTION',
      label: meta.label,
      className: meta.className,
      detailText: `异常 ${exceptionCount} 项 / 已领 ${receivedCount + partialCount}/${total}`,
    }
  }
  if (receivedCount === total) {
    const meta = receiveMeta.RECEIVED
    return { key: 'RECEIVED', label: meta.label, className: meta.className, detailText: formatCountSummary(receivedCount, total, '已领取') }
  }
  if (receivedCount > 0 || partialCount > 0) {
    const meta = receiveMeta.PARTIAL
    return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: formatCountSummary(receivedCount + partialCount, total, '已介入') }
  }

  const meta = receiveMeta.NOT_RECEIVED
  return { key: 'NOT_RECEIVED', label: meta.label, className: meta.className, detailText: `待领取 ${total} 项` }
}

function buildCurrentStage(
  record: CuttingOrderProgressRecord,
  prepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>,
  claimSummary: ProductionProgressSummaryMeta<ProductionProgressReceiveKey>,
) {
  let key: ProductionProgressStageKey

  if (record.hasInboundRecord || /已完成|完成/.test(record.cuttingStage)) {
    key = 'DONE'
  } else if (/待入仓/.test(record.cuttingStage) || record.riskFlags.includes('INBOUND_PENDING')) {
    key = 'WAITING_INBOUND'
  } else if (record.hasSpreadingRecord || /裁片中|裁剪中|领料完成/.test(record.cuttingStage)) {
    key = 'CUTTING'
  } else if (claimSummary.key !== 'NOT_RECEIVED' || /待领料|领料/.test(record.cuttingStage)) {
    key = 'WAITING_CLAIM'
  } else if (prepSummary.key === 'PARTIAL' || /配料中/.test(record.cuttingStage)) {
    key = 'PREPPING'
  } else {
    key = 'WAITING_PREP'
  }

  return {
    key,
    label: stageMeta[key].label,
    className: stageMeta[key].className,
  }
}

function buildPieceTruthOverlaySignals(
  record: CuttingOrderProgressRecord,
  options: ProductionProgressRuntimeOptions = {},
): PieceTruthOverlaySignal[] {
  const productionOrderMatches = (value: { productionOrderId: string; productionOrderNo: string }) =>
    value.productionOrderId === record.productionOrderId || value.productionOrderNo === record.productionOrderNo

  const toSignal = (
    sourceType: PieceTruthOverlaySignal['sourceType'],
    item: {
      productionOrderId: string
      productionOrderNo: string
      originalCutOrderId: string
      originalCutOrderNo: string
      mergeBatchId: string
      mergeBatchNo: string
      cutPieceOrderNo: string
      materialSku: string
      submittedAt: string
      operatorName: string
      note?: string
    },
  ): PieceTruthOverlaySignal => ({
    sourceType,
    productionOrderId: item.productionOrderId,
    productionOrderNo: item.productionOrderNo,
    originalCutOrderId: item.originalCutOrderId,
    originalCutOrderNo: item.originalCutOrderNo,
    mergeBatchId: item.mergeBatchId,
    mergeBatchNo: item.mergeBatchNo,
    cutPieceOrderNo: item.cutPieceOrderNo,
    materialSku: item.materialSku,
    latestUpdatedAt: item.submittedAt,
    latestOperatorName: item.operatorName,
    note: item.note,
  })

  const storage = getBrowserLocalStorage() || undefined
  const pickupWritebacks = options.pickupWritebacks ?? listPdaPickupWritebacks(storage)
  const inboundWritebacks = options.inboundWritebacks ?? listPdaInboundWritebacks(storage)
  const handoverWritebacks = options.handoverWritebacks ?? listPdaHandoverWritebacks(storage)
  const replenishmentFeedbackWritebacks =
    options.replenishmentFeedbackWritebacks ?? listPdaReplenishmentFeedbackWritebacks(storage)

  return [
    ...pickupWritebacks
      .filter(productionOrderMatches)
      .map((item) => toSignal('PICKUP', item)),
    ...inboundWritebacks
      .filter(productionOrderMatches)
      .map((item) => toSignal('INBOUND', item)),
    ...handoverWritebacks
      .filter(productionOrderMatches)
      .map((item) => toSignal('HANDOVER', item)),
    ...replenishmentFeedbackWritebacks
      .filter(productionOrderMatches)
      .map((item) => toSignal('REPLENISHMENT', item)),
  ]
}

function buildProductionCompletionSummary(
  truth: ProductionPieceTruthResult,
  options: {
    prepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>
    claimSummary: ProductionProgressSummaryMeta<ProductionProgressReceiveKey>
    record: CuttingOrderProgressRecord
  },
): ProductionProgressSummaryMeta<ProductionPieceCompletionKey> {
  const objectExceptionReason =
    options.claimSummary.key === 'EXCEPTION' ? options.claimSummary.detailText : undefined
  const objectPendingReason =
    options.prepSummary.key !== 'CONFIGURED'
      ? options.prepSummary.detailText
      : options.claimSummary.key !== 'RECEIVED'
        ? options.claimSummary.detailText
        : options.record.riskFlags.includes('REPLENISH_PENDING')
          ? '当前仍有待补料项，需继续处理。'
          : undefined
  const completionMeta = buildProductionPieceTruthCompletion(truth, {
    hasObjectException: Boolean(objectExceptionReason),
    hasObjectPending: Boolean(objectPendingReason),
    objectExceptionReason,
    objectPendingReason,
  })

  return {
    key: completionMeta.key,
    label: completionMeta.label,
    className: completionMeta.className,
    detailText: completionMeta.detailText,
  }
}

function buildRiskTags(
  record: CuttingOrderProgressRecord,
  prepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>,
  urgencyKey: ProductionProgressUrgencyKey,
  pieceTruth: ProductionPieceTruthResult,
): ProductionProgressRiskTag[] {
  const tags: ProductionProgressRiskTag[] = []

  const pushRisk = (key: ProductionProgressRiskKey) => {
    if (tags.some((item) => item.key === key)) return
    tags.push({ key, label: riskMeta[key].label, className: riskMeta[key].className })
  }

  if (prepSummary.key !== 'CONFIGURED') {
    pushRisk('CONFIG_DELAY')
  }
  if (record.riskFlags.includes('REPLENISH_PENDING')) {
    pushRisk('REPLENISH_PENDING')
  }
  if (pieceTruth.gapRows.some((row) => row.gapCutQty > 0 || row.gapInboundQty > 0)) {
    pushRisk('PIECE_GAP')
  }
  if (urgencyKey === 'AA' || urgencyKey === 'A') {
    pushRisk('SHIP_URGENT')
  }

  return tags
}

function buildMaterialRequirementMap(): Map<string, number> {
  const requirementMap = new Map<string, number>()
  listGeneratedOriginalCutOrderSourceRecords().forEach((record) => {
    const key = `${record.productionOrderId}::${record.materialSku}`.toLowerCase()
    requirementMap.set(key, (requirementMap.get(key) || 0) + Number(record.requiredQty || 0))
  })
  return requirementMap
}

function buildSkuPieceRequirementMap(): Map<string, number> {
  const requirementMap = new Map<string, number>()
  listGeneratedOriginalCutOrderSourceRecords().forEach((record) => {
    record.skuScopeLines.forEach((scopeLine) => {
      const pieceCountPerUnit = record.pieceRows
        .filter((pieceRow) => !pieceRow.applicableSkuCodes.length || pieceRow.applicableSkuCodes.includes(scopeLine.skuCode))
        .reduce((sum, pieceRow) => sum + Number(pieceRow.pieceCountPerUnit || 0), 0)
      const key = `${record.productionOrderId.toLowerCase()}::${makeProductionProgressSkuKey(scopeLine)}`
      requirementMap.set(key, (requirementMap.get(key) || 0) + Number(scopeLine.plannedQty || 0) * pieceCountPerUnit)
    })
  })
  return requirementMap
}

function buildOriginalOrderRequirementMap(): Map<
  string,
  {
    requiredPieceQty: number
    skuCodes: Set<string>
  }
> {
  const requirementMap = new Map<
    string,
    {
      requiredPieceQty: number
      skuCodes: Set<string>
    }
  >()

  listGeneratedOriginalCutOrderSourceRecords().forEach((record) => {
    const key = makeProductionProgressOriginalOrderKey({
      productionOrderId: record.productionOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      materialSku: record.materialSku,
    })
    const current = requirementMap.get(key) || { requiredPieceQty: 0, skuCodes: new Set<string>() }
    record.skuScopeLines.forEach((scopeLine) => {
      const pieceCountPerUnit = record.pieceRows
        .filter((pieceRow) => !pieceRow.applicableSkuCodes.length || pieceRow.applicableSkuCodes.includes(scopeLine.skuCode))
        .reduce((sum, pieceRow) => sum + Number(pieceRow.pieceCountPerUnit || 0), 0)
      current.requiredPieceQty += Number(scopeLine.plannedQty || 0) * pieceCountPerUnit
      if (scopeLine.skuCode) current.skuCodes.add(scopeLine.skuCode)
    })
    requirementMap.set(key, current)
  })

  return requirementMap
}

function buildMaterialPrepLines(
  record: CuttingOrderProgressRecord,
  requirementMap: Map<string, number>,
): ProductionProgressMaterialPrepLine[] {
  const grouped = new Map<string, ProductionProgressMaterialPrepLine>()
  record.materialLines.forEach((line) => {
    const key = line.materialSku.toLowerCase()
    const requirementKey = `${record.productionOrderId}::${line.materialSku}`.toLowerCase()
    const current = grouped.get(key) || {
      materialLabel: line.materialLabel || line.materialSku,
      materialSku: line.materialSku,
      preparedQty: 0,
      totalQty: 0,
    }
    current.preparedQty += Number(line.configuredLength || 0)
    current.totalQty = Math.max(
      current.totalQty,
      Number(requirementMap.get(requirementKey) || 0),
      current.preparedQty,
      Number(line.receivedLength || 0),
    )
    grouped.set(key, current)
  })

  return Array.from(grouped.values()).sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'))
}

function buildMaterialClaimLines(record: CuttingOrderProgressRecord): ProductionProgressMaterialClaimLine[] {
  const grouped = new Map<string, ProductionProgressMaterialClaimLine>()
  record.materialLines.forEach((line) => {
    const key = line.materialSku.toLowerCase()
    const current = grouped.get(key) || {
      materialLabel: line.materialLabel || line.materialSku,
      materialSku: line.materialSku,
      claimedQty: 0,
      preparedQty: 0,
    }
    current.claimedQty += Number(line.receivedLength || 0)
    current.preparedQty += Number(line.configuredLength || 0)
    grouped.set(key, current)
  })

  return Array.from(grouped.values()).sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'))
}

function buildProgressStateLabel(options: {
  requiredPieceQty: number
  actualCutQty: number
  inboundQty: number
  hasConfiguredQty: boolean
  hasReceivedQty: boolean
}): string {
  if (!options.hasConfiguredQty && !options.hasReceivedQty && options.actualCutQty <= 0 && options.inboundQty <= 0) {
    return '待配料 / 待领料'
  }
  if (options.actualCutQty <= 0) {
    return '待铺布'
  }
  if (options.requiredPieceQty > 0 && options.actualCutQty < options.requiredPieceQty) {
    return '裁片未齐'
  }
  if (options.requiredPieceQty > 0 && options.inboundQty < options.requiredPieceQty) {
    return options.inboundQty > 0 ? '入仓数据待补' : '裁完待入仓'
  }
  return '已齐套'
}

function resolveProgressStateClassName(label: string): string {
  if (label === '已齐套') return 'text-emerald-700'
  if (label === '待配料 / 待领料' || label === '待铺布') return 'text-amber-700'
  return 'text-orange-700'
}

function resolveSkuProgressClassName(row: ProductionPieceTruthResult['skuRows'][number]): string {
  if (row.mappingStatus !== 'MATCHED') return 'text-amber-700'
  if (row.gapCutQty > 0 || row.gapInboundQty > 0) return 'text-orange-700'
  return 'text-emerald-700'
}

function buildSkuProgressLines(
  record: CuttingOrderProgressRecord,
  truth: ProductionPieceTruthResult,
  skuPieceRequirementMap: Map<string, number>,
): ProductionProgressSkuProgressLine[] {
  const grouped = new Map<
    string,
    {
      skuLabel: string
      skuDetailLabel: string
      demandQty: number
      cutQty: number
      inboundQty: number
      hasConfiguredQty: boolean
      hasReceivedQty: boolean
      requiredPieceQty: number
    }
  >()

  ;(record.skuRequirementLines || []).forEach((line) => {
    const key = makeProductionProgressSkuKey(line)
    grouped.set(key, {
      skuLabel: line.skuCode || '未命名 SKU',
      skuDetailLabel: [line.color, line.size].filter(Boolean).join(' / '),
      demandQty: Number(line.plannedQty || 0),
      cutQty: 0,
      inboundQty: 0,
      hasConfiguredQty: false,
      hasReceivedQty: false,
      requiredPieceQty: Number(skuPieceRequirementMap.get(`${record.productionOrderId.toLowerCase()}::${key}`) || 0),
    })
  })

  record.materialLines.forEach((materialLine) => {
    ;(materialLine.skuScopeLines || []).forEach((scopeLine) => {
      const key = makeProductionProgressSkuKey(scopeLine)
      const current = grouped.get(key)
      if (current) {
        current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0
        current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0
      }
    })

    ;(materialLine.pieceProgressLines || []).forEach((pieceLine) => {
      const key = makeProductionProgressSkuKey(pieceLine)
      const current =
        grouped.get(key) ||
        {
          skuLabel: pieceLine.skuCode || '未命名 SKU',
          skuDetailLabel: [pieceLine.color, pieceLine.size].filter(Boolean).join(' / '),
          demandQty: 0,
          cutQty: 0,
          inboundQty: 0,
          hasConfiguredQty: Number(materialLine.configuredLength || 0) > 0,
          hasReceivedQty: Number(materialLine.receivedLength || 0) > 0,
          requiredPieceQty: Number(skuPieceRequirementMap.get(`${record.productionOrderId.toLowerCase()}::${key}`) || 0),
        }
      current.cutQty += Number(pieceLine.actualCutQty || 0)
      current.inboundQty += Number(pieceLine.inboundQty || 0)
      current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0
      current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0
      grouped.set(key, current)
    })
  })

  const lines = Array.from(grouped.values())
    .map((row) => {
      const completionLabel = buildProgressStateLabel({
        requiredPieceQty: row.requiredPieceQty,
        actualCutQty: row.cutQty,
        inboundQty: row.inboundQty,
        hasConfiguredQty: row.hasConfiguredQty,
        hasReceivedQty: row.hasReceivedQty,
      })

      return {
        skuLabel: row.skuLabel,
        skuDetailLabel: row.skuDetailLabel,
        demandQty: row.demandQty,
        cutQty: row.cutQty,
        inboundQty: row.inboundQty,
        completionLabel,
        completionClassName: resolveProgressStateClassName(completionLabel),
      }
    })
    .sort((left, right) => left.skuLabel.localeCompare(right.skuLabel, 'zh-CN'))

  if (lines.length) return lines

  return truth.skuRows.map((row) => {
    const detailLabel = [row.color, row.size].filter(Boolean).join(' / ')
    return {
      skuLabel: row.skuCode || '未命名 SKU',
      skuDetailLabel: detailLabel,
      demandQty: row.requiredGarmentQty,
      cutQty: row.actualCutQty,
      inboundQty: row.inboundQty,
      completionLabel: row.currentStateLabel,
      completionClassName: resolveSkuProgressClassName(row),
    }
  })
}

function buildSourceOrderProgressLines(
  record: CuttingOrderProgressRecord,
  originalOrderRequirementMap: Map<string, { requiredPieceQty: number; skuCodes: Set<string> }>,
  truth: ProductionPieceTruthResult,
): ProductionProgressSourceOrderProgressLine[] {
  const grouped = new Map<
    string,
    {
      originalCutOrderNo: string
      materialSku: string
      skuCodes: Set<string>
      cutQty: number
      inboundQty: number
      hasConfiguredQty: boolean
      hasReceivedQty: boolean
      requiredPieceQty: number
    }
  >()

  record.materialLines.forEach((materialLine) => {
    const key = makeProductionProgressOriginalOrderKey({
      productionOrderId: record.productionOrderId,
      originalCutOrderNo: materialLine.originalCutOrderNo,
      materialSku: materialLine.materialSku,
    })
    const requirement = originalOrderRequirementMap.get(key)
    const current =
      grouped.get(key) ||
      {
        originalCutOrderNo: materialLine.originalCutOrderNo || '',
        materialSku: materialLine.materialSku,
        skuCodes: new Set<string>(requirement ? Array.from(requirement.skuCodes) : []),
        cutQty: 0,
        inboundQty: 0,
        hasConfiguredQty: Number(materialLine.configuredLength || 0) > 0,
        hasReceivedQty: Number(materialLine.receivedLength || 0) > 0,
        requiredPieceQty: Number(requirement?.requiredPieceQty || 0),
      }
    ;(materialLine.skuScopeLines || []).forEach((scopeLine) => {
      if (scopeLine.skuCode) current.skuCodes.add(scopeLine.skuCode)
    })
    ;(materialLine.pieceProgressLines || []).forEach((pieceLine) => {
      current.cutQty += Number(pieceLine.actualCutQty || 0)
      current.inboundQty += Number(pieceLine.inboundQty || 0)
    })
    current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0
    current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0
    grouped.set(key, current)
  })

  const lines = Array.from(grouped.values())
    .map((row) => {
      const currentStateLabel = buildProgressStateLabel({
        requiredPieceQty: row.requiredPieceQty,
        actualCutQty: row.cutQty,
        inboundQty: row.inboundQty,
        hasConfiguredQty: row.hasConfiguredQty,
        hasReceivedQty: row.hasReceivedQty,
      })
      const incompletePieceQty =
        row.requiredPieceQty > 0
          ? Math.max(row.requiredPieceQty - Math.max(row.cutQty, row.inboundQty), row.requiredPieceQty - row.inboundQty, 0)
          : 0

      return {
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCount: row.skuCodes.size,
        incompletePieceQty,
        currentStateLabel,
      }
    })
    .filter((row) => row.originalCutOrderNo)
    .sort((left, right) => left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'))

  return lines.length
    ? lines
    : truth.originalCutOrderRows.map((row) => ({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCount: row.skuCount,
        incompletePieceQty: Math.max(row.gapCutQty, row.gapInboundQty),
        currentStateLabel: row.currentStateLabel,
      }))
}

function buildPartDifferenceSummary(truth: ProductionPieceTruthResult): ProductionProgressPartDifferenceSummary {
  return truth.gapRows.reduce<ProductionProgressPartDifferenceSummary>(
    (summary, row) => {
      const pieceQty = Number(row.requiredPieceQty || 0)
      const isCompleted = row.mappingStatus === 'MATCHED' && Number(row.gapCutQty || 0) === 0 && Number(row.gapInboundQty || 0) === 0
      if (isCompleted) {
        summary.completedPieceQty += pieceQty
      } else {
        summary.incompletePieceQty += pieceQty
      }
      return summary
    },
    { completedPieceQty: 0, incompletePieceQty: 0 },
  )
}

function buildKeywordIndex(
  record: CuttingOrderProgressRecord,
  originalCutOrderNos: string[],
  pieceTruth: ProductionPieceTruthResult,
): string[] {
  return [
    record.productionOrderNo,
    record.productionOrderId,
    record.spuCode,
    record.techPackSpuCode,
    record.styleCode,
    record.styleName,
    ...originalCutOrderNos,
    ...record.materialLines.map((line) => line.materialSku),
    ...(record.skuRequirementLines || []).flatMap((line) => [line.skuCode, line.color, line.size]),
    ...pieceTruth.gapRows.flatMap((row) => [
      row.skuCode,
      row.color,
      row.size,
      row.partName,
      row.materialSku,
      row.originalCutOrderNo,
      row.currentStateLabel,
      row.nextActionLabel,
    ]),
    ...pieceTruth.mappingIssues.map((issue) => issue.message),
    ...pieceTruth.dataIssues.map((issue) => issue.message),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase())
}

export interface ProductionProgressRuntimeOptions {
  pickupWritebacks?: PdaPickupWritebackRecord[]
  inboundWritebacks?: PdaCutPieceInboundWritebackRecord[]
  handoverWritebacks?: PdaCutPieceHandoverWritebackRecord[]
  replenishmentFeedbackWritebacks?: PdaReplenishmentFeedbackWritebackRecord[]
}

export function buildProductionProgressRows(
  records: CuttingOrderProgressRecord[],
  options: ProductionProgressRuntimeOptions = {},
): ProductionProgressRow[] {
  const materialRequirementMap = buildMaterialRequirementMap()
  const skuPieceRequirementMap = buildSkuPieceRequirementMap()
  const originalOrderRequirementMap = buildOriginalOrderRequirementMap()
  return records.map((record) => {
    const originalCutOrderNos = Array.from(
      new Set(record.materialLines.map((line) => line.originalCutOrderNo || line.originalCutOrderId).filter(Boolean)),
    )
    const originalCutOrderIds = Array.from(
      new Set(record.materialLines.map((line) => line.originalCutOrderId || line.originalCutOrderNo).filter(Boolean)),
    )
    const prepSummary = buildConfigSummary(record.materialLines)
    const claimSummary = buildReceiveSummary(record.materialLines)
    const shipDeltaDays = getDaysToShip(record.plannedShipDate)
    const shipDeltaDirection = buildShipDeltaDirection(shipDeltaDays)
    const shipDeltaRange = buildShipDeltaRange(shipDeltaDays)
    const urgency = buildUrgencyView(record.plannedShipDate, record.orderQty)
    const currentStage = buildCurrentStage(record, prepSummary, claimSummary)
    const overlaySignals = buildPieceTruthOverlaySignals(record, options)
    const pieceTruth = buildProductionPieceTruth(record, { overlaySignals })
    const pieceProgress = buildProductionPieceProgressViewModelFromTruth(pieceTruth)
    const pieceCompletionSummary = buildProductionCompletionSummary(pieceTruth, {
      prepSummary,
      claimSummary,
      record,
    })
    const cuttingCompletionSummary = pieceCompletionSummary
    const riskTags = buildRiskTags(record, prepSummary, urgency.key, pieceTruth)
    const shipCountdownText = buildShipCountdownText(record.plannedShipDate)
    const materialPrepLines = buildMaterialPrepLines(record, materialRequirementMap)
    const materialClaimLines = buildMaterialClaimLines(record)
    const skuProgressLines = buildSkuProgressLines(record, pieceTruth, skuPieceRequirementMap)
    const sourceOrderProgressLines = buildSourceOrderProgressLines(record, originalOrderRequirementMap, pieceTruth)
    const completedSkuCount = skuProgressLines.filter((line) => line.completionLabel === '已齐套').length
    const incompleteSkuCount = Math.max(skuProgressLines.length - completedSkuCount, 0)
    const partDifferenceSummary = buildPartDifferenceSummary(pieceTruth)
    const keywordIndex = buildKeywordIndex(record, originalCutOrderNos, pieceTruth)
    const priorityGapRow =
      pieceTruth.gapRows.find((row) => row.mappingStatus !== 'MATCHED') ||
      pieceTruth.gapRows.find((row) => row.gapCutQty > 0) ||
      pieceTruth.gapRows.find((row) => row.gapInboundQty > 0) ||
      null
    const mappingIssueCount = pieceTruth.mappingIssues.length
    const dataIssueCount = pieceTruth.dataIssues.length

    return {
      id: record.id,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      purchaseDate: record.purchaseDate,
      actualOrderDate: record.actualOrderDate,
      plannedShipDate: record.plannedShipDate,
      plannedShipDateDisplay: record.plannedShipDate || '待补日期',
      orderQty: record.orderQty,
      spuCode: record.spuCode,
      styleCode: record.styleCode,
      styleName: record.styleName,
      cuttingTaskNo: record.cuttingTaskNo,
      assignedFactoryName: record.assignedFactoryName,
      urgency,
      shipDeltaDays,
      shipDeltaDirection,
      shipDeltaRange,
      shipCountdownText,
      materialPrepSummary: prepSummary,
      materialClaimSummary: claimSummary,
      materialPrepLines,
      materialClaimLines,
      currentStage,
      cuttingCompletionSummary,
      pieceCompletionSummary,
      pieceTruth,
      skuProgressLines,
      sourceOrderProgressLines,
      partDifferenceSummary,
      riskTags,
      originalCutOrderCount: originalCutOrderNos.length,
      originalCutOrderIds,
      originalCutOrderNos,
      techPackSpuCode: record.techPackSpuCode || '',
      skuRequirementLines: record.skuRequirementLines || [],
      pieceProgress,
      skuTotalCount: skuProgressLines.length,
      completedSkuCount,
      incompleteSkuCount,
      incompleteOriginalOrderCount: pieceTruth.originalCutOrderRows.filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '已齐套').length,
      incompletePartCount: pieceTruth.counts.incompletePartCount,
      affectedMaterialCount: pieceTruth.counts.affectedMaterialCount,
      pieceGapQty: pieceTruth.counts.gapCutQtyTotal,
      inboundGapQty: pieceTruth.counts.gapInboundQtyTotal,
      pieceMappingWarningCount: mappingIssueCount,
      pieceDataIssueCount: dataIssueCount,
      primaryGapObjectLabel: priorityGapRow?.originalCutOrderNo || '当前无差异对象',
      primaryGapMaterialSku: priorityGapRow?.materialSku || '—',
      primaryGapPartName: priorityGapRow?.partName || '—',
      mainNextActionLabel: pieceTruth.nextActionLabel,
      dataStateLabel:
        dataIssueCount > 0
          ? '数据待补'
          : mappingIssueCount > 0
            ? '映射缺失'
            : '正常',
      hasPieceGap: pieceTruth.gapRows.some((row) => row.gapCutQty > 0 || row.gapInboundQty > 0),
      hasMappingWarnings: mappingIssueCount > 0,
      filterPayloadForOriginalOrders: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      filterPayloadForMaterialPrep: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      filterPayloadForCuttablePool: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      filterPayloadForSummary: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      filterPayloadForMarkerSpreading: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      filterPayloadForFeiTickets: {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
      },
      latestUpdatedAt: record.lastFieldUpdateAt,
      latestPickupScanAt: record.lastPickupScanAt,
      latestOperatorName: record.lastOperatorName,
      rawStageText: record.cuttingStage,
      hasSpreadingRecord: record.hasSpreadingRecord,
      hasInboundRecord: record.hasInboundRecord,
      materialLines: record.materialLines,
      keywordIndex,
    }
  })
}

function compareDateString(a: string, b: string): number {
  const left = parseDateOnly(a)
  const right = parseDateOnly(b)
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  return left.getTime() - right.getTime()
}

export function sortProductionProgressRows(rows: ProductionProgressRow[], sortBy: ProductionProgressSortKey): ProductionProgressRow[] {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    if (sortBy === 'SHIP_DATE_ASC') {
      return compareDateString(left.plannedShipDate, right.plannedShipDate) || right.urgency.sortWeight - left.urgency.sortWeight
    }
    if (sortBy === 'ORDER_QTY_DESC') {
      return right.orderQty - left.orderQty || compareDateString(left.plannedShipDate, right.plannedShipDate)
    }
    return (
      right.urgency.sortWeight - left.urgency.sortWeight ||
      compareDateString(left.plannedShipDate, right.plannedShipDate) ||
      compareDateString(left.actualOrderDate, right.actualOrderDate)
    )
  })
  return sorted
}

export function filterProductionProgressRows(rows: ProductionProgressRow[], filters: ProductionProgressFilters): ProductionProgressRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  const productionOrderKeyword = filters.productionOrderNo.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesKeyword = keyword.length === 0 || row.keywordIndex.some((value) => value.includes(keyword))
    const matchesProductionOrder =
      productionOrderKeyword.length === 0 || row.productionOrderNo.toLowerCase().includes(productionOrderKeyword)
    const matchesUrgency = filters.urgencyLevel === 'ALL' || row.urgency.key === filters.urgencyLevel
    const matchesShipDelta = filters.shipDeltaRange === 'ALL' || row.shipDeltaRange === filters.shipDeltaRange
    const matchesStage = filters.currentStage === 'ALL' || row.currentStage.key === filters.currentStage
    const matchesCompletion = filters.completionState === 'ALL' || row.pieceCompletionSummary.key === filters.completionState
    const matchesConfig = filters.configStatus === 'ALL' || row.materialPrepSummary.key === filters.configStatus
    const matchesReceive = filters.receiveStatus === 'ALL' || row.materialClaimSummary.key === filters.receiveStatus
    const matchesRisk =
      filters.riskFilter === 'ALL' ||
      (filters.riskFilter === 'ANY' ? row.riskTags.length > 0 : row.riskTags.some((tag) => tag.key === filters.riskFilter))

    return (
      matchesKeyword &&
      matchesProductionOrder &&
      matchesUrgency &&
      matchesShipDelta &&
      matchesStage &&
      matchesCompletion &&
      matchesConfig &&
      matchesReceive &&
      matchesRisk
    )
  })
}

export function buildProductionProgressSummary(rows: ProductionProgressRow[]): ProductionProgressSummary {
  return {
    totalCount: rows.length,
    urgentCount: rows.filter((row) => row.urgency.key === 'AA' || row.urgency.key === 'A').length,
    prepExceptionCount: rows.filter((row) => row.materialPrepSummary.key !== 'CONFIGURED').length,
    claimExceptionCount: rows.filter((row) => row.materialClaimSummary.key === 'EXCEPTION' || row.materialClaimSummary.key === 'NOT_RECEIVED').length,
    cuttingCount: rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND').length,
    doneCount: rows.filter((row) => row.pieceCompletionSummary.key === 'COMPLETED').length,
  }
}
