import { readTmfPreparationHandoverRecord as readCurrentPreparationHandoverRecord, readTmfProductionOrderRuntimeFact as readProductionOrderRuntimeFact } from '../fcs/tmf-source-readers.ts'
import type { PmsMaterialPurchaseOrder } from './material-purchase-orders.ts'
import { getBrowserLocalStorage, writeBrowserStorageItem } from '../browser-storage.ts'
import { TMF_FACTORY_ID } from '../fcs/central-craft-factories.ts'
import { deriveTmfProductionDemands, type TmfProductionDemand } from '../fcs/webbing-production-demands.ts'
import { getWebbingPhysicalSpecificationKey, validateWebbingSpecifications, type WebbingSpecification, type WebbingEndRequirement } from '../fcs/webbing-specifications.ts'
import { assertTmfBasePurchaseMasters, assertTmfRawMaterialMaster, assertTmfTipMaterialMaster } from './tmf-master-registry.ts'

export interface TmfSupplyPurchaseReceipt {
  id: string
  purchaseOrderNo: string
  purchaseSnapshot: PmsMaterialPurchaseOrder
  purpose: 'BASE_MATERIAL' | 'TIP_MATERIAL'
  lotId: string
  quantity: number
  unit: 'kg' | 'g' | '个'
  receivedAt: string
}

/** 基础生产原料独立重量账；不与半成品米料相互换算。 */
export interface TmfBaseMaterialLot {
  id: string
  materialSkuId: string
  warehouseId: string
  location: string
  sourceReceiptNo: string
  sourceReceiptLineId: string
  unit: 'kg' | 'g'
  receivedQty: number
  onHandQty: number
}
export interface TmfBaseMaterialIssue {
  id: string
  baseOrderId: string
  lotId: string
  dispatchedQty: number
  receivedQty: number
  consumedQty: number
  scrapQty: number
}
export interface TmfBaseMaterialReturn {
  id: string
  issueId: string
  dispatchedQty: number
  receivedQty: number
  reason: string
}

/** 已确认的辅材仓库实收批次；不与连续织带米料共用计量。 */
export interface TmfTipMaterialLot {
  id: string
  materialSkuId: string
  warehouseId: string
  location: string
  sourceReceiptNo: string
  sourceReceiptLineId: string
  unit: '个' | 'kg' | 'g'
  receivedQty: number
  onHandQty: number
  receivedAt: string
}

export interface TmfTipMaterialIssue {
  /** 历史记录可能无来源批次；新发出必须明确关联，不补造历史库存。 */
  stockLotId?: string
  id: string
  demandId: string
  materialBomItemId: string
  materialSkuId: string
  sourceDocumentNo: string
  unit: '个' | 'kg' | 'g'
  dispatchedQty: number
  receivedQty: number
  usedQty: number
  scrapQty: number
}

export interface TmfTipMaterialReturn {
  id: string
  sourceIssueId: string
  stockLotId: string
  dispatchedQty: number
  receivedQty: number
  dispatchedAt: string
  reason: string
}

/** 截断产出的后续加工记录；不增加原截断总数或米料耗用。 */
export interface TmfTipResult {
  id: string
  cutOutputId: string
  pieces: number
  goodPieces: number
  defectivePieces: number
  actualFinishedLengthMm: number
  endA: WebbingEndRequirement
  endB: WebbingEndRequirement
  materials: Array<{ issueId: string; usedQty: number; scrapQty: number }>
  reportedAt: string
  reason: string
}

export interface TmfDefectiveScrap {
  id: string
  cutOutputId: string
  tipResultId?: string
  pieces: number
  equivalentMeters: number
  reason: string
  scrappedAt: string
}

/** 厂内合格在制条料的实际报废；与不良报废分开记账，原产出记录不删。 */
export interface TmfFactoryScrap {
  id: string
  cutOutputId: string
  pieces: number
  equivalentMeters: number
  reason: string
  scrappedAt: string
  actor: TmfPurchaseActor
}

/** 终止处置时厂内剩余连续料的实际报废；退回原仓仍走连续余料退料流程。 */
export interface TmfContinuousScrap {
  id: string
  issueId: string
  meters: number
  reason: string
  scrappedAt: string
  actor: TmfPurchaseActor
}

export type TmfTerminationCategory = 'CONTINUOUS_REMAINING' | 'FACTORY_CUT' | 'DEFECTIVE' | 'FROZEN_PACKAGE' | 'UPSTREAM_TRANSIT' | 'PRODUCTION_TRANSIT'

/** 终止处置控制面：每项实际决定都留痕，结案前不得存在未决定的实物或在途。 */
export interface TmfTerminationDisposal {
  id: string
  productionOrderId: string
  category: TmfTerminationCategory
  action: 'SCRAP' | 'RETAIN_FROZEN' | 'TRANSIT_WRITE_OFF'
  objectId: string
  tipResultId?: string
  quantity: number
  unit: '米' | '条' | '根'
  reason: string
  actor: TmfPurchaseActor
  occurredAt: string
}

export interface TmfTerminationClosure {
  id: string
  productionOrderId: string
  reason: string
  decisionSummary: string
  /** 缺口终止时关联的补做单号；无缺口时不填。 */
  makeupOrderNo?: string
  actor: TmfPurchaseActor
  occurredAt: string
}

export interface TmfOutputPackage {
  surplusFreeze?: { pieces: number; reason: string; frozenAt: string; actor: TmfPurchaseActor }
  versionFreeze?: { pieces: number; previousSnapshotId: string; reason: string; frozenAt: string; actor: TmfPurchaseActor }
  id: string
  demandId: string
  cutOutputId: string
  tipResultId?: string
  materialSkuId: string
  pieces: number
  unit: '条' | '根'
  actualCutLengthMm: number
  actualFinishedLengthMm: number
  endA: WebbingEndRequirement
  endB: WebbingEndRequirement
  createdAt: string
  parentPackageId?: string
  splitAt?: string
  warehouseId?: string
  location?: string
  receivedPieces?: number
  /** 终止处置或冻结报废后的实际处置数量；不计入可分配实物。 */
  disposedPieces?: number
}

export interface TmfOutputHandover {
  id: string
  packageId: string
  warehouseId: string
  dispatchedPieces: number
  receivedPieces: number
  dispatchedAt: string
}

/** 分配量含已发量；释放只针对尚未发出的部分。 */
export interface TmfOutputAllocation {
  id: string
  packageId: string
  demandId: string
  allocatedPieces: number
  releasedPieces: number
  receiverId: string
  receiverOrganizationId: string
  createdAt: string
}

export interface TmfProductionIssue {
  id: string
  allocationId: string
  packageId: string
  demandId: string
  warehouseId: string
  location: string
  receiverId: string
  receiverOrganizationId: string
  dispatchedPieces: number
  receivedPieces: number
  dispatchedAt: string
  /** 终止处置确认的未收在途去向；只结清待处置数，不删原发料事实。 */
  transitWriteOff?: { pieces: number; reason: string; confirmedAt: string; actor: TmfPurchaseActor }
}

export interface TmfProductionControl {
  /** 只由主单取消状态派生，不代替已确认处置事件。 */
  pendingCancellationDisposition?: boolean
  productionOrderId: string
  status: 'ACTIVE' | 'ON_HOLD' | 'CANCELLED'
  reason: string
  changedAt: string
}

export interface TmfCutOutput {
  id: string
  demandId: string
  sourceIssueId: string
  materialSkuId: string
  specification: WebbingSpecification
  actualCutLengthMm: number
  actualFinishedLengthMm: number | null
  cutPieces: number
  unit: '条' | '根'
  goodPieces: number
  pendingTipPieces: number
  defectivePieces: number
  cutEquivalentMeters: number
  lossMeters: number
  reportedAt: string
  reason: string
}

export const TMF_PURCHASE_STORAGE_KEY = 'higood-tmf-material-purchases-v1'
export type TmfPurchaseActor = { id: string; name: string; role: '采购员' | '采购主管' | '生产计划' | '织带厂员工' | '织带厂主管' | '仓管' | '仓库主管' | '生产领料人' }

export interface TmfContinuousReservation {
  id: string
  demandId: string
  lotId: string
  reservedMeters: number
  issuedMeters: number
  /** 已加工连续余料可从截断节点接续；历史占用默认首道。 */
  targetRouteEntryId?: string
}

export interface TmfUpstreamIssueBinding {
  processCode: 'DYE' | 'PRINT'
  orderId: string
  orderNo: string
  factoryName: string
  inputCode: string
}

export interface TmfProcessingMaterialIssue {
  /** 印花实际交出分到本需求的份额；实收只读取原交出记录 taskReceipts。 */
  printHandover?: { orderId: string; recordId: string; sourceIssueId: string }
  /** 染色直接交给织带厂时按需求分配的份额；与印花共用同一实收口径。 */
  dyeHandover?: { orderId: string; recordId: string; sourceIssueId: string }
  /** 同一次合并发料/加工的明细，需求归属仍由各行保留。 */
  mergedBatchId?: string
  /** 终止处置确认的未收在途去向；只结清待处置数，不删原发料事实。 */
  transitWriteOff?: { meters: number; reason: string; confirmedAt: string; actor: TmfPurchaseActor }
  upstream?: TmfUpstreamIssueBinding
  id: string
  reservationId: string
  demandId: string
  lotId: string
  materialSkuId: string
  targetRouteEntryId: string
  targetFactoryId: string
  dispatchedMeters: number
  receivedMeters: number
  dispatchedAt: string
}

export interface TmfMaterialPurchaseOrder extends PmsMaterialPurchaseOrder {
  purchaseLineId: string
  version: number
  supplierId: string
  factoryOrgId: typeof TMF_FACTORY_ID
  materialSkuId: string
  materialSpuId: string
  accessoryType: '织带' | '绳子'
  targetWarehouseId: string
  productionStandard: string
  /** 半成品加工的可执行基础原料配方；用于校验实际耗用能否支撑米制产出。 */
  baseMaterialRecipe: {
    materialSkuId: string
    unit: 'kg' | 'g'
    quantityPerMeter: number
    specification: string
  }
  /** 建立时解析的原型内建主档身份；映射前历史记录无此字段，不批量改写。 */
  masterRefs?: {
    supplier: { masterId: string; code: string; name: string; source: string }
    material: { masterId: string; code: string; name: string; source: string; category: string }
    warehouse: { masterId: string; code: string; name: string; source: string }
    resolvedAt: string
  }
  /** 超过采购计划量的实际实收；计划不扩，保留主管确认与原因。 */
  overReceipts?: Array<{ meters: number; reason: string; confirmedBy: string; confirmedAt: string; handoverId: string }>
}

export interface TmfBaseProductionOrder {
  id: string
  purchaseOrderNo: string
  purchaseLineId: string
  purchaseVersion: number
  materialSkuId: string
  targetWarehouseId: string
  plannedMeters: number
  dueDate: string
  productionStandard: string
  baseMaterialRecipe: TmfMaterialPurchaseOrder['baseMaterialRecipe']
  producedMeters: number
  acceptedAt?: string
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  changePending: boolean
  planRevisions?: Array<{ fromVersion: number; toVersion: number; beforeMeters: number; afterMeters: number; producedMetersAtChange: number; dueDateBefore: string; dueDateAfter: string; reason: string; confirmedBy: string; confirmedAt: string }>
  /** 超过基础生产计划的实际产出；计划不变，保留主管确认与原因。 */
  overProductions?: Array<{ meters: number; reason: string; confirmedBy: string; confirmedAt: string }>
}

/** 原基础采购退货独立记账；TMF已收退回物不自动成为可重发产出。 */
export interface TmfPurchaseReturn {
  id: string; purchaseOrderNo: string; baseOrderId: string; lotId: string; sourceHandoverId: string
  materialSkuId: string; warehouseId: string; factoryId: string
  dispatchedMeters: number; receivedMeters: number; reason: string
  dispatchedAt: string; dispatchedBy: TmfPurchaseActor
  receipts: Array<{ meters: number; receivedAt: string; receivedBy: TmfPurchaseActor }>
}

export interface TmfBaseHandover {
  id: string
  baseOrderId: string
  purchaseOrderNo: string
  purchaseLineId: string
  materialSkuId: string
  batchId: string
  warehouseId: string
  dispatchedMeters: number
  receivedMeters: number
  dispatchedAt: string
}

export interface TmfContinuousLot {
  id: string
  materialSkuId: string
  sourcePurchaseOrderNo: string
  sourcePurchaseLineId: string
  sourceHandoverId: string
  warehouseId: string
  location: string
  receivedMeters: number
  onHandMeters: number
  reservedMeters: number
  frozenMeters: number
  receiptKind?: 'BASE_PURCHASE' | 'PROCESS_RETURN'
}

export interface TmfContinuousReturn {
  id: string
  sourceIssueId: string
  materialSkuId: string
  batchId: string
  warehouseId: string
  dispatchedMeters: number
  receivedMeters: number
  dispatchedAt: string
  reason: string
}

export interface TmfPurchaseOperation {
  id: string
  action: string
  objectId: string
  actor: TmfPurchaseActor
  occurredAt: string
  quantity?: number
  unit?: '米' | '条' | '根' | '个' | 'kg' | 'g'
  reason: string
  /** 重试同一动作必须使用相同内容，不能借原 ID 提交另一份数量。 */
  payloadSignature: string
}

export interface TmfWorkPlan {
  workOrderId: string
  responsibleName: string
  plannedStartAt: string
  plannedFinishAt: string
  waitingReason: string
  revision: number
  updatedAt: string
  updatedBy: string
}

export type TmfWorkCostCurrency = 'CNY' | 'IDR' | 'USD'
export type TmfWorkCostUnit = '米' | '条' | '根' | '单'

/** 加工单计价快照；计价数量由当前采用技术包需求计算，不从库存实收倒推。 */
export interface TmfWorkCost {
  workOrderId: string
  unitPrice: number
  currency: TmfWorkCostCurrency
  pricingUnit: TmfWorkCostUnit
  pricingQuantity: number
  estimatedAmount: number
  revision: number
  reason: string
  updatedAt: string
  updatedBy: string
}

export interface TmfPurchaseState {
  purchaseReturns: TmfPurchaseReturn[]
  workPlans: TmfWorkPlan[]
  workCosts: TmfWorkCost[]
  supplyPurchaseReceipts: TmfSupplyPurchaseReceipt[]
  baseMaterialLots: TmfBaseMaterialLot[]
  baseMaterialIssues: TmfBaseMaterialIssue[]
  baseMaterialReturns: TmfBaseMaterialReturn[]
  version: 1
  orders: TmfMaterialPurchaseOrder[]
  baseOrders: TmfBaseProductionOrder[]
  handovers: TmfBaseHandover[]
  lots: TmfContinuousLot[]
  operations: TmfPurchaseOperation[]
  demands: TmfProductionDemand[]
  reservations: TmfContinuousReservation[]
  processingIssues: TmfProcessingMaterialIssue[]
  cutOutputs: TmfCutOutput[]
  continuousReturns: TmfContinuousReturn[]
  tipMaterialReturns: TmfTipMaterialReturn[]
  tipMaterialLots: TmfTipMaterialLot[]
  tipMaterialIssues: TmfTipMaterialIssue[]
  tipResults: TmfTipResult[]
  defectiveScraps: TmfDefectiveScrap[]
  factoryScraps: TmfFactoryScrap[]
  continuousScraps: TmfContinuousScrap[]
  terminationDisposals: TmfTerminationDisposal[]
  terminationClosures: TmfTerminationClosure[]
  packages: TmfOutputPackage[]
  outputHandovers: TmfOutputHandover[]
  outputAllocations: TmfOutputAllocation[]
  productionIssues: TmfProductionIssue[]
  productionControls: TmfProductionControl[]
}

let state: TmfPurchaseState | undefined
let storageListenerBound = false

function bindStorageSync(): void {
  if (storageListenerBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.addEventListener('storage', (event) => {
    if (event.key === TMF_PURCHASE_STORAGE_KEY) state = undefined
  })
  storageListenerBound = true
}
function emptyState(): TmfPurchaseState {
  return { purchaseReturns: [], workPlans: [], workCosts: [], defectiveScraps: [], factoryScraps: [], continuousScraps: [], terminationDisposals: [], terminationClosures: [], supplyPurchaseReceipts: [], baseMaterialLots: [], baseMaterialIssues: [], baseMaterialReturns: [], version: 1, orders: [], baseOrders: [], handovers: [], lots: [], operations: [], demands: [], reservations: [], processingIssues: [], cutOutputs: [], continuousReturns: [], tipMaterialReturns: [], tipMaterialLots: [], tipMaterialIssues: [], tipResults: [], packages: [], outputHandovers: [], outputAllocations: [], productionIssues: [], productionControls: [] }
}

function current(): TmfPurchaseState {
  bindStorageSync()
  if (state) return state
  const storage = getBrowserLocalStorage()
  let raw: string | null = null
  try { raw = storage?.getItem(TMF_PURCHASE_STORAGE_KEY) ?? null } catch { throw new Error('无法读取已保存的织带厂记录，请检查浏览器存储后重试。') }
  if (!raw) return state = emptyState()
  try {
    const saved = JSON.parse(raw) as TmfPurchaseState
    if (saved.version !== 1 || !['orders', 'baseOrders', 'handovers', 'lots', 'operations'].every((key) => Array.isArray(saved[key as keyof TmfPurchaseState]))) throw new Error('格式不符')
    // 首轮采购演示保存尚未含生产需求；只补空集合，不修改历史采购或库存。
    saved.supplyPurchaseReceipts ??= []
    if(!Array.isArray(saved.supplyPurchaseReceipts))throw new Error('投入料采购实收记录格式不符')
    saved.baseMaterialLots ??= []
    saved.baseMaterialIssues ??= []
    saved.baseMaterialReturns ??= []
    if (![saved.baseMaterialLots,saved.baseMaterialIssues,saved.baseMaterialReturns].every(Array.isArray)) throw new Error('基础原料账格式不符')
    saved.purchaseReturns ??= []
    if (!Array.isArray(saved.purchaseReturns)) throw new Error('基础采购退货记录格式不符')
    // 旧原型曾保存“接单／开工／完工”动作。本业务已统一为确认接受、加工填报、发起交出，读取时直接丢弃旧字段。
    delete (saved as TmfPurchaseState & { workExecutions?: unknown }).workExecutions
    saved.workPlans ??= []
    if (!Array.isArray(saved.workPlans)) throw new Error('加工计划记录格式不符')
    saved.workCosts ??= []
    if (!Array.isArray(saved.workCosts)) throw new Error('加工单费用记录格式不符')
    saved.demands ??= []
    saved.reservations ??= []
    saved.processingIssues ??= []
    saved.cutOutputs ??= []
    saved.continuousReturns ??= []
    saved.tipMaterialReturns ??= []
    saved.tipMaterialLots ??= []
    saved.tipMaterialIssues ??= []
    saved.tipResults ??= []
    saved.defectiveScraps ??= []
    if (!Array.isArray(saved.defectiveScraps)) throw new Error('不良报废记录格式不符')
    saved.factoryScraps ??= []
    if (!Array.isArray(saved.factoryScraps)) throw new Error('厂内条料报废记录格式不符')
    saved.continuousScraps ??= []
    if (!Array.isArray(saved.continuousScraps)) throw new Error('连续料报废记录格式不符')
    saved.terminationDisposals ??= []
    saved.terminationClosures ??= []
    if (!Array.isArray(saved.terminationDisposals) || !Array.isArray(saved.terminationClosures)) throw new Error('终止处置记录格式不符')
    saved.packages ??= []
    saved.outputHandovers ??= []
    saved.outputAllocations ??= []
    saved.productionIssues ??= []
    saved.productionControls ??= []
    if (!Array.isArray(saved.productionControls)) throw new Error('生产暂停或取消记录格式不符')
    if (!Array.isArray(saved.outputAllocations) || !Array.isArray(saved.productionIssues)) throw new Error('产出分配或发料记录格式不符')
    if (!Array.isArray(saved.outputHandovers)) throw new Error('产出交出记录格式不符')
    if (![saved.demands, saved.reservations, saved.processingIssues, saved.cutOutputs, saved.continuousReturns, saved.tipMaterialReturns, saved.tipMaterialLots, saved.tipMaterialIssues, saved.tipResults, saved.packages].every(Array.isArray)) throw new Error('生产需求记录格式不符')
    state = saved
    return state
  } catch { throw new Error('织带厂保存记录无法读取，未覆盖原记录，请联系主管处理。') }
}

export function getTmfPurchaseState(): TmfPurchaseState {
  const result = structuredClone(current())
  result.processingIssues.forEach(issue => { if(issue.printHandover)issue.receivedMeters=tmfInputReceivedMeters(issue) })
  for (const id of new Set(result.demands.map(demand => demand.productionOrderId))) {
    const control = effectiveTmfProductionControl(result, id)
    if (!control) continue
    result.productionControls = result.productionControls.filter(item => item.productionOrderId !== id)
    result.productionControls.push({ ...control })
  }
  return result
}

export function listTmfMaterialPurchases(): TmfMaterialPurchaseOrder[] {
  return structuredClone(current().orders)
}

export function getTmfMaterialPurchase(purchaseOrderNo: string): TmfMaterialPurchaseOrder | undefined {
  const order = current().orders.find((item) => item.purchaseOrderNo === purchaseOrderNo)
  return order ? structuredClone(order) : undefined
}

function meters(value: number, allowZero = false): number {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)
    || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) throw new Error('米数须为有效正数，最多保留三位小数。')
  return Math.round(value * 1000) / 1000
}
function add(left: number, right: number): number { return Math.round((left + right) * 1000) / 1000 }
function allowed(actor: TmfPurchaseActor, roles: TmfPurchaseActor['role'][]): void {
  if (!actor.id.trim() || !actor.name.trim() || !roles.includes(actor.role)) throw new Error('当前角色不能执行此操作。')
}

function commit(
  operationId: string, action: string, objectId: string, actor: TmfPurchaseActor,
  payload: unknown, mutate: (draft: TmfPurchaseState, occurredAt: string) => { quantity?: number; unit?: TmfPurchaseOperation['unit']; reason?: string },
): void {
  // 浏览器内每次动作重新读取已保存结果，跨页面/重试不沿用过期数量。
  if (typeof window !== 'undefined') state = undefined
  if (!operationId.trim()) throw new Error('缺少本次操作编号，请重新进入任务。')
  const signature = JSON.stringify([action, objectId, actor.id, actor.role, payload])
  const previous = current().operations.find((operation) => operation.id === operationId)
  if (previous) {
    if (previous.payloadSignature !== signature) throw new Error('此操作编号已保存其他内容，请查看原记录后重新操作。')
    return
  }
  const draft = structuredClone(current())
  const occurredAt = new Date().toISOString()
  const result = mutate(draft, occurredAt)
  draft.operations.push({ id: operationId, action, objectId, actor: { ...actor }, occurredAt, quantity: result.quantity, unit: result.quantity === undefined ? undefined : result.unit ?? '米', reason: result.reason || '', payloadSignature: signature })
  const storage = getBrowserLocalStorage()
  if (typeof window !== 'undefined' && (!storage || !writeBrowserStorageItem(storage, TMF_PURCHASE_STORAGE_KEY, JSON.stringify(draft)))) {
    throw new Error('本次未保存，数量未改变。请检查浏览器存储后使用原操作重试。')
  }
  state = draft
}

export function createTmfMaterialPurchase(
  order: TmfMaterialPurchaseOrder, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['采购员', '采购主管'])
  commit(operationId, '创建基础采购', order.purchaseOrderNo, actor, order, (draft, at) => {
    if (draft.orders.some((item) => item.purchaseOrderNo === order.purchaseOrderNo || item.purchaseLineId === order.purchaseLineId)) throw new Error('采购单或采购明细已经存在。')
    for (const value of [order.purchaseOrderNo, order.purchaseLineId, order.supplierId, order.materialSkuId, order.materialSpuId, order.targetWarehouseId, order.productionStandard, order.expectedArrivalDate]) {
      if (!value?.trim()) throw new Error('请补齐采购来源、供应方、物料、目标仓、交期及基础生产标准。')
    }
    if (order.factoryOrgId !== TMF_FACTORY_ID || !['织带', '绳子'].includes(order.accessoryType) || order.unit !== '米') throw new Error('仅接收明确关联 TMF 的米制织带／绳子基础采购。')
    const recipe = order.baseMaterialRecipe
    if (!recipe || !recipe.materialSkuId.trim() || !recipe.specification.trim() || !['kg', 'g'].includes(recipe.unit)
      || !Number.isFinite(recipe.quantityPerMeter) || recipe.quantityPerMeter <= 0) {
      throw new Error('半成品采购必须带有可执行的基础原料配方、单位和每米标准耗用。')
    }
    assertTmfRawMaterialMaster(recipe.materialSkuId)
    // 主档映射：供应方、织带／绳子物料与目标仓必须解析到原型内建权威主档才能创建。
    const masters = assertTmfBasePurchaseMasters({ supplierId: order.supplierId, materialSkuId: order.materialSkuId, targetWarehouseId: order.targetWarehouseId })
    if (order.version !== 1 || order.receivedQty !== 0 || order.status !== '待采购') throw new Error('新采购必须从未实收的待采购状态创建。')
    meters(order.orderedQty)
    draft.orders.push({ ...structuredClone(order), masterRefs: {
      supplier: { masterId: masters.supplier.masterId, code: masters.supplier.code, name: masters.supplier.name, source: masters.supplier.source },
      material: { masterId: masters.material.masterId, code: masters.material.code, name: masters.material.name, source: masters.material.source, category: masters.material.category },
      warehouse: { masterId: masters.warehouse.masterId, code: masters.warehouse.code, name: masters.warehouse.name, source: masters.warehouse.source },
      resolvedAt: at } })
    return { quantity: order.orderedQty }
  })
}

export function releaseTmfMaterialPurchase(purchaseOrderNo: string, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['采购员', '采购主管'])
  commit(operationId, '下达采购', purchaseOrderNo, actor, {}, (draft) => {
    const order = draft.orders.find((item) => item.purchaseOrderNo === purchaseOrderNo)
    if (!order || order.status !== '待采购') throw new Error('只有待采购单可以下达。')
    order.status = '已采购'
    return { quantity: order.orderedQty }
  })
}

export function generateTmfBaseOrder(purchaseOrderNo: string, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂主管', '采购员', '采购主管'])
  commit(operationId, '生成半成品加工单', purchaseOrderNo, actor, {}, (draft) => {
    const order = draft.orders.find((item) => item.purchaseOrderNo === purchaseOrderNo)
    if (!order || !['已采购', '部分到货'].includes(order.status)) throw new Error('采购尚未下达或已终止，不能生成半成品加工单。')
    if (draft.baseOrders.some((item) => item.purchaseLineId === order.purchaseLineId)) return { reason: '原采购明细已有半成品加工单，沿用原单' }
    draft.baseOrders.push({ id: `TMF-SEMI-${order.purchaseLineId}`, purchaseOrderNo, purchaseLineId: order.purchaseLineId, purchaseVersion: order.version,
      materialSkuId: order.materialSkuId, targetWarehouseId: order.targetWarehouseId, plannedMeters: order.orderedQty,
      dueDate: order.expectedArrivalDate, productionStandard: order.productionStandard, baseMaterialRecipe: structuredClone(order.baseMaterialRecipe),
      producedMeters: 0, changePending: false })
    return { quantity: order.orderedQty }
  })
}

export function reportTmfBaseProduction(
  baseOrderId: string, producedMeters: number, actor: TmfPurchaseActor, operationId: string,
  overPlan?: { reason: string; confirmed: boolean },
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  meters(producedMeters)
  commit(operationId, '半成品加工填报', baseOrderId, actor, { producedMeters, overPlan: overPlan ?? null }, (draft, at) => {
    const base = draft.baseOrders.find((item) => item.id === baseOrderId)
    if (!base || base.cancelledAt || base.changePending) throw new Error('半成品加工单不存在、已终止或有采购变更待处理。')
    if (!base.acceptedAt) throw new Error('请先确认接受半成品加工单，再填报加工产出。')
    if (!base.baseMaterialRecipe) throw new Error('半成品加工单缺少基础原料配方，请先补齐采购生产标准后再填报。')
    const issues = draft.baseMaterialIssues.filter((item) => item.baseOrderId === base.id)
    const received = issues.reduce((sum, item) => add(sum, item.receivedQty), 0)
    if (!issues.length || received <= 0) throw new Error('尚未收到本半成品加工单的基础原料，不能填报产出。')
    const normalizedConsumed = issues.reduce((sum, item) => {
      const lot = draft.baseMaterialLots.find((candidate) => candidate.id === item.lotId)
      if (!lot || lot.materialSkuId !== base.baseMaterialRecipe.materialSkuId) return sum
      const consumed = lot.unit === base.baseMaterialRecipe.unit
        ? item.consumedQty
        : lot.unit === 'g' ? item.consumedQty / 1000 : item.consumedQty * 1000
      return add(sum, consumed)
    }, 0)
    const requiredConsumed = add(base.producedMeters, producedMeters) * base.baseMaterialRecipe.quantityPerMeter
    if (normalizedConsumed + 0.000001 < requiredConsumed) {
      throw new Error(`基础原料实际耗用不足：累计产出 ${add(base.producedMeters, producedMeters)} 米至少需要 ${requiredConsumed} ${base.baseMaterialRecipe.unit}，当前已耗用 ${normalizedConsumed} ${base.baseMaterialRecipe.unit}。`)
    }
    // 半成品加工不单独建立“开工”动作；首次实际填报即是加工开始的事实时间。
    base.startedAt ??= at
    const overage = add(base.producedMeters, producedMeters) - base.plannedMeters
    if (overage > 0) {
      // 超产事实必须由织带厂主管核对实物后确认，计划量保持不扩。
      if (actor.role !== '织带厂主管') throw new Error(`本次产出将超过基础生产计划 ${overage} 米；请由织带厂主管核对实物后确认超产。`)
      if (!overPlan?.confirmed || !overPlan.reason.trim()) throw new Error('超计划产出须填写原因并二次确认；计划数量不会自动扩大。')
      base.overProductions ??= []
      base.overProductions.push({ meters: overage, reason: overPlan.reason.trim(), confirmedBy: actor.id, confirmedAt: at })
    }
    base.producedMeters = add(base.producedMeters, producedMeters)
    if (base.producedMeters >= base.plannedMeters) base.completedAt ??= at
    return { quantity: producedMeters, reason: overage > 0 ? `超计划 ${overage} 米；${overPlan!.reason.trim()}` : undefined }
  })
}

export function acceptTmfBaseOrder(baseOrderId: string, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂主管'])
  commit(operationId, '半成品加工单确认接受', baseOrderId, actor, {}, (draft, at) => {
    const base = draft.baseOrders.find((item) => item.id === baseOrderId)
    if (!base || base.acceptedAt || base.cancelledAt || base.changePending) throw new Error('当前半成品加工单无法确认接受，请检查状态及采购变更。')
    base.acceptedAt = at
    return {}
  })
}

export function confirmTmfPurchaseSupplier(purchaseOrderNo: string, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['采购员', '采购主管'])
  commit(operationId, '供应商确认', purchaseOrderNo, actor, {}, (draft, at) => {
    const order = draft.orders.find((item) => item.purchaseOrderNo === purchaseOrderNo)
    if (!order || order.status === '已关闭') throw new Error('采购不存在或已终止。')
    order.supplierConfirmed = true
    order.supplierConfirmedAt = at
    return {}
  })
}

export function cancelTmfMaterialPurchaseAfterDisposition(
  purchaseOrderNo: string, input: { reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['采购员', '采购主管'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('取消采购必须填写处置原因并再次确认。')
  commit(operationId, '取消基础采购并确认处置', purchaseOrderNo, actor, input, (draft) => {
    const order = draft.orders.find(item => item.purchaseOrderNo === purchaseOrderNo)
    if (!order || order.status === '已关闭') throw new Error('采购不存在或已经取消。')
    const base = draft.baseOrders.find(item => item.purchaseOrderNo === purchaseOrderNo)
    const returns = draft.purchaseReturns.filter(item => item.purchaseOrderNo === purchaseOrderNo)
    if (returns.some(item => item.receivedMeters < item.dispatchedMeters)) throw new Error('采购退货仍在途，未收齐不能结案。')
    if ((base?.producedMeters ?? 0) > 0 || draft.handovers.some(item => item.purchaseOrderNo === purchaseOrderNo)) throw new Error('已产生基础生产或交接事实，不能直接取消；请先完成实物处置。')
    const lots = draft.lots.filter(item => item.sourcePurchaseOrderNo === purchaseOrderNo)
    if (lots.some(item => item.onHandMeters > 0 || item.reservedMeters > 0 || item.frozenMeters > 0)) throw new Error('仍有基础库存、占用或冻结物，不能直接取消。')
    if (returns.some(item => item.receivedMeters > 0) || order.receivedQty > 0) throw new Error('原采购已有实收，须通过退货或更正完成处置后再取消。')
    order.status = '已关闭'
    order.remark = input.reason.trim()
    return { reason: input.reason }
  })
}

export function reviseTmfMaterialPurchase(
  purchaseOrderNo: string,
  input: { orderedQty?: number; expectedArrivalDate?: string; close?: boolean; reason: string; confirmed: boolean; expectedVersion?: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['采购员', '采购主管'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('采购变更须填写原因并再次确认。')
  if (input.orderedQty !== undefined) meters(input.orderedQty)
  commit(operationId, '采购变更', purchaseOrderNo, actor, input, (draft, at) => {
    const order = draft.orders.find((item) => item.purchaseOrderNo === purchaseOrderNo)
    if (draft.purchaseReturns.some(r=>r.purchaseOrderNo===purchaseOrderNo && r.receivedMeters<r.dispatchedMeters)) throw new Error('采购退货仍在途，请等待TMF实际收齐后再变更。')
    if (!order || order.status === '已关闭' || order.status === '已入库') throw new Error('采购不存在或已结案，不能直接变更。')
    if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) throw new Error('采购版本已变化，请重新打开变更并核对最新计划。')
    if (input.orderedQty === undefined && input.expectedArrivalDate === undefined && !input.close) throw new Error('没有填写变更内容。')
    if (input.expectedArrivalDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.expectedArrivalDate)) throw new Error('请填写有效交期。')
    if (!input.close && (input.orderedQty === undefined || input.orderedQty === order.orderedQty) && (input.expectedArrivalDate === undefined || input.expectedArrivalDate === order.expectedArrivalDate)) throw new Error('采购内容未变化，请修改后再确认。')
    order.version += 1
    order.orderedQty = input.orderedQty ?? order.orderedQty
    order.expectedArrivalDate = input.expectedArrivalDate ?? order.expectedArrivalDate
    if (input.close) order.status = '已关闭'
    order.remark = input.reason
    for (const base of draft.baseOrders.filter((item) => item.purchaseLineId === order.purchaseLineId)) {
      if (base.startedAt || base.producedMeters > 0) {
        base.changePending = true
      } else {
        base.planRevisions ??= []
        base.planRevisions.push({ fromVersion: base.purchaseVersion, toVersion: order.version,
          beforeMeters: base.plannedMeters, afterMeters: order.orderedQty, producedMetersAtChange: base.producedMeters,
          dueDateBefore: base.dueDate, dueDateAfter: order.expectedArrivalDate, reason: input.reason,
          confirmedBy: actor.id, confirmedAt: at })
        base.purchaseVersion = order.version
        base.plannedMeters = order.orderedQty
        base.dueDate = order.expectedArrivalDate
        base.acceptedAt = undefined
        if (input.close) base.cancelledAt = at
      }
    }
    return { reason: input.reason }
  })
}

export function resolveTmfBasePurchaseChange(
  baseOrderId: string, input: { reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('请核对已生产、已交出数量，填写处置原因并确认。')
  commit(operationId, '确认基础采购变更', baseOrderId, actor, input, (draft, at) => {
    const base = draft.baseOrders.find((item) => item.id === baseOrderId)
    if (!base || !base.changePending) throw new Error('此半成品加工单没有待处理采购变更。')
    const order = draft.orders.find((item) => item.purchaseOrderNo === base.purchaseOrderNo)!
    const returns = draft.purchaseReturns.filter(r=>r.baseOrderId===base.id)
    if (returns.some(r=>r.receivedMeters<r.dispatchedMeters)) throw new Error('采购退货仍在途，不能结束处置。')
    if (draft.handovers.some(h=>h.baseOrderId===base.id && h.receivedMeters<h.dispatchedMeters)) throw new Error('基础交出仍在途，请先核清实际接收。')
    if (returns.length && order.version===base.purchaseVersion) throw new Error('请先由采购修订已退货后的采购计划，再核对处置。')
    const retainedProduced = add(base.producedMeters,-returns.reduce((n,r)=>add(n,r.receivedMeters),0))
    if (order.status === '已关闭' || order.orderedQty < retainedProduced) {
      throw new Error('采购终止或计划少于实际产出，请先明确余料、已产出和在途的处置，不能直接恢复。')
    }
    base.planRevisions ??= []
    base.planRevisions.push({ fromVersion: base.purchaseVersion, toVersion: order.version,
      beforeMeters: base.plannedMeters, afterMeters: order.orderedQty, producedMetersAtChange: base.producedMeters,
      dueDateBefore: base.dueDate, dueDateAfter: order.expectedArrivalDate, reason: input.reason, confirmedBy: actor.id, confirmedAt: at })
    base.plannedMeters = order.orderedQty
    base.dueDate = order.expectedArrivalDate
    base.purchaseVersion = order.version
    base.changePending = false
    if (base.producedMeters < base.plannedMeters) base.completedAt = undefined
    if (order.receivedQty >= order.orderedQty) order.status = '已入库'
    return { reason: input.reason }
  })
}

export function dispatchTmfBaseProduction(
  input: { baseOrderId: string; handoverId: string; batchId: string; dispatchedMeters: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  meters(input.dispatchedMeters)
  commit(operationId, '基础半成品交出', input.baseOrderId, actor, input, (draft, at) => {
    const base = draft.baseOrders.find((item) => item.id === input.baseOrderId)
    if (!base || base.cancelledAt || base.changePending) throw new Error('半成品加工单不存在、已终止或有采购变更待处理。')
    if (!input.handoverId.trim() || !input.batchId.trim()
      || draft.handovers.some((item) => item.id === input.handoverId || item.batchId === input.batchId)
      || draft.continuousReturns.some((item) => item.id === input.handoverId || item.batchId === input.batchId)
      || draft.lots.some((item) => item.id === input.batchId)) throw new Error('交出单及批次编号必须有效且不能重复。')
    const alreadySent = draft.handovers.filter((item) => item.baseOrderId === base.id).reduce((sum, item) => add(sum, item.dispatchedMeters), 0)
    if (add(alreadySent, input.dispatchedMeters) > base.producedMeters) throw new Error('交出数量超过尚未交出的实际产出。')
    draft.handovers.push({ id: input.handoverId, baseOrderId: base.id, purchaseOrderNo: base.purchaseOrderNo, purchaseLineId: base.purchaseLineId,
      materialSkuId: base.materialSkuId, batchId: input.batchId, warehouseId: base.targetWarehouseId,
      dispatchedMeters: input.dispatchedMeters, receivedMeters: 0, dispatchedAt: at })
    return { quantity: input.dispatchedMeters }
  })
}

export function receiveTmfBaseProduction(
  input: { handoverId: string; materialSkuId: string; warehouseId: string; location: string; receivedMeters: number;
    overReceipt?: { reason: string; confirmed: boolean } },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  meters(input.receivedMeters)
  commit(operationId, '基础半成品实收', input.handoverId, actor, input, (draft, at) => {
    const handover = draft.handovers.find((item) => item.id === input.handoverId)
    if (!handover) throw new Error('没有上游实际交出记录，不能凭采购计划收货。')
    if (handover.materialSkuId !== input.materialSkuId || handover.warehouseId !== input.warehouseId) throw new Error('扫码物料或目标仓不符，请核对后重新接收。')
    if (!input.location.trim()) throw new Error('请填写实收库位。')
    if (add(handover.receivedMeters, input.receivedMeters) > handover.dispatchedMeters) throw new Error('实收超过上游实际交出，数量未保存，请主管核实来源。')
    const order = draft.orders.find((item) => item.purchaseOrderNo === handover.purchaseOrderNo)!
    if (order.status === '已关闭') throw new Error('采购已终止，请主管处理已发在途的接收去向。')
    const overage = add(add(order.receivedQty, input.receivedMeters), -order.orderedQty)
    if (overage > 0) {
      // 超过采购计划量的实收只能由仓库主管确认来源；硬上限仍是不超过上游实际交出。
      if (actor.role !== '仓库主管') throw new Error(`本次实收将超过采购计划 ${overage} 米；普通仓管不能确认超收，请由仓库主管核对来源、填写原因并二次确认。`)
      if (!input.overReceipt?.confirmed || !input.overReceipt.reason.trim()) throw new Error('超收须填写原因并二次确认；采购计划数量不会自动扩大。')
      order.overReceipts ??= []
      order.overReceipts.push({ meters: overage, reason: input.overReceipt.reason.trim(), confirmedBy: actor.id, confirmedAt: at, handoverId: handover.id })
    }
    handover.receivedMeters = add(handover.receivedMeters, input.receivedMeters)
    let lot = draft.lots.find((item) => item.sourceHandoverId === handover.id)
    if (lot && lot.location !== input.location) throw new Error('该批次已有实收库位，请先收至原库位，再办理移库。')
    if (!lot) {
      lot = { id: handover.batchId, materialSkuId: handover.materialSkuId, sourcePurchaseOrderNo: order.purchaseOrderNo,
        sourcePurchaseLineId: handover.purchaseLineId, sourceHandoverId: handover.id, warehouseId: handover.warehouseId,
        location: input.location, receivedMeters: 0, onHandMeters: 0, reservedMeters: 0, frozenMeters: 0 }
      draft.lots.push(lot)
    }
    lot.receivedMeters = add(lot.receivedMeters, input.receivedMeters)
    lot.onHandMeters = add(lot.onHandMeters, input.receivedMeters)
    order.receivedQty = add(order.receivedQty, input.receivedMeters)
    order.status = order.receivedQty >= order.orderedQty ? '已入库' : '部分到货'
    return { quantity: input.receivedMeters }
  })
}

export function getTmfPurchaseReturnBalance(purchaseOrderNo: string) {
  const data = current(), returned = data.purchaseReturns.filter(r=>r.purchaseOrderNo===purchaseOrderNo)
  const grossReceivedMeters = data.handovers.filter(h=>h.purchaseOrderNo===purchaseOrderNo).reduce((n,h)=>add(n,h.receivedMeters),0)
  const returnDispatchedMeters = returned.reduce((n,r)=>add(n,r.dispatchedMeters),0)
  const returnReceivedMeters = returned.reduce((n,r)=>add(n,r.receivedMeters),0)
  return { grossReceivedMeters, returnDispatchedMeters, returnReceivedMeters,
    returnTransitMeters:add(returnDispatchedMeters,-returnReceivedMeters), netReceivedMeters:add(grossReceivedMeters,-returnReceivedMeters) }
}

export function dispatchTmfPurchaseReturn(
  input: { returnId:string; lotId:string; warehouseId:string; materialSkuId:string; dispatchedMeters:number; reason:string; confirmed:boolean },
  actor:TmfPurchaseActor, operationId:string,
):void {
  allowed(actor,['仓管','仓库主管']);meters(input.dispatchedMeters)
  if(!input.returnId.trim()||!input.reason.trim()||!input.confirmed)throw new Error('请填写退货单号、原因并确认实际交出。')
  commit(operationId,'基础采购退货交出',input.returnId,actor,input,(draft,at)=>{
    if(draft.purchaseReturns.some(r=>r.id===input.returnId))throw new Error('退货单号已存在，请查看原单。')
    const lot=draft.lots.find(l=>l.id===input.lotId),handover=draft.handovers.find(h=>h.id===lot?.sourceHandoverId)
    const base=draft.baseOrders.find(b=>b.id===handover?.baseOrderId),order=draft.orders.find(o=>o.purchaseOrderNo===handover?.purchaseOrderNo)
    if(!lot||!handover||!base||!order||lot.receiptKind==='PROCESS_RETURN')throw new Error('仅原基础采购实际收货批次可退货，加工回料不能计作采购退货。')
    if(lot.warehouseId!==input.warehouseId||lot.materialSkuId!==input.materialSkuId)throw new Error('退货仓库或SKU与原实收批次不符。')
    if(order.status==='已关闭')throw new Error('采购已关闭，请先明确终止实物处置。')
    if(input.dispatchedMeters>add(lot.onHandMeters,-add(lot.reservedMeters,lot.frozenMeters)))throw new Error('超过当前可退数量，已占用或冻结物料不能直接退回。')
    lot.onHandMeters=add(lot.onHandMeters,-input.dispatchedMeters)
    base.changePending=true
    draft.purchaseReturns.push({id:input.returnId,purchaseOrderNo:order.purchaseOrderNo,baseOrderId:base.id,lotId:lot.id,
      sourceHandoverId:handover.id,materialSkuId:lot.materialSkuId,warehouseId:lot.warehouseId,factoryId:TMF_FACTORY_ID,
      dispatchedMeters:input.dispatchedMeters,receivedMeters:0,reason:input.reason,dispatchedAt:at,dispatchedBy:structuredClone(actor),receipts:[]})
    return {quantity:input.dispatchedMeters,reason:input.reason}
  })
}

export function receiveTmfPurchaseReturn(
  input:{returnId:string; factoryId:string; materialSkuId:string; receivedMeters:number; confirmed:boolean},
  actor:TmfPurchaseActor,operationId:string,
):void {
  allowed(actor,['织带厂主管']);meters(input.receivedMeters)
  if(!input.confirmed)throw new Error('请核对退货实物并确认本次实收。')
  commit(operationId,'基础采购退货实收',input.returnId,actor,input,(draft,at)=>{
    const returned=draft.purchaseReturns.find(r=>r.id===input.returnId)
    if(!returned||input.factoryId!==TMF_FACTORY_ID||returned.factoryId!==input.factoryId)throw new Error('请核对属于TMF的原退货交出单。')
    if(input.materialSkuId!==returned.materialSkuId)throw new Error('实收SKU与退货原单不符。')
    if(add(returned.receivedMeters,input.receivedMeters)>returned.dispatchedMeters)throw new Error('实收超过退货交出剩余数量。')
    const order=draft.orders.find(o=>o.purchaseOrderNo===returned.purchaseOrderNo)!
    if(order.receivedQty<input.receivedMeters)throw new Error('退货超过采购净实收，请核对原单。')
    returned.receivedMeters=add(returned.receivedMeters,input.receivedMeters)
    returned.receipts.push({meters:input.receivedMeters,receivedAt:at,receivedBy:structuredClone(actor)})
    order.receivedQty=add(order.receivedQty,-input.receivedMeters)
    if(order.status!=='已关闭')order.status='部分到货'
    return {quantity:input.receivedMeters,reason:'原实收不改写，TMF保留退回物，采购净实收减本次实际退货'}
  })
}

/** 仅重载内存以验证刷新；不删除用户浏览器数据。 */
export function reloadTmfPurchaseRuntime(): void { state = undefined }

export function registerTmfProductionOrder(
  order: Parameters<typeof deriveTmfProductionDemands>[0], actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划', '织带厂主管'])
  const demands = deriveTmfProductionDemands(order)
  if (!demands.length) throw new Error('该生产单没有需要执行的织带／绳子加工需求。')
  commit(operationId, '生成生产加工需求', order.productionOrderId, actor, demands, (draft) => {
    const allExisting = draft.demands.filter((item) => item.productionOrderId === order.productionOrderId)
    const existing = allExisting.filter(item => item.techPackSnapshotId === demands[0].techPackSnapshotId)
    if (allExisting.length && !existing.length) throw new Error('此生产单已有旧版本需求，请先核对采用版本变更，不能直接重复生成。')
    if (existing.length) assertTmfDemandActive(draft, existing[0].id)
    if (existing.length) {
      if (JSON.stringify(existing) !== JSON.stringify(demands)) throw new Error('此生产单已有不同版本或数量的加工需求，请先处理技术包变更。')
      return { reason: '沿用已有生产需求，不重复占用或生成' }
    }
    draft.demands.push(...demands)
    return { reason: `按技术包快照生成 ${demands.length} 条加工需求` }
  })
}

/** 计划时间须有明确时区；不接受浏览器所在时区隐式解释。 */
export function saveTmfWorkPlan(input: { workOrderId: string; responsibleName: string; plannedStartAt: string; plannedFinishAt: string; waitingReason: string; reason: string; expectedRevision: number }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['生产计划', '织带厂主管'])
  if (!input.responsibleName.trim() || !input.reason.trim()) throw new Error('请填写负责人和本次计划登记或变更原因。')
  const instants = [input.plannedStartAt, input.plannedFinishAt].map(value => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('计划时间须包含明确时区，且为有效日期。')
    const [year,month,day] = value.slice(0,10).split('-').map(Number)
    if (month<1 || month>12 || day<1 || day>new Date(Date.UTC(year,month,0)).getUTCDate()) throw new Error('计划日期不存在，请核对年月日。')
    return Date.parse(value)
  })
  if (instants[1] <= instants[0]) throw new Error('计划完成必须晚于计划开始。')
  commit(operationId, '登记加工计划时间', input.workOrderId, actor, input, (draft, at) => {
    const demands = draft.demands.filter(d => JSON.stringify([d.productionOrderId,d.techPackSnapshotId,d.routeEntryId])===input.workOrderId)
    if (!demands.length) throw new Error('加工单不存在，请核对生产单及采用版本。')
    demands.forEach(d => assertTmfDemandActive(draft,d.id))
    const old = draft.workPlans.find(p => p.workOrderId===input.workOrderId)
    if ((old?.revision ?? 0)!==input.expectedRevision) throw new Error('计划已由其他操作更新，请重新打开并核对最新计划。')
    const plan: TmfWorkPlan = {workOrderId:input.workOrderId,responsibleName:input.responsibleName.trim(),plannedStartAt:new Date(instants[0]).toISOString(),plannedFinishAt:new Date(instants[1]).toISOString(),waitingReason:input.waitingReason.trim(),revision:(old?.revision??0)+1,updatedAt:at,updatedBy:actor.name}
    draft.workPlans=draft.workPlans.filter(p=>p.workOrderId!==input.workOrderId)
    draft.workPlans.push(plan)
    return {reason:input.reason.trim()}
  })
}

function tmfWorkCostDemandReview(draft: TmfPurchaseState, workOrderId: string) {
  const demands = draft.demands.filter(d => JSON.stringify([d.productionOrderId, d.techPackSnapshotId, d.routeEntryId]) === workOrderId)
  if (!demands.length) throw new Error('加工单不存在，请核对生产单及采用版本。')
  demands.forEach(d => assertTmfDemandActive(draft, d.id))
  return demands
}

function tmfWorkCostQuantity(demands: TmfProductionDemand[], unit: TmfWorkCostUnit): number {
  if (unit === '单') return 1
  const quantity = unit === '米'
    ? demands.reduce((sum, demand) => sum + demand.theoreticalCutMeters, 0)
    : demands.reduce((sum, demand) => sum + demand.requiredPieces, 0)
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('当前加工单没有可计价的需求数量。')
  return Math.round(quantity * 1000) / 1000
}

export function getTmfWorkCost(workOrderId: string): TmfWorkCost | undefined {
  return structuredClone(current().workCosts.find(item => item.workOrderId === workOrderId))
}

export function getTmfWorkCostReview(workOrderId: string) {
  const demands = tmfWorkCostDemandReview(current(), workOrderId)
  const cost = current().workCosts.find(item => item.workOrderId === workOrderId)
  return structuredClone({ cost: cost ?? null, revision: cost?.revision ?? 0, demandCount: demands.length,
    quantities: { meters: Math.round(demands.reduce((sum, demand) => sum + demand.theoreticalCutMeters, 0) * 1000) / 1000,
      pieces: demands.reduce((sum, demand) => sum + demand.requiredPieces, 0) } })
}

export function saveTmfWorkCost(input: {
  workOrderId: string
  unitPrice: number
  currency: TmfWorkCostCurrency
  pricingUnit: TmfWorkCostUnit
  reason: string
  confirmed: boolean
  expectedRevision: number
}, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['生产计划', '织带厂主管'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('请核对计价口径，填写原因并再次确认。')
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0 || input.unitPrice > 100000000) throw new Error('单价须为不小于0且不超过100000000的有效金额。')
  if (!['CNY', 'IDR', 'USD'].includes(input.currency)) throw new Error('币种不在允许范围内。')
  if (!['米', '条', '根', '单'].includes(input.pricingUnit)) throw new Error('计价单位不在允许范围内。')
  commit(operationId, '登记加工单费用', input.workOrderId, actor, input, (draft, at) => {
    const demands = tmfWorkCostDemandReview(draft, input.workOrderId)
    const old = draft.workCosts.find(item => item.workOrderId === input.workOrderId)
    if ((old?.revision ?? 0) !== input.expectedRevision) throw new Error('费用口径已由其他操作更新，请重新打开并核对最新版本。')
    const pricingQuantity = tmfWorkCostQuantity(demands, input.pricingUnit)
    const estimatedAmount = Math.round(input.unitPrice * pricingQuantity * 100) / 100
    const cost: TmfWorkCost = { workOrderId: input.workOrderId, unitPrice: Math.round(input.unitPrice * 10000) / 10000,
      currency: input.currency, pricingUnit: input.pricingUnit, pricingQuantity, estimatedAmount,
      revision: (old?.revision ?? 0) + 1, reason: input.reason.trim(), updatedAt: at, updatedBy: actor.name }
    draft.workCosts = draft.workCosts.filter(item => item.workOrderId !== input.workOrderId)
    draft.workCosts.push(cost)
    return { reason: input.reason.trim() }
  })
}

function tmfVersionReplanReview(draft: TmfPurchaseState, productionOrderId: string) {
  const source = readProductionOrderRuntimeFact(productionOrderId) as Parameters<typeof deriveTmfProductionDemands>[0] | undefined
  if (!source?.productionOrderNo || !source.techPackSnapshot?.processEntries || !source.demandSnapshot?.skuLines) throw new Error('缺少主生产单的完整采用快照，请重新核对来源。')
  const next = deriveTmfProductionDemands(source)
  if (!next.length) throw new Error('新版本没有织带加工需求，请由计划处理旧需求终止。')
  if (getTmfDemandVersionChange(next[0])) throw new Error('主单选择版本与采用快照不一致，请先核对采用结果。')
  const previous = draft.demands.filter(d => d.productionOrderId === productionOrderId && !d.supersededBySnapshotId && d.techPackSnapshotId !== source.techPackSnapshot!.snapshotId)
  if (!previous.length) throw new Error('没有需要处理的旧版本需求。')
  if (draft.demands.some(d => next.some(n => n.id === d.id))) throw new Error('当前采用版本的需求已存在，请查看原生成记录。')
  const ids = new Set(previous.map(d => d.id))
  const reservations = draft.reservations.filter(r => ids.has(r.demandId))
  const executed = draft.processingIssues.some(i => ids.has(i.demandId)) || draft.tipMaterialIssues.some(i => ids.has(i.demandId))
    || draft.cutOutputs.some(o => ids.has(o.demandId)) || reservations.some(r => r.issuedMeters > 0)
  const control = effectiveTmfProductionControl(draft, productionOrderId)
  if (control && control.status !== 'ACTIVE') throw new Error(`主生产单受限：${control.reason}`)
  const outputs = draft.cutOutputs.filter(o => ids.has(o.demandId))
  const outputIds = new Set(outputs.map(o => o.id))
  const packages = draft.packages.filter(p => ids.has(p.demandId))
  const packageIds = new Set(packages.map(p => p.id))
  // 预览必须覆盖实物的变化；仅核对版本和占用会漏掉另一页的实收或报废。
  const physical = {
    issues: draft.processingIssues.filter(i => ids.has(i.demandId)).map(i => ({ ...i, actualReceivedMeters: tmfInputReceivedMeters(i), balance: getTmfProcessingInputBalance(i.id) })),
    outputs, tips: draft.tipResults.filter(t => outputIds.has(t.cutOutputId)),
    scraps: draft.defectiveScraps.filter(s => outputIds.has(s.cutOutputId)),
    packages, handovers: draft.outputHandovers.filter(h => packageIds.has(h.packageId)),
    allocations: draft.outputAllocations.filter(a => ids.has(a.demandId)),
    productionIssues: draft.productionIssues.filter(i => ids.has(i.demandId)),
    tipIssues: draft.tipMaterialIssues.filter(i => ids.has(i.demandId)),
    tipReturns: draft.tipMaterialReturns.filter(r => draft.tipMaterialIssues.some(i => i.id === r.sourceIssueId && ids.has(i.demandId))),
  }
  return { productionOrderId, previous: structuredClone(previous), next, reservations: structuredClone(reservations),
    reservedMeters: reservations.reduce((n,r) => add(n,r.reservedMeters),0), executed, physical: structuredClone(physical),
    blockedByProductionIssue: physical.productionIssues.some(i => i.dispatchedPieces > 0) }
}

export function getTmfVersionReplanReview(productionOrderId: string) {
  if (typeof window !== 'undefined') state = undefined
  return tmfVersionReplanReview(current(), productionOrderId)
}

/** 只重算未发生实物流转的需求；历史规格保留，释放占用与新需求同时保存。 */
export function replanTmfUnstartedVersion(input: { productionOrderId: string; expectedReview: string; reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string): void {
  commitTmfVersionReplan(input, actor, operationId, false)
}

/** 已加工旧实物原位冻结，新版按完整采用要求重新准备；不把旧物自动转换为新版。 */
export function replanTmfVersionWithFrozenOutputs(input: { productionOrderId: string; expectedReview: string; reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string): void {
  commitTmfVersionReplan(input, actor, operationId, true)
}

function commitTmfVersionReplan(input: { productionOrderId: string; expectedReview: string; reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string, freezeOutputs: boolean): void {
  allowed(actor, ['生产计划'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('请核对新旧规格和占用，填写变更处理原因并确认。')
  commit(operationId, freezeOutputs ? '旧实物冻结后采用换版重算' : '未发料需求采用换版重算', input.productionOrderId, actor, input, draft => {
    const review = tmfVersionReplanReview(draft, input.productionOrderId)
    if (JSON.stringify(review) !== input.expectedReview) throw new Error('采用版本、需求或占用已变化，或旧实物发生收发/处置，请重新打开核对；尚未重算。')
    if (review.executed && !freezeOutputs) throw new Error('旧需求已有发料或加工事实，须先处置实物，不能按未发料重算。')
    if (freezeOutputs && !review.executed) throw new Error('旧需求尚未发料，请使用未发料换版重算。')
    if (freezeOutputs && review.blockedByProductionIssue) throw new Error('旧版本已有生产发料或实收，须先核对生产端已用数量；不能按全部重做生成需求。')
    for (const before of review.reservations) {
      const reservation = draft.reservations.find(r => r.id === before.id)!
      const lot = draft.lots.find(l => l.id === reservation.lotId)
      if (!lot || lot.reservedMeters < reservation.reservedMeters) throw new Error('原占用与库存不一致，请核对后再处理。')
      lot.reservedMeters = add(lot.reservedMeters, -reservation.reservedMeters)
      reservation.reservedMeters = 0
    }
    let releasedPieces = 0
    if (freezeOutputs) for (const old of review.physical.allocations) {
      const allocation = draft.outputAllocations.find(a => a.id === old.id)!
      releasedPieces += allocation.allocatedPieces - allocation.releasedPieces
      allocation.releasedPieces = allocation.allocatedPieces
    }
    for (const demand of draft.demands.filter(d => review.previous.some(previous => previous.id === d.id))) demand.supersededBySnapshotId = review.next[0].techPackSnapshotId
    if (freezeOutputs) for (const pkg of draft.packages.filter(pkg => review.previous.some(previous => previous.id === pkg.demandId))) {
      // A split parent is no longer an independently actionable inventory object.
      // Its child packages carry the remaining facts; evaluating the parent here
      // would incorrectly abort a version replan with "包不存在或已拆分".
      if (pkg.splitAt) continue
      const balance = outputPackageBalance(draft, pkg.id)
      if (balance.onHandPieces > 0) pkg.versionFreeze = { pieces: balance.onHandPieces, previousSnapshotId: review.previous[0]?.techPackSnapshotId ?? '', reason: input.reason.trim(), frozenAt: new Date().toISOString(), actor: structuredClone(actor) }
    }
    draft.demands.push(...review.next)
    return { quantity: review.reservedMeters, reason: `${input.reason.trim()}；释放旧占用 ${review.reservedMeters} 米、未发分配 ${releasedPieces} 条/根，按当前采用版本生成 ${review.next.length} 条需求；${freezeOutputs ? '旧实物按原规格原位冻结，不计入新版满足量' : '旧需求保留'}` }
  })
}

function tmfContinuousLotEntry(draft: TmfPurchaseState, demand: TmfProductionDemand, lot: TmfPurchaseState['lots'][number]) {
  const root = demand.routeSnapshot.find(r => r.id === demand.sourceRouteEntryId)
  if (lot.receiptKind === 'PROCESS_RETURN' && lot.materialSkuId === demand.materialSkuId) {
    const returned = draft.continuousReturns.find(r => r.id === lot.sourceHandoverId && r.batchId === lot.id && r.receivedMeters > 0)
    const source = draft.processingIssues.find(i => i.id === returned?.sourceIssueId)
    const previous = draft.demands.find(d => d.id === source?.demandId)
    const cut = demand.routeSnapshot.find(r => r.id === demand.routeEntryId)
    if (source?.targetFactoryId === TMF_FACTORY_ID && source.targetRouteEntryId === previous?.routeEntryId
      && source.materialSkuId === lot.materialSkuId && returned?.materialSkuId === lot.materialSkuId
      && returned.warehouseId === lot.warehouseId && cut?.processCode === 'WEBBING_CUT'
      && cut.inputInventoryForm === 'CONTINUOUS' && cut.inputMaterialSkuId === lot.materialSkuId) return cut
    return undefined
  }
  return lot.materialSkuId === demand.sourceMaterialSkuId ? root : undefined
}

/** 只从当前实收批次和原加工来源判定接续节点，不能由页面自由指定跳过工艺。 */
export function getTmfContinuousLotEntry(demandId: string, lotId: string) {
  const draft = current(), demand = draft.demands.find(d => d.id === demandId), lot = draft.lots.find(l => l.id === lotId)
  return demand && lot ? structuredClone(tmfContinuousLotEntry(draft, demand, lot)) : undefined
}

export function reserveTmfContinuousMaterial(
  input: { reservationId: string; demandId: string; lotId: string; reservedMeters: number; reason: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划', '仓管', '仓库主管'])
  meters(input.reservedMeters)
  commit(operationId, '占用半成品', input.demandId, actor, input, (draft) => {
    const demand = draft.demands.find((item) => item.id === input.demandId)
    const lot = draft.lots.find((item) => item.id === input.lotId)
    const entry = demand && lot ? tmfContinuousLotEntry(draft, demand, lot) : undefined
    if (!demand || !lot || !entry) throw new Error('需求或批次不存在，或投入 SKU / 已加工回仓来源不符。')
    assertTmfDemandActive(draft, demand.id)
    if (!input.reservationId.trim() || draft.reservations.some((item) => item.id === input.reservationId)) throw new Error('占用编号无效或已存在。')
    const available = add(lot.onHandMeters, -lot.reservedMeters - lot.frozenMeters)
    if (input.reservedMeters > available) throw new Error(`本批可分配 ${available} 米，缺 ${add(input.reservedMeters, -available)} 米。`)
    const assigned = draft.reservations.filter((item) => item.demandId === demand.id).reduce((sum, item) => add(sum, item.reservedMeters + item.issuedMeters), 0)
    if (add(assigned, input.reservedMeters) > demand.theoreticalCutMeters && !input.reason.trim()) throw new Error('安排量超过理论下料量，请明确印染、截断损耗或补做依据。')
    draft.reservations.push({ id: input.reservationId, demandId: demand.id, lotId: lot.id, reservedMeters: input.reservedMeters, issuedMeters: 0,
      ...(entry.id !== demand.sourceRouteEntryId ? { targetRouteEntryId: entry.id } : {}) })
    lot.reservedMeters = add(lot.reservedMeters, input.reservedMeters)
    return { quantity: input.reservedMeters, reason: input.reason }
  })
}

export function releaseTmfContinuousReservation(
  reservationId: string, quantity: number, reason: string, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划', '仓库主管'])
  meters(quantity)
  if (!reason.trim()) throw new Error('请填写释放占用的原因。')
  commit(operationId, '释放半成品占用', reservationId, actor, { quantity, reason }, (draft) => {
    const reservation = draft.reservations.find((item) => item.id === reservationId)
    if (!reservation || quantity > reservation.reservedMeters) throw new Error('释放量超过尚未发出的占用量。')
    const lot = draft.lots.find((item) => item.id === reservation.lotId)!
    reservation.reservedMeters = add(reservation.reservedMeters, -quantity)
    lot.reservedMeters = add(lot.reservedMeters, -quantity)
    return { quantity, reason }
  })
}

export function issueTmfContinuousMaterial(
  input: { issueId: string; reservationId: string; targetFactoryId: string; dispatchedMeters: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  commitTmfContinuousIssue(input, actor, operationId)
}

/** 发料前从正式加工单重新核对版本、SKU及接收工厂；调用方不能自填关联。 */
export async function issueTmfUpstreamMaterial(
  input: { issueId: string; reservationId: string; targetFactoryId: string; dispatchedMeters: number },
  actor: TmfPurchaseActor, operationId: string,
): Promise<void> {
  allowed(actor, ['仓管', '仓库主管'])
  const { readTmfUpstreamProcessOrders } = await import('../fcs/tmf-upstream-process-orders.ts')
  const receiving = await import('../fcs/factory-receiving.ts')
  if (typeof window !== 'undefined') state = undefined
  const saved = current(), reservation = saved.reservations.find(r => r.id === input.reservationId)
  const demand = saved.demands.find(d => d.id === reservation?.demandId)
  if (!demand) throw new Error('来源需求或占用不存在。')
  const stage = (await readTmfUpstreamProcessOrders([demand])).find(r => r.entryId === demand.sourceRouteEntryId)
  if (!stage?.matchedOrderId) throw new Error('首道印染加工单未唯一匹配，须先核对版本、SKU、单位及工厂。')
  const order = stage.rows[0], root = demand.routeSnapshot.find(r => r.id === demand.sourceRouteEntryId)!
  if (order.factoryId !== input.targetFactoryId) throw new Error('接收工厂与正式印染加工单不符。')
  if (root.processCode !== 'DYE' && root.processCode !== 'PRINT') throw new Error('首道不是印染工艺。')
  const lot = saved.lots.find(l => l.id === reservation!.lotId)!
  const purchase = saved.orders.find(p => p.purchaseOrderNo === lot.sourcePurchaseOrderNo)!
  const origin = { kind: 'WAREHOUSE' as const, id: lot.warehouseId, name: purchase.warehouse, warehouseAttribute: '辅料仓' }
  const conflict = root.processCode === 'DYE' ? receiving.getDyeReceivingConflict(order.id, order.inputCode, origin) : receiving.getPrintingReceivingConflict(order.id, order.inputCode, origin)
  if (conflict) throw new Error(conflict)
  commitTmfContinuousIssue(input, actor, operationId, { processCode: root.processCode, orderId: order.id, orderNo: order.no, factoryName: order.factoryName || order.factoryId!, inputCode: order.inputCode })
}

type TmfContinuousIssueInput = { issueId: string; reservationId: string; targetFactoryId: string; dispatchedMeters: number }
function commitTmfContinuousIssue(input: TmfContinuousIssueInput, actor: TmfPurchaseActor, operationId: string, upstream?: TmfUpstreamIssueBinding): void {
  allowed(actor, ['仓管', '仓库主管'])
  commit(operationId, '生产加工发料', input.reservationId, actor, { ...input, ...(upstream ? { upstream } : {}) }, (draft, at) => applyTmfContinuousIssue(draft, input, at, upstream))
}
function applyTmfContinuousIssue(draft: TmfPurchaseState, input: TmfContinuousIssueInput, at: string, upstream?: TmfUpstreamIssueBinding) {
  meters(input.dispatchedMeters)
    const reservation = draft.reservations.find((item) => item.id === input.reservationId)
    if (!reservation || input.dispatchedMeters > reservation.reservedMeters) throw new Error('发料不能超过当前需求的未发占用数量。')
    const demand = draft.demands.find((item) => item.id === reservation.demandId)!
    assertTmfDemandActive(draft, demand.id)
    const lot = draft.lots.find((item) => item.id === reservation.lotId)!
    const root = lot && tmfContinuousLotEntry(draft, demand, lot)
    if (!root || root.id !== (reservation.targetRouteEntryId ?? demand.sourceRouteEntryId)) throw new Error('原批次投入节点或来源已变化，请重新核对占用。')
    if (upstream && root.id !== demand.sourceRouteEntryId) throw new Error('已加工回仓批次按截断节点发出，不能再次发给印染。')
    if (root.processCode !== 'WEBBING_CUT' && (!upstream || upstream.processCode !== root.processCode)) throw new Error('首道为印染，请先关联对应印染加工单及接收工厂。')
    if (!input.targetFactoryId.trim() || (root.processCode === 'WEBBING_CUT' && input.targetFactoryId !== TMF_FACTORY_ID)) throw new Error('请按首道路线指定正确加工厂。')
    if (!input.issueId.trim() || draft.processingIssues.some((item) => item.id === input.issueId)) throw new Error('发料单编号无效或已使用。')
    if (upstream) {
      const purchase = draft.orders.find(p => p.purchaseOrderNo === lot.sourcePurchaseOrderNo)
      if (!purchase?.materialImageUrl || !purchase.materialName || !purchase.productionStandard || !purchase.warehouse) throw new Error('采购物料图片、名称、生产标准或来源仓资料缺失，不能交出印染。')
      if (lot.materialSkuId !== demand.sourceMaterialSkuId) throw new Error('该批次SKU不属于首道投入。')
    }
    if (input.dispatchedMeters > add(lot.onHandMeters, -lot.frozenMeters)) throw new Error('该批次库存不足或已冻结，不能发料。')
    lot.onHandMeters = add(lot.onHandMeters, -input.dispatchedMeters)
    lot.reservedMeters = add(lot.reservedMeters, -input.dispatchedMeters)
    reservation.reservedMeters = add(reservation.reservedMeters, -input.dispatchedMeters)
    reservation.issuedMeters = add(reservation.issuedMeters, input.dispatchedMeters)
    draft.processingIssues.push({ id: input.issueId, reservationId: reservation.id, demandId: demand.id, lotId: lot.id,
      materialSkuId: lot.materialSkuId, targetRouteEntryId: root.id, targetFactoryId: input.targetFactoryId,
      dispatchedMeters: input.dispatchedMeters, receivedMeters: 0, dispatchedAt: at, ...(upstream ? { upstream } : {}) })
    return { quantity: input.dispatchedMeters }
}

export function receiveTmfProcessingMaterial(
  input: { issueId: string; factoryId: string; materialSkuId: string; receivedMeters: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  meters(input.receivedMeters)
  commit(operationId, '织带厂加工投入实收', input.issueId, actor, input, (draft) => {
    const issue = draft.processingIssues.find((item) => item.id === input.issueId)
    if(issue?.printHandover||issue?.dyeHandover)throw new Error('印染回料须按原交出记录实收，不能重复登记本地收货。')
    if (!issue || issue.targetFactoryId !== TMF_FACTORY_ID || input.factoryId !== issue.targetFactoryId
      || input.materialSkuId !== issue.materialSkuId) throw new Error('不是本厂的已发物料或扫码 SKU 不符。')
    if (add(issue.receivedMeters, input.receivedMeters) > issue.dispatchedMeters) throw new Error('实收超过上游实际发出量。')
    issue.receivedMeters = add(issue.receivedMeters, input.receivedMeters)
    return { quantity: input.receivedMeters }
  })
}

function tmfInputReceivedMeters(issue:TmfProcessingMaterialIssue):number {
  const handover=issue.printHandover??issue.dyeHandover
  if(!handover)return issue.receivedMeters
  const record=readCurrentPreparationHandoverRecord(handover.recordId)
  if(!record||record.handoverRecordStatus==='VOIDED')throw new Error(`${issue.printHandover?'印花':'染色'}原交出记录不存在或已作废，请核对加工投入来源。`)
  const received=(record.taskReceipts??[]).filter(r=>r.targetTaskOrderId===issue.id).reduce((n,r)=>add(n,r.qty),0)
  if(received>issue.dispatchedMeters)throw new Error('原单实收超过本需求分配量，请主管核对。')
  return received
}

async function readTmfPrintHandover(orderId:string,recordId:string,demand:TmfProductionDemand,existingInput=false) {
  const printing=await import('../fcs/printing-task-domain.ts')
  const {assertTmfPrintCutContinuation}=await import('../fcs/tmf-process-continuation.ts')
  const {getProductionOrderTechPackSnapshot}=await import('../fcs/production-order-tech-pack-runtime.ts')
  const order=printing.getPrintWorkOrderById(orderId),pack=getProductionOrderTechPackSnapshot(demand.productionOrderId)
  if(!order||order.sourceSnapshot?.productionOrderId!==demand.productionOrderId||order.sourceSnapshot.techPackVersionId!==demand.techPackVersionId)throw new Error('印花来源或生产采用版本不符。')
  if(!existingInput){
    if(!pack||demand.techPackVersionId!==pack.sourceTechPackVersionId)throw new Error('生产采用版本已变化，请先处置旧需求。')
    assertTmfPrintCutContinuation(order,demand.routeEntryId,pack)
  }
  readCurrentPreparationHandoverRecord(recordId)
  if(order.productionTmfContinuation?.factoryId!==TMF_FACTORY_ID||order.productionTmfContinuation.cutEntryId!==demand.routeEntryId)throw new Error('印花尚未按路线交给本厂。')
  const head=printing.getPrintOrderHandoverHead(orderId)
  const record=printing.getPrintOrderHandoverRecords(orderId).find(r=>(r.handoverRecordId||r.recordId)===recordId)
  const view=printing.getPrintingWorkOrderById(orderId)
  if(!head||head.receiverKind!=='FACTORY'||head.receiverId!==TMF_FACTORY_ID||!record||record.handoverRecordStatus==='VOIDED'||!record.factorySubmittedAt)throw new Error('没有属于本厂的有效印花实际交出。')
  const unit=record.qtyUnit||head.qtyUnit
  if(!['米','m'].includes(unit)||record.skuCode!==(order.outputMaterialSku||'')||!view?.barcodes.some(b=>b.handoverRecordId===recordId))throw new Error('交出数量单位、SKU或产出条码来源不符。')
  const submitted=meters(record.submittedQty??0)
  const received=record.receiverWrittenQty??record.warehouseWrittenQty??0
  const linked=(record.taskReceipts??[]).reduce((n,r)=>add(n,r.qty),0)
  if(Math.abs(received-linked)>0.000001)throw new Error('原交出已有未分到需求的整批实收，请核对后再接续，不能重复入账。')
  return {printing,order,head,record,unit,submitted}
}

/** 分配原交出数量至需求；不扣第二次仓库料，也不把分配认作实收。 */
export async function allocateTmfPrintHandover(input:{orderId:string;recordId:string;lines:Array<{issueId:string;demandId:string;sourceIssueId:string;meters:number}>},actor:TmfPurchaseActor,operationId:string):Promise<void> {
 allowed(actor,['生产计划','织带厂主管'])
 if(!input.lines.length||new Set(input.lines.map(l=>l.issueId)).size!==input.lines.length)throw new Error('请填写不重复的投入明细。')
 const data=getTmfPurchaseState(),demand=data.demands.find(d=>d.id===input.lines[0].demandId)
 if(!demand)throw new Error('生产需求不存在。')
 const source=await readTmfPrintHandover(input.orderId,input.recordId,demand)
 commit(operationId,'印花交出按需求分配投入',input.recordId,actor,input,(draft,at)=>{
  const latest=readCurrentPreparationHandoverRecord(input.recordId)
  if(!latest||latest.handoverRecordStatus==='VOIDED'||latest.submittedQty!==source.submitted)throw new Error('印花交出记录已变化，请重新核对后分配。')
  const existing=draft.processingIssues.filter(i=>i.printHandover?.recordId===input.recordId)
  const requested=input.lines.reduce((n,l)=>add(n,meters(l.meters)),0)
  if(existing.reduce((n,i)=>add(n,i.dispatchedMeters),0)+requested>source.submitted+0.000001)throw new Error('分配合计超过印花实际交出量。')
  for(const line of input.lines){
   const d=draft.demands.find(d=>d.id===line.demandId),origin=draft.processingIssues.find(i=>i.id===line.sourceIssueId)
   if(!d||d.productionOrderId!==demand.productionOrderId||d.techPackSnapshotId!==demand.techPackSnapshotId||d.routeEntryId!==demand.routeEntryId||d.bomItemId!==demand.bomItemId)throw new Error('分配需求必须属于同一生产单、采用版本、BOM和截断节点。')
   assertTmfDemandActive(draft,d.id)
   const originDemand=draft.demands.find(d=>d.id===origin?.demandId)
   if(!origin?.upstream||!originDemand||originDemand.productionOrderId!==d.productionOrderId||originDemand.bomItemId!==d.bomItemId||originDemand.techPackSnapshotId!==d.techPackSnapshotId||origin.targetRouteEntryId!==d.sourceRouteEntryId||!draft.lots.some(l=>l.id===origin.lotId))throw new Error('须追溯同需求来源的首次印染发料和辅料仓批次。')
   if(!line.issueId.trim()||draft.processingIssues.some(i=>i.id===line.issueId))throw new Error('投入明细编号重复或为空。')
   if(draft.processingIssues.filter(i=>i.printHandover?.sourceIssueId===origin.id).reduce((n,i)=>add(n,i.dispatchedMeters),0)+line.meters>origin.dispatchedMeters+0.000001)throw new Error('接续分配超过原始发料来源量，请核对实际批次。')
   draft.processingIssues.push({id:line.issueId,reservationId:'',demandId:d.id,lotId:origin.lotId,materialSkuId:d.materialSkuId,targetRouteEntryId:d.routeEntryId,targetFactoryId:TMF_FACTORY_ID,dispatchedMeters:line.meters,receivedMeters:0,dispatchedAt:source.record.factorySubmittedAt||at,printHandover:{orderId:input.orderId,recordId:input.recordId,sourceIssueId:origin.id}})
  }
  return {quantity:requested}
 })
}

export async function receiveTmfPrintMaterial(input:{issueId:string;materialSkuId:string;receivedMeters:number},actor:TmfPurchaseActor,operationId:string):Promise<void> {
 allowed(actor,['织带厂员工','织带厂主管']);meters(input.receivedMeters)
 const data=getTmfPurchaseState(),issue=data.processingIssues.find(i=>i.id===input.issueId),demand=data.demands.find(d=>d.id===issue?.demandId)
 if(!issue?.printHandover||!demand||issue.materialSkuId!==input.materialSkuId)throw new Error('请选择本厂印花回料投入并核对SKU。')
 const source=await readTmfPrintHandover(issue.printHandover.orderId,issue.printHandover.recordId,demand,true)
 const repeated=source.record.taskReceipts?.find(r=>r.receiptId===operationId)
 if(repeated){if(repeated.targetTaskOrderId!==issue.id||repeated.qty!==input.receivedMeters)throw new Error('确认号已用于其他接收内容。');return}
 if(add(tmfInputReceivedMeters(issue),input.receivedMeters)>issue.dispatchedMeters)throw new Error('实收超过分给本需求的印花交出量。')
   source.printing.receivePrintingContinuationForTask(source.order.printOrderId,source.record.handoverRecordId||source.record.recordId,{receiptId:operationId,targetTaskOrderId:issue.id,qty:input.receivedMeters,qtyUnit:source.unit,receiverName:actor.name,receivedAt:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date())})
}

const jakartaNow = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date())

/** 染色直接交付织带厂时，只读取原染色交出记录作为唯一数量事实。 */
async function readTmfDyeHandover(orderId:string,recordId:string,demand:TmfProductionDemand,existingInput=false) {
  const dyeing=await import('../fcs/dyeing-task-domain.ts')
  const {assertTmfDyeCutContinuation}=await import('../fcs/tmf-process-continuation.ts')
  const {getProductionOrderTechPackSnapshot}=await import('../fcs/production-order-tech-pack-runtime.ts')
  const order=dyeing.getDyeWorkOrderById(orderId),pack=getProductionOrderTechPackSnapshot(demand.productionOrderId)
  if(!order||order.sourceSnapshot?.productionOrderId!==demand.productionOrderId||order.sourceSnapshot.techPackVersionId!==demand.techPackVersionId)throw new Error('染色来源或生产采用版本不符。')
  if(!existingInput){
    if(!pack||demand.techPackVersionId!==pack.sourceTechPackVersionId)throw new Error('生产采用版本已变化，请先处置旧需求。')
    assertTmfDyeCutContinuation(order,demand.routeEntryId,pack)
  }
  readCurrentPreparationHandoverRecord(recordId)
  if(order.productionTmfContinuation?.factoryId!==TMF_FACTORY_ID||order.productionTmfContinuation.cutEntryId!==demand.routeEntryId)throw new Error('染色尚未按路线交给本厂。')
  const head=dyeing.getDyeOrderHandoverHead(orderId)
  const record=dyeing.getDyeOrderHandoverRecords(orderId).find(r=>(r.handoverRecordId||r.recordId)===recordId)
  if(!head||head.receiverKind!=='FACTORY'||head.receiverId!==TMF_FACTORY_ID||!record||record.handoverRecordStatus==='VOIDED'||!record.factorySubmittedAt)throw new Error('没有属于本厂的有效染色实际交出。')
  const unit=record.qtyUnit||head.qtyUnit
  const outputSku=order.outputMaterial?.sku||''
  if(!['米','m'].includes(unit)||!outputSku||record.skuCode!==outputSku)throw new Error('交出数量单位或SKU与染色产出不符。')
  const submitted=meters(record.submittedQty??0)
  const received=record.receiverWrittenQty??record.warehouseWrittenQty??0
  const linked=(record.taskReceipts??[]).reduce((n,r)=>add(n,r.qty),0)
  if(Math.abs(received-linked)>0.000001)throw new Error('原交出已有未分到需求的整批实收，请核对后再接续，不能重复入账。')
  return {dyeing,order,head,record,unit,submitted}
}

/** 分配原染色交出数量至需求；不扣第二次仓库料，也不把分配认作实收。 */
export async function allocateTmfDyeHandover(input:{orderId:string;recordId:string;lines:Array<{issueId:string;demandId:string;sourceIssueId:string;meters:number}>},actor:TmfPurchaseActor,operationId:string):Promise<void> {
 allowed(actor,['生产计划','织带厂主管'])
 if(!input.lines.length||new Set(input.lines.map(l=>l.issueId)).size!==input.lines.length)throw new Error('请填写不重复的投入明细。')
 const data=getTmfPurchaseState(),demand=data.demands.find(d=>d.id===input.lines[0].demandId)
 if(!demand)throw new Error('生产需求不存在。')
 const source=await readTmfDyeHandover(input.orderId,input.recordId,demand)
 commit(operationId,'染色交出按需求分配投入',input.recordId,actor,input,(draft,at)=>{
  const latest=readCurrentPreparationHandoverRecord(input.recordId)
  if(!latest||latest.handoverRecordStatus==='VOIDED'||latest.submittedQty!==source.submitted)throw new Error('染色交出记录已变化，请重新核对后分配。')
  const existing=draft.processingIssues.filter(i=>i.dyeHandover?.recordId===input.recordId)
  const requested=input.lines.reduce((n,l)=>add(n,meters(l.meters)),0)
  if(existing.reduce((n,i)=>add(n,i.dispatchedMeters),0)+requested>source.submitted+0.000001)throw new Error('分配合计超过染色实际交出量。')
  for(const line of input.lines){
   const d=draft.demands.find(d=>d.id===line.demandId),origin=draft.processingIssues.find(i=>i.id===line.sourceIssueId)
   if(!d||d.productionOrderId!==demand.productionOrderId||d.techPackSnapshotId!==demand.techPackSnapshotId||d.routeEntryId!==demand.routeEntryId||d.bomItemId!==demand.bomItemId)throw new Error('分配需求必须属于同一生产单、采用版本、BOM和截断节点。')
   assertTmfDemandActive(draft,d.id)
   const originDemand=draft.demands.find(d=>d.id===origin?.demandId)
   if(!origin?.upstream||!originDemand||originDemand.productionOrderId!==d.productionOrderId||originDemand.bomItemId!==d.bomItemId||originDemand.techPackSnapshotId!==d.techPackSnapshotId||origin.targetRouteEntryId!==d.sourceRouteEntryId||!draft.lots.some(l=>l.id===origin.lotId))throw new Error('须追溯同需求来源的首次印染发料和辅料仓批次。')
   if(!line.issueId.trim()||draft.processingIssues.some(i=>i.id===line.issueId))throw new Error('投入明细编号重复或为空。')
   if(draft.processingIssues.filter(i=>i.dyeHandover?.sourceIssueId===origin.id).reduce((n,i)=>add(n,i.dispatchedMeters),0)+line.meters>origin.dispatchedMeters+0.000001)throw new Error('接续分配超过原始发料来源量，请核对实际批次。')
   draft.processingIssues.push({id:line.issueId,reservationId:'',demandId:d.id,lotId:origin.lotId,materialSkuId:d.materialSkuId,targetRouteEntryId:d.routeEntryId,targetFactoryId:TMF_FACTORY_ID,dispatchedMeters:line.meters,receivedMeters:0,dispatchedAt:source.record.factorySubmittedAt||at,dyeHandover:{orderId:input.orderId,recordId:input.recordId,sourceIssueId:origin.id}})
  }
  return {quantity:requested}
 })
}

export async function receiveTmfDyeMaterial(input:{issueId:string;materialSkuId:string;receivedMeters:number},actor:TmfPurchaseActor,operationId:string):Promise<void>{
 allowed(actor,['织带厂员工','织带厂主管']);meters(input.receivedMeters)
 const data=getTmfPurchaseState(),issue=data.processingIssues.find(i=>i.id===input.issueId),demand=data.demands.find(d=>d.id===issue?.demandId)
 if(!issue?.dyeHandover||!demand||issue.materialSkuId!==input.materialSkuId)throw new Error('请选择本厂染色回料投入并核对SKU。')
 const source=await readTmfDyeHandover(issue.dyeHandover.orderId,issue.dyeHandover.recordId,demand,true)
 const repeated=source.record.taskReceipts?.find(r=>r.receiptId===operationId)
 if(repeated){if(repeated.targetTaskOrderId!==issue.id||repeated.qty!==input.receivedMeters)throw new Error('确认号已用于其他接收内容。');return}
 if(add(tmfInputReceivedMeters(issue),input.receivedMeters)>issue.dispatchedMeters)throw new Error('实收超过分给本需求的染色交出量。')
 source.dyeing.receiveDyeContinuationForTask(source.order.dyeOrderId,source.record.handoverRecordId||source.record.recordId,{receiptId:operationId,targetTaskOrderId:issue.id,qty:input.receivedMeters,qtyUnit:source.unit,receiverName:actor.name,receivedAt:jakartaNow()})
}

type TmfCutOutputInput = { outputId: string; issueId: string; cutPieces: number; defectivePieces: number; actualCutLengthMm: number; actualFinishedLengthMm: number | null; lossMeters: number; reason: string }
export function reportTmfCutOutput(input: TmfCutOutputInput, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId, '截断产出填报', input.issueId, actor, input, (draft, at) => applyTmfCutOutput(draft, input, at))
}
function applyTmfCutOutput(draft: TmfPurchaseState, input: TmfCutOutputInput, at: string) {
  for (const value of [input.cutPieces, input.actualCutLengthMm]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('截断条数和毫米长度必须为正整数。')
  }
  if (!Number.isSafeInteger(input.defectivePieces) || input.defectivePieces < 0 || input.defectivePieces > input.cutPieces) throw new Error('不良条数必须在本次截断条数以内。')
  meters(input.lossMeters, true)
    const issue = draft.processingIssues.find((item) => item.id === input.issueId)
    if (!issue || issue.targetFactoryId !== TMF_FACTORY_ID) throw new Error('没有本厂的加工投入来源。')
    const demand = draft.demands.find((item) => item.id === issue.demandId)!
    assertTmfDemandActive(draft, demand.id)
    if (issue.targetRouteEntryId !== demand.routeEntryId || issue.materialSkuId !== demand.materialSkuId) throw new Error('当前投入尚未完成前序工艺，不能截断。')
    if (!input.outputId.trim() || draft.cutOutputs.some((item) => item.id === input.outputId)) throw new Error('产出编号无效或已存在，请查看原产出记录。')
    const spec = demand.specification
    if (!spec.tippingRequired && (!Number.isSafeInteger(input.actualFinishedLengthMm) || (input.actualFinishedLengthMm ?? 0) <= 0)) throw new Error('无需打头的产出须记录实际成品长度。')
    if (spec.tippingRequired && input.actualFinishedLengthMm !== null) throw new Error('尚未打头，不能把预计含头长度登记为实际成品长度。')
    const cutEquivalentMeters = input.cutPieces * input.actualCutLengthMm / 1000
    if (!Number.isSafeInteger(input.cutPieces * input.actualCutLengthMm)) throw new Error('截断数量超出可计算范围。')
    const alreadyConsumed = draft.cutOutputs.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.cutEquivalentMeters + item.lossMeters), 0)
    const alreadyReturned = draft.continuousReturns.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.dispatchedMeters), 0)
    if (add(alreadyConsumed + alreadyReturned, cutEquivalentMeters + input.lossMeters) > tmfInputReceivedMeters(issue)) throw new Error('截断用料和损耗超过本批实际接收量扣除已退料后的余额，未到或已退物料不能加工。')
    const outsideTolerance = Math.abs(input.actualCutLengthMm - spec.cutLengthMm) > spec.toleranceMm
      || (!spec.tippingRequired && Math.abs(input.actualFinishedLengthMm! - spec.finishedLengthMm) > spec.toleranceMm)
    const defectivePieces = outsideTolerance ? input.cutPieces : input.defectivePieces
    const alreadyCut = draft.cutOutputs.filter((item) => item.demandId === demand.id).reduce((sum, item) => sum + item.cutPieces, 0)
    if ((defectivePieces > 0 || input.lossMeters > 0 || alreadyCut + input.cutPieces > demand.requiredPieces) && !input.reason.trim()) throw new Error('不良、损耗或超需求加工必须填写原因。')
    const acceptable = input.cutPieces - defectivePieces
    const sourceLot = draft.lots.find((lot) => lot.id === issue.lotId)!
    const sourcePurchase = draft.orders.find((order) => order.purchaseOrderNo === sourceLot.sourcePurchaseOrderNo)!
    const unit: '根' | '条' = sourcePurchase.accessoryType === '绳子' ? '根' : '条'
    draft.cutOutputs.push({ id: input.outputId, demandId: demand.id, sourceIssueId: issue.id, materialSkuId: issue.materialSkuId,
      specification: structuredClone(spec), actualCutLengthMm: input.actualCutLengthMm, actualFinishedLengthMm: input.actualFinishedLengthMm,
      cutPieces: input.cutPieces, unit, goodPieces: spec.tippingRequired ? 0 : acceptable,
      pendingTipPieces: spec.tippingRequired ? acceptable : 0, defectivePieces, cutEquivalentMeters, lossMeters: input.lossMeters,
      reportedAt: at, reason: input.reason })
    return { quantity: input.cutPieces, unit, reason: input.reason }
}

export function getTmfProcessingInputBalance(issueId: string): { receivedMeters: number; cutEquivalentMeters: number; lossMeters: number; returnedMeters: number; returnReceivedMeters: number; returnTransitMeters: number; remainingMeters: number } {
  const saved = current()
  const issue = saved.processingIssues.find((item) => item.id === issueId)
  if (!issue) throw new Error('加工投入不存在。')
  const outputs = saved.cutOutputs.filter((item) => item.sourceIssueId === issueId)
  const cutEquivalentMeters = outputs.reduce((sum, item) => add(sum, item.cutEquivalentMeters), 0)
  const lossMeters = outputs.reduce((sum, item) => add(sum, item.lossMeters), 0)
  const returns = saved.continuousReturns.filter((item) => item.sourceIssueId === issueId)
  const returnedMeters = returns.reduce((sum, item) => add(sum, item.dispatchedMeters), 0)
  const returnReceivedMeters = returns.reduce((sum, item) => add(sum, item.receivedMeters), 0)
  const scrappedMeters = saved.continuousScraps.filter((item) => item.issueId === issueId).reduce((sum, item) => add(sum, item.meters), 0)
  const receivedMeters=tmfInputReceivedMeters(issue)
  return { receivedMeters, cutEquivalentMeters, lossMeters, returnedMeters, returnReceivedMeters,
    returnTransitMeters: add(returnedMeters, -returnReceivedMeters),
    remainingMeters: add(receivedMeters, -cutEquivalentMeters - lossMeters - returnedMeters - scrappedMeters) }
}

export function dispatchTmfContinuousReturn(
  input: { returnId: string; issueId: string; batchId: string; returnedMeters: number; reason: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  meters(input.returnedMeters)
  if (!input.reason.trim()) throw new Error('请填写退料原因并确认是未截断连续料。')
  commit(operationId, '连续余料交回仓库', input.issueId, actor, input, (draft, at) => {
    const issue = draft.processingIssues.find((item) => item.id === input.issueId)
    if (!issue || issue.targetFactoryId !== TMF_FACTORY_ID) throw new Error('请选择本厂已接收的米料投入，条料产出不能退为连续料。')
    if (!input.returnId.trim() || !input.batchId.trim()
      || draft.continuousReturns.some((item) => item.id === input.returnId || item.batchId === input.batchId)
      || draft.lots.some((item) => item.id === input.batchId)
      || draft.handovers.some((item) => item.batchId === input.batchId || item.id === input.returnId)) throw new Error('退料单或回仓批次编号无效或已使用。')
    const consumed = draft.cutOutputs.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.cutEquivalentMeters + item.lossMeters), 0)
    const returned = draft.continuousReturns.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.dispatchedMeters), 0)
    if (add(consumed + returned, input.returnedMeters) > tmfInputReceivedMeters(issue)) throw new Error('退料超过工厂剩余连续料，已截断条料和损耗不能加回米料。')
    const sourceLot = draft.lots.find((item) => item.id === issue.lotId)!
    draft.continuousReturns.push({ id: input.returnId, sourceIssueId: issue.id, materialSkuId: issue.materialSkuId,
      batchId: input.batchId, warehouseId: sourceLot.warehouseId, dispatchedMeters: input.returnedMeters,
      receivedMeters: 0, dispatchedAt: at, reason: input.reason })
    return { quantity: input.returnedMeters, reason: input.reason }
  })
}

export function receiveTmfContinuousReturn(
  input: { returnId: string; warehouseId: string; materialSkuId: string; location: string; receivedMeters: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  meters(input.receivedMeters)
  commit(operationId, '连续余料回仓实收', input.returnId, actor, input, (draft) => {
    const returned = draft.continuousReturns.find((item) => item.id === input.returnId)
    if (!returned || returned.warehouseId !== input.warehouseId || returned.materialSkuId !== input.materialSkuId) throw new Error('退料来源、目标仓或物料 SKU 不符。')
    if (!input.location.trim()) throw new Error('请填写实际回仓库位。')
    if (add(returned.receivedMeters, input.receivedMeters) > returned.dispatchedMeters) throw new Error('本次实收超过工厂尚未收回的退料量。')
    const issue = draft.processingIssues.find((item) => item.id === returned.sourceIssueId)!
    const sourceLot = draft.lots.find((item) => item.id === issue.lotId)!
    let lot = draft.lots.find((item) => item.id === returned.batchId)
    if (lot && (lot.sourceHandoverId !== returned.id || lot.location !== input.location)) throw new Error('回仓批次或库位不符，请核对原收货记录。')
    if (!lot) {
      lot = { id: returned.batchId, materialSkuId: returned.materialSkuId, sourcePurchaseOrderNo: sourceLot.sourcePurchaseOrderNo,
        sourcePurchaseLineId: sourceLot.sourcePurchaseLineId, sourceHandoverId: returned.id, warehouseId: returned.warehouseId,
        location: input.location, receivedMeters: 0, onHandMeters: 0, reservedMeters: 0, frozenMeters: 0, receiptKind: 'PROCESS_RETURN' }
      draft.lots.push(lot)
    }
    returned.receivedMeters = add(returned.receivedMeters, input.receivedMeters)
    lot.receivedMeters = add(lot.receivedMeters, input.receivedMeters)
    lot.onHandMeters = add(lot.onHandMeters, input.receivedMeters)
    return { quantity: input.receivedMeters, reason: returned.reason }
  })
}

function validateTipQuantity(value: number, unit: TmfTipMaterialIssue['unit'], allowZero = false): void {
  if (!['个', 'kg', 'g'].includes(unit) || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)
    || (unit === '个' ? !Number.isSafeInteger(value) : Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001)) {
    throw new Error('端头数量须为整数，重量最多三位小数；数量和单位必须有效。')
  }
}

/** 记录仓库实际实收；每个来源收货明细只入账一次，发料不能自动造库存。 */
export function receiveTmfTipMaterialStock(
  input: Omit<TmfTipMaterialLot, 'onHandQty' | 'receivedAt'>, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  validateTipQuantity(input.receivedQty, input.unit)
  if (![input.id, input.materialSkuId, input.warehouseId, input.location, input.sourceReceiptNo, input.sourceReceiptLineId].every(value => value?.trim())) throw new Error('请填写辅材实收批次、SKU、仓库库位及来源收货单明细。')
  commit(operationId, '端头辅材仓库实收', input.id, actor, input, (draft, at) => {
    if (draft.tipMaterialLots.some(lot => lot.id === input.id || (lot.sourceReceiptNo === input.sourceReceiptNo && lot.sourceReceiptLineId === input.sourceReceiptLineId))) throw new Error('该辅材批次或来源实收明细已入账，不能重复增加库存。')
    draft.tipMaterialLots.push({ ...input, onHandQty: input.receivedQty, receivedAt: at })
    return { quantity: input.receivedQty, unit: input.unit }
  })
}

export function dispatchTmfTipMaterial(
  input: Omit<TmfTipMaterialIssue, 'receivedQty' | 'usedQty' | 'scrapQty'> & { stockLotId: string }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  validateTipQuantity(input.dispatchedQty, input.unit)
  commit(operationId, '端头辅材交出', input.demandId, actor, input, (draft) => {
    const demand = draft.demands.find((item) => item.id === input.demandId)
    if (!demand || !demand.specification.tippingRequired) throw new Error('没有需要打头的需求。')
    assertTmfDemandActive(draft, demand.id)
    if (![input.id, input.materialBomItemId, input.materialSkuId, input.sourceDocumentNo].every((value) => value.trim())
      || draft.tipMaterialIssues.some((item) => item.id === input.id)) throw new Error('请填写唯一交出编号、来源单据、辅材 BOM 及 SKU。')
    const lot = draft.tipMaterialLots.find(item => item.id === input.stockLotId)
    if (!lot || lot.materialSkuId !== input.materialSkuId || lot.unit !== input.unit) throw new Error('辅材来源实收批次不存在，或SKU/单位不一致。')
    if (input.dispatchedQty > lot.onHandQty) throw new Error(`辅材来源批次库存不足，可发 ${lot.onHandQty} ${lot.unit}。`)
    lot.onHandQty = add(lot.onHandQty, -input.dispatchedQty)
    draft.tipMaterialIssues.push({ ...input, receivedQty: 0, usedQty: 0, scrapQty: 0 })
    return { quantity: input.dispatchedQty, unit: input.unit }
  })
}

export function receiveTmfTipMaterial(issueId: string, receivedQty: number, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId, '端头辅材实收', issueId, actor, { receivedQty }, (draft) => {
    const issue = draft.tipMaterialIssues.find((item) => item.id === issueId)
    if (!issue) throw new Error('辅材尚无交出记录。')
    validateTipQuantity(receivedQty, issue.unit)
    if (add(issue.receivedQty, receivedQty) > issue.dispatchedQty) throw new Error('辅材实收不能超过上游已发数量。')
    issue.receivedQty = add(issue.receivedQty, receivedQty)
    return { quantity: receivedQty, unit: issue.unit }
  })
}

function tipMaterialBalance(data: TmfPurchaseState, issueId: string) {
  const issue = data.tipMaterialIssues.find(item => item.id === issueId)
  if (!issue) throw new Error('辅材发出来源不存在。')
  const returns = data.tipMaterialReturns.filter(item => item.sourceIssueId === issueId)
  const returnedQty = returns.reduce((sum, item) => add(sum, item.dispatchedQty), 0)
  const returnReceivedQty = returns.reduce((sum, item) => add(sum, item.receivedQty), 0)
  return { returnedQty, returnReceivedQty, returnTransitQty: add(returnedQty, -returnReceivedQty),
    availableQty: add(issue.receivedQty, -issue.usedQty - issue.scrapQty - returnedQty) }
}

export function getTmfTipMaterialBalance(issueId: string) { return tipMaterialBalance(current(), issueId) }

export function dispatchTmfTipMaterialReturn(
  input: { id: string; sourceIssueId: string; quantity: number; reason: string }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId, '未用辅材交回仓库', input.sourceIssueId, actor, input, (draft, at) => {
    const issue = draft.tipMaterialIssues.find(item => item.id === input.sourceIssueId)
    const lot = draft.tipMaterialLots.find(item => item.id === issue?.stockLotId)
    if (!issue || !lot) throw new Error('辅材来源实收批次缺失，请由主管核实来源后处理；不能补造库存。')
    validateTipQuantity(input.quantity, issue.unit)
    if (!input.id.trim() || !input.reason.trim() || draft.tipMaterialReturns.some(item => item.id === input.id)) throw new Error('请填写唯一辅材退料单号和退料原因。')
    if (input.quantity > tipMaterialBalance(draft, issue.id).availableQty) throw new Error('退回数量超过本厂未使用辅材余额；已用、损坏或已交回部分不能重复退。')
    draft.tipMaterialReturns.push({ id: input.id, sourceIssueId: issue.id, stockLotId: lot.id, dispatchedQty: input.quantity, receivedQty: 0, dispatchedAt: at, reason: input.reason })
    return { quantity: input.quantity, unit: issue.unit, reason: input.reason }
  })
}

export function receiveTmfTipMaterialReturn(
  input: { returnId: string; warehouseId: string; materialSkuId: string; unit: TmfTipMaterialIssue['unit']; quantity: number }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  commit(operationId, '未用辅材回仓实收', input.returnId, actor, input, (draft) => {
    const returned = draft.tipMaterialReturns.find(item => item.id === input.returnId)
    const lot = draft.tipMaterialLots.find(item => item.id === returned?.stockLotId)
    if (!returned || !lot || lot.warehouseId !== input.warehouseId || lot.materialSkuId !== input.materialSkuId || lot.unit !== input.unit) throw new Error('辅材退料来源、目标仓、SKU或单位不符。')
    validateTipQuantity(input.quantity, lot.unit)
    if (add(returned.receivedQty, input.quantity) > returned.dispatchedQty) throw new Error('辅材实收超过尚未收回的退料数量。')
    returned.receivedQty = add(returned.receivedQty, input.quantity)
    lot.onHandQty = add(lot.onHandQty, input.quantity)
    return { quantity: input.quantity, unit: lot.unit }
  })
}

export function reportTmfTipping(
  input: Omit<TmfTipResult, 'reportedAt' | 'goodPieces'>, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0 || !Number.isSafeInteger(input.defectivePieces)
    || input.defectivePieces < 0 || input.defectivePieces > input.pieces
    || !Number.isSafeInteger(input.actualFinishedLengthMm) || input.actualFinishedLengthMm <= 0) throw new Error('打头条数、不良条数和实际成品长度无效。')
  commit(operationId, '打头产出填报', input.cutOutputId, actor, input, (draft, at) => {
    const output = draft.cutOutputs.find((item) => item.id === input.cutOutputId)
    if (!output || !output.specification.tippingRequired || input.pieces > output.pendingTipPieces) throw new Error('打头数量超过可用的待打头条料，已完成或不良条料不能重复加工。')
    assertTmfDemandActive(draft, output.demandId)
    if (!input.id.trim() || draft.tipResults.some((item) => item.id === input.id)) throw new Error('打头产出编号无效或已存在。')
    const actualSpec = { ...output.specification, endA: input.endA, endB: input.endB }
    const errors = validateWebbingSpecifications([actualSpec])
    if (errors.length) throw new Error(errors.map((item) => item.message).join('；'))
    const requiredMaterials = new Map<string, { unit: '个' | 'kg' | 'g'; ends: number }>()
    for (const end of [input.endA, input.endB]) {
      if (end.method === 'NONE') continue
      const material = requiredMaterials.get(end.materialBomItemId!)
      if (material && material.unit !== end.materialUnit) throw new Error('同一辅材不能同时采用不同计量单位。')
      requiredMaterials.set(end.materialBomItemId!, { unit: end.materialUnit!, ends: (material?.ends ?? 0) + 1 })
    }
    const usedByMaterial = new Map<string, number>()
    const seen = new Set<string>()
    for (const material of input.materials) {
      const issue = draft.tipMaterialIssues.find((item) => item.id === material.issueId)
      if (!issue || issue.demandId !== output.demandId || seen.has(issue.id)) throw new Error('辅材不属于当前需求，或耗用行重复。')
      seen.add(issue.id)
      const expected = requiredMaterials.get(issue.materialBomItemId)
      if (!expected || expected.unit !== issue.unit) throw new Error('实际端头与所用辅材或单位不符。')
      validateTipQuantity(material.usedQty, issue.unit)
      validateTipQuantity(material.scrapQty, issue.unit, true)
      if (add(material.usedQty, material.scrapQty) > tipMaterialBalance(draft, issue.id).availableQty) throw new Error('辅材耗用及报废超过本厂实收余额。')
      issue.usedQty = add(issue.usedQty, material.usedQty)
      issue.scrapQty = add(issue.scrapQty, material.scrapQty)
      usedByMaterial.set(issue.materialBomItemId, add(usedByMaterial.get(issue.materialBomItemId) ?? 0, material.usedQty))
    }
    for (const [id, expected] of requiredMaterials) {
      const used = usedByMaterial.get(id) ?? 0
      if (expected.unit === '个' ? used !== input.pieces * expected.ends : used <= 0) throw new Error('独立端头耗用应等于实际加工条数乘端数；浸头须填写实际重量。')
    }
    const endKey = (end: WebbingEndRequirement) => JSON.stringify([end.method, end.specification, end.materialBomItemId, end.materialUnit, end.coverageMm])
    const mismatch = endKey(input.endA) !== endKey(output.specification.endA) || endKey(input.endB) !== endKey(output.specification.endB)
      || Math.abs(input.actualFinishedLengthMm - output.specification.finishedLengthMm) > output.specification.toleranceMm
    const defectivePieces = mismatch ? input.pieces : input.defectivePieces
    if ((defectivePieces > 0 || input.materials.some((item) => item.scrapQty > 0)) && !input.reason.trim()) throw new Error('错头、长度不符、不良或辅材报废必须填写原因。')
    const goodPieces = input.pieces - defectivePieces
    output.pendingTipPieces -= input.pieces
    output.goodPieces += goodPieces
    output.defectivePieces += defectivePieces
    draft.tipResults.push({ ...structuredClone(input), goodPieces, defectivePieces, reportedAt: at })
    return { quantity: input.pieces, unit: output.unit, reason: input.reason }
  })
}

function defectiveBalance(draft: TmfPurchaseState, cutOutputId: string, tipResultId?: string) {
  const output = draft.cutOutputs.find(o => o.id === cutOutputId)
  if (!output) throw new Error('不良来源产出不存在，请核对原加工批次。')
  const tips = draft.tipResults.filter(t => t.cutOutputId === cutOutputId)
  const tip = tipResultId ? tips.find(t => t.id === tipResultId) : undefined
  if (tipResultId && !tip) throw new Error('打头批次不属于此截断产出。')
  const defectivePieces = tip ? tip.defectivePieces : output.defectivePieces - tips.reduce((n,t) => n+t.defectivePieces,0)
  const scrappedPieces = draft.defectiveScraps.filter(s => s.cutOutputId === cutOutputId && s.tipResultId === tipResultId).reduce((n,s) => n+s.pieces,0)
  return { defectivePieces, scrappedPieces, availablePieces: defectivePieces-scrappedPieces, actualCutLengthMm: output.actualCutLengthMm, unit: output.unit }
}

export function getTmfDefectiveBalance(cutOutputId: string, tipResultId?: string) {
  return defectiveBalance(current(), cutOutputId, tipResultId)
}

/** 报废是实物处置，不倒删不良记录，也不再扣一次米料/已装端头。 */
export function scrapTmfDefectiveOutput(input: { id: string; cutOutputId: string; tipResultId?: string; pieces: number; expectedAvailablePieces: number; reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂主管'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对不良实物及来源、填写报废原因并再次确认。')
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0 || input.tipResultId === '') throw new Error('请选择明确的不良批次及正整数报废条数。')
  commit(operationId, '不良产出实际报废', input.cutOutputId, actor, input, (draft, at) => {
    if (draft.defectiveScraps.some(s => s.id === input.id)) throw new Error('报废记录编号已使用，请查看原记录。')
    const balance = defectiveBalance(draft, input.cutOutputId, input.tipResultId)
    if (balance.availablePieces !== input.expectedAvailablePieces) throw new Error('待处置数量已变化，请重新核对；尚未报废。')
    if (input.pieces > balance.availablePieces) throw new Error('报废量超过此来源尚未处置的不良数，不能报废合格或已处置产出。')
    draft.defectiveScraps.push({ id: input.id, cutOutputId: input.cutOutputId, tipResultId: input.tipResultId, pieces: input.pieces,
      equivalentMeters: Math.round(input.pieces*balance.actualCutLengthMm)/1000, reason: input.reason.trim(), scrappedAt: at })
    return { quantity: input.pieces, unit: balance.unit, reason: input.reason.trim() }
  })
}

/* ===== 终止处置：取消后逐项决定并留痕，未处置不得结案 ===== */

export interface TmfTerminationItem {
  category: TmfTerminationCategory
  objectId: string
  tipResultId?: string
  label: string
  quantity: number
  unit: '米' | '条' | '根'
  actions: Array<'SCRAP' | 'RETAIN_FROZEN' | 'TRANSIT_WRITE_OFF'>
  /** 处置执行身份：TMF 织带厂主管 / WAREHOUSE 仓库主管 / PLAN 生产计划。 */
  custodian: 'TMF' | 'WAREHOUSE' | 'PLAN'
  detail: string
}

function tmfInputRemainingOn(draft: TmfPurchaseState, issue: TmfProcessingMaterialIssue): number {
  const used = draft.cutOutputs.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.cutEquivalentMeters + item.lossMeters), 0)
  const returned = draft.continuousReturns.filter((item) => item.sourceIssueId === issue.id).reduce((sum, item) => add(sum, item.dispatchedMeters), 0)
  const scrapped = draft.continuousScraps.filter((item) => item.issueId === issue.id).reduce((sum, item) => add(sum, item.meters), 0)
  return add(tmfInputReceivedMeters(issue), -used - returned - scrapped)
}

/** 厂内合格在制 = 截断数 − 已交出 − 全部不良（待处置不良单独结算） − 已报废。 */
function tmfFactoryPiecesOn(draft: TmfPurchaseState, output: TmfCutOutput): number {
  const packageIds = new Set(draft.packages.filter((item) => item.cutOutputId === output.id).map((item) => item.id))
  const handed = draft.outputHandovers.filter((item) => packageIds.has(item.packageId)).reduce((sum, item) => sum + item.dispatchedPieces, 0)
  const factory = draft.factoryScraps.filter((item) => item.cutOutputId === output.id).reduce((sum, item) => sum + item.pieces, 0)
  return output.cutPieces - handed - output.defectivePieces - factory
}

function tmfTerminationItems(draft: TmfPurchaseState, productionOrderId: string): TmfTerminationItem[] {
  const demands = draft.demands.filter((item) => item.productionOrderId === productionOrderId)
  const ids = new Set(demands.map((item) => item.id))
  const items: TmfTerminationItem[] = []
  const disposals = draft.terminationDisposals.filter((item) => item.productionOrderId === productionOrderId)
  const retainedPackages = new Set(disposals.filter((item) => item.action === 'RETAIN_FROZEN').map((item) => item.objectId))

  for (const issue of draft.processingIssues.filter((item) => ids.has(item.demandId) && item.targetFactoryId === TMF_FACTORY_ID)) {
    const remaining = tmfInputRemainingOn(draft, issue)
    const demand = demands.find((item) => item.id === issue.demandId)!
    if (remaining > 0.000001) items.push({ category: 'CONTINUOUS_REMAINING', objectId: issue.id, label: `厂内连续余料 · ${demand.garmentSize} ${demand.specification.cutLengthMm}mm`, quantity: remaining, unit: '米', actions: ['SCRAP'], custodian: 'TMF', detail: `投入 ${issue.id}；可退回原仓或主管确认报废` })
  }
  for (const output of draft.cutOutputs.filter((item) => ids.has(item.demandId))) {
    const demand = demands.find((item) => item.id === output.demandId)!
    const factory = tmfFactoryPiecesOn(draft, output)
    if (factory > 0) items.push({ category: 'FACTORY_CUT', objectId: output.id, label: `厂内在制条料 · ${demand.garmentSize} ${output.actualCutLengthMm}mm`, quantity: factory, unit: output.unit, actions: ['SCRAP'], custodian: 'TMF', detail: `产出 ${output.id}；可先装包交回或主管确认报废` })
    const tips = draft.tipResults.filter((item) => item.cutOutputId === output.id && item.defectivePieces > 0)
    const tipDefective = tips.reduce((sum, item) => sum + item.defectivePieces, 0)
    const cutDefective = output.defectivePieces - tipDefective
    const cutScrapped = draft.defectiveScraps.filter((item) => item.cutOutputId === output.id && !item.tipResultId).reduce((sum, item) => sum + item.pieces, 0)
    if (cutDefective - cutScrapped > 0) items.push({ category: 'DEFECTIVE', objectId: output.id, label: `截断待处置不良 · ${demand.garmentSize} ${output.actualCutLengthMm}mm`, quantity: cutDefective - cutScrapped, unit: output.unit, actions: ['SCRAP'], custodian: 'TMF', detail: '按原不良批次报废留痕' })
    for (const tip of tips) {
      const scrapped = draft.defectiveScraps.filter((item) => item.cutOutputId === output.id && item.tipResultId === tip.id).reduce((sum, item) => sum + item.pieces, 0)
      if (tip.defectivePieces - scrapped > 0) items.push({ category: 'DEFECTIVE', objectId: output.id, tipResultId: tip.id, label: `打头待处置不良 · ${demand.garmentSize} ${tip.actualFinishedLengthMm}mm`, quantity: tip.defectivePieces - scrapped, unit: output.unit, actions: ['SCRAP'], custodian: 'TMF', detail: `打头批次 ${tip.id}` })
    }
  }
  for (const pkg of draft.packages.filter((item) => !item.splitAt && ids.has(item.demandId) && (item.surplusFreeze || item.versionFreeze))) {
    const onHand = Math.max(0, outputPackageBalance(draft, pkg.id).onHandPieces)
    if (onHand > 0 && !retainedPackages.has(pkg.id)) items.push({ category: 'FROZEN_PACKAGE', objectId: pkg.id, label: `冻结产出 · 包 ${pkg.id}`, quantity: onHand, unit: pkg.unit, actions: ['SCRAP', 'RETAIN_FROZEN'], custodian: pkg.warehouseId ? 'WAREHOUSE' : 'TMF', detail: pkg.surplusFreeze ? `余量冻结：${pkg.surplusFreeze.reason}` : `换版冻结：${pkg.versionFreeze?.reason ?? ''}` })
  }
  for (const issue of draft.processingIssues.filter((item) => ids.has(item.demandId) && item.upstream && !item.transitWriteOff)) {
    const unreceived = add(issue.dispatchedMeters, -tmfInputReceivedMeters(issue))
    if (unreceived > 0.000001) items.push({ category: 'UPSTREAM_TRANSIT', objectId: issue.id, label: `上游未收在途 · ${issue.upstream!.processCode === 'DYE' ? '染色' : '印花'} ${issue.upstream!.orderNo}`, quantity: unreceived, unit: '米', actions: ['TRANSIT_WRITE_OFF'], custodian: 'WAREHOUSE', detail: `上游发出 ${issue.dispatchedMeters} 米；本厂已收 ${tmfInputReceivedMeters(issue)} 米` })
  }
  for (const issue of draft.productionIssues.filter((item) => ids.has(item.demandId) && !item.transitWriteOff)) {
    const transit = issue.dispatchedPieces - issue.receivedPieces
    if (transit > 0) {
      const unit = draft.packages.find((item) => item.id === issue.packageId)?.unit ?? '条'
      items.push({ category: 'PRODUCTION_TRANSIT', objectId: issue.id, label: `生产领料在途 · 包 ${issue.packageId}`, quantity: transit, unit, actions: ['TRANSIT_WRITE_OFF'], custodian: 'PLAN', detail: `发料 ${issue.dispatchedPieces}；领料方实收 ${issue.receivedPieces}；请先由领料方确认实收或主管确认差异去向` })
    }
  }
  return items
}

export function getTmfTerminationReview(productionOrderId: string) {
  const draft = current()
  const demands = draft.demands.filter((item) => item.productionOrderId === productionOrderId)
  if (!demands.length) throw new Error('生产单没有织带加工需求。')
  const control = effectiveTmfProductionControl(draft, productionOrderId)
  const items = tmfTerminationItems(draft, productionOrderId)
  return structuredClone({ productionOrderId, controlStatus: control?.status ?? 'ACTIVE', closure: draft.terminationClosures.find((item) => item.productionOrderId === productionOrderId) ?? null,
    items, outstandingCount: items.length, shortagePieces: tmfShortageOn(draft, demands, new Set(demands.map((item) => item.id))),
    disposals: draft.terminationDisposals.filter((item) => item.productionOrderId === productionOrderId) })
}

function tmfShortageOn(draft: TmfPurchaseState, demands: TmfProductionDemand[], ids: Set<string>): number {
  const required = demands.reduce((sum, demand) => sum + demand.requiredPieces, 0)
  const received = draft.productionIssues.filter((item) => ids.has(item.demandId)).reduce((sum, item) => sum + item.receivedPieces, 0)
  return Math.max(0, required - received)
}

function assertTmfTerminationOpen(draft: TmfPurchaseState, productionOrderId: string): void {
  const control = effectiveTmfProductionControl(draft, productionOrderId)
  if (control?.status !== 'CANCELLED') throw new Error('只有已取消的生产单可以做终止处置。')
  if (draft.terminationClosures.some((item) => item.productionOrderId === productionOrderId)) throw new Error('该生产单终止已结案，不能再处置实物。')
}

export function scrapTmfContinuousRemaining(
  input: { id: string; issueId: string; meters: number; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管'])
  meters(input.meters)
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对厂内剩余连续料、填写报废原因并再次确认。')
  commit(operationId, '终止处置：连续余料报废', input.issueId, actor, input, (draft, at) => {
    const issue = draft.processingIssues.find((item) => item.id === input.issueId)
    if (!issue || issue.targetFactoryId !== TMF_FACTORY_ID) throw new Error('请选择本厂已接收的连续料投入。')
    const demand = draft.demands.find((item) => item.id === issue.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    if (draft.continuousScraps.some((item) => item.id === input.id)) throw new Error('处置编号已使用，请查看原记录。')
    const remaining = tmfInputRemainingOn(draft, issue)
    if (input.meters > remaining + 0.000001) throw new Error(`本次报废超过厂内剩余 ${remaining} 米。`)
    draft.continuousScraps.push({ id: input.id, issueId: issue.id, meters: input.meters, reason: input.reason.trim(), scrappedAt: at, actor: structuredClone(actor) })
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'CONTINUOUS_REMAINING', action: 'SCRAP', objectId: issue.id, quantity: input.meters, unit: '米', reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: input.meters }
  })
}

export function scrapTmfFactoryCutPieces(
  input: { id: string; cutOutputId: string; pieces: number; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对厂内实物、填写报废原因并再次确认。')
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('报废条数必须是正整数。')
  commit(operationId, '终止处置：在制条料报废', input.cutOutputId, actor, input, (draft, at) => {
    const output = draft.cutOutputs.find((item) => item.id === input.cutOutputId)
    if (!output) throw new Error('加工产出不存在。')
    const demand = draft.demands.find((item) => item.id === output.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    if (draft.factoryScraps.some((item) => item.id === input.id)) throw new Error('处置编号已使用，请查看原记录。')
    const available = tmfFactoryPiecesOn(draft, output)
    if (input.pieces > available) throw new Error(`本次报废超过厂内在制 ${available} ${output.unit}。`)
    draft.factoryScraps.push({ id: input.id, cutOutputId: output.id, pieces: input.pieces, equivalentMeters: Math.round(input.pieces * output.actualCutLengthMm) / 1000, reason: input.reason.trim(), scrappedAt: at, actor: structuredClone(actor) })
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'FACTORY_CUT', action: 'SCRAP', objectId: output.id, quantity: input.pieces, unit: output.unit, reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: input.pieces, unit: output.unit }
  })
}

export function scrapTmfFrozenPackage(
  input: { id: string; packageId: string; pieces: number; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管', '仓库主管'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对冻结实物、填写报废原因并再次确认。')
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('报废数量必须是正整数。')
  commit(operationId, '终止处置：冻结产出报废', input.packageId, actor, input, (draft, at) => {
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    if (!pkg || pkg.splitAt || (!pkg.surplusFreeze && !pkg.versionFreeze)) throw new Error('请选择已冻结的有效包。')
    if ((pkg.warehouseId ? '仓库主管' : '织带厂主管') !== actor.role) throw new Error('请由当前保管方主管执行冻结产出报废。')
    const demand = draft.demands.find((item) => item.id === pkg.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    if (draft.terminationDisposals.some((item) => item.id === `${input.id}:D`)) throw new Error('处置编号已使用，请查看原记录。')
    const onHand = outputPackageBalance(draft, pkg.id).onHandPieces
    if (input.pieces > onHand) throw new Error(`报废量超过包内实存 ${onHand} ${pkg.unit}。`)
    pkg.disposedPieces = (pkg.disposedPieces ?? 0) + input.pieces
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'FROZEN_PACKAGE', action: 'SCRAP', objectId: pkg.id, quantity: input.pieces, unit: pkg.unit, reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: input.pieces, unit: pkg.unit }
  })
}

export function retainTmfFrozenPackage(
  input: { id: string; packageId: string; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管', '仓库主管'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对冻结实物、填写保留原因并再次确认。')
  commit(operationId, '终止处置：冻结产出受控保留', input.packageId, actor, input, (draft, at) => {
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    if (!pkg || pkg.splitAt || (!pkg.surplusFreeze && !pkg.versionFreeze)) throw new Error('请选择已冻结的有效包。')
    if ((pkg.warehouseId ? '仓库主管' : '织带厂主管') !== actor.role) throw new Error('请由当前保管方主管确认保留。')
    const demand = draft.demands.find((item) => item.id === pkg.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    if (draft.terminationDisposals.some((item) => item.id === `${input.id}:D`)) throw new Error('处置编号已使用，请查看原记录。')
    const onHand = outputPackageBalance(draft, pkg.id).onHandPieces
    if (onHand <= 0) throw new Error('此包已无仓内实物，不能登记保留。')
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'FROZEN_PACKAGE', action: 'RETAIN_FROZEN', objectId: pkg.id, quantity: onHand, unit: pkg.unit, reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: onHand, unit: pkg.unit, reason: input.reason.trim() }
  })
}

export function writeOffTmfUpstreamTransit(
  input: { id: string; issueId: string; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓库主管'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对上游交出与实收差异、填写去向原因并再次确认。')
  commit(operationId, '终止处置：上游未收在途去向确认', input.issueId, actor, input, (draft, at) => {
    const issue = draft.processingIssues.find((item) => item.id === input.issueId)
    if (!issue?.upstream) throw new Error('请选择印染上游的在途投入。')
    if (issue.transitWriteOff) throw new Error('该在途已确认去向，不能重复登记。')
    const demand = draft.demands.find((item) => item.id === issue.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    const unreceived = add(issue.dispatchedMeters, -tmfInputReceivedMeters(issue))
    if (unreceived <= 0.000001) throw new Error('该投入已收齐，没有待处置在途。')
    issue.transitWriteOff = { meters: unreceived, reason: input.reason.trim(), confirmedAt: at, actor: structuredClone(actor) }
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'UPSTREAM_TRANSIT', action: 'TRANSIT_WRITE_OFF', objectId: issue.id, quantity: unreceived, unit: '米', reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: unreceived }
  })
}

export function writeOffTmfProductionTransit(
  input: { id: string; issueId: string; reason: string; confirmed: boolean },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对发料与领料实收差异、填写去向原因并再次确认。')
  commit(operationId, '终止处置：生产领料在途去向确认', input.issueId, actor, input, (draft, at) => {
    const issue = draft.productionIssues.find((item) => item.id === input.issueId)
    if (!issue) throw new Error('生产发料记录不存在。')
    if (issue.transitWriteOff) throw new Error('该在途已确认去向，不能重复登记。')
    const demand = draft.demands.find((item) => item.id === issue.demandId)!
    assertTmfTerminationOpen(draft, demand.productionOrderId)
    const transit = issue.dispatchedPieces - issue.receivedPieces
    if (transit <= 0) throw new Error('该发料已收齐，没有待处置在途。')
    const unit = draft.packages.find((item) => item.id === issue.packageId)?.unit ?? '条'
    issue.transitWriteOff = { pieces: transit, reason: input.reason.trim(), confirmedAt: at, actor: structuredClone(actor) }
    draft.terminationDisposals.push({ id: `${input.id}:D`, productionOrderId: demand.productionOrderId, category: 'PRODUCTION_TRANSIT', action: 'TRANSIT_WRITE_OFF', objectId: issue.id, quantity: transit, unit, reason: input.reason.trim(), actor: structuredClone(actor), occurredAt: at })
    return { quantity: transit }
  })
}

export function closeTmfTermination(
  input: { id: string; productionOrderId: string; reason: string; confirmed: boolean; expectedReview: string; makeupOrderNo?: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划'])
  if (!input.confirmed || !input.reason.trim() || !input.id.trim()) throw new Error('请核对全部处置记录、填写结案原因并再次确认。')
  commit(operationId, '终止结案', input.productionOrderId, actor, input, (draft, at) => {
    assertTmfTerminationOpen(draft, input.productionOrderId)
    const demands = draft.demands.filter((item) => item.productionOrderId === input.productionOrderId)
    const control = effectiveTmfProductionControl(draft, input.productionOrderId)
    const items = tmfTerminationItems(draft, input.productionOrderId)
    const review = { productionOrderId: input.productionOrderId, controlStatus: control?.status ?? 'ACTIVE',
      closure: draft.terminationClosures.find((item) => item.productionOrderId === input.productionOrderId) ?? null, items, outstandingCount: items.length, shortagePieces: tmfShortageOn(draft, demands, new Set(demands.map((item) => item.id))),
      disposals: draft.terminationDisposals.filter((item) => item.productionOrderId === input.productionOrderId) }
    if (JSON.stringify(review) !== input.expectedReview) throw new Error('处置或实物数量已变化，请重新打开核对；尚未结案。')
    if (items.length) throw new Error(`仍有 ${items.length} 项实物或在途未处置：${items.map((item) => `${item.label} ${item.quantity} ${item.unit}`).join('；')}`)
    const makeupOrderNo = input.makeupOrderNo?.trim() ?? ''
    if (review.shortagePieces > 0 && !makeupOrderNo && !/终止不足|不足终止|不补做/.test(input.reason)) throw new Error(`生产需求仍有缺口 ${review.shortagePieces} 条/根：请填写关联补做单号，或在结案原因中明确“终止不足”；结案不改变需求满足状态。`)
    draft.terminationClosures.push({ id: input.id, productionOrderId: input.productionOrderId, reason: input.reason.trim(),
      decisionSummary: `处置决定 ${review.disposals.length} 项；需求 ${demands.length} 条；缺口 ${review.shortagePieces} 条/根${makeupOrderNo ? `；补做 ${makeupOrderNo}` : '（终止不足）'}`,
      makeupOrderNo: makeupOrderNo || undefined, actor: structuredClone(actor), occurredAt: at })
    return { reason: input.reason.trim() }
  })
}

export function packTmfOutput(
  input: { packageId: string; cutOutputId: string; tipResultId?: string; pieces: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('包装条数必须是正整数。')
  if (input.tipResultId !== undefined && !input.tipResultId.trim()) throw new Error('打头批次编号不能为空。')
  commit(operationId, '合格产出装包', input.cutOutputId, actor, input, (draft, at) => {
    const output = draft.cutOutputs.find((item) => item.id === input.cutOutputId)
    if (!output) throw new Error('加工产出不存在。')
    assertTmfDemandActive(draft, output.demandId)
    if (!input.packageId.trim() || draft.packages.some((item) => item.id === input.packageId)) throw new Error('包号无效或已使用。')
    const tip = input.tipResultId ? draft.tipResults.find((item) => item.id === input.tipResultId) : undefined
    if (output.specification.tippingRequired && (!tip || tip.cutOutputId !== output.id)) throw new Error('需要打头的产出必须选择已完成的具体打头批次。')
    if (!output.specification.tippingRequired && input.tipResultId) throw new Error('无需打头的产出不能引用其他打头批次。')
    const available = tip ? tip.goodPieces : output.goodPieces
    const packed = draft.packages.filter((item) => !item.splitAt && item.cutOutputId === output.id && item.tipResultId === input.tipResultId).reduce((sum, item) => sum + item.pieces, 0)
    if (packed + input.pieces > available) throw new Error('包装数量超过此实际规格的未装包合格数。')
    const finishedLength = tip?.actualFinishedLengthMm ?? output.actualFinishedLengthMm
    if (finishedLength === null) throw new Error('尚无实际成品长度，不能装包。')
    draft.packages.push({ id: input.packageId, demandId: output.demandId, cutOutputId: output.id,
      tipResultId: input.tipResultId, materialSkuId: output.materialSkuId, pieces: input.pieces, unit: output.unit,
      actualCutLengthMm: output.actualCutLengthMm, actualFinishedLengthMm: finishedLength,
      endA: structuredClone(tip?.endA ?? output.specification.endA), endB: structuredClone(tip?.endB ?? output.specification.endB), createdAt: at })
    return { quantity: input.pieces, unit: output.unit }
  })
}

export function splitTmfOutputPackage(
  packageId: string, children: Array<{ id: string; pieces: number }>, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂主管', '仓库主管'])
  commit(operationId, '产出拆包', packageId, actor, children, (draft, at) => {
    const parent = draft.packages.find((item) => item.id === packageId)
    if (!parent || parent.splitAt) throw new Error('包不存在或已经拆分，请使用有效子包。')
    if (parent.surplusFreeze) throw new Error('此包余量已冻结，不能拆包；请保留原包等待处置。')
    assertTmfDemandActive(draft, parent.demandId)
    if (draft.outputAllocations.some((item) => item.packageId === parent.id && item.allocatedPieces > item.releasedPieces)
      || draft.productionIssues.some((item) => item.packageId === parent.id)) throw new Error('此包已分配或发料；未发部分先释放分配，已发包不能复制拆分。')
    const handedOver = draft.outputHandovers.some((item) => item.packageId === parent.id)
    if (handedOver && parent.receivedPieces !== parent.pieces) throw new Error('在途或部分实收包不能拆分，请先完成实物交接。')
    if (parent.warehouseId ? actor.role !== '仓库主管' : actor.role !== '织带厂主管') throw new Error('请由当前保管方主管拆包。')
    if (children.length < 2 || children.some((item) => !item.id.trim() || !Number.isSafeInteger(item.pieces) || item.pieces <= 0)
      || new Set(children.map((item) => item.id)).size !== children.length
      || children.some((item) => draft.packages.some((existing) => existing.id === item.id))
      || children.reduce((sum, item) => sum + item.pieces, 0) !== parent.pieces) throw new Error('子包编号须唯一，子包数量之和必须等于原包。')
    parent.splitAt = at
    draft.packages.push(...children.map((child) => ({ ...structuredClone(parent), id: child.id, pieces: child.pieces, receivedPieces: parent.warehouseId ? child.pieces : undefined, parentPackageId: parent.id, splitAt: undefined, createdAt: at })))
    return { quantity: parent.pieces, unit: parent.unit }
  })
}

export function dispatchTmfOutputPackage(
  input: { handoverId: string; packageId: string; warehouseId: string }, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId, '加工产出交回辅料仓', input.packageId, actor, input, (draft, at) => {
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    if (!pkg || pkg.splitAt) throw new Error('包不存在或已拆分，请扫描有效包号。')
    if (pkg.warehouseId || draft.outputHandovers.some((item) => item.packageId === pkg.id)) throw new Error('此包已经交出或回仓，不能重复交出。')
    const output = draft.cutOutputs.find((item) => item.id === pkg.cutOutputId)!
    const issue = draft.processingIssues.find((item) => item.id === output.sourceIssueId)!
    const lot = draft.lots.find((item) => item.id === issue.lotId)!
    if (input.warehouseId !== lot.warehouseId) throw new Error('目标仓与来源辅料仓不符。')
    if (!input.handoverId.trim() || draft.outputHandovers.some((item) => item.id === input.handoverId)) throw new Error('交出单号无效或已使用。')
    draft.outputHandovers.push({ id: input.handoverId, packageId: pkg.id, warehouseId: input.warehouseId,
      dispatchedPieces: pkg.pieces, receivedPieces: 0, dispatchedAt: at })
    return { quantity: pkg.pieces, unit: pkg.unit }
  })
}

export function receiveTmfOutputPackage(
  input: { handoverId: string; packageId: string; warehouseId: string; demandId: string; location: string; receivedPieces: number; expectedReceivedPieces?: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  if (!Number.isSafeInteger(input.receivedPieces) || input.receivedPieces <= 0) throw new Error('实收条数必须是正整数。')
  commit(operationId, '加工产出回仓实收', input.packageId, actor, input, (draft) => {
    const handover = draft.outputHandovers.find((item) => item.id === input.handoverId)
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    if (!handover || !pkg || pkg.splitAt || handover.packageId !== pkg.id
      || handover.warehouseId !== input.warehouseId || pkg.demandId !== input.demandId) throw new Error('交出单、包号、生产需求或接收仓不符。')
    if (input.expectedReceivedPieces !== undefined && input.expectedReceivedPieces !== handover.receivedPieces) throw new Error('此包实收数量已变化，请重新扫描核对后收货。')
    if (!input.location.trim() || (pkg.location && pkg.location !== input.location)) throw new Error('请核对实际库位；移库不能通过补收修改。')
    if (handover.receivedPieces + input.receivedPieces > handover.dispatchedPieces) throw new Error('实收超过此包尚未收回数量。')
    handover.receivedPieces += input.receivedPieces
    // 交出记录是产出包实收的唯一数量事实源。跨 Web/PDA 页面各自持有的旧内存快照
    // 可能仍停留在上一次分批实收数量，不能再从该快照累加，否则会出现交出单已收齐、
    // 包记录仍少收的分裂事实。每次确认后直接投影交出单累计实收。
    pkg.receivedPieces = handover.receivedPieces
    pkg.warehouseId = input.warehouseId
    pkg.location = input.location
    return { quantity: input.receivedPieces, unit: pkg.unit }
  })
}

function outputPackageBalance(draft: TmfPurchaseState, packageId: string) {
  const pkg = draft.packages.find((item) => item.id === packageId)
  if (!pkg || pkg.splitAt) throw new Error('包不存在或已拆分，请扫描有效包号。')
  const issues = draft.productionIssues.filter((item) => item.packageId === packageId)
  const issuedPieces = issues.reduce((sum, item) => sum + item.dispatchedPieces, 0)
  const productionReceivedPieces = issues.reduce((sum, item) => sum + item.receivedPieces, 0)
  const allocatedPieces = draft.outputAllocations.filter((item) => item.packageId === packageId)
    .reduce((sum, item) => sum + item.allocatedPieces - item.releasedPieces, 0)
  const receivedPieces = pkg.receivedPieces ?? 0
  const disposedPieces = pkg.disposedPieces ?? 0
  const blocked = tmfDemandControl(draft, pkg.demandId)?.status
  return { receivedPieces, onHandPieces: receivedPieces - issuedPieces - disposedPieces, reservedPieces: allocatedPieces - issuedPieces,
    availablePieces: pkg.surplusFreeze || pkg.versionFreeze || (blocked && blocked !== 'ACTIVE') ? 0 : receivedPieces - allocatedPieces - disposedPieces, issuedPieces, productionReceivedPieces,
    productionTransitPieces: issuedPieces - productionReceivedPieces }
}

/** 超需求余量独立保管；冻结不改变实际库存、SKU或需求满足量。 */
export function freezeTmfSurplusPackage(input: { packageId: string; expectedPieces: number; reason: string; confirmed: boolean }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['仓库主管'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('请填写余量冻结原因并再次确认实物。')
  commit(operationId, '超需求产出余量冻结', input.packageId, actor, input, (draft, at) => {
    const pkg = draft.packages.find(p => p.id === input.packageId)
    if (!pkg || pkg.splitAt || pkg.surplusFreeze || !pkg.warehouseId || !pkg.location || pkg.receivedPieces !== pkg.pieces) throw new Error('请选择已收齐且尚未冻结的有效余量包。')
    const balance = outputPackageBalance(draft, pkg.id)
    if (balance.onHandPieces !== input.expectedPieces) throw new Error('包内实存已变化，请重新扫描核对后冻结。')
    if (balance.onHandPieces <= 0 || balance.reservedPieces || balance.issuedPieces) throw new Error('此包有分配或发料记录，请先把未分配余量单独装包。')
    const demand = draft.demands.find(d => d.id === pkg.demandId)!
    const committed = draft.outputAllocations.filter(a => a.demandId === demand.id).reduce((n,a) => n+a.allocatedPieces-a.releasedPieces,0)
    if (committed < demand.requiredPieces) throw new Error('本规格需求尚未足额分配，请先核对正常需求，不能将需求内条料作为余量冻结。')
    pkg.surplusFreeze = { pieces: balance.onHandPieces, reason: input.reason.trim(), frozenAt: at, actor: structuredClone(actor) }
    return { quantity: balance.onHandPieces, unit: pkg.unit, reason: input.reason.trim() }
  })
}

/** 同仓移库只改变尚在仓内实物的位置；已发料记录保留发出时库位。 */
export function moveTmfOutputPackage(
  input: { packageId: string; warehouseId: string; fromLocation: string; toLocation: string; reason: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  commit(operationId, '加工产出同仓移库', input.packageId, actor, input, (draft) => {
    const pkg = draft.packages.find(item => item.id === input.packageId)
    if (!pkg || pkg.splitAt || !pkg.warehouseId || pkg.warehouseId !== input.warehouseId
      || !pkg.location || pkg.location !== input.fromLocation) throw new Error('包号、仓库或原库位已变化，请重新核对实物。')
    if (pkg.receivedPieces !== pkg.pieces) throw new Error('部分实收包须先完成交接，再办理移库。')
    const balance = outputPackageBalance(draft, pkg.id)
    if (balance.onHandPieces <= 0) throw new Error('此包已无仓内实物，不能移库。')
    if (!input.toLocation.trim() || input.toLocation.trim() === pkg.location || !input.reason.trim()) throw new Error('请填写不同的目标库位及移库原因。')
    pkg.location = input.toLocation.trim()
    return { quantity: balance.onHandPieces, unit: pkg.unit, reason: `${input.fromLocation} → ${pkg.location}；${input.reason.trim()}` }
  })
}

export function getTmfOutputPackageBalance(packageId: string) {
  return outputPackageBalance(current(), packageId)
}

export function getTmfProductionDemandFulfillment(demandId: string) {
  const draft = current()
  const demand = draft.demands.find((item) => item.id === demandId)
  if (!demand) throw new Error('生产需求不存在。')
  const issues = draft.productionIssues.filter((item) => item.demandId === demandId)
  const dispatchedPieces = issues.reduce((sum, item) => sum + item.dispatchedPieces, 0)
  const receivedPieces = issues.reduce((sum, item) => sum + item.receivedPieces, 0)
  const control = tmfDemandControl(draft, demandId)
  return { requiredPieces: demand.requiredPieces, dispatchedPieces, receivedPieces,
    transitPieces: dispatchedPieces - receivedPieces, shortagePieces: demand.requiredPieces - receivedPieces,
    status: control?.status === 'CANCELLED' ? '已取消' : demand.supersededBySnapshotId ? '已换版保留' : getTmfDemandVersionChange(demand) ? '变更待处理' : control?.status === 'ON_HOLD' ? '已暂停'
      : receivedPieces === demand.requiredPieces ? '已满足' : receivedPieces > 0 ? '部分满足' : '待供给' }
}

export function allocateTmfOutputPackage(
  input: { allocationId: string; packageId: string; demandId: string; pieces: number; receiverId: string; receiverOrganizationId: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划', '仓库主管'])
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('分配条数必须是正整数。')
  commit(operationId, '按生产需求分配产出', input.packageId, actor, input, (draft, at) => {
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    const demand = draft.demands.find((item) => item.id === input.demandId)
    if (!pkg || pkg.splitAt || !demand || pkg.demandId !== demand.id) throw new Error('包号不属于此生产需求，不能混用长度、用途或抢用其他生产单产出。')
    assertTmfDemandActive(draft, demand.id)
    if (!pkg.warehouseId || !pkg.location) throw new Error('此包尚未回仓实收上架。')
    if (![input.allocationId, input.receiverId, input.receiverOrganizationId].every((value) => value.trim())
      || draft.outputAllocations.some((item) => item.id === input.allocationId)) throw new Error('请填写唯一分配编号及生产接收组织、人员。')
    const balance = outputPackageBalance(draft, pkg.id)
    if (input.pieces > balance.availablePieces) throw new Error(`超过仓内未占用产出，可分配 ${balance.availablePieces} ${pkg.unit}。`)
    const committed = draft.outputAllocations.filter((item) => item.demandId === demand.id)
      .reduce((sum, item) => sum + item.allocatedPieces - item.releasedPieces, 0)
    if (committed + input.pieces > demand.requiredPieces) throw new Error('分配合计超过当前需求，超量产出须单独处置。')
    draft.outputAllocations.push({ id: input.allocationId, packageId: pkg.id, demandId: demand.id,
      allocatedPieces: input.pieces, releasedPieces: 0, receiverId: input.receiverId,
      receiverOrganizationId: input.receiverOrganizationId, createdAt: at })
    return { quantity: input.pieces, unit: pkg.unit }
  })
}

export function releaseTmfOutputAllocation(
  allocationId: string, pieces: number, reason: string, actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划', '仓库主管'])
  if (!Number.isSafeInteger(pieces) || pieces <= 0 || !reason.trim()) throw new Error('请填写正整数释放数量及原因。')
  commit(operationId, '释放未发产出分配', allocationId, actor, { pieces, reason }, (draft) => {
    const allocation = draft.outputAllocations.find((item) => item.id === allocationId)
    if (!allocation) throw new Error('分配记录不存在。')
    const issued = draft.productionIssues.filter((item) => item.allocationId === allocationId).reduce((sum, item) => sum + item.dispatchedPieces, 0)
    if (pieces > allocation.allocatedPieces - allocation.releasedPieces - issued) throw new Error('只能释放尚未发出的分配量。')
    allocation.releasedPieces += pieces
    const pkg = draft.packages.find((item) => item.id === allocation.packageId)!
    return { quantity: pieces, unit: pkg.unit, reason }
  })
}

export function issueTmfProductionPackage(
  input: { issueId: string; allocationId: string; packageId: string; demandId: string; warehouseId: string; pieces: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['仓管', '仓库主管'])
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('发料条数必须是正整数。')
  commit(operationId, '产出按生产单发料', input.packageId, actor, input, (draft, at) => {
    const allocation = draft.outputAllocations.find((item) => item.id === input.allocationId)
    const pkg = draft.packages.find((item) => item.id === input.packageId)
    if (!allocation || !pkg || pkg.splitAt || allocation.packageId !== pkg.id || allocation.demandId !== input.demandId
      || pkg.warehouseId !== input.warehouseId || !pkg.location) throw new Error('所扫包号、需求、分配或发料仓不符。')
    if (pkg.surplusFreeze) throw new Error('此包余量已冻结，不能发料。')
    assertTmfDemandActive(draft, allocation.demandId)
    if (!input.issueId.trim() || draft.productionIssues.some((item) => item.id === input.issueId)) throw new Error('发料编号无效或已使用。')
    const issued = draft.productionIssues.filter((item) => item.allocationId === allocation.id).reduce((sum, item) => sum + item.dispatchedPieces, 0)
    if (input.pieces > allocation.allocatedPieces - allocation.releasedPieces - issued
      || input.pieces > outputPackageBalance(draft, pkg.id).onHandPieces) throw new Error('发料超过剩余分配量或仓内实存。')
    draft.productionIssues.push({ id: input.issueId, allocationId: allocation.id, packageId: pkg.id, demandId: allocation.demandId,
      warehouseId: input.warehouseId, location: pkg.location, receiverId: allocation.receiverId,
      receiverOrganizationId: allocation.receiverOrganizationId, dispatchedPieces: input.pieces, receivedPieces: 0, dispatchedAt: at })
    return { quantity: input.pieces, unit: pkg.unit }
  })
}

export function receiveTmfProductionPackage(
  input: { issueId: string; packageId: string; demandId: string; receiverOrganizationId: string; pieces: number },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产领料人'])
  if (!Number.isSafeInteger(input.pieces) || input.pieces <= 0) throw new Error('生产实收条数必须是正整数。')
  commit(operationId, '生产领料方确认实收', input.packageId, actor, input, (draft) => {
    const issue = draft.productionIssues.find((item) => item.id === input.issueId)
    if (!issue || issue.packageId !== input.packageId || issue.demandId !== input.demandId
      || issue.receiverOrganizationId !== input.receiverOrganizationId || issue.receiverId !== actor.id) throw new Error('发料单、包号、生产需求或实际接收人不符。')
    if (issue.receivedPieces + input.pieces > issue.dispatchedPieces) throw new Error('本次实收超过此发料单的未收数量。')
    issue.receivedPieces += input.pieces
    const pkg = draft.packages.find((item) => item.id === issue.packageId)!
    return { quantity: input.pieces, unit: pkg.unit }
  })
}

function effectiveTmfProductionControl(draft: TmfPurchaseState, productionOrderId: string): TmfProductionControl | undefined {
  const local = draft.productionControls.find(item => item.productionOrderId === productionOrderId)
  const source = readProductionOrderRuntimeFact(productionOrderId)
  if (local?.status === 'CANCELLED') return local
  const status = source?.status
  if (status === 'CANCELLED' || status === 'ON_HOLD' || status === 'COMPLETED' || status === 'DRAFT' || status === 'WAIT_TECH_PACK_RELEASE') {
    const label = status === 'CANCELLED' ? '已取消' : status === 'ON_HOLD' ? '已暂停' : status === 'COMPLETED' ? '已完成' : '尚未具备执行条件'
    return { productionOrderId, pendingCancellationDisposition: status === 'CANCELLED', status: status === 'CANCELLED' ? 'CANCELLED' : 'ON_HOLD', reason: `主生产单${label}；须先处理主单状态和已有实物。`, changedAt: '' }
  }
  return local
}

/** 旧需求保留自己的规格；采用版本变化只限制继续执行，不改写已交出实物。 */
export function getTmfDemandVersionChange(demand: TmfProductionDemand): TmfProductionControl | undefined {
  if (demand.supersededBySnapshotId) return { productionOrderId: demand.productionOrderId, status: 'ON_HOLD', changedAt: '', reason: '旧需求已换版保留，仅供追溯；请按当前版本需求执行。' }
  const source = readProductionOrderRuntimeFact(demand.productionOrderId)
  if (!source || (!source.selectedTechPackVersionId && source.techPackSnapshot === undefined)) return undefined
  const pack = source.techPackSnapshot
  if (pack?.snapshotId === demand.techPackSnapshotId && pack.sourceTechPackVersionId === demand.techPackVersionId
    && (!source.selectedTechPackVersionId || source.selectedTechPackVersionId === demand.techPackVersionId)) return undefined
  return { productionOrderId: demand.productionOrderId, status: 'ON_HOLD', changedAt: '',
    reason: `技术包采用版本已变化（原 ${demand.techPackVersionId}，当前 ${source.selectedTechPackVersionId || pack?.sourceTechPackVersionId || '未采用'}）。旧规格须由计划核对处置，不能继续加工或发料。` }
}

function tmfDemandControl(draft: TmfPurchaseState, demandId: string): TmfProductionControl | undefined {
  const demand = draft.demands.find((item) => item.id === demandId)
  if (!demand) return undefined
  const control = effectiveTmfProductionControl(draft, demand.productionOrderId)
  return control && control.status !== 'ACTIVE' ? control : getTmfDemandVersionChange(demand) ?? control
}

function assertTmfDemandActive(draft: TmfPurchaseState, demandId: string): void {
  const control = tmfDemandControl(draft, demandId)
  if (control && control.status !== 'ACTIVE') throw new Error(`生产单${control.status === 'CANCELLED' ? '已取消' : '已暂停'}：${control.reason}；请处理原有实物，不能继续加工或发料。`)
}

export function changeTmfProductionControl(
  input: { productionOrderId: string; status: TmfProductionControl['status']; reason: string; confirmed: boolean; expectedDispositionSignature?: string },
  actor: TmfPurchaseActor, operationId: string,
): void {
  allowed(actor, ['生产计划'])
  if (!input.confirmed || !input.reason.trim()) throw new Error('请确认受影响的投入、产出及交接数量，并填写处理原因。')
  if (!['ACTIVE', 'ON_HOLD', 'CANCELLED'].includes(input.status)) throw new Error('请选择有效的生产处理状态。')
  commit(operationId, '生产单暂停恢复或取消', input.productionOrderId, actor, input, (draft, at) => {
    if (input.expectedDispositionSignature && input.expectedDispositionSignature !== JSON.stringify(getTmfProductionDisposition(input.productionOrderId))) throw new Error('生产状态或处置数量已变化，请关闭后重新核对，尚未保存。')
    const demands = draft.demands.filter((item) => item.productionOrderId === input.productionOrderId)
    if (!demands.length) throw new Error('没有此生产单的织带加工需求。')
    let control = draft.productionControls.find((item) => item.productionOrderId === input.productionOrderId)
    if (control?.status === 'CANCELLED') throw new Error('已取消需求不能恢复；原物料与产出处置记录必须保留。')
    const sourceStatus = readProductionOrderRuntimeFact(input.productionOrderId)?.status
    if (input.status === 'ACTIVE' && ['ON_HOLD','CANCELLED','COMPLETED','DRAFT','WAIT_TECH_PACK_RELEASE'].includes(sourceStatus || '')) throw new Error('主生产单仍受限，请先在主单处理后再恢复织带执行。')
    const oldStatus = control?.status ?? 'ACTIVE'
    if (oldStatus === input.status) throw new Error('当前已经是所选状态，请勿重复处理。')
    if (input.status === 'ACTIVE' && oldStatus !== 'ON_HOLD') throw new Error('只有暂停中的生产单可以恢复。')
    if (!control) {
      control = { productionOrderId: input.productionOrderId, status: input.status, reason: input.reason, changedAt: at }
      draft.productionControls.push(control)
    } else Object.assign(control, { status: input.status, reason: input.reason, changedAt: at })
    let releasedMeters = 0
    let releasedPieces = 0
    if (input.status === 'CANCELLED') {
      const ids = new Set(demands.map((item) => item.id))
      for (const reservation of draft.reservations.filter((item) => ids.has(item.demandId))) {
        const lot = draft.lots.find((item) => item.id === reservation.lotId)!
        releasedMeters = add(releasedMeters, reservation.reservedMeters)
        lot.reservedMeters = add(lot.reservedMeters, -reservation.reservedMeters)
        reservation.reservedMeters = 0
      }
      for (const allocation of draft.outputAllocations.filter((item) => ids.has(item.demandId))) {
        const issued = draft.productionIssues.filter((item) => item.allocationId === allocation.id).reduce((sum, item) => sum + item.dispatchedPieces, 0)
        const released = allocation.allocatedPieces - allocation.releasedPieces - issued
        allocation.releasedPieces += released
        releasedPieces += released
      }
    }
    const statusLabels = { ACTIVE: '可执行', ON_HOLD: '已暂停', CANCELLED: '已取消' }
    return { reason: `${input.reason}；${statusLabels[oldStatus]}→${statusLabels[input.status]}；释放未发米料 ${releasedMeters} 米、未发产出 ${releasedPieces} 条/根；已执行实物保留。` }
  })
}

/** 暂停/取消只改变可执行性，不改写已切长度、已耗用或实物位置。 */
export function getTmfProductionDisposition(productionOrderId: string) {
  const draft = current()
  const demands = draft.demands.filter((item) => item.productionOrderId === productionOrderId)
  if (!demands.length) throw new Error('生产单没有织带加工需求。')
  const ids = new Set(demands.map((item) => item.id))
  const outputs = draft.cutOutputs.filter((item) => ids.has(item.demandId))
  const scraps = draft.defectiveScraps.filter(s => outputs.some(o => o.id === s.cutOutputId))
  const scrappedPieces = scraps.reduce((n,s) => n+s.pieces,0)
  const factoryScraps = draft.factoryScraps.filter(s => outputs.some(o => o.id === s.cutOutputId))
  const factoryScrappedPieces = factoryScraps.reduce((n,s) => n+s.pieces,0)
  const closure = draft.terminationClosures.find(item => item.productionOrderId === productionOrderId)
  const packages = draft.packages.filter((item) => ids.has(item.demandId))
  const packageIds = new Set(packages.map((item) => item.id))
  const handovers = draft.outputHandovers.filter((item) => packageIds.has(item.packageId))
  const productionIssues = draft.productionIssues.filter((item) => ids.has(item.demandId))
  const control = effectiveTmfProductionControl(draft, productionOrderId)
  const local = draft.productionControls.find(item => item.productionOrderId === productionOrderId)
  const mainStatus = readProductionOrderRuntimeFact(productionOrderId)?.status
  const reservedMeters = draft.reservations.filter(item => ids.has(item.demandId)).reduce((sum,item) => add(sum,item.reservedMeters),0)
  const allocatedPieces = draft.outputAllocations.filter(item => ids.has(item.demandId)).reduce((sum,item) => sum + item.allocatedPieces - item.releasedPieces - productionIssues.filter(issue => issue.allocationId === item.id).reduce((n,issue) => n + issue.dispatchedPieces,0),0)
  return { productionOrderId, mainStatus, localStatus: local?.status ?? 'ACTIVE', pendingCancellationDisposition: mainStatus === 'CANCELLED' && local?.status !== 'CANCELLED', reservedMeters, allocatedPieces, status: control?.status ?? 'ACTIVE', reason: control?.reason ?? '',
    cutPieces: outputs.reduce((sum, item) => sum + item.cutPieces, 0),
    factoryPieces: outputs.reduce((sum, item) => sum + item.cutPieces, 0) - handovers.reduce((sum, item) => sum + item.dispatchedPieces, 0) - scrappedPieces - factoryScrappedPieces,
    factoryScrappedPieces,
    terminationClosedAt: closure?.occurredAt,
    warehousePieces: packages.filter((item) => !item.splitAt).reduce((sum, item) => sum + outputPackageBalance(draft, item.id).onHandPieces, 0),
    warehouseTransitPieces: handovers.reduce((sum, item) => sum + item.dispatchedPieces - item.receivedPieces, 0),
    productionTransitPieces: productionIssues.reduce((sum, item) => sum + item.dispatchedPieces - item.receivedPieces, 0),
    productionReceivedPieces: productionIssues.reduce((sum, item) => sum + item.receivedPieces, 0),
    pendingTipPieces: outputs.reduce((sum, item) => sum + item.pendingTipPieces, 0),
    defectivePieces: outputs.reduce((sum, item) => sum + item.defectivePieces, 0),
    scrappedPieces, scrappedEquivalentMeters: scraps.reduce((n,s) => add(n,s.equivalentMeters),0),
    pendingDefectivePieces: outputs.reduce((sum,item) => sum+item.defectivePieces,0)-scrappedPieces,
    cutEquivalentMeters: outputs.reduce((sum, item) => add(sum, item.cutEquivalentMeters), 0),
    remainingContinuousMeters: draft.processingIssues.filter((item) => ids.has(item.demandId))
      .reduce((sum, item) => add(sum, getTmfProcessingInputBalance(item.id).remainingMeters), 0) }
}


/** 合并只是执行组织，实际投入/产出继续按来源行保存；整个动作一次提交。 */
export function issueTmfMergedContinuousMaterial(input: { batchId: string; lines: TmfContinuousIssueInput[]; reason: string }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['仓管', '仓库主管'])
  commit(operationId, '合并加工发料', input.batchId, actor, input, (draft, at) => {
    if (!input.batchId.trim() || !input.reason.trim() || input.lines.length < 2 || new Set(input.lines.map(l=>l.reservationId)).size !== input.lines.length) throw new Error('请明确合并批号、原因及至少两条不同占用。')
    if (draft.processingIssues.some(i=>i.mergedBatchId===input.batchId)) throw new Error('合并批号已使用，不能追加覆盖。')
    const demands=input.lines.map(l=>draft.demands.find(d=>d.id===draft.reservations.find(r=>r.id===l.reservationId)?.demandId))
    if(demands.some(d=>!d)||new Set(demands.map(d=>d!.id)).size!==demands.length)throw new Error('合并来源必须保留不同且有效的需求行。')
    const keys=demands.map(d=>JSON.stringify([d!.materialSkuId,getWebbingPhysicalSpecificationKey(d!.specification)]))
    if(new Set(keys).size!==1||input.lines.some(l=>l.targetFactoryId!==TMF_FACTORY_ID))throw new Error('只有同SKU、同加工规格且交给TMF的需求可以合并。')
    const lots=input.lines.map(l=>draft.lots.find(lot=>lot.id===draft.reservations.find(r=>r.id===l.reservationId)?.lotId))
    if(lots.some(l=>!l)||new Set(lots.map(l=>l!.warehouseId)).size!==1)throw new Error('一次合并发料必须来自同一仓库。')
    if(new Set(lots.map(l=>draft.orders.find(p=>p.purchaseOrderNo===l!.sourcePurchaseOrderNo)?.accessoryType)).size!==1)throw new Error('合并批的织带/绳子计量形态必须一致。')
    for(const line of input.lines){applyTmfContinuousIssue(draft,line,at);draft.processingIssues.find(i=>i.id===line.issueId)!.mergedBatchId=input.batchId}
    return {quantity:input.lines.reduce((n,l)=>add(n,l.dispatchedMeters),0),reason:input.reason}
  })
}

export function receiveTmfMergedProcessingMaterial(input: { batchId: string; materialSkuId: string; lines: Array<{ issueId: string; receivedMeters: number }> }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId,'合并加工投入实收',input.batchId,actor,input,draft=>{
    if(!input.batchId.trim()||!input.lines.length||new Set(input.lines.map(l=>l.issueId)).size!==input.lines.length)throw new Error('请按不同发料明细登记实际接收。')
    for(const line of input.lines){
      meters(line.receivedMeters)
      const issue=draft.processingIssues.find(i=>i.id===line.issueId&&i.mergedBatchId===input.batchId)
      if(issue?.printHandover)throw new Error('印花回料须按原交出记录实收。')
      if(!issue||issue.targetFactoryId!==TMF_FACTORY_ID||issue.materialSkuId!==input.materialSkuId)throw new Error('发料明细不属于当前合并批或SKU不符。')
      if(add(issue.receivedMeters,line.receivedMeters)>issue.dispatchedMeters)throw new Error('实收超过该来源行实际发出量。')
      issue.receivedMeters=add(issue.receivedMeters,line.receivedMeters)
    }
    return {quantity:input.lines.reduce((n,l)=>add(n,l.receivedMeters),0)}
  })
}

export function reportTmfMergedCutOutput(input: { batchId: string; actualCutLengthMm: number; actualFinishedLengthMm: number | null; reason: string; lines: Array<Omit<TmfCutOutputInput,'actualCutLengthMm'|'actualFinishedLengthMm'|'reason'>> }, actor: TmfPurchaseActor, operationId: string): void {
  allowed(actor, ['织带厂员工', '织带厂主管'])
  commit(operationId,'合并截断产出填报',input.batchId,actor,input,(draft,at)=>{
    if(!input.batchId.trim()||!input.lines.length||new Set(input.lines.map(l=>l.issueId)).size!==input.lines.length)throw new Error('请分配到不同加工来源行，不能重复登记同一投入。')
    for(const line of input.lines){
      if(!draft.processingIssues.some(i=>i.id===line.issueId&&i.mergedBatchId===input.batchId))throw new Error('加工投入不属于当前合并批。')
      applyTmfCutOutput(draft,{...line,actualCutLengthMm:input.actualCutLengthMm,actualFinishedLengthMm:input.actualFinishedLengthMm,reason:input.reason},at)
    }
    const first=draft.cutOutputs.find(o=>o.id===input.lines[0].outputId)!
    return {quantity:input.lines.reduce((n,l)=>n+l.cutPieces,0),unit:first.unit,reason:input.reason}
  })
}

function baseMaterialQuantity(value:number,allowZero=false){
  if(!Number.isFinite(value)||value<0||(!allowZero&&value===0)||Math.abs(value*1000-Math.round(value*1000))>0.000001)throw new Error('重量数量须为有效正数，最多三位小数。')
}
function baseMaterialAvailable(draft:TmfPurchaseState,issue:TmfBaseMaterialIssue){
  const returned=draft.baseMaterialReturns.filter(r=>r.issueId===issue.id).reduce((n,r)=>add(n,r.dispatchedQty),0)
  return add(issue.receivedQty,-add(add(issue.consumedQty,issue.scrapQty),returned))
}
export function receiveTmfBaseMaterialStock(input:Omit<TmfBaseMaterialLot,'onHandQty'>,actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['仓管','仓库主管'])
 commit(operationId,'基础原料仓库实收',input.id,actor,input,draft=>{
  baseMaterialQuantity(input.receivedQty)
  if(!['kg','g'].includes(input.unit)||[input.id,input.materialSkuId,input.warehouseId,input.location,input.sourceReceiptNo,input.sourceReceiptLineId].some(v=>!v.trim()))throw new Error('请明确原料SKU、重量单位、仓库库位及来源实收单行。')
  if(draft.baseMaterialLots.some(l=>l.id===input.id||(l.sourceReceiptNo===input.sourceReceiptNo&&l.sourceReceiptLineId===input.sourceReceiptLineId)))throw new Error('原料批次或来源实收行已登记，不能重复入账。')
  draft.baseMaterialLots.push({...input,onHandQty:input.receivedQty})
  return {quantity:input.receivedQty,unit:input.unit}
 })
}
export function dispatchTmfBaseMaterial(input:{id:string;baseOrderId:string;lotId:string;quantity:number},actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['仓管','仓库主管'])
 commit(operationId,'基础生产原料发出',input.baseOrderId,actor,input,draft=>{
  baseMaterialQuantity(input.quantity)
  const base=draft.baseOrders.find(b=>b.id===input.baseOrderId),lot=draft.baseMaterialLots.find(l=>l.id===input.lotId)
  if(!base||!base.acceptedAt||base.cancelledAt||base.changePending)throw new Error('半成品加工单须已确认接受，且没有待处理变更或终止。')
  if(!lot||input.quantity>lot.onHandQty)throw new Error('来源原料库存不足。')
  if(!input.id.trim()||draft.baseMaterialIssues.some(i=>i.id===input.id))throw new Error('发料单号缺失或重复。')
  lot.onHandQty=add(lot.onHandQty,-input.quantity)
  draft.baseMaterialIssues.push({id:input.id,baseOrderId:base.id,lotId:lot.id,dispatchedQty:input.quantity,receivedQty:0,consumedQty:0,scrapQty:0})
  return {quantity:input.quantity,unit:lot.unit,reason:`来源批次 ${lot.id}`}
 })
}
export function receiveTmfBaseMaterial(input:{issueId:string;materialSkuId:string;unit:'kg'|'g';quantity:number},actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['织带厂员工','织带厂主管'])
 commit(operationId,'基础生产原料实收',input.issueId,actor,input,draft=>{
  baseMaterialQuantity(input.quantity)
  const issue=draft.baseMaterialIssues.find(i=>i.id===input.issueId),lot=draft.baseMaterialLots.find(l=>l.id===issue?.lotId)
  if(!issue||!lot||lot.materialSkuId!==input.materialSkuId||lot.unit!==input.unit)throw new Error('来源发料、原料SKU或重量单位不符。')
  if(add(issue.receivedQty,input.quantity)>issue.dispatchedQty)throw new Error('实收超过实际发出数量。')
  issue.receivedQty=add(issue.receivedQty,input.quantity)
  return {quantity:input.quantity,unit:lot.unit}
 })
}
export function consumeTmfBaseMaterial(input:{issueId:string;consumedQty:number;scrapQty:number;reason:string},actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['织带厂员工','织带厂主管'])
 commit(operationId,'半成品加工原料耗用',input.issueId,actor,input,(draft,at)=>{
  baseMaterialQuantity(input.consumedQty,true);baseMaterialQuantity(input.scrapQty,true)
  const issue=draft.baseMaterialIssues.find(i=>i.id===input.issueId),base=draft.baseOrders.find(b=>b.id===issue?.baseOrderId),lot=draft.baseMaterialLots.find(l=>l.id===issue?.lotId)
  if(!issue||!base||!lot||!base.acceptedAt||base.cancelledAt||base.changePending)throw new Error('半成品加工单尚未确认接受、已终止或有待处理变更，不能登记耗用。')
  const total=add(input.consumedQty,input.scrapQty)
  if(total<=0||total>baseMaterialAvailable(draft,issue))throw new Error('本次耗用及损耗须大于零且不能超过厂内实收可用原料。')
  if(!input.reason.trim())throw new Error('请填写实际耗用及损耗依据，不按产出米数自动推算。')
  base.startedAt??=at
  issue.consumedQty=add(issue.consumedQty,input.consumedQty);issue.scrapQty=add(issue.scrapQty,input.scrapQty)
  return {quantity:total,unit:lot.unit,reason:input.reason}
 })
}
export function dispatchTmfBaseMaterialReturn(input:{id:string;issueId:string;quantity:number;reason:string},actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['织带厂员工','织带厂主管'])
 commit(operationId,'基础原料余料交回',input.issueId,actor,input,draft=>{
  baseMaterialQuantity(input.quantity)
  const issue=draft.baseMaterialIssues.find(i=>i.id===input.issueId),lot=draft.baseMaterialLots.find(l=>l.id===issue?.lotId)
  if(!issue||!lot||input.quantity>baseMaterialAvailable(draft,issue))throw new Error('交回超过厂内未耗用原料。')
  if(!input.id.trim()||!input.reason.trim()||draft.baseMaterialReturns.some(r=>r.id===input.id))throw new Error('请填写唯一退料单号及退料原因。')
  draft.baseMaterialReturns.push({id:input.id,issueId:input.issueId,dispatchedQty:input.quantity,receivedQty:0,reason:input.reason})
  return {quantity:input.quantity,unit:lot.unit,reason:input.reason}
 })
}
export function receiveTmfBaseMaterialReturn(input:{returnId:string;warehouseId:string;materialSkuId:string;unit:'kg'|'g';quantity:number},actor:TmfPurchaseActor,operationId:string):void{
 allowed(actor,['仓管','仓库主管'])
 commit(operationId,'基础原料余料回仓实收',input.returnId,actor,input,draft=>{
  baseMaterialQuantity(input.quantity)
  const returned=draft.baseMaterialReturns.find(r=>r.id===input.returnId),issue=draft.baseMaterialIssues.find(i=>i.id===returned?.issueId),lot=draft.baseMaterialLots.find(l=>l.id===issue?.lotId)
  if(!returned||!lot||lot.warehouseId!==input.warehouseId||lot.materialSkuId!==input.materialSkuId||lot.unit!==input.unit)throw new Error('退料来源、原仓、SKU或单位不符。')
  if(add(returned.receivedQty,input.quantity)>returned.dispatchedQty)throw new Error('实收超过实际交回数量。')
  returned.receivedQty=add(returned.receivedQty,input.quantity);lot.onHandQty=add(lot.onHandQty,input.quantity)
  return {quantity:input.quantity,unit:lot.unit}
 })
}
export function getTmfBaseMaterialBalance(issueId:string){
 const draft=current(),issue=draft.baseMaterialIssues.find(i=>i.id===issueId)
 if(!issue)throw new Error('基础生产原料发料不存在。')
 const lot=draft.baseMaterialLots.find(l=>l.id===issue.lotId)!,returns=draft.baseMaterialReturns.filter(r=>r.issueId===issue.id)
 return {unit:lot.unit,materialSkuId:lot.materialSkuId,availableQty:baseMaterialAvailable(draft,issue),inboundTransitQty:add(issue.dispatchedQty,-issue.receivedQty),returnedQty:returns.reduce((n,r)=>add(n,r.dispatchedQty),0),returnReceivedQty:returns.reduce((n,r)=>add(n,r.receivedQty),0)}
}

/** PMS以实际仓库实收回读履约；快照用于刷新后仍可追溯原采购，非第二份累计账。 */
export function listTmfSupplyPurchaseProjections():PmsMaterialPurchaseOrder[]{
 const receipts=current().supplyPurchaseReceipts
 return [...new Set(receipts.map(r=>r.purchaseOrderNo))].map(no=>{
  const lines=receipts.filter(r=>r.purchaseOrderNo===no),source=lines[0].purchaseSnapshot
  const receivedQty=lines.reduce((n,r)=>add(n,r.quantity),0)
  return {...structuredClone(source),receivedQty,status:receivedQty===source.orderedQty?'已入库':'部分到货'}
 })
}

/** 仓库真实实收与可用原料批次在同一次持久化中形成；不调用手改到货累计。 */
export async function receiveTmfSupplyPurchase(input:{receiptId:string;purchaseOrderNo:string;purpose:'BASE_MATERIAL'|'TIP_MATERIAL';lotId:string;scannedMaterialCode:string;warehouse:string;location:string;quantity:number},actor:TmfPurchaseActor,operationId:string):Promise<void>{
 allowed(actor,['仓管','仓库主管'])
 const {getPmsMaterialPurchaseOrder}=await import('./material-purchase-orders.ts')
 const source=getPmsMaterialPurchaseOrder(input.purchaseOrderNo)
 commit(operationId,'投入料采购仓库实收',input.purchaseOrderNo,actor,input,(draft,at)=>{
  if(!source||draft.orders.some(o=>o.purchaseOrderNo===source.purchaseOrderNo))throw new Error('采购不存在或属于基础半成品采购，不能作为投入料重复入库。')
  const old=draft.supplyPurchaseReceipts.filter(r=>r.purchaseOrderNo===input.purchaseOrderNo)
  const snapshot=old[0]?.purchaseSnapshot??source
  if(!old.length&&(source.status==='待采购'||source.status==='已关闭'||source.receivedQty!==0))throw new Error('只接入已下达且没有历史手工到货的投入料采购；已有到货须先核对原实收来源。')
  if(snapshot.tmfTipSource&&input.purpose!=='TIP_MATERIAL')throw new Error('该采购来源为技术包端头辅材，必须记入打头辅材库存。')
  if(old.some(r=>r.purpose!==input.purpose))throw new Error('同一采购不能同时记入基础原料和端头辅材库存。')
  if(!['BASE_MATERIAL','TIP_MATERIAL'].includes(input.purpose)||![input.receiptId,input.lotId,input.location,input.warehouse].every(v=>v.trim()))throw new Error('请填写收货单、批次、仓库库位及实际用途。')
  if(source.materialCode!==snapshot.materialCode||source.unit!==snapshot.unit||source.orderedQty!==snapshot.orderedQty)throw new Error('采购规格或计划已变化，请先处理变更影响。')
  if(input.scannedMaterialCode!==snapshot.materialCode||input.warehouse!==snapshot.warehouse)throw new Error('实物物料编码或目标仓库与采购不符。')
   const unit=({'公斤':'kg','千克':'kg','kg':'kg','克':'g','g':'g','个':'个'} as Record<string,'kg'|'g'|'个'>)[snapshot.unit]
   if(!unit||(input.purpose==='BASE_MATERIAL'&&unit==='个'))throw new Error('投入料计量单位不支持；不得把卷、米或件数推算成重量。')
   // 主档映射：端头辅材与基础原料都必须解析到已登记主档，不能凭名称或数量直接入账。
   if(input.purpose==='TIP_MATERIAL')assertTmfTipMaterialMaster(snapshot.materialCode,unit)
   else assertTmfRawMaterialMaster(snapshot.materialCode)
   validateTipQuantity(input.quantity,unit)
  if(add(old.reduce((n,r)=>add(n,r.quantity),0),input.quantity)>snapshot.orderedQty)throw new Error('本次实收超过采购未收数量。')
  if(draft.supplyPurchaseReceipts.some(r=>r.id===input.receiptId)||draft.baseMaterialLots.some(l=>l.id===input.lotId||l.sourceReceiptNo===input.receiptId)||draft.tipMaterialLots.some(l=>l.id===input.lotId||l.sourceReceiptNo===input.receiptId))throw new Error('收货单或投入料批次已登记，不能重复入库。')
  const lot={id:input.lotId,materialSkuId:snapshot.materialCode,warehouseId:input.warehouse,location:input.location,sourceReceiptNo:input.receiptId,sourceReceiptLineId:'1',unit,receivedQty:input.quantity,onHandQty:input.quantity}
  if(input.purpose==='BASE_MATERIAL')draft.baseMaterialLots.push({...lot,unit:unit as 'kg'|'g'})
  else draft.tipMaterialLots.push({...lot,receivedAt:at})
  draft.supplyPurchaseReceipts.push({id:input.receiptId,purchaseOrderNo:source.purchaseOrderNo,purchaseSnapshot:structuredClone(snapshot),purpose:input.purpose,lotId:input.lotId,quantity:input.quantity,unit,receivedAt:at})
  return {quantity:input.quantity,unit,reason:`采购 ${source.purchaseOrderNo}；实收 ${input.receiptId}；目标仓 ${input.warehouse}`}
 })
}
