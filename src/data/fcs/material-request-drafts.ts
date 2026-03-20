import { productionOrders, type ProductionOrder } from './production-orders'
import { processTasks, type ProcessTask } from './process-tasks'
import { getTechPackBySpuCode, type TechPackBomItem } from './tech-packs'
import {
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from './runtime-process-tasks'

export type MaterialTaskType = 'PRINT' | 'DYE' | 'CUT' | 'SEW' | 'POST'
export type MaterialDraftStatus = 'pending' | 'created' | 'not_applicable'
export type MaterialMode = 'warehouse_delivery' | 'factory_pickup'
export type MaterialLineSourceType = 'bom' | 'upstream_output'
export type MaterialRequestProgressStatus = '待配料' | '待配送' | '待自提' | '已完成'

export interface MaterialRequestDraftLine {
  lineId: string
  selected: boolean
  sourceType: MaterialLineSourceType
  sourceTypeLabel: 'BOM物料' | '上道产出'
  materialCode: string
  materialName: string
  materialSpec: string
  materialCategory: '面料' | '辅料' | '裁片'
  suggestedQty: number
  confirmedQty: number
  unit: string
  sourceRef: string
  note: string
  sourceBomItemId?: string
  sourceBomItemCode?: string
  sourceBomItemName?: string
  sourceSkuCodes?: string[]
  sourceSkuLabels?: string[]
  linkedPatternIds?: string[]
  linkedPatternNames?: string[]
  patternSpecText?: string
  patternTotalPieceCount?: number
  pieceSummaryText?: string
  sourceRuleLabel?: string
  sourceReasonText?: string
  sourcePatternId?: string
  sourcePieceId?: string
  sourceMappingId?: string
  sourceMappingLineId?: string
}

export interface MaterialRequestDraft {
  draftId: string
  productionOrderId: string
  productionOrderNo: string
  spuCode: string
  spuName: string
  taskId: string
  taskNo: string
  taskName: string
  taskType: MaterialTaskType
  draftStatus: MaterialDraftStatus
  needMaterial: boolean
  materialMode: MaterialMode
  materialModeLabel: '仓库配送到厂' | '工厂到仓自提'
  remark: string
  createdMaterialRequestNo: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  lines: MaterialRequestDraftLine[]
}

export interface MaterialRequestRecord {
  materialRequestId: string
  materialRequestNo: string
  productionOrderNo: string
  taskId: string
  taskName: string
  taskType: MaterialTaskType
  materialMode: MaterialMode
  materialModeLabel: '仓库配送到厂' | '工厂到仓自提'
  lineCount: number
  materialSummary: string
  requestStatus: MaterialRequestProgressStatus
  updatedAt: string
  createdBy: string
}

export interface MaterialRequestTaskBinding {
  taskId: string
  hasMaterialRequest: boolean
  materialRequestNo: string
  materialMode: MaterialMode
  materialModeLabel: '仓库配送到厂' | '工厂到仓自提'
  materialRequestStatus: MaterialRequestProgressStatus
  updatedAt: string
}

export interface MaterialDraftOrderSummary {
  productionOrderId: string
  totalDraftCount: number
  totalTaskCount: number
  totalMaterialCount: number
  pendingCount: number
  createdCount: number
  notApplicableCount: number
  requestCount: number
  status: 'not_involved' | 'pending' | 'partial_created' | 'created'
}

export interface MaterialDraftOrderIndicators {
  productionOrderId: string
  hasMaterialDraft: boolean
  hasConfirmedMaterialRequest: boolean
  materialDraftSummaryStatus: 'none' | 'pending' | 'partial_confirmed' | 'confirmed'
  materialDraftCount: number
  materialDraftPendingCount: number
  materialDraftConfirmedCount: number
  materialDraftNotApplicableCount: number
  materialDraftHintText: string
}

export interface MaterialDraftOperationLog {
  id: string
  productionOrderId: string
  taskId?: string
  action: string
  detail: string
  at: string
  by: string
}

interface DraftMaterialCandidate {
  optionKey: string
  sourceType: MaterialLineSourceType
  sourceTypeLabel: 'BOM物料' | '上道产出'
  materialCode: string
  materialName: string
  materialSpec: string
  materialCategory: '面料' | '辅料' | '裁片'
  suggestedQty: number
  unit: string
  sourceRef: string
  note: string
  sourceBomItemId?: string
  sourceBomItemCode?: string
  sourceBomItemName?: string
  sourceSkuCodes?: string[]
  sourceSkuLabels?: string[]
  linkedPatternIds?: string[]
  linkedPatternNames?: string[]
  patternSpecText?: string
  patternTotalPieceCount?: number
  pieceSummaryText?: string
  sourceRuleLabel?: string
  sourceReasonText?: string
  sourcePatternId?: string
  sourcePieceId?: string
  sourceMappingId?: string
  sourceMappingLineId?: string
  requiresPrint: boolean
  requiresDye: boolean
}

const MATERIAL_MODE_LABEL: Record<MaterialMode, '仓库配送到厂' | '工厂到仓自提'> = {
  warehouse_delivery: '仓库配送到厂',
  factory_pickup: '工厂到仓自提',
}

const TASK_TYPE_LABEL: Record<MaterialTaskType, string> = {
  PRINT: '印花',
  DYE: '染色',
  CUT: '裁片',
  SEW: '车缝',
  POST: '后道',
}

const SOURCE_TYPE_LABEL: Record<MaterialLineSourceType, 'BOM物料' | '上道产出'> = {
  bom: 'BOM物料',
  upstream_output: '上道产出',
}

const CATEGORY_UNIT: Record<'面料' | '辅料' | '裁片', string> = {
  面料: '米',
  辅料: '个',
  裁片: '片',
}

function toTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

let materialDraftLogSeq = 1

function createMaterialDraftLogId(): string {
  const id = `MRL-202603-${String(materialDraftLogSeq).padStart(5, '0')}`
  materialDraftLogSeq += 1
  return id
}

function normalizeQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.max(1, Math.round(value * 100) / 100)
}

type SkuScopeLine = {
  skuCode: string
  color: string
  size?: string
  qty: number
}

function resolveBaseTaskId(taskId: string): string {
  const markerIndex = taskId.indexOf('__')
  return markerIndex >= 0 ? taskId.slice(0, markerIndex) : taskId
}

function getOrderSkuScope(order: ProductionOrder): SkuScopeLine[] {
  return order.demandSnapshot.skuLines.map((line) => ({
    skuCode: line.skuCode,
    color: line.color || '未识别颜色',
    size: line.size,
    qty: Number.isFinite(line.qty) ? line.qty : 0,
  }))
}

function toSkuScopeLines(lines: Array<{ skuCode: string; color: string; size: string; qty: number }>): SkuScopeLine[] {
  return lines.map((line) => ({
    skuCode: line.skuCode,
    color: line.color || '未识别颜色',
    size: line.size,
    qty: Number.isFinite(line.qty) ? line.qty : 0,
  }))
}

function getRuntimeTaskForDraft(task?: ProcessTask, draftTaskId?: string): RuntimeProcessTask | null {
  if (draftTaskId) {
    const direct = getRuntimeTaskById(draftTaskId)
    if (direct) return direct
  }

  if (!task) return null
  const runtimeTasks = listRuntimeTasksByBaseTaskId(task.taskId)
  if (runtimeTasks.length === 1) return runtimeTasks[0]

  return null
}

function getTaskSkuScope(
  order: ProductionOrder,
  task?: ProcessTask,
  runtimeTask?: RuntimeProcessTask | null,
): SkuScopeLine[] {
  if (runtimeTask) {
    if (runtimeTask.scopeType === 'SKU') {
      return toSkuScopeLines(runtimeTask.scopeSkuLines)
    }

    if (runtimeTask.scopeType === 'COLOR') {
      return toSkuScopeLines(runtimeTask.scopeSkuLines)
    }

    return toSkuScopeLines(runtimeTask.scopeSkuLines)
  }

  if (task) {
    const runtimeTasks = listRuntimeTasksByBaseTaskId(task.taskId)
    if (runtimeTasks.length === 1) {
      return toSkuScopeLines(runtimeTasks[0].scopeSkuLines)
    }
  }

  return getOrderSkuScope(order)
}

function formatPatternSpecText(widthCm?: number, markerLengthM?: number): string | undefined {
  const widthPart = Number.isFinite(widthCm) && Number(widthCm) > 0 ? `${Number(widthCm)}cm` : ''
  const markerPart = Number.isFinite(markerLengthM) && Number(markerLengthM) > 0 ? `${Number(markerLengthM)}m` : ''
  if (widthPart && markerPart) return `${widthPart} × ${markerPart}`
  if (widthPart) return widthPart
  if (markerPart) return markerPart
  return undefined
}

function buildPatternEvidence(
  bomItem: TechPackBomItem,
  patternFiles: Array<{
    id: string
    fileName: string
    linkedBomItemId?: string
    widthCm?: number
    markerLengthM?: number
    totalPieceCount?: number
    pieceRows?: Array<{ name: string; count: number; note?: string }>
  }>,
): {
  patternIds: string[]
  patternNames: string[]
  patternSpecText?: string
  patternTotalPieceCount?: number
  pieceSummaryText?: string
} {
  const fromBom = bomItem.linkedPatternIds ?? []
  const fromPattern = patternFiles
    .filter((pattern) => pattern.linkedBomItemId === bomItem.id)
    .map((pattern) => pattern.id)
  const patternIds = Array.from(new Set([...fromBom, ...fromPattern]))
  const linkedPatterns = patternFiles.filter((pattern) => patternIds.includes(pattern.id))

  const patternNames = linkedPatterns.map((pattern) => pattern.fileName.replace(/\.[^/.]+$/, ''))
  const specTexts = linkedPatterns
    .map((pattern) => formatPatternSpecText(pattern.widthCm, pattern.markerLengthM))
    .filter((text): text is string => Boolean(text))
  const uniqueSpecTexts = Array.from(new Set(specTexts))
  const patternSpecText = uniqueSpecTexts.length > 0 ? uniqueSpecTexts.join('；') : undefined

  let patternTotalPieceCount = 0
  const pieceBlocks: string[] = []
  linkedPatterns.forEach((pattern, index) => {
    const fallbackName = pattern.fileName.replace(/\.[^/.]+$/, '') || `纸样${index + 1}`
    const rows = (pattern.pieceRows ?? []).filter((row) => row.name.trim().length > 0)
    const rowCount = rows.reduce((sum, row) => sum + (Number.isFinite(row.count) ? row.count : 0), 0)
    const totalCount =
      Number.isFinite(pattern.totalPieceCount) && Number(pattern.totalPieceCount) > 0
        ? Number(pattern.totalPieceCount)
        : rowCount
    patternTotalPieceCount += totalCount

    if (rows.length > 0) {
      const rowSummary = rows.map((row) => `${row.name}${row.count}`).join('、')
      pieceBlocks.push(`${fallbackName}：${rowSummary}`)
    }
  })

  return {
    patternIds,
    patternNames,
    patternSpecText,
    patternTotalPieceCount: patternTotalPieceCount > 0 ? normalizeQty(patternTotalPieceCount) : undefined,
    pieceSummaryText: pieceBlocks.length > 0 ? pieceBlocks.join('；') : undefined,
  }
}

function inferMaterialCategory(item: TechPackBomItem): '面料' | '辅料' {
  const haystack = `${item.type} ${item.name}`
  if (haystack.includes('辅料') || haystack.includes('纽扣') || haystack.includes('拉链') || haystack.includes('线')) {
    return '辅料'
  }
  return '面料'
}

function inferMaterialUnit(item: TechPackBomItem, category: '面料' | '辅料'): string {
  const haystack = `${item.type} ${item.name} ${item.spec}`
  if (category === '面料') return '米'
  if (haystack.includes('线')) return '卷'
  if (haystack.includes('纽扣')) return '颗'
  if (haystack.includes('拉链')) return '条'
  if (haystack.includes('标签')) return '张'
  return '个'
}

function resolveTaskType(task: Pick<ProcessTask, 'processNameZh' | 'processCode'>): MaterialTaskType | null {
  const processName = task.processNameZh
  const processCode = task.processCode

  if (processName.includes('印花') || processCode === 'PROC_PRINT') return 'PRINT'
  if (processName.includes('染色') || processName.includes('染印') || processCode === 'PROC_DYE' || processCode === 'PROC_DYE_PRINT') {
    return 'DYE'
  }
  if (processName.includes('裁片') || processCode === 'PROC_CUT') return 'CUT'
  if (processName.includes('车缝') || processName.includes('缝纫') || processCode === 'PROC_SEW') return 'SEW'
  if (
    processName.includes('后道') ||
    processName.includes('整烫') ||
    processName.includes('包装') ||
    processName.includes('终检') ||
    processCode === 'PROC_IRON' ||
    processCode === 'PROC_PACK' ||
    processCode === 'PROC_FINISH' ||
    processCode === 'PROC_FINISHING' ||
    processCode === 'PROC_QC' ||
    processCode === 'PROC_FINAL_QC'
  ) {
    return 'POST'
  }

  return null
}

function getOrderProcessFlags(orderId: string): { hasPrintTask: boolean; hasDyeTask: boolean } {
  const tasks = processTasks.filter((task) => task.productionOrderId === orderId)
  const hasPrintTask = tasks.some((task) => {
    const taskType = resolveTaskType(task)
    return taskType === 'PRINT'
  })
  const hasDyeTask = tasks.some((task) => {
    const taskType = resolveTaskType(task)
    return taskType === 'DYE'
  })

  return { hasPrintTask, hasDyeTask }
}

function buildBomCandidates(
  order: ProductionOrder,
  task?: ProcessTask,
  runtimeTask?: RuntimeProcessTask | null,
): DraftMaterialCandidate[] {
  const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
  const taskSkuScope = getTaskSkuScope(order, task, runtimeTask)
  const processFlags = getOrderProcessFlags(order.productionOrderId)
  const targetProcessCode = runtimeTask?.processCode ?? task?.processCode

  if (!techPack || techPack.bomItems.length === 0) {
    return []
  }

  return techPack.bomItems
    .map((item) => {
      if (targetProcessCode) {
        const usageProcessCodes = item.usageProcessCodes ?? []
        if (usageProcessCodes.length > 0 && !usageProcessCodes.includes(targetProcessCode)) {
          return null
        }
      }

      const applicableSkuCodes = item.applicableSkuCodes ?? []
      const matchedSkuScope =
        applicableSkuCodes.length > 0
          ? taskSkuScope.filter((sku) => applicableSkuCodes.includes(sku.skuCode))
          : taskSkuScope

      if (matchedSkuScope.length === 0) return null

      const scopedQty = matchedSkuScope.reduce((sum, sku) => sum + sku.qty, 0)
      if (!Number.isFinite(scopedQty) || scopedQty <= 0) return null

      const sourceSkuCodes = matchedSkuScope.map((sku) => sku.skuCode)
      const sourceSkuLabels = matchedSkuScope.map((sku) => `${sku.color}（${sku.skuCode}）`)
      const skuScopeLabel =
        applicableSkuCodes.length > 0 ? sourceSkuLabels.join('、') : '全部 SKU'

      const patternEvidence = buildPatternEvidence(item, techPack.patternFiles)
      const patternHint =
        patternEvidence.patternNames.length > 0
          ? `对应纸样：${patternEvidence.patternNames.join('、')}`
          : '当前 BOM 行未关联纸样'
      const pieceHint = patternEvidence.pieceSummaryText
        ? `裁片明细：${patternEvidence.pieceSummaryText}`
        : '暂无裁片明细'

      const category = inferMaterialCategory(item)
      const keyword = `${item.name} ${item.spec}`.toLowerCase()

      const requiresPrintKeyword = /印花|图案|转印|logo/.test(keyword)
      const requiresDyeKeyword = /染|色号|色牢度|色彩/.test(keyword)

      // 规则可读：有印花/染色任务时，面料默认进入对应建议范围。
      const requiresPrint = requiresPrintKeyword || (category === '面料' && processFlags.hasPrintTask)
      const requiresDye = requiresDyeKeyword || (category === '面料' && processFlags.hasDyeTask)

      const suggestedQty = normalizeQty(
        scopedQty * item.unitConsumption * (1 + item.lossRate / 100),
      )

      return {
        optionKey: `bom:${item.id}:${sourceSkuCodes.join('|') || 'ALL'}`,
        sourceType: 'bom',
        sourceTypeLabel: SOURCE_TYPE_LABEL.bom,
        materialCode: `BOM-${order.demandSnapshot.spuCode}-${item.id}`,
        materialName: item.name,
        materialSpec: item.spec,
        materialCategory: category,
        suggestedQty,
        unit: inferMaterialUnit(item, category),
        sourceRef: `${item.id}:${sourceSkuCodes.join('|') || 'ALL'}`,
        note: `来源技术包BOM：${item.type}`,
        sourceBomItemId: item.id,
        sourceBomItemCode: `BOM-${order.demandSnapshot.spuCode}-${item.id}`,
        sourceBomItemName: item.name,
        sourceSkuCodes,
        sourceSkuLabels,
        linkedPatternIds: patternEvidence.patternIds,
        linkedPatternNames: patternEvidence.patternNames,
        patternSpecText: patternEvidence.patternSpecText,
        patternTotalPieceCount: patternEvidence.patternTotalPieceCount,
        pieceSummaryText: patternEvidence.pieceSummaryText,
        sourceRuleLabel: '技术包SKU维度BOM自动建议',
        sourceReasonText: `来源 SKU：${skuScopeLabel}；${patternHint}；${pieceHint}`,
        requiresPrint,
        requiresDye,
      }
    })
    .filter((item): item is DraftMaterialCandidate => Boolean(item))
}

function normalizeColorToken(value: string): string {
  return value.trim().toLowerCase()
}

function buildSewUpstreamCandidates(
  order: ProductionOrder,
  task?: ProcessTask,
  runtimeTask?: RuntimeProcessTask | null,
): DraftMaterialCandidate[] {
  const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
  if (!techPack) return []

  const mappings = techPack.colorMaterialMappings ?? []
  if (mappings.length === 0) return []

  const skuScope = getTaskSkuScope(order, task, runtimeTask).filter((sku) => sku.qty > 0)
  if (skuScope.length === 0) return []

  const mappingByColor = new Map<string, typeof mappings[number]>()
  const bomById = new Map(techPack.bomItems.map((item) => [item.id, item]))
  mappings.forEach((mapping) => {
    mappingByColor.set(normalizeColorToken(mapping.colorName), mapping)
    mappingByColor.set(normalizeColorToken(mapping.colorCode), mapping)
  })

  const candidates: DraftMaterialCandidate[] = []
  skuScope.forEach((sku) => {
    const mapping = mappingByColor.get(normalizeColorToken(sku.color))
    if (!mapping) return

    const candidateLines = mapping.lines.filter((line) => {
      if (!line.pieceName || !Number.isFinite(line.pieceCountPerUnit) || Number(line.pieceCountPerUnit) <= 0) {
        return false
      }
      if (!line.applicableSkuCodes || line.applicableSkuCodes.length === 0) return true
      return line.applicableSkuCodes.includes(sku.skuCode)
    })

    candidateLines.forEach((line, index) => {
      const pieceCountPerUnit = Number(line.pieceCountPerUnit) || 0
      if (pieceCountPerUnit <= 0) return
      const suggestedQty = normalizeQty(sku.qty * pieceCountPerUnit)
      const sourceRuleLabel =
        mapping.status === 'AUTO_DRAFT' ? '款色映射草稿自动建议（待确认）' : '款色映射确认后自动建议'

      candidates.push({
        optionKey: `upstream:sew:${mapping.id}:${sku.skuCode}:${line.id}:${index}`,
        sourceType: 'upstream_output',
        sourceTypeLabel: SOURCE_TYPE_LABEL.upstream_output,
        materialCode: line.materialCode || `CP-${sku.skuCode}-${line.pieceId || line.id}`,
        materialName: `${line.pieceName}裁片`,
        materialSpec: line.patternName ? `纸样：${line.patternName}` : `颜色：${mapping.colorName}`,
        materialCategory: '裁片',
        suggestedQty,
        unit: line.unit || CATEGORY_UNIT.裁片,
        sourceRef: `${mapping.id}:${line.id}:${sku.skuCode}`,
        note: `来自款色映射 ${mapping.colorName}`,
        sourceBomItemId: line.bomItemId || undefined,
        sourceBomItemCode:
          line.bomItemId && bomById.get(line.bomItemId)
            ? `BOM-${order.demandSnapshot.spuCode}-${line.bomItemId}`
            : undefined,
        sourceBomItemName: line.bomItemId ? bomById.get(line.bomItemId)?.name : undefined,
        sourceSkuCodes: [sku.skuCode],
        sourceSkuLabels: [`${sku.color}（${sku.skuCode}）`],
        linkedPatternIds: line.patternId ? [line.patternId] : undefined,
        linkedPatternNames: line.patternName ? [line.patternName] : undefined,
        patternSpecText: line.patternName ? `${line.patternName}` : undefined,
        patternTotalPieceCount: pieceCountPerUnit,
        pieceSummaryText: `${line.pieceName}${pieceCountPerUnit}`,
        sourceRuleLabel,
        sourceReasonText: `颜色 ${mapping.colorName} / SKU ${sku.skuCode}：${line.pieceName} × ${pieceCountPerUnit}（每件）`,
        sourcePatternId: line.patternId || undefined,
        sourcePieceId: line.pieceId || undefined,
        sourceMappingId: mapping.id,
        sourceMappingLineId: line.id,
        requiresPrint: false,
        requiresDye: false,
      })
    })
  })

  return candidates
}

function buildPostUpstreamCandidates(
  order: ProductionOrder,
  task?: ProcessTask,
  runtimeTask?: RuntimeProcessTask | null,
): DraftMaterialCandidate[] {
  if (runtimeTask?.transitionFromPrev === 'SAME_FACTORY_CONTINUE') {
    return []
  }

  const skuScope = getTaskSkuScope(order, task, runtimeTask).filter((sku) => sku.qty > 0)
  if (skuScope.length === 0) return []

  return skuScope.map((sku, index) => ({
    optionKey: `upstream:post:${runtimeTask?.taskId ?? task?.taskId ?? 'unknown'}:${sku.skuCode}:${index}`,
    sourceType: 'upstream_output',
    sourceTypeLabel: SOURCE_TYPE_LABEL.upstream_output,
    materialCode: `${order.productionOrderId}-SF-${String(index + 1).padStart(2, '0')}-${sku.skuCode}`,
    materialName: '上道半成品',
    materialSpec: `来自上一步工序（${sku.color}/${sku.skuCode}）`,
    materialCategory: '裁片',
    suggestedQty: normalizeQty(sku.qty),
    unit: '件',
    sourceRef: runtimeTask?.baseDependsOnTaskIds.join(',') || task?.dependsOnTaskIds?.join(',') || '',
    note: '后道承接上一步半成品',
    sourceSkuCodes: [sku.skuCode],
    sourceSkuLabels: [`${sku.color}（${sku.skuCode}）`],
    sourceRuleLabel: '后道承接上一步半成品',
    sourceReasonText: `SKU ${sku.skuCode}（${sku.color}）需承接上一步半成品`,
    requiresPrint: false,
    requiresDye: false,
  }))
}

function buildDraftCandidates(
  order: ProductionOrder,
  taskType: MaterialTaskType,
  task?: ProcessTask,
  runtimeTask?: RuntimeProcessTask | null,
): DraftMaterialCandidate[] {
  const bomCandidates = buildBomCandidates(order, task, runtimeTask)

  if (taskType === 'PRINT') {
    return bomCandidates.filter((item) => item.requiresPrint)
  }

  if (taskType === 'DYE') {
    return bomCandidates.filter((item) => item.requiresDye)
  }

  if (taskType === 'CUT') {
    return bomCandidates.filter((item) => item.materialCategory === '面料')
  }

  if (taskType === 'SEW') {
    const sewUpstream = buildSewUpstreamCandidates(order, task, runtimeTask)
    const accessoryBom = bomCandidates.filter((item) => item.materialCategory === '辅料')
    return [...sewUpstream, ...accessoryBom]
  }

  if (taskType === 'POST') {
    const postUpstream = buildPostUpstreamCandidates(order, task, runtimeTask)
    const postBom = bomCandidates.filter((item) => item.materialCategory === '辅料')
    return [...postUpstream, ...postBom]
  }

  return bomCandidates
}

function toDraftLines(draftId: string, candidates: DraftMaterialCandidate[]): MaterialRequestDraftLine[] {
  return candidates.map((candidate, index) => {
    const suggestedQty = normalizeQty(candidate.suggestedQty)

    return {
      lineId: `${draftId}-L${String(index + 1).padStart(2, '0')}`,
      selected: true,
      sourceType: candidate.sourceType,
      sourceTypeLabel: candidate.sourceTypeLabel,
      materialCode: candidate.materialCode,
      materialName: candidate.materialName,
      materialSpec: candidate.materialSpec,
      materialCategory: candidate.materialCategory,
      suggestedQty,
      confirmedQty: suggestedQty,
      unit: candidate.unit,
      sourceRef: candidate.sourceRef,
      note: candidate.sourceReasonText || candidate.note,
      sourceBomItemId: candidate.sourceBomItemId,
      sourceBomItemCode: candidate.sourceBomItemCode,
      sourceBomItemName: candidate.sourceBomItemName,
      sourceSkuCodes: candidate.sourceSkuCodes ? [...candidate.sourceSkuCodes] : undefined,
      sourceSkuLabels: candidate.sourceSkuLabels ? [...candidate.sourceSkuLabels] : undefined,
      linkedPatternIds: candidate.linkedPatternIds ? [...candidate.linkedPatternIds] : undefined,
      linkedPatternNames: candidate.linkedPatternNames ? [...candidate.linkedPatternNames] : undefined,
      patternSpecText: candidate.patternSpecText,
      patternTotalPieceCount: candidate.patternTotalPieceCount,
      pieceSummaryText: candidate.pieceSummaryText,
      sourceRuleLabel: candidate.sourceRuleLabel,
      sourceReasonText: candidate.sourceReasonText,
      sourcePatternId: candidate.sourcePatternId,
      sourcePieceId: candidate.sourcePieceId,
      sourceMappingId: candidate.sourceMappingId,
      sourceMappingLineId: candidate.sourceMappingLineId,
    }
  })
}

function buildDraftId(orderId: string, taskId: string): string {
  const normalizedTask = taskId.replace(/[^A-Za-z0-9]/g, '')
  return `MRD-${orderId.replace(/[^0-9]/g, '')}-${normalizedTask}`
}

function cloneDraftLine(line: MaterialRequestDraftLine): MaterialRequestDraftLine {
  return { ...line }
}

function cloneDraft(draft: MaterialRequestDraft): MaterialRequestDraft {
  return {
    ...draft,
    lines: draft.lines.map(cloneDraftLine),
  }
}

function cloneRequest(record: MaterialRequestRecord): MaterialRequestRecord {
  return { ...record }
}

function createRequestNo(sequence: number): string {
  return `LLXQ202603${String(sequence).padStart(4, '0')}`
}

function getDefaultRequestStatus(mode: MaterialMode): MaterialRequestProgressStatus {
  return mode === 'warehouse_delivery' ? '待配料' : '待自提'
}

function summarizeMaterials(lines: MaterialRequestDraftLine[]): string {
  if (lines.length === 0) return '无物料'
  const names = lines.map((line) => `${line.materialName}${line.confirmedQty}${line.unit}`)
  if (names.length <= 2) return names.join('，')
  return `${names.slice(0, 2).join('，')}等${names.length}项`
}

function applyTaskBinding(request: MaterialRequestRecord): void {
  const binding: MaterialRequestTaskBinding = {
    taskId: request.taskId,
    hasMaterialRequest: true,
    materialRequestNo: request.materialRequestNo,
    materialMode: request.materialMode,
    materialModeLabel: request.materialModeLabel,
    materialRequestStatus: request.requestStatus,
    updatedAt: request.updatedAt,
  }

  taskBindings.set(request.taskId, binding)
  const baseTaskId = resolveBaseTaskId(request.taskId)
  if (baseTaskId !== request.taskId) {
    taskBindings.set(baseTaskId, { ...binding, taskId: baseTaskId })
  }

  const task = processTasks.find((item) => item.taskId === baseTaskId)
  if (!task) return

  task.hasMaterialRequest = true
  task.materialRequestNo = request.materialRequestNo
  task.materialMode = request.materialMode
  task.materialModeLabel = request.materialModeLabel
  task.materialRequestStatus = request.requestStatus
}

function buildInitialDrafts(): MaterialRequestDraft[] {
  const list: MaterialRequestDraft[] = []
  const runtimeTasks = listRuntimeProcessTasks()
    .slice()
    .sort((a, b) => {
      if (a.productionOrderId !== b.productionOrderId) return a.productionOrderId.localeCompare(b.productionOrderId)
      if (a.seq !== b.seq) return a.seq - b.seq
      return a.taskId.localeCompare(b.taskId)
    })

  for (const runtimeTask of runtimeTasks) {
    const order = productionOrders.find((item) => item.productionOrderId === runtimeTask.productionOrderId)
    if (!order) continue
    const baseTask = processTasks.find((task) => task.taskId === runtimeTask.baseTaskId)
    if (!baseTask) continue

    const taskType = resolveTaskType(runtimeTask)
    if (!taskType) continue

    const draftId = buildDraftId(order.productionOrderId, runtimeTask.taskId)
    const candidates = buildDraftCandidates(order, taskType, baseTask, runtimeTask)

    list.push({
      draftId,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderId,
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      taskId: runtimeTask.taskId,
      taskNo: runtimeTask.taskId,
      taskName: `${runtimeTask.processNameZh}（${runtimeTask.scopeLabel}）`,
      taskType,
      draftStatus: 'pending',
      needMaterial: true,
      materialMode: 'warehouse_delivery',
      materialModeLabel: MATERIAL_MODE_LABEL.warehouse_delivery,
      remark: `系统按${TASK_TYPE_LABEL[taskType]}任务自动建议`,
      createdMaterialRequestNo: '',
      createdBy: '',
      createdAt: '',
      updatedBy: '系统',
      updatedAt: order.createdAt,
      lines: toDraftLines(draftId, candidates),
    })
  }

  return list
}

function markDraftNotApplicable(taskId: string, operatorName = '跟单员', operateAt: string = toTimestamp()): void {
  const baseTaskId = resolveBaseTaskId(taskId)
  const draft =
    materialRequestDrafts.find((item) => item.taskId === taskId) ??
    materialRequestDrafts.find((item) => resolveBaseTaskId(item.taskId) === baseTaskId)
  if (!draft) return

  draft.needMaterial = false
  draft.draftStatus = 'not_applicable'
  draft.remark = '跟单员确认当前任务不需要领料'
  draft.lines = draft.lines.map((line) => ({ ...line, selected: false, confirmedQty: 0 }))
  touchDraft(draft, operatorName, operateAt)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `跟单员将任务「${draft.taskName}」标记为无需领料`,
    at: operateAt,
    by: operatorName,
  })
}

function seedCreatedDraft(taskId: string, mode: MaterialMode, createdAt: string, createdBy: string, requestStatus?: MaterialRequestProgressStatus): void {
  const baseTaskId = resolveBaseTaskId(taskId)
  const draft =
    materialRequestDrafts.find((item) => item.taskId === taskId) ??
    materialRequestDrafts.find((item) => resolveBaseTaskId(item.taskId) === baseTaskId)
  if (!draft) return

  draft.needMaterial = true
  draft.materialMode = mode
  draft.materialModeLabel = MATERIAL_MODE_LABEL[mode]
  draft.draftStatus = 'created'
  draft.createdBy = createdBy
  draft.createdAt = createdAt
  touchDraft(draft, createdBy, createdAt)

  const selectedLines = draft.lines.filter((line) => line.selected && line.confirmedQty > 0)
  if (selectedLines.length === 0 && draft.lines.length > 0) {
    draft.lines[0].selected = true
    draft.lines[0].confirmedQty = normalizeQty(draft.lines[0].suggestedQty)
  }

  const materialRequestNo = createRequestNo(materialRequestSequence)
  materialRequestSequence += 1
  draft.createdMaterialRequestNo = materialRequestNo
  draft.remark = `由任务 ${draft.taskName} 按建议创建`

  const activeLines = draft.lines.filter((line) => line.selected && line.confirmedQty > 0)
  const finalStatus = requestStatus ?? getDefaultRequestStatus(mode)

  const request: MaterialRequestRecord = {
    materialRequestId: `MR-${materialRequestNo}`,
    materialRequestNo,
    productionOrderNo: draft.productionOrderNo,
    taskId: draft.taskId,
    taskName: draft.taskName,
    taskType: draft.taskType,
    materialMode: draft.materialMode,
    materialModeLabel: draft.materialModeLabel,
    lineCount: activeLines.length,
    materialSummary: summarizeMaterials(activeLines),
    requestStatus: finalStatus,
    updatedAt: createdAt,
    createdBy,
  }

  materialRequests.push(request)
  applyTaskBinding(request)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '确认领料',
    detail: `跟单员确认领料，正式创建领料需求 ${materialRequestNo}（${draft.taskName}）`,
    at: createdAt,
    by: createdBy,
  })
}

let materialRequestSequence = 1
const taskBindings = new Map<string, MaterialRequestTaskBinding>()
const materialDraftOperationLogs: MaterialDraftOperationLog[] = []

const materialRequestDrafts: MaterialRequestDraft[] = buildInitialDrafts()
const materialRequests: MaterialRequestRecord[] = []

function appendMaterialDraftOperationLog(log: Omit<MaterialDraftOperationLog, 'id'>): void {
  materialDraftOperationLogs.push({
    id: createMaterialDraftLogId(),
    ...log,
  })
}

function touchDraft(draft: MaterialRequestDraft, by: string, at: string = toTimestamp()): void {
  draft.updatedBy = by
  draft.updatedAt = at
}

function seedSystemAutoDraftLogs(): void {
  const grouped = new Map<string, number>()
  for (const draft of materialRequestDrafts) {
    grouped.set(draft.productionOrderId, (grouped.get(draft.productionOrderId) ?? 0) + 1)
  }

  for (const [orderId, count] of grouped.entries()) {
    const order = productionOrders.find((item) => item.productionOrderId === orderId)
    appendMaterialDraftOperationLog({
      productionOrderId: orderId,
      action: '系统创建领料草稿',
      detail: `系统根据任务与BOM自动生成领料草稿（${count}条）`,
      at: order?.updatedAt ?? '2026-03-10 09:00:00',
      by: '系统',
    })
  }
}

// 预置演示数据：覆盖待确认 / 部分创建 / 已创建 / 不涉及等状态。
seedSystemAutoDraftLogs()
markDraftNotApplicable('TASK-202603-0003-002', 'Mira Handayani', '2026-03-10 10:10:00')
seedCreatedDraft('TASK-202603-0004-002', 'warehouse_delivery', '2026-03-10 10:25:00', 'Mira Handayani', '待配送')
seedCreatedDraft('TASK-202603-0005-001', 'factory_pickup', '2026-03-11 14:20:00', 'Budi Santoso', '待自提')
seedCreatedDraft('TASK-202603-0006-001', 'warehouse_delivery', '2026-03-08 09:30:00', 'Mira Handayani', '待配料')
seedCreatedDraft('TASK-202603-0006-002', 'warehouse_delivery', '2026-03-09 16:00:00', 'Mira Handayani', '已完成')

const seedEditableDraft = materialRequestDrafts.find((draft) => draft.taskId === 'TASK-202603-0004-001')
if (seedEditableDraft && seedEditableDraft.lines[0]) {
  setMaterialDraftMode(seedEditableDraft.draftId, 'factory_pickup', 'Mira Handayani')
  setMaterialDraftLineConfirmedQty(
    seedEditableDraft.draftId,
    seedEditableDraft.lines[0].lineId,
    Math.max(1, seedEditableDraft.lines[0].confirmedQty - 80),
    'Mira Handayani',
  )
}

function getOrderById(orderId: string): ProductionOrder | undefined {
  return productionOrders.find((order) => order.productionOrderId === orderId)
}

function getTaskById(taskId: string): ProcessTask | undefined {
  const baseTaskId = resolveBaseTaskId(taskId)
  return processTasks.find((task) => task.taskId === baseTaskId)
}

function getDraftById(draftId: string): MaterialRequestDraft | undefined {
  return materialRequestDrafts.find((draft) => draft.draftId === draftId)
}

function rebuildDraftLines(draft: MaterialRequestDraft): MaterialRequestDraftLine[] {
  const order = getOrderById(draft.productionOrderId)
  if (!order) return []

  const task = getTaskById(draft.taskId)
  const runtimeTask = getRuntimeTaskById(draft.taskId) ?? getRuntimeTaskForDraft(task)
  const candidates = buildDraftCandidates(order, draft.taskType, task, runtimeTask)
  return toDraftLines(draft.draftId, candidates)
}

export function listMaterialRequestDraftsByOrder(orderId: string): MaterialRequestDraft[] {
  return materialRequestDrafts
    .filter((draft) => draft.productionOrderId === orderId)
    .sort((a, b) => a.taskId.localeCompare(b.taskId))
    .map(cloneDraft)
}

export function getMaterialRequestDraftById(draftId: string): MaterialRequestDraft | null {
  const draft = getDraftById(draftId)
  return draft ? cloneDraft(draft) : null
}

export function getMaterialRequestDraftSummaryByOrder(orderId: string): MaterialDraftOrderSummary {
  const drafts = materialRequestDrafts.filter((draft) => draft.productionOrderId === orderId)

  const pendingCount = drafts.filter((draft) => draft.draftStatus === 'pending').length
  const createdCount = drafts.filter((draft) => draft.draftStatus === 'created').length
  const notApplicableCount = drafts.filter((draft) => draft.draftStatus === 'not_applicable').length

  let status: MaterialDraftOrderSummary['status'] = 'not_involved'
  if (drafts.length > 0) {
    if (createdCount > 0 && pendingCount > 0) {
      status = 'partial_created'
    } else if (createdCount > 0 && pendingCount === 0) {
      status = 'created'
    } else if (pendingCount > 0) {
      status = 'pending'
    } else {
      status = 'not_involved'
    }
  }

  const totalMaterialCount = drafts.reduce((sum, draft) => sum + draft.lines.length, 0)

  return {
    productionOrderId: orderId,
    totalDraftCount: drafts.length,
    totalTaskCount: drafts.length,
    totalMaterialCount,
    pendingCount,
    createdCount,
    notApplicableCount,
    requestCount: createdCount,
    status,
  }
}

export function getMaterialDraftIndicatorsByOrder(orderId: string): MaterialDraftOrderIndicators {
  const summary = getMaterialRequestDraftSummaryByOrder(orderId)
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  const hasMaterialDraft = summary.totalDraftCount > 0
  const hasConfirmedMaterialRequest = summary.createdCount > 0

  let materialDraftSummaryStatus: MaterialDraftOrderIndicators['materialDraftSummaryStatus'] = 'none'
  if (summary.status === 'pending') materialDraftSummaryStatus = 'pending'
  if (summary.status === 'partial_created') materialDraftSummaryStatus = 'partial_confirmed'
  if (summary.status === 'created') materialDraftSummaryStatus = 'confirmed'

  let materialDraftHintText = '暂无领料草稿'
  if (materialDraftSummaryStatus === 'none') {
    if (summary.totalDraftCount > 0 && summary.notApplicableCount === summary.totalDraftCount) {
      materialDraftHintText = `不涉及 ${summary.notApplicableCount}`
    } else {
      materialDraftHintText = order?.taskBreakdownSummary.isBrokenDown ? '需生成领料草稿' : '待拆任务后生成'
    }
  } else if (materialDraftSummaryStatus === 'pending') {
    materialDraftHintText = `草稿 ${summary.totalDraftCount} / 待确认 ${summary.pendingCount}`
  } else if (materialDraftSummaryStatus === 'partial_confirmed') {
    materialDraftHintText = `已确认 ${summary.createdCount} / 待确认 ${summary.pendingCount}`
  } else {
    materialDraftHintText = `需求 ${summary.requestCount}`
  }

  return {
    productionOrderId: orderId,
    hasMaterialDraft,
    hasConfirmedMaterialRequest,
    materialDraftSummaryStatus,
    materialDraftCount: summary.totalDraftCount,
    materialDraftPendingCount: summary.pendingCount,
    materialDraftConfirmedCount: summary.createdCount,
    materialDraftNotApplicableCount: summary.notApplicableCount,
    materialDraftHintText,
  }
}

export function setMaterialDraftNeedMaterial(draftId: string, needMaterial: boolean, operatorName = '跟单员'): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.needMaterial = needMaterial

  if (!needMaterial) {
    draft.draftStatus = 'not_applicable'
    draft.remark = '跟单员确认当前任务不需要领料'
    draft.lines = draft.lines.map((line) => ({ ...line, selected: false, confirmedQty: 0 }))
    const now = toTimestamp()
    touchDraft(draft, operatorName, now)
    appendMaterialDraftOperationLog({
      productionOrderId: draft.productionOrderId,
      taskId: draft.taskId,
      action: '领料草稿更新',
      detail: `跟单员将任务「${draft.taskName}」标记为无需领料`,
      at: now,
      by: operatorName,
    })
    return
  }

  const now = toTimestamp()
  draft.draftStatus = 'pending'
  draft.remark = draft.remark || '已改为需要领料，待确认创建'
  if (draft.lines.length > 0 && draft.lines.every((line) => !line.selected)) {
    draft.lines = draft.lines.map((line) => ({ ...line, selected: true, confirmedQty: normalizeQty(line.suggestedQty) }))
  }
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `跟单员将任务「${draft.taskName}」改为需要领料`,
    at: now,
    by: operatorName,
  })
}

export function setMaterialDraftMode(draftId: string, materialMode: MaterialMode, operatorName = '跟单员'): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return
  if (draft.materialMode === materialMode) return

  const now = toTimestamp()
  draft.materialMode = materialMode
  draft.materialModeLabel = MATERIAL_MODE_LABEL[materialMode]
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `跟单员修改领料方式为「${draft.materialModeLabel}」`,
    at: now,
    by: operatorName,
  })
}

export function setMaterialDraftRemark(draftId: string, remark: string, operatorName = '跟单员'): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return
  if (draft.remark === remark) return
  draft.remark = remark
  touchDraft(draft, operatorName, toTimestamp())
}

export function toggleMaterialDraftLine(
  draftId: string,
  lineId: string,
  selected: boolean,
  operatorName = '跟单员',
): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  const targetLine = draft.lines.find((line) => line.lineId === lineId)
  if (!targetLine || targetLine.selected === selected) return

  draft.lines = draft.lines.map((line) => {
    if (line.lineId !== lineId) return line
    return {
      ...line,
      selected,
      confirmedQty: selected ? Math.max(1, line.confirmedQty || line.suggestedQty) : 0,
    }
  })
  const now = toTimestamp()
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `${selected ? '勾选' : '取消'}物料「${targetLine.materialName}」`,
    at: now,
    by: operatorName,
  })
}

export function setMaterialDraftLineConfirmedQty(
  draftId: string,
  lineId: string,
  qty: number,
  operatorName = '跟单员',
): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  const targetLine = draft.lines.find((line) => line.lineId === lineId)
  if (!targetLine) return

  draft.lines = draft.lines.map((line) => {
    if (line.lineId !== lineId) return line
    const normalized = normalizeQty(qty)
    return {
      ...line,
      confirmedQty: normalized,
      selected: normalized > 0,
    }
  })
  const nextLine = draft.lines.find((line) => line.lineId === lineId)
  if (!nextLine || nextLine.confirmedQty === targetLine.confirmedQty) return

  const now = toTimestamp()
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `修改物料「${targetLine.materialName}」确认数量：${targetLine.confirmedQty}${targetLine.unit} → ${nextLine.confirmedQty}${nextLine.unit}`,
    at: now,
    by: operatorName,
  })
}

export function restoreMaterialDraftSuggestion(draftId: string, operatorName = '跟单员'): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.lines = rebuildDraftLines(draft)
  draft.needMaterial = true
  draft.draftStatus = 'pending'
  draft.materialMode = 'warehouse_delivery'
  draft.materialModeLabel = MATERIAL_MODE_LABEL.warehouse_delivery
  draft.remark = '已恢复系统自动建议'
  const now = toTimestamp()
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `恢复任务「${draft.taskName}」的系统建议`,
    at: now,
    by: operatorName,
  })
}

export function listMaterialDraftSupplementOptions(draftId: string): DraftMaterialCandidate[] {
  const draft = getDraftById(draftId)
  if (!draft) return []

  const order = getOrderById(draft.productionOrderId)
  if (!order) return []

  const task = getTaskById(draft.taskId)
  const runtimeTask = getRuntimeTaskById(draft.taskId) ?? getRuntimeTaskForDraft(task)
  const candidates = buildDraftCandidates(order, draft.taskType, task, runtimeTask)
  const selectedRefs = new Set(
    draft.lines.map((line) => `${line.sourceType}:${line.sourceRef}`),
  )

  return candidates.filter((candidate) => !selectedRefs.has(`${candidate.sourceType}:${candidate.sourceRef}`))
}

export function addMaterialToDraft(draftId: string, optionKeys: string[], operatorName = '跟单员'): number {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return 0

  const optionSet = new Set(optionKeys)
  const options = listMaterialDraftSupplementOptions(draftId).filter((item) => optionSet.has(item.optionKey))
  if (options.length === 0) return 0

  const nextIndex = draft.lines.length
  const appended = options.map((option, index) => {
    const suggestedQty = normalizeQty(option.suggestedQty)
    return {
      lineId: `${draft.draftId}-L${String(nextIndex + index + 1).padStart(2, '0')}`,
      selected: true,
      sourceType: option.sourceType,
      sourceTypeLabel: option.sourceTypeLabel,
      materialCode: option.materialCode,
      materialName: option.materialName,
      materialSpec: option.materialSpec,
      materialCategory: option.materialCategory,
      suggestedQty,
      confirmedQty: suggestedQty,
      unit: option.unit,
      sourceRef: option.sourceRef,
      note: option.sourceReasonText || option.note,
      sourceBomItemId: option.sourceBomItemId,
      sourceBomItemCode: option.sourceBomItemCode,
      sourceBomItemName: option.sourceBomItemName,
      sourceSkuCodes: option.sourceSkuCodes ? [...option.sourceSkuCodes] : undefined,
      sourceSkuLabels: option.sourceSkuLabels ? [...option.sourceSkuLabels] : undefined,
      linkedPatternIds: option.linkedPatternIds ? [...option.linkedPatternIds] : undefined,
      linkedPatternNames: option.linkedPatternNames ? [...option.linkedPatternNames] : undefined,
      patternSpecText: option.patternSpecText,
      patternTotalPieceCount: option.patternTotalPieceCount,
      pieceSummaryText: option.pieceSummaryText,
      sourceRuleLabel: option.sourceRuleLabel,
      sourceReasonText: option.sourceReasonText,
      sourcePatternId: option.sourcePatternId,
      sourcePieceId: option.sourcePieceId,
      sourceMappingId: option.sourceMappingId,
      sourceMappingLineId: option.sourceMappingLineId,
    } satisfies MaterialRequestDraftLine
  })

  draft.lines = [...draft.lines, ...appended]
  draft.needMaterial = true
  draft.draftStatus = 'pending'
  const now = toTimestamp()
  touchDraft(draft, operatorName, now)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '领料草稿更新',
    detail: `补充物料 ${appended.length} 条（任务：${draft.taskName}）`,
    at: now,
    by: operatorName,
  })

  return appended.length
}

export function confirmMaterialRequestDraft(
  draftId: string,
  operator: { id: string; name: string },
): { ok: true; request: MaterialRequestRecord } | { ok: false; reason: string } {
  const draft = getDraftById(draftId)
  if (!draft) {
    return { ok: false, reason: '未找到领料需求草稿' }
  }

  if (draft.draftStatus === 'created') {
    return { ok: false, reason: '当前草稿已创建正式领料需求' }
  }

  if (!draft.needMaterial) {
    draft.draftStatus = 'not_applicable'
    return { ok: false, reason: '当前任务已标记为不需要领料' }
  }

  const selectedLines = draft.lines.filter((line) => line.selected)
  if (selectedLines.length === 0) {
    return { ok: false, reason: '请至少勾选1条领料物料' }
  }

  if (selectedLines.some((line) => !Number.isFinite(line.confirmedQty) || line.confirmedQty <= 0)) {
    return { ok: false, reason: '确认数量必须大于0' }
  }

  if (!draft.materialMode) {
    return { ok: false, reason: '请选择领料方式' }
  }

  const now = toTimestamp()
  const materialRequestNo = createRequestNo(materialRequestSequence)
  materialRequestSequence += 1

  draft.draftStatus = 'created'
  draft.materialModeLabel = MATERIAL_MODE_LABEL[draft.materialMode]
  draft.createdMaterialRequestNo = materialRequestNo
  draft.createdBy = operator.name
  draft.createdAt = now
  touchDraft(draft, operator.name, now)

  const requestStatus = getDefaultRequestStatus(draft.materialMode)
  const request: MaterialRequestRecord = {
    materialRequestId: `MR-${materialRequestNo}`,
    materialRequestNo,
    productionOrderNo: draft.productionOrderNo,
    taskId: draft.taskId,
    taskName: draft.taskName,
    taskType: draft.taskType,
    materialMode: draft.materialMode,
    materialModeLabel: draft.materialModeLabel,
    lineCount: selectedLines.length,
    materialSummary: summarizeMaterials(selectedLines),
    requestStatus,
    updatedAt: now,
    createdBy: operator.name,
  }

  materialRequests.unshift(request)
  applyTaskBinding(request)
  appendMaterialDraftOperationLog({
    productionOrderId: draft.productionOrderId,
    taskId: draft.taskId,
    action: '确认领料',
    detail: `跟单员确认领料，正式创建领料需求 ${materialRequestNo}（${draft.taskName}）`,
    at: now,
    by: operator.name,
  })

  return {
    ok: true,
    request: cloneRequest(request),
  }
}

export function listMaterialRequests(): MaterialRequestRecord[] {
  return materialRequests
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(cloneRequest)
}

export function listMaterialRequestsByOrder(orderNo: string): MaterialRequestRecord[] {
  return listMaterialRequests().filter((item) => item.productionOrderNo === orderNo)
}

export function listMaterialDraftOperationLogsByOrder(orderId: string): MaterialDraftOperationLog[] {
  return materialDraftOperationLogs
    .filter((log) => log.productionOrderId === orderId)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((log) => ({ ...log }))
}

export function getTaskMaterialRequestBinding(taskId: string): MaterialRequestTaskBinding | null {
  const binding = taskBindings.get(taskId)
  if (!binding) return null
  return { ...binding }
}

export function getTaskTypeLabel(taskType: MaterialTaskType): string {
  return TASK_TYPE_LABEL[taskType]
}

export function getMaterialModeLabel(materialMode: MaterialMode): '仓库配送到厂' | '工厂到仓自提' {
  return MATERIAL_MODE_LABEL[materialMode]
}

export function getDraftStatusLabel(status: MaterialDraftStatus): '待确认' | '已确认创建' | '不涉及' {
  if (status === 'created') return '已确认创建'
  if (status === 'not_applicable') return '不涉及'
  return '待确认'
}

export function getSupplementOptionDisplayRows(draftId: string): Array<{
  optionKey: string
  sourceTypeLabel: 'BOM物料' | '上道产出'
  materialCode: string
  materialName: string
  materialSpec: string
  suggestedQty: number
  unit: string
  note: string
}> {
  return listMaterialDraftSupplementOptions(draftId).map((item) => ({
    optionKey: item.optionKey,
    sourceTypeLabel: item.sourceTypeLabel,
    materialCode: item.materialCode,
    materialName: item.materialName,
    materialSpec: item.materialSpec,
    suggestedQty: item.suggestedQty,
    unit: item.unit,
    note: item.sourceReasonText || item.note,
  }))
}
