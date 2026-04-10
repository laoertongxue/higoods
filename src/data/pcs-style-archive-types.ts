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
  technicalDataStatus: string
  costPricingStatus: string
  specificationCount: number
  technicalVersionCount: number
  costVersionCount: number
  channelProductCount: number
  effectiveTechnicalVersionId: string
  effectiveTechnicalVersionCode: string
  effectiveTechnicalVersionLabel: string
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
