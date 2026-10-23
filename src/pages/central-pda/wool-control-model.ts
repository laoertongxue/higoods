import { completeWoolWorkOrder, type CompleteWoolWorkOrderInput } from '../../data/fcs/wool-domain/commands.ts'
import { buildWoolMachineWorkbenchProjectionFromStore, captureWoolReplaceMachineAssociationSnapshotFromStore,
  replaceWoolMachineAssociations, type ReplaceWoolMachineAssociationsInput } from '../../data/fcs/wool-domain/machine-associations.ts'
import { runWoolRecordCommand } from '../../data/fcs/wool-domain/store.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import type { WoolCommandReceiptValue } from '../../data/fcs/wool-domain/types.ts'
import { assertCentralWoolActor, centralWoolFacts, centralWoolExecutionRows, prepareCentralWool } from './wool-model.ts'

export function centralWoolControlFacts(factoryId: string, woolOrderId: string) {
  const facts = centralWoolFacts(factoryId), row = centralWoolExecutionRows(facts, woolOrderId)[0]
  if (!row) throw Error('WOOL_actor')
  const machines = buildWoolMachineWorkbenchProjectionFromStore(facts.store).machines
  return { ...facts, row, machines,
    associated: facts.store.machineAssociations.filter(a => a.woolOrderId === woolOrderId),
    completion: facts.store.completions.find(c => c.woolOrderId === woolOrderId) }
}
export type CentralWoolControlFacts = ReturnType<typeof centralWoolControlFacts>
const ids = (values: readonly string[]) => [...new Set(values.map(v => v.trim()).filter(Boolean))].sort()
export function centralWoolMachineSource(f: CentralWoolControlFacts, selected: string[]) {
  const target = ids(selected)
  return JSON.stringify([f.row.order, f.row.completed, f.row.actions.includes('ASSOCIATE_MACHINE'),
    captureWoolReplaceMachineAssociationSnapshotFromStore(f.store, f.row.order.woolOrderId, target),
    f.machines.filter(m => target.includes(m.machineId)).map(m => [m.machineId, m.status, m.updatedAt])])
}
export function centralWoolMachineTransfers(f: CentralWoolControlFacts, selected: string[]) {
  return f.store.machineAssociations.filter(a => selected.includes(a.machineId) && a.woolOrderId !== f.row.order.woolOrderId)
    .map(association => ({ association, machine: f.machines.find(m => m.machineId === association.machineId)!,
      order: f.store.workOrders[association.woolOrderId] }))
}
export function centralWoolCompletionSource(f: CentralWoolControlFacts) {
  return JSON.stringify([f.row, f.store.handovers.filter(h => h.woolOrderId === f.row.order.woolOrderId), f.associated,
    f.machines.filter(m => f.associated.some(a => a.machineId === m.machineId))])
}
export interface CentralWoolCompletionRequest {
  kind: 'complete'; woolOrderId: string; actorId: string; expectedSource: string; input: CompleteWoolWorkOrderInput
}
export interface CentralWoolMachineRequest {
  kind: 'machines'; woolOrderId: string; actorId: string; expectedSource: string; machineIds: string[];
  transfersConfirmed: boolean; input: ReplaceWoolMachineAssociationsInput & { commandId: string }
}
export type CentralWoolControlRequest = CentralWoolCompletionRequest | CentralWoolMachineRequest
export function centralWoolCompletionRequest(f: CentralWoolControlFacts, actor: FactoryPdaUser, commandId: string, at: string): CentralWoolCompletionRequest {
  assertCentralWoolActor(actor)
  if (f.row.order.factoryId !== actor.factoryId) throw Error('WOOL_actor')
  if (f.row.completed || !f.row.actions.includes('COMPLETE')) throw Error('WCONTROL_completeBlocked')
  return { kind: 'complete', woolOrderId: f.row.order.woolOrderId, actorId: actor.userId,
    expectedSource: centralWoolCompletionSource(f), input: { commandId, completedAt: at, completedBy: actor.name } }
}
export function centralWoolMachineRequest(f: CentralWoolControlFacts, selected: string[], actor: FactoryPdaUser,
  commandId: string, at: string, transfersConfirmed = false): CentralWoolMachineRequest {
  assertCentralWoolActor(actor)
  if (f.row.order.factoryId !== actor.factoryId) throw Error('WOOL_actor')
  if (f.row.completed || f.row.order.stage !== 'KNITTING' || !f.row.actions.includes('ASSOCIATE_MACHINE')) throw Error('WCONTROL_machineBlocked')
  const machineIds = ids(selected)
  if (machineIds.some(id => !f.machines.some(m => m.machineId === id && (m.status === 'IDLE' || m.status === 'PRODUCING')))) throw Error('WCONTROL_machineUnavailable')
  if (centralWoolMachineTransfers(f, machineIds).length && !transfersConfirmed) throw Error('WCONTROL_transfer')
  return { kind: 'machines', woolOrderId: f.row.order.woolOrderId, actorId: actor.userId, machineIds, transfersConfirmed,
    expectedSource: centralWoolMachineSource(f, machineIds), input: { commandId, operatedAt: at, operatedBy: actor.name,
      expectedAssociationSnapshot: captureWoolReplaceMachineAssociationSnapshotFromStore(f.store, f.row.order.woolOrderId, machineIds) } }
}
export async function saveCentralWoolControl(request: CentralWoolControlRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || (request.kind === 'complete' ? request.input.completedBy : request.input.operatedBy) !== actor.name) throw Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const f = centralWoolControlFacts(actor.factoryId, request.woolOrderId)
    const retry = request.kind === 'complete'
      ? f.store.operationLogs.some(log => { const receipt = log.afterValue as WoolCommandReceiptValue | undefined
        return receipt?.commandId === request.input.commandId && receipt.commandType === 'COMPLETE_WOOL_WORK_ORDER' && receipt.targetId === request.woolOrderId })
      : f.store.operationLogs.some(log => log.operationLogId === `WOOP-REPLACE-MACHINES-CMD-${encodeURIComponent(request.input.commandId)}`)
    if (!retry) {
      if ((request.kind === 'complete' ? centralWoolCompletionSource(f) : centralWoolMachineSource(f, request.machineIds)) !== request.expectedSource) throw Error('WOOL_changed')
      if (request.kind === 'complete') centralWoolCompletionRequest(f, actor, request.input.commandId, request.input.completedAt)
      else {
        const current = centralWoolMachineRequest(f, request.machineIds, actor, request.input.commandId, request.input.operatedAt, request.transfersConfirmed)
        if (JSON.stringify(current.input.expectedAssociationSnapshot) !== JSON.stringify(request.input.expectedAssociationSnapshot)) throw Error('WOOL_changed')
      }
    }
    return request.kind === 'complete' ? completeWoolWorkOrder(request.woolOrderId, request.input)
      : replaceWoolMachineAssociations(request.woolOrderId, request.machineIds, request.input)
  }) } catch (error) {
    if (!(error as { committed?: boolean })?.committed && error instanceof Error
      && /记录已被其他页面修改|其他标签页已更新|关联已变化/.test(error.message)) throw Error('WOOL_changed', { cause: error })
    throw error
  }
}
