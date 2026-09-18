import { extractWoolPieceSources, type WoolPieceSourceResult } from './piece-source.ts'
import { WOOL_DISPATCH_DEMO_ORDER_IDS } from '../process-tasks.ts'
import { getProductionOrderTechPackSnapshot } from '../production-order-tech-pack-runtime.ts'
import { productionOrders } from '../production-orders.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks } from '../runtime-process-tasks.ts'
import { commitWoolStore, readWoolStore, getWoolStoreRevision, type WoolDomainStore } from './store.ts'
import type {
  WoolOutputPlanLine,
  WoolWorkOrder,
  WoolWorkOrderKind,
} from './types.ts'

export interface WoolSourceSkuLineInput {
  skuCode: string
  colorCode: string
  colorName: string
  sizeCode: string
  plannedQty: number
}

export interface WoolSourceBomItemInput {
  id: string
  materialCode?: string
  usageProcessCodes?: string[]
  applicableSkuCodes?: string[]
}

export interface WoolSourceColorMappingLineInput {
  id: string
  bomItemId?: string
  materialCode?: string
  applicableSkuCodes?: string[]
}

export interface WoolSourceColorMappingInput {
  id: string
  mappingOrigin: 'TECH_PACK' | 'DEMAND_FALLBACK'
  status: 'AUTO_CONFIRMED' | 'AUTO_DRAFT' | 'CONFIRMED' | 'MANUAL_ADJUSTED'
  colorCode: string
  lines: WoolSourceColorMappingLineInput[]
}

export interface WoolSourcePartInput {
  woolPartCode: string
  woolPartName: string
  pieceCountPerGarment: number
  applicableSkuCodes?: string[]
}

export interface WoolOrderSourceBuildInput {
  taskId: string
  productionOrderId: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  skuLines: WoolSourceSkuLineInput[]
  bomItems: WoolSourceBomItemInput[]
  colorMaterialMappings: WoolSourceColorMappingInput[]
  woolParts: WoolSourcePartInput[]
}

export interface WoolOrderSourceSnapshot {
  taskId: string
  productionOrderId: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  outputPlanLines: WoolOutputPlanLine[]
  generationIssues: string[]
  generationIssuesBySku: Record<string, string[]>
}

function uniqueStable(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function assertSourceText(value: string, fieldName: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`毛织来源生成失败：${fieldName}不能为空`)
  return normalized
}

export function buildStableWoolPartCode(sourceCode: string): string {
  const normalized = assertSourceText(sourceCode, '毛织部位编码')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new Error('毛织来源生成失败：毛织部位编码没有可用字符')
  return normalized
}

export function buildWoolPanelOutputSku(woolPartCode: string, garmentSkuCode: string): string {
  return `WP-${buildStableWoolPartCode(woolPartCode)}-${assertSourceText(garmentSkuCode, '成衣 SKU')}`
}

function isWoolBomItem(item: WoolSourceBomItemInput): boolean {
  return (item.usageProcessCodes ?? []).some((code) => code === 'WOOL' || code === 'PROC_WOOL')
}

function resolveMappedBomItem(
  line: WoolSourceColorMappingLineInput,
  bomItems: WoolSourceBomItemInput[],
): WoolSourceBomItemInput | null {
  if (line.bomItemId) {
    return bomItems.find((item) => item.id === line.bomItemId) ?? null
  }
  if (!line.materialCode) return null
  const matches = bomItems.filter((item) => item.materialCode === line.materialCode)
  return matches.length === 1 ? matches[0] : null
}

function resolveSourceForSku(
  input: WoolOrderSourceBuildInput,
  sku: WoolSourceSkuLineInput,
): Pick<WoolOutputPlanLine, 'requiredYarnSkus' | 'sourceColorMappingIds' | 'sourceBomItemIds'> {
  const mappings = input.colorMaterialMappings.filter((mapping) =>
    mapping.mappingOrigin === 'TECH_PACK'
    && mapping.status !== 'AUTO_DRAFT'
    && mapping.colorCode === sku.colorCode,
  )
  const acceptedBomItems: WoolSourceBomItemInput[] = []

  for (const mapping of mappings) {
    for (const line of mapping.lines) {
      const applicableSkuCodes = line.applicableSkuCodes ?? []
      if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(sku.skuCode)) continue
      const bomItem = resolveMappedBomItem(line, input.bomItems)
      const materialCode = bomItem?.materialCode?.trim() ?? ''
      if (!bomItem || !isWoolBomItem(bomItem) || !materialCode) continue
      const bomApplicableSkuCodes = bomItem.applicableSkuCodes ?? []
      if (bomApplicableSkuCodes.length > 0 && !bomApplicableSkuCodes.includes(sku.skuCode)) continue
      acceptedBomItems.push({ ...bomItem, materialCode })
    }
  }

  const requiredYarnSkus = uniqueStable(acceptedBomItems.map((item) => item.materialCode ?? ''))
  return {
    requiredYarnSkus,
    sourceColorMappingIds: uniqueStable(mappings.map((mapping) => mapping.id)),
    sourceBomItemIds: uniqueStable(acceptedBomItems.map((item) => item.id)),
  }
}

function buildBaseOutputLine(
  input: WoolOrderSourceBuildInput,
  sku: WoolSourceSkuLineInput,
): Omit<WoolOutputPlanLine, 'outputSkuCode' | 'outputObjectType' | 'plannedQty' | 'qtyUnit'> {
  return {
    garmentSkuCode: assertSourceText(sku.skuCode, '成衣 SKU'),
    colorCode: assertSourceText(sku.colorCode, '颜色编码'),
    colorName: assertSourceText(sku.colorName, '颜色名称'),
    sizeCode: assertSourceText(sku.sizeCode, '尺码编码'),
    ...resolveSourceForSku(input, sku),
    sourceTechPackVersionId: assertSourceText(input.sourceTechPackVersionId, '技术包版本 ID'),
    sourceTechPackVersionCode: assertSourceText(input.sourceTechPackVersionCode, '技术包版本编码'),
  }
}

function validatePlannedQty(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`毛织来源生成失败：${fieldName}必须为大于 0 的数字`)
  }
  return value
}

export function buildWoolOrderSourceSnapshot(input: WoolOrderSourceBuildInput): WoolOrderSourceSnapshot {
  if (input.skuLines.length === 0) throw new Error('毛织来源生成失败：生产单没有可生成计划行的 SKU')
  // 未维护的片统称不外发片；两阶段均按成衣 SKU 对应件数计划。
  const outputPlanLines: WoolOutputPlanLine[] = input.skuLines.map(sku => ({
    ...buildBaseOutputLine(input, sku), outputSkuCode: sku.skuCode,
    outputObjectType: input.kind === 'WHOLE_GARMENT' ? 'GARMENT' : 'WOOL_PANEL',
    plannedQty: validatePlannedQty(sku.plannedQty, `SKU ${sku.skuCode} 的计划数量`), qtyUnit: '件',
  }))

  const generationIssuesBySku: Record<string, string[]> = {}
  for (const line of outputPlanLines) {
    let issue = ''
    if (line.sourceColorMappingIds.length === 0) {
      issue = `${line.outputSkuCode} 缺少技术包颜色物料关系，不可填报加工数量`
    } else if (line.sourceBomItemIds.length === 0) {
      issue = `${line.outputSkuCode} 的技术包颜色物料关系没有关联有效的 PROC_WOOL 纱线 BOM`
    } else if (line.requiredYarnSkus.length === 0) {
      issue = `${line.outputSkuCode} 没有可冻结的毛织必需纱线，不可填报加工数量`
    }
    if (issue) generationIssuesBySku[line.outputSkuCode] = [issue]
  }

  return {
    taskId: assertSourceText(input.taskId, '任务 ID'),
    productionOrderId: assertSourceText(input.productionOrderId, '生产单 ID'),
    productionOrderNo: assertSourceText(input.productionOrderNo, '生产单编号'),
    kind: input.kind,
    sourceTechPackVersionId: input.sourceTechPackVersionId,
    sourceTechPackVersionCode: input.sourceTechPackVersionCode,
    outputPlanLines,
    generationIssues: [], generationIssuesBySku,
  }
}

export function buildWoolOrderSourceSnapshotFromRuntimeTask(taskId: string): WoolOrderSourceSnapshot {
  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`毛织来源生成失败：找不到运行时任务 ${taskId}`)
  if (task.processBusinessCode !== 'WOOL' && task.processCode !== 'WOOL') {
    throw new Error(`毛织来源生成失败：任务 ${taskId} 不是毛织任务`)
  }

  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  if (!order) throw new Error(`毛织来源生成失败：任务 ${taskId} 未关联有效生产单`)
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!snapshot) throw new Error(`毛织来源生成失败：生产单 ${order.productionOrderNo} 没有冻结技术包快照`)

  if (task.isSplitResult && task.scopeSkuLines.length === 0) {
    throw new Error(`毛织来源生成失败：拆分任务 ${taskId} 没有明确 SKU 范围，禁止回退整张生产单`)
  }
  const runtimeSkuLines = task.scopeSkuLines.length > 0
    ? task.scopeSkuLines
    : order.demandSnapshot.skuLines
  const skuLines = runtimeSkuLines.map((line) => ({
    skuCode: line.skuCode,
    colorCode: line.color,
    colorName: line.color,
    sizeCode: line.size,
    plannedQty: line.qty,
  }))
  const kind = task.woolTaskType === 'PART_PANEL' ? 'PART_PANEL' : 'WHOLE_GARMENT'
  return buildWoolOrderSourceSnapshot({
    taskId: task.taskId,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    kind,
    sourceTechPackVersionId: snapshot.sourceTechPackVersionId,
    sourceTechPackVersionCode: snapshot.sourceTechPackVersionCode,
    skuLines,
    bomItems: snapshot.bomItems.map((item) => ({
      id: item.id,
      materialCode: item.materialCode,
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    })),
    colorMaterialMappings: snapshot.colorMaterialMappings.map((mapping) => ({
      id: mapping.id,
      mappingOrigin: mapping.mappingOrigin,
      status: mapping.status,
      colorCode: mapping.colorCode,
      lines: mapping.lines.map((line) => ({
        id: line.id,
        bomItemId: line.bomItemId,
        materialCode: line.materialCode,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    woolParts: [],
  })
}

function resolveExistingRuntimeWoolOrder(
  workOrders: WoolDomainStore['workOrders'],
  taskId: string,
): WoolWorkOrder | undefined {
  const matches = Object.values(workOrders).filter(order => order.sourceTaskId === taskId && order.stage === 'KNITTING')
  if (matches.length > 1) throw new Error(`横机加工单生成失败：任务 ${taskId} 存在重复阶段`)
  return matches[0]
}

/** Keep an identifiable route problem local; missing instances still block that SKU's automatic path. */
export function scopeWoolPieceGenerationIssues(extraction: WoolPieceSourceResult): {
  unscoped: string[]; bySku: Record<string, string[]>; byPiece: Record<string, string[]>
} {
  const unscoped: string[] = [], bySku: Record<string, string[]> = {}, byPiece: Record<string, string[]> = {}
  for (const issue of extraction.issues) {
    const piece = issue.pieceInstanceId && extraction.pieces.find(piece => piece.pieceInstanceId === issue.pieceInstanceId
      && piece.patternPackageId === issue.patternPackageId && piece.skuCode === issue.skuCode)
    if (piece) (byPiece[piece.pieceKey] ??= []).push(`${piece.displayName}：${issue.message}`)
    else if (issue.skuCode) (bySku[issue.skuCode] ??= []).push(`${issue.skuCode}：${issue.message}`)
    else unscoped.push(issue.message)
  }
  return { unscoped, bySku, byPiece }
}

let runtimeOrderCommitConflictForTest: WoolWorkOrder | null = null

export function setWoolRuntimeOrderCommitConflictForTest(order: WoolWorkOrder | null): void {
  runtimeOrderCommitConflictForTest = order ? structuredClone(order) : null
}

export function buildWoolOrderFromRuntimeTask(taskId: string): WoolWorkOrder {
  const existing = resolveExistingRuntimeWoolOrder(readWoolStore().workOrders, taskId)
  if (existing) return existing

  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`毛织加工单生成失败：找不到运行时任务 ${taskId}`)
  const productionOrder = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  if (!productionOrder) throw new Error(`毛织加工单生成失败：任务 ${taskId} 未关联有效生产单`)
  const techPackSnapshot = getProductionOrderTechPackSnapshot(productionOrder.productionOrderId)
  if (!techPackSnapshot) {
    throw new Error(`毛织加工单生成失败：生产单 ${productionOrder.productionOrderNo} 没有冻结技术包快照`)
  }
  const plannedCompletionAt = task.taskDeadline?.trim()
    || productionOrder.demandSnapshot.requiredDeliveryDate?.trim()
    || ''
  if (!plannedCompletionAt) {
    throw new Error('毛织加工单缺少计划完成时间')
  }
  const source = buildWoolOrderSourceSnapshotFromRuntimeTask(taskId)
  const extraction = extractWoolPieceSources({ snapshot: techPackSnapshot, sourceTaskId: taskId,
    scopeSkuLines: source.outputPlanLines.map(line => ({skuCode: line.garmentSkuCode, color: line.colorName, size: line.sizeCode, qty: line.plannedQty})),
    sourceEntryId: task.sourceEntryId })
  const issueScope = scopeWoolPieceGenerationIssues(extraction)
  const pairId = `WOOL-STAGE:${taskId}`
  const runtimeTasks = listRuntimeProcessTasks()
  const externalPieces = extraction.pieces.map(piece => {
    const issues = [...(issueScope.byPiece[piece.pieceKey] ?? [])]
    const routeNodes = piece.routeNodes.map(node => {
      const candidates = runtimeTasks.filter(candidate => candidate.productionOrderId === task.productionOrderId
        && (candidate.sourceEntryId === node.sourceEntryId || candidate.sourceEntryIds?.includes(node.sourceEntryId))
        && candidate.status !== 'CANCELLED' && !candidate.isSplitSource
        && (!candidate.scopeSkuLines.length || candidate.scopeSkuLines.some(line => line.skuCode === piece.skuCode)))
      const factories = [...new Set(candidates.map(item => item.assignedFactoryId).filter(Boolean))]
      const assigned = factories.length === 1 ? candidates.find(item => item.assignedFactoryId === factories[0]) : undefined
      if (!assigned) issues.push(`${piece.displayName}：${node.craftName}未确定唯一承接工厂`)
      return { sourceEntryId: node.sourceEntryId, predecessorEntryIds: node.predecessorEntryIds,
        craftCode: node.craftCode, craftName: node.craftName, factoryId: assigned?.assignedFactoryId || '',
        factoryName: assigned?.assignedFactoryName || '', taskOrderId: `WSC:${pairId}:${piece.pieceKey}:${node.sourceEntryId}` }
    })
    return { pieceKey: piece.pieceKey, patternPackageId: piece.patternPackageId, pieceInstanceId: piece.pieceInstanceId,
      pieceName: piece.displayName, skuCode: piece.skuCode, pieceCountPerGarment: piece.pieceCountPerGarment, routeNodes, issues }
  })
  const generatedAt = task.createdAt || task.updatedAt || '2026-07-31 00:00:00'
  const downstreamTarget = source.kind === 'PART_PANEL'
    ? {
        receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' as const,
        receiverId: task.receiverId || 'WH-CUTTING-WAIT-HANDOVER',
        receiverName: task.receiverName || '裁床待交出仓',
      }
    : {
        receiverType: 'DOWNSTREAM_FACTORY' as const,
        receiverId: task.receiverId || '',
        receiverName: task.receiverName || '',
      }
  const order: WoolWorkOrder = {
    stage: 'KNITTING', pairId, sourceTaskId: task.taskId, sourceEntryId: task.sourceEntryId,
    pairedWorkOrderId: `${pairId}:LINKING`, externalPieces,
    generationIssues: [...source.generationIssues, ...issueScope.unscoped],
    generationIssuesBySku: Object.fromEntries([...new Set([...Object.keys(source.generationIssuesBySku), ...Object.keys(issueScope.bySku)])].map(sku =>
      [sku, [...(source.generationIssuesBySku[sku] ?? []), ...(issueScope.bySku[sku] ?? [])]])),
    woolOrderId: `${pairId}:KNITTING`,
    woolOrderNo: `HJ-${task.taskNo || task.taskId}`,
    taskId: `${task.taskId}:KNITTING`,
    taskNo: task.taskNo || task.taskId,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleNo: techPackSnapshot.styleCode || productionOrder.demandSnapshot.spuCode,
    styleName: techPackSnapshot.styleName || productionOrder.demandSnapshot.spuName,
    styleImageUrl: [
      ...techPackSnapshot.imageSnapshot.styleImages,
      ...techPackSnapshot.imageSnapshot.productImages,
      ...techPackSnapshot.imageSnapshot.sampleImages,
      ...techPackSnapshot.imageSnapshot.artworkImages,
      ...techPackSnapshot.imageSnapshot.patternImages,
    ].find(Boolean) || undefined,
    internalStyleCode: techPackSnapshot.internalStyleCode || undefined,
    factoryId: task.assignedFactoryId || '',
    factoryName: task.assignedFactoryName || '',
    plannedStartAt: task.dispatchedAt || task.businessAssignedAt || undefined,
    plannedCompletionAt,
    kind: source.kind,
    outputPlanLines: source.outputPlanLines,
    downstreamTarget,
    sourceTechPackVersionId: source.sourceTechPackVersionId,
    sourceTechPackVersionCode: source.sourceTechPackVersionCode,
    createdAt: generatedAt,
    createdBy: '生产任务生成',
    updatedAt: generatedAt,
    updatedBy: '生产任务生成',
  }
  let committedOrder: WoolWorkOrder | undefined
  const committedStore = commitWoolStore((draft) => {
    const conflictForTest = runtimeOrderCommitConflictForTest
    runtimeOrderCommitConflictForTest = null
    if (conflictForTest) {
      draft.workOrders[conflictForTest.woolOrderId] = structuredClone(conflictForTest)
    }
    const generatedFromSameTask = resolveExistingRuntimeWoolOrder(draft.workOrders, taskId)
    if (generatedFromSameTask) {
      committedOrder = generatedFromSameTask
      return
    }
    const linking: WoolWorkOrder = { ...structuredClone(order), stage: 'LINKING',
      woolOrderId: order.pairedWorkOrderId, woolOrderNo: `FP-${task.taskNo || task.taskId}`,
      taskId: `${task.taskId}:LINKING`, pairedWorkOrderId: order.woolOrderId }
    draft.workOrders[order.woolOrderId] = order
    draft.workOrders[linking.woolOrderId] = linking
    committedOrder = order
  })
  return committedOrder
    ?? resolveExistingRuntimeWoolOrder(committedStore.workOrders, taskId)
    ?? order
}

// 正式新需求复用原加工单生成命令；已有加工单及其现场事实不重建。
let syncingRuntimeWoolOrders = false
let lastSynchronizationKey = ''
export function ensureRuntimeWoolWorkOrders(productionOrderId?: string): void {
  if (syncingRuntimeWoolOrders) return
  const tasks = listRuntimeProcessTasks().filter(task =>
    (!productionOrderId || task.productionOrderId === productionOrderId)
    && (task.processBusinessCode === 'WOOL' || task.processCode === 'WOOL'))
  const sourceKey = `${productionOrderId || '*'}:${tasks.map(task => [task.taskId, task.status, task.executionEnabled, task.isSplitSource, productionOrders.find(order => order.productionOrderId === task.productionOrderId)?.taskBreakdownSummary.isBrokenDown].join(':')).join('|')}`
  if (lastSynchronizationKey === `${getWoolStoreRevision()}:${sourceKey}`) return
  syncingRuntimeWoolOrders = true
  try {
    const store = readWoolStore()
    const existingTaskIds = new Set(Object.values(store.workOrders).map(order => order.sourceTaskId))
    for (const task of tasks) {
      if (productionOrderId && task.productionOrderId !== productionOrderId) continue
      if (task.processBusinessCode !== 'WOOL' && task.processCode !== 'WOOL') continue
      if (WOOL_DISPATCH_DEMO_ORDER_IDS.has(task.productionOrderId) || existingTaskIds.has(task.taskId)) continue
      const productionOrder = productionOrders.find(order => order.productionOrderId === task.productionOrderId)
      if (!productionOrder?.taskBreakdownSummary.isBrokenDown || task.executionEnabled === false || task.isSplitSource || task.status === 'CANCELLED') continue
      buildWoolOrderFromRuntimeTask(task.taskId)
      existingTaskIds.add(task.taskId)
    }
    lastSynchronizationKey = `${getWoolStoreRevision()}:${sourceKey}`
  } finally {
    syncingRuntimeWoolOrders = false
  }
}
