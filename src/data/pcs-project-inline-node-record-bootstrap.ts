import { createBootstrapProjectSnapshot } from './pcs-project-bootstrap.ts'
import { createBootstrapSampleCloseoutSeeds } from './pcs-sample-bootstrap.ts'
import type { PcsProjectNodeRecord, PcsProjectRecord } from './pcs-project-types.ts'
import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
} from './pcs-project-inline-node-record-types.ts'
import type {
  PcsProjectInlineNodeRecord,
  PcsProjectInlineNodeRef,
  PcsProjectInlineNodeRecordStoreSnapshot,
  PcsProjectInlineNodeRecordWorkItemTypeCode,
} from './pcs-project-inline-node-record-types.ts'

interface EarlyPhaseProjectScenario {
  baseDate: string
  sampleCode: string
  sampleName: string
  sampleSourceType: string
  sampleSupplierId: string
  sampleLink: string
  sampleUnitPrice: number
  externalPlatform: string
  externalShop: string
  quantity: number
  colors: string[]
  sizes: string[]
  expectedArrivalDate: string
  trackingNumber: string
  warehouseLocation: string
  receiver: string
  sampleQuantity: number
  colorCode: string
  sizeCombination: string
  evaluationDimension: string[]
  judgmentDescription: string
  evaluationParticipants: string[]
  reviewRisk: string
  shootPlan: string
  fitFeedback: string
  sampleFlatImageIds: string[]
  sampleTryOnImageIds: string[]
  sampleDetailImageIds: string[]
  sampleVideoUrls: string[]
  shootImageNote: string
  listingCandidateImageIds: string[]
  styleArchiveCandidateImageIds: string[]
  shootDate: string
  shootLocation: string
  photographer: string
  modelName: string
  editingDeadline: string
  confirmResult: string
  confirmNote: string
  appearanceConfirmation: string
  sizeConfirmation: string
  materialConfirmation: string
  revisionRequired: boolean
  actualSampleCost: number
  targetProductionCost: number
  costCompliance: string
  priceRange: string
  pricingNote: string
  pricingStrategy: string
  finalPrice: number
  approvalStatus: string
}

type EarlyPhaseRecordSeed = {
  projectCode: string
  workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode
  sourceDocType: string
  sourceModule: string
  sourceDocCode: string
  businessDate: string
  payload: Record<string, unknown>
  detailSnapshot: Record<string, unknown>
}

interface TestingMetricSeed {
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string | null
  sourceLineCode: string | null
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  exposureQty: number
  clickQty: number
  orderQty: number
  gmvAmount: number
}

interface TestingBranchRecordSeed {
  projectCode: string
  channelProductSequence: string
  summaryBusinessDate: string
  summaryText: string
  summaryOwner: string
  conclusionBusinessDate: string
  conclusion: '' | '通过' | '淘汰'
  conclusionNote: string
  live: TestingMetricSeed
  video: TestingMetricSeed
  linkedStyleId?: string
  linkedStyleCode?: string
  linkedStyleName?: string
  nextActionType?: string
}

function getTestingConclusionNextActionType(conclusion: TestingBranchRecordSeed['conclusion']): string {
  if (conclusion === '通过') return '生成款式档案'
  if (conclusion === '淘汰') return '样衣退回处理'
  return ''
}

const PROJECT_RECORD_PLAN: Record<string, PcsProjectInlineNodeRecordWorkItemTypeCode[]> = {
  'PRJ-20251216-001': [
    'SAMPLE_ACQUIRE',
    'SAMPLE_INBOUND_CHECK',
    'FEASIBILITY_REVIEW',
    'SAMPLE_SHOOT_FIT',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
    'SAMPLE_PRICING',
  ],
  'PRJ-20251216-002': [
    'SAMPLE_ACQUIRE',
    'FEASIBILITY_REVIEW',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
    'SAMPLE_PRICING',
  ],
  'PRJ-20251216-003': [
    'SAMPLE_ACQUIRE',
    'SAMPLE_INBOUND_CHECK',
    'SAMPLE_SHOOT_FIT',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
    'SAMPLE_PRICING',
  ],
  'PRJ-20251216-004': [
    'SAMPLE_ACQUIRE',
    'SAMPLE_INBOUND_CHECK',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
  ],
  'PRJ-20251216-005': ['SAMPLE_SHOOT_FIT'],
  'PRJ-20251216-007': [
    'SAMPLE_ACQUIRE',
    'SAMPLE_INBOUND_CHECK',
    'FEASIBILITY_REVIEW',
    'SAMPLE_SHOOT_FIT',
    'SAMPLE_CONFIRM',
    'SAMPLE_COST_REVIEW',
    'SAMPLE_PRICING',
  ],
}

const PROJECT_SCENARIOS: Record<string, EarlyPhaseProjectScenario> = {
  'PRJ-20251216-001': {
    baseDate: '2026-02-03',
    sampleCode: 'SY-EARLY-0001',
    sampleName: '印尼碎花连衣裙外采样',
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleLink: 'https://demo.higood.local/sample/0001',
    sampleUnitPrice: 168,
    externalPlatform: '抖音商城',
    externalShop: '东南亚女装旗舰店',
    quantity: 2,
    colors: ['樱粉', '米白'],
    sizes: ['S', 'M'],
    expectedArrivalDate: '2026-02-04',
    trackingNumber: 'SF-EARLY-0001',
    warehouseLocation: '深圳主仓-A-01-01',
    receiver: '深圳仓管',
    sampleQuantity: 2,
    colorCode: '樱粉 / 米白',
    sizeCombination: 'S / M',
    evaluationDimension: ['版型', '面料', '测款潜力'],
    judgmentDescription: '样衣整体风格稳定，可进入拍摄与试穿环节。',
    evaluationParticipants: ['张丽', '李版师', '小雅'],
    reviewRisk: '需关注领口包边稳定性。',
    shootPlan: '安排直播前模特试穿与棚拍各一轮。',
    fitFeedback: '上身廓形自然，腰线位置合适。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-06',
    shootLocation: '深圳棚拍一号间',
    photographer: '陈影',
    modelName: '阿琳',
    editingDeadline: '2026-02-07 18:00:00',
    confirmResult: '通过',
    confirmNote: '样衣确认通过，可进入市场测款准备。',
    appearanceConfirmation: '印花清晰，版型顺畅。',
    sizeConfirmation: '样衣尺码与标准尺码一致。',
    materialConfirmation: '面料手感和垂感满足预期。',
    revisionRequired: false,
    actualSampleCost: 158,
    targetProductionCost: 132,
    costCompliance: '基本符合',
    priceRange: '199-239',
    pricingNote: '适合主销价带起测。',
    pricingStrategy: '直播首发价带',
    finalPrice: 219,
    approvalStatus: '已通过',
  },
  'PRJ-20251216-002': {
    baseDate: '2026-02-10',
    sampleCode: 'SY-EARLY-0002',
    sampleName: '碎花快反连衣裙打样样',
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-platform-c',
    sampleLink: 'https://demo.higood.local/sample/0002',
    sampleUnitPrice: 182,
    externalPlatform: '虾皮',
    externalShop: '马来西亚快反店',
    quantity: 1,
    colors: ['黑底花卉'],
    sizes: ['M'],
    expectedArrivalDate: '2026-02-11',
    trackingNumber: 'JT-EARLY-0002',
    warehouseLocation: '深圳主仓-B-02-03',
    receiver: '快反仓管',
    sampleQuantity: 1,
    colorCode: '黑底花卉',
    sizeCombination: 'M',
    evaluationDimension: ['快反速度', '直播适配'],
    judgmentDescription: '快反样衣具备直播试款基础，可推进确认。',
    evaluationParticipants: ['王明', '小美'],
    reviewRisk: '需关注面料缩率。',
    shootPlan: '快反款以挂拍补充为主。',
    fitFeedback: '试穿轮廓利落，适配通勤客群。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-12',
    shootLocation: '深圳直播间',
    photographer: '李影',
    modelName: '安娜',
    editingDeadline: '2026-02-12 22:00:00',
    confirmResult: '通过',
    confirmNote: '样衣确认通过，可直接进入测款准备。',
    appearanceConfirmation: '外观细节满足上架要求。',
    sizeConfirmation: '尺寸稳定。',
    materialConfirmation: '面料表现稳定。',
    revisionRequired: false,
    actualSampleCost: 171,
    targetProductionCost: 145,
    costCompliance: '基本符合',
    priceRange: '239-279',
    pricingNote: '快反款建议保持中腰价带。',
    pricingStrategy: '快反拉新定价',
    finalPrice: 259,
    approvalStatus: '已通过',
  },
  'PRJ-20251216-003': {
    baseDate: '2026-02-13',
    sampleCode: 'SY-EARLY-0003',
    sampleName: '印花半裙设计验证样',
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-design-a',
    sampleLink: '',
    sampleUnitPrice: 196,
    externalPlatform: '抖音商城',
    externalShop: '设计试款店',
    quantity: 2,
    colors: ['青绿印花', '暖杏印花'],
    sizes: ['S', 'M'],
    expectedArrivalDate: '2026-02-14',
    trackingNumber: 'YD-EARLY-0003',
    warehouseLocation: '深圳设计样衣区',
    receiver: '设计样衣仓管',
    sampleQuantity: 2,
    colorCode: '青绿印花 / 暖杏印花',
    sizeCombination: 'S / M',
    evaluationDimension: ['印花还原', '试穿反馈'],
    judgmentDescription: '设计验证样适合继续拍摄和确认。',
    evaluationParticipants: ['李娜', '秀场版师', '设计助理'],
    reviewRisk: '需观察花型在强光下的表现。',
    shootPlan: '安排模特棚拍并补充印花细节特写。',
    fitFeedback: '裙摆动态表现较好，印花识别度高。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-16',
    shootLocation: '深圳摄影棚二号间',
    photographer: '周影',
    modelName: '米娅',
    editingDeadline: '2026-02-17 12:00:00',
    confirmResult: '通过',
    confirmNote: '设计款样衣确认通过。',
    appearanceConfirmation: '花型还原度高。',
    sizeConfirmation: '尺寸表现正常。',
    materialConfirmation: '印花面料稳定。',
    revisionRequired: false,
    actualSampleCost: 188,
    targetProductionCost: 156,
    costCompliance: '基本符合',
    priceRange: '269-329',
    pricingNote: '设计验证款建议采用中高价带。',
    pricingStrategy: '设计感溢价定价',
    finalPrice: 299,
    approvalStatus: '已通过',
  },
  'PRJ-20251216-004': {
    baseDate: '2026-02-18',
    sampleCode: 'SY-EARLY-0004',
    sampleName: '牛仔短裤改版参考样',
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-denim-b',
    sampleLink: 'https://demo.higood.local/sample/0004',
    sampleUnitPrice: 149,
    externalPlatform: '来赞达',
    externalShop: '东南亚牛仔店',
    quantity: 1,
    colors: ['浅牛仔蓝'],
    sizes: ['M'],
    expectedArrivalDate: '2026-02-19',
    trackingNumber: 'YTO-EARLY-0004',
    warehouseLocation: '深圳牛仔样衣区',
    receiver: '牛仔项目仓管',
    sampleQuantity: 1,
    colorCode: '浅牛仔蓝',
    sizeCombination: 'M',
    evaluationDimension: ['改版空间', '工艺稳定性'],
    judgmentDescription: '可作为改版测款参考样，建议继续确认。',
    evaluationParticipants: ['赵云', '牛仔版师'],
    reviewRisk: '需确认后腰工艺与洗水稳定性。',
    shootPlan: '改版款不安排完整拍摄，仅补充上身图。',
    fitFeedback: '腰臀包容性较好。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-20',
    shootLocation: '深圳产品体验区',
    photographer: '杨摄',
    modelName: '苏菲',
    editingDeadline: '2026-02-20 18:00:00',
    confirmResult: '通过',
    confirmNote: '改版参考样确认通过。',
    appearanceConfirmation: '外观符合改版方向。',
    sizeConfirmation: '尺码可作为改版基线。',
    materialConfirmation: '牛仔面料表现正常。',
    revisionRequired: true,
    actualSampleCost: 142,
    targetProductionCost: 126,
    costCompliance: '可控',
    priceRange: '189-229',
    pricingNote: '改版款以验证价带为主。',
    pricingStrategy: '改版试销定价',
    finalPrice: 209,
    approvalStatus: '已通过',
  },
  'PRJ-20251216-005': {
    baseDate: '2026-02-21',
    sampleCode: 'SY-EARLY-0005',
    sampleName: '通勤西装设计试穿样',
    sampleSourceType: '委托打样',
    sampleSupplierId: 'supplier-design-b',
    sampleLink: '',
    sampleUnitPrice: 218,
    externalPlatform: '抖音商城',
    externalShop: '设计通勤店',
    quantity: 1,
    colors: ['炭灰'],
    sizes: ['S'],
    expectedArrivalDate: '2026-02-22',
    trackingNumber: 'SF-EARLY-0005',
    warehouseLocation: '深圳设计试衣区',
    receiver: '设计仓管',
    sampleQuantity: 1,
    colorCode: '炭灰',
    sizeCombination: 'S',
    evaluationDimension: ['设计表达', '上身效果'],
    judgmentDescription: '设计款试穿反馈较好，建议继续完善素材。',
    evaluationParticipants: ['李娜', '通勤设计师'],
    reviewRisk: '肩部结构仍需细看。',
    shootPlan: '安排半天试穿拍摄。',
    fitFeedback: '肩线利落，通勤感明确。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-23',
    shootLocation: '深圳试衣间',
    photographer: '吴摄',
    modelName: '凯西',
    editingDeadline: '2026-02-24 12:00:00',
    confirmResult: '通过',
    confirmNote: '设计试穿反馈良好。',
    appearanceConfirmation: '外观表现稳定。',
    sizeConfirmation: '样衣尺码准确。',
    materialConfirmation: '面料挺括度符合预期。',
    revisionRequired: false,
    actualSampleCost: 205,
    targetProductionCost: 176,
    costCompliance: '基本符合',
    priceRange: '329-399',
    pricingNote: '设计通勤款建议中高价带。',
    pricingStrategy: '设计试穿验证价',
    finalPrice: 359,
    approvalStatus: '已通过',
  },
  'PRJ-20251216-007': {
    baseDate: '2026-02-24',
    sampleCode: 'SY-EARLY-0007',
    sampleName: '基础针织开衫试款样',
    sampleSourceType: '外采',
    sampleSupplierId: 'supplier-knit-a',
    sampleLink: 'https://demo.higood.local/sample/0007',
    sampleUnitPrice: 156,
    externalPlatform: '虾皮',
    externalShop: '基础针织店',
    quantity: 2,
    colors: ['奶油白', '薄荷绿'],
    sizes: ['M', 'L'],
    expectedArrivalDate: '2026-02-25',
    trackingNumber: 'STO-EARLY-0007',
    warehouseLocation: '深圳针织样衣区',
    receiver: '针织仓管',
    sampleQuantity: 2,
    colorCode: '奶油白 / 薄荷绿',
    sizeCombination: 'M / L',
    evaluationDimension: ['穿着舒适度', '直播表现'],
    judgmentDescription: '基础开衫样衣适合进入拍摄和确认。',
    evaluationParticipants: ['张丽', '针织版师', '直播运营'],
    reviewRisk: '需观察纽扣牢度。',
    shootPlan: '安排直播预热视频和上身拍摄。',
    fitFeedback: '上身柔和，适合基础测款。',
    sampleFlatImageIds: [],
    sampleTryOnImageIds: [],
    sampleDetailImageIds: [],
    sampleVideoUrls: [],
    shootImageNote: '',
    listingCandidateImageIds: [],
    styleArchiveCandidateImageIds: [],
    shootDate: '2026-02-27',
    shootLocation: '深圳直播间二号位',
    photographer: '林摄',
    modelName: '艾米',
    editingDeadline: '2026-02-28 12:00:00',
    confirmResult: '通过',
    confirmNote: '基础开衫样衣确认通过。',
    appearanceConfirmation: '外观柔和自然。',
    sizeConfirmation: 'M/L 组合满足试款需要。',
    materialConfirmation: '针织面料舒适度较高。',
    revisionRequired: false,
    actualSampleCost: 148,
    targetProductionCost: 124,
    costCompliance: '符合',
    priceRange: '169-219',
    pricingNote: '基础针织款建议保留亲民价带。',
    pricingStrategy: '基础主销定价',
    finalPrice: 199,
    approvalStatus: '已通过',
  },
}

const TESTING_BRANCH_RECORDS: TestingBranchRecordSeed[] = [
  {
    projectCode: 'PRJ-20251216-013',
    channelProductSequence: '01',
    summaryBusinessDate: '2026-04-04 15:40:00',
    summaryText: '直播与短视频两路测款均表现稳定，建议进入款式档案与技术包完善链路。',
    summaryOwner: '商品运营',
    conclusionBusinessDate: '2026-04-04 16:10:00',
    conclusion: '通过',
    conclusionNote: '测款结论为通过，保留当前渠道店铺商品并进入款式档案完善阶段。',
    live: {
      sourceObjectId: 'LS-20260404-011',
      sourceObjectCode: 'LS-20260404-011',
      sourceLineId: 'LS-20260404-011__item-001',
      sourceLineCode: 'LS-20260404-011-L01',
      sourceTitle: '设计款户外轻量夹克',
      sourceStatus: '已关账',
      businessDate: '2026-04-04',
      ownerName: '商品运营',
      exposureQty: 42100,
      clickQty: 3220,
      orderQty: 186,
      gmvAmount: 68640,
    },
    video: {
      sourceObjectId: 'SV-PJT-011',
      sourceObjectCode: 'SV-PJT-011',
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: '基础轻甜印花连衣裙短视频测款',
      sourceStatus: '已关账',
      businessDate: '2026-04-03',
      ownerName: '小美',
      exposureQty: 68200,
      clickQty: 4320,
      orderQty: 248,
      gmvAmount: 59272,
    },
    linkedStyleId: 'style_seed_021',
    linkedStyleCode: 'SPU-JACKET-085',
    linkedStyleName: '户外轻量夹克',
  },
  {
    projectCode: 'PRJ-20251216-018',
    channelProductSequence: '01',
    summaryBusinessDate: '2026-04-01 18:00:00',
    summaryText: '直播与短视频测款曝光尚可，但点击与成交转化偏弱，当前需要重新确认测款结论。',
    summaryOwner: '李娜',
    conclusionBusinessDate: '2026-04-01 18:20:00',
    conclusion: '',
    conclusionNote: '历史测款结论已失效，请按新规则重新选择通过或淘汰。',
    live: {
      sourceObjectId: 'LS-20260331-017',
      sourceObjectCode: 'LS-20260331-017',
      sourceLineId: 'LS-20260331-017__item-001',
      sourceLineCode: 'LS-20260331-017-L01',
      sourceTitle: '改版牛仔机车短外套',
      sourceStatus: '已关账',
      businessDate: '2026-03-31',
      ownerName: '快反开发',
      exposureQty: 19600,
      clickQty: 980,
      orderQty: 28,
      gmvAmount: 9212,
    },
    video: {
      sourceObjectId: 'SV-PJT-018',
      sourceObjectCode: 'SV-PJT-018',
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: '设计款印花阔腿连体裤改版测款',
      sourceStatus: '已关账',
      businessDate: '2026-04-01',
      ownerName: '李娜',
      exposureQty: 21800,
      clickQty: 930,
      orderQty: 26,
      gmvAmount: 9334,
    },
  },
  {
    projectCode: 'PRJ-20251216-020',
    channelProductSequence: '01',
    summaryBusinessDate: '2026-04-03 12:50:00',
    summaryText: '当前测款窗口样本不足，历史结论已失效，请重新确认是否通过或淘汰。',
    summaryOwner: '王明',
    conclusionBusinessDate: '2026-04-03 13:10:00',
    conclusion: '',
    conclusionNote: '历史测款结论已失效，请按新规则重新选择通过或淘汰。',
    live: {
      sourceObjectId: 'LS-20260403-020',
      sourceObjectCode: 'LS-20260403-020',
      sourceLineId: 'LS-20260403-020__item-001',
      sourceLineCode: 'LS-20260403-020-L01',
      sourceTitle: '快反 POLO 衫待确认款',
      sourceStatus: '已关账',
      businessDate: '2026-04-03',
      ownerName: '快反运营',
      exposureQty: 15200,
      clickQty: 650,
      orderQty: 19,
      gmvAmount: 3211,
    },
    video: {
      sourceObjectId: 'SV-PJT-019',
      sourceObjectCode: 'SV-PJT-019',
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: '基础款针织开衫测款复盘',
      sourceStatus: '已关账',
      businessDate: '2026-04-02',
      ownerName: '小雅',
      exposureQty: 14400,
      clickQty: 610,
      orderQty: 14,
      gmvAmount: 2506,
    },
  },
  {
    projectCode: 'PRJ-20251216-024',
    channelProductSequence: '01',
    summaryBusinessDate: '2026-04-05 15:50:00',
    summaryText: '直播与短视频双渠道测款均未达到保留阈值，建议进入样衣退回处理。',
    summaryOwner: '王明',
    conclusionBusinessDate: '2026-04-05 16:20:00',
    conclusion: '淘汰',
    conclusionNote: '测款结论为淘汰，当前渠道店铺商品作废，并进入样衣退回处理。',
    live: {
      sourceObjectId: 'LS-20260405-024',
      sourceObjectCode: 'LS-20260405-024',
      sourceLineId: 'LS-20260405-024__item-001',
      sourceLineCode: 'LS-20260405-024-L01',
      sourceTitle: '快反居家套装淘汰款',
      sourceStatus: '已关账',
      businessDate: '2026-04-05',
      ownerName: '品类运营',
      exposureQty: 9200,
      clickQty: 360,
      orderQty: 8,
      gmvAmount: 1464,
    },
    video: {
      sourceObjectId: 'SV-PJT-024',
      sourceObjectCode: 'SV-PJT-024',
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: '快反居家套装双渠道测款复盘',
      sourceStatus: '已关账',
      businessDate: '2026-04-05',
      ownerName: '李娜',
      exposureQty: 9800,
      clickQty: 380,
      orderQty: 7,
      gmvAmount: 1085,
    },
  },
]

const NODE_TIME_PLAN: Partial<Record<PcsProjectInlineNodeRecordWorkItemTypeCode, { offsetDays: number; time: string }>> = {
  SAMPLE_ACQUIRE: { offsetDays: 0, time: '09:20:00' },
  SAMPLE_INBOUND_CHECK: { offsetDays: 1, time: '15:30:00' },
  FEASIBILITY_REVIEW: { offsetDays: 2, time: '10:00:00' },
  SAMPLE_SHOOT_FIT: { offsetDays: 3, time: '14:00:00' },
  SAMPLE_CONFIRM: { offsetDays: 4, time: '11:20:00' },
  SAMPLE_COST_REVIEW: { offsetDays: 5, time: '15:10:00' },
  SAMPLE_PRICING: { offsetDays: 6, time: '10:40:00' },
}

function addDays(baseDateText: string, offsetDays: number, timeText: string): string {
  const baseDate = new Date(`${baseDateText}T00:00:00`)
  baseDate.setDate(baseDate.getDate() + offsetDays)
  const yyyy = baseDate.getFullYear()
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0')
  const dd = String(baseDate.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${timeText}`
}

function getRecordCode(projectCode: string, workItemTypeCode: string): string {
  const tail = projectCode.slice(-3)
  const suffixMap: Record<string, string> = {
    SAMPLE_ACQUIRE: 'ACQ',
    SAMPLE_INBOUND_CHECK: 'INB',
    FEASIBILITY_REVIEW: 'REV',
    SAMPLE_SHOOT_FIT: 'FIT',
    SAMPLE_CONFIRM: 'CFM',
    SAMPLE_COST_REVIEW: 'CST',
    SAMPLE_PRICING: 'PRC',
    TEST_DATA_SUMMARY: 'SUM',
    TEST_CONCLUSION: 'CON',
  }
  return `INR-${tail}-${suffixMap[workItemTypeCode] || 'REC'}-001`
}

function buildSeedForNode(projectCode: string, workItemTypeCode: PcsProjectInlineNodeRecordWorkItemTypeCode): EarlyPhaseRecordSeed {
  const scenario = PROJECT_SCENARIOS[projectCode]
  const timePlan = NODE_TIME_PLAN[workItemTypeCode]
  if (!scenario || !timePlan) {
    throw new Error(`缺少 early inline 节点 demo 配置：${projectCode} / ${workItemTypeCode}`)
  }
  const businessDate = addDays(scenario.baseDate, timePlan.offsetDays, timePlan.time)
  const recordCode = getRecordCode(projectCode, workItemTypeCode)

  if (workItemTypeCode === 'SAMPLE_ACQUIRE') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '商品项目',
      sourceDocType: '样衣获取记录',
      sourceDocCode: `ACQ-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        sampleSourceType: scenario.sampleSourceType,
        sampleSupplierId: scenario.sampleSupplierId,
        sampleLink: scenario.sampleLink,
        sampleUnitPrice: scenario.sampleUnitPrice,
      },
      detailSnapshot: {
        acquireMethod: scenario.sampleSourceType,
        externalPlatform: scenario.externalPlatform,
        externalShop: scenario.externalShop,
        orderTime: businessDate,
        quantity: scenario.quantity,
        colors: scenario.colors,
        sizes: scenario.sizes,
        expectedArrivalDate: scenario.expectedArrivalDate,
        trackingNumber: scenario.trackingNumber,
        sampleCode: scenario.sampleCode,
        sampleStatus: '已下单待到样',
        inventoryRecord: recordCode,
      },
    }
  }

  if (workItemTypeCode === 'SAMPLE_INBOUND_CHECK') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '项目样衣留痕',
      sourceDocType: '到样核对记录',
      sourceDocCode: `INB-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        sampleCode: scenario.sampleCode,
        arrivalTime: businessDate,
        checkResult: '到样数量与规格核对一致',
      },
      detailSnapshot: {
        sampleIds: [scenario.sampleCode],
        warehouseLocation: scenario.warehouseLocation,
        receiver: scenario.receiver,
        sampleQuantity: scenario.sampleQuantity,
        colorCode: scenario.colorCode,
        sizeCombination: scenario.sizeCombination,
        trackingNumber: scenario.trackingNumber,
        inboundVoucher: `RV-${projectCode.slice(-3)}-001`,
      },
    }
  }

  if (workItemTypeCode === 'FEASIBILITY_REVIEW') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '商品项目',
      sourceDocType: '可行性评估记录',
      sourceDocCode: `REV-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        reviewConclusion: '通过',
        reviewRisk: scenario.reviewRisk,
      },
      detailSnapshot: {
        evaluationDimension: scenario.evaluationDimension,
        judgmentDescription: scenario.judgmentDescription,
        evaluationParticipants: scenario.evaluationParticipants,
      },
    }
  }

  if (workItemTypeCode === 'SAMPLE_SHOOT_FIT') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '内容拍摄',
      sourceDocType: '拍摄试穿反馈单',
      sourceDocCode: `FIT-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        shootPlan: scenario.shootPlan,
        fitFeedback: scenario.fitFeedback,
        sampleFlatImageIds: scenario.sampleFlatImageIds,
        sampleTryOnImageIds: scenario.sampleTryOnImageIds,
        sampleDetailImageIds: scenario.sampleDetailImageIds,
        sampleVideoUrls: scenario.sampleVideoUrls,
        shootImageNote: scenario.shootImageNote,
        listingCandidateImageIds: scenario.listingCandidateImageIds,
        styleArchiveCandidateImageIds: scenario.styleArchiveCandidateImageIds,
      },
      detailSnapshot: {
        shootDate: scenario.shootDate,
        shootLocation: scenario.shootLocation,
        photographer: scenario.photographer,
        modelName: scenario.modelName,
        editingDeadline: scenario.editingDeadline,
      },
    }
  }

  if (workItemTypeCode === 'SAMPLE_CONFIRM') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '商品项目',
      sourceDocType: '样衣确认单',
      sourceDocCode: `CFM-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        confirmResult: scenario.confirmResult,
        confirmNote: scenario.confirmNote,
      },
      detailSnapshot: {
        appearanceConfirmation: scenario.appearanceConfirmation,
        sizeConfirmation: scenario.sizeConfirmation,
        materialConfirmation: scenario.materialConfirmation,
        revisionRequired: scenario.revisionRequired,
      },
    }
  }

  if (workItemTypeCode === 'SAMPLE_COST_REVIEW') {
    const costVariance = scenario.actualSampleCost - scenario.targetProductionCost
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '成本核价',
      sourceDocType: '样衣核价单',
      sourceDocCode: `CST-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        costTotal: scenario.actualSampleCost,
        costNote: `样衣核价已完成，建议量产目标成本控制在 ${scenario.targetProductionCost} 元以内。`,
      },
      detailSnapshot: {
        actualSampleCost: scenario.actualSampleCost,
        targetProductionCost: scenario.targetProductionCost,
        costVariance,
        costCompliance: scenario.costCompliance,
      },
    }
  }

  if (workItemTypeCode === 'SAMPLE_PRICING') {
    return {
      projectCode,
      workItemTypeCode,
      sourceModule: '商品定价',
      sourceDocType: '样衣定价单',
      sourceDocCode: `PRC-${projectCode.slice(-3)}-001`,
      businessDate,
      payload: {
        priceRange: scenario.priceRange,
        pricingNote: scenario.pricingNote,
      },
      detailSnapshot: {
        baseCost: scenario.actualSampleCost,
        finalPrice: scenario.finalPrice,
        pricingStrategy: scenario.pricingStrategy,
        approvalStatus: scenario.approvalStatus,
      },
    }
  }

  throw new Error(`未覆盖的 early inline 节点类型：${workItemTypeCode}`)
}

function buildProjectNodeLookup() {
  const snapshot = createBootstrapProjectSnapshot(1)
  const projectMap = new Map(snapshot.projects.map((project) => [project.projectCode, project]))
  const projectIdMap = new Map(snapshot.projects.map((project) => [project.projectId, project]))
  const nodeMap = new Map(
    snapshot.nodes.map((node) => [`${node.projectId}::${node.workItemTypeCode}`, node]),
  )
  return { snapshot, projectMap, projectIdMap, nodeMap }
}

function buildChannelProductId(projectCode: string, sequence: string): string {
  return `channel_product_${projectCode.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${sequence}`
}

function buildChannelProductCode(projectCode: string, sequence: string): string {
  return `CP-${projectCode.slice(-7).replace(/-/g, '')}-${sequence}`
}

function buildUpstreamChannelProductCode(projectCode: string, sequence: string): string {
  return `UP-${projectCode.slice(-7).replace(/-/g, '')}-${sequence}`
}

function buildRelationId(projectId: string, projectNodeId: string, sourceCode: string): string {
  return `rel_${projectId}_${projectNodeId}_${sourceCode}`.replace(/[^a-zA-Z0-9]/g, '_')
}

function buildTestingRelationRef(input: {
  projectId: string
  nodeId: string
  sourceModule: string
  refType: string
  metric: TestingMetricSeed
}): PcsProjectInlineNodeRef {
  const sourceCode = input.metric.sourceLineCode || input.metric.sourceObjectCode
  return {
    refModule: input.sourceModule,
    refType: input.refType,
    refId: buildRelationId(input.projectId, input.nodeId, sourceCode),
    refCode: sourceCode,
    refTitle: input.metric.sourceTitle,
    refStatus: input.metric.sourceStatus,
  }
}

function buildProjectChannelProductRef(input: {
  projectCode: string
  sequence: string
  title: string
  status: string
}): PcsProjectInlineNodeRef {
  return {
    refModule: '渠道店铺商品',
    refType: '渠道店铺商品',
    refId: buildChannelProductId(input.projectCode, input.sequence),
    refCode: buildChannelProductCode(input.projectCode, input.sequence),
    refTitle: input.title,
    refStatus: input.status,
  }
}

function buildTestingBranchBootstrapRecords(
  projectMap: ReturnType<typeof buildProjectNodeLookup>['projectMap'],
  nodeMap: ReturnType<typeof buildProjectNodeLookup>['nodeMap'],
): PcsProjectInlineNodeRecord[] {
  const records: PcsProjectInlineNodeRecord[] = []

  TESTING_BRANCH_RECORDS.forEach((seed) => {
    const project = projectMap.get(seed.projectCode)
    if (!project) {
      throw new Error(`测款汇总 demo 缺少项目：${seed.projectCode}`)
    }
    const liveNode = nodeMap.get(`${project.projectId}::LIVE_TEST`)
    const videoNode = nodeMap.get(`${project.projectId}::VIDEO_TEST`)
    const summaryNode = nodeMap.get(`${project.projectId}::TEST_DATA_SUMMARY`)
    const conclusionNode = nodeMap.get(`${project.projectId}::TEST_CONCLUSION`)

    if (!summaryNode || !conclusionNode) {
      throw new Error(`测款汇总 demo 缺少项目节点：${seed.projectCode}`)
    }

    const channelProductId = buildChannelProductId(seed.projectCode, seed.channelProductSequence)
    const channelProductCode = buildChannelProductCode(seed.projectCode, seed.channelProductSequence)
    const upstreamChannelProductCode = buildUpstreamChannelProductCode(seed.projectCode, seed.channelProductSequence)
    const summaryRecordId = `inline_bootstrap_${seed.projectCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_test_data_summary`
    const summaryRecordCode = getRecordCode(seed.projectCode, 'TEST_DATA_SUMMARY')
    const conclusionRecordId = `inline_bootstrap_${seed.projectCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_test_conclusion`
    const conclusionRecordCode = getRecordCode(seed.projectCode, 'TEST_CONCLUSION')

    const liveRelationRef = buildTestingRelationRef({
      projectId: project.projectId,
      nodeId: liveNode?.projectNodeId || 'LIVE_TEST',
      sourceModule: '直播',
      refType: '直播测款记录',
      metric: seed.live,
    })
    const videoRelationRef = buildTestingRelationRef({
      projectId: project.projectId,
      nodeId: videoNode?.projectNodeId || 'VIDEO_TEST',
      sourceModule: '短视频',
      refType: '短视频测款记录',
      metric: seed.video,
    })
    const channelProductRef = buildProjectChannelProductRef({
      projectCode: seed.projectCode,
      sequence: seed.channelProductSequence,
      title: `${project.projectName} 当前测款渠道店铺商品`,
      status: seed.conclusion === '通过' ? '已生效' : '已作废',
    })

    const totalExposureQty = seed.live.exposureQty + seed.video.exposureQty
    const totalClickQty = seed.live.clickQty + seed.video.clickQty
    const totalOrderQty = seed.live.orderQty + seed.video.orderQty
    const totalGmvAmount = seed.live.gmvAmount + seed.video.gmvAmount

    records.push({
      recordId: summaryRecordId,
      recordCode: summaryRecordCode,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: summaryNode.projectNodeId,
      workItemTypeCode: 'TEST_DATA_SUMMARY',
      workItemTypeName: summaryNode.workItemTypeName,
      businessDate: seed.summaryBusinessDate,
      recordStatus: '已完成',
      ownerId: project.ownerId,
      ownerName: seed.summaryOwner,
      payload: {
        summaryText: seed.summaryText,
        totalExposureQty,
        totalClickQty,
        totalOrderQty,
        totalGmvAmount,
      },
      detailSnapshot: {
        liveRelationIds: [liveRelationRef.refId],
        videoRelationIds: [videoRelationRef.refId],
        liveRelationCodes: [liveRelationRef.refCode],
        videoRelationCodes: [videoRelationRef.refCode],
        summaryOwner: seed.summaryOwner,
        summaryAt: seed.summaryBusinessDate,
        channelProductId,
        channelProductCode,
        upstreamChannelProductCode,
      },
      sourceModule: '商品项目',
      sourceDocType: '测款汇总记录',
      sourceDocId: `${summaryRecordCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${project.projectId}`,
      sourceDocCode: `SUM-${seed.projectCode.slice(-3)}-001`,
      upstreamRefs: [liveRelationRef, videoRelationRef, channelProductRef],
      downstreamRefs: [],
      createdAt: seed.summaryBusinessDate,
      createdBy: seed.summaryOwner,
      updatedAt: seed.summaryBusinessDate,
      updatedBy: seed.summaryOwner,
      legacyProjectRef: project.projectCode,
      legacyWorkItemInstanceId: null,
    } as PcsProjectInlineNodeRecord)

    const downstreamRefs: PcsProjectInlineNodeRef[] = []
    if (seed.conclusion === '通过' && seed.linkedStyleId && seed.linkedStyleCode) {
      downstreamRefs.push({
        refModule: '款式档案',
        refType: '款式档案',
        refId: seed.linkedStyleId,
        refCode: seed.linkedStyleCode,
        refTitle: seed.linkedStyleName || project.projectName,
        refStatus: '技术包待完善',
      })
    }
    if (seed.conclusion !== '通过') {
      downstreamRefs.push({
        refModule: '渠道店铺商品',
        refType: '已作废渠道店铺商品',
        refId: channelProductId,
        refCode: channelProductCode,
        refTitle: `${project.projectName} 已作废测款渠道店铺商品`,
        refStatus: '已作废',
      })
    }
    if (seed.conclusion) {
      records.push({
        recordId: conclusionRecordId,
        recordCode: conclusionRecordCode,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectNodeId: conclusionNode.projectNodeId,
        workItemTypeCode: 'TEST_CONCLUSION',
        workItemTypeName: conclusionNode.workItemTypeName,
        businessDate: seed.conclusionBusinessDate,
        recordStatus: '已完成',
        ownerId: project.ownerId,
        ownerName: project.ownerName,
        payload: {
          conclusion: seed.conclusion,
          conclusionNote: seed.conclusionNote,
          linkedChannelProductCode: channelProductCode,
          invalidationPlanned: seed.conclusion !== '通过',
          linkedStyleId: seed.linkedStyleId || '',
          linkedStyleCode: seed.linkedStyleCode || '',
          invalidatedChannelProductId: seed.conclusion === '通过' ? '' : channelProductId,
          nextActionType: seed.nextActionType || getTestingConclusionNextActionType(seed.conclusion),
        },
        detailSnapshot: {
          summaryRecordId,
          summaryRecordCode,
          channelProductId,
          channelProductCode,
          upstreamChannelProductCode,
          invalidatedChannelProductId: seed.conclusion === '通过' ? '' : channelProductId,
          linkedStyleId: seed.linkedStyleId || '',
          linkedStyleCode: seed.linkedStyleCode || '',
        },
        sourceModule: '商品项目',
        sourceDocType: '测款结论记录',
        sourceDocId: `${conclusionRecordCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${project.projectId}`,
        sourceDocCode: `CON-${seed.projectCode.slice(-3)}-001`,
        upstreamRefs: [
          {
            refModule: '测款汇总',
            refType: '测款汇总记录',
            refId: summaryRecordId,
            refCode: summaryRecordCode,
            refTitle: `${project.projectName} 测款汇总`,
            refStatus: '已完成',
          },
          channelProductRef,
        ],
        downstreamRefs,
        createdAt: seed.conclusionBusinessDate,
        createdBy: project.ownerName,
        updatedAt: seed.conclusionBusinessDate,
        updatedBy: project.ownerName,
        legacyProjectRef: project.projectCode,
        legacyWorkItemInstanceId: null,
      } as PcsProjectInlineNodeRecord)
    }
  })

  return records
}

function buildSampleCloseoutRecordCode(projectCode: string): string {
  return `INR-${projectCode.slice(-3)}-RETURN`
}

function buildSampleCloseoutBootstrapRecords(
  projectMap: ReturnType<typeof buildProjectNodeLookup>['projectMap'],
  nodeMap: ReturnType<typeof buildProjectNodeLookup>['nodeMap'],
): PcsProjectInlineNodeRecord[] {
  return createBootstrapSampleCloseoutSeeds().map((seed) => {
    const project = projectMap.get(seed.projectCode)
    if (!project) {
      throw new Error(`样衣收尾 demo 缺少项目：${seed.projectCode}`)
    }
    const workItemTypeCode = 'SAMPLE_RETURN_HANDLE'
    const node = nodeMap.get(`${project.projectId}::${workItemTypeCode}`)
    if (!node) {
      throw new Error(`样衣收尾 demo 缺少项目节点：${seed.projectCode} / ${workItemTypeCode}`)
    }

    const recordId = `${node.projectNodeId}::${seed.sourceDocId}`.replace(/[^a-zA-Z0-9:_-]/g, '_')
    const assetStatus = seed.eventType === 'RETURN_SUPPLIER' ? '已退货' : '已处置'
    const availabilityAfter = '不可用'
    const locationAfter = seed.eventType === 'RETURN_SUPPLIER' ? '供应商退回完成' : '深圳处置区'

    return {
      recordId,
      recordCode: buildSampleCloseoutRecordCode(project.projectCode),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      businessDate: seed.businessDate,
      recordStatus: '已完成',
      ownerId: project.ownerId,
      ownerName: seed.operatorName,
      payload: {
        returnResult: seed.eventType === 'RETURN_SUPPLIER' ? '已完成退回' : '已完成处置',
      },
      detailSnapshot: {
        returnRecipient: seed.returnRecipient || '供应商收货人',
        returnDepartment: seed.returnDepartment || '样衣管理组',
        returnAddress: seed.returnAddress || `${seed.responsibleSite} 供应商回寄地址`,
        returnDate: seed.returnDate || seed.businessDate,
        logisticsProvider: seed.logisticsProvider || '线下回寄',
        trackingNumber: seed.trackingNumber || seed.sourceDocCode,
        modificationReason: seed.modificationReason || seed.note,
        sampleAssetId: seed.sampleAssetId,
        sampleCode: seed.sampleCode,
        sampleLedgerEventId: seed.ledgerEventId,
        sampleLedgerEventCode: seed.ledgerEventCode,
        returnDocId: seed.sourceDocId,
        returnDocCode: seed.sourceDocCode,
        inventoryStatusAfter: assetStatus,
        availabilityAfter,
        locationAfter,
      },
      sourceModule: '样衣退货与处理',
      sourceDocType: seed.eventType === 'RETURN_SUPPLIER' ? '样衣退回单' : '样衣处置单',
      sourceDocId: seed.sourceDocId,
      sourceDocCode: seed.sourceDocCode,
      upstreamRefs: [
        {
          refModule: '样衣资产',
          refType: '样衣资产',
          refId: seed.sampleAssetId,
          refCode: seed.sampleCode,
          refTitle: seed.sampleName,
          refStatus: assetStatus,
        },
        {
          refModule: '项目样衣留痕',
          refType: '项目样衣留痕',
          refId: seed.ledgerEventId,
          refCode: seed.ledgerEventCode,
          refTitle: seed.eventType === 'RETURN_SUPPLIER' ? '退货' : '处置',
          refStatus: assetStatus,
        },
      ],
      downstreamRefs: [
        {
          refModule: seed.eventType === 'RETURN_SUPPLIER' ? '样衣退回单' : '样衣处置单',
          refType: seed.eventType === 'RETURN_SUPPLIER' ? '样衣退回单' : '样衣处置单',
          refId: seed.sourceDocId,
          refCode: seed.sourceDocCode,
          refTitle: seed.note,
          refStatus: '已完成',
        },
      ],
      createdAt: seed.businessDate,
      createdBy: seed.operatorName,
      updatedAt: seed.businessDate,
      updatedBy: seed.operatorName,
      legacyProjectRef: project.projectCode,
      legacyWorkItemInstanceId: null,
    } as PcsProjectInlineNodeRecord
  })
}

function buildGenericInlineBusinessDate(project: PcsProjectRecord, node: PcsProjectNodeRecord): string {
  return node.updatedAt || node.lastEventTime || project.updatedAt || project.createdAt
}

function buildFallbackSampleCode(projectCode: string): string {
  return `SY-${projectCode.slice(-3)}-001`
}

function buildGenericInlineSeed(
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord,
): EarlyPhaseRecordSeed | null {
  const projectCode = project.projectCode
  const businessDate = buildGenericInlineBusinessDate(project, node)
  const sampleCode = buildFallbackSampleCode(projectCode)

  if (node.workItemTypeCode === 'SAMPLE_ACQUIRE') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_ACQUIRE',
      sourceModule: '商品项目',
      sourceDocType: '样衣获取记录',
      sourceDocCode: `ACQ-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        sampleSourceType: project.sampleSourceType || '外采',
        sampleSupplierId: project.sampleSupplierId || 'supplier-platform-c',
        sampleLink: project.sampleLink || `https://example.com/samples/${projectCode.toLowerCase()}`,
        sampleUnitPrice: project.sampleUnitPrice || 99,
      },
      detailSnapshot: {
        sampleCode,
        quantity: 1,
        colors: ['默认色'],
        sizes: ['M'],
        expectedArrivalDate: businessDate.slice(0, 10),
        sampleStatus: '已下单待到样',
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_INBOUND_CHECK') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
      sourceModule: '项目样衣留痕',
      sourceDocType: '到样核对记录',
      sourceDocCode: `INB-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        sampleCode,
        arrivalTime: businessDate,
        checkResult: '到样数量与规格核对一致',
      },
      detailSnapshot: {
        sampleIds: [sampleCode],
        warehouseLocation: '深圳主仓-A-01-01',
        receiver: project.ownerName,
        sampleQuantity: 1,
        colorCode: '默认色',
        sizeCombination: 'M',
      },
    }
  }

  if (node.workItemTypeCode === 'FEASIBILITY_REVIEW') {
    return {
      projectCode,
      workItemTypeCode: 'FEASIBILITY_REVIEW',
      sourceModule: '商品项目',
      sourceDocType: '可行性评估记录',
      sourceDocCode: `REV-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        reviewConclusion: '通过',
        reviewRisk: node.currentIssueText || '暂无显著风险',
      },
      detailSnapshot: {
        evaluationDimension: ['版型', '成本', '测款潜力'],
        judgmentDescription: node.latestResultText || '已完成初步可行性判断。',
        evaluationParticipants: [project.ownerName],
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_SHOOT_FIT') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_SHOOT_FIT',
      sourceModule: '内容拍摄',
      sourceDocType: '拍摄试穿反馈单',
      sourceDocCode: `FIT-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        shootPlan: '已完成拍摄与试穿安排',
        fitFeedback: node.latestResultText || '试穿反馈已整理。',
        sampleFlatImageIds: [],
        sampleTryOnImageIds: [],
        sampleDetailImageIds: [],
        sampleVideoUrls: [],
        shootImageNote: '',
        listingCandidateImageIds: [],
        styleArchiveCandidateImageIds: [],
      },
      detailSnapshot: {
        shootDate: businessDate,
        shootLocation: '深圳拍摄间',
        photographer: '系统预置',
        modelName: '默认模特',
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_CONFIRM') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_CONFIRM',
      sourceModule: '商品项目',
      sourceDocType: '样衣确认单',
      sourceDocCode: `CFM-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        confirmResult: project.projectStatus === '已终止' ? '淘汰' : '通过',
        confirmNote: node.latestResultText || '样衣确认已完成。',
      },
      detailSnapshot: {
        appearanceConfirmation: '外观确认通过',
        sizeConfirmation: '尺码确认通过',
        materialConfirmation: '面料确认通过',
        revisionRequired: false,
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_COST_REVIEW') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_COST_REVIEW',
      sourceModule: '成本核价',
      sourceDocType: '样衣核价单',
      sourceDocCode: `CST-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        costTotal: project.sampleUnitPrice || 99,
        costNote: node.latestResultText || '样衣核价已完成。',
      },
      detailSnapshot: {
        actualSampleCost: project.sampleUnitPrice || 99,
        targetProductionCost: project.sampleUnitPrice || 89,
        costCompliance: '基本符合',
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_PRICING') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_PRICING',
      sourceModule: '商品定价',
      sourceDocType: '样衣定价单',
      sourceDocCode: `PRC-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        priceRange: project.priceRangeLabel || '两百元主销带',
        pricingNote: node.latestResultText || '样衣定价已完成。',
      },
      detailSnapshot: {
        baseCost: project.sampleUnitPrice || 99,
        finalPrice: project.sampleUnitPrice ? Number(project.sampleUnitPrice) * 2 : 199,
        pricingStrategy: '常规测款定价',
        approvalStatus: '已通过',
      },
    }
  }

  if (node.workItemTypeCode === 'TEST_DATA_SUMMARY') {
    return {
      projectCode,
      workItemTypeCode: 'TEST_DATA_SUMMARY',
      sourceModule: '商品项目',
      sourceDocType: '测款汇总记录',
      sourceDocCode: `SUM-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        summaryText: node.latestResultText || `${project.projectName}测款数据已汇总。`,
        totalExposureQty: 10000,
        totalClickQty: 800,
        totalOrderQty: 60,
        totalGmvAmount: 18888,
      },
      detailSnapshot: {
        summaryOwner: project.ownerName,
        summaryAt: businessDate,
      },
    }
  }

  if (node.workItemTypeCode === 'TEST_CONCLUSION') {
    const conclusion = project.projectStatus === '已终止' ? '淘汰' : project.linkedStyleId ? '通过' : ''
    return {
      projectCode,
      workItemTypeCode: 'TEST_CONCLUSION',
      sourceModule: '商品项目',
      sourceDocType: '测款结论记录',
      sourceDocCode: `CON-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        conclusion,
        conclusionNote: node.latestResultText || `${project.projectName}测款结论已确认。`,
        linkedChannelProductCode: '',
        invalidationPlanned: conclusion !== '通过',
        linkedStyleId: project.linkedStyleId || '',
        linkedStyleCode: project.linkedStyleCode || '',
        nextActionType: conclusion === '通过' ? '生成款式档案' : conclusion === '淘汰' ? '样衣退回处理' : '',
      },
      detailSnapshot: {
        linkedStyleId: project.linkedStyleId || '',
        linkedStyleCode: project.linkedStyleCode || '',
      },
    }
  }

  if (node.workItemTypeCode === 'SAMPLE_RETURN_HANDLE') {
    return {
      projectCode,
      workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
      sourceModule: '样衣退货与处理',
      sourceDocType: '样衣退回单',
      sourceDocCode: `RTN-${projectCode.slice(-3)}-GEN`,
      businessDate,
      payload: {
        returnResult: '已完成退回',
      },
      detailSnapshot: {
        returnRecipient: '供应商收货人',
        logisticsProvider: '线下回寄',
        returnDate: businessDate.slice(0, 10),
      },
    }
  }

  return null
}

function buildMissingCompletedInlineNodeRecords(
  projectIdMap: ReturnType<typeof buildProjectNodeLookup>['projectIdMap'],
  snapshot: ReturnType<typeof buildProjectNodeLookup>['snapshot'],
  existingRecords: PcsProjectInlineNodeRecord[],
): PcsProjectInlineNodeRecord[] {
  const existingNodeIds = new Set(existingRecords.map((record) => record.projectNodeId))
  const nextRecords: PcsProjectInlineNodeRecord[] = []

  snapshot.nodes
    .filter(
      (node) =>
        node.currentStatus === '已完成' &&
        (PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES as readonly string[]).includes(node.workItemTypeCode),
    )
    .forEach((node) => {
      if (existingNodeIds.has(node.projectNodeId)) return
      const project = projectIdMap.get(node.projectId)
      if (!project) return
      const seed = buildGenericInlineSeed(project, node)
      if (!seed) return

      const recordCode =
        node.workItemTypeCode === 'SAMPLE_RETURN_HANDLE'
          ? buildSampleCloseoutRecordCode(project.projectCode)
          : getRecordCode(project.projectCode, node.workItemTypeCode)

      nextRecords.push({
        recordId: `inline_backfill_${project.projectCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${node.workItemTypeCode.toLowerCase()}`,
        recordCode,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectNodeId: node.projectNodeId,
        workItemTypeCode: node.workItemTypeCode,
        workItemTypeName: node.workItemTypeName,
        businessDate: seed.businessDate,
        recordStatus: '已完成',
        ownerId: project.ownerId,
        ownerName: project.ownerName,
        payload: seed.payload,
        detailSnapshot: seed.detailSnapshot,
        sourceModule: seed.sourceModule,
        sourceDocType: seed.sourceDocType,
        sourceDocId: `${seed.sourceDocCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${project.projectId}`,
        sourceDocCode: seed.sourceDocCode,
        upstreamRefs: [],
        downstreamRefs: [],
        createdAt: seed.businessDate,
        createdBy: project.ownerName,
        updatedAt: seed.businessDate,
        updatedBy: project.ownerName,
        legacyProjectRef: project.projectCode,
        legacyWorkItemInstanceId: null,
      } as PcsProjectInlineNodeRecord)
    })

  return nextRecords
}

export function createBootstrapProjectInlineNodeRecordSnapshot(
  version: number,
): PcsProjectInlineNodeRecordStoreSnapshot {
  const { snapshot, projectMap, projectIdMap, nodeMap } = buildProjectNodeLookup()
  if (projectMap.size === 0 || nodeMap.size === 0) {
    return {
      version,
      records: [],
    }
  }
  const records: PcsProjectInlineNodeRecord[] = []

  Object.entries(PROJECT_RECORD_PLAN).forEach(([projectCode, workItemCodes]) => {
    const project = projectMap.get(projectCode)
    if (!project) {
      throw new Error(`early inline 节点 demo 缺少项目：${projectCode}`)
    }

    workItemCodes.forEach((workItemTypeCode) => {
      const node = nodeMap.get(`${project.projectId}::${workItemTypeCode}`)
      if (!node) {
        throw new Error(`early inline 节点 demo 缺少项目节点：${projectCode} / ${workItemTypeCode}`)
      }

      const seed = buildSeedForNode(projectCode, workItemTypeCode)
      records.push({
        recordId: `inline_bootstrap_${project.projectCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${workItemTypeCode.toLowerCase()}`,
        recordCode: getRecordCode(project.projectCode, workItemTypeCode),
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectNodeId: node.projectNodeId,
        workItemTypeCode,
        workItemTypeName: node.workItemTypeName,
        businessDate: seed.businessDate,
        recordStatus: '已完成',
        ownerId: project.ownerId,
        ownerName: project.ownerName,
        payload: seed.payload,
        detailSnapshot: seed.detailSnapshot,
        sourceModule: seed.sourceModule,
        sourceDocType: seed.sourceDocType,
        sourceDocId: `${seed.sourceDocCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${project.projectId}`,
        sourceDocCode: seed.sourceDocCode,
        upstreamRefs: [],
        downstreamRefs: [],
        createdAt: seed.businessDate,
        createdBy: project.ownerName,
        updatedAt: seed.businessDate,
        updatedBy: project.ownerName,
        legacyProjectRef: null,
        legacyWorkItemInstanceId: null,
      } as PcsProjectInlineNodeRecord)
    })
  })

  records.push(...buildTestingBranchBootstrapRecords(projectMap, nodeMap))
  records.push(...buildSampleCloseoutBootstrapRecords(projectMap, nodeMap))
  records.push(...buildMissingCompletedInlineNodeRecords(projectIdMap, snapshot, records))

  return {
    version,
    records,
  }
}
