import { getProjectTemplateById, getProjectTemplateVersion } from './pcs-templates.ts'
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
}

interface BootstrapBuildResult {
  project: PcsProjectRecord
  phases: PcsProjectPhaseRecord[]
  nodes: PcsProjectNodeRecord[]
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
    issueText: '直播场次排期冲突，测款节奏被迫顺延。',
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
  PRODUCT_LISTING: 'CHANNEL_PRODUCT_PREP',
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
    categoryId: seed.categoryId,
    categoryName: seed.categoryName,
    subCategoryId: seed.subCategoryId,
    subCategoryName: seed.subCategoryName,
    brandId: seed.brandId,
    brandName: seed.brandName,
    styleNumber: seed.styleNumber,
    styleType: seed.styleType,
    yearTag: seed.yearTag,
    seasonTags: [...seed.seasonTags],
    styleTags: [...seed.styleTags],
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
  const built = BOOTSTRAP_PROJECT_SEEDS.map(buildBootstrapRecords)
  return {
    version,
    projects: built.map((item) => item.project),
    phases: built.flatMap((item) => item.phases),
    nodes: built.flatMap((item) => item.nodes),
  }
}
