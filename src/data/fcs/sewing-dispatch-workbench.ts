import { listProductionOrderSewingFactories, productionOrders, selectProductionOrderMainFactory, type ProductionOrder } from './production-orders.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import type { TechPackCutPiecePartSnapshot } from './production-tech-pack-snapshot-types.ts'
import {
  applyRuntimeDirectDispatchMeta,
  allocateRuntimeSewingTaskScope,
  captureRuntimeDirectDispatchState,
  getRuntimeTaskById,
  isRuntimeIndependentSewingTask,
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
  restoreRuntimeDirectDispatchState,
  upsertRuntimeTaskTender,
  type RuntimeProcessTask,
  type RuntimeTaskAllocatableGroup,
} from './runtime-process-tasks.ts'
import {
  buildDispatchAcceptanceDeadline,
  resolveDispatchAcceptanceSlaForTask,
} from './dispatch-acceptance-sla.ts'
import {
  captureSewingDeliverySlaSnapshotStore,
  compareSewingDeliveryDateTimes,
  formatOperationLocalWallClock,
  restoreSewingDeliverySlaSnapshotStore,
} from './sewing-delivery-sla.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import { getThirdPartyFactoryRatingSnapshot } from './third-party-factory-rating.ts'
import {
  listAvailableCutPieceInventoryForSewingDispatch,
} from './cutting/sewing-dispatch.ts'
import { listGeneratedCutOrderSourceRecords } from './cutting/generated-cut-orders.ts'
import {
  listCuttingSpecialCraftFeiTicketBindingsForProjection,
  type CuttingSpecialCraftFeiTicketBinding,
} from './cutting/special-craft-fei-ticket-flow.ts'
import { listMarkerPlanCutOrderSourceRecords } from './cutting/marker-plan-source.ts'

export type SewingDispatchKitStatus = '已齐套' | '有缺口'
export type SewingDispatchGapType = '普通裁片' | '毛织片' | '辅助工艺裁片' | '特种工艺裁片' | '辅料'
export type SewingDispatchPieceCategory = '普通裁片' | '毛织片' | '辅助工艺裁片' | '特种工艺裁片'

export interface SewingDispatchPieceComponent {
  componentId: string
  category: SewingDispatchPieceCategory
  partName: string
  craftName?: string
  ownerFactoryName?: string
  requiredPieceQty: number
  availablePieceQty: number
  completeGarmentQty: number
  gapPieceQty: number
  statusLabel: '已齐套' | '有缺口'
  reason: string
}

export interface SewingDispatchReadinessGroup {
  category: SewingDispatchPieceCategory | '辅料'
  statusLabel: '已齐套' | '部分齐套' | '有缺口' | '不涉及'
  completeQty: number
  gapQty: number
  summary: string
  components: SewingDispatchPieceComponent[] | SewingDispatchAccessoryComponent[]
}

export interface SewingDispatchAccessoryComponent {
  componentId: string
  materialName: string
  unitUsage: number
  requiredQty: number
  availableQty: number
  completeGarmentQty: number
  gapQty: number
  unit: string
  statusLabel: '已齐套' | '有缺口'
  sourceLabel: string
}

export interface SewingDispatchMarkerRisk {
  markerPlanNo: string
  sourceCutOrderNos: string[]
  sourceProductionOrderNos: string[]
  isCrossProductionOrder: boolean
  riskLabel: string
}

export interface SewingDispatchCutOrderClosureItem {
  cutOrderId: string
  cutOrderNo: string
  markerPlanNo: string
  statusLabel: '已关闭' | '裁剪完成待关闭' | '裁剪中' | '待裁剪'
  isClosed: boolean
}

export interface SewingDispatchCutOrderClosureSummary {
  totalCount: number
  closedCount: number
  openCount: number
  statusLabel: '全部已关闭' | '部分已关闭' | '未关闭' | '不涉及裁片单'
  summary: string
  items: SewingDispatchCutOrderClosureItem[]
}

export interface SewingDispatchWorkbenchRow {
  rowId: string
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  spuName: string
  skuCode: string
  colorName: string
  sizeCode: string
  styleImageUrl?: string
  materialImageUrl?: string
  demandQty: number
  assignedQty: number
  remainingQty: number
  completeKitQty: number
  kitStatus: SewingDispatchKitStatus
  assignmentStatusLabel: string
  mainFactoryStatusLabel: string
  allocatableGroupKey?: string
  allocatableGroupLabel?: string
  normalPieces: SewingDispatchReadinessGroup
  woolPieces: SewingDispatchReadinessGroup
  auxiliaryPieces: SewingDispatchReadinessGroup
  specialPieces: SewingDispatchReadinessGroup
  accessories: SewingDispatchReadinessGroup
  markerRisks: SewingDispatchMarkerRisk[]
  gapTypes: SewingDispatchGapType[]
  gapSummary: string
  decisionHint: string
}

export interface SewingDispatchWorkbenchTask {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  spuName: string
  styleImageUrl?: string
  assignmentStatusLabel: string
  mainFactoryStatusLabel: string
  skuRows: SewingDispatchWorkbenchRow[]
  skuCount: number
  demandQty: number
  assignedQty: number
  remainingQty: number
  completeKitQty: number
  completeSkuCount: number
  gapSkuCount: number
  kitStatus: SewingDispatchKitStatus
  normalPieces: SewingDispatchReadinessGroup
  woolPieces: SewingDispatchReadinessGroup
  auxiliaryPieces: SewingDispatchReadinessGroup
  specialPieces: SewingDispatchReadinessGroup
  accessories: SewingDispatchReadinessGroup
  markerRisks: SewingDispatchMarkerRisk[]
  cutOrderClosure: SewingDispatchCutOrderClosureSummary
  gapTypes: SewingDispatchGapType[]
  gapSummary: string
  decisionHint: string
}

export interface SewingDispatchWorkbenchSummary {
  pendingTaskCount: number
  skuRowCount: number
  completeKitQtyTotal: number
  completeSkuCount: number
  gapSkuCount: number
  crossMarkerPlanCount: number
  cutOrderClosedTaskCount: number
}

export interface SewingDispatchDraft {
  draftId: string
  createdAt: string
  createdBy: string
  actionType: '直接派单' | '发起竞价'
  factoryId?: string
  factoryName?: string
  rowIds: string[]
  skuSummary: string
  qty: number
  statusLabel: string
  runtimeTaskIds: string[]
  tenderIds: string[]
}

const assignmentStatusLabels: Record<string, string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已直接派单',
  BIDDING: '竞价中',
  AWARDED: '已定标',
}

const auxiliaryCraftKeywords = ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝']

const sewingDispatchDrafts: SewingDispatchDraft[] = []

export function runSewingDispatchWorkbenchTransaction<T>(operation: () => T): T {
  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  const draftState = structuredClone(sewingDispatchDrafts)
  try {
    return operation()
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
    sewingDispatchDrafts.splice(0, sewingDispatchDrafts.length, ...draftState)
    throw error
  }
}

const styleImageFallbackBySpu: Record<string, string> = {
  'SPU-2024-010': '/pants-sample.jpg',
  'SPU-2024-011': '/cardigan-sample.jpg',
  'SPU-2024-012': '/jacket-sample.jpg',
  'SPU-2024-013': '/shirt-sample.jpg',
  'SPU-2024-014': '/tshirt-sample.jpg',
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function addDays(value: string, days: number): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + days)
  return nowTimestamp(date)
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function roundQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100) / 100
}

function floorQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function getTaskNo(task: RuntimeProcessTask): string {
  return task.taskNo || task.rootTaskNo || task.taskId
}

function getOrder(task: RuntimeProcessTask): ProductionOrder | null {
  return productionOrders.find((order) => order.productionOrderId === task.productionOrderId) ?? null
}

function getTaskSkuLines(task: RuntimeProcessTask, order: ProductionOrder): Array<{ skuCode: string; color: string; size: string; qty: number }> {
  const lines = task.scopeSkuLines.length > 0 ? task.scopeSkuLines : order.demandSnapshot.skuLines
  return lines.map((line) => ({
    skuCode: line.skuCode,
    color: line.color,
    size: line.size,
    qty: Math.max(Number(line.qty) || 0, 0),
  }))
}

function getRowImage(order: ProductionOrder, kind: 'style' | 'material'): string | undefined {
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (kind === 'style') {
    return snapshot?.imageSnapshot.productImages[0]
      || snapshot?.imageSnapshot.styleImages[0]
      || snapshot?.imageSnapshot.sampleImages[0]
      || styleImageFallbackBySpu[order.demandSnapshot.spuCode]
  }
  if (!snapshot) return undefined
  return snapshot.imageSnapshot.materialImages[0] || snapshot.imageSnapshot.patternImages[0]
}

function isPartApplicable(part: TechPackCutPiecePartSnapshot, colorName: string, sizeCode: string): boolean {
  const colorOk = part.applicableColorList.length === 0 || part.applicableColorList.includes(colorName)
  const sizeOk = part.applicableSizeList.length === 0 || part.applicableSizeList.includes(sizeCode)
  return colorOk && sizeOk
}

function classifyPiecePart(part: TechPackCutPiecePartSnapshot): SewingDispatchPieceCategory {
  const craftText = (part.specialCrafts ?? []).map((craft) => craft.displayName || craft.craftName || craft.processName).join('、')
  if (!craftText) return '普通裁片'
  if (auxiliaryCraftKeywords.some((keyword) => craftText.includes(keyword))) return '辅助工艺裁片'
  return '特种工艺裁片'
}

function getPartCraftName(part: TechPackCutPiecePartSnapshot): string | undefined {
  return (part.specialCrafts ?? [])
    .map((craft) => craft.displayName || craft.craftName || craft.processName)
    .filter(Boolean)
    .join('、') || undefined
}

function buildInventoryPieceMap(productionOrderId: string, colorName: string, sizeCode: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const line of listAvailableCutPieceInventoryForSewingDispatch({ productionOrderId, colorName, sizeCode })) {
    map.set(line.partName, roundQty((map.get(line.partName) ?? 0) + line.availablePieceQty))
  }
  return map
}

function applyDemoInventoryCoverage(input: {
  skuCode: string
  remainingQty: number
  parts: TechPackCutPiecePartSnapshot[]
  inventoryByPart: Map<string, number>
}): void {
  if (!input.skuCode.includes('XL-KHK-R3')) return
  input.parts.forEach((part) => {
    input.inventoryByPart.set(part.partNameCn, Math.max(input.inventoryByPart.get(part.partNameCn) ?? 0, input.remainingQty * Math.max(part.pieceCountPerGarment || 1, 1)))
  })
}

function buildDemoAuxiliaryGroup(skuCode: string, remainingQty: number): SewingDispatchReadinessGroup | null {
  if (!skuCode.includes('M-NVY-R3')) return null
  const completeQty = Math.floor(remainingQty * 0.42)
  const requiredPieceQty = remainingQty
  const availablePieceQty = completeQty
  const component: SewingDispatchPieceComponent = {
    componentId: `${skuCode}-AUX-EMBROIDERY`,
    category: '辅助工艺裁片',
    partName: '胸袋贴片',
    craftName: '绣花',
    ownerFactoryName: '雅加达绣花专工厂',
    requiredPieceQty,
    availablePieceQty,
    completeGarmentQty: completeQty,
    gapPieceQty: Math.max(0, requiredPieceQty - availablePieceQty),
    statusLabel: '有缺口',
    reason: '演示：辅助工艺厂仍有部分胸袋贴片未回仓，跟单需要催对应工厂。',
  }
  return {
    category: '辅助工艺裁片',
    statusLabel: '部分齐套',
    completeQty,
    gapQty: Math.max(0, remainingQty - completeQty),
    summary: '辅助工艺裁片缺口：胸袋贴片。',
    components: [component],
  }
}

function buildDemoPieceComponent(input: {
  skuCode: string
  category: SewingDispatchPieceCategory
  partName: string
  remainingQty: number
  pieceCount?: number
  readyRatio?: number
  craftName?: string
  ownerFactoryName?: string
}): SewingDispatchPieceComponent {
  const pieceCount = Math.max(input.pieceCount || 1, 1)
  const requiredPieceQty = roundQty(input.remainingQty * pieceCount)
  const completeGarmentQty = floorQty(input.remainingQty * Math.min(Math.max(input.readyRatio ?? 1, 0), 1))
  const availablePieceQty = roundQty(completeGarmentQty * pieceCount)
  const gapPieceQty = Math.max(0, roundQty(requiredPieceQty - availablePieceQty))
  const statusLabel = completeGarmentQty >= input.remainingQty ? '已齐套' : '有缺口'

  return {
    componentId: `${input.skuCode}-${input.category}-${input.partName}`,
    category: input.category,
    partName: input.partName,
    craftName: input.craftName,
    ownerFactoryName: input.ownerFactoryName,
    requiredPieceQty,
    availablePieceQty,
    completeGarmentQty,
    gapPieceQty,
    statusLabel,
    reason: statusLabel === '已齐套'
      ? `${input.category}已满足当前 SKU。`
      : `缺 ${gapPieceQty} 片，需跟进${input.ownerFactoryName || input.category}。`,
  }
}

function buildGroupFromComponents(
  category: SewingDispatchPieceCategory,
  components: SewingDispatchPieceComponent[],
  remainingQty: number,
): SewingDispatchReadinessGroup {
  if (components.length === 0) {
    return {
      category,
      statusLabel: '不涉及',
      completeQty: remainingQty,
      gapQty: 0,
      summary: `当前 SKU 不涉及${category}。`,
      components: [],
    }
  }

  const completeQty = Math.min(...components.map((component) => component.completeGarmentQty))
  const gapQty = Math.max(0, remainingQty - completeQty)
  const statusLabel = completeQty >= remainingQty ? '已齐套' : completeQty > 0 ? '部分齐套' : '有缺口'
  const gapParts = components.filter((component) => component.statusLabel !== '已齐套').map((component) => component.partName)

  return {
    category,
    statusLabel,
    completeQty,
    gapQty,
    summary: statusLabel === '已齐套'
      ? `${category}已满足 ${remainingQty} 件。`
      : `${category}缺口：${unique(gapParts).join('、') || '待核对'}。`,
    components,
  }
}

function buildDemoMixedWoolGroups(skuCode: string, remainingQty: number): {
  normalPieces?: SewingDispatchReadinessGroup
  woolPieces?: SewingDispatchReadinessGroup
} {
  const isMixedWool = skuCode.includes('SKU-011') || skuCode.includes('SKU-012')
  if (!isMixedWool) return {}

  const isPartialGap = skuCode.includes('-S-') || skuCode.includes('-XL-')
  const normalReadyRatio = isPartialGap ? 0.72 : 1
  const woolReadyRatio = skuCode.includes('SKU-012') && skuCode.includes('-XL-') ? 0.68 : 1
  return {
    normalPieces: buildGroupFromComponents('普通裁片', [
      buildDemoPieceComponent({
        skuCode,
        category: '普通裁片',
        partName: '门襟布片',
        remainingQty,
        pieceCount: 2,
        readyRatio: normalReadyRatio,
        ownerFactoryName: '我方裁床厂',
      }),
      buildDemoPieceComponent({
        skuCode,
        category: '普通裁片',
        partName: '袋口贴布',
        remainingQty,
        pieceCount: 2,
        readyRatio: normalReadyRatio,
        ownerFactoryName: '我方裁床厂',
      }),
    ], remainingQty),
    woolPieces: buildGroupFromComponents('毛织片', [
      buildDemoPieceComponent({
        skuCode,
        category: '毛织片',
        partName: '前后身毛织片',
        remainingQty,
        pieceCount: 2,
        readyRatio: woolReadyRatio,
        ownerFactoryName: '毛织协同工厂',
      }),
      buildDemoPieceComponent({
        skuCode,
        category: '毛织片',
        partName: '袖片毛织片',
        remainingQty,
        pieceCount: 2,
        readyRatio: woolReadyRatio,
        ownerFactoryName: '毛织协同工厂',
      }),
    ], remainingQty),
  }
}

function findMatchingBindings(
  bindings: CuttingSpecialCraftFeiTicketBinding[],
  input: {
    productionOrderId: string
    colorName: string
    sizeCode: string
    partName: string
  },
): CuttingSpecialCraftFeiTicketBinding[] {
  return bindings.filter((binding) =>
    binding.productionOrderId === input.productionOrderId &&
    binding.colorName === input.colorName &&
    binding.sizeCode === input.sizeCode &&
    binding.partName === input.partName,
  )
}

function buildPieceGroup(input: {
  category: SewingDispatchPieceCategory
  parts: TechPackCutPiecePartSnapshot[]
  productionOrderId: string
  colorName: string
  sizeCode: string
  remainingQty: number
  inventoryByPart: Map<string, number>
  bindings: CuttingSpecialCraftFeiTicketBinding[]
}): SewingDispatchReadinessGroup {
  const { category, parts, productionOrderId, colorName, sizeCode, remainingQty, inventoryByPart, bindings } = input
  if (parts.length === 0) {
    return {
      category,
      statusLabel: '不涉及',
      completeQty: remainingQty,
      gapQty: 0,
      summary: `当前 SKU 不涉及${category}。`,
      components: [],
    }
  }

  const components = parts.map((part): SewingDispatchPieceComponent => {
    const partName = part.partNameCn
    const pieceCount = Math.max(Number(part.pieceCountPerGarment) || 1, 1)
    const requiredPieceQty = roundQty(remainingQty * pieceCount)
    const availablePieceQty = roundQty(inventoryByPart.get(partName) ?? 0)
    const completeGarmentQty = floorQty(availablePieceQty / pieceCount)
    const gapPieceQty = Math.max(0, roundQty(requiredPieceQty - availablePieceQty))
    const matchedBindings = findMatchingBindings(bindings, { productionOrderId, colorName, sizeCode, partName })
    const firstBinding = matchedBindings[0]
    const hasOpenCraftGap = matchedBindings.some((binding) =>
      binding.specialCraftFlowStatus !== '已回仓' && binding.specialCraftFlowStatus !== '已完成',
    )
    const statusLabel = completeGarmentQty >= remainingQty && !hasOpenCraftGap ? '已齐套' : '有缺口'
    const craftName = getPartCraftName(part)
    const ownerFactoryName = firstBinding?.targetFactoryName
    const flowReason = hasOpenCraftGap
      ? `工艺流转状态：${unique(matchedBindings.map((binding) => binding.specialCraftFlowStatus)).join('、')}`
      : ''

    return {
      componentId: `${category}-${productionOrderId}-${colorName}-${sizeCode}-${partName}`,
      category,
      partName,
      craftName,
      ownerFactoryName,
      requiredPieceQty,
      availablePieceQty,
      completeGarmentQty,
      gapPieceQty,
      statusLabel,
      reason: statusLabel === '已齐套'
        ? '已回到可用于车缝的裁片库存。'
        : flowReason || `缺 ${gapPieceQty} 片，需继续核对裁床或对应工艺回仓。`,
    }
  })

  const completeQty = Math.min(...components.map((component) => component.completeGarmentQty))
  const gapQty = Math.max(0, remainingQty - completeQty)
  const statusLabel = completeQty >= remainingQty ? '已齐套' : completeQty > 0 ? '部分齐套' : '有缺口'
  const gapParts = components.filter((component) => component.statusLabel !== '已齐套').map((component) => component.partName)

  return {
    category,
    statusLabel,
    completeQty,
    gapQty,
    summary: statusLabel === '已齐套'
      ? `${category}已满足 ${remainingQty} 件。`
      : `${category}缺口：${unique(gapParts).join('、') || '待核对'}。`,
    components,
  }
}

function buildAccessoryComponents(input: {
  order: ProductionOrder
  skuCode: string
  remainingQty: number
}): SewingDispatchAccessoryComponent[] {
  const { order, skuCode, remainingQty } = input
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const bomAccessories = (snapshot?.bomItems ?? []).filter((item) => {
    const text = `${item.type} ${item.name} ${item.spec}`
    return /辅料|纽扣|拉链|线|吊牌|主唛|洗唛|标/.test(text)
  })

  const base = bomAccessories.length > 0
    ? bomAccessories.slice(0, 3).map((item, index) => ({
        componentId: `${skuCode}-${item.id || index}`,
        materialName: item.name,
        unitUsage: Math.max(item.unitConsumption || 1, 1),
        unit: /线/.test(`${item.type} ${item.name}`) ? '卷' : /拉链/.test(item.name) ? '条' : /唛|标|吊牌/.test(item.name) ? '张' : '个',
        sourceLabel: '技术包 BOM',
      }))
    : [
        { componentId: `${skuCode}-MAIN-LABEL`, materialName: '主唛', unitUsage: 1, unit: '张', sourceLabel: '演示辅料清单' },
        { componentId: `${skuCode}-WASH-LABEL`, materialName: '洗唛', unitUsage: 1, unit: '张', sourceLabel: '演示辅料清单' },
      ]

  return base.map((item, index) => {
    const gapDemo = skuCode.includes('M-NVY-R3') || skuCode.includes('S-GRN')
    const exactReadyDemo = skuCode.includes('XL-KHK-R3') || skuCode.includes('L-KHK-R3')
    const availableGarmentQty = gapDemo
      ? Math.max(0, Math.floor(remainingQty * (index === 0 ? 0.55 : 0.75)))
      : exactReadyDemo
        ? remainingQty
        : Math.max(remainingQty, 120)
    const requiredQty = roundQty(remainingQty * item.unitUsage)
    const availableQty = roundQty(availableGarmentQty * item.unitUsage)
    const completeGarmentQty = floorQty(availableQty / item.unitUsage)
    const gapQty = Math.max(0, roundQty(requiredQty - availableQty))
    return {
      ...item,
      requiredQty,
      availableQty,
      completeGarmentQty,
      gapQty,
      statusLabel: gapQty > 0 ? '有缺口' : '已齐套',
    }
  })
}

function buildAccessoryGroup(order: ProductionOrder, skuCode: string, remainingQty: number): SewingDispatchReadinessGroup {
  const components = buildAccessoryComponents({ order, skuCode, remainingQty })
  const completeQty = Math.min(...components.map((component) => component.completeGarmentQty))
  const gapQty = Math.max(0, remainingQty - completeQty)
  const statusLabel = completeQty >= remainingQty ? '已齐套' : completeQty > 0 ? '部分齐套' : '有缺口'
  return {
    category: '辅料',
    statusLabel,
    completeQty,
    gapQty,
    summary: statusLabel === '已齐套'
      ? `辅料满足 ${remainingQty} 件。`
      : `辅料缺口：${components.filter((item) => item.statusLabel !== '已齐套').map((item) => item.materialName).join('、') || '待核对'}。`,
    components,
  }
}

function getMarkerRisks(order: ProductionOrder, skuCode: string): SewingDispatchMarkerRisk[] {
  const rows = listMarkerPlanCutOrderSourceRecords()
    .filter((record) => record.sourceProductionOrderIds.includes(order.productionOrderId))
    .map((record) => ({
      markerPlanNo: record.markerPlanNo,
      sourceCutOrderNos: record.sourceCutOrderNos,
      sourceProductionOrderNos: record.sourceProductionOrderNos,
      isCrossProductionOrder: record.sourceProductionOrderIds.length > 1,
      riskLabel: record.sourceProductionOrderIds.length > 1 ? '跨生产单唛架，分配前需确认承接方节奏。' : '单生产单唛架。',
    }))

  if (skuCode.includes('L-KHK-R3')) {
    rows.unshift({
      markerPlanNo: 'MB-260302-260307-跨单演示',
      sourceCutOrderNos: ['CUT-260302-004-01', 'CUT-260307-102-01'],
      sourceProductionOrderNos: ['PO-202603-0004', order.productionOrderNo],
      isCrossProductionOrder: true,
      riskLabel: '演示：多个生产单进入同一唛架方案，分配车缝前需确认同一承接节奏。',
    })
  }

  return rows
}

function findAllocatableGroup(task: RuntimeProcessTask, skuCode: string): RuntimeTaskAllocatableGroup | undefined {
  return listRuntimeTaskAllocatableGroups(task.taskId).find((group) =>
    group.dimensions.GARMENT_SKU === skuCode ||
    group.groupLabel.includes(skuCode) ||
    group.detailRowKeys.some((key) => key.includes(skuCode)),
  )
}

function collectGapTypes(row: Pick<SewingDispatchWorkbenchRow, 'normalPieces' | 'woolPieces' | 'auxiliaryPieces' | 'specialPieces' | 'accessories'>): SewingDispatchGapType[] {
  const gaps: SewingDispatchGapType[] = []
  if (row.normalPieces.gapQty > 0) gaps.push('普通裁片')
  if (row.woolPieces.gapQty > 0) gaps.push('毛织片')
  if (row.auxiliaryPieces.gapQty > 0) gaps.push('辅助工艺裁片')
  if (row.specialPieces.gapQty > 0) gaps.push('特种工艺裁片')
  if (row.accessories.gapQty > 0) gaps.push('辅料')
  return gaps
}

function buildDecisionHint(row: Pick<SewingDispatchWorkbenchRow, 'completeKitQty' | 'remainingQty' | 'gapTypes'>): string {
  if (row.completeKitQty <= 0) return '当前完整齐套数量为 0，请先跟进普通裁片、毛织片、工艺裁片或辅料缺口。'
  if (row.completeKitQty < row.remainingQty) return '存在部分完整齐套数量，跟单可结合交期和工厂情况决定是否先分配部分数量。'
  return '当前 SKU 已完整齐套，跟单可按生产计划分配车缝任务。'
}

function buildWorkbenchRow(task: RuntimeProcessTask, order: ProductionOrder, skuLine: { skuCode: string; color: string; size: string; qty: number }): SewingDispatchWorkbenchRow {
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const remainingQty = task.assignmentStatus === 'UNASSIGNED' || task.assignmentStatus === 'BIDDING'
    ? skuLine.qty
    : 0
  const assignedQty = Math.max(0, skuLine.qty - remainingQty)
  const inventoryByPart = buildInventoryPieceMap(order.productionOrderId, skuLine.color, skuLine.size)
  const bindings = listCuttingSpecialCraftFeiTicketBindingsForProjection()
  const applicableParts = (snapshot?.cutPieceParts ?? []).filter((part) => isPartApplicable(part, skuLine.color, skuLine.size))
  applyDemoInventoryCoverage({
    skuCode: skuLine.skuCode,
    remainingQty,
    parts: applicableParts,
    inventoryByPart,
  })
  const normalParts = applicableParts.filter((part) => classifyPiecePart(part) === '普通裁片')
  const auxiliaryParts = applicableParts.filter((part) => classifyPiecePart(part) === '辅助工艺裁片')
  const specialParts = applicableParts.filter((part) => classifyPiecePart(part) === '特种工艺裁片')
  const demoMixedWoolGroups = buildDemoMixedWoolGroups(skuLine.skuCode, remainingQty)

  let normalPieces = demoMixedWoolGroups.normalPieces ?? buildPieceGroup({
    category: '普通裁片',
    parts: normalParts,
    productionOrderId: order.productionOrderId,
    colorName: skuLine.color,
    sizeCode: skuLine.size,
    remainingQty,
    inventoryByPart,
    bindings,
  })
  const woolPieces = demoMixedWoolGroups.woolPieces ?? buildGroupFromComponents('毛织片', [], remainingQty)

  let auxiliaryPieces = buildPieceGroup({
    category: '辅助工艺裁片',
    parts: auxiliaryParts,
    productionOrderId: order.productionOrderId,
    colorName: skuLine.color,
    sizeCode: skuLine.size,
    remainingQty,
    inventoryByPart,
    bindings,
  })
  auxiliaryPieces = buildDemoAuxiliaryGroup(skuLine.skuCode, remainingQty) ?? auxiliaryPieces
  const specialPieces = buildPieceGroup({
    category: '特种工艺裁片',
    parts: specialParts,
    productionOrderId: order.productionOrderId,
    colorName: skuLine.color,
    sizeCode: skuLine.size,
    remainingQty,
    inventoryByPart,
    bindings,
  })
  const accessories = buildAccessoryGroup(order, skuLine.skuCode, remainingQty)
  const factors = [normalPieces, woolPieces, auxiliaryPieces, specialPieces, accessories]
    .filter((group) => group.statusLabel !== '不涉及')

  const completeKitQty = remainingQty <= 0
    ? 0
    : Math.min(remainingQty, ...factors.map((group) => group.completeQty))

  const allocatableGroup = findAllocatableGroup(task, skuLine.skuCode)
  const rowBase = {
    normalPieces,
    woolPieces,
    auxiliaryPieces,
    specialPieces,
    accessories,
  }
  const gapTypes = collectGapTypes(rowBase)
  const kitStatus: SewingDispatchKitStatus = completeKitQty >= remainingQty && remainingQty > 0
      ? '已齐套'
      : '有缺口'

  const row: SewingDispatchWorkbenchRow = {
    rowId: `${task.taskId}__${skuLine.skuCode}`,
    taskId: task.taskId,
    taskNo: getTaskNo(task),
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    spuCode: order.demandSnapshot.spuCode,
    spuName: order.demandSnapshot.spuName,
    skuCode: skuLine.skuCode,
    colorName: skuLine.color,
    sizeCode: skuLine.size,
    styleImageUrl: getRowImage(order, 'style'),
    materialImageUrl: getRowImage(order, 'material'),
    demandQty: skuLine.qty,
    assignedQty,
    remainingQty,
    completeKitQty,
    kitStatus,
    assignmentStatusLabel: assignmentStatusLabels[task.assignmentStatus] || task.assignmentStatus,
    mainFactoryStatusLabel: order.mainFactoryStatus === 'PENDING_SEWING_ASSIGNMENT' ? '待车缝确认' : '已确认主工厂',
    allocatableGroupKey: allocatableGroup?.groupKey,
    allocatableGroupLabel: allocatableGroup?.groupLabel,
    normalPieces,
    woolPieces,
    auxiliaryPieces,
    specialPieces,
    accessories,
    markerRisks: getMarkerRisks(order, skuLine.skuCode),
    gapTypes,
    gapSummary: gapTypes.length > 0 ? gapTypes.join('、') : '无缺口',
    decisionHint: '',
  }

  row.decisionHint = buildDecisionHint(row)
  return row
}

function inferCutOrderStatus(record: ReturnType<typeof listGeneratedCutOrderSourceRecords>[number], index: number): SewingDispatchCutOrderClosureItem['statusLabel'] {
  if (record.productionOrderNo.includes('0102')) return index === 0 ? '已关闭' : '裁剪完成待关闭'
  if (record.productionOrderNo.includes('0007')) return index === 0 ? '裁剪中' : '待裁剪'
  if (record.productionOrderNo.includes('0008')) return '待裁剪'
  if (index === 0) return '已关闭'
  if (index === 1) return '裁剪完成待关闭'
  return '裁剪中'
}

function buildDemoCutOrdersForMixedWool(order: ProductionOrder): SewingDispatchCutOrderClosureItem[] {
  if (!order.demandSnapshot.spuCode.includes('SPU-2024-011') && !order.demandSnapshot.spuCode.includes('SPU-2024-012')) return []
  const suffix = order.productionOrderNo.replace(/\D/g, '').slice(-6) || order.productionOrderId.replace(/\D/g, '').slice(-6)
  return [
    {
      cutOrderId: `demo-cut:${order.productionOrderId}:woven-trim`,
      cutOrderNo: `CUT-${suffix}-MIX-01`,
      markerPlanNo: `MKP-${suffix}-MIX-01`,
      statusLabel: '已关闭',
      isClosed: true,
    },
    {
      cutOrderId: `demo-cut:${order.productionOrderId}:pocket-facing`,
      cutOrderNo: `CUT-${suffix}-MIX-02`,
      markerPlanNo: `MKP-${suffix}-MIX-02`,
      statusLabel: order.demandSnapshot.spuCode.includes('SPU-2024-012') ? '裁剪中' : '裁剪完成待关闭',
      isClosed: false,
    },
  ]
}

function buildCutOrderClosureSummary(order: ProductionOrder): SewingDispatchCutOrderClosureSummary {
  const generatedItems = listGeneratedCutOrderSourceRecords()
    .filter((record) => record.productionOrderId === order.productionOrderId)
    .map((record, index): SewingDispatchCutOrderClosureItem => {
      const statusLabel = inferCutOrderStatus(record, index)
      return {
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        markerPlanNo: record.markerPlanNo,
        statusLabel,
        isClosed: statusLabel === '已关闭',
      }
    })
  const items = generatedItems.length > 0 ? generatedItems : buildDemoCutOrdersForMixedWool(order)
  if (items.length === 0) {
    return {
      totalCount: 0,
      closedCount: 0,
      openCount: 0,
      statusLabel: '不涉及裁片单',
      summary: '当前车缝任务不涉及裁片单闭环。',
      items: [],
    }
  }

  const closedCount = items.filter((item) => item.isClosed).length
  const openCount = items.length - closedCount
  const statusLabel: SewingDispatchCutOrderClosureSummary['statusLabel'] = closedCount === items.length
    ? '全部已关闭'
    : closedCount > 0
      ? '部分已关闭'
      : '未关闭'

  return {
    totalCount: items.length,
    closedCount,
    openCount,
    statusLabel,
    summary: `${closedCount}/${items.length} 个裁片单已关闭`,
    items,
  }
}

function aggregateReadinessGroup(category: SewingDispatchReadinessGroup['category'], rows: SewingDispatchWorkbenchRow[], key: 'normalPieces' | 'woolPieces' | 'auxiliaryPieces' | 'specialPieces' | 'accessories'): SewingDispatchReadinessGroup {
  const groups = rows.map((row) => row[key])
  const activeGroups = groups.filter((group) => group.statusLabel !== '不涉及')
  if (activeGroups.length === 0) {
    return {
      category,
      statusLabel: '不涉及',
      completeQty: rows.reduce((total, row) => total + row.remainingQty, 0),
      gapQty: 0,
      summary: `当前车缝任务不涉及${category}。`,
      components: [],
    }
  }

  const completeQty = activeGroups.reduce((total, group) => total + group.completeQty, 0)
  const gapQty = activeGroups.reduce((total, group) => total + group.gapQty, 0)
  const statusLabel = gapQty <= 0 ? '已齐套' : completeQty > 0 ? '部分齐套' : '有缺口'
  const activeSkuCount = activeGroups.length
  const gapSkuCount = activeGroups.filter((group) => group.gapQty > 0).length

  return {
    category,
    statusLabel,
    completeQty,
    gapQty,
    summary: statusLabel === '已齐套'
      ? `${activeSkuCount} 个 SKU 的${category}已齐套。`
      : `${gapSkuCount} 个 SKU 的${category}有缺口。`,
    components: activeGroups.flatMap((group) => group.components as SewingDispatchPieceComponent[]),
  }
}

function uniqueMarkerRisks(rows: SewingDispatchWorkbenchRow[]): SewingDispatchMarkerRisk[] {
  const map = new Map<string, SewingDispatchMarkerRisk>()
  rows.flatMap((row) => row.markerRisks).forEach((risk) => {
    const key = risk.markerPlanNo || risk.sourceCutOrderNos.join('|')
    if (!map.has(key)) map.set(key, risk)
  })
  return Array.from(map.values())
}

function buildTaskDecisionHint(task: Pick<SewingDispatchWorkbenchTask, 'completeKitQty' | 'remainingQty' | 'gapTypes' | 'cutOrderClosure'>): string {
  if (task.completeKitQty <= 0) return '当前车缝任务没有完整齐套数量，请先跟进缺口。'
  if (task.cutOrderClosure.openCount > 0) return `已有 ${task.completeKitQty} 件完整齐套，但仍有 ${task.cutOrderClosure.openCount} 个裁片单未关闭，分配前需确认是否允许先发。`
  if (task.completeKitQty < task.remainingQty) return '存在部分完整齐套数量，跟单可按 SKU / 颜色 / 尺码拆分分配。'
  return '当前车缝任务已完整齐套，裁片单闭环可作为分配参考。'
}

function buildWorkbenchTask(taskRows: SewingDispatchWorkbenchRow[]): SewingDispatchWorkbenchTask | null {
  const first = taskRows[0]
  if (!first) return null
  const order = productionOrders.find((item) => item.productionOrderId === first.productionOrderId)
  if (!order) return null
  const normalPieces = aggregateReadinessGroup('普通裁片', taskRows, 'normalPieces')
  const woolPieces = aggregateReadinessGroup('毛织片', taskRows, 'woolPieces')
  const auxiliaryPieces = aggregateReadinessGroup('辅助工艺裁片', taskRows, 'auxiliaryPieces')
  const specialPieces = aggregateReadinessGroup('特种工艺裁片', taskRows, 'specialPieces')
  const accessories = aggregateReadinessGroup('辅料', taskRows, 'accessories')
  const rowBase = { normalPieces, woolPieces, auxiliaryPieces, specialPieces, accessories }
  const gapTypes = collectGapTypes(rowBase)
  const completeKitQty = taskRows.reduce((total, row) => total + row.completeKitQty, 0)
  const remainingQty = taskRows.reduce((total, row) => total + row.remainingQty, 0)
  const cutOrderClosure = buildCutOrderClosureSummary(order)
  const markerRisks = uniqueMarkerRisks(taskRows)
  const workbenchTask: SewingDispatchWorkbenchTask = {
    taskId: first.taskId,
    taskNo: first.taskNo,
    productionOrderId: first.productionOrderId,
    productionOrderNo: first.productionOrderNo,
    spuCode: first.spuCode,
    spuName: first.spuName,
    styleImageUrl: first.styleImageUrl,
    assignmentStatusLabel: first.assignmentStatusLabel,
    mainFactoryStatusLabel: first.mainFactoryStatusLabel,
    skuRows: taskRows,
    skuCount: taskRows.length,
    demandQty: taskRows.reduce((total, row) => total + row.demandQty, 0),
    assignedQty: taskRows.reduce((total, row) => total + row.assignedQty, 0),
    remainingQty,
    completeKitQty,
    completeSkuCount: taskRows.filter((row) => row.kitStatus === '已齐套').length,
    gapSkuCount: taskRows.filter((row) => row.kitStatus !== '已齐套').length,
    kitStatus: completeKitQty >= remainingQty && remainingQty > 0 ? '已齐套' : '有缺口',
    normalPieces,
    woolPieces,
    auxiliaryPieces,
    specialPieces,
    accessories,
    markerRisks,
    cutOrderClosure,
    gapTypes,
    gapSummary: gapTypes.length > 0 ? gapTypes.join('、') : '无缺口',
    decisionHint: '',
  }
  workbenchTask.decisionHint = buildTaskDecisionHint(workbenchTask)
  return workbenchTask
}

export function listSewingDispatchWorkbenchRows(): SewingDispatchWorkbenchRow[] {
  return listRuntimeProcessTasks()
    .filter((task) => isRuntimeTaskExecutionTask(task) && isRuntimeIndependentSewingTask(task))
    .flatMap((task) => {
      const order = getOrder(task)
      if (!order) return []
      return getTaskSkuLines(task, order).map((skuLine) => buildWorkbenchRow(task, order, skuLine))
    })
    .filter((row) => row.remainingQty > 0)
    .sort((left, right) =>
      `${left.productionOrderNo}-${left.skuCode}`.localeCompare(`${right.productionOrderNo}-${right.skuCode}`, 'zh-CN'),
    )
}

export function listSewingDispatchWorkbenchTasks(): SewingDispatchWorkbenchTask[] {
  const grouped = new Map<string, SewingDispatchWorkbenchRow[]>()
  listSewingDispatchWorkbenchRows().forEach((row) => {
    const list = grouped.get(row.taskId) || []
    list.push(row)
    grouped.set(row.taskId, list)
  })

  return Array.from(grouped.values())
    .map((rows) => buildWorkbenchTask(rows.sort((left, right) => left.skuCode.localeCompare(right.skuCode, 'zh-CN'))))
    .filter((task): task is SewingDispatchWorkbenchTask => Boolean(task))
    .sort((left, right) => `${left.productionOrderNo}-${left.taskNo}`.localeCompare(`${right.productionOrderNo}-${right.taskNo}`, 'zh-CN'))
}

export function getSewingDispatchWorkbenchTask(taskId: string): SewingDispatchWorkbenchTask | null {
  return listSewingDispatchWorkbenchTasks().find((task) => task.taskId === taskId) ?? null
}

export function getSewingDispatchWorkbenchRow(rowId: string): SewingDispatchWorkbenchRow | null {
  return listSewingDispatchWorkbenchRows().find((row) => row.rowId === rowId) ?? null
}

export function summarizeSewingDispatchWorkbench(tasks: SewingDispatchWorkbenchTask[] = listSewingDispatchWorkbenchTasks()): SewingDispatchWorkbenchSummary {
  const rows = tasks.flatMap((task) => task.skuRows)
  return {
    pendingTaskCount: tasks.length,
    skuRowCount: rows.length,
    completeKitQtyTotal: tasks.reduce((total, task) => total + task.completeKitQty, 0),
    completeSkuCount: rows.filter((row) => row.kitStatus === '已齐套').length,
    gapSkuCount: rows.filter((row) => row.kitStatus !== '已齐套').length,
    crossMarkerPlanCount: tasks.filter((task) => task.markerRisks.some((risk) => risk.isCrossProductionOrder)).length,
    cutOrderClosedTaskCount: tasks.filter((task) => task.cutOrderClosure.statusLabel === '全部已关闭').length,
  }
}

export function listSewingFactoryOptions(): Array<{ id: string; name: string }> {
  return listFactoryMasterRecords()
    .filter((factory) =>
      factory.factoryType === 'THIRD_SEWING' ||
      factory.processAbilities.some((ability) => ability.processCode === 'SEW'),
    )
    .map((factory) => ({ id: factory.id, name: factory.name }))
}

export function createSewingDispatchWorkbenchDraft(input: {
  actionType: '直接派单' | '发起竞价'
  factoryId?: string
  factoryName?: string
  rowIds: string[]
  qtyByRowId?: Record<string, number>
  businessAssignedAt?: string
  operatedAt?: string
  mainFactoryIdByProductionOrderId?: Record<string, string>
  by: string
}): { ok: boolean; message: string; draft?: SewingDispatchDraft; runtimeTaskIds?: string[] } {
  const rows = input.rowIds.map((rowId) => getSewingDispatchWorkbenchRow(rowId)).filter((row): row is SewingDispatchWorkbenchRow => Boolean(row))
  if (rows.length === 0) return { ok: false, message: '请先选择要分配的 SKU。' }
  if (input.actionType === '直接派单' && (!input.factoryId || !input.factoryName)) {
    return { ok: false, message: '直接派单需要选择车缝工厂。' }
  }
  if (input.actionType === '直接派单' && input.factoryId) {
    const rating = getThirdPartyFactoryRatingSnapshot(input.factoryId)
    if (rating?.cooperationStatusLabel === '黑名单') return { ok: false, message: '该工厂已拉黑，不能派单。请更换工厂。' }
    if (rating?.cooperationStatusLabel === '考核中') return { ok: false, message: '该工厂还在试用期，只能接试产单。' }
  }
  const overRisk = rows.find((row) => row.completeKitQty <= 0)
  if (overRisk) return { ok: false, message: `${overRisk.skuCode} 完整齐套数量为 0，不能生成分配。` }
  const overQtyRow = rows.find((row) => {
    const qty = input.qtyByRowId?.[row.rowId] ?? row.completeKitQty
    return qty <= 0 || qty > row.completeKitQty || qty > row.remainingQty
  })
  if (overQtyRow) return { ok: false, message: `${overQtyRow.skuCode} 分配数量必须大于 0，且不能超过完整齐套数量和待分配数量。` }
  const operatedAt = input.operatedAt ?? formatOperationLocalWallClock()
  const businessAssignedAt = input.businessAssignedAt ?? operatedAt
  if (compareSewingDeliveryDateTimes(businessAssignedAt, operatedAt) > 0) {
    return { ok: false, message: '业务分配时间不能晚于当前操作时间' }
  }
  const rowsByTask = new Map<string, SewingDispatchWorkbenchRow[]>()
  rows.forEach((row) => rowsByTask.set(row.taskId, [...(rowsByTask.get(row.taskId) ?? []), row]))

  try {
    return runSewingDispatchWorkbenchTransaction(() => {
      const mainFactoryIdByOrder = new Map<string, string>()
      if (input.actionType === '直接派单') {
        for (const productionOrderId of new Set(rows.map((row) => row.productionOrderId))) {
          const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
          if (!order) throw new Error(`生产单 ${productionOrderId} 不存在`)
          const activeFactories = listProductionOrderSewingFactories(productionOrderId)
          const candidates = [...activeFactories, { id: input.factoryId!, name: input.factoryName! }]
            .filter((factory, index, list) => list.findIndex((item) => item.id === factory.id) === index)
          const currentMainValid = order.mainFactoryStatus === 'CONFIRMED'
            && Boolean(order.mainFactoryId)
            && candidates.some((factory) => factory.id === order.mainFactoryId)
          const explicitMainFactoryId = input.mainFactoryIdByProductionOrderId?.[productionOrderId]?.trim()
          if (explicitMainFactoryId && !candidates.some((factory) => factory.id === explicitMainFactoryId)) {
            throw new Error(`${order.productionOrderNo} 选择的主工厂不在本次有效车缝候选中`)
          }
          if (explicitMainFactoryId) mainFactoryIdByOrder.set(productionOrderId, explicitMainFactoryId)
          else if (currentMainValid && order.mainFactoryId) mainFactoryIdByOrder.set(productionOrderId, order.mainFactoryId)
          else if (candidates.length === 1) mainFactoryIdByOrder.set(productionOrderId, candidates[0].id)
          else throw new Error(`${order.productionOrderNo} 当前没有有效主工厂且有多个车缝候选，请按生产单明确选择主工厂`)
        }
      }
      const runtimeTaskIds: string[] = []
      const tenderIds: string[] = []
      for (const [taskId, taskRows] of rowsByTask.entries()) {
        const allocated = allocateRuntimeSewingTaskScope({
          taskId,
          lines: taskRows.map((row) => ({ skuCode: row.skuCode, qty: input.qtyByRowId?.[row.rowId] ?? row.completeKitQty })),
          by: input.by,
          operatedAt,
        })
        runtimeTaskIds.push(allocated.taskId)
        if (input.actionType === '直接派单') {
          const acceptanceSla = resolveDispatchAcceptanceSlaForTask(allocated, input.factoryId!, input.factoryName!, businessAssignedAt)
          if (acceptanceSla.ruleSource === 'UNCONFIGURED') throw new Error(acceptanceSla.missingReason ?? '当前车缝工序工艺未配置接单时效。')
          const updated = applyRuntimeDirectDispatchMeta({
            taskId: allocated.taskId,
            factoryId: input.factoryId!,
            factoryName: input.factoryName!,
            acceptDeadline: buildDispatchAcceptanceDeadline(businessAssignedAt, acceptanceSla),
            taskDeadline: allocated.taskDeadline || addDays(businessAssignedAt, 9),
            remark: '车缝分配工作台直接派单',
            by: input.by,
            businessAssignedAt,
            operatedAt,
            dispatchedAt: operatedAt,
            autoAccept: true,
            acceptanceSla,
            dispatchPrice: allocated.dispatchPrice ?? allocated.standardPrice ?? 0,
            dispatchPriceCurrency: allocated.dispatchPriceCurrency ?? allocated.standardPriceCurrency ?? 'IDR',
            dispatchPriceUnit: allocated.dispatchPriceUnit ?? allocated.standardPriceUnit ?? '件',
            priceDiffReason: '',
            writeBackMainFactory: false,
          })
          if (!updated) throw new Error(`任务 ${allocated.taskId} 直接派单提交失败。`)
        } else {
          const tenderId = `TENDER-${allocated.taskId}-${operatedAt.replace(/\D/g, '')}`
          const updated = upsertRuntimeTaskTender(allocated.taskId, {
            tenderId,
            biddingDeadline: addDays(operatedAt, 1),
            taskDeadline: allocated.taskDeadline || addDays(operatedAt, 9),
            businessAssignedAt,
            assignmentOperatedAt: operatedAt,
          }, input.by)
          if (!updated) throw new Error(`任务 ${allocated.taskId} 发起竞价失败。`)
          tenderIds.push(tenderId)
        }
      }
      for (const [productionOrderId, mainFactoryId] of mainFactoryIdByOrder.entries()) {
        const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
        if (order?.mainFactoryStatus === 'CONFIRMED' && order.mainFactoryId === mainFactoryId) continue
        const selected = selectProductionOrderMainFactory({ productionOrderId, factoryId: mainFactoryId, by: input.by, at: operatedAt, reason: '车缝分配工作台按生产单明确主工厂。' })
        if (!selected) throw new Error(`${order?.productionOrderNo ?? productionOrderId} 主工厂选择失败`)
      }
      const draft: SewingDispatchDraft = {
        draftId: `SEW-DRAFT-${String(sewingDispatchDrafts.length + 1).padStart(4, '0')}`,
        createdAt: operatedAt,
        createdBy: input.by,
        actionType: input.actionType,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        rowIds: rows.map((row) => row.rowId),
        skuSummary: rows.map((row) => row.skuCode).join('、'),
        qty: rows.reduce((total, row) => total + (input.qtyByRowId?.[row.rowId] ?? row.completeKitQty), 0),
        statusLabel: input.actionType === '直接派单' ? '直接派单已生效并自动接单' : '竞价已发起，待定标后工厂确认接单',
        runtimeTaskIds,
        tenderIds,
      }
      sewingDispatchDrafts.unshift(draft)
      return { ok: true, message: draft.statusLabel, draft, runtimeTaskIds }
    })
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '车缝工作台分配失败。' }
  }
}

export function listSewingDispatchWorkbenchDrafts(): SewingDispatchDraft[] {
  return sewingDispatchDrafts.map((draft) => ({
    ...draft,
    rowIds: [...draft.rowIds],
    runtimeTaskIds: [...draft.runtimeTaskIds],
    tenderIds: [...draft.tenderIds],
  }))
}
