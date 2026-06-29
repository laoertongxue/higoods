import type { CutPieceOrderRecord } from '../../../data/fcs/cutting/cut-piece-orders.ts'
import { buildCuttingPickupViewFromCutPieceRecord } from './cutting-shared.ts'

export function buildCutPieceOrderPickupView(record: CutPieceOrderRecord) {
  return buildCuttingPickupViewFromCutPieceRecord(record)
}
