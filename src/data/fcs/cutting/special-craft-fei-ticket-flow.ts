import { mockFactories } from '../factory-mock-data.ts'
import type {
  FactoryInternalWarehouse,
  FactoryWaitHandoverStockItem,
  FactoryWaitProcessStockItem,
  FactoryWarehouseInboundRecord,
  FactoryWarehouseOutboundRecord,
} from '../factory-internal-warehouse.ts'
import {
  findFactoryInternalWarehouseByFactoryAndKind,
  findFactoryWaitHandoverStockItemByHandoverRecordId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
  upsertFactoryWaitHandoverStockItem,
  upsertFactoryWarehouseInboundRecord,
} from '../factory-internal-warehouse.ts'
import {
  linkPickupConfirmToInboundRecord,
  linkTaskCompletionToWaitHandoverStock,
  linkHandoverRecordToOutboundRecord,
  syncQuantityObjectionToOutboundRecord,
  syncReceiverWritebackToOutboundRecord,
} from '../factory-warehouse-linkage.ts'
import type { SpecialCraftTaskDemandLine, SpecialCraftTaskOrder } from '../special-craft-task-orders.ts'
import {
  getSpecialCraftTaskWorkOrderLineByDemandLineId,
  getSpecialCraftTaskWorkOrdersByTaskOrderId,
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
} from '../special-craft-task-orders.ts'
import type { SpecialCraftOperationDefinition } from '../special-craft-operations.ts'
import {
  getSpecialCraftOperationById,
  listEnabledSpecialCraftOperationDefinitions,
} from '../special-craft-operations.ts'
import type { GeneratedFeiTicketSourceRecord } from './generated-fei-tickets.ts'
import {
  getFeiTicketByNo,
  listGeneratedFeiTickets,
} from './generated-fei-tickets.ts'
import type { CutPieceWarehouseRecord } from './warehouse-runtime.ts'
import { listFormalCutPieceWarehouseRecords } from './warehouse-runtime.ts'
import {
  createFactoryHandoverRecord,
  findPdaHandoverHead,
  findPdaHandoverRecord,
  findPdaPickupRecord,
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  getHandoverOrderById,
  reportPdaHandoverQtyObjection,
  reportPdaPickupQtyObjection,
  upsertPdaHandoutRecordMock,
  upsertPdaHandoverHeadMock,
  upsertPdaPickupRecordMock,
  writeBackHandoverRecord,
  type PdaCutPieceHandoutLine,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type PdaPickupRecord,
} from '../pda-handover-events.ts'
import {
  buildHandoverOrderQrValue,
  buildTaskQrValue,
} from '../task-qr.ts'

export interface CuttingSpecialCraftFeiTicketBinding {
  bindingId: string
  productionOrderId: string
  productionOrderNo: string
  cuttingOrderId: string
  cuttingOrderNo: string
  taskOrderId: string
  taskOrderNo: string
  demandLineId: string
  workOrderId: string
  workOrderNo: string
  workOrderLineId?: string
  operationId: string
  operationName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  targetFactoryId: string
  targetFactoryName: string
  feiTicketId: string
  feiTicketNo: string
  partName: string
  colorName: string
  sizeCode: string
  qty: number
  originalQty: number
  openingQty: number
  receivedQty: number
  scrapQty: number
  damageQty: number
  closingQty: number
  returnedQty: number
  currentQty: number
  cumulativeScrapQty: number
  cumulativeDamageQty: number
  unit: string
  feiTicketStatus: string
  specialCraftFlowStatus:
    | '待绑定'
    | '待发料'
    | '已发料'
    | '已接收'
    | '加工中'
    | '已完成'
    | '待回仓'
    | '已回仓'
    | '差异'
    | '异议中'
    | '异常'
    | '待确认顺序'
  currentLocation:
    | '裁床厂待交出仓'
    | '特殊工艺厂待领料'
    | '特殊工艺厂待加工仓'
    | '特殊工艺厂待交出仓'
    | '回仓途中'
    | '差异待处理'
  dispatchHandoverOrderId?: string
  dispatchHandoverOrderNo?: string
  dispatchHandoverRecordId?: string
  dispatchHandoverRecordNo?: string
  returnHandoverOrderId?: string
  returnHandoverOrderNo?: string
  returnHandoverRecordId?: string
  returnHandoverRecordNo?: string
  receiverWrittenQty?: number
  differenceQty?: number
  receiveDifferenceReportId?: string
  receiveDifferenceStatus?: '待处理' | '处理中' | '已处理'
  returnDifferenceReportId?: string
  returnDifferenceStatus?: '待处理' | '处理中' | '已处理'
  objectionStatus?: string
  abnormalReason?: string
  flowEventIds: string[]
  completedOperationNames: string[]
  nextOperationName?: string
  createdAt: string
  updatedAt: string
}

export interface SpecialCraftQtyDifferenceReport {
  reportId: string
  reportPhase: '接收差异' | '回仓差异'
  productionOrderId: string
  productionOrderNo: string
  taskOrderId: string
  taskOrderNo: string
  workOrderId: string
  workOrderNo: string
  operationId: string
  operationName: string
  feiTicketNo: string
  expectedQty: number
  actualQty: number
  differenceQty: number
  unit: string
  sourceRecordId?: string
  sourceRecordNo?: string
  reportedBy: string
  reportedAt: string
  reason: string
  platformStatus: '待处理' | '处理中' | '已处理'
  processRemark?: string
  resolvedAt?: string
}

export interface SpecialCraftFeiTicketFlowEvent {
  eventId: string
  bindingId: string
  productionOrderId: string
  taskOrderId: string
  workOrderId: string
  operationId: string
  operationName: string
  feiTicketNo: string
  eventType:
    | '绑定'
    | '发料'
    | '接收'
    | '接收差异上报'
    | '开工'
    | '报废'
    | '货损'
    | '完工'
    | '待回仓'
    | '回仓交出'
    | '回仓接收'
    | '回仓差异上报'
    | '平台处理'
  beforeQty?: number
  changedQty?: number
  afterQty?: number
  operatorName: string
  occurredAt: string
  relatedRecordId?: string
  relatedRecordNo?: string
  remark?: string
}

export interface CuttingSpecialCraftDispatchView {
  dispatchViewId: string
  productionOrderNo: string
  cuttingOrderNo: string
  operationName: string
  targetFactoryName: string
  feiTicketNo: string
  partName: string
  colorName: string
  sizeCode: string
  qty: number
  dispatchStatus: '待绑定' | '待发料' | '已发料' | '已接收' | '差异' | '异议中' | '待确认顺序'
  handoverRecordNo: string
  receiverStatus: string
  returnStatus: '未回仓' | '待回仓' | '回仓途中' | '已回仓' | '差异' | '异议中'
  currentLocation: CuttingSpecialCraftFeiTicketBinding['currentLocation']
  operationLabel: string
}

export interface CuttingSpecialCraftReturnView {
  returnViewId: string
  productionOrderNo: string
  cuttingOrderNo: string
  operationName: string
  sourceFactoryName: string
  feiTicketNo: string
  partName: string
  colorName: string
  sizeCode: string
  qty: number
  returnHandoverRecordNo: string
  receiverWrittenQty?: number
  differenceQty?: number
  returnStatus: '未回仓' | '待回仓' | '回仓途中' | '已回仓' | '差异' | '异议中'
  cuttingWarehouseName: string
  currentLocation: CuttingSpecialCraftFeiTicketBinding['currentLocation']
}

interface BindingBuildResult {
  bindings: CuttingSpecialCraftFeiTicketBinding[]
  errors: string[]
  warnings: string[]
}

interface Prompt7PendingBindingView {
  pendingViewId: string
  productionOrderNo: string
  cuttingOrderNo: string
  operationName: string
  targetFactoryName: string
  taskOrderNo: string
  partName: string
  colorName: string
  sizeCode: string
  qty: number
  unit: string
  reason: string
}

interface InternalBinding extends CuttingSpecialCraftFeiTicketBinding {
  sequenceIndex: number
  sequenceTotal: number
  taskSortIndex: number
}

interface FlowStore {
  bindings: InternalBinding[]
  differenceReports: SpecialCraftQtyDifferenceReport[]
  flowEvents: SpecialCraftFeiTicketFlowEvent[]
  warnings: string[]
  errors: string[]
  pendingBindingViews: Prompt7PendingBindingView[]
  pickupRecordToDispatchRecordId: Map<string, string>
}

const CUTTING_SPECIAL_FACTORY_STATUSES = new Set(['待发料', '已发料', '已接收', '加工中', '已完成', '待回仓', '已回仓'])
const PROMPT7_SEED_OPERATOR = '系统示例'
const PROMPT7_SEED_TIME = '2026-04-23 10:30:00'
const PROMPT7_CUTTING_FACTORY_ID = 'ID-F004'
const PROMPT7_DEFAULT_SPECIAL_FACTORY_ID = 'ID-F015'

let flowStore: FlowStore | null = null

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function isCutPieceSpecialCraftTask(taskOrder: SpecialCraftTaskOrder): boolean {
  return taskOrder.targetObject === '裁片' || taskOrder.targetObject === '已裁部位'
}

function roundQty(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Number(value) * 100) / 100
}

function getNowText(): string {
  return PROMPT7_SEED_TIME
}

function getBindingFlowQty(binding: Pick<CuttingSpecialCraftFeiTicketBinding, 'currentQty' | 'openingQty' | 'qty'>): number {
  return roundQty(binding.currentQty || binding.openingQty || binding.qty || 0)
}

function getBindingCompletionQty(binding: Pick<CuttingSpecialCraftFeiTicketBinding, 'closingQty' | 'currentQty' | 'qty'>): number {
  return roundQty(binding.closingQty || binding.currentQty || binding.qty || 0)
}

function getOpenDifferenceStatus(status?: string): '待处理' | '处理中' | undefined {
  if (status === '待处理' || status === '处理中') return status
  return undefined
}

function getDifferenceDisplayStatus(status?: string): string {
  const openStatus = getOpenDifferenceStatus(status)
  return openStatus ? '差异待处理' : status || '—'
}

function getWorkOrderTarget(taskOrder: SpecialCraftTaskOrder, demandLineId: string, partName: string) {
  const line = getSpecialCraftTaskWorkOrderLineByDemandLineId(taskOrder.taskOrderId, demandLineId)
  if (line) {
    const workOrder = getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId).find((item) => item.workOrderId === line.workOrderId)
    if (workOrder) {
      return {
        workOrderId: workOrder.workOrderId,
        workOrderNo: workOrder.workOrderNo,
        workOrderLineId: line.lineId,
      }
    }
  }
  const workOrder = getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrder.taskOrderId).find((item) => item.partName === partName)
  return {
    workOrderId: workOrder?.workOrderId || `${taskOrder.taskOrderId}-WO-001`,
    workOrderNo: workOrder?.workOrderNo || `${taskOrder.taskOrderNo}-部位01`,
    workOrderLineId: line?.lineId,
  }
}

function makeFlowEvent(
  binding: Pick<CuttingSpecialCraftFeiTicketBinding, 'bindingId' | 'productionOrderId' | 'taskOrderId' | 'workOrderId' | 'operationId' | 'operationName' | 'feiTicketNo'>,
  input: Omit<SpecialCraftFeiTicketFlowEvent, 'eventId' | 'bindingId' | 'productionOrderId' | 'taskOrderId' | 'workOrderId' | 'operationId' | 'operationName' | 'feiTicketNo'>,
): SpecialCraftFeiTicketFlowEvent {
  return {
    eventId: `SCFE-${binding.bindingId}-${String((flowStore?.flowEvents.length || 0) + 1).padStart(4, '0')}`,
    bindingId: binding.bindingId,
    productionOrderId: binding.productionOrderId,
    taskOrderId: binding.taskOrderId,
    workOrderId: binding.workOrderId,
    operationId: binding.operationId,
    operationName: binding.operationName,
    feiTicketNo: binding.feiTicketNo,
    ...input,
  }
}

function appendFlowEvent(store: FlowStore, binding: InternalBinding, event: SpecialCraftFeiTicketFlowEvent): InternalBinding {
  store.flowEvents.push(event)
  return updateBinding(store, binding.bindingId, (current) => ({
    ...current,
    flowEventIds: [...new Set([...current.flowEventIds, event.eventId])],
    updatedAt: event.occurredAt,
  }))
}

function createQtyDifferenceReport(
  store: FlowStore,
  binding: InternalBinding,
  input: {
    reportPhase: '接收差异' | '回仓差异'
    expectedQty: number
    actualQty: number
    sourceRecordId?: string
    sourceRecordNo?: string
    reportedBy: string
    reportedAt: string
    reason?: string
  },
): SpecialCraftQtyDifferenceReport {
  const differenceQty = roundQty(input.actualQty - input.expectedQty)
  const report: SpecialCraftQtyDifferenceReport = {
    reportId: `SCQDR-${binding.bindingId}-${input.reportPhase === '接收差异' ? 'RCV' : 'RET'}-${String(store.differenceReports.length + 1).padStart(3, '0')}`,
    reportPhase: input.reportPhase,
    productionOrderId: binding.productionOrderId,
    productionOrderNo: binding.productionOrderNo,
    taskOrderId: binding.taskOrderId,
    taskOrderNo: binding.taskOrderNo,
    workOrderId: binding.workOrderId,
    workOrderNo: binding.workOrderNo,
    operationId: binding.operationId,
    operationName: binding.operationName,
    feiTicketNo: binding.feiTicketNo,
    expectedQty: input.expectedQty,
    actualQty: input.actualQty,
    differenceQty,
    unit: binding.unit,
    sourceRecordId: input.sourceRecordId,
    sourceRecordNo: input.sourceRecordNo,
    reportedBy: input.reportedBy,
    reportedAt: input.reportedAt,
    reason: input.reason || '数量不符',
    platformStatus: '待处理',
  }
  store.differenceReports.push(report)
  appendFlowEvent(
    store,
    binding,
    makeFlowEvent(binding, {
      eventType: input.reportPhase === '接收差异' ? '接收差异上报' : '回仓差异上报',
      beforeQty: input.expectedQty,
      changedQty: differenceQty,
      afterQty: input.actualQty,
      operatorName: input.reportedBy,
      occurredAt: input.reportedAt,
      relatedRecordId: input.sourceRecordId,
      relatedRecordNo: input.sourceRecordNo,
      remark: input.reason || '数量不符',
    }),
  )
  return report
}

function getCuttingFactory() {
  return (
    mockFactories.find((factory) => factory.id === PROMPT7_CUTTING_FACTORY_ID)
    || mockFactories.find((factory) => factory.factoryType === 'CENTRAL_CUTTING')
    || mockFactories[0]
  )
}

function resolveSpecialCraftFactory(operationName: string) {
  const preferred = mockFactories.find((factory) => factory.id === PROMPT7_DEFAULT_SPECIAL_FACTORY_ID)
  if (
    preferred?.processAbilities.some(
      (ability) =>
        ability.processCode === 'SPECIAL_CRAFT' && ability.craftNames.includes(operationName),
    )
  ) {
    return preferred
  }

  return (
    mockFactories.find((factory) =>
      factory.processAbilities.some(
        (ability) =>
          ability.processCode === 'SPECIAL_CRAFT' && ability.craftNames.includes(operationName),
      ),
    )
    || preferred
    || mockFactories[0]
  )
}

function getCuttingWaitHandoverWarehouse(): FactoryInternalWarehouse {
  const warehouse = findFactoryInternalWarehouseByFactoryAndKind(getCuttingFactory().id, 'WAIT_HANDOVER')
  if (!warehouse) {
    throw new Error('未找到裁床厂待交出仓')
  }
  return warehouse
}

function getPositionSeed(
  warehouse: FactoryInternalWarehouse,
  binding: CuttingSpecialCraftFeiTicketBinding,
  preferredAreaName: string,
) {
  const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) || warehouse.areaList[0]
  const shelf = area?.shelfList[0]
  const location = shelf?.locationList[0]
  return {
    areaName: area?.areaName || 'A区',
    shelfNo: shelf?.shelfNo || 'A-01',
    locationNo: location?.locationNo || 'A-01-01',
    locationText: `${area?.areaName || 'A区'} / ${shelf?.shelfNo || 'A-01'} / ${location?.locationNo || 'A-01-01'}`,
    binding,
  }
}

function getBindingRecordLine(binding: CuttingSpecialCraftFeiTicketBinding): PdaCutPieceHandoutLine {
  const pieceQty = getBindingFlowQty(binding)
  return {
    lineId: `SC-LINE-${binding.bindingId}`,
    piecePartLabel: binding.partName,
    piecePartCode: binding.demandLineId,
    garmentSkuCode: binding.productionOrderNo,
    garmentSkuLabel: binding.productionOrderNo,
    colorLabel: binding.colorName,
    sizeLabel: binding.sizeCode,
    pieceQty,
    garmentEquivalentQty: pieceQty,
  }
}

function getBindingFlowLabel(binding: CuttingSpecialCraftFeiTicketBinding): string {
  return `${binding.operationName} · ${binding.specialCraftFlowStatus}`
}

function sortBindings(left: InternalBinding, right: InternalBinding): number {
  return (
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    || left.taskOrderNo.localeCompare(right.taskOrderNo, 'zh-CN')
    || left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN')
  )
}

function buildDispatchHeadId(operationId: string, targetFactoryId: string): string {
  return `SC-DISPATCH-${operationId.replace(/[^A-Za-z0-9]/g, '')}-${targetFactoryId.replace(/[^A-Za-z0-9]/g, '')}`
}

function buildPickupHeadId(operationId: string, targetFactoryId: string): string {
  return `SC-PICKUP-${operationId.replace(/[^A-Za-z0-9]/g, '')}-${targetFactoryId.replace(/[^A-Za-z0-9]/g, '')}`
}

function buildReturnHeadId(operationId: string, targetFactoryId: string): string {
  return `SC-RETURN-${operationId.replace(/[^A-Za-z0-9]/g, '')}-${targetFactoryId.replace(/[^A-Za-z0-9]/g, '')}`
}

function ensureDispatchHead(
  binding: CuttingSpecialCraftFeiTicketBinding,
  selectedBindings: CuttingSpecialCraftFeiTicketBinding[],
): PdaHandoverHead {
  const headId = buildDispatchHeadId(binding.operationId, binding.targetFactoryId)
  const existed = findPdaHandoverHead(headId)
  if (existed) return existed
  const cuttingFactory = getCuttingFactory()
  const qtyExpectedTotal = roundQty(selectedBindings.reduce((total, item) => total + item.qty, 0))
  return upsertPdaHandoverHeadMock({
    handoverId: headId,
    handoverOrderId: headId,
    handoverOrderNo: `SCD-${binding.operationName}-${binding.targetFactoryId.slice(-3)}`,
    headType: 'HANDOUT',
    qrCodeValue: buildHandoverOrderQrValue(headId),
    handoverOrderQrValue: buildHandoverOrderQrValue(headId),
    taskId: binding.taskOrderId,
    sourceTaskId: binding.taskOrderId,
    taskNo: binding.taskOrderNo,
    sourceTaskNo: binding.taskOrderNo,
    productionOrderNo: binding.productionOrderNo,
    processName: `${binding.operationName}发料`,
    sourceFactoryName: cuttingFactory.name,
    sourceFactoryId: cuttingFactory.id,
    targetName: binding.targetFactoryName,
    targetKind: 'FACTORY',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: binding.targetFactoryId,
    receiverName: binding.targetFactoryName,
    qtyUnit: binding.unit,
    factoryId: cuttingFactory.id,
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    handoverOrderStatus: 'OPEN',
    recordCount: 0,
    pendingWritebackCount: 0,
    submittedQtyTotal: 0,
    writtenBackQtyTotal: 0,
    diffQtyTotal: 0,
    objectionCount: 0,
    plannedQty: qtyExpectedTotal,
    completionStatus: 'OPEN',
    qtyExpectedTotal,
    qtyActualTotal: 0,
    qtyDiffTotal: qtyExpectedTotal,
    processBusinessCode: binding.processCode,
    processBusinessName: binding.processName,
    craftCode: binding.craftCode,
    craftName: binding.craftName,
    taskTypeCode: binding.craftCode,
    taskTypeLabel: `${binding.operationName}任务`,
    isSpecialCraft: true,
  })
}

function ensurePickupHead(
  binding: CuttingSpecialCraftFeiTicketBinding,
  selectedBindings: CuttingSpecialCraftFeiTicketBinding[],
): PdaHandoverHead {
  const headId = buildPickupHeadId(binding.operationId, binding.targetFactoryId)
  const existed = findPdaHandoverHead(headId)
  if (existed) return existed
  const qtyExpectedTotal = roundQty(selectedBindings.reduce((total, item) => total + item.qty, 0))
  return upsertPdaHandoverHeadMock({
    handoverId: headId,
    handoverOrderId: headId,
    handoverOrderNo: `SCP-${binding.operationName}-${binding.targetFactoryId.slice(-3)}`,
    headType: 'PICKUP',
    qrCodeValue: buildTaskQrValue(headId),
    taskId: binding.taskOrderId,
    sourceTaskId: binding.taskOrderId,
    taskNo: binding.taskOrderNo,
    sourceTaskNo: binding.taskOrderNo,
    productionOrderNo: binding.productionOrderNo,
    processName: `${binding.operationName}待领料`,
    sourceFactoryName: getCuttingFactory().name,
    sourceFactoryId: getCuttingFactory().id,
    targetName: binding.targetFactoryName,
    targetKind: 'FACTORY',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: binding.targetFactoryId,
    receiverName: binding.targetFactoryName,
    qtyUnit: binding.unit,
    factoryId: binding.targetFactoryId,
    taskStatus: 'IN_PROGRESS',
    summaryStatus: 'NONE',
    recordCount: 0,
    pendingWritebackCount: 0,
    submittedQtyTotal: 0,
    writtenBackQtyTotal: 0,
    diffQtyTotal: 0,
    objectionCount: 0,
    completionStatus: 'OPEN',
    qtyExpectedTotal,
    qtyActualTotal: 0,
    qtyDiffTotal: qtyExpectedTotal,
    processBusinessCode: binding.processCode,
    processBusinessName: binding.processName,
    craftCode: binding.craftCode,
    craftName: binding.craftName,
    taskTypeCode: binding.craftCode,
    taskTypeLabel: `${binding.operationName}任务`,
    isSpecialCraft: true,
  })
}

function ensureReturnHead(
  binding: CuttingSpecialCraftFeiTicketBinding,
  selectedBindings: CuttingSpecialCraftFeiTicketBinding[],
): PdaHandoverHead {
  const headId = buildReturnHeadId(binding.operationId, binding.targetFactoryId)
  const existed = findPdaHandoverHead(headId)
  if (existed) return existed
  const qtyExpectedTotal = roundQty(selectedBindings.reduce((total, item) => total + item.qty, 0))
  return upsertPdaHandoverHeadMock({
    handoverId: headId,
    handoverOrderId: headId,
    handoverOrderNo: `SCR-${binding.operationName}-${binding.targetFactoryId.slice(-3)}`,
    headType: 'HANDOUT',
    qrCodeValue: buildHandoverOrderQrValue(headId),
    handoverOrderQrValue: buildHandoverOrderQrValue(headId),
    taskId: binding.taskOrderId,
    sourceTaskId: binding.taskOrderId,
    taskNo: binding.taskOrderNo,
    sourceTaskNo: binding.taskOrderNo,
    productionOrderNo: binding.productionOrderNo,
    processName: `${binding.operationName}回仓`,
    sourceFactoryName: binding.targetFactoryName,
    sourceFactoryId: binding.targetFactoryId,
    targetName: getCuttingFactory().name,
    targetKind: 'FACTORY',
    receiverKind: 'MANAGED_POST_FACTORY',
    receiverId: getCuttingFactory().id,
    receiverName: getCuttingFactory().name,
    qtyUnit: binding.unit,
    factoryId: binding.targetFactoryId,
    taskStatus: 'DONE',
    summaryStatus: 'NONE',
    handoverOrderStatus: 'OPEN',
    recordCount: 0,
    pendingWritebackCount: 0,
    submittedQtyTotal: 0,
    writtenBackQtyTotal: 0,
    diffQtyTotal: 0,
    objectionCount: 0,
    plannedQty: qtyExpectedTotal,
    completionStatus: 'OPEN',
    qtyExpectedTotal,
    qtyActualTotal: 0,
    qtyDiffTotal: qtyExpectedTotal,
    processBusinessCode: binding.processCode,
    processBusinessName: binding.processName,
    craftCode: binding.craftCode,
    craftName: binding.craftName,
    taskTypeCode: binding.craftCode,
    taskTypeLabel: `${binding.operationName}任务`,
    isSpecialCraft: true,
  })
}

function syncPickupHeadSummary(headId: string): void {
  const head = findPdaHandoverHead(headId)
  if (!head) return
  const records = getPdaPickupRecordsByHead(headId)
  const receivedCount = records.filter((record) => record.status === 'RECEIVED').length
  const hasObjection = records.some(
    (record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING',
  )
  const summaryStatus =
    records.length === 0
      ? 'NONE'
      : hasObjection
        ? 'HAS_OBJECTION'
        : receivedCount === records.length
          ? 'WRITTEN_BACK'
          : receivedCount > 0
            ? 'PARTIAL_WRITTEN_BACK'
            : 'SUBMITTED'

  upsertPdaHandoverHeadMock({
    ...head,
    summaryStatus,
    recordCount: records.length,
    writtenBackQtyTotal: roundQty(records.reduce((total, record) => total + (record.factoryConfirmedQty || 0), 0)),
    qtyActualTotal: roundQty(records.reduce((total, record) => total + (record.factoryConfirmedQty || 0), 0)),
    diffQtyTotal: roundQty(
      records.reduce(
        (total, record) => total + ((record.factoryConfirmedQty ?? record.factoryReportedQty ?? 0) - record.qtyExpected),
        0,
      ),
    ),
    objectionCount: records.filter((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING').length,
  })
}

function syncHandoutHeadSummary(headId: string): void {
  const head = findPdaHandoverHead(headId)
  if (!head) return
  const records = getPdaHandoverRecordsByHead(headId)
  const pendingWritebackCount = records.filter((record) => !record.receiverWrittenAt).length
  const writtenBackCount = records.filter((record) => Boolean(record.receiverWrittenAt)).length
  const diffCount = records.filter((record) => (record.diffQty || 0) !== 0).length
  const objectionCount = records.filter(
    (record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING',
  ).length
  const summaryStatus =
    records.length === 0
      ? 'NONE'
      : objectionCount > 0
        ? 'HAS_OBJECTION'
        : pendingWritebackCount === records.length
          ? 'SUBMITTED'
          : writtenBackCount === records.length
            ? 'WRITTEN_BACK'
            : 'PARTIAL_WRITTEN_BACK'
  const handoverOrderStatus =
    objectionCount > 0
      ? 'HAS_OBJECTION'
      : diffCount > 0
        ? 'DIFF_WAIT_FACTORY_CONFIRM'
        : pendingWritebackCount > 0
          ? 'WAIT_RECEIVER_WRITEBACK'
          : 'WRITTEN_BACK'
  upsertPdaHandoverHeadMock({
    ...head,
    summaryStatus,
    handoverOrderStatus,
    recordCount: records.length,
    pendingWritebackCount,
    submittedQtyTotal: roundQty(records.reduce((total, record) => total + (record.submittedQty || 0), 0)),
    writtenBackQtyTotal: roundQty(records.reduce((total, record) => total + (record.receiverWrittenQty || 0), 0)),
    diffQtyTotal: roundQty(records.reduce((total, record) => total + (record.diffQty || 0), 0)),
    qtyActualTotal: roundQty(records.reduce((total, record) => total + (record.receiverWrittenQty || 0), 0)),
    objectionCount,
  })
}

function buildBindingId(
  taskOrderId: string,
  demandLineId: string,
  feiTicketNo: string,
  operationId: string,
): string {
  return `SCB-${taskOrderId}-${demandLineId}-${operationId}-${feiTicketNo}`.replace(/[^A-Za-z0-9-]/g, '')
}

function resolveBindingTargetFactory(
  taskOrder: SpecialCraftTaskOrder,
  operation: SpecialCraftOperationDefinition,
) {
  if (taskOrder.assignedFactoryId && taskOrder.assignedFactoryName) {
    return {
      targetFactoryId: taskOrder.assignedFactoryId,
      targetFactoryName: taskOrder.assignedFactoryName,
    }
  }
  if (taskOrder.suggestedFactoryId && taskOrder.suggestedFactoryName) {
    return {
      targetFactoryId: taskOrder.suggestedFactoryId,
      targetFactoryName: taskOrder.suggestedFactoryName,
    }
  }
  const factory = resolveSpecialCraftFactory(operation.operationName)
  return {
    targetFactoryId: factory.id,
    targetFactoryName: factory.name,
  }
}

function buildPendingBindingViews(
  taskOrders: SpecialCraftTaskOrder[],
  bindingList: CuttingSpecialCraftFeiTicketBinding[],
): Prompt7PendingBindingView[] {
  return taskOrders.flatMap((taskOrder) =>
    (taskOrder.demandLines || [])
      .map((line) => {
        const boundQty = bindingList
          .filter((binding) => binding.demandLineId === line.demandLineId)
          .reduce((total, binding) => total + binding.qty, 0)
        const remainingQty = roundQty(line.planPieceQty - boundQty)
        if (remainingQty <= 0) return null
        const targetFactory = resolveBindingTargetFactory(taskOrder, getSpecialCraftOperationById(taskOrder.operationId)!)
        return {
          pendingViewId: `SC-PENDING-${line.demandLineId}`,
          productionOrderNo: taskOrder.productionOrderNo,
          cuttingOrderNo: '待绑定裁片单',
          operationName: taskOrder.operationName,
          targetFactoryName: targetFactory.targetFactoryName,
          taskOrderNo: taskOrder.taskOrderNo,
          partName: line.partName,
          colorName: line.colorName,
          sizeCode: line.sizeCode,
          qty: remainingQty,
          unit: line.unit,
          reason: '待绑定',
        }
      })
      .filter((item): item is Prompt7PendingBindingView => Boolean(item)),
  )
}

export function buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets(input?: {
  specialCraftTaskOrders?: SpecialCraftTaskOrder[]
  generatedFeiTickets?: GeneratedFeiTicketSourceRecord[]
  cuttingWarehouseItems?: CutPieceWarehouseRecord[]
  specialCraftOperations?: SpecialCraftOperationDefinition[]
}): BindingBuildResult {
  const taskOrders = (input?.specialCraftTaskOrders || listSpecialCraftTaskOrders()).filter(
    isCutPieceSpecialCraftTask,
  )
  const generatedFeiTickets = input?.generatedFeiTickets || listGeneratedFeiTickets()
  const cuttingWarehouseItems = input?.cuttingWarehouseItems || listFormalCutPieceWarehouseRecords()
  const specialCraftOperations = input?.specialCraftOperations || listEnabledSpecialCraftOperationDefinitions()
  const bindings: CuttingSpecialCraftFeiTicketBinding[] = []
  const warnings: string[] = []
  const errors: string[] = []
  const occupiedBindingKeys = new Set<string>()
  const ticketLocationMap = new Map(
    cuttingWarehouseItems.map((item) => [item.originalCutOrderNo, item.locationLabel] as const),
  )

  generatedFeiTickets.forEach((ticket) => {
    const candidateTaskOrders = taskOrders.filter((taskOrder) => {
      if (taskOrder.productionOrderId !== ticket.productionOrderId) return false
      if (normalizeText(taskOrder.partName) !== normalizeText(ticket.partName)) return false
      if (normalizeText(taskOrder.fabricColor) && normalizeText(taskOrder.fabricColor) !== normalizeText(ticket.skuColor)) return false
      return true
    })

    if (!candidateTaskOrders.length) return

    const candidateLines = candidateTaskOrders.flatMap((taskOrder, taskSortIndex) =>
      (taskOrder.demandLines || [])
        .filter((line) => normalizeText(line.sizeCode) === normalizeText(ticket.skuSize))
        .map((line) => ({ line, taskOrder, taskSortIndex })),
    )

    if (!candidateLines.length) return

    const matchedLines = candidateLines.filter(({ line }) => {
      const operation = specialCraftOperations.find((item) => item.operationId === line.operationId)
      if (!operation || !operation.requiresFeiTicketScan) return false
      if (!ticket.secondaryCrafts.includes(operation.operationName)) return false
      return true
    })

    if (!matchedLines.length) return

    const sortedMatchedLines = [...matchedLines].sort((left, right) => {
      const leftIndex = ticket.secondaryCrafts.indexOf(left.line.operationName)
      const rightIndex = ticket.secondaryCrafts.indexOf(right.line.operationName)
      if (leftIndex < 0 && rightIndex < 0) return left.taskSortIndex - right.taskSortIndex
      if (leftIndex < 0) return 1
      if (rightIndex < 0) return -1
      return leftIndex - rightIndex
    })

    sortedMatchedLines.forEach(({ line, taskOrder, taskSortIndex }, index) => {
      const operation = getSpecialCraftOperationById(line.operationId)
      if (!operation) {
        errors.push(`未找到特殊工艺运营分类：${line.operationName}`)
        return
      }
      const targetFactory = resolveBindingTargetFactory(taskOrder, operation)
      const occupiedKey = `${ticket.feiTicketNo}__${operation.operationId}`
      if (occupiedBindingKeys.has(occupiedKey)) {
        warnings.push(`菲票 ${ticket.feiTicketNo} 已绑定到 ${operation.operationName}，已跳过重复绑定。`)
        return
      }
      occupiedBindingKeys.add(occupiedKey)
      const locationLabel = ticketLocationMap.get(ticket.originalCutOrderNo) || '裁床厂待交出仓'
      const workOrderTarget = getWorkOrderTarget(taskOrder, line.demandLineId, line.partName)
      const originalQty = roundQty(ticket.qty)
      bindings.push({
        bindingId: buildBindingId(taskOrder.taskOrderId, line.demandLineId, ticket.feiTicketNo, operation.operationId),
        productionOrderId: taskOrder.productionOrderId,
        productionOrderNo: taskOrder.productionOrderNo,
        cuttingOrderId: ticket.originalCutOrderId,
        cuttingOrderNo: ticket.originalCutOrderNo,
        taskOrderId: taskOrder.taskOrderId,
        taskOrderNo: taskOrder.taskOrderNo,
        demandLineId: line.demandLineId,
        workOrderId: workOrderTarget.workOrderId,
        workOrderNo: workOrderTarget.workOrderNo,
        workOrderLineId: workOrderTarget.workOrderLineId,
        operationId: operation.operationId,
        operationName: operation.operationName,
        processCode: operation.processCode,
        processName: operation.processName,
        craftCode: operation.craftCode,
        craftName: operation.craftName,
        targetFactoryId: targetFactory.targetFactoryId,
        targetFactoryName: targetFactory.targetFactoryName,
        feiTicketId: ticket.feiTicketId,
        feiTicketNo: ticket.feiTicketNo,
        partName: line.partName,
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        qty: originalQty,
        originalQty,
        openingQty: originalQty,
        receivedQty: 0,
        scrapQty: 0,
        damageQty: 0,
        closingQty: 0,
        returnedQty: 0,
        currentQty: originalQty,
        cumulativeScrapQty: 0,
        cumulativeDamageQty: 0,
        unit: line.unit || '片',
        feiTicketStatus: index === 0 ? '待发料' : '待确认顺序',
        specialCraftFlowStatus: index === 0 ? '待发料' : '待确认顺序',
        currentLocation: '裁床厂待交出仓',
        flowEventIds: [],
        completedOperationNames: [],
        nextOperationName: sortedMatchedLines[index + 1]?.line.operationName,
        createdAt: ticket.issuedAt || getNowText(),
        updatedAt: ticket.issuedAt || getNowText(),
      })
    })
  })

  taskOrders.forEach((taskOrder) => {
    ;(taskOrder.demandLines || []).forEach((line) => {
      const operation = specialCraftOperations.find((item) => item.operationId === line.operationId)
      if (!operation || !operation.requiresFeiTicketScan) return
      const targetFactory = resolveBindingTargetFactory(taskOrder, operation)
      const ticketNos = [...new Set(line.feiTicketNos || [])]
      ticketNos.forEach((feiTicketNo) => {
        const occupiedKey = `${feiTicketNo}__${operation.operationId}`
        if (occupiedBindingKeys.has(occupiedKey)) return
        occupiedBindingKeys.add(occupiedKey)
        const generatedTicket = getFeiTicketByNo(feiTicketNo)
        const fallbackQty = roundQty(line.planPieceQty / Math.max(ticketNos.length, 1))
        const originalQty = roundQty(generatedTicket?.qty || fallbackQty)
        const workOrderTarget = getWorkOrderTarget(taskOrder, line.demandLineId, line.partName)
        bindings.push({
          bindingId: buildBindingId(taskOrder.taskOrderId, line.demandLineId, feiTicketNo, operation.operationId),
          productionOrderId: taskOrder.productionOrderId,
          productionOrderNo: taskOrder.productionOrderNo,
          cuttingOrderId: generatedTicket?.originalCutOrderId || line.patternFileId,
          cuttingOrderNo: generatedTicket?.originalCutOrderNo || line.patternFileName || '待绑定裁片单',
          taskOrderId: taskOrder.taskOrderId,
          taskOrderNo: taskOrder.taskOrderNo,
          demandLineId: line.demandLineId,
          workOrderId: workOrderTarget.workOrderId,
          workOrderNo: workOrderTarget.workOrderNo,
          workOrderLineId: workOrderTarget.workOrderLineId,
          operationId: operation.operationId,
          operationName: operation.operationName,
          processCode: operation.processCode,
          processName: operation.processName,
          craftCode: operation.craftCode,
          craftName: operation.craftName,
          targetFactoryId: targetFactory.targetFactoryId,
          targetFactoryName: targetFactory.targetFactoryName,
          feiTicketId: generatedTicket?.feiTicketId || feiTicketNo,
          feiTicketNo,
          partName: line.partName,
          colorName: line.colorName,
          sizeCode: line.sizeCode,
          qty: originalQty,
          originalQty,
          openingQty: originalQty,
          receivedQty: 0,
          scrapQty: 0,
          damageQty: 0,
          closingQty: 0,
          returnedQty: 0,
          currentQty: originalQty,
          cumulativeScrapQty: 0,
          cumulativeDamageQty: 0,
          unit: line.unit || '片',
          feiTicketStatus: '待发料',
          specialCraftFlowStatus: '待发料',
          currentLocation: '裁床厂待交出仓',
          flowEventIds: [],
          completedOperationNames: [],
          createdAt: generatedTicket?.issuedAt || taskOrder.createdAt || getNowText(),
          updatedAt: generatedTicket?.issuedAt || taskOrder.createdAt || getNowText(),
        })
      })
    })
  })

  const hasMultiOperationTicket = new Set(bindings.map((binding) => binding.feiTicketNo)).size < bindings.length
  if (!hasMultiOperationTicket && bindings.length >= 2) {
    const firstBinding = bindings[0]
    const nextOperationBinding = bindings.find((binding) => binding.operationId !== firstBinding.operationId)
    if (nextOperationBinding) {
      bindings.push({
        ...nextOperationBinding,
        bindingId: buildBindingId(
          nextOperationBinding.taskOrderId,
          nextOperationBinding.demandLineId,
          firstBinding.feiTicketNo,
          nextOperationBinding.operationId,
        ),
        productionOrderId: firstBinding.productionOrderId,
        productionOrderNo: firstBinding.productionOrderNo,
        cuttingOrderId: firstBinding.cuttingOrderId,
        cuttingOrderNo: firstBinding.cuttingOrderNo,
        feiTicketId: firstBinding.feiTicketId,
        feiTicketNo: firstBinding.feiTicketNo,
        partName: firstBinding.partName,
        colorName: firstBinding.colorName,
        sizeCode: firstBinding.sizeCode,
        qty: firstBinding.originalQty,
        originalQty: firstBinding.originalQty,
        openingQty: firstBinding.originalQty,
        receivedQty: 0,
        scrapQty: 0,
        damageQty: 0,
        closingQty: 0,
        returnedQty: 0,
        currentQty: firstBinding.originalQty,
        cumulativeScrapQty: 0,
        cumulativeDamageQty: 0,
        feiTicketStatus: '待发料',
        specialCraftFlowStatus: '待发料',
        currentLocation: '裁床厂待交出仓',
        flowEventIds: [],
        completedOperationNames: [],
        nextOperationName: undefined,
        createdAt: firstBinding.createdAt,
        updatedAt: firstBinding.updatedAt,
      })
    }
  }

  const pendingBindingViews = buildPendingBindingViews(taskOrders, bindings)
  if (pendingBindingViews.length > 0) {
    warnings.push(`存在 ${pendingBindingViews.length} 条待绑定裁片需求。`)
  }

  return {
    bindings,
    warnings,
    errors,
  }
}

function buildInternalBindings(): {
  bindings: InternalBinding[]
  warnings: string[]
  errors: string[]
  pendingBindingViews: Prompt7PendingBindingView[]
} {
  const buildResult = buildSpecialCraftFeiTicketBindingsFromGeneratedFeiTickets()
  const taskOrders = listSpecialCraftTaskOrders().filter(isCutPieceSpecialCraftTask)
  const pendingBindingViews = buildPendingBindingViews(taskOrders, buildResult.bindings)
  const fallbackSequenceMap = new Map<string, string[]>()
  buildResult.bindings.forEach((binding) => {
    const matchedTicket = getFeiTicketByNo(binding.feiTicketNo)
    if (matchedTicket?.secondaryCrafts.includes(binding.operationName)) return
    const list = fallbackSequenceMap.get(binding.feiTicketNo) || []
    list.push(binding.bindingId)
    fallbackSequenceMap.set(binding.feiTicketNo, list)
  })
  const internalBindings = buildResult.bindings
    .map((binding) => {
      const matchedTicket = getFeiTicketByNo(binding.feiTicketNo)
      const fallbackSequence = fallbackSequenceMap.get(binding.feiTicketNo) || []
      const matchedSequenceIndex = matchedTicket?.secondaryCrafts.indexOf(binding.operationName) ?? -1
      const sequenceIndex = matchedSequenceIndex >= 0
        ? matchedSequenceIndex
        : Math.max(fallbackSequence.indexOf(binding.bindingId), 0)
      const sequenceTotal = matchedTicket?.secondaryCrafts.length || fallbackSequence.length || 1
      const taskSortIndex = matchedTicket && sequenceIndex >= 0 ? sequenceIndex : 999
      return {
        ...binding,
        sequenceIndex,
        sequenceTotal,
        taskSortIndex,
      } satisfies InternalBinding
    })
    .sort(sortBindings)
  return {
    bindings: internalBindings,
    warnings: buildResult.warnings,
    errors: buildResult.errors,
    pendingBindingViews,
  }
}

function updateBinding(
  store: FlowStore,
  bindingId: string,
  updater: (binding: InternalBinding) => InternalBinding,
): InternalBinding {
  const index = store.bindings.findIndex((binding) => binding.bindingId === bindingId)
  if (index < 0) {
    throw new Error(`未找到特殊工艺菲票流转记录：${bindingId}`)
  }
  const nextBinding = updater(store.bindings[index])
  store.bindings[index] = nextBinding
  return nextBinding
}

function findBindingByFeiTicketAndOperation(
  store: FlowStore,
  feiTicketNo: string,
  operationId: string,
): InternalBinding | undefined {
  return store.bindings.find(
    (binding) =>
      binding.feiTicketNo === feiTicketNo && binding.operationId === operationId,
  )
}

function getDispatchBindingsByRecordId(store: FlowStore, handoverRecordId: string): InternalBinding[] {
  return store.bindings.filter((binding) => binding.dispatchHandoverRecordId === handoverRecordId)
}

function getReturnBindingsByRecordId(store: FlowStore, handoverRecordId: string): InternalBinding[] {
  return store.bindings.filter((binding) => binding.returnHandoverRecordId === handoverRecordId)
}

function recomputeSequenceGate(store: FlowStore, productionOrderId?: string, feiTicketNo?: string): void {
  const byTicket = new Map<string, InternalBinding[]>()
  store.bindings
    .filter((binding) => (!productionOrderId || binding.productionOrderId === productionOrderId) && (!feiTicketNo || binding.feiTicketNo === feiTicketNo))
    .forEach((binding) => {
      const list = byTicket.get(binding.feiTicketNo) || []
      list.push(binding)
      byTicket.set(binding.feiTicketNo, list)
    })

  byTicket.forEach((list) => {
    const sorted = [...list].sort((left, right) => left.sequenceIndex - right.sequenceIndex)
    sorted.forEach((binding, index) => {
      const completedOperationNames = sorted
        .slice(0, index)
        .filter((item) => item.specialCraftFlowStatus === '已回仓' && item.currentLocation === '裁床厂待交出仓')
        .map((item) => item.operationName)
      if (index === 0) {
        updateBinding(store, binding.bindingId, (current) => ({
          ...current,
          completedOperationNames,
          nextOperationName: sorted[index + 1]?.operationName,
        }))
        return
      }
      const previous = sorted[index - 1]
      const canDispatch =
        previous.specialCraftFlowStatus === '已回仓'
        && previous.currentLocation === '裁床厂待交出仓'
        && previous.currentQty > 0
      updateBinding(store, binding.bindingId, (current) => {
        if (CUTTING_SPECIAL_FACTORY_STATUSES.has(current.specialCraftFlowStatus) && current.dispatchHandoverRecordId) {
          return {
            ...current,
            completedOperationNames,
            nextOperationName: sorted[index + 1]?.operationName,
          }
        }
        const openingQty = canDispatch ? previous.returnedQty || previous.currentQty : current.openingQty
        return {
          ...current,
          openingQty,
          currentQty: canDispatch ? openingQty : current.currentQty,
          completedOperationNames,
          nextOperationName: sorted[index + 1]?.operationName,
          feiTicketStatus: canDispatch ? '待发料' : '待确认顺序',
          specialCraftFlowStatus: canDispatch ? '待发料' : '待确认顺序',
          updatedAt: getNowText(),
        }
      })
    })
  })
}

export function assertSpecialCraftDispatchAllowed(input: {
  feiTicketNo: string
  operationId: string
  targetFactoryId: string
}): InternalBinding {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const binding = findBindingByFeiTicketAndOperation(flowStore!, input.feiTicketNo, input.operationId)
  if (!binding) throw new Error(`菲票 ${input.feiTicketNo} 未绑定对应特殊工艺任务。`)
  if (binding.targetFactoryId !== input.targetFactoryId) throw new Error('目标工厂与特殊工艺任务不一致。')
  if (binding.currentLocation !== '裁床厂待交出仓') throw new Error('当前菲票不在裁床厂待交出仓。')
  if (binding.currentQty <= 0) throw new Error('当前数量为 0，不能发料。')
  if (binding.specialCraftFlowStatus !== '待发料') {
    if (binding.specialCraftFlowStatus === '待确认顺序') {
      throw new Error('当前特殊工艺顺序未满足，暂不可发料。')
    }
    throw new Error(`当前菲票状态为 ${binding.specialCraftFlowStatus}，不能发料。`)
  }
  return binding
}

export function assertSpecialCraftReturnAllowed(input: {
  feiTicketNo: string
  operationId: string
  receiverFactoryId: string
}): InternalBinding {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const binding = findBindingByFeiTicketAndOperation(flowStore!, input.feiTicketNo, input.operationId)
  if (!binding) throw new Error(`菲票 ${input.feiTicketNo} 未绑定对应特殊工艺任务。`)
  if (binding.specialCraftFlowStatus !== '待回仓') throw new Error(`当前菲票状态为 ${binding.specialCraftFlowStatus}，暂不可回仓。`)
  if (binding.currentLocation !== '特殊工艺厂待交出仓') throw new Error('当前菲票不在特殊工艺厂待交出仓。')
  if (input.receiverFactoryId !== getCuttingFactory().id) throw new Error('特殊工艺回仓对象必须是裁床厂。')
  return binding
}

export function getEligibleSpecialCraftFeiTickets(
  operationId: string,
  filters: {
    productionOrderNo?: string
    targetFactoryId?: string
    keyword?: string
  } = {},
): CuttingSpecialCraftFeiTicketBinding[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings.filter((binding) => {
    if (binding.operationId !== operationId) return false
    if (binding.specialCraftFlowStatus !== '待发料') return false
    if (binding.currentLocation !== '裁床厂待交出仓') return false
    if (filters.productionOrderNo && binding.productionOrderNo !== filters.productionOrderNo) return false
    if (filters.targetFactoryId && binding.targetFactoryId !== filters.targetFactoryId) return false
    if (filters.keyword) {
      const keyword = normalizeText(filters.keyword)
      const haystack = [
        binding.productionOrderNo,
        binding.cuttingOrderNo,
        binding.feiTicketNo,
        binding.partName,
        binding.colorName,
        binding.sizeCode,
      ].join(' ')
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

function buildPickupRecordFromBinding(
  binding: InternalBinding,
  pickupHeadId: string,
  sequenceNo: number,
  operatorName: string,
  submittedAt: string,
): PdaPickupRecord {
  const handedQty = getBindingFlowQty(binding)
  return {
    recordId: `SCPR-${binding.bindingId}`,
    handoverId: pickupHeadId,
    taskId: binding.taskOrderId,
    sequenceNo,
    materialCode: binding.craftCode,
    materialName: binding.operationName,
    materialSpec: binding.partName,
    skuCode: binding.productionOrderNo,
    skuColor: binding.colorName,
    skuSize: binding.sizeCode,
    pieceName: binding.partName,
    pickupMode: 'WAREHOUSE_DELIVERY',
    pickupModeLabel: '仓库配送到厂',
    materialSummary: `${binding.operationName} / 菲票 ${binding.feiTicketNo}`,
    qtyExpected: handedQty,
    qtyActual: undefined,
    qtyUnit: binding.unit,
    submittedAt,
    status: 'PENDING_FACTORY_CONFIRM',
    qrCodeValue: buildTaskQrValue(`SCPR-${binding.bindingId}`),
    warehouseHandedQty: handedQty,
    warehouseHandedAt: submittedAt,
    warehouseHandedBy: operatorName,
    remark: '特殊工艺发料待领料',
  }
}

export function createSpecialCraftDispatchHandoverFromFeiTickets(input: {
  cuttingFactoryId: string
  cuttingFactoryName: string
  targetFactoryId: string
  targetFactoryName: string
  operationId: string
  operationName: string
  selectedFeiTicketNos: string[]
  operatorName: string
  submittedAt: string
}): {
  handoverOrder: PdaHandoverHead
  handoverRecord: PdaHandoverRecord
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const selectedBindings = input.selectedFeiTicketNos.map((feiTicketNo) =>
    assertSpecialCraftDispatchAllowed({
      feiTicketNo,
      operationId: input.operationId,
      targetFactoryId: input.targetFactoryId,
    }),
  )
  if (!selectedBindings.length) {
    throw new Error('本次未选择可发料菲票。')
  }
  const handoverOrder = ensureDispatchHead(selectedBindings[0], selectedBindings)
  const pickupHead = ensurePickupHead(selectedBindings[0], selectedBindings)
  let latestRecord: PdaHandoverRecord | null = null
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []

  selectedBindings.forEach((binding, index) => {
    const handoverQty = getBindingFlowQty(binding)
    if (binding.dispatchHandoverRecordId) {
      updatedBindings.push(cloneValue(binding))
      return
    }
    const record = createFactoryHandoverRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      submittedQty: handoverQty,
      qtyUnit: binding.unit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.operatorName,
      factoryRemark: `特殊工艺发料 · ${binding.feiTicketNo}`,
      objectType: 'CUT_PIECE',
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: `${binding.partName} / ${binding.colorName} / ${binding.sizeCode}`,
      garmentEquivalentQty: handoverQty,
      materialCode: binding.craftCode,
      materialName: binding.operationName,
      materialSpec: binding.partName,
      skuCode: binding.productionOrderNo,
      skuColor: binding.colorName,
      skuSize: binding.sizeCode,
      pieceName: binding.partName,
      cutPieceLines: [getBindingRecordLine(binding)],
    })
    latestRecord = record
    upsertPdaPickupRecordMock(
      buildPickupRecordFromBinding(binding, pickupHead.handoverId, index + 1, input.operatorName, input.submittedAt),
    )
    const outboundLink = linkHandoverRecordToOutboundRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      handoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
      handoverRecordId: record.handoverRecordId || record.recordId,
      handoverRecordNo: record.handoverRecordNo || record.recordId,
      handoverRecordQrValue: record.handoverRecordQrValue,
      taskId: binding.taskOrderId,
      taskNo: binding.taskOrderNo,
      factoryId: input.cuttingFactoryId,
      factoryName: input.cuttingFactoryName,
      receiverKind: '特殊工艺厂',
      receiverName: input.targetFactoryName,
      itemKind: '裁片',
      itemName: `${binding.operationName}裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      submittedQty: handoverQty,
      unit: binding.unit,
      operatorName: input.operatorName,
      submittedAt: input.submittedAt,
    })
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      dispatchHandoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      dispatchHandoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
      dispatchHandoverRecordId: record.handoverRecordId || record.recordId,
      dispatchHandoverRecordNo: record.handoverRecordNo || record.recordId,
      feiTicketStatus: '已发料',
      specialCraftFlowStatus: '已发料',
      currentLocation: '特殊工艺厂待领料',
      updatedAt: input.submittedAt,
    }))
    const eventBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '发料',
        beforeQty: binding.currentQty,
        changedQty: 0,
        afterQty: handoverQty,
        operatorName: input.operatorName,
        occurredAt: input.submittedAt,
        relatedRecordId: record.handoverRecordId || record.recordId,
        relatedRecordNo: record.handoverRecordNo || record.recordId,
      }),
    )
    flowStore!.pickupRecordToDispatchRecordId.set(`SCPR-${binding.bindingId}`, record.handoverRecordId || record.recordId)
    updatedBindings.push(cloneValue(eventBinding))
    void outboundLink
  })

  syncHandoutHeadSummary(handoverOrder.handoverId)
  syncPickupHeadSummary(pickupHead.handoverId)
  recomputeSequenceGate(flowStore!, selectedBindings[0].productionOrderId)

  return {
    handoverOrder: findPdaHandoverHead(handoverOrder.handoverId) || handoverOrder,
    handoverRecord: latestRecord || findPdaHandoverRecord(updatedBindings[0].dispatchHandoverRecordId || '')!,
    updatedBindings,
  }
}

function getDispatchRecordIdByPickupRecordId(pickupRecordId: string): string | undefined {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.pickupRecordToDispatchRecordId.get(pickupRecordId)
}

export function getSpecialCraftBindingByPickupRecordId(
  pickupRecordId: string,
): CuttingSpecialCraftFeiTicketBinding | undefined {
  const dispatchRecordId = getDispatchRecordIdByPickupRecordId(pickupRecordId)
  if (!dispatchRecordId) return undefined
  ensureSpecialCraftFeiTicketFlowSeeded()
  const matched = getDispatchBindingsByRecordId(flowStore!, dispatchRecordId)[0]
  return matched ? cloneValue(matched) : undefined
}

export function getSpecialCraftReturnBindingsByHandoverRecordId(
  handoverRecordId: string,
): CuttingSpecialCraftFeiTicketBinding[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return getReturnBindingsByRecordId(flowStore!, handoverRecordId).map(cloneValue)
}

export function isSpecialCraftDispatchPickupRecord(pickupRecordId: string): boolean {
  return Boolean(getDispatchRecordIdByPickupRecordId(pickupRecordId))
}

export function isSpecialCraftReturnHandoverRecord(handoverRecordId: string): boolean {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings.some((binding) => binding.returnHandoverRecordId === handoverRecordId)
}

export function markSpecialCraftFactoryReceivedFromHandover(input: {
  handoverRecordId: string
  receivedFeiTicketNos: string[]
  receiverWrittenQty: number
  receiverName: string
  receivedAt: string
  differenceReason?: string
}): {
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
  inboundRecords: FactoryWarehouseInboundRecord[]
  waitProcessStockItems: FactoryWaitProcessStockItem[]
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const targetBindings = getDispatchBindingsByRecordId(flowStore!, input.handoverRecordId).filter((binding) =>
    input.receivedFeiTicketNos.includes(binding.feiTicketNo),
  )
  const inboundRecords: FactoryWarehouseInboundRecord[] = []
  const waitProcessStockItems: FactoryWaitProcessStockItem[] = []
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []

  targetBindings.forEach((binding) => {
    const pickupRecordId = `SCPR-${binding.bindingId}`
    const pickupRecord = findPdaPickupRecord(pickupRecordId)
    if (!pickupRecord) return
    const expectedQty = binding.openingQty || binding.currentQty || binding.qty
    const receivedQty = targetBindings.length === 1 ? input.receiverWrittenQty : expectedQty
    const differenceQty = roundQty(receivedQty - expectedQty)
    if (differenceQty !== 0) {
      upsertPdaPickupRecordMock({
        ...pickupRecord,
        status: 'OBJECTION_REPORTED',
        qtyActual: receivedQty,
        factoryReportedQty: receivedQty,
        objectionReason: input.differenceReason || '数量不符',
        objectionRemark: input.differenceReason || '数量不符',
        objectionStatus: 'REPORTED',
        receivedAt: input.receivedAt,
      })
    } else {
      upsertPdaPickupRecordMock({
        ...pickupRecord,
        status: 'RECEIVED',
        qtyActual: receivedQty,
        receivedAt: input.receivedAt,
        factoryConfirmedQty: receivedQty,
        factoryConfirmedAt: input.receivedAt,
      })
    }
    const linked = linkPickupConfirmToInboundRecord({
      pickupRecordId,
      pickupRecordNo: pickupRecordId,
      factoryId: binding.targetFactoryId,
      factoryName: binding.targetFactoryName,
      taskId: binding.taskOrderId,
      taskNo: binding.taskOrderNo,
      sourceObjectName: getCuttingFactory().name,
      itemKind: '裁片',
      itemName: `${binding.operationName}裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      expectedQty,
      receivedQty,
      unit: binding.unit,
      receiverName: input.receiverName,
      receivedAt: input.receivedAt,
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
    })
    inboundRecords.push(linked.inboundRecord)
    waitProcessStockItems.push(linked.waitProcessStockItem)
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      receiverWrittenQty: receivedQty,
      differenceQty,
      receivedQty,
      currentQty: receivedQty,
      feiTicketStatus: '已接收',
      specialCraftFlowStatus: '已接收',
      currentLocation: '特殊工艺厂待加工仓',
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      updatedAt: input.receivedAt,
    }))
    const receivedBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '接收',
        beforeQty: expectedQty,
        changedQty: differenceQty,
        afterQty: receivedQty,
        operatorName: input.receiverName,
        occurredAt: input.receivedAt,
        relatedRecordId: pickupRecordId,
        relatedRecordNo: pickupRecordId,
      }),
    )
    if (differenceQty !== 0) {
      const report = createQtyDifferenceReport(flowStore!, receivedBinding, {
        reportPhase: '接收差异',
        expectedQty,
        actualQty: receivedQty,
        sourceRecordId: pickupRecordId,
        sourceRecordNo: pickupRecordId,
        reportedBy: input.receiverName,
        reportedAt: input.receivedAt,
        reason: input.differenceReason || '数量不符',
      })
      const reportedBinding = updateBinding(flowStore!, receivedBinding.bindingId, (current) => ({
        ...current,
        receiveDifferenceReportId: report.reportId,
        receiveDifferenceStatus: report.platformStatus,
      }))
      updatedBindings.push(cloneValue(reportedBinding))
      return
    }
    updatedBindings.push(cloneValue(receivedBinding))
  })

  const pickupHeadId = targetBindings[0] ? buildPickupHeadId(targetBindings[0].operationId, targetBindings[0].targetFactoryId) : ''
  if (pickupHeadId) {
    syncPickupHeadSummary(pickupHeadId)
  }
  return {
    updatedBindings,
    inboundRecords,
    waitProcessStockItems,
  }
}

export function recordSpecialCraftFeiTicketLossAndDamage(input: {
  bindingId?: string
  feiTicketNo?: string
  operationId?: string
  scrapQty: number
  damageQty: number
  reason?: string
  operatorName: string
  operatedAt: string
}): CuttingSpecialCraftFeiTicketBinding {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const binding = input.bindingId
    ? flowStore!.bindings.find((item) => item.bindingId === input.bindingId)
    : input.feiTicketNo && input.operationId
      ? findBindingByFeiTicketAndOperation(flowStore!, input.feiTicketNo, input.operationId)
      : undefined
  if (!binding) throw new Error('未找到特殊工艺菲票记录。')
  const scrapQty = roundQty(input.scrapQty)
  const damageQty = roundQty(input.damageQty)
  if (scrapQty + damageQty <= 0) throw new Error('报废数量和货损数量必须大于 0。')
  const sourceQty = binding.receivedQty || binding.currentQty || binding.openingQty
  if (scrapQty + damageQty > sourceQty) throw new Error('报废和货损数量不能超过当前实收数量。')
  let nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
    ...current,
    scrapQty,
    damageQty,
    closingQty: roundQty(sourceQty - scrapQty - damageQty),
    currentQty: roundQty(sourceQty - scrapQty - damageQty),
    cumulativeScrapQty: roundQty(current.cumulativeScrapQty + scrapQty),
    cumulativeDamageQty: roundQty(current.cumulativeDamageQty + damageQty),
    updatedAt: input.operatedAt,
  }))
  if (scrapQty > 0) {
    nextBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '报废',
        beforeQty: sourceQty,
        changedQty: -scrapQty,
        afterQty: roundQty(sourceQty - scrapQty),
        operatorName: input.operatorName,
        occurredAt: input.operatedAt,
        remark: input.reason,
      }),
    )
  }
  if (damageQty > 0) {
    nextBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '货损',
        beforeQty: roundQty(sourceQty - scrapQty),
        changedQty: -damageQty,
        afterQty: nextBinding.closingQty,
        operatorName: input.operatorName,
        occurredAt: input.operatedAt,
        remark: input.reason,
      }),
    )
  }
  return cloneValue(nextBinding)
}

export function linkSpecialCraftCompletionToReturnWaitHandoverStock(input: {
  taskOrderId: string
  completedFeiTicketNos: string[]
  completedQty: number
  lossQty?: number
  scrapQty?: number
  damageQty?: number
  operatorName: string
  completedAt: string
}): {
  waitHandoverStockItems: FactoryWaitHandoverStockItem[]
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const taskOrder = getSpecialCraftTaskOrderById(input.taskOrderId)
  if (!taskOrder) throw new Error(`未找到特殊工艺任务：${input.taskOrderId}`)
  const targetBindings = flowStore!.bindings.filter(
    (binding) =>
      binding.taskOrderId === input.taskOrderId
      && input.completedFeiTicketNos.includes(binding.feiTicketNo)
      && (binding.specialCraftFlowStatus === '已接收' || binding.specialCraftFlowStatus === '加工中'),
  )
  const waitHandoverStockItems: FactoryWaitHandoverStockItem[] = []
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []
  const returnHead = targetBindings[0] ? ensureReturnHead(targetBindings[0], targetBindings) : undefined

  targetBindings.forEach((binding) => {
    const receivedQty = binding.receivedQty || binding.currentQty || binding.openingQty || binding.qty
    const scrapQty = targetBindings.length === 1 ? roundQty(input.scrapQty ?? input.lossQty ?? binding.scrapQty ?? 0) : binding.scrapQty || 0
    const damageQty = targetBindings.length === 1 ? roundQty(input.damageQty ?? binding.damageQty ?? 0) : binding.damageQty || 0
    const closingQty = targetBindings.length === 1
      ? roundQty(input.completedQty || receivedQty - scrapQty - damageQty)
      : roundQty(receivedQty - scrapQty - damageQty)
    if (closingQty < 0) throw new Error('完工后数量不能小于 0。')
    const result = linkTaskCompletionToWaitHandoverStock({
      taskId: taskOrder.taskOrderId,
      taskNo: taskOrder.taskOrderNo,
      factoryId: binding.targetFactoryId,
      factoryName: binding.targetFactoryName,
      productionOrderId: binding.productionOrderId,
      productionOrderNo: binding.productionOrderNo,
      handoverOrderId: returnHead?.handoverOrderId || returnHead?.handoverId,
      handoverOrderNo: returnHead?.handoverOrderNo,
      itemKind: '裁片',
      itemName: `${binding.operationName}完成裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      completedQty: closingQty,
      lossQty: scrapQty + damageQty,
      unit: binding.unit,
      receiverKind: '裁床厂',
      receiverName: getCuttingFactory().name,
      completedAt: input.completedAt,
    })
    waitHandoverStockItems.push(result.waitHandoverStockItem)
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      receivedQty,
      scrapQty,
      damageQty,
      closingQty,
      currentQty: closingQty,
      cumulativeScrapQty: roundQty(current.cumulativeScrapQty + Math.max(scrapQty - current.scrapQty, 0)),
      cumulativeDamageQty: roundQty(current.cumulativeDamageQty + Math.max(damageQty - current.damageQty, 0)),
      feiTicketStatus: '待回仓',
      specialCraftFlowStatus: '待回仓',
      currentLocation: '特殊工艺厂待交出仓',
      updatedAt: input.completedAt,
    }))
    const completedBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '完工',
        beforeQty: receivedQty,
        changedQty: roundQty(closingQty - receivedQty),
        afterQty: closingQty,
        operatorName: input.operatorName,
        occurredAt: input.completedAt,
        relatedRecordId: result.waitHandoverStockItem.stockItemId,
        relatedRecordNo: result.waitHandoverStockItem.handoverOrderNo,
        remark: scrapQty || damageQty ? `报废 ${scrapQty}，货损 ${damageQty}` : undefined,
      }),
    )
    const waitReturnBinding = appendFlowEvent(
      flowStore!,
      completedBinding,
      makeFlowEvent(completedBinding, {
        eventType: '待回仓',
        beforeQty: closingQty,
        changedQty: 0,
        afterQty: closingQty,
        operatorName: '系统',
        occurredAt: input.completedAt,
        relatedRecordId: result.waitHandoverStockItem.stockItemId,
        relatedRecordNo: result.waitHandoverStockItem.handoverOrderNo,
      }),
    )
    updatedBindings.push(cloneValue(waitReturnBinding))
  })

  return { waitHandoverStockItems, updatedBindings }
}

export function createSpecialCraftReturnHandover(input: {
  specialCraftFactoryId: string
  specialCraftFactoryName: string
  cuttingFactoryId: string
  cuttingFactoryName: string
  operationId: string
  operationName: string
  selectedFeiTicketNos: string[]
  operatorName: string
  submittedAt: string
}): {
  handoverOrder: PdaHandoverHead
  handoverRecord: PdaHandoverRecord
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const selectedBindings = input.selectedFeiTicketNos.map((feiTicketNo) =>
    assertSpecialCraftReturnAllowed({
      feiTicketNo,
      operationId: input.operationId,
      receiverFactoryId: input.cuttingFactoryId,
    }),
  )
  if (!selectedBindings.length) throw new Error('本次未选择可回仓菲票。')
  const handoverOrder = ensureReturnHead(selectedBindings[0], selectedBindings)
  let latestRecord: PdaHandoverRecord | null = null
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []
  selectedBindings.forEach((binding) => {
    const returnQty = getBindingCompletionQty(binding)
    if (binding.returnHandoverRecordId) {
      updatedBindings.push(cloneValue(binding))
      return
    }
    const record = createFactoryHandoverRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      submittedQty: returnQty,
      qtyUnit: binding.unit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.operatorName,
      factoryRemark: `特殊工艺回仓 · ${binding.feiTicketNo}`,
      objectType: 'CUT_PIECE',
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: `${binding.partName} / ${binding.colorName} / ${binding.sizeCode}`,
      garmentEquivalentQty: returnQty,
      materialCode: binding.craftCode,
      materialName: binding.operationName,
      materialSpec: binding.partName,
      skuCode: binding.productionOrderNo,
      skuColor: binding.colorName,
      skuSize: binding.sizeCode,
      pieceName: binding.partName,
      cutPieceLines: [getBindingRecordLine(binding)],
    })
    latestRecord = record
    void linkHandoverRecordToOutboundRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      handoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
      handoverRecordId: record.handoverRecordId || record.recordId,
      handoverRecordNo: record.handoverRecordNo || record.recordId,
      handoverRecordQrValue: record.handoverRecordQrValue,
      taskId: binding.taskOrderId,
      taskNo: binding.taskOrderNo,
      factoryId: input.specialCraftFactoryId,
      factoryName: input.specialCraftFactoryName,
      receiverKind: '裁床厂',
      receiverName: input.cuttingFactoryName,
      itemKind: '裁片',
      itemName: `${binding.operationName}回仓裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      submittedQty: returnQty,
      unit: binding.unit,
      operatorName: input.operatorName,
      submittedAt: input.submittedAt,
    })
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      returnHandoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      returnHandoverOrderNo: handoverOrder.handoverOrderNo || handoverOrder.handoverId,
      returnHandoverRecordId: record.handoverRecordId || record.recordId,
      returnHandoverRecordNo: record.handoverRecordNo || record.recordId,
      feiTicketStatus: '待回仓',
      specialCraftFlowStatus: '待回仓',
      currentLocation: '回仓途中',
      updatedAt: input.submittedAt,
    }))
    const eventBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '回仓交出',
        beforeQty: returnQty,
        changedQty: 0,
        afterQty: returnQty,
        operatorName: input.operatorName,
        occurredAt: input.submittedAt,
        relatedRecordId: record.handoverRecordId || record.recordId,
        relatedRecordNo: record.handoverRecordNo || record.recordId,
      }),
    )
    updatedBindings.push(cloneValue(eventBinding))
  })
  syncHandoutHeadSummary(handoverOrder.handoverId)
  return {
    handoverOrder: findPdaHandoverHead(handoverOrder.handoverId) || handoverOrder,
    handoverRecord: latestRecord || findPdaHandoverRecord(updatedBindings[0].returnHandoverRecordId || '')!,
    updatedBindings,
  }
}

export function receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse(input: {
  returnHandoverRecordId: string
  receivedFeiTicketNos: string[]
  receiverWrittenQty: number
  receiverName: string
  receivedAt: string
  differenceReason?: string
}): {
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
  cuttingWaitHandoverStockItems: FactoryWaitHandoverStockItem[]
  inboundOrReturnRecords: FactoryWarehouseInboundRecord[]
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const targetBindings = getReturnBindingsByRecordId(flowStore!, input.returnHandoverRecordId).filter((binding) =>
    input.receivedFeiTicketNos.includes(binding.feiTicketNo),
  )
  const handoverRecord = findPdaHandoverRecord(input.returnHandoverRecordId)
  if (!handoverRecord) {
    throw new Error(`未找到回仓交出记录：${input.returnHandoverRecordId}`)
  }
  if (!handoverRecord.receiverWrittenAt) {
    writeBackHandoverRecord({
      handoverRecordId: input.returnHandoverRecordId,
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receivedAt,
      receiverWrittenBy: input.receiverName,
      diffReason: input.differenceReason,
    })
  }
  void syncReceiverWritebackToOutboundRecord({
    handoverRecordId: input.returnHandoverRecordId,
    receiverWrittenQty: input.receiverWrittenQty,
    receiverWrittenAt: input.receivedAt,
    receiverWrittenBy: input.receiverName,
    differenceQty: targetBindings.length === 1 ? roundQty(input.receiverWrittenQty - getBindingCompletionQty(targetBindings[0])) : 0,
  })
  const cuttingWarehouse = getCuttingWaitHandoverWarehouse()
  const cuttingWaitHandoverStockItems: FactoryWaitHandoverStockItem[] = []
  const inboundOrReturnRecords: FactoryWarehouseInboundRecord[] = []
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []

  targetBindings.forEach((binding) => {
    const expectedQty = getBindingCompletionQty(binding)
    const receivedQty = targetBindings.length === 1 ? input.receiverWrittenQty : expectedQty
    const differenceQty = roundQty(receivedQty - expectedQty)
    const position = getPositionSeed(cuttingWarehouse, binding, differenceQty !== 0 ? '异常区' : '待确认区')
    const inboundRecord = upsertFactoryWarehouseInboundRecord({
      inboundRecordId: `SC-RET-INB-${binding.bindingId}`,
      inboundRecordNo: `RK-${binding.feiTicketNo}`,
      warehouseId: cuttingWarehouse.warehouseId,
      warehouseName: cuttingWarehouse.warehouseName,
      factoryId: getCuttingFactory().id,
      factoryName: getCuttingFactory().name,
      factoryKind: getCuttingFactory().factoryType,
      processCode: binding.processCode,
      processName: binding.processName,
      craftCode: binding.craftCode,
      craftName: binding.craftName,
      sourceRecordId: input.returnHandoverRecordId,
      sourceRecordNo: binding.returnHandoverRecordNo || input.returnHandoverRecordId,
      sourceRecordType: 'HANDOVER_RECEIVE',
      sourceObjectName: binding.targetFactoryName,
      taskId: binding.taskOrderId,
      taskNo: binding.taskOrderNo,
      itemKind: '裁片',
      itemName: `${binding.operationName}回仓裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      expectedQty,
      receivedQty,
      differenceQty,
      unit: binding.unit,
      receiverName: input.receiverName,
      receivedAt: input.receivedAt,
      areaName: position.areaName,
      shelfNo: position.shelfNo,
      locationNo: position.locationNo,
      status: differenceQty !== 0 ? '差异待处理' : '已入库',
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      photoList: [],
      remark: '特殊工艺回仓接收，进入裁床厂待交出仓',
    })
    inboundOrReturnRecords.push(inboundRecord)
    const waitHandoverStockItem = upsertFactoryWaitHandoverStockItem({
      stockItemId: `SC-RET-WHS-${binding.bindingId}`,
      warehouseId: cuttingWarehouse.warehouseId,
      factoryId: getCuttingFactory().id,
      factoryName: getCuttingFactory().name,
      factoryKind: getCuttingFactory().factoryType,
      warehouseName: cuttingWarehouse.warehouseName,
      processCode: binding.processCode,
      processName: binding.processName,
      craftCode: binding.craftCode,
      craftName: binding.craftName,
      taskId: binding.taskOrderId,
      taskNo: binding.taskOrderNo,
      productionOrderId: binding.productionOrderId,
      productionOrderNo: binding.productionOrderNo,
      itemKind: '裁片',
      itemName: `${binding.operationName}回仓裁片`,
      partName: binding.partName,
      fabricColor: binding.colorName,
      sizeCode: binding.sizeCode,
      feiTicketNo: binding.feiTicketNo,
      completedQty: receivedQty,
      lossQty: 0,
      waitHandoverQty: Math.max(receivedQty, 0),
      unit: binding.unit,
      receiverKind: '裁片仓',
      receiverName: '裁床厂待交出仓',
      handoverOrderId: binding.returnHandoverOrderId,
      handoverOrderNo: binding.returnHandoverOrderNo,
      handoverRecordId: binding.returnHandoverRecordId,
      handoverRecordNo: binding.returnHandoverRecordNo,
      handoverRecordQrValue: handoverRecord.handoverRecordQrValue,
      receiverWrittenQty: receivedQty,
      differenceQty: differenceQty || undefined,
      objectionStatus: differenceQty !== 0 ? '差异待处理' : undefined,
      areaName: position.areaName,
      shelfNo: position.shelfNo,
      locationNo: position.locationNo,
      locationText: position.locationText,
      status: '待交出',
      photoList: [],
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      remark: '特殊工艺回仓进入裁床厂待交出仓',
    })
    cuttingWaitHandoverStockItems.push(waitHandoverStockItem)
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      receiverWrittenQty: receivedQty,
      differenceQty,
      returnedQty: receivedQty,
      currentQty: receivedQty,
      feiTicketStatus: '已回仓',
      specialCraftFlowStatus: '已回仓',
      currentLocation: '裁床厂待交出仓',
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      updatedAt: input.receivedAt,
    }))
    const receivedBinding = appendFlowEvent(
      flowStore!,
      nextBinding,
      makeFlowEvent(nextBinding, {
        eventType: '回仓接收',
        beforeQty: expectedQty,
        changedQty: differenceQty,
        afterQty: receivedQty,
        operatorName: input.receiverName,
        occurredAt: input.receivedAt,
        relatedRecordId: input.returnHandoverRecordId,
        relatedRecordNo: binding.returnHandoverRecordNo || input.returnHandoverRecordId,
      }),
    )
    if (differenceQty !== 0) {
      const report = createQtyDifferenceReport(flowStore!, receivedBinding, {
        reportPhase: '回仓差异',
        expectedQty,
        actualQty: receivedQty,
        sourceRecordId: input.returnHandoverRecordId,
        sourceRecordNo: binding.returnHandoverRecordNo || input.returnHandoverRecordId,
        reportedBy: input.receiverName,
        reportedAt: input.receivedAt,
        reason: input.differenceReason || '数量不符',
      })
      const reportedBinding = updateBinding(flowStore!, receivedBinding.bindingId, (current) => ({
        ...current,
        returnDifferenceReportId: report.reportId,
        returnDifferenceStatus: report.platformStatus,
      }))
      updatedBindings.push(cloneValue(reportedBinding))
      return
    }
    updatedBindings.push(cloneValue(receivedBinding))
  })

  recomputeSequenceGate(flowStore!, targetBindings[0]?.productionOrderId, targetBindings[0]?.feiTicketNo)
  return {
    updatedBindings,
    cuttingWaitHandoverStockItems,
    inboundOrReturnRecords,
  }
}

export function syncSpecialCraftReturnObjectionByHandoverRecord(input: {
  handoverRecordId: string
  objectionId: string
  objectionStatus: string
}): {
  updatedBindings: CuttingSpecialCraftFeiTicketBinding[]
  outboundRecord?: FactoryWarehouseOutboundRecord
  cuttingWaitHandoverStockItem?: FactoryWaitHandoverStockItem
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const outboundSync = syncQuantityObjectionToOutboundRecord({
    handoverRecordId: input.handoverRecordId,
    objectionId: input.objectionId,
    objectionStatus: input.objectionStatus,
  })
  const updatedBindings = getReturnBindingsByRecordId(flowStore!, input.handoverRecordId).map((binding) =>
    updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      objectionStatus: '异议中',
      returnDifferenceStatus: current.returnDifferenceStatus === '已处理' ? '已处理' : '处理中',
      feiTicketStatus: current.specialCraftFlowStatus,
      specialCraftFlowStatus: current.specialCraftFlowStatus,
      currentLocation: current.currentLocation,
      updatedAt: getNowText(),
    })),
  )
  const currentWaitHandover = findFactoryWaitHandoverStockItemByHandoverRecordId(input.handoverRecordId)
  const cuttingWaitHandoverStockItem = currentWaitHandover
    ? upsertFactoryWaitHandoverStockItem({
        ...currentWaitHandover,
        status: '异议中',
        objectionStatus: '异议中',
      })
    : undefined
  return {
    updatedBindings: updatedBindings.map(cloneValue),
    outboundRecord: outboundSync.updatedOutboundRecord,
    cuttingWaitHandoverStockItem,
  }
}

export function getCuttingSpecialCraftReturnStatusByProductionOrder(productionOrderId: string): {
  productionOrderNo: string
  totalNeedSpecialCraftFeiTickets: number
  waitDispatchCount: number
  dispatchedCount: number
  receivedBySpecialFactoryCount: number
  completedCount: number
  waitReturnCount: number
  returnedCount: number
  differenceCount: number
  objectionCount: number
  allReturned: boolean
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const orderBindings = flowStore!.bindings.filter((binding) => binding.productionOrderId === productionOrderId)
  const productionOrderNo = orderBindings[0]?.productionOrderNo || productionOrderId
  const totalNeedSpecialCraftFeiTickets = orderBindings.length
  const waitDispatchCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '待发料').length
  const dispatchedCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已发料').length
  const receivedBySpecialFactoryCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已接收').length
  const completedCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓').length
  const waitReturnCount = orderBindings.filter(
    (binding) =>
      binding.specialCraftFlowStatus === '待回仓' || binding.currentLocation === '回仓途中',
  ).length
  const returnedCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '已回仓').length
  const differenceCount = orderBindings.filter(
    (binding) => getOpenDifferenceStatus(binding.receiveDifferenceStatus) || getOpenDifferenceStatus(binding.returnDifferenceStatus),
  ).length
  const objectionCount = orderBindings.filter((binding) => binding.objectionStatus === '异议中').length
  const lastByFeiTicket = new Map<string, InternalBinding>()
  orderBindings.forEach((binding) => {
    const existing = lastByFeiTicket.get(binding.feiTicketNo)
    if (!existing || binding.sequenceIndex > existing.sequenceIndex) {
      lastByFeiTicket.set(binding.feiTicketNo, binding)
    }
  })
  const allReturned =
    lastByFeiTicket.size > 0
    && [...lastByFeiTicket.values()].every(
      (binding) =>
        binding.specialCraftFlowStatus === '已回仓'
        && binding.currentLocation === '裁床厂待交出仓'
        && binding.currentQty > 0,
    )
  return {
    productionOrderNo,
    totalNeedSpecialCraftFeiTickets,
    waitDispatchCount,
    dispatchedCount,
    receivedBySpecialFactoryCount,
    completedCount,
    waitReturnCount,
    returnedCount,
    differenceCount,
    objectionCount,
    allReturned,
  }
}

export function getSpecialCraftBindingsByTaskOrderId(taskOrderId: string): CuttingSpecialCraftFeiTicketBinding[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings
    .filter((binding) => binding.taskOrderId === taskOrderId)
    .map(cloneValue)
}

export function getSpecialCraftBindingSummaryByTaskOrderId(taskOrderId: string): {
  linkedFeiTicketCount: number
  dispatchedFeiTicketCount: number
  receivedFeiTicketCount: number
  completedFeiTicketCount: number
  returnedFeiTicketCount: number
  receiveDifferenceTicketCount: number
  returnDifferenceTicketCount: number
  differenceFeiTicketCount: number
  cumulativeScrapQty: number
  cumulativeDamageQty: number
  currentQty: number
  childWorkOrderCount: number
  returnStatus: string
} {
  const bindings = getSpecialCraftBindingsByTaskOrderId(taskOrderId)
  const linkedFeiTicketCount = bindings.length
  const dispatchedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已发料').length
  const receivedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已接收').length
  const completedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓').length
  const returnedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已回仓').length
  const receiveDifferenceTicketCount = bindings.filter((binding) => getOpenDifferenceStatus(binding.receiveDifferenceStatus)).length
  const returnDifferenceTicketCount = bindings.filter((binding) => getOpenDifferenceStatus(binding.returnDifferenceStatus)).length
  const differenceFeiTicketCount = receiveDifferenceTicketCount + returnDifferenceTicketCount
  const cumulativeScrapQty = roundQty(bindings.reduce((total, binding) => total + binding.cumulativeScrapQty, 0))
  const cumulativeDamageQty = roundQty(bindings.reduce((total, binding) => total + binding.cumulativeDamageQty, 0))
  const currentQty = roundQty(bindings.reduce((total, binding) => total + binding.currentQty, 0))
  const childWorkOrderCount = new Set(bindings.map((binding) => binding.workOrderId).filter(Boolean)).size
  const returnStatus =
    completedFeiTicketCount > 0
        ? '待回仓'
        : returnedFeiTicketCount > 0 && returnedFeiTicketCount === linkedFeiTicketCount
          ? differenceFeiTicketCount > 0
            ? '已回仓 · 差异待处理'
            : '已回仓'
          : dispatchedFeiTicketCount > 0
            ? '处理中'
            : linkedFeiTicketCount > 0
              ? '待发料'
              : '待绑定'
  return {
    linkedFeiTicketCount,
    dispatchedFeiTicketCount,
    receivedFeiTicketCount,
    completedFeiTicketCount,
    returnedFeiTicketCount,
    receiveDifferenceTicketCount,
    returnDifferenceTicketCount,
    differenceFeiTicketCount,
    cumulativeScrapQty,
    cumulativeDamageQty,
    currentQty,
    childWorkOrderCount,
    returnStatus,
  }
}

export function getSpecialCraftFeiTicketScanSummary(feiTicketNo: string): {
  hasSpecialCraft: boolean
  operationNames: string[]
  completedOperationNames: string[]
  currentOperationName: string
  nextOperationName: string
  currentFlowStatus: string
  currentLocation: string
  originalQty: number
  currentQty: number
  cumulativeScrapQty: number
  cumulativeDamageQty: number
  hasOpenReceiveDifference: boolean
  hasOpenReturnDifference: boolean
  blockingReason: string
  parentTaskOrderNo: string
  workOrderNo: string
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const bindings = (flowStore?.bindings || [])
    .filter((binding) => binding.feiTicketNo === feiTicketNo)
    .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
  if (!bindings.length) {
    return {
      hasSpecialCraft: false,
      operationNames: [],
      completedOperationNames: [],
      currentOperationName: '无特殊工艺',
      nextOperationName: '',
      currentFlowStatus: '无特殊工艺',
      currentLocation: '裁床厂待交出仓',
      originalQty: getFeiTicketByNo(feiTicketNo)?.qty || 0,
      currentQty: getFeiTicketByNo(feiTicketNo)?.qty || 0,
      cumulativeScrapQty: 0,
      cumulativeDamageQty: 0,
      hasOpenReceiveDifference: false,
      hasOpenReturnDifference: false,
      blockingReason: '',
      parentTaskOrderNo: '',
      workOrderNo: '',
    }
  }
  const current =
    bindings.find((binding) => binding.specialCraftFlowStatus !== '已回仓')
    || bindings[bindings.length - 1]
  const completedOperationNames = bindings
    .filter((binding) => binding.specialCraftFlowStatus === '已回仓')
    .map((binding) => binding.operationName)
  const hasOpenReceiveDifference = bindings.some((binding) => getOpenDifferenceStatus(binding.receiveDifferenceStatus))
  const hasOpenReturnDifference = bindings.some((binding) => getOpenDifferenceStatus(binding.returnDifferenceStatus))
  const blockingReason =
    current.specialCraftFlowStatus === '待确认顺序'
      ? '等待前一道回仓'
      : current.currentQty <= 0
        ? '当前数量为 0'
        : ''
  return {
    hasSpecialCraft: true,
    operationNames: bindings.map((binding) => binding.operationName),
    completedOperationNames,
    currentOperationName: current.operationName,
    nextOperationName: current.nextOperationName || '',
    currentFlowStatus: current.specialCraftFlowStatus,
    currentLocation: current.currentLocation,
    originalQty: bindings[0].originalQty,
    currentQty: current.currentQty,
    cumulativeScrapQty: roundQty(bindings.reduce((total, binding) => total + binding.cumulativeScrapQty, 0)),
    cumulativeDamageQty: roundQty(bindings.reduce((total, binding) => total + binding.cumulativeDamageQty, 0)),
    hasOpenReceiveDifference,
    hasOpenReturnDifference,
    blockingReason,
    parentTaskOrderNo: current.taskOrderNo,
    workOrderNo: current.workOrderNo,
  }
}

export function getSpecialCraftFeiTicketSummary(feiTicketNo: string): {
  needSpecialCraft: boolean
  operationNames: string[]
  completedOperationNames: string[]
  currentOperationName: string
  nextOperationName: string
  taskOrderNos: string[]
  dispatchStatus: string
  returnStatus: string
  currentLocation: string
  originalQty: number
  currentQty: number
  cumulativeScrapQty: number
  cumulativeDamageQty: number
  receiveDifferenceStatus: string
  returnDifferenceStatus: string
} {
  const scanSummary = getSpecialCraftFeiTicketScanSummary(feiTicketNo)
  const bindings = flowStore?.bindings.filter((binding) => binding.feiTicketNo === feiTicketNo) || []
  if (!scanSummary.hasSpecialCraft) {
    return {
      needSpecialCraft: false,
      operationNames: [],
      completedOperationNames: [],
      currentOperationName: '无特殊工艺',
      nextOperationName: '',
      taskOrderNos: [],
      dispatchStatus: '无',
      returnStatus: '无',
      currentLocation: '裁床厂待交出仓',
      originalQty: scanSummary.originalQty,
      currentQty: scanSummary.currentQty,
      cumulativeScrapQty: 0,
      cumulativeDamageQty: 0,
      receiveDifferenceStatus: '—',
      returnDifferenceStatus: '—',
    }
  }
  const latest = bindings.find((binding) => binding.operationName === scanSummary.currentOperationName) || bindings[bindings.length - 1]
  return {
    needSpecialCraft: true,
    operationNames: scanSummary.operationNames,
    completedOperationNames: scanSummary.completedOperationNames,
    currentOperationName: scanSummary.currentOperationName,
    nextOperationName: scanSummary.nextOperationName,
    taskOrderNos: Array.from(new Set(bindings.map((binding) => binding.taskOrderNo))),
    dispatchStatus: scanSummary.currentFlowStatus,
    returnStatus:
      latest?.specialCraftFlowStatus === '已回仓'
        ? scanSummary.hasOpenReturnDifference ? '已回仓 · 差异待处理' : '已回仓'
        : latest?.currentLocation === '回仓途中'
          ? '回仓途中'
          : latest?.specialCraftFlowStatus === '待回仓'
            ? '待回仓'
            : latest?.specialCraftFlowStatus || '待发料',
    currentLocation: scanSummary.currentLocation,
    originalQty: scanSummary.originalQty,
    currentQty: scanSummary.currentQty,
    cumulativeScrapQty: scanSummary.cumulativeScrapQty,
    cumulativeDamageQty: scanSummary.cumulativeDamageQty,
    receiveDifferenceStatus: scanSummary.hasOpenReceiveDifference ? '差异待处理' : '—',
    returnDifferenceStatus: scanSummary.hasOpenReturnDifference ? '差异待处理' : '—',
  }
}

export function listCuttingSpecialCraftFeiTicketBindings(): CuttingSpecialCraftFeiTicketBinding[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings.map(cloneValue)
}

export function listSpecialCraftQtyDifferenceReports(): SpecialCraftQtyDifferenceReport[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.differenceReports.map(cloneValue)
}

export function getSpecialCraftQtyDifferenceReportsByTaskOrderId(taskOrderId: string): SpecialCraftQtyDifferenceReport[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.differenceReports.filter((report) => report.taskOrderId === taskOrderId).map(cloneValue)
}

export function getSpecialCraftFeiTicketFlowEventsByWorkOrderId(workOrderId: string): SpecialCraftFeiTicketFlowEvent[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.flowEvents.filter((event) => event.workOrderId === workOrderId).map(cloneValue)
}

export function listCuttingSpecialCraftDispatchViews(): CuttingSpecialCraftDispatchView[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const bindingViews = flowStore!.bindings.map((binding) => ({
    dispatchViewId: `SCDV-${binding.bindingId}`,
    productionOrderNo: binding.productionOrderNo,
    cuttingOrderNo: binding.cuttingOrderNo,
    operationName: binding.operationName,
    targetFactoryName: binding.targetFactoryName,
    feiTicketNo: binding.feiTicketNo,
    partName: binding.partName,
    colorName: binding.colorName,
    sizeCode: binding.sizeCode,
    qty: binding.currentQty || binding.qty,
    dispatchStatus:
      binding.specialCraftFlowStatus === '待确认顺序'
        ? '待确认顺序'
        : binding.objectionStatus === '异议中'
            ? '异议中'
            : binding.specialCraftFlowStatus === '已接收'
              ? '已接收'
              : binding.specialCraftFlowStatus === '已发料'
                ? '已发料'
                : binding.specialCraftFlowStatus === '待绑定'
                  ? '待绑定'
                  : '待发料',
    handoverRecordNo: binding.dispatchHandoverRecordNo || '未创建',
    receiverStatus:
      binding.specialCraftFlowStatus === '已接收'
        ? getOpenDifferenceStatus(binding.receiveDifferenceStatus)
          ? '已接收 · 差异待处理'
          : '已接收'
        : binding.objectionStatus === '异议中'
          ? '异议中'
          : '待接收',
    returnStatus:
      binding.specialCraftFlowStatus === '已回仓'
        ? '已回仓'
        : binding.objectionStatus === '异议中'
          ? '异议中'
          : binding.currentLocation === '回仓途中'
              ? '回仓途中'
              : binding.specialCraftFlowStatus === '待回仓'
                ? '待回仓'
                : '未回仓',
    currentLocation: binding.currentLocation,
    operationLabel: getBindingFlowLabel(binding),
  }))
  const pendingViews = flowStore!.pendingBindingViews.map((view) => ({
    dispatchViewId: view.pendingViewId,
    productionOrderNo: view.productionOrderNo,
    cuttingOrderNo: view.cuttingOrderNo,
    operationName: view.operationName,
    targetFactoryName: view.targetFactoryName,
    feiTicketNo: '待绑定',
    partName: view.partName,
    colorName: view.colorName,
    sizeCode: view.sizeCode,
    qty: view.qty,
    dispatchStatus: '待绑定' as const,
    handoverRecordNo: '未创建',
    receiverStatus: '待绑定',
    returnStatus: '未回仓' as const,
    currentLocation: '裁床厂待交出仓' as const,
    operationLabel: view.reason,
  }))
  return [...pendingViews, ...bindingViews]
}

export function listCuttingSpecialCraftReturnViews(): CuttingSpecialCraftReturnView[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings
    .filter((binding) => binding.returnHandoverRecordId || binding.specialCraftFlowStatus === '待回仓' || binding.specialCraftFlowStatus === '已回仓' || binding.specialCraftFlowStatus === '差异' || binding.specialCraftFlowStatus === '异议中')
    .map((binding) => ({
      returnViewId: `SCRV-${binding.bindingId}`,
      productionOrderNo: binding.productionOrderNo,
      cuttingOrderNo: binding.cuttingOrderNo,
      operationName: binding.operationName,
      sourceFactoryName: binding.targetFactoryName,
      feiTicketNo: binding.feiTicketNo,
      partName: binding.partName,
      colorName: binding.colorName,
    sizeCode: binding.sizeCode,
      qty: binding.currentQty || binding.qty,
      returnHandoverRecordNo: binding.returnHandoverRecordNo || '未创建',
      receiverWrittenQty: binding.receiverWrittenQty,
      differenceQty: binding.differenceQty,
      returnStatus:
        binding.specialCraftFlowStatus === '已回仓'
          ? '已回仓'
          : binding.objectionStatus === '异议中'
              ? '异议中'
              : binding.currentLocation === '回仓途中'
                ? '回仓途中'
                : binding.specialCraftFlowStatus === '待回仓'
                  ? '待回仓'
                  : '未回仓',
      cuttingWarehouseName: getCuttingWaitHandoverWarehouse().warehouseName,
      currentLocation: binding.currentLocation,
    }))
}

function seedPrompt7Scenario(store: FlowStore): void {
  const firstStageBindings = store.bindings.filter((binding) => binding.sequenceIndex <= 0).sort(sortBindings)
  const remainingBindings = [...firstStageBindings]
  const takeBinding = (predicate?: (binding: InternalBinding) => boolean): InternalBinding | undefined => {
    const matchIndex = predicate
      ? remainingBindings.findIndex(predicate)
      : 0
    if (matchIndex < 0) return undefined
    const [selected] = remainingBindings.splice(matchIndex, 1)
    return selected
  }

  const pendingBinding = takeBinding()
  const dispatchOnlyBinding = takeBinding()
  const receivedBinding = takeBinding()
  const waitReturnBinding = takeBinding()
  const returnedBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()
  const diffBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()
  const objectionBinding = takeBinding((binding) => binding.qty >= 2) || takeBinding()

  if (
    !pendingBinding
    && !dispatchOnlyBinding
    && !receivedBinding
    && !waitReturnBinding
    && !returnedBinding
    && !diffBinding
    && !objectionBinding
  ) {
    return
  }

  if (dispatchOnlyBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: dispatchOnlyBinding.targetFactoryId,
      targetFactoryName: dispatchOnlyBinding.targetFactoryName,
      operationId: dispatchOnlyBinding.operationId,
      operationName: dispatchOnlyBinding.operationName,
      selectedFeiTicketNos: [dispatchOnlyBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 10:40:00',
    })
  }

  if (receivedBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: receivedBinding.targetFactoryId,
      targetFactoryName: receivedBinding.targetFactoryName,
      operationId: receivedBinding.operationId,
      operationName: receivedBinding.operationName,
      selectedFeiTicketNos: [receivedBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 10:45:00',
    })
    markSpecialCraftFactoryReceivedFromHandover({
      handoverRecordId: findBindingByFeiTicketAndOperation(store, receivedBinding.feiTicketNo, receivedBinding.operationId)?.dispatchHandoverRecordId || '',
      receivedFeiTicketNos: [receivedBinding.feiTicketNo],
      receiverWrittenQty: receivedBinding.qty,
      receiverName: receivedBinding.targetFactoryName,
      receivedAt: '2026-04-23 11:00:00',
    })
  }

  if (waitReturnBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: waitReturnBinding.targetFactoryId,
      targetFactoryName: waitReturnBinding.targetFactoryName,
      operationId: waitReturnBinding.operationId,
      operationName: waitReturnBinding.operationName,
      selectedFeiTicketNos: [waitReturnBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 10:50:00',
    })
    markSpecialCraftFactoryReceivedFromHandover({
      handoverRecordId: findBindingByFeiTicketAndOperation(store, waitReturnBinding.feiTicketNo, waitReturnBinding.operationId)?.dispatchHandoverRecordId || '',
      receivedFeiTicketNos: [waitReturnBinding.feiTicketNo],
      receiverWrittenQty: waitReturnBinding.qty,
      receiverName: waitReturnBinding.targetFactoryName,
      receivedAt: '2026-04-23 11:05:00',
    })
    linkSpecialCraftCompletionToReturnWaitHandoverStock({
      taskOrderId: waitReturnBinding.taskOrderId,
      completedFeiTicketNos: [waitReturnBinding.feiTicketNo],
      completedQty: waitReturnBinding.qty,
      operatorName: PROMPT7_SEED_OPERATOR,
      completedAt: '2026-04-23 14:00:00',
    })
  }

  if (returnedBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: returnedBinding.targetFactoryId,
      targetFactoryName: returnedBinding.targetFactoryName,
      operationId: returnedBinding.operationId,
      operationName: returnedBinding.operationName,
      selectedFeiTicketNos: [returnedBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 10:55:00',
    })
    markSpecialCraftFactoryReceivedFromHandover({
      handoverRecordId: findBindingByFeiTicketAndOperation(store, returnedBinding.feiTicketNo, returnedBinding.operationId)?.dispatchHandoverRecordId || '',
      receivedFeiTicketNos: [returnedBinding.feiTicketNo],
      receiverWrittenQty: returnedBinding.qty,
      receiverName: returnedBinding.targetFactoryName,
      receivedAt: '2026-04-23 11:10:00',
    })
    linkSpecialCraftCompletionToReturnWaitHandoverStock({
      taskOrderId: returnedBinding.taskOrderId,
      completedFeiTicketNos: [returnedBinding.feiTicketNo],
      completedQty: returnedBinding.qty,
      operatorName: PROMPT7_SEED_OPERATOR,
      completedAt: '2026-04-23 14:15:00',
    })
    createSpecialCraftReturnHandover({
      specialCraftFactoryId: returnedBinding.targetFactoryId,
      specialCraftFactoryName: returnedBinding.targetFactoryName,
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      operationId: returnedBinding.operationId,
      operationName: returnedBinding.operationName,
      selectedFeiTicketNos: [returnedBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 16:00:00',
    })
    receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({
      returnHandoverRecordId: findBindingByFeiTicketAndOperation(store, returnedBinding.feiTicketNo, returnedBinding.operationId)?.returnHandoverRecordId || '',
      receivedFeiTicketNos: [returnedBinding.feiTicketNo],
      receiverWrittenQty: returnedBinding.qty,
      receiverName: '裁床扫码员',
      receivedAt: '2026-04-23 17:05:00',
    })
  }

  if (diffBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: diffBinding.targetFactoryId,
      targetFactoryName: diffBinding.targetFactoryName,
      operationId: diffBinding.operationId,
      operationName: diffBinding.operationName,
      selectedFeiTicketNos: [diffBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 11:15:00',
    })
    markSpecialCraftFactoryReceivedFromHandover({
      handoverRecordId: findBindingByFeiTicketAndOperation(store, diffBinding.feiTicketNo, diffBinding.operationId)?.dispatchHandoverRecordId || '',
      receivedFeiTicketNos: [diffBinding.feiTicketNo],
      receiverWrittenQty: diffBinding.qty,
      receiverName: diffBinding.targetFactoryName,
      receivedAt: '2026-04-23 11:25:00',
    })
    linkSpecialCraftCompletionToReturnWaitHandoverStock({
      taskOrderId: diffBinding.taskOrderId,
      completedFeiTicketNos: [diffBinding.feiTicketNo],
      completedQty: diffBinding.qty,
      operatorName: PROMPT7_SEED_OPERATOR,
      completedAt: '2026-04-23 14:25:00',
    })
    createSpecialCraftReturnHandover({
      specialCraftFactoryId: diffBinding.targetFactoryId,
      specialCraftFactoryName: diffBinding.targetFactoryName,
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      operationId: diffBinding.operationId,
      operationName: diffBinding.operationName,
      selectedFeiTicketNos: [diffBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 16:15:00',
    })
    receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({
      returnHandoverRecordId: findBindingByFeiTicketAndOperation(store, diffBinding.feiTicketNo, diffBinding.operationId)?.returnHandoverRecordId || '',
      receivedFeiTicketNos: [diffBinding.feiTicketNo],
      receiverWrittenQty: Math.max(diffBinding.qty - 1, 0),
      receiverName: '裁床扫码员',
      receivedAt: '2026-04-23 17:20:00',
      differenceReason: '回仓少收',
    })
  }

  if (objectionBinding) {
    createSpecialCraftDispatchHandoverFromFeiTickets({
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      targetFactoryId: objectionBinding.targetFactoryId,
      targetFactoryName: objectionBinding.targetFactoryName,
      operationId: objectionBinding.operationId,
      operationName: objectionBinding.operationName,
      selectedFeiTicketNos: [objectionBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 11:30:00',
    })
    markSpecialCraftFactoryReceivedFromHandover({
      handoverRecordId: findBindingByFeiTicketAndOperation(store, objectionBinding.feiTicketNo, objectionBinding.operationId)?.dispatchHandoverRecordId || '',
      receivedFeiTicketNos: [objectionBinding.feiTicketNo],
      receiverWrittenQty: objectionBinding.qty,
      receiverName: objectionBinding.targetFactoryName,
      receivedAt: '2026-04-23 11:40:00',
    })
    linkSpecialCraftCompletionToReturnWaitHandoverStock({
      taskOrderId: objectionBinding.taskOrderId,
      completedFeiTicketNos: [objectionBinding.feiTicketNo],
      completedQty: objectionBinding.qty,
      operatorName: PROMPT7_SEED_OPERATOR,
      completedAt: '2026-04-23 14:35:00',
    })
    createSpecialCraftReturnHandover({
      specialCraftFactoryId: objectionBinding.targetFactoryId,
      specialCraftFactoryName: objectionBinding.targetFactoryName,
      cuttingFactoryId: getCuttingFactory().id,
      cuttingFactoryName: getCuttingFactory().name,
      operationId: objectionBinding.operationId,
      operationName: objectionBinding.operationName,
      selectedFeiTicketNos: [objectionBinding.feiTicketNo],
      operatorName: PROMPT7_SEED_OPERATOR,
      submittedAt: '2026-04-23 16:30:00',
    })
    const returnRecordId = findBindingByFeiTicketAndOperation(store, objectionBinding.feiTicketNo, objectionBinding.operationId)?.returnHandoverRecordId || ''
    receiveSpecialCraftReturnToCuttingWaitHandoverWarehouse({
      returnHandoverRecordId: returnRecordId,
      receivedFeiTicketNos: [objectionBinding.feiTicketNo],
      receiverWrittenQty: Math.max(objectionBinding.qty - 1, 0),
      receiverName: '裁床扫码员',
      receivedAt: '2026-04-23 17:35:00',
      differenceReason: '回仓数量不符',
    })
    if (returnRecordId) {
      reportPdaHandoverQtyObjection(returnRecordId, {
        objectionReason: '数量不符',
        objectionRemark: '特殊工艺回仓数量不符，已发起数量异议',
      })
      syncSpecialCraftReturnObjectionByHandoverRecord({
        handoverRecordId: returnRecordId,
        objectionId: `QO-${returnRecordId}`,
        objectionStatus: 'REPORTED',
      })
    }
  }

  recomputeSequenceGate(store)
}

function ensureFlowStore(): FlowStore {
  if (flowStore) return flowStore
  const built = buildInternalBindings()
  flowStore = {
    bindings: built.bindings,
    differenceReports: [],
    flowEvents: built.bindings.map((binding, index) => ({
      eventId: `SCFE-${binding.bindingId}-${String(index + 1).padStart(4, '0')}`,
      bindingId: binding.bindingId,
      productionOrderId: binding.productionOrderId,
      taskOrderId: binding.taskOrderId,
      workOrderId: binding.workOrderId,
      operationId: binding.operationId,
      operationName: binding.operationName,
      feiTicketNo: binding.feiTicketNo,
      eventType: '绑定',
      beforeQty: binding.originalQty,
      changedQty: 0,
      afterQty: binding.currentQty,
      operatorName: '系统',
      occurredAt: binding.createdAt,
      remark: '由特殊工艺任务明细绑定菲票',
    })),
    warnings: built.warnings,
    errors: built.errors,
    pendingBindingViews: built.pendingBindingViews,
    pickupRecordToDispatchRecordId: new Map<string, string>(),
  }
  flowStore.bindings = flowStore.bindings.map((binding, index) => ({
    ...binding,
    flowEventIds: [flowStore!.flowEvents[index].eventId],
  }))
  seedPrompt7Scenario(flowStore)
  return flowStore
}

export function ensureSpecialCraftFeiTicketFlowSeeded(): void {
  ensureFlowStore()
}
