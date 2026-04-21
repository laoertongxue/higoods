import {
  computeFactoryCapacityEntryResult,
  getFactoryCapacityEquipmentSummary,
  listFactoryCapacityEntries,
} from './factory-capacity-profile-mock.ts'
import {
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  getProcessDefinitionBySystemCode,
  listCraftsByProcessCode,
  listProcessCraftDefinitions,
  resolveProcessCraft,
} from './process-craft-dict.ts'
import {
  CAPACITY_DATE_INCOMPLETE_NOTE,
  CAPACITY_TIGHT_THRESHOLD_RATIO,
  calculateCapacityRemainingStandardHours,
} from './capacity-rules.ts'
import type { AcceptanceStatus, PublishedSamDifficulty, TaskAuditLog } from './process-tasks.ts'

export type CapacityUsageSourceType =
  | 'DIRECT_PENDING_ACCEPT'
  | 'TENDER_PARTICIPATING'
  | 'DIRECT_ACCEPTED'
  | 'TENDER_AWARDED'

export type CapacityUsageStatus = 'ACTIVE' | 'RELEASED' | 'CONVERTED'

type FreezeSourceType = Extract<CapacityUsageSourceType, 'DIRECT_PENDING_ACCEPT' | 'TENDER_PARTICIPATING'>
type CommitmentSourceType = Extract<CapacityUsageSourceType, 'DIRECT_ACCEPTED' | 'TENDER_AWARDED'>

export interface CapacityFreeze {
  id: string
  factoryId: string
  processCode: string
  craftCode: string
  taskId: string
  allocationUnitId?: string
  standardSamTotal: number
  windowStartDate?: string
  windowEndDate?: string
  sourceType: FreezeSourceType
  status: CapacityUsageStatus
  note?: string
  createdAt: string
  updatedAt: string
  convertedAt?: string
  releasedAt?: string
}

export interface CapacityCommitment {
  id: string
  factoryId: string
  processCode: string
  craftCode: string
  taskId: string
  allocationUnitId?: string
  standardSamTotal: number
  windowStartDate?: string
  windowEndDate?: string
  sourceType: CommitmentSourceType
  status: CapacityUsageStatus
  note?: string
  createdAt: string
  updatedAt: string
  releasedAt?: string
}

export interface CapacityUsageWindowSnapshot {
  windowStartDate?: string
  windowEndDate?: string
  note?: string
  dateIncomplete: boolean
  resolutionKind: 'WINDOW' | 'SINGLE' | 'UNSCHEDULED'
}

export interface CapacityUsageTaskLike {
  taskId: string
  processCode: string
  processNameZh?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
  rolledUpChildProcessCodes?: string[]
  assignmentMode?: string
  assignmentStatus?: string
  acceptanceStatus?: AcceptanceStatus
  assignedFactoryId?: string
  assignedFactoryName?: string
  publishedSamTotal?: number
  publishedSamDifficulty?: PublishedSamDifficulty
  startDueAt?: string
  taskDeadline?: string
  acceptDeadline?: string
  biddingDeadline?: string
  awardedAt?: string
  dispatchedAt?: string
  isSplitResult?: boolean
  isSplitSource?: boolean
  auditLogs?: TaskAuditLog[]
}

export interface CapacityUsageAllocationUnitInput {
  factoryId: string
  taskId: string
  processCode: string
  craftCode: string
  allocationUnitId?: string
  standardSamTotal: number
  windowStartDate?: string
  windowEndDate?: string
  note?: string
}

export interface CapacityTenderParticipationSnapshot {
  tenderId?: string
  taskId: string
  status: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  participatingFactoryIds: string[]
  awardedFactoryId?: string
}

export interface CapacityUsageAggregateResult {
  freezeTotal: number
  commitmentTotal: number
  freezeCount: number
  commitmentCount: number
}

export type CapacityStandardTimeJudgementStatus =
  | 'CAPABLE'
  | 'RISK'
  | 'EXCEEDS_WINDOW'
  | 'DATE_INCOMPLETE'
  | 'SAM_MISSING'

export const CAPACITY_STANDARD_TIME_JUDGEMENT_LABEL: Record<CapacityStandardTimeJudgementStatus, string> = {
  CAPABLE: '当前窗口内可承载',
  RISK: '风险偏高',
  EXCEEDS_WINDOW: '超过当前窗口可承载能力',
  DATE_INCOMPLETE: '日期不足，无法准确判断',
  SAM_MISSING: '缺少标准工时',
}

export interface CapacityStandardTimeWindowSnapshot {
  windowStartDate?: string
  windowEndDate?: string
  windowDays: number
  dateIncomplete: boolean
  usesFallbackRule: boolean
  fallbackRuleLabel?: string
  note?: string
}

export interface CapacityStandardTimeJudgement {
  factoryId: string
  processCode: string
  craftCode: string
  windowStartDate?: string
  windowEndDate?: string
  windowDays: number
  dailySupplySam?: number
  windowSupplySam?: number
  windowCommittedSam?: number
  windowFrozenSam?: number
  windowRemainingSam?: number
  taskDemandSam?: number
  estimatedDays?: number
  exceedsWindow: boolean
  status: CapacityStandardTimeJudgementStatus
  reason: string
  note?: string
  dateIncomplete: boolean
  usesFallbackRule: boolean
  fallbackRuleLabel?: string
}

export interface CapacityStandardTimeEvaluationContext {
  today: Date
  activeFreezes: CapacityFreeze[]
  activeCommitments: CapacityCommitment[]
  dailySupplyCache: Map<string, number>
}

const WINDOW_START_CANDIDATES: Array<{ field: keyof CapacityUsageTaskLike; label: string }> = [
  { field: 'startDueAt', label: '开始日期' },
  { field: 'awardedAt', label: '定标时间（兼容兜底）' },
  { field: 'dispatchedAt', label: '派单时间（兼容兜底）' },
]

const WINDOW_END_CANDIDATES: Array<{ field: keyof CapacityUsageTaskLike; label: string }> = [
  { field: 'taskDeadline', label: '任务截止日期' },
]

const SINGLE_DATE_CANDIDATES: Array<{ field: keyof CapacityUsageTaskLike; label: string }> = [
  { field: 'taskDeadline', label: '任务截止日期' },
  { field: 'startDueAt', label: '开始日期' },
  { field: 'acceptDeadline', label: '接单截止日期' },
  { field: 'biddingDeadline', label: '招标截止日期' },
]

const JUDGEMENT_START_CANDIDATES: Array<{ field: keyof CapacityUsageTaskLike; label: string }> = [
  { field: 'startDueAt', label: '开始日期' },
]

const JUDGEMENT_DEADLINE_CANDIDATES: Array<{ field: keyof CapacityUsageTaskLike; label: string }> = [
  { field: 'taskDeadline', label: '任务截止日期' },
  { field: 'acceptDeadline', label: '接单截止日期' },
  { field: 'biddingDeadline', label: '招标截止日期' },
]

const capacityFreezes = new Map<string, CapacityFreeze>()
const capacityCommitments = new Map<string, CapacityCommitment>()
const DEFAULT_COMPAT_CRAFT_NAME_BY_PROCESS_CODE: Partial<Record<string, string>> = {
  CUT_PANEL: '定位裁',
  SEW: '基础连接',
}
const activeCraftByNameAndProcess = new Map(
  listProcessCraftDefinitions().map((item) => [`${item.processCode}::${item.craftName}`, item] as const),
)
const activeCraftBySystemCode = new Map(
  listProcessCraftDefinitions().map((item) => [item.systemProcessCode, item] as const),
)

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
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

function normalizeDateKey(value: string | undefined): string | undefined {
  const parsed = parseDateLike(value)
  if (!parsed) return undefined
  return formatDateKey(toDayStart(parsed))
}

function normalizeSam(value: number | undefined): number | undefined {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined
  return Math.round(numeric * 1000) / 1000
}

function roundSam(value: number): number {
  return Math.round(value * 1000) / 1000
}

function normalizeToken(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9]+/g, '').toUpperCase() || 'NA'
}

function buildFreezeId(input: {
  sourceType: FreezeSourceType
  factoryId: string
  taskId: string
  allocationUnitId?: string
}): string {
  const allocationToken = input.allocationUnitId ? normalizeToken(input.allocationUnitId) : 'TASK'
  return `FRZ-${normalizeToken(input.sourceType)}-${normalizeToken(input.factoryId)}-${normalizeToken(input.taskId)}-${allocationToken}`
}

function buildCommitmentId(input: {
  sourceType: CommitmentSourceType
  factoryId: string
  taskId: string
  allocationUnitId?: string
}): string {
  const allocationToken = input.allocationUnitId ? normalizeToken(input.allocationUnitId) : 'TASK'
  return `CMT-${normalizeToken(input.sourceType)}-${normalizeToken(input.factoryId)}-${normalizeToken(input.taskId)}-${allocationToken}`
}

function appendUsageNote(base: string | undefined, addition: string | undefined): string | undefined {
  const parts = [base, addition].map((item) => item?.trim()).filter(Boolean)
  if (parts.length === 0) return undefined
  return Array.from(new Set(parts)).join('；')
}

function normalizeUsageProcessCode(processCode: string | undefined): string {
  const value = processCode?.trim() ?? ''
  if (!value) return ''
  return getProcessDefinitionByCode(value)?.processCode
    ?? getProcessDefinitionBySystemCode(value)?.processCode
    ?? value
}

function resolveCompatibleUsageCraftCode(
  task: Pick<CapacityUsageTaskLike, 'processCode' | 'processBusinessCode' | 'craftCode' | 'craftName' | 'rolledUpChildProcessCodes'>,
  processCode: string,
): string | null {
  const rawCraftCode = task.craftCode?.trim() ?? ''
  if (rawCraftCode) {
    const direct = resolveProcessCraft(processCode, rawCraftCode)
    if (direct) return direct.craftCode

    const directCraft = getProcessCraftByCode(rawCraftCode)
    if (directCraft?.isActive && directCraft.processCode === processCode) {
      return directCraft.craftCode
    }

    const craftBySystemCode = activeCraftBySystemCode.get(rawCraftCode)
    if (craftBySystemCode?.processCode === processCode) {
      return craftBySystemCode.craftCode
    }

    const processAlias = getProcessDefinitionBySystemCode(rawCraftCode)
    if (processAlias?.processRole === 'INTERNAL_CAPACITY_NODE' && processAlias.parentProcessCode === processCode) {
      return processAlias.processCode
    }
  }

  if (processCode === 'POST_FINISHING') {
    const rolledUpChildCode = (task.rolledUpChildProcessCodes ?? [])
      .map((item) => item.trim())
      .find((item) => Boolean(resolveProcessCraft('POST_FINISHING', item)))
    if (rolledUpChildCode) return rolledUpChildCode
  }

  const craftName = task.craftName?.trim() ?? ''
  if (craftName) {
    const namedCraft = activeCraftByNameAndProcess.get(`${processCode}::${craftName}`)
    if (namedCraft) return namedCraft.craftCode
  }

  const processCrafts = listCraftsByProcessCode(processCode)
  if (processCrafts.length === 1) return processCrafts[0].craftCode

  const defaultCraftName = DEFAULT_COMPAT_CRAFT_NAME_BY_PROCESS_CODE[processCode]
  if (defaultCraftName) {
    return activeCraftByNameAndProcess.get(`${processCode}::${defaultCraftName}`)?.craftCode ?? null
  }

  return null
}

export function resolveCapacityUsageTaskIdentity(
  task: Pick<CapacityUsageTaskLike, 'processCode' | 'processBusinessCode' | 'craftCode' | 'craftName' | 'rolledUpChildProcessCodes'>,
): {
  processCode: string
  craftCode: string
} | null {
  const processCode = normalizeUsageProcessCode(task.processBusinessCode ?? task.processCode)
  if (!processCode) return null
  const craftCode = resolveCompatibleUsageCraftCode(task, processCode)
  if (!craftCode) return null
  return { processCode, craftCode }
}

function resolveUsageIdentity(task: Pick<CapacityUsageTaskLike, 'processCode' | 'processNameZh' | 'processBusinessCode' | 'processBusinessName' | 'craftCode' | 'craftName' | 'rolledUpChildProcessCodes'>): {
  processCode: string
  craftCode: string
} {
  const resolved = resolveCapacityUsageTaskIdentity(task)
  if (resolved) return resolved

  return {
    processCode: normalizeUsageProcessCode(task.processBusinessCode ?? task.processCode),
    craftCode: task.craftCode ?? normalizeUsageProcessCode(task.processBusinessCode ?? task.processCode),
  }
}

function pickFirstValidDate(
  task: CapacityUsageTaskLike,
  candidates: Array<{ field: keyof CapacityUsageTaskLike; label: string }>,
): { field: string; label: string; value: string } | null {
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

export function resolveCapacityUsageWindow(task: CapacityUsageTaskLike): CapacityUsageWindowSnapshot {
  const startCandidate = pickFirstValidDate(task, WINDOW_START_CANDIDATES)
  const endCandidate = pickFirstValidDate(task, WINDOW_END_CANDIDATES)

  if (startCandidate?.value && endCandidate?.value) {
    const startDate = parseDateLike(startCandidate.value)
    const endDate = parseDateLike(endCandidate.value)

    if (startDate && endDate) {
      const startDay = toDayStart(startDate)
      const endDay = toDayStart(endDate)
      if (startDay.getTime() <= endDay.getTime()) {
        return {
          windowStartDate: formatDateKey(startDay),
          windowEndDate: formatDateKey(endDay),
          dateIncomplete: false,
          resolutionKind: startDay.getTime() === endDay.getTime() ? 'SINGLE' : 'WINDOW',
        }
      }
    }
  }

  const singleDateCandidate = pickFirstValidDate(task, SINGLE_DATE_CANDIDATES)
  if (singleDateCandidate?.value) {
    const singleDate = parseDateLike(singleDateCandidate.value)
    if (singleDate) {
      const dateKey = formatDateKey(toDayStart(singleDate))
      return {
        windowStartDate: dateKey,
        windowEndDate: dateKey,
        dateIncomplete: false,
        resolutionKind: 'SINGLE',
      }
    }
  }

  return {
    dateIncomplete: true,
    resolutionKind: 'UNSCHEDULED',
    note: CAPACITY_DATE_INCOMPLETE_NOTE,
  }
}

function countInclusiveDays(start: Date, end: Date): number {
  const distance = end.getTime() - start.getTime()
  if (distance < 0) return 0
  return Math.floor(distance / (24 * 60 * 60 * 1000)) + 1
}

export function createCapacityStandardTimeEvaluationContext(now: Date = new Date()): CapacityStandardTimeEvaluationContext {
  return {
    today: toDayStart(now),
    activeFreezes: listCapacityFreezes({ status: 'ACTIVE' }),
    activeCommitments: listCapacityCommitments({ status: 'ACTIVE' }),
    dailySupplyCache: new Map<string, number>(),
  }
}

export function resolveCapacityStandardTimeWindow(
  task: CapacityUsageTaskLike,
  now: Date = new Date(),
): CapacityStandardTimeWindowSnapshot {
  const today = toDayStart(now)
  const startCandidate = pickFirstValidDate(task, JUDGEMENT_START_CANDIDATES)
  const deadlineCandidate = pickFirstValidDate(task, JUDGEMENT_DEADLINE_CANDIDATES)

  if (startCandidate?.value && deadlineCandidate?.value) {
    const rawStart = toDayStart(parseDateLike(startCandidate.value) as Date)
    const rawEnd = toDayStart(parseDateLike(deadlineCandidate.value) as Date)
    const effectiveStart = rawStart.getTime() < today.getTime() ? today : rawStart
    const windowDays = countInclusiveDays(effectiveStart, rawEnd)
    return {
      windowStartDate: formatDateKey(effectiveStart),
      windowEndDate: formatDateKey(rawEnd),
      windowDays,
      dateIncomplete: false,
      usesFallbackRule: false,
      note:
        rawStart.getTime() < today.getTime()
          ? '开始日期早于当前日期，未来窗口按今天起算。'
          : undefined,
    }
  }

  if (deadlineCandidate?.value) {
    const rawEnd = toDayStart(parseDateLike(deadlineCandidate.value) as Date)
    return {
      windowStartDate: formatDateKey(today),
      windowEndDate: formatDateKey(rawEnd),
      windowDays: countInclusiveDays(today, rawEnd),
      dateIncomplete: false,
      usesFallbackRule: true,
      fallbackRuleLabel: `仅有${deadlineCandidate.label}时，按“今天到截止日”判断。`,
    }
  }

  if (startCandidate?.value) {
    const rawStart = toDayStart(parseDateLike(startCandidate.value) as Date)
    const effectiveStart = rawStart.getTime() < today.getTime() ? today : rawStart
    const rawEnd = addDays(rawStart, 6)
    return {
      windowStartDate: formatDateKey(effectiveStart),
      windowEndDate: formatDateKey(rawEnd),
      windowDays: countInclusiveDays(effectiveStart, rawEnd),
      dateIncomplete: false,
      usesFallbackRule: true,
      fallbackRuleLabel: '缺少截止日期时，按开始日期起 7 天（含开始日）作为临时窗口。',
      note:
        rawStart.getTime() < today.getTime()
          ? '开始日期早于当前日期，未来窗口按今天起算。'
          : undefined,
    }
  }

  return {
    windowDays: 0,
    dateIncomplete: true,
    usesFallbackRule: false,
    note: '日期不足，无法准确判断工时窗口。',
  }
}

function isSameUsageUnit(
  row: Pick<CapacityFreeze | CapacityCommitment, 'taskId' | 'allocationUnitId'>,
  taskId: string,
  allocationUnitId?: string,
): boolean {
  if (row.taskId !== taskId) return false
  return (row.allocationUnitId ?? '') === (allocationUnitId ?? '')
}

function doesUsageOverlapStandardTimeWindow(
  row: Pick<CapacityFreeze | CapacityCommitment, 'windowStartDate' | 'windowEndDate'>,
  window: CapacityStandardTimeWindowSnapshot,
): boolean {
  if (!window.windowStartDate || !window.windowEndDate) return false
  if (!row.windowStartDate && !row.windowEndDate) return true
  const rowStart = row.windowStartDate ? parseDateLike(row.windowStartDate) : row.windowEndDate ? parseDateLike(row.windowEndDate) : null
  const rowEnd = row.windowEndDate ? parseDateLike(row.windowEndDate) : row.windowStartDate ? parseDateLike(row.windowStartDate) : null
  const windowStart = parseDateLike(window.windowStartDate)
  const windowEnd = parseDateLike(window.windowEndDate)
  if (!rowStart || !rowEnd || !windowStart || !windowEnd) return false
  return rowEnd.getTime() >= windowStart.getTime() && rowStart.getTime() <= windowEnd.getTime()
}

function resolveFactoryDailySupplySam(
  context: CapacityStandardTimeEvaluationContext,
  factoryId: string,
  processCode: string,
  craftCode: string,
): number {
  const cacheKey = `${factoryId}::${processCode}::${craftCode}`
  const cached = context.dailySupplyCache.get(cacheKey)
  if (cached != null) return cached

  let dailySupplySam = 0
  try {
    const entry = listFactoryCapacityEntries(factoryId).find(
      ({ row }) => row.processCode === processCode && row.craftCode === craftCode,
    )
    dailySupplySam = roundSam(
      Math.max(
        entry
          ? (computeFactoryCapacityEntryResult(
              entry.row,
              entry.entry.values,
              getFactoryCapacityEquipmentSummary(factoryId, processCode, craftCode),
            ).resultValue ?? 0)
          : 0,
        0,
      ),
    )
  } catch {
    dailySupplySam = 0
  }
  context.dailySupplyCache.set(cacheKey, dailySupplySam)
  return dailySupplySam
}

export function resolveFactoryTaskStandardTimeJudgement(input: {
  task: CapacityUsageTaskLike
  factoryId: string
  standardSamTotal?: number
  allocationUnitId?: string
  evaluationContext?: CapacityStandardTimeEvaluationContext
}): CapacityStandardTimeJudgement {
  const context = input.evaluationContext ?? createCapacityStandardTimeEvaluationContext()
  const identity = resolveUsageIdentity(input.task)
  const taskDemandSam = normalizeSam(input.standardSamTotal ?? input.task.publishedSamTotal)
  const window = resolveCapacityStandardTimeWindow(input.task, context.today)

  if (!taskDemandSam) {
    return {
      factoryId: input.factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowDays: window.windowDays,
      taskDemandSam: undefined,
      exceedsWindow: false,
      status: 'SAM_MISSING',
      reason: '当前任务缺少可用的总标准工时，无法完成工时判断。',
      note: window.note,
      dateIncomplete: window.dateIncomplete,
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
    }
  }

  if (window.dateIncomplete) {
    return {
      factoryId: input.factoryId,
      processCode: identity.processCode,
      craftCode: identity.craftCode,
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      windowDays: window.windowDays,
      taskDemandSam,
      exceedsWindow: false,
      status: 'DATE_INCOMPLETE',
      reason: '日期不足，无法准确判断工时窗口。',
      note: window.note,
      dateIncomplete: true,
      usesFallbackRule: window.usesFallbackRule,
      fallbackRuleLabel: window.fallbackRuleLabel,
    }
  }

  const dailySupplySam = resolveFactoryDailySupplySam(context, input.factoryId, identity.processCode, identity.craftCode)
  const relevantFreezes = context.activeFreezes.filter((item) => {
    if (item.factoryId !== input.factoryId) return false
    if (item.processCode !== identity.processCode || item.craftCode !== identity.craftCode) return false
    if (isSameUsageUnit(item, input.task.taskId, input.allocationUnitId)) return false
    return doesUsageOverlapStandardTimeWindow(item, window)
  })
  const relevantCommitments = context.activeCommitments.filter((item) => {
    if (item.factoryId !== input.factoryId) return false
    if (item.processCode !== identity.processCode || item.craftCode !== identity.craftCode) return false
    if (isSameUsageUnit(item, input.task.taskId, input.allocationUnitId)) return false
    return doesUsageOverlapStandardTimeWindow(item, window)
  })

  const windowSupplySam = roundSam(dailySupplySam * window.windowDays)
  const windowCommittedSam = roundSam(relevantCommitments.reduce((sum, item) => sum + item.standardSamTotal, 0))
  const windowFrozenSam = roundSam(relevantFreezes.reduce((sum, item) => sum + item.standardSamTotal, 0))
  const windowRemainingSam = calculateCapacityRemainingStandardHours({
    supplyStandardHours: windowSupplySam,
    committedStandardHours: windowCommittedSam,
    frozenStandardHours: windowFrozenSam,
  })
  const estimatedDays = dailySupplySam > 0 ? roundSam(taskDemandSam / dailySupplySam) : undefined
  const projectedRemainingSam = calculateCapacityRemainingStandardHours({
    supplyStandardHours: windowRemainingSam,
    committedStandardHours: taskDemandSam,
    frozenStandardHours: 0,
  })

  let status: CapacityStandardTimeJudgementStatus = 'CAPABLE'
  let reason = `未来 ${window.windowDays} 天共可提供 ${windowSupplySam} 标准工时，当前任务消耗 ${taskDemandSam} 标准工时。`

  if (dailySupplySam <= 0) {
    status = 'EXCEEDS_WINDOW'
    reason = '该工厂当前工序/工艺没有可用的默认日可供给标准工时，无法承载当前任务。'
  } else if (window.windowDays <= 0) {
    status = 'EXCEEDS_WINDOW'
    reason = '当前任务截止时间已早于今天，未来窗口已结束，无法在窗口内继续承载。'
  } else if (windowRemainingSam < taskDemandSam) {
    status = 'EXCEEDS_WINDOW'
    reason = `未来 ${window.windowDays} 天剩余 ${windowRemainingSam} 标准工时，小于当前任务需要的 ${taskDemandSam} 标准工时。`
  } else if (
    windowSupplySam > 0 &&
    projectedRemainingSam >= 0 &&
    projectedRemainingSam / windowSupplySam < CAPACITY_TIGHT_THRESHOLD_RATIO
  ) {
    status = 'RISK'
    reason = `当前任务落入后，窗口仅剩 ${projectedRemainingSam} 标准工时，低于窗口供给的 20%，存在排期风险。`
  }

  return {
    factoryId: input.factoryId,
    processCode: identity.processCode,
    craftCode: identity.craftCode,
    windowStartDate: window.windowStartDate,
    windowEndDate: window.windowEndDate,
    windowDays: window.windowDays,
    dailySupplySam,
    windowSupplySam,
    windowCommittedSam,
    windowFrozenSam,
    windowRemainingSam,
    taskDemandSam,
    estimatedDays,
    exceedsWindow: status === 'EXCEEDS_WINDOW',
    status,
    reason,
    note: window.note,
    dateIncomplete: false,
    usesFallbackRule: window.usesFallbackRule,
    fallbackRuleLabel: window.fallbackRuleLabel,
  }
}

function upsertFreezeRecord(
  id: string,
  record: Omit<CapacityFreeze, 'id' | 'createdAt' | 'updatedAt'>,
): CapacityFreeze {
  const current = capacityFreezes.get(id)
  const next: CapacityFreeze = {
    id,
    createdAt: current?.createdAt ?? nowTimestamp(),
    updatedAt: nowTimestamp(),
    ...current,
    ...record,
  }
  capacityFreezes.set(id, next)
  return next
}

function upsertCommitmentRecord(
  id: string,
  record: Omit<CapacityCommitment, 'id' | 'createdAt' | 'updatedAt'>,
): CapacityCommitment {
  const current = capacityCommitments.get(id)
  const next: CapacityCommitment = {
    id,
    createdAt: current?.createdAt ?? nowTimestamp(),
    updatedAt: nowTimestamp(),
    ...current,
    ...record,
  }
  capacityCommitments.set(id, next)
  return next
}

function seedInitialCapacityUsageRecords(): void {
  const commitmentSeeds: Array<{
    id: string
    record: Omit<CapacityCommitment, 'id' | 'createdAt' | 'updatedAt'>
  }> = [
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F013',
        taskId: 'TASKGEN-202603-0002-005__ORDER',
      }),
      record: {
        factoryId: 'ID-F013',
        processCode: 'BUTTON_ATTACH',
        craftCode: 'CRAFT_032768',
        taskId: 'TASKGEN-202603-0002-005__ORDER',
        standardSamTotal: 9000,
        windowStartDate: '2026-03-18',
        windowEndDate: '2026-04-10',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '已落厂可承载样例：用于任务工时风险里的可承载任务。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F011',
        taskId: 'TASKGEN-202603-0015-002__ORDER',
      }),
      record: {
        factoryId: 'ID-F011',
        processCode: 'SEW',
        craftCode: 'CRAFT_262145',
        taskId: 'TASKGEN-202603-0015-002__ORDER',
        standardSamTotal: 1400,
        windowStartDate: '2026-04-12',
        windowEndDate: '2026-04-12',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '已落厂紧张样例：配合背景占用验证窗口余量不足 20%。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'TENDER_AWARDED',
        factoryId: 'ID-F026',
        taskId: 'TASKGEN-202603-0004-001__ORDER',
      }),
      record: {
        factoryId: 'ID-F026',
        processCode: 'SEW',
        craftCode: 'CRAFT_262144',
        taskId: 'TASKGEN-202603-0004-001__ORDER',
        standardSamTotal: 42000,
        windowStartDate: '2026-04-10',
        windowEndDate: '2026-04-10',
        sourceType: 'TENDER_AWARDED',
        status: 'ACTIVE',
        note: '已落厂超出窗口样例：用于验证超载状态与硬拦截。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F017',
        taskId: 'TASKGEN-202603-0008-001__ORDER',
      }),
      record: {
        factoryId: 'ID-F017',
        processCode: 'SEW',
        craftCode: 'CRAFT_262144',
        taskId: 'TASKGEN-202603-0008-001__ORDER',
        standardSamTotal: 12000,
        windowStartDate: '2026-04-11',
        windowEndDate: '2026-04-11',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '已落厂暂停样例：命中暂停例外后优先显示暂停。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F011',
        taskId: 'CAPACITY-BG-BTNATTACH-TIGHT',
      }),
      record: {
        factoryId: 'ID-F011',
        processCode: 'BUTTON_ATTACH',
        craftCode: 'CRAFT_032768',
        taskId: 'CAPACITY-BG-BTNATTACH-TIGHT',
        standardSamTotal: 14400,
        windowStartDate: '2026-03-18',
        windowEndDate: '2026-04-10',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '背景占用：用于工厂日历与瓶颈页的紧张行样例。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F010',
        taskId: 'CAPACITY-BG-BTNATTACH-WHOLE-TIGHT',
      }),
      record: {
        factoryId: 'ID-F010',
        processCode: 'BUTTON_ATTACH',
        craftCode: 'CRAFT_032768',
        taskId: 'CAPACITY-BG-BTNATTACH-WHOLE-TIGHT',
        standardSamTotal: 55200,
        windowStartDate: '2026-03-18',
        windowEndDate: '2026-04-10',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '背景占用：用于整任务直接派单/创建招标单的紧张候选样例。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F011',
        taskId: 'CAPACITY-BG-SEW-RISK-TIGHT',
      }),
      record: {
        factoryId: 'ID-F011',
        processCode: 'SEW',
        craftCode: 'CRAFT_262145',
        taskId: 'CAPACITY-BG-SEW-RISK-TIGHT',
        standardSamTotal: 500,
        windowStartDate: '2026-04-12',
        windowEndDate: '2026-04-12',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '背景占用：用于任务工时风险里的紧张任务样例。',
      },
    },
    {
      id: buildCommitmentId({
        sourceType: 'DIRECT_ACCEPTED',
        factoryId: 'ID-F026',
        taskId: 'CAPACITY-BG-SEW-DETAIL-TIGHT',
      }),
      record: {
        factoryId: 'ID-F026',
        processCode: 'SEW',
        craftCode: 'CRAFT_262145',
        taskId: 'CAPACITY-BG-SEW-DETAIL-TIGHT',
        standardSamTotal: 500,
        windowStartDate: '2026-04-12',
        windowEndDate: '2026-04-12',
        sourceType: 'DIRECT_ACCEPTED',
        status: 'ACTIVE',
        note: '背景占用：用于按明细模式逐组紧张样例。',
      },
    },
  ]

  const freezeSeeds: Array<{
    id: string
    record: Omit<CapacityFreeze, 'id' | 'createdAt' | 'updatedAt'>
  }> = [
    {
      id: buildFreezeId({
        sourceType: 'TENDER_PARTICIPATING',
        factoryId: 'ID-F011',
        taskId: 'TASKGEN-202603-0003-001__ORDER',
      }),
      record: {
        factoryId: 'ID-F011',
        processCode: 'SEW',
        craftCode: 'CRAFT_262144',
        taskId: 'TASKGEN-202603-0003-001__ORDER',
        standardSamTotal: 72000,
        windowStartDate: '2026-04-12',
        windowEndDate: '2026-04-12',
        sourceType: 'TENDER_PARTICIPATING',
        status: 'ACTIVE',
        note: '冻结待确认样例：任务已形成冻结对象，但尚未转成正式占用。',
      },
    },
  ]

  for (const { id, record } of commitmentSeeds) {
    upsertCommitmentRecord(id, record)
  }

  for (const { id, record } of freezeSeeds) {
    upsertFreezeRecord(id, record)
  }
}

seedInitialCapacityUsageRecords()

function buildUsageInputFromTask(
  task: CapacityUsageTaskLike,
  factoryId: string,
  options?: {
    allocationUnitId?: string
    standardSamTotal?: number
    windowStartDate?: string
    windowEndDate?: string
    note?: string
  },
): CapacityUsageAllocationUnitInput | null {
  const standardSamTotal = normalizeSam(options?.standardSamTotal ?? task.publishedSamTotal)
  if (!standardSamTotal) return null
  const identity = resolveCapacityUsageTaskIdentity(task)
  if (!identity) return null
  const window = resolveCapacityUsageWindow(task)
  return {
    factoryId,
    taskId: task.taskId,
    processCode: identity.processCode,
    craftCode: identity.craftCode,
    allocationUnitId: options?.allocationUnitId,
    standardSamTotal,
    windowStartDate: normalizeDateKey(options?.windowStartDate) ?? window.windowStartDate,
    windowEndDate: normalizeDateKey(options?.windowEndDate) ?? window.windowEndDate,
    note: appendUsageNote(window.note, options?.note),
  }
}

export function createFreezeFromDirectDispatch(
  task: CapacityUsageTaskLike,
  input: {
    factoryId: string
    allocationUnitId?: string
    standardSamTotal?: number
    windowStartDate?: string
    windowEndDate?: string
    note?: string
  },
): CapacityFreeze | null {
  const usageInput = buildUsageInputFromTask(task, input.factoryId, input)
  if (!usageInput) return null
  const id = buildFreezeId({
    sourceType: 'DIRECT_PENDING_ACCEPT',
    factoryId: usageInput.factoryId,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
  })
  return upsertFreezeRecord(id, {
    factoryId: usageInput.factoryId,
    processCode: usageInput.processCode,
    craftCode: usageInput.craftCode,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
    standardSamTotal: usageInput.standardSamTotal,
    windowStartDate: usageInput.windowStartDate,
    windowEndDate: usageInput.windowEndDate,
    sourceType: 'DIRECT_PENDING_ACCEPT',
    status: 'ACTIVE',
    note: usageInput.note,
    convertedAt: undefined,
    releasedAt: undefined,
  })
}

export function createFreezeFromTenderParticipation(
  task: CapacityUsageTaskLike,
  input: {
    factoryId: string
    allocationUnitId?: string
    standardSamTotal?: number
    windowStartDate?: string
    windowEndDate?: string
    note?: string
  },
): CapacityFreeze | null {
  const usageInput = buildUsageInputFromTask(task, input.factoryId, input)
  if (!usageInput) return null
  const id = buildFreezeId({
    sourceType: 'TENDER_PARTICIPATING',
    factoryId: usageInput.factoryId,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
  })
  return upsertFreezeRecord(id, {
    factoryId: usageInput.factoryId,
    processCode: usageInput.processCode,
    craftCode: usageInput.craftCode,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
    standardSamTotal: usageInput.standardSamTotal,
    windowStartDate: usageInput.windowStartDate,
    windowEndDate: usageInput.windowEndDate,
    sourceType: 'TENDER_PARTICIPATING',
    status: 'ACTIVE',
    note: usageInput.note,
    convertedAt: undefined,
    releasedAt: undefined,
  })
}

export function releaseFreeze(input: {
  sourceType: FreezeSourceType
  task: CapacityUsageTaskLike
  factoryId: string
  allocationUnitId?: string
  standardSamTotal?: number
  windowStartDate?: string
  windowEndDate?: string
  note?: string
}): CapacityFreeze | null {
  const usageInput = buildUsageInputFromTask(input.task, input.factoryId, input)
  if (!usageInput) return null
  const id = buildFreezeId({
    sourceType: input.sourceType,
    factoryId: usageInput.factoryId,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
  })
  const current = capacityFreezes.get(id)
  const releasedAt = nowTimestamp()
  return upsertFreezeRecord(id, {
    factoryId: usageInput.factoryId,
    processCode: usageInput.processCode,
    craftCode: usageInput.craftCode,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
    standardSamTotal: usageInput.standardSamTotal,
    windowStartDate: usageInput.windowStartDate,
    windowEndDate: usageInput.windowEndDate,
    sourceType: input.sourceType,
    status: 'RELEASED',
    note: appendUsageNote(current?.note, usageInput.note),
    convertedAt: current?.convertedAt,
    releasedAt,
  })
}

export function convertFreezeToCommitment(input: {
  task: CapacityUsageTaskLike
  factoryId: string
  allocationUnitId?: string
  standardSamTotal?: number
  windowStartDate?: string
  windowEndDate?: string
  note?: string
  freezeSourceType: FreezeSourceType
  commitmentSourceType: CommitmentSourceType
}): { freeze: CapacityFreeze | null; commitment: CapacityCommitment | null } {
  const usageInput = buildUsageInputFromTask(input.task, input.factoryId, input)
  if (!usageInput) return { freeze: null, commitment: null }
  const convertedAt = nowTimestamp()
  const freezeId = buildFreezeId({
    sourceType: input.freezeSourceType,
    factoryId: usageInput.factoryId,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
  })
  const currentFreeze = capacityFreezes.get(freezeId)
  const freeze = upsertFreezeRecord(freezeId, {
    factoryId: usageInput.factoryId,
    processCode: usageInput.processCode,
    craftCode: usageInput.craftCode,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
    standardSamTotal: usageInput.standardSamTotal,
    windowStartDate: usageInput.windowStartDate,
    windowEndDate: usageInput.windowEndDate,
    sourceType: input.freezeSourceType,
    status: 'CONVERTED',
    note: appendUsageNote(currentFreeze?.note, usageInput.note),
    convertedAt,
    releasedAt: currentFreeze?.releasedAt,
  })

  const commitmentId = buildCommitmentId({
    sourceType: input.commitmentSourceType,
    factoryId: usageInput.factoryId,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
  })
  const commitment = upsertCommitmentRecord(commitmentId, {
    factoryId: usageInput.factoryId,
    processCode: usageInput.processCode,
    craftCode: usageInput.craftCode,
    taskId: usageInput.taskId,
    allocationUnitId: usageInput.allocationUnitId,
    standardSamTotal: usageInput.standardSamTotal,
    windowStartDate: usageInput.windowStartDate,
    windowEndDate: usageInput.windowEndDate,
    sourceType: input.commitmentSourceType,
    status: 'ACTIVE',
    note: usageInput.note,
    releasedAt: undefined,
  })

  return { freeze, commitment }
}

function hasDetailDispatchAudit(task: Pick<CapacityUsageTaskLike, 'auditLogs'>): boolean {
  return Boolean(task.auditLogs?.some((log) => log.action === 'DETAIL_DISPATCH' || log.action === 'DETAIL_TENDER_SPLIT'))
}

export function syncDirectTaskCapacityUsage(task: CapacityUsageTaskLike): void {
  if (task.assignmentMode !== 'DIRECT' || !task.assignedFactoryId) return
  if (task.isSplitResult || task.isSplitSource || hasDetailDispatchAudit(task)) return

  if (task.acceptanceStatus === 'ACCEPTED') {
    convertFreezeToCommitment({
      task,
      factoryId: task.assignedFactoryId,
      freezeSourceType: 'DIRECT_PENDING_ACCEPT',
      commitmentSourceType: 'DIRECT_ACCEPTED',
      note: '工厂已接单，冻结标准工时转为正式占用。',
    })
    return
  }

  if (task.acceptanceStatus === 'REJECTED') {
    releaseFreeze({
      sourceType: 'DIRECT_PENDING_ACCEPT',
      task,
      factoryId: task.assignedFactoryId,
      note: '工厂未接单，释放冻结标准工时。',
    })
    return
  }

  createFreezeFromDirectDispatch(task, {
    factoryId: task.assignedFactoryId,
    note: '直接派单已发起，工厂待接单，先冻结标准工时。',
  })
}

export function syncTenderParticipationCapacityUsage(
  task: CapacityUsageTaskLike,
  tender: CapacityTenderParticipationSnapshot,
): void {
  if (task.isSplitResult || task.isSplitSource || hasDetailDispatchAudit(task)) return
  const fallbackParticipantIds =
    tender.status === 'AWARDED'
      ? [tender.awardedFactoryId, task.assignedFactoryId].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : []
  const participantFactoryIds = Array.from(
    new Set([...tender.participatingFactoryIds.filter(Boolean), ...fallbackParticipantIds]),
  )
  if (participantFactoryIds.length === 0) return

  if (tender.status === 'AWARDED') {
    for (const factoryId of participantFactoryIds) {
      if (tender.awardedFactoryId && factoryId === tender.awardedFactoryId) {
        convertFreezeToCommitment({
          task,
          factoryId,
          freezeSourceType: 'TENDER_PARTICIPATING',
          commitmentSourceType: 'TENDER_AWARDED',
          note: '竞价已中标，冻结标准工时转为正式占用。',
        })
        continue
      }

      releaseFreeze({
        sourceType: 'TENDER_PARTICIPATING',
        task,
        factoryId,
        note: tender.awardedFactoryId
          ? '竞价未中标，释放冻结标准工时。'
          : '竞价已结束但未确认中标工厂，释放冻结标准工时。',
      })
    }
    return
  }

  for (const factoryId of participantFactoryIds) {
    createFreezeFromTenderParticipation(task, {
      factoryId,
      note: tender.status === 'AWAIT_AWARD'
        ? '工厂已参与报价，待定标期间冻结标准工时。'
        : '工厂已参与当前招标，先冻结标准工时。',
    })
  }
}

export function listCapacityFreezes(filters?: {
  factoryId?: string
  taskId?: string
  allocationUnitId?: string
  status?: CapacityUsageStatus
  sourceType?: FreezeSourceType
}): CapacityFreeze[] {
  return Array.from(capacityFreezes.values()).filter((item) => {
    if (filters?.factoryId && item.factoryId !== filters.factoryId) return false
    if (filters?.taskId && item.taskId !== filters.taskId) return false
    if (filters?.allocationUnitId !== undefined && item.allocationUnitId !== filters.allocationUnitId) return false
    if (filters?.status && item.status !== filters.status) return false
    if (filters?.sourceType && item.sourceType !== filters.sourceType) return false
    return true
  })
}

export function listCapacityCommitments(filters?: {
  factoryId?: string
  taskId?: string
  allocationUnitId?: string
  status?: CapacityUsageStatus
  sourceType?: CommitmentSourceType
}): CapacityCommitment[] {
  return Array.from(capacityCommitments.values()).filter((item) => {
    if (filters?.factoryId && item.factoryId !== filters.factoryId) return false
    if (filters?.taskId && item.taskId !== filters.taskId) return false
    if (filters?.allocationUnitId !== undefined && item.allocationUnitId !== filters.allocationUnitId) return false
    if (filters?.status && item.status !== filters.status) return false
    if (filters?.sourceType && item.sourceType !== filters.sourceType) return false
    return true
  })
}

export function listActiveFreezesByFactory(factoryId?: string): CapacityFreeze[] {
  return listCapacityFreezes({
    ...(factoryId ? { factoryId } : {}),
    status: 'ACTIVE',
  })
}

export function listActiveCommitmentsByFactory(factoryId?: string): CapacityCommitment[] {
  return listCapacityCommitments({
    ...(factoryId ? { factoryId } : {}),
    status: 'ACTIVE',
  })
}

function doesWindowMatch(
  row: Pick<CapacityFreeze | CapacityCommitment, 'windowStartDate' | 'windowEndDate'>,
  filters: { startDate?: string; endDate?: string },
): boolean {
  if (!filters.startDate && !filters.endDate) return true
  const start = row.windowStartDate ? parseDateLike(row.windowStartDate) : null
  const end = row.windowEndDate ? parseDateLike(row.windowEndDate) : null
  const filterStart = filters.startDate ? parseDateLike(filters.startDate) : null
  const filterEnd = filters.endDate ? parseDateLike(filters.endDate) : null
  if (!start && !end) return false
  const rowStart = start ?? end
  const rowEnd = end ?? start
  if (!rowStart || !rowEnd) return false
  if (filterStart && rowEnd.getTime() < filterStart.getTime()) return false
  if (filterEnd && rowStart.getTime() > filterEnd.getTime()) return false
  return true
}

export function aggregateFactorySamUsage(filters?: {
  factoryId?: string
  processCode?: string
  craftCode?: string
  startDate?: string
  endDate?: string
}): CapacityUsageAggregateResult {
  const freezes = listActiveFreezesByFactory(filters?.factoryId).filter((item) => {
    if (filters?.processCode && item.processCode !== filters.processCode) return false
    if (filters?.craftCode && item.craftCode !== filters.craftCode) return false
    return doesWindowMatch(item, { startDate: filters?.startDate, endDate: filters?.endDate })
  })
  const commitments = listActiveCommitmentsByFactory(filters?.factoryId).filter((item) => {
    if (filters?.processCode && item.processCode !== filters.processCode) return false
    if (filters?.craftCode && item.craftCode !== filters.craftCode) return false
    return doesWindowMatch(item, { startDate: filters?.startDate, endDate: filters?.endDate })
  })

  return {
    freezeTotal: Math.round(
      freezes.reduce((sum, item) => sum + item.standardSamTotal, 0) * 1000,
    ) / 1000,
    commitmentTotal: Math.round(
      commitments.reduce((sum, item) => sum + item.standardSamTotal, 0) * 1000,
    ) / 1000,
    freezeCount: freezes.length,
    commitmentCount: commitments.length,
  }
}
