import { getWoolAllowedActions } from './queries.ts'
import {
  commitWoolStore,
  readWoolStore,
  type WoolDomainStore,
} from './store.ts'
import type {
  WoolMachine,
  WoolMachineAssociation,
  WoolMachineAssociationReason,
  WoolMachineAvailability,
  WoolMachineView,
} from './types.ts'

export interface WoolMachineActor {
  operatedAt: string
  operatedBy: string
}

export interface ChangeWoolMachineAvailabilityInput extends WoolMachineActor {
  nextStatus: WoolMachineAvailability
  reason: string
  confirmedImpact?: boolean
}

interface ReleaseWoolMachineAssociationsInput extends WoolMachineActor {
  reason: WoolMachineAssociationReason
  associationLogIdPrefix?: string
  operationLogId?: string
  operationAction?: string
  operationRemark?: string
  appendOperationLog?: boolean
}

interface ReleaseWoolMachineAssociationInput extends WoolMachineActor {
  reason: WoolMachineAssociationReason
  associationLogIdPrefix?: string
}

function requireText(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) throw new Error(`${label}不能为空`)
  return normalized
}

function requireOrder(store: WoolDomainStore, woolOrderId: string) {
  const order = store.workOrders[woolOrderId]
  if (!order) throw new Error(`找不到毛织加工单 ${woolOrderId}`)
  return order
}

function requireMachine(store: WoolDomainStore, machineId: string): WoolMachine {
  const machine = store.machines.find((item) => item.machineId === machineId)
  if (!machine) throw new Error(`找不到横机设备 ${machineId}`)
  return machine
}

function nextRecordId(
  existingIds: Iterable<string>,
  prefix: string,
): string {
  const occupied = new Set(existingIds)
  let sequence = 1
  let candidate = `${prefix}-${sequence}`
  while (occupied.has(candidate)) {
    sequence += 1
    candidate = `${prefix}-${sequence}`
  }
  return candidate
}

function machineStatus(
  store: WoolDomainStore,
  machine: WoolMachine,
): WoolMachineView['status'] {
  return store.machineAssociations.some((item) => item.machineId === machine.machineId)
    ? 'PRODUCING'
    : machine.status
}

function cloneCurrentMachineAssociations(
  store: WoolDomainStore,
  woolOrderId: string,
): WoolMachineAssociation[] {
  return store.machineAssociations
    .filter((item) => item.woolOrderId === woolOrderId)
    .map((association) => ({ ...association }))
    .sort((left, right) => left.machineId.localeCompare(right.machineId))
}

export function getWoolMachineById(machineId: string): WoolMachineView | undefined {
  const store = readWoolStore()
  const machine = store.machines.find((item) => item.machineId === machineId)
  return machine ? { ...machine, status: machineStatus(store, machine) } : undefined
}

export function listWoolMachineViews(): WoolMachineView[] {
  const store = readWoolStore()
  return store.machines
    .map((machine) => ({ ...machine, status: machineStatus(store, machine) }))
    .sort((left, right) => left.machineNo.localeCompare(right.machineNo, 'zh-CN'))
}

export function releaseWoolMachineAssociationsInDraft(
  draft: WoolDomainStore,
  woolOrderId: string,
  input: ReleaseWoolMachineAssociationsInput,
): string[] {
  requireOrder(draft, woolOrderId)
  const operatedBy = requireText(input.operatedBy, '操作人')
  const operatedAt = requireText(input.operatedAt, '操作时间')
  const released = draft.machineAssociations
    .filter((association) => association.woolOrderId === woolOrderId)
    .map((association) => association.machineId)
    .sort()
  if (released.length === 0) return released

  draft.machineAssociations = draft.machineAssociations.filter(
    (association) => association.woolOrderId !== woolOrderId,
  )
  for (const machineId of released) {
    const machine = requireMachine(draft, machineId)
    machine.updatedAt = operatedAt
    const defaultPrefix = `WMAL-${input.reason}-${machineId}`
    draft.machineAssociationLogs.push({
      logId: input.associationLogIdPrefix
        ? `${input.associationLogIdPrefix}-${machineId}`
        : nextRecordId(draft.machineAssociationLogs.map((item) => item.logId), defaultPrefix),
      machineId,
      fromWoolOrderId: woolOrderId,
      action: 'UNASSOCIATE',
      reason: input.reason,
      operatedAt,
      operatedBy,
    })
  }
  if (input.appendOperationLog !== false) {
    draft.operationLogs.push({
      operationLogId: input.operationLogId
        ?? nextRecordId(
          draft.operationLogs.map((item) => item.operationLogId),
          `WOOP-RELEASE-MACHINES-${woolOrderId}`,
        ),
      woolOrderId,
      action: input.operationAction ?? 'RELEASE_WOOL_MACHINES',
      objectType: 'WOOL_MACHINE_ASSOCIATIONS',
      objectId: woolOrderId,
      beforeValue: { machineIds: released },
      afterValue: { machineIds: [] },
      operatedAt,
      operatedBy,
      remark: input.operationRemark ?? '解除当前横机关联',
    })
  }
  return released
}

export function releaseWoolMachineAssociationInDraft(
  draft: WoolDomainStore,
  machineId: string,
  input: ReleaseWoolMachineAssociationInput,
) {
  const association = draft.machineAssociations.find((item) => item.machineId === machineId)
  if (!association) return undefined
  const operatedBy = requireText(input.operatedBy, '操作人')
  const operatedAt = requireText(input.operatedAt, '操作时间')
  const machine = requireMachine(draft, machineId)
  draft.machineAssociations = draft.machineAssociations.filter(
    (item) => item.machineId !== machineId,
  )
  machine.updatedAt = operatedAt
  draft.machineAssociationLogs.push({
    logId: input.associationLogIdPrefix
      ? `${input.associationLogIdPrefix}-${machineId}`
      : nextRecordId(
          draft.machineAssociationLogs.map((item) => item.logId),
          `WMAL-${input.reason}-${machineId}`,
        ),
    machineId,
    fromWoolOrderId: association.woolOrderId,
    action: 'UNASSOCIATE',
    reason: input.reason,
    operatedAt,
    operatedBy,
  })
  return association
}

export function replaceWoolMachineAssociations(
  woolOrderId: string,
  machineIds: string[],
  actor: WoolMachineActor,
): WoolMachineAssociation[] {
  const operatedAt = requireText(actor.operatedAt, '操作时间')
  const operatedBy = requireText(actor.operatedBy, '操作人')
  const store = readWoolStore()
  const order = requireOrder(store, woolOrderId)
  if (store.completions.some((item) => item.woolOrderId === woolOrderId)) {
    throw new Error(`毛织加工单 ${order.woolOrderNo} 已完成，不可关联横机`)
  }
  if (!getWoolAllowedActions(woolOrderId).includes('ASSOCIATE_MACHINE')) {
    throw new Error(`毛织加工单 ${order.woolOrderNo} 当前暂不可关联横机`)
  }

  const selectedMachineIds = [...new Set(machineIds.map((item) => item.trim()).filter(Boolean))]
    .sort()
  for (const machineId of selectedMachineIds) {
    const machine = requireMachine(store, machineId)
    if (machine.status === 'REPAIR' || machine.status === 'DISABLED') {
      throw new Error(`横机 ${machine.machineNo} 为维修或停用设备不可关联`)
    }
  }
  const currentForTarget = store.machineAssociations
    .filter((item) => item.woolOrderId === woolOrderId)
  const selected = new Set(selectedMachineIds)
  const hasRemoved = currentForTarget.some((item) => !selected.has(item.machineId))
  const hasAddedOrTransferred = selectedMachineIds.some((machineId) =>
    store.machineAssociations.find((item) => item.machineId === machineId)?.woolOrderId !== woolOrderId,
  )
  if (!hasRemoved && !hasAddedOrTransferred) {
    return cloneCurrentMachineAssociations(store, woolOrderId)
  }

  const committed = commitWoolStore((draft) => {
    const currentForTarget = draft.machineAssociations
      .filter((item) => item.woolOrderId === woolOrderId)
    const selected = new Set(selectedMachineIds)
    const removed = currentForTarget.filter((item) => !selected.has(item.machineId))
    const addedOrTransferred = selectedMachineIds
      .map((machineId) => ({
        machineId,
        current: draft.machineAssociations.find((item) => item.machineId === machineId),
      }))
      .filter(({ current }) => current?.woolOrderId !== woolOrderId)

    if (removed.length === 0 && addedOrTransferred.length === 0) {
      return
    }

    draft.machineAssociations = draft.machineAssociations.filter((association) =>
      !removed.some((item) => item.machineId === association.machineId)
      && !addedOrTransferred.some((item) => item.machineId === association.machineId),
    )
    for (const association of removed) {
      requireMachine(draft, association.machineId).updatedAt = operatedAt
      draft.machineAssociationLogs.push({
        logId: nextRecordId(
          draft.machineAssociationLogs.map((item) => item.logId),
          `WMAL-MANUAL-UNASSOCIATE-${association.machineId}`,
        ),
        machineId: association.machineId,
        fromWoolOrderId: woolOrderId,
        action: 'UNASSOCIATE',
        reason: 'MANUAL_SAVE',
        operatedAt,
        operatedBy,
      })
    }
    for (const { machineId, current } of addedOrTransferred) {
      requireMachine(draft, machineId).updatedAt = operatedAt
      draft.machineAssociations.push({
        machineId,
        woolOrderId,
        associatedAt: operatedAt,
        associatedBy: operatedBy,
      })
      draft.machineAssociationLogs.push({
        logId: nextRecordId(
          draft.machineAssociationLogs.map((item) => item.logId),
          `WMAL-MANUAL-${current ? 'TRANSFER' : 'ASSOCIATE'}-${machineId}`,
        ),
        machineId,
        ...(current ? { fromWoolOrderId: current.woolOrderId } : {}),
        toWoolOrderId: woolOrderId,
        action: current ? 'TRANSFER' : 'ASSOCIATE',
        reason: 'MANUAL_SAVE',
        operatedAt,
        operatedBy,
      })
    }
    draft.operationLogs.push({
      operationLogId: nextRecordId(
        draft.operationLogs.map((item) => item.operationLogId),
        `WOOP-REPLACE-MACHINES-${woolOrderId}`,
      ),
      woolOrderId,
      action: 'REPLACE_WOOL_MACHINE_ASSOCIATIONS',
      objectType: 'WOOL_MACHINE_ASSOCIATIONS',
      objectId: woolOrderId,
      beforeValue: { machineIds: currentForTarget.map((item) => item.machineId).sort() },
      afterValue: { machineIds: selectedMachineIds },
      operatedAt,
      operatedBy,
      remark: '保存横机当前关联整组最终真相',
    })
  })
  return cloneCurrentMachineAssociations(committed, woolOrderId)
}

export function changeWoolMachineAvailability(
  machineId: string,
  input: ChangeWoolMachineAvailabilityInput,
): WoolMachineView {
  const nextStatus = input.nextStatus as string
  if (!['IDLE', 'REPAIR', 'DISABLED'].includes(nextStatus)) {
    throw new Error('横机档案只允许改为空闲、维修或停用')
  }
  const reason = requireText(input.reason, '变更原因')
  const operatedAt = requireText(input.operatedAt, '操作时间')
  const operatedBy = requireText(input.operatedBy, '操作人')
  const store = readWoolStore()
  const machine = requireMachine(store, machineId)
  const association = store.machineAssociations.find((item) => item.machineId === machineId)
  if (!association && machine.status === nextStatus) {
    throw new Error('横机设备状态未变化')
  }
  if (
    !association
    && (machine.status === 'REPAIR' || machine.status === 'DISABLED')
    && nextStatus !== 'IDLE'
  ) {
    throw new Error('维修或停用设备只能恢复为空闲')
  }
  if (association && nextStatus === 'IDLE') {
    throw new Error('生产中设备不能直接改为空闲，请通过加工单解除当前关联')
  }
  if (
    association
    && (nextStatus === 'REPAIR' || nextStatus === 'DISABLED')
    && input.confirmedImpact !== true
  ) {
    throw new Error('生产中设备改为维修或停用前必须确认影响')
  }
  commitWoolStore((draft) => {
    const currentMachine = requireMachine(draft, machineId)
    const currentAssociation = draft.machineAssociations.find((item) => item.machineId === machineId)
    const beforeStatus = currentAssociation ? 'PRODUCING' : currentMachine.status
    if (currentAssociation) {
      releaseWoolMachineAssociationInDraft(draft, machineId, {
        reason: nextStatus === 'REPAIR' ? 'MACHINE_REPAIR' : 'MACHINE_DISABLED',
        operatedAt,
        operatedBy,
      })
    }
    currentMachine.status = nextStatus as WoolMachineAvailability
    currentMachine.updatedAt = operatedAt
    draft.operationLogs.push({
      operationLogId: nextRecordId(
        draft.operationLogs.map((item) => item.operationLogId),
        `WOOP-MACHINE-AVAILABILITY-${machineId}`,
      ),
      ...(currentAssociation ? { woolOrderId: currentAssociation.woolOrderId } : {}),
      action: 'CHANGE_WOOL_MACHINE_AVAILABILITY',
      objectType: 'WOOL_MACHINE',
      objectId: machineId,
      beforeValue: {
        status: beforeStatus,
        ...(currentAssociation ? { woolOrderId: currentAssociation.woolOrderId } : {}),
      },
      afterValue: { status: nextStatus },
      operatedAt,
      operatedBy,
      remark: reason,
    })
  })
  return getWoolMachineById(machineId)!
}
