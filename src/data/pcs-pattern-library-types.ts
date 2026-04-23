export type PatternParseStatus = 'pending' | 'parsing' | 'success' | 'failed' | 'manual_required'
export type PatternReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type PatternLifecycleStatus = 'active' | 'inactive' | 'archived'
export type PatternDuplicateStatus = 'unchecked' | 'suspected' | 'unique' | 'merged'
export type PatternLicenseStatus = 'unverified' | 'authorized' | 'restricted' | 'expired' | 'forbidden'
export type PatternTagSource = 'rule' | 'ai' | 'manual'
export type PatternReferenceType = 'flower_task' | 'project' | 'spu' | 'sku' | 'other'
export type PatternBlobKind = 'original' | 'preview' | 'thumbnail' | 'licenseAttachment'

export interface PatternFilenameToken {
  token: string
  normalized: string
  category: 'segment' | 'word' | 'code' | 'number' | 'color'
  score: number
}

export interface PatternCategoryLeaf {
  value: string
  label: string
}

export interface PatternCategoryNode {
  value: string
  label: string
  children: PatternCategoryLeaf[]
}

export interface PatternTagRecord {
  id: string
  pattern_asset_id: string
  pattern_file_version_id?: string
  tag_name: string
  tag_type: '主色系' | '花型使用方式' | '题材分类' | '题材一级分类' | '题材二级分类' | '风格标签' | '文件名Token'
  source: PatternTagSource
  confidence: number
  locked: boolean
}

export interface PatternReference {
  id: string
  pattern_asset_id: string
  ref_type: PatternReferenceType
  ref_id: string
  ref_name: string
  created_at: string
  last_referenced_at?: string
}

export interface PatternLicense {
  id: string
  pattern_asset_id: string
  license_status: PatternLicenseStatus
  copyright_owner?: string
  license_owner?: string
  license_scope?: string
  effective_at?: string
  expired_at?: string
  attachment_urls: string[]
  risk_note?: string
}

export interface PatternFileVersion {
  id: string
  pattern_asset_id: string
  version_no: string
  file_url?: string
  preview_url?: string
  thumbnail_url?: string
  original_blob_key?: string
  preview_blob_key?: string
  thumbnail_blob_key?: string
  file_ext: string
  mime_type?: string
  file_size: number
  image_width?: number
  image_height?: number
  aspect_ratio?: number
  color_mode?: string
  dpi_x?: number
  dpi_y?: number
  frame_count?: number
  has_alpha?: boolean
  sha256?: string
  phash?: string
  filename_tokens: PatternFilenameToken[]
  parse_result_json?: Record<string, unknown>
  is_current: boolean
  created_at: string
  parse_status: PatternParseStatus
  parse_error_message?: string
  original_filename: string
}

export interface PatternAsset {
  id: string
  pattern_code: string
  pattern_name: string
  original_filename: string
  aliases: string[]
  usage_type: string
  category: string
  category_primary?: string
  category_secondary?: string
  style_tags: string[]
  color_tags: string[]
  hot_flag: boolean
  source_type: string
  source_note?: string
  applicable_categories: string[]
  applicable_parts: string[]
  related_part_template_ids: string[]
  process_direction: string
  maintenance_status: '待补录' | '已维护' | '已治理'
  review_status: PatternReviewStatus
  lifecycle_status: PatternLifecycleStatus
  duplicate_status: PatternDuplicateStatus
  license_status: PatternLicenseStatus
  parse_status: PatternParseStatus
  source_task_id?: string
  source_task_code?: string
  source_task_type?: string
  source_task_name?: string
  source_project_id?: string
  source_tech_pack_version_id?: string
  source_tech_pack_version_code?: string
  buyer_review_status?: string
  difficulty_grade?: string
  assigned_team_code?: string
  assigned_team_name?: string
  assigned_member_id?: string
  assigned_member_name?: string
  archive_collected_flag?: boolean
  archive_collected_at?: string
  source_pattern_task_snapshot?: {
    demand_source_type?: string
    process_type?: string
    request_qty?: number
    fabric_sku?: string
    fabric_name?: string
    assigned_team_name?: string
    assigned_member_name?: string
    buyer_review_status?: string
  }
  reference_count: number
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  current_version_id?: string
  manual_review_conclusion?: string
  review_comment?: string
  ai_summary?: string
  parse_error_message?: string
}

export interface PatternAssetLog {
  id: string
  pattern_asset_id: string
  action: string
  operator: string
  created_at: string
  detail: string
}

export interface PatternLibraryConfig {
  usageTypes: string[]
  categories: string[]
  categoryTree: PatternCategoryNode[]
  styleTags: string[]
  primaryColors: string[]
  sourceTypes: string[]
  licenseStatuses: Array<{ value: PatternLicenseStatus; label: string }>
  namingRuleTemplate: string
  ruleToggles: {
    primaryColor: boolean
    usageType: boolean
    category: boolean
    filenameTokens: boolean
  }
  similarityThreshold: number
}

export interface PatternParsedFileResult {
  originalFilename: string
  fileExt: string
  mimeType: string
  fileSize: number
  imageWidth?: number
  imageHeight?: number
  aspectRatio?: number
  colorMode?: string
  dpiX?: number
  dpiY?: number
  frameCount?: number
  hasAlpha?: boolean
  sha256?: string
  phash?: string
  filenameTokens: PatternFilenameToken[]
  previewUrl?: string
  thumbnailUrl?: string
  originalBlob?: Blob
  previewBlob?: Blob
  thumbnailBlob?: Blob
  originalBlobKey?: string
  previewBlobKey?: string
  thumbnailBlobKey?: string
  parseStatus: PatternParseStatus
  parseErrorMessage?: string
  parseSummary: string
  dominantColors: string[]
  parseWarnings: string[]
  parseResultJson: Record<string, unknown>
}

export interface PatternSimilarityHit {
  assetId: string
  versionId: string
  duplicateType: 'sha256' | 'phash'
  similarity: number
  distance?: number
}

export interface PatternBlobRecord {
  key: string
  blob: Blob
  kind: PatternBlobKind
  created_at: string
}

export interface PatternLibraryStoreSnapshot {
  assets: PatternAsset[]
  versions: PatternFileVersion[]
  licenses: PatternLicense[]
  references: PatternReference[]
  tags: PatternTagRecord[]
  logs: PatternAssetLog[]
  config: PatternLibraryConfig
  sequence: number
}
