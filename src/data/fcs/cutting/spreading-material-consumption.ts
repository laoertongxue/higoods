import type { SpreadingSession } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { computeUsableLength } from './spreading-length.ts'
import { convertCuttingQuantity } from './cutting-quantity-unit.ts'

/** Roll measurements use the existing Web metre formula; issue/return facts retain their own unit. */
export function spreadingIssueConsumedQuantity(sessions: SpreadingSession[], issueEventId: string, unit: string): number {
  const rolls = sessions.flatMap(session => session.rolls || []).filter(roll => roll.sourceIssueEventId === issueEventId)
  if (rolls.some(roll => ![roll.actualLength, roll.headLength, roll.tailLength, roll.layerCount].every(value => Number.isFinite(value) && value >= 0)
    || !Number.isSafeInteger(roll.layerCount))) throw new Error('CUT_rollQuantity')
  const metres = rolls.reduce((sum, roll) => sum + computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength, roll.layerCount), 0)
  const quantity = convertCuttingQuantity(metres, '米', unit)
  if (quantity === null) throw new Error('CUT_unit')
  return Number(quantity.toFixed(2))
}
