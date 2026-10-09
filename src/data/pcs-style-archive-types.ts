import type { ArchiveApprovalStatus, ArchiveLifecycleStatus, ProductDeliveryMode, ProductArchiveLog, SalesBaseContent, ProductBundleComponent, ProductArchiveOrigin } from './pcs-product-archive-rules.ts'
import type { FlatDimensionId } from './pcs-config-dimensions.ts'
import type { StyleSizeChartDraft } from './pcs-style-size-chart.ts'
export type StyleArchiveStatusCode = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface StyleArchiveShellRecord extends ProductArchiveOrigin {
  approvalStatus?: ArchiveApprovalStatus
  lifecycleStatus?: ArchiveLifecycleStatus
  deliveryMode?: ProductDeliveryMode
  archiveLogs?: ProductArchiveLog[]
  recordVersion?: number
  sameStyleIds?: string[]
  substitutionRelations?: Array<{ id: string; targetKind: 'PRODUCT_SKU' | 'MATERIAL_SKU'; targetId: string; conditions: string; version: number }>
  salesContents?: SalesBaseContent[]
  salesCountrySettings?: string[]
  salesCountryDescriptions?: Record<string, string>
  factorySizeChartHtml?: string
  sizeChartDraft?: StyleSizeChartDraft
  legacyCodes?: string[]
  identitySource?: 'MANUAL' | 'HISTORY'

  buyerId?: string
  buyerName?: string
  productConfigRefs?: Partial<Record<FlatDimensionId, string[]>>
  productCategoryId?: string
  productInformationVersion?: number
  styleId: string
  styleCode: string
  styleName: string
  styleNameEn: string
  styleNameTranslations?: Partial<Record<'en' | 'id' | 'ms', string>>
  styleNumber: string
  thirdCategoryName?: string
  materialType?: string
  categoryTags?: string[]
  popularElementTags?: string[]
  fabricTags?: string[]
  ageTags?: string[]
  audiencePositionTags?: string[]
  categoryCode?: string
  categoryCodeName?: string
  productPosition?: string
  productType: string
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
  mainImageId: string
  mainImageUrl: string
  galleryImageIds: string[]
  galleryImageUrls: string[]
  galleryImagePurposes?: string[]
  imageSource: string
  sellingPointText: string
  detailDescription: string
  packagingInfo: string
  remark: string
  generatedAt: string
  generatedBy: string
  updatedAt: string
  updatedBy: string
  legacyOriginProject: string
  temporarySpuName?: string
  linkedDesignRevisionTaskIds?: string[]
  inheritedDesignFileIds?: string[]
  inheritedPatternFileIds?: string[]
  inheritedBomVersionIds?: string[]
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
