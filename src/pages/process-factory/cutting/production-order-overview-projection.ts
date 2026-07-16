import { productionDemands } from '../../../data/fcs/production-demands.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import { listDyeWorkOrders } from '../../../data/fcs/dyeing-task-domain.ts'
import { listPrintWorkOrders } from '../../../data/fcs/printing-task-domain.ts'
import { listGeneratedCutOrderSourceRecords } from '../../../data/fcs/cutting/generated-cut-orders.ts'
import { listMaterialPrepOrderProjections } from '../../../data/fcs/cutting/production-material-prep.ts'
import { buildProductionProgressProjection } from './production-progress-projection.ts'
import {
  buildFactoryLines,
  summarizeDyeStatus,
  summarizePrintStatus,
  type FactoryProgressFact,
  type ProductionOrderOverviewFactoryLine,
} from './production-order-overview-model.ts'

interface OverviewProductionOrderSource {
  productionOrderId: string
  productionOrderNo: string
  demandId: string
  sourceDemandIds?: string[]
  createdAt: string
  hasCuttingRequirement?: boolean
  taskBreakdownSummary: { isBrokenDown: boolean }
  demandSnapshot: {
    spuCode: string
    spuName: string
    buyerName: string
    merchandiserName: string
  }
  techPackSnapshot: null | {
    styleCode: string
    styleName: string
    imageSnapshot: { styleImages: string[]; productImages?: string[] }
    processEntries: Array<{ processCode: string }>
  }
}

interface MaterialPrepOverviewSource {
  productionOrderId: string
  totalRequiredQty: number
  totalConfirmedPrepQty: number
}

interface CuttingProgressOverviewSource {
  productionOrderId: string
  detailRecordId?: string
  markerStatus: string
  spreadingStatus: string
  cuttingStatus: string
  inboundStatus: string
  shippingStatus: string
  receiverFactoryNames: string[]
}

export interface ProductionOrderOverviewSources {
  productionOrders: OverviewProductionOrderSource[]
  productionDemands: Array<{ demandId: string; createdAt: string; imageUrl?: string }>
  printingOrders: Array<{ productionOrderIds: string[]; status: string }>
  dyeingOrders: Array<{ productionOrderIds?: string[]; status: string }>
  materialPrepRows: MaterialPrepOverviewSource[]
  cuttingProgressRows: CuttingProgressOverviewSource[]
  factoryFacts: Array<FactoryProgressFact & { productionOrderId: string }>
}

export interface ProductionOrderOverviewRow {
  id: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderCreatedAt: string
  demandId: string
  demandCreatedAt: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  buyerName: string
  merchandiserName: string
  printingStatus: string
  dyeingStatus: string
  breakdownStatus: string
  materialPrepStatus: string
  factoryLines: ProductionOrderOverviewFactoryLine[]
  markerStatus: string
  spreadingStatus: string
  cuttingStatus: string
  inboundStatus: string
  shippingStatus: string
  receiverFactoryNames: string[]
  keywordIndex: string[]
}

function normalizeFactoryType(value: string): FactoryProgressFact['factoryTypeLabel'] {
  if (value.includes('CENTRAL') || value.includes('中央')) return '中央工厂'
  if (value && value !== '—') return '第三方工厂'
  return '—'
}

function buildDefaultFactoryFacts(): Array<FactoryProgressFact & { productionOrderId: string }> {
  const prepRows = listMaterialPrepOrderProjections()
  const pickedQtyByOrderAndFactory = new Map<string, number>()
  prepRows.forEach((projection) => {
    projection.pickupRecords.forEach((record) => {
      const key = `${projection.order.productionOrderId}::${record.receiverName}`
      pickedQtyByOrderAndFactory.set(key, (pickedQtyByOrderAndFactory.get(key) ?? 0) + record.pickedQty)
    })
  })

  const grouped = new Map<string, FactoryProgressFact & { productionOrderId: string }>()
  listGeneratedCutOrderSourceRecords().forEach((record) => {
    const factoryName = record.cuttingTaskAssigneeFactoryName || '未派单'
    const factoryId = record.cuttingTaskAssigneeFactoryId || `UNASSIGNED-${record.productionOrderId}`
    const key = `${record.productionOrderId}::${factoryId}`
    const current = grouped.get(key)
    const requiredQty = (current?.requiredQty ?? 0) + Math.max(0, record.requiredQty || 0)
    grouped.set(key, {
      productionOrderId: record.productionOrderId,
      factoryId,
      factoryName,
      factoryTypeLabel: factoryName === '未派单' ? '—' : normalizeFactoryType(record.cuttingTaskAssigneeType),
      accepted: Boolean(factoryName !== '未派单' && !record.cuttingTaskAssignmentStatus.includes('未')),
      requiredQty,
      pickedQty: pickedQtyByOrderAndFactory.get(`${record.productionOrderId}::${factoryName}`) ?? 0,
    })
  })
  const facts = [...grouped.values()]
  const multiFactoryDemo = facts.find((fact) => fact.productionOrderId === 'PO-202603-0002')
  if (multiFactoryDemo) {
    facts.push({
      productionOrderId: multiFactoryDemo.productionOrderId,
      factoryId: 'FACTORY-CENTRAL-SURABAYA',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      accepted: true,
      requiredQty: Math.max(1, Math.round(multiFactoryDemo.requiredQty / 2)),
      pickedQty: Math.max(1, Math.round(multiFactoryDemo.requiredQty / 4)),
    })
  }
  // 生产单总览演示数据：覆盖中央工厂 / 第三方工厂、接单和领取的完整状态。
  facts.push(
    {
      productionOrderId: 'PO-202603-0015',
      factoryId: 'FACTORY-THIRD-PICKED',
      factoryName: '宏达裁片厂',
      factoryTypeLabel: '第三方工厂',
      accepted: true,
      requiredQty: 1400,
      pickedQty: 1400,
    },
    {
      productionOrderId: 'PO-202603-0015',
      factoryId: 'FACTORY-CENTRAL-NOT-ACCEPTED',
      factoryName: '泗水中央裁床厂（备选）',
      factoryTypeLabel: '中央工厂',
      accepted: false,
      requiredQty: 800,
      pickedQty: 0,
    },
  )
  return facts
}

const DEMO_PRINTING_STATUSES: Array<{ productionOrderIds: string[]; status: string }> = [
  { productionOrderIds: ['PO-202603-088'], status: 'PRINTING' },
  { productionOrderIds: ['PO-202603-0015'], status: 'PRINT_DONE' },
]

const DEMO_DYEING_STATUSES: Array<{ productionOrderIds: string[]; status: string }> = [
  { productionOrderIds: ['PO-202603-088'], status: 'DYEING' },
  { productionOrderIds: ['PO-202603-0015'], status: 'DONE' },
]

const DEMO_CUTTING_PROGRESS: Record<string, Pick<CuttingProgressOverviewSource, 'markerStatus' | 'spreadingStatus' | 'cuttingStatus' | 'inboundStatus' | 'shippingStatus'>> = {
  'PO-202603-088': {
    markerStatus: '未排唛架',
    spreadingStatus: '未开始铺布',
    cuttingStatus: '未裁剪',
    inboundStatus: '未入仓',
    shippingStatus: '未发货',
  },
  'PO-202603-0002': {
    markerStatus: '唛架完成',
    spreadingStatus: '铺布中',
    cuttingStatus: '未裁剪',
    inboundStatus: '未入仓',
    shippingStatus: '未发货',
  },
  'PO-202603-0008': {
    markerStatus: '唛架完成',
    spreadingStatus: '铺布完成',
    cuttingStatus: '裁剪完成',
    inboundStatus: '待交出',
    shippingStatus: '未发货',
  },
  'PO-202603-086': {
    markerStatus: '唛架完成',
    spreadingStatus: '铺布完成',
    cuttingStatus: '裁剪完成',
    inboundStatus: '已入仓',
    shippingStatus: '发货完成',
  },
}

export function buildDefaultProductionOrderOverviewSources(): ProductionOrderOverviewSources {
  const progressRows = buildProductionProgressProjection().rows
  return {
    productionOrders,
    productionDemands,
    printingOrders: [
      ...listPrintWorkOrders().map((order) => ({
      productionOrderIds: order.productionOrderIds,
      status: order.status,
      })),
      ...DEMO_PRINTING_STATUSES,
    ],
    dyeingOrders: [
      ...listDyeWorkOrders().map((order) => ({
      productionOrderIds: order.productionOrderIds,
      status: order.status,
      })),
      ...DEMO_DYEING_STATUSES,
    ],
    materialPrepRows: listMaterialPrepOrderProjections().map((projection) => ({
      productionOrderId: projection.order.productionOrderId,
      totalRequiredQty: projection.totalRequiredQty,
      totalConfirmedPrepQty: projection.totalConfirmedPrepQty,
    })),
    cuttingProgressRows: progressRows.map((row) => ({
      productionOrderId: row.productionOrderId,
      detailRecordId: row.id,
      ...(DEMO_CUTTING_PROGRESS[row.productionOrderId] ?? {
        markerStatus: row.hasSpreadingRecord ? '唛架完成' : '未排唛架',
        spreadingStatus: row.hasSpreadingRecord ? '铺布完成' : '未开始铺布',
        cuttingStatus: row.hasInboundRecord || row.cuttingCompletionSummary.label === '已完成' ? '裁剪完成' : '未裁剪',
        inboundStatus: row.hasInboundRecord ? '已入仓' : '未入仓',
        shippingStatus: row.pieceCompletionSummary.label === '已完成' ? '发货完成' : '未发货',
      }),
      receiverFactoryNames: row.assignedFactoryName ? [row.assignedFactoryName] : [],
    })),
    factoryFacts: buildDefaultFactoryFacts(),
  }
}

function hasCuttingRequirement(order: OverviewProductionOrderSource, sources: ProductionOrderOverviewSources): boolean {
  if (order.hasCuttingRequirement) return true
  if (order.techPackSnapshot?.processEntries.some((entry) => ['CUT_PANEL', 'CUTTING'].includes(entry.processCode))) {
    return true
  }
  return sources.cuttingProgressRows.some((row) => row.productionOrderId === order.productionOrderId)
    || sources.factoryFacts.some((fact) => fact.productionOrderId === order.productionOrderId)
}

function summarizeMaterialPrep(row: MaterialPrepOverviewSource | undefined): string {
  if (!row) return '—'
  if (row.totalConfirmedPrepQty <= 0) return '未配料'
  if (row.totalConfirmedPrepQty >= row.totalRequiredQty) return '配料完成'
  return '部分配料'
}

function buildRow(
  order: OverviewProductionOrderSource,
  sources: ProductionOrderOverviewSources,
): ProductionOrderOverviewRow {
  const demandIds = new Set([order.demandId, ...(order.sourceDemandIds ?? [])])
  const demand = sources.productionDemands.find((item) => demandIds.has(item.demandId))
  const printingStatuses = sources.printingOrders
    .filter((item) => item.productionOrderIds.includes(order.productionOrderId))
    .map((item) => item.status)
  const dyeingStatuses = sources.dyeingOrders
    .filter((item) => item.productionOrderIds?.includes(order.productionOrderId))
    .map((item) => item.status)
  const printRequired = Boolean(order.techPackSnapshot?.processEntries.some((entry) => entry.processCode === 'PRINT')) || printingStatuses.length > 0
  const dyeRequired = Boolean(order.techPackSnapshot?.processEntries.some((entry) => entry.processCode === 'DYE')) || dyeingStatuses.length > 0
  const prep = sources.materialPrepRows.find((item) => item.productionOrderId === order.productionOrderId)
  const cutting = sources.cuttingProgressRows.find((item) => item.productionOrderId === order.productionOrderId)
  const factoryLines = buildFactoryLines(
    sources.factoryFacts.filter((fact) => fact.productionOrderId === order.productionOrderId),
  )
  const styleCode = order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode || '—'
  const styleName = order.techPackSnapshot?.styleName || order.demandSnapshot.spuName || '—'
  const styleImageUrl = order.techPackSnapshot?.imageSnapshot.styleImages[0]
    || order.techPackSnapshot?.imageSnapshot.productImages?.[0]
    || demand?.imageUrl
    || '/placeholder.svg?height=80&width=80'
  const receiverFactoryNames = cutting?.receiverFactoryNames ?? []

  return {
    id: cutting?.detailRecordId ?? order.productionOrderId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    productionOrderCreatedAt: order.createdAt,
    demandId: order.demandId,
    demandCreatedAt: demand?.createdAt ?? '—',
    styleCode,
    styleName,
    styleImageUrl,
    buyerName: order.demandSnapshot.buyerName || '—',
    merchandiserName: order.demandSnapshot.merchandiserName || '—',
    printingStatus: summarizePrintStatus(printRequired, printingStatuses),
    dyeingStatus: summarizeDyeStatus(dyeRequired, dyeingStatuses),
    breakdownStatus: order.taskBreakdownSummary.isBrokenDown ? '已拆解' : '未拆解',
    materialPrepStatus: summarizeMaterialPrep(prep),
    factoryLines,
    markerStatus: cutting?.markerStatus ?? '—',
    spreadingStatus: cutting?.spreadingStatus ?? '—',
    cuttingStatus: cutting?.cuttingStatus ?? '—',
    inboundStatus: cutting?.inboundStatus ?? '—',
    shippingStatus: cutting?.shippingStatus ?? '—',
    receiverFactoryNames,
    keywordIndex: [
      order.productionOrderNo,
      order.demandId,
      styleCode,
      styleName,
      order.demandSnapshot.buyerName,
      order.demandSnapshot.merchandiserName,
      ...factoryLines.map((line) => line.factoryName),
      ...receiverFactoryNames,
    ].filter(Boolean),
  }
}

export function buildProductionOrderOverviewRows(
  sources: ProductionOrderOverviewSources = buildDefaultProductionOrderOverviewSources(),
): ProductionOrderOverviewRow[] {
  return sources.productionOrders
    .filter((order) => hasCuttingRequirement(order, sources))
    .map((order) => buildRow(order, sources))
    .sort((left, right) => right.productionOrderCreatedAt.localeCompare(left.productionOrderCreatedAt, 'zh-CN'))
}
