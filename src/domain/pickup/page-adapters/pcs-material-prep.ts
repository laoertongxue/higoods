import type { CuttingMaterialPrepGroup, CuttingMaterialPrepLine } from '../../../data/fcs/cutting/material-prep'
import { buildCuttingPickupViewFromMaterialPrepLine } from './cutting-shared'

export function buildMaterialPrepPickupView(line: CuttingMaterialPrepLine, group: Pick<CuttingMaterialPrepGroup, 'assignedFactoryName'>) {
  return buildCuttingPickupViewFromMaterialPrepLine(line, group)
}

