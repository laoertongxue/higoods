import {
  buildPostFinishingDifferenceFingerprint,
  consumePostFinishingAuthorization,
  PostFinishingAuthorizationError,
  type PostFinishingAuthorizationConsumption,
  type PostFinishingAuthorizationStage,
} from './post-finishing-authorization.ts'
import {
  issuePostFinishingDocumentNumber,
  resetPostFinishingDocumentNumbering,
  type PostFinishingDeliveryTrigger,
} from './post-finishing-document-numbering.ts'
import {
  appendPostFinishingOperationLog,
  resetPostFinishingOperationLogs,
  type PostFinishingFullFlowStage,
} from './post-finishing-operation-log.ts'
import {
  bindPostFinishingQcReferences,
  listPostFinishingQcReferences,
  resetPostFinishingQcReferences,
  uploadPostFinishingQcReference,
  type PostFinishingQcReferenceRecord,
  type PostFinishingQcReferenceSource,
  type PostFinishingQcReferenceType,
} from './post-finishing-qc-reference.ts'
import { resetPostFinishingAuthorizationConsumptions } from './post-finishing-authorization.ts'

export interface PostFinishingActor {
  actorId: string
  actorName: string
  roleName: string
}

export const POST_FINISHING_ACCEPTANCE_ACTORS = {
  factoryCourier: { actorId: 'PF-USER-COURIER', actorName: '苏车缝送货员', roleName: '车缝厂送货人员' },
  returnConfirmer: { actorId: 'PF-USER-RETURN', actorName: '黄回货确认员', roleName: '后道回货确认人员' },
  returnSupervisor: { actorId: 'PF-USER-RETURN-MGR', actorName: '凌回货主管', roleName: '后道回货主管' },
  sender: { actorId: 'PF-USER-SEND', actorName: '郭送检员', roleName: '送检人员' },
  buyer: { actorId: 'PF-USER-BUYER', actorName: '陈买手', roleName: '买手' },
  qcA: { actorId: 'PF-USER-QC-A', actorName: '李质检员', roleName: 'QC质检员' },
  qcB: { actorId: 'PF-USER-QC-B', actorName: '王质检员', roleName: 'QC质检员' },
  qcSupervisor: { actorId: 'PF-USER-QC-MGR', actorName: '林质检主管', roleName: 'QC主管' },
  postOperator: { actorId: 'PF-USER-POST', actorName: '周后道操作员', roleName: '后道操作员' },
  postSupervisor: { actorId: 'PF-USER-POST-MGR', actorName: '吴后道主管', roleName: '后道主管' },
  recheckerA: { actorId: 'PF-USER-RC-A', actorName: '赵复检员', roleName: '复检员' },
  recheckerB: { actorId: 'PF-USER-RC-B', actorName: '钱复检员', roleName: '复检员' },
  warehouseReceiver: { actorId: 'PF-USER-WH', actorName: '孙仓库收货员', roleName: '仓库收货人员' },
} as const satisfies Record<string, PostFinishingActor>

export type PostFinishingSewingTaskType =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_TO_IRON_PACK'
  | 'CUTTING_TO_IRON_PACK'

export const POST_FINISHING_SEWING_TASK_TYPE_LABEL: Record<PostFinishingSewingTaskType, string> = {
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_TO_IRON_PACK: '车缝＋烫包',
  CUTTING_TO_IRON_PACK: '裁剪＋车缝＋烫包',
}

export interface PostFinishingAcceptanceSku {
  skuId: string
  skuCode: string
  spuCode: string
  spuName: string
  colorName: string
  sizeName: string
  imageUrl: string
  barcode: string
  plannedQty: number
  qtyUnit: '件'
}

export interface PostFinishingAcceptanceProductionOrder {
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  executionTaskId: string
  sewingTaskNo: string
  assignmentId: string
  sewingTaskType: PostFinishingSewingTaskType
  defaultStagingLocation: string
  sewingFactoryId: string
  sewingFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  skus: PostFinishingAcceptanceSku[]
}

export type PostFinishingDeliveryStatus =
  | '待后道确认'
  | '待二次点数'
  | '差异待授权'
  | '已确认待送检'
  | '已送检'
  | '已完成'

export interface PostFinishingFactoryReturnLine {
  sku: PostFinishingAcceptanceSku
  registeredQty: number
  firstCountQty?: number
  secondCountQty?: number
  confirmedQty?: number
  differenceQty?: number
  differenceRate?: number
}

export interface PostFinishingFactoryReturnDelivery {
  deliveryId: string
  deliveryOrderNo: string
  triggerSource: PostFinishingDeliveryTrigger
  idempotencyKey: string
  productionOrderId: string
  productionOrderNo: string
  executionTaskId: string
  sewingTaskNo: string
  assignmentId: string
  sewingTaskType: PostFinishingSewingTaskType
  returnIndex: number
  sewingFactoryId: string
  sewingFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  deliveryPersonName: string
  deliveryPersonPhone: string
  evidenceImageUrls: string[]
  registeredBy: PostFinishingActor
  registeredAt: string
  status: PostFinishingDeliveryStatus
  lines: PostFinishingFactoryReturnLine[]
  confirmedBy?: PostFinishingActor
  confirmedAt?: string
  lastCorrectedBy?: PostFinishingActor
  lastCorrectedAt?: string
  returnAuthorizationId?: string
  returnAuthorizedBy?: { authorizerId: string; authorizerName: string }
  qcTaskId?: string
  qcTaskNo?: string
}

export type PostFinishingWaitProcessWarehouseStatus = '待确认' | '待送检' | '已送检'

export interface PostFinishingWaitProcessWarehouseLine {
  sku: PostFinishingAcceptanceSku
  registeredQty: number
  confirmedQty: number
  availableQty: number
}

export interface PostFinishingWaitProcessWarehouseRecord {
  warehouseRecordId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  returnIndex: number
  sewingFactoryName: string
  areaName: '车缝回货暂存区'
  locationCode: string
  status: PostFinishingWaitProcessWarehouseStatus
  lines: PostFinishingWaitProcessWarehouseLine[]
  createdAt: string
  confirmedAt?: string
  confirmedBy?: PostFinishingActor
  sentAt?: string
  sentBy?: PostFinishingActor
}

export interface PostFinishingWaitProcessWarehouseMovement {
  movementId: string
  warehouseRecordId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  movementType: '确认入库' | '送检出库'
  quantities: Array<{ sku: PostFinishingAcceptanceSku; quantity: number }>
  operator: PostFinishingActor
  operatedAt: string
}

export interface PostFinishingReturnConfirmationLine {
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  registeredQty: number
  confirmedQty: number
}

export interface PostFinishingReturnConfirmationVersion {
  confirmationVersionId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  executionTaskId: string
  sewingTaskNo: string
  assignmentId: string
  factoryId: string
  factoryName: string
  sewingTaskType: PostFinishingSewingTaskType
  registeredQty: number
  confirmedQty: number
  confirmedAt: string
  versionCreatedAt: string
  confirmedBy: PostFinishingActor
  versionKind: 'FINAL_CONFIRMATION' | 'AUTHORIZED_CORRECTION'
  correctionReason?: string
  status: 'ACTIVE' | 'SUPERSEDED'
  supersedesVersionId?: string
  supersededAt?: string
  supersededByVersionId?: string
  lines: PostFinishingReturnConfirmationLine[]
}

export interface PostFinishingQualityResultLine {
  sku: PostFinishingAcceptanceSku
  expectedQty: number
  passedQty: number
  defectQty: number
  returnQty: number
  defectReason?: string
  defectImageUrl?: string
  responsibleParty?: string
  returnReason?: string
  returnReceiver?: string
}

export type PostFinishingQcTaskStatus = '待质检' | '质检中' | '质检完成'

export interface PostFinishingQcTask {
  qcTaskId: string
  qcTaskNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  returnIndex: number
  status: PostFinishingQcTaskStatus
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  referenceIds: string[]
  sentBy: PostFinishingActor
  sentAt: string
  claimedBy?: PostFinishingActor
  claimedAt?: string
  releasedAt?: string
  releaseReason?: string
  results?: PostFinishingQualityResultLine[]
  needPostFinishing?: boolean
  completedAt?: string
  qcAuthorizationId?: string
  qcAuthorizedBy?: { authorizerId: string; authorizerName: string }
  postTaskId?: string
  postTaskNo?: string
  recheckOrderId?: string
  recheckOrderNo?: string
}

export interface PostFinishingPostResultLine {
  sku: PostFinishingAcceptanceSku
  expectedQty: number
  passedQty: number
  defectQty: number
  returnQty: number
  defectReason?: string
  defectImageUrl?: string
  responsibleParty?: string
  returnReason?: string
  returnReceiver?: string
}

export type PostFinishingPostTaskStatus = '待后道' | '后道中' | '后道完成'

export interface PostFinishingPostTask {
  postTaskId: string
  postTaskNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  qcTaskId: string
  qcTaskNo: string
  returnIndex: number
  status: PostFinishingPostTaskStatus
  processItems: string[]
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  startedBy?: PostFinishingActor
  startedAt?: string
  results?: PostFinishingPostResultLine[]
  completedAt?: string
  postAuthorizationId?: string
  postAuthorizedBy?: { authorizerId: string; authorizerName: string }
  recheckOrderId?: string
  recheckOrderNo?: string
}

export type PostFinishingBarcodeStatus = '待扫描' | '正确' | '错误待重贴' | '已重贴待复扫'

export interface PostFinishingBarcodeEvent {
  eventId: string
  action: '扫描正确' | '扫描错误' | '重新贴码' | '复扫正确'
  scannedBarcode?: string
  expectedBarcode: string
  operator: PostFinishingActor
  operatedAt: string
}

export interface PostFinishingRecheckLine {
  sku: PostFinishingAcceptanceSku
  expectedQty: number
  passedQty?: number
  defectQty?: number
  barcodeStatus: PostFinishingBarcodeStatus
  lastScannedBarcode?: string
  barcodeEvents: PostFinishingBarcodeEvent[]
}

export type PostFinishingRecheckStatus = '待复检' | '复检中' | '条码异常待重贴' | '复检完成'

export interface PostFinishingRecheckOrder {
  recheckOrderId: string
  recheckOrderNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  qcTaskId: string
  qcTaskNo: string
  postTaskId?: string
  postTaskNo?: string
  returnIndex: number
  status: PostFinishingRecheckStatus
  lines: PostFinishingRecheckLine[]
  claimedBy?: PostFinishingActor
  claimedAt?: string
  releasedAt?: string
  releaseReason?: string
  completedAt?: string
  recheckAuthorizationId?: string
  recheckAuthorizedBy?: { authorizerId: string; authorizerName: string }
  outboundOrderId?: string
  outboundOrderNo?: string
}

export type PostFinishingOutboundStatus = '待仓库接收' | '已接收入库'

export interface PostFinishingOutboundLine {
  sku: PostFinishingAcceptanceSku
  outboundQty: number
  receivedQty?: number
}

export interface PostFinishingOutboundOrder {
  outboundOrderId: string
  outboundOrderNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  qcTaskId: string
  qcTaskNo: string
  postTaskId?: string
  postTaskNo?: string
  recheckOrderId: string
  recheckOrderNo: string
  returnIndex: number
  status: PostFinishingOutboundStatus
  lines: PostFinishingOutboundLine[]
  createdAt: string
  receivedAt?: string
  receivedBy?: PostFinishingActor
  warehouseAuthorizationId?: string
  warehouseAuthorizedBy?: { authorizerId: string; authorizerName: string }
  warehouseDifferenceReason?: string
}

export interface PostFinishingWarehouseReceipt {
  receiptId: string
  outboundOrderId: string
  outboundOrderNo: string
  productionOrderNo: string
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number; receivedQty: number }>
  receivedBy: PostFinishingActor
  receivedAt: string
  authorizationId?: string
  differenceReason?: string
}

export interface PostFinishingDefectRecord {
  defectId: string
  discoveryStage: '质检' | '后道'
  sourceObjectId: string
  sourceObjectNo: string
  deliveryOrderNo: string
  productionOrderNo: string
  sku: PostFinishingAcceptanceSku
  defectQty: number
  defectReason: string
  evidenceImageUrl?: string
  responsibleParty?: string
  dispositionStatus: '待处理'
  recordedBy: PostFinishingActor
  recordedAt: string
}

interface PostFinishingFullFlowState {
  deliveries: PostFinishingFactoryReturnDelivery[]
  waitProcessWarehouseRecords: PostFinishingWaitProcessWarehouseRecord[]
  waitProcessWarehouseMovements: PostFinishingWaitProcessWarehouseMovement[]
  returnConfirmationVersions: PostFinishingReturnConfirmationVersion[]
  qcTasks: PostFinishingQcTask[]
  postTasks: PostFinishingPostTask[]
  recheckOrders: PostFinishingRecheckOrder[]
  outboundOrders: PostFinishingOutboundOrder[]
  warehouseReceipts: PostFinishingWarehouseReceipt[]
  defects: PostFinishingDefectRecord[]
}

export type PostFinishingFlowGateCode =
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INVALID_QUANTITY'
  | 'SECOND_COUNT_REQUIRED'
  | 'AUTHORIZATION_REQUIRED'
  | 'CLAIM_CONFLICT'
  | 'NOT_CLAIM_OWNER'
  | 'BARCODE_BLOCKED'
  | 'DEFECT_REASON_REQUIRED'

export class PostFinishingFlowGateError extends Error {
  public readonly code: PostFinishingFlowGateCode

  constructor(code: PostFinishingFlowGateCode, message: string) {
    super(message)
    this.code = code
    this.name = 'PostFinishingFlowGateError'
  }
}

export interface PostFinishingAuthorizationInput {
  scanValue: string
  differenceReason: string
  nowMs?: number
}

const STORAGE_KEY = 'higood-fcs-post-finishing-full-flow-v1'
export const POST_FINISHING_DEMO_MODE_STORAGE_KEY = 'higood-fcs-post-finishing-demo-mode-v1'
const RETURN_TOLERANCE_RATE = 0.05
export const POST_FINISHING_RETURN_DIFFERENCE_POLICY = Object.freeze({
  toleranceRate: RETURN_TOLERANCE_RATE,
  denominator: '工厂登记数量' as const,
  frontlineEditable: false,
})

export const POST_FINISHING_DEFECT_REASON_OPTIONS = Object.freeze([
  '色差',
  '尺寸偏差',
  '污渍',
  '压痕',
  '破损',
  '车缝不良',
  '其他',
] as const)

const COLORS = ['黑色', '白色', '雾蓝', '卡其', '酒红']
const SIZES = ['S', 'M', 'L', 'XL', '2XL']
const ORDER_SEEDS = [
  { no: 'PO-QC-202608-001', styleNo: 'HG-QC-001', styleName: '后道验收衬衫', imageUrl: '/shirt-sample.jpg', spuCode: 'SPU-QC-001' },
  { no: 'PO-QC-202608-002', styleNo: 'HG-QC-002', styleName: '后道验收连衣裙', imageUrl: '/dress-sample-1.jpg', spuCode: 'SPU-QC-002' },
  { no: 'PO-QC-202608-003', styleNo: 'HG-QC-003', styleName: '后道验收外套', imageUrl: '/jacket-sample.jpg', spuCode: 'SPU-QC-003' },
] as const

const SEWING_FACTORY_SEEDS = [
  { factoryId: 'ID-F021', factoryName: 'CV Micro Sewing Jakarta Pusat' },
  { factoryId: 'ID-F022', factoryName: 'CV Micro Sewing Bandung Utara' },
  { factoryId: 'ID-F024', factoryName: 'CV Micro Sewing Semarang Timur' },
] as const

const SEWING_TASK_TYPE_SEEDS: PostFinishingSewingTaskType[] = [
  'INDEPENDENT_SEWING',
  'SEWING_TO_IRON_PACK',
  'CUTTING_TO_IRON_PACK',
]

export const POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS: PostFinishingAcceptanceProductionOrder[] = ORDER_SEEDS.map((seed, orderIndex) => ({
  productionOrderId: `PF-ACCEPT-PO-${orderIndex + 1}`,
  productionOrderNo: seed.no,
  styleNo: seed.styleNo,
  styleName: seed.styleName,
  executionTaskId: `PF-SEW-EXEC-${String(orderIndex + 1).padStart(3, '0')}`,
  sewingTaskNo: `SEW-TASK-QC-${String(orderIndex + 1).padStart(3, '0')}`,
  assignmentId: `PF-SEW-ASG-${String(orderIndex + 1).padStart(3, '0')}`,
  sewingTaskType: SEWING_TASK_TYPE_SEEDS[orderIndex],
  defaultStagingLocation: `后道待确认区-${String.fromCharCode(65 + orderIndex)}`,
  sewingFactoryId: SEWING_FACTORY_SEEDS[orderIndex].factoryId,
  sewingFactoryName: SEWING_FACTORY_SEEDS[orderIndex].factoryName,
  managedPostFactoryId: 'ID-F002',
  managedPostFactoryName: 'PT Prima Printing Center',
  skus: SIZES.map((sizeName, skuIndex) => ({
    skuId: `${seed.spuCode}-${sizeName}`,
    skuCode: `${seed.spuCode}-${String(skuIndex + 1).padStart(2, '0')}`,
    spuCode: seed.spuCode,
    spuName: seed.styleName,
    colorName: COLORS[skuIndex],
    sizeName,
    imageUrl: seed.imageUrl,
    barcode: `SKU-${orderIndex + 1}${String(skuIndex + 1).padStart(2, '0')}-202608`,
    plannedQty: 100,
    qtyUnit: '件',
  })),
}))

function emptyState(): PostFinishingFullFlowState {
  return {
    deliveries: [],
    waitProcessWarehouseRecords: [],
    waitProcessWarehouseMovements: [],
    returnConfirmationVersions: [],
    qcTasks: [],
    postTasks: [],
    recheckOrders: [],
    outboundOrders: [],
    warehouseReceipts: [],
    defects: [],
  }
}

function backfillDeliveryExecutionIdentity(delivery: PostFinishingFactoryReturnDelivery): PostFinishingFactoryReturnDelivery {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === delivery.productionOrderNo)
  if (!order) return delivery
  return {
    ...delivery,
    executionTaskId: delivery.executionTaskId || order.executionTaskId,
    sewingTaskNo: delivery.sewingTaskNo || order.sewingTaskNo,
    assignmentId: delivery.assignmentId || order.assignmentId,
    sewingTaskType: delivery.sewingTaskType || order.sewingTaskType,
    sewingFactoryId: order.sewingFactoryId,
    sewingFactoryName: order.sewingFactoryName,
  }
}

function deriveLegacyConfirmationVersions(deliveries: PostFinishingFactoryReturnDelivery[]): PostFinishingReturnConfirmationVersion[] {
  return deliveries.filter((delivery) => delivery.confirmedAt && delivery.confirmedBy).map((delivery) => ({
    confirmationVersionId: `PF-RET-CONF-LEGACY-${delivery.deliveryId}`,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderId: delivery.productionOrderId,
    productionOrderNo: delivery.productionOrderNo,
    executionTaskId: delivery.executionTaskId,
    sewingTaskNo: delivery.sewingTaskNo,
    assignmentId: delivery.assignmentId,
    factoryId: delivery.sewingFactoryId,
    factoryName: delivery.sewingFactoryName,
    sewingTaskType: delivery.sewingTaskType,
    registeredQty: total(delivery.lines.map((line) => line.registeredQty)),
    confirmedQty: total(delivery.lines.map((line) => line.confirmedQty || 0)),
    confirmedAt: delivery.confirmedAt!,
    versionCreatedAt: delivery.confirmedAt!,
    confirmedBy: { ...delivery.confirmedBy! },
    versionKind: 'FINAL_CONFIRMATION',
    status: 'ACTIVE',
    lines: delivery.lines.map((line) => ({
      skuId: line.sku.skuId,
      skuCode: line.sku.skuCode,
      colorName: line.sku.colorName,
      sizeName: line.sku.sizeName,
      registeredQty: line.registeredQty,
      confirmedQty: line.confirmedQty || 0,
    })),
  }))
}

function readPersistedState(): PostFinishingFullFlowState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<PostFinishingFullFlowState>
    const deliveries = (Array.isArray(parsed.deliveries) ? parsed.deliveries : []).map(backfillDeliveryExecutionIdentity)
    return {
      deliveries,
      waitProcessWarehouseRecords: Array.isArray(parsed.waitProcessWarehouseRecords) ? parsed.waitProcessWarehouseRecords : [],
      waitProcessWarehouseMovements: Array.isArray(parsed.waitProcessWarehouseMovements) ? parsed.waitProcessWarehouseMovements : [],
      returnConfirmationVersions: Array.isArray(parsed.returnConfirmationVersions)
        ? parsed.returnConfirmationVersions.map((version) => ({
            ...version,
            versionCreatedAt: version.versionCreatedAt || version.confirmedAt,
          }))
        : deriveLegacyConfirmationVersions(deliveries),
      qcTasks: Array.isArray(parsed.qcTasks) ? parsed.qcTasks : [],
      postTasks: Array.isArray(parsed.postTasks) ? parsed.postTasks : [],
      recheckOrders: Array.isArray(parsed.recheckOrders) ? parsed.recheckOrders : [],
      outboundOrders: Array.isArray(parsed.outboundOrders) ? parsed.outboundOrders : [],
      warehouseReceipts: Array.isArray(parsed.warehouseReceipts) ? parsed.warehouseReceipts : [],
      defects: Array.isArray(parsed.defects) ? parsed.defects : [],
    }
  } catch {
    return emptyState()
  }
}

let state = readPersistedState()

function persist(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 原型无 localStorage 时保留运行期业务事实。
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowIso(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString()
}

function assertIntegerQuantity(value: number, options: { strictlyPositive?: boolean; label: string }): void {
  const minimum = options.strictlyPositive ? 1 : 0
  if (!Number.isInteger(value) || value < minimum) {
    throw new PostFinishingFlowGateError(
      'INVALID_QUANTITY',
      `${options.label}必须是${options.strictlyPositive ? '大于 0 的' : '不小于 0 的'}整数件数。`,
    )
  }
}

function total(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function differenceDirection(value: number): '多' | '少' | '一致' {
  if (value > 0) return '多'
  if (value < 0) return '少'
  return '一致'
}

function buildWaitProcessWarehouseRecord(
  delivery: PostFinishingFactoryReturnDelivery,
): PostFinishingWaitProcessWarehouseRecord {
  const hasConfirmed = Boolean(delivery.confirmedAt)
  const hasSent = Boolean(delivery.qcTaskNo)
  return {
    warehouseRecordId: `PF-WPW-${delivery.deliveryId}`,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    returnIndex: delivery.returnIndex,
    sewingFactoryName: delivery.sewingFactoryName,
    areaName: '车缝回货暂存区',
    locationCode: `WP-${delivery.productionOrderId}-${delivery.returnIndex}`,
    status: hasSent ? '已送检' : hasConfirmed ? '待送检' : '待确认',
    lines: delivery.lines.map((line) => ({
      sku: clone(line.sku),
      registeredQty: line.registeredQty,
      confirmedQty: line.confirmedQty || 0,
      availableQty: hasConfirmed && !hasSent ? line.confirmedQty || 0 : 0,
    })),
    createdAt: delivery.registeredAt,
    confirmedAt: delivery.confirmedAt,
    confirmedBy: delivery.confirmedBy ? clone(delivery.confirmedBy) : undefined,
  }
}

function getOrCreateWaitProcessWarehouseRecord(
  delivery: PostFinishingFactoryReturnDelivery,
): PostFinishingWaitProcessWarehouseRecord {
  const existing = state.waitProcessWarehouseRecords.find((item) => item.deliveryId === delivery.deliveryId)
  if (existing) return existing
  const created = buildWaitProcessWarehouseRecord(delivery)
  state.waitProcessWarehouseRecords.push(created)
  return created
}

function appendWaitProcessWarehouseMovement(input: {
  record: PostFinishingWaitProcessWarehouseRecord
  movementType: PostFinishingWaitProcessWarehouseMovement['movementType']
  operator: PostFinishingActor
  operatedAt: string
}): PostFinishingWaitProcessWarehouseMovement {
  const existing = state.waitProcessWarehouseMovements.find((item) => (
    item.warehouseRecordId === input.record.warehouseRecordId && item.movementType === input.movementType
  ))
  if (existing) return existing
  const movement: PostFinishingWaitProcessWarehouseMovement = {
    movementId: `PF-WPM-${String(state.waitProcessWarehouseMovements.length + 1).padStart(6, '0')}`,
    warehouseRecordId: input.record.warehouseRecordId,
    deliveryId: input.record.deliveryId,
    deliveryOrderNo: input.record.deliveryOrderNo,
    productionOrderNo: input.record.productionOrderNo,
    movementType: input.movementType,
    quantities: input.record.lines.map((line) => ({
      sku: clone(line.sku),
      quantity: line.confirmedQty,
    })),
    operator: clone(input.operator),
    operatedAt: input.operatedAt,
  }
  state.waitProcessWarehouseMovements.push(movement)
  return movement
}

function backfillWaitProcessWarehouseFacts(): void {
  state.deliveries.forEach((delivery) => {
    const record = getOrCreateWaitProcessWarehouseRecord(delivery)
    if (delivery.confirmedAt && delivery.confirmedBy) {
      appendWaitProcessWarehouseMovement({
        record,
        movementType: '确认入库',
        operator: delivery.confirmedBy,
        operatedAt: delivery.confirmedAt,
      })
    }
    const qcTask = state.qcTasks.find((task) => task.deliveryId === delivery.deliveryId)
    if (qcTask) {
      record.status = '已送检'
      record.sentAt = qcTask.sentAt
      record.sentBy = clone(qcTask.sentBy)
      record.lines.forEach((line) => { line.availableQty = 0 })
      appendWaitProcessWarehouseMovement({
        record,
        movementType: '送检出库',
        operator: qcTask.sentBy,
        operatedAt: qcTask.sentAt,
      })
    }
  })
}

function appendReturnConfirmationVersion(input: {
  delivery: PostFinishingFactoryReturnDelivery
  confirmedAt: string
  versionCreatedAt?: string
  confirmedBy: PostFinishingActor
  versionKind: PostFinishingReturnConfirmationVersion['versionKind']
  correctionReason?: string
}): PostFinishingReturnConfirmationVersion {
  const current = state.returnConfirmationVersions.find((version) => (
    version.deliveryId === input.delivery.deliveryId && version.status === 'ACTIVE'
  ))
  const confirmationVersionId = `PF-RET-CONF-${input.delivery.deliveryId}-${String(
    state.returnConfirmationVersions.filter((version) => version.deliveryId === input.delivery.deliveryId).length + 1,
  ).padStart(3, '0')}`
  const versionCreatedAt = input.versionCreatedAt || input.confirmedAt
  if (current) {
    current.status = 'SUPERSEDED'
    current.supersededAt = versionCreatedAt
    current.supersededByVersionId = confirmationVersionId
  }
  const version: PostFinishingReturnConfirmationVersion = {
    confirmationVersionId,
    deliveryId: input.delivery.deliveryId,
    deliveryOrderNo: input.delivery.deliveryOrderNo,
    productionOrderId: input.delivery.productionOrderId,
    productionOrderNo: input.delivery.productionOrderNo,
    executionTaskId: input.delivery.executionTaskId,
    sewingTaskNo: input.delivery.sewingTaskNo,
    assignmentId: input.delivery.assignmentId,
    factoryId: input.delivery.sewingFactoryId,
    factoryName: input.delivery.sewingFactoryName,
    sewingTaskType: input.delivery.sewingTaskType,
    registeredQty: total(input.delivery.lines.map((line) => line.registeredQty)),
    confirmedQty: total(input.delivery.lines.map((line) => line.confirmedQty || 0)),
    confirmedAt: input.confirmedAt,
    versionCreatedAt,
    confirmedBy: clone(input.confirmedBy),
    versionKind: input.versionKind,
    correctionReason: input.correctionReason?.trim() || undefined,
    status: 'ACTIVE',
    supersedesVersionId: current?.confirmationVersionId,
    lines: input.delivery.lines.map((line) => ({
      skuId: line.sku.skuId,
      skuCode: line.sku.skuCode,
      colorName: line.sku.colorName,
      sizeName: line.sku.sizeName,
      registeredQty: line.registeredQty,
      confirmedQty: line.confirmedQty || 0,
    })),
  }
  state.returnConfirmationVersions.push(version)
  return clone(version)
}

function getProductionOrder(productionOrderNo: string): PostFinishingAcceptanceProductionOrder {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === productionOrderNo)
  if (!order) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到生产单 ${productionOrderNo}。`)
  return order
}

function findDelivery(deliveryIdOrNo: string): PostFinishingFactoryReturnDelivery {
  const delivery = state.deliveries.find((item) => item.deliveryId === deliveryIdOrNo || item.deliveryOrderNo === deliveryIdOrNo)
  if (!delivery) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到送货单 ${deliveryIdOrNo}。`)
  return delivery
}

function findQcTask(qcTaskIdOrNo: string): PostFinishingQcTask {
  const task = state.qcTasks.find((item) => item.qcTaskId === qcTaskIdOrNo || item.qcTaskNo === qcTaskIdOrNo)
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到质检任务 ${qcTaskIdOrNo}。`)
  return task
}

function findPostTask(postTaskIdOrNo: string): PostFinishingPostTask {
  const task = state.postTasks.find((item) => item.postTaskId === postTaskIdOrNo || item.postTaskNo === postTaskIdOrNo)
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到后道任务 ${postTaskIdOrNo}。`)
  return task
}

function findRecheck(recheckIdOrNo: string): PostFinishingRecheckOrder {
  const record = state.recheckOrders.find((item) => item.recheckOrderId === recheckIdOrNo || item.recheckOrderNo === recheckIdOrNo)
  if (!record) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到复检单 ${recheckIdOrNo}。`)
  return record
}

function findOutbound(outboundIdOrNo: string): PostFinishingOutboundOrder {
  const record = state.outboundOrders.find((item) => item.outboundOrderId === outboundIdOrNo || item.outboundOrderNo === outboundIdOrNo)
  if (!record) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到后道出货单 ${outboundIdOrNo}。`)
  return record
}

function relationForDelivery(delivery: PostFinishingFactoryReturnDelivery) {
  const qcTask = delivery.qcTaskId ? state.qcTasks.find((item) => item.qcTaskId === delivery.qcTaskId) : undefined
  const postTask = qcTask?.postTaskId ? state.postTasks.find((item) => item.postTaskId === qcTask.postTaskId) : undefined
  const recheck = (postTask?.recheckOrderId || qcTask?.recheckOrderId)
    ? state.recheckOrders.find((item) => item.recheckOrderId === (postTask?.recheckOrderId || qcTask?.recheckOrderId))
    : undefined
  const outbound = recheck?.outboundOrderId ? state.outboundOrders.find((item) => item.outboundOrderId === recheck.outboundOrderId) : undefined
  return { qcTask, postTask, recheck, outbound }
}

function appendBusinessLog(input: {
  stage: PostFinishingFullFlowStage
  delivery: PostFinishingFactoryReturnDelivery
  objectType: string
  objectId: string
  objectNo: string
  action: string
  actor: PostFinishingActor
  operatedAt: string
  beforeStatus?: string
  afterStatus?: string
  beforeQuantity?: number
  afterQuantity?: number
  differenceQuantity?: number
  differenceReason?: string
  authorization?: PostFinishingAuthorizationConsumption
  result?: '成功' | '失败' | '阻断'
  remark?: string
}): void {
  const relation = relationForDelivery(input.delivery)
  appendPostFinishingOperationLog({
    stage: input.stage,
    objectType: input.objectType,
    objectId: input.objectId,
    objectNo: input.objectNo,
    productionOrderNo: input.delivery.productionOrderNo,
    deliveryOrderNo: input.delivery.deliveryOrderNo,
    qcTaskNo: relation.qcTask?.qcTaskNo,
    postTaskNo: relation.postTask?.postTaskNo,
    recheckOrderNo: relation.recheck?.recheckOrderNo,
    outboundOrderNo: relation.outbound?.outboundOrderNo,
    action: input.action,
    operatorId: input.actor.actorId,
    operatorName: input.actor.actorName,
    operatedAt: input.operatedAt,
    beforeStatus: input.beforeStatus,
    afterStatus: input.afterStatus,
    beforeQuantity: input.beforeQuantity,
    afterQuantity: input.afterQuantity,
    differenceQuantity: input.differenceQuantity,
    differenceDirection: input.differenceQuantity === undefined ? undefined : differenceDirection(input.differenceQuantity),
    differenceReason: input.differenceReason,
    authorizerId: input.authorization?.authorizerId,
    authorizerName: input.authorization?.authorizerName,
    result: input.result || '成功',
    remark: input.remark,
  })
}

function consumeRequiredAuthorization(input: {
  stage: PostFinishingAuthorizationStage
  delivery: PostFinishingFactoryReturnDelivery
  objectId: string
  objectNo: string
  actor: PostFinishingActor
  quantities: Array<{ skuId: string; expectedQty: number; actualQty: number }>
  authorization?: PostFinishingAuthorizationInput
  operatedAt: string
}): PostFinishingAuthorizationConsumption {
  if (!input.authorization) {
    appendBusinessLog({
      stage: '授权', delivery: input.delivery, objectType: input.stage, objectId: input.objectId, objectNo: input.objectNo,
      action: '差异授权', actor: input.actor, operatedAt: input.operatedAt, result: '阻断', remark: '缺少授权码',
    })
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', `${input.stage}存在数量差异，必须扫描动态授权码。`)
  }
  const fingerprint = buildPostFinishingDifferenceFingerprint({
    stage: input.stage,
    businessObjectId: input.objectId,
    quantities: input.quantities,
    reason: input.authorization.differenceReason,
  })
  try {
    const consumed = consumePostFinishingAuthorization({
      scanValue: input.authorization.scanValue,
      stage: input.stage,
      businessObjectId: input.objectId,
      businessObjectNo: input.objectNo,
      differenceFingerprint: fingerprint,
      differenceReason: input.authorization.differenceReason,
      operatorId: input.actor.actorId,
      operatorName: input.actor.actorName,
      nowMs: input.authorization.nowMs,
    })
    appendBusinessLog({
      stage: '授权', delivery: input.delivery, objectType: input.stage, objectId: input.objectId, objectNo: input.objectNo,
      action: '差异授权', actor: input.actor, operatedAt: input.operatedAt, authorization: consumed,
      differenceReason: input.authorization.differenceReason, result: '成功',
    })
    return consumed
  } catch (error) {
    appendBusinessLog({
      stage: '授权', delivery: input.delivery, objectType: input.stage, objectId: input.objectId, objectNo: input.objectNo,
      action: '差异授权', actor: input.actor, operatedAt: input.operatedAt, result: '失败',
      differenceReason: input.authorization.differenceReason,
      remark: error instanceof Error ? error.message : '授权失败',
    })
    if (error instanceof PostFinishingAuthorizationError) throw error
    throw new Error('授权失败。')
  }
}

export function getPostFinishingReturnSourceScanValue(productionOrderNo: string, returnIndex: number): string {
  return `PFRETURN:${productionOrderNo}:${returnIndex}`
}

export function resolvePostFinishingReturnRegistrationSource(scanValue: string): {
  productionOrder: PostFinishingAcceptanceProductionOrder
  returnIndex: number
} {
  const match = scanValue.trim().match(/^PFRETURN:(PO-QC-202608-00[1-3]):([1-5])$/)
  if (!match) throw new PostFinishingFlowGateError('NOT_FOUND', '未识别到完整回货来源码，请重新扫描。')
  return { productionOrder: clone(getProductionOrder(match[1])), returnIndex: Number(match[2]) }
}

export function listPostFinishingReturnRegistrationSources(): Array<{
  scanValue: string
  productionOrderNo: string
  returnIndex: number
  skuCount: number
}> {
  return POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.flatMap((order) => [1, 2, 3, 4, 5].map((returnIndex) => ({
    scanValue: getPostFinishingReturnSourceScanValue(order.productionOrderNo, returnIndex),
    productionOrderNo: order.productionOrderNo,
    returnIndex,
    skuCount: order.skus.length,
  })))
}

export function registerPostFinishingFactoryReturn(input: {
  productionOrderNo: string
  returnIndex: number
  triggerSource: PostFinishingDeliveryTrigger
  idempotencyKey: string
  quantities: Array<{ skuId: string; registeredQty: number }>
  deliveryPersonName: string
  deliveryPersonPhone: string
  evidenceImageUrls: string[]
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  if (!input.actor.roleName.trim() || /PPIC/i.test(input.actor.roleName) || !/(车缝厂送货人员|工厂|factory)/i.test(input.actor.roleName)) {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '回货登记只能由车缝工厂送货人员或已登录工厂账号发起，PPIC只能读取后道回货结果。')
  }
  const order = getProductionOrder(input.productionOrderNo)
  if (!Number.isInteger(input.returnIndex) || input.returnIndex < 1 || input.returnIndex > 5) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '回货序号必须是 1 至 5。')
  }
  if (!input.deliveryPersonName.trim()) throw new Error('请填写送货人姓名。')
  if (!input.evidenceImageUrls.length) throw new Error('请上传至少一张现场凭证图片。')
  const existing = state.deliveries.find((item) => item.idempotencyKey === input.idempotencyKey)
  if (existing) return clone(existing)
  const duplicateReturn = state.deliveries.find((item) => item.productionOrderNo === input.productionOrderNo && item.returnIndex === input.returnIndex)
  if (duplicateReturn) return clone(duplicateReturn)
  const lines = order.skus.map((sku) => {
    const quantity = input.quantities.find((item) => item.skuId === sku.skuId)?.registeredQty
    assertIntegerQuantity(Number(quantity), { strictlyPositive: true, label: `SKU ${sku.skuCode} 回货登记数量` })
    return { sku: clone(sku), registeredQty: Number(quantity) }
  })
  const now = nowIso(input.nowMs)
  const deliveryId = `PF-DEL-${order.productionOrderId}-${input.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'DELIVERY',
    productionOrderNo: input.productionOrderNo,
    sourceObjectId: deliveryId,
    idempotencyKey: `DELIVERY:${input.idempotencyKey}`,
    sequence: input.returnIndex,
    triggerSource: input.triggerSource,
  }, new Date(input.nowMs ?? Date.now()))
  const delivery: PostFinishingFactoryReturnDelivery = {
    deliveryId,
    deliveryOrderNo: number.documentNo,
    triggerSource: input.triggerSource,
    idempotencyKey: input.idempotencyKey,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    executionTaskId: order.executionTaskId,
    sewingTaskNo: order.sewingTaskNo,
    assignmentId: order.assignmentId,
    sewingTaskType: order.sewingTaskType,
    returnIndex: input.returnIndex,
    sewingFactoryId: order.sewingFactoryId,
    sewingFactoryName: order.sewingFactoryName,
    managedPostFactoryId: order.managedPostFactoryId,
    managedPostFactoryName: order.managedPostFactoryName,
    deliveryPersonName: input.deliveryPersonName.trim(),
    deliveryPersonPhone: input.deliveryPersonPhone.trim(),
    evidenceImageUrls: [...input.evidenceImageUrls],
    registeredBy: clone(input.actor),
    registeredAt: now,
    status: '待后道确认',
    lines,
  }
  state.deliveries.push(delivery)
  getOrCreateWaitProcessWarehouseRecord(delivery)
  persist()
  appendBusinessLog({
    stage: '送货登记', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
    action: '工厂登记回货', actor: input.actor, operatedAt: now, afterStatus: delivery.status,
    afterQuantity: total(lines.map((line) => line.registeredQty)), remark: `${input.triggerSource}；5 个 SKU`,
  })
  return clone(delivery)
}

export function confirmPostFinishingFactoryReturn(input: {
  deliveryId: string
  firstCounts: Array<{ skuId: string; actualQty: number }>
  secondCounts?: Array<{ skuId: string; actualQty: number }>
  actor: PostFinishingActor
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  if (!/回货确认/.test(input.actor.roleName) || /PPIC/i.test(input.actor.roleName)) {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '回货最终确认只能由后道回货确认岗位完成，PPIC不得填写或确认回货数量。')
  }
  const delivery = findDelivery(input.deliveryId)
  if (!['待后道确认', '待二次点数', '差异待授权'].includes(delivery.status)) {
    if (delivery.status === '已确认待送检') return clone(delivery)
    throw new PostFinishingFlowGateError('INVALID_STATUS', `送货单当前为${delivery.status}，不能重复确认回货。`)
  }
  const now = nowIso(input.nowMs)
  const firstCounts = delivery.lines.map((line) => {
    const actualQty = Number(input.firstCounts.find((item) => item.skuId === line.sku.skuId)?.actualQty)
    assertIntegerQuantity(actualQty, { label: `SKU ${line.sku.skuCode} 第一次点数` })
    return { skuId: line.sku.skuId, actualQty }
  })
  const firstRequiresSecondCount = delivery.lines.some((line) => {
    const actualQty = firstCounts.find((item) => item.skuId === line.sku.skuId)!.actualQty
    return Math.abs(actualQty - line.registeredQty) / line.registeredQty > RETURN_TOLERANCE_RATE
  })
  delivery.lines.forEach((line) => {
    line.firstCountQty = firstCounts.find((item) => item.skuId === line.sku.skuId)!.actualQty
  })
  appendBusinessLog({
    stage: '回货确认', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
    action: '第一次点数', actor: input.actor, operatedAt: now,
    beforeQuantity: total(delivery.lines.map((line) => line.registeredQty)),
    afterQuantity: total(firstCounts.map((line) => line.actualQty)),
    differenceQuantity: total(firstCounts.map((line) => line.actualQty)) - total(delivery.lines.map((line) => line.registeredQty)),
  })

  if (firstRequiresSecondCount && !input.secondCounts) {
    delivery.status = '待二次点数'
    persist()
    appendBusinessLog({
      stage: '回货确认', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
      action: '要求二次点数', actor: input.actor, operatedAt: now, afterStatus: delivery.status, result: '阻断',
      remark: '第一次点数逐 SKU 差异率超过 5%',
    })
    throw new PostFinishingFlowGateError('SECOND_COUNT_REQUIRED', '第一次点数逐 SKU 差异率超过 5%，请重新点数后再确认。')
  }

  const finalCounts = firstRequiresSecondCount
    ? delivery.lines.map((line) => {
        const actualQty = Number(input.secondCounts?.find((item) => item.skuId === line.sku.skuId)?.actualQty)
        assertIntegerQuantity(actualQty, { label: `SKU ${line.sku.skuCode} 第二次点数` })
        return { skuId: line.sku.skuId, actualQty }
      })
    : firstCounts

  if (firstRequiresSecondCount) {
    delivery.lines.forEach((line) => {
      line.secondCountQty = finalCounts.find((item) => item.skuId === line.sku.skuId)!.actualQty
    })
    appendBusinessLog({
      stage: '回货确认', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
      action: '第二次点数', actor: input.actor, operatedAt: now,
      beforeQuantity: total(delivery.lines.map((line) => line.registeredQty)),
      afterQuantity: total(finalCounts.map((line) => line.actualQty)),
      differenceQuantity: total(finalCounts.map((line) => line.actualQty)) - total(delivery.lines.map((line) => line.registeredQty)),
    })
  }

  delivery.lines.forEach((line) => {
    const actualQty = finalCounts.find((item) => item.skuId === line.sku.skuId)!.actualQty
    line.confirmedQty = actualQty
    line.differenceQty = actualQty - line.registeredQty
    line.differenceRate = Math.abs(actualQty - line.registeredQty) / line.registeredQty
  })
  const requiresAuthorization = delivery.lines.some((line) => (line.differenceRate || 0) > RETURN_TOLERANCE_RATE)
  let consumed: PostFinishingAuthorizationConsumption | undefined
  if (requiresAuthorization) {
    delivery.status = '差异待授权'
    persist()
    consumed = consumeRequiredAuthorization({
      stage: '回货确认', delivery, objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
      actor: input.actor, authorization: input.authorization, operatedAt: now,
      quantities: delivery.lines.map((line) => ({
        skuId: line.sku.skuId,
        expectedQty: line.registeredQty,
        actualQty: line.confirmedQty || 0,
      })),
    })
    delivery.returnAuthorizationId = consumed.authorizationId
    delivery.returnAuthorizedBy = { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
  }

  const beforeStatus = delivery.status
  delivery.status = '已确认待送检'
  delivery.confirmedBy = clone(input.actor)
  delivery.confirmedAt = now
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  warehouseRecord.status = '待送检'
  warehouseRecord.confirmedAt = now
  warehouseRecord.confirmedBy = clone(input.actor)
  warehouseRecord.lines = delivery.lines.map((line) => ({
    sku: clone(line.sku),
    registeredQty: line.registeredQty,
    confirmedQty: line.confirmedQty || 0,
    availableQty: line.confirmedQty || 0,
  }))
  appendWaitProcessWarehouseMovement({
    record: warehouseRecord,
    movementType: '确认入库',
    operator: input.actor,
    operatedAt: now,
  })
  appendReturnConfirmationVersion({
    delivery,
    confirmedAt: now,
    confirmedBy: input.actor,
    versionKind: 'FINAL_CONFIRMATION',
  })
  persist()
  appendBusinessLog({
    stage: '回货确认', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
    action: '最终确认回货', actor: input.actor, operatedAt: now, beforeStatus, afterStatus: delivery.status,
    beforeQuantity: total(delivery.lines.map((line) => line.registeredQty)),
    afterQuantity: total(delivery.lines.map((line) => line.confirmedQty || 0)),
    differenceQuantity: total(delivery.lines.map((line) => line.confirmedQty || 0)) - total(delivery.lines.map((line) => line.registeredQty)),
    differenceReason: input.authorization?.differenceReason,
    authorization: consumed,
  })
  return clone(delivery)
}

export function correctPostFinishingFactoryReturnConfirmation(input: {
  deliveryId: string
  correctedCounts: Array<{ skuId: string; actualQty: number }>
  correctionReason: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  const delivery = findDelivery(input.deliveryId)
  if (delivery.status !== '已确认待送检' || !delivery.confirmedAt) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有尚未送检的后道最终确认记录可以由回货主管订正。')
  }
  if (input.actor.roleName !== '后道回货主管') {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '后道最终确认数量只能由后道回货主管订正。')
  }
  const correctionReason = input.correctionReason.trim()
  if (!correctionReason) throw new Error('请填写后道回货订正原因。')
  const businessConfirmedAt = delivery.confirmedAt
  const beforeQuantity = total(delivery.lines.map((line) => line.confirmedQty || 0))
  delivery.lines.forEach((line) => {
    const actualQty = Number(input.correctedCounts.find((item) => item.skuId === line.sku.skuId)?.actualQty)
    assertIntegerQuantity(actualQty, { label: `SKU ${line.sku.skuCode} 订正确认数量` })
    line.confirmedQty = actualQty
    line.differenceQty = actualQty - line.registeredQty
    line.differenceRate = Math.abs(actualQty - line.registeredQty) / line.registeredQty
  })
  const correctedAt = nowIso(input.nowMs)
  delivery.lastCorrectedBy = clone(input.actor)
  delivery.lastCorrectedAt = correctedAt
  const version = appendReturnConfirmationVersion({
    delivery,
    confirmedAt: businessConfirmedAt,
    versionCreatedAt: correctedAt,
    confirmedBy: input.actor,
    versionKind: 'AUTHORIZED_CORRECTION',
    correctionReason,
  })
  persist()
  appendBusinessLog({
    stage: '回货确认', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
    action: '主管订正最终确认', actor: input.actor, operatedAt: correctedAt,
    beforeQuantity,
    afterQuantity: version.confirmedQty,
    differenceQuantity: version.confirmedQty - beforeQuantity,
    differenceReason: correctionReason,
    remark: `保留原确认版本；当前版本 ${version.confirmationVersionId}`,
  })
  return clone(delivery)
}

export function uploadPostFinishingDeliveryQcReference(input: {
  deliveryId: string
  referenceType: PostFinishingQcReferenceType
  title: string
  description: string
  imageUrl?: string
  source: PostFinishingQcReferenceSource
  sourceNote?: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingQcReferenceRecord {
  const delivery = findDelivery(input.deliveryId)
  if (!['已确认待送检', '已送检'].includes(delivery.status)) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '回货确认后才能上传本次质检参考资料。')
  }
  const record = uploadPostFinishingQcReference({
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    referenceType: input.referenceType,
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    source: input.source,
    sourceNote: input.sourceNote,
    uploaderId: input.actor.actorId,
    uploaderName: input.actor.actorName,
    uploadedAt: nowIso(input.nowMs),
  })
  appendBusinessLog({
    stage: '质检参考资料', delivery, objectType: '质检参考资料', objectId: record.referenceId, objectNo: record.title,
    action: input.source === 'QC代上传' ? 'QC代上传资料' : '买手上传资料', actor: input.actor,
    operatedAt: record.uploadedAt, remark: `${record.referenceType}；${record.sourceNote || record.source}`,
  })
  return record
}

export function uploadPostFinishingQcTaskReference(input: {
  qcTaskId: string
  referenceType: PostFinishingQcReferenceType
  title: string
  description: string
  imageUrl?: string
  sourceNote: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingQcReferenceRecord {
  const task = findQcTask(input.qcTaskId)
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '质检完成') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '已完成质检任务不能补写判断依据；历史资料保持原样。')
  }
  if (!input.actor.roleName.includes('QC') && !input.actor.roleName.includes('质检')) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前 QC 可以代上传本次质检参考资料。')
  }
  if (!task.claimedBy || task.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前领取该任务的 QC 可以代上传本次质检参考资料。')
  }
  const record = uploadPostFinishingQcReference({
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    qcTaskId: task.qcTaskId,
    qcTaskNo: task.qcTaskNo,
    referenceType: input.referenceType,
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    source: 'QC代上传',
    sourceNote: input.sourceNote,
    uploaderId: input.actor.actorId,
    uploaderName: input.actor.actorName,
    uploadedAt: nowIso(input.nowMs),
  })
  task.referenceIds.push(record.referenceId)
  persist()
  appendBusinessLog({
    stage: '质检参考资料', delivery, objectType: '质检参考资料', objectId: record.referenceId, objectNo: record.title,
    action: 'QC代上传任务资料', actor: input.actor, operatedAt: record.uploadedAt,
    remark: `${record.referenceType}；${record.sourceNote}`,
  })
  return record
}

export function sendPostFinishingFactoryReturnToQc(input: {
  deliveryId: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingQcTask {
  const delivery = findDelivery(input.deliveryId)
  if (delivery.qcTaskId) return clone(findQcTask(delivery.qcTaskId))
  if (delivery.status !== '已确认待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有已确认回货可以送检。')
  }
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  if (warehouseRecord.status !== '待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有后道待加工仓中的待送检库存可以发起送检。')
  }
  const now = nowIso(input.nowMs)
  const qcTaskId = `PF-QC-${delivery.productionOrderId}-${delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'QC',
    productionOrderNo: delivery.productionOrderNo,
    sourceObjectId: delivery.deliveryId,
    idempotencyKey: `QC:${delivery.deliveryId}`,
    sequence: delivery.returnIndex,
  }, new Date(input.nowMs ?? Date.now()))
  const task: PostFinishingQcTask = {
    qcTaskId,
    qcTaskNo: number.documentNo,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderId: delivery.productionOrderId,
    productionOrderNo: delivery.productionOrderNo,
    returnIndex: delivery.returnIndex,
    status: '待质检',
    lines: delivery.lines.map((line) => ({ sku: clone(line.sku), expectedQty: line.confirmedQty || 0 })),
    referenceIds: [],
    sentBy: clone(input.actor),
    sentAt: now,
  }
  const references = bindPostFinishingQcReferences({ deliveryId: delivery.deliveryId, qcTaskId, qcTaskNo: task.qcTaskNo })
  task.referenceIds = references.map((record) => record.referenceId)
  state.qcTasks.push(task)
  delivery.qcTaskId = task.qcTaskId
  delivery.qcTaskNo = task.qcTaskNo
  delivery.status = '已送检'
  warehouseRecord.status = '已送检'
  warehouseRecord.sentAt = now
  warehouseRecord.sentBy = clone(input.actor)
  warehouseRecord.lines.forEach((line) => { line.availableQty = 0 })
  appendWaitProcessWarehouseMovement({
    record: warehouseRecord,
    movementType: '送检出库',
    operator: input.actor,
    operatedAt: now,
  })
  persist()
  appendBusinessLog({
    stage: '送检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
    action: '从后道待加工仓送检出库', actor: input.actor, operatedAt: now, beforeStatus: '已确认待送检', afterStatus: task.status,
    afterQuantity: total(task.lines.map((line) => line.expectedQty)),
    remark: `确认入库数；绑定质检参考资料 ${task.referenceIds.length} 份`,
  })
  return clone(task)
}

export function claimPostFinishingQcTask(input: {
  qcTaskNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingQcTask {
  if (!input.actor.roleName.includes('QC') && !input.actor.roleName.includes('质检')) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '当前账号不是 QC 质检人员，不能领取质检任务。')
  }
  const exact = state.qcTasks.find((item) => item.qcTaskNo === input.qcTaskNo.trim())
  if (!exact) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整质检任务号，不提供模糊候选。')
  const delivery = findDelivery(exact.deliveryId)
  const now = nowIso(input.nowMs)
  if (exact.status === '质检完成') return clone(exact)
  if (exact.claimedBy && exact.claimedBy.actorId !== input.actor.actorId) {
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检任务', objectId: exact.qcTaskId, objectNo: exact.qcTaskNo,
      action: '输入任务号领取冲突', actor: input.actor, operatedAt: now, result: '阻断',
      remark: `已由${exact.claimedBy.actorName}质检中；领取时间${exact.claimedAt}`,
    })
    throw new PostFinishingFlowGateError(
      'CLAIM_CONFLICT',
      `该质检任务已由 ${exact.claimedBy.actorName} 质检中，领取时间 ${exact.claimedAt}。`,
    )
  }
  if (!exact.claimedBy) {
    exact.claimedBy = clone(input.actor)
    exact.claimedAt = now
    exact.status = '质检中'
    persist()
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检任务', objectId: exact.qcTaskId, objectNo: exact.qcTaskNo,
      action: '输入任务号领取质检', actor: input.actor, operatedAt: now, beforeStatus: '待质检', afterStatus: exact.status,
    })
  }
  return clone(exact)
}

export function releasePostFinishingQcTask(input: {
  qcTaskId: string
  actor: PostFinishingActor
  reason: string
  supervisor?: boolean
  nowMs?: number
}): PostFinishingQcTask {
  const task = findQcTask(input.qcTaskId)
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '质检完成') throw new PostFinishingFlowGateError('INVALID_STATUS', '已完成质检任务不能退领。')
  if (!task.claimedBy) return clone(task)
  if (task.claimedBy.actorId !== input.actor.actorId && !input.supervisor) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前质检员或 QC 主管可以退领。')
  }
  const beforeOwner = task.claimedBy.actorName
  const now = nowIso(input.nowMs)
  task.claimedBy = undefined
  task.claimedAt = undefined
  task.releasedAt = now
  task.releaseReason = input.reason.trim() || '错误领取'
  task.status = '待质检'
  task.results = undefined
  persist()
  appendBusinessLog({
    stage: '质检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
    action: '退领质检任务', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
    remark: `${beforeOwner}退领；${task.releaseReason}`,
  })
  return clone(task)
}

function createDefectRecords(input: {
  delivery: PostFinishingFactoryReturnDelivery
  discoveryStage: '质检' | '后道'
  sourceObjectId: string
  sourceObjectNo: string
  lines: Array<{
    sku: PostFinishingAcceptanceSku
    defectQty: number
    defectReason?: string
    defectImageUrl?: string
    responsibleParty?: string
  }>
  actor: PostFinishingActor
  recordedAt: string
}): void {
  input.lines.filter((line) => line.defectQty > 0).forEach((line) => {
    state.defects.push({
      defectId: `PF-DEF-${String(state.defects.length + 1).padStart(6, '0')}`,
      discoveryStage: input.discoveryStage,
      sourceObjectId: input.sourceObjectId,
      sourceObjectNo: input.sourceObjectNo,
      deliveryOrderNo: input.delivery.deliveryOrderNo,
      productionOrderNo: input.delivery.productionOrderNo,
      sku: clone(line.sku),
      defectQty: line.defectQty,
      defectReason: line.defectReason || '未填写',
      evidenceImageUrl: line.defectImageUrl,
      responsibleParty: line.responsibleParty,
      dispositionStatus: '待处理',
      recordedBy: clone(input.actor),
      recordedAt: input.recordedAt,
    })
  })
}

function createRecheckOrder(input: {
  delivery: PostFinishingFactoryReturnDelivery
  qcTask: PostFinishingQcTask
  postTask?: PostFinishingPostTask
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  createdAt: string
}): PostFinishingRecheckOrder {
  const sourceId = input.postTask?.postTaskId || input.qcTask.qcTaskId
  const existing = state.recheckOrders.find((record) => (
    input.postTask
      ? record.postTaskId === input.postTask.postTaskId
      : !record.postTaskId && record.qcTaskId === input.qcTask.qcTaskId
  ))
  if (existing) return existing
  const recheckOrderId = `PF-RC-${input.delivery.productionOrderId}-${input.delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'RECHECK',
    productionOrderNo: input.delivery.productionOrderNo,
    sourceObjectId: sourceId,
    idempotencyKey: `RECHECK:${sourceId}`,
    sequence: input.delivery.returnIndex,
  }, new Date(input.createdAt))
  const record: PostFinishingRecheckOrder = {
    recheckOrderId,
    recheckOrderNo: number.documentNo,
    deliveryId: input.delivery.deliveryId,
    deliveryOrderNo: input.delivery.deliveryOrderNo,
    productionOrderNo: input.delivery.productionOrderNo,
    qcTaskId: input.qcTask.qcTaskId,
    qcTaskNo: input.qcTask.qcTaskNo,
    postTaskId: input.postTask?.postTaskId,
    postTaskNo: input.postTask?.postTaskNo,
    returnIndex: input.delivery.returnIndex,
    status: '待复检',
    lines: input.lines.map((line) => ({
      sku: clone(line.sku),
      expectedQty: line.expectedQty,
      barcodeStatus: line.expectedQty > 0 ? '待扫描' : '正确',
      barcodeEvents: [],
    })),
  }
  state.recheckOrders.push(record)
  if (input.postTask) {
    input.postTask.recheckOrderId = record.recheckOrderId
    input.postTask.recheckOrderNo = record.recheckOrderNo
  } else {
    input.qcTask.recheckOrderId = record.recheckOrderId
    input.qcTask.recheckOrderNo = record.recheckOrderNo
  }
  return record
}

export function completePostFinishingQcTask(input: {
  qcTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingQualityResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
  needPostFinishing: boolean
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingQcTask {
  const task = findQcTask(input.qcTaskId)
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '质检完成') return clone(task)
  if (!task.claimedBy || task.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前领取质检任务的质检员可以提交结果。')
  }
  const now = nowIso(input.nowMs)
  const results: PostFinishingQualityResultLine[] = task.lines.map((line) => {
    const submitted = input.results.find((item) => item.skuId === line.sku.skuId)
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的质检结果。`)
    assertIntegerQuantity(submitted.passedQty, { label: `SKU ${line.sku.skuCode} 合格数量` })
    assertIntegerQuantity(submitted.defectQty, { label: `SKU ${line.sku.skuCode} 瑕疵数量` })
    assertIntegerQuantity(submitted.returnQty, { label: `SKU ${line.sku.skuCode} 返厂数量` })
    if (submitted.defectQty > 0 && !submitted.defectReason?.trim()) {
      throw new PostFinishingFlowGateError('DEFECT_REASON_REQUIRED', `SKU ${line.sku.skuCode} 有瑕疵时必须填写瑕疵原因。`)
    }
    if (submitted.returnQty > 0 && (!submitted.returnReason?.trim() || !submitted.returnReceiver?.trim())) {
      throw new Error(`SKU ${line.sku.skuCode} 有返厂数量时必须填写返厂原因和接收责任方。`)
    }
    return {
      sku: clone(line.sku),
      expectedQty: line.expectedQty,
      passedQty: submitted.passedQty,
      defectQty: submitted.defectQty,
      returnQty: submitted.returnQty,
      defectReason: submitted.defectReason?.trim(),
      defectImageUrl: submitted.defectImageUrl,
      responsibleParty: submitted.responsibleParty,
      returnReason: submitted.returnReason?.trim(),
      returnReceiver: submitted.returnReceiver?.trim(),
    }
  })
  const quantities = results.map((line) => ({
    skuId: line.sku.skuId,
    expectedQty: line.expectedQty,
    actualQty: line.passedQty + line.defectQty + line.returnQty,
  }))
  const hasDifference = quantities.some((line) => line.expectedQty !== line.actualQty)
  let consumed: PostFinishingAuthorizationConsumption | undefined
  if (hasDifference) {
    consumed = consumeRequiredAuthorization({
      stage: '质检', delivery, objectId: task.qcTaskId, objectNo: task.qcTaskNo,
      actor: input.actor, authorization: input.authorization, operatedAt: now, quantities,
    })
    task.qcAuthorizationId = consumed.authorizationId
    task.qcAuthorizedBy = { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
  }
  task.results = results
  task.needPostFinishing = input.needPostFinishing
  task.status = '质检完成'
  task.completedAt = now
  createDefectRecords({
    delivery,
    discoveryStage: '质检',
    sourceObjectId: task.qcTaskId,
    sourceObjectNo: task.qcTaskNo,
    lines: results,
    actor: input.actor,
    recordedAt: now,
  })
  if (input.needPostFinishing) {
    const postTaskId = `PF-POST-${delivery.productionOrderId}-${delivery.returnIndex}`
    const number = issuePostFinishingDocumentNumber({
      kind: 'POST',
      productionOrderNo: delivery.productionOrderNo,
      sourceObjectId: task.qcTaskId,
      idempotencyKey: `POST:${task.qcTaskId}`,
      sequence: delivery.returnIndex,
    }, new Date(input.nowMs ?? Date.now()))
    const existing = state.postTasks.find((record) => record.qcTaskId === task.qcTaskId)
    const postTask = existing || {
      postTaskId,
      postTaskNo: number.documentNo,
      deliveryId: delivery.deliveryId,
      deliveryOrderNo: delivery.deliveryOrderNo,
      productionOrderNo: delivery.productionOrderNo,
      qcTaskId: task.qcTaskId,
      qcTaskNo: task.qcTaskNo,
      returnIndex: delivery.returnIndex,
      status: '待后道' as const,
      processItems: ['开扣眼', '装扣子', '烫包'],
      lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.passedQty })),
    }
    if (!existing) state.postTasks.push(postTask)
    task.postTaskId = postTask.postTaskId
    task.postTaskNo = postTask.postTaskNo
  } else {
    createRecheckOrder({
      delivery,
      qcTask: task,
      lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.passedQty })),
      createdAt: now,
    })
  }
  persist()
  appendBusinessLog({
    stage: '质检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
    action: '完成质检', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
    beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
    afterQuantity: total(quantities.map((line) => line.actualQty)),
    differenceQuantity: total(quantities.map((line) => line.actualQty)) - total(quantities.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason,
    authorization: consumed,
    remark: input.needPostFinishing ? '生成唯一后道任务' : '跳过后道并生成唯一复检单',
  })
  return clone(task)
}

export function startPostFinishingPostTask(input: {
  postTaskNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  const task = state.postTasks.find((item) => item.postTaskNo === input.postTaskNo.trim())
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整后道任务号，不提供模糊候选。')
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '后道完成') return clone(task)
  if (task.startedBy && task.startedBy.actorId !== input.actor.actorId) {
    appendBusinessLog({
      stage: '后道', delivery, objectType: '后道任务', objectId: task.postTaskId, objectNo: task.postTaskNo,
      action: '扫描领取冲突', actor: input.actor, operatedAt: nowIso(input.nowMs), result: '阻断',
      remark: `已由${task.startedBy.actorName}后道处理中；开始时间${task.startedAt}`,
    })
    throw new PostFinishingFlowGateError(
      'CLAIM_CONFLICT',
      `该后道任务已由 ${task.startedBy.actorName} 处理中，开始时间 ${task.startedAt}。`,
    )
  }
  if (task.status === '待后道') {
    const now = nowIso(input.nowMs)
    task.status = '后道中'
    task.startedBy = clone(input.actor)
    task.startedAt = now
    persist()
    appendBusinessLog({
      stage: '后道', delivery, objectType: '后道任务', objectId: task.postTaskId, objectNo: task.postTaskNo,
      action: '开始后道', actor: input.actor, operatedAt: now, beforeStatus: '待后道', afterStatus: task.status,
    })
  }
  return clone(task)
}

export function completePostFinishingPostTask(input: {
  postTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingPostResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingPostTask {
  const task = findPostTask(input.postTaskId)
  const delivery = findDelivery(task.deliveryId)
  const qcTask = findQcTask(task.qcTaskId)
  if (task.status === '后道完成') return clone(task)
  if (task.status !== '后道中') throw new PostFinishingFlowGateError('INVALID_STATUS', '必须先开始后道才能提交完成结果。')
  if (!task.startedBy || task.startedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前开始后道的操作员可以提交结果。')
  }
  const now = nowIso(input.nowMs)
  const results: PostFinishingPostResultLine[] = task.lines.map((line) => {
    const submitted = input.results.find((item) => item.skuId === line.sku.skuId)
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的后道结果。`)
    assertIntegerQuantity(submitted.passedQty, { label: `SKU ${line.sku.skuCode} 后道合格数量` })
    assertIntegerQuantity(submitted.defectQty, { label: `SKU ${line.sku.skuCode} 后道瑕疵数量` })
    assertIntegerQuantity(submitted.returnQty, { label: `SKU ${line.sku.skuCode} 后道返厂数量` })
    if (submitted.defectQty > 0 && !submitted.defectReason?.trim()) {
      throw new PostFinishingFlowGateError('DEFECT_REASON_REQUIRED', `SKU ${line.sku.skuCode} 有后道瑕疵时必须填写瑕疵原因。`)
    }
    if (submitted.returnQty > 0 && (!submitted.returnReason?.trim() || !submitted.returnReceiver?.trim())) {
      throw new Error(`SKU ${line.sku.skuCode} 有后道返厂数量时必须填写返厂原因和接收责任方。`)
    }
    return {
      sku: clone(line.sku), expectedQty: line.expectedQty,
      passedQty: submitted.passedQty, defectQty: submitted.defectQty, returnQty: submitted.returnQty,
      defectReason: submitted.defectReason?.trim(), defectImageUrl: submitted.defectImageUrl,
      responsibleParty: submitted.responsibleParty, returnReason: submitted.returnReason?.trim(),
      returnReceiver: submitted.returnReceiver?.trim(),
    }
  })
  const stageQuantities = results.map((line) => ({
    skuId: line.sku.skuId,
    expectedQty: line.expectedQty,
    actualQty: line.passedQty + line.defectQty + line.returnQty,
  }))
  const fullChainQuantities = results.map((line) => {
    const qcResult = qcTask.results?.find((item) => item.sku.skuId === line.sku.skuId)
    if (!qcResult) throw new PostFinishingFlowGateError('INVALID_STATUS', `SKU ${line.sku.skuCode} 缺少已完成质检结果。`)
    return {
      skuId: line.sku.skuId,
      expectedQty: qcResult.expectedQty,
      actualQty: line.passedQty + line.defectQty + line.returnQty + qcResult.defectQty + qcResult.returnQty,
    }
  })
  const stageHasDifference = stageQuantities.some((line) => line.expectedQty !== line.actualQty)
  const fullChainHasDifference = fullChainQuantities.some((line) => line.expectedQty !== line.actualQty)
  const hasDifference = stageHasDifference || fullChainHasDifference
  let consumed: PostFinishingAuthorizationConsumption | undefined
  if (hasDifference) {
    const quantities = [
      ...stageQuantities
        .filter((line) => line.expectedQty !== line.actualQty)
        .map((line) => ({ ...line, skuId: `${line.skuId}:后道` })),
      ...fullChainQuantities
        .filter((line) => line.expectedQty !== line.actualQty)
        .map((line) => ({ ...line, skuId: `${line.skuId}:全链` })),
    ]
    consumed = consumeRequiredAuthorization({
      stage: '后道', delivery, objectId: task.postTaskId, objectNo: task.postTaskNo,
      actor: input.actor, authorization: input.authorization, operatedAt: now, quantities,
    })
    task.postAuthorizationId = consumed.authorizationId
    task.postAuthorizedBy = { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
  }
  task.results = results
  task.status = '后道完成'
  task.completedAt = now
  createDefectRecords({
    delivery, discoveryStage: '后道', sourceObjectId: task.postTaskId, sourceObjectNo: task.postTaskNo,
    lines: results, actor: input.actor, recordedAt: now,
  })
  createRecheckOrder({
    delivery,
    qcTask,
    postTask: task,
    lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.passedQty })),
    createdAt: now,
  })
  persist()
  appendBusinessLog({
    stage: '后道', delivery, objectType: '后道任务', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: '完成后道', actor: input.actor, operatedAt: now, beforeStatus: '后道中', afterStatus: task.status,
    beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
    afterQuantity: total(stageQuantities.map((line) => line.actualQty)),
    differenceQuantity: total(stageQuantities.map((line) => line.actualQty)) - total(stageQuantities.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason, authorization: consumed,
    remark: `本环节差异 SKU ${stageQuantities.filter((line) => line.expectedQty !== line.actualQty).length} 个；全链差异 SKU ${fullChainQuantities.filter((line) => line.expectedQty !== line.actualQty).length} 个；以后道合格数量生成唯一复检单`,
  })
  return clone(task)
}

export function claimPostFinishingRecheckOrder(input: {
  recheckOrderNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingRecheckOrder {
  const record = state.recheckOrders.find((item) => item.recheckOrderNo === input.recheckOrderNo.trim())
  if (!record) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整复检单号，不提供模糊候选。')
  const delivery = findDelivery(record.deliveryId)
  const now = nowIso(input.nowMs)
  if (record.status === '复检完成') return clone(record)
  if (record.claimedBy && record.claimedBy.actorId !== input.actor.actorId) {
    appendBusinessLog({
      stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
      action: '扫描领取冲突', actor: input.actor, operatedAt: now, result: '阻断',
      remark: `已由${record.claimedBy.actorName}复检中；领取时间${record.claimedAt}`,
    })
    throw new PostFinishingFlowGateError(
      'CLAIM_CONFLICT',
      `该复检单已由 ${record.claimedBy.actorName} 复检中，领取时间 ${record.claimedAt}。`,
    )
  }
  if (!record.claimedBy) {
    record.claimedBy = clone(input.actor)
    record.claimedAt = now
    record.status = record.lines.some((line) => ['错误待重贴', '已重贴待复扫'].includes(line.barcodeStatus))
      ? '条码异常待重贴'
      : '复检中'
    persist()
    appendBusinessLog({
      stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
      action: '扫码领取复检', actor: input.actor, operatedAt: now, beforeStatus: '待复检', afterStatus: record.status,
    })
  }
  return clone(record)
}

export function releasePostFinishingRecheckOrder(input: {
  recheckOrderId: string
  actor: PostFinishingActor
  reason: string
  supervisor?: boolean
  nowMs?: number
}): PostFinishingRecheckOrder {
  const record = findRecheck(input.recheckOrderId)
  const delivery = findDelivery(record.deliveryId)
  if (record.status === '复检完成') throw new PostFinishingFlowGateError('INVALID_STATUS', '已完成复检单不能释放。')
  if (!record.claimedBy) return clone(record)
  if (record.claimedBy.actorId !== input.actor.actorId && !input.supervisor) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前复检员或主管可以释放复检单。')
  }
  const now = nowIso(input.nowMs)
  const ownerName = record.claimedBy.actorName
  record.claimedBy = undefined
  record.claimedAt = undefined
  record.releasedAt = now
  record.releaseReason = input.reason.trim() || '错误领取'
  record.status = '待复检'
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '释放复检单', actor: input.actor, operatedAt: now, beforeStatus: '复检中', afterStatus: record.status,
    remark: `${ownerName}退领；${record.releaseReason}`,
  })
  return clone(record)
}

export function scanPostFinishingRecheckSkuBarcode(input: {
  recheckOrderId: string
  skuId: string
  scannedBarcode: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingRecheckOrder {
  const record = findRecheck(input.recheckOrderId)
  const delivery = findDelivery(record.deliveryId)
  if (!record.claimedBy || record.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前复检员可以扫描实物条码。')
  }
  if (record.status === '复检完成') return clone(record)
  const line = record.lines.find((item) => item.sku.skuId === input.skuId)
  if (!line) throw new PostFinishingFlowGateError('NOT_FOUND', '当前复检单没有该 SKU。')
  const now = nowIso(input.nowMs)
  const isCorrect = input.scannedBarcode.trim() === line.sku.barcode
  const isRescan = line.barcodeStatus === '已重贴待复扫'
  line.lastScannedBarcode = input.scannedBarcode.trim()
  line.barcodeStatus = isCorrect ? '正确' : '错误待重贴'
  line.barcodeEvents.push({
    eventId: `PF-BAR-${record.recheckOrderId}-${line.barcodeEvents.length + 1}`,
    action: isCorrect ? (isRescan ? '复扫正确' : '扫描正确') : '扫描错误',
    scannedBarcode: input.scannedBarcode.trim(),
    expectedBarcode: line.sku.barcode,
    operator: clone(input.actor),
    operatedAt: now,
  })
  record.status = record.lines.some((item) => ['错误待重贴', '已重贴待复扫'].includes(item.barcodeStatus))
    ? '条码异常待重贴'
    : '复检中'
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: isCorrect ? (isRescan ? '重贴后复扫正确' : 'SKU条码扫描正确') : 'SKU条码扫描错误',
    actor: input.actor, operatedAt: now, beforeStatus: '复检中', afterStatus: record.status,
    result: isCorrect ? '成功' : '阻断',
    remark: `SKU ${line.sku.skuCode}；应有 ${line.sku.barcode}；实扫 ${input.scannedBarcode.trim()}`,
  })
  return clone(record)
}

export function markPostFinishingRecheckSkuRelabeled(input: {
  recheckOrderId: string
  skuId: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingRecheckOrder {
  const record = findRecheck(input.recheckOrderId)
  const delivery = findDelivery(record.deliveryId)
  if (!record.claimedBy || record.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前复检员可以确认重新贴码。')
  }
  const line = record.lines.find((item) => item.sku.skuId === input.skuId)
  if (!line) throw new PostFinishingFlowGateError('NOT_FOUND', '当前复检单没有该 SKU。')
  if (line.barcodeStatus !== '错误待重贴') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有条码错误的 SKU 才能执行重新贴码。')
  }
  const now = nowIso(input.nowMs)
  line.barcodeStatus = '已重贴待复扫'
  line.barcodeEvents.push({
    eventId: `PF-BAR-${record.recheckOrderId}-${line.barcodeEvents.length + 1}`,
    action: '重新贴码',
    expectedBarcode: line.sku.barcode,
    operator: clone(input.actor),
    operatedAt: now,
  })
  record.status = '条码异常待重贴'
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '重新贴码', actor: input.actor, operatedAt: now, beforeStatus: '条码异常待重贴', afterStatus: record.status,
    remark: `SKU ${line.sku.skuCode} 已重贴，必须复扫正确后继续`,
  })
  return clone(record)
}

function upsertOutboundFromRecheck(
  record: PostFinishingRecheckOrder,
  delivery: PostFinishingFactoryReturnDelivery,
  createdAt: string,
): PostFinishingOutboundOrder {
  const existing = state.outboundOrders.find((item) => item.recheckOrderId === record.recheckOrderId)
  if (existing) return existing
  const outboundOrderId = `PF-OUT-${delivery.productionOrderId}-${delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'OUTBOUND',
    productionOrderNo: delivery.productionOrderNo,
    sourceObjectId: record.recheckOrderId,
    idempotencyKey: `OUTBOUND:${record.recheckOrderId}`,
    sequence: delivery.returnIndex,
  }, new Date(createdAt))
  const outbound: PostFinishingOutboundOrder = {
    outboundOrderId,
    outboundOrderNo: number.documentNo,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    qcTaskId: record.qcTaskId,
    qcTaskNo: record.qcTaskNo,
    postTaskId: record.postTaskId,
    postTaskNo: record.postTaskNo,
    recheckOrderId: record.recheckOrderId,
    recheckOrderNo: record.recheckOrderNo,
    returnIndex: delivery.returnIndex,
    status: '待仓库接收',
    lines: record.lines.map((line) => ({ sku: clone(line.sku), outboundQty: line.passedQty || 0 })),
    createdAt,
  }
  state.outboundOrders.push(outbound)
  record.outboundOrderId = outbound.outboundOrderId
  record.outboundOrderNo = outbound.outboundOrderNo
  return outbound
}

export function completePostFinishingRecheckOrderFullFlow(input: {
  recheckOrderId: string
  actor: PostFinishingActor
  results: Array<{ skuId: string; passedQty: number; defectQty: number }>
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingRecheckOrder {
  const record = findRecheck(input.recheckOrderId)
  const delivery = findDelivery(record.deliveryId)
  if (record.status === '复检完成') return clone(record)
  if (!record.claimedBy || record.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前复检员可以提交复检结果。')
  }
  if (record.lines.some((line) => line.expectedQty > 0 && line.barcodeStatus !== '正确')) {
    throw new PostFinishingFlowGateError('BARCODE_BLOCKED', '存在未扫描或条码错误的 SKU，必须重新贴码并复扫正确后才能出货。')
  }
  const now = nowIso(input.nowMs)
  const quantities = record.lines.map((line) => {
    const submitted = input.results.find((item) => item.skuId === line.sku.skuId)
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的复检结果。`)
    assertIntegerQuantity(submitted.passedQty, { label: `SKU ${line.sku.skuCode} 复检合格数量` })
    assertIntegerQuantity(submitted.defectQty, { label: `SKU ${line.sku.skuCode} 复检瑕疵数量` })
    line.passedQty = submitted.passedQty
    line.defectQty = submitted.defectQty
    return { skuId: line.sku.skuId, expectedQty: line.expectedQty, actualQty: submitted.passedQty + submitted.defectQty }
  })
  const hasDifference = quantities.some((line) => line.expectedQty !== line.actualQty)
  let consumed: PostFinishingAuthorizationConsumption | undefined
  if (hasDifference) {
    consumed = consumeRequiredAuthorization({
      stage: '复检', delivery, objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
      actor: input.actor, authorization: input.authorization, operatedAt: now, quantities,
    })
    record.recheckAuthorizationId = consumed.authorizationId
    record.recheckAuthorizedBy = { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
  }
  record.status = '复检完成'
  record.completedAt = now
  const outbound = upsertOutboundFromRecheck(record, delivery, now)
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '完成复检', actor: input.actor, operatedAt: now, beforeStatus: '复检中', afterStatus: record.status,
    beforeQuantity: total(quantities.map((line) => line.expectedQty)),
    afterQuantity: total(quantities.map((line) => line.actualQty)),
    differenceQuantity: total(quantities.map((line) => line.actualQty)) - total(quantities.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason, authorization: consumed,
    remark: `所有 SKU 条码正确；生成唯一出货单 ${outbound.outboundOrderNo}`,
  })
  appendBusinessLog({
    stage: '出货', delivery, objectType: '后道出货单', objectId: outbound.outboundOrderId, objectNo: outbound.outboundOrderNo,
    action: '自动生成后道出货单', actor: input.actor, operatedAt: now, afterStatus: outbound.status,
    afterQuantity: total(outbound.lines.map((line) => line.outboundQty)),
  })
  return clone(record)
}

export function receivePostFinishingOutboundOrder(input: {
  outboundOrderNo: string
  actor: PostFinishingActor
  receivedQuantities: Array<{ skuId: string; receivedQty: number }>
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): { outbound: PostFinishingOutboundOrder; receipt: PostFinishingWarehouseReceipt; alreadyReceived: boolean } {
  const exact = state.outboundOrders.find((item) => item.outboundOrderNo === input.outboundOrderNo.trim())
  if (!exact) throw new PostFinishingFlowGateError('NOT_FOUND', '只接受完整 FCK 后道出货单号，不接受复检单或内部交接号。')
  const delivery = findDelivery(exact.deliveryId)
  const existingReceipt = state.warehouseReceipts.find((item) => item.outboundOrderId === exact.outboundOrderId)
  if (existingReceipt) return { outbound: clone(exact), receipt: clone(existingReceipt), alreadyReceived: true }
  if (exact.status !== '待仓库接收') throw new PostFinishingFlowGateError('INVALID_STATUS', '该出货单当前不能执行仓库收货。')
  const now = nowIso(input.nowMs)
  const lines = exact.lines.map((line) => {
    const receivedQty = Number(input.receivedQuantities.find((item) => item.skuId === line.sku.skuId)?.receivedQty)
    assertIntegerQuantity(receivedQty, { label: `SKU ${line.sku.skuCode} 实收数量` })
    return { sku: clone(line.sku), expectedQty: line.outboundQty, receivedQty }
  })
  const quantities = lines.map((line) => ({ skuId: line.sku.skuId, expectedQty: line.expectedQty, actualQty: line.receivedQty }))
  const hasDifference = quantities.some((line) => line.expectedQty !== line.actualQty)
  let consumed: PostFinishingAuthorizationConsumption | undefined
  if (hasDifference) {
    consumed = consumeRequiredAuthorization({
      stage: '仓库收货', delivery, objectId: exact.outboundOrderId, objectNo: exact.outboundOrderNo,
      actor: input.actor, authorization: input.authorization, operatedAt: now, quantities,
    })
  }
  exact.lines.forEach((line) => {
    line.receivedQty = lines.find((item) => item.sku.skuId === line.sku.skuId)!.receivedQty
  })
  exact.status = '已接收入库'
  exact.receivedAt = now
  exact.receivedBy = clone(input.actor)
  exact.warehouseAuthorizationId = consumed?.authorizationId
  exact.warehouseAuthorizedBy = consumed
    ? { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
    : undefined
  exact.warehouseDifferenceReason = input.authorization?.differenceReason
  const receipt: PostFinishingWarehouseReceipt = {
    receiptId: `PF-WH-RCPT-${String(state.warehouseReceipts.length + 1).padStart(6, '0')}`,
    outboundOrderId: exact.outboundOrderId,
    outboundOrderNo: exact.outboundOrderNo,
    productionOrderNo: exact.productionOrderNo,
    lines,
    receivedBy: clone(input.actor),
    receivedAt: now,
    authorizationId: consumed?.authorizationId,
    differenceReason: input.authorization?.differenceReason,
  }
  state.warehouseReceipts.push(receipt)
  delivery.status = '已完成'
  persist()
  appendBusinessLog({
    stage: '仓库收货', delivery, objectType: '后道出货单', objectId: exact.outboundOrderId, objectNo: exact.outboundOrderNo,
    action: '确认仓库收货', actor: input.actor, operatedAt: now, beforeStatus: '待仓库接收', afterStatus: exact.status,
    beforeQuantity: total(lines.map((line) => line.expectedQty)),
    afterQuantity: total(lines.map((line) => line.receivedQty)),
    differenceQuantity: total(lines.map((line) => line.receivedQty)) - total(lines.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason, authorization: consumed,
  })
  return { outbound: clone(exact), receipt: clone(receipt), alreadyReceived: false }
}

export function listPostFinishingFactoryReturns(): PostFinishingFactoryReturnDelivery[] {
  return clone(state.deliveries)
}

export function listPostFinishingWaitProcessWarehouseRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  return clone(state.waitProcessWarehouseRecords)
}

export function listPostFinishingWaitProcessWarehouseMovements(): PostFinishingWaitProcessWarehouseMovement[] {
  return clone(state.waitProcessWarehouseMovements).sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
}

export function listPostFinishingReturnConfirmationVersions(input: {
  deliveryId?: string
  executionTaskId?: string
  assignmentId?: string
  activeOnly?: boolean
} = {}): PostFinishingReturnConfirmationVersion[] {
  return clone(state.returnConfirmationVersions
    .filter((version) => !input.deliveryId || version.deliveryId === input.deliveryId)
    .filter((version) => !input.executionTaskId || version.executionTaskId === input.executionTaskId)
    .filter((version) => !input.assignmentId || version.assignmentId === input.assignmentId)
    .filter((version) => !input.activeOnly || version.status === 'ACTIVE')
    .sort((left, right) => left.versionCreatedAt.localeCompare(right.versionCreatedAt)
      || left.confirmationVersionId.localeCompare(right.confirmationVersionId)))
}

export function listPostFinishingFullFlowQcTasks(): PostFinishingQcTask[] {
  return clone(state.qcTasks)
}

export function listPostFinishingFullFlowPostTasks(): PostFinishingPostTask[] {
  return clone(state.postTasks)
}

export function listPostFinishingFullFlowRecheckOrders(): PostFinishingRecheckOrder[] {
  return clone(state.recheckOrders)
}

export function listPostFinishingFullFlowOutboundOrders(): PostFinishingOutboundOrder[] {
  return clone(state.outboundOrders)
}

export function listPostFinishingWarehouseReceipts(): PostFinishingWarehouseReceipt[] {
  return clone(state.warehouseReceipts)
}

export function listPostFinishingDefectRecords(filter: { discoveryStage?: '质检' | '后道' } = {}): PostFinishingDefectRecord[] {
  return clone(state.defects.filter((record) => !filter.discoveryStage || record.discoveryStage === filter.discoveryStage))
}

export function getPostFinishingFactoryReturn(deliveryIdOrNo: string): PostFinishingFactoryReturnDelivery | undefined {
  const record = state.deliveries.find((item) => item.deliveryId === deliveryIdOrNo || item.deliveryOrderNo === deliveryIdOrNo)
  return record ? clone(record) : undefined
}

export function getPostFinishingFullFlowQcTask(qcTaskIdOrNo: string): PostFinishingQcTask | undefined {
  const record = state.qcTasks.find((item) => item.qcTaskId === qcTaskIdOrNo || item.qcTaskNo === qcTaskIdOrNo)
  return record ? clone(record) : undefined
}

export function getPostFinishingFullFlowPostTask(postTaskIdOrNo: string): PostFinishingPostTask | undefined {
  const record = state.postTasks.find((item) => item.postTaskId === postTaskIdOrNo || item.postTaskNo === postTaskIdOrNo)
  return record ? clone(record) : undefined
}

export function getPostFinishingFullFlowRecheckOrder(recheckIdOrNo: string): PostFinishingRecheckOrder | undefined {
  const record = state.recheckOrders.find((item) => item.recheckOrderId === recheckIdOrNo || item.recheckOrderNo === recheckIdOrNo)
  return record ? clone(record) : undefined
}

export function getPostFinishingFullFlowOutboundOrder(outboundIdOrNo: string): PostFinishingOutboundOrder | undefined {
  const record = state.outboundOrders.find((item) => item.outboundOrderId === outboundIdOrNo || item.outboundOrderNo === outboundIdOrNo)
  return record ? clone(record) : undefined
}

export function getPostFinishingQcTaskReferences(qcTaskId: string): PostFinishingQcReferenceRecord[] {
  return listPostFinishingQcReferences({ qcTaskId })
}

export function tracePostFinishingFullFlow(anyNumber: string): {
  delivery?: PostFinishingFactoryReturnDelivery
  qcTask?: PostFinishingQcTask
  postTask?: PostFinishingPostTask
  recheckOrder?: PostFinishingRecheckOrder
  outboundOrder?: PostFinishingOutboundOrder
  receipt?: PostFinishingWarehouseReceipt
} {
  const normalized = anyNumber.trim()
  let delivery = state.deliveries.find((item) => item.deliveryOrderNo === normalized)
  const qcTask = state.qcTasks.find((item) => item.qcTaskNo === normalized)
  const postTask = state.postTasks.find((item) => item.postTaskNo === normalized)
  const recheckOrder = state.recheckOrders.find((item) => item.recheckOrderNo === normalized)
  const outboundOrder = state.outboundOrders.find((item) => item.outboundOrderNo === normalized)
  if (!delivery) {
    const deliveryId = qcTask?.deliveryId || postTask?.deliveryId || recheckOrder?.deliveryId || outboundOrder?.deliveryId
    delivery = state.deliveries.find((item) => item.deliveryId === deliveryId)
  }
  if (!delivery) return {}
  const relation = relationForDelivery(delivery)
  const receipt = relation.outbound
    ? state.warehouseReceipts.find((item) => item.outboundOrderId === relation.outbound!.outboundOrderId)
    : undefined
  return clone({ delivery, qcTask: relation.qcTask, postTask: relation.postTask, recheckOrder: relation.recheck, outboundOrder: relation.outbound, receipt })
}

export function getPostFinishingReturnToleranceRate(): number {
  return RETURN_TOLERANCE_RATE
}

export function resetPostFinishingFullFlow(): void {
  state = emptyState()
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 忽略原型存储不可用。
  }
  resetPostFinishingDocumentNumbering()
  resetPostFinishingAuthorizationConsumptions()
  resetPostFinishingOperationLogs()
  resetPostFinishingQcReferences()
}

export function setPostFinishingDemoBootstrapEnabled(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(POST_FINISHING_DEMO_MODE_STORAGE_KEY, enabled ? 'demo' : 'empty')
  } catch {
    // 原型存储不可用时不切换默认 Mock 模式。
  }
}

function shouldBootstrapPostFinishingDemo(): boolean {
  if (typeof window === 'undefined' || !globalThis.localStorage) return false
  try {
    return globalThis.localStorage.getItem(POST_FINISHING_DEMO_MODE_STORAGE_KEY) !== 'empty'
  } catch {
    return false
  }
}

export function loadPostFinishingDemoData(): void {
  resetPostFinishingFullFlow()
  setPostFinishingDemoBootstrapEnabled(true)
  const baseTime = Date.UTC(2026, 7, 25, 1, 0, 0)
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.forEach((order, orderIndex) => {
    for (let returnIndex = 1; returnIndex <= 5; returnIndex += 1) {
      const chainTime = baseTime + ((orderIndex * 5 + returnIndex) * 60 * 60 * 1000)
      const delivery = registerPostFinishingFactoryReturn({
        productionOrderNo: order.productionOrderNo,
        returnIndex,
        triggerSource: returnIndex % 2 === 0 ? '公共PDA自助回货' : '车缝正常交出',
        idempotencyKey: `DEMO:${order.productionOrderNo}:${returnIndex}`,
        quantities: order.skus.map((sku) => ({ skuId: sku.skuId, registeredQty: 20 })),
        deliveryPersonName: `演示送货员 ${orderIndex + 1}`,
        deliveryPersonPhone: `0812000${orderIndex + 1}${returnIndex}00`,
        evidenceImageUrls: [order.skus[0]?.imageUrl || '/shirt-sample.jpg'],
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier,
        nowMs: chainTime,
      })
      if (returnIndex === 1) continue

      const confirmed = confirmPostFinishingFactoryReturn({
        deliveryId: delivery.deliveryId,
        firstCounts: delivery.lines.map((line, lineIndex) => ({
          skuId: line.sku.skuId,
          actualQty: returnIndex === 2 && lineIndex === 0 ? 19 : 20,
        })),
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
        nowMs: chainTime + 10 * 60 * 1000,
      })
      if (returnIndex === 2) continue

      const qcTask = sendPostFinishingFactoryReturnToQc({
        deliveryId: confirmed.deliveryId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender,
        nowMs: chainTime + 20 * 60 * 1000,
      })
      if (returnIndex === 3) continue

      const claimedQc = claimPostFinishingQcTask({
        qcTaskNo: qcTask.qcTaskNo,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
        nowMs: chainTime + 30 * 60 * 1000,
      })
      if (returnIndex === 4) continue

      const completedQc = completePostFinishingQcTask({
        qcTaskId: claimedQc.qcTaskId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
        results: claimedQc.lines.map((line) => ({
          skuId: line.sku.skuId,
          passedQty: line.expectedQty,
          defectQty: 0,
          returnQty: 0,
        })),
        needPostFinishing: orderIndex !== 2,
        nowMs: chainTime + 40 * 60 * 1000,
      })

      if (orderIndex === 0) continue
      if (orderIndex === 1 && completedQc.postTaskNo && completedQc.postTaskId) {
        const startedPost = startPostFinishingPostTask({
          postTaskNo: completedQc.postTaskNo,
          actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
          nowMs: chainTime + 50 * 60 * 1000,
        })
        completePostFinishingPostTask({
          postTaskId: startedPost.postTaskId,
          actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
          results: startedPost.lines.map((line) => ({
            skuId: line.sku.skuId,
            passedQty: line.expectedQty,
            defectQty: 0,
            returnQty: 0,
          })),
          nowMs: chainTime + 60 * 60 * 1000,
        })
        continue
      }

      const recheck = findRecheck(completedQc.recheckOrderId || completedQc.recheckOrderNo || '')
      const claimedRecheck = claimPostFinishingRecheckOrder({
        recheckOrderNo: recheck.recheckOrderNo,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
        nowMs: chainTime + 50 * 60 * 1000,
      })
      claimedRecheck.lines.forEach((line, lineIndex) => {
        scanPostFinishingRecheckSkuBarcode({
          recheckOrderId: claimedRecheck.recheckOrderId,
          skuId: line.sku.skuId,
          scannedBarcode: line.sku.barcode,
          actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
          nowMs: chainTime + (55 + lineIndex) * 60 * 1000,
        })
      })
      const completedRecheck = completePostFinishingRecheckOrderFullFlow({
        recheckOrderId: claimedRecheck.recheckOrderId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
        results: claimedRecheck.lines.map((line) => ({
          skuId: line.sku.skuId,
          passedQty: line.expectedQty,
          defectQty: 0,
        })),
        nowMs: chainTime + 65 * 60 * 1000,
      })
      const outbound = findOutbound(completedRecheck.outboundOrderId || completedRecheck.outboundOrderNo || '')
      receivePostFinishingOutboundOrder({
        outboundOrderNo: outbound.outboundOrderNo,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
        receivedQuantities: outbound.lines.map((line) => ({
          skuId: line.sku.skuId,
          receivedQty: line.outboundQty,
        })),
        nowMs: chainTime + 75 * 60 * 1000,
      })
    }
  })
}

backfillWaitProcessWarehouseFacts()
if (state.deliveries.length > 0) persist()
if (state.deliveries.length === 0 && shouldBootstrapPostFinishingDemo()) loadPostFinishingDemoData()
