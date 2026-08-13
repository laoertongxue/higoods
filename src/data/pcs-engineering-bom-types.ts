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

export type EngineeringBomOwnerStage =
  | 'INDEPENDENT_SAMPLING'
  | 'ENGINEERING_MASTER'
  | 'TECH_PACK_DRAFT'
  | 'ENGINEERING_CHANGE'

export interface EngineeringBomVersionRecord extends EngineeringBomDraft {
  bomDraftVersionId: string
  versionCode: string
  versionStatus: 'DRAFT' | 'COMPLETED_CONFIRMED' | 'PUBLISHED_SNAPSHOT'
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  ownerCode: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  productColor: string
  applicableSkuIds: string[]
  buyerId: string
  buyerName: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  editingLockedAt?: string
  editingLockedBy?: string
  editingLockedReason?: string
  publishedSnapshotId?: string
}

// 一张业务单据只有一份“BOM 与价格方案”：
// - 颜色物料仍由 EngineeringBomVersionRecord 分颜色维护；
// - 自定义费用统一保存在本记录中，只计算一次、只确认一次。
export type EngineeringBomPricingPlanStatus =
  | 'DRAFT'
  | 'HANDED_OFF'
  | 'COMPLETED_CONFIRMED'
  | 'PUBLISHED_SNAPSHOT'

export type EngineeringBomCustomCostDecision =
  | 'UNDECIDED'
  | 'NO_CUSTOM_COST'
  | 'HAS_CUSTOM_COST'

export interface EngineeringBomPricingPlanRecord {
  pricingPlanId: string
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  ownerCode: string
  styleId: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  status: EngineeringBomPricingPlanStatus
  customCostDecision: EngineeringBomCustomCostDecision
  customCosts: EngineeringBomCustomCostDraft[]
  buyerId: string
  buyerName: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  editingLockedAt?: string
  editingLockedBy?: string
  editingLockedReason?: string
  completedConfirmedAt?: string
  completedConfirmedBy?: string
  publishedSnapshotId?: string
}

export interface EngineeringBomVersionStoreSnapshot {
  version: number
  records: EngineeringBomVersionRecord[]
  plans: EngineeringBomPricingPlanRecord[]
}

export interface EngineeringBomResolvedPricingPlan {
  plan: EngineeringBomPricingPlanRecord
  versions: EngineeringBomVersionRecord[]
  resolved: EngineeringBomResolvedDraft
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
