import { readCuttingRuntimeInputs } from '../../data/fcs/cutting/runtime-inputs.ts';
import { buildCuttingCoreRegistry } from '../cutting-core/index.ts';
export function buildFcsCuttingDomainSnapshot(inputs = readCuttingRuntimeInputs()) {
    return {
        generatedAt: new Date().toISOString(),
        registry: buildCuttingCoreRegistry(),
        ...inputs,
    };
}
