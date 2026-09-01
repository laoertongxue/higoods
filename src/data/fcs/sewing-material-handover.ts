import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import type { SewingSampleAssignmentSnapshot } from './sewing-sample-approval-suggestion.ts'

export interface SewingMaterialRequirementLine {
  requirementLineId: string
  bomItemId: string
  materialType: '面料' | '辅料'
  materialCode: string
  materialName: string
  materialSpec: string
  unit: string
  unitConsumption: number
  lossRate: number
  assignedGarmentQty: number
  requiredQty: number
  imageUrl?: string
}

export interface SewingMaterialHandoverLineInput {
  requirementLineId: string
  actualQty: number
}

export interface SewingMaterialHandoverEvent {
  handoverEventId: string
  commandId: string
  assignmentId: string
  runtimeTaskId: string
  sourceRecordId: string
  sourceRecordNo: string
  handedOverAt: string
  handedOverBy: string
  handedOverByRole: 'CUTTING_WAREHOUSE' | 'MATERIAL_WAREHOUSE'
  lines: Array<SewingMaterialHandoverLineInput & {
    materialCode: string
    materialName: string
    unit: string
  }>
}

export interface SewingMaterialHandoverContext {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo: string
  taskNo: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  snapshotId?: string
  snapshotVersionLabel?: string
  dataCompleteness: 'COMPLETE' | 'TECH_PACK_MISSING' | 'MATERIAL_REQUIREMENT_MISSING'
  requirementLines: SewingMaterialRequirementLine[]
}

export interface SewingMaterialHandoverProjectionLine extends SewingMaterialRequirementLine {
  cumulativeHandedOverQty: number
  shortageQty: number
  overQty: number
}

export interface SewingMaterialHandoverProjection {
  context: SewingMaterialHandoverContext
  lines: SewingMaterialHandoverProjectionLine[]
  handoverEvents: SewingMaterialHandoverEvent[]
  hasCutPieceRelease: false
  hasCutPieceDebt: false
  materialShortageLineCount: number
}

const contexts = new Map<string, SewingMaterialHandoverContext>()
const events = new Map<string, SewingMaterialHandoverEvent>()
const commandEventIds = new Map<string, string>()
let eventSequence = 0

function clone<T>(value: T): T {
  return structuredClone(value)
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

function isCuttingSewingIronPack(processCodes: readonly string[]): boolean {
  const codes = processCodes.map((item) => item.trim().toUpperCase())
  return codes.some((code) => code === 'SEW' || code === 'SEWING' || code.includes('SEW'))
    && codes.some((code) => code === 'CUT' || code === 'CUTTING' || code.includes('CUT'))
}

export function initializeSewingMaterialHandoverForAssignment(
  input: SewingSampleAssignmentSnapshot & { assignedQty: number },
): SewingMaterialHandoverContext | null {
  if (!isCuttingSewingIronPack(input.processCodes)) return null
  if (!input.ppicId || !input.ppicName) throw new Error('裁剪+车缝+烫包任务必须冻结PPIC后才能建立面辅料交出账')
  const existing = contexts.get(input.assignmentId)
  if (existing) return clone(existing)
  const snapshot = getProductionOrderTechPackSnapshot(input.productionOrderId)
  const requirementLines: SewingMaterialRequirementLine[] = (snapshot?.bomItems || [])
    .filter((item) => item.type === '面料' || item.type === '辅料')
    .map((item, index) => ({
      requirementLineId: `MAT-REQ-${input.assignmentId}-${String(index + 1).padStart(3, '0')}`,
      bomItemId: item.id,
      materialType: item.type as '面料' | '辅料',
      materialCode: item.materialCode || item.materialSkuId || item.id,
      materialName: item.name,
      materialSpec: item.spec,
      unit: item.unit || (item.type === '面料' ? '米' : '件'),
      unitConsumption: item.unitConsumption,
      lossRate: item.lossRate,
      assignedGarmentQty: input.assignedQty,
      requiredQty: roundQuantity(input.assignedQty * item.unitConsumption * (1 + item.lossRate)),
      imageUrl: item.materialImageUrl,
    }))
  const context: SewingMaterialHandoverContext = {
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo || input.productionOrderId,
    taskNo: input.taskNo || input.runtimeTaskId,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    ppicId: input.ppicId,
    ppicName: input.ppicName,
    snapshotId: snapshot?.snapshotId,
    snapshotVersionLabel: snapshot?.versionLabel,
    dataCompleteness: !snapshot
      ? 'TECH_PACK_MISSING'
      : requirementLines.length
        ? 'COMPLETE'
        : 'MATERIAL_REQUIREMENT_MISSING',
    requirementLines,
  }
  contexts.set(input.assignmentId, context)
  return clone(context)
}

export function recordSewingMaterialHandover(input: {
  commandId: string
  assignmentId: string
  sourceRecordId: string
  sourceRecordNo: string
  handedOverAt: string
  handedOverBy: string
  handedOverByRole: 'CUTTING_WAREHOUSE' | 'MATERIAL_WAREHOUSE' | 'PPIC'
  lines: SewingMaterialHandoverLineInput[]
}): SewingMaterialHandoverEvent {
  const priorEventId = commandEventIds.get(input.commandId)
  if (priorEventId) return clone(events.get(priorEventId)!)
  if (input.handedOverByRole === 'PPIC') throw new Error('PPIC只能查看面辅料交出，不得代替仓库填写实交数量')
  const context = contexts.get(input.assignmentId)
  if (!context) throw new Error(`分配${input.assignmentId}不是裁剪+车缝+烫包面辅料交出任务`)
  if (context.dataCompleteness !== 'COMPLETE') throw new Error('技术包面辅料需求不完整，不能确认交出')
  if (!input.lines.length) throw new Error('面辅料交出明细不能为空')
  const requirementById = new Map(context.requirementLines.map((line) => [line.requirementLineId, line]))
  const aggregated = new Map<string, number>()
  input.lines.forEach((line) => {
    const requirement = requirementById.get(line.requirementLineId)
    if (!requirement) throw new Error(`面辅料交出明细${line.requirementLineId}不属于当前执行任务`)
    if (!Number.isFinite(line.actualQty) || line.actualQty <= 0) throw new Error('面辅料实交数量必须大于0')
    aggregated.set(line.requirementLineId, roundQuantity((aggregated.get(line.requirementLineId) || 0) + line.actualQty))
  })
  eventSequence += 1
  const handoverEventId = `MAT-HAND-${String(eventSequence).padStart(6, '0')}`
  const event: SewingMaterialHandoverEvent = {
    handoverEventId,
    commandId: input.commandId,
    assignmentId: context.assignmentId,
    runtimeTaskId: context.runtimeTaskId,
    sourceRecordId: input.sourceRecordId,
    sourceRecordNo: input.sourceRecordNo,
    handedOverAt: input.handedOverAt,
    handedOverBy: input.handedOverBy,
    handedOverByRole: input.handedOverByRole,
    lines: [...aggregated].map(([requirementLineId, actualQty]) => {
      const requirement = requirementById.get(requirementLineId)!
      return {
        requirementLineId,
        actualQty,
        materialCode: requirement.materialCode,
        materialName: requirement.materialName,
        unit: requirement.unit,
      }
    }),
  }
  events.set(handoverEventId, event)
  commandEventIds.set(input.commandId, handoverEventId)
  return clone(event)
}

export function getSewingMaterialHandoverProjection(assignmentId: string): SewingMaterialHandoverProjection {
  const context = contexts.get(assignmentId)
  if (!context) throw new Error(`分配${assignmentId}没有面辅料交出账`)
  const handoverEvents = [...events.values()].filter((event) => event.assignmentId === assignmentId)
  const handedOverByLine = new Map<string, number>()
  handoverEvents.forEach((event) => event.lines.forEach((line) => {
    handedOverByLine.set(
      line.requirementLineId,
      roundQuantity((handedOverByLine.get(line.requirementLineId) || 0) + line.actualQty),
    )
  }))
  const lines = context.requirementLines.map((line) => {
    const cumulativeHandedOverQty = handedOverByLine.get(line.requirementLineId) || 0
    return {
      ...line,
      cumulativeHandedOverQty,
      shortageQty: roundQuantity(Math.max(line.requiredQty - cumulativeHandedOverQty, 0)),
      overQty: roundQuantity(Math.max(cumulativeHandedOverQty - line.requiredQty, 0)),
    }
  })
  return clone({
    context,
    lines,
    handoverEvents,
    hasCutPieceRelease: false as const,
    hasCutPieceDebt: false as const,
    materialShortageLineCount: lines.filter((line) => line.shortageQty > 0).length,
  })
}

export function listSewingMaterialHandoverContexts(): SewingMaterialHandoverContext[] {
  return [...contexts.values()].map(clone)
}

export function resetSewingMaterialHandoversForTests(): void {
  contexts.clear()
  events.clear()
  commandEventIds.clear()
  eventSequence = 0
}
