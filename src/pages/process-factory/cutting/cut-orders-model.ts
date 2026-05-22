import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingMaterialType,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
} from '../../../data/fcs/cutting/types.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-cut-orders.ts'
import {
  buildProductionProgressRows,
  configMeta,
  receiveMeta,
  type ProductionProgressRow,
  type ProductionProgressUrgencyKey,
  urgencyMeta,
} from './production-progress-model.ts'
import type { MarkerPlanRefRecord } from './marker-plan-ref-model.ts'
import {
  buildCutOrderStartStateLookup,
  resolveCutOrderStartState,
  type CutOrderStartState,
} from './cutting-readiness.ts'
import type { MarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')
const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export type CutOrderStageKey =
  | 'NOT_STARTED'
  | 'STARTED'
  | 'CLOSED'

export type CutOrderCuttableStateKey =
  | 'CUTTABLE'
  | 'WAITING_PREP'
  | 'WAITING_CLAIM'
  | 'CLAIM_EXCEPTION'
  | 'WAITING_START'
  | 'IN_MARKER_PLAN'
  | 'INBOUND'
  | 'CUTTING'
  | 'BLOCKED'

export type CutOrderCuttableVisibleStateKey = 'CUTTABLE' | 'NOT_CUTTABLE'

export type CutOrderRiskKey =
  | 'PREP_DELAY'
  | 'CLAIM_EXCEPTION'
  | 'SHIP_URGENT'
  | 'DATE_MISSING'
  | 'STATUS_CONFLICT'
  | 'REPLENISH_PENDING'
  | 'IN_MARKER_PLAN'

export interface CutOrderSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface CutOrderRiskTag {
  key: CutOrderRiskKey
  label: string
  className: string
}

export interface CutOrderNavigationPayload {
  productionProgress: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  feiTickets: Record<string, string | undefined>
  replenishment: Record<string, string | undefined>
  markerPlanRefs: Record<string, string | undefined>
  sameProductionOrders: Record<string, string | undefined>
}

export interface CutOrderMaterialQuantityLedger {
  requiredQty: number
  configuredQty: number
  claimedQty: number
  lockedQty: number
  consumedQty: number
  availableQty: number
  unit: string
}

export interface CutOrderRow {
  id: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  assignedFactoryName: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSku: string
  materialType: CuttingMaterialType
  materialCategory: string
  materialLabel: string
  materialAlias: string
  materialImageUrl: string
  orderQty: number
  pieceCountText: string
  plannedQty: number
  receivedQty: number
  materialQuantityLedger: CutOrderMaterialQuantityLedger
  purchaseDate: string
  actualOrderDate: string
  plannedShipDate: string
  dateInfoLines: Array<{ label: '需求' | '下单' | '回货'; value: string }>
  sellingPrice: number | null
  urgencyKey: ProductionProgressUrgencyKey
  urgencyLabel: string
  urgencyClassName: string
  materialPrepStatus: CutOrderSummaryMeta<CuttingConfigStatus>
  materialClaimStatus: CutOrderSummaryMeta<CuttingReceiveStatus>
  currentStage: CutOrderSummaryMeta<CutOrderStageKey>
  currentStageLabel: string
  cuttableState: CutOrderSummaryMeta<CutOrderCuttableStateKey> & {
    selectable: boolean
    reasonText: string
  }
  visibleCuttableStatus: {
    key: CutOrderCuttableVisibleStateKey
    label: string
    className: string
  }
  markerPlanIds: string[]
  markerPlanNos: string[]
  latestMarkerPlanNo: string
  batchParticipationCount: number
  activeMarkerPlanId: string
  activeMarkerPlanNo: string
  closeReason: string
  closedAt: string
  riskTags: CutOrderRiskTag[]
  statusSummary: string
  relationSummary: string
  latestActionText: string
  navigationPayload: CutOrderNavigationPayload
  keywordIndex: string[]
}

export interface CutOrderViewModel {
  rows: CutOrderRow[]
  rowsById: Record<string, CutOrderRow>
}

export interface CutOrderFilters {
  keyword: string
  productionOrderNo: string
  styleKeyword: string
  materialSku: string
  currentStage: 'ALL' | CutOrderStageKey
  cuttableState: 'ALL' | CutOrderCuttableVisibleStateKey
  prepStatus: 'ALL' | CuttingConfigStatus
  claimStatus: 'ALL' | CuttingReceiveStatus
  inBatch: 'ALL' | 'IN_MARKER_PLAN' | 'NOT_IN_MARKER_PLAN'
  riskOnly: boolean
}

export interface CutOrderPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
}

export interface CutOrderStats {
  totalCount: number
  cuttableCount: number
  inBatchCount: number
  prepExceptionCount: number
  claimExceptionCount: number
  feiPendingCount: number
}

export const cutOrderStageMeta: Record<CutOrderStageKey, { label: string; className: string }> = {
  NOT_STARTED: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
  STARTED: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
  CLOSED: { label: '已关闭', className: 'bg-zinc-100 text-zinc-700' },
}

export const cutOrderCuttableMeta: Record<CutOrderCuttableStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  WAITING_PREP: { label: '配料数量不足', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  WAITING_CLAIM: { label: '无领料记录', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  WAITING_START: { label: '待开工', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  IN_MARKER_PLAN: { label: '当前被方案锁定', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  INBOUND: { label: '已入仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  CUTTING: { label: '裁剪中', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  BLOCKED: { label: '暂不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const cutOrderVisibleCuttableMeta: Record<CutOrderCuttableVisibleStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  NOT_CUTTABLE: { label: '暂不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const cutOrderRiskMeta: Record<CutOrderRiskKey, { label: string; className: string }> = {
  PREP_DELAY: { label: '配料异常', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  IN_MARKER_PLAN: { label: '当前被方案锁定', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
}

function materialCategoryLabel(materialType: CuttingMaterialType): string {
  if (materialType === 'PRINT') return '主料'
  if (materialType === 'DYE') return '主料'
  if (materialType === 'LINING') return '里辅料'
  return '主料'
}

function formatQty(value: number): string {
  return numberFormatter.format(value)
}

function formatDisplayDate(value: string): string {
  return value || '—'
}

export function formatCutOrderCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '待补'
  return currencyFormatter.format(value)
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildProgressLineFallback(source: GeneratedCutOrderSourceRecord): CuttingMaterialLine {
  return {
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    cutPieceOrderNo: source.cutOrderNo,
    markerPlanId: source.markerPlanId,
    markerPlanNo: source.markerPlanNo,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    materialAlias: source.materialAlias,
    materialImageUrl: source.materialImageUrl,
    color: source.colorScope[0] || '待补',
    materialCategory: source.materialCategory,
    reviewStatus: 'NOT_REQUIRED',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    configuredRollCount: 0,
    configuredLength: 0,
    receivedRollCount: 0,
    receivedLength: 0,
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    markerPlanOccupancyStatus: source.markerPlanNo ? 'IN_MARKER_PLAN' : 'AVAILABLE',
    skuScopeLines: source.skuScopeLines.map((line) => ({ ...line })),
    issueFlags: [],
    latestActionText: `裁片单 ${source.cutOrderNo} 已从生产单生成，待进入执行准备。`,
  }
}

function createSummaryMeta<Key extends string>(
  key: Key,
  label: string,
  className: string,
  detailText: string,
): CutOrderSummaryMeta<Key> {
  return { key, label, className, detailText }
}

function getBatchSortTime(batch: MarkerPlanRefRecord): string {
  return batch.updatedAt || batch.createdAt || ''
}

export function summarizeMarkerPlanRefParticipation(
  cutOrderId: string,
  ledger: MarkerPlanRefRecord[],
): {
  markerPlanIds: string[]
  markerPlanNos: string[]
  latestMarkerPlanNo: string
  batchParticipationCount: number
  activeMarkerPlanId: string
  activeMarkerPlanNo: string
} {
  const matched = ledger
    .filter((batch) => batch.items.some((item) => item.cutOrderId === cutOrderId || item.cutOrderNo === cutOrderId))
    .sort((left, right) => getBatchSortTime(right).localeCompare(getBatchSortTime(left), 'zh-CN'))

  return {
    markerPlanIds: matched.map((batch) => batch.markerPlanId),
    markerPlanNos: matched.map((batch) => batch.markerPlanNo),
    latestMarkerPlanNo: matched[0]?.markerPlanNo ?? '',
    batchParticipationCount: matched.length,
    activeMarkerPlanId: matched.find((batch) => batch.status !== 'CANCELLED')?.markerPlanId ?? '',
    activeMarkerPlanNo: matched.find((batch) => batch.status !== 'CANCELLED')?.markerPlanNo ?? '',
  }
}

export function deriveCutOrderStage(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  startState: CutOrderStartState,
): CutOrderSummaryMeta<CutOrderStageKey> {
  if (record.closeReason || record.closedAt || /已关闭|不再补裁/.test(record.cuttingStage)) {
    return createSummaryMeta('CLOSED', cutOrderStageMeta.CLOSED.label, cutOrderStageMeta.CLOSED.className, record.closeReason || '该裁片单已关闭，不再继续排唛架铺布裁剪。')
  }

  if (startState.started || line.receiveStatus === 'RECEIVED' || record.hasSpreadingRecord || record.hasInboundRecord) {
    return createSummaryMeta('STARTED', cutOrderStageMeta.STARTED.label, cutOrderStageMeta.STARTED.className, '裁床已开工；排唛架、铺布、裁剪作为子作业单独追踪。')
  }

  return createSummaryMeta('NOT_STARTED', cutOrderStageMeta.NOT_STARTED.label, cutOrderStageMeta.NOT_STARTED.className, '裁床尚未开工。')
}

function buildCutOrderMaterialQuantityLedger(
  line: CuttingMaterialLine,
  source: GeneratedCutOrderSourceRecord,
  markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null,
): CutOrderMaterialQuantityLedger {
  const configuredQty = Number(line.configuredLength || 0)
  const claimedQty = Number(line.receivedLength || 0)
  const consumedQty = estimateConsumedMaterialQty(line, source, claimedQty)
  const lockedQty = markerPlanOccupancy ? Math.max(claimedQty - consumedQty, 0) : 0
  const availableQty = Math.max(claimedQty - lockedQty - consumedQty, 0)

  return {
    requiredQty: Number(source.requiredQty || 0),
    configuredQty,
    claimedQty,
    lockedQty,
    consumedQty,
    availableQty,
    unit: 'm',
  }
}

function sumRequiredPieceQty(source: GeneratedCutOrderSourceRecord): number {
  const pieces = source.pieceRows.length
    ? source.pieceRows
    : [{ pieceCountPerUnit: 1, applicableSkuCodes: [] as string[] }]

  return source.skuScopeLines.reduce((total, skuLine) => {
    const skuPieces = pieces.filter((piece) => {
      const applicableSkuCodes = piece.applicableSkuCodes || []
      return applicableSkuCodes.length === 0 || applicableSkuCodes.includes(skuLine.skuCode)
    })
    const pieceCountPerGarment = skuPieces.reduce((sum, piece) => sum + Math.max(Number(piece.pieceCountPerUnit || 0), 1), 0)
    return total + Number(skuLine.plannedQty || 0) * Math.max(pieceCountPerGarment, 1)
  }, 0)
}

function estimateConsumedMaterialQty(line: CuttingMaterialLine, source: GeneratedCutOrderSourceRecord, claimedQty: number): number {
  const actualPieceQty = (line.pieceProgressLines || []).reduce((total, pieceLine) => total + Math.max(Number(pieceLine.actualCutQty || 0), 0), 0)
  if (actualPieceQty <= 0) return 0

  const requiredPieceQty = sumRequiredPieceQty(source)
  if (requiredPieceQty <= 0) return 0

  const consumedRatio = Math.min(actualPieceQty / requiredPieceQty, 1)
  return Math.min(claimedQty, claimedQty * consumedRatio)
}

function hasClaimRecord(line: CuttingMaterialLine, record: CuttingOrderProgressRecord): boolean {
  return Number(line.receivedLength || 0) > 0
    || Number(line.receivedRollCount || 0) > 0
    || Boolean(record.lastPickupScanAt)
}

export function deriveCutOrderCuttableState(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  ledger: MarkerPlanRefRecord[],
  startState: CutOrderStartState,
  materialQuantityLedger: CutOrderMaterialQuantityLedger,
  markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null = null,
): CutOrderSummaryMeta<CutOrderCuttableStateKey> & {
  selectable: boolean
  reasonText: string
} {
  const participation = summarizeMarkerPlanRefParticipation(line.cutOrderId || line.cutOrderNo || line.cutPieceOrderNo, ledger)
  if (record.closeReason || record.closedAt || /已关闭|不再补裁/.test(record.cuttingStage)) {
    return {
      ...createSummaryMeta('BLOCKED', cutOrderCuttableMeta.BLOCKED.label, cutOrderCuttableMeta.BLOCKED.className, record.closeReason || '该裁片单已关闭。'),
      selectable: false,
      reasonText: record.closeReason || '该裁片单已关闭，不再参与唛架方案。',
    }
  }
  if (markerPlanOccupancy) {
    const markerPlanNo = markerPlanOccupancy.markerPlanNo || participation.activeMarkerPlanNo || line.markerPlanNo || '当前唛架方案'
    return {
      ...createSummaryMeta(
        'IN_MARKER_PLAN',
        cutOrderCuttableMeta.IN_MARKER_PLAN.label,
        cutOrderCuttableMeta.IN_MARKER_PLAN.className,
        `当前可用领料余额已被唛架方案 ${markerPlanNo} 锁定。`,
      ),
      selectable: false,
      reasonText: '当前可用领料余额已被唛架方案锁定。',
    }
  }

  if (!hasClaimRecord(line, record)) {
    return {
      ...createSummaryMeta('WAITING_CLAIM', cutOrderCuttableMeta.WAITING_CLAIM.label, cutOrderCuttableMeta.WAITING_CLAIM.className, '当前裁床领料数量不足。'),
      selectable: false,
      reasonText: '当前还没有裁床领料记录。',
    }
  }

  if (!startState.started) {
    return {
      ...createSummaryMeta('WAITING_START', cutOrderCuttableMeta.WAITING_START.label, cutOrderCuttableMeta.WAITING_START.className, '已领料，待裁床任务开工。'),
      selectable: false,
      reasonText: '已领料但尚未开工，暂不可排唛架。',
    }
  }

  if (materialQuantityLedger.availableQty <= 0) {
    return {
      ...createSummaryMeta('BLOCKED', cutOrderCuttableMeta.BLOCKED.label, cutOrderCuttableMeta.BLOCKED.className, '裁床已领面料已锁定或已消耗，暂无可排唛架余额。'),
      selectable: false,
      reasonText: '裁床已领面料已锁定或已消耗，暂无可排唛架余额。',
    }
  }

  return {
    ...createSummaryMeta('CUTTABLE', cutOrderCuttableMeta.CUTTABLE.label, cutOrderCuttableMeta.CUTTABLE.className, '未关闭、已开工、有领料记录、有可用余额，且当前未被唛架方案锁定。'),
    selectable: true,
    reasonText: '当前裁片单满足可排唛架条件。',
  }
}

export function summarizeCutOrderRisks(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  cuttableState: CutOrderRow['cuttableState'],
  batchParticipationCount: number,
): CutOrderRiskTag[] {
  const keys = new Set<CutOrderRiskKey>()

  if (line.configStatus === 'NOT_CONFIGURED' || line.configStatus === 'PARTIAL') keys.add('PREP_DELAY')
  if (line.issueFlags.includes('RECEIVE_DIFF') || cuttableState.key === 'CLAIM_EXCEPTION') keys.add('CLAIM_EXCEPTION')
  if (!record.plannedShipDate) keys.add('DATE_MISSING')
  if (record.urgencyLevel === 'AA' || record.urgencyLevel === 'A') keys.add('SHIP_URGENT')
  if (line.issueFlags.includes('REPLENISH_PENDING') || record.riskFlags.includes('REPLENISH_PENDING')) keys.add('REPLENISH_PENDING')
  if (batchParticipationCount > 0) keys.add('IN_MARKER_PLAN')
  if (/已完成/.test(record.cuttingStage) && !record.hasInboundRecord) keys.add('STATUS_CONFLICT')

  return Array.from(keys).map((key) => ({
    key,
    label: cutOrderRiskMeta[key].label,
    className: cutOrderRiskMeta[key].className,
  }))
}

export function buildCutOrderNavigationPayload(row: {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  activeMarkerPlanRefId: string
  latestMarkerPlanNo: string
}): CutOrderNavigationPayload {
  return {
    productionProgress: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    },
    materialPrep: {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      materialSku: row.materialSku,
    },
    markerSpreading: {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      markerPlanNo: row.latestMarkerPlanNo || undefined,
      tab: 'spreadings',
    },
    feiTickets: {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
    },
    replenishment: {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderNo: row.productionOrderNo,
    },
    markerPlanRefs: {
      markerPlanId: row.activeMarkerPlanRefId || undefined,
      markerPlanNo: row.latestMarkerPlanNo || undefined,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
    },
    sameProductionOrders: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    },
  }
}

function buildKeywordIndex(values: Array<string | undefined | number | null>): string[] {
  return values
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).toLowerCase())
}

function buildPrepSummary(line: CuttingMaterialLine): CutOrderSummaryMeta<CuttingConfigStatus> {
  const meta = configMeta[line.configStatus]
  const detailText =
    line.configStatus === 'CONFIGURED'
      ? `中转仓已配 ${formatQty(line.configuredRollCount)} 卷 / ${formatQty(line.configuredLength)} 米。`
      : line.configStatus === 'PARTIAL'
        ? `中转仓已配 ${formatQty(line.configuredRollCount)} 卷，仍有剩余待补齐。`
        : '当前尚未进入待加工仓。'

  return createSummaryMeta(line.configStatus, meta.label, meta.className, detailText)
}

function buildClaimSummary(line: CuttingMaterialLine): CutOrderSummaryMeta<CuttingReceiveStatus> {
  const meta = receiveMeta[line.receiveStatus]
  const detailText =
    line.receiveStatus === 'RECEIVED'
      ? `裁床已领 ${formatQty(line.receivedRollCount)} 卷 / ${formatQty(line.receivedLength)} 米。`
      : line.receiveStatus === 'PARTIAL'
        ? `裁床已领 ${formatQty(line.receivedRollCount)} 卷，仍有余量可继续领料。`
        : '当前尚未完成领料。'

  return createSummaryMeta(line.receiveStatus, meta.label, meta.className, detailText)
}

function buildDateInfoLines(record: CuttingOrderProgressRecord): Array<{ label: '需求' | '下单' | '回货'; value: string }> {
  return [
    { label: '需求', value: formatDisplayDate(record.purchaseDate) },
    { label: '下单', value: formatDisplayDate(record.actualOrderDate) },
    { label: '回货', value: formatDisplayDate(record.plannedShipDate) },
  ]
}

function deriveVisibleCuttableStatus(
  cuttableState: CutOrderRow['cuttableState'],
): CutOrderRow['visibleCuttableStatus'] {
  const key: CutOrderCuttableVisibleStateKey = cuttableState.key === 'CUTTABLE' ? 'CUTTABLE' : 'NOT_CUTTABLE'
  const meta = cutOrderVisibleCuttableMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
  }
}

function createRow(
  source: GeneratedCutOrderSourceRecord,
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  progressRow: ProductionProgressRow | undefined,
  ledger: MarkerPlanRefRecord[],
  options: {
    startState: CutOrderStartState
    markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null
  },
): CutOrderRow {
  const batchSummary = summarizeMarkerPlanRefParticipation(source.cutOrderId, ledger)
  const materialQuantityLedger = buildCutOrderMaterialQuantityLedger(line, source, options.markerPlanOccupancy)
  const cuttableState = deriveCutOrderCuttableState(record, line, ledger, options.startState, materialQuantityLedger, options.markerPlanOccupancy)
  const currentStage = deriveCutOrderStage(record, line, options.startState)
  const materialPrepStatus = buildPrepSummary(line)
  const materialClaimStatus = buildClaimSummary(line)
  const urgencyKey = progressRow?.urgency.key ?? 'UNKNOWN'
  const urgency = urgencyMeta[urgencyKey]
  const currentStageLabel = currentStage.label
  const visibleCuttableStatus = deriveVisibleCuttableStatus(cuttableState)
  const markerPlanIds = options.markerPlanOccupancy?.markerPlanId
    ? uniqueStrings([options.markerPlanOccupancy.markerPlanId, ...batchSummary.markerPlanIds])
    : batchSummary.markerPlanIds
  const markerPlanNos = options.markerPlanOccupancy?.markerPlanNo
    ? uniqueStrings([options.markerPlanOccupancy.markerPlanNo, ...batchSummary.markerPlanNos])
    : batchSummary.markerPlanNos
  const markerPlanParticipationCount = Math.max(
    batchSummary.batchParticipationCount,
    options.markerPlanOccupancy?.markerPlanNo || options.markerPlanOccupancy?.markerPlanId ? 1 : 0,
  )
  const activeMarkerPlanId = options.markerPlanOccupancy?.markerPlanId || batchSummary.activeMarkerPlanId
  const activeMarkerPlanNo = options.markerPlanOccupancy?.markerPlanNo || batchSummary.activeMarkerPlanNo
  const latestMarkerPlanNo = options.markerPlanOccupancy?.markerPlanNo || batchSummary.latestMarkerPlanNo
  const riskTags = summarizeCutOrderRisks(record, line, cuttableState, markerPlanParticipationCount)

  const row: CutOrderRow = {
    id: source.cutOrderId,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    assignedFactoryName: progressRow?.assignedFactoryName || '',
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    styleName: record.styleName,
    color: line.color || source.colorScope[0] || '待补',
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialCategory: source.materialCategory || materialCategoryLabel(source.materialType),
    materialLabel: source.materialLabel,
    materialAlias: source.materialAlias || line.materialAlias || '',
    materialImageUrl: source.materialImageUrl || line.materialImageUrl || '',
    orderQty: record.orderQty,
    pieceCountText: formatQty(record.orderQty),
    plannedQty: source.requiredQty,
    receivedQty: line.receivedLength,
    materialQuantityLedger,
    purchaseDate: record.purchaseDate,
    actualOrderDate: record.actualOrderDate,
    plannedShipDate: record.plannedShipDate,
    dateInfoLines: buildDateInfoLines(record),
    sellingPrice: record.sellingPrice ?? null,
    urgencyKey,
    urgencyLabel: urgency.label,
    urgencyClassName: urgency.className,
    materialPrepStatus,
    materialClaimStatus,
    currentStage,
    currentStageLabel,
    cuttableState,
    visibleCuttableStatus,
    markerPlanIds,
    markerPlanNos,
    latestMarkerPlanNo,
    batchParticipationCount: markerPlanParticipationCount,
    activeMarkerPlanId,
    activeMarkerPlanNo,
    closeReason: record.closeReason || '',
    closedAt: record.closedAt || '',
    riskTags,
    statusSummary: [
      `裁片单${currentStage.label}`,
      cuttableState.label,
      `中转仓${materialPrepStatus.label}`,
      `裁床${materialClaimStatus.label}`,
    ].join(' / '),
    relationSummary: markerPlanParticipationCount
      ? `已参与 ${markerPlanParticipationCount} 个唛架方案`
      : '当前尚未进入唛架方案',
    latestActionText: line.latestActionText || record.lastFieldUpdateAt || '暂无最近执行痕迹。',
    navigationPayload: buildCutOrderNavigationPayload({
      cutOrderId: source.cutOrderId,
      cutOrderNo: source.cutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      styleCode: record.styleCode,
      spuCode: record.spuCode,
      materialSku: source.materialSku,
      activeMarkerPlanRefId: activeMarkerPlanId,
      latestMarkerPlanNo,
    }),
    keywordIndex: buildKeywordIndex([
      source.cutOrderNo,
      source.productionOrderId,
      source.productionOrderNo,
      record.styleCode,
      record.spuCode,
      record.styleName,
      source.materialSku,
      source.materialLabel,
      source.materialAlias,
      source.materialType,
      source.materialCategory,
      line.color,
      batchSummary.latestMarkerPlanNo,
    ]),
  }

  return row
}

export function buildCutOrderViewModel(
  records: CuttingOrderProgressRecord[],
  ledger: MarkerPlanRefRecord[] = [],
  options: {
    progressRows?: ProductionProgressRow[]
    markerPlanOccupancy?: MarkerPlanOccupancyLookup
  } = {},
): CutOrderViewModel {
  const startStateLookup = buildCutOrderStartStateLookup()
  const markerPlanOccupancyLookup = options.markerPlanOccupancy ?? {}
  const progressRowMap = new Map(
    (options.progressRows ?? buildProductionProgressRows(records)).map((row) => [row.productionOrderId, row] as const),
  )
  const recordMap = new Map(records.map((record) => [record.productionOrderId, record] as const))
  const lineMap = new Map<string, CuttingMaterialLine>()
  records.forEach((record) => {
    record.materialLines.forEach((line) => {
      const key = line.cutOrderId || line.cutOrderNo || line.cutPieceOrderNo
      if (key) lineMap.set(key, line)
    })
  })

  const rows = listGeneratedCutOrderSourceRecords()
    .map((source) => {
      const record = recordMap.get(source.productionOrderId)
      if (!record) return null
      const line = lineMap.get(source.cutOrderId) || buildProgressLineFallback(source)
      return createRow(source, record, line, progressRowMap.get(source.productionOrderId), ledger, {
        startState: resolveCutOrderStartState(startStateLookup, {
          cutOrderId: source.cutOrderId,
          cutOrderNo: source.cutOrderNo,
          cutPieceOrderNo: line.cutPieceOrderNo,
        }),
        markerPlanOccupancy: markerPlanOccupancyLookup[source.cutOrderId] || markerPlanOccupancyLookup[source.cutOrderNo] || null,
      })
    })
    .filter((row): row is CutOrderRow => row !== null)
    .sort((left, right) => {
      const leftWeight = urgencyMeta[left.urgencyKey].sortWeight
      const rightWeight = urgencyMeta[right.urgencyKey].sortWeight
      return (
        rightWeight - leftWeight ||
        left.plannedShipDate.localeCompare(right.plannedShipDate, 'zh-CN') ||
        left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN') ||
        left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
      )
    })

  return {
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
  }
}

function matchText(value: string, search: string): boolean {
  return value.toLowerCase().includes(search.trim().toLowerCase())
}

function applyPrefilter(rows: CutOrderRow[], prefilter: CutOrderPrefilter | null): CutOrderRow[] {
  if (!prefilter) return rows

  return rows.filter((row) => {
    if (prefilter.productionOrderId && row.productionOrderId !== prefilter.productionOrderId) return false
    if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter.cutOrderId && row.cutOrderId !== prefilter.cutOrderId) return false
    if (prefilter.cutOrderNo && row.cutOrderNo !== prefilter.cutOrderNo) return false
    if (prefilter.markerPlanId && !row.markerPlanIds.includes(prefilter.markerPlanId)) return false
    if (prefilter.markerPlanNo && !row.markerPlanNos.includes(prefilter.markerPlanNo)) return false
    if (prefilter.styleCode && row.styleCode !== prefilter.styleCode) return false
    if (prefilter.spuCode && row.spuCode !== prefilter.spuCode) return false
    if (prefilter.materialSku && row.materialSku !== prefilter.materialSku) return false
    return true
  })
}

export function filterCutOrderRows(
  rows: CutOrderRow[],
  filters: CutOrderFilters,
  prefilter: CutOrderPrefilter | null,
): CutOrderRow[] {
  const prefilteredRows = applyPrefilter(rows, prefilter)

  return prefilteredRows.filter((row) => {
    if (filters.keyword && !row.keywordIndex.some((value) => value.includes(filters.keyword.trim().toLowerCase()))) return false
    if (filters.productionOrderNo && !matchText(row.productionOrderNo, filters.productionOrderNo)) return false
    if (filters.styleKeyword) {
      const styleNeedle = filters.styleKeyword.trim().toLowerCase()
      if (![row.styleCode, row.spuCode, row.styleName].some((value) => value.toLowerCase().includes(styleNeedle))) return false
    }
    if (filters.materialSku) {
      const materialNeedle = filters.materialSku.trim().toLowerCase()
      if (![row.materialSku, row.materialCategory, row.materialLabel].some((value) => value.toLowerCase().includes(materialNeedle))) return false
    }
    if (filters.currentStage !== 'ALL' && row.currentStage.key !== filters.currentStage) return false
    if (filters.cuttableState !== 'ALL' && row.visibleCuttableStatus.key !== filters.cuttableState) return false
    if (filters.prepStatus !== 'ALL' && row.materialPrepStatus.key !== filters.prepStatus) return false
    if (filters.claimStatus !== 'ALL' && row.materialClaimStatus.key !== filters.claimStatus) return false
    if (filters.inBatch === 'IN_MARKER_PLAN' && !row.activeMarkerPlanNo) return false
    if (filters.inBatch === 'NOT_IN_MARKER_PLAN' && row.activeMarkerPlanNo) return false
    if (filters.riskOnly && row.riskTags.length === 0) return false
    return true
  })
}

export function buildCutOrderStats(rows: CutOrderRow[]): CutOrderStats {
  return {
    totalCount: rows.length,
    cuttableCount: rows.filter((row) => row.cuttableState.key === 'CUTTABLE').length,
    inBatchCount: rows.filter((row) => row.activeMarkerPlanNo).length,
    prepExceptionCount: rows.filter((row) => row.materialPrepStatus.key !== 'CONFIGURED').length,
    claimExceptionCount: rows.filter((row) => row.materialClaimStatus.key !== 'RECEIVED' || row.cuttableState.key === 'CLAIM_EXCEPTION').length,
    feiPendingCount: rows.filter((row) => row.currentStage.key !== 'CLOSED').length,
  }
}

export function findCutOrderByPrefilter(
  rows: CutOrderRow[],
  prefilter: CutOrderPrefilter | null,
): CutOrderRow | null {
  if (!prefilter) return null
  if (prefilter.cutOrderId) return rows.find((row) => row.cutOrderId === prefilter.cutOrderId) ?? null
  if (prefilter.cutOrderNo) return rows.find((row) => row.cutOrderNo === prefilter.cutOrderNo) ?? null
  return null
}
