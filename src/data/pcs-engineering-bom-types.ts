export type EngineeringBomOperatorRole = '买手' | '跟单' | '版师' | '管理员'

export interface EngineeringBomMaterialLineDraft {
  materialSkuId: string
  usage: number
  sampleQuantity: number
  usageUnit: string
  lossRate: number
}

export interface EngineeringBomCustomCostDraft {
  title: string
  amountIdr: number
}

export interface EngineeringBomDraft {
  materialLines: EngineeringBomMaterialLineDraft[]
  customCosts: EngineeringBomCustomCostDraft[]
}

export interface EngineeringBomResolvedMaterialLine extends EngineeringBomMaterialLineDraft {
  materialCode: string
  materialSkuCode: string
  materialName: string
  pricingUnit: string
  conversionToPricingUnit: number
  standardUnitPriceCny: number | null
  standardUnitPriceCurrency: 'CNY'
  priceStatus: '有效' | '标准单价失效'
  materialCostCny: number | null
}

export interface EngineeringBomCostResult {
  materialCostCny: number
  customCostIdr: number
  comprehensiveCostCny: number
  comprehensiveCostIdr: number
  exchangeRateIdrPerCny: number
}

export interface EngineeringBomResolvedDraft {
  materialLines: EngineeringBomResolvedMaterialLine[]
  customCosts: Array<EngineeringBomCustomCostDraft & { currency: 'IDR' }>
  cost: EngineeringBomCostResult
}

export interface EngineeringBomPricingSnapshot {
  snapshotVersion: 1
  frozenAt: string
  frozenBy: string
  exchangeRateIdrPerCny: number
  exchangeRateSource: '系统最新汇率'
  materialLines: Array<EngineeringBomResolvedMaterialLine & { standardUnitPriceCny: number; materialCostCny: number }>
  customCosts: Array<EngineeringBomCustomCostDraft & { currency: 'IDR' }>
  cost: EngineeringBomCostResult
}
