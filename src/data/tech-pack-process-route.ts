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

function isPositiveStepNo(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function getStageSort(stageCode: string): number {
  return STAGE_SORT[stageCode] ?? Number.MAX_SAFE_INTEGER
}

function getNumberSort(value: number | undefined): number {
  return isPositiveStepNo(value) ? value : Number.MAX_SAFE_INTEGER
}

function compareRouteBase<T extends RouteEntryBase & { stageCode?: string }>(
  left: T,
  right: T,
): number {
  const stepCompare = getNumberSort(left.routeStepNo) - getNumberSort(right.routeStepNo)
  if (stepCompare !== 0) return stepCompare

  const laneCompare = getNumberSort(left.routeLaneNo) - getNumberSort(right.routeLaneNo)
  if (laneCompare !== 0) return laneCompare

  const stageCompare = getStageSort(left.stageCode ?? '') - getStageSort(right.stageCode ?? '')
  if (stageCompare !== 0) return stageCompare

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
    } as T))
  })
  assertWaterBeforeDyeInvariant(normalized)
  return normalized
}
