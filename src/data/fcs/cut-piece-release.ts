import {
  appendMatrixEvent,
  buildReleaseMatrix,
  buildTargetPreview,
  createMatrixEventState,
  type BuildReleaseMatrixInput,
  type CutPieceFact,
  type CutPieceReleaseMatrix,
  type MatrixEvent,
  type MatrixEventState,
  type MatrixEventType,
  type MatrixTargetStatus,
  type ReleaseTargetPreview,
} from './cut-piece-release-domain.ts'

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

function clone<T>(value: T): T {
  return structuredClone(value)
}

function safeQuantity(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
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

function buildSkuLines(item: ReleaseRepositoryItem): CutPieceReleaseSkuLine[] {
  const snapshot = getTargetSnapshot(item)
  const targetValues = item.targetStatus === '已确认' ? snapshot?.targetPreview.colorSizeTargets ?? {} : {}
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
      reason: releaseQty > 0 ? '已按当前矩阵确认目标数量' : '等待基于矩阵确认目标数量',
    }
  }))
}

function buildReleaseRecord(item: ReleaseRepositoryItem): CutPieceReleaseRecord {
  const snapshot = getTargetSnapshot(item)
  const skuLines = buildSkuLines(item)
  const preview = targetPreviewForCurrentMatrix(item)
  const frozenCutOrderCount = new Set(item.input.facts
    .filter((fact) => fact.sourceStatus === '已冻结')
    .map((fact) => fact.cutOrderId || fact.cutOrderNo)
    .filter(Boolean)).size
  const targetConfirmed = item.targetStatus === '已确认' && Boolean(snapshot)
  const releaseQty = skuLines.reduce((sum, line) => sum + line.releaseQty, 0)
  return {
    recordId: `cpr-${item.input.productionOrderId}`,
    recordNo: `CPR-${item.input.productionOrderNo.replace(/^PO/, '')}`,
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
    decision: targetConfirmed ? '可以做' : '待判断',
    releaseQty,
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
    ...spreadingEvents.map((event) => ({ cutOrderId: event.cutOrderId, cutOrderNo: event.cutOrderNo, status: '持续更新' as const, changedAt: event.occurredAt, operator: event.operator, reason: event.reason, materialIds: ['A', 'C', 'D'] })),
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
}

bootstrapRepository()

export function resetCutPieceReleasePrototypeStoreForTesting(): void {
  releaseRepository.clear()
  targetSnapshots.clear()
  lateEvents.clear()
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
    if (!before && after?.quantity === null) return false
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

export function getCutPieceReleaseSummaryForProductionOrder(productionOrderId: string): CutPieceReleaseSummary | null {
  const sourceId = releaseRepository.has(productionOrderId) ? productionOrderId : ({
    'PO-202603-084': 'po-14671',
    'PO-202603-086': 'po-14671',
  } as Record<string, string>)[productionOrderId] ?? productionOrderId
  const item = releaseRepository.get(sourceId)
  const record = listCutPieceReleaseRecords().find((candidate) => candidate.productionOrderId === sourceId)
  if (!record || !item) return null
  const currentCompleteKitQtyByColorSize = Object.fromEntries(item.currentMatrix.colorGroups.flatMap((group) => group.sizes.map((size) => [targetKey(group.garmentColor, size), group.completeKitBySize[size] === null ? null : safeQuantity(group.completeKitBySize[size])])))
  const targetSnapshot = getTargetSnapshot(item)
  const targetQtyByColorSize = targetSnapshot?.targetPreview.colorSizeTargets ? { ...targetSnapshot.targetPreview.colorSizeTargets } : {}
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
    latestUpdatedAt: item.latestUpdateAt,
  }
}

export function saveCutPieceReleaseDecision(input: SaveCutPieceReleaseDecisionInput): { ok: boolean; message: string } {
  const record = getCutPieceReleaseRecord(input.recordId)
  if (!record) return { ok: false, message: '未找到裁片放行记录。' }
  return { ok: false, message: '请在裁片矩阵中确认目标数量；旧放行判断入口不再写入权威数据。' }
}
