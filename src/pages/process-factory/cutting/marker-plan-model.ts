import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-original-cut-orders.ts'
import { findStyleArchiveByCode } from '../../../data/pcs-style-archive-repository.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionContentById,
} from '../../../data/pcs-technical-data-version-repository.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MergeBatchItem, MergeBatchRecord } from './merge-batches-model.ts'
import type { OriginalCutOrderRow } from './original-orders-model.ts'
import type { ProductionProgressRow } from './production-progress-model.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel,
} from './marker-piece-explosion.ts'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  type MarkerSpreadingLedgerSummary,
} from './marker-spreading-model.ts'
import {
  DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
  MARKER_PLAN_STORAGE_KEY,
  MARKER_SIZE_CODES,
  type MarkerAllocationRow,
  type MarkerAllocationStatusKey,
  type MarkerFoldConfig,
  type MarkerImageRecord,
  type MarkerLayoutStatusKey,
  type MarkerMappingStatusKey,
  type MarkerPlan,
  type MarkerPlanAllocationLike,
  type MarkerPlanContextType,
  type MarkerPlanLike,
  type MarkerPlanModeKey,
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerPieceExplosionRow,
  type MarkerSchemeBed,
  type MarkerSchemeDemandRow,
  type MarkerSizeCode,
  type MarkerSizeRatioRow,
  buildMarkerAllocationDiffFormula,
  buildMarkerAllocationSumFormula,
  buildMarkerExplodedPieceQtyFormula,
  buildMarkerFinalUnitUsageFormula,
  buildMarkerPlanSystemUnitUsageFormula,
  buildMarkerPlannedSpreadLengthFormula,
  buildMarkerSkuExplodedPieceQtyFormula,
  buildMarkerTotalPiecesFormula,
  computeMarkerAllocationDiffBySize,
  computeMarkerAllocationSumBySize,
  computeMarkerExplodedPieceQty,
  computeMarkerFoldedEffectiveWidth,
  computeMarkerFoldWidthCheckPassed,
  computeMarkerLayoutLineSpreadLength,
  computeMarkerPlanFinalUnitUsage,
  computeMarkerPlanSystemUnitUsageFromBeds,
  computeMarkerPlanSystemUnitUsage,
  computeMarkerPlanTotalPieces,
  createEmptySizeRatioRows,
  deriveMarkerAllocationStatus,
  deriveMarkerImageStatus,
  deriveMarkerMappingStatus,
  deriveMarkerPlanDefaultTab,
  deriveMarkerPlanStatus,
  deriveMarkerReadyForSpreading,
  markerAllocationStatusMeta,
  markerImageStatusMeta,
  markerLayoutStatusMeta,
  markerMappingStatusMeta,
  markerPlanModeMeta,
  markerPlanStatusMeta,
  normalizeMarkerSizeCode,
} from './marker-plan-domain.ts'

const DEFAULT_MARKER_GARMENT_LENGTH_M = 0.42

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((Number(value) || 0) * factor) / factor
}

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + safeNumber(value), 0)
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatDate(value: string | undefined | null): string {
  return String(value || '').trim() || '—'
}

function formatNumber(value: number, digits = 3): string {
  return Number(value || 0).toFixed(digits)
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(Number(value || 0), 0))
}

function sanitizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function listReferencedOriginalCutOrderIdsFromSpreadingStorage(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): string[] {
  if (!storage) return []
  try {
    const store = deserializeMarkerSpreadingStorage(
      storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY),
    ) as MarkerSpreadingLedgerSummary
    return uniqueStrings(
      store.sessions.flatMap((session) => [
        ...(session.originalCutOrderIds || []),
        ...(session.completionLinkage?.linkedOriginalCutOrderIds || []),
      ]),
    )
  } catch {
    return []
  }
}

function listReferencedOriginalCutOrderIdsFromMarkerStore(
  store: MarkerSpreadingLedgerSummary | null | undefined,
): string[] {
  if (!store?.sessions?.length) return []
  return uniqueStrings(
    store.sessions.flatMap((session) => [
      ...(session.originalCutOrderIds || []),
      ...(session.completionLinkage?.linkedOriginalCutOrderIds || []),
    ]),
  )
}

function createMarkerNo(existingPlans: MarkerPlan[], now = new Date()): string {
  const dateKey = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`
  const sameDaySerials = existingPlans
    .map((plan) => plan.markerNo)
    .filter((markerNo) => markerNo.startsWith(`MKP-${dateKey}`) || markerNo.startsWith(`MJ-${dateKey}`))
    .map((markerNo) => Number.parseInt(markerNo.split('-').pop() || '0', 10))
    .filter((serial) => Number.isFinite(serial))
  const nextSerial = Math.max(0, ...sameDaySerials) + 1
  return `MKP-${dateKey}-${String(nextSerial).padStart(3, '0')}`
}

function buildContextKey(contextType: MarkerPlanContextType, contextId: string): string {
  return `${contextType}:${contextId}`
}

export interface MarkerPlanContextCandidate {
  id: string
  contextType: MarkerPlanContextType
  contextKey: string
  contextNo: string
  contextLabel: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  techPackSpu: string
  sourceFactoryName: string
  sourceShipDate: string
  sourceUrgencyLabel: string
  materialSkuSummary: string
  colorSummary: string
  techPackStatusLabel: string
  prepStatusLabel: string
  prepClaimSummaryText: string
  sourceOriginalRows: OriginalCutOrderRow[]
  sourceMaterialPrepRows: MaterialPrepRow[]
  sourceGeneratedRows: GeneratedOriginalCutOrderSourceRecord[]
  defaultSizeRatioRows: MarkerSizeRatioRow[]
}

export interface MarkerPlanBalanceSummaryRow {
  sizeCode: MarkerSizeCode
  ratioQty: number
  allocationQty: number
  diffQty: number
  status: 'matched' | 'over' | 'under'
  allocationFormula: string
  diffFormula: string
}

export interface MarkerPlanSkuSummaryRow {
  sourceCutOrderNo: string
  skuCode: string
  colorCode: string
  sizeCode: string
  garmentQty: number
  explodedPieceQty: number
  mappingStatus: string
  mappingStatusLabel: string
  explodedPieceFormula: string
}

export interface MarkerPlanExplosionSummary {
  techPackStatus: { label: string; className: string }
  skuStatus: { label: string; className: string }
  colorStatus: { label: string; className: string }
  pieceStatus: { label: string; className: string }
  issueCount: number
  skuTypeCount: number
  skuSummaryRows: MarkerPlanSkuSummaryRow[]
  issueRows: MarkerPieceExplosionRow[]
}

export interface MarkerPlanListStats {
  totalContextCount: number
  builtContextCount: number
  pendingContextCount: number
  pendingBalanceCount: number
  mappingIssueCount: number
  waitingLayoutCount: number
  readyForSpreadingCount: number
}

export interface MarkerPlanViewRow extends MarkerPlan {
  modeMeta: (typeof markerPlanModeMeta)[MarkerPlanModeKey]
  statusMeta: (typeof markerPlanStatusMeta)[MarkerPlanStatusKey]
  allocationStatusMeta: (typeof markerAllocationStatusMeta)[MarkerAllocationStatusKey]
  mappingStatusMeta: (typeof markerMappingStatusMeta)[MarkerMappingStatusKey]
  layoutStatusMeta: (typeof markerLayoutStatusMeta)[MarkerLayoutStatusKey]
  imageStatusMeta: (typeof markerImageStatusMeta)[MarkerPlan['imageStatus']]
  contextLabel: string
  contextNo: string
  productionOrderSummary: string
  materialColorSummary: string
  markerGarmentQty: number
  markerGarmentQtyText: string
  markerGarmentQtyFormula: string
  totalPiecesText: string
  totalPiecesFormula: string
  systemUnitUsageFormula: string
  finalUnitUsageFormula: string
  finalUnitUsageText: string
  netLengthText: string
  plannedSpreadLengthText: string
  plannedSpreadLengthFormula: string
  sourceOriginalOrderCountText: string
  sourceProductionOrderCountText: string
  referenceWarningText: string
  isReferencedBySpreading: boolean
  skuTypeCountText: string
  balanceRows: MarkerPlanBalanceSummaryRow[]
  explosionSummary: MarkerPlanExplosionSummary
}

export interface MarkerPlanViewModel {
  contexts: MarkerPlanContextCandidate[]
  pendingContexts: MarkerPlanContextCandidate[]
  plans: MarkerPlanViewRow[]
  plansById: Record<string, MarkerPlanViewRow>
  stats: MarkerPlanListStats
}

export interface MarkerPlanMockCoverageReport {
  totalContextCount: number
  pendingContextCount: number
  pendingOriginalContextCount: number
  pendingMergeBatchContextCount: number
  builtPlanCount: number
  referencedPlanCount: number
  mappingIssueCount: number
  missingImageCount: number
  modeCounts: Record<MarkerPlanModeKey, number>
  statusCounts: Record<MarkerPlanStatusKey, number>
}

export function serializeMarkerPlanStorage(records: MarkerPlan[]): string {
  return JSON['stringify'](records)
}

export function getMarkerPlanStorageKey(): string {
  return MARKER_PLAN_STORAGE_KEY
}

export function buildMarkerPlanContextTypeOptions(): Array<{ value: 'ALL' | MarkerPlanContextType; label: string }> {
  return [
    { value: 'ALL', label: '全部来源' },
    { value: 'original-cut-order', label: '原始裁片单' },
    { value: 'merge-batch', label: '合并裁剪批次' },
  ]
}

export function buildMarkerPlanModeOptions(): Array<{ value: MarkerPlanModeKey; label: string }> {
  return (['normal', 'high_low', 'fold_normal', 'fold_high_low'] as MarkerPlanModeKey[]).map((value) => ({
    value,
    label: markerPlanModeMeta[value].label,
  }))
}

export function buildMarkerPlanListTabOptions(): Array<{ key: 'ALL' | 'WAITING_BALANCE' | 'WAITING_LAYOUT' | 'WAITING_IMAGE' | 'READY_FOR_SPREADING' | 'EXCEPTIONS'; label: string }> {
  return [
    { key: 'ALL', label: '全部方案' },
    { key: 'WAITING_BALANCE', label: '待配平' },
    { key: 'WAITING_LAYOUT', label: '待排床次' },
    { key: 'WAITING_IMAGE', label: '待生成图片' },
    { key: 'READY_FOR_SPREADING', label: '可交接铺布' },
    { key: 'EXCEPTIONS', label: '异常待处理' },
  ]
}

export function buildMarkerPlanGoSpreadingPath(plan: Pick<MarkerPlan, 'id' | 'markerNo'>): string {
  const params = new URLSearchParams({
    markerId: plan.id,
    markerNo: plan.markerNo,
  })
  return `/fcs/craft/cutting/spreading-create?${params.toString()}`
}

export function deserializeMarkerPlanStorage(raw: string | null): MarkerPlan[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (record): record is MarkerPlan =>
        Boolean(record && typeof record === 'object' && typeof record.id === 'string' && typeof record.markerNo === 'string'),
    )
  } catch {
    return []
  }
}

function buildSizeRatioRowsFromSourceRecords(sourceRows: GeneratedOriginalCutOrderSourceRecord[]): MarkerSizeRatioRow[] {
  const qtyMap = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0])) as Record<MarkerSizeCode, number>
  sourceRows.forEach((row) => {
    row.skuScopeLines.forEach((line) => {
      const normalizedSize = normalizeMarkerSizeCode(line.size)
      if (!normalizedSize) return
      qtyMap[normalizedSize] += Math.max(safeNumber(line.plannedQty), 0)
    })
  })
  return MARKER_SIZE_CODES.map((sizeCode, index) => ({
    sizeCode,
    qty: qtyMap[sizeCode],
    sortOrder: index + 1,
  }))
}

function buildMaterialPrepRowMap(rows: MaterialPrepRow[]): Record<string, MaterialPrepRow> {
  return Object.fromEntries(rows.map((row) => [row.originalCutOrderId, row]))
}

function buildOriginalRowMap(rows: OriginalCutOrderRow[]): Record<string, OriginalCutOrderRow> {
  return Object.fromEntries(rows.map((row) => [row.originalCutOrderId, row]))
}

function buildProductionRowMap(rows: ProductionProgressRow[]): Record<string, ProductionProgressRow> {
  return Object.fromEntries(rows.map((row) => [row.productionOrderId, row]))
}

function buildGeneratedRowMap(): Record<string, GeneratedOriginalCutOrderSourceRecord> {
  return Object.fromEntries(listGeneratedOriginalCutOrderSourceRecords().map((row) => [row.originalCutOrderId, row]))
}

function uniqueByKey<T>(rows: T[], getKey: (row: T) => string): T[] {
  const seen = new Set<string>()
  const next: T[] = []
  rows.forEach((row) => {
    const key = getKey(row)
    if (!key || seen.has(key)) return
    seen.add(key)
    next.push(row)
  })
  return next
}

function splitContextSummary(values: string[]): string[] {
  return uniqueStrings(
    values.flatMap((value) =>
      String(value || '')
        .split('/')
        .map((item) => item.trim()),
    ),
  )
}

function getContextFactoryName(rows: ProductionProgressRow[]): string {
  const factories = uniqueStrings(rows.map((row) => row.assignedFactoryName))
  if (factories.length === 0) return '待补工厂'
  if (factories.length === 1) return factories[0]
  return `${factories[0]} 等 ${factories.length} 个工厂`
}

function getContextShipDate(rows: Array<{ plannedShipDateDisplay: string }>): string {
  const dates = uniqueStrings(rows.map((row) => row.plannedShipDateDisplay)).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  return dates[0] || ''
}

function getContextUrgencyLabel(rows: ProductionProgressRow[]): string {
  const sorted = [...rows].sort((left, right) => right.urgency.sortWeight - left.urgency.sortWeight)
  return sorted[0]?.urgency.label || '常规'
}

function getFormalTechPackSnapshotForOriginalRow(row: Pick<OriginalCutOrderRow, 'productionOrderId' | 'spuCode'>) {
  const style = findStyleArchiveByCode(row.spuCode)
  if (!style?.currentTechPackVersionId) return null
  const record = getCurrentTechPackVersionByStyleId(style.styleId)
  if (!record) return null
  if (record.technicalVersionId !== style.currentTechPackVersionId) return null
  if (record.versionStatus !== 'PUBLISHED') return null
  if (!record.publishedAt) return null
  const content = getTechnicalDataVersionContentById(record.technicalVersionId)
  if (!content) return null
  return {
    styleCode: style.styleCode,
    versionLabel: record.versionLabel,
  }
}

function buildFormalTechPackStatusLabel(
  snapshots: Array<NonNullable<ReturnType<typeof getFormalTechPackSnapshotForOriginalRow>>>,
): string {
  const versionLabels = uniqueStrings(snapshots.map((snapshot) => snapshot.versionLabel))
  if (!versionLabels.length) return '待补正式版'
  if (versionLabels.length === 1) return `正式版 ${versionLabels[0]}`
  return `正式版 ${versionLabels.join(' / ')}`
}

function buildContextPrepStatusLabel(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialPrepStatus'>>,
): string {
  const prepKeys = uniqueStrings(originalRows.map((row) => row.materialPrepStatus.key))
  if (!prepKeys.length) return 'WMS 待处理'
  if (prepKeys.length === 1) return originalRows[0]?.materialPrepStatus.label || 'WMS 待处理'
  if (prepKeys.includes('NOT_CONFIGURED')) return 'WMS 待处理'
  if (prepKeys.includes('PARTIAL')) return 'WMS处理中'
  return '已配置'
}

function buildContextClaimStatusLabel(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialClaimStatus'>>,
): string {
  const claimKeys = uniqueStrings(originalRows.map((row) => row.materialClaimStatus.key))
  if (!claimKeys.length) return '待来料'
  if (claimKeys.length === 1) return originalRows[0]?.materialClaimStatus.label || '待来料'
  if (claimKeys.includes('NOT_RECEIVED')) return '待来料'
  if (claimKeys.includes('PARTIAL')) return '部分来料'
  return 'WMS 来料不齐'
}

function buildContextPrepClaimSummaryText(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialPrepStatus' | 'materialClaimStatus'>>,
): string {
  const prepLabel = buildContextPrepStatusLabel(originalRows)
  const claimLabel = buildContextClaimStatusLabel(originalRows)
  return `WMS 来料：${prepLabel} / 入仓：${claimLabel}`
}

function buildOriginalContextCandidate(input: {
  row: OriginalCutOrderRow
  materialPrepRow: MaterialPrepRow | null
  productionRow: ProductionProgressRow | null
  sourceRecord: GeneratedOriginalCutOrderSourceRecord | null
}): MarkerPlanContextCandidate | null {
  const formalTechPackSnapshot = getFormalTechPackSnapshotForOriginalRow(input.row)
  if (!formalTechPackSnapshot) return null

  const sourceGeneratedRows = input.sourceRecord ? [input.sourceRecord] : []
  const defaultSizeRatioRows = sourceGeneratedRows.length
    ? buildSizeRatioRowsFromSourceRecords(sourceGeneratedRows)
    : createEmptySizeRatioRows()
  const sourceFactoryName = input.productionRow?.assignedFactoryName || '待补工厂'
  const sourceShipDate = input.productionRow?.plannedShipDateDisplay || input.row.plannedShipDate || ''
  const sourceUrgencyLabel = input.productionRow?.urgency.label || input.row.urgencyLabel || '常规'
  const colorSummary = uniqueStrings([
    ...(input.sourceRecord?.colorScope || []),
    input.row.color,
    input.materialPrepRow?.color,
  ]).join(' / ')
  const techPackStatusLabel = buildFormalTechPackStatusLabel([formalTechPackSnapshot])
  const prepStatusLabel = buildContextPrepStatusLabel([input.row])
  const prepClaimSummaryText = buildContextPrepClaimSummaryText([input.row])

  return {
    id: input.row.originalCutOrderId,
    contextType: 'original-cut-order',
    contextKey: buildContextKey('original-cut-order', input.row.originalCutOrderId),
    contextNo: input.row.originalCutOrderNo,
    contextLabel: '原始裁片单',
    originalCutOrderIds: [input.row.originalCutOrderId],
    originalCutOrderNos: [input.row.originalCutOrderNo],
    mergeBatchId: '',
    mergeBatchNo: '',
    productionOrderIds: [input.row.productionOrderId],
    productionOrderNos: [input.row.productionOrderNo],
    styleCode: input.row.styleCode,
    spuCode: input.row.spuCode,
    styleName: input.row.styleName,
    techPackSpu: formalTechPackSnapshot.styleCode,
    sourceFactoryName,
    sourceShipDate,
    sourceUrgencyLabel,
    materialSkuSummary: input.row.materialSku,
    colorSummary,
    techPackStatusLabel,
    prepStatusLabel,
    prepClaimSummaryText,
    sourceOriginalRows: [input.row],
    sourceMaterialPrepRows: input.materialPrepRow ? [input.materialPrepRow] : [],
    sourceGeneratedRows,
    defaultSizeRatioRows,
  }
}

function buildMergeBatchContextCandidate(input: {
  batch: MergeBatchRecord
  originalRowsById: Record<string, OriginalCutOrderRow>
  materialPrepRowsById: Record<string, MaterialPrepRow>
  productionRowsById: Record<string, ProductionProgressRow>
  generatedRowsById: Record<string, GeneratedOriginalCutOrderSourceRecord>
}): MarkerPlanContextCandidate | null {
  const sourceOriginalRows = input.batch.items
    .map((item) => input.originalRowsById[item.originalCutOrderId])
    .filter((row): row is OriginalCutOrderRow => Boolean(row))
  if (!sourceOriginalRows.length) return null

  const formalTechPackSnapshots = sourceOriginalRows
    .map((row) => getFormalTechPackSnapshotForOriginalRow(row))
    .filter((snapshot): snapshot is NonNullable<ReturnType<typeof getFormalTechPackSnapshotForOriginalRow>> => Boolean(snapshot))
  if (formalTechPackSnapshots.length !== sourceOriginalRows.length) return null

  const sourceMaterialPrepRows = sourceOriginalRows
    .map((row) => input.materialPrepRowsById[row.originalCutOrderId])
    .filter((row): row is MaterialPrepRow => Boolean(row))
  const productionRows = uniqueStrings(sourceOriginalRows.map((row) => row.productionOrderId))
    .map((id) => input.productionRowsById[id])
    .filter((row): row is ProductionProgressRow => Boolean(row))
  const sourceGeneratedRows = sourceOriginalRows
    .map((row) => input.generatedRowsById[row.originalCutOrderId])
    .filter((row): row is GeneratedOriginalCutOrderSourceRecord => Boolean(row))
  const defaultSizeRatioRows = sourceGeneratedRows.length
    ? buildSizeRatioRowsFromSourceRecords(sourceGeneratedRows)
    : createEmptySizeRatioRows()
  const techPackStatusLabel = buildFormalTechPackStatusLabel(formalTechPackSnapshots)
  const prepStatusLabel = buildContextPrepStatusLabel(sourceOriginalRows)
  const prepClaimSummaryText = buildContextPrepClaimSummaryText(sourceOriginalRows)

  return {
    id: input.batch.mergeBatchId,
    contextType: 'merge-batch',
    contextKey: buildContextKey('merge-batch', input.batch.mergeBatchId),
    contextNo: input.batch.mergeBatchNo,
    contextLabel: '合并裁剪批次',
    originalCutOrderIds: sourceOriginalRows.map((row) => row.originalCutOrderId),
    originalCutOrderNos: sourceOriginalRows.map((row) => row.originalCutOrderNo),
    mergeBatchId: input.batch.mergeBatchId,
    mergeBatchNo: input.batch.mergeBatchNo,
    productionOrderIds: uniqueStrings(sourceOriginalRows.map((row) => row.productionOrderId)),
    productionOrderNos: uniqueStrings(sourceOriginalRows.map((row) => row.productionOrderNo)),
    styleCode: input.batch.styleCode || sourceOriginalRows[0]?.styleCode || '',
    spuCode: input.batch.spuCode || sourceOriginalRows[0]?.spuCode || '',
    styleName: input.batch.styleName || sourceOriginalRows[0]?.styleName || '',
    techPackSpu: uniqueStrings(formalTechPackSnapshots.map((snapshot) => snapshot.styleCode))[0] || sourceOriginalRows[0]?.spuCode || '',
    sourceFactoryName: getContextFactoryName(productionRows),
    sourceShipDate: getContextShipDate(productionRows),
    sourceUrgencyLabel: getContextUrgencyLabel(productionRows),
    materialSkuSummary: input.batch.materialSkuSummary || uniqueStrings(sourceOriginalRows.map((row) => row.materialSku)).join(' / '),
    colorSummary: uniqueStrings([...sourceGeneratedRows.flatMap((row) => row.colorScope), ...sourceOriginalRows.map((row) => row.color)]).join(' / '),
    techPackStatusLabel,
    prepStatusLabel,
    prepClaimSummaryText,
    sourceOriginalRows,
    sourceMaterialPrepRows,
    sourceGeneratedRows,
    defaultSizeRatioRows,
  }
}

export function buildMarkerPlanContextCandidates(sources: CuttingSummaryBuildOptions): MarkerPlanContextCandidate[] {
  const materialPrepRowsById = buildMaterialPrepRowMap(sources.materialPrepRows)
  const originalRowsById = buildOriginalRowMap(sources.originalRows)
  const productionRowsById = buildProductionRowMap(sources.productionRows)
  const generatedRowsById = buildGeneratedRowMap()

  const originalContexts = sources.originalRows
    .map((row) =>
      buildOriginalContextCandidate({
        row,
        materialPrepRow: materialPrepRowsById[row.originalCutOrderId] || null,
        productionRow: productionRowsById[row.productionOrderId] || null,
        sourceRecord: generatedRowsById[row.originalCutOrderId] || null,
      }),
    )
    .filter((item): item is MarkerPlanContextCandidate => Boolean(item))

  const mergeBatchContexts = sources.mergeBatches
    .map((batch) =>
      buildMergeBatchContextCandidate({
        batch,
        originalRowsById,
        materialPrepRowsById,
        productionRowsById,
        generatedRowsById,
      }),
    )
    .filter((item): item is MarkerPlanContextCandidate => Boolean(item))

  return [...originalContexts, ...mergeBatchContexts].sort((left, right) =>
    `${left.styleCode}-${left.contextNo}`.localeCompare(`${right.styleCode}-${right.contextNo}`, 'zh-CN'),
  )
}

export function buildCombinedMarkerPlanContextCandidate(
  contexts: MarkerPlanContextCandidate[],
): MarkerPlanContextCandidate | null {
  const selectedContexts = uniqueByKey(contexts, (context) => context.contextKey)
  if (!selectedContexts.length) return null
  if (selectedContexts.length === 1) return selectedContexts[0]

  const sourceOriginalRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceOriginalRows),
    (row) => row.originalCutOrderId,
  )
  if (!sourceOriginalRows.length) return null

  const sourceMaterialPrepRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceMaterialPrepRows),
    (row) => row.originalCutOrderId,
  )
  const sourceGeneratedRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceGeneratedRows),
    (row) => row.originalCutOrderId,
  )
  const productionOrderIds = uniqueStrings(selectedContexts.flatMap((context) => context.productionOrderIds))
  const productionOrderNos = uniqueStrings(selectedContexts.flatMap((context) => context.productionOrderNos))
  const spuCodes = uniqueStrings(selectedContexts.map((context) => context.spuCode))
  const styleCodes = uniqueStrings(selectedContexts.map((context) => context.styleCode))
  const styleNames = uniqueStrings(selectedContexts.map((context) => context.styleName))
  const materialSkuSummary = splitContextSummary(selectedContexts.map((context) => context.materialSkuSummary)).join(' / ')
  const colorSummary = splitContextSummary(selectedContexts.map((context) => context.colorSummary)).join(' / ')
  const mergeBatchContexts = selectedContexts.filter((context) => context.contextType === 'merge-batch')
  const contextNos = selectedContexts.map((context) => context.contextNo).filter(Boolean)
  const techPackStatusLabels = uniqueStrings(selectedContexts.map((context) => context.techPackStatusLabel))
  const prepStatusLabels = uniqueStrings(selectedContexts.map((context) => context.prepStatusLabel))

  return {
    id: `combined-${selectedContexts.map((context) => context.id).join('-')}`,
    contextType: 'original-cut-order',
    contextKey: buildContextKey('original-cut-order', sourceOriginalRows[0]?.originalCutOrderId || selectedContexts[0].id),
    contextNo: contextNos.join(' / '),
    contextLabel: '组合来源',
    originalCutOrderIds: sourceOriginalRows.map((row) => row.originalCutOrderId),
    originalCutOrderNos: sourceOriginalRows.map((row) => row.originalCutOrderNo),
    mergeBatchId: mergeBatchContexts.length === 1 ? mergeBatchContexts[0].mergeBatchId : '',
    mergeBatchNo: uniqueStrings(mergeBatchContexts.map((context) => context.mergeBatchNo)).join(' / '),
    productionOrderIds,
    productionOrderNos,
    styleCode: styleCodes[0] || '',
    spuCode: spuCodes[0] || '',
    styleName: styleNames[0] || '',
    techPackSpu: uniqueStrings(selectedContexts.map((context) => context.techPackSpu))[0] || spuCodes[0] || '',
    sourceFactoryName: getContextFactoryName(
      selectedContexts.flatMap((context) =>
        context.productionOrderIds.map((productionOrderId) => ({
          productionOrderId,
          assignedFactoryName: context.sourceFactoryName,
          plannedShipDateDisplay: context.sourceShipDate,
          urgency: { label: context.sourceUrgencyLabel, sortWeight: 0 },
        } as ProductionProgressRow)),
      ),
    ),
    sourceShipDate: getContextShipDate(selectedContexts.map((context) => ({ plannedShipDateDisplay: context.sourceShipDate }))),
    sourceUrgencyLabel: uniqueStrings(selectedContexts.map((context) => context.sourceUrgencyLabel))[0] || '常规',
    materialSkuSummary,
    colorSummary,
    techPackStatusLabel: techPackStatusLabels.length === 1 ? techPackStatusLabels[0] : '需人工确认',
    prepStatusLabel: prepStatusLabels.length === 1 ? prepStatusLabels[0] : '多状态',
    prepClaimSummaryText: uniqueStrings(selectedContexts.map((context) => context.prepClaimSummaryText)).join(' / '),
    sourceOriginalRows,
    sourceMaterialPrepRows,
    sourceGeneratedRows,
    defaultSizeRatioRows: sourceGeneratedRows.length
      ? buildSizeRatioRowsFromSourceRecords(sourceGeneratedRows)
      : createEmptySizeRatioRows(),
  }
}

function buildMockImageSvg(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><rect width="640" height="320" rx="20" fill="#F8FAFC"/><rect x="28" y="28" width="584" height="264" rx="16" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="3" stroke-dasharray="10 8"/><text x="48" y="96" font-size="26" font-family="Arial" fill="#0F172A">${label}</text><text x="48" y="152" font-size="16" font-family="Arial" fill="#475569">按正式版技术包颜色尺码生成</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function createImageRecord(planId: string, index: number, markerNo: string, note = ''): MarkerImageRecord {
  const imageLabel = index === 1 ? '方案图' : '唛架明细图'
  return {
    id: `${planId}-image-${index}`,
    fileId: `${planId}-image-file-${index}`,
    fileName: `${markerNo}-${imageLabel}.svg`,
    previewUrl: buildMockImageSvg(`${markerNo} · ${imageLabel}`, index % 2 === 0 ? '#2563EB' : '#7C3AED'),
    isPrimary: index === 1,
    note,
    uploadedAt: nowText(),
    uploadedBy: '计划员-陈静',
  }
}
function buildDefaultFoldConfig(context: MarkerPlanContextCandidate): MarkerFoldConfig {
  const originalEffectiveWidth = context.materialSkuSummary.includes('LINING') ? 150 : 168
  const foldAllowance = 2
  const foldedEffectiveWidth = computeMarkerFoldedEffectiveWidth({
    originalEffectiveWidth,
    foldAllowance,
  })
  const maxLayoutWidth = roundTo(foldedEffectiveWidth - 4, 2)
  return {
    originalEffectiveWidth,
    foldAllowance,
    foldDirection: '对边折入',
    foldedEffectiveWidth,
    maxLayoutWidth,
    widthCheckPassed: computeMarkerFoldWidthCheckPassed({ foldedEffectiveWidth, maxLayoutWidth }),
  }
}
function buildAutoAllocationRows(context: MarkerPlanContextCandidate, sizeRatioRows: MarkerSizeRatioRow[]): MarkerAllocationRow[] {
  const remaining = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0])) as Record<MarkerSizeCode, number>
  sizeRatioRows.forEach((row) => {
    remaining[row.sizeCode] = Math.max(safeNumber(row.qty), 0)
  })

  const rows: MarkerAllocationRow[] = []
  context.sourceGeneratedRows.forEach((sourceRow) => {
    sourceRow.skuScopeLines.forEach((skuLine) => {
      const sizeCode = normalizeMarkerSizeCode(skuLine.size)
      if (!sizeCode) return
      if (remaining[sizeCode] <= 0) return
      const takeQty = Math.min(remaining[sizeCode], Math.max(safeNumber(skuLine.plannedQty), 0))
      if (takeQty <= 0) return
      remaining[sizeCode] -= takeQty
      rows.push({
        id: `${context.id}-${sourceRow.originalCutOrderId}-${sizeCode}-${rows.length + 1}`,
        sourceCutOrderId: sourceRow.originalCutOrderId,
        sourceProductionOrderId: sourceRow.productionOrderId,
        colorCode: skuLine.color || sourceRow.colorScope[0] || '',
        materialSku: sourceRow.materialSku,
        styleCode: context.styleCode,
        spuCode: context.spuCode,
        techPackSpu: sourceRow.sourceTechPackSpuCode || context.techPackSpu,
        sizeCode,
        garmentQty: takeQty,
        note: '',
        specialFlags: [],
      })
    })
  })
  return rows
}

function buildSchemeDemandRowsFromContext(context: MarkerPlanContextCandidate): MarkerSchemeDemandRow[] {
  return context.sourceGeneratedRows.flatMap((sourceRow) =>
    sourceRow.skuScopeLines.map((skuLine, index) => {
      const sizeCode = normalizeMarkerSizeCode(skuLine.size) || 'M'
      const qty = Math.max(safeNumber(skuLine.plannedQty), 0)
      return {
        rowId: `${sourceRow.originalCutOrderId}-${sourceRow.materialSku}-${skuLine.skuCode || index + 1}`,
        sourceOrderId: sourceRow.originalCutOrderId,
        sourceOrderNo: sourceRow.originalCutOrderNo,
        productionOrderNo: sourceRow.productionOrderNo,
        spuCode: context.spuCode,
        colorCode: skuLine.color,
        colorName: skuLine.color,
        sizeCode,
        sizeName: sizeCode,
        materialSku: sourceRow.materialSku,
        partName: sourceRow.pieceSummary || '裁片',
        demandQty: qty,
        plannedQty: 0,
        remainingQty: qty,
      }
    }),
  )
}

function buildSizeRatioRowsFromDemandRows(demandRows: MarkerSchemeDemandRow[]): MarkerSizeRatioRow[] {
  const qtyMap = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0])) as Record<MarkerSizeCode, number>
  demandRows.forEach((row) => {
    const sizeCode = normalizeMarkerSizeCode(row.sizeCode || row.sizeName)
    if (!sizeCode) return
    qtyMap[sizeCode] += Math.max(safeNumber(row.demandQty), 0)
  })
  return MARKER_SIZE_CODES.map((sizeCode, index) => ({
    sizeCode,
    qty: qtyMap[sizeCode],
    sortOrder: index + 1,
  }))
}

function buildCoverageRowsFromDemandRows(
  rows: MarkerSchemeDemandRow[],
  colorName: string,
): MarkerSchemeBed['coverageRows'] {
  return rows
    .filter((row) => (row.colorName || row.colorCode) === colorName)
    .map((row, index) => ({
      rowId: `${row.rowId}-coverage-${index + 1}`,
      colorCode: row.colorCode,
      colorName: row.colorName || row.colorCode,
      sizeCode: row.sizeCode,
      sizeName: row.sizeName || row.sizeCode,
      demandQty: row.demandQty,
      plannedQty: 0,
      remainingQty: row.demandQty,
    }))
}

function buildDefaultSchemeBeds(options: {
  planId: string
  markerNo: string
  markerMode: MarkerPlanModeKey
  context: MarkerPlanContextCandidate
  demandRows: MarkerSchemeDemandRow[]
  plannedLayerCount: number
  singleSpreadFixedLoss: number
  foldConfig: MarkerFoldConfig | null
}): MarkerSchemeBed[] {
  const colors = uniqueStrings(options.demandRows.map((row) => row.colorName || row.colorCode))
  const activeColors = colors.length ? colors.slice(0, 2) : []
  const prefix = options.markerMode === 'high_low' || options.markerMode === 'fold_high_low' ? 'B' : 'A'

  return activeColors.map((colorName, index) => {
    const coverageRows = buildCoverageRowsFromDemandRows(options.demandRows, colorName)
    const demandQty = sum(coverageRows.map((row) => row.demandQty))
    const markerPieceQtyPerLayer = Math.max(Math.ceil(demandQty / Math.max(options.plannedLayerCount, 1)), 1)
    const markerLength = roundTo(Math.max(markerPieceQtyPerLayer * DEFAULT_MARKER_GARMENT_LENGTH_M, 1), 2)
    const spreadTotalLength = computeMarkerLayoutLineSpreadLength(
      { markerLength, repeatCount: options.plannedLayerCount },
      options.singleSpreadFixedLoss,
    )
    const plannedGarmentQty = markerPieceQtyPerLayer * options.plannedLayerCount
    const unitFabricUsage = plannedGarmentQty > 0 ? roundTo(spreadTotalLength / plannedGarmentQty, 3) : 0
    return {
      bedId: `${options.planId}-bed-${index + 1}`,
      schemeId: options.planId,
      schemeNo: options.markerNo,
      bedNo: `${prefix}-${index + 1}`,
      bedName: `${prefix}-${index + 1}`,
      bedSortOrder: index + 1,
      bedMode: options.markerMode,
      colorCode: colorName,
      colorName,
      materialSku: options.context.materialSkuSummary.split(' / ')[0] || options.context.materialSkuSummary,
      sizeSummaryText: coverageRows.map((row) => row.sizeName || row.sizeCode).filter(Boolean).join(' / '),
      plannedLayerCount: options.plannedLayerCount,
      markerLength,
      markerPieceQtyPerLayer,
      plannedGarmentQty,
      spreadTotalLength,
      unitFabricUsage,
      normalLayoutRows: [],
      highLowMatrixRows: [],
      foldConfig: options.markerMode === 'fold_normal' || options.markerMode === 'fold_high_low' ? options.foldConfig : null,
      coverageRows,
      bedImage: null,
      spreadingSessionIds: [],
      assignedCuttingTableIds: [],
      status: '可铺布',
      readyForSpreading: true,
      lockedBySpreading: false,
      remark: '',
    }
  })
}

function adaptPlanToMarkerExplosionInput(plan: MarkerPlan): MarkerPlanLike {
  const allocationLines: MarkerPlanAllocationLike[] = plan.allocationRows.map((row) => ({
    allocationId: row.id,
    sourceCutOrderId: row.sourceCutOrderId,
    sourceCutOrderNo: row.sourceCutOrderId,
    sourceProductionOrderId: row.sourceProductionOrderId,
    sourceProductionOrderNo: row.sourceProductionOrderId,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpu,
    color: row.colorCode,
    materialSku: row.materialSku,
    sizeLabel: row.sizeCode,
    plannedGarmentQty: row.garmentQty,
    note: row.note,
  }))

  return {
    originalCutOrderIds: plan.originalCutOrderIds,
    techPackSpuCode: plan.techPackSpu,
    spuCode: plan.spuCode,
    sizeDistribution: plan.sizeRatioRows.map((row) => ({
      sizeLabel: row.sizeCode,
      quantity: row.qty,
    })),
    allocationLines,
  }
}

function buildPieceExplosionRows(plan: MarkerPlan, context: MarkerPlanContextCandidate): MarkerPieceExplosionRow[] {
  const rowsById = Object.fromEntries(context.sourceMaterialPrepRows.map((row) => [row.originalCutOrderId, row]))
  const markerExplosionInput = adaptPlanToMarkerExplosionInput(plan)
  const sourceRows = buildMarkerAllocationSourceRows(markerExplosionInput, rowsById)
  const explosion = buildMarkerPieceExplosionViewModel({ marker: markerExplosionInput, sourceRows })
  const sourceRowMap = Object.fromEntries(context.sourceGeneratedRows.map((row) => [row.originalCutOrderNo, row]))
  const previousOverrides = Object.fromEntries(
    (plan.pieceExplosionRows || [])
      .filter((row) => row.manualOverride)
      .map((row) => [row.id, row]),
  ) as Record<string, MarkerPieceExplosionRow>

  return explosion.pieceDetailRows.map((row) => {
    const sourceGeneratedRow = sourceRowMap[row.sourceCutOrderNo] || null
    const sourceCutOrderId = sourceGeneratedRow?.originalCutOrderId || row.sourceCutOrderNo
    const sourceCutOrderNo = sourceGeneratedRow?.originalCutOrderNo || row.sourceCutOrderNo
    const sourceProductionOrderId = sourceGeneratedRow?.productionOrderId || ''
    const sourceProductionOrderNo = sourceGeneratedRow?.productionOrderNo || ''
    const baseId = [
      plan.id,
      sourceCutOrderId,
      row.color,
      row.sizeLabel,
      row.skuCode,
      row.materialSku,
      row.pieceName,
    ]
      .filter(Boolean)
      .join('::')
    const previous = previousOverrides[baseId]
    const baseRow: MarkerPieceExplosionRow = {
      id: baseId,
      sourceCutOrderId,
      sourceCutOrderNo,
      sourceProductionOrderId,
      sourceProductionOrderNo,
      colorCode: row.color,
      sizeCode: row.sizeLabel,
      skuCode: row.skuCode,
      materialSku: row.materialSku,
      patternCode: row.patternName,
      partCode: row.pieceName,
      partNameCn: row.pieceName,
      partNameId: row.pieceName,
      piecePerGarment: row.pieceCountPerUnit,
      garmentQty: row.plannedGarmentQty,
      explodedPieceQty: computeMarkerExplodedPieceQty(row.pieceCountPerUnit, row.plannedGarmentQty),
      mappingStatus: row.mappingStatus,
      issueReason: row.mappingStatus === 'MATCHED' ? '' : row.mappingStatusLabel,
      manualOverride: false,
      overrideColorMode: 'follow-source',
      overrideColors: [],
      note: '',
    }

    if (!previous) return baseRow

    const piecePerGarment = Math.max(safeNumber(previous.piecePerGarment), 0)
    const garmentQty = Math.max(safeNumber(previous.garmentQty || baseRow.garmentQty), 0)
    return {
      ...baseRow,
      ...previous,
      piecePerGarment,
      garmentQty,
      explodedPieceQty: computeMarkerExplodedPieceQty(piecePerGarment, garmentQty),
      mappingStatus: 'MATCHED',
      issueReason: '',
      manualOverride: true,
    }
  })
}

function buildResolvedPieceExplosionOverrides(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
): MarkerPieceExplosionRow[] {
  return buildPieceExplosionRows(plan, context).map((row) => ({
    ...row,
    mappingStatus: 'MATCHED',
    issueReason: '',
    manualOverride: true,
    overrideColorMode: row.overrideColorMode || 'follow-source',
    overrideColors: row.overrideColors || [],
    note: row.note || '系统预置人工确认映射',
  }))
}

function hydrateFoldConfig(foldConfig: MarkerFoldConfig | null): MarkerFoldConfig | null {
  if (!foldConfig) return null
  const foldedEffectiveWidth = computeMarkerFoldedEffectiveWidth(foldConfig)
  return {
    ...foldConfig,
    foldedEffectiveWidth,
    widthCheckPassed: computeMarkerFoldWidthCheckPassed({
      foldedEffectiveWidth,
      maxLayoutWidth: foldConfig.maxLayoutWidth,
    }),
  }
}

export function hydrateMarkerPlan(plan: MarkerPlan, context: MarkerPlanContextCandidate): MarkerPlan {
  const schemeDemandRows = (plan.schemeDemandRows || []).map((row) => ({
    ...row,
    demandQty: Math.max(safeNumber(row.demandQty), 0),
    plannedQty: Math.max(safeNumber(row.plannedQty), 0),
    remainingQty: Math.max(safeNumber(row.remainingQty), 0),
  }))
  const fallbackSizeRatioRows = plan.sizeRatioRows.map((row, index) => ({
    ...row,
    sizeCode: normalizeMarkerSizeCode(row.sizeCode) || MARKER_SIZE_CODES[index] || 'M',
    qty: Math.max(safeNumber(row.qty), 0),
    sortOrder: index + 1,
  }))
  const sizeRatioRows = schemeDemandRows.length
    ? buildSizeRatioRowsFromDemandRows(schemeDemandRows)
    : fallbackSizeRatioRows
  const totalPieces = computeMarkerPlanTotalPieces(sizeRatioRows)
  const layoutLines: MarkerPlan['layoutLines'] = []
  const modeDetailLines: MarkerPlan['modeDetailLines'] = []
  const foldConfig = hydrateFoldConfig(plan.foldConfig)
  const rawNetLength = roundTo(safeNumber(plan.netLength), 2)
  const fallbackSystemUnitUsage = computeMarkerPlanSystemUnitUsage(rawNetLength, totalPieces)
  const fallbackFinalUnitUsage = computeMarkerPlanFinalUnitUsage(fallbackSystemUnitUsage, plan.manualUnitUsage)
  const allocationRows = plan.allocationRows.map((row) => ({
    ...row,
    sizeCode: normalizeMarkerSizeCode(row.sizeCode) || 'M',
    garmentQty: Math.max(safeNumber(row.garmentQty), 0),
    specialFlags: [...(row.specialFlags || [])],
  }))
  const pieceExplosionRows = buildPieceExplosionRows(
    {
      ...plan,
      sizeRatioRows,
      totalPieces,
      netLength: rawNetLength,
      systemUnitUsage: fallbackSystemUnitUsage,
      finalUnitUsage: fallbackFinalUnitUsage,
      allocationRows,
      layoutLines,
      modeDetailLines,
      foldConfig,
    },
    context,
  )
  const beds = (plan.beds || []).map((bed, index) => {
    const markerLength = roundTo(safeNumber(bed.markerLength), 2)
    const markerPieceQtyPerLayer = Math.max(Math.round(safeNumber(bed.markerPieceQtyPerLayer)), 0)
    const plannedLayerCount = Math.max(Math.round(safeNumber(bed.plannedLayerCount)), 0)
    const spreadTotalLength = computeMarkerLayoutLineSpreadLength(
      { markerLength, repeatCount: plannedLayerCount },
      plan.singleSpreadFixedLoss,
    )
    const plannedGarmentQty = markerPieceQtyPerLayer * plannedLayerCount
    const unitFabricUsage = plannedGarmentQty > 0 ? roundTo(spreadTotalLength / plannedGarmentQty, 3) : 0
    const readyForSpreading = markerLength > 0 && markerPieceQtyPerLayer > 0 && plannedLayerCount > 0 && bed.coverageRows.length > 0
    return {
      ...bed,
      schemeId: plan.schemeId || plan.id,
      schemeNo: plan.schemeNo || plan.markerNo,
      bedSortOrder: index + 1,
      bedName: bed.bedName || bed.bedNo,
      colorName: bed.colorName || bed.colorCode,
      materialSku: bed.materialSku || plan.sourceMaterialSku || plan.materialSkuSummary,
      sizeSummaryText: bed.coverageRows.map((row) => row.sizeName || row.sizeCode).filter(Boolean).join(' / '),
      plannedLayerCount,
      markerLength,
      markerPieceQtyPerLayer,
      plannedGarmentQty,
      spreadTotalLength,
      unitFabricUsage,
      foldConfig: bed.bedMode === 'fold_normal' || bed.bedMode === 'fold_high_low' ? foldConfig : null,
      readyForSpreading,
      status: readyForSpreading ? bed.status === '已完成' || bed.status === '已排程' || bed.status === '铺布中' || bed.status === '已锁定' ? bed.status : '可铺布' : '草稿',
    }
  })
  const netLength = roundTo(beds.length ? sum(beds.map((bed) => bed.markerLength)) : rawNetLength, 2)
  const systemUnitUsage = beds.length
    ? computeMarkerPlanSystemUnitUsageFromBeds(beds)
    : computeMarkerPlanSystemUnitUsage(netLength, totalPieces)
  const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, plan.manualUnitUsage)
  const plannedSpreadLength = sum(beds.map((bed) => bed.spreadTotalLength))
  const allocationStatus = deriveMarkerAllocationStatus(sizeRatioRows, allocationRows)
  const mappingStatus = deriveMarkerMappingStatus(pieceExplosionRows)
  const layoutStatus: MarkerLayoutStatusKey = beds.length > 0 && beds.every((bed) => bed.readyForSpreading) ? 'done' : 'pending'
  const imageStatus = plan.schemeImage || plan.detailImage || plan.imageRecords.length ? deriveMarkerImageStatus(1) : deriveMarkerImageStatus(0)
  const schemeImageStatus = imageStatus === 'done'
    ? plan.schemeImageStatus === '已过期'
      ? '已过期'
      : '已生成'
    : '待生成'
  const derivedReadyForSpreading = deriveMarkerReadyForSpreading({
    totalPieces,
    netLength,
    allocationStatus,
    mappingStatus,
    layoutStatus,
    imageStatus,
  })
  const derivedStatus = deriveMarkerPlanStatus({
    allocationStatus,
    mappingStatus,
    layoutStatus,
    imageStatus,
    readyForSpreading: derivedReadyForSpreading,
  })
  const status = plan.status === 'CANCELED' ? 'CANCELED' : derivedStatus
  const readyForSpreading = plan.status === 'CANCELED' ? false : derivedReadyForSpreading

  return {
    ...plan,
    totalPieces,
    netLength,
    systemUnitUsage,
    finalUnitUsage,
    plannedSpreadLength,
    schemeDemandRows,
    beds,
    sizeRatioRows,
    allocationRows,
    layoutLines,
    modeDetailLines,
    foldConfig,
    pieceExplosionRows,
    imageCount: plan.imageRecords.length,
    schemeImageStatus,
    allocationStatus,
    mappingStatus,
    layoutStatus,
    imageStatus,
    readyForSpreading,
    status,
    updatedAt: plan.updatedAt || plan.createdAt,
  }
}

function buildBalanceRows(plan: MarkerPlan): MarkerPlanBalanceSummaryRow[] {
  const allocationSum = computeMarkerAllocationSumBySize(plan.allocationRows)
  const diffMap = computeMarkerAllocationDiffBySize(plan.sizeRatioRows, plan.allocationRows)
  return MARKER_SIZE_CODES.map((sizeCode) => {
    const ratioQty = plan.sizeRatioRows.find((row) => row.sizeCode === sizeCode)?.qty || 0
    const diffQty = diffMap[sizeCode]
    return {
      sizeCode,
      ratioQty,
      allocationQty: allocationSum[sizeCode],
      diffQty,
      status: diffQty === 0 ? 'matched' : diffQty > 0 ? 'over' : 'under',
      allocationFormula: buildMarkerAllocationSumFormula(sizeCode, plan.allocationRows),
      diffFormula: buildMarkerAllocationDiffFormula(sizeCode, plan.sizeRatioRows, plan.allocationRows),
    }
  })
}

export function buildMarkerPlanBalanceRows(plan: MarkerPlan): MarkerPlanBalanceSummaryRow[] {
  return buildBalanceRows(plan)
}

function buildExplosionSummary(plan: MarkerPlan): MarkerPlanExplosionSummary {
  const issueRows = plan.pieceExplosionRows.filter((row) => row.mappingStatus !== 'MATCHED')
  const skuSummaryMap = new Map<string, MarkerPlanSkuSummaryRow>()
  const skuRowsMap = new Map<string, MarkerPieceExplosionRow[]>()
  plan.pieceExplosionRows.forEach((row) => {
    const key = `${row.skuCode}::${row.colorCode}::${row.sizeCode}`
    skuRowsMap.set(key, [...(skuRowsMap.get(key) || []), row])
    const existing = skuSummaryMap.get(key)
    if (existing) {
      existing.explodedPieceQty += row.explodedPieceQty
      existing.garmentQty = Math.max(existing.garmentQty, row.garmentQty)
      if (row.mappingStatus !== 'MATCHED') {
        existing.mappingStatus = row.mappingStatus
        existing.mappingStatusLabel = row.issueReason || '映射异常'
      }
      return
    }
    skuSummaryMap.set(key, {
      sourceCutOrderNo: row.sourceCutOrderNo || row.sourceCutOrderId,
      skuCode: row.skuCode,
      colorCode: row.colorCode,
      sizeCode: row.sizeCode,
      garmentQty: row.garmentQty,
      explodedPieceQty: row.explodedPieceQty,
      mappingStatus: row.mappingStatus,
      mappingStatusLabel: row.mappingStatus === 'MATCHED' ? '已匹配' : row.issueReason || '映射异常',
      explodedPieceFormula: '',
    })
  })
  skuSummaryMap.forEach((row, key) => {
    row.explodedPieceFormula = buildMarkerSkuExplodedPieceQtyFormula(skuRowsMap.get(key) || [])
  })
  const issueCount = issueRows.length
  return {
    techPackStatus: issueRows.some((row) => row.mappingStatus === 'MISSING_TECH_PACK')
      ? { label: '未通过', className: 'bg-rose-100 text-rose-700 border border-rose-200' }
      : { label: plan.pieceExplosionRows.length ? '已通过' : '待确认', className: plan.pieceExplosionRows.length ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200' },
    skuStatus: issueRows.some((row) => row.mappingStatus === 'MISSING_SKU')
      ? { label: '未通过', className: 'bg-rose-100 text-rose-700 border border-rose-200' }
      : { label: plan.pieceExplosionRows.length ? '已通过' : '待确认', className: plan.pieceExplosionRows.length ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200' },
    colorStatus: issueRows.some((row) => row.mappingStatus === 'MISSING_COLOR_MAPPING')
      ? { label: '未通过', className: 'bg-rose-100 text-rose-700 border border-rose-200' }
      : { label: plan.pieceExplosionRows.length ? '已通过' : '待确认', className: plan.pieceExplosionRows.length ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200' },
    pieceStatus: issueRows.some((row) => row.mappingStatus === 'MISSING_PIECE_MAPPING')
      ? { label: '未通过', className: 'bg-rose-100 text-rose-700 border border-rose-200' }
      : { label: plan.pieceExplosionRows.length ? '已通过' : '待确认', className: plan.pieceExplosionRows.length ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200' },
    issueCount,
    skuTypeCount: skuSummaryMap.size,
    skuSummaryRows: Array.from(skuSummaryMap.values()).sort((left, right) => `${left.colorCode}-${left.sizeCode}`.localeCompare(`${right.colorCode}-${right.sizeCode}`, 'zh-CN')),
    issueRows,
  }
}

function buildPlanViewRow(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
  referencedOriginalCutOrderIds: Set<string>,
): MarkerPlanViewRow {
  const hydrated = hydrateMarkerPlan(plan, context)
  const explosionSummary = buildExplosionSummary(hydrated)
  const sourceProductionOrderCount = uniqueStrings(hydrated.productionOrderIds).length
  const sourceOriginalOrderCount = uniqueStrings(hydrated.originalCutOrderIds).length
  const isReferencedBySpreading = hydrated.originalCutOrderIds.some((id) => referencedOriginalCutOrderIds.has(id))
  return {
    ...hydrated,
    modeMeta: markerPlanModeMeta[hydrated.markerMode],
    statusMeta: markerPlanStatusMeta[hydrated.status],
    allocationStatusMeta: markerAllocationStatusMeta[hydrated.allocationStatus],
    mappingStatusMeta: markerMappingStatusMeta[hydrated.mappingStatus],
    layoutStatusMeta: markerLayoutStatusMeta[hydrated.layoutStatus],
    imageStatusMeta: markerImageStatusMeta[hydrated.imageStatus],
    contextLabel: context.contextLabel,
    contextNo: context.contextNo,
    productionOrderSummary: hydrated.productionOrderNos.join(' / '),
    materialColorSummary: `${hydrated.materialSkuSummary} / ${hydrated.colorSummary}`,
    markerGarmentQty: hydrated.totalPieces,
    markerGarmentQtyText: formatQty(hydrated.totalPieces),
    markerGarmentQtyFormula: buildMarkerTotalPiecesFormula(hydrated.sizeRatioRows),
    totalPiecesText: formatQty(hydrated.totalPieces),
    totalPiecesFormula: buildMarkerTotalPiecesFormula(hydrated.sizeRatioRows),
    systemUnitUsageFormula: buildMarkerPlanSystemUnitUsageFormula(hydrated),
    finalUnitUsageFormula: buildMarkerFinalUnitUsageFormula(hydrated.systemUnitUsage, hydrated.manualUnitUsage),
    finalUnitUsageText: formatNumber(hydrated.finalUnitUsage, 3),
    netLengthText: `${formatNumber(hydrated.netLength, 2)} m`,
    plannedSpreadLengthText: `${formatNumber(hydrated.plannedSpreadLength, 2)} m`,
    plannedSpreadLengthFormula: buildMarkerPlannedSpreadLengthFormula(hydrated),
    sourceOriginalOrderCountText: `${sourceOriginalOrderCount} 张`,
    sourceProductionOrderCountText: `${sourceProductionOrderCount} 单`,
    referenceWarningText: isReferencedBySpreading
      ? '当前方案床次已被铺布引用。若修改配比、分配、床次结构，建议复制为新方案。'
      : '',
    isReferencedBySpreading,
    skuTypeCountText: `${explosionSummary.skuTypeCount}`,
    balanceRows: buildBalanceRows(hydrated),
    explosionSummary,
  }
}

function createPlanFromContext(options: {
  context: MarkerPlanContextCandidate
  existingPlans: MarkerPlan[]
  markerMode?: MarkerPlanModeKey
  now?: Date
}): MarkerPlan {
  const now = options.now || new Date()
  const markerNo = createMarkerNo(options.existingPlans, now)
  const sizeRatioRows = options.context.defaultSizeRatioRows.map((row) => ({ ...row }))
  const totalPieces = computeMarkerPlanTotalPieces(sizeRatioRows)
  const allocationRows = buildAutoAllocationRows(options.context, sizeRatioRows)
  const markerMode = options.markerMode || 'normal'
  const planId = `marker-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const foldConfig = markerMode === 'fold_normal' || markerMode === 'fold_high_low'
    ? buildDefaultFoldConfig(options.context)
    : null
  const schemeDemandRows = buildSchemeDemandRowsFromContext(options.context)
  const plannedLayerCount = Math.max(Math.ceil(totalPieces / 40), 1)
  const beds = buildDefaultSchemeBeds({
    planId,
    markerNo,
    markerMode,
    context: options.context,
    demandRows: schemeDemandRows,
    plannedLayerCount,
    singleSpreadFixedLoss: DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
    foldConfig,
  })
  const netLength = roundTo(
    beds.length ? sum(beds.map((bed) => bed.markerLength)) : Math.max(Math.ceil(totalPieces / plannedLayerCount) * DEFAULT_MARKER_GARMENT_LENGTH_M, 1),
    2,
  )

  const plan: MarkerPlan = {
    id: planId,
    markerNo,
    schemeId: planId,
    schemeNo: markerNo,
    schemeName: markerNo,
    techPackId: options.context.techPackSpu || options.context.spuCode,
    techPackVersion: options.context.techPackStatusLabel || '正式版',
    techPackStatus: '正式版',
    schemeDemandRows,
    beds,
    schemeImage: null,
    detailImage: null,
    schemeImageStatus: '待生成',
    schemeSpreadingStatus: '未排程',
    status: 'WAITING_IMAGE',
    markerMode,
    contextType: options.context.contextType,
    originalCutOrderIds: [...options.context.originalCutOrderIds],
    originalCutOrderNos: [...options.context.originalCutOrderNos],
    mergeBatchId: options.context.mergeBatchId,
    mergeBatchNo: options.context.mergeBatchNo,
    productionOrderIds: [...options.context.productionOrderIds],
    productionOrderNos: [...options.context.productionOrderNos],
    styleCode: options.context.styleCode,
    spuCode: options.context.spuCode,
    styleName: options.context.styleName,
    techPackSpu: options.context.techPackSpu,
    sourceFactoryName: options.context.sourceFactoryName,
    sourceShipDate: options.context.sourceShipDate,
    sourceUrgencyLabel: options.context.sourceUrgencyLabel,
    materialSkuSummary: options.context.materialSkuSummary,
    sourceMaterialSku: options.context.materialSkuSummary.split(' / ')[0] || '',
    colorSummary: options.context.colorSummary,
    totalPieces,
    netLength,
    systemUnitUsage: 0,
    manualUnitUsage: null,
    finalUnitUsage: 0,
    plannedSpreadLength: 0,
    plannedLayerCount,
    imageCount: 0,
    allocationStatus: 'pending',
    mappingStatus: 'pending',
    layoutStatus: 'pending',
    imageStatus: 'pending',
    readyForSpreading: false,
    remark: '',
    hasAdjustment: false,
    adjustmentNote: '',
    createdAt: nowText(now),
    createdBy: '计划员-陈静',
    updatedAt: nowText(now),
    updatedBy: '计划员-陈静',
    singleSpreadFixedLoss: DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
    sizeRatioRows,
    allocationRows,
    layoutLines: [],
    foldConfig,
    highLowMatrixCells: [],
    modeDetailLines: [],
    pieceExplosionRows: [],
    imageRecords: [],
    lastVisitedTab: 'basic',
  }
  return hydrateMarkerPlan(plan, options.context)
}

export function cloneMarkerPlanAsNewDraft(source: MarkerPlan, existingPlans: MarkerPlan[]): MarkerPlan {
  const now = new Date()
  const planId = `marker-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const markerNo = createMarkerNo(existingPlans, now)
  const clonedBeds = (source.beds || []).map((bed, index) => ({
    ...bed,
    bedId: `${planId}-bed-${index + 1}`,
    schemeId: planId,
    schemeNo: markerNo,
    bedSortOrder: index + 1,
    status: '草稿' as const,
    readyForSpreading: false,
    lockedBySpreading: false,
    spreadingSessionIds: [],
    assignedCuttingTableIds: [],
  }))
  return {
    ...source,
    id: planId,
    markerNo,
    schemeId: planId,
    schemeNo: markerNo,
    schemeName: markerNo,
    status: 'WAITING_LAYOUT',
    readyForSpreading: false,
    beds: clonedBeds,
    schemeImage: null,
    detailImage: null,
    schemeImageStatus: '待生成',
    schemeSpreadingStatus: '未排程',
    imageRecords: [],
    imageCount: 0,
    createdAt: nowText(now),
    updatedAt: nowText(now),
    createdBy: '计划员-陈静',
    updatedBy: '计划员-陈静',
    lastVisitedTab: 'layout',
  }
}

type SeedVariantKey = 'ready' | 'unbalanced' | 'mapping' | 'layout' | 'image' | 'manual'

function buildSeedVariants(contexts: MarkerPlanContextCandidate[]): Array<{ context: MarkerPlanContextCandidate; mode: MarkerPlanModeKey; variant: SeedVariantKey }> {
  const modes: MarkerPlanModeKey[] = ['normal', 'high_low', 'fold_normal', 'fold_high_low']
  const variants: SeedVariantKey[] = ['ready', 'layout', 'ready', 'image', 'ready', 'manual']
  const preferredContexts = [
    ...contexts.filter((context) => context.contextType === 'original-cut-order'),
    ...contexts.filter((context) => context.contextType === 'merge-batch'),
  ]
  const uniqueContexts = preferredContexts.filter(
    (context, index, all) => all.findIndex((item) => item.contextKey === context.contextKey) === index,
  )

  return uniqueContexts.slice(0, 8).map((context, index) => ({
    context,
    mode: modes[index % modes.length],
    variant: variants[index % variants.length],
  }))
}

function applySeedVariant(plan: MarkerPlan, variant: SeedVariantKey, context: MarkerPlanContextCandidate): MarkerPlan {
  let nextPlan: MarkerPlan = {
    ...plan,
    imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '系统预置方案图')],
    hasAdjustment: variant === 'mapping',
    adjustmentNote: variant === 'mapping' ? '当前样例用于演示技术包映射异常人工确认。' : '',
    remark: variant === 'ready' ? '当前方案可直接交接铺布。' : '当前为计划层样例方案。',
  }

  if (variant === 'unbalanced' && nextPlan.allocationRows[0]) {
    nextPlan = {
      ...nextPlan,
      imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '待配平方案图')],
      allocationRows: nextPlan.allocationRows.map((row, index) =>
        index === 0 ? { ...row, garmentQty: Math.max(row.garmentQty - 1, 0) } : row,
      ),
    }
  }

  if (variant === 'mapping' && nextPlan.allocationRows[0]) {
    nextPlan = {
      ...nextPlan,
      manualUnitUsage: roundTo(Math.max(nextPlan.systemUnitUsage - 0.032, 0.18), 3),
      allocationRows: nextPlan.allocationRows.map((row, index) =>
        index === 0
          ? {
              ...row,
              colorCode: index === 0 && context.colorSummary.split(' / ')[1] ? context.colorSummary.split(' / ')[1] : 'AB撞色',
              materialSku: `${row.materialSku}-AB`,
              specialFlags: ['人工确认', '撞色'],
            }
          : row,
      ),
    }
  }

  if (variant === 'layout') {
    nextPlan = {
      ...nextPlan,
      imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '待补床次样例图')],
      beds: nextPlan.beds?.map((bed, index) =>
        index === 0
          ? {
              ...bed,
              markerLength: 0,
              markerPieceQtyPerLayer: 0,
              readyForSpreading: false,
              status: '草稿',
            }
          : bed,
      ) || [],
      foldConfig:
        nextPlan.foldConfig && (nextPlan.markerMode === 'fold_normal' || nextPlan.markerMode === 'fold_high_low')
          ? {
              ...nextPlan.foldConfig,
              maxLayoutWidth: nextPlan.foldConfig.foldedEffectiveWidth + 8,
            }
          : nextPlan.foldConfig,
    }
  }

  if (variant === 'image') {
    nextPlan = {
      ...nextPlan,
      imageRecords: [],
    }
  }

  if (variant === 'manual') {
    nextPlan = {
      ...nextPlan,
      imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '人工修正用量样例图')],
      manualUnitUsage: roundTo(Math.max(nextPlan.systemUnitUsage + 0.028, 0.2), 3),
      remark: '当前样例用于演示人工修正单件成衣用量。',
    }
  }

  if (variant === 'ready') {
    nextPlan = {
      ...nextPlan,
      manualUnitUsage: plan.markerMode === 'high_low' || plan.markerMode === 'fold_high_low' ? roundTo(plan.systemUnitUsage + 0.015, 3) : plan.manualUnitUsage,
    }
  }

  if (variant !== 'mapping') {
    nextPlan = {
      ...nextPlan,
      pieceExplosionRows: buildResolvedPieceExplosionOverrides(nextPlan, context),
    }
  }

  return hydrateMarkerPlan(nextPlan, context)
}

function rekeySeedMarkerPlan(plan: MarkerPlan, stablePlanId: string): MarkerPlan {
  const markerNo = plan.markerNo
  return {
    ...plan,
    id: stablePlanId,
    schemeId: stablePlanId,
    schemeNo: markerNo,
    schemeName: markerNo,
    beds: (plan.beds || []).map((bed, index) => ({
      ...bed,
      bedId: `${stablePlanId}-bed-${index + 1}`,
      schemeId: stablePlanId,
      schemeNo: markerNo,
      bedSortOrder: index + 1,
      bedImage: bed.bedImage
        ? {
            ...bed.bedImage,
            imageId: `${stablePlanId}-bed-${index + 1}-image`,
            imageName: `${markerNo}-${bed.bedNo}-床次图.svg`,
          }
        : null,
    })),
    imageRecords: plan.imageRecords.map((record, index) => {
      const nextIndex = index + 1
      const imageLabel = nextIndex === 1 ? '方案图' : '唛架明细图'
      return {
        ...record,
        id: `${stablePlanId}-image-${nextIndex}`,
        fileId: `${stablePlanId}-image-file-${nextIndex}`,
        fileName: `${markerNo}-${imageLabel}.svg`,
      }
    }),
    schemeImage: plan.schemeImage
      ? {
          ...plan.schemeImage,
          imageId: `${stablePlanId}-scheme-image`,
          imageName: `${markerNo}-方案图.svg`,
        }
      : null,
    detailImage: plan.detailImage
      ? {
          ...plan.detailImage,
          imageId: `${stablePlanId}-detail-image`,
          imageName: `${markerNo}-唛架明细图.svg`,
        }
      : null,
  }
}

function buildSystemSeedMarkerPlans(contexts: MarkerPlanContextCandidate[]): MarkerPlan[] {
  const plans: MarkerPlan[] = []
  const seedClock = new Date('2026-04-03T09:00:00')
  buildSeedVariants(contexts).forEach((item, index) => {
    const baseDate = new Date(seedClock.getTime() + index * 60_000)
    const stablePlanId = `seed-marker-plan-${sanitizeKey(item.context.contextKey)}-${item.mode}-${item.variant}-${index + 1}`
    const basePlan = createPlanFromContext({
      context: item.context,
      existingPlans: plans,
      markerMode: item.mode,
      now: baseDate,
    })
    const seeded = applySeedVariant(
      {
        ...basePlan,
        id: stablePlanId,
        schemeId: stablePlanId,
        createdAt: nowText(baseDate),
        updatedAt: nowText(baseDate),
        createdBy: '系统预置',
        updatedBy: '系统预置',
      },
      item.variant,
      item.context,
    )
    plans.push(rekeySeedMarkerPlan(seeded, stablePlanId))
  })
  return plans
}

function mergePlans(seed: MarkerPlan[], stored: MarkerPlan[]): MarkerPlan[] {
  const merged = new Map<string, MarkerPlan>()
  seed.forEach((plan) => merged.set(plan.id, plan))
  stored.forEach((plan) => merged.set(plan.id, plan))
  return Array.from(merged.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildMarkerPlanViewModel(sources: CuttingSummaryBuildOptions, storedPlans: MarkerPlan[] = []): MarkerPlanViewModel {
  const contexts = buildMarkerPlanContextCandidates(sources)
  const seedPlans = buildSystemSeedMarkerPlans(contexts)
  const mergedPlans = mergePlans(seedPlans, storedPlans)
  const referencedOriginalCutOrderIds = new Set(
    uniqueStrings([
      ...listReferencedOriginalCutOrderIdsFromSpreadingStorage(),
      ...listReferencedOriginalCutOrderIdsFromMarkerStore(sources.markerStore),
    ]),
  )
  const plans = mergedPlans
    .map((plan) => {
      const context = findMarkerPlanContextForPlan(contexts, plan)
      return context ? buildPlanViewRow(plan, context, referencedOriginalCutOrderIds) : null
    })
    .filter((plan): plan is MarkerPlanViewRow => Boolean(plan))
  const plansById = Object.fromEntries(plans.map((plan) => [plan.id, plan]))
  const usedContextKeys = new Set(plans.flatMap((plan) => listUsedContextKeysForPlan(contexts, plan)))
  const pendingContexts = contexts.filter((context) => !usedContextKeys.has(context.contextKey))
  const builtContextCount = contexts.length - pendingContexts.length

  return {
    contexts,
    pendingContexts,
    plans,
    plansById,
    stats: {
      totalContextCount: contexts.length,
      builtContextCount,
      pendingContextCount: pendingContexts.length,
      pendingBalanceCount: plans.filter((plan) => plan.allocationStatus !== 'balanced').length,
      mappingIssueCount: plans.filter((plan) => plan.mappingStatus !== 'passed').length,
      waitingLayoutCount: plans.filter((plan) => plan.layoutStatus !== 'done').length,
      readyForSpreadingCount: plans.filter((plan) => plan.readyForSpreading).length,
    },
  }
}

export function buildMarkerPlanMockCoverageReport(
  sources: CuttingSummaryBuildOptions,
  storedPlans: MarkerPlan[] = [],
  options: {
    referencedOriginalCutOrderIds?: string[]
  } = {},
): MarkerPlanMockCoverageReport {
  const contexts = buildMarkerPlanContextCandidates(sources)
  const contextMap = Object.fromEntries(contexts.map((context) => [context.contextKey, context]))
  const seedPlans = buildSystemSeedMarkerPlans(contexts)
  const mergedPlans = mergePlans(seedPlans, storedPlans)
  const referencedOriginalCutOrderIds = new Set(
    uniqueStrings([
      ...(options.referencedOriginalCutOrderIds || []),
      ...listReferencedOriginalCutOrderIdsFromMarkerStore(sources.markerStore),
    ]),
  )
  const hydratedPlans = mergedPlans
    .map((plan) => {
      const contextId = plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0]
      const context = contextMap[buildContextKey(plan.contextType, contextId)]
      return context ? hydrateMarkerPlan(plan, context) : null
    })
    .filter((plan): plan is MarkerPlan => Boolean(plan))
  const usedContextKeys = new Set(
    hydratedPlans.map((plan) =>
      buildContextKey(plan.contextType, plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0]),
    ),
  )
  const pendingContexts = contexts.filter((context) => !usedContextKeys.has(context.contextKey))
  const modeCounts = Object.fromEntries(
    (Object.keys(markerPlanModeMeta) as MarkerPlanModeKey[]).map((key) => [key, 0]),
  ) as Record<MarkerPlanModeKey, number>
  const statusCounts = Object.fromEntries(
    (Object.keys(markerPlanStatusMeta) as MarkerPlanStatusKey[]).map((key) => [key, 0]),
  ) as Record<MarkerPlanStatusKey, number>

  hydratedPlans.forEach((plan) => {
    modeCounts[plan.markerMode] += 1
    statusCounts[plan.status] += 1
  })

  return {
    totalContextCount: contexts.length,
    pendingContextCount: pendingContexts.length,
    pendingOriginalContextCount: pendingContexts.filter((context) => context.contextType === 'original-cut-order').length,
    pendingMergeBatchContextCount: pendingContexts.filter((context) => context.contextType === 'merge-batch').length,
    builtPlanCount: hydratedPlans.length,
    referencedPlanCount: hydratedPlans.filter((plan) => plan.originalCutOrderIds.some((id) => referencedOriginalCutOrderIds.has(id))).length,
    mappingIssueCount: hydratedPlans.filter((plan) => plan.mappingStatus !== 'passed').length,
    missingImageCount: hydratedPlans.filter((plan) => plan.imageStatus !== 'done').length,
    modeCounts,
    statusCounts,
  }
}

export function buildMarkerPlanContextMap(
  contexts: MarkerPlanContextCandidate[],
): Record<string, MarkerPlanContextCandidate> {
  return Object.fromEntries(contexts.map((context) => [context.contextKey, context]))
}

export function buildMarkerPlanContextKey(
  contextType: MarkerPlanContextType,
  contextId: string,
): string {
  return buildContextKey(contextType, contextId)
}

export function findMarkerPlanContextById(
  contexts: MarkerPlanContextCandidate[],
  contextType: MarkerPlanContextType,
  contextId: string,
): MarkerPlanContextCandidate | null {
  const contextKey = buildContextKey(contextType, contextId)
  return contexts.find((context) => context.contextKey === contextKey) ?? null
}

export function findMarkerPlanContextForPlan(
  contexts: MarkerPlanContextCandidate[],
  plan: Pick<MarkerPlan, 'contextType' | 'mergeBatchId' | 'mergeBatchNo' | 'originalCutOrderIds'>,
): MarkerPlanContextCandidate | null {
  if (plan.contextType !== 'merge-batch' && (plan.originalCutOrderIds.length > 1 || plan.mergeBatchNo)) {
    const mergeBatchNos = new Set(String(plan.mergeBatchNo || '').split('/').map((item) => item.trim()).filter(Boolean))
    const mergeContexts = contexts.filter(
      (context) => context.contextType === 'merge-batch' && mergeBatchNos.has(context.mergeBatchNo),
    )
    const coveredByMerge = new Set(mergeContexts.flatMap((context) => context.originalCutOrderIds))
    const originalContexts = plan.originalCutOrderIds
      .filter((originalCutOrderId) => !coveredByMerge.has(originalCutOrderId))
        .map((originalCutOrderId) =>
          contexts.find(
            (context) =>
              context.contextType === 'original-cut-order' &&
              context.originalCutOrderIds.includes(originalCutOrderId),
          ) || null,
        )
        .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
    const sourceContexts = uniqueByKey(
      [...mergeContexts, ...originalContexts],
      (context) => context.contextKey,
    )
    const coveredOriginalIds = new Set(sourceContexts.flatMap((context) => context.originalCutOrderIds))
    if (plan.originalCutOrderIds.every((originalCutOrderId) => coveredOriginalIds.has(originalCutOrderId))) {
      return buildCombinedMarkerPlanContextCandidate(sourceContexts)
    }
  }
  const contextId = plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0]
  if (!contextId) return null
  return findMarkerPlanContextById(contexts, plan.contextType, contextId)
}

export function getMarkerPlanReferencedWarning(
  plan: Pick<MarkerPlanViewRow, 'isReferencedBySpreading' | 'referenceWarningText'>,
): string {
  return plan.isReferencedBySpreading ? plan.referenceWarningText : ''
}

function listUsedContextKeysForPlan(
  contexts: MarkerPlanContextCandidate[],
  plan: Pick<MarkerPlan, 'contextType' | 'mergeBatchId' | 'mergeBatchNo' | 'originalCutOrderIds'>,
): string[] {
  if (plan.contextType === 'merge-batch' && plan.mergeBatchId) {
    return [buildContextKey('merge-batch', plan.mergeBatchId)]
  }
  const originalIdSet = new Set(plan.originalCutOrderIds)
  const mergeBatchNos = new Set(String(plan.mergeBatchNo || '').split('/').map((item) => item.trim()).filter(Boolean))
  return contexts
    .filter((context) => {
      if (context.contextType === 'original-cut-order') {
        return context.originalCutOrderIds.some((originalCutOrderId) => originalIdSet.has(originalCutOrderId))
      }
      return mergeBatchNos.has(context.mergeBatchNo)
    })
    .map((context) => context.contextKey)
}

export function createMarkerPlanFromContext(options: {
  context: MarkerPlanContextCandidate
  existingPlans: MarkerPlan[]
  markerMode?: MarkerPlanModeKey
  now?: Date
}): MarkerPlan {
  return createPlanFromContext(options)
}

export function regenerateMarkerPlanAllocationRows(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
): MarkerPlan {
  return hydrateMarkerPlan(
    {
      ...plan,
      allocationRows: buildAutoAllocationRows(context, plan.sizeRatioRows),
      updatedAt: nowText(),
      updatedBy: '计划员-陈静',
    },
    context,
  )
}

export function createEmptyMarkerPlanAllocationRow(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
): MarkerAllocationRow {
  const defaultSourceRow = context.sourceOriginalRows[0] ?? null
  const defaultGeneratedRow = context.sourceGeneratedRows[0] ?? null
  return {
    id: `${plan.id}-allocation-${plan.allocationRows.length + 1}`,
    sourceCutOrderId: defaultSourceRow?.originalCutOrderId || '',
    sourceProductionOrderId: defaultSourceRow?.productionOrderId || '',
    colorCode: defaultGeneratedRow?.colorScope[0] || defaultSourceRow?.color || '',
    materialSku: defaultGeneratedRow?.materialSku || context.materialSkuSummary.split(' / ')[0] || '',
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    techPackSpu: context.techPackSpu,
    sizeCode: MARKER_SIZE_CODES.find((sizeCode) => plan.sizeRatioRows.some((row) => row.sizeCode === sizeCode && row.qty > 0)) || 'M',
    garmentQty: 0,
    note: '',
    specialFlags: [],
  }
}
export function createMarkerPlanImage(plan: MarkerPlan, action: 'upload' | 'replace-primary'): MarkerPlan {
  const nextImage = createImageRecord(plan.id, plan.imageRecords.length + 1, plan.markerNo, action === 'upload' ? '新上传示例图' : '替换主图')
  if (action === 'upload' || !plan.imageRecords.length) {
    return {
      ...plan,
      imageRecords: [...plan.imageRecords, { ...nextImage, isPrimary: plan.imageRecords.length === 0 }],
      updatedAt: nowText(),
      updatedBy: '计划员-陈静',
    }
  }
  return {
    ...plan,
    imageRecords: plan.imageRecords.map((record, index) =>
      index === 0
        ? { ...nextImage, isPrimary: true }
        : { ...record, isPrimary: false },
    ),
    updatedAt: nowText(),
    updatedBy: '计划员-陈静',
  }
}

export function setMarkerPlanPrimaryImage(plan: MarkerPlan, imageId: string): MarkerPlan {
  return {
    ...plan,
    imageRecords: plan.imageRecords.map((record) => ({ ...record, isPrimary: record.id === imageId })),
    updatedAt: nowText(),
    updatedBy: '计划员-陈静',
  }
}

export function deleteMarkerPlanImage(plan: MarkerPlan, imageId: string): MarkerPlan {
  const remaining = plan.imageRecords.filter((record) => record.id !== imageId)
  const primaryId = remaining.find((record) => record.isPrimary)?.id || remaining[0]?.id || ''
  return {
    ...plan,
    imageRecords: remaining.map((record) => ({ ...record, isPrimary: record.id === primaryId })),
    updatedAt: nowText(),
    updatedBy: '计划员-陈静',
  }
}

export function replaceMarkerPlanImage(plan: MarkerPlan, imageId: string): MarkerPlan {
  const replacement = createImageRecord(plan.id, plan.imageRecords.length + 1, plan.markerNo, '替换图片')
  return {
    ...plan,
    imageRecords: plan.imageRecords.map((record) =>
      record.id === imageId
        ? {
            ...replacement,
            id: imageId,
            isPrimary: record.isPrimary,
          }
        : record,
    ),
    updatedAt: nowText(),
    updatedBy: '计划员-陈静',
  }
}
export function getMarkerPlanInitialEditTab(plan: MarkerPlanViewRow): MarkerPlanTabKey {
  return deriveMarkerPlanDefaultTab(plan)
}
