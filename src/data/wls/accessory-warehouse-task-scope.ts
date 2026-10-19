import { listEffectiveTaskAssignments, type EffectiveTaskAssignment, type EffectiveTaskAssignmentSkuLine } from '../fcs/effective-task-assignments.ts'
import { readRuntimeTasks } from '../fcs/runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from '../fcs/runtime-process-tasks.ts'
import { productionOrders } from '../fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../fcs/production-order-tech-pack-runtime.ts'
import { getSewingMaterialHandoverProjection, listSewingMaterialHandoverContexts, type SewingMaterialHandoverProjection } from '../fcs/sewing-material-handover.ts'
import { getCurrentSewingPickupSlip, type SewingPickupSlipVersion } from '../fcs/sewing-pickup-slips.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../fcs/production-tech-pack-snapshot-types.ts'
import { ACCESSORY_HILON_WAREHOUSE, ACCESSORY_MAHAMERU_WAREHOUSE, splitAccessoryLinesForTask, type AccessoryPreparation, type AccessoryTransfer, type AccessoryTaskType } from './accessory-warehouse-flow.ts'

export type AccessorySewingTaskFact = Pick<RuntimeProcessTask,
  'taskId' | 'productionOrderId' | 'processCode' | 'processNameZh' | 'status' | 'assignmentStatus' | 'scopeQty' | 'scopeSkuLines'>
  & Partial<Pick<RuntimeProcessTask, 'taskNo' | 'processBusinessCode' | 'coveredProcesses' | 'taskUnitType' | 'mergedTaskType' | 'executionEnabled' | 'mergedIntoTaskId' | 'isSplitSource' | 'assignedFactoryId' | 'skuCode' | 'skuColor' | 'skuSize'>>
export interface AccessorySewingTaskScope {
  taskId: string
  taskNo: string
  assignmentId: string
  taskVersion: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  taskType: AccessoryTaskType
  assignedQty: number
  skuLines: EffectiveTaskAssignmentSkuLine[]
  quantitiesByLine: Record<string, number>
  sewingQuantitiesByLine: Record<string, number>
  postQuantitiesByLine: Record<string, number>
  /** 片段映射回既有实交账，不能另建平行实际交出事实。 */
  requirementLineIdByLine: Record<string, string>
  cumulativeHandedQtyByRequirement: Record<string, number>
  handoverContextPresent: boolean
  pickupSlipVersionId?: string
  bomQuantities: Array<{ sourceLineId: string; bomItemId: string; unit: string; assignedGarmentQty: number; unitConsumption: number; lossRate: number; requiredQty: number }>
}
export interface AccessorySewingTaskScopeFacts {
  tasks: readonly AccessorySewingTaskFact[]
  assignments: readonly EffectiveTaskAssignment[]
  snapshot: ProductionOrderTechPackSnapshot | null
  orderSkuLines: readonly EffectiveTaskAssignmentSkuLine[]
  handoverProjections?: readonly SewingMaterialHandoverProjection[]
  pickupSlipVersions?: readonly SewingPickupSlipVersion[]
}
export class AccessoryTaskScopeError extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'AccessoryTaskScopeError'; this.code = code }
}
const EPSILON = 0.000001
const roundQty = (qty: number) => Math.round(qty * 1_000_000) / 1_000_000
const sameQty = (left: number, right: number) => Math.abs(left - right) <= EPSILON
function requireValue(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new AccessoryTaskScopeError(code, message)
}
function normalizedCode(code: string): string {
  return ({ SEW: 'SEWING', PROC_SEW: 'SEWING', CUT: 'CUTTING', CUT_PANEL: 'CUTTING' } as Record<string, string>)[code.trim().toUpperCase()] || code.trim().toUpperCase()
}
function taskCodes(task: AccessorySewingTaskFact): Set<string> {
  return new Set([task.processBusinessCode || task.processCode, ...(task.coveredProcesses || []).map(row => row.processCode)].map(normalizedCode))
}
function includesSewing(task: AccessorySewingTaskFact): boolean {
  return taskCodes(task).has('SEWING') || task.mergedTaskType === 'SEWING_IRON_PACK' || task.mergedTaskType === 'CUTTING_SEWING_IRON_PACK'
}
function taskTypeOf(task: AccessorySewingTaskFact, assignment: EffectiveTaskAssignment): AccessoryTaskType {
  const codes = new Set(assignment.processCodes.map(normalizedCode))
  requireValue(codes.has('SEWING'), 'ASSIGNMENT_PROCESS_CONFLICT', '有效分配未包含当前车缝责任')
  if (task.mergedTaskType === 'CUTTING_SEWING_IRON_PACK') {
    requireValue(codes.has('CUTTING') && codes.has('IRON_PACK'), 'ASSIGNMENT_PROCESS_CONFLICT', '裁剪车缝烫包任务与有效分配责任不一致')
    return 'CUTTING_SEWING_IRONING_PACKING'
  }
  if (task.mergedTaskType === 'SEWING_IRON_PACK') {
    requireValue(codes.has('IRON_PACK') && !codes.has('CUTTING'), 'ASSIGNMENT_PROCESS_CONFLICT', '车缝烫包任务与有效分配责任不一致')
    return 'SEWING_IRONING_PACKING'
  }
  requireValue(task.taskUnitType !== 'MERGED_PRODUCTION_TASK' && !codes.has('IRON_PACK') && !codes.has('CUTTING'), 'ASSIGNMENT_PROCESS_CONFLICT', '任务与有效分配的后道责任待核对')
  return 'SEWING'
}
function validSkuLines(rows: readonly EffectiveTaskAssignmentSkuLine[], label: string): Map<string, EffectiveTaskAssignmentSkuLine> {
  requireValue(rows.length, 'SKU_SCOPE_MISSING', `${label}缺少明确的 SKU、颜色、尺码范围`)
  const result = new Map<string, EffectiveTaskAssignmentSkuLine>()
  for (const row of rows) {
    requireValue(row.skuCode.trim() && row.color.trim() && row.size.trim() && Number.isFinite(row.qty) && row.qty > 0, 'INVALID_SKU_SCOPE', `${label}的 SKU、颜色、尺码或数量无效`)
    requireValue(!result.has(row.skuCode), 'DUPLICATE_SKU_SCOPE', `${label}存在重复 SKU 范围`)
    result.set(row.skuCode, row)
  }
  return result
}
function bomForPreparationLine(preparation: AccessoryPreparation, snapshot: ProductionOrderTechPackSnapshot, lineId: string): TechPackBomItemSnapshot {
  const line = preparation.lines.find(row => row.id === lineId)!
  const exact = snapshot.bomItems.filter(bom => line.id === `${preparation.id}:${snapshot.sourceTechPackVersionId}:${bom.id}`)
  const candidates = exact.length ? exact : snapshot.bomItems.filter(bom => (bom.materialCode || bom.materialSkuId || bom.id) === line.materialSku)
  requireValue(candidates.length === 1, 'BOM_SOURCE_CONFLICT', `${line.materialName}无法唯一关联冻结 BOM，不能猜用量`)
  const bom = candidates[0]
  requireValue(bom.unit?.trim() && bom.unit === line.unit, 'BOM_UNIT_CONFLICT', `${line.materialName}的冻结 BOM 与仓储单位不一致`)
  requireValue(Number.isFinite(bom.unitConsumption) && bom.unitConsumption > 0 && Number.isFinite(bom.lossRate) && bom.lossRate >= 0 && bom.lossRate < 1, 'INVALID_BOM_QUANTITY', `${line.materialName}的单耗或损耗无效`)
  return bom
}
function taskVersion(assignment: EffectiveTaskAssignment, snapshot: ProductionOrderTechPackSnapshot, taskType: AccessoryTaskType): string {
  // 完整事实组成内部版本，避免短哈希碰撞；不用于界面显示。
  return `ACCESSORY-SCOPE:${JSON.stringify([assignment.assignmentId, assignment.operatedAt, assignment.factoryId, assignment.ppicId, snapshot.sourceTechPackVersionId, taskType,
    [...assignment.skuLines].sort((a, b) => a.skuCode.localeCompare(b.skuCode)).map(row => [row.skuCode, row.color, row.size, row.qty])])}`
}

/** 注入冻结事实的纯计算。这里输出需求范围，不把应领或旧实交猜成当前库位可用库存。 */
export function buildAccessorySewingTaskScopes(preparation: AccessoryPreparation, receivedTransfer: AccessoryTransfer, facts: AccessorySewingTaskScopeFacts): AccessorySewingTaskScope[] {
  requireValue(preparation.status === '已配齐' && receivedTransfer.status === '已收货'
    && receivedTransfer.preparationId === preparation.id && receivedTransfer.productionOrderId === preparation.productionOrderId
    && [ACCESSORY_HILON_WAREHOUSE, ACCESSORY_MAHAMERU_WAREHOUSE].includes(receivedTransfer.toWarehouse || ''), 'SOURCE_NOT_RECEIVED', '本仓有效辅料整单收货后才能生成领料和后道范围')
  const snapshot = facts.snapshot
  requireValue(snapshot && snapshot.productionOrderId === preparation.productionOrderId, 'TECH_PACK_MISSING', '当前生产单缺少冻结技术包')
  requireValue(snapshot.sourceTechPackVersionId === preparation.techPackVersion, 'SOURCE_VERSION_CHANGED', '冻结技术包版本已经变化，需先核对原配料来源')
  const orderSkus = validSkuLines(facts.orderSkuLines, '生产单')
  const orderTasks = facts.tasks.filter(task => task.productionOrderId === preparation.productionOrderId && includesSewing(task))
  const assignments = facts.assignments.filter(assignment => assignment.productionOrderId === preparation.productionOrderId && assignment.status === 'EFFECTIVE')
  const activeTasks = orderTasks.filter(task => task.executionEnabled !== false && !task.isSplitSource && !task.mergedIntoTaskId && task.status !== 'CANCELLED')
  requireValue(activeTasks.length, 'WAITING_SEWING_ASSIGNMENT', '等待有效车缝任务分配')
  for (const assignment of assignments.filter(row => row.processCodes.map(normalizedCode).includes('SEWING'))) {
    requireValue(activeTasks.some(task => task.taskId === assignment.runtimeTaskId), 'STALE_SEWING_ASSIGNMENT', '有有效车缝分配关联到已取消、合并或缺失任务，需先核对来源')
  }
  const scopes: AccessorySewingTaskScope[] = []
  const globalAssigned = new Map<string, number>()
  const byAssignment = new Map<string, EffectiveTaskAssignment>()
  for (const task of [...activeTasks].sort((a, b) => a.taskId.localeCompare(b.taskId))) {
    requireValue(task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED', 'WAITING_SEWING_ASSIGNMENT', '车缝任务尚未完成有效分配')
    const current = assignments.filter(assignment => assignment.runtimeTaskId === task.taskId).sort((a, b) => a.assignmentId.localeCompare(b.assignmentId))
    requireValue(current.length, 'WAITING_SEWING_ASSIGNMENT', '当前车缝任务没有有效分配，不使用过期或取消记录')
    const actualTaskSkus = task.scopeSkuLines.length ? task.scopeSkuLines : task.skuCode && task.skuColor && task.skuSize
      ? [{ skuCode: task.skuCode, color: task.skuColor, size: task.skuSize, qty: task.scopeQty }] : []
    const taskSkus = validSkuLines(actualTaskSkus, '当前任务')
    requireValue(sameQty([...taskSkus.values()].reduce((sum, row) => sum + row.qty, 0), task.scopeQty), 'TASK_SCOPE_CONFLICT', '当前任务 SKU 合计与任务范围不一致')
    const assignedForTask = new Map<string, number>()
    for (const assignment of current) {
      requireValue(!byAssignment.has(assignment.assignmentId), 'DUPLICATE_ASSIGNMENT', '有效分配身份重复')
      byAssignment.set(assignment.assignmentId, assignment)
      requireValue(assignment.factoryId.trim() && assignment.factoryName.trim() && assignment.ppicId?.trim() && assignment.ppicName?.trim(), 'ASSIGNMENT_PARTIES_MISSING', '有效分配缺少加工厂或冻结 PPIC 责任人')
      if (current.length === 1 && task.assignedFactoryId) requireValue(task.assignedFactoryId === assignment.factoryId, 'ASSIGNMENT_FACTORY_CHANGED', '当前任务工厂与有效分配不一致，需重新读取')
      const skuLines = validSkuLines(assignment.skuLines, '有效分配')
      requireValue(sameQty([...skuLines.values()].reduce((sum, row) => sum + row.qty, 0), assignment.assignedQty), 'ASSIGNED_QUANTITY_CONFLICT', '有效分配数量与 SKU 合计不一致')
      for (const row of skuLines.values()) {
        const taskSku = taskSkus.get(row.skuCode), orderSku = orderSkus.get(row.skuCode)
        requireValue(taskSku && orderSku && taskSku.color === row.color && taskSku.size === row.size && orderSku.color === row.color && orderSku.size === row.size, 'ASSIGNED_SKU_CONFLICT', '有效分配的 SKU、颜色或尺码不属于当前任务及生产单')
        assignedForTask.set(row.skuCode, roundQty((assignedForTask.get(row.skuCode) || 0) + row.qty))
        globalAssigned.set(row.skuCode, roundQty((globalAssigned.get(row.skuCode) || 0) + row.qty))
        requireValue(globalAssigned.get(row.skuCode)! <= orderSku.qty + EPSILON, 'DUPLICATED_ORDER_SCOPE', '多个车缝任务重复占用了生产单的同一 SKU 数量')
      }
      const type = taskTypeOf(task, assignment)
      const projection = facts.handoverProjections?.find(row => row.context.assignmentId === assignment.assignmentId)
      if (projection) requireValue(projection.context.runtimeTaskId === task.taskId && projection.context.productionOrderId === preparation.productionOrderId
        && projection.context.factoryId === assignment.factoryId && projection.context.ppicId === assignment.ppicId
        && (!projection.context.snapshotId || projection.context.snapshotId === snapshot.snapshotId), 'HANDOVER_CONTEXT_CONFLICT', '既有车缝交出账与当前有效分配或技术包不一致')
      const slip = facts.pickupSlipVersions?.find(row => row.assignmentId === assignment.assignmentId && row.status === 'CURRENT' && row.objectKind !== 'CUT_PIECE')
      if (slip) requireValue(slip.runtimeTaskId === task.taskId && slip.factoryId === assignment.factoryId && slip.ppicId === assignment.ppicId, 'PICKUP_VERSION_CONFLICT', '当前领料凭证与有效任务或 PPIC 不一致')
      scopes.push({
        taskId: task.taskId, taskNo: task.taskNo || task.taskId, assignmentId: assignment.assignmentId, taskVersion: taskVersion(assignment, snapshot, type),
        factoryId: assignment.factoryId, factoryName: assignment.factoryName, ppicId: assignment.ppicId!, ppicName: assignment.ppicName!, taskType: type,
        assignedQty: assignment.assignedQty, skuLines: structuredClone(assignment.skuLines), quantitiesByLine: {}, sewingQuantitiesByLine: {}, postQuantitiesByLine: {},
        requirementLineIdByLine: {}, cumulativeHandedQtyByRequirement: Object.fromEntries((projection?.lines || []).map(row => [row.requirementLineId, row.cumulativeHandedOverQty])),
        handoverContextPresent: Boolean(projection), pickupSlipVersionId: slip?.versionId, bomQuantities: [],
      })
    }
    requireValue([...taskSkus.values()].every(row => sameQty(assignedForTask.get(row.skuCode) || 0, row.qty)), 'PARTIALLY_ASSIGNED_TASK', '车缝任务范围尚未全部有效分配，先完成任务分配再分流辅料')
  }
  requireValue(new Set(scopes.map(scope => scope.taskType === 'SEWING' ? 'DLN_POST' : 'FACTORY_POST')).size === 1, 'MIXED_POST_RESPONSIBILITY', '同一生产单存在不一致的后道责任，不能任选一方调拨')
  const remaining = new Map(receivedTransfer.lines.map(line => [line.id, line.qty]))
  requireValue(remaining.size === receivedTransfer.lines.length, 'DUPLICATE_TRANSFER_LINE', '收到的调拨片段身份重复')
  for (const sourceLine of preparation.lines) {
    requireValue(!sourceLine.requiresCutting, 'CUTTING_MATERIAL', '当前领料范围包含需裁剪物料，来源待核对')
    const fragments = receivedTransfer.lines.filter(line => (line.sourceLineId || line.id) === sourceLine.id).sort((a, b) => a.id.localeCompare(b.id))
    requireValue(fragments.length && fragments.every(line => line.materialSku === sourceLine.materialSku && line.unit === sourceLine.unit && line.toLocationId?.trim() && Number.isFinite(line.qty) && line.qty > 0)
      && sameQty(fragments.reduce((sum, row) => sum + row.qty, 0), sourceLine.requiredQty), 'TRANSFER_LINE_SOURCE_CONFLICT', `${sourceLine.materialName}的收货片段、数量单位或上架位置与原配料不一致`)
    const bom = bomForPreparationLine(preparation, snapshot, sourceLine.id)
    for (const scope of scopes) {
      const skuScope = new Set(bom.applicableSkuCodes || [])
      const garmentQty = scope.skuLines.reduce((sum, row) => sum + (!skuScope.size || skuScope.has(row.skuCode) ? row.qty : 0), 0)
      const requiredQty = roundQty(garmentQty * bom.unitConsumption * (1 + bom.lossRate))
      scope.bomQuantities.push({ sourceLineId: sourceLine.id, bomItemId: bom.id, unit: sourceLine.unit, assignedGarmentQty: garmentQty, unitConsumption: bom.unitConsumption, lossRate: bom.lossRate, requiredQty })
      if (!requiredQty) continue
      const split = splitAccessoryLinesForTask([sourceLine], scope.taskType)
      const output = split.postLines.length ? scope.postQuantitiesByLine : scope.sewingQuantitiesByLine
      let needed = requiredQty
      const projection = facts.handoverProjections?.find(row => row.context.assignmentId === scope.assignmentId)
      const requirement = projection?.lines.filter(row => row.bomItemId === bom.id && row.unit === sourceLine.unit)
      requireValue(!requirement || requirement.length <= 1, 'HANDOVER_LINE_CONFLICT', '既有实交账的 BOM 明细身份不唯一')
      for (const fragment of fragments) {
        const qty = roundQty(Math.min(needed, remaining.get(fragment.id)!))
        if (qty > 0) {
          scope.quantitiesByLine[fragment.id] = qty
          output[fragment.id] = qty
          if (requirement?.[0]) scope.requirementLineIdByLine[fragment.id] = requirement[0].requirementLineId
          remaining.set(fragment.id, roundQty(remaining.get(fragment.id)! - qty))
          needed = roundQty(needed - qty)
        }
      }
      requireValue(needed <= EPSILON, 'TASK_MATERIAL_OVER_SOURCE', `${sourceLine.materialName}的任务需求合计超过已接收范围，未生成超量清单`)
    }
  }
  requireValue(receivedTransfer.lines.every(fragment => preparation.lines.some(line => line.id === (fragment.sourceLineId || fragment.id))), 'TRANSFER_LINE_SOURCE_CONFLICT', '接收调拨存在不属于当前配料的片段')
  return scopes
}

/** 独立读取现有任务、有效分配、冻结 BOM 与既有实交账，不创建分配/领料/库存。 */
export function getAccessorySewingTaskScopes(preparation: AccessoryPreparation, receivedTransfer: AccessoryTransfer): AccessorySewingTaskScope[] {
  const tasks = readRuntimeTasks<RuntimeProcessTask>()
  const assignments = listEffectiveTaskAssignments().filter(row => row.productionOrderId === preparation.productionOrderId)
  const current = assignments.filter(row => row.status === 'EFFECTIVE')
  const slips = current.flatMap(assignment => {
    const type = assignment.processCodes.map(normalizedCode).includes('CUTTING') ? 'FABRIC_ACCESSORY' : 'ACCESSORY'
    const version = getCurrentSewingPickupSlip(assignment.assignmentId, type)
    return version ? [version] : []
  })
  const contexts = listSewingMaterialHandoverContexts()
  const projections = contexts.filter(row => current.some(assignment => assignment.assignmentId === row.assignmentId)).map(row => getSewingMaterialHandoverProjection(row.assignmentId))
  return buildAccessorySewingTaskScopes(preparation, receivedTransfer, {
    tasks, assignments,
    snapshot: getProductionOrderTechPackSnapshot(preparation.productionOrderId),
    orderSkuLines: productionOrders.find(order => order.productionOrderId === preparation.productionOrderId)?.demandSnapshot.skuLines || [],
    handoverProjections: projections, pickupSlipVersions: slips,
  })
}
