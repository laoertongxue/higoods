import type {
  CuttingTaskAssigneeType,
  CuttingTaskExecutionRoute,
} from '../../../data/fcs/cutting/cutting-task-routing.ts'

export const MARKER_PLAN_STORAGE_KEY = 'cuttingMarkerPlanLedger'
export const DEFAULT_SINGLE_SPREAD_FIXED_LOSS = 0.06

export const MARKER_SIZE_CODES = ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus'] as const
export type MarkerSizeCode = (typeof MARKER_SIZE_CODES)[number]

export type MarkerPlanModeKey = 'normal' | 'high_low' | 'fold_normal' | 'fold_high_low'
export type MarkerBedModeKey = MarkerPlanModeKey
export type MarkerPlanContextType = 'cut-order' | 'marker-plan'
export type MarkerPlanTabKey = 'basic' | 'explosion' | 'layout'

export type MarkerPlanStatusKey =
  | 'MAPPING_ISSUE'
  | 'WAITING_LAYOUT'
  | 'CANCELED'
  | 'READY_FOR_SPREADING'

export type MarkerAllocationStatusKey = 'pending' | 'balanced' | 'unbalanced'
export type MarkerMappingStatusKey = 'pending' | 'passed' | 'issue'
export type MarkerLayoutStatusKey = 'pending' | 'done'
export type MarkerImageStatusKey = 'pending' | 'done'
export type MarkerSchemeImageStatusKey = '待生成' | '已生成' | '部分生成' | '已过期'
export type MarkerSchemeSpreadingStatusKey = '未排程' | '部分排程' | '铺布中' | '已完成'
export type MarkerBedStatusKey = '草稿' | '可铺布' | '已排程' | '铺布中' | '已完成' | '已锁定'
export type MarkerDemandMatchStatusKey = '待编辑唛架' | '已匹配' | '有不足' | '有超出' | '有差异'
export type MarkerDemandMatchRowStatusKey = '已匹配' | '不足' | '超出'
export type MarkerPlanConfirmationStatusKey = '待确认' | '已确认' | '需调整'

export interface MarkerDemandMatchRow {
  rowId: string
  colorCode: string
  colorName: string
  sizeCode: string
  sizeName: string
  demandQty: number
  markerQty: number
  diffQty: number
  status: MarkerDemandMatchRowStatusKey
}

export interface MarkerDemandMatchSummary {
  status: MarkerDemandMatchStatusKey
  demandTotalQty: number
  markerTotalQty: number
  diffTotalQty: number
  shortageQty: number
  surplusQty: number
  rowCount: number
  rows: MarkerDemandMatchRow[]
}

export interface MarkerSizeRatioRow {
  sizeCode: MarkerSizeCode
  qty: number
  sortOrder: number
}

export interface MarkerAllocationRow {
  id: string
  sourceCutOrderId: string
  sourceProductionOrderId: string
  colorCode: string
  materialSku: string
  styleCode: string
  spuCode: string
  techPackSpu: string
  sizeCode: MarkerSizeCode
  garmentQty: number
  note: string
  specialFlags: string[]
}

export interface MarkerPlanAllocationLike {
  allocationId: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  styleCode: string
  spuCode: string
  techPackSpuCode?: string
  color: string
  materialSku: string
  sizeLabel: string
  plannedGarmentQty: number
  note: string
}

export interface MarkerPlanLike {
  cutOrderIds: string[]
  techPackSpuCode?: string
  spuCode: string
  sizeDistribution: Array<{
    sizeLabel: string
    quantity: number
  }>
  allocationLines: MarkerPlanAllocationLike[]
}

export interface MarkerPlanExplosionInput {
  marker: MarkerPlanLike
}

export interface MarkerLayoutLine {
  id: string
  lineNo: number
  layoutCode: string
  ratioNote: string
  colorCode: string
  repeatCount: number
  markerLength: number
  markerPieceQty: number
  systemUnitUsage: number
  spreadLength: number
  widthCode: string
  note: string
}

export interface MarkerFoldConfig {
  originalEffectiveWidth: number
  foldAllowance: number
  foldDirection: string
  foldedEffectiveWidth: number
  maxLayoutWidth: number
  widthCheckPassed: boolean
}

export interface MarkerHighLowMatrixCell {
  sectionType: string
  sectionName: string
  sizeCode: MarkerSizeCode
  qty: number
}

export interface MarkerModeDetailLine {
  id: string
  modeName: string
  colorCode: string
  repeatCount: number
  markerLength: number
  markerPieceQty: number
  systemUnitUsage: number
  spreadLength: number
  note: string
}

export interface MarkerPieceExplosionRow {
  id: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  colorCode: string
  sizeCode: string
  skuCode: string
  materialSku: string
  materialAlias?: string
  materialImageUrl?: string
  patternCode: string
  partCode: string
  partNameCn: string
  partNameId: string
  piecePerGarment: number
  garmentQty: number
  explodedPieceQty: number
  mappingStatus: string
  issueReason: string
  manualOverride?: boolean
  overrideColorMode?: 'follow-source' | 'specified'
  overrideColors?: string[]
  note?: string
}

export interface MarkerImageRecord {
  id: string
  fileId: string
  fileName: string
  previewUrl: string
  isPrimary: boolean
  note: string
  uploadedAt: string
  uploadedBy: string
}

export interface MarkerSchemeImage {
  imageId: string
  imageType: '方案图' | '唛架明细图' | '唛架图'
  imageName: string
  previewUrl: string
  generatedAt: string
  generatedBy: string
  status: MarkerSchemeImageStatusKey
}

export interface MarkerSchemeDemandRow {
  rowId: string
  sourceOrderId: string
  sourceOrderNo: string
  productionOrderNo: string
  spuCode: string
  colorCode: string
  colorName: string
  sizeCode: string
  sizeName: string
  materialSku: string
  partName: string
  demandQty: number
  plannedQty: number
  remainingQty: number
}

export interface MarkerBedCoverageRow {
  rowId: string
  colorCode: string
  colorName: string
  sizeCode: string
  sizeName: string
  demandQty: number
  plannedQty: number
  remainingQty: number
}

export interface MarkerNormalLayoutRow extends MarkerLayoutLine {}

export interface MarkerHighLowMatrixRow {
  rowId: string
  stepNo?: number
  stepLabel?: string
  colorCode: string
  colorName: string
  markerLength: number
  sizeValues: Record<string, number>
  patternValues: Record<string, number>
  totalQty: number
}

export interface MarkerSchemeBed {
  bedId: string
  schemeId: string
  schemeNo: string
  bedNo: string
  bedName: string
  bedSortOrder: number
  bedMode: MarkerBedModeKey
  colorCode: string
  colorName: string
  materialSku: string
  sizeSummaryText: string
  sizePiecePerLayer: Record<string, number>
  plannedLayerCount: number
  markerLength: number
  markerPieceQtyPerLayer: number
  plannedGarmentQty: number
  spreadTotalLength: number
  unitFabricUsage: number
  normalLayoutRows: MarkerNormalLayoutRow[]
  highLowMatrixRows: MarkerHighLowMatrixRow[]
  foldConfig: MarkerFoldConfig | null
  coverageRows: MarkerBedCoverageRow[]
  bedImage: MarkerSchemeImage | null
  spreadingSessionIds: string[]
  assignedCuttingTableIds: string[]
  status: MarkerBedStatusKey
  readyForSpreading: boolean
  lockedBySpreading: boolean
  remark: string
}

export interface MarkerScheme {
  schemeId: string
  schemeNo: string
  schemeName: string
  sourceCutOrderIds: string[]
  sourceCutOrderNos: string[]
  sourceMarkerPlanIds: string[]
  sourceMarkerPlanNos: string[]
  productionOrderIds: string[]
  productionOrderNos: string[]
  spuCode: string
  spuName: string
  styleCode: string
  techPackId: string
  techPackVersion: string
  techPackStatus: '正式版'
  materialSku: string
  materialName: string
  fabricWidth: number
  fabricWidthUnit: 'cm'
  demandRows: MarkerSchemeDemandRow[]
  beds: MarkerSchemeBed[]
  totalDemandQty: number
  totalPlannedQty: number
  remainingQty: number
  overPlannedQty: number
  bedCount: number
  normalBedCount: number
  highLowBedCount: number
  foldBedCount: number
  modeSummaryText: string
  schemeImage: MarkerSchemeImage | null
  detailImage: MarkerSchemeImage | null
  imageStatus: MarkerSchemeImageStatusKey
  spreadingStatus: MarkerSchemeSpreadingStatusKey
  status: MarkerPlanStatusKey
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface MarkerPlan {
  id: string
  markerNo: string
  markerPlanGroupKey?: string
  schemeId?: string
  schemeNo?: string
  schemeName?: string
  techPackId?: string
  techPackVersion?: string
  techPackStatus?: '正式版'
  schemeDemandRows?: MarkerSchemeDemandRow[]
  beds?: MarkerSchemeBed[]
  schemeImage?: MarkerSchemeImage | null
  detailImage?: MarkerSchemeImage | null
  schemeImageStatus?: MarkerSchemeImageStatusKey
  schemeSpreadingStatus?: MarkerSchemeSpreadingStatusKey
  status: MarkerPlanStatusKey
  markerMode: MarkerPlanModeKey
  contextType: MarkerPlanContextType
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
  productionOrderIds: string[]
  productionOrderNos: string[]
  cuttingTaskIds?: string[]
  cuttingTaskNos?: string[]
  isCrossTask?: boolean
  taskLockGroupId?: string
  taskLockStatusLabel?: string
  taskLockSummary?: string
  cuttingTaskAssigneeFactoryIds?: string[]
  cuttingTaskAssigneeFactoryNames?: string[]
  cuttingTaskAssigneeTypes?: CuttingTaskAssigneeType[]
  cuttingTaskAssignmentStatusLabels?: string[]
  executionRoute?: CuttingTaskExecutionRoute
  executionRouteLabel?: string
  voidReason?: string
  voidedAt?: string
  voidedBy?: string
  operationLogs?: Array<{
    id: string
    action: string
    detail: string
    at: string
    by: string
  }>
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
  sourceMaterialSku: string
  colorSummary: string
  totalPieces: number
  netLength: number
  systemUnitUsage: number
  manualUnitUsage: number | null
  finalUnitUsage: number
  plannedSpreadLength: number
  bindingStripReservedLength?: number
  bindingStripReservedLengthFormula?: string
  materialTotalUsageLength?: number
  materialTotalUsageLengthFormula?: string
  bindingStripWorkOrderIds?: string[]
  bindingStripRequirementSummary?: string
  plannedLayerCount: number
  imageCount: number
  allocationStatus: MarkerAllocationStatusKey
  mappingStatus: MarkerMappingStatusKey
  layoutStatus: MarkerLayoutStatusKey
  imageStatus: MarkerImageStatusKey
  confirmationStatus?: MarkerPlanConfirmationStatusKey
  confirmedBy?: string
  confirmedAt?: string
  confirmationRemark?: string
  readyForSpreading: boolean
  remark: string
  hasAdjustment: boolean
  adjustmentNote: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  singleSpreadFixedLoss: number
  sizeRatioRows: MarkerSizeRatioRow[]
  allocationRows: MarkerAllocationRow[]
  layoutLines: MarkerLayoutLine[]
  foldConfig: MarkerFoldConfig | null
  highLowMatrixCells: MarkerHighLowMatrixCell[]
  modeDetailLines: MarkerModeDetailLine[]
  pieceExplosionRows: MarkerPieceExplosionRow[]
  imageRecords: MarkerImageRecord[]
  sourceCutOrderLockRows?: MarkerPlanSourceCutOrderLockRow[]
  lastVisitedTab?: MarkerPlanTabKey
}

export interface MarkerPlanSourceCutOrderLockRow {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  styleCode: string
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  materialImageUrl: string
  patternFileId: string
  patternFileName: string
  patternVersion: string
  effectiveWidthText: string
  piecePartNames: string[]
  availableQty: number
  lockedQty: number
  unit: string
  historyCombinationGroup: string
}

export interface MarkerPlanStatusMeta<Key extends string> {
  key: Key
  label: string
  className: string
  helperText: string
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((Number(value) || 0) * factor) / factor
}

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function formatIntegerFormulaValue(value: number): string {
  return String(Math.max(Math.round(safeNumber(value)), 0))
}

function formatDecimalFormulaValue(value: number, digits: number): string {
  return roundTo(safeNumber(value), digits).toFixed(digits)
}

export interface MarkerPlanCombinationRuleSource {
  styleCode?: string | null
  spuCode?: string | null
  materialSku?: string | null
  patternKey?: string | null
  patternFileKey?: string | null
  effectiveWidth?: number | string | null
  historicalGroupKey?: string | null
}

export function normalizeMarkerPlanCombinationToken(value: string | null | undefined, fallback: string): string {
  const text = String(value || '').trim()
  if (!text) return fallback
  return text.replace(/\s+/g, '-').replace(/_+/g, '_')
}

export function normalizeMarkerPlanEffectiveWidth(value: number | string | null | undefined): string {
  const raw = String(value ?? '').trim()
  const numeric = typeof value === 'number'
    ? value
    : Number(raw.match(/\d+(?:\.\d+)?/)?.[0] || Number.NaN)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'UNKNOWN_WIDTH'
  const rounded = Math.round(numeric * 100) / 100
  return `${rounded}cm`
}

export function buildMarkerPlanCombinationGroupKey(source: MarkerPlanCombinationRuleSource): string {
  const spuKey = normalizeMarkerPlanCombinationToken(source.spuCode || source.styleCode, 'UNKNOWN_SPU')
  const patternKey = normalizeMarkerPlanCombinationToken(
    source.patternFileKey || source.patternKey,
    'UNKNOWN_PATTERN',
  )
  const widthKey = normalizeMarkerPlanEffectiveWidth(source.effectiveWidth)
  const historyKey = normalizeMarkerPlanCombinationToken(source.historicalGroupKey, 'NEW_GROUP')
  return [spuKey, patternKey, widthKey, historyKey].join('__')
}

export const markerPlanModeMeta: Record<MarkerPlanModeKey, MarkerPlanStatusMeta<MarkerPlanModeKey>> = {
  normal: {
    key: 'normal',
    label: '普通模式',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '按普通模式维护颜色、尺码和层数。',
  },
  high_low: {
    key: 'high_low',
    label: '高低层模式',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    helperText: '按高低层模式维护不同尺码列的层数。',
  },
  fold_normal: {
    key: 'fold_normal',
    label: '对折普通模式',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    helperText: '按对折普通模式维护计划层数和对折门幅。',
  },
  fold_high_low: {
    key: 'fold_high_low',
    label: '对折高低层模式',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    helperText: '按对折高低层模式维护阶梯层数。',
  },
}

export const markerPlanStatusMeta: Record<MarkerPlanStatusKey, MarkerPlanStatusMeta<MarkerPlanStatusKey>> = {
MAPPING_ISSUE: {
    key: 'MAPPING_ISSUE',
    label: '映射异常',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    helperText: '技术包、SKU、颜色或裁片映射仍有异常。',
  },
  WAITING_LAYOUT: {
    key: 'WAITING_LAYOUT',
    label: '待补唛架',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
    helperText: '唛架矩阵还没完成，不能交接铺布。',
  },
  CANCELED: {
    key: 'CANCELED',
    label: '已作废',
    className: 'bg-slate-200 text-slate-700 border border-slate-300',
    helperText: '当前唛架方案已作废，不再继续交接铺布。',
  },
  READY_FOR_SPREADING: {
    key: 'READY_FOR_SPREADING',
    label: '可交接铺布',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    helperText: '当前唛架已满足铺布交接条件。',
  },
}

export const markerAllocationStatusMeta: Record<MarkerAllocationStatusKey, MarkerPlanStatusMeta<MarkerAllocationStatusKey>> = {
  pending: {
    key: 'pending',
    label: '待配平',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '来源分配还没生成。',
  },
  balanced: {
    key: 'balanced',
    label: '已匹配',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    helperText: '各尺码来源分配与配比一致。',
  },
  unbalanced: {
    key: 'unbalanced',
    label: '未配平',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    helperText: '至少有一个尺码的来源分配与配比不一致。',
  },
}

export const markerMappingStatusMeta: Record<MarkerMappingStatusKey, MarkerPlanStatusMeta<MarkerMappingStatusKey>> = {
  pending: {
    key: 'pending',
    label: '待确认',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '还没生成裁片拆解，无法判断映射是否通过。',
  },
  passed: {
    key: 'passed',
    label: '已通过',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    helperText: '技术包、SKU、颜色和裁片映射都已通过。',
  },
  issue: {
    key: 'issue',
    label: '有异常',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    helperText: '存在技术包、SKU、颜色或裁片映射异常。',
  },
}

export const markerLayoutStatusMeta: Record<MarkerLayoutStatusKey, MarkerPlanStatusMeta<MarkerLayoutStatusKey>> = {
  pending: {
    key: 'pending',
    label: '待补唛架',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '唛架矩阵还没准备完整。',
  },
  done: {
    key: 'done',
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    helperText: '唛架矩阵已完成。',
  },
}

export const markerImageStatusMeta: Record<MarkerImageStatusKey, MarkerPlanStatusMeta<MarkerImageStatusKey>> = {
  pending: {
    key: 'pending',
    label: '待上传',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    helperText: '当前还没有方案图或唛架明细图。',
  },
  done: {
    key: 'done',
    label: '已上传',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    helperText: '方案图和唛架明细图资料已补齐。',
  },
}

export function createEmptySizeRatioRows(): MarkerSizeRatioRow[] {
  return MARKER_SIZE_CODES.map((sizeCode, index) => ({
    sizeCode,
    qty: 0,
    sortOrder: index + 1,
  }))
}

export function normalizeMarkerSizeCode(sizeCode: string | undefined): MarkerSizeCode | null {
  const normalized = String(sizeCode || '').trim()
  if (normalized === 'plusonesize') return 'onesizeplus'
  if (normalized && MARKER_SIZE_CODES.includes(normalized as MarkerSizeCode)) return normalized as MarkerSizeCode
  return null
}

export function computeMarkerPlanTotalPieces(sizeRatioRows: MarkerSizeRatioRow[]): number {
  return Array.isArray(sizeRatioRows) ? sizeRatioRows.reduce((sum, row) => sum + Math.max(safeNumber(row.qty), 0), 0) : 0
}

export function computeMarkerPlanSystemUnitUsage(netLength: number, totalPieces: number): number {
  if (safeNumber(totalPieces) <= 0) return 0
  return roundTo(safeNumber(netLength) / safeNumber(totalPieces), 3)
}

export function computeMarkerPlanSystemUnitUsageFromBeds(beds: MarkerSchemeBed[]): number {
  const weightedLength = beds.reduce(
    (sum, bed) => sum + safeNumber(bed.markerLength) * Math.max(safeNumber(bed.plannedLayerCount), 0),
    0,
  )
  const plannedGarmentQty = beds.reduce((sum, bed) => sum + Math.max(safeNumber(bed.plannedGarmentQty), 0), 0)
  if (plannedGarmentQty <= 0) return 0
  return roundTo(weightedLength / plannedGarmentQty, 3)
}

export function computeMarkerPlanFinalUnitUsage(systemUnitUsage: number, manualUnitUsage: number | null): number {
  if (manualUnitUsage === null || manualUnitUsage === undefined || Number.isNaN(Number(manualUnitUsage))) {
    return roundTo(systemUnitUsage, 3)
  }
  return roundTo(Number(manualUnitUsage), 3)
}

export function computeMarkerLayoutLineSystemUnitUsage(line: Pick<MarkerLayoutLine, 'markerLength' | 'markerPieceQty'>): number {
  if (safeNumber(line.markerPieceQty) <= 0) return 0
  return roundTo(safeNumber(line.markerLength) / safeNumber(line.markerPieceQty), 3)
}

export function computeMarkerLayoutLineSpreadLength(
  line: Pick<MarkerLayoutLine, 'markerLength' | 'repeatCount'>,
  singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
): number {
  return roundTo((safeNumber(line.markerLength) + safeNumber(singleSpreadFixedLoss)) * Math.max(safeNumber(line.repeatCount), 0), 2)
}

export function computeMarkerModeDetailSystemUnitUsage(
  line: Pick<MarkerModeDetailLine, 'markerLength' | 'markerPieceQty'>,
): number {
  if (safeNumber(line.markerPieceQty) <= 0) return 0
  return roundTo(safeNumber(line.markerLength) / safeNumber(line.markerPieceQty), 3)
}

export function computeMarkerModeDetailSpreadLength(
  line: Pick<MarkerModeDetailLine, 'markerLength' | 'repeatCount'>,
  singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
): number {
  return roundTo((safeNumber(line.markerLength) + safeNumber(singleSpreadFixedLoss)) * Math.max(safeNumber(line.repeatCount), 0), 2)
}

export function computeMarkerHighLowMatrixTotal(cells: MarkerHighLowMatrixCell[]): number {
  return cells.reduce((sum, cell) => sum + Math.max(safeNumber(cell.qty), 0), 0)
}

export function computeMarkerFoldedEffectiveWidth(config: Pick<MarkerFoldConfig, 'originalEffectiveWidth' | 'foldAllowance'>): number {
  return roundTo((safeNumber(config.originalEffectiveWidth) - safeNumber(config.foldAllowance)) / 2, 2)
}

export function computeMarkerFoldWidthCheckPassed(config: Pick<MarkerFoldConfig, 'foldedEffectiveWidth' | 'maxLayoutWidth'>): boolean {
  return safeNumber(config.maxLayoutWidth) <= safeNumber(config.foldedEffectiveWidth)
}

export function computeMarkerAllocationSumBySize(allocationRows: MarkerAllocationRow[]): Record<MarkerSizeCode, number> {
  const summary = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0])) as Record<MarkerSizeCode, number>
  allocationRows.forEach((row) => {
    summary[row.sizeCode] += Math.max(safeNumber(row.garmentQty), 0)
  })
  return summary
}

export function computeMarkerAllocationDiffBySize(
  sizeRatioRows: MarkerSizeRatioRow[],
  allocationRows: MarkerAllocationRow[],
): Record<MarkerSizeCode, number> {
  const ratioMap = Object.fromEntries(
    createEmptySizeRatioRows().map((row) => [row.sizeCode, 0]),
  ) as Record<MarkerSizeCode, number>
  sizeRatioRows.forEach((row) => {
    ratioMap[row.sizeCode] = Math.max(safeNumber(row.qty), 0)
  })
  const allocationMap = computeMarkerAllocationSumBySize(allocationRows)
  return Object.fromEntries(
    MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, allocationMap[sizeCode] - ratioMap[sizeCode]]),
  ) as Record<MarkerSizeCode, number>
}

export function computeMarkerExplodedPieceQty(piecePerGarment: number, garmentQty: number): number {
  return Math.max(safeNumber(piecePerGarment), 0) * Math.max(safeNumber(garmentQty), 0)
}

export function computeMarkerPlannedSpreadLength(
  plan: Pick<MarkerPlan, 'markerMode' | 'layoutLines' | 'modeDetailLines' | 'singleSpreadFixedLoss'> & Partial<Pick<MarkerPlan, 'beds'>>,
): number {
  if ('beds' in plan && Array.isArray(plan.beds) && plan.beds.length) {
    return roundTo(plan.beds.reduce((sum, bed) => sum + safeNumber(bed.spreadTotalLength), 0), 2)
  }
  if (plan.markerMode === 'normal' || plan.markerMode === 'fold_normal') {
    return roundTo(
      plan.layoutLines.reduce(
        (sum, line) => sum + computeMarkerLayoutLineSpreadLength(line, plan.singleSpreadFixedLoss),
        0,
      ),
      2,
    )
  }
  return roundTo(
    plan.modeDetailLines.reduce(
      (sum, line) => sum + computeMarkerModeDetailSpreadLength(line, plan.singleSpreadFixedLoss),
      0,
    ),
    2,
  )
}

export function deriveMarkerAllocationStatus(
  sizeRatioRows: MarkerSizeRatioRow[],
  allocationRows: MarkerAllocationRow[],
): MarkerAllocationStatusKey {
  if (!allocationRows.length) return 'pending'
  const diffMap = computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows)
  return Object.values(diffMap).every((diff) => diff === 0) ? 'balanced' : 'unbalanced'
}

export function deriveMarkerMappingStatus(pieceRows: MarkerPieceExplosionRow[]): MarkerMappingStatusKey {
  if (!pieceRows.length) return 'pending'
  return pieceRows.some((row) => row.mappingStatus !== 'MATCHED') ? 'issue' : 'passed'
}

export function deriveMarkerLayoutStatus(
  plan: Pick<MarkerPlan, 'markerMode' | 'layoutLines' | 'modeDetailLines' | 'foldConfig'> & Partial<Pick<MarkerPlan, 'beds'>>,
): MarkerLayoutStatusKey {
  if (Array.isArray(plan.beds) && plan.beds.length) {
    const hasReadyBeds = plan.beds.every((bed) => bed.readyForSpreading)
    if (!hasReadyBeds) return 'pending'
    if ((plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low') && !plan.foldConfig?.widthCheckPassed) {
      return 'pending'
    }
    return 'done'
  }
  const hasLayout =
    plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
      ? plan.layoutLines.some((line) => safeNumber(line.markerLength) > 0 && safeNumber(line.repeatCount) > 0 && safeNumber(line.markerPieceQty) > 0)
      : plan.modeDetailLines.some((line) => safeNumber(line.markerLength) > 0 && safeNumber(line.repeatCount) > 0 && safeNumber(line.markerPieceQty) > 0)

  if (!hasLayout) return 'pending'
  if ((plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low') && !plan.foldConfig?.widthCheckPassed) {
    return 'pending'
  }
  return 'done'
}

export function deriveMarkerImageStatus(imageCount: number): MarkerImageStatusKey {
  return imageCount > 0 ? 'done' : 'pending'
}

export function deriveMarkerReadyForSpreading(plan: Partial<Pick<MarkerPlan, 'confirmationStatus'>>): boolean {
  return plan.confirmationStatus === '已确认'
}

export function deriveMarkerPlanStatus(
  plan: Partial<Pick<MarkerPlan, 'mappingStatus' | 'layoutStatus' | 'confirmationStatus'>>,
): MarkerPlanStatusKey {
  if (plan.mappingStatus === 'issue') return 'MAPPING_ISSUE'
  if (plan.layoutStatus !== 'done') return 'WAITING_LAYOUT'
  if (plan.confirmationStatus === '已确认') return 'READY_FOR_SPREADING'
  return 'WAITING_LAYOUT'
}

export function deriveMarkerPlanDefaultTab(plan: Pick<MarkerPlan, 'mappingStatus' | 'layoutStatus' | 'lastVisitedTab'>): MarkerPlanTabKey {
  if (plan.lastVisitedTab === 'basic' || plan.lastVisitedTab === 'explosion' || plan.lastVisitedTab === 'layout') return plan.lastVisitedTab
  if (plan.mappingStatus === 'issue') return 'explosion'
  if (plan.layoutStatus !== 'done') return 'layout'
  return 'layout'
}

export function buildMarkerTotalPiecesFormula(sizeRatioRows: MarkerSizeRatioRow[]): string {
  const rows = Array.isArray(sizeRatioRows) ? sizeRatioRows : []
  const terms = rows.map((row) => `${formatIntegerFormulaValue(row.qty)} 件`)
  return `${formatIntegerFormulaValue(computeMarkerPlanTotalPieces(rows))} 件 = ${terms.length ? terms.join(' + ') : '0 件'}`
}

export function buildMarkerSystemUnitUsageFormula(netLength: number, totalPieces: number): string {
  return `${formatDecimalFormulaValue(computeMarkerPlanSystemUnitUsage(netLength, totalPieces), 3)} m/件 = ${formatDecimalFormulaValue(netLength, 2)} m ÷ ${formatIntegerFormulaValue(totalPieces)} 件`
}

export function buildMarkerPlanSystemUnitUsageFormula(
  plan: Pick<MarkerPlan, 'netLength' | 'totalPieces'> & Partial<Pick<MarkerPlan, 'beds'>>,
): string {
  if (Array.isArray(plan.beds) && plan.beds.length) {
    const readyBeds = plan.beds.filter(
      (bed) => safeNumber(bed.markerLength) > 0 && safeNumber(bed.plannedLayerCount) > 0 && safeNumber(bed.plannedGarmentQty) > 0,
    )
    const plannedGarmentQty = readyBeds.reduce((sum, bed) => sum + Math.max(safeNumber(bed.plannedGarmentQty), 0), 0)
    const terms = readyBeds.length
      ? readyBeds.map(
          (bed) =>
            `${formatDecimalFormulaValue(bed.markerLength, 2)} m × ${formatIntegerFormulaValue(bed.plannedLayerCount)} 层（${bed.bedNo}）`,
        )
      : ['0.00 m']
    return `${formatDecimalFormulaValue(computeMarkerPlanSystemUnitUsageFromBeds(readyBeds), 3)} m/件 = (${terms.join(' + ')}) ÷ ${formatIntegerFormulaValue(plannedGarmentQty || plan.totalPieces)} 件`
  }
  return buildMarkerSystemUnitUsageFormula(plan.netLength, plan.totalPieces)
}

export function buildMarkerFinalUnitUsageFormula(systemUnitUsage: number, manualUnitUsage: number | null): string {
  const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, manualUnitUsage)
  return manualUnitUsage == null
    ? `${formatDecimalFormulaValue(finalUnitUsage, 3)} m/件 = ${formatDecimalFormulaValue(systemUnitUsage, 3)} m/件`
    : `${formatDecimalFormulaValue(finalUnitUsage, 3)} m/件 = ${formatDecimalFormulaValue(manualUnitUsage, 3)} m/件`
}

export function buildMarkerAllocationSumFormula(sizeCode: MarkerSizeCode, allocationRows: MarkerAllocationRow[]): string {
  const matchedRows = allocationRows.filter((row) => row.sizeCode === sizeCode)
  const terms = matchedRows.length
    ? matchedRows.map((row) => `${formatIntegerFormulaValue(row.garmentQty)} 件`)
    : ['0 件']
  return `${formatIntegerFormulaValue(computeMarkerAllocationSumBySize(allocationRows)[sizeCode])} 件 = ${terms.join(' + ')}`
}

export function buildMarkerAllocationDiffFormula(
  sizeCode: MarkerSizeCode,
  sizeRatioRows: MarkerSizeRatioRow[],
  allocationRows: MarkerAllocationRow[],
): string {
  const ratioQty = sizeRatioRows.find((row) => row.sizeCode === sizeCode)?.qty || 0
  const allocationQty = computeMarkerAllocationSumBySize(allocationRows)[sizeCode]
  const diffQty = computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows)[sizeCode]
  const diffText = diffQty >= 0 ? formatIntegerFormulaValue(diffQty) : `-${formatIntegerFormulaValue(Math.abs(diffQty))}`
  return `${diffText} 件 = ${formatIntegerFormulaValue(allocationQty)} 件 - ${formatIntegerFormulaValue(ratioQty)} 件`
}

export function buildMarkerExplodedPieceQtyFormula(piecePerGarment: number, garmentQty: number): string {
  return `${formatIntegerFormulaValue(computeMarkerExplodedPieceQty(piecePerGarment, garmentQty))} 片 = ${formatIntegerFormulaValue(piecePerGarment)} 片/件 × ${formatIntegerFormulaValue(garmentQty)} 件`
}

export function buildMarkerSkuExplodedPieceQtyFormula(rows: Array<Pick<MarkerPieceExplosionRow, 'explodedPieceQty'>>): string {
  const total = rows.reduce((sum, row) => sum + Math.max(safeNumber(row.explodedPieceQty), 0), 0)
  const terms = rows.length ? rows.map((row) => `${formatIntegerFormulaValue(row.explodedPieceQty)} 片`) : ['0 片']
  return `${formatIntegerFormulaValue(total)} 片 = ${terms.join(' + ')}`
}

export function buildMarkerLayoutLineSystemUnitUsageFormula(line: Pick<MarkerLayoutLine, 'markerLength' | 'markerPieceQty'>): string {
  return `${formatDecimalFormulaValue(computeMarkerLayoutLineSystemUnitUsage(line), 3)} m/件 = ${formatDecimalFormulaValue(line.markerLength, 2)} m ÷ ${formatIntegerFormulaValue(line.markerPieceQty)} 件`
}

export function buildMarkerLayoutLineSpreadLengthFormula(
  line: Pick<MarkerLayoutLine, 'markerLength' | 'repeatCount'>,
  singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
): string {
  return `${formatDecimalFormulaValue(computeMarkerLayoutLineSpreadLength(line, singleSpreadFixedLoss), 2)} m = (${formatDecimalFormulaValue(line.markerLength, 2)} m + ${formatDecimalFormulaValue(singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(line.repeatCount)}`
}

export function buildMarkerModeDetailSystemUnitUsageFormula(
  line: Pick<MarkerModeDetailLine, 'markerLength' | 'markerPieceQty'>,
): string {
  return `${formatDecimalFormulaValue(computeMarkerModeDetailSystemUnitUsage(line), 3)} m/件 = ${formatDecimalFormulaValue(line.markerLength, 2)} m ÷ ${formatIntegerFormulaValue(line.markerPieceQty)} 件`
}

export function buildMarkerModeDetailSpreadLengthFormula(
  line: Pick<MarkerModeDetailLine, 'markerLength' | 'repeatCount'>,
  singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS,
): string {
  return `${formatDecimalFormulaValue(computeMarkerModeDetailSpreadLength(line, singleSpreadFixedLoss), 2)} m = (${formatDecimalFormulaValue(line.markerLength, 2)} m + ${formatDecimalFormulaValue(singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(line.repeatCount)}`
}

export function buildMarkerHighLowMatrixTotalFormula(cells: MarkerHighLowMatrixCell[]): string {
  const terms = cells.length ? cells.map((cell) => `${formatIntegerFormulaValue(cell.qty)} 件`) : ['0 件']
  return `${formatIntegerFormulaValue(computeMarkerHighLowMatrixTotal(cells))} 件 = ${terms.join(' + ')}`
}

export function buildMarkerFoldedEffectiveWidthFormula(config: Pick<MarkerFoldConfig, 'originalEffectiveWidth' | 'foldAllowance'>): string {
  return `${formatDecimalFormulaValue(computeMarkerFoldedEffectiveWidth(config), 2)} cm = (${formatDecimalFormulaValue(config.originalEffectiveWidth, 2)} cm - ${formatDecimalFormulaValue(config.foldAllowance, 2)} cm) ÷ 2`
}

export function buildMarkerPlannedSpreadLengthFormula(
  plan: Pick<MarkerPlan, 'markerMode' | 'layoutLines' | 'modeDetailLines' | 'singleSpreadFixedLoss'> & Partial<Pick<MarkerPlan, 'beds'>>,
): string {
  if (Array.isArray(plan.beds) && plan.beds.length) {
    const terms = plan.beds.map(
      (bed) =>
        `(${formatDecimalFormulaValue(bed.markerLength, 2)} m + ${formatDecimalFormulaValue(plan.singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(bed.plannedLayerCount)} 层（${bed.bedNo}）`,
    )
    return `${formatDecimalFormulaValue(computeMarkerPlannedSpreadLength(plan as MarkerPlan), 2)} m = ${terms.join(' + ')}`
  }
  const lineValues =
    plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
      ? plan.layoutLines.map((line) => computeMarkerLayoutLineSpreadLength(line, plan.singleSpreadFixedLoss))
      : plan.modeDetailLines.map((line) => computeMarkerModeDetailSpreadLength(line, plan.singleSpreadFixedLoss))
  const terms = lineValues.length ? lineValues.map((value) => `${formatDecimalFormulaValue(value, 2)} m`) : ['0.00 m']
  return `${formatDecimalFormulaValue(computeMarkerPlannedSpreadLength(plan as MarkerPlan), 2)} m = ${terms.join(' + ')}`
}
