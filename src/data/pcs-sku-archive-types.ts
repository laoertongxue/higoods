export type SkuArchiveStatusCode = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type SkuArchiveMappingHealth = 'OK' | 'MISSING' | 'CONFLICT'

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
}

export interface SkuArchiveStoreSnapshot {
  version: number
  records: SkuArchiveRecord[]
}
