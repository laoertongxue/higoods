import { localDateTimeText } from '../../utils.ts'
import {
  appendMatrixEvent,
  buildReleaseMatrix,
  buildTargetPreview,
  buildTargetDifferences,
  buildSupplementPartShortages,
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
import { getBrowserLocalStorage, isBrowserBusinessStorageStaged } from '../browser-storage.ts'
import {commitCuttingRecords,readCuttingRecords,readCuttingCommand,diffCuttingRecords,validateCutPieceReleaseStoredRecords,type CuttingStoredRecord,type CuttingRecordSnapshot} from './cutting/cutting-record-repository.ts'
import {cuttingRecordUuid,cuttingRecordFingerprint} from './cutting/cutting-record-identity.ts'
import {hydrateCutPieceTicketValidity,isCutPieceTicketUsable,getCutPieceTicketValidity} from './cutting/cut-piece-ticket-validity.ts'
export {saveCutPieceReleaseTicketValidityAction} from './cutting/cut-piece-ticket-validity.ts'
import { listEffectiveTaskAssignments } from './effective-task-assignments.ts'
import type { buildGeneratedCutReleaseInputs } from './cutting/generated-cut-release.ts'
import { reviewedStyleImage } from '../pcs-reviewed-image-catalog.ts'

export type CutPieceReleaseDecision = '待判断' | '可以做' | '部分可以做' | '暂时不能做'

export interface CutPieceReleaseSkuLine {
  lineId: string
  skuCode: string
  colorName: string
  sizeCode: string
  demandQty: number
  remainingQty: number
  cutCompletedQty: number
  completeKitQty: number | null
  accessoryReadyQty: number | null
  releaseQty: number
  releaseConfirmQty: number
  riskReleaseQty: number | null
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
  riskReleaseQty: number | null
  totalTargetQty: number
  requiresReview: boolean
  factChangeMessage: string
  historicalRiskReleaseQty: number
}

export interface CutPieceReleaseSourceState {
  cutOrderId: string
  cutOrderNo: string
  status: '已冻结' | '持续更新'
  changedAt: string
  operator: string
  reason: string
  materialIds: string[]
  frozenTicketIds?: string[]
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
  ticketId?: string
  sourceType?: string
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
  totalRiskReleaseQty: number | null
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
  allocatedQtyByColorSize?: Record<string, number>
  completeKitQtyByColorSize?: Record<string, number | null>
  targetQtyByColorSize?: Record<string, number>
  sourceFactIds?: string[]
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
  generatedSkuCodes?: Record<string, string>
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
  requiresReview?: boolean
  factChangeMessage?: string
}

const deterministicConfirmedAt = '2026-06-03 17:00:00'
const targetSnapshots = new Map<string, CutPieceReleaseTargetSnapshot>()
const releaseRepository = new Map<string, ReleaseRepositoryItem>()
const lateEvents = new Map<string, LateCutPieceReleaseEvent>()
const releaseVersionRepository = new Map<string, CutPieceReleaseAvailableQtyVersion[]>()
const GENERATED_RELEASE_STORAGE_KEY = 'higood-generated-cut-piece-release-v1'
let loadedGeneratedReleaseRaw: string | null | undefined
let buildingStaticReleaseFixtures = false
let readReleaseStyleImage: ((productionOrderId: string, spuCode: string) => string) | undefined
// 仅绑定已核对的静态示例；未知款式不能借用同类图片。素材对应表见本次产品方案 19.15。
const RELEASE_DEMO_STYLE_IMAGES: Record<string, string> = {
  ASYSA26060310: reviewedStyleImage('ASYSA26060310'),
  ASYSA26060311: '/materials/pcs-reviewed/shirt-blue.jpg',
  ASYSA26060312: '/cardigan-sample.jpg',
  ASYSA26060313: '/materials/pcs-reviewed/cargo-black.jpg',
  ASYSA26060314: '/materials/cut-piece-release/girl-ruffle-pink.jpg',
  ASYSA26060315: '/materials/pcs-reviewed/blazer-white.png',
  ASYSA26060316: '/materials/pcs-reviewed/hood-grey.jpg',
  ASYSA26060317: '/materials/pcs-reviewed/linen-dress-white.jpg',
}

function readSavedGeneratedRelease(): void { /* 保存的业务覆盖由显式异步 hydration 读取 IndexedDB。 */ }

function withSavedRelease<T>(operation: () => T, failure: (message: string) => T, productionOrderId?: string): T {
  if (buildingStaticReleaseFixtures) return operation()
  try { syncGeneratedCutPieceRelease() } catch (error) { return failure(error instanceof Error ? error.message : String(error)) }
  // 单生产单确认只会修改该单的事实；其余记录保留引用及 Map 顺序即可回滚。
  // 跨对象操作仍保留完整快照，避免扩大本次性能调整的业务范围。
  const capture = <V>(repository: Map<string, V>, belongsToOrder: (value: V, key: string) => boolean): Map<string, V> =>
    new Map([...repository].map(([key, value]) => [key, belongsToOrder(value, key) ? structuredClone(value) : value]))
  const before = productionOrderId ? {
    releaseRepository: capture(releaseRepository, item => item.input.productionOrderId === productionOrderId),
    targetSnapshots: capture(targetSnapshots, item => item.productionOrderId === productionOrderId),
    releaseVersionRepository: capture(releaseVersionRepository, (_item, key) => key === productionOrderId),
    lateEvents: capture(lateEvents, item => item.productionOrderId === productionOrderId),
  } : structuredClone({ releaseRepository, targetSnapshots, releaseVersionRepository, lateEvents })
  try {
    const result = operation()
    if (typeof window !== 'undefined' && !isBrowserBusinessStorageStaged()) throw new Error('请使用异步保存动作，不能仅更新内存后显示成功。')
    return result
  } catch (error) {
    const restore = <V>(target: Map<string, V>, source: Map<string, V>) => { target.clear(); for (const [key, value] of source) target.set(key, value) }
    restore(releaseRepository, before.releaseRepository); restore(targetSnapshots, before.targetSnapshots)
    restore(releaseVersionRepository, before.releaseVersionRepository); restore(lateEvents, before.lateEvents)
    return failure(`本次未保存，已保留原放行记录：${error instanceof Error ? error.message : String(error)}`)
  }
}

let releaseReadDepth=0
let releaseReadSynced=false
/** 同一次同步页面投影只准备一份数量事实；离开作用域后下一动作重新读取。 */
export function withCutPieceReleaseReadSnapshot<T>(read:()=>T):T {
  const outer=releaseReadDepth===0
  if(outer)releaseReadSynced=false
  releaseReadDepth++
  try {syncGeneratedCutPieceRelease();return read()}finally{releaseReadDepth--;if(outer)releaseReadSynced=false}
}
let syncingGeneratedRelease = false
let readGeneratedReleaseInputs: (() => ReturnType<typeof buildGeneratedCutReleaseInputs>) | null = null
let readSourceTicketIds: ((cutOrderId:string)=>string[]) | null=null
// 页面加载后接入原产出读取，避免放行域反向导入任务初始化形成循环依赖。
export function setGeneratedCutReleaseReader(reader: () => ReturnType<typeof buildGeneratedCutReleaseInputs>): void {
  readGeneratedReleaseInputs = reader
}

function syncGeneratedCutPieceRelease(): void {
  if (buildingStaticReleaseFixtures) return
  if (syncingGeneratedRelease || releaseReadDepth>0 && releaseReadSynced) return
  syncingGeneratedRelease = true
  try {
    readSavedGeneratedRelease()
    for(const item of releaseRepository.values()) if(!item.generatedSkuCodes) {
      let changed=false
      for(const fact of item.input.facts) if(fact.ticketDetail) {
        const ticket=fact.ticketDetail,valid=isCutPieceTicketUsable(ticket.ticketId)
        const original=staticReleaseState.releaseRepository.get(item.input.productionOrderId)?.input.facts.find(row=>row.factId===fact.factId)?.ticketDetail
        const physical=valid?(original?.physicalPieceQty ?? ticket.physicalPieceQty):0
        const eligible=valid?(original?.eligiblePieceQty ?? ticket.eligiblePieceQty):0
        if(ticket.validity!==(valid?'可用':'不可用') || ticket.physicalPieceQty!==physical || ticket.eligiblePieceQty!==eligible) {
          ticket.validity=valid?'可用':'不可用';ticket.physicalPieceQty=physical;ticket.eligiblePieceQty=eligible;fact.actualPieceQty=eligible;fact.physicalPieceQty=physical;changed=true
        }
      }
      if(changed) {const latest=item.input.facts.flatMap(fact=>fact.ticketDetail ? [getCutPieceTicketValidity(fact.ticketDetail.ticketId)]:[]).filter((value):value is NonNullable<typeof value>=>Boolean(value)).sort((a,b)=>a.at.localeCompare(b.at)).at(-1);appendRepositoryEvent(item,{eventId:`ticket-validity:${latest?.id || item.input.productionOrderId}`,eventType:'铺布完成',productionOrderId:item.input.productionOrderId,occurredAt:latest?.at || item.latestUpdateAt,operator:latest?.operator || '裁床主管',reason:'整票可用性发生变化'},()=>{})}
    }
    for (const projection of readGeneratedReleaseInputs?.() || []) {
      const { input, latestAt, operator } = projection
      let item = releaseRepository.get(input.productionOrderId)
      if (!item && !input.requirements.length) continue
      const event: MatrixEvent = { eventId: `actual-cut-sync:${input.productionOrderId}:${(item?.versions.length || 0) + 1}`,
        eventType: '铺布完成', productionOrderId: input.productionOrderId,
        occurredAt: latestAt || item?.latestUpdateAt || '', operator: operator || '原裁剪记录', reason: '读取有效装袋菲票与最终工艺实收' }
      if (!item) {
        addRepositoryItem(input, projection.sources[0].styleName, projection.sources.map(source => source.cutOrderNo), event)
        item = releaseRepository.get(input.productionOrderId)!
      } else {
        const frozen = new Set(item.sourceStates.filter(source => source.status === '已冻结').map(source => source.cutOrderId))
        const allowedFrozenTicket=(fact:CutPieceFact)=>Boolean(fact.ticketDetail && (item!.sourceStates.find(source=>source.cutOrderId===fact.cutOrderId)?.frozenTicketIds || item!.input.facts.filter(old=>old.cutOrderId===fact.cutOrderId).flatMap(old=>old.ticketDetail?[old.ticketDetail.ticketId]:[])).includes(fact.ticketDetail.ticketId))
        const nextFacts = input.facts.filter(fact => !frozen.has(fact.cutOrderId || '') || allowedFrozenTicket(fact))
        for(const fact of nextFacts)if(frozen.has(fact.cutOrderId || ''))fact.sourceStatus='已冻结'
        for (const fact of input.facts.filter(fact => frozen.has(fact.cutOrderId || '') && !allowedFrozenTicket(fact))) {
          if (!item.input.facts.some(old => old.factId === fact.factId && old.actualPieceQty === fact.actualPieceQty)) {
            recordLateCutPieceReleaseEvent({ eventId: fact.factId, productionOrderId: input.productionOrderId,
              cutOrderId: fact.cutOrderId!, cutOrderNo: fact.cutOrderNo!, spreadingOrderNo: fact.spreadingOrderNo!,
              ticketId:fact.ticketDetail?.ticketId,sourceType:fact.ticketDetail?.sourceType,
              arrivedAt: fact.occurredAt, reason: '冻结后新增实际裁剪产出，待原裁片单恢复后复核',
              facts: [{ garmentColor: fact.garmentColor, size: fact.size, materialId: fact.materialId, actualPieceQty: fact.actualPieceQty }] })
          }
        }
        nextFacts.push(...item.input.facts.filter(fact => (frozen.has(fact.cutOrderId || '') && !fact.ticketDetail) || fact.direction === '反向'))
        input.facts = nextFacts
        if (JSON.stringify(item.input) !== JSON.stringify(input)) {
          appendRepositoryEvent(item, event, () => { item!.input = clone(input) })
        }
        for (const late of lateEvents.values()) {
          if (late.productionOrderId === input.productionOrderId && !frozen.has(late.cutOrderId)
            && input.facts.some(fact => fact.factId === late.eventId)) late.status = '已处理'
        }
      }
      item.generatedSkuCodes = Object.fromEntries(projection.sources.flatMap(source => source.skuScopeLines.map(sku => [targetKey(sku.color, sku.size), sku.skuCode])))
      for (const source of projection.sources) {
        if (!item.sourceStates.some(state => state.cutOrderId === source.cutOrderId)) item.sourceStates.push({
          cutOrderId: source.cutOrderId, cutOrderNo: source.cutOrderNo, status: '持续更新', changedAt: latestAt,
          operator, reason: '原裁剪产出', materialIds: input.requirements.filter(row => row.materialId.startsWith(source.materialSku + '::') || row.materialId === source.materialSku).map(row => row.materialId),
        })
      }
    }
  } finally { syncingGeneratedRelease = false;if(releaseReadDepth>0)releaseReadSynced=true }
}

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
  if (item.latestSnapshotId && event.eventType !== '目标确认') {
    item.requiresReview = true
    item.factChangeMessage = event.reason || '装袋、回仓或有效数量已变化，请核对当前差异。'
  }
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
    return buildTargetDifferences(item.currentMatrix, snapshot.targetPreview.colorSizeTargets)
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
  return versions?.filter((v) => v.isLatestEffective).at(-1) ?? null
}

function buildSkuLines(item: ReleaseRepositoryItem): CutPieceReleaseSkuLine[] {
  const snapshot = getTargetSnapshot(item)
  const targetValues = snapshot?.targetPreview.colorSizeTargets ?? {}
  const latestVersion = getLatestEffectiveVersion(item.input.productionOrderId)
  return item.currentMatrix.colorGroups.flatMap((group) => group.sizes.map((size) => {
    const completeKitQty = group.completeKitBySize[size] ?? null
    const demandQty = safeQuantity(group.planQtyBySize[size])
    const releaseQty = safeQuantity(targetValues[targetKey(group.garmentColor, size)])
    return {
      lineId: `${item.input.productionOrderId}:${group.garmentColor}:${size}`,
      skuCode: item.generatedSkuCodes?.[targetKey(group.garmentColor, size)] || `${item.input.spuCode}-${group.garmentColor}-${size}`,
      colorName: group.garmentColor,
      sizeCode: size,
      demandQty,
      remainingQty: demandQty,
      cutCompletedQty: safeQuantity(Math.min(...group.materialRows.map(row=>row.cells.find(cell=>cell.size===size)?.physicalGarmentQty ?? 0))),
      completeKitQty,
      accessoryReadyQty: null,
      releaseQty,
      releaseConfirmQty: safeInteger(latestVersion?.releaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0),
      riskReleaseQty: completeKitQty===null?null:Math.max(safeInteger(latestVersion?.releaseQtyByColorSize[targetKey(group.garmentColor, size)] ?? 0) - completeKitQty, 0),
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
    styleImageUrl: readReleaseStyleImage?.(item.input.productionOrderId, item.input.spuCode)
      || RELEASE_DEMO_STYLE_IMAGES[item.input.spuCode] || reviewedStyleImage(item.input.spuCode),
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
    riskNote: item.requiresReview ? item.factChangeMessage || '裁片事实已变化，请核对差异。' : '',
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
    riskReleaseQty: skuLines.some(line=>line.riskReleaseQty===null)?null:skuLines.reduce((sum,line)=>sum+(line.riskReleaseQty ?? 0),0),
    totalTargetQty,
    requiresReview: Boolean(item.requiresReview),
    factChangeMessage: item.factChangeMessage || '',
    historicalRiskReleaseQty: latestVersion?.totalRiskReleaseQty || 0,
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
  const confirmSeedRelease = (input: ConfirmCutPieceReleaseAvailableQtyInput) =>
    confirmCutPieceReleaseAvailableQtyInMemory(input, { skipActiveAllocationCheck: true })
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
    { materialId: 'A', materialName: '面料 A', materialImageUrl: '/materials/fabric-main.jpg', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'B', materialName: '里料 B', materialImageUrl: '/materials/fabric-contrast.jpg', partId: 'front', partName: '前片', piecesPerGarment: 2 },
    { materialId: 'C', materialName: '辅料 C', materialImageUrl: '/materials/fabric-lining.jpg', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
    { materialId: 'D', materialName: '辅料 D', materialImageUrl: '/materials/accessory-label.jpg', partId: 'cuff', partName: '袖口', piecesPerGarment: 1 },
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
    { materialId: 'FAB', materialName: '主面料', materialImageUrl: '/materials/process-orders/white-cotton-jersey.jpg', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'LIN', materialName: '里料', materialImageUrl: '/materials/process-orders/pale-grey-50d-stretch-lining.jpg', partId: 'body', partName: '衣身里', piecesPerGarment: 1 },
    { materialId: 'CUF', materialName: '袖口辅料', materialImageUrl: '/materials/pcs-reviewed/rib-blue.jpg', partId: 'cuff', partName: '袖口', piecesPerGarment: 2 },
  ]
  const incompleteRequirements: CutPieceRequirement[] = [
    { materialId: 'FAB', materialName: '主面料', materialImageUrl: '/materials/process-orders/white-cotton-jersey.jpg', partId: 'front', partName: '前片', piecesPerGarment: 1 },
    { materialId: 'LIN', materialName: '里料', materialImageUrl: '/materials/process-orders/pale-grey-50d-stretch-lining.jpg', partId: 'body', partName: '衣身里' },
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
      { materialId: 'FAB', materialName: 'Hoodie 抓绒主面料', materialImageUrl: '/materials/fei-ticket/fog-grey-sweatshirt-fleece.png', partId: 'body', partName: '衣身', piecesPerGarment: 1 },
      { materialId: 'LIN', materialName: '帽里布', materialImageUrl: '/materials/process-orders/pale-grey-50d-stretch-lining.jpg', partId: 'hood-lining', partName: '帽里', piecesPerGarment: 1 },
      { materialId: 'RIB', materialName: '罗纹', materialImageUrl: '/materials/pcs-reviewed/rib-blue.jpg', partId: 'cuff', partName: '袖口与下摆', piecesPerGarment: 2 },
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
  const hoodieRelease = confirmSeedRelease({
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
  confirmSeedRelease({
    productionOrderId: 'po-14672', basisMatrixVersion: 1, basisTargetVersion: 1,
    releaseQtyByColorSize: {
      '雾蓝::S': 165, '雾蓝::M': 245, '雾蓝::L': 200,
      '浅灰::S': 112, '浅灰::M': 185, '浅灰::L': 145,
    },
    riskReason: '', confirmedBy: '裁床主管 王敏', confirmedAt: '2026-07-25 09:30:00',
  })
  confirmSeedRelease({
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
  confirmSeedRelease({
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
  confirmSeedRelease({
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
  confirmSeedRelease({
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

function buildStaticReleaseFixtures(): void {
  buildingStaticReleaseFixtures = true
  try {
    bootstrapRepository()
    for(const item of releaseRepository.values()) {
      for(const fact of item.input.facts) {
        const requirement=item.input.requirements.find(row=>row.materialId===fact.materialId && row.partId===fact.partId)
        fact.physicalPieceQty=fact.actualPieceQty
        fact.ticketDetail={ticketId:`DEMO-TICKET:${fact.factId}`,ticketNo:`FT-DEMO:${fact.factId}`,sourceType:'静态演示已装袋菲票',sourceNo:fact.spreadingOrderNo || '',cutOrderNo:fact.cutOrderNo || '',spreadingOrderNo:fact.spreadingOrderNo,
          garmentColor:fact.garmentColor,size:fact.size,fabricColor:requirement?.materialName || '',materialId:fact.materialId,materialName:requirement?.materialName || fact.materialId,partId:fact.partId,partName:requirement?.partName || fact.partId,
          printedPieceQty:fact.actualPieceQty,physicalPieceQty:fact.actualPieceQty,eligiblePieceQty:fact.actualPieceQty,validity:'可用',bagCode:`BAG-DEMO:${fact.factId}`,bagUseId:`USE-DEMO:${fact.factId}`,locationLabel:'裁床待交出仓（静态演示）',requiresSpecialCraft:false,craftRequirementKnown:true,craftSteps:[]}
        // These two static prototype scenarios do not create warehouse receipts or modify user records.
        if (item.input.productionOrderId === 'po-14677' && fact.garmentColor === '松石绿' && fact.materialId === 'FAB') {
          const pendingReturn = fact.size === 'M'
          const printedQty = fact.actualPieceQty
          const firstReturnQty = printedQty - 2
          const finalReturnQty = pendingReturn ? null : printedQty - 3
          const physicalQty = finalReturnQty ?? firstReturnQty
          const receiptPrefix = `DEMO-RECEIPT-14677-${fact.size}`
          fact.physicalPieceQty = physicalQty
          fact.actualPieceQty = finalReturnQty ?? 0
          Object.assign(fact.ticketDetail, {
            physicalPieceQty: physicalQty, eligiblePieceQty: finalReturnQty ?? 0, requiresSpecialCraft: true,
            locationLabel: pendingReturn ? '末道工艺已交出，等待裁床回仓（静态演示）' : '裁床待交出仓（静态演示）',
            differenceReason: pendingReturn ? '静态演示：第一道实收少2片，末道尚未回仓。' : '静态演示：第一道实收少2片，末道再少1片；最终实收87片。',
            craftSteps: [
              { sequence: 1, craftId: 'DEMO-CRAFT-HEAT-TRANSFER', craftName: '烫画', craftType: '辅助工艺', factoryName: '演示烫画厂', expectedQty: printedQty, processedQty: printedQty, handedOverQty: printedQty, returnedQty: firstReturnQty, status: '已回仓', receiptId: `${receiptPrefix}-1`, returnedAt: '2026-07-24 09:00:00', returnedBy: '演示裁床仓管 Siti' },
              { sequence: 2, craftId: 'DEMO-CRAFT-EMBROIDERY', craftName: '绣花', craftType: '特种工艺', factoryName: '演示绣花厂', expectedQty: firstReturnQty, processedQty: firstReturnQty, handedOverQty: firstReturnQty, returnedQty: firstReturnQty, status: '已回仓', receiptId: `${receiptPrefix}-2`, returnedAt: '2026-07-24 14:00:00', returnedBy: '演示裁床仓管 Siti' },
              { sequence: 3, craftId: 'DEMO-CRAFT-RHINESTONE', craftName: '烫钻', craftType: '辅助工艺', factoryName: '演示烫钻厂', expectedQty: firstReturnQty, processedQty: firstReturnQty, handedOverQty: firstReturnQty, returnedQty: finalReturnQty, status: pendingReturn ? '待回仓' : '已回仓', ...(pendingReturn ? {} : { receiptId: `${receiptPrefix}-3`, returnedAt: '2026-07-25 15:00:00', returnedBy: '演示裁床仓管 Siti' }) },
            ],
            ...(pendingReturn ? {} : { receiptId: `${receiptPrefix}-3`, returnedAt: '2026-07-25 15:00:00', returnedBy: '演示裁床仓管 Siti' }),
          })
        }
      }
      rebuildMatrix(item)
    }
  } finally { buildingStaticReleaseFixtures = false }
}
buildStaticReleaseFixtures()

export function resetCutPieceReleasePrototypeStoreForTesting(): void {
  releaseRepository.clear()
  targetSnapshots.clear()
  lateEvents.clear()
  releaseVersionRepository.clear()
  buildStaticReleaseFixtures()
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
  if (!source || sourceState?.status !== '已冻结' || (!input.spreadingOrderNo?.trim() && !input.ticketId?.trim()) || !input.arrivedAt.trim()) return
  lateEvents.set(eventId, clone({
    ...input,
    eventId,
    cutOrderId: source.cutOrderId,
    cutOrderNo: source.cutOrderNo,
    spreadingOrderNo: input.spreadingOrderNo?.trim() || '',
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
  syncGeneratedCutPieceRelease()
  return [...releaseRepository.values()].map((item) => clone(buildReleaseRecord(item)))
}

export function getCutPieceReleaseRecord(recordId: string): CutPieceReleaseRecord | null {
  return listCutPieceReleaseRecords().find((record) => record.recordId === recordId) ?? null
}

export function getCutPieceReleaseMatrix(productionOrderId: string): CutPieceReleaseMatrix | null {
  syncGeneratedCutPieceRelease()
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
    cutOrderNos: [...new Set(facts.map((fact) => fact.cutOrderNo).filter((value): value is string => Boolean(value)))],
    spreadingOrderNos: [...new Set(facts.map((fact) => fact.spreadingOrderNo).filter((value): value is string => Boolean(value)))],
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

function confirmCutPieceReleaseTargetInMemory(input: ConfirmReleaseTargetInput): ConfirmReleaseTargetResult {
  syncGeneratedCutPieceRelease()
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { ok: false, message: '未找到生产单裁片矩阵。', snapshot: null }
  const confirmedAt = item.generatedSkuCodes ? localDateTimeText() : deterministicConfirmedAt
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
      occurredAt: confirmedAt,
      operator: confirmedBy,
    }
    if (!appendMatrixEvent(item.eventState, event)) return { ok: false, message: '该矩阵版本的目标已确认。', snapshot: null }
    item.targetStatus = '已确认'
    item.requiresReview = Boolean(getLatestEffectiveVersion(input.productionOrderId))
    item.factChangeMessage = item.requiresReview ? '确认目标已调整，请核对原放行并维持或调整。' : ''
    addVersion(item, event)
    const snapshot: CutPieceReleaseTargetSnapshot = {
      snapshotId: `cpr-target-${input.productionOrderId}-v${input.matrixVersion}`,
      productionOrderId: input.productionOrderId,
      matrixVersion: input.matrixVersion,
      confirmedAt,
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
  syncGeneratedCutPieceRelease()
  const snapshot = targetSnapshots.get(snapshotId)
  if (!snapshot) return null
  const item = releaseRepository.get(snapshot.productionOrderId)
  if (!item || item.latestSnapshotId !== snapshotId || item.targetStatus !== '已确认') return null
  return clone(snapshot)
}

/** 补料用已保存目标和最新实物；历史目标快照本身始终保持确认时内容。 */
export function getCutPieceReleaseSupplementBasis(snapshotId:string):(CutPieceReleaseTargetSnapshot & {quantityBasisMatrixVersion:number}) | null {
  const snapshot=getCurrentCutPieceReleaseTargetSnapshot(snapshotId)
  if(!snapshot)return null
  const item=releaseRepository.get(snapshot.productionOrderId)!
  return {...snapshot,matrixSnapshot:clone(item.currentMatrix),targetPreview:buildTargetDifferences(item.currentMatrix,snapshot.targetPreview.colorSizeTargets),quantityBasisMatrixVersion:item.versions.at(-1)?.version || 0}
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
  releaseVersions?: CutPieceReleaseAvailableQtyVersion[]
  lateEvents?: LateCutPieceReleaseEvent[]
}

export function createCutOrderReleaseWriteSnapshot(cutOrderId: string, cutOrderNo = ''): CutOrderReleaseWriteSnapshot | null {
  syncGeneratedCutPieceRelease()
  const item = [...releaseRepository.values()].find((candidate) => resolveCutOrderSource(candidate, cutOrderId.trim(), cutOrderNo.trim()))
  return item ? { productionOrderId: item.input.productionOrderId, item: clone(item),
    releaseVersions: clone(releaseVersionRepository.get(item.input.productionOrderId) || []),
    lateEvents: clone([...lateEvents.values()].filter(event => event.productionOrderId === item.input.productionOrderId)) } : null
}

export function restoreCutOrderReleaseWriteSnapshot(snapshot: CutOrderReleaseWriteSnapshot | null): boolean {
  if (!snapshot?.productionOrderId || !snapshot.item) return false
  return withSavedRelease(() => {
    releaseRepository.set(snapshot.productionOrderId, clone(snapshot.item))
    if (snapshot.releaseVersions) releaseVersionRepository.set(snapshot.productionOrderId, clone(snapshot.releaseVersions))
    if (snapshot.lateEvents) {
      for (const [key, event] of lateEvents) if (event.productionOrderId === snapshot.productionOrderId) lateEvents.delete(key)
      for (const event of snapshot.lateEvents) lateEvents.set(event.eventId, clone(event))
    }
    return true
  }, () => false)
}

function recordCutOrderReleaseStatusChangeInMemory(input: CutOrderReleaseStatusChangeInput): CutOrderReleaseWriteResult {
  syncGeneratedCutPieceRelease()
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
  if (item.sourceStates.find(state=>state.cutOrderId===source.cutOrderId)?.status===input.status && matchedFacts.every((fact) => fact.sourceStatus === input.status)) {
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
      frozenTicketIds:input.status==='已冻结'?[...new Set([...(readSourceTicketIds?.(source.cutOrderId) || []),...matchedFacts.flatMap(fact=>fact.ticketDetail?[fact.ticketDetail.ticketId]:[])])]:undefined,
    }
    if (existingState) Object.assign(existingState, nextState)
    else item.sourceStates.push(nextState)
  })
  return applied
    ? { status: 'applied', reason: '裁片单放行状态已更新。' }
    : { status: 'rejected', reason: '放行状态事件写入失败。' }
}

function recordSpreadingReleaseAdjustmentInMemory(input: SpreadingReleaseAdjustmentInput): SpreadingReleaseAdjustmentResult {
  syncGeneratedCutPieceRelease()
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
  syncGeneratedCutPieceRelease()
  const sourceId = resolveCutPieceReleaseProductionOrderId(productionOrderId)
  const item = releaseRepository.get(sourceId)
  const record = item ? buildReleaseRecord(item) : null
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
    totalRiskReleaseQty: record.riskReleaseQty,
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
    (candidate.productionOrderId === productionOrderKey || candidate.productionOrderNo === productionOrderKey)
    && (!input.productionOrderNo || candidate.productionOrderNo === input.productionOrderNo)
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
    const coordinate=targetKey(normalizeReadinessText(taskLine.color),normalizeReadinessText(taskLine.size))
    const duplicate=input.skuLines.filter(line=>targetKey(normalizeReadinessText(line.color),normalizeReadinessText(line.size))===coordinate || normalizeReadinessText(line.skuCode)===normalizeReadinessText(taskLine.skuCode)).length>1
    const identityValid=Boolean(normalizeReadinessText(taskLine.skuCode) && normalizeReadinessText(taskLine.color) && normalizeReadinessText(taskLine.size)) && Number.isSafeInteger(taskLine.qty) && taskLine.qty>0 && !duplicate
    const exactMatches=exact && normalizeReadinessText(exact.colorName)===normalizeReadinessText(taskLine.color) && normalizeReadinessText(exact.sizeCode)===normalizeReadinessText(taskLine.size)
    const source = identityValid ? exact ? exactMatches?exact:null : byColorSize.length === 1 ? byColorSize[0] : null : null
    if (!source) return { ...missingLines.find((line) => line.skuCode === taskLine.skuCode)!, reason: !identityValid?'SKU、成衣颜色、尺码或正整数数量不完整，或同一放行色码重复；请重新核对。':exact && !exactMatches?'SKU与成衣颜色、尺码不一致，不能借用其他放行数量。':'裁片记录存在，但该颜色与尺码尚未形成唯一可匹配事实。' }
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
    } else if (completeKitQty===null) {
      status='齐套不足';reason=`齐套及当前风险待核对；已确认放行仍保留，可新增分配 ${availableQty} 件。`
    } else if ((riskReleaseQty ?? 0) > 0 || completeKitQty < releaseConfirmQty) {
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

function confirmCutPieceReleaseAvailableQtyInMemory(
  input: ConfirmCutPieceReleaseAvailableQtyInput,
  options: { skipActiveAllocationCheck?: boolean } = {},
): ConfirmCutPieceReleaseAvailableQtyResult {
  syncGeneratedCutPieceRelease()
  const item = releaseRepository.get(input.productionOrderId)
  if (!item) return { ok: false, message: '未找到生产单裁片矩阵。', version: null }

  const targetSnapshot = getTargetSnapshot(item)
  if (!targetSnapshot) return { ok: false, message: '请先维护目标数量。', version: null }

  if (!input.confirmedBy.trim() || !input.confirmedAt.trim()) return {ok:false,message:'请填写放行确认人和时间。',version:null}
  if (!options.skipActiveAllocationCheck && (input.basisMatrixVersion !== (item.versions.at(-1)?.version ?? 0) || input.basisTargetVersion !== targetSnapshot.matrixVersion)) return {ok:false,message:'放行依据已变化，本次未保存，请重新读取后核对。',version:null}
  const matrix = item.currentMatrix
  if (matrix.colorGroups.some(group=>group.sizes.some(size=>group.completeKitBySize[size] == null))) return {ok:false,message:'齐套数量资料待核对，不能把未知数量当作零确认。',version:null}
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
  // Static prototype seed records are created while the dependency graph is
  // still being initialized. They cannot have runtime allocations yet, and
  // reading the assignment repository here would re-enter that module before
  // its maps exist. Normal user actions always keep the allocation guard.
  const activeAllocations = options.skipActiveAllocationCheck
    ? []
    : listActiveCutPieceAllocationLines(input.productionOrderId)
  let totalRiskReleaseQty = 0
  let totalReleaseQty = 0
  const riskReleaseQtyByColorSize: Record<string, number> = {}
  const targetGapQtyByColorSize: Record<string, number> = {}
  const releaseGapToTargetQtyByColorSize: Record<string, number> = {}
  const surplusKitQtyByColorSize: Record<string, number> = {}

  for (const key of expectedKeys) {
    const [garmentColor, size] = key.split('::')
    const qty = input.releaseQtyByColorSize[key]
    if (!Number.isSafeInteger(qty) || qty < 0) return { ok: false, message: `${key} 可做数量不能为负数。`, version: null }
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
    allocatedQtyByColorSize: Object.fromEntries(expectedKeys.map(key=>{const [color,size]=key.split('::');return [key,activeAllocations.filter(line=>normalizeReadinessText(line.color)===normalizeReadinessText(color) && normalizeReadinessText(line.size)===normalizeReadinessText(size)).reduce((sum,line)=>sum+line.qty,0)]})),
    completeKitQtyByColorSize: Object.fromEntries(matrix.colorGroups.flatMap(group=>group.sizes.map(size=>[targetKey(group.garmentColor,size),group.completeKitBySize[size]]))),
    targetQtyByColorSize: {...targetValues},
    sourceFactIds: item.input.facts.map(fact=>fact.factId),
  }

  versions.push(version)
  item.requiresReview = false
  item.factChangeMessage = ''
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
  const item=releaseRepository.get(productionOrderId)
  if(item) {item.requiresReview=true;item.factChangeMessage='有效裁片事实已变化，请核对当前差异并维持或调整放行。'}
}

export function calculateMissingPieceQty(productionOrderId: string): SupplementPartShortage[] {
  syncGeneratedCutPieceRelease()
  const item=releaseRepository.get(productionOrderId)
  const preview=item ? targetPreviewForCurrentMatrix(item):null
  return item && preview ? buildSupplementPartShortages(item.currentMatrix,preview):[]
}

export function saveCutPieceReleaseDecision(input: SaveCutPieceReleaseDecisionInput): { ok: boolean; message: string } {
  const record = getCutPieceReleaseRecord(input.recordId)
  if (!record) return { ok: false, message: '未找到裁片放行记录。' }
  return { ok: false, message: '请在裁片矩阵中确认目标数量；旧放行判断入口不再写入权威数据。' }
}

export function confirmCutPieceReleaseTarget(input: ConfirmReleaseTargetInput): ConfirmReleaseTargetResult {
  return withSavedRelease(() => confirmCutPieceReleaseTargetInMemory(input), message => ({ ok: false, message, snapshot: null }), input.productionOrderId)
}
export function confirmCutPieceReleaseAvailableQty(input: ConfirmCutPieceReleaseAvailableQtyInput): ConfirmCutPieceReleaseAvailableQtyResult {
  return withSavedRelease(() => confirmCutPieceReleaseAvailableQtyInMemory(input), message => ({ ok: false, message, version: null }), input.productionOrderId)
}
export function recordCutOrderReleaseStatusChange(input: CutOrderReleaseStatusChangeInput): CutOrderReleaseWriteResult {
  return withSavedRelease(() => recordCutOrderReleaseStatusChangeInMemory(input), reason => ({ status: 'rejected', reason }))
}
export function recordSpreadingReleaseAdjustment(input: SpreadingReleaseAdjustmentInput): SpreadingReleaseAdjustmentResult {
  return withSavedRelease(() => recordSpreadingReleaseAdjustmentInMemory(input), reason => ({ status: 'rejected', reason }))
}

const RELEASE_PREFIX='cut-piece-release:'
const staticReleaseState=structuredClone({releaseRepository,targetSnapshots,lateEvents,releaseVersionRepository})
export function captureCutPieceReleaseState(){return structuredClone({releaseRepository,targetSnapshots,lateEvents,releaseVersionRepository})}
export function restoreCutPieceReleaseState(state:ReturnType<typeof captureCutPieceReleaseState>):void {
  const replace=<T>(target:Map<string,T>,source:Map<string,T>)=>{target.clear();for(const [key,value] of source)target.set(key,structuredClone(value))}
  replace(releaseRepository,state.releaseRepository);replace(targetSnapshots,state.targetSnapshots);replace(lateEvents,state.lateEvents);replace(releaseVersionRepository,state.releaseVersionRepository)
}
/** 数量事实、矩阵历史、目标、放行与事件各自按记录保存，普通读取不复制种子。 */
export function captureCutPieceReleaseRecords():CuttingStoredRecord[] {
  const rows:CuttingStoredRecord[]=[]
  const add=(kind:string,id:string,value:unknown)=>rows.push({id:`${RELEASE_PREFIX}${kind}:${id}`,collection:`cut-piece-release-${kind}`,value:structuredClone(value)})
  for(const [id,item] of releaseRepository) {
    const {facts,...basis}=item.input
    const {currentMatrix,versions,eventState,spreadingAdjustmentKeys,input,...meta}=item
    add('order',id,{...meta,input:basis,spreadingAdjustmentKeys:[...spreadingAdjustmentKeys]})
    for(const fact of facts)add('fact',`${id}:${fact.factId}`,fact)
    for(const version of versions)add('matrix',`${id}:${version.version}`,version)
    for(const event of eventState.events)add('event',`${id}:${event.eventId}`,event)
  }
  for(const [id,value] of targetSnapshots)add('target',id,value)
  for(const values of releaseVersionRepository.values())for(const value of values)add('decision',value.releaseVersionId,value)
  for(const [id,value] of lateEvents)add('late',id,value)
  return rows
}
export async function hydrateCutPieceReleaseRecords(provided?:CuttingRecordSnapshot):Promise<void> {
  const snapshot=provided || await readCuttingRecords()
  validateCutPieceReleaseStoredRecords(snapshot.records)
  hydrateCutPieceTicketValidity(snapshot)
  // 只读投影注册不依赖先访问放行页；车缝/PDA 直达读取同一事实。
  if(!readGeneratedReleaseInputs) {
    const [adapter,sources,orders,facts]=await Promise.all([import('./cutting/generated-cut-release.ts'),import('./cutting/generated-cut-orders.ts'),import('./production-orders.ts'),import('./cutting/cut-piece-release-facts.ts')])
    readReleaseStyleImage=(productionOrderId,spuCode)=>{
      const order=orders.productionOrders.find(row=>row.productionOrderId===productionOrderId && row.demandSnapshot.spuCode===spuCode)
      const images=order?.techPackSnapshot?.imageSnapshot
      return [...(images?.productImages || []),...(images?.styleImages || []),...(images?.sampleImages || [])]
        .find(src=>Boolean(src) && !/placeholder|^data:image\/svg/.test(src)) || ''
    }
    facts.setPublishedReleaseTicketDetails(()=>[...releaseRepository.values()].filter(item=>!item.generatedSkuCodes).flatMap(item=>item.input.facts.flatMap(fact=>fact.ticketDetail?[fact.ticketDetail]:[])))
    readSourceTicketIds=cutOrderId=>facts.listReleaseSourceTickets().filter(ticket=>ticket.cutOrderId===cutOrderId).map(ticket=>ticket.feiTicketId)
    setGeneratedCutReleaseReader(()=>adapter.buildGeneratedCutReleaseInputs(sources.listGeneratedCutOrderSourceRecords({includeDimensionScenarios:false}),[],undefined,{
      initialOrderIds:orders.initialProductionOrderIds,
      currentOrderIds:new Set([...releaseRepository].filter(([,item])=>item.generatedSkuCodes).map(([id])=>id)),
    }))
  }
  restoreCutPieceReleaseState(staticReleaseState)
  const relevant=snapshot.records.filter(row=>row.id.startsWith(RELEASE_PREFIX))
  const orderRows=relevant.filter(row=>row.collection==='cut-piece-release-order')
  for(const row of orderRows) {
    const value=structuredClone(row.value) as Omit<ReleaseRepositoryItem,'currentMatrix'|'versions'|'eventState'|'spreadingAdjustmentKeys'> & {spreadingAdjustmentKeys:string[]}
    const id=value.input?.productionOrderId
    if(!id || !Array.isArray(value.input.requirements) || !Array.isArray(value.spreadingAdjustmentKeys)) throw new Error('裁片放行依据记录不完整，请重新读取。')
    const facts=relevant.filter(row=>row.collection==='cut-piece-release-fact' && (row.value as CutPieceFact).productionOrderId===id).map(row=>structuredClone(row.value) as CutPieceFact)
    const base=releaseRepository.get(id)
    const input={...value.input,facts:[...new Map([...(base?.input.facts || []),...facts].map(fact=>[fact.factId,fact])).values()]}
    const events=relevant.filter(row=>row.collection==='cut-piece-release-event' && (row.value as MatrixEvent).productionOrderId===id).map(row=>structuredClone(row.value) as MatrixEvent)
    const versions=relevant.filter(row=>row.collection==='cut-piece-release-matrix' && (row.value as CutPieceReleaseMatrixVersion).productionOrderId===id).map(row=>structuredClone(row.value) as CutPieceReleaseMatrixVersion).sort((a,b)=>a.version-b.version)
    releaseRepository.set(id,{...value,input,spreadingAdjustmentKeys:new Set(value.spreadingAdjustmentKeys),eventState:{events:[...new Map([...(base?.eventState.events || []),...events].map(event=>[event.eventId,event])).values()]},versions:[...new Map([...(base?.versions || []),...versions].map(version=>[version.version,version])).values()].sort((a,b)=>a.version-b.version),currentMatrix:buildReleaseMatrix(input)})
  }
  for(const row of relevant) {
    if(row.collection==='cut-piece-release-target') {const value=structuredClone(row.value) as CutPieceReleaseTargetSnapshot;targetSnapshots.set(value.snapshotId,value)}
    if(row.collection==='cut-piece-release-late') {const value=structuredClone(row.value) as LateCutPieceReleaseEvent;lateEvents.set(value.eventId,value)}
    if(row.collection==='cut-piece-release-decision') {
      const value=structuredClone(row.value) as CutPieceReleaseAvailableQtyVersion
      const list=releaseVersionRepository.get(value.productionOrderId) || []
      const idx=list.findIndex(item=>item.releaseVersionId===value.releaseVersionId)
      if(idx>=0)list[idx]=value;else list.push(value)
      releaseVersionRepository.set(value.productionOrderId,list.sort((a,b)=>a.releaseVersionNo-b.releaseVersionNo))
    }
  }
  for(const versions of releaseVersionRepository.values()) {
    const latest=versions.filter(version=>version.isLatestEffective).at(-1)
    for(const version of versions)version.isLatestEffective=version===latest
  }
  syncGeneratedCutPieceRelease()
}
export function getCutPieceReleaseMigrationStatus():{required:boolean;message:string} {
  try {const raw=getBrowserLocalStorage()?.getItem(GENERATED_RELEASE_STORAGE_KEY);return {required:Boolean(raw),message:raw?'检测到旧放行资料，请关闭其他旧页面后执行资料转换；转换核验前保留原资料。':''}}
  catch{return {required:true,message:'旧放行资料无法读取，请允许读取后重新尝试，当前不能覆盖保存。'}}
}
async function saveReleaseAction<T extends {ok:boolean;message:string}>(intent:string,productionOrderId:string,action:()=>T,failure:(message:string)=>T):Promise<T> {
  let before:ReturnType<typeof captureCutPieceReleaseState>|undefined
  let committed=false
  try {
    if(getCutPieceReleaseMigrationStatus().required) throw new Error('原放行资料需要先完成转换和核验，不能覆盖保存。')
    const id=`CUT-RELEASE:${await cuttingRecordFingerprint(intent)}`
    const prior=await readCuttingCommand(id)
    if(prior) {if(prior.intent!==intent) throw new Error('操作编号与原内容冲突。');return prior.result as T}
    const snapshot=await readCuttingRecords()
    const [production,parts,events]=await Promise.all([import('./production-context-records.ts'),import('./cutting/part-ticket-records.ts'),import('./cutting/cutting-event-repository.ts')])
    await production.hydrateProductionContextRecords(snapshot);await parts.hydratePartTicketRecords(snapshot);events.prepareCommittedCuttingEventSnapshot(snapshot)
    await hydrateCutPieceReleaseRecords(snapshot)
    before=captureCutPieceReleaseState()
    const baseline=captureCutPieceReleaseRecords()
    const result=action()
    if(!result.ok) {restoreCutPieceReleaseState(before);return result}
    const changed=captureCutPieceReleaseRecords()
    restoreCutPieceReleaseState(before)
    const change=diffCuttingRecords(baseline,changed)
    change.puts.push(...production.productionContextInitializationRecords(),...parts.partTicketInitializationRecords(),...events.cuttingEventScopeInitializationRecords())
    const saved=await commitCuttingRecords({revision:snapshot.revision,change,assertSourcesCurrent:()=>{production.assertProductionContextLegacyUnchanged();parts.assertPartTicketLegacyUnchanged();events.assertManagedScopeCurrent()},command:{id,intent,result,at:new Date().toISOString()}})
    committed=true
    await hydrateCutPieceReleaseRecords(await readCuttingRecords())
    return saved.result
  }catch(error){
    if(!committed && before) {restoreCutPieceReleaseState(before);try{await hydrateCutPieceReleaseRecords(await readCuttingRecords())}catch{/* 读取失败保留原可恢复输入，不覆盖持久资料。 */}}
    if(committed) return failure('已保存，页面未更新。请重新读取核对。')
    const reason=(error instanceof Error?error.message:String(error)).replace(/[。；;\s]+$/,'')
    const message=error instanceof Error && error.name==='QuotaExceededError'?'未保存，存储空间不足。输入已保留，请释放空间后重试。':reason.includes('未保存')?`${reason}。输入已保留。`:`未保存：${reason}。输入已保留，请重新读取后重试。`
    return failure(message)
  }
}
export async function saveCutPieceReleaseTargetAction(input:ConfirmReleaseTargetInput):Promise<ConfirmReleaseTargetResult> {
  return saveReleaseAction(JSON.stringify({action:'确认目标',input}),input.productionOrderId,()=>confirmCutPieceReleaseTargetInMemory(input),message=>({ok:false,message,snapshot:null}))
}
export async function saveCutPieceReleaseAvailableQtyAction(input:ConfirmCutPieceReleaseAvailableQtyInput):Promise<ConfirmCutPieceReleaseAvailableQtyResult> {
  return saveReleaseAction(JSON.stringify({action:'确认放行',input}),input.productionOrderId,()=>confirmCutPieceReleaseAvailableQtyInMemory(input),message=>({ok:false,message,version:null}))
}
/** 独立显式迁移：每生产单分批记录写入，逐条读回后才清理独占旧键；重试复用 command。 */
export async function migrateLegacyCutPieceReleaseRecords(input:{otherPagesClosed:boolean;progress?:(message:string)=>void}):Promise<{ok:boolean;message:string}> {
  const state=captureCutPieceReleaseState()
  try {
    if(!input.otherPagesClosed) throw new Error('请先关闭其他旧版 HiGood 页面，再确认开始转换。')
    const storage=getBrowserLocalStorage(),raw=storage?.getItem(GENERATED_RELEASE_STORAGE_KEY)
    if(!raw)return {ok:true,message:'没有需要转换的旧放行资料。'}
    const saved=JSON.parse(raw)
    const validatedRecords:Array<{id:string;fingerprint:string}>=[]
    const manifestFor=async(rows:CuttingStoredRecord[])=>Promise.all(rows.map(async row=>({id:row.id,fingerprint:await cuttingRecordFingerprint(JSON.stringify(row))})))
    const verifyManifest=async(rows:Array<{id:string;fingerprint:string}>,snapshot:CuttingRecordSnapshot)=>{for(const row of rows){const actual=snapshot.records.find(value=>value.id===row.id);if(!actual || await cuttingRecordFingerprint(JSON.stringify(actual))!==row.fingerprint)return false}return true}
    const migrationFingerprint=await cuttingRecordFingerprint(raw)
    if(saved.version!==1 || !Array.isArray(saved.items)) throw new Error('旧放行资料格式不正确，原资料已保留。')
    for(const entry of saved.items) {
      const item=entry.item as ReleaseRepositoryItem,po=item?.input?.productionOrderId
      if(!po || !Array.isArray(item.input.facts) || !Array.isArray(item.versions) || !Array.isArray(entry.targets) || !Array.isArray(entry.releases) || !Array.isArray(entry.late)) throw new Error('旧记录或关联不完整，原资料已保留。')
      input.progress?.(`正在转换 ${item.input.productionOrderNo}`)
      const snapshot=await readCuttingRecords()
      await hydrateCutPieceReleaseRecords(snapshot)
      const legacyEntry=structuredClone(entry)
      const commandId=`CUT-RELEASE-MIGRATION:${po}:${migrationFingerprint}`
      const intent=await cuttingRecordFingerprint(JSON.stringify(entry))
      const prior=await readCuttingCommand(commandId)
      if(prior && prior.intent!==intent) throw new Error('旧资料在转换期间已变化，请重新核对。')
      if(prior) {const expected=(prior.result as {manifest?:Array<{id:string;fingerprint:string}>}).manifest;if(!expected?.length || !await verifyManifest(expected,snapshot)) throw new Error('前次转换结果读回不一致，原资料保留。');validatedRecords.push(...expected)}
      if(!prior) {
        // 历史确认保留；无装袋/回仓证据的旧原产量不能充当当前有效数量。
        item.input.facts=item.input.facts.map(fact=>({...fact,actualPieceQty:0,physicalPieceQty:0,identityKnown:false}))
        item.spreadingAdjustmentKeys=new Set(item.spreadingAdjustmentKeys as unknown as string[])
        item.requiresReview=true;item.factChangeMessage='旧版确认已保留；当前有效装袋及工艺实收须重新核对。'
        const current=releaseRepository.get(po)
        if(current?.generatedSkuCodes && getTargetSnapshot(current)) throw new Error('目标中已有同生产单的修改资料，需核对冲突，不能静默覆盖。')
        releaseRepository.set(po,item)
        for(const target of entry.targets)targetSnapshots.set(target.snapshotId,target)
        if(item.latestSnapshotId) item.targetStatus='已确认'
        releaseVersionRepository.set(po,entry.releases.map((version:CutPieceReleaseAvailableQtyVersion)=>({...version,releaseStatus:version.releaseStatus==='确认后需复核'?(version.totalReleaseConfirmQty===0?'暂不放行':version.totalRiskReleaseQty>0?'风险放行':'按齐套放行'):version.releaseStatus})))
        for(const late of entry.late)lateEvents.set(late.eventId,late)
        const records=captureCutPieceReleaseRecords().filter(row=>{
          const value=row.value as {productionOrderId?:string;input?:{productionOrderId?:string}}
          return (value.productionOrderId || value.input?.productionOrderId)===po
        })
        const puts=[...records,{id:`${RELEASE_PREFIX}legacy:${po}`,collection:'cut-piece-release-legacy',value:legacyEntry}]
        const conflicts=puts.filter(row=>snapshot.records.some(old=>old.id===row.id && JSON.stringify(old.value)!==JSON.stringify(row.value)))
        if(conflicts.length) throw new Error('现有记录与旧资料存在冲突，原资料已保留。')
        const manifest=await manifestFor(puts)
        await commitCuttingRecords({revision:snapshot.revision,change:{puts},command:{id:commandId,intent,result:{manifest},at:new Date().toISOString()}})
        const readBack=await readCuttingRecords()
        if(puts.some(row=>JSON.stringify(readBack.records.find(value=>value.id===row.id))!==JSON.stringify(row))) throw new Error('转换后读回校验未通过，原资料已保留。')
        validatedRecords.push(...manifest)
      }
      if(storage?.getItem(GENERATED_RELEASE_STORAGE_KEY)!==raw) throw new Error('旧页面仍在修改资料，停止清理并保留原资料。')
    }
    const final=await readCuttingRecords()
    if(!await verifyManifest(validatedRecords,final)) throw new Error('转换最终回读不一致，旧资料保留。')
    if(saved.items.some((entry:{item:ReleaseRepositoryItem})=>!final.records.some(row=>row.id===`${RELEASE_PREFIX}legacy:${entry.item.input.productionOrderId}`))) throw new Error('转换记录缺失，旧资料已保留。')
    if(storage?.getItem(GENERATED_RELEASE_STORAGE_KEY)!==raw) throw new Error('旧页面仍在修改资料，停止清理并保留原资料。')
    storage?.removeItem?.(GENERATED_RELEASE_STORAGE_KEY)
    if(storage?.getItem(GENERATED_RELEASE_STORAGE_KEY)) throw new Error('旧资料清理未完成，请重试核验。')
    await hydrateCutPieceReleaseRecords(final)
    return {ok:true,message:'原目标、放行及历史已转换并逐条核验；旧独占资料已清理。当前实物事实仍按装袋和最终实收读取。'}
  }catch(error){
    restoreCutPieceReleaseState(state)
    const reason=(error instanceof Error?error.message:String(error)).replace(/^尚未保存[：:]?/,'').replace(/[。；;\s]+$/,'')
    return {ok:false,message:`转换未完成：${reason}。${reason.includes('原资料')?'':'原资料已保留。'}${/重试|重新尝试/.test(reason)?'':'请重试。'}`}
  }
}

export function prepareCutPieceReleaseMutation<T>(action:()=>T):{result:T;change:ReturnType<typeof diffCuttingRecords>} {
  const state=captureCutPieceReleaseState(),before=captureCutPieceReleaseRecords()
  try {const result=action();return {result,change:diffCuttingRecords(before,captureCutPieceReleaseRecords())}} finally {restoreCutPieceReleaseState(state)}
}
