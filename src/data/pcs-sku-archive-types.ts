export type SkuArchiveStatusCode = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type SkuArchiveMappingHealth = 'OK' | 'MISSING' | 'CONFLICT'

export interface SkuArchiveRecord {
  skuId: string
  skuCode: string
  styleId: string
  styleCode: string
  styleName: string
  colorName: string
  sizeName: string
  printName: string
  barcode: string
  archiveStatus: SkuArchiveStatusCode
  mappingHealth: SkuArchiveMappingHealth
  channelMappingCount: number
  listedChannelCount: number
  techPackVersionId: string
  techPackVersionCode: string
  techPackVersionLabel: string
  legacySystem: string
  legacyCode: string
  weightText: string
  volumeText: string
  lastListingAt: string
  lastOrderAt: string
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
