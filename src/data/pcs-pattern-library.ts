import type {
  PatternAsset,
  PatternAssetLog,
  PatternCategoryNode,
  PatternDuplicateStatus,
  PatternFileVersion,
  PatternFilenameToken,
  PatternLibraryConfig,
  PatternLicense,
  PatternLicenseStatus,
  PatternParsedFileResult,
  PatternReference,
  PatternReviewStatus,
  PatternSimilarityHit,
  PatternTagRecord,
  PatternLibraryStoreSnapshot,
} from './pcs-pattern-library-types.ts'

import {
  DEFAULT_PATTERN_CATEGORY_TREE,
  PatternTagService,
  buildPatternCategoryPath,
  canPatternBeReferenced,
  clonePatternCategoryTree,
  getPatternCategoryPrimaryOptions,
  getPatternCategorySecondaryOptions,
  getPatternSimilarityHit,
  inferDuplicateStatus,
  tokenizePatternFilename,
} from '../utils/pcs-pattern-library-services.ts'
import {
  listProjectWorkspaceCategories,
  listProjectWorkspaceColors,
  listProjectWorkspaceStyles,
} from './pcs-project-config-workspace-adapter.ts'
import { patternRepo } from './pcs-pattern-library-repository.ts'

export interface PatternAssetRecord extends PatternAsset {
  currentVersion: PatternFileVersion | null
  license: PatternLicense | null
  tags: PatternTagRecord[]
  references: PatternReference[]
  logs: PatternAssetLog[]
  lastReferencedAt?: string
}

export interface PatternDuplicateCandidate {
  asset: PatternAssetRecord
  version: PatternFileVersion
  hit: PatternSimilarityHit
}

export interface PatternAssetDraftInput {
  patternName: string
  aliases: string[]
  usageType: string
  category?: string
  categoryPrimary?: string
  categorySecondary?: string
  styleTags: string[]
  colorTags: string[]
  hotFlag: boolean
  sourceType: string
  sourceNote?: string
  applicableCategories: string[]
  applicableParts: string[]
  relatedPartTemplateIds: string[]
  processDirection: string
  maintenanceStatus: PatternAsset['maintenance_status']
  manualReviewConclusion?: string
  reviewComment?: string
  sourceTaskId?: string
  sourceProjectId?: string
  sourcePatternTaskSnapshot?: PatternAsset['source_pattern_task_snapshot']
  createdBy: string
  submitForReview: boolean
  parsedFile: PatternParsedFileResult
  license: Omit<PatternLicense, 'id' | 'pattern_asset_id'>
  duplicateAction?: 'merge' | 'new-version' | 'force-new'
  duplicateTargetAssetId?: string
}

export interface PatternAssetBatchUpdate {
  ids: string[]
  maintenanceStatus?: PatternAsset['maintenance_status']
  reviewStatus?: PatternReviewStatus
  lifecycleStatus?: PatternAsset['lifecycle_status']
  updatedBy: string
}

const APP_RENDER_EVENT = 'higood:request-render'

const DEFAULT_CATEGORY_TREE = clonePatternCategoryTree(DEFAULT_PATTERN_CATEGORY_TREE)

const LEGACY_CATEGORY_MIGRATION_MAP: Record<string, { primary?: string; secondary?: string }> = {
  花卉: { primary: '植物与花卉' },
  条纹: { primary: '几何与抽象', secondary: '几何图形' },
  格纹: { primary: '几何与抽象', secondary: '几何图形' },
  动物: { primary: '动物纹理' },
  几何: { primary: '几何与抽象', secondary: '几何图形' },
  字母: { primary: '字母与文字' },
  卡通: { primary: '卡通与动漫' },
  抽象: { primary: '几何与抽象', secondary: '抽象艺术' },
  纯色: { primary: '几何与抽象' },
}

function getWorkspaceStyleTags(): string[] {
  const tags = listProjectWorkspaceStyles()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return tags.length > 0 ? tags : ['休闲']
}

function getWorkspacePrimaryColors(): string[] {
  const colors = listProjectWorkspaceColors()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return colors.length > 0 ? colors : ['Black', 'White']
}

function getWorkspaceApplicableCategories(): string[] {
  const categories = listProjectWorkspaceCategories()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return categories.length > 0 ? categories : ['上衣', '连衣裙']
}

const DEFAULT_CONFIG: PatternLibraryConfig = {
  usageTypes: ['重复花', '定位花', '边条花', '满印', '纯色肌理'],
  categories: getPatternCategoryPrimaryOptions(DEFAULT_CATEGORY_TREE),
  categoryTree: DEFAULT_CATEGORY_TREE,
  styleTags: getWorkspaceStyleTags(),
  primaryColors: getWorkspacePrimaryColors(),
  sourceTypes: ['自研', '客供', '历史沉淀', '外采'],
  licenseStatuses: [
    { value: 'unverified', label: '未确认' },
    { value: 'authorized', label: '已授权' },
    { value: 'restricted', label: '限制使用' },
    { value: 'expired', label: '已过期' },
    { value: 'forbidden', label: '禁止使用' },
  ],
  namingRuleTemplate: 'HX-{yyyyMMdd}-{seq4}',
  ruleToggles: {
    primaryColor: true,
    usageType: true,
    category: true,
    filenameTokens: true,
  },
  similarityThreshold: 12,
}

const SOURCE_TASK_INDEX: Record<string, { name: string; projectId: string; projectName: string }> = {
  'AT-20260109-001': { name: '花型-印尼碎花连衣裙（定位印 A1）', projectId: 'PRJ-20251216-001', projectName: '印尼风格碎花连衣裙' },
  'AT-20260109-002': { name: '花型-波西米亚风长裙（满印）', projectId: 'PRJ-20251218-002', projectName: '波西米亚风长裙' },
  'AT-20260108-003': { name: '花型-民族风刺绣上衣（绣花）', projectId: 'PRJ-20251215-003', projectName: '民族风刺绣上衣' },
}

let memoryStore: PatternLibraryStoreSnapshot | null = null
let hydrationStarted = false
let persistPromise: Promise<void> = Promise.resolve()

function cloneStore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneCategoryTree(tree: PatternCategoryNode[]): PatternCategoryNode[] {
  return clonePatternCategoryTree(tree)
}

function normalizePatternLibraryConfig(config?: Partial<PatternLibraryConfig>): PatternLibraryConfig {
  const categoryTree = cloneCategoryTree(config?.categoryTree?.length ? config.categoryTree : DEFAULT_CATEGORY_TREE)
  return {
    ...DEFAULT_CONFIG,
    ...config,
    categories: getPatternCategoryPrimaryOptions(categoryTree),
    categoryTree,
    styleTags: getWorkspaceStyleTags(),
    primaryColors: getWorkspacePrimaryColors(),
    ruleToggles: {
      ...DEFAULT_CONFIG.ruleToggles,
      ...config?.ruleToggles,
    },
  }
}

function inferCategoryFromLegacy(category?: string): { primary?: string; secondary?: string } {
  if (!category) return {}
  return LEGACY_CATEGORY_MIGRATION_MAP[category] ?? { primary: category }
}

function getAssetCategorySelection(asset: Pick<PatternAsset, 'category' | 'category_primary' | 'category_secondary'>): {
  primary?: string
  secondary?: string
} {
  const migrated = asset.category_primary || asset.category_secondary
    ? { primary: asset.category_primary, secondary: asset.category_secondary }
    : inferCategoryFromLegacy(asset.category)
  return {
    primary: migrated.primary,
    secondary: migrated.secondary,
  }
}

function migrateStoreSnapshot(store: PatternLibraryStoreSnapshot): { store: PatternLibraryStoreSnapshot; migrated: boolean } {
  let migrated = false
  const nextStore = cloneStore(store)
  nextStore.config = normalizePatternLibraryConfig(nextStore.config)
  if (
    nextStore.config.categories.join('|') !== (store.config?.categories ?? []).join('|')
    || JSON.stringify(nextStore.config.categoryTree) !== JSON.stringify(store.config?.categoryTree ?? [])
  ) {
    migrated = true
  }

  nextStore.assets = nextStore.assets.map((asset) => {
    const selection = getAssetCategorySelection(asset)
    const normalizedCategory = selection.primary || asset.category || ''
    const changed =
      asset.category !== normalizedCategory
      || asset.category_primary !== selection.primary
      || asset.category_secondary !== selection.secondary

    if (!changed) return asset
    migrated = true
    return {
      ...asset,
      category: normalizedCategory,
      category_primary: selection.primary,
      category_secondary: selection.secondary,
    }
  })

  return { store: nextStore, migrated }
}

function resolveDraftCategory(draft: Pick<PatternAssetDraftInput, 'category' | 'categoryPrimary' | 'categorySecondary'>): {
  primary: string
  secondary?: string
} {
  const migrated = draft.categoryPrimary || draft.categorySecondary
    ? { primary: draft.categoryPrimary, secondary: draft.categorySecondary }
    : inferCategoryFromLegacy(draft.category)
  return {
    primary: migrated.primary || '',
    secondary: migrated.secondary || undefined,
  }
}

function createSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function buildPreviewSvg(kind: 'flower' | 'stripe' | 'check' | 'panel' | 'texture', palette: string[]): string {
  const [primary, secondary, accent = primary] = palette
  if (kind === 'flower') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
        <rect width="480" height="480" fill="${secondary}"/>
        <g opacity="0.9">
          <circle cx="140" cy="140" r="72" fill="${primary}"/>
          <circle cx="230" cy="110" r="58" fill="${accent}"/>
          <circle cx="210" cy="210" r="68" fill="${primary}"/>
          <circle cx="320" cy="190" r="60" fill="${accent}"/>
          <path d="M110 320 C160 270 260 270 330 340" stroke="#3d7d3d" stroke-width="18" fill="none"/>
        </g>
      </svg>
    `
  }
  if (kind === 'stripe') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
        <rect width="480" height="480" fill="${secondary}"/>
        <rect x="0" y="0" width="80" height="480" fill="${primary}"/>
        <rect x="120" y="0" width="80" height="480" fill="${accent}"/>
        <rect x="240" y="0" width="80" height="480" fill="${primary}"/>
        <rect x="360" y="0" width="80" height="480" fill="${accent}"/>
      </svg>
    `
  }
  if (kind === 'check') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
        <rect width="480" height="480" fill="${secondary}"/>
        <g fill="${primary}" opacity="0.72">
          <rect x="0" y="0" width="120" height="120"/>
          <rect x="240" y="0" width="120" height="120"/>
          <rect x="120" y="120" width="120" height="120"/>
          <rect x="360" y="120" width="120" height="120"/>
          <rect x="0" y="240" width="120" height="120"/>
          <rect x="240" y="240" width="120" height="120"/>
          <rect x="120" y="360" width="120" height="120"/>
          <rect x="360" y="360" width="120" height="120"/>
        </g>
      </svg>
    `
  }
  if (kind === 'panel') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640">
        <rect width="480" height="640" fill="${secondary}"/>
        <rect x="70" y="70" width="340" height="500" rx="18" fill="white" stroke="${accent}" stroke-width="8"/>
        <circle cx="240" cy="250" r="90" fill="${primary}" opacity="0.9"/>
        <path d="M160 400 Q240 320 320 400" stroke="${accent}" stroke-width="14" fill="none"/>
      </svg>
    `
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
      <defs>
        <pattern id="noise" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="${secondary}"/>
          <circle cx="10" cy="12" r="4" fill="${primary}" opacity="0.55"/>
          <circle cx="26" cy="18" r="5" fill="${accent}" opacity="0.45"/>
          <circle cx="18" cy="30" r="4" fill="${primary}" opacity="0.35"/>
        </pattern>
      </defs>
      <rect width="480" height="480" fill="url(#noise)"/>
    </svg>
  `
}

function nowIso(): string {
  return new Date().toISOString()
}

function getTodayCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}${month}${day}`
}

function buildPatternCode(sequence: number): string {
  return `HX-${getTodayCode()}-${String(sequence).padStart(4, '0')}`
}

function nextId(prefix: string, store: PatternLibraryStoreSnapshot): string {
  store.sequence += 1
  return `${prefix}_${String(store.sequence).padStart(5, '0')}`
}

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_RENDER_EVENT))
  }
}

function seedStore(): PatternLibraryStoreSnapshot {
  const createdAt = '2026-03-28T09:20:00.000Z'
  const updatedAt = '2026-04-06T11:10:00.000Z'

  const assets: PatternAsset[] = [
    {
      id: 'pattern_asset_0001',
      pattern_code: 'HX-20260328-0001',
      pattern_name: '印尼热带花卉 A1',
      original_filename: 'Tropical-Flower-A1.png',
      aliases: ['热带大花 A1', 'Bunga Tropis A1'],
      usage_type: '定位花',
      category: '花卉',
      category_primary: '植物与花卉',
      category_secondary: '写实花卉',
      style_tags: ['度假', '法式'],
      color_tags: ['红色', '绿色'],
      hot_flag: true,
      source_type: '自研',
      source_note: '来源于 2026 夏季度假裙项目',
      applicable_categories: ['连衣裙', '衬衫'],
      applicable_parts: ['前片', '后片'],
      related_part_template_ids: ['pkg_001-part_001'],
      process_direction: '印花',
      maintenance_status: '已维护',
      review_status: 'approved',
      lifecycle_status: 'active',
      duplicate_status: 'unique',
      license_status: 'authorized',
      parse_status: 'success',
      source_task_id: 'AT-20260109-001',
      source_project_id: 'PRJ-20251216-001',
      reference_count: 3,
      created_by: '林小美',
      updated_by: '林小美',
      created_at: createdAt,
      updated_at: updatedAt,
      current_version_id: 'pattern_version_0001',
      manual_review_conclusion: '可作为定位印标准花型沉淀',
      review_comment: '定位构图清晰，可正式复用',
      ai_summary: '主色偏红绿，构图集中，建议定位花使用。',
    },
    {
      id: 'pattern_asset_0002',
      pattern_code: 'HX-20260329-0002',
      pattern_name: '都市细条纹 Navy',
      original_filename: 'Urban-Stripe-Navy.jpg',
      aliases: ['细条纹蓝', '商务条纹'],
      usage_type: '重复花',
      category: '条纹',
      category_primary: '几何与抽象',
      category_secondary: '几何图形',
      style_tags: ['通勤', '极简'],
      color_tags: ['蓝色', '白色'],
      hot_flag: false,
      source_type: '历史沉淀',
      source_note: '历史衬衫图库迁移',
      applicable_categories: ['衬衫', '西装'],
      applicable_parts: ['全身'],
      related_part_template_ids: [],
      process_direction: '印花',
      maintenance_status: '待补录',
      review_status: 'draft',
      lifecycle_status: 'active',
      duplicate_status: 'unchecked',
      license_status: 'unverified',
      parse_status: 'manual_required',
      source_project_id: 'PRJ-20251218-002',
      reference_count: 1,
      created_by: '王设计',
      updated_by: '王设计',
      created_at: '2026-03-29T10:00:00.000Z',
      updated_at: '2026-04-05T16:22:00.000Z',
      current_version_id: 'pattern_version_0002',
    },
    {
      id: 'pattern_asset_0003',
      pattern_code: 'HX-20260330-0003',
      pattern_name: '复古格纹 C3',
      original_filename: 'Retro-Check-C3.png',
      aliases: ['格纹 C3'],
      usage_type: '重复花',
      category: '格纹',
      category_primary: '几何与抽象',
      category_secondary: '几何图形',
      style_tags: ['复古', '通勤'],
      color_tags: ['绿色', '灰色'],
      hot_flag: true,
      source_type: '外采',
      source_note: '供应商季中补充',
      applicable_categories: ['套装', '半裙'],
      applicable_parts: ['全身'],
      related_part_template_ids: [],
      process_direction: '印花',
      maintenance_status: '已治理',
      review_status: 'pending',
      lifecycle_status: 'active',
      duplicate_status: 'suspected',
      license_status: 'restricted',
      parse_status: 'success',
      reference_count: 2,
      created_by: '张设计',
      updated_by: '审核专员',
      created_at: '2026-03-30T08:10:00.000Z',
      updated_at: '2026-04-07T09:12:00.000Z',
      current_version_id: 'pattern_version_0003',
      review_comment: '需确认与历史格纹素材是否重复',
    },
    {
      id: 'pattern_asset_0004',
      pattern_code: 'HX-20260331-0004',
      pattern_name: '卡通熊定位花 B2',
      original_filename: 'Panel-Bear-B2.tif',
      aliases: ['熊头版片', '版片熊 B2'],
      usage_type: '定位花',
      category: '卡通',
      category_primary: '卡通与动漫',
      category_secondary: '经典卡通',
      style_tags: ['甜美'],
      color_tags: ['粉色', '白色'],
      hot_flag: false,
      source_type: '客供',
      source_note: '客户提供定位版片',
      applicable_categories: ['卫衣', 'T恤'],
      applicable_parts: ['前片'],
      related_part_template_ids: [],
      process_direction: '印花',
      maintenance_status: '已维护',
      review_status: 'rejected',
      lifecycle_status: 'inactive',
      duplicate_status: 'unique',
      license_status: 'forbidden',
      parse_status: 'failed',
      reference_count: 0,
      created_by: '陈买手',
      updated_by: '审核专员',
      created_at: '2026-03-31T14:20:00.000Z',
      updated_at: '2026-04-03T11:48:00.000Z',
      current_version_id: 'pattern_version_0004',
      review_comment: '授权范围不清，暂不允许使用',
    },
    {
      id: 'pattern_asset_0005',
      pattern_code: 'HX-20260401-0005',
      pattern_name: '米杏肌理底纹',
      original_filename: 'Texture-Beige-S1.jpeg',
      aliases: ['杏色底纹'],
      usage_type: '纯色肌理',
      category: '纯色',
      category_primary: '几何与抽象',
      category_secondary: '肌理背景',
      style_tags: ['极简'],
      color_tags: ['综合色'],
      hot_flag: false,
      source_type: '自研',
      source_note: '用于西装内里与衬衫底纹',
      applicable_categories: ['西装', '衬衫'],
      applicable_parts: ['全身'],
      related_part_template_ids: [],
      process_direction: '其他',
      maintenance_status: '已维护',
      review_status: 'approved',
      lifecycle_status: 'archived',
      duplicate_status: 'unique',
      license_status: 'authorized',
      parse_status: 'success',
      reference_count: 5,
      created_by: '林小美',
      updated_by: '档案管理员',
      created_at: '2026-04-01T12:00:00.000Z',
      updated_at: '2026-04-06T18:30:00.000Z',
      current_version_id: 'pattern_version_0005',
    },
  ]

  const versions: PatternFileVersion[] = [
    {
      id: 'pattern_version_0001',
      pattern_asset_id: 'pattern_asset_0001',
      version_no: 'V3',
      file_ext: 'png',
      mime_type: 'image/png',
      file_size: 148032,
      image_width: 1800,
      image_height: 2400,
      aspect_ratio: 0.75,
      color_mode: 'RGB',
      dpi_x: 300,
      dpi_y: 300,
      frame_count: 1,
      has_alpha: false,
      sha256: 'seed_sha_flower_v3',
      phash: '101010001111000011110000111100001111000010101010101010101111000',
      filename_tokens: tokenizePatternFilename('Tropical-Flower-A1.png'),
      parse_result_json: { parseSummary: 'PNG 文件，1800 x 2400，300 DPI' },
      is_current: true,
      created_at: updatedAt,
      parse_status: 'success',
      original_filename: 'Tropical-Flower-A1.png',
      file_url: createSvgDataUrl(buildPreviewSvg('flower', ['#d43f5e', '#f9f1d9', '#f09a3e'])),
      preview_url: createSvgDataUrl(buildPreviewSvg('flower', ['#d43f5e', '#f9f1d9', '#f09a3e'])),
      thumbnail_url: createSvgDataUrl(buildPreviewSvg('flower', ['#d43f5e', '#f9f1d9', '#f09a3e'])),
    },
    {
      id: 'pattern_version_0002',
      pattern_asset_id: 'pattern_asset_0002',
      version_no: 'V1',
      file_ext: 'jpg',
      mime_type: 'image/jpeg',
      file_size: 98220,
      image_width: 2400,
      image_height: 2400,
      aspect_ratio: 1,
      color_mode: 'RGB',
      dpi_x: 144,
      dpi_y: 144,
      frame_count: 1,
      has_alpha: false,
      sha256: 'seed_sha_stripe_v1',
      phash: '101000001010000010100000101000001010000010100000101000001010000',
      filename_tokens: tokenizePatternFilename('Urban-Stripe-Navy.jpg'),
      parse_result_json: { parseSummary: 'JPG 文件，2400 x 2400，144 DPI' },
      is_current: true,
      created_at: '2026-04-05T16:22:00.000Z',
      parse_status: 'manual_required',
      original_filename: 'Urban-Stripe-Navy.jpg',
      file_url: createSvgDataUrl(buildPreviewSvg('stripe', ['#223d71', '#f5f7fb', '#577eb8'])),
      preview_url: createSvgDataUrl(buildPreviewSvg('stripe', ['#223d71', '#f5f7fb', '#577eb8'])),
      thumbnail_url: createSvgDataUrl(buildPreviewSvg('stripe', ['#223d71', '#f5f7fb', '#577eb8'])),
    },
    {
      id: 'pattern_version_0003',
      pattern_asset_id: 'pattern_asset_0003',
      version_no: 'V2',
      file_ext: 'png',
      mime_type: 'image/png',
      file_size: 120044,
      image_width: 2048,
      image_height: 2048,
      aspect_ratio: 1,
      color_mode: 'RGB',
      dpi_x: 300,
      dpi_y: 300,
      frame_count: 1,
      has_alpha: false,
      sha256: 'seed_sha_check_v2',
      phash: '111100001111000000001111000011110000111100001111000000001111000',
      filename_tokens: tokenizePatternFilename('Retro-Check-C3.png'),
      parse_result_json: { parseSummary: 'PNG 文件，2048 x 2048，300 DPI' },
      is_current: true,
      created_at: '2026-04-07T09:12:00.000Z',
      parse_status: 'success',
      original_filename: 'Retro-Check-C3.png',
      file_url: createSvgDataUrl(buildPreviewSvg('check', ['#5c7d62', '#f2efe8', '#8e9a91'])),
      preview_url: createSvgDataUrl(buildPreviewSvg('check', ['#5c7d62', '#f2efe8', '#8e9a91'])),
      thumbnail_url: createSvgDataUrl(buildPreviewSvg('check', ['#5c7d62', '#f2efe8', '#8e9a91'])),
    },
    {
      id: 'pattern_version_0004',
      pattern_asset_id: 'pattern_asset_0004',
      version_no: 'V1',
      file_ext: 'tif',
      mime_type: 'image/tiff',
      file_size: 284220,
      image_width: 1200,
      image_height: 1800,
      aspect_ratio: 0.6667,
      color_mode: 'RGB',
      dpi_x: 150,
      dpi_y: 150,
      frame_count: 2,
      has_alpha: false,
      sha256: 'seed_sha_panel_v1',
      phash: '000011110000111100001111000011110000000011110000111100001111000',
      filename_tokens: tokenizePatternFilename('Panel-Bear-B2.tif'),
      parse_result_json: { parseSummary: 'TIF 文件，1200 x 1800，150 DPI，共 2 页' },
      is_current: true,
      created_at: '2026-03-31T14:20:00.000Z',
      parse_status: 'failed',
      original_filename: 'Panel-Bear-B2.tif',
      file_url: createSvgDataUrl(buildPreviewSvg('panel', ['#ef7f96', '#f7f0f6', '#b06b7d'])),
      preview_url: createSvgDataUrl(buildPreviewSvg('panel', ['#ef7f96', '#f7f0f6', '#b06b7d'])),
      thumbnail_url: createSvgDataUrl(buildPreviewSvg('panel', ['#ef7f96', '#f7f0f6', '#b06b7d'])),
    },
    {
      id: 'pattern_version_0005',
      pattern_asset_id: 'pattern_asset_0005',
      version_no: 'V4',
      file_ext: 'jpeg',
      mime_type: 'image/jpeg',
      file_size: 76444,
      image_width: 1600,
      image_height: 1600,
      aspect_ratio: 1,
      color_mode: 'RGB',
      dpi_x: 96,
      dpi_y: 96,
      frame_count: 1,
      has_alpha: false,
      sha256: 'seed_sha_texture_v4',
      phash: '010101010101010100001111000011110101010101010101000011110000111',
      filename_tokens: tokenizePatternFilename('Texture-Beige-S1.jpeg'),
      parse_result_json: { parseSummary: 'JPEG 文件，1600 x 1600，96 DPI' },
      is_current: true,
      created_at: '2026-04-06T18:30:00.000Z',
      parse_status: 'success',
      original_filename: 'Texture-Beige-S1.jpeg',
      file_url: createSvgDataUrl(buildPreviewSvg('texture', ['#bda78e', '#efe3d3', '#d8c7ac'])),
      preview_url: createSvgDataUrl(buildPreviewSvg('texture', ['#bda78e', '#efe3d3', '#d8c7ac'])),
      thumbnail_url: createSvgDataUrl(buildPreviewSvg('texture', ['#bda78e', '#efe3d3', '#d8c7ac'])),
    },
  ]

  const licenses: PatternLicense[] = [
    {
      id: 'pattern_license_0001',
      pattern_asset_id: 'pattern_asset_0001',
      license_status: 'authorized',
      copyright_owner: 'HiGood Studio',
      license_owner: 'HiGood 品牌事业部',
      license_scope: '女装成衣印花，线上线下渠道',
      effective_at: '2026-01-01',
      expired_at: '2027-12-31',
      attachment_urls: ['授权函-热带花卉-A1.pdf'],
      risk_note: '授权齐全，可长期复用',
    },
    {
      id: 'pattern_license_0002',
      pattern_asset_id: 'pattern_asset_0002',
      license_status: 'unverified',
      attachment_urls: [],
      risk_note: '历史图档迁移，待补录授权信息',
    },
    {
      id: 'pattern_license_0003',
      pattern_asset_id: 'pattern_asset_0003',
      license_status: 'restricted',
      license_owner: '外部供应商',
      license_scope: '仅限 2026 秋季波段使用',
      effective_at: '2026-03-01',
      expired_at: '2026-09-30',
      attachment_urls: ['供应商授权-格纹-C3.pdf'],
      risk_note: '超期后禁止新增引用',
    },
    {
      id: 'pattern_license_0004',
      pattern_asset_id: 'pattern_asset_0004',
      license_status: 'forbidden',
      attachment_urls: [],
      risk_note: '客户未确认版权，禁止使用',
    },
    {
      id: 'pattern_license_0005',
      pattern_asset_id: 'pattern_asset_0005',
      license_status: 'authorized',
      license_owner: 'HiGood Studio',
      license_scope: '基础纹理库通用',
      effective_at: '2026-01-01',
      expired_at: '2027-12-31',
      attachment_urls: [],
      risk_note: '仅限内部商品使用',
    },
  ]

  const references: PatternReference[] = [
    { id: 'pattern_ref_0001', pattern_asset_id: 'pattern_asset_0001', ref_type: 'flower_task', ref_id: 'AT-20260109-001', ref_name: '花型任务-印尼碎花连衣裙', created_at: '2026-04-02T09:00:00.000Z', last_referenced_at: '2026-04-06T10:08:00.000Z' },
    { id: 'pattern_ref_0002', pattern_asset_id: 'pattern_asset_0001', ref_type: 'project', ref_id: 'PRJ-20251216-001', ref_name: '印尼风格碎花连衣裙', created_at: '2026-04-02T09:20:00.000Z', last_referenced_at: '2026-04-06T10:08:00.000Z' },
    { id: 'pattern_ref_0003', pattern_asset_id: 'pattern_asset_0001', ref_type: 'spu', ref_id: 'SPU-001', ref_name: '印尼碎花连衣裙', created_at: '2026-04-05T14:10:00.000Z', last_referenced_at: '2026-04-06T10:08:00.000Z' },
    { id: 'pattern_ref_0004', pattern_asset_id: 'pattern_asset_0002', ref_type: 'flower_task', ref_id: 'AT-20260109-002', ref_name: '花型任务-波西米亚风长裙', created_at: '2026-04-05T10:00:00.000Z', last_referenced_at: '2026-04-05T10:00:00.000Z' },
    { id: 'pattern_ref_0005', pattern_asset_id: 'pattern_asset_0003', ref_type: 'project', ref_id: 'PRJ-20251218-002', ref_name: '波西米亚风长裙', created_at: '2026-04-07T08:10:00.000Z', last_referenced_at: '2026-04-07T08:10:00.000Z' },
    { id: 'pattern_ref_0006', pattern_asset_id: 'pattern_asset_0005', ref_type: 'sku', ref_id: 'SKU-7761', ref_name: '米杏西装外套', created_at: '2026-04-04T18:20:00.000Z', last_referenced_at: '2026-04-06T18:20:00.000Z' },
  ]

  const tags: PatternTagRecord[] = [
    { id: 'pattern_tag_0001', pattern_asset_id: 'pattern_asset_0001', pattern_file_version_id: 'pattern_version_0001', tag_name: '红色', tag_type: '主色系', source: 'rule', confidence: 0.96, locked: false },
    { id: 'pattern_tag_0002', pattern_asset_id: 'pattern_asset_0001', pattern_file_version_id: 'pattern_version_0001', tag_name: '定位花', tag_type: '花型使用方式', source: 'rule', confidence: 0.9, locked: true },
    { id: 'pattern_tag_0003', pattern_asset_id: 'pattern_asset_0001', pattern_file_version_id: 'pattern_version_0001', tag_name: '植物与花卉', tag_type: '题材一级分类', source: 'rule', confidence: 0.86, locked: true },
    { id: 'pattern_tag_0010', pattern_asset_id: 'pattern_asset_0001', pattern_file_version_id: 'pattern_version_0001', tag_name: '写实花卉', tag_type: '题材二级分类', source: 'rule', confidence: 0.8, locked: true },
    { id: 'pattern_tag_0004', pattern_asset_id: 'pattern_asset_0001', pattern_file_version_id: 'pattern_version_0001', tag_name: '度假', tag_type: '风格标签', source: 'manual', confidence: 1, locked: true },
    { id: 'pattern_tag_0005', pattern_asset_id: 'pattern_asset_0002', pattern_file_version_id: 'pattern_version_0002', tag_name: '蓝色', tag_type: '主色系', source: 'rule', confidence: 0.84, locked: false },
    { id: 'pattern_tag_0006', pattern_asset_id: 'pattern_asset_0002', pattern_file_version_id: 'pattern_version_0002', tag_name: 'Urban', tag_type: '文件名Token', source: 'rule', confidence: 0.74, locked: false },
    { id: 'pattern_tag_0007', pattern_asset_id: 'pattern_asset_0003', pattern_file_version_id: 'pattern_version_0003', tag_name: '几何与抽象', tag_type: '题材一级分类', source: 'rule', confidence: 0.92, locked: true },
    { id: 'pattern_tag_0011', pattern_asset_id: 'pattern_asset_0003', pattern_file_version_id: 'pattern_version_0003', tag_name: '几何图形', tag_type: '题材二级分类', source: 'rule', confidence: 0.86, locked: true },
    { id: 'pattern_tag_0008', pattern_asset_id: 'pattern_asset_0003', pattern_file_version_id: 'pattern_version_0003', tag_name: '复古', tag_type: '风格标签', source: 'manual', confidence: 1, locked: true },
    { id: 'pattern_tag_0009', pattern_asset_id: 'pattern_asset_0005', pattern_file_version_id: 'pattern_version_0005', tag_name: '纯色肌理', tag_type: '花型使用方式', source: 'rule', confidence: 0.88, locked: true },
  ]

  const logs: PatternAssetLog[] = [
    { id: 'pattern_log_0001', pattern_asset_id: 'pattern_asset_0001', action: '新建', operator: '林小美', created_at: createdAt, detail: '花型主档已创建，来源于花型任务沉淀。' },
    { id: 'pattern_log_0002', pattern_asset_id: 'pattern_asset_0001', action: '自动解析结果', operator: '系统', created_at: '2026-04-06T11:10:00.000Z', detail: '识别为 PNG 300 DPI，建议标签：红色 / 花卉 / 定位花。' },
    { id: 'pattern_log_0003', pattern_asset_id: 'pattern_asset_0001', action: '审核通过', operator: '审核专员', created_at: '2026-04-06T12:30:00.000Z', detail: '审核通过，允许正式引用。' },
    { id: 'pattern_log_0004', pattern_asset_id: 'pattern_asset_0003', action: '疑似重复检测', operator: '系统', created_at: '2026-04-07T09:12:00.000Z', detail: 'pHash 命中历史格纹图档，等待人工确认。' },
    { id: 'pattern_log_0005', pattern_asset_id: 'pattern_asset_0004', action: '审核驳回', operator: '审核专员', created_at: '2026-04-03T11:48:00.000Z', detail: '授权不清晰，驳回并停用。' },
    { id: 'pattern_log_0006', pattern_asset_id: 'pattern_asset_0005', action: '归档', operator: '档案管理员', created_at: '2026-04-06T18:30:00.000Z', detail: '该纹理已由新版本替代，归档保留。' },
  ]

  return {
    assets,
    versions,
    licenses,
    references,
    tags,
    logs,
    config: normalizePatternLibraryConfig(DEFAULT_CONFIG),
    sequence: 200,
  }
}

function ensureHydration(): void {
  if (hydrationStarted) return
  hydrationStarted = true
  void patternRepo.loadStore()
    .then((stored) => {
      if (stored) {
        const migrated = migrateStoreSnapshot(stored)
        memoryStore = cloneStore(migrated.store)
        if (migrated.migrated) {
          persistPromise = patternRepo.saveStore(migrated.store).catch(() => {
            // ignore
          })
        }
      } else if (memoryStore) {
        persistPromise = patternRepo.saveStore(memoryStore).catch(() => {
          // ignore
        })
      }
    })
    .catch(() => {
      // ignore
    })
    .finally(() => {
      requestRender()
    })
}

function readStore(): PatternLibraryStoreSnapshot {
  if (!memoryStore) {
    memoryStore = migrateStoreSnapshot(seedStore()).store
  }
  ensureHydration()
  return cloneStore(memoryStore)
}

function writeStore(store: PatternLibraryStoreSnapshot): void {
  const migrated = migrateStoreSnapshot(store).store
  memoryStore = cloneStore(migrated)
  persistPromise = patternRepo.saveStore(migrated).catch(() => {
    // ignore
  })
  void persistPromise
}

export function waitForPatternLibraryPersistence(): Promise<void> {
  return persistPromise
}

function mutateStore<T>(mutator: (store: PatternLibraryStoreSnapshot) => T): T {
  const store = readStore()
  const result = mutator(store)
  writeStore(store)
  return result
}

function getCurrentVersion(store: PatternLibraryStoreSnapshot, assetId: string): PatternFileVersion | null {
  return (
    store.versions.find((version) => version.pattern_asset_id === assetId && version.is_current)
    ?? store.versions.find((version) => version.pattern_asset_id === assetId)
    ?? null
  )
}

function getAssetLicense(store: PatternLibraryStoreSnapshot, assetId: string): PatternLicense | null {
  return store.licenses.find((license) => license.pattern_asset_id === assetId) ?? null
}

function getAssetTags(store: PatternLibraryStoreSnapshot, assetId: string): PatternTagRecord[] {
  return store.tags.filter((tag) => tag.pattern_asset_id === assetId)
}

function getAssetReferences(store: PatternLibraryStoreSnapshot, assetId: string): PatternReference[] {
  return store.references.filter((reference) => reference.pattern_asset_id === assetId)
}

function getAssetLogs(store: PatternLibraryStoreSnapshot, assetId: string): PatternAssetLog[] {
  return store.logs
    .filter((log) => log.pattern_asset_id === assetId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}

function syncReferenceCounts(store: PatternLibraryStoreSnapshot): void {
  for (const asset of store.assets) {
    const references = getAssetReferences(store, asset.id)
    asset.reference_count = references.length
  }
}

function appendLog(store: PatternLibraryStoreSnapshot, patternAssetId: string, action: string, operator: string, detail: string): void {
  store.logs.push({
    id: nextId('pattern_log', store),
    pattern_asset_id: patternAssetId,
    action,
    operator,
    created_at: nowIso(),
    detail,
  })
}

function enrichAsset(store: PatternLibraryStoreSnapshot, asset: PatternAsset): PatternAssetRecord {
  const currentVersion = getCurrentVersion(store, asset.id)
  const license = getAssetLicense(store, asset.id)
  const references = getAssetReferences(store, asset.id)
  const logs = getAssetLogs(store, asset.id)
  const lastReferencedAt = references
    .map((reference) => reference.last_referenced_at ?? reference.created_at)
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    ...asset,
    currentVersion,
    license,
    tags: getAssetTags(store, asset.id),
    references,
    logs,
    lastReferencedAt,
  }
}

function computeDuplicateCandidates(store: PatternLibraryStoreSnapshot, parsedFile: PatternParsedFileResult, excludeAssetId?: string): PatternDuplicateCandidate[] {
  const candidates: PatternDuplicateCandidate[] = []
  for (const version of store.versions.filter((item) => item.is_current)) {
    if (excludeAssetId && version.pattern_asset_id === excludeAssetId) continue
    const hit = getPatternSimilarityHit({
      assetId: version.pattern_asset_id,
      versionId: version.id,
      currentSha256: parsedFile.sha256,
      currentPhash: parsedFile.phash,
      candidateSha256: version.sha256,
      candidatePhash: version.phash,
      threshold: store.config.similarityThreshold,
    })
    if (!hit) continue
    const asset = store.assets.find((item) => item.id === version.pattern_asset_id)
    if (!asset) continue
    candidates.push({
      asset: enrichAsset(store, asset),
      version,
      hit,
    })
  }

  return candidates.sort((left, right) => right.hit.similarity - left.hit.similarity)
}

async function persistBlobIfPresent(
  blob: Blob | undefined,
  kind: 'original' | 'preview' | 'thumbnail',
  preferredKey?: string,
): Promise<string | undefined> {
  if (!blob) return preferredKey
  return patternRepo.saveBlob(blob, kind, preferredKey)
}

export async function persistPatternParsedFile(parsedFile: PatternParsedFileResult): Promise<PatternParsedFileResult> {
  const originalBlobKey = await persistBlobIfPresent(parsedFile.originalBlob, 'original', parsedFile.originalBlobKey)
  const previewBlobKey = await persistBlobIfPresent(parsedFile.previewBlob, 'preview', parsedFile.previewBlobKey)
  const thumbnailBlobKey = await persistBlobIfPresent(parsedFile.thumbnailBlob, 'thumbnail', parsedFile.thumbnailBlobKey)

  return {
    ...parsedFile,
    originalBlobKey,
    previewBlobKey,
    thumbnailBlobKey,
  }
}

export async function getPatternBlob(blobKey?: string): Promise<Blob | null> {
  if (!blobKey) return null
  return patternRepo.getBlob(blobKey)
}

function createVersionRecord(store: PatternLibraryStoreSnapshot, assetId: string, parsedFile: PatternParsedFileResult, versionNo: string): PatternFileVersion {
  return {
    id: nextId('pattern_version', store),
    pattern_asset_id: assetId,
    version_no: versionNo,
    file_url: parsedFile.originalBlobKey ? undefined : parsedFile.previewUrl,
    preview_url: parsedFile.previewBlobKey ? undefined : parsedFile.previewUrl,
    thumbnail_url: parsedFile.thumbnailBlobKey ? undefined : parsedFile.thumbnailUrl,
    original_blob_key: parsedFile.originalBlobKey,
    preview_blob_key: parsedFile.previewBlobKey,
    thumbnail_blob_key: parsedFile.thumbnailBlobKey,
    file_ext: parsedFile.fileExt,
    mime_type: parsedFile.mimeType,
    file_size: parsedFile.fileSize,
    image_width: parsedFile.imageWidth,
    image_height: parsedFile.imageHeight,
    aspect_ratio: parsedFile.aspectRatio,
    color_mode: parsedFile.colorMode,
    dpi_x: parsedFile.dpiX,
    dpi_y: parsedFile.dpiY,
    frame_count: parsedFile.frameCount,
    has_alpha: parsedFile.hasAlpha,
    sha256: parsedFile.sha256,
    phash: parsedFile.phash,
    filename_tokens: parsedFile.filenameTokens,
    parse_result_json: parsedFile.parseResultJson,
    is_current: true,
    created_at: nowIso(),
    parse_status: parsedFile.parseStatus,
    parse_error_message: parsedFile.parseErrorMessage,
    original_filename: parsedFile.originalFilename,
  }
}

function buildPatternNameFromFilename(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function normalizeLicenseStatus(status?: PatternLicenseStatus): PatternLicenseStatus {
  return status ?? 'unverified'
}

function buildSourceReferences(store: PatternLibraryStoreSnapshot, assetId: string, draft: PatternAssetDraftInput): void {
  if (draft.sourceTaskId) {
    const sourceTask = SOURCE_TASK_INDEX[draft.sourceTaskId]
    store.references.push({
      id: nextId('pattern_ref', store),
      pattern_asset_id: assetId,
      ref_type: 'flower_task',
      ref_id: draft.sourceTaskId,
      ref_name: sourceTask?.name ?? draft.sourceTaskId,
      created_at: nowIso(),
      last_referenced_at: nowIso(),
    })

    if (sourceTask?.projectId) {
      store.references.push({
        id: nextId('pattern_ref', store),
        pattern_asset_id: assetId,
        ref_type: 'project',
        ref_id: sourceTask.projectId,
        ref_name: sourceTask.projectName,
        created_at: nowIso(),
        last_referenced_at: nowIso(),
      })
    }
  } else if (draft.sourceProjectId) {
    store.references.push({
      id: nextId('pattern_ref', store),
      pattern_asset_id: assetId,
      ref_type: 'project',
      ref_id: draft.sourceProjectId,
      ref_name: draft.sourceProjectId,
      created_at: nowIso(),
      last_referenced_at: nowIso(),
    })
  }
}

function buildDraftTags(
  store: PatternLibraryStoreSnapshot,
  assetId: string,
  versionId: string,
  draft: PatternAssetDraftInput,
): PatternTagRecord[] {
  const categorySelection = resolveDraftCategory(draft)
  const suggestions = PatternTagService.suggestTags({
    filename: draft.parsedFile.originalFilename,
    tokens: draft.parsedFile.filenameTokens,
    dominantColors: draft.parsedFile.dominantColors,
    width: draft.parsedFile.imageWidth,
    height: draft.parsedFile.imageHeight,
    config: store.config,
  })

  const manualTags: PatternTagRecord[] = [
    ...draft.styleTags.map((tag) => ({
      id: nextId('pattern_tag', store),
      pattern_asset_id: assetId,
      pattern_file_version_id: versionId,
      tag_name: tag,
      tag_type: '风格标签' as const,
      source: 'manual' as const,
      confidence: 1,
      locked: true,
    })),
    ...draft.colorTags.map((tag) => ({
      id: nextId('pattern_tag', store),
      pattern_asset_id: assetId,
      pattern_file_version_id: versionId,
      tag_name: tag,
      tag_type: '主色系' as const,
      source: 'manual' as const,
      confidence: 1,
      locked: true,
    })),
    ...(categorySelection.primary
      ? [{
          id: nextId('pattern_tag', store),
          pattern_asset_id: assetId,
          pattern_file_version_id: versionId,
          tag_name: categorySelection.primary,
          tag_type: '题材一级分类' as const,
          source: 'manual' as const,
          confidence: 1,
          locked: true,
        }]
      : []),
    ...(categorySelection.secondary
      ? [{
          id: nextId('pattern_tag', store),
          pattern_asset_id: assetId,
          pattern_file_version_id: versionId,
          tag_name: categorySelection.secondary,
          tag_type: '题材二级分类' as const,
          source: 'manual' as const,
          confidence: 1,
          locked: true,
        }]
      : []),
  ]

  const ruleTags: PatternTagRecord[] = suggestions.map((suggestion) => ({
    id: nextId('pattern_tag', store),
    pattern_asset_id: assetId,
    pattern_file_version_id: versionId,
    tag_name: suggestion.tag_name,
    tag_type: suggestion.tag_type,
    source: suggestion.source,
    confidence: suggestion.confidence,
    locked: suggestion.locked,
  }))

  const deduped = new Map<string, PatternTagRecord>()
  ;[...ruleTags, ...manualTags].forEach((tag) => {
    deduped.set(`${tag.tag_type}:${tag.tag_name}`, tag)
  })
  return Array.from(deduped.values())
}

function getNextVersionNo(store: PatternLibraryStoreSnapshot, assetId: string): string {
  const versionCount = store.versions.filter((version) => version.pattern_asset_id === assetId).length + 1
  return `V${versionCount}`
}

export const PATTERN_PARSE_STATUS_LABELS: Record<PatternAsset['parse_status'], string> = {
  pending: '待解析',
  parsing: '解析中',
  success: '解析成功',
  failed: '解析失败',
  manual_required: '待人工补录',
}

export const PATTERN_REVIEW_STATUS_LABELS: Record<PatternAsset['review_status'], string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

export const PATTERN_LIFECYCLE_STATUS_LABELS: Record<PatternAsset['lifecycle_status'], string> = {
  active: '启用中',
  inactive: '已停用',
  archived: '已归档',
}

export const PATTERN_DUPLICATE_STATUS_LABELS: Record<PatternAsset['duplicate_status'], string> = {
  unchecked: '未检测',
  suspected: '疑似重复',
  unique: '唯一',
  merged: '已合并',
}

export const PATTERN_LICENSE_STATUS_LABELS: Record<PatternLicenseStatus, string> = {
  unverified: '未确认',
  authorized: '已授权',
  restricted: '限制使用',
  expired: '已过期',
  forbidden: '禁止使用',
}

export function getPatternLibraryConfig(): PatternLibraryConfig {
  return normalizePatternLibraryConfig(readStore().config)
}

export function getPatternCategoryTree(): PatternCategoryNode[] {
  return cloneCategoryTree(getPatternLibraryConfig().categoryTree)
}

export function getPatternCategorySecondaryList(primary?: string): string[] {
  return getPatternCategorySecondaryOptions(getPatternLibraryConfig().categoryTree, primary)
}

export function listPatternApplicableCategoryOptions(): string[] {
  return getWorkspaceApplicableCategories()
}

export function updatePatternLibraryConfig(patch: Partial<PatternLibraryConfig>): PatternLibraryConfig {
  return mutateStore((store) => {
    store.config = normalizePatternLibraryConfig({
      ...store.config,
      ...patch,
      ruleToggles: {
        ...store.config.ruleToggles,
        ...patch.ruleToggles,
      },
    })
    return cloneStore(store.config)
  })
}

export function listPatternAssets(): PatternAssetRecord[] {
  const store = readStore()
  syncReferenceCounts(store)
  return store.assets
    .map((asset) => enrichAsset(store, asset))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
}

export function listPatternAssetsForSelect(): Array<{ id: string; label: string }> {
  return listPatternAssets()
    .filter((record) => record.lifecycle_status !== 'archived')
    .map((record) => ({ id: record.id, label: `${record.pattern_code}｜${record.pattern_name}` }))
}

export function getPatternAssetById(assetId: string): PatternAssetRecord | null {
  const store = readStore()
  const asset = store.assets.find((item) => item.id === assetId)
  return asset ? enrichAsset(store, asset) : null
}

export function listPatternVersions(assetId: string): PatternFileVersion[] {
  return readStore().versions
    .filter((version) => version.pattern_asset_id === assetId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}

export function listPatternDuplicateCandidates(parsedFile: PatternParsedFileResult, excludeAssetId?: string): PatternDuplicateCandidate[] {
  const store = readStore()
  return computeDuplicateCandidates(store, parsedFile, excludeAssetId)
}

export function listSimilarPatternAssets(assetId: string): PatternDuplicateCandidate[] {
  const store = readStore()
  const version = getCurrentVersion(store, assetId)
  if (!version) return []
  return computeDuplicateCandidates(
    store,
    {
      originalFilename: version.original_filename,
      fileExt: version.file_ext,
      mimeType: version.mime_type ?? '',
      fileSize: version.file_size,
      imageWidth: version.image_width,
      imageHeight: version.image_height,
      aspectRatio: version.aspect_ratio,
      colorMode: version.color_mode,
      dpiX: version.dpi_x,
      dpiY: version.dpi_y,
      frameCount: version.frame_count,
      hasAlpha: version.has_alpha,
      sha256: version.sha256,
      phash: version.phash,
      filenameTokens: version.filename_tokens,
      previewUrl: version.preview_url,
      thumbnailUrl: version.thumbnail_url,
      parseStatus: version.parse_status,
      parseSummary: String(version.parse_result_json?.parseSummary ?? ''),
      dominantColors: [],
      parseWarnings: [],
      parseResultJson: version.parse_result_json ?? {},
    },
    assetId,
  )
}

export function getPatternLibraryTabCounts(): Record<string, number> {
  const records = listPatternAssets()
  return {
    全部: records.length,
    待补录: records.filter((item) => item.maintenance_status === '待补录').length,
    待审核: records.filter((item) => item.review_status === 'pending').length,
    解析失败: records.filter((item) => item.parse_status === 'failed').length,
    疑似重复: records.filter((item) => item.duplicate_status === 'suspected').length,
    已归档: records.filter((item) => item.lifecycle_status === 'archived').length,
  }
}

export function getPatternLibraryStats() {
  const records = listPatternAssets()
  return {
    total: records.length,
    active: records.filter((item) => item.lifecycle_status === 'active').length,
    pendingReview: records.filter((item) => item.review_status === 'pending').length,
    suspectedDuplicate: records.filter((item) => item.duplicate_status === 'suspected').length,
    referenced: records.filter((item) => item.reference_count > 0).length,
    hotStyles: records.filter((item) => item.hot_flag).length,
  }
}

export function createPatternAsset(draft: PatternAssetDraftInput): PatternAssetRecord {
  return mutateStore((store) => {
    const duplicateCandidates = computeDuplicateCandidates(store, draft.parsedFile)
    const duplicateStatus = inferDuplicateStatus(duplicateCandidates.map((item) => item.hit))
    const categorySelection = resolveDraftCategory(draft)

    if (
      draft.duplicateTargetAssetId &&
      draft.duplicateAction &&
      (draft.duplicateAction === 'merge' || draft.duplicateAction === 'new-version')
    ) {
      return addPatternVersion({
        assetId: draft.duplicateTargetAssetId,
        parsedFile: draft.parsedFile,
        updatedBy: draft.createdBy,
        reviewComment: draft.reviewComment,
        fromDuplicateMerge: draft.duplicateAction === 'merge',
      }, store)
    }

    const assetId = nextId('pattern_asset', store)
    const version = createVersionRecord(store, assetId, draft.parsedFile, 'V1')
    const licenseId = nextId('pattern_license', store)
    const patternCode = buildPatternCode(store.sequence)
    const now = nowIso()
    const sourceTask = draft.sourceTaskId ? SOURCE_TASK_INDEX[draft.sourceTaskId] : undefined
    const asset: PatternAsset = {
      id: assetId,
      pattern_code: patternCode,
      pattern_name: draft.patternName || buildPatternNameFromFilename(draft.parsedFile.originalFilename),
      original_filename: draft.parsedFile.originalFilename,
      aliases: draft.aliases.filter(Boolean),
      usage_type: draft.usageType,
      category: categorySelection.primary,
      category_primary: categorySelection.primary || undefined,
      category_secondary: categorySelection.secondary,
      style_tags: draft.styleTags.filter(Boolean),
      color_tags: draft.colorTags.filter(Boolean),
      hot_flag: draft.hotFlag,
      source_type: draft.sourceType,
      source_note: draft.sourceNote,
      applicable_categories: draft.applicableCategories.filter(Boolean),
      applicable_parts: draft.applicableParts.filter(Boolean),
      related_part_template_ids: draft.relatedPartTemplateIds.filter(Boolean),
      process_direction: draft.processDirection,
      maintenance_status: draft.maintenanceStatus,
      review_status: draft.submitForReview ? 'pending' : 'draft',
      lifecycle_status: 'active',
      duplicate_status: duplicateStatus,
      license_status: normalizeLicenseStatus(draft.license.license_status),
      parse_status: draft.parsedFile.parseStatus,
      source_task_id: draft.sourceTaskId,
      source_project_id: draft.sourceProjectId ?? sourceTask?.projectId,
      source_pattern_task_snapshot: draft.sourcePatternTaskSnapshot,
      reference_count: 0,
      created_by: draft.createdBy,
      updated_by: draft.createdBy,
      created_at: now,
      updated_at: now,
      current_version_id: version.id,
      manual_review_conclusion: draft.manualReviewConclusion,
      review_comment: draft.reviewComment,
      parse_error_message: draft.parsedFile.parseErrorMessage,
      ai_summary:
        draft.parsedFile.parseWarnings.length > 0
          ? `需人工确认：${draft.parsedFile.parseWarnings.join('；')}`
          : `系统已识别 ${draft.parsedFile.parseSummary}`,
    }

    store.assets.push(asset)
    store.versions.push(version)
    store.licenses.push({
      ...draft.license,
      id: licenseId,
      pattern_asset_id: assetId,
      attachment_urls: draft.license.attachment_urls ?? [],
    })
    store.tags.push(...buildDraftTags(store, assetId, version.id, draft))
    buildSourceReferences(store, assetId, draft)
    syncReferenceCounts(store)

    appendLog(store, assetId, '新建', draft.createdBy, `创建花型主档 ${asset.pattern_code}，维护状态：${asset.maintenance_status}。`)
    appendLog(store, assetId, '上传文件', draft.createdBy, `上传文件 ${draft.parsedFile.originalFilename}，生成版本 ${version.version_no}。`)
    appendLog(store, assetId, '自动解析结果', '系统', draft.parsedFile.parseSummary)
    appendLog(
      store,
      assetId,
      '自动标签结果',
      '系统',
      `建议标签：${getAssetTags(store, assetId)
        .slice(0, 6)
        .map((tag) => `${tag.tag_type}-${tag.tag_name}`)
        .join(' / ') || '暂无'}`,
    )
    if (duplicateCandidates.length > 0) {
      appendLog(
        store,
        assetId,
        '疑似重复检测',
        '系统',
        `命中 ${duplicateCandidates.length} 条疑似重复记录，最高相似度 ${Math.round(duplicateCandidates[0].hit.similarity * 100)}%。`,
      )
    }
    if (draft.submitForReview) {
      appendLog(store, assetId, '提交审核', draft.createdBy, '已提交审核，等待审核专员处理。')
    }

    return enrichAsset(store, asset)
  })
}

function addPatternVersion(
  input: {
    assetId: string
    parsedFile: PatternParsedFileResult
    updatedBy: string
    reviewComment?: string
    fromDuplicateMerge?: boolean
  },
  inheritedStore?: PatternLibraryStoreSnapshot,
): PatternAssetRecord {
  const execute = (store: PatternLibraryStoreSnapshot) => {
    const asset = store.assets.find((item) => item.id === input.assetId)
    if (!asset) {
      throw new Error('目标花型不存在')
    }

    store.versions
      .filter((version) => version.pattern_asset_id === input.assetId)
      .forEach((version) => {
        version.is_current = false
      })

    const version = createVersionRecord(store, input.assetId, input.parsedFile, getNextVersionNo(store, input.assetId))
    store.versions.push(version)

    asset.current_version_id = version.id
    asset.original_filename = input.parsedFile.originalFilename
    asset.parse_status = input.parsedFile.parseStatus
    asset.parse_error_message = input.parsedFile.parseErrorMessage
    asset.updated_at = nowIso()
    asset.updated_by = input.updatedBy
    asset.review_status = 'draft'
    asset.lifecycle_status = 'active'
    asset.duplicate_status = inferDuplicateStatus(computeDuplicateCandidates(store, input.parsedFile, input.assetId).map((item) => item.hit))
    asset.review_comment = input.reviewComment || asset.review_comment

    appendLog(
      store,
      input.assetId,
      '新建版本',
      input.updatedBy,
      `新增版本 ${version.version_no}，来源文件 ${input.parsedFile.originalFilename}${input.fromDuplicateMerge ? '，由重复文件合并而来' : ''}。`,
    )
    appendLog(store, input.assetId, '自动解析结果', '系统', input.parsedFile.parseSummary)

    return enrichAsset(store, asset)
  }

  if (inheritedStore) {
    return execute(inheritedStore)
  }
  return mutateStore(execute)
}

export function createPatternVersion(input: {
  assetId: string
  parsedFile: PatternParsedFileResult
  updatedBy: string
  reviewComment?: string
}): PatternAssetRecord {
  return addPatternVersion(input)
}

export function updatePatternAsset(
  assetId: string,
  input: Partial<
    Pick<
      PatternAsset,
      | 'pattern_name'
      | 'aliases'
      | 'usage_type'
      | 'category'
      | 'category_primary'
      | 'category_secondary'
      | 'style_tags'
      | 'color_tags'
      | 'hot_flag'
      | 'source_type'
      | 'source_note'
      | 'applicable_categories'
      | 'applicable_parts'
      | 'related_part_template_ids'
      | 'process_direction'
      | 'maintenance_status'
      | 'manual_review_conclusion'
      | 'review_comment'
    >
  > & {
    updatedBy: string
    license?: Partial<Omit<PatternLicense, 'id' | 'pattern_asset_id'>>
  },
): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    const categoryPrimary = input.category_primary ?? asset.category_primary ?? inferCategoryFromLegacy(input.category ?? asset.category).primary
    const categorySecondary = input.category_secondary ?? asset.category_secondary
    Object.assign(asset, {
      ...input,
      category: categoryPrimary || input.category || asset.category,
      category_primary: categoryPrimary,
      category_secondary: categorySecondary || undefined,
      updated_by: input.updatedBy,
      updated_at: nowIso(),
    })
    if (input.license) {
      const license = getAssetLicense(store, assetId)
      if (license) {
        Object.assign(license, input.license)
        asset.license_status = normalizeLicenseStatus(license.license_status)
      }
    }
    appendLog(store, assetId, '手工修改标签', input.updatedBy, '基础信息或治理字段已更新。')
    return enrichAsset(store, asset)
  })
}

export function submitPatternAssetReview(assetId: string, operator: string): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    if (asset.parse_status !== 'success') {
      throw new Error('解析成功后才允许提交审核。')
    }
    if (!asset.pattern_name.trim()) {
      throw new Error('花型名称为必填项。')
    }
    asset.review_status = 'pending'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    appendLog(store, assetId, '提交审核', operator, '已提交审核。')
    return enrichAsset(store, asset)
  })
}

export function approvePatternAsset(assetId: string, operator: string, comment = '审核通过，允许正式引用。'): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    asset.review_status = 'approved'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    asset.review_comment = comment
    appendLog(store, assetId, '审核通过', operator, comment)
    return enrichAsset(store, asset)
  })
}

export function rejectPatternAsset(assetId: string, operator: string, comment: string): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    asset.review_status = 'rejected'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    asset.review_comment = comment
    appendLog(store, assetId, '审核驳回', operator, comment)
    return enrichAsset(store, asset)
  })
}

export function disablePatternAsset(assetId: string, operator: string): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    asset.lifecycle_status = 'inactive'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    appendLog(store, assetId, '停用', operator, '花型已停用。')
    return enrichAsset(store, asset)
  })
}

export function restorePatternAsset(assetId: string, operator: string): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    asset.lifecycle_status = 'active'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    appendLog(store, assetId, '恢复', operator, '花型已恢复为启用状态。')
    return enrichAsset(store, asset)
  })
}

export function archivePatternAsset(assetId: string, operator: string): PatternAssetRecord {
  return mutateStore((store) => {
    const asset = store.assets.find((item) => item.id === assetId)
    if (!asset) throw new Error('花型不存在')
    asset.lifecycle_status = 'archived'
    asset.updated_by = operator
    asset.updated_at = nowIso()
    appendLog(store, assetId, '归档', operator, '花型已归档。')
    return enrichAsset(store, asset)
  })
}

export function batchUpdatePatternAssets(input: PatternAssetBatchUpdate): PatternAssetRecord[] {
  return mutateStore((store) => {
    const updated: PatternAssetRecord[] = []
    input.ids.forEach((id) => {
      const asset = store.assets.find((item) => item.id === id)
      if (!asset) return
      if (input.maintenanceStatus) asset.maintenance_status = input.maintenanceStatus
      if (input.reviewStatus) asset.review_status = input.reviewStatus
      if (input.lifecycleStatus) asset.lifecycle_status = input.lifecycleStatus
      asset.updated_by = input.updatedBy
      asset.updated_at = nowIso()
      appendLog(store, id, '批量编辑', input.updatedBy, '已执行批量更新。')
      updated.push(enrichAsset(store, asset))
    })
    return updated
  })
}

export function listPatternTaskReferenceOptions() {
  return Object.entries(SOURCE_TASK_INDEX).map(([id, item]) => ({
    id,
    label: `${id}｜${item.name}`,
  }))
}

export function getPatternTaskSummary(taskId: string): { id: string; name: string; projectId: string; projectName: string } | null {
  const task = SOURCE_TASK_INDEX[taskId]
  return task ? { id: taskId, ...task } : null
}

export function exportPatternLibraryRows(): Array<Record<string, string | number>> {
  return listPatternAssets().map((record) => ({
    花型编号: record.pattern_code,
    花型名称: record.pattern_name,
    原文件名: record.original_filename,
    花型使用方式: record.usage_type,
    题材一级分类: record.category_primary || record.category || '',
    题材二级分类: record.category_secondary || '',
    题材分类路径: buildPatternCategoryPath(record.category_primary || record.category, record.category_secondary),
    题材分类: record.category_primary || record.category || '',
    风格标签: record.style_tags.join(' / '),
    主色系: record.color_tags.join(' / '),
    是否爆款: record.hot_flag ? '是' : '否',
    授权状态: PATTERN_LICENSE_STATUS_LABELS[record.license_status],
    维护状态: record.maintenance_status,
    解析状态: PATTERN_PARSE_STATUS_LABELS[record.parse_status],
    审核状态: PATTERN_REVIEW_STATUS_LABELS[record.review_status],
    生命周期: PATTERN_LIFECYCLE_STATUS_LABELS[record.lifecycle_status],
    重复检测状态: PATTERN_DUPLICATE_STATUS_LABELS[record.duplicate_status],
    引用次数: record.reference_count,
  }))
}

export function getPatternReferenceAvailability(assetId: string): { allowed: boolean; reason?: string } {
  const asset = getPatternAssetById(assetId)
  if (!asset) return { allowed: false, reason: '花型不存在' }
  return canPatternBeReferenced(asset)
}

export function resetPatternLibraryStore(): void {
  memoryStore = migrateStoreSnapshot(seedStore()).store
  hydrationStarted = false
  persistPromise = patternRepo.clear()
    .then(() => patternRepo.saveStore(memoryStore!))
    .catch(() => {
      // ignore
    })
}
