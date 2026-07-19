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
  spreadingOrderNo?: string
  matrixSnapshot: CutPieceReleaseMatrix
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
}

const deterministicConfirmedAt = '2026-06-03 16:00:00'
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
  }
  appendMatrixEvent(item.eventState, initialEvent)
  addVersion(item, initialEvent)
  releaseRepository.set(input.productionOrderId, item)
}

function bootstrapRepository(): void {
  const productionOrderId = 'po-14671'
  const sizes = ['M', 'L', 'XL'] as const
  const quantities: Record<string, Record<(typeof sizes)[number], number>> = {
    A: { M: 220, L: 358, XL: 532 },
    B: { M: 200, L: 350, XL: 500 },
    C: { M: 208, L: 364, XL: 520 },
    D: { M: 200, L: 350, XL: 500 },
  }
  const requirements = [
    { materialId: 'A', materialName: '面料 A', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'B', materialName: '里料 B', partId: 'front', partName: '前片', piecesPerGarment: 2 },
    { materialId: 'C', materialName: '辅料 C', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
    { materialId: 'D', materialName: '辅料 D', partId: 'cuff', partName: '袖口', piecesPerGarment: 1 },
  ]
  const facts: CutPieceFact[] = Object.entries(quantities).flatMap(([materialId, qtyBySize]) => sizes.map((size) => ({
    factId: `fact-14671-${materialId}-${size}`,
    sourceEventId: `spread-14671-${materialId}-${size}`,
    productionOrderId,
    cutOrderId: materialId === 'B' ? 'cut-14671-b' : 'cut-14671-a',
    cutOrderNo: materialId === 'B' ? 'CUT14671-B' : 'CUT14671-A',
    spreadingOrderNo: 'ASYSA26060310',
    garmentColor: 'Black',
    size,
    materialId,
    partId: materialId === 'A' || materialId === 'B' ? 'front' : materialId === 'C' ? 'collar' : 'cuff',
    actualPieceQty: qtyBySize[size] * (materialId === 'B' ? 2 : 1),
    direction: '正向' as const,
    sourceStatus: materialId === 'B' ? '已冻结' as const : '持续更新' as const,
    occurredAt: '2026-06-03 14:00:00',
  })))
  addRepositoryItem({
    productionOrderId,
    productionOrderNo: 'PO14671',
    spuCode: 'ASYSA26060310',
    planQtyByColorSize: { Black: { M: 215, L: 344, XL: 482 } },
    requirements,
    facts,
  }, '女式基础圆领短袖', ['CUT14671-A', 'CUT14671-B'], {
    eventId: 'spread-complete-14671',
    eventType: '铺布完成',
    productionOrderId,
    occurredAt: '2026-06-03 14:00:00',
    operator: '铺布操作员 阿迪',
  })
  const item = releaseRepository.get(productionOrderId)!
  item.sourceStates = [
    { cutOrderId: 'cut-14671-a', cutOrderNo: 'CUT14671-A', status: '持续更新', changedAt: '2026-06-03 14:00:00', operator: '铺布操作员 阿迪', reason: '铺布完成后持续更新', materialIds: ['A', 'C', 'D'] },
    { cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', changedAt: '2026-06-03 14:00:00', operator: '裁床主管 王敏', reason: '已关闭，数据已冻结', materialIds: ['B'] },
  ]
  item.activeSpreadingOrderNosByCutOrder = { 'cut-14671-a': ['PB-14671-A-进行中'], 'cut-14671-b': [] }
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
    const affectedMaterialIds = new Set(item.input.facts.filter((fact) => fact.cutOrderId === source.cutOrderId).map((fact) => fact.materialId))
    const affectedCells = item.currentMatrix.colorGroups.flatMap((group) => group.materialRows
      .filter((row) => affectedMaterialIds.has(row.materialId))
      .flatMap((row) => row.cells.map((cell) => ({
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

export function listCutPieceReleaseMatrixVersions(productionOrderId: string): CutPieceReleaseMatrixVersion[] {
  const item = releaseRepository.get(productionOrderId)
  return item ? item.versions.map(clone) : []
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
  })
  return applied
    ? { status: 'applied', reason: `已对铺布单 ${input.spreadingOrderNo} 产生反向冲销，放行矩阵排除对应有效裁片贡献。` }
    : { status: 'rejected', reason: '铺布冲销事件写入失败。' }
}

export function getCutPieceReleaseSummaryForProductionOrder(productionOrderId: string): CutPieceReleaseSummary | null {
  const record = listCutPieceReleaseRecords().find((item) => item.productionOrderId === productionOrderId)
  if (!record) return null
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
  }
}

export function saveCutPieceReleaseDecision(input: SaveCutPieceReleaseDecisionInput): { ok: boolean; message: string } {
  const record = getCutPieceReleaseRecord(input.recordId)
  if (!record) return { ok: false, message: '未找到裁片放行记录。' }
  return { ok: false, message: '请在裁片矩阵中确认目标数量；旧放行判断入口不再写入权威数据。' }
}
