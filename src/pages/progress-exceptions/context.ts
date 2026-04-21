import { appStore } from '../../state/store'
import { escapeHtml } from '../../utils'
import {
  type ProcessTask,
  type TaskAuditLog,
} from '../../data/fcs/process-tasks'
import {
  getExecutionTaskFactById,
} from '../../data/fcs/page-adapters/task-execution-adapter'
import {
  processTypes,
  getProcessTypeByCode,
} from '../../data/fcs/process-types'
import {
  productionOrders,
  type ProductionOrder,
} from '../../data/fcs/production-orders'
import { indonesiaFactories } from '../../data/fcs/indonesia-factories'
import {
  extendTenderDeadlineFromRuntime,
  getTenderByIdFromRuntime,
  listMaterialIssueSheetsFromRuntime,
  type Tender,
} from '../../data/fcs/store-domain-dispatch-process'
import {
  initialNotifications,
  initialUrges,
  mockInternalUsers,
  generateNotificationId,
  generateUrgeId,
  type CaseStatus,
  type ExceptionCase,
  type ExceptionCategory,
  type Notification,
  type ReasonCode,
  type Severity,
  type UrgeLog,
  type UrgeType,
  getProgressExceptionById,
  listProgressExceptions,
  upsertProgressExceptionCase,
} from '../../data/fcs/store-domain-progress'
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap'
import { syncPdaStartRiskAndExceptions } from '../../data/fcs/pda-start-link'
import { ensurePdaPickupDisputeSeedCases } from '../../helpers/fcs-pda-pickup-dispute'
import type { ClaimDisputeStatus } from '../../models/fcs-claim-dispute'
import {
  allowContinueFromPauseException,
  recordPauseExceptionFollowUp,
  syncMilestoneOverdueExceptions,
} from '../../data/fcs/pda-exec-link'
import {
  buildHandoverOrderDetailLink,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
} from '../../data/fcs/handover-ledger-view'
import {
  CATEGORY_LABEL,
  SUB_CATEGORY_LABEL,
  getDefaultSubCategoryKeyFromReason,
  getSubCategoryOptionsByCategory,
  getUnifiedCategoryFromReason,
  inferLegacySubCategoryKey,
  isSubCategoryKey,
  type SubCategoryKey,
  type UnifiedCategory,
} from '../../data/fcs/progress-exception-taxonomy'
import {
  appendCaseAction,
  appendCaseAuditLog,
  appendCaseStatusChangeAudit,
  CLOSE_REASON_LABEL,
  markCaseClosed,
  markCaseResolved,
  maybeAutoCloseResolvedCase,
  RESOLVE_RULE_LABEL,
  RESOLVE_SOURCE_LABEL,
  type CloseReasonCode,
  type ResolveRuleCode,
} from '../../data/fcs/progress-exception-lifecycle'

applyQualitySeedBootstrap()
ensurePdaPickupDisputeSeedCases()

export type AggregateFilter =
  | { type: 'reason'; value: SubCategoryKey }
  | { type: 'factory'; value: string }
  | { type: 'process'; value: string }

export type UiCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export const EXCEPTION_PAGE_SIZE = 20

export interface ProgressExceptionsState {
  lastQueryKey: string
  initializedByQuery: boolean

  upstreamTaskId: string
  upstreamPo: string
  upstreamTenderId: string
  upstreamReasonCode: string
  upstreamSeverity: string
  upstreamCaseId: string
  showUpstreamHint: boolean

  keyword: string
  statusFilter: 'ALL' | UiCaseStatus
  severityFilter: string
  categoryFilter: 'ALL' | UnifiedCategory
  subCategoryFilter: 'ALL' | SubCategoryKey
  ownerFilter: string
  factoryFilter: string
  processFilter: string
  currentPage: number

  aggregateFilter: AggregateFilter | null

  detailCaseId: string | null
  closeDialogCaseId: string | null
  closeReason: CloseReasonCode
  closeRemark: string
  closeMergeCaseId: string
  unblockDialogCaseId: string | null
  unblockRemark: string

  pauseFollowUpCaseId: string | null
  pauseFollowUpRemark: string

  extendDialogCaseId: string | null

  claimDisputeHandleStatus: ClaimDisputeStatus
  claimDisputeHandleConclusion: string
  claimDisputeHandleNote: string

  pickupDisputeHandleStatus: 'PROCESSING' | 'RESOLVED'
  pickupDisputeHandleResolvedQty: string
  pickupDisputeHandleNote: string

  rowActionMenuCaseId: string | null
}

export const state: ProgressExceptionsState = {
  lastQueryKey: '',
  initializedByQuery: false,

  upstreamTaskId: '',
  upstreamPo: '',
  upstreamTenderId: '',
  upstreamReasonCode: '',
  upstreamSeverity: '',
  upstreamCaseId: '',
  showUpstreamHint: false,

  keyword: '',
  statusFilter: 'ALL',
  severityFilter: 'ALL',
  categoryFilter: 'ALL',
  subCategoryFilter: 'ALL',
  ownerFilter: 'ALL',
  factoryFilter: 'ALL',
  processFilter: 'ALL',
  currentPage: 1,

  aggregateFilter: null,

  detailCaseId: null,
  closeDialogCaseId: null,
  closeReason: 'RESOLVED_DONE',
  closeRemark: '',
  closeMergeCaseId: '',
  unblockDialogCaseId: null,
  unblockRemark: '',

  pauseFollowUpCaseId: null,
  pauseFollowUpRemark: '',

  extendDialogCaseId: null,

  claimDisputeHandleStatus: 'VIEWED',
  claimDisputeHandleConclusion: '',
  claimDisputeHandleNote: '',

  pickupDisputeHandleStatus: 'PROCESSING',
  pickupDisputeHandleResolvedQty: '',
  pickupDisputeHandleNote: '',

  rowActionMenuCaseId: null,
}

export const SEVERITY_COLOR_CLASS: Record<Severity, string> = {
  S1: 'border-red-200 bg-red-100 text-red-700',
  S2: 'border-orange-200 bg-orange-100 text-orange-700',
  S3: 'border-slate-200 bg-slate-100 text-slate-600',
}

export const STATUS_COLOR_CLASS: Record<UiCaseStatus, string> = {
  OPEN: 'border-red-200 bg-red-100 text-red-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-100 text-blue-700',
  RESOLVED: 'border-green-200 bg-green-100 text-green-700',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

export const STATUS_ICON: Record<UiCaseStatus, string> = {
  OPEN: 'alert-circle',
  IN_PROGRESS: 'play',
  RESOLVED: 'check-circle-2',
  CLOSED: 'x-circle',
}

export const CASE_STATUS_LABEL: Record<UiCaseStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
}

export const DIRECT_CLOSE_REASON_SET = new Set<CloseReasonCode>([
  'DUPLICATE',
  'FALSE_ALARM',
  'OBJECT_INVALID',
  'MERGED',
])

export const REASON_LABEL: Record<ReasonCode, string> = {
  BLOCKED_MATERIAL: '物料待处理',
  BLOCKED_CAPACITY: '产能待处理',
  BLOCKED_QUALITY: '质量待处理',
  BLOCKED_TECH: '技术待处理',
  BLOCKED_EQUIPMENT: '设备待处理',
  BLOCKED_OTHER: '其他待处理',
  TENDER_OVERDUE: '竞价逾期',
  TENDER_NEAR_DEADLINE: '竞价临近截止',
  NO_BID: '无人报价',
  PRICE_ABNORMAL: '报价异常',
  DISPATCH_REJECTED: '派单拒单',
  ACK_TIMEOUT: '接单超时',
  TECH_PACK_NOT_RELEASED: '技术包未发布',
  FACTORY_BLACKLISTED: '工厂黑名单',
  HANDOVER_DIFF: '交接差异',
  MATERIAL_NOT_READY: '物料未齐套',
  START_OVERDUE: '开工逾期',
  MILESTONE_NOT_REPORTED: '关键节点未上报',
}

export function getReasonLabel(exc: ExceptionCase): string {
  return exc.reasonLabel || REASON_LABEL[exc.reasonCode] || exc.reasonCode
}

export function normalizeCaseStatus(status: CaseStatus): UiCaseStatus {
  return status
}

export function getUnifiedCategory(exc: ExceptionCase): UnifiedCategory {
  if (exc.unifiedCategory) return exc.unifiedCategory
  return getUnifiedCategoryFromReason(exc.reasonCode, exc.category)
}

export function getSubCategoryKey(exc: ExceptionCase): SubCategoryKey {
  if (exc.subCategoryKey) return exc.subCategoryKey
  const byReason = getDefaultSubCategoryKeyFromReason(exc.reasonCode)
  if (byReason) return byReason
  const legacy = inferLegacySubCategoryKey(exc.reasonCode, exc.summary, exc.detail)
  if (legacy) return legacy
  return 'EXEC_BLOCK_OTHER'
}

export function getSubCategoryLabel(exc: ExceptionCase): string {
  return SUB_CATEGORY_LABEL[getSubCategoryKey(exc)]
}

export function getCaseFactoryId(exc: ExceptionCase): string {
  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (task?.assignedFactoryId) return task.assignedFactoryId
  }
  return ''
}

export function getCaseFactoryName(exc: ExceptionCase): string {
  const factoryId = getCaseFactoryId(exc)
  if (factoryId) return getFactoryById(factoryId)?.name || factoryId
  return exc.linkedFactoryName || '-'
}

export function getCaseProcessName(exc: ExceptionCase): string {
  const taskId = exc.relatedTaskIds[0]
  if (!taskId) return '-'
  const task = getTaskById(taskId)
  if (!task?.processCode) return '-'
  return getProcessTypeByCode(task.processCode)?.nameZh || task.processNameZh || task.processCode
}

export function getRelatedObjects(exc: ExceptionCase): Array<{ typeLabel: string; id: string; kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other' }> {
  const rows: Array<{ typeLabel: string; id: string; kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other' }> = []
  const pushUnique = (typeLabel: string, id: string, kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other') => {
    if (!id) return
    if (!rows.some((row) => row.typeLabel === typeLabel && row.id === id)) rows.push({ typeLabel, id, kind })
  }

  for (const orderId of exc.relatedOrderIds) pushUnique('生产单', orderId, 'order')
  for (const taskId of exc.relatedTaskIds) pushUnique('任务', taskId, 'task')
  for (const tenderId of exc.relatedTenderIds) pushUnique('招标单', tenderId, 'tender')
  if (/^PDA-/.test(exc.sourceId)) pushUnique('工厂端任务', exc.sourceId, 'pda')
  if (/^HO-/.test(exc.sourceId)) pushUnique('交出单', exc.sourceId, 'handover')
  if (rows.length === 0 && exc.sourceId) pushUnique('来源单据', exc.sourceId, 'other')

  return rows
}

export function getSubCategoryOptions(category: 'ALL' | UnifiedCategory): Array<{ key: SubCategoryKey; label: string }> {
  return getSubCategoryOptionsByCategory(category)
}

export const OWNER_OPTIONS: Array<{ id: string; name: string }> = [
  { id: 'U002', name: '跟单A' },
  { id: 'U003', name: '跟单B' },
  { id: 'U004', name: '运营' },
  { id: 'U005', name: '管理员' },
]

export function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

export function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

export function getOrderById(orderId: string): ProductionOrder | undefined {
  return productionOrders.find((order) => order.productionOrderId === orderId)
}

export function getFactoryById(factoryId: string) {
  return indonesiaFactories.find((factory) => factory.id === factoryId)
}

export function getTenderById(tenderId: string): Tender | undefined {
  return getTenderByIdFromRuntime(tenderId)
}

export function getExceptionCases(): ExceptionCase[] {
  return listProgressExceptions()
}

export function getCaseById(caseId: string): ExceptionCase | undefined {
  return getProgressExceptionById(caseId)
}

export function getTaskById(taskId: string): ProcessTask | undefined {
  return getExecutionTaskFactById(taskId) ?? undefined
}

export const TASK_STATUS_LABEL: Record<ProcessTask['status'], string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '生产暂停',
  CANCELLED: '已取消',
}

export function getTaskStatusLabel(task?: ProcessTask): string {
  if (!task) return '-'
  return TASK_STATUS_LABEL[task.status]
}

export function getMaterialIssueRows(exc: ExceptionCase) {
  return listMaterialIssueSheetsFromRuntime().filter((item) =>
    (exc.relatedTaskIds.length > 0 && exc.relatedTaskIds.includes(item.taskId)) ||
    (exc.relatedOrderIds.length > 0 && item.productionOrderId && exc.relatedOrderIds.includes(item.productionOrderId)),
  )
}

export function getHandoverCaseSnapshot(exc: ExceptionCase): {
  orderSummary: ReturnType<typeof getProductionOrderHandoverSummary> | null
  taskSummary: ReturnType<typeof getTaskHandoverSummary> | null
} {
  const firstOrderId = exc.relatedOrderIds[0]
  const firstTaskId = exc.relatedTaskIds[0]

  return {
    orderSummary: firstOrderId ? getProductionOrderHandoverSummary(firstOrderId) : null,
    taskSummary: firstTaskId ? getTaskHandoverSummary(firstTaskId) : null,
  }
}

export function parseTimestampToMs(value: string): number {
  const parsed = Date.parse(value.replace(' ', 'T'))
  return Number.isNaN(parsed) ? 0 : parsed
}

export function getRelatedTasks(exc: ExceptionCase): ProcessTask[] {
  return exc.relatedTaskIds.map((taskId) => getTaskById(taskId)).filter((task): task is ProcessTask => Boolean(task))
}

export function getRelatedTenders(exc: ExceptionCase): Tender[] {
  return exc.relatedTenderIds
    .map((tenderId) => getTenderById(tenderId))
    .filter((tender): tender is Tender => Boolean(tender))
}

export interface ResolveJudgeResult {
  resolved: boolean
  ruleText: string
  currentResultText: string
  resolvedDetail: string
  resolvedRuleCode: ResolveRuleCode
}

export function getResolveJudgeResult(exc: ExceptionCase): ResolveJudgeResult {
  const unifiedCategory = getUnifiedCategory(exc)
  const relatedTasks = getRelatedTasks(exc)
  const relatedOrders = exc.relatedOrderIds.map((orderId) => getOrderById(orderId)).filter((order): order is ProductionOrder => Boolean(order))
  const relatedTenders = getRelatedTenders(exc)

  if (unifiedCategory === 'ASSIGNMENT') {
    const hasAcceptedTask = relatedTasks.some((task) => task.acceptanceStatus === 'ACCEPTED')
    const hasAwardedTask = relatedTasks.some((task) => task.assignmentStatus === 'AWARDED')
    const allTenderAwarded = relatedTenders.length > 0 && relatedTenders.every((tender) => tender.status === 'AWARDED')

    const resolved = hasAcceptedTask || hasAwardedTask || allTenderAwarded

    return {
      resolved,
      ruleText: '任务已真正落实承接方（接单成功/竞价定标）后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：任务已落实承接方，可进入关闭流程。'
        : '当前未满足：任务尚未真正落实承接方，请继续推进分配或接单。',
      resolvedDetail: '任务已真正落实承接方，系统自动判定为已解决',
      resolvedRuleCode: 'ASSIGNMENT_TARGET_SECURED',
    }
  }

  if (unifiedCategory === 'EXECUTION') {
    if (exc.reasonCode === 'START_OVERDUE') {
      const resolved = relatedTasks.some((task) => Boolean(task.startedAt))
      return {
        resolved,
        ruleText: '工厂确认开工后，系统自动判定为已解决。',
        currentResultText: resolved
          ? '当前已满足：任务已确认开工，可进入关闭流程。'
          : '当前未满足：任务仍未开工，请先推动工厂确认开工。',
        resolvedDetail: '工厂已确认开工，系统自动判定为已解决',
        resolvedRuleCode: 'EXEC_START_CONFIRMED',
      }
    }

    if (exc.reasonCode === 'MILESTONE_NOT_REPORTED') {
      const resolved = relatedTasks.some(
        (task) => task.milestoneStatus === 'REPORTED' || Boolean(task.milestoneReportedAt),
      )
      return {
        resolved,
        ruleText: '关键节点按规则完成上报后，系统自动判定为已解决。',
        currentResultText: resolved
          ? '当前已满足：任务已补报关键节点，可进入关闭流程。'
          : '当前未满足：关键节点仍未上报，请先在工厂端移动应用中完成节点上报。',
        resolvedDetail: '任务已补报关键节点，系统自动判定为已解决',
        resolvedRuleCode: 'EXEC_MILESTONE_REPORTED',
      }
    }

    const resolved =
      relatedTasks.length > 0 &&
      relatedTasks.every((task) => task.status !== 'BLOCKED' && task.pauseStatus !== 'REPORTED' && task.pauseStatus !== 'FOLLOWING_UP')

    return {
      resolved,
      ruleText: '平台允许继续且任务恢复执行后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：任务已恢复进行中，可进入关闭流程。'
        : '当前未满足：任务仍处于生产暂停，请先处理暂停原因并允许继续。',
      resolvedDetail: '任务已恢复可执行状态，系统自动判定为已解决',
      resolvedRuleCode: 'EXEC_RESUMED',
    }
  }

  if (unifiedCategory === 'TECH_PACK') {
    const resolved = relatedOrders.length > 0 && relatedOrders.every((order) => Boolean(order.techPackSnapshot))
    return {
      resolved,
      ruleText: '技术包快照已冻结且可正常使用后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：技术包快照已冻结，可进入关闭流程。'
        : '当前未满足：生产单仍缺少可执行的技术包快照，请先处理技术包。',
      resolvedDetail: '技术包快照已冻结并可用于生产，系统自动判定为已解决',
      resolvedRuleCode: 'TECH_PACK_RELEASED',
    }
  }

  if (unifiedCategory === 'MATERIAL') {
    const rows = getMaterialIssueRows(exc)
    const isSatisfied = rows.every((row) => row.status === 'ISSUED' || row.issuedQty >= row.requestedQty)
    const resolved = rows.length > 0 && isSatisfied
    return {
      resolved,
      ruleText: '领料记录满足或领料链路闭合后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：领料记录已满足，可进入关闭流程。'
        : '当前未满足：仍有领料缺口或未闭合记录，请继续推进领料。',
      resolvedDetail: '领料记录已满足并闭合，系统自动判定为已解决',
      resolvedRuleCode: 'MATERIAL_SATISFIED',
    }
  }

  const { orderSummary, taskSummary } = getHandoverCaseSnapshot(exc)
  const resolved = taskSummary
    ? taskSummary.processStatusLabel === '已完成'
    : Boolean(orderSummary && !orderSummary.hasOpenIssue)

  return {
    resolved,
    ruleText: '交出差异/数量异议处理完成并闭合后，系统自动判定为已解决。',
    currentResultText: resolved
      ? '当前已满足：交出记录已闭合，可进入关闭流程。'
      : '当前未满足：仍有数量差异或异议未处理，请继续跟进交出处理。',
    resolvedDetail: '交出差异/异议已处理完成，系统自动判定为已解决',
    resolvedRuleCode: 'HANDOUT_ISSUE_CLOSED',
  }
}


export function hasUpstreamFilter(): boolean {
  return Boolean(
    state.upstreamTaskId ||
      state.upstreamPo ||
      state.upstreamTenderId ||
      state.upstreamReasonCode ||
      state.upstreamSeverity ||
      state.upstreamCaseId,
  )
}

export function syncFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey
  const params = getCurrentSearchParams()

  state.upstreamTaskId = params.get('taskId') || ''
  state.upstreamPo = params.get('po') || ''
  state.upstreamTenderId = params.get('tenderId') || ''
  state.upstreamReasonCode = params.get('reasonCode') || ''
  state.upstreamSeverity = params.get('severity') || ''
  state.upstreamCaseId = params.get('caseId') || ''

  const hasUpstream = hasUpstreamFilter()
  state.showUpstreamHint = hasUpstream

  if (!state.initializedByQuery) {
    state.initializedByQuery = true
    state.statusFilter = 'ALL'
    state.severityFilter = state.upstreamSeverity || 'ALL'
    state.subCategoryFilter = 'ALL'
  } else {
    if (state.upstreamSeverity) state.severityFilter = state.upstreamSeverity
  }

  if (state.upstreamReasonCode) {
    const reasonCode = state.upstreamReasonCode as ReasonCode
    const key = getDefaultSubCategoryKeyFromReason(reasonCode)
    if (key) state.subCategoryFilter = key
  }

  if (state.upstreamCaseId) {
    state.detailCaseId = state.upstreamCaseId
  }

  state.currentPage = 1
}

export function getSpuFromCase(exc: ExceptionCase): string {
  if (exc.relatedOrderIds.length === 0) return '-'
  const order = getOrderById(exc.relatedOrderIds[0])
  return order?.demandSnapshot?.spuCode || '-'
}

export function filterCases(): ExceptionCase[] {
  const exceptionCases = getExceptionCases()
  const queryTaskId = state.upstreamTaskId
  const queryPo = state.upstreamPo
  const queryTenderId = state.upstreamTenderId
  const queryCaseId = state.upstreamCaseId

  return exceptionCases
    .filter((exc) => {
      if (queryTaskId && !exc.relatedTaskIds.includes(queryTaskId)) return false
      if (queryPo && !exc.relatedOrderIds.includes(queryPo)) return false
      if (queryTenderId && !exc.relatedTenderIds.includes(queryTenderId)) return false
      if (queryCaseId && exc.caseId !== queryCaseId) return false

      if (state.keyword.trim()) {
        const kw = state.keyword.trim().toLowerCase()
        const spuCode = getSpuFromCase(exc)
        const matched =
          exc.caseId.toLowerCase().includes(kw) ||
          exc.relatedOrderIds.some((id) => id.toLowerCase().includes(kw)) ||
          exc.relatedTaskIds.some((id) => id.toLowerCase().includes(kw)) ||
          exc.summary.toLowerCase().includes(kw) ||
          spuCode.toLowerCase().includes(kw)

        if (!matched) return false
      }

      if (state.statusFilter !== 'ALL' && normalizeCaseStatus(exc.caseStatus) !== state.statusFilter) return false
      if (state.severityFilter !== 'ALL' && exc.severity !== state.severityFilter) return false
      if (state.categoryFilter !== 'ALL' && getUnifiedCategory(exc) !== state.categoryFilter) return false
      if (state.subCategoryFilter !== 'ALL' && getSubCategoryKey(exc) !== state.subCategoryFilter) return false
      if (state.ownerFilter !== 'ALL' && exc.ownerUserId !== state.ownerFilter) return false
      if (state.factoryFilter !== 'ALL' && getCaseFactoryId(exc) !== state.factoryFilter) return false
      if (state.processFilter !== 'ALL') {
        const taskId = exc.relatedTaskIds[0]
        const task = taskId ? getTaskById(taskId) : undefined
        if (!task?.processCode || task.processCode !== state.processFilter) return false
      }

      if (state.aggregateFilter) {
        if (state.aggregateFilter.type === 'reason' && getSubCategoryKey(exc) !== state.aggregateFilter.value) {
          return false
        }

        if (state.aggregateFilter.type === 'factory') {
          const hitFactory = exc.relatedTaskIds.some((taskId) => {
            const task = getTaskById(taskId)
            return task?.assignedFactoryId === state.aggregateFilter?.value
          })
          if (!hitFactory) return false
        }

        if (state.aggregateFilter.type === 'process') {
          const hitProcess = exc.relatedTaskIds.some((taskId) => {
            const task = getTaskById(taskId)
            return task?.processCode === state.aggregateFilter?.value
          })
          if (!hitProcess) return false
        }
      }

      return true
    })
    .sort((a, b) => {
      const severityOrder: Record<Severity, number> = { S1: 0, S2: 1, S3: 2 }
      const statusOrder: Record<UiCaseStatus, number> = {
        OPEN: 0,
        IN_PROGRESS: 1,
        RESOLVED: 2,
        CLOSED: 3,
      }

      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }

      const aStatus = normalizeCaseStatus(a.caseStatus)
      const bStatus = normalizeCaseStatus(b.caseStatus)
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus]
      }

      const aUpdated = new Date(a.updatedAt.replace(' ', 'T')).getTime()
      const bUpdated = new Date(b.updatedAt.replace(' ', 'T')).getTime()
      return bUpdated - aUpdated
    })
}

export function getExceptionTotalPages(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / EXCEPTION_PAGE_SIZE))
}

export function clampExceptionCurrentPage(totalCount: number): number {
  const totalPages = getExceptionTotalPages(totalCount)
  const nextPage = Math.min(Math.max(state.currentPage, 1), totalPages)
  if (state.currentPage !== nextPage) {
    state.currentPage = nextPage
  }
  return nextPage
}

export function getPagedCases(cases: ExceptionCase[]): ExceptionCase[] {
  const page = clampExceptionCurrentPage(cases.length)
  const start = (page - 1) * EXCEPTION_PAGE_SIZE
  return cases.slice(start, start + EXCEPTION_PAGE_SIZE)
}

export function getKpis(now: Date): {
  open: number
  inProgress: number
  s1: number
  todayNew: number
  todayClosed: number
} {
  const all = getExceptionCases()
  const today = now.toISOString().slice(0, 10)

  return {
    open: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'OPEN').length,
    inProgress: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'IN_PROGRESS').length,
    s1: all.filter((exc) => exc.severity === 'S1' && normalizeCaseStatus(exc.caseStatus) !== 'CLOSED').length,
    todayNew: all.filter((exc) => exc.createdAt.slice(0, 10) === today).length,
    todayClosed: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'CLOSED' && (exc.closedAt || '').slice(0, 10) === today).length,
  }
}

export function getAggregates(): {
  topReasons: Array<[SubCategoryKey, number]>
  topFactories: Array<[string, number]>
  topProcesses: Array<[string, number]>
} {
  const activeCases = getExceptionCases().filter((exc) => normalizeCaseStatus(exc.caseStatus) !== 'CLOSED')

  const reasonCounts: Partial<Record<SubCategoryKey, number>> = {}
  const factoryCounts: Record<string, number> = {}
  const processCounts: Record<string, number> = {}

  for (const exc of activeCases) {
    const subKey = getSubCategoryKey(exc)
    reasonCounts[subKey] = (reasonCounts[subKey] ?? 0) + 1

    for (const taskId of exc.relatedTaskIds) {
      const task = getTaskById(taskId)
      if (task?.assignedFactoryId) {
        factoryCounts[task.assignedFactoryId] = (factoryCounts[task.assignedFactoryId] ?? 0) + 1
      }
      if (task?.processCode) {
        processCounts[task.processCode] = (processCounts[task.processCode] ?? 0) + 1
      }
    }
  }

  const topReasons = (Object.entries(reasonCounts) as Array<[SubCategoryKey, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topFactories = Object.entries(factoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topProcesses = Object.entries(processCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return {
    topReasons,
    topFactories,
    topProcesses,
  }
}


export function escapeAttr(value: string): string {
  return escapeHtml(value)
}

export function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

export function renderStatusBadge(caseStatus: CaseStatus): string {
  const uiStatus = normalizeCaseStatus(caseStatus)
  return `
    <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${STATUS_COLOR_CLASS[uiStatus]}">
      <i data-lucide="${STATUS_ICON[uiStatus]}" class="h-3 w-3"></i>
      ${CASE_STATUS_LABEL[uiStatus]}
    </span>
  `
}
export {
  appStore,
  processTypes,
  getProcessTypeByCode,
  listMaterialIssueSheetsFromRuntime,
  getExecutionTaskFactById,
  productionOrders,
  indonesiaFactories,
  extendTenderDeadlineFromRuntime,
  getTenderByIdFromRuntime,
  initialNotifications,
  initialUrges,
  mockInternalUsers,
  generateNotificationId,
  generateUrgeId,
  listProgressExceptions,
  getProgressExceptionById,
  upsertProgressExceptionCase,
  syncPdaStartRiskAndExceptions,
  allowContinueFromPauseException,
  recordPauseExceptionFollowUp,
  syncMilestoneOverdueExceptions,
  buildHandoverOrderDetailLink,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
  CATEGORY_LABEL,
  SUB_CATEGORY_LABEL,
  getDefaultSubCategoryKeyFromReason,
  getSubCategoryOptionsByCategory,
  getUnifiedCategoryFromReason,
  inferLegacySubCategoryKey,
  isSubCategoryKey,
  appendCaseAction,
  appendCaseAuditLog,
  appendCaseStatusChangeAudit,
  CLOSE_REASON_LABEL,
  markCaseClosed,
  markCaseResolved,
  maybeAutoCloseResolvedCase,
  RESOLVE_RULE_LABEL,
  RESOLVE_SOURCE_LABEL,
  escapeHtml,
}

export type {
  ProcessTask,
  TaskAuditLog,
  ProductionOrder,
  Tender,
  CaseStatus,
  ExceptionCase,
  ExceptionCategory,
  Notification,
  ReasonCode,
  Severity,
  UrgeLog,
  UrgeType,
  SubCategoryKey,
  UnifiedCategory,
  CloseReasonCode,
  ResolveRuleCode,
}
