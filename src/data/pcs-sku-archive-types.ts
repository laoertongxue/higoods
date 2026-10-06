import type { ArchiveApprovalStatus, ArchiveLifecycleStatus, ProductDeliveryMode, ProductArchiveLog, SalesBaseContent, ProductBundleComponent, ProductArchiveOrigin } from './pcs-product-archive-rules.ts'
export type SkuArchiveStatusCode = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type SkuArchiveMappingHealth = 'OK' | 'MISSING' | 'CONFLICT'
export interface ProductPackageSpec {
  packageSpecId: string
  ownerSkuId: string
  packageTypeId: string
  contentQty: number
  contentUnitId: string
  grossWeightKg: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  volumeM3: number | null
  measurementBasis: string
  version: number
  status: 'ACTIVE' | 'INACTIVE'
}

/** SKU 预计用料行：1 SKU → N 物料（物料 SKU）。设计 §5.1 / §3.1 */
export interface SkuExpectedMaterialLine {
  materialSkuId: string
  materialSkuCode: string
  materialName: string
  quantity: number
  unit: string
  note?: string
}

export interface SkuArchiveRecord extends ProductArchiveOrigin {
  approvalStatus?: ArchiveApprovalStatus
  lifecycleStatus?: ArchiveLifecycleStatus
  deliveryMode?: ProductDeliveryMode
  archiveLogs?: ProductArchiveLog[]
  recordVersion?: number
  colorId?: string
  sizeId?: string
  patternId?: string
  patternIdentityId?: string
  deliveryDifference?: string
  extraIdentityValues?: { deliveryDifference?: string }
  bundleComponents?: ProductBundleComponent[]
  compositionId?: string
  compositionVersion?: number
  packageQuantity?: number
  packageGrossWeightKg?: number
  packageSpecs?: ProductPackageSpec[]
  packageSpecHistory?: ProductPackageSpec[]
  identitySource?: 'MANUAL' | 'HISTORY'

  skuId: string
  skuCode: string
  styleId: string
  styleCode: string
  styleName: string
  skuName: string
  skuNameEn: string
  skuNameTranslations?: Partial<Record<'en' | 'id' | 'ms', string>>
  colorName: string
  sizeName: string
  printName: string
  barcode: string
  barcodeAliases?: string[]
  channelTitle: string
  skuImageUrl: string
  archiveStatus: SkuArchiveStatusCode
  mappingHealth: SkuArchiveMappingHealth
  channelMappingCount: number
  listedChannelCount: number
  techPackVersionId: string
  techPackVersionCode: string
  techPackVersionLabel: string
  legacySystem: string
  legacyCode: string
  costPrice: number
  freightCost: number
  suggestedRetailPrice: number
  currency: string
  pricingUnit: string
  mainUnitId?: string
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  packagingInfo: string
  weightText: string
  volumeText: string
  lastListingAt: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  remark: string
  /** 预计用料 1..N；采购链接不进 SKU 档案（ARCH-006/007）。 */
  expectedMaterials?: SkuExpectedMaterialLine[]
}

export interface SkuArchiveStoreSnapshot {
  version: number
  records: SkuArchiveRecord[]
}
