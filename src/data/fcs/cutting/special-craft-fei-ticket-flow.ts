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
  objectionStatus?: string
  abnormalReason?: string
  createdAt: string
  updatedAt: string
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
  warnings: string[]
  errors: string[]
  pendingBindingViews: Prompt7PendingBindingView[]
  pickupRecordToDispatchRecordId: Map<string, string>
}

const CUTTING_SPECIAL_FACTORY_STATUSES = new Set(['待发料', '已发料', '已接收', '待回仓', '已回仓', '差异', '异议中'])
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

function roundQty(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Number(value) * 100) / 100
}

function getNowText(): string {
  return PROMPT7_SEED_TIME
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
  return {
    lineId: `SC-LINE-${binding.bindingId}`,
    piecePartLabel: binding.partName,
    piecePartCode: binding.demandLineId,
    garmentSkuCode: binding.productionOrderNo,
    garmentSkuLabel: binding.productionOrderNo,
    colorLabel: binding.colorName,
    sizeLabel: binding.sizeCode,
    pieceQty: binding.qty,
    garmentEquivalentQty: binding.qty,
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
    (taskOrder) => taskOrder.targetObject === '裁片',
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
      bindings.push({
        bindingId: buildBindingId(taskOrder.taskOrderId, line.demandLineId, ticket.feiTicketNo, operation.operationId),
        productionOrderId: taskOrder.productionOrderId,
        productionOrderNo: taskOrder.productionOrderNo,
        cuttingOrderId: ticket.originalCutOrderId,
        cuttingOrderNo: ticket.originalCutOrderNo,
        taskOrderId: taskOrder.taskOrderId,
        taskOrderNo: taskOrder.taskOrderNo,
        demandLineId: line.demandLineId,
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
        qty: roundQty(ticket.qty),
        unit: line.unit || '片',
        feiTicketStatus: index === 0 ? '待发料' : '待确认顺序',
        specialCraftFlowStatus: index === 0 ? '待发料' : '待确认顺序',
        currentLocation: '裁床厂待交出仓',
        createdAt: ticket.issuedAt || getNowText(),
        updatedAt: ticket.issuedAt || getNowText(),
      })
    })
  })

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
  const taskOrders = listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.targetObject === '裁片')
  const pendingBindingViews = buildPendingBindingViews(taskOrders, buildResult.bindings)
  const internalBindings = buildResult.bindings
    .map((binding) => {
      const matchedTicket = getFeiTicketByNo(binding.feiTicketNo)
      const sequenceIndex = matchedTicket?.secondaryCrafts.indexOf(binding.operationName) ?? -1
      const sequenceTotal = matchedTicket?.secondaryCrafts.length ?? 0
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
      if (index === 0) return
      const previous = sorted[index - 1]
      const canDispatch = previous.specialCraftFlowStatus === '已回仓'
      updateBinding(store, binding.bindingId, (current) => {
        if (CUTTING_SPECIAL_FACTORY_STATUSES.has(current.specialCraftFlowStatus) && current.dispatchHandoverRecordId) {
          return current
        }
        return {
          ...current,
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
    qtyExpected: binding.qty,
    qtyActual: undefined,
    qtyUnit: binding.unit,
    submittedAt,
    status: 'PENDING_FACTORY_CONFIRM',
    qrCodeValue: buildTaskQrValue(`SCPR-${binding.bindingId}`),
    warehouseHandedQty: binding.qty,
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
    if (binding.dispatchHandoverRecordId) {
      updatedBindings.push(cloneValue(binding))
      return
    }
    const record = createFactoryHandoverRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      submittedQty: binding.qty,
      qtyUnit: binding.unit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.operatorName,
      factoryRemark: `特殊工艺发料 · ${binding.feiTicketNo}`,
      objectType: 'CUT_PIECE',
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: `${binding.partName} / ${binding.colorName} / ${binding.sizeCode}`,
      garmentEquivalentQty: binding.qty,
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
      submittedQty: binding.qty,
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
    flowStore!.pickupRecordToDispatchRecordId.set(`SCPR-${binding.bindingId}`, record.handoverRecordId || record.recordId)
    updatedBindings.push(cloneValue(nextBinding))
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
    const receivedQty = targetBindings.length === 1 ? input.receiverWrittenQty : binding.qty
    const differenceQty = roundQty(receivedQty - binding.qty)
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
      expectedQty: binding.qty,
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
      feiTicketStatus: differenceQty !== 0 ? '差异' : '已接收',
      specialCraftFlowStatus: differenceQty !== 0 ? '差异' : '已接收',
      currentLocation: differenceQty !== 0 ? '差异待处理' : '特殊工艺厂待加工仓',
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      updatedAt: input.receivedAt,
    }))
    updatedBindings.push(cloneValue(nextBinding))
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

export function linkSpecialCraftCompletionToReturnWaitHandoverStock(input: {
  taskOrderId: string
  completedFeiTicketNos: string[]
  completedQty: number
  lossQty?: number
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
    const completedQty = targetBindings.length === 1 ? input.completedQty : binding.qty
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
      completedQty,
      lossQty: input.lossQty || 0,
      unit: binding.unit,
      receiverKind: '裁床厂',
      receiverName: getCuttingFactory().name,
      completedAt: input.completedAt,
    })
    waitHandoverStockItems.push(result.waitHandoverStockItem)
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      feiTicketStatus: '待回仓',
      specialCraftFlowStatus: '待回仓',
      currentLocation: '特殊工艺厂待交出仓',
      updatedAt: input.completedAt,
    }))
    updatedBindings.push(cloneValue(nextBinding))
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
    if (binding.returnHandoverRecordId) {
      updatedBindings.push(cloneValue(binding))
      return
    }
    const record = createFactoryHandoverRecord({
      handoverOrderId: handoverOrder.handoverOrderId || handoverOrder.handoverId,
      submittedQty: binding.qty,
      qtyUnit: binding.unit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.operatorName,
      factoryRemark: `特殊工艺回仓 · ${binding.feiTicketNo}`,
      objectType: 'CUT_PIECE',
      handoutObjectType: 'CUT_PIECE',
      handoutItemLabel: `${binding.partName} / ${binding.colorName} / ${binding.sizeCode}`,
      garmentEquivalentQty: binding.qty,
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
      submittedQty: binding.qty,
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
    updatedBindings.push(cloneValue(nextBinding))
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
    differenceQty: targetBindings.length === 1 ? roundQty(input.receiverWrittenQty - targetBindings[0].qty) : 0,
  })
  const cuttingWarehouse = getCuttingWaitHandoverWarehouse()
  const cuttingWaitHandoverStockItems: FactoryWaitHandoverStockItem[] = []
  const inboundOrReturnRecords: FactoryWarehouseInboundRecord[] = []
  const updatedBindings: CuttingSpecialCraftFeiTicketBinding[] = []

  targetBindings.forEach((binding) => {
    const receivedQty = targetBindings.length === 1 ? input.receiverWrittenQty : binding.qty
    const differenceQty = roundQty(receivedQty - binding.qty)
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
      expectedQty: binding.qty,
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
      status: differenceQty !== 0 ? '差异' : '待交出',
      photoList: [],
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      remark: '特殊工艺回仓进入裁床厂待交出仓',
    })
    cuttingWaitHandoverStockItems.push(waitHandoverStockItem)
    const nextBinding = updateBinding(flowStore!, binding.bindingId, (current) => ({
      ...current,
      receiverWrittenQty: receivedQty,
      differenceQty,
      feiTicketStatus: differenceQty !== 0 ? '差异' : '已回仓',
      specialCraftFlowStatus: differenceQty !== 0 ? '差异' : '已回仓',
      currentLocation: differenceQty !== 0 ? '差异待处理' : '裁床厂待交出仓',
      abnormalReason: differenceQty !== 0 ? input.differenceReason || '数量不符' : undefined,
      updatedAt: input.receivedAt,
    }))
    updatedBindings.push(cloneValue(nextBinding))
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
      feiTicketStatus: '异议中',
      specialCraftFlowStatus: '异议中',
      currentLocation: '差异待处理',
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
  const differenceCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '差异').length
  const objectionCount = orderBindings.filter((binding) => binding.specialCraftFlowStatus === '异议中').length
  const allReturned =
    totalNeedSpecialCraftFeiTickets > 0
    && returnedCount + orderBindings.filter((binding) => binding.sequenceIndex > 0 && binding.specialCraftFlowStatus === '待发料').length === totalNeedSpecialCraftFeiTickets
    && differenceCount === 0
    && objectionCount === 0
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
  differenceFeiTicketCount: number
  returnStatus: string
} {
  const bindings = getSpecialCraftBindingsByTaskOrderId(taskOrderId)
  const linkedFeiTicketCount = bindings.length
  const dispatchedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已发料').length
  const receivedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已接收').length
  const completedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '待回仓').length
  const returnedFeiTicketCount = bindings.filter((binding) => binding.specialCraftFlowStatus === '已回仓').length
  const differenceFeiTicketCount = bindings.filter(
    (binding) => binding.specialCraftFlowStatus === '差异' || binding.specialCraftFlowStatus === '异议中',
  ).length
  const returnStatus =
    differenceFeiTicketCount > 0
      ? '差异'
      : completedFeiTicketCount > 0
        ? '待回仓'
        : returnedFeiTicketCount > 0 && returnedFeiTicketCount === linkedFeiTicketCount
          ? '已回仓'
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
    differenceFeiTicketCount,
    returnStatus,
  }
}

export function getSpecialCraftFeiTicketSummary(feiTicketNo: string): {
  needSpecialCraft: boolean
  operationNames: string[]
  taskOrderNos: string[]
  dispatchStatus: string
  returnStatus: string
  currentLocation: string
} {
  ensureSpecialCraftFeiTicketFlowSeeded()
  const bindings = flowStore?.bindings.filter((binding) => binding.feiTicketNo === feiTicketNo) || []
  if (!bindings.length) {
    return {
      needSpecialCraft: false,
      operationNames: [],
      taskOrderNos: [],
      dispatchStatus: '无',
      returnStatus: '无',
      currentLocation: '裁床厂待交出仓',
    }
  }
  const latest = bindings.find((binding) => binding.specialCraftFlowStatus === '异议中')
    || bindings.find((binding) => binding.specialCraftFlowStatus === '差异')
    || bindings.find((binding) => binding.specialCraftFlowStatus === '已回仓')
    || bindings[0]
  return {
    needSpecialCraft: true,
    operationNames: Array.from(new Set(bindings.map((binding) => binding.operationName))),
    taskOrderNos: Array.from(new Set(bindings.map((binding) => binding.taskOrderNo))),
    dispatchStatus: latest?.specialCraftFlowStatus || '待发料',
    returnStatus:
      latest?.specialCraftFlowStatus === '已回仓'
        ? '已回仓'
        : latest?.currentLocation === '回仓途中'
          ? '回仓途中'
          : latest?.specialCraftFlowStatus === '待回仓'
            ? '待回仓'
            : latest?.specialCraftFlowStatus || '待发料',
    currentLocation: latest?.currentLocation || '裁床厂待交出仓',
  }
}

export function listCuttingSpecialCraftFeiTicketBindings(): CuttingSpecialCraftFeiTicketBinding[] {
  ensureSpecialCraftFeiTicketFlowSeeded()
  return flowStore!.bindings.map(cloneValue)
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
    qty: binding.qty,
    dispatchStatus:
      binding.specialCraftFlowStatus === '待确认顺序'
        ? '待确认顺序'
        : binding.specialCraftFlowStatus === '差异'
          ? '差异'
          : binding.specialCraftFlowStatus === '异议中'
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
        ? '已接收'
        : binding.specialCraftFlowStatus === '差异'
          ? '差异'
          : binding.specialCraftFlowStatus === '异议中'
            ? '异议中'
            : '待接收',
    returnStatus:
      binding.specialCraftFlowStatus === '已回仓'
        ? '已回仓'
        : binding.specialCraftFlowStatus === '差异'
          ? '差异'
          : binding.specialCraftFlowStatus === '异议中'
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
      qty: binding.qty,
      returnHandoverRecordNo: binding.returnHandoverRecordNo || '未创建',
      receiverWrittenQty: binding.receiverWrittenQty,
      differenceQty: binding.differenceQty,
      returnStatus:
        binding.specialCraftFlowStatus === '已回仓'
          ? '已回仓'
          : binding.specialCraftFlowStatus === '差异'
            ? '差异'
            : binding.specialCraftFlowStatus === '异议中'
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
    warnings: built.warnings,
    errors: built.errors,
    pendingBindingViews: built.pendingBindingViews,
    pickupRecordToDispatchRecordId: new Map<string, string>(),
  }
  seedPrompt7Scenario(flowStore)
  return flowStore
}

export function ensureSpecialCraftFeiTicketFlowSeeded(): void {
  ensureFlowStore()
}
