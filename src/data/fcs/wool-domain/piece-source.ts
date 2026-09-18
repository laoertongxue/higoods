import type {
  TechnicalPatternPieceInstance,
  TechnicalPatternPieceSpecialCraftAssignment,
  TechnicalProcessEntry,
} from '../../pcs-technical-data-version-types.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackPatternFileSnapshot,
} from '../production-tech-pack-snapshot-types.ts'

export interface WoolPieceScopeSkuLine {
  skuCode: string
  color: string
  size: string
  qty: number
}

export interface WoolPieceRouteNode {
  sourceEntryId: string
  predecessorEntryIds: string[]
  routeObjectKey: string
  processCode: string
  craftCode: string
  craftName: string
  inputObjectType?: TechnicalProcessEntry['inputObjectType']
  outputObjectType?: TechnicalProcessEntry['outputObjectType']
}

export interface WoolExternalPieceSource {
  pieceKey: string
  sourceTechPackVersionId: string
  patternPackageId: string
  patternFileIds: string[]
  pieceInstanceId: string
  sourcePieceId: string
  pieceName: string
  displayName: string
  skuCode: string
  color: string
  size: string
  /** One explicitly maintained physical instance per garment, never a yarn multiplier. */
  pieceCountPerGarment: 1
  plannedQty: number
  assignments: TechnicalPatternPieceSpecialCraftAssignment[]
  routeNodes: WoolPieceRouteNode[]
}

export interface WoolPieceSourceIssue {
  code: string
  message: string
  skuCode?: string
  patternPackageId?: string
  pieceInstanceId?: string
  sourceEntryId?: string
}

export interface WoolPieceSourceResult {
  sourceTechPackVersionId: string
  pieces: WoolExternalPieceSource[]
  /** A SKU with any unresolved issue must not take the no-external-craft automatic path. */
  issues: WoolPieceSourceIssue[]
}

const text = (value: string | undefined) => String(value || '').trim()
const same = (left: string | undefined, right: string | undefined) => text(left).toLocaleLowerCase() === text(right).toLocaleLowerCase()
const packageId = (pattern: TechPackPatternFileSnapshot) => pattern.sourcePatternPackageId || pattern.id
const aliases = (pattern: TechPackPatternFileSnapshot) => [...new Set([pattern.id, pattern.patternFileId, packageId(pattern)].filter(Boolean))]
const isPieceCraft = (entry: TechnicalProcessEntry) => Boolean(entry.craftCode) && (
  entry.routeSourceKind === 'PIECE_CRAFT' || entry.targetObject === 'CUT_PIECE_PART'
  || entry.selectedTargetObject === '已裁部位' || entry.inputObjectType === 'KNITTED_PANEL'
  || entry.inputObjectType === 'CUT_PIECE'
) && entry.targetObject !== 'GARMENT_SEMI' && entry.inputObjectType !== 'GARMENT'

function instanceApplies(instance: TechnicalPatternPieceInstance, sku: WoolPieceScopeSkuLine): boolean {
  return (same(instance.colorName, sku.color) || same(instance.colorId, sku.color))
    && (!text(instance.sizeName) || same(instance.sizeName, sku.size))
}

function rowApplies(pattern: TechPackPatternFileSnapshot, rowId: string, sku: WoolPieceScopeSkuLine): boolean {
  const row = pattern.pieceRows?.find((item) => item.id === rowId)
  if (!row) return false
  if (row.applicableSkuCodes?.length && !row.applicableSkuCodes.includes(sku.skuCode)) return false
  if (row.sizeCode && !same(row.sizeCode, sku.size)) return false
  return !row.colorAllocations?.length || row.colorAllocations.some((allocation) => (
    allocation.skuCodes?.length ? allocation.skuCodes.includes(sku.skuCode)
      : same(allocation.colorCode, sku.color) || same(allocation.colorName, sku.color)
  ))
}

function hasPatternScope(
  snapshot: ProductionOrderTechPackSnapshot,
  pattern: TechPackPatternFileSnapshot,
  sku: WoolPieceScopeSkuLine,
  sourceEntry: TechnicalProcessEntry | undefined,
): boolean {
  const ids = new Set(aliases(pattern))
  if (sourceEntry?.linkedPatternIds?.length) {
    return sourceEntry.linkedPatternIds.some((id) => ids.has(id))
  }
  const scopedBomIds = new Set(sourceEntry?.linkedBomItemIds ?? [])
  return snapshot.colorMaterialMappings.some((mapping) => (
    mapping.mappingOrigin === 'TECH_PACK' && mapping.status !== 'AUTO_DRAFT'
    && (same(mapping.colorCode, sku.color) || same(mapping.colorName, sku.color))
    && mapping.lines.some((line) => {
      if (line.applicableSkuCodes?.length && !line.applicableSkuCodes.includes(sku.skuCode)) return false
      const bom = snapshot.bomItems.find((item) => item.id === line.bomItemId)
      if (!bom || !(bom.usageProcessCodes ?? []).some((code) => code === 'WOOL' || code === 'PROC_WOOL')) return false
      if (bom.applicableSkuCodes?.length && !bom.applicableSkuCodes.includes(sku.skuCode)) return false
      if (scopedBomIds.size && !scopedBomIds.has(bom.id)) return false
      return Boolean(line.patternId && ids.has(line.patternId))
        || (bom.linkedPatternIds ?? []).some((id) => ids.has(id))
        || pattern.linkedBomItemId === bom.id
    })
  ))
}

function resolvePieceRoute(
  snapshot: ProductionOrderTechPackSnapshot,
  patterns: TechPackPatternFileSnapshot[],
  instance: TechnicalPatternPieceInstance,
  issue: (code: string, message: string, sourceEntryId?: string) => void,
): WoolPieceRouteNode[] {
  const ids = new Set(patterns.flatMap(aliases))
  const instanceKeys = new Set([...ids].flatMap((id) => [
    `PATTERN:${id}:PIECE_INSTANCE:${instance.pieceInstanceId}`,
    `PATTERN:${id}:PIECE:${instance.sourcePieceId}:INSTANCE:${instance.pieceInstanceId}`,
  ]))
  const rowKeys = new Set([...ids].map((id) => `PATTERN:${id}:PIECE:${instance.sourcePieceId}`))
  const allPieceEntries = snapshot.processEntries.filter(isPieceCraft)
  const exact = allPieceEntries.filter((entry) => instanceKeys.has(entry.routeObjectKey || ''))
  // A row route is valid only for this instance's maintained craft codes. Explicit
  // instance routes take precedence and are never mixed with an unrelated row route.
  const craftCodes = new Set(instance.specialCraftAssignments.map((assignment) => assignment.craftCode))
  const nodes = (exact.length ? exact : allPieceEntries.filter((entry) => rowKeys.has(entry.routeObjectKey || '')))
    .filter((entry) => craftCodes.has(entry.craftCode || ''))
  const nodeIds = new Set(nodes.map((entry) => entry.id))
  if (nodeIds.size !== nodes.length) issue('DUPLICATE_ROUTE_NODE', '工艺路线存在重复节点 ID，无法确定逐片交接')
  for (const code of craftCodes) {
    if (!nodes.some((entry) => entry.craftCode === code)) issue('CRAFT_ROUTE_MISSING', `逐片工艺 ${code} 没有关联到该片的路线节点`)
  }
  if (exact.some((entry) => !craftCodes.has(entry.craftCode || ''))) {
    issue('CRAFT_ASSIGNMENT_MISSING', '该片路线包含未维护在逐片工艺中的节点')
  }
  const byId = new Map(snapshot.processEntries.map((entry) => [entry.id, entry]))
  for (const node of nodes) {
    if (!Array.isArray(node.predecessorEntryIds)) issue('ROUTE_ORDER_MISSING', `节点 ${node.id} 未维护前置关系`, node.id)
    for (const id of node.predecessorEntryIds ?? []) {
      const previous = byId.get(id)
      if (!previous) issue('PREDECESSOR_MISSING', `节点 ${node.id} 引用了不存在的前置节点 ${id}`, node.id)
      else if (!nodeIds.has(id) && isPieceCraft(previous)) {
        issue('PIECE_PREDECESSOR_MISMATCH', `节点 ${node.id} 的前置工艺 ${id} 不属于该片已明确的路线`, node.id)
      }
    }
  }
  // A physical piece must have one ordered path. No factory or craft-name heuristic.
  const remaining = new Set(nodes.map((entry) => entry.id))
  const ordered: TechnicalProcessEntry[] = []
  while (remaining.size) {
    const next = nodes.filter((entry) => remaining.has(entry.id)
      && !(entry.predecessorEntryIds ?? []).some((id) => remaining.has(id)))
    if (!next.length) {
      issue('ROUTE_CYCLE', '该片工艺路线成环，不能确定先后顺序')
      return []
    }
    if (next.length > 1) {
      issue('AMBIGUOUS_NEXT_NODE', `该片同时存在多个可进入节点：${next.map((entry) => entry.id).join('、')}`)
      return []
    }
    ordered.push(next[0])
    remaining.delete(next[0].id)
  }
  return ordered.map((entry) => ({
    sourceEntryId: entry.id,
    predecessorEntryIds: [...(entry.predecessorEntryIds ?? [])],
    routeObjectKey: entry.routeObjectKey || '',
    processCode: entry.processCode,
    craftCode: entry.craftCode || '',
    craftName: entry.craftName || entry.processName,
    inputObjectType: entry.inputObjectType,
    outputObjectType: entry.outputObjectType,
  }))
}

/** Extract from an already bound production snapshot; never query the latest/default tech pack. */
export function extractWoolPieceSources(input: {
  snapshot: ProductionOrderTechPackSnapshot
  sourceTaskId: string
  scopeSkuLines: WoolPieceScopeSkuLine[]
  sourceEntryId?: string
}): WoolPieceSourceResult {
  const { snapshot } = input
  const result: WoolPieceSourceResult = { sourceTechPackVersionId: snapshot.sourceTechPackVersionId, pieces: [], issues: [] }
  const issue = (value: WoolPieceSourceIssue) => {
    if (!result.issues.some((existing) => JSON.stringify(existing) === JSON.stringify(value))) result.issues.push(value)
  }
  const sourceEntry = snapshot.processEntries.find((entry) => entry.id === input.sourceEntryId)
  if (input.sourceEntryId && !sourceEntry) {
    issue({ code: 'SOURCE_ENTRY_MISSING', sourceEntryId: input.sourceEntryId, message: `绑定版本不存在来源毛织节点 ${input.sourceEntryId}` })
    return result
  }
  if (sourceEntry && sourceEntry.processCode !== 'WOOL' && sourceEntry.processCode !== 'PROC_WOOL') {
    issue({ code: 'INVALID_SOURCE_ENTRY', sourceEntryId: sourceEntry.id, message: `来源节点 ${sourceEntry.id} 不是毛织工序` })
    return result
  }
  if (!input.scopeSkuLines.length) {
    issue({ code: 'SKU_SCOPE_MISSING', message: '毛织任务没有明确 SKU 范围，禁止回退整个生产单' })
    return result
  }
  const seenSku = new Set<string>()
  for (const sku of input.scopeSkuLines) {
    if (!sku.skuCode || !Number.isInteger(sku.qty) || sku.qty <= 0 || seenSku.has(sku.skuCode)) {
      issue({ code: 'INVALID_SKU_SCOPE', skuCode: sku.skuCode, message: `任务 SKU ${sku.skuCode || '未维护'} 的范围重复或数量不是正整数` })
      continue
    }
    seenSku.add(sku.skuCode)
    const grouped = new Map<string, TechPackPatternFileSnapshot[]>()
    for (const pattern of snapshot.patternFiles.filter((item) => item.patternMaterialType === 'WOOL')) {
      if (!hasPatternScope(snapshot, pattern, sku, sourceEntry)
        && !snapshot.patternFiles.some((related) => related.patternMaterialType === 'WOOL'
          && packageId(related) === packageId(pattern) && hasPatternScope(snapshot, related, sku, sourceEntry))) {
        if (!sourceEntry?.linkedPatternIds?.length && !sourceEntry?.linkedBomItemIds?.length
          && (pattern.pieceInstances?.some((instance) => instanceApplies(instance, sku) && instance.specialCraftAssignments.length)
            || pattern.pieceRows?.some((row) => rowApplies(pattern, row.id, sku) && row.specialCrafts?.length))) {
          issue({ code: 'PATTERN_SCOPE_MISSING', skuCode: sku.skuCode, patternPackageId: packageId(pattern),
            message: `毛织纸样 ${pattern.patternFileName} 含当前颜色尺码的工艺片，但没有任务使用关系` })
        }
        continue
      }
      const group = grouped.get(packageId(pattern)) ?? []
      group.push(pattern)
      grouped.set(packageId(pattern), group)
    }
    for (const [patternPackageId, patterns] of grouped) {
      // The package may own the instances while yarn-association rows only reference it.
      const owner = snapshot.patternFiles.find((pattern) => pattern.id === patternPackageId && pattern.recordKind === 'PACKAGE')
      if (owner && !patterns.includes(owner)) patterns.push(owner)
      const instances = new Map<string, TechnicalPatternPieceInstance>()
      const report = (code: string, message: string, pieceInstanceId?: string, sourceEntryId?: string) => issue({
        code, message, skuCode: sku.skuCode, patternPackageId, pieceInstanceId, sourceEntryId,
      })
      for (const pattern of patterns) {
        const unboundRoute = snapshot.processEntries.find((entry) => isPieceCraft(entry)
          && aliases(pattern).some((id) => entry.routeObjectKey === `PATTERN:${id}`
            || entry.routeObjectKey?.startsWith(`PATTERN:${id}:`) || entry.linkedPatternIds?.includes(id))
          && (!pattern.pieceRows?.length || pattern.pieceRows.some((row) => rowApplies(pattern, row.id, sku)))
          && !patterns.some((source) => source.pieceInstances?.some((instance) => instanceApplies(instance, sku))))
        if (unboundRoute) report('PIECE_INSTANCE_MISSING', `毛织纸样已有路线节点 ${unboundRoute.id}，但没有可关联的逐片实例`, undefined, unboundRoute.id)
        for (const instance of pattern.pieceInstances ?? []) {
          if (!instanceApplies(instance, sku)) continue
          if (!instance.sourcePieceId || !patterns.some((source) => source.pieceRows?.some((row) => row.id === instance.sourcePieceId))) {
            if (instance.specialCraftAssignments.length) report('PIECE_ROW_MISSING', '已配置工艺的逐片实例缺少来源片行', instance.pieceInstanceId)
            continue
          }
          if (!patterns.some((source) => rowApplies(source, instance.sourcePieceId, sku))) continue
          const previous = instances.get(instance.pieceInstanceId)
          const signature = (value: TechnicalPatternPieceInstance) => JSON.stringify({
            row: value.sourcePieceId, name: value.pieceName, sequence: value.sequenceNo,
            crafts: value.specialCraftAssignments.map((assignment) => [assignment.craftCode, assignment.craftPosition, assignment.targetObject, assignment.remark]).sort(),
          })
          if (previous && signature(previous) !== signature(instance)) report('CONFLICTING_PIECE', '多纱线关联的同一毛织片存在冲突定义', instance.pieceInstanceId)
          else instances.set(instance.pieceInstanceId, instance)
        }
        for (const row of pattern.pieceRows ?? []) {
          if (!rowApplies(pattern, row.id, sku)) continue
          const scopedInstances = patterns.flatMap((source) => source.pieceInstances ?? []).filter((instance) => instance.sourcePieceId === row.id && instanceApplies(instance, sku))
          const routeHasCraft = snapshot.processEntries.some((entry) => isPieceCraft(entry)
            && aliases(pattern).some((id) => entry.routeObjectKey === `PATTERN:${id}:PIECE:${row.id}`))
          if ((row.specialCrafts?.length || routeHasCraft) && !scopedInstances.some((instance) => instance.specialCraftAssignments.length)) {
            report('PIECE_INSTANCE_MISSING', `毛织片 ${row.name} 已有工艺，但缺少当前 SKU 的逐片工艺实例`)
          }
        }
      }
      for (const instance of instances.values()) {
        if (!instance.specialCraftAssignments.length) continue
        if (!instance.pieceInstanceId || !Number.isInteger(instance.sequenceNo) || instance.sequenceNo <= 0) {
          report('INVALID_PIECE_INSTANCE', '逐片实例缺少唯一标识或有效序号', instance.pieceInstanceId)
          continue
        }
        for (const assignment of instance.specialCraftAssignments) {
          if (!assignment.craftCode || (assignment.targetObject && assignment.targetObject !== 'CUT_PIECE_PART')) {
            report('INVALID_PIECE_CRAFT', '毛织外发片工艺编码缺失或加工对象不是裁片部位', instance.pieceInstanceId)
          }
        }
        result.pieces.push({
          pieceKey: JSON.stringify([snapshot.sourceTechPackVersionId, input.sourceTaskId, patternPackageId, instance.pieceInstanceId, sku.skuCode]),
          sourceTechPackVersionId: snapshot.sourceTechPackVersionId,
          patternPackageId,
          patternFileIds: [...new Set(patterns.flatMap(aliases))],
          pieceInstanceId: instance.pieceInstanceId,
          sourcePieceId: instance.sourcePieceId,
          pieceName: instance.pieceName,
          displayName: instance.displayName,
          skuCode: sku.skuCode, color: sku.color, size: sku.size,
          pieceCountPerGarment: 1, plannedQty: sku.qty,
          assignments: instance.specialCraftAssignments.map((assignment) => ({ ...assignment })),
          routeNodes: resolvePieceRoute(snapshot, patterns, instance,
            (code, message, sourceEntryId) => report(code, message, instance.pieceInstanceId, sourceEntryId)),
        })
      }
    }
  }
  return result
}
