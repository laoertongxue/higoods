export type StyleArchiveStatusCode = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface StyleArchiveShellRecord {
  styleId: string
  styleCode: string
  styleName: string
  styleNumber: string
  styleType: string
  sourceProjectId: string
  sourceProjectCode: string
  sourceProjectName: string
  sourceProjectNodeId: string
  categoryId: string
  categoryName: string
  subCategoryId: string
  subCategoryName: string
  brandId: string
  brandName: string
  yearTag: string
  seasonTags: string[]
  styleTags: string[]
  targetAudienceTags: string[]
  targetChannelCodes: string[]
  priceRangeLabel: string
  archiveStatus: StyleArchiveStatusCode
  baseInfoStatus: string
  specificationStatus: string
  techPackStatus: string
  costPricingStatus: string
  specificationCount: number
  techPackVersionCount: number
  costVersionCount: number
  channelProductCount: number
  currentTechPackVersionId: string
  currentTechPackVersionCode: string
  currentTechPackVersionLabel: string
  currentTechPackVersionStatus: string
  currentTechPackVersionActivatedAt: string
  currentTechPackVersionActivatedBy: string
  remark: string
  generatedAt: string
  generatedBy: string
  updatedAt: string
  updatedBy: string
  legacyOriginProject: string
}

export interface StyleArchivePendingItem {
  pendingId: string
  rawStyleCode: string
  rawOriginProject: string
  reason: string
  discoveredAt: string
}

export interface StyleArchiveStoreSnapshot {
  version: number
  records: StyleArchiveShellRecord[]
  pendingItems: StyleArchivePendingItem[]
}

export interface StyleArchiveGenerateResult {
  ok: boolean
  existed: boolean
  message: string
  style: StyleArchiveShellRecord | null
}
