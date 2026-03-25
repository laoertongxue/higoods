import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingReviewStatus,
  CuttingUrgencyLevel,
  CuttingSkuRequirementLine,
} from '../../../data/fcs/cutting/types'
import {
  buildProductionPieceProgressViewModel,
  type ProductionPieceProgressViewModel,
} from './production-piece-progress'

const PRODUCTION_PROGRESS_REFERENCE_DATE = '2026-03-24'
const DAY_IN_MS = 24 * 60 * 60 * 1000

// 试运行规则：距离发货 8 / 10 / 13 天内分别落 AA / A / B，超出后再按订单大小划 C / D。
// 后续如业务调整紧急度阈值，应只改这组常量，不要把规则散落到页面渲染层。
export const LARGE_ORDER_QTY_THRESHOLD = 4500

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type ProductionProgressUrgencyKey = CuttingUrgencyLevel | 'UNKNOWN'
export type ProductionProgressAuditKey = CuttingReviewStatus | 'PENDING' | 'PARTIAL'
export type ProductionProgressReceiveKey = 'NOT_RECEIVED' | 'PARTIAL' | 'RECEIVED' | 'EXCEPTION'
export type ProductionProgressStageKey = 'WAITING_PREP' | 'PREPPING' | 'WAITING_CLAIM' | 'CUTTING' | 'WAITING_INBOUND' | 'DONE'
export type ProductionProgressCompletionKey = 'READY' | 'PARTIAL' | 'NOT_READY' | 'DATA_PENDING'
export type ProductionPieceCompletionKey =
  | 'DATA_PENDING'
  | 'MAPPING_MISSING'
  | 'NOT_COMPLETE'
  | 'CUT_DONE_PENDING_INBOUND'
  | 'COMPLETE'
export type ProductionProgressRiskKey =
  | 'CONFIG_DELAY'
  | 'RECEIVE_EXCEPTION'
  | 'SHIP_URGENT'
  | 'DATE_MISSING'
  | 'STATUS_CONFLICT'
  | 'REPLENISH_PENDING'
  | 'PIECE_GAP'
  | 'TECH_PACK_MISSING'
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
  materialAuditSummary: ProductionProgressSummaryMeta<ProductionProgressAuditKey>
  materialPrepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>
  materialClaimSummary: ProductionProgressSummaryMeta<ProductionProgressReceiveKey>
  currentStage: {
    key: ProductionProgressStageKey
    label: string
    className: string
  }
  cuttingCompletionSummary: ProductionProgressSummaryMeta<ProductionProgressCompletionKey>
  pieceCompletionSummary: ProductionProgressSummaryMeta<ProductionPieceCompletionKey>
  riskTags: ProductionProgressRiskTag[]
  originalCutOrderCount: number
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  techPackSpuCode: string
  skuRequirementLines: CuttingSkuRequirementLine[]
  pieceProgress: ProductionPieceProgressViewModel
  incompleteSkuCount: number
  incompleteOriginalOrderCount: number
  pieceGapQty: number
  inboundGapQty: number
  pieceMappingWarningCount: number
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
  urgencyLevel: 'ALL' | ProductionProgressUrgencyKey
  currentStage: 'ALL' | ProductionProgressStageKey
  completionStatus: 'ALL' | 'INCOMPLETE' | 'COMPLETE'
  auditStatus: 'ALL' | ProductionProgressAuditKey
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | ProductionProgressReceiveKey
  skuKeyword: string
  partKeyword: string
  originalCutOrderNo: string
  materialSku: string
  onlyHasGap: boolean
  onlyMappingMissing: boolean
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

export const auditMeta: Record<ProductionProgressAuditKey, { label: string; className: string }> = {
  NOT_REQUIRED: { label: '无需审核', className: 'bg-slate-100 text-slate-700' },
  PENDING: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  PARTIAL: { label: '部分已审核', className: 'bg-orange-100 text-orange-700' },
  APPROVED: { label: '全部已审核', className: 'bg-emerald-100 text-emerald-700' },
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

export const completionMeta: Record<ProductionProgressCompletionKey, { label: string; className: string }> = {
  READY: { label: '已齐套', className: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: '部分齐套', className: 'bg-orange-100 text-orange-700' },
  NOT_READY: { label: '未齐套', className: 'bg-slate-100 text-slate-700' },
  DATA_PENDING: { label: '数据待补齐', className: 'bg-slate-100 text-slate-600' },
}

export const pieceCompletionMeta: Record<ProductionPieceCompletionKey, { label: string; className: string }> = {
  DATA_PENDING: { label: '数据待补齐', className: 'bg-slate-100 text-slate-600' },
  MAPPING_MISSING: { label: '映射缺失', className: 'bg-amber-100 text-amber-700' },
  NOT_COMPLETE: { label: '未完成', className: 'bg-rose-100 text-rose-700' },
  CUT_DONE_PENDING_INBOUND: { label: '裁完待入仓', className: 'bg-sky-100 text-sky-700' },
  COMPLETE: { label: '裁片完成', className: 'bg-emerald-100 text-emerald-700' },
}

export const riskMeta: Record<ProductionProgressRiskKey, { label: string; className: string }> = {
  CONFIG_DELAY: { label: '配料滞后', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  RECEIVE_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  PIECE_GAP: { label: '裁片缺口', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  TECH_PACK_MISSING: { label: '技术包缺失', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
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
      detailText: '计划发货日期待补齐，当前无法计算紧急程度。',
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
    detailText: `距计划发货 ${Math.max(daysToShip, 0)} 天，按试运行规则计算。`,
  }
}

function buildAuditSummary(lines: CuttingMaterialLine[]): ProductionProgressSummaryMeta<ProductionProgressAuditKey> {
  const reviewRequired = lines.filter((line) => line.reviewStatus !== 'NOT_REQUIRED')
  if (reviewRequired.length === 0) {
    const meta = auditMeta.NOT_REQUIRED
    return { key: 'NOT_REQUIRED', label: meta.label, className: meta.className, detailText: '当前面料无需审核' }
  }

  const approvedCount = reviewRequired.filter((line) => line.reviewStatus === 'APPROVED').length
  const total = reviewRequired.length

  if (approvedCount === total) {
    const meta = auditMeta.APPROVED
    return { key: 'APPROVED', label: meta.label, className: meta.className, detailText: formatCountSummary(approvedCount, total, '已审核') }
  }
  if (approvedCount > 0) {
    const meta = auditMeta.PARTIAL
    return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: formatCountSummary(approvedCount, total, '已审核') }
  }

  const meta = auditMeta.PENDING
  return { key: 'PENDING', label: meta.label, className: meta.className, detailText: `待审核 ${total} 项` }
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

function buildPieceCompletionSummary(
  record: CuttingOrderProgressRecord,
  pieceProgress: ProductionPieceProgressViewModel,
): ProductionProgressSummaryMeta<ProductionPieceCompletionKey> {
  if (!record.skuRequirementLines?.length) {
    const meta = pieceCompletionMeta.DATA_PENDING
    return { key: 'DATA_PENDING', label: meta.label, className: meta.className, detailText: 'SKU 需求待补齐' }
  }
  if (pieceProgress.mappingWarnings.length) {
    const meta = pieceCompletionMeta.MAPPING_MISSING
    return {
      key: 'MAPPING_MISSING',
      label: meta.label,
      className: meta.className,
      detailText: `映射异常 ${pieceProgress.mappingWarnings.length} 项`,
    }
  }
  if (pieceProgress.gapRows.some((row) => row.gapQty > 0)) {
    const meta = pieceCompletionMeta.NOT_COMPLETE
    return {
      key: 'NOT_COMPLETE',
      label: meta.label,
      className: meta.className,
      detailText: `仍缺 ${formatQty(pieceProgress.totals.gapQtyTotal)} 片`,
    }
  }
  if (pieceProgress.gapRows.some((row) => row.inboundGapQty > 0)) {
    const meta = pieceCompletionMeta.CUT_DONE_PENDING_INBOUND
    return {
      key: 'CUT_DONE_PENDING_INBOUND',
      label: meta.label,
      className: meta.className,
      detailText: `待入仓 ${formatQty(pieceProgress.totals.inboundGapQtyTotal)} 片`,
    }
  }

  const meta = pieceCompletionMeta.COMPLETE
  return {
    key: 'COMPLETE',
    label: meta.label,
    className: meta.className,
    detailText: `已入仓 ${formatQty(pieceProgress.totals.inboundQtyTotal)} 片`,
  }
}

function mapPieceCompletionToCuttingSummary(
  pieceCompletionSummary: ProductionProgressSummaryMeta<ProductionPieceCompletionKey>,
): ProductionProgressSummaryMeta<ProductionProgressCompletionKey> {
  if (pieceCompletionSummary.key === 'COMPLETE') {
    const meta = completionMeta.READY
    return { key: 'READY', label: meta.label, className: meta.className, detailText: pieceCompletionSummary.detailText }
  }
  if (pieceCompletionSummary.key === 'CUT_DONE_PENDING_INBOUND') {
    const meta = completionMeta.PARTIAL
    return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: pieceCompletionSummary.detailText }
  }
  if (pieceCompletionSummary.key === 'DATA_PENDING' || pieceCompletionSummary.key === 'MAPPING_MISSING') {
    const meta = completionMeta.DATA_PENDING
    return { key: 'DATA_PENDING', label: meta.label, className: meta.className, detailText: pieceCompletionSummary.detailText }
  }

  const meta = completionMeta.NOT_READY
  return { key: 'NOT_READY', label: meta.label, className: meta.className, detailText: pieceCompletionSummary.detailText }
}

function buildRiskTags(
  record: CuttingOrderProgressRecord,
  auditSummary: ProductionProgressSummaryMeta<ProductionProgressAuditKey>,
  prepSummary: ProductionProgressSummaryMeta<CuttingConfigStatus>,
  claimSummary: ProductionProgressSummaryMeta<ProductionProgressReceiveKey>,
  currentStageKey: ProductionProgressStageKey,
  urgencyKey: ProductionProgressUrgencyKey,
  pieceProgress: ProductionPieceProgressViewModel,
): ProductionProgressRiskTag[] {
  const tags: ProductionProgressRiskTag[] = []

  const pushRisk = (key: ProductionProgressRiskKey) => {
    if (tags.some((item) => item.key === key)) return
    tags.push({ key, label: riskMeta[key].label, className: riskMeta[key].className })
  }

  if (auditSummary.key === 'PENDING' || auditSummary.key === 'PARTIAL' || prepSummary.key !== 'CONFIGURED') {
    pushRisk('CONFIG_DELAY')
  }
  if (claimSummary.key === 'EXCEPTION') {
    pushRisk('RECEIVE_EXCEPTION')
  }
  if (record.riskFlags.includes('REPLENISH_PENDING')) {
    pushRisk('REPLENISH_PENDING')
  }
  if (pieceProgress.mappingWarnings.length) {
    pushRisk('TECH_PACK_MISSING')
  }
  if (pieceProgress.gapRows.some((row) => row.gapQty > 0)) {
    pushRisk('PIECE_GAP')
  }
  if (urgencyKey === 'AA' || urgencyKey === 'A') {
    pushRisk('SHIP_URGENT')
  }
  if (!record.plannedShipDate) {
    pushRisk('DATE_MISSING')
  }

  const hasConflict =
    (currentStageKey === 'WAITING_PREP' && (record.hasSpreadingRecord || claimSummary.key !== 'NOT_RECEIVED')) ||
    (currentStageKey === 'DONE' && !record.hasInboundRecord) ||
    (currentStageKey === 'WAITING_INBOUND' && !record.hasSpreadingRecord)

  if (hasConflict) {
    pushRisk('STATUS_CONFLICT')
  }

  return tags
}

function buildKeywordIndex(
  record: CuttingOrderProgressRecord,
  originalCutOrderNos: string[],
  pieceProgress: ProductionPieceProgressViewModel,
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
    ...pieceProgress.pieceDetailRows.flatMap((row) => [row.skuCode, row.color, row.size, row.partName, row.materialSku, row.sourceCutOrderNo]),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase())
}

export function buildProductionProgressRows(records: CuttingOrderProgressRecord[]): ProductionProgressRow[] {
  return records.map((record) => {
    const originalCutOrderNos = Array.from(new Set(record.materialLines.map((line) => line.cutPieceOrderNo)))
    const originalCutOrderIds = [...originalCutOrderNos]
    const auditSummary = buildAuditSummary(record.materialLines)
    const prepSummary = buildConfigSummary(record.materialLines)
    const claimSummary = buildReceiveSummary(record.materialLines)
    const urgency = buildUrgencyView(record.plannedShipDate, record.orderQty)
    const currentStage = buildCurrentStage(record, prepSummary, claimSummary)
    const pieceProgress = buildProductionPieceProgressViewModel(record)
    const pieceCompletionSummary = buildPieceCompletionSummary(record, pieceProgress)
    const cuttingCompletionSummary = mapPieceCompletionToCuttingSummary(pieceCompletionSummary)
    const riskTags = buildRiskTags(record, auditSummary, prepSummary, claimSummary, currentStage.key, urgency.key, pieceProgress)
    const keywordIndex = buildKeywordIndex(record, originalCutOrderNos, pieceProgress)

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
      materialAuditSummary: auditSummary,
      materialPrepSummary: prepSummary,
      materialClaimSummary: claimSummary,
      currentStage,
      cuttingCompletionSummary,
      pieceCompletionSummary,
      riskTags,
      originalCutOrderCount: originalCutOrderNos.length,
      originalCutOrderIds,
      originalCutOrderNos,
      techPackSpuCode: record.techPackSpuCode || '',
      skuRequirementLines: record.skuRequirementLines || [],
      pieceProgress,
      incompleteSkuCount: pieceProgress.incompleteSkuRows.length,
      incompleteOriginalOrderCount: pieceProgress.incompleteOriginalOrderRows.length,
      pieceGapQty: pieceProgress.totals.gapQtyTotal,
      inboundGapQty: pieceProgress.totals.inboundGapQtyTotal,
      pieceMappingWarningCount: pieceProgress.mappingWarnings.length,
      hasPieceGap: pieceProgress.gapRows.some((row) => row.gapQty > 0 || row.inboundGapQty > 0),
      hasMappingWarnings: pieceProgress.mappingWarnings.length > 0,
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
  const skuKeyword = filters.skuKeyword.trim().toLowerCase()
  const partKeyword = filters.partKeyword.trim().toLowerCase()
  const originalCutOrderKeyword = filters.originalCutOrderNo.trim().toLowerCase()
  const materialSkuKeyword = filters.materialSku.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesKeyword = keyword.length === 0 || row.keywordIndex.some((value) => value.includes(keyword))
    const matchesUrgency = filters.urgencyLevel === 'ALL' || row.urgency.key === filters.urgencyLevel
    const matchesStage = filters.currentStage === 'ALL' || row.currentStage.key === filters.currentStage
    const matchesCompletion =
      filters.completionStatus === 'ALL' ||
      (filters.completionStatus === 'COMPLETE'
        ? row.pieceCompletionSummary.key === 'COMPLETE'
        : row.pieceCompletionSummary.key !== 'COMPLETE')
    const matchesAudit = filters.auditStatus === 'ALL' || row.materialAuditSummary.key === filters.auditStatus
    const matchesConfig = filters.configStatus === 'ALL' || row.materialPrepSummary.key === filters.configStatus
    const matchesReceive = filters.receiveStatus === 'ALL' || row.materialClaimSummary.key === filters.receiveStatus
    const matchesSku = skuKeyword.length === 0 || row.pieceProgress.skuSummaryRows.some((item) =>
      [item.skuCode, item.color, item.size].some((value) => value.toLowerCase().includes(skuKeyword)),
    )
    const matchesPart = partKeyword.length === 0 || row.pieceProgress.pieceDetailRows.some((item) =>
      [item.partName, item.patternName].some((value) => value.toLowerCase().includes(partKeyword)),
    )
    const matchesOriginalCutOrder =
      originalCutOrderKeyword.length === 0 ||
      row.originalCutOrderNos.some((value) => value.toLowerCase().includes(originalCutOrderKeyword)) ||
      row.pieceProgress.incompleteOriginalOrderRows.some((value) => value.sourceCutOrderNo.toLowerCase().includes(originalCutOrderKeyword))
    const matchesMaterialSku =
      materialSkuKeyword.length === 0 ||
      row.materialLines.some((line) => line.materialSku.toLowerCase().includes(materialSkuKeyword)) ||
      row.pieceProgress.pieceDetailRows.some((line) => line.materialSku.toLowerCase().includes(materialSkuKeyword))
    const matchesGap = !filters.onlyHasGap || row.hasPieceGap
    const matchesMappingMissing = !filters.onlyMappingMissing || row.hasMappingWarnings
    const matchesRisk =
      filters.riskFilter === 'ALL' ||
      (filters.riskFilter === 'ANY' ? row.riskTags.length > 0 : row.riskTags.some((tag) => tag.key === filters.riskFilter))

    return (
      matchesKeyword &&
      matchesUrgency &&
      matchesStage &&
      matchesCompletion &&
      matchesAudit &&
      matchesConfig &&
      matchesReceive &&
      matchesSku &&
      matchesPart &&
      matchesOriginalCutOrder &&
      matchesMaterialSku &&
      matchesGap &&
      matchesMappingMissing &&
      matchesRisk
    )
  })
}

export function buildProductionProgressSummary(rows: ProductionProgressRow[]): ProductionProgressSummary {
  return {
    totalCount: rows.length,
    urgentCount: rows.filter((row) => row.urgency.key === 'AA' || row.urgency.key === 'A').length,
    prepExceptionCount: rows.filter((row) => row.materialAuditSummary.key !== 'APPROVED' || row.materialPrepSummary.key !== 'CONFIGURED').length,
    claimExceptionCount: rows.filter((row) => row.materialClaimSummary.key === 'EXCEPTION' || row.materialClaimSummary.key === 'NOT_RECEIVED').length,
    cuttingCount: rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND').length,
    doneCount: rows.filter((row) => row.pieceCompletionSummary.key === 'COMPLETE').length,
  }
}
