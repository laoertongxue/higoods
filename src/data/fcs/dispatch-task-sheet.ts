import { getFactoryActivePpicSnapshot, getFactoryMasterRecordById } from './factory-master-store.ts'
import {
  getEffectiveTaskAssignment, indexExistingRuntimeTaskAssignment, listEffectiveTaskAssignments,
  refreshEffectiveTaskAssignments, type EffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { listRuntimeProcessTasks, getRuntimeTaskById, type RuntimeProcessTask } from './runtime-process-tasks.ts'
import { classifyTaskFulfillmentPolicy } from './task-fulfillment-policy.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts'
import { productionOrders } from './production-orders.ts'
import { buildPrintQrPayload, buildUnifiedPrintPreviewLink } from './print-service.ts'

// TASK/CODE: identity is derived from the existing assignment and its current scope.
// No print counter, pickup version, inventory mutation or second assignment store.
export function dispatchTaskSheetFingerprint(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

function indexRuntimeAssignment(task: RuntimeProcessTask): void {
  if (!task.assignedFactoryId || !['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus)
    || task.isSplitSource || task.mergedIntoTaskId || task.executionEnabled === false
    || listEffectiveTaskAssignments(task.taskId).length || task.scopeQty <= 0) return
  const factory = getFactoryMasterRecordById(task.assignedFactoryId)
  const ppic = getFactoryActivePpicSnapshot(task.assignedFactoryId)
  const codes = classifyTaskFulfillmentPolicy(task).normalizedProcessCodes
  const hasSewing = codes.includes('SEWING')
  const assignedAt = task.businessAssignedAt || task.dispatchedAt || task.awardedAt || task.updatedAt
  indexExistingRuntimeTaskAssignment({
    assignmentId: `ASG-EXISTING-${task.taskId}-${dispatchTaskSheetFingerprint(`${task.assignedFactoryId}|${assignedAt}`)}`,
    indexedRuntimeSnapshot: true,
    runtimeTaskId: task.taskId, taskNo: task.taskNo || task.taskId,
    productionOrderId: task.productionOrderId, productionOrderNo: task.productionOrderId,
    factoryId: task.assignedFactoryId, factoryName: task.assignedFactoryName || factory?.name || task.assignedFactoryId,
    source: task.assignmentStatus === 'AWARDED' ? 'TENDER_AWARD' : 'DIRECT_DISPATCH',
    assignedQty: task.assignedQty || task.scopeQty, skuLines: task.scopeSkuLines.map((line) => ({ ...line })),
    processCodes: codes, frozenPrice: task.dispatchPrice || task.standardPrice || 0,
    priceCurrency: task.dispatchPriceCurrency || task.standardPriceCurrency || 'IDR',
    priceUnit: task.dispatchPriceUnit || task.standardPriceUnit || '件',
    businessAssignedAt: assignedAt, operatedAt: task.assignmentOperatedAt || assignedAt,
    operatedBy: task.dispatchedBy || '历史分配记录',
    ppicId: hasSewing ? ppic?.ppicId : undefined, ppicName: hasSewing ? ppic?.ppicName : undefined,
    ppicPhone: hasSewing ? ppic?.mobilePhone : undefined,
    ppicSnapshotAt: hasSewing && ppic ? new Date().toISOString() : undefined,
    ppicSnapshotSource: hasSewing && ppic ? 'EXISTING_ASSIGNMENT_INDEX' : undefined,
    status: 'EFFECTIVE',
  })
}

export function ensureDispatchTaskSheetAssignments(): void {
  refreshEffectiveTaskAssignments()
  const indexed = new Set(listEffectiveTaskAssignments().map((item) => item.runtimeTaskId))
  const missing = listRuntimeProcessTasks().filter((task) => !indexed.has(task.taskId)
    && task.assignedFactoryId && ['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus))
  for (const task of missing) indexRuntimeAssignment(task)
}

export function listDispatchTaskSheetAssignments(taskId?: string): EffectiveTaskAssignment[] {
  ensureDispatchTaskSheetAssignments()
  return listEffectiveTaskAssignments(taskId).filter((assignment) => assignment.status === 'EFFECTIVE')
}

export function getDispatchTaskSheetIdentity(assignment: EffectiveTaskAssignment) {
  const responsibility = getCurrentSewingTaskResponsibility(assignment.runtimeTaskId)
  const ppicId = responsibility?.ppicId || assignment.ppicId || ''
  const ppicName = responsibility?.ppicName || assignment.ppicName || ''
  const scope = assignment.skuLines.map((line) => `${line.skuCode}:${line.color}:${line.size}:${line.qty}`).sort()
  const version = dispatchTaskSheetFingerprint(JSON.stringify([assignment.factoryId, ppicId, scope, assignment.processCodes]))
  return {
    taskSheetNo: `RW-${dispatchTaskSheetFingerprint(assignment.assignmentId)}-${version}`,
    version, ppicId, ppicName,
  }
}

export function buildDispatchTaskSheetData(assignmentId: string) {
  ensureDispatchTaskSheetAssignments()
  const assignment = getEffectiveTaskAssignment(assignmentId)
  if (!assignment || assignment.status !== 'EFFECTIVE') throw new Error('任务尚未分配或该分配已失效，请打印当前有效任务单。')
  const runtime = getRuntimeTaskById(assignment.runtimeTaskId)
  const identity = getDispatchTaskSheetIdentity(assignment)
  const order = productionOrders.find((item) => item.productionOrderId === assignment.productionOrderId)
  const techPack = getProductionOrderTechPackSnapshot(assignment.productionOrderId)
  const codes = assignment.processCodes.map((code) => code.toUpperCase().replace(/^PROC_/, '')).map((code) => code === 'SEW' ? 'SEWING' : code)
  const sewing = codes.includes('SEWING')
  const cutting = codes.includes('CUTTING') || codes.includes('CUT')
  const iron = codes.includes('IRON_PACK')
  const supportsCutPieceHandover = sewing && !cutting && codes.every((code) => ['SEWING', 'IRON_PACK'].includes(code))
  const taskTypeLabel = sewing ? cutting ? '裁剪+车缝+烫包' : iron ? '车缝+烫包' : '独立车缝' : runtime?.processNameZh || codes.join('、')
  const taskContent = cutting && sewing
    ? '承接工厂自行裁剪，完成车缝、烫包及本任务冻结工艺要求。'
    : sewing && iron ? '完成车缝及烫包；开扣眼、装扣子按本任务技术资料执行。中台负责的特殊工艺由对应工厂完成。'
      : sewing ? '完成本次分配 SKU 的车缝加工；后续工序按各自任务执行。' : `完成本任务的${taskTypeLabel}加工要求。`
  const targetRoute = supportsCutPieceHandover
    ? `/fcs/pda/cutting/simple-cut-piece-handover?taskSheetNo=${encodeURIComponent(identity.taskSheetNo)}`
    : buildUnifiedPrintPreviewLink({ documentType: 'DISPATCH_TASK_SHEET', sourceType: 'EFFECTIVE_TASK_ASSIGNMENT', sourceId: assignmentId })
  return {
    assignment, runtime, order, techPack, ...identity,
    taskTypeLabel, taskContent, supportsCutPieceHandover,
    taskNo: assignment.taskNo || runtime?.taskNo || assignment.runtimeTaskId,
    productionOrderNo: assignment.productionOrderNo || assignment.productionOrderId,
    styleCode: techPack?.styleCode || order?.demandSnapshot.spuCode || '未维护款号',
    styleName: techPack?.styleName || order?.demandSnapshot.spuName || '未维护款式名称',
    styleImageUrl: techPack?.imageSnapshot.productImages[0] || techPack?.imageSnapshot.styleImages[0] || '',
    pickupObject: supportsCutPieceHandover ? '裁片' : sewing && cutting ? '面辅料' : '按任务加工对象',
    pickupLocation: supportsCutPieceHandover ? '裁床待交出仓' : sewing && cutting ? '面辅料仓；承接工厂自行裁剪' : '按任务指定交接地点',
    qrValue: buildPrintQrPayload({ documentType: 'DISPATCH_TASK_SHEET', sourceType: 'EFFECTIVE_TASK_ASSIGNMENT', sourceId: assignmentId,
      businessNo: identity.taskSheetNo, printVersionNo: identity.version, targetRoute }),
  }
}

export type DispatchTaskSheetData = ReturnType<typeof buildDispatchTaskSheetData>

export function parseDispatchTaskSheetCode(raw: string): string {
  const text = raw.trim()
  if (!text) throw new Error('请输入或扫描纸上的任务单号。')
  if (/^RW-[A-Z0-9]{7}-[A-Z0-9]{7}$/i.test(text)) return text.toUpperCase()
  try {
    const data = JSON.parse(text)
    if (data.documentType !== 'DISPATCH_TASK_SHEET' || data.sourceType !== 'EFFECTIVE_TASK_ASSIGNMENT') throw new Error()
    if (typeof data.businessNo === 'string' && /^RW-[A-Z0-9]{7}-[A-Z0-9]{7}$/i.test(data.businessNo)) return data.businessNo.toUpperCase()
  } catch { /* A production order, ticket or bag code is not a task sheet. */ }
  throw new Error('当前需要任务单条码或二维码，请核对纸上的“任务单号”。')
}

export function resolveDispatchTaskSheet(raw: string): DispatchTaskSheetData {
  const taskSheetNo = parseDispatchTaskSheetCode(raw)
  ensureDispatchTaskSheetAssignments()
  const identityPrefix = taskSheetNo.split('-')[1]
  const matches = listEffectiveTaskAssignments().filter((item) => dispatchTaskSheetFingerprint(item.assignmentId) === identityPrefix)
  if (matches.length !== 1) throw new Error(matches.length ? '任务单身份冲突，请联系计划人员重新核对。' : '未找到任务单，请核对纸上的任务单号。')
  const assignment = matches[0]
  if (assignment.status !== 'EFFECTIVE' || getDispatchTaskSheetIdentity(assignment).taskSheetNo !== taskSheetNo) {
    throw new Error('该任务单已失效，工厂或领取责任已调整，请使用当前有效任务单。')
  }
  return buildDispatchTaskSheetData(assignment.assignmentId)
}
