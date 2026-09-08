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
import { listSewingFactoryMasterRecords } from './factory-master-store.ts'
import { productionOrders } from './production-orders.ts'
import { isKolGotoProductionOrder } from './kol-goto-special-flow.ts'
import {
  buildFormalPostFinishingReturnSources,
  type FormalPostFinishingReturnSource,
  type FormalPostFinishingReturnSourceKind,
} from './post-finishing-return-source-adapter.ts'
import { readRuntimeTasks } from './runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from './runtime-process-tasks.ts'
import {
  readPostFinishingSpecialCraftSourceTaskOrders,
  readPostFinishingWoolSourceStore,
} from './post-finishing-return-source-fact-bridge.ts'

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

export const POST_FINISHING_CURRENT_ACTOR_STORAGE_KEY = 'higood-fcs-post-finishing-current-actor-v1'

export function getCurrentPostFinishingActor(fallbackActorId: string = POST_FINISHING_ACCEPTANCE_ACTORS.qcA.actorId): PostFinishingActor {
  let actorId = ''
  try {
    actorId = globalThis.localStorage?.getItem(POST_FINISHING_CURRENT_ACTOR_STORAGE_KEY) || ''
  } catch {
    // 原型存储不可用时使用当前页面约定的默认岗位。
  }
  const actors = Object.values(POST_FINISHING_ACCEPTANCE_ACTORS) as PostFinishingActor[]
  return clone(actors.find((actor) => actor.actorId === actorId) || actors.find((actor) => actor.actorId === fallbackActorId) || POST_FINISHING_ACCEPTANCE_ACTORS.qcA)
}

export function setCurrentPostFinishingActor(actorId: string): void {
  const actor = (Object.values(POST_FINISHING_ACCEPTANCE_ACTORS) as PostFinishingActor[]).find((item) => item.actorId === actorId)
  if (!actor) throw new PostFinishingFlowGateError('NOT_FOUND', '当前登录账号不属于后道全流程演示人员。')
  try {
    globalThis.localStorage?.setItem(POST_FINISHING_CURRENT_ACTOR_STORAGE_KEY, actor.actorId)
  } catch {
    // 原型存储不可用时不切换当前账号。
  }
}

export type PostFinishingSewingTaskType =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_TO_IRON_PACK'
  | 'CUTTING_TO_IRON_PACK'

export const POST_FINISHING_SEWING_TASK_TYPE_LABEL: Record<PostFinishingSewingTaskType, string> = {
  INDEPENDENT_SEWING: '仅车缝',
  SEWING_TO_IRON_PACK: '车缝＋烫包',
  CUTTING_TO_IRON_PACK: '裁剪＋车缝＋烫包',
}

export type PostFinishingResponsibilityMode = 'POST_FACTORY' | 'THIRD_PARTY_FACTORY'

export const POST_FINISHING_PROCESS_ITEMS = Object.freeze([
  '开扣眼',
  '装扣子',
  '烫包',
] as const)

export type PostFinishingProcessItem = typeof POST_FINISHING_PROCESS_ITEMS[number]

export interface PostFinishingResponsibilitySnapshot {
  sewingTaskType: PostFinishingSewingTaskType
  taskTypeLabel: string
  responsibilityMode: PostFinishingResponsibilityMode
  responsibilityLabel: '后道工厂负责' | '三方工厂负责' | '历史责任未标记'
  source: 'PPIC任务分配'
  frozenAt: string
  defaultProcessItems: PostFinishingProcessItem[]
  processItemsEditable: boolean
  historicalUnmarked?: boolean
}

export function resolvePostFinishingResponsibility(
  sewingTaskType: PostFinishingSewingTaskType,
  frozenAt = '2026-08-01T08:00:00+07:00',
): PostFinishingResponsibilitySnapshot {
  const handledByPostFactory = sewingTaskType === 'INDEPENDENT_SEWING'
  return {
    sewingTaskType,
    taskTypeLabel: POST_FINISHING_SEWING_TASK_TYPE_LABEL[sewingTaskType],
    responsibilityMode: handledByPostFactory ? 'POST_FACTORY' : 'THIRD_PARTY_FACTORY',
    responsibilityLabel: handledByPostFactory ? '后道工厂负责' : '三方工厂负责',
    source: 'PPIC任务分配',
    frozenAt,
    defaultProcessItems: handledByPostFactory ? [...POST_FINISHING_PROCESS_ITEMS] : [],
    processItemsEditable: !handledByPostFactory,
  }
}

function normalizeResponsibilitySnapshot(
  snapshot: PostFinishingResponsibilitySnapshot | undefined,
  sewingTaskType: PostFinishingSewingTaskType,
  frozenAt?: string,
  historicalUnmarked = false,
): PostFinishingResponsibilitySnapshot {
  const fallback = resolvePostFinishingResponsibility(sewingTaskType, frozenAt)
  if (!snapshot && historicalUnmarked) {
    return { ...fallback, taskTypeLabel: '历史责任未标记', responsibilityLabel: '历史责任未标记', historicalUnmarked: true }
  }
  return {
    ...fallback,
    ...(snapshot || {}),
    source: snapshot?.source || fallback.source,
    frozenAt: snapshot?.frozenAt || fallback.frozenAt,
    defaultProcessItems: snapshot?.defaultProcessItems
      ? snapshot.defaultProcessItems.map(normalizePostFinishingProcessItem).filter((item): item is PostFinishingProcessItem => Boolean(item))
      : fallback.defaultProcessItems,
  }
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

export interface PostFinishingQcPrintMaterial {
  materialName: string
  materialCode: string
  unitConsumption: string
  materialUsed: string
  imageUrl: string
}

export interface PostFinishingQcPrintSizeRow {
  sizeName: string
  backLength: string
  shoulderWidth: string
  bust: string
  sleeveLength: string
  cuff: string
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
  styleGrade: 'A' | 'B' | 'C' | 'D'
  buyerName: string
  productionOrderType: '首单' | '翻单'
  saleType: string
  tagPrice: number
  qcPrintMaterials: PostFinishingQcPrintMaterial[]
  qcPrintSizeRows: PostFinishingQcPrintSizeRow[]
  skus: PostFinishingAcceptanceSku[]
}

export type PostFinishingDeliveryStatus =
  | '待后道确认'
  | '待二次点数'
  | '差异待授权'
  | '已确认待送检'
  | '已送检'
  | '已完成'
  | '已废弃'

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
  discardedAt?: string
  discardedBy?: PostFinishingActor
  discardReason?: string
}

export type PostFinishingWaitProcessWarehouseStatus = '待确认' | '待送检' | '已送检' | '已废弃'

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

export type PostFinishingWaitHandoverWarehouseStatus = '待交出' | '已交出'

export interface PostFinishingWaitHandoverWarehouseLine {
  sku: PostFinishingAcceptanceSku
  inboundQty: number
  availableQty: number
  handedOverQty: number
}

export interface PostFinishingWaitHandoverWarehouseRecord {
  warehouseRecordId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  returnIndex: number
  qcTaskId: string
  qcTaskNo: string
  postTaskId?: string
  postTaskNo?: string
  responsibility: PostFinishingResponsibilitySnapshot
  sourceType: '质检直达' | '后道加工后'
  recheckOrderId: string
  recheckOrderNo: string
  outboundOrderId: string
  outboundOrderNo: string
  areaName: '处理后待交出区'
  locationCode: string
  status: PostFinishingWaitHandoverWarehouseStatus
  lines: PostFinishingWaitHandoverWarehouseLine[]
  createdAt: string
  createdBy: PostFinishingActor
  handedOverAt?: string
  handedOverBy?: PostFinishingActor
}

export interface PostFinishingWaitHandoverWarehouseMovement {
  movementId: string
  warehouseRecordId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  recheckOrderNo: string
  outboundOrderNo: string
  movementType: '复检完成入仓' | '后道出货交出'
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
  defectReasonQuantities?: PostFinishingDefectReasonQuantity[]
  defectReason?: string
  defectImageUrl?: string
  responsibleParty?: string
  returnReason?: string
  returnReceiver?: string
}

export type PostFinishingQcTaskStatus = '待送检' | '待质检' | '质检中' | '质检完成'

export interface PostFinishingQcTask {
  qcTaskId: string
  qcTaskNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  responsibility: PostFinishingResponsibilitySnapshot
  returnIndex: number
  status: PostFinishingQcTaskStatus
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  referenceIds: string[]
  createdBy: PostFinishingActor
  createdAt: string
  sentBy?: PostFinishingActor
  sentAt?: string
  claimedBy?: PostFinishingActor
  claimedAt?: string
  releasedAt?: string
  releaseReason?: string
  results?: PostFinishingQualityResultLine[]
  frozenProcessItems?: PostFinishingProcessItem[]
  completedAt?: string
  qcAuthorizationId?: string
  qcAuthorizedBy?: { authorizerId: string; authorizerName: string }
  postTaskId?: string
  postTaskNo?: string
  recheckOrderId?: string
  recheckOrderNo?: string
  outboundOrderId?: string
  outboundOrderNo?: string
}

export interface PostFinishingPostResultLine {
  sku: PostFinishingAcceptanceSku
  expectedQty: number
  processedQty: number
  unprocessedQty: number
  unprocessedReason?: string
}

export interface PostFinishingDefectReasonQuantity {
  reason: string
  quantity: number
}

export interface PostFinishingPostDraftLine {
  skuId: string
  processedQty: number
  unprocessedQty: number
  unprocessedReason?: string
  updatedBy?: PostFinishingActor
  updatedAt?: string
}

export type PostFinishingPostTaskStatus = '待后道' | '后道中' | '后道完成'

export interface PostFinishingPostTask {
  postTaskId: string
  postTaskNo: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  responsibility: PostFinishingResponsibilitySnapshot
  sourceType: '任务后道' | '质检补加工'
  qcTaskId: string
  qcTaskNo: string
  returnIndex: number
  status: PostFinishingPostTaskStatus
  processItems: PostFinishingProcessItem[]
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  startedBy?: PostFinishingActor
  startedAt?: string
  draftLines?: PostFinishingPostDraftLine[]
  lastTakeoverAt?: string
  lastTakeoverReason?: string
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
  handoverQty?: number
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
  responsibility: PostFinishingResponsibilitySnapshot
  sourceType: '质检直达' | '后道加工后'
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
  responsibility: PostFinishingResponsibilitySnapshot
  sourceType: '质检直达' | '后道加工后'
  recheckOrderId?: string
  recheckOrderNo?: string
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

export type PostFinishingMaterialTransferStatus = '申请调拨' | '待调拨' | '待入库' | '已入库'

export interface PostFinishingMaterialTransferLine {
  transferLineId: string
  materialName: string
  materialCode: string
  materialSpuCode: string
  specification: string
  unit: string
  requestedQty: number
  preparedQty: number
  imageUrl: string
}

export interface PostFinishingMaterialTransferHistory {
  status: PostFinishingMaterialTransferStatus
  operatedAt: string
  operatorName: string
  remark: string
}

export interface PostFinishingMaterialTransferOrder {
  transferOrderId: string
  transferOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  styleImageUrl: string
  sewingTaskNo: string
  responsibility: PostFinishingResponsibilitySnapshot
  sourceWarehouseName: string
  targetWarehouseName: string
  targetAreaName: string
  targetLocationCode: string
  status: PostFinishingMaterialTransferStatus
  lines: PostFinishingMaterialTransferLine[]
  statusHistory: PostFinishingMaterialTransferHistory[]
  createdAt: string
  updatedAt: string
  inboundAt?: string
  inboundBy?: PostFinishingActor
}

export interface PostFinishingMaterialStock {
  stockId: string
  transferOrderId: string
  transferOrderNo: string
  productionOrderNo: string
  material: PostFinishingMaterialTransferLine
  currentQty: number
  inboundQty: number
  areaName: string
  locationCode: string
  inboundAt: string
  inboundBy: PostFinishingActor
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
  schemaVersion?: 2
  migration?: {
    requirementId: 'CLEAN-008'
    sourceSchemaVersion: 'unversioned' | 1
    completedAt: string
    /** 只读旧原串，保留被规范化字段及未识别历史字段；不作为当前业务事实读取。 */
    legacyRaw: string
  }
  deliveries: PostFinishingFactoryReturnDelivery[]
  waitProcessWarehouseRecords: PostFinishingWaitProcessWarehouseRecord[]
  waitProcessWarehouseMovements: PostFinishingWaitProcessWarehouseMovement[]
  waitHandoverWarehouseRecords: PostFinishingWaitHandoverWarehouseRecord[]
  waitHandoverWarehouseMovements: PostFinishingWaitHandoverWarehouseMovement[]
  returnConfirmationVersions: PostFinishingReturnConfirmationVersion[]
  qcTasks: PostFinishingQcTask[]
  postTasks: PostFinishingPostTask[]
  recheckOrders: PostFinishingRecheckOrder[]
  outboundOrders: PostFinishingOutboundOrder[]
  warehouseReceipts: PostFinishingWarehouseReceipt[]
  defects: PostFinishingDefectRecord[]
  materialTransferOrders: PostFinishingMaterialTransferOrder[]
  materialStocks: PostFinishingMaterialStock[]
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

// CLEAN-008：保留原 storage key；值格式升级为 schema 2，当前格式不再进入旧派生分支。
// 删除旧读取器条件：所有需保留浏览器存储均已保存 schema 2 + migration 成功标记，
// 无版本/v1 历史入口全部完成迁移或明确退役，且历史回归通过后，移除旧格式分支并拒绝旧输入。
const STORAGE_KEY = 'higood-fcs-post-finishing-full-flow-v1'
let needsLegacyStateMigration = false
let hasPersistedFullFlowState = false
const LEGACY_OUTBOUND_STORAGE_KEY = 'higood-fcs-post-finishing-outbound-orders-v1'
const LEGACY_OUTBOUND_MIGRATION_MARKER_KEY = 'higood-fcs-post-finishing-outbound-migration-v2'
export const POST_FINISHING_DEMO_MODE_STORAGE_KEY = 'higood-fcs-post-finishing-demo-mode-v1'
const RETURN_TOLERANCE_RATE = 0.05
export const POST_FINISHING_RETURN_DIFFERENCE_POLICY = Object.freeze({
  toleranceRate: RETURN_TOLERANCE_RATE,
  denominator: '工厂登记数量' as const,
  frontlineEditable: false,
})

export const POST_FINISHING_QC_DEFECT_REASON_OPTIONS = Object.freeze([
  '做工原因',
  '脏污',
  '抽纱',
  '做错',
  '布料原因',
  '缺辅料',
  '做毁',
  '印花',
  '色差',
  '半套',
  '破洞',
  '缺辅料不补',
] as const)

export const POST_FINISHING_DEFECT_REASON_OPTIONS = Object.freeze([
  ...POST_FINISHING_QC_DEFECT_REASON_OPTIONS,
  '尺寸偏差',
  '压痕',
  '破损',
  '车缝不良',
  '其他',
] as const)

function normalizePostFinishingProcessItem(value: string): PostFinishingProcessItem | undefined {
  const normalized = value.trim() === '熨烫和包装' ? '烫包' : value.trim()
  return POST_FINISHING_PROCESS_ITEMS.includes(normalized as PostFinishingProcessItem)
    ? normalized as PostFinishingProcessItem
    : undefined
}

export function isPostFinishingDedicatedMaterial(input: {
  materialName: string
  materialSpuCode: string
}): boolean {
  const materialName = input.materialName.trim()
  const materialSpuCode = input.materialSpuCode.trim().toUpperCase()
  return ['吊牌', '吊粒', '扣', '扣子'].some((keyword) => materialName.includes(keyword))
    || materialSpuCode.startsWith('FLBF')
}

export function isMaterialRequiringCutting(input: {
  materialId: string
  bomLinkedPatternIds?: string[]
  patternLinkedMaterialIds?: string[]
}): boolean {
  return Boolean(input.bomLinkedPatternIds?.length)
    || Boolean(input.patternLinkedMaterialIds?.includes(input.materialId))
}

export function listPostFinishingQcReworkFactoryOptions(): Array<{ value: string; label: string }> {
  return listSewingFactoryMasterRecords()
    .map((factory) => ({ value: factory.name, label: `${factory.name}（${factory.code}）` }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

const COLORS = ['黑色', '白色', '雾蓝', '卡其', '酒红']
const SIZES = ['S', 'M', 'L', 'XL', '2XL']
const ORDER_SEEDS = [
  { no: 'PO-QC-202608-001', styleNo: 'HG-QC-001', styleName: '后道验收衬衫', imageUrl: '/shirt-sample.jpg', spuCode: 'SPU-QC-001', styleGrade: 'C', buyerName: '臻臻', productionOrderType: '首单', tagPrice: 264000 },
  { no: 'PO-QC-202608-002', styleNo: 'HG-QC-002', styleName: '后道验收连衣裙', imageUrl: '/dress-sample-1.jpg', spuCode: 'SPU-QC-002', styleGrade: 'B', buyerName: '阿乐', productionOrderType: '翻单', tagPrice: 289000 },
  { no: 'PO-QC-202608-003', styleNo: 'HG-QC-003', styleName: '后道验收外套', imageUrl: '/jacket-sample.jpg', spuCode: 'SPU-QC-003', styleGrade: 'B', buyerName: '小雨', productionOrderType: '首单', tagPrice: 319000 },
] as const

const QC_PRINT_MATERIALS: PostFinishingQcPrintMaterial[] = [
  { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-black', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-fadfad', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '纯白色染色纽扣 1.1cm', materialCode: 'FLSZ25111845-black-322', unitConsumption: '3 PCS', materialUsed: '', imageUrl: '/materials/accessory-button.jpg' },
  { materialName: '后道包装辅件', materialCode: 'FLBF2609001-white', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '印尼车边 polyester 线', materialCode: 'IDSZFL24093-b349', unitConsumption: '0.001 CNS', materialUsed: '', imageUrl: '/materials/yarn-stitching.jpg' },
  { materialName: '印尼 cotton 平车线', materialCode: 'IDSZFL24092-b349', unitConsumption: '0.001 DZ', materialUsed: '', imageUrl: '/materials/yarn-stitching.jpg' },
]

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
  styleGrade: seed.styleGrade,
  buyerName: seed.buyerName,
  productionOrderType: seed.productionOrderType,
  saleType: '预售',
  tagPrice: seed.tagPrice,
  qcPrintMaterials: QC_PRINT_MATERIALS.map((item) => ({ ...item })),
  qcPrintSizeRows: SIZES.map((sizeName, sizeIndex) => ({
    sizeName,
    backLength: `${64 + sizeIndex}cm`,
    shoulderWidth: `${35 + sizeIndex}cm`,
    bust: `${114 + sizeIndex * 4}cm`,
    sleeveLength: `${59 + sizeIndex}cm`,
    cuff: `${16 + sizeIndex}cm`,
  })),
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
    schemaVersion: 2,
    deliveries: [],
    waitProcessWarehouseRecords: [],
    waitProcessWarehouseMovements: [],
    waitHandoverWarehouseRecords: [],
    waitHandoverWarehouseMovements: [],
    returnConfirmationVersions: [],
    qcTasks: [],
    postTasks: [],
    recheckOrders: [],
    outboundOrders: [],
    warehouseReceipts: [],
    defects: [],
    materialTransferOrders: [],
    materialStocks: [],
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
  let sourceRaw: string | null = null
  try {
    sourceRaw = globalThis.localStorage?.getItem(STORAGE_KEY) || null
    const parsed = sourceRaw ? JSON.parse(sourceRaw) as Partial<Omit<PostFinishingFullFlowState, 'schemaVersion'>> & { schemaVersion?: number } : undefined
    if (sourceRaw && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new Error('保存内容不是后道数据对象')
    }
    const sourceSchemaVersion = parsed?.schemaVersion
    if (sourceSchemaVersion !== undefined && sourceSchemaVersion !== 1 && sourceSchemaVersion !== 2) {
      throw new Error(`不支持后道数据格式 schema ${sourceSchemaVersion}，原始保存内容未修改`)
    }
    if (sourceSchemaVersion === 2 && Object.keys(emptyState()).some((key) => key !== 'schemaVersion' && !Array.isArray(parsed?.[key as keyof PostFinishingFullFlowState]))) {
      throw new Error('后道 schema 2 缺少必要事实集合，原始保存内容未修改')
    }

    // 旧“复检后平行出货单”无法无损映射为当前 QC / 后道加工事实，且不得继续成为可写事实。
    // 只做一次显式退役；当前出货事实统一由本模块在 QC 直达或处理后复核完成时生成。
    // CLEAN-008 删除条件：需保留的旧独立出货存储均已 archive 且 marker=retired，
    // 旧写入者/消费者归零后可删除本退役分支；archive 按历史留存确认单独删除，不恢复为当前账。
    if (globalThis.localStorage?.getItem(LEGACY_OUTBOUND_MIGRATION_MARKER_KEY) !== 'retired') {
      const legacyRaw = globalThis.localStorage?.getItem(LEGACY_OUTBOUND_STORAGE_KEY)
      if (legacyRaw) {
        // 无法确认来源的旧演示单保留只读原始快照，不伪造为当前实收或直接丢弃。
        globalThis.localStorage?.setItem(`${LEGACY_OUTBOUND_STORAGE_KEY}:archive`, JSON.stringify({
          schemaVersion: 1,
          sourceKey: LEGACY_OUTBOUND_STORAGE_KEY,
          retiredAt: nowIso(),
          raw: legacyRaw,
        }))
      }
      globalThis.localStorage?.removeItem(LEGACY_OUTBOUND_STORAGE_KEY)
      globalThis.localStorage?.setItem(LEGACY_OUTBOUND_MIGRATION_MARKER_KEY, 'retired')
    }
    if (!parsed || !sourceRaw) return emptyState()
    hasPersistedFullFlowState = true
    if (sourceSchemaVersion === 2) return parsed as PostFinishingFullFlowState
    needsLegacyStateMigration = true
    const deliveries = (Array.isArray(parsed.deliveries) ? parsed.deliveries : []).map(backfillDeliveryExecutionIdentity)
    return {
      schemaVersion: 2,
      migration: {
        requirementId: 'CLEAN-008',
        sourceSchemaVersion: sourceSchemaVersion === 1 ? 1 : 'unversioned',
        completedAt: '',
        legacyRaw: sourceRaw,
      },
      deliveries,
      waitProcessWarehouseRecords: Array.isArray(parsed.waitProcessWarehouseRecords) ? parsed.waitProcessWarehouseRecords : [],
      waitProcessWarehouseMovements: Array.isArray(parsed.waitProcessWarehouseMovements) ? parsed.waitProcessWarehouseMovements : [],
      waitHandoverWarehouseRecords: Array.isArray(parsed.waitHandoverWarehouseRecords)
        ? parsed.waitHandoverWarehouseRecords.map((record) => {
            const delivery = deliveries.find((item) => item.deliveryId === record.deliveryId)
            return {
              ...record,
              responsibility: normalizeResponsibilitySnapshot(
                record.responsibility,
                delivery?.sewingTaskType || 'INDEPENDENT_SEWING',
                record.createdAt || delivery?.confirmedAt || delivery?.registeredAt,
                !record.responsibility && !delivery,
              ),
              sourceType: record.sourceType || (record.postTaskId ? '后道加工后' : '质检直达'),
              areaName: '处理后待交出区',
            }
          })
        : [],
      waitHandoverWarehouseMovements: Array.isArray(parsed.waitHandoverWarehouseMovements) ? parsed.waitHandoverWarehouseMovements : [],
      returnConfirmationVersions: Array.isArray(parsed.returnConfirmationVersions)
        ? parsed.returnConfirmationVersions.map((version) => ({
            ...version,
            versionCreatedAt: version.versionCreatedAt || version.confirmedAt,
          }))
        : deriveLegacyConfirmationVersions(deliveries),
      qcTasks: Array.isArray(parsed.qcTasks)
        ? parsed.qcTasks.map((task) => {
            const {
              needPostFinishing: _legacyNeedPostFinishing,
              ...taskWithoutLegacyNeedPostFinishing
            } = task as PostFinishingQcTask & { needPostFinishing?: boolean }
            const delivery = deliveries.find((item) => item.deliveryId === task.deliveryId)
            const responsibility = normalizeResponsibilitySnapshot(
              task.responsibility,
              delivery?.sewingTaskType || 'INDEPENDENT_SEWING',
              task.createdAt || task.sentAt || delivery?.confirmedAt || delivery?.registeredAt,
              !task.responsibility && !delivery,
            )
            return {
              ...taskWithoutLegacyNeedPostFinishing,
              responsibility,
              frozenProcessItems: task.frozenProcessItems?.map(normalizePostFinishingProcessItem).filter((item): item is PostFinishingProcessItem => Boolean(item)),
              createdBy: task.createdBy || task.sentBy || delivery?.confirmedBy || POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
              createdAt: task.createdAt || task.sentAt || delivery?.confirmedAt || delivery?.registeredAt || nowIso(),
            }
          })
        : [],
      postTasks: Array.isArray(parsed.postTasks)
        ? parsed.postTasks.map((task) => {
            const delivery = deliveries.find((item) => item.deliveryId === task.deliveryId)
            const legacyTask = task as unknown as {
              draftLines?: Array<PostFinishingPostDraftLine & {
                completedQty?: number
                defectQty?: number
                returnQty?: number
              }>
              results?: Array<PostFinishingPostResultLine & {
                completedQty?: number
                passedQty?: number
                defectQty?: number
                returnQty?: number
              }>
            }
            const responsibility = normalizeResponsibilitySnapshot(
              task.responsibility,
              delivery?.sewingTaskType || 'INDEPENDENT_SEWING',
              (task as PostFinishingPostTask & { createdAt?: string }).createdAt || delivery?.confirmedAt || delivery?.registeredAt,
              !task.responsibility && !delivery,
            )
            return {
              ...task,
              responsibility,
              sourceType: task.sourceType || (responsibility.responsibilityMode === 'POST_FACTORY' ? '任务后道' : '质检补加工'),
              processItems: task.processItems.map(normalizePostFinishingProcessItem).filter((item): item is PostFinishingProcessItem => Boolean(item)),
              draftLines: legacyTask.draftLines?.map((draft) => {
                const expectedQty = task.lines.find((line) => line.sku.skuId === draft.skuId)?.expectedQty || 0
                const legacyExceptionQty = (draft.defectQty || 0) + (draft.returnQty || 0)
                const processedQty = draft.processedQty
                  ?? Math.max(0, (draft.completedQty || 0) - legacyExceptionQty)
                return {
                  skuId: draft.skuId,
                  processedQty,
                  unprocessedQty: draft.unprocessedQty
                    ?? (task.status === '后道完成' ? Math.max(0, expectedQty - processedQty) : 0),
                  unprocessedReason: draft.unprocessedReason
                    ?? (legacyExceptionQty > 0 ? '历史后道异常记录已保留在操作日志中' : undefined),
                  updatedBy: draft.updatedBy,
                  updatedAt: draft.updatedAt,
                }
              }),
              results: legacyTask.results?.map((result) => {
                const processedQty = result.processedQty
                  ?? result.passedQty
                  ?? Math.max(0, (result.completedQty || 0) - (result.defectQty || 0) - (result.returnQty || 0))
                const legacyExceptionQty = (result.defectQty || 0) + (result.returnQty || 0)
                return {
                  sku: result.sku,
                  expectedQty: result.expectedQty,
                  processedQty,
                  unprocessedQty: result.unprocessedQty ?? Math.max(0, result.expectedQty - processedQty),
                  unprocessedReason: result.unprocessedReason
                    ?? (legacyExceptionQty > 0 ? '历史后道异常记录已保留在操作日志中' : undefined),
                }
              }),
            }
          })
        : [],
      recheckOrders: Array.isArray(parsed.recheckOrders)
        ? parsed.recheckOrders.map((record) => {
            const delivery = deliveries.find((item) => item.deliveryId === record.deliveryId)
            return {
              ...record,
              responsibility: normalizeResponsibilitySnapshot(
                record.responsibility,
                delivery?.sewingTaskType || 'INDEPENDENT_SEWING',
                (record as PostFinishingRecheckOrder & { createdAt?: string }).createdAt || delivery?.confirmedAt || delivery?.registeredAt,
                !record.responsibility && !delivery,
              ),
              sourceType: record.sourceType || (record.postTaskId ? '后道加工后' : '质检直达'),
              lines: record.lines.map((line) => {
                const legacyLine = line as PostFinishingRecheckLine & { passedQty?: number }
                return {
                  sku: line.sku,
                  expectedQty: line.expectedQty,
                  handoverQty: line.handoverQty ?? legacyLine.passedQty,
                  barcodeStatus: line.barcodeStatus,
                  lastScannedBarcode: line.lastScannedBarcode,
                  barcodeEvents: line.barcodeEvents,
                }
              }),
            }
          })
        : [],
      outboundOrders: Array.isArray(parsed.outboundOrders)
        ? parsed.outboundOrders.map((record) => {
            const delivery = deliveries.find((item) => item.deliveryId === record.deliveryId)
            return {
              ...record,
              responsibility: normalizeResponsibilitySnapshot(
                record.responsibility,
                delivery?.sewingTaskType || 'INDEPENDENT_SEWING',
                record.createdAt || delivery?.confirmedAt || delivery?.registeredAt,
                !record.responsibility && !delivery,
              ),
              sourceType: record.sourceType || (record.postTaskId ? '后道加工后' : '质检直达'),
            }
          })
        : [],
      warehouseReceipts: Array.isArray(parsed.warehouseReceipts) ? parsed.warehouseReceipts : [],
      defects: Array.isArray(parsed.defects) ? parsed.defects : [],
      materialTransferOrders: Array.isArray(parsed.materialTransferOrders) ? parsed.materialTransferOrders : [],
      materialStocks: Array.isArray(parsed.materialStocks) ? parsed.materialStocks : [],
    }
  } catch (error) {
    // 已存在的未知/损坏数据不能当空库启动并被演示数据覆盖。
    if (sourceRaw) throw new Error(`后道历史数据读取失败：${error instanceof Error ? error.message : String(error)}`)
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

function quantityDifferenceRate(expectedQty: number, actualQty: number): number {
  if (expectedQty === 0) return actualQty === 0 ? 0 : 1
  return Math.abs(actualQty - expectedQty) / expectedQty
}

function differenceDirection(value: number): '多' | '少' | '一致' {
  if (value > 0) return '多'
  if (value < 0) return '少'
  return '一致'
}

function buildPostFinishingMaterialTransferDemo(): PostFinishingMaterialTransferOrder | undefined {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.sewingTaskType === 'INDEPENDENT_SEWING')
  if (!order) return undefined
  const garmentQty = total(order.skus.map((sku) => sku.plannedQty))
  const lines = order.qcPrintMaterials.flatMap((material, index) => {
    const materialSpuCode = material.materialCode.split('-')[0] || material.materialCode
    if (!isPostFinishingDedicatedMaterial({ materialName: material.materialName, materialSpuCode })) return []
    const consumptionMatch = material.unitConsumption.match(/^([0-9.]+)\s*(\S+)/)
    const consumption = Number(consumptionMatch?.[1] || 1)
    const unit = consumptionMatch?.[2] || 'PCS'
    const requestedQty = Math.max(1, Math.round(garmentQty * consumption))
    const preparedQty = index === 0 ? Math.max(1, requestedQty - 5) : requestedQty
    return [{
      transferLineId: `PF-MTL-${String(index + 1).padStart(3, '0')}`,
      materialName: material.materialName,
      materialCode: material.materialCode,
      materialSpuCode,
      specification: material.materialCode.split('-').slice(1).join(' / ') || '标准规格',
      unit,
      requestedQty,
      preparedQty,
      imageUrl: material.imageUrl,
    }]
  })
  const createdAt = new Date(Date.UTC(2026, 7, 24, 1, 0, 0)).toISOString()
  const approvedAt = new Date(Date.UTC(2026, 7, 24, 3, 0, 0)).toISOString()
  const readyAt = new Date(Date.UTC(2026, 7, 24, 7, 30, 0)).toISOString()
  return {
    transferOrderId: `PF-MT-${order.productionOrderId}`,
    transferOrderNo: 'DB-PF-202608-001',
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    styleNo: order.styleNo,
    styleName: order.styleName,
    styleImageUrl: order.skus[0]?.imageUrl || '',
    sewingTaskNo: order.sewingTaskNo,
    responsibility: resolvePostFinishingResponsibility(order.sewingTaskType),
    sourceWarehouseName: '辅料仓',
    targetWarehouseName: '后道待加工仓',
    targetAreaName: '后道辅料暂存区',
    targetLocationCode: 'PF-MAT-A01-01',
    status: '待入库',
    lines,
    statusHistory: [
      { status: '申请调拨', operatedAt: createdAt, operatorName: 'PPIC 配料计划员', remark: '按仅车缝任务生成后道辅料调拨申请' },
      { status: '待调拨', operatedAt: approvedAt, operatorName: '辅料仓主管', remark: '调拨申请审核通过' },
      { status: '待入库', operatedAt: readyAt, operatorName: '辅料仓配料员', remark: '已按实际配料数量一次性备妥，等待后道领料入库' },
    ],
    createdAt,
    updatedAt: readyAt,
  }
}

function ensurePostFinishingMaterialTransferDemo(): void {
  if (state.materialTransferOrders.length > 0) return
  const transfer = buildPostFinishingMaterialTransferDemo()
  if (!transfer) return
  state.materialTransferOrders.push(transfer)
  transfer.statusHistory.forEach((history, index) => appendPostFinishingOperationLog({
    logId: `PF-LOG-MATERIAL-${index + 1}`,
    stage: '辅料调拨',
    objectType: '后道辅料调拨单',
    objectId: transfer.transferOrderId,
    objectNo: transfer.transferOrderNo,
    productionOrderNo: transfer.productionOrderNo,
    action: index === 0 ? '创建调拨申请' : index === 1 ? '审核通过进入待调拨' : '辅料仓整单备妥',
    operatorId: `PF-MATERIAL-${index + 1}`,
    operatorName: history.operatorName,
    operatedAt: history.operatedAt,
    beforeStatus: index === 0 ? '未创建' : transfer.statusHistory[index - 1].status,
    afterStatus: history.status,
    afterQuantity: index === 2 ? total(transfer.lines.map((line) => line.preparedQty)) : undefined,
    result: '成功',
    remark: history.remark,
  }))
  persist()
}

export function listPostFinishingMaterialTransferOrders(): PostFinishingMaterialTransferOrder[] {
  ensurePostFinishingMaterialTransferDemo()
  return clone(state.materialTransferOrders).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getPostFinishingMaterialTransferOrder(
  transferOrderIdOrNo: string,
): PostFinishingMaterialTransferOrder | undefined {
  ensurePostFinishingMaterialTransferDemo()
  const record = state.materialTransferOrders.find((item) => (
    item.transferOrderId === transferOrderIdOrNo || item.transferOrderNo === transferOrderIdOrNo
  ))
  return record ? clone(record) : undefined
}

export function getPostFinishingMaterialReadiness(productionOrderNo: string): {
  applicable: boolean
  status: PostFinishingMaterialTransferStatus | '不适用'
  label: string
  transferOrderNo?: string
} {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === productionOrderNo)
  const hasFrozenButtonProject = state.qcTasks.some((task) => (
    task.productionOrderNo === productionOrderNo
    && Boolean(task.completedAt)
    && task.frozenProcessItems?.includes('装扣子')
  ))
  // 历史示例保留其既有调拨事实；正式新单以本单本批已确认 QC 项目为依据。
  if (!hasFrozenButtonProject && (!order || order.sewingTaskType !== 'INDEPENDENT_SEWING')) {
    return { applicable: false, status: '不适用', label: '当前没有已确认的装扣子项目，无需后道扣子调拨' }
  }
  const transfer = listPostFinishingMaterialTransferOrders().find((item) => item.productionOrderNo === productionOrderNo)
  if (!transfer) return { applicable: true, status: '申请调拨', label: '后道辅料尚未形成调拨单' }
  const labelByStatus: Record<PostFinishingMaterialTransferStatus, string> = {
    申请调拨: '后道辅料尚未备妥，请关注调拨进度',
    待调拨: '后道辅料尚未备妥，请关注调拨进度',
    待入库: '后道辅料已由辅料仓备妥，请领料并完成入库',
    已入库: '后道辅料已入后道待加工仓',
  }
  return { applicable: true, status: transfer.status, label: labelByStatus[transfer.status], transferOrderNo: transfer.transferOrderNo }
}

export function listPostFinishingMaterialStocks(): PostFinishingMaterialStock[] {
  return clone(state.materialStocks).sort((left, right) => right.inboundAt.localeCompare(left.inboundAt))
}

export function receivePostFinishingMaterialTransfer(input: {
  transferOrderNo: string
  actor: PostFinishingActor
  nowMs?: number
}): { transfer: PostFinishingMaterialTransferOrder; alreadyInbound: boolean } {
  ensurePostFinishingMaterialTransferDemo()
  const transfer = state.materialTransferOrders.find((item) => item.transferOrderNo === input.transferOrderNo.trim())
  if (!transfer) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到完整辅料调拨单号 ${input.transferOrderNo.trim()}。`)
  if (transfer.status === '已入库') return { transfer: clone(transfer), alreadyInbound: true }
  if (transfer.status !== '待入库') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `调拨单当前为${transfer.status}，辅料仓备妥后才能入库。`)
  }
  const operatedAt = nowIso(input.nowMs)
  transfer.status = '已入库'
  transfer.updatedAt = operatedAt
  transfer.inboundAt = operatedAt
  transfer.inboundBy = clone(input.actor)
  transfer.statusHistory.push({
    status: '已入库',
    operatedAt,
    operatorName: input.actor.actorName,
    remark: '后道领料回厂后按调出方实际配料数量整单入库',
  })
  transfer.lines.forEach((line) => {
    const existing = state.materialStocks.find((item) => item.transferOrderId === transfer.transferOrderId && item.material.transferLineId === line.transferLineId)
    if (existing) return
    state.materialStocks.push({
      stockId: `PF-MS-${line.transferLineId}`,
      transferOrderId: transfer.transferOrderId,
      transferOrderNo: transfer.transferOrderNo,
      productionOrderNo: transfer.productionOrderNo,
      material: clone(line),
      currentQty: line.preparedQty,
      inboundQty: line.preparedQty,
      areaName: transfer.targetAreaName,
      locationCode: transfer.targetLocationCode,
      inboundAt: operatedAt,
      inboundBy: clone(input.actor),
    })
  })
  appendPostFinishingOperationLog({
    stage: '辅料调拨',
    objectType: '后道辅料调拨单',
    objectId: transfer.transferOrderId,
    objectNo: transfer.transferOrderNo,
    productionOrderNo: transfer.productionOrderNo,
    action: '整单确认入库',
    operatorId: input.actor.actorId,
    operatorName: input.actor.actorName,
    operatedAt,
    beforeStatus: '待入库',
    afterStatus: '已入库',
    beforeQuantity: total(transfer.lines.map((line) => line.preparedQty)),
    afterQuantity: total(transfer.lines.map((line) => line.preparedQty)),
    result: '成功',
    remark: '以调出方实际配料数量为准；整单一次性入库；不使用成衣差异授权',
  })
  persist()
  return { transfer: clone(transfer), alreadyInbound: false }
}

function buildWaitProcessWarehouseRecord(
  delivery: PostFinishingFactoryReturnDelivery,
): PostFinishingWaitProcessWarehouseRecord {
  const discarded = delivery.status === '已废弃'
  const hasConfirmed = Boolean(delivery.confirmedAt)
  const hasSent = delivery.status === '已送检' || delivery.status === '已完成'
  return {
    warehouseRecordId: `PF-WPW-${delivery.deliveryId}`,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    returnIndex: delivery.returnIndex,
    sewingFactoryName: delivery.sewingFactoryName,
    areaName: '车缝回货暂存区',
    locationCode: `WP-${delivery.productionOrderId}-${delivery.returnIndex}`,
    status: discarded ? '已废弃' : hasSent ? '已送检' : hasConfirmed ? '待送检' : '待确认',
    lines: delivery.lines.map((line) => ({
      sku: clone(line.sku),
      registeredQty: line.registeredQty,
      confirmedQty: line.confirmedQty || 0,
      availableQty: !discarded && hasConfirmed && !hasSent ? line.confirmedQty || 0 : 0,
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
    if (qcTask && (delivery.status === '已送检' || delivery.status === '已完成') && qcTask.sentAt && qcTask.sentBy) {
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

function adaptFormalReturnSource(source: FormalPostFinishingReturnSource): PostFinishingAcceptanceProductionOrder {
  return {
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleNo: source.styleNo,
    styleName: source.styleName,
    executionTaskId: source.executionTaskId,
    sewingTaskNo: source.sourceTaskNo,
    assignmentId: source.assignmentId,
    sewingTaskType: source.responsibilityType,
    defaultStagingLocation: source.defaultStagingLocation,
    sewingFactoryId: source.sourceFactoryId,
    sewingFactoryName: source.sourceFactoryName,
    managedPostFactoryId: source.managedPostFactoryId,
    managedPostFactoryName: source.managedPostFactoryName,
    styleGrade: source.styleGrade,
    buyerName: source.buyerName,
    productionOrderType: source.productionOrderType,
    saleType: source.saleType,
    tagPrice: source.tagPrice,
    qcPrintMaterials: [],
    qcPrintSizeRows: source.skus.map((sku) => ({
      sizeName: sku.sizeName,
      backLength: '—',
      shoulderWidth: '—',
      bust: '—',
      sleeveLength: '—',
      cuff: '—',
    })),
    skus: source.skus.map((sku) => ({ ...sku })),
  }
}

function listFormalReturnSourceOrders(): Array<{
  order: PostFinishingAcceptanceProductionOrder
  sourceKind: FormalPostFinishingReturnSourceKind
}> {
  return buildFormalPostFinishingReturnSources({
    productionOrders,
    runtimeTasks: readRuntimeTasks<RuntimeProcessTask>(),
    woolStore: readPostFinishingWoolSourceStore(),
    specialCraftTaskOrders: readPostFinishingSpecialCraftSourceTaskOrders(),
  }).map((source) => ({
    order: adaptFormalReturnSource(source),
    sourceKind: source.sourceKind,
  }))
}

function getProductionOrder(
  productionOrderNo: string,
  executionTaskId?: string,
): PostFinishingAcceptanceProductionOrder {
  if (executionTaskId) {
    const formalOrder = listFormalReturnSourceOrders().find((item) => (
      item.order.productionOrderNo === productionOrderNo
      && item.order.executionTaskId === executionTaskId
    ))?.order
    const demoOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => (
      item.productionOrderNo === productionOrderNo
      && item.executionTaskId === executionTaskId
    ))
    const exactOrder = formalOrder || demoOrder
    if (!exactOrder) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到生产单 ${productionOrderNo} 对应的可回货任务。`)
    return exactOrder
  }
  const demoOrder = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === productionOrderNo)
  if (demoOrder) return demoOrder
  const formalOrders = listFormalReturnSourceOrders()
    .filter((item) => item.order.productionOrderNo === productionOrderNo)
    .map((item) => item.order)
  if (formalOrders.length === 1) return formalOrders[0]
  if (formalOrders.length > 1) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `生产单 ${productionOrderNo} 存在多个可回货任务，请扫描包含来源任务的回货码。`)
  }
  throw new PostFinishingFlowGateError('NOT_FOUND', `未找到生产单 ${productionOrderNo} 的可回货来源。`)
}

function assertNotKolWholeOrder(productionOrderIdOrNo: string): void {
  const formalOrder = productionOrders.find((order) => (
    order.productionOrderId === productionOrderIdOrNo
    || order.productionOrderNo === productionOrderIdOrNo
  ))
  if (formalOrder && isKolGotoProductionOrder(formalOrder)) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', 'KOL 样衣、KOL 小单整单任务直接对接成衣仓，不进入普通后道。')
  }
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

function getOrCreateQcTaskForConfirmedDelivery(input: {
  delivery: PostFinishingFactoryReturnDelivery
  actor: PostFinishingActor
  createdAt: string
  nowMs?: number
}): { task: PostFinishingQcTask; created: boolean } {
  const linked = (input.delivery.qcTaskId
    ? state.qcTasks.find((task) => task.qcTaskId === input.delivery.qcTaskId)
    : undefined)
    || state.qcTasks.find((task) => task.deliveryId === input.delivery.deliveryId)
  if (linked) {
    input.delivery.qcTaskId = linked.qcTaskId
    input.delivery.qcTaskNo = linked.qcTaskNo
    return { task: linked, created: false }
  }
  if (!input.delivery.confirmedAt) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '回货最终确认后才能自动生成质检单。')
  }
  const qcTaskId = `PF-QC-${input.delivery.productionOrderId}-${input.delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'QC',
    productionOrderNo: input.delivery.productionOrderNo,
    sourceObjectId: input.delivery.deliveryId,
    idempotencyKey: `QC:${input.delivery.deliveryId}`,
    sequence: input.delivery.returnIndex,
    existingDocumentNos: state.qcTasks
      .filter((task) => task.productionOrderNo === input.delivery.productionOrderNo)
      .map((task) => task.qcTaskNo),
  }, new Date(input.nowMs ?? new Date(input.createdAt).getTime()))
  const task: PostFinishingQcTask = {
    qcTaskId,
    qcTaskNo: number.documentNo,
    deliveryId: input.delivery.deliveryId,
    deliveryOrderNo: input.delivery.deliveryOrderNo,
    productionOrderId: input.delivery.productionOrderId,
    productionOrderNo: input.delivery.productionOrderNo,
    responsibility: resolvePostFinishingResponsibility(input.delivery.sewingTaskType, input.delivery.registeredAt),
    returnIndex: input.delivery.returnIndex,
    status: '待送检',
    lines: input.delivery.lines.map((line) => ({ sku: clone(line.sku), expectedQty: line.confirmedQty || 0 })),
    referenceIds: [],
    createdBy: clone(input.actor),
    createdAt: input.createdAt,
  }
  const references = bindPostFinishingQcReferences({
    deliveryId: input.delivery.deliveryId,
    qcTaskId,
    qcTaskNo: task.qcTaskNo,
  })
  task.referenceIds = references.map((record) => record.referenceId)
  state.qcTasks.push(task)
  input.delivery.qcTaskId = task.qcTaskId
  input.delivery.qcTaskNo = task.qcTaskNo
  return { task, created: true }
}

function findPostTask(postTaskIdOrNo: string): PostFinishingPostTask {
  const task = state.postTasks.find((item) => item.postTaskId === postTaskIdOrNo || item.postTaskNo === postTaskIdOrNo)
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', `未找到后道加工单 ${postTaskIdOrNo}。`)
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
  const outboundId = recheck?.outboundOrderId || qcTask?.outboundOrderId
  const outbound = outboundId
    ? state.outboundOrders.find((item) => item.outboundOrderId === outboundId)
    : state.outboundOrders.find((item) => item.deliveryId === delivery.deliveryId)
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

export function getPostFinishingReturnSourceScanValue(
  productionOrderNo: string,
  returnIndex: number,
  executionTaskId?: string,
): string {
  const base = `PFRETURN:${encodeURIComponent(productionOrderNo)}:${returnIndex}`
  return executionTaskId ? `${base}:${encodeURIComponent(executionTaskId)}` : base
}

export function resolvePostFinishingReturnRegistrationSource(scanValue: string): {
  productionOrder: PostFinishingAcceptanceProductionOrder
  returnIndex: number
  sourceKind?: FormalPostFinishingReturnSourceKind
} {
  const parts = scanValue.trim().split(':')
  if (parts.length !== 3 && parts.length !== 4) {
    throw new PostFinishingFlowGateError('NOT_FOUND', '未识别到完整回货来源码，请重新扫描。')
  }
  let productionOrderNo = ''
  let executionTaskId: string | undefined
  try {
    productionOrderNo = decodeURIComponent(parts[1] || '').trim()
    executionTaskId = parts[3] ? decodeURIComponent(parts[3]).trim() : undefined
  } catch {
    throw new PostFinishingFlowGateError('NOT_FOUND', '回货来源码格式错误，请重新扫描。')
  }
  const returnIndex = Number(parts[2])
  if (parts[0] !== 'PFRETURN' || !productionOrderNo || !Number.isInteger(returnIndex) || returnIndex < 1) {
    throw new PostFinishingFlowGateError('NOT_FOUND', '未识别到完整回货来源码，请重新扫描。')
  }
  assertNotKolWholeOrder(productionOrderNo)
  const productionOrder = getProductionOrder(productionOrderNo, executionTaskId)
  const sourceKind = executionTaskId
    ? listFormalReturnSourceOrders().find((item) => item.order.executionTaskId === executionTaskId)?.sourceKind
    : undefined
  return { productionOrder: clone(productionOrder), returnIndex, sourceKind }
}

export function listPostFinishingReturnRegistrationSources(): Array<{
  scanValue: string
  productionOrderNo: string
  returnIndex: number
  skuCount: number
  executionTaskId?: string
  sourceTaskNo?: string
  sourceKind?: FormalPostFinishingReturnSourceKind
}> {
  const demoSources = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS
    .filter((order) => {
      const formalOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId || item.productionOrderNo === order.productionOrderNo)
      return !formalOrder || !isKolGotoProductionOrder(formalOrder)
    })
    .flatMap((order) => [1, 2, 3, 4, 5].map((returnIndex) => ({
    scanValue: getPostFinishingReturnSourceScanValue(order.productionOrderNo, returnIndex),
    productionOrderNo: order.productionOrderNo,
    returnIndex,
    skuCount: order.skus.length,
  })))
  const eligibleFormalSources = listFormalReturnSourceOrders().filter(({ order }) => {
    const registeredBySku = new Map<string, number>()
    state.deliveries
      .filter((delivery) => delivery.executionTaskId === order.executionTaskId && delivery.status !== '已废弃')
      .flatMap((delivery) => delivery.lines)
      .forEach((line) => registeredBySku.set(line.sku.skuId, (registeredBySku.get(line.sku.skuId) || 0) + line.registeredQty))
    return order.skus.some((sku) => (registeredBySku.get(sku.skuId) || 0) < sku.plannedQty)
  })
  const nextReturnIndexByOrder = new Map<string, number>()
  const formalSources = eligibleFormalSources.map(({ order, sourceKind }) => {
    const lastRegisteredIndex = Math.max(0, ...state.deliveries
      .filter((delivery) => delivery.productionOrderNo === order.productionOrderNo)
      .map((delivery) => delivery.returnIndex))
    const returnIndex = nextReturnIndexByOrder.get(order.productionOrderNo) || lastRegisteredIndex + 1
    nextReturnIndexByOrder.set(order.productionOrderNo, returnIndex + 1)
    return {
      scanValue: getPostFinishingReturnSourceScanValue(order.productionOrderNo, returnIndex, order.executionTaskId),
      productionOrderNo: order.productionOrderNo,
      returnIndex,
      skuCount: order.skus.length,
      executionTaskId: order.executionTaskId,
      sourceTaskNo: order.sewingTaskNo,
      sourceKind,
    }
  })
  return [...demoSources, ...formalSources]
}

export function registerPostFinishingFactoryReturn(input: {
  productionOrderNo: string
  executionTaskId?: string
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
  if (!input.actor.roleName.trim() || /PPIC/i.test(input.actor.roleName) || !/(车缝厂送货人员|工厂|factory|ROLE_OPERATOR)/i.test(input.actor.roleName)) {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '回货登记只能由车缝工厂送货人员或已登录工厂账号发起，PPIC只能读取后道回货结果。')
  }
  assertNotKolWholeOrder(input.productionOrderNo)
  const order = getProductionOrder(input.productionOrderNo, input.executionTaskId)
  const conflictingResponsibility = state.deliveries.find((item) => (
    item.productionOrderNo === order.productionOrderNo && item.sewingTaskType !== order.sewingTaskType
  ))
  if (conflictingResponsibility) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '同一生产单存在不一致的车缝任务范围，请联系 PPIC 修正后再操作。')
  }
  if (!Number.isInteger(input.returnIndex) || input.returnIndex < 1) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '回货序号必须是大于 0 的整数。')
  }
  if (!input.deliveryPersonName.trim()) throw new Error('请填写送货人姓名。')
  if (!input.evidenceImageUrls.length) throw new Error('请上传至少一张现场凭证图片。')
  const existing = state.deliveries.find((item) => item.idempotencyKey === input.idempotencyKey)
  if (existing) return clone(existing)
  const duplicateReturn = state.deliveries.find((item) => item.productionOrderNo === input.productionOrderNo && item.returnIndex === input.returnIndex)
  if (duplicateReturn) {
    if (duplicateReturn.status === '已废弃') {
      throw new PostFinishingFlowGateError('INVALID_STATUS', `生产单 ${input.productionOrderNo} 的第 ${input.returnIndex} 次回货已废弃，请使用新的回货序号重新登记。`)
    }
    if (duplicateReturn.executionTaskId === order.executionTaskId) return clone(duplicateReturn)
    throw new PostFinishingFlowGateError('INVALID_STATUS', `生产单 ${input.productionOrderNo} 的第 ${input.returnIndex} 次回货已由其他来源任务登记。`)
  }
  const requestedSkuIds = new Set<string>()
  input.quantities.forEach((item) => {
    if (requestedSkuIds.has(item.skuId)) {
      throw new PostFinishingFlowGateError('INVALID_QUANTITY', `SKU ${item.skuId} 的回货数量不能重复提交。`)
    }
    requestedSkuIds.add(item.skuId)
    if (!order.skus.some((sku) => sku.skuId === item.skuId)) {
      throw new PostFinishingFlowGateError('INVALID_QUANTITY', `SKU ${item.skuId} 不属于当前回货来源任务。`)
    }
  })
  const lines = order.skus.map((sku) => {
    const quantity = input.quantities.find((item) => item.skuId === sku.skuId)?.registeredQty ?? 0
    assertIntegerQuantity(Number(quantity), { label: `SKU ${sku.skuCode} 回货登记数量` })
    return { sku: clone(sku), registeredQty: Number(quantity) }
  })
  if (total(lines.map((line) => line.registeredQty)) <= 0) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '本次回货至少要有一个 SKU 的登记数量大于 0。')
  }
  const historicalBySku = new Map<string, number>()
  state.deliveries
    .filter((delivery) => delivery.executionTaskId === order.executionTaskId && delivery.status !== '已废弃')
    .flatMap((delivery) => delivery.lines)
    .forEach((line) => historicalBySku.set(line.sku.skuId, (historicalBySku.get(line.sku.skuId) || 0) + line.registeredQty))
  lines.forEach((line) => {
    const cumulativeQty = (historicalBySku.get(line.sku.skuId) || 0) + line.registeredQty
    if (cumulativeQty > line.sku.plannedQty) {
      throw new PostFinishingFlowGateError(
        'INVALID_QUANTITY',
        `SKU ${line.sku.skuCode} 累计回货 ${cumulativeQty} 件，超过来源任务可交出 ${line.sku.plannedQty} 件。`,
      )
    }
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
    afterQuantity: total(lines.map((line) => line.registeredQty)),
    remark: `${input.triggerSource}；${lines.filter((line) => line.registeredQty > 0).length} 个 SKU 有回货数量（来源共 ${lines.length} 个 SKU）`,
  })
  return clone(delivery)
}

export function canDiscardPostFinishingFactoryReturn(record: PostFinishingFactoryReturnDelivery): boolean {
  return ['待后道确认', '待二次点数', '差异待授权'].includes(record.status)
    && !record.confirmedAt
    && !record.qcTaskId
}

export function discardPostFinishingFactoryReturn(input: {
  deliveryId: string
  reason: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  const delivery = findDelivery(input.deliveryId)
  if (!canDiscardPostFinishingFactoryReturn(delivery)) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `送货单当前为${delivery.status}，已完成最终接收或已进入质检链路，不能废弃。`)
  }
  const isRegistrant = delivery.registeredBy.actorId === input.actor.actorId
  const isFactoryOperator = /(车缝厂送货人员|工厂|factory|ROLE_OPERATOR)/i.test(input.actor.roleName)
  const isReturnManager = /回货确认|回货主管/.test(input.actor.roleName)
  if (/PPIC/i.test(input.actor.roleName) || (!isRegistrant && !isFactoryOperator && !isReturnManager)) {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '只有车缝工厂回货登记岗位或后道回货确认岗位可以废弃尚未完成最终接收的回货记录。')
  }
  const reason = input.reason.trim()
  if (!reason) throw new Error('请填写废弃原因。')

  const beforeStatus = delivery.status
  const discardedAt = nowIso(input.nowMs)
  delivery.status = '已废弃'
  delivery.discardedAt = discardedAt
  delivery.discardedBy = clone(input.actor)
  delivery.discardReason = reason
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  warehouseRecord.status = '已废弃'
  warehouseRecord.confirmedAt = undefined
  warehouseRecord.confirmedBy = undefined
  warehouseRecord.lines = delivery.lines.map((line) => ({
    sku: clone(line.sku),
    registeredQty: line.registeredQty,
    confirmedQty: 0,
    availableQty: 0,
  }))
  persist()
  appendBusinessLog({
    stage: '送货登记', delivery, objectType: '送货单', objectId: delivery.deliveryId, objectNo: delivery.deliveryOrderNo,
    action: '废弃回货记录', actor: input.actor, operatedAt: discardedAt, beforeStatus, afterStatus: delivery.status,
    beforeQuantity: total(delivery.lines.map((line) => line.registeredQty)), afterQuantity: 0,
    differenceQuantity: -total(delivery.lines.map((line) => line.registeredQty)), remark: reason,
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
    return quantityDifferenceRate(line.registeredQty, actualQty) > RETURN_TOLERANCE_RATE
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
    line.differenceRate = quantityDifferenceRate(line.registeredQty, actualQty)
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
  const qcCreation = getOrCreateQcTaskForConfirmedDelivery({
    delivery,
    actor: input.actor,
    createdAt: now,
    nowMs: input.nowMs,
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
  if (qcCreation.created) {
    appendBusinessLog({
      stage: '回货确认', delivery, objectType: '质检单', objectId: qcCreation.task.qcTaskId, objectNo: qcCreation.task.qcTaskNo,
      action: '自动生成质检单', actor: input.actor, operatedAt: now, beforeStatus: '未生成', afterStatus: qcCreation.task.status,
      afterQuantity: total(qcCreation.task.lines.map((line) => line.expectedQty)),
      remark: `回货最终确认即自动生成；编号按同一生产单现有最大序号加一且不可人工修改；冻结责任：${qcCreation.task.responsibility.taskTypeLabel} / ${qcCreation.task.responsibility.responsibilityLabel}；来源：${qcCreation.task.responsibility.source}。`,
    })
  }
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
  const existingQcTask = delivery.qcTaskId ? findQcTask(delivery.qcTaskId) : undefined
  if (existingQcTask && existingQcTask.status !== '待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '质检单已送检，不能再订正回货确认数量。')
  }
  const correctedQuantities = delivery.lines.map((line) => {
    const actualQty = Number(input.correctedCounts.find((item) => item.skuId === line.sku.skuId)?.actualQty)
    assertIntegerQuantity(actualQty, { label: `SKU ${line.sku.skuCode} 订正确认数量` })
    return actualQty
  })
  const businessConfirmedAt = delivery.confirmedAt
  const beforeQuantity = total(delivery.lines.map((line) => line.confirmedQty || 0))
  delivery.lines.forEach((line, index) => {
    const actualQty = correctedQuantities[index]
    line.confirmedQty = actualQty
    line.differenceQty = actualQty - line.registeredQty
    line.differenceRate = quantityDifferenceRate(line.registeredQty, actualQty)
  })
  const correctedAt = nowIso(input.nowMs)
  delivery.lastCorrectedBy = clone(input.actor)
  delivery.lastCorrectedAt = correctedAt
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  warehouseRecord.lines = delivery.lines.map((line) => ({
    sku: clone(line.sku),
    registeredQty: line.registeredQty,
    confirmedQty: line.confirmedQty || 0,
    availableQty: line.confirmedQty || 0,
  }))
  const qcCreation = getOrCreateQcTaskForConfirmedDelivery({
    delivery,
    actor: delivery.confirmedBy || input.actor,
    createdAt: delivery.confirmedAt,
    nowMs: new Date(delivery.confirmedAt).getTime(),
  })
  qcCreation.task.lines = delivery.lines.map((line) => ({
    sku: clone(line.sku),
    expectedQty: line.confirmedQty || 0,
  }))
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
    remark: `保留原确认版本；当前版本 ${version.confirmationVersionId}；同步更新待送检质检单 ${qcCreation.task.qcTaskNo}`,
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
  const pendingQcTask = delivery.status === '已确认待送检' && delivery.qcTaskId
    ? findQcTask(delivery.qcTaskId)
    : undefined
  const record = uploadPostFinishingQcReference({
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    qcTaskId: pendingQcTask?.qcTaskId,
    qcTaskNo: pendingQcTask?.qcTaskNo,
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
  if (pendingQcTask && !pendingQcTask.referenceIds.includes(record.referenceId)) {
    pendingQcTask.referenceIds.push(record.referenceId)
    persist()
  }
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
  const linkedTask = (delivery.qcTaskId ? state.qcTasks.find((task) => task.qcTaskId === delivery.qcTaskId) : undefined)
    || state.qcTasks.find((task) => task.deliveryId === delivery.deliveryId)
  if ((delivery.status === '已送检' || delivery.status === '已完成') && linkedTask) return clone(linkedTask)
  if (delivery.status !== '已确认待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有已确认回货可以送检。')
  }
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  if (warehouseRecord.status !== '待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '只有后道待加工仓中的待送检库存可以发起送检。')
  }
  const now = nowIso(input.nowMs)
  const qcCreation = getOrCreateQcTaskForConfirmedDelivery({
    delivery,
    actor: delivery.confirmedBy || input.actor,
    createdAt: delivery.confirmedAt || now,
    nowMs: delivery.confirmedAt ? new Date(delivery.confirmedAt).getTime() : input.nowMs,
  })
  const task = qcCreation.task
  if (task.status !== '待送检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `质检单当前为${task.status}，不能重复执行待加工仓送检。`)
  }
  task.status = '待质检'
  task.sentBy = clone(input.actor)
  task.sentAt = now
  task.lines = delivery.lines.map((line) => ({ sku: clone(line.sku), expectedQty: line.confirmedQty || 0 }))
  const references = bindPostFinishingQcReferences({ deliveryId: delivery.deliveryId, qcTaskId: task.qcTaskId, qcTaskNo: task.qcTaskNo })
  task.referenceIds = references.map((record) => record.referenceId)
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
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '当前账号不是 QC 质检人员，不能领取质检单。')
  }
  const exact = state.qcTasks.find((item) => item.qcTaskNo === input.qcTaskNo.trim())
  if (!exact) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整质检任务号，不提供模糊候选。')
  const delivery = findDelivery(exact.deliveryId)
  const now = nowIso(input.nowMs)
  if (exact.status === '待送检') {
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检单', objectId: exact.qcTaskId, objectNo: exact.qcTaskNo,
      action: '领取未送检质检单', actor: input.actor, operatedAt: now, result: '阻断',
      remark: '尚未从后道待加工仓完成送检出库。',
    })
    throw new PostFinishingFlowGateError('INVALID_STATUS', '该质检单尚未从后道待加工仓送检，完成送检出库后才能领取。')
  }
  if (exact.status === '质检完成') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '该质检单已完成，不能再次领取。')
  }
  if (exact.claimedBy) {
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检单', objectId: exact.qcTaskId, objectNo: exact.qcTaskNo,
      action: '输入完整单号领取冲突', actor: input.actor, operatedAt: now, result: '阻断',
      remark: `已由${exact.claimedBy.actorName}质检中；领取时间${exact.claimedAt}`,
    })
    throw new PostFinishingFlowGateError(
      'CLAIM_CONFLICT',
      `该质检单已由 ${exact.claimedBy.actorName} 质检中，领取时间 ${exact.claimedAt}。`,
    )
  }
  if (exact.status !== '待质检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `该质检单当前为${exact.status}，只有待质检且未被领取的单据才能领取。`)
  }
  exact.claimedBy = clone(input.actor)
  exact.claimedAt = now
  exact.status = '质检中'
  persist()
  appendBusinessLog({
    stage: '质检', delivery, objectType: '质检单', objectId: exact.qcTaskId, objectNo: exact.qcTaskNo,
    action: '输入完整单号领取质检单', actor: input.actor, operatedAt: now, beforeStatus: '待质检', afterStatus: exact.status,
  })
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
  if (task.status === '质检完成') throw new PostFinishingFlowGateError('INVALID_STATUS', '已完成质检单不能退领。')
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
  task.frozenProcessItems = undefined
  task.completedAt = undefined
  task.qcAuthorizationId = undefined
  task.qcAuthorizedBy = undefined
  persist()
  appendBusinessLog({
    stage: '质检', delivery, objectType: '质检单', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
    action: '退领质检单', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
    remark: `${beforeOwner}退领；已清空质检数量、下游选择与未提交授权数据；${task.releaseReason}`,
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
    defectReasonQuantities?: PostFinishingDefectReasonQuantity[]
    defectReason?: string
    defectImageUrl?: string
    responsibleParty?: string
  }>
  actor: PostFinishingActor
  recordedAt: string
}): void {
  input.lines.filter((line) => line.defectQty > 0).forEach((line) => {
    const reasonQuantities = line.defectReasonQuantities?.filter((item) => item.quantity > 0)
      ?? [{ reason: line.defectReason || '未填写', quantity: line.defectQty }]
    reasonQuantities.forEach((item) => {
      state.defects.push({
        defectId: `PF-DEF-${String(state.defects.length + 1).padStart(6, '0')}`,
        discoveryStage: input.discoveryStage,
        sourceObjectId: input.sourceObjectId,
        sourceObjectNo: input.sourceObjectNo,
        deliveryOrderNo: input.delivery.deliveryOrderNo,
        productionOrderNo: input.delivery.productionOrderNo,
        sku: clone(line.sku),
        defectQty: item.quantity,
        defectReason: item.reason,
        evidenceImageUrl: line.defectImageUrl,
        responsibleParty: line.responsibleParty,
        dispositionStatus: '待处理',
        recordedBy: clone(input.actor),
        recordedAt: input.recordedAt,
      })
    })
  })
}

function createRecheckOrder(input: {
  delivery: PostFinishingFactoryReturnDelivery
  qcTask: PostFinishingQcTask
  postTask: PostFinishingPostTask
  lines: Array<{ sku: PostFinishingAcceptanceSku; expectedQty: number }>
  createdAt: string
}): PostFinishingRecheckOrder {
  const sourceId = input.postTask.postTaskId
  const existing = state.recheckOrders.find((record) => record.postTaskId === input.postTask.postTaskId)
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
    responsibility: input.qcTask.responsibility,
    sourceType: '后道加工后',
    qcTaskId: input.qcTask.qcTaskId,
    qcTaskNo: input.qcTask.qcTaskNo,
    postTaskId: input.postTask.postTaskId,
    postTaskNo: input.postTask.postTaskNo,
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
  input.postTask.recheckOrderId = record.recheckOrderId
  input.postTask.recheckOrderNo = record.recheckOrderNo
  return record
}

export function completePostFinishingQcTask(input: {
  qcTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingQualityResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
  processItems?: string[]
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingQcTask {
  const task = findQcTask(input.qcTaskId)
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '质检完成') return clone(task)
  if (!task.claimedBy || task.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前领取质检任务的质检员可以提交结果。')
  }
  const submittedProcessItems = (input.processItems || []).map((item) => item.trim()).filter(Boolean)
  const invalidProcessItem = submittedProcessItems.find((item) => !POST_FINISHING_PROCESS_ITEMS.includes(item as PostFinishingProcessItem))
  if (invalidProcessItem) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `后道项目“${invalidProcessItem}”不是当前有效名称；新单据请使用“烫包”。`)
  }
  const now = nowIso(input.nowMs)
  const results: PostFinishingQualityResultLine[] = task.lines.map((line) => {
    const submitted = input.results.find((item) => item.skuId === line.sku.skuId)
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的质检结果。`)
    assertIntegerQuantity(submitted.passedQty, { label: `SKU ${line.sku.skuCode} 合格数量` })
    assertIntegerQuantity(submitted.defectQty, { label: `SKU ${line.sku.skuCode} 瑕疵数量` })
    assertIntegerQuantity(submitted.returnQty, { label: `SKU ${line.sku.skuCode} 返厂数量` })
    const defectReasonQuantities = normalizePostDefectReasonQuantities(
      submitted.defectReasonQuantities
        ?? (submitted.defectQty > 0 && submitted.defectReason?.trim()
          ? [{ reason: submitted.defectReason.trim(), quantity: submitted.defectQty }]
          : []),
      `SKU ${line.sku.skuCode} 瑕疵数量`,
    )
    if (total(defectReasonQuantities.map((item) => item.quantity)) !== submitted.defectQty) {
      throw new PostFinishingFlowGateError(
        'INVALID_QUANTITY',
        `SKU ${line.sku.skuCode} 的瑕疵数量必须等于各瑕疵原因数量之和。`,
      )
    }
    if (submitted.returnQty > 0 && (!submitted.returnReason?.trim() || !submitted.returnReceiver?.trim())) {
      throw new Error(`SKU ${line.sku.skuCode} 有返工数量时必须选择返工工厂。`)
    }
    if (submitted.returnQty > 0 && !listPostFinishingQcReworkFactoryOptions().some((item) => item.value === submitted.returnReceiver?.trim())) {
      throw new PostFinishingFlowGateError('INVALID_STATUS', `SKU ${line.sku.skuCode} 的返工工厂必须从列表中选择。`)
    }
    return {
      sku: clone(line.sku),
      expectedQty: line.expectedQty,
      passedQty: submitted.passedQty,
      defectQty: submitted.defectQty,
      returnQty: submitted.returnQty,
      defectReasonQuantities,
      defectReason: defectReasonQuantities.map((item) => item.reason).join('、') || undefined,
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
  const responsibility = task.responsibility || resolvePostFinishingResponsibility(delivery.sewingTaskType)
  const selectedItems = submittedProcessItems as PostFinishingProcessItem[]
  const processItems = responsibility.processItemsEditable
    ? [...new Set(selectedItems)]
    : [...POST_FINISHING_PROCESS_ITEMS]
  const needPostFinishing = processItems.length > 0
  task.responsibility = responsibility
  task.frozenProcessItems = processItems
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
  if (!needPostFinishing) {
    const outbound = total(results.map((line) => line.passedQty)) > 0
      ? upsertOutboundFromQc(task, delivery, results, now)
      : undefined
    persist()
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
      action: '完成质检', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
      beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
      afterQuantity: total(quantities.map((line) => line.actualQty)),
      differenceQuantity: total(quantities.map((line) => line.actualQty)) - total(quantities.map((line) => line.expectedQty)),
      differenceReason: input.authorization?.differenceReason,
      authorization: consumed,
      remark: outbound
        ? `本次不需要我方后道处理；不生成后道加工单和处理后复核单，直接生成面向成衣仓的出货交接单 ${outbound.outboundOrderNo}`
        : '本次不需要我方后道处理，且没有可交给成衣仓的合格数量；不生成后道加工单、处理后复核单或空出货单',
    })
    if (outbound) {
      appendBusinessLog({
        stage: '出货', delivery, objectType: '后道出货单', objectId: outbound.outboundOrderId, objectNo: outbound.outboundOrderNo,
        action: '质检直达生成成衣仓交接单', actor: input.actor, operatedAt: now, afterStatus: outbound.status,
        afterQuantity: total(outbound.lines.map((line) => line.outboundQty)),
        remark: '仅生成面向成衣仓的待接收交接事实，未代替成衣仓确认实收',
      })
    }
    return clone(task)
  }
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
    responsibility,
    sourceType: responsibility.responsibilityMode === 'POST_FACTORY' ? '任务后道' as const : '质检补加工' as const,
    qcTaskId: task.qcTaskId,
    qcTaskNo: task.qcTaskNo,
    returnIndex: delivery.returnIndex,
    status: '待后道' as const,
    processItems,
    lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.passedQty })),
  }
  postTask.processItems = processItems
  postTask.responsibility = responsibility
  postTask.sourceType = responsibility.responsibilityMode === 'POST_FACTORY' ? '任务后道' : '质检补加工'
  if (!existing) state.postTasks.push(postTask)
  task.postTaskId = postTask.postTaskId
  task.postTaskNo = postTask.postTaskNo
  persist()
  appendBusinessLog({
    stage: '质检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
    action: '完成质检', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
    beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
    afterQuantity: total(quantities.map((line) => line.actualQty)),
    differenceQuantity: total(quantities.map((line) => line.actualQty)) - total(quantities.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason,
    authorization: consumed,
    remark: `${postTask.sourceType === '质检补加工' ? '发现三方工厂漏做，' : ''}生成唯一后道加工单；加工项目：${processItems.join('、')}`,
  })
  return clone(task)
}

function normalizePostDefectReasonQuantities(
  values: PostFinishingDefectReasonQuantity[],
  label: string,
): PostFinishingDefectReasonQuantity[] {
  const seen = new Set<string>()
  return values.flatMap((item) => {
    const reason = item.reason.trim()
    assertIntegerQuantity(item.quantity, { label: `${label}${reason ? `（${reason}）` : ''}` })
    if (!reason || !POST_FINISHING_DEFECT_REASON_OPTIONS.includes(reason as typeof POST_FINISHING_DEFECT_REASON_OPTIONS[number])) {
      throw new PostFinishingFlowGateError('DEFECT_REASON_REQUIRED', `${label}必须选择系统提供的具体瑕疵原因。`)
    }
    if (seen.has(reason)) {
      throw new PostFinishingFlowGateError('INVALID_STATUS', `${label}中的瑕疵原因“${reason}”不能重复。`)
    }
    seen.add(reason)
    return item.quantity > 0 ? [{ reason, quantity: item.quantity }] : []
  })
}

function ensurePostFinishingPostDraftLines(task: PostFinishingPostTask): PostFinishingPostDraftLine[] {
  const current = task.draftLines ?? []
  task.draftLines = task.lines.map((line) => {
    const draft = current.find((item) => item.skuId === line.sku.skuId)
    const result = task.results?.find((item) => item.sku.skuId === line.sku.skuId)
    return {
      skuId: line.sku.skuId,
      processedQty: draft?.processedQty ?? result?.processedQty ?? 0,
      unprocessedQty: draft?.unprocessedQty ?? result?.unprocessedQty ?? 0,
      unprocessedReason: draft?.unprocessedReason ?? result?.unprocessedReason,
      updatedBy: draft?.updatedBy,
      updatedAt: draft?.updatedAt,
    }
  })
  return task.draftLines
}

function assertPostFinishingPostTaskOwner(task: PostFinishingPostTask, actor: PostFinishingActor): void {
  if (task.status !== '后道中') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '必须先开始后道才能更新加工进度。')
  }
  if (!task.startedBy || task.startedBy.actorId !== actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', `当前加工单由 ${task.startedBy?.actorName || '其他操作员'} 处理，请先完成接管。`)
  }
}

export function takeOverPostFinishingPostTask(input: {
  postTaskId: string
  actor: PostFinishingActor
  reason: string
  nowMs?: number
}): PostFinishingPostTask {
  const task = findPostTask(input.postTaskId)
  if (task.status !== '后道中') throw new PostFinishingFlowGateError('INVALID_STATUS', '只有加工中的后道加工单可以接管。')
  const reason = input.reason.trim()
  if (!reason) throw new PostFinishingFlowGateError('INVALID_STATUS', '接管后道加工单必须填写原因。')
  if (task.startedBy?.actorId === input.actor.actorId) return clone(task)
  const delivery = findDelivery(task.deliveryId)
  const previousOperator = task.startedBy?.actorName || '未记录'
  const now = nowIso(input.nowMs)
  task.startedBy = clone(input.actor)
  task.lastTakeoverAt = now
  task.lastTakeoverReason = reason
  ensurePostFinishingPostDraftLines(task)
  persist()
  appendBusinessLog({
    stage: '后道', delivery, objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: '接管后道加工单', actor: input.actor, operatedAt: now,
    beforeStatus: '后道中', afterStatus: '后道中',
    remark: `原操作人：${previousOperator}；接管原因：${reason}`,
  })
  return clone(task)
}

export function setPostFinishingPostProcessedQuantity(input: {
  postTaskId: string
  skuId: string
  processedQty: number
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  const task = findPostTask(input.postTaskId)
  assertPostFinishingPostTaskOwner(task, input.actor)
  const line = task.lines.find((item) => item.sku.skuId === input.skuId)
  if (!line) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到当前 SKU。')
  assertIntegerQuantity(input.processedQty, { label: `SKU ${line.sku.skuCode} 已处理数量` })
  if (input.processedQty > line.expectedQty) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', `SKU ${line.sku.skuCode} 的已处理数量不能超过应处理 ${line.expectedQty} 件。`)
  }
  const draft = ensurePostFinishingPostDraftLines(task).find((item) => item.skuId === input.skuId)!
  if (input.processedQty + draft.unprocessedQty > line.expectedQty) {
    throw new PostFinishingFlowGateError(
      'INVALID_QUANTITY',
      `SKU ${line.sku.skuCode} 的已处理 ${input.processedQty} 件与未处理 ${draft.unprocessedQty} 件合计不能超过应处理 ${line.expectedQty} 件。`,
    )
  }
  const before = draft.processedQty
  if (before === input.processedQty) return clone(task)
  draft.processedQty = input.processedQty
  const now = nowIso(input.nowMs)
  draft.updatedBy = clone(input.actor)
  draft.updatedAt = now
  persist()
  appendBusinessLog({
    stage: '后道', delivery: findDelivery(task.deliveryId), objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: '填报后道已处理数量', actor: input.actor, operatedAt: now,
    beforeQuantity: before, afterQuantity: input.processedQty, differenceQuantity: input.processedQty - before,
    remark: `${line.sku.skuCode}；已处理 ${input.processedQty} / 应处理 ${line.expectedQty} 件`,
  })
  return clone(task)
}

export function setPostFinishingPostUnprocessedQuantity(input: {
  postTaskId: string
  skuId: string
  unprocessedQty: number
  unprocessedReason?: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  const task = findPostTask(input.postTaskId)
  assertPostFinishingPostTaskOwner(task, input.actor)
  const line = task.lines.find((item) => item.sku.skuId === input.skuId)
  if (!line) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到当前 SKU。')
  assertIntegerQuantity(input.unprocessedQty, { label: `SKU ${line.sku.skuCode} 未处理数量` })
  const draft = ensurePostFinishingPostDraftLines(task).find((item) => item.skuId === input.skuId)!
  if (draft.processedQty + input.unprocessedQty > line.expectedQty) {
    throw new PostFinishingFlowGateError(
      'INVALID_QUANTITY',
      `SKU ${line.sku.skuCode} 的已处理 ${draft.processedQty} 件与未处理 ${input.unprocessedQty} 件合计不能超过应处理 ${line.expectedQty} 件。`,
    )
  }
  const unprocessedReason = input.unprocessedReason?.trim() || ''
  if (input.unprocessedQty > 0 && !unprocessedReason) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `SKU ${line.sku.skuCode} 有未处理数量时必须填写未处理说明。`)
  }
  const beforeQty = draft.unprocessedQty
  const now = nowIso(input.nowMs)
  Object.assign(draft, {
    unprocessedQty: input.unprocessedQty,
    unprocessedReason: input.unprocessedQty > 0 ? unprocessedReason : undefined,
    updatedBy: clone(input.actor),
    updatedAt: now,
  })
  persist()
  appendBusinessLog({
    stage: '后道', delivery: findDelivery(task.deliveryId), objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: '填报后道未处理数量',
    actor: input.actor, operatedAt: now,
    beforeQuantity: beforeQty, afterQuantity: input.unprocessedQty,
    differenceQuantity: input.unprocessedQty - beforeQty,
    remark: `${line.sku.skuCode}；未处理 ${input.unprocessedQty} 件${unprocessedReason ? `；${unprocessedReason}` : ''}`,
  })
  return clone(task)
}

export function completePostFinishingPostTaskFromDraft(input: {
  postTaskId: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  const task = findPostTask(input.postTaskId)
  assertPostFinishingPostTaskOwner(task, input.actor)
  const drafts = ensurePostFinishingPostDraftLines(task)
  const results = task.lines.map((line) => {
    const draft = drafts.find((item) => item.skuId === line.sku.skuId)!
    if (draft.processedQty + draft.unprocessedQty !== line.expectedQty) {
      throw new PostFinishingFlowGateError(
        'INVALID_QUANTITY',
        `SKU ${line.sku.skuCode} 的已处理 ${draft.processedQty} 件与未处理 ${draft.unprocessedQty} 件合计必须等于应处理 ${line.expectedQty} 件。`,
      )
    }
    return {
      skuId: line.sku.skuId,
      processedQty: draft.processedQty,
      unprocessedQty: draft.unprocessedQty,
      unprocessedReason: draft.unprocessedReason,
    }
  })
  return completePostFinishingPostTask({ ...input, results })
}

export function startPostFinishingPostTask(input: {
  postTaskNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  const task = state.postTasks.find((item) => item.postTaskNo === input.postTaskNo.trim())
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整后道加工单号，不提供模糊候选。')
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '后道完成') return clone(task)
  if (task.startedBy && task.startedBy.actorId !== input.actor.actorId) {
    appendBusinessLog({
      stage: '后道', delivery, objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
      action: '扫描领取冲突', actor: input.actor, operatedAt: nowIso(input.nowMs), result: '阻断',
      remark: `已由${task.startedBy.actorName}后道处理中；开始时间${task.startedAt}`,
    })
    throw new PostFinishingFlowGateError(
      'CLAIM_CONFLICT',
      `该后道加工单已由 ${task.startedBy.actorName} 处理中，开始时间 ${task.startedAt}。`,
    )
  }
  if (task.status === '待后道') {
    const now = nowIso(input.nowMs)
    task.status = '后道中'
    task.startedBy = clone(input.actor)
    task.startedAt = now
    ensurePostFinishingPostDraftLines(task)
    persist()
    appendBusinessLog({
      stage: '后道', delivery, objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
      action: '开始后道', actor: input.actor, operatedAt: now, beforeStatus: '待后道', afterStatus: task.status,
    })
  }
  if (task.status === '后道中' && !task.draftLines) {
    ensurePostFinishingPostDraftLines(task)
    persist()
  }
  return clone(task)
}

export function completePostFinishingPostTask(input: {
  postTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingPostResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
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
    assertIntegerQuantity(submitted.processedQty, { label: `SKU ${line.sku.skuCode} 已处理数量` })
    assertIntegerQuantity(submitted.unprocessedQty, { label: `SKU ${line.sku.skuCode} 未处理数量` })
    if (submitted.processedQty + submitted.unprocessedQty !== line.expectedQty) {
      throw new PostFinishingFlowGateError(
        'INVALID_QUANTITY',
        `SKU ${line.sku.skuCode} 的已处理 ${submitted.processedQty} 件与未处理 ${submitted.unprocessedQty} 件合计必须等于应处理 ${line.expectedQty} 件。`,
      )
    }
    const unprocessedReason = submitted.unprocessedReason?.trim() || ''
    if (submitted.unprocessedQty > 0 && !unprocessedReason) {
      throw new PostFinishingFlowGateError('INVALID_STATUS', `SKU ${line.sku.skuCode} 有未处理数量时必须填写未处理说明。`)
    }
    return {
      sku: clone(line.sku), expectedQty: line.expectedQty,
      processedQty: submitted.processedQty,
      unprocessedQty: submitted.unprocessedQty,
      unprocessedReason: unprocessedReason || undefined,
    }
  })
  if (total(results.map((line) => line.processedQty)) <= 0) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '本加工单没有已处理成衣，不能生成处理后交出复核单。')
  }
  task.results = results
  task.status = '后道完成'
  task.completedAt = now
  createRecheckOrder({
    delivery,
    qcTask,
    postTask: task,
    lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.processedQty })),
    createdAt: now,
  })
  persist()
  appendBusinessLog({
    stage: '后道', delivery, objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: '完成后道', actor: input.actor, operatedAt: now, beforeStatus: '后道中', afterStatus: task.status,
    beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
    afterQuantity: total(results.map((line) => line.processedQty)),
    differenceQuantity: -total(results.map((line) => line.unprocessedQty)),
    remark: `仅记录处理结果：已处理 ${total(results.map((line) => line.processedQty))} 件，未处理 ${total(results.map((line) => line.unprocessedQty))} 件；以已处理数量生成唯一处理后交出复核单`,
  })
  return clone(task)
}

export function claimPostFinishingRecheckOrder(input: {
  recheckOrderNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingRecheckOrder {
  if (!input.actor.roleName.includes('复检')) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '当前账号不是复检人员，不能领取复检单。')
  }
  const record = state.recheckOrders.find((item) => item.recheckOrderNo === input.recheckOrderNo.trim())
  if (!record) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整复检单号，不提供模糊候选。')
  const delivery = findDelivery(record.deliveryId)
  const now = nowIso(input.nowMs)
  if (record.status === '复检完成') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', '该复检单已完成，不能再次领取。')
  }
  if (record.claimedBy) {
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
  if (record.status !== '待复检') {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `该复检单当前为${record.status}，只有待复检且未被领取的单据才能领取。`)
  }
  record.claimedBy = clone(input.actor)
  record.claimedAt = now
  record.status = '复检中'
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '输入完整单号领取复检单', actor: input.actor, operatedAt: now, beforeStatus: '待复检', afterStatus: record.status,
  })
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
  record.completedAt = undefined
  record.recheckAuthorizationId = undefined
  record.recheckAuthorizedBy = undefined
  record.lines.forEach((line) => {
    line.handoverQty = undefined
    line.lastScannedBarcode = undefined
    line.barcodeStatus = line.expectedQty > 0 ? '待扫描' : '正确'
    line.barcodeEvents = []
  })
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '退领复检单', actor: input.actor, operatedAt: now, beforeStatus: '复检中', afterStatus: record.status,
    remark: `${ownerName}退领；已清空复检数量、条码确认与未提交授权数据；${record.releaseReason}`,
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
    responsibility: clone(record.responsibility),
    sourceType: record.sourceType,
    recheckOrderId: record.recheckOrderId,
    recheckOrderNo: record.recheckOrderNo,
    returnIndex: delivery.returnIndex,
    status: '待仓库接收',
    lines: record.lines.map((line) => ({ sku: clone(line.sku), outboundQty: line.handoverQty || 0 })),
    createdAt,
  }
  state.outboundOrders.push(outbound)
  record.outboundOrderId = outbound.outboundOrderId
  record.outboundOrderNo = outbound.outboundOrderNo
  return outbound
}

function upsertOutboundFromQc(
  qcTask: PostFinishingQcTask,
  delivery: PostFinishingFactoryReturnDelivery,
  results: PostFinishingQualityResultLine[],
  createdAt: string,
): PostFinishingOutboundOrder {
  const existing = state.outboundOrders.find((item) => (
    item.qcTaskId === qcTask.qcTaskId && !item.postTaskId && !item.recheckOrderId
  ))
  if (existing) return existing
  const outboundOrderId = `PF-OUT-${delivery.productionOrderId}-${delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'OUTBOUND',
    productionOrderNo: delivery.productionOrderNo,
    sourceObjectId: qcTask.qcTaskId,
    idempotencyKey: `OUTBOUND:QC:${qcTask.qcTaskId}`,
    sequence: delivery.returnIndex,
  }, new Date(createdAt))
  const outbound: PostFinishingOutboundOrder = {
    outboundOrderId,
    outboundOrderNo: number.documentNo,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    qcTaskId: qcTask.qcTaskId,
    qcTaskNo: qcTask.qcTaskNo,
    responsibility: clone(qcTask.responsibility),
    sourceType: '质检直达',
    returnIndex: delivery.returnIndex,
    status: '待仓库接收',
    lines: results.map((line) => ({ sku: clone(line.sku), outboundQty: line.passedQty })),
    createdAt,
  }
  state.outboundOrders.push(outbound)
  qcTask.outboundOrderId = outbound.outboundOrderId
  qcTask.outboundOrderNo = outbound.outboundOrderNo
  return outbound
}

function getOrCreateWaitHandoverWarehouseRecord(input: {
  recheck: PostFinishingRecheckOrder
  outbound: PostFinishingOutboundOrder
  delivery: PostFinishingFactoryReturnDelivery
  operator: PostFinishingActor
  operatedAt: string
}): PostFinishingWaitHandoverWarehouseRecord {
  const existing = state.waitHandoverWarehouseRecords.find((item) => item.recheckOrderId === input.recheck.recheckOrderId)
  if (existing) return existing
  const record: PostFinishingWaitHandoverWarehouseRecord = {
    warehouseRecordId: `PF-WHW-${input.recheck.recheckOrderId}`,
    deliveryId: input.delivery.deliveryId,
    deliveryOrderNo: input.delivery.deliveryOrderNo,
    productionOrderNo: input.delivery.productionOrderNo,
    returnIndex: input.delivery.returnIndex,
    qcTaskId: input.recheck.qcTaskId,
    qcTaskNo: input.recheck.qcTaskNo,
    postTaskId: input.recheck.postTaskId,
    postTaskNo: input.recheck.postTaskNo,
    responsibility: clone(input.recheck.responsibility),
    sourceType: input.recheck.sourceType,
    recheckOrderId: input.recheck.recheckOrderId,
    recheckOrderNo: input.recheck.recheckOrderNo,
    outboundOrderId: input.outbound.outboundOrderId,
    outboundOrderNo: input.outbound.outboundOrderNo,
    areaName: '处理后待交出区',
    locationCode: `WH-${input.delivery.productionOrderId}-${input.delivery.returnIndex}`,
    status: '待交出',
    lines: input.outbound.lines.map((line) => ({
      sku: clone(line.sku),
      inboundQty: line.outboundQty,
      availableQty: line.outboundQty,
      handedOverQty: 0,
    })),
    createdAt: input.operatedAt,
    createdBy: clone(input.operator),
  }
  state.waitHandoverWarehouseRecords.push(record)
  return record
}

function appendWaitHandoverWarehouseMovement(input: {
  record: PostFinishingWaitHandoverWarehouseRecord
  movementType: PostFinishingWaitHandoverWarehouseMovement['movementType']
  operator: PostFinishingActor
  operatedAt: string
}): PostFinishingWaitHandoverWarehouseMovement {
  const existing = state.waitHandoverWarehouseMovements.find((item) => (
    item.warehouseRecordId === input.record.warehouseRecordId && item.movementType === input.movementType
  ))
  if (existing) return existing
  const movement: PostFinishingWaitHandoverWarehouseMovement = {
    movementId: `PF-WHM-${String(state.waitHandoverWarehouseMovements.length + 1).padStart(6, '0')}`,
    warehouseRecordId: input.record.warehouseRecordId,
    deliveryId: input.record.deliveryId,
    deliveryOrderNo: input.record.deliveryOrderNo,
    productionOrderNo: input.record.productionOrderNo,
    recheckOrderNo: input.record.recheckOrderNo,
    outboundOrderNo: input.record.outboundOrderNo,
    movementType: input.movementType,
    quantities: input.record.lines.map((line) => ({
      sku: clone(line.sku),
      quantity: input.movementType === '复检完成入仓' ? line.inboundQty : line.handedOverQty,
    })),
    operator: clone(input.operator),
    operatedAt: input.operatedAt,
  }
  state.waitHandoverWarehouseMovements.push(movement)
  return movement
}

function backfillWaitHandoverWarehouseFacts(): void {
  state.recheckOrders.filter((record) => record.status === '复检完成').forEach((recheck) => {
    const outbound = state.outboundOrders.find((item) => item.recheckOrderId === recheck.recheckOrderId)
    const delivery = state.deliveries.find((item) => item.deliveryId === recheck.deliveryId)
    if (!outbound || !delivery) return
    const inboundActor = recheck.claimedBy || POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA
    const record = getOrCreateWaitHandoverWarehouseRecord({
      recheck,
      outbound,
      delivery,
      operator: inboundActor,
      operatedAt: recheck.completedAt || outbound.createdAt,
    })
    appendWaitHandoverWarehouseMovement({
      record,
      movementType: '复检完成入仓',
      operator: inboundActor,
      operatedAt: recheck.completedAt || outbound.createdAt,
    })
    const receipt = state.warehouseReceipts.find((item) => item.outboundOrderId === outbound.outboundOrderId)
    if (outbound.status !== '已接收入库' && !receipt) return
    const handoverActor = outbound.receivedBy || receipt?.receivedBy || POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver
    const handedOverAt = outbound.receivedAt || receipt?.receivedAt || outbound.createdAt
    record.status = '已交出'
    record.handedOverAt = handedOverAt
    record.handedOverBy = clone(handoverActor)
    record.lines.forEach((line) => {
      const outboundLine = outbound.lines.find((item) => item.sku.skuId === line.sku.skuId)
      line.handedOverQty = outboundLine?.outboundQty || 0
      line.availableQty = 0
    })
    appendWaitHandoverWarehouseMovement({
      record,
      movementType: '后道出货交出',
      operator: handoverActor,
      operatedAt: handedOverAt,
    })
  })
}

export function completePostFinishingRecheckOrderFullFlow(input: {
  recheckOrderId: string
  actor: PostFinishingActor
  results: Array<{ skuId: string; handoverQty: number }>
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
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的交出数量。`)
    assertIntegerQuantity(submitted.handoverQty, { label: `SKU ${line.sku.skuCode} 交出数量` })
    line.handoverQty = submitted.handoverQty
    return { skuId: line.sku.skuId, expectedQty: line.expectedQty, actualQty: submitted.handoverQty }
  })
  const hasDifference = quantities.some((line) => line.expectedQty !== line.actualQty)
  if (total(record.lines.map((line) => line.handoverQty || 0)) <= 0) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '交出数量合计必须大于 0，不能生成空出货单。')
  }
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
  const waitHandoverRecord = getOrCreateWaitHandoverWarehouseRecord({
    recheck: record,
    outbound,
    delivery,
    operator: input.actor,
    operatedAt: now,
  })
  appendWaitHandoverWarehouseMovement({
    record: waitHandoverRecord,
    movementType: '复检完成入仓',
    operator: input.actor,
    operatedAt: now,
  })
  persist()
  appendBusinessLog({
    stage: '复检', delivery, objectType: '复检单', objectId: record.recheckOrderId, objectNo: record.recheckOrderNo,
    action: '完成处理后交出复核', actor: input.actor, operatedAt: now, beforeStatus: '复检中', afterStatus: record.status,
    beforeQuantity: total(quantities.map((line) => line.expectedQty)),
    afterQuantity: total(quantities.map((line) => line.actualQty)),
    differenceQuantity: total(quantities.map((line) => line.actualQty)) - total(quantities.map((line) => line.expectedQty)),
    differenceReason: input.authorization?.differenceReason, authorization: consumed,
    remark: `仅复核 SKU 数量与条码；进入后道待交出仓并生成唯一出货单 ${outbound.outboundOrderNo}`,
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
  // POST-014 / POST-021: this is the external garment warehouse responsibility boundary.
  if (!input.actor?.actorId?.trim() || !input.actor?.actorName?.trim()
    || !['仓库收货人员', '成衣仓收货员'].includes(input.actor?.roleName?.trim())) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有身份完整的仓库收货人员可以确认成衣仓收货。')
  }
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
  if (exact.recheckOrderId) {
    const recheck = findRecheck(exact.recheckOrderId)
    const waitHandoverRecord = getOrCreateWaitHandoverWarehouseRecord({
      recheck,
      outbound: exact,
      delivery,
      operator: recheck.claimedBy || POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA,
      operatedAt: recheck.completedAt || exact.createdAt,
    })
    waitHandoverRecord.status = '已交出'
    waitHandoverRecord.handedOverAt = now
    waitHandoverRecord.handedOverBy = clone(input.actor)
    waitHandoverRecord.lines.forEach((line) => {
      const outboundLine = exact.lines.find((item) => item.sku.skuId === line.sku.skuId)
      line.handedOverQty = outboundLine?.outboundQty || 0
      line.availableQty = 0
    })
    appendWaitHandoverWarehouseMovement({
      record: waitHandoverRecord,
      movementType: '后道出货交出',
      operator: input.actor,
      operatedAt: now,
    })
  }
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

export function listPostFinishingWaitHandoverWarehouseRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
  return clone(state.waitHandoverWarehouseRecords)
}

export function listPostFinishingWaitHandoverWarehouseMovements(): PostFinishingWaitHandoverWarehouseMovement[] {
  return clone(state.waitHandoverWarehouseMovements).sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
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

export function getPostFinishingWaitHandoverWarehouseRecord(recordIdOrNumber: string): PostFinishingWaitHandoverWarehouseRecord | undefined {
  const record = state.waitHandoverWarehouseRecords.find((item) => (
    item.warehouseRecordId === recordIdOrNumber
    || item.deliveryOrderNo === recordIdOrNumber
    || item.recheckOrderNo === recordIdOrNumber
    || item.outboundOrderNo === recordIdOrNumber
  ))
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
  waitHandoverRecord?: PostFinishingWaitHandoverWarehouseRecord
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
  const waitHandoverRecord = relation.outbound
    ? state.waitHandoverWarehouseRecords.find((item) => item.outboundOrderId === relation.outbound!.outboundOrderId)
    : undefined
  return clone({
    delivery,
    qcTask: relation.qcTask,
    postTask: relation.postTask,
    recheckOrder: relation.recheck,
    outboundOrder: relation.outbound,
    waitHandoverRecord,
    receipt,
  })
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
      if (returnIndex === 4 && orderIndex === 0) continue

      const isReworkDemo = orderIndex === 0 && returnIndex === 5
      const completedQc = completePostFinishingQcTask({
        qcTaskId: claimedQc.qcTaskId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.qcA,
        results: claimedQc.lines.map((line, lineIndex) => {
          if (isReworkDemo && lineIndex === 0) {
            return {
              skuId: line.sku.skuId,
              passedQty: line.expectedQty - 10,
              defectQty: 6,
              returnQty: 4,
              defectReasonQuantities: [
                { reason: '做工原因', quantity: 4 },
                { reason: '色差', quantity: 2 },
              ],
              returnReason: '到货质检确认做工问题，转另一家车缝工厂返工',
              returnReceiver: SEWING_FACTORY_SEEDS[1].factoryName,
            }
          }
          if (isReworkDemo && lineIndex === 1) {
            return {
              skuId: line.sku.skuId,
              passedQty: line.expectedQty - 6,
              defectQty: 4,
              returnQty: 2,
              defectReasonQuantities: [
                { reason: '抽纱', quantity: 3 },
                { reason: '破洞', quantity: 1 },
              ],
              returnReason: '到货质检确认需转厂返工',
              returnReceiver: SEWING_FACTORY_SEEDS[1].factoryName,
            }
          }
          return {
            skuId: line.sku.skuId,
            passedQty: line.expectedQty,
            defectQty: 0,
            returnQty: 0,
          }
        }),
        processItems: order.sewingTaskType === 'INDEPENDENT_SEWING'
          ? [...POST_FINISHING_PROCESS_ITEMS]
          : orderIndex === 2 ? ['烫包'] : [],
        nowMs: chainTime + 40 * 60 * 1000,
      })

      if (orderIndex === 0) continue
      if (!completedQc.postTaskNo) {
        const directOutbound = findOutbound(completedQc.outboundOrderId || completedQc.outboundOrderNo || '')
        if (orderIndex === 1 && returnIndex === 5) {
          receivePostFinishingOutboundOrder({
            outboundOrderNo: directOutbound.outboundOrderNo,
            actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
            receivedQuantities: directOutbound.lines.map((line) => ({
              skuId: line.sku.skuId,
              receivedQty: line.outboundQty,
            })),
            nowMs: chainTime + 75 * 60 * 1000,
          })
        }
        continue
      }
      const startedPost = startPostFinishingPostTask({
        postTaskNo: completedQc.postTaskNo,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
        nowMs: chainTime + 50 * 60 * 1000,
      })
      const completedPost = completePostFinishingPostTask({
        postTaskId: startedPost.postTaskId,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
        results: startedPost.lines.map((line) => ({
          skuId: line.sku.skuId,
          processedQty: line.expectedQty,
          unprocessedQty: 0,
        })),
        nowMs: chainTime + 60 * 60 * 1000,
      })
      const recheck = findRecheck(completedPost.recheckOrderId || completedPost.recheckOrderNo || '')
      if (orderIndex === 2 && returnIndex === 4) continue

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
          handoverQty: line.expectedQty,
        })),
        nowMs: chainTime + 65 * 60 * 1000,
      })
      const outbound = findOutbound(completedRecheck.outboundOrderId || completedRecheck.outboundOrderNo || '')
      if (orderIndex === 2 && returnIndex === 5) continue
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

// 旧版空项目 QC 曾生成待复检单。升级时只迁移尚未执行完的记录，
// 已完成复核、出货与实收历史保留原数量和单号，不能重算或再次出货。
function migratePendingQcDirectRechecks(): void {
  const migratedIds = new Set<string>()
  for (const record of state.recheckOrders) {
    if (record.postTaskId || record.sourceType !== '质检直达' || record.status === '复检完成') continue
    const qc = state.qcTasks.find((task) => task.qcTaskId === record.qcTaskId)
    const delivery = state.deliveries.find((item) => item.deliveryId === record.deliveryId)
    if (!qc || !delivery || !qc.results || !qc.frozenProcessItems || qc.frozenProcessItems.length > 0) continue
    if (state.outboundOrders.some((item) => item.recheckOrderId === record.recheckOrderId)) continue
    if (qc.results.some((line) => line.passedQty > 0)) {
      upsertOutboundFromQc(qc, delivery, qc.results, qc.completedAt || delivery.confirmedAt || delivery.registeredAt)
    }
    qc.recheckOrderId = undefined
    qc.recheckOrderNo = undefined
    migratedIds.add(record.recheckOrderId)
  }
  state.recheckOrders = state.recheckOrders.filter((record) => !migratedIds.has(record.recheckOrderId))
}

if (needsLegacyStateMigration) {
  migratePendingQcDirectRechecks()
  backfillWaitProcessWarehouseFacts()
  backfillWaitHandoverWarehouseFacts()
  if (state.migration) state.migration.completedAt = nowIso()
  // 即使旧 deliveries 为空，也需持久化完成标记，避免每次读取重新迁移。
  persist()
  needsLegacyStateMigration = false
}
// 已保存的旧/当前空回货库可能仍有 QC 等历史事实，不得被默认演示重置。
if (!hasPersistedFullFlowState && state.deliveries.length === 0 && shouldBootstrapPostFinishingDemo()) loadPostFinishingDemoData()
