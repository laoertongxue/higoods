import type { centralPrintIncoming } from './print-model.ts'

type Incoming = ReturnType<typeof centralPrintIncoming>[number]

/** A roll code identifies a physical source line, not an order or a global roll. */
export function printIncomingRollMatches(rows: Incoming[], barcode: string) {
  const matching = rows.filter(row => row.line.rolls.some(roll => roll.barcode === barcode))
  const available = matching.filter(row => row.remainingRolls.some(roll => roll.barcode === barcode))
  return { available, received: matching.length > 0 && available.length === 0 }
}

/** Preserve source-line identities; several lines may belong to the same order. */
export function printIncomingSourceRows(rows: Incoming[], code: string) {
  return rows.filter(row => [row.source.id, row.source.documentNo, row.line.material.batchNo].includes(code))
}
