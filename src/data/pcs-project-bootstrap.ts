import { getProjectTemplateById, getProjectTemplateVersion } from './pcs-templates.ts'
import {
  listProjectWorkspaceAges,
  listProjectWorkspaceBrands,
  listProjectWorkspaceCategories,
  listProjectWorkspaceCrowdPositioning,
  listProjectWorkspaceCrowds,
  listProjectWorkspaceProductPositioning,
  listProjectWorkspaceStyleCodes,
  listProjectWorkspaceStyles,
  type ProjectWorkspaceOption,
} from './pcs-project-config-workspace-adapter.ts'
import type {
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectRecord,
  PcsProjectStoreSnapshot,
  ProjectNodeStatus,
  ProjectPhaseStatus,
  ProjectPriorityLevel,
  ProjectSourceType,
  ProjectStatus,
  ProjectType,
  SampleSourceType,
} from './pcs-project-types.ts'
import type { TemplateStyleType } from './pcs-templates.ts'

interface BootstrapProjectSeed {
  projectId: string
  projectCode: string
  projectName: string
  projectType: ProjectType
  projectSourceType: ProjectSourceType
  templateId: string
  categoryId: string
  categoryName: string
  subCategoryId: string
  subCategoryName: string
  brandId: string
  brandName: string
  styleNumber: string
  styleType: TemplateStyleType
  yearTag: string
  seasonTags: string[]
  styleTags: string[]
  targetAudienceTags: string[]
  priceRangeLabel: string
  targetChannelCodes: string[]
  sampleSourceType: SampleSourceType
  sampleSupplierId: string
  sampleSupplierName: string
  sampleLink: string
  sampleUnitPrice: number | null
  ownerId: string
  ownerName: string
  teamId: string
  teamName: string
  collaboratorIds: string[]
  collaboratorNames: string[]
  priorityLevel: ProjectPriorityLevel
  projectStatus: ProjectStatus
  currentPhaseOrder: number
  currentNodeCode?: string
  currentNodeStatus?: ProjectNodeStatus
  issueNodeCode?: string
  issueType?: string
  issueText?: string
  latestNodeCode?: string
  latestResultType?: string
  latestResultText?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  remark: string
  linkedStyleId?: string
  linkedStyleCode?: string
  linkedStyleName?: string
  linkedStyleGeneratedAt?: string
  linkedTechPackVersionId?: string
  linkedTechPackVersionCode?: string
  linkedTechPackVersionLabel?: string
  linkedTechPackVersionStatus?: string
  linkedTechPackVersionPublishedAt?: string
}

interface BootstrapBuildResult {
  project: PcsProjectRecord
  phases: PcsProjectPhaseRecord[]
  nodes: PcsProjectNodeRecord[]
}

interface ResolvedWorkspaceBundle {
  category: ProjectWorkspaceOption
  brand: ProjectWorkspaceOption
  styleCode: ProjectWorkspaceOption
  styleOptions: ProjectWorkspaceOption[]
  crowdPositioning: ProjectWorkspaceOption[]
  ages: ProjectWorkspaceOption[]
  crowds: ProjectWorkspaceOption[]
  productPositioning: ProjectWorkspaceOption[]
}

const WORKSPACE_BRANDS = listProjectWorkspaceBrands()
const WORKSPACE_CATEGORIES = listProjectWorkspaceCategories()
const WORKSPACE_STYLES = listProjectWorkspaceStyles()
const WORKSPACE_STYLE_CODES = listProjectWorkspaceStyleCodes()
const WORKSPACE_CROWD_POSITIONING = listProjectWorkspaceCrowdPositioning()
const WORKSPACE_AGES = listProjectWorkspaceAges()
const WORKSPACE_CROWDS = listProjectWorkspaceCrowds()
const WORKSPACE_PRODUCT_POSITIONING = listProjectWorkspaceProductPositioning()

const STYLE_TYPE_BRAND_INDEX: Record<TemplateStyleType, number> = {
  基础款: 0,
  快时尚款: 1,
  改版款: 2,
  设计款: 3,
}

const STYLE_TYPE_PRODUCT_POSITIONING_INDEX: Record<TemplateStyleType, number> = {
  基础款: 0,
  快时尚款: 4,
  改版款: 2,
  设计款: 1,
}

function pickOptionByIndex(options: ProjectWorkspaceOption[], index: number): ProjectWorkspaceOption {
  if (options.length === 0) {
    throw new Error('配置工作台缺少可用选项，无法生成项目演示数据。')
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

function resolveCategoryOption(seed: BootstrapProjectSeed, fallbackIndex: number): ProjectWorkspaceOption {
  const keywords = [seed.subCategoryName, seed.categoryName, seed.projectName]
  const directMatch = findOptionByKeywords(WORKSPACE_CATEGORIES, keywords)
  if (directMatch) return directMatch
  if (keywords.some((item) => item.includes('裙'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['连衣裙', '半裙', '长裙', '短裙']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 1)
  }
  if (keywords.some((item) => item.includes('裤'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['裤子']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 3)
  }
  if (keywords.some((item) => item.includes('套装'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['套装']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 4)
  }
  if (keywords.some((item) => item.includes('外套') || item.includes('夹克') || item.includes('西装'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['外套']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 9)
  }
  if (keywords.some((item) => item.includes('开衫'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['开衫']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 5)
  }
  if (keywords.some((item) => item.includes('卫衣'))) {
    return findOptionByKeywords(WORKSPACE_CATEGORIES, ['卫衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, 13)
  }
  return findOptionByKeywords(WORKSPACE_CATEGORIES, ['上衣']) ?? pickOptionByIndex(WORKSPACE_CATEGORIES, fallbackIndex)
}

function resolveStyleOptions(seed: BootstrapProjectSeed, fallbackIndex: number): ProjectWorkspaceOption[] {
  const matched = seed.styleTags
    .map((tag) => WORKSPACE_STYLES.find((option) => option.name === tag))
    .filter((item): item is ProjectWorkspaceOption => Boolean(item))
  if (matched.length > 0) return matched
  const inferredKeywords =
    seed.styleType === '设计款'
      ? ['秀场', '优雅']
      : seed.styleType === '改版款'
        ? ['复古', '街头']
        : seed.styleType === '快时尚款'
          ? ['通勤', '甜美']
          : ['休闲']
  return inferredKeywords
    .map((keyword) => findOptionByKeywords(WORKSPACE_STYLES, [keyword]))
    .filter((item): item is ProjectWorkspaceOption => Boolean(item))
    .slice(0, 2)
    .concat(matched)
    .filter((item, index, array) => array.findIndex((target) => target.id === item.id) === index)
    .slice(0, 2)
    .concat(
      matched.length === 0 && inferredKeywords.length === 0 ? [pickOptionByIndex(WORKSPACE_STYLES, fallbackIndex)] : [],
    )
}

function resolveWorkspaceBundle(seed: BootstrapProjectSeed): ResolvedWorkspaceBundle {
  const sequence = Number.parseInt(seed.projectCode.slice(-3), 10) || 0
  const category = resolveCategoryOption(seed, sequence)
  const brand = pickOptionByIndex(
    WORKSPACE_BRANDS,
    STYLE_TYPE_BRAND_INDEX[seed.styleType] + sequence,
  )
  const styleCode =
    findOptionByKeywords(WORKSPACE_STYLE_CODES, [seed.styleNumber, seed.projectName, category.name]) ??
    pickOptionByIndex(WORKSPACE_STYLE_CODES, sequence)
  const styleOptions = resolveStyleOptions(seed, sequence)
  const crowdPositioning =
    seed.targetAudienceTags.some((tag) => tag.includes('穆斯林'))
      ? [findOptionByKeywords(WORKSPACE_CROWD_POSITIONING, ['穆斯林友好', '穆斯林']) ?? pickOptionByIndex(WORKSPACE_CROWD_POSITIONING, 0)]
      : [findOptionByKeywords(WORKSPACE_CROWD_POSITIONING, ['非穆斯林']) ?? pickOptionByIndex(WORKSPACE_CROWD_POSITIONING, 2)]
  const ages = [
    pickOptionByIndex(
      WORKSPACE_AGES,
      seed.styleType === '基础款' || seed.styleType === '快时尚款' ? 0 : 1,
    ),
  ]
  const crowds = [
    pickOptionByIndex(
      WORKSPACE_CROWDS,
      seed.styleType === '基础款' || seed.styleType === '快时尚款' ? 0 : 1,
    ),
  ]
  const productPositioning = [
    pickOptionByIndex(
      WORKSPACE_PRODUCT_POSITIONING,
      STYLE_TYPE_PRODUCT_POSITIONING_INDEX[seed.styleType],
    ),
  ]
  return {
    category,
    brand,
    styleCode,
    styleOptions: styleOptions.length > 0 ? styleOptions : [pickOptionByIndex(WORKSPACE_STYLES, sequence)],
    crowdPositioning,
    ages,
    crowds,
    productPositioning,
  }
}

function createScenarioProjectSeed(
  sequence: string,
  input: Omit<
    BootstrapProjectSeed,
    | 'projectId'
    | 'projectCode'
    | 'yearTag'
    | 'createdAt'
    | 'createdBy'
    | 'updatedAt'
    | 'updatedBy'
    | 'remark'
  > & {
    createdAt: string
    updatedAt: string
    updatedBy?: string
    remark?: string
  },
): BootstrapProjectSeed {
  return {
    ...input,
    projectId: `prj_20251216_${sequence}`,
    projectCode: `PRJ-20251216-${sequence}`,
    yearTag: '2026',
    createdBy: '系统种子',
    updatedBy: input.updatedBy || input.ownerName,
    remark: input.remark || '补充的演示链路项目，覆盖模板、测款分支、技术包与归档场景。',
  }
}

const BOOTSTRAP_PROJECT_SEEDS: BootstrapProjectSeed[] = [
  {
    projectId: 'prj_20251216_001',
    projectCode: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId: 'TPL-001',
    categoryId: 'cat-dress',
    categoryName: '裙装',
    subCategoryId: 'sub-onepiece',
    subCategoryName: '连衣裙',
    brandId: 'brand-higood-main',
    brandName: '海格主品牌',
    styleNumber: 'SPU-2025-0891',
    styleType: '基础款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['休闲', '甜美'],
    targetAudienceTags: ['直播爆款客群'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleSupplierName: '外采平台丙',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-xiaoya', 'user-xiaomei'],
    collaboratorNames: ['小雅', '小美'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'TEST_RESULT_DECISION',
    currentNodeStatus: '待确认',
    latestNodeCode: 'LIVE_TEST_SZ',
    latestResultType: '直播测款汇总',
    latestResultText: '直播测款已完成第三轮，待输出最终结论。',
    createdAt: '2025-12-15 10:02',
    createdBy: '系统种子',
    updatedAt: '2025-12-16 14:30',
    updatedBy: '张丽',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_002',
    projectCode: 'PRJ-20251216-002',
    projectName: '百搭纯色基础短袖',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'cat-top',
    categoryName: '上装',
    subCategoryId: 'sub-tshirt',
    subCategoryName: 'T恤',
    brandId: 'brand-higood-lite',
    brandName: '海格轻快线',
    styleNumber: 'SPU-2025-0892',
    styleType: '快时尚款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['极简', '通勤'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '百元基础带',
    targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-lina'],
    collaboratorNames: ['李娜'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PRE_PATTERN',
    currentNodeStatus: '进行中',
    latestNodeCode: 'TEST_RESULT_DECISION',
    latestResultType: '测款结论',
    latestResultText: '测款通过，已进入工程准备。',
    createdAt: '2025-12-15 09:30',
    createdBy: '系统种子',
    updatedAt: '2025-12-16 12:00',
    updatedBy: '王明',
    remark: '历史演示项目已迁入项目仓储。',
    linkedStyleId: 'style_seed_004',
    linkedStyleCode: 'SPU-2024-004',
    linkedStyleName: 'Kaos Polos Premium',
    linkedStyleGeneratedAt: '2026-03-28 14:00',
    linkedTechPackVersionId: 'tdv_seed_004',
    linkedTechPackVersionCode: 'TDV-LEGACY-004',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-05 09:20',
  },
  {
    projectId: 'prj_20251216_003',
    projectCode: 'PRJ-20251216-003',
    projectName: '夏日休闲牛仔短裤',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'cat-pants',
    categoryName: '裤装',
    subCategoryId: 'sub-shorts',
    subCategoryName: '短裤',
    brandId: 'brand-higood-design',
    brandName: '海格设计线',
    styleNumber: '',
    styleType: '设计款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['休闲', '运动'],
    targetAudienceTags: ['校园青年'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 260,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 2,
    currentNodeCode: 'SAMPLE_CONFIRM',
    currentNodeStatus: '待确认',
    issueNodeCode: 'SAMPLE_CONFIRM',
    issueType: '交付风险',
    issueText: '样衣制作延迟，评审窗口被迫顺延。',
    latestNodeCode: 'SAMPLE_MAKING',
    latestResultType: '样衣制作',
    latestResultText: '样衣首版已完成，等待评审确认。',
    createdAt: '2025-12-14 10:20',
    createdBy: '系统种子',
    updatedAt: '2025-12-15 18:45',
    updatedBy: '李娜',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_004',
    projectCode: 'PRJ-20251216-004',
    projectName: '复古皮质机车夹克',
    projectType: '改版开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-003',
    categoryId: 'cat-outerwear',
    categoryName: '外套',
    subCategoryId: 'sub-jacket',
    subCategoryName: '夹克',
    brandId: 'brand-higood-main',
    brandName: '海格主品牌',
    styleNumber: '',
    styleType: '改版款',
    yearTag: '2026',
    seasonTags: ['秋季'],
    styleTags: ['复古', '街头'],
    targetAudienceTags: ['轻熟客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhaoyun',
    ownerName: '赵云',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '高',
    projectStatus: '已立项',
    currentPhaseOrder: 2,
    currentNodeCode: 'FEASIBILITY_REVIEW',
    currentNodeStatus: '待确认',
    issueNodeCode: 'FEASIBILITY_REVIEW',
    issueType: '待确认事项',
    issueText: '初步可行性判断待补充结论后才可继续。',
    createdAt: '2025-12-15 08:50',
    createdBy: '系统种子',
    updatedAt: '2025-12-15 16:20',
    updatedBy: '赵云',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_005',
    projectCode: 'PRJ-20251216-005',
    projectName: '法式优雅衬衫连衣裙',
    projectType: '设计研发',
    projectSourceType: '企划提案',
    templateId: 'TPL-004',
    categoryId: 'cat-dress',
    categoryName: '裙装',
    subCategoryId: 'sub-onepiece',
    subCategoryName: '连衣裙',
    brandId: 'brand-higood-design',
    brandName: '海格设计线',
    styleNumber: 'SPU-2025-0895',
    styleType: '设计款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['优雅', '通勤'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '四百元形象带',
    targetChannelCodes: ['tiktok-shop', 'lazada'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-jakarta-b',
    sampleSupplierName: '雅加达样衣乙',
    sampleLink: '',
    sampleUnitPrice: 380,
    ownerId: 'user-zhoufang',
    ownerName: '周芳',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-xiaoya', 'user-xiaomei'],
    collaboratorNames: ['小雅', '小美'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 3,
    currentNodeCode: 'LIVE_TEST_SZ',
    currentNodeStatus: '进行中',
    issueNodeCode: 'LIVE_TEST_SZ',
    issueType: '排期冲突',
    issueText: '直播测款排期冲突，测款节奏被迫顺延。',
    latestNodeCode: 'VIDEO_TEST',
    latestResultType: '短视频测款',
    latestResultText: '短视频测款完成两轮，兴趣反馈稳定。',
    createdAt: '2025-12-13 14:20',
    createdBy: '系统种子',
    updatedAt: '2025-12-15 14:10',
    updatedBy: '周芳',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_006',
    projectCode: 'PRJ-20251216-006',
    projectName: '运动休闲卫衣套装',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'cat-set',
    categoryName: '套装',
    subCategoryId: 'sub-sport-set',
    subCategoryName: '运动套装',
    brandId: 'brand-higood-lite',
    brandName: '海格轻快线',
    styleNumber: '',
    styleType: '快时尚款',
    yearTag: '2026',
    seasonTags: ['秋季'],
    styleTags: ['运动', '休闲'],
    targetAudienceTags: ['直播爆款客群'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleSupplierName: '外采平台丙',
    sampleLink: '',
    sampleUnitPrice: 129,
    ownerId: 'user-chengang',
    ownerName: '陈刚',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-xiaomei'],
    collaboratorNames: ['小美'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PRE_PATTERN',
    currentNodeStatus: '进行中',
    latestNodeCode: 'TEST_RESULT_DECISION',
    latestResultType: '测款结论',
    latestResultText: '测款通过，已转入打版准备。',
    createdAt: '2025-12-13 09:30',
    createdBy: '系统种子',
    updatedAt: '2025-12-14 20:30',
    updatedBy: '陈刚',
    remark: '历史演示项目已迁入项目仓储。',
    linkedStyleId: 'style_seed_020',
    linkedStyleCode: 'SPU-TEE-084',
    linkedStyleName: '针织撞色短袖上衣',
    linkedStyleGeneratedAt: '2026-04-01 10:40',
    linkedTechPackVersionId: 'tdv_seed_020',
    linkedTechPackVersionCode: 'TDV-LEGACY-020',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-01 10:40',
  },
  {
    projectId: 'prj_20251216_007',
    projectCode: 'PRJ-20251216-007',
    projectName: '碎花雪纺半身裙',
    projectType: '商品开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-001',
    categoryId: 'cat-dress',
    categoryName: '裙装',
    subCategoryId: 'sub-skirt',
    subCategoryName: '半身裙',
    brandId: 'brand-higood-main',
    brandName: '海格主品牌',
    styleNumber: 'SPU-2025-0788',
    styleType: '基础款',
    yearTag: '2025',
    seasonTags: ['夏季'],
    styleTags: ['甜美', '清新'],
    targetAudienceTags: ['校园青年'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleSupplierName: '外采平台丙',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: [],
    collaboratorNames: [],
    priorityLevel: '中',
    projectStatus: '已归档',
    currentPhaseOrder: 5,
    createdAt: '2025-12-01 10:00',
    createdBy: '系统种子',
    updatedAt: '2025-12-10 10:00',
    updatedBy: '张丽',
    remark: '历史演示项目已迁入项目仓储。',
    linkedStyleId: 'style_seed_019',
    linkedStyleCode: 'SPU-DRESS-083',
    linkedStyleName: '春季定位印花连衣裙',
    linkedStyleGeneratedAt: '2026-03-16 10:20',
    linkedTechPackVersionId: 'tdv_seed_019',
    linkedTechPackVersionCode: 'TDV-LEGACY-019',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-06 16:30',
  },
  {
    projectId: 'prj_20251216_008',
    projectCode: 'PRJ-20251216-008',
    projectName: '商务休闲西装外套',
    projectType: '改版开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-003',
    categoryId: 'cat-outerwear',
    categoryName: '外套',
    subCategoryId: 'sub-suit',
    subCategoryName: '西装',
    brandId: 'brand-higood-main',
    brandName: '海格主品牌',
    styleNumber: '',
    styleType: '改版款',
    yearTag: '2025',
    seasonTags: ['秋季'],
    styleTags: ['商务', '通勤'],
    targetAudienceTags: ['轻熟客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['wechat-mini-program'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '高',
    projectStatus: '已终止',
    currentPhaseOrder: 2,
    currentNodeCode: 'SAMPLE_COST_REVIEW',
    currentNodeStatus: '已取消',
    issueNodeCode: 'SAMPLE_COST_REVIEW',
    issueType: '终止原因',
    issueText: '成本结构不满足目标毛利，项目终止。',
    createdAt: '2025-11-28 09:15',
    createdBy: '系统种子',
    updatedAt: '2025-12-08 15:00',
    updatedBy: '王明',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_009',
    projectCode: 'PRJ-20251216-009',
    projectName: '高腰阔腿牛仔裤',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId: 'TPL-001',
    categoryId: 'cat-pants',
    categoryName: '裤装',
    subCategoryId: 'sub-trousers',
    subCategoryName: '长裤',
    brandId: 'brand-higood-main',
    brandName: '海格主品牌',
    styleNumber: '',
    styleType: '基础款',
    yearTag: '2026',
    seasonTags: ['秋季'],
    styleTags: ['休闲', '百搭'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-jakarta-b',
    sampleSupplierName: '雅加达样衣乙',
    sampleLink: '',
    sampleUnitPrice: 220,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 2,
    currentNodeCode: 'CONTENT_SHOOT',
    currentNodeStatus: '进行中',
    latestNodeCode: 'FEASIBILITY_REVIEW',
    latestResultType: '可行性评估',
    latestResultText: '可行性评估已通过，正在补拍试穿素材。',
    createdAt: '2025-12-12 11:00',
    createdBy: '系统种子',
    updatedAt: '2025-12-14 11:20',
    updatedBy: '李娜',
    remark: '历史演示项目已迁入项目仓储。',
  },
  {
    projectId: 'prj_20251216_010',
    projectCode: 'PRJ-20251216-010',
    projectName: '波西米亚印花长裙',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'cat-dress',
    categoryName: '裙装',
    subCategoryId: 'sub-longdress',
    subCategoryName: '长裙',
    brandId: 'brand-higood-design',
    brandName: '海格设计线',
    styleNumber: '',
    styleType: '设计款',
    yearTag: '2026',
    seasonTags: ['夏季'],
    styleTags: ['度假', '复古'],
    targetAudienceTags: ['度假客群'],
    priceRangeLabel: '四百元形象带',
    targetChannelCodes: ['lazada'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 420,
    ownerId: 'user-zhoufang',
    ownerName: '周芳',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '中',
    projectStatus: '已立项',
    currentPhaseOrder: 1,
    currentNodeCode: 'CREATIVE_DIRECTION_CONFIRM',
    currentNodeStatus: '进行中',
    latestNodeCode: 'CREATIVE_DIRECTION_CONFIRM',
    latestResultType: '创意方向',
    latestResultText: '正在确认创意方向与花型策略。',
    createdAt: '2025-12-16 09:00',
    createdBy: '系统种子',
    updatedAt: '2025-12-16 09:00',
    updatedBy: '周芳',
    remark: '历史演示项目已迁入项目仓储。',
  },
]

const SCENARIO_PROJECT_SEEDS: BootstrapProjectSeed[] = [
  createScenarioProjectSeed('011', {
    projectName: '基础轻甜印花连衣裙',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId: 'TPL-001',
    categoryId: 'seed-cat-dress',
    categoryName: '连衣裙',
    subCategoryId: 'seed-sub-dress',
    subCategoryName: '连衣裙',
    brandId: 'seed-brand',
    brandName: 'Chicmore',
    styleNumber: 'SPU-TSHIRT-081',
    styleType: '基础款',
    seasonTags: ['春夏'],
    styleTags: ['休闲', '甜美'],
    targetAudienceTags: ['年轻女性'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-a',
    sampleSupplierName: '外采平台甲',
    sampleLink: 'https://example.com/demo-011',
    sampleUnitPrice: 118,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-xiaoya'],
    collaboratorNames: ['小雅'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PROJECT_TRANSFER_PREP',
    currentNodeStatus: '进行中',
    latestNodeCode: 'STYLE_ARCHIVE_CREATE',
    latestResultType: '已生成款式档案',
    latestResultText: '测款通过后已建立款式档案，当前状态为技术包待完善。',
    createdAt: '2026-03-18 09:10',
    updatedAt: '2026-04-03 15:20',
    linkedStyleId: 'style_seed_017',
    linkedStyleCode: 'SPU-TSHIRT-081',
    linkedStyleName: '春季休闲印花短袖 T 恤',
    linkedStyleGeneratedAt: '2026-04-03 10:40',
    linkedTechPackVersionId: 'tdv_seed_017',
    linkedTechPackVersionCode: 'TDV-LEGACY-017',
    linkedTechPackVersionLabel: 'V2',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-03 15:20',
  }),
  createScenarioProjectSeed('012', {
    projectName: '快反撞色卫衣套装',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'seed-cat-set',
    categoryName: '套装',
    subCategoryId: 'seed-sub-hoodie',
    subCategoryName: '卫衣套装',
    brandId: 'seed-brand',
    brandName: 'FADFAD',
    styleNumber: 'SPU-HOODIE-082',
    styleType: '快时尚款',
    seasonTags: ['秋季'],
    styleTags: ['休闲', '通勤'],
    targetAudienceTags: ['快反基础客群'],
    priceRangeLabel: '百元基础带',
    targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-lina'],
    collaboratorNames: ['李娜'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PROJECT_TRANSFER_PREP',
    currentNodeStatus: '进行中',
    latestNodeCode: 'STYLE_ARCHIVE_CREATE',
    latestResultType: '已生成款式档案',
    latestResultText: '短视频测款通过，已进入技术包启用前准备。',
    createdAt: '2026-03-16 10:05',
    updatedAt: '2026-04-02 11:00',
    linkedStyleId: 'style_seed_018',
    linkedStyleCode: 'SPU-HOODIE-082',
    linkedStyleName: '连帽拉链卫衣套装',
    linkedStyleGeneratedAt: '2026-04-02 09:50',
    linkedTechPackVersionId: 'tdv_seed_018',
    linkedTechPackVersionCode: 'TDV-LEGACY-018',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-02 11:00',
  }),
  createScenarioProjectSeed('013', {
    projectName: '设计款户外轻量夹克',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'seed-cat-jacket',
    categoryName: '外套',
    subCategoryId: 'seed-sub-jacket',
    subCategoryName: '夹克',
    brandId: 'seed-brand',
    brandName: 'Asaya',
    styleNumber: 'SPU-JACKET-085',
    styleType: '设计款',
    seasonTags: ['秋季'],
    styleTags: ['秀场', '优雅'],
    targetAudienceTags: ['都市通勤人群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 248,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PROJECT_TRANSFER_PREP',
    currentNodeStatus: '进行中',
    latestNodeCode: 'STYLE_ARCHIVE_CREATE',
    latestResultType: '已生成款式档案',
    latestResultText: '直播测款通过，当前等待启用技术包后同步上游商品。',
    createdAt: '2026-03-20 11:20',
    updatedAt: '2026-04-04 16:10',
    linkedStyleId: 'style_seed_021',
    linkedStyleCode: 'SPU-JACKET-085',
    linkedStyleName: '户外轻量夹克',
    linkedStyleGeneratedAt: '2026-04-04 14:30',
    linkedTechPackVersionId: 'tdv_seed_021',
    linkedTechPackVersionCode: 'TDV-LEGACY-021',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-04 16:10',
  }),
  createScenarioProjectSeed('014', {
    projectName: '快反商务修身长袖衬衫',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'seed-cat-shirt',
    categoryName: '上衣',
    subCategoryId: 'seed-sub-shirt',
    subCategoryName: '衬衫',
    brandId: 'seed-brand',
    brandName: 'MODISH',
    styleNumber: 'SPU-SHIRT-086',
    styleType: '快时尚款',
    seasonTags: ['秋季'],
    styleTags: ['通勤', '优雅'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-xiaomei'],
    collaboratorNames: ['小美'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PROJECT_TRANSFER_PREP',
    currentNodeStatus: '进行中',
    latestNodeCode: 'PROJECT_TRANSFER_PREP',
    latestResultType: '已启用当前生效技术包',
    latestResultText: '款式档案已可生产，上游商品已完成最终更新。',
    createdAt: '2026-03-12 08:40',
    updatedAt: '2026-04-05 10:50',
    linkedStyleId: 'style_seed_022',
    linkedStyleCode: 'SPU-SHIRT-086',
    linkedStyleName: '商务修身长袖衬衫',
    linkedStyleGeneratedAt: '2026-04-01 13:20',
    linkedTechPackVersionId: 'tdv_seed_022',
    linkedTechPackVersionCode: 'TDV-LEGACY-022',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-05 10:50',
  }),
  createScenarioProjectSeed('015', {
    projectName: '设计款中式盘扣上衣',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'seed-cat-top',
    categoryName: '上衣',
    subCategoryId: 'seed-sub-top',
    subCategoryName: '上衣',
    brandId: 'seed-brand',
    brandName: 'PRIMA',
    styleNumber: 'SPU-2024-005',
    styleType: '设计款',
    seasonTags: ['春夏'],
    styleTags: ['中式', '优雅'],
    targetAudienceTags: ['设计验证客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 268,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PROJECT_TRANSFER_PREP',
    currentNodeStatus: '进行中',
    latestNodeCode: 'PROJECT_TRANSFER_PREP',
    latestResultType: '已启用当前生效技术包',
    latestResultText: '技术包已启用，款式档案已可生产，渠道店铺商品完成最终更新。',
    createdAt: '2026-03-10 10:30',
    updatedAt: '2026-04-06 14:40',
    linkedStyleId: 'style_seed_005',
    linkedStyleCode: 'SPU-2024-005',
    linkedStyleName: '中式盘扣上衣',
    linkedStyleGeneratedAt: '2026-03-30 11:15',
    linkedTechPackVersionId: 'tdv_seed_005',
    linkedTechPackVersionCode: 'TDV-LEGACY-005',
    linkedTechPackVersionLabel: 'V1',
    linkedTechPackVersionStatus: 'PUBLISHED',
    linkedTechPackVersionPublishedAt: '2026-04-06 14:40',
  }),
  createScenarioProjectSeed('016', {
    projectName: '基础款波点雪纺连衣裙改版',
    projectType: '商品开发',
    projectSourceType: '测款沉淀',
    templateId: 'TPL-001',
    categoryId: 'seed-cat-dress',
    categoryName: '连衣裙',
    subCategoryId: 'seed-sub-dress',
    subCategoryName: '连衣裙',
    brandId: 'seed-brand',
    brandName: 'Chicmore',
    styleNumber: 'SPU-2026-016',
    styleType: '基础款',
    seasonTags: ['春夏'],
    styleTags: ['甜美', '碎花'],
    targetAudienceTags: ['直播爆款客群'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-b',
    sampleSupplierName: '外采平台乙',
    sampleLink: 'https://example.com/demo-016',
    sampleUnitPrice: 129,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-xiaomei'],
    collaboratorNames: ['小美'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PATTERN_TASK',
    currentNodeStatus: '进行中',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为调整，旧渠道店铺商品已作废，并已创建改版任务。',
    createdAt: '2026-03-05 09:20',
    updatedAt: '2026-03-29 18:10',
  }),
  createScenarioProjectSeed('017', {
    projectName: '改版牛仔机车短外套',
    projectType: '改版开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-003',
    categoryId: 'seed-cat-jacket',
    categoryName: '外套',
    subCategoryId: 'seed-sub-jacket',
    subCategoryName: '夹克',
    brandId: 'seed-brand',
    brandName: 'Tendblank',
    styleNumber: 'SPU-2026-017',
    styleType: '改版款',
    seasonTags: ['秋季'],
    styleTags: ['复古', '街头'],
    targetAudienceTags: ['轻熟客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhaoyun',
    ownerName: '赵云',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'FIRST_SAMPLE',
    currentNodeStatus: '进行中',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为调整，当前渠道店铺商品已作废，改版任务正在推进。',
    createdAt: '2026-03-07 11:40',
    updatedAt: '2026-03-31 17:20',
  }),
  createScenarioProjectSeed('018', {
    projectName: '设计款印花阔腿连体裤改版',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'seed-cat-jumpsuit',
    categoryName: '连体裤',
    subCategoryId: 'seed-sub-jumpsuit',
    subCategoryName: '连体裤',
    brandId: 'seed-brand',
    brandName: 'Asaya',
    styleNumber: 'SPU-2026-018',
    styleType: '设计款',
    seasonTags: ['夏季'],
    styleTags: ['秀场', '碎花'],
    targetAudienceTags: ['设计验证客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 286,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '高',
    projectStatus: '进行中',
    currentPhaseOrder: 4,
    currentNodeCode: 'PATTERN_ARTWORK_TASK',
    currentNodeStatus: '进行中',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为调整，当前渠道店铺商品已作废，并已创建改版任务。',
    createdAt: '2026-03-08 14:10',
    updatedAt: '2026-04-01 18:20',
    linkedStyleId: 'style_seed_project_018',
    linkedStyleCode: 'SPU-2026-018',
    linkedStyleName: '设计款印花阔腿连体裤',
    linkedStyleGeneratedAt: '2026-04-01 18:20',
  }),
  createScenarioProjectSeed('019', {
    projectName: '基础款针织开衫暂缓',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId: 'TPL-001',
    categoryId: 'seed-cat-cardigan',
    categoryName: '开衫',
    subCategoryId: 'seed-sub-cardigan',
    subCategoryName: '开衫',
    brandId: 'seed-brand',
    brandName: 'Chicmore',
    styleNumber: 'SPU-2026-019',
    styleType: '基础款',
    seasonTags: ['秋季'],
    styleTags: ['休闲', '通勤'],
    targetAudienceTags: ['通勤白领'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['wechat-mini-program', 'tiktok-shop'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-a',
    sampleSupplierName: '外采平台甲',
    sampleLink: 'https://example.com/demo-019',
    sampleUnitPrice: 109,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-xiaoya'],
    collaboratorNames: ['小雅'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '待确认',
    issueNodeCode: 'TEST_CONCLUSION',
    issueType: '项目阻塞',
    issueText: '测款结论为暂缓，当前项目阻塞，等待下轮市场窗口。',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为暂缓，当前渠道店铺商品已作废，项目阻塞。',
    createdAt: '2026-03-09 09:10',
    updatedAt: '2026-04-02 10:30',
  }),
  createScenarioProjectSeed('020', {
    projectName: '快反POLO衫暂缓',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'seed-cat-top',
    categoryName: '上衣',
    subCategoryId: 'seed-sub-polo',
    subCategoryName: 'POLO衫',
    brandId: 'seed-brand',
    brandName: 'FADFAD',
    styleNumber: 'SPU-2026-020',
    styleType: '快时尚款',
    seasonTags: ['春夏'],
    styleTags: ['休闲', '通勤'],
    targetAudienceTags: ['快反基础客群'],
    priceRangeLabel: '百元基础带',
    targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-lina'],
    collaboratorNames: ['李娜'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '待确认',
    issueNodeCode: 'TEST_CONCLUSION',
    issueType: '项目阻塞',
    issueText: '当前结论为暂缓，等待补齐货盘与流量方案后再重启。',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为暂缓，当前渠道店铺商品已作废，项目阻塞。',
    createdAt: '2026-03-11 10:20',
    updatedAt: '2026-04-03 13:10',
  }),
  createScenarioProjectSeed('021', {
    projectName: '改版都市西装马甲暂缓',
    projectType: '改版开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-003',
    categoryId: 'seed-cat-vest',
    categoryName: '马甲',
    subCategoryId: 'seed-sub-vest',
    subCategoryName: '马甲',
    brandId: 'seed-brand',
    brandName: 'Tendblank',
    styleNumber: 'SPU-2026-021',
    styleType: '改版款',
    seasonTags: ['秋季'],
    styleTags: ['通勤', '复古'],
    targetAudienceTags: ['成熟客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhaoyun',
    ownerName: '赵云',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '待确认',
    issueNodeCode: 'TEST_CONCLUSION',
    issueType: '项目阻塞',
    issueText: '当前测款窗口结束，项目暂缓，等待复盘结论。',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为暂缓，当前渠道店铺商品已作废，项目阻塞。',
    createdAt: '2026-03-12 11:10',
    updatedAt: '2026-04-04 09:40',
  }),
  createScenarioProjectSeed('022', {
    projectName: '设计款民族印花半裙暂缓',
    projectType: '设计研发',
    projectSourceType: '外部灵感',
    templateId: 'TPL-004',
    categoryId: 'seed-cat-skirt',
    categoryName: '半裙',
    subCategoryId: 'seed-sub-skirt',
    subCategoryName: '半裙',
    brandId: 'seed-brand',
    brandName: 'Asaya',
    styleNumber: 'SPU-2026-022',
    styleType: '设计款',
    seasonTags: ['夏季'],
    styleTags: ['碎花', '秀场'],
    targetAudienceTags: ['设计验证客群'],
    priceRangeLabel: '三百元升级带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-shenzhen-a',
    sampleSupplierName: '深圳版房甲',
    sampleLink: '',
    sampleUnitPrice: 302,
    ownerId: 'user-lina',
    ownerName: '李娜',
    teamId: 'team-design',
    teamName: '设计研发组',
    collaboratorIds: ['user-zhaoyun'],
    collaboratorNames: ['赵云'],
    priorityLevel: '中',
    projectStatus: '进行中',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '待确认',
    issueNodeCode: 'TEST_CONCLUSION',
    issueType: '项目阻塞',
    issueText: '测款结论为暂缓，等待重新评估花型方向。',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为暂缓，当前渠道店铺商品已作废，项目阻塞。',
    createdAt: '2026-03-13 15:00',
    updatedAt: '2026-04-04 15:30',
  }),
  createScenarioProjectSeed('023', {
    projectName: '基础款男装休闲夹克淘汰',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId: 'TPL-001',
    categoryId: 'seed-cat-jacket',
    categoryName: '外套',
    subCategoryId: 'seed-sub-jacket',
    subCategoryName: '夹克',
    brandId: 'seed-brand',
    brandName: 'Chicmore',
    styleNumber: 'SPU-2026-023',
    styleType: '基础款',
    seasonTags: ['秋季'],
    styleTags: ['休闲', '街头'],
    targetAudienceTags: ['男装休闲客群'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleSupplierName: '外采平台丙',
    sampleLink: 'https://example.com/demo-023',
    sampleUnitPrice: 146,
    ownerId: 'user-zhangli',
    ownerName: '张丽',
    teamId: 'team-plan',
    teamName: '商品企划组',
    collaboratorIds: ['user-xiaoya'],
    collaboratorNames: ['小雅'],
    priorityLevel: '中',
    projectStatus: '已终止',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '已取消',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为淘汰，当前渠道店铺商品已作废，项目终止。',
    createdAt: '2026-03-14 09:40',
    updatedAt: '2026-04-05 11:10',
  }),
  createScenarioProjectSeed('024', {
    projectName: '快反居家套装淘汰',
    projectType: '快反上新',
    projectSourceType: '渠道反馈',
    templateId: 'TPL-002',
    categoryId: 'seed-cat-set',
    categoryName: '套装',
    subCategoryId: 'seed-sub-homewear',
    subCategoryName: '居家套装',
    brandId: 'seed-brand',
    brandName: 'FADFAD',
    styleNumber: 'SPU-2026-024',
    styleType: '快时尚款',
    seasonTags: ['春夏'],
    styleTags: ['休闲', '甜美'],
    targetAudienceTags: ['快反基础客群'],
    priceRangeLabel: '百元基础带',
    targetChannelCodes: ['wechat-mini-program', 'tiktok-shop'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-wangming',
    ownerName: '王明',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-lina'],
    collaboratorNames: ['李娜'],
    priorityLevel: '低',
    projectStatus: '已终止',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '已取消',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '直播与短视频双渠道测款不及预期，项目淘汰。',
    createdAt: '2026-03-15 10:20',
    updatedAt: '2026-04-05 16:20',
  }),
  createScenarioProjectSeed('025', {
    projectName: '改版针织背心淘汰',
    projectType: '改版开发',
    projectSourceType: '历史复用',
    templateId: 'TPL-003',
    categoryId: 'seed-cat-vest',
    categoryName: '马甲',
    subCategoryId: 'seed-sub-vest',
    subCategoryName: '马甲',
    brandId: 'seed-brand',
    brandName: 'Tendblank',
    styleNumber: 'SPU-2026-025',
    styleType: '改版款',
    seasonTags: ['春夏'],
    styleTags: ['通勤', '复古'],
    targetAudienceTags: ['成熟客群'],
    priceRangeLabel: '两百元主销带',
    targetChannelCodes: ['tiktok-shop', 'shopee'],
    sampleSourceType: '自打样',
    sampleSupplierId: '',
    sampleSupplierName: '',
    sampleLink: '',
    sampleUnitPrice: null,
    ownerId: 'user-zhaoyun',
    ownerName: '赵云',
    teamId: 'team-fast',
    teamName: '快反开发组',
    collaboratorIds: ['user-zhouqiang'],
    collaboratorNames: ['周强'],
    priorityLevel: '低',
    projectStatus: '已终止',
    currentPhaseOrder: 3,
    currentNodeCode: 'TEST_CONCLUSION',
    currentNodeStatus: '已取消',
    latestNodeCode: 'TEST_CONCLUSION',
    latestResultType: '测款结论',
    latestResultText: '测款结论为淘汰，当前渠道店铺商品已作废，项目终止。',
    createdAt: '2026-03-16 13:30',
    updatedAt: '2026-04-06 09:50',
  }),
]

const ALL_BOOTSTRAP_PROJECT_SEEDS = [...BOOTSTRAP_PROJECT_SEEDS, ...SCENARIO_PROJECT_SEEDS]

function normalizePhaseStatus(status: ProjectPhaseStatus): ProjectPhaseStatus {
  return status
}

function buildPhaseStatus(seed: BootstrapProjectSeed, phaseOrder: number): ProjectPhaseStatus {
  if (seed.projectStatus === '已归档') return '已完成'
  if (seed.projectStatus === '已终止') {
    if (phaseOrder < seed.currentPhaseOrder) return '已完成'
    if (phaseOrder === seed.currentPhaseOrder) return '已终止'
    return '未开始'
  }
  if (phaseOrder < seed.currentPhaseOrder) return '已完成'
  if (phaseOrder === seed.currentPhaseOrder) return '进行中'
  return '未开始'
}

function buildPendingActionText(status: ProjectNodeStatus, workItemName: string): string {
  if (status === '已完成') return '节点已完成'
  if (status === '进行中') return `当前请处理：${workItemName}`
  if (status === '待确认') return `当前待确认：${workItemName}`
  if (status === '已取消') return '节点已取消'
  return '等待进入执行'
}

const LEGACY_BOOTSTRAP_NODE_CODE_MAP: Record<string, string> = {
  TEST_RESULT_DECISION: 'TEST_CONCLUSION',
  LIVE_TEST_SZ: 'LIVE_TEST',
  LIVE_TEST_JKT: 'LIVE_TEST',
  PRE_PATTERN: 'PATTERN_TASK',
  PRE_PRINT: 'PATTERN_ARTWORK_TASK',
  PRE_SAMPLE_FLOW: 'FIRST_SAMPLE',
  SAMPLE_MAKING: 'FIRST_SAMPLE',
  CONTENT_SHOOT: 'SAMPLE_SHOOT_FIT',
  CREATIVE_DIRECTION_CONFIRM: 'PROJECT_INIT',
  PRODUCT_LISTING: 'CHANNEL_PRODUCT_LISTING',
  PROJECT_TRANSFER: 'PROJECT_TRANSFER_PREP',
  SAMPLE_STORAGE: 'SAMPLE_RETAIN_REVIEW',
  ASSET_RETURN: 'SAMPLE_RETURN_HANDLE',
}

function normalizeBootstrapNodeCode(code: string | undefined): string {
  if (!code) return ''
  return LEGACY_BOOTSTRAP_NODE_CODE_MAP[code] ?? code
}

function buildProjectFromSeed(seed: BootstrapProjectSeed, currentPhaseCode: string, currentPhaseName: string): PcsProjectRecord {
  const template = getProjectTemplateById(seed.templateId)
  const workspace = resolveWorkspaceBundle(seed)
  return {
    projectId: seed.projectId,
    projectCode: seed.projectCode,
    projectName: seed.projectName,
    projectType: seed.projectType,
    projectSourceType: seed.projectSourceType,
    templateId: seed.templateId,
    templateName: template?.name ?? seed.templateId,
    templateVersion: template ? getProjectTemplateVersion(template) : seed.updatedAt,
    projectStatus: seed.projectStatus,
    currentPhaseCode,
    currentPhaseName,
    categoryId: workspace.category.id,
    categoryName: workspace.category.name,
    subCategoryId: seed.subCategoryId,
    subCategoryName: seed.subCategoryName,
    brandId: workspace.brand.id,
    brandName: workspace.brand.name,
    styleNumber: seed.styleNumber || workspace.styleCode.name,
    styleCodeId: workspace.styleCode.id,
    styleCodeName: workspace.styleCode.name,
    styleType: seed.styleType,
    yearTag: seed.yearTag,
    seasonTags: [...seed.seasonTags],
    styleTags: workspace.styleOptions.map((item) => item.name),
    styleTagIds: workspace.styleOptions.map((item) => item.id),
    styleTagNames: workspace.styleOptions.map((item) => item.name),
    crowdPositioningIds: workspace.crowdPositioning.map((item) => item.id),
    crowdPositioningNames: workspace.crowdPositioning.map((item) => item.name),
    ageIds: workspace.ages.map((item) => item.id),
    ageNames: workspace.ages.map((item) => item.name),
    crowdIds: workspace.crowds.map((item) => item.id),
    crowdNames: workspace.crowds.map((item) => item.name),
    productPositioningIds: workspace.productPositioning.map((item) => item.id),
    productPositioningNames: workspace.productPositioning.map((item) => item.name),
    targetAudienceTags: [...seed.targetAudienceTags],
    priceRangeLabel: seed.priceRangeLabel,
    targetChannelCodes: [...seed.targetChannelCodes],
    projectAlbumUrls: [],
    sampleSourceType: seed.sampleSourceType,
    sampleSupplierId: seed.sampleSupplierId,
    sampleSupplierName: seed.sampleSupplierName,
    sampleLink: seed.sampleLink,
    sampleUnitPrice: seed.sampleUnitPrice,
    ownerId: seed.ownerId,
    ownerName: seed.ownerName,
    teamId: seed.teamId,
    teamName: seed.teamName,
    collaboratorIds: [...seed.collaboratorIds],
    collaboratorNames: [...seed.collaboratorNames],
    priorityLevel: seed.priorityLevel,
    createdAt: seed.createdAt,
    createdBy: seed.createdBy,
    updatedAt: seed.updatedAt,
    updatedBy: seed.updatedBy,
    remark: seed.remark,
    linkedStyleId: seed.linkedStyleId || '',
    linkedStyleCode: seed.linkedStyleCode || '',
    linkedStyleName: seed.linkedStyleName || '',
    linkedStyleGeneratedAt: seed.linkedStyleGeneratedAt || '',
    linkedTechPackVersionId: seed.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: seed.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: seed.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: seed.linkedTechPackVersionStatus || '',
    linkedTechPackVersionPublishedAt: seed.linkedTechPackVersionPublishedAt || '',
  }
}

function buildBootstrapRecords(seed: BootstrapProjectSeed): BootstrapBuildResult {
  const template = getProjectTemplateById(seed.templateId)
  if (!template) {
    throw new Error(`未找到初始化项目模板：${seed.templateId}`)
  }

  const sortedStages = template.stages
    .map((stage) => ({
      stage,
      phaseCode: stage.phaseCode,
      phaseName: stage.phaseName,
      phaseOrder: stage.phaseOrder,
    }))
    .sort((a, b) => a.phaseOrder - b.phaseOrder)

  const currentStage = sortedStages.find((stage) => stage.phaseOrder === seed.currentPhaseOrder) || sortedStages[0]
  const project = buildProjectFromSeed(seed, currentStage.phaseCode, currentStage.phaseName)

  const phases = sortedStages.map((stage) => ({
    projectPhaseId: `${seed.projectId}-phase-${String(stage.phaseOrder).padStart(2, '0')}`,
    projectId: seed.projectId,
    phaseCode: stage.phaseCode,
    phaseName: stage.phaseName,
    phaseOrder: stage.phaseOrder,
    phaseStatus: normalizePhaseStatus(buildPhaseStatus(seed, stage.phaseOrder)),
    startedAt: stage.phaseOrder <= seed.currentPhaseOrder ? seed.createdAt : '',
    finishedAt:
      seed.projectStatus === '已归档' || stage.phaseOrder < seed.currentPhaseOrder
        ? seed.updatedAt
        : '',
    ownerId: seed.ownerId,
    ownerName: seed.ownerName,
  }))

  const normalizedCurrentNodeCode = normalizeBootstrapNodeCode(seed.currentNodeCode)
  const normalizedIssueNodeCode = normalizeBootstrapNodeCode(seed.issueNodeCode)
  const normalizedLatestNodeCode = normalizeBootstrapNodeCode(seed.latestNodeCode)
  const currentStageNodes = template.nodes
    .filter((node) => node.phaseCode === currentStage.phaseCode)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
  const currentStageNodeIndexByCode = new Map<string, number>(
    currentStageNodes.map((item, index) => [item.workItemTypeCode, index]),
  )
  const currentNodeIndex = currentStageNodeIndexByCode.get(normalizedCurrentNodeCode) ?? 0

  const orderedNodes = template.nodes
    .slice()
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })

  const nodes = orderedNodes.map((item) => {
      const stage = sortedStages.find((candidate) => candidate.phaseCode === item.phaseCode)
      const itemIndex = currentStage.phaseCode === item.phaseCode ? currentStageNodeIndexByCode.get(item.workItemTypeCode) ?? 0 : item.sequenceNo - 1
      const stageOrder = stage?.phaseOrder ?? 999
      let status: ProjectNodeStatus

      if (seed.projectStatus === '已归档') {
        status = '已完成'
      } else if (seed.projectStatus === '已终止') {
        if (stageOrder < seed.currentPhaseOrder) {
          status = '已完成'
        } else if (stageOrder > seed.currentPhaseOrder) {
          status = '已取消'
        } else if (itemIndex < currentNodeIndex) {
          status = '已完成'
        } else if (item.workItemTypeCode === normalizedCurrentNodeCode) {
          status = seed.currentNodeStatus || '已取消'
        } else {
          status = '已取消'
        }
      } else if (stageOrder < seed.currentPhaseOrder) {
        status = '已完成'
      } else if (stageOrder > seed.currentPhaseOrder) {
        status = '未开始'
      } else if (itemIndex < currentNodeIndex) {
        status = '已完成'
      } else if (item.workItemTypeCode === normalizedCurrentNodeCode || (!normalizedCurrentNodeCode && itemIndex === 0)) {
        status = seed.currentNodeStatus || '进行中'
      } else {
        status = '未开始'
      }

      const hasLatestResult =
        normalizedLatestNodeCode === item.workItemTypeCode ||
        (status === '已完成' && stageOrder <= seed.currentPhaseOrder)

      return {
        projectNodeId: `${seed.projectId}-node-${item.phaseCode}-${String(item.sequenceNo).padStart(2, '0')}`,
        projectId: seed.projectId,
        phaseCode: item.phaseCode,
        phaseName: item.phaseName,
        workItemId: item.workItemId,
        workItemTypeCode: item.workItemTypeCode,
        workItemTypeName: item.workItemTypeName,
        sequenceNo: item.sequenceNo,
        requiredFlag: item.requiredFlag,
        multiInstanceFlag: item.multiInstanceFlag,
        currentStatus: status,
        currentOwnerId: seed.ownerId,
        currentOwnerName: seed.ownerName,
        validInstanceCount: hasLatestResult ? 1 : 0,
        latestInstanceId: hasLatestResult ? `${seed.projectId}-instance-${item.phaseCode}-${String(item.sequenceNo).padStart(2, '0')}` : '',
        latestInstanceCode: hasLatestResult ? `${seed.projectCode}-${item.phaseCode}-${String(item.sequenceNo).padStart(2, '0')}` : '',
        latestResultType:
          normalizedLatestNodeCode === item.workItemTypeCode
            ? seed.latestResultType || '最近结果'
            : status === '已完成'
              ? '节点完成'
              : '',
        latestResultText:
          normalizedLatestNodeCode === item.workItemTypeCode
            ? seed.latestResultText || ''
            : status === '已完成'
              ? `${item.workItemTypeName}已完成。`
              : '',
        currentIssueType: normalizedIssueNodeCode === item.workItemTypeCode ? seed.issueType || '当前问题' : '',
        currentIssueText: normalizedIssueNodeCode === item.workItemTypeCode ? seed.issueText || '' : '',
        pendingActionType: status === '待确认' ? '待确认' : status === '已取消' ? '已取消' : '待执行',
        pendingActionText: buildPendingActionText(status, item.workItemTypeName),
        sourceTemplateNodeId: item.templateNodeId,
        sourceTemplateVersion: item.templateVersion || getProjectTemplateVersion(template),
      }
    })

  return { project, phases, nodes }
}

export function createBootstrapProjectSnapshot(version: number): PcsProjectStoreSnapshot {
  const builds = ALL_BOOTSTRAP_PROJECT_SEEDS.map((seed) => buildBootstrapRecords(seed))
  return {
    version,
    projects: builds.map((item) => item.project),
    phases: builds.flatMap((item) => item.phases),
    nodes: builds.flatMap((item) => item.nodes),
  }
}
