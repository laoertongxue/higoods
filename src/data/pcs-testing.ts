export type SessionStatus = 'DRAFT' | 'RECONCILING' | 'COMPLETED' | 'CANCELLED'
export type AccountingStatus = 'NONE' | 'PENDING' | 'ACCOUNTED'

export type LivePurpose = 'TEST' | 'SELL' | 'RESTOCK' | 'CLEARANCE' | 'SOFT_LAUNCH' | 'CONTENT'
export type VideoPurpose = 'TEST' | 'PROMOTION' | 'TEASER' | 'SALES' | 'SEEDING' | 'SOFT_LAUNCH' | 'OTHER'

export interface PurposeMeta {
  label: string
  color: string
}

export interface StatusMeta {
  label: string
  color: string
}

export interface LiveSession {
  id: string
  title: string
  status: SessionStatus
  purposes: LivePurpose[]
  liveAccount: string
  anchor: string
  startAt: string
  endAt: string | null
  owner: string
  operator: string
  recorder: string
  reviewer: string
  site: string
  itemCount: number
  testItemCount: number
  testAccountingStatus: AccountingStatus
  sampleCount: number
  gmvTotal: number | null
  orderTotal: number | null
  exposureTotal: number
  clickTotal: number
  cartTotal: number
  isTestAccountingEnabled: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export interface LiveSessionItem {
  id: string
  intent: 'SELL' | 'TEST' | 'REVIEW'
  projectRef: string | null
  productRef: string
  productName: string
  sku: string
  segmentStart: string
  segmentEnd: string
  exposure: number
  click: number
  cart: number
  order: number
  pay: number
  gmv: number
  listPrice: number
  payPrice: number
  recommendation: string | null
  recommendationReason: string | null
  evidence: string[]
}

export interface LiveSample {
  id: string
  name: string
  site: string
  status: string
  location: string
  holder: string
}

export interface LiveLog {
  time: string
  action: string
  user: string
  detail: string
}

export interface VideoRecord {
  id: string
  title: string
  status: SessionStatus
  purposes: VideoPurpose[]
  platform: 'TIKTOK' | 'DOUYIN' | 'KUAISHOU' | 'OTHER'
  account: string
  creator: string
  publishedAt: string | null
  owner: string
  recorder: string
  itemCount: number
  testItemCount: number
  testAccountingStatus: AccountingStatus
  sampleCount: number
  views: number
  likes: number
  gmv: number
  isTestAccountingEnabled: boolean
  videoUrl: string
  updatedAt: string
  note: string
}

export interface VideoItem {
  id: string
  evaluationIntent: 'TEST' | 'SELL' | 'REVIEW'
  projectRef: string | null
  productRef: string
  productName: string
  sku: string
  exposure: number
  click: number
  cart: number
  order: number
  pay: number
  gmv: number
  recommendation: string | null
  recommendationReason: string | null
}

export interface EvidenceAsset {
  id: string
  type: '视频片段' | '截图' | '链接'
  name: string
  url: string
  createdAt: string
}

export interface VideoLog {
  time: string
  action: string
  user: string
  detail: string
}

export interface LegacyTestingProjectReference {
  sourceType: '直播场次头' | '短视频记录'
  sourceId: string
  projectRef: string | null
  note: string
}

export const SESSION_STATUS_META: Record<SessionStatus, StatusMeta> = {
  DRAFT: { label: '草稿', color: 'bg-slate-100 text-slate-600' },
  RECONCILING: { label: '核对中', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: '已关账', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: '已取消', color: 'bg-rose-100 text-rose-700' },
}

export const ACCOUNTING_STATUS_META: Record<AccountingStatus, StatusMeta> = {
  NONE: { label: '无测款', color: 'bg-slate-100 text-slate-600' },
  PENDING: { label: '待入账', color: 'bg-amber-100 text-amber-700' },
  ACCOUNTED: { label: '已入账', color: 'bg-emerald-100 text-emerald-700' },
}

export const LIVE_PURPOSE_META: Record<LivePurpose, PurposeMeta> = {
  TEST: { label: '测款', color: 'bg-violet-100 text-violet-700' },
  SELL: { label: '带货', color: 'bg-blue-100 text-blue-700' },
  RESTOCK: { label: '复播', color: 'bg-cyan-100 text-cyan-700' },
  CLEARANCE: { label: '清仓', color: 'bg-orange-100 text-orange-700' },
  SOFT_LAUNCH: { label: '上新', color: 'bg-pink-100 text-pink-700' },
  CONTENT: { label: '内容', color: 'bg-indigo-100 text-indigo-700' },
}

export const VIDEO_PURPOSE_META: Record<VideoPurpose, PurposeMeta> = {
  TEST: { label: '测款', color: 'bg-violet-100 text-violet-700' },
  PROMOTION: { label: '推广', color: 'bg-blue-100 text-blue-700' },
  TEASER: { label: '活动预热', color: 'bg-cyan-100 text-cyan-700' },
  SALES: { label: '销售转化', color: 'bg-orange-100 text-orange-700' },
  SEEDING: { label: '内容种草', color: 'bg-pink-100 text-pink-700' },
  SOFT_LAUNCH: { label: '上新试水', color: 'bg-indigo-100 text-indigo-700' },
  OTHER: { label: '其他', color: 'bg-slate-100 text-slate-600' },
}

export const VIDEO_PLATFORM_META: Record<VideoRecord['platform'], StatusMeta> = {
  TIKTOK: { label: 'TikTok', color: 'bg-black text-white' },
  DOUYIN: { label: '抖音', color: 'bg-slate-800 text-white' },
  KUAISHOU: { label: '快手', color: 'bg-orange-500 text-white' },
  OTHER: { label: '其他', color: 'bg-slate-100 text-slate-700' },
}

const LIVE_SESSION_SEED: LiveSession[] = [
  {
    id: 'LS-20260122-001',
    title: 'TikTok IDN 新款测试专场',
    status: 'RECONCILING',
    purposes: ['TEST', 'SELL'],
    liveAccount: 'TikTok IDN Store-A',
    anchor: '家播-小N',
    startAt: '2026-01-22 19:00',
    endAt: '2026-01-22 22:30',
    owner: '张三',
    operator: '李四',
    recorder: '王五',
    reviewer: '赵六',
    site: '雅加达',
    itemCount: 12,
    testItemCount: 3,
    testAccountingStatus: 'PENDING',
    sampleCount: 5,
    gmvTotal: 45680,
    orderTotal: 156,
    exposureTotal: 125000,
    clickTotal: 8900,
    cartTotal: 1250,
    isTestAccountingEnabled: true,
    note: '重点测试春季新款连衣裙系列',
    createdAt: '2026-01-22 14:00',
    updatedAt: '2026-01-22 23:15',
  },
  {
    id: 'LS-20260121-002',
    title: '周末清仓专场',
    status: 'COMPLETED',
    purposes: ['CLEARANCE', 'SELL'],
    liveAccount: 'Shopee MY Store-B',
    anchor: '达人-Lily',
    startAt: '2026-01-21 14:00',
    endAt: '2026-01-21 18:00',
    owner: '李四',
    operator: '李四',
    recorder: '李四',
    reviewer: '陈主管',
    site: '吉隆坡',
    itemCount: 25,
    testItemCount: 0,
    testAccountingStatus: 'NONE',
    sampleCount: 8,
    gmvTotal: 89200,
    orderTotal: 312,
    exposureTotal: 190000,
    clickTotal: 12400,
    cartTotal: 2100,
    isTestAccountingEnabled: false,
    note: '库存清理专场',
    createdAt: '2026-01-20 10:00',
    updatedAt: '2026-01-21 19:30',
  },
  {
    id: 'LS-20260120-003',
    title: '春季新款首播',
    status: 'COMPLETED',
    purposes: ['SOFT_LAUNCH', 'TEST'],
    liveAccount: 'TikTok IDN Store-A',
    anchor: '家播-小美',
    startAt: '2026-01-20 20:00',
    endAt: '2026-01-20 23:00',
    owner: '王五',
    operator: '王五',
    recorder: '王五',
    reviewer: '赵六',
    site: '雅加达',
    itemCount: 18,
    testItemCount: 5,
    testAccountingStatus: 'ACCOUNTED',
    sampleCount: 6,
    gmvTotal: 67500,
    orderTotal: 234,
    exposureTotal: 148000,
    clickTotal: 9900,
    cartTotal: 1600,
    isTestAccountingEnabled: true,
    note: '新品首播，优先验证转化',
    createdAt: '2026-01-20 10:00',
    updatedAt: '2026-01-21 10:00',
  },
  {
    id: 'LS-20260119-004',
    title: '日常带货场',
    status: 'DRAFT',
    purposes: ['SELL'],
    liveAccount: 'TikTok VN Store-C',
    anchor: '家播-阿强',
    startAt: '2026-01-23 19:00',
    endAt: null,
    owner: '赵六',
    operator: '赵六',
    recorder: '赵六',
    reviewer: '陈主管',
    site: '胡志明',
    itemCount: 8,
    testItemCount: 0,
    testAccountingStatus: 'NONE',
    sampleCount: 3,
    gmvTotal: null,
    orderTotal: null,
    exposureTotal: 0,
    clickTotal: 0,
    cartTotal: 0,
    isTestAccountingEnabled: false,
    note: '例行带货场次',
    createdAt: '2026-01-19 12:00',
    updatedAt: '2026-01-19 15:00',
  },
  {
    id: 'LS-20260118-005',
    title: '复播追单专场',
    status: 'RECONCILING',
    purposes: ['RESTOCK', 'SELL'],
    liveAccount: 'Shopee ID Store-D',
    anchor: '达人-Mike',
    startAt: '2026-01-18 15:00',
    endAt: '2026-01-18 19:00',
    owner: '钱七',
    operator: '钱七',
    recorder: '钱七',
    reviewer: '陈主管',
    site: '泗水',
    itemCount: 15,
    testItemCount: 2,
    testAccountingStatus: 'PENDING',
    sampleCount: 4,
    gmvTotal: 52300,
    orderTotal: 178,
    exposureTotal: 102000,
    clickTotal: 7300,
    cartTotal: 980,
    isTestAccountingEnabled: true,
    note: '复播追单，重点跟踪复购',
    createdAt: '2026-01-18 09:30',
    updatedAt: '2026-01-18 20:30',
  },
  {
    id: 'LS-20260117-006',
    title: '内容种草场',
    status: 'COMPLETED',
    purposes: ['CONTENT'],
    liveAccount: 'TikTok IDN Store-A',
    anchor: '达人-Sarah',
    startAt: '2026-01-17 14:00',
    endAt: '2026-01-17 16:00',
    owner: '孙八',
    operator: '孙八',
    recorder: '孙八',
    reviewer: '赵六',
    site: '雅加达',
    itemCount: 6,
    testItemCount: 0,
    testAccountingStatus: 'NONE',
    sampleCount: 6,
    gmvTotal: 12500,
    orderTotal: 45,
    exposureTotal: 62000,
    clickTotal: 4200,
    cartTotal: 560,
    isTestAccountingEnabled: false,
    note: '内容型直播，弱销售导向',
    createdAt: '2026-01-17 09:20',
    updatedAt: '2026-01-17 17:00',
  },
]

const LIVE_ITEM_SEED: Record<string, LiveSessionItem[]> = {
  'LS-20260122-001': [
    {
      id: 'item-001',
      intent: 'TEST',
      projectRef: null,
      productRef: 'SPU-A001',
      productName: '印尼风格碎花连衣裙',
      sku: 'SKU-A001-M-RED',
      segmentStart: '19:15',
      segmentEnd: '19:45',
      exposure: 15000,
      click: 1200,
      cart: 180,
      order: 45,
      pay: 42,
      gmv: 8400,
      listPrice: 299,
      payPrice: 199,
      recommendation: '继续',
      recommendationReason: '转化率高于均值，建议加大推广',
      evidence: ['screenshot-001.png'],
    },
    {
      id: 'item-002',
      intent: 'TEST',
      projectRef: null,
      productRef: 'SPU-B002',
      productName: '波西米亚风半身裙',
      sku: 'SKU-B002-L-BLUE',
      segmentStart: '19:50',
      segmentEnd: '20:20',
      exposure: 12000,
      click: 850,
      cart: 95,
      order: 18,
      pay: 15,
      gmv: 2985,
      listPrice: 259,
      payPrice: 199,
      recommendation: '改版',
      recommendationReason: '转化率偏低，建议优化版型',
      evidence: ['screenshot-002.png'],
    },
    {
      id: 'item-003',
      intent: 'SELL',
      projectRef: null,
      productRef: 'SPU-C003',
      productName: '基础款白色T恤',
      sku: 'SKU-C003-M-WHITE',
      segmentStart: '20:25',
      segmentEnd: '20:45',
      exposure: 18000,
      click: 1500,
      cart: 280,
      order: 85,
      pay: 82,
      gmv: 6560,
      listPrice: 99,
      payPrice: 79,
      recommendation: null,
      recommendationReason: null,
      evidence: [],
    },
    {
      id: 'item-004',
      intent: 'TEST',
      projectRef: null,
      productRef: 'SPU-D004',
      productName: '牛仔短裤夏季款',
      sku: 'SKU-D004-S-DENIM',
      segmentStart: '20:50',
      segmentEnd: '21:15',
      exposure: 10000,
      click: 680,
      cart: 72,
      order: 12,
      pay: 10,
      gmv: 1990,
      listPrice: 259,
      payPrice: 199,
      recommendation: '补测',
      recommendationReason: '样本量不足，建议下场再测',
      evidence: ['screenshot-004.png'],
    },
  ],
}

const LIVE_SAMPLE_SEED: Record<string, LiveSample[]> = {
  'LS-20260122-001': [
    { id: 'SAM-001', name: '印尼风格碎花连衣裙-M红', site: '雅加达', status: '使用中', location: '直播间A', holder: '小N' },
    { id: 'SAM-002', name: '波西米亚风半身裙-L蓝', site: '雅加达', status: '使用中', location: '直播间A', holder: '小N' },
    { id: 'SAM-003', name: '基础款白色T恤-M白', site: '雅加达', status: '使用中', location: '直播间A', holder: '小N' },
    {
      id: 'SAM-004',
      name: '牛仔短裤夏季款-S牛仔蓝',
      site: '雅加达',
      status: '使用中',
      location: '直播间A',
      holder: '小N',
    },
    { id: 'SAM-005', name: '复古皮夹克-L黑', site: '雅加达', status: '可用', location: '仓库B-3', holder: '-' },
  ],
}

const LIVE_LOG_SEED: Record<string, LiveLog[]> = {
  'LS-20260122-001': [
    { time: '2026-01-22 23:15', action: '更新明细数据', user: '王五', detail: '导入CSV数据，更新12条明细' },
    { time: '2026-01-22 22:35', action: '下播', user: '系统', detail: '直播结束，状态变更为核对中' },
    { time: '2026-01-22 19:00', action: '开播', user: '系统', detail: '直播开始' },
    { time: '2026-01-22 14:00', action: '创建场次', user: '张三', detail: '创建直播场次草稿' },
  ],
}

const VIDEO_RECORD_SEED: VideoRecord[] = [
  {
    id: 'SV-20260123-012',
    title: '春季新款印花裙穿搭分享',
    status: 'COMPLETED',
    purposes: ['PROMOTION', 'SALES'],
    platform: 'TIKTOK',
    account: 'IDN-Store-A',
    creator: 'KOL-Blue',
    publishedAt: '2026-01-23 11:30',
    owner: '张三',
    recorder: '张三',
    itemCount: 3,
    testItemCount: 1,
    testAccountingStatus: 'ACCOUNTED',
    sampleCount: 2,
    views: 125000,
    likes: 8500,
    gmv: 12680,
    isTestAccountingEnabled: true,
    videoUrl: 'https://example.com/videos/SV-20260123-012',
    updatedAt: '2026-01-23 15:30',
    note: '主打新款引流',
  },
  {
    id: 'SV-20260122-008',
    title: '办公室穿搭OOTD分享',
    status: 'RECONCILING',
    purposes: ['SEEDING', 'TEST'],
    platform: 'DOUYIN',
    account: 'CN-Brand-Official',
    creator: '达人-小美',
    publishedAt: '2026-01-22 18:00',
    owner: '李四',
    recorder: '李四',
    itemCount: 5,
    testItemCount: 2,
    testAccountingStatus: 'PENDING',
    sampleCount: 4,
    views: 89000,
    likes: 5200,
    gmv: 8900,
    isTestAccountingEnabled: true,
    videoUrl: 'https://example.com/videos/SV-20260122-008',
    updatedAt: '2026-01-22 20:45',
    note: '重点看评论反馈',
  },
  {
    id: 'SV-20260121-005',
    title: '夏季清凉穿搭推荐',
    status: 'RECONCILING',
    purposes: ['TEST'],
    platform: 'TIKTOK',
    account: 'IDN-Store-B',
    creator: 'KOL-Sunny',
    publishedAt: '2026-01-21 14:30',
    owner: '王五',
    recorder: '王五',
    itemCount: 2,
    testItemCount: 2,
    testAccountingStatus: 'PENDING',
    sampleCount: 2,
    views: 45000,
    likes: 2800,
    gmv: 3200,
    isTestAccountingEnabled: true,
    videoUrl: 'https://example.com/videos/SV-20260121-005',
    updatedAt: '2026-01-21 16:00',
    note: '纯测款内容',
  },
  {
    id: 'SV-20260120-003',
    title: '年货节预热视频',
    status: 'COMPLETED',
    purposes: ['TEASER', 'PROMOTION'],
    platform: 'KUAISHOU',
    account: 'KS-Official',
    creator: '运营-小张',
    publishedAt: '2026-01-20 10:00',
    owner: '赵六',
    recorder: '赵六',
    itemCount: 8,
    testItemCount: 0,
    testAccountingStatus: 'NONE',
    sampleCount: 6,
    views: 230000,
    likes: 15000,
    gmv: 45600,
    isTestAccountingEnabled: false,
    videoUrl: 'https://example.com/videos/SV-20260120-003',
    updatedAt: '2026-01-20 18:30',
    note: '预热素材',
  },
  {
    id: 'SV-20260119-001',
    title: '新品上架试水',
    status: 'DRAFT',
    purposes: ['SOFT_LAUNCH'],
    platform: 'TIKTOK',
    account: 'IDN-Store-A',
    creator: 'KOL-Blue',
    publishedAt: null,
    owner: '张三',
    recorder: '张三',
    itemCount: 1,
    testItemCount: 0,
    testAccountingStatus: 'NONE',
    sampleCount: 1,
    views: 0,
    likes: 0,
    gmv: 0,
    isTestAccountingEnabled: false,
    videoUrl: '',
    updatedAt: '2026-01-19 09:00',
    note: '待发布草稿',
  },
]

const VIDEO_ITEM_SEED: Record<string, VideoItem[]> = {
  'SV-20260122-008': [
    {
      id: 'SVI-001',
      evaluationIntent: 'TEST',
      projectRef: 'PRJ-20251216-001',
      productRef: 'SPU-20260110-001',
      productName: '印尼风格碎花连衣裙',
      sku: 'SKU-001',
      exposure: 28000,
      click: 2300,
      cart: 320,
      order: 62,
      pay: 58,
      gmv: 11542,
      recommendation: '继续',
      recommendationReason: '点击率和支付率表现稳定',
    },
    {
      id: 'SVI-002',
      evaluationIntent: 'TEST',
      projectRef: null,
      productRef: 'CAND-20260108-001',
      productName: '波西米亚风印花半身裙',
      sku: 'SKU-221',
      exposure: 21000,
      click: 1480,
      cart: 190,
      order: 31,
      pay: 25,
      gmv: 4975,
      recommendation: '改版',
      recommendationReason: '评论反馈尺码偏小，建议改版后复测',
    },
  ],
}

const VIDEO_EVIDENCE_SEED: Record<string, EvidenceAsset[]> = {
  'SV-20260122-008': [
    {
      id: 'EVD-001',
      type: '视频片段',
      name: '高互动片段-00:43',
      url: 'https://example.com/evidence/highlight-43',
      createdAt: '2026-01-22 18:45',
    },
    {
      id: 'EVD-002',
      type: '截图',
      name: '评论区反馈截图',
      url: 'https://example.com/evidence/comments',
      createdAt: '2026-01-22 19:10',
    },
  ],
}

const VIDEO_SAMPLE_SEED: Record<string, LiveSample[]> = {
  'SV-20260122-008': [
    { id: 'SAM-211', name: '办公室衬衫样衣-M', site: '深圳样衣间', status: '已归还', location: '样衣仓A-2', holder: '样衣管理员' },
    { id: 'SAM-212', name: '西装半裙样衣-S', site: '深圳样衣间', status: '使用中', location: '拍摄棚B', holder: '达人-小美' },
  ],
}

const VIDEO_LOG_SEED: Record<string, VideoLog[]> = {
  'SV-20260122-008': [
    { time: '2026-01-22 20:45', action: '导入平台数据', user: '李四', detail: '更新播放、互动、成交指标' },
    { time: '2026-01-22 19:30', action: '补充证据素材', user: '李四', detail: '上传评论截图 2 张' },
    { time: '2026-01-22 18:00', action: '发布记录', user: '达人-小美', detail: '记录状态改为核对中' },
  ],
}

const LEGACY_TESTING_PROJECT_REFERENCE_SEED: LegacyTestingProjectReference[] = []

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function listLiveSessions(): LiveSession[] {
  return clone(LIVE_SESSION_SEED)
}

export function getLiveSessionById(id: string): LiveSession | null {
  const found = LIVE_SESSION_SEED.find((item) => item.id === id)
  return found ? clone(found) : null
}

export function getLiveSessionItems(sessionId: string): LiveSessionItem[] {
  return clone(LIVE_ITEM_SEED[sessionId] ?? [])
}

export function getLiveSessionSamples(sessionId: string): LiveSample[] {
  return clone(LIVE_SAMPLE_SEED[sessionId] ?? [])
}

export function getLiveSessionLogs(sessionId: string): LiveLog[] {
  return clone(LIVE_LOG_SEED[sessionId] ?? [])
}

export function listVideoRecords(): VideoRecord[] {
  return clone(VIDEO_RECORD_SEED)
}

export function getVideoRecordById(id: string): VideoRecord | null {
  const found = VIDEO_RECORD_SEED.find((item) => item.id === id)
  return found ? clone(found) : null
}

export function getVideoItems(recordId: string): VideoItem[] {
  return clone(VIDEO_ITEM_SEED[recordId] ?? [])
}

export function getVideoEvidence(recordId: string): EvidenceAsset[] {
  return clone(VIDEO_EVIDENCE_SEED[recordId] ?? [])
}

export function getVideoSamples(recordId: string): LiveSample[] {
  return clone(VIDEO_SAMPLE_SEED[recordId] ?? [])
}

export function getVideoLogs(recordId: string): VideoLog[] {
  return clone(VIDEO_LOG_SEED[recordId] ?? [])
}

export function listLegacyTestingProjectReferences(): LegacyTestingProjectReference[] {
  return clone(LEGACY_TESTING_PROJECT_REFERENCE_SEED)
}
