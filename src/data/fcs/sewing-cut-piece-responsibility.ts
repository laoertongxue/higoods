import {
  createEffectiveTaskAssignment,
  getEffectiveTaskAssignment,
  type EffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { getFactoryActivePpicSnapshot } from './factory-master-store.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from './factory-onboarding-ppic.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'

export type CutPieceShortageShape =
  | 'CLEAR'
  | 'ENTIRE_PART_MISSING'
  | 'AT_LEAST_HALF_MISSING'
  | 'PARTIAL_SHORTAGE'

export interface SewingCutPieceRequirementLineInput {
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  piecesPerGarment: number
  allocatedGarmentQty: number
}

export interface SewingCutPieceRequirementLine extends SewingCutPieceRequirementLineInput {
  requirementLineId: string
  requiredPieceQty: number
}

export interface SewingCutPieceResponsibilityContext {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo?: string
  taskNo?: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  requirementSnapshotId: string
  requirementSnapshotAt: string
  requirementSnapshotBy: string
  requirementLines: SewingCutPieceRequirementLine[]
}

export interface SewingCutPieceHandoverLineInput {
  skuCode: string
  color: string
  size: string
  partCode: string
  pieceQty: number
}

export interface SewingCutPieceHandoverLine extends SewingCutPieceHandoverLineInput {
  handoverLineId: string
  partName: string
  piecesPerGarment: number
}

export interface SewingCutPieceHandoverEvent {
  handoverEventId: string
  commandId: string
  assignmentId: string
  runtimeTaskId: string
  handoverRecordId: string
  handoverRecordNo: string
  dispatchBatchId: string
  handedOverAt: string
  handedOverBy: string
  status: 'CONFIRMED' | 'CANCELLED'
  lines: SewingCutPieceHandoverLine[]
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
}

export interface SewingCutPiecePartExclusionVersion {
  exclusionVersionId: string
  commandId: string
  assignmentId: string
  runtimeTaskId: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  reason: string
  evidenceUrls: string[]
  productionImpact: string
  status: 'EFFECTIVE' | 'SUPERSEDED' | 'CANCELLED'
  createdAt: string
  createdByPpicId: string
  createdByPpicName: string
  supersededAt?: string
  supersededByVersionId?: string
  cancelledAt?: string
  cancelledByPpicId?: string
  cancelReason?: string
}

export interface SewingReturnResponsibilityVersion {
  responsibilityVersionId: string
  assignmentId: string
  runtimeTaskId: string
  sourceKind: 'HANDOVER_CONFIRMED' | 'PART_EXCLUSION'
  sourceId: string
  responsibilityQtyBySku: Record<string, number>
  totalResponsibilityQty: number
  createdAt: string
  createdBy: string
}

export interface SewingCutPieceProjectionLine {
  requirementLineId: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  piecesPerGarment: number
  allocatedGarmentQty: number
  requiredPieceQty: number
  handedOverPieceQty: number
  debtPieceQty: number
  overPieceQty: number
  excludedFromEffectiveKit: boolean
  exclusionVersionId?: string
  shortageShape: CutPieceShortageShape
}

export interface SewingCutPieceSkuProjection {
  skuKey: string
  skuCode: string
  color: string
  size: string
  allocatedGarmentQty: number
  strictCompleteKitQty: number
  effectiveCompleteKitQty: number
  returnResponsibilityQty: number
}

export interface SewingCutPieceResponsibilityProjection {
  context: SewingCutPieceResponsibilityContext
  lines: SewingCutPieceProjectionLine[]
  skuSummaries: SewingCutPieceSkuProjection[]
  totalRequiredPieceQty: number
  totalHandedOverPieceQty: number
  totalDebtPieceQty: number
  totalOverPieceQty: number
  strictCompleteKitQty: number
  effectiveCompleteKitQty: number
  returnResponsibilityQty: number
  structuralMissingLineCount: number
  activeExclusionCount: number
}

export interface SewingCutPiecePartExclusionEligibility {
  eligible: boolean
  reason: string
}

export function getSewingCutPiecePartExclusionEligibility(
  line: SewingCutPieceProjectionLine,
  hasConfirmedHandover = true,
): SewingCutPiecePartExclusionEligibility {
  if (!hasConfirmedHandover) return { eligible: false, reason: '裁床尚未形成确认交出，交出前不判定欠片，也不能排除部位' }
  if (line.excludedFromEffectiveKit) return { eligible: false, reason: '该部位已有生效中的排除版本' }
  if (line.debtPieceQty <= 0) return { eligible: false, reason: '该部位没有欠片，不能排除' }
  if (line.shortageShape === 'ENTIRE_PART_MISSING') return { eligible: true, reason: '整个部位未交，可由当前任务PPIC判断是否排除' }
  if (line.shortageShape === 'AT_LEAST_HALF_MISSING') return { eligible: true, reason: '缺口达到应交数量一半，可由当前任务PPIC判断是否排除' }
  return { eligible: false, reason: '局部欠片未达到一半，保留欠片和补料跟进，不做人为排除' }
}

const contexts = new Map<string, SewingCutPieceResponsibilityContext>()
const handoverEvents = new Map<string, SewingCutPieceHandoverEvent>()
const exclusions = new Map<string, SewingCutPiecePartExclusionVersion>()
const responsibilityVersions = new Map<string, SewingReturnResponsibilityVersion[]>()
const commandResults = new Map<string, { kind: 'HANDOVER' | 'EXCLUSION' | 'CANCEL_EXCLUSION'; id: string }>()
let handoverSequence = 0
let exclusionSequence = 0
let responsibilitySequence = 0

function clone<T>(value: T): T {
  return structuredClone(value)
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label}必须为大于0的整数`)
  return value
}

function normalizedText(value: string, label: string): string {
  const text = value.trim()
  if (!text) throw new Error(`${label}不能为空`)
  return text
}

function requirementKey(input: Pick<SewingCutPieceRequirementLineInput, 'skuCode' | 'color' | 'size' | 'partCode'>): string {
  return [input.skuCode, input.color, input.size, input.partCode].map((item) => item.trim()).join('::')
}

function skuKey(input: Pick<SewingCutPieceRequirementLineInput, 'skuCode' | 'color' | 'size'>): string {
  return [input.skuCode, input.color, input.size].map((item) => item.trim()).join('::')
}

function requireAssignment(assignmentId: string): EffectiveTaskAssignment {
  const assignment = getEffectiveTaskAssignment(assignmentId)
  if (!assignment) throw new Error(`未找到有效分配${assignmentId}`)
  if (assignment.status === 'CANCELLED') throw new Error('已取消分配不能建立或追加裁片责任')
  if (!assignment.processCodes.some((code) => ['SEW', 'SEWING'].includes(code.trim().toUpperCase()))) {
    throw new Error('只有含车缝的有效分配才能建立裁片责任')
  }
  if (!assignment.ppicId || !assignment.ppicName) throw new Error('任务没有冻结PPIC，不能建立裁片责任')
  return assignment
}

function requireContext(assignmentId: string): SewingCutPieceResponsibilityContext {
  const context = contexts.get(assignmentId)
  if (!context) throw new Error(`分配${assignmentId}尚未冻结必需裁片部位`)
  return context
}

function activeExclusions(assignmentId: string): SewingCutPiecePartExclusionVersion[] {
  return [...exclusions.values()].filter((item) => item.assignmentId === assignmentId && item.status === 'EFFECTIVE')
}

function latestResponsibility(assignmentId: string): SewingReturnResponsibilityVersion | undefined {
  return responsibilityVersions.get(assignmentId)?.at(-1)
}

function validateCurrentPpic(context: SewingCutPieceResponsibilityContext, ppicId: string): { ppicId: string; ppicName: string } {
  const responsibility = getCurrentSewingTaskResponsibility(context.runtimeTaskId)
  if (!responsibility || responsibility.ppicId !== ppicId) throw new Error('只有该执行任务当前PPIC可以维护部位排除')
  return { ppicId: responsibility.ppicId, ppicName: responsibility.ppicName }
}

export function initializeSewingCutPieceResponsibility(input: {
  assignmentId: string
  requirementSnapshotId: string
  requirementSnapshotAt: string
  requirementSnapshotBy: string
  requirementLines: SewingCutPieceRequirementLineInput[]
}): SewingCutPieceResponsibilityContext {
  const existing = contexts.get(input.assignmentId)
  if (existing) {
    if (existing.requirementSnapshotId !== input.requirementSnapshotId) {
      throw new Error('当前分配已经冻结必需裁片版本，不能静默替换')
    }
    return clone(existing)
  }
  const assignment = requireAssignment(input.assignmentId)
  normalizedText(input.requirementSnapshotId, '必需裁片快照')
  normalizedText(input.requirementSnapshotAt, '快照时间')
  normalizedText(input.requirementSnapshotBy, '快照操作人')
  if (!input.requirementLines.length) throw new Error('必需裁片部位不能为空')
  const assignmentSkuQty = new Map(assignment.skuLines.map((line) => [line.skuCode, line.qty]))
  const seen = new Set<string>()
  const requirementLines = input.requirementLines.map((line, index) => {
    const key = requirementKey(line)
    if (seen.has(key)) throw new Error(`必需裁片部位重复：${key}`)
    seen.add(key)
    const assignmentQty = assignmentSkuQty.get(line.skuCode)
    if (!assignmentQty) throw new Error(`裁片部位${key}不属于当前分配SKU`)
    const allocatedGarmentQty = positiveInteger(line.allocatedGarmentQty, '分配成衣数量')
    if (allocatedGarmentQty !== assignmentQty) throw new Error(`裁片部位${key}的成衣数量必须等于该SKU分配数量${assignmentQty}`)
    const piecesPerGarment = positiveInteger(line.piecesPerGarment, '每件用片数')
    return {
      ...line,
      skuCode: normalizedText(line.skuCode, 'SKU'),
      color: normalizedText(line.color, '颜色'),
      size: normalizedText(line.size, '尺码'),
      partCode: normalizedText(line.partCode, '部位编码'),
      partName: normalizedText(line.partName, '部位名称'),
      piecesPerGarment,
      allocatedGarmentQty,
      requirementLineId: `REQ-${input.assignmentId}-${String(index + 1).padStart(3, '0')}`,
      requiredPieceQty: allocatedGarmentQty * piecesPerGarment,
    }
  })
  for (const assignmentLine of assignment.skuLines) {
    if (!requirementLines.some((line) => line.skuCode === assignmentLine.skuCode)) {
      throw new Error(`SKU ${assignmentLine.skuCode}没有冻结任何必需裁片部位`)
    }
  }
  const context: SewingCutPieceResponsibilityContext = {
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    productionOrderNo: assignment.productionOrderNo,
    taskNo: assignment.taskNo,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    ppicId: assignment.ppicId!,
    ppicName: assignment.ppicName!,
    requirementSnapshotId: input.requirementSnapshotId,
    requirementSnapshotAt: input.requirementSnapshotAt,
    requirementSnapshotBy: input.requirementSnapshotBy,
    requirementLines,
  }
  contexts.set(input.assignmentId, context)
  return clone(context)
}

function handoverTotals(assignmentId: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const event of handoverEvents.values()) {
    if (event.assignmentId !== assignmentId || event.status !== 'CONFIRMED') continue
    for (const line of event.lines) {
      const key = requirementKey(line)
      totals.set(key, (totals.get(key) || 0) + line.pieceQty)
    }
  }
  return totals
}

function kitQty(lines: SewingCutPieceProjectionLine[], useExclusions: boolean): number {
  const included = useExclusions ? lines.filter((line) => !line.excludedFromEffectiveKit) : lines
  if (!included.length) return 0
  return Math.min(...included.map((line) => Math.min(
    line.allocatedGarmentQty,
    Math.floor(line.handedOverPieceQty / line.piecesPerGarment),
  )))
}

function buildProjection(assignmentId: string): SewingCutPieceResponsibilityProjection {
  const context = requireContext(assignmentId)
  const totals = handoverTotals(assignmentId)
  const hasConfirmedHandover = [...handoverEvents.values()].some((event) => (
    event.assignmentId === assignmentId && event.status === 'CONFIRMED'
  ))
  const exclusionByKey = new Map(activeExclusions(assignmentId).map((item) => [requirementKey(item), item]))
  const lines: SewingCutPieceProjectionLine[] = context.requirementLines.map((line) => {
    const handedOverPieceQty = totals.get(requirementKey(line)) || 0
    const debtPieceQty = Math.max(line.requiredPieceQty - handedOverPieceQty, 0)
    const exclusion = exclusionByKey.get(requirementKey(line))
    const shortageShape: CutPieceShortageShape = debtPieceQty === 0
      ? 'CLEAR'
      : handedOverPieceQty === 0
        ? 'ENTIRE_PART_MISSING'
        : debtPieceQty * 2 >= line.requiredPieceQty
          ? 'AT_LEAST_HALF_MISSING'
          : 'PARTIAL_SHORTAGE'
    return {
      ...line,
      handedOverPieceQty,
      debtPieceQty,
      overPieceQty: Math.max(handedOverPieceQty - line.requiredPieceQty, 0),
      excludedFromEffectiveKit: Boolean(exclusion),
      exclusionVersionId: exclusion?.exclusionVersionId,
      shortageShape,
    }
  })
  const grouped = new Map<string, SewingCutPieceProjectionLine[]>()
  lines.forEach((line) => {
    const key = skuKey(line)
    grouped.set(key, [...(grouped.get(key) || []), line])
  })
  const currentResponsibility = latestResponsibility(assignmentId)?.responsibilityQtyBySku || {}
  const skuSummaries = [...grouped.entries()].map(([key, skuLines]) => ({
    skuKey: key,
    skuCode: skuLines[0]!.skuCode,
    color: skuLines[0]!.color,
    size: skuLines[0]!.size,
    allocatedGarmentQty: skuLines[0]!.allocatedGarmentQty,
    strictCompleteKitQty: kitQty(skuLines, false),
    effectiveCompleteKitQty: kitQty(skuLines, true),
    returnResponsibilityQty: currentResponsibility[key] || 0,
  }))
  return {
    context: clone(context),
    lines,
    skuSummaries,
    totalRequiredPieceQty: lines.reduce((sum, line) => sum + line.requiredPieceQty, 0),
    totalHandedOverPieceQty: lines.reduce((sum, line) => sum + line.handedOverPieceQty, 0),
    totalDebtPieceQty: lines.reduce((sum, line) => sum + line.debtPieceQty, 0),
    totalOverPieceQty: lines.reduce((sum, line) => sum + line.overPieceQty, 0),
    strictCompleteKitQty: skuSummaries.reduce((sum, line) => sum + line.strictCompleteKitQty, 0),
    effectiveCompleteKitQty: skuSummaries.reduce((sum, line) => sum + line.effectiveCompleteKitQty, 0),
    returnResponsibilityQty: skuSummaries.reduce((sum, line) => sum + line.returnResponsibilityQty, 0),
    structuralMissingLineCount: hasConfirmedHandover
      ? lines.filter((line) => ['ENTIRE_PART_MISSING', 'AT_LEAST_HALF_MISSING'].includes(line.shortageShape)).length
      : 0,
    activeExclusionCount: exclusionByKey.size,
  }
}

function refreshResponsibility(input: {
  assignmentId: string
  sourceKind: SewingReturnResponsibilityVersion['sourceKind']
  sourceId: string
  createdAt: string
  createdBy: string
}): SewingReturnResponsibilityVersion | undefined {
  const projection = buildProjection(input.assignmentId)
  const previous = latestResponsibility(input.assignmentId)
  const nextBySku: Record<string, number> = {}
  let increased = false
  projection.skuSummaries.forEach((line) => {
    const previousQty = previous?.responsibilityQtyBySku[line.skuKey] || 0
    nextBySku[line.skuKey] = Math.max(previousQty, line.effectiveCompleteKitQty)
    if (nextBySku[line.skuKey] > previousQty) increased = true
  })
  if (!increased) return previous ? clone(previous) : undefined
  responsibilitySequence += 1
  const version: SewingReturnResponsibilityVersion = {
    responsibilityVersionId: `RET-RESP-${String(responsibilitySequence).padStart(6, '0')}`,
    assignmentId: input.assignmentId,
    runtimeTaskId: projection.context.runtimeTaskId,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    responsibilityQtyBySku: nextBySku,
    totalResponsibilityQty: Object.values(nextBySku).reduce((sum, qty) => sum + qty, 0),
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  }
  responsibilityVersions.set(input.assignmentId, [...(responsibilityVersions.get(input.assignmentId) || []), version])
  return clone(version)
}

export function recordSewingCutPieceHandover(input: {
  commandId: string
  assignmentId: string
  handoverRecordId: string
  handoverRecordNo: string
  dispatchBatchId: string
  handedOverAt: string
  handedOverBy: string
  lines: SewingCutPieceHandoverLineInput[]
}): SewingCutPieceHandoverEvent {
  const priorCommand = commandResults.get(input.commandId)
  if (priorCommand) {
    if (priorCommand.kind !== 'HANDOVER') throw new Error('命令号已被其他业务动作使用')
    return clone(handoverEvents.get(priorCommand.id)!)
  }
  const context = requireContext(input.assignmentId)
  requireAssignment(input.assignmentId)
  if ([...handoverEvents.values()].some((event) => event.handoverRecordId === input.handoverRecordId)) {
    throw new Error(`交出记录${input.handoverRecordId}已经入账`)
  }
  if (!input.lines.length) throw new Error('交出明细不能为空')
  const requirementByKey = new Map(context.requirementLines.map((line) => [requirementKey(line), line]))
  const aggregated = new Map<string, number>()
  input.lines.forEach((line) => {
    const key = requirementKey(line)
    if (!requirementByKey.has(key)) throw new Error(`交出明细${key}不属于冻结必需部位`)
    aggregated.set(key, (aggregated.get(key) || 0) + positiveInteger(line.pieceQty, '交出片数'))
  })
  handoverSequence += 1
  const handoverEventId = `CUT-HAND-${String(handoverSequence).padStart(6, '0')}`
  const lines = [...aggregated.entries()].map(([key, pieceQty], index) => {
    const requirement = requirementByKey.get(key)!
    return {
      handoverLineId: `${handoverEventId}-${String(index + 1).padStart(3, '0')}`,
      skuCode: requirement.skuCode,
      color: requirement.color,
      size: requirement.size,
      partCode: requirement.partCode,
      partName: requirement.partName,
      piecesPerGarment: requirement.piecesPerGarment,
      pieceQty,
    }
  })
  const event: SewingCutPieceHandoverEvent = {
    handoverEventId,
    commandId: normalizedText(input.commandId, '命令号'),
    assignmentId: context.assignmentId,
    runtimeTaskId: context.runtimeTaskId,
    handoverRecordId: normalizedText(input.handoverRecordId, '交出记录'),
    handoverRecordNo: normalizedText(input.handoverRecordNo, '交出记录号'),
    dispatchBatchId: normalizedText(input.dispatchBatchId, '交出批次'),
    handedOverAt: normalizedText(input.handedOverAt, '交出时间'),
    handedOverBy: normalizedText(input.handedOverBy, '交出人'),
    status: 'CONFIRMED',
    lines,
  }
  handoverEvents.set(event.handoverEventId, event)
  commandResults.set(input.commandId, { kind: 'HANDOVER', id: event.handoverEventId })
  refreshResponsibility({
    assignmentId: input.assignmentId,
    sourceKind: 'HANDOVER_CONFIRMED',
    sourceId: event.handoverEventId,
    createdAt: event.handedOverAt,
    createdBy: event.handedOverBy,
  })
  return clone(event)
}

export function createSewingCutPiecePartExclusion(input: {
  commandId: string
  assignmentId: string
  skuCode: string
  color: string
  size: string
  partCode: string
  reason: string
  evidenceUrls?: string[]
  productionImpact?: string
  createdAt: string
  createdByPpicId: string
}): SewingCutPiecePartExclusionVersion {
  const priorCommand = commandResults.get(input.commandId)
  if (priorCommand) {
    if (priorCommand.kind !== 'EXCLUSION') throw new Error('命令号已被其他业务动作使用')
    return clone(exclusions.get(priorCommand.id)!)
  }
  const context = requireContext(input.assignmentId)
  const operator = validateCurrentPpic(context, input.createdByPpicId)
  const key = requirementKey(input)
  const requirement = context.requirementLines.find((line) => requirementKey(line) === key)
  if (!requirement) throw new Error(`部位${key}不属于冻结必需裁片`)
  const projectionLine = buildProjection(input.assignmentId).lines.find((line) => requirementKey(line) === key)
  if (!projectionLine) throw new Error(`部位${key}缺少当前裁片投影`)
  const eligibility = getSewingCutPiecePartExclusionEligibility(
    projectionLine,
    listSewingCutPieceHandoverEvents(input.assignmentId).length > 0,
  )
  if (!eligibility.eligible) throw new Error(eligibility.reason)
  const currentlyExcludedKeys = new Set(activeExclusions(input.assignmentId).map(requirementKey))
  currentlyExcludedKeys.add(key)
  const remainingForSku = context.requirementLines.filter((line) => (
    skuKey(line) === skuKey(requirement) && !currentlyExcludedKeys.has(requirementKey(line))
  ))
  if (!remainingForSku.length) throw new Error('不能排除一个SKU的全部必需裁片部位')
  const reason = normalizedText(input.reason, '排除原因')
  exclusionSequence += 1
  const exclusionVersionId = `CUT-EXC-${String(exclusionSequence).padStart(6, '0')}`
  for (const current of activeExclusions(input.assignmentId)) {
    if (requirementKey(current) !== key) continue
    exclusions.set(current.exclusionVersionId, {
      ...current,
      status: 'SUPERSEDED',
      supersededAt: input.createdAt,
      supersededByVersionId: exclusionVersionId,
    })
  }
  const version: SewingCutPiecePartExclusionVersion = {
    exclusionVersionId,
    commandId: normalizedText(input.commandId, '命令号'),
    assignmentId: context.assignmentId,
    runtimeTaskId: context.runtimeTaskId,
    skuCode: requirement.skuCode,
    color: requirement.color,
    size: requirement.size,
    partCode: requirement.partCode,
    partName: requirement.partName,
    reason,
    evidenceUrls: [...new Set((input.evidenceUrls || []).map((item) => item.trim()).filter(Boolean))],
    productionImpact: (input.productionImpact || '').trim(),
    status: 'EFFECTIVE',
    createdAt: normalizedText(input.createdAt, '排除时间'),
    createdByPpicId: operator.ppicId,
    createdByPpicName: operator.ppicName,
  }
  exclusions.set(version.exclusionVersionId, version)
  commandResults.set(input.commandId, { kind: 'EXCLUSION', id: version.exclusionVersionId })
  refreshResponsibility({
    assignmentId: input.assignmentId,
    sourceKind: 'PART_EXCLUSION',
    sourceId: version.exclusionVersionId,
    createdAt: version.createdAt,
    createdBy: version.createdByPpicName,
  })
  return clone(version)
}

export function cancelSewingCutPiecePartExclusion(input: {
  commandId: string
  exclusionVersionId: string
  reason: string
  cancelledAt: string
  cancelledByPpicId: string
}): SewingCutPiecePartExclusionVersion {
  const priorCommand = commandResults.get(input.commandId)
  if (priorCommand) {
    if (priorCommand.kind !== 'CANCEL_EXCLUSION') throw new Error('命令号已被其他业务动作使用')
    return clone(exclusions.get(priorCommand.id)!)
  }
  const current = exclusions.get(input.exclusionVersionId)
  if (!current) throw new Error(`未找到排除版本${input.exclusionVersionId}`)
  if (current.status !== 'EFFECTIVE') throw new Error('只有当前有效排除可以取消')
  const context = requireContext(current.assignmentId)
  validateCurrentPpic(context, input.cancelledByPpicId)
  const next: SewingCutPiecePartExclusionVersion = {
    ...current,
    status: 'CANCELLED',
    cancelledAt: normalizedText(input.cancelledAt, '取消时间'),
    cancelledByPpicId: input.cancelledByPpicId,
    cancelReason: normalizedText(input.reason, '取消原因'),
  }
  exclusions.set(next.exclusionVersionId, next)
  commandResults.set(input.commandId, { kind: 'CANCEL_EXCLUSION', id: next.exclusionVersionId })
  return clone(next)
}

export function getSewingCutPieceResponsibilityProjection(assignmentId: string): SewingCutPieceResponsibilityProjection {
  return clone(buildProjection(assignmentId))
}

export function listSewingCutPieceHandoverEvents(assignmentId: string): SewingCutPieceHandoverEvent[] {
  return [...handoverEvents.values()].filter((item) => item.assignmentId === assignmentId).map(clone)
}

export function listSewingCutPiecePartExclusionVersions(assignmentId: string): SewingCutPiecePartExclusionVersion[] {
  return [...exclusions.values()].filter((item) => item.assignmentId === assignmentId).map(clone)
}

export function listSewingReturnResponsibilityVersions(assignmentId: string): SewingReturnResponsibilityVersion[] {
  return (responsibilityVersions.get(assignmentId) || []).map(clone)
}

export function resetSewingCutPieceResponsibilityForTests(): void {
  contexts.clear()
  handoverEvents.clear()
  exclusions.clear()
  responsibilityVersions.clear()
  commandResults.clear()
  handoverSequence = 0
  exclusionSequence = 0
  responsibilitySequence = 0
}

export const SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID = 'ASG-PPIC-CUT-HANDOVER-DEMO-001'

/**
 * Builds one deterministic prototype scenario through the same domain commands as real interactions.
 * The missing pocket is intentionally NOT pre-excluded so the PPIC page can demonstrate the decision.
 */
export function ensureSewingCutPieceResponsibilityDemo(): SewingCutPieceResponsibilityProjection {
  const assignmentId = SEWING_CUT_PIECE_RESPONSIBILITY_DEMO_ASSIGNMENT_ID
  if (!getEffectiveTaskAssignment(assignmentId)) {
    const factoryId = 'ID-F021'
    const ppic = getFactoryActivePpicSnapshot(factoryId)
    if (!ppic) throw new Error('PPIC裁片责任演示工厂缺少有效PPIC')
    createEffectiveTaskAssignment({
      assignmentId,
      runtimeTaskId: 'TASK-PPIC-CUT-HANDOVER-DEMO-001',
      productionOrderId: 'PO-PPIC-CUT-HANDOVER-DEMO-001',
      productionOrderNo: 'PO-PPIC-CUT-HANDOVER-DEMO-001',
      taskNo: 'SEW-OUT-PPIC-DEMO-001',
      factoryId,
      factoryName: 'PT Sinar Garment Indonesia',
      source: 'DIRECT_DISPATCH',
      assignedQty: 1000,
      skuLines: [{ skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', qty: 1000 }],
      processCodes: ['SEW'],
      frozenPrice: 1500,
      priceCurrency: 'IDR',
      priceUnit: '件',
      businessAssignedAt: '2026-08-31 09:00:00',
      operatedAt: '2026-08-31 09:00:00',
      operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
      allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
      allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    })
  }
  initializeSewingCutPieceResponsibility({
    assignmentId,
    requirementSnapshotId: 'TECHPACK-PPIC-DEMO-V3',
    requirementSnapshotAt: '2026-08-31 09:01:00',
    requirementSnapshotBy: '系统按有效分配冻结',
    requirementLines: [
      { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
      { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'BACK', partName: '后片', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
      { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'SLEEVE', partName: '袖片', piecesPerGarment: 2, allocatedGarmentQty: 1000 },
      { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'POCKET', partName: '口袋', piecesPerGarment: 1, allocatedGarmentQty: 1000 },
    ],
  })
  if (!listSewingCutPieceHandoverEvents(assignmentId).length) {
    recordSewingCutPieceHandover({
      commandId: 'CMD-PPIC-CUT-HANDOVER-DEMO-001',
      assignmentId,
      handoverRecordId: 'HO-REC-PPIC-DEMO-001',
      handoverRecordNo: 'JCR-PPIC-DEMO-001',
      dispatchBatchId: 'BATCH-PPIC-DEMO-001',
      handedOverAt: '2026-08-31 10:30:00',
      handedOverBy: '裁床待交出仓 王敏',
      lines: [
        { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'FRONT', pieceQty: 1000 },
        { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'BACK', pieceQty: 1000 },
        { skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', partCode: 'SLEEVE', pieceQty: 2000 },
      ],
    })
  }
  return getSewingCutPieceResponsibilityProjection(assignmentId)
}

export const SEWING_CUT_PIECE_UNHANDED_DEMO_ASSIGNMENT_ID = 'ASG-PPIC-CUT-HANDOVER-DEMO-UNHANDED'
export const SEWING_CUT_PIECE_CLEAR_DEMO_ASSIGNMENT_ID = 'ASG-PPIC-CUT-HANDOVER-DEMO-CLEAR'
export const SEWING_CUT_PIECE_NO_SUPPLEMENT_DEMO_ASSIGNMENT_ID = 'ASG-PPIC-CUT-HANDOVER-DEMO-NO-SUPPLEMENT'
export const SEWING_CUT_PIECE_WAIT_HANDOVER_DEMO_ASSIGNMENT_ID = 'ASG-PPIC-CUT-HANDOVER-DEMO-WAIT-HANDOVER'

function ensureOverviewDemoAssignment(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderNo: string
  taskNo: string
  assignedQty: number
}): EffectiveTaskAssignment {
  const existing = getEffectiveTaskAssignment(input.assignmentId)
  if (existing) return existing
  const factoryId = 'ID-F021'
  const ppic = getFactoryActivePpicSnapshot(factoryId)
  if (!ppic) throw new Error('PPIC交出与欠片概览演示工厂缺少有效PPIC')
  return createEffectiveTaskAssignment({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: input.productionOrderNo,
    productionOrderNo: input.productionOrderNo,
    taskNo: input.taskNo,
    factoryId,
    factoryName: 'PT Sinar Garment Indonesia',
    source: 'DIRECT_DISPATCH',
    assignedQty: input.assignedQty,
    skuLines: [{ skuCode: `${input.taskNo}-BLACK-M`, color: '黑色', size: 'M', qty: input.assignedQty }],
    processCodes: ['SEW'],
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-09-01 08:00:00',
    operatedAt: '2026-09-01 08:00:00',
    operatedBy: ppic.ppicName,
    allocationOperatorPpicId: ppic.ppicId,
    allocationOperatorPpicName: ppic.ppicName,
  })
}

function ensureOverviewProjection(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderNo: string
  taskNo: string
  assignedQty: number
  handover: boolean
}): SewingCutPieceResponsibilityProjection {
  ensureOverviewDemoAssignment(input)
  const skuCode = `${input.taskNo}-BLACK-M`
  initializeSewingCutPieceResponsibility({
    assignmentId: input.assignmentId,
    requirementSnapshotId: `TECHPACK-${input.taskNo}-V1`,
    requirementSnapshotAt: '2026-09-01 08:01:00',
    requirementSnapshotBy: '系统按有效分配冻结',
    requirementLines: [
      { skuCode, color: '黑色', size: 'M', partCode: 'FRONT', partName: '前片', piecesPerGarment: 1, allocatedGarmentQty: input.assignedQty },
      { skuCode, color: '黑色', size: 'M', partCode: 'BACK', partName: '后片', piecesPerGarment: 1, allocatedGarmentQty: input.assignedQty },
    ],
  })
  if (input.handover && !listSewingCutPieceHandoverEvents(input.assignmentId).length) {
    recordSewingCutPieceHandover({
      commandId: `CMD-${input.taskNo}-HANDOVER-001`,
      assignmentId: input.assignmentId,
      handoverRecordId: `HO-${input.taskNo}-001`,
      handoverRecordNo: `JCR-${input.taskNo}-001`,
      dispatchBatchId: `BATCH-${input.taskNo}-001`,
      handedOverAt: '2026-09-01 09:10:00',
      handedOverBy: '裁床待交出仓 王敏',
      lines: [
        { skuCode, color: '黑色', size: 'M', partCode: 'FRONT', pieceQty: input.assignedQty },
        { skuCode, color: '黑色', size: 'M', partCode: 'BACK', pieceQty: input.assignedQty },
      ],
    })
  }
  return getSewingCutPieceResponsibilityProjection(input.assignmentId)
}

function ensureShortageOverviewProjection(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderNo: string
  taskNo: string
  assignedQty: number
  shortagePartCode: string
  shortagePartName: string
  handedShortagePieceQty: number
}): SewingCutPieceResponsibilityProjection {
  ensureOverviewDemoAssignment(input)
  const skuCode = `${input.taskNo}-BLACK-M`
  initializeSewingCutPieceResponsibility({
    assignmentId: input.assignmentId,
    requirementSnapshotId: `TECHPACK-${input.taskNo}-V1`,
    requirementSnapshotAt: '2026-09-01 08:01:00',
    requirementSnapshotBy: '系统按有效分配冻结',
    requirementLines: [
      { skuCode, color: '黑色', size: 'M', partCode: 'BODY', partName: '衣身', piecesPerGarment: 1, allocatedGarmentQty: input.assignedQty },
      { skuCode, color: '黑色', size: 'M', partCode: input.shortagePartCode, partName: input.shortagePartName, piecesPerGarment: 1, allocatedGarmentQty: input.assignedQty },
    ],
  })
  if (!listSewingCutPieceHandoverEvents(input.assignmentId).length) {
    recordSewingCutPieceHandover({
      commandId: `CMD-${input.taskNo}-HANDOVER-001`,
      assignmentId: input.assignmentId,
      handoverRecordId: `HO-${input.taskNo}-001`,
      handoverRecordNo: `JCR-${input.taskNo}-001`,
      dispatchBatchId: `BATCH-${input.taskNo}-001`,
      handedOverAt: '2026-09-01 09:20:00',
      handedOverBy: '裁床待交出仓 王敏',
      lines: [
        { skuCode, color: '黑色', size: 'M', partCode: 'BODY', pieceQty: input.assignedQty },
        ...(input.handedShortagePieceQty > 0
          ? [{ skuCode, color: '黑色', size: 'M', partCode: input.shortagePartCode, pieceQty: input.handedShortagePieceQty }]
          : []),
      ],
    })
  }
  return getSewingCutPieceResponsibilityProjection(input.assignmentId)
}

/** Three task-level states used by the PPIC handover/debt page and workbench summary. */
export function ensureSewingCutPieceResponsibilityOverviewDemos(): SewingCutPieceResponsibilityProjection[] {
  const unhanded = ensureOverviewProjection({
    assignmentId: SEWING_CUT_PIECE_UNHANDED_DEMO_ASSIGNMENT_ID,
    runtimeTaskId: 'TASK-PPIC-CUT-HANDOVER-UNHANDED-001',
    productionOrderNo: 'PO-PPIC-CUT-HANDOVER-UNHANDED-001',
    taskNo: 'SEW-OUT-UNHANDED-001',
    assignedQty: 800,
    handover: false,
  })
  const clear = ensureOverviewProjection({
    assignmentId: SEWING_CUT_PIECE_CLEAR_DEMO_ASSIGNMENT_ID,
    runtimeTaskId: 'TASK-PPIC-CUT-HANDOVER-CLEAR-001',
    productionOrderNo: 'PO-PPIC-CUT-HANDOVER-CLEAR-001',
    taskNo: 'SEW-OUT-CLEAR-001',
    assignedQty: 600,
    handover: true,
  })
  const noSupplement = ensureShortageOverviewProjection({
    assignmentId: SEWING_CUT_PIECE_NO_SUPPLEMENT_DEMO_ASSIGNMENT_ID,
    runtimeTaskId: 'TASK-PPIC-CUT-HANDOVER-NO-SUPPLEMENT-001',
    productionOrderNo: 'PO-PPIC-CUT-HANDOVER-NO-SUPPLEMENT-001',
    taskNo: 'SEW-OUT-NO-SUPPLEMENT-001',
    assignedQty: 700,
    shortagePartCode: 'COLLAR',
    shortagePartName: '领片',
    handedShortagePieceQty: 0,
  })
  const waitingHandover = ensureShortageOverviewProjection({
    assignmentId: SEWING_CUT_PIECE_WAIT_HANDOVER_DEMO_ASSIGNMENT_ID,
    runtimeTaskId: 'TASK-PPIC-CUT-HANDOVER-WAIT-HANDOVER-001',
    productionOrderNo: 'PO-PPIC-CUT-HANDOVER-WAIT-HANDOVER-001',
    taskNo: 'SEW-OUT-WAIT-HANDOVER-001',
    assignedQty: 800,
    shortagePartCode: 'LACE',
    shortagePartName: '花边',
    handedShortagePieceQty: 400,
  })
  return [unhanded, clear, ensureSewingCutPieceResponsibilityDemo(), noSupplement, waitingHandover]
}
