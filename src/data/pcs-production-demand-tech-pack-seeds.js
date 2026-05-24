import { productionDemands } from './fcs/production-demands.ts';
function sanitizeKey(value) {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'SPU';
}
export function buildDemandStyleId(spuCode) {
    return `style_demand_${sanitizeKey(spuCode)}`;
}
export function buildDemandTechnicalVersionId(spuCode) {
    return `tdv_demand_${sanitizeKey(spuCode)}`;
}
export function buildDemandTechnicalVersionCode(spuCode) {
    return `TDV-DEMAND-${sanitizeKey(spuCode)}`;
}
export function listProductionDemandTechPackSeeds() {
    const bySpu = new Map();
    productionDemands
        .filter((demand) => demand.techPackStatus === 'RELEASED' && Boolean(demand.techPackVersionLabel))
        .forEach((demand) => {
        const current = bySpu.get(demand.spuCode);
        if (!current) {
            bySpu.set(demand.spuCode, demand);
            return;
        }
        if (current.demandStatus !== 'CONVERTED' && demand.demandStatus === 'CONVERTED') {
            bySpu.set(demand.spuCode, demand);
        }
    });
    return Array.from(bySpu.values())
        .sort((left, right) => left.spuCode.localeCompare(right.spuCode))
        .map((demand, seedIndex) => ({
        demand,
        seedIndex,
        styleId: buildDemandStyleId(demand.spuCode),
        technicalVersionId: buildDemandTechnicalVersionId(demand.spuCode),
        technicalVersionCode: buildDemandTechnicalVersionCode(demand.spuCode),
        versionLabel: demand.techPackVersionLabel,
    }));
}
