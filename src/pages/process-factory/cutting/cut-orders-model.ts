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
import type {
  CuttingTaskAssigneeType,
  CuttingTaskExecutionRoute,
} from '../../../data/fcs/cutting/cutting-task-routing.ts'
import {
  buildMaterialLedgerProjectionMap,
  type MaterialLedgerProjection,
} from '../../../data/fcs/cutting/material-ledger.ts'
import {
  applyCutOrderCloseRecordToProgressRecord,
  buildCutOrderCloseRecordLookup,
  type CutOrderCloseRecord,
} from '../../../data/fcs/cutting/cut-order-close-records'
import {
  buildProductionProgressRows,
  configMeta,
  receiveMeta,
  type ProductionProgressRow,
  type ProductionProgressUrgencyKey,
  urgencyMeta,
} from './production-progress-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
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

export type CutOrderRiskKey =
  | 'PREP_DELAY'
  | 'CLAIM_EXCEPTION'
  | 'SHIP_URGENT'
  | 'DATE_MISSING'
  | 'STATUS_CONFLICT'
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
  markerPlanSources: Record<string, string | undefined>
  sameProductionOrders: Record<string, string | undefined>
}

export type CutOrderMaterialQuantityLedger = MaterialLedgerProjection

export interface CutOrderRow {
  id: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cuttingTaskId: string
  cuttingTaskNo: string
  cuttingTaskAssignmentStatus: string
  cuttingTaskAssigneeFactoryId: string
  cuttingTaskAssigneeFactoryName: string
  cuttingTaskAssigneeType: CuttingTaskAssigneeType
  executionRoute: CuttingTaskExecutionRoute
  executionRouteLabel: string
  assignedFactoryId: string
  assignedFactoryName: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSku: string
  materialType: CuttingMaterialType
  materialCategory: string
  materialLabel: string
  materialName: string
  materialColor: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternKind: string
  effectiveWidthText: string
  piecePartNames: string[]
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
  availableQty: number
  availableUnit: string
  claimedQty: number
  consumedQty: number
  markerPlanIds: string[]
  markerPlanNos: string[]
  latestMarkerPlanNo: string
  batchParticipationCount: number
  activeMarkerPlanId: string
  activeMarkerPlanNo: string
  closeReasonCode: CuttingOrderProgressRecord['closeReasonCode']
  closeReasonText: string
  closeReason: string
  closedAt: string
  closedBy: string
  ledgerSnapshotBeforeClose: CuttingOrderProgressRecord['ledgerSnapshotBeforeClose'] | null
  closeRecord: CutOrderCloseRecord | null
  openImpactItems: CutOrderCloseRecord['openImpactItems']
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
  inBatch: 'ALL' | 'IN_MARKER_PLAN' | 'NOT_IN_MARKER_PLAN'
  hasAvailableBalance: 'ALL' | 'YES' | 'NO'
  hasCloseReason: 'ALL' | 'YES' | 'NO'
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
  inBatchCount: number
  availableBalanceCount: number
  closedCount: number
  noClaimRecordCount: number
}

export const cutOrderStageMeta: Record<CutOrderStageKey, { label: string; className: string }> = {
  NOT_STARTED: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
  STARTED: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
  CLOSED: { label: '已关闭', className: 'bg-zinc-100 text-zinc-700' },
}

export const cutOrderRiskMeta: Record<CutOrderRiskKey, { label: string; className: string }> = {
  PREP_DELAY: { label: '配料数量不足', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  CLAIM_EXCEPTION: { label: '领料差异', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  IN_MARKER_PLAN: { label: '唛架方案占用', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
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
    materialIdentity: { ...source.materialIdentity },
    patternIdentity: {
      ...source.patternIdentity,
      piecePartCodes: [...source.patternIdentity.piecePartCodes],
      piecePartNames: [...source.patternIdentity.piecePartNames],
    },
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

function getBatchSortTime(batch: MarkerPlanSourceRecord): string {
  return batch.updatedAt || batch.createdAt || ''
}

export function summarizeMarkerPlanSourceParticipation(
  cutOrderId: string,
  ledger: MarkerPlanSourceRecord[],
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
  if (record.closeReason || record.closedAt || /已关闭|不再继续裁剪/.test(record.cuttingStage)) {
    return createSummaryMeta('CLOSED', cutOrderStageMeta.CLOSED.label, cutOrderStageMeta.CLOSED.className, record.closeReason || '该裁片单已关闭，不再继续排唛架铺布裁剪。')
  }

  if (startState.started || record.hasSpreadingRecord || record.hasInboundRecord) {
    return createSummaryMeta('STARTED', cutOrderStageMeta.STARTED.label, cutOrderStageMeta.STARTED.className, '裁床已开工；排唛架、铺布、裁剪作为子作业单独追踪。')
  }

  return createSummaryMeta('NOT_STARTED', cutOrderStageMeta.NOT_STARTED.label, cutOrderStageMeta.NOT_STARTED.className, '裁床尚未开工。')
}

function buildCutOrderMaterialQuantityLedger(
  source: GeneratedCutOrderSourceRecord,
  materialLedgerProjectionMap: Record<string, MaterialLedgerProjection>,
): CutOrderMaterialQuantityLedger {
  const projection = materialLedgerProjectionMap[source.cutOrderId] || materialLedgerProjectionMap[source.cutOrderNo]
  if (projection) return projection
  return {
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    materialIdentity: { ...source.materialIdentity },
    patternIdentity: {
      ...source.patternIdentity,
      piecePartCodes: [...source.patternIdentity.piecePartCodes],
      piecePartNames: [...source.patternIdentity.piecePartNames],
    },
    requiredMaterialQty: 0,
    transferWarehouseAllocatedQty: 0,
    cuttingClaimedQty: 0,
    spreadingConsumedQty: 0,
    returnedQty: 0,
    adjustmentQty: 0,
    availableQty: 0,
    unit: source.materialIdentity.materialUnit || source.materialUnit || '米',
    latestClaimEvent: null,
    events: [],
  }
}

export function summarizeCutOrderRisks(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  batchParticipationCount: number,
): CutOrderRiskTag[] {
  const keys = new Set<CutOrderRiskKey>()

  if (line.configStatus === 'NOT_CONFIGURED' || line.configStatus === 'PARTIAL') keys.add('PREP_DELAY')
  if (line.issueFlags.includes('RECEIVE_DIFF')) keys.add('CLAIM_EXCEPTION')
  if (!record.plannedShipDate) keys.add('DATE_MISSING')
  if (record.urgencyLevel === 'AA' || record.urgencyLevel === 'A') keys.add('SHIP_URGENT')
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
  activeMarkerPlanSourceId: string
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
    markerPlanSources: {
      markerPlanId: row.activeMarkerPlanSourceId || undefined,
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

function buildDateInfoLines(record: CuttingOrderProgressRecord): Array<{ label: '需求' | '下单' | '回货'; value: string }> {
  return [
    { label: '需求', value: formatDisplayDate(record.purchaseDate) },
    { label: '下单', value: formatDisplayDate(record.actualOrderDate) },
    { label: '回货', value: formatDisplayDate(record.plannedShipDate) },
  ]
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

function createRow(
  source: GeneratedCutOrderSourceRecord,
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  progressRow: ProductionProgressRow | undefined,
  ledger: MarkerPlanSourceRecord[],
  options: {
    startState: CutOrderStartState
    markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null
    materialLedgerProjectionMap: Record<string, MaterialLedgerProjection>
    closeRecordLookup: Record<string, CutOrderCloseRecord>
  },
): CutOrderRow {
  const closeRecord = options.closeRecordLookup[source.cutOrderId] || options.closeRecordLookup[source.cutOrderNo] || null
  const effectiveRecord = applyCutOrderCloseRecordToProgressRecord(record, closeRecord)
  const batchSummary = summarizeMarkerPlanSourceParticipation(source.cutOrderId, ledger)
  const materialQuantityLedger = buildCutOrderMaterialQuantityLedger(source, options.materialLedgerProjectionMap)
  const currentStage = deriveCutOrderStage(effectiveRecord, line, options.startState)
  const materialPrepStatus = buildPrepSummary(line)
  const materialClaimStatus = buildClaimSummary(line)
  const urgencyKey = progressRow?.urgency.key ?? 'UNKNOWN'
  const urgency = urgencyMeta[urgencyKey]
  const currentStageLabel = currentStage.label
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
  const riskTags = summarizeCutOrderRisks(effectiveRecord, line, markerPlanParticipationCount)
  const patternIdentity = line.patternIdentity || source.patternIdentity
  const materialIdentity = line.materialIdentity || source.materialIdentity

  const row: CutOrderRow = {
    id: source.cutOrderId,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    cuttingTaskId: source.cuttingTaskId,
    cuttingTaskNo: source.cuttingTaskNo,
    cuttingTaskAssignmentStatus: source.cuttingTaskAssignmentStatus,
    cuttingTaskAssigneeFactoryId: source.cuttingTaskAssigneeFactoryId,
    cuttingTaskAssigneeFactoryName: source.cuttingTaskAssigneeFactoryName,
    cuttingTaskAssigneeType: source.cuttingTaskAssigneeType,
    executionRoute: source.executionRoute,
    executionRouteLabel: source.executionRouteLabel,
    assignedFactoryId: source.cuttingTaskAssigneeFactoryId,
    assignedFactoryName: source.cuttingTaskAssigneeFactoryName || progressRow?.assignedFactoryName || '',
    styleCode: effectiveRecord.styleCode,
    spuCode: effectiveRecord.spuCode,
    styleName: effectiveRecord.styleName,
    color: materialIdentity.materialColor || line.color || source.colorScope[0] || '待补',
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialCategory: source.materialCategory || materialCategoryLabel(source.materialType),
    materialLabel: source.materialLabel,
    materialName: materialIdentity.materialName || source.materialName || source.materialLabel,
    materialColor: materialIdentity.materialColor || source.materialColor || line.color || source.colorScope[0] || '',
    materialAlias: materialIdentity.materialAlias || source.materialAlias || line.materialAlias || '',
    materialImageUrl: materialIdentity.materialImageUrl || source.materialImageUrl || line.materialImageUrl || '',
    materialUnit: materialIdentity.materialUnit || source.materialUnit || '米',
    patternFileId: patternIdentity.patternFileId,
    patternFileName: patternIdentity.patternFileName,
    patternVersion: patternIdentity.patternVersion,
    patternKind: patternIdentity.patternKind,
    effectiveWidthText: `${patternIdentity.effectiveWidthValue}${patternIdentity.effectiveWidthUnit}`,
    piecePartNames: [...patternIdentity.piecePartNames],
    orderQty: effectiveRecord.orderQty,
    pieceCountText: formatQty(effectiveRecord.orderQty),
    plannedQty: source.requiredQty,
    receivedQty: line.receivedLength,
    materialQuantityLedger,
    purchaseDate: effectiveRecord.purchaseDate,
    actualOrderDate: effectiveRecord.actualOrderDate,
    plannedShipDate: effectiveRecord.plannedShipDate,
    dateInfoLines: buildDateInfoLines(effectiveRecord),
    sellingPrice: effectiveRecord.sellingPrice ?? null,
    urgencyKey,
    urgencyLabel: urgency.label,
    urgencyClassName: urgency.className,
    materialPrepStatus,
    materialClaimStatus,
    currentStage,
    currentStageLabel,
    availableQty: materialQuantityLedger.availableQty,
    availableUnit: materialQuantityLedger.unit,
    claimedQty: materialQuantityLedger.cuttingClaimedQty,
    consumedQty: materialQuantityLedger.spreadingConsumedQty,
    markerPlanIds,
    markerPlanNos,
    latestMarkerPlanNo,
    batchParticipationCount: markerPlanParticipationCount,
    activeMarkerPlanId,
    activeMarkerPlanNo,
    closeReasonCode: closeRecord?.closeReasonCode || effectiveRecord.closeReasonCode,
    closeReasonText: closeRecord?.closeReasonText || effectiveRecord.closeReasonText || '',
    closeReason: closeRecord?.closeDescription || effectiveRecord.closeReason || '',
    closedAt: closeRecord?.closedAt || effectiveRecord.closedAt || '',
    closedBy: closeRecord?.closedBy || effectiveRecord.closedBy || '',
    ledgerSnapshotBeforeClose: closeRecord?.ledgerSnapshotBeforeClose || effectiveRecord.ledgerSnapshotBeforeClose || null,
    closeRecord,
    openImpactItems: closeRecord?.openImpactItems || [],
    riskTags,
    statusSummary: [
      `裁片单${currentStage.label}`,
      activeMarkerPlanNo || latestMarkerPlanNo ? '已关联唛架方案' : '未关联唛架方案',
    ].join(' / '),
    relationSummary: markerPlanParticipationCount
      ? `已参与 ${markerPlanParticipationCount} 个唛架方案`
      : '当前尚未进入唛架方案',
    latestActionText: line.latestActionText || effectiveRecord.lastFieldUpdateAt || '暂无最近执行痕迹。',
    navigationPayload: buildCutOrderNavigationPayload({
      cutOrderId: source.cutOrderId,
      cutOrderNo: source.cutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      styleCode: effectiveRecord.styleCode,
      spuCode: effectiveRecord.spuCode,
      materialSku: source.materialSku,
      activeMarkerPlanSourceId: activeMarkerPlanId,
      latestMarkerPlanNo,
    }),
    keywordIndex: buildKeywordIndex([
      source.cutOrderNo,
      source.productionOrderId,
      source.productionOrderNo,
      effectiveRecord.styleCode,
      effectiveRecord.spuCode,
      effectiveRecord.styleName,
      source.materialSku,
      source.materialLabel,
      source.materialAlias,
      source.materialColor,
      source.materialName,
      source.patternIdentity.patternFileId,
      source.patternIdentity.patternFileName,
      source.patternIdentity.patternVersion,
      source.patternIdentity.patternKind,
      `${source.patternIdentity.effectiveWidthValue}${source.patternIdentity.effectiveWidthUnit}`,
      ...source.patternIdentity.piecePartNames,
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
  ledger: MarkerPlanSourceRecord[] = [],
  options: {
    progressRows?: ProductionProgressRow[]
    markerPlanOccupancy?: MarkerPlanOccupancyLookup
  } = {},
): CutOrderViewModel {
  const startStateLookup = buildCutOrderStartStateLookup()
  const markerPlanOccupancyLookup = options.markerPlanOccupancy ?? {}
  const materialLedgerProjectionMap = buildMaterialLedgerProjectionMap()
  const closeRecordLookup = buildCutOrderCloseRecordLookup()
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
        materialLedgerProjectionMap,
        closeRecordLookup,
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
    if (filters.inBatch === 'IN_MARKER_PLAN' && !row.activeMarkerPlanNo) return false
    if (filters.inBatch === 'NOT_IN_MARKER_PLAN' && row.activeMarkerPlanNo) return false
    if (filters.hasAvailableBalance === 'YES' && row.materialQuantityLedger.availableQty <= 0) return false
    if (filters.hasAvailableBalance === 'NO' && row.materialQuantityLedger.availableQty > 0) return false
    if (filters.hasCloseReason === 'YES' && !row.closeReason) return false
    if (filters.hasCloseReason === 'NO' && row.closeReason) return false
    if (filters.riskOnly && row.riskTags.length === 0) return false
    return true
  })
}

export function buildCutOrderStats(rows: CutOrderRow[]): CutOrderStats {
  return {
    totalCount: rows.length,
    inBatchCount: rows.filter((row) => row.activeMarkerPlanNo).length,
    availableBalanceCount: rows.filter((row) => row.materialQuantityLedger.availableQty > 0).length,
    closedCount: rows.filter((row) => row.currentStage.key === 'CLOSED').length,
    noClaimRecordCount: rows.filter((row) => row.materialQuantityLedger.cuttingClaimedQty <= 0).length,
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
