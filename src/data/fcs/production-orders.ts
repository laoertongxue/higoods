import { indonesiaFactories, type IndonesiaFactory } from './indonesia-factories.ts'
import {
  KOL_GOTO_FACTORY_CODE,
  KOL_GOTO_FACTORY_ID,
  KOL_GOTO_FACTORY_NAME,
} from './factory-mock-data.ts'
import type { ProductionDemand, ProductionSaleType } from './production-demands.ts'
import {
  buildProductionOrderDemandSnapshot,
  validateDemandTechPackOrderLink,
} from './production-upstream-chain.ts'
import {
  buildProductionOrderTechPackSnapshot,
  cloneProductionOrderTechPackSnapshot,
} from './production-tech-pack-snapshot-builder.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'WAIT_TECH_PACK_RELEASE'
  | 'READY_FOR_BREAKDOWN'
  | 'WAIT_ASSIGNMENT'
  | 'ASSIGNING'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD'

export type OwnerPartyType = 'FACTORY' | 'LEGAL_ENTITY'
export type TechPackStatus = 'MISSING' | 'BETA' | 'RELEASED'
export type AssignmentProgressStatus = 'NOT_READY' | 'PENDING' | 'IN_PROGRESS' | 'DONE'
export type MainFactoryStatus = 'PENDING_SEWING_ASSIGNMENT' | 'CONFIRMED'
export type MainFactorySource = 'ORDER_CREATE' | 'SEWING_TASK_ASSIGNMENT'

export type RiskFlag =
  | 'TECH_PACK_NOT_RELEASED'
  | 'TECH_PACK_MISSING'
  | 'MAIN_FACTORY_BLACKLISTED'
  | 'MAIN_FACTORY_SUSPENDED'
  | 'TENDER_OVERDUE'
  | 'TENDER_NEAR_DEADLINE'
  | 'DISPATCH_REJECTED'
  | 'DISPATCH_ACK_OVERDUE'
  | 'OWNER_ADJUSTED'
  | 'DELIVERY_DATE_NEAR'
  | 'HANDOVER_DIFF'
  | 'HANDOVER_PENDING'

export interface AuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface FactorySnapshot {
  id: string
  code: string
  name: string
  tier: string
  type: string
  status: string
  province: string
  city: string
  tags: string[]
}

export interface DemandSnapshot {
  demandId: string
  spuCode: string
  spuName: string
  buyerName: string
  merchandiserName: string
  saleType: ProductionSaleType
  priority: string
  requiredDeliveryDate: string | null
  constraintsNote: string
  skuLines: Array<{
    skuCode: string
    size: string
    color: string
    qty: number
  }>
}

export interface AssignmentSummary {
  directCount: number
  biddingCount: number
  totalTasks: number
  unassignedCount: number
}

export interface AssignmentProgress {
  status: AssignmentProgressStatus
  directAssignedCount: number
  biddingLaunchedCount: number
  biddingAwardedCount: number
}

export interface BiddingSummary {
  activeTenderCount: number
  nearestDeadline?: string
  overdueTenderCount: number
}

export interface DirectDispatchSummary {
  assignedFactoryCount: number
  rejectedCount: number
  overdueAckCount: number
}

export interface TaskBreakdownSummary {
  isBrokenDown: boolean
  taskTypesTop3: string[]
  lastBreakdownAt?: string
  lastBreakdownBy?: string
  generationRuleId?: string
  generationRuleName?: string
  generatedTaskUnitCount?: number
  singleProcessTaskCount?: number
  independentWorkOrderTaskCount?: number
  independentRequirementCount?: number
  independentWorkOrderCount?: number
  combinedProcessTaskCount?: number
  wholeOrderTaskCount?: number
  coveredProcessNames?: string[]
  previewStatus?: 'READY' | 'NEED_CONFIRM' | 'BLOCKED' | 'NO_MATCH_USE_DEFAULT'
}

export interface MaterialIssueRow {
  materialType: string
  materialName: string
  materialSku: string
  requiredQty: string
  purchasedQty: string
  arrivedQty: string
  preparedQty: string
  issuedQty: string
  factorySignedQty: string
  shortageQty: string
  expectedArrival: string
  status: string
}

export interface TaskFactoryRow {
  taskType: string
  taskNo: string
  factory: string
  factoryType: string
  status: string
  plannedDoneAt: string
  actualDoneAt: string
  completedQty: string
  issue: string
  action: string
}

export interface KeyTimeRow {
  nodeType: string
  plannedAt: string
  actualAt: string
  status: string
  sourceDoc: string
  note: string
}

export interface QuantityQualityRow {
  quantityType: string
  plannedQty: string
  currentQty: string
  unit: string
  diff: string
  status: string
  note: string
}

export interface ProductionLedgerDetails {
  materialIssues: MaterialIssueRow[]
  taskFactories: TaskFactoryRow[]
  keyTimes: KeyTimeRow[]
  quantityQuality: QuantityQualityRow[]
}

export interface ProductionOrder {
  productionOrderId: string
  productionOrderNo: string
  demandId: string
  sourceDemandIds: string[]
  legacyOrderNo: string
  status: ProductionOrderStatus
  lockedLegacy: boolean
  mainFactoryId: string
  mainFactorySnapshot: FactorySnapshot
  mainFactorySnapshots?: FactorySnapshot[]
  mainFactoryStatus: MainFactoryStatus
  mainFactorySource: MainFactorySource
  mainFactoryConfirmedAt?: string
  mainFactoryConfirmedBy?: string
  ownerPartyType: OwnerPartyType
  ownerPartyId: string
  ownerReason?: string
  deliveryWarehouseId?: string
  deliveryWarehouseName?: string
  deliveryWarehouseStatus?: 'UNSET' | 'SET'
  deliveryWarehouseRemark?: string
  deliveryWarehouseUpdatedAt?: string
  deliveryWarehouseUpdatedBy?: string
  planStartDate?: string
  planEndDate?: string
  planStatus?: 'UNPLANNED' | 'PLANNED' | 'RELEASED'
  planQty?: number
  planFactoryId?: string
  planFactoryName?: string
  planRemark?: string
  planUpdatedAt?: string
  planUpdatedBy?: string
  selectedTechPackVersionId?: string
  lifecycleStatus?: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
  lifecycleStatusRemark?: string
  lifecycleUpdatedAt?: string
  lifecycleUpdatedBy?: string
  techPackSnapshot: ProductionOrderTechPackSnapshot | null
  demandSnapshot: DemandSnapshot
  sourceDemandSnapshots: DemandSnapshot[]
  assignmentSummary: AssignmentSummary
  assignmentProgress: AssignmentProgress
  biddingSummary: BiddingSummary
  directDispatchSummary: DirectDispatchSummary
  taskBreakdownSummary: TaskBreakdownSummary
  ledgerDetails: ProductionLedgerDetails
  riskFlags: RiskFlag[]
  auditLogs: AuditLog[]
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderSeed {
  productionOrderId: string
  demandId: string
  sourceDemandIds?: string[]
  status: ProductionOrderStatus
  mainFactoryId: string
  mainFactoryStatus?: MainFactoryStatus
  mainFactorySource?: MainFactorySource
  mainFactoryConfirmedAt?: string
  mainFactoryConfirmedBy?: string
  ownerPartyType: OwnerPartyType
  ownerPartyId: string
  ownerReason?: string
  lockedLegacy?: boolean
  deliveryWarehouseId?: string
  deliveryWarehouseName?: string
  deliveryWarehouseStatus?: 'UNSET' | 'SET'
  deliveryWarehouseRemark?: string
  deliveryWarehouseUpdatedAt?: string
  deliveryWarehouseUpdatedBy?: string
  planStartDate?: string
  planEndDate?: string
  planStatus?: 'UNPLANNED' | 'PLANNED' | 'RELEASED'
  planQty?: number
  planFactoryId?: string
  planFactoryName?: string
  planRemark?: string
  planUpdatedAt?: string
  planUpdatedBy?: string
  lifecycleStatus?: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
  lifecycleStatusRemark?: string
  lifecycleUpdatedAt?: string
  lifecycleUpdatedBy?: string
  assignmentSummary: AssignmentSummary
  assignmentProgress: AssignmentProgress
  biddingSummary: BiddingSummary
  directDispatchSummary: DirectDispatchSummary
  taskBreakdownSummary: TaskBreakdownSummary
  ledgerDetails?: ProductionLedgerDetails
  riskFlags: RiskFlag[]
  auditLogs: AuditLog[]
  createdAt: string
  updatedAt: string
  techPackSnapshot?: ProductionOrderTechPackSnapshot | null
  selectedTechPackVersionId?: string
  snapshotAt?: string
  snapshotBy?: string
}

export const PENDING_MAIN_FACTORY_ID = 'PENDING-SEWING-MAIN-FACTORY'

export function createFactorySnapshot(factory: IndonesiaFactory): FactorySnapshot {
  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    tier: factory.tier,
    type: factory.type,
    status: factory.status,
    province: factory.province,
    city: factory.city,
    tags: [...factory.tags],
  }
}

function createKolGotoFactorySnapshot(): FactorySnapshot {
  return {
    id: KOL_GOTO_FACTORY_ID,
    code: KOL_GOTO_FACTORY_CODE,
    name: KOL_GOTO_FACTORY_NAME,
    tier: 'CENTRAL',
    type: 'CENTRAL_FACTORY',
    status: 'ACTIVE',
    province: 'DKI Jakarta',
    city: 'Jakarta',
    tags: ['KOL整单', '样衣', '小单'],
  }
}

function resolveProductionOrderFactorySnapshot(factoryId: string): FactorySnapshot | null {
  if (factoryId === KOL_GOTO_FACTORY_ID) return createKolGotoFactorySnapshot()
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  return factory ? createFactorySnapshot(factory) : null
}

export function createPendingMainFactorySnapshot(): FactorySnapshot {
  return {
    id: PENDING_MAIN_FACTORY_ID,
    code: '待定',
    name: '待车缝任务分配确定',
    tier: 'PENDING',
    type: 'SEWING',
    status: '待指定',
    province: '-',
    city: '-',
    tags: ['车缝任务分配后回写'],
  }
}

export function isProductionOrderMainFactoryPending(order: Pick<ProductionOrder, 'mainFactoryId' | 'mainFactoryStatus'>): boolean {
  return order.mainFactoryStatus === 'PENDING_SEWING_ASSIGNMENT' || order.mainFactoryId === PENDING_MAIN_FACTORY_ID
}

export function formatProductionOrderMainFactoryName(order: Pick<ProductionOrder, 'mainFactorySnapshot' | 'mainFactorySnapshots' | 'mainFactoryId' | 'mainFactoryStatus'>): string {
  if (isProductionOrderMainFactoryPending(order)) return '待车缝任务分配确定'
  const snapshots = order.mainFactorySnapshots?.length ? order.mainFactorySnapshots : [order.mainFactorySnapshot]
  return Array.from(new Set(snapshots.map((factory) => factory.name).filter(Boolean))).join('、') || order.mainFactorySnapshot.name
}

export function cloneProductionLedgerDetails(details: ProductionLedgerDetails): ProductionLedgerDetails {
  return {
    materialIssues: details.materialIssues.map((row) => ({ ...row })),
    taskFactories: details.taskFactories.map((row) => ({ ...row })),
    keyTimes: details.keyTimes.map((row) => ({ ...row })),
    quantityQuality: details.quantityQuality.map((row) => ({ ...row })),
  }
}

function buildDefaultProductionLedgerDetails(seed: ProductionOrderSeed, demand: ProductionDemand, factoryName: string): ProductionLedgerDetails {
  const plannedQty = String(demand.skuLines.reduce((sum, sku) => sum + sku.qty, 0) || demand.requiredQtyTotal || 600)
  const orderNo = seed.productionOrderId.replace('PO-', '')
  const planDoneAt = seed.planEndDate || demand.requiredDeliveryDate || '2026-07-04'
  return {
    materialIssues: [
      {
        materialType: '面料',
        materialName: `${demand.spuName} 主面料`,
        materialSku: `${demand.spuCode}-FAB`,
        requiredQty: `${plannedQty} yd`,
        purchasedQty: `${plannedQty} yd`,
        arrivedQty: `${plannedQty} yd`,
        preparedQty: `${plannedQty} yd`,
        issuedQty: '0 yd',
        factorySignedQty: '0 yd',
        shortageQty: '0 yd',
        expectedArrival: '-',
        status: '已配料待发料',
      },
    ],
    taskFactories: [
      {
        taskType: seed.taskBreakdownSummary.taskTypesTop3[0] || '生产',
        taskNo: `TASK-${orderNo}`,
        factory: factoryName,
        factoryType: '主工厂',
        status: seed.assignmentProgress.status === 'DONE' ? '已完成' : '等待处理',
        plannedDoneAt: planDoneAt,
        actualDoneAt: seed.assignmentProgress.status === 'DONE' ? planDoneAt : '-',
        completedQty: seed.assignmentProgress.status === 'DONE' ? plannedQty : '0',
        issue: seed.assignmentProgress.status === 'DONE' ? '-' : '等待处理',
        action: '查看',
      },
    ],
    keyTimes: [
      { nodeType: '生产单生成', plannedAt: '-', actualAt: seed.createdAt.slice(0, 10), status: '已完成', sourceDoc: seed.productionOrderId, note: '生产单创建' },
      { nodeType: '预计完成', plannedAt: planDoneAt, actualAt: '-', status: seed.status === 'COMPLETED' ? '已完成' : '未完成', sourceDoc: '-', note: '当前预计完成' },
    ],
    quantityQuality: [
      { quantityType: '生产计划', plannedQty, currentQty: plannedQty, unit: '件', diff: '0', status: '正常', note: '生产单计划数量' },
      { quantityType: '质检通过入库', plannedQty, currentQty: seed.status === 'COMPLETED' ? plannedQty : '0', unit: '件', diff: seed.status === 'COMPLETED' ? '0' : `-${plannedQty}`, status: seed.status === 'COMPLETED' ? '正常' : '未入库', note: seed.status === 'COMPLETED' ? '已完成入库' : '未完成入库' },
    ],
  }
}

function buildProductionOrderFromResolvedUpstream(
  seed: ProductionOrderSeed,
  demand: ProductionDemand,
  techPackSnapshot: ProductionOrderTechPackSnapshot | null,
): ProductionOrder {
  const factorySnapshot = resolveProductionOrderFactorySnapshot(seed.mainFactoryId)
  const isPendingFactory = seed.mainFactoryStatus === 'PENDING_SEWING_ASSIGNMENT' || seed.mainFactoryId === PENDING_MAIN_FACTORY_ID
  if (!factorySnapshot && !isPendingFactory) {
    throw new Error(`生产单 ${seed.productionOrderId} 绑定的主工厂 ${seed.mainFactoryId} 不存在`)
  }
  const demandSnapshot = buildProductionOrderDemandSnapshot(demand)

  const ledgerDetails = seed.ledgerDetails ?? buildDefaultProductionLedgerDetails(seed, demand, (factorySnapshot ?? createPendingMainFactorySnapshot()).name)
  return {
    ...seed,
    productionOrderNo: seed.productionOrderId,
    sourceDemandIds: seed.sourceDemandIds ?? [seed.demandId],
    lockedLegacy:
      seed.lockedLegacy ?? ['EXECUTING', 'COMPLETED', 'CANCELLED'].includes(seed.status),
    mainFactorySnapshot: factorySnapshot ?? createPendingMainFactorySnapshot(),
    mainFactorySnapshots: factorySnapshot ? [factorySnapshot] : [],
    mainFactoryStatus: seed.mainFactoryStatus ?? 'CONFIRMED',
    mainFactorySource: seed.mainFactorySource ?? 'ORDER_CREATE',
    mainFactoryConfirmedAt: seed.mainFactoryConfirmedAt,
    mainFactoryConfirmedBy: seed.mainFactoryConfirmedBy,
    legacyOrderNo: demand.legacyOrderNo,
    demandSnapshot,
    sourceDemandSnapshots: [demandSnapshot],
    techPackSnapshot: cloneProductionOrderTechPackSnapshot(techPackSnapshot),
    ledgerDetails: cloneProductionLedgerDetails(ledgerDetails),
  }
}

export function buildProductionOrderFromSeed(seed: ProductionOrderSeed): ProductionOrder {
  const validation = validateDemandTechPackOrderLink({
    productionOrderId: seed.productionOrderId,
    demandId: seed.demandId,
    snapshotAt: seed.snapshotAt ?? seed.updatedAt,
    snapshotBy: seed.snapshotBy || '系统初始化',
  })

  if (!validation.ok || !validation.demand || !validation.techPackSnapshot) {
    throw new Error(
      [`生产单 ${seed.productionOrderId} 上游链非法`, ...validation.issues.map((item) => item.message)].join('；'),
    )
  }

  return buildProductionOrderFromResolvedUpstream(seed, validation.demand, validation.techPackSnapshot)
}

export function buildProductionOrderFromDemand(
  seed: ProductionOrderSeed,
  demand: ProductionDemand,
  snapshotBy: string,
): ProductionOrder {
  if (seed.demandId !== demand.demandId) {
    throw new Error(`生产单 ${seed.productionOrderId} 与需求 ${demand.demandId} 绑定不一致`)
  }

  const techPackSnapshot = buildProductionOrderTechPackSnapshot({
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderId,
    demand,
    snapshotAt: seed.snapshotAt ?? seed.updatedAt,
    snapshotBy,
    technicalVersionId: seed.selectedTechPackVersionId,
  })

  return buildProductionOrderFromResolvedUpstream(seed, demand, techPackSnapshot)
}

function resolveMergedPriority(demands: ProductionDemand[]): string {
  const weights: Record<string, number> = { NORMAL: 1, HIGH: 2, URGENT: 3 }
  return demands
    .map((demand) => demand.priority)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0] ?? 'NORMAL'
}

function resolveMergedDeliveryDate(demands: ProductionDemand[]): string | null {
  return demands
    .map((demand) => demand.requiredDeliveryDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null
}

function buildMergedProductionOrderDemandSnapshot(demands: ProductionDemand[]): DemandSnapshot {
  const primary = demands[0]
  const sameSpu = demands.every((demand) => demand.spuCode === primary.spuCode)
  const skuMap = new Map<string, DemandSnapshot['skuLines'][number]>()

  for (const demand of demands) {
    for (const line of demand.skuLines) {
      const key = `${line.skuCode}::${line.size}::${line.color}`
      const current = skuMap.get(key)
      if (current) {
        current.qty += line.qty
      } else {
        skuMap.set(key, { ...line })
      }
    }
  }

  const demandIds = demands.map((demand) => demand.demandId)
  const buyerNames = Array.from(new Set(demands.map((demand) => demand.buyerName).filter(Boolean)))
  const merchandiserNames = Array.from(new Set(demands.map((demand) => demand.merchandiserName).filter(Boolean)))
  const saleTypes = Array.from(new Set(demands.map((demand) => demand.saleType).filter(Boolean)))

  return {
    demandId: demands.length === 1 ? primary.demandId : demandIds.join('、'),
    spuCode: sameSpu ? primary.spuCode : '多款合并',
    spuName: sameSpu ? primary.spuName : '多款合并生产单',
    buyerName: buyerNames.join('、') || '待指定买手',
    merchandiserName: merchandiserNames.join('、') || '待指定跟单',
    saleType: saleTypes.length === 1 ? saleTypes[0] : '预售备货',
    priority: resolveMergedPriority(demands),
    requiredDeliveryDate: resolveMergedDeliveryDate(demands),
    constraintsNote: '',
    skuLines: [...skuMap.values()],
  }
}

export function buildProductionOrderFromDemands(
  seed: ProductionOrderSeed,
  demands: ProductionDemand[],
  snapshotBy: string,
): ProductionOrder {
  if (demands.length === 0) {
    throw new Error(`生产单 ${seed.productionOrderId} 未选择生产需求`)
  }

  const primaryDemand = demands[0]
  if (!demands.some((demand) => demand.demandId === seed.demandId)) {
    throw new Error(`生产单 ${seed.productionOrderId} 主需求 ${seed.demandId} 不在合并需求中`)
  }

  const techPackSnapshot = buildProductionOrderTechPackSnapshot({
    productionOrderId: seed.productionOrderId,
    productionOrderNo: seed.productionOrderId,
    demand: primaryDemand,
    snapshotAt: seed.snapshotAt ?? seed.updatedAt,
    snapshotBy,
    technicalVersionId: seed.selectedTechPackVersionId,
  })

  const factorySnapshot = resolveProductionOrderFactorySnapshot(seed.mainFactoryId)
  const isPendingFactory = seed.mainFactoryStatus === 'PENDING_SEWING_ASSIGNMENT' || seed.mainFactoryId === PENDING_MAIN_FACTORY_ID
  if (!factorySnapshot && !isPendingFactory) {
    throw new Error(`生产单 ${seed.productionOrderId} 绑定的主工厂 ${seed.mainFactoryId} 不存在`)
  }

  const demandSnapshots = demands.map((demand) => buildProductionOrderDemandSnapshot(demand))
  const demandSnapshot = buildMergedProductionOrderDemandSnapshot(demands)
  const ledgerDetails = seed.ledgerDetails ?? buildDefaultProductionLedgerDetails(seed, primaryDemand, (factorySnapshot ?? createPendingMainFactorySnapshot()).name)

  return {
    ...seed,
    productionOrderNo: seed.productionOrderId,
    sourceDemandIds: demands.map((demand) => demand.demandId),
    lockedLegacy: seed.lockedLegacy ?? false,
    mainFactorySnapshot: factorySnapshot ?? createPendingMainFactorySnapshot(),
    mainFactorySnapshots: factorySnapshot ? [factorySnapshot] : [],
    mainFactoryStatus: seed.mainFactoryStatus ?? 'CONFIRMED',
    mainFactorySource: seed.mainFactorySource ?? 'ORDER_CREATE',
    mainFactoryConfirmedAt: seed.mainFactoryConfirmedAt,
    mainFactoryConfirmedBy: seed.mainFactoryConfirmedBy,
    legacyOrderNo: demands.map((demand) => demand.legacyOrderNo).join('、'),
    demandSnapshot,
    sourceDemandSnapshots: demandSnapshots,
    techPackSnapshot: cloneProductionOrderTechPackSnapshot(techPackSnapshot),
    ledgerDetails: cloneProductionLedgerDetails(ledgerDetails),
  }
}

export function confirmProductionOrderMainFactoryFromSewingTask(input: {
  productionOrderId: string
  factoryId: string
  factoryName?: string
  by: string
  at?: string
}): ProductionOrder | null {
  const order = productionOrders.find((item) => item.productionOrderId === input.productionOrderId)
  if (!order) return null

  const factory = indonesiaFactories.find((item) => item.id === input.factoryId)
  if (!factory) return null

  const at = input.at ?? new Date().toISOString().replace('T', ' ').slice(0, 19)
  const isPendingMainFactory = isProductionOrderMainFactoryPending(order)
  const nextFactorySnapshot = createFactorySnapshot(factory)
  const currentSnapshots = order.mainFactorySnapshots?.length
    ? [...order.mainFactorySnapshots]
    : isPendingMainFactory
      ? []
      : [order.mainFactorySnapshot]
  const alreadyRecorded = currentSnapshots.some((item) => item.id === factory.id)
  if (alreadyRecorded && !isPendingMainFactory) return order
  if (!alreadyRecorded) currentSnapshots.push(nextFactorySnapshot)
  order.mainFactorySnapshots = currentSnapshots

  if (isPendingMainFactory) {
    order.mainFactoryId = factory.id
    order.mainFactorySnapshot = nextFactorySnapshot
    order.ownerPartyType = 'FACTORY'
    order.ownerPartyId = factory.id
  }
  order.mainFactoryStatus = 'CONFIRMED'
  order.mainFactorySource = 'SEWING_TASK_ASSIGNMENT'
  order.mainFactoryConfirmedAt = at
  order.mainFactoryConfirmedBy = input.by
  order.ownerReason = currentSnapshots.length > 1
    ? `车缝任务分配确认多个主工厂：${formatProductionOrderMainFactoryName(order)}。`
    : '车缝任务分配确认主工厂，生产单货权归该车缝工厂。'
  order.updatedAt = at
  order.auditLogs.push(
    createAuditLog(
      `LOG-MAIN-FACTORY-${order.productionOrderId}-${order.auditLogs.length + 1}`,
      alreadyRecorded ? 'MAIN_FACTORY_CONFIRMED' : currentSnapshots.length > 1 ? 'MAIN_FACTORY_APPENDED' : 'MAIN_FACTORY_CONFIRMED',
      currentSnapshots.length > 1
        ? `车缝任务分配给 ${input.factoryName || factory.name}，已追加为生产单主工厂；当前主工厂：${formatProductionOrderMainFactoryName(order)}`
        : `车缝任务分配给 ${input.factoryName || factory.name}，已回写为生产单主工厂和货权归属工厂`,
      at,
      input.by,
    ),
  )

  return order
}

export function getProductionOrderTechPackSnapshot(orderId: string): ProductionOrderTechPackSnapshot | null {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return cloneProductionOrderTechPackSnapshot(order?.techPackSnapshot ?? null)
}

function createAuditLog(id: string, action: string, detail: string, at: string, by: string): AuditLog {
  return { id, action, detail, at, by }
}

const productionOrderSeeds: ProductionOrderSeed[] = [
  {
    productionOrderId: 'PO-202603-0001',
    demandId: 'DEM-202603-0004',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    ownerPartyType: 'FACTORY',
    ownerPartyId: KOL_GOTO_FACTORY_ID,
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['KOL整单任务'],
      lastBreakdownAt: '2026-03-02 16:05:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-KOL-001',
      generationRuleName: 'KOL样衣整单承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 1,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 1,
      coveredProcessNames: ['裁片', '车缝', '特殊工艺', '后道', '开扣眼', '熨烫'],
      previewStatus: 'READY',
    },
    ledgerDetails: {
      materialIssues: [
        { materialType: '面料', materialName: 'T-shirt 面料', materialSku: 'FAB-2024-001', requiredQty: '600 yd', purchasedQty: '600 yd', arrivedQty: '600 yd', preparedQty: '600 yd', issuedQty: '0 yd', factorySignedQty: '0 yd', shortageQty: '0 yd', expectedArrival: '-', status: '已配料待发料' },
        { materialType: '辅料', materialName: '拉链', materialSku: 'ZIP-2024-008', requiredQty: '600 pcs', purchasedQty: '600 pcs', arrivedQty: '0 pcs', preparedQty: '0 pcs', issuedQty: '0 pcs', factorySignedQty: '0 pcs', shortageQty: '600 pcs', expectedArrival: '2026-07-02', status: '已采购未到仓' },
        { materialType: '辅料', materialName: '纽扣', materialSku: 'BTN-2024-012', requiredQty: '600 pcs', purchasedQty: '600 pcs', arrivedQty: '600 pcs', preparedQty: '600 pcs', issuedQty: '0 pcs', factorySignedQty: '0 pcs', shortageQty: '0 pcs', expectedArrival: '-', status: '已配料待发料' },
        { materialType: '辅料', materialName: '吊牌', materialSku: 'TAG-2024-003', requiredQty: '600 pcs', purchasedQty: '0 pcs', arrivedQty: '0 pcs', preparedQty: '0 pcs', issuedQty: '0 pcs', factorySignedQty: '0 pcs', shortageQty: '600 pcs', expectedArrival: '待确认', status: '待采购' },
      ],
      taskFactories: [
        { taskType: '裁片', taskNo: 'CUT-143659', factory: 'sea cutting (59)', factoryType: '裁片厂', status: '已完成', plannedDoneAt: '2026-06-29', actualDoneAt: '2026-06-29', completedQty: '623', issue: '-', action: '查看' },
        { taskType: '打揽', taskNo: 'PROC-143660', factory: '打揽 (360)', factoryType: '工艺厂', status: '等待处理', plannedDoneAt: '2026-07-01', actualDoneAt: '-', completedQty: '0', issue: '等待工厂处理', action: '查看' },
        { taskType: '装扣子', taskNo: 'PROC-143661', factory: '待分配', factoryType: '工艺厂', status: '等待处理', plannedDoneAt: '2026-07-01', actualDoneAt: '-', completedQty: '0', issue: '任务未分配', action: '分配任务' },
        { taskType: '捆条', taskNo: 'PROC-143662', factory: 'sea cutting (59)', factoryType: '工艺厂', status: '等待处理', plannedDoneAt: '2026-07-02', actualDoneAt: '-', completedQty: '0', issue: '等待处理', action: '查看' },
        { taskType: '车缝', taskNo: 'SEW-143663', factory: 'alwi collection (504)', factoryType: '车缝厂', status: '等待处理', plannedDoneAt: '2026-07-04', actualDoneAt: '-', completedQty: '0', issue: '等待领料', action: '查看' },
        { taskType: '烫包', taskNo: 'PACK-143664', factory: 'alwi collection (504)', factoryType: '后道厂', status: '等待处理', plannedDoneAt: '2026-07-04', actualDoneAt: '-', completedQty: '0', issue: '前序未完成', action: '查看' },
        { taskType: '质检', taskNo: 'QC-143665', factory: 'alwi collection (504)', factoryType: '质检点', status: '等待处理', plannedDoneAt: '2026-07-04', actualDoneAt: '-', completedQty: '0', issue: '等待回货', action: '查看' },
      ],
      keyTimes: [
        { nodeType: '采购下单', plannedAt: '-', actualAt: '2026-06-26', status: '已完成', sourceDoc: 'PO-310776', note: '采购单创建' },
        { nodeType: '原料到仓', plannedAt: '2026-06-27', actualAt: '2026-06-27', status: '已完成', sourceDoc: 'IN-20260627-001', note: '仓库入库' },
        { nodeType: '生产单生成', plannedAt: '-', actualAt: '2026-06-27', status: '已完成', sourceDoc: 'PO-143659', note: '生产单创建' },
        { nodeType: '裁片完成', plannedAt: '2026-06-29', actualAt: '2026-06-29', status: '已完成', sourceDoc: 'CUT-143659', note: '裁片完成' },
        { nodeType: '发料给工厂', plannedAt: '2026-06-30', actualAt: '-', status: '未完成', sourceDoc: 'ISSUE-待生成', note: '仓库未发料' },
        { nodeType: '工厂签收', plannedAt: '2026-06-30', actualAt: '-', status: '未完成', sourceDoc: '-', note: '等待发料' },
        { nodeType: '开工时间', plannedAt: '2026-07-01', actualAt: '-', status: '未完成', sourceDoc: '-', note: '工厂未开工' },
        { nodeType: '预计完成', plannedAt: '2026-07-04', actualAt: '-', status: '剩余 8 天', sourceDoc: '-', note: '当前预计完成' },
        { nodeType: '回货完成', plannedAt: '2026-07-04', actualAt: '-', status: '未完成', sourceDoc: '-', note: '等待生产完成' },
        { nodeType: '质检入库', plannedAt: '2026-07-05', actualAt: '-', status: '未完成', sourceDoc: '-', note: '等待回货后质检' },
      ],
      quantityQuality: [
        { quantityType: '生产计划', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '生产单计划数量' },
        { quantityType: '裁片完成', plannedQty: '600', currentQty: '623', unit: '件', diff: '+23', status: '多裁', note: '裁片完成数量高于计划' },
        { quantityType: '已发料', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未发料', note: '仓库尚未发料' },
        { quantityType: '工厂签收', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未签收', note: '工厂未确认收料' },
        { quantityType: '回货数量', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未回货', note: '等待工厂生产' },
        { quantityType: '送检数量', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未送检', note: '未进入 QC' },
        { quantityType: 'QC 通过', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未通过', note: '未完成质检' },
        { quantityType: '瑕疵品数量', plannedQty: '-', currentQty: '0', unit: '件', diff: '-', status: '正常', note: '-' },
        { quantityType: '返工数量', plannedQty: '-', currentQty: '0', unit: '件', diff: '-', status: '正常', note: '-' },
        { quantityType: '质检通过入库', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未入库', note: '未完成入库' },
        { quantityType: '退裁片数量', plannedQty: '-', currentQty: '0', unit: '件', diff: '-', status: '正常', note: '-' },
      ],
    },
    riskFlags: [],
    auditLogs: [
      createAuditLog('LOG-001', 'CREATE', '从需求 DEM-202603-0004 生成生产单', '2026-03-02 16:00:00', 'Budi Santoso'),
      createAuditLog('LOG-001-A', 'TASK_READY', '已生成初始任务，进入待分配', '2026-03-02 16:05:00', '系统'),
    ],
    createdAt: '2026-03-02 16:00:00',
    updatedAt: '2026-03-02 16:05:00',
  },
  {
    productionOrderId: 'PO-202603-0002',
    demandId: 'DEM-202603-0005',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F004',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F004',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['后道'],
      lastBreakdownAt: '2026-03-03 15:05:00',
      lastBreakdownBy: '系统',
      generationRuleName: '默认按工序生成规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 1,
      independentWorkOrderTaskCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 0,
      coveredProcessNames: ['裁片', '特殊工艺', '后道', '开扣眼', '熨烫'],
      previewStatus: 'NO_MATCH_USE_DEFAULT',
    },
    ledgerDetails: {
      materialIssues: [
        { materialType: '面料', materialName: 'Hoodie 抓绒主面料', materialSku: 'FAB-2024-021', requiredQty: '720 yd', purchasedQty: '720 yd', arrivedQty: '720 yd', preparedQty: '720 yd', issuedQty: '720 yd', factorySignedQty: '720 yd', shortageQty: '0 yd', expectedArrival: '-', status: '工厂已签收' },
        { materialType: '辅料', materialName: '帽绳', materialSku: 'CORD-2024-006', requiredQty: '1,200 pcs', purchasedQty: '1,200 pcs', arrivedQty: '1,200 pcs', preparedQty: '1,200 pcs', issuedQty: '1,200 pcs', factorySignedQty: '1,200 pcs', shortageQty: '0 pcs', expectedArrival: '-', status: '工厂已签收' },
        { materialType: '辅料', materialName: '水洗标', materialSku: 'LBL-2024-002', requiredQty: '600 pcs', purchasedQty: '600 pcs', arrivedQty: '600 pcs', preparedQty: '600 pcs', issuedQty: '600 pcs', factorySignedQty: '600 pcs', shortageQty: '0 pcs', expectedArrival: '-', status: '工厂已签收' },
      ],
      taskFactories: [
        { taskType: '裁片', taskNo: 'CUT-143680', factory: 'PT Mulia Cutting Center', factoryType: '裁片厂', status: '已完成', plannedDoneAt: '2026-06-28', actualDoneAt: '2026-06-28', completedQty: '600', issue: '-', action: '查看' },
        { taskType: '绣花', taskNo: 'PROC-143681', factory: 'Embroidery Jaya', factoryType: '工艺厂', status: '已完成', plannedDoneAt: '2026-06-30', actualDoneAt: '2026-06-30', completedQty: '600', issue: '-', action: '查看' },
        { taskType: '车缝', taskNo: 'SEW-143682', factory: 'PT Mulia Sewing Line', factoryType: '车缝厂', status: '等待处理', plannedDoneAt: '2026-07-03', actualDoneAt: '-', completedQty: '0', issue: '等待车缝', action: '查看' },
        { taskType: '后道', taskNo: 'PACK-143683', factory: 'PT Mulia Sewing Line', factoryType: '后道厂', status: '等待处理', plannedDoneAt: '2026-07-04', actualDoneAt: '-', completedQty: '0', issue: '等待车缝完成', action: '查看' },
      ],
      keyTimes: [
        { nodeType: '采购下单', plannedAt: '-', actualAt: '2026-06-25', status: '已完成', sourceDoc: 'PO-310802', note: '采购单创建' },
        { nodeType: '原料到仓', plannedAt: '2026-06-27', actualAt: '2026-06-27', status: '已完成', sourceDoc: 'IN-20260627-018', note: '仓库入库' },
        { nodeType: '发料给工厂', plannedAt: '2026-06-29', actualAt: '2026-06-29', status: '已完成', sourceDoc: 'ISSUE-20260629-002', note: '仓库已发料' },
        { nodeType: '工厂签收', plannedAt: '2026-06-29', actualAt: '2026-06-29', status: '已完成', sourceDoc: 'SIGN-20260629-002', note: '工厂已签收' },
        { nodeType: '开工时间', plannedAt: '2026-07-01', actualAt: '-', status: '未完成', sourceDoc: '-', note: '等待车缝开工' },
        { nodeType: '预计完成', plannedAt: '2026-07-04', actualAt: '-', status: '剩余 8 天', sourceDoc: '-', note: '当前预计完成' },
      ],
      quantityQuality: [
        { quantityType: '生产计划', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '生产单计划数量' },
        { quantityType: '裁片完成', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '裁片数量匹配' },
        { quantityType: '已发料', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '已发料给工厂' },
        { quantityType: '工厂签收', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '工厂已确认收料' },
        { quantityType: '回货数量', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未回货', note: '等待车缝' },
        { quantityType: 'QC 通过', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未通过', note: '未完成质检' },
      ],
    },
    riskFlags: [],
    auditLogs: [
      createAuditLog('LOG-002', 'CREATE', '从需求 DEM-202603-0005 生成生产单', '2026-03-03 15:00:00', 'Dewi Lestari'),
      createAuditLog('LOG-002-A', 'TASK_READY', '已生成初始任务，进入待分配', '2026-03-03 15:05:00', '系统'),
    ],
    createdAt: '2026-03-03 15:00:00',
    updatedAt: '2026-03-03 15:05:00',
  },
  {
    productionOrderId: 'PO-202603-0003',
    demandId: 'DEM-202603-0009',
    status: 'ASSIGNING',
    mainFactoryId: 'ID-F003',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F003',
    planStartDate: '2026-03-05',
    planEndDate: '2026-03-21',
    assignmentSummary: { directCount: 2, biddingCount: 1, totalTasks: 3, unassignedCount: 0 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 2, biddingLaunchedCount: 1, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 1, nearestDeadline: '2026-03-06 18:00:00', overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 2, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '包装'], lastBreakdownAt: '2026-03-04 11:20:00', lastBreakdownBy: 'Ahmad Wijaya' },
    ledgerDetails: {
      materialIssues: [
        { materialType: '面料', materialName: 'Polo 珠地主面料', materialSku: 'FAB-2024-041', requiredQty: '900 yd', purchasedQty: '900 yd', arrivedQty: '540 yd', preparedQty: '540 yd', issuedQty: '0 yd', factorySignedQty: '0 yd', shortageQty: '360 yd', expectedArrival: '2026-07-01', status: '部分到仓' },
        { materialType: '辅料', materialName: '罗纹领', materialSku: 'RIB-2024-011', requiredQty: '600 pcs', purchasedQty: '600 pcs', arrivedQty: '600 pcs', preparedQty: '600 pcs', issuedQty: '0 pcs', factorySignedQty: '0 pcs', shortageQty: '0 pcs', expectedArrival: '-', status: '已配料待发料' },
        { materialType: '辅料', materialName: '包装袋', materialSku: 'BAG-2024-017', requiredQty: '600 pcs', purchasedQty: '600 pcs', arrivedQty: '0 pcs', preparedQty: '0 pcs', issuedQty: '0 pcs', factorySignedQty: '0 pcs', shortageQty: '600 pcs', expectedArrival: '2026-07-03', status: '已采购未到仓' },
      ],
      taskFactories: [
        { taskType: '裁片', taskNo: 'CUT-143690', factory: 'PT Cahaya Dyeing Sejahtera', factoryType: '裁片厂', status: '已完成', plannedDoneAt: '2026-06-29', actualDoneAt: '2026-06-29', completedQty: '600', issue: '-', action: '查看' },
        { taskType: '染色', taskNo: 'DYE-143691', factory: 'PT Cahaya Dyeing Sejahtera', factoryType: '染厂', status: '处理中', plannedDoneAt: '2026-07-01', actualDoneAt: '-', completedQty: '260', issue: '面料部分未到仓', action: '查看' },
        { taskType: '车缝', taskNo: 'SEW-143692', factory: '未定标', factoryType: '车缝厂', status: '分配中', plannedDoneAt: '2026-07-04', actualDoneAt: '-', completedQty: '0', issue: '等待定标', action: '查看' },
        { taskType: '包装', taskNo: 'PACK-143693', factory: 'PT Cahaya Dyeing Sejahtera', factoryType: '后道厂', status: '等待处理', plannedDoneAt: '2026-07-05', actualDoneAt: '-', completedQty: '0', issue: '包装袋未到仓', action: '查看' },
      ],
      keyTimes: [
        { nodeType: '采购下单', plannedAt: '-', actualAt: '2026-06-26', status: '已完成', sourceDoc: 'PO-310821', note: '采购单创建' },
        { nodeType: '原料到仓', plannedAt: '2026-06-30', actualAt: '-', status: '未完成', sourceDoc: 'IN-待入库', note: '面辅料部分未到仓' },
        { nodeType: '生产单生成', plannedAt: '-', actualAt: '2026-06-27', status: '已完成', sourceDoc: 'PO-143690', note: '生产单创建' },
        { nodeType: '发料给工厂', plannedAt: '2026-07-01', actualAt: '-', status: '未完成', sourceDoc: 'ISSUE-待生成', note: '等待物料到仓' },
        { nodeType: '开工时间', plannedAt: '2026-07-02', actualAt: '-', status: '未完成', sourceDoc: '-', note: '等待定标和发料' },
        { nodeType: '预计完成', plannedAt: '2026-07-04', actualAt: '-', status: '剩余 2 天', sourceDoc: '-', note: '交期临近' },
        { nodeType: '质检入库', plannedAt: '2026-07-05', actualAt: '-', status: '未完成', sourceDoc: '-', note: '存在交付风险' },
      ],
      quantityQuality: [
        { quantityType: '生产计划', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '生产单计划数量' },
        { quantityType: '裁片完成', plannedQty: '600', currentQty: '600', unit: '件', diff: '0', status: '正常', note: '裁片已完成' },
        { quantityType: '已发料', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未发料', note: '等待面辅料到仓' },
        { quantityType: '工厂签收', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未签收', note: '工厂未确认收料' },
        { quantityType: '回货数量', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未回货', note: '等待生产' },
        { quantityType: '质检通过入库', plannedQty: '600', currentQty: '0', unit: '件', diff: '-600', status: '未入库', note: '交付风险待跟进' },
      ],
    },
    riskFlags: ['TENDER_NEAR_DEADLINE'],
    auditLogs: [
      createAuditLog('LOG-003', 'CREATE', '生产单创建', '2026-03-01 10:00:00', 'Ahmad Wijaya'),
      createAuditLog('LOG-004', 'TASK_SPLIT', '按派单方案拆成 3 个任务', '2026-03-04 11:20:00', 'Ahmad Wijaya'),
    ],
    createdAt: '2026-03-01 10:00:00',
    updatedAt: '2026-03-05 09:00:00',
  },
  {
    productionOrderId: 'PO-202603-0004',
    demandId: 'DEM-202603-0010',
    status: 'EXECUTING',
    mainFactoryId: 'ID-F006',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F006',
    planStartDate: '2026-03-03',
    planEndDate: '2026-03-18',
    planStatus: 'RELEASED',
    lifecycleStatus: 'IN_PRODUCTION',
    assignmentSummary: { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 2, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝'], lastBreakdownAt: '2026-03-02 10:30:00', lastBreakdownBy: '系统' },
    riskFlags: [],
    auditLogs: [
      createAuditLog('LOG-005', 'CREATE', '生产单创建', '2026-03-02 16:00:00', '系统'),
      createAuditLog('LOG-006', 'START', '生产单进入执行阶段', '2026-03-04 08:00:00', '系统'),
    ],
    createdAt: '2026-03-02 16:00:00',
    updatedAt: '2026-03-07 09:30:00',
  },
  {
    productionOrderId: 'PO-202603-0101',
    demandId: 'DEM-202603-0101',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F006',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F006',
    planStartDate: '2026-03-08',
    planEndDate: '2026-03-20',
    planStatus: 'PLANNED',
    lifecycleStatus: 'PLANNED',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['后道'],
      lastBreakdownAt: '2026-03-06 10:00:00',
      lastBreakdownBy: '系统',
      generationRuleName: '默认按工序生成规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 1,
      independentWorkOrderTaskCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 0,
      coveredProcessNames: ['洗水', '绣花', '特殊工艺', '后道', '包装'],
      previewStatus: 'NO_MATCH_USE_DEFAULT',
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-0101', 'CREATE', '同款 Jogger 第二张生产单创建', '2026-03-06 10:00:00', '系统')],
    createdAt: '2026-03-06 10:00:00',
    updatedAt: '2026-03-06 10:00:00',
  },
  {
    productionOrderId: 'PO-202603-0102',
    demandId: 'DEM-202603-0102',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F006',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F006',
    planStartDate: '2026-03-09',
    planEndDate: '2026-03-22',
    planStatus: 'PLANNED',
    lifecycleStatus: 'PLANNED',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['后道'],
      lastBreakdownAt: '2026-03-07 09:45:00',
      lastBreakdownBy: '系统',
      generationRuleName: '默认按工序生成规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 1,
      independentWorkOrderTaskCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 0,
      coveredProcessNames: ['洗水', '绣花', '特殊工艺', '后道', '包装'],
      previewStatus: 'NO_MATCH_USE_DEFAULT',
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-0102', 'CREATE', '同款 Jogger 第三张生产单创建', '2026-03-07 09:45:00', '系统')],
    createdAt: '2026-03-07 09:45:00',
    updatedAt: '2026-03-07 09:45:00',
  },
  {
    productionOrderId: 'PO-202603-0005',
    demandId: 'DEM-202603-0011',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    ownerPartyType: 'FACTORY',
    ownerPartyId: KOL_GOTO_FACTORY_ID,
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['KOL整单任务'],
      lastBreakdownAt: '2026-03-01 14:05:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-KOL-001',
      generationRuleName: 'KOL样衣整单承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 0,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 1,
      coveredProcessNames: ['压褶', '毛织', '特殊工艺', '后道', '装扣子'],
      previewStatus: 'READY',
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-007', 'CREATE', '生产单创建', '2026-03-01 14:00:00', 'Lina Susanti')],
    createdAt: '2026-03-01 14:00:00',
    updatedAt: '2026-03-01 14:00:00',
  },
  {
    productionOrderId: 'PO-202603-0006',
    demandId: 'DEM-202603-0012',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F005',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F005',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['整件毛织', '后道'],
      lastBreakdownAt: '2026-03-02 15:05:00',
      lastBreakdownBy: '系统',
      generationRuleName: '默认按工序生成规则',
      generatedTaskUnitCount: 2,
      singleProcessTaskCount: 2,
      independentWorkOrderTaskCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 0,
      coveredProcessNames: ['压褶', '毛织', '整件毛织', '特殊工艺', '后道', '装扣子'],
      previewStatus: 'NO_MATCH_USE_DEFAULT',
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-008', 'CREATE', '生产单创建', '2026-03-02 15:00:00', 'Dewi Lestari')],
    createdAt: '2026-03-02 15:00:00',
    updatedAt: '2026-03-02 15:00:00',
  },
  {
    productionOrderId: 'PO-202603-0007',
    demandId: 'DEM-202603-0013',
    status: 'ASSIGNING',
    mainFactoryId: 'ID-F009',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F009',
    assignmentSummary: { directCount: 1, biddingCount: 1, totalTasks: 2, unassignedCount: 0 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 1, biddingLaunchedCount: 1, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 1, nearestDeadline: '2026-03-07 17:30:00', overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 1, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝'], lastBreakdownAt: '2026-03-03 11:00:00', lastBreakdownBy: 'Yudi Prakoso' },
    riskFlags: ['DISPATCH_REJECTED'],
    auditLogs: [
      createAuditLog('LOG-009', 'CREATE', '生产单创建', '2026-03-03 11:00:00', 'Yudi Prakoso'),
      createAuditLog('LOG-010', 'DISPATCH_REJECTED', '派单 1 次被拒，已切回竞价', '2026-03-05 14:00:00', '系统'),
    ],
    createdAt: '2026-03-03 11:00:00',
    updatedAt: '2026-03-05 14:00:00',
  },
  {
    productionOrderId: 'PO-202603-0008',
    demandId: 'DEM-202603-0014',
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F005',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F005',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: false,
      taskTypesTop3: [],
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-011', 'CREATE', '生产单创建，待拆解任务', '2026-03-04 09:00:00', 'Lina Susanti')],
    createdAt: '2026-03-04 09:00:00',
    updatedAt: '2026-03-04 09:00:00',
  },
  {
    productionOrderId: 'PO-202603-0009',
    demandId: 'DEM-202603-0015',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    ownerPartyType: 'FACTORY',
    ownerPartyId: KOL_GOTO_FACTORY_ID,
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['KOL整单任务'],
      lastBreakdownAt: '2026-03-16 10:00:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-KOL-001',
      generationRuleName: 'KOL样衣整单承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 1,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 1,
      coveredProcessNames: ['裁片', '车缝', '毛织', '特殊工艺', '后道', '装扣子'],
      previewStatus: 'READY',
    },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-012', 'CREATE', '生产单创建', '2026-03-04 14:30:00', 'Lina Susanti')],
    createdAt: '2026-03-04 14:30:00',
    updatedAt: '2026-03-04 14:30:00',
  },
  {
    productionOrderId: 'PO-202603-0010',
    demandId: 'DEM-202603-0016',
    status: 'DRAFT',
    mainFactoryId: 'ID-F007',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F007',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-013', 'CREATE', 'Draft 生产单创建', '2026-03-05 10:00:00', 'Novi Rahmawati')],
    createdAt: '2026-03-05 10:00:00',
    updatedAt: '2026-03-05 10:00:00',
  },
  {
    productionOrderId: 'PO-202603-0014',
    demandId: 'DEM-202603-0017',
    status: 'ASSIGNING',
    mainFactoryId: 'ID-F010',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F010',
    planStartDate: '2026-03-12',
    planEndDate: '2026-04-02',
    assignmentSummary: { directCount: 4, biddingCount: 0, totalTasks: 4, unassignedCount: 1 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 3, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 3, rejectedCount: 0, overdueAckCount: 1 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '打包'], lastBreakdownAt: '2026-03-01 14:00:00', lastBreakdownBy: 'Yudi Prakoso' },
    riskFlags: ['DISPATCH_ACK_OVERDUE'],
    auditLogs: [
      createAuditLog('LOG-014', 'CREATE', '生产单创建', '2026-02-26 15:00:00', 'Yudi Prakoso'),
      createAuditLog('LOG-015', 'DISPATCH_ACK_OVERDUE', '任务 4 派单确认超时', '2026-03-06 09:00:00', '系统'),
    ],
    createdAt: '2026-02-26 15:00:00',
    updatedAt: '2026-03-06 09:00:00',
  },
  {
    productionOrderId: 'PO-202603-0015',
    demandId: 'DEM-202603-0018',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F014',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F014',
    planStartDate: '2026-03-16',
    planEndDate: '2026-04-08',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['车缝+后道组合任务'],
      lastBreakdownAt: '2026-03-16 10:00:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-FAST-001',
      generationRuleName: '小批量连续工序承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 0,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 1,
      wholeOrderTaskCount: 0,
      coveredProcessNames: ['车缝', '特殊工艺', '后道', '装扣子'],
      previewStatus: 'READY',
    },
    riskFlags: [],
    auditLogs: [
      createAuditLog('LOG-016', 'CREATE', '混合场景生产单创建', '2026-03-15 09:00:00', 'Yudi Prakoso'),
      createAuditLog('LOG-017', 'TASK_READY', '已生成初始任务，进入待分配', '2026-03-16 10:00:00', '系统'),
    ],
    createdAt: '2026-03-15 09:00:00',
    updatedAt: '2026-03-16 10:05:00',
  },
  {
    productionOrderId: 'PO-202603-081',
    demandId: 'DEM-202603-0081',
    status: 'EXECUTING',
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    ownerPartyType: 'FACTORY',
    ownerPartyId: KOL_GOTO_FACTORY_ID,
    planStartDate: '2026-03-08',
    planEndDate: '2026-03-24',
    planStatus: 'RELEASED',
    lifecycleStatus: 'IN_PRODUCTION',
    assignmentSummary: { directCount: 1, biddingCount: 0, totalTasks: 1, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 1, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['KOL整单任务'],
      lastBreakdownAt: '2026-03-08 09:10:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-KOL-001',
      generationRuleName: 'KOL样衣整单承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 1,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 1,
      coveredProcessNames: ['裁片', '车缝', '特殊工艺', '后道', '装扣子'],
      previewStatus: 'READY',
    },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [createAuditLog('LOG-081', 'CREATE', '裁片域正式生产单已生成', '2026-03-08 08:30:00', '系统')],
    createdAt: '2026-03-08 08:30:00',
    updatedAt: '2026-03-21 16:40:00',
  },
  {
    productionOrderId: 'PO-202603-082',
    demandId: 'DEM-202603-0082',
    status: 'EXECUTING',
    mainFactoryId: 'ID-F004',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F004',
    planStartDate: '2026-03-09',
    planEndDate: '2026-03-28',
    planStatus: 'RELEASED',
    lifecycleStatus: 'IN_PRODUCTION',
    assignmentSummary: { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '铺布'], lastBreakdownAt: '2026-03-09 09:10:00', lastBreakdownBy: '系统' },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-082', 'CREATE', '裁片域正式生产单已生成', '2026-03-09 09:00:00', '系统')],
    createdAt: '2026-03-09 09:00:00',
    updatedAt: '2026-03-22 08:15:00',
  },
  {
    productionOrderId: 'PO-202603-083',
    demandId: 'DEM-202603-0083',
    status: 'EXECUTING',
    mainFactoryId: 'ID-F006',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F006',
    planStartDate: '2026-03-10',
    planEndDate: '2026-03-31',
    planStatus: 'RELEASED',
    lifecycleStatus: 'IN_PRODUCTION',
    assignmentSummary: { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '入仓'], lastBreakdownAt: '2026-03-10 09:30:00', lastBreakdownBy: '系统' },
    riskFlags: ['HANDOVER_PENDING'],
    auditLogs: [createAuditLog('LOG-083', 'CREATE', '裁片域正式生产单已生成', '2026-03-10 09:10:00', '系统')],
    createdAt: '2026-03-10 09:10:00',
    updatedAt: '2026-03-21 18:05:00',
  },
  {
    productionOrderId: 'PO-202603-084',
    demandId: 'DEM-202603-0084',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F001',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片'], lastBreakdownAt: '2026-03-11 09:15:00', lastBreakdownBy: '系统' },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-084', 'CREATE', '裁片域正式生产单已生成', '2026-03-11 09:00:00', '系统')],
    createdAt: '2026-03-11 09:00:00',
    updatedAt: '2026-03-21 12:28:00',
  },
  {
    productionOrderId: 'PO-202603-085',
    demandId: 'DEM-202603-0085',
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F003',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F003',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 2, unassignedCount: 2 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-085', 'CREATE', '裁片域正式生产单已生成', '2026-03-12 08:50:00', '系统')],
    createdAt: '2026-03-12 08:50:00',
    updatedAt: '2026-03-21 09:58:00',
  },
  {
    productionOrderId: 'PO-202603-086',
    demandId: 'DEM-202603-0086',
    status: 'COMPLETED',
    mainFactoryId: 'ID-F004',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F004',
    lockedLegacy: true,
    planStartDate: '2026-03-13',
    planEndDate: '2026-03-29',
    planStatus: 'RELEASED',
    lifecycleStatus: 'COMPLETED',
    assignmentSummary: { directCount: 2, biddingCount: 0, totalTasks: 2, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '入仓'], lastBreakdownAt: '2026-03-13 09:10:00', lastBreakdownBy: '系统' },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-086', 'COMPLETE', '裁片域正式生产单已完成', '2026-03-22 09:18:00', '系统')],
    createdAt: '2026-03-13 08:35:00',
    updatedAt: '2026-03-22 09:18:00',
  },
  {
    productionOrderId: 'PO-202603-087',
    demandId: 'DEM-202603-0087',
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F002',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F002',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [createAuditLog('LOG-087', 'CREATE', '裁片域正式生产单已生成', '2026-03-14 09:20:00', '系统')],
    createdAt: '2026-03-14 09:20:00',
    updatedAt: '2026-03-23 10:12:00',
  },
  {
    productionOrderId: 'PO-202603-088',
    demandId: 'DEM-202603-0088',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    ownerPartyType: 'FACTORY',
    ownerPartyId: KOL_GOTO_FACTORY_ID,
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: {
      isBrokenDown: true,
      taskTypesTop3: ['KOL整单任务'],
      lastBreakdownAt: '2026-03-15 09:30:00',
      lastBreakdownBy: '系统',
      generationRuleId: 'TGR-KOL-001',
      generationRuleName: 'KOL样衣整单承接规则',
      generatedTaskUnitCount: 1,
      singleProcessTaskCount: 0,
      independentWorkOrderTaskCount: 0,
      independentRequirementCount: 0,
      independentWorkOrderCount: 0,
      combinedProcessTaskCount: 0,
      wholeOrderTaskCount: 1,
      coveredProcessNames: ['缩水', '裁片', '车缝', '特殊工艺', '后道'],
      previewStatus: 'READY',
    },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [createAuditLog('LOG-088', 'CREATE', '裁片域正式生产单已生成', '2026-03-15 09:10:00', '系统')],
    createdAt: '2026-03-15 09:10:00',
    updatedAt: '2026-03-23 11:36:00',
  },
]

export const productionOrders: ProductionOrder[] = productionOrderSeeds.map((seed) => buildProductionOrderFromSeed(seed))

export const productionOrderStatusConfig: Record<ProductionOrderStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  WAIT_TECH_PACK_RELEASE: { label: '等待技术包发布', color: 'bg-orange-100 text-orange-700' },
  READY_FOR_BREAKDOWN: { label: '待拆解', color: 'bg-blue-100 text-blue-700' },
  WAIT_ASSIGNMENT: { label: '待分配', color: 'bg-purple-100 text-purple-700' },
  ASSIGNING: { label: '分配中', color: 'bg-indigo-100 text-indigo-700' },
  EXECUTING: { label: '生产执行中', color: 'bg-cyan-100 text-cyan-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-700' },
  ON_HOLD: { label: '已挂起', color: 'bg-yellow-100 text-yellow-700' },
}

export const assignmentProgressStatusConfig: Record<AssignmentProgressStatus, { label: string; color: string }> = {
  NOT_READY: { label: '未就绪', color: 'bg-gray-100 text-gray-600' },
  PENDING: { label: '待分配', color: 'bg-yellow-100 text-yellow-700' },
  IN_PROGRESS: { label: '分配中', color: 'bg-blue-100 text-blue-700' },
  DONE: { label: '已完成', color: 'bg-green-100 text-green-700' },
}

export const riskFlagConfig: Record<RiskFlag, { label: string; color: string }> = {
  TECH_PACK_NOT_RELEASED: { label: '技术包未发布', color: 'bg-orange-100 text-orange-700' },
  TECH_PACK_MISSING: { label: '技术包缺失', color: 'bg-red-100 text-red-700' },
  MAIN_FACTORY_BLACKLISTED: { label: '主工厂黑名单', color: 'bg-red-100 text-red-700' },
  MAIN_FACTORY_SUSPENDED: { label: '主工厂暂停', color: 'bg-orange-100 text-orange-700' },
  TENDER_OVERDUE: { label: '竞价已过期', color: 'bg-red-100 text-red-700' },
  TENDER_NEAR_DEADLINE: { label: '竞价临近截止', color: 'bg-yellow-100 text-yellow-700' },
  DISPATCH_REJECTED: { label: '派单被拒', color: 'bg-orange-100 text-orange-700' },
  DISPATCH_ACK_OVERDUE: { label: '派单确认超时', color: 'bg-orange-100 text-orange-700' },
  OWNER_ADJUSTED: { label: '货权已调整', color: 'bg-blue-100 text-blue-700' },
  DELIVERY_DATE_NEAR: { label: '交期临近', color: 'bg-yellow-100 text-yellow-700' },
  HANDOVER_DIFF: { label: '交接差异', color: 'bg-red-100 text-red-700' },
  HANDOVER_PENDING: { label: '交接待确认', color: 'bg-yellow-100 text-yellow-700' },
}

export const techPackStatusConfig: Record<TechPackStatus, { label: string; color: string }> = {
  MISSING: { label: '缺失', color: 'bg-red-100 text-red-700' },
  BETA: { label: '待补齐', color: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已发布', color: 'bg-green-100 text-green-700' },
}
