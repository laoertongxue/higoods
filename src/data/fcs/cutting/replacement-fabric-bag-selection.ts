import type { TransferBagTicketFactSnapshot } from './cutting-runtime-event-ledger.ts'
import { resolveReplacementFabricRuntimeTaskContext } from './replacement-fabric-source.ts'

/** 仅从本次选中的实物袋补入任务所需面料；选择不产生交出或占用事实。 */
export function replacementFabricCompanions(tickets: TransferBagTicketFactSnapshot[], input: {
  taskId: string; taskNo: string; factoryId: string; factoryName: string; productionOrderId: string
}): TransferBagTicketFactSnapshot[] {
  const candidates = tickets.filter(ticket => ['REPLACEMENT_FABRIC', 'BINDING_STRIP'].includes(ticket.ticketKind || '')
    && ticket.productionOrderId === input.productionOrderId
    && (!ticket.sewingTaskId || ticket.sewingTaskId === input.taskId)
    && (!ticket.receiverFactoryId || ticket.receiverFactoryId === input.factoryId))
  if (!candidates.length) return []
  const context = resolveReplacementFabricRuntimeTaskContext(input.taskId, input.factoryId)
  if (!context.inScope) return []
  if (context.issues.length) throw new Error(context.issues.join('；'))
  return candidates.filter(ticket => ticket.ticketKind === 'BINDING_STRIP' || context.requiredMaterials.some(material => material.key === ticket.materialKey))
    .map(ticket => ({ ...ticket, sewingTaskId: input.taskId, sewingTaskNo: input.taskNo,
      receiverFactoryId: input.factoryId, receiverFactoryName: input.factoryName }))
}
