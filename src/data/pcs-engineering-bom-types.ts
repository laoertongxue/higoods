export type EngineeringBomOperatorRole = '买手' | '跟单' | '版师' | '管理员'

export type EngineeringBomRequirementFlag = '是' | '否'

// BOM 驱动工程任务时只传递任务所需的物料事实；同一物料可在不同 BOM 行分别存在。
export interface EngineeringBomTaskLinkageRow {
  bomItemId: string
  materialSkuId?: string
  materialName?: string
  materialType?: string
  productColor?: string
  printRequirement?: EngineeringBomRequirementFlag
  printProcess?: string
  dyeRequirement?: EngineeringBomRequirementFlag
  pantoneColorCode?: string
  colorName?: string
  dyeColorCode?: string
  dyeFactoryName?: string
  purchaseRequirement?: EngineeringBomRequirementFlag
  shrinkRequirement?: EngineeringBomRequirementFlag
  washRequirement?: EngineeringBomRequirementFlag
  waterSolubleRequirement?: EngineeringBomRequirementFlag
}

export interface EngineeringBomMaterialLineDraft {
  bomItemId?: string
  materialSkuId: string
  sequenceNo?: number
  styleCode?: string
  productColor?: string
  materialType?: string
  materialImageUrl?: string
  specification?: string
  usage: number
  sampleQuantity: number
  usageUnit: string
  lossRate: number
  applicableSkuIds?: string[]
  printRequirement?: EngineeringBomRequirementFlag
  printRequirementText?: string
  dyeRequirement?: EngineeringBomRequirementFlag
  dyeRequirementText?: string
  purchaseRequirement?: EngineeringBomRequirementFlag
  shrinkRequirementText?: string
  washRequirementText?: string
  waterSolubleRequirementText?: string
  printSide?: '正面' | '反面' | '双面' | '无'
  frontPatternResultId?: string
  liningPatternResultId?: string
  linkedPatternResultIds?: string[]
  processCode?: string
  remark?: string
}

export interface EngineeringBomCustomCostDraft {
  customCostId?: string
  title: string
  amountIdr: number
  note?: string
  displayOrder?: number
  maintainedBy?: string
  maintainedAt?: string
}

export interface EngineeringBomDraft {
  bomDraftVersionId?: string
  versionStatus?: 'DRAFT' | 'COMPLETED_CONFIRMED' | 'PUBLISHED_SNAPSHOT'
  styleCode?: string
  productColor?: string
  applicableSkuIds?: string[]
  sourceVersionId?: string
  copiedAt?: string
  copiedBy?: string
  completedConfirmedAt?: string
  completedConfirmedBy?: string
  lineDiffs?: Array<{
    bomItemId: string
    changeType: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED'
    changedFields: string[]
  }>
  customCostDiffs?: Array<{
    customCostId: string
    changeType: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED'
    changedFields: string[]
  }>
  materialLines: EngineeringBomMaterialLineDraft[]
  customCosts: EngineeringBomCustomCostDraft[]
}

export interface EngineeringBomSkuScopeCatalog {
  styleCode: string
  colors: Array<{
    productColor: string
    skuIds: string[]
  }>
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
  totalRequirementQuantity: number
  technicalProcessSequence: Array<'水溶' | '染色'>
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

export interface EngineeringLinkedPartTemplateVersionSnapshot {
  partTemplateId: string
  templatePackageId: string
  templateName: string
  updatedAt: string
  geometryHash: string
  sourceDxfFileName: string
  sourceRulFileName: string
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
  // 正式启用时固化技术包本身、物料档案价格和关联部件模板，后续档案变化不回写。
  bomItems: TechnicalBomItem[]
  materialPriceSnapshots: Array<EngineeringBomResolvedMaterialLine & {
    bomItemId: string
    standardUnitPriceCny: number
    materialCostCny: number
  }>
  customCostsIdr: Array<EngineeringBomCustomCostDraft & { currency: 'IDR' }>
  materialCostCny: number
  comprehensiveCostCny: number
  comprehensiveCostIdr: number
  linkedPartTemplateVersions: EngineeringLinkedPartTemplateVersionSnapshot[]
}
import type { TechnicalBomItem } from './pcs-technical-data-version-types.ts'
