export type SkuArchiveStatusCode = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type SkuArchiveMappingHealth = 'OK' | 'MISSING' | 'CONFLICT'

/** SKU 预计用料行：1 SKU → N 物料（物料 SKU）。设计 §5.1 / §3.1 */
export interface SkuExpectedMaterialLine {
  materialSkuId: string
  materialSkuCode: string
  materialName: string
  quantity: number
  unit: string
  note?: string
}

export interface SkuArchiveRecord {
  skuId: string
  skuCode: string
  styleId: string
  styleCode: string
  styleName: string
  skuName: string
  skuNameEn: string
  colorName: string
  sizeName: string
  printName: string
  barcode: string
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
