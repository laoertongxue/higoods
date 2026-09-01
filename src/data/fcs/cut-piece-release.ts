import {
  appendMatrixEvent,
  buildReleaseMatrix,
  buildTargetPreview,
  createMatrixEventState,
  type BuildReleaseMatrixInput,
  type CutPieceFact,
  type CutPieceRequirement,
  type CutPieceReleaseMatrix,
  type MatrixEvent,
  type MatrixEventState,
  type MatrixEventType,
  type MatrixTargetStatus,
  type ReleaseTargetPreview,
  type ReleaseSourceStatus,
  type SupplementPartShortage,
} from './cut-piece-release-domain.ts'
import { listEffectiveTaskAssignments } from './effective-task-assignments.ts'

export type CutPieceReleaseDecision = '待判断' | '可以做' | '部分可以做' | '暂时不能做'

export interface CutPieceReleaseSkuLine {
  lineId: string
  skuCode: string
  colorName: string
  sizeCode: string
  demandQty: number
  remainingQty: number
  cutCompletedQty: number
  completeKitQty: number
  accessoryReadyQty: number
  releaseQty: number
  releaseConfirmQty: number
  riskReleaseQty: number
  reason: string
}

export interface CutPieceReleaseRecord {
  recordId: string
  recordNo: string
  productionOrderId: string
  productionOrderNo: string
  taskId: string
  taskNo: string
  spuCode: string
  spuName: string
  styleImageUrl?: string
  triggerCutOrderNo: string
  sourceCutOrderNos: string[]
  triggerAction: string
  triggerAt: string
  triggerOperator: string
  checkerRole: string
  decision: CutPieceReleaseDecision
  releaseQty: number
  releaseConfirmQty: number
  reason: string
  riskNote: string
  judgedBy: string
  judgedAt: string
  skuLines: CutPieceReleaseSkuLine[]
  matrixStatus: CutPieceReleaseMatrix['calculationStatus']
  targetStatus: MatrixTargetStatus
  frozenCutOrderCount: number
  shortageCellCount: number
  latestUpdateAt: string
  lateEventCount: number
  sourceStates: CutPieceReleaseSourceState[]
  matrix: CutPieceReleaseMatrix
  releaseAvailableStatus: CutPieceReleaseAvailableStatus
  latestReleaseVersion: number
  riskReleaseQty: number
  totalTargetQty: number
}

export interface CutPieceReleaseSourceState {
  cutOrderId: string
  cutOrderNo: string
  status: '已冻结' | '持续更新'
  changedAt: string
  operator: string
  reason: string
  materialIds: string[]
}

export interface CutOrderReleaseImpactCell {
  garmentColor: string
  size: string
  materialId: string
  materialName: string
  availableGarmentQty: number | null
}

export interface CutOrderReleaseImpactSummary {
  cutOrderId: string
  cutOrderNo: string
  affectedCells: CutOrderReleaseImpactCell[]
  activeSpreadingOrderNos: string[]
}

export interface LateCutPieceReleaseFactSummary {
  garmentColor: string
  size: string
  materialId: string
  actualPieceQty: number
}

export interface LateCutPieceReleaseEvent {
  eventId: string
  productionOrderId: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderNo: string
  arrivedAt: string
  reason: string
  facts: LateCutPieceReleaseFactSummary[]
  status: '待处理' | '已处理'
}

export interface CutPieceReleaseSummary {
  recordId: string
  recordNo: string
  productionOrderId: string
  productionOrderNo: string
  decision: CutPieceReleaseDecision
  releaseQty: number
  reason: string
  riskNote: string
  judgedBy: string
  judgedAt: string
  matrixStatus: CutPieceReleaseMatrix['calculationStatus']
  targetStatus: MatrixTargetStatus
  currentCompleteKitQtyByColorSize: Record<string, number | null>
  targetQtyByColorSize: Record<string, number>
  shortageCellCount: number
  latestMatrixVersion: number
  latestUpdatedAt: string
  ppicAvailableDispatchQty: number
  totalReleaseConfirmQty: number
  totalRiskReleaseQty: number
  riskReason: string
  releaseAvailableStatus: CutPieceReleaseAvailableStatus | null
  totalTargetQty: number
  latestReleaseVersion: number | null
}

export type CutPieceDispatchReadinessStatus = '已满足' | '齐套不足' | '部分放行' | '风险放行' | '待维护目标' | '待同步'

export interface CutPieceDispatchReadinessSkuLine {
  skuCode: string
  color: string
  size: string
  taskQty: number
  targetQty: number | null
  completeKitQty: number | null
  releaseConfirmQty: number | null
  riskReleaseQty: number | null
  allocatedQty: number
  availableQty: number | null
  allocationTaskIds: string[]
  dispatchAllowed: boolean
  status: CutPieceDispatchReadinessStatus
  reason: string
}

export interface CutPieceDispatchReadiness {
  productionOrderId: string
  productionOrderNo: string
  hasRecord: boolean
  recordNo: string
  targetStatus: MatrixTargetStatus | '待同步'
  releaseAvailableStatus: CutPieceReleaseAvailableStatus | '待同步'
  latestUpdatedAt: string
  lines: CutPieceDispatchReadinessSkuLine[]
  warningCount: number
  blockingCount: number
  canDispatch: boolean
}

export type CutPieceReleaseAvailableStatus =
  | '待维护目标'
  | '待裁床确认'
  | '按齐套放行'
  | '风险放行'
  | '暂不放行'
  | '确认后需复核'

export interface CutPieceReleaseAvailableQtyVersion {
  releaseVersionId: string
  releaseVersionNo: number
  productionOrderId: string
  basisMatrixVersion: number
  basisTargetVersion: number
  releaseQtyByColorSize: Record<string, number>
  riskReleaseQtyByColorSize: Record<string, number>
  targetGapQtyByColorSize: Record<string, number>
  releaseGapToTargetQtyByColorSize: Record<string, number>
  surplusKitQtyByColorSize: Record<string, number>
  totalTargetQty: number
  totalCompleteKitQty: number
  totalReleaseConfirmQty: number
  totalRiskReleaseQty: number
  totalReleaseGapToTargetQty: number
  riskReason: string
  confirmedBy: string
  confirmedAt: string
  isLatestEffective: boolean
  releaseStatus: CutPieceReleaseAvailableStatus
  beforeTotalReleaseConfirmQty: number
  afterTotalReleaseConfirmQty: number
  beforeTotalRiskReleaseQty: number
  afterTotalRiskReleaseQty: number
  changedColorSizeLines: string[]
}

export interface ConfirmCutPieceReleaseAvailableQtyInput {
  productionOrderId: string
  basisMatrixVersion: number
  basisTargetVersion: number
  releaseQtyByColorSize: Record<string, number>
  riskReason: string
  confirmedBy: string
  confirmedAt: string
}

export interface ConfirmCutPieceReleaseAvailableQtyResult {
  ok: boolean
  message: string
  version: CutPieceReleaseAvailableQtyVersion | null
}

export interface SaveCutPieceReleaseDecisionInput {
  recordId: string
  decision: CutPieceReleaseDecision
  skuReleaseQuantities: Array<{ lineId: string; releaseQty: number }>
  reason: string
  riskNote: string
  judgedBy: string
}

export interface CutPieceReleaseMatrixVersion {
  version: number
  productionOrderId: string
  eventId: string
  eventType: MatrixEventType
  occurredAt: string
  operator: string
  reason?: string
  cutOrderId?: string
  cutOrderNo?: string
  sourceCutOrderNos: string[]
  spreadingOrderNo?: string
  matrixSnapshot: CutPieceReleaseMatrix
}

export interface CutPieceReleaseHistoryQuantityValue {
  exists: boolean
  quantity: number | null
}

export interface CutPieceReleaseHistoryQuantityChange {
  garmentColor: string
  size: string
  before: CutPieceReleaseHistoryQuantityValue
  after: CutPieceReleaseHistoryQuantityValue
  delta: number | null
}

export interface CutPieceReleaseHistoryMaterialChange extends CutPieceReleaseHistoryQuantityChange {
  materialId: string
  materialName: string
}

export interface CutPieceReleaseHistoryDifference {
  affectedColors: string[]
  completeKitChanges: CutPieceReleaseHistoryQuantityChange[]
  materialChanges: CutPieceReleaseHistoryMaterialChange[]
}

export interface CutPieceReleaseFactSourceSummary {
  cutOrderNos: string[]
  spreadingOrderNos: string[]
}

export interface CutPieceReleaseTargetSnapshot {
  snapshotId: string
  productionOrderId: string
  matrixVersion: number
  confirmedAt: string
  confirmedBy: string
  matrixSnapshot: CutPieceReleaseMatrix
  targetPreview: ReleaseTargetPreview
}

export interface ConfirmReleaseTargetInput {
  productionOrderId: string
  matrixVersion: number
  colorSizeTargets: Record<string, number>
  confirmedBy: string
}

export interface ConfirmReleaseTargetResult {
  ok: boolean
  message: string
  snapshot: CutPieceReleaseTargetSnapshot | null
}

export interface CutOrderReleaseStatusChangeInput {
  eventId: string
  cutOrderId: string
  cutOrderNo: string
  status: '已冻结' | '持续更新'
  occurredAt: string
  operator: string
  reason: string
}

export interface SpreadingReleaseAdjustmentInput {
  adjustmentEventId: string
  spreadingOrderNo: string
  productionOrderId: string
  direction: -1
  occurredAt: string
  operator: string
  reason: string
  sourceCutOrderIds?: string[]
  sourceCutOrderNos?: string[]
}

export interface SpreadingReleaseAdjustmentResult {
  status: 'applied' | 'idempotent' | 'rejected' | 'not-applicable'
  reason: string
}

interface ReleaseRepositoryItem {
  input: BuildReleaseMatrixInput
  spuName: string
  sourceCutOrderNos: string[]
  eventState: MatrixEventState
  currentMatrix: CutPieceReleaseMatrix
  targetStatus: MatrixTargetStatus
  versions: CutPieceReleaseMatrixVersion[]
  latestSnapshotId: string | null
  latestUpdateAt: string
  sourceStates: CutPieceReleaseSourceState[]
  activeSpreadingOrderNosByCutOrder: Record<string, string[]>
  spreadingAdjustmentKeys: Set<string>
}

const deterministicConfirmedAt = '2026-06-03 17:00:00'
const targetSnapshots = new Map<string, CutPieceReleaseTargetSnapshot>()
const releaseRepository = new Map<string, ReleaseRepositoryItem>()
const lateEvents = new Map<string, LateCutPieceReleaseEvent>()
const releaseVersionRepository = new Map<string, CutPieceReleaseAvailableQtyVersion[]>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function safeQuantity(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function safeInteger(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

function targetKey(garmentColor: string, size: string): string {
  return `${garmentColor}::${size}`
}

function rebuildMatrix(item: ReleaseRepositoryItem): CutPieceReleaseMatrix {
  const matrix = buildReleaseMatrix({
    ...item.input,
    requirements: clone(item.input.requirements),
    facts: clone(item.input.facts),
    planQtyByColorSize: clone(item.input.planQtyByColorSize),
  })
  matrix.targetStatus = item.targetStatus
  item.currentMatrix = matrix
  return matrix
}

function addVersion(item: ReleaseRepositoryItem, event: MatrixEvent): void {
  const matrixSnapshot = clone(rebuildMatrix(item))
  const adjustmentEventSuffix = `:adjust:${event.eventId}`
  const sourceCutOrderNos = [...new Set(item.input.facts
    .filter((fact) => fact.sourceEventId === event.eventId || fact.sourceEventId.endsWith(adjustmentEventSuffix))
    .map((fact) => fact.cutOrderNo)
    .filter((cutOrderNo): cutOrderNo is string => Boolean(cutOrderNo)))]
  if (!sourceCutOrderNos.length && event.cutOrderNo) sourceCutOrderNos.push(event.cutOrderNo)
  item.versions.push({
    version: item.versions.length + 1,
    productionOrderId: item.input.productionOrderId,
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    operator: event.operator,
    reason: event.reason,
    cutOrderId: event.cutOrderId,
    cutOrderNo: event.cutOrderNo,
    sourceCutOrderNos,
    spreadingOrderNo: event.spreadingOrderNo,
    matrixSnapshot,
  })
  item.latestUpdateAt = event.occurredAt
}

function appendRepositoryEvent(item: ReleaseRepositoryItem, event: MatrixEvent, change: () => void): boolean {
  if (!appendMatrixEvent(item.eventState, event)) return false
  change()
  if (item.latestSnapshotId && event.eventType !== '目标确认') item.targetStatus = '目标后数据已变化'
  const versions = releaseVersionRepository.get(item.input.productionOrderId)
  versions?.forEach((v) => {
    if (v.isLatestEffective && v.releaseStatus !== '确认后需复核') {
      v.releaseStatus = '确认后需复核'
    }
  })
  addVersion(item, event)
  return true
}

function getTargetSnapshot(item: ReleaseRepositoryItem): CutPieceReleaseTargetSnapshot | null {
  return item.latestSnapshotId ? targetSnapshots.get(item.latestSnapshotId) ?? null : null
}

function targetPreviewForCurrentMatrix(item: ReleaseRepositoryItem): ReleaseTargetPreview | null {
  const snapshot = getTargetSnapshot(item)
  if (!snapshot) return null
  try {
    return buildTargetPreview(item.currentMatrix, snapshot.targetPreview.colorSizeTargets)
  } catch {
    return null
  }
}

function deriveReleaseAvailableStatus(item: ReleaseRepositoryItem): CutPieceReleaseAvailableStatus {
  const snapshot = getTargetSnapshot(item)
  if (!snapshot) return '待维护目标'
  return '待裁床确认'
}

function getLatestEffectiveVersion(productionOrderId: string): CutPieceReleaseAvailableQtyVersion | null {
  const versions = releaseVersionRepository.get(productionOrderId)
  return versions?.find((v) => v.isLatestEffective) ?? null
}

function buildSkuLines(item: ReleaseRepositoryItem): CutPieceReleaseSkuLine[] {
  const snapshot = getTargetSnapshot(item)
  const targetValues = item.targetStatus === '已确认' ? snapshot?.targetPreview.colorSizeTargets ?? {} : {}
  const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
  return item.currentMatrix.colorGroups.flatMap((group) => group.sizes.map((size) => {
    const completeKitQty = safeQuantity(group.completeKitBySize[size])
    const demandQty = safeQuantity(group.planQtyBySize[size])
    const releaseQty = safeQuantity(targetValues[targetKey(group.garmentColor, size)])
    return {
      lineId: `${item.input.productionOrderId}:${group.garmentColor}:${size}`,
      skuCode: `${item.input.spuCode}-${group.garmentColor}-${size}`,
      colorName: group.garmentColor,
      sizeCode: size,
      demandQty,
      remainingQty: demandQty,
      cutCompletedQty: completeKitQty,
      completeKitQty,
      accessoryReadyQty: completeKitQty,
      releaseQty,
      releaseConfirmQty: safeInteger(latestVersion?.releaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0),
      riskReleaseQty: safeInteger(latestVersion?.riskReleaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0),
      reason: releaseQty > 0 ? '已按当前矩阵确认目标数量' : '等待基于矩阵确认目标数量',
    }
  }))
}

function buildReleaseRecord(item: ReleaseRepositoryItem): CutPieceReleaseRecord {
  const snapshot = getTargetSnapshot(item)
  const skuLines = buildSkuLines(item)
  const preview = targetPreviewForCurrentMatrix(item)
  const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
  const frozenCutOrderCount = new Set(item.input.facts
    .filter((fact) => fact.sourceStatus === '已冻结')
    .map((fact) => fact.cutOrderId || fact.cutOrderNo)
    .filter(Boolean)).size
  const targetConfirmed = item.targetStatus === '已确认' && Boolean(snapshot)
  const releaseQty = skuLines.reduce((sum, line) => sum + line.releaseQty, 0)
  const totalTargetQty = Object.values(snapshot?.targetPreview.colorSizeTargets ?? {}).reduce((sum, value) => sum + safeInteger(value), 0)
  const releaseStatus = latestVersion?.releaseStatus ?? deriveReleaseAvailableStatus(item)
  return {
    recordId: `cpr-${item.input.productionOrderId}`,
    recordNo: `CPR-${item.input.productionOrderNo.replace(/^PO-?/, '')}`,
    productionOrderId: item.input.productionOrderId,
    productionOrderNo: item.input.productionOrderNo,
    taskId: `cut-release-${item.input.productionOrderId}`,
    taskNo: `CUT-RELEASE-${item.input.productionOrderNo.replace(/^PO/, '')}`,
    spuCode: item.input.spuCode,
    spuName: item.spuName,
    triggerCutOrderNo: item.sourceCutOrderNos[0] || '未关联裁片单',
    sourceCutOrderNos: [...item.sourceCutOrderNos],
    triggerAction: '铺布完成裁剪',
    triggerAt: item.latestUpdateAt,
    triggerOperator: '裁床系统',
    checkerRole: '裁床主管',
    decision: releaseStatus === '按齐套放行' ? '可以做'
      : releaseStatus === '风险放行' ? '部分可以做'
      : releaseStatus === '暂不放行' ? '暂时不能做'
      : '待判断',
    releaseQty,
    releaseConfirmQty: safeInteger(latestVersion?.totalReleaseConfirmQty ?? 0),
    reason: targetConfirmed ? '已按生产单裁片矩阵确认目标数量。' : '等待裁床主管按当前裁片矩阵确认目标数量。',
    riskNote: item.targetStatus === '目标后数据已变化' ? '目标确认后已有新的裁片事实，请重新核对。' : '',
    judgedBy: targetConfirmed ? snapshot!.confirmedBy : '',
    judgedAt: targetConfirmed ? snapshot!.confirmedAt : '',
    skuLines,
    matrixStatus: item.currentMatrix.calculationStatus,
    targetStatus: item.targetStatus,
    frozenCutOrderCount,
    shortageCellCount: preview?.differences.filter((item) => item.status === '需补').length ?? 0,
    latestUpdateAt: item.latestUpdateAt,
    lateEventCount: listLateCutPieceReleaseEvents(item.input.productionOrderId).filter((event) => event.status === '待处理').length,
    sourceStates: clone(item.sourceStates),
    matrix: clone(item.currentMatrix),
    releaseAvailableStatus: releaseStatus,
    latestReleaseVersion: latestVersion?.releaseVersionNo ?? 0,
    riskReleaseQty: safeInteger(latestVersion?.totalRiskReleaseQty ?? 0),
    totalTargetQty: safeInteger(latestVersion?.totalTargetQty ?? totalTargetQty),
  }
}

function addRepositoryItem(input: BuildReleaseMatrixInput, spuName: string, sourceCutOrderNos: string[], initialEvent: MatrixEvent): void {
  const item: ReleaseRepositoryItem = {
    input: clone(input),
    spuName,
    sourceCutOrderNos: [...sourceCutOrderNos],
    eventState: createMatrixEventState(),
    currentMatrix: buildReleaseMatrix(input),
    targetStatus: '待确认',
    versions: [],
    latestSnapshotId: null,
    latestUpdateAt: initialEvent.occurredAt,
    sourceStates: [],
    activeSpreadingOrderNosByCutOrder: {},
    spreadingAdjustmentKeys: new Set<string>(),
  }
  appendMatrixEvent(item.eventState, initialEvent)
  addVersion(item, initialEvent)
  releaseRepository.set(input.productionOrderId, item)
}

function bootstrapRepository(): void {
  const productionOrderId = 'po-14671'
  const sizes = ['M', 'L', 'XL'] as const
  type Size = (typeof sizes)[number]
  type SizeQuantities = Record<Size, number>
  type BatchQuantities = Partial<Record<'A' | 'B' | 'C' | 'D', SizeQuantities>>
  interface BootstrapSpreadingEvent {
    eventId: string
    garmentColor: 'Black' | 'White' | 'Navy' | 'Red'
    cutOrderId: string
    cutOrderNo: string
    spreadingOrderNo: string
    occurredAt: string
    operator: string
    reason: string
    quantities: BatchQuantities
  }
  const requirements = [
    { materialId: 'A', materialName: '面料 A', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'B', materialName: '里料 B', partId: 'front', partName: '前片', piecesPerGarment: 2 },
    { materialId: 'C', materialName: '辅料 C', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
    { materialId: 'D', materialName: '辅料 D', partId: 'cuff', partName: '袖口', piecesPerGarment: 1 },
  ]
  const spreadingEvents: BootstrapSpreadingEvent[] = [
    {
      eventId: 'spread-14671-black-01', garmentColor: 'Black', cutOrderId: 'cut-14671-a', cutOrderNo: 'CUT14671-A', spreadingOrderNo: 'PB-14671-BLACK-01',
      occurredAt: '2026-06-03 08:00:00', operator: '铺布操作员 Adi', reason: 'Black 首次铺布完成裁剪，形成首版候选矩阵。',
      quantities: { A: { M: 120, L: 200, XL: 280 }, B: { M: 200, L: 350, XL: 500 }, C: { M: 120, L: 200, XL: 280 }, D: { M: 120, L: 200, XL: 280 } },
    },
    {
      eventId: 'spread-14671-white-01', garmentColor: 'White', cutOrderId: 'cut-14671-white-01', cutOrderNo: 'CUT14671-WHITE-01', spreadingOrderNo: 'PB-14671-WHITE-01',
      occurredAt: '2026-06-03 09:00:00', operator: '铺布操作员 Budi', reason: 'White 首次铺布完成裁剪，开始累计 White 裁片事实。',
      quantities: { A: { M: 100, L: 150, XL: 180 }, B: { M: 180, L: 270, XL: 330 }, C: { M: 100, L: 150, XL: 180 }, D: { M: 100, L: 150, XL: 180 } },
    },
    {
      eventId: 'spread-14671-navy-01', garmentColor: 'Navy', cutOrderId: 'cut-14671-navy-01', cutOrderNo: 'CUT14671-NAVY-01', spreadingOrderNo: 'PB-14671-NAVY-01',
      occurredAt: '2026-06-03 10:00:00', operator: '铺布操作员 Rina', reason: 'Navy 首次铺布完成裁剪，开始累计 Navy 裁片事实。',
      quantities: { A: { M: 90, L: 140, XL: 180 }, B: { M: 175, L: 265, XL: 345 }, C: { M: 90, L: 140, XL: 180 }, D: { M: 90, L: 140, XL: 180 } },
    },
    {
      eventId: 'spread-14671-red-01', garmentColor: 'Red', cutOrderId: 'cut-14671-red-01', cutOrderNo: 'CUT14671-RED-01', spreadingOrderNo: 'PB-14671-RED-01',
      occurredAt: '2026-06-03 11:00:00', operator: '铺布操作员 Dimas', reason: 'Red 首次铺布完成裁剪，先登记物料 B 最后有效数量。',
      quantities: { A: { M: 80, L: 120, XL: 150 }, B: { M: 150, L: 235, XL: 300 }, C: { M: 80, L: 120, XL: 150 }, D: { M: 80, L: 120, XL: 150 } },
    },
    {
      eventId: 'spread-14671-black-02', garmentColor: 'Black', cutOrderId: 'cut-14671-black-02', cutOrderNo: 'CUT14671-BLACK-02', spreadingOrderNo: 'PB-14671-BLACK-02',
      occurredAt: '2026-06-03 12:00:00', operator: '铺布操作员 Joko', reason: 'Black 第二次铺布完成裁剪，累计至当前 Black 数量。',
      quantities: { A: { M: 100, L: 158, XL: 252 }, C: { M: 88, L: 164, XL: 240 }, D: { M: 80, L: 150, XL: 220 } },
    },
    {
      eventId: 'spread-14671-navy-02', garmentColor: 'Navy', cutOrderId: 'cut-14671-navy-02', cutOrderNo: 'CUT14671-NAVY-02', spreadingOrderNo: 'PB-14671-NAVY-02',
      occurredAt: '2026-06-03 13:00:00', operator: '铺布操作员 Ayu', reason: 'Navy 第二次铺布完成裁剪，累计至当前 Navy 数量。',
      quantities: { A: { M: 80, L: 120, XL: 160 }, C: { M: 90, L: 130, XL: 170 }, D: { M: 85, L: 125, XL: 165 } },
    },
    {
      eventId: 'spread-14671-white-02', garmentColor: 'White', cutOrderId: 'cut-14671-white-02', cutOrderNo: 'CUT14671-WHITE-02', spreadingOrderNo: 'PB-14671-WHITE-02',
      occurredAt: '2026-06-03 14:00:00', operator: '铺布操作员 Wawan', reason: 'White 第二次铺布完成裁剪，累计至当前 White 数量。',
      quantities: { A: { M: 90, L: 130, XL: 160 }, C: { M: 85, L: 140, XL: 170 }, D: { M: 80, L: 125, XL: 155 } },
    },
    {
      eventId: 'spread-14671-red-02', garmentColor: 'Red', cutOrderId: 'cut-14671-red-02', cutOrderNo: 'CUT14671-RED-02', spreadingOrderNo: 'PB-14671-RED-02',
      occurredAt: '2026-06-03 16:00:00', operator: '铺布操作员 Lestari', reason: 'Red 第二次铺布完成裁剪，累计至当前 Red 数量。',
      quantities: { A: { M: 80, L: 120, XL: 165 }, C: { M: 85, L: 130, XL: 170 }, D: { M: 75, L: 118, XL: 155 } },
    },
  ]
  const createFacts = (event: BootstrapSpreadingEvent): CutPieceFact[] => Object.entries(event.quantities).flatMap(([materialId, qtyBySize]) => sizes.map((size) => ({
    factId: `${event.eventId}-${materialId}-${size}`,
    sourceEventId: event.eventId,
    productionOrderId,
    cutOrderId: materialId === 'B' ? 'cut-14671-b' : event.cutOrderId,
    cutOrderNo: materialId === 'B' ? 'CUT14671-B' : event.cutOrderNo,
    spreadingOrderNo: event.spreadingOrderNo,
    garmentColor: event.garmentColor,
    size,
    materialId,
    partId: materialId === 'A' || materialId === 'B' ? 'front' : materialId === 'C' ? 'collar' : 'cuff',
    actualPieceQty: qtyBySize![size] * (materialId === 'B' ? 2 : 1),
    direction: '正向' as const,
    sourceStatus: '持续更新' as const,
    occurredAt: event.occurredAt,
  })))
  const toMatrixEvent = (event: BootstrapSpreadingEvent): MatrixEvent => ({
    eventId: event.eventId,
    eventType: '铺布完成',
    productionOrderId,
    occurredAt: event.occurredAt,
    operator: event.operator,
    reason: event.reason,
    cutOrderId: event.cutOrderId,
    cutOrderNo: event.cutOrderNo,
    spreadingOrderNo: event.spreadingOrderNo,
  })
  const firstEvent = spreadingEvents[0]
  addRepositoryItem({
    productionOrderId,
    productionOrderNo: 'PO14671',
    spuCode: 'ASYSA26060310',
    planQtyByColorSize: {
      Black: { M: 215, L: 344, XL: 482 },
      White: { M: 190, L: 280, XL: 340 },
      Navy: { M: 180, L: 270, XL: 350 },
      Red: { M: 170, L: 250, XL: 320 },
    },
    requirements,
    facts: createFacts(firstEvent),
  }, '女式基础圆领短袖', ['CUT14671-A', 'CUT14671-B', ...spreadingEvents.slice(1).map((event) => event.cutOrderNo)], toMatrixEvent(firstEvent))
  const item = releaseRepository.get(productionOrderId)!
  item.sourceStates = [
    ...spreadingEvents.map((event, index) => ({ cutOrderId: event.cutOrderId, cutOrderNo: event.cutOrderNo, status: '持续更新' as const, changedAt: event.occurredAt, operator: event.operator, reason: event.reason, materialIds: index === 0 ? ['A', 'C', 'D'] : [] })),
    { cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', changedAt: firstEvent.occurredAt, operator: firstEvent.operator, reason: '物料 B 按四颜色首次铺布事实持续累计。', materialIds: ['B'] },
  ]
  spreadingEvents.slice(1, 7).forEach((event) => appendRepositoryEvent(item, toMatrixEvent(event), () => item.input.facts.push(...createFacts(event))))
  recordCutOrderReleaseStatusChange({
    eventId: 'freeze-cut-14671-b',
    cutOrderId: 'cut-14671-b',
    cutOrderNo: 'CUT14671-B',
    status: '已冻结',
    occurredAt: '2026-06-03 15:00:00',
    operator: '裁床主管 王敏',
    reason: 'CUT14671-B 裁片单完成并冻结，物料 B 最后有效数量继续参与矩阵且不再更新。',
  })
  const redSecondEvent = spreadingEvents[7]
  appendRepositoryEvent(item, toMatrixEvent(redSecondEvent), () => item.input.facts.push(...createFacts(redSecondEvent)))
  item.activeSpreadingOrderNosByCutOrder = { 'cut-14671-a': ['PB-14671-A-进行中'], 'cut-14671-b': [] }
  const confirmed = confirmCutPieceReleaseTarget({
    productionOrderId,
    matrixVersion: 9,
    colorSizeTargets: {
      'Black::M': 208, 'Black::L': 350, 'Black::XL': 520,
      'White::M': 185, 'White::L': 280, 'White::XL': 340,
      'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
      'Red::M': 165, 'Red::L': 250, 'Red::XL': 320,
    },
    confirmedBy: '裁床文员 Siti',
  })
  if (!confirmed.ok) throw new Error(`初始化 PO14671 目标快照失败：${confirmed.message}`)

  const simpleRequirements: CutPieceRequirement[] = [
    { materialId: 'FAB', materialName: '主面料', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'LIN', materialName: '里料', partId: 'body', partName: '衣身里', piecesPerGarment: 1 },
    { materialId: 'CUF', materialName: '袖口辅料', partId: 'cuff', partName: '袖口', piecesPerGarment: 2 },
  ]
  const incompleteRequirements: CutPieceRequirement[] = [
    { materialId: 'FAB', materialName: '主面料', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'LIN', materialName: '里料', partId: 'body', partName: '衣身里' },
  ]
  const createSeedFacts = (input: {
    productionOrderId: string
    eventId: string
    cutOrderId: string
    cutOrderNo: string
    spreadingOrderNo: string
    occurredAt: string
    quantities: Record<string, Record<string, Record<string, number>>>
    requirements: CutPieceRequirement[]
    sourceStatus?: ReleaseSourceStatus
  }): CutPieceFact[] => Object.entries(input.quantities).flatMap(([garmentColor, materialQtyBySize]) => Object.entries(materialQtyBySize).flatMap(([materialId, qtyBySize]) => {
    const requirement = input.requirements.find((item) => item.materialId === materialId)
    return Object.entries(qtyBySize).map(([size, garmentQty]) => ({
      factId: `${input.eventId}-${garmentColor}-${materialId}-${size}`,
      sourceEventId: input.eventId,
      productionOrderId: input.productionOrderId,
      cutOrderId: input.cutOrderId,
      cutOrderNo: input.cutOrderNo,
      spreadingOrderNo: input.spreadingOrderNo,
      garmentColor,
      size,
      materialId,
      partId: requirement?.partId || materialId,
      actualPieceQty: garmentQty * (requirement?.piecesPerGarment || 1),
      direction: '正向' as const,
      sourceStatus: input.sourceStatus || '持续更新',
      occurredAt: input.occurredAt,
    }))
  }))
  const simpleMatrixEvent = (input: {
    eventId: string
    productionOrderId: string
    occurredAt: string
    operator: string
    reason: string
    cutOrderId: string
    cutOrderNo: string
    spreadingOrderNo: string
  }): MatrixEvent => ({
    eventId: input.eventId,
    eventType: '铺布完成',
    productionOrderId: input.productionOrderId,
    occurredAt: input.occurredAt,
    operator: input.operator,
    reason: input.reason,
    cutOrderId: input.cutOrderId,
    cutOrderNo: input.cutOrderNo,
    spreadingOrderNo: input.spreadingOrderNo,
  })
  const addSourceState = (seedProductionOrderId: string, input: {
    cutOrderId: string
    cutOrderNo: string
    changedAt: string
    operator: string
    reason: string
    materialIds: string[]
    status?: ReleaseSourceStatus
  }) => {
    const seedItem = releaseRepository.get(seedProductionOrderId)
    if (!seedItem) return
    seedItem.sourceStates.push({
      cutOrderId: input.cutOrderId,
      cutOrderNo: input.cutOrderNo,
      status: input.status === '已冻结' ? '已冻结' : '持续更新',
      changedAt: input.changedAt,
      operator: input.operator,
      reason: input.reason,
      materialIds: input.materialIds,
    })
  }

  addRepositoryItem({
    productionOrderId: 'PO-202603-0002',
    productionOrderNo: 'PO-202603-0002',
    spuCode: 'SPU-2024-005',
    planQtyByColorSize: { Grey: { S: 500, M: 700, L: 800, XL: 500 } },
    requirements: [
      { materialId: 'FAB', materialName: 'Hoodie 抓绒主面料', partId: 'body', partName: '衣身', piecesPerGarment: 1 },
      { materialId: 'LIN', materialName: '帽里布', partId: 'hood-lining', partName: '帽里', piecesPerGarment: 1 },
      { materialId: 'RIB', materialName: '罗纹', partId: 'cuff', partName: '袖口与下摆', piecesPerGarment: 2 },
    ],
    facts: createSeedFacts({
      productionOrderId: 'PO-202603-0002', eventId: 'spread-po-0002-01', cutOrderId: 'cut-po-0002-a', cutOrderNo: 'CUT-260303-002-01', spreadingOrderNo: 'PB-PO-0002-01', occurredAt: '2026-08-10 08:20:00',
      requirements: [
        { materialId: 'FAB', materialName: 'Hoodie 抓绒主面料', partId: 'body', partName: '衣身', piecesPerGarment: 1 },
        { materialId: 'LIN', materialName: '帽里布', partId: 'hood-lining', partName: '帽里', piecesPerGarment: 1 },
        { materialId: 'RIB', materialName: '罗纹', partId: 'cuff', partName: '袖口与下摆', piecesPerGarment: 2 },
      ],
      quantities: {
        Grey: {
          FAB: { S: 500, M: 700, L: 800, XL: 500 },
          LIN: { S: 500, M: 680, L: 760, XL: 450 },
          RIB: { S: 490, M: 660, L: 720, XL: 430 },
        },
      },
    }),
  }, 'Jaket Hoodie Unisex', ['CUT-260303-002-01'], simpleMatrixEvent({
    eventId: 'spread-po-0002-01', productionOrderId: 'PO-202603-0002', occurredAt: '2026-08-10 08:20:00', operator: '裁床操作员 Rudi', reason: '按 Grey 各尺码登记当前有效裁片事实。', cutOrderId: 'cut-po-0002-a', cutOrderNo: 'CUT-260303-002-01', spreadingOrderNo: 'PB-PO-0002-01',
  }))
  addSourceState('PO-202603-0002', { cutOrderId: 'cut-po-0002-a', cutOrderNo: 'CUT-260303-002-01', changedAt: '2026-08-10 08:20:00', operator: '裁床操作员 Rudi', reason: '当前裁片事实持续更新。', materialIds: ['FAB', 'LIN', 'RIB'] })
  const hoodieTarget = confirmCutPieceReleaseTarget({
    productionOrderId: 'PO-202603-0002',
    matrixVersion: 1,
    colorSizeTargets: { 'Grey::S': 500, 'Grey::M': 700, 'Grey::L': 800, 'Grey::XL': 500 },
    confirmedBy: '裁床文员 Siti',
  })
  if (!hoodieTarget.ok) throw new Error(`初始化 PO-202603-0002 目标快照失败：${hoodieTarget.message}`)
  const hoodieRelease = confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'PO-202603-0002', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: { 'Grey::S': 490, 'Grey::M': 680, 'Grey::L': 720, 'Grey::XL': 430 },
    riskReason: 'Grey M 码有 20 件罗纹尚未完成齐套点收，裁床主管确认可先行放行。',
    confirmedBy: '裁床主管 王敏', confirmedAt: '2026-08-10 09:15:00',
  })
  if (!hoodieRelease.ok) throw new Error(`初始化 PO-202603-0002 放行快照失败：${hoodieRelease.message}`)

  addRepositoryItem({
    productionOrderId: 'po-14672',
    productionOrderNo: 'PO14672',
    spuCode: 'ASYSA26060311',
    planQtyByColorSize: {
      '雾蓝': { S: 180, M: 260, L: 220 },
      '浅灰': { S: 120, M: 200, L: 160 },
    },
    requirements: simpleRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14672', eventId: 'spread-14672-01', cutOrderId: 'cut-14672-a', cutOrderNo: 'CUT14672-A', spreadingOrderNo: 'PB-14672-01', occurredAt: '2026-06-04 09:20:00', requirements: simpleRequirements,
      quantities: {
        '雾蓝': { FAB: { S: 170, M: 250, L: 210 }, LIN: { S: 168, M: 248, L: 205 }, CUF: { S: 165, M: 245, L: 200 } },
        '浅灰': { FAB: { S: 118, M: 190, L: 150 }, LIN: { S: 115, M: 188, L: 148 }, CUF: { S: 112, M: 185, L: 145 } },
      },
    }),
  }, '男式轻薄防晒衬衫', ['CUT14672-A'], simpleMatrixEvent({
    eventId: 'spread-14672-01', productionOrderId: 'po-14672', occurredAt: '2026-06-04 09:20:00', operator: '铺布操作员 Rudi', reason: '首批主面料、里料与袖口裁片已完成，等待裁床主管确认放行目标。', cutOrderId: 'cut-14672-a', cutOrderNo: 'CUT14672-A', spreadingOrderNo: 'PB-14672-01',
  }))
  addSourceState('po-14672', { cutOrderId: 'cut-14672-a', cutOrderNo: 'CUT14672-A', changedAt: '2026-06-04 09:20:00', operator: '铺布操作员 Rudi', reason: '首批裁片持续更新中。', materialIds: ['FAB', 'LIN', 'CUF'] })
  const riskTarget = confirmCutPieceReleaseTarget({
    productionOrderId: 'po-14672',
    matrixVersion: 1,
    colorSizeTargets: {
      '雾蓝::S': 170, '雾蓝::M': 250, '雾蓝::L': 210,
      '浅灰::S': 118, '浅灰::M': 190, '浅灰::L': 150,
    },
    confirmedBy: '裁床文员 Siti',
  })
  if (!riskTarget.ok) throw new Error(`初始化 PO14672 目标快照失败：${riskTarget.message}`)
  confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'po-14672', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: {
      '雾蓝::S': 165, '雾蓝::M': 245, '雾蓝::L': 200,
      '浅灰::S': 112, '浅灰::M': 185, '浅灰::L': 145,
    },
    riskReason: '', confirmedBy: '裁床主管 王敏', confirmedAt: '2026-07-25 09:30:00',
  })
  confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'po-14672', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: {
      '雾蓝::S': 170, '雾蓝::M': 250, '雾蓝::L': 210,
      '浅灰::S': 115, '浅灰::M': 190, '浅灰::L': 150,
    },
    riskReason: '裁床主管确认部分袖口裁片已裁好但暂未点收入仓，允许 PPIC 先安排车缝。',
    confirmedBy: '裁床主管 王敏',
    confirmedAt: '2026-07-25 11:15:00',
  })

  addRepositoryItem({
    productionOrderId: 'po-14673',
    productionOrderNo: 'PO14673',
    spuCode: 'ASYSA26060312',
    planQtyByColorSize: {
      '奶油白': { S: 150, M: 230, L: 180 },
      '焦糖棕': { S: 100, M: 160, L: 140 },
    },
    requirements: simpleRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14673', eventId: 'spread-14673-01', cutOrderId: 'cut-14673-a', cutOrderNo: 'CUT14673-A', spreadingOrderNo: 'PB-14673-01', occurredAt: '2026-06-04 10:10:00', requirements: simpleRequirements, sourceStatus: '已冻结',
      quantities: {
        '奶油白': { FAB: { S: 145, M: 220, L: 170 }, LIN: { S: 140, M: 215, L: 168 }, CUF: { S: 138, M: 210, L: 165 } },
        '焦糖棕': { FAB: { S: 95, M: 150, L: 132 }, LIN: { S: 92, M: 148, L: 130 }, CUF: { S: 90, M: 145, L: 128 } },
      },
    }),
  }, '女式罗纹针织开衫', ['CUT14673-A', 'CUT14673-B'], simpleMatrixEvent({
    eventId: 'spread-14673-01', productionOrderId: 'po-14673', occurredAt: '2026-06-04 10:10:00', operator: '铺布操作员 Eka', reason: '首批裁片完成并冻结，裁床主管可先确认一版目标。', cutOrderId: 'cut-14673-a', cutOrderNo: 'CUT14673-A', spreadingOrderNo: 'PB-14673-01',
  }))
  addSourceState('po-14673', { cutOrderId: 'cut-14673-a', cutOrderNo: 'CUT14673-A', changedAt: '2026-06-04 10:10:00', operator: '裁床主管 王敏', reason: '首批裁片单已冻结。', materialIds: ['FAB', 'LIN', 'CUF'], status: '已冻结' })
  const changedTarget = confirmCutPieceReleaseTarget({
    productionOrderId: 'po-14673',
    matrixVersion: 1,
    colorSizeTargets: {
      '奶油白::S': 138, '奶油白::M': 210, '奶油白::L': 165,
      '焦糖棕::S': 90, '焦糖棕::M': 145, '焦糖棕::L': 128,
    },
    confirmedBy: '裁床文员 Siti',
  })
  if (!changedTarget.ok) throw new Error(`初始化 PO14673 目标快照失败：${changedTarget.message}`)
  confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'po-14673', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: {
      '奶油白::S': 138, '奶油白::M': 210, '奶油白::L': 165,
      '焦糖棕::S': 90, '焦糖棕::M': 145, '焦糖棕::L': 128,
    },
    riskReason: '', confirmedBy: '裁床主管 王敏', confirmedAt: '2026-07-25 12:20:00',
  })
  const po14673 = releaseRepository.get('po-14673')!
  const laterEvent = simpleMatrixEvent({
    eventId: 'spread-14673-02', productionOrderId: 'po-14673', occurredAt: '2026-06-04 14:30:00', operator: '铺布操作员 Agus', reason: '追加焦糖棕 L 码袖口裁片，目标确认后数据发生变化。', cutOrderId: 'cut-14673-b', cutOrderNo: 'CUT14673-B', spreadingOrderNo: 'PB-14673-02',
  })
  appendRepositoryEvent(po14673, laterEvent, () => po14673.input.facts.push(...createSeedFacts({
    productionOrderId: 'po-14673', eventId: 'spread-14673-02', cutOrderId: 'cut-14673-b', cutOrderNo: 'CUT14673-B', spreadingOrderNo: 'PB-14673-02', occurredAt: '2026-06-04 14:30:00', requirements: simpleRequirements,
    quantities: { '焦糖棕': { CUF: { L: 10 } } },
  })))
  addSourceState('po-14673', { cutOrderId: 'cut-14673-b', cutOrderNo: 'CUT14673-B', changedAt: '2026-06-04 14:30:00', operator: '铺布操作员 Agus', reason: '目标确认后追加裁片，需主管复核。', materialIds: ['CUF'] })

  addRepositoryItem({
    productionOrderId: 'po-14674',
    productionOrderNo: 'PO14674',
    spuCode: 'ASYSA26060313',
    planQtyByColorSize: { '深绿': { M: 180, L: 220 }, '黑色': { M: 160, L: 200 } },
    requirements: incompleteRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14674', eventId: 'spread-14674-01', cutOrderId: 'cut-14674-a', cutOrderNo: 'CUT14674-A', spreadingOrderNo: 'PB-14674-01', occurredAt: '2026-06-05 08:40:00', requirements: incompleteRequirements,
      quantities: {
        '深绿': { FAB: { M: 170, L: 210 }, LIN: { M: 168, L: 205 } },
        '黑色': { FAB: { M: 150, L: 190 }, LIN: { M: 148, L: 188 } },
      },
    }),
  }, '户外束脚工装裤', ['CUT14674-A'], simpleMatrixEvent({
    eventId: 'spread-14674-01', productionOrderId: 'po-14674', occurredAt: '2026-06-05 08:40:00', operator: '铺布操作员 Nanda', reason: '里料用量配置缺失，矩阵应提示数据不完整。', cutOrderId: 'cut-14674-a', cutOrderNo: 'CUT14674-A', spreadingOrderNo: 'PB-14674-01',
  }))
  addSourceState('po-14674', { cutOrderId: 'cut-14674-a', cutOrderNo: 'CUT14674-A', changedAt: '2026-06-05 08:40:00', operator: '铺布操作员 Nanda', reason: '裁片事实已到，但 BOM 用量配置待补。', materialIds: ['FAB', 'LIN'] })

  addRepositoryItem({
    productionOrderId: 'po-14675',
    productionOrderNo: 'PO14675',
    spuCode: 'ASYSA26060314',
    planQtyByColorSize: { '樱粉': { S: 120, M: 180 }, '月白': { S: 100, M: 160 } },
    requirements: simpleRequirements,
    facts: [],
  }, '女童荷叶边连衣裙', ['CUT14675-A'], simpleMatrixEvent({
    eventId: 'spread-14675-pending', productionOrderId: 'po-14675', occurredAt: '2026-06-05 11:00:00', operator: '裁床文员 Siti', reason: '生产单已进入放行观察，但铺布裁片事实暂未回传。', cutOrderId: 'cut-14675-a', cutOrderNo: 'CUT14675-A', spreadingOrderNo: 'PB-14675-待回传',
  }))

  addRepositoryItem({
    productionOrderId: 'po-14676',
    productionOrderNo: 'PO14676',
    spuCode: 'ASYSA26060315',
    planQtyByColorSize: { '杏色': { S: 90, M: 140 }, '墨蓝': { S: 80, M: 130 } },
    requirements: simpleRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14676', eventId: 'spread-14676-01', cutOrderId: 'cut-14676-a', cutOrderNo: 'CUT14676-A', spreadingOrderNo: 'PB-14676-01', occurredAt: '2026-06-05 13:20:00', requirements: simpleRequirements,
      quantities: {
        '杏色': { FAB: { S: 88, M: 135 }, LIN: { S: 86, M: 132 }, CUF: { S: 84, M: 130 } },
        '墨蓝': { FAB: { S: 76, M: 126 }, LIN: { S: 74, M: 124 }, CUF: { S: 72, M: 120 } },
      },
    }),
  }, '女式通勤短款外套', ['CUT14676-A'], simpleMatrixEvent({
    eventId: 'spread-14676-01', productionOrderId: 'po-14676', occurredAt: '2026-06-05 13:20:00', operator: '铺布操作员 Putri', reason: '目标已维护，等待裁床主管确认当前可做放行数量。', cutOrderId: 'cut-14676-a', cutOrderNo: 'CUT14676-A', spreadingOrderNo: 'PB-14676-01',
  }))
  addSourceState('po-14676', { cutOrderId: 'cut-14676-a', cutOrderNo: 'CUT14676-A', changedAt: '2026-06-05 13:20:00', operator: '铺布操作员 Putri', reason: '目标已维护，等待放行确认。', materialIds: ['FAB', 'LIN', 'CUF'] })
  const waitingTarget = confirmCutPieceReleaseTarget({
    productionOrderId: 'po-14676', matrixVersion: 1,
    colorSizeTargets: { '杏色::S': 84, '杏色::M': 130, '墨蓝::S': 72, '墨蓝::M': 120 },
    confirmedBy: '裁床文员 Siti',
  })
  if (!waitingTarget.ok) throw new Error(`初始化 PO14676 目标快照失败：${waitingTarget.message}`)

  addRepositoryItem({
    productionOrderId: 'po-14677',
    productionOrderNo: 'PO14677',
    spuCode: 'ASYSA26060316',
    planQtyByColorSize: { '松石绿': { M: 110, L: 150 }, '米白': { M: 100, L: 140 } },
    requirements: simpleRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14677', eventId: 'spread-14677-01', cutOrderId: 'cut-14677-a', cutOrderNo: 'CUT14677-A', spreadingOrderNo: 'PB-14677-01', occurredAt: '2026-06-05 15:10:00', requirements: simpleRequirements,
      quantities: {
        '松石绿': { FAB: { M: 70, L: 90 }, LIN: { M: 68, L: 88 }, CUF: { M: 66, L: 85 } },
        '米白': { FAB: { M: 60, L: 80 }, LIN: { M: 58, L: 78 }, CUF: { M: 55, L: 75 } },
      },
    }),
  }, '男式运动连帽卫衣', ['CUT14677-A'], simpleMatrixEvent({
    eventId: 'spread-14677-01', productionOrderId: 'po-14677', occurredAt: '2026-06-05 15:10:00', operator: '铺布操作员 Hendra', reason: '主料色差待裁床主管复核，先维护目标但暂不放行。', cutOrderId: 'cut-14677-a', cutOrderNo: 'CUT14677-A', spreadingOrderNo: 'PB-14677-01',
  }))
  addSourceState('po-14677', { cutOrderId: 'cut-14677-a', cutOrderNo: 'CUT14677-A', changedAt: '2026-06-05 15:10:00', operator: '铺布操作员 Hendra', reason: '主料色差待复核，主管确认暂不放行。', materialIds: ['FAB', 'LIN', 'CUF'] })
  const blockedTarget = confirmCutPieceReleaseTarget({
    productionOrderId: 'po-14677', matrixVersion: 1,
    colorSizeTargets: { '松石绿::M': 66, '松石绿::L': 85, '米白::M': 55, '米白::L': 75 },
    confirmedBy: '裁床文员 Siti',
  })
  if (!blockedTarget.ok) throw new Error(`初始化 PO14677 目标快照失败：${blockedTarget.message}`)
  confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'po-14677', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: { '松石绿::M': 0, '松石绿::L': 0, '米白::M': 0, '米白::L': 0 },
    riskReason: '', confirmedBy: '裁床主管 王敏', confirmedAt: '2026-07-25 15:40:00',
  })

  addRepositoryItem({
    productionOrderId: 'po-14678',
    productionOrderNo: 'PO14678',
    spuCode: 'ASYSA26060317',
    planQtyByColorSize: { '浅咖': { S: 100, M: 150 }, '炭灰': { S: 90, M: 140 } },
    requirements: simpleRequirements,
    facts: createSeedFacts({
      productionOrderId: 'po-14678', eventId: 'spread-14678-01', cutOrderId: 'cut-14678-a', cutOrderNo: 'CUT14678-A', spreadingOrderNo: 'PB-14678-01', occurredAt: '2026-06-05 16:30:00', requirements: simpleRequirements,
      quantities: {
        '浅咖': { FAB: { S: 96, M: 146 }, LIN: { S: 94, M: 144 }, CUF: { S: 92, M: 140 } },
        '炭灰': { FAB: { S: 86, M: 136 }, LIN: { S: 84, M: 134 }, CUF: { S: 82, M: 130 } },
      },
    }),
  }, '女式休闲束腰衬衫裙', ['CUT14678-A'], simpleMatrixEvent({
    eventId: 'spread-14678-01', productionOrderId: 'po-14678', occurredAt: '2026-06-05 16:30:00', operator: '铺布操作员 Fitri', reason: '裁片事实已形成可计算矩阵，但裁床主管尚未维护目标数量。', cutOrderId: 'cut-14678-a', cutOrderNo: 'CUT14678-A', spreadingOrderNo: 'PB-14678-01',
  }))
  addSourceState('po-14678', { cutOrderId: 'cut-14678-a', cutOrderNo: 'CUT14678-A', changedAt: '2026-06-05 16:30:00', operator: '铺布操作员 Fitri', reason: '可计算矩阵已生成，待主管维护目标。', materialIds: ['FAB', 'LIN', 'CUF'] })
  // 为 PO14671 初始化 V1 放行版本（按齐套放行）
  confirmCutPieceReleaseAvailableQty({
    productionOrderId: 'po-14671',
    basisMatrixVersion: 9,
    basisTargetVersion: 9,
    releaseQtyByColorSize: {
      'Black::M': 200, 'Black::L': 350, 'Black::XL': 500,
      'White::M': 180, 'White::L': 270, 'White::XL': 330,
      'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
      'Red::M': 150, 'Red::L': 235, 'Red::XL': 300,
    },
    riskReason: '',
    confirmedBy: '裁床主管 王敏',
    confirmedAt: '2026-07-25 10:20:00',
  })
}

bootstrapRepository()

export function resetCutPieceReleasePrototypeStoreForTesting(): void {
  releaseRepository.clear()
  targetSnapshots.clear()
  lateEvents.clear()
  releaseVersionRepository.clear()
  bootstrapRepository()
}

function resolveCutOrderSource(item: ReleaseRepositoryItem, cutOrderId: string, cutOrderNo = ''): { cutOrderId: string; cutOrderNo: string } | null {
  if (cutOrderId && cutOrderNo) {
    const exactFact = item.input.facts.find((fact) => fact.cutOrderId === cutOrderId && fact.cutOrderNo === cutOrderNo)
    if (exactFact) return { cutOrderId: exactFact.cutOrderId || '', cutOrderNo: exactFact.cutOrderNo || '' }
    return null
  }
  const directFact = item.input.facts.find((fact) => (
    (cutOrderId && fact.cutOrderId === cutOrderId) || (cutOrderNo && fact.cutOrderNo === cutOrderNo)
  ))
  if (directFact) return { cutOrderId: directFact.cutOrderId || '', cutOrderNo: directFact.cutOrderNo || '' }
  return null
}

export function getCutOrderReleaseImpactSummary(cutOrderId: string): CutOrderReleaseImpactSummary | null {
  const sourceKey = cutOrderId.trim()
  if (!sourceKey) return null
  for (const item of releaseRepository.values()) {
    const source = resolveCutOrderSource(item, sourceKey, '') ?? resolveCutOrderSource(item, '', sourceKey)
    if (!source) continue
    const affectedCellKeys = new Set(item.input.facts
      .filter((fact) => fact.cutOrderId === source.cutOrderId)
      .map((fact) => [fact.garmentColor, fact.size, fact.materialId].join('\u0000')))
    const affectedCells = item.currentMatrix.colorGroups.flatMap((group) => group.materialRows
      .flatMap((row) => row.cells
        .filter((cell) => affectedCellKeys.has([group.garmentColor, cell.size, row.materialId].join('\u0000')))
        .map((cell) => ({
          garmentColor: group.garmentColor,
          size: cell.size,
          materialId: row.materialId,
          materialName: row.materialName,
          availableGarmentQty: cell.availableGarmentQty,
        }))))
      .sort((left, right) => left.garmentColor.localeCompare(right.garmentColor, 'zh-CN') || left.size.localeCompare(right.size, 'zh-CN') || left.materialId.localeCompare(right.materialId, 'zh-CN'))
    return clone({
      cutOrderId: source.cutOrderId,
      cutOrderNo: source.cutOrderNo,
      affectedCells,
      activeSpreadingOrderNos: item.activeSpreadingOrderNosByCutOrder[source.cutOrderId] ?? [],
    })
  }
  return null
}

export function recordLateCutPieceReleaseEvent(input: Omit<LateCutPieceReleaseEvent, 'status'>): void {
  const eventId = input.eventId.trim()
  const item = releaseRepository.get(input.productionOrderId)
  if (!eventId || !item || lateEvents.has(eventId)) return
  const source = resolveCutOrderSource(item, input.cutOrderId.trim(), input.cutOrderNo.trim())
  const sourceState = source ? item.sourceStates.find((state) => state.cutOrderId === source.cutOrderId) : null
  if (!source || sourceState?.status !== '已冻结' || !input.spreadingOrderNo.trim() || !input.arrivedAt.trim()) return
  lateEvents.set(eventId, clone({
    ...input,
    eventId,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    spreadingOrderNo: input.spreadingOrderNo.trim(),
    status: '待处理',
  }))
}

export function listLateCutPieceReleaseEvents(productionOrderId: string): LateCutPieceReleaseEvent[] {
  return [...lateEvents.values()]
    .filter((event) => event.productionOrderId === productionOrderId)
    .sort((left, right) => right.arrivedAt.localeCompare(left.arrivedAt, 'zh-CN'))
    .map(clone)
}

export function listCutPieceReleaseRecords(): CutPieceReleaseRecord[] {
  return [...releaseRepository.values()].map((item) => clone(buildReleaseRecord(item)))
}

export function getCutPieceReleaseRecord(recordId: string): CutPieceReleaseRecord | null {
  return listCutPieceReleaseRecords().find((record) => record.recordId === recordId) ?? null
}

export function getCutPieceReleaseMatrix(productionOrderId: string): CutPieceReleaseMatrix | null {
  const item = releaseRepository.get(productionOrderId)
  return item ? clone(item.currentMatrix) : null
}

export function getCutPieceReleaseFactSourceSummary(
  productionOrderId: string,
  sourceFactIds: string[],
): CutPieceReleaseFactSourceSummary {
  const item = releaseRepository.get(productionOrderId)
  if (!item) return { cutOrderNos: [], spreadingOrderNos: [] }
  const requestedFactIds = new Set(sourceFactIds)
  const facts = item.input.facts.filter((fact) => requestedFactIds.has(fact.factId))
  return {
    cutOrderNos: [...new Set(facts.map((fact) => fact.cutOrderNo).filter(Boolean))],
    spreadingOrderNos: [...new Set(facts.map((fact) => fact.spreadingOrderNo).filter(Boolean))],
  }
}

export function listCutPieceReleaseMatrixVersions(productionOrderId: string): CutPieceReleaseMatrixVersion[] {
  const item = releaseRepository.get(productionOrderId)
  return item ? item.versions.map(clone) : []
}

export function calculateCutPieceReleaseHistoryDifference(
  current: CutPieceReleaseMatrixVersion,
  previous?: CutPieceReleaseMatrixVersion,
): CutPieceReleaseHistoryDifference {
  interface CompleteKitPoint {
    garmentColor: string
    size: string
    quantity: number | null
  }
  interface MaterialPoint extends CompleteKitPoint {
    materialId: string
    materialName: string
  }
  const collectCompleteKitPoints = (version?: CutPieceReleaseMatrixVersion) => new Map(
    version?.matrixSnapshot.colorGroups.flatMap((group) => group.sizes.map((size) => [
      `${group.garmentColor}::${size}`,
      { garmentColor: group.garmentColor, size, quantity: group.completeKitBySize[size] ?? null },
    ] as const)) ?? [],
  )
  const collectMaterialPoints = (version?: CutPieceReleaseMatrixVersion) => new Map(
    version?.matrixSnapshot.colorGroups.flatMap((group) => group.materialRows.flatMap((row) => row.cells.map((cell) => [
      `${group.garmentColor}::${cell.size}::${row.materialId}`,
      {
        garmentColor: group.garmentColor,
        size: cell.size,
        materialId: row.materialId,
        materialName: row.materialName,
        quantity: cell.availableGarmentQty,
      },
    ] as const))) ?? [],
  )
  const currentCompleteKit = collectCompleteKitPoints(current)
  const previousCompleteKit = collectCompleteKitPoints(previous)
  const currentMaterials = collectMaterialPoints(current)
  const previousMaterials = collectMaterialPoints(previous)
  const changed = <T extends CompleteKitPoint>(before: T | undefined, after: T | undefined) => {
    if (!previous && !before && after?.quantity === null) return false
    return Boolean(before) !== Boolean(after) || before?.quantity !== after?.quantity
  }
  const values = <T extends CompleteKitPoint>(before: T | undefined, after: T | undefined) => {
    const beforeValue: CutPieceReleaseHistoryQuantityValue = {
      exists: Boolean(before),
      quantity: before?.quantity ?? null,
    }
    const afterValue: CutPieceReleaseHistoryQuantityValue = {
      exists: Boolean(after),
      quantity: after?.quantity ?? null,
    }
    const delta = typeof after?.quantity === 'number'
      && (typeof before?.quantity === 'number' || !before)
      ? after.quantity - (before?.quantity ?? 0)
      : null
    return { before: beforeValue, after: afterValue, delta }
  }
  const completeKitChanges = [...new Set([...previousCompleteKit.keys(), ...currentCompleteKit.keys()])].flatMap((key) => {
    const before = previousCompleteKit.get(key)
    const after = currentCompleteKit.get(key)
    if (!changed(before, after)) return []
    const point = after ?? before!
    return [{ garmentColor: point.garmentColor, size: point.size, ...values(before, after) }]
  })
  const materialChanges = [...new Set([...previousMaterials.keys(), ...currentMaterials.keys()])].flatMap((key) => {
    const before = previousMaterials.get(key)
    const after = currentMaterials.get(key)
    if (!changed(before, after)) return []
    const point = after ?? before!
    return [{
      garmentColor: point.garmentColor,
      size: point.size,
      materialId: point.materialId,
      materialName: point.materialName,
      ...values(before, after),
    }]
  })
  return {
    affectedColors: [...new Set([...completeKitChanges, ...materialChanges].map((item) => item.garmentColor))],
    completeKitChanges,
    materialChanges,
  }
}

export function confirmCutPieceReleaseTarget(input: ConfirmReleaseTargetInput): ConfirmReleaseTargetResult {
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { ok: false, message: '未找到生产单裁片矩阵。', snapshot: null }
  const confirmedBy = input.confirmedBy.trim()
  if (!confirmedBy) return { ok: false, message: '请填写目标确认人。', snapshot: null }
  const existingSnapshot = [...targetSnapshots.values()].find((snapshot) => (
    snapshot.productionOrderId === input.productionOrderId && snapshot.matrixVersion === input.matrixVersion
  ))
  if (existingSnapshot) {
    const existingTargets = existingSnapshot.targetPreview.colorSizeTargets
    const sameTargets = Object.keys(existingTargets).length === Object.keys(input.colorSizeTargets).length
      && Object.entries(existingTargets).every(([key, value]) => input.colorSizeTargets[key] === value)
    if (sameTargets && existingSnapshot.confirmedBy === confirmedBy) {
      return { ok: true, message: '裁片目标已确认，返回原目标快照。', snapshot: clone(existingSnapshot) }
    }
    return { ok: false, message: '该裁片矩阵版本的目标确认内容冲突。', snapshot: null }
  }
  const currentVersion = item.versions.at(-1)?.version ?? 0
  if (input.matrixVersion !== currentVersion) return { ok: false, message: '当前裁片矩阵版本已变化，请刷新后重新确认目标。', snapshot: null }
  try {
    const expectedKeys = item.currentMatrix.colorGroups.flatMap((group) => group.sizes.map((size) => targetKey(group.garmentColor, size)))
    if (expectedKeys.length === 0 || expectedKeys.some((key) => !(key in input.colorSizeTargets)) || Object.keys(input.colorSizeTargets).some((key) => !expectedKeys.includes(key))) {
      return { ok: false, message: '目标必须覆盖当前矩阵的全部颜色尺码。', snapshot: null }
    }
    const targetPreview = buildTargetPreview(item.currentMatrix, input.colorSizeTargets)
    const event: MatrixEvent = {
      eventId: `target-confirm:${input.productionOrderId}:${input.matrixVersion}`,
      eventType: '目标确认',
      productionOrderId: input.productionOrderId,
      occurredAt: deterministicConfirmedAt,
      operator: confirmedBy,
    }
    if (!appendMatrixEvent(item.eventState, event)) return { ok: false, message: '该矩阵版本的目标已确认。', snapshot: null }
    item.targetStatus = '已确认'
    const existingVersions = releaseVersionRepository.get(input.productionOrderId)
    existingVersions?.forEach((v) => {
      if (v.isLatestEffective && v.basisTargetVersion !== item.versions.at(-1)?.version) {
        v.releaseStatus = '确认后需复核'
      }
    })
    addVersion(item, event)
    const snapshot: CutPieceReleaseTargetSnapshot = {
      snapshotId: `cpr-target-${input.productionOrderId}-v${input.matrixVersion}`,
      productionOrderId: input.productionOrderId,
      matrixVersion: input.matrixVersion,
      confirmedAt: deterministicConfirmedAt,
      confirmedBy,
      matrixSnapshot: clone(item.currentMatrix),
      targetPreview: clone(targetPreview),
    }
    targetSnapshots.set(snapshot.snapshotId, clone(snapshot))
    item.latestSnapshotId = snapshot.snapshotId
    return { ok: true, message: '裁片目标已确认并生成不可变快照。', snapshot: clone(snapshot) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '目标确认失败。', snapshot: null }
  }
}

export function getCutPieceReleaseTargetSnapshot(snapshotId: string): CutPieceReleaseTargetSnapshot | null {
  const snapshot = targetSnapshots.get(snapshotId)
  return snapshot ? clone(snapshot) : null
}

export function getCurrentCutPieceReleaseTargetSnapshot(snapshotId: string): CutPieceReleaseTargetSnapshot | null {
  const snapshot = targetSnapshots.get(snapshotId)
  if (!snapshot) return null
  const item = releaseRepository.get(snapshot.productionOrderId)
  if (!item || item.latestSnapshotId !== snapshotId || item.targetStatus !== '已确认') return null
  const hasLaterBusinessVersion = item.versions.some((version) => (
    version.version > snapshot.matrixVersion && version.eventType !== '目标确认'
  ))
  return hasLaterBusinessVersion ? null : clone(snapshot)
}

export function listCutPieceReleaseTargetSnapshots(productionOrderId: string): CutPieceReleaseTargetSnapshot[] {
  return [...targetSnapshots.values()]
    .filter((snapshot) => snapshot.productionOrderId === productionOrderId)
    .sort((left, right) => (
      left.confirmedAt.localeCompare(right.confirmedAt)
      || left.matrixVersion - right.matrixVersion
      || left.snapshotId.localeCompare(right.snapshotId)
    ))
    .map(clone)
}

export interface CutOrderReleaseWriteResult {
  status: 'applied' | 'idempotent' | 'not-applicable' | 'rejected'
  reason: string
}

export interface CutOrderReleaseWriteSnapshot {
  productionOrderId: string
  item: ReleaseRepositoryItem
}

export function createCutOrderReleaseWriteSnapshot(cutOrderId: string, cutOrderNo = ''): CutOrderReleaseWriteSnapshot | null {
  const item = [...releaseRepository.values()].find((candidate) => resolveCutOrderSource(candidate, cutOrderId.trim(), cutOrderNo.trim()))
  return item ? { productionOrderId: item.input.productionOrderId, item: clone(item) } : null
}

export function restoreCutOrderReleaseWriteSnapshot(snapshot: CutOrderReleaseWriteSnapshot | null): boolean {
  if (!snapshot?.productionOrderId || !snapshot.item) return false
  releaseRepository.set(snapshot.productionOrderId, clone(snapshot.item))
  return true
}

export function recordCutOrderReleaseStatusChange(input: CutOrderReleaseStatusChangeInput): CutOrderReleaseWriteResult {
  const eventId = input.eventId.trim()
  const cutOrderId = input.cutOrderId.trim()
  const cutOrderNo = input.cutOrderNo.trim()
  if (!eventId) return { status: 'rejected', reason: '放行状态事件 ID 不能为空。' }
  if (!cutOrderId && !cutOrderNo) return { status: 'rejected', reason: '裁片单 ID 和单号不能同时为空。' }
  const repositoryItems = [...releaseRepository.values()]
  const item = repositoryItems.find((candidate) => resolveCutOrderSource(candidate, cutOrderId, cutOrderNo))
  if (!item && cutOrderId && cutOrderNo) {
    const idSource = repositoryItems.map((candidate) => resolveCutOrderSource(candidate, cutOrderId, '')).find(Boolean)
    const noSource = repositoryItems.map((candidate) => resolveCutOrderSource(candidate, '', cutOrderNo)).find(Boolean)
    if (idSource || noSource) return { status: 'rejected', reason: '裁片单 ID 与单号不属于同一放行来源。' }
  }
  if (!item) return { status: 'not-applicable', reason: '当前裁片单未关联裁片放行矩阵。' }
  const source = resolveCutOrderSource(item, cutOrderId, cutOrderNo)!
  const matchedFacts = item.input.facts.filter((fact) => (
    fact.cutOrderId === source.cutOrderId
  ))
  if (cutOrderId && cutOrderNo && source.cutOrderId === cutOrderId && matchedFacts.some((fact) => fact.cutOrderNo !== cutOrderNo)) {
    return { status: 'rejected', reason: '裁片单 ID 与单号不属于同一放行来源。' }
  }
  const matchesInput = (fact: CutPieceFact) => matchedFacts.includes(fact)
  const event: MatrixEvent = {
    eventId,
    eventType: input.status === '已冻结' ? '裁片单冻结' : '裁片单恢复',
    productionOrderId: item.input.productionOrderId,
    occurredAt: input.occurredAt,
    operator: input.operator,
    reason: input.reason,
    cutOrderId: cutOrderId || undefined,
    cutOrderNo: cutOrderNo || undefined,
  }
  const storedEvent = item.eventState.events.find((candidate) => candidate.eventId === eventId)
  if (storedEvent) {
    const sameEvent = storedEvent.eventType === event.eventType
      && storedEvent.productionOrderId === event.productionOrderId
      && (storedEvent.cutOrderId || '') === (event.cutOrderId || '')
      && (storedEvent.cutOrderNo || '') === (event.cutOrderNo || '')
      && storedEvent.occurredAt === event.occurredAt
      && storedEvent.operator === event.operator
      && (storedEvent.reason || '') === (event.reason || '')
    return sameEvent
      ? { status: 'idempotent', reason: '该放行状态事件已经处理。' }
      : { status: 'rejected', reason: '事件 ID 已存在，但业务内容不一致。' }
  }
  if (matchedFacts.every((fact) => fact.sourceStatus === input.status)) {
    appendMatrixEvent(item.eventState, event)
    return { status: 'idempotent', reason: '裁片单放行状态未变化，已记录幂等事件。' }
  }
  const applied = appendRepositoryEvent(item, event, () => {
    item.input.facts.forEach((fact) => {
      if (matchesInput(fact)) fact.sourceStatus = input.status
    })
    const existingState = item.sourceStates.find((state) => state.cutOrderId === source.cutOrderId)
    const nextState: CutPieceReleaseSourceState = {
      cutOrderId: source.cutOrderId,
      cutOrderNo: source.cutOrderNo,
      status: input.status,
      changedAt: input.occurredAt,
      operator: input.operator,
      reason: input.reason,
      materialIds: [...new Set(matchedFacts.map((fact) => fact.materialId))],
    }
    if (existingState) Object.assign(existingState, nextState)
    else item.sourceStates.push(nextState)
  })
  return applied
    ? { status: 'applied', reason: '裁片单放行状态已更新。' }
    : { status: 'rejected', reason: '放行状态事件写入失败。' }
}

export function recordSpreadingReleaseAdjustment(input: SpreadingReleaseAdjustmentInput): SpreadingReleaseAdjustmentResult {
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { status: 'not-applicable', reason: '当前生产单未关联裁片放行矩阵。' }
  if (input.direction !== -1) return { status: 'rejected', reason: '铺布冲销只能使用反向冲销口径。' }
  if (!input.adjustmentEventId.trim() || !input.spreadingOrderNo.trim()) return { status: 'rejected', reason: '冲销事件 ID 和原铺布单号不能为空。' }
  if (!input.operator.trim() || !input.reason.trim() || !input.occurredAt.trim()) return { status: 'rejected', reason: '铺布冲销必须填写原因、操作人和时间。' }
  if (item.eventState.events.some((event) => event.eventId === input.adjustmentEventId)) return { status: 'idempotent', reason: '该铺布冲销事件已经处理。' }
  const sourceKey = `${input.productionOrderId}::${input.spreadingOrderNo.trim()}`
  if (item.spreadingAdjustmentKeys.has(sourceKey)) return { status: 'rejected', reason: `铺布单 ${input.spreadingOrderNo} 已存在冲销记录，不能使用新的冲销事件重复作废。` }
  const referencedFacts = item.input.facts.filter((fact) => fact.spreadingOrderNo === input.spreadingOrderNo && fact.direction === '正向')
  if (!referencedFacts.length) {
    const existing = item.eventState.events.find((event) => event.eventId === input.adjustmentEventId)
    return existing ? { status: 'idempotent', reason: '该铺布冲销事件已经处理。' } : { status: 'not-applicable', reason: '原铺布单没有可冲销的有效裁片事实。' }
  }
  const declaredCutOrders = new Set([...(input.sourceCutOrderIds || []), ...(input.sourceCutOrderNos || [])].map((value) => value.trim()).filter(Boolean))
  if (declaredCutOrders.size && referencedFacts.some((fact) => !declaredCutOrders.has(fact.cutOrderId || '') && !declaredCutOrders.has(fact.cutOrderNo || ''))) {
    return { status: 'rejected', reason: '冲销来源裁片单引用与原铺布事实不一致。' }
  }
  const event: MatrixEvent = {
    eventId: input.adjustmentEventId,
    eventType: '铺布冲销',
    productionOrderId: input.productionOrderId,
    occurredAt: input.occurredAt,
    operator: input.operator,
    reason: input.reason,
    spreadingOrderNo: input.spreadingOrderNo,
  }
  const existingEvent = item.eventState.events.find((candidate) => candidate.eventId === event.eventId)
  if (existingEvent) return { status: 'idempotent', reason: '该铺布冲销事件已经处理。' }
  const applied = appendRepositoryEvent(item, event, () => {
    item.input.facts.push(...referencedFacts.map((fact) => ({
      ...fact,
      factId: `${fact.factId}:adjust:${input.adjustmentEventId}`,
      sourceEventId: `${fact.sourceEventId}:adjust:${input.adjustmentEventId}`,
      direction: '反向' as const,
      occurredAt: input.occurredAt,
    })))
    item.spreadingAdjustmentKeys.add(sourceKey)
  })
  return applied
    ? { status: 'applied', reason: `已对铺布单 ${input.spreadingOrderNo} 产生反向冲销，放行矩阵排除对应有效裁片贡献。` }
    : { status: 'rejected', reason: '铺布冲销事件写入失败。' }
}

const CUT_PIECE_RELEASE_PRODUCTION_ORDER_ALIASES: Record<string, string> = {
    'PO-202603-0014': 'po-14677',
    'PO-202603-0015': 'po-14673',
    'PO-202603-083': 'po-14672',
    'PO-202603-084': 'po-14671',
    'PO-202603-086': 'po-14671',
}

function resolveCutPieceReleaseProductionOrderId(productionOrderId: string): string {
  return releaseRepository.has(productionOrderId)
    ? productionOrderId
    : CUT_PIECE_RELEASE_PRODUCTION_ORDER_ALIASES[productionOrderId] ?? productionOrderId
}

export function requiresCutPieceReleaseForProcessCodes(processCodes: readonly string[]): boolean {
  const normalized = new Set(processCodes.map((code) => code.trim().toUpperCase()))
  const containsSewing = [...normalized].some((code) => ['SEW', 'SEWING', 'PROC_SEW'].includes(code))
  const containsCutting = [...normalized].some((code) => ['CUT', 'CUTTING', 'CUT_PANEL', 'PROC_CUT'].includes(code))
  return containsSewing && !containsCutting
}

export function getCutPieceReleaseSummaryForProductionOrder(productionOrderId: string): CutPieceReleaseSummary | null {
  const sourceId = resolveCutPieceReleaseProductionOrderId(productionOrderId)
  const item = releaseRepository.get(sourceId)
  const record = listCutPieceReleaseRecords().find((candidate) => candidate.productionOrderId === sourceId)
  if (!record || !item) return null
  const currentCompleteKitQtyByColorSize = Object.fromEntries(item.currentMatrix.colorGroups.flatMap((group) => group.sizes.map((size) => [targetKey(group.garmentColor, size), group.completeKitBySize[size] === null ? null : safeQuantity(group.completeKitBySize[size])])))
  const targetSnapshot = getTargetSnapshot(item)
  const targetQtyByColorSize = targetSnapshot?.targetPreview.colorSizeTargets ? { ...targetSnapshot.targetPreview.colorSizeTargets } : {}
  const totalTargetQty = Object.values(targetQtyByColorSize).reduce((sum, value) => sum + safeInteger(value), 0)
  const latestVersion = getLatestEffectiveVersion(sourceId)
  return {
    recordId: record.recordId,
    recordNo: record.recordNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    decision: record.decision,
    releaseQty: record.releaseQty,
    reason: record.reason,
    riskNote: record.riskNote,
    judgedBy: record.judgedBy,
    judgedAt: record.judgedAt,
    matrixStatus: item.currentMatrix.calculationStatus,
    targetStatus: item.targetStatus,
    currentCompleteKitQtyByColorSize,
    targetQtyByColorSize,
    shortageCellCount: targetPreviewForCurrentMatrix(item)?.differences.filter((difference) => difference.status === '需补').length ?? 0,
    latestMatrixVersion: item.versions[item.versions.length - 1]?.version ?? 0,
    latestUpdatedAt: [item.latestUpdateAt, latestVersion?.confirmedAt || ''].sort().at(-1) || item.latestUpdateAt,
    ppicAvailableDispatchQty: latestVersion?.totalReleaseConfirmQty ?? 0,
    totalReleaseConfirmQty: latestVersion?.totalReleaseConfirmQty ?? 0,
    totalRiskReleaseQty: latestVersion?.totalRiskReleaseQty ?? 0,
    riskReason: latestVersion?.riskReason ?? '',
    releaseAvailableStatus: latestVersion?.releaseStatus ?? deriveReleaseAvailableStatus(item),
    totalTargetQty: latestVersion?.totalTargetQty ?? totalTargetQty,
    latestReleaseVersion: latestVersion?.releaseVersionNo ?? null,
  }
}

function normalizeReadinessText(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

interface ActiveCutPieceAllocationLine {
  assignmentId: string
  runtimeTaskId: string
  skuCode: string
  color: string
  size: string
  qty: number
}

function listActiveCutPieceAllocationLines(
  productionOrderId: string,
  excludeRuntimeTaskIds: readonly string[] = [],
): ActiveCutPieceAllocationLine[] {
  const sourceId = resolveCutPieceReleaseProductionOrderId(productionOrderId)
  const excluded = new Set(excludeRuntimeTaskIds)
  return listEffectiveTaskAssignments()
    .filter((assignment) => (
      assignment.status === 'EFFECTIVE'
      && !excluded.has(assignment.runtimeTaskId)
      && requiresCutPieceReleaseForProcessCodes(assignment.processCodes)
      && resolveCutPieceReleaseProductionOrderId(assignment.productionOrderId) === sourceId
    ))
    .flatMap((assignment) => assignment.skuLines.map((line) => ({
      assignmentId: assignment.assignmentId,
      runtimeTaskId: assignment.runtimeTaskId,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      qty: line.qty,
    })))
}

function matchActiveCutPieceAllocations(
  source: Pick<CutPieceReleaseSkuLine, 'skuCode' | 'colorName' | 'sizeCode'>,
  allocations: ActiveCutPieceAllocationLine[],
): ActiveCutPieceAllocationLine[] {
  const exactSku = allocations.filter((line) => normalizeReadinessText(line.skuCode) === normalizeReadinessText(source.skuCode))
  if (exactSku.length > 0) return exactSku
  return allocations.filter((line) => (
    normalizeReadinessText(line.color) === normalizeReadinessText(source.colorName)
    && normalizeReadinessText(line.size) === normalizeReadinessText(source.sizeCode)
  ))
}

export function getCutPieceDispatchReadinessForTask(input: {
  productionOrderId: string
  productionOrderNo?: string
  skuLines: Array<{ skuCode: string; color: string; size: string; qty: number }>
  excludeRuntimeTaskIds?: string[]
}): CutPieceDispatchReadiness {
  const productionOrderKey = resolveCutPieceReleaseProductionOrderId(input.productionOrderId || input.productionOrderNo || '')
  const record = listCutPieceReleaseRecords().find((candidate) => (
    candidate.productionOrderId === productionOrderKey
    || candidate.productionOrderNo === productionOrderKey
    || candidate.productionOrderId === input.productionOrderNo
    || candidate.productionOrderNo === input.productionOrderNo
  ))
  const missingLines = input.skuLines.map<CutPieceDispatchReadinessSkuLine>((line) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    taskQty: line.qty,
    targetQty: null,
    completeKitQty: null,
    releaseConfirmQty: null,
    riskReleaseQty: null,
    allocatedQty: 0,
    availableQty: null,
    allocationTaskIds: [],
    dispatchAllowed: false,
    status: '待同步',
    reason: '尚未读取到该生产单的裁片齐套、目标与放行记录。',
  }))
  if (!record) {
    return {
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo || input.productionOrderId,
      hasRecord: false,
      recordNo: '',
      targetStatus: '待同步',
      releaseAvailableStatus: '待同步',
      latestUpdatedAt: '',
      lines: missingLines,
      warningCount: missingLines.length,
      blockingCount: missingLines.length,
      canDispatch: false,
    }
  }

  const activeAllocations = listActiveCutPieceAllocationLines(record.productionOrderId, input.excludeRuntimeTaskIds)
  const lines = input.skuLines.map<CutPieceDispatchReadinessSkuLine>((taskLine) => {
    const exact = record.skuLines.find((line) => normalizeReadinessText(line.skuCode) === normalizeReadinessText(taskLine.skuCode))
    const byColorSize = record.skuLines.filter((line) => (
      normalizeReadinessText(line.colorName) === normalizeReadinessText(taskLine.color)
      && normalizeReadinessText(line.sizeCode) === normalizeReadinessText(taskLine.size)
    ))
    const source = exact || (byColorSize.length === 1 ? byColorSize[0] : null)
    if (!source) return { ...missingLines.find((line) => line.skuCode === taskLine.skuCode)!, reason: '裁片记录存在，但该颜色与尺码尚未形成唯一可匹配事实。' }
    const targetQty = record.targetStatus === '已确认' ? source.releaseQty : null
    const completeKitQty = source.completeKitQty
    const releaseConfirmQty = source.releaseConfirmQty
    const riskReleaseQty = source.riskReleaseQty
    const matchedAllocations = matchActiveCutPieceAllocations(source, activeAllocations)
    const allocatedQty = matchedAllocations.reduce((sum, line) => sum + line.qty, 0)
    const availableQty = Math.max(releaseConfirmQty - allocatedQty, 0)
    const allocationTaskIds = [...new Set(matchedAllocations.map((line) => line.runtimeTaskId))]
    let status: CutPieceDispatchReadinessStatus = '已满足'
    let reason = `当前放行 ${releaseConfirmQty} 件，已被有效任务占用 ${allocatedQty} 件，可分配 ${availableQty} 件。`
    let dispatchAllowed = true
    if (targetQty == null) {
      status = '待维护目标'; reason = '裁床尚未确认该 SKU 的目标数量。'; dispatchAllowed = false
    } else if (!['按齐套放行', '风险放行'].includes(record.releaseAvailableStatus)) {
      status = '部分放行'; reason = `当前放行状态为“${record.releaseAvailableStatus}”，裁床须重新确认具体放行数量后才能分配。`; dispatchAllowed = false
    } else if (availableQty < taskLine.qty) {
      status = '部分放行'; reason = `当前放行 ${releaseConfirmQty} 件，已占用 ${allocatedQty} 件，可分配 ${availableQty} 件，少于本次任务 ${taskLine.qty} 件。`; dispatchAllowed = false
    } else if (riskReleaseQty > 0 || completeKitQty < releaseConfirmQty) {
      status = '风险放行'; reason = `本行含 ${riskReleaseQty} 件风险放行；扣除已占用 ${allocatedQty} 件后仍可分配 ${availableQty} 件。`
    }
    return {
      skuCode: taskLine.skuCode,
      color: taskLine.color,
      size: taskLine.size,
      taskQty: taskLine.qty,
      targetQty,
      completeKitQty,
      releaseConfirmQty,
      riskReleaseQty,
      allocatedQty,
      availableQty,
      allocationTaskIds,
      dispatchAllowed,
      status,
      reason,
    }
  })
  const latestReleaseVersion = getLatestEffectiveVersion(record.productionOrderId)
  return {
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    hasRecord: true,
    recordNo: record.recordNo,
    targetStatus: record.targetStatus,
    releaseAvailableStatus: record.releaseAvailableStatus,
    latestUpdatedAt: [record.latestUpdateAt, latestReleaseVersion?.confirmedAt || ''].sort().at(-1) || record.latestUpdateAt,
    lines,
    warningCount: lines.filter((line) => line.status !== '已满足').length,
    blockingCount: lines.filter((line) => !line.dispatchAllowed).length,
    canDispatch: lines.every((line) => line.dispatchAllowed),
  }
}

export function assertCutPieceReleaseDispatchAvailable(input: {
  productionOrderId: string
  productionOrderNo?: string
  skuLines: Array<{ skuCode: string; color: string; size: string; qty: number }>
  excludeRuntimeTaskIds?: string[]
}): CutPieceDispatchReadiness {
  const readiness = getCutPieceDispatchReadinessForTask(input)
  if (readiness.canDispatch) return readiness
  const blocked = readiness.lines.filter((line) => !line.dispatchAllowed)
  const detail = blocked.slice(0, 3).map((line) => `${line.color}/${line.size}：${line.reason}`).join('；')
  throw new Error(`裁片放行不足，不能分配车缝任务。${detail}${blocked.length > 3 ? `；另有${blocked.length - 3}项` : ''}`)
}

export function confirmCutPieceReleaseAvailableQty(
  input: ConfirmCutPieceReleaseAvailableQtyInput,
): ConfirmCutPieceReleaseAvailableQtyResult {
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { ok: false, message: '未找到生产单裁片矩阵。', version: null }

  const targetSnapshot = getTargetSnapshot(item)
  if (!targetSnapshot) return { ok: false, message: '请先维护目标数量。', version: null }

  const matrix = item.currentMatrix
  const expectedKeys = matrix.colorGroups.flatMap((group) =>
    group.sizes.map((size) => targetKey(group.garmentColor, size))
  )

  const inputKeys = Object.keys(input.releaseQtyByColorSize)
  const expectedSet = new Set(expectedKeys)
  const inputSet = new Set(inputKeys)
  if (expectedSet.size !== inputSet.size || ![...inputSet].every((k) => expectedSet.has(k))) {
    return { ok: false, message: '可做放行数量必须严格覆盖当前矩阵的全部颜色尺码，不得包含多余项。', version: null }
  }

  const targetValues = targetSnapshot.targetPreview.colorSizeTargets
  const activeAllocations = listActiveCutPieceAllocationLines(input.productionOrderId)
  let totalRiskReleaseQty = 0
  let totalReleaseQty = 0
  const riskReleaseQtyByColorSize: Record<string, number> = {}
  const targetGapQtyByColorSize: Record<string, number> = {}
  const releaseGapToTargetQtyByColorSize: Record<string, number> = {}
  const surplusKitQtyByColorSize: Record<string, number> = {}

  for (const key of expectedKeys) {
    const [garmentColor, size] = key.split('::')
    const qty = safeInteger(input.releaseQtyByColorSize[key])
    if (qty < 0) return { ok: false, message: `${key} 可做数量不能为负数。`, version: null }
    const targetQty = targetValues[key] ?? 0
    if (qty > targetQty) return { ok: false, message: `${key} 可做数量 ${qty} 不能超过目标数量 ${targetQty}。`, version: null }
    const occupiedLines = activeAllocations.filter((line) => (
      normalizeReadinessText(line.color) === normalizeReadinessText(garmentColor)
      && normalizeReadinessText(line.size) === normalizeReadinessText(size)
    ))
    const occupiedQty = occupiedLines.reduce((sum, line) => sum + line.qty, 0)
    if (qty < occupiedQty) {
      const taskIds = [...new Set(occupiedLines.map((line) => line.runtimeTaskId))]
      return {
        ok: false,
        message: `${key} 放行数量不得低于已分配数量 ${occupiedQty} 件（占用任务：${taskIds.join('、')}）；本次修改未保存。`,
        version: null,
      }
    }

    const group = matrix.colorGroups.find((g) => g.garmentColor === garmentColor)
    const completeKitQtyVal = group?.completeKitBySize[size]
    const completeKitQty = completeKitQtyVal === null ? 0 : safeInteger(completeKitQtyVal ?? 0)
    const riskQtyForLine = Math.max(qty - completeKitQty, 0)
    riskReleaseQtyByColorSize[key] = riskQtyForLine
    totalRiskReleaseQty += riskQtyForLine
    totalReleaseQty += qty

    targetGapQtyByColorSize[key] = Math.max(targetQty - completeKitQty, 0)
    releaseGapToTargetQtyByColorSize[key] = Math.max(targetQty - qty, 0)
    surplusKitQtyByColorSize[key] = Math.max(completeKitQty - targetQty, 0)
  }

  if (totalRiskReleaseQty > 0 && !input.riskReason.trim()) {
    return { ok: false, message: '本次存在风险放行数量，必须填写风险原因。', version: null }
  }

  const versions = releaseVersionRepository.get(input.productionOrderId) || []
  const prevVersion = versions.filter((v) => v.isLatestEffective).at(-1) ?? null

  versions.forEach((v) => { v.isLatestEffective = false })

  const versionNo = versions.length + 1
  const totalTargetQty = Object.values(targetValues).reduce((sum, v) => sum + safeInteger(v), 0)
  const totalCompleteKitQty = matrix.colorGroups.reduce(
    (sum, group) => sum + group.sizes.reduce((s, size) => {
      const qty = group.completeKitBySize[size]
      return s + (qty === null ? 0 : safeInteger(qty))
    }, 0), 0
  )
  const changedLines = prevVersion
    ? expectedKeys.filter((k) => (prevVersion.releaseQtyByColorSize[k] ?? 0) !== (input.releaseQtyByColorSize[k] ?? 0))
    : [...expectedKeys]

  const releaseStatus: CutPieceReleaseAvailableStatus =
    totalReleaseQty === 0 ? '暂不放行'
    : totalRiskReleaseQty > 0 ? '风险放行'
    : '按齐套放行'

  const version: CutPieceReleaseAvailableQtyVersion = {
    releaseVersionId: `cr-avail-${input.productionOrderId}-v${versionNo}`,
    releaseVersionNo: versionNo,
    productionOrderId: input.productionOrderId,
    basisMatrixVersion: input.basisMatrixVersion,
    basisTargetVersion: input.basisTargetVersion,
    releaseQtyByColorSize: { ...input.releaseQtyByColorSize },
    riskReleaseQtyByColorSize,
    targetGapQtyByColorSize,
    releaseGapToTargetQtyByColorSize,
    surplusKitQtyByColorSize,
    totalTargetQty,
    totalCompleteKitQty,
    totalReleaseConfirmQty: totalReleaseQty,
    totalRiskReleaseQty,
    totalReleaseGapToTargetQty: Math.max(totalTargetQty - totalReleaseQty, 0),
    riskReason: input.riskReason,
    confirmedBy: input.confirmedBy,
    confirmedAt: input.confirmedAt,
    isLatestEffective: true,
    releaseStatus,
    beforeTotalReleaseConfirmQty: prevVersion?.totalReleaseConfirmQty ?? 0,
    afterTotalReleaseConfirmQty: totalReleaseQty,
    beforeTotalRiskReleaseQty: prevVersion?.totalRiskReleaseQty ?? 0,
    afterTotalRiskReleaseQty: totalRiskReleaseQty,
    changedColorSizeLines: changedLines,
  }

  versions.push(version)
  releaseVersionRepository.set(input.productionOrderId, versions)

  return { ok: true, message: '放行确认已生成。', version: clone(version) }
}

export function listCutPieceReleaseAvailableQtyVersions(
  productionOrderId: string,
): CutPieceReleaseAvailableQtyVersion[] {
  return clone(releaseVersionRepository.get(productionOrderId) || [])
}

/** 
 * 标记指定生产单的所有有效放行版本为「确认后需复核」。
 * 供外部模块（如菲票数量变化、铺布事件等）在裁片事实变更时调用。
 */
export function markCutPieceReleaseVersionsNeedReview(productionOrderId: string): void {
  const versions = releaseVersionRepository.get(productionOrderId)
  versions?.forEach((v) => {
    if (v.isLatestEffective && v.releaseStatus !== '确认后需复核') {
      v.releaseStatus = '确认后需复核'
    }
  })
}

export function calculateMissingPieceQty(productionOrderId: string): SupplementPartShortage[] {
  const item = releaseRepository.get(productionOrderId)
  if (!item) return []
  const snapshot = getTargetSnapshot(item)
  if (!snapshot) return []
  const targetValues = snapshot.targetPreview.colorSizeTargets
  return item.input.requirements.flatMap((requirement) => {
    const piecesPerGarment = requirement.piecesPerGarment ?? 0
    if (!piecesPerGarment) return []
    return Object.entries(targetValues).flatMap(([key, targetQty]) => {
      const [garmentColor, size] = key.split('::')
      if (requirement.garmentColor && requirement.garmentColor !== garmentColor) return []
      if (requirement.size && requirement.size !== size) return []
      const facts = item.input.facts.filter((fact) =>
        fact.garmentColor === garmentColor && fact.size === size
        && fact.materialId === requirement.materialId && fact.partId === requirement.partId
        && fact.direction === '正向' && fact.sourceStatus !== '已冲销'
      )
      const actualPieceQty = facts.reduce((sum, fact) => sum + fact.actualPieceQty, 0)
      const missingPieceQty = Math.max(targetQty * piecesPerGarment - actualPieceQty, 0)
      if (missingPieceQty <= 0) return []
      return [{
        garmentColor, size,
        materialId: requirement.materialId,
        materialName: requirement.materialName,
        partId: requirement.partId,
        partName: requirement.partName,
        targetQty,
        actualPieceQty,
        piecesPerGarment,
        actualMissingPieceQty: missingPieceQty,
        supplementGarmentQty: targetQty,
      }]
    })
  })
}

export function saveCutPieceReleaseDecision(input: SaveCutPieceReleaseDecisionInput): { ok: boolean; message: string } {
  const record = getCutPieceReleaseRecord(input.recordId)
  if (!record) return { ok: false, message: '未找到裁片放行记录。' }
  return { ok: false, message: '请在裁片矩阵中确认目标数量；旧放行判断入口不再写入权威数据。' }
}
