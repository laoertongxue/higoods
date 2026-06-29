import { listFactoryPrintMachineCapacities } from './factory-capacity-profile-mock.ts'
import {
  createFactoryHandoverRecord,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import { listPdaGenericProcessTasks, type PdaGenericTaskMock } from './pda-task-mock-factory.ts'
import { type HandoverReceiverKind } from './process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { listActiveProcessCraftDefinitions, type ProcessCraftDefinition } from './process-craft-dict.ts'
import {
  buildDictionaryCraftMockDocumentNo,
  DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  getDictionaryCraftMockSource,
} from './production-artifact-generation.ts'

export type PrintWorkOrderStatus =
  | 'WAIT_ARTWORK'
  | 'WAIT_COLOR_TEST'
  | 'COLOR_TEST_DONE'
  | 'WAIT_PRINT'
  | 'PRINTING'
  | 'PRINT_DONE'
  | 'WAIT_TRANSFER'
  | 'TRANSFERRING'
  | 'TRANSFER_DONE'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_WAIT_RECEIVE'
  | 'PARTIAL_HANDOVER'
  | 'FULL_HANDOVER'
  | 'HANDOVER_DIFFERENCE'

export type PrintExecutionNodeCode = 'COLOR_TEST' | 'PRINT' | 'TRANSFER' | 'HANDOVER'
export type PrintReceiptStatus = 'WAIT_RECEIVE' | 'PARTIAL_HANDOVER' | 'FULL_HANDOVER' | 'HANDOVER_DIFFERENCE'
export type PrintReviewStatus = PrintReceiptStatus

export interface PrintWorkOrder {
  printOrderId: string
  printOrderNo: string
  sourceType: 'PRODUCTION_ORDER'
  sourceDemandIds: string[]
  productionOrderIds: string[]
  isFirstOrder: boolean
  artworkTaskId?: string
  trfFileId?: string
  patternNo: string
  patternVersion: string
  materialSku: string
  materialColor?: string
  objectType?: '面料' | '裁片'
  isPiecePrinting?: boolean
  isFabricPrinting?: boolean
  plannedQty: number
  qtyUnit: string
  qtyLabel?: string
  plannedRollCount?: number
  assignmentMode: '派单'
  assignmentModeEditable: false
  dispatchPrice: number
  dispatchPriceCurrency: 'IDR'
  dispatchPriceUnit: 'Yard'
  dispatchPriceDisplay: string
  printFactoryId: string
  printFactoryName: string
  sourceWarehouseId?: string
  targetTransferWarehouseId: string
  targetTransferWarehouseName: string
  status: PrintWorkOrderStatus
  taskId: string
  taskNo: string
  taskQrValue: string
  handoverOrderId?: string
  handoverOrderNo?: string
  receiverKind: HandoverReceiverKind
  receiverName: string
  createdAt: string
  updatedAt: string
  remark?: string
}

export interface PrintExecutionNodeRecord {
  nodeRecordId: string
  printOrderId: string
  taskId: string
  nodeCode: PrintExecutionNodeCode
  nodeName: string
  operatorUserId: string
  operatorName: string
  deviceId?: string
  startedAt?: string
  finishedAt?: string
  printerNo?: string
  printerSpeedPerHour?: number
  inputQty?: number
  outputQty?: number
  wasteQty?: number
  usedMaterialQty?: number
  actualCompletedQty?: number
  qtyUnit: string
  proofImageIds?: string[]
  remark?: string
}

export interface PrintReviewRecord {
  reviewRecordId: string
  printOrderId: string
  handoverOrderId?: string
  handoverRecordIds?: string[]
  receiverName: string
  submittedQty: number
  receivedQty: number
  diffQty: number
  receivedRollCount?: number
  receivedLength?: number
  lengthUnit?: string
  reviewStatus: PrintReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectReason?: string
  remark?: string
}

export interface PrintWorkOrderSummary {
  total: number
  waitArtworkCount: number
  waitColorTestCount: number
  waitPrintCount: number
  printingCount: number
  transferringCount: number
  waitHandoverCount: number
  waitReceiveCount: number
  partialHandoverCount: number
  fullHandoverCount: number
  handoverDifferenceCount: number
  printCompletedQty: number
  transferCompletedQty: number
  usedMaterialQty: number
  diffQty: number
  objectionCount: number
}

export const PRINT_WORK_ORDER_STATUS_LABEL: Record<PrintWorkOrderStatus, string> = {
  WAIT_ARTWORK: '待花型',
  WAIT_COLOR_TEST: '待调色测试',
  COLOR_TEST_DONE: '待调色测试',
  WAIT_PRINT: '等打印',
  PRINTING: '打印中',
  PRINT_DONE: '打印完成',
  WAIT_TRANSFER: '待转印',
  TRANSFERRING: '转印中',
  TRANSFER_DONE: '转印完成',
  WAIT_HANDOVER: '待送货',
  HANDOVER_WAIT_RECEIVE: '交出待收货',
  PARTIAL_HANDOVER: '部分交出',
  FULL_HANDOVER: '全部交出',
  HANDOVER_DIFFERENCE: '收货差异',
}

export const PRINT_NODE_LABEL: Record<PrintExecutionNodeCode, string> = {
  COLOR_TEST: '花型测试',
  PRINT: '打印',
  TRANSFER: '转印',
  HANDOVER: '交出',
}

export const PRINT_REVIEW_STATUS_LABEL: Record<PrintReviewStatus, string> = {
  WAIT_RECEIVE: '交出待收货',
  PARTIAL_HANDOVER: '部分交出',
  FULL_HANDOVER: '全部交出',
  HANDOVER_DIFFERENCE: '收货差异',
}

type MutablePrintWorkOrder = PrintWorkOrder
type MutableNodeRecord = PrintExecutionNodeRecord
type MutableReviewRecord = PrintReviewRecord

const PRINT_WORK_ORDER_IDS = {
  WAIT_ARTWORK: 'PWO-PRINT-001',
  WAIT_COLOR_TEST: 'PWO-PRINT-002',
  WAIT_PRINT: 'PWO-PRINT-003',
  PRINTING: 'PWO-PRINT-004',
  WAIT_HANDOVER: 'PWO-PRINT-005',
  HANDOVER_WAIT_RECEIVE: 'PWO-PRINT-006',
  PARTIAL_HANDOVER: 'PWO-PRINT-007',
  FULL_HANDOVER: 'PWO-PRINT-008',
  TRANSFERRING: 'PWO-PRINT-009',
  HANDOVER_DIFFERENCE: 'PWO-PRINT-010',
  WAIT_PRINT_EXTRA: 'PWO-PRINT-011',
  PRINTING_EXTRA: 'PWO-PRINT-012',
} as const

const workOrderStore = new Map<string, MutablePrintWorkOrder>()
const nodeRecordStore = new Map<string, MutableNodeRecord[]>()
const reviewRecordStore = new Map<string, MutableReviewRecord>()

let seeded = false

const GENERATED_PRINT_CRAFTS = listActiveProcessCraftDefinitions()
  .filter((definition) => definition.processCode === 'PRINT' && definition.defaultDocType === 'DEMAND')

interface GeneratedPrintContext {
  productionOrder: ProductionOrder
  techPackSnapshot: ProductionOrderTechPackSnapshot
  craftDefinition: ProcessCraftDefinition
  mockIndex: number
  plannedQty: number
  materialName: string
  materialColor?: string
}

function getProductionOrderQty(order: ProductionOrder): number {
  const skuQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return Math.max(1, Math.round(skuQty || order.planQty || 1))
}

function getGeneratedPrintCraft(index: number): { craftDefinition: ProcessCraftDefinition; mockIndex: number } | null {
  const craftIndex = Math.floor(index / DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)
  const craftDefinition = GENERATED_PRINT_CRAFTS[craftIndex]
  if (!craftDefinition) return null
  return {
    craftDefinition,
    mockIndex: index % DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  }
}

function buildPrintDemandId(craftCode: string, productionOrderId: string, mockIndex: number): string {
  return buildDictionaryCraftMockDocumentNo('YHXQ', craftCode, productionOrderId, mockIndex)
}

function buildPrintWorkOrderNo(craftCode: string, productionOrderId: string, mockIndex: number): string {
  return buildDictionaryCraftMockDocumentNo('YHJG', craftCode, productionOrderId, mockIndex)
}

function getGeneratedPrintContext(index: number): GeneratedPrintContext | null {
  const generatedCraft = getGeneratedPrintCraft(index)
  if (!generatedCraft) return null
  const source = getDictionaryCraftMockSource(generatedCraft.craftDefinition.craftCode, generatedCraft.mockIndex)
  const preferredOrderId = source?.order.productionOrderId
  const productionOrder = productionOrders.find((order) => order.productionOrderId === preferredOrderId)
  if (!productionOrder) return null
  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  if (!techPackSnapshot) return null
  const bomItem = techPackSnapshot.bomItems[0]
  return {
    productionOrder,
    techPackSnapshot,
    craftDefinition: generatedCraft.craftDefinition,
    mockIndex: generatedCraft.mockIndex,
    plannedQty: getProductionOrderQty(productionOrder),
    materialName: bomItem ? `${bomItem.name}${bomItem.spec ? ` / ${bomItem.spec}` : ''}` : productionOrder.demandSnapshot.spuName,
    materialColor: bomItem?.colorLabel || productionOrder.demandSnapshot.skuLines[0]?.color,
  }
}

function getVisiblePrintWorkOrderIds(): Set<string> {
  return new Set(
    Array.from(workOrderStore.values())
      .sort((left, right) => left.printOrderNo.localeCompare(right.printOrderNo))
      .slice(0, GENERATED_PRINT_CRAFTS.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)
      .map((order) => order.printOrderId),
  )
}

function toGeneratedPrintWorkOrder(order: MutablePrintWorkOrder, index: number): MutablePrintWorkOrder {
  const context = getGeneratedPrintContext(index)
  if (!context) return order
  const { productionOrder, techPackSnapshot, craftDefinition, mockIndex, plannedQty, materialName, materialColor } = context
  const demandId = buildPrintDemandId(craftDefinition.craftCode, productionOrder.productionOrderId, mockIndex)
  return {
    ...order,
    printOrderNo: buildPrintWorkOrderNo(craftDefinition.craftCode, productionOrder.productionOrderId, mockIndex),
    sourceDemandIds: [demandId],
    productionOrderIds: [productionOrder.productionOrderId],
    isFirstOrder: mockIndex === 0,
    patternNo: techPackSnapshot.sourceTechPackVersionCode || techPackSnapshot.styleCode,
    patternVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
    materialSku: materialName,
    materialColor,
    plannedQty,
    plannedRollCount: order.objectType === '面料' ? Math.max(1, Math.ceil(plannedQty / 100)) : order.plannedRollCount,
    createdAt: productionOrder.createdAt,
    updatedAt: order.updatedAt || productionOrder.updatedAt,
    remark: `${craftDefinition.craftName}；来源生产单 ${productionOrder.productionOrderNo}，技术包 ${techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel}。`,
  }
}

function listGeneratedPrintWorkOrders(): MutablePrintWorkOrder[] {
  return Array.from(workOrderStore.values())
    .sort((left, right) => left.printOrderNo.localeCompare(right.printOrderNo))
    .slice(0, GENERATED_PRINT_CRAFTS.length * DICTIONARY_CRAFT_MOCKS_PER_DEFINITION)
    .map((order, index) => toGeneratedPrintWorkOrder(order, index))
}

function cloneWorkOrder(order: MutablePrintWorkOrder): PrintWorkOrder {
  return { ...order, sourceDemandIds: [...order.sourceDemandIds], productionOrderIds: [...order.productionOrderIds] }
}

function cloneNodeRecord(record: MutableNodeRecord): PrintExecutionNodeRecord {
  return {
    ...record,
    proofImageIds: record.proofImageIds ? [...record.proofImageIds] : undefined,
  }
}

function cloneReviewRecord(record: MutableReviewRecord): PrintReviewRecord {
  return {
    ...record,
    handoverRecordIds: record.handoverRecordIds ? [...record.handoverRecordIds] : undefined,
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function isPrintingTask(task: PdaGenericTaskMock): boolean {
  return task.processBusinessCode === 'PRINT' || task.processCode === 'PROC_PRINT' || task.processNameZh === '印花'
}

function getPrintingTasks(): PdaGenericTaskMock[] {
  return listPdaGenericProcessTasks()
    .filter(isPrintingTask)
    .sort((left, right) => left.taskId.localeCompare(right.taskId))
}

function getPrintingTaskById(taskId: string): PdaGenericTaskMock | undefined {
  return getPrintingTasks().find((task) => task.taskId === taskId)
}

function syncLinkedTaskState(
  taskId: string,
  input: {
    status?: PdaGenericTaskMock['status']
    startedAt?: string
    finishedAt?: string
    acceptanceStatus?: PdaGenericTaskMock['acceptanceStatus']
    assignmentMode?: PdaGenericTaskMock['assignmentMode']
    assignmentStatus?: PdaGenericTaskMock['assignmentStatus']
    blockReason?: PdaGenericTaskMock['blockReason']
    blockRemark?: PdaGenericTaskMock['blockRemark']
  },
): void {
  const task = getPrintingTaskById(taskId)
  if (!task) return

  if (input.status) task.status = input.status
  if (typeof input.assignmentMode !== 'undefined') task.assignmentMode = input.assignmentMode
  if (typeof input.assignmentStatus !== 'undefined') task.assignmentStatus = input.assignmentStatus
  if (typeof input.startedAt !== 'undefined') task.startedAt = input.startedAt
  if (typeof input.finishedAt !== 'undefined') task.finishedAt = input.finishedAt
  if (typeof input.acceptanceStatus !== 'undefined') task.acceptanceStatus = input.acceptanceStatus
  if (typeof input.blockReason !== 'undefined') task.blockReason = input.blockReason
  if (typeof input.blockRemark !== 'undefined') task.blockRemark = input.blockRemark
  task.updatedAt = nowTimestamp()
}

function getStatusLabel(status: PrintWorkOrderStatus): string {
  return PRINT_WORK_ORDER_STATUS_LABEL[status]
}

function getMachineSeed(factoryId: string, index = 0) {
  const machines = listFactoryPrintMachineCapacities(factoryId)
  return machines[index] ?? machines[0]
}

function getPrimaryHandoverOrder(taskId: string): PdaHandoverHead | null {
  const existing = listHandoverOrdersByTaskId(taskId)
  return existing[0] ?? null
}

function syncTaskHandoverFields(taskId: string, handoverOrderId: string): void {
  const task = getPrintingTaskById(taskId) as (PdaGenericTaskMock & {
    handoverOrderId?: string
    handoverStatus?: string
  }) | undefined
  if (!task) return

  task.handoverOrderId = handoverOrderId
  const head = getHandoverOrderById(handoverOrderId)
  if (head?.handoverOrderStatus) {
    task.handoverStatus = head.handoverOrderStatus
  }
}

function ensureStartedTaskHandover(taskId: string): string | undefined {
  const task = getPrintingTaskById(taskId)
  if (!task?.startedAt) return undefined

  const ensured = ensureHandoverOrderForStartedTask(taskId)
  syncTaskHandoverFields(taskId, ensured.handoverOrderId)
  return ensured.handoverOrderId
}

function ensureSeededHandoverRecord(input: {
  taskId: string
  submittedQty: number
  receiverWrittenQty?: number
  submittedAt: string
  receiverWrittenAt?: string
  objectType?: 'FABRIC' | 'CUT_PIECE' | 'SEMI_FINISHED_GARMENT' | 'FINISHED_GARMENT'
  receiverRemark?: string
  diffReason?: string
}): { handoverOrderId?: string; recordIds: string[] } {
  const handoverOrderId = ensureStartedTaskHandover(input.taskId)
  if (!handoverOrderId) return { recordIds: [] }

  const head = getHandoverOrderById(handoverOrderId)
  if (!head) return { handoverOrderId, recordIds: [] }
  const existing = getPdaHandoverRecordsByHead(head.handoverId)
  if (existing.length === 0) {
    createFactoryHandoverRecord({
      handoverOrderId,
      submittedQty: input.submittedQty,
      qtyUnit: head.qtyUnit,
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: '印花工厂',
      factoryRemark: '印花面料送中转区域',
      objectType: input.objectType ?? 'CUT_PIECE',
    })
  }

  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const firstRecord = records[0]

  if (
    firstRecord
    && typeof input.receiverWrittenQty === 'number'
    && !firstRecord.receiverWrittenAt
    && input.receiverWrittenAt
  ) {
    writeBackHandoverRecord({
      handoverRecordId: firstRecord.handoverRecordId,
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receiverWrittenAt,
      receiverWrittenBy: '中转区域',
      receiverRemark: input.receiverRemark,
      diffReason: input.diffReason,
    })
  }

  const nextRecords = getPdaHandoverRecordsByHead(head.handoverId)
  return {
    handoverOrderId,
    recordIds: nextRecords.map((record) => record.handoverRecordId),
  }
}

function setNodeRecords(printOrderId: string, records: MutableNodeRecord[]): void {
  nodeRecordStore.set(printOrderId, records.map((record) => ({ ...record })))
}

function appendNodeRecord(printOrderId: string, record: MutableNodeRecord): void {
  const current = nodeRecordStore.get(printOrderId) ?? []
  current.push({ ...record })
  nodeRecordStore.set(printOrderId, current)
}

function upsertNodeRecord(printOrderId: string, nodeCode: PrintExecutionNodeCode, updater: (current?: MutableNodeRecord) => MutableNodeRecord): void {
  const current = nodeRecordStore.get(printOrderId) ?? []
  const index = current.findIndex((item) => item.nodeCode === nodeCode)
  const nextRecord = updater(index >= 0 ? current[index] : undefined)
  if (index >= 0) {
    current[index] = nextRecord
  } else {
    current.push(nextRecord)
  }
  nodeRecordStore.set(printOrderId, current)
}

function createNodeRecordId(printOrderId: string, nodeCode: PrintExecutionNodeCode): string {
  return `${printOrderId}-${nodeCode}`
}

function addSeedWorkOrder(input: Omit<
  MutablePrintWorkOrder,
  | 'taskQrValue'
  | 'receiverKind'
  | 'receiverName'
  | 'handoverOrderNo'
  | 'assignmentMode'
  | 'assignmentModeEditable'
  | 'dispatchPrice'
  | 'dispatchPriceCurrency'
  | 'dispatchPriceUnit'
  | 'dispatchPriceDisplay'
> & {
  handoverOrderId?: string
  dispatchPrice?: number
}): void {
  const task = getPrintingTaskById(input.taskId)
  const handoverOrder = input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : getPrimaryHandoverOrder(input.taskId)
  if (task) {
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = 'ASSIGNED'
    task.acceptanceStatus = 'ACCEPTED'
    task.tenderId = undefined
    task.awardedAt = undefined
    task.dispatchedBy = '平台派单'
    task.dispatchRemark = '印花加工单派单后直接进入执行待加工'
    task.dispatchPrice = input.dispatchPrice ?? 1200
    task.dispatchPriceCurrency = 'IDR'
    task.dispatchPriceUnit = 'Yard'
    task.standardPriceCurrency = 'IDR'
    task.standardPriceUnit = 'Yard'
    task.mockOrigin = 'DIRECT_ASSIGNED_EXECUTION'
    task.mockReceiveSummary = '印花加工单已派单，直接进入执行待加工。'
  }

  workOrderStore.set(input.printOrderId, {
    ...input,
    assignmentMode: '派单',
    assignmentModeEditable: false,
    dispatchPrice: input.dispatchPrice ?? 1200,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: 'Yard',
    dispatchPriceDisplay: `${input.dispatchPrice ?? 1200} IDR/Yard`,
    taskQrValue: task?.taskQrValue || buildTaskQrValue(input.taskId),
    receiverKind: task?.receiverKind || 'WAREHOUSE',
    receiverName: task?.receiverName || '中转区域',
    handoverOrderId: handoverOrder?.handoverOrderId || handoverOrder?.handoverId || input.handoverOrderId,
    handoverOrderNo: handoverOrder?.handoverOrderNo,
  })
}

function seedWorkOrders(): void {
  const printingTask = getPrintingTaskById('TASK-PRINT-000717')
  const transferTask = getPrintingTaskById('TASK-PRINT-000718')
  const handoverTask = getPrintingTaskById('TASK-PRINT-000719')
  const reviewTask = getPrintingTaskById('TASK-PRINT-000720')
  const completedTask = getPrintingTaskById('TASK-PRINT-000721')
  syncLinkedTaskState('TASK-PRINT-000717', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
  })
  syncLinkedTaskState('TASK-PRINT-000718', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-PRINT-000719', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    finishedAt: undefined,
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-PRINT-000720', {
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    startedAt: reviewTask?.startedAt || '2026-03-27 16:10:00',
    finishedAt: '2026-03-28 17:30:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-PRINT-000721', {
    status: 'DONE',
    acceptanceStatus: 'ACCEPTED',
    startedAt: completedTask?.startedAt || '2026-03-28 08:10:00',
    finishedAt: '2026-03-29 16:20:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  const orderForWaitHandover = ensureStartedTaskHandover('TASK-PRINT-000718')
  const waitReviewSeed = ensureSeededHandoverRecord({
    taskId: 'TASK-PRINT-000720',
    submittedQty: 468,
    receiverWrittenQty: 462,
    submittedAt: '2026-03-28 14:10:00',
    receiverWrittenAt: '2026-03-28 17:20:00',
    diffReason: '中转区域复核少 6 片',
  })
  const completedSeed = ensureSeededHandoverRecord({
    taskId: 'TASK-PRINT-000721',
    submittedQty: 624,
    receiverWrittenQty: 624,
    submittedAt: '2026-03-29 14:10:00',
    receiverWrittenAt: '2026-03-29 16:50:00',
    diffReason: '',
  })
  syncLinkedTaskState('TASK-PRINT-000716', {
    status: 'IN_PROGRESS',
    startedAt: '2026-03-28 13:20:00',
    acceptanceStatus: 'ACCEPTED',
  })
  syncLinkedTaskState('TASK-PRINT-000712', {
    status: 'DONE',
    startedAt: '2026-03-28 08:50:00',
    finishedAt: '2026-03-29 11:20:00',
    acceptanceStatus: 'ACCEPTED',
  })
  const rejectedSeed = ensureSeededHandoverRecord({
    taskId: 'TASK-PRINT-000712',
    submittedQty: 742,
    receiverWrittenQty: 708,
    submittedAt: '2026-03-29 10:40:00',
    receiverWrittenAt: '2026-03-29 13:30:00',
    receiverRemark: '中转区域发现局部花位偏差',
    diffReason: '局部花位偏差，需退回补送',
  })
  const handoverHead = getPrimaryHandoverOrder('TASK-PRINT-000719')

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_ARTWORK,
    printOrderNo: 'PH-20260328-001',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-001'],
    productionOrderIds: ['PO-20260328-071'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-001',
    patternVersion: 'V3',
    materialSku: 'FAB-PRINT-001',
    materialColor: '奶白底黑花',
    objectType: '面料',
    isFabricPrinting: true,
    plannedQty: 920,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_ARTWORK',
    taskId: 'TASK-PRINT-000716',
    taskNo: 'TASK-PRINT-000716',
    createdAt: '2026-03-27 09:00:00',
    updatedAt: '2026-03-28 09:10:00',
    remark: '花型图待业务回传',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST,
    printOrderNo: 'PH-20260328-002',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-002'],
    productionOrderIds: ['PO-20260328-072'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-018',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-018',
    materialColor: '灰底红花',
    objectType: '面料',
    isFabricPrinting: true,
    plannedQty: 880,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_COLOR_TEST',
    taskId: 'TASK-PRINT-000714',
    taskNo: 'TASK-PRINT-000714',
    createdAt: '2026-03-27 09:20:00',
    updatedAt: '2026-03-28 09:20:00',
    remark: '调色测试待确认',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_PRINT,
    printOrderNo: 'PH-20260328-003',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-003'],
    productionOrderIds: ['PO-20260328-073'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-026',
    patternVersion: 'V4',
    materialSku: 'FAB-PRINT-026',
    materialColor: '米黄底蓝花',
    objectType: '面料',
    isFabricPrinting: true,
    plannedQty: 860,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 6,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_PRINT',
    taskId: 'TASK-PRINT-000715',
    taskNo: 'TASK-PRINT-000715',
    createdAt: '2026-03-27 09:40:00',
    updatedAt: '2026-03-28 10:10:00',
    remark: '花型测试已通过，等待排机',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.PRINTING,
    printOrderNo: 'PH-20260328-004',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-004'],
    productionOrderIds: ['PO-20260328-074'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-032',
    patternVersion: 'V5',
    materialSku: 'FAB-PRINT-032',
    materialColor: '黑底白花',
    plannedQty: printingTask?.qty ?? 872,
    qtyUnit: '片',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'PRINTING',
    taskId: 'TASK-PRINT-000717',
    taskNo: 'TASK-PRINT-000717',
    createdAt: '2026-03-27 10:10:00',
    updatedAt: printingTask?.updatedAt ?? '2026-03-28 13:10:00',
    handoverOrderId: ensureStartedTaskHandover('TASK-PRINT-000717'),
    remark: '当前批次正在平网印花',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
    printOrderNo: 'PH-20260328-005',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-005'],
    productionOrderIds: ['PO-20260328-075'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-037',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-037',
    materialColor: '浅蓝底白花',
    plannedQty: transferTask?.qty ?? 808,
    qtyUnit: '片',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_HANDOVER',
    taskId: 'TASK-PRINT-000718',
    taskNo: 'TASK-PRINT-000718',
    createdAt: '2026-03-27 10:30:00',
    updatedAt: '2026-03-28 15:10:00',
    handoverOrderId: orderForWaitHandover,
    remark: '转印结束，等待送中转区域',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
    printOrderNo: 'PH-20260328-006',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-006'],
    productionOrderIds: ['PO-20260328-076'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-041',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-041',
    materialColor: '深灰底银花',
    plannedQty: handoverTask?.qty ?? 1044,
    qtyUnit: '片',
    plannedRollCount: 9,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'HANDOVER_WAIT_RECEIVE',
    taskId: 'TASK-PRINT-000719',
    taskNo: 'TASK-PRINT-000719',
    createdAt: '2026-03-27 11:00:00',
    updatedAt: '2026-03-28 18:20:00',
    handoverOrderId: handoverHead?.handoverOrderId || handoverHead?.handoverId,
    remark: '已发起交出，等待中转区域确认收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER,
    printOrderNo: 'PH-20260328-007',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-007'],
    productionOrderIds: ['PO-20260328-077'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-045',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-045',
    materialColor: '浅卡其底墨绿花',
    plannedQty: reviewTask?.qty ?? 468,
    qtyUnit: '片',
    plannedRollCount: 4,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'PARTIAL_HANDOVER',
    taskId: 'TASK-PRINT-000720',
    taskNo: 'TASK-PRINT-000720',
    createdAt: '2026-03-27 11:30:00',
    updatedAt: '2026-03-28 17:30:00',
    handoverOrderId: waitReviewSeed.handoverOrderId,
    remark: '中转区域已确认部分收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
    printOrderNo: 'PH-20260329-009',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-009'],
    productionOrderIds: ['PO-20260329-079'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-061',
    patternVersion: 'V3',
    materialSku: 'FAB-PRINT-061',
    materialColor: '雾蓝底白花',
    plannedQty: 1010,
    qtyUnit: '片',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'TRANSFERRING',
    taskId: 'TASK-PRINT-000716',
    taskNo: 'TASK-PRINT-000716',
    createdAt: '2026-03-28 08:40:00',
    updatedAt: '2026-03-29 14:10:00',
    remark: '打印已完成，当前正在转印',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE,
    printOrderNo: 'PH-20260329-010',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-010'],
    productionOrderIds: ['PO-20260329-080'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-066',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-066',
    materialColor: '杏底棕花',
    plannedQty: 740,
    qtyUnit: '片',
    plannedRollCount: 6,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'HANDOVER_DIFFERENCE',
    taskId: 'TASK-PRINT-000712',
    taskNo: 'TASK-PRINT-000712',
    createdAt: '2026-03-28 08:50:00',
    updatedAt: '2026-03-29 14:20:00',
    handoverOrderId: rejectedSeed.handoverOrderId,
    remark: '中转区域收货存在差异，需补送或复核',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
    printOrderNo: 'PH-20260329-008',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-008'],
    productionOrderIds: ['PO-20260329-078'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-052',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-052',
    materialColor: '奶油白底豆沙花',
    plannedQty: completedTask?.qty ?? 624,
    qtyUnit: '片',
    plannedRollCount: 5,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'FULL_HANDOVER',
    taskId: 'TASK-PRINT-000721',
    taskNo: 'TASK-PRINT-000721',
    createdAt: '2026-03-28 08:00:00',
    updatedAt: '2026-03-29 17:10:00',
    handoverOrderId: completedSeed.handoverOrderId,
    remark: '中转区域已全部确认收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_PRINT_EXTRA,
    printOrderNo: 'PH-20260329-011',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-011'],
    productionOrderIds: ['PO-20260329-081'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-071',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-071',
    materialColor: '象牙白底蓝灰花',
    plannedQty: 910,
    qtyUnit: '片',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'WAIT_PRINT',
    taskId: 'TASK-PRINT-000722',
    taskNo: 'TASK-PRINT-000722',
    createdAt: '2026-03-29 09:10:00',
    updatedAt: '2026-03-29 10:05:00',
    remark: '补充统计样本，花型测试通过，等待排机',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.PRINTING_EXTRA,
    printOrderNo: 'PH-20260329-012',
    sourceType: 'PRODUCTION_ORDER',
    sourceDemandIds: ['PRD-PRINT-012'],
    productionOrderIds: ['PO-20260329-082'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-073',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-073',
    materialColor: '墨绿底白花',
    plannedQty: 960,
    qtyUnit: '片',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    targetTransferWarehouseId: 'WH-TRANSFER',
    targetTransferWarehouseName: '中转区域',
    status: 'PRINTING',
    taskId: 'TASK-PRINT-000723',
    taskNo: 'TASK-PRINT-000723',
    createdAt: '2026-03-29 09:30:00',
    updatedAt: '2026-03-29 11:20:00',
    remark: '补充统计样本，打印机执行中',
  })
}

function seedNodeRecords(): void {
  const printingMachine = getMachineSeed(TEST_FACTORY_ID, 0)
  const standbyMachine = getMachineSeed(TEST_FACTORY_ID, 1) ?? printingMachine

  setNodeRecords(PRINT_WORK_ORDER_IDS.WAIT_ARTWORK, [])
  setNodeRecords(PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST,
      taskId: 'TASK-PRINT-000714',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-01',
      operatorName: '刘洋',
      startedAt: '2026-03-28 09:20:00',
      qtyUnit: '片',
      remark: '已开始调色测试',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.WAIT_PRINT, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_PRINT, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_PRINT,
      taskId: 'TASK-PRINT-000715',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-02',
      operatorName: '陈婷',
      startedAt: '2026-03-28 09:30:00',
      finishedAt: '2026-03-28 10:10:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.PRINTING, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PRINTING, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.PRINTING,
      taskId: 'TASK-PRINT-000717',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-02',
      operatorName: '陈婷',
      startedAt: '2026-03-28 11:30:00',
      finishedAt: '2026-03-28 11:55:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PRINTING, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.PRINTING,
      taskId: 'TASK-PRINT-000717',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-03',
      operatorName: '苏明',
      startedAt: '2026-03-28 13:10:00',
      printerNo: printingMachine?.printerNo || 'PR-01',
      printerSpeedPerHour: printingMachine?.speedValue || 180,
      qtyUnit: '片',
      remark: '主线机台开机中',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.WAIT_PRINT_EXTRA, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_PRINT_EXTRA, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_PRINT_EXTRA,
      taskId: 'TASK-PRINT-000722',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-02',
      operatorName: '陈婷',
      startedAt: '2026-03-29 09:20:00',
      finishedAt: '2026-03-29 10:05:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.PRINTING_EXTRA, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PRINTING_EXTRA, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.PRINTING_EXTRA,
      taskId: 'TASK-PRINT-000723',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-02',
      operatorName: '陈婷',
      startedAt: '2026-03-29 09:35:00',
      finishedAt: '2026-03-29 10:00:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PRINTING_EXTRA, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.PRINTING_EXTRA,
      taskId: 'TASK-PRINT-000723',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-03',
      operatorName: '苏明',
      startedAt: '2026-03-29 10:30:00',
      printerNo: printingMachine?.printerNo || 'PR-01',
      printerSpeedPerHour: printingMachine?.speedValue || 180,
      qtyUnit: '片',
      remark: '补充统计样本打印中',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.WAIT_HANDOVER, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_HANDOVER, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
      taskId: 'TASK-PRINT-000718',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-04',
      operatorName: '宋雨',
      startedAt: '2026-03-28 10:20:00',
      finishedAt: '2026-03-28 10:50:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_HANDOVER, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
      taskId: 'TASK-PRINT-000718',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-05',
      operatorName: '郭峰',
      startedAt: '2026-03-28 11:00:00',
      finishedAt: '2026-03-28 12:20:00',
      printerNo: standbyMachine?.printerNo || 'PR-02',
      printerSpeedPerHour: standbyMachine?.speedValue || 120,
      outputQty: 808,
      wasteQty: 16,
      qtyUnit: '片',
      remark: '打印结束',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.WAIT_HANDOVER, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
      taskId: 'TASK-PRINT-000718',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-06',
      operatorName: '韩丽',
      startedAt: '2026-03-28 13:00:00',
      finishedAt: '2026-03-28 15:10:00',
      usedMaterialQty: 832,
      actualCompletedQty: 796,
      qtyUnit: '片',
      remark: '转印结束，等待交出',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
      taskId: 'TASK-PRINT-000719',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-07',
      operatorName: '黎雪',
      startedAt: '2026-03-27 15:10:00',
      finishedAt: '2026-03-27 15:30:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
      taskId: 'TASK-PRINT-000719',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-08',
      operatorName: '何超',
      startedAt: '2026-03-27 15:40:00',
      finishedAt: '2026-03-27 18:00:00',
      printerNo: printingMachine?.printerNo || 'PR-01',
      printerSpeedPerHour: printingMachine?.speedValue || 180,
      outputQty: 1044,
      wasteQty: 18,
      qtyUnit: '片',
      remark: '打印结束',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
      taskId: 'TASK-PRINT-000719',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-09',
      operatorName: '吴倩',
      startedAt: '2026-03-28 08:20:00',
      finishedAt: '2026-03-28 10:10:00',
      usedMaterialQty: 1060,
      actualCompletedQty: 1044,
      qtyUnit: '片',
      remark: '转印结束，已发起交出',
    },
  ])
  setNodeRecords(PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER,
      taskId: 'TASK-PRINT-000720',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-10',
      operatorName: '李梅',
      startedAt: '2026-03-27 16:10:00',
      finishedAt: '2026-03-27 16:30:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER,
      taskId: 'TASK-PRINT-000720',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-11',
      operatorName: '赵双',
      startedAt: '2026-03-27 16:40:00',
      finishedAt: '2026-03-27 18:05:00',
      printerNo: printingMachine?.printerNo || 'PR-01',
      printerSpeedPerHour: printingMachine?.speedValue || 180,
      outputQty: 468,
      wasteQty: 8,
      qtyUnit: '片',
      remark: '打印结束',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER,
      taskId: 'TASK-PRINT-000720',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-12',
      operatorName: '谢兰',
      startedAt: '2026-03-28 09:10:00',
      finishedAt: '2026-03-28 11:00:00',
      usedMaterialQty: 482,
      actualCompletedQty: 468,
      qtyUnit: '片',
      remark: '转印结束，已完成部分收货确认',
    },
  ])

  setNodeRecords(PRINT_WORK_ORDER_IDS.TRANSFERRING, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000716',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-15',
      operatorName: '梁可',
      startedAt: '2026-03-28 09:30:00',
      finishedAt: '2026-03-28 10:10:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000716',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-16',
      operatorName: '马倩',
      startedAt: '2026-03-28 10:30:00',
      finishedAt: '2026-03-28 12:20:00',
      printerNo: standbyMachine?.printerNo || printingMachine?.printerNo || 'PR-02',
      printerSpeedPerHour: standbyMachine?.speedValue || printingMachine?.speedValue || 175,
      outputQty: 1010,
      wasteQty: 14,
      qtyUnit: '片',
      remark: '打印完成，转入转印',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000716',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-17',
      operatorName: '沈楠',
      startedAt: '2026-03-29 13:20:00',
      usedMaterialQty: 1016,
      actualCompletedQty: 620,
      qtyUnit: '片',
      remark: '转印中，待完成后交出',
    },
  ])

  setNodeRecords(PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE,
      taskId: 'TASK-PRINT-000712',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-18',
      operatorName: '唐钰',
      startedAt: '2026-03-28 09:10:00',
      finishedAt: '2026-03-28 09:55:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE,
      taskId: 'TASK-PRINT-000712',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-19',
      operatorName: '罗一',
      startedAt: '2026-03-28 10:20:00',
      finishedAt: '2026-03-28 12:30:00',
      printerNo: printingMachine?.printerNo || 'PR-01',
      printerSpeedPerHour: printingMachine?.speedValue || 180,
      outputQty: 742,
      wasteQty: 12,
      qtyUnit: '片',
      remark: '打印完成',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE,
      taskId: 'TASK-PRINT-000712',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-20',
      operatorName: '魏然',
      startedAt: '2026-03-29 08:30:00',
      finishedAt: '2026-03-29 10:20:00',
      usedMaterialQty: 750,
      actualCompletedQty: 742,
      qtyUnit: '片',
      remark: '转印完成，交出收货存在差异',
    },
  ])

  setNodeRecords(PRINT_WORK_ORDER_IDS.FULL_HANDOVER, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.FULL_HANDOVER, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
      taskId: 'TASK-PRINT-000721',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-13',
      operatorName: '顾岚',
      startedAt: '2026-03-28 08:20:00',
      finishedAt: '2026-03-28 09:00:00',
      qtyUnit: '片',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.FULL_HANDOVER, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
      taskId: 'TASK-PRINT-000721',
      nodeCode: 'PRINT',
      nodeName: PRINT_NODE_LABEL.PRINT,
      operatorUserId: 'USR-PRINT-13',
      operatorName: '顾岚',
      startedAt: '2026-03-28 09:30:00',
      finishedAt: '2026-03-28 12:10:00',
      printerNo: standbyMachine?.printerNo || printingMachine?.printerNo || 'PR-02',
      printerSpeedPerHour: standbyMachine?.speedValue || printingMachine?.speedValue || 175,
      outputQty: 624,
      wasteQty: 6,
      qtyUnit: '片',
      remark: '打印完成',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.FULL_HANDOVER, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
      taskId: 'TASK-PRINT-000721',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-14',
      operatorName: '黄淳',
      startedAt: '2026-03-29 08:20:00',
      finishedAt: '2026-03-29 10:30:00',
      usedMaterialQty: 636,
      actualCompletedQty: 624,
      qtyUnit: '片',
      remark: '转印完成，已全部交出',
    },
  ])
}

function seedReviewRecords(): void {
  const waitReviewOrder = workOrderStore.get(PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER)
  if (!waitReviewOrder?.handoverOrderId) return

  const head = getHandoverOrderById(waitReviewOrder.handoverOrderId)
  if (!head) return
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  if (!records.length) return

  reviewRecordStore.set(waitReviewOrder.printOrderId, {
    reviewRecordId: `PRV-${waitReviewOrder.printOrderId}`,
    printOrderId: waitReviewOrder.printOrderId,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverRecordIds: records.map((record) => record.handoverRecordId),
    receiverName: waitReviewOrder.targetTransferWarehouseName,
    submittedQty: head.submittedQtyTotal ?? 0,
    receivedQty: head.writtenBackQtyTotal ?? 0,
    diffQty: (head.writtenBackQtyTotal ?? 0) - (head.submittedQtyTotal ?? 0),
    receivedRollCount: 4,
    receivedLength: 126,
    lengthUnit: '米',
    reviewStatus: 'PARTIAL_HANDOVER',
    remark: '中转区域已确认部分收货',
  })

  const completedOrder = workOrderStore.get(PRINT_WORK_ORDER_IDS.FULL_HANDOVER)
  if (!completedOrder?.handoverOrderId) return

  const completedHead = getHandoverOrderById(completedOrder.handoverOrderId)
  if (!completedHead) return
  const completedRecords = getPdaHandoverRecordsByHead(completedHead.handoverId)
  if (!completedRecords.length) return

  reviewRecordStore.set(completedOrder.printOrderId, {
    reviewRecordId: `PRV-${completedOrder.printOrderId}`,
    printOrderId: completedOrder.printOrderId,
    handoverOrderId: completedHead.handoverOrderId || completedHead.handoverId,
    handoverRecordIds: completedRecords.map((record) => record.handoverRecordId),
    receiverName: completedOrder.targetTransferWarehouseName,
    submittedQty: completedHead.submittedQtyTotal ?? 0,
    receivedQty: completedHead.writtenBackQtyTotal ?? 0,
    diffQty: (completedHead.writtenBackQtyTotal ?? 0) - (completedHead.submittedQtyTotal ?? 0),
    receivedRollCount: 5,
    receivedLength: 168,
    lengthUnit: '米',
    reviewStatus: 'FULL_HANDOVER',
    reviewedBy: '中转仓管',
    reviewedAt: '2026-03-29 17:10:00',
    remark: '中转区域已全部确认收货',
  })

  const rejectedOrder = workOrderStore.get(PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE)
  if (!rejectedOrder?.handoverOrderId) return

  const rejectedHead = getHandoverOrderById(rejectedOrder.handoverOrderId)
  if (!rejectedHead) return
  const rejectedRecords = getPdaHandoverRecordsByHead(rejectedHead.handoverId)
  if (!rejectedRecords.length) return

  reviewRecordStore.set(rejectedOrder.printOrderId, {
    reviewRecordId: `PRV-${rejectedOrder.printOrderId}`,
    printOrderId: rejectedOrder.printOrderId,
    handoverOrderId: rejectedHead.handoverOrderId || rejectedHead.handoverId,
    handoverRecordIds: rejectedRecords.map((record) => record.handoverRecordId),
    receiverName: rejectedOrder.targetTransferWarehouseName,
    submittedQty: rejectedHead.submittedQtyTotal ?? 0,
    receivedQty: rejectedHead.writtenBackQtyTotal ?? 0,
    diffQty: (rejectedHead.writtenBackQtyTotal ?? 0) - (rejectedHead.submittedQtyTotal ?? 0),
    receivedRollCount: 6,
    receivedLength: 236,
    lengthUnit: '米',
    reviewStatus: 'HANDOVER_DIFFERENCE',
    reviewedBy: '中转仓管',
    reviewedAt: '2026-03-29 14:20:00',
    rejectReason: '局部花位偏差，需退回补送',
    remark: '收货差异，需要补送或复核',
  })
}

function seedDomain(): void {
  if (seeded) return
  seeded = true
  seedWorkOrders()
  seedNodeRecords()
  seedReviewRecords()
}

function syncOrderFromReview(order: MutablePrintWorkOrder, review?: MutableReviewRecord): boolean {
  if (!review) return false

  if (review.reviewStatus === 'FULL_HANDOVER') {
    order.status = 'FULL_HANDOVER'
  } else if (review.reviewStatus === 'HANDOVER_DIFFERENCE') {
    order.status = 'HANDOVER_DIFFERENCE'
  } else if (review.reviewStatus === 'PARTIAL_HANDOVER') {
    order.status = 'PARTIAL_HANDOVER'
  } else {
    order.status = 'HANDOVER_WAIT_RECEIVE'
  }
  return true
}

function getPrintCompletedQty(order: MutablePrintWorkOrder): number {
  const nodes = nodeRecordStore.get(order.printOrderId) ?? []
  const transferQty = nodes.find((node) => node.nodeCode === 'TRANSFER')?.actualCompletedQty
  const printQty = nodes.find((node) => node.nodeCode === 'PRINT')?.outputQty
  return Number(transferQty ?? printQty ?? order.plannedQty ?? 0)
}

function resolvePrintReceiptStatus(input: {
  completedQty: number
  submittedQty: number
  receivedQty: number
  forceDifference?: boolean
}): PrintReviewStatus {
  const completedQty = Math.max(Number(input.completedQty || 0), 0)
  const submittedQty = Math.max(Number(input.submittedQty || 0), 0)
  const receivedQty = Math.max(Number(input.receivedQty || 0), 0)
  if (input.forceDifference || receivedQty > submittedQty) return 'HANDOVER_DIFFERENCE'
  if (receivedQty <= 0) return 'WAIT_RECEIVE'
  if (completedQty > 0 && receivedQty < completedQty) return 'PARTIAL_HANDOVER'
  return 'FULL_HANDOVER'
}

function ensureReviewForHandoverOrder(order: MutablePrintWorkOrder, head: PdaHandoverHead): void {
  const records = getPdaHandoverRecordsByHead(head.handoverId)
  const submittedQty = head.submittedQtyTotal ?? 0
  const receivedQty = head.pendingWritebackCount && head.pendingWritebackCount > 0 ? 0 : (head.writtenBackQtyTotal ?? 0)
  const diffQty = head.pendingWritebackCount && head.pendingWritebackCount > 0 ? 0 : (head.diffQtyTotal ?? receivedQty - submittedQty)
  const reviewStatus = resolvePrintReceiptStatus({
    completedQty: getPrintCompletedQty(order),
    submittedQty,
    receivedQty,
    forceDifference: Math.abs(diffQty) > 0 && receivedQty > 0,
  })

  const current = reviewRecordStore.get(order.printOrderId)
  if (current) {
    current.handoverOrderId = head.handoverOrderId || head.handoverId
    current.handoverRecordIds = records.map((record) => record.handoverRecordId)
    current.receiverName = order.targetTransferWarehouseName
    current.submittedQty = submittedQty
    if (current.reviewStatus === 'WAIT_RECEIVE') {
      current.receivedQty = receivedQty
      current.diffQty = diffQty
      current.receivedRollCount = receivedQty > 0 ? order.plannedRollCount : undefined
      current.receivedLength = receivedQty > 0 ? Math.max(receivedQty, 0) / 3 : undefined
      current.lengthUnit = '米'
      current.reviewStatus = reviewStatus
      current.remark = current.remark || (reviewStatus === 'WAIT_RECEIVE' ? '交出记录已生成，等待接收方确认收货' : '接收方已确认收货')
    }
    return
  }

  reviewRecordStore.set(order.printOrderId, {
    reviewRecordId: `PRV-${order.printOrderId}`,
    printOrderId: order.printOrderId,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverRecordIds: records.map((record) => record.handoverRecordId),
    receiverName: order.targetTransferWarehouseName,
    submittedQty,
    receivedQty,
    diffQty,
    receivedRollCount: receivedQty > 0 ? order.plannedRollCount : undefined,
    receivedLength: receivedQty > 0 ? Math.max(receivedQty, 0) / 3 : undefined,
    lengthUnit: '米',
    reviewStatus,
    remark: reviewStatus === 'WAIT_RECEIVE' ? '交出记录已生成，等待接收方确认收货' : '接收方已确认收货',
  })
}

function syncDerivedWorkflow(): void {
  seedDomain()

  for (const order of workOrderStore.values()) {
    const head =
      (order.handoverOrderId ? getHandoverOrderById(order.handoverOrderId) : null)
      || getPrimaryHandoverOrder(order.taskId)
    if (head) {
      order.handoverOrderId = head.handoverOrderId || head.handoverId
      order.handoverOrderNo = head.handoverOrderNo
    }

    const review = reviewRecordStore.get(order.printOrderId)
    if (syncOrderFromReview(order, review)) {
      continue
    }

    if (!head) continue

    if ((head.recordCount ?? 0) === 0) {
      if (!['PRINTING', 'PRINT_DONE', 'WAIT_TRANSFER', 'TRANSFERRING', 'WAIT_HANDOVER'].includes(order.status)) {
        order.status = 'WAIT_HANDOVER'
      }
      continue
    }

    if ((head.pendingWritebackCount ?? 0) > 0) {
      ensureReviewForHandoverOrder(order, head)
      const nextReview = reviewRecordStore.get(order.printOrderId)
      if (!syncOrderFromReview(order, nextReview)) {
        order.status = 'HANDOVER_WAIT_RECEIVE'
      }
      continue
    }

    if ((head.writtenBackQtyTotal ?? 0) > 0) {
      ensureReviewForHandoverOrder(order, head)
      const nextReview = reviewRecordStore.get(order.printOrderId)
      if (!syncOrderFromReview(order, nextReview)) {
        order.status = 'HANDOVER_WAIT_RECEIVE'
      }
    }
  }
}

function getMutableWorkOrder(printOrderId: string): MutablePrintWorkOrder {
  seedDomain()
  syncDerivedWorkflow()
  const order = workOrderStore.get(printOrderId)
  if (!order) {
    throw new Error(`未找到印花加工单：${printOrderId}`)
  }
  return order
}

function getMutableNodeRecord(printOrderId: string, nodeCode: PrintExecutionNodeCode): MutableNodeRecord | undefined {
  seedDomain()
  return (nodeRecordStore.get(printOrderId) ?? []).find((record) => record.nodeCode === nodeCode)
}

function getQtyUnit(order: PrintWorkOrder): string {
  return order.qtyUnit || '片'
}

function updateOrderTimestamp(order: MutablePrintWorkOrder, at = nowTimestamp()): void {
  order.updatedAt = at
}

export function getPrintWorkOrderStatusLabel(status: PrintWorkOrderStatus): string {
  return PRINT_WORK_ORDER_STATUS_LABEL[status]
}

export function getPrintReviewStatusLabel(status: PrintReviewStatus): string {
  return PRINT_REVIEW_STATUS_LABEL[status]
}

export function listPrintWorkOrders(): PrintWorkOrder[] {
  syncDerivedWorkflow()
  return listGeneratedPrintWorkOrders().map((order) => cloneWorkOrder(order))
}

export function getPrintWorkOrderById(printOrderId: string): PrintWorkOrder | undefined {
  syncDerivedWorkflow()
  const order = listGeneratedPrintWorkOrders().find((item) => item.printOrderId === printOrderId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getPrintWorkOrderByTaskId(taskId: string): PrintWorkOrder | undefined {
  syncDerivedWorkflow()
  const order = listGeneratedPrintWorkOrders().find((item) => item.taskId === taskId)
  return order ? cloneWorkOrder(order) : undefined
}

export function listPrintExecutionNodeRecords(printOrderId?: string): PrintExecutionNodeRecord[] {
  seedDomain()
  const visibleIds = getVisiblePrintWorkOrderIds()
  if (printOrderId) {
    if (!visibleIds.has(printOrderId)) return []
    return (nodeRecordStore.get(printOrderId) ?? []).map((record) => cloneNodeRecord(record))
  }
  return Array.from(visibleIds)
    .flatMap((visiblePrintOrderId) => nodeRecordStore.get(visiblePrintOrderId) ?? [])
    .map((record) => cloneNodeRecord(record))
}

export function getPrintExecutionNodeRecord(
  printOrderId: string,
  nodeCode: PrintExecutionNodeCode,
): PrintExecutionNodeRecord | undefined {
  const record = getMutableNodeRecord(printOrderId, nodeCode)
  return record ? cloneNodeRecord(record) : undefined
}

export function listPrintReviewRecords(): PrintReviewRecord[] {
  syncDerivedWorkflow()
  const visibleIds = getVisiblePrintWorkOrderIds()
  return Array.from(reviewRecordStore.values())
    .filter((record) => visibleIds.has(record.printOrderId))
    .map((record) => cloneReviewRecord(record))
}

export function getPrintReviewRecordByOrderId(printOrderId: string): PrintReviewRecord | undefined {
  syncDerivedWorkflow()
  if (!getVisiblePrintWorkOrderIds().has(printOrderId)) return undefined
  const review = reviewRecordStore.get(printOrderId)
  return review ? cloneReviewRecord(review) : undefined
}

export function listPrintMachineOptions(factoryId: string) {
  return listFactoryPrintMachineCapacities(factoryId)
}

export function validatePrintStartPayload(input: { printerNo?: string }): { ok: boolean; message?: string } {
  if (!input.printerNo?.trim()) {
    return { ok: false, message: '请选择打印机编号' }
  }
  return { ok: true }
}

export function validatePrintCompletePayload(input: { outputQty?: number }): { ok: boolean; message?: string } {
  if (!Number.isFinite(input.outputQty) || Number(input.outputQty) <= 0) {
    return { ok: false, message: '请填写完成对象数量' }
  }
  return { ok: true }
}

export function validateTransferCompletePayload(input: {
  usedMaterialQty?: number
  actualCompletedQty?: number
}): { ok: boolean; message?: string } {
  if (!Number.isFinite(input.usedMaterialQty) || Number(input.usedMaterialQty) <= 0) {
    return { ok: false, message: '请填写原料使用' }
  }
  if (!Number.isFinite(input.actualCompletedQty) || Number(input.actualCompletedQty) <= 0) {
    return { ok: false, message: '请填写实际完成' }
  }
  return { ok: true }
}

export function validateReviewRejectPayload(reason: string): { ok: boolean; message?: string } {
  if (!reason.trim()) {
    return { ok: false, message: '请填写收货差异原因' }
  }
  return { ok: true }
}

export function hasDirectTransferToReviewTransition(): boolean {
  return false
}

export function startColorTest(printOrderId: string, operatorName = '印花工厂'): PrintExecutionNodeRecord {
  const order = getMutableWorkOrder(printOrderId)
  upsertNodeRecord(printOrderId, 'COLOR_TEST', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(printOrderId, 'COLOR_TEST'),
    printOrderId,
    taskId: order.taskId,
    nodeCode: 'COLOR_TEST',
    nodeName: PRINT_NODE_LABEL.COLOR_TEST,
    operatorUserId: current?.operatorUserId || 'USR-PRINT',
    operatorName,
    startedAt: current?.startedAt || nowTimestamp(),
    finishedAt: current?.finishedAt,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark,
  }))
  order.status = 'WAIT_COLOR_TEST'
  updateOrderTimestamp(order)
  return getPrintExecutionNodeRecord(printOrderId, 'COLOR_TEST')!
}

export function completeColorTest(
  printOrderId: string,
  input: { passed: boolean; operatorName?: string; remark?: string },
): PrintExecutionNodeRecord {
  const order = getMutableWorkOrder(printOrderId)
  const now = nowTimestamp()
  upsertNodeRecord(printOrderId, 'COLOR_TEST', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(printOrderId, 'COLOR_TEST'),
    printOrderId,
    taskId: order.taskId,
    nodeCode: 'COLOR_TEST',
    nodeName: PRINT_NODE_LABEL.COLOR_TEST,
    operatorUserId: current?.operatorUserId || 'USR-PRINT',
    operatorName: input.operatorName || current?.operatorName || '印花工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    qtyUnit: getQtyUnit(order),
    remark: input.passed ? (input.remark?.trim() || '花型测试通过') : (input.remark?.trim() || '花型测试未通过'),
  }))
  order.status = input.passed ? 'WAIT_PRINT' : 'WAIT_ARTWORK'
  updateOrderTimestamp(order, now)
  return getPrintExecutionNodeRecord(printOrderId, 'COLOR_TEST')!
}

export function startPrinting(
  printOrderId: string,
  input: { printerNo: string; operatorName?: string },
): PrintExecutionNodeRecord {
  const validation = validatePrintStartPayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const order = getMutableWorkOrder(printOrderId)
  const machine = listFactoryPrintMachineCapacities(order.printFactoryId).find((item) => item.printerNo === input.printerNo)
  const now = nowTimestamp()

  upsertNodeRecord(printOrderId, 'PRINT', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(printOrderId, 'PRINT'),
    printOrderId,
    taskId: order.taskId,
    nodeCode: 'PRINT',
    nodeName: PRINT_NODE_LABEL.PRINT,
    operatorUserId: current?.operatorUserId || 'USR-PRINT',
    operatorName: input.operatorName || current?.operatorName || '印花工厂',
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    printerNo: input.printerNo.trim(),
    printerSpeedPerHour: machine?.speedValue,
    outputQty: current?.outputQty,
    wasteQty: current?.wasteQty,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark,
  }))

  order.status = 'PRINTING'
  updateOrderTimestamp(order, now)
  return getPrintExecutionNodeRecord(printOrderId, 'PRINT')!
}

export function completePrinting(
  printOrderId: string,
  input: { outputQty: number; wasteQty?: number; operatorName?: string },
): PrintExecutionNodeRecord {
  const validation = validatePrintCompletePayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
  const order = getMutableWorkOrder(printOrderId)
  const current = getMutableNodeRecord(printOrderId, 'PRINT')
  if (!current?.printerNo?.trim()) {
    throw new Error('打印开始必须记录打印机编号')
  }

  const now = nowTimestamp()
  upsertNodeRecord(printOrderId, 'PRINT', () => ({
    ...current,
    operatorName: input.operatorName || current.operatorName || '印花工厂',
    startedAt: current.startedAt || now,
    finishedAt: now,
    outputQty: Number(input.outputQty),
    wasteQty: Number.isFinite(input.wasteQty) ? Number(input.wasteQty) : current.wasteQty,
  }))
  order.status = 'WAIT_TRANSFER'
  updateOrderTimestamp(order, now)
  return getPrintExecutionNodeRecord(printOrderId, 'PRINT')!
}

export function startTransfer(printOrderId: string, operatorName = '印花工厂'): PrintExecutionNodeRecord {
  const order = getMutableWorkOrder(printOrderId)
  const now = nowTimestamp()
  upsertNodeRecord(printOrderId, 'TRANSFER', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(printOrderId, 'TRANSFER'),
    printOrderId,
    taskId: order.taskId,
    nodeCode: 'TRANSFER',
    nodeName: PRINT_NODE_LABEL.TRANSFER,
    operatorUserId: current?.operatorUserId || 'USR-PRINT',
    operatorName: operatorName || current?.operatorName || '印花工厂',
    startedAt: current?.startedAt || now,
    finishedAt: current?.finishedAt,
    usedMaterialQty: current?.usedMaterialQty,
    actualCompletedQty: current?.actualCompletedQty,
    qtyUnit: getQtyUnit(order),
    remark: current?.remark,
  }))
  order.status = 'TRANSFERRING'
  updateOrderTimestamp(order, now)
  return getPrintExecutionNodeRecord(printOrderId, 'TRANSFER')!
}

export function completeTransfer(
  printOrderId: string,
  input: { usedMaterialQty: number; actualCompletedQty: number; operatorName?: string },
): PrintExecutionNodeRecord {
  const validation = validateTransferCompletePayload(input)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const order = getMutableWorkOrder(printOrderId)
  const current = getMutableNodeRecord(printOrderId, 'TRANSFER')
  const now = nowTimestamp()
  upsertNodeRecord(printOrderId, 'TRANSFER', () => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(printOrderId, 'TRANSFER'),
    printOrderId,
    taskId: order.taskId,
    nodeCode: 'TRANSFER',
    nodeName: PRINT_NODE_LABEL.TRANSFER,
    operatorUserId: current?.operatorUserId || 'USR-PRINT',
    operatorName: input.operatorName || current?.operatorName || '印花工厂',
    startedAt: current?.startedAt || now,
    finishedAt: now,
    usedMaterialQty: Number(input.usedMaterialQty),
    actualCompletedQty: Number(input.actualCompletedQty),
    qtyUnit: getQtyUnit(order),
    remark: '转印完成，等待交出',
  }))
  order.status = 'WAIT_HANDOVER'
  updateOrderTimestamp(order, now)
  if (!order.handoverOrderId) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  syncDerivedWorkflow()
  return getPrintExecutionNodeRecord(printOrderId, 'TRANSFER')!
}

export function submitPrintHandover(
  printOrderId: string,
  input: { handoverQty?: number; handoverPerson?: string; handoverAt?: string; remark?: string } = {},
): { handoverOrderId?: string; recordIds: string[] } {
  const order = getMutableWorkOrder(printOrderId)
  const now = input.handoverAt || nowTimestamp()
  if (!order.handoverOrderId) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  const result = ensureSeededHandoverRecord({
    taskId: order.taskId,
    submittedQty: Number.isFinite(input.handoverQty) ? Number(input.handoverQty) : order.plannedQty,
    submittedAt: now,
    objectType: order.qtyUnit === '米' ? 'FABRIC' : 'CUT_PIECE',
  })
  order.handoverOrderId = result.handoverOrderId || order.handoverOrderId
  order.status = 'HANDOVER_WAIT_RECEIVE'
  order.remark = input.remark?.trim() || order.remark
  updateOrderTimestamp(order, now)
  syncDerivedWorkflow()
  return result
}

function getMutablePrintReceiptReview(printOrderId: string): { order: MutablePrintWorkOrder; review: MutableReviewRecord } {
  const order = getMutableWorkOrder(printOrderId)
  let review = reviewRecordStore.get(printOrderId)
  if (!review) {
    const head =
      (order.handoverOrderId ? getHandoverOrderById(order.handoverOrderId) : null)
      || getPrimaryHandoverOrder(order.taskId)
    if (!head) {
      throw new Error('交出记录创建后才能确认收货')
    }
    ensureReviewForHandoverOrder(order, head)
    review = reviewRecordStore.get(printOrderId)
  }
  if (!review) {
    throw new Error('交出记录创建后才能确认收货')
  }
  return { order, review }
}

function applyPrintReceiptState(order: MutablePrintWorkOrder, review: MutableReviewRecord): void {
  order.status = review.reviewStatus === 'WAIT_RECEIVE' ? 'HANDOVER_WAIT_RECEIVE' : review.reviewStatus
  if (review.reviewStatus === 'FULL_HANDOVER') {
    syncLinkedTaskState(order.taskId, {
      status: 'DONE',
      finishedAt: review.reviewedAt,
      blockReason: undefined,
      blockRemark: undefined,
    })
  } else if (review.reviewStatus === 'HANDOVER_DIFFERENCE') {
    syncLinkedTaskState(order.taskId, {
      status: 'BLOCKED',
      finishedAt: undefined,
      blockReason: 'QUALITY',
      blockRemark: review.rejectReason,
    })
  } else {
    syncLinkedTaskState(order.taskId, {
      status: 'IN_PROGRESS',
      finishedAt: undefined,
      blockReason: undefined,
      blockRemark: undefined,
    })
  }
}

export function confirmPrintReceipt(
  printOrderId: string,
  input: { receivedBy: string; receivedQty?: number; remark?: string },
): PrintReviewRecord {
  const { order, review } = getMutablePrintReceiptReview(printOrderId)
  const receivedQty = Number.isFinite(input.receivedQty) ? Number(input.receivedQty) : review.submittedQty
  review.receivedQty = receivedQty
  review.diffQty = Number((receivedQty - review.submittedQty).toFixed(2))
  review.reviewStatus = resolvePrintReceiptStatus({
    completedQty: getPrintCompletedQty(order),
    submittedQty: review.submittedQty,
    receivedQty,
  })
  review.reviewedBy = input.receivedBy
  review.reviewedAt = nowTimestamp()
  review.rejectReason = undefined
  review.remark = input.remark?.trim() || (review.reviewStatus === 'PARTIAL_HANDOVER' ? '本次收货已确认，仍有未交出数量' : '本次收货已确认')
  applyPrintReceiptState(order, review)
  updateOrderTimestamp(order, review.reviewedAt)
  return cloneReviewRecord(review)
}

export function markPrintReceiptDifference(
  printOrderId: string,
  input: { receivedBy: string; receivedQty?: number; differenceReason: string; remark?: string },
): PrintReviewRecord {
  const validation = validateReviewRejectPayload(input.differenceReason)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
  const { order, review } = getMutablePrintReceiptReview(printOrderId)
  const receivedQty = Number.isFinite(input.receivedQty) ? Number(input.receivedQty) : review.receivedQty
  review.receivedQty = receivedQty
  review.diffQty = Number((receivedQty - review.submittedQty).toFixed(2))
  review.reviewStatus = 'HANDOVER_DIFFERENCE'
  review.reviewedBy = input.receivedBy
  review.reviewedAt = nowTimestamp()
  review.rejectReason = input.differenceReason.trim()
  review.remark = input.remark?.trim() || '收货差异'
  applyPrintReceiptState(order, review)
  updateOrderTimestamp(order, review.reviewedAt)
  return cloneReviewRecord(review)
}

export function approvePrintReview(
  printOrderId: string,
  input: { reviewedBy: string; remark?: string },
): PrintReviewRecord {
  return confirmPrintReceipt(printOrderId, { receivedBy: input.reviewedBy, remark: input.remark })
}

export function rejectPrintReview(
  printOrderId: string,
  input: { reviewedBy: string; rejectReason: string; remark?: string },
): PrintReviewRecord {
  return markPrintReceiptDifference(printOrderId, {
    receivedBy: input.reviewedBy,
    differenceReason: input.rejectReason,
    remark: input.remark,
  })
}

export function listPrintingDashboardBuckets(): Array<{ key: string; label: string; count: number }> {
  const summary = getPrintWorkOrderSummary()
  return [
    { key: 'wait-artwork', label: '待花型图', count: summary.waitArtworkCount },
    { key: 'wait-print', label: '等打印', count: summary.waitPrintCount },
    { key: 'printing', label: '打印中', count: summary.printingCount },
    { key: 'transferring', label: '转印中', count: summary.transferringCount },
    { key: 'wait-handover', label: '待送货', count: summary.waitHandoverCount },
    { key: 'wait-receive', label: '交出待收货', count: summary.waitReceiveCount },
    { key: 'partial-handover', label: '部分交出', count: summary.partialHandoverCount },
    { key: 'abnormal', label: '异常', count: summary.handoverDifferenceCount + summary.waitArtworkCount },
  ]
}

export function getPrintWorkOrderSummary(): PrintWorkOrderSummary {
  syncDerivedWorkflow()
  const orders = Array.from(workOrderStore.values())
  const nodes = Array.from(nodeRecordStore.values()).flat()
  const reviews = Array.from(reviewRecordStore.values())
  const handoverHeads = orders
    .map((order) => (order.handoverOrderId ? getHandoverOrderById(order.handoverOrderId) : null))
    .filter((item): item is PdaHandoverHead => Boolean(item))

  return {
    total: orders.length,
    waitArtworkCount: orders.filter((order) => order.status === 'WAIT_ARTWORK').length,
    waitColorTestCount: orders.filter((order) => order.status === 'WAIT_COLOR_TEST').length,
    waitPrintCount: orders.filter((order) => order.status === 'WAIT_PRINT').length,
    printingCount: orders.filter((order) => order.status === 'PRINTING').length,
    transferringCount: orders.filter((order) => order.status === 'TRANSFERRING' || order.status === 'WAIT_TRANSFER').length,
    waitHandoverCount: orders.filter((order) => order.status === 'WAIT_HANDOVER').length,
    waitReceiveCount: orders.filter((order) => order.status === 'HANDOVER_WAIT_RECEIVE').length,
    partialHandoverCount: orders.filter((order) => order.status === 'PARTIAL_HANDOVER').length,
    fullHandoverCount: orders.filter((order) => order.status === 'FULL_HANDOVER').length,
    handoverDifferenceCount: orders.filter((order) => order.status === 'HANDOVER_DIFFERENCE').length,
    printCompletedQty: nodes
      .filter((node) => node.nodeCode === 'PRINT')
      .reduce((sum, node) => sum + (node.outputQty ?? 0), 0),
    transferCompletedQty: nodes
      .filter((node) => node.nodeCode === 'TRANSFER')
      .reduce((sum, node) => sum + (node.actualCompletedQty ?? 0), 0),
    usedMaterialQty: nodes
      .filter((node) => node.nodeCode === 'TRANSFER')
      .reduce((sum, node) => sum + (node.usedMaterialQty ?? 0), 0),
    diffQty: reviews.reduce((sum, record) => sum + Math.abs(record.diffQty), 0),
    objectionCount: handoverHeads.reduce((sum, head) => sum + (head.objectionCount ?? 0), 0),
  }
}

export function getPrintOrderHandoverHead(printOrderId: string): PdaHandoverHead | undefined {
  syncDerivedWorkflow()
  const order = workOrderStore.get(printOrderId)
  if (!order?.handoverOrderId) return undefined
  return getHandoverOrderById(order.handoverOrderId) ?? undefined
}

export function getPrintOrderHandoverRecords(printOrderId: string): PdaHandoverRecord[] {
  const head = getPrintOrderHandoverHead(printOrderId)
  if (!head) return []
  return getPdaHandoverRecordsByHead(head.handoverId)
}

export function getPrintOrderHandoverSummary(printOrderId: string): {
  recordCount: number
  pendingWritebackCount: number
  submittedQty: number
  writtenBackQty: number
  diffQty: number
  objectionCount: number
} {
  const head = getPrintOrderHandoverHead(printOrderId)
  return {
    recordCount: head?.recordCount ?? 0,
    pendingWritebackCount: head?.pendingWritebackCount ?? 0,
    submittedQty: head?.submittedQtyTotal ?? 0,
    writtenBackQty: head?.writtenBackQtyTotal ?? 0,
    diffQty: head?.diffQtyTotal ?? 0,
    objectionCount: head?.objectionCount ?? 0,
  }
}
