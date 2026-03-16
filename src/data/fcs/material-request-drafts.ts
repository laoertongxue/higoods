import { productionOrders, type ProductionOrder } from './production-orders'
import { processTasks, type ProcessTask } from './process-tasks'
import { getTechPackBySpuCode, type TechPackBomItem } from './tech-packs'

export type MaterialTaskType = 'PRINT' | 'DYE' | 'CUT' | 'SEW'
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

function normalizeQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.max(1, Math.round(value * 100) / 100)
}

function getOrderTotalQty(order: ProductionOrder): number {
  return order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)
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

function resolveTaskType(task: ProcessTask): MaterialTaskType | null {
  const processName = task.processNameZh
  const processCode = task.processCode

  if (processName.includes('印花') || processCode === 'PROC_PRINT') return 'PRINT'
  if (processName.includes('染色') || processName.includes('染印') || processCode === 'PROC_DYE' || processCode === 'PROC_DYE_PRINT') {
    return 'DYE'
  }
  if (processName.includes('裁片') || processCode === 'PROC_CUT') return 'CUT'
  if (processName.includes('车缝') || processName.includes('缝纫') || processCode === 'PROC_SEW') return 'SEW'

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

function buildBomCandidates(order: ProductionOrder): DraftMaterialCandidate[] {
  const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
  const orderQty = getOrderTotalQty(order)
  const processFlags = getOrderProcessFlags(order.productionOrderId)

  if (!techPack || techPack.bomItems.length === 0) {
    return []
  }

  return techPack.bomItems.map((item) => {
    const category = inferMaterialCategory(item)
    const keyword = `${item.name} ${item.spec}`.toLowerCase()

    const requiresPrintKeyword = /印花|图案|转印|logo/.test(keyword)
    const requiresDyeKeyword = /染|色号|色牢度|色彩/.test(keyword)

    // 规则可读：有印花/染色任务时，面料默认进入对应建议范围。
    const requiresPrint = requiresPrintKeyword || (category === '面料' && processFlags.hasPrintTask)
    const requiresDye = requiresDyeKeyword || (category === '面料' && processFlags.hasDyeTask)

    const suggestedQty = normalizeQty(
      orderQty * item.unitConsumption * (1 + item.lossRate / 100),
    )

    return {
      optionKey: `bom:${item.id}`,
      sourceType: 'bom',
      sourceTypeLabel: SOURCE_TYPE_LABEL.bom,
      materialCode: `BOM-${order.demandSnapshot.spuCode}-${item.id}`,
      materialName: item.name,
      materialSpec: item.spec,
      materialCategory: category,
      suggestedQty,
      unit: inferMaterialUnit(item, category),
      sourceRef: item.id,
      note: `来源技术包BOM：${item.type}`,
      requiresPrint,
      requiresDye,
    }
  })
}

function buildUpstreamCandidates(order: ProductionOrder): DraftMaterialCandidate[] {
  const cutTasks = processTasks.filter(
    (task) => task.productionOrderId === order.productionOrderId && resolveTaskType(task) === 'CUT',
  )

  if (cutTasks.length === 0) return []

  return cutTasks.map((task, index) => {
    const suggestedQty = normalizeQty(task.qty)

    return {
      optionKey: `upstream:${task.taskId}`,
      sourceType: 'upstream_output',
      sourceTypeLabel: SOURCE_TYPE_LABEL.upstream_output,
      materialCode: `${order.productionOrderId}-CP-${String(index + 1).padStart(2, '0')}`,
      materialName: '裁片半成品',
      materialSpec: `来自${task.processNameZh}`,
      materialCategory: '裁片',
      suggestedQty,
      unit: CATEGORY_UNIT.裁片,
      sourceRef: task.taskId,
      note: `上道产出：${task.taskId}`,
      requiresPrint: false,
      requiresDye: false,
    }
  })
}

function buildDraftCandidates(order: ProductionOrder, taskType: MaterialTaskType): DraftMaterialCandidate[] {
  const bomCandidates = buildBomCandidates(order)
  const upstreamCandidates = buildUpstreamCandidates(order)

  if (taskType === 'PRINT') {
    return bomCandidates.filter((item) => item.requiresPrint)
  }

  if (taskType === 'DYE') {
    return bomCandidates.filter((item) => item.requiresDye)
  }

  if (taskType === 'CUT') {
    return bomCandidates.filter((item) => item.materialCategory === '面料')
  }

  return [
    ...upstreamCandidates,
    ...bomCandidates.filter((item) => item.materialCategory === '辅料'),
  ]
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
      note: candidate.note,
    }
  })
}

function buildDraftId(orderId: string, taskId: string): string {
  return `MRD-${orderId.replace(/[^0-9]/g, '')}-${taskId.replace(/[^0-9]/g, '')}`
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

  const task = processTasks.find((item) => item.taskId === request.taskId)
  if (!task) return

  task.hasMaterialRequest = true
  task.materialRequestNo = request.materialRequestNo
  task.materialMode = request.materialMode
  task.materialModeLabel = request.materialModeLabel
  task.materialRequestStatus = request.requestStatus
}

function buildInitialDrafts(): MaterialRequestDraft[] {
  const list: MaterialRequestDraft[] = []

  for (const order of productionOrders) {
    const orderTasks = processTasks
      .filter((task) => task.productionOrderId === order.productionOrderId)
      .sort((a, b) => a.seq - b.seq)

    for (const task of orderTasks) {
      const taskType = resolveTaskType(task)
      if (!taskType) continue

      const draftId = buildDraftId(order.productionOrderId, task.taskId)
      const candidates = buildDraftCandidates(order, taskType)

      list.push({
        draftId,
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderId,
        spuCode: order.demandSnapshot.spuCode,
        spuName: order.demandSnapshot.spuName,
        taskId: task.taskId,
        taskNo: task.taskId,
        taskName: task.processNameZh,
        taskType,
        draftStatus: 'pending',
        needMaterial: true,
        materialMode: 'warehouse_delivery',
        materialModeLabel: MATERIAL_MODE_LABEL.warehouse_delivery,
        remark: `系统按${TASK_TYPE_LABEL[taskType]}任务自动建议`,
        createdMaterialRequestNo: '',
        createdBy: '',
        createdAt: '',
        lines: toDraftLines(draftId, candidates),
      })
    }
  }

  return list
}

function markDraftNotApplicable(taskId: string): void {
  const draft = materialRequestDrafts.find((item) => item.taskId === taskId)
  if (!draft) return

  draft.needMaterial = false
  draft.draftStatus = 'not_applicable'
  draft.remark = '跟单员确认当前任务不需要领料'
  draft.lines = draft.lines.map((line) => ({ ...line, selected: false, confirmedQty: 0 }))
}

function seedCreatedDraft(taskId: string, mode: MaterialMode, createdAt: string, createdBy: string, requestStatus?: MaterialRequestProgressStatus): void {
  const draft = materialRequestDrafts.find((item) => item.taskId === taskId)
  if (!draft) return

  draft.needMaterial = true
  draft.materialMode = mode
  draft.materialModeLabel = MATERIAL_MODE_LABEL[mode]
  draft.draftStatus = 'created'
  draft.createdBy = createdBy
  draft.createdAt = createdAt

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
}

let materialRequestSequence = 1
const taskBindings = new Map<string, MaterialRequestTaskBinding>()

const materialRequestDrafts: MaterialRequestDraft[] = buildInitialDrafts()
const materialRequests: MaterialRequestRecord[] = []

// 预置演示数据：覆盖待确认 / 部分创建 / 已创建 / 不涉及等状态。
markDraftNotApplicable('TASK-202603-0003-002')
seedCreatedDraft('TASK-202603-0004-002', 'warehouse_delivery', '2026-03-10 10:25:00', 'Mira Handayani', '待配送')
seedCreatedDraft('TASK-202603-0005-001', 'factory_pickup', '2026-03-11 14:20:00', 'Budi Santoso', '待自提')
seedCreatedDraft('TASK-202603-0006-001', 'warehouse_delivery', '2026-03-08 09:30:00', 'Mira Handayani', '待配料')
seedCreatedDraft('TASK-202603-0006-002', 'warehouse_delivery', '2026-03-09 16:00:00', 'Mira Handayani', '已完成')

function getOrderById(orderId: string): ProductionOrder | undefined {
  return productionOrders.find((order) => order.productionOrderId === orderId)
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((task) => task.taskId === taskId)
}

function getDraftById(draftId: string): MaterialRequestDraft | undefined {
  return materialRequestDrafts.find((draft) => draft.draftId === draftId)
}

function rebuildDraftLines(draft: MaterialRequestDraft): MaterialRequestDraftLine[] {
  const order = getOrderById(draft.productionOrderId)
  if (!order) return []

  const candidates = buildDraftCandidates(order, draft.taskType)
  return toDraftLines(draft.draftId, candidates)
}

export function listMaterialRequestDraftsByOrder(orderId: string): MaterialRequestDraft[] {
  return materialRequestDrafts
    .filter((draft) => draft.productionOrderId === orderId)
    .sort((a, b) => a.taskNo.localeCompare(b.taskNo))
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

export function setMaterialDraftNeedMaterial(draftId: string, needMaterial: boolean): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.needMaterial = needMaterial

  if (!needMaterial) {
    draft.draftStatus = 'not_applicable'
    draft.remark = '跟单员确认当前任务不需要领料'
    draft.lines = draft.lines.map((line) => ({ ...line, selected: false, confirmedQty: 0 }))
    return
  }

  draft.draftStatus = 'pending'
  draft.remark = draft.remark || '已改为需要领料，待确认创建'
  if (draft.lines.length > 0 && draft.lines.every((line) => !line.selected)) {
    draft.lines = draft.lines.map((line) => ({ ...line, selected: true, confirmedQty: normalizeQty(line.suggestedQty) }))
  }
}

export function setMaterialDraftMode(draftId: string, materialMode: MaterialMode): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.materialMode = materialMode
  draft.materialModeLabel = MATERIAL_MODE_LABEL[materialMode]
}

export function setMaterialDraftRemark(draftId: string, remark: string): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return
  draft.remark = remark
}

export function toggleMaterialDraftLine(draftId: string, lineId: string, selected: boolean): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.lines = draft.lines.map((line) => {
    if (line.lineId !== lineId) return line
    return {
      ...line,
      selected,
      confirmedQty: selected ? Math.max(1, line.confirmedQty || line.suggestedQty) : 0,
    }
  })
}

export function setMaterialDraftLineConfirmedQty(draftId: string, lineId: string, qty: number): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.lines = draft.lines.map((line) => {
    if (line.lineId !== lineId) return line
    const normalized = normalizeQty(qty)
    return {
      ...line,
      confirmedQty: normalized,
      selected: normalized > 0,
    }
  })
}

export function restoreMaterialDraftSuggestion(draftId: string): void {
  const draft = getDraftById(draftId)
  if (!draft || draft.draftStatus === 'created') return

  draft.lines = rebuildDraftLines(draft)
  draft.needMaterial = true
  draft.draftStatus = 'pending'
  draft.materialMode = 'warehouse_delivery'
  draft.materialModeLabel = MATERIAL_MODE_LABEL.warehouse_delivery
  draft.remark = '已恢复系统自动建议'
}

export function listMaterialDraftSupplementOptions(draftId: string): DraftMaterialCandidate[] {
  const draft = getDraftById(draftId)
  if (!draft) return []

  const order = getOrderById(draft.productionOrderId)
  if (!order) return []

  const candidates = buildDraftCandidates(order, draft.taskType)
  const selectedRefs = new Set(
    draft.lines.map((line) => `${line.sourceType}:${line.sourceRef}`),
  )

  return candidates.filter((candidate) => !selectedRefs.has(`${candidate.sourceType}:${candidate.sourceRef}`))
}

export function addMaterialToDraft(draftId: string, optionKeys: string[]): number {
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
      note: option.note,
    } satisfies MaterialRequestDraftLine
  })

  draft.lines = [...draft.lines, ...appended]
  draft.needMaterial = true
  draft.draftStatus = 'pending'

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
    note: item.note,
  }))
}
