import { buildStyleFixture } from './pcs-product-archive-fixtures.ts'
import { listProductionDemandTechPackSeeds, type ProductionDemandTechPackSeed } from './pcs-production-demand-tech-pack-seeds.ts'
import {
  listProjectWorkspaceCategories,
  listProjectWorkspaceStyles,
  type ProjectWorkspaceOption,
} from './pcs-project-config-workspace-adapter.ts'
import type {
  StyleArchiveShellRecord,
  StyleArchiveStoreSnapshot,
} from './pcs-style-archive-types.ts'

const WORKSPACE_CATEGORIES = listProjectWorkspaceCategories()
const WORKSPACE_STYLES = listProjectWorkspaceStyles()

function pickOptionByIndex(options: ProjectWorkspaceOption[], index: number): ProjectWorkspaceOption {
  if (options.length === 0) {
    return { id: '', code: '', name: '' }
  }
  return options[Math.abs(index) % options.length]
}

function findOptionByKeywords(
  options: ProjectWorkspaceOption[],
  keywords: string[],
): ProjectWorkspaceOption | null {
  const normalizedKeywords = keywords.filter(Boolean)
  if (normalizedKeywords.length === 0) return null
  return (
    options.find((option) =>
      normalizedKeywords.some((keyword) => option.name.includes(keyword) || option.code.includes(keyword)),
    ) ?? null
  )
}

function resolveCategory(styleName: string): { categoryName: string; subCategoryName: string } {
  const lowered = styleName.toLowerCase()
  if (styleName.includes('裙') || lowered.includes('dress')) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['连衣裙', '长裙', '中长裙', '短裙']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 1)
    return { categoryName: option.name || '连衣裙', subCategoryName: '' }
  }
  if (styleName.includes('裤') || lowered.includes('pants') || lowered.includes('jogger') || lowered.includes('shorts')) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['裤子']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 3)
    return { categoryName: option.name || '裤子', subCategoryName: '' }
  }
  if (
    styleName.includes('外套') ||
    styleName.includes('夹克') ||
    lowered.includes('jacket') ||
    lowered.includes('hoodie') ||
    lowered.includes('blazer') ||
    lowered.includes('cardigan')
  ) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['外套', '开衫']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 9)
    return { categoryName: option.name || '外套', subCategoryName: '' }
  }
  if (styleName.includes('衬衫') || lowered.includes('shirt') || lowered.includes('kemeja') || lowered.includes('blouse')) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['上衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 0)
    return { categoryName: option.name || '上衣', subCategoryName: '' }
  }
  if (styleName.includes('卫衣') || styleName.includes('T恤') || lowered.includes('tee') || lowered.includes('polo')) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['卫衣', '上衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 13)
    return { categoryName: option.name || '卫衣', subCategoryName: '' }
  }
  if (styleName.includes('毛衣') || styleName.includes('毛织') || styleName.includes('开衫') || lowered.includes('sweater')) {
    const option = findOptionByKeywords(WORKSPACE_CATEGORIES, ['开衫', '毛衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 5)
    return { categoryName: option.name || '开衫', subCategoryName: '' }
  }
  const fallback = findOptionByKeywords(WORKSPACE_CATEGORIES, ['上衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 0)
  return { categoryName: fallback.name || '上衣', subCategoryName: '' }
}

function resolvePriceRange(styleName: string): string {
  const lowered = styleName.toLowerCase()
  if (
    styleName.includes('外套') ||
    styleName.includes('夹克') ||
    lowered.includes('jacket') ||
    lowered.includes('hoodie') ||
    lowered.includes('blazer') ||
    lowered.includes('jas')
  ) {
    return '¥399-699'
  }
  if (styleName.includes('裙') || lowered.includes('dress')) return '¥299-499'
  if (styleName.includes('裤') || lowered.includes('pants') || lowered.includes('jogger')) return '¥199-399'
  return '¥159-299'
}

function resolveStyleTags(styleName: string): string[] {
  const keywords: string[] = []
  const lowered = styleName.toLowerCase()

  if (styleName.includes('印花') || styleName.includes('碎花') || lowered.includes('batik')) keywords.push('碎花')
  if (styleName.includes('运动')) keywords.push('街头')
  if (styleName.includes('休闲') || lowered.includes('casual') || lowered.includes('polo') || lowered.includes('t-shirt')) keywords.push('休闲')
  if (styleName.includes('商务') || styleName.includes('西装') || lowered.includes('formal') || lowered.includes('blazer')) keywords.push('通勤')
  if (styleName.includes('中式')) keywords.push('中式')
  if (styleName.includes('优雅') || styleName.includes('礼服') || lowered.includes('dress')) keywords.push('优雅')

  const tags = keywords
    .map((keyword) => findOptionByKeywords(WORKSPACE_STYLES, [keyword]))
    .filter((item): item is ProjectWorkspaceOption => Boolean(item))
    .map((item) => item.name)

  if (tags.length > 0) return Array.from(new Set(tags))
  return [pickOptionByIndex(WORKSPACE_STYLES, 0).name || '休闲']
}

function buildRecord(seed: ProductionDemandTechPackSeed): StyleArchiveShellRecord {
  const { demand } = seed
  const fixture = buildStyleFixture(demand.spuCode, demand.spuName)
  const { categoryName, subCategoryName } = resolveCategory(demand.spuName)

  return {
    styleId: seed.styleId,
    styleCode: demand.spuCode,
    styleName: demand.spuName,
    styleNameEn: fixture.styleNameEn,
    styleNumber: demand.spuCode,
    productType: '成衣',
    sourceProjectId: '',
    sourceProjectCode: '',
    sourceProjectName: '',
    sourceProjectNodeId: '',
    categoryId: '',
    categoryName,
    subCategoryId: '',
    subCategoryName,
    brandId: '',
    brandName: '',
    yearTag: '2026',
    seasonTags: ['春夏'],
    styleTags: resolveStyleTags(demand.spuName),
    targetAudienceTags: [],
    targetChannelCodes: [],
    priceRangeLabel: resolvePriceRange(demand.spuName),
    archiveStatus: 'ACTIVE',
    baseInfoStatus: '已维护',
    specificationStatus: '已建立',
    techPackStatus: '已启用',
    costPricingStatus: '未建立',
    specificationCount: demand.skuLines.length,
    techPackVersionCount: 1,
    costVersionCount: 0,
    channelProductCount: 1,
    currentTechPackVersionId: seed.technicalVersionId,
    currentTechPackVersionCode: seed.technicalVersionCode,
    currentTechPackVersionLabel: seed.versionLabel,
    currentTechPackVersionStatus: '已发布',
    currentTechPackVersionActivatedAt: demand.updatedAt || '',
    currentTechPackVersionActivatedBy: '生产需求单',
    mainImageId: '',
    mainImageUrl: fixture.mainImageUrl,
    galleryImageIds: [],
    galleryImageUrls: fixture.galleryImageUrls,
    imageSource: '历史初始化',
    sellingPointText: fixture.sellingPointText,
    detailDescription: fixture.detailDescription,
    packagingInfo: fixture.packagingInfo,
    remark: '',
    generatedAt: demand.updatedAt || '',
    generatedBy: '生产需求单',
    updatedAt: demand.updatedAt || '',
    updatedBy: '生产需求单',
    legacyOriginProject: '',
  }
}

const EXTRA_STYLE_ARCHIVE_RECORDS: StyleArchiveShellRecord[] = [
  {
    styleId: 'style_seed_project_018',
    styleCode: 'SPU-2026-018',
    styleName: '设计款印花阔腿连体裤',
    styleNameEn: 'Printed Wide-Leg Jumpsuit',
    styleNumber: 'SPU-2026-018',
    productType: '成衣',
    sourceProjectId: 'prj_20251216_018',
    sourceProjectCode: 'PRJ-20251216-018',
    sourceProjectName: '设计款印花阔腿连体裤改版',
    sourceProjectNodeId: '',
    categoryId: '',
    categoryName: '连体裤',
    subCategoryId: '',
    subCategoryName: '连体裤',
    brandId: '',
    brandName: 'Asaya',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['秀场', '碎花'],
    targetAudienceTags: ['设计验证客群'],
    targetChannelCodes: ['tiktok'],
    priceRangeLabel: '¥299-499',
    archiveStatus: 'ACTIVE',
    baseInfoStatus: '已维护',
    specificationStatus: '已建立',
    techPackStatus: '已启用',
    costPricingStatus: '未建立',
    specificationCount: 3,
    techPackVersionCount: 2,
    costVersionCount: 0,
    channelProductCount: 0,
    currentTechPackVersionId: 'tdv_seed_project_018_base',
    currentTechPackVersionCode: 'TDV-20260407-018',
    currentTechPackVersionLabel: 'V1.0',
    currentTechPackVersionStatus: '已发布',
    currentTechPackVersionActivatedAt: '2026-04-07 17:20',
    currentTechPackVersionActivatedBy: '工程任务同步',
    mainImageId: '',
    mainImageUrl: buildStyleFixture('SPU-2026-018', '设计款印花阔腿连体裤').mainImageUrl,
    galleryImageIds: [],
    galleryImageUrls: buildStyleFixture('SPU-2026-018', '设计款印花阔腿连体裤').galleryImageUrls,
    imageSource: '历史初始化',
    sellingPointText: '改版任务转档后的正式演示款式档案。',
    detailDescription: '用于串联改版任务、后续技术包版本和渠道店铺商品的正式主档。',
    packagingInfo: '独立包装袋 + 吊牌，常规折叠入箱',
    remark: '补充的改版任务演示款式档案。',
    generatedAt: '2026-04-01 18:20',
    generatedBy: '系统初始化',
    updatedAt: '2026-04-01 18:20',
    updatedBy: '系统初始化',
    legacyOriginProject: '',
  },
]

export function createStyleArchiveBootstrapSnapshot(version: number): StyleArchiveStoreSnapshot {
  return {
    version,
    records: [...listProductionDemandTechPackSeeds().map(buildRecord), ...EXTRA_STYLE_ARCHIVE_RECORDS],
    pendingItems: [],
  }
}
