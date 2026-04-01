import { appStore } from '../../state/store'
import { productionOrders } from '../../data/fcs/production-orders'
import {
  applyRuntimeDirectDispatchMeta,
  batchDispatchRuntimeTasks,
  batchSetRuntimeTaskAssignMode,
  createRuntimeTaskTenderByDetailGroups,
  dispatchRuntimeTaskByDetailGroups,
  getRuntimeTaskById as getRuntimeTaskByIdFromStore,
  isRuntimeTaskExecutionTask,
  listRuntimeTaskAllocatableGroups,
  listRuntimeProcessTasks,
  resolveRuntimeAllocatableGroupPublishedSam,
  resolveRuntimeTaskPublishedSam,
  setRuntimeTaskAssignMode,
  upsertRuntimeTaskTender,
  validateRuntimeBatchDispatchSelection,
  type RuntimeTaskAllocatableGroup,
  type RuntimeTaskAllocatableGroupAssignment,
  type RuntimeProcessTask,
} from '../../data/fcs/runtime-process-tasks'
import {
  initialQualityInspections,
  initialAllocationByTaskId,
} from '../../data/fcs/store-domain-quality-seeds'
import { listProgressExceptions, type ExceptionCase } from '../../data/fcs/store-domain-progress'
import { listLegacyLikeDyePrintOrdersForTailPages } from '../../data/fcs/page-adapters/long-tail-pages-adapter'
import { indonesiaFactories } from '../../data/fcs/indonesia-factories'
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap'
import { escapeHtml, toClassName } from '../../utils'

applyQualitySeedBootstrap()

type DispatchTask = RuntimeProcessTask

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
  BLOCKED: '生产暂停',
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
  publishedSamPerUnit?: number
  publishedSamUnit?: string
  publishedSamTotal?: number
  publishedSamDifficulty?: DispatchTask['publishedSamDifficulty']
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
  publishedSamPerUnit?: number
  publishedSamUnit?: string
  publishedSamTotal?: number
  publishedSamDifficulty?: DispatchTask['publishedSamDifficulty']
  quotedCount?: number
  currentMaxPrice?: number
  currentMinPrice?: number
  awardedFactoryName?: string
  awardedPrice?: number
}

interface DispatchPublishedSamSnapshot {
  publishedSamPerUnit?: number
  publishedSamUnit?: string
  publishedSamTotal?: number
  publishedSamDifficulty?: DispatchTask['publishedSamDifficulty']
}

type TenderState = Record<string, LocalTender>
type AssignmentOperateMode = 'TASK' | 'DETAIL'

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
    tenderId: 'TENDER-TASKGEN0015004-1001',
    taskId: 'TASKGEN-202603-0015-004__ORDER',
    status: 'BIDDING',
    factoryPoolCount: 4,
    quotedCount: 2,
    currentMaxPrice: 14200,
    currentMinPrice: 13800,
    biddingDeadline: '2026-04-03 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    minPrice: 12000,
    maxPrice: 16000,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0015006-1001',
    taskId: 'TASKGEN-202603-0015-006__ORDER',
    status: 'BIDDING',
    factoryPoolCount: 5,
    quotedCount: 1,
    currentMaxPrice: 14900,
    currentMinPrice: 13400,
    biddingDeadline: '2026-04-04 18:00:00',
    taskDeadline: '2026-04-12 18:00:00',
    minPrice: 11800,
    maxPrice: 15500,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0009001-1001',
    taskId: 'TASKGEN-202603-0009-001__ORDER',
    status: 'BIDDING',
    factoryPoolCount: 3,
    quotedCount: 2,
    currentMaxPrice: 15100,
    currentMinPrice: 14100,
    biddingDeadline: '2026-04-04 20:00:00',
    taskDeadline: '2026-04-13 18:00:00',
    minPrice: 12300,
    maxPrice: 15800,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0015005-1001',
    taskId: 'TASKGEN-202603-0015-005__ORDER',
    status: 'BIDDING',
    factoryPoolCount: 4,
    quotedCount: 3,
    currentMaxPrice: 15700,
    currentMinPrice: 14600,
    biddingDeadline: '2026-03-28 18:00:00',
    taskDeadline: '2026-04-09 18:00:00',
    minPrice: 12800,
    maxPrice: 16200,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0003001-1001',
    taskId: 'TASKGEN-202603-0003-001__ORDER',
    status: 'AWAIT_AWARD',
    factoryPoolCount: 5,
    quotedCount: 5,
    currentMaxPrice: 16200,
    currentMinPrice: 10200,
    biddingDeadline: '2026-03-21 12:00:00',
    taskDeadline: '2026-04-12 18:00:00',
    minPrice: 11000,
    maxPrice: 15500,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0015001-1001',
    taskId: 'TASKGEN-202603-0015-001__ORDER',
    status: 'AWAIT_AWARD',
    factoryPoolCount: 4,
    quotedCount: 4,
    currentMaxPrice: 13900,
    currentMinPrice: 12800,
    biddingDeadline: '2026-03-21 18:00:00',
    taskDeadline: '2026-04-08 18:00:00',
    minPrice: 11800,
    maxPrice: 14800,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0084001-1001',
    taskId: 'TASKGEN-202603-084-001__ORDER',
    status: 'AWAIT_AWARD',
    factoryPoolCount: 4,
    quotedCount: 4,
    currentMaxPrice: 14700,
    currentMinPrice: 13600,
    biddingDeadline: '2026-03-22 18:00:00',
    taskDeadline: '2026-04-14 18:00:00',
    minPrice: 12600,
    maxPrice: 15100,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-TASKGEN0004001-1001',
    taskId: 'TASKGEN-202603-0004-001__ORDER',
    status: 'AWARDED',
    factoryPoolCount: 3,
    quotedCount: 3,
    currentMaxPrice: 14100,
    currentMinPrice: 13200,
    biddingDeadline: '2026-03-18 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    minPrice: 11500,
    maxPrice: 15000,
    currency: 'IDR',
    unit: '件',
    awardedFactoryName: '万隆车缝厂',
    awardedPrice: 13200,
  },
  {
    tenderId: 'TENDER-TASKGEN0015008-1001',
    taskId: 'TASKGEN-202603-0015-008__ORDER',
    status: 'AWARDED',
    factoryPoolCount: 3,
    quotedCount: 3,
    currentMaxPrice: 9800,
    currentMinPrice: 8800,
    biddingDeadline: '2026-03-19 18:00:00',
    taskDeadline: '2026-04-11 18:00:00',
    minPrice: 8200,
    maxPrice: 10100,
    currency: 'IDR',
    unit: '件',
    awardedFactoryName: '日惹包装厂',
    awardedPrice: 8800,
  },
  {
    tenderId: 'TENDER-TASKGEN0083001-1001',
    taskId: 'TASKGEN-202603-083-001__ORDER',
    status: 'AWARDED',
    factoryPoolCount: 4,
    quotedCount: 4,
    currentMaxPrice: 15700,
    currentMinPrice: 14800,
    biddingDeadline: '2026-03-18 18:00:00',
    taskDeadline: '2026-04-15 18:00:00',
    minPrice: 13300,
    maxPrice: 16000,
    currency: 'IDR',
    unit: '件',
    awardedFactoryName: '雅加达绣花专工厂',
    awardedPrice: 14800,
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
  mode: AssignmentOperateMode
  factoryId: string
  factoryName: string
  acceptDeadline: string
  taskDeadline: string
  remark: string
  dispatchPrice: string
  priceDiffReason: string
  factoryByGroupKey: Record<string, { factoryId: string; factoryName: string }>
}

interface CreateTenderForm {
  mode: AssignmentOperateMode
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
  dispatchDialogError: string | null
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
  dispatchDialogError: null,
  dispatchForm: emptyDispatchForm(),
  tenderState: {},
  createTenderTaskId: null,
  createTenderForm: emptyCreateTenderForm(),
  viewTenderTaskId: null,
  priceSnapshotTaskId: null,
  actionMenuTaskId: null,
}

function emptyDispatchForm(): DirectDispatchForm {
  return {
    mode: 'TASK',
    factoryId: '',
    factoryName: '',
    acceptDeadline: '',
    taskDeadline: '',
    remark: '',
    dispatchPrice: '',
    priceDiffReason: '',
    factoryByGroupKey: {},
  }
}

function emptyCreateTenderForm(): CreateTenderForm {
  return {
    mode: 'TASK',
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

function resolveTaskPublishedSam(task: DispatchTask | null): DispatchPublishedSamSnapshot {
  if (!task) return {}
  return resolveRuntimeTaskPublishedSam(task)
}

function resolveAllocatableGroupPublishedSam(
  task: DispatchTask | null,
  group: RuntimeTaskAllocatableGroup | null,
): DispatchPublishedSamSnapshot {
  if (!task || !group) return {}
  return resolveRuntimeAllocatableGroupPublishedSam(task, group)
}

function formatPublishedSamNumber(value: number | undefined): string {
  if (!Number.isFinite(value) || value == null) return '--'
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function attachTenderPublishedSam<T extends MockTender | LocalTender>(tender: T, task: DispatchTask): T {
  const sam = resolveTaskPublishedSam(task)
  if (!sam.publishedSamPerUnit || !sam.publishedSamUnit) return tender
  return {
    ...tender,
    publishedSamPerUnit: tender.publishedSamPerUnit ?? sam.publishedSamPerUnit,
    publishedSamUnit: tender.publishedSamUnit ?? sam.publishedSamUnit,
    publishedSamTotal: tender.publishedSamTotal ?? sam.publishedSamTotal,
    publishedSamDifficulty: tender.publishedSamDifficulty ?? sam.publishedSamDifficulty,
  }
}

function getMockTender(task: DispatchTask): MockTender | undefined {
  const tender = mockTenders.find(
    (item) =>
      item.taskId === task.taskId ||
      item.taskId === task.baseTaskId ||
      (task.tenderId ? item.tenderId === task.tenderId : false),
  )
  return tender ? attachTenderPublishedSam(tender, task) : undefined
}

function getEffectiveTender(task: DispatchTask): MockTender | LocalTender | undefined {
  const local = state.tenderState[task.taskId]
  if (local) return attachTenderPublishedSam(local, task)
  return getMockTender(task)
}

function hasTender(task: DispatchTask): boolean {
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

function deriveAssignPath(task: DispatchTask): AssignPath {
  const lastLog = task.auditLogs[task.auditLogs.length - 1]
  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') {
    return 'HOLD'
  }

  if (task.assignmentMode === 'DIRECT') return 'DIRECT'
  if (task.assignmentMode === 'BIDDING') return 'BIDDING'

  return 'NONE'
}

function deriveAssignResult(task: DispatchTask, hasException: boolean): AssignResult {
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

function deriveKanbanCol(task: DispatchTask, hasException: boolean): KanbanCol {
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

function getStandardPrice(task: DispatchTask): { price: number; currency: string; unit: string } {
  return {
    price: task.standardPrice ?? mockStandardPrices[task.processCode] ?? 10000,
    currency: task.standardPriceCurrency ?? 'IDR',
    unit: task.standardPriceUnit ?? '件',
  }
}

function getPriceStatus(task: DispatchTask): PriceStatus {
  if (task.standardPrice == null || task.dispatchPrice == null) return 'NO_STANDARD'

  const diff = task.dispatchPrice - task.standardPrice
  if (Math.abs(diff) < 0.001) return 'AT_STANDARD'

  return diff > 0 ? 'ABOVE_STANDARD' : 'BELOW_STANDARD'
}

function getDeadlineStatus(task: DispatchTask): DeadlineStatus {
  if (task.assignmentMode !== 'DIRECT' || task.assignmentStatus !== 'ASSIGNED') return 'NONE'
  if (task.status === 'DONE' || task.status === 'CANCELLED') return 'NONE'

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

function formatDeadlineBadge(status: DeadlineStatus, task: DispatchTask): { label: string; className: string } | null {
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
  task: DispatchTask,
  result: AssignResult,
  tender: MockTender | LocalTender | undefined,
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  hasException: boolean,
): string {
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
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

  if (isAffectedByTaskSet(task, dyePendingIds)) return '受染印回货影响，待确认'
  if (qcPendingOrderIds.has(task.productionOrderId)) return '存在待质检项，暂不可分配'

  const deps = task.dependsOnTaskIds ?? []
  if (deps.length > 0) return '前序任务未完成，等待解锁'

  return '待分配，可立即处理'
}

function getDyePendingTaskIds(): Set<string> {
  const set = new Set<string>()
  const taskIdsByOrder = new Map<string, string[]>()

  for (const task of listRuntimeProcessTasks()) {
    const list = taskIdsByOrder.get(task.productionOrderId) ?? []
    list.push(task.taskId)
    taskIdsByOrder.set(task.productionOrderId, list)
  }

  for (const order of listLegacyLikeDyePrintOrdersForTailPages()) {
    const isPending = order.availableQty <= 0 || order.returnedFailQty > 0
    if (!isPending) continue

    const relatedTasks = taskIdsByOrder.get(order.productionOrderId) ?? []
    for (const taskId of relatedTasks) {
      set.add(taskId)
    }
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
  const active = new Set<ExceptionCase['caseStatus']>(['OPEN', 'IN_PROGRESS'])
  const blockingReasons = new Set<ExceptionCase['reasonCode']>([
    'DISPATCH_REJECTED',
    'ACK_TIMEOUT',
    'NO_BID',
    'FACTORY_BLACKLISTED',
  ])
  const set = new Set<string>()

  for (const item of listProgressExceptions()) {
    if (!active.has(item.caseStatus)) continue
    if (item.category !== 'ASSIGNMENT') continue
    if (!blockingReasons.has(item.reasonCode)) continue

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

  for (const task of listRuntimeProcessTasks()) {
    if (!isRuntimeTaskExecutionTask(task)) continue

    if (task.assignmentMode === 'DIRECT' && task.assignmentStatus === 'ASSIGNED') {
      if (task.acceptanceStatus !== 'ACCEPTED' && task.acceptDeadline) {
        const acceptDeadlineMs = parseDateLike(task.acceptDeadline)
        if (Number.isFinite(acceptDeadlineMs) && Date.now() > acceptDeadlineMs) {
          set.add(task.taskId)
          continue
        }
      }

      if ((task.acceptanceStatus === 'ACCEPTED' || task.status === 'IN_PROGRESS') && task.taskDeadline) {
        const taskDeadlineMs = parseDateLike(task.taskDeadline)
        if (Number.isFinite(taskDeadlineMs) && Date.now() > taskDeadlineMs) {
          set.add(task.taskId)
          continue
        }
      }
    }

    if (task.assignmentMode === 'BIDDING') {
      const tender = getEffectiveTender(task)
      const tenderStatus = tender ? ('tenderStatus' in tender ? tender.tenderStatus : tender.status) : undefined
      const biddingDeadline = tender?.biddingDeadline ?? task.biddingDeadline
      const deadlineMs = parseDateLike(biddingDeadline ?? '')
      if (tenderStatus === 'BIDDING' && Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
        set.add(task.taskId)
      }
    }
  }

  return set
}

function isAffectedByTaskSet(task: DispatchTask, taskSet: Set<string>): boolean {
  return taskSet.has(task.taskId) || taskSet.has(task.baseTaskId)
}

function formatScopeLabel(task: DispatchTask): string {
  if (task.scopeType === 'SKU') {
    const pieces = [task.skuCode, task.skuColor, task.skuSize].filter(Boolean)
    return pieces.length > 0 ? pieces.join(' / ') : task.scopeLabel
  }
  return task.scopeLabel
}

function formatTaskNo(task: DispatchTask): string {
  return task.taskNo ?? task.taskId
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

function getEffectiveTasks(): DispatchTask[] {
  return listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))
}

function getFilteredRows(keyword: string): DispatchTask[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  const tasks = getEffectiveTasks()

  if (!normalizedKeyword) return tasks

  return tasks.filter((task) => {
    const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
    const scopeLabel = formatScopeLabel(task)

    return (
      task.taskId.toLowerCase().includes(normalizedKeyword) ||
      formatTaskNo(task).toLowerCase().includes(normalizedKeyword) ||
      task.baseTaskId.toLowerCase().includes(normalizedKeyword) ||
      task.processNameZh.toLowerCase().includes(normalizedKeyword) ||
      scopeLabel.toLowerCase().includes(normalizedKeyword) ||
      (task.skuCode ?? '').toLowerCase().includes(normalizedKeyword) ||
      (task.skuColor ?? '').toLowerCase().includes(normalizedKeyword) ||
      task.productionOrderId.toLowerCase().includes(normalizedKeyword) ||
      (order?.legacyOrderNo ?? '').toLowerCase().includes(normalizedKeyword)
    )
  })
}

function getVisibleRows(): DispatchTask[] {
  return getFilteredRows(state.keyword)
}

function getTaskById(taskId: string | null): DispatchTask | null {
  if (!taskId) return null
  return getRuntimeTaskByIdFromStore(taskId)
}

function getDispatchDialogTasks(): DispatchTask[] {
  if (!state.dispatchDialogTaskIds || state.dispatchDialogTaskIds.length === 0) return []

  const selected = new Set(state.dispatchDialogTaskIds)
  return getEffectiveTasks().filter((task) => selected.has(task.taskId))
}

function getTaskAllocatableGroups(task: DispatchTask | null): RuntimeTaskAllocatableGroup[] {
  if (!task) return []
  return listRuntimeTaskAllocatableGroups(task.taskId)
}

function supportsDetailAssignment(task: DispatchTask | null): boolean {
  if (!task) return false
  if ((task.assignmentGranularity ?? 'ORDER') === 'ORDER') return false
  return getTaskAllocatableGroups(task).length > 1
}

function getCreateTenderTask(): DispatchTask | null {
  return getTaskById(state.createTenderTaskId)
}

function getViewTenderTask(): DispatchTask | null {
  return getTaskById(state.viewTenderTaskId)
}

function getPriceSnapshotTask(): DispatchTask | null {
  return getTaskById(state.priceSnapshotTaskId)
}

function getDispatchDialogValidation(tasks: DispatchTask[]): {
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

export {
  appStore,
  applyRuntimeDirectDispatchMeta,
  productionOrders,
  batchDispatchRuntimeTasks,
  batchSetRuntimeTaskAssignMode,
  createRuntimeTaskTenderByDetailGroups,
  dispatchRuntimeTaskByDetailGroups,
  getRuntimeTaskByIdFromStore,
  isRuntimeTaskExecutionTask,
  listRuntimeTaskAllocatableGroups,
  listRuntimeProcessTasks,
  setRuntimeTaskAssignMode,
  upsertRuntimeTaskTender,
  validateRuntimeBatchDispatchSelection,
  initialQualityInspections,
  initialAllocationByTaskId,
  listProgressExceptions,
  listLegacyLikeDyePrintOrdersForTailPages,
  indonesiaFactories,
  escapeHtml,
  toClassName,
  pathZh,
  resultZh,
  resultBadgeClass,
  taskStatusZh,
  colLabel,
  colHeaderColor,
  colBg,
  mockTenders,
  priceStatusLabel,
  priceStatusClass,
  mockStandardPrices,
  candidateFactories,
  state,
  emptyDispatchForm,
  emptyCreateTenderForm,
  nowTimestamp,
  parseDateLike,
  fromDateTimeLocal,
  toDateTimeLocal,
  openAppRoute,
  getMockTender,
  getEffectiveTender,
  hasTender,
  resolveTaskPublishedSam,
  resolveAllocatableGroupPublishedSam,
  formatPublishedSamNumber,
  calcRemaining,
  deriveAssignPath,
  deriveAssignResult,
  deriveKanbanCol,
  getStandardPrice,
  getPriceStatus,
  getDeadlineStatus,
  formatDeadlineBadge,
  formatRemainingTime,
  currentCheckpoint,
  getDyePendingTaskIds,
  getQcPendingOrderIds,
  getExceptionTaskIds,
  isAffectedByTaskSet,
  formatScopeLabel,
  formatTaskNo,
  getFactoryOptions,
  getEffectiveTasks,
  getFilteredRows,
  getVisibleRows,
  getTaskById,
  getDispatchDialogTasks,
  getTaskAllocatableGroups,
  supportsDetailAssignment,
  getCreateTenderTask,
  getViewTenderTask,
  getPriceSnapshotTask,
  getDispatchDialogValidation,
}

export type {
  RuntimeTaskAllocatableGroup,
  RuntimeTaskAllocatableGroupAssignment,
  RuntimeProcessTask,
  ExceptionCase,
  DispatchTask,
  AssignPath,
  AssignResult,
  KanbanCol,
  MockTender,
  LocalTender,
  DispatchPublishedSamSnapshot,
  TenderState,
  CandidateFactory,
  DeadlineStatus,
  PriceStatus,
  DispatchView,
  AssignmentOperateMode,
  DirectDispatchForm,
  CreateTenderForm,
  DispatchBoardState,
}
