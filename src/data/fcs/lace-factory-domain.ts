import {
  ACCESSORY_FACTORY_MAPPINGS,
  LACE_INPUT_MATERIAL_CATALOG,
  createAccessoryPurchaseOrderSeeds,
  projectLacePurchaseDemands,
  type AccessoryPurchaseOrder,
  type LacePlannedInputMaterial,
  type LacePurchaseChangeField,
  type LacePurchaseDemand,
  type LacePurchaseProjectionFailure,
  type LacePurchaseSourceLine,
} from './lace-factory-purchase-projection.ts'

export type LaceProductionStatus = '待接收' | '加工中' | '已完结' | '已取消'
export type LaceHandoverStatus = '未交出' | '部分交出' | '已全部交出'
export type LaceReceiptSummaryStatus = '未收货' | '部分收货' | '已收货'
export type LacePurchaseChangeViewStatus = '无新变更' | '待查看' | '已查看'
export type LaceActorRole =
  | '花边厂业务员'
  | '花边厂主管'
  | '中央辅料仓管'
  | '中央辅料仓主管'
  | 'PMS采购员'
  | '平台主管'

export interface LaceActor {
  actorId: string
  actorName: string
  role: LaceActorRole
  factoryOrgId?: string
}

export const LACE_FACTORY_OPERATOR: LaceActor = {
  actorId: 'USR-RJ-BUSINESS-01',
  actorName: 'Ayu · Renda Jaya',
  role: '花边厂业务员',
  factoryOrgId: 'FAC-RJ-LACE',
}

export const LACE_FACTORY_SUPERVISOR: LaceActor = {
  actorId: 'USR-RJ-SUPERVISOR-01',
  actorName: 'Sari · Renda Jaya 主管',
  role: '花边厂主管',
  factoryOrgId: 'FAC-RJ-LACE',
}

export const WLS_ACCESSORY_CLERK: LaceActor = {
  actorId: 'USR-WLS-ACCESSORY-01',
  actorName: '中央辅料仓 · Dewi',
  role: '中央辅料仓管',
}

export const WLS_ACCESSORY_SUPERVISOR: LaceActor = {
  actorId: 'USR-WLS-ACCESSORY-SUPERVISOR',
  actorName: '中央辅料仓主管 · Budi',
  role: '中央辅料仓主管',
}

export const PMS_BUYER: LaceActor = {
  actorId: 'USR-PMS-XIAOKE',
  actorName: '小科',
  role: 'PMS采购员',
}

export const PLATFORM_ADMIN: LaceActor = {
  actorId: 'USR-PLATFORM-ADMIN',
  actorName: '平台主管 · 李敏',
  role: '平台主管',
}

export interface LaceProcessingInputLine extends LacePlannedInputMaterial {
  plannedQty: number
}

export interface LaceDemandSourceSnapshot {
  purchaseOrderId: string
  purchaseOrderNo: string
  purchaseVersion: number
  supplierId: string
  supplierName: string
  factoryOrgId: string
  factoryName: string
  sourceLineIds: string[]
  sourceLines: LacePurchaseSourceLine[]
  orderedAt: string
  buyerId: string
  buyerName: string
  planQty: number
  unit: string
  dueDate: string
  targetWarehouseId: string
  targetWarehouseName: string
  sourceNote: string
}

export interface LaceProcessingOutput {
  skuId: string
  skuCode: string
  materialName: string
  specification: string
  color: string
  materialImageUrl: string
  planQty: number
  unit: string
}

export interface LaceProductionOrder {
  workOrderId: string
  workOrderNo: string
  generationKey: string
  purchaseOrderId: string
  purchaseOrderNo: string
  sourceLineIds: string[]
  sourceLines: LacePurchaseSourceLine[]
  purchaseVersion: number
  supplierId: string
  supplierName: string
  factoryOrgId: string
  factoryName: string
  skuId: string
  skuCode: string
  materialName: string
  specification: string
  color: string
  materialImageUrl: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  planQty: number
  unit: string
  dueDate: string
  targetWarehouseId: string
  targetWarehouseName: string
  sourceNote: string
  demandSource: LaceDemandSourceSnapshot
  inputLines: LaceProcessingInputLine[]
  processingOutput: LaceProcessingOutput
  status: LaceProductionStatus
  statusBeforeCancellation?: Exclude<LaceProductionStatus, '已取消'>
  createdAt: string
  createdBy: string
  receivedAt?: string
  completedAt?: string
  cancelledAt?: string
}

export interface LaceCompletionReportRevision {
  previousQty: number
  revisedQty: number
  reason: string
  revisedAt: string
  revisedById: string
  revisedByName: string
}

export interface LaceCompletionReport {
  reportId: string
  workOrderId: string
  qty: number
  unit: string
  reportedAt: string
  reporterId: string
  reporterName: string
  note: string
  clientActionId: string
  revisions: LaceCompletionReportRevision[]
}

export interface LaceHandoverRecord {
  handoverId: string
  handoverNo: string
  workOrderId: string
  workOrderNo: string
  purchaseOrderId: string
  purchaseOrderNo: string
  skuId: string
  skuCode: string
  materialName: string
  materialImageUrl: string
  styleName: string
  styleCode: string
  styleImageUrl: string
  sourceLines: LacePurchaseSourceLine[]
  qty: number
  unit: string
  cumulativeBefore: number
  cumulativeAfter: number
  fromFactoryOrgId: string
  fromFactoryName: string
  toWarehouseId: string
  toWarehouseName: string
  deliveryNo: string
  packageCount: number
  packageNote: string
  handedOverById: string
  handedOverByName: string
  expectedReceiverName: string
  handedOverAt: string
  receiptStatus: '待收货' | '已收货'
  clientActionId: string
}

export interface LaceReceiptRecord {
  receiptId: string
  handoverId: string
  workOrderId: string
  purchaseOrderId: string
  skuId: string
  actualQty: number
  unit: string
  warehouseId: string
  warehouseName: string
  warehouseLocation: string
  receivedById: string
  receivedByName: string
  receivedAt: string
  differenceReason: string
  evidence: string
  overReceiptConfirmedById?: string
  overReceiptConfirmedByName?: string
  clientActionId: string
}

export interface LaceOperationLog {
  logId: string
  objectType: '采购单' | '采购需求' | '花边生产单' | '加工填报' | '交出记录' | '收货记录'
  objectId: string
  action: string
  beforeValue: string
  afterValue: string
  reason: string
  actorId: string
  actorName: string
  actorRole: LaceActorRole | '系统'
  actorOrgId: string
  occurredAt: string
  timeZone: 'Asia/Jakarta'
  source: 'PMS' | 'PFOS' | 'WLS' | '系统自动任务'
  relatedObjectType: string
  relatedObjectId: string
  relatedPurchaseVersion?: number
  secondConfirmation: '不适用' | '已确认'
}

export interface LaceProductionOrderView extends LaceProductionOrder {
  completedQty: number
  handedOverQty: number
  receivedQty: number
  remainingHandoverQty: number
  handoverStatus: LaceHandoverStatus
  receiptStatus: LaceReceiptSummaryStatus
  hasReceiptDifference: boolean
  purchaseChangeStatus: LacePurchaseChangeViewStatus
}

export interface LaceFactoryRuntimeState {
  purchaseOrders: AccessoryPurchaseOrder[]
  workOrders: LaceProductionOrder[]
  completionReports: LaceCompletionReport[]
  handovers: LaceHandoverRecord[]
  receipts: LaceReceiptRecord[]
  logs: LaceOperationLog[]
  viewedPurchaseVersions: Map<string, number>
  actionIds: Set<string>
  sequence: {
    workOrder: number
    report: number
    handover: number
    receipt: number
    log: number
    purchaseChange: number
  }
}

export class LaceDomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'LaceDomainError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new LaceDomainError(code, message)
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function roundUnitUsage(value: number): number {
  return Math.round(value * 10000) / 10000
}

function plannedInputQty(outputPlanQty: number, unitUsage: number): number {
  return roundQty(outputPlanQty * unitUsage)
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeEventTime(value: string | undefined, label: string): string {
  if (!value) return nowIso()
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) fail('INVALID_EVENT_TIME', `${label}格式不正确`)
  if (timestamp > Date.now() + 1_000) fail('FUTURE_EVENT_TIME', `${label}不能晚于当前时间`)
  return new Date(timestamp).toISOString()
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

let runtime: LaceFactoryRuntimeState | null = null

function sourceForActor(actor: LaceActor): LaceOperationLog['source'] {
  if (actor.role === 'PMS采购员') return 'PMS'
  if (actor.role === '中央辅料仓管' || actor.role === '中央辅料仓主管') return 'WLS'
  return 'PFOS'
}

function orgForLog(actorRole: LaceOperationLog['actorRole'], actorOrgId?: string): string {
  if (actorOrgId) return actorOrgId
  if (actorRole === '花边厂业务员' || actorRole === '花边厂主管') return 'FAC-RJ-LACE'
  if (actorRole === '中央辅料仓管' || actorRole === '中央辅料仓主管') return 'WLS-CENTRAL-ACCESSORY'
  if (actorRole === 'PMS采购员') return 'PMS'
  if (actorRole === '平台主管') return 'PLATFORM'
  return 'SYSTEM'
}

function appendLog(
  state: LaceFactoryRuntimeState,
  input: Omit<
    LaceOperationLog,
    'logId' | 'occurredAt' | 'actorOrgId' | 'timeZone' | 'relatedObjectType' | 'relatedObjectId' | 'secondConfirmation'
  > & {
    occurredAt?: string
    actorOrgId?: string
    relatedObjectType?: string
    relatedObjectId?: string
    secondConfirmation?: LaceOperationLog['secondConfirmation']
  },
): LaceOperationLog {
  state.sequence.log += 1
  const log: LaceOperationLog = {
    ...input,
    logId: `LACE-LOG-${String(state.sequence.log).padStart(5, '0')}`,
    actorOrgId: orgForLog(input.actorRole, input.actorOrgId),
    occurredAt: input.occurredAt ?? nowIso(),
    timeZone: 'Asia/Jakarta',
    relatedObjectType: input.relatedObjectType ?? input.objectType,
    relatedObjectId: input.relatedObjectId ?? input.objectId,
    secondConfirmation: input.secondConfirmation ?? '不适用',
  }
  state.logs.push(log)
  return log
}

function createWorkOrderFromDemand(state: LaceFactoryRuntimeState, demand: LacePurchaseDemand): LaceProductionOrder {
  const existing = state.workOrders.find((order) => order.generationKey === demand.generationKey)
  if (existing) return existing

  state.sequence.workOrder += 1
  const order: LaceProductionOrder = {
    workOrderId: `LWO-RJ-260808-${String(state.sequence.workOrder).padStart(3, '0')}`,
    workOrderNo: `HBSC-260808-${String(state.sequence.workOrder).padStart(3, '0')}`,
    generationKey: demand.generationKey,
    purchaseOrderId: demand.purchaseOrderId,
    purchaseOrderNo: demand.purchaseOrderNo,
    sourceLineIds: [...demand.sourceLineIds],
    sourceLines: deepClone(demand.sourceLines),
    purchaseVersion: demand.purchaseOrderVersion,
    supplierId: demand.supplierId,
    supplierName: demand.supplierName,
    factoryOrgId: demand.factoryOrgId,
    factoryName: demand.factoryName,
    skuId: demand.skuId,
    skuCode: demand.skuCode,
    materialName: demand.materialName,
    specification: demand.specification,
    color: demand.color,
    materialImageUrl: demand.materialImageUrl,
    styleId: demand.styleId,
    styleCode: demand.styleCode,
    styleName: demand.styleName,
    styleImageUrl: demand.styleImageUrl,
    planQty: demand.orderedQty,
    unit: demand.unit,
    dueDate: demand.dueDate,
    targetWarehouseId: demand.targetWarehouseId,
    targetWarehouseName: demand.targetWarehouseName,
    sourceNote: demand.note,
    demandSource: {
      purchaseOrderId: demand.purchaseOrderId,
      purchaseOrderNo: demand.purchaseOrderNo,
      purchaseVersion: demand.purchaseOrderVersion,
      supplierId: demand.supplierId,
      supplierName: demand.supplierName,
      factoryOrgId: demand.factoryOrgId,
      factoryName: demand.factoryName,
      sourceLineIds: [...demand.sourceLineIds],
      sourceLines: deepClone(demand.sourceLines),
      orderedAt: demand.orderedAt,
      buyerId: demand.buyerId,
      buyerName: demand.buyerName,
      planQty: demand.orderedQty,
      unit: demand.unit,
      dueDate: demand.dueDate,
      targetWarehouseId: demand.targetWarehouseId,
      targetWarehouseName: demand.targetWarehouseName,
      sourceNote: demand.note,
    },
    inputLines: demand.plannedInputs.map((input) => ({
      ...input,
      unitUsage: roundUnitUsage(input.unitUsage),
      plannedQty: plannedInputQty(demand.orderedQty, input.unitUsage),
    })),
    processingOutput: {
      skuId: demand.skuId,
      skuCode: demand.skuCode,
      materialName: demand.materialName,
      specification: demand.specification,
      color: demand.color,
      materialImageUrl: demand.materialImageUrl,
      planQty: demand.orderedQty,
      unit: demand.unit,
    },
    status: '待接收',
    createdAt: '2026-08-08T08:40:07+07:00',
    createdBy: '系统自动任务',
  }
  appendLog(state, {
    objectType: '采购需求',
    objectId: demand.generationKey,
    action: '识别内部花边采购需求',
    beforeValue: '未进入 PFOS',
    afterValue: `${demand.purchaseOrderNo}｜${demand.skuCode}｜${demand.orderedQty} ${demand.unit}`,
    reason: `${demand.supplierName} 已映射 ${demand.factoryName}`,
    actorId: 'SYSTEM-PURCHASE-PROJECTION',
    actorName: '系统自动任务',
    actorRole: '系统',
    actorOrgId: demand.factoryOrgId,
    source: '系统自动任务',
    occurredAt: order.createdAt,
    relatedObjectType: '采购单',
    relatedObjectId: demand.purchaseOrderId,
    relatedPurchaseVersion: demand.purchaseOrderVersion,
  })
  state.workOrders.push(order)
  appendLog(state, {
    objectType: '花边生产单',
    objectId: order.workOrderId,
    action: '自动生成生产单',
    beforeValue: '无',
    afterValue: `${order.workOrderNo}｜${order.planQty} ${order.unit}`,
    reason: `采购单 ${order.purchaseOrderNo} 的 SKU ${order.skuCode} 首次满足生成条件`,
    actorId: 'SYSTEM-AUTO-GENERATION',
    actorName: '系统自动任务',
    actorRole: '系统',
    actorOrgId: demand.factoryOrgId,
    source: '系统自动任务',
    occurredAt: order.createdAt,
    relatedObjectType: '采购需求',
    relatedObjectId: demand.generationKey,
    relatedPurchaseVersion: demand.purchaseOrderVersion,
  })
  return order
}

function recordProjectionFailures(state: LaceFactoryRuntimeState, failures: LacePurchaseProjectionFailure[]): void {
  failures.forEach((failure) => {
    const alreadyRecorded = state.logs.some((log) => log.objectId === failure.failureId
      && log.action === '自动生成生产单失败'
      && log.reason === failure.reason)
    if (alreadyRecorded) return
    appendLog(state, {
      objectType: '采购需求',
      objectId: failure.failureId,
      action: '自动生成生产单失败',
      beforeValue: `${failure.purchaseOrderNo}｜${failure.skuCode}`,
      afterValue: '未生成生产单',
      reason: failure.reason,
      actorId: 'SYSTEM-AUTO-GENERATION',
      actorName: '系统自动任务',
      actorRole: '系统',
      actorOrgId: failure.factoryOrgId,
      source: '系统自动任务',
      relatedObjectType: '采购单',
      relatedObjectId: failure.purchaseOrderId,
      relatedPurchaseVersion: state.purchaseOrders.find((order) => order.purchaseOrderId === failure.purchaseOrderId)?.version,
    })
  })
}

function seedCompletion(
  state: LaceFactoryRuntimeState,
  order: LaceProductionOrder,
  qty: number,
  reportedAt: string,
  note: string,
): LaceCompletionReport {
  state.sequence.report += 1
  const report: LaceCompletionReport = {
    reportId: `LACE-REPORT-${String(state.sequence.report).padStart(4, '0')}`,
    workOrderId: order.workOrderId,
    qty,
    unit: order.unit,
    reportedAt,
    reporterId: LACE_FACTORY_OPERATOR.actorId,
    reporterName: LACE_FACTORY_OPERATOR.actorName,
    note,
    clientActionId: `SEED-REPORT-${state.sequence.report}`,
    revisions: [],
  }
  state.completionReports.push(report)
  state.actionIds.add(report.clientActionId)
  appendLog(state, {
    objectType: '加工填报',
    objectId: report.reportId,
    action: '加工填报',
    beforeValue: '0',
    afterValue: `${qty} ${order.unit}`,
    reason: note,
    actorId: report.reporterId,
    actorName: report.reporterName,
    actorRole: LACE_FACTORY_OPERATOR.role,
    source: 'PFOS',
    occurredAt: reportedAt,
    relatedObjectType: '花边生产单',
    relatedObjectId: order.workOrderId,
    relatedPurchaseVersion: order.purchaseVersion,
  })
  return report
}

function seedHandover(
  state: LaceFactoryRuntimeState,
  order: LaceProductionOrder,
  qty: number,
  handedOverAt: string,
  receiptStatus: LaceHandoverRecord['receiptStatus'],
): LaceHandoverRecord {
  const cumulativeBefore = state.handovers
    .filter((item) => item.workOrderId === order.workOrderId)
    .reduce((sum, item) => sum + item.qty, 0)
  state.sequence.handover += 1
  const handover: LaceHandoverRecord = {
    handoverId: `LACE-HANDOVER-${String(state.sequence.handover).padStart(4, '0')}`,
    handoverNo: `HBJC-260808-${String(state.sequence.handover).padStart(3, '0')}`,
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    purchaseOrderId: order.purchaseOrderId,
    purchaseOrderNo: order.purchaseOrderNo,
    skuId: order.skuId,
    skuCode: order.skuCode,
    materialName: order.materialName,
    materialImageUrl: order.materialImageUrl,
    styleName: order.styleName,
    styleCode: order.styleCode,
    styleImageUrl: order.styleImageUrl,
    sourceLines: deepClone(order.sourceLines),
    qty,
    unit: order.unit,
    cumulativeBefore,
    cumulativeAfter: roundQty(cumulativeBefore + qty),
    fromFactoryOrgId: order.factoryOrgId,
    fromFactoryName: order.factoryName,
    toWarehouseId: order.targetWarehouseId,
    toWarehouseName: order.targetWarehouseName,
    deliveryNo: `RJ-SJ-${String(state.sequence.handover).padStart(3, '0')}`,
    packageCount: Math.max(1, Math.ceil(qty / 100)),
    packageNote: '防潮袋封装，外贴采购单与 SKU 标签',
    handedOverById: LACE_FACTORY_OPERATOR.actorId,
    handedOverByName: LACE_FACTORY_OPERATOR.actorName,
    expectedReceiverName: '中央辅料仓',
    handedOverAt,
    receiptStatus,
    clientActionId: `SEED-HANDOVER-${state.sequence.handover}`,
  }
  state.handovers.push(handover)
  state.actionIds.add(handover.clientActionId)
  appendLog(state, {
    objectType: '交出记录',
    objectId: handover.handoverId,
    action: '发起交出',
    beforeValue: `${cumulativeBefore} ${order.unit}`,
    afterValue: `${handover.cumulativeAfter} ${order.unit}`,
    reason: `本次交出 ${qty} ${order.unit}`,
    actorId: handover.handedOverById,
    actorName: handover.handedOverByName,
    actorRole: LACE_FACTORY_OPERATOR.role,
    source: 'PFOS',
    occurredAt: handedOverAt,
    relatedObjectType: '花边生产单',
    relatedObjectId: order.workOrderId,
    relatedPurchaseVersion: order.purchaseVersion,
  })
  return handover
}

function seedReceipt(
  state: LaceFactoryRuntimeState,
  handover: LaceHandoverRecord,
  actualQty: number,
  receivedAt: string,
): LaceReceiptRecord {
  const purchaseReceivedBefore = roundQty(state.receipts
    .filter((receipt) => receipt.purchaseOrderId === handover.purchaseOrderId && receipt.skuId === handover.skuId)
    .reduce((sum, receipt) => sum + receipt.actualQty, 0))
  state.sequence.receipt += 1
  const receipt: LaceReceiptRecord = {
    receiptId: `LACE-RECEIPT-${String(state.sequence.receipt).padStart(4, '0')}`,
    handoverId: handover.handoverId,
    workOrderId: handover.workOrderId,
    purchaseOrderId: handover.purchaseOrderId,
    skuId: handover.skuId,
    actualQty,
    unit: handover.unit,
    warehouseId: handover.toWarehouseId,
    warehouseName: handover.toWarehouseName,
    receivedById: WLS_ACCESSORY_CLERK.actorId,
    receivedByName: WLS_ACCESSORY_CLERK.actorName,
    receivedAt,
    differenceReason: actualQty === handover.qty ? '' : `清点短少 ${roundQty(handover.qty - actualQty)} ${handover.unit}`,
    evidence: 'RJ-338468-首批收货清点.jpg',
    warehouseLocation: '辅料收货区 A-01',
    clientActionId: `SEED-RECEIPT-${state.sequence.receipt}`,
  }
  state.receipts.push(receipt)
  state.actionIds.add(receipt.clientActionId)
  appendLog(state, {
    objectType: '收货记录',
    objectId: receipt.receiptId,
    action: '确认实际收货',
    beforeValue: `交出 ${handover.qty} ${handover.unit}`,
    afterValue: `实收 ${actualQty} ${handover.unit}`,
    reason: receipt.differenceReason || '交出与实收一致',
    actorId: receipt.receivedById,
    actorName: receipt.receivedByName,
    actorRole: WLS_ACCESSORY_CLERK.role,
    source: 'WLS',
    occurredAt: receivedAt,
    relatedObjectType: '交出记录',
    relatedObjectId: handover.handoverId,
    relatedPurchaseVersion: state.purchaseOrders.find((order) => order.purchaseOrderId === handover.purchaseOrderId)?.version,
  })
  appendLog(state, {
    objectType: '采购单',
    objectId: handover.purchaseOrderId,
    action: '回写采购 SKU 实收',
    beforeValue: `${purchaseReceivedBefore} ${handover.unit}`,
    afterValue: `${roundQty(purchaseReceivedBefore + receipt.actualQty)} ${handover.unit}`,
    reason: `来源收货记录 ${receipt.receiptId}，SKU ${handover.skuCode}`,
    actorId: receipt.receivedById,
    actorName: receipt.receivedByName,
    actorRole: WLS_ACCESSORY_CLERK.role,
    source: 'WLS',
    occurredAt: receivedAt,
    relatedObjectType: '收货记录',
    relatedObjectId: receipt.receiptId,
    relatedPurchaseVersion: state.purchaseOrders.find((order) => order.purchaseOrderId === handover.purchaseOrderId)?.version,
  })
  return receipt
}

function buildInitialRuntime(): LaceFactoryRuntimeState {
  const state: LaceFactoryRuntimeState = {
    purchaseOrders: createAccessoryPurchaseOrderSeeds(),
    workOrders: [],
    completionReports: [],
    handovers: [],
    receipts: [],
    logs: [],
    viewedPurchaseVersions: new Map(),
    actionIds: new Set(),
    sequence: { workOrder: 0, report: 0, handover: 0, receipt: 0, log: 0, purchaseChange: 0 },
  }

  const projection = projectLacePurchaseDemands(state.purchaseOrders)
  projection.demands.forEach((demand) => createWorkOrderFromDemand(state, demand))
  recordProjectionFailures(state, projection.failures)

  const partialOrder = state.workOrders.find((order) => order.skuCode === 'IDFL251050-BLACK-19-4003PT')
  if (partialOrder) {
    partialOrder.status = '加工中'
    partialOrder.receivedAt = '2026-08-08T09:00:00+07:00'
    appendLog(state, {
      objectType: '花边生产单', objectId: partialOrder.workOrderId, action: '确认接收', beforeValue: '待接收', afterValue: '加工中',
      reason: '花边厂确认接收生产任务', actorId: LACE_FACTORY_OPERATOR.actorId, actorName: LACE_FACTORY_OPERATOR.actorName,
      actorRole: LACE_FACTORY_OPERATOR.role, source: 'PFOS', occurredAt: partialOrder.receivedAt,
      relatedObjectType: '采购单', relatedObjectId: partialOrder.purchaseOrderId, relatedPurchaseVersion: partialOrder.purchaseVersion,
    })
    seedCompletion(state, partialOrder, 120, '2026-08-08T11:10:00+07:00', '上午首批完工')
    seedCompletion(state, partialOrder, 76, '2026-08-08T14:35:00+07:00', '下午第二批完工')
    const handover = seedHandover(state, partialOrder, 120, '2026-08-08T15:20:00+07:00', '已收货')
    seedReceipt(state, handover, 118, '2026-08-08T16:05:00+07:00')
  }

  const completedOrder = state.workOrders.find((order) => order.skuCode === 'FLSZ26051153-105-4CM')
  if (completedOrder) {
    completedOrder.status = '已完结'
    completedOrder.receivedAt = '2026-08-08T08:50:00+07:00'
    completedOrder.completedAt = '2026-08-08T13:10:00+07:00'
    appendLog(state, {
      objectType: '花边生产单', objectId: completedOrder.workOrderId, action: '确认接收', beforeValue: '待接收', afterValue: '加工中',
      reason: '花边厂确认接收生产任务', actorId: LACE_FACTORY_OPERATOR.actorId, actorName: LACE_FACTORY_OPERATOR.actorName,
      actorRole: LACE_FACTORY_OPERATOR.role, source: 'PFOS', occurredAt: completedOrder.receivedAt,
      relatedObjectType: '采购单', relatedObjectId: completedOrder.purchaseOrderId, relatedPurchaseVersion: completedOrder.purchaseVersion,
    })
    seedCompletion(state, completedOrder, 420, '2026-08-08T12:55:00+07:00', '本单一次性完工')
    appendLog(state, {
      objectType: '花边生产单', objectId: completedOrder.workOrderId, action: '完成加工单', beforeValue: '加工中', afterValue: '已完结',
      reason: '累计完工 420 Yard，人员完成加工单', actorId: LACE_FACTORY_OPERATOR.actorId, actorName: LACE_FACTORY_OPERATOR.actorName,
      actorRole: LACE_FACTORY_OPERATOR.role, source: 'PFOS', occurredAt: completedOrder.completedAt,
      relatedObjectType: '采购单', relatedObjectId: completedOrder.purchaseOrderId, relatedPurchaseVersion: completedOrder.purchaseVersion,
    })
    seedHandover(state, completedOrder, 420, '2026-08-08T13:35:00+07:00', '待收货')
  }

  return state
}

function getState(): LaceFactoryRuntimeState {
  if (!runtime) runtime = buildInitialRuntime()
  return runtime
}

function assertFactoryActor(order: LaceProductionOrder, actor: LaceActor): void {
  if (actor.role === '平台主管') return
  if (!['花边厂业务员', '花边厂主管'].includes(actor.role) || actor.factoryOrgId !== order.factoryOrgId) {
    fail('FORBIDDEN_FACTORY', '当前账号无权操作该花边厂生产单')
  }
}

function findWorkOrder(state: LaceFactoryRuntimeState, workOrderId: string): LaceProductionOrder {
  const order = state.workOrders.find((item) => item.workOrderId === workOrderId)
  if (!order) fail('WORK_ORDER_NOT_FOUND', '花边生产单不存在')
  return order
}

function findPurchaseOrder(state: LaceFactoryRuntimeState, purchaseOrderId: string): AccessoryPurchaseOrder {
  const order = state.purchaseOrders.find((item) => item.purchaseOrderId === purchaseOrderId)
  if (!order) fail('PURCHASE_ORDER_NOT_FOUND', '采购单不存在')
  return order
}

function completedQtyForState(state: LaceFactoryRuntimeState, workOrderId: string): number {
  return roundQty(state.completionReports
    .filter((report) => report.workOrderId === workOrderId)
    .reduce((sum, report) => sum + report.qty, 0))
}

function handedOverQtyForState(state: LaceFactoryRuntimeState, workOrderId: string): number {
  return roundQty(state.handovers
    .filter((handover) => handover.workOrderId === workOrderId)
    .reduce((sum, handover) => sum + handover.qty, 0))
}

function receivedQtyForState(state: LaceFactoryRuntimeState, workOrderId: string): number {
  return roundQty(state.receipts
    .filter((receipt) => receipt.workOrderId === workOrderId)
    .reduce((sum, receipt) => sum + receipt.actualQty, 0))
}

function purchaseViewKey(actorId: string, purchaseOrderId: string): string {
  return `${actorId}::${purchaseOrderId}`
}

function currentChangeStatus(state: LaceFactoryRuntimeState, purchaseOrderId: string, actorId: string): LacePurchaseChangeViewStatus {
  const purchaseOrder = state.purchaseOrders.find((item) => item.purchaseOrderId === purchaseOrderId)
  const latestChangeVersion = purchaseOrder?.changeHistory.map((change) => change.toVersion).sort((a, b) => b - a)[0]
  if (!latestChangeVersion) return '无新变更'
  const viewedVersion = state.viewedPurchaseVersions.get(purchaseViewKey(actorId, purchaseOrderId)) ?? 0
  return viewedVersion >= latestChangeVersion ? '已查看' : '待查看'
}

function receiptStatusForState(state: LaceFactoryRuntimeState, workOrderId: string): LaceReceiptSummaryStatus {
  const handovers = state.handovers.filter((handover) => handover.workOrderId === workOrderId)
  if (handovers.length === 0 || handovers.every((handover) => handover.receiptStatus === '待收货')) return '未收货'
  if (handovers.some((handover) => handover.receiptStatus === '待收货')) return '部分收货'
  return '已收货'
}

function hasReceiptDifferenceForState(state: LaceFactoryRuntimeState, workOrderId: string): boolean {
  return state.handovers
    .filter((handover) => handover.workOrderId === workOrderId && handover.receiptStatus === '已收货')
    .some((handover) => {
      const receipt = state.receipts.find((item) => item.handoverId === handover.handoverId)
      return Boolean(receipt && receipt.actualQty !== handover.qty)
    })
}

function toWorkOrderView(state: LaceFactoryRuntimeState, order: LaceProductionOrder, actorId: string): LaceProductionOrderView {
  const completedQty = completedQtyForState(state, order.workOrderId)
  const handedOverQty = handedOverQtyForState(state, order.workOrderId)
  const receivedQty = receivedQtyForState(state, order.workOrderId)
  const remainingHandoverQty = roundQty(Math.max(0, completedQty - handedOverQty))
  const handoverStatus: LaceHandoverStatus = handedOverQty <= 0
    ? '未交出'
    : handedOverQty < completedQty
      ? '部分交出'
      : '已全部交出'
  return {
    ...deepClone(order),
    completedQty,
    handedOverQty,
    receivedQty,
    remainingHandoverQty,
    handoverStatus,
    receiptStatus: receiptStatusForState(state, order.workOrderId),
    hasReceiptDifference: hasReceiptDifferenceForState(state, order.workOrderId),
    purchaseChangeStatus: currentChangeStatus(state, order.purchaseOrderId, actorId),
  }
}

export function resetLaceFactoryRuntime(): void {
  runtime = null
  void getState()
}

export function captureLaceFactoryRuntime(): LaceFactoryRuntimeState {
  return structuredClone(getState())
}

export function restoreLaceFactoryRuntime(snapshot: LaceFactoryRuntimeState): void {
  runtime = structuredClone(snapshot)
}

export function listAccessoryPurchaseOrders(): AccessoryPurchaseOrder[] {
  return deepClone(getState().purchaseOrders)
}

export function getAccessoryPurchaseOrder(purchaseOrderId: string): AccessoryPurchaseOrder | undefined {
  const purchaseOrder = getState().purchaseOrders.find((item) => item.purchaseOrderId === purchaseOrderId)
  return purchaseOrder ? deepClone(purchaseOrder) : undefined
}

export function listLacePurchaseDemands(actor: LaceActor = LACE_FACTORY_OPERATOR): LacePurchaseDemand[] {
  const state = getState()
  const projected = projectLacePurchaseDemands(state.purchaseOrders).demands
  if (actor.role === '平台主管') return deepClone(projected)
  if (!actor.factoryOrgId) return []
  return deepClone(projected.filter((demand) => demand.factoryOrgId === actor.factoryOrgId))
}

export function listLaceGenerationFailures(actor: LaceActor = LACE_FACTORY_OPERATOR): LacePurchaseProjectionFailure[] {
  const state = getState()
  const failures = projectLacePurchaseDemands(state.purchaseOrders).failures
  if (actor.role === '平台主管') return deepClone(failures)
  return deepClone(failures.filter((failure) => failure.factoryOrgId === actor.factoryOrgId))
}

export function syncLaceProductionOrders(): LaceProductionOrder[] {
  const state = getState()
  const projected = projectLacePurchaseDemands(state.purchaseOrders)
  recordProjectionFailures(state, projected.failures)
  for (const demand of projected.demands) {
    const existing = state.workOrders.find((order) => order.generationKey === demand.generationKey)
    if (!existing) {
      createWorkOrderFromDemand(state, demand)
      continue
    }
    const before = `${existing.planQty} ${existing.unit}｜${existing.dueDate}｜${existing.targetWarehouseName}`
    existing.purchaseVersion = demand.purchaseOrderVersion
    existing.sourceLineIds = [...demand.sourceLineIds]
    existing.sourceLines = deepClone(demand.sourceLines)
    existing.planQty = demand.orderedQty
    existing.dueDate = demand.dueDate
    existing.targetWarehouseId = demand.targetWarehouseId
    existing.targetWarehouseName = demand.targetWarehouseName
    existing.sourceNote = demand.note
    existing.demandSource = {
      purchaseOrderId: demand.purchaseOrderId,
      purchaseOrderNo: demand.purchaseOrderNo,
      purchaseVersion: demand.purchaseOrderVersion,
      supplierId: demand.supplierId,
      supplierName: demand.supplierName,
      factoryOrgId: demand.factoryOrgId,
      factoryName: demand.factoryName,
      sourceLineIds: [...demand.sourceLineIds],
      sourceLines: deepClone(demand.sourceLines),
      orderedAt: demand.orderedAt,
      buyerId: demand.buyerId,
      buyerName: demand.buyerName,
      planQty: demand.orderedQty,
      unit: demand.unit,
      dueDate: demand.dueDate,
      targetWarehouseId: demand.targetWarehouseId,
      targetWarehouseName: demand.targetWarehouseName,
      sourceNote: demand.note,
    }
    existing.processingOutput = {
      ...existing.processingOutput,
      planQty: demand.orderedQty,
      unit: demand.unit,
    }
    existing.inputLines = existing.inputLines.map((line) => ({
      ...line,
      plannedQty: plannedInputQty(demand.orderedQty, line.unitUsage),
    }))
    const after = `${existing.planQty} ${existing.unit}｜${existing.dueDate}｜${existing.targetWarehouseName}`
    if (before !== after) {
      appendLog(state, {
        objectType: '花边生产单',
        objectId: existing.workOrderId,
        action: '同步采购变更',
        beforeValue: before,
        afterValue: after,
        reason: `同步采购单 ${existing.purchaseOrderNo} V${demand.purchaseOrderVersion}`,
        actorId: 'SYSTEM-PURCHASE-SYNC',
        actorName: '系统自动任务',
        actorRole: '系统',
        actorOrgId: existing.factoryOrgId,
        source: '系统自动任务',
        relatedObjectType: '采购单',
        relatedObjectId: existing.purchaseOrderId,
        relatedPurchaseVersion: demand.purchaseOrderVersion,
      })
    }
  }
  return deepClone(state.workOrders)
}

export function listLaceProductionOrders(actor: LaceActor = LACE_FACTORY_OPERATOR): LaceProductionOrderView[] {
  const state = getState()
  const orders = actor.role === '平台主管'
    ? state.workOrders
    : state.workOrders.filter((order) => actor.factoryOrgId === order.factoryOrgId)
  return orders.map((order) => toWorkOrderView(state, order, actor.actorId))
}

export function getLaceProductionOrderView(
  workOrderId: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LaceProductionOrderView | undefined {
  return listLaceProductionOrders(actor).find((order) => order.workOrderId === workOrderId)
}

export function listLaceCompletionReports(
  workOrderId?: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LaceCompletionReport[] {
  const state = getState()
  const visibleWorkOrderIds = new Set(state.workOrders
    .filter((order) => actor.role === '平台主管' || (
      ['花边厂业务员', '花边厂主管'].includes(actor.role) && actor.factoryOrgId === order.factoryOrgId
    ))
    .map((order) => order.workOrderId))
  const reports = state.completionReports
    .filter((report) => visibleWorkOrderIds.has(report.workOrderId))
    .filter((report) => !workOrderId || report.workOrderId === workOrderId)
    .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt))
  return deepClone(reports)
}

export function listLaceHandovers(
  workOrderId?: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LaceHandoverRecord[] {
  const handovers = getState().handovers
    .filter((handover) => {
      if (actor.role === '平台主管') return true
      if (['中央辅料仓管', '中央辅料仓主管'].includes(actor.role)) return handover.toWarehouseId === 'WLS-CENTRAL-ACCESSORY'
      return ['花边厂业务员', '花边厂主管'].includes(actor.role) && actor.factoryOrgId === handover.fromFactoryOrgId
    })
    .filter((handover) => !workOrderId || handover.workOrderId === workOrderId)
    .sort((left, right) => right.handedOverAt.localeCompare(left.handedOverAt))
  return deepClone(handovers)
}

export function listLaceReceipts(workOrderId?: string): LaceReceiptRecord[] {
  const receipts = getState().receipts
    .filter((receipt) => !workOrderId || receipt.workOrderId === workOrderId)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
  return deepClone(receipts)
}

export function listLaceOperationLogs(filter?: { objectId?: string; workOrderId?: string }): LaceOperationLog[] {
  const state = getState()
  const relatedObjectIds = new Set<string>()
  if (filter?.workOrderId) {
    relatedObjectIds.add(filter.workOrderId)
    state.completionReports.filter((item) => item.workOrderId === filter.workOrderId).forEach((item) => relatedObjectIds.add(item.reportId))
    state.handovers.filter((item) => item.workOrderId === filter.workOrderId).forEach((item) => relatedObjectIds.add(item.handoverId))
    state.receipts.filter((item) => item.workOrderId === filter.workOrderId).forEach((item) => relatedObjectIds.add(item.receiptId))
  }
  return deepClone(state.logs
    .filter((log) => !filter?.objectId || log.objectId === filter.objectId || log.relatedObjectId === filter.objectId)
    .filter((log) => !filter?.workOrderId || relatedObjectIds.has(log.objectId) || relatedObjectIds.has(log.relatedObjectId))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)))
}

export function getPurchaseChangeViewStatus(
  purchaseOrderId: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LacePurchaseChangeViewStatus {
  return currentChangeStatus(getState(), purchaseOrderId, actor.actorId)
}

export function countPendingPurchaseChanges(actor: LaceActor = LACE_FACTORY_OPERATOR): number {
  const purchaseOrderIds = new Set(listLacePurchaseDemands(actor).map((demand) => demand.purchaseOrderId))
  return [...purchaseOrderIds].filter((purchaseOrderId) => getPurchaseChangeViewStatus(purchaseOrderId, actor) === '待查看').length
}

export function markPurchaseChangeViewed(purchaseOrderId: string, actor: LaceActor = LACE_FACTORY_OPERATOR): void {
  const state = getState()
  const purchaseOrder = findPurchaseOrder(state, purchaseOrderId)
  const mappedDemand = projectLacePurchaseDemands(state.purchaseOrders).demands
    .find((demand) => demand.purchaseOrderId === purchaseOrderId && demand.factoryOrgId === actor.factoryOrgId)
  if (actor.role !== '平台主管' && (!['花边厂业务员', '花边厂主管'].includes(actor.role) || !mappedDemand)) {
    fail('FORBIDDEN_FACTORY', '当前账号无权查看该花边厂采购变更')
  }
  const latestVersion = purchaseOrder.changeHistory.map((change) => change.toVersion).sort((a, b) => b - a)[0]
  if (!latestVersion) return
  const key = purchaseViewKey(actor.actorId, purchaseOrderId)
  if ((state.viewedPurchaseVersions.get(key) ?? 0) >= latestVersion) return
  state.viewedPurchaseVersions.set(key, latestVersion)
  appendLog(state, {
    objectType: '采购需求',
    objectId: purchaseOrderId,
    action: '查看采购变更',
    beforeValue: `V${latestVersion} 待查看`,
    afterValue: `V${latestVersion} 已查看`,
    reason: '已打开完整采购变更对比；本动作仅表示已查看，不表示审批或接受',
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorRole: actor.role,
    source: sourceForActor(actor),
    relatedObjectType: '采购版本',
    relatedObjectId: `${purchaseOrderId}::V${latestVersion}`,
    relatedPurchaseVersion: latestVersion,
  })
}

export function requiresLaceOverproductionConfirmation(planQty: number, resultingCompletedQty: number): boolean {
  return planQty > 0 && resultingCompletedQty >= roundQty(planQty * 1.5)
}

export function confirmLaceProductionReceipt(workOrderId: string, actor: LaceActor = LACE_FACTORY_OPERATOR): LaceProductionOrderView {
  const state = getState()
  const order = findWorkOrder(state, workOrderId)
  assertFactoryActor(order, actor)
  if (order.status !== '待接收') fail('INVALID_RECEIVE_STATUS', `当前状态为${order.status}，不能确认接收`)
  if (order.inputLines.length === 0 || order.inputLines.some((line) => (
    !line.inputMaterialId.trim()
    || !line.inputMaterialSku.trim()
    || !line.unit.trim()
    || !Number.isFinite(line.unitUsage)
    || line.unitUsage <= 0
  ))) {
    fail('INPUT_REQUIRED', '默认加工投入不完整，不能确认接收；请先由 PMS 补齐投入 SKU 与单位用量并重试自动生成')
  }
  const before = order.status
  order.status = '加工中'
  order.receivedAt = nowIso()
  appendLog(state, {
    objectType: '花边生产单', objectId: order.workOrderId, action: '确认接收', beforeValue: before, afterValue: order.status,
    reason: '默认加工投入完整，已确认接收生产任务',
    actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '采购单', relatedObjectId: order.purchaseOrderId, relatedPurchaseVersion: order.purchaseVersion,
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export interface LaceProcessingInputUpdate {
  currentInputMaterialId: string
  nextInputMaterialId: string
  unitUsage: number
}

export function updateLaceProcessingInputs(
  workOrderId: string,
  updates: LaceProcessingInputUpdate[],
  reason: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LaceProductionOrderView {
  const state = getState()
  const order = findWorkOrder(state, workOrderId)
  assertFactoryActor(order, actor)
  if (!['待接收', '加工中'].includes(order.status)) fail('INPUT_LOCKED', '只有待接收或加工中的生产单可以修改加工投入')
  if (!reason.trim()) fail('REASON_REQUIRED', '修改加工投入必须填写原因')
  if (updates.length !== order.inputLines.length) fail('INPUT_LINE_COUNT_LOCKED', '第一阶段不能新增或删除加工投入行')

  const updatesByCurrentId = new Map(updates.map((update) => [update.currentInputMaterialId, update]))
  if (updatesByCurrentId.size !== order.inputLines.length || order.inputLines.some((line) => !updatesByCurrentId.has(line.inputMaterialId))) {
    fail('INPUT_LINE_MISMATCH', '加工投入行与当前生产单不一致，请刷新后重试')
  }
  const catalogById = new Map(LACE_INPUT_MATERIAL_CATALOG.map((item) => [item.inputMaterialId, item]))
  const nextMaterialIds = updates.map((update) => update.nextInputMaterialId)
  if (new Set(nextMaterialIds).size !== nextMaterialIds.length) fail('DUPLICATE_INPUT_LINE', '同一投入 SKU 不能重复保存')
  updates.forEach((update) => {
    if (!catalogById.has(update.nextInputMaterialId)) fail('INPUT_MATERIAL_NOT_FOUND', '选择的投入 SKU 不存在于物料档案')
    if (!Number.isFinite(update.unitUsage) || update.unitUsage <= 0) fail('INVALID_UNIT_USAGE', '单位用量必须大于 0')
  })

  const formatInput = (line: LaceProcessingInputLine) => `${line.inputMaterialSku}：${line.unitUsage} ${line.unit}/${order.unit}＝${line.plannedQty} ${line.unit}`
  const before = order.inputLines.map(formatInput).join('；')
  order.inputLines = order.inputLines.map((line) => {
    const update = updatesByCurrentId.get(line.inputMaterialId)!
    const material = catalogById.get(update.nextInputMaterialId)!
    const unitUsage = roundUnitUsage(update.unitUsage)
    return {
      ...deepClone(material),
      unitUsage,
      plannedQty: plannedInputQty(order.planQty, unitUsage),
    }
  })
  appendLog(state, {
    objectType: '花边生产单',
    objectId: order.workOrderId,
    action: '修改加工投入',
    beforeValue: before,
    afterValue: order.inputLines.map(formatInput).join('；'),
    reason: reason.trim(),
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorRole: actor.role,
    source: sourceForActor(actor),
    relatedObjectType: '采购单',
    relatedObjectId: order.purchaseOrderId,
    relatedPurchaseVersion: order.purchaseVersion,
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export interface CreateLaceCompletionCommand {
  workOrderId: string
  qty: number
  reportedAt?: string
  note?: string
  clientActionId: string
  overproductionConfirmed?: boolean
  actor?: LaceActor
}

export function createLaceCompletionReport(command: CreateLaceCompletionCommand): LaceCompletionReport {
  const state = getState()
  const existing = state.completionReports.find((report) => report.clientActionId === command.clientActionId)
  if (existing) return deepClone(existing)
  const actor = command.actor ?? LACE_FACTORY_OPERATOR
  const order = findWorkOrder(state, command.workOrderId)
  assertFactoryActor(order, actor)
  if (order.status !== '加工中') fail('REPORT_STATUS_LOCKED', '只有加工中的花边生产单可以新增加工填报')
  if (!Number.isFinite(command.qty) || command.qty <= 0) fail('INVALID_REPORT_QTY', '完工数量必须大于 0')
  const beforeQty = completedQtyForState(state, order.workOrderId)
  const afterQty = roundQty(beforeQty + command.qty)
  const overproductionConfirmationRequired = requiresLaceOverproductionConfirmation(order.planQty, afterQty)
  if (overproductionConfirmationRequired && !command.overproductionConfirmed) {
    fail('OVERPRODUCTION_CONFIRM_REQUIRED', `提交后累计完工 ${afterQty} ${order.unit}，达到计划 ${order.planQty} ${order.unit} 的 1.5 倍，请二次确认`)
  }
  state.sequence.report += 1
  const report: LaceCompletionReport = {
    reportId: `LACE-REPORT-${String(state.sequence.report).padStart(4, '0')}`,
    workOrderId: order.workOrderId,
    qty: roundQty(command.qty),
    unit: order.unit,
    reportedAt: normalizeEventTime(command.reportedAt, '加工填报时间'),
    reporterId: actor.actorId,
    reporterName: actor.actorName,
    note: command.note?.trim() || '',
    clientActionId: command.clientActionId,
    revisions: [],
  }
  state.completionReports.push(report)
  state.actionIds.add(command.clientActionId)
  appendLog(state, {
    objectType: '加工填报', objectId: report.reportId, action: '加工填报', beforeValue: `${beforeQty} ${order.unit}`,
    afterValue: `${afterQty} ${order.unit}`, reason: `${report.note || `本次完工 ${report.qty} ${order.unit}`}${overproductionConfirmationRequired ? '；已完成 1.5 倍超量二次确认' : ''}`,
    actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '花边生产单', relatedObjectId: order.workOrderId,
    relatedPurchaseVersion: order.purchaseVersion,
    secondConfirmation: overproductionConfirmationRequired ? '已确认' : '不适用',
  })
  return deepClone(report)
}

export interface UpdateLaceCompletionCommand {
  reportId: string
  qty: number
  reason: string
  overproductionConfirmed?: boolean
  actor?: LaceActor
}

export function updateLaceCompletionReport(command: UpdateLaceCompletionCommand): LaceCompletionReport {
  const state = getState()
  const report = state.completionReports.find((item) => item.reportId === command.reportId)
  if (!report) fail('REPORT_NOT_FOUND', '加工填报记录不存在')
  const actor = command.actor ?? LACE_FACTORY_OPERATOR
  const order = findWorkOrder(state, report.workOrderId)
  assertFactoryActor(order, actor)
  if (order.status !== '加工中') fail('REPORT_STATUS_LOCKED', '只有加工中的花边生产单可以修改加工填报')
  if (!command.reason.trim()) fail('REASON_REQUIRED', '修改加工填报必须填写原因')
  if (!Number.isFinite(command.qty) || command.qty <= 0) fail('INVALID_REPORT_QTY', '完工数量必须大于 0')
  const currentTotal = completedQtyForState(state, order.workOrderId)
  const nextTotal = roundQty(currentTotal - report.qty + command.qty)
  const handedOverQty = handedOverQtyForState(state, order.workOrderId)
  if (nextTotal < handedOverQty) fail('COMPLETION_BELOW_HANDOVER', `修改后累计完工不能小于已交出 ${handedOverQty} ${order.unit}`)
  const overproductionConfirmationRequired = requiresLaceOverproductionConfirmation(order.planQty, nextTotal)
  if (overproductionConfirmationRequired && !command.overproductionConfirmed) {
    fail('OVERPRODUCTION_CONFIRM_REQUIRED', `修改后累计完工 ${nextTotal} ${order.unit}，达到计划的 1.5 倍，请二次确认`)
  }
  const previousQty = report.qty
  report.qty = roundQty(command.qty)
  report.revisions.push({
    previousQty,
    revisedQty: report.qty,
    reason: command.reason.trim(),
    revisedAt: nowIso(),
    revisedById: actor.actorId,
    revisedByName: actor.actorName,
  })
  appendLog(state, {
    objectType: '加工填报', objectId: report.reportId, action: '修改加工填报', beforeValue: `${previousQty} ${order.unit}`,
    afterValue: `${report.qty} ${order.unit}`, reason: `${command.reason.trim()}${overproductionConfirmationRequired ? '；已完成 1.5 倍超量二次确认' : ''}`, actorId: actor.actorId, actorName: actor.actorName,
    actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '花边生产单', relatedObjectId: order.workOrderId,
    relatedPurchaseVersion: order.purchaseVersion,
    secondConfirmation: overproductionConfirmationRequired ? '已确认' : '不适用',
  })
  return deepClone(report)
}

export function completeLaceProduction(
  workOrderId: string,
  reason: string,
  actor: LaceActor = LACE_FACTORY_OPERATOR,
): LaceProductionOrderView {
  const state = getState()
  const order = findWorkOrder(state, workOrderId)
  assertFactoryActor(order, actor)
  if (order.status !== '加工中') fail('INVALID_COMPLETE_STATUS', '只有加工中的花边生产单可以完成加工单')
  const before = order.status
  order.status = '已完结'
  order.completedAt = nowIso()
  appendLog(state, {
    objectType: '花边生产单', objectId: order.workOrderId, action: '完成加工单', beforeValue: before, afterValue: order.status,
    reason: reason.trim() || `累计完工 ${completedQtyForState(state, order.workOrderId)} ${order.unit}`, actorId: actor.actorId,
    actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '采购单', relatedObjectId: order.purchaseOrderId, relatedPurchaseVersion: order.purchaseVersion,
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export function undoLaceProductionCompletion(
  workOrderId: string,
  reason: string,
  actor: LaceActor = LACE_FACTORY_SUPERVISOR,
): LaceProductionOrderView {
  const state = getState()
  const order = findWorkOrder(state, workOrderId)
  assertFactoryActor(order, actor)
  if (actor.role !== '花边厂主管' && actor.role !== '平台主管') fail('SUPERVISOR_REQUIRED', '撤销完成只能由花边厂主管处理')
  if (order.status !== '已完结') fail('INVALID_UNDO_COMPLETE_STATUS', '只有已完结生产单可以撤销完成')
  if (!reason.trim()) fail('REASON_REQUIRED', '撤销完成必须填写原因')
  order.status = '加工中'
  order.completedAt = undefined
  appendLog(state, {
    objectType: '花边生产单', objectId: order.workOrderId, action: '撤销完成', beforeValue: '已完结', afterValue: '加工中',
    reason: reason.trim(), actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '采购单', relatedObjectId: order.purchaseOrderId, relatedPurchaseVersion: order.purchaseVersion,
    secondConfirmation: '已确认',
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export function cancelLaceProductionOrder(input: {
  workOrderId: string
  reason: string
  actor?: LaceActor
  secondConfirmed?: boolean
}): LaceProductionOrderView {
  const state = getState()
  const actor = input.actor ?? LACE_FACTORY_SUPERVISOR
  const order = findWorkOrder(state, input.workOrderId)
  assertFactoryActor(order, actor)
  if (actor.role !== '花边厂主管' && actor.role !== '平台主管') fail('SUPERVISOR_REQUIRED', '取消生产单只能由花边厂主管处理')
  if (order.status === '已取消') return toWorkOrderView(state, order, actor.actorId)
  if (!input.reason.trim()) fail('REASON_REQUIRED', '取消生产单必须填写原因')
  if (state.handovers.some((handover) => handover.workOrderId === order.workOrderId)) {
    fail('DOWNSTREAM_FACT_EXISTS', '该生产单已有交出或收货事实，第一阶段不能直接取消')
  }
  if (order.status !== '待接收') {
    if (!input.secondConfirmed) fail('CANCEL_CONFIRM_REQUIRED', '已进入加工，取消前必须二次确认')
  }
  const before = order.status
  order.statusBeforeCancellation = before
  order.status = '已取消'
  order.cancelledAt = nowIso()
  appendLog(state, {
    objectType: '花边生产单', objectId: order.workOrderId, action: '取消生产单', beforeValue: before, afterValue: order.status,
    reason: input.reason.trim(), actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '采购单', relatedObjectId: order.purchaseOrderId, relatedPurchaseVersion: order.purchaseVersion,
    secondConfirmation: before === '待接收' ? '不适用' : '已确认',
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export function restoreCancelledLaceProductionOrder(
  workOrderId: string,
  reason: string,
  actor: LaceActor = PLATFORM_ADMIN,
): LaceProductionOrderView {
  const state = getState()
  const order = findWorkOrder(state, workOrderId)
  if (actor.role !== '平台主管') fail('PLATFORM_ADMIN_REQUIRED', '误取消恢复只能由平台主管处理')
  if (order.status !== '已取消') fail('NOT_CANCELLED', '该生产单不是已取消状态')
  if (!reason.trim()) fail('REASON_REQUIRED', '恢复生产单必须填写原因')
  const purchaseOrder = findPurchaseOrder(state, order.purchaseOrderId)
  if (purchaseOrder.status !== '有效') fail('PURCHASE_NOT_ACTIVE', '采购单已取消或作废，不能恢复花边生产单')
  if (state.handovers.some((handover) => handover.workOrderId === order.workOrderId)) {
    fail('DOWNSTREAM_FACT_EXISTS', '该生产单已有交出或收货事实，不能执行误取消恢复')
  }
  const restoredStatus = order.statusBeforeCancellation ?? '待接收'
  order.status = restoredStatus
  order.statusBeforeCancellation = undefined
  order.cancelledAt = undefined
  appendLog(state, {
    objectType: '花边生产单', objectId: order.workOrderId, action: '恢复误取消生产单', beforeValue: '已取消', afterValue: restoredStatus,
    reason: reason.trim(), actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: 'PFOS',
    relatedObjectType: '采购单', relatedObjectId: order.purchaseOrderId, relatedPurchaseVersion: order.purchaseVersion,
    secondConfirmation: '已确认',
  })
  return toWorkOrderView(state, order, actor.actorId)
}

export interface CreateLaceHandoverCommand {
  workOrderId: string
  qty: number
  deliveryNo: string
  packageCount: number
  packageNote: string
  expectedReceiverName: string
  handedOverAt?: string
  clientActionId: string
  actor?: LaceActor
}

export function createLaceHandover(command: CreateLaceHandoverCommand): LaceHandoverRecord {
  const state = getState()
  const existing = state.handovers.find((handover) => handover.clientActionId === command.clientActionId)
  if (existing) return deepClone(existing)
  const actor = command.actor ?? LACE_FACTORY_OPERATOR
  const order = findWorkOrder(state, command.workOrderId)
  assertFactoryActor(order, actor)
  if (!['加工中', '已完结'].includes(order.status)) fail('HANDOVER_STATUS_BLOCKED', '只有加工中或已完结的生产单可以交出')
  const completedQty = completedQtyForState(state, order.workOrderId)
  const handedOverQty = handedOverQtyForState(state, order.workOrderId)
  const remainingQty = roundQty(completedQty - handedOverQty)
  if (!Number.isFinite(command.qty) || command.qty <= 0) fail('INVALID_HANDOVER_QTY', '本次交出数量必须大于 0')
  if (command.qty > remainingQty) fail('HANDOVER_EXCEEDS_REMAINING', `本次交出不能超过剩余可交出 ${remainingQty} ${order.unit}`)
  if (!command.deliveryNo.trim() || !command.expectedReceiverName.trim() || !Number.isInteger(command.packageCount) || !(command.packageCount > 0)) {
    fail('HANDOVER_FIELDS_REQUIRED', '请填写送货单号、包装数量和预计接收方')
  }
  const handedOverAt = normalizeEventTime(command.handedOverAt, '交出时间')

  state.sequence.handover += 1
  const handover: LaceHandoverRecord = {
    handoverId: `LACE-HANDOVER-${String(state.sequence.handover).padStart(4, '0')}`,
    handoverNo: `HBJC-260808-${String(state.sequence.handover).padStart(3, '0')}`,
    workOrderId: order.workOrderId,
    workOrderNo: order.workOrderNo,
    purchaseOrderId: order.purchaseOrderId,
    purchaseOrderNo: order.purchaseOrderNo,
    skuId: order.skuId,
    skuCode: order.skuCode,
    materialName: order.materialName,
    materialImageUrl: order.materialImageUrl,
    styleName: order.styleName,
    styleCode: order.styleCode,
    styleImageUrl: order.styleImageUrl,
    sourceLines: deepClone(order.sourceLines),
    qty: roundQty(command.qty),
    unit: order.unit,
    cumulativeBefore: handedOverQty,
    cumulativeAfter: roundQty(handedOverQty + command.qty),
    fromFactoryOrgId: order.factoryOrgId,
    fromFactoryName: order.factoryName,
    toWarehouseId: order.targetWarehouseId,
    toWarehouseName: order.targetWarehouseName,
    deliveryNo: command.deliveryNo.trim(),
    packageCount: command.packageCount,
    packageNote: command.packageNote.trim(),
    handedOverById: actor.actorId,
    handedOverByName: actor.actorName,
    expectedReceiverName: command.expectedReceiverName.trim(),
    handedOverAt,
    receiptStatus: '待收货',
    clientActionId: command.clientActionId,
  }
  state.handovers.push(handover)
  state.actionIds.add(command.clientActionId)
  appendLog(state, {
    objectType: '交出记录', objectId: handover.handoverId, action: '发起交出', beforeValue: `${handover.cumulativeBefore} ${order.unit}`,
    afterValue: `${handover.cumulativeAfter} ${order.unit}`, reason: `本次交出 ${handover.qty} ${order.unit}，同步生成 WLS 待收货`,
    actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '花边生产单', relatedObjectId: order.workOrderId, relatedPurchaseVersion: order.purchaseVersion,
  })
  return deepClone(handover)
}

export interface ConfirmLaceReceiptCommand {
  handoverId: string
  actualQty: number
  differenceReason: string
  evidence: string
  warehouseLocation: string
  receivedAt?: string
  clientActionId: string
  overReceiptConfirmed?: boolean
  actor?: LaceActor
}

export function confirmLaceReceipt(command: ConfirmLaceReceiptCommand): LaceReceiptRecord {
  const state = getState()
  const existingByAction = state.receipts.find((receipt) => receipt.clientActionId === command.clientActionId)
  if (existingByAction) return deepClone(existingByAction)
  const handover = state.handovers.find((item) => item.handoverId === command.handoverId)
  if (!handover) fail('HANDOVER_NOT_FOUND', '交出记录不存在')
  const workOrder = findWorkOrder(state, handover.workOrderId)
  const existingReceipt = state.receipts.find((receipt) => receipt.handoverId === handover.handoverId)
  if (existingReceipt || handover.receiptStatus === '已收货') fail('RECEIPT_ALREADY_CONFIRMED', '该交出记录已经完成最终收货确认')
  const actor = command.actor ?? WLS_ACCESSORY_CLERK
  if (!['中央辅料仓管', '中央辅料仓主管', '平台主管'].includes(actor.role)) fail('WLS_ROLE_REQUIRED', '只有中央辅料仓人员可以确认收货')
  if (!Number.isFinite(command.actualQty) || command.actualQty < 0) fail('INVALID_RECEIPT_QTY', '实际收货数量不能小于 0')
  if (!command.warehouseLocation.trim()) fail('WAREHOUSE_LOCATION_REQUIRED', '请填写实际入库库区')
  if (command.actualQty !== handover.qty && !command.differenceReason.trim()) fail('DIFFERENCE_REASON_REQUIRED', '实际收货与交出不一致时必须填写差异原因')
  if (command.actualQty > handover.qty) {
    if (!command.overReceiptConfirmed) fail('OVER_RECEIPT_CONFIRM_REQUIRED', '实际收货大于交出数量，需要仓库主管二次确认')
    if (actor.role !== '中央辅料仓主管' && actor.role !== '平台主管') fail('WLS_SUPERVISOR_REQUIRED', '多收必须由中央辅料仓主管确认')
    if (!command.evidence.trim()) fail('EVIDENCE_REQUIRED', '多收必须填写或上传收货凭证')
  }
  const receivedAt = normalizeEventTime(command.receivedAt, '收货时间')
  if (Date.parse(receivedAt) < Date.parse(handover.handedOverAt)) fail('RECEIPT_BEFORE_HANDOVER', '收货时间不能早于交出时间')
  const purchaseReceivedBefore = roundQty(state.receipts
    .filter((receipt) => receipt.purchaseOrderId === handover.purchaseOrderId && receipt.skuId === handover.skuId)
    .reduce((sum, receipt) => sum + receipt.actualQty, 0))
  state.sequence.receipt += 1
  const receipt: LaceReceiptRecord = {
    receiptId: `LACE-RECEIPT-${String(state.sequence.receipt).padStart(4, '0')}`,
    handoverId: handover.handoverId,
    workOrderId: handover.workOrderId,
    purchaseOrderId: handover.purchaseOrderId,
    skuId: handover.skuId,
    actualQty: roundQty(command.actualQty),
    unit: handover.unit,
    warehouseId: handover.toWarehouseId,
    warehouseName: handover.toWarehouseName,
    warehouseLocation: command.warehouseLocation.trim(),
    receivedById: actor.actorId,
    receivedByName: actor.actorName,
    receivedAt,
    differenceReason: command.differenceReason.trim(),
    evidence: command.evidence.trim(),
    overReceiptConfirmedById: command.actualQty > handover.qty ? actor.actorId : undefined,
    overReceiptConfirmedByName: command.actualQty > handover.qty ? actor.actorName : undefined,
    clientActionId: command.clientActionId,
  }
  state.receipts.push(receipt)
  handover.receiptStatus = '已收货'
  state.actionIds.add(command.clientActionId)
  appendLog(state, {
    objectType: '收货记录', objectId: receipt.receiptId, action: '确认实际收货', beforeValue: `交出 ${handover.qty} ${handover.unit}`,
    afterValue: `实收 ${receipt.actualQty} ${receipt.unit}`, reason: `${receipt.differenceReason || '交出与实收一致'}${command.actualQty > handover.qty ? '；仓库主管已完成多收二次确认' : ''}`, actorId: actor.actorId,
    actorName: actor.actorName, actorRole: actor.role, source: sourceForActor(actor),
    relatedObjectType: '交出记录', relatedObjectId: handover.handoverId,
    relatedPurchaseVersion: workOrder.purchaseVersion,
    secondConfirmation: command.actualQty > handover.qty ? '已确认' : '不适用',
  })
  appendLog(state, {
    objectType: '采购单', objectId: handover.purchaseOrderId, action: '回写采购 SKU 实收', beforeValue: `${purchaseReceivedBefore} ${handover.unit}`,
    afterValue: `${roundQty(purchaseReceivedBefore + receipt.actualQty)} ${handover.unit}`, reason: `来源收货记录 ${receipt.receiptId}，SKU ${handover.skuCode}`,
    actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: 'WLS',
    relatedObjectType: '收货记录', relatedObjectId: receipt.receiptId,
    relatedPurchaseVersion: workOrder.purchaseVersion,
  })
  return deepClone(receipt)
}

export function getPurchaseSkuReceivedQty(purchaseOrderId: string, skuId: string): number {
  return roundQty(getState().receipts
    .filter((receipt) => receipt.purchaseOrderId === purchaseOrderId && receipt.skuId === skuId)
    .reduce((sum, receipt) => sum + receipt.actualQty, 0))
}

export interface PurchaseCancellationCheck {
  allowed: boolean
  blockers: Array<Pick<LaceProductionOrderView, 'workOrderId' | 'workOrderNo' | 'skuCode' | 'status' | 'completedQty' | 'handedOverQty' | 'unit'>>
}

export function checkPurchaseOrderCancellation(purchaseOrderId: string): PurchaseCancellationCheck {
  const state = getState()
  findPurchaseOrder(state, purchaseOrderId)
  const blockers = state.workOrders
    .filter((order) => order.purchaseOrderId === purchaseOrderId && ['加工中', '已完结'].includes(order.status))
    .map((order) => {
      const view = toWorkOrderView(state, order, PLATFORM_ADMIN.actorId)
      return {
        workOrderId: view.workOrderId,
        workOrderNo: view.workOrderNo,
        skuCode: view.skuCode,
        status: view.status,
        completedQty: view.completedQty,
        handedOverQty: view.handedOverQty,
        unit: view.unit,
      }
    })
  return { allowed: blockers.length === 0, blockers }
}

export function recordPurchaseCancellationAttempt(
  purchaseOrderId: string,
  actor: LaceActor = PMS_BUYER,
): PurchaseCancellationCheck {
  const state = getState()
  if (actor.role !== 'PMS采购员' && actor.role !== '平台主管') fail('PMS_ROLE_REQUIRED', '只有采购人员可以取消采购单')
  const check = checkPurchaseOrderCancellation(purchaseOrderId)
  const purchaseOrder = findPurchaseOrder(state, purchaseOrderId)
  if (!check.allowed) {
    appendLog(state, {
      objectType: '采购单', objectId: purchaseOrderId, action: '采购取消被生产门禁阻断', beforeValue: '准备取消',
      afterValue: '未取消', reason: check.blockers.map((item) => `${item.workOrderNo} ${item.status}`).join('、'),
      actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: 'PMS',
      relatedObjectType: '采购版本', relatedObjectId: `${purchaseOrderId}::V${purchaseOrder.version}`,
      relatedPurchaseVersion: purchaseOrder.version,
    })
  }
  return check
}

export function cancelPurchaseOrder(input: {
  purchaseOrderId: string
  reason: string
  clientActionId: string
  actor?: LaceActor
}): AccessoryPurchaseOrder {
  const state = getState()
  const actor = input.actor ?? PMS_BUYER
  if (actor.role !== 'PMS采购员' && actor.role !== '平台主管') fail('PMS_ROLE_REQUIRED', '只有采购人员可以取消采购单')
  const purchaseOrder = findPurchaseOrder(state, input.purchaseOrderId)
  if (purchaseOrder.status === '已取消') return deepClone(purchaseOrder)
  if (state.actionIds.has(input.clientActionId)) return deepClone(purchaseOrder)
  if (!input.reason.trim()) fail('REASON_REQUIRED', '取消采购单必须填写原因')
  const check = checkPurchaseOrderCancellation(input.purchaseOrderId)
  if (!check.allowed) {
    appendLog(state, {
      objectType: '采购单', objectId: input.purchaseOrderId, action: '采购取消被生产门禁阻断', beforeValue: '准备取消',
      afterValue: '未取消', reason: check.blockers.map((item) => `${item.workOrderNo} ${item.status}`).join('、'),
      actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: 'PMS',
      relatedObjectType: '采购版本', relatedObjectId: `${purchaseOrder.purchaseOrderId}::V${purchaseOrder.version}`,
      relatedPurchaseVersion: purchaseOrder.version,
    })
    fail('PURCHASE_CANCEL_BLOCKED', '关联生产单已进入加工，请先按规则取消对应生产单')
  }
  const beforeVersion = purchaseOrder.version
  purchaseOrder.version += 1
  purchaseOrder.status = '已取消'
  state.sequence.purchaseChange += 1
  purchaseOrder.changeHistory.push({
    changeId: `POCHG-${purchaseOrder.purchaseOrderNo}-V${purchaseOrder.version}`,
    fromVersion: beforeVersion,
    toVersion: purchaseOrder.version,
    changedById: actor.actorId,
    changedByName: actor.actorName,
    changedAt: nowIso(),
    fields: [{ field: '采购状态', label: '采购状态', beforeValue: '有效', afterValue: '已取消' }],
  })
  state.workOrders
    .filter((order) => order.purchaseOrderId === purchaseOrder.purchaseOrderId && order.status === '待接收')
    .forEach((order) => {
      order.statusBeforeCancellation = '待接收'
      order.status = '已取消'
      order.cancelledAt = nowIso()
      appendLog(state, {
        objectType: '花边生产单', objectId: order.workOrderId, action: '采购取消同步取消生产单', beforeValue: '待接收', afterValue: '已取消',
        reason: input.reason.trim(), actorId: actor.actorId, actorName: actor.actorName, actorRole: actor.role, source: 'PMS',
        relatedObjectType: '采购单', relatedObjectId: purchaseOrder.purchaseOrderId, relatedPurchaseVersion: purchaseOrder.version,
      })
    })
  appendLog(state, {
    objectType: '采购单', objectId: purchaseOrder.purchaseOrderId, action: '取消采购单', beforeValue: `有效 V${beforeVersion}`,
    afterValue: `已取消 V${purchaseOrder.version}`, reason: input.reason.trim(), actorId: actor.actorId, actorName: actor.actorName,
    actorRole: actor.role, source: 'PMS',
    relatedObjectType: '采购版本', relatedObjectId: `${purchaseOrder.purchaseOrderId}::V${purchaseOrder.version}`,
    relatedPurchaseVersion: purchaseOrder.version,
    secondConfirmation: '已确认',
  })
  state.actionIds.add(input.clientActionId)
  return deepClone(purchaseOrder)
}

export interface UpdatePurchaseOrderPatch {
  quantityBySku?: Record<string, number>
  plannedInputsBySku?: Record<string, LacePlannedInputMaterial[]>
  dueDate?: string
  targetWarehouseId?: string
  targetWarehouseName?: string
  note?: string
}

export function updatePurchaseOrder(
  purchaseOrderId: string,
  patch: UpdatePurchaseOrderPatch,
  clientActionId: string,
  actor: LaceActor = PMS_BUYER,
): AccessoryPurchaseOrder {
  const state = getState()
  if (actor.role !== 'PMS采购员' && actor.role !== '平台主管') fail('PMS_ROLE_REQUIRED', '只有采购人员可以变更采购单')
  const currentPurchaseOrder = findPurchaseOrder(state, purchaseOrderId)
  if (currentPurchaseOrder.status !== '有效') fail('PURCHASE_NOT_ACTIVE', '只有有效采购单可以变更')
  if (state.actionIds.has(clientActionId)) return deepClone(currentPurchaseOrder)
  const purchaseOrder = deepClone(currentPurchaseOrder)
  const fields: LacePurchaseChangeField[] = []

  for (const [skuId, requestedQty] of Object.entries(patch.quantityBySku ?? {})) {
    const lines = purchaseOrder.lines.filter((line) => line.skuId === skuId)
    if (lines.length === 0) fail('PURCHASE_SKU_NOT_FOUND', `采购单中不存在 SKU ${skuId}`)
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) fail('INVALID_PURCHASE_QTY', '采购数量必须大于 0')
    const beforeQty = roundQty(lines.reduce((sum, line) => sum + line.orderedQty, 0))
    const nextQty = roundQty(requestedQty)
    if (nextQty <= 0) fail('INVALID_PURCHASE_QTY', '采购数量按业务精度取值后必须大于 0')
    if (beforeQty === nextQty) continue
    let allocatedQty = 0
    lines.forEach((line, index) => {
      if (index === lines.length - 1) {
        line.orderedQty = roundQty(nextQty - allocatedQty)
        return
      }
      line.orderedQty = roundQty(beforeQty > 0 ? nextQty * (line.orderedQty / beforeQty) : nextQty / lines.length)
      allocatedQty = roundQty(allocatedQty + line.orderedQty)
    })
    fields.push({
      field: '采购数量', label: `${lines[0].materialName}采购数量`, skuId,
      beforeValue: `${beforeQty} ${lines[0].unit}`, afterValue: `${nextQty} ${lines[0].unit}`,
    })
  }

  for (const [skuId, requestedInputs] of Object.entries(patch.plannedInputsBySku ?? {})) {
    const lines = purchaseOrder.lines.filter((line) => line.skuId === skuId)
    if (lines.length === 0) fail('PURCHASE_SKU_NOT_FOUND', `采购单中不存在 SKU ${skuId}`)
    if (requestedInputs.length === 0) fail('INPUT_REQUIRED', '默认加工投入至少需要一行')
    const uniqueIds = new Set<string>()
    requestedInputs.forEach((input) => {
      if (uniqueIds.has(input.inputMaterialId)) fail('DUPLICATE_INPUT_LINE', '默认加工投入不能包含重复 SKU')
      uniqueIds.add(input.inputMaterialId)
      const identity = [input.inputMaterialId, input.inputMaterialSku, input.inputMaterialName, input.specification, input.color, input.imageUrl, input.unit]
      if (identity.some((value) => !value.trim())) fail('INPUT_IDENTITY_REQUIRED', '默认加工投入的 SKU、名称、规格、颜色、图片和单位必须完整')
      if (!Number.isFinite(input.unitUsage) || input.unitUsage <= 0) fail('INVALID_UNIT_USAGE', '默认加工投入单位用量必须大于 0')
    })
    const signature = (inputs: LacePlannedInputMaterial[] | undefined) => (inputs ?? [])
      .map((input) => `${input.inputMaterialSku}:${input.unitUsage} ${input.unit}/${lines[0].unit}`)
      .sort()
      .join('；') || '未维护'
    const before = signature(lines[0].plannedInputs)
    const normalizedInputs = requestedInputs.map((input) => ({ ...deepClone(input), unitUsage: roundUnitUsage(input.unitUsage) }))
    const after = signature(normalizedInputs)
    if (before === after && lines.every((line) => signature(line.plannedInputs) === after)) continue
    lines.forEach((line) => { line.plannedInputs = deepClone(normalizedInputs) })
    fields.push({ field: '默认加工投入', label: `${lines[0].materialName}默认加工投入`, skuId, beforeValue: before, afterValue: after })
  }

  if (patch.dueDate !== undefined) {
    const dueDate = patch.dueDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) {
      fail('INVALID_PURCHASE_DUE_DATE', '采购交期必须是有效日期')
    }
    if (purchaseOrder.lines.some((line) => line.dueDate !== dueDate)) {
    const before = [...new Set(purchaseOrder.lines.map((line) => line.dueDate))].join('、')
      purchaseOrder.lines.forEach((line) => { line.dueDate = dueDate })
      fields.push({ field: '交期', label: '计划到货日期', beforeValue: before, afterValue: dueDate })
    }
  }
  if (patch.targetWarehouseId !== undefined || patch.targetWarehouseName !== undefined) {
    const targetWarehouseId = patch.targetWarehouseId?.trim() ?? ''
    const targetWarehouseName = patch.targetWarehouseName?.trim() ?? ''
    if (!targetWarehouseId || !targetWarehouseName) fail('INVALID_TARGET_WAREHOUSE', '目标仓库编号和名称必须同时完整')
    if (purchaseOrder.lines.some((line) => line.targetWarehouseId !== targetWarehouseId || line.targetWarehouseName !== targetWarehouseName)) {
      const before = [...new Set(purchaseOrder.lines.map((line) => line.targetWarehouseName || '未指定'))].join('、')
      purchaseOrder.lines.forEach((line) => {
        line.targetWarehouseId = targetWarehouseId
        line.targetWarehouseName = targetWarehouseName
      })
      fields.push({ field: '目标仓库', label: '目标仓库', beforeValue: before, afterValue: targetWarehouseName })
    }
  }
  if (patch.note !== undefined) {
    const note = patch.note.trim()
    if (purchaseOrder.lines.some((line) => line.note !== note)) {
      const before = [...new Set(purchaseOrder.lines.map((line) => line.note).filter(Boolean))].join('；') || '无'
      purchaseOrder.lines.forEach((line) => { line.note = note })
      fields.push({ field: '备注', label: '采购备注', beforeValue: before, afterValue: note || '无' })
    }
  }
  if (fields.length === 0) fail('NO_PURCHASE_CHANGE', '没有需要保存的采购变更')

  const fromVersion = purchaseOrder.version
  purchaseOrder.version += 1
  state.sequence.purchaseChange += 1
  purchaseOrder.changeHistory.push({
    changeId: `POCHG-${purchaseOrder.purchaseOrderNo}-V${purchaseOrder.version}`,
    fromVersion,
    toVersion: purchaseOrder.version,
    changedById: actor.actorId,
    changedByName: actor.actorName,
    changedAt: nowIso(),
    fields,
  })
  const purchaseOrderIndex = state.purchaseOrders.findIndex((item) => item.purchaseOrderId === purchaseOrderId)
  state.purchaseOrders[purchaseOrderIndex] = purchaseOrder
  appendLog(state, {
    objectType: '采购单', objectId: purchaseOrder.purchaseOrderId, action: '变更采购单', beforeValue: `V${fromVersion}`,
    afterValue: `V${purchaseOrder.version}`, reason: fields.map((field) => field.label).join('、'), actorId: actor.actorId,
    actorName: actor.actorName, actorRole: actor.role, source: 'PMS',
    relatedObjectType: '采购版本', relatedObjectId: `${purchaseOrder.purchaseOrderId}::V${purchaseOrder.version}`,
    relatedPurchaseVersion: purchaseOrder.version,
  })
  state.actionIds.add(clientActionId)
  syncLaceProductionOrders()
  return deepClone(purchaseOrder)
}

export function validateCriticalPurchaseChange(
  purchaseOrderId: string,
  field: 'SKU' | '供应商／工厂' | '单位',
): { allowed: boolean; reason: string } {
  const state = getState()
  findPurchaseOrder(state, purchaseOrderId)
  const startedOrders = state.workOrders.filter((order) => order.purchaseOrderId === purchaseOrderId && ['加工中', '已完结'].includes(order.status))
  if (startedOrders.length > 0) {
    return {
      allowed: false,
      reason: `${field}属于关键身份字段，关联生产单 ${startedOrders.map((order) => order.workOrderNo).join('、')} 已进入加工，必须先取消生产单`,
    }
  }
  return { allowed: true, reason: `${field}变更前需重新校验并按唯一键安全重建待接收生产单` }
}

export function getLaceRuntimeEvidenceSnapshot(): {
  purchaseOrders: AccessoryPurchaseOrder[]
  demands: LacePurchaseDemand[]
  failures: LacePurchaseProjectionFailure[]
  workOrders: LaceProductionOrderView[]
  completionReports: LaceCompletionReport[]
  handovers: LaceHandoverRecord[]
  receipts: LaceReceiptRecord[]
  logs: LaceOperationLog[]
  factoryMappings: typeof ACCESSORY_FACTORY_MAPPINGS
} {
  const state = getState()
  const projection = projectLacePurchaseDemands(state.purchaseOrders)
  return {
    purchaseOrders: deepClone(state.purchaseOrders),
    demands: deepClone(projection.demands),
    failures: deepClone(projection.failures),
    workOrders: listLaceProductionOrders(PLATFORM_ADMIN),
    completionReports: deepClone(state.completionReports),
    handovers: deepClone(state.handovers),
    receipts: deepClone(state.receipts),
    logs: deepClone(state.logs),
    factoryMappings: ACCESSORY_FACTORY_MAPPINGS,
  }
}
