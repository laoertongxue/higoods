import type { RuntimeProcessTask } from './runtime-process-tasks.ts'
import type { ProductionOrder } from './production-orders.ts'
import type { SpecialCraftTaskOrder } from './special-craft-task-orders.ts'
import type { WoolDomainStore, WoolHandoverRecord } from './wool-task-domain.ts'

export type FormalPostFinishingReturnSourceKind =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'
  | 'WHOLE_GARMENT_WOOL'
  | 'GARMENT_HEAT_TRANSFER'
  | 'GARMENT_DIRECT_PRINT'

export type FormalPostFinishingResponsibilityType =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_TO_IRON_PACK'
  | 'CUTTING_TO_IRON_PACK'

export interface FormalPostFinishingReturnSku {
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

export interface FormalPostFinishingReturnSource {
  sourceKind: FormalPostFinishingReturnSourceKind
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  executionTaskId: string
  sourceTaskNo: string
  assignmentId: string
  responsibilityType: FormalPostFinishingResponsibilityType
  defaultStagingLocation: string
  sourceFactoryId: string
  sourceFactoryName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  styleGrade: 'A' | 'B' | 'C' | 'D'
  buyerName: string
  productionOrderType: '首单' | '翻单'
  saleType: string
  tagPrice: number
  skus: FormalPostFinishingReturnSku[]
}

export interface PostFinishingFormalReturnSourceFacts {
  productionOrders: readonly ProductionOrder[]
  runtimeTasks: readonly RuntimeProcessTask[]
  woolStore?: WoolDomainStore
  specialCraftTaskOrders: readonly SpecialCraftTaskOrder[]
}

interface OrderDisplayFacts {
  styleNo: string
  styleName: string
  spuCode: string
  imageUrl: string
  styleGrade: 'A' | 'B' | 'C' | 'D'
  buyerName: string
  productionOrderType: '首单' | '翻单'
  saleType: string
}

const GARMENT_GRAPHIC_OPERATION_KINDS = new Map<string, FormalPostFinishingReturnSourceKind>([
  ['AUX-OP-HEAT-TRANSFER', 'GARMENT_HEAT_TRANSFER'],
  ['AUX-OP-DIRECT-PRINT', 'GARMENT_DIRECT_PRINT'],
])
const KOL_FACTORY_IDS = new Set(['KOL-GOTO-001', 'KOL-GOTO'])
const KOL_SALE_TYPES = new Set(['KOL样衣', 'KOL样品小单'])
const MANAGED_POST_FACTORY_ID = 'PF-DEDICATED-001'
const MANAGED_POST_FACTORY_NAME = 'HiGood 后道工厂'

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function resolveStyleImage(styleName: string, explicitImageUrl?: string): string {
  const explicit = explicitImageUrl?.trim()
  if (explicit) return explicit
  const normalized = styleName.toLowerCase()
  if (/连衣裙|半裙|裙|dress|skirt/.test(normalized)) return '/dress-sample-1.jpg'
  if (/毛织|针织|开衫|cardigan|knit|sweater/.test(normalized)) return '/cardigan-sample.jpg'
  if (/裤|pants|trouser/.test(normalized)) return '/pants-sample.jpg'
  if (/外套|夹克|jacket|coat/.test(normalized)) return '/jacket-sample.jpg'
  return '/shirt-sample.jpg'
}

function normalizeStyleGrade(value: unknown): 'A' | 'B' | 'C' | 'D' {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' ? value : 'B'
}

function resolveOrderDisplayFacts(order: ProductionOrder): OrderDisplayFacts {
  const snapshot = order.techPackSnapshot
  const styleName = snapshot?.styleName || order.demandSnapshot.spuName
  return {
    styleNo: snapshot?.styleCode || order.demandSnapshot.spuCode,
    styleName,
    spuCode: order.demandSnapshot.spuCode,
    imageUrl: resolveStyleImage(styleName, snapshot?.imageSnapshot.styleImages[0] || snapshot?.imageSnapshot.productImages[0]),
    styleGrade: normalizeStyleGrade(snapshot?.garmentDifficultyGrade),
    buyerName: order.demandSnapshot.buyerName || '—',
    // 当前正式生产单没有“首单/翻单”的权威字段，适配层不根据合单数量臆测翻单。
    productionOrderType: '首单',
    saleType: order.demandSnapshot.saleType || '—',
  }
}

function findFormalOrder(
  orders: readonly ProductionOrder[],
  productionOrderId: string,
  productionOrderNo: string,
): ProductionOrder | undefined {
  return orders.find((order) => (
    order.productionOrderId === productionOrderId
    || order.productionOrderNo === productionOrderNo
  ))
}

function isExcludedKolOrder(order: ProductionOrder | undefined, factoryId?: string): boolean {
  const isKolOrder = Boolean(
    order
    && KOL_FACTORY_IDS.has(order.mainFactoryId)
    && order.sourceDemandSnapshots.length > 0
    && order.sourceDemandSnapshots.every((snapshot) => KOL_SALE_TYPES.has(snapshot.saleType)),
  )
  return isKolOrder || KOL_FACTORY_IDS.has(factoryId || '')
}

function getEffectiveWoolHandoverQty(store: WoolDomainStore, record: WoolHandoverRecord): number {
  const changes = store.qtyChangeLogs
    .filter((change) => change.recordType === 'HANDOVER' && change.recordId === record.handoverId)
    .sort((left, right) => left.changedAt.localeCompare(right.changedAt) || left.changeId.localeCompare(right.changeId))
  return changes.at(-1)?.afterQty ?? record.handoverQty
}

function aggregateSkuLines(input: Array<{
  skuCode: string
  colorName: string
  sizeName: string
  qty: number
}>): Array<{ skuCode: string; colorName: string; sizeName: string; qty: number }> {
  const rows = new Map<string, { skuCode: string; colorName: string; sizeName: string; qty: number }>()
  input.forEach((line) => {
    if (!line.skuCode.trim() || !isPositiveInteger(line.qty)) return
    const key = `${line.skuCode}\u0000${line.colorName}\u0000${line.sizeName}`
    const current = rows.get(key)
    rows.set(key, current ? { ...current, qty: current.qty + line.qty } : { ...line })
  })
  return [...rows.values()]
}

function buildSkus(
  display: OrderDisplayFacts,
  sourceIdentity: string,
  lines: Array<{ skuCode: string; colorName: string; sizeName: string; qty: number }>,
): FormalPostFinishingReturnSku[] {
  return aggregateSkuLines(lines).map((line) => ({
    skuId: `${sourceIdentity}::${line.skuCode}::${line.colorName}::${line.sizeName}`,
    skuCode: line.skuCode,
    spuCode: display.spuCode,
    spuName: display.styleName,
    colorName: line.colorName || '—',
    sizeName: line.sizeName || '—',
    imageUrl: display.imageUrl,
    barcode: line.skuCode,
    plannedQty: line.qty,
    qtyUnit: '件',
  }))
}

function buildCommonSource(input: {
  sourceKind: FormalPostFinishingReturnSourceKind
  order: ProductionOrder | undefined
  productionOrderId: string
  productionOrderNo: string
  styleNo?: string
  styleName?: string
  styleImageUrl?: string
  executionTaskId: string
  sourceTaskNo: string
  assignmentId: string
  responsibilityType: FormalPostFinishingResponsibilityType
  sourceFactoryId: string
  sourceFactoryName: string
  lines: Array<{ skuCode: string; colorName: string; sizeName: string; qty: number }>
}): FormalPostFinishingReturnSource | undefined {
  const display = input.order
    ? resolveOrderDisplayFacts(input.order)
    : {
        styleNo: input.styleNo || input.productionOrderNo,
        styleName: input.styleName || input.productionOrderNo,
        spuCode: input.styleNo || input.productionOrderNo,
        imageUrl: resolveStyleImage(input.styleName || '', input.styleImageUrl),
        styleGrade: 'B' as const,
        buyerName: '—',
        productionOrderType: '首单' as const,
        saleType: '预售',
      }
  const skus = buildSkus(display, input.executionTaskId, input.lines)
  if (!skus.length) return undefined
  return {
    sourceKind: input.sourceKind,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    styleNo: display.styleNo,
    styleName: display.styleName,
    executionTaskId: input.executionTaskId,
    sourceTaskNo: input.sourceTaskNo,
    assignmentId: input.assignmentId,
    responsibilityType: input.responsibilityType,
    defaultStagingLocation: '后道待确认区',
    sourceFactoryId: input.sourceFactoryId,
    sourceFactoryName: input.sourceFactoryName,
    managedPostFactoryId: MANAGED_POST_FACTORY_ID,
    managedPostFactoryName: MANAGED_POST_FACTORY_NAME,
    styleGrade: display.styleGrade,
    buyerName: display.buyerName,
    productionOrderType: display.productionOrderType,
    saleType: display.saleType,
    tagPrice: 0,
    skus,
  }
}

function isEffectiveRuntimeAssignment(task: RuntimeProcessTask): boolean {
  return (task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED')
    && Boolean(task.assignedFactoryId?.trim())
    && Boolean(task.assignedFactoryName?.trim())
    && task.acceptanceStatus !== 'REJECTED'
    && task.status !== 'BLOCKED'
    && task.status !== 'CANCELLED'
    && task.executionEnabled !== false
}

function resolveRuntimeSourceKind(task: RuntimeProcessTask): {
  sourceKind: FormalPostFinishingReturnSourceKind
  responsibilityType: FormalPostFinishingResponsibilityType
} | undefined {
  const mergedType = task.mergedTaskType || task.processBusinessCode
  if (mergedType === 'SEWING_IRON_PACK') {
    return { sourceKind: 'SEWING_IRON_PACK', responsibilityType: 'SEWING_TO_IRON_PACK' }
  }
  if (mergedType === 'CUTTING_SEWING_IRON_PACK') {
    return { sourceKind: 'CUTTING_SEWING_IRON_PACK', responsibilityType: 'CUTTING_TO_IRON_PACK' }
  }
  if (
    task.processCode === 'SEW'
    || task.processBusinessCode === 'SEW'
    || task.processNameZh === '车缝'
    || task.coveredProcesses?.some((process) => process.processCode === 'SEW' || process.processName === '车缝')
  ) {
    return { sourceKind: 'INDEPENDENT_SEWING', responsibilityType: 'INDEPENDENT_SEWING' }
  }
  return undefined
}

function resolveProductionOrderResponsibility(
  runtimeTasks: readonly RuntimeProcessTask[],
  productionOrderId: string,
): FormalPostFinishingResponsibilityType {
  const effectiveTasks = runtimeTasks.filter((task) => (
    task.productionOrderId === productionOrderId
    && isEffectiveRuntimeAssignment(task)
  ))
  if (effectiveTasks.some((task) => (task.mergedTaskType || task.processBusinessCode) === 'CUTTING_SEWING_IRON_PACK')) {
    return 'CUTTING_TO_IRON_PACK'
  }
  if (effectiveTasks.some((task) => (task.mergedTaskType || task.processBusinessCode) === 'SEWING_IRON_PACK')) {
    return 'SEWING_TO_IRON_PACK'
  }
  return 'INDEPENDENT_SEWING'
}

function buildRuntimeSewingSources(facts: PostFinishingFormalReturnSourceFacts): FormalPostFinishingReturnSource[] {
  return facts.runtimeTasks.flatMap((task) => {
    const classification = resolveRuntimeSourceKind(task)
    if (!classification || !isEffectiveRuntimeAssignment(task)) return []
    const order = findFormalOrder(facts.productionOrders, task.productionOrderId, task.productionOrderNo || '')
    if (!order || isExcludedKolOrder(order, task.assignedFactoryId)) return []
    const source = buildCommonSource({
      ...classification,
      order,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      executionTaskId: task.taskId,
      sourceTaskNo: task.taskNo || task.taskId,
      assignmentId: `TASK-ASSIGNMENT:${task.taskId}:${task.assignedFactoryId}`,
      sourceFactoryId: task.assignedFactoryId!,
      sourceFactoryName: task.assignedFactoryName!,
      lines: task.scopeSkuLines.map((line) => ({
        skuCode: line.skuCode,
        colorName: line.color,
        sizeName: line.size,
        qty: line.qty,
      })),
    })
    return source ? [source] : []
  })
}

function buildWholeGarmentWoolSources(facts: PostFinishingFormalReturnSourceFacts): FormalPostFinishingReturnSource[] {
  const store = facts.woolStore
  if (!store) return []
  return store.handovers.flatMap((handover) => {
    if (handover.receiverType !== 'DOWNSTREAM_FACTORY' || handover.downstreamReceipt?.status === 'CONFIRMED') return []
    const workOrder = store.workOrders[handover.woolOrderId]
    if (!workOrder || workOrder.kind !== 'WHOLE_GARMENT' || KOL_FACTORY_IDS.has(workOrder.factoryId)) return []
    const formalOrder = findFormalOrder(facts.productionOrders, workOrder.productionOrderId, workOrder.productionOrderNo)
    if (isExcludedKolOrder(formalOrder, workOrder.factoryId)) return []
    const outputLine = workOrder.outputPlanLines.find((line) => line.outputSkuCode === handover.outputSkuCode)
    const effectiveQty = getEffectiveWoolHandoverQty(store, handover)
    if (!outputLine || outputLine.outputObjectType !== 'GARMENT' || !isPositiveInteger(effectiveQty)) return []
    const source = buildCommonSource({
      sourceKind: 'WHOLE_GARMENT_WOOL',
      order: formalOrder,
      productionOrderId: workOrder.productionOrderId,
      productionOrderNo: workOrder.productionOrderNo,
      styleNo: workOrder.styleNo,
      styleName: workOrder.styleName,
      styleImageUrl: workOrder.styleImageUrl,
      executionTaskId: `${workOrder.taskId}::${handover.handoverId}`,
      sourceTaskNo: `${workOrder.taskNo}/${handover.handoverId}`,
      assignmentId: `WOOL-ASSIGNMENT:${workOrder.woolOrderId}:${workOrder.factoryId}`,
      responsibilityType: 'INDEPENDENT_SEWING',
      sourceFactoryId: workOrder.factoryId,
      sourceFactoryName: workOrder.factoryName,
      lines: [{
        skuCode: outputLine.garmentSkuCode || outputLine.outputSkuCode,
        colorName: outputLine.colorName,
        sizeName: outputLine.sizeCode,
        qty: effectiveQty,
      }],
    })
    return source ? [source] : []
  })
}

function buildGarmentGraphicSources(facts: PostFinishingFormalReturnSourceFacts): FormalPostFinishingReturnSource[] {
  return facts.specialCraftTaskOrders.flatMap((taskOrder) => {
    const sourceKind = GARMENT_GRAPHIC_OPERATION_KINDS.get(taskOrder.operationId)
    if (!sourceKind || taskOrder.targetObject !== '成衣' || taskOrder.assignmentStatus !== 'ASSIGNED') return []
    const factoryId = taskOrder.assignedFactoryId || taskOrder.factoryId
    const factoryName = taskOrder.assignedFactoryName || taskOrder.factoryName
    if (!factoryId?.trim() || !factoryName?.trim()) return []
    const order = findFormalOrder(facts.productionOrders, taskOrder.productionOrderId, taskOrder.productionOrderNo)
    if (!order || isExcludedKolOrder(order, factoryId)) return []
    const source = buildCommonSource({
      sourceKind,
      order,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      executionTaskId: taskOrder.taskOrderId,
      sourceTaskNo: taskOrder.taskOrderNo,
      assignmentId: `SPECIAL-ASSIGNMENT:${taskOrder.taskOrderId}:${factoryId}`,
      responsibilityType: resolveProductionOrderResponsibility(facts.runtimeTasks, order.productionOrderId),
      sourceFactoryId: factoryId,
      sourceFactoryName: factoryName,
      lines: (taskOrder.lineProgress || []).map((line) => ({
        skuCode: line.skuCode || '',
        colorName: line.colorName,
        sizeName: line.sizeCode,
        qty: line.returnedQty,
      })),
    })
    return source ? [source] : []
  })
}

export function buildFormalPostFinishingReturnSources(
  facts: PostFinishingFormalReturnSourceFacts,
): FormalPostFinishingReturnSource[] {
  const sources = [
    ...buildRuntimeSewingSources(facts),
    ...buildWholeGarmentWoolSources(facts),
    ...buildGarmentGraphicSources(facts),
  ]
  const uniqueSources = new Map<string, FormalPostFinishingReturnSource>()
  sources.forEach((source) => uniqueSources.set(source.executionTaskId, source))
  return [...uniqueSources.values()].sort((left, right) => (
    left.productionOrderNo.localeCompare(right.productionOrderNo)
    || left.sourceTaskNo.localeCompare(right.sourceTaskNo)
  ))
}
