import {
  listGeneratedProductionDemandArtifacts,
  type ProductionDemandArtifact,
} from '../production-artifact-generation.ts'
import { productionOrders } from '../production-orders.ts'

type PrepProcessCode = 'PRINT' | 'DYE'
type PrepUnit = '片' | '米'
type CreateModeZh = '按需求创建' | '按备货创建'
type DemandStatusZh = '待满足' | '部分满足' | '已满足' | '已完成交接'
type OrderStatusZh = '待接收来料' | '待开工' | '加工中' | '部分回货' | '已完工' | '已关闭'
type ReceiptStatusZh = '待接收' | '部分接收' | '已接收'
type BatchStatusZh = '待关联' | '部分关联' | '已关联'

type LinkedOrderStatusZh = '进行中' | '部分回货' | '已回货'

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
  orderNo: string
  status: OrderStatusZh
  createMode: CreateModeZh
  factoryName: string
  plannedFeedQty: number
  unit: PrepUnit
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
    factoryNames: ['鸿辉印花厂', '嘉泽印花中心', '盛彩印花厂'],
  },
  DYE: {
    processCode: 'DYE',
    unit: '米',
    demandPrefix: 'RSXQ',
    orderPrefix: 'RSJG',
    processLabel: '染色',
    materialLabel: '染色坯布',
    factoryNames: ['万隆染色厂', '雅加达染整中心', '泗水染色厂'],
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
  if (status === '部分回货') return '部分回货'
  if (status === '已完工' || status === '已关闭') return '已回货'
  return '进行中'
}

function calcOrderStatus(requiredQty: number, satisfiedQty: number, index: number): OrderStatusZh {
  if (satisfiedQty <= 0) return '待接收来料'
  if (satisfiedQty < requiredQty * 0.4) return '加工中'
  if (satisfiedQty < requiredQty) return '部分回货'
  return index % 4 === 0 ? '已关闭' : '已完工'
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
              status: toLinkedOrderStatus(orderStatus),
              returnedQty: satisfiedQty,
              unit: meta.unit,
            },
          ]
        : []

    const linkedQty = handoverCompleted ? satisfiedQty : clampInt(satisfiedQty * 0.8)
    const qualifiedQty = clampInt(satisfiedQty * 0.98)

    const orderFact: PrepProcessOrderFact = {
      orderNo,
      status: orderStatus,
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

export function listPrepRequirementDemands(processCode: PrepProcessCode): PrepRequirementDemandFact[] {
  return cloneDemands(processCode === 'PRINT' ? PRINT_FACTS.demands : DYE_FACTS.demands)
}

export function listPrepProcessOrders(processCode: PrepProcessCode): PrepProcessOrderFact[] {
  return cloneOrders(processCode === 'PRINT' ? PRINT_FACTS.orders : DYE_FACTS.orders)
}
