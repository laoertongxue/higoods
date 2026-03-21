// =============================================
// 任务分配 / 执行准备域 — 静态类型 + seed 数据
// 当前原型仓直接使用的数据域定义与种子文件
// 冻结规则：本文件作为兼容适配层时，只做旧 shape 到新事实源的映射，
// 不作为页面 UI/交互改造入口。
// =============================================
import {
  listProgressMaterialIssueRows,
  listProgressMaterialStatementDrafts,
} from './store-domain-progress'
import {
  listRuntimeExecutionTasks,
  upsertRuntimeTaskTender,
  type RuntimeProcessTask,
} from './runtime-process-tasks'

// ─── 招标单台账 ──────────────────────────────
export type TenderOrderStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOID'

// ─── 领料对账单 ──────────────────────────────
export type MaterialStatementStatus = 'DRAFT' | 'CONFIRMED' | 'CLOSED'

export interface MaterialStatementItem {
  issueId: string
  taskId: string
  taskNo?: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  isSplitResult?: boolean
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
  taskNo?: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  isSplitResult?: boolean
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

function buildLegacyMaterialIssueSheetsFromRuntime(): MaterialIssueSheet[] {
  return listProgressMaterialIssueRows().map((row) => ({
    issueId: row.issueId,
    productionOrderId: row.productionOrderId,
    taskId: row.taskId,
    taskNo: row.taskNo,
    rootTaskNo: row.rootTaskNo,
    splitGroupId: row.splitGroupId,
    splitFromTaskNo: row.splitFromTaskNo,
    isSplitResult: row.isSplitResult,
    materialSummaryZh: `${row.materialSummaryZh}（${row.processName} / ${row.assignmentGranularityLabel}）`,
    requestedQty: row.requestedQty,
    issuedQty: row.issuedQty,
    status: row.status,
    remark: row.sourceDocNos.length > 0 ? `来源新执行链路：${row.sourceDocNos.join('、')}` : '来源新执行链路：待生成仓库执行单',
    createdAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.createdBy,
  }))
}

export function listMaterialIssueSheetsFromRuntime(): MaterialIssueSheet[] {
  return buildLegacyMaterialIssueSheetsFromRuntime()
    .map((item) => ({ ...item }))
    .sort((left, right) => left.issueId.localeCompare(right.issueId))
}

export function listMaterialStatementDraftsFromRuntime(): MaterialStatementDraft[] {
  return listProgressMaterialStatementDrafts()
    .map((draft) => ({
      materialStatementId: draft.materialStatementId,
      productionOrderId: draft.productionOrderId,
      itemCount: draft.itemCount,
      totalRequestedQty: draft.totalRequestedQty,
      totalIssuedQty: draft.totalIssuedQty,
      status: draft.status,
      issueIds: [...draft.issueIds],
      items: draft.items.map((item) => ({ ...item })),
      remark: draft.remark,
      createdAt: draft.createdAt,
      createdBy: draft.createdBy,
      updatedAt: draft.updatedAt,
      updatedBy: draft.updatedBy,
    }))
    .sort((left, right) => left.materialStatementId.localeCompare(right.materialStatementId))
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

function parseDateLike(value: string | undefined): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function resolveTenderStatus(tasks: RuntimeProcessTask[], deadline: string): TenderStatus {
  const hasAwarded = tasks.some((task) => task.assignmentStatus === 'AWARDED')
  if (hasAwarded) return 'AWARDED'

  const hasActiveBidding = tasks.some(
    (task) =>
      task.assignmentMode === 'BIDDING'
      && (task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING'),
  )
  if (!hasActiveBidding) return 'CLOSED'

  const deadlineMs = parseDateLike(deadline)
  const mockNowMs = parseDateLike('2026-03-20 10:00:00')
  if (Number.isFinite(deadlineMs) && Number.isFinite(mockNowMs) && deadlineMs < mockNowMs) return 'OVERDUE'
  return 'OPEN'
}

function resolveTenderDeadline(tasks: RuntimeProcessTask[]): string {
  const deadlines = tasks
    .map((task) => task.biddingDeadline || task.taskDeadline || '')
    .filter((value) => Boolean(value))
    .sort((left, right) => parseDateLike(left) - parseDateLike(right))
  return deadlines[0] ?? ''
}

function buildLegacyTendersFromRuntime(): Tender[] {
  // 兼容层口径：仅基于当前实际执行任务生成竞价视图，避免拆分来源任务误入执行主线。
  const runtimeTasks = listRuntimeExecutionTasks().filter(
    (task) => Boolean(task.tenderId) && task.defaultDocType !== 'DEMAND',
  )
  const grouped = new Map<string, RuntimeProcessTask[]>()

  for (const task of runtimeTasks) {
    if (!task.tenderId) continue
    const current = grouped.get(task.tenderId) ?? []
    current.push(task)
    grouped.set(task.tenderId, current)
  }

  return Array.from(grouped.entries())
    .map(([tenderId, tasks]) => {
      const taskIds = Array.from(new Set(tasks.map((task) => task.baseTaskId || task.taskId)))
      const productionOrderIds = Array.from(new Set(tasks.map((task) => task.productionOrderId)))
      const invitedFactoryIds = Array.from(
        new Set(tasks.map((task) => task.assignedFactoryId).filter((factoryId): factoryId is string => Boolean(factoryId))),
      )
      const deadline = resolveTenderDeadline(tasks)
      const createdAt = [...tasks]
        .map((task) => task.createdAt)
        .filter((value) => Boolean(value))
        .sort((left, right) => parseDateLike(left) - parseDateLike(right))[0] ?? formatTimestamp(new Date('2026-03-01T00:00:00Z'))
      const updatedAt = [...tasks]
        .map((task) => task.updatedAt)
        .filter((value) => Boolean(value))
        .sort((left, right) => parseDateLike(right) - parseDateLike(left))[0] ?? createdAt
      const winnerTask = tasks.find((task) => task.assignmentStatus === 'AWARDED')
      const winnerFactoryId = winnerTask?.assignedFactoryId

      return {
        tenderId,
        taskIds,
        productionOrderIds,
        deadline,
        invitedFactoryIds,
        status: resolveTenderStatus(tasks, deadline),
        winnerFactoryId,
        bids: [],
        awardRule: 'LOWEST_PRICE',
        createdAt,
        createdBy: '系统',
        updatedAt,
        auditLogs: [
          {
            id: `TAL-${tenderId}-001`,
            action: 'DERIVE',
            detail: '由 runtime 任务事实映射生成竞价台账',
            at: updatedAt,
            by: '系统',
          },
        ],
      } satisfies Tender
    })
    .sort((left, right) => left.tenderId.localeCompare(right.tenderId))
}

export function listTendersFromRuntime(): Tender[] {
  return buildLegacyTendersFromRuntime().map((item) => ({
    ...item,
    taskIds: [...item.taskIds],
    productionOrderIds: [...item.productionOrderIds],
    invitedFactoryIds: [...item.invitedFactoryIds],
    bids: item.bids.map((bid) => ({ ...bid })),
    auditLogs: item.auditLogs.map((log) => ({ ...log })),
  }))
}

export function getTenderByIdFromRuntime(tenderId: string): Tender | undefined {
  return listTendersFromRuntime().find((item) => item.tenderId === tenderId)
}

export function listTenderOrdersFromRuntime(): TenderOrder[] {
  return listTendersFromRuntime().map((tender) => {
    const status: TenderOrderStatus =
      tender.status === 'CANCELLED'
        ? 'VOID'
        : tender.status === 'OPEN' || tender.status === 'OVERDUE'
          ? 'OPEN'
          : 'CLOSED'

    return {
      tenderId: tender.tenderId,
      productionOrderId: tender.productionOrderIds[0],
      taskIds: [...tender.taskIds],
      titleZh: '工序竞价招标',
      targetFactoryIds: [...tender.invitedFactoryIds],
      bidDeadline: tender.deadline,
      status,
      candidateFactoryIds: [...tender.invitedFactoryIds],
      awardedFactoryId: tender.winnerFactoryId,
      awardStatus: tender.status === 'AWARDED' ? 'AWARDED' : 'PENDING',
      createdAt: tender.createdAt,
      createdBy: tender.createdBy,
      updatedAt: tender.updatedAt,
      updatedBy: '系统',
    } satisfies TenderOrder
  })
}

export function extendTenderDeadlineFromRuntime(
  tenderId: string,
  extendHours: number,
  by: string,
): string | null {
  const targetTasks = listRuntimeExecutionTasks().filter((task) => task.tenderId === tenderId)
  if (!targetTasks.length) return null

  const currentDeadline = resolveTenderDeadline(targetTasks)
  const baseMs = parseDateLike(currentDeadline)
  const baseDate = Number.isFinite(baseMs) ? new Date(baseMs) : new Date('2026-03-20T00:00:00Z')
  baseDate.setHours(baseDate.getHours() + extendHours)
  const nextDeadline = formatTimestamp(baseDate)

  targetTasks.forEach((task) => {
    upsertRuntimeTaskTender(
      task.taskId,
      {
        tenderId,
        biddingDeadline: nextDeadline,
        taskDeadline: task.taskDeadline || nextDeadline,
      },
      by,
    )
  })

  return nextDeadline
}

// ─── 兼容常量导出（非主真相） ──────────────────
export const initialTenders: Tender[] = buildLegacyTendersFromRuntime()
export const initialTenderOrders: TenderOrder[] = listTenderOrdersFromRuntime()

// ─── 历史领料单快照（兼容读取，非主真相） ───────────────
// 主流程请使用 listMaterialIssueSheetsFromRuntime 获取实时映射。
export const legacyMaterialIssueSheetsSnapshot: MaterialIssueSheet[] = buildLegacyMaterialIssueSheetsFromRuntime()

// 兼容读取：旧页面若仍按“初始常量”语义读取，可改用本 getter 获取实时映射结果。
export function getInitialMaterialIssueSheetsLegacy(): MaterialIssueSheet[] {
  return listMaterialIssueSheetsFromRuntime().map((item) => ({ ...item }))
}

export function getInitialMaterialStatementDraftsLegacy(): MaterialStatementDraft[] {
  return listMaterialStatementDraftsFromRuntime().map((item) => ({
    ...item,
    issueIds: [...item.issueIds],
    items: item.items.map((row) => ({ ...row })),
  }))
}

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
