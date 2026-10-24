import { canContinueDyeWaterSoluble, executeCentralDyeWaterSoluble, type DyeWaterSolublePauseDecision } from '../../data/fcs/dyeing-task-domain.ts'
import { readFactoryPdaExecutionUsers, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { getCentralDyeFact, assertCentralDyeActor, runCentralDyeCommand } from './dye-model.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'

export function centralDyeWater(orderId: string, factoryId: string) {
  if (!orderId) return undefined
  return withFactoryProcessStaticRead(() => {
  const fact = getCentralDyeFact(orderId, factoryId)
  if (!fact?.order.requiresWaterSoluble) return undefined
  const order = fact.order, node = fact.nodes.find(node => node.nodeCode === 'WATER_SOLUBLE')
  const archived = order.completedWaterSolubleBatches || [], batch = archived.length
  const previousInput = archived.reduce((sum, node) => sum + (node.inputQty || 0), 0)
  const previousOutput = archived.reduce((sum, node) => sum + (node.outputQty || 0), 0)
  const continued = canContinueDyeWaterSoluble(order)
  const received = order.materialReceipts ? order.materialReceipts.reduce((sum, row) => sum + row.qty, 0)
    : fact.nodes.find(node => node.nodeCode === 'INPUT_RECEIVED')?.outputQty || 0
  const availableInput = Math.max(0, received - previousInput - (continued ? node?.inputQty || 0 : 0))
  const phase = order.status === 'PRODUCTION_PAUSED' ? 'PAUSE' : order.status === 'WATER_SOLUBLE_IN_PROGRESS' ? 'COMPLETE'
    : order.status === 'WAIT_WATER_SOLUBLE' || continued ? 'START' : undefined
  const revision = JSON.stringify([order.status, order.taskId, batch, order.waterSolubleCompletedQty, received,
    node, archived.map(row => [row.nodeRecordId, row.inputQty, row.outputQty, row.finishedAt]), order.waterSolublePauseHistory])
  return { fact, node, archived, batch, batchNo: batch + (continued ? 2 : 1), phase, revision, availableInput, previousOutput,
    currentMinimum: Math.max(0, (order.waterSolubleCompletedQty || 0) - previousOutput),
    unit: order.waterSolubleQtyUnit || node?.qtyUnit || order.qtyUnit,
    planned: order.waterSolublePlannedQty ?? order.plannedQty,
    mandatory: ['WAIT_WATER_SOLUBLE', 'WATER_SOLUBLE_IN_PROGRESS', 'PRODUCTION_PAUSED'].includes(order.status),
  }
  })
}
export type CentralDyeWaterInput = { action: 'START' | 'COMPLETE' | 'RESOLVE_PAUSE'; outputQty?: number; reason?: string; decision?: DyeWaterSolublePauseDecision }
export async function saveCentralDyeWater(orderId: string, input: CentralDyeWaterInput, actor: FactoryPdaUser,
  operationId: string, expectedRevision: string) {
  const intent = JSON.stringify({ action: 'water-node', orderId, input, actorId: actor.userId, expectedRevision })
  return runCentralDyeCommand(orderId, operationId, intent, () => {
    assertCentralDyeActor(orderId, actor)
    const user = readFactoryPdaExecutionUsers(actor.factoryId).find(user => user.userId === actor.userId)
    if (!user || user.status !== 'ACTIVE' || user.name !== actor.name || user.loginId !== actor.loginId) throw new Error('DYE_wrongActor')
    const current = centralDyeWater(orderId, actor.factoryId)
    if (!current || current.revision !== expectedRevision || current.phase !== (input.action === 'RESOLVE_PAUSE' ? 'PAUSE' : input.action)) throw new Error('CHANGED')
    return executeCentralDyeWaterSoluble({ dyeOrderId: orderId, expectedStatus: current.fact.order.status, expectedBatch: current.batch,
      ...input, actor: { userId: actor.userId, name: actor.name, factoryId: actor.factoryId } })
  })
}
