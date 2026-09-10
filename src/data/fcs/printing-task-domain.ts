import { localDateTimeText } from '../../utils.ts'
import { listFactoryPrintMachineCapacities } from './factory-capacity-profile-mock.ts'
import {
  createFactoryHandoverRecord,
  capturePdaHandoverState,
  restorePdaHandoverState,
  persistPdaHandoverState,
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  getPdaHandoverRecordsByHead,
  listHandoverOrdersByTaskId,
  listPdaHandoverHeads,
  upsertPdaHandoverHeadMock,
  upsertPdaHandoutRecordMock,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type HandoverReceiverKind,
} from './pda-handover-events.ts'
import {
  listPdaGenericProcessTasks,
  registerPdaGenericProcessTask,
  unregisterPdaGenericProcessTask,
  type PdaGenericTaskMock,
} from './pda-task-mock-factory.ts'
import { type QtyUnit } from './process-tasks.ts'
import type {
  FormalProductionOrderProcessSnapshot,
  FormalProductionOrderProcessSnapshotRecord,
  ProcessWorkOrderAutoSyncRecord,
  ProcessWorkOrderChangeImpact,
  ProcessWorkOrderSourceSnapshot,
  ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import {
  deriveFormalProductionOrderMaterialFields,
  normalizeFormalProductionOrderMaterialItems,
} from './formal-production-order-material-items.ts'
import { buildTaskQrValue } from './task-qr.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { selectPrimaryProductionMaterialBomItem } from './production-material-bom.ts'
import { resolveProductionMaterialImageUrl } from './production-material-image-assets.ts'
import { getPrintingOrderImageManifest } from './process-order-image-manifest.ts'
import { getProcessWorkOrderStockMaterial, isValidProcessWorkOrderPlannedFinishAt } from './process-work-order-stock.ts'
import { resolveTerminalProcessOrderReceivingTarget } from './process-order-receiving-target.ts'
import {
  ensureProcessWorkOrders,
  registerProcessWorkOrderGenerationRegistrar,
} from './process-work-order-generation-registry.ts'
import { syncFactoryWarehouseHandoverSourceByTaskId } from './factory-internal-warehouse.ts'
import { getRestoredFormalProcessDefinitions } from './production-process-snapshot-derivation.ts'
import { productionOrders, initialProductionOrderIds, type ProductionOrder } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { assertPrintExecutionPrerequisite } from './supplement-print-prerequisite.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { listActiveProcessCraftDefinitions, type ProcessCraftDefinition } from './process-craft-dict.ts'
import {
  DICTIONARY_CRAFT_MOCKS_PER_DEFINITION,
  getDictionaryCraftMockSource,
} from './production-artifact-generation.ts'
import {
  deriveProcessOrderHandoverStatus,
  deriveProcessOrderReceiptStatus,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderReceiptStatus,
} from './process-order-flow-contract.ts'

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
  | 'WAIT_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export type PrintExecutionNodeCode = 'COLOR_TEST' | 'PRINT' | 'TRANSFER' | 'HANDOVER'
export type PrintReceiptStatus = 'WAIT_RECEIVE' | 'PARTIAL_HANDOVER' | 'FULL_HANDOVER' | 'HANDOVER_DIFFERENCE'
export type PrintReviewStatus = PrintReceiptStatus
export type PrintMaterialObjectType = '面料' | '纱线' | '花边' | '织带' | '拉链' | '辅料' | '包装材料' | '其他' | 'BOM原物料'

export type PrintingDemandSourceType = 'PRODUCTION' | 'PURCHASE' | 'STOCK' | 'SUPPLEMENT'
export type PrintingProcessingStatus = 'WAIT_ASSIGN' | 'WAIT_INPUT_RECEIPT' | 'PROCESSING' | 'PROCESS_COMPLETED' | 'CANCELLED'
export type PrintingReceiptStatus = ProcessOrderReceiptStatus
export type PrintingHandoverStatus = ProcessOrderHandoverStatus
export type PrintingQtyUnit = string

export const PRINTING_DEMAND_SOURCE_LABEL: Record<PrintingDemandSourceType, string> = {
  PRODUCTION: '生产',
  PURCHASE: '采购',
  STOCK: '备货',
  SUPPLEMENT: '补料',
}

export const PRINTING_PROCESSING_STATUSES: ReadonlyArray<{ value: PrintingProcessingStatus; label: string }> = [
  { value: 'WAIT_ASSIGN', label: '待分配' },
  { value: 'WAIT_INPUT_RECEIPT', label: '待接收投入' },
  { value: 'PROCESSING', label: '加工中' },
  { value: 'PROCESS_COMPLETED', label: '加工完成' },
  { value: 'CANCELLED', label: '已取消' },
]

export const PRINTING_RECEIPT_STATUSES: ReadonlyArray<{ value: PrintingReceiptStatus; label: string }> = (
  Object.entries(PROCESS_ORDER_RECEIPT_STATUS_LABEL) as Array<[PrintingReceiptStatus, string]>
).map(([value, label]) => ({ value, label }))

export const PRINTING_HANDOVER_STATUSES: ReadonlyArray<{ value: PrintingHandoverStatus; label: string }> = [
  { value: 'NOT_READY', label: '未到交出' },
  { value: 'WAIT_HANDOVER', label: '待交出' },
  { value: 'PARTIAL_HANDOVER', label: '部分交出' },
  { value: 'FULL_HANDOVER', label: '全部交出' },
]

export const PRINTING_PROCESSING_STATUS_LABEL = Object.fromEntries(
  PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label]),
) as Record<PrintingProcessingStatus, string>

export const PRINTING_HANDOVER_STATUS_LABEL = Object.fromEntries(
  PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label]),
) as Record<PrintingHandoverStatus, string>

export const PRINTING_RECEIPT_STATUS_LABEL = PROCESS_ORDER_RECEIPT_STATUS_LABEL

export interface PrintingImageIdentity { imageUrl: string; imageAlt: string }
export interface PrintingProductIdentity extends PrintingImageIdentity { spu: string; productName: string }
export interface PrintingDemandSource {
  type: PrintingDemandSourceType
  sourceNo: string
  sourceLabel: string
  demandNo?: string
  productionOrderNo?: string
  purchaseOrderNo?: string
  stockPlanNo?: string
  supplementOrderNo?: string
  originalProductionOrderNo?: string
}
export interface PrintingUsageBasis {
  calculationMode: 'BY_USAGE' | 'DIRECT'
  demandBaseQty: number
  demandBaseUnit: string
  standardUnitUsage: number | null
  orderUnitUsage: number | null
  usageUnit: string
  formulaLabel: string
}
export interface PrintingMaterialIdentity extends PrintingImageIdentity {
  objectType: PrintMaterialObjectType
  materialName: string
  spu: string
  sku: string
  gsm: number
  widthCm: number
}
export interface PrintingPlannedInput extends PrintingMaterialIdentity {
  plannedQty: number
  qtyUnit: PrintingQtyUnit
  supplySource: string
  sourceWarehouseName: string
  sourceWarehouseStockQty: number
  pendingWarehouseStockQty: number
  whiteStockQty: number
  currentStockQty: number
  pendingPrintQty: number
}
export interface PrintingActualInput {
  receipts?: Array<{ receiptId: string; upstreamRecordId?: string; receiverName?: string; receivedAt?: string; qty: number; rollCount: number; actualSku: string }>
  actualSku: string
  receivedQty: number
  receivedRollCount: number
  usedQty: number
  usedRollCount: number
  receiverName: string
  receivedAt?: string
}
export interface PrintingPatternIdentity extends PrintingImageIdentity {
  patternNo: string
  patternVersion: string
  patternName: string
}
export interface PrintingRequirement {
  craftName: string
  type: string
  shade: string
  temperature: string
  printSide: '单面' | '双面'
  frontPattern: PrintingPatternIdentity
  insidePattern?: PrintingPatternIdentity
}
export interface PrintingOutput extends PrintingMaterialIdentity {
  plannedQty: number
  completedQty: number
  completedRollCount: number
  qtyUnit: PrintingQtyUnit
}
export interface PrintingHandoverFacts {
  handedOverQty: number
  receivedQty: number
  diffQty: number
  objectionQty: number
  handoverNo?: string
  receiverName: string
  receivedBy?: string
  handedOverAt?: string
  receivedAt?: string
  differenceReason?: string
}
export interface PrintingInputChangeRecord {
  changeId: string
  originalInput: PrintingPlannedInput
  newInput: PrintingPlannedInput
  originalStandardUnitUsage: number | null
  newStandardUnitUsage: number | null
  originalOrderUnitUsage: number | null
  newOrderUnitUsage: number | null
  reason: string
  operatorName: string
  changedAt: string
  crossSpecification: boolean
}
export interface PrintingOperationLog { logId: string; action: string; operatorName: string; operatedAt: string; remark: string }
export interface PrintingDocumentHistory {
  historyId: string
  documentName: '印花信息单' | '印花确认单' | '加工产出卷条码'
  action: '打印' | '下载' | '补打' | '标记需重印'
  operatorName: string
  operatedAt: string
  versionNo: string
  remark?: string
}
export interface PrintingDispatchDocument {
  id: string
  status: '草稿' | '已交出' | '已作废'
  createdAt: string
  createdBy: string
  handedOverAt?: string
  handedOverBy?: string
  lines: Array<{ workOrderId: string; barcodeIds: string[]; rolls?: PrintingRollBarcode[] }>
}

export interface PrintingRollBarcode {
  createdAt?: string
  outboundArea?: string
  handoverRecordId?: string
  id: string
  barcode: string
  printOrderNo: string
  sku: string
  status: '草稿' | '已打印' | '已交出' | '已入库'
  rollNo: string
  lengthY: number
  meters: number
  weightKg: number
  gsm: number
  widthCm: number
  vatNo: string
  warehouseName: string
  inboundStatus: '待上架' | '已上架'
  inboundAt?: string
  printedBy?: string
  printedAt?: string
  remark?: string
}
export interface PrintingBusinessViewFacts {
  dispatchDocuments?: PrintingDispatchDocument[]
  barcodeSequence?: number
  salesType: string
  creationMethod: string
  materialType: string
  historicalSupplement: boolean
  legacyProgressHint: string
  historicalInputQuantityUnknown?: boolean
  historicalRollQuantitiesUnknown?: boolean
  demandSource: PrintingDemandSource
  product: PrintingProductIdentity
  usage: PrintingUsageBasis
  plannedInput: PrintingPlannedInput
  actualInput: PrintingActualInput
  requirement: PrintingRequirement
  output: PrintingOutput
  handover: PrintingHandoverFacts
  printerNo: string
  transferCompletedQty: number
  pendingWritebackQty: number
  historicalLossQty: number
  inputReceivedAt?: string
  completedAt?: string
  deliveryAt?: string
  remark: string
  inputChanges: PrintingInputChangeRecord[]
  barcodes: PrintingRollBarcode[]
  documentHistory: PrintingDocumentHistory[]
  operationLogs: PrintingOperationLog[]
  printingDocumentsNeedReprint: boolean
}

export interface PrintingWorkOrderBusinessRecord extends PrintingBusinessViewFacts {
  workOrderId: string
  printOrderNo: string
  taskNo: string
  receiptStatus: PrintingReceiptStatus
  processingStatus: PrintingProcessingStatus
  handoverStatus: PrintingHandoverStatus
  printFactoryId: string
  printFactoryName: string
  confirmedReceiptDifference: boolean
  receivingTargetId: string
  receivingTargetName: string
  receivingTargetWarehouseName: string
  orderedAt: string
  plannedFinishAt?: string
  manuallyCompletedAt?: string
  manuallyCompletedBy?: string
}

export interface PrintingWorkOrderSummary {
  orderCount: number
  unknownInputCount: number
  byUnit: Array<{
    qtyUnit: PrintingQtyUnit
    plannedInputQty: number
    receivedInputQty: number
    pendingReceiptQty: number
    usedInputQty: number
    completedOutputQty: number
    handedOverQty: number
    receivedQty: number
  }>
}

export function normalizePrintMaterialObjectType(value: string | undefined): PrintMaterialObjectType {
  if (!value) return 'BOM原物料'
  if (value === '面料' || value === 'FABRIC' || value.includes('面料')) return '面料'
  if (value === '纱线' || value === 'YARN' || value.includes('纱线')) return '纱线'
  if (value === '花边' || value === 'LACE' || value.includes('花边')) return '花边'
  if (value === '织带' || value === 'WEBBING' || value.includes('织带')) return '织带'
  if (value === '拉链' || value === 'ZIPPER' || value.includes('拉链')) return '拉链'
  if (value === '包装材料' || value.includes('包装')) return '包装材料'
  if (value === '辅料' || value.includes('辅料')) return '辅料'
  if (value === '其他') return '其他'
  return 'BOM原物料'
}

function normalizePrintQuantityUnit(objectType: PrintMaterialObjectType, value: string | undefined): string {
  // 数量单位来自实际 BOM。不能再用“片/件”反推裁片或成衣对象；
  // 原物料本身也可能合法地按片、件计量，对象身份只看 BOM 类别。
  if (value) return value
  if (objectType === '面料' || objectType === '花边' || objectType === '织带') return '米'
  if (objectType === '纱线') return '公斤'
  return '个'
}

function resolvePrintMaterialObjectType(
  materialItems: Array<{ materialType?: string }>,
): PrintMaterialObjectType {
  const objectTypes = [...new Set(
    materialItems.map((item) => normalizePrintMaterialObjectType(item.materialType)),
  )]
  return objectTypes.length === 1 ? objectTypes[0] : 'BOM原物料'
}

export interface PrintWorkOrder {
  printOrderId: string
  printOrderNo: string
  sourceType: ProcessWorkOrderSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceKey?: string
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  productionOrderOrderedAt?: string
  stockMaterialId?: string
  stockMaterialName?: string
  productionOrderIds: string[]
  isFirstOrder: boolean
  artworkTaskId?: string
  trfFileId?: string
  patternNo: string
  patternVersion: string
  materialSku: string
  materialColor?: string
  objectType?: PrintMaterialObjectType
  plannedQty: number
  qtyUnit: string
  plannedFinishAt?: string
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
  acceptanceStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectionReason?: string
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
  formalProductionOrderSnapshot?: FormalProductionOrderProcessSnapshotRecord
  changeImpact?: ProcessWorkOrderChangeImpact[]
  autoSyncHistory?: ProcessWorkOrderAutoSyncRecord[]
  businessView?: PrintingBusinessViewFacts
  manuallyCompletedAt?: string
  manuallyCompletedBy?: string
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
  WAIT_REVIEW: '待审核',
  COMPLETED: '已完成',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
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
const createdPrintOrderIds = new Set<string>()
const nodeRecordStore = new Map<string, MutableNodeRecord[]>()
const reviewRecordStore = new Map<string, MutableReviewRecord>()

export const PRINTING_BUSINESS_PAGE_ORDER_IDS = [
  PRINT_WORK_ORDER_IDS.WAIT_ARTWORK,
  PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST,
  PRINT_WORK_ORDER_IDS.PRINTING,
  PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
  PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
  PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
] as const

const printingBusinessBaseline = new Map<string, MutablePrintWorkOrder>()
const printingBusinessNodeBaseline = new Map<string, MutableNodeRecord[]>()
const printingBusinessReviewBaseline = new Map<string, MutableReviewRecord | null>()
const printingBusinessTaskBaseline = new Map<string, PdaGenericTaskMock>()

let seeded = false

export interface PrintProcessMutationSnapshot {
  workOrders: Array<[string, MutablePrintWorkOrder]>
  nodeRecords: Array<[string, MutableNodeRecord[]]>
  reviewRecords: Array<[string, MutableReviewRecord]>
}

export function capturePrintProcessMutationState(): PrintProcessMutationSnapshot {
  return structuredClone({
    workOrders: Array.from(workOrderStore.entries()),
    nodeRecords: Array.from(nodeRecordStore.entries()),
    reviewRecords: Array.from(reviewRecordStore.entries()),
  })
}

export function restorePrintProcessMutationState(snapshot: PrintProcessMutationSnapshot): void {
  const restored = structuredClone(snapshot)
  workOrderStore.clear()
  nodeRecordStore.clear()
  reviewRecordStore.clear()
  restored.workOrders.forEach(([id, order]) => workOrderStore.set(id, order))
  restored.nodeRecords.forEach(([id, records]) => nodeRecordStore.set(id, records))
  restored.reviewRecords.forEach(([id, record]) => reviewRecordStore.set(id, record))
}


const PRINT_EXECUTION_STORAGE_KEY = 'higoods.formal-print-execution.v1'
let printMutationDepth = 0
let printPersistenceReadError: string | null = null
function formalPrintIds(): Set<string> {
  return new Set(productionOrders.filter(order => !initialProductionOrderIds.has(order.productionOrderId)).flatMap(order => (order.processWorkOrderDefinitions ?? []).filter(definition => definition.processCode === 'PRINT').map(definition => definition.workOrderId)))
}
function saveFormalPrintExecution(): void {
  if (typeof localStorage === 'undefined') return
  const ids = formalPrintIds(), state = capturePrintProcessMutationState()
  state.workOrders = state.workOrders.filter(([id]) => ids.has(id))
  state.nodeRecords = state.nodeRecords.filter(([id]) => ids.has(id))
  state.reviewRecords = state.reviewRecords.filter(([id]) => ids.has(id))
  const tasks = state.workOrders.flatMap(([, order]) => { const task = getPrintingTaskById(order.taskId); return task ? [structuredClone(task)] : [] })
  const raw = JSON.stringify({ version: 1, state, tasks })
  localStorage.setItem(PRINT_EXECUTION_STORAGE_KEY, raw)
  if (localStorage.getItem(PRINT_EXECUTION_STORAGE_KEY) !== raw) throw new Error('印花保存结果未核实')
}
function restoreFormalPrintExecution(): void {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(PRINT_EXECUTION_STORAGE_KEY)
  if (!raw) return
  try {
    const saved = JSON.parse(raw) as { version: number; state: PrintProcessMutationSnapshot; tasks: PdaGenericTaskMock[] }
    if (saved.version !== 1 || !Array.isArray(saved.tasks) || !saved.state || !['workOrders', 'nodeRecords', 'reviewRecords'].every(key => Array.isArray(saved.state[key as keyof PrintProcessMutationSnapshot]) && saved.state[key as keyof PrintProcessMutationSnapshot].every(row => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && row[1] && typeof row[1] === 'object'))) throw new Error('记录格式不完整')
    const ids = formalPrintIds(), seen = new Set<string>()
    for (const [id, order] of saved.state.workOrders) {
      const current = workOrderStore.get(id)
      const nodes = saved.state.nodeRecords.find(([key]) => key === id)?.[1]
      const task = saved.tasks.find(item => item.taskId === order.taskId)
      if (!ids.has(id) || seen.has(id) || !current || order.printOrderId !== id || order.taskId !== current.taskId || !order.sourceKey || order.sourceKey !== current.sourceKey || JSON.stringify(order.sourceSnapshot) !== JSON.stringify(current.sourceSnapshot) || order.qtyUnit !== current.qtyUnit || order.plannedQty !== current.plannedQty || !(order.status in PRINT_WORK_ORDER_STATUS_LABEL)
        || !Array.isArray(nodes) || nodes.some(node => node.printOrderId !== id || node.taskId !== order.taskId)
        || !task || JSON.stringify(task.sourceSnapshot) !== JSON.stringify(order.sourceSnapshot) || task.assignedFactoryId !== (order.printFactoryId || undefined)
        || !order.businessView || !Array.isArray(order.businessView.barcodes) || order.businessView.barcodes.some(barcode => barcode.sku !== order.businessView!.output.sku || !Number.isFinite(barcode.lengthY) || barcode.lengthY < 0)
        || [order.businessView.actualInput.receivedQty, order.businessView.actualInput.usedQty, order.businessView.output.completedQty, order.businessView.output.completedRollCount].some(qty => !Number.isFinite(qty) || qty < 0)) throw new Error('原加工单、卷或冻结来源不一致')
      seen.add(id)
    }
    if (saved.state.nodeRecords.some(([id]) => !seen.has(id)) || saved.state.reviewRecords.some(([id, review]) => !seen.has(id) || review.printOrderId !== id) || saved.tasks.some(task => !saved.state.workOrders.some(([, order]) => order.taskId === task.taskId))) throw new Error('记录越出原加工单范围')
    saved.state.workOrders.forEach(([id, order]) => workOrderStore.set(id, structuredClone(order)))
    saved.state.nodeRecords.forEach(([id, records]) => nodeRecordStore.set(id, structuredClone(records)))
    saved.state.reviewRecords.forEach(([id, review]) => reviewRecordStore.set(id, structuredClone(review)))
    saved.tasks.forEach(task => registerPdaGenericProcessTask(structuredClone(task)))
  } catch (error) { printPersistenceReadError = '已保存的印花记录损坏或与原来源不一致，未覆盖原记录，请联系负责人。' + (error instanceof Error ? error.message : String(error)); throw new Error(printPersistenceReadError) }
}
export function runPrintProcessMutation<T>(action: () => T): T {
  if (printMutationDepth) return action()
  seedDomain()
  if (printPersistenceReadError) throw new Error(printPersistenceReadError)
  const before = capturePrintProcessMutationState()
  const tasks = [...workOrderStore.values()].flatMap(order => { const task = getPrintingTaskById(order.taskId); return task ? [structuredClone(task)] : [] })
  const handoverBefore = capturePdaHandoverState()
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(PRINT_EXECUTION_STORAGE_KEY)
  printMutationDepth++
  try {
    const result = action()
    const ids = formalPrintIds()
    for (const order of workOrderStore.values()) {
      if (!ids.has(order.printOrderId) || !order.handoverOrderId) continue
      const head = getHandoverOrderById(order.handoverOrderId)
      if (!head || head.taskId !== order.taskId || JSON.stringify(head.sourceSnapshot) !== JSON.stringify(order.sourceSnapshot) || (head.sourceDocId && head.sourceDocId !== order.printOrderId) || (head.sourceBusinessType && head.sourceBusinessType !== 'PRINT_WORK_ORDER')) throw new Error('原交出单与印花加工单来源不一致')
      if (!head.sourceDocId || !head.sourceBusinessType) upsertPdaHandoverHeadMock({ ...head, sourceBusinessType: 'PRINT_WORK_ORDER', sourceDocId: order.printOrderId, sourceDocNo: order.printOrderNo })
      persistPdaHandoverState({ handoverId: head.handoverId, taskId: order.taskId, productionOrderId: order.sourceSnapshot?.productionOrderId || '', sourceDocId: order.printOrderId, sourceBusinessType: 'PRINT_WORK_ORDER' })
    }
    saveFormalPrintExecution()
    return result
  } catch (error) {
    restorePrintProcessMutationState(before)
    tasks.forEach(task => registerPdaGenericProcessTask(task))
    let rollbackFailed = false
    try { restorePdaHandoverState(handoverBefore) } catch { rollbackFailed = true }
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(PRINT_EXECUTION_STORAGE_KEY) !== raw) { if (raw === null) localStorage.removeItem(PRINT_EXECUTION_STORAGE_KEY); else localStorage.setItem(PRINT_EXECUTION_STORAGE_KEY, raw) } } catch { rollbackFailed = true }
    if (rollbackFailed) throw new Error('印花操作未保存，回退未核实，请保留页面并联系主管。')
    throw new Error('印花操作未保存，原动作已撤回。' + (error instanceof Error ? error.message : String(error)))
  } finally { printMutationDepth-- }
}

const GENERATED_PRINT_CRAFTS = listActiveProcessCraftDefinitions()
  .filter((definition) => definition.processCode === 'PRINT' && definition.defaultDocType === 'PREPARATION_ORDER')

interface GeneratedPrintContext {
  productionOrder: ProductionOrder
  techPackSnapshot: ProductionOrderTechPackSnapshot
  craftDefinition: ProcessCraftDefinition
  mockIndex: number
  plannedQty: number
  materialName: string
  materialObjectType: PrintMaterialObjectType
  materialQtyUnit?: string
  materialColor?: string
}

export function resolvePrintDemoMaterial(
  techPackSnapshot: Pick<ProductionOrderTechPackSnapshot, 'bomItems'>,
  fallbackMaterialName: string,
  fallbackColor?: string,
): { materialName: string; materialObjectType: PrintMaterialObjectType; materialColor?: string } {
  const bomItem = selectPrimaryProductionMaterialBomItem(techPackSnapshot.bomItems)
  return {
    materialName: bomItem ? `${bomItem.name}${bomItem.spec ? ` / ${bomItem.spec}` : ''}` : fallbackMaterialName,
    materialObjectType: normalizePrintMaterialObjectType(bomItem?.type),
    materialColor: bomItem?.colorLabel || fallbackColor,
  }
}

function getProductionOrderQty(order: ProductionOrder): number {
  const skuQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return Math.max(1, Math.round(skuQty || 1))
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

function getGeneratedPrintContext(index: number): GeneratedPrintContext | null {
  const generatedCraft = getGeneratedPrintCraft(index)
  if (!generatedCraft) return null
  const source = getDictionaryCraftMockSource(generatedCraft.craftDefinition.craftCode, generatedCraft.mockIndex)
  const preferredOrderId = source?.order.productionOrderId
  const productionOrder = productionOrders.find((order) => order.productionOrderId === preferredOrderId)
  if (!productionOrder) return null
  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  if (!techPackSnapshot) return null
  const material = resolvePrintDemoMaterial(
    techPackSnapshot,
    productionOrder.demandSnapshot.spuName,
    productionOrder.demandSnapshot.skuLines[0]?.color,
  )
  const primaryBomItem = selectPrimaryProductionMaterialBomItem(techPackSnapshot.bomItems)
  return {
    productionOrder,
    techPackSnapshot,
    craftDefinition: generatedCraft.craftDefinition,
    mockIndex: generatedCraft.mockIndex,
    plannedQty: getProductionOrderQty(productionOrder),
    materialQtyUnit: primaryBomItem?.unit,
    ...material,
  }
}

function getVisiblePrintWorkOrderIds(): Set<string> {
  return new Set(
    Array.from(workOrderStore.values())
      .sort((left, right) => left.printOrderNo.localeCompare(right.printOrderNo))
      .map((order) => order.printOrderId),
  )
}

function buildGeneratedPrintWorkOrder(order: MutablePrintWorkOrder, index: number): MutablePrintWorkOrder {
  if (createdPrintOrderIds.has(order.printOrderId)) return order
  const context = getGeneratedPrintContext(index)
  if (!context) {
    const sourceProductionOrderId = order.sourceProductionOrderId || order.productionOrderIds[0]
    const sourceOrder = productionOrders.find((item) => item.productionOrderId === sourceProductionOrderId)
    if (!sourceOrder) {
      return {
        ...order,
        sourceType: 'STOCK',
        sourceProductionOrderId: undefined,
        sourceProductionOrderNo: undefined,
        productionOrderOrderedAt: undefined,
        productionOrderIds: [],
        stockMaterialId: `STOCK-${order.printOrderId}`,
        stockMaterialName: order.materialSku,
        remark: `${order.remark || '印花加工'}；来源备货物料 ${order.materialSku}。`,
      }
    }
    return {
      ...order,
      sourceProductionOrderId,
      sourceProductionOrderNo: order.sourceProductionOrderNo || sourceOrder.productionOrderNo,
      productionOrderOrderedAt: order.productionOrderOrderedAt || sourceOrder.createdAt,
    }
  }
  const { productionOrder, techPackSnapshot, craftDefinition, mockIndex, plannedQty, materialName, materialObjectType, materialQtyUnit, materialColor } = context
  return {
    ...order,
    sourceType: 'PRODUCTION_ORDER',
    sourceProductionOrderId: productionOrder.productionOrderId,
    sourceProductionOrderNo: productionOrder.productionOrderNo,
    productionOrderOrderedAt: productionOrder.createdAt,
    productionOrderIds: [productionOrder.productionOrderId],
    isFirstOrder: mockIndex === 0,
    patternNo: techPackSnapshot.sourceTechPackVersionCode || techPackSnapshot.styleCode,
    patternVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
    materialSku: materialName,
    objectType: materialObjectType,
    materialColor,
    plannedQty,
    qtyUnit: normalizePrintQuantityUnit(materialObjectType, materialQtyUnit),
    qtyLabel: undefined,
    plannedRollCount: materialObjectType === '面料' ? Math.max(1, Math.ceil(plannedQty / 100)) : order.plannedRollCount,
    createdAt: productionOrder.createdAt,
    updatedAt: order.updatedAt || productionOrder.updatedAt,
    remark: `${craftDefinition.craftName}；来源生产单 ${productionOrder.productionOrderNo}，技术包 ${techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel}。`,
  }
}

function syncSeedSourceToTaskAndHandovers(order: MutablePrintWorkOrder): void {
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType: order.sourceType,
    productionOrderNo: order.sourceProductionOrderNo || order.productionOrderIds[0],
    supplementRecordId: order.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: order.sourceSnapshot?.supplementRecordNo,
  })
  order.receiverKind = 'WAREHOUSE'
  order.receiverName = receivingTarget.targetName
  order.targetTransferWarehouseId = receivingTarget.targetWarehouseId
  order.targetTransferWarehouseName = receivingTarget.targetWarehouseName
  const task = getPrintingTaskById(order.taskId)
  if (task) {
    task.sourceType = order.sourceType
    task.sourceSnapshot = order.sourceSnapshot ? structuredClone(order.sourceSnapshot) : undefined
    if (order.sourceType === 'STOCK') {
      task.stockMaterialId = order.stockMaterialId
      task.stockMaterialName = order.stockMaterialName
      task.productionOrderId = undefined
      task.productionOrderNo = undefined
      task.sourceProductionOrderId = undefined
    } else {
      task.productionOrderId = order.sourceProductionOrderId
      task.productionOrderNo = order.sourceProductionOrderNo
      task.sourceProductionOrderId = order.sourceProductionOrderId
      task.stockMaterialId = undefined
      task.stockMaterialName = undefined
    }
    task.receiverKind = 'WAREHOUSE'
    task.receiverId = receivingTarget.targetBusinessId
    task.receiverName = receivingTarget.targetName
    registerPdaGenericProcessTask(task)
  }

  listHandoverOrdersByTaskId(order.taskId).forEach((head) => {
    const records = getPdaHandoverRecordsByHead(head.handoverId)
    const sourceFields = order.sourceType === 'STOCK'
      ? {
          sourceType: 'STOCK' as const,
          sourceSnapshot: order.sourceSnapshot ? structuredClone(order.sourceSnapshot) : undefined,
          stockMaterialId: order.stockMaterialId,
          stockMaterialName: order.stockMaterialName,
          productionOrderId: undefined,
          productionOrderNo: undefined,
        }
      : {
          sourceType: order.sourceType,
          sourceSnapshot: order.sourceSnapshot ? structuredClone(order.sourceSnapshot) : undefined,
          productionOrderId: order.sourceProductionOrderId,
          productionOrderNo: order.sourceProductionOrderNo,
          stockMaterialId: undefined,
          stockMaterialName: undefined,
        }
    upsertPdaHandoverHeadMock({
      ...head,
      ...sourceFields,
      targetName: receivingTarget.targetName,
      targetKind: 'WAREHOUSE',
      receiverKind: 'WAREHOUSE',
      receiverId: receivingTarget.targetBusinessId,
      receiverName: receivingTarget.targetName,
    })
    records.forEach((record) => {
      upsertPdaHandoutRecordMock({ ...record, ...sourceFields })
    })
  })
  syncFactoryWarehouseHandoverSourceByTaskId(order.taskId)
}

function normalizeSeedWorkOrderSources(): void {
  Array.from(workOrderStore.values())
    .sort((left, right) => left.printOrderNo.localeCompare(right.printOrderNo))
    .forEach((order, index) => {
      const normalized = buildGeneratedPrintWorkOrder(order, index)
      workOrderStore.set(normalized.printOrderId, normalized)
      syncSeedSourceToTaskAndHandovers(normalized)
    })
}

function syncSeedQuantityUnitsFromWorkOrders(): void {
  workOrderStore.forEach((order) => {
    const qtyUnit = getQtyUnit(order)
    const nodes = nodeRecordStore.get(order.printOrderId)
    if (nodes) nodes.forEach((node) => { node.qtyUnit = qtyUnit })
    const review = reviewRecordStore.get(order.printOrderId)
    if (review) {
      review.lengthUnit = qtyUnit
      review.receivedLength = review.receivedQty > 0 ? review.receivedQty : undefined
    }
  })
}

function listGeneratedPrintWorkOrders(): MutablePrintWorkOrder[] {
  return Array.from(workOrderStore.values())
    .sort((left, right) => left.printOrderNo.localeCompare(right.printOrderNo))
}

function cloneWorkOrder(order: MutablePrintWorkOrder): PrintWorkOrder {
  return {
    ...order,
    sourceSnapshot: order.sourceSnapshot ? structuredClone(order.sourceSnapshot) : undefined,
    productionOrderIds: [...order.productionOrderIds],
    formalProductionOrderSnapshot: order.formalProductionOrderSnapshot
      ? structuredClone(order.formalProductionOrderSnapshot)
      : undefined,
    changeImpact: order.changeImpact ? structuredClone(order.changeImpact) : undefined,
    autoSyncHistory: order.autoSyncHistory ? structuredClone(order.autoSyncHistory) : undefined,
    businessView: order.businessView ? structuredClone(order.businessView) : undefined,
  }
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
  return localDateTimeText(date)
}

function roundPrintingValue(value: number, precision: number): number {
  const scale = 10 ** precision
  return Math.round((value + Number.EPSILON) * scale) / scale
}

export function metersFromYards(yards: number): number {
  return roundPrintingValue(yards * 0.9144, 2)
}

export function yardsFromMeters(meters: number): number {
  return roundPrintingValue(meters / 0.9144, 2)
}

export function weightKgFromMeters(meters: number, widthCm: number, gsm: number): number {
  return roundPrintingValue(meters * (widthCm / 100) * (gsm / 1000), 3)
}

export function formatPrintingQty(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

export function formatPrintingUsage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '直接数量'
  return value.toFixed(4)
}

export function formatPrintingWeightKg(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : '0.000'
}

function calculatePrintingPlannedInput(usage: PrintingUsageBasis, directQty: number): number {
  if (usage.calculationMode === 'DIRECT') return roundPrintingValue(directQty, 2)
  if (usage.orderUnitUsage === null) throw new Error('按用量计算时必须填写加工单单位用量')
  return roundPrintingValue(usage.demandBaseQty * usage.orderUnitUsage, 2)
}

function makePrintingBarcode(input: {
  printOrderNo: string
  outputSku: string
  rollIndex: number
  lengthY: number
  gsm: number
  widthCm: number
  qtyUnit: PrintingQtyUnit
  objectType: PrintMaterialObjectType
  status?: PrintingRollBarcode['status']
}): PrintingRollBarcode {
  const rollNo = String(input.rollIndex + 1).padStart(4, '0')
  const normalizedUnit = input.qtyUnit.toLowerCase()
  const meters = normalizedUnit === 'yard'
    ? metersFromYards(input.lengthY)
    : ['米', 'meter', 'm'].includes(normalizedUnit) ? roundPrintingValue(input.lengthY, 2) : 0
  const weightKg = ['公斤', 'kg'].includes(normalizedUnit)
    ? roundPrintingValue(input.lengthY, 3)
    : input.gsm > 0 && input.widthCm > 0 ? weightKgFromMeters(meters, input.widthCm, input.gsm) : 0
  return {
    id: `ROLL-${input.printOrderNo}-${rollNo}`,
    barcode: `M_${input.printOrderNo.replace(/\D/g, '') || 'PRINT'}_${input.printOrderNo}_${rollNo}`,
    printOrderNo: input.printOrderNo,
    sku: input.outputSku,
    status: input.status || '草稿',
    rollNo,
    lengthY: roundPrintingValue(input.lengthY, 2),
    meters,
    weightKg,
    gsm: input.gsm,
    widthCm: input.widthCm,
    vatNo: '',
    warehouseName: input.objectType === '面料' ? 'HILON-面料仓' : 'HILON-物料仓',
    inboundStatus: '待上架',
  }
}

function makePrintingBarcodes(input: {
  printOrderNo: string
  outputSku: string
  completedQty: number
  completedRollCount: number
  plannedRollCount: number
  gsm: number
  widthCm: number
  qtyUnit: PrintingQtyUnit
  objectType: PrintMaterialObjectType
  handedOver?: boolean
  received?: boolean
}): PrintingRollBarcode[] {
  const count = Math.max(input.completedRollCount || input.plannedRollCount || 1, 1)
  const lengthY = input.completedQty > 0 ? roundPrintingValue(input.completedQty / count, 2) : 0
  return Array.from({ length: count }, (_, rollIndex) => {
    const status: PrintingRollBarcode['status'] = input.received ? '已入库' : input.handedOver ? '已交出' : '草稿'
    const barcode = makePrintingBarcode({ ...input, rollIndex, lengthY, status })
    if (input.received) {
      barcode.inboundStatus = '已上架'
      barcode.inboundAt = '2026-03-29 17:10:00'
    }
    return barcode
  })
}

function isPrintingTask(task: PdaGenericTaskMock): boolean {
  return task.processBusinessCode === 'PRINT' || task.processCode === 'PROC_PRINT' || task.processNameZh === '印花'
}

function listRawPrintingTasks(): PdaGenericTaskMock[] {
  return listPdaGenericProcessTasks()
    .filter(isPrintingTask)
    .sort((left, right) => left.taskId.localeCompare(right.taskId))
}

let printingTaskCloneSeedState: 'idle' | 'seeding' | 'ready' = 'idle'

function ensurePrintingTaskCloneSeedData(): void {
  if (printingTaskCloneSeedState !== 'idle') return
  printingTaskCloneSeedState = 'seeding'
  try {
    ensurePrintingTaskClone('TASK-PRINT-000716', 'TASK-PRINT-000724', 'PO-20260329-079')
    printingTaskCloneSeedState = 'ready'
  } catch (error) {
    printingTaskCloneSeedState = 'idle'
    throw error
  }
}

function getPrintingTasks(): PdaGenericTaskMock[] {
  ensurePrintingTaskCloneSeedData()
  return listRawPrintingTasks()
}

function getPrintingTaskById(taskId: string): PdaGenericTaskMock | undefined {
  return getPrintingTasks().find((task) => task.taskId === taskId)
}

function buildFreshPrintMobileTask(input: {
  taskId: string
  taskNo: string
  sourceType?: ProcessWorkOrderSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  spuCode: string
  spuName: string
  requiredDeliveryDate: string
  factoryId: string
  factoryName: string
  qty: number
  qtyDisplayUnit: string
  processName: string
  createdAt: string
}): PdaGenericTaskMock {
  const hasFactory = Boolean(input.factoryId)
  const sourceType: ProcessWorkOrderSourceType = input.sourceType || 'PRODUCTION_ORDER'
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType,
    productionOrderNo: input.productionOrderNo || input.productionOrderId,
    supplementRecordId: input.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: input.sourceSnapshot?.supplementRecordNo,
  })
  const qtyUnit: QtyUnit = ['件', '片', '个', '套'].includes(input.qtyDisplayUnit)
    ? 'PIECE'
    : ['卷', '捆', '包', '打'].includes(input.qtyDisplayUnit)
      ? 'BUNDLE'
      : 'METER'
  return {
    taskId: input.taskId,
    taskNo: input.taskNo,
    sourceType,
    sourceSnapshot: input.sourceSnapshot ? structuredClone(input.sourceSnapshot) : undefined,
    ...(sourceType === 'STOCK'
      ? { stockMaterialId: input.stockMaterialId, stockMaterialName: input.stockMaterialName }
      : { productionOrderId: input.productionOrderId, productionOrderNo: input.productionOrderNo, sourceProductionOrderId: input.productionOrderId }),
    spuCode: input.spuCode,
    spuName: input.spuName,
    requiredDeliveryDate: input.requiredDeliveryDate,
    seq: 1,
    processCode: 'PROC_PRINT',
    processNameZh: input.processName,
    stage: 'PREP',
    qty: input.qty,
    qtyUnit,
    qtyDisplayUnit: input.qtyDisplayUnit,
    assignmentMode: 'DIRECT',
    assignmentStatus: hasFactory ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL', recommendedTypes: ['PRINTING'] },
    assignedFactoryId: hasFactory ? input.factoryId : undefined,
    assignedFactoryName: hasFactory ? input.factoryName : '待分配工厂',
    qcPoints: [],
    attachments: [],
    status: 'NOT_STARTED',
    acceptanceStatus: 'PENDING',
    dispatchRemark: hasFactory ? '印花加工单已分配，待工厂接收。' : '正式生产单已生成加工单，待分配工厂。',
    dispatchedAt: hasFactory ? input.createdAt : undefined,
    dispatchedBy: hasFactory ? '平台自动生成' : undefined,
    taskQrValue: buildTaskQrValue(input.taskId),
    taskQrStatus: 'ACTIVE',
    handoverStatus: 'NOT_CREATED',
    receiverKind: 'WAREHOUSE',
    receiverId: receivingTarget.targetBusinessId,
    receiverName: receivingTarget.targetName,
    stageCode: 'PREP',
    stageName: '准备阶段',
    processBusinessCode: 'PRINT',
    processBusinessName: input.processName,
    mockProcessKey: 'PRINTING',
    mockOrigin: 'DIRECT_PENDING',
    handoutStatus: 'PENDING',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    auditLogs: [],
    mockReceiveSummary: hasFactory ? '印花加工单已分配，待工厂接收。' : '印花加工单待分配工厂。',
    mockExecutionSummary: '按正式技术包印花工序执行。',
    mockHandoverSummary: '完成印花后统一交出。',
  }
}

function ensurePrintingTaskClone(sourceTaskId: string, taskId: string, productionOrderId: string): void {
  const printingTasks = listRawPrintingTasks()
  if (printingTasks.some((task) => task.taskId === taskId)) return
  const source = printingTasks.find((task) => task.taskId === sourceTaskId)
  if (!source) return
  registerPdaGenericProcessTask({
    ...source,
    taskId,
    taskNo: taskId,
    taskQrValue: buildTaskQrValue(taskId),
    productionOrderId,
    productionOrderNo: productionOrderId,
    tenderId: source.tenderId ? `${source.tenderId}-${taskId}` : undefined,
    materialRequestNo: source.materialRequestNo ? `MR-PRINT-${taskId.split('-').at(-1)}` : undefined,
    auditLogs: source.auditLogs.map((log, index) => ({
      ...log,
      id: `AL-${taskId}-${log.action}-${index + 1}`,
    })),
  })
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
    assignedFactoryId?: string
    assignedFactoryName?: string
    dispatchedAt?: string
    dispatchedBy?: string
    acceptedAt?: string
    acceptedBy?: string
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
  if (typeof input.assignedFactoryId !== 'undefined') task.assignedFactoryId = input.assignedFactoryId
  if (typeof input.assignedFactoryName !== 'undefined') task.assignedFactoryName = input.assignedFactoryName
  if (typeof input.dispatchedAt !== 'undefined') task.dispatchedAt = input.dispatchedAt
  if (typeof input.dispatchedBy !== 'undefined') task.dispatchedBy = input.dispatchedBy
  if (typeof input.acceptedAt !== 'undefined') task.acceptedAt = input.acceptedAt
  if (typeof input.acceptedBy !== 'undefined') task.acceptedBy = input.acceptedBy
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
  objectType?: 'MATERIAL' | 'FABRIC'
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
      factoryRemark: `印花加工产出交给${head.receiverName || head.targetName}`,
      objectType: input.objectType ?? 'MATERIAL',
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
      handoverRecordId: firstRecord.handoverRecordId || firstRecord.recordId,
      receiverWrittenQty: input.receiverWrittenQty,
      receiverWrittenAt: input.receiverWrittenAt,
      receiverWrittenBy: head.receiverName || head.targetName,
      receiverRemark: input.receiverRemark,
      diffReason: input.diffReason,
    })
  }

  const nextRecords = getPdaHandoverRecordsByHead(head.handoverId)
  return {
    handoverOrderId,
    recordIds: nextRecords.map((record) => record.handoverRecordId || record.recordId),
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
  | 'targetTransferWarehouseId'
  | 'targetTransferWarehouseName'
> & {
  handoverOrderId?: string
  dispatchPrice?: number
}): void {
  const currentInput = { ...input }
  const objectType = normalizePrintMaterialObjectType(input.objectType)
  const qtyUnit = normalizePrintQuantityUnit(objectType, input.qtyUnit)
  const task = getPrintingTaskById(input.taskId)
  const receivingTarget = resolveTerminalProcessOrderReceivingTarget({
    sourceType: input.sourceType,
    productionOrderNo: input.sourceProductionOrderNo || input.productionOrderIds[0],
    supplementRecordId: input.sourceSnapshot?.supplementRecordId,
    supplementRecordNo: input.sourceSnapshot?.supplementRecordNo,
  })
  const handoverOrder = input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : getPrimaryHandoverOrder(input.taskId)
  if (task) {
    const hasFactory = Boolean(input.printFactoryId)
    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = hasFactory ? 'ASSIGNED' : 'UNASSIGNED'
    task.acceptanceStatus = 'PENDING'
    task.assignedFactoryId = hasFactory ? input.printFactoryId : undefined
    task.assignedFactoryName = hasFactory ? input.printFactoryName : '待分配工厂'
    task.tenderId = undefined
    task.awardedAt = undefined
    task.dispatchedBy = hasFactory ? '平台派单' : undefined
    task.dispatchRemark = hasFactory ? '印花加工单已分配，待工厂接单。' : '正式生产单已生成加工单，待分配工厂。'
    task.dispatchPrice = input.dispatchPrice ?? 1200
    task.dispatchPriceCurrency = 'IDR'
    task.dispatchPriceUnit = 'Yard'
    task.standardPriceCurrency = 'IDR'
    task.standardPriceUnit = 'Yard'
    task.mockOrigin = 'DIRECT_PENDING'
    task.mockReceiveSummary = hasFactory ? '印花加工单已分配，待工厂接单。' : '印花加工单待分配工厂。'
    task.receiverKind = 'WAREHOUSE'
    task.receiverId = receivingTarget.targetBusinessId
    task.receiverName = receivingTarget.targetName
  }

  workOrderStore.set(input.printOrderId, {
    ...currentInput,
    objectType,
    qtyUnit,
    assignmentMode: '派单',
    assignmentModeEditable: false,
    dispatchPrice: input.dispatchPrice ?? 1200,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: 'Yard',
    dispatchPriceDisplay: `${input.dispatchPrice ?? 1200} IDR/Yard`,
    taskQrValue: task?.taskQrValue || buildTaskQrValue(input.taskId),
    targetTransferWarehouseId: receivingTarget.targetWarehouseId,
    targetTransferWarehouseName: receivingTarget.targetWarehouseName,
    receiverKind: 'WAREHOUSE',
    receiverName: receivingTarget.targetName,
    handoverOrderId: handoverOrder?.handoverOrderId || handoverOrder?.handoverId || input.handoverOrderId,
    handoverOrderNo: handoverOrder?.handoverOrderNo,
  })
}

function seedWorkOrders(): void {
  const seededExecutionProjections = [
    { taskId: 'TASK-PRINT-000716', productionOrderId: 'PO-20260328-071', qty: 920, createdAt: '2026-03-27 08:00:00' },
    { taskId: 'TASK-PRINT-000714', productionOrderId: 'PO-20260328-072', qty: 880, createdAt: '2026-03-27 09:20:00', qtyDisplayUnit: '米' },
    { taskId: 'TASK-PRINT-000715', productionOrderId: 'PO-20260328-073', qty: 860, createdAt: '2026-03-27 09:40:00', qtyDisplayUnit: '米' },
    { taskId: 'TASK-PRINT-000717', productionOrderId: 'PO-20260328-074', qty: 872, createdAt: '2026-03-27 09:00:00' },
    { taskId: 'TASK-PRINT-000718', productionOrderId: 'PO-20260328-075', qty: 808, createdAt: '2026-03-27 10:00:00' },
    { taskId: 'TASK-PRINT-000719', productionOrderId: 'PO-20260328-076', qty: 1044, createdAt: '2026-03-27 11:00:00' },
    { taskId: 'TASK-PRINT-000720', productionOrderId: 'PO-20260328-077', qty: 468, createdAt: '2026-03-27 11:30:00' },
    { taskId: 'TASK-PRINT-000721', productionOrderId: 'PO-20260329-078', qty: 624, createdAt: '2026-03-28 08:00:00' },
    { taskId: 'TASK-PRINT-000724', productionOrderId: 'PO-20260329-079', qty: 1010, createdAt: '2026-03-28 09:00:00' },
    { taskId: 'TASK-PRINT-000712', productionOrderId: 'PO-20260329-080', qty: 740, createdAt: '2026-03-28 10:00:00' },
    { taskId: 'TASK-PRINT-000722', productionOrderId: 'PO-20260329-081', qty: 910, createdAt: '2026-03-29 09:10:00' },
    { taskId: 'TASK-PRINT-000723', productionOrderId: 'PO-20260329-082', qty: 960, createdAt: '2026-03-29 09:30:00' },
  ]
  seededExecutionProjections.forEach((projection) => {
    if (getPrintingTaskById(projection.taskId)) return
    registerPdaGenericProcessTask(buildFreshPrintMobileTask({
      ...projection,
      taskNo: projection.taskId,
      spuCode: `PRINT-${projection.taskId}`,
      spuName: '印花加工物料',
      requiredDeliveryDate: '2026-03-31',
      factoryId: TEST_FACTORY_ID,
      factoryName: TEST_FACTORY_NAME,
      qtyDisplayUnit: projection.qtyDisplayUnit || '米',
      processName: '印花',
    }))
  })
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
    startedAt: transferTask?.startedAt || '2026-03-28 11:00:00',
    blockReason: undefined,
    blockRemark: undefined,
  })
  syncLinkedTaskState('TASK-PRINT-000719', {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    startedAt: handoverTask?.startedAt || '2026-03-28 12:30:00',
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
    diffReason: '接收方复核少 6 片',
  })
  const completedSeed = ensureSeededHandoverRecord({
    taskId: 'TASK-PRINT-000721',
    submittedQty: 624,
    receiverWrittenQty: 624,
    submittedAt: '2026-03-29 14:10:00',
    receiverWrittenAt: '2026-03-29 16:50:00',
    diffReason: '',
  })
  const handoverSeed = ensureSeededHandoverRecord({
    taskId: 'TASK-PRINT-000719',
    submittedQty: 1044,
    submittedAt: '2026-03-28 18:20:00',
  })
  syncLinkedTaskState('TASK-PRINT-000716', {
    status: 'IN_PROGRESS',
    startedAt: '2026-03-28 13:20:00',
    acceptanceStatus: 'ACCEPTED',
  })
  syncLinkedTaskState('TASK-PRINT-000724', {
    status: 'IN_PROGRESS',
    startedAt: '2026-03-29 13:20:00',
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
    receiverRemark: '接收方发现局部花位偏差',
    diffReason: '局部花位偏差，需退回补送',
  })
  const handoverHead = handoverSeed.handoverOrderId
    ? getHandoverOrderById(handoverSeed.handoverOrderId)
    : getPrimaryHandoverOrder('TASK-PRINT-000719')

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_ARTWORK,
    printOrderNo: 'PH-20260328-001',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-071'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-001',
    patternVersion: 'V3',
    materialSku: 'FAB-PRINT-001',
    materialColor: '奶白底黑花',
    objectType: '面料',
    plannedQty: 920,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
    productionOrderIds: ['PO-20260328-072'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-018',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-018',
    materialColor: '灰底红花',
    objectType: '面料',
    plannedQty: 880,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
    productionOrderIds: ['PO-20260328-073'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-026',
    patternVersion: 'V4',
    materialSku: 'FAB-PRINT-026',
    materialColor: '米黄底蓝花',
    objectType: '面料',
    plannedQty: 860,
    qtyUnit: '米',
    qtyLabel: '计划印花面料米数',
    plannedRollCount: 6,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
    productionOrderIds: ['PO-20260328-074'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-032',
    patternVersion: 'V5',
    materialSku: 'FAB-PRINT-032',
    materialColor: '黑底白花',
    plannedQty: printingTask?.qty ?? 872,
    qtyUnit: '米',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
    productionOrderIds: ['PO-20260328-075'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-037',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-037',
    materialColor: '浅蓝底白花',
    plannedQty: transferTask?.qty ?? 808,
    qtyUnit: '米',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'WAIT_HANDOVER',
    taskId: 'TASK-PRINT-000718',
    taskNo: 'TASK-PRINT-000718',
    createdAt: '2026-03-27 10:30:00',
    updatedAt: '2026-03-28 15:10:00',
    handoverOrderId: orderForWaitHandover,
    remark: '转印结束，等待交给指定接收方',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
    printOrderNo: 'PH-20260328-006',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-076'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-041',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-041',
    materialColor: '深灰底银花',
    plannedQty: handoverTask?.qty ?? 1044,
    qtyUnit: '米',
    plannedRollCount: 9,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'HANDOVER_WAIT_RECEIVE',
    taskId: 'TASK-PRINT-000719',
    taskNo: 'TASK-PRINT-000719',
    createdAt: '2026-03-27 11:00:00',
    updatedAt: '2026-03-28 18:20:00',
    handoverOrderId: handoverHead?.handoverOrderId || handoverHead?.handoverId,
    remark: '已发起交出，等待指定接收方确认收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.PARTIAL_HANDOVER,
    printOrderNo: 'PH-20260328-007',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260328-077'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-045',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-045',
    materialColor: '浅卡其底墨绿花',
    plannedQty: reviewTask?.qty ?? 468,
    qtyUnit: '米',
    plannedRollCount: 4,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'PARTIAL_HANDOVER',
    taskId: 'TASK-PRINT-000720',
    taskNo: 'TASK-PRINT-000720',
    createdAt: '2026-03-27 11:30:00',
    updatedAt: '2026-03-28 17:30:00',
    handoverOrderId: waitReviewSeed.handoverOrderId,
    remark: '指定接收方已确认部分收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
    printOrderNo: 'PH-20260329-009',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-079'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-061',
    patternVersion: 'V3',
    materialSku: 'FAB-PRINT-061',
    materialColor: '雾蓝底白花',
    plannedQty: 1010,
    qtyUnit: '米',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'TRANSFERRING',
    taskId: 'TASK-PRINT-000724',
    taskNo: 'TASK-PRINT-000724',
    createdAt: '2026-03-28 08:40:00',
    updatedAt: '2026-03-29 14:10:00',
    remark: '打印已完成，当前正在转印',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.HANDOVER_DIFFERENCE,
    printOrderNo: 'PH-20260329-010',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-080'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-066',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-066',
    materialColor: '杏底棕花',
    plannedQty: 740,
    qtyUnit: '米',
    plannedRollCount: 6,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'HANDOVER_DIFFERENCE',
    taskId: 'TASK-PRINT-000712',
    taskNo: 'TASK-PRINT-000712',
    createdAt: '2026-03-28 08:50:00',
    updatedAt: '2026-03-29 14:20:00',
    handoverOrderId: rejectedSeed.handoverOrderId,
    remark: '指定接收方收货存在差异，需补送或复核',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
    printOrderNo: 'PH-20260329-008',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-078'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-052',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-052',
    materialColor: '奶油白底豆沙花',
    plannedQty: completedTask?.qty ?? 624,
    qtyUnit: '米',
    plannedRollCount: 5,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
    status: 'FULL_HANDOVER',
    taskId: 'TASK-PRINT-000721',
    taskNo: 'TASK-PRINT-000721',
    createdAt: '2026-03-28 08:00:00',
    updatedAt: '2026-03-29 17:10:00',
    handoverOrderId: completedSeed.handoverOrderId,
    remark: '指定接收方已全部确认收货',
  })

  addSeedWorkOrder({
    printOrderId: PRINT_WORK_ORDER_IDS.WAIT_PRINT_EXTRA,
    printOrderNo: 'PH-20260329-011',
    sourceType: 'PRODUCTION_ORDER',
    productionOrderIds: ['PO-20260329-081'],
    isFirstOrder: false,
    patternNo: 'PAT-HT-071',
    patternVersion: 'V2',
    materialSku: 'FAB-PRINT-071',
    materialColor: '象牙白底蓝灰花',
    plannedQty: 910,
    qtyUnit: '米',
    plannedRollCount: 7,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
    productionOrderIds: ['PO-20260329-082'],
    isFirstOrder: true,
    patternNo: 'PAT-HT-073',
    patternVersion: 'V1',
    materialSku: 'FAB-PRINT-073',
    materialColor: '墨绿底白花',
    plannedQty: 960,
    qtyUnit: '米',
    plannedRollCount: 8,
    printFactoryId: TEST_FACTORY_ID,
    printFactoryName: TEST_FACTORY_NAME,
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
      remark: '转印结束，已完成部分收货确认',
    },
  ])

  setNodeRecords(PRINT_WORK_ORDER_IDS.TRANSFERRING, [
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'COLOR_TEST'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000724',
      nodeCode: 'COLOR_TEST',
      nodeName: PRINT_NODE_LABEL.COLOR_TEST,
      operatorUserId: 'USR-PRINT-15',
      operatorName: '梁可',
      startedAt: '2026-03-28 09:30:00',
      finishedAt: '2026-03-28 10:10:00',
      qtyUnit: '米',
      remark: '花型测试通过',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'PRINT'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000724',
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
      qtyUnit: '米',
      remark: '打印完成，转入转印',
    },
    {
      nodeRecordId: createNodeRecordId(PRINT_WORK_ORDER_IDS.TRANSFERRING, 'TRANSFER'),
      printOrderId: PRINT_WORK_ORDER_IDS.TRANSFERRING,
      taskId: 'TASK-PRINT-000724',
      nodeCode: 'TRANSFER',
      nodeName: PRINT_NODE_LABEL.TRANSFER,
      operatorUserId: 'USR-PRINT-17',
      operatorName: '沈楠',
      startedAt: '2026-03-29 13:20:00',
      usedMaterialQty: 1016,
      actualCompletedQty: 620,
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
      qtyUnit: '米',
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
    handoverRecordIds: records.map((record) => record.handoverRecordId || record.recordId),
    receiverName: waitReviewOrder.targetTransferWarehouseName,
    submittedQty: head.submittedQtyTotal ?? 0,
    receivedQty: head.writtenBackQtyTotal ?? 0,
    diffQty: (head.writtenBackQtyTotal ?? 0) - (head.submittedQtyTotal ?? 0),
    receivedRollCount: 4,
    receivedLength: 126,
    lengthUnit: '米',
    reviewStatus: 'PARTIAL_HANDOVER',
    remark: '指定接收方已确认部分收货',
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
    handoverRecordIds: completedRecords.map((record) => record.handoverRecordId || record.recordId),
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
    remark: '指定接收方已全部确认收货',
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
    handoverRecordIds: rejectedRecords.map((record) => record.handoverRecordId || record.recordId),
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

type PrintingBusinessSeedProgress = {
    calculationMode: PrintingUsageBasis['calculationMode']
    actualReceivedQty: number
    actualReceivedRollCount: number
    actualUsedQty: number
    actualUsedRollCount: number
    completedQty: number
    completedRollCount: number
    handedOverQty: number
    receivedQty: number
    receiverName: string
    inputReceivedAt?: string
    completedAt?: string
    deliveryAt?: string
    manualCompletion?: { by: string; at: string }

}

function initializePrintingBusinessView(order: MutablePrintWorkOrder, progress: Partial<PrintingBusinessSeedProgress> = {}, index = -1, preserveLegacyRecords = false): void {
  if (order.businessView) return
  const config: PrintingBusinessSeedProgress = {
    calculationMode: 'DIRECT', actualReceivedQty: 0, actualReceivedRollCount: 0,
    actualUsedQty: 0, actualUsedRollCount: 0, completedQty: 0, completedRollCount: 0,
    handedOverQty: 0, receivedQty: 0, receiverName: '未指定', ...progress,
  }
  const source = order.sourceSnapshot
  const productionId = source?.productionOrderId || order.sourceProductionOrderId
  const sourceOrder = productionOrders.find((item) => item.productionOrderId === productionId)
  const candidateSnapshot = sourceOrder?.techPackSnapshot
  const snapshot = !source?.techPackVersionId || candidateSnapshot?.sourceTechPackVersionId === source.techPackVersionId ? candidateSnapshot : undefined
  const productionNo = source?.productionOrderNo || order.sourceProductionOrderNo || ''
  const demandSource: PrintingDemandSource = order.sourceType === 'STOCK'
    ? { type: 'STOCK', sourceNo: order.stockMaterialId || source?.stockMaterialId || order.printOrderNo, sourceLabel: `备货物料 ${order.stockMaterialId || source?.stockMaterialId || order.stockMaterialName || order.materialSku}` }
    : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
      ? { type: 'SUPPLEMENT', sourceNo: source?.supplementRecordNo || source?.supplementRecordId || '', sourceLabel: `补料单 ${source?.supplementRecordNo || source?.supplementRecordId || '来源待补齐'}`, supplementOrderNo: source?.supplementRecordNo, productionOrderNo: productionNo, originalProductionOrderNo: productionNo }
      : { type: 'PRODUCTION', sourceNo: productionNo, sourceLabel: `生产单 ${productionNo}`, productionOrderNo: productionNo, demandNo: sourceOrder?.demandSnapshot.demandId }
  const imageManifest = getPrintingOrderImageManifest(order.printOrderId)
  const usableImage = (url?: string) => url && !/data:image\/svg|placeholder/i.test(url) ? url : ''
  const spu = sourceOrder?.demandSnapshot.spuCode || order.formalProductionOrderSnapshot?.spuCode || ''
  const productName = sourceOrder?.demandSnapshot.spuName || order.formalProductionOrderSnapshot?.spuName || '备货物料（未绑定款式）'
  const product: PrintingProductIdentity = { spu, productName, imageUrl: [...(snapshot?.imageSnapshot.productImages || []), ...(snapshot?.imageSnapshot.styleImages || [])].map(usableImage).find(Boolean) || imageManifest?.product || '', imageAlt: `${spu || order.stockMaterialId || order.materialSku} ${productName}对应图片` }
  const sourceBomId = source?.bomItemId || order.formalProductionOrderSnapshot?.materialItems?.[0]?.sourceBomItemId
  const bom = sourceBomId ? snapshot?.bomItems.find((item) => item.id === sourceBomId) : snapshot ? selectPrimaryProductionMaterialBomItem(snapshot.bomItems) : undefined
  const frontDesign = snapshot?.patternDesigns.find((design) => design.id === order.patternNo)
    const plannedQty = order.plannedQty
    const objectType = normalizePrintMaterialObjectType(order.objectType)
    const qtyUnit = order.qtyUnit || normalizePrintQuantityUnit(objectType, undefined)
    const usage: PrintingUsageBasis = config.calculationMode === 'DIRECT'
      ? { calculationMode: 'DIRECT', demandBaseQty: plannedQty, demandBaseUnit: qtyUnit, standardUnitUsage: null, orderUnitUsage: null, usageUnit: '直接数量', formulaLabel: `需求直接指定 ${plannedQty.toFixed(2)} ${qtyUnit}` }
      : { calculationMode: 'BY_USAGE', demandBaseQty: 100, demandBaseUnit: '件', standardUnitUsage: roundPrintingValue(plannedQty / 100, 4), orderUnitUsage: roundPrintingValue(plannedQty / 100, 4), usageUnit: `${qtyUnit}/件`, formulaLabel: `100 件 × ${roundPrintingValue(plannedQty / 100, 4).toFixed(4)} ${qtyUnit}/件` }
    const materialSpu = bom?.materialCode || bom?.id || order.stockMaterialId || order.materialSku
    const inputSku = order.materialSku
    const outputSku = `${materialSpu}-${order.patternNo.toLowerCase()}`
    const isFabricLike = objectType === '面料' || objectType === '花边' || objectType === '织带'
    const matchesBomMaterial = bom && (!order.formalProductionOrderSnapshot || order.formalProductionOrderSnapshot.materialId === (bom.materialCode || bom.id))
    const materialImage = (matchesBomMaterial ? usableImage(bom.materialImageUrl) || resolveProductionMaterialImageUrl({ materialSku: bom.materialCode || bom.id, materialName: bom.name, materialColor: order.materialColor }) : '') || imageManifest?.input || ''
    const outputImage = imageManifest?.output || ''
    const plannedInput: PrintingPlannedInput = {
      objectType, materialName: `${order.materialSku} 待印${objectType}`, spu: materialSpu, sku: inputSku,
      imageUrl: materialImage, imageAlt: `${order.materialSku} ${objectType}实拍图`, gsm: isFabricLike && index >= 0 ? 120 + index * 20 : 0, widthCm: isFabricLike && index >= 0 ? 152 + index : 0,
      plannedQty, qtyUnit, supplySource: `${demandSource.sourceLabel}供料`, sourceWarehouseName: index >= 0 ? 'HILON 普通仓' : '待指定供料仓',
      sourceWarehouseStockQty: index >= 0 ? plannedQty : 0, pendingWarehouseStockQty: 0, whiteStockQty: index >= 0 ? Math.max(plannedQty * 3, 0) : 0,
      currentStockQty: index >= 0 && config.actualReceivedQty <= 0 ? plannedQty : 0, pendingPrintQty: Math.max(plannedQty - config.actualUsedQty, 0),
    }
    const output: PrintingOutput = {
      objectType, materialName: `${order.materialSku} 印花成品${objectType}`, spu: materialSpu, sku: outputSku,
      imageUrl: outputImage, imageAlt: `${order.materialSku} 印花成品${objectType}实拍图`,
      gsm: plannedInput.gsm, widthCm: plannedInput.widthCm, plannedQty, completedQty: config.completedQty,
      completedRollCount: config.completedRollCount, qtyUnit,
    }
    const receivedAll = config.receivedQty >= config.completedQty && config.completedQty > 0
    order.businessView = {
      salesType: sourceOrder?.demandSnapshot.saleType || (order.sourceType === 'STOCK' ? '备货' : '生产'),
      creationMethod: order.sourceType === 'STOCK' ? '备货手动创建' : order.sourceType === 'CUT_PIECE_SUPPLEMENT' ? '裁片补料生成' : '生产单自动生成',
      materialType: objectType,
      historicalSupplement: order.sourceType === 'CUT_PIECE_SUPPLEMENT',
      legacyProgressHint: PRINT_WORK_ORDER_STATUS_LABEL[order.status],
      demandSource: demandSource,
      product: product,
      usage,
      plannedInput,
      actualInput: {
        actualSku: config.actualReceivedQty > 0 ? inputSku : '', receivedQty: config.actualReceivedQty,
        receivedRollCount: config.actualReceivedRollCount, usedQty: config.actualUsedQty, usedRollCount: config.actualUsedRollCount,
        receiverName: config.actualReceivedQty > 0 ? order.printFactoryName : '未接收', receivedAt: config.inputReceivedAt,
      },
      requirement: {
        craftName: '印花', type: index === 4 ? '热转印' : '数码印花', shade: index === 4 ? '跟图' : '标准',
        temperature: index === 4 ? '200℃' : '按工艺卡', printSide: index === 0 ? '双面' : '单面',
        frontPattern: { patternNo: order.patternNo, patternVersion: order.patternVersion, patternName: '正面花型', imageUrl: usableImage(frontDesign?.imageUrl) || imageManifest?.frontPattern || '', imageAlt: `${order.patternNo} 正面花型图` },
        ...(index === 0 ? { insidePattern: { patternNo: `${order.patternNo}-B`, patternVersion: order.patternVersion, patternName: '里面花型', imageUrl: imageManifest?.insidePattern || '', imageAlt: `${order.patternNo} 里面花型图` } } : {}),
      },
      output,
      handover: {
        handedOverQty: config.handedOverQty, receivedQty: config.receivedQty,
        diffQty: roundPrintingValue(config.handedOverQty - config.receivedQty, 2), objectionQty: 0,
        handoverNo: order.handoverOrderNo, receiverName: config.receiverName,
        handedOverAt: config.deliveryAt, receivedAt: receivedAll ? config.manualCompletion?.at : undefined,
        differenceReason: config.handedOverQty > config.receivedQty ? '仍有待接收数量' : undefined,
      },
      printerNo: index >= 2 ? `PR-${String(index + 1).padStart(2, '0')}` : '未分配',
      transferCompletedQty: config.completedQty,
      pendingWritebackQty: Math.max(config.handedOverQty - config.receivedQty, 0),
      historicalLossQty: Math.max(roundPrintingValue(config.actualUsedQty - config.completedQty, 2), 0),
      inputReceivedAt: config.inputReceivedAt,
      completedAt: config.completedAt,
      deliveryAt: config.deliveryAt,
      remark: order.remark || '',
      inputChanges: [],
      barcodes: makePrintingBarcodes({ printOrderNo: order.printOrderNo, outputSku, completedQty: config.completedQty, completedRollCount: config.completedRollCount, plannedRollCount: order.plannedRollCount || 1, gsm: output.gsm, widthCm: output.widthCm, qtyUnit: output.qtyUnit, objectType: output.objectType, handedOver: config.handedOverQty > 0, received: receivedAll }),
      documentHistory: [],
      operationLogs: [{ logId: `LOG-${order.printOrderNo}-CREATE`, action: '创建印花加工单', operatorName: '生产计划员', operatedAt: order.createdAt, remark: `${PRINTING_DEMAND_SOURCE_LABEL[demandSource.type]}需求创建` }],
      printingDocumentsNeedReprint: false,
    }
    if (config.manualCompletion) {
      order.manuallyCompletedAt = config.manualCompletion.at
      order.manuallyCompletedBy = config.manualCompletion.by
      order.status = 'COMPLETED'
    }
    if (!preserveLegacyRecords) syncPrintingBusinessReview(order)
}

function seedPrintingBusinessPageViews(): void {
  const seedConfigs: Array<PrintingBusinessSeedProgress & { orderId: string }> = [
    {
      orderId: PRINT_WORK_ORDER_IDS.WAIT_ARTWORK,
      calculationMode: 'DIRECT',
      actualReceivedQty: 0, actualReceivedRollCount: 0, actualUsedQty: 0, actualUsedRollCount: 0,
      completedQty: 0, completedRollCount: 0, handedOverQty: 0, receivedQty: 0, receiverName: '未指定',
    },
    {
      orderId: PRINT_WORK_ORDER_IDS.WAIT_COLOR_TEST,
      calculationMode: 'BY_USAGE',
      actualReceivedQty: 0, actualReceivedRollCount: 0, actualUsedQty: 0, actualUsedRollCount: 0,
      completedQty: 0, completedRollCount: 0, handedOverQty: 0, receivedQty: 0, receiverName: '未指定',
    },
    {
      orderId: PRINT_WORK_ORDER_IDS.PRINTING,
      calculationMode: 'DIRECT',
      actualReceivedQty: 872, actualReceivedRollCount: 8, actualUsedQty: 420, actualUsedRollCount: 4,
      completedQty: 0, completedRollCount: 0, handedOverQty: 0, receivedQty: 0, receiverName: '', inputReceivedAt: '2026-03-28 12:50:00',
    },
    {
      orderId: PRINT_WORK_ORDER_IDS.WAIT_HANDOVER,
      calculationMode: 'BY_USAGE',
      actualReceivedQty: 832, actualReceivedRollCount: 7, actualUsedQty: 832, actualUsedRollCount: 7,
      completedQty: 796, completedRollCount: 7, handedOverQty: 0, receivedQty: 0, receiverName: '', inputReceivedAt: '2026-03-28 10:50:00', completedAt: '2026-03-28 15:10:00',
    },
    {
      orderId: PRINT_WORK_ORDER_IDS.HANDOVER_WAIT_RECEIVE,
      calculationMode: 'BY_USAGE',
      actualReceivedQty: 1060, actualReceivedRollCount: 9, actualUsedQty: 1060, actualUsedRollCount: 9,
      completedQty: 1044, completedRollCount: 9, handedOverQty: 1044, receivedQty: 0, receiverName: '', inputReceivedAt: '2026-03-27 15:00:00', completedAt: '2026-03-28 10:10:00', deliveryAt: '2026-03-28 18:20:00',
    },
    {
      orderId: PRINT_WORK_ORDER_IDS.FULL_HANDOVER,
      calculationMode: 'BY_USAGE',
      actualReceivedQty: 636, actualReceivedRollCount: 5, actualUsedQty: 636, actualUsedRollCount: 5,
      completedQty: 624, completedRollCount: 5, handedOverQty: 624, receivedQty: 624, receiverName: '', inputReceivedAt: '2026-03-28 08:10:00', completedAt: '2026-03-29 10:30:00', deliveryAt: '2026-03-29 14:10:00',
      manualCompletion: { by: '印花主管', at: '2026-03-29 17:10:00' },
    },
  ]
  seedConfigs.forEach((config, index) => {
    const order = workOrderStore.get(config.orderId)
    if (order) initializePrintingBusinessView(order, { ...config, receiverName: order.receiverName }, index)
  })

  // 原印花节点与交接账仍有效：用其明确数量接入当前页，不伪造缺失的投入事实。
  workOrderStore.forEach((order) => {
    if (order.businessView) return
    const nodes = nodeRecordStore.get(order.printOrderId) || []
    const print = nodes.find((node) => node.nodeCode === 'PRINT')
    const transfer = nodes.find((node) => node.nodeCode === 'TRANSFER')
    const review = reviewRecordStore.get(order.printOrderId)
    const actualReceivedQty = print?.inputQty
    const completedQty = transfer ? transfer.actualCompletedQty : print?.outputQty
    initializePrintingBusinessView(order, {
      actualReceivedQty: actualReceivedQty ?? 0,
      actualUsedQty: transfer?.usedMaterialQty ?? 0,
      completedQty: completedQty ?? 0,
      completedRollCount: 0,
      handedOverQty: review?.submittedQty ?? 0,
      receivedQty: review?.receivedQty ?? 0,
      receiverName: review?.receiverName || order.receiverName,
      completedAt: transfer?.finishedAt || print?.finishedAt,
    }, -1, true)
    const view = order.businessView!
    view.historicalInputQuantityUnknown = actualReceivedQty === undefined
    view.historicalRollQuantitiesUnknown = true
    view.actualInput.receiverName = actualReceivedQty === undefined ? '历史未记录' : print?.operatorName || '历史未记录'
    view.actualInput.receivedAt = undefined
    view.handover.receivedAt = review?.reviewedAt
    view.handover.differenceReason = review?.rejectReason || review?.remark
    view.printerNo = print?.printerNo || '历史未记录'
    view.barcodes = [] // 旧账无逐卷身份，不按计划卷数补造条码。
    view.remark = `${view.remark}${view.historicalInputQuantityUnknown ? '；历史累计投入未记录，补录前不能填报新的加工完成。' : ''}`
  })

  if (printingBusinessBaseline.size === 0) {
    Array.from(workOrderStore.keys()).forEach((orderId) => {
      const order = workOrderStore.get(orderId)
      if (order) printingBusinessBaseline.set(orderId, cloneWorkOrder(order))
      printingBusinessNodeBaseline.set(orderId, structuredClone(nodeRecordStore.get(orderId) ?? []))
      printingBusinessReviewBaseline.set(orderId, structuredClone(reviewRecordStore.get(orderId) ?? null))
      if (order) {
        const task = getPrintingTaskById(order.taskId)
        if (task) printingBusinessTaskBaseline.set(order.taskId, structuredClone(task))
      }
    })
  }
}

function seedDomain(): void {
  if (printPersistenceReadError) throw new Error(printPersistenceReadError)
  if (seeded) return
  seeded = true
  seedWorkOrders()
  normalizeSeedWorkOrderSources()
  seedNodeRecords()
  seedReviewRecords()
  syncSeedQuantityUnitsFromWorkOrders()
  seedPrintingBusinessPageViews()
  for (const order of productionOrders) {
    for (const definition of getRestoredFormalProcessDefinitions(order, 'PRINT')) {
      registerFormalProductionOrderPrintWorkOrder(definition)
    }
  }
  restoreFormalPrintExecution()
}

function syncOrderFromReview(order: MutablePrintWorkOrder, review?: MutableReviewRecord): boolean {
  if (!review) return false

  if (review.reviewStatus === 'FULL_HANDOVER') {
    // 接收完成只形成“全部交出/已收齐”事实；只有人工完单动作才能进入 COMPLETED。
    order.status = order.manuallyCompletedAt ? 'COMPLETED' : 'FULL_HANDOVER'
  } else if (review.reviewStatus === 'HANDOVER_DIFFERENCE') {
    order.status = review.reviewedAt && review.rejectReason ? 'REJECTED' : 'WAIT_REVIEW'
  } else if (review.reviewStatus === 'PARTIAL_HANDOVER') {
    order.status = 'WAIT_REVIEW'
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
    current.handoverRecordIds = records.map((record) => record.handoverRecordId || record.recordId)
    current.receiverName = order.targetTransferWarehouseName
    current.submittedQty = submittedQty
    if (current.reviewStatus === 'WAIT_RECEIVE') {
      current.receivedQty = receivedQty
      current.diffQty = diffQty
      current.receivedRollCount = receivedQty > 0 ? order.plannedRollCount : undefined
      current.receivedLength = receivedQty > 0 ? Math.max(receivedQty, 0) : undefined
      current.lengthUnit = getQtyUnit(order)
      current.reviewStatus = reviewStatus
      current.remark = current.remark || (reviewStatus === 'WAIT_RECEIVE' ? '交出记录已生成，等待接收方确认收货' : '接收方已确认收货')
    }
    return
  }

  reviewRecordStore.set(order.printOrderId, {
    reviewRecordId: `PRV-${order.printOrderId}`,
    printOrderId: order.printOrderId,
    handoverOrderId: head.handoverOrderId || head.handoverId,
    handoverRecordIds: records.map((record) => record.handoverRecordId || record.recordId),
    receiverName: order.targetTransferWarehouseName,
    submittedQty,
    receivedQty,
    diffQty,
    receivedRollCount: receivedQty > 0 ? order.plannedRollCount : undefined,
    receivedLength: receivedQty > 0 ? Math.max(receivedQty, 0) : undefined,
    lengthUnit: getQtyUnit(order),
    reviewStatus,
    remark: reviewStatus === 'WAIT_RECEIVE' ? '交出记录已生成，等待接收方确认收货' : '接收方已确认收货',
  })
}

function syncDerivedWorkflow(): void {
  seedDomain()

  // One current handover read per projection, instead of copying the entire wool
  // store once for every print order. No snapshot survives this synchronous call.
  const handoutHeads = listPdaHandoverHeads().filter(head => head.headType === 'HANDOUT')
  for (const order of workOrderStore.values()) {
    const head =
      (order.handoverOrderId
        ? handoutHeads.find(head => (head.handoverOrderId || head.handoverId) === order.handoverOrderId)
        : undefined)
      || handoutHeads.find(head => head.taskId === order.taskId)
    if (head) {
      order.handoverOrderId = head.handoverOrderId || head.handoverId
      order.handoverOrderNo = head.handoverOrderNo
    }

    if (head && order.businessView?.barcodes.some(barcode => barcode.handoverRecordId)) {
      const view = order.businessView
      const records = getPdaHandoverRecordsByHead(head.handoverId)
        .filter(record => record.handoverRecordStatus !== 'VOIDED')
      const linkedIds = new Set(view.barcodes.map(barcode => barcode.handoverRecordId).filter(Boolean))
      const linked = records.filter(record => linkedIds.has(record.handoverRecordId || record.recordId))
      view.handover.receivedQty = roundPrintingValue(linked.reduce((sum, record) => sum + (record.receiverWrittenQty || 0), 0), 2)
      view.handover.diffQty = roundPrintingValue(view.handover.handedOverQty - view.handover.receivedQty, 2)
      view.pendingWritebackQty = Math.max(0, view.handover.diffQty)
      const lastReceived = linked.filter(record => record.receiverWrittenAt).sort((a, b) => (a.receiverWrittenAt || '').localeCompare(b.receiverWrittenAt || '')).at(-1)
      if (lastReceived) {
        view.handover.receivedAt = lastReceived.receiverWrittenAt
        view.handover.receivedBy = lastReceived.receiverWrittenBy || view.handover.receivedBy
      }
      syncPrintingBusinessReview(order)
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
  return normalizePrintQuantityUnit(normalizePrintMaterialObjectType(order.objectType), order.qtyUnit)
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
  return listGeneratedPrintWorkOrders().map((order) => {
    ensurePrintAcceptanceFact(order)
    return cloneWorkOrder(order)
  })
}

export function getPrintWorkOrderById(printOrderId: string): PrintWorkOrder | undefined {
  syncDerivedWorkflow()
  const canonical = workOrderStore.get(printOrderId)
  if (canonical) ensurePrintAcceptanceFact(canonical)
  const order = listGeneratedPrintWorkOrders().find((item) => item.printOrderId === printOrderId)
  return order && canonical
    ? cloneWorkOrder({
        ...order,
        printOrderId: canonical.printOrderId,
        printOrderNo: canonical.printOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
        acceptanceStatus: canonical.acceptanceStatus,
        acceptedAt: canonical.acceptedAt,
        acceptedBy: canonical.acceptedBy,
        rejectedAt: canonical.rejectedAt,
        rejectedBy: canonical.rejectedBy,
        rejectionReason: canonical.rejectionReason,
      })
    : undefined
}

export function getPrintWorkOrderByTaskId(taskId: string): PrintWorkOrder | undefined {
  syncDerivedWorkflow()
  const canonical = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!canonical) return undefined
  ensurePrintAcceptanceFact(canonical)
  const order = listGeneratedPrintWorkOrders().find((item) => item.printOrderId === canonical.printOrderId)
  return order
    ? cloneWorkOrder({
        ...order,
        printOrderId: canonical.printOrderId,
        printOrderNo: canonical.printOrderNo,
        taskId: canonical.taskId,
        taskNo: canonical.taskNo,
        acceptanceStatus: canonical.acceptanceStatus,
        acceptedAt: canonical.acceptedAt,
        acceptedBy: canonical.acceptedBy,
        rejectedAt: canonical.rejectedAt,
        rejectedBy: canonical.rejectedBy,
        rejectionReason: canonical.rejectionReason,
      })
    : undefined
}

function ensurePrintAcceptanceFact(order: MutablePrintWorkOrder): void {
  if (order.acceptanceStatus) return
  const hasStarted = (nodeRecordStore.get(order.printOrderId) ?? []).some((node) => Boolean(node.startedAt))
  const hasHistoricalExecution = hasStarted || order.status !== 'WAIT_ARTWORK'
  order.acceptanceStatus = hasHistoricalExecution ? 'ACCEPTED' : 'PENDING'
  order.acceptedAt = hasHistoricalExecution ? order.createdAt : undefined
  order.acceptedBy = hasHistoricalExecution ? order.printFactoryName : undefined
}

function derivePrintMobileStatus(order: PrintWorkOrder): PdaGenericTaskMock['status'] {
  if (order.status === 'REJECTED' || order.status === 'HANDOVER_DIFFERENCE') return 'BLOCKED'
  if (order.status === 'COMPLETED') return 'DONE'
  const hasStarted = (nodeRecordStore.get(order.printOrderId) ?? []).some((node) => Boolean(node.startedAt))
  return hasStarted ? 'IN_PROGRESS' : 'NOT_STARTED'
}

function derivePrintMobileOrigin(order: PrintWorkOrder, status: PdaGenericTaskMock['status']): PdaGenericTaskMock['mockOrigin'] {
  if (order.acceptanceStatus === 'REJECTED') return 'DIRECT_REJECTED'
  if (order.acceptanceStatus !== 'ACCEPTED') return 'DIRECT_PENDING'
  if (status === 'DONE') return 'EXEC_DONE'
  if (status === 'BLOCKED') return 'EXEC_BLOCKED'
  if (status === 'IN_PROGRESS') return 'EXEC_IN_PROGRESS'
  if (status === 'CANCELLED') return 'EXEC_CANCELLED'
  return 'EXEC_NOT_STARTED'
}

export function listPrintMobileExecutionTasks(): PdaGenericTaskMock[] {
  syncDerivedWorkflow()
  return Array.from(workOrderStore.values()).flatMap((order) => {
    ensurePrintAcceptanceFact(order)
    const baseTask = getPrintingTaskById(order.taskId) ?? buildFreshPrintMobileTask({
      taskId: order.taskId,
      taskNo: order.taskNo,
      sourceType: order.sourceType,
      sourceSnapshot: order.sourceSnapshot,
      productionOrderId: order.sourceProductionOrderId || order.productionOrderIds[0],
      productionOrderNo: order.sourceProductionOrderNo,
      stockMaterialId: order.stockMaterialId,
      stockMaterialName: order.stockMaterialName,
      spuCode: order.materialSku,
      spuName: order.materialColor || order.materialSku,
      requiredDeliveryDate: order.plannedFinishAt || '',
      factoryId: order.printFactoryId,
      factoryName: order.printFactoryName,
      qty: order.plannedQty,
      qtyDisplayUnit: order.qtyUnit,
      processName: '印花',
      createdAt: order.createdAt,
    })
    const nodes = nodeRecordStore.get(order.printOrderId) ?? []
    const startedAt = nodes.map((node) => node.startedAt).filter((value): value is string => Boolean(value)).sort()[0]
    const status = derivePrintMobileStatus(order)
    return [{
      ...structuredClone(baseTask),
      qty: order.plannedQty,
      qtyDisplayUnit: order.qtyUnit,
      assignedFactoryId: order.printFactoryId || undefined,
      assignedFactoryName: order.printFactoryName || undefined,
      assignmentStatus: order.printFactoryId ? 'ASSIGNED' : 'UNASSIGNED',
      acceptanceStatus: order.acceptanceStatus,
      mockOrigin: derivePrintMobileOrigin(order, status),
      acceptedAt: order.acceptedAt,
      acceptedBy: order.acceptedBy,
      status,
      startedAt,
      finishedAt: status === 'DONE' ? order.updatedAt : undefined,
      handoutStatus: ['HANDOVER_WAIT_RECEIVE', 'PARTIAL_HANDOVER', 'FULL_HANDOVER', 'COMPLETED'].includes(order.status) ? 'HANDED_OUT' : 'PENDING',
      defaultDocType: 'PREPARATION_ORDER',
      stage: 'PREP',
      stageCode: 'PREP',
      updatedAt: order.updatedAt,
    }]
  })
}

export function acceptPrintWorkOrderPdaTask(taskId: string, acceptedBy: string, acceptedAt = nowTimestamp()): PrintWorkOrder {
  return runPrintProcessMutation(() => {
  const order = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!order) throw new Error('印花加工单不存在')
  if (!order.printFactoryId) throw new Error('印花加工单尚未分配工厂')
  ensurePrintAcceptanceFact(order)
  if (order.acceptanceStatus === 'REJECTED') throw new Error('印花加工单已拒绝，不能接单')
  if (order.acceptanceStatus !== 'ACCEPTED') {
    order.acceptanceStatus = 'ACCEPTED'
    order.acceptedAt = acceptedAt
    order.acceptedBy = acceptedBy
    updateOrderTimestamp(order, acceptedAt)
  }
  return cloneWorkOrder(order)

  })
}

export function rejectPrintWorkOrderPdaTask(taskId: string, rejectedBy: string, reason: string, rejectedAt = nowTimestamp()): PrintWorkOrder {
  return runPrintProcessMutation(() => {
  const order = Array.from(workOrderStore.values()).find((item) => item.taskId === taskId)
  if (!order) throw new Error('印花加工单不存在')
  if (!order.printFactoryId) throw new Error('印花加工单尚未分配工厂')
  ensurePrintAcceptanceFact(order)
  if (order.acceptanceStatus === 'REJECTED') throw new Error('印花加工单已拒单，不可重复拒单')
  if ((nodeRecordStore.get(order.printOrderId) ?? []).some((node) => Boolean(node.startedAt))) {
    throw new Error('印花加工单已经开工，不能拒单')
  }
  order.acceptanceStatus = 'REJECTED'
  order.acceptedAt = undefined
  order.acceptedBy = undefined
  order.rejectedAt = rejectedAt
  order.rejectedBy = rejectedBy
  order.rejectionReason = reason
  order.printFactoryId = ''
  order.printFactoryName = '待分配工厂'
  updateOrderTimestamp(order, rejectedAt)
  return cloneWorkOrder(order)

  })
}

export function registerFormalProductionOrderPrintWorkOrder(input: FormalProductionOrderProcessSnapshot & {
  workOrderId: string
  workOrderNo: string
  processName: string
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceKey?: string
  plannedFinishAt?: string
  createdBy?: string
}): PrintWorkOrder {
  seedDomain()
  const sourceSnapshot: ProcessWorkOrderSourceSnapshot = input.sourceSnapshot || {
    sourceType: 'PRODUCTION_ORDER',
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    techPackVersionId: input.techPackVersionId,
    techPackVersionLabel: input.techPackVersionLabel,
    ...(input.processEntryId ? { processEntryId: input.processEntryId } : {}),
    ...(input.routeObjectKey ? { routeObjectKey: input.routeObjectKey } : {}),
    bomItemId: input.materialItems?.[0]?.sourceBomItemId || input.materialId,
    bomItemIds: input.materialItems?.map((item) => item.sourceBomItemId) || [input.materialId],
  }
  const existing = Array.from(workOrderStore.values())
    .find((order) => input.sourceKey
      ? order.sourceKey === input.sourceKey
      : order.sourceProductionOrderId === input.productionOrderId)
  if (existing) return cloneWorkOrder(existing)

  const materialItems = normalizeFormalProductionOrderMaterialItems(input)
  const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
  const printMaterialObjectType = resolvePrintMaterialObjectType(materialItems)

  const factoryId = input.factoryId || ''
  const factoryName = input.factoryName || '待分配工厂'
  registerPdaGenericProcessTask(buildFreshPrintMobileTask({
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    sourceType: sourceSnapshot.sourceType,
    sourceSnapshot: structuredClone(sourceSnapshot),
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    stockMaterialId: sourceSnapshot.stockMaterialId,
    stockMaterialName: sourceSnapshot.stockMaterialName,
    spuCode: input.spuCode,
    spuName: input.spuName,
    requiredDeliveryDate: input.requiredDeliveryDate,
    factoryId,
    factoryName,
    qty: input.plannedQty,
    qtyDisplayUnit: input.qtyUnit,
    processName: input.processName,
    createdAt: input.orderedAt,
  }))
  addSeedWorkOrder({
    printOrderId: input.workOrderId,
    printOrderNo: input.workOrderNo,
    sourceType: sourceSnapshot.sourceType,
    sourceSnapshot,
    sourceKey: input.sourceKey,
    sourceProductionOrderId: sourceSnapshot.productionOrderId,
    sourceProductionOrderNo: sourceSnapshot.productionOrderNo,
    productionOrderOrderedAt: input.orderedAt,
    stockMaterialId: sourceSnapshot.stockMaterialId,
    stockMaterialName: sourceSnapshot.stockMaterialName,
    productionOrderIds: sourceSnapshot.productionOrderId ? [sourceSnapshot.productionOrderId] : [],
    isFirstOrder: false,
    patternNo: sourceSnapshot.sourceType === 'STOCK' ? input.processName : input.techPackVersionId,
    patternVersion: sourceSnapshot.sourceType === 'STOCK' ? '备货创建' : input.techPackVersionLabel,
    materialSku: materialFields.materialId,
    materialColor: input.targetColor,
    objectType: printMaterialObjectType,
    plannedQty: input.plannedQty,
    qtyUnit: input.qtyUnit,
    plannedFinishAt: input.plannedFinishAt,
    qtyLabel: '计划数量',
    printFactoryId: factoryId,
    printFactoryName: factoryName,
    status: 'WAIT_ARTWORK',
    taskId: input.workOrderId,
    taskNo: input.workOrderNo,
    createdAt: input.orderedAt,
    updatedAt: input.orderedAt,
    remark: sourceSnapshot.sourceType === 'STOCK'
      ? `${input.processName}；按备货创建；创建人：${input.createdBy || '业务人员'}；计划完成：${input.plannedFinishAt || input.requiredDeliveryDate}`
      : sourceSnapshot.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? `${input.processName}；来源补料单 ${sourceSnapshot.supplementRecordNo}；原裁片单 ${sourceSnapshot.originalCutOrderNo}。`
        : `${input.processName}；来源正式生产单 ${input.productionOrderNo}；技术包 ${input.techPackVersionLabel}。`,
    formalProductionOrderSnapshot: sourceSnapshot.sourceType === 'STOCK' ? undefined : {
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo,
      orderedAt: input.orderedAt,
      techPackVersionId: input.techPackVersionId,
      techPackVersionLabel: input.techPackVersionLabel,
      ...(input.processEntryId ? { processEntryId: input.processEntryId } : {}),
      ...(input.routeObjectKey ? { routeObjectKey: input.routeObjectKey } : {}),
      materialId: materialFields.materialId,
      materialName: materialFields.materialName,
      materialItems,
      targetColor: input.targetColor,
      plannedQty: input.plannedQty,
      qtyUnit: input.qtyUnit,
      processCodes: [...input.processCodes],
      processName: input.processName,
      spuCode: input.spuCode,
      spuName: input.spuName,
      requiredDeliveryDate: input.requiredDeliveryDate,
    },
  })
  initializePrintingBusinessView(workOrderStore.get(input.workOrderId)!)
  if (sourceSnapshot.sourceType === 'PRODUCTION_ORDER') {
    const sourceOrder = productionOrders.find(order => order.productionOrderId === sourceSnapshot.productionOrderId)
    if (sourceOrder && !sourceOrder.processWorkOrderDefinitions?.some(item => item.workOrderId === input.workOrderId)) {
      sourceOrder.processWorkOrderDefinitions = [...(sourceOrder.processWorkOrderDefinitions || []), {
        processCode: 'PRINT', workOrderId: input.workOrderId, workOrderNo: input.workOrderNo,
        sourceKey: input.sourceKey, sourceSnapshot: structuredClone(sourceSnapshot),
      }]
    }
  }
  createdPrintOrderIds.add(input.workOrderId)
  return getPrintWorkOrderById(input.workOrderId)!
}

export function registerPrintProcessWorkOrderGenerationRegistrar(): void {
  registerProcessWorkOrderGenerationRegistrar({
    processCode: 'PRINT',
    findBySourceKey: (sourceKey) => {
      seedDomain()
      return Array.from(workOrderStore.values()).find((order) => order.sourceKey === sourceKey)?.printOrderId
    },
    issueIdentity: (orderedAt, reserved) => {
      seedDomain()
      const occupiedIds = new Set(Array.from(workOrderStore.values()).map((order) => order.printOrderId))
      const occupiedNos = new Set(Array.from(workOrderStore.values()).map((order) => order.printOrderNo))
      const datePart = orderedAt.replace(/\D/g, '').slice(0, 8) || '00000000'
      for (let sequence = 1; sequence <= 999999; sequence += 1) {
        const padded = String(sequence).padStart(6, '0')
        const workOrderId = `PWO-PRINT-AUTO-${padded}`
        const workOrderNo = `PH-${datePart}-${padded}`
        if (
          !occupiedIds.has(workOrderId)
          && !occupiedNos.has(workOrderNo)
          && !reserved.workOrderIds.has(workOrderId)
          && !reserved.workOrderNos.has(workOrderNo)
        ) return { workOrderId, workOrderNo }
      }
      throw new Error('印花加工单编号已耗尽')
    },
    prepare: (input) => {
      normalizeFormalProductionOrderMaterialItems(input)
      return {
        workOrderId: input.workOrderId,
        commit: () => { registerFormalProductionOrderPrintWorkOrder(input) },
        rollback: () => {
          workOrderStore.delete(input.workOrderId)
          createdPrintOrderIds.delete(input.workOrderId)
          const sourceOrder = productionOrders.find(order => order.productionOrderId === input.productionOrderId)
          if (sourceOrder?.processWorkOrderDefinitions) {
            sourceOrder.processWorkOrderDefinitions = sourceOrder.processWorkOrderDefinitions.filter(item => item.workOrderId !== input.workOrderId)
          }
          unregisterPdaGenericProcessTask(input.workOrderId)
        },
      }
    },
  })
}

export const PRINT_PRODUCTION_CHANGE_NOT_EXECUTED_STATUSES: readonly PrintWorkOrderStatus[] = [
  'WAIT_ARTWORK',
  'WAIT_COLOR_TEST',
  'WAIT_PRINT',
]

export interface PreparedPrintWorkOrderProductionChangeSync {
  workOrderId?: string
  outcome: 'NOT_FOUND' | 'UNCHANGED' | 'AUTO_SYNCED' | 'PROTECTED'
  before?: FormalProductionOrderProcessSnapshotRecord
  after?: FormalProductionOrderProcessSnapshotRecord
  impact?: ProcessWorkOrderChangeImpact
  commit: () => void
  rollback: () => void
}

function toPrintSnapshotRecord(snapshot: FormalProductionOrderProcessSnapshot): FormalProductionOrderProcessSnapshotRecord {
  const materialItems = normalizeFormalProductionOrderMaterialItems(snapshot)
  const materialFields = deriveFormalProductionOrderMaterialFields(materialItems)
  return {
    productionOrderId: snapshot.productionOrderId,
    productionOrderNo: snapshot.productionOrderNo,
    orderedAt: snapshot.orderedAt,
    techPackVersionId: snapshot.techPackVersionId,
    techPackVersionLabel: snapshot.techPackVersionLabel,
    ...(snapshot.processEntryId ? { processEntryId: snapshot.processEntryId } : {}),
    ...(snapshot.routeObjectKey ? { routeObjectKey: snapshot.routeObjectKey } : {}),
    materialId: materialFields.materialId,
    materialName: materialFields.materialName,
    materialItems,
    targetColor: snapshot.targetColor,
    plannedQty: snapshot.plannedQty,
    qtyUnit: snapshot.qtyUnit,
    processCodes: [...snapshot.processCodes],
    processName: snapshot.printProcessName || '印花',
    spuCode: snapshot.spuCode,
    spuName: snapshot.spuName,
    requiredDeliveryDate: snapshot.requiredDeliveryDate,
  }
}

function hasActualPrintExecution(order: MutablePrintWorkOrder): boolean {
  const hasNodeFact = (nodeRecordStore.get(order.printOrderId) ?? [])
    .some((node) => Boolean(node.startedAt || node.finishedAt))
  const review = reviewRecordStore.get(order.printOrderId)
  const hasReviewFact = Boolean(review?.reviewedAt || review?.handoverRecordIds?.length || review?.submittedQty)
  const hasHandoverFact = getPrintOrderHandoverRecords(order.printOrderId).length > 0
  const isExplicitlyNotExecuted = PRINT_PRODUCTION_CHANGE_NOT_EXECUTED_STATUSES.includes(order.status)
  return hasNodeFact || hasReviewFact || hasHandoverFact || !isExplicitlyNotExecuted
}

function toPrintPdaQtyUnit(qtyDisplayUnit: string): QtyUnit {
  return ['件', '片', '个', '套'].includes(qtyDisplayUnit)
    ? 'PIECE'
    : ['卷', '捆', '包', '打'].includes(qtyDisplayUnit)
      ? 'BUNDLE'
      : 'METER'
}

export function prepareFormalProductionOrderPrintWorkOrderSync(
  snapshot: FormalProductionOrderProcessSnapshot & { syncTargetWorkOrderId?: string },
  options: { changeRecordId: string; recordedAt: string },
): PreparedPrintWorkOrderProductionChangeSync {
  seedDomain()
  const candidates = Array.from(workOrderStore.values()).filter((order) => (
    order.sourceType === 'PRODUCTION_ORDER' && order.sourceProductionOrderId === snapshot.productionOrderId
  ))
  const syncTargetWorkOrderId = snapshot.syncTargetWorkOrderId?.trim()
  const current = syncTargetWorkOrderId
    ? candidates.find((order) => order.printOrderId === syncTargetWorkOrderId)
    : snapshot.routeObjectKey
      ? candidates.find((order) => order.formalProductionOrderSnapshot?.routeObjectKey === snapshot.routeObjectKey)
      : snapshot.processEntryId
        ? candidates.find((order) => order.formalProductionOrderSnapshot?.processEntryId === snapshot.processEntryId)
        : candidates.length === 1 ? candidates[0] : undefined
  if (!current) return { outcome: 'NOT_FOUND', commit: () => undefined, rollback: () => undefined }
  const before = current.formalProductionOrderSnapshot
  if (!before) throw new Error(`印花加工单 ${current.printOrderNo} 缺少正式生产单快照`)
  const after = toPrintSnapshotRecord(snapshot)
  const alreadyRecorded = [...(current.changeImpact ?? []), ...(current.autoSyncHistory ?? [])]
    .some((item) => item.changeRecordId === options.changeRecordId)
  if (alreadyRecorded || JSON.stringify(before) === JSON.stringify(after)) {
    return {
      workOrderId: current.printOrderId,
      outcome: 'UNCHANGED',
      before,
      after,
      commit: () => undefined,
      rollback: () => undefined,
    }
  }
  if (hasActualPrintExecution(current)) {
    const impact: ProcessWorkOrderChangeImpact = {
      changeRecordId: options.changeRecordId,
      before: structuredClone(before),
      after: structuredClone(after),
      reason: '已执行',
      recordedAt: options.recordedAt,
      suggestedAction: '保留原执行快照，由计划员按实际进度处理数量、物料和交期影响。',
    }
    const next = cloneWorkOrder(current)
    next.changeImpact = [...(current.changeImpact ?? []), structuredClone(impact)]
    let committed = false
    return {
      workOrderId: current.printOrderId,
      outcome: 'PROTECTED',
      before,
      after,
      impact,
      commit: () => {
        if (committed) return
        workOrderStore.set(current.printOrderId, cloneWorkOrder(next))
        committed = true
      },
      rollback: () => {
        if (!committed) return
        workOrderStore.set(current.printOrderId, cloneWorkOrder(current))
        committed = false
      },
    }
  }

  const next = cloneWorkOrder(current)
  next.sourceProductionOrderNo = snapshot.productionOrderNo
  next.productionOrderOrderedAt = snapshot.orderedAt
  next.productionOrderIds = [snapshot.productionOrderId]
  next.patternNo = snapshot.techPackVersionId
  next.patternVersion = snapshot.techPackVersionLabel
  next.materialSku = after.materialId
  next.materialColor = snapshot.targetColor
  next.objectType = resolvePrintMaterialObjectType(after.materialItems ?? [])
  next.plannedQty = snapshot.plannedQty
  next.qtyUnit = snapshot.qtyUnit
  if (snapshot.factoryId !== undefined) {
    const factoryChanged = next.printFactoryId !== snapshot.factoryId
    next.printFactoryId = snapshot.factoryId
    next.printFactoryName = snapshot.factoryName || snapshot.factoryId || '待分配工厂'
    if (factoryChanged) {
      next.acceptanceStatus = 'PENDING'
      next.acceptedAt = undefined
      next.acceptedBy = undefined
      next.rejectedAt = undefined
      next.rejectedBy = undefined
      next.rejectionReason = undefined
    }
  }
  next.formalProductionOrderSnapshot = structuredClone(after)
  next.updatedAt = options.recordedAt
  next.remark = `${after.processName}；来源正式生产单 ${snapshot.productionOrderNo}；技术包 ${snapshot.techPackVersionLabel}。`
  next.autoSyncHistory = [...(current.autoSyncHistory ?? []), {
    changeRecordId: options.changeRecordId,
    before: structuredClone(before),
    after: structuredClone(after),
    syncedAt: options.recordedAt,
  }]
  const currentTask = getPrintingTaskById(current.taskId)
  const nextTask = currentTask ? structuredClone(currentTask) : undefined
  const beforeTask = currentTask ? structuredClone(currentTask) : undefined
  if (nextTask) {
    nextTask.productionOrderId = snapshot.productionOrderId
    nextTask.productionOrderNo = snapshot.productionOrderNo
    nextTask.sourceProductionOrderId = snapshot.productionOrderId
    nextTask.spuCode = snapshot.spuCode
    nextTask.spuName = snapshot.spuName
    nextTask.requiredDeliveryDate = snapshot.requiredDeliveryDate
    nextTask.qty = snapshot.plannedQty
    nextTask.qtyUnit = toPrintPdaQtyUnit(snapshot.qtyUnit)
    nextTask.qtyDisplayUnit = snapshot.qtyUnit
    nextTask.processNameZh = after.processName
    nextTask.processBusinessName = after.processName
    nextTask.updatedAt = options.recordedAt
  }
  let committed = false
  return {
    workOrderId: current.printOrderId,
    outcome: 'AUTO_SYNCED',
    before,
    after,
    commit: () => {
      if (committed) return
      workOrderStore.set(current.printOrderId, cloneWorkOrder(next))
      if (nextTask) registerPdaGenericProcessTask(nextTask)
      committed = true
    },
    rollback: () => {
      if (!committed) return
      workOrderStore.set(current.printOrderId, cloneWorkOrder(current))
      if (beforeTask) registerPdaGenericProcessTask(structuredClone(beforeTask))
      committed = false
    },
  }
}

export function createPrintWorkOrderFromStock(input: {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  factoryId: string
  plannedQty: number
  qtyUnit: string
  plannedFinishAt: string
  processName: string
  createdBy?: string
}): { ok: boolean; message: string; order?: PrintWorkOrder } {
  const stockMaterialId = input.stockMaterialId.trim()
  const stockMaterial = getProcessWorkOrderStockMaterial(stockMaterialId)
  const stockMaterialName = input.stockMaterialName.trim()
  const materialSku = input.materialSku.trim()
  const qtyUnit = input.qtyUnit.trim()
  const plannedFinishAt = input.plannedFinishAt.trim()
  const processName = input.processName.trim()
  if (!stockMaterial) return { ok: false, message: '请选择仓库中存在的备货物料。' }
  if (stockMaterial.factoryId !== input.factoryId) return { ok: false, message: '所选备货物料不属于当前印花工厂。' }
  if (stockMaterial.processCode !== 'PRINT') return { ok: false, message: '所选备货物料不属于印花工序。' }
  if (stockMaterial.status !== '已入待加工仓' || stockMaterial.differenceQty !== 0) {
    return { ok: false, message: '所选备货物料尚未正常入待加工仓或存在待处理差异。' }
  }
  if (stockMaterial.stockMaterialName !== stockMaterialName || stockMaterial.materialSku !== materialSku) {
    return { ok: false, message: '备货物料名称或编码与仓库库存不一致，请重新选择。' }
  }
  if (stockMaterial.qtyUnit !== qtyUnit) return { ok: false, message: '计划数量单位必须与仓库库存单位一致。' }
  if (!Number.isFinite(input.plannedQty) || input.plannedQty <= 0 || !qtyUnit) {
    return { ok: false, message: '计划数量和单位必须有效。' }
  }
  if (input.plannedQty > stockMaterial.availableQty) {
    return { ok: false, message: `计划数量超过可用库存，当前最多可用 ${stockMaterial.availableQty} ${stockMaterial.qtyUnit}。` }
  }
  if (!isValidProcessWorkOrderPlannedFinishAt(plannedFinishAt)) return { ok: false, message: '请填写有效的计划完成时间。' }
  if (!processName) return { ok: false, message: '请填写印花工序。' }
  const factory = getFactoryMasterRecordById(input.factoryId)
  const canReceivePrint = factory?.status === 'active'
    && factory.eligibility.allowDispatch
    && factory.processAbilities.some((ability) =>
      ability.processCode === 'PRINT'
      && (ability.status ?? 'ACTIVE') === 'ACTIVE'
      && ability.canReceiveTask !== false,
    )
  if (!factory || !canReceivePrint) return { ok: false, message: '所选工厂不可派单或缺少正式有效的印花能力。' }

  const now = nowTimestamp()
  registerPrintProcessWorkOrderGenerationRegistrar()
  const result = ensureProcessWorkOrders({
    source: { sourceType: 'STOCK', stockMaterialId, stockMaterialName },
    processCodes: ['PRINT'],
    orderedAt: now,
    materialId: materialSku,
    materialName: stockMaterialName,
    materialItems: [{ sourceBomItemId: stockMaterialId, materialId: materialSku, materialName: stockMaterialName }],
    targetColor: '按印花工序执行',
    plannedQty: input.plannedQty,
    qtyUnit,
    printProcessName: processName,
    factoryId: factory.id,
    factoryName: factory.name,
    spuCode: '',
    spuName: stockMaterialName,
    requiredDeliveryDate: plannedFinishAt,
    plannedFinishAt,
    createdBy: input.createdBy,
  })
  return { ok: true, message: '', order: getPrintWorkOrderById(result.printWorkOrderId!) }
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
  return runPrintProcessMutation(() => {
  assertPrintExecutionPrerequisite(printOrderId)
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

  })
}

export function completeColorTest(
  printOrderId: string,
  input: { passed: boolean; operatorName?: string; remark?: string },
): PrintExecutionNodeRecord {
  return runPrintProcessMutation(() => {
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

  })
}

export function startPrinting(
  printOrderId: string,
  input: { printerNo: string; operatorName?: string },
): PrintExecutionNodeRecord {
  return runPrintProcessMutation(() => {
  assertPrintExecutionPrerequisite(printOrderId)
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

  })
}

export function completePrinting(
  printOrderId: string,
  input: { outputQty: number; wasteQty?: number; operatorName?: string },
): PrintExecutionNodeRecord {
  return runPrintProcessMutation(() => {
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

  })
}

export function startTransfer(printOrderId: string, operatorName = '印花工厂'): PrintExecutionNodeRecord {
  return runPrintProcessMutation(() => {
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

  })
}

export function completeTransfer(
  printOrderId: string,
  input: { usedMaterialQty: number; actualCompletedQty: number; operatorName?: string },
): PrintExecutionNodeRecord {
  return runPrintProcessMutation(() => {
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

  })
}

export function submitPrintHandover(
  printOrderId: string,
  input: { handoverQty?: number; handoverPerson?: string; handoverAt?: string; remark?: string } = {},
): { handoverOrderId?: string; recordIds: string[] } {
  return runPrintProcessMutation(() => {
  const order = getMutableWorkOrder(printOrderId)
  if (order.status !== 'WAIT_HANDOVER') {
    throw new Error(`当前状态为“${PRINT_WORK_ORDER_STATUS_LABEL[order.status]}”，不能重复交出。`)
  }
  const completedQty = getPrintCompletedQty(order)
  const submittedQty = listHandoverOrdersByTaskId(order.taskId).reduce((sum, head) => sum + (head.submittedQtyTotal ?? 0), 0)
  const requestedQty = Number.isFinite(input.handoverQty) ? Number(input.handoverQty) : completedQty
  const availableQty = Math.max(completedQty - submittedQty, 0)
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) throw new Error('交出数量必须大于 0。')
  if (requestedQty > availableQty + 0.000001) {
    throw new Error(`交出数量不能超过已完工未交出数量 ${availableQty} ${order.qtyUnit}。`)
  }
  const now = input.handoverAt || nowTimestamp()
  if (!order.handoverOrderId) {
    order.handoverOrderId = ensureStartedTaskHandover(order.taskId)
  }
  const result = ensureSeededHandoverRecord({
    taskId: order.taskId,
    submittedQty: requestedQty,
    submittedAt: now,
    objectType: order.objectType === '面料' ? 'FABRIC' : 'MATERIAL',
  })
  order.handoverOrderId = result.handoverOrderId || order.handoverOrderId
  order.status = 'HANDOVER_WAIT_RECEIVE'
  order.remark = input.remark?.trim() || order.remark
  updateOrderTimestamp(order, now)
  syncDerivedWorkflow()
  return result

  })
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
      status: order.manuallyCompletedAt ? 'DONE' : 'IN_PROGRESS',
      finishedAt: order.manuallyCompletedAt,
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
  return runPrintProcessMutation(() => {
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

  })
}

export function markPrintReceiptDifference(
  printOrderId: string,
  input: { receivedBy: string; receivedQty?: number; differenceReason: string; remark?: string },
): PrintReviewRecord {
  return runPrintProcessMutation(() => {
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

  })
}

export function approvePrintReview(
  printOrderId: string,
  input: { reviewedBy: string; remark?: string },
): PrintReviewRecord {
  return runPrintProcessMutation(() => {
  return confirmPrintReceipt(printOrderId, { receivedBy: input.reviewedBy, remark: input.remark })

  })
}

export function rejectPrintReview(
  printOrderId: string,
  input: { reviewedBy: string; rejectReason: string; remark?: string },
): PrintReviewRecord {
  return runPrintProcessMutation(() => {
  return markPrintReceiptDifference(printOrderId, {
    receivedBy: input.reviewedBy,
    differenceReason: input.rejectReason,
    remark: input.remark,
  })

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
    fullHandoverCount: orders.filter((order) => order.status === 'FULL_HANDOVER' || order.status === 'COMPLETED').length,
    handoverDifferenceCount: orders.filter((order) => order.status === 'HANDOVER_DIFFERENCE' || order.status === 'REJECTED').length,
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

function getMutablePrintingBusinessOrder(workOrderId: string): MutablePrintWorkOrder {
  syncDerivedWorkflow()
  const order = workOrderStore.get(workOrderId)
  if (!order?.businessView) {
    throw new Error('未找到印花加工单')
  }
  return order
}

function derivePrintingProcessingStatus(order: MutablePrintWorkOrder): PrintingProcessingStatus {
  if (order.status === 'CANCELLED') return 'CANCELLED'
  if (order.manuallyCompletedAt) return 'PROCESS_COMPLETED'
  if (order.businessView?.historicalInputQuantityUnknown) return 'PROCESSING'
  const view = order.businessView
  if (view && view.completedAt && view.output.completedQty > 0 && view.actualInput.receivedQty >= view.plannedInput.plannedQty && view.actualInput.usedQty >= view.actualInput.receivedQty) return 'PROCESS_COMPLETED'
  if (order.status === 'WAIT_ARTWORK') return 'WAIT_ASSIGN'
  if ((order.businessView?.actualInput.receivedQty ?? 0) <= 0) return 'WAIT_INPUT_RECEIPT'
  return 'PROCESSING'
}

function derivePrintingHandoverStatus(order: MutablePrintWorkOrder): PrintingHandoverStatus {
  const view = order.businessView
  return deriveProcessOrderHandoverStatus({
    completedQty: view?.output.completedQty ?? 0,
    handedOverQty: view?.handover.handedOverQty ?? 0,
  })
}

function derivePrintingReceiptStatus(order: MutablePrintWorkOrder): PrintingReceiptStatus {
  const view = order.businessView
  if (!view) return 'WAIT_SOURCE'
  const sourceAvailableQty = Math.max(
    view.plannedInput.sourceWarehouseStockQty,
    view.plannedInput.pendingWarehouseStockQty,
    view.plannedInput.whiteStockQty,
    view.actualInput.receivedQty,
  )
  return deriveProcessOrderReceiptStatus({
    sourceAvailableQty,
    expectedQty: view.plannedInput.plannedQty,
    receivedQty: view.actualInput.receivedQty,
    unresolvedDifferenceQty: Math.max(view.actualInput.receivedQty - view.plannedInput.plannedQty, 0),
  })
}

export function printingPendingReceiptQty(records: PdaHandoverRecord[], historicalQty: number): number {
  if (!records.length) return historicalQty
  return records.filter(record => record.handoverRecordStatus !== 'VOIDED').reduce((sum, record) => sum + (record.factoryDiffDecision === 'ACCEPT_DIFF' || record.objectionStatus === 'RESOLVED' ? 0 : Math.max((record.submittedQty ?? 0) - (record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0), 0)), 0)
}

export function isPrintablePrintingRoll(view: Pick<PrintingBusinessViewFacts, 'output' | 'barcodes'>, barcode: PrintingRollBarcode): boolean {
  return view.output.completedQty > 0 && barcode.lengthY > 0 && barcode.sku === view.output.sku
    && view.barcodes.reduce((sum, item) => sum + Math.max(item.lengthY, 0), 0) <= view.output.completedQty + 0.01
}

function projectPrintingBusinessRecord(order: MutablePrintWorkOrder): PrintingWorkOrderBusinessRecord {
  if (!order.businessView) throw new Error('印花加工单缺少当前页面视图事实')
  return {
    ...structuredClone(order.businessView),
    pendingWritebackQty: printingPendingReceiptQty(order.handoverOrderId ? getPdaHandoverRecordsByHead(order.handoverOrderId) : [], order.businessView.pendingWritebackQty),
    workOrderId: order.printOrderId,
    printOrderNo: order.printOrderNo,
    taskNo: order.taskNo,
    receiptStatus: derivePrintingReceiptStatus(order),
    processingStatus: derivePrintingProcessingStatus(order),
    handoverStatus: derivePrintingHandoverStatus(order),
    printFactoryId: order.printFactoryId,
    printFactoryName: order.printFactoryName,
    confirmedReceiptDifference: (() => {
      const records = order.handoverOrderId ? getPdaHandoverRecordsByHead(order.handoverOrderId) : []
      return records.length ? records.some(record => record.handoverRecordStatus !== 'VOIDED' && Boolean(record.receiverWrittenAt || record.warehouseWrittenAt || record.factoryDiffDecision) && Math.abs((record.submittedQty ?? 0) - (record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0)) > 0.01) : Boolean(order.businessView.handover.receivedAt && order.businessView.handover.diffQty)
    })(),
    receivingTargetId: order.targetTransferWarehouseId,
    receivingTargetName: order.receiverName,
    receivingTargetWarehouseName: order.targetTransferWarehouseName,
    orderedAt: order.createdAt,
    plannedFinishAt: order.plannedFinishAt,
    manuallyCompletedAt: order.manuallyCompletedAt,
    manuallyCompletedBy: order.manuallyCompletedBy,
  }
}

function addPrintingBusinessOperation(order: MutablePrintWorkOrder, action: string, operatorName: string, remark: string): void {
  const view = order.businessView!
  view.operationLogs.unshift({
    logId: `LOG-${order.printOrderNo}-${Date.now()}-${view.operationLogs.length + 1}`,
    action,
    operatorName,
    operatedAt: nowTimestamp(),
    remark,
  })
}

function syncPrintingBusinessReview(order: MutablePrintWorkOrder): void {
  const view = order.businessView
  if (!view || view.handover.handedOverQty <= 0) {
    reviewRecordStore.delete(order.printOrderId)
    return
  }

  const current = reviewRecordStore.get(order.printOrderId)
  const fullyReceived = view.output.completedQty > 0
    && view.handover.receivedQty >= view.output.completedQty
    && view.handover.handedOverQty >= view.output.completedQty
  const reviewStatus: PrintReviewStatus = view.handover.objectionQty > 0
    ? 'HANDOVER_DIFFERENCE'
    : view.handover.receivedQty <= 0
      ? 'WAIT_RECEIVE'
      : fullyReceived
        ? 'FULL_HANDOVER'
        : 'PARTIAL_HANDOVER'
  reviewRecordStore.set(order.printOrderId, {
    reviewRecordId: current?.reviewRecordId || `PRV-${order.printOrderId}`,
    printOrderId: order.printOrderId,
    handoverOrderId: order.handoverOrderId,
    handoverRecordIds: current?.handoverRecordIds ? [...current.handoverRecordIds] : [],
    receiverName: view.handover.receiverName,
    submittedQty: view.handover.handedOverQty,
    receivedQty: view.handover.receivedQty,
    diffQty: roundPrintingValue(view.handover.receivedQty - view.handover.handedOverQty, 2),
    receivedRollCount: view.barcodes.filter((barcode) => barcode.status === '已入库').length || undefined,
    receivedLength: view.handover.receivedQty || undefined,
    lengthUnit: view.output.qtyUnit,
    reviewStatus,
    reviewedBy: view.handover.receivedQty > 0 ? view.handover.receivedBy : undefined,
    reviewedAt: view.handover.receivedQty > 0 ? view.handover.receivedAt : undefined,
    rejectReason: view.handover.objectionQty > 0 ? view.handover.differenceReason || '存在接收异议' : undefined,
    remark: view.handover.differenceReason || (reviewStatus === 'WAIT_RECEIVE' ? '加工产出已交出，等待下游接收' : '下游接收事实已登记'),
  })
}

export function resetPrintingWorkOrderBusinessStore(): void {
  seedDomain()
  printingBusinessBaseline.forEach((order, orderId) => workOrderStore.set(orderId, cloneWorkOrder(order)))
  printingBusinessNodeBaseline.forEach((records, orderId) => nodeRecordStore.set(orderId, structuredClone(records)))
  printingBusinessReviewBaseline.forEach((review, orderId) => {
    if (review) reviewRecordStore.set(orderId, structuredClone(review))
    else reviewRecordStore.delete(orderId)
  })
  printingBusinessTaskBaseline.forEach((task) => registerPdaGenericProcessTask(structuredClone(task)))
}

export function listPrintingWorkOrders(): PrintingWorkOrderBusinessRecord[] {
  syncDerivedWorkflow()
  return Array.from(workOrderStore.values())
    .filter((order): order is MutablePrintWorkOrder => Boolean(order?.businessView))
    .map(projectPrintingBusinessRecord)
}

export function getPrintingWorkOrderById(workOrderId: string): PrintingWorkOrderBusinessRecord | undefined {
  syncDerivedWorkflow()
  const order = workOrderStore.get(workOrderId)
  return order?.businessView
    ? projectPrintingBusinessRecord(order)
    : undefined
}

export function getPrintingWorkOrderSummary(records = listPrintingWorkOrders()): PrintingWorkOrderSummary {
  const byUnit = new Map<string, PrintingWorkOrderSummary['byUnit'][number]>()
  const bucket = (qtyUnit: PrintingQtyUnit) => {
    if (!byUnit.has(qtyUnit)) byUnit.set(qtyUnit, { qtyUnit, plannedInputQty: 0, receivedInputQty: 0, pendingReceiptQty: 0, usedInputQty: 0, completedOutputQty: 0, handedOverQty: 0, receivedQty: 0 })
    return byUnit.get(qtyUnit)!
  }
  records.forEach(record => {
    const input = bucket(record.plannedInput.qtyUnit)
    input.plannedInputQty += record.plannedInput.plannedQty
    if (!record.historicalInputQuantityUnknown) input.receivedInputQty += record.actualInput.receivedQty
    input.usedInputQty += record.actualInput.usedQty
    const output = bucket(record.output.qtyUnit)
    output.completedOutputQty += record.output.completedQty
    output.handedOverQty += record.handover.handedOverQty
    output.receivedQty += record.handover.receivedQty
    output.pendingReceiptQty += record.pendingWritebackQty
  })
  return { orderCount: records.length, unknownInputCount: records.filter(record => record.historicalInputQuantityUnknown).length, byUnit: [...byUnit.values()].sort((a,b) => a.qtyUnit.localeCompare(b.qtyUnit, 'zh-CN')) }
}

export function formatPrintingSummaryMetric(
  summary: PrintingWorkOrderSummary,
  field: Exclude<keyof PrintingWorkOrderSummary['byUnit'][number], 'qtyUnit'>,
): string {
  if (!summary.byUnit.length) return '0'
  return summary.byUnit.filter(item => item[field] !== 0).map((item) => `${formatPrintingQty(item[field])} ${item.qtyUnit}`).join(' / ') || '0'
}

export function isPrintingWorkOrderBusinessCompleted(record: PrintingWorkOrderBusinessRecord): boolean {
  return Boolean(record.manuallyCompletedAt)
}

export function assignPrintingWorkOrder(workOrderId: string, input: { factoryId: string; factoryName: string; operatorName: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  if (derivePrintingProcessingStatus(order) !== 'WAIT_ASSIGN') throw new Error('当前加工状态不能重新分配')
  if (!input.factoryId.trim() || !input.factoryName.trim()) throw new Error('必须选择加工厂')
  order.printFactoryId = input.factoryId.trim()
  order.printFactoryName = input.factoryName.trim()
  order.status = 'WAIT_COLOR_TEST'
  order.acceptanceStatus = 'PENDING'
  order.manuallyCompletedAt = undefined
  order.manuallyCompletedBy = undefined
  const assignedAt = nowTimestamp()
  updateOrderTimestamp(order, assignedAt)
  syncLinkedTaskState(order.taskId, {
    status: 'NOT_STARTED',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    acceptanceStatus: 'PENDING',
    assignedFactoryId: order.printFactoryId,
    assignedFactoryName: order.printFactoryName,
    dispatchedAt: assignedAt,
    dispatchedBy: input.operatorName,
  })
  addPrintingBusinessOperation(order, '分配加工厂', input.operatorName, `分配至 ${order.printFactoryName}`)

  })
}

export function changePrintingInput(workOrderId: string, input: {
  newSku: string
  newMaterialName: string
  newImageUrl: string
  newGsm?: number
  newWidthCm?: number
  newStandardUnitUsage?: number | null
  newOrderUnitUsage?: number | null
  newPlannedQty?: number
  reason: string
  operatorName: string
}): PrintingInputChangeRecord {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (view.output.completedQty > 0) throw new Error('已产生完成数量，不能整单换料；请拆分剩余数量并创建新印花加工单')
  if (!input.newSku.trim() || !input.newMaterialName.trim()) throw new Error('新投入物料与 SKU 必填')
  if (!input.reason.trim()) throw new Error('必须填写投入调整原因')
  const usesFabricSpecification = ['面料', '花边', '织带'].includes(view.plannedInput.objectType)
  if (usesFabricSpecification && (!(Number(input.newGsm) > 0) || !(Number(input.newWidthCm) > 0))) throw new Error('克重和幅宽必须大于 0')
  const originalInput = structuredClone(view.plannedInput)
  const nextGsm = usesFabricSpecification ? Number(input.newGsm) : originalInput.gsm
  const nextWidthCm = usesFabricSpecification ? Number(input.newWidthCm) : originalInput.widthCm
  const crossSpecification = nextGsm !== originalInput.gsm || nextWidthCm !== originalInput.widthCm
  const nextStandardUsage = input.newStandardUnitUsage === undefined ? view.usage.standardUnitUsage : input.newStandardUnitUsage
  const nextOrderUsage = input.newOrderUnitUsage === undefined ? view.usage.orderUnitUsage : input.newOrderUnitUsage
  if (crossSpecification && view.usage.calculationMode === 'BY_USAGE' && (input.newOrderUnitUsage === undefined || input.newOrderUnitUsage === null || !(input.newOrderUnitUsage > 0))) {
    throw new Error('跨规格换料必须重新确认加工单单位用量')
  }
  const nextUsage: PrintingUsageBasis = { ...view.usage, standardUnitUsage: nextStandardUsage ?? null, orderUnitUsage: nextOrderUsage ?? null }
  const nextPlannedQty = nextUsage.calculationMode === 'DIRECT'
    ? roundPrintingValue(input.newPlannedQty ?? view.plannedInput.plannedQty, 2)
    : calculatePrintingPlannedInput(nextUsage, view.plannedInput.plannedQty)
  if (!(nextPlannedQty > 0)) throw new Error('计划投入数量必须大于 0')
  const newInput: PrintingPlannedInput = {
    ...view.plannedInput,
    sku: input.newSku.trim(),
    materialName: input.newMaterialName.trim(),
    imageUrl: input.newImageUrl.trim() || (input.newSku.trim() === view.plannedInput.sku ? view.plannedInput.imageUrl : ''),
    imageAlt: `${input.newMaterialName.trim()}实拍图`,
    gsm: nextGsm,
    widthCm: nextWidthCm,
    plannedQty: nextPlannedQty,
  }
  const change: PrintingInputChangeRecord = {
    changeId: `PIC-${order.printOrderNo}-${Date.now()}`,
    originalInput,
    newInput: structuredClone(newInput),
    originalStandardUnitUsage: view.usage.standardUnitUsage,
    newStandardUnitUsage: nextUsage.standardUnitUsage,
    originalOrderUnitUsage: view.usage.orderUnitUsage,
    newOrderUnitUsage: nextUsage.orderUnitUsage,
    reason: input.reason.trim(),
    operatorName: input.operatorName,
    changedAt: nowTimestamp(),
    crossSpecification,
  }
  view.usage = nextUsage
  view.plannedInput = newInput
  view.output.plannedQty = nextPlannedQty
  order.materialSku = newInput.sku
  order.plannedQty = nextPlannedQty
  if (view.actualInput.receivedQty > 0) view.actualInput.actualSku = newInput.sku
  view.inputChanges.unshift(change)
  view.printingDocumentsNeedReprint = true
  view.documentHistory.unshift({
    historyId: `PDH-${order.printOrderNo}-${Date.now()}`,
    documentName: '印花信息单', action: '标记需重印', operatorName: input.operatorName,
    operatedAt: change.changedAt, versionNo: `V${view.inputChanges.length + 1}`,
    remark: '加工投入发生变化；印花信息单与印花确认单需重新打印',
  })
  updateOrderTimestamp(order, change.changedAt)
  addPrintingBusinessOperation(order, '调整加工投入', input.operatorName, `${originalInput.sku} → ${newInput.sku}；${input.reason.trim()}`)
  return structuredClone(change)

  })
}

export function validatePrintingInputReceipt(workOrderId: string, input: { actualSku: string; receivedQty: number; receivedRollCount: number; receiverName: string; receiptId: string; upstreamRecordId: string }): boolean {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (order.manuallyCompletedAt || !['WAIT_INPUT_RECEIPT', 'PROCESSING', 'PROCESS_COMPLETED'].includes(derivePrintingProcessingStatus(order))) throw new Error('当前加工状态不能接收投入')
  if (input.actualSku.trim() !== view.plannedInput.sku) throw new Error('实际投入 SKU 与计划不同，请先登记投入调整')
  if (!Number.isFinite(input.receivedQty) || !(input.receivedQty > 0) || !Number.isInteger(input.receivedRollCount) || input.receivedRollCount <= 0) throw new Error('接收数量和卷数必须大于 0')
  if (!input.receiptId.trim()) throw new Error('本次接收确认号已失效，请重新打开。')
  if (!input.upstreamRecordId.trim()) throw new Error('请选择本次接收的来源单据。')
  if (roundPrintingValue(input.receivedQty, 2) <= 0 || roundPrintingValue(input.receivedQty, 2) !== input.receivedQty) throw new Error('接收数量请保留最多两位小数，且不得小于 0.01')
  const prior = view.actualInput.receipts?.find(item => item.receiptId === input.receiptId)
  if (prior) {
    if (prior.qty !== input.receivedQty || prior.rollCount !== input.receivedRollCount || prior.actualSku !== input.actualSku || prior.upstreamRecordId !== input.upstreamRecordId) throw new Error('确认号已用于其他接收内容')
    return false
  }
  return true
}

/** 补齐旧记录缺失的累计投入；这不是一次新的上游实物交接。 */
export function recordPrintingHistoricalInput(workOrderId: string, input: {
  receivedQty: number; receivedRollCount: number; historicalCompletedRollCount?: number; reason: string; operatorName: string
}): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (!view.historicalInputQuantityUnknown) throw new Error('该单无需补录历史投入，请使用正常接收')
  if (!input.reason.trim()) throw new Error('必须填写历史投入补录原因')
  if (!Number.isFinite(input.receivedQty) || input.receivedQty <= 0 || input.receivedQty < view.actualInput.usedQty) throw new Error(`历史累计投入不能小于已记录使用量 ${view.actualInput.usedQty} ${view.plannedInput.qtyUnit}`)
  if (!Number.isInteger(input.receivedRollCount) || input.receivedRollCount <= 0) throw new Error('历史投入卷数必须为正整数')
  if (view.historicalRollQuantitiesUnknown && (!Number.isInteger(input.historicalCompletedRollCount) || input.historicalCompletedRollCount! < 0 || (view.output.completedQty > 0 && input.historicalCompletedRollCount! <= 0))) throw new Error('请补录历史完成卷数：非负整数，已有产出时必须大于 0')
  if (view.historicalRollQuantitiesUnknown) {
    view.output.completedRollCount = input.historicalCompletedRollCount!
    view.historicalRollQuantitiesUnknown = false
  }
  view.actualInput.receivedQty = roundPrintingValue(input.receivedQty, 2)
  view.actualInput.receivedRollCount = input.receivedRollCount
  view.actualInput.actualSku = view.plannedInput.sku
  view.actualInput.receiverName = '历史补录（非本次交接）'
  view.actualInput.receivedAt = undefined
  view.historicalInputQuantityUnknown = false
  view.remark = `${view.remark}；已补录历史累计投入：${input.reason.trim()}`
  addPrintingBusinessOperation(order, '补录历史累计投入', input.operatorName, `${input.receivedQty} ${view.plannedInput.qtyUnit} / ${input.receivedRollCount} 卷；历史完成 ${view.output.completedRollCount} 卷；原因：${input.reason.trim()}；不代表当次上游实物交接`)
  updateOrderTimestamp(order)

  })
}

export function receivePrintingInput(workOrderId: string, input: { actualSku: string; receivedQty: number; receivedRollCount: number; receiverName: string; receiptId: string; upstreamRecordId: string }): void {
  return runPrintProcessMutation(() => {
  if (!validatePrintingInputReceipt(workOrderId, input)) return
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  view.actualInput.receipts = [...(view.actualInput.receipts ?? []), { receiptId: input.receiptId, upstreamRecordId: input.upstreamRecordId, receiverName: input.receiverName, receivedAt: nowTimestamp(), qty: input.receivedQty, rollCount: input.receivedRollCount, actualSku: input.actualSku }]
  view.actualInput.actualSku = input.actualSku.trim()
  view.actualInput.receivedQty = roundPrintingValue(view.actualInput.receivedQty + input.receivedQty, 2)
  view.actualInput.receivedRollCount += input.receivedRollCount
  view.actualInput.receiverName = input.receiverName.trim() || '加工厂接收人'
  view.actualInput.receivedAt = nowTimestamp()
  view.inputReceivedAt = view.actualInput.receivedAt
  order.status = 'WAIT_PRINT'
  order.acceptanceStatus = 'ACCEPTED'
  order.acceptedAt ||= view.actualInput.receivedAt
  order.acceptedBy ||= view.actualInput.receiverName
  syncLinkedTaskState(order.taskId, {
    status: 'IN_PROGRESS',
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: order.acceptedAt,
    acceptedBy: order.acceptedBy,
    startedAt: order.acceptedAt,
  })
  updateOrderTimestamp(order, view.actualInput.receivedAt)
  addPrintingBusinessOperation(order, '接收加工投入并开工', view.actualInput.receiverName, `${formatPrintingQty(input.receivedQty)} ${view.plannedInput.qtyUnit} / ${input.receivedRollCount} 卷`)

  })
}

export function completePrintingWorkOrder(workOrderId: string, input: { usedQty: number; usedRollCount: number; completedQty: number; completedRollCount: number; printerNo: string; operatorName: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (view.historicalInputQuantityUnknown) throw new Error('历史投入数量未记录，请先补录历史累计投入及原因，再填报加工完成')
  if (view.historicalRollQuantitiesUnknown) throw new Error('历史完成卷数未记录，请先补录历史累计数量，再填报加工完成')
  if (order.manuallyCompletedAt || !['PROCESSING', 'PROCESS_COMPLETED'].includes(derivePrintingProcessingStatus(order))) throw new Error('只有未人工完单的印花单可以填报加工数量')
  if (!(input.usedQty > 0) || !(input.completedQty > 0)) throw new Error('实际使用和完成数量必须大于 0')
  if (input.usedQty > view.actualInput.receivedQty) throw new Error('实际使用数量不能超过实际接收数量')
  if (input.completedQty > input.usedQty) throw new Error('完成数量不能超过实际使用数量')
  if (!Number.isInteger(input.usedRollCount) || input.usedRollCount <= 0 || !Number.isInteger(input.completedRollCount) || input.completedRollCount <= 0) throw new Error('使用卷数和完成卷数必须为正整数')
  const additionalQty = roundPrintingValue(input.completedQty - view.output.completedQty, 2)
  const additionalRolls = input.completedRollCount - view.output.completedRollCount
  if (additionalQty <= 0 || additionalRolls <= 0 || input.usedQty < view.actualInput.usedQty || input.usedRollCount < view.actualInput.usedRollCount) throw new Error('累计数量不能减少，必须填写本次新增产出及卷数')
  if (input.usedRollCount > view.actualInput.receivedRollCount) throw new Error('累计使用卷数不能超过已接收卷数')
  const previousRolls = view.output.completedQty > 0 ? view.barcodes : []
  const rollOffset = Math.max(view.barcodeSequence || 0, view.output.completedRollCount, previousRolls.reduce((max, roll) => Math.max(max, Number(roll.rollNo) || 0), 0))
  const rollQty = roundPrintingValue(additionalQty / additionalRolls, 2)
  const newRolls = Array.from({ length: additionalRolls }, (_, index) => makePrintingBarcode({
    printOrderNo: order.printOrderNo, outputSku: view.output.sku, rollIndex: rollOffset + index,
    lengthY: index === additionalRolls - 1 ? roundPrintingValue(additionalQty - rollQty * (additionalRolls - 1), 2) : rollQty,
    gsm: view.output.gsm, widthCm: view.output.widthCm, qtyUnit: view.output.qtyUnit, objectType: view.output.objectType,
  }))
  const completedAt = nowTimestamp()
  view.actualInput.usedQty = roundPrintingValue(input.usedQty, 2)
  view.actualInput.usedRollCount = input.usedRollCount
  view.output.completedQty = roundPrintingValue(input.completedQty, 2)
  view.output.completedRollCount = input.completedRollCount
  view.printerNo = input.printerNo.trim() || '未填写'
  view.transferCompletedQty = view.output.completedQty
  view.completedAt = completedAt
  view.barcodes = [...previousRolls, ...newRolls]
  upsertNodeRecord(order.printOrderId, 'PRINT', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(order.printOrderId, 'PRINT'), printOrderId: order.printOrderId, taskId: order.taskId,
    nodeCode: 'PRINT', nodeName: PRINT_NODE_LABEL.PRINT, operatorUserId: current?.operatorUserId || 'USR-PRINT', operatorName: input.operatorName,
    startedAt: current?.startedAt || order.acceptedAt || completedAt, finishedAt: completedAt, printerNo: view.printerNo,
    outputQty: view.output.completedQty, wasteQty: roundPrintingValue(input.usedQty - input.completedQty, 2), qtyUnit: getQtyUnit(order), remark: '页面填报加工完成',
  }))
  upsertNodeRecord(order.printOrderId, 'TRANSFER', (current) => ({
    nodeRecordId: current?.nodeRecordId || createNodeRecordId(order.printOrderId, 'TRANSFER'), printOrderId: order.printOrderId, taskId: order.taskId,
    nodeCode: 'TRANSFER', nodeName: PRINT_NODE_LABEL.TRANSFER, operatorUserId: current?.operatorUserId || 'USR-PRINT', operatorName: input.operatorName,
    startedAt: current?.startedAt || completedAt, finishedAt: completedAt, usedMaterialQty: view.actualInput.usedQty,
    actualCompletedQty: view.output.completedQty, qtyUnit: getQtyUnit(order), remark: '页面合并填报印花加工完成',
  }))
  order.status = 'WAIT_HANDOVER'
  syncLinkedTaskState(order.taskId, { status: 'IN_PROGRESS', startedAt: order.acceptedAt || completedAt })
  updateOrderTimestamp(order, completedAt)
  addPrintingBusinessOperation(order, '填报加工完成', input.operatorName, `使用 ${formatPrintingQty(input.usedQty)} ${view.plannedInput.qtyUnit}；完成 ${formatPrintingQty(input.completedQty)} ${view.output.qtyUnit} / ${input.completedRollCount} 卷`)

  })
}

export function handoverPrintingOutput(workOrderId: string, input: { qty: number; barcodeIds: string[]; operatorName: string; receiverName: string; dispatchId?: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (order.manuallyCompletedAt || order.status === 'CANCELLED' || view.output.completedQty <= 0) throw new Error('当前没有可交出的加工产出')
  const remainingQty = roundPrintingValue(view.output.completedQty - view.handover.handedOverQty, 2)
  if (!(input.qty > 0) || input.qty > remainingQty) throw new Error(`交出数量不能超过剩余可交 ${formatPrintingQty(remainingQty)} ${view.output.qtyUnit}`)
  if (input.barcodeIds.length === 0) throw new Error('至少选择一个产出卷条码')
  const selected = view.barcodes.filter((barcode) => input.barcodeIds.includes(barcode.id))
  if (selected.length !== input.barcodeIds.length) throw new Error('存在无效产出卷条码')
  if (listPrintingDispatchDocuments().some(doc => doc.status === '草稿' && doc.id !== input.dispatchId && doc.lines.some(line => line.workOrderId === workOrderId && line.barcodeIds.some(id => input.barcodeIds.includes(id))))) throw new Error('所选卷已加入交出草稿，请从交出单据确认交出')
  if (selected.some(roll => !isPrintablePrintingRoll(projectPrintingBusinessRecord(order), roll))) throw new Error('卷数量未维护或超过完成量')
  if (selected.some((barcode) => barcode.status === '已交出' || barcode.status === '已入库')) throw new Error('产出卷已交出，不能重复交出')
  if (selected.some((barcode) => barcode.sku !== view.output.sku)) throw new Error('交出条码必须绑定固定产出 SKU')
  if (!input.operatorName.trim()) throw new Error('请填写交出人')
  const configuredReceiverName = order.receiverName.trim() || order.targetTransferWarehouseName.trim()
  if (!configuredReceiverName) throw new Error('尚未生成唯一接收方，暂不能交出')
  if (input.receiverName.trim() !== configuredReceiverName) throw new Error(`本单接收方为${configuredReceiverName}，不能交给其他接收方`)
  if (view.handover.handedOverQty > 0 && view.handover.receiverName && view.handover.receiverName !== configuredReceiverName) throw new Error('首次有效交出后接收方已冻结；请先更正或撤销原交出记录')
  const selectedQty = roundPrintingValue(selected.reduce((sum, barcode) => sum + barcode.lengthY, 0), 2)
  if (Math.abs(selectedQty - input.qty) > 0.000001) throw new Error(`本次交出数量必须等于所选整卷数量 ${selectedQty} ${view.output.qtyUnit}`)
  const handedOverAt = nowTimestamp()
  const handoverOrderId = order.handoverOrderId || ensureStartedTaskHandover(order.taskId)
  if (!handoverOrderId) throw new Error('未找到已开工任务的交出单，请返回任务检查。')
  const record = createFactoryHandoverRecord({
    handoverOrderId, submittedQty: input.qty, qtyUnit: view.output.qtyUnit,
    factorySubmittedAt: handedOverAt, factorySubmittedBy: input.operatorName,
    factoryRemark: `下游接收人：${input.receiverName}；产出卷：${selected.map(barcode => barcode.barcode).join('、')}`,
    objectType: order.objectType === '面料' ? 'FABRIC' : 'MATERIAL',
    handoutObjectType: order.objectType === '面料' ? 'FABRIC' : 'MATERIAL',
    materialCode: view.output.sku, materialName: view.output.materialName,
    skuCode: view.output.sku, handoutItemLabel: selected.map(barcode => `${barcode.rollNo} / ${barcode.lengthY} ${view.output.qtyUnit}`).join('、'),
  })
  order.handoverOrderId = handoverOrderId
  const head = getHandoverOrderById(handoverOrderId)
  order.handoverOrderNo = head?.handoverOrderNo
  view.handover.handoverNo = head?.handoverOrderNo
  selected.forEach((barcode) => { barcode.status = '已交出'; barcode.handoverRecordId = record.handoverRecordId || record.recordId })
  view.handover.handedOverQty = roundPrintingValue(view.handover.handedOverQty + input.qty, 2)
  view.handover.receiverName = configuredReceiverName
  view.handover.handedOverAt = handedOverAt
  view.deliveryAt = handedOverAt
  view.pendingWritebackQty = roundPrintingValue(view.handover.handedOverQty - view.handover.receivedQty, 2)
  order.status = view.handover.handedOverQty < view.output.completedQty ? 'PARTIAL_HANDOVER' : 'HANDOVER_WAIT_RECEIVE'
  syncPrintingBusinessReview(order)
  updateOrderTimestamp(order, handedOverAt)
  addPrintingBusinessOperation(order, '交出加工产出', input.operatorName, `${formatPrintingQty(input.qty)} ${view.output.qtyUnit}；${input.barcodeIds.length} 卷`)

  })
}

export function receivePrintingHandover(workOrderId: string, input: { receivedQty: number; receiverName: string; differenceReason?: string; objectionQty?: number }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  const remaining = roundPrintingValue(view.handover.handedOverQty - view.handover.receivedQty, 2)
  if (remaining <= 0) throw new Error('当前没有下游待接收数量')
  if (!(input.receivedQty > 0) || input.receivedQty > remaining) throw new Error(`接收数量不能超过待接收 ${formatPrintingQty(remaining)} ${view.output.qtyUnit}`)
  const receiverName = input.receiverName.trim() || '下游接收人'
  const receivedAt = nowTimestamp()
  const head = order.handoverOrderId ? getHandoverOrderById(order.handoverOrderId) : undefined
  if (!head) throw new Error('未找到印花产出交出单')
  const linkedRecordIds = new Set(view.barcodes.map((barcode) => barcode.handoverRecordId).filter(Boolean))
  const records = getPdaHandoverRecordsByHead(head.handoverId)
    .filter((record) => record.handoverRecordStatus !== 'VOIDED')
    .filter((record) => linkedRecordIds.has(record.handoverRecordId || record.recordId))
    .sort((a, b) => (a.factorySubmittedAt || '').localeCompare(b.factorySubmittedAt || '') || a.sequenceNo - b.sequenceNo)
  let unallocatedQty = input.receivedQty
  for (const record of records) {
    if (unallocatedQty <= 0) break
    const submittedQty = roundPrintingValue(record.submittedQty ?? record.plannedQty ?? 0, 2)
    const currentReceivedQty = roundPrintingValue(record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0, 2)
    const recordRemainingQty = Math.max(0, roundPrintingValue(submittedQty - currentReceivedQty, 2))
    if (recordRemainingQty <= 0) continue
    const allocatedQty = Math.min(unallocatedQty, recordRemainingQty)
    writeBackHandoverRecord({
      handoverRecordId: record.handoverRecordId || record.recordId,
      receiverWrittenQty: roundPrintingValue(currentReceivedQty + allocatedQty, 2),
      receiverWrittenAt: receivedAt,
      receiverWrittenBy: receiverName,
      receiverRemark: input.differenceReason?.trim() || undefined,
      diffReason: allocatedQty < recordRemainingQty ? input.differenceReason?.trim() || '本批部分接收' : undefined,
    })
    unallocatedQty = roundPrintingValue(unallocatedQty - allocatedQty, 2)
  }
  if (unallocatedQty > 0) throw new Error('印花产出交出记录与待接收数量不一致，请先核对交出记录')

  const refreshedRecords = getPdaHandoverRecordsByHead(head.handoverId)
    .filter((record) => record.handoverRecordStatus !== 'VOIDED')
    .filter((record) => linkedRecordIds.has(record.handoverRecordId || record.recordId))
  view.handover.receivedQty = roundPrintingValue(
    refreshedRecords.reduce((sum, record) => sum + (record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0), 0),
    2,
  )
  view.handover.diffQty = roundPrintingValue(view.handover.handedOverQty - view.handover.receivedQty, 2)
  view.handover.objectionQty = Math.max(0, input.objectionQty || 0)
  view.handover.receivedBy = receiverName
  view.handover.receivedAt = receivedAt
  view.handover.differenceReason = input.differenceReason?.trim() || (view.handover.diffQty > 0 ? '仍有待接收数量' : '')
  view.pendingWritebackQty = Math.max(view.handover.diffQty, 0)
  const fullyReceived = view.handover.receivedQty >= view.output.completedQty && view.handover.diffQty === 0
  order.status = fullyReceived ? 'FULL_HANDOVER' : 'PARTIAL_HANDOVER'
  const recordById = new Map(refreshedRecords.map((record) => [record.handoverRecordId || record.recordId, record]))
  view.barcodes.filter((barcode) => barcode.status === '已交出').forEach((barcode) => {
    const record = barcode.handoverRecordId ? recordById.get(barcode.handoverRecordId) : undefined
    if (!record) return
    const submittedQty = record.submittedQty ?? record.plannedQty ?? 0
    const receivedQty = record.receiverWrittenQty ?? record.warehouseWrittenQty ?? 0
    if (receivedQty + 0.000001 < submittedQty) return
    barcode.status = '已入库'
    barcode.inboundStatus = '已上架'
    barcode.inboundAt = receivedAt
  })
  // 收齐只记录下游接收事实；不得在这里把加工单冒充为人工完单。
  order.manuallyCompletedAt = undefined
  order.manuallyCompletedBy = undefined
  syncPrintingBusinessReview(order)
  syncLinkedTaskState(order.taskId, {
    status: 'IN_PROGRESS',
    blockReason: undefined,
    blockRemark: undefined,
  })
  updateOrderTimestamp(order, view.handover.receivedAt)
  addPrintingBusinessOperation(order, '接收加工产出', receiverName, `${formatPrintingQty(input.receivedQty)} ${view.output.qtyUnit}；差异 ${formatPrintingQty(view.handover.diffQty)} ${view.output.qtyUnit}`)

  })
}

export function completePrintWorkOrderDocument(workOrderId: string, input: { operatorName: string }): PrintWorkOrder {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (derivePrintingHandoverStatus(order) !== 'FULL_HANDOVER' || view.handover.receivedQty < view.handover.handedOverQty || view.handover.diffQty !== 0 || view.handover.objectionQty !== 0) {
    throw new Error('加工产出尚未全部接收或仍有差异，不能完成单据')
  }
  if (order.manuallyCompletedAt) throw new Error('印花加工单已经人工完成')
  const completedAt = nowTimestamp()
  order.manuallyCompletedAt = completedAt
  order.manuallyCompletedBy = input.operatorName.trim() || '印花主管'
  order.status = 'COMPLETED'
  updateOrderTimestamp(order, completedAt)
  syncLinkedTaskState(order.taskId, { status: 'DONE', finishedAt: completedAt, blockReason: undefined, blockRemark: undefined })
  addPrintingBusinessOperation(order, '人工完成单据', order.manuallyCompletedBy, '确认交出与接收数量无差异，人工完成印花加工单')
  return cloneWorkOrder(order)

  })
}

export function cancelPrintingWorkOrder(workOrderId: string, input: { operatorName: string; reason: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (view.output.completedQty > 0 || view.handover.handedOverQty > 0) throw new Error('已有完成或交出事实，不能直接取消')
  if (!input.reason.trim()) throw new Error('取消原因必填')
  order.status = 'CANCELLED'
  syncLinkedTaskState(order.taskId, { status: 'CANCELLED' })
  updateOrderTimestamp(order)
  addPrintingBusinessOperation(order, '取消印花加工单', input.operatorName, input.reason.trim())

  })
}

export function addPrintingRollBarcode(workOrderId: string): PrintingRollBarcode {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  if (view.historicalRollQuantitiesUnknown) throw new Error('历史完成卷数未记录，请先补录历史累计数量，再补充产出卷条码')
  const rollOffset = Math.max(view.barcodeSequence || 0, view.output.completedRollCount, view.barcodes.reduce((max, roll) => Math.max(max, Number(roll.rollNo) || 0), 0))
  const barcode = makePrintingBarcode({ printOrderNo: order.printOrderNo, outputSku: view.output.sku, rollIndex: rollOffset, lengthY: 0, gsm: view.output.gsm, widthCm: view.output.widthCm, qtyUnit: view.output.qtyUnit, objectType: view.output.objectType })
  barcode.createdAt = nowTimestamp()
  view.barcodeSequence = rollOffset + 1
  view.barcodes.push(barcode)
  addPrintingBusinessOperation(order, '补充产出卷条码', '印花执行员', barcode.barcode)
  return structuredClone(barcode)

  })
}

export function updatePrintingRollBarcode(workOrderId: string, barcodeId: string, input: { lengthY?: number; meters?: number; weightKg?: number; gsm: number; widthCm: number; vatNo: string; warehouseName: string; remark: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  const barcode = view.barcodes.find((item) => item.id === barcodeId)
  if (!barcode) throw new Error('未找到产出卷条码')
  assertPrintingRollEditable(workOrderId, [barcode.id])
  if (barcode.sku !== view.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
  const usesFabricSpecification = ['面料', '花边', '织带'].includes(view.output.objectType)
  if (usesFabricSpecification && (!(input.gsm > 0) || !(input.widthCm > 0))) throw new Error('克重和幅宽必须大于 0')
  if ([input.lengthY, input.meters, input.weightKg, input.gsm, input.widthCm].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new Error('数量与规格必须为有效非负数')
  const hasLength = input.lengthY !== undefined && input.lengthY > 0
  const hasMeters = input.meters !== undefined && input.meters > 0
  const hasWeight = input.weightKg !== undefined && input.weightKg > 0
  if (!hasLength && !hasMeters && !hasWeight) throw new Error(usesFabricSpecification ? '数量、米数或重量至少填写一项' : '数量或重量至少填写一项')
  const quantityIsYard = view.output.qtyUnit.toLowerCase() === 'yard'
  const quantityIsMeter = ['米', 'meter', 'm'].includes(view.output.qtyUnit.toLowerCase())
  const meters = usesFabricSpecification
    ? hasMeters
      ? roundPrintingValue(input.meters!, 2)
      : hasLength
        ? quantityIsYard ? metersFromYards(input.lengthY!) : roundPrintingValue(input.lengthY!, 2)
        : roundPrintingValue((input.weightKg! * 1000) / ((input.widthCm / 100) * input.gsm), 2)
    : barcode.meters
  const lengthY = hasLength
    ? roundPrintingValue(input.lengthY!, 2)
    : usesFabricSpecification
      ? quantityIsYard ? yardsFromMeters(meters) : quantityIsMeter ? meters : barcode.lengthY
      : barcode.lengthY
  const weightKg = hasWeight ? roundPrintingValue(input.weightKg!, 3) : usesFabricSpecification ? weightKgFromMeters(meters, input.widthCm, input.gsm) : barcode.weightKg
  Object.assign(barcode, { lengthY, meters, weightKg, gsm: usesFabricSpecification ? input.gsm : barcode.gsm, widthCm: usesFabricSpecification ? input.widthCm : barcode.widthCm, vatNo: input.vatNo.trim(), warehouseName: input.warehouseName.trim() || barcode.warehouseName, remark: input.remark.trim() })
  addPrintingBusinessOperation(order, '编辑产出卷属性', '印花执行员', `${barcode.barcode}；${formatPrintingQty(lengthY)} ${view.output.qtyUnit} / ${formatPrintingWeightKg(weightKg)} KG`)

  })
}

export function batchUpdatePrintingRollBarcodes(workOrderId: string, barcodeIds: string[], input: { gsm: number; widthCm: number; vatNo: string; warehouseName: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  const selected = view.barcodes.filter((barcode) => barcodeIds.includes(barcode.id))
  if (selected.length === 0) throw new Error('请选择要批量修改的产出卷条码')
  assertPrintingRollEditable(workOrderId, barcodeIds)
  const usesFabricSpecification = ['面料', '花边', '织带'].includes(view.output.objectType)
  if (![input.gsm, input.widthCm].every(Number.isFinite)) throw new Error('规格必须为有效数字')
  if (usesFabricSpecification && (!(input.gsm > 0) || !(input.widthCm > 0))) throw new Error('克重和幅宽必须大于 0')
  selected.forEach((barcode) => {
    if (barcode.sku !== view.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
    Object.assign(barcode, { gsm: usesFabricSpecification ? input.gsm : barcode.gsm, widthCm: usesFabricSpecification ? input.widthCm : barcode.widthCm, vatNo: input.vatNo.trim(), warehouseName: input.warehouseName.trim() || barcode.warehouseName })
    if (usesFabricSpecification && barcode.meters > 0) barcode.weightKg = weightKgFromMeters(barcode.meters, input.widthCm, input.gsm)
  })
  addPrintingBusinessOperation(order, '批量修改产出卷属性', '印花执行员', usesFabricSpecification ? `${selected.length} 卷；${input.gsm}g/㎡ / ${input.widthCm}cm` : `${selected.length} 个物料条码`)

  })
}

export function markPrintingRollBarcodesPrinted(workOrderId: string, barcodeIds: string[], operatorName: string): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  const selected = view.barcodes.filter((barcode) => barcodeIds.includes(barcode.id))
  if (selected.length === 0) throw new Error('请选择要打印的产出卷条码')
  if (barcodeIds.some(id => !selected.some(item => item.id === id)) || selected.some(item => !isPrintablePrintingRoll(view, item))) throw new Error('仅能打印已完成且正数量的产出卷；草稿或超出完成数量的卷不能打印')
  const printedAt = nowTimestamp()
  selected.forEach((barcode) => {
    if (barcode.sku !== view.output.sku) throw new Error('条码 SKU 与固定加工产出不一致')
    if (barcode.status === '草稿') barcode.status = '已打印'
    barcode.printedBy = operatorName; barcode.printedAt = printedAt
  })
  view.documentHistory.unshift({ historyId: `PDH-${order.printOrderNo}-${Date.now()}`, documentName: '加工产出卷条码', action: '打印', operatorName, operatedAt: printedAt, versionNo: `LABEL-${view.documentHistory.filter((item) => item.documentName === '加工产出卷条码').length + 1}`, remark: `${selected.length} 个卷条码` })
  addPrintingBusinessOperation(order, '打印产出卷条码', operatorName, `${selected.length} 个条码`)

  })
}

export function recordPrintingDocumentAction(workOrderId: string, input: { documentName: PrintingDocumentHistory['documentName']; action: '打印' | '下载' | '补打'; operatorName: string; remark?: string }): void {
  return runPrintProcessMutation(() => {
  const order = getMutablePrintingBusinessOrder(workOrderId)
  const view = order.businessView!
  const versionIndex = view.documentHistory.filter((item) => item.documentName === input.documentName).length + 1
  view.documentHistory.unshift({ historyId: `PDH-${order.printOrderNo}-${Date.now()}`, documentName: input.documentName, action: input.action, operatorName: input.operatorName, operatedAt: nowTimestamp(), versionNo: `V${versionIndex}`, remark: input.remark })
  if (input.documentName !== '加工产出卷条码') view.printingDocumentsNeedReprint = false
  addPrintingBusinessOperation(order, `${input.action}${input.documentName}`, input.operatorName, input.remark || '')

  })
}


// 交出单保存于原加工单事实中；多单单据仅组合实际卷，不另建数量账。
export function listPrintingDispatchDocuments(): PrintingDispatchDocument[] {
  return listPrintingWorkOrders().flatMap(order => order.dispatchDocuments || [])
}

export function printingRollReserved(workOrderId: string, barcodeId: string): boolean {
  return listPrintingDispatchDocuments().some(doc => doc.status === '草稿' && doc.lines.some(line => line.workOrderId === workOrderId && line.barcodeIds.includes(barcodeId)))
}

function assertPrintingRollEditable(workOrderId: string, ids: string[]): void {
  const view = getMutablePrintingBusinessOrder(workOrderId).businessView!
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('请选择不同的卷条码')
  if (ids.some(id => !view.barcodes.some(roll => roll.id === id))) throw new Error('卷条码不存在')
  if (view.barcodes.some(roll => ids.includes(roll.id) && (roll.handoverRecordId || roll.status === '已交出' || roll.status === '已入库' || roll.inboundStatus === '已上架'))) throw new Error('已交出或已入库的卷不能修改或删除')
  if (ids.some(id => printingRollReserved(workOrderId, id))) throw new Error('卷已加入交出草稿，请先作废草稿再维护')
}

export function deletePrintingRollBarcodes(workOrderId: string, ids: string[]): void {
  runPrintProcessMutation(() => {
    assertPrintingRollEditable(workOrderId, ids)
    const order = getMutablePrintingBusinessOrder(workOrderId)
    const view = order.businessView!
    // 保留历史最大卷号，删除后也不重用条码。
    view.barcodeSequence = Math.max(view.barcodeSequence || 0, ...view.barcodes.map(roll => Number(roll.rollNo) || 0))
    view.barcodes = view.barcodes.filter(roll => !ids.includes(roll.id))
    addPrintingBusinessOperation(order, '删除产出卷条码', '印花执行员', ids.join('、'))
  })
}

export function copyPrintingRollBarcode(workOrderId: string, id: string): PrintingRollBarcode {
  return runPrintProcessMutation(() => {
    const source = getPrintingWorkOrderById(workOrderId)?.barcodes.find(roll => roll.id === id)
    if (!source) throw new Error('卷条码不存在')
    const added = addPrintingRollBarcode(workOrderId)
    const roll = getMutablePrintingBusinessOrder(workOrderId).businessView!.barcodes.find(item => item.id === added.id)!
    // 复制规格，不复制实际长度、交接或打印事实。
    Object.assign(roll, { gsm: source.gsm, widthCm: source.widthCm, vatNo: source.vatNo, warehouseName: source.warehouseName, remark: source.remark })
    return structuredClone(roll)
  })
}

export function importPrintingRollLengths(workOrderId: string, text: string): number {
  return runPrintProcessMutation(() => {
    const order = getMutablePrintingBusinessOrder(workOrderId)
    const view = order.businessView!
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (!lines.length || lines.length > 500) throw new Error('请导入 1 至 500 行细码')
    const entries = lines.map((line, index) => {
      const parts = line.trim().split(/[,，\t]/).map(value => value.trim())
      if (parts.length !== 2 || !parts[0] || !parts[1] || !Number.isFinite(Number(parts[1])) || Number(parts[1]) <= 0) throw new Error(`第 ${index + 1} 行请填写卷号、正数量`)
      const roll = view.barcodes.find(item => item.rollNo === parts[0].padStart(4, '0') || item.barcode === parts[0])
      if (!roll) throw new Error(`第 ${index + 1} 行卷号不存在，请先补充条码`)
      return { roll, qty: roundPrintingValue(Number(parts[1]), 2) }
    })
    assertPrintingRollEditable(workOrderId, entries.map(item => item.roll.id))
    const quantities = new Map(entries.map(item => [item.roll.id, item.qty]))
    const total = view.barcodes.reduce((sum, roll) => sum + (quantities.get(roll.id) ?? roll.lengthY), 0)
    if (total > view.output.completedQty + 0.000001) throw new Error('导入后卷总量超过实际完成数量，请先核对完成数量')
    entries.forEach(({roll, qty}) => updatePrintingRollBarcode(workOrderId, roll.id, { lengthY: qty, gsm: roll.gsm, widthCm: roll.widthCm, vatNo: roll.vatNo, warehouseName: roll.warehouseName, remark: roll.remark || '' }))
    addPrintingBusinessOperation(order, '导入细码', '印花执行员', `${entries.length} 卷`)
    return entries.length
  })
}

export function movePrintingRollsToOutboundArea(workOrderId: string, ids: string[]): void {
  runPrintProcessMutation(() => {
    const order = getMutablePrintingBusinessOrder(workOrderId)
    const rolls = order.businessView!.barcodes.filter(roll => ids.includes(roll.id))
    if (!ids.length || new Set(ids).size !== ids.length || rolls.length !== ids.length || rolls.some(roll => roll.inboundStatus !== '已上架' || roll.handoverRecordId)) throw new Error('仅能下架当前仓内已上架且未交出的卷')
    rolls.forEach(roll => { roll.inboundStatus = '待上架'; roll.outboundArea = '待出库区' })
    addPrintingBusinessOperation(order, '下架到待出库区', '印花仓管', `${rolls.length} 卷；尚未交出`)
  })
}

function validateDispatchLines(lines: PrintingDispatchDocument['lines'], ownId?: string): void {
  if (!lines.length) throw new Error('请选择可交出的产出卷')
  const occupied = new Set(listPrintingDispatchDocuments().filter(doc => doc.status !== '已作废' && doc.id !== ownId).flatMap(doc => doc.lines.flatMap(line => line.barcodeIds.map(id => `${line.workOrderId}:${id}`))))
  const seen = new Set<string>()
  let group = ''
  for (const line of lines) {
    const order = getPrintingWorkOrderById(line.workOrderId)
    if (!order || !order.printFactoryId || !order.receivingTargetName || order.manuallyCompletedAt || order.processingStatus === 'CANCELLED') throw new Error('加工单不存在、已结束或缺少加工厂/接收方')
    const key = JSON.stringify([order.printFactoryId, order.receivingTargetId, order.receivingTargetName, order.receivingTargetWarehouseName, order.output.qtyUnit])
    if (group && group !== key) throw new Error('仅能合并同加工厂、同接收方、同接收仓和同单位的产出')
    group = key
    if (!line.barcodeIds.length) throw new Error('请至少选择一卷')
    let qty = 0
    for (const id of line.barcodeIds) {
      const roll = order.barcodes.find(item => item.id === id)
      const identity = `${line.workOrderId}:${id}`
      if (occupied.has(identity) || seen.has(identity)) throw new Error('同一卷不能重复加入交出单')
      seen.add(identity)
      if (!roll || roll.handoverRecordId || roll.status === '已交出' || roll.status === '已入库' || !isPrintablePrintingRoll(order, roll)) throw new Error('卷未维护有效数量、超过完成量或已交出')
      qty += roll.lengthY
    }
    if (qty > order.output.completedQty - order.handover.handedOverQty + 0.000001) throw new Error('所选卷超过剩余可交数量')
  }
}

export function createPrintingDispatch(lines: PrintingDispatchDocument['lines'], operator: string, mergeId?: string): string {
  return runPrintProcessMutation(() => {
    if (!operator.trim()) throw new Error('请填写建单人')
    const existing = mergeId ? listPrintingDispatchDocuments().find(doc => doc.id === mergeId) : undefined
    if (mergeId && existing?.status !== '草稿') throw new Error('只能合入已有草稿')
    const combined = [...(existing?.lines || []), ...structuredClone(lines)]
    validateDispatchLines(combined, mergeId)
    const grouped = new Map<string, string[]>()
    combined.forEach(line => grouped.set(line.workOrderId, [...(grouped.get(line.workOrderId) || []), ...line.barcodeIds]))
    const normalized = [...grouped].map(([workOrderId, barcodeIds]) => ({workOrderId, barcodeIds, rolls: getPrintingWorkOrderById(workOrderId)!.barcodes.filter(roll => barcodeIds.includes(roll.id)).map(roll => structuredClone(roll))}))
    const anchor = getMutablePrintingBusinessOrder(normalized[0].workOrderId)
    anchor.businessView!.dispatchDocuments ||= []
    if (existing) {
      const stored = anchor.businessView!.dispatchDocuments.find(doc => doc.id === mergeId)!
      stored.lines = normalized
      addPrintingBusinessOperation(anchor, '合入交出草稿', operator, mergeId!)
      return mergeId!
    }
    const id = `SJ-${nowTimestamp().slice(0,10).replaceAll('-', '')}-${Date.now()}-${listPrintingDispatchDocuments().length+1}`
    anchor.businessView!.dispatchDocuments.push({id, status:'草稿', createdAt:nowTimestamp(), createdBy:operator, lines:normalized})
    addPrintingBusinessOperation(anchor, '生成交出草稿', operator, id)
    return id
  })
}

export function confirmPrintingDispatch(id: string, operator: string): void {
  runPrintProcessMutation(() => {
    const doc = listPrintingDispatchDocuments().find(item => item.id === id)
    if (!doc || doc.status !== '草稿') throw new Error('仅草稿可以确认交出')
    if (!operator.trim()) throw new Error('请填写交出人')
    validateDispatchLines(doc.lines, id)
    doc.lines.forEach(line => {
      const order = getPrintingWorkOrderById(line.workOrderId)!
      const qty = roundPrintingValue(order.barcodes.filter(roll => line.barcodeIds.includes(roll.id)).reduce((sum, roll) => sum + roll.lengthY, 0), 2)
      handoverPrintingOutput(line.workOrderId, {qty, barcodeIds:line.barcodeIds, operatorName:operator, receiverName:order.receivingTargetName,dispatchId:id})
    })
    const stored = getMutablePrintingBusinessOrder(doc.lines[0].workOrderId).businessView!.dispatchDocuments!.find(item => item.id === id)!
    stored.status = '已交出'; stored.handedOverAt = nowTimestamp(); stored.handedOverBy = operator
  })
}

export function voidPrintingDispatch(id: string, operator: string): void {
  runPrintProcessMutation(() => {
    const doc = listPrintingDispatchDocuments().find(item => item.id === id)
    if (!doc || doc.status !== '草稿') throw new Error('只能作废尚未交出的草稿')
    if (!operator.trim()) throw new Error('请填写操作人')
    const order = getMutablePrintingBusinessOrder(doc.lines[0].workOrderId)
    order.businessView!.dispatchDocuments!.find(item => item.id === id)!.status = '已作废'
    addPrintingBusinessOperation(order, '作废交出草稿', operator, id)
  })
}

export function updatePrintingOrderInformation(workOrderId: string, input: { craftName:string; type:string; shade:string; temperature:string; printerNo:string; plannedFinishAt:string; remark:string; operatorName:string }): void {
  runPrintProcessMutation(() => {
    const order=getMutablePrintingBusinessOrder(workOrderId),view=order.businessView!
    if(order.status==='CANCELLED'||order.manuallyCompletedAt)throw new Error('已取消或已完成的加工单不能编辑')
    if(!input.craftName.trim())throw new Error('工艺名称不能为空')
    const requirement={craftName:input.craftName.trim(),type:input.type.trim(),shade:input.shade.trim(),temperature:input.temperature.trim()}
    if(view.output.completedQty>0 && Object.entries(requirement).some(([key,value])=>view.requirement[key as keyof PrintingRequirement]!==value))throw new Error('已有实际产出，不能修改工艺要求')
    if(input.plannedFinishAt && !Number.isFinite(Date.parse(input.plannedFinishAt)))throw new Error('交货时间无效')
    Object.assign(view.requirement,requirement)
    view.printerNo=input.printerNo.trim();view.remark=input.remark.trim();order.plannedFinishAt=input.plannedFinishAt || undefined
    view.printingDocumentsNeedReprint=true
    addPrintingBusinessOperation(order,'编辑印花信息',input.operatorName,'更新工艺、打印机、交期或备注；已有打印单需核对重印')
  })
}
