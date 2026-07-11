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
  routeParallelGroupName?: string
  routeParallelAcceptanceMode?: RouteParallelAcceptanceMode
  linkedBomItemIds?: string[]
}

type IndexedRouteEntry<T> = { entry: T; index: number }
type RouteEntryGroup<T> = { items: Array<IndexedRouteEntry<T>>; forceIndependent?: boolean }

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

  const initialGroups: Array<Array<IndexedRouteEntry<T>>> = []
  let previousStepKey: number | string | null = null
  for (const item of sorted) {
    const stepKey = isPositiveStepNo(item.entry.routeStepNo) ? item.entry.routeStepNo : `missing-${item.index}`
    if (stepKey !== previousStepKey) {
      initialGroups.push([])
      previousStepKey = stepKey
    }
    initialGroups[initialGroups.length - 1].push(item)
  }

  const sharesBomItem = (left: T, right: T): boolean => {
    const rightIds = new Set((right.linkedBomItemIds ?? []).filter(Boolean))
    return rightIds.size > 0 && (left.linkedBomItemIds ?? []).some((id) => Boolean(id) && rightIds.has(id))
  }

  const groups: Array<RouteEntryGroup<T>> = initialGroups.map((items) => ({ items: [...items] }))
  const findSharedRouteViolation = (): { dyeGroupIndex: number; waterGroupIndex: number } | null => {
    for (let dyeGroupIndex = 0; dyeGroupIndex < groups.length; dyeGroupIndex += 1) {
      const dyeEntries = groups[dyeGroupIndex].items.filter((item) => item.entry.processCode === 'DYE')
      if (dyeEntries.length === 0) continue
      for (let waterGroupIndex = dyeGroupIndex; waterGroupIndex < groups.length; waterGroupIndex += 1) {
        const hasSharedWater = groups[waterGroupIndex].items.some(
          (item) => item.entry.processCode === 'WATER_SOLUBLE'
            && dyeEntries.some((dye) => sharesBomItem(item.entry, dye.entry)),
        )
        if (hasSharedWater) return { dyeGroupIndex, waterGroupIndex }
      }
    }
    return null
  }

  const maxCorrections = Math.max(1, entries.length * entries.length)
  for (let correctionCount = 0; correctionCount < maxCorrections; correctionCount += 1) {
    const violation = findSharedRouteViolation()
    if (!violation) break
    const { dyeGroupIndex, waterGroupIndex } = violation

    if (waterGroupIndex > dyeGroupIndex) {
      const [waterGroup] = groups.splice(waterGroupIndex, 1)
      groups.splice(dyeGroupIndex, 0, waterGroup)
      continue
    }

    const dyeEntries = groups[dyeGroupIndex].items.filter((item) => item.entry.processCode === 'DYE')
    const sharedWaterEntries = groups[dyeGroupIndex].items.filter(
      (item) => item.entry.processCode === 'WATER_SOLUBLE' && dyeEntries.some((dye) => sharesBomItem(item.entry, dye.entry)),
    )
    if (sharedWaterEntries.length === 0) break
    const sharedWaterIndexes = new Set(sharedWaterEntries.map((item) => item.index))
    const remainingGroup = groups[dyeGroupIndex].items.filter((item) => !sharedWaterIndexes.has(item.index))
    groups.splice(
      dyeGroupIndex,
      1,
      { items: sharedWaterEntries, forceIndependent: true },
      { items: remainingGroup, forceIndependent: remainingGroup.length === 1 },
    )
  }

  return groups.flatMap((group, groupIndex) => {
    const stepEntries = group.items
    const stepNo = groupIndex + 1
    const isParallel = stepEntries.length > 1
    const existingGroupId = stepEntries.find((stepItem) => stepItem.entry.routeParallelGroupId)?.entry.routeParallelGroupId
    const groupId = group.forceIndependent ? undefined : existingGroupId ?? (isParallel ? `route-step-${stepNo}` : undefined)
    const existingGroupName = stepEntries.find((stepItem) => stepItem.entry.routeParallelGroupName)?.entry.routeParallelGroupName

    return stepEntries.map((item, laneIndex) => ({
      ...item.entry,
      routeStepNo: stepNo,
      routeLaneNo: laneIndex + 1,
      routeParallelGroupId: groupId,
      routeParallelGroupName: group.forceIndependent ? undefined : existingGroupName,
      routeParallelAcceptanceMode: group.forceIndependent
        ? 'INDEPENDENT_ONLY'
        : groupId
          ? item.entry.routeParallelAcceptanceMode ?? 'INDEPENDENT_ONLY'
          : item.entry.routeParallelAcceptanceMode,
    } as T))
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
