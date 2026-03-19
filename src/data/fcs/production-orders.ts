// 生产单 Mock 数据 - 统一业务口径：拆解后进入"待分配"

import { indonesiaFactories, type IndonesiaFactory } from './indonesia-factories'

// 新状态机（禁止WAIT_DISPATCH，改用WAIT_ASSIGNMENT）
export type ProductionOrderStatus = 
  | 'DRAFT' 
  | 'WAIT_TECH_PACK_RELEASE' 
  | 'READY_FOR_BREAKDOWN' 
  | 'WAIT_ASSIGNMENT'    // 已拆解，待分配（派单/竞价）
  | 'ASSIGNING'          // 分配中（派单中/竞价中）
  | 'EXECUTING'          // 生产执行中（原 IN_PROGRESS）
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'ON_HOLD'

export type OwnerPartyType = 'FACTORY' | 'LEGAL_ENTITY'
export type TechPackStatus = 'MISSING' | 'BETA' | 'RELEASED'
export type AssignmentProgressStatus = 'NOT_READY' | 'PENDING' | 'IN_PROGRESS' | 'DONE'

// 风险标签枚举
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

// B. 分配摘要
export interface AssignmentSummary {
  directCount: number      // 派单数量
  biddingCount: number     // 竞价数量
  totalTasks: number       // 总任务数
  unassignedCount: number  // 未分配数量
}

// C. 分配进度
export interface AssignmentProgress {
  status: AssignmentProgressStatus
  directAssignedCount: number    // 已派单数量
  biddingLaunchedCount: number   // 已发起竞价数量
  biddingAwardedCount: number    // 已中标数量
}

// D. 竞价关键信息
export interface BiddingSummary {
  activeTenderCount: number      // 活跃竞价数
  nearestDeadline?: string       // 最近截止时间
  overdueTenderCount: number     // 过期竞价数
}

// E. 派单关键信息
export interface DirectDispatchSummary {
  assignedFactoryCount: number   // 已分配工厂数
  rejectedCount: number          // 拒单数
  overdueAckCount: number        // 超时确认数
}

// F. 任务粒度
export interface TaskBreakdownSummary {
  isBrokenDown: boolean
  taskTypesTop3: string[]        // 如 ['裁片','车缝','打条']
  lastBreakdownAt?: string
  lastBreakdownBy?: string
}

export interface ProductionOrder {
  productionOrderId: string
  demandId: string
  legacyOrderNo: string
  status: ProductionOrderStatus
  lockedLegacy: boolean          // 当 status in ['EXECUTING','COMPLETED','CANCELLED'] 为 true
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
  // 计划管理字段
  planStatus?: 'UNPLANNED' | 'PLANNED' | 'RELEASED'
  planQty?: number
  planFactoryId?: string
  planFactoryName?: string
  planRemark?: string
  planUpdatedAt?: string
  planUpdatedBy?: string
  // 生命周期状态
  lifecycleStatus?: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
  lifecycleStatusRemark?: string
  lifecycleUpdatedAt?: string
  lifecycleUpdatedBy?: string
  techPackSnapshot: TechPackSnapshot
  demandSnapshot: DemandSnapshot
  
  // 新增字段
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

// 从工厂数据创建快照
function createFactorySnapshot(factory: IndonesiaFactory): FactorySnapshot {
  return {
    id: factory.id,
    code: factory.code,
    name: factory.name,
    tier: factory.tier,
    type: factory.type,
    status: factory.status,
    province: factory.province,
    city: factory.city,
    tags: factory.tags,
  }
}

// Mock 生产单数据 - 覆盖所有状态与分配组合（12+条）
export const productionOrders: ProductionOrder[] = [
  // PO-0001: WAIT_TECH_PACK_RELEASE (techPack=BETA, 未拆解)
  {
    productionOrderId: 'PO-202603-0001',
    demandId: 'DEM-202603-0004',
    legacyOrderNo: '240779',
    status: 'WAIT_TECH_PACK_RELEASE',
    lockedLegacy: false,
    mainFactoryId: 'ID-F002',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F002')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F002',
    techPackSnapshot: {
      status: 'BETA',
      versionLabel: 'beta-v2',
      snapshotAt: '2026-03-02 16:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0004',
      spuCode: 'SPU-2024-004',
      spuName: 'Kaos Polos Premium',
      priority: 'P1',
      requiredDeliveryDate: '2026-04-25',
      constraintsNote: 'Cotton combed 30s. Warna harus sesuai Pantone.',
      skuLines: [
        { skuCode: 'SKU-004-S-WHT', size: 'S', color: 'White', qty: 1000 },
        { skuCode: 'SKU-004-M-WHT', size: 'M', color: 'White', qty: 1500 },
        { skuCode: 'SKU-004-L-WHT', size: 'L', color: 'White', qty: 1500 },
        { skuCode: 'SKU-004-XL-WHT', size: 'XL', color: 'White', qty: 1000 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: ['TECH_PACK_NOT_RELEASED'],
    auditLogs: [
      { id: 'LOG-001', action: 'CREATE', detail: '生产单从需求 DEM-202603-0004 创建', at: '2026-03-02 16:00:00', by: 'Budi Santoso' },
    ],
    createdAt: '2026-03-02 16:00:00',
    updatedAt: '2026-03-02 16:00:00',
  },
  // PO-0002: READY_FOR_BREAKDOWN (techPack=RELEASED, 未拆解)
  {
    productionOrderId: 'PO-202603-0002',
    demandId: 'DEM-202603-0005',
    legacyOrderNo: '240780',
    status: 'READY_FOR_BREAKDOWN',
    lockedLegacy: false,
    mainFactoryId: 'ID-F004',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F004')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F004',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v2.1',
      snapshotAt: '2026-03-03 15:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0005',
      spuCode: 'SPU-2024-005',
      spuName: 'Jaket Hoodie Unisex',
      priority: 'P2',
      requiredDeliveryDate: '2026-05-01',
      constraintsNote: 'Fleece 280gsm. Resleting harus kuat.',
      skuLines: [
        { skuCode: 'SKU-005-S-GRY', size: 'S', color: 'Grey', qty: 500 },
        { skuCode: 'SKU-005-M-GRY', size: 'M', color: 'Grey', qty: 700 },
        { skuCode: 'SKU-005-L-GRY', size: 'L', color: 'Grey', qty: 800 },
        { skuCode: 'SKU-005-XL-GRY', size: 'XL', color: 'Grey', qty: 500 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [
      { id: 'LOG-002', action: 'CREATE', detail: '生产单从需求 DEM-202603-0005 创建', at: '2026-03-03 15:00:00', by: 'Dewi Lestari' },
    ],
    createdAt: '2026-03-03 15:00:00',
    updatedAt: '2026-03-03 15:00:00',
  },
  // PO-0003: WAIT_ASSIGNMENT (已拆解, 全派单, 待分配)
  {
    productionOrderId: 'PO-202603-0003',
    demandId: 'DEM-202603-0006',
    legacyOrderNo: '240781',
    status: 'WAIT_ASSIGNMENT',
    lockedLegacy: false,
    mainFactoryId: 'ID-F001',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F001')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    planStartDate: '2026-03-10',
    planEndDate: '2026-03-28',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.2',
      snapshotAt: '2026-02-25 10:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0006',
      spuCode: 'SPU-2024-006',
      spuName: 'Polo Shirt Pique',
      priority: 'P1',
      requiredDeliveryDate: '2026-03-30',
      constraintsNote: 'Logo bordir dada kiri. Kerah harus kaku.',
      skuLines: [
        { skuCode: 'SKU-006-S-WHT', size: 'S', color: 'White', qty: 1200 },
        { skuCode: 'SKU-006-M-WHT', size: 'M', color: 'White', qty: 1800 },
        { skuCode: 'SKU-006-L-WHT', size: 'L', color: 'White', qty: 1800 },
        { skuCode: 'SKU-006-XL-WHT', size: 'XL', color: 'White', qty: 1200 },
      ],
    },
    assignmentSummary: { directCount: 5, biddingCount: 0, totalTasks: 5, unassignedCount: 5 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '后整'], lastBreakdownAt: '2026-03-05 10:00:00', lastBreakdownBy: 'Ahmad Wijaya' },
    riskFlags: ['DELIVERY_DATE_NEAR'],
    auditLogs: [
      { id: 'LOG-003', action: 'CREATE', detail: '生产单创建', at: '2026-02-25 10:00:00', by: 'Ahmad Wijaya' },
      { id: 'LOG-004', action: 'BREAKDOWN', detail: '工艺任务拆解完成，共5个任务', at: '2026-03-05 10:00:00', by: 'Ahmad Wijaya' },
      { id: 'LOG-005', action: 'STATUS_CHANGE', detail: '状态变更为待分配', at: '2026-03-05 10:05:00', by: 'System' },
    ],
    createdAt: '2026-02-25 10:00:00',
    updatedAt: '2026-03-05 10:05:00',
  },
  // PO-0004: WAIT_ASSIGNMENT (已拆解, 全竞价, 待分配)
  {
    productionOrderId: 'PO-202603-0004',
    demandId: 'DEM-202603-0007',
    legacyOrderNo: '240782',
    status: 'WAIT_ASSIGNMENT',
    lockedLegacy: false,
    mainFactoryId: 'ID-F006',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F006')!),
    ownerPartyType: 'LEGAL_ENTITY',
    ownerPartyId: 'LE-001',
    ownerReason: '大额订单需法人实体结算',
    planStartDate: '2026-03-12',
    planEndDate: '2026-04-05',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.5',
      snapshotAt: '2026-03-01 09:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0007',
      spuCode: 'SPU-2024-007',
      spuName: 'Celana Jogger Pria',
      priority: 'P0',
      requiredDeliveryDate: '2026-04-08',
      constraintsNote: 'Elastis pinggang harus kuat. Saku samping resleting.',
      skuLines: [
        { skuCode: 'SKU-007-S-BLK', size: 'S', color: 'Black', qty: 700 },
        { skuCode: 'SKU-007-M-BLK', size: 'M', color: 'Black', qty: 1000 },
        { skuCode: 'SKU-007-L-BLK', size: 'L', color: 'Black', qty: 1100 },
        { skuCode: 'SKU-007-XL-BLK', size: 'XL', color: 'Black', qty: 700 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 4, totalTasks: 4, unassignedCount: 2 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 0, biddingLaunchedCount: 1, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 2, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '印花', '车缝'], lastBreakdownAt: '2026-03-06 14:00:00', lastBreakdownBy: 'Siti Rahayu' },
    riskFlags: ['OWNER_ADJUSTED'],
    auditLogs: [
      { id: 'LOG-006', action: 'CREATE', detail: '生产单创建', at: '2026-03-01 09:00:00', by: 'Siti Rahayu' },
      { id: 'LOG-007', action: 'OWNER_CHANGE', detail: '货权主体调整为法人实体 PT HIGOOD LIVE JAKARTA', at: '2026-03-01 09:30:00', by: 'Siti Rahayu' },
      { id: 'LOG-008', action: 'BREAKDOWN', detail: '工艺任务拆解完成，共4个任务', at: '2026-03-06 14:00:00', by: 'Siti Rahayu' },
    ],
    createdAt: '2026-03-01 09:00:00',
    updatedAt: '2026-03-06 14:00:00',
  },
  // PO-0005: ASSIGNING (混合模式, 分配中)
  {
    productionOrderId: 'PO-202603-0005',
    demandId: 'DEM-202603-0008',
    legacyOrderNo: '240783',
    status: 'ASSIGNING',
    lockedLegacy: false,
    mainFactoryId: 'ID-F009',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F009')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F009',
    planStartDate: '2026-03-08',
    planEndDate: '2026-03-25',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v2.0',
      snapshotAt: '2026-02-20 11:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0008',
      spuCode: 'SPU-2024-008',
      spuName: 'Sweater Rajut Wanita',
      priority: 'P1',
      requiredDeliveryDate: '2026-03-28',
      constraintsNote: 'Rajutan harus rapat. Tidak boleh melar.',
      skuLines: [
        { skuCode: 'SKU-008-S-CRM', size: 'S', color: 'Cream', qty: 500 },
        { skuCode: 'SKU-008-M-CRM', size: 'M', color: 'Cream', qty: 600 },
        { skuCode: 'SKU-008-L-CRM', size: 'L', color: 'Cream', qty: 600 },
        { skuCode: 'SKU-008-XL-CRM', size: 'XL', color: 'Cream', qty: 500 },
      ],
    },
    assignmentSummary: { directCount: 3, biddingCount: 1, totalTasks: 4, unassignedCount: 1 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 1, biddingLaunchedCount: 1, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 1, nearestDeadline: '2026-03-08 18:00:00', overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 1, rejectedCount: 0, overdueAckCount: 1 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '染印', '车缝'], lastBreakdownAt: '2026-03-02 16:00:00', lastBreakdownBy: 'Hendra Kusuma' },
    riskFlags: ['TENDER_NEAR_DEADLINE', 'HANDOVER_DIFF'],
    auditLogs: [
      { id: 'LOG-009', action: 'CREATE', detail: '生产单创建', at: '2026-02-20 11:00:00', by: 'Hendra Kusuma' },
      { id: 'LOG-010', action: 'BREAKDOWN', detail: '工艺任务拆解完成，共5个任务', at: '2026-03-02 16:00:00', by: 'Hendra Kusuma' },
      { id: 'LOG-011', action: 'DISPATCH', detail: '发起派单：任务1、任务2、任务3', at: '2026-03-04 09:00:00', by: 'Hendra Kusuma' },
      { id: 'LOG-012', action: 'TENDER', detail: '发起竞价：任务4、任务5', at: '2026-03-04 09:30:00', by: 'Hendra Kusuma' },
    ],
    createdAt: '2026-02-20 11:00:00',
    updatedAt: '2026-03-04 09:30:00',
  },
  // PO-0006: ASSIGNING (全派单, 有拒单)
  {
    productionOrderId: 'PO-202603-0006',
    demandId: 'DEM-202603-0009',
    legacyOrderNo: '240784',
    status: 'ASSIGNING',
    lockedLegacy: false,
    mainFactoryId: 'ID-F011',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F011')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F011',
    planStartDate: '2026-03-10',
    planEndDate: '2026-03-30',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.0',
      snapshotAt: '2026-02-22 14:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0009',
      spuCode: 'SPU-2024-009',
      spuName: 'Cardigan Wanita',
      priority: 'P2',
      requiredDeliveryDate: '2026-04-02',
      constraintsNote: 'Kancing mutiara. Rajutan halus.',
      skuLines: [
        { skuCode: 'SKU-009-S-BEG', size: 'S', color: 'Beige', qty: 400 },
        { skuCode: 'SKU-009-M-BEG', size: 'M', color: 'Beige', qty: 500 },
        { skuCode: 'SKU-009-L-BEG', size: 'L', color: 'Beige', qty: 500 },
        { skuCode: 'SKU-009-XL-BEG', size: 'XL', color: 'Beige', qty: 400 },
      ],
    },
    assignmentSummary: { directCount: 4, biddingCount: 0, totalTasks: 4, unassignedCount: 2 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 2, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 2, rejectedCount: 1, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '钉扣'], lastBreakdownAt: '2026-03-03 10:00:00', lastBreakdownBy: 'Wulan Sari' },
    riskFlags: ['DISPATCH_REJECTED'],
    auditLogs: [
      { id: 'LOG-013', action: 'CREATE', detail: '生产单创建', at: '2026-02-22 14:00:00', by: 'Wulan Sari' },
      { id: 'LOG-014', action: 'BREAKDOWN', detail: '工艺任务拆解完成，共4个任务', at: '2026-03-03 10:00:00', by: 'Wulan Sari' },
      { id: 'LOG-015', action: 'DISPATCH', detail: '发起派单：全部4个任务', at: '2026-03-05 11:00:00', by: 'Wulan Sari' },
      { id: 'LOG-016', action: 'DISPATCH_REJECT', detail: '任务3被工厂拒绝', at: '2026-03-06 09:00:00', by: 'System' },
    ],
    createdAt: '2026-02-22 14:00:00',
    updatedAt: '2026-03-06 09:00:00',
  },
  // PO-0007: ASSIGNING (全竞价, 有过期)
  {
    productionOrderId: 'PO-202603-0007',
    demandId: 'DEM-202603-0010',
    legacyOrderNo: '240785',
    status: 'ASSIGNING',
    lockedLegacy: false,
    mainFactoryId: 'ID-F014',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F014')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F014',
    planStartDate: '2026-03-15',
    planEndDate: '2026-04-10',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.3',
      snapshotAt: '2026-02-25 16:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0010',
      spuCode: 'SPU-2024-010',
      spuName: 'Jas Pria Formal',
      priority: 'P0',
      requiredDeliveryDate: '2026-04-15',
      constraintsNote: 'Wool blend. Lapel harus tajam.',
      skuLines: [
        { skuCode: 'SKU-010-S-NVY', size: 'S', color: 'Navy', qty: 150 },
        { skuCode: 'SKU-010-M-NVY', size: 'M', color: 'Navy', qty: 250 },
        { skuCode: 'SKU-010-L-NVY', size: 'L', color: 'Navy', qty: 250 },
        { skuCode: 'SKU-010-XL-NVY', size: 'XL', color: 'Navy', qty: 150 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 6, totalTasks: 6, unassignedCount: 3 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 0, biddingLaunchedCount: 5, biddingAwardedCount: 3 },
    biddingSummary: { activeTenderCount: 2, nearestDeadline: '2026-03-10 12:00:00', overdueTenderCount: 1 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '熨烫'], lastBreakdownAt: '2026-03-01 11:00:00', lastBreakdownBy: 'Dian Putra' },
    riskFlags: ['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE', 'HANDOVER_PENDING'],
    auditLogs: [
      { id: 'LOG-017', action: 'CREATE', detail: '生产单创建', at: '2026-02-25 16:00:00', by: 'Dian Putra' },
      { id: 'LOG-018', action: 'BREAKDOWN', detail: '工艺任务拆解完成，共6个任务', at: '2026-03-01 11:00:00', by: 'Dian Putra' },
      { id: 'LOG-019', action: 'TENDER', detail: '发起竞价：任务1-5', at: '2026-03-02 10:00:00', by: 'Dian Putra' },
      { id: 'LOG-020', action: 'TENDER_OVERDUE', detail: '任务2竞价已过期', at: '2026-03-05 12:00:00', by: 'System' },
    ],
    createdAt: '2026-02-25 16:00:00',
    updatedAt: '2026-03-05 12:00:00',
  },
  // PO-0008: EXECUTING (已全部分配完成)
  {
    productionOrderId: 'PO-202603-0008',
    demandId: 'DEM-202603-0011',
    legacyOrderNo: '240786',
    status: 'EXECUTING',
    lockedLegacy: true,
    mainFactoryId: 'ID-F016',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F016')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F016',
    planStartDate: '2026-02-28',
    planEndDate: '2026-03-20',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.1',
      snapshotAt: '2026-02-15 10:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0011',
      spuCode: 'SPU-2024-011',
      spuName: 'Rompi Pria Casual',
      priority: 'P1',
      requiredDeliveryDate: '2026-03-22',
      constraintsNote: 'Kain tebal. Lapisan dalam halus.',
      skuLines: [
        { skuCode: 'SKU-011-S-GRN', size: 'S', color: 'Green', qty: 200 },
        { skuCode: 'SKU-011-M-GRN', size: 'M', color: 'Green', qty: 300 },
        { skuCode: 'SKU-011-L-GRN', size: 'L', color: 'Green', qty: 300 },
        { skuCode: 'SKU-011-XL-GRN', size: 'XL', color: 'Green', qty: 200 },
      ],
    },
    assignmentSummary: { directCount: 3, biddingCount: 2, totalTasks: 5, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 3, biddingLaunchedCount: 2, biddingAwardedCount: 2 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 3, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '后整'], lastBreakdownAt: '2026-02-20 14:00:00', lastBreakdownBy: 'Rina Wijaya' },
    riskFlags: [],
    auditLogs: [
      { id: 'LOG-021', action: 'CREATE', detail: '生产单创建', at: '2026-02-15 10:00:00', by: 'Rina Wijaya' },
      { id: 'LOG-022', action: 'BREAKDOWN', detail: '工艺任务拆解完成', at: '2026-02-20 14:00:00', by: 'Rina Wijaya' },
      { id: 'LOG-023', action: 'ASSIGNMENT_DONE', detail: '所有任务已分配完成', at: '2026-02-25 16:00:00', by: 'System' },
      { id: 'LOG-024', action: 'STATUS_CHANGE', detail: '状态变更为生产执行中', at: '2026-02-28 08:00:00', by: 'System' },
    ],
    createdAt: '2026-02-15 10:00:00',
    updatedAt: '2026-02-28 08:00:00',
  },
  // PO-0009: COMPLETED
  {
    productionOrderId: 'PO-202603-0009',
    demandId: 'DEM-202603-0012',
    legacyOrderNo: '240787',
    status: 'COMPLETED',
    lockedLegacy: true,
    mainFactoryId: 'ID-F018',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F018')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F018',
    planStartDate: '2026-02-10',
    planEndDate: '2026-02-28',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.0',
      snapshotAt: '2026-02-05 09:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0012',
      spuCode: 'SPU-2024-012',
      spuName: 'Kemeja Linen Pria',
      priority: 'P2',
      requiredDeliveryDate: '2026-03-01',
      constraintsNote: 'Linen premium. Jahitan Perancis.',
      skuLines: [
        { skuCode: 'SKU-012-S-WHT', size: 'S', color: 'White', qty: 600 },
        { skuCode: 'SKU-012-M-WHT', size: 'M', color: 'White', qty: 800 },
        { skuCode: 'SKU-012-L-WHT', size: 'L', color: 'White', qty: 800 },
        { skuCode: 'SKU-012-XL-WHT', size: 'XL', color: 'White', qty: 600 },
      ],
    },
    assignmentSummary: { directCount: 4, biddingCount: 0, totalTasks: 4, unassignedCount: 0 },
    assignmentProgress: { status: 'DONE', directAssignedCount: 4, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 4, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '熨烫'], lastBreakdownAt: '2026-02-08 10:00:00', lastBreakdownBy: 'Fajar Hidayat' },
    riskFlags: [],
    auditLogs: [
      { id: 'LOG-025', action: 'CREATE', detail: '生产单创建', at: '2026-02-05 09:00:00', by: 'Fajar Hidayat' },
      { id: 'LOG-026', action: 'BREAKDOWN', detail: '工艺任务拆解完成', at: '2026-02-08 10:00:00', by: 'Fajar Hidayat' },
      { id: 'LOG-027', action: 'STATUS_CHANGE', detail: '状态变更为生产执行中', at: '2026-02-10 08:00:00', by: 'System' },
      { id: 'LOG-028', action: 'STATUS_CHANGE', detail: '状态变更为已完成', at: '2026-02-28 17:00:00', by: 'System' },
    ],
    createdAt: '2026-02-05 09:00:00',
    updatedAt: '2026-02-28 17:00:00',
  },
  // PO-0010: CANCELLED
  {
    productionOrderId: 'PO-202603-0010',
    demandId: 'DEM-202603-0013',
    legacyOrderNo: '240788',
    status: 'CANCELLED',
    lockedLegacy: true,
    mainFactoryId: 'ID-F020',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F020')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F020',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.2',
      snapshotAt: '2026-02-18 11:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0013',
      spuCode: 'SPU-2024-013',
      spuName: 'Blus Wanita Satin',
      priority: 'P1',
      requiredDeliveryDate: '2026-03-15',
      constraintsNote: 'Satin silk blend. Dibatalkan buyer.',
      skuLines: [
        { skuCode: 'SKU-013-S-CHP', size: 'S', color: 'Champagne', qty: 700 },
        { skuCode: 'SKU-013-M-CHP', size: 'M', color: 'Champagne', qty: 900 },
        { skuCode: 'SKU-013-L-CHP', size: 'L', color: 'Champagne', qty: 900 },
        { skuCode: 'SKU-013-XL-CHP', size: 'XL', color: 'Champagne', qty: 700 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [
      { id: 'LOG-029', action: 'CREATE', detail: '生产单创建', at: '2026-02-18 11:00:00', by: 'Mega Putri' },
      { id: 'LOG-030', action: 'STATUS_CHANGE', detail: '状态变更为已取消，原因：买家取消订单', at: '2026-02-25 14:00:00', by: 'Mega Putri' },
    ],
    createdAt: '2026-02-18 11:00:00',
    updatedAt: '2026-02-25 14:00:00',
  },
  // PO-0011: ON_HOLD
  {
    productionOrderId: 'PO-202603-0011',
    demandId: 'DEM-202603-0014',
    legacyOrderNo: '240789',
    status: 'ON_HOLD',
    lockedLegacy: false,
    mainFactoryId: 'ID-F003',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F003')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F003',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.0',
      snapshotAt: '2026-02-28 09:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0014',
      spuCode: 'SPU-2024-014',
      spuName: 'Rok Midi Wanita',
      priority: 'P2',
      requiredDeliveryDate: '2026-04-20',
      constraintsNote: 'Kain A-line. Resleting samping.',
      skuLines: [
        { skuCode: 'SKU-014-S-BLK', size: 'S', color: 'Black', qty: 350 },
        { skuCode: 'SKU-014-M-BLK', size: 'M', color: 'Black', qty: 500 },
        { skuCode: 'SKU-014-L-BLK', size: 'L', color: 'Black', qty: 500 },
        { skuCode: 'SKU-014-XL-BLK', size: 'XL', color: 'Black', qty: 350 },
      ],
    },
    assignmentSummary: { directCount: 3, biddingCount: 0, totalTasks: 3, unassignedCount: 3 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '后整'], lastBreakdownAt: '2026-03-02 10:00:00', lastBreakdownBy: 'Andi Permana' },
    riskFlags: ['MAIN_FACTORY_SUSPENDED'],
    auditLogs: [
      { id: 'LOG-031', action: 'CREATE', detail: '生产单创建', at: '2026-02-28 09:00:00', by: 'Andi Permana' },
      { id: 'LOG-032', action: 'BREAKDOWN', detail: '工艺任务拆解完成', at: '2026-03-02 10:00:00', by: 'Andi Permana' },
      { id: 'LOG-033', action: 'STATUS_CHANGE', detail: '状态变更为挂起，原因：主工厂暂停合作', at: '2026-03-04 11:00:00', by: 'System' },
    ],
    createdAt: '2026-02-28 09:00:00',
    updatedAt: '2026-03-04 11:00:00',
  },
  // PO-0012: WAIT_TECH_PACK_RELEASE (techPack=MISSING)
  {
    productionOrderId: 'PO-202603-0012',
    demandId: 'DEM-202603-0015',
    legacyOrderNo: '240790',
    status: 'WAIT_TECH_PACK_RELEASE',
    lockedLegacy: false,
    mainFactoryId: 'ID-F005',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F005')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F005',
    techPackSnapshot: {
      status: 'MISSING',
      versionLabel: '-',
      snapshotAt: '2026-03-04 14:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0015',
      spuCode: 'SPU-2024-015',
      spuName: 'Dress Maxi Wanita',
      priority: 'P0',
      requiredDeliveryDate: '2026-04-10',
      constraintsNote: 'Chiffon premium. Bordir tangan.',
      skuLines: [
        { skuCode: 'SKU-015-S-PNK', size: 'S', color: 'Pink', qty: 400 },
        { skuCode: 'SKU-015-M-PNK', size: 'M', color: 'Pink', qty: 600 },
        { skuCode: 'SKU-015-L-PNK', size: 'L', color: 'Pink', qty: 600 },
        { skuCode: 'SKU-015-XL-PNK', size: 'XL', color: 'Pink', qty: 400 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: ['TECH_PACK_MISSING', 'MAIN_FACTORY_BLACKLISTED'],
    auditLogs: [
      { id: 'LOG-034', action: 'CREATE', detail: '生产单创建（技术包缺失）', at: '2026-03-04 14:00:00', by: 'Lina Susanti' },
    ],
    createdAt: '2026-03-04 14:00:00',
    updatedAt: '2026-03-04 14:00:00',
  },
  // PO-0013: DRAFT
  {
    productionOrderId: 'PO-202603-0013',
    demandId: 'DEM-202603-0016',
    legacyOrderNo: '240791',
    status: 'DRAFT',
    lockedLegacy: false,
    mainFactoryId: 'ID-F007',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F007')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F007',
    techPackSnapshot: {
      status: 'BETA',
      versionLabel: 'beta',
      snapshotAt: '2026-03-05 10:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0016',
      spuCode: 'SPU-2024-016',
      spuName: 'Tank Top Wanita',
      priority: 'P2',
      requiredDeliveryDate: '2026-04-25',
      constraintsNote: 'Katun stretch. Jahitan overlock.',
      skuLines: [
        { skuCode: 'SKU-016-S-WHT', size: 'S', color: 'White', qty: 800 },
        { skuCode: 'SKU-016-M-WHT', size: 'M', color: 'White', qty: 1200 },
        { skuCode: 'SKU-016-L-WHT', size: 'L', color: 'White', qty: 1200 },
        { skuCode: 'SKU-016-XL-WHT', size: 'XL', color: 'White', qty: 800 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: ['TECH_PACK_NOT_RELEASED'],
    auditLogs: [
      { id: 'LOG-035', action: 'CREATE', detail: 'Draft 生产单创建', at: '2026-03-05 10:00:00', by: 'Novi Rahmawati' },
    ],
    createdAt: '2026-03-05 10:00:00',
    updatedAt: '2026-03-05 10:00:00',
  },
  // PO-0014: ASSIGNING (派单有超时确认)
  {
    productionOrderId: 'PO-202603-0014',
    demandId: 'DEM-202603-0017',
    legacyOrderNo: '240792',
    status: 'ASSIGNING',
    lockedLegacy: false,
    mainFactoryId: 'ID-F010',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find(f => f.id === 'ID-F010')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F010',
    planStartDate: '2026-03-12',
    planEndDate: '2026-04-02',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v2.2',
      snapshotAt: '2026-02-26 15:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0017',
      spuCode: 'SPU-2024-017',
      spuName: 'Celana Pendek Pria',
      priority: 'P1',
      requiredDeliveryDate: '2026-04-05',
      constraintsNote: 'Kain quick-dry. Saku dalam.',
      skuLines: [
        { skuCode: 'SKU-017-S-NVY', size: 'S', color: 'Navy', qty: 500 },
        { skuCode: 'SKU-017-M-NVY', size: 'M', color: 'Navy', qty: 700 },
        { skuCode: 'SKU-017-L-NVY', size: 'L', color: 'Navy', qty: 700 },
        { skuCode: 'SKU-017-XL-NVY', size: 'XL', color: 'Navy', qty: 500 },
      ],
    },
    assignmentSummary: { directCount: 4, biddingCount: 0, totalTasks: 4, unassignedCount: 1 },
    assignmentProgress: { status: 'IN_PROGRESS', directAssignedCount: 3, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 3, rejectedCount: 0, overdueAckCount: 1 },
    taskBreakdownSummary: { isBrokenDown: true, taskTypesTop3: ['裁片', '车缝', '打包'], lastBreakdownAt: '2026-03-01 14:00:00', lastBreakdownBy: 'Yudi Prakoso' },
    riskFlags: ['DISPATCH_ACK_OVERDUE'],
    auditLogs: [
      { id: 'LOG-036', action: 'CREATE', detail: '生产单创建', at: '2026-02-26 15:00:00', by: 'Yudi Prakoso' },
      { id: 'LOG-037', action: 'BREAKDOWN', detail: '工艺任务拆解完成', at: '2026-03-01 14:00:00', by: 'Yudi Prakoso' },
      { id: 'LOG-038', action: 'DISPATCH', detail: '发起派单：全部4个任务', at: '2026-03-03 09:00:00', by: 'Yudi Prakoso' },
      { id: 'LOG-039', action: 'DISPATCH_ACK_OVERDUE', detail: '任务4派单确认超时', at: '2026-03-06 09:00:00', by: 'System' },
    ],
    createdAt: '2026-02-26 15:00:00',
    updatedAt: '2026-03-06 09:00:00',
  },
  // PO-0015: WAIT_ASSIGNMENT（混合场景：准备阶段 + 普通工艺 + 特殊工艺 + 后道）
  {
    productionOrderId: 'PO-202603-0015',
    demandId: 'DEM-202603-0018',
    legacyOrderNo: '240793',
    status: 'WAIT_ASSIGNMENT',
    lockedLegacy: false,
    mainFactoryId: 'ID-F001',
    mainFactorySnapshot: createFactorySnapshot(indonesiaFactories.find((f) => f.id === 'ID-F001')!),
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    planStartDate: '2026-03-16',
    planEndDate: '2026-04-08',
    techPackSnapshot: {
      status: 'RELEASED',
      versionLabel: 'v1.0',
      snapshotAt: '2026-03-15 09:00:00',
    },
    demandSnapshot: {
      demandId: 'DEM-202603-0018',
      spuCode: 'SPU-2024-001',
      spuName: '春季休闲T恤',
      priority: 'P1',
      requiredDeliveryDate: '2026-04-12',
      constraintsNote: '白黑双色同批，含激光切和打揽特殊工艺。',
      skuLines: [
        { skuCode: 'SKU-001-S-WHT', size: 'S', color: 'White', qty: 300 },
        { skuCode: 'SKU-001-M-WHT', size: 'M', color: 'White', qty: 400 },
        { skuCode: 'SKU-001-L-BLK', size: 'L', color: 'Black', qty: 450 },
        { skuCode: 'SKU-001-XL-BLK', size: 'XL', color: 'Black', qty: 250 },
      ],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'PENDING', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [
      { id: 'LOG-040', action: 'CREATE', detail: '混合场景生产单创建', at: '2026-03-15 09:00:00', by: 'Yudi Prakoso' },
    ],
    createdAt: '2026-03-15 09:00:00',
    updatedAt: '2026-03-15 09:00:00',
  },
]

// 生产单状态配置（中文）
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

// 分配进度状态配置
export const assignmentProgressStatusConfig: Record<AssignmentProgressStatus, { label: string; color: string }> = {
  NOT_READY: { label: '未就绪', color: 'bg-gray-100 text-gray-600' },
  PENDING: { label: '待分配', color: 'bg-yellow-100 text-yellow-700' },
  IN_PROGRESS: { label: '分配中', color: 'bg-blue-100 text-blue-700' },
  DONE: { label: '已完成', color: 'bg-green-100 text-green-700' },
}

// 风险标签配置
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

// 技术包状态配置
export const techPackStatusConfig: Record<TechPackStatus, { label: string; color: string }> = {
  MISSING: { label: '缺失', color: 'bg-red-100 text-red-700' },
  BETA: { label: '测试版', color: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已发布', color: 'bg-green-100 text-green-700' },
}
