import type { CutPieceOrderRecord } from '../../../data/fcs/cutting/cut-piece-orders'
import { buildCuttingPickupViewFromCutPieceRecord } from './cutting-shared'

export function buildCutPieceOrderPickupView(record: CutPieceOrderRecord) {
  return buildCuttingPickupViewFromCutPieceRecord(record)
}

