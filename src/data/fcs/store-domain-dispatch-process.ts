// =============================================
// 任务分配 / 执行准备域 — 静态类型 + seed 数据
// 从 fcs-store.tsx 拆出，fcs-store 通过 re-export 保持兼容
// =============================================

// ─── 招标单台账 ──────────────────────────────
export type TenderOrderStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOID'

// ─── 领料对账单 ──────────────────────────────
export type MaterialStatementStatus = 'DRAFT' | 'CONFIRMED' | 'CLOSED'

export interface MaterialStatementItem {
  issueId: string
  taskId: string
  materialSummaryZh: string
  requestedQty: number
  issuedQty: number
}

export interface MaterialStatementDraft {
  materialStatementId: string
  productionOrderId: string
  itemCount: number
  totalRequestedQty: number
  totalIssuedQty: number
  status: MaterialStatementStatus
  issueIds: string[]
  items: MaterialStatementItem[]
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// ─── 领料需求单 ──────────────────────────────
export type MaterialIssueStatus = 'DRAFT' | 'TO_ISSUE' | 'PARTIAL' | 'ISSUED'

export interface MaterialIssueSheet {
  issueId: string
  productionOrderId?: string
  taskId: string
  materialSummaryZh: string
  requestedQty: number
  issuedQty: number
  status: MaterialIssueStatus
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// ─── 质检点 / 验收标准单 ──────────────────────
export type QcStandardStatus = 'DRAFT' | 'TO_RELEASE' | 'RELEASED' | 'VOID'

export interface QcStandardSheet {
  standardId: string
  productionOrderId?: string
  taskId: string
  checkpointSummaryZh: string
  acceptanceSummaryZh: string
  samplingSummaryZh?: string
  status: QcStandardStatus
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// ─── 招标单（台账轻量结构） ───────────────────
export interface TenderOrder {
  tenderId: string
  productionOrderId?: string
  taskIds: string[]
  titleZh: string
  targetFactoryIds: string[]
  bidDeadline?: string
  status: TenderOrderStatus
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
  candidateFactoryIds?: string[]
  awardedFactoryId?: string
  awardStatus?: 'PENDING' | 'AWARDED' | 'VOID'
  awardRemark?: string
  awardedAt?: string
  awardedBy?: string
}

// ─── 竞价（执行结构） ─────────────────────────
export type TenderStatus = 'OPEN' | 'CLOSED' | 'AWARDED' | 'OVERDUE' | 'CANCELLED'

export interface TenderBid {
  bidId: string
  factoryId: string
  factoryName: string
  price: number
  currency: string
  deliveryDays: number
  note?: string
  submittedAt: string
}

export interface Tender {
  tenderId: string
  taskIds: string[]
  productionOrderIds: string[]
  deadline: string
  invitedFactoryIds: string[]
  status: TenderStatus
  winnerFactoryId?: string
  winnerBidId?: string
  bids: TenderBid[]
  awardRule: 'LOWEST_PRICE' | 'COMPREHENSIVE'
  createdAt: string
  createdBy: string
  updatedAt: string
  auditLogs: { id: string; action: string; detail: string; at: string; by: string }[]
}

// ─── Seed 时间常量 ────────────────────────────
// Use FIXED dates to avoid hydration mismatch (module-level new Date() produces
// different values on server vs client, causing useReducer initial state divergence).
export const now = new Date('2026-03-12T10:00:00Z')
export const tomorrow = new Date('2026-03-13T10:00:00Z')
export const yesterday = new Date('2026-03-11T10:00:00Z')
export const threeDaysLater = new Date('2026-03-15T10:00:00Z')

// ─── initialTenders ───────────────────────────
export const initialTenders: Tender[] = [
  // 1. 即将截止的竞价 (<24h) - PO-202603-0006 打条工艺
  {
    tenderId: 'TENDER-0002-001',
    taskIds: ['TASK-202603-0006-002', 'TASK-0002-002'],
    productionOrderIds: ['PO-202603-0006', 'PO-2024-0002'],
    deadline: tomorrow.toISOString().replace('T', ' ').slice(0, 19),
    invitedFactoryIds: ['ID-F003', 'ID-F005', 'ID-F008', 'ID-F012'],
    status: 'OPEN',
    bids: [
      { bidId: 'BID-001', factoryId: 'ID-F003', factoryName: 'Tangerang Satellite Cluster', price: 15000, currency: 'IDR', deliveryDays: 5, submittedAt: '2026-03-02 10:00:00' },
      { bidId: 'BID-002', factoryId: 'ID-F005', factoryName: 'Bandung Print House', price: 14500, currency: 'IDR', deliveryDays: 6, submittedAt: '2026-03-02 11:00:00' },
    ],
    awardRule: 'LOWEST_PRICE',
    createdAt: '2026-03-01 10:00:00',
    createdBy: 'Admin',
    updatedAt: '2026-03-02 11:00:00',
    auditLogs: [
      { id: 'TAL-001', action: 'CREATE', detail: '创建竞价招标单', at: '2026-03-01 10:00:00', by: 'Admin' },
    ],
  },
  // 2. 已逾期的竞价
  {
    tenderId: 'TENDER-0005-002',
    taskIds: ['TASK-0005-003'],
    productionOrderIds: ['PO-2024-0005'],
    deadline: yesterday.toISOString().replace('T', ' ').slice(0, 19),
    invitedFactoryIds: ['ID-F007', 'ID-F009', 'ID-F011'],
    status: 'OVERDUE',
    bids: [],
    awardRule: 'LOWEST_PRICE',
    createdAt: '2026-02-25 09:00:00',
    createdBy: 'Admin',
    updatedAt: yesterday.toISOString().replace('T', ' ').slice(0, 19),
    auditLogs: [
      { id: 'TAL-002', action: 'CREATE', detail: '创建竞价招标单', at: '2026-02-25 09:00:00', by: 'Admin' },
      { id: 'TAL-003', action: 'OVERDUE', detail: '竞价已逾期', at: yesterday.toISOString().replace('T', ' ').slice(0, 19), by: '系统' },
    ],
  },
  // 3. 已中标的竞价
  {
    tenderId: 'TENDER-0005-001',
    taskIds: ['TASK-0005-002'],
    productionOrderIds: ['PO-2024-0005'],
    deadline: '2026-02-20 18:00:00',
    invitedFactoryIds: ['ID-F010', 'ID-F012', 'ID-F014'],
    status: 'AWARDED',
    winnerFactoryId: 'ID-F010',
    winnerBidId: 'BID-003',
    bids: [
      { bidId: 'BID-003', factoryId: 'ID-F010', factoryName: 'Jakarta Special Process', price: 28000, currency: 'IDR', deliveryDays: 7, submittedAt: '2026-02-19 14:00:00' },
      { bidId: 'BID-004', factoryId: 'ID-F012', factoryName: 'Cimahi Micro Sewing', price: 30000, currency: 'IDR', deliveryDays: 6, submittedAt: '2026-02-19 15:00:00' },
    ],
    awardRule: 'LOWEST_PRICE',
    createdAt: '2026-02-15 10:00:00',
    createdBy: 'Admin',
    updatedAt: '2026-02-20 18:30:00',
    auditLogs: [
      { id: 'TAL-004', action: 'CREATE', detail: '创建竞价招标单', at: '2026-02-15 10:00:00', by: 'Admin' },
      { id: 'TAL-005', action: 'AWARD', detail: '定标完成，中标工厂: ID-F010', at: '2026-02-20 18:30:00', by: 'Admin' },
    ],
  },
  // 4. 正常进行中的竞价 (>24h)
  {
    tenderId: 'TENDER-NEW-001',
    taskIds: ['TASK-NEW-001', 'TASK-NEW-002'],
    productionOrderIds: ['PO-2024-0010'],
    deadline: threeDaysLater.toISOString().replace('T', ' ').slice(0, 19),
    invitedFactoryIds: ['ID-F001', 'ID-F002', 'ID-F003', 'ID-F004', 'ID-F005'],
    status: 'OPEN',
    bids: [
      { bidId: 'BID-005', factoryId: 'ID-F001', factoryName: 'Jakarta Central Factory', price: 12000, currency: 'IDR', deliveryDays: 4, submittedAt: '2026-03-02 09:00:00' },
    ],
    awardRule: 'LOWEST_PRICE',
    createdAt: '2026-03-01 14:00:00',
    createdBy: 'Admin',
    updatedAt: '2026-03-02 09:00:00',
    auditLogs: [
      { id: 'TAL-006', action: 'CREATE', detail: '创建竞价招标单', at: '2026-03-01 14:00:00', by: 'Admin' },
    ],
  },
]

// ─── initialTenderOrders ──────────────────────
export const initialTenderOrders: TenderOrder[] = [
  { tenderId: 'TD-202603-0001', taskIds: ['TASK-0002-001'], titleZh: '染色工序竞价招标', targetFactoryIds: ['ID-F005', 'ID-F007'], bidDeadline: '2026-03-10 18:00:00', status: 'OPEN', createdAt: '2026-03-01 10:00:00', createdBy: '管理员', updatedAt: '2026-03-01 10:00:00', updatedBy: '管理员' },
  { tenderId: 'TD-202603-0002', taskIds: ['TASK-0005-002', 'TASK-0005-003'], titleZh: '车缝及后整竞价', targetFactoryIds: ['ID-F006'], bidDeadline: '2026-03-08 12:00:00', status: 'CLOSED', createdAt: '2026-02-28 09:00:00', createdBy: '管理员', updatedAt: '2026-03-08 12:01:00', updatedBy: '管理员' },
  { tenderId: 'TD-202603-0003', taskIds: ['TASK-0007-001'], titleZh: '打条竞价招标单', targetFactoryIds: [], bidDeadline: '2026-03-15 18:00:00', status: 'DRAFT', createdAt: '2026-03-05 14:00:00', createdBy: '管理员' },
]

// ─── initialMaterialIssueSheets ───────────────
export const initialMaterialIssueSheets: MaterialIssueSheet[] = [
  { issueId: 'MIS-202603-1001', taskId: 'TASK-0002-001', productionOrderId: 'PO-202603-001', materialSummaryZh: '主面料 × 100m', requestedQty: 100, issuedQty: 0, status: 'DRAFT', createdAt: '2026-03-01 09:00:00', createdBy: '管理员' },
  { issueId: 'MIS-202603-1002', taskId: 'TASK-0005-002', productionOrderId: 'PO-202603-002', materialSummaryZh: '辅料（纽扣）× 500个', requestedQty: 500, issuedQty: 200, status: 'PARTIAL', createdAt: '2026-03-02 10:00:00', createdBy: '管理员', updatedAt: '2026-03-05 15:00:00', updatedBy: '管理员' },
  { issueId: 'MIS-202603-1003', taskId: 'TASK-0007-001', productionOrderId: 'PO-202603-003', materialSummaryZh: '里布 × 80m', requestedQty: 80, issuedQty: 80, status: 'ISSUED', createdAt: '2026-03-03 11:00:00', createdBy: '管理员', updatedAt: '2026-03-06 09:00:00', updatedBy: '管理员' },
  { issueId: 'MIS-202603-2001', taskId: 'TASK-202603-0003-001', productionOrderId: 'PO-202603-0003', materialSummaryZh: '主面料 6000 片，领底衬 6000 片', requestedQty: 12000, issuedQty: 0, status: 'DRAFT', createdAt: '2026-03-05 11:00:00', createdBy: '管理员' },
  { issueId: 'MIS-202603-2002', taskId: 'TASK-202603-0005-001', productionOrderId: 'PO-202603-0005', materialSummaryZh: '主面料 3200 片，辅料包 3200 套', requestedQty: 6400, issuedQty: 3200, status: 'PARTIAL', createdAt: '2026-03-03 17:00:00', createdBy: '管理员', updatedAt: '2026-03-04 15:00:00', updatedBy: '管理员' },
  { issueId: 'MIS-202603-2003', taskId: 'TASK-202603-0005-003', productionOrderId: 'PO-202603-0005', materialSummaryZh: '缝制辅料包 3200 套', requestedQty: 3200, issuedQty: 0, status: 'TO_ISSUE', createdAt: '2026-03-05 12:00:00', createdBy: '管理员' },
  { issueId: 'MIS-202603-2004', taskId: 'TASK-202603-0006-001', productionOrderId: 'PO-202603-0006', materialSummaryZh: '主面料 1500 片，门襟衬 1500 片', requestedQty: 3000, issuedQty: 3000, status: 'ISSUED', createdAt: '2026-03-01 10:30:00', createdBy: '管理员', updatedAt: '2026-03-01 11:30:00', updatedBy: '管理员' },
]

// ─── initialQcStandardSheets ──────────────────
export const initialQcStandardSheets: QcStandardSheet[] = [
  { standardId: 'QCS-202603-1001', taskId: 'TASK-0002-001', productionOrderId: 'PO-202603-001', checkpointSummaryZh: '色差检查（对色色差≤1级）', acceptanceSummaryZh: '抽检率 5%，色差不超过 AQL 1.5', status: 'RELEASED', createdAt: '2026-03-01 09:00:00', createdBy: '管理员', updatedAt: '2026-03-02 10:00:00', updatedBy: '管理员' },
  { standardId: 'QCS-202603-1002', taskId: 'TASK-0005-002', productionOrderId: 'PO-202603-002', checkpointSummaryZh: '车缝针距检查（12针/寸）', acceptanceSummaryZh: '针距均匀，无跳针，不允许断线', samplingSummaryZh: '每批次抽取 3 件', status: 'TO_RELEASE', createdAt: '2026-03-03 11:00:00', createdBy: '管理员' },
  { standardId: 'QCS-202603-1003', taskId: 'TASK-0007-001', checkpointSummaryZh: '成品尺寸核查', acceptanceSummaryZh: '尺寸偏差不超过 ±0.5cm', status: 'DRAFT', createdAt: '2026-03-05 14:00:00', createdBy: '管理员' },
  { standardId: 'QCS-202603-2001', taskId: 'TASK-202603-0003-004', productionOrderId: 'PO-202603-0003', checkpointSummaryZh: '终检：尺寸、外观、做工一致性', acceptanceSummaryZh: '抽检率 5%，不允许严重外观缺陷', samplingSummaryZh: '每批随机抽 20 件', status: 'RELEASED', createdAt: '2026-03-05 13:00:00', createdBy: '管理员', updatedAt: '2026-03-05 15:00:00', updatedBy: '管理员' },
  { standardId: 'QCS-202603-2002', taskId: 'TASK-202603-0005-002', productionOrderId: 'PO-202603-0005', checkpointSummaryZh: '染印：色牢度、图案清晰度', acceptanceSummaryZh: '色差不超过 1 级，不允许明显缺印', samplingSummaryZh: '首件 + 中段 + 尾段各抽 5 件', status: 'RELEASED', createdAt: '2026-03-04 10:00:00', createdBy: '管理员', updatedAt: '2026-03-04 12:00:00', updatedBy: '管理员' },
  { standardId: 'QCS-202603-2003', taskId: 'TASK-202603-0005-003', productionOrderId: 'PO-202603-0005', checkpointSummaryZh: '车缝：针距、拼缝、止口', acceptanceSummaryZh: '不允许跳针、断线、明显爆口', samplingSummaryZh: '每批抽 10 件', status: 'TO_RELEASE', createdAt: '2026-03-05 14:00:00', createdBy: '管理员' },
  { standardId: 'QCS-202603-2004', taskId: 'TASK-202603-0006-002', productionOrderId: 'PO-202603-0006', checkpointSummaryZh: '车缝：门襟、袖口、下摆一致性', acceptanceSummaryZh: '尺寸偏差不超过 ±0.5cm', samplingSummaryZh: '首件确认后批量生产', status: 'DRAFT', createdAt: '2026-03-04 09:30:00', createdBy: '管理员' },
]
