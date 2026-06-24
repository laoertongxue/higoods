import type { PcsProjectStoreSnapshot } from './pcs-project-types.ts'
import { listProjectTemplates, type ProjectTemplate } from './pcs-templates.ts'
import {
  buildProjectPhaseRecordsFromTemplate,
  buildProjectNodeRecordsFromTemplate,
} from './pcs-project-node-factory.ts'

const DEMO_PROJECTS = [
  {
    projectCode: 'PRJ-202603-001', projectName: '法式碎花连衣裙',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '连衣裙', brandName: 'ASAYA', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['碎花', '优雅'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['都市白领'],
    sampleSourceType: '外采', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 85,
    ownerName: '张丽', teamName: '商品企划组',
    progressLevel: 'PHASE_03', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-002', projectName: '通勤直筒西裤',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '裤子', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['通勤', '简约'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['职场女性'],
    sampleSourceType: '外采', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 65,
    ownerName: '王明', teamName: '商品企划组',
    progressLevel: 'PHASE_02', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-003', projectName: '春季休闲印花短袖T恤',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '上衣', brandName: '品牌B', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['休闲', '印花'], priceRangeLabel: '¥159-299',
    targetChannelCodes: ['SHOPEE'], targetAudienceTags: ['学生', '白领'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 28,
    ownerName: '李娜', teamName: '快反开发组',
    progressLevel: 'PHASE_05', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-004', projectName: 'Polo Shirt Pique 男装',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '测款沉淀',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['休闲', '商务'], priceRangeLabel: '¥199-299',
    targetChannelCodes: ['TIKTOK_ID', 'SHOPEE'], targetAudienceTags: ['商务男士'],
    sampleSourceType: '外采', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 45,
    ownerName: '赵云', teamName: '商品企划组',
    progressLevel: 'PHASE_01', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202603-005', projectName: 'Celana Jogger Pria 运动裤',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '外部灵感',
    categoryName: '裤子', brandName: '品牌B', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['运动', '街头'], priceRangeLabel: '¥159-299',
    targetChannelCodes: ['TIKTOK_VN'], targetAudienceTags: ['运动爱好者'],
    sampleSourceType: '委托打样', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 52,
    ownerName: '周芳', teamName: '快反开发组',
    progressLevel: 'PHASE_04', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-006', projectName: 'Kemeja Batik Pria Modern 现代蜡染衬衫',
    templateId: 'TPL-001', projectType: '设计研发', projectSourceType: '企划提案',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['中式', '爵士'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID', 'TIKTOK_VN'], targetAudienceTags: ['时尚人士'],
    sampleSourceType: '委托打样', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 78,
    ownerName: '陈刚', teamName: '设计研发组',
    progressLevel: 'PHASE_03', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-007', projectName: 'Dress Wanita Casual 休闲连衣短裙',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '连衣裙', brandName: '品牌B', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['休闲', '简约'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['SHOPEE'], targetAudienceTags: ['学生', '白领'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 42,
    ownerName: '李娜', teamName: '快反开发组',
    progressLevel: 'PHASE_02', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202603-008', projectName: '男士休闲长裤',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '历史复用',
    categoryName: '裤子', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['休闲', '通勤'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['职场男性'],
    sampleSourceType: '外采', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 58,
    ownerName: '王明', teamName: '商品企划组',
    progressLevel: 'PHASE_05', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-009', projectName: 'Rok Mini Plisket 百褶短裙',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '短裙', brandName: '品牌B', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['甜美', '青春'], priceRangeLabel: '¥159-299',
    targetChannelCodes: ['TIKTOK_ID', 'TIKTOK_VN'], targetAudienceTags: ['年轻女性'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 35,
    ownerName: '周芳', teamName: '快反开发组',
    progressLevel: 'PHASE_03', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202603-010', projectName: 'Blazer Wanita Formal 女装正装外套',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '外套', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['通勤', '优雅'], priceRangeLabel: '¥399-699',
    targetChannelCodes: ['TIKTOK_ID', 'SHOPEE'], targetAudienceTags: ['职场女性'],
    sampleSourceType: '委托打样', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 120,
    ownerName: '张丽', teamName: '商品企划组',
    progressLevel: 'PHASE_01', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202603-011', projectName: 'Jaket Hoodie Unisex 连帽夹克',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '外部灵感',
    categoryName: '外套', brandName: '品牌B', yearTag: '2026', seasonTags: ['秋季'],
    styleTags: ['运动', '休闲'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_VN'], targetAudienceTags: ['学生', '运动爱好者'],
    sampleSourceType: '外采', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 68,
    ownerName: '赵云', teamName: '快反开发组',
    progressLevel: 'PHASE_02', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-012', projectName: 'Kaos Polos Premium 高端纯色T恤',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '测款沉淀',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['简约', '休闲'], priceRangeLabel: '¥199-299',
    targetChannelCodes: ['TIKTOK_ID', 'SHOPEE'], targetAudienceTags: ['白领', '学生'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 32,
    ownerName: '陈刚', teamName: '商品企划组',
    progressLevel: 'PHASE_04', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202603-013', projectName: 'Celana Panjang Formal 正装西裤',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '裤子', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['商务', '通勤'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['职场男性'],
    sampleSourceType: '委托打样', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 95,
    ownerName: '王明', teamName: '商品企划组',
    progressLevel: 'PHASE_05', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-001', projectName: '夏季棉麻度假裙',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '连衣裙', brandName: '品牌B', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['度假', '棉麻'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_VN', 'SHOPEE'], targetAudienceTags: ['年轻女性'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 48,
    ownerName: '张丽', teamName: '快反开发组',
    progressLevel: 'PHASE_01', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202604-002', projectName: 'Kemeja Flanel Pria 格子衬衫',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['秋季'],
    styleTags: ['休闲', '复古'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['时尚男士'],
    sampleSourceType: '委托打样', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 75,
    ownerName: '赵云', teamName: '商品企划组',
    progressLevel: 'PHASE_02', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202604-003', projectName: '秋冬重磅卫衣',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '卫衣', brandName: '品牌B', yearTag: '2026', seasonTags: ['冬季'],
    styleTags: ['休闲', '运动'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID', 'TIKTOK_VN'], targetAudienceTags: ['学生', '运动爱好者'],
    sampleSourceType: '外采', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 88,
    ownerName: '周芳', teamName: '快反开发组',
    progressLevel: 'PHASE_01', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202604-004', projectName: '简约通勤A字裙',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '测款沉淀',
    categoryName: '短裙', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['通勤', '简约'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['职场女性'],
    sampleSourceType: '外采', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 55,
    ownerName: '陈刚', teamName: '商品企划组',
    progressLevel: 'PHASE_03', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-005', projectName: '蕾丝拼接晚宴裙',
    templateId: 'TPL-001', projectType: '设计研发', projectSourceType: '企划提案',
    categoryName: '连衣裙', brandName: '品牌A', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['优雅', '蕾丝'], priceRangeLabel: '¥399-699',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['时尚人士'],
    sampleSourceType: '委托打样', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 150,
    ownerName: '张丽', teamName: '设计研发组',
    progressLevel: 'PHASE_05', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-006', projectName: '工装束脚口运动裤',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '外部灵感',
    categoryName: '裤子', brandName: '品牌B', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['运动', '工装'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_VN'], targetAudienceTags: ['学生', '运动爱好者'],
    sampleSourceType: '外采', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 62,
    ownerName: '李娜', teamName: '快反开发组',
    progressLevel: 'PHASE_04', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-007', projectName: '民族风刺绣连衣裙',
    templateId: 'TPL-003', projectType: '设计研发', projectSourceType: '企划提案',
    categoryName: '连衣裙', brandName: '品牌A', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['中式', '民族'], priceRangeLabel: '¥399-699',
    targetChannelCodes: ['TIKTOK_ID', 'SHOPEE'], targetAudienceTags: ['时尚人士'],
    sampleSourceType: '委托打样', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 135,
    ownerName: '陈刚', teamName: '设计研发组',
    progressLevel: 'PHASE_03', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-008', projectName: '情侣款牛仔短裤',
    templateId: 'TPL-001', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '裤子', brandName: '品牌B', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['牛仔', '休闲'], priceRangeLabel: '¥199-299',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['学生', '年轻情侣'],
    sampleSourceType: '外采', sampleSupplierName: '外采平台丙', sampleUnitPrice: 38,
    ownerName: '周芳', teamName: '快反开发组',
    progressLevel: 'PHASE_02', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-009', projectName: '夏威夷风度假衬衫',
    templateId: 'TPL-001', projectType: '商品开发', projectSourceType: '企划提案',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['度假', '印花'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_VN', 'TIKTOK_ID'], targetAudienceTags: ['时尚男士'],
    sampleSourceType: '外采', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 68,
    ownerName: '赵云', teamName: '商品企划组',
    progressLevel: 'PHASE_03', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-011', projectName: '通勤薄款针织开衫',
    templateId: 'TPL-003', projectType: '商品开发', projectSourceType: '测款沉淀',
    categoryName: '外套', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['通勤', '针织'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['职场女性'],
    sampleSourceType: '委托打样', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 98,
    ownerName: '王明', teamName: '商品企划组',
    progressLevel: 'PHASE_04', decisionPassed: true,
  },
  {
    projectCode: 'PRJ-202604-012', projectName: '秋冬加绒卫裤',
    templateId: 'TPL-003', projectType: '快反上新', projectSourceType: '渠道反馈',
    categoryName: '裤子', brandName: '品牌B', yearTag: '2026', seasonTags: ['冬季'],
    styleTags: ['运动', '休闲'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_VN'], targetAudienceTags: ['学生', '运动爱好者'],
    sampleSourceType: '外采', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 72,
    ownerName: '李娜', teamName: '快反开发组',
    progressLevel: 'PHASE_02', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202604-013', projectName: '镂空蕾丝拼接上衣',
    templateId: 'TPL-003', projectType: '改版开发', projectSourceType: '企划提案',
    categoryName: '上衣', brandName: '品牌A', yearTag: '2026', seasonTags: ['夏季'],
    styleTags: ['蕾丝', '拼接'], priceRangeLabel: '¥299-499',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['时尚女性'],
    sampleSourceType: '委托打样', sampleSupplierName: '深圳版房甲', sampleUnitPrice: 110,
    ownerName: '陈刚', teamName: '设计研发组',
    progressLevel: 'PHASE_01', decisionPassed: false,
  },
  {
    projectCode: 'PRJ-202604-014', projectName: '修身弹力牛仔裤',
    templateId: 'TPL-003', projectType: '改版开发', projectSourceType: '测款沉淀',
    categoryName: '裤子', brandName: '品牌A', yearTag: '2026', seasonTags: ['春季'],
    styleTags: ['牛仔', '简约'], priceRangeLabel: '¥199-399',
    targetChannelCodes: ['TIKTOK_ID'], targetAudienceTags: ['年轻女性'],
    sampleSourceType: '委托打样', sampleSupplierName: '雅加达样衣乙', sampleUnitPrice: 82,
    ownerName: '张丽', teamName: '商品企划组',
    progressLevel: 'PHASE_05', decisionPassed: true,
  },
] as const

const USER_IDS: Record<string, string> = {
  '张丽': 'user-zhangli', '王明': 'user-wangming', '李娜': 'user-lina',
  '赵云': 'user-zhaoyun', '周芳': 'user-zhoufang', '陈刚': 'user-chengang',
}
const TEAM_IDS: Record<string, string> = {
  '商品企划组': 'team-plan', '快反开发组': 'team-fast', '设计研发组': 'team-design', '工程打样组': 'team-engineering',
}

function pad(number: number, length = 2): string {
  return String(number).padStart(length, '0')
}

function dateText(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function dateTimeText(year: number, month: number, day: number, hour = 9, minute = 0): string {
  return `${dateText(year, month, day)} ${pad(hour)}:${pad(minute)}:00`
}

export function createBootstrapProjectSnapshot(version: number): PcsProjectStoreSnapshot {
  const templates = listProjectTemplates()
  const templateMap = new Map(templates.map((t) => [t.id, t]))

  const projects: any[] = []
  const phases: any[] = []
  const nodes: any[] = []

  DEMO_PROJECTS.forEach((cfg, index) => {
    const template = templateMap.get(cfg.templateId)
    if (!template) return

    const projectId = `PRJ-${String(index + 1).padStart(3, '0')}`
    const createdYear = parseInt(cfg.projectCode.split('-')[1]) || 2026
    const createdMonth = parseInt(cfg.projectCode.split('-')[2]) || 3
    const dayBase = (index % 28) + 1
    const createdAt = dateTimeText(createdYear, createdMonth, dayBase)
    const updatedAt = dateTimeText(2026, 6, (dayBase + template.stages.length * 3) % 28 + 1, 17, 30)

    const ownerId = USER_IDS[cfg.ownerName] || `user-${cfg.ownerName}`
    const teamId = TEAM_IDS[cfg.teamName] || `team-${cfg.teamName}`

    const projectStatus: string =
      cfg.progressLevel === 'PHASE_01' ? (index === 3 ? '进行中' : '已立项')
      : cfg.progressLevel === 'PHASE_05' ? '已归档'
      : '进行中'

    projects.push({
      projectId,
      projectCode: cfg.projectCode,
      projectName: cfg.projectName,
      projectType: cfg.projectType,
      projectSourceType: cfg.projectSourceType,
      templateId: cfg.templateId,
      templateName: template.name,
      templateVersion: template.updatedAt,
      projectStatus,
      currentPhaseCode: `PHASE_0${['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'].indexOf(cfg.progressLevel) + 1}`,
      currentPhaseName: ['立项与样衣获取', '样衣形成与商品准备', '市场测款与结论', '款式档案与开发推进', '项目收尾'][
        ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'].indexOf(cfg.progressLevel)
      ],
      categoryId: `cat-${cfg.categoryName}`,
      categoryName: cfg.categoryName,
      subCategoryId: '',
      subCategoryName: '',
      brandId: `brand-${cfg.brandName}`,
      brandName: cfg.brandName,
      styleNumber: `ST-${projectId}`,
      styleCodeId: `style-${cfg.categoryName}`,
      styleCodeName: `${cfg.categoryName}基础款`,
      yearTag: cfg.yearTag,
      seasonTags: [...cfg.seasonTags],
      styleTags: [...cfg.styleTags],
      styleTagIds: [],
      styleTagNames: [],
      crowdPositioningIds: ['crowd-001'],
      crowdPositioningNames: ['大众消费'],
      ageIds: ['age-002'],
      ageNames: ['18-35岁'],
      crowdIds: ['crowd-main'],
      crowdNames: ['主流人群'],
      productPositioningIds: ['pos-001'],
      productPositioningNames: ['性价比'],
      targetAudienceTags: [...cfg.targetAudienceTags],
      priceRangeLabel: cfg.priceRangeLabel,
      targetChannelCodes: [...cfg.targetChannelCodes],
      projectAlbumUrls: [],
      sampleSourceType: cfg.sampleSourceType,
      sampleSupplierId: `supplier-${cfg.sampleSupplierName}`,
      sampleSupplierName: cfg.sampleSupplierName,
      sampleLink: '',
      sampleUnitPrice: cfg.sampleUnitPrice,
      ownerId,
      ownerName: cfg.ownerName,
      teamId,
      teamName: cfg.teamName,
      collaboratorIds: [],
      collaboratorNames: [],
      priorityLevel: index < 5 ? '高' : index < 15 ? '中' : '低',
      createdAt,
      createdBy: cfg.ownerName,
      updatedAt,
      updatedBy: cfg.ownerName,
      remark: '',
      linkedStyleId: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? `style_demand_${cfg.projectCode.replace(/-/g, '_')}` : '',
      linkedStyleCode: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? `STYLE-${cfg.projectCode}` : '',
      linkedStyleName: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? cfg.projectName : '',
      linkedStyleGeneratedAt: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? updatedAt : '',
      linkedTechPackVersionId: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? `tdv_demand_${cfg.projectCode.replace(/-/g, '_')}` : '',
      linkedTechPackVersionCode: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? `TDV-${cfg.projectCode}` : '',
      linkedTechPackVersionLabel: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? 'v1.0' : '',
      linkedTechPackVersionStatus: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? 'PUBLISHED' : '',
      linkedTechPackVersionPublishedAt: cfg.progressLevel === 'PHASE_04' || cfg.progressLevel === 'PHASE_05' ? updatedAt : '',
      projectArchiveId: cfg.progressLevel === 'PHASE_05' ? `archive-${projectId}` : '',
      projectArchiveNo: cfg.progressLevel === 'PHASE_05' ? `ARC-${cfg.projectCode}` : '',
      projectArchiveStatus: cfg.progressLevel === 'PHASE_05' ? 'FINALIZED' : '',
      projectArchiveDocumentCount: cfg.progressLevel === 'PHASE_05' ? 8 : 0,
      projectArchiveFileCount: cfg.progressLevel === 'PHASE_05' ? 12 : 0,
      projectArchiveMissingItemCount: cfg.progressLevel === 'PHASE_05' ? 0 : 0,
      projectArchiveUpdatedAt: cfg.progressLevel === 'PHASE_05' ? updatedAt : '',
      projectArchiveFinalizedAt: cfg.progressLevel === 'PHASE_05' ? updatedAt : '',
    })

    const rawPhases = buildProjectPhaseRecordsFromTemplate({
      projectId,
      ownerId,
      ownerName: cfg.ownerName,
      createdAt,
      template,
    })

    const rawNodes = buildProjectNodeRecordsFromTemplate({
      projectId,
      ownerId,
      ownerName: cfg.ownerName,
      createdAt,
      template,
    })

    const phaseOrderMax = ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'].indexOf(cfg.progressLevel) + 1

    const adjustedPhases = rawPhases.map((phase) => {
      const phaseOrder = phase.phaseOrder
      let phaseStatus: string
      if (phaseOrder < phaseOrderMax) phaseStatus = '已完成'
      else if (phaseOrder === phaseOrderMax) phaseStatus = '进行中'
      else phaseStatus = '未开始'

      return {
        ...phase,
        phaseStatus,
        startedAt: phaseOrder <= phaseOrderMax ? dateTimeText(createdYear, createdMonth, dayBase + phaseOrder, 8, 0) : '',
        finishedAt: phaseOrder < phaseOrderMax ? dateTimeText(createdYear, createdMonth, dayBase + phaseOrder + 5, 18, 0) : '',
      }
    })

    let adjustedNodes = rawNodes.map((node) => {
      const phaseOrder = ['PHASE_01', 'PHASE_02', 'PHASE_03', 'PHASE_04', 'PHASE_05'].indexOf(node.phaseCode) + 1
      const seq = node.sequenceNo
      let nodeStatus: string

      if (phaseOrder < phaseOrderMax) {
        nodeStatus = '已完成'
      } else if (phaseOrder > phaseOrderMax) {
        nodeStatus = '未开始'
      } else {
        const isInit = node.workItemTypeCode === 'PROJECT_INIT'
        const midpoint = Math.ceil(rawNodes.filter((n) => n.phaseCode === node.phaseCode).length / 2)
        if (isInit) nodeStatus = '已完成'
        else if (seq <= midpoint + (cfg.decisionPassed ? 1 : 0)) nodeStatus = '已完成'
        else if (seq === midpoint + 1 || seq === midpoint + 2) nodeStatus = '进行中'
        else nodeStatus = '未开始'
      }

      const completed = nodeStatus === '已完成'
      return {
        ...node,
        currentStatus: nodeStatus,
        validInstanceCount: completed ? 1 : 0,
        latestInstanceId: completed ? `${projectId}-instance-${pad(seq)}` : '',
        latestInstanceCode: completed ? `${projectId}-实例-${pad(seq)}` : '',
        latestResultType: completed ? (node.workItemTypeCode === 'PROJECT_INIT' ? '已创建项目' : '节点完成') : '',
        latestResultText: completed ? (node.workItemTypeCode === 'PROJECT_INIT' ? '商品项目已创建，请补全并完成立项信息。' : `${node.workItemTypeName}已完成。`) : '',
        pendingActionType: nodeStatus === '进行中' ? '待执行' : nodeStatus === '未开始' ? '待开始' : '已完成',
        pendingActionText: nodeStatus === '进行中' ? `当前请处理：${node.workItemTypeName}` : nodeStatus === '未开始' ? '待开始执行' : '节点已完成',
      }
    })

    const listingNodeStarted = adjustedNodes.some(
      (node) => node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING' && node.currentStatus !== '未开始',
    )
    if (listingNodeStarted) {
      adjustedNodes = adjustedNodes.map((node) => {
        if (node.workItemTypeCode !== 'SAMPLE_COST_REVIEW' || node.currentStatus === '已完成') return node
        return {
          ...node,
          currentStatus: '已完成',
          validInstanceCount: 1,
          latestInstanceId: `${projectId}-instance-${pad(node.sequenceNo)}`,
          latestInstanceCode: `${projectId}-实例-${pad(node.sequenceNo)}`,
          latestResultType: '节点完成',
          latestResultText: `${node.workItemTypeName}已完成。`,
          pendingActionType: '已完成',
          pendingActionText: '节点已完成',
        }
      })
    }

    phases.push(...adjustedPhases)
    nodes.push(...adjustedNodes)
  })

  return {
    version,
    projects,
    phases,
    nodes,
  }
}
