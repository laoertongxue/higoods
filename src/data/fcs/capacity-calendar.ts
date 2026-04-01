import {
  listCapacityCalendarOverrides,
  type CapacityCalendarOverrideRecord,
} from './capacity-calendar-overrides'
import {
  CAPACITY_TIGHT_THRESHOLD_RATIO,
  calculateCapacityRemainingStandardHours,
} from './capacity-rules'
import {
  createCapacityStandardTimeEvaluationContext,
  listCapacityCommitments,
  listCapacityFreezes,
  resolveCapacityStandardTimeWindow,
  resolveFactoryTaskStandardTimeJudgement,
  type CapacityStandardTimeEvaluationContext,
  type CapacityCommitment,
  type CapacityFreeze,
} from './capacity-usage-ledger'
import {
  computeFactoryCapacityEntryResult,
  listFactoryCapacityEntries,
} from './factory-capacity-profile-mock'
import {
  getFactoryMasterRecordById,
  listFactoryMasterRecords,
} from './factory-master-store'
import {
  listRuntimeExecutionTasks,
  resolveRuntimeAllocatableGroupPublishedSam,
  resolveRuntimeTaskPublishedSam,
  type RuntimeProcessTask,
  type RuntimeTaskAllocatableGroup,
} from './runtime-process-tasks'
import { productionOrders } from './production-orders'

export type CapacityCalendarStatus = 'NORMAL' | 'TIGHT' | 'OVERLOADED' | 'PAUSED'
export type CapacityCalendarConstraintStatus = CapacityCalendarStatus | 'DATE_INCOMPLETE' | 'SAM_MISSING'

export const CAPACITY_CALENDAR_STATUS_LABEL: Record<CapacityCalendarStatus, string> = {
  NORMAL: '正常',
  TIGHT: '紧张',
  OVERLOADED: '超载',
  PAUSED: '暂停',
}

export const CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL: Record<CapacityCalendarConstraintStatus, string> = {
  ...CAPACITY_CALENDAR_STATUS_LABEL,
  DATE_INCOMPLETE: '日期不足',
  SAM_MISSING: '工时缺失',
}

export interface CapacityCalendarSummary {
  supplyTotal: number
  committedTotal: number
  frozenTotal: number
  remainingTotal: number
  unallocatedTotal: number
  unscheduledTotal: number
  missingSamCount: number
}

export interface CapacityCalendarComparisonRow {
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  baseSupplySam: number
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
  overload: boolean
  status: CapacityCalendarStatus
  statusReason: string
  taskCount: number
  taskIds: string[]
  committedTaskIds: string[]
  frozenTaskIds: string[]
  commitmentCount: number
  freezeCount: number
  pauseOverrideId?: string
  pauseOverrideNote?: string
  pauseScopeLabel?: string
}

export interface CapacityCalendarUnallocatedRow {
  date: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  demandSam: number
  taskCount: number
  assignmentStatuses: string[]
  taskIds: string[]
}

export interface CapacityCalendarUnscheduledRow {
  taskId: string
  productionOrderId: string
  demandType: '已占用需求' | '已冻结需求' | '待分配需求'
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  standardSamTotal: number
  assignmentStatus: string
  assignmentMode: string
  factoryName: string
  reason: string
}

export interface CapacityCalendarMissingSamRow {
  taskId: string
  productionOrderId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  reason: string
}

export interface CapacityCalendarOverrideRow {
  id: string
  factoryId: string
  factoryName: string
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  scopeLabel: string
  startDate: string
  endDate: string
  overrideType: 'PAUSE'
  reason: string
  note: string
}

export interface CapacityCalendarData {
  summary: CapacityCalendarSummary
  displayDates: string[]
  comparisonRows: CapacityCalendarComparisonRow[]
  unallocatedRows: CapacityCalendarUnallocatedRow[]
  unscheduledRows: CapacityCalendarUnscheduledRow[]
  missingSamRows: CapacityCalendarMissingSamRow[]
  pauseOverrideRows: CapacityCalendarOverrideRow[]
  singleDatePriority: string[]
  windowPriority: {
    start: string[]
    end: string[]
  }
}

export interface CapacityCalendarEvaluationContext {
  calendarData: CapacityCalendarData
  comparisonRowMap: Map<string, CapacityCalendarComparisonRow>
}

export interface CapacityCalendarTaskConstraintAllocation {
  date: string
  baseSupplySam: number
  supplySam: number
  committedSam: number
  proposedDemandSam: number
  projectedCommittedSam: number
  projectedRemainingSam: number
  status: CapacityCalendarStatus
  reason: string
  pauseOverrideId?: string
}

export interface CapacityCalendarTaskConstraintResult {
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  status: CapacityCalendarConstraintStatus
  decision: 'ALLOW' | 'WARN' | 'BLOCK'
  hardBlocked: boolean
  warning: boolean
  dateIncomplete: boolean
  usesParentWindow: boolean
  reason: string
  allocations: CapacityCalendarTaskConstraintAllocation[]
}

export type FactoryCalendarWindowDays = 7 | 15 | 30

export interface FactoryCalendarFactoryOption {
  id: string
  code: string
  name: string
  label: string
}

export interface FactoryCalendarProcessOption {
  processCode: string
  processName: string
}

export interface FactoryCalendarCraftOption {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
}

export interface FactoryCalendarWindowOption {
  value: FactoryCalendarWindowDays
  label: string
}

export interface FactoryCalendarSourceRow {
  id: string
  sourceKind: 'COMMITTED' | 'FROZEN'
  sourceKindLabel: '已占用' | '已冻结'
  sourceType: CapacityFreeze['sourceType'] | CapacityCommitment['sourceType']
  sourceTypeLabel: string
  factoryId: string
  factoryName: string
  taskId: string
  productionOrderId: string
  standardSamTotal: number
  dailySam: number
  windowStartDate?: string
  windowEndDate?: string
  windowText: string
  objectType: '整任务' | '明细'
  allocationUnitId?: string
  note: string
}

export interface FactoryCalendarRow {
  rowKey: string
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
  committedTaskCount: number
  frozenTaskCount: number
  committedSources: FactoryCalendarSourceRow[]
  frozenSources: FactoryCalendarSourceRow[]
}

export interface FactoryCalendarSummary {
  supplyTotal: number
  committedTotal: number
  frozenTotal: number
  remainingTotal: number
  craftCount: number
  taskCount: number
}

export interface FactoryCalendarData {
  factoryOptions: FactoryCalendarFactoryOption[]
  processOptions: FactoryCalendarProcessOption[]
  craftOptions: FactoryCalendarCraftOption[]
  windowOptions: FactoryCalendarWindowOption[]
  selectedFactoryId: string
  selectedFactoryName: string
  selectedProcessCode?: string
  selectedCraftCode?: string
  windowDays: FactoryCalendarWindowDays
  dates: string[]
  rows: FactoryCalendarRow[]
  summary: FactoryCalendarSummary
  countRuleNote: string
}

export type TaskSamRiskConclusion = 'CAPABLE' | 'TIGHT' | 'EXCEEDS_WINDOW' | 'UNALLOCATED' | 'UNSCHEDULED'

export const TASK_SAM_RISK_CONCLUSION_LABEL: Record<TaskSamRiskConclusion, string> = {
  CAPABLE: '可承载',
  TIGHT: '紧张',
  EXCEEDS_WINDOW: '超出窗口',
  UNALLOCATED: '未落厂',
  UNSCHEDULED: '未排期',
}

export interface CapacityRiskFilterOption {
  value: string
  label: string
}

export interface CapacityRiskTaskRow {
  taskId: string
  productionOrderId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId?: string
  factoryName?: string
  factoryBindingKind: 'COMMITTED' | 'FROZEN' | 'UNALLOCATED'
  totalStandardTime: number
  windowStartDate?: string
  windowEndDate?: string
  windowText: string
  windowDays: number
  windowSupplySam?: number
  otherCommittedSam?: number
  otherFrozenSam?: number
  remainingAfterCurrentSam?: number
  conclusion: TaskSamRiskConclusion
  conclusionLabel: string
  reason: string
  usesFallbackRule: boolean
  fallbackRuleLabel?: string
  taskStatus: string
}

export interface CapacityRiskOrderRow {
  productionOrderId: string
  totalStandardTime: number
  allocatedStandardTime: number
  unallocatedStandardTime: number
  unscheduledStandardTime: number
  taskCount: number
  highestRiskConclusion: TaskSamRiskConclusion
  highestRiskConclusionLabel: string
  mainRiskProcessName?: string
  mainRiskCraftName?: string
  reason: string
}

export interface CapacityRiskSummary {
  capableCount: number
  tightCount: number
  exceedsWindowCount: number
  unallocatedCount: number
  unscheduledCount: number
}

export interface CapacityRiskData {
  taskRows: CapacityRiskTaskRow[]
  orderRows: CapacityRiskOrderRow[]
  processOptions: CapacityRiskFilterOption[]
  craftOptions: Array<CapacityRiskFilterOption & { processCode: string }>
  conclusionOptions: CapacityRiskFilterOption[]
  windowOptions: FactoryCalendarWindowOption[]
  summary: CapacityRiskSummary
}

export type CapacityBottleneckTab = 'craft' | 'date' | 'demand'

export interface CapacityBottleneckCraftDetailDateRow {
  date: string
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
}

export interface CapacityBottleneckCraftDetailFactoryRow {
  factoryId: string
  factoryName: string
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
}

export interface CapacityBottleneckCraftRow {
  rowKey: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  windowSupplySam: number
  windowCommittedSam: number
  windowFrozenSam: number
  windowRemainingSam: number
  overloadDayCount: number
  factoryCount: number
  unallocatedSam: number
  unscheduledSam: number
  maxGapSam: number
  dateRows: CapacityBottleneckCraftDetailDateRow[]
  factoryRows: CapacityBottleneckCraftDetailFactoryRow[]
}

export interface CapacityBottleneckDateDetailRow {
  rowKey: string
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
  committedTaskCount: number
  frozenTaskCount: number
}

export interface CapacityBottleneckDateRow {
  date: string
  supplySam: number
  committedSam: number
  frozenSam: number
  remainingSam: number
  overloadedFactoryCount: number
  overloadedCraftCount: number
  unallocatedSam: number
  maxGapSam: number
  detailRows: CapacityBottleneckDateDetailRow[]
}

export interface CapacityBottleneckUnallocatedTaskRow {
  taskId: string
  productionOrderId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  totalStandardTime: number
  windowStartDate?: string
  windowEndDate?: string
  windowText: string
  assignmentStatus: string
  assignmentStatusLabel: string
  frozenFactoryCount: number
  note: string
}

export interface CapacityBottleneckUnscheduledTaskRow {
  taskId: string
  productionOrderId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  totalStandardTime: number
  assignmentStatus: string
  assignmentStatusLabel: string
  reason: string
  note: string
}

export interface CapacityBottleneckSummary {
  bottleneckCraftCount: number
  overloadedDateCount: number
  unallocatedTotal: number
  unscheduledTotal: number
  maxDailyGapSam: number
  maxCraftGapSam: number
}

export interface CapacityBottleneckData {
  craftRows: CapacityBottleneckCraftRow[]
  dateRows: CapacityBottleneckDateRow[]
  unallocatedRows: CapacityBottleneckUnallocatedTaskRow[]
  unscheduledRows: CapacityBottleneckUnscheduledTaskRow[]
  processOptions: CapacityRiskFilterOption[]
  craftOptions: Array<CapacityRiskFilterOption & { processCode: string }>
  windowOptions: FactoryCalendarWindowOption[]
  windowDays: FactoryCalendarWindowDays
  summary: CapacityBottleneckSummary
}

type DateCandidate = {
  field: string
  label: string
  value: string | undefined
}

interface TaskDemandIdentity {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
}

interface TaskScheduleResolution {
  kind: 'WINDOW' | 'SINGLE' | 'UNSCHEDULED'
  allocations: Array<{ date: string; demandSam: number }>
  reason?: string
}

interface UsageDailyRowSeed {
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  baseSupplySam: number
  supplySam: number
  committedSam: number
  frozenSam: number
  committedTaskIds: string[]
  frozenTaskIds: string[]
  taskIds: string[]
}

interface FactoryCalendarRowSeed {
  rowKey: string
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  supplySam: number
  committedSam: number
  frozenSam: number
  committedSources: FactoryCalendarSourceRow[]
  frozenSources: FactoryCalendarSourceRow[]
  committedObjectKeys: Set<string>
  frozenObjectKeys: Set<string>
}

interface TaskRiskFactoryBinding {
  kind: 'COMMITTED' | 'FROZEN' | 'UNALLOCATED'
  factoryId?: string
  factoryName?: string
  reason?: string
}

interface BottleneckDailyRowSeed {
  rowKey: string
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  supplySam: number
  committedSam: number
  frozenSam: number
  committedTaskIds: Set<string>
  frozenTaskIds: Set<string>
}

interface CapacityBottleneckDraftData {
  craftRows: CapacityBottleneckCraftRow[]
  dateRows: CapacityBottleneckDateRow[]
  unallocatedRows: CapacityBottleneckUnallocatedTaskRow[]
  unscheduledRows: CapacityBottleneckUnscheduledTaskRow[]
  processOptions: CapacityRiskFilterOption[]
  craftOptions: Array<CapacityRiskFilterOption & { processCode: string }>
  summary: CapacityBottleneckSummary
}

interface PauseOverrideHit {
  id: string
  note: string
  scopeLabel: string
}

const ROUND_PRECISION = 1000
const UNALLOCATED_ASSIGNMENT_STATUSES = new Set(['UNASSIGNED', 'BIDDING', 'AWAIT_AWARD', 'HOLD'])
const FACTORY_CALENDAR_WINDOW_OPTIONS: FactoryCalendarWindowOption[] = [
  { value: 7, label: '未来 7 天' },
  { value: 15, label: '未来 15 天' },
  { value: 30, label: '未来 30 天' },
]
const TASK_RISK_CONCLUSION_OPTIONS: CapacityRiskFilterOption[] = [
  { value: '', label: '全部风险结论' },
  { value: 'CAPABLE', label: TASK_SAM_RISK_CONCLUSION_LABEL.CAPABLE },
  { value: 'TIGHT', label: TASK_SAM_RISK_CONCLUSION_LABEL.TIGHT },
  { value: 'EXCEEDS_WINDOW', label: TASK_SAM_RISK_CONCLUSION_LABEL.EXCEEDS_WINDOW },
  { value: 'UNALLOCATED', label: TASK_SAM_RISK_CONCLUSION_LABEL.UNALLOCATED },
  { value: 'UNSCHEDULED', label: TASK_SAM_RISK_CONCLUSION_LABEL.UNSCHEDULED },
]
const CAPACITY_USAGE_SOURCE_LABEL: Record<CapacityFreeze['sourceType'] | CapacityCommitment['sourceType'], string> = {
  DIRECT_PENDING_ACCEPT: '直接派单待接单',
  TENDER_PARTICIPATING: '招标参与中',
  DIRECT_ACCEPTED: '直接派单已接单',
  TENDER_AWARDED: '招标已中标',
}

const WINDOW_START_CANDIDATES: Array<{ field: keyof RuntimeProcessTask; label: string }> = [
  { field: 'startDueAt', label: '开始日期' },
  { field: 'awardedAt', label: '定标时间（兼容兜底）' },
  { field: 'dispatchedAt', label: '派单时间（兼容兜底）' },
]

const WINDOW_END_CANDIDATES: Array<{ field: keyof RuntimeProcessTask; label: string }> = [
  { field: 'taskDeadline', label: '任务截止日期' },
]

const SINGLE_DATE_CANDIDATES: Array<{ field: keyof RuntimeProcessTask; label: string }> = [
  { field: 'taskDeadline', label: '任务截止日期' },
  { field: 'startDueAt', label: '开始日期' },
  { field: 'acceptDeadline', label: '接单截止日期' },
  { field: 'biddingDeadline', label: '招标截止日期' },
]

function roundSam(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * ROUND_PRECISION) / ROUND_PRECISION
}

function parseDateLike(value: string | undefined): Date | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDateKey(value?: string): string {
  if (!value) return ''
  return formatDateKey(toDayStart(parseDateLike(value) ?? new Date(value)))
}

function listDatesBetween(start: Date, end: Date): string[] {
  const results: string[] = []
  const cursor = toDayStart(start)
  const endAt = toDayStart(end).getTime()

  while (cursor.getTime() <= endAt) {
    results.push(formatDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return results
}

function fallbackDisplayDates(): string[] {
  const today = toDayStart(new Date())
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(today)
    current.setDate(today.getDate() + index)
    return formatDateKey(current)
  })
}

function pickFirstValidDate(
  task: RuntimeProcessTask,
  candidates: Array<{ field: keyof RuntimeProcessTask; label: string }>,
): DateCandidate | null {
  for (const candidate of candidates) {
    const value = task[candidate.field]
    if (typeof value !== 'string' || !value.trim()) continue
    if (!parseDateLike(value)) continue
    return {
      field: String(candidate.field),
      label: candidate.label,
      value,
    }
  }
  return null
}

function buildDemandIdentity(task: RuntimeProcessTask): TaskDemandIdentity {
  const processCode = task.processBusinessCode ?? task.processCode
  const processName = task.processBusinessName ?? task.processNameZh ?? processCode
  const craftCode = task.craftCode ?? processCode
  const craftName = task.craftName ?? processName
  return {
    processCode,
    processName,
    craftCode,
    craftName,
  }
}

function buildDemandKey(input: {
  date: string
  factoryId: string
  processCode: string
  craftCode: string
}): string {
  return [input.date, input.factoryId, input.processCode, input.craftCode].join('::')
}

function buildUnallocatedKey(input: { date: string; processCode: string; craftCode: string }): string {
  return [input.date, input.processCode, input.craftCode].join('::')
}

function buildUsageSchedule(
  input: {
    standardSamTotal: number
    windowStartDate?: string
    windowEndDate?: string
  },
  reasonWhenMissing: string,
): TaskScheduleResolution {
  const startDate = parseDateLike(input.windowStartDate)
  const endDate = parseDateLike(input.windowEndDate)

  if (startDate && endDate) {
    const startDay = toDayStart(startDate)
    const endDay = toDayStart(endDate)
    if (startDay.getTime() <= endDay.getTime()) {
      const dates = listDatesBetween(startDay, endDay)
      if (dates.length === 1) {
        return {
          kind: 'SINGLE',
          allocations: [{ date: dates[0], demandSam: roundSam(input.standardSamTotal) }],
        }
      }
      const average = roundSam(input.standardSamTotal / dates.length)
      let assigned = 0
      return {
        kind: 'WINDOW',
        allocations: dates.map((date, index) => {
          if (index === dates.length - 1) {
            return {
              date,
              demandSam: roundSam(input.standardSamTotal - assigned),
            }
          }
          assigned = roundSam(assigned + average)
          return { date, demandSam: average }
        }),
      }
    }
  }

  const singleDate = startDate ?? endDate
  if (singleDate) {
    return {
      kind: 'SINGLE',
      allocations: [{ date: formatDateKey(toDayStart(singleDate)), demandSam: roundSam(input.standardSamTotal) }],
    }
  }

  return {
    kind: 'UNSCHEDULED',
    allocations: [],
    reason: reasonWhenMissing,
  }
}

function resolveUsageIdentity(
  input: Pick<CapacityFreeze | CapacityCommitment, 'processCode' | 'craftCode' | 'taskId'>,
  taskMap: Map<string, RuntimeProcessTask>,
  displayLabels: Map<string, { processName?: string; craftName?: string }>,
): TaskDemandIdentity {
  const task = taskMap.get(input.taskId)
  if (task) {
    const identity = buildDemandIdentity(task)
    return {
      processCode: input.processCode,
      processName: identity.processName,
      craftCode: input.craftCode,
      craftName: identity.craftName,
    }
  }

  const label = displayLabels.get(`${input.processCode}::${input.craftCode}`)
  return {
    processCode: input.processCode,
    processName: label?.processName ?? input.processCode,
    craftCode: input.craftCode,
    craftName: label?.craftName ?? input.craftCode,
  }
}

function appendUnique(items: string[], value: string): string[] {
  return items.includes(value) ? items : [...items, value]
}

function shouldTrackUnallocatedDemand(task: RuntimeProcessTask): boolean {
  return UNALLOCATED_ASSIGNMENT_STATUSES.has(task.assignmentStatus)
}

function resolveAssignmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    UNASSIGNED: '未分配',
    BIDDING: '招标中',
    AWAIT_AWARD: '待定标',
    HOLD: '暂不分配',
    AWARDED: '已定标',
    ASSIGNED: '已派单',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  }
  return labels[status] ?? (status || '—')
}

function buildTaskWindowText(task: RuntimeProcessTask, publishedSamTotal: number): string {
  const schedule = buildTaskSchedule(task, publishedSamTotal)
  if (schedule.kind === 'UNSCHEDULED') return '日期不足'
  const first = schedule.allocations[0]?.date
  const last = schedule.allocations.at(-1)?.date
  if (!first && !last) return '日期不足'
  return buildFactoryCalendarWindowText(first, last)
}

function buildBottleneckSourceObjectKey(input: { taskId: string; allocationUnitId?: string }): string {
  return `${input.taskId}::${input.allocationUnitId ?? ''}`
}

function buildTaskSchedule(task: RuntimeProcessTask, publishedSamTotal: number): TaskScheduleResolution {
  const startCandidate = pickFirstValidDate(task, WINDOW_START_CANDIDATES)
  const endCandidate = pickFirstValidDate(task, WINDOW_END_CANDIDATES)

  if (startCandidate?.value && endCandidate?.value) {
    const startDate = parseDateLike(startCandidate.value)
    const endDate = parseDateLike(endCandidate.value)

    if (startDate && endDate) {
      const startDay = toDayStart(startDate)
      const endDay = toDayStart(endDate)

      if (startDay.getTime() <= endDay.getTime()) {
        const dates = listDatesBetween(startDay, endDay)
        if (dates.length === 1) {
          return {
            kind: 'SINGLE',
            allocations: [{ date: dates[0], demandSam: roundSam(publishedSamTotal) }],
          }
        }

        const average = roundSam(publishedSamTotal / dates.length)
        let assigned = 0
        return {
          kind: 'WINDOW',
          allocations: dates.map((date, index) => {
            if (index === dates.length - 1) {
              return {
                date,
                demandSam: roundSam(publishedSamTotal - assigned),
              }
            }
            assigned = roundSam(assigned + average)
            return { date, demandSam: average }
          }),
        }
      }
    }
  }

  const singleDateCandidate = pickFirstValidDate(task, SINGLE_DATE_CANDIDATES)
  if (singleDateCandidate?.value) {
    const singleDate = parseDateLike(singleDateCandidate.value)
    if (singleDate) {
      return {
        kind: 'SINGLE',
        allocations: [{ date: formatDateKey(toDayStart(singleDate)), demandSam: roundSam(publishedSamTotal) }],
      }
    }
  }

  return {
    kind: 'UNSCHEDULED',
    allocations: [],
    reason: '缺少开始/结束窗口与单日期，当前无法安全落到某一天。',
  }
}

function resolveCommittedFactory(task: RuntimeProcessTask): { factoryId: string; factoryName: string } | null {
  if (!task.assignedFactoryId) return null
  const factory = getFactoryMasterRecordById(task.assignedFactoryId)
  return {
    factoryId: task.assignedFactoryId,
    factoryName: factory?.name ?? task.assignedFactoryName ?? task.assignedFactoryId,
  }
}

function shouldTrackDemand(task: RuntimeProcessTask): boolean {
  return task.status !== 'DONE' && task.status !== 'CANCELLED'
}

function resolveOverrideDisplayLabels(): Map<string, { processName?: string; craftName?: string }> {
  const map = new Map<string, { processName?: string; craftName?: string }>()
  for (const factory of listFactoryMasterRecords()) {
    for (const { row } of listFactoryCapacityEntries(factory.id)) {
      const key = `${row.processCode}::${row.craftCode}`
      if (!map.has(key)) {
        map.set(key, { processName: row.processName, craftName: row.craftName })
      }
      const processKey = `${row.processCode}::`
      if (!map.has(processKey)) {
        map.set(processKey, { processName: row.processName })
      }
    }
  }
  return map
}

function getOverrideSpecificity(override: CapacityCalendarOverrideRecord): number {
  if (override.processCode && override.craftCode) return 3
  if (override.processCode) return 2
  return 1
}

function buildOverrideScopeLabel(override: CapacityCalendarOverrideRecord, labels: Map<string, { processName?: string; craftName?: string }>): string {
  if (!override.processCode) return '整厂暂停'
  if (!override.craftCode) {
    const process = labels.get(`${override.processCode}::`)?.processName ?? override.processCode
    return `${process} 暂停`
  }
  const label = labels.get(`${override.processCode}::${override.craftCode}`)
  return `${label?.processName ?? override.processCode} / ${label?.craftName ?? override.craftCode} 暂停`
}

function matchesPauseOverride(
  override: CapacityCalendarOverrideRecord,
  date: string,
  factoryId: string,
  processCode: string,
  craftCode: string,
): boolean {
  if (override.overrideType !== 'PAUSE') return false
  if (override.factoryId !== factoryId) return false
  if (date < override.startDate || date > override.endDate) return false
  if (override.processCode && override.processCode !== processCode) return false
  if (override.craftCode && override.craftCode !== craftCode) return false
  return true
}

function resolvePauseOverride(
  overrides: CapacityCalendarOverrideRecord[],
  overrideLabels: Map<string, { processName?: string; craftName?: string }>,
  input: {
    date: string
    factoryId: string
    processCode: string
    craftCode: string
  },
): PauseOverrideHit | null {
  const matched = overrides
    .filter((override) =>
      matchesPauseOverride(
        override,
        input.date,
        input.factoryId,
        input.processCode,
        input.craftCode,
      ),
    )
    .sort((left, right) => getOverrideSpecificity(right) - getOverrideSpecificity(left))

  const override = matched[0]
  if (!override) return null

  return {
    id: override.id,
    note: override.note ?? '暂停例外生效',
    scopeLabel: buildOverrideScopeLabel(override, overrideLabels),
  }
}

function resolveCalendarRowStatus(input: {
  baseSupplySam: number
  supplySam: number
  committedSam: number
  pauseHit: PauseOverrideHit | null
}): Pick<CapacityCalendarComparisonRow, 'status' | 'statusReason' | 'remainingSam' | 'overload' | 'pauseOverrideId' | 'pauseOverrideNote' | 'pauseScopeLabel'> {
  const remainingSam = calculateCapacityRemainingStandardHours({
    supplyStandardHours: input.supplySam,
    committedStandardHours: input.committedSam,
    frozenStandardHours: 0,
  })
  if (input.pauseHit) {
    return {
      status: 'PAUSED',
      statusReason: `命中暂停例外：${input.pauseHit.scopeLabel}，${input.pauseHit.note}`,
      remainingSam,
      overload: remainingSam < 0,
      pauseOverrideId: input.pauseHit.id,
      pauseOverrideNote: input.pauseHit.note,
      pauseScopeLabel: input.pauseHit.scopeLabel,
    }
  }

  if (input.committedSam > input.supplySam) {
    return {
      status: 'OVERLOADED',
      statusReason: `已占用 ${roundSam(input.committedSam)} SAM，高于可供给 ${roundSam(input.supplySam)} SAM`,
      remainingSam,
      overload: true,
    }
  }

  if (input.supplySam > 0 && remainingSam >= 0 && remainingSam / input.supplySam < CAPACITY_TIGHT_THRESHOLD_RATIO) {
    return {
      status: 'TIGHT',
      statusReason: `剩余 ${roundSam(remainingSam)} SAM，占可供给 ${roundSam((remainingSam / input.supplySam) * 100)}%`,
      remainingSam,
      overload: false,
    }
  }

  return {
    status: 'NORMAL',
    statusReason:
      input.baseSupplySam > 0
        ? `剩余 ${roundSam(remainingSam)} SAM，可继续承接`
        : '当前暂无已占用需求',
    remainingSam,
    overload: false,
  }
}

function buildComparisonRowMap(rows: CapacityCalendarComparisonRow[]): Map<string, CapacityCalendarComparisonRow> {
  return new Map(rows.map((row) => [buildDemandKey({
    date: row.date,
    factoryId: row.factoryId,
    processCode: row.processCode,
    craftCode: row.craftCode,
  }), row] as const))
}

export function createCapacityCalendarEvaluationContext(
  calendarData: CapacityCalendarData = buildCapacityCalendarData(),
): CapacityCalendarEvaluationContext {
  return {
    calendarData,
    comparisonRowMap: buildComparisonRowMap(calendarData.comparisonRows),
  }
}

function compareConstraintPriority(status: CapacityCalendarConstraintStatus): number {
  const order: Record<CapacityCalendarConstraintStatus, number> = {
    PAUSED: 5,
    OVERLOADED: 4,
    TIGHT: 3,
    NORMAL: 2,
    DATE_INCOMPLETE: 1,
    SAM_MISSING: 1,
  }
  return order[status]
}

function buildConstraintReason(result: CapacityCalendarTaskConstraintAllocation): string {
  if (result.status === 'PAUSED') {
    return `${result.date} 命中暂停例外，${result.reason}`
  }

  if (result.status === 'OVERLOADED') {
    return `${result.date} 已超载：预计已占用 ${roundSam(result.projectedCommittedSam)} SAM，可供给 ${roundSam(result.supplySam)} SAM`
  }

  if (result.status === 'TIGHT') {
    const ratio = result.supplySam > 0 ? roundSam((result.projectedRemainingSam / result.supplySam) * 100) : 0
    return `${result.date} 能力紧张：剩余 ${roundSam(result.projectedRemainingSam)} SAM，占可供给 ${ratio}%`
  }

  return `${result.date} 能力正常，可继续分配`
}

export function evaluateRuntimeTaskCapacityConstraint(input: {
  task: RuntimeProcessTask
  factoryId: string
  factoryName?: string
  allocatableGroup?: Pick<RuntimeTaskAllocatableGroup, 'qty' | 'detailRowKeys' | 'groupKey' | 'groupLabel'>
  evaluationContext?: CapacityCalendarEvaluationContext
}): CapacityCalendarTaskConstraintResult {
  const identity = buildDemandIdentity(input.task)
  const factory = getFactoryMasterRecordById(input.factoryId)
  const factoryName = input.factoryName ?? factory?.name ?? input.task.assignedFactoryName ?? input.factoryId
  const sam = input.allocatableGroup
    ? resolveRuntimeAllocatableGroupPublishedSam(input.task, input.allocatableGroup)
    : resolveRuntimeTaskPublishedSam(input.task)
  const publishedSamTotal = sam.publishedSamTotal

  if (!publishedSamTotal || publishedSamTotal <= 0) {
    return {
      factoryId: input.factoryId,
      factoryName,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      status: 'SAM_MISSING',
      decision: 'WARN',
      hardBlocked: false,
      warning: true,
      dateIncomplete: false,
      usesParentWindow: Boolean(input.allocatableGroup),
      reason: '当前任务缺少可用的发布工时 SAM，无法完成产能状态校验。',
      allocations: [],
    }
  }

  const schedule = buildTaskSchedule(input.task, publishedSamTotal)
  if (schedule.kind === 'UNSCHEDULED') {
    return {
      factoryId: input.factoryId,
      factoryName,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      status: 'DATE_INCOMPLETE',
      decision: 'WARN',
      hardBlocked: false,
      warning: true,
      dateIncomplete: true,
      usesParentWindow: Boolean(input.allocatableGroup),
      reason: '当前任务缺少完整日期窗口，无法完全校验产能日历。',
      allocations: [],
    }
  }

  const evaluationContext = input.evaluationContext ?? createCapacityCalendarEvaluationContext()
  const overrideLabels = resolveOverrideDisplayLabels()
  const overrides = listCapacityCalendarOverrides()
  const allocations: CapacityCalendarTaskConstraintAllocation[] = schedule.allocations.map((allocation) => {
    const rowKey = buildDemandKey({
      date: allocation.date,
      factoryId: input.factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    const row = evaluationContext.comparisonRowMap.get(rowKey)
    const pauseHit = resolvePauseOverride(overrides, overrideLabels, {
      date: allocation.date,
      factoryId: input.factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    const currentTaskAlreadyCommitted =
      input.task.assignedFactoryId === input.factoryId &&
      row?.taskIds.includes(input.task.taskId)
    const baseSupplySam = row?.baseSupplySam ?? row?.supplySam ?? 0
    const supplySam = pauseHit ? 0 : (row?.supplySam ?? 0)
    const baselineCommitted = roundSam(
      Math.max((row?.committedSam ?? 0) - (currentTaskAlreadyCommitted ? allocation.demandSam : 0), 0),
    )
    const projectedCommittedSam = roundSam(baselineCommitted + allocation.demandSam)
    const resolved = resolveCalendarRowStatus({
      baseSupplySam,
      supplySam,
      committedSam: projectedCommittedSam,
      pauseHit,
    })

    return {
      date: allocation.date,
      baseSupplySam,
      supplySam,
      committedSam: baselineCommitted,
      proposedDemandSam: allocation.demandSam,
      projectedCommittedSam,
      projectedRemainingSam: resolved.remainingSam,
      status: resolved.status,
      reason:
        resolved.status === 'PAUSED'
          ? resolved.statusReason
          : buildConstraintReason({
              date: allocation.date,
              baseSupplySam,
              supplySam,
              committedSam: baselineCommitted,
              proposedDemandSam: allocation.demandSam,
              projectedCommittedSam,
              projectedRemainingSam: resolved.remainingSam,
              status: resolved.status,
              reason: resolved.statusReason,
              pauseOverrideId: resolved.pauseOverrideId,
            }),
      pauseOverrideId: resolved.pauseOverrideId,
    }
  })

  const worst = allocations.reduce<CapacityCalendarTaskConstraintAllocation | null>((current, item) => {
    if (!current) return item
    if (compareConstraintPriority(item.status) !== compareConstraintPriority(current.status)) {
      return compareConstraintPriority(item.status) > compareConstraintPriority(current.status) ? item : current
    }
    return item.date < current.date ? item : current
  }, null)

  const finalStatus = worst?.status ?? 'NORMAL'
  const decision: 'ALLOW' | 'WARN' | 'BLOCK' =
    finalStatus === 'PAUSED' || finalStatus === 'OVERLOADED'
      ? 'BLOCK'
      : finalStatus === 'TIGHT'
        ? 'WARN'
        : 'ALLOW'

  const reasons = [worst?.reason].filter((item): item is string => Boolean(item))
  if (input.allocatableGroup) {
    reasons.push('当前按明细模式复用母任务日期窗口进行状态校验。')
  }

  return {
    factoryId: input.factoryId,
    factoryName,
    processCode: identity.processCode,
    processName: identity.processName,
    craftCode: identity.craftCode,
    craftName: identity.craftName,
    status: finalStatus,
    decision,
    hardBlocked: decision === 'BLOCK',
    warning: decision === 'WARN',
    dateIncomplete: false,
    usesParentWindow: Boolean(input.allocatableGroup),
    reason: reasons.join(' '),
    allocations,
  }
}

export function buildCapacityCalendarData(): CapacityCalendarData {
  const comparisonMap = new Map<string, UsageDailyRowSeed>()
  const unallocatedMap = new Map<string, CapacityCalendarUnallocatedRow>()
  const unscheduledRows: CapacityCalendarUnscheduledRow[] = []
  const missingSamRows: CapacityCalendarMissingSamRow[] = []
  const scheduledDateSet = new Set<string>()
  const relevantCraftKeys = new Set<string>()
  const overrideLabels = resolveOverrideDisplayLabels()
  const tasks = listRuntimeExecutionTasks().filter((task) => shouldTrackDemand(task))
  const taskMap = new Map(tasks.map((task) => [task.taskId, task] as const))
  const activeCommitments = listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = listCapacityFreezes({ status: 'ACTIVE' })
  const coveredTaskIds = new Set<string>([
    ...activeCommitments.map((item) => item.taskId),
    ...activeFreezes.map((item) => item.taskId),
  ])

  function getComparisonRowSeed(input: {
    date: string
    factoryId: string
    factoryName: string
    processCode: string
    processName: string
    craftCode: string
    craftName: string
  }): UsageDailyRowSeed {
    const key = buildDemandKey({
      date: input.date,
      factoryId: input.factoryId,
      processCode: input.processCode,
      craftCode: input.craftCode,
    })
    const current = comparisonMap.get(key)
    if (current) return current
    const created: UsageDailyRowSeed = {
      date: input.date,
      factoryId: input.factoryId,
      factoryName: input.factoryName,
      processCode: input.processCode,
      processName: input.processName,
      craftCode: input.craftCode,
      craftName: input.craftName,
      baseSupplySam: 0,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      committedTaskIds: [],
      frozenTaskIds: [],
      taskIds: [],
    }
    comparisonMap.set(key, created)
    return created
  }

  function pushUnscheduledRow(input: CapacityCalendarUnscheduledRow): void {
    unscheduledRows.push({
      ...input,
      standardSamTotal: roundSam(input.standardSamTotal),
    })
  }

  for (const commitment of activeCommitments) {
    const identity = resolveUsageIdentity(commitment, taskMap, overrideLabels)
    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const task = taskMap.get(commitment.taskId)
    const schedule = buildUsageSchedule(
      {
        standardSamTotal: commitment.standardSamTotal,
        windowStartDate: commitment.windowStartDate,
        windowEndDate: commitment.windowEndDate,
      },
      '占用工时对象缺少日期窗口，当前进入未排期需求。',
    )

    if (schedule.kind === 'UNSCHEDULED') {
      pushUnscheduledRow({
        taskId: commitment.taskId,
        productionOrderId: task?.productionOrderId ?? '—',
        demandType: '已占用需求',
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        standardSamTotal: commitment.standardSamTotal,
        assignmentStatus: task?.assignmentStatus ?? 'AWARDED',
        assignmentMode: task?.assignmentMode ?? 'DIRECT',
        factoryName:
          getFactoryMasterRecordById(commitment.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? commitment.factoryId,
        reason: schedule.reason ?? '占用工时对象缺少有效日期窗口。',
      })
      continue
    }

    for (const allocation of schedule.allocations) {
      scheduledDateSet.add(allocation.date)
      const row = getComparisonRowSeed({
        date: allocation.date,
        factoryId: commitment.factoryId,
        factoryName:
          getFactoryMasterRecordById(commitment.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? commitment.factoryId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
      })
      row.committedSam = roundSam(row.committedSam + allocation.demandSam)
      row.committedTaskIds = appendUnique(row.committedTaskIds, commitment.taskId)
      row.taskIds = appendUnique(row.taskIds, commitment.taskId)
    }
  }

  for (const freeze of activeFreezes) {
    const identity = resolveUsageIdentity(freeze, taskMap, overrideLabels)
    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const task = taskMap.get(freeze.taskId)
    const schedule = buildUsageSchedule(
      {
        standardSamTotal: freeze.standardSamTotal,
        windowStartDate: freeze.windowStartDate,
        windowEndDate: freeze.windowEndDate,
      },
      '冻结工时对象缺少日期窗口，当前进入未排期需求。',
    )

    if (schedule.kind === 'UNSCHEDULED') {
      pushUnscheduledRow({
        taskId: freeze.taskId,
        productionOrderId: task?.productionOrderId ?? '—',
        demandType: '已冻结需求',
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        standardSamTotal: freeze.standardSamTotal,
        assignmentStatus: task?.assignmentStatus ?? 'DIRECT_ASSIGNED',
        assignmentMode: task?.assignmentMode ?? 'DIRECT',
        factoryName:
          getFactoryMasterRecordById(freeze.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? freeze.factoryId,
        reason: schedule.reason ?? '冻结工时对象缺少有效日期窗口。',
      })
      continue
    }

    for (const allocation of schedule.allocations) {
      scheduledDateSet.add(allocation.date)
      const row = getComparisonRowSeed({
        date: allocation.date,
        factoryId: freeze.factoryId,
        factoryName:
          getFactoryMasterRecordById(freeze.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? freeze.factoryId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
      })
      row.frozenSam = roundSam(row.frozenSam + allocation.demandSam)
      row.frozenTaskIds = appendUnique(row.frozenTaskIds, freeze.taskId)
      row.taskIds = appendUnique(row.taskIds, freeze.taskId)
    }
  }

  for (const task of tasks) {
    const sam = resolveRuntimeTaskPublishedSam(task)
    const publishedSamTotal = sam.publishedSamTotal
    const identity = buildDemandIdentity(task)

    if (!publishedSamTotal || publishedSamTotal <= 0) {
      missingSamRows.push({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        reason: '任务对象缺少可用的总标准工时，当前无法参与供需对比。',
      })
      continue
    }

    if (coveredTaskIds.has(task.taskId)) continue
    if (!shouldTrackUnallocatedDemand(task)) continue

    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const schedule = buildTaskSchedule(task, publishedSamTotal)

    if (schedule.kind === 'UNSCHEDULED') {
      pushUnscheduledRow({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        demandType: '待分配需求',
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        standardSamTotal: publishedSamTotal,
        assignmentStatus: task.assignmentStatus,
        assignmentMode: task.assignmentMode,
        factoryName: task.assignedFactoryName ?? task.assignedFactoryId ?? '未落工厂',
        reason: schedule.reason ?? '缺少有效日期窗口。',
      })
      continue
    }

    for (const allocation of schedule.allocations) {
      scheduledDateSet.add(allocation.date)
      const key = buildUnallocatedKey({
        date: allocation.date,
        processCode: identity.processCode,
        craftCode: identity.craftCode,
      })
      const current = unallocatedMap.get(key) ?? {
        date: allocation.date,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        demandSam: 0,
        taskCount: 0,
        assignmentStatuses: [],
        taskIds: [],
      }
      current.demandSam = roundSam(current.demandSam + allocation.demandSam)
      current.taskIds = appendUnique(current.taskIds, task.taskId)
      current.assignmentStatuses = appendUnique(current.assignmentStatuses, task.assignmentStatus)
      current.taskCount = current.taskIds.length
      unallocatedMap.set(key, current)
    }
  }

  const displayDates = scheduledDateSet.size > 0
    ? [...scheduledDateSet].sort((left, right) => left.localeCompare(right))
    : fallbackDisplayDates()

  const activeCraftKeys = relevantCraftKeys.size > 0 ? relevantCraftKeys : new Set<string>()
  for (const factory of listFactoryMasterRecords()) {
    const entries = listFactoryCapacityEntries(factory.id)
    for (const { row, entry } of entries) {
      const craftKey = `${row.processCode}::${row.craftCode}`
      if (activeCraftKeys.size > 0 && !activeCraftKeys.has(craftKey)) continue

      const computed = computeFactoryCapacityEntryResult(row, entry.values)
      const baseSupplySam = roundSam(Math.max(computed.resultValue ?? 0, 0))

      for (const date of displayDates) {
        const current = getComparisonRowSeed({
          date,
          factoryId: factory.id,
          factoryName: factory.name,
          processCode: row.processCode,
          processName: row.processName,
          craftCode: row.craftCode,
          craftName: row.craftName,
        })
        current.baseSupplySam = roundSam(current.baseSupplySam + baseSupplySam)
        current.supplySam = roundSam(current.supplySam + baseSupplySam)
      }
    }
  }

  const comparisonRows = [...comparisonMap.values()]
    .map((row) => {
      const totalReservedSam = roundSam(row.committedSam + row.frozenSam)
      const resolved = resolveCalendarRowStatus({
        baseSupplySam: row.baseSupplySam,
        supplySam: row.supplySam,
        committedSam: totalReservedSam,
        pauseHit: null,
      })
      const remainingSam = calculateCapacityRemainingStandardHours({
        supplyStandardHours: row.supplySam,
        committedStandardHours: row.committedSam,
        frozenStandardHours: row.frozenSam,
      })
      const committedTaskIds = Array.from(new Set(row.committedTaskIds))
      const frozenTaskIds = Array.from(new Set(row.frozenTaskIds))
      const taskIds = Array.from(new Set(row.taskIds))

      return {
        ...row,
        committedTaskIds,
        frozenTaskIds,
        taskIds,
        commitmentCount: committedTaskIds.length,
        freezeCount: frozenTaskIds.length,
        taskCount: taskIds.length,
        remainingSam,
        overload: remainingSam < 0,
        status: resolved.status,
        statusReason: `已占用 ${roundSam(row.committedSam)} / 已冻结 ${roundSam(row.frozenSam)} / 剩余 ${roundSam(remainingSam)}`,
        pauseOverrideId: undefined,
        pauseOverrideNote: undefined,
        pauseScopeLabel: undefined,
      } satisfies CapacityCalendarComparisonRow
    })
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date)
      if (left.remainingSam !== right.remainingSam) return left.remainingSam - right.remainingSam
      const factoryCompare = left.factoryName.localeCompare(right.factoryName)
      if (factoryCompare !== 0) return factoryCompare
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })

  const unallocatedRows = [...unallocatedMap.values()].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date)
    if (right.demandSam !== left.demandSam) return right.demandSam - left.demandSam
    const processCompare = left.processName.localeCompare(right.processName)
    if (processCompare !== 0) return processCompare
    return left.craftName.localeCompare(right.craftName)
  })

  unscheduledRows.sort((left, right) => {
    if (right.standardSamTotal !== left.standardSamTotal) return right.standardSamTotal - left.standardSamTotal
    return left.taskId.localeCompare(right.taskId)
  })

  const summary: CapacityCalendarSummary = {
    supplyTotal: roundSam(comparisonRows.reduce((sum, row) => sum + row.supplySam, 0)),
    committedTotal: roundSam(comparisonRows.reduce((sum, row) => sum + row.committedSam, 0)),
    frozenTotal: roundSam(comparisonRows.reduce((sum, row) => sum + row.frozenSam, 0)),
    remainingTotal: roundSam(comparisonRows.reduce((sum, row) => sum + row.remainingSam, 0)),
    unallocatedTotal: roundSam(unallocatedRows.reduce((sum, row) => sum + row.demandSam, 0)),
    unscheduledTotal: roundSam(unscheduledRows.reduce((sum, row) => sum + row.standardSamTotal, 0)),
    missingSamCount: missingSamRows.length,
  }

  const pauseOverrideRows = listCapacityCalendarOverrides()
    .filter((override) => override.overrideType === 'PAUSE')
    .map((override) => {
      const factory = getFactoryMasterRecordById(override.factoryId)
      const label = override.processCode
        ? override.craftCode
          ? overrideLabels.get(`${override.processCode}::${override.craftCode}`)
          : overrideLabels.get(`${override.processCode}::`)
        : undefined
      return {
        id: override.id,
        factoryId: override.factoryId,
        factoryName: factory?.name ?? override.factoryId,
        processCode: override.processCode,
        processName: label?.processName ?? override.processCode,
        craftCode: override.craftCode,
        craftName: label?.craftName ?? override.craftCode,
        scopeLabel: buildOverrideScopeLabel(override, overrideLabels),
        startDate: override.startDate,
        endDate: override.endDate,
        overrideType: 'PAUSE',
        reason: override.reason,
        note: override.note ?? '',
      } satisfies CapacityCalendarOverrideRow
    })
    .sort((left, right) => {
      if (left.startDate !== right.startDate) return right.startDate.localeCompare(left.startDate)
      return left.id.localeCompare(right.id)
    })

  return {
    summary,
    displayDates,
    comparisonRows,
    unallocatedRows,
    unscheduledRows,
    missingSamRows,
    pauseOverrideRows,
    singleDatePriority: SINGLE_DATE_CANDIDATES.map((item) => item.label),
    windowPriority: {
      start: WINDOW_START_CANDIDATES.map((item) => item.label),
      end: WINDOW_END_CANDIDATES.map((item) => item.label),
    },
  }
}

function buildFactoryCalendarRowKey(input: { date: string; processCode: string; craftCode: string }): string {
  return [input.date, input.processCode, input.craftCode].join('::')
}

function resolveFactoryCalendarWindowDays(value?: number): FactoryCalendarWindowDays {
  if (value === 7 || value === 30) return value
  return 15
}

function buildFutureDateWindow(days: FactoryCalendarWindowDays, today: Date = toDayStart(new Date())): string[] {
  return Array.from({ length: days }, (_, index) => formatDateKey(addDays(today, index)))
}

function buildFactoryCalendarWindowText(startDate?: string, endDate?: string): string {
  const start = normalizeDateKey(startDate)
  const end = normalizeDateKey(endDate)
  if (start && end) {
    return start === end ? start : `${start} 至 ${end}`
  }
  if (start || end) return start ?? end ?? '日期不足'
  return '日期不足'
}

function buildFactoryCalendarObjectKey(input: { taskId: string; allocationUnitId?: string }): string {
  return `${input.taskId}::${input.allocationUnitId ?? ''}`
}

function sortFactoryCalendarRows(left: FactoryCalendarRow, right: FactoryCalendarRow): number {
  if (left.date !== right.date) return left.date.localeCompare(right.date)
  const processCompare = left.processName.localeCompare(right.processName)
  if (processCompare !== 0) return processCompare
  const craftCompare = left.craftName.localeCompare(right.craftName)
  if (craftCompare !== 0) return craftCompare
  return left.rowKey.localeCompare(right.rowKey)
}

function buildFactoryCalendarEmptySummary(): FactoryCalendarSummary {
  return {
    supplyTotal: 0,
    committedTotal: 0,
    frozenTotal: 0,
    remainingTotal: 0,
    craftCount: 0,
    taskCount: 0,
  }
}

function buildFactoryCalendarSummary(rows: FactoryCalendarRow[]): FactoryCalendarSummary {
  const craftKeys = new Set<string>()
  const taskIds = new Set<string>()

  for (const row of rows) {
    craftKeys.add(`${row.processCode}::${row.craftCode}`)
    for (const source of [...row.committedSources, ...row.frozenSources]) {
      taskIds.add(source.taskId)
    }
  }

  return {
    supplyTotal: roundSam(rows.reduce((sum, row) => sum + row.supplySam, 0)),
    committedTotal: roundSam(rows.reduce((sum, row) => sum + row.committedSam, 0)),
    frozenTotal: roundSam(rows.reduce((sum, row) => sum + row.frozenSam, 0)),
    remainingTotal: roundSam(rows.reduce((sum, row) => sum + row.remainingSam, 0)),
    craftCount: craftKeys.size,
    taskCount: taskIds.size,
  }
}

export function buildFactoryCalendarData(input?: {
  factoryId?: string
  processCode?: string
  craftCode?: string
  windowDays?: number
}): FactoryCalendarData {
  const factoryOptions = listFactoryMasterRecords()
    .sort((left, right) => {
      const leftKey = left.code || left.name
      const rightKey = right.code || right.name
      return leftKey.localeCompare(rightKey)
    })
    .map((factory) => ({
      id: factory.id,
      code: factory.code,
      name: factory.name,
      label: `${factory.name}（${factory.code}）`,
    }))

  const selectedFactoryId = factoryOptions.find((item) => item.id === input?.factoryId)?.id ?? factoryOptions[0]?.id ?? ''
  const selectedFactory = selectedFactoryId ? getFactoryMasterRecordById(selectedFactoryId) : undefined
  const windowDays = resolveFactoryCalendarWindowDays(input?.windowDays)
  const dates = buildFutureDateWindow(windowDays)
  const dateSet = new Set(dates)
  const taskMap = new Map(listRuntimeExecutionTasks().map((task) => [task.taskId, task] as const))
  const displayLabels = resolveOverrideDisplayLabels()
  const rowSeedMap = new Map<string, FactoryCalendarRowSeed>()
  const processOptionMap = new Map<string, FactoryCalendarProcessOption>()
  const craftOptionMap = new Map<string, FactoryCalendarCraftOption>()

  function registerIdentity(identity: TaskDemandIdentity): void {
    if (!processOptionMap.has(identity.processCode)) {
      processOptionMap.set(identity.processCode, {
        processCode: identity.processCode,
        processName: identity.processName,
      })
    }

    const craftKey = `${identity.processCode}::${identity.craftCode}`
    if (!craftOptionMap.has(craftKey)) {
      craftOptionMap.set(craftKey, {
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
      })
    }
  }

  function getRowSeed(identity: TaskDemandIdentity, date: string): FactoryCalendarRowSeed {
    const rowKey = buildFactoryCalendarRowKey({
      date,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    const current = rowSeedMap.get(rowKey)
    if (current) return current

    const created: FactoryCalendarRowSeed = {
      rowKey,
      date,
      factoryId: selectedFactoryId,
      factoryName: selectedFactory?.name ?? selectedFactoryId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      committedSources: [],
      frozenSources: [],
      committedObjectKeys: new Set<string>(),
      frozenObjectKeys: new Set<string>(),
    }
    rowSeedMap.set(rowKey, created)
    return created
  }

  if (selectedFactoryId) {
    for (const { row, entry } of listFactoryCapacityEntries(selectedFactoryId)) {
      const identity: TaskDemandIdentity = {
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
      }
      registerIdentity(identity)
      const dailySupplySam = roundSam(Math.max(computeFactoryCapacityEntryResult(row, entry.values).resultValue ?? 0, 0))

      for (const date of dates) {
        const seed = getRowSeed(identity, date)
        seed.supplySam = roundSam(seed.supplySam + dailySupplySam)
      }
    }

    const activeCommitments = listCapacityCommitments({ factoryId: selectedFactoryId, status: 'ACTIVE' })
    const activeFreezes = listCapacityFreezes({ factoryId: selectedFactoryId, status: 'ACTIVE' })

    const appendUsageSources = (
      items: CapacityCommitment[] | CapacityFreeze[],
      sourceKind: 'COMMITTED' | 'FROZEN',
    ): void => {
      for (const item of items) {
        const identity = resolveUsageIdentity(item, taskMap, displayLabels)
        registerIdentity(identity)
        const schedule = buildUsageSchedule(
          {
            standardSamTotal: item.standardSamTotal,
            windowStartDate: item.windowStartDate,
            windowEndDate: item.windowEndDate,
          },
          '缺少可用日期窗口',
        )

        if (schedule.kind === 'UNSCHEDULED') continue

        const task = taskMap.get(item.taskId)
        const objectKey = buildFactoryCalendarObjectKey({
          taskId: item.taskId,
          allocationUnitId: item.allocationUnitId,
        })

        for (const allocation of schedule.allocations) {
          if (!dateSet.has(allocation.date)) continue
          const seed = getRowSeed(identity, allocation.date)
          const source: FactoryCalendarSourceRow = {
            id: item.id,
            sourceKind,
            sourceKindLabel: sourceKind === 'COMMITTED' ? '已占用' : '已冻结',
            sourceType: item.sourceType,
            sourceTypeLabel: CAPACITY_USAGE_SOURCE_LABEL[item.sourceType],
            factoryId: item.factoryId,
            factoryName: selectedFactory?.name ?? item.factoryId,
            taskId: item.taskId,
            productionOrderId: task?.productionOrderId ?? '—',
            standardSamTotal: roundSam(item.standardSamTotal),
            dailySam: roundSam(allocation.demandSam),
            windowStartDate: item.windowStartDate,
            windowEndDate: item.windowEndDate,
            windowText: buildFactoryCalendarWindowText(item.windowStartDate, item.windowEndDate),
            objectType: item.allocationUnitId ? '明细' : '整任务',
            allocationUnitId: item.allocationUnitId,
            note: item.note?.trim() || CAPACITY_USAGE_SOURCE_LABEL[item.sourceType],
          }

          if (sourceKind === 'COMMITTED') {
            seed.committedSam = roundSam(seed.committedSam + allocation.demandSam)
            seed.committedSources.push(source)
            seed.committedObjectKeys.add(objectKey)
          } else {
            seed.frozenSam = roundSam(seed.frozenSam + allocation.demandSam)
            seed.frozenSources.push(source)
            seed.frozenObjectKeys.add(objectKey)
          }
        }
      }
    }

    appendUsageSources(activeCommitments, 'COMMITTED')
    appendUsageSources(activeFreezes, 'FROZEN')
  }

  const processOptions = [...processOptionMap.values()].sort((left, right) => left.processName.localeCompare(right.processName))
  const craftOptionsByFactory = [...craftOptionMap.values()].sort((left, right) => {
    const processCompare = left.processName.localeCompare(right.processName)
    if (processCompare !== 0) return processCompare
    return left.craftName.localeCompare(right.craftName)
  })

  const selectedCraftOption = input?.craftCode
    ? craftOptionsByFactory.find((item) => item.craftCode === input.craftCode)
    : undefined
  const selectedProcessCode = selectedCraftOption?.processCode
    ?? processOptions.find((item) => item.processCode === input?.processCode)?.processCode
    ?? ''
  const selectedCraftCode = selectedCraftOption?.craftCode ?? ''
  const craftOptions = craftOptionsByFactory.filter((item) =>
    selectedProcessCode ? item.processCode === selectedProcessCode : true,
  )

  const rows = [...rowSeedMap.values()]
    .filter((row) => {
      if (selectedCraftCode) return row.craftCode === selectedCraftCode
      if (selectedProcessCode) return row.processCode === selectedProcessCode
      return true
    })
    .map((row) => ({
      rowKey: row.rowKey,
      date: row.date,
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      supplySam: row.supplySam,
      committedSam: row.committedSam,
      frozenSam: row.frozenSam,
      remainingSam: calculateCapacityRemainingStandardHours({
        supplyStandardHours: row.supplySam,
        committedStandardHours: row.committedSam,
        frozenStandardHours: row.frozenSam,
      }),
      committedTaskCount: row.committedObjectKeys.size,
      frozenTaskCount: row.frozenObjectKeys.size,
      committedSources: [...row.committedSources].sort((left, right) => {
        if (right.dailySam !== left.dailySam) return right.dailySam - left.dailySam
        return left.taskId.localeCompare(right.taskId)
      }),
      frozenSources: [...row.frozenSources].sort((left, right) => {
        if (right.dailySam !== left.dailySam) return right.dailySam - left.dailySam
        return left.taskId.localeCompare(right.taskId)
      }),
    }))
    .sort(sortFactoryCalendarRows)

  return {
    factoryOptions,
    processOptions,
    craftOptions,
    windowOptions: FACTORY_CALENDAR_WINDOW_OPTIONS,
    selectedFactoryId,
    selectedFactoryName: selectedFactory?.name ?? '—',
    selectedProcessCode: selectedProcessCode || undefined,
    selectedCraftCode: selectedCraftCode || undefined,
    windowDays,
    dates,
    rows,
    summary: rows.length ? buildFactoryCalendarSummary(rows) : buildFactoryCalendarEmptySummary(),
    countRuleNote: '任务数口径：整任务按任务计 1，按明细模式按“任务 + 分配单元”计 1。',
  }
}

function buildBottleneckDailyRowKey(input: {
  date: string
  factoryId: string
  processCode: string
  craftCode: string
}): string {
  return [input.date, input.factoryId, input.processCode, input.craftCode].join('::')
}

function buildBottleneckCraftRowKey(input: { processCode: string; craftCode: string }): string {
  return [input.processCode, input.craftCode].join('::')
}

function buildCapacityBottleneckSummary(input: CapacityBottleneckDraftData): CapacityBottleneckSummary {
  return {
    bottleneckCraftCount: input.craftRows.filter((row) => row.windowRemainingSam < 0).length,
    overloadedDateCount: input.dateRows.filter((row) => row.overloadedCraftCount > 0).length,
    unallocatedTotal: roundSam(input.unallocatedRows.reduce((sum, row) => sum + row.totalStandardTime, 0)),
    unscheduledTotal: roundSam(input.unscheduledRows.reduce((sum, row) => sum + row.totalStandardTime, 0)),
    maxDailyGapSam: roundSam(input.dateRows.reduce((max, row) => Math.max(max, row.maxGapSam), 0)),
    maxCraftGapSam: roundSam(input.craftRows.reduce((max, row) => Math.max(max, row.maxGapSam), 0)),
  }
}

function aggregateCraftBottlenecks(
  dailyRows: CapacityBottleneckDateDetailRow[],
  unallocatedSamByCraft: Map<string, number>,
  unscheduledSamByCraft: Map<string, number>,
): CapacityBottleneckCraftRow[] {
  const craftMap = new Map<
    string,
    {
      processCode: string
      processName: string
      craftCode: string
      craftName: string
      windowSupplySam: number
      windowCommittedSam: number
      windowFrozenSam: number
      windowRemainingSam: number
      factories: Set<string>
      dateMap: Map<string, CapacityBottleneckCraftDetailDateRow>
      factoryMap: Map<string, CapacityBottleneckCraftDetailFactoryRow>
    }
  >()

  for (const row of dailyRows) {
    const key = buildBottleneckCraftRowKey({ processCode: row.processCode, craftCode: row.craftCode })
    const current = craftMap.get(key) ?? {
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      windowSupplySam: 0,
      windowCommittedSam: 0,
      windowFrozenSam: 0,
      windowRemainingSam: 0,
      factories: new Set<string>(),
      dateMap: new Map<string, CapacityBottleneckCraftDetailDateRow>(),
      factoryMap: new Map<string, CapacityBottleneckCraftDetailFactoryRow>(),
    }

    current.windowSupplySam = roundSam(current.windowSupplySam + row.supplySam)
    current.windowCommittedSam = roundSam(current.windowCommittedSam + row.committedSam)
    current.windowFrozenSam = roundSam(current.windowFrozenSam + row.frozenSam)
    current.windowRemainingSam = roundSam(current.windowRemainingSam + row.remainingSam)
    current.factories.add(row.factoryId)

    const dateRow = current.dateMap.get(row.date) ?? {
      date: row.date,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      remainingSam: 0,
    }
    dateRow.supplySam = roundSam(dateRow.supplySam + row.supplySam)
    dateRow.committedSam = roundSam(dateRow.committedSam + row.committedSam)
    dateRow.frozenSam = roundSam(dateRow.frozenSam + row.frozenSam)
    dateRow.remainingSam = roundSam(dateRow.remainingSam + row.remainingSam)
    current.dateMap.set(row.date, dateRow)

    const factoryRow = current.factoryMap.get(row.factoryId) ?? {
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      remainingSam: 0,
    }
    factoryRow.supplySam = roundSam(factoryRow.supplySam + row.supplySam)
    factoryRow.committedSam = roundSam(factoryRow.committedSam + row.committedSam)
    factoryRow.frozenSam = roundSam(factoryRow.frozenSam + row.frozenSam)
    factoryRow.remainingSam = roundSam(factoryRow.remainingSam + row.remainingSam)
    current.factoryMap.set(row.factoryId, factoryRow)

    craftMap.set(key, current)
  }

  return [...craftMap.values()]
    .map((row) => {
      const dateRows = [...row.dateMap.values()].sort((left, right) => left.date.localeCompare(right.date))
      const factoryRows = [...row.factoryMap.values()].sort((left, right) => {
        if (left.remainingSam !== right.remainingSam) return left.remainingSam - right.remainingSam
        return left.factoryName.localeCompare(right.factoryName)
      })
      const overloadDayCount = dateRows.filter((item) => item.remainingSam < 0).length
      const maxGapSam = roundSam(
        dateRows.reduce((max, item) => (item.remainingSam < 0 ? Math.max(max, Math.abs(item.remainingSam)) : max), 0),
      )
      const rowKey = buildBottleneckCraftRowKey({
        processCode: row.processCode,
        craftCode: row.craftCode,
      })
      return {
        rowKey,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        windowSupplySam: row.windowSupplySam,
        windowCommittedSam: row.windowCommittedSam,
        windowFrozenSam: row.windowFrozenSam,
        windowRemainingSam: row.windowRemainingSam,
        overloadDayCount,
        factoryCount: row.factories.size,
        unallocatedSam: roundSam(unallocatedSamByCraft.get(rowKey) ?? 0),
        unscheduledSam: roundSam(unscheduledSamByCraft.get(rowKey) ?? 0),
        maxGapSam,
        dateRows,
        factoryRows,
      } satisfies CapacityBottleneckCraftRow
    })
    .sort((left, right) => {
      if (right.maxGapSam !== left.maxGapSam) return right.maxGapSam - left.maxGapSam
      if (left.windowRemainingSam !== right.windowRemainingSam) return left.windowRemainingSam - right.windowRemainingSam
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })
}

function aggregateDateBottlenecks(
  dailyRows: CapacityBottleneckDateDetailRow[],
  unallocatedSamByDate: Map<string, number>,
): CapacityBottleneckDateRow[] {
  const dateMap = new Map<
    string,
    {
      date: string
      supplySam: number
      committedSam: number
      frozenSam: number
      remainingSam: number
      overloadedFactories: Set<string>
      craftRemaining: Map<string, number>
      maxGapSam: number
      detailRows: CapacityBottleneckDateDetailRow[]
    }
  >()

  for (const row of dailyRows) {
    const current = dateMap.get(row.date) ?? {
      date: row.date,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      remainingSam: 0,
      overloadedFactories: new Set<string>(),
      craftRemaining: new Map<string, number>(),
      maxGapSam: 0,
      detailRows: [],
    }
    current.supplySam = roundSam(current.supplySam + row.supplySam)
    current.committedSam = roundSam(current.committedSam + row.committedSam)
    current.frozenSam = roundSam(current.frozenSam + row.frozenSam)
    current.remainingSam = roundSam(current.remainingSam + row.remainingSam)
    if (row.remainingSam < 0) {
      current.overloadedFactories.add(row.factoryId)
      current.maxGapSam = Math.max(current.maxGapSam, Math.abs(row.remainingSam))
    }
    const craftKey = buildBottleneckCraftRowKey({
      processCode: row.processCode,
      craftCode: row.craftCode,
    })
    current.craftRemaining.set(craftKey, roundSam((current.craftRemaining.get(craftKey) ?? 0) + row.remainingSam))
    current.detailRows.push(row)
    dateMap.set(row.date, current)
  }

  return [...dateMap.values()]
    .map((row) => ({
      date: row.date,
      supplySam: row.supplySam,
      committedSam: row.committedSam,
      frozenSam: row.frozenSam,
      remainingSam: row.remainingSam,
      overloadedFactoryCount: row.overloadedFactories.size,
      overloadedCraftCount: [...row.craftRemaining.values()].filter((value) => value < 0).length,
      unallocatedSam: roundSam(unallocatedSamByDate.get(row.date) ?? 0),
      maxGapSam: roundSam(row.maxGapSam),
      detailRows: [...row.detailRows].sort((left, right) => {
        if (left.remainingSam !== right.remainingSam) return left.remainingSam - right.remainingSam
        const factoryCompare = left.factoryName.localeCompare(right.factoryName)
        if (factoryCompare !== 0) return factoryCompare
        const processCompare = left.processName.localeCompare(right.processName)
        if (processCompare !== 0) return processCompare
        return left.craftName.localeCompare(right.craftName)
      }),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

function aggregateUnallocatedDemand(tasks: CapacityBottleneckUnallocatedTaskRow[]): number {
  return roundSam(tasks.reduce((sum, row) => sum + row.totalStandardTime, 0))
}

function aggregateUnscheduledDemand(tasks: CapacityBottleneckUnscheduledTaskRow[]): number {
  return roundSam(tasks.reduce((sum, row) => sum + row.totalStandardTime, 0))
}

function buildBottleneckProcessOptions(
  optionMap: Map<string, string>,
  selectedCraftOption?: { processCode: string },
  selectedProcessCode?: string,
): { processOptions: CapacityRiskFilterOption[]; selectedProcessCode: string } {
  const processOptions = [...optionMap.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }))
  return {
    processOptions,
    selectedProcessCode: selectedCraftOption?.processCode
      ?? processOptions.find((item) => item.value === selectedProcessCode)?.value
      ?? '',
  }
}

function buildBottleneckCraftOptions(
  optionMap: Map<string, { label: string; processCode: string }>,
  selectedProcessCode: string,
): Array<CapacityRiskFilterOption & { processCode: string }> {
  return [...optionMap.entries()]
    .sort((left, right) => left[1].label.localeCompare(right[1].label))
    .map(([value, item]) => ({
      value,
      label: item.label,
      processCode: item.processCode,
    }))
    .filter((item) => (selectedProcessCode ? item.processCode === selectedProcessCode : true))
}

export function buildCapacityBottleneckData(input?: {
  windowDays?: number
  processCode?: string
  craftCode?: string
}): CapacityBottleneckData {
  const windowDays = resolveFactoryCalendarWindowDays(input?.windowDays)
  const dates = buildFutureDateWindow(windowDays)
  const dateSet = new Set(dates)
  const factories = listFactoryMasterRecords()
  const taskMap = new Map(listRuntimeExecutionTasks().map((task) => [task.taskId, task] as const))
  const displayLabels = resolveOverrideDisplayLabels()
  const activeCommitments = listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = listCapacityFreezes({ status: 'ACTIVE' })
  const commitmentTaskIds = new Set(activeCommitments.map((item) => item.taskId))
  const freezeFactoryMap = new Map<string, Set<string>>()
  for (const freeze of activeFreezes) {
    const current = freezeFactoryMap.get(freeze.taskId) ?? new Set<string>()
    current.add(freeze.factoryId)
    freezeFactoryMap.set(freeze.taskId, current)
  }

  const processOptionMap = new Map<string, string>()
  const craftOptionMap = new Map<string, { label: string; processCode: string }>()
  const dailyRowMap = new Map<string, BottleneckDailyRowSeed>()
  const unallocatedSamByCraft = new Map<string, number>()
  const unallocatedSamByDate = new Map<string, number>()
  const unscheduledSamByCraft = new Map<string, number>()
  const unallocatedRows: CapacityBottleneckUnallocatedTaskRow[] = []
  const unscheduledRows: CapacityBottleneckUnscheduledTaskRow[] = []

  function registerIdentity(identity: TaskDemandIdentity): void {
    if (!processOptionMap.has(identity.processCode)) {
      processOptionMap.set(identity.processCode, identity.processName)
    }
    const craftKey = buildBottleneckCraftRowKey({
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    if (!craftOptionMap.has(craftKey)) {
      craftOptionMap.set(craftKey, {
        label: `${identity.processName} / ${identity.craftName}`,
        processCode: identity.processCode,
      })
    }
  }

  function getDailyRowSeed(
    date: string,
    factoryId: string,
    factoryName: string,
    identity: TaskDemandIdentity,
  ): BottleneckDailyRowSeed {
    const rowKey = buildBottleneckDailyRowKey({
      date,
      factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    const current = dailyRowMap.get(rowKey)
    if (current) return current
    const created: BottleneckDailyRowSeed = {
      rowKey,
      date,
      factoryId,
      factoryName,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      supplySam: 0,
      committedSam: 0,
      frozenSam: 0,
      committedTaskIds: new Set<string>(),
      frozenTaskIds: new Set<string>(),
    }
    dailyRowMap.set(rowKey, created)
    return created
  }

  for (const factory of factories) {
    for (const { row, entry } of listFactoryCapacityEntries(factory.id)) {
      const identity: TaskDemandIdentity = {
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
      }
      registerIdentity(identity)
      const dailySupplySam = roundSam(Math.max(computeFactoryCapacityEntryResult(row, entry.values).resultValue ?? 0, 0))
      for (const date of dates) {
        const seed = getDailyRowSeed(date, factory.id, factory.name, identity)
        seed.supplySam = roundSam(seed.supplySam + dailySupplySam)
      }
    }
  }

  const appendUsageRows = (
    items: CapacityCommitment[] | CapacityFreeze[],
    kind: 'COMMITTED' | 'FROZEN',
  ): void => {
    for (const item of items) {
      const identity = resolveUsageIdentity(item, taskMap, displayLabels)
      registerIdentity(identity)
      const schedule = buildUsageSchedule(
        {
          standardSamTotal: item.standardSamTotal,
          windowStartDate: item.windowStartDate,
          windowEndDate: item.windowEndDate,
        },
        '缺少可用日期窗口',
      )
      if (schedule.kind === 'UNSCHEDULED') continue
      const factory = getFactoryMasterRecordById(item.factoryId)
      const objectKey = buildBottleneckSourceObjectKey({
        taskId: item.taskId,
        allocationUnitId: item.allocationUnitId,
      })
      for (const allocation of schedule.allocations) {
        if (!dateSet.has(allocation.date)) continue
        const seed = getDailyRowSeed(allocation.date, item.factoryId, factory?.name ?? item.factoryId, identity)
        if (kind === 'COMMITTED') {
          seed.committedSam = roundSam(seed.committedSam + allocation.demandSam)
          seed.committedTaskIds.add(objectKey)
        } else {
          seed.frozenSam = roundSam(seed.frozenSam + allocation.demandSam)
          seed.frozenTaskIds.add(objectKey)
        }
      }
    }
  }

  appendUsageRows(activeCommitments, 'COMMITTED')
  appendUsageRows(activeFreezes, 'FROZEN')

  for (const task of taskMap.values()) {
    const sam = resolveRuntimeTaskPublishedSam(task)
    const totalStandardTime = roundSam(Math.max(sam.publishedSamTotal ?? 0, 0))
    if (!totalStandardTime) continue
    const identity = buildDemandIdentity(task)
    registerIdentity(identity)
    const schedule = buildTaskSchedule(task, totalStandardTime)
    const frozenFactoryCount = freezeFactoryMap.get(task.taskId)?.size ?? 0
    const hasCommitment = commitmentTaskIds.has(task.taskId)

    if (schedule.kind === 'UNSCHEDULED') {
      unscheduledRows.push({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        totalStandardTime,
        assignmentStatus: task.assignmentStatus,
        assignmentStatusLabel: resolveAssignmentStatusLabel(task.assignmentStatus),
        reason: schedule.reason ?? '缺少有效日期窗口',
        note: hasCommitment
          ? '当前任务已有正式承接对象，但缺少有效日期窗口。'
          : frozenFactoryCount > 0
            ? `当前任务已在 ${frozenFactoryCount} 家工厂形成冻结，但业务上仍未最终落厂。`
            : '当前任务尚未形成承接工厂，且缺少有效日期窗口。',
      })
      const craftKey = buildBottleneckCraftRowKey({
        processCode: identity.processCode,
        craftCode: identity.craftCode,
      })
      unscheduledSamByCraft.set(craftKey, roundSam((unscheduledSamByCraft.get(craftKey) ?? 0) + totalStandardTime))
      continue
    }

    if (!shouldTrackUnallocatedDemand(task) || hasCommitment) continue

    const visibleAllocations = schedule.allocations.filter((allocation) => dateSet.has(allocation.date))
    if (visibleAllocations.length === 0) continue

    unallocatedRows.push({
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      totalStandardTime,
      windowStartDate: visibleAllocations[0]?.date,
      windowEndDate: visibleAllocations.at(-1)?.date,
      windowText: buildTaskWindowText(task, totalStandardTime),
      assignmentStatus: task.assignmentStatus,
      assignmentStatusLabel: resolveAssignmentStatusLabel(task.assignmentStatus),
      frozenFactoryCount,
      note:
        frozenFactoryCount > 0
          ? `已在 ${frozenFactoryCount} 家工厂形成冻结，能力已预留，但业务仍未最终落厂。`
          : '当前尚未形成冻结或占用对象，仍在待分配需求池中。',
    })

    const craftKey = buildBottleneckCraftRowKey({
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    for (const allocation of visibleAllocations) {
      unallocatedSamByCraft.set(craftKey, roundSam((unallocatedSamByCraft.get(craftKey) ?? 0) + allocation.demandSam))
      unallocatedSamByDate.set(allocation.date, roundSam((unallocatedSamByDate.get(allocation.date) ?? 0) + allocation.demandSam))
    }
  }

  const dailyRows = [...dailyRowMap.values()]
    .map((row) => ({
      rowKey: row.rowKey,
      date: row.date,
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      supplySam: row.supplySam,
      committedSam: row.committedSam,
      frozenSam: row.frozenSam,
      remainingSam: calculateCapacityRemainingStandardHours({
        supplyStandardHours: row.supplySam,
        committedStandardHours: row.committedSam,
        frozenStandardHours: row.frozenSam,
      }),
      committedTaskCount: row.committedTaskIds.size,
      frozenTaskCount: row.frozenTaskIds.size,
    }))
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date)
      if (left.remainingSam !== right.remainingSam) return left.remainingSam - right.remainingSam
      const factoryCompare = left.factoryName.localeCompare(right.factoryName)
      if (factoryCompare !== 0) return factoryCompare
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })

  const craftRows = aggregateCraftBottlenecks(dailyRows, unallocatedSamByCraft, unscheduledSamByCraft)
  const dateRows = aggregateDateBottlenecks(dailyRows, unallocatedSamByDate)
  const selectedCraftKey = input?.craftCode
    ? buildBottleneckCraftRowKey({
        processCode: craftOptionMap.get(`${input.processCode ?? ''}::${input.craftCode}`)?.processCode ?? input?.processCode ?? '',
        craftCode: input.craftCode,
      })
    : undefined
  const selectedCraftOption = selectedCraftKey ? craftOptionMap.get(selectedCraftKey) : undefined
  const {
    processOptions,
    selectedProcessCode,
  } = buildBottleneckProcessOptions(processOptionMap, selectedCraftOption, input?.processCode)
  const craftOptions = buildBottleneckCraftOptions(craftOptionMap, selectedProcessCode)
  const selectedCraftCode =
    craftOptions.find((item) => item.value === `${selectedProcessCode}::${input?.craftCode ?? ''}`)?.value.split('::')[1]
    ?? (selectedCraftOption && selectedCraftOption.processCode === selectedProcessCode ? input?.craftCode : undefined)

  const filteredCraftRows = craftRows.filter((row) => {
    if (selectedCraftCode) return row.craftCode === selectedCraftCode
    if (selectedProcessCode) return row.processCode === selectedProcessCode
    return true
  })
  const allowedCraftKeys = new Set(filteredCraftRows.map((row) => row.rowKey))
  const filteredDateRows = dateRows
    .map((row) => {
      const detailRows = row.detailRows.filter((detail) => {
        const craftKey = buildBottleneckCraftRowKey({
          processCode: detail.processCode,
          craftCode: detail.craftCode,
        })
        return selectedCraftCode || selectedProcessCode ? allowedCraftKeys.has(craftKey) : true
      })
      const craftRemaining = new Map<string, number>()
      const overloadedFactories = new Set<string>()
      let supplySam = 0
      let committedSam = 0
      let frozenSam = 0
      let remainingSam = 0
      let maxGapSam = 0
      for (const detail of detailRows) {
        supplySam = roundSam(supplySam + detail.supplySam)
        committedSam = roundSam(committedSam + detail.committedSam)
        frozenSam = roundSam(frozenSam + detail.frozenSam)
        remainingSam = roundSam(remainingSam + detail.remainingSam)
        if (detail.remainingSam < 0) {
          overloadedFactories.add(detail.factoryId)
          maxGapSam = Math.max(maxGapSam, Math.abs(detail.remainingSam))
        }
        const craftKey = buildBottleneckCraftRowKey({
          processCode: detail.processCode,
          craftCode: detail.craftCode,
        })
        craftRemaining.set(craftKey, roundSam((craftRemaining.get(craftKey) ?? 0) + detail.remainingSam))
      }
      return {
        ...row,
        supplySam,
        committedSam,
        frozenSam,
        remainingSam,
        overloadedFactoryCount: overloadedFactories.size,
        overloadedCraftCount: [...craftRemaining.values()].filter((value) => value < 0).length,
        maxGapSam: roundSam(maxGapSam),
        detailRows,
      }
    })
    .filter((row) => row.detailRows.length > 0)
  const filteredUnallocatedRows = unallocatedRows.filter((row) => {
    if (selectedCraftCode) return row.craftCode === selectedCraftCode
    if (selectedProcessCode) return row.processCode === selectedProcessCode
    return true
  })
  const filteredUnscheduledRows = unscheduledRows.filter((row) => {
    if (selectedCraftCode) return row.craftCode === selectedCraftCode
    if (selectedProcessCode) return row.processCode === selectedProcessCode
    return true
  })

  const draft: CapacityBottleneckDraftData = {
    craftRows: filteredCraftRows,
    dateRows: filteredDateRows,
    unallocatedRows: filteredUnallocatedRows.sort((left, right) => {
      if (right.totalStandardTime !== left.totalStandardTime) return right.totalStandardTime - left.totalStandardTime
      return left.taskId.localeCompare(right.taskId)
    }),
    unscheduledRows: filteredUnscheduledRows.sort((left, right) => {
      if (right.totalStandardTime !== left.totalStandardTime) return right.totalStandardTime - left.totalStandardTime
      return left.taskId.localeCompare(right.taskId)
    }),
    processOptions,
    craftOptions,
    summary: {
      bottleneckCraftCount: 0,
      overloadedDateCount: 0,
      unallocatedTotal: 0,
      unscheduledTotal: 0,
      maxDailyGapSam: 0,
      maxCraftGapSam: 0,
    },
  }
  draft.summary = buildCapacityBottleneckSummary(draft)

  return {
    ...draft,
    windowOptions: FACTORY_CALENDAR_WINDOW_OPTIONS,
    windowDays,
  }
}

function getTaskRiskSeverity(conclusion: TaskSamRiskConclusion): number {
  const order: Record<TaskSamRiskConclusion, number> = {
    EXCEEDS_WINDOW: 5,
    TIGHT: 4,
    UNALLOCATED: 3,
    UNSCHEDULED: 2,
    CAPABLE: 1,
  }
  return order[conclusion]
}

function buildRiskWindowOverlapFilter(windowDays: FactoryCalendarWindowDays, today: Date = toDayStart(new Date())): {
  start: Date
  end: Date
} {
  const start = toDayStart(today)
  return {
    start,
    end: addDays(start, windowDays - 1),
  }
}

function doesWindowOverlapRange(
  row: Pick<CapacityRiskTaskRow, 'windowStartDate' | 'windowEndDate' | 'conclusion'>,
  range: { start: Date; end: Date },
): boolean {
  if (row.conclusion === 'UNSCHEDULED') return true
  const start = parseDateLike(row.windowStartDate)
  const end = parseDateLike(row.windowEndDate)
  if (!start || !end) return false
  return end.getTime() >= range.start.getTime() && start.getTime() <= range.end.getTime()
}

export function resolveTaskRiskWindow(task: RuntimeProcessTask) {
  return resolveCapacityStandardTimeWindow(task)
}

export function resolveTaskFactoryBinding(
  task: RuntimeProcessTask,
  activeCommitments: CapacityCommitment[],
  activeFreezes: CapacityFreeze[],
): TaskRiskFactoryBinding {
  const commitments = activeCommitments.filter((item) => item.taskId === task.taskId)
  const freezes = activeFreezes.filter((item) => item.taskId === task.taskId)

  const commitmentFactoryIds = Array.from(new Set(commitments.map((item) => item.factoryId)))
  if (commitmentFactoryIds.length > 0) {
    const factoryId = commitmentFactoryIds[0]
    const factory = getFactoryMasterRecordById(factoryId)
    return {
      kind: 'COMMITTED',
      factoryId,
      factoryName: factory?.name ?? task.assignedFactoryName ?? factoryId,
      reason:
        commitmentFactoryIds.length > 1
          ? `当前存在 ${commitmentFactoryIds.length} 条已占用承接记录，风险页按首个承接工厂展示。`
          : '当前任务已形成正式占用对象。',
    }
  }

  const freezeFactoryIds = Array.from(new Set(freezes.map((item) => item.factoryId)))
  if (freezeFactoryIds.length === 1) {
    const factoryId = freezeFactoryIds[0]
    const factory = getFactoryMasterRecordById(factoryId)
    return {
      kind: 'FROZEN',
      factoryId,
      factoryName: factory?.name ?? task.assignedFactoryName ?? factoryId,
      reason: '当前任务已形成单工厂冻结对象。',
    }
  }

  if (freezeFactoryIds.length > 1) {
    return {
      kind: 'UNALLOCATED',
      reason: `当前已有 ${freezeFactoryIds.length} 家工厂参与冻结，但尚未形成单一承接工厂。`,
    }
  }

  return {
    kind: 'UNALLOCATED',
    reason: '当前尚未形成冻结或占用对象，仍属于未落厂需求。',
  }
}

export function resolveTaskSamRisk(input: {
  task: RuntimeProcessTask
  evaluationContext?: CapacityStandardTimeEvaluationContext
  activeCommitments?: CapacityCommitment[]
  activeFreezes?: CapacityFreeze[]
}): CapacityRiskTaskRow {
  const task = input.task
  const sam = resolveRuntimeTaskPublishedSam(task)
  const identity = buildDemandIdentity(task)
  const totalStandardTime = roundSam(Math.max(sam.publishedSamTotal ?? 0, 0))
  const evaluationContext = input.evaluationContext ?? createCapacityStandardTimeEvaluationContext()
  const activeCommitments = input.activeCommitments ?? listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = input.activeFreezes ?? listCapacityFreezes({ status: 'ACTIVE' })
  const window = resolveTaskRiskWindow(task)
  const windowText =
    window.windowDays <= 0 && window.windowEndDate
      ? `${window.windowEndDate}（窗口已结束）`
      : buildFactoryCalendarWindowText(window.windowStartDate, window.windowEndDate)
  const binding = resolveTaskFactoryBinding(task, activeCommitments, activeFreezes)

  if (!totalStandardTime) {
    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      factoryId: binding.factoryId,
      factoryName: binding.factoryName,
      factoryBindingKind: binding.kind,
      totalStandardTime: 0,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNSCHEDULED',
      conclusionLabel: TASK_SAM_RISK_CONCLUSION_LABEL.UNSCHEDULED,
      reason: '当前任务缺少总标准工时，无法完成窗口风险判断。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  if (window.dateIncomplete) {
    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      factoryId: binding.factoryId,
      factoryName: binding.factoryName,
      factoryBindingKind: binding.kind,
      totalStandardTime,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNSCHEDULED',
      conclusionLabel: TASK_SAM_RISK_CONCLUSION_LABEL.UNSCHEDULED,
      reason: '缺少可用日期窗口，当前只能归入未排期风险。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  if (!binding.factoryId || binding.kind === 'UNALLOCATED') {
    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      factoryBindingKind: 'UNALLOCATED',
      totalStandardTime,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNALLOCATED',
      conclusionLabel: TASK_SAM_RISK_CONCLUSION_LABEL.UNALLOCATED,
      reason: binding.reason ?? '当前任务尚未落到具体工厂，因此无法形成工厂窗口承载判断。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  const judgement = resolveFactoryTaskStandardTimeJudgement({
    task,
    factoryId: binding.factoryId,
    evaluationContext,
  })

  let conclusion: TaskSamRiskConclusion = 'CAPABLE'
  if (judgement.status === 'RISK') conclusion = 'TIGHT'
  if (judgement.status === 'EXCEEDS_WINDOW') conclusion = 'EXCEEDS_WINDOW'
  if (judgement.status === 'DATE_INCOMPLETE' || judgement.status === 'SAM_MISSING') conclusion = 'UNSCHEDULED'

  const remainingAfterCurrentSam =
    Number.isFinite(judgement.windowRemainingSam) && Number.isFinite(judgement.taskDemandSam)
      ? roundSam((judgement.windowRemainingSam ?? 0) - (judgement.taskDemandSam ?? 0))
      : undefined

  const baseReason =
    conclusion === 'CAPABLE'
      ? `当前窗口供给 ${roundSam(judgement.windowSupplySam ?? 0)} 标准工时，扣除其他已占用 ${roundSam(judgement.windowCommittedSam ?? 0)} 和其他已冻结 ${roundSam(judgement.windowFrozenSam ?? 0)} 后，仍可承载当前任务。`
      : conclusion === 'TIGHT'
        ? `当前任务落入后，窗口仅剩 ${roundSam(remainingAfterCurrentSam ?? 0)} 标准工时，已进入紧张区间。`
        : conclusion === 'EXCEEDS_WINDOW'
          ? `窗口可承载余量仅 ${roundSam(judgement.windowRemainingSam ?? 0)} 标准工时，小于当前任务需要的 ${totalStandardTime} 标准工时。`
          : judgement.reason

  return {
    taskId: task.taskId,
    productionOrderId: task.productionOrderId,
    processCode: identity.processCode,
    processName: identity.processName,
    craftCode: identity.craftCode,
    craftName: identity.craftName,
    factoryId: binding.factoryId,
    factoryName: binding.factoryName,
    factoryBindingKind: binding.kind,
    totalStandardTime,
    windowStartDate: window.windowStartDate,
    windowEndDate: window.windowEndDate,
    windowText,
    windowDays: window.windowDays,
    windowSupplySam: roundSam(judgement.windowSupplySam ?? 0),
    otherCommittedSam: roundSam(judgement.windowCommittedSam ?? 0),
    otherFrozenSam: roundSam(judgement.windowFrozenSam ?? 0),
    remainingAfterCurrentSam,
    conclusion,
    conclusionLabel: TASK_SAM_RISK_CONCLUSION_LABEL[conclusion],
    reason: [baseReason, binding.reason].filter(Boolean).join(' '),
    usesFallbackRule: judgement.usesFallbackRule,
    fallbackRuleLabel: judgement.fallbackRuleLabel,
    taskStatus: task.status,
  }
}

export function groupTasksByProductionOrder(taskRows: CapacityRiskTaskRow[]): Map<string, CapacityRiskTaskRow[]> {
  const grouped = new Map<string, CapacityRiskTaskRow[]>()
  for (const row of taskRows) {
    const current = grouped.get(row.productionOrderId) ?? []
    current.push(row)
    grouped.set(row.productionOrderId, current)
  }
  return grouped
}

export function summarizeProductionOrderRisk(taskRows: CapacityRiskTaskRow[]): CapacityRiskOrderRow[] {
  const grouped = groupTasksByProductionOrder(taskRows)
  const orderIndex = new Map(productionOrders.map((order, index) => [order.productionOrderId, index] as const))

  return [...grouped.entries()]
    .map(([productionOrderId, rows]) => {
      const sortedBySeverity = [...rows].sort((left, right) => {
        if (getTaskRiskSeverity(right.conclusion) !== getTaskRiskSeverity(left.conclusion)) {
          return getTaskRiskSeverity(right.conclusion) - getTaskRiskSeverity(left.conclusion)
        }
        return right.totalStandardTime - left.totalStandardTime
      })
      const lead = sortedBySeverity[0]

      return {
        productionOrderId,
        totalStandardTime: roundSam(rows.reduce((sum, row) => sum + row.totalStandardTime, 0)),
        allocatedStandardTime: roundSam(
          rows.reduce((sum, row) => sum + (row.conclusion === 'CAPABLE' || row.conclusion === 'TIGHT' || row.conclusion === 'EXCEEDS_WINDOW' ? row.totalStandardTime : 0), 0),
        ),
        unallocatedStandardTime: roundSam(
          rows.reduce((sum, row) => sum + (row.conclusion === 'UNALLOCATED' ? row.totalStandardTime : 0), 0),
        ),
        unscheduledStandardTime: roundSam(
          rows.reduce((sum, row) => sum + (row.conclusion === 'UNSCHEDULED' ? row.totalStandardTime : 0), 0),
        ),
        taskCount: rows.length,
        highestRiskConclusion: lead.conclusion,
        highestRiskConclusionLabel: TASK_SAM_RISK_CONCLUSION_LABEL[lead.conclusion],
        mainRiskProcessName: lead.processName,
        mainRiskCraftName: lead.craftName,
        reason: lead.reason,
      } satisfies CapacityRiskOrderRow
    })
    .sort((left, right) => {
      if (getTaskRiskSeverity(right.highestRiskConclusion) !== getTaskRiskSeverity(left.highestRiskConclusion)) {
        return getTaskRiskSeverity(right.highestRiskConclusion) - getTaskRiskSeverity(left.highestRiskConclusion)
      }
      const leftIndex = orderIndex.get(left.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = orderIndex.get(right.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      if (leftIndex !== rightIndex) return leftIndex - rightIndex
      return left.productionOrderId.localeCompare(right.productionOrderId)
    })
}

function buildRiskProcessOptions(taskRows: CapacityRiskTaskRow[]): CapacityRiskFilterOption[] {
  const map = new Map<string, string>()
  for (const row of taskRows) {
    if (!map.has(row.processCode)) map.set(row.processCode, row.processName)
  }
  return [...map.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }))
}

function buildRiskCraftOptions(taskRows: CapacityRiskTaskRow[]): Array<CapacityRiskFilterOption & { processCode: string }> {
  const map = new Map<string, { label: string; processCode: string }>()
  for (const row of taskRows) {
    const key = `${row.processCode}::${row.craftCode}`
    if (!map.has(key)) {
      map.set(key, {
        label: `${row.processName} / ${row.craftName}`,
        processCode: row.processCode,
      })
    }
  }
  return [...map.entries()]
    .sort((left, right) => left[1].label.localeCompare(right[1].label))
    .map(([key, value]) => ({
      value: key,
      label: value.label,
      processCode: value.processCode,
    }))
}

function summarizeTaskRiskRows(rows: CapacityRiskTaskRow[]): CapacityRiskSummary {
  return {
    capableCount: rows.filter((row) => row.conclusion === 'CAPABLE').length,
    tightCount: rows.filter((row) => row.conclusion === 'TIGHT').length,
    exceedsWindowCount: rows.filter((row) => row.conclusion === 'EXCEEDS_WINDOW').length,
    unallocatedCount: rows.filter((row) => row.conclusion === 'UNALLOCATED').length,
    unscheduledCount: rows.filter((row) => row.conclusion === 'UNSCHEDULED').length,
  }
}

export function buildCapacityRiskData(): CapacityRiskData {
  const tasks = listRuntimeExecutionTasks()
  const activeCommitments = listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = listCapacityFreezes({ status: 'ACTIVE' })
  const evaluationContext = createCapacityStandardTimeEvaluationContext()

  const taskRows = tasks
    .map((task) =>
      resolveTaskSamRisk({
        task,
        evaluationContext,
        activeCommitments,
        activeFreezes,
      }),
    )
    .sort((left, right) => {
      if (getTaskRiskSeverity(right.conclusion) !== getTaskRiskSeverity(left.conclusion)) {
        return getTaskRiskSeverity(right.conclusion) - getTaskRiskSeverity(left.conclusion)
      }
      const leftStart = left.windowStartDate ?? '9999-12-31'
      const rightStart = right.windowStartDate ?? '9999-12-31'
      if (leftStart !== rightStart) return leftStart.localeCompare(rightStart)
      return left.taskId.localeCompare(right.taskId)
    })

  return {
    taskRows,
    orderRows: summarizeProductionOrderRisk(taskRows),
    processOptions: buildRiskProcessOptions(taskRows),
    craftOptions: buildRiskCraftOptions(taskRows),
    conclusionOptions: TASK_RISK_CONCLUSION_OPTIONS,
    windowOptions: FACTORY_CALENDAR_WINDOW_OPTIONS,
    summary: summarizeTaskRiskRows(taskRows),
  }
}

export function filterCapacityRiskTaskRows(input: {
  rows: CapacityRiskTaskRow[]
  keyword?: string
  processCode?: string
  craftValue?: string
  conclusion?: string
  windowDays?: number
}): CapacityRiskTaskRow[] {
  const keyword = (input.keyword ?? '').trim().toLowerCase()
  const craftCode = input.craftValue?.split('::')[1] ?? ''
  const range = buildRiskWindowOverlapFilter(resolveFactoryCalendarWindowDays(input.windowDays))

  return input.rows.filter((row) => {
    if (keyword) {
      const matchesKeyword = [
        row.taskId,
        row.productionOrderId,
        row.processName,
        row.craftName,
        row.factoryName,
        row.reason,
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(keyword))
      if (!matchesKeyword) return false
    }

    if (input.processCode && row.processCode !== input.processCode) return false
    if (craftCode && row.craftCode !== craftCode) return false
    if (input.conclusion && row.conclusion !== input.conclusion) return false
    if (!doesWindowOverlapRange(row, range)) return false
    return true
  })
}
