import { findProjectByCode } from './pcs-project-repository.ts'
import type {
  StyleArchivePendingItem,
  StyleArchiveShellRecord,
  StyleArchiveStatusCode,
  StyleArchiveStoreSnapshot,
} from './pcs-style-archive-types.ts'

interface LegacyStyleArchiveSeed {
  id: string
  code: string
  name: string
  category: string
  styleTags: string[]
  priceBand: string
  status: 'ACTIVE' | 'ARCHIVED'
  effectiveVersionCode: string
  skuCount: number
  technicalVersionCount: number
  costVersionCount: number
  channelCount: number
  originProject: string | null
  updatedAt: string
}

const LEGACY_STYLE_ARCHIVE_SEEDS: LegacyStyleArchiveSeed[] = [
  {
    id: 'style_seed_001',
    code: 'SPU-20260101-001',
    name: '印尼风格碎花连衣裙',
    category: '裙装/连衣裙',
    styleTags: ['波西米亚', '碎花', '度假风'],
    priceBand: '¥299-399',
    status: 'ACTIVE',
    effectiveVersionCode: 'V2.1',
    skuCount: 12,
    technicalVersionCount: 1,
    costVersionCount: 1,
    channelCount: 3,
    originProject: 'PRJ-20251216-001',
    updatedAt: '2026-01-14 10:30',
  },
  {
    id: 'style_seed_002',
    code: 'SPU-20260102-002',
    name: '复古格纹西装外套',
    category: '上装/外套',
    styleTags: ['复古', '格纹', '通勤'],
    priceBand: '¥499-699',
    status: 'ACTIVE',
    effectiveVersionCode: 'V1.0',
    skuCount: 8,
    technicalVersionCount: 1,
    costVersionCount: 1,
    channelCount: 2,
    originProject: 'PRJ-20251220-003',
    updatedAt: '2026-01-13 16:20',
  },
  {
    id: 'style_seed_003',
    code: 'SPU-20260103-003',
    name: '简约针织开衫',
    category: '上装/开衫',
    styleTags: ['简约', '百搭', '休闲'],
    priceBand: '¥199-299',
    status: 'ACTIVE',
    effectiveVersionCode: 'V1.2',
    skuCount: 15,
    technicalVersionCount: 1,
    costVersionCount: 1,
    channelCount: 4,
    originProject: 'PRJ-20251218-002',
    updatedAt: '2026-01-12 09:15',
  },
  {
    id: 'style_seed_004',
    code: 'SPU-20260104-004',
    name: '高腰阔腿牛仔裤',
    category: '裤装/牛仔裤',
    styleTags: ['复古', '显瘦', '百搭'],
    priceBand: '¥249-349',
    status: 'ACTIVE',
    effectiveVersionCode: '',
    skuCount: 6,
    technicalVersionCount: 0,
    costVersionCount: 0,
    channelCount: 0,
    originProject: 'PRJ-20251225-005',
    updatedAt: '2026-01-10 14:00',
  },
  {
    id: 'style_seed_005',
    code: 'SPU-20260105-005',
    name: '法式蕾丝衬衫',
    category: '上装/衬衫',
    styleTags: ['法式', '蕾丝', '优雅'],
    priceBand: '¥299-399',
    status: 'ARCHIVED',
    effectiveVersionCode: 'V3.0',
    skuCount: 10,
    technicalVersionCount: 1,
    costVersionCount: 1,
    channelCount: 1,
    originProject: 'PRJ-20251201-001',
    updatedAt: '2026-01-05 11:30',
  },
  {
    id: 'style_seed_006',
    code: 'SPU-20260106-006',
    name: '运动休闲套装',
    category: '套装/运动套装',
    styleTags: ['运动', '休闲', '舒适'],
    priceBand: '¥399-499',
    status: 'ACTIVE',
    effectiveVersionCode: 'V1.0',
    skuCount: 9,
    technicalVersionCount: 1,
    costVersionCount: 0,
    channelCount: 2,
    originProject: null,
    updatedAt: '2026-01-14 08:00',
  },
]

function splitCategory(category: string): { categoryName: string; subCategoryName: string } {
  const [categoryName = '', subCategoryName = ''] = category.split('/')
  return { categoryName, subCategoryName }
}

function mapArchiveStatus(status: LegacyStyleArchiveSeed['status']): StyleArchiveStatusCode {
  return status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
}

function buildPendingItem(seed: LegacyStyleArchiveSeed): StyleArchivePendingItem | null {
  if (!seed.originProject) return null
  if (findProjectByCode(seed.originProject)) return null
  return {
    pendingId: `style_pending_${seed.code}`,
    rawStyleCode: seed.code,
    rawOriginProject: seed.originProject,
    reason: '历史来源项目在当前项目仓储中不存在，仅保留迁移痕迹。',
    discoveredAt: seed.updatedAt,
  }
}

function buildRecord(seed: LegacyStyleArchiveSeed): StyleArchiveShellRecord {
  const { categoryName, subCategoryName } = splitCategory(seed.category)
  return {
    styleId: seed.id,
    styleCode: seed.code,
    styleName: seed.name,
    styleNumber: '',
    styleType: '',
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
    yearTag: '',
    seasonTags: [],
    styleTags: [...seed.styleTags],
    targetAudienceTags: [],
    targetChannelCodes: [],
    priceRangeLabel: seed.priceBand,
    archiveStatus: mapArchiveStatus(seed.status),
    baseInfoStatus: '已维护',
    specificationStatus: seed.skuCount > 0 ? '已建立' : '未建立',
    technicalDataStatus: seed.technicalVersionCount > 0 ? '已建立' : '未建立',
    costPricingStatus: seed.costVersionCount > 0 ? '已建立' : '未建立',
    specificationCount: seed.skuCount,
    technicalVersionCount: seed.technicalVersionCount,
    costVersionCount: seed.costVersionCount,
    channelProductCount: seed.channelCount,
    effectiveTechnicalVersionId: '',
    effectiveTechnicalVersionCode: seed.effectiveVersionCode,
    effectiveTechnicalVersionLabel: seed.effectiveVersionCode,
    remark: '',
    generatedAt: seed.updatedAt,
    generatedBy: '系统初始化',
    updatedAt: seed.updatedAt,
    updatedBy: '系统初始化',
    legacyOriginProject: seed.originProject || '',
  }
}

export function createStyleArchiveBootstrapSnapshot(version: number): StyleArchiveStoreSnapshot {
  const records = LEGACY_STYLE_ARCHIVE_SEEDS.map(buildRecord)
  const pendingItems = LEGACY_STYLE_ARCHIVE_SEEDS.map(buildPendingItem).filter(Boolean) as StyleArchivePendingItem[]

  return {
    version,
    records,
    pendingItems,
  }
}
