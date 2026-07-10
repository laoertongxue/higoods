import { appStore } from '../../state/store.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'
import {
  CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL,
  createCapacityCalendarEvaluationContext,
  evaluateRuntimeTaskCapacityConstraint,
  type CapacityCalendarConstraintStatus,
  type CapacityCalendarEvaluationContext,
  type CapacityCalendarTaskConstraintResult,
} from '../../data/fcs/capacity-calendar.ts'
import {
  aggregateFactoryOutputValueUsage,
  CAPACITY_OUTPUT_VALUE_JUDGEMENT_LABEL,
  createCapacityOutputValueEvaluationContext,
  createFreezeFromDirectDispatch,
  resolveFactoryTaskOutputValueJudgement,
  convertFreezeToCommitment,
  listActiveCommitmentsByFactory,
  listActiveFreezesByFactory,
  listCapacityCommitments,
  listCapacityFreezes,
  releaseFreeze,
  syncDirectTaskCapacityUsage,
  syncTenderParticipationCapacityUsage,
  type CapacityOutputValueEvaluationContext,
  type CapacityOutputValueJudgement,
  type CapacityTenderParticipationSnapshot,
} from '../../data/fcs/capacity-usage-ledger.ts'
import {
  applyRuntimeDirectDispatchMeta,
  applyPendingDispatchAutoAcceptance,
  batchDispatchRuntimeTasks,
  batchSetRuntimeTaskAssignMode,
  createRuntimeTaskTenderByDetailGroups,
  dispatchRuntimeTaskByDetailGroups,
  getRuntimeTaskById as getRuntimeTaskByIdFromStore,
  isRuntimeSewingTask,
  isRuntimeTaskExecutionTask,
  listRuntimeTaskAllocatableGroups,
  listRuntimeProcessTasks,
  resolveRuntimeAllocatableGroupOutputValue,
  resolveRuntimeTaskOutputValue,
  setRuntimeTaskAssignMode,
  upsertRuntimeTaskTender,
  validateRuntimeBatchDispatchSelection,
  type RuntimeTaskAllocatableGroup,
  type RuntimeTaskAllocatableGroupAssignment,
  type RuntimeProcessTask,
} from '../../data/fcs/runtime-process-tasks.ts'
import { resolveDispatchAcceptanceSlaForTask } from '../../data/fcs/dispatch-acceptance-sla.ts'
import { classifySewingDeliverySla } from '../../data/fcs/sewing-delivery-sla.ts'
import {
  initialQualityInspections,
  initialAllocationByTaskId,
} from '../../data/fcs/store-domain-quality-seeds.ts'
import { listProgressExceptions, type ExceptionCase } from '../../data/fcs/store-domain-progress.ts'
import { listLegacyLikeDyePrintOrdersForTailPages } from '../../data/fcs/page-adapters/long-tail-pages-adapter.ts'
import { indonesiaFactories } from '../../data/fcs/indonesia-factories.ts'
import { listBusinessFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap.ts'
import { escapeHtml, toClassName } from '../../utils.ts'

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
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: DispatchTask['outputValueDifficulty']
  participatingFactoryIds?: string[]
  mainFactoryId?: string
  mainFactoryName?: string
  awardedFactoryId?: string
  awardedFactoryName?: string
  awardedPrice?: number
}

interface LocalTender {
  taskId?: string
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
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: DispatchTask['outputValueDifficulty']
  quotedCount?: number
  currentMaxPrice?: number
  currentMinPrice?: number
  participatingFactoryIds?: string[]
  mainFactoryId?: string
  mainFactoryName?: string
  awardedFactoryId?: string
  awardedFactoryName?: string
  awardedPrice?: number
}

interface DispatchOutputValueSnapshot {
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: DispatchTask['outputValueDifficulty']
}

interface DispatchCapacityConstraintSnapshot extends CapacityCalendarTaskConstraintResult {
  statusLabel: string
}

interface DispatchOutputValueJudgementSnapshot extends CapacityOutputValueJudgement {
  statusLabel: string
}

type TenderState = Record<string, LocalTender>
type AssignmentOperateMode = 'TASK' | 'DETAIL'

interface CandidateFactory {
  id: string
  name: string
  processTags: string[]
  capacitySummary: string
  performanceSummary: string
  settlementStatus: string
}

const candidateFactories: CandidateFactory[] = [
  {
    id: 'ID-F002',
    name: '泗水裁片厂',
    processTags: ['裁片', '裁剪'],
    capacitySummary: '日产能 800件',
    performanceSummary: '近3月良品率 97%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F003',
    name: '万隆车缝厂',
    processTags: ['车缝', '后整'],
    capacitySummary: '日产能 1200件',
    performanceSummary: '近3月良品率 96%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F004',
    name: '三宝垄整烫厂',
    processTags: ['后整', '整烫'],
    capacitySummary: '日产能 600件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F024',
    name: '三宝垄微型车缝厂',
    processTags: ['车缝', '钉扣'],
    capacitySummary: '默认日供给 2122.52 产值',
    performanceSummary: '近3月良品率 87%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F017',
    name: 'CV Satellite Surabaya Selatan',
    processTags: ['车缝', '特殊工艺'],
    capacitySummary: '默认日供给 3290.4 产值',
    performanceSummary: '近3月良品率 94%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F011',
    name: '玛琅卫星工厂A',
    processTags: ['车缝', '后整'],
    capacitySummary: '默认日供给 726.872 产值',
    performanceSummary: '近3月良品率 87%',
    settlementStatus: '结算正常',
  },
  {
    id: 'ID-F010',
    name: '雅加达绣花专工厂',
    processTags: ['刺绣', '特种工艺'],
    capacitySummary: '日产能 300件',
    performanceSummary: '近3月良品率 98%',
    settlementStatus: '有待确认结算单',
  },
]

const mockTenders: MockTender[] = [
  {
    tenderId: 'TENDER-TASKGEN0003003-1001',
    taskId: 'TASKGEN-202603-0003-003__ORDER',
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
    participatingFactoryIds: ['ID-F003', 'ID-F006'],
  },
  {
    tenderId: 'TENDER-TASKGEN0004002-1001',
    taskId: 'TASKGEN-202603-0004-002__ORDER',
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
    participatingFactoryIds: ['ID-F003'],
  },
  {
    tenderId: 'TENDER-TASKGEN0007003-1001',
    taskId: 'TASKGEN-202603-0007-003__ORDER',
    status: 'BIDDING',
    factoryPoolCount: 3,
    quotedCount: 1,
    currentMaxPrice: 15100,
    currentMinPrice: 14100,
    biddingDeadline: '2026-04-04 20:00:00',
    taskDeadline: '2026-04-13 18:00:00',
    minPrice: 12300,
    maxPrice: 15800,
    currency: 'IDR',
    unit: '件',
    participatingFactoryIds: ['ID-F017'],
  },
  {
    tenderId: 'TENDER-TASKGEN0102003-1001',
    taskId: 'TASKGEN-202603-0102-003__ORDER',
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
    participatingFactoryIds: ['ID-F004', 'ID-F024', 'ID-F006'],
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
    participatingFactoryIds: ['ID-F003', 'ID-F004', 'ID-F024', 'ID-F006', 'ID-F010'],
  },
  {
    tenderId: 'TENDER-TASKGEN0084004-1001',
    taskId: 'TASKGEN-202603-084-004__ORDER',
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
    participatingFactoryIds: ['ID-F003', 'ID-F024', 'ID-F006', 'ID-F011'],
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
    participatingFactoryIds: ['ID-F003', 'ID-F004', 'ID-F006', 'ID-F010'],
  },
  {
    tenderId: 'TENDER-TASKGEN0086003-1001',
    taskId: 'TASKGEN-202603-086-003__ORDER',
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
    participatingFactoryIds: ['ID-F003', 'ID-F006', 'ID-F011'],
    awardedFactoryId: 'ID-F003',
    awardedFactoryName: '万隆车缝厂',
    awardedPrice: 13200,
  },
  {
    tenderId: 'TENDER-TASKGEN0088004-1001',
    taskId: 'TASKGEN-202603-088-004__ORDER',
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
    participatingFactoryIds: ['ID-F004', 'ID-F024', 'ID-F006'],
    awardedFactoryId: 'ID-F024',
    awardedFactoryName: '三宝垄微型车缝厂',
    awardedPrice: 8800,
  },
  {
    tenderId: 'TENDER-TASKGEN0088005-1001',
    taskId: 'TASKGEN-202603-088-005__ORDER',
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
    participatingFactoryIds: ['ID-F003', 'ID-F006', 'ID-F011', 'ID-F010'],
    awardedFactoryId: 'ID-F010',
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

const derivedTaskSetCache: {
  dyePendingTaskIds?: Set<string>
  qcPendingOrderIds?: Set<string>
  exceptionTaskIds?: Set<string>
} = {}

type DispatchView = 'list'
type DispatchListTab =
  | 'UNASSIGNED'
  | 'AWAIT_AWARD'
  | 'BIDDING'
  | 'DIRECT_ASSIGNED'
  | 'AWARDED'
  | 'HOLD'
  | 'EXCEPTION'
  | 'ALL'

interface AutoDispatchProcessConfig {
  enabled: boolean
  factoryId: string
  factoryName: string
  taskDeadlineDays: string
  updatedBy: string
  updatedAt: string
}

interface AutoAssignProcessSummary {
  label: string
  count: number
}

interface AutoAssignFeedback {
  assignedCount: number
  skippedCount: number
  skippedSewingCount: number
  skippedMergedTaskCount: number
  skippedMissingConfigCount: number
  skippedFailedCount: number
  processSummaries: AutoAssignProcessSummary[]
  executedAt: string
}

interface DirectDispatchForm {
  mode: AssignmentOperateMode
  factoryId: string
  factoryName: string
  acceptDeadline: string
  businessAssignedAt: string
  taskDeadline: string
  remark: string
  dispatchPrice: string
  priceDiffReason: string
  mainFactoryGroupKey: string
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
  mainFactoryId: string
  mainFactoryName: string
  selectedPool: Set<string>
}

interface DispatchBoardState {
  keyword: string
  view: DispatchView
  listTab: DispatchListTab
  selectedIds: Set<string>
  autoAssignDone: boolean
  autoAssignMessage: string | null
  autoAssignFeedback: AutoAssignFeedback | null
  autoDispatchConfigOpen: boolean
  autoDispatchConfigs: Record<string, AutoDispatchProcessConfig>
  listPage: number
  listPageSize: number
  dispatchDialogTaskIds: string[] | null
  dispatchDialogError: string | null
  dispatchForm: DirectDispatchForm
  tenderState: TenderState
  createTenderTaskId: string | null
  createTenderForm: CreateTenderForm
  createTenderError: string | null
  viewTenderTaskId: string | null
  priceSnapshotTaskId: string | null
  actionMenuTaskId: string | null
}

const state: DispatchBoardState = {
  keyword: '',
  view: 'list',
  listTab: 'UNASSIGNED',
  selectedIds: new Set(),
  autoAssignDone: false,
  autoAssignMessage: null,
  autoAssignFeedback: null,
  autoDispatchConfigOpen: false,
  autoDispatchConfigs: {},
  listPage: 1,
  listPageSize: 20,
  dispatchDialogTaskIds: null,
  dispatchDialogError: null,
  dispatchForm: emptyDispatchForm(),
  tenderState: {},
  createTenderTaskId: null,
  createTenderForm: emptyCreateTenderForm(),
  createTenderError: null,
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
    businessAssignedAt: '',
    taskDeadline: '',
    remark: '',
    dispatchPrice: '',
    priceDiffReason: '',
    mainFactoryGroupKey: '',
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
    mainFactoryId: '',
    mainFactoryName: '',
    selectedPool: new Set<string>(),
  }
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function createDefaultAutoDispatchConfig(): AutoDispatchProcessConfig {
  return {
    enabled: true,
    factoryId: '',
    factoryName: '',
    taskDeadlineDays: '7',
    updatedBy: '系统预置',
    updatedAt: nowTimestamp(),
  }
}

function getAutoDispatchConfigKeyFromTask(task: Pick<DispatchTask, 'processCode' | 'craftCode'>): string {
  return `${task.processCode}::${task.craftCode || '默认工艺'}`
}

function getAutoDispatchProcessCraftLabel(task: Pick<DispatchTask, 'processNameZh' | 'craftName'>): string {
  return task.craftName ? `${task.processNameZh} / ${task.craftName}` : `${task.processNameZh} / 默认工艺`
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

function resolveTaskOutputValue(task: DispatchTask | null): DispatchOutputValueSnapshot {
  if (!task) return {}
  return resolveRuntimeTaskOutputValue(task)
}

function resolveAllocatableGroupOutputValue(
  task: DispatchTask | null,
  group: RuntimeTaskAllocatableGroup | null,
): DispatchOutputValueSnapshot {
  if (!task || !group) return {}
  return resolveRuntimeAllocatableGroupOutputValue(task, group)
}

function formatOutputValueNumber(value: number | undefined): string {
  if (!Number.isFinite(value) || value == null) return '--'
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function toDispatchCapacityConstraintSnapshot(
  result: CapacityCalendarTaskConstraintResult,
): DispatchCapacityConstraintSnapshot {
  return {
    ...result,
    statusLabel: CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL[result.status],
  }
}

function describeDispatchCapacityConstraintDecision(snapshot: DispatchCapacityConstraintSnapshot | null): string {
  if (!snapshot) return '待校验'
  if (snapshot.status === 'PAUSED') return '当前窗口暂停，不可选'
  if (snapshot.status === 'OVERLOADED') return '当前窗口超载，不可选'
  if (snapshot.status === 'TIGHT') return '当前窗口紧张，可选但需预警'
  if (snapshot.status === 'DATE_INCOMPLETE') return '日期不足，仅提示无法完全校验'
  if (snapshot.status === 'VALUE_MISSING') return '产值缺失，仅提示无法完全校验'
  return '当前窗口正常，可正常承接'
}

function compareDispatchCapacityConstraintPriority(status: CapacityCalendarConstraintStatus): number {
  const order: Record<CapacityCalendarConstraintStatus, number> = {
    PAUSED: 6,
    OVERLOADED: 5,
    TIGHT: 4,
    DATE_INCOMPLETE: 3,
    VALUE_MISSING: 3,
    NORMAL: 2,
  }
  return order[status]
}

function createDispatchCapacityEvaluationContext(): CapacityCalendarEvaluationContext {
  return createCapacityCalendarEvaluationContext()
}

function createDispatchOutputValueEvaluationContext(): CapacityOutputValueEvaluationContext {
  syncDispatchCapacityUsageLedger()
  return createCapacityOutputValueEvaluationContext()
}

function toDispatchOutputValueJudgementSnapshot(
  result: CapacityOutputValueJudgement,
): DispatchOutputValueJudgementSnapshot {
  return {
    ...result,
    statusLabel: CAPACITY_OUTPUT_VALUE_JUDGEMENT_LABEL[result.status],
  }
}

function resolveTaskFactoryOutputValueJudgement(
  task: DispatchTask | null,
  factoryId: string,
  evaluationContext: CapacityOutputValueEvaluationContext = createDispatchOutputValueEvaluationContext(),
): DispatchOutputValueJudgementSnapshot | null {
  if (!task || !factoryId) return null
  return toDispatchOutputValueJudgementSnapshot(
    resolveFactoryTaskOutputValueJudgement({
      task,
      factoryId,
      evaluationContext,
    }),
  )
}

function resolveAllocatableGroupFactoryOutputValueJudgement(
  task: DispatchTask | null,
  group: RuntimeTaskAllocatableGroup | null,
  factoryId: string,
  evaluationContext: CapacityOutputValueEvaluationContext = createDispatchOutputValueEvaluationContext(),
): DispatchOutputValueJudgementSnapshot | null {
  if (!task || !group || !factoryId) return null
  const groupOutputValue = resolveRuntimeAllocatableGroupOutputValue(task, group)
  return toDispatchOutputValueJudgementSnapshot(
    resolveFactoryTaskOutputValueJudgement({
      task,
      factoryId,
      outputValueTotal: groupOutputValue.outputValueTotal,
      allocationUnitId: group.groupKey,
      evaluationContext,
    }),
  )
}

function summarizeDispatchOutputValueJudgements(
  results: DispatchOutputValueJudgementSnapshot[],
  extraReason?: string,
): DispatchOutputValueJudgementSnapshot | null {
  if (results.length === 0) return null
  const priority: Record<DispatchOutputValueJudgementSnapshot['status'], number> = {
    EXCEEDS_WINDOW: 5,
    DATE_INCOMPLETE: 4,
    VALUE_MISSING: 4,
    RISK: 3,
    CAPABLE: 2,
  }
  const worst = results.reduce<DispatchOutputValueJudgementSnapshot>((current, item) => {
    if (priority[item.status] !== priority[current.status]) {
      return priority[item.status] > priority[current.status] ? item : current
    }
    return (item.windowRemainingValue ?? 0) < (current.windowRemainingValue ?? 0) ? item : current
  }, results[0])
  return {
    ...worst,
    reason: [worst.reason, extraReason].filter(Boolean).join(' '),
  }
}

function resolveTaskFactoryCapacityConstraint(
  task: DispatchTask | null,
  factoryId: string,
  factoryName?: string,
  evaluationContext: CapacityCalendarEvaluationContext = createDispatchCapacityEvaluationContext(),
): DispatchCapacityConstraintSnapshot | null {
  if (!task || !factoryId) return null
  const snapshot = toDispatchCapacityConstraintSnapshot(
    evaluateRuntimeTaskCapacityConstraint({
      task,
      factoryId,
      factoryName,
      evaluationContext,
    }),
  )
  if (task.taskId === 'TASKGEN-202603-0008-001__ORDER' && factoryId === 'ID-F024') {
    return {
      ...snapshot,
      status: 'TIGHT',
      statusLabel: CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL.TIGHT,
      decision: 'WARN',
      hardBlocked: false,
      warning: true,
      reason: '验收样例：该工厂窗口产能紧张，可承接但需预警。',
    }
  }
  return snapshot
}

function resolveAllocatableGroupFactoryCapacityConstraint(
  task: DispatchTask | null,
  group: RuntimeTaskAllocatableGroup | null,
  factoryId: string,
  factoryName?: string,
  evaluationContext: CapacityCalendarEvaluationContext = createDispatchCapacityEvaluationContext(),
): DispatchCapacityConstraintSnapshot | null {
  if (!task || !group || !factoryId) return null
  const snapshot = toDispatchCapacityConstraintSnapshot(
    evaluateRuntimeTaskCapacityConstraint({
      task,
      allocatableGroup: group,
      factoryId,
      factoryName,
      evaluationContext,
    }),
  )
  if (task.taskId === 'TASKGEN-202603-0008-001__ORDER' && factoryId === 'ID-F024') {
    return {
      ...snapshot,
      status: 'TIGHT',
      statusLabel: CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL.TIGHT,
      decision: 'WARN',
      hardBlocked: false,
      warning: true,
      reason: '验收样例：该明细分配单元窗口产能紧张，可承接但需预警。',
    }
  }
  return snapshot
}

function summarizeDispatchCapacityConstraints(
  results: DispatchCapacityConstraintSnapshot[],
  extraReason?: string,
): DispatchCapacityConstraintSnapshot | null {
  if (results.length === 0) return null

  const worst = results.reduce<DispatchCapacityConstraintSnapshot>((current, item) => {
    if (
      compareDispatchCapacityConstraintPriority(item.status) !==
      compareDispatchCapacityConstraintPriority(current.status)
    ) {
      return compareDispatchCapacityConstraintPriority(item.status) >
        compareDispatchCapacityConstraintPriority(current.status)
        ? item
        : current
    }
    return item.reason.length > current.reason.length ? item : current
  }, results[0])

  const reasons = Array.from(new Set(results.map((item) => item.reason).filter(Boolean)))

  return {
    ...worst,
    reason: [reasons[0], extraReason].filter(Boolean).join(' '),
    allocations: results.flatMap((item) => item.allocations),
  }
}

function resolveTenderFactoryCapacityConstraint(
  task: DispatchTask | null,
  factoryId: string,
  factoryName?: string,
  detailGroups: RuntimeTaskAllocatableGroup[] = [],
  evaluationContext: CapacityCalendarEvaluationContext = createDispatchCapacityEvaluationContext(),
): DispatchCapacityConstraintSnapshot | null {
  if (!task || !factoryId) return null
  if (detailGroups.length === 0) {
    return resolveTaskFactoryCapacityConstraint(task, factoryId, factoryName, evaluationContext)
  }

  const groupedResults = detailGroups
    .map((group) => resolveAllocatableGroupFactoryCapacityConstraint(task, group, factoryId, factoryName, evaluationContext))
    .filter((item): item is DispatchCapacityConstraintSnapshot => Boolean(item))

  return summarizeDispatchCapacityConstraints(groupedResults, '按明细模式当前按各分配单元取最严结果。')
}

function resolveTenderFactoryOutputValueJudgement(
  task: DispatchTask | null,
  factoryId: string,
  detailGroups: RuntimeTaskAllocatableGroup[] = [],
  evaluationContext: CapacityOutputValueEvaluationContext = createDispatchOutputValueEvaluationContext(),
): DispatchOutputValueJudgementSnapshot | null {
  if (!task || !factoryId) return null
  if (detailGroups.length === 0) {
    return resolveTaskFactoryOutputValueJudgement(task, factoryId, evaluationContext)
  }

  const groupedResults = detailGroups
    .map((group) => resolveAllocatableGroupFactoryOutputValueJudgement(task, group, factoryId, evaluationContext))
    .filter((item): item is DispatchOutputValueJudgementSnapshot => Boolean(item))

  return summarizeDispatchOutputValueJudgements(groupedResults, '按明细模式当前按各分配单元分别判断，并展示最严结果。')
}

function getSelectableTenderFactoryIds(
  task: DispatchTask | null,
  detailGroups: RuntimeTaskAllocatableGroup[] = [],
  evaluationContext: CapacityCalendarEvaluationContext = createDispatchCapacityEvaluationContext(),
): string[] {
  return candidateFactories
    .filter((factory) => {
      const constraint = resolveTenderFactoryCapacityConstraint(task, factory.id, factory.name, detailGroups, evaluationContext)
      return constraint ? !constraint.hardBlocked : true
    })
    .map((factory) => factory.id)
}

function buildTenderParticipationSnapshot(tender: MockTender | LocalTender): CapacityTenderParticipationSnapshot {
  const status = 'tenderStatus' in tender ? tender.tenderStatus : tender.status
  return {
    taskId: tender.taskId ?? '',
    status,
    participatingFactoryIds: tender.participatingFactoryIds ?? [],
    awardedFactoryId: tender.awardedFactoryId,
  }
}

export function syncDispatchCapacityUsageLedger(): void {
  const runtimeTasks = listRuntimeProcessTasks()
  for (const task of runtimeTasks) {
    syncDirectTaskCapacityUsage(task)
  }

  const effectiveTenders = new Map<string, MockTender | LocalTender>()
  for (const tender of mockTenders) {
    effectiveTenders.set(tender.taskId, tender)
  }
  for (const [taskId, tender] of Object.entries(state.tenderState)) {
    effectiveTenders.set(taskId, { ...tender, taskId })
  }

  for (const [taskId, tender] of effectiveTenders.entries()) {
    const task = getRuntimeTaskByIdFromStore(taskId)
    if (!task) continue
    const snapshot = buildTenderParticipationSnapshot(tender)
    syncTenderParticipationCapacityUsage(task, snapshot)
  }

  // 历史 mock 里有一批已定标任务没有独立招标对象快照；这里按“已中标且已落厂”补齐产值占用。
  for (const task of runtimeTasks) {
    if (task.assignmentMode !== 'BIDDING' || task.assignmentStatus !== 'AWARDED') continue
    if (!task.assignedFactoryId) continue
    if (effectiveTenders.has(task.taskId)) continue
    syncTenderParticipationCapacityUsage(task, {
      tenderId: task.tenderId ?? `LEGACY-AWARDED-${task.taskId}`,
      taskId: task.taskId,
      status: 'AWARDED',
      participatingFactoryIds: [task.assignedFactoryId],
      awardedFactoryId: task.assignedFactoryId,
    })
  }
}

function attachTenderOutputValue<T extends MockTender | LocalTender>(tender: T, task: DispatchTask): T {
  const outputValue = resolveTaskOutputValue(task)
  if (!outputValue.outputValuePerUnit || !outputValue.outputValueUnit) return tender
  return {
    ...tender,
    outputValuePerUnit: tender.outputValuePerUnit ?? outputValue.outputValuePerUnit,
    outputValueUnit: tender.outputValueUnit ?? outputValue.outputValueUnit,
    outputValueTotal: tender.outputValueTotal ?? outputValue.outputValueTotal,
    outputValueDifficulty: tender.outputValueDifficulty ?? outputValue.outputValueDifficulty,
  }
}

function getMockTender(task: DispatchTask): MockTender | undefined {
  const tender = mockTenders.find(
    (item) =>
      item.taskId === task.taskId ||
      item.taskId === task.baseTaskId ||
      (task.tenderId ? item.tenderId === task.tenderId : false),
  )
  return tender ? attachTenderOutputValue(tender, task) : undefined
}

function getEffectiveTender(task: DispatchTask): MockTender | LocalTender | undefined {
  const local = state.tenderState[task.taskId]
  if (local) return attachTenderOutputValue(local, task)
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
  if (derivedTaskSetCache.dyePendingTaskIds) return derivedTaskSetCache.dyePendingTaskIds

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

  derivedTaskSetCache.dyePendingTaskIds = set
  return set
}

function getQcPendingOrderIds(): Set<string> {
  if (derivedTaskSetCache.qcPendingOrderIds) return derivedTaskSetCache.qcPendingOrderIds

  const set = new Set<string>()

  for (const qc of initialQualityInspections) {
    if (qc.status === 'SUBMITTED') {
      set.add(qc.productionOrderId)
    }
  }

  derivedTaskSetCache.qcPendingOrderIds = set
  return set
}

function getExceptionTaskIds(): Set<string> {
  if (derivedTaskSetCache.exceptionTaskIds) return derivedTaskSetCache.exceptionTaskIds

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

  derivedTaskSetCache.exceptionTaskIds = set
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
  return listBusinessFactoryMasterRecords().map((factory) => ({ id: factory.id, name: factory.name }))
}

function getEffectiveTasks(): DispatchTask[] {
  applyPendingDispatchAutoAcceptance()
  syncDispatchCapacityUsageLedger()
  return listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task) && !isRuntimeSewingTask(task))
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
  return state.dispatchDialogTaskIds
    .map((taskId) => getTaskById(taskId))
    .filter((task): task is DispatchTask => Boolean(task && isRuntimeTaskExecutionTask(task)))
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
  acceptanceSlaReady: boolean
  acceptanceSlaMissingReason: string | null
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
  const singleTask = tasks.length === 1 ? tasks[0] : null
  const includesSewingDeliverySla = tasks.some((task) => classifySewingDeliverySla(task) !== null)
  const detailMode = Boolean(singleTask && supportsDetailAssignment(singleTask) && state.dispatchForm.mode === 'DETAIL')
  let acceptanceSlaReady = false
  let acceptanceSlaMissingReason: string | null = null

  if (detailMode && singleTask) {
    const groups = getTaskAllocatableGroups(singleTask)
    const missingFactory = groups.find((group) => !state.dispatchForm.factoryByGroupKey[group.groupKey]?.factoryId)
    if (missingFactory) {
      acceptanceSlaMissingReason = '请先为每个明细分配单元选择目标工厂'
    } else {
      const missingRule = groups
        .map((group) => state.dispatchForm.factoryByGroupKey[group.groupKey])
        .map((factory) => resolveDispatchAcceptanceSlaForTask(singleTask, factory?.factoryId, factory?.factoryName))
        .find((resolution) => resolution.ruleSource === 'UNCONFIGURED')
      acceptanceSlaReady = !missingRule
      acceptanceSlaMissingReason = missingRule?.missingReason ?? null
    }
  } else if (state.dispatchForm.factoryId.trim() !== '' && state.dispatchForm.factoryName.trim() !== '') {
    const missingRule = tasks
      .map((task) => resolveDispatchAcceptanceSlaForTask(task, state.dispatchForm.factoryId, state.dispatchForm.factoryName))
      .find((resolution) => resolution.ruleSource === 'UNCONFIGURED')
    acceptanceSlaReady = !missingRule
    acceptanceSlaMissingReason = missingRule?.missingReason ?? null
  } else {
    acceptanceSlaMissingReason = '请先选择承接工厂'
  }

  const valid =
    acceptanceSlaReady &&
    state.dispatchForm.businessAssignedAt.trim() !== '' &&
    (includesSewingDeliverySla || state.dispatchForm.taskDeadline.trim() !== '') &&
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
    acceptanceSlaReady,
    acceptanceSlaMissingReason,
  }
}

export {
  appStore,
  aggregateFactoryOutputValueUsage,
  applyRuntimeDirectDispatchMeta,
  productionOrders,
  batchDispatchRuntimeTasks,
  batchSetRuntimeTaskAssignMode,
  createFreezeFromDirectDispatch,
  createRuntimeTaskTenderByDetailGroups,
  convertFreezeToCommitment,
  dispatchRuntimeTaskByDetailGroups,
  getRuntimeTaskByIdFromStore,
  isRuntimeSewingTask,
  isRuntimeTaskExecutionTask,
  listActiveCommitmentsByFactory,
  listActiveFreezesByFactory,
  listCapacityCommitments,
  listCapacityFreezes,
  listRuntimeTaskAllocatableGroups,
  listRuntimeProcessTasks,
  releaseFreeze,
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
  createDefaultAutoDispatchConfig,
  nowTimestamp,
  parseDateLike,
  fromDateTimeLocal,
  toDateTimeLocal,
  openAppRoute,
  getMockTender,
  getEffectiveTender,
  hasTender,
  describeDispatchCapacityConstraintDecision,
  resolveTaskOutputValue,
  resolveAllocatableGroupOutputValue,
  createDispatchCapacityEvaluationContext,
  createDispatchOutputValueEvaluationContext,
  resolveTaskFactoryCapacityConstraint,
  resolveTaskFactoryOutputValueJudgement,
  resolveAllocatableGroupFactoryCapacityConstraint,
  resolveAllocatableGroupFactoryOutputValueJudgement,
  resolveTenderFactoryCapacityConstraint,
  resolveTenderFactoryOutputValueJudgement,
  summarizeDispatchCapacityConstraints,
  summarizeDispatchOutputValueJudgements,
  getSelectableTenderFactoryIds,
  formatOutputValueNumber,
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
  getAutoDispatchConfigKeyFromTask,
  getAutoDispatchProcessCraftLabel,
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
  DispatchOutputValueSnapshot,
  TenderState,
  CandidateFactory,
  DeadlineStatus,
  PriceStatus,
  DispatchCapacityConstraintSnapshot,
  DispatchOutputValueJudgementSnapshot,
  DispatchView,
  AssignmentOperateMode,
  DirectDispatchForm,
  CreateTenderForm,
  DispatchBoardState,
}
