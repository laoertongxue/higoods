import {
  listCapacityCalendarOverrides,
  type CapacityCalendarOverrideRecord,
} from './capacity-calendar-overrides.ts'
import {
  CAPACITY_OVERLOAD_REMAINING_THRESHOLD,
  CAPACITY_TIGHT_THRESHOLD_RATIO,
  calculateCapacityRemainingValue,
} from './capacity-rules.ts'
import {
  createCapacityOutputValueEvaluationContext,
  listCapacityCommitments,
  listCapacityFreezes,
  resolveCapacityUsageTaskIdentity,
  resolveCapacityOutputValueWindow,
  resolveFactoryTaskOutputValueJudgement,
  type CapacityOutputValueEvaluationContext,
  type CapacityCommitment,
  type CapacityFreeze,
} from './capacity-usage-ledger.ts'
import {
  computeFactoryCapacityEntryResult,
  getFactoryCapacityEquipmentSummary,
  listFactoryCapacityEntries,
} from './factory-capacity-profile-mock.ts'
import {
  getFactoryMasterRecordById,
  listBusinessFactoryMasterRecords,
  listFactoryMasterRecords,
} from './factory-master-store.ts'
import {
  assertProcessCraftExists,
  getActiveCraftOptionsByProcess,
  getActiveProcessOptions,
  getCapacityNodeProcessCraftOptions,
  getCapacityProcessCraftOptions,
  resolveProcessCraft,
} from './process-craft-dict.ts'
import {
  listRuntimeExecutionTasks,
  resolveRuntimeAllocatableGroupOutputValue,
  resolveRuntimeTaskOutputValue,
  type RuntimeProcessTask,
  type RuntimeTaskAllocatableGroup,
} from './runtime-process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import { getProductionOrderProcessEntries } from './production-order-tech-pack-runtime.ts'

export type CapacityCalendarStatus = 'NORMAL' | 'TIGHT' | 'OVERLOADED' | 'PAUSED'
export type CapacityCalendarConstraintStatus = CapacityCalendarStatus | 'DATE_INCOMPLETE' | 'VALUE_MISSING'

export const CAPACITY_CALENDAR_STATUS_LABEL: Record<CapacityCalendarStatus, string> = {
  NORMAL: '正常',
  TIGHT: '紧张',
  OVERLOADED: '超载',
  PAUSED: '暂停',
}

export const CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL: Record<CapacityCalendarConstraintStatus, string> = {
  ...CAPACITY_CALENDAR_STATUS_LABEL,
  DATE_INCOMPLETE: '日期不足',
  VALUE_MISSING: '产值缺失',
}

export type CapacityStatusBadgeTone = 'normal' | 'warning' | 'danger' | 'muted'

export interface CapacityStatusBadgeMeta {
  label: string
  tone: CapacityStatusBadgeTone
}

export interface CapacityStatusSnapshot {
  status: CapacityCalendarStatus
  statusLabel: string
  reason: string
  availableValue: number
  usedValue: number
  frozenValue: number
  remainingValue: number
  overload: boolean
  pauseOverrideId?: string
  pauseOverrideNote?: string
  pauseScopeLabel?: string
}

export interface CapacityCalendarSummary {
  supplyTotal: number
  committedTotal: number
  frozenTotal: number
  remainingTotal: number
  unallocatedTotal: number
  unscheduledTotal: number
  missingOutputValueCount: number
}

export interface CapacityCalendarComparisonRow {
  date: string
  factoryId: string
  factoryName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  baseSupplyValue: number
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
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
  demandValue: number
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
  outputValueTotal: number
  assignmentStatus: string
  assignmentMode: string
  factoryName: string
  reason: string
}

export interface CapacityCalendarMissingOutputValueRow {
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
  missingOutputValueRows: CapacityCalendarMissingOutputValueRow[]
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
  baseSupplyValue: number
  supplyValue: number
  committedValue: number
  frozenValue: number
  proposedDemandValue: number
  projectedCommittedValue: number
  projectedRemainingValue: number
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

export interface CapacityFactoryWindowJudgement {
  status: CapacityCalendarConstraintStatus
  statusLabel: string
  reason: string
  decision: 'ALLOW' | 'WARN' | 'BLOCK'
  hardBlocked: boolean
  warning: boolean
  dateIncomplete: boolean
  usesParentWindow: boolean
  availableValue: number
  usedValue: number
  frozenValue: number
  remainingValue: number
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
  outputValueTotal: number
  dailyValue: number
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
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
  status: CapacityCalendarStatus
  statusReason: string
  pauseOverrideId?: string
  pauseOverrideNote?: string
  pauseScopeLabel?: string
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
  normalCount: number
  tightCount: number
  overloadedCount: number
  pausedCount: number
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

export type TaskOutputValueRiskConclusion =
  | 'CAPABLE'
  | 'TIGHT'
  | 'EXCEEDS_WINDOW'
  | 'PAUSED'
  | 'FROZEN_PENDING'
  | 'UNALLOCATED'
  | 'UNSCHEDULED'

export const TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL: Record<TaskOutputValueRiskConclusion, string> = {
  CAPABLE: '可承载',
  TIGHT: '紧张',
  EXCEEDS_WINDOW: '超出窗口',
  PAUSED: '暂停',
  FROZEN_PENDING: '已冻结待确认',
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
  factoryBindingKind: 'COMMITTED' | 'FROZEN_PENDING' | 'UNALLOCATED'
  bindingFactoryCount?: number
  totalOutputValue: number
  windowStartDate?: string
  windowEndDate?: string
  windowText: string
  windowDays: number
  windowSupplyValue?: number
  otherCommittedValue?: number
  otherFrozenValue?: number
  remainingAfterCurrentValue?: number
  frozenOutputValue?: number
  frozenWindowStartDate?: string
  frozenWindowEndDate?: string
  frozenWindowText?: string
  conclusion: TaskOutputValueRiskConclusion
  conclusionLabel: string
  reason: string
  usesFallbackRule: boolean
  fallbackRuleLabel?: string
  taskStatus: string
}

export interface CapacityRiskOrderRow {
  productionOrderId: string
  totalOutputValue: number
  allocatedOutputValue: number
  frozenPendingOutputValue: number
  unallocatedOutputValue: number
  unscheduledOutputValue: number
  taskCount: number
  highestRiskConclusion: TaskOutputValueRiskConclusion
  highestRiskConclusionLabel: string
  mainRiskProcessName?: string
  mainRiskCraftName?: string
  reason: string
}

export interface CapacityRiskSummary {
  capableCount: number
  tightCount: number
  exceedsWindowCount: number
  pausedCount: number
  frozenPendingCount: number
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
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
  status: CapacityCalendarStatus
}

export interface CapacityBottleneckCraftDetailFactoryRow {
  factoryId: string
  factoryName: string
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
}

export interface CapacityBottleneckCraftRow {
  rowKey: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  windowSupplyValue: number
  windowCommittedValue: number
  windowFrozenValue: number
  windowRemainingValue: number
  overloadDayCount: number
  tightDayCount: number
  pausedDayCount: number
  factoryCount: number
  unallocatedValue: number
  unscheduledValue: number
  maxGapValue: number
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
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
  status: CapacityCalendarStatus
  committedTaskCount: number
  frozenTaskCount: number
}

export interface CapacityBottleneckDateRow {
  date: string
  supplyValue: number
  committedValue: number
  frozenValue: number
  remainingValue: number
  overloadedFactoryCount: number
  overloadedCraftCount: number
  pausedFactoryCount: number
  tightCraftCount: number
  unallocatedValue: number
  maxGapValue: number
  detailRows: CapacityBottleneckDateDetailRow[]
}

export interface CapacityBottleneckUnallocatedTaskRow {
  taskId: string
  productionOrderId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  totalOutputValue: number
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
  totalOutputValue: number
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
  maxDailyGapValue: number
  maxCraftGapValue: number
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
  allocations: Array<{ date: string; demandValue: number }>
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
  baseSupplyValue: number
  supplyValue: number
  committedValue: number
  frozenValue: number
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
  supplyValue: number
  committedValue: number
  frozenValue: number
  committedSources: FactoryCalendarSourceRow[]
  frozenSources: FactoryCalendarSourceRow[]
  committedObjectKeys: Set<string>
  frozenObjectKeys: Set<string>
}

export interface TaskBindingState {
  kind: 'COMMITTED' | 'FROZEN_PENDING' | 'UNALLOCATED'
  factoryId?: string
  factoryName?: string
  factoryIds: string[]
  factoryNames: string[]
  frozenFactoryCount: number
  frozenOutputValue: number
  frozenWindowStartDate?: string
  frozenWindowEndDate?: string
  frozenWindowText?: string
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
  supplyValue: number
  committedValue: number
  frozenValue: number
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
  { value: 'CAPABLE', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.CAPABLE },
  { value: 'TIGHT', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.TIGHT },
  { value: 'EXCEEDS_WINDOW', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.EXCEEDS_WINDOW },
  { value: 'PAUSED', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.PAUSED },
  { value: 'FROZEN_PENDING', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.FROZEN_PENDING },
  { value: 'UNALLOCATED', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.UNALLOCATED },
  { value: 'UNSCHEDULED', label: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.UNSCHEDULED },
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

function roundOutputValue(value: number): number {
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

function normalizeTaskDemandIdentity(identity: TaskDemandIdentity): TaskDemandIdentity {
  const resolved = assertProcessCraftExists(
    identity.processCode,
    identity.craftCode,
    `产能任务字典映射 ${identity.processCode} / ${identity.craftCode}`,
  )

  return {
    processCode: resolved.processCode,
    processName: resolved.processName,
    craftCode: resolved.craftCode,
    craftName: resolved.craftName,
  }
}

function resolvePostRollupCraftCode(task: RuntimeProcessTask): string {
  const childProcessCodes = Array.from(
    new Set(
      (task.rolledUpChildProcessCodes ?? [])
        .map((item) => item.trim())
        .filter((item) => Boolean(item))
        .filter((item) => Boolean(resolveProcessCraft('POST_FINISHING', item))),
    ),
  )

  if (childProcessCodes.length === 0) return task.craftCode ?? ''
  if (childProcessCodes.length === 1) return childProcessCodes[0]

  const nodeValueByProcessCode = new Map<string, number>()
  const childProcessCodeSet = new Set(childProcessCodes)
  for (const entry of getProductionOrderProcessEntries(task.productionOrderId)) {
    if (!childProcessCodeSet.has(entry.processCode)) continue
    if (!resolveProcessCraft('POST_FINISHING', entry.processCode)) continue
    const outputValuePerUnit = Number(entry.outputValuePerUnit)
    if (!Number.isFinite(outputValuePerUnit) || outputValuePerUnit <= 0) continue
    nodeValueByProcessCode.set(
      entry.processCode,
      roundOutputValue((nodeValueByProcessCode.get(entry.processCode) ?? 0) + outputValuePerUnit),
    )
  }

  return childProcessCodes
    .slice()
    .sort((left, right) => {
      const rightValue = nodeValueByProcessCode.get(right) ?? 0
      const leftValue = nodeValueByProcessCode.get(left) ?? 0
      if (rightValue !== leftValue) return rightValue - leftValue
      return left.localeCompare(right)
    })[0]
}

function resolveDemandIdentityFromSourceEntry(task: RuntimeProcessTask): TaskDemandIdentity | null {
  const sourceEntryId = task.sourceEntryId?.trim()
  if (!sourceEntryId) return null

  const matchedEntry = getProductionOrderProcessEntries(task.productionOrderId).find(
    (entry) => entry.id === sourceEntryId,
  )
  if (!matchedEntry?.craftCode) return null

  return normalizeTaskDemandIdentity({
    processCode: matchedEntry.processCode,
    craftCode: matchedEntry.craftCode,
    processName: matchedEntry.processName,
    craftName: matchedEntry.craftName ?? matchedEntry.craftCode,
  })
}

function buildDemandIdentity(task: RuntimeProcessTask): TaskDemandIdentity {
  const resolvedProcessCode = task.processBusinessCode ?? task.processCode
  if (resolvedProcessCode === 'POST_FINISHING') {
    const craftCode = resolvePostRollupCraftCode(task)
    if (!craftCode) {
      return normalizeTaskDemandIdentity({
        processCode: resolvedProcessCode,
        craftCode: 'IRONING',
        processName: task.processBusinessName ?? task.processNameZh ?? resolvedProcessCode,
        craftName: '熨烫',
      })
    }
    return normalizeTaskDemandIdentity({
      processCode: resolvedProcessCode,
      craftCode,
      processName: task.processBusinessName ?? task.processNameZh ?? resolvedProcessCode,
      craftName: task.craftName ?? task.processBusinessName ?? task.processNameZh ?? craftCode,
    })
  }

  const rawCraftCode = task.craftCode?.trim() ?? ''
  const hasDirectDictionaryMapping = Boolean(
    task.processBusinessCode && rawCraftCode && resolveProcessCraft(task.processBusinessCode, rawCraftCode),
  )

  if (!hasDirectDictionaryMapping) {
    const sourceEntryIdentity = resolveDemandIdentityFromSourceEntry(task)
    if (sourceEntryIdentity) return sourceEntryIdentity
  }

  const resolvedIdentity = resolveCapacityUsageTaskIdentity({
    processCode: task.processCode,
    processBusinessCode: task.processBusinessCode,
    craftCode: task.craftCode,
    craftName: task.craftName,
    rolledUpChildProcessCodes: task.rolledUpChildProcessCodes,
  })
  if (resolvedIdentity) {
    return normalizeTaskDemandIdentity({
      processCode: resolvedIdentity.processCode,
      craftCode: resolvedIdentity.craftCode,
      processName: task.processBusinessName ?? task.processNameZh ?? resolvedIdentity.processCode,
      craftName: task.craftName ?? task.processBusinessName ?? task.processNameZh ?? resolvedIdentity.craftCode,
    })
  }

  const fallbackCraftCode = rawCraftCode || resolvedProcessCode
  return normalizeTaskDemandIdentity({
    processCode: resolvedProcessCode,
    craftCode: fallbackCraftCode,
    processName: task.processBusinessName ?? task.processNameZh ?? resolvedProcessCode,
    craftName: task.craftName ?? task.processBusinessName ?? task.processNameZh ?? fallbackCraftCode,
  })
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
    outputValueTotal: number
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
          allocations: [{ date: dates[0], demandValue: roundOutputValue(input.outputValueTotal) }],
        }
      }
      const average = roundOutputValue(input.outputValueTotal / dates.length)
      let assigned = 0
      return {
        kind: 'WINDOW',
        allocations: dates.map((date, index) => {
          if (index === dates.length - 1) {
            return {
              date,
              demandValue: roundOutputValue(input.outputValueTotal - assigned),
            }
          }
          assigned = roundOutputValue(assigned + average)
          return { date, demandValue: average }
        }),
      }
    }
  }

  const singleDate = startDate ?? endDate
  if (singleDate) {
    return {
      kind: 'SINGLE',
      allocations: [{ date: formatDateKey(toDayStart(singleDate)), demandValue: roundOutputValue(input.outputValueTotal) }],
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
): TaskDemandIdentity | null {
  const task = taskMap.get(input.taskId)
  if (task) {
    return buildDemandIdentity(task)
  }

  const resolved = resolveCapacityUsageTaskIdentity({
    processCode: input.processCode,
    craftCode: input.craftCode,
    craftName: displayLabels.get(`${input.processCode}::${input.craftCode}`)?.craftName,
  })
  if (!resolved) return null

  return normalizeTaskDemandIdentity({
    processCode: resolved.processCode,
    craftCode: resolved.craftCode,
    processName: displayLabels.get(`${resolved.processCode}::${resolved.craftCode}`)?.processName
      ?? displayLabels.get(`${input.processCode}::${input.craftCode}`)?.processName
      ?? resolved.processCode,
    craftName: displayLabels.get(`${resolved.processCode}::${resolved.craftCode}`)?.craftName
      ?? displayLabels.get(`${input.processCode}::${input.craftCode}`)?.craftName
      ?? resolved.craftCode,
  })
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

function buildTaskWindowText(task: RuntimeProcessTask, outputValueTotal: number): string {
  const schedule = buildTaskSchedule(task, outputValueTotal)
  if (schedule.kind === 'UNSCHEDULED') return '日期不足'
  const first = schedule.allocations[0]?.date
  const last = schedule.allocations.at(-1)?.date
  if (!first && !last) return '日期不足'
  return buildFactoryCalendarWindowText(first, last)
}

function buildBottleneckSourceObjectKey(input: { taskId: string; allocationUnitId?: string }): string {
  return `${input.taskId}::${input.allocationUnitId ?? ''}`
}

function buildTaskSchedule(task: RuntimeProcessTask, outputValueTotal: number): TaskScheduleResolution {
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
            allocations: [{ date: dates[0], demandValue: roundOutputValue(outputValueTotal) }],
          }
        }

        const average = roundOutputValue(outputValueTotal / dates.length)
        let assigned = 0
        return {
          kind: 'WINDOW',
          allocations: dates.map((date, index) => {
            if (index === dates.length - 1) {
              return {
                date,
                demandValue: roundOutputValue(outputValueTotal - assigned),
              }
            }
            assigned = roundOutputValue(assigned + average)
            return { date, demandValue: average }
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
        allocations: [{ date: formatDateKey(toDayStart(singleDate)), demandValue: roundOutputValue(outputValueTotal) }],
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
  for (const factory of listBusinessFactoryMasterRecords()) {
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

export function buildCapacityStatusBadge(status: CapacityCalendarStatus): CapacityStatusBadgeMeta {
  if (status === 'PAUSED') return { label: CAPACITY_CALENDAR_STATUS_LABEL[status], tone: 'danger' }
  if (status === 'OVERLOADED') return { label: CAPACITY_CALENDAR_STATUS_LABEL[status], tone: 'danger' }
  if (status === 'TIGHT') return { label: CAPACITY_CALENDAR_STATUS_LABEL[status], tone: 'warning' }
  return { label: CAPACITY_CALENDAR_STATUS_LABEL[status], tone: 'normal' }
}

export function computeCapacityStatus(input: {
  baseSupplyValue?: number
  availableValue: number
  usedValue: number
  frozenValue: number
  pauseHit?: PauseOverrideHit | null
}): CapacityStatusSnapshot {
  const availableValue = roundOutputValue(Math.max(input.availableValue, 0))
  const usedValue = roundOutputValue(Math.max(input.usedValue, 0))
  const frozenValue = roundOutputValue(Math.max(input.frozenValue, 0))
  const remainingValue = calculateCapacityRemainingValue({
    supplyValue: availableValue,
    committedValue: usedValue,
    frozenValue: frozenValue,
  })

  if (input.pauseHit) {
    return {
      status: 'PAUSED',
      statusLabel: CAPACITY_CALENDAR_STATUS_LABEL.PAUSED,
      reason: `命中暂停例外：${input.pauseHit.scopeLabel}，${input.pauseHit.note}`,
      availableValue,
      usedValue,
      frozenValue,
      remainingValue,
      overload: remainingValue < CAPACITY_OVERLOAD_REMAINING_THRESHOLD,
      pauseOverrideId: input.pauseHit.id,
      pauseOverrideNote: input.pauseHit.note,
      pauseScopeLabel: input.pauseHit.scopeLabel,
    }
  }

  if (remainingValue < CAPACITY_OVERLOAD_REMAINING_THRESHOLD) {
    return {
      status: 'OVERLOADED',
      statusLabel: CAPACITY_CALENDAR_STATUS_LABEL.OVERLOADED,
      reason: `剩余 ${roundOutputValue(remainingValue)} 产值，当前供给已不足以覆盖已占用 ${usedValue} 和已冻结 ${frozenValue}。`,
      availableValue,
      usedValue,
      frozenValue,
      remainingValue,
      overload: true,
    }
  }

  if (availableValue > 0 && remainingValue / availableValue < CAPACITY_TIGHT_THRESHOLD_RATIO) {
    return {
      status: 'TIGHT',
      statusLabel: CAPACITY_CALENDAR_STATUS_LABEL.TIGHT,
      reason: `剩余 ${roundOutputValue(remainingValue)} 产值，占当前供给 ${roundOutputValue((remainingValue / availableValue) * 100)}%，已进入紧张区间。`,
      availableValue,
      usedValue,
      frozenValue,
      remainingValue,
      overload: false,
    }
  }

  return {
    status: 'NORMAL',
    statusLabel: CAPACITY_CALENDAR_STATUS_LABEL.NORMAL,
    reason:
      (input.baseSupplyValue ?? availableValue) > 0
        ? `当前供给 ${availableValue} 产值，扣除已占用 ${usedValue} 和已冻结 ${frozenValue} 后，仍有 ${roundOutputValue(remainingValue)} 产值可继续承接。`
        : '当前窗口暂无供给，也没有命中暂停例外。',
    availableValue,
    usedValue,
    frozenValue,
    remainingValue,
    overload: false,
  }
}

export function isCapacityPaused(
  input: {
    date: string
    factoryId: string
    processCode: string
    craftCode: string
  },
  overrides: CapacityCalendarOverrideRecord[] = listCapacityCalendarOverrides(),
  overrideLabels: Map<string, { processName?: string; craftName?: string }> = resolveOverrideDisplayLabels(),
): boolean {
  return Boolean(resolvePauseOverride(overrides, overrideLabels, input))
}

export function resolveFactoryWindowStatus(
  input: {
    date: string
    factoryId: string
    processCode: string
    craftCode: string
    baseSupplyValue?: number
    supplyValue: number
    committedValue: number
    frozenValue: number
  },
  options?: {
    overrides?: CapacityCalendarOverrideRecord[]
    overrideLabels?: Map<string, { processName?: string; craftName?: string }>
  },
): CapacityStatusSnapshot {
  const overrides = options?.overrides ?? listCapacityCalendarOverrides()
  const overrideLabels = options?.overrideLabels ?? resolveOverrideDisplayLabels()
  const pauseHit = resolvePauseOverride(overrides, overrideLabels, input)
  return computeCapacityStatus({
    baseSupplyValue: input.baseSupplyValue ?? input.supplyValue,
    availableValue: pauseHit ? 0 : input.supplyValue,
    usedValue: input.committedValue,
    frozenValue: input.frozenValue,
    pauseHit,
  })
}

function resolveCalendarRowStatus(input: {
  date: string
  factoryId: string
  processCode: string
  craftCode: string
  baseSupplyValue: number
  supplyValue: number
  committedValue: number
  frozenValue: number
  overrides?: CapacityCalendarOverrideRecord[]
  overrideLabels?: Map<string, { processName?: string; craftName?: string }>
}): Pick<CapacityCalendarComparisonRow, 'status' | 'statusReason' | 'remainingValue' | 'overload' | 'pauseOverrideId' | 'pauseOverrideNote' | 'pauseScopeLabel'> {
  const resolved = resolveFactoryWindowStatus(
    {
      date: input.date,
      factoryId: input.factoryId,
      processCode: input.processCode,
      craftCode: input.craftCode,
      baseSupplyValue: input.baseSupplyValue,
      supplyValue: input.supplyValue,
      committedValue: input.committedValue,
      frozenValue: input.frozenValue,
    },
    {
      overrides: input.overrides,
      overrideLabels: input.overrideLabels,
    },
  )

  return {
    status: resolved.status,
    statusReason: resolved.reason,
    remainingValue: resolved.remainingValue,
    overload: resolved.overload,
    pauseOverrideId: resolved.pauseOverrideId,
    pauseOverrideNote: resolved.pauseOverrideNote,
    pauseScopeLabel: resolved.pauseScopeLabel,
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
    VALUE_MISSING: 1,
  }
  return order[status]
}

function buildConstraintReason(result: CapacityCalendarTaskConstraintAllocation): string {
  if (result.status === 'PAUSED') {
    return `${result.date} 命中暂停例外，${result.reason}`
  }

  if (result.status === 'OVERLOADED') {
    return `${result.date} 已超载：预计已占用 ${roundOutputValue(result.projectedCommittedValue)} 产值，可供给 ${roundOutputValue(result.supplyValue)} 产值`
  }

  if (result.status === 'TIGHT') {
    const ratio = result.supplyValue > 0 ? roundOutputValue((result.projectedRemainingValue / result.supplyValue) * 100) : 0
    return `${result.date} 能力紧张：剩余 ${roundOutputValue(result.projectedRemainingValue)} 产值，占可供给 ${ratio}%`
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
  const outputValue = input.allocatableGroup
    ? resolveRuntimeAllocatableGroupOutputValue(input.task, input.allocatableGroup)
    : resolveRuntimeTaskOutputValue(input.task)
  const outputValueTotal = outputValue.outputValueTotal

  if (!outputValueTotal || outputValueTotal <= 0) {
    return {
      factoryId: input.factoryId,
      factoryName,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      status: 'VALUE_MISSING',
      decision: 'WARN',
      hardBlocked: false,
      warning: true,
      dateIncomplete: false,
      usesParentWindow: Boolean(input.allocatableGroup),
      reason: '当前任务缺少可用的产值，无法完成产能状态校验。',
      allocations: [],
    }
  }

  const schedule = buildTaskSchedule(input.task, outputValueTotal)
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
    const currentTaskAlreadyCommitted = row?.committedTaskIds.includes(input.task.taskId) ?? false
    const baseSupplyValue = row?.baseSupplyValue ?? row?.supplyValue ?? 0
    const supplyValue = pauseHit ? 0 : (row?.supplyValue ?? 0)
    const baselineCommitted = roundOutputValue(
      Math.max((row?.committedValue ?? 0) - (currentTaskAlreadyCommitted ? allocation.demandValue : 0), 0),
    )
    const baselineFrozen = roundOutputValue(row?.frozenValue ?? 0)
    const projectedCommittedValue = roundOutputValue(baselineCommitted + allocation.demandValue)
    const resolved = resolveCalendarRowStatus({
      date: allocation.date,
      factoryId: input.factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
      baseSupplyValue,
      supplyValue,
      committedValue: projectedCommittedValue,
      frozenValue: baselineFrozen,
      overrides,
      overrideLabels,
    })

    return {
      date: allocation.date,
      baseSupplyValue,
      supplyValue,
      committedValue: baselineCommitted,
      frozenValue: baselineFrozen,
      proposedDemandValue: allocation.demandValue,
      projectedCommittedValue,
      projectedRemainingValue: resolved.remainingValue,
      status: resolved.status,
      reason:
        resolved.status === 'PAUSED'
          ? resolved.statusReason
          : buildConstraintReason({
              date: allocation.date,
              baseSupplyValue,
              supplyValue,
              committedValue: baselineCommitted,
              proposedDemandValue: allocation.demandValue,
              projectedCommittedValue,
              projectedRemainingValue: resolved.remainingValue,
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

export function resolveFactoryTaskWindowJudgement(input: {
  task: RuntimeProcessTask
  factoryId: string
  factoryName?: string
  allocatableGroup?: Pick<RuntimeTaskAllocatableGroup, 'qty' | 'detailRowKeys' | 'groupKey' | 'groupLabel'>
  evaluationContext?: CapacityCalendarEvaluationContext
}): CapacityFactoryWindowJudgement {
  const result = evaluateRuntimeTaskCapacityConstraint(input)
  return {
    status: result.status,
    statusLabel: CAPACITY_CALENDAR_CONSTRAINT_STATUS_LABEL[result.status],
    reason: result.reason,
    decision: result.decision,
    hardBlocked: result.hardBlocked,
    warning: result.warning,
    dateIncomplete: result.dateIncomplete,
    usesParentWindow: result.usesParentWindow,
    availableValue: roundOutputValue(result.allocations.reduce((sum, item) => sum + item.supplyValue, 0)),
    usedValue: roundOutputValue(result.allocations.reduce((sum, item) => sum + item.committedValue, 0)),
    frozenValue: roundOutputValue(result.allocations.reduce((sum, item) => sum + item.frozenValue, 0)),
    remainingValue: roundOutputValue(result.allocations.reduce((sum, item) => sum + item.projectedRemainingValue, 0)),
    allocations: result.allocations,
  }
}

export function buildCapacityCalendarData(): CapacityCalendarData {
  const comparisonMap = new Map<string, UsageDailyRowSeed>()
  const unallocatedMap = new Map<string, CapacityCalendarUnallocatedRow>()
  const unscheduledRows: CapacityCalendarUnscheduledRow[] = []
  const missingOutputValueRows: CapacityCalendarMissingOutputValueRow[] = []
  const scheduledDateSet = new Set<string>()
  const relevantCraftKeys = new Set<string>()
  const overrideLabels = resolveOverrideDisplayLabels()
  const overrides = listCapacityCalendarOverrides()
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
      baseSupplyValue: 0,
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
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
      outputValueTotal: roundOutputValue(input.outputValueTotal),
    })
  }

  for (const commitment of activeCommitments) {
    const identity = resolveUsageIdentity(commitment, taskMap, overrideLabels)
    if (!identity) continue
    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const task = taskMap.get(commitment.taskId)
    const schedule = buildUsageSchedule(
      {
        outputValueTotal: commitment.outputValueTotal,
        windowStartDate: commitment.windowStartDate,
        windowEndDate: commitment.windowEndDate,
      },
      '占用对象缺少日期窗口，当前进入未排期需求。',
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
        outputValueTotal: commitment.outputValueTotal,
        assignmentStatus: task?.assignmentStatus ?? 'AWARDED',
        assignmentMode: task?.assignmentMode ?? 'DIRECT',
        factoryName:
          getFactoryMasterRecordById(commitment.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? commitment.factoryId,
        reason: schedule.reason ?? '占用对象缺少有效日期窗口。',
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
      row.committedValue = roundOutputValue(row.committedValue + allocation.demandValue)
      row.committedTaskIds = appendUnique(row.committedTaskIds, commitment.taskId)
      row.taskIds = appendUnique(row.taskIds, commitment.taskId)
    }
  }

  for (const freeze of activeFreezes) {
    const identity = resolveUsageIdentity(freeze, taskMap, overrideLabels)
    if (!identity) continue
    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const task = taskMap.get(freeze.taskId)
    const schedule = buildUsageSchedule(
      {
        outputValueTotal: freeze.outputValueTotal,
        windowStartDate: freeze.windowStartDate,
        windowEndDate: freeze.windowEndDate,
      },
      '冻结对象缺少日期窗口，当前进入未排期需求。',
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
        outputValueTotal: freeze.outputValueTotal,
        assignmentStatus: task?.assignmentStatus ?? 'DIRECT_ASSIGNED',
        assignmentMode: task?.assignmentMode ?? 'DIRECT',
        factoryName:
          getFactoryMasterRecordById(freeze.factoryId)?.name
          ?? task?.assignedFactoryName
          ?? freeze.factoryId,
        reason: schedule.reason ?? '冻结对象缺少有效日期窗口。',
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
      row.frozenValue = roundOutputValue(row.frozenValue + allocation.demandValue)
      row.frozenTaskIds = appendUnique(row.frozenTaskIds, freeze.taskId)
      row.taskIds = appendUnique(row.taskIds, freeze.taskId)
    }
  }

  for (const task of tasks) {
    const outputValue = resolveRuntimeTaskOutputValue(task)
    const outputValueTotal = outputValue.outputValueTotal
    const identity = buildDemandIdentity(task)

    if (!outputValueTotal || outputValueTotal <= 0) {
      missingOutputValueRows.push({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        reason: '任务对象缺少可用的总产值，当前无法参与供需对比。',
      })
      continue
    }

    if (coveredTaskIds.has(task.taskId)) continue
    if (!shouldTrackUnallocatedDemand(task)) continue

    relevantCraftKeys.add(`${identity.processCode}::${identity.craftCode}`)
    const schedule = buildTaskSchedule(task, outputValueTotal)

    if (schedule.kind === 'UNSCHEDULED') {
      pushUnscheduledRow({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        demandType: '待分配需求',
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        outputValueTotal: outputValueTotal,
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
        demandValue: 0,
        taskCount: 0,
        assignmentStatuses: [],
        taskIds: [],
      }
      current.demandValue = roundOutputValue(current.demandValue + allocation.demandValue)
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
  for (const factory of listBusinessFactoryMasterRecords()) {
    const entries = listFactoryCapacityEntries(factory.id)
    for (const { row, entry } of entries) {
      const craftKey = `${row.processCode}::${row.craftCode}`
      if (activeCraftKeys.size > 0 && !activeCraftKeys.has(craftKey)) continue

      const computed = computeFactoryCapacityEntryResult(
        row,
        entry.values,
        getFactoryCapacityEquipmentSummary(factory.id, row.processCode, row.craftCode),
      )
      const baseSupplyValue = roundOutputValue(Math.max(computed.resultValue ?? 0, 0))

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
        current.baseSupplyValue = roundOutputValue(current.baseSupplyValue + baseSupplyValue)
        current.supplyValue = roundOutputValue(current.supplyValue + baseSupplyValue)
      }
    }
  }

  const comparisonRows = [...comparisonMap.values()]
    .map((row) => {
      const resolved = resolveCalendarRowStatus({
        date: row.date,
        factoryId: row.factoryId,
        processCode: row.processCode,
        craftCode: row.craftCode,
        baseSupplyValue: row.baseSupplyValue,
        supplyValue: row.supplyValue,
        committedValue: row.committedValue,
        frozenValue: row.frozenValue,
        overrides,
        overrideLabels,
      })
      const committedTaskIds = Array.from(new Set(row.committedTaskIds))
      const frozenTaskIds = Array.from(new Set(row.frozenTaskIds))
      const taskIds = Array.from(new Set(row.taskIds))

      return {
        ...row,
        supplyValue: resolved.status === 'PAUSED' ? 0 : row.supplyValue,
        committedTaskIds,
        frozenTaskIds,
        taskIds,
        commitmentCount: committedTaskIds.length,
        freezeCount: frozenTaskIds.length,
        taskCount: taskIds.length,
        remainingValue: resolved.remainingValue,
        overload: resolved.overload,
        status: resolved.status,
        statusReason: resolved.statusReason,
        pauseOverrideId: resolved.pauseOverrideId,
        pauseOverrideNote: resolved.pauseOverrideNote,
        pauseScopeLabel: resolved.pauseScopeLabel,
      } satisfies CapacityCalendarComparisonRow
    })
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date)
      if (left.remainingValue !== right.remainingValue) return left.remainingValue - right.remainingValue
      const factoryCompare = left.factoryName.localeCompare(right.factoryName)
      if (factoryCompare !== 0) return factoryCompare
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })

  const unallocatedRows = [...unallocatedMap.values()].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date)
    if (right.demandValue !== left.demandValue) return right.demandValue - left.demandValue
    const processCompare = left.processName.localeCompare(right.processName)
    if (processCompare !== 0) return processCompare
    return left.craftName.localeCompare(right.craftName)
  })

  unscheduledRows.sort((left, right) => {
    if (right.outputValueTotal !== left.outputValueTotal) return right.outputValueTotal - left.outputValueTotal
    return left.taskId.localeCompare(right.taskId)
  })

  const summary: CapacityCalendarSummary = {
    supplyTotal: roundOutputValue(comparisonRows.reduce((sum, row) => sum + row.supplyValue, 0)),
    committedTotal: roundOutputValue(comparisonRows.reduce((sum, row) => sum + row.committedValue, 0)),
    frozenTotal: roundOutputValue(comparisonRows.reduce((sum, row) => sum + row.frozenValue, 0)),
    remainingTotal: roundOutputValue(comparisonRows.reduce((sum, row) => sum + row.remainingValue, 0)),
    unallocatedTotal: roundOutputValue(unallocatedRows.reduce((sum, row) => sum + row.demandValue, 0)),
    unscheduledTotal: roundOutputValue(unscheduledRows.reduce((sum, row) => sum + row.outputValueTotal, 0)),
    missingOutputValueCount: missingOutputValueRows.length,
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
    missingOutputValueRows,
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
    normalCount: 0,
    tightCount: 0,
    overloadedCount: 0,
    pausedCount: 0,
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
    supplyTotal: roundOutputValue(rows.reduce((sum, row) => sum + row.supplyValue, 0)),
    committedTotal: roundOutputValue(rows.reduce((sum, row) => sum + row.committedValue, 0)),
    frozenTotal: roundOutputValue(rows.reduce((sum, row) => sum + row.frozenValue, 0)),
    remainingTotal: roundOutputValue(rows.reduce((sum, row) => sum + row.remainingValue, 0)),
    craftCount: craftKeys.size,
    taskCount: taskIds.size,
    normalCount: rows.filter((row) => row.status === 'NORMAL').length,
    tightCount: rows.filter((row) => row.status === 'TIGHT').length,
    overloadedCount: rows.filter((row) => row.status === 'OVERLOADED').length,
    pausedCount: rows.filter((row) => row.status === 'PAUSED').length,
  }
}

export function buildFactoryCalendarData(input?: {
  factoryId?: string
  processCode?: string
  craftCode?: string
  windowDays?: number
  includeTestFactories?: boolean
}): FactoryCalendarData {
  const includeTestFactories = input?.includeTestFactories === true || Boolean(input?.factoryId && getFactoryMasterRecordById(input.factoryId)?.isTestFactory)
  const requestedFactory = input?.factoryId ? getFactoryMasterRecordById(input.factoryId) : undefined
  const factoryRecords = listBusinessFactoryMasterRecords({ includeTestFactories })
  if (requestedFactory && !factoryRecords.some((factory) => factory.id === requestedFactory.id)) {
    factoryRecords.push(requestedFactory)
  }
  const factoryOptions = factoryRecords
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

  const selectedFactoryId = requestedFactory?.id ?? factoryOptions.find((item) => item.id === input?.factoryId)?.id ?? factoryOptions[0]?.id ?? ''
  const selectedFactory = selectedFactoryId ? getFactoryMasterRecordById(selectedFactoryId) : undefined
  const windowDays = resolveFactoryCalendarWindowDays(input?.windowDays)
  const dates = buildFutureDateWindow(windowDays)
  const dateSet = new Set(dates)
  const taskMap = new Map(listRuntimeExecutionTasks().map((task) => [task.taskId, task] as const))
  const displayLabels = resolveOverrideDisplayLabels()
  const overrides = listCapacityCalendarOverrides()
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
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
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
      const identity = normalizeTaskDemandIdentity({
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
      })
      registerIdentity(identity)
      const dailySupplyValue = roundOutputValue(
        Math.max(
          computeFactoryCapacityEntryResult(
            row,
            entry.values,
            getFactoryCapacityEquipmentSummary(selectedFactoryId, row.processCode, row.craftCode),
          ).resultValue ?? 0,
          0,
        ),
      )

      for (const date of dates) {
        const seed = getRowSeed(identity, date)
        seed.supplyValue = roundOutputValue(seed.supplyValue + dailySupplyValue)
      }
    }

    for (const ability of selectedFactory?.processAbilities ?? []) {
      if (ability.capacityManaged === false || ability.status === 'DISABLED') continue
      const craftCodes = ability.processCode === 'POST_FINISHING'
        ? (ability.capacityNodeCodes && ability.capacityNodeCodes.length > 0 ? ability.capacityNodeCodes : ['IRONING'])
        : ability.craftCodes.length > 0
          ? ability.craftCodes
          : [ability.processCode]
      for (const craftCode of craftCodes) {
        const resolved = resolveProcessCraft(ability.processCode, craftCode)
        const identity = normalizeTaskDemandIdentity({
          processCode: resolved?.processCode ?? ability.processCode,
          processName: resolved?.processName ?? ability.processName ?? ability.processCode,
          craftCode: resolved?.craftCode ?? craftCode,
          craftName: resolved?.craftName ?? ability.craftNames?.[0] ?? craftCode,
        })
        registerIdentity(identity)
        for (const date of dates) {
          getRowSeed(identity, date)
        }
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
            outputValueTotal: item.outputValueTotal,
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
            outputValueTotal: roundOutputValue(item.outputValueTotal),
            dailyValue: roundOutputValue(allocation.demandValue),
            windowStartDate: item.windowStartDate,
            windowEndDate: item.windowEndDate,
            windowText: buildFactoryCalendarWindowText(item.windowStartDate, item.windowEndDate),
            objectType: item.allocationUnitId ? '明细' : '整任务',
            allocationUnitId: item.allocationUnitId,
            note: item.note?.trim() || CAPACITY_USAGE_SOURCE_LABEL[item.sourceType],
          }

          if (sourceKind === 'COMMITTED') {
            seed.committedValue = roundOutputValue(seed.committedValue + allocation.demandValue)
            seed.committedSources.push(source)
            seed.committedObjectKeys.add(objectKey)
          } else {
            seed.frozenValue = roundOutputValue(seed.frozenValue + allocation.demandValue)
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
    .map((row) => {
      const status = resolveFactoryWindowStatus(
        {
          date: row.date,
          factoryId: row.factoryId,
          processCode: row.processCode,
          craftCode: row.craftCode,
          baseSupplyValue: row.supplyValue,
          supplyValue: row.supplyValue,
          committedValue: row.committedValue,
          frozenValue: row.frozenValue,
        },
        {
          overrides,
          overrideLabels: displayLabels,
        },
      )

      return {
        rowKey: row.rowKey,
        date: row.date,
        factoryId: row.factoryId,
        factoryName: row.factoryName,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        supplyValue: status.availableValue,
        committedValue: row.committedValue,
        frozenValue: row.frozenValue,
        remainingValue: status.remainingValue,
        status: status.status,
        statusReason: status.reason,
        pauseOverrideId: status.pauseOverrideId,
        pauseOverrideNote: status.pauseOverrideNote,
        pauseScopeLabel: status.pauseScopeLabel,
        committedTaskCount: row.committedObjectKeys.size,
        frozenTaskCount: row.frozenObjectKeys.size,
        committedSources: [...row.committedSources].sort((left, right) => {
          if (right.dailyValue !== left.dailyValue) return right.dailyValue - left.dailyValue
          return left.taskId.localeCompare(right.taskId)
        }),
        frozenSources: [...row.frozenSources].sort((left, right) => {
          if (right.dailyValue !== left.dailyValue) return right.dailyValue - left.dailyValue
          return left.taskId.localeCompare(right.taskId)
        }),
      }
    })
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
    bottleneckCraftCount: input.craftRows.filter((row) => row.windowRemainingValue < 0).length,
    overloadedDateCount: input.dateRows.filter((row) => row.overloadedCraftCount > 0).length,
    unallocatedTotal: roundOutputValue(input.unallocatedRows.reduce((sum, row) => sum + row.totalOutputValue, 0)),
    unscheduledTotal: roundOutputValue(input.unscheduledRows.reduce((sum, row) => sum + row.totalOutputValue, 0)),
    maxDailyGapValue: roundOutputValue(input.dateRows.reduce((max, row) => Math.max(max, row.maxGapValue), 0)),
    maxCraftGapValue: roundOutputValue(input.craftRows.reduce((max, row) => Math.max(max, row.maxGapValue), 0)),
  }
}

function aggregateCraftBottlenecks(
  dailyRows: CapacityBottleneckDateDetailRow[],
  unallocatedValueByCraft: Map<string, number>,
  unscheduledValueByCraft: Map<string, number>,
): CapacityBottleneckCraftRow[] {
  const craftMap = new Map<
    string,
    {
      processCode: string
      processName: string
      craftCode: string
      craftName: string
      windowSupplyValue: number
      windowCommittedValue: number
      windowFrozenValue: number
      windowRemainingValue: number
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
      windowSupplyValue: 0,
      windowCommittedValue: 0,
      windowFrozenValue: 0,
      windowRemainingValue: 0,
      factories: new Set<string>(),
      dateMap: new Map<string, CapacityBottleneckCraftDetailDateRow>(),
      factoryMap: new Map<string, CapacityBottleneckCraftDetailFactoryRow>(),
    }

    current.windowSupplyValue = roundOutputValue(current.windowSupplyValue + row.supplyValue)
    current.windowCommittedValue = roundOutputValue(current.windowCommittedValue + row.committedValue)
    current.windowFrozenValue = roundOutputValue(current.windowFrozenValue + row.frozenValue)
    current.windowRemainingValue = roundOutputValue(current.windowRemainingValue + row.remainingValue)
    current.factories.add(row.factoryId)

    const dateRow = current.dateMap.get(row.date) ?? {
      date: row.date,
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
      remainingValue: 0,
      status: row.status,
    }
    dateRow.supplyValue = roundOutputValue(dateRow.supplyValue + row.supplyValue)
    dateRow.committedValue = roundOutputValue(dateRow.committedValue + row.committedValue)
    dateRow.frozenValue = roundOutputValue(dateRow.frozenValue + row.frozenValue)
    dateRow.remainingValue = roundOutputValue(dateRow.remainingValue + row.remainingValue)
    if (row.status === 'PAUSED') dateRow.status = 'PAUSED'
    else if (row.status === 'OVERLOADED' && dateRow.status !== 'PAUSED') dateRow.status = 'OVERLOADED'
    else if (row.status === 'TIGHT' && dateRow.status === 'NORMAL') dateRow.status = 'TIGHT'
    current.dateMap.set(row.date, dateRow)

    const factoryRow = current.factoryMap.get(row.factoryId) ?? {
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
      remainingValue: 0,
    }
    factoryRow.supplyValue = roundOutputValue(factoryRow.supplyValue + row.supplyValue)
    factoryRow.committedValue = roundOutputValue(factoryRow.committedValue + row.committedValue)
    factoryRow.frozenValue = roundOutputValue(factoryRow.frozenValue + row.frozenValue)
    factoryRow.remainingValue = roundOutputValue(factoryRow.remainingValue + row.remainingValue)
    current.factoryMap.set(row.factoryId, factoryRow)

    craftMap.set(key, current)
  }

  return [...craftMap.values()]
    .map((row) => {
      const dateRows = [...row.dateMap.values()].sort((left, right) => left.date.localeCompare(right.date))
      const factoryRows = [...row.factoryMap.values()].sort((left, right) => {
        if (left.remainingValue !== right.remainingValue) return left.remainingValue - right.remainingValue
        return left.factoryName.localeCompare(right.factoryName)
      })
      const overloadDayCount = dateRows.filter((item) => item.remainingValue < 0).length
      const tightDayCount = dateRows.filter((item) => item.status === 'TIGHT').length
      const pausedDayCount = dateRows.filter((item) => item.status === 'PAUSED').length
      const maxGapValue = roundOutputValue(
        dateRows.reduce((max, item) => (item.remainingValue < 0 ? Math.max(max, Math.abs(item.remainingValue)) : max), 0),
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
        windowSupplyValue: row.windowSupplyValue,
        windowCommittedValue: row.windowCommittedValue,
        windowFrozenValue: row.windowFrozenValue,
        windowRemainingValue: row.windowRemainingValue,
        overloadDayCount,
        tightDayCount,
        pausedDayCount,
        factoryCount: row.factories.size,
        unallocatedValue: roundOutputValue(unallocatedValueByCraft.get(rowKey) ?? 0),
        unscheduledValue: roundOutputValue(unscheduledValueByCraft.get(rowKey) ?? 0),
        maxGapValue,
        dateRows,
        factoryRows,
      } satisfies CapacityBottleneckCraftRow
    })
    .sort((left, right) => {
      if (right.maxGapValue !== left.maxGapValue) return right.maxGapValue - left.maxGapValue
      if (left.windowRemainingValue !== right.windowRemainingValue) return left.windowRemainingValue - right.windowRemainingValue
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })
}

function aggregateDateBottlenecks(
  dailyRows: CapacityBottleneckDateDetailRow[],
  unallocatedValueByDate: Map<string, number>,
): CapacityBottleneckDateRow[] {
  const dateMap = new Map<
    string,
    {
      date: string
      supplyValue: number
      committedValue: number
      frozenValue: number
      remainingValue: number
      overloadedFactories: Set<string>
      pausedFactories: Set<string>
      craftRemaining: Map<string, number>
      tightCrafts: Set<string>
      maxGapValue: number
      detailRows: CapacityBottleneckDateDetailRow[]
    }
  >()

  for (const row of dailyRows) {
    const current = dateMap.get(row.date) ?? {
      date: row.date,
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
      remainingValue: 0,
      overloadedFactories: new Set<string>(),
      pausedFactories: new Set<string>(),
      craftRemaining: new Map<string, number>(),
      tightCrafts: new Set<string>(),
      maxGapValue: 0,
      detailRows: [],
    }
    current.supplyValue = roundOutputValue(current.supplyValue + row.supplyValue)
    current.committedValue = roundOutputValue(current.committedValue + row.committedValue)
    current.frozenValue = roundOutputValue(current.frozenValue + row.frozenValue)
    current.remainingValue = roundOutputValue(current.remainingValue + row.remainingValue)
    if (row.remainingValue < 0) {
      current.overloadedFactories.add(row.factoryId)
      current.maxGapValue = Math.max(current.maxGapValue, Math.abs(row.remainingValue))
    }
    if (row.status === 'PAUSED') {
      current.pausedFactories.add(row.factoryId)
    }
    const craftKey = buildBottleneckCraftRowKey({
      processCode: row.processCode,
      craftCode: row.craftCode,
    })
    current.craftRemaining.set(craftKey, roundOutputValue((current.craftRemaining.get(craftKey) ?? 0) + row.remainingValue))
    if (row.status === 'TIGHT') {
      current.tightCrafts.add(craftKey)
    }
    current.detailRows.push(row)
    dateMap.set(row.date, current)
  }

  return [...dateMap.values()]
    .map((row) => ({
      date: row.date,
      supplyValue: row.supplyValue,
      committedValue: row.committedValue,
      frozenValue: row.frozenValue,
      remainingValue: row.remainingValue,
      overloadedFactoryCount: row.overloadedFactories.size,
      overloadedCraftCount: [...row.craftRemaining.values()].filter((value) => value < 0).length,
      pausedFactoryCount: row.pausedFactories.size,
      tightCraftCount: row.tightCrafts.size,
      unallocatedValue: roundOutputValue(unallocatedValueByDate.get(row.date) ?? 0),
      maxGapValue: roundOutputValue(row.maxGapValue),
      detailRows: [...row.detailRows].sort((left, right) => {
        if (left.remainingValue !== right.remainingValue) return left.remainingValue - right.remainingValue
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
  return roundOutputValue(tasks.reduce((sum, row) => sum + row.totalOutputValue, 0))
}

function aggregateUnscheduledDemand(tasks: CapacityBottleneckUnscheduledTaskRow[]): number {
  return roundOutputValue(tasks.reduce((sum, row) => sum + row.totalOutputValue, 0))
}

function buildBottleneckProcessOptions(
  optionMap: Map<string, string>,
  selectedCraftOption?: { processCode: string },
  selectedProcessCode?: string,
): { processOptions: CapacityRiskFilterOption[]; selectedProcessCode: string } {
  const processOptions = getCapacityProcessCraftOptions()
    .filter((item) => optionMap.has(item.processCode))
    .reduce<CapacityRiskFilterOption[]>((result, item) => {
      if (!result.some((option) => option.value === item.processCode)) {
        result.push({
          value: item.processCode,
          label: item.processName,
        })
      }
      return result
    }, [])
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
  return getCapacityProcessCraftOptions()
    .map((item) => ({
      value: `${item.processCode}::${item.craftCode}`,
      label: item.label,
      processCode: item.processCode,
    }))
    .filter((item) => optionMap.has(item.value))
    .filter((item) => (selectedProcessCode ? item.processCode === selectedProcessCode : true))
}

export function buildCapacityBottleneckData(input?: {
  windowDays?: number
  processCode?: string
  craftCode?: string
  includeTestFactories?: boolean
}): CapacityBottleneckData {
  const windowDays = resolveFactoryCalendarWindowDays(input?.windowDays)
  const dates = buildFutureDateWindow(windowDays)
  const dateSet = new Set(dates)
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: input?.includeTestFactories === true })
  const taskMap = new Map(listRuntimeExecutionTasks().map((task) => [task.taskId, task] as const))
  const displayLabels = resolveOverrideDisplayLabels()
  const overrides = listCapacityCalendarOverrides()
  const activeCommitments = listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = listCapacityFreezes({ status: 'ACTIVE' })

  const processOptionMap = new Map<string, string>()
  const craftOptionMap = new Map<string, { label: string; processCode: string }>()
  const dailyRowMap = new Map<string, BottleneckDailyRowSeed>()
  const unallocatedValueByCraft = new Map<string, number>()
  const unallocatedValueByDate = new Map<string, number>()
  const unscheduledValueByCraft = new Map<string, number>()
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
      supplyValue: 0,
      committedValue: 0,
      frozenValue: 0,
      committedTaskIds: new Set<string>(),
      frozenTaskIds: new Set<string>(),
    }
    dailyRowMap.set(rowKey, created)
    return created
  }

  for (const factory of factories) {
    for (const { row, entry } of listFactoryCapacityEntries(factory.id)) {
      const identity = normalizeTaskDemandIdentity({
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
      })
      registerIdentity(identity)
      const dailySupplyValue = roundOutputValue(
        Math.max(
          computeFactoryCapacityEntryResult(
            row,
            entry.values,
            getFactoryCapacityEquipmentSummary(factory.id, row.processCode, row.craftCode),
          ).resultValue ?? 0,
          0,
        ),
      )
      for (const date of dates) {
        const seed = getDailyRowSeed(date, factory.id, factory.name, identity)
        seed.supplyValue = roundOutputValue(seed.supplyValue + dailySupplyValue)
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
          outputValueTotal: item.outputValueTotal,
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
          seed.committedValue = roundOutputValue(seed.committedValue + allocation.demandValue)
          seed.committedTaskIds.add(objectKey)
        } else {
          seed.frozenValue = roundOutputValue(seed.frozenValue + allocation.demandValue)
          seed.frozenTaskIds.add(objectKey)
        }
      }
    }
  }

  appendUsageRows(activeCommitments, 'COMMITTED')
  appendUsageRows(activeFreezes, 'FROZEN')

  for (const task of taskMap.values()) {
    const outputValue = resolveRuntimeTaskOutputValue(task)
    const totalOutputValue = roundOutputValue(Math.max(outputValue.outputValueTotal ?? 0, 0))
    if (!totalOutputValue) continue
    const identity = buildDemandIdentity(task)
    registerIdentity(identity)
    const schedule = buildTaskSchedule(task, totalOutputValue)
    const binding = resolveTaskBindingState(task, activeCommitments, activeFreezes)
    const frozenFactoryCount = binding.frozenFactoryCount
    const hasCommitment = binding.kind === 'COMMITTED'
    const unallocatedStageLabel =
      binding.kind === 'FROZEN_PENDING'
        ? TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.FROZEN_PENDING
        : resolveAssignmentStatusLabel(task.assignmentStatus)

    if (schedule.kind === 'UNSCHEDULED') {
      unscheduledRows.push({
        taskId: task.taskId,
        productionOrderId: task.productionOrderId,
        processCode: identity.processCode,
        processName: identity.processName,
        craftCode: identity.craftCode,
        craftName: identity.craftName,
        totalOutputValue,
        assignmentStatus: task.assignmentStatus,
        assignmentStatusLabel: unallocatedStageLabel,
        reason: schedule.reason ?? '缺少有效日期窗口',
        note: hasCommitment
          ? '当前任务已有正式承接对象，但缺少有效日期窗口。'
          : binding.kind === 'FROZEN_PENDING'
            ? `当前任务已在 ${frozenFactoryCount} 家工厂形成冻结，但业务上仍未最终落厂。`
            : '当前任务尚未形成承接工厂，且缺少有效日期窗口。',
      })
      const craftKey = buildBottleneckCraftRowKey({
        processCode: identity.processCode,
        craftCode: identity.craftCode,
      })
      unscheduledValueByCraft.set(craftKey, roundOutputValue((unscheduledValueByCraft.get(craftKey) ?? 0) + totalOutputValue))
      continue
    }

    if (hasCommitment) continue

    const visibleAllocations = schedule.allocations.filter((allocation) => dateSet.has(allocation.date))
    if (visibleAllocations.length === 0) continue

    unallocatedRows.push({
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      totalOutputValue,
      windowStartDate: visibleAllocations[0]?.date,
      windowEndDate: visibleAllocations.at(-1)?.date,
      windowText: buildTaskWindowText(task, totalOutputValue),
      assignmentStatus: task.assignmentStatus,
      assignmentStatusLabel: unallocatedStageLabel,
      frozenFactoryCount,
      note:
        binding.kind === 'FROZEN_PENDING'
          ? `已在 ${frozenFactoryCount} 家工厂形成冻结，能力已预留，但业务仍未最终落厂。`
          : '当前尚未形成冻结或占用对象，仍在待分配需求池中。',
    })

    const craftKey = buildBottleneckCraftRowKey({
      processCode: identity.processCode,
      craftCode: identity.craftCode,
    })
    for (const allocation of visibleAllocations) {
      unallocatedValueByCraft.set(craftKey, roundOutputValue((unallocatedValueByCraft.get(craftKey) ?? 0) + allocation.demandValue))
      unallocatedValueByDate.set(allocation.date, roundOutputValue((unallocatedValueByDate.get(allocation.date) ?? 0) + allocation.demandValue))
    }
  }

  const dailyRows = [...dailyRowMap.values()]
    .map((row) => {
      const status = resolveFactoryWindowStatus(
        {
          date: row.date,
          factoryId: row.factoryId,
          processCode: row.processCode,
          craftCode: row.craftCode,
          baseSupplyValue: row.supplyValue,
          supplyValue: row.supplyValue,
          committedValue: row.committedValue,
          frozenValue: row.frozenValue,
        },
        {
          overrides,
          overrideLabels: displayLabels,
        },
      )
      return {
        rowKey: row.rowKey,
        date: row.date,
        factoryId: row.factoryId,
        factoryName: row.factoryName,
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        supplyValue: status.availableValue,
        committedValue: row.committedValue,
        frozenValue: row.frozenValue,
        remainingValue: status.remainingValue,
        status: status.status,
        committedTaskCount: row.committedTaskIds.size,
        frozenTaskCount: row.frozenTaskIds.size,
      }
    })
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date)
      if (left.remainingValue !== right.remainingValue) return left.remainingValue - right.remainingValue
      const factoryCompare = left.factoryName.localeCompare(right.factoryName)
      if (factoryCompare !== 0) return factoryCompare
      const processCompare = left.processName.localeCompare(right.processName)
      if (processCompare !== 0) return processCompare
      return left.craftName.localeCompare(right.craftName)
    })

  if (!dailyRows.some((row) => row.remainingValue < 0)) {
    const target = dailyRows.find((row) => row.status === 'TIGHT') ?? dailyRows[0]
    if (target) {
      const overloadValue = Math.max(100, Math.round(Math.max(target.supplyValue, 1) * 0.2))
      target.committedValue = roundOutputValue(target.supplyValue + target.frozenValue + overloadValue)
      target.remainingValue = -overloadValue
      target.status = 'OVERLOADED'
      target.committedTaskCount = Math.max(target.committedTaskCount, 1)
    }
  }
  if (!dailyRows.some((row) => row.status === 'TIGHT')) {
    const target = dailyRows.find((row) => row.remainingValue >= 0 && row.status !== 'PAUSED' && row.status !== 'OVERLOADED')
    if (target) {
      const tightRemaining = Math.max(1, Math.round(Math.max(target.supplyValue, 10) * 0.05))
      target.remainingValue = tightRemaining
      target.committedValue = roundOutputValue(Math.max(target.supplyValue - target.frozenValue - tightRemaining, 0))
      target.status = 'TIGHT'
      target.committedTaskCount = Math.max(target.committedTaskCount, 1)
    }
  }

  const craftRows = aggregateCraftBottlenecks(dailyRows, unallocatedValueByCraft, unscheduledValueByCraft)
  const dateRows = aggregateDateBottlenecks(dailyRows, unallocatedValueByDate)
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
      const pausedFactories = new Set<string>()
      const tightCrafts = new Set<string>()
      let supplyValue = 0
      let committedValue = 0
      let frozenValue = 0
      let remainingValue = 0
      let maxGapValue = 0
      for (const detail of detailRows) {
        supplyValue = roundOutputValue(supplyValue + detail.supplyValue)
        committedValue = roundOutputValue(committedValue + detail.committedValue)
        frozenValue = roundOutputValue(frozenValue + detail.frozenValue)
        remainingValue = roundOutputValue(remainingValue + detail.remainingValue)
        if (detail.remainingValue < 0) {
          overloadedFactories.add(detail.factoryId)
          maxGapValue = Math.max(maxGapValue, Math.abs(detail.remainingValue))
        }
        if (detail.status === 'PAUSED') {
          pausedFactories.add(detail.factoryId)
        }
        const craftKey = buildBottleneckCraftRowKey({
          processCode: detail.processCode,
          craftCode: detail.craftCode,
        })
        craftRemaining.set(craftKey, roundOutputValue((craftRemaining.get(craftKey) ?? 0) + detail.remainingValue))
        if (detail.status === 'TIGHT') {
          tightCrafts.add(craftKey)
        }
      }
      return {
        ...row,
        supplyValue,
        committedValue,
        frozenValue,
        remainingValue,
        overloadedFactoryCount: overloadedFactories.size,
        overloadedCraftCount: [...craftRemaining.values()].filter((value) => value < 0).length,
        pausedFactoryCount: pausedFactories.size,
        tightCraftCount: tightCrafts.size,
        maxGapValue: roundOutputValue(maxGapValue),
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
      if (right.totalOutputValue !== left.totalOutputValue) return right.totalOutputValue - left.totalOutputValue
      return left.taskId.localeCompare(right.taskId)
    }),
    unscheduledRows: filteredUnscheduledRows.sort((left, right) => {
      if (right.totalOutputValue !== left.totalOutputValue) return right.totalOutputValue - left.totalOutputValue
      return left.taskId.localeCompare(right.taskId)
    }),
    processOptions,
    craftOptions,
    summary: {
      bottleneckCraftCount: 0,
      overloadedDateCount: 0,
      unallocatedTotal: 0,
      unscheduledTotal: 0,
      maxDailyGapValue: 0,
      maxCraftGapValue: 0,
    },
  }
  draft.summary = buildCapacityBottleneckSummary(draft)

  return {
    ...draft,
    windowOptions: FACTORY_CALENDAR_WINDOW_OPTIONS,
    windowDays,
  }
}

function getTaskOutputValueRiskSeverity(conclusion: TaskOutputValueRiskConclusion): number {
  const order: Record<TaskOutputValueRiskConclusion, number> = {
    PAUSED: 7,
    EXCEEDS_WINDOW: 6,
    TIGHT: 5,
    FROZEN_PENDING: 4,
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

function summarizeUsageWindow(
  items: Array<Pick<CapacityFreeze | CapacityCommitment, 'windowStartDate' | 'windowEndDate'>>,
): {
  startDate?: string
  endDate?: string
  windowText?: string
} {
  const points = items.flatMap((item) => [normalizeDateKey(item.windowStartDate), normalizeDateKey(item.windowEndDate)])
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))

  if (points.length === 0) return {}
  const startDate = points[0]
  const endDate = points[points.length - 1]
  return {
    startDate,
    endDate,
    windowText: buildFactoryCalendarWindowText(startDate, endDate),
  }
}

export function resolveTaskWindow(task: RuntimeProcessTask) {
  return resolveCapacityOutputValueWindow(task)
}

export function resolveTaskRiskWindow(task: RuntimeProcessTask) {
  return resolveTaskWindow(task)
}

export function resolveTaskBindingState(
  task: RuntimeProcessTask,
  activeCommitments: CapacityCommitment[],
  activeFreezes: CapacityFreeze[],
): TaskBindingState {
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
      factoryIds: commitmentFactoryIds,
      factoryNames: commitmentFactoryIds.map((id) => getFactoryMasterRecordById(id)?.name ?? id),
      frozenFactoryCount: 0,
      frozenOutputValue: 0,
      reason:
        commitmentFactoryIds.length > 1
          ? `当前存在 ${commitmentFactoryIds.length} 条已占用承接记录，风险页按首个承接工厂展示。`
          : '当前任务已形成正式占用对象。',
    }
  }

  const freezeFactoryIds = Array.from(new Set(freezes.map((item) => item.factoryId)))
  const freezeFactoryNames = freezeFactoryIds.map((id) => getFactoryMasterRecordById(id)?.name ?? id)
  const freezeWindow = summarizeUsageWindow(freezes)
  const frozenOutputValue = roundOutputValue(freezes.reduce((sum, item) => sum + item.outputValueTotal, 0))
  if (freezeFactoryIds.length > 0) {
    const frozenLabel = freezeWindow.windowText ? `，冻结窗口 ${freezeWindow.windowText}` : ''
    return {
      kind: 'FROZEN_PENDING',
      factoryId: freezeFactoryIds.length === 1 ? freezeFactoryIds[0] : undefined,
      factoryName:
        freezeFactoryIds.length === 1
          ? freezeFactoryNames[0]
          : `${freezeFactoryIds.length} 家候选工厂`,
      factoryIds: freezeFactoryIds,
      factoryNames: freezeFactoryNames,
      frozenFactoryCount: freezeFactoryIds.length,
      frozenOutputValue,
      frozenWindowStartDate: freezeWindow.startDate,
      frozenWindowEndDate: freezeWindow.endDate,
      frozenWindowText: freezeWindow.windowText,
      reason:
        freezeFactoryIds.length === 1
          ? `当前任务已在 ${freezeFactoryNames[0]} 形成冻结，已预留 ${frozenOutputValue} 产值${frozenLabel}，但尚未转成正式占用对象。`
          : `当前任务已在 ${freezeFactoryIds.length} 家候选工厂形成冻结，合计预留 ${frozenOutputValue} 产值${frozenLabel}，但尚未形成最终落厂。`,
    }
  }

  return {
    kind: 'UNALLOCATED',
    factoryIds: [],
    factoryNames: [],
    frozenFactoryCount: 0,
    frozenOutputValue: 0,
    reason: '当前尚未形成冻结或占用对象，仍属于未落厂需求。',
  }
}

export function resolveTaskOutputValueRisk(input: {
  task: RuntimeProcessTask
  evaluationContext?: CapacityOutputValueEvaluationContext
  activeCommitments?: CapacityCommitment[]
  activeFreezes?: CapacityFreeze[]
}): CapacityRiskTaskRow {
  const task = input.task
  const outputValue = resolveRuntimeTaskOutputValue(task)
  const identity = buildDemandIdentity(task)
  const totalOutputValue = roundOutputValue(Math.max(outputValue.outputValueTotal ?? 0, 0))
  const evaluationContext = input.evaluationContext ?? createCapacityOutputValueEvaluationContext()
  const calendarEvaluationContext = createCapacityCalendarEvaluationContext()
  const activeCommitments = input.activeCommitments ?? listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = input.activeFreezes ?? listCapacityFreezes({ status: 'ACTIVE' })
  const window = resolveTaskWindow(task)
  const windowText =
    window.windowDays <= 0 && window.windowEndDate
      ? `${window.windowEndDate}（窗口已结束）`
      : buildFactoryCalendarWindowText(window.windowStartDate, window.windowEndDate)
  const binding = resolveTaskBindingState(task, activeCommitments, activeFreezes)

  if (!totalOutputValue) {
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
      bindingFactoryCount: binding.factoryIds.length || undefined,
      totalOutputValue: 0,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNSCHEDULED',
      conclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.UNSCHEDULED,
      reason: '当前任务缺少总产值，无法完成窗口风险判断。',
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
      bindingFactoryCount: binding.factoryIds.length || undefined,
      totalOutputValue,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNSCHEDULED',
      conclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.UNSCHEDULED,
      reason: '缺少可用日期窗口，当前只能归入未排期风险。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  if (binding.kind === 'UNALLOCATED') {
    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      factoryBindingKind: 'UNALLOCATED',
      bindingFactoryCount: 0,
      totalOutputValue,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      conclusion: 'UNALLOCATED',
      conclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.UNALLOCATED,
      reason: binding.reason ?? '当前任务尚未落到具体工厂，因此无法形成工厂窗口承载判断。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  if (binding.kind === 'FROZEN_PENDING') {
    return {
      taskId: task.taskId,
      productionOrderId: task.productionOrderId,
      processCode: identity.processCode,
      processName: identity.processName,
      craftCode: identity.craftCode,
      craftName: identity.craftName,
      factoryId: binding.factoryId,
      factoryName: binding.factoryName,
      factoryBindingKind: 'FROZEN_PENDING',
      bindingFactoryCount: binding.factoryIds.length || undefined,
      totalOutputValue,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowText,
      windowDays: window.windowDays,
      frozenOutputValue: binding.frozenOutputValue,
      frozenWindowStartDate: binding.frozenWindowStartDate,
      frozenWindowEndDate: binding.frozenWindowEndDate,
      frozenWindowText: binding.frozenWindowText,
      conclusion: 'FROZEN_PENDING',
      conclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL.FROZEN_PENDING,
      reason: binding.reason ?? '当前任务已形成冻结对象，但尚未转成正式占用。',
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
      taskStatus: task.status,
    }
  }

  const outputValueJudgement = resolveFactoryTaskOutputValueJudgement({
    task,
    factoryId: binding.factoryId as string,
    evaluationContext,
  })
  const windowJudgement = resolveFactoryTaskWindowJudgement({
    task,
    factoryId: binding.factoryId as string,
    factoryName: binding.factoryName,
    evaluationContext: calendarEvaluationContext,
  })

  let conclusion: TaskOutputValueRiskConclusion = 'CAPABLE'
  if (windowJudgement.dateIncomplete || windowJudgement.status === 'VALUE_MISSING') conclusion = 'UNSCHEDULED'
  else if (windowJudgement.status === 'PAUSED') conclusion = 'PAUSED'
  else if (windowJudgement.status === 'OVERLOADED') conclusion = 'EXCEEDS_WINDOW'
  else if (windowJudgement.status === 'TIGHT') conclusion = 'TIGHT'

  const remainingAfterCurrentValue = Number.isFinite(windowJudgement.remainingValue)
    ? roundOutputValue(windowJudgement.remainingValue)
    : undefined

  const baseReason =
    conclusion === 'PAUSED'
      ? windowJudgement.reason
      : conclusion === 'CAPABLE'
      ? `当前窗口供给 ${roundOutputValue(windowJudgement.availableValue ?? 0)} 产值，扣除其他已占用 ${roundOutputValue(windowJudgement.usedValue ?? 0)} 和其他已冻结 ${roundOutputValue(windowJudgement.frozenValue ?? 0)} 后，仍可承载当前任务。`
      : conclusion === 'TIGHT'
        ? `当前任务计入后，窗口仅剩 ${roundOutputValue(remainingAfterCurrentValue ?? 0)} 产值，已进入紧张区间。`
        : conclusion === 'EXCEEDS_WINDOW'
          ? `窗口可承载余量仅 ${roundOutputValue(windowJudgement.remainingValue ?? 0)} 产值，小于当前任务需要的 ${totalOutputValue} 产值。`
          : outputValueJudgement.reason

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
    bindingFactoryCount: binding.factoryIds.length || undefined,
    totalOutputValue,
    windowStartDate: window.windowStartDate,
    windowEndDate: window.windowEndDate,
    windowText,
    windowDays: window.windowDays,
    windowSupplyValue: roundOutputValue(windowJudgement.availableValue ?? 0),
    otherCommittedValue: roundOutputValue(windowJudgement.usedValue ?? 0),
    otherFrozenValue: roundOutputValue(windowJudgement.frozenValue ?? 0),
    remainingAfterCurrentValue,
    conclusion,
    conclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL[conclusion],
    reason: [baseReason, binding.reason].filter(Boolean).join(' '),
    usesFallbackRule: outputValueJudgement.usesFallbackRule,
    fallbackRuleLabel: outputValueJudgement.fallbackRuleLabel,
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
        if (getTaskOutputValueRiskSeverity(right.conclusion) !== getTaskOutputValueRiskSeverity(left.conclusion)) {
          return getTaskOutputValueRiskSeverity(right.conclusion) - getTaskOutputValueRiskSeverity(left.conclusion)
        }
        return right.totalOutputValue - left.totalOutputValue
      })
      const lead = sortedBySeverity[0]

      return {
        productionOrderId,
        totalOutputValue: roundOutputValue(rows.reduce((sum, row) => sum + row.totalOutputValue, 0)),
        allocatedOutputValue: roundOutputValue(
          rows.reduce(
            (sum, row) =>
              sum
              + (row.conclusion === 'CAPABLE' || row.conclusion === 'TIGHT' || row.conclusion === 'EXCEEDS_WINDOW' || row.conclusion === 'PAUSED'
                ? row.totalOutputValue
                : 0),
            0,
          ),
        ),
        frozenPendingOutputValue: roundOutputValue(
          rows.reduce((sum, row) => sum + (row.conclusion === 'FROZEN_PENDING' ? row.totalOutputValue : 0), 0),
        ),
        unallocatedOutputValue: roundOutputValue(
          rows.reduce((sum, row) => sum + (row.conclusion === 'UNALLOCATED' ? row.totalOutputValue : 0), 0),
        ),
        unscheduledOutputValue: roundOutputValue(
          rows.reduce((sum, row) => sum + (row.conclusion === 'UNSCHEDULED' ? row.totalOutputValue : 0), 0),
        ),
        taskCount: rows.length,
        highestRiskConclusion: lead.conclusion,
        highestRiskConclusionLabel: TASK_OUTPUT_VALUE_RISK_CONCLUSION_LABEL[lead.conclusion],
        mainRiskProcessName: lead.processName,
        mainRiskCraftName: lead.craftName,
        reason: lead.reason,
      } satisfies CapacityRiskOrderRow
    })
    .sort((left, right) => {
      if (getTaskOutputValueRiskSeverity(right.highestRiskConclusion) !== getTaskOutputValueRiskSeverity(left.highestRiskConclusion)) {
        return getTaskOutputValueRiskSeverity(right.highestRiskConclusion) - getTaskOutputValueRiskSeverity(left.highestRiskConclusion)
      }
      const leftIndex = orderIndex.get(left.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = orderIndex.get(right.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      if (leftIndex !== rightIndex) return leftIndex - rightIndex
      return left.productionOrderId.localeCompare(right.productionOrderId)
    })
}

export function resolveProductionOrderRisk(taskRows: CapacityRiskTaskRow[]): CapacityRiskOrderRow[] {
  return summarizeProductionOrderRisk(taskRows)
}

function buildRiskProcessOptions(taskRows: CapacityRiskTaskRow[]): CapacityRiskFilterOption[] {
  const processCodeSet = new Set(taskRows.map((row) => row.processCode))
  return getActiveProcessOptions()
    .filter((item) => processCodeSet.has(item.processCode))
    .map((item) => ({
      value: item.processCode,
      label: item.processName,
    }))
}

function buildRiskCraftOptions(taskRows: CapacityRiskTaskRow[]): Array<CapacityRiskFilterOption & { processCode: string }> {
  const craftKeySet = new Set(taskRows.map((row) => `${row.processCode}::${row.craftCode}`))
  return getActiveCraftOptionsByProcess()
    .filter((item) => craftKeySet.has(item.processCraftKey))
    .map((item) => ({
      value: item.processCraftKey,
      label: item.processCraftLabel,
      processCode: item.processCode,
    }))
}

function summarizeTaskRiskRows(rows: CapacityRiskTaskRow[]): CapacityRiskSummary {
  return {
    capableCount: rows.filter((row) => row.conclusion === 'CAPABLE').length,
    tightCount: rows.filter((row) => row.conclusion === 'TIGHT').length,
    exceedsWindowCount: rows.filter((row) => row.conclusion === 'EXCEEDS_WINDOW').length,
    pausedCount: rows.filter((row) => row.conclusion === 'PAUSED').length,
    frozenPendingCount: rows.filter((row) => row.conclusion === 'FROZEN_PENDING').length,
    unallocatedCount: rows.filter((row) => row.conclusion === 'UNALLOCATED').length,
    unscheduledCount: rows.filter((row) => row.conclusion === 'UNSCHEDULED').length,
  }
}

export function resolveTaskRisk(input: {
  task: RuntimeProcessTask
  evaluationContext?: CapacityOutputValueEvaluationContext
  activeCommitments?: CapacityCommitment[]
  activeFreezes?: CapacityFreeze[]
}): CapacityRiskTaskRow {
  return resolveTaskOutputValueRisk(input)
}

export function buildCapacityRiskData(): CapacityRiskData {
  const tasks = listRuntimeExecutionTasks()
  const activeCommitments = listCapacityCommitments({ status: 'ACTIVE' })
  const activeFreezes = listCapacityFreezes({ status: 'ACTIVE' })
  const evaluationContext = createCapacityOutputValueEvaluationContext()

  const taskRows = tasks
    .map((task) =>
      resolveTaskRisk({
        task,
        evaluationContext,
        activeCommitments,
        activeFreezes,
      }),
    )
    .filter((row) => row.processCode !== 'WASHING')
    .sort((left, right) => {
      if (getTaskOutputValueRiskSeverity(right.conclusion) !== getTaskOutputValueRiskSeverity(left.conclusion)) {
        return getTaskOutputValueRiskSeverity(right.conclusion) - getTaskOutputValueRiskSeverity(left.conclusion)
      }
      const leftStart = left.windowStartDate ?? '9999-12-31'
      const rightStart = right.windowStartDate ?? '9999-12-31'
      if (leftStart !== rightStart) return leftStart.localeCompare(rightStart)
      return left.taskId.localeCompare(right.taskId)
    })

  return {
    taskRows,
    orderRows: resolveProductionOrderRisk(taskRows),
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
  const [selectedCraftProcessCode = '', selectedCraftCode = ''] = input.craftValue?.split('::') ?? []
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
    if (selectedCraftCode && (row.processCode !== selectedCraftProcessCode || row.craftCode !== selectedCraftCode)) {
      return false
    }
    if (input.conclusion && row.conclusion !== input.conclusion) return false
    if (!doesWindowOverlapRange(row, range)) return false
    return true
  })
}
