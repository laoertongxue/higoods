import {
  buildProductionDemandBusinessId,
  listGeneratedProductionDemandArtifacts,
  type ProductionDemandArtifact,
} from '../production-artifact-generation.ts'
import { productionOrders } from '../production-orders.ts'
import {
  listProcessWorkOrders,
  type ProcessWorkOrder,
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
import { TEST_FACTORY_NAME } from '../factory-mock-data.ts'

type PrepProcessCode = 'PRINT' | 'DYE'
type PrepUnit = string
type CreateModeZh = '生产单自动生成' | '按备货创建'
type DemandStatusZh = '待满足' | '部分满足' | '已满足' | '已完成交接'
type OrderStatusZh = PlatformProcessStatus
type LegacyOrderStatusZh = '待接收来料' | '待开工' | '加工中' | '部分交出' | '全部交出' | '已关闭'
type ReceiptStatusZh = '待接收' | '部分接收' | '已接收'
type BatchStatusZh = '待关联' | '部分关联' | '已关联'

type LinkedOrderStatusZh = '进行中' | '待交出' | '交出待收货' | '收货确认中' | '部分交出' | '收货差异' | '已收货'

interface PrepProcessMeta {
  processCode: PrepProcessCode
  unit: PrepUnit
  demandPrefix: string
  orderPrefix: string
  processLabel: string
  materialLabel: string
  factoryNames: string[]
}

export interface PrepRequirementTraceLine {
  processOrderNo: string
  batchNo: string
  batchSupplyQty: number
  usedQty: number
  unit: PrepUnit
  batchStatus: '已入裁片仓' | '质检中' | '待入库'
}

export interface PrepRequirementSourceLine {
  preparationOrderNo: string
  qty: number
  unit: PrepUnit
  preparedAt: string
  warehouseName: string
  preparationStatus: '待配料' | '部分配料' | '已完成配料'
  cumulativeSatisfiedQty: number
  traceLines: PrepRequirementTraceLine[]
}

export interface PrepRequirementLinkedOrder {
  processOrderNo: string
  createMode: CreateModeZh
  factoryName: string
  status: LinkedOrderStatusZh
  returnedQty: number
  unit: PrepUnit
}

export interface PrepRequirementDemandFact {
  demandId: string
  sourceArtifactId?: string
  sourceProductionOrderId: string
  bomItemId: string
  requiresWaterSoluble: boolean
  processRoute: Array<'WATER_SOLUBLE' | 'DYE'>
  spuCode: string
  spuName: string
  techPackVersion: string
  materialCode: string
  materialName: string
  requiredQty: number
  unit: PrepUnit
  requirementText: string
  sourceBomItem: string
  sourceTechPackVersion: string
  nextProcessName: string
  updatedAt: string
  handoverCompleted: boolean
  sources: PrepRequirementSourceLine[]
  linkedOrders: PrepRequirementLinkedOrder[]
}

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
  sourceType: 'PRODUCTION_ORDER' | 'STOCK'
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
  note: string
  createdAt: string
  updatedAt: string
  stockMaterial?: PrepOrderStockMaterialFact
  materialReceipt: PrepOrderMaterialReceiptFact
  batches: PrepOrderReturnBatchFact[]
  destinations: PrepOrderBatchDestinationFact[]
}

const META_BY_PROCESS: Record<PrepProcessCode, PrepProcessMeta> = {
  PRINT: {
    processCode: 'PRINT',
    unit: 'Yard',
    demandPrefix: 'YHXQ',
    orderPrefix: 'YHJG',
    processLabel: '印花',
    materialLabel: '印花基布',
    factoryNames: [TEST_FACTORY_NAME],
  },
  DYE: {
    processCode: 'DYE',
    unit: '米',
    demandPrefix: 'RSXQ',
    orderPrefix: 'RSJG',
    processLabel: '染色',
    materialLabel: '染色坯布',
    factoryNames: [TEST_FACTORY_NAME],
  },
}

const SATISFIED_RATIO_PATTERN = [0, 0.45, 0.7, 1]
function pad(num: number, size: number): string {
  return String(num).padStart(size, '0')
}

function clampInt(value: number): number {
  return Math.max(0, Math.round(value))
}

function getPrepArtifacts(processCode: PrepProcessCode): ProductionDemandArtifact[] {
  return listGeneratedProductionDemandArtifacts()
    .filter((item) => item.processCode === processCode && item.artifactType === 'DEMAND' && item.stageCode === 'PREP')
    .sort((a, b) => {
      if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId)
      return a.sortKey.localeCompare(b.sortKey)
    })
}

function toDemandStatus(requiredQty: number, satisfiedQty: number, handoverCompleted: boolean): DemandStatusZh {
  if (satisfiedQty <= 0) return '待满足'
  if (satisfiedQty < requiredQty) return '部分满足'
  if (handoverCompleted) return '已完成交接'
  return '已满足'
}

function toLinkedOrderStatus(status: OrderStatusZh): LinkedOrderStatusZh {
  if (status === '待交出') return '待交出'
  if (status === '交出待收货') return '交出待收货'
  if (status === '收货确认中') return '收货确认中'
  if (status === '部分交出') return '部分交出'
  if (status === '收货差异' || status === '异常') return '收货差异'
  if (status === '全部交出' || status === '已完成' || status === '已关闭') return '已收货'
  return '进行中'
}

function calcOrderStatus(requiredQty: number, satisfiedQty: number, index: number): LegacyOrderStatusZh {
  if (satisfiedQty <= 0) return '待接收来料'
  if (satisfiedQty < requiredQty * 0.4) return '加工中'
  if (satisfiedQty < requiredQty) return '部分交出'
  return index % 4 === 0 ? '已关闭' : '全部交出'
}

function legacyOrderStatusToPlatformStatus(status: LegacyOrderStatusZh): OrderStatusZh {
  switch (status) {
    case '待接收来料':
    case '待开工':
      return '待开工'
    case '加工中':
      return '加工中'
    case '部分交出':
      return '部分交出'
    case '全部交出':
      return '全部交出'
    case '已关闭':
      return '已关闭'
    default:
      return '异常'
  }
}

function calcReceiptStatus(requiredQty: number, satisfiedQty: number): ReceiptStatusZh {
  if (satisfiedQty <= 0) return '待接收'
  if (satisfiedQty < requiredQty) return '部分接收'
  return '已接收'
}

function toWarehouseName(index: number): string {
  return index % 2 === 0 ? '雅加达裁片仓' : '万隆裁片仓'
}

function toRequirementText(meta: PrepProcessMeta, artifact: ProductionDemandArtifact): string {
  if (artifact.craftName) {
    return `${meta.processLabel}要求：按「${artifact.craftName}」工艺标准执行`
  }
  return `${meta.processLabel}要求：按技术包 ${artifact.sourceEntryId} 标准执行`
}

function toMaterialCode(meta: PrepProcessMeta, artifact: ProductionDemandArtifact, index: number): string {
  const orderToken = artifact.orderId.replace(/\D/g, '').slice(-4) || '0000'
  const craftToken = artifact.craftCode?.replace(/\D/g, '').slice(-4)
  return `M-${meta.processCode}-${craftToken ? `${craftToken}-` : ''}${orderToken}-${pad(index + 1, 2)}`
}

function buildFacts(processCode: PrepProcessCode): {
  demands: PrepRequirementDemandFact[]
  orders: PrepProcessOrderFact[]
} {
  const meta = META_BY_PROCESS[processCode]
  const artifacts = getPrepArtifacts(processCode)

  if (artifacts.length === 0) {
    return buildFactsFromProcessWorkOrders(processCode)
  }

  const demands: PrepRequirementDemandFact[] = []
  const orders: PrepProcessOrderFact[] = []

  artifacts.forEach((artifact, index) => {
    const order = productionOrders.find((item) => item.productionOrderId === artifact.orderId)
    const orderQty = artifact.plannedQty ?? clampInt(artifact.orderQty)
    const ratio = SATISFIED_RATIO_PATTERN[index % SATISFIED_RATIO_PATTERN.length]
    const satisfiedQty = clampInt(orderQty * ratio)
    const handoverCompleted = ratio >= 1 && index % 2 === 0
    const orderStatus = calcOrderStatus(orderQty, satisfiedQty, index)
    const createMode: CreateModeZh = '生产单自动生成'
    const artifactUnit = artifact.plannedUnit || meta.unit

    const orderNo = buildProductionDemandBusinessId(meta.orderPrefix, artifact)
    const demandNo = buildProductionDemandBusinessId(meta.demandPrefix, artifact)
    const batchNo = `${meta.processCode === 'PRINT' ? 'YHPH' : 'RSPH'}${artifact.orderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`
    const preparationOrderNo = `PL${artifact.orderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`
    const createdAt = order?.createdAt ?? '2026-03-01 09:00:00'
    const updatedAt = order?.updatedAt ?? createdAt

    const traceLine: PrepRequirementTraceLine[] =
      satisfiedQty > 0
        ? [
            {
              processOrderNo: orderNo,
              batchNo,
              batchSupplyQty: clampInt(satisfiedQty * 1.05),
              usedQty: satisfiedQty,
              unit: artifactUnit,
              batchStatus: handoverCompleted ? '已入裁片仓' : '质检中',
            },
          ]
        : []

    const sources: PrepRequirementSourceLine[] =
      satisfiedQty > 0
        ? [
            {
              preparationOrderNo,
              qty: satisfiedQty,
              unit: artifactUnit,
              preparedAt: updatedAt,
              warehouseName: toWarehouseName(index),
              preparationStatus: satisfiedQty < orderQty ? '部分配料' : '已完成配料',
              cumulativeSatisfiedQty: satisfiedQty,
              traceLines: traceLine,
            },
          ]
        : []

    const linkedOrders: PrepRequirementLinkedOrder[] =
      satisfiedQty > 0
        ? [
            {
              processOrderNo: orderNo,
              createMode,
              factoryName: meta.factoryNames[index % meta.factoryNames.length],
              status: toLinkedOrderStatus(legacyOrderStatusToPlatformStatus(orderStatus)),
              returnedQty: satisfiedQty,
              unit: artifactUnit,
            },
          ]
        : []

    const linkedQty = handoverCompleted ? satisfiedQty : clampInt(satisfiedQty * 0.8)
    const qualifiedQty = clampInt(satisfiedQty * 0.98)

    const orderFact: PrepProcessOrderFact = {
      sourceArtifactIds: [artifact.artifactId],
      sourceType: 'PRODUCTION_ORDER',
      sourceProductionOrderId: artifact.orderId,
      sourceProductionOrderNo: order?.productionOrderNo || artifact.orderId,
      productionOrderOrderedAt: createdAt,
      orderNo,
      status: legacyOrderStatusToPlatformStatus(orderStatus),
      statusLabel: orderStatus,
      factoryInternalStatusLabel: orderStatus,
      platformStatusLabel: legacyOrderStatusToPlatformStatus(orderStatus),
      platformStatusCode: legacyOrderStatusToPlatformStatus(orderStatus) === '已完成'
        ? 'COMPLETED'
        : legacyOrderStatusToPlatformStatus(orderStatus) === '已关闭'
          ? 'CLOSED'
          : legacyOrderStatusToPlatformStatus(orderStatus) === '部分交出'
            ? 'PARTIAL_HANDOVER'
            : legacyOrderStatusToPlatformStatus(orderStatus) === '全部交出'
              ? 'FULL_HANDOVER'
            : legacyOrderStatusToPlatformStatus(orderStatus) === '加工中'
              ? 'PROCESSING'
              : 'WAIT_START',
      platformStageLabel: '平台聚合状态',
      platformRiskLevel: legacyOrderStatusToPlatformStatus(orderStatus) === '部分交出' ? '预警' : '关注',
      platformRiskLabel: '由演示需求生成的加工单状态',
      platformActionHint: '跟进加工单执行与交出收货',
      platformOwnerHint: '平台 / 工艺工厂',
      createMode,
      factoryName: meta.factoryNames[index % meta.factoryNames.length],
      plannedFeedQty: orderQty,
      unit: artifactUnit,
      plannedFinishAt: order?.demandSnapshot.requiredDeliveryDate ?? order?.updatedAt ?? '2026-03-20 18:00:00',
      sourceSummary: `生产单 ${order?.productionOrderNo || artifact.orderId} 自动生成`,
      note: `${meta.processLabel}执行示例数据，来源为正式生产单工艺快照。`,
      createdAt,
      updatedAt,
      materialReceipt: {
        receiveStatus: calcReceiptStatus(orderQty, satisfiedQty),
        receivedQty: satisfiedQty,
        receivedAt: satisfiedQty > 0 ? updatedAt : '-',
        receiptVoucher: satisfiedQty > 0 ? `WMS 单据 ${artifact.orderId}-${meta.processCode}-${pad(index + 1, 2)}` : '待接收后回填',
        qualityConclusion: satisfiedQty > 0 ? '来料检验通过，可进入工序。' : '待来料接收',
      },
      batches:
        satisfiedQty > 0
          ? [
              {
                batchNo,
                returnedQty: satisfiedQty,
                qualifiedQty,
                availableQty: qualifiedQty,
                linkedQty,
                status: linkedQty <= 0 ? '待关联' : linkedQty < qualifiedQty ? '部分关联' : '已关联',
                returnedAt: updatedAt,
              },
            ]
          : [],
      destinations:
        linkedQty > 0
          ? [
              {
                batchNo,
                sourceLabel: order?.productionOrderNo || artifact.orderId,
                fulfilledQty: linkedQty,
                linkedAt: updatedAt,
              },
            ]
          : [],
    }

    const demandFact: PrepRequirementDemandFact = {
      demandId: demandNo,
      sourceArtifactId: artifact.artifactId,
      sourceProductionOrderId: artifact.orderId,
      bomItemId: artifact.bomItemId || artifact.sourceEntryId,
      requiresWaterSoluble: artifact.requiresWaterSoluble === true,
      processRoute: artifact.processRoute ? [...artifact.processRoute] : processCode === 'DYE' ? ['DYE'] : [],
      spuCode: order?.demandSnapshot.spuCode ?? '-',
      spuName: order?.demandSnapshot.spuName ?? '-',
      techPackVersion: order?.techPackSnapshot?.sourceTechPackVersionLabel ?? '-',
      materialCode: toMaterialCode(meta, artifact, index),
      materialName: `${meta.materialLabel} ${order?.demandSnapshot.spuName ?? artifact.orderId}`,
      requiredQty: orderQty,
      unit: artifactUnit,
      requirementText: toRequirementText(meta, artifact),
      sourceBomItem: artifact.sourceEntryId,
      sourceTechPackVersion: order?.techPackSnapshot?.sourceTechPackVersionLabel ?? '-',
      nextProcessName: '后续工序',
      updatedAt,
      handoverCompleted,
      sources,
      linkedOrders,
    }

    demands.push(demandFact)
    orders.push(orderFact)
  })

  return { demands, orders }
}

function cloneDemands(input: PrepRequirementDemandFact[]): PrepRequirementDemandFact[] {
  return input.map((item) => ({
    ...item,
    sources: item.sources.map((source) => ({
      ...source,
      traceLines: source.traceLines.map((trace) => ({ ...trace })),
    })),
    linkedOrders: item.linkedOrders.map((order) => ({ ...order })),
  }))
}

function cloneOrders(input: PrepProcessOrderFact[]): PrepProcessOrderFact[] {
  return input.map((item) => ({
    ...item,
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
    createMode: order.sourceType === 'STOCK' ? '按备货创建' : '生产单自动生成',
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
      ? `按备货创建：${order.stockMaterialName || order.materialName}`
      : `生产单 ${order.sourceProductionOrderNo || order.sourceProductionOrderId || '-'} 自动生成`,
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
                : (order.sourceProductionOrderNo || order.sourceProductionOrderId || '-'),
              fulfilledQty: satisfiedQty,
              linkedAt: order.handoverRecords[0]?.receiverWrittenAt || order.updatedAt,
            },
          ]
        : [],
  }
}

function toDemandFactFromProcessOrder(
  processCode: PrepProcessCode,
  orderFact: PrepProcessOrderFact,
  index: number,
): PrepRequirementDemandFact | null {
  if (orderFact.sourceType !== 'PRODUCTION_ORDER' || !orderFact.sourceProductionOrderId) return null
  const meta = META_BY_PROCESS[processCode]
  const productionOrder = productionOrders.find((order) => order.productionOrderId === orderFact.sourceProductionOrderId)
  const techPackSnapshot = productionOrder?.techPackSnapshot ?? null
  const sourceBomItem = techPackSnapshot?.bomItems[0]
  const materialCode = sourceBomItem?.id || `${processCode}-${orderFact.workOrderId || orderFact.orderNo}`
  const materialName = sourceBomItem
    ? `${sourceBomItem.name}${sourceBomItem.spec ? ` / ${sourceBomItem.spec}` : ''}`
    : `${meta.materialLabel} / ${orderFact.orderNo}`
  const sourceBomLabel = sourceBomItem
    ? `${sourceBomItem.name}${sourceBomItem.spec ? ` / ${sourceBomItem.spec}` : ''}`
    : materialName
  const satisfiedQty = Math.max(0, Math.round(orderFact.materialReceipt.receivedQty || 0))
  const handoverCompleted = orderFact.status === '已完成'
  const batchNo = `${processCode === 'PRINT' ? 'YHPH' : 'RSPH'}${orderFact.sourceProductionOrderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`
  const demandId = `${processCode}-PROCESS-DETAIL-${orderFact.workOrderId || orderFact.orderNo}`
  const traceLines: PrepRequirementTraceLine[] =
    satisfiedQty > 0
      ? [
          {
            processOrderNo: orderFact.orderNo,
            batchNo,
            batchSupplyQty: clampInt(satisfiedQty * 1.05),
            usedQty: satisfiedQty,
            unit: orderFact.unit,
            batchStatus: handoverCompleted ? '已入裁片仓' : '质检中',
          },
        ]
      : []

  return {
    demandId,
    sourceProductionOrderId: orderFact.sourceProductionOrderId,
    bomItemId: materialCode,
    requiresWaterSoluble: sourceBomItem?.waterSolubleRequirement === '是',
    processRoute: processCode === 'DYE'
      ? sourceBomItem?.waterSolubleRequirement === '是' ? ['WATER_SOLUBLE', 'DYE'] : ['DYE']
      : [],
    spuCode: productionOrder?.demandSnapshot.spuCode ?? '-',
    spuName: productionOrder?.demandSnapshot.spuName ?? '-',
    techPackVersion: techPackSnapshot?.sourceTechPackVersionLabel ?? '-',
    materialCode,
    materialName,
    requiredQty: orderFact.plannedFeedQty,
    unit: orderFact.unit,
    requirementText: `${meta.processLabel}要求：按技术包 ${techPackSnapshot?.sourceTechPackVersionLabel ?? '-'} / ${sourceBomLabel} 执行`,
    sourceBomItem: sourceBomLabel,
    sourceTechPackVersion: techPackSnapshot?.sourceTechPackVersionLabel ?? '-',
    nextProcessName: '后续工序',
    updatedAt: orderFact.updatedAt,
    handoverCompleted,
    sources:
      satisfiedQty > 0
        ? [
            {
              preparationOrderNo: `PL${orderFact.sourceProductionOrderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`,
              qty: satisfiedQty,
              unit: orderFact.unit,
              preparedAt: orderFact.materialReceipt.receivedAt,
              warehouseName: toWarehouseName(index),
              preparationStatus: satisfiedQty < orderFact.plannedFeedQty ? '部分配料' : '已完成配料',
              cumulativeSatisfiedQty: satisfiedQty,
              traceLines,
            },
          ]
        : [],
    linkedOrders: [
      {
        processOrderNo: orderFact.orderNo,
        createMode: orderFact.createMode,
        factoryName: orderFact.factoryName,
        status: toLinkedOrderStatus(orderFact.status),
        returnedQty: satisfiedQty,
        unit: orderFact.unit,
      },
    ],
  }
}

function buildFactsFromProcessWorkOrders(processCode: PrepProcessCode): {
  demands: PrepRequirementDemandFact[]
  orders: PrepProcessOrderFact[]
} {
  const orders = listProcessWorkOrders(processCode)
    .map(mapUnifiedWorkOrderToPrepOrder)
  const demands = orders
    .map((order, index) => toDemandFactFromProcessOrder(processCode, order, index))
    .filter((item): item is PrepRequirementDemandFact => Boolean(item))

  return { demands, orders }
}

export function listPrepRequirementDemands(processCode: PrepProcessCode): PrepRequirementDemandFact[] {
  return cloneDemands(buildFacts(processCode).demands)
}

export function listPrepProcessOrders(processCode: PrepProcessCode): PrepProcessOrderFact[] {
  return cloneOrders(buildFactsFromProcessWorkOrders(processCode).orders)
}
