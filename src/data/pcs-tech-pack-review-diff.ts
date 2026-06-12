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
  PATTERN_MAKER: '纸样池',
  MERCHANDISER: '物料&纸样关联管理、款色用料对应、剩余部分、整体复核',
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

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    : []
}

function normalizePieceRows(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
      return {
        name: normalizeText(record.name || record.partTemplateName || record.sourcePartName),
        count: normalizeNumber(record.count || record.totalPieceQty || record.parsedQuantity),
        applicableSkuCodes: normalizeStringList(record.applicableSkuCodes),
        colorAllocations: Array.isArray(record.colorAllocations)
          ? record.colorAllocations
              .map((allocation) => {
                const allocationRecord = allocation && typeof allocation === 'object' ? (allocation as Record<string, unknown>) : {}
                return {
                  colorName: normalizeText(allocationRecord.colorName),
                  colorCode: normalizeText(allocationRecord.colorCode),
                  pieceCount: normalizeNumber(allocationRecord.pieceCount),
                  skuCodes: normalizeStringList(allocationRecord.skuCodes),
                }
              })
              .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), 'zh-Hans-CN'))
          : [],
      }
    })
    .filter((row) => row.name || row.count > 0)
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), 'zh-Hans-CN'))
}

function normalizeBindingStrips(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        name: normalizeText(record.bindingStripName),
        lengthCm: normalizeNumber(record.lengthCm),
        widthCm: normalizeNumber(record.widthCm),
        cuttingMethod: normalizeText(record.cuttingMethod || '斜切'),
        stripCount: normalizeNumber(record.stripCount),
      }
    })
    .filter((item) => item.name || item.lengthCm > 0 || item.widthCm > 0 || item.stripCount > 0)
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), 'zh-Hans-CN'))
}

function normalizeReviewItem(scope: string, item: unknown): unknown {
  if (!item || typeof item !== 'object') return item
  const record = item as Record<string, unknown>

  if (scope === '物料清单') {
    return {
      type: normalizeText(record.type),
      name: normalizeText(record.name || record.materialName),
      spec: normalizeText(record.spec),
      colorLabel: normalizeText(record.colorLabel),
      unitConsumption: normalizeNumber(record.unitConsumption || record.usage),
      lossRate: normalizeNumber(record.lossRate),
      printRequirement: normalizeText(record.printRequirement || '无'),
      dyeRequirement: normalizeText(record.dyeRequirement || '无'),
      shrinkRequirement: normalizeText(record.shrinkRequirement || '否'),
      washRequirement: normalizeText(record.washRequirement || '否'),
      printSideMode: normalizeText(record.printSideMode),
      applicableSkuCodes: normalizeStringList(record.applicableSkuCodes),
      usageProcessCodes: normalizeStringList(record.usageProcessCodes),
    }
  }

  if (scope === '核价') {
    return {
      costScope: normalizeText(record.costScope),
      bomItemId: normalizeText(record.bomItemId),
      processId: normalizeText(record.processId),
      name: normalizeText(record.name),
      price: normalizeNumber(record.price),
      currency: normalizeText(record.currency || '人民币'),
      unit: normalizeText(record.unit),
      remark: normalizeText(record.remark),
    }
  }

  if (scope === '纸样池') {
    return {
      patternName: normalizeText(record.patternName || record.name),
      patternCategory: normalizeText(record.patternCategory || record.type),
      patternMaterialType: normalizeText(record.patternMaterialType),
      patternFileMode: normalizeText(record.patternFileMode),
      fileName: normalizeText(record.fileName || record.dxfFileName || record.singlePatternFileName),
      dxfFileName: normalizeText(record.dxfFileName),
      rulFileName: normalizeText(record.rulFileName),
      singlePatternFileName: normalizeText(record.singlePatternFileName),
      isWoolted: normalizeText(record.isWoolted),
      selectedSizeCodes: normalizeStringList(record.selectedSizeCodes),
      widthCm: normalizeNumber(record.widthCm),
      markerLengthM: normalizeNumber(record.markerLengthM),
      totalPieceCount: normalizeNumber(record.totalPieceCount || record.patternTotalPieceQty),
      bindingStrips: normalizeBindingStrips(record.bindingStrips),
      pieceRows: normalizePieceRows(record.pieceRows),
    }
  }

  return item
}

function isEmptyGeneratedCostItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const record = item as Record<string, unknown>
  const costScope = normalizeText(record.costScope)
  if (costScope === 'customCostItems') return false
  const price = normalizeNumber(record.price)
  return price === 0 && Boolean(record.bomItemId || record.processId)
}

function normalizeItems(items: unknown[], scope: string): Map<string, { title: string; value: unknown }> {
  const map = new Map<string, { title: string; value: unknown }>()
  items.filter((item) => !isEmptyGeneratedCostItem(item)).forEach((item, index) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item }
    const id = String(record.id || record.bomItemId || record.processCode || record.colorCode || `${scope}-${index + 1}`)
    map.set(id, {
      title: getRecordTitle(record, `${scope}${index + 1}`),
      value: normalizeReviewItem(scope, item),
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
      { scope: '纸样池', items: content.patternFiles.filter((item) => item.recordKind === 'PACKAGE') },
    ]
  }
  return [
    {
      scope: '物料&纸样关联管理',
      items: content.patternFiles.filter((item) => item.recordKind !== 'PACKAGE'),
    },
    { scope: '款色用料对应', items: content.colorMaterialMappings },
    { scope: '工序工艺', items: content.processEntries },
    { scope: '放码规则', items: content.sizeTable },
    { scope: '花型设计', items: content.patternDesigns },
    { scope: '质量规则', items: content.qualityRules },
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
