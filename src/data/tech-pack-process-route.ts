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
type RouteEntryGroup<T> = {
  items: Array<IndexedRouteEntry<T>>
  stableOrder: number
  forceIndependent?: boolean
  groupIdOverride?: string
  groupNameOverride?: string
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

function sharesLinkedBomItem<T extends NormalizableRouteEntry>(left: T, right: T): boolean {
  const rightIds = new Set((right.linkedBomItemIds ?? []).filter(Boolean))
  return rightIds.size > 0 && (left.linkedBomItemIds ?? []).some((id) => Boolean(id) && rightIds.has(id))
}

function splitDependentWaterEntries<T extends NormalizableRouteEntry>(
  initialGroups: Array<Array<IndexedRouteEntry<T>>>,
): Array<RouteEntryGroup<T>> {
  const allDyeEntries = initialGroups
    .flat()
    .filter((item) => item.entry.processCode === 'DYE')

  return initialGroups.flatMap((items, groupIndex) => {
    const hasDye = items.some((item) => item.entry.processCode === 'DYE')
    const dependentWaterEntries = hasDye
      ? items.filter(
          (item) => item.entry.processCode === 'WATER_SOLUBLE'
            && allDyeEntries.some((dye) => sharesLinkedBomItem(item.entry, dye.entry)),
        )
      : []
    if (dependentWaterEntries.length === 0) {
      return [{ items: [...items], stableOrder: groupIndex * 2 }]
    }

    const waterIndexes = new Set(dependentWaterEntries.map((item) => item.index))
    const remainingItems = items.filter((item) => !waterIndexes.has(item.index))
    const waterGroup: RouteEntryGroup<T> = {
      items: dependentWaterEntries,
      stableOrder: groupIndex * 2,
      forceIndependent: dependentWaterEntries.length === 1,
      groupIdOverride: dependentWaterEntries.length > 1 ? `water-soluble-split-${groupIndex + 1}` : undefined,
      groupNameOverride: dependentWaterEntries.length > 1 ? '水溶前置并行组' : undefined,
    }
    const remainingGroup: RouteEntryGroup<T> = {
      items: remainingItems,
      stableOrder: groupIndex * 2 + 1,
      forceIndependent: remainingItems.length === 1,
    }
    return [waterGroup, remainingGroup]
  })
}

function stableSortRouteGroups<T extends NormalizableRouteEntry>(
  groups: Array<RouteEntryGroup<T>>,
): Array<RouteEntryGroup<T>> {
  const groupIndexByEntryIndex = new Map<number, number>()
  groups.forEach((group, groupIndex) => {
    group.items.forEach((item) => groupIndexByEntryIndex.set(item.index, groupIndex))
  })

  const edges = groups.map(() => new Set<number>())
  const indegrees = groups.map(() => 0)
  const waterEntries = groups.flatMap((group) => group.items).filter((item) => item.entry.processCode === 'WATER_SOLUBLE')
  const dyeEntries = groups.flatMap((group) => group.items).filter((item) => item.entry.processCode === 'DYE')
  for (const water of waterEntries) {
    for (const dye of dyeEntries) {
      if (!sharesLinkedBomItem(water.entry, dye.entry)) continue
      const waterGroupIndex = groupIndexByEntryIndex.get(water.index)
      const dyeGroupIndex = groupIndexByEntryIndex.get(dye.index)
      if (waterGroupIndex === undefined || dyeGroupIndex === undefined || waterGroupIndex === dyeGroupIndex) continue
      if (edges[waterGroupIndex].has(dyeGroupIndex)) continue
      edges[waterGroupIndex].add(dyeGroupIndex)
      indegrees[dyeGroupIndex] += 1
    }
  }

  const remaining = new Set(groups.map((_, index) => index))
  const sortedGroups: Array<RouteEntryGroup<T>> = []
  while (remaining.size > 0) {
    const nextIndex = [...remaining]
      .filter((index) => indegrees[index] === 0)
      .sort((left, right) => groups[left].stableOrder - groups[right].stableOrder || left - right)[0]
    if (nextIndex === undefined) {
      throw new Error('水溶与染色工序路线存在无法消解的依赖循环，请检查 BOM 物料绑定')
    }
    remaining.delete(nextIndex)
    sortedGroups.push(groups[nextIndex])
    edges[nextIndex].forEach((targetIndex) => {
      indegrees[targetIndex] -= 1
    })
  }
  return sortedGroups
}

function assertWaterBeforeDyeInvariant<T extends NormalizableRouteEntry>(entries: T[]): void {
  const waterEntries = entries.filter((item) => item.processCode === 'WATER_SOLUBLE')
  const dyeEntries = entries.filter((item) => item.processCode === 'DYE')
  const violation = waterEntries.find((water) => dyeEntries.some(
    (dye) => sharesLinkedBomItem(water, dye)
      && getNumberSort(water.routeStepNo) >= getNumberSort(dye.routeStepNo),
  ))
  if (violation) {
    throw new Error('水溶与染色工序路线归一化失败：共享 BOM 物料必须先水溶、后染色')
  }
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

  const groups = stableSortRouteGroups(splitDependentWaterEntries(initialGroups))

  const normalized = groups.flatMap((group, groupIndex) => {
    const stepEntries = group.items
    const stepNo = groupIndex + 1
    const isParallel = stepEntries.length > 1
    const existingGroupId = stepEntries.find((stepItem) => stepItem.entry.routeParallelGroupId)?.entry.routeParallelGroupId
    const groupId = group.forceIndependent
      ? undefined
      : group.groupIdOverride ?? existingGroupId ?? (isParallel ? `route-step-${stepNo}` : undefined)
    const existingGroupName = stepEntries.find((stepItem) => stepItem.entry.routeParallelGroupName)?.entry.routeParallelGroupName

    return stepEntries.map((item, laneIndex) => ({
      ...item.entry,
      routeStepNo: stepNo,
      routeLaneNo: laneIndex + 1,
      routeParallelGroupId: groupId,
      routeParallelGroupName: group.forceIndependent ? undefined : group.groupNameOverride ?? existingGroupName,
      routeParallelAcceptanceMode: group.forceIndependent
        ? 'INDEPENDENT_ONLY'
        : groupId
          ? item.entry.routeParallelAcceptanceMode ?? 'INDEPENDENT_ONLY'
          : item.entry.routeParallelAcceptanceMode,
    } as T))
  })
  assertWaterBeforeDyeInvariant(normalized)
  return normalized
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
