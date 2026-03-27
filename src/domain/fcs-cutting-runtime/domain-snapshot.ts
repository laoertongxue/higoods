import { readCuttingRuntimeInputs } from '../../data/fcs/cutting/runtime-inputs.ts'
import { buildCuttingCoreRegistry } from '../cutting-core/index.ts'
import type { CuttingDomainSnapshot, CuttingRuntimeInputs } from './types.ts'

export function buildFcsCuttingDomainSnapshot(
  inputs: CuttingRuntimeInputs = readCuttingRuntimeInputs(),
): CuttingDomainSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    registry: buildCuttingCoreRegistry(),
    ...inputs,
  }
}
