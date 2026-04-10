import { indonesiaFactories, type IndonesiaFactory } from './indonesia-factories.ts'
import type { ProductionDemand } from './production-demands.ts'
import type { TechPack } from '../pcs-technical-data-runtime-source.ts'
import {
  buildProductionOrderDemandSnapshot,
  buildProductionOrderTechPackSnapshot,
  validateDemandTechPackOrderLink,
} from './production-upstream-chain.ts'

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

export interface TechPackSnapshot {
  status: TechPackStatus
  versionLabel: string
  snapshotAt: string
}

export interface DemandSnapshot {
  demandId: string
  spuCode: string
  spuName: string
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
}

export interface ProductionOrder {
  productionOrderId: string
  productionOrderNo: string
  demandId: string
  legacyOrderNo: string
  status: ProductionOrderStatus
  lockedLegacy: boolean
  mainFactoryId: string
  mainFactorySnapshot: FactorySnapshot
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
  lifecycleStatus?: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
  lifecycleStatusRemark?: string
  lifecycleUpdatedAt?: string
  lifecycleUpdatedBy?: string
  techPackSnapshot: TechPackSnapshot
  demandSnapshot: DemandSnapshot
  assignmentSummary: AssignmentSummary
  assignmentProgress: AssignmentProgress
  biddingSummary: BiddingSummary
  directDispatchSummary: DirectDispatchSummary
  taskBreakdownSummary: TaskBreakdownSummary
  riskFlags: RiskFlag[]
  auditLogs: AuditLog[]
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderSeed {
  productionOrderId: string
  demandId: string
  status: ProductionOrderStatus
  mainFactoryId: string
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
  riskFlags: RiskFlag[]
  auditLogs: AuditLog[]
  createdAt: string
  updatedAt: string
  snapshotAt?: string
}

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

function buildProductionOrderFromResolvedUpstream(
  seed: ProductionOrderSeed,
  demand: ProductionDemand,
  techPack: TechPack,
): ProductionOrder {
  const factory = indonesiaFactories.find((item) => item.id === seed.mainFactoryId)
  if (!factory) {
    throw new Error(`生产单 ${seed.productionOrderId} 绑定的主工厂 ${seed.mainFactoryId} 不存在`)
  }

  return {
    ...seed,
    productionOrderNo: seed.productionOrderId,
    lockedLegacy:
      seed.lockedLegacy ?? ['EXECUTING', 'COMPLETED', 'CANCELLED'].includes(seed.status),
    mainFactorySnapshot: createFactorySnapshot(factory),
    legacyOrderNo: demand.legacyOrderNo,
    demandSnapshot: buildProductionOrderDemandSnapshot(demand),
    techPackSnapshot: buildProductionOrderTechPackSnapshot(techPack, seed.snapshotAt ?? seed.updatedAt),
  }
}

export function buildProductionOrderFromSeed(seed: ProductionOrderSeed): ProductionOrder {
  const validation = validateDemandTechPackOrderLink({
    productionOrderId: seed.productionOrderId,
    demandId: seed.demandId,
  })

  if (!validation.ok || !validation.demand || !validation.techPack) {
    throw new Error(
      [`生产单 ${seed.productionOrderId} 上游链非法`, ...validation.issues.map((item) => item.message)].join('；'),
    )
  }

  return buildProductionOrderFromResolvedUpstream(seed, validation.demand, validation.techPack)
}

export function buildProductionOrderFromDemand(seed: ProductionOrderSeed, demand: ProductionDemand, techPack: TechPack): ProductionOrder {
  if (seed.demandId !== demand.demandId) {
    throw new Error(`生产单 ${seed.productionOrderId} 与需求 ${demand.demandId} 绑定不一致`)
  }
  if (techPack.status !== 'RELEASED') {
    throw new Error(`需求 ${demand.demandId} 关联技术资料 ${techPack.spuCode} 未发布`)
  }
  if (demand.spuCode !== techPack.spuCode) {
    throw new Error(`需求 ${demand.demandId} 的 SPU ${demand.spuCode} 与技术资料 ${techPack.spuCode} 不一致`)
  }

  return buildProductionOrderFromResolvedUpstream(seed, demand, techPack)
}

function createAuditLog(id: string, action: string, detail: string, at: string, by: string): AuditLog {
  return { id, action, detail, at, by }
}

const productionOrderSeeds: ProductionOrderSeed[] = [
  {
    productionOrderId: 'PO-202603-0001',
    demandId: 'DEM-202603-0004',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F002',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F002',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
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
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
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
    productionOrderId: 'PO-202603-0005',
    demandId: 'DEM-202603-0011',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F008',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F008',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
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
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
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
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [createAuditLog('LOG-011', 'CREATE', '生产单创建，待拆解任务', '2026-03-04 09:00:00', 'Lina Susanti')],
    createdAt: '2026-03-04 09:00:00',
    updatedAt: '2026-03-04 09:00:00',
  },
  {
    productionOrderId: 'PO-202603-0009',
    demandId: 'DEM-202603-0015',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F005',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F005',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: ['MAIN_FACTORY_BLACKLISTED'],
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
    mainFactoryId: 'ID-F001',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    planStartDate: '2026-03-16',
    planEndDate: '2026-04-08',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 1, unassignedCount: 1 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
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
    mainFactoryId: 'ID-F002',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F002',
    planStartDate: '2026-03-08',
    planEndDate: '2026-03-24',
    planStatus: 'RELEASED',
    lifecycleStatus: 'IN_PRODUCTION',
    assignmentSummary: { directCount: 3, biddingCount: 0, totalTasks: 3, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 3, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '印花'], lastBreakdownAt: '2026-03-08 09:10:00', lastBreakdownBy: '系统' },
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
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 2, unassignedCount: 2 },
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
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片'], lastBreakdownAt: '2026-03-12 09:10:00', lastBreakdownBy: '系统' },
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
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 2, unassignedCount: 2 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片'], lastBreakdownAt: '2026-03-14 09:30:00', lastBreakdownBy: '系统' },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [createAuditLog('LOG-087', 'CREATE', '裁片域正式生产单已生成', '2026-03-14 09:20:00', '系统')],
    createdAt: '2026-03-14 09:20:00',
    updatedAt: '2026-03-23 10:12:00',
  },
  {
    productionOrderId: 'PO-202603-088',
    demandId: 'DEM-202603-0088',
    status: 'WAIT_ASSIGNMENT',
    mainFactoryId: 'ID-F006',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F006',
    assignmentSummary: { directCount: 0, biddingCount: 1, totalTasks: 2, unassignedCount: 1 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 0, biddingLaunchedCount: 1, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 1, nearestDeadline: '2026-03-24 18:00:00', overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '竞价'], lastBreakdownAt: '2026-03-15 09:30:00', lastBreakdownBy: '系统' },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [createAuditLog('LOG-088', 'CREATE', '裁片域正式生产单已生成', '2026-03-15 09:10:00', '系统')],
    createdAt: '2026-03-15 09:10:00',
    updatedAt: '2026-03-23 11:36:00',
  },
]

export const productionOrders: ProductionOrder[] = productionOrderSeeds.map((seed) => buildProductionOrderFromSeed(seed))

export const productionOrderStatusConfig: Record<ProductionOrderStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  WAIT_TECH_PACK_RELEASE: { label: '等待技术资料发布', color: 'bg-orange-100 text-orange-700' },
  READY_FOR_BREAKDOWN: { label: '待分配', color: 'bg-blue-100 text-blue-700' },
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
  TECH_PACK_NOT_RELEASED: { label: '技术资料未发布', color: 'bg-orange-100 text-orange-700' },
  TECH_PACK_MISSING: { label: '技术资料缺失', color: 'bg-red-100 text-red-700' },
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
  BETA: { label: '测试版', color: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已发布', color: 'bg-green-100 text-green-700' },
}
