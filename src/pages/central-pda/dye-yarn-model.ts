import { isDyeYarnOrder, canSubmitDyeHandover, getDyeDispatchAvailableQty, getDyeDispatchPartner,
  getDyeDispatchMaterial, submitDyeHandover, getDyeYarnShipmentSources } from '../../data/fcs/dyeing-task-domain.ts'
import { getSourceActualReceipts, listFactoryReceipts } from '../../data/fcs/factory-receiving.ts'
import { calculateYarnWeight, assertYarnShipment, yarnGrossLimit, weightGrams, type YarnTubeCounts } from '../../data/fcs/yarn-weight.ts'
import { withWashingStaticRead } from '../../data/fcs/fabric-washing-storage-bridge.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { getCentralDyeFact, assertCentralDyeActor, runCentralDyeCommand } from './dye-model.ts'

export function centralDyeYarn(orderId: string, factoryId: string) {
  return withWashingStaticRead(() => {
    const fact = getCentralDyeFact(orderId, factoryId)
    if (!fact || !isDyeYarnOrder(fact.order)) return undefined
    const sources = getDyeYarnShipmentSources(orderId)
    const receipts = new Map(listFactoryReceipts().map(receipt => [receipt.id, receipt]))
    const records = sources.map(source => ({ source, receipts: getSourceActualReceipts(source.id).map(receipt => ({ ...receipt, receivedById: receipts.get(receipt.receiptId)?.operatorId || receipt.receivedBy })) }))
    const grossGrams = sources.reduce((sum, source) => sum + source.lines.reduce((n, line) => n + (line.yarn?.grossGrams || 0), 0), 0)
    const allowance = yarnGrossLimit(fact.order.yarnOrderedWeightKg ?? fact.order.plannedQty)
    return { fact, records, grossGrams, grossLeftGrams: allowance.limitGrams - grossGrams, allowance,
      availableNetKg: weightGrams(getDyeDispatchAvailableQty(orderId)) / 1000, material: getDyeDispatchMaterial(orderId),
      partner: getDyeDispatchPartner(orderId), canSend: canSubmitDyeHandover(fact.order), barcode: `YARN:${fact.order.dyeOrderNo}` }
  })
}
export type CentralDyeYarnInput = { grossKg: number; tubes: YarnTubeCounts }
export function prepareCentralDyeYarn(orderId: string, input: CentralDyeYarnInput, factoryId: string) {
  const state = centralDyeYarn(orderId, factoryId)
  if (!state || !state.canSend) throw new Error('YARN_notReady')
  if (state.partner.kind !== 'FACTORY') throw new Error('YARN_wrongTarget')
  const weight = calculateYarnWeight(input.grossKg, input.tubes)
  assertYarnShipment(state.fact.order.yarnOrderedWeightKg ?? state.fact.order.plannedQty, state.grossGrams, weight, state.availableNetKg)
  return { state, weight }
}
export async function saveCentralDyeYarn(orderId: string, input: CentralDyeYarnInput, actor: FactoryPdaUser, operationId: string, handedOverAt: string) {
  const intent = JSON.stringify({ action: 'yarn-send', orderId, actorId: actor.userId, input, handedOverAt })
  return runCentralDyeCommand(orderId, operationId, intent, () => {
    assertCentralDyeActor(orderId, actor)
    const { state, weight } = prepareCentralDyeYarn(orderId, input, actor.factoryId)
    return submitDyeHandover(orderId, { handoverPerson: actor.name, handoverAt: handedOverAt,
      yarn: { commandId: operationId, grossKg: weight.grossGrams / 1000, pcs: weight.pcs, tubes: weight.tubes, receiverFactoryId: state.partner.id } },
    { userId: actor.userId, name: actor.name, factoryId: actor.factoryId })
  })
}
