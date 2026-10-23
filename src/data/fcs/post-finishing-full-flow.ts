import { resolveQualityStyleContext } from './quality-management-style-context.ts'
import { resolveProductionInspectionSource, evaluateProductionInitialFullInspection, type InitialFullInspectionReason } from './quality-management-source.ts'
import type { InspectionSnapshot, InspectionIssue } from './quality-management-types.ts'
import { validateInspectionIssues } from './quality-management-rules.ts'
import { readPreparedInspectionSnapshot, buildInspectionSnapshotFromConfigurations } from './quality-management-records.ts'
import { createPostQcInspection, getPostQcSummary, submitPostQcRound, upgradePostQcInspection, applyPostQcFullCoverage, assertPostQcCompletable, type PostQcInspection, type PostQcCount } from './post-finishing-quality.ts'
import { assertPostFinishingWrite, registerPostFinishingRepository, withPostFinishingDemo, registerPostFinishingRecordValidator, registerPostFinishingReadOnlyMaterialCheck, mapPostFinishingRepositoryValues } from './post-finishing-records.ts'
import { ppicInstant } from './ppic-daily-return.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from './post-finishing-production-source-fixtures.ts'
import {
  beginPostFinishingAuthorizationDemoBatch,
  buildPostFinishingDifferenceFingerprint,
  consumePostFinishingAuthorization,
  PostFinishingAuthorizationError,
  type PostFinishingAuthorizationConsumption,
  type PostFinishingAuthorizationStage,
} from './post-finishing-authorization.ts'
import {
  beginPostFinishingNumberingDemoBatch,
  issuePostFinishingDocumentNumber,
  resetPostFinishingDocumentNumbering,
  type PostFinishingDeliveryTrigger,
} from './post-finishing-document-numbering.ts'
import {
  beginPostFinishingOperationLogDemoBatch,
  appendPostFinishingOperationLog,
  resetPostFinishingOperationLogs,
  type PostFinishingFullFlowStage,
} from './post-finishing-operation-log.ts'
import {
  beginPostFinishingQcReferenceDemoBatch,
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
import { readQcShippingDestination, isQcShippingWarehouseId } from './post-finishing-qc-shipping-facts.ts'
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
  '熨烫',
  '包装',
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
    processItemsEditable: true,
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
  recheckOrderId?: string
  recheckOrderNo?: string
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
  recheckOrderNo?: string
  outboundOrderNo: string
  movementType: '复检完成入仓' | '出货准备入区' | '后道出货交出'
  quantities: Array<{ sku: PostFinishingAcceptanceSku; quantity: number }>
  operator: PostFinishingActor
  operatedAt: string
}

/** 对两仓整条库存记录做库位移动；数量、批次和状态不变。 */
export interface PostFinishingWarehouseLocationMove {
  moveId: string
  warehouseMode: 'wait-process' | 'wait-handover'
  warehouseRecordId: string
  deliveryOrderNo: string
  productionOrderNo: string
  fromLocationCode: string
  toLocationCode: string
  reason: string
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
  entryDelayReason?: string
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
  uninspectedQty?: number
  releasedQty?: number
  issues?: InspectionIssue[]
  defectReasonQuantities?: PostFinishingDefectReasonQuantity[]
  defectReason?: string
  defectImageUrl?: string
  responsibleParty?: string
  returnReason?: string
  returnReceiver?: string
}

export type PostFinishingQcTaskStatus = '待送检' | '待质检' | '质检中' | '质检完成'

export interface PostFinishingQcTask {
  independentChecks?: Array<{id:string;originalRecordId:string;objectDescription:string;scopeDescription:string;itemIds:string[];reason:string;result:string;at:string;by:PostFinishingActor;snapshot:InspectionSnapshot}>

  sourceKind?: 'PRODUCTION_RETURN' | 'WAREHOUSE_STOCK'
  inventoryApplicationId?: string
  sourceWarehouseId?: string
  sourceWarehouseName?: string
  styleId?: string
  inspection?: PostQcInspection
  inspectionSourceWarnings?: string[]
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

export interface PostFinishingProcessCompletion {
  recordId: string
  operationId: string
  intent: string
  postTaskId: string
  processItem: PostFinishingProcessItem
  quantities: Array<{ skuId: string; quantity: number }>
  responsible: PostFinishingActor
  recordedBy: PostFinishingActor
  recordedAt: string
  correctionOf?: string
  reason?: string
}

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
  executionModel?: 'ITEMS_V1'
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
  operationId?: string
  operationIntent?: string
  sequence?: number
  createdAt?: string
  createdBy?: PostFinishingActor
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

export type PostFinishingOutboundStatus = '待出货' | '待仓库接收' | '已接收入库'

export interface PostFinishingOutboundLine {
  sku: PostFinishingAcceptanceSku
  outboundQty: number
  receivedQty?: number
}

export interface PostFinishingOutboundOrder {
  executionModel?: 'DIRECT_V2'
  operationId?: string
  operationIntent?: string
  sequence?: number
  dispatchedAt?: string
  dispatchedBy?: PostFinishingActor
  targetWarehouseId?: string
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
  warehouseId?: string
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
  action?: string
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
  creationMode?: 'SYSTEM' | 'MANUAL'
  manualSource?: 'PRODUCTION_ORDER' | 'GENERAL'
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

interface PostFinishingFullCoverage extends InitialFullInspectionReason { coverageId: string; createdAt: string; ruleId: string; ruleVersion: number }

interface PostFinishingFullFlowState {
  fullCoverages: PostFinishingFullCoverage[]
  schemaVersion: 5
  deliveries: PostFinishingFactoryReturnDelivery[]
  waitProcessWarehouseRecords: PostFinishingWaitProcessWarehouseRecord[]
  waitProcessWarehouseMovements: PostFinishingWaitProcessWarehouseMovement[]
  waitHandoverWarehouseRecords: PostFinishingWaitHandoverWarehouseRecord[]
  waitHandoverWarehouseMovements: PostFinishingWaitHandoverWarehouseMovement[]
  returnConfirmationVersions: PostFinishingReturnConfirmationVersion[]
  qcTasks: PostFinishingQcTask[]
  processCompletions: PostFinishingProcessCompletion[]
  postTasks: PostFinishingPostTask[]
  recheckOrders: PostFinishingRecheckOrder[]
  outboundOrders: PostFinishingOutboundOrder[]
  warehouseReceipts: PostFinishingWarehouseReceipt[]
  defects: PostFinishingDefectRecord[]
  materialTransferOrders: PostFinishingMaterialTransferOrder[]
  materialStocks: PostFinishingMaterialStock[]
  warehouseLocationMoves?: PostFinishingWarehouseLocationMove[]
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
  return [{ value: 'goto_global', label: 'goto_global（自有工厂）' }]
}

const QC_PRINT_MATERIALS: PostFinishingQcPrintMaterial[] = [
  { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-black', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-fadfad', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '纯白色染色纽扣 1.1cm', materialCode: 'FLSZ25111845-black-322', unitConsumption: '3 PCS', materialUsed: '', imageUrl: '/materials/accessory-button.jpg' },
  { materialName: '后道包装辅件', materialCode: 'FLBF2609001-white', unitConsumption: '1 PCS', materialUsed: '', imageUrl: '/materials/accessory-label.jpg' },
  { materialName: '印尼车边 polyester 线', materialCode: 'IDSZFL24093-b349', unitConsumption: '0.001 CNS', materialUsed: '', imageUrl: '/materials/yarn-stitching.jpg' },
  { materialName: '印尼 cotton 平车线', materialCode: 'IDSZFL24092-b349', unitConsumption: '0.001 DZ', materialUsed: '', imageUrl: '/materials/yarn-stitching.jpg' },
]

const SEWING_FACTORY_SEEDS = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES

const SEWING_TASK_TYPE_SEEDS: PostFinishingSewingTaskType[] = [
  'INDEPENDENT_SEWING',
  'SEWING_TO_IRON_PACK',
  'CUTTING_TO_IRON_PACK',
]

export const POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS: PostFinishingAcceptanceProductionOrder[] = POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.map((seed, orderIndex) => ({
  productionOrderId: seed.productionOrderId,
  productionOrderNo: seed.no,
  styleNo: seed.styleNo,
  styleName: seed.styleName,
  executionTaskId: `PF-SEW-EXEC-${String(orderIndex + 1).padStart(3, '0')}`,
  sewingTaskNo: seed.sewingTaskNo,
  assignmentId: `PF-SEW-ASG-${String(orderIndex + 1).padStart(3, '0')}`,
  sewingTaskType: SEWING_TASK_TYPE_SEEDS[orderIndex],
  defaultStagingLocation: `后道待确认区-${String.fromCharCode(65 + orderIndex)}`,
  sewingFactoryId: seed.factoryId,
  sewingFactoryName: seed.factoryName,
  managedPostFactoryId: 'ID-F002',
  managedPostFactoryName: 'PT Prima Printing Center',
  styleGrade: seed.styleGrade,
  buyerName: seed.buyerName,
  productionOrderType: seed.productionOrderType,
  saleType: '预售',
  tagPrice: seed.tagPrice,
  qcPrintMaterials: QC_PRINT_MATERIALS.map((item) => ({ ...item })),
  qcPrintSizeRows: seed.skus.map((sku, sizeIndex) => ({
    sizeName: sku.sizeName,
    backLength: `${64 + sizeIndex}cm`,
    shoulderWidth: `${35 + sizeIndex}cm`,
    bust: `${114 + sizeIndex * 4}cm`,
    sleeveLength: `${59 + sizeIndex}cm`,
    cuff: `${16 + sizeIndex}cm`,
  })),
  skus: seed.skus.map((sku) => ({ ...sku })),
}))

function emptyState(): PostFinishingFullFlowState {
  return {
    schemaVersion: 5,
    fullCoverages: [],
    processCompletions: [],
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
    warehouseLocationMoves: [],
  }
}

let state = emptyState()
let buildingDemoData = false

export interface AccessoryPostFinishingReadBridge {
  ownsProduction: (idOrNo: string) => boolean
  /** 一次读取核对共用一份当前归属；不跨动作缓存生产来源。 */
  ownedProductionIdentities?: (candidates?: ReadonlySet<string>) => ReadonlySet<string>
  transfers: () => PostFinishingMaterialTransferOrder[]
  stocks: () => PostFinishingMaterialStock[]
  readiness: (productionOrderNo: string) => { applicable: boolean; status: PostFinishingMaterialTransferStatus | '不适用'; label: string; transferOrderNo?: string } | undefined
}
let accessoryPostBridge: AccessoryPostFinishingReadBridge | null = null
let accessoryLegacyBaseline = ''
let accessoryLegacyMaterialBytes = ''
function managedLegacyMaterialState(): { materialTransferOrders: PostFinishingMaterialTransferOrder[]; materialStocks: PostFinishingMaterialStock[] } {
  if (!state.materialTransferOrders.length && !state.materialStocks.length) return { materialTransferOrders: [], materialStocks: [] }
  const candidates = new Set([
    ...state.materialTransferOrders.flatMap(row => [row.productionOrderId, row.productionOrderNo]),
    ...state.materialStocks.map(row => row.productionOrderNo),
  ])
  const identities = accessoryPostBridge?.ownedProductionIdentities?.(candidates)
  const owns = (id: string) => identities ? identities.has(id) : Boolean(accessoryPostBridge?.ownsProduction(id))
  const materialTransferOrders = state.materialTransferOrders.filter(row => owns(row.productionOrderId) || owns(row.productionOrderNo))
  const ids = new Set(materialTransferOrders.map(row => row.transferOrderId))
  return { materialTransferOrders, materialStocks: state.materialStocks.filter(row => ids.has(row.transferOrderId) || owns(row.productionOrderNo)) }
}
/** 限定辅料读取桥；不把新辅料事实复制进 PCS 可写 state。 */
export function installAccessoryPostFinishingReadBridge(bridge: AccessoryPostFinishingReadBridge): void {
  accessoryPostBridge = bridge
  accessoryLegacyBaseline = JSON.stringify(managedLegacyMaterialState())
  accessoryLegacyMaterialBytes = JSON.stringify({ materialTransferOrders: state.materialTransferOrders, materialStocks: state.materialStocks })
}
/** 供显式迁移核对原辅料；其他后道业务对象不在此边界内。 */
export function readLegacyPostFinishingMaterialState(): { materialTransferOrders: PostFinishingMaterialTransferOrder[]; materialStocks: PostFinishingMaterialStock[] } {
  return clone({ materialTransferOrders: state.materialTransferOrders, materialStocks: state.materialStocks })
}

function persist(): void {
  // An unchanged material tree cannot write a retired material fact. Ordinary
  // garment commands therefore need no unrelated legacy-source read. Any
  // material change still uses the current ownership check and fails closed.
  if (accessoryPostBridge
    && accessoryLegacyMaterialBytes !== JSON.stringify({ materialTransferOrders: state.materialTransferOrders, materialStocks: state.materialStocks })
    && accessoryLegacyBaseline !== JSON.stringify(managedLegacyMaterialState())) throw new Error('本范围后道辅料已改由辅料调拨办理，原辅料事实只读；本次其他后道操作未保存。请重新读取。')
  if (!buildingDemoData) assertPostFinishingWrite()
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

function buildPostFinishingMaterialTransferDemos(): PostFinishingMaterialTransferOrder[] {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.sewingTaskType === 'INDEPENDENT_SEWING')
  if (!order) return []
  const garmentQty = total(order.skus.map((sku) => sku.plannedQty))
  const primaryLines = order.qcPrintMaterials.flatMap((material, index) => {
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
  const extraDemoSeeds: Array<{
    transferOrderNo: string
    productionOrderNo: string
    styleNo: string
    styleName: string
    styleImageUrl: string
    sewingTaskNo: string
    targetLocationCode: string
    lines: Array<Omit<PostFinishingMaterialTransferLine, 'transferLineId'>>
  }> = [
    {
      transferOrderNo: 'DB-PF-202608-002',
      productionOrderNo: 'PO-QC-202609-011',
      styleNo: 'HG-QC-011',
      styleName: '后道验收针织开衫',
      styleImageUrl: '/cardigan-sample.jpg',
      sewingTaskNo: 'SEW-TASK-QC-011',
      targetLocationCode: 'PF-MAT-A01-02',
      lines: [
        { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-black', materialSpuCode: 'FLSZ24116', specification: 'black', unit: 'PCS', requestedQty: 280, preparedQty: 278, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-fadfad', materialSpuCode: 'WLID009', specification: 'fadfad', unit: 'PCS', requestedQty: 280, preparedQty: 280, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '珍珠四眼扣 1.2cm', materialCode: 'FLSZ26090111-shell-12', materialSpuCode: 'FLSZ26090111', specification: 'shell / 12', unit: 'PCS', requestedQty: 1120, preparedQty: 1116, imageUrl: '/materials/accessory-button.jpg' },
      ],
    },
    {
      transferOrderNo: 'DB-PF-202608-003',
      productionOrderNo: 'PO-QC-202609-012',
      styleNo: 'HG-QC-012',
      styleName: '后道验收休闲连衣裙',
      styleImageUrl: '/dress-sample-1.jpg',
      sewingTaskNo: 'SEW-TASK-QC-012',
      targetLocationCode: 'PF-MAT-A01-03',
      lines: [
        { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-white', materialSpuCode: 'FLSZ24116', specification: 'white', unit: 'PCS', requestedQty: 360, preparedQty: 360, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-dress', materialSpuCode: 'WLID009', specification: 'dress', unit: 'PCS', requestedQty: 360, preparedQty: 356, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '隐形按扣 0.8cm', materialCode: 'FLSZ26090112-silver-08', materialSpuCode: 'FLSZ26090112', specification: 'silver / 08', unit: 'PCS', requestedQty: 360, preparedQty: 360, imageUrl: '/materials/accessory-button.jpg' },
        { materialName: '后道包装辅件', materialCode: 'FLBF2609002-clear', materialSpuCode: 'FLBF2609002', specification: 'clear', unit: 'PCS', requestedQty: 360, preparedQty: 360, imageUrl: '/materials/accessory-label.jpg' },
      ],
    },
    {
      transferOrderNo: 'DB-PF-202608-004',
      productionOrderNo: 'PO-QC-202609-013',
      styleNo: 'HG-QC-013',
      styleName: '后道验收男士休闲衬衫',
      styleImageUrl: '/shirt-sample.jpg',
      sewingTaskNo: 'SEW-TASK-QC-013',
      targetLocationCode: 'PF-MAT-B01-01',
      lines: [
        { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-navy', materialSpuCode: 'FLSZ24116', specification: 'navy', unit: 'PCS', requestedQty: 420, preparedQty: 418, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-shirt', materialSpuCode: 'WLID009', specification: 'shirt', unit: 'PCS', requestedQty: 420, preparedQty: 420, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '树脂四眼扣 1.1cm', materialCode: 'FLSZ26090113-navy-11', materialSpuCode: 'FLSZ26090113', specification: 'navy / 11', unit: 'PCS', requestedQty: 2940, preparedQty: 2928, imageUrl: '/materials/accessory-button.jpg' },
      ],
    },
    {
      transferOrderNo: 'DB-PF-202608-005',
      productionOrderNo: 'PO-QC-202609-014',
      styleNo: 'HG-QC-014',
      styleName: '后道验收短款夹克',
      styleImageUrl: '/jacket-sample.jpg',
      sewingTaskNo: 'SEW-TASK-QC-014',
      targetLocationCode: 'PF-MAT-B01-02',
      lines: [
        { materialName: 'New 吊粒 Clothing tag rope', materialCode: 'FLSZ24116-gray', materialSpuCode: 'FLSZ24116', specification: 'gray', unit: 'PCS', requestedQty: 240, preparedQty: 240, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '服装吊牌 Clothing tags', materialCode: 'WLID009-jacket', materialSpuCode: 'WLID009', specification: 'jacket', unit: 'PCS', requestedQty: 240, preparedQty: 238, imageUrl: '/materials/accessory-label.jpg' },
        { materialName: '金属工字扣 1.5cm', materialCode: 'FLSZ26090114-gunmetal-15', materialSpuCode: 'FLSZ26090114', specification: 'gunmetal / 15', unit: 'PCS', requestedQty: 1200, preparedQty: 1195, imageUrl: '/materials/accessory-button.jpg' },
        { materialName: '后道包装辅件', materialCode: 'FLBF2609003-gray', materialSpuCode: 'FLBF2609003', specification: 'gray', unit: 'PCS', requestedQty: 240, preparedQty: 240, imageUrl: '/materials/accessory-label.jpg' },
      ],
    },
  ]
  const demoSeeds = [
    {
      transferOrderNo: 'DB-PF-202608-001',
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      styleNo: order.styleNo,
      styleName: order.styleName,
      styleImageUrl: order.skus[0]?.imageUrl || '',
      sewingTaskNo: order.sewingTaskNo,
      targetLocationCode: 'PF-MAT-A01-01',
      lines: primaryLines,
    },
    ...extraDemoSeeds.map((seed) => ({ ...seed, productionOrderId: `PF-DEMO-${seed.productionOrderNo}` })),
  ]
  return demoSeeds.map((seed, seedIndex) => {
    const createdAt = new Date(Date.UTC(2026, 7, 24 + seedIndex, 1, 0, 0)).toISOString()
    const approvedAt = new Date(Date.UTC(2026, 7, 24 + seedIndex, 3, 0, 0)).toISOString()
    const readyAt = new Date(Date.UTC(2026, 7, 24 + seedIndex, 7, 30, 0)).toISOString()
    return {
      transferOrderId: `PF-MT-${seed.productionOrderId}`,
      transferOrderNo: seed.transferOrderNo,
      productionOrderId: seed.productionOrderId,
      productionOrderNo: seed.productionOrderNo,
      styleNo: seed.styleNo,
      styleName: seed.styleName,
      styleImageUrl: seed.styleImageUrl,
      sewingTaskNo: seed.sewingTaskNo,
      responsibility: resolvePostFinishingResponsibility('INDEPENDENT_SEWING'),
      sourceWarehouseName: '辅料仓',
      targetWarehouseName: '后道待加工仓',
      targetAreaName: '后道辅料暂存区',
      targetLocationCode: seed.targetLocationCode,
      status: '待入库' as const,
      lines: seed.lines.map((line, lineIndex) => ({
        ...line,
        transferLineId: `PF-MTL-${seed.transferOrderNo.split('-').at(-1)}-${String(lineIndex + 1).padStart(3, '0')}`,
      })),
      statusHistory: [
        { status: '申请调拨' as const, operatedAt: createdAt, operatorName: 'PPIC 配料计划员', remark: '按仅车缝任务生成后道辅料调拨申请' },
        { status: '待调拨' as const, operatedAt: approvedAt, operatorName: '辅料仓主管', remark: '调拨申请审核通过' },
        { status: '待入库' as const, operatedAt: readyAt, operatorName: '辅料仓配料员', remark: '已按实际配料数量一次性备妥，等待后道领料入库' },
      ],
      createdAt,
      updatedAt: readyAt,
    }
  })
}

function ensurePostFinishingMaterialTransferDemo(): void {
  const existingNos = new Set(state.materialTransferOrders.map((item) => item.transferOrderNo))
  const missingTransfers = buildPostFinishingMaterialTransferDemos().filter((item) => !existingNos.has(item.transferOrderNo) && !accessoryPostBridge?.ownsProduction(item.productionOrderId) && !accessoryPostBridge?.ownsProduction(item.productionOrderNo))
  if (missingTransfers.length === 0) return
  missingTransfers.forEach((transfer) => {
    state.materialTransferOrders.push(transfer)
    transfer.statusHistory.forEach((history, index) => appendPostFinishingOperationLog({
      logId: transfer.transferOrderNo === 'DB-PF-202608-001'
        ? `PF-LOG-MATERIAL-${index + 1}`
        : `PF-LOG-MATERIAL-${transfer.transferOrderNo}-${index + 1}`,
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
  })
  persist()
}

export function listPostFinishingMaterialTransferOrders(): PostFinishingMaterialTransferOrder[] {
  const legacy = state.materialTransferOrders.filter(row => !accessoryPostBridge?.ownsProduction(row.productionOrderId) && !accessoryPostBridge?.ownsProduction(row.productionOrderNo))
  return [...clone(legacy), ...(accessoryPostBridge?.transfers() || [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getPostFinishingMaterialTransferOrder(
  transferOrderIdOrNo: string,
): PostFinishingMaterialTransferOrder | undefined {
  const record = listPostFinishingMaterialTransferOrders().find((item) => (
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
  const managed = accessoryPostBridge?.readiness(productionOrderNo)
  if (managed) return managed
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === productionOrderNo)
  const transfer = listPostFinishingMaterialTransferOrders().find((item) => item.productionOrderNo === productionOrderNo)
  const hasFrozenButtonProject = state.qcTasks.some((task) => (
    task.productionOrderNo === productionOrderNo
    && Boolean(task.completedAt)
    && task.frozenProcessItems?.includes('装扣子')
  ))
  // 历史示例保留其既有调拨事实；正式新单以本单本批已确认 QC 项目为依据。
  if (!transfer && !hasFrozenButtonProject && (!order || order.sewingTaskType !== 'INDEPENDENT_SEWING')) {
    return { applicable: false, status: '不适用', label: '当前没有已确认的装扣子项目，无需后道扣子调拨' }
  }
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
  const managedIds = new Set(managedLegacyMaterialState().materialTransferOrders.map(row => row.transferOrderId))
  const legacy = state.materialStocks.filter(row => !managedIds.has(row.transferOrderId) && !accessoryPostBridge?.ownsProduction(row.productionOrderNo))
  return [...clone(legacy), ...(accessoryPostBridge?.stocks() || [])].sort((left, right) => right.inboundAt.localeCompare(left.inboundAt))
}

export function receivePostFinishingMaterialTransfer(input: {
  transferOrderNo: string
  actor: PostFinishingActor
  nowMs?: number
}): { transfer: PostFinishingMaterialTransferOrder; alreadyInbound: boolean } {
  const transfer = state.materialTransferOrders.find((item) => item.transferOrderNo === input.transferOrderNo.trim())
  const managed = accessoryPostBridge?.transfers().some(row => row.transferOrderId === input.transferOrderNo.trim() || row.transferOrderNo === input.transferOrderNo.trim())
  if (managed || (transfer && (accessoryPostBridge?.ownsProduction(transfer.productionOrderId) || accessoryPostBridge?.ownsProduction(transfer.productionOrderNo)))) throw new Error('本范围后道辅料须在辅料调拨入口逐行确认收货并上架，原整单入库入口不可继续写入。')
  if (typeof window !== 'undefined' && !accessoryPostBridge) throw new Error('请先重新读取后道辅料资料，再确认入库。')
  assertPostFinishingWrite()
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
  entryDelayReason?: string
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
    entryDelayReason: input.entryDelayReason?.trim() || undefined,
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

/** Both QC print entrances resolve the current formal source through the same adapter. */
export function getPostFinishingQcPrintProductionSource(qcTaskIdOrNo: string): PostFinishingAcceptanceProductionOrder {
  const task = findQcTask(qcTaskIdOrNo)
  const delivery = findDelivery(task.deliveryId)
  return clone(getProductionOrder(task.productionOrderNo, delivery.executionTaskId))
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
    sourceDocumentNo: input.delivery.deliveryOrderNo,
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
  delivery?: PostFinishingFactoryReturnDelivery
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
  const relation = input.delivery ? relationForDelivery(input.delivery) : { qcTask: state.qcTasks.find(row => row.qcTaskId === input.objectId), postTask: undefined }
  const exactOutbound = state.outboundOrders.find(row => row.outboundOrderId === input.objectId)
  const exactRecheck = state.recheckOrders.find(row => row.recheckOrderId === (exactOutbound?.recheckOrderId || input.objectId))
  appendPostFinishingOperationLog({
    stage: input.stage,
    objectType: input.objectType,
    objectId: input.objectId,
    objectNo: input.objectNo,
    productionOrderNo: input.delivery?.productionOrderNo || '',
    deliveryOrderNo: input.delivery?.deliveryOrderNo || relation.qcTask?.deliveryOrderNo || '',
    qcTaskNo: relation.qcTask?.qcTaskNo,
    postTaskNo: relation.postTask?.postTaskNo,
    recheckOrderNo: exactRecheck?.recheckOrderNo,
    outboundOrderNo: exactOutbound?.outboundOrderNo || exactRecheck?.outboundOrderNo,
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
  assertPostFinishingWrite()
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
  assertPostFinishingWrite()
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
  actualConfirmedAt?: string
  entryDelayReason?: string
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  assertPostFinishingWrite()
  if (!/回货确认/.test(input.actor.roleName) || /PPIC/i.test(input.actor.roleName)) {
    throw new PostFinishingFlowGateError('AUTHORIZATION_REQUIRED', '回货最终确认只能由后道回货确认岗位完成，PPIC不得填写或确认回货数量。')
  }
  const delivery = findDelivery(input.deliveryId)
  if (!['待后道确认', '待二次点数', '差异待授权'].includes(delivery.status)) {
    if (delivery.status === '已确认待送检') return clone(delivery)
    throw new PostFinishingFlowGateError('INVALID_STATUS', `送货单当前为${delivery.status}，不能重复确认回货。`)
  }
  const now = nowIso(input.nowMs)
  const businessConfirmedAt = input.actualConfirmedAt ? new Date(ppicInstant(input.actualConfirmedAt)).toISOString() : now
  if (Date.parse(businessConfirmedAt) > Date.parse(now)) throw new Error('实际后道确认时间不能晚于当前时间。')
  if (input.actualConfirmedAt && businessConfirmedAt !== now && !input.entryDelayReason?.trim()) throw new Error('补录实际确认时间时须填写录入延迟原因。')
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
  delivery.confirmedAt = businessConfirmedAt
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  warehouseRecord.status = '待送检'
  warehouseRecord.confirmedAt = businessConfirmedAt
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
    confirmedAt: businessConfirmedAt,
    versionCreatedAt: now,
    entryDelayReason: input.entryDelayReason,
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
      remark: `回货最终确认即自动生成；编号按回货单号追加 ZJ 且不可人工修改；冻结责任：${qcCreation.task.responsibility.taskTypeLabel} / ${qcCreation.task.responsibility.responsibilityLabel}；来源：${qcCreation.task.responsibility.source}。`,
    })
  }
  return clone(delivery)
}

export function correctPostFinishingFactoryReturnConfirmation(input: {
  deliveryId: string
  correctedCounts: Array<{ skuId: string; actualQty: number }>
  correctionReason: string
  correctedConfirmedAt?: string
  expectedConfirmationVersionId?: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingFactoryReturnDelivery {
  assertPostFinishingWrite()
  const delivery = findDelivery(input.deliveryId)
  const currentVersion = state.returnConfirmationVersions.find(v => v.deliveryId === input.deliveryId && v.status === 'ACTIVE')
  if (input.expectedConfirmationVersionId && currentVersion?.confirmationVersionId !== input.expectedConfirmationVersionId) {
    throw new Error('该回货确认已在其他标签页订正，本次未保存。保留输入，重新读取最新版本后再核对。')
  }
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
  const correctedAt = nowIso(input.nowMs)
  const businessConfirmedAt = input.correctedConfirmedAt ? new Date(ppicInstant(input.correctedConfirmedAt)).toISOString() : delivery.confirmedAt
  if (Date.parse(businessConfirmedAt) > Date.parse(correctedAt)) throw new Error('订正后的实际确认时间不能晚于当前时间。')
  const beforeQuantity = total(delivery.lines.map((line) => line.confirmedQty || 0))
  delivery.lines.forEach((line, index) => {
    const actualQty = correctedQuantities[index]
    line.confirmedQty = actualQty
    line.differenceQty = actualQty - line.registeredQty
    line.differenceRate = quantityDifferenceRate(line.registeredQty, actualQty)
  })
  delivery.confirmedAt = businessConfirmedAt
  delivery.lastCorrectedBy = clone(input.actor)
  delivery.lastCorrectedAt = correctedAt
  const warehouseRecord = getOrCreateWaitProcessWarehouseRecord(delivery)
  warehouseRecord.confirmedAt = businessConfirmedAt
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
    entryDelayReason: state.returnConfirmationVersions.find(v => v.deliveryId === delivery.deliveryId && v.status === 'ACTIVE')?.entryDelayReason
      || (Date.parse(businessConfirmedAt) < Date.parse(delivery.registeredAt) ? `实际确认时间订正：${correctionReason}` : undefined),
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
  assertPostFinishingWrite()
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
  assertPostFinishingWrite()
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
  assertPostFinishingWrite()
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

export function getPostFinishingActiveQcTask(actorId: string): PostFinishingQcTask | undefined {
  const tasks = state.qcTasks.filter(task => task.claimedBy?.actorId === actorId && task.status !== '质检完成')
  if (tasks.length > 1) throw new PostFinishingFlowGateError('CLAIM_CONFLICT', '当前人员有多张未完成质检单，请由主管在质检清单处理后继续。')
  return tasks[0] ? effectiveQcView(tasks[0]) : undefined
}

export function claimPostFinishingQcTask(input: {
  qcTaskNo: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingQcTask {
  assertPostFinishingWrite()
  if (!input.actor.roleName.includes('QC') && !input.actor.roleName.includes('质检')) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '当前账号不是 QC 质检人员，不能领取质检单。')
  }
  const active = getPostFinishingActiveQcTask(input.actor.actorId)
  if (active) {
    if (active.qcTaskNo === input.qcTaskNo.trim()) {
      const current = findQcTask(active.qcTaskId)
      if (!current.inspection) initializePostFinishingQcInspection(current, input.nowMs)
      return clone(current)
    }
    throw new PostFinishingFlowGateError('CLAIM_CONFLICT', `请先完成当前质检单 ${active.qcTaskNo}，再领取下一张。`)
  }
  const exact = state.qcTasks.find((item) => item.qcTaskNo === input.qcTaskNo.trim())
  if (!exact) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整质检任务号，不提供模糊候选。')
  const delivery = exact.sourceKind === 'WAREHOUSE_STOCK' ? undefined : findDelivery(exact.deliveryId)
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
  initializePostFinishingQcInspection(exact, input.nowMs)
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

export function releasePostFinishingQcTask(_input: { qcTaskId: string; actor: PostFinishingActor; reason: string; supervisor?: boolean; nowMs?: number }): PostFinishingQcTask {
  throw new Error('已领取的QC不支持退领、接替或清空结果。请由原领取人完成本单。')
}

function calculatePostFinishingProcessProgress(taskOrId: string | PostFinishingPostTask, includeDetails: boolean, copyDetails = true) {
  const task = typeof taskOrId === 'string' ? findPostTask(taskOrId) : taskOrId
  const records = state.processCompletions.filter(row => row.postTaskId === task.postTaskId)
  const directOutbounds = state.outboundOrders.filter(row => row.postTaskId === task.postTaskId)
  const itemLines = (processItem: PostFinishingProcessItem) => task.lines.map(line => {
    const historyCompletedQty = 0
    const expectedQty = line.expectedQty - historyCompletedQty
    const completedQty = total(records.filter(row => row.processItem === processItem).flatMap(row => row.quantities.filter(q => q.skuId === line.sku.skuId).map(q => q.quantity)))
    return { sku: includeDetails && copyDetails ? clone(line.sku) : line.sku, expectedQty, completedQty, availableQty: 0, historyCompletedQty }
  })
  const selected = POST_FINISHING_PROCESS_ITEMS.filter(item => task.processItems.includes(item))
  const processes = includeDetails ? POST_FINISHING_PROCESS_ITEMS.map(processItem => {
    const applicable = selected.includes(processItem)
    const lines = itemLines(processItem)
    const index = selected.indexOf(processItem)
    const previous = index > 0 ? itemLines(selected[index - 1]) : undefined
    lines.forEach((line, i) => { line.availableQty = applicable ? (previous?.[i].completedQty ?? line.expectedQty) - line.completedQty : 0 })
    return { processItem, applicable, completedQty: total(lines.map(row => row.completedQty)), expectedQty: applicable ? total(lines.map(row => row.expectedQty)) : 0, availableQty: total(lines.map(row => row.availableQty)), lines }
  }) : []
  const last = includeDetails ? processes.find(row => row.processItem === selected.at(-1))
    : selected.length ? { lines: itemLines(selected.at(-1)!) } : undefined
  const lines = task.lines.map((line, i) => {
    const historyCompletedQty = 0
    const completedQty = historyCompletedQty + (last?.lines[i].completedQty || 0)
    const reservedQty = total(directOutbounds.flatMap(row => row.lines.filter(q => q.sku.skuId === line.sku.skuId).map(q => q.outboundQty)))
    return { sku: includeDetails && copyDetails ? clone(line.sku) : line.sku, expectedQty: line.expectedQty, completedQty, reservedQty, historyCompletedQty, availableForOutboundQty: completedQty - reservedQty }
  })
  return { processes, lines, records: includeDetails ? copyDetails ? clone(records) : records : [],
    totalExpectedQty: total(lines.map(row => row.expectedQty)), totalCompletedQty: total(lines.map(row => row.completedQty)),
    totalReservedQty: total(lines.map(row => row.reservedQty)), availableForOutboundQty: total(lines.map(row => row.availableForOutboundQty)) }
}

export function getPostFinishingProcessProgress(taskOrId: string | PostFinishingPostTask) {
  return calculatePostFinishingProcessProgress(taskOrId, true)
}

/** Detached task totals for one synchronous directory read; no copied execution history. */
export function listPostFinishingTaskQuantitySummaries(productionOrderNos?: ReadonlySet<string>) {
  return state.postTasks.filter(task => !productionOrderNos || productionOrderNos.has(task.productionOrderNo)).map(task => {
    const progress = calculatePostFinishingProcessProgress(task, false)
    return { postTaskId: task.postTaskId, productionOrderNo: task.productionOrderNo, qcTaskId: task.qcTaskId,
      status: task.status, completedAt: task.completedAt, totalExpectedQty: progress.totalExpectedQty,
      totalCompletedQty: progress.totalCompletedQty, availableForOutboundQty: progress.availableForOutboundQty }
  })
}

/** Task-directory fields only; each child remains a separate detached primitive row. */
export function listPostFinishingTaskChildQuantitySummaries(productionOrderNos?: ReadonlySet<string>) {
  return {
    rechecks: state.recheckOrders.filter(row => !productionOrderNos || productionOrderNos.has(row.productionOrderNo)).map(row => ({
      recheckOrderId: row.recheckOrderId, productionOrderNo: row.productionOrderNo, qcTaskId: row.qcTaskId,
      status: row.status, completedAt: row.completedAt,
      totalExpectedQty: total(row.lines.map(line => line.expectedQty)),
      totalHandoverQty: total(row.lines.map(line => line.handoverQty || 0)),
    })),
    outbounds: state.outboundOrders.filter(row => !productionOrderNos || productionOrderNos.has(row.productionOrderNo)).map(row => ({
      outboundOrderId: row.outboundOrderId, productionOrderNo: row.productionOrderNo, deliveryId: row.deliveryId, status: row.status,
    })),
    waitHandovers: state.waitHandoverWarehouseRecords.filter(row => !productionOrderNos || productionOrderNos.has(row.productionOrderNo)).map(row => ({
      warehouseRecordId: row.warehouseRecordId, productionOrderNo: row.productionOrderNo,
      totalAvailableQty: total(row.lines.map(line => line.availableQty)),
    })),
  }
}

function assertPostProcessActor(actor: PostFinishingActor): void {
  if (!actor?.actorId?.trim() || !actor.actorName?.trim() || !['后道操作员', '后道主管'].includes(actor.roleName)) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '请使用身份完整的后道人员登记加工。')
  }
}

function validateProcessQuantities(task: PostFinishingPostTask, quantities: Array<{ skuId: string; quantity: number }>) {
  const seen = new Set<string>()
  if (!Array.isArray(quantities) || !quantities.length) throw new PostFinishingFlowGateError('INVALID_QUANTITY', '请填写本次实际数量。')
  for (const line of quantities) {
    if (seen.has(line.skuId) || !task.lines.some(row => row.sku.skuId === line.skuId)) throw new PostFinishingFlowGateError('INVALID_QUANTITY', 'SKU重复或不属于当前加工单。')
    seen.add(line.skuId)
    assertIntegerQuantity(line.quantity, { label: '本次数量' })
    if (!Number.isSafeInteger(line.quantity)) throw new PostFinishingFlowGateError('INVALID_QUANTITY', '数量必须为安全整数件数。')
  }
  if (total(quantities.map(line => line.quantity)) <= 0) throw new PostFinishingFlowGateError('INVALID_QUANTITY', '本次至少登记1件，不保存空记录。')
  return quantities.filter(line => line.quantity > 0).map(line => ({ ...line })).sort((a, b) => a.skuId.localeCompare(b.skuId))
}

function syncPostProcessStatus(task: PostFinishingPostTask, at: string): void {
  const progress = getPostFinishingProcessProgress(task)
  task.status = progress.lines.every(line => line.completedQty === line.expectedQty) ? '后道完成' : progress.totalCompletedQty > 0 || progress.records.length ? '后道中' : '待后道'
  task.completedAt = task.status === '后道完成' ? at : undefined
}

export function appendPostFinishingProcessCompletion(input: {
  postTaskId: string; processItem: PostFinishingProcessItem; quantities: Array<{ skuId: string; quantity: number }>
  responsible: PostFinishingActor; actor: PostFinishingActor; operationId: string; nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  assertPostProcessActor(input.actor)
  assertPostProcessActor(input.responsible)
  const task = findPostTask(input.postTaskId)
  const quantities = validateProcessQuantities(task, input.quantities)
  if (!input.operationId?.trim()) throw new PostFinishingFlowGateError('INVALID_STATUS', '缺少本次提交标识，请重新打开登记。')
  const intent = JSON.stringify({ postTaskId: task.postTaskId, processItem: input.processItem, quantities, responsible: input.responsible, actor: input.actor })
  const existing = (state.processCompletions || []).find(row => row.operationId === input.operationId)
  if (existing) {
    if (existing.intent !== intent) throw new PostFinishingFlowGateError('INVALID_STATUS', '同次提交内容已变化，请重新打开登记。')
    return clone(task)
  }
  const progress = getPostFinishingProcessProgress(task)
  const process = progress.processes.find(row => row.processItem === input.processItem && row.applicable)
  if (!process) throw new PostFinishingFlowGateError('INVALID_STATUS', '当前加工项不在质检确认范围内。')
  for (const line of quantities) {
    const available = process.lines.find(row => row.sku.skuId === line.skuId)!.availableQty
    if (line.quantity > available) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `本SKU当前最多可登记${available}件，请核对前序完成量。`)
  }
  const at = nowIso(input.nowMs)
  state.processCompletions ||= []
  state.processCompletions.push({ recordId: `PF-PC-${input.operationId}`, operationId: input.operationId, intent, postTaskId: task.postTaskId,
    processItem: input.processItem, quantities, responsible: clone(input.responsible), recordedBy: clone(input.actor), recordedAt: at })
  task.startedAt ||= at
  task.startedBy ||= clone(input.actor)
  state.schemaVersion = 5
  syncPostProcessStatus(task, at)
  appendBusinessLog({ stage: '后道', delivery: findDelivery(task.deliveryId), objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: `登记${input.processItem}完成`, actor: input.actor, operatedAt: at, afterStatus: task.status,
    afterQuantity: total(quantities.map(row => row.quantity)), remark: `责任人：${input.responsible.actorName}；${quantities.map(row => `${row.skuId} ${row.quantity}件`).join('；')}` })
  persist()
  return clone(task)
}

export function correctPostFinishingProcessCompletion(input: {
  recordId: string; quantities: Array<{ skuId: string; quantity: number }>; reason: string; actor: PostFinishingActor; operationId: string; nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  assertPostProcessActor(input.actor)
  if (!input.actor.roleName.includes('主管') || !input.reason?.trim()) throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '订正需后道主管身份及具体原因。')
  const original = state.processCompletions.find(row => row.recordId === input.recordId && !row.correctionOf)
  if (!original) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到可订正的原加工记录。')
  const task = findPostTask(original.postTaskId)
  // Zero is legal in a correction; all original SKU identities must be present.
  if (!input.operationId?.trim() || input.quantities.length !== original.quantities.length || new Set(input.quantities.map(row => row.skuId)).size !== original.quantities.length) throw new PostFinishingFlowGateError('INVALID_QUANTITY', '请逐SKU填写订正数量。')
  input.quantities.forEach(row => { if (!original.quantities.some(q => q.skuId === row.skuId) || !Number.isSafeInteger(row.quantity) || row.quantity < 0) throw new PostFinishingFlowGateError('INVALID_QUANTITY', '订正数量必须是原SKU的非负整数。') })
  const intent = JSON.stringify({ recordId: input.recordId, quantities: [...input.quantities].sort((a,b) => a.skuId.localeCompare(b.skuId)), reason: input.reason.trim(), actor: input.actor })
  const existing = state.processCompletions.find(row => row.operationId === input.operationId)
  if (existing) { if (existing.intent !== intent) throw new PostFinishingFlowGateError('INVALID_STATUS', '同次订正内容已变化。'); return clone(task) }
  const previousCorrections = state.processCompletions.filter(row => row.correctionOf === original.recordId)
  const quantities = input.quantities.map(row => ({ skuId: row.skuId, quantity: row.quantity - total([original, ...previousCorrections].flatMap(item => item.quantities.filter(q => q.skuId === row.skuId).map(q => q.quantity))) }))
  const record: PostFinishingProcessCompletion = { recordId: `PF-PC-${input.operationId}`, operationId: input.operationId, intent, postTaskId: task.postTaskId, processItem: original.processItem,
    quantities, responsible: clone(original.responsible), recordedBy: clone(input.actor), recordedAt: nowIso(input.nowMs), correctionOf: original.recordId, reason: input.reason.trim() }
  state.processCompletions.push(record)
  const progress = getPostFinishingProcessProgress(task)
  state.processCompletions.pop()
  if (progress.processes.some(row => row.applicable && row.lines.some(line => line.completedQty < 0 || line.availableQty < 0 || line.completedQty > line.expectedQty)) || progress.lines.some(line => line.availableForOutboundQty < 0)) {
    throw new PostFinishingFlowGateError('INVALID_QUANTITY', '订正会破坏前后序或已准备出货数量，请先核对实际后续记录。')
  }
  state.processCompletions.push(record)
  syncPostProcessStatus(task, record.recordedAt)
  appendBusinessLog({ stage: '后道', delivery: findDelivery(task.deliveryId), objectType: '后道加工单', objectId: task.postTaskId, objectNo: task.postTaskNo,
    action: `订正${original.processItem}记录`, actor: input.actor, operatedAt: record.recordedAt, differenceQuantity: total(quantities.map(row => row.quantity)), remark: input.reason.trim() })
  persist()
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

export interface InventoryPostFinishingQcInput {
  applicationId: string; applicationNo: string; warehouseId: string; warehouseName: string
  styleId: string; styleNo: string; styleName: string; styleImageUrl: string; receivedAt: string; receivedBy: PostFinishingActor
  lines: Array<{ skuId: string; skuCode: string; colorName: string; sizeName: string; imageUrl: string; receivedQty: number }>
}
interface InventoryQcCompletion {
  applicationId: string; qcTaskId: string; qcTaskNo: string; completedAt: string; operatorName: string
  results: Array<{ skuId: string; inspectedQty: number; passedQty: number; defectQty: number; reworkQty: number }>
}
let inventoryQcCompletion: ((input: InventoryQcCompletion) => void) | undefined
export function registerPostFinishingInventoryQcCompletion(callback: (input: InventoryQcCompletion) => void): void { inventoryQcCompletion = callback }
export function createInventoryPostFinishingQcTask(input: InventoryPostFinishingQcInput): { qcTaskId: string; qcTaskNo: string } {
  assertPostFinishingWrite()
  const previous = state.qcTasks.find(row => row.inventoryApplicationId === input.applicationId)
  if (previous) return { qcTaskId: previous.qcTaskId, qcTaskNo: previous.qcTaskNo }
  if (!input.applicationId || !input.warehouseId || !input.lines.length || new Set(input.lines.map(row => row.skuId)).size !== input.lines.length) throw new Error('库存送检身份或SKU明细不完整。')
  input.lines.forEach(line => assertIntegerQuantity(line.receivedQty, { label: '库存实收数量' }))
  if (total(input.lines.map(row => row.receivedQty)) <= 0) throw new Error('实收为0尚无可检查衣服，请先核对交接差异。')
  const task: PostFinishingQcTask = {
    qcTaskId: `INV-QC-${input.applicationId}`, qcTaskNo: `${input.applicationNo}-QC`, sourceKind: 'WAREHOUSE_STOCK', inventoryApplicationId: input.applicationId,
    sourceWarehouseId: input.warehouseId, sourceWarehouseName: input.warehouseName, styleId: input.styleId,
    deliveryId: '', deliveryOrderNo: input.applicationNo, productionOrderId: '', productionOrderNo: '', returnIndex: 1,
    responsibility: { ...resolvePostFinishingResponsibility('INDEPENDENT_SEWING', input.receivedAt), taskTypeLabel: '成衣库存送检', defaultProcessItems: [], processItemsEditable: false },
    status: '待质检', referenceIds: [], createdAt: input.receivedAt, sentAt: input.receivedAt, createdBy: clone(input.receivedBy), sentBy: clone(input.receivedBy),
    lines: input.lines.map(line => ({ expectedQty: line.receivedQty, sku: { skuId: line.skuId, skuCode: line.skuCode, spuCode: input.styleNo, spuName: input.styleName,
      colorName: line.colorName, sizeName: line.sizeName, imageUrl: line.imageUrl || input.styleImageUrl, barcode: line.skuCode, plannedQty: line.receivedQty, qtyUnit: '件' } })),
  }
  state.qcTasks.push(task); persist()
  return { qcTaskId: task.qcTaskId, qcTaskNo: task.qcTaskNo }
}
function qcSupply(task: PostFinishingQcTask) { return task.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.expectedQty })) }
function initialInspectionSource(task: PostFinishingQcTask) {
  if (task.sourceKind === 'WAREHOUSE_STOCK') return undefined
  const delivery = findDelivery(task.deliveryId)
  return { productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderNo, taskId: delivery.executionTaskId, factoryId: delivery.sewingFactoryId }
}
function rememberInitialFullCoverage(task: PostFinishingQcTask, nowMs?: number): void {
  if(buildingDemoData)return
  if (!task.inspection || task.status === '质检完成') return
  const sourceInput = initialInspectionSource(task)
  if (!sourceInput) return
  const evaluated = evaluateProductionInitialFullInspection({ ...sourceInput, conditions: task.inspection.snapshot.ruleSnapshot?.initialFullInspection || null })
  task.inspectionSourceWarnings = evaluated.unresolved
  for (const reason of evaluated.reasons) {
    const coverageId = [reason.code,reason.productionOrderId,reason.styleId || reason.styleCode,reason.scope === 'FACTORY_PRODUCTION_ORDER' ? reason.factoryId : 'ALL'].join(':')
    if (!state.fullCoverages.some(row => row.coverageId === coverageId)) state.fullCoverages.push({ ...reason,coverageId,createdAt:nowIso(nowMs),ruleId:task.inspection.snapshot.ruleSnapshot!.id,ruleVersion:task.inspection.snapshot.ruleSnapshot!.version })
  }
  const coverages = state.fullCoverages.filter(row => row.productionOrderId === task.productionOrderId && (row.scope === 'PRODUCTION_ORDER' || row.factoryId === sourceInput.factoryId))
  if (coverages.length) applyPostQcFullCoverage(task.inspection,coverages.map(row=>row.label),coverages.map(row=>row.createdAt).sort()[0])
  else if (evaluated.unresolved.length && task.inspection.snapshot.ruleSnapshot?.initialFullInspection) throw new Error(`初始全检来源未能确定：${evaluated.unresolved.join('；')}。请先核对来源，不能推测为抽检。`)
}
function initializePostFinishingQcInspection(task: PostFinishingQcTask, nowMs?: number): void {
  if(buildingDemoData) {
    // Fixed new-format demonstration; no browser source reads or seed writes.
    const snapshot=buildInspectionSnapshotFromConfigurations({sourceKind:'PRODUCTION_RETURN',styleId:task.styleId,styleCode:task.lines[0]?.sku.spuCode})
    snapshot.id=`DEMO-STANDARD:${task.qcTaskId}`; snapshot.selectedAt=nowIso(nowMs)
    snapshot.skuSnapshots=task.lines.map(line=>({skuId:line.sku.skuId,snapshot:{...buildInspectionSnapshotFromConfigurations({...snapshot.context,attributes:{size:line.sku.sizeName,color:line.sku.colorName}}),id:`${snapshot.id}:${line.sku.skuId}`,selectedAt:snapshot.selectedAt}}))
    task.inspection=createPostQcInspection(snapshot,['演示样本：工厂首次车缝任务全检'])
    return
  }
  if (task.inspection) { rememberInitialFullCoverage(task,nowMs); return }
  const sourceInput = initialInspectionSource(task)
  const source = sourceInput ? resolveProductionInspectionSource(sourceInput) : undefined
  const context = { sourceKind: task.sourceKind || 'PRODUCTION_RETURN' as const, ...resolveQualityStyleContext({styleId:task.styleId || source?.styleId,styleCode:source?.styleCode || task.lines[0]?.sku.spuCode}),
    references: listPostFinishingQcReferences().filter(row => task.referenceIds.includes(row.referenceId)).map(row => ({ id: `${row.referenceId}:v${row.version}`, name: row.title, kind: 'DOCUMENT' as const, sourceId:row.referenceId, sourceVersion:row.version, description:row.description, imageUrl:row.imageUrl, value:row.imageUrl || row.description })) }
  const buildSnapshot = readPreparedInspectionSnapshot
  const snapshot = buildSnapshot(context)
  snapshot.skuSnapshots = task.lines.map(line => ({ skuId: line.sku.skuId,snapshot:buildSnapshot({...context,attributes:{size:line.sku.sizeName,color:line.sku.colorName}}) }))
  task.inspection = createPostQcInspection(snapshot)
  rememberInitialFullCoverage(task,nowMs)
}
function effectiveQcView(task: PostFinishingQcTask): PostFinishingQcTask {
  const view = clone(task)
  if (view.inspection && view.status !== '质检完成' && view.sourceKind !== 'WAREHOUSE_STOCK') {
    const delivery = state.deliveries.find(row => row.deliveryId === view.deliveryId)
    const coverages = state.fullCoverages.filter(row => row.productionOrderId === view.productionOrderId && (row.scope === 'PRODUCTION_ORDER' || row.factoryId === delivery?.sewingFactoryId))
    if(coverages.length)applyPostQcFullCoverage(view.inspection,coverages.map(row=>row.label),coverages.map(row=>row.createdAt).sort()[0])
  }
  return view
}
export function getPostFinishingQcInspectionSummary(taskOrId: string | PostFinishingQcTask) {
  const task = effectiveQcView(typeof taskOrId === 'string' ? findQcTask(taskOrId) : taskOrId)
  return task.inspection ? getPostQcSummary(task.inspection,qcSupply(task)) : undefined
}
export function submitPostFinishingQcRound(input: { qcTaskId: string; actor: PostFinishingActor; operationId: string; lines: PostQcCount[]; nowMs?: number }): PostFinishingQcTask {
  assertPostFinishingWrite()
  const task = findQcTask(input.qcTaskId)
  if (task.status !== '质检中' || task.claimedBy?.actorId !== input.actor.actorId) throw new Error('只有当前领取人能提交尚未结束的QC。')
  if (!task.inspection) throw new Error('本次质检要求缺失，请重新读取后核对。')
  rememberInitialFullCoverage(task,input.nowMs)
  const round = submitPostQcRound(task.inspection, qcSupply(task), { ...input, actorId: input.actor.actorId, submittedAt: nowIso(input.nowMs) })
  appendBusinessLog({ stage: '质检', delivery: task.sourceKind === 'WAREHOUSE_STOCK' ? undefined : findDelivery(task.deliveryId), objectType: '质检单', objectId: task.qcTaskId,
    objectNo: task.qcTaskNo, action: `提交第${round.roundNumber}轮检查`, actor: input.actor, operatedAt: round.submittedAt,
    afterQuantity: total(round.lines.map(row => row.passedQty + row.defectQty + row.returnQty)), remark: task.inspection.audits.some(row => row.status === 'PENDING') ? '达到本轮阈值，待稽查；QC尚未完成' : '本轮结果已保存；QC尚未完成' })
  persist(); return clone(task)
}
export function upgradePostFinishingQcInspection(input: { qcTaskId: string; actor: PostFinishingActor; nextPercent: number; note: string; nowMs?: number }): PostFinishingQcTask {
  assertPostFinishingWrite()
  const task = findQcTask(input.qcTaskId)
  if (task.status !== '质检中' || task.claimedBy?.actorId !== input.actor.actorId || !task.inspection) throw new Error('请在原在检QC办理稽查。')
  rememberInitialFullCoverage(task,input.nowMs)
  upgradePostQcInspection(task.inspection, { nextPercent: input.nextPercent, note: input.note, decidedAt: nowIso(input.nowMs) })
  appendBusinessLog({ stage: '质检', delivery: task.sourceKind === 'WAREHOUSE_STOCK' ? undefined : findDelivery(task.deliveryId), objectType: '质检单', objectId: task.qcTaskId,
    objectNo: task.qcTaskNo, action: '稽查提高检查比例', actor: input.actor, operatedAt: nowIso(input.nowMs), remark: `${input.nextPercent}%：${input.note}` })
  persist(); return clone(task)
}
export function attachPostFinishingQcSignedPaper(input: { qcTaskId: string; actor: PostFinishingActor; url: string; name: string; nowMs?: number }): PostFinishingQcTask {
  assertPostFinishingWrite()
  const task = findQcTask(input.qcTaskId)
  if (task.status !== '质检中' || task.claimedBy?.actorId !== input.actor.actorId || !task.inspection) throw new Error('只有原领取人能上传当前在检QC纸单。')
  if (!input.url || !input.name.trim()) throw new Error('请选择真实纸单文件。')
  rememberInitialFullCoverage(task,input.nowMs)
  task.inspection.papers.push({ id: buildingDemoData ? `DEMO-PAPER:${task.qcTaskId}:${task.inspection.paperVersion}` : crypto.randomUUID(), version: task.inspection.paperVersion, name: input.name, url: input.url, uploadedAt: nowIso(input.nowMs) })
  persist(); return clone(task)
}
export function clarifyPostFinishingQcBasis(input:{qcTaskId:string;actor:PostFinishingActor;itemId:string;conflictDescription:string;adoptedBasis:string;clarificationNote:string;operationId:string;nowMs?:number}):PostFinishingQcTask {
  assertPostFinishingWrite()
  const task=findQcTask(input.qcTaskId)
  if (task.status!=='质检中' || task.claimedBy?.actorId!==input.actor.actorId || !task.inspection) throw new Error('请在当前领取的在检QC澄清依据。')
  const items=[...task.inspection.snapshot.items,...(task.inspection.snapshot.skuSnapshots || []).flatMap(row=>row.snapshot.items)]
  if (!items.some(row=>row.id===input.itemId) || ![input.conflictDescription,input.adoptedBasis,input.clarificationNote,input.operationId].every(value=>value.trim())) throw new Error('须明确本次检查项目、冲突内容、实际采用依据及澄清说明。')
  task.inspection.basisClarifications ||= []
  const previous=task.inspection.basisClarifications.find(row=>row.id===input.operationId)
  if (previous) {if(previous.itemId!==input.itemId || previous.conflictDescription!==input.conflictDescription.trim() || previous.adoptedBasis!==input.adoptedBasis.trim() || previous.clarificationNote!==input.clarificationNote.trim())throw new Error('该澄清操作已保存，不能用相同操作身份更换内容。');return clone(task)}
  task.inspection.basisClarifications.push({id:input.operationId,itemId:input.itemId,conflictDescription:input.conflictDescription.trim(),adoptedBasis:input.adoptedBasis.trim(),clarificationNote:input.clarificationNote.trim(),at:nowIso(input.nowMs),by:input.actor.actorName})
  persist();return clone(task)
}
/** A separate actual follow-up note never changes original results or creates another logistics branch. */
export function getPostFinishingIndependentCheckStandard(qcTaskId:string):InspectionSnapshot {
  const task=findQcTask(qcTaskId)
  if (task.status!=='质检完成') throw new Error('独立追检只关联已完成原记录。')
  const source=initialInspectionSource(task),resolved=source?resolveProductionInspectionSource(source):undefined
  return readPreparedInspectionSnapshot({sourceKind:task.sourceKind || 'PRODUCTION_RETURN',...resolveQualityStyleContext({styleId:task.styleId || resolved?.styleId,styleCode:task.lines[0]?.sku.spuCode})})
}
export function recordPostFinishingIndependentCheck(input:{qcTaskId:string;actor:PostFinishingActor;objectDescription:string;scopeDescription:string;itemIds:string[];reason:string;result:string;operationId:string;nowMs?:number}):PostFinishingQcTask {
  assertPostFinishingWrite()
  const task=findQcTask(input.qcTaskId)
  if (task.status!=='质检完成') throw new Error('独立追检须关联已完成的原QC；在检单仍按本单轮次办理。')
  if (!['QC质检员','QC主管'].includes(input.actor.roleName)) throw new Error('请由质检办理人登记实际追检记录。')
  if (![input.objectDescription,input.scopeDescription,input.reason,input.result,input.operationId].every(value=>value.trim()) || !input.itemIds.length) throw new Error('须明确追检对象、范围、项目、原因和实际检查结果。')
  const previous=task.independentChecks?.find(row=>row.id===input.operationId)
  if(previous){if(previous.objectDescription!==input.objectDescription.trim() || previous.scopeDescription!==input.scopeDescription.trim() || previous.reason!==input.reason.trim() || previous.result!==input.result.trim() || JSON.stringify(previous.itemIds)!==JSON.stringify(input.itemIds))throw new Error('该追检操作已保存，不能用相同操作身份更换内容。');return clone(task)}
  const snapshot=getPostFinishingIndependentCheckStandard(task.qcTaskId)
  if (new Set(input.itemIds).size!==input.itemIds.length || input.itemIds.some(id=>!snapshot.items.some(item=>item.id===id))) throw new Error('追检项目必须属于本次有效标准。')
  task.independentChecks ||= []
  task.independentChecks.push({id:input.operationId,originalRecordId:task.qcTaskId,objectDescription:input.objectDescription.trim(),scopeDescription:input.scopeDescription.trim(),itemIds:[...input.itemIds],reason:input.reason.trim(),result:input.result.trim(),at:nowIso(input.nowMs),by:clone(input.actor),snapshot})
  persist();return clone(task)
}
export function completePostFinishingQcTask(input: { qcTaskId: string; actor: PostFinishingActor; processItems?: string[]; results?: Array<Omit<PostFinishingQualityResultLine, 'sku' | 'expectedQty'> & { skuId: string }>; authorization?: PostFinishingAuthorizationInput; nowMs?: number }): PostFinishingQcTask {
  assertPostFinishingWrite()
  const task = findQcTask(input.qcTaskId)
  if (task.status === '质检完成') return clone(task)
  if (task.claimedBy?.actorId !== input.actor.actorId || !task.inspection) throw new Error('请由原领取人在固定标准下完成本单检查。')
  rememberInitialFullCoverage(task,input.nowMs)
  const summary = assertPostQcCompletable(task.inspection, qcSupply(task), task.sourceKind !== 'WAREHOUSE_STOCK')
  if (task.sourceKind === 'WAREHOUSE_STOCK') {
    if (!inventoryQcCompletion) throw new Error('库存交接资料尚未准备，QC未完成，请重新读取后重试。')
    inventoryQcCompletion({ applicationId: task.inventoryApplicationId!, qcTaskId: task.qcTaskId, qcTaskNo: task.qcTaskNo, completedAt: nowIso(input.nowMs), operatorName: input.actor.actorName,
      results: summary.lines.map(row => ({ skuId: row.skuId, inspectedQty: row.inspectedQty, passedQty: row.passedQty, defectQty: row.defectQty, reworkQty: row.returnQty })) })
    task.results = summary.lines.map(row => ({ sku: clone(task.lines.find(line => line.sku.skuId === row.skuId)!.sku), expectedQty: row.quantity, passedQty: row.passedQty, defectQty: row.defectQty,
      returnQty: row.returnQty, uninspectedQty: row.uninspectedQty, releasedQty: row.releasedQty }))
    task.frozenProcessItems = []; task.status = '质检完成'; task.completedAt = nowIso(input.nowMs); persist(); return clone(task)
  }
  const results = summary.lines.map(row => {
    const issues = [...new Map(task.inspection!.rounds.flatMap(round => round.lines.filter(line => line.skuId === row.skuId).flatMap(line => line.issues || [])).map(issue => [issue.itemId, issue])).values()]
    return { skuId: row.skuId, passedQty: row.passedQty, defectQty: row.defectQty, returnQty: row.returnQty, uninspectedQty: row.uninspectedQty, releasedQty: row.releasedQty, issues,
      defectReason: issues.map(issue => task.inspection!.snapshot.items.find(item => item.id === issue.itemId)?.name || issue.itemId).join('、'), returnReason: row.returnQty ? '按本次标准发现返工问题' : undefined,
      returnReceiver: row.returnQty ? 'goto_global' : undefined }
  })
  return completePostFinishingQcResults({ ...input, results })
}

function completePostFinishingQcResults(input: {
  qcTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingQualityResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
  processItems?: string[]
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): PostFinishingQcTask {
  assertPostFinishingWrite()
  const task = findQcTask(input.qcTaskId)
  const delivery = findDelivery(task.deliveryId)
  if (task.status === '质检完成') return clone(task)
  if (!task.claimedBy || task.claimedBy.actorId !== input.actor.actorId) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有当前领取质检任务的质检员可以提交结果。')
  }
  const submittedProcessItems = (input.processItems || []).map((item) => item.trim()).filter(Boolean)
  const invalidProcessItem = submittedProcessItems.find((item) => !POST_FINISHING_PROCESS_ITEMS.includes(item as PostFinishingProcessItem))
  if (invalidProcessItem) {
    throw new PostFinishingFlowGateError('INVALID_STATUS', `后道项目“${invalidProcessItem}”不是当前有效名称；请分别选择开扣眼、装扣子、熨烫、包装。`)
  }
  const now = nowIso(input.nowMs)
  const results: PostFinishingQualityResultLine[] = task.lines.map((line) => {
    const submitted = input.results.find((item) => item.skuId === line.sku.skuId)
    if (!submitted) throw new PostFinishingFlowGateError('INVALID_QUANTITY', `缺少 SKU ${line.sku.skuCode} 的质检结果。`)
    assertIntegerQuantity(submitted.passedQty, { label: `SKU ${line.sku.skuCode} 合格数量` })
    assertIntegerQuantity(submitted.defectQty, { label: `SKU ${line.sku.skuCode} 瑕疵数量` })
    assertIntegerQuantity(submitted.returnQty, { label: `SKU ${line.sku.skuCode} 返厂数量` })
    if (submitted.returnQty > 0 && (!submitted.returnReason?.trim() || !submitted.returnReceiver?.trim())) {
      throw new Error(`SKU ${line.sku.skuCode} 有返工数量时必须选择返工工厂。`)
    }
    if (submitted.returnQty > 0 && submitted.returnReceiver !== 'goto_global' && !listPostFinishingQcReworkFactoryOptions().some((item) => item.value === submitted.returnReceiver?.trim())) {
      throw new PostFinishingFlowGateError('INVALID_STATUS', `SKU ${line.sku.skuCode} 的返工工厂必须从列表中选择。`)
    }
    return {
      sku: clone(line.sku),
      expectedQty: line.expectedQty,
      passedQty: submitted.passedQty,
      uninspectedQty: submitted.uninspectedQty, releasedQty: submitted.releasedQty, issues: submitted.issues,
      defectQty: submitted.defectQty,
      returnQty: submitted.returnQty,
      defectReason: submitted.defectReason,
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
  task.results = results
  const responsibility = task.responsibility || resolvePostFinishingResponsibility(delivery.sewingTaskType)
  const selectedItems = submittedProcessItems as PostFinishingProcessItem[]
  const processItems = POST_FINISHING_PROCESS_ITEMS.filter(item => selectedItems.includes(item))
  const needPostFinishing = processItems.length > 0
  const qualifiedQty = total(results.map((line) => line.releasedQty ?? line.passedQty))
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
  if (!needPostFinishing || qualifiedQty === 0) {
    const outbound = qualifiedQty > 0
      ? upsertOutboundFromQc(task, delivery, results, now)
      : undefined
    persist()
    appendBusinessLog({
      stage: '质检', delivery, objectType: '质检任务', objectId: task.qcTaskId, objectNo: task.qcTaskNo,
      action: '完成质检', actor: input.actor, operatedAt: now, beforeStatus: '质检中', afterStatus: task.status,
      beforeQuantity: total(task.lines.map((line) => line.expectedQty)),
      afterQuantity: total(quantities.map((line) => line.actualQty)),
      differenceQuantity: 0,
      remark: outbound
        ? `本次不需要我方后道处理；不生成后道加工单，生成待实际发出的后道出货单 ${outbound.outboundOrderNo}`
        : '本次没有合格可交数量；不生成后道加工单或空出货单',
    })
    if (outbound) {
      appendBusinessLog({
        stage: '出货', delivery, objectType: '后道出货单', objectId: outbound.outboundOrderId, objectNo: outbound.outboundOrderNo,
        action: '质检直达生成成衣仓交接单', actor: input.actor, operatedAt: now, afterStatus: outbound.status,
        afterQuantity: total(outbound.lines.map((line) => line.outboundQty)),
        remark: '已准备本批出货，须实际发出后再由成衣仓确认实收',
      })
    }
    return clone(task)
  }
  const postTaskId = `PF-POST-${delivery.productionOrderId}-${delivery.returnIndex}`
  const number = issuePostFinishingDocumentNumber({
    kind: 'POST',
    sourceDocumentNo: task.qcTaskNo,
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
    executionModel: 'ITEMS_V1' as const,
    lines: results.map((line) => ({ sku: clone(line.sku), expectedQty: line.releasedQty ?? line.passedQty })),
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
    differenceQuantity: 0,
    differenceReason: input.authorization?.differenceReason,

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
  assertPostFinishingWrite()
  throw new PostFinishingFlowGateError('INVALID_STATUS', '整单归类入口已停用，请分别登记加工项，再按可用数量准备出货。')
}

export function setPostFinishingPostProcessedQuantity(input: {
  postTaskId: string
  skuId: string
  processedQty: number
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  throw new PostFinishingFlowGateError('INVALID_STATUS', '整单归类入口已停用，请分别登记加工项，再按可用数量准备出货。')
}

export function setPostFinishingPostUnprocessedQuantity(input: {
  postTaskId: string
  skuId: string
  unprocessedQty: number
  unprocessedReason?: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  throw new PostFinishingFlowGateError('INVALID_STATUS', '整单归类入口已停用，请分别登记加工项，再按可用数量准备出货。')
}

export function completePostFinishingPostTaskFromDraft(input: {
  postTaskId: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  throw new PostFinishingFlowGateError('INVALID_STATUS', '整单归类入口已停用，请分别登记加工项，再按可用数量准备出货。')
}

export function startPostFinishingPostTask(input: { postTaskNo: string; actor: PostFinishingActor; nowMs?: number }): PostFinishingPostTask {
  assertPostFinishingWrite()
  assertPostProcessActor(input.actor)
  const task = state.postTasks.find(row => row.postTaskNo === input.postTaskNo.trim())
  if (!task) throw new PostFinishingFlowGateError('NOT_FOUND', '未找到完整后道加工单号。')
  return clone(task)
}

export function completePostFinishingPostTask(input: {
  postTaskId: string
  actor: PostFinishingActor
  results: Array<Omit<PostFinishingPostResultLine, 'sku' | 'expectedQty'> & { skuId: string }>
  nowMs?: number
}): PostFinishingPostTask {
  assertPostFinishingWrite()
  throw new PostFinishingFlowGateError('INVALID_STATUS', '整单归类入口已停用，请分别登记加工项，再按可用数量准备出货。')
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
    sourceDocumentNo: qcTask.qcTaskNo,
    productionOrderNo: delivery.productionOrderNo,
    sourceObjectId: qcTask.qcTaskId,
    idempotencyKey: `OUTBOUND:QC:${qcTask.qcTaskId}`,
    sequence: delivery.returnIndex,
  }, new Date(createdAt))
  const outbound: PostFinishingOutboundOrder = {
    outboundOrderId,
    targetWarehouseId: readQcShippingDestination(qcTask.qcTaskId)?.warehouseId || readQcShippingDestination(delivery.productionOrderNo)?.warehouseId,
    outboundOrderNo: number.documentNo,
    deliveryId: delivery.deliveryId,
    deliveryOrderNo: delivery.deliveryOrderNo,
    productionOrderNo: delivery.productionOrderNo,
    qcTaskId: qcTask.qcTaskId,
    qcTaskNo: qcTask.qcTaskNo,
    responsibility: clone(qcTask.responsibility),
    sourceType: '质检直达',
    returnIndex: delivery.returnIndex,
    status: '待出货',
    executionModel: 'DIRECT_V2',
    lines: results.filter(line => (line.releasedQty ?? line.passedQty) > 0).map((line) => ({ sku: clone(line.sku), outboundQty: line.releasedQty ?? line.passedQty })),
    createdAt,
  }
  state.outboundOrders.push(outbound)
  ensureDirectOutboundWarehouseRecord(outbound, qcTask.claimedBy || qcTask.createdBy)
  qcTask.outboundOrderId = outbound.outboundOrderId
  qcTask.outboundOrderNo = outbound.outboundOrderNo
  return outbound
}

function ensureDirectOutboundWarehouseRecord(outbound: PostFinishingOutboundOrder, actor: PostFinishingActor): PostFinishingWaitHandoverWarehouseRecord {
  const previous = state.waitHandoverWarehouseRecords.find(row => row.outboundOrderId === outbound.outboundOrderId)
  if (previous) return previous
  const record: PostFinishingWaitHandoverWarehouseRecord = {
    warehouseRecordId: `PF-WHW-${outbound.outboundOrderId}`, deliveryId: outbound.deliveryId, deliveryOrderNo: outbound.deliveryOrderNo, productionOrderNo: outbound.productionOrderNo,
    returnIndex: outbound.returnIndex, qcTaskId: outbound.qcTaskId, qcTaskNo: outbound.qcTaskNo, postTaskId: outbound.postTaskId, postTaskNo: outbound.postTaskNo,
    responsibility: clone(outbound.responsibility), sourceType: outbound.sourceType, outboundOrderId: outbound.outboundOrderId, outboundOrderNo: outbound.outboundOrderNo,
    areaName: '处理后待交出区', locationCode: `OUT-${outbound.outboundOrderId}`, status: '待交出', createdAt: outbound.createdAt, createdBy: clone(actor),
    lines: outbound.lines.map(line => ({ sku: clone(line.sku), inboundQty: line.outboundQty, availableQty: line.outboundQty, handedOverQty: 0 })) }
  state.waitHandoverWarehouseRecords.push(record)
  appendWaitHandoverWarehouseMovement({ record, movementType:'出货准备入区',operator:actor,operatedAt:outbound.createdAt })
  return record
}

export function submitPostFinishingForOutbound(input: {
  postTaskId: string; quantities: Array<{ skuId: string; quantity: number }>; actor: PostFinishingActor; operationId: string; nowMs?: number
}): PostFinishingOutboundOrder {
  assertPostFinishingWrite()
  assertPostProcessActor(input.actor)
  const task = findPostTask(input.postTaskId), qc = findQcTask(task.qcTaskId)
  if (qc.status !== '质检完成') throw new Error('QC尚未完成，不允许先交出部分货物。')
  const intent = JSON.stringify({ postTaskId: input.postTaskId, quantities: input.quantities })
  const duplicate = state.outboundOrders.find(row => row.operationId === input.operationId)
  if (duplicate) { if (duplicate.operationIntent !== intent) throw new Error('此出货分配已经提交，不能改写。'); return clone(duplicate) }
  if (!input.operationId.trim() || !input.quantities.length || new Set(input.quantities.map(row => row.skuId)).size !== input.quantities.length) throw new Error('出货缺少提交身份或SKU重复。')
  const progress = calculatePostFinishingProcessProgress(task,true)
  const lines = input.quantities.map(row => {
    assertIntegerQuantity(row.quantity,{ label: '本次出货数量' })
    const available = progress.lines.find(line => line.sku.skuId === row.skuId)
    if (!available || row.quantity > available.availableForOutboundQty) throw new Error('出货量超过该SKU末项已完成且未分配的数量。')
    return { sku: clone(available.sku), outboundQty: row.quantity }
  }).filter(row => row.outboundQty > 0)
  if (!lines.length) throw new Error('无可出货数量，不生成空出货单。')
  const sequence = state.outboundOrders.filter(row => row.postTaskId === task.postTaskId).length + 1
  const createdAt = nowIso(input.nowMs), outboundOrderId = `PF-OUT-${task.postTaskId}-${sequence}`
  const number = issuePostFinishingDocumentNumber({ kind: 'OUTBOUND', sourceDocumentNo: `${task.postTaskNo}-${String(sequence).padStart(3,'0')}`,
    productionOrderNo: task.productionOrderNo, sourceObjectId: task.postTaskId, idempotencyKey: `DIRECT-OUT:${input.operationId}`, sequence },new Date(createdAt))
  const outbound: PostFinishingOutboundOrder = { targetWarehouseId:readQcShippingDestination(qc.qcTaskId)?.warehouseId || readQcShippingDestination(task.productionOrderNo)?.warehouseId, outboundOrderId, outboundOrderNo: number.documentNo, executionModel: 'DIRECT_V2', operationId: input.operationId, operationIntent: intent, sequence,
    deliveryId: task.deliveryId, deliveryOrderNo: task.deliveryOrderNo, productionOrderNo: task.productionOrderNo,
    qcTaskId: qc.qcTaskId, qcTaskNo: qc.qcTaskNo, postTaskId: task.postTaskId, postTaskNo: task.postTaskNo,
    responsibility: clone(task.responsibility), sourceType: '后道加工后', returnIndex: task.returnIndex, status: '待出货', lines, createdAt }
  state.outboundOrders.push(outbound)
  ensureDirectOutboundWarehouseRecord(outbound,input.actor)
  persist()
  appendBusinessLog({ stage:'出货',delivery:findDelivery(task.deliveryId),objectType:'后道出货单',objectId:outboundOrderId,objectNo:outbound.outboundOrderNo,
    action:'创建后道出货准备单',actor:input.actor,operatedAt:createdAt,afterQuantity:total(lines.map(row=>row.outboundQty)),remark:'尚未实际交出，不经过复检' })
  return clone(outbound)
}
export function dispatchPostFinishingOutboundOrder(input: { outboundOrderId: string; actor: PostFinishingActor; nowMs?: number }): PostFinishingOutboundOrder {
  assertPostFinishingWrite()
  const outbound = findOutbound(input.outboundOrderId)
  if (outbound.dispatchedAt || outbound.status === '已接收入库') return clone(outbound)
  if (outbound.status !== '待出货' || findQcTask(outbound.qcTaskId).status !== '质检完成') throw new Error('当前单据尚不满足实际出货条件。')
  if (!['后道操作员','后道主管'].includes(input.actor.roleName)) throw new Error('请由后道实际交出人员确认出货。')
  outbound.dispatchedAt = nowIso(input.nowMs); outbound.dispatchedBy = clone(input.actor); outbound.status = '待仓库接收'
  const stock = ensureDirectOutboundWarehouseRecord(outbound,input.actor)
  stock.status = '已交出'; stock.handedOverAt = outbound.dispatchedAt; stock.handedOverBy = clone(input.actor)
  stock.lines.forEach(line => { line.handedOverQty = line.inboundQty; line.availableQty = 0 })
  appendWaitHandoverWarehouseMovement({ record:stock, movementType:'后道出货交出',operator:input.actor,operatedAt:outbound.dispatchedAt })
  persist()
  appendBusinessLog({ stage:'出货',delivery:findDelivery(outbound.deliveryId),objectType:'后道出货单',objectId:outbound.outboundOrderId,objectNo:outbound.outboundOrderNo,
    action:'确认实际交出',actor:input.actor,operatedAt:outbound.dispatchedAt,afterQuantity:total(outbound.lines.map(row=>row.outboundQty)) })
  return clone(outbound)
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
      quantity: ['复检完成入仓','出货准备入区'].includes(input.movementType) ? line.inboundQty : line.handedOverQty,
    })),
    operator: clone(input.operator),
    operatedAt: input.operatedAt,
  }
  state.waitHandoverWarehouseMovements.push(movement)
  return movement
}

export function receivePostFinishingOutboundOrder(input: {
  outboundOrderNo: string
  targetWarehouseId?: string
  actor: PostFinishingActor
  receivedQuantities: Array<{ skuId: string; receivedQty: number }>
  authorization?: PostFinishingAuthorizationInput
  nowMs?: number
}): { outbound: PostFinishingOutboundOrder; receipt: PostFinishingWarehouseReceipt; alreadyReceived: boolean } {
  assertPostFinishingWrite()
  // POST-014 / POST-021: this is the external garment warehouse responsibility boundary.
  if (!input.actor?.actorId?.trim() || !input.actor?.actorName?.trim()
    || !['仓库收货人员', '成衣仓收货员'].includes(input.actor?.roleName?.trim())) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '只有身份完整的仓库收货人员可以确认成衣仓收货。')
  }
  const exact = state.outboundOrders.find((item) => item.outboundOrderNo === input.outboundOrderNo.trim())
  if (!exact) throw new PostFinishingFlowGateError('NOT_FOUND', '只接受完整后道出货单号，不接受复检单或内部交接号。')
  if (input.targetWarehouseId && !isQcShippingWarehouseId(input.targetWarehouseId)) throw new PostFinishingFlowGateError('INVALID_STATUS', '实际目标成衣仓无效，请核对后再确认。')
  const delivery = findDelivery(exact.deliveryId)
  const existingReceipt = state.warehouseReceipts.find((item) => item.outboundOrderId === exact.outboundOrderId)
  if (existingReceipt) return { outbound: clone(exact), receipt: clone(existingReceipt), alreadyReceived: true }
  if (exact.status !== '待仓库接收') throw new PostFinishingFlowGateError('INVALID_STATUS', '待出货尚未实际发出，当前不能确认仓库实收。')
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
  exact.targetWarehouseId = input.targetWarehouseId || exact.targetWarehouseId || readQcShippingDestination(exact.qcTaskId)?.warehouseId || readQcShippingDestination(exact.productionOrderNo)?.warehouseId
  exact.receivedAt = now
  exact.receivedBy = clone(input.actor)
  exact.warehouseAuthorizationId = consumed?.authorizationId
  exact.warehouseAuthorizedBy = consumed
    ? { authorizerId: consumed.authorizerId, authorizerName: consumed.authorizerName }
    : undefined
  exact.warehouseDifferenceReason = input.authorization?.differenceReason
  const receipt: PostFinishingWarehouseReceipt = {
    warehouseId: exact.targetWarehouseId,
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
  delivery.status = isPostFinishingDeliveryComplete(delivery.deliveryId) ? '已完成' : '已送检'
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

/** Freeze or correct one unreceived child destination without moving its goods. */
export function setPostFinishingOutboundDestination(input: { outboundOrderId: string; warehouseId: string; expectedWarehouseId?: string; operator: string; reason: string }): void {
  assertPostFinishingWrite()
  const outbound = findOutbound(input.outboundOrderId)
  if (!['待出货','待仓库接收'].includes(outbound.status)) throw new Error('已实收出货单的目标仓不能修改。')
  if (!isQcShippingWarehouseId(input.warehouseId) || !input.operator.trim() || !input.reason.trim()) throw new Error('选择有效目标成衣仓，填写实际维护人及原因。')
  if (outbound.targetWarehouseId !== input.expectedWarehouseId) throw new Error('出货去向已变化，请重新打开核对。')
  const previous = outbound.targetWarehouseId || '待核对'
  outbound.targetWarehouseId = input.warehouseId
  appendBusinessLog({ stage: '仓库收货', delivery: findDelivery(outbound.deliveryId), objectType: '后道出货单', objectId: outbound.outboundOrderId, objectNo: outbound.outboundOrderNo,
    action: '维护出货去向', actor: { actorId: `QC-SHIPPING:${input.operator.trim()}`, actorName: input.operator.trim(), roleName: '供货去向维护人' }, operatedAt: nowIso(),
    beforeStatus: outbound.status, afterStatus: outbound.status, remark: `${previous} → ${input.warehouseId}；${input.reason.trim()}` })
  persist()
}

export function listPostFinishingFactoryReturns(productionOrderIds?: ReadonlySet<string>): PostFinishingFactoryReturnDelivery[] {
  return clone(productionOrderIds ? state.deliveries.filter(row => productionOrderIds.has(row.productionOrderId)) : state.deliveries)
}

export function listPostFinishingWarehouseLocationMoves(): PostFinishingWarehouseLocationMove[] {
  return clone(state.warehouseLocationMoves || [])
}

export function movePostFinishingWarehouseLocation(input: {
  mode: 'wait-process' | 'wait-handover'
  locationCode: string
  targetLocationCode: string
  reason: string
  actor: PostFinishingActor
  nowMs?: number
}): PostFinishingWarehouseLocationMove[] {
  assertPostFinishingWrite()
  if (!input.actor?.actorId?.trim() || !input.actor.actorName?.trim() || !/(仓管|仓库|后道主管)/.test(input.actor.roleName)) {
    throw new PostFinishingFlowGateError('NOT_CLAIM_OWNER', '请使用身份完整的仓库人员执行移库。')
  }
  const from = input.locationCode.trim(), to = input.targetLocationCode.trim(), reason = input.reason.trim()
  if (!from) throw new PostFinishingFlowGateError('INVALID_STATUS', '请选择要移动的库位。')
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(to)) throw new PostFinishingFlowGateError('INVALID_STATUS', '目标库位须为 2～32 位字母、数字、横线或下划线。')
  if (from === to) throw new PostFinishingFlowGateError('INVALID_STATUS', '目标库位与原库位相同，不需要移库。')
  if (!reason) throw new PostFinishingFlowGateError('INVALID_STATUS', '请填写移库原因。')
  const records = input.mode === 'wait-process'
    ? state.waitProcessWarehouseRecords.filter((row) => row.locationCode === from && row.status !== '已废弃')
    : state.waitHandoverWarehouseRecords.filter((row) => row.locationCode === from && row.status === '待交出')
  const movable = records.filter((row) => row.lines.some((line) => line.availableQty > 0))
  if (!movable.length) throw new PostFinishingFlowGateError('INVALID_STATUS', '该库位没有可移动的在库数量。')
  const at = nowIso(input.nowMs)
  state.warehouseLocationMoves ||= []
  const created = movable.map((row) => {
    const move: PostFinishingWarehouseLocationMove = {
      moveId: `PF-WLM-${String(state.warehouseLocationMoves!.length + 1).padStart(6, '0')}`,
      warehouseMode: input.mode,
      warehouseRecordId: row.warehouseRecordId,
      deliveryOrderNo: row.deliveryOrderNo,
      productionOrderNo: row.productionOrderNo,
      fromLocationCode: from,
      toLocationCode: to,
      reason,
      quantities: row.lines.filter((line) => line.availableQty > 0).map((line) => ({ sku: clone(line.sku), quantity: line.availableQty })),
      operator: clone(input.actor),
      operatedAt: at,
    }
    state.warehouseLocationMoves!.push(move)
    row.locationCode = to
    return clone(move)
  })
  persist()
  return created
}

export function listPostFinishingWaitProcessWarehouseRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  return clone(state.waitProcessWarehouseRecords)
}

export function listPostFinishingWaitProcessWarehouseMovements(): PostFinishingWaitProcessWarehouseMovement[] {
  return clone(state.waitProcessWarehouseMovements).sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
}

export function listPostFinishingWaitHandoverWarehouseRecords(productionOrderNos?: ReadonlySet<string>, postTaskIds?: ReadonlySet<string>): PostFinishingWaitHandoverWarehouseRecord[] {
  return clone(productionOrderNos || postTaskIds ? state.waitHandoverWarehouseRecords.filter(row => (!productionOrderNos || productionOrderNos.has(row.productionOrderNo)) && (!postTaskIds || Boolean(row.postTaskId && postTaskIds.has(row.postTaskId)))) : state.waitHandoverWarehouseRecords)
}

/** The handover directory needs totals and source names, not copied SKU trees. */
export function listPostFinishingHandoutWarehouseSummaries() {
  return state.waitHandoverWarehouseRecords.map(record => ({
    outboundOrderId: record.outboundOrderId, outboundOrderNo: record.outboundOrderNo,
    postTaskId: record.postTaskId, postTaskNo: record.postTaskNo,
    qcTaskId: record.qcTaskId, qcTaskNo: record.qcTaskNo,
    deliveryOrderNo: record.deliveryOrderNo, productionOrderNo: record.productionOrderNo,
    status: record.status, qtyUnit: record.lines[0]?.sku.qtyUnit || '件', skuCount: record.lines.length,
    inboundQty: total(record.lines.map(line => line.inboundQty)),
    handedOverQty: total(record.lines.map(line => line.handedOverQty)),
  }))
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

/** Read-only shipping facts from the same canonical QC state. Inspection trees,
 * photos and paper histories do not participate in quantity/urgency projection. */
export function listPostFinishingQcShippingFacts():PostFinishingQcTask[] {
  return state.qcTasks.map(row=>({
    qcTaskId:row.qcTaskId,qcTaskNo:row.qcTaskNo,productionOrderId:row.productionOrderId,productionOrderNo:row.productionOrderNo,
    deliveryId:row.deliveryId,deliveryOrderNo:row.deliveryOrderNo,returnIndex:row.returnIndex,status:row.status,sourceKind:row.sourceKind,
    responsibility:row.responsibility?{...row.responsibility,defaultProcessItems:[...row.responsibility.defaultProcessItems]}:row.responsibility,
    createdBy:row.createdBy?{...row.createdBy}:row.createdBy,createdAt:row.createdAt,qcAuthorizationId:row.qcAuthorizationId,referenceIds:[],
    lines:(row.lines||[]).map(line=>({sku:{...line.sku},expectedQty:line.expectedQty})),
    results:row.results?.map(line=>({sku:{...line.sku},expectedQty:line.expectedQty,passedQty:line.passedQty,defectQty:line.defectQty,returnQty:line.returnQty,
      releasedQty:line.releasedQty,inspectedQty:line.passedQty+line.defectQty+line.returnQty,uninspectedQty:line.uninspectedQty})),
  }))
}

export function listPostFinishingFullFlowQcTasks(productionOrderNos?: ReadonlySet<string>): PostFinishingQcTask[] {
  return (productionOrderNos ? state.qcTasks.filter(row => productionOrderNos.has(row.productionOrderNo)) : state.qcTasks).map(effectiveQcView)
}

export function listPostFinishingFullFlowPostTasks(productionOrderNos?: ReadonlySet<string>): PostFinishingPostTask[] {
  return clone(productionOrderNos ? state.postTasks.filter(row => productionOrderNos.has(row.productionOrderNo)) : state.postTasks)
}

export function listPostFinishingFullFlowRecheckOrders(productionOrderNos?: ReadonlySet<string>, postTaskIds?: ReadonlySet<string>): PostFinishingRecheckOrder[] {
  return clone(productionOrderNos || postTaskIds ? state.recheckOrders.filter(row => (!productionOrderNos || productionOrderNos.has(row.productionOrderNo)) && (!postTaskIds || Boolean(row.postTaskId && postTaskIds.has(row.postTaskId)))) : state.recheckOrders)
}

export function listPostFinishingFullFlowOutboundOrders(productionOrderNos?: ReadonlySet<string>, postTaskIds?: ReadonlySet<string>): PostFinishingOutboundOrder[] {
  return clone(productionOrderNos || postTaskIds ? state.outboundOrders.filter(row => (!productionOrderNos || productionOrderNos.has(row.productionOrderNo)) && (!postTaskIds || Boolean(row.postTaskId && postTaskIds.has(row.postTaskId)))) : state.outboundOrders)
}

/** One synchronous handover-directory read; only detached receipt primitives. */
export function listPostFinishingOutboundReceiptSummaries() {
  return state.outboundOrders.map(order => ({
    outboundOrderId: order.outboundOrderId,
    outboundOrderNo: order.outboundOrderNo,
    status: order.status,
    receivedAt: order.receivedAt,
    receivedQty: total(order.lines.map(line => line.receivedQty || 0)),
  }))
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
  return record ? effectiveQcView(record) : undefined
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
    || item.outboundOrderId === recordIdOrNumber
    || item.deliveryOrderNo === recordIdOrNumber
    || item.recheckOrderNo === recordIdOrNumber
    || item.outboundOrderNo === recordIdOrNumber
  ))
  return record ? clone(record) : undefined
}

export function getPostFinishingQcTaskReferences(qcTaskId: string): PostFinishingQcReferenceRecord[] {
  return listPostFinishingQcReferences({ qcTaskId })
}

export function isPostFinishingDeliveryComplete(deliveryId: string): boolean {
  const delivery = state.deliveries.find(row => row.deliveryId === deliveryId)
  if (!delivery) return false
  const qc = state.qcTasks.find(row => row.deliveryId === deliveryId)
  if (qc?.status !== '质检完成') return false
  const posts = state.postTasks.filter(row => row.deliveryId === deliveryId)
  const rechecks = state.recheckOrders.filter(row => row.deliveryId === deliveryId)
  const outbounds = state.outboundOrders.filter(row => row.deliveryId === deliveryId)
  if (posts.some(task => { const p = getPostFinishingProcessProgress(task); return p.lines.some(line => line.completedQty !== line.expectedQty || line.reservedQty !== line.expectedQty) })) return false
  if (rechecks.some(row => row.status !== '复检完成' || row.lines.some(line => line.handoverQty !== line.expectedQty))) return false
  return outbounds.length > 0 && outbounds.every(row => row.status === '已接收入库' && row.lines.every(line => line.receivedQty === line.outboundQty))
}

export function tracePostFinishingFullFlow(anyNumber: string) {
  const normalized = anyNumber.trim()
  const requestedOutbound = state.outboundOrders.find(row => row.outboundOrderNo === normalized || row.outboundOrderId === normalized)
  const requestedRecheck = state.recheckOrders.find(row => row.recheckOrderNo === normalized || row.recheckOrderId === normalized || row.recheckOrderId === requestedOutbound?.recheckOrderId)
  const requestedPost = state.postTasks.find(row => row.postTaskNo === normalized || row.postTaskId === normalized)
  const requestedQc = state.qcTasks.find(row => row.qcTaskNo === normalized || row.qcTaskId === normalized)
  const delivery = state.deliveries.find(row => row.deliveryOrderNo === normalized || row.deliveryId === normalized || row.deliveryId === (requestedOutbound?.deliveryId || requestedRecheck?.deliveryId || requestedPost?.deliveryId || requestedQc?.deliveryId))
  if (!delivery) return {} as { delivery?: PostFinishingFactoryReturnDelivery; qcTask?: PostFinishingQcTask; postTask?: PostFinishingPostTask; recheckOrder?: PostFinishingRecheckOrder; outboundOrder?: PostFinishingOutboundOrder; waitHandoverRecord?: PostFinishingWaitHandoverWarehouseRecord; waitHandoverRecords?: PostFinishingWaitHandoverWarehouseRecord[]; receipt?: PostFinishingWarehouseReceipt; recheckOrders?: PostFinishingRecheckOrder[]; outboundOrders?: PostFinishingOutboundOrder[]; receipts?: PostFinishingWarehouseReceipt[] }
  const relation = relationForDelivery(delivery)
  const recheckOrders = state.recheckOrders.filter(row => row.deliveryId === delivery.deliveryId)
  const outboundOrders = state.outboundOrders.filter(row => row.deliveryId === delivery.deliveryId)
  const recheckOrder = requestedRecheck || recheckOrders[0]
  const outboundOrder = requestedOutbound || outboundOrders.find(row => row.recheckOrderId === recheckOrder?.recheckOrderId) || outboundOrders[0]
  const receipts = state.warehouseReceipts.filter(row => outboundOrders.some(out => out.outboundOrderId === row.outboundOrderId))
  return clone({ delivery, qcTask: relation.qcTask, postTask: relation.postTask, recheckOrder, outboundOrder,
    waitHandoverRecord: state.waitHandoverWarehouseRecords.find(row => row.outboundOrderId === outboundOrder?.outboundOrderId),
    waitHandoverRecords: state.waitHandoverWarehouseRecords.filter(row => row.deliveryId === delivery?.deliveryId),
    receipt: receipts.find(row => row.outboundOrderId === outboundOrder?.outboundOrderId), recheckOrders, outboundOrders, receipts })
}

export function getPostFinishingReturnToleranceRate(): number {
  return RETURN_TOLERANCE_RATE
}

export function resetPostFinishingFullFlow(): void {
  assertPostFinishingWrite()
  state = emptyState()
  resetPostFinishingDocumentNumbering()
  resetPostFinishingAuthorizationConsumptions()
  resetPostFinishingOperationLogs()
  resetPostFinishingQcReferences()
  withPostFinishingDemo(() => ensurePostFinishingMaterialTransferDemo())
}

// Retained only as an in-memory demo choice for existing domain callers.
export function setPostFinishingDemoBootstrapEnabled(_enabled: boolean): void {}

export function loadPostFinishingDemoData(_options: { persist?: boolean } = {}): void {
  withPostFinishingDemo(() => {
    if (buildingDemoData) throw new Error('后道演示数据正在初始化。')
    const beforeState = structuredClone(state)
    const batches = [beginPostFinishingOperationLogDemoBatch(), beginPostFinishingNumberingDemoBatch(), beginPostFinishingAuthorizationDemoBatch(), beginPostFinishingQcReferenceDemoBatch()]
    buildingDemoData = true
    try { resetPostFinishingFullFlow(); populatePostFinishingDemoData() }
    catch (error) { state = beforeState; batches.forEach(batch => batch.rollback()); throw error }
    finally { buildingDemoData = false; batches.forEach(batch => batch.finish()) }
  })
}

function populatePostFinishingDemoData(): void {
  const baseTime = Date.UTC(2026, 9, 22, 1, 0, 0)
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
        actor: orderIndex === 0 && returnIndex <= 4 ? POST_FINISHING_ACCEPTANCE_ACTORS.qcA : POST_FINISHING_ACCEPTANCE_ACTORS.qcB,
        nowMs: chainTime + 30 * 60 * 1000,
      })
      if (returnIndex === 4 && orderIndex === 0) continue

      const isReworkDemo = orderIndex === 0 && returnIndex === 5
      const actor = claimedQc.claimedBy!
      const inspection = claimedQc.inspection!
      const summary = getPostFinishingQcInspectionSummary(claimedQc)!
      let remaining = summary.target
      const lines = claimedQc.lines.map((line, index) => {
        const quantity = Math.min(remaining, line.expectedQty); remaining -= quantity
        const defectQty = isReworkDemo ? Math.min(index === 0 ? 6 : index === 1 ? 4 : 0, quantity) : 0
        const returnQty = isReworkDemo ? Math.min(index === 0 ? 4 : index === 1 ? 2 : 0, quantity - defectQty) : 0
        return {skuId:line.sku.skuId,passedQty:quantity-defectQty-returnQty,defectQty,returnQty,
          issues:defectQty+returnQty ? [{itemId:inspection.snapshot.items[0].id,note:'演示：按当前标准登记缝制问题'}] : []}
      })
      submitPostFinishingQcRound({qcTaskId:claimedQc.qcTaskId,actor,operationId:`DEMO-ROUND:${claimedQc.qcTaskId}:1`,lines,nowMs:chainTime+35*60*1000})
      const checked = getPostFinishingQcInspectionSummary(claimedQc.qcTaskId)!
      if(checked.pendingAudit) {
        upgradePostFinishingQcInspection({qcTaskId:claimedQc.qcTaskId,actor,nextPercent:100,note:'演示：稽查决定本批全检',nowMs:chainTime+36*60*1000})
        submitPostFinishingQcRound({qcTaskId:claimedQc.qcTaskId,actor,operationId:`DEMO-ROUND:${claimedQc.qcTaskId}:2`,
          lines:checked.lines.map(line=>({skuId:line.skuId,passedQty:line.uninspectedQty,defectQty:0,returnQty:0})),nowMs:chainTime+37*60*1000})
      }
      attachPostFinishingQcSignedPaper({qcTaskId:claimedQc.qcTaskId,actor,url:'/images/post-finishing/demo-signed-qc.svg',name:'演示双签单（非真实业务凭证）',nowMs:chainTime+39*60*1000})
      const completedQc = completePostFinishingQcTask({
        qcTaskId: claimedQc.qcTaskId, actor,
        processItems: order.sewingTaskType === 'INDEPENDENT_SEWING'
          ? [...POST_FINISHING_PROCESS_ITEMS]
          : orderIndex === 2 ? ['熨烫', '包装'] : [],
        nowMs: chainTime + 40 * 60 * 1000,
      })

      if (orderIndex === 0) continue
      if (!completedQc.postTaskNo) {
        const directOutbound = findOutbound(completedQc.outboundOrderId || completedQc.outboundOrderNo || '')
        if (orderIndex === 1 && returnIndex === 5) {
          dispatchPostFinishingOutboundOrder({ outboundOrderId: directOutbound.outboundOrderId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, nowMs: chainTime + 70 * 60 * 1000 })
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
      for (const processItem of startedPost.processItems) appendPostFinishingProcessCompletion({
        postTaskId: startedPost.postTaskId, processItem,
        quantities: startedPost.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.expectedQty })),
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, responsible: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator,
        operationId: `DEMO:${startedPost.postTaskId}:${processItem}`, nowMs: chainTime + 60 * 60 * 1000,
      })
      const outbound = submitPostFinishingForOutbound({
        postTaskId: startedPost.postTaskId, quantities: startedPost.lines.map(line => ({ skuId: line.sku.skuId, quantity: line.expectedQty })),
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, operationId: `DEMO:OUTBOUND:${startedPost.postTaskId}`, nowMs: chainTime + 61 * 60 * 1000,
      })
      if (orderIndex === 2 && returnIndex === 4) continue
      dispatchPostFinishingOutboundOrder({ outboundOrderId: outbound.outboundOrderId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.postOperator, nowMs: chainTime + 65 * 60 * 1000 })
      if (orderIndex === 2 && returnIndex === 5) continue
      receivePostFinishingOutboundOrder({ outboundOrderNo: outbound.outboundOrderNo, actor: POST_FINISHING_ACCEPTANCE_ACTORS.warehouseReceiver,
        receivedQuantities: outbound.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })), nowMs: chainTime + 75 * 60 * 1000,
      })
    }
  })
}

loadPostFinishingDemoData({ persist: false })
registerPostFinishingRepository('flow', () => state, value => { state = value })
registerPostFinishingReadOnlyMaterialCheck(row => {
  const stock = row.id.includes('/flow/materialStocks/')
  if (!stock && !row.id.includes('/flow/materialTransferOrders/')) return false
  const original = row.value || (stock ? state.materialStocks.find(item => row.id.endsWith(`/${encodeURIComponent(item.stockId)}`)) : state.materialTransferOrders.find(item => row.id.endsWith(`/${encodeURIComponent(item.transferOrderId)}`)))
  if (!original || typeof original !== 'object') return false
  const material = original as PostFinishingMaterialTransferOrder | PostFinishingMaterialStock
  return Boolean(accessoryPostBridge?.ownsProduction(material.productionOrderNo)
    || ('productionOrderId' in material && accessoryPostBridge?.ownsProduction(material.productionOrderId))
    || (stock && state.materialTransferOrders.some(transfer => transfer.transferOrderId === (material as PostFinishingMaterialStock).transferOrderId
      && (accessoryPostBridge?.ownsProduction(transfer.productionOrderId) || accessoryPostBridge?.ownsProduction(transfer.productionOrderNo)))))
})
// Validate a staged restore against the same quantity facts before committing it.
registerPostFinishingRecordValidator(() => {
  const deliveries = new Map(state.deliveries.map(row => [row.deliveryId, row]))
  const qcTasks = new Map(state.qcTasks.map(row => [row.qcTaskId, row]))
  const postTasks = new Map(state.postTasks.map(row => [row.postTaskId, row]))
  if (state.recheckOrders.length) throw new Error('当前后道不支持复检记录，请使用直接出货流程。')
  const outbounds = new Map(state.outboundOrders.map(row => [row.outboundOrderId, row]))
  const sourceFields = ['deliveryId', 'deliveryOrderNo', 'productionOrderNo', 'qcTaskId', 'qcTaskNo', 'postTaskId', 'postTaskNo', 'returnIndex', 'sourceType'] as const
  type DownstreamSource = Pick<PostFinishingRecheckOrder, typeof sourceFields[number]>
  const sameSource = (left: DownstreamSource, right: DownstreamSource) => sourceFields.every(key => left[key] === right[key])
  const skuFields = ['skuId', 'skuCode', 'spuCode', 'spuName', 'colorName', 'sizeName', 'imageUrl', 'barcode', 'qtyUnit'] as const
  function matchesSkuIdentity(lines: Array<{ sku: PostFinishingAcceptanceSku }>, sources: Array<{ sku: PostFinishingAcceptanceSku }>): boolean {
    const identities = new Map(sources.map(line => [line.sku.skuId, line.sku]))
    return lines.every(line => {
      const source = identities.get(line.sku.skuId)
      return source && skuFields.every(key => line.sku[key] === source[key])
    })
  }
  function matchesQuantities<T extends { sku: PostFinishingAcceptanceSku }>(lines: T[], expected: Map<string, number>, quantity: (line: T) => number | undefined): boolean {
    return Array.isArray(lines) && lines.length === expected.size && new Set(lines.map(line => line.sku?.skuId)).size === lines.length
      && lines.every(line => {
        const value = quantity(line)
        return Number.isSafeInteger(value) && value! >= 0 && expected.has(line.sku?.skuId) && value === expected.get(line.sku.skuId)
      })
  }
  if (deliveries.size !== state.deliveries.length || qcTasks.size !== state.qcTasks.length || postTasks.size !== state.postTasks.length
    || outbounds.size !== state.outboundOrders.length
    || new Set(state.outboundOrders.map(row => row.outboundOrderNo)).size !== outbounds.size) throw new Error('回货、质检、加工、复检或出货身份重复，资料未恢复。')
  const ids = new Set<string>(), operations = new Set<string>()
  for (const record of state.processCompletions || []) {
    if (ids.has(record.recordId) || operations.has(record.operationId) || !record.intent || !record.recordedAt || !Number.isFinite(Date.parse(record.recordedAt))) throw new Error('加工记录编号、提交标识或时间无效，资料未恢复。')
    ids.add(record.recordId); operations.add(record.operationId)
    const task = state.postTasks.find(row => row.postTaskId === record.postTaskId)
    if (!task) throw new Error('加工记录缺少来源加工单，资料未恢复。')
    // Static demo rows never substitute for an overridden historical parent.
    if (task.executionModel !== 'ITEMS_V1') throw new Error('加工单须使用当前分项登记格式。')
    if (!task.processItems.includes(record.processItem) || new Set(record.quantities.map(row => row.skuId)).size !== record.quantities.length || !record.quantities.length) throw new Error('加工记录项目或SKU重复，资料未恢复。')
    if (record.quantities.some(row => !task.lines.some(line => line.sku.skuId === row.skuId) || !Number.isSafeInteger(row.quantity) || (!record.correctionOf && row.quantity <= 0))) throw new Error('加工记录数量或来源SKU无效，资料未恢复。')
    if (record.correctionOf) {
      const original = state.processCompletions.find(row => row.recordId === record.correctionOf)
      if (!original || original.correctionOf || original.postTaskId !== record.postTaskId || original.processItem !== record.processItem || !record.reason?.trim() || record.recordedBy.roleName !== '后道主管') throw new Error('加工订正缺少有效原记录或主管依据，资料未恢复。')
      if (record.quantities.length !== original.quantities.length || record.quantities.some(line => !original.quantities.some(source => source.skuId === line.skuId))
        || ['actorId', 'actorName', 'roleName'].some(key => record.responsible[key as keyof PostFinishingActor] !== original.responsible[key as keyof PostFinishingActor])) throw new Error('加工订正改变了原SKU或原责任人，资料未恢复。')
    }
  }
  const recheckOperations = new Set<string>()
  for (const task of state.postTasks) {
    if (!Array.isArray(task.lines) || !task.lines.length || new Set(task.lines.map(row => row.sku.skuId)).size !== task.lines.length || task.lines.some(row => !Number.isSafeInteger(row.expectedQty) || row.expectedQty < 0)) throw new Error('加工单SKU或数量无效，资料未恢复。')
    const qc = qcTasks.get(task.qcTaskId)
    const delivery = deliveries.get(task.deliveryId)
    if (!qc || !delivery || task.deliveryId !== qc.deliveryId || task.qcTaskNo !== qc.qcTaskNo || task.deliveryOrderNo !== delivery.deliveryOrderNo
      || qc.deliveryOrderNo !== delivery.deliveryOrderNo || qc.productionOrderNo !== delivery.productionOrderNo || qc.returnIndex !== delivery.returnIndex
      || task.productionOrderNo !== delivery.productionOrderNo || task.returnIndex !== delivery.returnIndex) throw new Error('加工单与原回货或质检身份不一致，资料未恢复。')
    // A historical missing QC result remains unknown; a new item order always
    // has its frozen QC supply. Never expand that supply by editing a backup.
    if ((qc.results && (!matchesQuantities(task.lines, new Map(qc.results.map(line => [line.sku.skuId, line.releasedQty ?? line.passedQty])), line => line.expectedQty)
      || (task.executionModel === 'ITEMS_V1' && !matchesSkuIdentity(task.lines, qc.results))))
      || (!qc.results && task.executionModel === 'ITEMS_V1')) throw new Error('加工数量与来源质检合格量不一致，资料未恢复。')
    // Internal validation consumes quantities synchronously and never publishes detail references.
    const progress = calculatePostFinishingProcessProgress(task, true, false)
    if (!task.processItems.length || task.processItems.some(item => !POST_FINISHING_PROCESS_ITEMS.includes(item)) || progress.processes.some(row => row.applicable && row.lines.some(line => line.completedQty < 0 || line.completedQty > line.expectedQty || line.availableQty < 0)) || progress.lines.some(line => line.availableForOutboundQty < 0)) throw new Error('恢复后的加工链或出货占用不守恒，资料未恢复。')
  }
  for (const outbound of state.outboundOrders) if (!Array.isArray(outbound.lines) || !outbound.lines.length
    || outbound.lines.some(line => !line.sku?.skuId || !Number.isSafeInteger(line.outboundQty) || line.outboundQty < 0
      || (line.receivedQty !== undefined && (!Number.isSafeInteger(line.receivedQty) || line.receivedQty < 0)))) throw new Error('出货SKU或数量格式无效，资料未恢复。')
  for (const qc of state.qcTasks) {
    if (!qc.inspection) { if(!['待送检','待质检'].includes(qc.status)) throw new Error('在检或已完成QC缺少开检标准。'); continue }
    const inspection=qc.inspection
    if (!inspection.snapshot?.basicStandard || !inspection.snapshot.ruleSnapshot || inspection.snapshot.context.sourceKind !== (qc.sourceKind || 'PRODUCTION_RETURN')
      || !Number.isSafeInteger(inspection.paperVersion) || inspection.paperVersion<1 || ![...inspection.snapshot.ruleSnapshot.percentSteps,100].includes(inspection.percent)
      || new Set(inspection.rounds.map(row=>row.operationId)).size!==inspection.rounds.length) throw new Error('质检固定标准、规则或轮次身份无效，原资料未恢复。')
    for (const [index,round] of inspection.rounds.entries()) {
      if (round.roundNumber!==index+1 || round.id!==round.operationId || !round.actorId || !Number.isFinite(Date.parse(round.submittedAt))
        || new Set(round.lines.map(row=>row.skuId)).size!==round.lines.length) throw new Error('质检轮次顺序或责任事实无效。')
      for (const line of round.lines) {
        if (!qc.lines.some(row=>row.sku.skuId===line.skuId) || [line.passedQty,line.defectQty,line.returnQty].some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('质检结果含非本批SKU或非法件数。')
        validateInspectionIssues(inspection.snapshot.skuSnapshots?.find(row=>row.skuId===line.skuId)?.snapshot || inspection.snapshot,line.issues || [])
        if (line.defectQty+line.returnQty>0 && !line.issues?.length) throw new Error('不合格质检结果缺少具体问题。')
      }
    }
    const summary=getPostQcSummary(inspection,qcSupply(qc))
    if (inspection.audits.some(row=>row.status==='UPGRADED' && (!row.toPercent || row.toPercent<=row.fromPercent)) || inspection.audits.filter(row=>row.status==='PENDING').length>1) throw new Error('稽查升级记录不合法。')
    if (qc.status==='质检完成') {
      assertPostQcCompletable(inspection,qcSupply(qc),qc.sourceKind !== 'WAREHOUSE_STOCK')
      if (!qc.results || qc.results.length!==qc.lines.length || new Set(qc.results.map(row=>row.sku.skuId)).size!==qc.lines.length || qc.results.some(line=>{
        const actual=summary.lines.find(row=>row.skuId===line.sku.skuId)
        return !actual || line.passedQty!==actual.passedQty || line.defectQty!==actual.defectQty || line.returnQty!==actual.returnQty || line.uninspectedQty!==actual.uninspectedQty || line.releasedQty!==actual.releasedQty
      })) throw new Error('已完成质检结果与各轮实检、未检及正常放行不一致。')
    } else if (qc.results) throw new Error('尚未完成QC不能存在最终放行结果。')
  }
  const outboundSources = new Set<string>()
  const receiptsByOutbound = new Map<string, PostFinishingWarehouseReceipt>()
  for (const receipt of state.warehouseReceipts) {
    const outbound = outbounds.get(receipt.outboundOrderId)
    if (!outbound || receiptsByOutbound.has(receipt.outboundOrderId) || outbound.status !== '已接收入库'
      || receipt.outboundOrderNo !== outbound.outboundOrderNo || receipt.productionOrderNo !== outbound.productionOrderNo
      || !matchesQuantities(receipt.lines, new Map(outbound.lines.map(line => [line.sku.skuId, line.outboundQty])), line => line.expectedQty)
      || !matchesQuantities(receipt.lines, new Map(outbound.lines.map(line => [line.sku.skuId, line.receivedQty ?? -1])), line => line.receivedQty)
      || !matchesSkuIdentity(receipt.lines, outbound.lines)) throw new Error('仓库实收与来源出货的身份或数量不一致，资料未恢复。')
    receiptsByOutbound.set(receipt.outboundOrderId, receipt)
  }
  const waitingByOutbound = new Map<string, PostFinishingWaitHandoverWarehouseRecord>()
  for (const record of state.waitHandoverWarehouseRecords) {
    const outbound = outbounds.get(record.outboundOrderId)
    const handedOver = Boolean(outbound?.dispatchedAt)
    const quantities = new Map(outbound?.lines.map(line => [line.sku.skuId, line.outboundQty]))
    if (!outbound || outbound.executionModel !== 'DIRECT_V2' || waitingByOutbound.has(record.outboundOrderId) || !sameSource(record, outbound)
      || record.recheckOrderId !== outbound.recheckOrderId || record.recheckOrderNo !== outbound.recheckOrderNo || record.outboundOrderNo !== outbound.outboundOrderNo
      || record.status !== (handedOver ? '已交出' : '待交出') || !matchesQuantities(record.lines, quantities, line => line.inboundQty)
      || !matchesQuantities(record.lines, new Map([...quantities].map(([id, quantity]) => [id, handedOver ? 0 : quantity])), line => line.availableQty)
      || !matchesQuantities(record.lines, new Map([...quantities].map(([id, quantity]) => [id, handedOver ? quantity : 0])), line => line.handedOverQty)
      || !matchesSkuIdentity(record.lines, outbound.lines)) throw new Error('待交出库存与来源出货的身份或数量不一致，资料未恢复。')
    waitingByOutbound.set(record.outboundOrderId, record)
  }
  for (const outbound of state.outboundOrders) {
    const qc = qcTasks.get(outbound.qcTaskId)
    const delivery = deliveries.get(outbound.deliveryId)
    if (!qc || !delivery || outbound.deliveryId !== qc.deliveryId || outbound.qcTaskNo !== qc.qcTaskNo || outbound.deliveryOrderNo !== delivery.deliveryOrderNo
      || outbound.productionOrderNo !== delivery.productionOrderNo || outbound.returnIndex !== delivery.returnIndex
      || !Array.isArray(outbound.lines) || !outbound.lines.length || total(outbound.lines.map(line => line.outboundQty)) <= 0) throw new Error('出货单与来源回货或质检身份不一致，资料未恢复。')
    const sourceKey = `direct:${outbound.outboundOrderId}`
    if (outboundSources.has(sourceKey)) throw new Error('出货单身份重复。')
    outboundSources.add(sourceKey)
    if (outbound.executionModel !== 'DIRECT_V2' || outbound.recheckOrderId) throw new Error('出货单须使用当前直接出货格式。')
    {
      if (qc.status !== '质检完成' || (outbound.postTaskId && !postTasks.has(outbound.postTaskId))) throw new Error('直接出货缺少已完成QC或来源加工单。')
      const parent=outbound.postTaskId ? postTasks.get(outbound.postTaskId)! : qc
      if (!matchesSkuIdentity(outbound.lines,parent.lines) || !waitingByOutbound.has(outbound.outboundOrderId)) throw new Error('直接出货SKU身份或待出货实物记录不完整。')
      if (!outbound.postTaskId && (!qc.results || !matchesQuantities(outbound.lines,new Map(qc.results.filter(row=>(row.releasedQty ?? row.passedQty)>0).map(row=>[row.sku.skuId,row.releasedQty ?? row.passedQty])),row=>row.outboundQty))) throw new Error('无加工出货必须使用QC实际正常放行量。')

      if (outbound.status === '待出货' && (outbound.dispatchedAt || outbound.lines.some(line => line.receivedQty !== undefined))) throw new Error('待出货不能伪造实际交出或接收。')
      if (outbound.status === '待仓库接收' && !outbound.dispatchedAt) throw new Error('待接收出货缺少真实交出事实。')
    }
    if (!['待出货', '待仓库接收', '已接收入库'].includes(outbound.status) || ((outbound.status === '已接收入库') !== receiptsByOutbound.has(outbound.outboundOrderId))
      || (outbound.status === '待仓库接收' && outbound.lines.some(line => line.receivedQty !== undefined))) throw new Error('出货状态与实际仓收记录不一致，资料未恢复。')
  }
})
