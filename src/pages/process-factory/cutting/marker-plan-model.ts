import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-original-cut-orders.ts'
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
  type MarkerHighLowMatrixCell,
  type MarkerImageRecord,
  type MarkerLayoutLine,
  type MarkerLayoutStatusKey,
  type MarkerMappingStatusKey,
  type MarkerModeDetailLine,
  type MarkerPlan,
  type MarkerPlanAllocationLike,
  type MarkerPlanContextType,
  type MarkerPlanLike,
  type MarkerPlanModeKey,
  type MarkerPlanStatusKey,
  type MarkerPlanTabKey,
  type MarkerPieceExplosionRow,
  type MarkerSizeCode,
  type MarkerSizeRatioRow,
  buildMarkerAllocationDiffFormula,
  buildMarkerAllocationSumFormula,
  buildMarkerExplodedPieceQtyFormula,
  buildMarkerFinalUnitUsageFormula,
  buildMarkerPlannedSpreadLengthFormula,
  buildMarkerSkuExplodedPieceQtyFormula,
  buildMarkerSystemUnitUsageFormula,
  buildMarkerTotalPiecesFormula,
  computeMarkerAllocationDiffBySize,
  computeMarkerAllocationSumBySize,
  computeMarkerExplodedPieceQty,
  computeMarkerFoldedEffectiveWidth,
  computeMarkerFoldWidthCheckPassed,
  computeMarkerHighLowMatrixTotal,
  computeMarkerLayoutLineSpreadLength,
  computeMarkerLayoutLineSystemUnitUsage,
  computeMarkerModeDetailSpreadLength,
  computeMarkerModeDetailSystemUnitUsage,
  computeMarkerPlanFinalUnitUsage,
  computeMarkerPlanSystemUnitUsage,
  computeMarkerPlanTotalPieces,
  computeMarkerPlannedSpreadLength,
  createEmptySizeRatioRows,
  deriveMarkerAllocationStatus,
  deriveMarkerImageStatus,
  deriveMarkerLayoutStatus,
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
    .filter((markerNo) => markerNo.startsWith(`MJ-${dateKey}`))
    .map((markerNo) => Number.parseInt(markerNo.split('-').pop() || '0', 10))
    .filter((serial) => Number.isFinite(serial))
  const nextSerial = Math.max(0, ...sameDaySerials) + 1
  return `MJ-${dateKey}-${String(nextSerial).padStart(3, '0')}`
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
  return JSON.stringify(records)
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

function buildContextTechPackStatusLabel(
  materialPrepRows: Array<Pick<MaterialPrepRow, 'techPackSpuCode'>>,
  fallbackSpu: string,
): string {
  const techPackCodes = uniqueStrings([...materialPrepRows.map((row) => row.techPackSpuCode || ''), fallbackSpu])
  if (!techPackCodes.length) return '待补'
  if (techPackCodes.length === 1) return '已关联'
  return '需人工确认'
}

function buildContextPrepStatusLabel(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialPrepStatus'>>,
): string {
  const prepKeys = uniqueStrings(originalRows.map((row) => row.materialPrepStatus.key))
  if (!prepKeys.length) return '待配料'
  if (prepKeys.length === 1) return originalRows[0]?.materialPrepStatus.label || '待配料'
  if (prepKeys.includes('NOT_CONFIGURED')) return '待配料'
  if (prepKeys.includes('PARTIAL')) return '配料中'
  return '已配置'
}

function buildContextClaimStatusLabel(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialClaimStatus'>>,
): string {
  const claimKeys = uniqueStrings(originalRows.map((row) => row.materialClaimStatus.key))
  if (!claimKeys.length) return '待领料'
  if (claimKeys.length === 1) return originalRows[0]?.materialClaimStatus.label || '待领料'
  if (claimKeys.includes('NOT_RECEIVED')) return '待领料'
  if (claimKeys.includes('PARTIAL')) return '部分领取'
  return '领料不齐'
}

function buildContextPrepClaimSummaryText(
  originalRows: Array<Pick<OriginalCutOrderRow, 'materialPrepStatus' | 'materialClaimStatus'>>,
): string {
  const prepLabel = buildContextPrepStatusLabel(originalRows)
  const claimLabel = buildContextClaimStatusLabel(originalRows)
  return `配料：${prepLabel} / 领料：${claimLabel}`
}

function buildOriginalContextCandidate(input: {
  row: OriginalCutOrderRow
  materialPrepRow: MaterialPrepRow | null
  productionRow: ProductionProgressRow | null
  sourceRecord: GeneratedOriginalCutOrderSourceRecord | null
}): MarkerPlanContextCandidate {
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
  const techPackStatusLabel = buildContextTechPackStatusLabel(
    input.materialPrepRow ? [{ techPackSpuCode: input.materialPrepRow.techPackSpuCode || '' }] : [],
    input.materialPrepRow?.techPackSpuCode || input.sourceRecord?.sourceTechPackSpuCode || input.row.spuCode,
  )
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
    techPackSpu: input.materialPrepRow?.techPackSpuCode || input.sourceRecord?.sourceTechPackSpuCode || input.row.spuCode,
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
  const techPackStatusLabel = buildContextTechPackStatusLabel(
    sourceMaterialPrepRows,
    uniqueStrings(sourceMaterialPrepRows.map((row) => row.techPackSpuCode || ''))[0] || sourceOriginalRows[0]?.spuCode || '',
  )
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
    techPackSpu: uniqueStrings(sourceMaterialPrepRows.map((row) => row.techPackSpuCode))[0] || sourceOriginalRows[0]?.spuCode || '',
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

  const originalContexts = sources.originalRows.map((row) =>
    buildOriginalContextCandidate({
      row,
      materialPrepRow: materialPrepRowsById[row.originalCutOrderId] || null,
      productionRow: productionRowsById[row.productionOrderId] || null,
      sourceRecord: generatedRowsById[row.originalCutOrderId] || null,
    }),
  )

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

function buildMockImageSvg(label: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><rect width="640" height="320" rx="20" fill="#F8FAFC"/><rect x="28" y="28" width="584" height="264" rx="16" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="3" stroke-dasharray="10 8"/><text x="48" y="96" font-size="26" font-family="Arial" fill="#0F172A">${label}</text><text x="48" y="144" font-size="16" font-family="Arial" fill="#475569">当前为系统预置唛架图，可替换为正式图片。</text><text x="48" y="188" font-size="16" font-family="Arial" fill="#475569">图片由上传或替换动作维护，不直接编辑图片地址。</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function createImageRecord(planId: string, index: number, markerNo: string, note = ''): MarkerImageRecord {
  return {
    id: `${planId}-image-${index}`,
    fileId: `${planId}-image-file-${index}`,
    fileName: `${markerNo}-唛架图-${index}.svg`,
    previewUrl: buildMockImageSvg(`${markerNo} · 唛架图 ${index}`, index % 2 === 0 ? '#2563EB' : '#7C3AED'),
    isPrimary: index === 1,
    note,
    uploadedAt: nowText(),
    uploadedBy: '计划员-陈静',
  }
}

function buildDefaultLayoutLines(planId: string, context: MarkerPlanContextCandidate, sizeRatioRows: MarkerSizeRatioRow[], netLength: number): MarkerLayoutLine[] {
  const lines = context.sourceGeneratedRows.length ? context.sourceGeneratedRows : [{ colorScope: context.colorSummary.split(' / '), materialSku: context.materialSkuSummary }] as never[]
  const totalPieces = computeMarkerPlanTotalPieces(sizeRatioRows)
  return lines.slice(0, Math.max(1, Math.min(lines.length, 3))).map((row, index) => {
    const markerPieceQty = Math.max(Math.round(totalPieces / Math.max(Math.min(lines.length, 3), 1)), 1)
    const markerLength = roundTo(netLength / Math.max(Math.min(lines.length, 3), 1), 2)
    const repeatCount = Math.max(index === 0 ? 2 : 1, 1)
    return {
      id: `${planId}-layout-${index + 1}`,
      lineNo: index + 1,
      layoutCode: `LAY-${index + 1}`,
      ratioNote: sizeRatioRows.filter((item) => item.qty > 0).map((item) => `${item.sizeCode}×${item.qty}`).join(' / ') || '待补配比',
      colorCode: (row as GeneratedOriginalCutOrderSourceRecord).colorScope?.[0] || context.colorSummary.split(' / ')[0] || '主色',
      repeatCount,
      markerLength,
      markerPieceQty,
      systemUnitUsage: computeMarkerLayoutLineSystemUnitUsage({ markerLength, markerPieceQty }),
      spreadLength: computeMarkerLayoutLineSpreadLength({ markerLength, repeatCount }, DEFAULT_SINGLE_SPREAD_FIXED_LOSS),
      widthCode: index % 2 === 0 ? '160cm' : '170cm',
      note: `${context.materialSkuSummary} 默认排版线`,
    }
  })
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

function buildDefaultHighLowMatrixCells(sizeRatioRows: MarkerSizeRatioRow[]): MarkerHighLowMatrixCell[] {
  return ['高层', '低层'].flatMap((sectionName, sectionIndex) =>
    sizeRatioRows.map((row) => ({
      sectionType: sectionIndex === 0 ? 'HIGH' : 'LOW',
      sectionName,
      sizeCode: row.sizeCode,
      qty: Math.max(Math.floor(row.qty / 2), row.qty > 0 && sectionIndex === 0 ? 1 : 0),
    })),
  )
}

function buildDefaultModeDetailLines(planId: string, context: MarkerPlanContextCandidate, sizeRatioRows: MarkerSizeRatioRow[], netLength: number): MarkerModeDetailLine[] {
  const totalPieces = Math.max(computeMarkerHighLowMatrixTotal(buildDefaultHighLowMatrixCells(sizeRatioRows)), 1)
  return ['高层模式', '低层模式'].map((modeName, index) => {
    const markerPieceQty = Math.max(Math.round(totalPieces / 2), 1)
    const markerLength = roundTo(netLength / 2 + index * 0.2, 2)
    const repeatCount = index === 0 ? 2 : 1
    return {
      id: `${planId}-mode-${index + 1}`,
      modeName,
      colorCode: context.colorSummary.split(' / ')[index] || context.colorSummary.split(' / ')[0] || '主色',
      repeatCount,
      markerLength,
      markerPieceQty,
      systemUnitUsage: computeMarkerModeDetailSystemUnitUsage({ markerLength, markerPieceQty }),
      spreadLength: computeMarkerModeDetailSpreadLength({ markerLength, repeatCount }, DEFAULT_SINGLE_SPREAD_FIXED_LOSS),
      note: `${modeName} 默认铺布模式`,
    }
  })
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
  const sizeRatioRows = plan.sizeRatioRows.map((row, index) => ({
    ...row,
    sizeCode: normalizeMarkerSizeCode(row.sizeCode) || MARKER_SIZE_CODES[index] || 'M',
    qty: Math.max(safeNumber(row.qty), 0),
    sortOrder: index + 1,
  }))
  const totalPieces = computeMarkerPlanTotalPieces(sizeRatioRows)
  const layoutLines = plan.layoutLines.map((line, index) => {
    const markerLength = roundTo(safeNumber(line.markerLength), 2)
    const markerPieceQty = Math.max(safeNumber(line.markerPieceQty), 0)
    const repeatCount = Math.max(safeNumber(line.repeatCount), 0)
    return {
      ...line,
      lineNo: index + 1,
      markerLength,
      markerPieceQty,
      repeatCount,
      systemUnitUsage: computeMarkerLayoutLineSystemUnitUsage({ markerLength, markerPieceQty }),
      spreadLength: computeMarkerLayoutLineSpreadLength({ markerLength, repeatCount }, plan.singleSpreadFixedLoss),
    }
  })
  const modeDetailLines = plan.modeDetailLines.map((line) => {
    const markerLength = roundTo(safeNumber(line.markerLength), 2)
    const markerPieceQty = Math.max(safeNumber(line.markerPieceQty), 0)
    const repeatCount = Math.max(safeNumber(line.repeatCount), 0)
    return {
      ...line,
      markerLength,
      markerPieceQty,
      repeatCount,
      systemUnitUsage: computeMarkerModeDetailSystemUnitUsage({ markerLength, markerPieceQty }),
      spreadLength: computeMarkerModeDetailSpreadLength({ markerLength, repeatCount }, plan.singleSpreadFixedLoss),
    }
  })
  const foldConfig = hydrateFoldConfig(plan.foldConfig)
  const netLength = roundTo(safeNumber(plan.netLength), 2)
  const systemUnitUsage = computeMarkerPlanSystemUnitUsage(netLength, totalPieces)
  const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, plan.manualUnitUsage)
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
      netLength,
      systemUnitUsage,
      finalUnitUsage,
      allocationRows,
      layoutLines,
      modeDetailLines,
      foldConfig,
    },
    context,
  )
  const plannedSpreadLength = computeMarkerPlannedSpreadLength({
    markerMode: plan.markerMode,
    layoutLines,
    modeDetailLines,
    singleSpreadFixedLoss: plan.singleSpreadFixedLoss,
  } as MarkerPlan)
  const allocationStatus = deriveMarkerAllocationStatus(sizeRatioRows, allocationRows)
  const mappingStatus = deriveMarkerMappingStatus(pieceExplosionRows)
  const layoutStatus = deriveMarkerLayoutStatus({
    markerMode: plan.markerMode,
    layoutLines,
    modeDetailLines,
    foldConfig,
  } as MarkerPlan)
  const imageStatus = deriveMarkerImageStatus(plan.imageRecords.length)
  const derivedReadyForSpreading = deriveMarkerReadyForSpreading({
    totalPieces,
    netLength,
    allocationStatus,
    mappingStatus,
    layoutStatus,
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
    sizeRatioRows,
    allocationRows,
    layoutLines,
    modeDetailLines,
    foldConfig,
    pieceExplosionRows,
    imageCount: plan.imageRecords.length,
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
    totalPiecesText: formatQty(hydrated.totalPieces),
    totalPiecesFormula: buildMarkerTotalPiecesFormula(hydrated.sizeRatioRows),
    systemUnitUsageFormula: buildMarkerSystemUnitUsageFormula(hydrated.netLength, hydrated.totalPieces),
    finalUnitUsageFormula: buildMarkerFinalUnitUsageFormula(hydrated.systemUnitUsage, hydrated.manualUnitUsage),
    finalUnitUsageText: formatNumber(hydrated.finalUnitUsage, 3),
    netLengthText: `${formatNumber(hydrated.netLength, 2)} m`,
    plannedSpreadLengthText: `${formatNumber(hydrated.plannedSpreadLength, 2)} m`,
    plannedSpreadLengthFormula: buildMarkerPlannedSpreadLengthFormula(hydrated),
    sourceOriginalOrderCountText: `${sourceOriginalOrderCount} 张`,
    sourceProductionOrderCountText: `${sourceProductionOrderCount} 单`,
    referenceWarningText: isReferencedBySpreading
      ? '当前唛架已被铺布引用。若修改配比、分配、排版结构，建议复制为新唛架。'
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
  const netLength = roundTo(Math.max(totalPieces * 0.42, 5), 2)
  const allocationRows = buildAutoAllocationRows(options.context, sizeRatioRows)
  const markerMode = options.markerMode || 'normal'
  const planId = `marker-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const layoutLines = markerMode === 'normal' || markerMode === 'fold_normal'
    ? buildDefaultLayoutLines(planId, options.context, sizeRatioRows, netLength)
    : []
  const highLowMatrixCells = markerMode === 'high_low' || markerMode === 'fold_high_low'
    ? buildDefaultHighLowMatrixCells(sizeRatioRows)
    : []
  const modeDetailLines = markerMode === 'high_low' || markerMode === 'fold_high_low'
    ? buildDefaultModeDetailLines(planId, options.context, sizeRatioRows, netLength)
    : []
  const foldConfig = markerMode === 'fold_normal' || markerMode === 'fold_high_low'
    ? buildDefaultFoldConfig(options.context)
    : null

  const plan: MarkerPlan = {
    id: planId,
    markerNo,
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
    plannedLayerCount: Math.max(Math.ceil(totalPieces / 40), 1),
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
    layoutLines,
    foldConfig,
    highLowMatrixCells,
    modeDetailLines,
    pieceExplosionRows: [],
    imageRecords: [],
    lastVisitedTab: 'basic',
  }
  return hydrateMarkerPlan(plan, options.context)
}

type SeedVariantKey = 'ready' | 'unbalanced' | 'mapping' | 'layout' | 'image' | 'manual'

function pickSeedContexts(
  contexts: MarkerPlanContextCandidate[],
  desiredType: MarkerPlanContextType,
): MarkerPlanContextCandidate[] {
  const typed = contexts.filter((item) => item.contextType === desiredType)
  return typed.length ? typed : contexts
}

function findSeedContextByOriginalId(
  contexts: MarkerPlanContextCandidate[],
  originalCutOrderId: string,
): MarkerPlanContextCandidate | null {
  return contexts.find(
    (context) => context.contextType === 'original-cut-order' && context.originalCutOrderIds.includes(originalCutOrderId),
  ) || null
}

function findSeedContextByMergeBatchNo(
  contexts: MarkerPlanContextCandidate[],
  mergeBatchNo: string,
): MarkerPlanContextCandidate | null {
  return contexts.find(
    (context) => context.contextType === 'merge-batch' && context.mergeBatchNo === mergeBatchNo,
  ) || null
}

function pickNextUnusedContext(
  contexts: MarkerPlanContextCandidate[],
  usedKeys: Set<string>,
  contextType: MarkerPlanContextType,
): MarkerPlanContextCandidate | null {
  return contexts.find((context) => context.contextType === contextType && !usedKeys.has(context.contextKey)) || null
}

function buildSeedVariants(contexts: MarkerPlanContextCandidate[]): Array<{ context: MarkerPlanContextCandidate; mode: MarkerPlanModeKey; variant: SeedVariantKey }> {
  const originalContexts = pickSeedContexts(contexts, 'original-cut-order')
  const mergeContexts = pickSeedContexts(contexts, 'merge-batch')
  const usedContextKeys = new Set<string>()

  const resolveContext = (
    preferred: MarkerPlanContextCandidate | null,
    contextType: MarkerPlanContextType,
  ): MarkerPlanContextCandidate | null => {
    if (preferred) {
      usedContextKeys.add(preferred.contextKey)
      return preferred
    }
    const nextUnused = pickNextUnusedContext(contexts, usedContextKeys, contextType)
    if (nextUnused) {
      usedContextKeys.add(nextUnused.contextKey)
      return nextUnused
    }
    const fallback = (contextType === 'merge-batch' ? mergeContexts : originalContexts)[0] || contexts[0] || null
    if (fallback) usedContextKeys.add(fallback.contextKey)
    return fallback
  }

  const seedItems = [
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260308-081-01'), 'original-cut-order'),
      mode: 'normal' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260310-083-02'), 'original-cut-order'),
      mode: 'normal' as const,
      variant: 'image' as const,
    },
    {
      context: resolveContext(findSeedContextByMergeBatchNo(contexts, 'MB-260403-081-LINING'), 'merge-batch'),
      mode: 'high_low' as const,
      variant: 'mapping' as const,
    },
    {
      context: resolveContext(findSeedContextByMergeBatchNo(contexts, 'MB-260403-081-PRINT'), 'merge-batch'),
      mode: 'fold_high_low' as const,
      variant: 'layout' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260311-084-01'), 'original-cut-order'),
      mode: 'high_low' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260312-085-01'), 'original-cut-order'),
      mode: 'fold_high_low' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260315-088-01'), 'original-cut-order'),
      mode: 'high_low' as const,
      variant: 'image' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260313-086-01'), 'original-cut-order'),
      mode: 'fold_high_low' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260302-001-01'), 'original-cut-order'),
      mode: 'fold_normal' as const,
      variant: 'unbalanced' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260308-081-03'), 'original-cut-order'),
      mode: 'normal' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260303-002-01'), 'original-cut-order'),
      mode: 'fold_normal' as const,
      variant: 'ready' as const,
    },
    {
      context: resolveContext(findSeedContextByOriginalId(contexts, 'CUT-260314-087-02'), 'original-cut-order'),
      mode: 'fold_normal' as const,
      variant: 'manual' as const,
    },
  ]

  return seedItems.filter(
    (item): item is { context: MarkerPlanContextCandidate; mode: MarkerPlanModeKey; variant: SeedVariantKey } =>
      Boolean(item.context),
  )
}

function applySeedVariant(plan: MarkerPlan, variant: SeedVariantKey, context: MarkerPlanContextCandidate): MarkerPlan {
  let nextPlan: MarkerPlan = {
    ...plan,
    imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '系统预置唛架图')],
    hasAdjustment: variant === 'mapping',
    adjustmentNote: variant === 'mapping' ? '当前样例用于演示技术包映射异常人工确认。' : '',
    remark: variant === 'ready' ? '当前唛架可直接交接铺布。' : '当前为计划层样例唛架，用于展示不同状态。',
  }

  if (variant === 'unbalanced' && nextPlan.allocationRows[0]) {
    nextPlan = {
      ...nextPlan,
      imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '待配平样例图')],
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
      imageRecords: [createImageRecord(plan.id, 1, plan.markerNo, '待排版样例图')],
      layoutLines: nextPlan.markerMode === 'normal' || nextPlan.markerMode === 'fold_normal' ? [] : nextPlan.layoutLines,
      modeDetailLines: nextPlan.markerMode === 'high_low' || nextPlan.markerMode === 'fold_high_low' ? [] : nextPlan.modeDetailLines,
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

function buildSystemSeedMarkerPlans(contexts: MarkerPlanContextCandidate[]): MarkerPlan[] {
  const plans: MarkerPlan[] = []
  const seedClock = new Date('2026-04-03T09:00:00')
  buildSeedVariants(contexts).forEach((item, index) => {
    const baseDate = new Date(seedClock.getTime() + index * 60_000)
    const basePlan = createPlanFromContext({
      context: item.context,
      existingPlans: plans,
      markerMode: item.mode,
      now: baseDate,
    })
    const seeded = applySeedVariant(
      {
        ...basePlan,
        id: `seed-marker-plan-${sanitizeKey(item.context.contextKey)}-${item.mode}-${item.variant}-${index + 1}`,
        createdAt: nowText(baseDate),
        updatedAt: nowText(baseDate),
        createdBy: '系统预置',
        updatedBy: '系统预置',
      },
      item.variant,
      item.context,
    )
    plans.push(seeded)
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
  const contextMap = Object.fromEntries(contexts.map((context) => [context.contextKey, context]))
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
      const contextId = plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0]
      const context = contextMap[buildContextKey(plan.contextType, contextId)]
      return context ? buildPlanViewRow(plan, context, referencedOriginalCutOrderIds) : null
    })
    .filter((plan): plan is MarkerPlanViewRow => Boolean(plan))
  const plansById = Object.fromEntries(plans.map((plan) => [plan.id, plan]))
  const usedContextKeys = new Set(plans.map((plan) => buildContextKey(plan.contextType, plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0])))
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
  plan: Pick<MarkerPlan, 'contextType' | 'mergeBatchId' | 'originalCutOrderIds'>,
): MarkerPlanContextCandidate | null {
  const contextId = plan.contextType === 'merge-batch' ? plan.mergeBatchId : plan.originalCutOrderIds[0]
  if (!contextId) return null
  return findMarkerPlanContextById(contexts, plan.contextType, contextId)
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

export function createEmptyMarkerPlanLayoutLine(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
): MarkerLayoutLine {
  return {
    id: `${plan.id}-layout-${plan.layoutLines.length + 1}`,
    lineNo: plan.layoutLines.length + 1,
    layoutCode: `LAY-${plan.layoutLines.length + 1}`,
    ratioNote:
      plan.sizeRatioRows.filter((row) => row.qty > 0).map((row) => `${row.sizeCode}×${row.qty}`).join(' / ') || '待补配比',
    colorCode: context.colorSummary.split(' / ')[0] || '主色',
    repeatCount: 1,
    markerLength: 0,
    markerPieceQty: 0,
    systemUnitUsage: 0,
    spreadLength: 0,
    widthCode: '',
    note: '',
  }
}

export function createEmptyMarkerPlanModeDetailLine(
  plan: MarkerPlan,
  context: MarkerPlanContextCandidate,
): MarkerModeDetailLine {
  return {
    id: `${plan.id}-mode-${plan.modeDetailLines.length + 1}`,
    modeName: `模式 ${plan.modeDetailLines.length + 1}`,
    colorCode: context.colorSummary.split(' / ')[0] || '主色',
    repeatCount: 1,
    markerLength: 0,
    markerPieceQty: 0,
    systemUnitUsage: 0,
    spreadLength: 0,
    note: '',
  }
}

export function cloneMarkerPlanAsNewDraft(plan: MarkerPlanViewRow, existingPlans: MarkerPlan[], now = new Date()): MarkerPlan {
  const markerNo = createMarkerNo(existingPlans, now)
  return {
    ...plan,
    id: `marker-plan-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    markerNo,
    status: deriveMarkerPlanStatus({
      allocationStatus: plan.allocationStatus,
      mappingStatus: plan.mappingStatus,
      layoutStatus: plan.layoutStatus,
      imageStatus: plan.imageStatus,
      readyForSpreading: plan.readyForSpreading,
    }),
    readyForSpreading: plan.readyForSpreading,
    createdAt: nowText(now),
    createdBy: '计划员-陈静',
    updatedAt: nowText(now),
    updatedBy: '计划员-陈静',
    imageRecords: plan.imageRecords.map((record, index) => ({
      ...record,
      id: `${markerNo}-image-${index + 1}`,
      fileId: `${markerNo}-image-file-${index + 1}`,
      fileName: `${markerNo}-唛架图-${index + 1}.svg`,
      uploadedAt: nowText(now),
      uploadedBy: '计划员-陈静',
    })),
    lastVisitedTab: 'basic',
  }
}

export function buildMarkerPlanBalanceRows(plan: MarkerPlan | MarkerPlanViewRow): MarkerPlanBalanceSummaryRow[] {
  if ('balanceRows' in plan && Array.isArray(plan.balanceRows)) {
    return plan.balanceRows
  }
  return buildBalanceRows(plan)
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

export function cloneMarkerPlanLayoutLine(plan: MarkerPlan, layoutId: string): MarkerLayoutLine | null {
  const source = plan.layoutLines.find((line) => line.id === layoutId)
  if (!source) return null
  return {
    ...source,
    id: `${plan.id}-layout-${plan.layoutLines.length + 1}`,
    lineNo: plan.layoutLines.length + 1,
    layoutCode: source.layoutCode ? `${source.layoutCode}-COPY` : `LAY-${plan.layoutLines.length + 1}`,
  }
}

export function cloneMarkerPlanModeDetailLine(plan: MarkerPlan, modeDetailId: string): MarkerModeDetailLine | null {
  const source = plan.modeDetailLines.find((line) => line.id === modeDetailId)
  if (!source) return null
  return {
    ...source,
    id: `${plan.id}-mode-${plan.modeDetailLines.length + 1}`,
    modeName: source.modeName ? `${source.modeName}-复制` : `模式 ${plan.modeDetailLines.length + 1}`,
  }
}

export function buildMarkerPlanGoSpreadingPath(plan: MarkerPlan): string {
  const basePath = '/fcs/craft/cutting/spreading-list'
  if (plan.contextType === 'merge-batch' && plan.mergeBatchId) {
    const params = new URLSearchParams({
      mergeBatchId: plan.mergeBatchId,
      mergeBatchNo: plan.mergeBatchNo,
    })
    return `${basePath}?${params.toString()}`
  }
  const firstOriginalCutOrderId = plan.originalCutOrderIds[0]
  const firstOriginalCutOrderNo = plan.originalCutOrderNos[0] || ''
  const params = new URLSearchParams({
    originalCutOrderId: firstOriginalCutOrderId,
    originalCutOrderNo: firstOriginalCutOrderNo,
  })
  return `${basePath}?${params.toString()}`
}

export function getMarkerPlanStorageKey(): string {
  return MARKER_PLAN_STORAGE_KEY
}

export function buildMarkerPlanContextTypeOptions() {
  return [
    { value: 'original-cut-order', label: '原始裁片单' },
    { value: 'merge-batch', label: '合并裁剪批次' },
  ] as const
}

export function buildMarkerPlanModeOptions() {
  return (Object.keys(markerPlanModeMeta) as MarkerPlanModeKey[]).map((key) => ({
    value: key,
    label: markerPlanModeMeta[key].label,
  }))
}

export function buildMarkerPlanListTabOptions() {
  return [
    { value: 'PENDING', label: '待建上下文' },
    { value: 'PLANS', label: '已建唛架' },
    { value: 'EXCEPTIONS', label: '异常待处理' },
  ] as const
}

export function getMarkerPlanReferencedWarning(plan: MarkerPlanViewRow): string {
  return plan.referenceWarningText
}

export function getMarkerPlanInitialEditTab(plan: MarkerPlanViewRow): MarkerPlanTabKey {
  return deriveMarkerPlanDefaultTab(plan)
}
