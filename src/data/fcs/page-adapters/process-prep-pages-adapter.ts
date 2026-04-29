import {
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
type PrepUnit = '片' | '米'
type CreateModeZh = '按需求创建' | '按备货创建'
type DemandStatusZh = '待满足' | '部分满足' | '已满足' | '已完成交接'
type OrderStatusZh = PlatformProcessStatus
type LegacyOrderStatusZh = '待接收来料' | '待开工' | '加工中' | '部分回货' | '已完工' | '已关闭'
type ReceiptStatusZh = '待接收' | '部分接收' | '已接收'
type BatchStatusZh = '待关联' | '部分关联' | '已关联'

type LinkedOrderStatusZh = '进行中' | '待送货' | '待回写' | '待审核' | '异常' | '已回货'

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
  sourceProductionOrderId: string
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

export interface PrepOrderLinkedDemandFact {
  demandId: string
  sourceProductionOrderId: string
  materialCode: string
  materialName: string
  requiredQty: number
  satisfiedQty: number
  unit: PrepUnit
  status: DemandStatusZh
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
  demandId: string
  fulfilledQty: number
  linkedAt: string
}

export interface PrepProcessOrderFact {
  workOrderId?: string
  processType?: PrepProcessCode
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
  linkedDemands: PrepOrderLinkedDemandFact[]
  stockMaterial?: PrepOrderStockMaterialFact
  materialReceipt: PrepOrderMaterialReceiptFact
  batches: PrepOrderReturnBatchFact[]
  destinations: PrepOrderBatchDestinationFact[]
}

const META_BY_PROCESS: Record<PrepProcessCode, PrepProcessMeta> = {
  PRINT: {
    processCode: 'PRINT',
    unit: '片',
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
  if (status === '待送货') return '待送货'
  if (status === '待回写') return '待回写'
  if (status === '待审核') return '待审核'
  if (status === '异常') return '异常'
  if (status === '已完成' || status === '已关闭') return '已回货'
  return '进行中'
}

function calcOrderStatus(requiredQty: number, satisfiedQty: number, index: number): LegacyOrderStatusZh {
  if (satisfiedQty <= 0) return '待接收来料'
  if (satisfiedQty < requiredQty * 0.4) return '加工中'
  if (satisfiedQty < requiredQty) return '部分回货'
  return index % 4 === 0 ? '已关闭' : '已完工'
}

function legacyOrderStatusToPlatformStatus(status: LegacyOrderStatusZh): OrderStatusZh {
  switch (status) {
    case '待接收来料':
    case '待开工':
      return '待开工'
    case '加工中':
      return '加工中'
    case '部分回货':
      return '待回写'
    case '已完工':
      return '已完成'
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
  return `M-${meta.processCode}-${orderToken}-${pad(index + 1, 2)}`
}

function buildFacts(processCode: PrepProcessCode): {
  demands: PrepRequirementDemandFact[]
  orders: PrepProcessOrderFact[]
} {
  const meta = META_BY_PROCESS[processCode]
  const artifacts = getPrepArtifacts(processCode)

  const demands: PrepRequirementDemandFact[] = []
  const orders: PrepProcessOrderFact[] = []

  artifacts.forEach((artifact, index) => {
    const order = productionOrders.find((item) => item.productionOrderId === artifact.orderId)
    const orderQty = clampInt(artifact.orderQty)
    const ratio = SATISFIED_RATIO_PATTERN[index % SATISFIED_RATIO_PATTERN.length]
    const satisfiedQty = clampInt(orderQty * ratio)
    const handoverCompleted = ratio >= 1 && index % 2 === 0
    const demandStatus = toDemandStatus(orderQty, satisfiedQty, handoverCompleted)
    const orderStatus = calcOrderStatus(orderQty, satisfiedQty, index)
    const createMode: CreateModeZh = index % 2 === 0 ? '按需求创建' : '按备货创建'

    const orderNo = `${meta.orderPrefix}${artifact.orderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`
    const demandNo = `${meta.demandPrefix}${artifact.orderId.replace(/\D/g, '').slice(-8)}${pad(index + 1, 2)}`
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
              unit: meta.unit,
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
              unit: meta.unit,
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
              unit: meta.unit,
            },
          ]
        : []

    const linkedQty = handoverCompleted ? satisfiedQty : clampInt(satisfiedQty * 0.8)
    const qualifiedQty = clampInt(satisfiedQty * 0.98)

    const orderFact: PrepProcessOrderFact = {
      orderNo,
      status: legacyOrderStatusToPlatformStatus(orderStatus),
      statusLabel: orderStatus,
      factoryInternalStatusLabel: orderStatus,
      platformStatusLabel: legacyOrderStatusToPlatformStatus(orderStatus),
      platformStatusCode: legacyOrderStatusToPlatformStatus(orderStatus) === '已完成'
        ? 'COMPLETED'
        : legacyOrderStatusToPlatformStatus(orderStatus) === '已关闭'
          ? 'CLOSED'
          : legacyOrderStatusToPlatformStatus(orderStatus) === '待回写'
            ? 'WAIT_WRITEBACK'
            : legacyOrderStatusToPlatformStatus(orderStatus) === '加工中'
              ? 'PROCESSING'
              : 'WAIT_START',
      platformStageLabel: '平台聚合状态',
      platformRiskLevel: legacyOrderStatusToPlatformStatus(orderStatus) === '待回写' ? '预警' : '关注',
      platformRiskLabel: '由演示需求生成的加工单状态',
      platformActionHint: '跟进加工单执行与回货关联',
      platformOwnerHint: '平台 / 工艺工厂',
      createMode,
      factoryName: meta.factoryNames[index % meta.factoryNames.length],
      plannedFeedQty: orderQty,
      unit: meta.unit,
      plannedFinishAt: order?.planEndDate ?? order?.updatedAt ?? '2026-03-20 18:00:00',
      sourceSummary: `由需求单 ${demandNo} 转入${meta.processLabel}执行`,
      note: `${meta.processLabel}执行示例数据，底层来源为统一需求生成结果。`,
      createdAt,
      updatedAt,
      linkedDemands: [
        {
          demandId: demandNo,
          sourceProductionOrderId: artifact.orderId,
          materialCode: toMaterialCode(meta, artifact, index),
          materialName: `${meta.materialLabel} ${order?.demandSnapshot.spuName ?? artifact.orderId}`,
          requiredQty: orderQty,
          satisfiedQty,
          unit: meta.unit,
          status: demandStatus,
        },
      ],
      stockMaterial:
        createMode === '按备货创建'
          ? {
              materialCode: toMaterialCode(meta, artifact, index),
              materialName: `${meta.materialLabel} ${order?.demandSnapshot.spuName ?? artifact.orderId}`,
              unit: meta.unit,
            }
          : undefined,
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
                demandId: demandNo,
                fulfilledQty: linkedQty,
                linkedAt: updatedAt,
              },
            ]
          : [],
    }

    const demandFact: PrepRequirementDemandFact = {
      demandId: demandNo,
      sourceProductionOrderId: artifact.orderId,
      spuCode: order?.demandSnapshot.spuCode ?? '-',
      spuName: order?.demandSnapshot.spuName ?? '-',
      techPackVersion: order?.techPackSnapshot?.sourceTechPackVersionLabel ?? '-',
      materialCode: orderFact.linkedDemands[0].materialCode,
      materialName: orderFact.linkedDemands[0].materialName,
      requiredQty: orderQty,
      unit: meta.unit,
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
    linkedDemands: item.linkedDemands.map((demand) => ({ ...demand })),
    stockMaterial: item.stockMaterial ? { ...item.stockMaterial } : undefined,
    materialReceipt: { ...item.materialReceipt },
    batches: item.batches.map((batch) => ({ ...batch })),
    destinations: item.destinations.map((dest) => ({ ...dest })),
  }))
}

const PRINT_FACTS = buildFacts('PRINT')
const DYE_FACTS = buildFacts('DYE')

function toDemandStatusFromOrder(order: ProcessWorkOrder): DemandStatusZh {
  if (order.status === 'COMPLETED') return '已完成交接'
  if (order.handoverRecords.length > 0) return '部分满足'
  return '待满足'
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
  const unit = order.plannedUnit === '米' ? '米' : '片'
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
  const demandIds = order.sourceDemandIds.length > 0 ? order.sourceDemandIds : [`${order.processType}-DEMAND-${order.workOrderId}`]
  const productionOrderIds = order.productionOrderIds.length > 0 ? order.productionOrderIds : ['暂无生产单']
  const batchNoPrefix = order.processType === 'PRINT' ? 'YHPH' : 'RSPH'
  const materialName = order.processType === 'PRINT'
    ? (order.printPayload?.materialColor ? `${order.materialSku} / ${order.printPayload.materialColor}` : order.materialName)
    : order.materialName
  const batchNo = `${batchNoPrefix}-${order.workOrderNo}`

  return {
    workOrderId: order.workOrderId,
    processType: order.processType,
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
    createMode: '按需求创建',
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
    plannedFinishAt: order.updatedAt,
    sourceSummary: `来源需求单 ${demandIds.join('、')} / 生产单 ${productionOrderIds.join('、')}`,
    note: `${order.processType === 'PRINT' ? '印花' : '染色'}加工单统一来源：平台视图与工艺工厂 Web 视图使用同一个加工单号。`,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    linkedDemands: demandIds.map((demandId, index) => ({
      demandId,
      sourceProductionOrderId: productionOrderIds[index] || productionOrderIds[0],
      materialCode: order.materialSku,
      materialName,
      requiredQty: order.plannedQty,
      satisfiedQty,
      unit,
      status: toDemandStatusFromOrder(order),
    })),
    stockMaterial: {
      materialCode: order.materialSku,
      materialName,
      unit,
    },
    materialReceipt: {
      receiveStatus: toReceiptStatusFromOrder(order),
      receivedQty: satisfiedQty,
      receivedAt: order.handoverRecords[0]?.factorySubmittedAt || order.updatedAt,
      receiptVoucher: order.handoverOrderNo || order.handoverOrderId || '待交出后回填',
      qualityConclusion: order.status === 'REJECTED' ? '接收方回写后审核驳回，需工厂复核处理。' : '同一加工单事实源回写。',
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
              demandId: demandIds[0],
              fulfilledQty: satisfiedQty,
              linkedAt: order.handoverRecords[0]?.receiverWrittenAt || order.updatedAt,
            },
          ]
        : [],
  }
}

export function listPrepRequirementDemands(processCode: PrepProcessCode): PrepRequirementDemandFact[] {
  return cloneDemands(processCode === 'PRINT' ? PRINT_FACTS.demands : DYE_FACTS.demands)
}

export function listPrepProcessOrders(processCode: PrepProcessCode): PrepProcessOrderFact[] {
  return cloneOrders(listProcessWorkOrders(processCode).map(mapUnifiedWorkOrderToPrepOrder))
}
