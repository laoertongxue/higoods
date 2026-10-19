import { listProductionDemandDemoSeeds, type ProductionDemand } from './fcs/production-demands.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from './fcs/post-finishing-production-source-fixtures.ts'
import { ACCESSORY_WAREHOUSE_DEMOS } from './wls/accessory-warehouse-demo.ts'

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
  const postFinishingSpus = new Set<string>(POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.map((source) => source.spuCode))
  // 辅料仓样本已有随生产单冻结的完整技术包，只作为 FCS 上游输入。
  // 不能再派生另一套 PCS 技术包并挤占既有静态数字身份。
  const accessoryDemandIds = new Set(ACCESSORY_WAREHOUSE_DEMOS.map(fixture => fixture.demand.demandId))
  const bySpu = new Map<string, ProductionDemand>()
  listProductionDemandDemoSeeds()
    .filter((demand) => !accessoryDemandIds.has(demand.demandId) && demand.techPackStatus === 'RELEASED' && Boolean(demand.techPackVersionLabel))
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
    // 后补的后道样本排在既有样本之后，避免改变原有 seedIndex 及其工艺/物料演示分配。
    .sort((left, right) => Number(postFinishingSpus.has(left.spuCode)) - Number(postFinishingSpus.has(right.spuCode)) || left.spuCode.localeCompare(right.spuCode))
    .map((demand, seedIndex) => ({
      demand,
      seedIndex,
      styleId: buildDemandStyleId(demand.spuCode),
      technicalVersionId: buildDemandTechnicalVersionId(demand.spuCode),
      technicalVersionCode: buildDemandTechnicalVersionCode(demand.spuCode),
      versionLabel: demand.techPackVersionLabel,
    }))
}
