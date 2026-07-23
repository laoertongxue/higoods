import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  listProcessWorkOrders,
  type ProcessWorkOrder,
  type ProcessWorkOrderSourceSnapshot,
  type ProcessWorkOrderSourceType,
} from '../process-work-order-domain.ts'
import {
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
} from '../process-mobile-task-binding.ts'
import {
  getPlatformStatusForProcessWorkOrder,
  type PlatformProcessStatus,
  type PlatformProcessStatusCode,
  type PlatformRiskLevel,
} from '../process-platform-status-adapter.ts'
import { getPlatformProcessResultView } from '../platform-process-result-view.ts'
import { getQuantityLabel, type ProcessObjectType } from '../process-quantity-labels.ts'

type PrepProcessCode = 'PRINT' | 'DYE'
type PrepUnit = string
type CreateModeZh = (typeof PROCESS_WORK_ORDER_SOURCE_LABEL)['PRODUCTION_ORDER'] | '按备货创建' | '补料确认生成'
type OrderStatusZh = PlatformProcessStatus
type ReceiptStatusZh = '待接收' | '部分接收' | '已接收'
type BatchStatusZh = '待关联' | '部分关联' | '已关联'

export interface PrepOrderStockMaterialFact {
  materialCode: string
  materialName: string
  unit: PrepUnit
}

export interface PrepOrderMaterialReceiptFact {
  receiveStatus: ReceiptStatusZh
  receivedQty: number
  receivedAt: string
  receiptVoucher: string
  qualityConclusion: string
}

export interface PrepOrderReturnBatchFact {
  batchNo: string
  returnedQty: number
  qualifiedQty: number
  availableQty: number
  linkedQty: number
  status: BatchStatusZh
  returnedAt: string
}

export interface PrepOrderBatchDestinationFact {
  batchNo: string
  sourceLabel: string
  fulfilledQty: number
  linkedAt: string
}

export interface PrepProcessOrderFact {
  workOrderId?: string
  sourceArtifactIds?: string[]
  processType?: PrepProcessCode
  sourceType: ProcessWorkOrderSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  productionOrderOrderedAt?: string
  orderNo: string
  workOrderNo?: string
  statusLabel?: string
  factoryInternalStatusLabel?: string
  platformStatusCode?: PlatformProcessStatusCode
  platformStatusLabel?: PlatformProcessStatus
  platformStageLabel?: string
  platformRiskLevel?: PlatformRiskLevel
  platformRiskLabel?: string
  platformActionHint?: string
  platformOwnerHint?: string
  factoryDisplayName?: string
  assignmentMode?: string
  dispatchPriceDisplay?: string
  taskId?: string
  taskNo?: string
  mobileBindingTaskNo?: string
  mobileBindingStatusLabel?: string
  mobileBindingReasonLabel?: string
  canOpenMobileExecution?: boolean
  handoverOrderId?: string
  handoverOrderNo?: string
  reviewRecordId?: string
  latestWarehouseRecordId?: string
  latestHandoverRecordId?: string
  latestReviewRecordId?: string
  latestDifferenceRecordId?: string
  latestOperationRecordId?: string
  latestOperationChannel?: string
  latestOperationAt?: string
  latestOperationBy?: string
  hasWaitProcessRecord?: boolean
  hasWaitHandoverRecord?: boolean
  hasHandoverRecord?: boolean
  hasReviewRecord?: boolean
  hasDifferenceRecord?: boolean
  canPlatformFollowUp?: boolean
  followUpActionCode?: string
  followUpActionLabel?: string
  detailLink?: string
  craftDetailLink?: string
  mobileTaskLink?: string
  status: OrderStatusZh
  createMode: CreateModeZh
  sourceLabel: string
  factoryName: string
  plannedFeedQty: number
  requiresWaterSoluble?: boolean
  waterSolublePlannedQty?: number
  waterSolubleCompletedQty?: number
  waterSolubleQtyUnit?: string
  currentStepLabel?: string
  completedObjectQty?: number
  waitHandoverObjectQty?: number
  handedOverObjectQty?: number
  writtenBackObjectQty?: number
  diffObjectQty?: number
  unit: PrepUnit
  objectType?: ProcessObjectType
  quantityDisplayFields?: Array<{ label: string; value: number; unit: string; text: string }>
  plannedQtyLabel?: string
  returnedQtyLabel?: string
  receivedQtyLabel?: string
  diffQtyLabel?: string
  plannedFinishAt: string
  sourceSummary: string
  materialSku: string
  materialName: string
  note: string
  createdAt: string
  updatedAt: string
  stockMaterial?: PrepOrderStockMaterialFact
  materialReceipt: PrepOrderMaterialReceiptFact
  batches: PrepOrderReturnBatchFact[]
  destinations: PrepOrderBatchDestinationFact[]
}

function cloneOrders(input: PrepProcessOrderFact[]): PrepProcessOrderFact[] {
  return input.map((item) => ({
    ...item,
    sourceSnapshot: item.sourceSnapshot ? structuredClone(item.sourceSnapshot) : undefined,
    stockMaterial: item.stockMaterial ? { ...item.stockMaterial } : undefined,
    materialReceipt: { ...item.materialReceipt },
    batches: item.batches.map((batch) => ({ ...batch })),
    destinations: item.destinations.map((dest) => ({ ...dest })),
  }))
}

function toReceiptStatusFromOrder(order: ProcessWorkOrder): ReceiptStatusZh {
  if (order.handoverRecords.length === 0) return '待接收'
  if (order.status === 'COMPLETED') return '已接收'
  return '部分接收'
}

function mapUnifiedWorkOrderToPrepOrder(order: ProcessWorkOrder): PrepProcessOrderFact {
  const mobileBinding = order.processType === 'PRINT'
    ? validatePrintWorkOrderMobileTaskBinding(order.workOrderId)
    : validateDyeWorkOrderMobileTaskBinding(order.workOrderId)
  const platformStatus = getPlatformStatusForProcessWorkOrder(order)
  const platformResultView = getPlatformProcessResultView(order.processType, order.workOrderId)
  const unit = order.plannedUnit || '片'
  const quantityContext = {
    processType: order.processType,
    sourceType: order.processType === 'PRINT' ? 'PRINTING_WORK_ORDER' : 'DYEING_WORK_ORDER',
    sourceId: order.workOrderId,
    objectType: order.objectType,
    qtyUnit: unit,
    isPiecePrinting: order.isPiecePrinting,
    isFabricPrinting: order.isFabricPrinting,
  } as const
  const receivedQty = order.handoverRecords.reduce((sum, record) => sum + (record.receiverWrittenQty ?? record.submittedQty ?? 0), 0)
  const submittedQty = order.handoverRecords.reduce((sum, record) => sum + (record.submittedQty ?? 0), 0)
  const satisfiedQty = order.status === 'COMPLETED' ? order.plannedQty : Math.min(order.plannedQty, receivedQty || submittedQty)
  const batchNoPrefix = order.processType === 'PRINT' ? 'YHPH' : 'RSPH'
  const materialName = order.processType === 'PRINT'
    ? (order.printPayload?.materialColor ? `${order.materialSku} / ${order.printPayload.materialColor}` : order.materialName)
    : order.materialName
  const batchNo = `${batchNoPrefix}-${order.workOrderNo}`

  return {
    workOrderId: order.workOrderId,
    processType: order.processType,
    sourceType: order.sourceType,
    sourceSnapshot: structuredClone(order.sourceSnapshot),
    sourceProductionOrderId: order.sourceProductionOrderId,
    sourceProductionOrderNo: order.sourceProductionOrderNo,
    productionOrderOrderedAt: order.productionOrderOrderedAt,
    orderNo: order.workOrderNo,
    workOrderNo: order.workOrderNo,
    status: platformResultView?.platformStatusLabel || platformStatus.platformStatusLabel,
    statusLabel: order.statusLabel,
    factoryInternalStatusLabel: platformResultView?.factoryInternalStatusLabel || order.statusLabel,
    platformStatusCode: platformResultView?.platformStatusCode || platformStatus.platformStatusCode,
    platformStatusLabel: platformResultView?.platformStatusLabel || platformStatus.platformStatusLabel,
    platformStageLabel: platformStatus.platformStageLabel,
    platformRiskLevel: platformResultView?.platformRiskLevel || platformStatus.platformRiskLevel,
    platformRiskLabel: platformResultView?.platformRiskLabel || platformStatus.platformRiskLabel,
    platformActionHint: platformResultView?.platformActionHint || platformStatus.platformActionHint,
    platformOwnerHint: platformResultView?.platformOwnerHint || platformStatus.platformOwnerHint,
    factoryDisplayName: platformResultView?.factoryDisplayName,
    assignmentMode: order.assignmentMode,
    dispatchPriceDisplay: order.dispatchPriceDisplay,
    taskId: order.taskId,
    taskNo: order.taskNo,
    mobileBindingTaskNo: mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo,
    mobileBindingStatusLabel: mobileBinding.canOpenMobileExecution ? '有效' : '不可执行',
    mobileBindingReasonLabel: mobileBinding.reasonLabel,
    canOpenMobileExecution: mobileBinding.canOpenMobileExecution,
    handoverOrderId: order.handoverOrderId,
    handoverOrderNo: order.handoverOrderNo,
    reviewRecordId: order.reviewRecordId,
    latestWarehouseRecordId: platformResultView?.latestWarehouseRecordId,
    latestHandoverRecordId: platformResultView?.latestHandoverRecordId,
    latestReviewRecordId: platformResultView?.latestReviewRecordId,
    latestDifferenceRecordId: platformResultView?.latestDifferenceRecordId,
    latestOperationRecordId: platformResultView?.latestOperationRecordId,
    latestOperationChannel: platformResultView?.latestOperationChannel,
    latestOperationAt: platformResultView?.latestOperationAt,
    latestOperationBy: platformResultView?.latestOperationBy,
    hasWaitProcessRecord: platformResultView?.hasWaitProcessRecord,
    hasWaitHandoverRecord: platformResultView?.hasWaitHandoverRecord,
    hasHandoverRecord: platformResultView?.hasHandoverRecord,
    hasReviewRecord: platformResultView?.hasReviewRecord,
    hasDifferenceRecord: platformResultView?.hasDifferenceRecord,
    canPlatformFollowUp: platformResultView?.canPlatformFollowUp,
    followUpActionCode: platformResultView?.followUpActionCode,
    followUpActionLabel: platformResultView?.followUpActionLabel,
    detailLink: platformResultView?.detailLink,
    craftDetailLink: platformResultView?.craftDetailLink,
    mobileTaskLink: platformResultView?.mobileTaskLink,
    createMode: order.sourceType === 'STOCK'
      ? '按备货创建'
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? '补料确认生成'
        : PROCESS_WORK_ORDER_SOURCE_LABEL.PRODUCTION_ORDER,
    sourceLabel: PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType],
    factoryName: order.factoryName,
    plannedFeedQty: order.plannedQty,
    completedObjectQty: platformResultView?.completedObjectQty,
    waitHandoverObjectQty: platformResultView?.waitHandoverObjectQty,
    handedOverObjectQty: platformResultView?.handedOverObjectQty,
    writtenBackObjectQty: platformResultView?.writtenBackObjectQty,
    diffObjectQty: platformResultView?.diffObjectQty,
    unit,
    objectType: order.objectType,
    quantityDisplayFields: platformResultView?.quantityDisplayFields,
    plannedQtyLabel: order.qtyLabel || getQuantityLabel({ ...quantityContext, qtyPurpose: '计划' }),
    returnedQtyLabel: getQuantityLabel({ ...quantityContext, qtyPurpose: '已交出' }),
    receivedQtyLabel: getQuantityLabel({ ...quantityContext, qtyPurpose: '实收' }),
    diffQtyLabel: getQuantityLabel({ ...quantityContext, qtyPurpose: '差异' }),
    plannedFinishAt: order.plannedFinishAt || order.formalProductionOrderSnapshot?.requiredDeliveryDate || order.updatedAt,
    sourceSummary: order.sourceType === 'STOCK'
      ? `${PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType]}：${order.stockMaterialName || order.materialName}`
      : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
        ? `${PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType]}：补料单 ${order.sourceSnapshot.supplementRecordNo || '-'} / 原裁片单 ${order.sourceSnapshot.originalCutOrderNo || '-'}`
        : `${PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType]}：生产单 ${order.sourceProductionOrderNo || order.sourceProductionOrderId || '-'}`,
    materialSku: order.materialSku,
    materialName: order.materialName,
    note: `${order.processType === 'PRINT' ? '印花' : '染色'}加工单统一来源：平台视图与工艺工厂 Web 视图使用同一个加工单号。`,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    stockMaterial: order.sourceType === 'STOCK'
      ? {
          materialCode: order.stockMaterialId || order.materialSku,
          materialName: order.stockMaterialName || materialName,
          unit,
        }
      : undefined,
    materialReceipt: {
      receiveStatus: toReceiptStatusFromOrder(order),
      receivedQty: satisfiedQty,
      receivedAt: order.handoverRecords[0]?.factorySubmittedAt || order.updatedAt,
      receiptVoucher: order.handoverOrderNo || order.handoverOrderId || '待交出后回填',
      qualityConclusion: order.status === 'REJECTED' ? '接收方确认收货存在差异，需工厂复核处理。' : '同一加工单事实源收货确认。',
    },
    batches:
      submittedQty > 0
        ? [
            {
              batchNo,
              returnedQty: submittedQty,
              qualifiedQty: Math.max(0, satisfiedQty),
              availableQty: Math.max(0, satisfiedQty),
              linkedQty: Math.max(0, satisfiedQty),
              status: order.status === 'COMPLETED' ? '已关联' : '部分关联',
              returnedAt: order.handoverRecords[0]?.factorySubmittedAt || order.updatedAt,
            },
          ]
        : [],
    destinations:
      satisfiedQty > 0
        ? [
            {
              batchNo,
              sourceLabel: order.sourceType === 'STOCK'
                ? (order.stockMaterialName || order.materialName)
                : order.sourceType === 'CUT_PIECE_SUPPLEMENT'
                  ? (order.sourceSnapshot.supplementRecordNo || order.sourceSnapshot.supplementRecordId || '-')
                  : (order.sourceProductionOrderNo || order.sourceProductionOrderId || '-'),
              fulfilledQty: satisfiedQty,
              linkedAt: order.handoverRecords[0]?.receiverWrittenAt || order.updatedAt,
            },
          ]
        : [],
  }
}

export function listPrepProcessOrders(processCode: PrepProcessCode): PrepProcessOrderFact[] {
  return cloneOrders(listProcessWorkOrders(processCode).map(mapUnifiedWorkOrderToPrepOrder))
}
