import { getDyeDocumentCompletion, completeDyeWorkOrderDocument } from '../../data/fcs/dyeing-task-domain.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import { assertCentralDyeActor, getCentralDyeFact, runCentralDyeCommand } from './dye-model.ts'

export function centralDyeCompletion(orderId: string, factoryId: string) {
  return withWashingStaticRead(() => getCentralDyeFact(orderId, factoryId) ? getDyeDocumentCompletion(orderId) : undefined)
}

export async function saveCentralDyeCompletion(orderId: string, actor: FactoryPdaUser,
  operationId: string, completedAt: string, expectedRevision: string) {
  const intent = JSON.stringify({ action: 'complete-document', orderId, actorId: actor.userId, completedAt, expectedRevision })
  return runCentralDyeCommand(orderId, operationId, intent, () => {
    assertCentralDyeActor(orderId, actor)
    const current = getDyeDocumentCompletion(orderId)
    if (current.revision !== expectedRevision) throw new Error('CHANGED')
    if (!current.ready) throw new Error('DYE_completionNotReady')
    const saved = completeDyeWorkOrderDocument(orderId, { completedAt }, { userId: actor.userId, name: actor.name, factoryId: actor.factoryId })
    return { orderId: saved.dyeOrderId, completedAt: saved.documentCompletedAt, completedByUserId: saved.documentCompletedByUserId }
  })
}
