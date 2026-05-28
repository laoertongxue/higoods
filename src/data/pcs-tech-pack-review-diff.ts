import {
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalReviewDiffItem,
  TechnicalReviewDiffSnapshot,
  TechnicalReviewDiffStatus,
  TechnicalReviewNodeKey,
} from './pcs-technical-data-version-types.ts'

const REVIEW_DIFF_SCOPE: Record<TechnicalReviewNodeKey, string> = {
  BUYER: '物料清单、核价',
  PATTERN_MAKER: '纸样管理、款色用料对应',
  MERCHANDISER: '剩余部分、整体复核',
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function getRecordTitle(item: Record<string, unknown>, fallback: string): string {
  return String(
    item.name ||
      item.materialName ||
      item.patternName ||
      item.fileName ||
      item.processName ||
      item.craftName ||
      item.part ||
      item.checkItem ||
      item.colorName ||
      item.id ||
      fallback,
  )
}

function normalizeItems(items: unknown[], scope: string): Map<string, { title: string; value: unknown }> {
  const map = new Map<string, { title: string; value: unknown }>()
  items.forEach((item, index) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item }
    const id = String(record.id || record.bomItemId || record.processCode || record.colorCode || `${scope}-${index + 1}`)
    map.set(id, {
      title: getRecordTitle(record, `${scope}${index + 1}`),
      value: item,
    })
  })
  return map
}

function costPayloadItems(content: TechnicalDataVersionContent): unknown[] {
  const payload = content.legacyCompatibleCostPayload || {}
  return Object.entries(payload).flatMap(([key, value]) => {
    if (Array.isArray(value)) return value.map((item) => ({ ...(item as object), costScope: key }))
    return [{ id: key, name: key, value }]
  })
}

function scopeItems(content: TechnicalDataVersionContent, nodeKey: TechnicalReviewNodeKey): Array<{ scope: string; items: unknown[] }> {
  if (nodeKey === 'BUYER') {
    return [
      { scope: '物料清单', items: content.bomItems },
      { scope: '核价', items: costPayloadItems(content) },
    ]
  }
  if (nodeKey === 'PATTERN_MAKER') {
    return [
      { scope: '纸样管理', items: content.patternFiles },
      { scope: '款色用料对应', items: content.colorMaterialMappings },
    ]
  }
  return [
    { scope: '工序工艺', items: content.processEntries },
    { scope: '放码规则', items: content.sizeTable },
    { scope: '花型设计', items: content.patternDesigns },
  ]
}

export function getLatestPublishedTechnicalVersionByStyleId(
  styleId: string,
  excludeVersionId = '',
): TechnicalDataVersionRecord | null {
  return (
    listTechnicalDataVersionsByStyleId(styleId)
      .filter((item) => item.versionStatus === 'PUBLISHED' && item.technicalVersionId !== excludeVersionId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.versionNo - a.versionNo)[0] ?? null
  )
}

function compareScopedItems(input: {
  current: TechnicalDataVersionContent
  baseline: TechnicalDataVersionContent | null
  nodeKey: TechnicalReviewNodeKey
}): TechnicalReviewDiffItem[] {
  const items: TechnicalReviewDiffItem[] = []
  const currentScopes = scopeItems(input.current, input.nodeKey)
  const baselineScopes = input.baseline ? scopeItems(input.baseline, input.nodeKey) : []
  const baselineByScope = new Map(baselineScopes.map((scope) => [scope.scope, scope.items]))

  currentScopes.forEach((scopeBlock) => {
    const currentMap = normalizeItems(scopeBlock.items, scopeBlock.scope)
    const baselineMap = normalizeItems(baselineByScope.get(scopeBlock.scope) || [], scopeBlock.scope)
    const ids = new Set([...currentMap.keys(), ...baselineMap.keys()])

    ids.forEach((id) => {
      const currentItem = currentMap.get(id)
      const baselineItem = baselineMap.get(id)
      if (!baselineItem && currentItem) {
        items.push({
          diffItemId: `${scopeBlock.scope}-${id}-added`,
          scope: scopeBlock.scope,
          title: currentItem.title,
          changeType: '新增',
          beforeText: '-',
          afterText: currentItem.title,
        })
        return
      }
      if (baselineItem && !currentItem) {
        items.push({
          diffItemId: `${scopeBlock.scope}-${id}-removed`,
          scope: scopeBlock.scope,
          title: baselineItem.title,
          changeType: '删除',
          beforeText: baselineItem.title,
          afterText: '-',
        })
        return
      }
      if (baselineItem && currentItem && stableStringify(baselineItem.value) !== stableStringify(currentItem.value)) {
        items.push({
          diffItemId: `${scopeBlock.scope}-${id}-changed`,
          scope: scopeBlock.scope,
          title: currentItem.title,
          changeType: '修改',
          beforeText: baselineItem.title,
          afterText: currentItem.title,
        })
      }
    })
  })
  return items
}

function summarizeDiff(input: {
  nodeKey: TechnicalReviewNodeKey
  baseline: TechnicalDataVersionRecord | null
  items: TechnicalReviewDiffItem[]
}): {
  diffStatus: TechnicalReviewDiffStatus
  summaryText: string
  addedCount: number
  changedCount: number
  removedCount: number
} {
  const addedCount = input.items.filter((item) => item.changeType === '新增').length
  const changedCount = input.items.filter((item) => item.changeType === '修改').length
  const removedCount = input.items.filter((item) => item.changeType === '删除').length
  if (!input.baseline) {
    return {
      diffStatus: '无基线',
      summaryText: `首次正式版本，${REVIEW_DIFF_SCOPE[input.nodeKey]}按全量新增审核。`,
      addedCount,
      changedCount,
      removedCount,
    }
  }
  if (input.items.length === 0) {
    return {
      diffStatus: '无差异',
      summaryText: `与最新已发布版本 ${input.baseline.versionLabel} 无差异。`,
      addedCount,
      changedCount,
      removedCount,
    }
  }
  return {
    diffStatus: '有差异',
    summaryText: `相对最新已发布版本 ${input.baseline.versionLabel}：新增 ${addedCount} 项、修改 ${changedCount} 项、删除 ${removedCount} 项。`,
    addedCount,
    changedCount,
    removedCount,
  }
}

export function buildTechPackReviewDiffSnapshot(
  record: TechnicalDataVersionRecord,
  nodeKey: TechnicalReviewNodeKey,
): TechnicalReviewDiffSnapshot {
  const currentContent = getTechnicalDataVersionContent(record.technicalVersionId)
  const baseline = getLatestPublishedTechnicalVersionByStyleId(record.styleId, record.technicalVersionId)
  const baselineContent = baseline ? getTechnicalDataVersionContent(baseline.technicalVersionId) : null
  const items = currentContent
    ? compareScopedItems({
        current: currentContent,
        baseline: baselineContent,
        nodeKey,
      })
    : []
  const summary = summarizeDiff({ nodeKey, baseline, items })
  return {
    snapshotId: `DIFF-${record.technicalVersionId}-${nodeKey}-${Date.now()}`,
    technicalVersionId: record.technicalVersionId,
    nodeKey,
    baselineVersionId: baseline?.technicalVersionId || '',
    baselineVersionCode: baseline?.technicalVersionCode || '',
    baselineVersionLabel: baseline?.versionLabel || '',
    baselinePublishedAt: baseline?.publishedAt || '',
    diffStatus: summary.diffStatus,
    summaryText: summary.summaryText,
    addedCount: summary.addedCount,
    changedCount: summary.changedCount,
    removedCount: summary.removedCount,
    items,
    builtAt: nowText(),
  }
}
