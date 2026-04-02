import type { ProcessAssignmentGranularity } from './process-craft-dict.ts'
import type { TaskDetailRow } from './task-detail-rows.ts'

interface SkuLineForSplitGrouping {
  skuCode: string
  color: string
  qty: number
}

export interface TaskAllocatableGroup {
  groupKey: string
  taskId: string
  granularity: ProcessAssignmentGranularity
  groupLabel: string
  qty: number
  rowCount: number
  detailRowKeys: string[]
  dimensions: Record<string, string>
  sortKey: string
}

export interface TaskAllocatableGroupAssignment {
  groupKey: string
  factoryId: string
  factoryName: string
}

export interface TaskSplitFactoryBucket {
  factoryId: string
  factoryName: string
  splitSeq: number
  taskNo: string
  detailRowKeys: string[]
  allocatableGroupKeys: string[]
  scopeQty: number
  scopeLabel: string
}

export type TaskSplitDecision =
  | {
      mode: 'SINGLE_FACTORY'
      rootTaskNo: string
      sourceTaskNo: string
      splitGroupId: string
      factoryId: string
      factoryName: string
      detailRowKeys: string[]
      scopeQty: number
      groups: TaskAllocatableGroup[]
    }
  | {
      mode: 'MULTI_FACTORY'
      rootTaskNo: string
      sourceTaskNo: string
      splitGroupId: string
      groups: TaskAllocatableGroup[]
      factories: TaskSplitFactoryBucket[]
    }

interface BuildGroupsInput {
  taskId: string
  assignmentGranularity: ProcessAssignmentGranularity
  detailRows: TaskDetailRow[]
  fallbackQty: number
  fallbackScopeLabel: string
  scopeSkuLines?: SkuLineForSplitGrouping[]
}

interface BuildSplitDecisionInput {
  rootTaskNo: string
  sourceTaskNo: string
  groups: TaskAllocatableGroup[]
  assignments: TaskAllocatableGroupAssignment[]
}

function normalizeToken(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return token || 'na'
}

function makeStableHash(seed: string): string {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0).toString(36).padStart(7, '0')
}

function roundQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 1000) / 1000
}

function toScopeLabelFromGroups(groupLabels: string[]): string {
  if (groupLabels.length <= 1) return groupLabels[0] ?? '拆分执行'
  if (groupLabels.length === 2) return `${groupLabels[0]} 等2组`
  return `${groupLabels[0]} 等${groupLabels.length}组`
}

function buildSkuColorMap(lines: SkuLineForSplitGrouping[] | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of lines ?? []) {
    if (!line.skuCode) continue
    map.set(line.skuCode, line.color)
  }
  return map
}

function createFallbackOrderGroup(input: BuildGroupsInput): TaskAllocatableGroup {
  return {
    groupKey: `GRP-${input.taskId}-ORDER`,
    taskId: input.taskId,
    granularity: input.assignmentGranularity,
    groupLabel: input.fallbackScopeLabel || '整任务',
    qty: roundQty(input.fallbackQty),
    rowCount: input.detailRows.length,
    detailRowKeys: input.detailRows.map((row) => row.rowKey),
    dimensions: {},
    sortKey: 'ORDER::0000',
  }
}

function groupRowsByKey(rows: TaskDetailRow[], resolveKey: (row: TaskDetailRow) => string): Map<string, TaskDetailRow[]> {
  const grouped = new Map<string, TaskDetailRow[]>()
  for (const row of rows) {
    const key = resolveKey(row)
    const current = grouped.get(key) ?? []
    current.push(row)
    grouped.set(key, current)
  }
  return grouped
}

export function listTaskAllocatableGroups(input: BuildGroupsInput): TaskAllocatableGroup[] {
  const rows = [...input.detailRows].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  if (rows.length === 0) return [createFallbackOrderGroup(input)]

  if (input.assignmentGranularity === 'ORDER') {
    return [createFallbackOrderGroup(input)]
  }

  const skuColorMap = buildSkuColorMap(input.scopeSkuLines)

  if (input.assignmentGranularity === 'DETAIL') {
    return rows.map((row) => ({
      groupKey: `GRP-${input.taskId}-DETAIL-${normalizeToken(row.rowKey)}`,
      taskId: input.taskId,
      granularity: 'DETAIL',
      groupLabel: row.rowLabel,
      qty: roundQty(row.qty),
      rowCount: 1,
      detailRowKeys: [row.rowKey],
      dimensions: Object.fromEntries(
        Object.entries(row.dimensions).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
      sortKey: `DETAIL::${row.sortKey}`,
    }))
  }

  if (input.assignmentGranularity === 'SKU') {
    const grouped = groupRowsByKey(rows, (row) => {
      const sku = row.dimensions.GARMENT_SKU
      return sku && sku.trim() ? sku : '未指定SKU'
    })

    return [...grouped.entries()]
      .map(([skuCode, groupedRows]) => {
        const qty = groupedRows.reduce((sum, row) => sum + row.qty, 0)
        const color = skuColorMap.get(skuCode)
        return {
          groupKey: `GRP-${input.taskId}-SKU-${normalizeToken(skuCode)}`,
          taskId: input.taskId,
          granularity: 'SKU',
          groupLabel: color && skuCode !== '未指定SKU' ? `${skuCode} / ${color}` : skuCode,
          qty: roundQty(qty),
          rowCount: groupedRows.length,
          detailRowKeys: groupedRows.map((row) => row.rowKey),
          dimensions: {
            GARMENT_SKU: skuCode,
            ...(color ? { GARMENT_COLOR: color } : {}),
          },
          sortKey: `SKU::${normalizeToken(skuCode)}`,
        } satisfies TaskAllocatableGroup
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }

  const grouped = groupRowsByKey(rows, (row) => {
    const colorFromRow = row.dimensions.GARMENT_COLOR
    if (colorFromRow && colorFromRow.trim()) return colorFromRow
    const skuCode = row.dimensions.GARMENT_SKU
    if (skuCode && skuColorMap.has(skuCode)) return skuColorMap.get(skuCode) ?? '未指定颜色'
    return '未指定颜色'
  })

  return [...grouped.entries()]
    .map(([color, groupedRows]) => {
      const qty = groupedRows.reduce((sum, row) => sum + row.qty, 0)
      return {
        groupKey: `GRP-${input.taskId}-COLOR-${normalizeToken(color)}`,
        taskId: input.taskId,
        granularity: 'COLOR',
        groupLabel: color,
        qty: roundQty(qty),
        rowCount: groupedRows.length,
        detailRowKeys: groupedRows.map((row) => row.rowKey),
        dimensions: {
          GARMENT_COLOR: color,
        },
        sortKey: `COLOR::${normalizeToken(color)}`,
      } satisfies TaskAllocatableGroup
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function validateAllocatableGroupAssignments(groups: TaskAllocatableGroup[], assignments: TaskAllocatableGroupAssignment[]): {
  valid: boolean
  reason?: string
} {
  if (groups.length === 0) return { valid: false, reason: '当前任务没有可分配单元' }
  if (assignments.length === 0) return { valid: false, reason: '请先为分配单元选择工厂' }

  const assignmentByGroupKey = new Map(assignments.map((item) => [item.groupKey, item]))
  for (const group of groups) {
    const assignment = assignmentByGroupKey.get(group.groupKey)
    if (!assignment || !assignment.factoryId || !assignment.factoryName) {
      return { valid: false, reason: `分配单元「${group.groupLabel}」尚未选择工厂` }
    }
  }

  return { valid: true }
}

export function resolveTaskSplitDecision(input: BuildSplitDecisionInput): TaskSplitDecision {
  const assignmentByGroupKey = new Map(input.assignments.map((item) => [item.groupKey, item]))
  const normalizedAssignments = input.groups
    .map((group) => {
      const assignment = assignmentByGroupKey.get(group.groupKey)
      if (!assignment) return null
      return { group, assignment }
    })
    .filter((item): item is { group: TaskAllocatableGroup; assignment: TaskAllocatableGroupAssignment } => Boolean(item))

  if (normalizedAssignments.length === 0) {
    return {
      mode: 'SINGLE_FACTORY',
      rootTaskNo: input.rootTaskNo,
      sourceTaskNo: input.sourceTaskNo,
      splitGroupId: `SG-${input.rootTaskNo}-${makeStableHash(input.sourceTaskNo)}`,
      factoryId: '',
      factoryName: '',
      detailRowKeys: [],
      scopeQty: 0,
      groups: input.groups,
    }
  }

  const uniqueFactories = uniqueStable(
    normalizedAssignments.map((item) => `${item.assignment.factoryId}::${item.assignment.factoryName}`),
  )
  const assignmentSeed = normalizedAssignments
    .map((item) => `${item.group.groupKey}=>${item.assignment.factoryId}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|')
  const splitGroupId = `SG-${input.rootTaskNo}-${makeStableHash(`${input.sourceTaskNo}|${assignmentSeed}`)}`

  if (uniqueFactories.length === 1) {
    const [factoryKey] = uniqueFactories
    const [factoryId, factoryName] = factoryKey.split('::')
    const detailRowKeys = uniqueStable(
      normalizedAssignments.flatMap((item) => item.group.detailRowKeys),
    )
    const scopeQty = roundQty(normalizedAssignments.reduce((sum, item) => sum + item.group.qty, 0))
    return {
      mode: 'SINGLE_FACTORY',
      rootTaskNo: input.rootTaskNo,
      sourceTaskNo: input.sourceTaskNo,
      splitGroupId,
      factoryId,
      factoryName,
      detailRowKeys,
      scopeQty,
      groups: input.groups,
    }
  }

  const groupedByFactory = new Map<string, { factoryId: string; factoryName: string; groups: TaskAllocatableGroup[] }>()
  for (const item of normalizedAssignments) {
    const key = `${item.assignment.factoryId}::${item.assignment.factoryName}`
    const current = groupedByFactory.get(key) ?? {
      factoryId: item.assignment.factoryId,
      factoryName: item.assignment.factoryName,
      groups: [],
    }
    current.groups.push(item.group)
    groupedByFactory.set(key, current)
  }

  const factories = [...groupedByFactory.values()]
    .sort((a, b) => a.factoryId.localeCompare(b.factoryId) || a.factoryName.localeCompare(b.factoryName))
    .map((item, index) => {
      const splitSeq = index + 1
      const groupLabels = item.groups
        .slice()
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map((group) => group.groupLabel)
      return {
        factoryId: item.factoryId,
        factoryName: item.factoryName,
        splitSeq,
        taskNo: `${input.rootTaskNo}-${String(splitSeq).padStart(2, '0')}`,
        detailRowKeys: uniqueStable(item.groups.flatMap((group) => group.detailRowKeys)),
        allocatableGroupKeys: item.groups.map((group) => group.groupKey),
        scopeQty: roundQty(item.groups.reduce((sum, group) => sum + group.qty, 0)),
        scopeLabel: toScopeLabelFromGroups(groupLabels),
      } satisfies TaskSplitFactoryBucket
    })

  return {
    mode: 'MULTI_FACTORY',
    rootTaskNo: input.rootTaskNo,
    sourceTaskNo: input.sourceTaskNo,
    splitGroupId,
    groups: input.groups,
    factories,
  }
}

function uniqueStable(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}
