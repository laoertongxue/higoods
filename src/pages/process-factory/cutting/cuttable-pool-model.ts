import type {
  CuttingMarkerPlanOccupancyStatus,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
} from '../../../data/fcs/cutting/types.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-cut-orders.ts'
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
import {
  deriveCuttableMarkerEligibility,
  type CuttableMarkerCurrentLock,
  type CuttableMarkerEligibility,
} from './cuttable-marker-eligibility.ts'

export type CuttableViewMode = 'STYLE_GROUP' | 'PRODUCTION_ORDER'
export type CuttableStateKey =
  | 'CUTTABLE'
  | 'NOT_ELIGIBLE'
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
  materialName: string
  materialColor: string
  materialCategory: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
  patternFileId: string
  patternFileName: string
  patternVersion: string
  effectiveWidthText: string
  materialIdentity: MaterialLedgerProjection['materialIdentity']
  patternIdentity: MaterialLedgerProjection['patternIdentity']
  ledgerSummary: MaterialLedgerProjection
  availableQty: number
  availableUnit: string
  eligibility: CuttableMarkerEligibility
  reasonTexts: string[]
  historyCombinationGroup: string
  currentLocks: CuttableMarkerCurrentLock[]
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
  productionOrderKeyword: string
  spuKeyword: string
  styleKeyword: string
  materialKeyword: string
  patternKeyword: string
  effectiveWidthKeyword: string
  historyCombinationGroupKeyword: string
  availableRange: 'ALL' | 'GT_0' | '0_300' | '300_600' | '600_PLUS'
  urgencyLevel: 'ALL' | ProductionProgressUrgencyKey
  cuttableState: 'ALL' | CuttableVisibleStatusKey
  coverageStatus: 'ALL' | CoverageStatusKey
  onlyCuttable: boolean
}

export interface CuttableSelectionContext {
  spuCode: string
  patternFileId: string
  patternFileName: string
  patternVersion: string
  effectiveWidthText: string
  historyCombinationGroup: string
  availableUnit: string
}

export interface CuttableSelectionSummary extends CuttableSelectionContext {
  selectedCount: number
  productionOrderCount: number
  productionOrderNos: string[]
  cutOrderNos: string[]
  totalAvailableQty: number
}

export interface CuttableSelectionValidationResult {
  ok: boolean
  reason?: string
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
}

export const cuttableStateMeta: Record<CuttableStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  NOT_ELIGIBLE: { label: '不可进入', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const cuttableVisibleStatusMeta: Record<CuttableVisibleStatusKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  NOT_CUTTABLE: { label: '不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

const historyCombinationGroupByCutOrderNo: Record<string, string> = {
  'CUT-260306-101-02': 'HCG-010-MAIN-A',
  'CUT-260306-101-05': 'HCG-010-MAIN-A',
  'CUT-260307-102-03': 'HCG-010-MAIN-A',
  'CUT-260306-101-06': 'HCG-010-MAIN-B',
}

const coverageMeta: Record<CoverageStatusKey, { label: string; className: string }> = {
  FULL: { label: '整单可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  PARTIAL: { label: '部分可排唛架', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  BLOCKED: { label: '整单不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
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

function resolveHistoryCombinationGroup(source: GeneratedCutOrderSourceRecord, line: CuttingMaterialLine): string {
  return historyCombinationGroupByCutOrderNo[source.cutOrderNo]
    || line.markerPlanNo
    || source.markerPlanNo
    || ''
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
  patternFileKey?: string
  effectiveWidth?: number | string
  historicalGroupKey?: string
}): string {
  return buildMarkerPlanCombinationGroupKey(source)
}

function formatLength(value: number, unit = '米'): string {
  return `${Math.round(Number(value || 0) * 10) / 10} ${unit}`
}

function buildCuttableMaterialBalance(projection: MaterialLedgerProjection): CuttableMaterialBalance {
  return {
    receivedLength: projection.cuttingClaimedQty,
    consumedLength: projection.spreadingConsumedQty,
    lockedLength: projection.markerLockedQty,
    availableLength: projection.availableQty,
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
  eligibility: CuttableMarkerEligibility,
  markerPlanGroupKey: string,
): CuttableSummaryMeta<CuttableStateKey> & { selectable: boolean; reasonText: string } {
  if (!eligibility.isEligible) {
    const reasonText = eligibility.reasonTexts.join('；') || '当前不满足可排唛架判断条件'
    return createCuttableState('NOT_ELIGIBLE', reasonText, reasonText)
  }

  if (!hasValidMarkerPlanGroupKey(markerPlanGroupKey)) {
    return createCuttableState('NOT_ELIGIBLE', '缺少 SPU 或纸样信息', '缺少同组排唛架所需的 SPU 或纸样信息')
  }

  return createCuttableState(
    'CUTTABLE',
    `可用余额 ${formatLength(eligibility.availableMaterialQty, eligibility.availableMaterialUnit)}`,
    '未关闭、已开工、有领料记录、有可用余额，且当前余额未被唛架方案全量锁定',
  )
}

function deriveCutOrderBlockingReason(
  cuttableStateKey: CuttableStateKey,
): string {
  if (cuttableStateKey === 'NOT_ELIGIBLE') return '当前不满足可排唛架判断条件'
  return '未关闭、已开工、有领料记录、有可用余额，且当前余额未被唛架方案全量锁定'
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
    return createCoverageStatus('FULL', `${cuttableCount}/${total} 个裁片单都可以进入唛架方案`)
  }

  if (cuttableCount > 0) {
    return createCoverageStatus('PARTIAL', `${cuttableCount}/${total} 个裁片单当前可以进入唛架方案`)
  }

  return createCoverageStatus('BLOCKED', `当前 ${total} 个裁片单都还不能进入唛架方案`)
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
    materialLedgerProjectionMap: Record<string, MaterialLedgerProjection>
    closeRecordLookup: Record<string, CutOrderCloseRecord>
  },
): CuttableCutOrderItem {
  const closeRecord = options.closeRecordLookup[source.cutOrderId] || options.closeRecordLookup[source.cutOrderNo] || null
  const effectiveRecord = applyCutOrderCloseRecordToProgressRecord(record, closeRecord)
  const historyCombinationGroup = resolveHistoryCombinationGroup(source, line)
  const markerPlanGroupKey = buildMarkerPlanGroupKey({
    styleCode: effectiveRecord.styleCode,
    spuCode: effectiveRecord.spuCode,
    patternFileKey: `${source.patternIdentity.patternFileId}:${source.patternIdentity.patternVersion}`,
    patternKey: uniqueStrings(source.pieceRows.map((row) => row.patternId || row.patternName)).join('/'),
    effectiveWidth: source.patternIdentity.effectiveWidthValue || resolveMarkerPlanEffectiveWidthByMaterialType(source.materialType),
    historicalGroupKey: historyCombinationGroup || 'NEW_GROUP',
  })
  const materialLedgerProjection = options.materialLedgerProjectionMap[source.cutOrderId] || options.materialLedgerProjectionMap[source.cutOrderNo]
  const materialBalance = buildCuttableMaterialBalance(materialLedgerProjection)
  const eligibility = deriveCuttableMarkerEligibility({
    cutOrderId: source.cutOrderId,
    productionOrderId: source.productionOrderId,
    line,
    record: effectiveRecord,
    startState: options.startState,
    materialLedgerProjection,
    markerPlanOccupancy: options.markerPlanOccupancy,
  })
  const cuttableState = deriveCutOrderCuttableState(eligibility, markerPlanGroupKey)
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
    styleCode: effectiveRecord.styleCode,
    spuCode: effectiveRecord.spuCode,
    styleName: effectiveRecord.styleName,
    orderQty: effectiveRecord.orderQty,
    plannedShipDate: effectiveRecord.plannedShipDate,
    plannedShipDateDisplay: effectiveRecord.plannedShipDate || '待补日期',
    urgencyKey: progressRow.urgency.key,
    urgencyLabel: progressRow.urgency.label,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    materialName: source.materialIdentity.materialName || source.materialName || source.materialLabel,
    materialColor: source.materialIdentity.materialColor || source.materialColor || line.color || '',
    materialCategory: source.materialCategory || materialTypeLabel(source.materialType),
    materialAlias: source.materialAlias || line.materialAlias || '',
    materialImageUrl: source.materialImageUrl || line.materialImageUrl || '',
    materialUnit: source.materialIdentity.materialUnit || source.materialUnit || '米',
    patternFileId: source.patternIdentity.patternFileId,
    patternFileName: source.patternIdentity.patternFileName,
    patternVersion: source.patternIdentity.patternVersion,
    effectiveWidthText: `${source.patternIdentity.effectiveWidthValue}${source.patternIdentity.effectiveWidthUnit}`,
    materialIdentity: { ...materialLedgerProjection.materialIdentity },
    patternIdentity: {
      ...materialLedgerProjection.patternIdentity,
      piecePartCodes: [...materialLedgerProjection.patternIdentity.piecePartCodes],
      piecePartNames: [...materialLedgerProjection.patternIdentity.piecePartNames],
    },
    ledgerSummary: materialLedgerProjection,
    availableQty: eligibility.availableMaterialQty,
    availableUnit: eligibility.availableMaterialUnit,
    eligibility,
    reasonTexts: [...eligibility.reasonTexts],
    historyCombinationGroup,
    currentLocks: eligibility.currentLocks.map((lock) => ({ ...lock })),
    configuredRollCount: line.configuredRollCount,
    configuredLength: line.configuredLength,
    receivedRollCount: line.receivedRollCount,
    receivedLength: line.receivedLength,
    lockedLength: materialBalance.lockedLength,
    consumedLength: materialBalance.consumedLength,
    availableLength: materialBalance.availableLength,
    currentStage: effectiveRecord.cuttingStage,
    visibleStatus: deriveCutOrderVisibleStatus(cuttableState.key),
    cuttableState,
    currentSituationText: cuttableState.reasonText || deriveCutOrderBlockingReason(cuttableState.key),
    markerPlanGroupKey,
    markerPlanOccupancyStatus,
    markerPlanNo,
    latestActionText: line.latestActionText,
    keywordIndex: buildKeywordIndex([
      source.productionOrderNo,
      source.productionOrderId,
      effectiveRecord.styleCode,
      effectiveRecord.spuCode,
      effectiveRecord.styleName,
      source.cutOrderNo,
      source.materialSku,
      source.materialLabel,
      source.materialAlias,
      source.patternIdentity.patternFileId,
      source.patternIdentity.patternFileName,
      source.patternIdentity.patternVersion,
      `${source.patternIdentity.effectiveWidthValue}${source.patternIdentity.effectiveWidthUnit}`,
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
  const materialLedgerProjectionMap = buildMaterialLedgerProjectionMap()
  const closeRecordLookup = buildCutOrderCloseRecordLookup()
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
          materialLedgerProjectionMap,
          closeRecordLookup,
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

function matchesField(values: string[], keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized) return true
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function matchesAvailableRange(item: CuttableCutOrderItem, range: CuttablePoolFilters['availableRange']): boolean {
  if (range === 'ALL') return true
  const availableQty = Number(item.availableQty || 0)
  if (range === 'GT_0') return availableQty > 0
  if (range === '0_300') return availableQty > 0 && availableQty < 300
  if (range === '300_600') return availableQty >= 300 && availableQty < 600
  if (range === '600_PLUS') return availableQty >= 600
  return true
}

function hasItemScopedFilter(filters: CuttablePoolFilters): boolean {
  return !!filters.keyword.trim()
    || !!filters.productionOrderKeyword.trim()
    || !!filters.spuKeyword.trim()
    || !!filters.styleKeyword.trim()
    || !!filters.materialKeyword.trim()
    || !!filters.patternKeyword.trim()
    || !!filters.effectiveWidthKeyword.trim()
    || !!filters.historyCombinationGroupKeyword.trim()
    || filters.availableRange !== 'ALL'
    || filters.cuttableState !== 'ALL'
    || filters.onlyCuttable
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
            if (!matchesField([item.productionOrderNo, item.productionOrderId], filters.productionOrderKeyword)) return false
            if (!matchesField([item.spuCode], filters.spuKeyword)) return false
            if (!matchesField([item.styleCode, item.styleName], filters.styleKeyword)) return false
            if (!matchesField([
              item.materialSku,
              item.materialName,
              item.materialColor,
              item.materialAlias,
              item.materialLabel,
            ], filters.materialKeyword)) return false
            if (!matchesField([
              item.patternFileId,
              item.patternFileName,
              item.patternVersion,
              item.patternIdentity.piecePartNames.join('/'),
              item.patternIdentity.piecePartCodes.join('/'),
            ], filters.patternKeyword)) return false
            if (!matchesField([item.effectiveWidthText], filters.effectiveWidthKeyword)) return false
            if (!matchesField([item.historyCombinationGroup || '新组合'], filters.historyCombinationGroupKeyword)) return false
            if (!matchesAvailableRange(item, filters.availableRange)) return false
            if (filters.cuttableState !== 'ALL' && item.visibleStatus.key !== filters.cuttableState) return false
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

  return {
    productionOrderCount: orders.length,
    cutOrderCount: items.length,
    cuttableCutOrderCount: items.filter((item) => item.cuttableState.key === 'CUTTABLE').length,
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

function getSelectionContext(item: CuttableCutOrderItem): CuttableSelectionContext {
  return {
    spuCode: item.spuCode || item.styleCode,
    patternFileId: item.patternFileId,
    patternFileName: item.patternFileName,
    patternVersion: item.patternVersion,
    effectiveWidthText: item.effectiveWidthText,
    historyCombinationGroup: item.historyCombinationGroup,
    availableUnit: item.availableUnit,
  }
}

export function buildCuttableSelectionSummary(items: CuttableCutOrderItem[]): CuttableSelectionSummary | null {
  if (!items.length) return null

  const context = getSelectionContext(items[0])
  return {
    ...context,
    selectedCount: items.length,
    productionOrderCount: new Set(items.map((item) => item.productionOrderId)).size,
    productionOrderNos: uniqueStrings(items.map((item) => item.productionOrderNo)),
    cutOrderNos: uniqueStrings(items.map((item) => item.cutOrderNo)),
    totalAvailableQty: Math.round(items.reduce((sum, item) => sum + Number(item.availableQty || 0), 0) * 10) / 10,
  }
}

function hasLockedBalance(item: CuttableCutOrderItem): boolean {
  return item.currentLocks.length > 0 && Number(item.availableQty || 0) <= 0
}

export function validateCuttableSelection(
  selectedItems: CuttableCutOrderItem[],
  nextItem: CuttableCutOrderItem,
): CuttableSelectionValidationResult {
  if (nextItem.cuttableState.key !== 'CUTTABLE' || !nextItem.eligibility.isEligible) {
    if (hasLockedBalance(nextItem)) return { ok: false, reason: '当前可用余额已被唛架方案锁定' }
    return { ok: false, reason: nextItem.reasonTexts[0] || nextItem.cuttableState.reasonText || '当前裁片单不能进入唛架方案' }
  }

  if (Number(nextItem.availableQty || 0) <= 0) {
    return { ok: false, reason: '可用余额不足，不能进入唛架方案' }
  }

  if (hasLockedBalance(nextItem)) {
    return { ok: false, reason: '当前可用余额已被唛架方案锁定' }
  }

  const seed = selectedItems[0]
  if (!seed) return { ok: true }

  const seedContext = getSelectionContext(seed)
  const nextContext = getSelectionContext(nextItem)

  if (seedContext.spuCode !== nextContext.spuCode) {
    return { ok: false, reason: 'SPU 不一致，不能进入同一个唛架方案' }
  }

  if (seedContext.patternFileId !== nextContext.patternFileId) {
    return { ok: false, reason: '纸样文件不一致，不能进入同一个唛架方案' }
  }

  if (seedContext.patternVersion !== nextContext.patternVersion) {
    return { ok: false, reason: '纸样版本不一致，不能进入同一个唛架方案' }
  }

  if (seedContext.effectiveWidthText !== nextContext.effectiveWidthText) {
    return { ok: false, reason: '有效幅宽不一致，不能进入同一个唛架方案' }
  }

  const seedHistoryGroup = seedContext.historyCombinationGroup.trim()
  const nextHistoryGroup = nextContext.historyCombinationGroup.trim()
  if (seedHistoryGroup !== nextHistoryGroup) {
    return { ok: false, reason: '历史组合组不一致，补排时必须沿用原组合' }
  }

  return { ok: true }
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
      reason: `${nonCuttable.cutOrderNo} 当前判断为“${nonCuttable.cuttableState.label}”，不能进入唛架方案。`,
    }
  }

  const accepted: CuttableCutOrderItem[] = [items[0]]
  for (const item of items.slice(1)) {
    const validation = validateCuttableSelection(accepted, item)
    if (!validation.ok) {
      return {
        ok: false,
        markerPlanGroupKey: null,
        reason: validation.reason,
      }
    }
    accepted.push(item)
  }

  return {
    ok: true,
    markerPlanGroupKey: items[0].markerPlanGroupKey,
  }
}
