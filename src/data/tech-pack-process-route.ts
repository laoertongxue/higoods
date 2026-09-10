import type { TechnicalProcessObjectType } from './pcs-technical-data-version-types.ts'

export const LEGACY_PROCESS_ROUTE_SCHEMA_VERSION = 1
export const CURRENT_PROCESS_ROUTE_SCHEMA_VERSION = 2
export const PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER = 'CLEAN-008:STEP_LANE_TO_EXPLICIT_PREDECESSORS:V1_TO_V2'
export const PROCESS_ROUTE_LEGACY_READER_REMOVAL_CONDITION =
  '所有技术包内容均已保存 processRouteSchemaVersion=2 和迁移标记，且 CodeGraph/全仓扫描确认没有 V1 内容读取入口后，删除 V1 step/lane 物化分支。'

type RouteEntryBase = {
  id: string
  routeStepNo?: number
  routeLaneNo?: number
}

export type ProcessRouteGraphEntry = RouteEntryBase & {
  stageCode: string
  processCode: string
  routeObjectKey?: string
  linkedBomItemIds?: string[]
  inputObjectType?: TechnicalProcessObjectType
  outputObjectType?: TechnicalProcessObjectType
  consumedBomItemIds?: string[]
  predecessorEntryIds?: string[]
  routeParallelGroupId?: string
  routeParallelGroupName?: string
}

export type ProcessRouteValidationIssueCode =
  | 'DUPLICATE_NODE_ID'
  | 'MISSING_OBJECT_IDENTITY'
  | 'MISSING_REQUIRED_PREDECESSOR'
  | 'MISSING_PREDECESSOR'
  | 'MISSING_TARGET'
  | 'SELF_REFERENCE'
  | 'DUPLICATE_PREDECESSOR'
  | 'BACKWARD_STAGE'
  | 'OBJECT_TYPE_MISMATCH'
  | 'OBJECT_BRANCH_MISMATCH'
  | 'FABRIC_PRINT_OBJECT_INVALID'
  | 'POST_PROCESS_NOT_STATIC_ROUTE'
  | 'CYCLE'

export type ProcessRouteValidationIssue = {
  code: ProcessRouteValidationIssueCode
  message: string
  entryId?: string
  predecessorEntryId?: string
}

export type ProcessRouteSchemaMigrationResult<T extends ProcessRouteGraphEntry> = {
  schemaVersion: number
  migrationMarker: string
  migrationApplied: boolean
  entries: T[]
}

const STAGE_SORT: Record<string, number> = {
  PREP: 1,
  PROD: 2,
  POST: 3,
}

const RAW_MATERIAL_OBJECT_TYPES = new Set<TechnicalProcessObjectType>([
  'BOM_MATERIAL',
  'FABRIC',
  'YARN',
  'ACCESSORY',
  'PACKAGING_MATERIAL',
])

const DYNAMIC_POST_PROCESS_CODES = new Set(['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'])

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

export type ResolvedProcessRouteLane<T extends ProcessRouteGraphEntry> = {
  entries: T[]
  ordered: boolean
}

/**
 * 按显式前置关系读取一条对象分支；尚未形成完整链时保留当前稳定顺序，供页面直接调整。
 */
export function resolveProcessRouteLaneOrder<T extends ProcessRouteGraphEntry>(
  entries: T[],
): ResolvedProcessRouteLane<T> {
  const fallbackEntries = sortProcessRouteEntries(entries)
  if (fallbackEntries.length <= 1) return { entries: fallbackEntries, ordered: true }

  const entryById = new Map(fallbackEntries.map((entry) => [entry.id, entry]))
  const incoming = new Map(fallbackEntries.map((entry) => [entry.id, 0]))
  const outgoing = new Map(fallbackEntries.map((entry) => [entry.id, [] as string[]]))
  let edgeCount = 0

  fallbackEntries.forEach((entry) => {
    ;(entry.predecessorEntryIds ?? []).forEach((predecessorId) => {
      if (!entryById.has(predecessorId)) return
      incoming.set(entry.id, (incoming.get(entry.id) ?? 0) + 1)
      outgoing.get(predecessorId)?.push(entry.id)
      edgeCount += 1
    })
  })

  const roots = fallbackEntries.filter((entry) => (incoming.get(entry.id) ?? 0) === 0)
  const terminals = fallbackEntries.filter((entry) => (outgoing.get(entry.id)?.length ?? 0) === 0)
  const ordered = roots.length === 1
    && terminals.length === 1
    && edgeCount === fallbackEntries.length - 1
    && fallbackEntries.every((entry) => (
      (incoming.get(entry.id) ?? 0) <= 1
      && (outgoing.get(entry.id)?.length ?? 0) <= 1
    ))
  if (!ordered) return { entries: fallbackEntries, ordered: false }

  const result: T[] = []
  const visited = new Set<string>()
  let current: T | undefined = roots[0]
  while (current && !visited.has(current.id)) {
    result.push(current)
    visited.add(current.id)
    current = entryById.get(outgoing.get(current.id)?.[0] ?? '')
  }

  return result.length === fallbackEntries.length
    ? { entries: result, ordered: true }
    : { entries: fallbackEntries, ordered: false }
}

/**
 * 只整理当前已保存的步骤和 lane，不注入任何服装工艺默认顺序。
 * 真实业务前后关系只能来自 predecessorEntryIds，不能由工序名称推断。
 */
export function normalizeProcessRouteEntries<T extends ProcessRouteGraphEntry>(entries: T[]): T[] {
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => compareRouteBase(left.entry, right.entry) || left.index - right.index)

  const groups: Array<Array<{ entry: T; index: number }>> = []
  let previousStepKey: number | string | null = null
  for (const item of sorted) {
    const stepKey = isPositiveStepNo(item.entry.routeStepNo) ? item.entry.routeStepNo : `missing-${item.index}`
    if (stepKey !== previousStepKey) {
      groups.push([])
      previousStepKey = stepKey
    }
    groups[groups.length - 1].push(item)
  }

  return groups.flatMap((group, groupIndex) => {
    const stepNo = groupIndex + 1
    const isParallel = group.length > 1
    const existingGroupId = group.find((item) => item.entry.routeParallelGroupId)?.entry.routeParallelGroupId
    const existingGroupName = group.find((item) => item.entry.routeParallelGroupName)?.entry.routeParallelGroupName
    const groupId = isParallel ? existingGroupId ?? `route-step-${stepNo}` : undefined

    return group.map((item, laneIndex) => ({
      ...item.entry,
      predecessorEntryIds: item.entry.predecessorEntryIds
        ? [...new Set(item.entry.predecessorEntryIds.filter(Boolean))]
        : undefined,
      routeStepNo: stepNo,
      routeLaneNo: laneIndex + 1,
      routeParallelGroupId: groupId,
      routeParallelGroupName: isParallel ? existingGroupName ?? `第 ${stepNo} 步并行组` : undefined,
    } as T))
  })
}

export function areProcessRouteObjectTypesCompatible(
  source: Pick<ProcessRouteGraphEntry, 'processCode' | 'outputObjectType'>,
  target: Pick<ProcessRouteGraphEntry, 'processCode' | 'inputObjectType'>,
): boolean {
  if (!source.outputObjectType || !target.inputObjectType) return true
  if (source.outputObjectType === target.inputObjectType) return true
  if (source.outputObjectType === 'BOM_MATERIAL' && RAW_MATERIAL_OBJECT_TYPES.has(target.inputObjectType)) return true
  if (target.inputObjectType === 'BOM_MATERIAL' && RAW_MATERIAL_OBJECT_TYPES.has(source.outputObjectType)) return true
  if (
    target.processCode === 'SEW'
    && target.inputObjectType === 'CUT_PIECE'
    && source.outputObjectType === 'KNITTED_PANEL'
  ) return true
  return false
}

function extractBomItemId(routeObjectKey: string | undefined): string {
  return routeObjectKey?.startsWith('BOM:') ? routeObjectKey.slice(4) : ''
}

/**
 * 分支相容只判断逻辑对象身份，不判断生产单实际物料 SKU。
 * 这样既阻止“主面料染色 → 花边印花”这类同类型误连，也允许
 * 布料裁剪后按已绑定纸样部位分流，以及裁片/毛织片在车缝处汇合。
 */
export function areProcessRouteObjectBranchesCompatible(
  source: ProcessRouteGraphEntry,
  target: ProcessRouteGraphEntry,
): boolean {
  if (!source.routeObjectKey || !target.routeObjectKey) return true
  if (source.routeObjectKey === target.routeObjectKey) return true

  const sourceBomItemId = extractBomItemId(source.routeObjectKey)
  if (
    sourceBomItemId
    && (target.linkedBomItemIds ?? []).includes(sourceBomItemId)
    && source.outputObjectType === 'CUT_PIECE'
    && target.inputObjectType === 'CUT_PIECE'
  ) return true
  if (sourceBomItemId && (target.consumedBomItemIds ?? []).includes(sourceBomItemId)) return true

  if (
    target.processCode === 'SEW'
    && (source.outputObjectType === 'CUT_PIECE' || source.outputObjectType === 'KNITTED_PANEL')
  ) return true

  if (
    source.outputObjectType === 'GARMENT'
    && target.inputObjectType === 'GARMENT'
    && (source.routeObjectKey.startsWith('GARMENT:') || target.routeObjectKey.startsWith('GARMENT:'))
  ) return true

  return false
}

export function validateProcessRouteGraph<T extends ProcessRouteGraphEntry>(
  entries: T[],
  options: { requireComplete?: boolean } = {},
): ProcessRouteValidationIssue[] {
  const issues: ProcessRouteValidationIssue[] = []
  const entryById = new Map<string, T>()
  entries.forEach((entry) => {
    if (entryById.has(entry.id)) {
      issues.push({ code: 'DUPLICATE_NODE_ID', entryId: entry.id, message: `工艺节点 ID 重复：${entry.id}` })
      return
    }
    entryById.set(entry.id, entry)
  })

  const outgoing = new Map<string, string[]>()
  entries.forEach((entry) => outgoing.set(entry.id, []))
  for (const entry of entries) {
    if (options.requireComplete && (!entry.routeObjectKey || !entry.inputObjectType || !entry.outputObjectType)) {
      issues.push({
        code: 'MISSING_OBJECT_IDENTITY',
        entryId: entry.id,
        message: `工艺节点 ${entry.id} 缺少来源对象、投入类型或产出类型，不能确认路线。`,
      })
    }
    if (
      entry.processCode === 'PRINT'
      && (entry.inputObjectType === 'CUT_PIECE' || entry.inputObjectType === 'GARMENT')
    ) {
      issues.push({
        code: 'FABRIC_PRINT_OBJECT_INVALID',
        entryId: entry.id,
        message: '印花只能作用于 BOM 原物料；裁片或成衣图案加工请使用烫画/直喷。',
      })
    }
    if (DYNAMIC_POST_PROCESS_CODES.has(entry.processCode)) {
      issues.push({
        code: 'POST_PROCESS_NOT_STATIC_ROUTE',
        entryId: entry.id,
        message: '开扣眼、装扣子、烫包由到货 QC 决定，不能写入技术包固定工艺路线。',
      })
    }

    const seenPredecessors = new Set<string>()
    for (const predecessorId of entry.predecessorEntryIds ?? []) {
      if (seenPredecessors.has(predecessorId)) {
        issues.push({
          code: 'DUPLICATE_PREDECESSOR',
          entryId: entry.id,
          predecessorEntryId: predecessorId,
          message: `工艺节点 ${entry.id} 重复引用前置节点 ${predecessorId}`,
        })
        continue
      }
      seenPredecessors.add(predecessorId)
      if (predecessorId === entry.id) {
        issues.push({ code: 'SELF_REFERENCE', entryId: entry.id, predecessorEntryId: predecessorId, message: '工艺节点不能连接自己。' })
        continue
      }
      const predecessor = entryById.get(predecessorId)
      if (!predecessor) {
        issues.push({
          code: 'MISSING_PREDECESSOR',
          entryId: entry.id,
          predecessorEntryId: predecessorId,
          message: `前置工艺节点不存在：${predecessorId}`,
        })
        continue
      }
      outgoing.get(predecessorId)?.push(entry.id)
      if (getStageSort(predecessor.stageCode) > getStageSort(entry.stageCode)) {
        issues.push({
          code: 'BACKWARD_STAGE',
          entryId: entry.id,
          predecessorEntryId: predecessorId,
          message: '工艺路线不能从后续阶段反向连接到前序阶段。',
        })
      }
      if (!areProcessRouteObjectTypesCompatible(predecessor, entry)) {
        issues.push({
          code: 'OBJECT_TYPE_MISMATCH',
          entryId: entry.id,
          predecessorEntryId: predecessorId,
          message: `对象类型不能承接：${predecessor.outputObjectType || '未定义'} → ${entry.inputObjectType || '未定义'}`,
        })
      } else if (!areProcessRouteObjectBranchesCompatible(predecessor, entry)) {
        issues.push({
          code: 'OBJECT_BRANCH_MISMATCH',
          entryId: entry.id,
          predecessorEntryId: predecessorId,
          message: `对象分支不能承接：${predecessor.routeObjectKey || '未定义'} → ${entry.routeObjectKey || '未定义'}`,
        })
      }
    }
  }

  if (options.requireComplete) {
    const entriesByObjectKey = new Map<string, T[]>()
    entries.forEach((entry) => {
      if (!entry.routeObjectKey) return
      entriesByObjectKey.set(entry.routeObjectKey, [...(entriesByObjectKey.get(entry.routeObjectKey) ?? []), entry])
    })
    entriesByObjectKey.forEach((objectEntries) => {
      if (objectEntries.length <= 1) return
      const roots = objectEntries.filter((entry) => (entry.predecessorEntryIds ?? []).length === 0)
      roots.slice(1).forEach((entry) => {
        issues.push({
          code: 'MISSING_REQUIRED_PREDECESSOR',
          entryId: entry.id,
          message: `同一对象分支 ${entry.routeObjectKey} 存在多个未连接的起点，请明确实际先后关系。`,
        })
      })
    })

    entries.forEach((entry) => {
      if ((entry.predecessorEntryIds ?? []).length > 0) return
      const garmentBomRoot = entry.inputObjectType === 'GARMENT' && entry.routeObjectKey?.startsWith('BOM:')
      const requiresUpstream = (
        entry.stageCode === 'PROD'
        && (
          entry.inputObjectType === 'CUT_PIECE'
          || entry.inputObjectType === 'KNITTED_PANEL'
          || (entry.inputObjectType === 'GARMENT' && !garmentBomRoot)
        )
      ) || (
        entry.processCode === 'CUT_PANEL'
        && entries.some((candidate) => candidate.id !== entry.id && candidate.routeObjectKey === entry.routeObjectKey)
      ) || (
        entry.processCode === 'WOOL'
        && (entry.linkedBomItemIds ?? []).some((bomItemId) => entries.some((candidate) => (
          candidate.id !== entry.id
          && candidate.routeObjectKey === `BOM:${bomItemId}`
          && candidate.outputObjectType === 'YARN'
        )))
      )
      if (!requiresUpstream) return
      issues.push({
        code: 'MISSING_REQUIRED_PREDECESSOR',
        entryId: entry.id,
        message: `工艺节点 ${entry.id} 需要明确直接前置工艺后才能确认路线。`,
      })
    })
  }

  const visitState = new Map<string, 0 | 1 | 2>()
  let cycleFound = false
  const visit = (entryId: string): void => {
    if (cycleFound || visitState.get(entryId) === 2) return
    if (visitState.get(entryId) === 1) {
      cycleFound = true
      return
    }
    visitState.set(entryId, 1)
    ;(outgoing.get(entryId) ?? []).forEach(visit)
    visitState.set(entryId, 2)
  }
  entries.forEach((entry) => visit(entry.id))
  if (cycleFound) issues.push({ code: 'CYCLE', message: '工艺路线存在循环，请删除形成回路的连线。' })
  return issues
}

function findLegacyPredecessorIds<T extends ProcessRouteGraphEntry>(entry: T, entries: T[]): string[] {
  const entryStep = getNumberSort(entry.routeStepNo)
  if (!Number.isFinite(entryStep) || entryStep === Number.MAX_SAFE_INTEGER) return []
  const candidates = entries.filter((candidate) => {
    if (candidate.id === entry.id || getNumberSort(candidate.routeStepNo) >= entryStep) return false
    if (!areProcessRouteObjectTypesCompatible(candidate, entry)) return false
    return areProcessRouteObjectBranchesCompatible(candidate, entry)
  })
  if (candidates.length === 0) return []
  const nearestStep = Math.max(...candidates.map((candidate) => getNumberSort(candidate.routeStepNo)))
  return candidates
    .filter((candidate) => getNumberSort(candidate.routeStepNo) === nearestStep)
    .sort((left, right) => getNumberSort(left.routeLaneNo) - getNumberSort(right.routeLaneNo))
    .map((candidate) => candidate.id)
}

/** 将旧 step/lane 路线一次性物化为显式直接前置，之后不再依赖相邻步骤推导。 */
export function materializeLegacyProcessRoutePredecessors<T extends ProcessRouteGraphEntry>(entries: T[]): T[] {
  const normalized = normalizeProcessRouteEntries(entries)
  return normalized.map((entry) => ({
    ...entry,
    predecessorEntryIds: entry.predecessorEntryIds
      ? [...new Set(entry.predecessorEntryIds)]
      : findLegacyPredecessorIds(entry, normalized),
  } as T))
}

/**
 * CLEAN-008 一次迁移入口。V1 只把 step/lane 当路线事实；V2 直接保存 predecessorEntryIds。
 * 当前原型保留 V1 读取仅用于旧技术包落盘迁移，不允许新页面永久按“新值缺失就回退旧值”。
 */
export function migrateProcessRouteSchema<T extends ProcessRouteGraphEntry>(input: {
  schemaVersion?: number
  migrationMarker?: string
  entries: T[]
}): ProcessRouteSchemaMigrationResult<T> {
  const storedVersion = Number.isFinite(Number(input.schemaVersion))
    ? Number(input.schemaVersion)
    : LEGACY_PROCESS_ROUTE_SCHEMA_VERSION
  const migrationApplied = storedVersion < CURRENT_PROCESS_ROUTE_SCHEMA_VERSION
  const normalized = migrationApplied
    ? materializeLegacyProcessRoutePredecessors(input.entries)
    : normalizeProcessRouteEntries(input.entries).map((entry) => ({
        ...entry,
        predecessorEntryIds: [...(entry.predecessorEntryIds ?? [])],
      } as T))
  return {
    schemaVersion: CURRENT_PROCESS_ROUTE_SCHEMA_VERSION,
    migrationMarker: migrationApplied
      ? PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER
      : input.migrationMarker || PROCESS_ROUTE_EXPLICIT_EDGE_MIGRATION_MARKER,
    migrationApplied,
    entries: normalized,
  }
}

/** 根据显式边计算兼容用 step/lane；不会根据工序名称补边。 */
export function projectProcessRouteLayoutFromPredecessors<T extends ProcessRouteGraphEntry>(entries: T[]): T[] {
  const materialized = materializeLegacyProcessRoutePredecessors(entries)
  const issues = validateProcessRouteGraph(materialized)
  const blockingIssue = issues.find((issue) => issue.code === 'CYCLE' || issue.code === 'MISSING_PREDECESSOR' || issue.code === 'SELF_REFERENCE')
  if (blockingIssue) throw new Error(blockingIssue.message)

  const byId = new Map(materialized.map((entry, index) => [entry.id, { entry, index }]))
  const depthMemo = new Map<string, number>()
  const getDepth = (entry: T): number => {
    const memoized = depthMemo.get(entry.id)
    if (memoized) return memoized
    const predecessors = (entry.predecessorEntryIds ?? [])
      .map((id) => byId.get(id)?.entry)
      .filter((item): item is T => Boolean(item))
    const depth = predecessors.length === 0 ? 1 : Math.max(...predecessors.map(getDepth)) + 1
    depthMemo.set(entry.id, depth)
    return depth
  }

  const grouped = new Map<number, T[]>()
  materialized.forEach((entry) => {
    const depth = getDepth(entry)
    grouped.set(depth, [...(grouped.get(depth) ?? []), entry])
  })
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([stepNo, group]) => {
      const stableGroup = group.slice().sort((left, right) => (byId.get(left.id)?.index ?? 0) - (byId.get(right.id)?.index ?? 0))
      const isParallel = stableGroup.length > 1
      return stableGroup.map((entry, laneIndex) => ({
        ...entry,
        routeStepNo: stepNo,
        routeLaneNo: laneIndex + 1,
        routeParallelGroupId: isParallel ? `route-step-${stepNo}` : undefined,
        routeParallelGroupName: isParallel ? `第 ${stepNo} 步并行组` : undefined,
      } as T))
    })
}

export function addProcessRouteEdge<T extends ProcessRouteGraphEntry>(
  entries: T[],
  sourceEntryId: string,
  targetEntryId: string,
): { entries: T[]; issues: ProcessRouteValidationIssue[] } {
  const materialized = materializeLegacyProcessRoutePredecessors(entries)
  const sourceExists = materialized.some((entry) => entry.id === sourceEntryId)
  const targetExists = materialized.some((entry) => entry.id === targetEntryId)
  if (!sourceExists || !targetExists) {
    return {
      entries: materialized,
      issues: [{
        code: targetExists ? 'MISSING_PREDECESSOR' : 'MISSING_TARGET',
        entryId: targetEntryId,
        predecessorEntryId: sourceEntryId,
        message: !sourceExists ? `前置工艺节点不存在：${sourceEntryId}` : `后置工艺节点不存在：${targetEntryId}`,
      }],
    }
  }
  const next = materialized.map((entry) => entry.id === targetEntryId
    ? { ...entry, predecessorEntryIds: [...new Set([...(entry.predecessorEntryIds ?? []), sourceEntryId])] } as T
    : entry)
  const issues = validateProcessRouteGraph(next)
  if (issues.length > 0) return { entries: materialized, issues }
  return { entries: projectProcessRouteLayoutFromPredecessors(next), issues: [] }
}

export function removeProcessRouteEdge<T extends ProcessRouteGraphEntry>(
  entries: T[],
  sourceEntryId: string,
  targetEntryId: string,
): T[] {
  const materialized = materializeLegacyProcessRoutePredecessors(entries)
  const next = materialized.map((entry) => entry.id === targetEntryId
    ? { ...entry, predecessorEntryIds: (entry.predecessorEntryIds ?? []).filter((id) => id !== sourceEntryId) } as T
    : entry)
  return projectProcessRouteLayoutFromPredecessors(next)
}
