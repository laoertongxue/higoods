import { getFactoryActivePpicSnapshot } from './factory-master-store.ts'
import {
  getOnboardingPpicOptionById,
  type FactoryOnboardingPpicRole,
} from './factory-onboarding-ppic.ts'
import {
  initializeSewingSampleApprovalSuggestionForAssignment,
  resetSewingSampleApprovalSuggestionsForTests,
} from './sewing-sample-approval-suggestion.ts'
import {
  initializeSewingMaterialHandoverForAssignment,
  resetSewingMaterialHandoversForTests,
} from './sewing-material-handover.ts'

export type EffectiveAssignmentSource = 'DIRECT_DISPATCH' | 'TENDER_AWARD' | 'REASSIGNMENT'
export type EffectiveAssignmentStatus = 'EFFECTIVE' | 'SUPERSEDED' | 'CANCELLED'

export interface EffectiveTaskAssignmentSkuLine {
  skuCode: string
  color: string
  size: string
  qty: number
}

export interface EffectiveTaskAssignment {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo?: string
  taskNo?: string
  factoryId: string
  factoryName: string
  source: EffectiveAssignmentSource
  assignedQty: number
  skuLines: EffectiveTaskAssignmentSkuLine[]
  processCodes: string[]
  frozenPrice: number
  priceCurrency: string
  priceUnit: string
  businessAssignedAt: string
  operatedAt: string
  operatedBy: string
  allocationOperatorPpicId?: string
  allocationOperatorPpicName?: string
  allocationOperatorRole?: FactoryOnboardingPpicRole
  ppicId?: string
  ppicName?: string
  ppicPhone?: string
  ppicSnapshotAt?: string
  ppicSnapshotSource?: 'FACTORY_MASTER_AT_ASSIGNMENT'
  status: EffectiveAssignmentStatus
  supersededAt?: string
  supersededByAssignmentId?: string
  supersedeReason?: string
}

export interface EffectiveTaskAssignmentAuditLog {
  auditId: string
  assignmentId: string
  runtimeTaskId: string
  action: 'CREATED' | 'SUPERSEDED' | 'CANCELLED'
  detail: string
  operatedAt: string
  operatedBy: string
}

export interface CreateEffectiveTaskAssignmentInput extends Omit<EffectiveTaskAssignment, 'assignmentId' | 'status'> {
  assignmentId?: string
  replaceReason?: string
}

const assignments = new Map<string, EffectiveTaskAssignment>()
const currentAssignmentIdsByTask = new Map<string, string[]>()
const auditLogs: EffectiveTaskAssignmentAuditLog[] = []
let assignmentSeq = 0
let auditSeq = 0

function cloneAssignment(item: EffectiveTaskAssignment): EffectiveTaskAssignment {
  return {
    ...item,
    skuLines: item.skuLines.map((line) => ({ ...line })),
    processCodes: [...item.processCodes],
  }
}

function nextAssignmentId(runtimeTaskId: string): string {
  assignmentSeq += 1
  return `ASG-${runtimeTaskId.replace(/[^A-Za-z0-9]/g, '')}-${String(assignmentSeq).padStart(5, '0')}`
}

function appendAudit(
  assignment: EffectiveTaskAssignment,
  action: EffectiveTaskAssignmentAuditLog['action'],
  detail: string,
  operatedAt: string,
  operatedBy: string,
): void {
  auditSeq += 1
  auditLogs.push({
    auditId: `ASG-AUD-${String(auditSeq).padStart(6, '0')}`,
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    action,
    detail,
    operatedAt,
    operatedBy,
  })
}

function currentIds(runtimeTaskId: string): string[] {
  return [...(currentAssignmentIdsByTask.get(runtimeTaskId) ?? [])]
}

function assignmentRequiresPpic(processCodes: readonly string[]): boolean {
  return processCodes.some((code) => ['SEW', 'SEWING', 'PROC_SEW'].includes(code.trim().toUpperCase()))
}

export function createEffectiveTaskAssignment(input: CreateEffectiveTaskAssignmentInput): EffectiveTaskAssignment {
  if (!input.factoryId || !input.factoryName) throw new Error('必须确认具体加工厂后才能形成有效分配')
  if (!Number.isFinite(input.assignedQty) || input.assignedQty <= 0) throw new Error('分配数量必须大于0')
  if (!Number.isFinite(input.frozenPrice) || input.frozenPrice <= 0) throw new Error('派单价必须为大于0的有限数')
  if (input.skuLines.some((line) => !line.skuCode || !Number.isFinite(line.qty) || line.qty <= 0)) {
    throw new Error('分配明细必须按完整SKU记录且数量大于0')
  }

  const requiresPpic = assignmentRequiresPpic(input.processCodes)
  const allocationOperator = requiresPpic
    ? getOnboardingPpicOptionById(input.allocationOperatorPpicId?.trim() || '')
    : null
  if (requiresPpic && (
    !allocationOperator
    || allocationOperator.status !== '启用'
    || !['MEMBER', 'TEAM_LEADER'].includes(allocationOperator.role)
    || allocationOperator.ppicName !== input.allocationOperatorPpicName?.trim()
  )) {
    throw new Error('含车缝任务只能由当前登录的有效PPIC分配，必须记录真实PPIC人员身份。')
  }
  if (allocationOperator && input.operatedBy.trim() !== allocationOperator.ppicName) {
    throw new Error('车缝任务分配操作人与当前登录PPIC身份不一致。')
  }

  const assignmentId = input.assignmentId || nextAssignmentId(input.runtimeTaskId)
  if (assignments.has(assignmentId)) throw new Error(`分配记录${assignmentId}已存在`)
  const factoryPpic = requiresPpic
    ? getFactoryActivePpicSnapshot(input.factoryId)
    : null
  if (requiresPpic && !factoryPpic) {
    throw new Error(`三方车缝工厂${input.factoryName}没有唯一有效PPIC，不能生成含车缝执行任务`)
  }

  const sameTaskCurrentIds = currentIds(input.runtimeTaskId)
  for (const currentId of sameTaskCurrentIds) {
    const current = assignments.get(currentId)
    if (!current || current.status !== 'EFFECTIVE') continue
    const sharesSku = current.skuLines.some((existingLine) => (
      input.skuLines.some((nextLine) => nextLine.skuCode === existingLine.skuCode)
    ))
    if (!sharesSku) continue
    const superseded: EffectiveTaskAssignment = {
      ...current,
      status: 'SUPERSEDED',
      supersededAt: input.operatedAt,
      supersededByAssignmentId: assignmentId,
      supersedeReason: input.replaceReason || '任务重新分配',
    }
    assignments.set(currentId, superseded)
    appendAudit(
      superseded,
      'SUPERSEDED',
      `${superseded.supersedeReason}；旧分配保留，不覆盖历史`,
      input.operatedAt,
      input.operatedBy,
    )
  }

  const record: EffectiveTaskAssignment = {
    ...input,
    assignmentId,
    allocationOperatorPpicId: allocationOperator?.ppicId,
    allocationOperatorPpicName: allocationOperator?.ppicName,
    allocationOperatorRole: allocationOperator?.role,
    ppicId: factoryPpic?.ppicId,
    ppicName: factoryPpic?.ppicName,
    ppicPhone: factoryPpic?.mobilePhone,
    ppicSnapshotAt: factoryPpic ? input.operatedAt : undefined,
    ppicSnapshotSource: factoryPpic ? 'FACTORY_MASTER_AT_ASSIGNMENT' : undefined,
    status: 'EFFECTIVE',
    skuLines: input.skuLines.map((line) => ({ ...line })),
    processCodes: [...input.processCodes],
  }
  assignments.set(assignmentId, record)
  currentAssignmentIdsByTask.set(input.runtimeTaskId, [
    ...sameTaskCurrentIds.filter((id) => assignments.get(id)?.status === 'EFFECTIVE'),
    assignmentId,
  ])
  appendAudit(
    record,
    'CREATED',
    `已冻结${record.priceCurrency} ${record.frozenPrice}/${record.priceUnit}${record.allocationOperatorPpicName ? `；分配操作人：${record.allocationOperatorPpicName}` : ''}${record.ppicName ? `；任务PPIC：${record.ppicName}` : ''}`,
    record.operatedAt,
    record.operatedBy,
  )
  initializeSewingSampleApprovalSuggestionForAssignment(record)
  initializeSewingMaterialHandoverForAssignment(record)
  return cloneAssignment(record)
}

export function cancelEffectiveTaskAssignment(
  assignmentId: string,
  reason: string,
  operatedBy: string,
  operatedAt: string,
): EffectiveTaskAssignment {
  const current = assignments.get(assignmentId)
  if (!current) throw new Error(`未找到分配记录${assignmentId}`)
  if (current.status !== 'EFFECTIVE') throw new Error('只有当前有效分配可以取消')
  const cancelled: EffectiveTaskAssignment = {
    ...current,
    status: 'CANCELLED',
    supersededAt: operatedAt,
    supersedeReason: reason,
  }
  assignments.set(assignmentId, cancelled)
  currentAssignmentIdsByTask.set(
    current.runtimeTaskId,
    currentIds(current.runtimeTaskId).filter((id) => id !== assignmentId),
  )
  appendAudit(cancelled, 'CANCELLED', reason, operatedAt, operatedBy)
  return cloneAssignment(cancelled)
}

export function supersedeEffectiveTaskAssignmentsForReassignment(input: {
  sourceRuntimeTaskId: string
  replacementAssignmentId: string
  reason: string
  operatedAt: string
  operatedBy: string
}): EffectiveTaskAssignment[] {
  const superseded: EffectiveTaskAssignment[] = []
  for (const assignmentId of currentIds(input.sourceRuntimeTaskId)) {
    const current = assignments.get(assignmentId)
    if (!current || current.status !== 'EFFECTIVE') continue
    const next: EffectiveTaskAssignment = {
      ...current,
      status: 'SUPERSEDED',
      supersededAt: input.operatedAt,
      supersededByAssignmentId: input.replacementAssignmentId,
      supersedeReason: input.reason,
    }
    assignments.set(assignmentId, next)
    appendAudit(next, 'SUPERSEDED', `${input.reason}；旧分配保留，不覆盖历史`, input.operatedAt, input.operatedBy)
    superseded.push(cloneAssignment(next))
  }
  currentAssignmentIdsByTask.set(input.sourceRuntimeTaskId, [])
  return superseded
}

export function listEffectiveTaskAssignments(runtimeTaskId?: string): EffectiveTaskAssignment[] {
  return [...assignments.values()]
    .filter((item) => !runtimeTaskId || item.runtimeTaskId === runtimeTaskId)
    .map(cloneAssignment)
}

export function listCurrentEffectiveTaskAssignments(runtimeTaskId: string): EffectiveTaskAssignment[] {
  return currentIds(runtimeTaskId)
    .map((id) => assignments.get(id))
    .filter((item): item is EffectiveTaskAssignment => Boolean(item && item.status === 'EFFECTIVE'))
    .map(cloneAssignment)
}

export function getEffectiveTaskAssignment(assignmentId: string): EffectiveTaskAssignment | undefined {
  const item = assignments.get(assignmentId)
  return item ? cloneAssignment(item) : undefined
}

export function listEffectiveTaskAssignmentAuditLogs(runtimeTaskId?: string): EffectiveTaskAssignmentAuditLog[] {
  return auditLogs
    .filter((item) => !runtimeTaskId || item.runtimeTaskId === runtimeTaskId)
    .map((item) => ({ ...item }))
}

export function resetEffectiveTaskAssignmentsForTests(): void {
  assignments.clear()
  currentAssignmentIdsByTask.clear()
  auditLogs.splice(0)
  assignmentSeq = 0
  auditSeq = 0
  resetSewingSampleApprovalSuggestionsForTests()
  resetSewingMaterialHandoversForTests()
}
