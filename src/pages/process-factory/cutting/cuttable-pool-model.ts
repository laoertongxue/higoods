import type {
  CuttingMarkerPlanOccupancyStatus,
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
} from '../../../data/fcs/cutting/types.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-cut-orders.ts'
import {
  buildCutOrderStartStateLookup,
  resolveCutOrderStartState,
  type CutOrderStartState,
} from './cutting-readiness.ts'
import type { MarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts'
import {
  buildProductionProgressRows,
  type ProductionProgressRiskTag,
  type ProductionProgressRow,
  type ProductionProgressUrgencyKey,
  urgencyMeta,
} from './production-progress-model.ts'
import { buildMarkerPlanCombinationGroupKey } from './marker-plan-domain.ts'

export type CuttableViewMode = 'STYLE_GROUP' | 'PRODUCTION_ORDER'
export type CuttableStateKey =
  | 'CUTTABLE'
  | 'WAITING_PREP'
  | 'PARTIAL_PREP'
  | 'WAITING_CLAIM'
  | 'PARTIAL_CLAIM'
  | 'CLAIM_EXCEPTION'
  | 'WAITING_START'
  | 'IN_MARKER_PLAN'
  | 'NOT_READY'
export type CuttableVisibleStatusKey = 'CUTTABLE' | 'NOT_CUTTABLE'
export type CoverageStatusKey = 'FULL' | 'PARTIAL' | 'BLOCKED'

export interface CuttableSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface CuttableCutOrderItem {
  id: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  orderQty: number
  plannedShipDate: string
  plannedShipDateDisplay: string
  urgencyKey: ProductionProgressUrgencyKey
  urgencyLabel: string
  materialSku: string
  materialType: string
  materialLabel: string
  materialCategory: string
  materialAlias: string
  materialImageUrl: string
  materialPrepStatus: CuttingConfigStatus
  materialClaimStatus: CuttingReceiveStatus
  configuredRollCount: number
  configuredLength: number
  receivedRollCount: number
  receivedLength: number
  lockedLength: number
  consumedLength: number
  availableLength: number
  currentStage: string
  visibleStatus: CuttableSummaryMeta<CuttableVisibleStatusKey>
  cuttableState: CuttableSummaryMeta<CuttableStateKey> & {
    selectable: boolean
    reasonText: string
  }
  currentSituationText: string
  markerPlanGroupKey: string
  markerPlanOccupancyStatus: CuttingMarkerPlanOccupancyStatus
  markerPlanNo: string
  latestActionText: string
  keywordIndex: string[]
}

interface CuttableMaterialBalance {
  receivedLength: number
  consumedLength: number
  lockedLength: number
  availableLength: number
}

export interface CuttableProductionOrderSummary {
  id: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  factoryName: string
  urgency: ProductionProgressRow['urgency']
  orderQty: number
  plannedShipDate: string
  plannedShipDateDisplay: string
  shipCountdownText: string
  cuttableCutOrderCount: number
  totalCutOrderCount: number
  coverageStatus: CuttableSummaryMeta<CoverageStatusKey>
  riskTags: ProductionProgressRiskTag[]
  items: CuttableCutOrderItem[]
  filterPayloadForCutOrders: {
    productionOrderId: string
    productionOrderNo: string
  }
  filterPayloadForMaterialPrep: {
    productionOrderId: string
    productionOrderNo: string
  }
}

export interface CuttableMarkerPlanBucket {
  markerPlanGroupKey: string
  materialSku: string
  cuttableCount: number
  totalCount: number
  productionOrderCount: number
}

export interface QuickMarkerPlanBucket {
  markerPlanGroupKey: string
  styleCode: string
  spuCode: string
  styleName: string
  materialSku: string
  materialLabel: string
  materialAlias: string
  materialImageUrl: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  itemIds: string[]
  cuttableCount: number
  productionOrderCount: number
  earliestShipDate: string
  earliestShipDateDisplay: string
  highestUrgencyKey: ProductionProgressUrgencyKey
  highestUrgencyLabel: string
  highestUrgencySortWeight: number
}

export interface CuttableStyleGroup {
  styleCode: string
  spuCode: string
  styleName: string
  orders: CuttableProductionOrderSummary[]
  totalOrderCount: number
  totalCutOrderCount: number
  cuttableCutOrderCount: number
  fullOrderCount: number
  partialOrderCount: number
  blockedOrderCount: number
  markerPlanBuckets: CuttableMarkerPlanBucket[]
}

export interface CuttablePoolViewModel {
  groups: CuttableStyleGroup[]
  orders: CuttableProductionOrderSummary[]
  itemsById: Record<string, CuttableCutOrderItem>
}

export interface CuttablePoolFilters {
  keyword: string
  urgencyLevel: 'ALL' | ProductionProgressUrgencyKey
  cuttableState: 'ALL' | CuttableVisibleStatusKey
  coverageStatus: 'ALL' | CoverageStatusKey
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | CuttingReceiveStatus | 'EXCEPTION'
  onlyCuttable: boolean
}

export interface CuttablePoolPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  styleCode?: string
  spuCode?: string
  urgencyLevel?: ProductionProgressUrgencyKey
  riskOnly?: boolean
}

export interface CuttablePoolStats {
  productionOrderCount: number
  cutOrderCount: number
  cuttableCutOrderCount: number
  prepPendingCutOrderCount: number
  claimPendingCutOrderCount: number
}

export const cuttableStateMeta: Record<CuttableStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  WAITING_PREP: { label: '无配料数量', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  PARTIAL_PREP: { label: '配料数量不足', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  WAITING_CLAIM: { label: '无领料记录', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PARTIAL_CLAIM: { label: '领料数量不足', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  WAITING_START: { label: '待开工', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  IN_MARKER_PLAN: { label: '已入唛架方案', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  NOT_READY: { label: '暂不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const cuttableVisibleStatusMeta: Record<CuttableVisibleStatusKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  NOT_CUTTABLE: { label: '暂不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

const coverageMeta: Record<CoverageStatusKey, { label: string; className: string }> = {
  FULL: { label: '整单可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  PARTIAL: { label: '部分可排唛架', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  BLOCKED: { label: '整单暂不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

function materialTypeLabel(materialType: string): string {
  if (materialType === 'PRINT') return '主料'
  if (materialType === 'DYE') return '主料'
  if (materialType === 'LINING') return '里辅料'
  return '主料'
}

function resolveMarkerPlanEffectiveWidthByMaterialType(materialType: string): number {
  if (materialType === 'LINING') return 92
  return 120
}

function buildKeywordIndex(values: Array<string | undefined>): string[] {
  return values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
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
    markerPlanOccupancyStatus: 'AVAILABLE',
    skuScopeLines: source.skuScopeLines.map((line) => ({ ...line })),
    issueFlags: [],
    latestActionText: `裁片单 ${source.cutOrderNo} 已从生产单生成，待进入可排唛架判断。`,
  }
}

function createCuttableState(
  key: CuttableStateKey,
  detailText: string,
  reasonText = detailText,
): CuttableSummaryMeta<CuttableStateKey> & { selectable: boolean; reasonText: string } {
  const meta = cuttableStateMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    detailText,
    selectable: key === 'CUTTABLE',
    reasonText,
  }
}

function createVisibleStatus(key: CuttableVisibleStatusKey): CuttableSummaryMeta<CuttableVisibleStatusKey> {
  const meta = cuttableVisibleStatusMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    detailText: meta.label,
  }
}

function createCoverageStatus(key: CoverageStatusKey, detailText: string): CuttableSummaryMeta<CoverageStatusKey> {
  const meta = coverageMeta[key]
  return {
    key,
    label: meta.label,
    className: meta.className,
    detailText,
  }
}

export function buildMarkerPlanGroupKey(source: {
  styleCode?: string
  spuCode?: string
  materialSku?: string
  patternKey?: string
  effectiveWidth?: number | string
  historicalGroupKey?: string
}): string {
  return buildMarkerPlanCombinationGroupKey(source)
}

function formatLength(value: number): string {
  return `${Math.round(Number(value || 0) * 10) / 10} m`
}

function isClosedCutOrder(record: CuttingOrderProgressRecord): boolean {
  return Boolean(record.closeReason || record.closedAt || /已关闭|不再补裁/.test(record.cuttingStage))
}

function hasClaimRecord(line: CuttingMaterialLine, record: CuttingOrderProgressRecord): boolean {
  return Number(line.receivedLength || 0) > 0
    || Number(line.receivedRollCount || 0) > 0
    || Boolean(record.lastPickupScanAt)
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

function estimateConsumedLength(line: CuttingMaterialLine, source: GeneratedCutOrderSourceRecord, receivedLength: number): number {
  const actualPieceQty = (line.pieceProgressLines || []).reduce((total, pieceLine) => total + Math.max(Number(pieceLine.actualCutQty || 0), 0), 0)
  if (actualPieceQty <= 0) return 0

  const requiredPieceQty = sumRequiredPieceQty(source)
  if (requiredPieceQty <= 0) return 0

  const consumedRatio = Math.min(actualPieceQty / requiredPieceQty, 1)
  return Math.min(receivedLength, receivedLength * consumedRatio)
}

function buildCuttableMaterialBalance(
  line: CuttingMaterialLine,
  source: GeneratedCutOrderSourceRecord,
  markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null = null,
): CuttableMaterialBalance {
  const receivedLength = Math.max(Number(line.receivedLength || 0), 0)
  const consumedLength = estimateConsumedLength(line, source, receivedLength)
  const unlockableBalance = Math.max(receivedLength - consumedLength, 0)
  const lockedLength = markerPlanOccupancy ? unlockableBalance : 0
  const availableLength = Math.max(receivedLength - consumedLength - lockedLength, 0)

  return {
    receivedLength,
    consumedLength,
    lockedLength,
    availableLength,
  }
}

function hasValidMarkerPlanGroupKey(markerPlanGroupKey: string): boolean {
  return Boolean(markerPlanGroupKey)
    && !markerPlanGroupKey.includes('UNKNOWN_STYLE')
    && !markerPlanGroupKey.includes('UNKNOWN_SPU')
    && !markerPlanGroupKey.includes('UNKNOWN_PATTERN')
    && !markerPlanGroupKey.includes('UNKNOWN_WIDTH')
}

export function deriveCutOrderCuttableState(
  line: CuttingMaterialLine,
  record: CuttingOrderProgressRecord,
  startState: CutOrderStartState,
  source: GeneratedCutOrderSourceRecord,
  markerPlanGroupKey: string,
  markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null = null,
): CuttableSummaryMeta<CuttableStateKey> & { selectable: boolean; reasonText: string } {
  const balance = buildCuttableMaterialBalance(line, source, markerPlanOccupancy)

  if (isClosedCutOrder(record)) {
    return createCuttableState('NOT_READY', record.closeReason || '该裁片单已关闭，不再排唛架', record.closeReason || '该裁片单已关闭，不再排唛架')
  }

  if (!hasClaimRecord(line, record)) {
    return createCuttableState('WAITING_CLAIM', '无领料记录', '当前还没有裁床领料记录')
  }

  if (!startState.started) {
    return createCuttableState('WAITING_START', '已领料，待裁床任务开工', '已领料但尚未开工，暂不可排唛架')
  }

  if (markerPlanOccupancy) {
    const markerPlanNo = markerPlanOccupancy.markerPlanNo || line.markerPlanNo || '当前唛架方案'
    return createCuttableState('IN_MARKER_PLAN', `当前余额已被唛架方案 ${markerPlanNo} 锁定`, '当前可用领料余额已被唛架方案锁定')
  }

  if (balance.availableLength <= 0) {
    return createCuttableState('NOT_READY', '无可用领料余额', '裁床已领面料已锁定或已消耗，暂无可排唛架余额')
  }

  if (!hasValidMarkerPlanGroupKey(markerPlanGroupKey)) {
    return createCuttableState('NOT_READY', '缺少 SPU 或纸样信息', '缺少同组排唛架所需的 SPU 或纸样信息')
  }

  return createCuttableState('CUTTABLE', `可用余额 ${formatLength(balance.availableLength)}`, '未关闭、已开工、有领料记录、有可用余额，且当前未被唛架方案锁定')
}

function deriveCutOrderBlockingReason(
  line: CuttingMaterialLine,
  record: CuttingOrderProgressRecord,
  cuttableStateKey: CuttableStateKey,
): string {
  if (cuttableStateKey === 'WAITING_PREP') return '当前还没有中转仓配料数量'
  if (cuttableStateKey === 'PARTIAL_PREP') return '当前中转仓配料数量不足'
  if (cuttableStateKey === 'WAITING_CLAIM') return '当前还没有裁床领料记录'
  if (cuttableStateKey === 'PARTIAL_CLAIM') return '当前裁床领料数量不足'
  if (cuttableStateKey === 'CLAIM_EXCEPTION') return '领料对象数量不一致，先核对'
  if (cuttableStateKey === 'WAITING_START') return '已领料但尚未开工'
  if (cuttableStateKey === 'IN_MARKER_PLAN') return `当前可用领料余额已被唛架方案 ${line.markerPlanNo || ''} 锁定`.trim()
  if (cuttableStateKey === 'NOT_READY') return '这张单当前暂不可进入新的唛架方案'
  return '未关闭、已开工、有领料记录、有可用余额，且当前未被唛架方案锁定'
}

function deriveCutOrderVisibleStatus(
  cuttableStateKey: CuttableStateKey,
): CuttableSummaryMeta<CuttableVisibleStatusKey> {
  return createVisibleStatus(cuttableStateKey === 'CUTTABLE' ? 'CUTTABLE' : 'NOT_CUTTABLE')
}

export function summarizeProductionOrderCoverageStatus(items: CuttableCutOrderItem[]): CuttableSummaryMeta<CoverageStatusKey> {
  const total = items.length
  const cuttableCount = items.filter((item) => item.cuttableState.key === 'CUTTABLE').length

  if (total > 0 && cuttableCount === total) {
    return createCoverageStatus('FULL', `${cuttableCount}/${total} 个裁片单都可以直接安排裁床`)
  }

  if (cuttableCount > 0) {
    return createCoverageStatus('PARTIAL', `${cuttableCount}/${total} 个裁片单当前可以安排裁床`)
  }

  return createCoverageStatus('BLOCKED', `当前 ${total} 个裁片单都还不能安排裁床`)
}

function buildMarkerPlanBuckets(items: CuttableCutOrderItem[]): CuttableMarkerPlanBucket[] {
  const bucketMap = new Map<
    string,
    CuttableMarkerPlanBucket & {
      productionOrderSet: Set<string>
    }
  >()

  for (const item of items) {
    const existing = bucketMap.get(item.markerPlanGroupKey)
    if (existing) {
      existing.totalCount += 1
      if (item.cuttableState.key === 'CUTTABLE') existing.cuttableCount += 1
      existing.productionOrderSet.add(item.productionOrderId)
      existing.productionOrderCount = existing.productionOrderSet.size
      existing.materialSku = uniqueStrings([existing.materialSku, item.materialSku]).join(' / ')
      continue
    }

    bucketMap.set(item.markerPlanGroupKey, {
      markerPlanGroupKey: item.markerPlanGroupKey,
      materialSku: item.materialSku,
      cuttableCount: item.cuttableState.key === 'CUTTABLE' ? 1 : 0,
      totalCount: 1,
      productionOrderCount: 1,
      productionOrderSet: new Set([item.productionOrderId]),
    })
  }

  return Array.from(bucketMap.values())
    .map(({ productionOrderSet: _productionOrderSet, ...bucket }) => bucket)
    .sort((left, right) => right.cuttableCount - left.cuttableCount || left.materialSku.localeCompare(right.materialSku, 'zh-CN'))
}

function buildCutOrderItem(
  source: GeneratedCutOrderSourceRecord,
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  progressRow: ProductionProgressRow,
  options: {
    startState: CutOrderStartState
    markerPlanOccupancy: MarkerPlanOccupancyLookup[string] | null
  },
): CuttableCutOrderItem {
  const markerPlanGroupKey = buildMarkerPlanGroupKey({
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    materialSku: source.materialSku,
    patternKey: uniqueStrings(source.pieceRows.map((row) => row.patternId || row.patternName)).join('/'),
    effectiveWidth: resolveMarkerPlanEffectiveWidthByMaterialType(source.materialType),
    historicalGroupKey: line.markerPlanNo || source.markerPlanNo || '',
  })
  const materialBalance = buildCuttableMaterialBalance(line, source, options.markerPlanOccupancy)
  const cuttableState = deriveCutOrderCuttableState(line, record, options.startState, source, markerPlanGroupKey, options.markerPlanOccupancy)
  const markerPlanOccupancyStatus: CuttingMarkerPlanOccupancyStatus = options.markerPlanOccupancy
    ? 'IN_MARKER_PLAN'
    : 'AVAILABLE'
  const markerPlanNo = options.markerPlanOccupancy?.markerPlanNo || line.markerPlanNo || ''

  return {
    id: source.cutOrderId,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    styleName: record.styleName,
    orderQty: record.orderQty,
    plannedShipDate: record.plannedShipDate,
    plannedShipDateDisplay: record.plannedShipDate || '待补日期',
    urgencyKey: progressRow.urgency.key,
    urgencyLabel: progressRow.urgency.label,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    materialCategory: source.materialCategory || materialTypeLabel(source.materialType),
    materialAlias: source.materialAlias || line.materialAlias || '',
    materialImageUrl: source.materialImageUrl || line.materialImageUrl || '',
    materialPrepStatus: line.configStatus,
    materialClaimStatus: line.receiveStatus,
    configuredRollCount: line.configuredRollCount,
    configuredLength: line.configuredLength,
    receivedRollCount: line.receivedRollCount,
    receivedLength: line.receivedLength,
    lockedLength: materialBalance.lockedLength,
    consumedLength: materialBalance.consumedLength,
    availableLength: materialBalance.availableLength,
    currentStage: record.cuttingStage,
    visibleStatus: deriveCutOrderVisibleStatus(cuttableState.key),
    cuttableState,
    currentSituationText: cuttableState.key === 'IN_MARKER_PLAN' && markerPlanNo
      ? `当前余额已被唛架方案 ${markerPlanNo} 锁定`
      : cuttableState.reasonText || deriveCutOrderBlockingReason(line, record, cuttableState.key),
    markerPlanGroupKey,
    markerPlanOccupancyStatus,
    markerPlanNo,
    latestActionText: line.latestActionText,
    keywordIndex: buildKeywordIndex([
      source.productionOrderNo,
      source.productionOrderId,
      record.styleCode,
      record.spuCode,
      record.styleName,
      source.cutOrderNo,
      source.materialSku,
      source.materialLabel,
      source.materialAlias,
      source.materialType,
    ]),
  }
}

function sortOrders(left: CuttableProductionOrderSummary, right: CuttableProductionOrderSummary): number {
  return (
    right.urgency.sortWeight - left.urgency.sortWeight ||
    left.plannedShipDateDisplay.localeCompare(right.plannedShipDateDisplay, 'zh-CN') ||
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
  )
}

export function buildCuttablePoolViewModel(
  records: CuttingOrderProgressRecord[],
  options: {
    progressRows?: ProductionProgressRow[]
    markerPlanOccupancy?: MarkerPlanOccupancyLookup
  } = {},
): CuttablePoolViewModel {
  const progressRows = options.progressRows ?? buildProductionProgressRows(records)
  const startStateLookup = buildCutOrderStartStateLookup()
  const markerPlanOccupancyLookup = options.markerPlanOccupancy ?? {}
  const progressRowMap = new Map(progressRows.map((row) => [row.id, row]))
  const recordMap = new Map(records.map((record) => [record.productionOrderId, record] as const))
  const generatedRowsByOrder = new Map<string, GeneratedCutOrderSourceRecord[]>()
  const lineMap = new Map<string, CuttingMaterialLine>()
  listGeneratedCutOrderSourceRecords().forEach((row) => {
    const current = generatedRowsByOrder.get(row.productionOrderId) ?? []
    current.push(row)
    generatedRowsByOrder.set(row.productionOrderId, current)
  })
  records.forEach((record) => {
    record.materialLines.forEach((line) => {
      const key = line.cutOrderId || line.cutOrderNo || line.cutPieceOrderNo
      if (key) lineMap.set(key, line)
    })
  })
  const itemsById: Record<string, CuttableCutOrderItem> = {}

  const orders = progressRows
    .map((progressRow) => {
      const record = recordMap.get(progressRow.productionOrderId)
      if (!progressRow) return null
      if (!record) return null

      const items = (generatedRowsByOrder.get(record.productionOrderId) ?? [])
        .map((source) => {
          const line = lineMap.get(source.cutOrderId) || buildProgressLineFallback(source)
          return buildCutOrderItem(source, record, line, progressRow, {
            startState: resolveCutOrderStartState(startStateLookup, {
              cutOrderId: source.cutOrderId,
              cutOrderNo: source.cutOrderNo,
              cutPieceOrderNo: line.cutPieceOrderNo,
            }),
            markerPlanOccupancy: markerPlanOccupancyLookup[source.cutOrderId] || markerPlanOccupancyLookup[source.cutOrderNo] || null,
          })
        })
        .filter((item) => item.cuttableState.key === 'CUTTABLE')
      if (!items.length) return null
      for (const item of items) {
        itemsById[item.id] = item
      }

      return {
        id: record.id,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        styleCode: record.styleCode,
        spuCode: record.spuCode,
        styleName: record.styleName,
        factoryName: progressRow.assignedFactoryName,
        urgency: progressRow.urgency,
        orderQty: record.orderQty,
        plannedShipDate: record.plannedShipDate,
        plannedShipDateDisplay: progressRow.plannedShipDateDisplay,
        shipCountdownText: progressRow.shipCountdownText,
        cuttableCutOrderCount: items.length,
        totalCutOrderCount: items.length,
        coverageStatus: summarizeProductionOrderCoverageStatus(items),
        riskTags: progressRow.riskTags,
        items,
        filterPayloadForCutOrders: progressRow.filterPayloadForCutOrders,
        filterPayloadForMaterialPrep: progressRow.filterPayloadForMaterialPrep,
      }
    })
    .filter((order): order is CuttableProductionOrderSummary => order !== null)
    .sort(sortOrders)

  const groupMap = new Map<string, CuttableProductionOrderSummary[]>()
  for (const order of orders) {
    const groupKey = order.styleCode || order.spuCode || order.productionOrderNo
    const group = groupMap.get(groupKey)
    if (group) {
      group.push(order)
    } else {
      groupMap.set(groupKey, [order])
    }
  }

  const groups = Array.from(groupMap.entries())
    .map(([groupKey, groupOrders]) => {
      const seed = groupOrders[0]
      const items = groupOrders.flatMap((order) => order.items)
      const fullOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'FULL').length
      const partialOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'PARTIAL').length
      const blockedOrderCount = groupOrders.filter((order) => order.coverageStatus.key === 'BLOCKED').length

      return {
        styleCode: seed.styleCode || groupKey,
        spuCode: seed.spuCode,
        styleName: seed.styleName,
        orders: groupOrders.sort(sortOrders),
        totalOrderCount: groupOrders.length,
        totalCutOrderCount: items.length,
        cuttableCutOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
        fullOrderCount,
        partialOrderCount,
        blockedOrderCount,
        markerPlanBuckets: buildMarkerPlanBuckets(items),
      }
    })
    .sort((left, right) => {
      const leftMaxUrgency = Math.max(...left.orders.map((order) => order.urgency.sortWeight))
      const rightMaxUrgency = Math.max(...right.orders.map((order) => order.urgency.sortWeight))
      return rightMaxUrgency - leftMaxUrgency || left.styleCode.localeCompare(right.styleCode, 'zh-CN')
    })

  return {
    groups,
    orders,
    itemsById,
  }
}

function matchesKeyword(item: CuttableCutOrderItem, keyword: string): boolean {
  if (!keyword) return true
  return item.keywordIndex.some((value) => value.includes(keyword))
}

function matchesReceiveFilter(item: CuttableCutOrderItem, value: CuttablePoolFilters['receiveStatus']): boolean {
  if (value === 'ALL') return true
  if (value === 'EXCEPTION') return item.cuttableState.key === 'CLAIM_EXCEPTION'
  return item.materialClaimStatus === value
}

function hasItemScopedFilter(filters: CuttablePoolFilters): boolean {
  return !!filters.keyword.trim() || filters.cuttableState !== 'ALL' || filters.configStatus !== 'ALL' || filters.receiveStatus !== 'ALL' || filters.onlyCuttable
}

function matchesPrefilter(item: CuttableCutOrderItem, order: CuttableProductionOrderSummary, group: CuttableStyleGroup, prefilter: CuttablePoolPrefilter | null): boolean {
  if (!prefilter) return true
  if (prefilter.productionOrderId && order.productionOrderId !== prefilter.productionOrderId) return false
  if (prefilter.productionOrderNo && order.productionOrderNo !== prefilter.productionOrderNo) return false
  if (prefilter.styleCode && group.styleCode !== prefilter.styleCode) return false
  if (prefilter.spuCode && group.spuCode !== prefilter.spuCode) return false
  if (prefilter.urgencyLevel && order.urgency.key !== prefilter.urgencyLevel) return false
  if (prefilter.riskOnly && order.riskTags.length === 0) return false
  return true
}

export function filterCuttablePoolGroups(
  viewModel: CuttablePoolViewModel,
  filters: CuttablePoolFilters,
  _selectedIds: string[],
  prefilter: CuttablePoolPrefilter | null,
): CuttableStyleGroup[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return viewModel.groups
    .map((group) => {
      const orders = group.orders
        .map((order) => {
          if (filters.urgencyLevel !== 'ALL' && order.urgency.key !== filters.urgencyLevel) return null
          if (filters.coverageStatus !== 'ALL' && order.coverageStatus.key !== filters.coverageStatus) return null
          if (prefilter && !order.items.some((item) => matchesPrefilter(item, order, group, prefilter))) return null

          const visibleItems = order.items.filter((item) => {
            if (item.cuttableState.key !== 'CUTTABLE') return false
            if (!matchesPrefilter(item, order, group, prefilter)) return false
            if (!matchesKeyword(item, keyword)) return false
            if (filters.cuttableState !== 'ALL' && item.visibleStatus.key !== filters.cuttableState) return false
            if (filters.configStatus !== 'ALL' && item.materialPrepStatus !== filters.configStatus) return false
            if (!matchesReceiveFilter(item, filters.receiveStatus)) return false
            return true
          })

          if (!visibleItems.length) return null

          return {
            ...order,
            items: visibleItems,
            cuttableCutOrderCount: visibleItems.length,
            totalCutOrderCount: visibleItems.length,
            coverageStatus: summarizeProductionOrderCoverageStatus(visibleItems),
          }
        })
        .filter((order): order is CuttableProductionOrderSummary => order !== null)

      if (!orders.length) return null

      const visibleItems = orders.flatMap((order) => order.items)
      return {
        ...group,
        orders,
        totalOrderCount: orders.length,
        totalCutOrderCount: visibleItems.length,
        cuttableCutOrderCount: visibleItems.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
        fullOrderCount: orders.filter((order) => order.coverageStatus.key === 'FULL').length,
        partialOrderCount: orders.filter((order) => order.coverageStatus.key === 'PARTIAL').length,
        blockedOrderCount: orders.filter((order) => order.coverageStatus.key === 'BLOCKED').length,
        markerPlanBuckets: buildMarkerPlanBuckets(visibleItems),
      }
    })
    .filter((group): group is CuttableStyleGroup => group !== null)
}

export function buildCuttablePoolStats(groups: CuttableStyleGroup[], _selectedIds: string[]): CuttablePoolStats {
  const orders = groups.flatMap((group) => group.orders)
  const items = orders.flatMap((order) => order.items)
  const prepPendingCutOrderCount = items.filter((item) => item.cuttableState.key === 'WAITING_PREP' || item.cuttableState.key === 'PARTIAL_PREP').length
  const claimPendingCutOrderCount = items.filter((item) =>
    item.cuttableState.key === 'WAITING_CLAIM' || item.cuttableState.key === 'PARTIAL_CLAIM' || item.cuttableState.key === 'CLAIM_EXCEPTION',
  ).length

  return {
    productionOrderCount: orders.length,
    cutOrderCount: items.length,
    cuttableCutOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
    prepPendingCutOrderCount,
    claimPendingCutOrderCount,
  }
}

export function buildQuickMarkerPlanBuckets(items: CuttableCutOrderItem[]): QuickMarkerPlanBucket[] {
  const bucketMap = new Map<
    string,
    QuickMarkerPlanBucket & {
      productionOrderIdSet: Set<string>
      productionOrderNoSet: Set<string>
      itemIdSet: Set<string>
    }
  >()

  for (const item of items) {
    if (item.cuttableState.key !== 'CUTTABLE') continue
    if (item.markerPlanOccupancyStatus === 'IN_MARKER_PLAN') continue

    const urgency = urgencyMeta[item.urgencyKey]
    const existing = bucketMap.get(item.markerPlanGroupKey)
    if (existing) {
      existing.cuttableCount += 1
      existing.productionOrderIdSet.add(item.productionOrderId)
      existing.productionOrderNoSet.add(item.productionOrderNo)
      existing.itemIdSet.add(item.id)
      existing.productionOrderCount = existing.productionOrderIdSet.size
      existing.productionOrderIds = Array.from(existing.productionOrderIdSet)
      existing.productionOrderNos = Array.from(existing.productionOrderNoSet)
      existing.itemIds = Array.from(existing.itemIdSet)
      existing.materialSku = uniqueStrings([existing.materialSku, item.materialSku]).join(' / ')
      existing.materialLabel = uniqueStrings([existing.materialLabel, item.materialLabel]).join(' / ')
      existing.materialAlias = uniqueStrings([existing.materialAlias, item.materialAlias]).join(' / ')
      if (!existing.materialImageUrl && item.materialImageUrl) existing.materialImageUrl = item.materialImageUrl
      if (item.plannedShipDate && (!existing.earliestShipDate || item.plannedShipDate < existing.earliestShipDate)) {
        existing.earliestShipDate = item.plannedShipDate
        existing.earliestShipDateDisplay = item.plannedShipDateDisplay
      }
      if (urgency.sortWeight > existing.highestUrgencySortWeight) {
        existing.highestUrgencyKey = item.urgencyKey
        existing.highestUrgencyLabel = item.urgencyLabel
        existing.highestUrgencySortWeight = urgency.sortWeight
      }
      continue
    }

    bucketMap.set(item.markerPlanGroupKey, {
      markerPlanGroupKey: item.markerPlanGroupKey,
      styleCode: item.styleCode,
      spuCode: item.spuCode,
      styleName: item.styleName,
      materialSku: item.materialSku,
      materialLabel: item.materialLabel,
      materialAlias: item.materialAlias,
      materialImageUrl: item.materialImageUrl,
      productionOrderIds: [item.productionOrderId],
      productionOrderNos: [item.productionOrderNo],
      itemIds: [item.id],
      cuttableCount: 1,
      productionOrderCount: 1,
      earliestShipDate: item.plannedShipDate,
      earliestShipDateDisplay: item.plannedShipDateDisplay,
      highestUrgencyKey: item.urgencyKey,
      highestUrgencyLabel: item.urgencyLabel,
      highestUrgencySortWeight: urgency.sortWeight,
      productionOrderIdSet: new Set([item.productionOrderId]),
      productionOrderNoSet: new Set([item.productionOrderNo]),
      itemIdSet: new Set([item.id]),
    })
  }

  return Array.from(bucketMap.values())
    .map(({ productionOrderIdSet: _productionOrderIdSet, productionOrderNoSet: _productionOrderNoSet, itemIdSet: _itemIdSet, ...bucket }) => bucket)
    .sort((left, right) => {
      return (
        right.highestUrgencySortWeight - left.highestUrgencySortWeight ||
        left.earliestShipDate.localeCompare(right.earliestShipDate, 'zh-CN') ||
        right.cuttableCount - left.cuttableCount ||
        left.materialSku.localeCompare(right.materialSku, 'zh-CN')
      )
    })
}

export function areCutOrdersReadyForMarkerPlan(items: CuttableCutOrderItem[]): {
  ok: boolean
  markerPlanGroupKey: string | null
  reason?: string
} {
  if (!items.length) {
    return { ok: false, markerPlanGroupKey: null, reason: '请先选择至少 1 条可排唛架裁片单。' }
  }

  const nonCuttable = items.find((item) => item.cuttableState.key !== 'CUTTABLE')
  if (nonCuttable) {
    return {
      ok: false,
      markerPlanGroupKey: null,
      reason: `${nonCuttable.cutOrderNo} 当前状态为“${nonCuttable.cuttableState.label}”，不能进入唛架方案。`,
    }
  }

  const markerPlanGroupKeys = Array.from(new Set(items.map((item) => item.markerPlanGroupKey)))
  if (markerPlanGroupKeys.length !== 1) {
    return {
      ok: false,
      markerPlanGroupKey: null,
      reason: '当前选择仅支持同 SPU、同纸样文件、同有效幅宽、同历史组合组的裁片单进入同一唛架方案。',
    }
  }

  const styleKeys = Array.from(new Set(items.map((item) => item.styleCode || item.spuCode).filter(Boolean)))
  if (styleKeys.length !== 1) {
    return {
      ok: false,
      markerPlanGroupKey: null,
      reason: '当前选择只允许同 SPU 的裁片单进入同一唛架方案。',
    }
  }

  return {
    ok: true,
    markerPlanGroupKey: markerPlanGroupKeys[0],
  }
}
