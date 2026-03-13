import { appStore } from '../state/store'
import { processTasks, type ProcessTask, type TaskAuditLog } from '../data/fcs/process-tasks'
import { productionOrders } from '../data/fcs/production-orders'
import {
  initialDyePrintOrders,
  initialQualityInspections,
  initialAllocationByTaskId,
} from '../data/fcs/store-domain-quality-seeds'
import { initialExceptions, type ExceptionCase } from '../data/fcs/store-domain-progress'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml, toClassName } from '../utils'

applyQualitySeedBootstrap()

type AssignPath = 'DIRECT' | 'BIDDING' | 'HOLD' | 'NONE'

const pathZh: Record<AssignPath, string> = {
  DIRECT: '直接派单',
  BIDDING: '竞价',
  HOLD: '暂不分配',
  NONE: '—',
}

type AssignResult =
  | 'UNASSIGNED'
  | 'DIRECT_ASSIGNED'
  | 'BIDDING'
  | 'AWAIT_AWARD'
  | 'AWARDED'
  | 'HOLD'
  | 'EXCEPTION'

const resultZh: Record<AssignResult, string> = {
  UNASSIGNED: '未分配',
  DIRECT_ASSIGNED: '已直接派单',
  BIDDING: '招标中',
  AWAIT_AWARD: '待定标',
  AWARDED: '已定标',
  HOLD: '暂不分配',
  EXCEPTION: '异常',
}

const resultBadgeClass: Record<AssignResult, string> = {
  UNASSIGNED: 'bg-gray-100 text-gray-700 border-gray-200',
  DIRECT_ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-200',
  BIDDING: 'bg-orange-100 text-orange-700 border-orange-200',
  AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
  AWARDED: 'bg-green-100 text-green-700 border-green-200',
  HOLD: 'bg-slate-100 text-slate-600 border-slate-200',
  EXCEPTION: 'bg-red-100 text-red-700 border-red-200',
}

const taskStatusZh: Record<string, string> = {
  NOT_STARTED: '待开始',
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  DONE: '已完成',
  BLOCKED: '阻塞',
  CANCELLED: '已取消',
}

type KanbanCol =
  | 'UNASSIGNED'
  | 'BIDDING'
  | 'AWAIT_AWARD'
  | 'AWARDED'
  | 'DIRECT_ASSIGNED'
  | 'HOLD'
  | 'EXCEPTION'

const colLabel: Record<KanbanCol, string> = {
  UNASSIGNED: '未分配',
  BIDDING: '招标中',
  AWAIT_AWARD: '待定标',
  AWARDED: '已定标',
  DIRECT_ASSIGNED: '已直接派单',
  HOLD: '暂不分配',
  EXCEPTION: '异常',
}

const colHeaderColor: Record<KanbanCol, string> = {
  UNASSIGNED: 'text-gray-600',
  BIDDING: 'text-orange-700',
  AWAIT_AWARD: 'text-purple-700',
  AWARDED: 'text-green-700',
  DIRECT_ASSIGNED: 'text-blue-700',
  HOLD: 'text-slate-600',
  EXCEPTION: 'text-red-700',
}

const colBg: Record<KanbanCol, string> = {
  UNASSIGNED: 'bg-gray-50 border-gray-200',
  BIDDING: 'bg-orange-50 border-orange-200',
  AWAIT_AWARD: 'bg-purple-50 border-purple-200',
  AWARDED: 'bg-green-50 border-green-200',
  DIRECT_ASSIGNED: 'bg-blue-50 border-blue-200',
  HOLD: 'bg-slate-50 border-slate-200',
  EXCEPTION: 'bg-red-50 border-red-200',
}

interface MockTender {
  tenderId: string
  taskId: string
  status: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  factoryPoolCount: number
  quotedCount: number
  currentMaxPrice?: number
  currentMinPrice?: number
  biddingDeadline: string
  taskDeadline: string
  minPrice: number
  maxPrice: number
  currency: string
  unit: string
  awardedFactoryName?: string
  awardedPrice?: number
}

interface LocalTender {
  tenderId: string
  tenderStatus: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  factoryPool: string[]
  factoryPoolNames: string[]
  minPrice: number
  maxPrice: number
  currency: string
  unit: string
  biddingDeadline: string
  taskDeadline: string
  standardPrice: number
  remark: string
  createdAt: string
  quotedCount?: number
  currentMaxPrice?: number
  currentMinPrice?: number
  awardedFactoryName?: string
  awardedPrice?: number
}

type TenderState = Record<string, LocalTender>

interface CandidateFactory {
  id: string
  name: string
  processTags: string[]
  currentStatus: string
  capacitySummary: string
  performanceSummary: string
  settlementStatus: string
}

const candidateFactories: CandidateFactory[] = [
  {
    id: 'ID-F002',
    name: '泗水裁片厂',
    processTags: ['裁片', '裁剪'],
    currentStatus: '正常',
    capacitySummary: '日产能 800件',
    performanceSummary: '近3月良品率 97%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F003',
    name: '万隆车缝厂',
    processTags: ['车缝', '后整'],
    currentStatus: '正常',
    capacitySummary: '日产能 1200件',
    performanceSummary: '近3月良品率 96%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F004',
    name: '三宝垄整烫厂',
    processTags: ['后整', '整烫'],
    currentStatus: '正常',
    capacitySummary: '日产能 600件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F005',
    name: '日惹包装厂',
    processTags: ['包装', '成衣'],
    currentStatus: '产能偏紧',
    capacitySummary: '日产能 500件（80%占用）',
    performanceSummary: '近3月良品率 95%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F006',
    name: '棉兰卫星工厂',
    processTags: ['车缝', '裁片'],
    currentStatus: '正常',
    capacitySummary: '日产能 900件',
    performanceSummary: '近3月良品率 94%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F007',
    name: '玛琅精工车缝',
    processTags: ['精品车缝'],
    currentStatus: '正常',
    capacitySummary: '日产能 400件',
    performanceSummary: '近3月良品率 99%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F010',
    name: '雅加达绣花专工厂',
    processTags: ['刺绣', '特种工艺'],
    currentStatus: '正常',
    capacitySummary: '日产能 300件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '有待确认结算单',
  },
]

const mockTenders: MockTender[] = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    status: 'BIDDING',
    factoryPoolCount: 4,
    quotedCount: 2,
    currentMaxPrice: 14200,
    currentMinPrice: 13800,
    biddingDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    minPrice: 12000,
    maxPrice: 16000,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-0003-001',
    taskId: 'TASK-0003-002',
    status: 'AWAIT_AWARD',
    factoryPoolCount: 5,
    quotedCount: 5,
    currentMaxPrice: 16200,
    currentMinPrice: 10200,
    biddingDeadline: '2026-03-10 18:00:00',
    taskDeadline: '2026-04-05 18:00:00',
    minPrice: 11000,
    maxPrice: 15500,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    status: 'AWARDED',
    factoryPoolCount: 3,
    quotedCount: 3,
    currentMaxPrice: 14100,
    currentMinPrice: 13200,
    biddingDeadline: '2026-03-08 18:00:00',
    taskDeadline: '2026-04-01 18:00:00',
    minPrice: 11500,
    maxPrice: 15000,
    currency: 'IDR',
    unit: '件',
    awardedFactoryName: '万隆车缝厂',
    awardedPrice: 13200,
  },
]

type DeadlineStatus = 'ACCEPT_OVERDUE' | 'TASK_OVERDUE' | 'NEAR_DEADLINE' | 'NORMAL' | 'NONE'

type PriceStatus = 'AT_STANDARD' | 'ABOVE_STANDARD' | 'BELOW_STANDARD' | 'NO_STANDARD'

const priceStatusLabel: Record<PriceStatus, string> = {
  AT_STANDARD: '按标准价派单',
  ABOVE_STANDARD: '高于标准价',
  BELOW_STANDARD: '低于标准价',
  NO_STANDARD: '—',
}

const priceStatusClass: Record<PriceStatus, string> = {
  AT_STANDARD: 'bg-green-50 text-green-700 border-green-200',
  ABOVE_STANDARD: 'bg-amber-50 text-amber-700 border-amber-200',
  BELOW_STANDARD: 'bg-blue-50 text-blue-700 border-blue-200',
  NO_STANDARD: '',
}

const mockStandardPrices: Record<string, number> = {
  PROC_CUT: 8500,
  PROC_SEW: 14500,
  PROC_DYE: 12000,
  PROC_POST: 6000,
  PROC_PACK: 3500,
  PROC_QC: 5000,
  PROC_IRON: 4500,
  PROC_DATIAO: 9800,
  CUT: 8500,
  SEW: 14500,
  DYE: 12000,
  POST: 6000,
  PACK: 3500,
  QC: 5000,
}

type DispatchView = 'kanban' | 'list'

interface DirectDispatchForm {
  factoryId: string
  factoryName: string
  acceptDeadline: string
  taskDeadline: string
  remark: string
  dispatchPrice: string
  priceDiffReason: string
}

interface CreateTenderForm {
  tenderId: string
  minPrice: string
  maxPrice: string
  biddingDeadline: string
  taskDeadline: string
  remark: string
  selectedPool: Set<string>
}

interface DispatchBoardState {
  keyword: string
  view: DispatchView
  selectedIds: Set<string>
  autoAssignDone: boolean
  dispatchDialogTaskIds: string[] | null
  dispatchForm: DirectDispatchForm
  tenderState: TenderState
  createTenderTaskId: string | null
  createTenderForm: CreateTenderForm
  viewTenderTaskId: string | null
  priceSnapshotTaskId: string | null
  actionMenuTaskId: string | null
}

const state: DispatchBoardState = {
  keyword: '',
  view: 'kanban',
  selectedIds: new Set(),
  autoAssignDone: false,
  dispatchDialogTaskIds: null,
  dispatchForm: emptyDispatchForm(),
  tenderState: {},
  createTenderTaskId: null,
  createTenderForm: emptyCreateTenderForm(),
  viewTenderTaskId: null,
  priceSnapshotTaskId: null,
  actionMenuTaskId: null,
}

let auditSeq = 0

function emptyDispatchForm(): DirectDispatchForm {
  return {
    factoryId: '',
    factoryName: '',
    acceptDeadline: '',
    taskDeadline: '',
    remark: '',
    dispatchPrice: '',
    priceDiffReason: '',
  }
}

function emptyCreateTenderForm(): CreateTenderForm {
  return {
    tenderId: '',
    minPrice: '',
    maxPrice: '',
    biddingDeadline: '',
    taskDeadline: '',
    remark: '',
    selectedPool: new Set<string>(),
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateLike(value: string): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function fromDateTimeLocal(value: string): string {
  if (!value) return ''
  const normalized = value.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function toDateTimeLocal(value: string | undefined): string {
  if (!value) return ''
  const normalized = value.replace(' ', 'T')
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized
}

function makeAuditId(taskId: string): string {
  auditSeq += 1
  const cleanTaskId = taskId.replace(/[^A-Za-z0-9]/g, '')
  return `AL-${cleanTaskId}-${Date.now()}-${auditSeq}`
}

function pushTaskAudit(task: ProcessTask, action: string, detail: string, by: string): void {
  const audit: TaskAuditLog = {
    id: makeAuditId(task.taskId),
    action,
    detail,
    at: nowTimestamp(),
    by,
  }
  task.auditLogs = [...task.auditLogs, audit]
}

function openAppRoute(pathname: string, key?: string, title?: string): void {
  if (key && title) {
    appStore.openTab({
      key,
      title,
      href: pathname,
      closable: true,
    })
    return
  }

  appStore.navigate(pathname)
}

function getMockTender(task: ProcessTask): MockTender | undefined {
  return mockTenders.find((item) => item.taskId === task.taskId || (task.tenderId ? item.tenderId === task.tenderId : false))
}

function getEffectiveTender(task: ProcessTask): MockTender | LocalTender | undefined {
  const local = state.tenderState[task.taskId]
  if (local) return local
  return getMockTender(task)
}

function hasTender(task: ProcessTask): boolean {
  return Boolean(state.tenderState[task.taskId] || getMockTender(task))
}

function calcRemaining(deadline: string): string {
  const end = parseDateLike(deadline)
  if (!Number.isFinite(end)) return '—'

  const diff = end - Date.now()
  if (diff <= 0) return '已截止'

  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `还剩 ${days} 天`

  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `还剩 ${hours} 小时`

  const mins = Math.floor(diff / 60000)
  return `还剩 ${mins} 分钟`
}

function deriveAssignPath(task: ProcessTask): AssignPath {
  if (task.assignmentMode === 'DIRECT') return 'DIRECT'
  if (task.assignmentMode === 'BIDDING') return 'BIDDING'

  const lastLog = task.auditLogs[task.auditLogs.length - 1]
  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') {
    return 'HOLD'
  }

  return 'NONE'
}

function deriveAssignResult(task: ProcessTask, hasException: boolean): AssignResult {
  if (hasException) return 'EXCEPTION'

  const lastLog = task.auditLogs[task.auditLogs.length - 1]
  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') {
    return 'HOLD'
  }

  if (task.assignmentMode === 'BIDDING') {
    const localTender = state.tenderState[task.taskId]
    if (localTender) return localTender.tenderStatus

    const mock = getMockTender(task)
    if (mock) return mock.status

    return 'BIDDING'
  }

  if (task.assignmentStatus === 'AWARDED') return 'AWARDED'
  if (task.assignmentStatus === 'ASSIGNING') return 'AWAIT_AWARD'
  if (task.assignmentStatus === 'BIDDING') return 'BIDDING'
  if (task.assignmentStatus === 'ASSIGNED' && task.assignmentMode === 'DIRECT') return 'DIRECT_ASSIGNED'
  if (task.assignmentStatus === 'ASSIGNED') return 'DIRECT_ASSIGNED'

  return 'UNASSIGNED'
}

function deriveKanbanCol(task: ProcessTask, hasException: boolean): KanbanCol {
  const result = deriveAssignResult(task, hasException)

  const map: Record<AssignResult, KanbanCol> = {
    UNASSIGNED: 'UNASSIGNED',
    DIRECT_ASSIGNED: 'DIRECT_ASSIGNED',
    BIDDING: 'BIDDING',
    AWAIT_AWARD: 'AWAIT_AWARD',
    AWARDED: 'AWARDED',
    HOLD: 'HOLD',
    EXCEPTION: 'EXCEPTION',
  }

  return map[result]
}

function getStandardPrice(task: ProcessTask): { price: number; currency: string; unit: string } {
  return {
    price: task.standardPrice ?? mockStandardPrices[task.processCode] ?? 10000,
    currency: task.standardPriceCurrency ?? 'IDR',
    unit: task.standardPriceUnit ?? '件',
  }
}

function getPriceStatus(task: ProcessTask): PriceStatus {
  if (task.standardPrice == null || task.dispatchPrice == null) return 'NO_STANDARD'

  const diff = task.dispatchPrice - task.standardPrice
  if (Math.abs(diff) < 0.001) return 'AT_STANDARD'

  return diff > 0 ? 'ABOVE_STANDARD' : 'BELOW_STANDARD'
}

function getDeadlineStatus(task: ProcessTask): DeadlineStatus {
  if (task.assignmentMode !== 'DIRECT' || task.assignmentStatus !== 'ASSIGNED') return 'NONE'
  if (task.status === 'DONE' || task.status === 'COMPLETED' || task.status === 'CANCELLED') return 'NONE'

  const now = Date.now()

  if (task.acceptanceStatus !== 'ACCEPTED' && task.acceptDeadline) {
    const acceptMs = parseDateLike(task.acceptDeadline)
    if (Number.isFinite(acceptMs) && now > acceptMs) return 'ACCEPT_OVERDUE'
  }

  if (task.taskDeadline) {
    const taskDeadlineMs = parseDateLike(task.taskDeadline)

    if (Number.isFinite(taskDeadlineMs)) {
      if ((task.acceptanceStatus === 'ACCEPTED' || task.status === 'IN_PROGRESS') && now > taskDeadlineMs) {
        return 'TASK_OVERDUE'
      }

      if (taskDeadlineMs > now && taskDeadlineMs - now < 24 * 60 * 60 * 1000) {
        return 'NEAR_DEADLINE'
      }
    }
  }

  return 'NORMAL'
}

function formatDeadlineBadge(status: DeadlineStatus, task: ProcessTask): { label: string; className: string } | null {
  if (status === 'NONE' || status === 'NORMAL') return null

  if (status === 'ACCEPT_OVERDUE') {
    return { label: '接单逾期', className: 'bg-red-100 text-red-700 border-red-200' }
  }

  if (status === 'TASK_OVERDUE') {
    const diff = task.taskDeadline ? Date.now() - parseDateLike(task.taskDeadline) : 0
    const days = Number.isFinite(diff) ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0
    return {
      label: `执行逾期${days > 0 ? ` ${days}天` : ''}`,
      className: 'bg-red-100 text-red-700 border-red-200',
    }
  }

  if (status === 'NEAR_DEADLINE') {
    const diff = task.taskDeadline ? parseDateLike(task.taskDeadline) - Date.now() : 0
    const hours = Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / (60 * 60 * 1000))) : 0
    return {
      label: `即将逾期 ${hours}h`,
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    }
  }

  return null
}

function formatRemainingTime(taskDeadline: string | undefined): string {
  if (!taskDeadline) return '—'

  const diff = parseDateLike(taskDeadline) - Date.now()
  if (!Number.isFinite(diff)) return '—'

  if (diff < 0) {
    const abs = Math.abs(diff)
    const days = Math.floor(abs / (24 * 60 * 60 * 1000))
    const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    return `已逾期${days > 0 ? ` ${days}天` : ''}${hours}h`
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

  return days > 0 ? `剩余 ${days}天${hours}h` : `剩余 ${hours}h`
}

function currentCheckpoint(
  task: ProcessTask,
  result: AssignResult,
  tender: MockTender | LocalTender | undefined,
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  hasException: boolean,
): string {
  if (task.status === 'DONE' || task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return '任务已结束'
  }

  if (hasException) return '存在分配异常，需人工处理'

  if (result === 'HOLD') {
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    if (lastLog?.detail) {
      return `${lastLog.detail.replace('设为', '')}，待复核`
    }

    return '暂不分配，待复核'
  }

  if (result === 'BIDDING') {
    if (!tender) return '未创建招标单，请点击创建招标单'

    const deadlineMs = parseDateLike('biddingDeadline' in tender ? tender.biddingDeadline : '')
    if (Number.isFinite(deadlineMs)) {
      if (Date.now() > deadlineMs) return '报价已截止，待定标'

      const hoursLeft = (deadlineMs - Date.now()) / (60 * 60 * 1000)
      if (hoursLeft < 4) return `竞价截止时间临近（剩余${Math.ceil(hoursLeft)}h）`
    }

    return '招标进行中'
  }

  if (result === 'AWAIT_AWARD') return '报价已截止，等待定标'
  if (result === 'AWARDED') return '已定标，等待派单接单'

  if (result === 'DIRECT_ASSIGNED') {
    if (task.acceptanceStatus !== 'ACCEPTED' && task.acceptDeadline) {
      const acceptDeadlineMs = parseDateLike(task.acceptDeadline)
      if (Number.isFinite(acceptDeadlineMs)) {
        if (Date.now() > acceptDeadlineMs) {
          return '接单截止时间已过，工厂未确认接单'
        }

        const hoursLeft = (acceptDeadlineMs - Date.now()) / (60 * 60 * 1000)
        if (hoursLeft < 4) {
          return `接单截止时间临近（剩余${Math.ceil(hoursLeft)}h）`
        }
      }
    }

    if (task.taskDeadline) {
      const taskDeadlineMs = parseDateLike(task.taskDeadline)
      if (Number.isFinite(taskDeadlineMs)) {
        if (Date.now() > taskDeadlineMs) return '任务截止时间已过，执行逾期'

        const hoursLeft = (taskDeadlineMs - Date.now()) / (60 * 60 * 1000)
        if (hoursLeft < 8) return `已接单但任务即将逾期（剩余${Math.ceil(hoursLeft)}h）`
      }
    }

    return '任务正常推进中'
  }

  if (dyePendingIds.has(task.taskId)) return '受染印回货影响，待确认'
  if (qcPendingOrderIds.has(task.productionOrderId)) return '存在待质检项，暂不可分配'

  const deps = task.dependsOnTaskIds ?? []
  if (deps.length > 0) return '前序任务未完成，等待解锁'

  return '待分配，可立即处理'
}

function getDyePendingTaskIds(): Set<string> {
  const set = new Set<string>()

  for (const order of initialDyePrintOrders) {
    if (order.status === 'COMPLETED' || order.status === 'CLOSED') continue

    const relatedId = (order.relatedTaskId ?? order.taskId) as string | undefined
    if (relatedId) set.add(relatedId)
  }

  return set
}

function getQcPendingOrderIds(): Set<string> {
  const set = new Set<string>()

  for (const qc of initialQualityInspections) {
    if (qc.status === 'SUBMITTED') {
      set.add(qc.productionOrderId)
    }
  }

  return set
}

function getExceptionTaskIds(): Set<string> {
  const active = new Set<ExceptionCase['caseStatus']>(['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'])
  const set = new Set<string>()

  for (const item of initialExceptions) {
    if (!active.has(item.caseStatus)) continue

    const relatedIds = item.relatedTaskIds ?? []
    if (relatedIds.length > 0) {
      for (const taskId of relatedIds) {
        set.add(taskId)
      }
      continue
    }

    if (item.sourceType === 'TASK' && item.sourceId) {
      set.add(item.sourceId)
    }
  }

  return set
}

function getFactoryOptions(): Array<{ id: string; name: string }> {
  const activeFactories = indonesiaFactories.filter((factory) => factory.status === 'ACTIVE')

  if (activeFactories.length > 0) {
    return activeFactories.map((factory) => ({ id: factory.id, name: factory.name }))
  }

  return [
    { id: 'ID-F001', name: '雅加达主工厂' },
    { id: 'ID-F002', name: '泗水裁片厂' },
    { id: 'ID-F003', name: '万隆车缝厂' },
    { id: 'ID-F004', name: '三宝垄整烫厂' },
    { id: 'ID-F005', name: '日惹包装厂' },
    { id: 'ID-F006', name: '棉兰卫星工厂' },
    { id: 'ID-F007', name: '玛琅精工车缝' },
    { id: 'ID-F010', name: '雅加达绣花专工厂' },
  ]
}

function createFallbackTasks(orderIds: string[]): ProcessTask[] {
  const pairs = [
    {
      processCode: 'CUT',
      processNameZh: '裁剪',
      mode: 'DIRECT' as const,
      status: 'NOT_STARTED' as const,
      assignmentStatus: 'UNASSIGNED' as const,
    },
    {
      processCode: 'SEW',
      processNameZh: '车缝',
      mode: 'BIDDING' as const,
      status: 'NOT_STARTED' as const,
      assignmentStatus: 'BIDDING' as const,
    },
    {
      processCode: 'DYE',
      processNameZh: '染印',
      mode: 'BIDDING' as const,
      status: 'NOT_STARTED' as const,
      assignmentStatus: 'ASSIGNING' as const,
    },
    {
      processCode: 'POST',
      processNameZh: '后整',
      mode: 'DIRECT' as const,
      status: 'NOT_STARTED' as const,
      assignmentStatus: 'UNASSIGNED' as const,
    },
    {
      processCode: 'PACK',
      processNameZh: '包装',
      mode: 'DIRECT' as const,
      status: 'IN_PROGRESS' as const,
      assignmentStatus: 'ASSIGNED' as const,
    },
    {
      processCode: 'QC',
      processNameZh: '质检终检',
      mode: 'DIRECT' as const,
      status: 'NOT_STARTED' as const,
      assignmentStatus: 'AWARDED' as const,
    },
  ]

  const now = nowTimestamp()
  const result: ProcessTask[] = []

  orderIds
    .slice(0, 2)
    .forEach((orderId, orderIndex) => {
      pairs.forEach((pair, pairIndex) => {
        const taskId = `FB-${orderId}-${pair.processCode}`

        result.push({
          taskId,
          productionOrderId: orderId,
          seq: pairIndex + 1,
          processCode: pair.processCode,
          processNameZh: pair.processNameZh,
          stage: 'SEWING',
          status: pair.status,
          assignmentMode: pair.mode,
          assignmentStatus: pair.assignmentStatus,
          dependsOnTaskIds: pairIndex === 0 ? [] : [`FB-${orderId}-${pairs[pairIndex - 1].processCode}`],
          ownerSuggestion: { kind: 'MAIN_FACTORY' },
          qty: 100 + orderIndex * 50,
          qtyUnit: 'PIECE',
          qcPoints: [],
          attachments: [],
          auditLogs:
            pair.assignmentStatus === 'ASSIGNED'
              ? [{ id: `AL-${taskId}-ASSIGN`, action: 'DISPATCH', detail: '派单至工厂', at: now, by: 'Admin' }]
              : [],
          assignedFactoryName: pair.assignmentStatus === 'ASSIGNED' ? '雅加达主工厂' : undefined,
          assignedFactoryId: pair.assignmentStatus === 'ASSIGNED' ? 'ID-F001' : undefined,
          dispatchPrice:
            pair.assignmentStatus === 'ASSIGNED' ? mockStandardPrices[pair.processCode] ?? 10000 : undefined,
          taskDeadline: pair.assignmentStatus === 'ASSIGNED' ? '2026-04-15 18:00:00' : undefined,
          acceptDeadline: pair.assignmentStatus === 'ASSIGNED' ? '2026-03-25 18:00:00' : undefined,
          createdAt: now,
          updatedAt: now,
        })
      })
    })

  return result
}

function getEffectiveTasks(): ProcessTask[] {
  if (processTasks.length >= 10) return processTasks

  const orderIds = productionOrders.map((order) => order.productionOrderId)
  return [...processTasks, ...createFallbackTasks(orderIds)]
}

function getFilteredRows(keyword: string): ProcessTask[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  const tasks = getEffectiveTasks()

  if (!normalizedKeyword) return tasks

  return tasks.filter((task) => {
    const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)

    return (
      task.taskId.toLowerCase().includes(normalizedKeyword) ||
      task.processNameZh.toLowerCase().includes(normalizedKeyword) ||
      task.productionOrderId.toLowerCase().includes(normalizedKeyword) ||
      (order?.legacyOrderNo ?? '').toLowerCase().includes(normalizedKeyword)
    )
  })
}

function getVisibleRows(): ProcessTask[] {
  return getFilteredRows(state.keyword)
}

function getTaskById(taskId: string | null): ProcessTask | null {
  if (!taskId) return null
  return getEffectiveTasks().find((task) => task.taskId === taskId) ?? null
}

function getDispatchDialogTasks(): ProcessTask[] {
  if (!state.dispatchDialogTaskIds || state.dispatchDialogTaskIds.length === 0) return []

  const selected = new Set(state.dispatchDialogTaskIds)
  return getEffectiveTasks().filter((task) => selected.has(task.taskId))
}

function getCreateTenderTask(): ProcessTask | null {
  return getTaskById(state.createTenderTaskId)
}

function getViewTenderTask(): ProcessTask | null {
  return getTaskById(state.viewTenderTaskId)
}

function getPriceSnapshotTask(): ProcessTask | null {
  return getTaskById(state.priceSnapshotTaskId)
}

function getDispatchDialogValidation(tasks: ProcessTask[]): {
  valid: boolean
  needDiffReason: boolean
  stdPrice: number
  stdCurrency: string
  stdUnit: string
  dispatchPrice: number | null
  diff: number | null
  diffPct: string | null
  changed: boolean
} {
  const refTask = tasks[0]
  const std = refTask ? getStandardPrice(refTask) : { price: 0, currency: 'IDR', unit: '件' }

  const parsedDispatchPrice = state.dispatchForm.dispatchPrice === ''
    ? Number.NaN
    : Number(state.dispatchForm.dispatchPrice)

  const dispatchPrice = Number.isFinite(parsedDispatchPrice) ? parsedDispatchPrice : null
  const diff = dispatchPrice != null ? dispatchPrice - std.price : null
  const diffPct = diff != null && std.price !== 0 ? ((diff / std.price) * 100).toFixed(2) : null
  const changed = dispatchPrice != null ? Math.abs(dispatchPrice - std.price) >= 0.001 : false
  const needDiffReason = changed

  const valid =
    state.dispatchForm.factoryId.trim() !== '' &&
    state.dispatchForm.acceptDeadline.trim() !== '' &&
    state.dispatchForm.taskDeadline.trim() !== '' &&
    dispatchPrice != null &&
    (!needDiffReason || state.dispatchForm.priceDiffReason.trim() !== '')

  return {
    valid,
    needDiffReason,
    stdPrice: std.price,
    stdCurrency: std.currency,
    stdUnit: std.unit,
    dispatchPrice,
    diff,
    diffPct,
    changed,
  }
}

function setTaskAssignMode(taskId: string, mode: 'BIDDING' | 'HOLD', by: string): void {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return

  task.updatedAt = nowTimestamp()

  if (mode === 'BIDDING') {
    task.assignmentMode = 'BIDDING'
    if (task.assignmentStatus === 'UNASSIGNED' || task.assignmentStatus === 'ASSIGNED') {
      task.assignmentStatus = 'BIDDING'
    }

    pushTaskAudit(task, 'SET_ASSIGN_MODE', '设为竞价分配', by)
    return
  }

  task.assignmentStatus = 'UNASSIGNED'
  pushTaskAudit(task, 'SET_ASSIGN_MODE', '设为暂不分配', by)
}

function batchSetTaskAssignMode(taskIds: string[], mode: 'BIDDING' | 'HOLD', by: string): void {
  for (const taskId of taskIds) {
    setTaskAssignMode(taskId, mode, by)
  }
}

function batchDispatch(
  taskIds: string[],
  factoryId: string,
  factoryName: string,
  acceptDeadline: string,
  taskDeadline: string,
  remark: string,
  by: string,
  dispatchPrice: number,
  dispatchPriceCurrency: string,
  dispatchPriceUnit: string,
  priceDiffReason: string,
): void {
  const now = nowTimestamp()

  for (const taskId of taskIds) {
    const task = processTasks.find((item) => item.taskId === taskId)
    if (!task) continue

    task.assignmentMode = 'DIRECT'
    task.assignmentStatus = 'ASSIGNED'
    task.assignedFactoryId = factoryId
    task.assignedFactoryName = factoryName
    task.acceptDeadline = acceptDeadline
    task.taskDeadline = taskDeadline
    task.dispatchRemark = remark.trim() || undefined
    task.dispatchedAt = now
    task.dispatchedBy = by
    task.dispatchPrice = dispatchPrice
    task.dispatchPriceCurrency = dispatchPriceCurrency
    task.dispatchPriceUnit = dispatchPriceUnit
    task.priceDiffReason = priceDiffReason.trim() || undefined
    task.acceptanceStatus = 'PENDING'
    task.updatedAt = now

    pushTaskAudit(task, 'DISPATCH', '已发起直接派单，待工厂确认', by)
  }
}

function openDispatchDialog(taskIds: string[]): void {
  const filtered = taskIds.filter((taskId) => Boolean(getTaskById(taskId)))
  if (filtered.length === 0) return

  state.dispatchDialogTaskIds = filtered
  state.dispatchForm = emptyDispatchForm()
  state.actionMenuTaskId = null
}

function closeDispatchDialog(): void {
  state.dispatchDialogTaskIds = null
  state.dispatchForm = emptyDispatchForm()
}

function openCreateTender(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return

  const normalizedTaskId = task.taskId.replace(/[^A-Za-z0-9]/g, '')

  state.createTenderTaskId = task.taskId
  state.createTenderForm = {
    tenderId: `TENDER-${normalizedTaskId.slice(-8)}-${String(Date.now()).slice(-4)}`,
    minPrice: '',
    maxPrice: '',
    biddingDeadline: '',
    taskDeadline: '',
    remark: '',
    selectedPool: new Set<string>(),
  }
  state.actionMenuTaskId = null
}

function closeCreateTender(): void {
  state.createTenderTaskId = null
  state.createTenderForm = emptyCreateTenderForm()
}

function openViewTender(taskId: string): void {
  const task = getTaskById(taskId)
  if (!task) return

  if (!hasTender(task)) return

  state.viewTenderTaskId = task.taskId
  state.actionMenuTaskId = null
}

function closeViewTender(): void {
  state.viewTenderTaskId = null
}

function closePriceSnapshot(): void {
  state.priceSnapshotTaskId = null
}

function closeAllDialogs(): void {
  closeDispatchDialog()
  closeCreateTender()
  closeViewTender()
  closePriceSnapshot()
}

function renderDirectDispatchDialog(tasks: ProcessTask[], factoryOptions: Array<{ id: string; name: string }>): string {
  if (!state.dispatchDialogTaskIds) return ''
  if (tasks.length === 0) return ''

  const isBatch = tasks.length > 1
  const validation = getDispatchDialogValidation(tasks)
  const refTask = tasks[0]

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-direct-dispatch" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl" data-dialog-panel="true">
        <button class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" data-dispatch-action="close-direct-dispatch" aria-label="关闭">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>

        <h3 class="text-lg font-semibold">${isBatch ? '批量直接派单' : '直接派单'}</h3>

        <div class="mt-4 space-y-4">
          ${
            isBatch
              ? `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm">已选择 <span class="font-semibold">${tasks.length}</span> 个任务</div>`
              : `<div class="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(refTask.taskId)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(refTask.productionOrderId)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(refTask.processNameZh)}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${refTask.qty} 件</span></div>
                </div>`
          }

          <div class="space-y-1.5">
            <label class="text-sm font-medium">承接工厂 <span class="text-red-500">*</span></label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-dispatch-field="dispatch.factoryId">
              <option value="" ${state.dispatchForm.factoryId === '' ? 'selected' : ''}>请选择承接工厂</option>
              ${factoryOptions
                .map(
                  (factory) =>
                    `<option value="${escapeHtml(factory.id)}" ${state.dispatchForm.factoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`,
                )
                .join('')}
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">接单截止时间 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.acceptDeadline" value="${escapeHtml(state.dispatchForm.acceptDeadline)}" />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="dispatch.taskDeadline" value="${escapeHtml(state.dispatchForm.taskDeadline)}" />
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-3">
            <p class="text-sm font-medium">价格信息</p>

            <div class="flex items-center justify-between gap-2">
              <span class="text-sm text-muted-foreground">工序标准价</span>
              <span class="text-sm font-medium tabular-nums">${validation.stdPrice.toLocaleString()} ${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}</span>
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">直接派单价 <span class="text-red-500">*</span></label>
              <div class="flex items-center gap-2">
                <input class="h-9 flex-1 rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" placeholder="${validation.stdPrice}" data-dispatch-field="dispatch.dispatchPrice" value="${escapeHtml(state.dispatchForm.dispatchPrice)}" />
                <span class="shrink-0 whitespace-nowrap text-sm text-muted-foreground">${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}</span>
              </div>
            </div>

            ${
              validation.dispatchPrice != null && validation.diffPct != null
                ? `<div class="flex items-center justify-between gap-2">
                    <span class="text-sm text-muted-foreground">价格偏差</span>
                    <span class="text-sm font-medium tabular-nums ${
                      !validation.changed
                        ? 'text-green-700'
                        : (validation.diff ?? 0) > 0
                          ? 'text-amber-700'
                          : 'text-blue-700'
                    }">
                      ${
                        !validation.changed
                          ? '0（0%）'
                          : `${(validation.diff ?? 0) > 0 ? '+' : ''}${(validation.diff ?? 0).toLocaleString()} ${escapeHtml(validation.stdCurrency)}/${escapeHtml(validation.stdUnit)}（${(validation.diff ?? 0) > 0 ? '+' : ''}${validation.diffPct}%）`
                      }
                    </span>
                  </div>`
                : ''
            }

            ${
              validation.needDiffReason
                ? `<div class="space-y-1.5">
                    <label class="text-sm font-medium">价格偏差原因 <span class="text-red-500">*</span></label>
                    <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="dispatch.priceDiffReason" placeholder="请说明偏差原因，如：急单加价、特殊工艺、产能紧张、历史协议价等">${escapeHtml(state.dispatchForm.priceDiffReason)}</textarea>
                  </div>`
                : ''
            }
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">派单备注 <span class="text-xs text-muted-foreground">（选填）</span></label>
            <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="dispatch.remark" placeholder="填写派单说明、注意事项等...">${escapeHtml(state.dispatchForm.remark)}</textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-direct-dispatch">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            validation.valid ? '' : 'pointer-events-none opacity-50'
          }" data-dispatch-action="confirm-direct-dispatch">确认派单</button>
        </div>
      </section>
    </div>
  `
}

function renderCreateTenderSheet(task: ProcessTask | null): string {
  if (!task || !state.createTenderTaskId) return ''

  const std = getStandardPrice(task)
  const minPrice = Number(state.createTenderForm.minPrice)
  const maxPrice = Number(state.createTenderForm.maxPrice)

  const minValid = state.createTenderForm.minPrice !== '' && Number.isFinite(minPrice) && minPrice > 0
  const maxValid =
    state.createTenderForm.maxPrice !== '' &&
    Number.isFinite(maxPrice) &&
    maxPrice >= (minValid ? minPrice : 0)

  const valid =
    state.createTenderForm.selectedPool.size > 0 &&
    minValid &&
    maxValid &&
    state.createTenderForm.biddingDeadline !== '' &&
    state.createTenderForm.taskDeadline !== ''

  const selectedPoolIds = Array.from(state.createTenderForm.selectedPool)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-create-tender" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[560px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">创建招标单</h3>
              <p class="text-xs text-muted-foreground">一个竞价任务对应一个招标单</p>
            </div>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-create-tender">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">招标单号</label>
            <div class="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">${escapeHtml(state.createTenderForm.tenderId)}</div>
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">任务基础信息</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(task.taskId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(task.productionOrderId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${task.qty} ${escapeHtml(task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序标准价</span><span class="font-mono text-xs">${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span></div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold">工厂池</p>
              <div class="flex gap-1">
                <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="select-all-pool">全选</button>
                <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="clear-all-pool">清空</button>
              </div>
            </div>

            <div class="rounded-md border divide-y max-h-56 overflow-y-auto">
              ${candidateFactories
                .map((factory) => {
                  const selected = state.createTenderForm.selectedPool.has(factory.id)

                  return `
                    <button class="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${selected ? 'bg-orange-50' : 'hover:bg-muted/40'}" data-dispatch-action="toggle-pool" data-factory-id="${escapeHtml(factory.id)}">
                      <span class="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-muted-foreground/40 text-transparent'}">✓</span>
                      <span class="flex-1 min-w-0 space-y-0.5">
                        <span class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-sm font-medium">${escapeHtml(factory.name)}</span>
                          ${factory.processTags
                            .map(
                              (tag) =>
                                `<span class="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">${escapeHtml(tag)}</span>`,
                            )
                            .join('')}
                        </span>
                        <span class="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          <span>${escapeHtml(factory.currentStatus)}</span>
                          <span>${escapeHtml(factory.capacitySummary)}</span>
                          <span>${escapeHtml(factory.performanceSummary)}</span>
                          <span class="${factory.settlementStatus !== '结算正常' ? 'text-amber-600' : ''}">${escapeHtml(factory.settlementStatus)}</span>
                        </span>
                      </span>
                    </button>
                  `
                })
                .join('')}
            </div>

            <div class="space-y-1.5">
              <p class="text-xs font-medium text-muted-foreground">本次招标工厂池 <span class="text-red-500">*</span><span class="ml-1 text-muted-foreground">（已选 ${state.createTenderForm.selectedPool.size} 家）</span></p>
              ${
                selectedPoolIds.length === 0
                  ? '<p class="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">请在上方勾选工厂加入招标工厂池</p>'
                  : `<div class="flex flex-wrap gap-1.5 rounded-md border px-3 py-2">${selectedPoolIds
                      .map((factoryId) => {
                        const item = candidateFactories.find((factory) => factory.id === factoryId)
                        return `<span class="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs text-orange-800">${escapeHtml(item?.name ?? factoryId)}<button class="hover:text-red-600" data-dispatch-action="toggle-pool" data-factory-id="${escapeHtml(factoryId)}"><i data-lucide="x" class="h-3 w-3"></i></button></span>`
                      })
                      .join('')}</div>`
              }
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold">价格参考区</p>
              <span class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">以下价格信息仅供平台定标参考，工厂不可见</span>
            </div>

            <div class="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <span class="text-muted-foreground">工序标准价</span>
              <span class="font-medium tabular-nums">${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label class="text-sm font-medium">最低限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" data-dispatch-field="tender.minPrice" placeholder="最低限价" value="${escapeHtml(state.createTenderForm.minPrice)}" />
                <p class="text-[10px] text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</p>
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium">最高限价 <span class="text-red-500">*</span></label>
                <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="number" min="0" step="100" data-dispatch-field="tender.maxPrice" placeholder="最高限价" value="${escapeHtml(state.createTenderForm.maxPrice)}" />
                <p class="text-[10px] text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</p>
              </div>
            </div>

            ${
              state.createTenderForm.minPrice !== '' &&
              state.createTenderForm.maxPrice !== '' &&
              Number.isFinite(minPrice) &&
              Number.isFinite(maxPrice) &&
              maxPrice < minPrice
                ? '<p class="text-xs text-red-600">最高限价不得低于最低限价</p>'
                : ''
            }
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-3">
            <p class="text-sm font-semibold">时间要求</p>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">竞价截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="tender.biddingDeadline" value="${escapeHtml(state.createTenderForm.biddingDeadline)}" />
            </div>

            <div class="space-y-1.5">
              <label class="text-sm font-medium">任务截止时间 <span class="text-red-500">*</span></label>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" type="datetime-local" data-dispatch-field="tender.taskDeadline" value="${escapeHtml(state.createTenderForm.taskDeadline)}" />
            </div>
          </div>

          <div class="h-px bg-border"></div>

          <div class="space-y-1.5 pb-4">
            <label class="text-sm font-medium">招标备注 <span class="text-xs text-muted-foreground">（选填）</span></label>
            <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="2" data-dispatch-field="tender.remark" placeholder="填写招标说明、特殊要求等...">${escapeHtml(state.createTenderForm.remark)}</textarea>
          </div>
        </div>

        <footer class="border-t px-6 py-4">
          <div class="flex justify-end gap-2">
            <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-dispatch-action="close-create-tender">取消</button>
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
              valid ? '' : 'pointer-events-none opacity-50'
            }" data-dispatch-action="confirm-create-tender">确认创建招标单</button>
          </div>
        </footer>
      </section>
    </div>
  `
}

function renderViewTenderSheet(task: ProcessTask | null): string {
  if (!task || !state.viewTenderTaskId) return ''

  const tender = getEffectiveTender(task)
  if (!tender) return ''

  const std = getStandardPrice(task)

  const tenderId = 'tenderStatus' in tender ? tender.tenderId : tender.tenderId
  const biddingDeadline = 'biddingDeadline' in tender ? tender.biddingDeadline : tender.biddingDeadline
  const tenderTaskDeadline = 'taskDeadline' in tender ? tender.taskDeadline : tender.taskDeadline
  const factoryPoolCount = 'factoryPoolCount' in tender ? tender.factoryPoolCount : tender.factoryPool.length
  const minPrice = tender.minPrice
  const maxPrice = tender.maxPrice
  const currency = tender.currency ?? 'IDR'
  const unit = tender.unit ?? '件'
  const status = 'tenderStatus' in tender ? tender.tenderStatus : tender.status
  const awardedFactory = 'awardedFactoryName' in tender ? tender.awardedFactoryName : undefined
  const awardedPrice = 'awardedPrice' in tender ? tender.awardedPrice : undefined

  const poolNames = 'factoryPoolNames' in tender ? tender.factoryPoolNames : []

  const statusZh: Record<string, string> = {
    BIDDING: '招标中',
    AWAIT_AWARD: '待定标',
    AWARDED: '已定标',
  }

  const statusClass: Record<string, string> = {
    BIDDING: 'bg-orange-100 text-orange-700 border-orange-200',
    AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
    AWARDED: 'bg-green-100 text-green-700 border-green-200',
  }

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-view-tender" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[480px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">招标单详情</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-view-tender">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold">${escapeHtml(tenderId)}</span>
            <span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusClass[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}">${statusZh[status] ?? escapeHtml(status)}</span>
          </div>

          <div class="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">关联任务</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(task.taskId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">生产单号</span><span class="font-mono text-xs">${escapeHtml(task.productionOrderId)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">数量</span><span class="font-mono text-xs">${task.qty} 件</span></div>
          </div>

          <div class="space-y-1.5">
            <p class="text-sm font-semibold">工厂池（${factoryPoolCount} 家）</p>
            ${
              poolNames.length > 0
                ? `<div class="flex flex-wrap gap-1.5 rounded-md border px-3 py-2">${poolNames
                    .map(
                      (name) =>
                        `<span class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-800">${escapeHtml(name)}</span>`,
                    )
                    .join('')}</div>`
                : `<p class="text-xs text-muted-foreground">（Mock 数据，共 ${factoryPoolCount} 家）</p>`
            }
          </div>

          <div class="rounded-md border bg-amber-50/60 p-3 space-y-1.5">
            <p class="mb-1 text-xs font-semibold text-amber-800">价格参考区（仅平台可见，工厂不可见）</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">工序标准价</span><span class="font-medium tabular-nums">${std.price.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">最低限价</span><span class="font-medium tabular-nums">${minPrice != null ? `${minPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">最高限价</span><span class="font-medium tabular-nums">${maxPrice != null ? `${maxPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}` : '—'}</span></div>
          </div>

          <div class="rounded-md border p-3 space-y-1.5">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">时间要求</p>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">竞价截止时间</span><span class="font-mono text-xs">${escapeHtml(biddingDeadline ?? '—')}</span></div>
            <div class="flex items-center justify-between gap-2 text-sm"><span class="text-muted-foreground">任务截止时间</span><span class="font-mono text-xs">${escapeHtml(tenderTaskDeadline ?? '—')}</span></div>
          </div>

          ${
            awardedFactory
              ? `<div class="rounded-md border border-green-200 bg-green-50 p-3 space-y-1.5">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800">定标结果</p>
                  <div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">中标工厂</span><span class="font-medium text-green-700">${escapeHtml(awardedFactory)}</span></div>
                  ${
                    awardedPrice != null
                      ? `<div class="flex items-center justify-between text-sm"><span class="text-muted-foreground">中标价</span><span class="font-medium tabular-nums">${awardedPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span></div>`
                      : ''
                  }
                </div>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderPriceSnapshotSheet(task: ProcessTask | null): string {
  if (!task || !state.priceSnapshotTaskId) return ''

  const std = getStandardPrice(task)
  const ps = task.dispatchPrice != null ? getPriceStatus(task) : 'NO_STANDARD'
  const diff = task.dispatchPrice != null ? task.dispatchPrice - std.price : null
  const diffPct = diff != null && std.price !== 0 ? ((diff / std.price) * 100).toFixed(2) : null

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-dispatch-action="close-price-snapshot" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[360px]">
        <header class="border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">价格快照</h3>
            <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-dispatch-action="close-price-snapshot">关闭</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div class="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">任务编号</span><span class="font-mono text-xs">${escapeHtml(task.taskId)}</span></div>
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">工序</span><span class="font-mono text-xs">${escapeHtml(task.processNameZh)}</span></div>
            <div class="flex justify-between gap-2"><span class="text-muted-foreground">承接工厂</span><span class="font-medium text-green-700">${escapeHtml(task.assignedFactoryName ?? '—')}</span></div>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">工序标准价</p>
            <p class="text-lg font-semibold tabular-nums">${std.price.toLocaleString()} <span class="text-sm font-normal text-muted-foreground">${escapeHtml(std.currency)}/${escapeHtml(std.unit)}</span></p>
            <p class="text-xs text-muted-foreground">来源：生产需求接收对应工序标准价快照</p>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">直接派单价</p>
            ${
              task.dispatchPrice != null
                ? `<p class="text-lg font-semibold tabular-nums">${task.dispatchPrice.toLocaleString()} <span class="text-sm font-normal text-muted-foreground">${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</span></p>`
                : '<p class="text-sm text-muted-foreground">暂未录入</p>'
            }
          </div>

          ${
            diff != null
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">价格偏差</p>
                  <div class="flex flex-wrap items-center gap-2">
                    ${
                      ps !== 'NO_STANDARD'
                        ? `<span class="inline-flex rounded border px-2 py-0.5 text-xs font-medium ${priceStatusClass[ps]}">${priceStatusLabel[ps]}</span>`
                        : ''
                    }
                    <span class="text-sm font-medium tabular-nums ${
                      diff === 0 ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700'
                    }">${
                      diff === 0
                        ? '0（0%）'
                        : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}（${diff > 0 ? '+' : ''}${diffPct}%）`
                    }</span>
                  </div>
                </div>`
              : ''
          }

          ${
            task.priceDiffReason
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">价格偏差原因</p>
                  <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">${escapeHtml(task.priceDiffReason)}</p>
                </div>`
              : ''
          }

          ${
            task.dispatchRemark
              ? `<div class="space-y-1">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">派单备注</p>
                  <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">${escapeHtml(task.dispatchRemark)}</p>
                </div>`
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderKanbanCard(
  task: ProcessTask,
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  const hasException = exceptionTaskIds.has(task.taskId)
  const assignPath = deriveAssignPath(task)
  const assignResult = deriveAssignResult(task, hasException)
  const tender = getEffectiveTender(task)
  const deadlineBadge = formatDeadlineBadge(getDeadlineStatus(task), task)
  const checkpoint = currentCheckpoint(
    task,
    assignResult,
    tender,
    dyePendingTaskIds,
    qcPendingOrderIds,
    hasException,
  )
  const isBid = assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
  const alreadyHasTender = hasTender(task)
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)

  const tenderSummary = (() => {
    if (!isBid) return ''
    if (!tender) {
      return '<p class="text-[10px] text-amber-600">未创建招标单</p>'
    }

    const poolCount = 'factoryPoolCount' in tender ? tender.factoryPoolCount : tender.factoryPool.length
    const quotedCount = 'quotedCount' in tender ? (tender.quotedCount ?? 0) : (tender.quotedCount ?? 0)
    const maxPrice = 'currentMaxPrice' in tender ? tender.currentMaxPrice : tender.currentMaxPrice
    const minPrice = 'currentMinPrice' in tender ? tender.currentMinPrice : tender.currentMinPrice
    const currency = tender.currency ?? 'IDR'
    const unit = tender.unit ?? '件'
    const biddingDeadline = tender.biddingDeadline ?? ''
    const taskDeadline = tender.taskDeadline ?? ''
    const remaining = biddingDeadline ? calcRemaining(biddingDeadline) : '—'
    const awardedFactory = 'awardedFactoryName' in tender ? tender.awardedFactoryName : undefined
    const awardedPrice = 'awardedPrice' in tender ? tender.awardedPrice : undefined

    return `
      <p class="text-[10px] font-mono text-muted-foreground">${escapeHtml(tender.tenderId)}</p>
      <p class="text-[10px] text-muted-foreground">工厂池：${poolCount} 家 · 报价进度：<span class="font-medium text-blue-700">${quotedCount} / ${poolCount}</span></p>
      <p class="text-[10px] text-muted-foreground">最高：${
        maxPrice != null
          ? `<span class="text-red-700">${maxPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span>`
          : '暂无报价'
      } · 最低：${
        minPrice != null
          ? `<span class="text-blue-700">${minPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</span>`
          : '暂无报价'
      }</p>
      <p class="text-[10px]"><span class="${remaining === '已截止' ? 'font-medium text-red-600' : 'text-orange-700'}">${remaining}</span><span class="text-muted-foreground"> · 任务截止 ${escapeHtml(taskDeadline.slice(0, 10))}</span></p>
      ${
        assignResult === 'AWARDED' && awardedFactory
          ? `<p class="text-[10px] font-medium text-green-700">中标：${escapeHtml(awardedFactory)}</p>
             ${
               awardedPrice != null
                 ? `<p class="text-[10px] tabular-nums">中标价：${awardedPrice.toLocaleString()} ${escapeHtml(currency)}/${escapeHtml(unit)}</p>`
                 : ''
             }`
          : ''
      }
    `
  })()

  const directSummary = (() => {
    if (assignResult !== 'DIRECT_ASSIGNED') return ''

    const priceStatus = getPriceStatus(task)

    return `
      ${task.assignedFactoryName ? `<p class="text-[10px] font-medium text-green-700">${escapeHtml(task.assignedFactoryName)}</p>` : ''}
      ${task.acceptDeadline ? `<p class="text-[10px] text-muted-foreground">接单截止：${escapeHtml(task.acceptDeadline.slice(0, 16))}</p>` : ''}
      ${task.taskDeadline ? `<p class="text-[10px] text-muted-foreground">任务截止：${escapeHtml(task.taskDeadline.slice(0, 10))}</p>` : ''}
      ${
        task.dispatchPrice != null
          ? `<p class="text-[10px] tabular-nums">派单价：${task.dispatchPrice.toLocaleString()} ${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</p>
             ${
               priceStatus !== 'NO_STANDARD'
                 ? `<span class="inline-flex rounded border px-1 py-0 text-[10px] font-medium ${priceStatusClass[priceStatus]}">${priceStatusLabel[priceStatus]}</span>`
                 : ''
             }`
          : ''
      }
    `
  })()

  const holdReason = (() => {
    if (assignResult !== 'HOLD') return ''

    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    const reason = lastLog?.detail ?? '—'
    return `<p class="text-[10px] text-slate-500">原因：${escapeHtml(reason)}</p>`
  })()

  return `
    <article class="rounded-md border bg-card text-sm ${hasException ? 'border-red-200' : ''}">
      <div class="space-y-1.5 p-3">
        <div class="flex items-start justify-between gap-1">
          <span class="font-mono text-xs text-muted-foreground">${escapeHtml(task.taskId)}</span>
          ${hasException ? '<i data-lucide="alert-triangle" class="h-3.5 w-3.5 shrink-0 text-red-500"></i>' : ''}
        </div>

        <p class="font-medium leading-tight">${escapeHtml(task.processNameZh)}</p>
        <p class="text-xs text-muted-foreground">${escapeHtml(task.productionOrderId)} · ${task.qty} 件</p>

        <div class="flex flex-wrap items-center gap-1.5">
          ${
            assignPath !== 'NONE'
              ? `<span class="inline-flex rounded border px-1.5 py-0 text-[10px]">${pathZh[assignPath]}</span>`
              : ''
          }
          <span class="inline-flex rounded border px-1.5 py-0 text-[10px] font-medium ${resultBadgeClass[assignResult]}">${resultZh[assignResult]}</span>
          ${
            deadlineBadge
              ? `<span class="inline-flex items-center gap-0.5 rounded border px-1.5 py-0 text-[10px] font-medium ${deadlineBadge.className}"><i data-lucide="clock" class="h-2.5 w-2.5"></i>${deadlineBadge.label}</span>`
              : ''
          }
        </div>

        ${
          assignResult === 'DIRECT_ASSIGNED'
            ? `<div class="space-y-0.5 rounded border bg-background px-2 py-1">${directSummary}</div>`
            : ''
        }

        ${
          isBid
            ? `<div class="space-y-0.5 rounded border bg-background px-2 py-1">${tenderSummary}</div>`
            : ''
        }

        ${holdReason}

        <p class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">${escapeHtml(checkpoint)}</p>

        <div class="flex flex-wrap gap-1 pt-1">
          <button class="h-6 rounded border px-2 text-[10px] hover:bg-muted" data-dispatch-action="open-direct-dispatch" data-task-id="${escapeHtml(task.taskId)}">直接派单</button>

          ${
            isBid && alreadyHasTender
              ? `<button class="h-6 rounded border border-orange-200 px-2 text-[10px] text-orange-700 hover:bg-orange-50" data-dispatch-action="open-view-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="file-text" class="mr-0.5 inline h-3 w-3"></i>查看招标单</button>`
              : `<button class="h-6 rounded border px-2 text-[10px] hover:bg-muted" data-dispatch-action="open-create-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="plus" class="mr-0.5 inline h-3 w-3"></i>创建招标单</button>`
          }

          ${
            assignResult === 'AWAIT_AWARD'
              ? '<button class="h-6 rounded border border-purple-200 px-2 text-[10px] text-purple-700 hover:bg-purple-50" data-nav="/fcs/dispatch/tenders">招标单管理</button>'
              : ''
          }

          <button class="h-6 rounded px-2 text-[10px] hover:bg-muted" data-dispatch-action="set-hold" data-task-id="${escapeHtml(task.taskId)}">暂不分配</button>

          ${
            order
              ? `<button class="h-6 rounded px-1 text-[10px] hover:bg-muted" data-dispatch-action="open-order" data-order-id="${escapeHtml(task.productionOrderId)}"><i data-lucide="eye" class="h-3 w-3"></i></button>`
              : ''
          }
        </div>
      </div>
    </article>
  `
}

function renderKanbanView(
  rows: ProcessTask[],
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  const cols: Record<KanbanCol, ProcessTask[]> = {
    UNASSIGNED: [],
    BIDDING: [],
    AWAIT_AWARD: [],
    AWARDED: [],
    DIRECT_ASSIGNED: [],
    HOLD: [],
    EXCEPTION: [],
  }

  for (const task of rows) {
    const col = deriveKanbanCol(task, exceptionTaskIds.has(task.taskId))
    cols[col].push(task)
  }

  const colOrder: KanbanCol[] = [
    'UNASSIGNED',
    'DIRECT_ASSIGNED',
    'BIDDING',
    'AWAIT_AWARD',
    'AWARDED',
    'HOLD',
    'EXCEPTION',
  ]

  return `
    <div class="flex gap-3 overflow-x-auto pb-4 pt-2">
      ${colOrder
        .map((col) => {
          return `
            <section class="w-[230px] flex-none rounded-lg border ${colBg[col]}">
              <header class="flex items-center justify-between border-b px-3 py-2">
                <span class="text-sm font-medium ${colHeaderColor[col]}">${colLabel[col]}</span>
                <span class="inline-flex rounded bg-secondary px-1.5 py-0.5 text-xs">${cols[col].length}</span>
              </header>

              <div class="h-[calc(100vh-440px)] overflow-y-auto p-2">
                <div class="space-y-2">
                  ${
                    cols[col].length === 0
                      ? '<p class="py-3 text-center text-xs text-muted-foreground">暂无任务</p>'
                      : cols[col]
                          .map((task) =>
                            renderKanbanCard(task, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds),
                          )
                          .join('')
                  }
                </div>
              </div>
            </section>
          `
        })
        .join('')}
    </div>
  `
}

function renderListView(
  rows: ProcessTask[],
  dyePendingTaskIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  exceptionTaskIds: Set<string>,
): string {
  return `
    <div class="space-y-3 pt-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground">已选 ${state.selectedIds.size} 条</span>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-direct-dispatch">批量直接派单</button>
        <button class="h-8 rounded-md border px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-bidding">批量发起竞价</button>
        <button class="h-8 rounded-md px-3 text-xs hover:bg-muted ${state.selectedIds.size === 0 ? 'pointer-events-none opacity-50' : ''}" data-dispatch-action="batch-hold">批量设为暂不分配</button>
      </div>

      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1880px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-xs">
              <th class="w-10 px-3 py-2 text-left"><input type="checkbox" data-dispatch-field="list.selectAll" ${rows.length > 0 && state.selectedIds.size === rows.length ? 'checked' : ''} /></th>
              <th class="px-3 py-2 text-left font-medium">任务ID</th>
              <th class="px-3 py-2 text-left font-medium">任务名称</th>
              <th class="px-3 py-2 text-left font-medium">生产单号</th>
              <th class="px-3 py-2 text-left font-medium">分配路径</th>
              <th class="px-3 py-2 text-left font-medium">分配结果</th>
              <th class="px-3 py-2 text-left font-medium">承接工厂</th>
              <th class="px-3 py-2 text-left font-medium">接单截止</th>
              <th class="px-3 py-2 text-left font-medium">任务截止</th>
              <th class="px-3 py-2 text-left font-medium">时限状态</th>
              <th class="px-3 py-2 text-left font-medium">剩余/逾期</th>
              <th class="px-3 py-2 text-left font-medium">工序标准价</th>
              <th class="px-3 py-2 text-left font-medium">直接派单价</th>
              <th class="px-3 py-2 text-left font-medium">价格状态</th>
              <th class="px-3 py-2 text-left font-medium">招标单号</th>
              <th class="px-3 py-2 text-left font-medium">工厂池</th>
              <th class="px-3 py-2 text-left font-medium">竞价截止</th>
              <th class="px-3 py-2 text-left font-medium">任务截止（招标）</th>
              <th class="px-3 py-2 text-left font-medium">中标工厂</th>
              <th class="px-3 py-2 text-left font-medium">中标价</th>
              <th class="px-3 py-2 text-left font-medium">当前卡点</th>
              <th class="px-3 py-2 text-left font-medium">任务状态</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows.length === 0
                ? '<tr><td colspan="23" class="py-8 text-center text-sm text-muted-foreground">暂无任务数据</td></tr>'
                : rows
                    .map((task) => {
                      const hasException = exceptionTaskIds.has(task.taskId)
                      const assignPath = deriveAssignPath(task)
                      const assignResult = deriveAssignResult(task, hasException)
                      const tender = getEffectiveTender(task)
                      const deadlineBadge = formatDeadlineBadge(getDeadlineStatus(task), task)
                      const checkpoint = currentCheckpoint(
                        task,
                        assignResult,
                        tender,
                        dyePendingTaskIds,
                        qcPendingOrderIds,
                        hasException,
                      )
                      const std = getStandardPrice(task)
                      const isDirect = assignResult === 'DIRECT_ASSIGNED'
                      const isBid =
                        assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
                      const alreadyHasTender = hasTender(task)
                      const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)

                      const tenderBiddingDeadline = tender?.biddingDeadline ?? ''
                      const tenderTaskDeadline = tender?.taskDeadline ?? ''
                      const tenderPoolCount = tender
                        ? 'factoryPoolCount' in tender
                          ? tender.factoryPoolCount
                          : tender.factoryPool.length
                        : 0
                      const awardedFactory = tender?.awardedFactoryName
                      const awardedPrice = tender?.awardedPrice

                      return `
                        <tr class="border-b last:border-b-0 ${hasException ? 'bg-red-50' : ''}">
                          <td class="px-3 py-3"><input type="checkbox" data-dispatch-field="list.selectTask" data-task-id="${escapeHtml(task.taskId)}" ${state.selectedIds.has(task.taskId) ? 'checked' : ''} /></td>
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(task.taskId)}</td>
                          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(task.processNameZh)}</td>
                          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(task.productionOrderId)}</td>

                          <td class="px-3 py-3">
                            ${
                              assignPath !== 'NONE'
                                ? `<span class="inline-flex rounded border px-1.5 py-0.5 text-xs">${pathZh[assignPath]}</span>`
                                : '<span class="text-xs text-muted-foreground">—</span>'
                            }
                          </td>

                          <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${resultBadgeClass[assignResult]}">${resultZh[assignResult]}</span></td>

                          <td class="px-3 py-3 text-xs">${
                            isDirect && task.assignedFactoryName
                              ? `<span class="font-medium text-green-700">${escapeHtml(task.assignedFactoryName)}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${
                            isDirect && task.acceptDeadline ? escapeHtml(task.acceptDeadline.slice(0, 16).replace('T', ' ')) : '—'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${
                            isDirect && task.taskDeadline ? escapeHtml(task.taskDeadline.slice(0, 16).replace('T', ' ')) : '—'
                          }</td>

                          <td class="px-3 py-3">
                            ${
                              isDirect && deadlineBadge
                                ? `<span class="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium ${deadlineBadge.className}"><i data-lucide="clock" class="h-3 w-3"></i>${deadlineBadge.label}</span>`
                                : `<span class="text-xs text-muted-foreground">${isDirect ? '正常' : '—'}</span>`
                            }
                          </td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${isDirect ? formatRemainingTime(task.taskDeadline) : '—'}</td>

                          <td class="px-3 py-3 text-xs tabular-nums text-muted-foreground">${
                            isDirect ? `${std.price.toLocaleString()} ${escapeHtml(std.currency)}/${escapeHtml(std.unit)}` : '—'
                          }</td>

                          <td class="px-3 py-3 text-xs tabular-nums">${
                            isDirect && task.dispatchPrice != null
                              ? `<span class="font-medium">${task.dispatchPrice.toLocaleString()} ${escapeHtml(task.dispatchPriceCurrency ?? 'IDR')}/${escapeHtml(task.dispatchPriceUnit ?? '件')}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3">
                            ${
                              isDirect && task.dispatchPrice != null
                                ? (() => {
                                    const ps = getPriceStatus(task)
                                    return `<span class="inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${priceStatusClass[ps]}">${priceStatusLabel[ps]}</span>`
                                  })()
                                : '<span class="text-xs text-muted-foreground">—</span>'
                            }
                          </td>

                          <td class="px-3 py-3 font-mono text-xs">${
                            isBid && tender ? `<span class="text-orange-700">${escapeHtml(tender.tenderId)}</span>` : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? `${tenderPoolCount} 家` : '—'}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? escapeHtml(tenderBiddingDeadline.slice(0, 16)) : '—'}</td>
                          <td class="px-3 py-3 text-xs text-muted-foreground">${isBid && tender ? escapeHtml(tenderTaskDeadline.slice(0, 10)) : '—'}</td>

                          <td class="px-3 py-3 text-xs">${
                            assignResult === 'AWARDED' && awardedFactory
                              ? `<span class="font-medium text-green-700">${escapeHtml(awardedFactory)}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="px-3 py-3 text-xs tabular-nums">${
                            assignResult === 'AWARDED' && awardedPrice != null
                              ? `<span class="font-medium">${awardedPrice.toLocaleString()} ${escapeHtml(tender?.currency ?? 'IDR')}/${escapeHtml(tender?.unit ?? '件')}</span>`
                              : '<span class="text-muted-foreground">—</span>'
                          }</td>

                          <td class="max-w-[160px] px-3 py-3 text-xs"><span class="text-amber-700">${escapeHtml(checkpoint)}</span></td>

                          <td class="px-3 py-3"><span class="inline-flex rounded border px-1.5 py-0.5 text-xs ${task.status === 'BLOCKED' ? 'border-red-200 bg-red-100 text-red-700' : ''}">${escapeHtml(taskStatusZh[task.status] ?? task.status)}</span></td>

                          <td class="px-3 py-3" data-dispatch-action="noop">
                            <div class="relative" data-dispatch-menu-root="true">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-dispatch-action="toggle-row-menu" data-task-id="${escapeHtml(task.taskId)}">操作 <i data-lucide="chevron-right" class="ml-1 h-3 w-3"></i></button>
                              ${
                                state.actionMenuTaskId === task.taskId
                                  ? `<div class="absolute right-0 z-20 mt-1 min-w-[156px] rounded-md border bg-background p-1 shadow-lg">
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-direct-dispatch" data-task-id="${escapeHtml(task.taskId)}">直接派单</button>
                                      ${
                                        isBid && alreadyHasTender
                                          ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-view-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="file-text" class="mr-1.5 h-3.5 w-3.5"></i>查看招标单</button>`
                                          : `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-create-tender" data-task-id="${escapeHtml(task.taskId)}"><i data-lucide="plus" class="mr-1.5 h-3.5 w-3.5"></i>创建招标单</button>`
                                      }
                                      <div class="my-1 h-px bg-border"></div>
                                      <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="set-hold" data-task-id="${escapeHtml(task.taskId)}">设为暂不分配</button>
                                      ${
                                        task.dispatchPrice != null
                                          ? `<div class="my-1 h-px bg-border"></div><button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-price-snapshot" data-task-id="${escapeHtml(task.taskId)}">查看价格快照</button>`
                                          : ''
                                      }
                                      ${
                                        order
                                          ? `<div class="my-1 h-px bg-border"></div><button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-dispatch-action="open-order" data-order-id="${escapeHtml(task.productionOrderId)}"><i data-lucide="external-link" class="mr-1 h-3 w-3"></i>查看生产单</button>`
                                          : ''
                                      }
                                    </div>`
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDispatchBoardInner(): string {
  const allRows = getVisibleRows()
  const dyePendingTaskIds = getDyePendingTaskIds()
  const qcPendingOrderIds = getQcPendingOrderIds()
  const exceptionTaskIds = getExceptionTaskIds()

  const stats = {
    unassigned: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'UNASSIGNED').length,
    directAssigned: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'DIRECT_ASSIGNED').length,
    bidding: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'BIDDING').length,
    awaitAward: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'AWAIT_AWARD').length,
    awarded: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'AWARDED').length,
    hold: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'HOLD').length,
    exception: allRows.filter((task) => deriveKanbanCol(task, exceptionTaskIds.has(task.taskId)) === 'EXCEPTION').length,
  }

  const createTenderTask = getCreateTenderTask()
  const viewTenderTask = getViewTenderTask()
  const priceSnapshotTask = getPriceSnapshotTask()
  const dispatchDialogTasks = getDispatchDialogTasks()
  const factoryOptions = getFactoryOptions()

  return `
    <div class="space-y-4">
      <header>
        <h1 class="text-2xl font-bold">任务分配</h1>
        <p class="mt-0.5 text-sm text-muted-foreground">对任务进行直接派单、竞价或暂不分配处理，支持看板视图与列表视图，分别承接运营推进与批量处理。</p>
      </header>

      <section class="grid grid-cols-4 gap-2 md:grid-cols-7">
        ${[
          { label: '未分配', value: stats.unassigned, color: 'text-gray-700' },
          { label: '已直接派单', value: stats.directAssigned, color: 'text-blue-600' },
          { label: '招标中', value: stats.bidding, color: 'text-orange-600' },
          { label: '待定标', value: stats.awaitAward, color: 'text-purple-600' },
          { label: '已定标', value: stats.awarded, color: 'text-green-600' },
          { label: '暂不分配', value: stats.hold, color: 'text-slate-600' },
          { label: '异常', value: stats.exception, color: 'text-red-600' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="p-3 text-center">
                  <p class="text-2xl font-bold ${item.color}">${item.value}</p>
                  <p class="mt-0.5 text-xs leading-tight text-muted-foreground">${item.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </section>

      <section class="flex items-center gap-3">
        <div class="relative w-full max-w-xs">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm" data-dispatch-field="filter.keyword" placeholder="关键词（任务ID / 任务名 / 生产单号）" value="${escapeHtml(state.keyword)}" />
        </div>
        <button class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted" data-dispatch-action="clear-keyword"><i data-lucide="refresh-cw" class="h-4 w-4"></i></button>
        <p class="ml-auto text-sm text-muted-foreground">共 ${allRows.length} 条任务</p>
      </section>

      <section class="rounded-lg border bg-muted/40 px-4 py-3">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">自动分配</p>
            <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              根据当前任务约束与规则，系统会推荐每个待分配任务走以下路径之一：
              <span class="font-medium">直接派单</span>（最终需确认工厂、时间、价格）、
              <span class="font-medium">竞价</span>（按"一任务一招标单"进入招标流程）、
              <span class="font-medium">暂不分配</span>（存在上游阻塞或异常）。
              仅对尚未明确设置分配路径的任务生效。
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            ${
              state.autoAssignDone
                ? '<span class="flex items-center gap-1 text-xs text-green-600"><i data-lucide="check-circle-2" class="h-3.5 w-3.5"></i>已执行自动分配</span>'
                : ''
            }
            <button class="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-dispatch-action="run-auto-assign">执行自动分配</button>
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <div class="inline-flex items-center rounded-md bg-muted p-1 text-sm">
          <button class="rounded-md px-3 py-1.5 text-sm ${
            state.view === 'kanban'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }" data-dispatch-action="switch-view" data-view="kanban"><i data-lucide="layout-grid" class="mr-1 inline h-4 w-4"></i>看板视图</button>
          <button class="rounded-md px-3 py-1.5 text-sm ${
            state.view === 'list'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }" data-dispatch-action="switch-view" data-view="list"><i data-lucide="list" class="mr-1 inline h-4 w-4"></i>列表视图</button>
        </div>

        ${
          state.view === 'kanban'
            ? renderKanbanView(allRows, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds)
            : renderListView(allRows, dyePendingTaskIds, qcPendingOrderIds, exceptionTaskIds)
        }
      </section>

      ${renderDirectDispatchDialog(dispatchDialogTasks, factoryOptions)}
      ${renderCreateTenderSheet(createTenderTask)}
      ${renderViewTenderSheet(viewTenderTask)}
      ${renderPriceSnapshotSheet(priceSnapshotTask)}
    </div>
  `
}

export function renderDispatchBoardPage(): string {
  return renderDispatchBoardInner()
}

function applyAutoAssign(): void {
  const rows = getVisibleRows()
  const dyePendingTaskIds = getDyePendingTaskIds()
  const qcPendingOrderIds = getQcPendingOrderIds()
  const exceptionTaskIds = getExceptionTaskIds()

  const unsetRows = rows.filter((task) => {
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    return !(lastLog?.action === 'SET_ASSIGN_MODE') && task.assignmentStatus === 'UNASSIGNED'
  })

  const bidTaskIds = unsetRows
    .filter((task) => {
      const alloc = initialAllocationByTaskId[task.taskId]
      return (
        dyePendingTaskIds.has(task.taskId) ||
        qcPendingOrderIds.has(task.productionOrderId) ||
        Boolean(alloc && (alloc.availableQty ?? 1) <= 0)
      )
    })
    .map((task) => task.taskId)

  const holdTaskIds = unsetRows
    .filter((task) => task.status === 'BLOCKED' || exceptionTaskIds.has(task.taskId))
    .map((task) => task.taskId)

  if (bidTaskIds.length > 0) {
    batchSetTaskAssignMode(bidTaskIds, 'BIDDING', '自动分配')
  }

  if (holdTaskIds.length > 0) {
    batchSetTaskAssignMode(holdTaskIds, 'HOLD', '自动分配')
  }

  state.autoAssignDone = true
}

function confirmDirectDispatch(): void {
  const tasks = getDispatchDialogTasks()
  if (tasks.length === 0) return

  const validation = getDispatchDialogValidation(tasks)
  if (!validation.valid || validation.dispatchPrice == null) return

  const acceptDeadline = fromDateTimeLocal(state.dispatchForm.acceptDeadline)
  const taskDeadline = fromDateTimeLocal(state.dispatchForm.taskDeadline)

  batchDispatch(
    tasks.map((task) => task.taskId),
    state.dispatchForm.factoryId,
    state.dispatchForm.factoryName,
    acceptDeadline,
    taskDeadline,
    state.dispatchForm.remark,
    '跟单A',
    validation.dispatchPrice,
    validation.stdCurrency,
    validation.stdUnit,
    state.dispatchForm.priceDiffReason,
  )

  closeDispatchDialog()
  state.selectedIds = new Set<string>()
}

function confirmCreateTender(): void {
  const task = getCreateTenderTask()
  if (!task) return

  const minPrice = Number(state.createTenderForm.minPrice)
  const maxPrice = Number(state.createTenderForm.maxPrice)

  const valid =
    state.createTenderForm.selectedPool.size > 0 &&
    state.createTenderForm.minPrice !== '' &&
    Number.isFinite(minPrice) &&
    minPrice > 0 &&
    state.createTenderForm.maxPrice !== '' &&
    Number.isFinite(maxPrice) &&
    maxPrice >= minPrice &&
    state.createTenderForm.biddingDeadline !== '' &&
    state.createTenderForm.taskDeadline !== ''

  if (!valid) return

  const std = getStandardPrice(task)
  const selectedPoolIds = Array.from(state.createTenderForm.selectedPool)
  const poolNames = selectedPoolIds.map((factoryId) => {
    const factory = candidateFactories.find((item) => item.id === factoryId)
    return factory?.name ?? factoryId
  })

  state.tenderState[task.taskId] = {
    tenderId: state.createTenderForm.tenderId,
    tenderStatus: 'BIDDING',
    factoryPool: selectedPoolIds,
    factoryPoolNames: poolNames,
    minPrice,
    maxPrice,
    currency: std.currency,
    unit: std.unit,
    biddingDeadline: fromDateTimeLocal(state.createTenderForm.biddingDeadline),
    taskDeadline: fromDateTimeLocal(state.createTenderForm.taskDeadline),
    standardPrice: std.price,
    remark: state.createTenderForm.remark,
    createdAt: nowTimestamp(),
    quotedCount: 0,
  }

  setTaskAssignMode(task.taskId, 'BIDDING', '跟单A')
  closeCreateTender()
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (field === 'filter.keyword') {
    state.keyword = node.value
    return
  }

  if (field === 'list.selectTask' && node instanceof HTMLInputElement) {
    const taskId = node.dataset.taskId
    if (!taskId) return

    if (node.checked) {
      state.selectedIds.add(taskId)
    } else {
      state.selectedIds.delete(taskId)
    }

    return
  }

  if (field === 'list.selectAll' && node instanceof HTMLInputElement) {
    const rows = getVisibleRows()

    if (node.checked) {
      state.selectedIds = new Set(rows.map((task) => task.taskId))
    } else {
      state.selectedIds = new Set<string>()
    }

    return
  }

  if (field === 'dispatch.factoryId') {
    state.dispatchForm.factoryId = node.value
    const selectedFactory = getFactoryOptions().find((factory) => factory.id === node.value)
    state.dispatchForm.factoryName = selectedFactory?.name ?? ''
    return
  }

  if (field === 'dispatch.acceptDeadline') {
    state.dispatchForm.acceptDeadline = node.value
    return
  }

  if (field === 'dispatch.taskDeadline') {
    state.dispatchForm.taskDeadline = node.value
    return
  }

  if (field === 'dispatch.dispatchPrice') {
    state.dispatchForm.dispatchPrice = node.value
    return
  }

  if (field === 'dispatch.priceDiffReason') {
    state.dispatchForm.priceDiffReason = node.value
    return
  }

  if (field === 'dispatch.remark') {
    state.dispatchForm.remark = node.value
    return
  }

  if (field === 'tender.minPrice') {
    state.createTenderForm.minPrice = node.value
    return
  }

  if (field === 'tender.maxPrice') {
    state.createTenderForm.maxPrice = node.value
    return
  }

  if (field === 'tender.biddingDeadline') {
    state.createTenderForm.biddingDeadline = node.value
    return
  }

  if (field === 'tender.taskDeadline') {
    state.createTenderForm.taskDeadline = node.value
    return
  }

  if (field === 'tender.remark') {
    state.createTenderForm.remark = node.value
  }
}

export function handleDispatchBoardEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-dispatch-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.dispatchField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-dispatch-action]')
  if (!actionNode) {
    if (state.actionMenuTaskId && !target.closest('[data-dispatch-menu-root]')) {
      state.actionMenuTaskId = null
      return true
    }

    return false
  }

  const action = actionNode.dataset.dispatchAction
  if (!action) return false

  if (action === 'noop') return true

  if (action === 'switch-view') {
    const view = actionNode.dataset.view as DispatchView | undefined
    if (view === 'kanban' || view === 'list') {
      state.view = view
    }
    return true
  }

  if (action === 'clear-keyword') {
    state.keyword = ''
    return true
  }

  if (action === 'run-auto-assign') {
    applyAutoAssign()
    return true
  }

  if (action === 'open-direct-dispatch') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openDispatchDialog([taskId])
      return true
    }

    openDispatchDialog(Array.from(state.selectedIds))
    return true
  }

  if (action === 'close-direct-dispatch') {
    closeDispatchDialog()
    return true
  }

  if (action === 'confirm-direct-dispatch') {
    confirmDirectDispatch()
    return true
  }

  if (action === 'batch-direct-dispatch') {
    openDispatchDialog(Array.from(state.selectedIds))
    return true
  }

  if (action === 'batch-bidding') {
    if (state.selectedIds.size > 0) {
      batchSetTaskAssignMode(Array.from(state.selectedIds), 'BIDDING', '跟单A')
      state.selectedIds = new Set<string>()
    }
    return true
  }

  if (action === 'batch-hold') {
    if (state.selectedIds.size > 0) {
      batchSetTaskAssignMode(Array.from(state.selectedIds), 'HOLD', '跟单A')
      state.selectedIds = new Set<string>()
    }
    return true
  }

  if (action === 'set-hold') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    setTaskAssignMode(taskId, 'HOLD', '跟单A')
    state.actionMenuTaskId = null
    return true
  }

  if (action === 'open-create-tender') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    setTaskAssignMode(taskId, 'BIDDING', '跟单A')
    openCreateTender(taskId)
    return true
  }

  if (action === 'close-create-tender') {
    closeCreateTender()
    return true
  }

  if (action === 'toggle-pool') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true

    if (state.createTenderForm.selectedPool.has(factoryId)) {
      state.createTenderForm.selectedPool.delete(factoryId)
    } else {
      state.createTenderForm.selectedPool.add(factoryId)
    }

    state.createTenderForm.selectedPool = new Set(state.createTenderForm.selectedPool)
    return true
  }

  if (action === 'select-all-pool') {
    state.createTenderForm.selectedPool = new Set(candidateFactories.map((factory) => factory.id))
    return true
  }

  if (action === 'clear-all-pool') {
    state.createTenderForm.selectedPool = new Set<string>()
    return true
  }

  if (action === 'confirm-create-tender') {
    confirmCreateTender()
    return true
  }

  if (action === 'open-view-tender') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    openViewTender(taskId)
    return true
  }

  if (action === 'close-view-tender') {
    closeViewTender()
    return true
  }

  if (action === 'open-price-snapshot') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.priceSnapshotTaskId = taskId
    state.actionMenuTaskId = null
    return true
  }

  if (action === 'close-price-snapshot') {
    closePriceSnapshot()
    return true
  }

  if (action === 'toggle-row-menu') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.actionMenuTaskId = state.actionMenuTaskId === taskId ? null : taskId
    return true
  }

  if (action === 'open-order') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.actionMenuTaskId = null
    openAppRoute(`/fcs/production/orders/${orderId}`, `po-${orderId}`, `生产单（台账） ${orderId}`)
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isDispatchBoardDialogOpen(): boolean {
  return Boolean(
    state.dispatchDialogTaskIds ||
      state.createTenderTaskId ||
      state.viewTenderTaskId ||
      state.priceSnapshotTaskId,
  )
}
