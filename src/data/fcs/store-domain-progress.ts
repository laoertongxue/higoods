// =============================================
// store-domain-progress.ts
// 进度域静态类型、生成器和 seed 数据
// 从 fcs-store.tsx 抽出，不引入 React
// =============================================

// =============================================
// ExceptionCase 相关
// =============================================
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_EXTERNAL' | 'RESOLVED' | 'CLOSED'
export type Severity = 'S1' | 'S2' | 'S3'
export type ExceptionCategory = 'PRODUCTION_BLOCK' | 'ASSIGNMENT' | 'TECH_PACK' | 'HANDOVER' | 'MATERIAL'
export type ReasonCode =
  // 生产阻塞
  | 'BLOCKED_MATERIAL' | 'BLOCKED_CAPACITY' | 'BLOCKED_QUALITY' | 'BLOCKED_TECH' | 'BLOCKED_EQUIPMENT' | 'BLOCKED_OTHER'
  // 分配异常
  | 'TENDER_OVERDUE' | 'TENDER_NEAR_DEADLINE' | 'NO_BID' | 'PRICE_ABNORMAL' | 'DISPATCH_REJECTED' | 'ACK_TIMEOUT'
  // 技术包
  | 'TECH_PACK_NOT_RELEASED'
  // 工厂风险
  | 'FACTORY_BLACKLISTED'
  // 交接/领料
  | 'HANDOVER_DIFF' | 'MATERIAL_NOT_READY'

export interface ExceptionAction {
  id: string
  actionType: string
  actionDetail: string
  at: string
  by: string
}

export interface ExceptionAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface ExceptionCase {
  caseId: string
  caseStatus: CaseStatus
  severity: Severity
  category: ExceptionCategory
  reasonCode: ReasonCode
  sourceType: 'TASK' | 'ORDER' | 'TENDER'
  sourceId: string
  relatedOrderIds: string[]
  relatedTaskIds: string[]
  relatedTenderIds: string[]
  ownerUserId?: string
  ownerUserName?: string
  summary: string
  detail: string
  createdAt: string
  updatedAt: string
  slaDueAt: string
  resolvedAt?: string
  resolvedBy?: string
  tags: string[]
  actions: ExceptionAction[]
  auditLogs: ExceptionAuditLog[]
}

// SLA 配置（小时）
const SLA_HOURS: Record<Severity, number> = { S1: 8, S2: 24, S3: 72 }

// 计算 SLA 截止时间
export function calculateSlaDue(severity: Severity, createdAt: string): string {
  const d = new Date(createdAt.replace(' ', 'T'))
  d.setHours(d.getHours() + SLA_HOURS[severity])
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

// 生成异常号
export function generateCaseId(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `EX-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// seed 时间辅助
const nowDate = new Date()
const mockNow = nowDate.toISOString().replace('T', ' ').slice(0, 19)
const eightHoursAgo = new Date(nowDate.getTime() - 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const sixHoursLater = new Date(nowDate.getTime() + 6 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const twoHoursLater = new Date(nowDate.getTime() + 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const twoDaysAgo = new Date(nowDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const oneDayAgo = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

export const initialExceptions: ExceptionCase[] = [
  // S1 - 竞价逾期
  {
    caseId: 'EX-202603-0001',
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'ASSIGNMENT',
    reasonCode: 'TENDER_OVERDUE',
    sourceType: 'TENDER',
    sourceId: 'TENDER-0005-002',
    relatedOrderIds: ['PO-202603-0005'],
    relatedTaskIds: ['TASK-0005-003'],
    relatedTenderIds: ['TENDER-0005-002'],
    summary: '竞价已逾期，无人中标',
    detail: '招标单 TENDER-0005-002 已逾期，当前无任何报价，需紧急处理',
    createdAt: oneDayAgo,
    updatedAt: mockNow,
    slaDueAt: eightHoursAgo,
    tags: ['紧急', '竞价'],
    actions: [],
    auditLogs: [
      { id: 'EAL-001', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S1 - 物料阻塞（交期临近）
  {
    caseId: 'EX-202603-0002',
    caseStatus: 'IN_PROGRESS',
    severity: 'S1',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_MATERIAL',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-001',
    relatedOrderIds: ['PO-202603-0004'],
    relatedTaskIds: ['TASK-BLOCKED-001'],
    relatedTenderIds: [],
    ownerUserId: 'U002',
    ownerUserName: '跟单A',
    summary: '物料阻塞 - 等待绣花线到货',
    detail: '绣花工序因等待绣花线到货而阻塞，预计3天到货',
    createdAt: twoDaysAgo,
    updatedAt: mockNow,
    slaDueAt: eightHoursAgo,
    tags: ['物料', '阻塞'],
    actions: [
      { id: 'EA-001', actionType: 'CONTACT_SUPPLIER', actionDetail: '已联系供应商催货', at: oneDayAgo, by: '跟单A' },
    ],
    auditLogs: [
      { id: 'EAL-002', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
      { id: 'EAL-003', action: 'ASSIGN', detail: '指派给跟单A', at: twoDaysAgo, by: 'Admin' },
      { id: 'EAL-004', action: 'STATUS_CHANGE', detail: 'OPEN -> IN_PROGRESS', at: oneDayAgo, by: '跟单A' },
    ],
  },
  // S1 - 派单拒单
  {
    caseId: 'EX-202603-0003',
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'ASSIGNMENT',
    reasonCode: 'DISPATCH_REJECTED',
    sourceType: 'TASK',
    sourceId: 'TASK-0001-003',
    relatedOrderIds: ['PO-202603-0004'],
    relatedTaskIds: ['TASK-0001-003'],
    relatedTenderIds: [],
    summary: '派单被工厂拒绝',
    detail: '任务 TASK-0001-003 派单被 ID-F003 拒绝，原因：产能已满',
    createdAt: oneDayAgo,
    updatedAt: oneDayAgo,
    slaDueAt: sixHoursLater,
    tags: ['派单', '拒单'],
    actions: [],
    auditLogs: [
      { id: 'EAL-005', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S2 - 产能阻塞
  {
    caseId: 'EX-202603-0004',
    caseStatus: 'WAITING_EXTERNAL',
    severity: 'S2',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_CAPACITY',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-002',
    relatedOrderIds: ['PO-202603-0007'],
    relatedTaskIds: ['TASK-BLOCKED-002'],
    relatedTenderIds: [],
    ownerUserId: 'U003',
    ownerUserName: '跟单B',
    summary: '产能阻塞 - 工厂排期已满',
    detail: '压褶工序因工厂产能排满而阻塞，需要协调排期',
    createdAt: twoDaysAgo,
    updatedAt: mockNow,
    slaDueAt: oneDayAgo,
    tags: ['产能', '阻塞'],
    actions: [],
    auditLogs: [
      { id: 'EAL-006', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
      { id: 'EAL-007', action: 'STATUS_CHANGE', detail: 'OPEN -> WAITING_EXTERNAL', at: oneDayAgo, by: '跟单B' },
    ],
  },
  // S2 - 质量返工
  {
    caseId: 'EX-202603-0005',
    caseStatus: 'IN_PROGRESS',
    severity: 'S2',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_QUALITY',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-003',
    relatedOrderIds: ['PO-202603-0005'],
    relatedTaskIds: ['TASK-BLOCKED-003'],
    relatedTenderIds: [],
    ownerUserId: 'U002',
    ownerUserName: '跟单A',
    summary: '质量问题 - 线迹不良率过高',
    detail: 'QC发现车缝线迹不良率过高，需返工处理',
    createdAt: oneDayAgo,
    updatedAt: mockNow,
    slaDueAt: mockNow,
    tags: ['质量', '返工'],
    actions: [],
    auditLogs: [
      { id: 'EAL-008', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S2 - 技术包未发布
  {
    caseId: 'EX-202603-0006',
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'TECH_PACK',
    reasonCode: 'TECH_PACK_NOT_RELEASED',
    sourceType: 'ORDER',
    sourceId: 'PO-202603-0003',
    relatedOrderIds: ['PO-202603-0003'],
    relatedTaskIds: [],
    relatedTenderIds: [],
    summary: '技术包未发布',
    detail: '订单 PO-202603-0003 关联的技术包尚未发布，无法开始生产',
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    slaDueAt: oneDayAgo,
    tags: ['技术包'],
    actions: [],
    auditLogs: [
      { id: 'EAL-009', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
    ],
  },
  // S2 - 竞价临近截止
  {
    caseId: 'EX-202603-0007',
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'ASSIGNMENT',
    reasonCode: 'TENDER_NEAR_DEADLINE',
    sourceType: 'TENDER',
    sourceId: 'TENDER-0002-001',
    relatedOrderIds: ['PO-202603-0006', 'PO-202603-0007'],
    relatedTaskIds: ['TASK-202603-0006-002', 'TASK-0002-002'],
    relatedTenderIds: ['TENDER-0002-001'],
    summary: '竞价即将截止',
    detail: '招标单 TENDER-0002-001 将在24小时内截止，当前有2个报价',
    createdAt: mockNow,
    updatedAt: mockNow,
    slaDueAt: new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    tags: ['竞价', '临近截止'],
    actions: [],
    auditLogs: [
      { id: 'EAL-010', action: 'CREATE', detail: '系统自动生成异常单', at: mockNow, by: '系统' },
    ],
  },
  // S2 - 工艺资料阻塞
  {
    caseId: 'EX-202603-0008',
    caseStatus: 'WAITING_EXTERNAL',
    severity: 'S2',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_TECH',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-004',
    relatedOrderIds: ['PO-202603-0007'],
    relatedTaskIds: ['TASK-BLOCKED-004'],
    relatedTenderIds: ['TENDER-0007-001'],
    ownerUserId: 'U004',
    ownerUserName: '运营',
    summary: '工艺资料阻塞 - 洗水效果待确认',
    detail: '洗水效果样尚未确认，等待客户批复',
    createdAt: twoDaysAgo,
    updatedAt: mockNow,
    slaDueAt: mockNow,
    tags: ['工艺', '待确认'],
    actions: [],
    auditLogs: [
      { id: 'EAL-011', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
      { id: 'EAL-012', action: 'STATUS_CHANGE', detail: 'OPEN -> WAITING_EXTERNAL', at: oneDayAgo, by: '运营' },
    ],
  },
  // S2 - 设备阻塞
  {
    caseId: 'EX-202603-0009',
    caseStatus: 'IN_PROGRESS',
    severity: 'S2',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_EQUIPMENT',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-005',
    relatedOrderIds: ['PO-202603-0009'],
    relatedTaskIds: ['TASK-BLOCKED-005'],
    relatedTenderIds: [],
    ownerUserId: 'U002',
    ownerUserName: '跟单A',
    summary: '设备故障 - 扣眼机维修中',
    detail: '扣眼机故障维修中，预计明日恢复',
    createdAt: oneDayAgo,
    updatedAt: mockNow,
    slaDueAt: new Date(nowDate.getTime() + 12 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    tags: ['设备', '维修'],
    actions: [],
    auditLogs: [
      { id: 'EAL-013', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S3 - 其他阻塞
  {
    caseId: 'EX-202603-0010',
    caseStatus: 'RESOLVED',
    severity: 'S3',
    category: 'PRODUCTION_BLOCK',
    reasonCode: 'BLOCKED_OTHER',
    sourceType: 'TASK',
    sourceId: 'TASK-BLOCKED-006',
    relatedOrderIds: ['PO-202603-0011'],
    relatedTaskIds: ['TASK-BLOCKED-006'],
    relatedTenderIds: ['TENDER-0011-001'],
    summary: '假期阻塞 - 工人返乡',
    detail: '春节假期工人返乡，节后恢复',
    createdAt: twoDaysAgo,
    updatedAt: mockNow,
    slaDueAt: new Date(nowDate.getTime() + 48 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    tags: ['假期'],
    actions: [
      { id: 'EA-002', actionType: 'SCHEDULE', actionDetail: '已安排节后优先处理', at: oneDayAgo, by: '运营' },
    ],
    auditLogs: [
      { id: 'EAL-014', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
      { id: 'EAL-015', action: 'STATUS_CHANGE', detail: 'OPEN -> RESOLVED', at: mockNow, by: '运营' },
    ],
  },
  // S1 - 工厂黑名单
  {
    caseId: 'EX-202603-0011',
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'ASSIGNMENT',
    reasonCode: 'FACTORY_BLACKLISTED',
    sourceType: 'TASK',
    sourceId: 'TASK-0003-001',
    relatedOrderIds: ['PO-202603-0003'],
    relatedTaskIds: ['TASK-0003-001'],
    relatedTenderIds: [],
    summary: '工厂已被列入黑名单',
    detail: '任务分配的工厂 ID-F007 已被列入黑名单，需重新分配',
    createdAt: mockNow,
    updatedAt: mockNow,
    slaDueAt: sixHoursLater,
    tags: ['黑名单', '工厂'],
    actions: [],
    auditLogs: [
      { id: 'EAL-016', action: 'CREATE', detail: '系统自动生成异常单', at: mockNow, by: '系统' },
    ],
  },
  // S2 - 确认超时
  {
    caseId: 'EX-202603-0012',
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'ASSIGNMENT',
    reasonCode: 'ACK_TIMEOUT',
    sourceType: 'TASK',
    sourceId: 'TASK-0004-002',
    relatedOrderIds: ['PO-202603-0004'],
    relatedTaskIds: ['TASK-0004-002'],
    relatedTenderIds: [],
    summary: '派单确认超时',
    detail: '任务 TASK-0004-002 派单后工厂超过24小时未确认',
    createdAt: oneDayAgo,
    updatedAt: oneDayAgo,
    slaDueAt: mockNow,
    tags: ['派单', '超时'],
    actions: [],
    auditLogs: [
      { id: 'EAL-017', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S3 - 无人报价
  {
    caseId: 'EX-202603-0013',
    caseStatus: 'CLOSED',
    severity: 'S3',
    category: 'ASSIGNMENT',
    reasonCode: 'NO_BID',
    sourceType: 'TENDER',
    sourceId: 'TENDER-OLD-001',
    relatedOrderIds: ['PO-202603-0006'],
    relatedTaskIds: ['TASK-0006-001'],
    relatedTenderIds: ['TENDER-OLD-001'],
    summary: '竞价无人报价（已解决）',
    detail: '招标单无人报价，已转为派单处理',
    createdAt: twoDaysAgo,
    updatedAt: oneDayAgo,
    slaDueAt: twoDaysAgo,
    tags: ['竞价', '已关闭'],
    actions: [
      { id: 'EA-003', actionType: 'CONVERT_TO_DISPATCH', actionDetail: '转为派单处理', at: oneDayAgo, by: 'Admin' },
    ],
    auditLogs: [
      { id: 'EAL-018', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
      { id: 'EAL-019', action: 'STATUS_CHANGE', detail: 'OPEN -> CLOSED', at: oneDayAgo, by: 'Admin' },
    ],
  },
  // S2 - 交接差异
  {
    caseId: 'EX-202603-0014',
    caseStatus: 'WAITING_EXTERNAL',
    severity: 'S2',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType: 'TASK',
    sourceId: 'TASK-0007-003',
    relatedOrderIds: ['PO-202603-0007'],
    relatedTaskIds: ['TASK-0007-003'],
    relatedTenderIds: [],
    ownerUserId: 'U003',
    ownerUserName: '跟单B',
    summary: '交接数量差异',
    detail: '工序交接时发现数量差异，少收50件',
    createdAt: oneDayAgo,
    updatedAt: mockNow,
    slaDueAt: sixHoursLater,
    tags: ['交接', '差异'],
    actions: [],
    auditLogs: [
      { id: 'EAL-020', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
    ],
  },
  // S1 - 交接差异 - 争议
  {
    caseId: 'EX-202603-0016',
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType: 'TASK',
    sourceId: 'TASK-0005-001',
    relatedOrderIds: ['PO-202603-0005'],
    relatedTaskIds: ['TASK-0005-001'],
    relatedTenderIds: [],
    summary: '裁片交接争议 - 短缺50件',
    detail: '裁片交接至印花厂时发现短缺50件，双方存在争议',
    createdAt: twoDaysAgo,
    updatedAt: mockNow,
    slaDueAt: sixHoursLater,
    tags: ['交接', '争议', '差异'],
    actions: [],
    auditLogs: [
      { id: 'EAL-022', action: 'CREATE', detail: '系统自动生成异常单', at: twoDaysAgo, by: '系统' },
    ],
  },
  // S1 - 交接差异 - 损耗
  {
    caseId: 'EX-202603-0017',
    caseStatus: 'IN_PROGRESS',
    severity: 'S1',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType: 'ORDER',
    sourceId: 'PO-2024-0002',
    relatedOrderIds: ['PO-202603-0007'],
    relatedTaskIds: ['TASK-0002-001'],
    relatedTenderIds: [],
    ownerUserId: 'U002',
    ownerUserName: '跟单A',
    summary: '裁片交接差异 - 运输丢失',
    detail: '裁片交接短缺20件，原因为运输途中丢失',
    createdAt: oneDayAgo,
    updatedAt: mockNow,
    slaDueAt: twoHoursLater,
    tags: ['交接', '差异', '运输'],
    actions: [],
    auditLogs: [
      { id: 'EAL-023', action: 'CREATE', detail: '系统自动生成异常单', at: oneDayAgo, by: '系统' },
      { id: 'EAL-024', action: 'ASSIGN', detail: '指派给跟单A', at: mockNow, by: 'Admin' },
    ],
  },
  // S2 - 交接差异 - 混批
  {
    caseId: 'EX-202603-0018',
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType: 'ORDER',
    sourceId: 'PO-2024-0010',
    relatedOrderIds: ['PO-202603-0010'],
    relatedTaskIds: [],
    relatedTenderIds: [],
    summary: '交接混批问题',
    detail: '发现交接裁片混入其他批次，需核实分拣',
    createdAt: mockNow,
    updatedAt: mockNow,
    slaDueAt: new Date(nowDate.getTime() + 12 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    tags: ['交接', '混批'],
    actions: [],
    auditLogs: [
      { id: 'EAL-025', action: 'CREATE', detail: '系统自动生成异常单', at: mockNow, by: '系统' },
    ],
  },
  // S1 - 交接差异 - 未知原因
  {
    caseId: 'EX-202603-0019',
    caseStatus: 'OPEN',
    severity: 'S1',
    category: 'HANDOVER',
    reasonCode: 'HANDOVER_DIFF',
    sourceType: 'ORDER',
    sourceId: 'PO-202603-0005',
    relatedOrderIds: ['PO-202603-0005'],
    relatedTaskIds: [],
    relatedTenderIds: [],
    summary: '交接差异原因待查',
    detail: '交接时发现短缺30件，差异原因待核实',
    createdAt: mockNow,
    updatedAt: mockNow,
    slaDueAt: twoHoursLater,
    tags: ['交接', '差异', '待查'],
    actions: [],
    auditLogs: [
      { id: 'EAL-026', action: 'CREATE', detail: '系统自动生成异常单', at: mockNow, by: '系统' },
    ],
  },
  // S2 - 物料未齐套
  {
    caseId: 'EX-202603-0015',
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'MATERIAL',
    reasonCode: 'MATERIAL_NOT_READY',
    sourceType: 'TASK',
    sourceId: 'TASK-0008-001',
    relatedOrderIds: ['PO-202603-0008'],
    relatedTaskIds: ['TASK-0008-001'],
    relatedTenderIds: [],
    summary: '物料未齐套',
    detail: '辅料（拉链）尚未到货，无法开始生产',
    createdAt: mockNow,
    updatedAt: mockNow,
    slaDueAt: new Date(nowDate.getTime() + 20 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
    tags: ['物料', '齐套'],
    actions: [],
    auditLogs: [
      { id: 'EAL-021', action: 'CREATE', detail: '系统自动生成异常单', at: mockNow, by: '系统' },
    ],
  },
  // 演示专用：与 202603-0003~0006 对齐
  {
    caseId: 'EX-202603-2001', caseStatus: 'OPEN', severity: 'S2', category: 'ASSIGNMENT', reasonCode: 'DISPATCH_REJECTED',
    sourceType: 'TASK', sourceId: 'TASK-202603-0006-003',
    relatedOrderIds: ['PO-202603-0006'], relatedTaskIds: ['TASK-202603-0006-003'], relatedTenderIds: [],
    ownerUserId: 'U002', ownerUserName: '跟单A',
    summary: '钉扣任务被候选工厂拒单',
    detail: '候选工厂反馈当前钉扣机台排期已满，无法在要求交期内接单',
    createdAt: '2026-03-06 09:00:00', updatedAt: '2026-03-06 09:00:00', slaDueAt: '2026-03-07 09:00:00',
    tags: ['拒单', '重新分配'],
    actions: [{ id: 'EXA-202603-2001-01', actionType: 'CREATE', actionDetail: '系统自动创建异常单', at: '2026-03-06 09:00:00', by: '系统' }],
    auditLogs: [{ id: 'EXL-202603-2001-01', action: 'CREATE', detail: '创建异常：拒单', at: '2026-03-06 09:00:00', by: '系统' }],
  },
  {
    caseId: 'EX-202603-2002', caseStatus: 'IN_PROGRESS', severity: 'S2', category: 'ASSIGNMENT', reasonCode: 'ACK_TIMEOUT',
    sourceType: 'TASK', sourceId: 'TASK-202603-0005-003',
    relatedOrderIds: ['PO-202603-0005'], relatedTaskIds: ['TASK-202603-0005-003'], relatedTenderIds: [],
    ownerUserId: 'U003', ownerUserName: '跟单B',
    summary: '车缝任务派单超时未确认',
    detail: '已向主工厂发起直接派单，但超过确认时限仍未回执',
    createdAt: '2026-03-06 14:00:00', updatedAt: '2026-03-06 16:00:00', slaDueAt: '2026-03-07 14:00:00',
    tags: ['派单超时', '待确认'],
    actions: [
      { id: 'EXA-202603-2002-01', actionType: 'CREATE', actionDetail: '创建派单超时异常', at: '2026-03-06 14:00:00', by: '系统' },
      { id: 'EXA-202603-2002-02', actionType: 'FOLLOW_UP', actionDetail: '已电话跟催工厂确认', at: '2026-03-06 16:00:00', by: '跟单B' },
    ],
    auditLogs: [{ id: 'EXL-202603-2002-01', action: 'CREATE', detail: '创建异常：派单超时', at: '2026-03-06 14:00:00', by: '系统' }],
  },
  {
    caseId: 'EX-202603-2003', caseStatus: 'WAITING_EXTERNAL', severity: 'S3', category: 'MATERIAL', reasonCode: 'MATERIAL_NOT_READY',
    sourceType: 'TASK', sourceId: 'TASK-202603-0003-002',
    relatedOrderIds: ['PO-202603-0003'], relatedTaskIds: ['TASK-202603-0003-002'], relatedTenderIds: [],
    ownerUserId: 'U004', ownerUserName: '计划员A',
    summary: '车缝辅料未完全齐套',
    detail: '领料单已部分下发，但缝制辅料包尚未完全齐套，待仓储补齐',
    createdAt: '2026-03-06 08:30:00', updatedAt: '2026-03-06 08:30:00', slaDueAt: '2026-03-09 08:30:00',
    tags: ['领料', '待齐套'],
    actions: [{ id: 'EXA-202603-2003-01', actionType: 'CREATE', actionDetail: '创建物料未齐套异常', at: '2026-03-06 08:30:00', by: '系统' }],
    auditLogs: [{ id: 'EXL-202603-2003-01', action: 'CREATE', detail: '创建异常：物料未齐套', at: '2026-03-06 08:30:00', by: '系统' }],
  },
]

// =============================================
// HandoverEvent 相关
// =============================================
export type HandoverEventType = 'CUT_PIECES_TO_MAIN_FACTORY' | 'FINISHED_GOODS_TO_WAREHOUSE' | 'MATERIAL_TO_PROCESSOR'
export type HandoverStatus = 'PENDING_CONFIRM' | 'CONFIRMED' | 'DISPUTED' | 'VOID'
export type DiffReasonCode = 'SHORTAGE' | 'OVERAGE' | 'DAMAGE' | 'MIXED_BATCH' | 'UNKNOWN'
export type PartyKind = 'FACTORY' | 'WAREHOUSE' | 'LEGAL_ENTITY' | 'OTHER'

export interface HandoverParty {
  kind: PartyKind
  id?: string
  name: string
}

export interface HandoverEvidence {
  id: string
  name: string
  type: 'PHOTO' | 'DOC' | 'OTHER'
  url: string
}

export interface HandoverAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface HandoverEvent {
  eventId: string
  productionOrderId: string
  relatedTaskId?: string
  eventType: HandoverEventType
  fromParty: HandoverParty
  toParty: HandoverParty
  qtyExpected: number
  qtyActual: number
  qtyDiff: number
  diffReasonCode?: DiffReasonCode
  diffRemark?: string
  status: HandoverStatus
  occurredAt: string
  createdAt: string
  createdBy: string
  confirmedAt?: string
  confirmedBy?: string
  evidence: HandoverEvidence[]
  auditLogs: HandoverAuditLog[]
}

export function generateHandoverEventId(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `HV-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export const initialHandoverEvents: HandoverEvent[] = [
  // 1. 待确认 - 裁片交接
  {
    eventId: 'HV-202603-0001',
    productionOrderId: 'PO-202603-0004',
    relatedTaskId: 'TASK-0001-001',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F001', name: 'Jakarta Central Factory' },
    qtyExpected: 1000, qtyActual: 1000, qtyDiff: 0,
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-01 10:00:00', createdAt: '2026-03-01 10:30:00', createdBy: 'Admin',
    evidence: [{ id: 'E001', name: '交接单照片.jpg', type: 'PHOTO', url: '/mock/handover1.jpg' }],
    auditLogs: [{ id: 'HAL-001', action: 'CREATE', detail: '创建交接事件', at: '2026-03-01 10:30:00', by: 'Admin' }],
  },
  // 2. 待确认 - 有差异
  {
    eventId: 'HV-202603-0002',
    productionOrderId: 'PO-202603-0007',
    relatedTaskId: 'TASK-0002-001',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F003', name: 'Tangerang Satellite Cluster' },
    qtyExpected: 800, qtyActual: 780, qtyDiff: -20,
    diffReasonCode: 'SHORTAGE', diffRemark: '运输途中丢失20件',
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-01 14:00:00', createdAt: '2026-03-01 14:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-002', action: 'CREATE', detail: '创建交接事件', at: '2026-03-01 14:30:00', by: 'Admin' }],
  },
  // 3. 已确认
  {
    eventId: 'HV-202603-0003',
    productionOrderId: 'PO-202603-0003',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F004', name: 'Bekasi Sewing Hub' },
    qtyExpected: 500, qtyActual: 500, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-02-28 09:00:00', createdAt: '2026-02-28 09:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-28 10:00:00', confirmedBy: '跟单A',
    evidence: [{ id: 'E002', name: '签收单.pdf', type: 'DOC', url: '/mock/receipt1.pdf' }],
    auditLogs: [
      { id: 'HAL-003', action: 'CREATE', detail: '创建交接事件', at: '2026-02-28 09:30:00', by: 'Admin' },
      { id: 'HAL-004', action: 'CONFIRM', detail: '确认交接', at: '2026-02-28 10:00:00', by: '跟单A' },
    ],
  },
  // 4. 争议 - 差异
  {
    eventId: 'HV-202603-0004',
    productionOrderId: 'PO-202603-0005',
    relatedTaskId: 'TASK-0005-001',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F005', name: 'Bandung Print House' },
    qtyExpected: 600, qtyActual: 550, qtyDiff: -50,
    diffReasonCode: 'SHORTAGE', diffRemark: '实际收货少50件，需核实',
    status: 'DISPUTED',
    occurredAt: '2026-02-27 11:00:00', createdAt: '2026-02-27 11:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [
      { id: 'HAL-005', action: 'CREATE', detail: '创建交接事件', at: '2026-02-27 11:30:00', by: 'Admin' },
      { id: 'HAL-006', action: 'DISPUTE', detail: '标记争议：差异数量过大', at: '2026-02-27 14:00:00', by: '跟单B' },
    ],
  },
  // 5. 待确认 - 成衣交接
  {
    eventId: 'HV-202603-0005',
    productionOrderId: 'PO-202603-0004',
    eventType: 'FINISHED_GOODS_TO_WAREHOUSE',
    fromParty: { kind: 'FACTORY', id: 'ID-F004', name: 'Bekasi Sewing Hub' },
    toParty: { kind: 'WAREHOUSE', name: '成品仓库A' },
    qtyExpected: 400, qtyActual: 400, qtyDiff: 0,
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-02 09:00:00', createdAt: '2026-03-02 09:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-007', action: 'CREATE', detail: '创建交接事件', at: '2026-03-02 09:30:00', by: 'Admin' }],
  },
  // 6. 争议 - 损坏
  {
    eventId: 'HV-202603-0006',
    productionOrderId: 'PO-202603-0007',
    relatedTaskId: 'TASK-0007-003',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F006', name: 'Surabaya Embroidery' },
    qtyExpected: 700, qtyActual: 650, qtyDiff: -50,
    diffReasonCode: 'DAMAGE', diffRemark: '50件在运输中损坏',
    status: 'DISPUTED',
    occurredAt: '2026-02-26 15:00:00', createdAt: '2026-02-26 15:30:00', createdBy: 'Admin',
    evidence: [{ id: 'E003', name: '损坏照片.jpg', type: 'PHOTO', url: '/mock/damage1.jpg' }],
    auditLogs: [
      { id: 'HAL-008', action: 'CREATE', detail: '创建交接事件', at: '2026-02-26 15:30:00', by: 'Admin' },
      { id: 'HAL-009', action: 'DISPUTE', detail: '标记争议：货物损坏', at: '2026-02-26 16:00:00', by: '跟单A' },
    ],
  },
  // 7. 已确认 - 超发
  {
    eventId: 'HV-202603-0007',
    productionOrderId: 'PO-202603-0006',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F007', name: 'Yogyakarta Washing' },
    qtyExpected: 300, qtyActual: 310, qtyDiff: 10,
    diffReasonCode: 'OVERAGE', diffRemark: '多发10件备品',
    status: 'CONFIRMED',
    occurredAt: '2026-02-25 10:00:00', createdAt: '2026-02-25 10:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-25 11:00:00', confirmedBy: '跟单B',
    evidence: [],
    auditLogs: [
      { id: 'HAL-010', action: 'CREATE', detail: '创建交接事件', at: '2026-02-25 10:30:00', by: 'Admin' },
      { id: 'HAL-011', action: 'CONFIRM', detail: '确认交接（含超发备品）', at: '2026-02-25 11:00:00', by: '跟单B' },
    ],
  },
  // 8. 待确认
  {
    eventId: 'HV-202603-0008',
    productionOrderId: 'PO-202603-0008',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F008', name: 'Solo Button Factory' },
    qtyExpected: 450, qtyActual: 450, qtyDiff: 0,
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-02 14:00:00', createdAt: '2026-03-02 14:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-012', action: 'CREATE', detail: '创建交接事件', at: '2026-03-02 14:30:00', by: 'Admin' }],
  },
  // 9. 已确认
  {
    eventId: 'HV-202603-0009',
    productionOrderId: 'PO-202603-0009',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F009', name: 'Semarang Pleating' },
    qtyExpected: 550, qtyActual: 550, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-02-24 09:00:00', createdAt: '2026-02-24 09:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-24 10:00:00', confirmedBy: '跟单A',
    evidence: [],
    auditLogs: [
      { id: 'HAL-013', action: 'CREATE', detail: '创建交接事件', at: '2026-02-24 09:30:00', by: 'Admin' },
      { id: 'HAL-014', action: 'CONFIRM', detail: '确认交接', at: '2026-02-24 10:00:00', by: '跟单A' },
    ],
  },
  // 10. 争议 - 混批
  {
    eventId: 'HV-202603-0010',
    productionOrderId: 'PO-202603-0010',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F010', name: 'Jakarta Special Process' },
    qtyExpected: 200, qtyActual: 200, qtyDiff: 0,
    diffReasonCode: 'MIXED_BATCH', diffRemark: '发现混入其他批次裁片',
    status: 'DISPUTED',
    occurredAt: '2026-02-23 11:00:00', createdAt: '2026-02-23 11:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [
      { id: 'HAL-015', action: 'CREATE', detail: '创建交接事件', at: '2026-02-23 11:30:00', by: 'Admin' },
      { id: 'HAL-016', action: 'DISPUTE', detail: '标记争议：混批问题', at: '2026-02-23 14:00:00', by: '跟单B' },
    ],
  },
  // 11. 待确认
  {
    eventId: 'HV-202603-0011',
    productionOrderId: 'PO-202603-0011',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F011', name: 'Malang Knitting' },
    qtyExpected: 350, qtyActual: 340, qtyDiff: -10,
    diffReasonCode: 'SHORTAGE', diffRemark: '少10件',
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-02 16:00:00', createdAt: '2026-03-02 16:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-017', action: 'CREATE', detail: '创建交接事件', at: '2026-03-02 16:30:00', by: 'Admin' }],
  },
  // 12. 已确认
  {
    eventId: 'HV-202603-0012',
    productionOrderId: 'PO-202603-0001',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F012', name: 'Cimahi Micro Sewing' },
    qtyExpected: 600, qtyActual: 600, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-02-22 09:00:00', createdAt: '2026-02-22 09:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-22 10:00:00', confirmedBy: '跟单A',
    evidence: [],
    auditLogs: [
      { id: 'HAL-018', action: 'CREATE', detail: '创建交接事件', at: '2026-02-22 09:30:00', by: 'Admin' },
      { id: 'HAL-019', action: 'CONFIRM', detail: '确认交接', at: '2026-02-22 10:00:00', by: '跟单A' },
    ],
  },
  // 13. 已作废
  {
    eventId: 'HV-202603-0013',
    productionOrderId: 'PO-202603-0002',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F013', name: 'Depok Accessory' },
    qtyExpected: 250, qtyActual: 0, qtyDiff: -250,
    status: 'VOID',
    occurredAt: '2026-02-21 10:00:00', createdAt: '2026-02-21 10:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [
      { id: 'HAL-020', action: 'CREATE', detail: '创建交接事件', at: '2026-02-21 10:30:00', by: 'Admin' },
      { id: 'HAL-021', action: 'VOID', detail: '作废：订单取消', at: '2026-02-21 14:00:00', by: 'Admin' },
    ],
  },
  // 14. 待确认
  {
    eventId: 'HV-202603-0014',
    productionOrderId: 'PO-202603-0003',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F014', name: 'Bogor Packing' },
    qtyExpected: 420, qtyActual: 420, qtyDiff: 0,
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-03 08:00:00', createdAt: '2026-03-03 08:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-022', action: 'CREATE', detail: '创建交接事件', at: '2026-03-03 08:30:00', by: 'Admin' }],
  },
  // 15. 已确认
  {
    eventId: 'HV-202603-0015',
    productionOrderId: 'PO-202603-0004',
    eventType: 'FINISHED_GOODS_TO_WAREHOUSE',
    fromParty: { kind: 'FACTORY', id: 'ID-F001', name: 'Jakarta Central Factory' },
    toParty: { kind: 'WAREHOUSE', name: '成品仓库B' },
    qtyExpected: 500, qtyActual: 500, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-02-20 15:00:00', createdAt: '2026-02-20 15:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-20 16:00:00', confirmedBy: '仓管员',
    evidence: [{ id: 'E004', name: '入库单.pdf', type: 'DOC', url: '/mock/inbound1.pdf' }],
    auditLogs: [
      { id: 'HAL-023', action: 'CREATE', detail: '创建交接事件', at: '2026-02-20 15:30:00', by: 'Admin' },
      { id: 'HAL-024', action: 'CONFIRM', detail: '确认入库', at: '2026-02-20 16:00:00', by: '仓管员' },
    ],
  },
  // 16. 争议
  {
    eventId: 'HV-202603-0016',
    productionOrderId: 'PO-202603-0005',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F015', name: 'Tangerang Washing' },
    qtyExpected: 380, qtyActual: 350, qtyDiff: -30,
    diffReasonCode: 'UNKNOWN', diffRemark: '差异原因待查',
    status: 'DISPUTED',
    occurredAt: '2026-02-19 11:00:00', createdAt: '2026-02-19 11:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [
      { id: 'HAL-025', action: 'CREATE', detail: '创建交接事件', at: '2026-02-19 11:30:00', by: 'Admin' },
      { id: 'HAL-026', action: 'DISPUTE', detail: '标记争议：差异原因不明', at: '2026-02-19 14:00:00', by: '跟单A' },
    ],
  },
  // 17. 待确认 - 物料交接
  {
    eventId: 'HV-202603-0017',
    productionOrderId: 'PO-202603-0006',
    eventType: 'MATERIAL_TO_PROCESSOR',
    fromParty: { kind: 'WAREHOUSE', name: '原料仓库' },
    toParty: { kind: 'FACTORY', id: 'ID-F006', name: 'Surabaya Embroidery' },
    qtyExpected: 1500, qtyActual: 1500, qtyDiff: 0,
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-02 10:00:00', createdAt: '2026-03-02 10:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-027', action: 'CREATE', detail: '创建交接事件', at: '2026-03-02 10:30:00', by: 'Admin' }],
  },
  // 18. 已确认
  {
    eventId: 'HV-202603-0018',
    productionOrderId: 'PO-202603-0004',
    relatedTaskId: 'TASK-0001-002',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F001', name: 'Jakarta Central Factory' },
    toParty: { kind: 'FACTORY', id: 'ID-F003', name: 'Tangerang Satellite Cluster' },
    qtyExpected: 1000, qtyActual: 1000, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-03-01 16:00:00', createdAt: '2026-03-01 16:30:00', createdBy: 'Admin',
    confirmedAt: '2026-03-01 17:00:00', confirmedBy: '跟单B',
    evidence: [],
    auditLogs: [
      { id: 'HAL-028', action: 'CREATE', detail: '创建交接事件', at: '2026-03-01 16:30:00', by: 'Admin' },
      { id: 'HAL-029', action: 'CONFIRM', detail: '确认交接', at: '2026-03-01 17:00:00', by: '跟单B' },
    ],
  },
  // 19. 待确认 - 有差异
  {
    eventId: 'HV-202603-0019',
    productionOrderId: 'PO-202603-0003',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F001', name: 'Jakarta Central Factory' },
    qtyExpected: 500, qtyActual: 480, qtyDiff: -20,
    diffReasonCode: 'DAMAGE', diffRemark: '20件裁片有瑕疵',
    status: 'PENDING_CONFIRM',
    occurredAt: '2026-03-03 09:00:00', createdAt: '2026-03-03 09:30:00', createdBy: 'Admin',
    evidence: [],
    auditLogs: [{ id: 'HAL-030', action: 'CREATE', detail: '创建交接事件', at: '2026-03-03 09:30:00', by: 'Admin' }],
  },
  // 20. 已确认
  {
    eventId: 'HV-202603-0020',
    productionOrderId: 'PO-202603-0004',
    eventType: 'CUT_PIECES_TO_MAIN_FACTORY',
    fromParty: { kind: 'FACTORY', id: 'ID-F002', name: 'Jakarta Cutting Center' },
    toParty: { kind: 'FACTORY', id: 'ID-F004', name: 'Bekasi Sewing Hub' },
    qtyExpected: 400, qtyActual: 400, qtyDiff: 0,
    status: 'CONFIRMED',
    occurredAt: '2026-02-18 10:00:00', createdAt: '2026-02-18 10:30:00', createdBy: 'Admin',
    confirmedAt: '2026-02-18 11:00:00', confirmedBy: '跟单A',
    evidence: [],
    auditLogs: [
      { id: 'HAL-031', action: 'CREATE', detail: '创建交接事件', at: '2026-02-18 10:30:00', by: 'Admin' },
      { id: 'HAL-032', action: 'CONFIRM', detail: '确认交接', at: '2026-02-18 11:00:00', by: '跟单A' },
    ],
  },
]

// =============================================
// InternalUser（内部用户）
// =============================================
export interface InternalUser {
  id: string
  name: string
  role: 'ADMIN' | 'MERCHANDISER' | 'OPERATOR' | 'FINANCE'
  email?: string
}

export const mockInternalUsers: InternalUser[] = [
  { id: 'U001', name: '管理员', role: 'ADMIN', email: 'admin@higood.com' },
  { id: 'U002', name: '跟单A', role: 'MERCHANDISER', email: 'merch.a@higood.com' },
  { id: 'U003', name: '跟单B', role: 'MERCHANDISER', email: 'merch.b@higood.com' },
  { id: 'U004', name: '运营A', role: 'OPERATOR', email: 'ops.a@higood.com' },
  { id: 'U005', name: '运营B', role: 'OPERATOR', email: 'ops.b@higood.com' },
  { id: 'U006', name: '财务', role: 'FINANCE', email: 'finance@higood.com' },
]

// =============================================
// Notification（通知）
// =============================================
export type NotificationLevel = 'INFO' | 'WARN' | 'CRITICAL'
export type RecipientType = 'INTERNAL_USER' | 'FACTORY'
export type TargetType = 'TASK' | 'CASE' | 'HANDOVER' | 'TENDER' | 'ORDER' | 'TECH_PACK'

export interface NotificationDeepLink {
  path: string
  query?: Record<string, string>
}

export interface NotificationRelated {
  productionOrderId?: string
  taskId?: string
  caseId?: string
  tenderId?: string
  handoverEventId?: string
  spuCode?: string
}

export interface Notification {
  notificationId: string
  level: NotificationLevel
  title: string
  content: string
  recipientType: RecipientType
  recipientId: string
  recipientName: string
  targetType: TargetType
  targetId: string
  related: NotificationRelated
  deepLink: NotificationDeepLink
  createdAt: string
  readAt?: string
  createdBy: string
}

export function generateNotificationId(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `NT-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export const initialNotifications: Notification[] = [
  { notificationId: 'NT-202603-0001', level: 'INFO', title: '任务已分配', content: '任务TASK-0001-001已分配至Jakarta Central Factory', recipientType: 'FACTORY', recipientId: 'ID-F001', recipientName: 'Jakarta Central Factory', targetType: 'TASK', targetId: 'TASK-0001-001', related: { taskId: 'TASK-0001-001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0001-001' } }, createdAt: '2026-03-02 09:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0002', level: 'INFO', title: '任务已完成', content: '任务TASK-0003-001裁剪工序已完成', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'TASK', targetId: 'TASK-0003-001', related: { taskId: 'TASK-0003-001', productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0003-001' } }, createdAt: '2026-03-02 10:00:00', readAt: '2026-03-02 10:30:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0003', level: 'INFO', title: '交接待确认', content: '交接事件HV-202603-0001等待工厂确认', recipientType: 'FACTORY', recipientId: 'ID-F001', recipientName: 'Jakarta Central Factory', targetType: 'HANDOVER', targetId: 'HV-202603-0001', related: { handoverEventId: 'HV-202603-0001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0001' } }, createdAt: '2026-03-02 11:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0004', level: 'WARN', title: 'SLA即将到期', content: '异常单EX-202603-0001将于6小时内到期，请尽快处理', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0001', related: { caseId: 'EX-202603-0001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0001' } }, createdAt: '2026-03-03 06:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0005', level: 'WARN', title: '竞价临近截止', content: '竞价单TD-202603-0001将于24小时内截止', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0001', related: { tenderId: 'TD-202603-0001' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, createdAt: '2026-03-02 18:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0006', level: 'WARN', title: '交接待确认超时', content: '交接事件HV-202603-0002已超过4小时未确认', recipientType: 'FACTORY', recipientId: 'ID-F003', recipientName: 'Tangerang Satellite Cluster', targetType: 'HANDOVER', targetId: 'HV-202603-0002', related: { handoverEventId: 'HV-202603-0002', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0002' } }, createdAt: '2026-03-02 19:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0007', level: 'WARN', title: '任务阻塞提醒', content: '任务TASK-0005-002因设备故障阻塞', recipientType: 'INTERNAL_USER', recipientId: 'U003', recipientName: '跟单B', targetType: 'TASK', targetId: 'TASK-0005-002', related: { taskId: 'TASK-0005-002', productionOrderId: 'PO-202603-0005' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-002' } }, createdAt: '2026-03-02 14:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0008', level: 'WARN', title: '任务阻塞建议', content: '任务TASK-0007-003阻塞，请工厂尽快解除', recipientType: 'FACTORY', recipientId: 'ID-F006', recipientName: 'Surabaya Embroidery', targetType: 'TASK', targetId: 'TASK-0007-003', related: { taskId: 'TASK-0007-003', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0007-003' } }, createdAt: '2026-03-02 15:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0009', level: 'WARN', title: '派单待确认', content: '派单TASK-0002-001已超过4小时未确认接单', recipientType: 'FACTORY', recipientId: 'ID-F003', recipientName: 'Tangerang Satellite Cluster', targetType: 'TASK', targetId: 'TASK-0002-001', related: { taskId: 'TASK-0002-001', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0002-001' } }, createdAt: '2026-03-02 16:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0010', level: 'CRITICAL', title: 'SLA逾期提醒', content: '异常单EX-202603-0003已超过SLA时限，需立即处理', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0003', related: { caseId: 'EX-202603-0003', productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0003' } }, createdAt: '2026-03-03 00:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0011', level: 'CRITICAL', title: '竞价已逾期', content: '竞价单TD-202603-0002已超过截止时间，需延期或处理', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0002', related: { tenderId: 'TD-202603-0002' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0002' } }, createdAt: '2026-03-02 20:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0012', level: 'INFO', title: '新任务分配', content: '您有新任务TASK-0004-001待接单', recipientType: 'FACTORY', recipientId: 'ID-F004', recipientName: 'Bekasi Sewing Hub', targetType: 'TASK', targetId: 'TASK-0004-001', related: { taskId: 'TASK-0004-001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0004-001' } }, createdAt: '2026-03-02 08:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0013', level: 'INFO', title: '竞价邀请', content: '您被邀请参与竞价TD-202603-0003', recipientType: 'FACTORY', recipientId: 'ID-F005', recipientName: 'Bandung Print House', targetType: 'TENDER', targetId: 'TD-202603-0003', related: { tenderId: 'TD-202603-0003' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0003' } }, createdAt: '2026-03-01 14:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0014', level: 'WARN', title: '请尽快报价', content: '竞价TD-202603-0003将于12小时后截止', recipientType: 'FACTORY', recipientId: 'ID-F005', recipientName: 'Bandung Print House', targetType: 'TENDER', targetId: 'TD-202603-0003', related: { tenderId: 'TD-202603-0003' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0003' } }, createdAt: '2026-03-02 02:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0015', level: 'INFO', title: '交接待确认', content: '有新的交接事件HV-202603-0005待您确认', recipientType: 'FACTORY', recipientId: 'ID-F004', recipientName: 'Bekasi Sewing Hub', targetType: 'HANDOVER', targetId: 'HV-202603-0005', related: { handoverEventId: 'HV-202603-0005', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0005' } }, createdAt: '2026-03-02 09:30:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0016', level: 'WARN', title: '交接差异待处理', content: '交接事件HV-202603-0004存在差异，请尽快处理', recipientType: 'FACTORY', recipientId: 'ID-F005', recipientName: 'Bandung Print House', targetType: 'HANDOVER', targetId: 'HV-202603-0004', related: { handoverEventId: 'HV-202603-0004', productionOrderId: 'PO-202603-0005' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0004' } }, createdAt: '2026-03-01 12:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0017', level: 'INFO', title: '中标通知', content: '您已中标竞价TD-202603-0004', recipientType: 'FACTORY', recipientId: 'ID-F006', recipientName: 'Surabaya Embroidery', targetType: 'TENDER', targetId: 'TD-202603-0004', related: { tenderId: 'TD-202603-0004' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0004' } }, createdAt: '2026-02-28 16:00:00', readAt: '2026-02-28 17:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0018', level: 'INFO', title: '工厂已接单', content: 'Bekasi Sewing Hub已确认接单TASK-0004-002', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'TASK', targetId: 'TASK-0004-002', related: { taskId: 'TASK-0004-002', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0004-002' } }, createdAt: '2026-03-01 10:00:00', readAt: '2026-03-01 10:30:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0019', level: 'INFO', title: '交接已确认', content: '交接事件HV-202603-0003已由工厂确认', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'HANDOVER', targetId: 'HV-202603-0003', related: { handoverEventId: 'HV-202603-0003', productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0003' } }, createdAt: '2026-02-28 10:00:00', readAt: '2026-02-28 11:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0020', level: 'WARN', title: '异常单未指派', content: '异常单EX-202603-0005尚未指派责任人', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'CASE', targetId: 'EX-202603-0005', related: { caseId: 'EX-202603-0005' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0005' } }, createdAt: '2026-03-02 08:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0021', level: 'INFO', title: '竞价收到报价', content: '竞价TD-202603-0001收到新报价', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0001', related: { tenderId: 'TD-202603-0001' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, createdAt: '2026-03-02 14:00:00', readAt: '2026-03-02 15:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0022', level: 'CRITICAL', title: '紧急异常', content: '生产单PO-202603-0005出现S0级紧急异常', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'ORDER', targetId: 'PO-202603-0005', related: { productionOrderId: 'PO-202603-0005' }, deepLink: { path: '/fcs/production/orders/PO-202603-0005' }, createdAt: '2026-03-02 16:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0023', level: 'INFO', title: '技术包已发布', content: '技术包SPU-2024-SHIRT-001已发布', recipientType: 'INTERNAL_USER', recipientId: 'U004', recipientName: '运营A', targetType: 'TECH_PACK', targetId: 'SPU-2024-SHIRT-001', related: { spuCode: 'SPU-2024-SHIRT-001' }, deepLink: { path: '/fcs/tech-pack/SPU-2024-SHIRT-001' }, createdAt: '2026-03-01 09:00:00', readAt: '2026-03-01 09:30:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0024', level: 'INFO', title: '任务已开始', content: '任务TASK-0006-001已开始生产', recipientType: 'FACTORY', recipientId: 'ID-F007', recipientName: 'Yogyakarta Washing', targetType: 'TASK', targetId: 'TASK-0006-001', related: { taskId: 'TASK-0006-001', productionOrderId: 'PO-202603-0006' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0006-001' } }, createdAt: '2026-03-01 08:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0025', level: 'WARN', title: '请尽快开工', content: '任务TASK-0008-001已分配超过2天未开工', recipientType: 'FACTORY', recipientId: 'ID-F008', recipientName: 'Solo Button Factory', targetType: 'TASK', targetId: 'TASK-0008-001', related: { taskId: 'TASK-0008-001', productionOrderId: 'PO-202603-0008' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0008-001' } }, createdAt: '2026-03-02 08:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0026', level: 'INFO', title: '收到催办', content: '您收到一条催办消息：请尽快确认交接', recipientType: 'FACTORY', recipientId: 'ID-F001', recipientName: 'Jakarta Central Factory', targetType: 'HANDOVER', targetId: 'HV-202603-0001', related: { handoverEventId: 'HV-202603-0001' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0001' } }, createdAt: '2026-03-02 12:00:00', createdBy: 'U002' },
  { notificationId: 'NT-202603-0027', level: 'INFO', title: '异常已解决', content: '异常单EX-202603-0002已解决', recipientType: 'INTERNAL_USER', recipientId: 'U003', recipientName: '跟单B', targetType: 'CASE', targetId: 'EX-202603-0002', related: { caseId: 'EX-202603-0002' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0002' } }, createdAt: '2026-02-28 14:00:00', readAt: '2026-02-28 15:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0028', level: 'WARN', title: '交期临近', content: '生产单PO-202603-0003交期临近，请关注进度', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'ORDER', targetId: 'PO-202603-0003', related: { productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/production/orders/PO-202603-0003' }, createdAt: '2026-03-02 07:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0029', level: 'INFO', title: '竞价已定标', content: '竞价TD-202603-0004已完成定标', recipientType: 'INTERNAL_USER', recipientId: 'U004', recipientName: '运营A', targetType: 'TENDER', targetId: 'TD-202603-0004', related: { tenderId: 'TD-202603-0004' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0004' } }, createdAt: '2026-02-28 17:00:00', readAt: '2026-02-28 18:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0030', level: 'CRITICAL', title: '任务严重延期', content: '任务TASK-0009-001已延期超过3天', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'TASK', targetId: 'TASK-0009-001', related: { taskId: 'TASK-0009-001', productionOrderId: 'PO-202603-0009' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0009-001' } }, createdAt: '2026-03-03 06:00:00', createdBy: 'SYSTEM' },
]

// =============================================
// UrgeLog（催办记录）
// =============================================
export type UrgeType =
  | 'URGE_ASSIGN_ACK'
  | 'URGE_START'
  | 'URGE_FINISH'
  | 'URGE_UNBLOCK'
  | 'URGE_TENDER_BID'
  | 'URGE_TENDER_AWARD'
  | 'URGE_HANDOVER_CONFIRM'
  | 'URGE_HANDOVER_EVIDENCE'
  | 'URGE_CASE_HANDLE'

export type UrgeStatus = 'SENT' | 'ACKED' | 'RESOLVED'

export interface UrgeAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface UrgeLog {
  urgeId: string
  urgeType: UrgeType
  fromType: 'INTERNAL_USER'
  fromId: string
  fromName: string
  toType: RecipientType
  toId: string
  toName: string
  targetType: Exclude<TargetType, 'TECH_PACK'>
  targetId: string
  message: string
  createdAt: string
  status: UrgeStatus
  deepLink: NotificationDeepLink
  auditLogs: UrgeAuditLog[]
}

export function generateUrgeId(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `UG-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export const initialUrges: UrgeLog[] = [
  { urgeId: 'UG-202603-0001', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F001', toName: 'Jakarta Central Factory', targetType: 'TASK', targetId: 'TASK-0001-001', message: '请尽快确认接单，订单交期紧迫', createdAt: '2026-03-02 10:00:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0001-001' } }, auditLogs: [{ id: 'UAL-001', action: 'SEND', detail: '发送催办', at: '2026-03-02 10:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0002', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F003', toName: 'Tangerang Satellite Cluster', targetType: 'TASK', targetId: 'TASK-0002-001', message: '任务已分配超过4小时，请确认接单', createdAt: '2026-03-02 14:00:00', status: 'ACKED', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0002-001' } }, auditLogs: [{ id: 'UAL-002', action: 'SEND', detail: '发送催办', at: '2026-03-02 14:00:00', by: '跟单B' }, { id: 'UAL-003', action: 'ACK', detail: '工厂已确认', at: '2026-03-02 15:00:00', by: 'Tangerang Satellite Cluster' }] },
  { urgeId: 'UG-202603-0003', urgeType: 'URGE_START', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F004', toName: 'Bekasi Sewing Hub', targetType: 'TASK', targetId: 'TASK-0004-001', message: '任务已确认2天，请尽快开工', createdAt: '2026-03-01 09:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0004-001' } }, auditLogs: [{ id: 'UAL-004', action: 'SEND', detail: '发送催办', at: '2026-03-01 09:00:00', by: '跟单A' }, { id: 'UAL-005', action: 'RESOLVE', detail: '任务已开工', at: '2026-03-01 14:00:00', by: 'Bekasi Sewing Hub' }] },
  { urgeId: 'UG-202603-0004', urgeType: 'URGE_START', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F008', toName: 'Solo Button Factory', targetType: 'TASK', targetId: 'TASK-0008-001', message: '请尽快开工，已超过预计开工时间', createdAt: '2026-03-02 08:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0008-001' } }, auditLogs: [{ id: 'UAL-006', action: 'SEND', detail: '发送催办', at: '2026-03-02 08:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0005', urgeType: 'URGE_FINISH', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F006', toName: 'Surabaya Embroidery', targetType: 'TASK', targetId: 'TASK-0007-003', message: '交期临近，请加快进度尽快完工', createdAt: '2026-03-02 16:00:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0007-003' } }, auditLogs: [{ id: 'UAL-007', action: 'SEND', detail: '发送催办', at: '2026-03-02 16:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0006', urgeType: 'URGE_UNBLOCK', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'TASK', targetId: 'TASK-0005-002', message: '请尽快解决设备问题，解除任务阻塞', createdAt: '2026-03-02 14:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-002' } }, auditLogs: [{ id: 'UAL-008', action: 'SEND', detail: '发送催办', at: '2026-03-02 14:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0007', urgeType: 'URGE_UNBLOCK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'INTERNAL_USER', toId: 'U004', toName: '运营A', targetType: 'TASK', targetId: 'TASK-0005-003', message: '任务因物料问题阻塞，请协调物料供应', createdAt: '2026-03-01 11:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-003' } }, auditLogs: [{ id: 'UAL-009', action: 'SEND', detail: '发送催办', at: '2026-03-01 11:00:00', by: '跟单A' }, { id: 'UAL-010', action: 'RESOLVE', detail: '物料已到位，阻塞解除', at: '2026-03-01 16:00:00', by: '运营A' }] },
  { urgeId: 'UG-202603-0008', urgeType: 'URGE_TENDER_BID', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'TENDER', targetId: 'TD-202603-0003', message: '竞价即将截止，请尽快报价', createdAt: '2026-03-02 02:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0003' } }, auditLogs: [{ id: 'UAL-011', action: 'SEND', detail: '发送催办', at: '2026-03-02 02:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0009', urgeType: 'URGE_TENDER_BID', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'FACTORY', toId: 'ID-F007', toName: 'Yogyakarta Washing', targetType: 'TENDER', targetId: 'TD-202603-0001', message: '您尚未参与报价，请尽快提交', createdAt: '2026-03-02 18:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, auditLogs: [{ id: 'UAL-012', action: 'SEND', detail: '发送催办', at: '2026-03-02 18:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0010', urgeType: 'URGE_TENDER_AWARD', fromType: 'INTERNAL_USER', fromId: 'U004', fromName: '运营A', toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0001', message: '竞价已有多家报价，请尽快完成定标', createdAt: '2026-03-02 15:00:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, auditLogs: [{ id: 'UAL-013', action: 'SEND', detail: '发送催办', at: '2026-03-02 15:00:00', by: '运营A' }] },
  { urgeId: 'UG-202603-0011', urgeType: 'URGE_TENDER_AWARD', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0002', message: '竞价已逾期，请尽快处理', createdAt: '2026-03-02 20:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0002' } }, auditLogs: [{ id: 'UAL-014', action: 'SEND', detail: '发送催办', at: '2026-03-02 20:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0012', urgeType: 'URGE_HANDOVER_CONFIRM', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F001', toName: 'Jakarta Central Factory', targetType: 'HANDOVER', targetId: 'HV-202603-0001', message: '请尽快确认交接事件', createdAt: '2026-03-02 12:00:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0001' } }, auditLogs: [{ id: 'UAL-015', action: 'SEND', detail: '发送催办', at: '2026-03-02 12:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0013', urgeType: 'URGE_HANDOVER_CONFIRM', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F003', toName: 'Tangerang Satellite Cluster', targetType: 'HANDOVER', targetId: 'HV-202603-0002', message: '交接已超过4小时未确认，请处理', createdAt: '2026-03-02 19:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0002' } }, auditLogs: [{ id: 'UAL-016', action: 'SEND', detail: '发送催办', at: '2026-03-02 19:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0014', urgeType: 'URGE_HANDOVER_EVIDENCE', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'HANDOVER', targetId: 'HV-202603-0004', message: '交接存在差异，请补充证据并说明原因', createdAt: '2026-03-01 12:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0004' } }, auditLogs: [{ id: 'UAL-017', action: 'SEND', detail: '发送催办', at: '2026-03-01 12:30:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0015', urgeType: 'URGE_HANDOVER_EVIDENCE', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F006', toName: 'Surabaya Embroidery', targetType: 'HANDOVER', targetId: 'HV-202603-0006', message: '请提供损坏件的照片证据', createdAt: '2026-02-26 16:30:00', status: 'ACKED', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0006' } }, auditLogs: [{ id: 'UAL-018', action: 'SEND', detail: '发送催办', at: '2026-02-26 16:30:00', by: '跟单B' }, { id: 'UAL-019', action: 'ACK', detail: '工厂已确认收到', at: '2026-02-26 17:00:00', by: 'Surabaya Embroidery' }] },
  { urgeId: 'UG-202603-0016', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'INTERNAL_USER', toId: 'U002', toName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0001', message: '异常单SLA即将到期，请尽快处理', createdAt: '2026-03-03 06:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0001' } }, auditLogs: [{ id: 'UAL-020', action: 'SEND', detail: '发送催办', at: '2026-03-03 06:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0017', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'INTERNAL_USER', toId: 'U002', toName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0003', message: 'S1级异常已逾期，需立即处理', createdAt: '2026-03-03 00:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0003' } }, auditLogs: [{ id: 'UAL-021', action: 'SEND', detail: '发送催办', at: '2026-03-03 00:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0018', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U004', fromName: '运营A', toType: 'INTERNAL_USER', toId: 'U003', toName: '跟单B', targetType: 'CASE', targetId: 'EX-202603-0005', message: '请尽快指派并处理此异常', createdAt: '2026-03-02 08:30:00', status: 'ACKED', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0005' } }, auditLogs: [{ id: 'UAL-022', action: 'SEND', detail: '发送催办', at: '2026-03-02 08:30:00', by: '运营A' }, { id: 'UAL-023', action: 'ACK', detail: '已确认收到', at: '2026-03-02 09:00:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0019', urgeType: 'URGE_FINISH', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F009', toName: 'Semarang Pleating', targetType: 'TASK', targetId: 'TASK-0009-001', message: '任务已严重延期，请尽快完成', createdAt: '2026-03-03 06:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0009-001' } }, auditLogs: [{ id: 'UAL-024', action: 'SEND', detail: '发送催办', at: '2026-03-03 06:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0020', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F010', toName: 'Jakarta Special Process', targetType: 'TASK', targetId: 'TASK-0010-001', message: '新任务已分配，请尽快确认', createdAt: '2026-03-02 11:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0010-001' } }, auditLogs: [{ id: 'UAL-025', action: 'SEND', detail: '发送催办', at: '2026-03-02 11:00:00', by: '跟单A' }, { id: 'UAL-026', action: 'RESOLVE', detail: '工厂已确认接单', at: '2026-03-02 12:00:00', by: 'Jakarta Special Process' }] },
]
