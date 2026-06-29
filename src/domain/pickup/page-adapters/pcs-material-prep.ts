import type { CuttingMaterialPrepGroup, CuttingMaterialPrepLine } from '../../../data/fcs/cutting/material-prep.ts'
import { buildCuttingPickupViewFromMaterialPrepLine } from './cutting-shared.ts'

export function buildMaterialPrepPickupView(line: CuttingMaterialPrepLine, group: Pick<CuttingMaterialPrepGroup, 'assignedFactoryName'>) {
  return buildCuttingPickupViewFromMaterialPrepLine(line, group)
}
