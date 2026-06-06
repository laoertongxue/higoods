import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-cut-orders.ts'
import { findStyleArchiveByCode } from '../../../data/pcs-style-archive-repository.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionContentById,
} from '../../../data/pcs-technical-data-version-repository.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerPlanSourceItem, MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'
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
  buildBindingProcessOrders,
  buildBindingStripMaterialTotalUsageFormula,
  buildBindingStripReservedLengthFormula,
  summarizeBindingStripRequirementsForCutOrders,
} from './binding-strip-orders.ts'
import {
  DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
  MARKER_PLAN_STORAGE_KEY,
  MARKER_SIZE_CODES,
  type MarkerAllocationRow,
  type MarkerDemandMatchRow,
  type MarkerDemandMatchRowStatusKey,
  type MarkerDemandMatchStatusKey,
  type MarkerDemandMatchSummary,
  type MarkerFoldConfig,
  type MarkerLayoutStatusKey,
  type MarkerHighLowMatrixRow,
  type MarkerMappingStatusKey,
  type MarkerPlan,
  type MarkerPlanAllocationLike,
  type MarkerPlanContextType,
  type MarkerPlanLike,
  type MarkerPlanModeKey,
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerPlanConfirmationStatusKey,
  type MarkerPieceExplosionRow,
  type MarkerSchemeBed,
  type MarkerSchemeDemandRow,
  type MarkerSizeCode,
  type MarkerSizeRatioRow,
  buildMarkerAllocationDiffFormula,
  buildMarkerAllocationSumFormula,
  buildMarkerPlanCombinationGroupKey,
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

function listReferencedCutOrderIdsFromSpreadingStorage(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage,
): string[] {
  if (!storage) return []
  try {
    const store = deserializeMarkerSpreadingStorage(
      storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY),
    ) as MarkerSpreadingLedgerSummary
    return uniqueStrings(
      store.sessions.flatMap((session) => [
        ...(session.cutOrderIds || []),
        ...(session.completionLinkage?.linkedCutOrderIds || []),
      ]),
    )
  } catch {
    return []
  }
}

function listReferencedCutOrderIdsFromMarkerStore(
  store: MarkerSpreadingLedgerSummary | null | undefined,
): string[] {
  if (!store?.sessions?.length) return []
  return uniqueStrings(
    store.sessions.flatMap((session) => [
      ...(session.cutOrderIds || []),
      ...(session.completionLinkage?.linkedCutOrderIds || []),
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
  markerPlanGroupKey: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
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
  materialAliasSummary: string
  materialImageUrl: string
  colorSummary: string
  techPackStatusLabel: string
  prepStatusLabel: string
  prepClaimSummaryText: string
  sourceCutOrderRows: CutOrderRow[]
  sourceMaterialPrepRows: MaterialPrepRow[]
  sourceGeneratedRows: GeneratedCutOrderSourceRecord[]
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
  mappingIssueCount: number
  waitingLayoutCount: number
  readyForSpreadingCount: number
}

export interface MarkerPlanViewRow extends MarkerPlan {
  modeMeta: (typeof markerPlanModeMeta)[MarkerPlanModeKey]
  statusMeta: (typeof markerPlanStatusMeta)[MarkerPlanStatusKey]
  mappingStatusMeta: (typeof markerMappingStatusMeta)[MarkerMappingStatusKey]
  layoutStatusMeta: (typeof markerLayoutStatusMeta)[MarkerLayoutStatusKey]
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
  sourceCutOrderCountText: string
  sourceProductionOrderCountText: string
  referenceWarningText: string
  isReferencedBySpreading: boolean
  skuTypeCountText: string
  balanceRows: MarkerPlanBalanceSummaryRow[]
  explosionSummary: MarkerPlanExplosionSummary
  demandMatchSummary: MarkerDemandMatchSummary
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
  pendingCutOrderContextCount: number
  pendingMarkerPlanSourceContextCount: number
  builtPlanCount: number
  referencedPlanCount: number
  mappingIssueCount: number
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
    { value: 'ALL', label: '全部裁片单' },
    { value: 'cut-order', label: '裁片单' },
  ]
}

export function buildMarkerPlanModeOptions(): Array<{ value: MarkerPlanModeKey; label: string }> {
  return (['normal', 'high_low', 'fold_normal', 'fold_high_low'] as MarkerPlanModeKey[]).map((value) => ({
    value,
    label: markerPlanModeMeta[value].label,
  }))
}

export function buildMarkerPlanListTabOptions(): Array<{ key: 'ALL' | 'WAITING_LAYOUT' | 'DEMAND_DIFF' | 'WAITING_CONFIRM' | 'READY_FOR_SPREADING' | 'EXCEPTIONS'; label: string }> {
  return [
    { key: 'ALL', label: '全部方案' },
    { key: 'WAITING_LAYOUT', label: '待排唛架' },
    { key: 'DEMAND_DIFF', label: '有需求差异' },
    { key: 'WAITING_CONFIRM', label: '待业务确认' },
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

function buildSizeRatioRowsFromSourceRecords(sourceRows: GeneratedCutOrderSourceRecord[]): MarkerSizeRatioRow[] {
  const qtyMap = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0])) as Record<MarkerSizeCode, number>
  sourceRows.forEach((row) => {
    row.skuScopeLines.forEach((line) => {
      const normalizedSize = normalizeMarkerSizeCode(line.size)
      if (!normalizedSize) return
      qtyMap[normalizedSize] += Math.max(safeNumber(line.plannedQty), 0)
    })
  })
  return MARKER_SIZE_CODES.filter((sizeCode) => qtyMap[sizeCode] > 0).map((sizeCode, index) => ({
    sizeCode,
    qty: qtyMap[sizeCode],
    sortOrder: index + 1,
  }))
}

function buildMaterialPrepRowMap(rows: MaterialPrepRow[]): Record<string, MaterialPrepRow> {
  return Object.fromEntries(rows.map((row) => [row.cutOrderId, row]))
}

function buildCutOrderRowMap(rows: CutOrderRow[]): Record<string, CutOrderRow> {
  return Object.fromEntries(rows.map((row) => [row.cutOrderId, row]))
}

function buildProductionRowMap(rows: ProductionProgressRow[]): Record<string, ProductionProgressRow> {
  return Object.fromEntries(rows.map((row) => [row.productionOrderId, row]))
}

function buildGeneratedRowMap(): Record<string, GeneratedCutOrderSourceRecord> {
  return Object.fromEntries(listGeneratedCutOrderSourceRecords().map((row) => [row.cutOrderId, row]))
}

function resolveMarkerPlanEffectiveWidthByMaterialType(materialType: string): number {
  if (materialType === 'LINING') return 92
  return 120
}

function resolveMarkerPlanEffectiveWidthFromGeneratedRows(rows: GeneratedCutOrderSourceRecord[]): number | null {
  const widths = uniqueStrings(rows.map((row) => String(row.patternIdentity.effectiveWidthValue || resolveMarkerPlanEffectiveWidthByMaterialType(row.materialType))))
  if (widths.length !== 1) return null
  return Number(widths[0])
}

function buildMarkerPlanPatternKeyFromGeneratedRows(rows: GeneratedCutOrderSourceRecord[]): string {
  return uniqueStrings(
    rows.flatMap((row) =>
      [
        `${row.patternIdentity.patternFileId}:${row.patternIdentity.patternVersion}`,
        ...row.pieceRows.map((piece) => piece.patternId || piece.patternName),
      ],
    ),
  ).join('/')
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

function getFormalTechPackSnapshotForCutOrderRow(row: Pick<CutOrderRow, 'productionOrderId' | 'spuCode'>) {
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
  snapshots: Array<NonNullable<ReturnType<typeof getFormalTechPackSnapshotForCutOrderRow>>>,
): string {
  const versionLabels = uniqueStrings(snapshots.map((snapshot) => snapshot.versionLabel))
  if (!versionLabels.length) return '待补正式版'
  if (versionLabels.length === 1) return `正式版 ${versionLabels[0]}`
  return `正式版 ${versionLabels.join(' / ')}`
}

function buildContextPrepStatusLabel(
  cutOrderRows: Array<Pick<CutOrderRow, 'materialPrepStatus'>>,
): string {
  const prepKeys = uniqueStrings(cutOrderRows.map((row) => row.materialPrepStatus.key))
  if (!prepKeys.length) return '无配料数量'
  if (prepKeys.length === 1) return cutOrderRows[0]?.materialPrepStatus.label || '无配料数量'
  if (prepKeys.includes('NOT_CONFIGURED')) return '无配料数量'
  if (prepKeys.includes('PARTIAL')) return '配料数量不足'
  return '有配料数量'
}

function buildContextClaimStatusLabel(
  cutOrderRows: Array<Pick<CutOrderRow, 'materialClaimStatus'>>,
): string {
  const claimKeys = uniqueStrings(cutOrderRows.map((row) => row.materialClaimStatus.key))
  if (!claimKeys.length) return '无领料记录'
  if (claimKeys.length === 1) return cutOrderRows[0]?.materialClaimStatus.label || '无领料记录'
  if (claimKeys.includes('NOT_RECEIVED')) return '无领料记录'
  if (claimKeys.includes('PARTIAL')) return '领料数量不足'
  return '有领料记录'
}

function buildContextPrepClaimSummaryText(
  cutOrderRows: Array<Pick<CutOrderRow, 'materialPrepStatus' | 'materialClaimStatus'>>,
): string {
  const prepLabel = buildContextPrepStatusLabel(cutOrderRows)
  const claimLabel = buildContextClaimStatusLabel(cutOrderRows)
  return `配料：${prepLabel} / 领料：${claimLabel}`
}

function buildCutOrderContextCandidate(input: {
  row: CutOrderRow
  materialPrepRow: MaterialPrepRow | null
  productionRow: ProductionProgressRow | null
  sourceRecord: GeneratedCutOrderSourceRecord | null
}): MarkerPlanContextCandidate | null {
  const formalTechPackSnapshot = getFormalTechPackSnapshotForCutOrderRow(input.row)
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
  const markerPlanGroupKey = buildMarkerPlanCombinationGroupKey({
    styleCode: input.row.styleCode,
    spuCode: input.row.spuCode,
    materialSku: input.row.materialSku,
    patternFileKey: input.sourceRecord
      ? `${input.sourceRecord.patternIdentity.patternFileId}:${input.sourceRecord.patternIdentity.patternVersion}`
      : '',
    patternKey: buildMarkerPlanPatternKeyFromGeneratedRows(sourceGeneratedRows),
    effectiveWidth: input.sourceRecord
      ? input.sourceRecord.patternIdentity.effectiveWidthValue || resolveMarkerPlanEffectiveWidthByMaterialType(input.sourceRecord.materialType)
      : null,
    historicalGroupKey: input.row.latestMarkerPlanNo || input.sourceRecord?.markerPlanNo || '',
  })

  return {
    id: input.row.cutOrderId,
    contextType: 'cut-order',
    contextKey: buildContextKey('cut-order', input.row.cutOrderId),
    contextNo: input.row.cutOrderNo,
    contextLabel: '裁片单',
    markerPlanGroupKey,
    cutOrderIds: [input.row.cutOrderId],
    cutOrderNos: [input.row.cutOrderNo],
    markerPlanId: '',
    markerPlanNo: '',
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
    materialAliasSummary: input.row.materialAlias,
    materialImageUrl: input.row.materialImageUrl,
    colorSummary,
    techPackStatusLabel,
    prepStatusLabel,
    prepClaimSummaryText,
    sourceCutOrderRows: [input.row],
    sourceMaterialPrepRows: input.materialPrepRow ? [input.materialPrepRow] : [],
    sourceGeneratedRows,
    defaultSizeRatioRows,
  }
}

function buildMarkerPlanSourceContextCandidate(input: {
  batch: MarkerPlanSourceRecord
  cutOrderRowsById: Record<string, CutOrderRow>
  materialPrepRowsById: Record<string, MaterialPrepRow>
  productionRowsById: Record<string, ProductionProgressRow>
  generatedRowsById: Record<string, GeneratedCutOrderSourceRecord>
}): MarkerPlanContextCandidate | null {
  const sourceCutOrderRows = input.batch.items
    .map((item) => input.cutOrderRowsById[item.cutOrderId])
    .filter((row): row is CutOrderRow => Boolean(row))
  if (!sourceCutOrderRows.length) return null

  const formalTechPackSnapshots = sourceCutOrderRows
    .map((row) => getFormalTechPackSnapshotForCutOrderRow(row))
    .filter((snapshot): snapshot is NonNullable<ReturnType<typeof getFormalTechPackSnapshotForCutOrderRow>> => Boolean(snapshot))
  if (formalTechPackSnapshots.length !== sourceCutOrderRows.length) return null

  const sourceMaterialPrepRows = sourceCutOrderRows
    .map((row) => input.materialPrepRowsById[row.cutOrderId])
    .filter((row): row is MaterialPrepRow => Boolean(row))
  const productionRows = uniqueStrings(sourceCutOrderRows.map((row) => row.productionOrderId))
    .map((id) => input.productionRowsById[id])
    .filter((row): row is ProductionProgressRow => Boolean(row))
  const sourceGeneratedRows = sourceCutOrderRows
    .map((row) => input.generatedRowsById[row.cutOrderId])
    .filter((row): row is GeneratedCutOrderSourceRecord => Boolean(row))
  const defaultSizeRatioRows = sourceGeneratedRows.length
    ? buildSizeRatioRowsFromSourceRecords(sourceGeneratedRows)
    : createEmptySizeRatioRows()
  const techPackStatusLabel = buildFormalTechPackStatusLabel(formalTechPackSnapshots)
  const prepStatusLabel = buildContextPrepStatusLabel(sourceCutOrderRows)
  const prepClaimSummaryText = buildContextPrepClaimSummaryText(sourceCutOrderRows)
  const markerPlanGroupKey = input.batch.markerPlanGroupKey || buildMarkerPlanCombinationGroupKey({
    styleCode: input.batch.styleCode || sourceCutOrderRows[0]?.styleCode || '',
    spuCode: input.batch.spuCode || sourceCutOrderRows[0]?.spuCode || '',
    materialSku: input.batch.materialSkuSummary || sourceCutOrderRows[0]?.materialSku || '',
    patternKey: buildMarkerPlanPatternKeyFromGeneratedRows(sourceGeneratedRows),
    effectiveWidth: resolveMarkerPlanEffectiveWidthFromGeneratedRows(sourceGeneratedRows),
    historicalGroupKey: input.batch.markerPlanNo,
  })

  return {
    id: input.batch.markerPlanId,
    contextType: 'marker-plan',
    contextKey: buildContextKey('marker-plan', input.batch.markerPlanId),
    contextNo: input.batch.markerPlanNo,
    contextLabel: '唛架方案',
    markerPlanGroupKey,
    cutOrderIds: sourceCutOrderRows.map((row) => row.cutOrderId),
    cutOrderNos: sourceCutOrderRows.map((row) => row.cutOrderNo),
    markerPlanId: input.batch.markerPlanId,
    markerPlanNo: input.batch.markerPlanNo,
    productionOrderIds: uniqueStrings(sourceCutOrderRows.map((row) => row.productionOrderId)),
    productionOrderNos: uniqueStrings(sourceCutOrderRows.map((row) => row.productionOrderNo)),
    styleCode: input.batch.styleCode || sourceCutOrderRows[0]?.styleCode || '',
    spuCode: input.batch.spuCode || sourceCutOrderRows[0]?.spuCode || '',
    styleName: input.batch.styleName || sourceCutOrderRows[0]?.styleName || '',
    techPackSpu: uniqueStrings(formalTechPackSnapshots.map((snapshot) => snapshot.styleCode))[0] || sourceCutOrderRows[0]?.spuCode || '',
    sourceFactoryName: getContextFactoryName(productionRows),
    sourceShipDate: getContextShipDate(productionRows),
    sourceUrgencyLabel: getContextUrgencyLabel(productionRows),
    materialSkuSummary: input.batch.materialSkuSummary || uniqueStrings(sourceCutOrderRows.map((row) => row.materialSku)).join(' / '),
    materialAliasSummary: uniqueStrings(sourceCutOrderRows.map((row) => row.materialAlias)).join(' / '),
    materialImageUrl: sourceCutOrderRows.find((row) => row.materialImageUrl)?.materialImageUrl || '',
    colorSummary: uniqueStrings([...sourceGeneratedRows.flatMap((row) => row.colorScope), ...sourceCutOrderRows.map((row) => row.color)]).join(' / '),
    techPackStatusLabel,
    prepStatusLabel,
    prepClaimSummaryText,
    sourceCutOrderRows,
    sourceMaterialPrepRows,
    sourceGeneratedRows,
    defaultSizeRatioRows,
  }
}

export function buildMarkerPlanContextCandidates(sources: CuttingSummaryBuildOptions): MarkerPlanContextCandidate[] {
  const materialPrepRowsById = buildMaterialPrepRowMap(sources.materialPrepRows)
  const cutOrderRowsById = buildCutOrderRowMap(sources.cutOrderRows)
  const productionRowsById = buildProductionRowMap(sources.productionRows)
  const generatedRowsById = buildGeneratedRowMap()

  const cutOrderContexts = sources.cutOrderRows
    .map((row) =>
      buildCutOrderContextCandidate({
        row,
        materialPrepRow: materialPrepRowsById[row.cutOrderId] || null,
        productionRow: productionRowsById[row.productionOrderId] || null,
        sourceRecord: generatedRowsById[row.cutOrderId] || null,
      }),
    )
    .filter((item): item is MarkerPlanContextCandidate => Boolean(item))

  return cutOrderContexts.sort((left, right) =>
    `${left.styleCode}-${left.contextNo}`.localeCompare(`${right.styleCode}-${right.contextNo}`, 'zh-CN'),
  )
}

export function buildCombinedMarkerPlanContextCandidate(
  contexts: MarkerPlanContextCandidate[],
): MarkerPlanContextCandidate | null {
  const selectedContexts = uniqueByKey(contexts, (context) => context.contextKey)
  if (!selectedContexts.length) return null
  if (selectedContexts.length === 1) return selectedContexts[0]
  const markerPlanGroupKeys = uniqueStrings(selectedContexts.map((context) => context.markerPlanGroupKey))

  const sourceCutOrderRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceCutOrderRows),
    (row) => row.cutOrderId,
  )
  if (!sourceCutOrderRows.length) return null

  const sourceMaterialPrepRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceMaterialPrepRows),
    (row) => row.cutOrderId,
  )
  const sourceGeneratedRows = uniqueByKey(
    selectedContexts.flatMap((context) => context.sourceGeneratedRows),
    (row) => row.cutOrderId,
  )
  const productionOrderIds = uniqueStrings(selectedContexts.flatMap((context) => context.productionOrderIds))
  const productionOrderNos = uniqueStrings(selectedContexts.flatMap((context) => context.productionOrderNos))
  const spuCodes = uniqueStrings(selectedContexts.map((context) => context.spuCode))
  const styleCodes = uniqueStrings(selectedContexts.map((context) => context.styleCode))
  const styleNames = uniqueStrings(selectedContexts.map((context) => context.styleName))
  const materialSkuSummary = splitContextSummary(selectedContexts.map((context) => context.materialSkuSummary)).join(' / ')
  const materialAliasSummary = splitContextSummary(selectedContexts.map((context) => context.materialAliasSummary)).join(' / ')
  const materialImageUrl = selectedContexts.find((context) => context.materialImageUrl)?.materialImageUrl || ''
  const colorSummary = splitContextSummary(selectedContexts.map((context) => context.colorSummary)).join(' / ')
  const markerPlanSourceContexts = selectedContexts.filter((context) => context.contextType === 'marker-plan')
  const contextNos = selectedContexts.map((context) => context.contextNo).filter(Boolean)
  const techPackStatusLabels = uniqueStrings(selectedContexts.map((context) => context.techPackStatusLabel))
  const prepStatusLabels = uniqueStrings(selectedContexts.map((context) => context.prepStatusLabel))

  return {
    id: `combined-${selectedContexts.map((context) => context.id).join('-')}`,
    contextType: 'cut-order',
    contextKey: buildContextKey('cut-order', sourceCutOrderRows[0]?.cutOrderId || selectedContexts[0].id),
    contextNo: contextNos.join(' / '),
    contextLabel: '组合来源',
    markerPlanGroupKey: markerPlanGroupKeys[0] || 'NEW_GROUP',
    cutOrderIds: sourceCutOrderRows.map((row) => row.cutOrderId),
    cutOrderNos: sourceCutOrderRows.map((row) => row.cutOrderNo),
    markerPlanId: markerPlanSourceContexts.length === 1 ? markerPlanSourceContexts[0].markerPlanId : '',
    markerPlanNo: uniqueStrings(markerPlanSourceContexts.map((context) => context.markerPlanNo)).join(' / '),
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
    materialAliasSummary,
    materialImageUrl,
    colorSummary,
    techPackStatusLabel: techPackStatusLabels.length === 1 ? techPackStatusLabels[0] : '需人工确认',
    prepStatusLabel: prepStatusLabels.length === 1 ? prepStatusLabels[0] : '多状态',
    prepClaimSummaryText: uniqueStrings(selectedContexts.map((context) => context.prepClaimSummaryText)).join(' / '),
    sourceCutOrderRows,
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
        id: `${context.id}-${sourceRow.cutOrderId}-${sizeCode}-${rows.length + 1}`,
        sourceCutOrderId: sourceRow.cutOrderId,
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
        rowId: `${sourceRow.cutOrderId}-${sourceRow.materialSku}-${skuLine.skuCode || index + 1}`,
        sourceOrderId: sourceRow.cutOrderId,
        sourceOrderNo: sourceRow.cutOrderNo,
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
  const activeColors = colors.length ? colors : ['主色']
  const sizeNames = uniqueStrings(options.demandRows.map((row) => row.sizeName || row.sizeCode)).filter(Boolean)
  const prefix = options.markerMode === 'high_low' || options.markerMode === 'fold_high_low' ? 'B' : 'A'
  const matrixRows: MarkerHighLowMatrixRow[] = activeColors.map((colorName, index) => {
    const sizeValues = Object.fromEntries(
      sizeNames.map((sizeName) => [sizeName, 0]),
    ) as Record<string, number>
    return {
      rowId: `${options.planId}-marker-row-${index + 1}`,
      stepNo: index + 1,
      stepLabel: buildHighLowStepLabel(index + 1),
      colorCode: colorName,
      colorName,
      markerLength: 0,
      sizeValues,
      patternValues: {},
      totalQty: 0,
    }
  })
  const coverageRows = options.demandRows.map((row, index) => ({
    rowId: `${row.rowId}-coverage-${index + 1}`,
    colorCode: row.colorCode,
    colorName: row.colorName || row.colorCode,
    sizeCode: row.sizeCode,
    sizeName: row.sizeName || row.sizeCode,
    demandQty: row.demandQty,
    plannedQty: 0,
    remainingQty: row.demandQty,
  }))
  const markerLength = 0
  const plannedLayerCount = 0
  const plannedGarmentQty = 0
  const spreadTotalLength = markerLength > 0
    ? computeMarkerLayoutLineSpreadLength({ markerLength, repeatCount: plannedLayerCount }, options.singleSpreadFixedLoss)
    : 0
  const unitFabricUsage = plannedGarmentQty > 0 ? roundTo(spreadTotalLength / plannedGarmentQty, 3) : 0

  return [
    {
      bedId: `${options.planId}-bed-1`,
      schemeId: options.planId,
      schemeNo: options.markerNo,
      bedNo: `${prefix}-1`,
      bedName: `${prefix}-1`,
      bedSortOrder: 1,
      bedMode: options.markerMode,
      colorCode: activeColors.join(' / '),
      colorName: activeColors.join(' / '),
      materialSku: options.context.materialSkuSummary.split(' / ')[0] || options.context.materialSkuSummary,
      sizeSummaryText: sizeNames.join(' / '),
      sizePiecePerLayer: Object.fromEntries(sizeNames.map((sizeName) => [sizeName, 0])) as Record<string, number>,
      plannedLayerCount,
      markerLength,
      markerPieceQtyPerLayer: plannedLayerCount > 0 ? Math.max(Math.ceil(plannedGarmentQty / plannedLayerCount), 1) : 0,
      plannedGarmentQty,
      spreadTotalLength,
      unitFabricUsage,
      normalLayoutRows: [],
      highLowMatrixRows: matrixRows,
      foldConfig: options.markerMode === 'fold_normal' || options.markerMode === 'fold_high_low' ? options.foldConfig : null,
      coverageRows,
      bedImage: null,
      spreadingSessionIds: [],
      assignedCuttingTableIds: [],
      status: '草稿',
      readyForSpreading: false,
      lockedBySpreading: false,
      remark: '',
    },
  ]
}

function getGreatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.round(left))
  let b = Math.abs(Math.round(right))
  while (b > 0) {
    const next = a % b
    a = b
    b = next
  }
  return a || 1
}

function getSeedPiecePerLayer(demands: number[]): number {
  const positiveDemands = demands.map((value) => Math.max(Math.round(safeNumber(value)), 0)).filter((value) => value > 0)
  if (!positiveDemands.length) return 1
  const demandGcd = positiveDemands.reduce((current, value) => getGreatestCommonDivisor(current, value), positiveDemands[0])
  for (let candidate = Math.min(demandGcd, 80); candidate >= 1; candidate -= 1) {
    if (demandGcd % candidate === 0) return candidate
  }
  return 1
}

function getSeedLayerCount(demandQty: number, piecePerLayer: number, bedMode: MarkerPlanModeKey): number {
  const layerCount = Math.max(Math.ceil(Math.max(Math.round(safeNumber(demandQty)), 0) / Math.max(Math.round(safeNumber(piecePerLayer)), 1)), 0)
  if (!isFoldMarkerBedMode(bedMode)) return layerCount
  return layerCount % 2 === 0 ? layerCount : layerCount + 1
}

function buildReadySeedSchemeBeds(plan: MarkerPlan, context: MarkerPlanContextCandidate): MarkerSchemeBed[] {
  const demandRows = Array.isArray(plan.schemeDemandRows) && plan.schemeDemandRows.length
    ? plan.schemeDemandRows
    : buildSchemeDemandRowsFromContext(context)
  const sizeNames = uniqueStrings(demandRows.map((row) => row.sizeName || row.sizeCode)).filter(Boolean)
  const colorNames = uniqueStrings(demandRows.map((row) => row.colorName || row.colorCode)).filter(Boolean)
  const activeSizes = sizeNames.length ? sizeNames : ['M']
  const activeColors = colorNames.length ? colorNames : ['主色']
  const bedMode = plan.markerMode || 'normal'
  const isHighLowMode = isHighLowMarkerBedMode(bedMode)
  const demandByColorSize = new Map<string, number>()

  demandRows.forEach((row) => {
    const colorName = row.colorName || row.colorCode || '主色'
    const sizeName = row.sizeName || row.sizeCode || 'M'
    const key = buildDemandMatchKey(colorName, sizeName)
    demandByColorSize.set(key, (demandByColorSize.get(key) || 0) + Math.max(Math.round(safeNumber(row.demandQty)), 0))
  })

  const sizePiecePerLayer = Object.fromEntries(
    activeSizes.map((sizeName) => [
      sizeName,
      getSeedPiecePerLayer(activeColors.map((colorName) => demandByColorSize.get(buildDemandMatchKey(colorName, sizeName)) || 0)),
    ]),
  ) as Record<string, number>

  const baseMarkerLength = roundTo(12 + activeSizes.length * 1.2 + activeColors.length * 0.4, 2)
  const matrixColors = isHighLowMode && activeColors.length ? [...activeColors, activeColors[0]] : activeColors
  const matrixRows: MarkerHighLowMatrixRow[] = matrixColors.map((colorName, index) => {
    const rawLayers = activeSizes.map((sizeName) =>
      getSeedLayerCount(demandByColorSize.get(buildDemandMatchKey(colorName, sizeName)) || 0, sizePiecePerLayer[sizeName], bedMode),
    )
    const rowLayer = Math.max(...rawLayers, 0)
    const sizeValues = Object.fromEntries(
      activeSizes.map((sizeName) => [sizeName, rowLayer]),
    ) as Record<string, number>
    const totalQty = activeSizes.reduce(
      (total, sizeName) => total + Math.max(Math.round(safeNumber(sizeValues[sizeName])), 0) * Math.max(Math.round(safeNumber(sizePiecePerLayer[sizeName])), 0),
      0,
    )
    return {
      rowId: `${plan.id}-ready-marker-row-${index + 1}`,
      stepNo: index + 1,
      stepLabel: buildHighLowStepLabel(index + 1),
      colorCode: colorName,
      colorName,
      markerLength: isHighLowMode ? roundTo(baseMarkerLength + index * 0.8, 2) : 0,
      sizeValues,
      patternValues: {},
      totalQty,
    }
  })
  const coverageRows = demandRows.map((row, index) => {
    const colorName = row.colorName || row.colorCode || '主色'
    const sizeName = row.sizeName || row.sizeCode || 'M'
    const plannedQty = matrixRows
      .filter((item) => (item.colorName || item.colorCode) === colorName)
      .reduce((sum, matrixRow) => sum + getMarkerMatrixCellPlannedQty(matrixRow, sizeName, sizePiecePerLayer), 0)
    const demandQty = Math.max(Math.round(safeNumber(row.demandQty)), 0)
    return {
      rowId: `${row.rowId}-ready-coverage-${index + 1}`,
      colorCode: row.colorCode || colorName,
      colorName,
      sizeCode: row.sizeCode || sizeName,
      sizeName,
      demandQty,
      plannedQty,
      remainingQty: demandQty - plannedQty,
    }
  })
  const bedNoPrefix = isHighLowMode ? 'B' : 'A'
  const markerLength = isHighLowMode ? 0 : baseMarkerLength

  return [
    {
      bedId: `${plan.id}-bed-1`,
      schemeId: plan.schemeId || plan.id,
      schemeNo: plan.schemeNo || plan.markerNo,
      bedNo: `${bedNoPrefix}-1`,
      bedName: `${bedNoPrefix}-1`,
      bedSortOrder: 1,
      bedMode,
      colorCode: activeColors.join(' / '),
      colorName: activeColors.join(' / '),
      materialSku: uniqueStrings(demandRows.map((row) => row.materialSku)).join(' / ') || context.materialSkuSummary,
      sizeSummaryText: activeSizes.join(' / '),
      sizePiecePerLayer,
      plannedLayerCount: 0,
      markerLength,
      markerPieceQtyPerLayer: 0,
      plannedGarmentQty: 0,
      spreadTotalLength: 0,
      unitFabricUsage: 0,
      normalLayoutRows: [],
      highLowMatrixRows: matrixRows,
      foldConfig: isFoldMarkerBedMode(bedMode) ? plan.foldConfig : null,
      coverageRows,
      bedImage: null,
      spreadingSessionIds: [],
      assignedCuttingTableIds: [],
      status: '可铺布',
      readyForSpreading: true,
      lockedBySpreading: false,
      remark: '',
    },
  ]
}

function adaptPlanToMarkerExplosionInput(plan: MarkerPlan): MarkerPlanLike {
  const allocationLines: MarkerPlanAllocationLike[] = plan.allocationRows.map((row) => ({
    allocationId: row.id,
    sourceCutOrderId: row.sourceCutOrderId,
    sourceCutOrderNo: row.sourceCutOrderNo,
    sourceProductionOrderId: row.sourceProductionOrderId,
    sourceProductionOrderNo: row.sourceProductionOrderNo,
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
    cutOrderIds: plan.cutOrderIds,
    techPackSpuCode: plan.techPackSpu,
    spuCode: plan.spuCode,
    sizeDistribution: (Array.isArray(plan.sizeRatioRows) ? plan.sizeRatioRows : []).map((row) => ({
      sizeLabel: row.sizeCode,
      quantity: row.qty,
    })),
    allocationLines,
  }
}

function buildPieceExplosionRows(plan: MarkerPlan, context: MarkerPlanContextCandidate): MarkerPieceExplosionRow[] {
  const rowsById = Object.fromEntries(context.sourceMaterialPrepRows.map((row) => [row.cutOrderId, row]))
  const markerExplosionInput = adaptPlanToMarkerExplosionInput(plan)
  const sourceRows = buildMarkerAllocationSourceRows(markerExplosionInput, rowsById)
  const explosion = buildMarkerPieceExplosionViewModel({ marker: markerExplosionInput, sourceRows })
  const sourceRowMap = Object.fromEntries(context.sourceGeneratedRows.map((row) => [row.cutOrderNo, row]))
  const previousOverrides = Object.fromEntries(
    (plan.pieceExplosionRows || [])
      .filter((row) => row.manualOverride)
      .map((row) => [row.id, row]),
  ) as Record<string, MarkerPieceExplosionRow>

  return explosion.pieceDetailRows.map((row) => {
    const sourceGeneratedRow = sourceRowMap[row.sourceCutOrderNo] || null
    const sourceCutOrderId = sourceGeneratedRow?.cutOrderId || row.sourceCutOrderNo
    const sourceCutOrderNo = sourceGeneratedRow?.cutOrderNo || row.sourceCutOrderNo
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
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl,
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

function isFoldMarkerBedMode(mode: string): boolean {
  return mode === 'fold_normal' || mode === 'fold_high_low'
}

function isHighLowMarkerBedMode(mode: string): boolean {
  return mode === 'high_low' || mode === 'fold_high_low'
}

function buildHighLowStepLabel(stepNo: number): string {
  return `第${Math.max(Math.round(safeNumber(stepNo)), 1)}阶`
}

function normalizeMarkerSizePiecePerLayer(
  bed: MarkerSchemeBed,
  sizeNames: string[],
): Record<string, number> {
  return Object.fromEntries(
    sizeNames.map((sizeName) => [sizeName, Math.max(Math.round(safeNumber(bed.sizePiecePerLayer?.[sizeName])), 0)]),
  ) as Record<string, number>
}

function getMarkerMatrixCellLayer(row: MarkerHighLowMatrixRow, sizeName: string): number {
  return Math.max(Math.round(safeNumber(row.sizeValues?.[sizeName])), 0)
}

function getMarkerMatrixCellPlannedQty(
  row: MarkerHighLowMatrixRow,
  sizeName: string,
  sizePiecePerLayer: Record<string, number>,
): number {
  return getMarkerMatrixCellLayer(row, sizeName) * Math.max(Math.round(safeNumber(sizePiecePerLayer[sizeName])), 0)
}

function getMarkerMatrixCellActualLayer(mode: string, layerCount: number): number {
  const normalized = Math.max(Math.round(safeNumber(layerCount)), 0)
  return isFoldMarkerBedMode(mode) ? normalized / 2 : normalized
}

function normalizeMarkerMatrixRows(
  bed: MarkerSchemeBed,
  sizeNames: string[],
): MarkerHighLowMatrixRow[] {
  const rows = Array.isArray(bed.highLowMatrixRows) ? bed.highLowMatrixRows : []
  const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeNames)
  return rows.map((row, index) => {
    const sizeValues = Object.fromEntries(
      sizeNames.map((sizeName) => [
        sizeName,
        Math.max(Math.round(safeNumber(row.sizeValues?.[sizeName])), 0),
      ]),
    ) as Record<string, number>
    const totalQty = sizeNames.reduce(
      (total, sizeName) => total + Math.max(Math.round(safeNumber(sizeValues[sizeName])), 0) * Math.max(Math.round(safeNumber(sizePiecePerLayer[sizeName])), 0),
      0,
    )
    return {
      rowId: row.rowId || `${bed.bedId}-matrix-${index + 1}`,
      stepNo: index + 1,
      stepLabel: buildHighLowStepLabel(index + 1),
      colorCode: row.colorCode || row.colorName || '主色',
      colorName: row.colorName || row.colorCode || '主色',
      markerLength: Math.max(safeNumber(row.markerLength), 0),
      sizeValues,
      patternValues: row.patternValues || {},
      totalQty,
    }
  })
}

function buildDemandMatchKey(colorName: string, sizeName: string): string {
  return `${String(colorName || '').trim()}::${String(sizeName || '').trim()}`
}

function getDemandMatchRowStatus(diffQty: number): MarkerDemandMatchRowStatusKey {
  if (diffQty < 0) return '不足'
  if (diffQty > 0) return '超出'
  return '已匹配'
}

function getDemandMatchStatus(summary: {
  markerTotalQty: number
  shortageQty: number
  surplusQty: number
}): MarkerDemandMatchStatusKey {
  if (summary.markerTotalQty <= 0) return '待编辑唛架'
  if (summary.shortageQty > 0 && summary.surplusQty > 0) return '有差异'
  if (summary.shortageQty > 0) return '有不足'
  if (summary.surplusQty > 0) return '有超出'
  return '已匹配'
}

export function buildMarkerDemandMatchSummary(
  plan: Pick<MarkerPlan, 'schemeDemandRows'> & Partial<Pick<MarkerPlan, 'beds'>>,
): MarkerDemandMatchSummary {
  const demandMap = new Map<string, MarkerDemandMatchRow>()
  const sizeNames = uniqueStrings((plan.schemeDemandRows || []).map((row) => row.sizeName || row.sizeCode))

  ;(plan.schemeDemandRows || []).forEach((row) => {
    const colorName = row.colorName || row.colorCode || '主色'
    const sizeName = row.sizeName || row.sizeCode || ''
    if (!sizeName) return
    const key = buildDemandMatchKey(colorName, sizeName)
    const current = demandMap.get(key)
    const demandQty = Math.max(Math.round(safeNumber(row.demandQty)), 0)
    demandMap.set(key, {
      rowId: key,
      colorCode: row.colorCode || colorName,
      colorName,
      sizeCode: row.sizeCode || sizeName,
      sizeName,
      demandQty: (current?.demandQty || 0) + demandQty,
      markerQty: current?.markerQty || 0,
      diffQty: 0,
      status: '已匹配',
    })
  })

  ;(plan.beds || []).forEach((bed) => {
    const bedSizeNames = sizeNames.length
      ? sizeNames
      : uniqueStrings((bed.coverageRows || []).map((row) => row.sizeName || row.sizeCode))
    const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, bedSizeNames)
    normalizeMarkerMatrixRows(bed, bedSizeNames).forEach((matrixRow) => {
      const colorName = matrixRow.colorName || matrixRow.colorCode || '主色'
      bedSizeNames.forEach((sizeName) => {
        const markerQty = getMarkerMatrixCellPlannedQty(matrixRow, sizeName, sizePiecePerLayer)
        if (markerQty <= 0) return
        const key = buildDemandMatchKey(colorName, sizeName)
        const current = demandMap.get(key)
        demandMap.set(key, {
          rowId: key,
          colorCode: current?.colorCode || matrixRow.colorCode || colorName,
          colorName: current?.colorName || colorName,
          sizeCode: current?.sizeCode || sizeName,
          sizeName: current?.sizeName || sizeName,
          demandQty: current?.demandQty || 0,
          markerQty: (current?.markerQty || 0) + markerQty,
          diffQty: 0,
          status: '已匹配',
        })
      })
    })
  })

  const rows = Array.from(demandMap.values())
    .map((row): MarkerDemandMatchRow => {
      const diffQty = row.markerQty - row.demandQty
      return {
        ...row,
        diffQty,
        status: getDemandMatchRowStatus(diffQty),
      }
    })
    .sort((left, right) =>
      `${left.colorName}-${left.sizeName}`.localeCompare(`${right.colorName}-${right.sizeName}`, 'zh-CN'),
    )
  const demandTotalQty = rows.reduce((total, row) => total + row.demandQty, 0)
  const markerTotalQty = rows.reduce((total, row) => total + row.markerQty, 0)
  const shortageQty = rows.reduce((total, row) => total + (row.diffQty < 0 ? Math.abs(row.diffQty) : 0), 0)
  const surplusQty = rows.reduce((total, row) => total + (row.diffQty > 0 ? row.diffQty : 0), 0)
  const diffTotalQty = markerTotalQty - demandTotalQty
  return {
    status: getDemandMatchStatus({ markerTotalQty, shortageQty, surplusQty }),
    demandTotalQty,
    markerTotalQty,
    diffTotalQty,
    shortageQty,
    surplusQty,
    rowCount: rows.length,
    rows,
  }
}

function getMarkerMatrixActualLayerTotal(
  bed: MarkerSchemeBed,
  rows: MarkerHighLowMatrixRow[],
  sizeNames: string[],
): number {
  const columnTotals = sizeNames.map((sizeName) =>
    rows.reduce((total, row) => {
      const layerCount = getMarkerMatrixCellLayer(row, sizeName)
      if (layerCount <= 0) return total
      return total + getMarkerMatrixCellActualLayer(bed.bedMode, layerCount)
    }, 0),
  )
  return Math.max(...columnTotals, 0)
}

function getMarkerMatrixRowActualLayer(bed: MarkerSchemeBed, row: MarkerHighLowMatrixRow, sizeNames: string[]): number {
  return Math.max(...sizeNames.map((sizeName) => getMarkerMatrixCellActualLayer(bed.bedMode, getMarkerMatrixCellLayer(row, sizeName))), 0)
}

export function hydrateMarkerPlan(plan: MarkerPlan, context: MarkerPlanContextCandidate): MarkerPlan {
  const schemeDemandRows = (plan.schemeDemandRows || []).map((row) => ({
    ...row,
    demandQty: Math.max(safeNumber(row.demandQty), 0),
    plannedQty: Math.max(safeNumber(row.plannedQty), 0),
    remainingQty: Math.max(safeNumber(row.remainingQty), 0),
  }))
  const fallbackSizeRatioRows = (Array.isArray(plan.sizeRatioRows) ? plan.sizeRatioRows : []).map((row, index) => ({
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
    const sizeNames = uniqueStrings(
      (schemeDemandRows.length ? schemeDemandRows : bed.coverageRows || [])
        .map((row) => row.sizeName || row.sizeCode)
        .filter(Boolean),
    )
    const sizePiecePerLayer = normalizeMarkerSizePiecePerLayer(bed, sizeNames)
    const highLowMatrixRows = normalizeMarkerMatrixRows(bed, sizeNames)
    const markerLength = roundTo(safeNumber(bed.markerLength), 2)
    const plannedLayerCount = highLowMatrixRows.length
      ? getMarkerMatrixActualLayerTotal(bed, highLowMatrixRows, sizeNames)
      : Math.max(Math.round(safeNumber(bed.plannedLayerCount)), 0)
    const plannedGarmentQty = highLowMatrixRows.length
      ? highLowMatrixRows.reduce((total, row) => total + sizeNames.reduce((rowTotal, sizeName) => rowTotal + getMarkerMatrixCellPlannedQty(row, sizeName, sizePiecePerLayer), 0), 0)
      : Math.max(Math.round(safeNumber(bed.markerPieceQtyPerLayer)), 0) * plannedLayerCount
    const markerPieceQtyPerLayer = plannedLayerCount > 0 ? Math.max(Math.ceil(plannedGarmentQty / plannedLayerCount), 1) : 0
    const spreadTotalLength = isHighLowMarkerBedMode(bed.bedMode)
      ? highLowMatrixRows.reduce((total, row) => total + computeMarkerLayoutLineSpreadLength(
          { markerLength: Math.max(safeNumber(row.markerLength), 0), repeatCount: getMarkerMatrixRowActualLayer(bed, row, sizeNames) },
          plan.singleSpreadFixedLoss,
        ), 0)
      : computeMarkerLayoutLineSpreadLength(
          { markerLength, repeatCount: plannedLayerCount },
          plan.singleSpreadFixedLoss,
        )
    const unitFabricUsage = plannedGarmentQty > 0 ? roundTo(spreadTotalLength / plannedGarmentQty, 3) : 0
    const readyForSpreading = (isHighLowMarkerBedMode(bed.bedMode) || markerLength > 0) && markerPieceQtyPerLayer > 0 && plannedLayerCount > 0 && bed.coverageRows.length > 0
    return {
      ...bed,
      schemeId: plan.schemeId || plan.id,
      schemeNo: plan.schemeNo || plan.markerNo,
      bedSortOrder: index + 1,
      bedName: bed.bedName || bed.bedNo,
      colorName: bed.colorName || bed.colorCode,
      materialSku: bed.materialSku || plan.sourceMaterialSku || plan.materialSkuSummary,
      sizeSummaryText: bed.coverageRows.map((row) => row.sizeName || row.sizeCode).filter(Boolean).join(' / '),
      sizePiecePerLayer,
      plannedLayerCount,
      markerLength: isHighLowMarkerBedMode(bed.bedMode) ? 0 : markerLength,
      markerPieceQtyPerLayer,
      plannedGarmentQty,
      spreadTotalLength,
      unitFabricUsage,
      highLowMatrixRows,
      foldConfig: bed.bedMode === 'fold_normal' || bed.bedMode === 'fold_high_low' ? foldConfig : null,
      readyForSpreading,
      status: readyForSpreading ? bed.status === '已完成' || bed.status === '已排程' || bed.status === '铺布中' || bed.status === '已锁定' ? bed.status : '可铺布' : '草稿',
    }
  })
  const netLength = roundTo(
    beds.length
      ? sum(beds.map((bed) => isHighLowMarkerBedMode(bed.bedMode) ? sum(bed.highLowMatrixRows.map((row) => row.markerLength)) : bed.markerLength))
      : rawNetLength,
    2,
  )
  const systemUnitUsage = beds.length
    ? computeMarkerPlanSystemUnitUsageFromBeds(beds)
    : computeMarkerPlanSystemUnitUsage(netLength, totalPieces)
  const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, plan.manualUnitUsage)
  const plannedSpreadLength = sum(beds.map((bed) => bed.spreadTotalLength))
  const bindingStripRequirementSummary = summarizeBindingStripRequirementsForCutOrders(plan.cutOrderIds)
  const bindingStripReservedLength = bindingStripRequirementSummary.totalRequiredLengthM
  const materialTotalUsageLength = roundTo(plannedSpreadLength + bindingStripReservedLength, 2)
  const bindingStripReservedLengthFormula = buildBindingStripReservedLengthFormula(bindingStripRequirementSummary)
  const materialTotalUsageLengthFormula = buildBindingStripMaterialTotalUsageFormula(plannedSpreadLength, bindingStripReservedLength)
  const bindingStripWorkOrderIds = buildBindingProcessOrders()
    .filter((order) => plan.cutOrderIds.includes(order.sourceCutOrderId))
    .map((order) => order.bindingOrderId)
  const allocationStatus = deriveMarkerAllocationStatus(sizeRatioRows, allocationRows)
  const mappingStatus = deriveMarkerMappingStatus(pieceExplosionRows)
  const layoutStatus: MarkerLayoutStatusKey = beds.length > 0 && beds.every((bed) => bed.readyForSpreading) ? 'done' : 'pending'
  const confirmationStatus: MarkerPlanConfirmationStatusKey = plan.confirmationStatus || '待确认'
  const imageStatus = plan.schemeImage || plan.detailImage || plan.imageRecords.length ? deriveMarkerImageStatus(1) : deriveMarkerImageStatus(0)
  const schemeImageStatus = imageStatus === 'done'
    ? plan.schemeImageStatus === '已过期'
      ? '已过期'
      : '已生成'
    : '待生成'
  const derivedReadyForSpreading = deriveMarkerReadyForSpreading({
    totalPieces,
    netLength,
    mappingStatus,
    layoutStatus,
    confirmationStatus,
  })
  const derivedStatus = deriveMarkerPlanStatus({
    mappingStatus,
    layoutStatus,
    confirmationStatus,
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
    bindingStripReservedLength,
    bindingStripReservedLengthFormula,
    materialTotalUsageLength,
    materialTotalUsageLengthFormula,
    bindingStripWorkOrderIds,
    bindingStripRequirementSummary: bindingStripRequirementSummary.widthSummaries
      .map((item) => {
        const minNote = item.minRequiredLengthApplied ? `（原算 ${formatNumber(item.rawRequiredLengthM, 2)} m，不足 4m 按 4m）` : ''
        return `${item.materialSku} / ${item.bindingWidthCm}cm / ${formatNumber(item.requiredLengthM, 2)}m${minNote}`
      })
      .join('；'),
    schemeDemandRows,
    beds,
    sizeRatioRows,
    allocationRows,
    layoutLines,
    modeDetailLines,
    foldConfig,
    pieceExplosionRows,
    materialAliasSummary: plan.materialAliasSummary || context.materialAliasSummary || '',
    materialImageUrl: plan.materialImageUrl || context.materialImageUrl || '',
    imageCount: plan.imageRecords.length,
    schemeImageStatus,
    allocationStatus,
    mappingStatus,
    layoutStatus,
    confirmationStatus,
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
  referencedCutOrderIds: Set<string>,
): MarkerPlanViewRow {
  const hydrated = hydrateMarkerPlan(plan, context)
  const explosionSummary = buildExplosionSummary(hydrated)
  const demandMatchSummary = buildMarkerDemandMatchSummary(hydrated)
  const sourceProductionOrderCount = uniqueStrings(hydrated.productionOrderIds).length
  const sourceCutOrderCount = uniqueStrings(hydrated.cutOrderIds).length
  const isReferencedBySpreading = hydrated.cutOrderIds.some((id) => referencedCutOrderIds.has(id))
  return {
    ...hydrated,
    modeMeta: markerPlanModeMeta[hydrated.markerMode],
    statusMeta: markerPlanStatusMeta[hydrated.status],
    mappingStatusMeta: markerMappingStatusMeta[hydrated.mappingStatus],
    layoutStatusMeta: markerLayoutStatusMeta[hydrated.layoutStatus],
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
    sourceCutOrderCountText: `${sourceCutOrderCount} 张`,
    sourceProductionOrderCountText: `${sourceProductionOrderCount} 单`,
    referenceWarningText: isReferencedBySpreading
      ? '当前方案唛架已被铺布引用。若修改配比、分配、唛架结构，请从裁片单重新创建方案。'
      : '',
    isReferencedBySpreading,
    skuTypeCountText: `${explosionSummary.skuTypeCount}`,
    balanceRows: buildBalanceRows(hydrated),
    explosionSummary,
    demandMatchSummary,
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
    markerPlanGroupKey: options.context.markerPlanGroupKey,
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
    status: 'WAITING_LAYOUT',
    markerMode,
    contextType: options.context.contextType,
    cutOrderIds: [...options.context.cutOrderIds],
    cutOrderNos: [...options.context.cutOrderNos],
    markerPlanId: options.context.markerPlanId,
    markerPlanNo: options.context.markerPlanNo,
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
    materialAliasSummary: options.context.materialAliasSummary,
    materialImageUrl: options.context.materialImageUrl,
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
    confirmationStatus: '待确认',
    confirmedBy: '',
    confirmedAt: '',
    confirmationRemark: '',
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
    confirmationStatus: '待确认',
    confirmedBy: '',
    confirmedAt: '',
    confirmationRemark: '',
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
  const variants: SeedVariantKey[] = ['ready', 'layout', 'ready', 'ready', 'ready', 'manual']
  const preferredContexts = contexts.filter((context) => context.contextType === 'cut-order' && context.spuCode !== 'SPU-2024-010')
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
    imageRecords: [],
    hasAdjustment: variant === 'mapping',
    adjustmentNote: variant === 'mapping' ? '当前样例用于演示技术包映射异常人工确认。' : '',
    remark: variant === 'ready' ? '当前方案可直接交接铺布。' : '当前为计划层样例方案。',
    confirmationStatus: variant === 'ready' || variant === 'manual' ? '已确认' : variant === 'mapping' || variant === 'unbalanced' ? '需调整' : '待确认',
    confirmedBy: variant === 'ready' || variant === 'manual' ? '业务同事-廖晓飞' : '',
    confirmedAt: variant === 'ready' || variant === 'manual' ? plan.updatedAt || plan.createdAt : '',
    confirmationRemark: variant === 'ready' || variant === 'manual' ? '业务已确认当前差异结果可用于铺布。' : '',
  }

  if (variant === 'unbalanced' && nextPlan.allocationRows[0]) {
    nextPlan = {
      ...nextPlan,
      imageRecords: [],
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
      imageRecords: [],
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
      imageRecords: [],
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

  if (variant === 'ready' || variant === 'manual') {
    const readyBeds = buildReadySeedSchemeBeds(nextPlan, context)
    nextPlan = {
      ...nextPlan,
      beds:
        variant === 'manual'
          ? readyBeds.flatMap((bed) =>
              [0, 1, 2].map((offset) => {
                const bedIndex = offset + 1
                const bedNoPrefix = bed.bedNo.split('-')[0] || 'A'
                const layerOffset = offset * 2
                return {
                  ...bed,
                  bedId: `${nextPlan.id}-bed-${bedIndex}`,
                  bedNo: `${bedNoPrefix}-${bedIndex}`,
                  bedName: `${bedNoPrefix}-${bedIndex}`,
                  bedSortOrder: bedIndex,
                  highLowMatrixRows: (bed.highLowMatrixRows || []).map((row, rowIndex) => ({
                    ...row,
                    rowId: `${nextPlan.id}-ready-marker-row-${bedIndex}-${rowIndex + 1}`,
                    stepNo: rowIndex + 1,
                    stepLabel: buildHighLowStepLabel(rowIndex + 1),
                    sizeValues: Object.fromEntries(
                      Object.entries(row.sizeValues || {}).map(([sizeName, value]) => [
                        sizeName,
                        Math.max(Math.round(safeNumber(value)) + layerOffset, 0),
                      ]),
                    ) as MarkerHighLowMatrixRow['sizeValues'],
                  })),
                  remark: offset === 0 ? bed.remark : '样例：同一唛架方案下的第二/第三个唛架编号。',
                }
              }),
            )
          : readyBeds,
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
            imageName: `${markerNo}-${bed.bedNo}-唛架图.svg`,
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
  stored.forEach((plan) => {
    if (plan.id.startsWith('seed-marker-plan-')) return
    merged.set(plan.id, plan)
  })
  return Array.from(merged.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildMarkerPlanViewModel(sources: CuttingSummaryBuildOptions, storedPlans: MarkerPlan[] = []): MarkerPlanViewModel {
  const contexts = buildMarkerPlanContextCandidates(sources)
  const seedPlans = buildSystemSeedMarkerPlans(contexts)
  const mergedPlans = mergePlans(seedPlans, storedPlans)
  const referencedCutOrderIds = new Set(
    uniqueStrings([
      ...listReferencedCutOrderIdsFromSpreadingStorage(),
      ...listReferencedCutOrderIdsFromMarkerStore(sources.markerStore),
    ]),
  )
  const plans = mergedPlans
    .map((plan) => {
      const context = findMarkerPlanContextForPlan(contexts, plan)
      return context ? buildPlanViewRow(plan, context, referencedCutOrderIds) : null
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
    referencedCutOrderIds?: string[]
  } = {},
): MarkerPlanMockCoverageReport {
  const contexts = buildMarkerPlanContextCandidates(sources)
  const contextMap = Object.fromEntries(contexts.map((context) => [context.contextKey, context]))
  const seedPlans = buildSystemSeedMarkerPlans(contexts)
  const mergedPlans = mergePlans(seedPlans, storedPlans)
  const referencedCutOrderIds = new Set(
    uniqueStrings([
      ...(options.referencedCutOrderIds || []),
      ...listReferencedCutOrderIdsFromMarkerStore(sources.markerStore),
    ]),
  )
  const hydratedPlans = mergedPlans
    .map((plan) => {
      const contextId = plan.contextType === 'marker-plan' ? plan.markerPlanId : plan.cutOrderIds[0]
      const context = contextMap[buildContextKey(plan.contextType, contextId)]
      return context ? hydrateMarkerPlan(plan, context) : null
    })
    .filter((plan): plan is MarkerPlan => Boolean(plan))
  const usedContextKeys = new Set(
    hydratedPlans.map((plan) =>
      buildContextKey(plan.contextType, plan.contextType === 'marker-plan' ? plan.markerPlanId : plan.cutOrderIds[0]),
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
    pendingCutOrderContextCount: pendingContexts.filter((context) => context.contextType === 'cut-order').length,
    pendingMarkerPlanSourceContextCount: pendingContexts.filter((context) => context.contextType === 'marker-plan').length,
    builtPlanCount: hydratedPlans.length,
    referencedPlanCount: hydratedPlans.filter((plan) => plan.cutOrderIds.some((id) => referencedCutOrderIds.has(id))).length,
    mappingIssueCount: hydratedPlans.filter((plan) => plan.mappingStatus !== 'passed').length,
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
  plan: Pick<MarkerPlan, 'contextType' | 'markerPlanId' | 'markerPlanNo' | 'cutOrderIds'>,
): MarkerPlanContextCandidate | null {
  if (plan.contextType !== 'marker-plan' && (plan.cutOrderIds.length > 1 || plan.markerPlanNo)) {
    const markerPlanNos = new Set(String(plan.markerPlanNo || '').split('/').map((item) => item.trim()).filter(Boolean))
    const markerPlanContexts = contexts.filter(
      (context) => context.contextType === 'marker-plan' && markerPlanNos.has(context.markerPlanNo),
    )
    const coveredByMarkerPlans = new Set(markerPlanContexts.flatMap((context) => context.cutOrderIds))
    const cutOrderContexts = plan.cutOrderIds
      .filter((cutOrderId) => !coveredByMarkerPlans.has(cutOrderId))
        .map((cutOrderId) =>
          contexts.find(
            (context) =>
              context.contextType === 'cut-order' &&
              context.cutOrderIds.includes(cutOrderId),
          ) || null,
        )
        .filter((context): context is MarkerPlanContextCandidate => Boolean(context))
    const sourceContexts = uniqueByKey(
      [...markerPlanContexts, ...cutOrderContexts],
      (context) => context.contextKey,
    )
    const coveredCutOrderIds = new Set(sourceContexts.flatMap((context) => context.cutOrderIds))
    if (plan.cutOrderIds.every((cutOrderId) => coveredCutOrderIds.has(cutOrderId))) {
      return buildCombinedMarkerPlanContextCandidate(sourceContexts)
    }
  }
  const contextId = plan.contextType === 'marker-plan' ? plan.markerPlanId : plan.cutOrderIds[0]
  if (!contextId) return null
  return findMarkerPlanContextById(contexts, plan.contextType, contextId)
}

export function getMarkerPlanSourceerencedWarning(
  plan: Pick<MarkerPlanViewRow, 'isReferencedBySpreading' | 'referenceWarningText'>,
): string {
  return plan.isReferencedBySpreading ? plan.referenceWarningText : ''
}

function listUsedContextKeysForPlan(
  contexts: MarkerPlanContextCandidate[],
  plan: Pick<MarkerPlan, 'contextType' | 'markerPlanId' | 'markerPlanNo' | 'cutOrderIds'>,
): string[] {
  if (plan.contextType === 'marker-plan' && plan.markerPlanId) {
    return [buildContextKey('marker-plan', plan.markerPlanId)]
  }
  const cutOrderIdSet = new Set(plan.cutOrderIds)
  const markerPlanNos = new Set(String(plan.markerPlanNo || '').split('/').map((item) => item.trim()).filter(Boolean))
  return contexts
    .filter((context) => {
      if (context.contextType === 'cut-order') {
        return context.cutOrderIds.some((cutOrderId) => cutOrderIdSet.has(cutOrderId))
      }
      return markerPlanNos.has(context.markerPlanNo)
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

export function getMarkerPlanInitialEditTab(plan: MarkerPlanViewRow): MarkerPlanTabKey {
  return deriveMarkerPlanDefaultTab(plan)
}
