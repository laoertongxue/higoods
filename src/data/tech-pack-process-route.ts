import { getDefaultProcessRouteOrder } from './fcs/process-craft-dict.ts'

type RouteParallelAcceptanceMode = 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'

type RouteEntryBase = {
  id: string
  routeStepNo?: number
  routeLaneNo?: number
}

type NormalizableRouteEntry = RouteEntryBase & {
  stageCode: string
  processCode: string
  routeParallelGroupId?: string
  routeParallelAcceptanceMode?: RouteParallelAcceptanceMode
}

const STAGE_SORT: Record<string, number> = {
  PREP: 1,
  PROD: 2,
  POST: 3,
}

export type RouteContinuityResult = { allowed: boolean; reason: string }
export interface RouteContinuityOptions {
  canSingleFactoryCoverProcesses?: (processCodes: string[]) => boolean
}

function isPositiveStepNo(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function getStageSort(stageCode: string): number {
  return STAGE_SORT[stageCode] ?? Number.MAX_SAFE_INTEGER
}

function getNumberSort(value: number | undefined): number {
  return isPositiveStepNo(value) ? value : Number.MAX_SAFE_INTEGER
}

function getProcessRouteSort(processCode: string | undefined): number {
  return processCode ? getDefaultProcessRouteOrder(processCode) : Number.MAX_SAFE_INTEGER
}

function compareRouteBase<T extends RouteEntryBase & { stageCode?: string; processCode?: string }>(
  left: T,
  right: T,
): number {
  const stepCompare = getNumberSort(left.routeStepNo) - getNumberSort(right.routeStepNo)
  if (stepCompare !== 0) return stepCompare

  const laneCompare = getNumberSort(left.routeLaneNo) - getNumberSort(right.routeLaneNo)
  if (laneCompare !== 0) return laneCompare

  const stageCompare = getStageSort(left.stageCode ?? '') - getStageSort(right.stageCode ?? '')
  if (stageCompare !== 0) return stageCompare

  const processRouteCompare = getProcessRouteSort(left.processCode) - getProcessRouteSort(right.processCode)
  if (processRouteCompare !== 0) return processRouteCompare

  const processCompare = (left.processCode ?? '').localeCompare(right.processCode ?? '', 'zh-CN')
  if (processCompare !== 0) return processCompare

  return 0
}

export function sortProcessRouteEntries<T extends {
  id: string
  stageCode: string
  routeStepNo?: number
  routeLaneNo?: number
}>(entries: T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => compareRouteBase(left.entry, right.entry) || left.index - right.index)
    .map(({ entry }) => entry)
}

export function normalizeProcessRouteEntries<T extends NormalizableRouteEntry>(entries: T[]): T[] {
  const sorted = [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => compareRouteBase(left.entry, right.entry) || left.index - right.index)

  const stepKeyByIndex = new Map<number, number | string>()
  let normalizedStepNo = 0
  let previousStepKey: number | string | null = null

  for (const item of sorted) {
    const stepKey = isPositiveStepNo(item.entry.routeStepNo) ? item.entry.routeStepNo : `missing-${item.index}`
    if (stepKey !== previousStepKey) {
      normalizedStepNo += 1
      previousStepKey = stepKey
    }
    stepKeyByIndex.set(item.index, normalizedStepNo)
  }

  const groups = new Map<number, Array<{ entry: T; index: number }>>()
  for (const item of sorted) {
    const stepNo = stepKeyByIndex.get(item.index) as number
    groups.set(stepNo, [...(groups.get(stepNo) ?? []), item])
  }

  return sorted.map((item) => {
    const stepNo = stepKeyByIndex.get(item.index) as number
    const stepEntries = groups.get(stepNo) ?? []
    const laneNo = stepEntries.findIndex((stepItem) => stepItem.index === item.index) + 1
    const isParallel = stepEntries.length > 1
    const fallbackGroupId = isParallel
      ? stepEntries.find((stepItem) => stepItem.entry.routeParallelGroupId)?.entry.routeParallelGroupId ?? `route-step-${stepNo}`
      : undefined

    return {
      ...item.entry,
      routeStepNo: stepNo,
      routeLaneNo: laneNo,
      routeParallelGroupId: item.entry.routeParallelGroupId ?? fallbackGroupId,
      routeParallelAcceptanceMode: item.entry.routeParallelGroupId || fallbackGroupId
        ? item.entry.routeParallelAcceptanceMode ?? 'INDEPENDENT_ONLY'
        : item.entry.routeParallelAcceptanceMode,
    } as T
  })
}

export function areRouteEntriesContinuous(entries: Array<{
  id: string
  processCode?: string
  routeStepNo?: number
  routeParallelGroupId?: string
  routeParallelAcceptanceMode?: RouteParallelAcceptanceMode
}>, options: RouteContinuityOptions = {}): RouteContinuityResult {
  if (entries.length <= 1) {
    return { allowed: true, reason: '少于两个工序，无需连续合并判断' }
  }

  if (entries.some((entry) => !isPositiveStepNo(entry.routeStepNo))) {
    return { allowed: false, reason: '存在未配置路线步骤的工序，不能合并连续工序任务' }
  }

  const stepGroups = new Map<number, typeof entries>()
  for (const entry of entries) {
    const stepNo = entry.routeStepNo as number
    stepGroups.set(stepNo, [...(stepGroups.get(stepNo) ?? []), entry])
  }

  const steps = [...stepGroups.keys()].sort((left, right) => left - right)
  for (let index = 1; index < steps.length; index += 1) {
    const previous = steps[index - 1]
    const current = steps[index]
    if (current - previous !== 1) {
      return { allowed: false, reason: `路线步骤不连续：第 ${previous} 步后缺少第 ${previous + 1} 步` }
    }
  }

  for (const group of stepGroups.values()) {
    const hasParallelMark = group.length > 1 || group.some((entry) => entry.routeParallelGroupId)
    if (!hasParallelMark) continue
    if (group.some((entry) => entry.routeParallelAcceptanceMode !== 'WHOLE_GROUP_ALLOWED')) {
      return { allowed: false, reason: '并行工序默认分别承接，不能和前后工序合并为连续工序任务' }
    }
    if (options.canSingleFactoryCoverProcesses) {
      const processCodes = Array.from(new Set(group.map((entry) => entry.processCode).filter(Boolean))) as string[]
      if (processCodes.length > 1 && !options.canSingleFactoryCoverProcesses(processCodes)) {
        return { allowed: false, reason: '同一工厂不具备并行组全部工序能力，不能整体承接该并行组' }
      }
    }
  }

  return { allowed: true, reason: '路线步骤连续，可合并为连续工序任务' }
}
