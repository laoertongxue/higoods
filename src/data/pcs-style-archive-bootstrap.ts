import { techPacks } from './fcs/tech-packs.ts'
import type {
  StyleArchiveShellRecord,
  StyleArchiveStoreSnapshot,
} from './pcs-style-archive-types.ts'

function parseVersionNo(versionLabel: string, fallback: number): number {
  const matched = versionLabel.match(/(\d+)/)
  if (!matched) return fallback
  const value = Number.parseInt(matched[1], 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeVersionLabel(versionLabel: string, fallback: number): string {
  const trimmed = versionLabel.trim()
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'beta') {
    return `V${fallback}`
  }
  const matched = trimmed.match(/(\d+)/)
  return matched ? `V${matched[1]}` : `V${fallback}`
}

function buildSeedTechnicalVersionId(index: number): string {
  return `tdv_seed_${String(index + 1).padStart(3, '0')}`
}

function buildSeedTechnicalVersionCode(index: number): string {
  return `TDV-LEGACY-${String(index + 1).padStart(3, '0')}`
}

function resolveCategory(styleName: string): { categoryName: string; subCategoryName: string } {
  const lowered = styleName.toLowerCase()
  if (styleName.includes('裙') || lowered.includes('dress')) return { categoryName: '裙装', subCategoryName: '连衣裙' }
  if (styleName.includes('裤') || lowered.includes('pants') || lowered.includes('jogger') || lowered.includes('shorts')) {
    return { categoryName: '裤装', subCategoryName: '长裤' }
  }
  if (
    styleName.includes('外套') ||
    styleName.includes('夹克') ||
    lowered.includes('jacket') ||
    lowered.includes('hoodie') ||
    lowered.includes('blazer') ||
    lowered.includes('cardigan')
  ) {
    return { categoryName: '上装', subCategoryName: '外套' }
  }
  if (styleName.includes('衬衫') || lowered.includes('shirt') || lowered.includes('kemeja') || lowered.includes('blouse')) {
    return { categoryName: '上装', subCategoryName: '衬衫' }
  }
  if (styleName.includes('卫衣') || styleName.includes('T恤') || lowered.includes('tee') || lowered.includes('polo')) {
    return { categoryName: '上装', subCategoryName: 'T恤' }
  }
  if (styleName.includes('毛衣') || styleName.includes('针织') || styleName.includes('开衫') || lowered.includes('sweater')) {
    return { categoryName: '上装', subCategoryName: '针织' }
  }
  return { categoryName: '成衣', subCategoryName: '通用款' }
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
  const tags: string[] = []
  const lowered = styleName.toLowerCase()

  if (styleName.includes('印花') || styleName.includes('碎花') || lowered.includes('batik')) tags.push('印花')
  if (styleName.includes('运动')) tags.push('运动')
  if (styleName.includes('休闲') || lowered.includes('casual') || lowered.includes('polo') || lowered.includes('t-shirt')) tags.push('休闲')
  if (styleName.includes('商务') || styleName.includes('西装') || lowered.includes('formal') || lowered.includes('blazer')) tags.push('通勤')
  if (styleName.includes('针织') || styleName.includes('毛衣') || lowered.includes('knit')) tags.push('针织')
  if (tags.length === 0) tags.push('基础款')

  return tags
}

function countCostItems(techPack: (typeof techPacks)[number]): number {
  return (
    (techPack.materialCostItems?.length || 0) +
    (techPack.processCostItems?.length || 0) +
    (techPack.customCostItems?.length || 0)
  )
}

function buildRecord(techPack: (typeof techPacks)[number], index: number): StyleArchiveShellRecord {
  const versionNo = parseVersionNo(techPack.versionLabel, 1)
  const versionLabel = normalizeVersionLabel(techPack.versionLabel, versionNo)
  const released = techPack.status === 'RELEASED'
  const { categoryName, subCategoryName } = resolveCategory(techPack.spuName)
  const costItemCount = countCostItems(techPack)

  return {
    styleId: `style_seed_${String(index + 1).padStart(3, '0')}`,
    styleCode: techPack.spuCode,
    styleName: techPack.spuName,
    styleNumber: techPack.spuCode,
    styleType: '成衣',
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
    styleTags: resolveStyleTags(techPack.spuName),
    targetAudienceTags: [],
    targetChannelCodes: [],
    priceRangeLabel: resolvePriceRange(techPack.spuName),
    archiveStatus: 'ACTIVE',
    baseInfoStatus: '已维护',
    specificationStatus: '已建立',
    techPackStatus: released ? '已启用' : '草稿中',
    costPricingStatus: costItemCount > 0 ? '已建立' : '未建立',
    specificationCount: techPack.skuCatalog?.length || 4,
    techPackVersionCount: 1,
    costVersionCount: costItemCount > 0 ? 1 : 0,
    channelProductCount: 1,
    currentTechPackVersionId: released ? buildSeedTechnicalVersionId(index) : '',
    currentTechPackVersionCode: released ? buildSeedTechnicalVersionCode(index) : '',
    currentTechPackVersionLabel: released ? versionLabel : '',
    currentTechPackVersionStatus: released ? '已发布' : '',
    currentTechPackVersionActivatedAt: released ? techPack.lastUpdatedAt || '' : '',
    currentTechPackVersionActivatedBy: released ? techPack.lastUpdatedBy || '系统初始化' : '',
    remark: '',
    generatedAt: techPack.lastUpdatedAt || '',
    generatedBy: techPack.lastUpdatedBy || '系统初始化',
    updatedAt: techPack.lastUpdatedAt || '',
    updatedBy: techPack.lastUpdatedBy || '系统初始化',
    legacyOriginProject: '',
  }
}

export function createStyleArchiveBootstrapSnapshot(version: number): StyleArchiveStoreSnapshot {
  return {
    version,
    records: techPacks.map(buildRecord),
    pendingItems: [],
  }
}
