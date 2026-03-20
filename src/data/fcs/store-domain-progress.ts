// =============================================
// store-domain-progress.ts
// 进度域静态类型、生成器和 seed 数据
// 当前原型仓直接使用的数据域文件（无 React 依赖）
// 冻结规则：凡“统一数据源/统一事实源”类改造，仅允许修改数据源、
// 映射层、查询层、状态来源与兼容层；不得顺带改已有页面 UI 与交互。
// =============================================
import type {
  SubCategoryKey,
  UnifiedCategory,
} from './progress-exception-taxonomy'
import type {
  CloseReasonCode,
  ResolveRuleCode,
  ResolveSource,
} from './progress-exception-lifecycle'
import {
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from './runtime-process-tasks'
import {
  listMaterialRequests,
  listMaterialRequestsByOrder,
  type MaterialRequestRecord,
} from './material-request-drafts'
import {
  listWarehouseExecutionDocsByOrder,
  listWarehouseExecutionDocsByRuntimeTaskId,
  listWarehouseExecutionDocsByMaterialRequestNo,
  listWarehouseInternalTransferOrdersByRuntimeTaskId,
  listWarehouseIssueOrdersByRuntimeTaskId,
  listWarehouseReturnOrdersByRuntimeTaskId,
  getWarehouseExecutionSummaryByOrder,
  type WarehouseExecutionDoc,
  type WarehouseExecutionStatus,
} from './warehouse-material-execution'
import {
  getPdaHandoutHeads,
  getPdaHandoverRecordsByHead,
  getPdaPickupHeads,
  getPdaPickupRecordsByHead,
} from './pda-handover-events'

// =============================================
// ExceptionCase 相关
// =============================================
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type Severity = 'S1' | 'S2' | 'S3'
export type ExceptionCategory = 'PRODUCTION_BLOCK' | 'ASSIGNMENT' | 'TECH_PACK' | 'HANDOVER' | 'MATERIAL' | 'EXECUTION'
export type ReasonCode =
  // 生产暂停
  | 'BLOCKED_MATERIAL' | 'BLOCKED_CAPACITY' | 'BLOCKED_QUALITY' | 'BLOCKED_TECH' | 'BLOCKED_EQUIPMENT' | 'BLOCKED_OTHER'
  // 分配异常
  | 'TENDER_OVERDUE' | 'TENDER_NEAR_DEADLINE' | 'NO_BID' | 'PRICE_ABNORMAL' | 'DISPATCH_REJECTED' | 'ACK_TIMEOUT'
  // 技术包
  | 'TECH_PACK_NOT_RELEASED'
  // 工厂风险
  | 'FACTORY_BLACKLISTED'
  // 交接/领料
  | 'HANDOVER_DIFF' | 'MATERIAL_NOT_READY'
  // 执行
  | 'START_OVERDUE'
  | 'MILESTONE_NOT_REPORTED'

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
  unifiedCategory?: UnifiedCategory
  subCategoryKey?: SubCategoryKey
  reasonCode: ReasonCode
  sourceType: 'TASK' | 'ORDER' | 'TENDER' | 'FACTORY_PAUSE_REPORT'
  sourceId: string
  sourceSystem?: string
  sourceModule?: string
  relatedOrderIds: string[]
  relatedTaskIds: string[]
  relatedTenderIds: string[]
  linkedProductionOrderNo?: string
  linkedTaskNo?: string
  ownerUserId?: string
  ownerUserName?: string
  summary: string
  detail: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: string
  resolvedRuleCode?: ResolveRuleCode
  resolvedSource?: ResolveSource
  resolvedDetail?: string
  closedAt?: string
  closeReasonCode?: CloseReasonCode
  mergedCaseId?: string
  closedBy?: string
  closeDetail?: string
  closeRemark?: string
  reasonLabel?: string
  linkedFactoryName?: string
  followUpRemark?: string
  pauseReportedAt?: string
  pauseReasonLabel?: string
  pauseRemark?: string
  pauseProofFiles?: Array<{ id: string; type: 'IMAGE' | 'VIDEO'; name: string; uploadedAt: string }>
  milestoneSnapshot?: {
    required: boolean
    ruleLabel?: string
    targetQty?: number
    targetUnit?: 'PIECE' | 'YARD'
    status?: 'PENDING' | 'REPORTED'
    reportedAt?: string | null
  }
  tags: string[]
  actions: ExceptionAction[]
  auditLogs: ExceptionAuditLog[]
}

// 生成异常号
export function generateCaseId(): string {
  generateCaseIdSeq += 1
  return `EX-202603-${String(generateCaseIdSeq).padStart(4, '0')}`
}
let generateCaseIdSeq = 9000

// seed 时间辅助
const nowDate = new Date('2026-03-20T10:00:00+08:00')
const mockNow = nowDate.toISOString().replace('T', ' ').slice(0, 19)
const eightHoursAgo = new Date(nowDate.getTime() - 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const sixHoursLater = new Date(nowDate.getTime() + 6 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const twoHoursLater = new Date(nowDate.getTime() + 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const twoDaysAgo = new Date(nowDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
const oneDayAgo = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)

export const progressExceptionCases: ExceptionCase[] = []

// 第二轮收口：异常主真相源统一来自新链路事实自动聚合（syncProgressFactsAndExceptions），
// 不再在此文件内维护大段静态旧 seed，避免页面回退到旧真相。
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
  notificationSeq += 1
  return `NT-202603-${String(notificationSeq).padStart(4, '0')}`
}
let notificationSeq = 9000

export const initialNotifications: Notification[] = [
  { notificationId: 'NT-202603-0001', level: 'INFO', title: '任务已分配', content: '任务TASK-0001-001已分配至Jakarta Central Factory', recipientType: 'FACTORY', recipientId: 'ID-F001', recipientName: 'Jakarta Central Factory', targetType: 'TASK', targetId: 'TASK-0001-001', related: { taskId: 'TASK-0001-001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0001-001' } }, createdAt: '2026-03-02 09:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0002', level: 'INFO', title: '任务已完成', content: '任务TASK-0003-001裁剪工序已完成', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'TASK', targetId: 'TASK-0003-001', related: { taskId: 'TASK-0003-001', productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0003-001' } }, createdAt: '2026-03-02 10:00:00', readAt: '2026-03-02 10:30:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0003', level: 'INFO', title: '交接待确认', content: '交接事件HV-202603-0001等待工厂确认', recipientType: 'FACTORY', recipientId: 'ID-F001', recipientName: 'Jakarta Central Factory', targetType: 'HANDOVER', targetId: 'HV-202603-0001', related: { handoverEventId: 'HV-202603-0001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0001' } }, createdAt: '2026-03-02 11:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0004', level: 'WARN', title: '异常待跟进提醒', content: '异常单EX-202603-0001仍在处理中，请尽快跟进', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0001', related: { caseId: 'EX-202603-0001', productionOrderId: 'PO-202603-0004' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0001' } }, createdAt: '2026-03-03 06:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0005', level: 'WARN', title: '竞价临近截止', content: '竞价单TD-202603-0001将于24小时内截止', recipientType: 'INTERNAL_USER', recipientId: 'U001', recipientName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0001', related: { tenderId: 'TD-202603-0001' }, deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, createdAt: '2026-03-02 18:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0006', level: 'WARN', title: '交接待确认超时', content: '交接事件HV-202603-0002已超过4小时未确认', recipientType: 'FACTORY', recipientId: 'ID-F003', recipientName: 'Tangerang Satellite Cluster', targetType: 'HANDOVER', targetId: 'HV-202603-0002', related: { handoverEventId: 'HV-202603-0002', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0002' } }, createdAt: '2026-03-02 19:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0007', level: 'WARN', title: '任务生产暂停提醒', content: '任务TASK-0005-002因设备故障生产暂停', recipientType: 'INTERNAL_USER', recipientId: 'U003', recipientName: '跟单B', targetType: 'TASK', targetId: 'TASK-0005-002', related: { taskId: 'TASK-0005-002', productionOrderId: 'PO-202603-0005' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-002' } }, createdAt: '2026-03-02 14:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0008', level: 'WARN', title: '任务生产暂停建议', content: '任务TASK-0007-003生产暂停，请工厂尽快解除', recipientType: 'FACTORY', recipientId: 'ID-F006', recipientName: 'Surabaya Embroidery', targetType: 'TASK', targetId: 'TASK-0007-003', related: { taskId: 'TASK-0007-003', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0007-003' } }, createdAt: '2026-03-02 15:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0009', level: 'WARN', title: '派单待确认', content: '派单TASK-0002-001已超过4小时未确认接单', recipientType: 'FACTORY', recipientId: 'ID-F003', recipientName: 'Tangerang Satellite Cluster', targetType: 'TASK', targetId: 'TASK-0002-001', related: { taskId: 'TASK-0002-001', productionOrderId: 'PO-202603-0007' }, deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0002-001' } }, createdAt: '2026-03-02 16:00:00', createdBy: 'SYSTEM' },
  { notificationId: 'NT-202603-0010', level: 'CRITICAL', title: '异常紧急提醒', content: '异常单EX-202603-0003仍未处理，请立即跟进', recipientType: 'INTERNAL_USER', recipientId: 'U002', recipientName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0003', related: { caseId: 'EX-202603-0003', productionOrderId: 'PO-202603-0003' }, deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0003' } }, createdAt: '2026-03-03 00:00:00', createdBy: 'SYSTEM' },
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
  urgeSeq += 1
  return `UG-202603-${String(urgeSeq).padStart(4, '0')}`
}
let urgeSeq = 9000

export const initialUrges: UrgeLog[] = [
  { urgeId: 'UG-202603-0001', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F001', toName: 'Jakarta Central Factory', targetType: 'TASK', targetId: 'TASK-0001-001', message: '请尽快确认接单，订单交期紧迫', createdAt: '2026-03-02 10:00:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0001-001' } }, auditLogs: [{ id: 'UAL-001', action: 'SEND', detail: '发送催办', at: '2026-03-02 10:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0002', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F003', toName: 'Tangerang Satellite Cluster', targetType: 'TASK', targetId: 'TASK-0002-001', message: '任务已分配超过4小时，请确认接单', createdAt: '2026-03-02 14:00:00', status: 'ACKED', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0002-001' } }, auditLogs: [{ id: 'UAL-002', action: 'SEND', detail: '发送催办', at: '2026-03-02 14:00:00', by: '跟单B' }, { id: 'UAL-003', action: 'ACK', detail: '工厂已确认', at: '2026-03-02 15:00:00', by: 'Tangerang Satellite Cluster' }] },
  { urgeId: 'UG-202603-0003', urgeType: 'URGE_START', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F004', toName: 'Bekasi Sewing Hub', targetType: 'TASK', targetId: 'TASK-0004-001', message: '任务已确认2天，请尽快开工', createdAt: '2026-03-01 09:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0004-001' } }, auditLogs: [{ id: 'UAL-004', action: 'SEND', detail: '发送催办', at: '2026-03-01 09:00:00', by: '跟单A' }, { id: 'UAL-005', action: 'RESOLVE', detail: '任务已开工', at: '2026-03-01 14:00:00', by: 'Bekasi Sewing Hub' }] },
  { urgeId: 'UG-202603-0004', urgeType: 'URGE_START', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F008', toName: 'Solo Button Factory', targetType: 'TASK', targetId: 'TASK-0008-001', message: '请尽快开工，已超过预计开工时间', createdAt: '2026-03-02 08:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0008-001' } }, auditLogs: [{ id: 'UAL-006', action: 'SEND', detail: '发送催办', at: '2026-03-02 08:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0005', urgeType: 'URGE_FINISH', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F006', toName: 'Surabaya Embroidery', targetType: 'TASK', targetId: 'TASK-0007-003', message: '交期临近，请加快进度尽快完工', createdAt: '2026-03-02 16:00:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0007-003' } }, auditLogs: [{ id: 'UAL-007', action: 'SEND', detail: '发送催办', at: '2026-03-02 16:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0006', urgeType: 'URGE_UNBLOCK', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'TASK', targetId: 'TASK-0005-002', message: '请尽快解决设备问题，解除任务生产暂停', createdAt: '2026-03-02 14:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-002' } }, auditLogs: [{ id: 'UAL-008', action: 'SEND', detail: '发送催办', at: '2026-03-02 14:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0007', urgeType: 'URGE_UNBLOCK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'INTERNAL_USER', toId: 'U004', toName: '运营A', targetType: 'TASK', targetId: 'TASK-0005-003', message: '任务因物料问题生产暂停，请协调物料供应', createdAt: '2026-03-01 11:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0005-003' } }, auditLogs: [{ id: 'UAL-009', action: 'SEND', detail: '发送催办', at: '2026-03-01 11:00:00', by: '跟单A' }, { id: 'UAL-010', action: 'RESOLVE', detail: '物料已到位，生产暂停解除', at: '2026-03-01 16:00:00', by: '运营A' }] },
  { urgeId: 'UG-202603-0008', urgeType: 'URGE_TENDER_BID', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'TENDER', targetId: 'TD-202603-0003', message: '竞价即将截止，请尽快报价', createdAt: '2026-03-02 02:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0003' } }, auditLogs: [{ id: 'UAL-011', action: 'SEND', detail: '发送催办', at: '2026-03-02 02:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0009', urgeType: 'URGE_TENDER_BID', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'FACTORY', toId: 'ID-F007', toName: 'Yogyakarta Washing', targetType: 'TENDER', targetId: 'TD-202603-0001', message: '您尚未参与报价，请尽快提交', createdAt: '2026-03-02 18:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, auditLogs: [{ id: 'UAL-012', action: 'SEND', detail: '发送催办', at: '2026-03-02 18:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0010', urgeType: 'URGE_TENDER_AWARD', fromType: 'INTERNAL_USER', fromId: 'U004', fromName: '运营A', toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0001', message: '竞价已有多家报价，请尽快完成定标', createdAt: '2026-03-02 15:00:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0001' } }, auditLogs: [{ id: 'UAL-013', action: 'SEND', detail: '发送催办', at: '2026-03-02 15:00:00', by: '运营A' }] },
  { urgeId: 'UG-202603-0011', urgeType: 'URGE_TENDER_AWARD', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'INTERNAL_USER', toId: 'U001', toName: '管理员', targetType: 'TENDER', targetId: 'TD-202603-0002', message: '竞价已逾期，请尽快处理', createdAt: '2026-03-02 20:30:00', status: 'SENT', deepLink: { path: '/fcs/dispatch/board', query: { tenderId: 'TD-202603-0002' } }, auditLogs: [{ id: 'UAL-014', action: 'SEND', detail: '发送催办', at: '2026-03-02 20:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0012', urgeType: 'URGE_HANDOVER_CONFIRM', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F001', toName: 'Jakarta Central Factory', targetType: 'HANDOVER', targetId: 'HV-202603-0001', message: '请尽快确认交接事件', createdAt: '2026-03-02 12:00:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0001' } }, auditLogs: [{ id: 'UAL-015', action: 'SEND', detail: '发送催办', at: '2026-03-02 12:00:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0013', urgeType: 'URGE_HANDOVER_CONFIRM', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F003', toName: 'Tangerang Satellite Cluster', targetType: 'HANDOVER', targetId: 'HV-202603-0002', message: '交接已超过4小时未确认，请处理', createdAt: '2026-03-02 19:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0002' } }, auditLogs: [{ id: 'UAL-016', action: 'SEND', detail: '发送催办', at: '2026-03-02 19:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0014', urgeType: 'URGE_HANDOVER_EVIDENCE', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F005', toName: 'Bandung Print House', targetType: 'HANDOVER', targetId: 'HV-202603-0004', message: '交接存在差异，请补充证据并说明原因', createdAt: '2026-03-01 12:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0004' } }, auditLogs: [{ id: 'UAL-017', action: 'SEND', detail: '发送催办', at: '2026-03-01 12:30:00', by: '跟单A' }] },
  { urgeId: 'UG-202603-0015', urgeType: 'URGE_HANDOVER_EVIDENCE', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F006', toName: 'Surabaya Embroidery', targetType: 'HANDOVER', targetId: 'HV-202603-0006', message: '请提供损坏件的照片证据', createdAt: '2026-02-26 16:30:00', status: 'ACKED', deepLink: { path: '/fcs/progress/handover', query: { eventId: 'HV-202603-0006' } }, auditLogs: [{ id: 'UAL-018', action: 'SEND', detail: '发送催办', at: '2026-02-26 16:30:00', by: '跟单B' }, { id: 'UAL-019', action: 'ACK', detail: '工厂已确认收到', at: '2026-02-26 17:00:00', by: 'Surabaya Embroidery' }] },
  { urgeId: 'UG-202603-0016', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'INTERNAL_USER', toId: 'U002', toName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0001', message: '异常单处理时限即将到期，请尽快处理', createdAt: '2026-03-03 06:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0001' } }, auditLogs: [{ id: 'UAL-020', action: 'SEND', detail: '发送催办', at: '2026-03-03 06:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0017', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U001', fromName: '管理员', toType: 'INTERNAL_USER', toId: 'U002', toName: '跟单A', targetType: 'CASE', targetId: 'EX-202603-0003', message: 'S1级异常已逾期，需立即处理', createdAt: '2026-03-03 00:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0003' } }, auditLogs: [{ id: 'UAL-021', action: 'SEND', detail: '发送催办', at: '2026-03-03 00:30:00', by: '管理员' }] },
  { urgeId: 'UG-202603-0018', urgeType: 'URGE_CASE_HANDLE', fromType: 'INTERNAL_USER', fromId: 'U004', fromName: '运营A', toType: 'INTERNAL_USER', toId: 'U003', toName: '跟单B', targetType: 'CASE', targetId: 'EX-202603-0005', message: '请尽快指派并处理此异常', createdAt: '2026-03-02 08:30:00', status: 'ACKED', deepLink: { path: '/fcs/progress/exceptions', query: { caseId: 'EX-202603-0005' } }, auditLogs: [{ id: 'UAL-022', action: 'SEND', detail: '发送催办', at: '2026-03-02 08:30:00', by: '运营A' }, { id: 'UAL-023', action: 'ACK', detail: '已确认收到', at: '2026-03-02 09:00:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0019', urgeType: 'URGE_FINISH', fromType: 'INTERNAL_USER', fromId: 'U003', fromName: '跟单B', toType: 'FACTORY', toId: 'ID-F009', toName: 'Semarang Pleating', targetType: 'TASK', targetId: 'TASK-0009-001', message: '任务已严重延期，请尽快完成', createdAt: '2026-03-03 06:30:00', status: 'SENT', deepLink: { path: '/fcs/progress/board', query: { taskId: 'TASK-0009-001' } }, auditLogs: [{ id: 'UAL-024', action: 'SEND', detail: '发送催办', at: '2026-03-03 06:30:00', by: '跟单B' }] },
  { urgeId: 'UG-202603-0020', urgeType: 'URGE_ASSIGN_ACK', fromType: 'INTERNAL_USER', fromId: 'U002', fromName: '跟单A', toType: 'FACTORY', toId: 'ID-F010', toName: 'Jakarta Special Process', targetType: 'TASK', targetId: 'TASK-0010-001', message: '新任务已分配，请尽快确认', createdAt: '2026-03-02 11:00:00', status: 'RESOLVED', deepLink: { path: '/fcs/dispatch/board', query: { taskId: 'TASK-0010-001' } }, auditLogs: [{ id: 'UAL-025', action: 'SEND', detail: '发送催办', at: '2026-03-02 11:00:00', by: '跟单A' }, { id: 'UAL-026', action: 'RESOLVE', detail: '工厂已确认接单', at: '2026-03-02 12:00:00', by: 'Jakarta Special Process' }] },
]

// =============================================
// 第6步统一进度/异常事实域（基于 runtime + 仓库执行 + PDA）
// =============================================
export interface ProgressFact {
  artifactId?: string
  artifactType: 'TASK'
  productionOrderId: string
  runtimeTaskId: string
  baseTaskId: string
  stageCode?: string
  stageName?: string
  processCode: string
  processNameZh: string
  craftCode?: string
  craftName?: string
  taskTypeCode?: string
  taskTypeLabel?: string
  assignmentGranularity?: RuntimeProcessTask['assignmentGranularity']
  scopeType: RuntimeProcessTask['scopeType']
  scopeKey: string
  scopeLabel: string
  executorKind: RuntimeProcessTask['executorKind']
  assignedFactoryId?: string
  assignedFactoryName?: string
  transitionFromPrev: RuntimeProcessTask['transitionFromPrev']
  transitionToNext: RuntimeProcessTask['transitionToNext']
  materialRequests: MaterialRequestRecord[]
  executionDocs: WarehouseExecutionDoc[]
  pickupHeadIds: string[]
  handoutHeadIds: string[]
  startReadiness: {
    canStart: boolean
    reasonCode:
      | 'READY'
      | 'WAIT_PICKUP'
      | 'WAIT_INTERNAL_TRANSFER'
      | 'WAIT_PREV_DONE'
      | 'WAIT_EXECUTION_DOC'
    reasonText: string
  }
}

export interface ProgressMaterialIssueRow {
  issueId: string
  productionOrderId: string
  taskId: string
  baseTaskId: string
  materialRequestNo: string
  materialSummaryZh: string
  requestedQty: number
  issuedQty: number
  status: 'DRAFT' | 'TO_ISSUE' | 'PARTIAL' | 'ISSUED'
  stageCode?: string
  stageName?: string
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  taskTypeLabel?: string
  assignmentGranularityLabel: '按生产单' | '按颜色' | '按SKU'
  executorKind: RuntimeProcessTask['executorKind']
  sourceDocNos: string[]
  updatedAt: string
  createdBy: string
}

export interface ProgressMaterialStatementItem {
  issueId: string
  taskId: string
  materialSummaryZh: string
  requestedQty: number
  issuedQty: number
}

export interface ProgressMaterialStatementDraft {
  materialStatementId: string
  productionOrderId: string
  itemCount: number
  totalRequestedQty: number
  totalIssuedQty: number
  status: 'DRAFT' | 'CONFIRMED' | 'CLOSED'
  issueIds: string[]
  items: ProgressMaterialStatementItem[]
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

export interface ProgressExceptionSummary {
  totalCount: number
  openCount: number
  inProgressCount: number
  resolvedCount: number
  closedCount: number
  s1Count: number
  s2Count: number
  s3Count: number
}

export interface ProgressMaterialFlowSummary {
  productionOrderId: string
  requestCount: number
  issueOrderCount: number
  returnOrderCount: number
  internalTransferCount: number
  shortLineCount: number
  completionRate: number
  completenessRate: number
}

export interface ProgressExecutionHealthSummary {
  productionOrderId: string
  blockingExceptionCount: number
  handoutExceptionCount: number
  materialExceptionCount: number
  waitingStartTaskCount: number
  openExceptionCount: number
}

export interface ProgressOrderSummary {
  productionOrderId: string
  taskCount: number
  canStartTaskCount: number
  issueOrderCount: number
  returnOrderCount: number
  internalTransferCount: number
  openExceptionCount: number
}

interface ProgressExceptionCandidate {
  key: string
  reasonCode: ReasonCode
  category: ExceptionCategory
  unifiedCategory: UnifiedCategory
  subCategoryKey: SubCategoryKey
  severity: Severity
  sourceId: string
  relatedOrderIds: string[]
  relatedTaskIds: string[]
  linkedFactoryName?: string
  summary: string
  detail: string
  closureReady: boolean
  eventAt: string
}

const AUTO_PROGRESS_TAG = 'AUTO_PROGRESS_FACT'

function parseDateMs(value?: string): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const ts = new Date(normalized).getTime()
  return Number.isFinite(ts) ? ts : Number.NaN
}

function nowAt(): string {
  return mockNow
}

function pickLatestTimestamp(values: Array<string | undefined>, fallback: string = mockNow): string {
  const valid = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, ts: parseDateMs(value) }))
    .filter((item) => Number.isFinite(item.ts))
    .sort((a, b) => b.ts - a.ts)
  return valid[0]?.value ?? fallback
}

function maxTimestamp(left: string, right: string): string {
  const leftMs = parseDateMs(left)
  const rightMs = parseDateMs(right)
  if (!Number.isFinite(leftMs)) return right
  if (!Number.isFinite(rightMs)) return left
  return rightMs > leftMs ? right : left
}

function shortStableKey(input: string): string {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
}

function generateAutoProgressCaseId(candidateKey: string): string {
  return `EX-AUTO-${shortStableKey(candidateKey)}`
}

function toExceptionStatus(status: CaseStatus): 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' {
  return status
}

function isDocClosed(status: WarehouseExecutionStatus): boolean {
  return status === 'CLOSED' || status === 'RETURNED' || status === 'RECEIVED'
}

function isDocActive(status: WarehouseExecutionStatus): boolean {
  return !isDocClosed(status)
}

function hasDocShortage(docs: WarehouseExecutionDoc[]): boolean {
  return docs.some((doc) => doc.lines.some((line) => line.shortQty > 0))
}

function hasPreparingStatus(docs: WarehouseExecutionDoc[]): boolean {
  return docs.some((doc) =>
    doc.status === 'PLANNED' ||
    doc.status === 'PREPARING' ||
    doc.status === 'PARTIALLY_PREPARED' ||
    doc.status === 'READY',
  )
}

function toIssueStatusFromExecution(input: {
  requestStatus: string
  hasExecutionDocs: boolean
  requestedQty: number
  completedQty: number
}): 'DRAFT' | 'TO_ISSUE' | 'PARTIAL' | 'ISSUED' {
  if (!input.hasExecutionDocs) return 'DRAFT'
  if (input.completedQty >= input.requestedQty && input.requestedQty > 0) return 'ISSUED'
  if (input.completedQty > 0) return 'PARTIAL'
  if (input.requestStatus === '待配送' || input.requestStatus === '待自提') return 'TO_ISSUE'
  return 'DRAFT'
}

function formatGranularityLabel(
  granularity?: RuntimeProcessTask['assignmentGranularity'],
): '按生产单' | '按颜色' | '按SKU' {
  if (granularity === 'SKU') return '按SKU'
  if (granularity === 'COLOR') return '按颜色'
  return '按生产单'
}

function resolveRuntimeTaskForRequest(request: MaterialRequestRecord): RuntimeProcessTask | null {
  const direct = getRuntimeTaskById(request.taskId)
  if (direct) return direct
  const byBase = listRuntimeTasksByBaseTaskId(request.taskId)
  if (byBase.length === 0) return null
  if (byBase.length === 1) return byBase[0]
  const orderScope = byBase.find((task) => task.scopeType === 'ORDER')
  return orderScope ?? byBase[0]
}

function getRequestsByRuntimeTask(task: RuntimeProcessTask): MaterialRequestRecord[] {
  return listMaterialRequestsByOrder(task.productionOrderId).filter((request) => {
    const resolved = resolveRuntimeTaskForRequest(request)
    return resolved?.taskId === task.taskId
  })
}

function evaluateRuntimeStartReadiness(task: RuntimeProcessTask): ProgressFact['startReadiness'] {
  if (task.executorKind === 'WAREHOUSE_WORKSHOP') {
    const transferDocs = listWarehouseInternalTransferOrdersByRuntimeTaskId(task.taskId)
    const ready = transferDocs.some((doc) =>
      doc.status === 'IN_TRANSIT' ||
      doc.status === 'RECEIVED' ||
      doc.status === 'CLOSED' ||
      doc.lines.some((line) => line.transferredQty > 0),
    )
    return ready
      ? { canStart: true, reasonCode: 'READY', reasonText: '仓内流转已到位' }
      : { canStart: false, reasonCode: 'WAIT_INTERNAL_TRANSFER', reasonText: '仓内流转尚未到位' }
  }

  if (task.transitionFromPrev === 'SAME_FACTORY_CONTINUE') {
    const ready = task.dependsOnTaskIds.every((upstreamTaskId) => {
      const upstream = getRuntimeTaskById(upstreamTaskId)
      if (!upstream) return false
      if (upstream.status === 'DONE') return true
      return listWarehouseReturnOrdersByRuntimeTaskId(upstream.taskId).some((doc) => isDocClosed(doc.status))
    })
    return ready
      ? { canStart: true, reasonCode: 'READY', reasonText: '同厂连续流转已就绪' }
      : { canStart: false, reasonCode: 'WAIT_PREV_DONE', reasonText: '上一工序尚未完成连续流转' }
  }

  const issueDocs = listWarehouseIssueOrdersByRuntimeTaskId(task.taskId)
  if (!issueDocs.length) {
    return { canStart: false, reasonCode: 'WAIT_EXECUTION_DOC', reasonText: '尚未生成仓库发料单' }
  }

  const pickupHeads = getPdaPickupHeads().filter((head) => head.runtimeTaskId === task.taskId)
  const ready = pickupHeads.some((head) => {
    if (head.completionStatus === 'COMPLETED' || head.summaryStatus === 'WRITTEN_BACK') return true
    return getPdaPickupRecordsByHead(head.handoverId).some((record) => record.status === 'RECEIVED')
  })

  return ready
    ? { canStart: true, reasonCode: 'READY', reasonText: '仓库发料已领料，可开工' }
    : { canStart: false, reasonCode: 'WAIT_PICKUP', reasonText: '待工厂领料' }
}

export function listProgressFacts(): ProgressFact[] {
  const pickupHeads = getPdaPickupHeads()
  const handoutHeads = getPdaHandoutHeads()

  return listRuntimeProcessTasks().map((task) => {
    const executionDocs = listWarehouseExecutionDocsByRuntimeTaskId(task.taskId)
    const requests = getRequestsByRuntimeTask(task)
    return {
      artifactId: task.sourceEntryId ? `TASKART-${task.productionOrderId}-${task.sourceEntryId}` : undefined,
      artifactType: 'TASK',
      productionOrderId: task.productionOrderId,
      runtimeTaskId: task.taskId,
      baseTaskId: task.baseTaskId,
      stageCode: task.stageCode,
      stageName: task.stageName,
      processCode: task.processCode,
      processNameZh: task.processNameZh,
      craftCode: task.craftCode,
      craftName: task.craftName,
      taskTypeCode: task.isSpecialCraft ? task.craftCode || task.processBusinessCode || task.processCode : task.processBusinessCode || task.processCode,
      taskTypeLabel: task.taskCategoryZh || task.processBusinessName || task.processNameZh,
      assignmentGranularity: task.assignmentGranularity,
      scopeType: task.scopeType,
      scopeKey: task.scopeKey,
      scopeLabel: task.scopeLabel,
      executorKind: task.executorKind ?? 'EXTERNAL_FACTORY',
      assignedFactoryId: task.assignedFactoryId,
      assignedFactoryName: task.assignedFactoryName,
      transitionFromPrev: task.transitionFromPrev ?? 'NOT_APPLICABLE',
      transitionToNext: task.transitionToNext ?? 'NOT_APPLICABLE',
      materialRequests: requests,
      executionDocs,
      pickupHeadIds: pickupHeads.filter((head) => head.runtimeTaskId === task.taskId).map((head) => head.handoverId),
      handoutHeadIds: handoutHeads.filter((head) => head.runtimeTaskId === task.taskId).map((head) => head.handoverId),
      startReadiness: evaluateRuntimeStartReadiness(task),
    }
  })
}

export function listProgressFactsByOrder(productionOrderId: string): ProgressFact[] {
  return listProgressFacts().filter((fact) => fact.productionOrderId === productionOrderId)
}

export function getProgressFactByTaskId(taskId: string): ProgressFact | undefined {
  return listProgressFacts().find((fact) => fact.runtimeTaskId === taskId || fact.baseTaskId === taskId)
}

export function listProgressMaterialIssueRows(): ProgressMaterialIssueRow[] {
  return listMaterialRequests()
    .map((request) => {
      const runtimeTask = resolveRuntimeTaskForRequest(request)
      if (!runtimeTask) return null

      const executionDocs = listWarehouseExecutionDocsByMaterialRequestNo(request.materialRequestNo)
      const requestedQty = executionDocs.reduce(
        (sum, doc) => sum + doc.lines.reduce((lineSum, line) => lineSum + line.plannedQty, 0),
        0,
      )
      const issuedQty = executionDocs.reduce(
        (sum, doc) =>
          sum +
          doc.lines.reduce(
            (lineSum, line) => lineSum + (line.issuedQty ?? 0) + (line.transferredQty ?? 0),
            0,
          ),
        0,
      )

      const normalizedRequested = Math.max(1, Math.round(requestedQty || request.lineCount || 1))
      const normalizedIssued = Math.max(0, Math.round(issuedQty))

      return {
        issueId: `MIS-${request.materialRequestNo}`,
        productionOrderId: request.productionOrderNo,
        taskId: runtimeTask.taskId,
        baseTaskId: runtimeTask.baseTaskId,
        materialRequestNo: request.materialRequestNo,
        materialSummaryZh: request.materialSummary,
        requestedQty: normalizedRequested,
        issuedQty: normalizedIssued,
        status: toIssueStatusFromExecution({
          requestStatus: request.requestStatus,
          hasExecutionDocs: executionDocs.length > 0,
          requestedQty: normalizedRequested,
          completedQty: normalizedIssued,
        }),
        stageCode: runtimeTask.stageCode,
        stageName: runtimeTask.stageName,
        processCode: runtimeTask.processBusinessCode || runtimeTask.processCode,
        processName: runtimeTask.processBusinessName || runtimeTask.processNameZh || runtimeTask.processCode,
        craftCode: runtimeTask.craftCode,
        craftName: runtimeTask.craftName,
        taskTypeLabel: runtimeTask.taskCategoryZh || runtimeTask.processBusinessName || runtimeTask.processNameZh,
        assignmentGranularityLabel: formatGranularityLabel(runtimeTask.assignmentGranularity),
        executorKind: runtimeTask.executorKind ?? 'EXTERNAL_FACTORY',
        sourceDocNos: executionDocs.map((doc) => doc.docNo),
        updatedAt: request.updatedAt,
        createdBy: request.createdBy,
      } satisfies ProgressMaterialIssueRow
    })
    .filter((item): item is ProgressMaterialIssueRow => Boolean(item))
    .sort((a, b) => parseDateMs(b.updatedAt) - parseDateMs(a.updatedAt))
}

export function listProgressMaterialIssueRowsByOrder(productionOrderId: string): ProgressMaterialIssueRow[] {
  return listProgressMaterialIssueRows().filter((row) => row.productionOrderId === productionOrderId)
}

export function listProgressMaterialStatementDrafts(): ProgressMaterialStatementDraft[] {
  const grouped = new Map<string, ProgressMaterialIssueRow[]>()
  listProgressMaterialIssueRows().forEach((row) => {
    const current = grouped.get(row.productionOrderId) ?? []
    current.push(row)
    grouped.set(row.productionOrderId, current)
  })

  return Array.from(grouped.entries())
    .map(([productionOrderId, rows]) => {
      const sortedRows = rows
        .slice()
        .sort((a, b) => a.issueId.localeCompare(b.issueId))
      const allIssued = sortedRows.length > 0 && sortedRows.every((row) => row.status === 'ISSUED')
      const status: ProgressMaterialStatementDraft['status'] = allIssued ? 'CONFIRMED' : 'DRAFT'
      const newest = sortedRows.reduce((acc, row) =>
        parseDateMs(row.updatedAt) > parseDateMs(acc.updatedAt) ? row : acc, sortedRows[0])
      const issueIds = sortedRows.map((row) => row.issueId)
      const items = sortedRows.map((row) => ({
        issueId: row.issueId,
        taskId: row.taskId,
        materialSummaryZh: row.materialSummaryZh,
        requestedQty: row.requestedQty,
        issuedQty: row.issuedQty,
      }))
      return {
        materialStatementId: `MST-${productionOrderId}`,
        productionOrderId,
        itemCount: items.length,
        totalRequestedQty: items.reduce((sum, item) => sum + item.requestedQty, 0),
        totalIssuedQty: items.reduce((sum, item) => sum + item.issuedQty, 0),
        status,
        issueIds,
        items,
        remark: '来源新链路执行事实自动汇总',
        createdAt: newest.updatedAt,
        createdBy: newest.createdBy,
        updatedAt: newest.updatedAt,
        updatedBy: newest.createdBy,
      } satisfies ProgressMaterialStatementDraft
    })
    .sort((a, b) => parseDateMs(b.updatedAt) - parseDateMs(a.updatedAt))
}

function buildAutoCaseKey(runtimeTaskId: string, subCategoryKey: SubCategoryKey): string {
  return `${AUTO_PROGRESS_TAG}:${runtimeTaskId}:${subCategoryKey}`
}

function createProgressExceptionCandidates(): ProgressExceptionCandidate[] {
  const facts = listProgressFacts()
  const candidates: ProgressExceptionCandidate[] = []

  facts.forEach((fact) => {
    const runtimeTask = getRuntimeTaskById(fact.runtimeTaskId)
    if (!runtimeTask) return
    const issueOrTransferDocs = fact.executionDocs.filter(
      (doc) => doc.docType === 'ISSUE' || doc.docType === 'INTERNAL_TRANSFER',
    )
    const returnDocs = fact.executionDocs.filter((doc) => doc.docType === 'RETURN')
    const skipMaterialChecks =
      fact.transitionFromPrev === 'SAME_FACTORY_CONTINUE' &&
      issueOrTransferDocs.length === 0 &&
      fact.executorKind === 'EXTERNAL_FACTORY'

    const relatedTaskIds = [fact.baseTaskId]
    const relatedOrderIds = [fact.productionOrderId]
    const linkedFactoryName = fact.assignedFactoryName
    const eventAt = pickLatestTimestamp([
      runtimeTask.updatedAt,
      ...fact.materialRequests.map((request) => request.updatedAt),
      ...fact.executionDocs.map((doc) => doc.updatedAt),
      ...fact.executionDocs.map((doc) => doc.createdAt),
    ])

    if (!skipMaterialChecks) {
      if (!fact.startReadiness.canStart) {
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'MATERIAL_NOT_READY'),
          reasonCode: 'MATERIAL_NOT_READY',
          category: 'MATERIAL',
          unifiedCategory: 'MATERIAL',
          subCategoryKey: 'MATERIAL_NOT_READY',
          severity: 'S2',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '物料未齐套，暂不可开工',
          detail: `${fact.processNameZh}（${fact.scopeLabel}）当前卡点：${fact.startReadiness.reasonText}`,
          closureReady: runtimeTask.status === 'DONE' || runtimeTask.status === 'CANCELLED',
          eventAt,
        })
      }

      if (hasPreparingStatus(issueOrTransferDocs)) {
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'MATERIAL_PREP_PENDING'),
          reasonCode: 'MATERIAL_NOT_READY',
          category: 'MATERIAL',
          unifiedCategory: 'MATERIAL',
          subCategoryKey: 'MATERIAL_PREP_PENDING',
          severity: 'S3',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '仓库备料未完成',
          detail: `${fact.processNameZh}（${fact.scopeLabel}）存在待备料执行单，仓库尚未齐套`,
          closureReady: issueOrTransferDocs.every((doc) => !isDocActive(doc.status)),
          eventAt,
        })
      }

      if (hasDocShortage(issueOrTransferDocs)) {
        const shortageLine = issueOrTransferDocs
          .flatMap((doc) => doc.lines.map((line) => ({ ...line, docNo: doc.docNo })))
          .find((line) => line.shortQty > 0)
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'MATERIAL_QTY_SHORT'),
          reasonCode: 'MATERIAL_NOT_READY',
          category: 'MATERIAL',
          unifiedCategory: 'MATERIAL',
          subCategoryKey: 'MATERIAL_QTY_SHORT',
          severity: 'S2',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '领料数量存在缺口',
          detail: shortageLine
            ? `${fact.processNameZh}（${fact.scopeLabel}）物料 ${shortageLine.materialName} 缺口 ${shortageLine.shortQty}${shortageLine.unit}`
            : `${fact.processNameZh}（${fact.scopeLabel}）存在领料数量缺口`,
          closureReady: !hasDocShortage(issueOrTransferDocs),
          eventAt,
        })
      }

      const openIssueDocs = issueOrTransferDocs.filter((doc) => isDocActive(doc.status))
      const openByType = openIssueDocs.reduce<Record<string, number>>((acc, doc) => {
        acc[doc.docType] = (acc[doc.docType] ?? 0) + 1
        return acc
      }, {})
      const hasMultiOpen = Object.values(openByType).some((count) => count > 1)
      if (hasMultiOpen) {
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'MATERIAL_MULTI_OPEN'),
          reasonCode: 'MATERIAL_NOT_READY',
          category: 'MATERIAL',
          unifiedCategory: 'MATERIAL',
          subCategoryKey: 'MATERIAL_MULTI_OPEN',
          severity: 'S3',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '同任务存在多张未闭合领料执行单',
          detail: `${fact.processNameZh}（${fact.scopeLabel}）存在多张活跃执行单，请先收口后继续`,
          closureReady: !hasMultiOpen,
          eventAt,
        })
      }
    }

    const shouldReturnToWarehouse =
      fact.executorKind === 'EXTERNAL_FACTORY' && fact.transitionToNext !== 'SAME_FACTORY_CONTINUE'

    if (shouldReturnToWarehouse) {
      const hasPendingCheck = returnDocs.some((doc) => doc.status !== 'RETURNED' && doc.status !== 'CLOSED')
      if (hasPendingCheck || (runtimeTask.status === 'DONE' && returnDocs.length === 0)) {
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'HANDOUT_PENDING_CHECK'),
          reasonCode: 'HANDOVER_DIFF',
          category: 'HANDOVER',
          unifiedCategory: 'HANDOUT',
          subCategoryKey: 'HANDOUT_PENDING_CHECK',
          severity: 'S2',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '工序回货待仓库确认',
          detail:
            returnDocs.length === 0
              ? `${fact.processNameZh}（${fact.scopeLabel}）已完工但未生成回货单，请补齐回仓链路`
              : `${fact.processNameZh}（${fact.scopeLabel}）已交出，等待仓库确认入仓`,
          closureReady: returnDocs.every((doc) => isDocClosed(doc.status)),
          eventAt,
        })
      }

      const diffLine = returnDocs
        .flatMap((doc) => doc.lines)
        .find((line) => Math.abs((line.plannedQty ?? 0) - (line.returnedQty ?? 0)) > 0)
      if (diffLine) {
        const diffQty = Math.round(((diffLine.plannedQty ?? 0) - (diffLine.returnedQty ?? 0)) * 100) / 100
        candidates.push({
          key: buildAutoCaseKey(fact.runtimeTaskId, 'HANDOUT_DIFF'),
          reasonCode: 'HANDOVER_DIFF',
          category: 'HANDOVER',
          unifiedCategory: 'HANDOUT',
          subCategoryKey: 'HANDOUT_DIFF',
          severity: 'S2',
          sourceId: fact.runtimeTaskId,
          relatedOrderIds,
          relatedTaskIds,
          linkedFactoryName,
          summary: '回货数量存在差异',
          detail: `${fact.processNameZh}（${fact.scopeLabel}）回货差异 ${diffQty}${diffLine.unit}`,
          closureReady: !diffLine,
          eventAt,
        })
      }
    }
  })

  return candidates
}

export function syncProgressFactsAndExceptions(): ExceptionCase[] {
  const candidates = createProgressExceptionCandidates()
  const activeKeys = new Set(candidates.map((candidate) => candidate.key))

  for (const candidate of candidates) {
    const existed = progressExceptionCases.find((item) => item.sourceModule === candidate.key)
    if (!existed) {
      const createdAt = candidate.eventAt || nowAt()
      progressExceptionCases.push({
        caseId: generateAutoProgressCaseId(candidate.key),
        caseStatus: 'OPEN',
        severity: candidate.severity,
        category: candidate.category,
        unifiedCategory: candidate.unifiedCategory,
        subCategoryKey: candidate.subCategoryKey,
        reasonCode: candidate.reasonCode,
        sourceType: 'TASK',
        sourceId: candidate.sourceId,
        sourceSystem: 'RUNTIME_FLOW',
        sourceModule: candidate.key,
        relatedOrderIds: candidate.relatedOrderIds,
        relatedTaskIds: candidate.relatedTaskIds,
        relatedTenderIds: [],
        linkedFactoryName: candidate.linkedFactoryName,
        summary: candidate.summary,
        detail: candidate.detail,
        createdAt,
        updatedAt: createdAt,
        tags: ['自动生成', AUTO_PROGRESS_TAG],
        actions: [],
        auditLogs: [
          {
            id: `EAL-AUTO-${shortStableKey(candidate.key)}-CREATE`,
            action: 'CREATE',
            detail: '新链路事实自动生成异常',
            at: createdAt,
            by: '系统',
          },
        ],
      })
      continue
    }

    let changed = false
    if (existed.summary !== candidate.summary) {
      existed.summary = candidate.summary
      changed = true
    }
    if (existed.detail !== candidate.detail) {
      existed.detail = candidate.detail
      changed = true
    }
    if (existed.unifiedCategory !== candidate.unifiedCategory) {
      existed.unifiedCategory = candidate.unifiedCategory
      changed = true
    }
    if (existed.subCategoryKey !== candidate.subCategoryKey) {
      existed.subCategoryKey = candidate.subCategoryKey
      changed = true
    }
    if (existed.category !== candidate.category) {
      existed.category = candidate.category
      changed = true
    }
    if (existed.reasonCode !== candidate.reasonCode) {
      existed.reasonCode = candidate.reasonCode
      changed = true
    }
    if (existed.relatedOrderIds.join('|') !== candidate.relatedOrderIds.join('|')) {
      existed.relatedOrderIds = candidate.relatedOrderIds
      changed = true
    }
    if (existed.relatedTaskIds.join('|') !== candidate.relatedTaskIds.join('|')) {
      existed.relatedTaskIds = candidate.relatedTaskIds
      changed = true
    }
    if (existed.linkedFactoryName !== candidate.linkedFactoryName) {
      existed.linkedFactoryName = candidate.linkedFactoryName
      changed = true
    }
    if (changed) {
      existed.updatedAt = maxTimestamp(existed.updatedAt, candidate.eventAt)
    }
    if (toExceptionStatus(existed.caseStatus) !== 'OPEN' && toExceptionStatus(existed.caseStatus) !== 'IN_PROGRESS') {
      existed.caseStatus = 'OPEN'
      existed.resolvedAt = undefined
      existed.resolvedBy = undefined
      existed.closedAt = undefined
      existed.closedBy = undefined
      existed.closeReasonCode = undefined
      existed.closeDetail = undefined
      existed.closeRemark = undefined
      existed.updatedAt = maxTimestamp(existed.updatedAt, candidate.eventAt)
    }
  }

  progressExceptionCases.forEach((item) => {
    if (!item.tags.includes(AUTO_PROGRESS_TAG)) return
    if (activeKeys.has(item.sourceModule || '')) return
    const status = toExceptionStatus(item.caseStatus)
    if (status === 'OPEN' || status === 'IN_PROGRESS') {
      item.caseStatus = 'RESOLVED'
      item.resolvedAt = item.updatedAt || nowAt()
      item.resolvedBy = '系统'
      item.resolvedDetail = '新链路条件恢复正常，系统自动判定为已解决'
      item.updatedAt = item.resolvedAt
      return
    }

    if (status === 'RESOLVED') {
      const runtimeTask = getRuntimeTaskById(item.sourceId)
      if (!runtimeTask || runtimeTask.status === 'DONE' || runtimeTask.status === 'CANCELLED') {
        item.caseStatus = 'CLOSED'
        item.closedAt = item.resolvedAt || item.updatedAt || nowAt()
        item.closedBy = '系统'
        item.closeReasonCode = 'RESOLVED_DONE'
        item.closeDetail = '链路已闭环，系统自动关闭'
        item.closeRemark = item.closeDetail
        item.updatedAt = item.closedAt
      }
    }
  })

  return progressExceptionCases
}

function isProgressFactBackedCase(item: ExceptionCase): boolean {
  if (item.tags.includes(AUTO_PROGRESS_TAG)) return true
  if (item.sourceSystem === 'RUNTIME_FLOW') return true
  if (item.relatedTaskIds.some((taskId) => Boolean(getRuntimeTaskById(taskId)))) return true
  return false
}

export function listProgressExceptions(): ExceptionCase[] {
  return syncProgressFactsAndExceptions()
    .filter(isProgressFactBackedCase)
    .slice()
    .sort((a, b) => parseDateMs(b.updatedAt) - parseDateMs(a.updatedAt))
}

export function getProgressExceptionById(caseId: string): ExceptionCase | undefined {
  return listProgressExceptions().find((item) => item.caseId === caseId)
}

export function upsertProgressExceptionCase(updated: ExceptionCase): void {
  const index = progressExceptionCases.findIndex((item) => item.caseId === updated.caseId)
  if (index >= 0) {
    progressExceptionCases[index] = updated
    return
  }
  progressExceptionCases.push(updated)
}

export function listProgressExceptionsByOrder(productionOrderId: string): ExceptionCase[] {
  return listProgressExceptions().filter((item) => item.relatedOrderIds.includes(productionOrderId))
}

export function getProgressExceptionSummary(): ProgressExceptionSummary {
  const cases = listProgressExceptions()
  return {
    totalCount: cases.length,
    openCount: cases.filter((item) => item.caseStatus === 'OPEN').length,
    inProgressCount: cases.filter((item) => item.caseStatus === 'IN_PROGRESS').length,
    resolvedCount: cases.filter((item) => item.caseStatus === 'RESOLVED').length,
    closedCount: cases.filter((item) => item.caseStatus === 'CLOSED').length,
    s1Count: cases.filter((item) => item.severity === 'S1').length,
    s2Count: cases.filter((item) => item.severity === 'S2').length,
    s3Count: cases.filter((item) => item.severity === 'S3').length,
  }
}

export function getProgressExceptionSummaryByOrder(productionOrderId: string): ProgressExceptionSummary {
  const cases = listProgressExceptionsByOrder(productionOrderId)
  return {
    totalCount: cases.length,
    openCount: cases.filter((item) => item.caseStatus === 'OPEN').length,
    inProgressCount: cases.filter((item) => item.caseStatus === 'IN_PROGRESS').length,
    resolvedCount: cases.filter((item) => item.caseStatus === 'RESOLVED').length,
    closedCount: cases.filter((item) => item.caseStatus === 'CLOSED').length,
    s1Count: cases.filter((item) => item.severity === 'S1').length,
    s2Count: cases.filter((item) => item.severity === 'S2').length,
    s3Count: cases.filter((item) => item.severity === 'S3').length,
  }
}

export function getOrderMaterialFlowSummary(productionOrderId: string): ProgressMaterialFlowSummary {
  const summary = getWarehouseExecutionSummaryByOrder(productionOrderId)
  return {
    productionOrderId,
    requestCount: summary.requestCount,
    issueOrderCount: summary.issueOrderCount,
    returnOrderCount: summary.returnOrderCount,
    internalTransferCount: summary.internalTransferCount,
    shortLineCount: summary.shortLineCount,
    completionRate: summary.completionRate,
    completenessRate: summary.completenessRate,
  }
}

export function getOrderExecutionHealthSummary(productionOrderId: string): ProgressExecutionHealthSummary {
  const facts = listProgressFactsByOrder(productionOrderId)
  const exceptions = listProgressExceptionsByOrder(productionOrderId)
  return {
    productionOrderId,
    blockingExceptionCount: exceptions.filter((item) => item.caseStatus === 'OPEN' || item.caseStatus === 'IN_PROGRESS').length,
    handoutExceptionCount: exceptions.filter(
      (item) =>
        (item.caseStatus === 'OPEN' || item.caseStatus === 'IN_PROGRESS') &&
        item.subCategoryKey?.startsWith('HANDOUT_'),
    ).length,
    materialExceptionCount: exceptions.filter(
      (item) =>
        (item.caseStatus === 'OPEN' || item.caseStatus === 'IN_PROGRESS') &&
        item.unifiedCategory === 'MATERIAL',
    ).length,
    waitingStartTaskCount: facts.filter((fact) => !fact.startReadiness.canStart).length,
    openExceptionCount: exceptions.filter((item) => item.caseStatus === 'OPEN').length,
  }
}

export function getOrderProgressSummary(productionOrderId: string): ProgressOrderSummary {
  const facts = listProgressFactsByOrder(productionOrderId)
  const docs = listWarehouseExecutionDocsByOrder(productionOrderId)
  const exceptions = listProgressExceptionsByOrder(productionOrderId)
  return {
    productionOrderId,
    taskCount: facts.length,
    canStartTaskCount: facts.filter((fact) => fact.startReadiness.canStart).length,
    issueOrderCount: docs.filter((doc) => doc.docType === 'ISSUE').length,
    returnOrderCount: docs.filter((doc) => doc.docType === 'RETURN').length,
    internalTransferCount: docs.filter((doc) => doc.docType === 'INTERNAL_TRANSFER').length,
    openExceptionCount: exceptions.filter((item) => item.caseStatus === 'OPEN' || item.caseStatus === 'IN_PROGRESS').length,
  }
}
