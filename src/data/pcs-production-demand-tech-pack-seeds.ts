import { productionDemands, type ProductionDemand } from './fcs/production-demands.ts'

export interface ProductionDemandTechPackSeed {
  demand: ProductionDemand
  seedIndex: number
  styleId: string
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'SPU'
}

export function buildDemandStyleId(spuCode: string): string {
  return `style_demand_${sanitizeKey(spuCode)}`
}

export function buildDemandTechnicalVersionId(spuCode: string): string {
  return `tdv_demand_${sanitizeKey(spuCode)}`
}

export function buildDemandTechnicalVersionCode(spuCode: string): string {
  return `TDV-DEMAND-${sanitizeKey(spuCode)}`
}

export function listProductionDemandTechPackSeeds(): ProductionDemandTechPackSeed[] {
  const bySpu = new Map<string, ProductionDemand>()
  productionDemands
    .filter((demand) => demand.techPackStatus === 'RELEASED' && Boolean(demand.techPackVersionLabel))
    .forEach((demand) => {
      const current = bySpu.get(demand.spuCode)
      if (!current) {
        bySpu.set(demand.spuCode, demand)
        return
      }
      if (current.demandStatus !== 'CONVERTED' && demand.demandStatus === 'CONVERTED') {
        bySpu.set(demand.spuCode, demand)
      }
    })

  return Array.from(bySpu.values())
    .sort((left, right) => left.spuCode.localeCompare(right.spuCode))
    .map((demand, seedIndex) => ({
      demand,
      seedIndex,
      styleId: buildDemandStyleId(demand.spuCode),
      technicalVersionId: buildDemandTechnicalVersionId(demand.spuCode),
      technicalVersionCode: buildDemandTechnicalVersionCode(demand.spuCode),
      versionLabel: demand.techPackVersionLabel,
    }))
}
