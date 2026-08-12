import type {
  EngineeringBomDraft,
  EngineeringBomMaterialLineDraft,
  EngineeringBomSkuScopeCatalog,
} from './pcs-engineering-bom-types.ts'

function cloneLine(line: EngineeringBomMaterialLineDraft): EngineeringBomMaterialLineDraft {
  return {
    ...line,
    applicableSkuIds: [...(line.applicableSkuIds || [])],
    linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
  }
}

function cloneDraft(draft: EngineeringBomDraft): EngineeringBomDraft {
  return {
    ...draft,
    applicableSkuIds: [...(draft.applicableSkuIds || [])],
    materialLines: draft.materialLines.map(cloneLine),
    customCosts: draft.customCosts.map((item) => ({ ...item })),
    lineDiffs: (draft.lineDiffs || []).map((item) => ({ ...item, changedFields: [...item.changedFields] })),
    customCostDiffs: (draft.customCostDiffs || []).map((item) => ({ ...item, changedFields: [...item.changedFields] })),
  }
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort())
  return JSON.stringify(value)
}

export function compareEngineeringBomDraftLines(
  source: EngineeringBomDraft,
  target: EngineeringBomDraft,
): NonNullable<EngineeringBomDraft['lineDiffs']> {
  const sourceById = new Map(source.materialLines.map((line) => [line.bomItemId || line.materialSkuId, line]))
  const targetById = new Map(target.materialLines.map((line) => [line.bomItemId || line.materialSkuId, line]))
  const ids = new Set([...sourceById.keys(), ...targetById.keys()])
  return [...ids].map((bomItemId) => {
    const before = sourceById.get(bomItemId)
    const after = targetById.get(bomItemId)
    if (!before) return { bomItemId, changeType: 'ADDED' as const, changedFields: Object.keys(after || {}) }
    if (!after) return { bomItemId, changeType: 'REMOVED' as const, changedFields: Object.keys(before) }
    const changedFields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((field) => stableValue(before[field as keyof EngineeringBomMaterialLineDraft])
        !== stableValue(after[field as keyof EngineeringBomMaterialLineDraft]))
    return {
      bomItemId,
      changeType: changedFields.length > 0 ? 'CHANGED' as const : 'UNCHANGED' as const,
      changedFields,
    }
  })
}

export function compareEngineeringBomDraftCustomCosts(
  source: EngineeringBomDraft,
  target: EngineeringBomDraft,
): NonNullable<EngineeringBomDraft['customCostDiffs']> {
  const identity = (item: EngineeringBomDraft['customCosts'][number], index: number) =>
    item.customCostId?.trim() || `CUSTOM-${index + 1}-${item.title.trim()}`
  const sourceById = new Map(source.customCosts.map((item, index) => [identity(item, index), item]))
  const targetById = new Map(target.customCosts.map((item, index) => [identity(item, index), item]))
  const ids = new Set([...sourceById.keys(), ...targetById.keys()])
  return [...ids].map((customCostId) => {
    const before = sourceById.get(customCostId)
    const after = targetById.get(customCostId)
    if (!before) return { customCostId, changeType: 'ADDED' as const, changedFields: Object.keys(after || {}) }
    if (!after) return { customCostId, changeType: 'REMOVED' as const, changedFields: Object.keys(before) }
    const changedFields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((field) => stableValue(before[field as keyof typeof before]) !== stableValue(after[field as keyof typeof after]))
    return {
      customCostId,
      changeType: changedFields.length > 0 ? 'CHANGED' as const : 'UNCHANGED' as const,
      changedFields,
    }
  })
}

export function normalizeEngineeringBomDraftSkuScope(
  draft: EngineeringBomDraft,
  catalog: EngineeringBomSkuScopeCatalog,
): EngineeringBomDraft {
  const styleCode = draft.styleCode?.trim() || ''
  const productColor = draft.productColor?.trim() || ''
  if (!styleCode || styleCode !== catalog.styleCode.trim()) throw new Error('BOM 与价格必须关联有效的目标 SPU。')
  if (!productColor) throw new Error('BOM 与价格必须选择商品颜色。')
  const colorScope = catalog.colors.find((item) => item.productColor.trim() === productColor)
  if (!colorScope) throw new Error(`目标 SPU 不存在商品颜色：${productColor}。`)
  const validSkuIds = [...new Set(colorScope.skuIds.map((item) => item.trim()).filter(Boolean))]
  if (validSkuIds.length === 0) throw new Error(`商品颜色 ${productColor} 暂无有效 SKU，不能维护 BOM。`)
  const requestedSkuIds = (draft.applicableSkuIds || []).map((item) => item.trim()).filter(Boolean)
  if (new Set(requestedSkuIds).size !== requestedSkuIds.length) throw new Error('BOM 适用 SKU 范围存在重复项。')
  const applicableSkuIds = requestedSkuIds.length > 0 ? requestedSkuIds : validSkuIds
  const invalidSkuId = applicableSkuIds.find((item) => !validSkuIds.includes(item))
  if (invalidSkuId) throw new Error(`SKU ${invalidSkuId} 不属于目标 SPU 的商品颜色 ${productColor}。`)
  const normalized = cloneDraft(draft)
  normalized.styleCode = styleCode
  normalized.productColor = productColor
  normalized.applicableSkuIds = [...applicableSkuIds]
  normalized.materialLines = normalized.materialLines.map((line) => {
    const lineColor = line.productColor?.trim() || productColor
    if (lineColor !== productColor) throw new Error('同一 BOM 与价格草稿只能维护一个商品颜色。')
    const lineRequestedSkuIds = (line.applicableSkuIds || []).map((item) => item.trim()).filter(Boolean)
    const lineSkuIds = lineRequestedSkuIds.length > 0 ? lineRequestedSkuIds : applicableSkuIds
    if (new Set(lineSkuIds).size !== lineSkuIds.length) throw new Error('BOM 物料行适用 SKU 范围存在重复项。')
    const outsideDraftScope = lineSkuIds.find((item) => !applicableSkuIds.includes(item))
    if (outsideDraftScope) throw new Error(`BOM 物料行 SKU ${outsideDraftScope} 不属于当前草稿适用范围。`)
    return { ...line, styleCode, productColor, applicableSkuIds: [...lineSkuIds] }
  })
  return normalized
}

export function copyEngineeringBomDraftVersion(input: {
  source: EngineeringBomDraft
  targetVersionId: string
  copiedAt: string
  copiedBy: string
}): EngineeringBomDraft {
  if (!['COMPLETED_CONFIRMED', 'PUBLISHED_SNAPSHOT'].includes(input.source.versionStatus)) {
    throw new Error('只能承接已完成确认或已形成正式技术包的 BOM 与价格方案。')
  }
  if (!input.source.bomDraftVersionId?.trim()) throw new Error('来源 BOM 版本缺少版本号。')
  if (!input.targetVersionId.trim() || !input.copiedAt.trim() || !input.copiedBy.trim()) {
    throw new Error('新 BOM 草稿缺少版本号或复制审计信息。')
  }
  const target: EngineeringBomDraft = {
    ...input.source,
    bomDraftVersionId: input.targetVersionId,
    versionStatus: 'DRAFT',
    sourceVersionId: input.source.bomDraftVersionId,
    copiedAt: input.copiedAt,
    copiedBy: input.copiedBy,
    completedConfirmedAt: '',
    completedConfirmedBy: '',
    applicableSkuIds: [...(input.source.applicableSkuIds || [])],
    materialLines: input.source.materialLines.map(cloneLine),
    customCosts: input.source.customCosts.map((item) => ({ ...item })),
    lineDiffs: [],
    customCostDiffs: [],
  }
  target.lineDiffs = compareEngineeringBomDraftLines(input.source, target)
  target.customCostDiffs = compareEngineeringBomDraftCustomCosts(input.source, target)
  return target
}

export function selectRecommendedEngineeringBomDraft(
  drafts: EngineeringBomDraft[],
): EngineeringBomDraft | null {
  const candidates = drafts
    .filter((draft) => draft.versionStatus === 'COMPLETED_CONFIRMED')
    .filter((draft) => Boolean(draft.bomDraftVersionId?.trim()))
    .sort((left, right) =>
      (right.completedConfirmedAt || right.copiedAt || '')
        .localeCompare(left.completedConfirmedAt || left.copiedAt || ''))
  const selected = candidates[0]
  if (!selected) return null
  return cloneDraft(selected)
}
