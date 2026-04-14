import { appStore } from '../state/store.ts'
import {
  ACCOUNTING_STATUS_META,
  SESSION_STATUS_META,
  VIDEO_PLATFORM_META,
  VIDEO_PURPOSE_META,
  getVideoEvidence,
  getVideoItems,
  getVideoLogs,
  getVideoRecordById,
  getVideoSamples,
  type AccountingStatus,
  type EvidenceAsset,
  type LiveSample,
  type SessionStatus,
  type VideoItem,
  type VideoLog,
  type VideoPurpose,
  type VideoRecord,
} from '../data/pcs-testing.ts'
import {
  getVideoTestRecordById,
  listVideoTestRecords,
} from '../data/pcs-video-testing-repository.ts'
import {
  findProjectChannelProductByVideoRecord,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  findProjectByCode,
  getProjectById,
  listProjects,
} from '../data/pcs-project-repository.ts'
import {
  getProjectRelationProjectLabel,
  listProjectRelationsByVideoRecord,
  listVideoRecordProjectRelationCandidates,
  replaceVideoRecordProjectRelations,
} from '../data/pcs-project-relation-repository.ts'
import { ensurePcsProjectDemoDataReady } from './pcs-projects.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type QuickFilterKey = 'all' | 'reconciling' | 'canClose' | 'pendingAccounting' | 'accounted'
type DetailTabKey = 'overview' | 'items' | 'reconcile' | 'evidence' | 'accounting' | 'samples' | 'logs'
type VideoPlatformCode = VideoRecord['platform']
type VideoIntent = VideoItem['evaluationIntent']

interface VideoItemViewModel {
  id: string
  evaluationIntent: VideoIntent
  projectRef: string | null
  relatedProjectId: string | null
  productRef: string
  productName: string
  sku: string
  exposureType: string
  views: number
  likes: number
  comments: number
  shares: number
  clicks: number
  orders: number
  pay: number
  gmv: number
  recommendation: string | null
  recommendationReason: string | null
  decisionRef: string | null
}

interface VideoRecordViewModel {
  id: string
  title: string
  status: SessionStatus
  purposes: string[]
  platformCode: VideoPlatformCode
  platformLabel: string
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
  comments: number
  shares: number
  clicks: number
  orders: number
  gmv: number
  watchTime: number
  completionRate: number
  isTestAccountingEnabled: boolean
  videoUrl: string
  note: string
  createdAt: string
  updatedAt: string
  completedBy: string | null
  completedAt: string | null
  completionNote: string
  accountedBy: string | null
  accountedAt: string | null
  accountedNote: string
  items: VideoItemViewModel[]
  evidence: EvidenceAsset[]
  samples: LiveSample[]
  logs: VideoLog[]
}

interface CreateDraftState {
  title: string
  owner: string
  recorder: string
  platform: VideoPlatformCode | ''
  account: string
  creator: string
  publishedAt: string
  videoUrl: string
  purposes: VideoPurpose[]
  isTestAccountingEnabled: boolean
  note: string
}

interface CloseDialogState {
  open: boolean
  recordId: string
  completionNote: string
  unpublishedReason: string
}

interface AccountingDialogState {
  open: boolean
  recordId: string
  accountedNote: string
  confirmed: boolean
}

interface EditDrawerState {
  open: boolean
  recordId: string
  itemId: string
  draft: {
    evaluationIntent: VideoIntent
    projectRef: string
    productRef: string
    exposureType: string
    views: string
    likes: string
    comments: string
    shares: string
    clicks: string
    orders: string
    pay: string
    gmv: string
    recommendation: string
    recommendationReason: string
    noDataReason: string
  }
}

interface VideoTestingPageState {
  notice: string | null
  list: {
    search: string
    status: string
    purpose: string
    platform: string
    accounting: string
    quickFilter: QuickFilterKey
    currentPage: number
    pageSize: number
  }
  detail: {
    routeKey: string
    recordId: string | null
    activeTab: DetailTabKey
  }
  createDrawerOpen: boolean
  createDraft: CreateDraftState
  closeDialog: CloseDialogState
  accountingDialog: AccountingDialogState
  editDrawer: EditDrawerState
}

const DETAIL_TAB_OPTIONS: Array<{ key: DetailTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'items', label: '内容条目' },
  { key: 'reconcile', label: '数据核对' },
  { key: 'evidence', label: '证据素材' },
  { key: 'accounting', label: '测款入账' },
  { key: 'samples', label: '样衣关联' },
  { key: 'logs', label: '日志审计' },
]

const ITEM_INTENT_META: Record<VideoIntent, { label: string; className: string }> = {
  SELL: { label: 'SELL-沉淀', className: 'bg-blue-100 text-blue-700' },
  TEST: { label: 'TEST-测款', className: 'bg-violet-100 text-violet-700' },
  REVIEW: { label: 'REVIEW-复测', className: 'bg-orange-100 text-orange-700' },
}

const initialCreateDraft: CreateDraftState = {
  title: '',
  owner: '',
  recorder: '',
  platform: '',
  account: '',
  creator: '',
  publishedAt: '',
  videoUrl: '',
  purposes: [],
  isTestAccountingEnabled: false,
  note: '',
}

const state: VideoTestingPageState = {
  notice: null,
  list: {
    search: '',
    status: 'all',
    purpose: 'all',
    platform: 'all',
    accounting: 'all',
    quickFilter: 'all',
    currentPage: 1,
    pageSize: 8,
  },
  detail: {
    routeKey: '',
    recordId: null,
    activeTab: 'overview',
  },
  createDrawerOpen: false,
  createDraft: { ...initialCreateDraft },
  closeDialog: {
    open: false,
    recordId: '',
    completionNote: '',
    unpublishedReason: '',
  },
  accountingDialog: {
    open: false,
    recordId: '',
    accountedNote: '',
    confirmed: false,
  },
  editDrawer: {
    open: false,
    recordId: '',
    itemId: '',
    draft: {
      evaluationIntent: 'SELL',
      projectRef: '',
      productRef: '',
      exposureType: '',
      views: '',
      likes: '',
      comments: '',
      shares: '',
      clicks: '',
      orders: '',
      pay: '',
      gmv: '',
      recommendation: '',
      recommendationReason: '',
      noDataReason: '',
    },
  },
}

const recordStore = new Map<string, VideoRecordViewModel>()

function nowText(): string {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function todayCompact(): string {
  const now = new Date()
  return `${String(now.getFullYear())}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

function formatInteger(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN')
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN')
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function normalizeDetailTab(value: string | null): DetailTabKey {
  return DETAIL_TAB_OPTIONS.find((item) => item.key === value)?.key ?? 'overview'
}

function getCurrentQueryParams(): URLSearchParams {
  const [, search = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(search)
}

function getStatusCodeByLabel(label: string): SessionStatus {
  const matched = (Object.entries(SESSION_STATUS_META) as Array<[SessionStatus, { label: string }]>).find(
    ([, meta]) => meta.label === label,
  )
  return matched?.[0] ?? 'DRAFT'
}

function getAccountingCodeByValue(value: string): AccountingStatus {
  if (value === 'PENDING' || value === 'ACCOUNTED' || value === 'NONE') return value
  const matched = (Object.entries(ACCOUNTING_STATUS_META) as Array<[AccountingStatus, { label: string }]>).find(
    ([, meta]) => meta.label === value,
  )
  return matched?.[0] ?? 'NONE'
}

function getPurposeClass(label: string): string {
  const matched = Object.values(VIDEO_PURPOSE_META).find((item) => item.label === label)
  return matched?.color ?? 'bg-slate-100 text-slate-600'
}

function buildRecommendation(
  intent: VideoIntent,
  views: number,
  clicks: number,
  orders: number,
  gmv: number,
): { value: string | null; reason: string | null } {
  if (intent !== 'TEST') {
    return { value: null, reason: null }
  }
  const ctr = views > 0 ? clicks / views : 0
  const conversion = clicks > 0 ? orders / clicks : 0
  if (gmv >= 5000 || orders >= 20 || (ctr >= 0.02 && conversion >= 0.02)) {
    return { value: '继续', reason: '播放承接和转化表现稳定，可继续放量验证。' }
  }
  if (gmv >= 2000 || orders >= 8) {
    return { value: '补测', reason: '已有基础反馈，建议补充更多样本后再做结论。' }
  }
  return { value: '改版', reason: '成交和互动偏弱，建议改版后再进行复测。' }
}

function buildDecisionRef(projectRef: string | null, accounted: boolean): string | null {
  if (!projectRef || !accounted) return null
  return `DEC-${projectRef.replaceAll('-', '')}-001`
}

function resolveProjectIdentity(projectRef: string | null | undefined): { projectId: string; projectCode: string } | null {
  const normalized = projectRef?.trim() || ''
  if (!normalized) return null
  const project = getProjectById(normalized) ?? findProjectByCode(normalized)
  return project ? { projectId: project.projectId, projectCode: project.projectCode } : null
}

function inferTestingProjectIdentity(item: Pick<VideoItemViewModel, 'evaluationIntent' | 'productRef' | 'productName' | 'projectRef'>): {
  projectId: string
  projectCode: string
} | null {
  if (item.evaluationIntent !== 'TEST') return null
  const resolvedProject = resolveProjectIdentity(item.projectRef)
  if (resolvedProject) return resolvedProject
  ensurePcsProjectDemoDataReady()
  const searchText = `${item.productRef} ${item.productName}`
  const projectNamePart =
    searchText.includes('SPU-20260110-001') || searchText.includes('印尼风格碎花连衣裙')
      ? '印尼风格碎花连衣裙测款项目'
      : searchText.includes('CAND-20260108-001') || searchText.includes('波西米亚风')
        ? '波西米亚风印花半身裙测款项目'
        : searchText.includes('SPU-D004') || searchText.includes('牛仔短裤夏季款')
          ? '牛仔短裤夏季款测款项目'
          : ''
  if (!projectNamePart) return null
  const project = listProjects().find((candidate) => candidate.projectName.includes(projectNamePart))
  return project ? { projectId: project.projectId, projectCode: project.projectCode } : null
}

function getWorkItemStatusLabel(status: SessionStatus): string {
  if (status === 'RECONCILING') return '进行中'
  if (status === 'COMPLETED') return '已完成'
  if (status === 'CANCELLED') return '已取消'
  return '未开始'
}

function getVideoWorkItemSnapshot(record: VideoRecordViewModel): {
  actionItem: VideoItemViewModel | null
  rows: Array<{ label: string; value: string }>
} {
  const actionItem = record.items.find((item) => item.evaluationIntent === 'TEST') ?? record.items[0] ?? null
  const linkedChannelProduct =
    actionItem?.relatedProjectId
      ? findProjectChannelProductByVideoRecord(actionItem.relatedProjectId, record.id)
      : null
  return {
    actionItem,
    rows: [
      { label: '工作项状态', value: getWorkItemStatusLabel(record.status) },
      { label: '正式操作', value: '关联短视频测款记录' },
      { label: '渠道商品', value: linkedChannelProduct?.channelProductId || actionItem?.productRef || '-' },
      { label: '渠道商品编码', value: linkedChannelProduct?.channelProductCode || actionItem?.productRef || '-' },
      { label: '上游渠道商品编码', value: linkedChannelProduct?.upstreamChannelProductCode || '-' },
      { label: '发布渠道', value: `${record.platformLabel} / ${record.account}` },
      { label: '曝光量', value: formatInteger(actionItem?.views ?? record.views) },
      { label: '点击量', value: formatInteger(actionItem?.clicks ?? record.clicks) },
      { label: '下单量', value: formatInteger(actionItem?.orders ?? record.orders) },
      { label: '销售额', value: `¥${formatCurrency(actionItem?.gmv ?? record.gmv)}` },
      {
        label: '结果说明',
        value: actionItem?.recommendationReason || actionItem?.recommendation || record.note || '-',
      },
    ],
  }
}

function buildExposureType(intent: VideoIntent, index: number): string {
  if (intent === 'TEST') return index % 2 === 0 ? '试穿讲解' : '对比展示'
  if (index % 2 === 0) return '上身展示'
  return '搭配展示'
}

function buildItemComments(likes: number): number {
  return Math.max(1, Math.round(likes * 0.038))
}

function buildItemShares(likes: number): number {
  return Math.max(1, Math.round(likes * 0.018))
}

function inferPlatformCode(record: string): VideoPlatformCode {
  const matched = (Object.entries(VIDEO_PLATFORM_META) as Array<[VideoPlatformCode, { label: string }]>).find(
    ([, meta]) => record.includes(meta.label),
  )
  return matched?.[0] ?? 'OTHER'
}

function inferAccountingStatus(
  baseRecord: VideoRecord | null | undefined,
  repoRecord: ReturnType<typeof getVideoTestRecordById>,
  items: VideoItemViewModel[],
): AccountingStatus {
  if (baseRecord?.testAccountingStatus) {
    return baseRecord.testAccountingStatus
  }
  if (!repoRecord) {
    return items.some((item) => item.evaluationIntent === 'TEST') ? 'PENDING' : 'NONE'
  }
  if (repoRecord.legacyProjectRef || repoRecord.orderQty > 0 || repoRecord.gmvAmount > 0) {
    return 'PENDING'
  }
  return 'NONE'
}

function buildFallbackEvidence(record: VideoRecordViewModel): EvidenceAsset[] {
  const evidence: EvidenceAsset[] = []
  if (record.videoUrl) {
    evidence.push({
      id: `${record.id}-EVD-001`,
      type: '链接',
      name: '视频链接',
      url: record.videoUrl,
      createdAt: record.updatedAt,
    })
  }
  evidence.push({
    id: `${record.id}-EVD-002`,
    type: '截图',
    name: '数据面板截图',
    url: '#',
    createdAt: record.updatedAt,
  })
  return evidence
}

function buildFallbackSamples(record: VideoRecordViewModel): LiveSample[] {
  return record.items.slice(0, Math.max(1, Math.min(3, record.items.length))).map((item, index) => ({
    id: `${record.id}-SAM-${String(index + 1).padStart(3, '0')}`,
    name: `${item.productName} / ${item.productRef}`,
    site: '深圳样衣间',
    status: index === 0 ? '使用中' : '已归还',
    location: index === 0 ? '拍摄棚 B' : '样衣仓 A-2',
    holder: index === 0 ? record.creator : '样衣管理员',
  }))
}

function buildFallbackLogs(record: VideoRecordViewModel): VideoLog[] {
  return [
    { time: record.updatedAt, action: '导入平台数据', user: record.recorder || '当前用户', detail: '更新播放、互动和成交指标。' },
    { time: record.publishedAt || record.createdAt, action: record.publishedAt ? '发布记录' : '创建记录', user: record.creator || record.owner, detail: record.publishedAt ? '记录状态已进入核对中。' : '已创建短视频记录草稿。' },
  ]
}

function cloneItem(item: VideoItemViewModel): VideoItemViewModel {
  return { ...item }
}

function cloneRecord(record: VideoRecordViewModel): VideoRecordViewModel {
  return {
    ...record,
    purposes: [...record.purposes],
    items: record.items.map(cloneItem),
    evidence: record.evidence.map((item) => ({ ...item })),
    samples: record.samples.map((item) => ({ ...item })),
    logs: record.logs.map((item) => ({ ...item })),
  }
}

function recalculateRecord(record: VideoRecordViewModel): VideoRecordViewModel {
  const next = cloneRecord(record)
  next.itemCount = next.items.length
  next.testItemCount = next.items.filter((item) => item.evaluationIntent === 'TEST').length
  next.sampleCount = next.samples.length
  next.views = sum(next.items.map((item) => item.views))
  next.likes = sum(next.items.map((item) => item.likes))
  next.comments = sum(next.items.map((item) => item.comments))
  next.shares = sum(next.items.map((item) => item.shares))
  next.clicks = sum(next.items.map((item) => item.clicks))
  next.orders = sum(next.items.map((item) => item.orders))
  next.gmv = sum(next.items.map((item) => item.gmv))
  next.watchTime = next.views * 13
  next.completionRate = next.views > 0 ? Number(((next.clicks / next.views) * 100 + 12).toFixed(1)) : 0
  if (!next.isTestAccountingEnabled || next.testItemCount === 0) {
    next.testAccountingStatus = 'NONE'
  } else if (next.accountedAt) {
    next.testAccountingStatus = 'ACCOUNTED'
  } else {
    next.testAccountingStatus = 'PENDING'
  }
  return next
}

function buildItemFromBase(
  item: VideoItem,
  index: number,
  projectIdByCode: Map<string, string>,
  accounted: boolean,
): VideoItemViewModel {
  const directProject = resolveProjectIdentity(item.projectRef)
  const inferredProject = inferTestingProjectIdentity({
    evaluationIntent: item.evaluationIntent,
    productRef: item.productRef,
    productName: item.productName,
    projectRef: item.projectRef,
  })
  const projectRef = directProject?.projectCode ?? inferredProject?.projectCode ?? item.projectRef ?? null
  const relatedProjectId =
    projectRef || inferredProject
      ? projectIdByCode.get(projectRef || '') ?? directProject?.projectId ?? inferredProject?.projectId ?? null
      : null
  return {
    id: item.id,
    evaluationIntent: item.evaluationIntent,
    projectRef,
    relatedProjectId,
    productRef: item.productRef,
    productName: item.productName,
    sku: item.sku,
    exposureType: buildExposureType(item.evaluationIntent, index),
    views: item.exposure,
    likes: Math.max(item.click, Math.round(item.exposure * 0.06)),
    comments: buildItemComments(Math.max(item.click, Math.round(item.exposure * 0.06))),
    shares: buildItemShares(Math.max(item.click, Math.round(item.exposure * 0.06))),
    clicks: item.click,
    orders: item.order,
    pay: item.pay,
    gmv: item.gmv,
    recommendation: item.recommendation,
    recommendationReason: item.recommendationReason,
    decisionRef: buildDecisionRef(projectRef, accounted),
  }
}

function buildFallbackItems(record: ReturnType<typeof getVideoTestRecordById>): VideoItemViewModel[] {
  if (!record) return []
  const intent: VideoIntent = record.legacyProjectRef ? 'TEST' : 'SELL'
  const recommendation = buildRecommendation(intent, record.exposureQty, record.clickQty, record.orderQty, record.gmvAmount)
  const directProject = resolveProjectIdentity(record.legacyProjectId || record.legacyProjectRef)
  const inferredProject = inferTestingProjectIdentity({
    evaluationIntent: intent,
    productRef: record.spuCode || record.styleCode,
    productName: `${record.videoTitle}主推款`,
    projectRef: record.legacyProjectId || record.legacyProjectRef,
  })
  const projectRef = directProject?.projectCode ?? inferredProject?.projectCode ?? record.legacyProjectRef ?? null
  return [
    {
      id: `${record.videoRecordId}-ITEM-001`,
      evaluationIntent: intent,
      projectRef,
      relatedProjectId: directProject?.projectId ?? inferredProject?.projectId ?? null,
      productRef: record.spuCode || record.styleCode,
      productName: `${record.videoTitle}主推款`,
      sku: record.skuCode,
      exposureType: buildExposureType(intent, 0),
      views: record.exposureQty,
      likes: Math.max(record.clickQty, Math.round(record.exposureQty * 0.06)),
      comments: buildItemComments(Math.max(record.clickQty, Math.round(record.exposureQty * 0.06))),
      shares: buildItemShares(Math.max(record.clickQty, Math.round(record.exposureQty * 0.06))),
      clicks: record.clickQty,
      orders: record.orderQty,
      pay: Math.max(record.orderQty - 1, 0),
      gmv: record.gmvAmount,
      recommendation: recommendation.value,
      recommendationReason: recommendation.reason,
      decisionRef: buildDecisionRef(projectRef, getAccountingCodeByValue('ACCOUNTED') === 'ACCOUNTED'),
    },
  ]
}

function buildRecordViewModel(recordId: string): VideoRecordViewModel | null {
  const repoRecord = getVideoTestRecordById(recordId)
  const baseRecord = getVideoRecordById(recordId)
  if (!repoRecord && !baseRecord) return null

  const relationProjectMap = new Map(
    listProjectRelationsByVideoRecord(recordId).map((relation) => [relation.projectCode, relation.projectId]),
  )

  const items = baseRecord
    ? getVideoItems(recordId).map((item, index) =>
        buildItemFromBase(item, index, relationProjectMap, baseRecord.testAccountingStatus === 'ACCOUNTED'),
      )
    : buildFallbackItems(repoRecord)
  const testAccountingStatus = inferAccountingStatus(baseRecord, repoRecord, items)
  const accounted = testAccountingStatus === 'ACCOUNTED'
  const platformCode = baseRecord?.platform ?? inferPlatformCode(repoRecord?.channelName || '')
  const fallbackAccount = repoRecord?.channelName?.split('/').slice(-1)[0]?.trim() || ''

  const views = baseRecord?.views ?? repoRecord?.exposureQty ?? sum(items.map((item) => item.views))
  const likes = baseRecord?.likes ?? Math.max(repoRecord?.clickQty ?? 0, Math.round(views * 0.06))
  const clicks = repoRecord?.clickQty ?? sum(items.map((item) => item.clicks))
  const orders = repoRecord?.orderQty ?? sum(items.map((item) => item.orders))
  const gmv = repoRecord?.gmvAmount ?? baseRecord?.gmv ?? sum(items.map((item) => item.gmv))

  const viewModel: VideoRecordViewModel = {
    id: repoRecord?.videoRecordId ?? baseRecord!.id,
    title: repoRecord?.videoTitle ?? baseRecord!.title,
    status: baseRecord?.status ?? getStatusCodeByLabel(repoRecord?.recordStatus || ''),
    purposes: baseRecord ? baseRecord.purposes.map((item) => VIDEO_PURPOSE_META[item].label) : [VIDEO_PURPOSE_META.TEST.label],
    platformCode,
    platformLabel: VIDEO_PLATFORM_META[platformCode].label,
    account: baseRecord?.account ?? fallbackAccount,
    creator: baseRecord?.creator ?? '达人-待补录',
    publishedAt: baseRecord?.publishedAt ?? repoRecord?.publishedAt ?? null,
    owner: baseRecord?.owner ?? repoRecord?.ownerName ?? '短视频运营',
    recorder: baseRecord?.recorder ?? repoRecord?.ownerName ?? '数据助理',
    itemCount: baseRecord?.itemCount ?? items.length,
    testItemCount: baseRecord?.testItemCount ?? items.filter((item) => item.evaluationIntent === 'TEST').length,
    testAccountingStatus,
    sampleCount: baseRecord?.sampleCount ?? 0,
    views,
    likes,
    comments: sum(items.map((item) => item.comments)),
    shares: sum(items.map((item) => item.shares)),
    clicks,
    orders,
    gmv,
    watchTime: Math.round(views * 12.5),
    completionRate: views > 0 ? Number(((clicks / views) * 100 + 11).toFixed(1)) : 0,
    isTestAccountingEnabled: baseRecord?.isTestAccountingEnabled ?? testAccountingStatus !== 'NONE',
    videoUrl: baseRecord?.videoUrl ?? '',
    note: baseRecord?.note ?? '',
    createdAt: baseRecord?.publishedAt ?? repoRecord?.publishedAt ?? nowText(),
    updatedAt: baseRecord?.updatedAt ?? repoRecord?.publishedAt ?? nowText(),
    completedBy: (baseRecord?.status === 'COMPLETED' || getStatusCodeByLabel(repoRecord?.recordStatus || '') === 'COMPLETED') ? '系统演示' : null,
    completedAt: (baseRecord?.status === 'COMPLETED' || getStatusCodeByLabel(repoRecord?.recordStatus || '') === 'COMPLETED') ? (baseRecord?.updatedAt ?? repoRecord?.publishedAt ?? nowText()) : null,
    completionNote: (baseRecord?.status === 'COMPLETED' || getStatusCodeByLabel(repoRecord?.recordStatus || '') === 'COMPLETED') ? '数据核对完成，已完成关账。' : '',
    accountedBy: (baseRecord?.testAccountingStatus === 'ACCOUNTED' || accounted) ? '系统演示' : null,
    accountedAt: (baseRecord?.testAccountingStatus === 'ACCOUNTED' || accounted) ? (baseRecord?.updatedAt ?? repoRecord?.publishedAt ?? nowText()) : null,
    accountedNote: (baseRecord?.testAccountingStatus === 'ACCOUNTED' || accounted) ? 'TEST 条目已完成入账，已同步决策实例。' : '',
    items,
    evidence: baseRecord ? getVideoEvidence(recordId) : [],
    samples: baseRecord ? getVideoSamples(recordId) : [],
    logs: baseRecord ? getVideoLogs(recordId) : [],
  }

  if (viewModel.evidence.length === 0) {
    viewModel.evidence = buildFallbackEvidence(viewModel)
  }
  if (viewModel.samples.length === 0) {
    viewModel.samples = buildFallbackSamples(viewModel)
  }
  if (viewModel.logs.length === 0) {
    viewModel.logs = buildFallbackLogs(viewModel)
  }

  return recalculateRecord(viewModel)
}

function ensureRecordStore(): void {
  if (recordStore.size > 0) return
  listVideoTestRecords().forEach((item) => {
    const record = buildRecordViewModel(item.videoRecordId)
    if (record) {
      recordStore.set(record.id, record)
    }
  })
}

function getRecords(): VideoRecordViewModel[] {
  ensureRecordStore()
  return Array.from(recordStore.values())
    .map(cloneRecord)
    .sort((a, b) => (b.publishedAt || b.updatedAt).localeCompare(a.publishedAt || a.updatedAt))
}

function getRecord(recordId: string): VideoRecordViewModel | null {
  ensureRecordStore()
  const record = recordStore.get(recordId)
  return record ? cloneRecord(record) : null
}

function updateRecord(recordId: string, updater: (record: VideoRecordViewModel) => VideoRecordViewModel): void {
  ensureRecordStore()
  const current = recordStore.get(recordId)
  if (!current) return
  recordStore.set(recordId, recalculateRecord(updater(cloneRecord(current))))
}

function appendLog(record: VideoRecordViewModel, log: VideoLog): VideoRecordViewModel {
  return {
    ...record,
    updatedAt: log.time,
    logs: [log, ...record.logs],
  }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.closeDialog = { open: false, recordId: '', completionNote: '', unpublishedReason: '' }
  state.accountingDialog = { open: false, recordId: '', accountedNote: '', confirmed: false }
  state.editDrawer = {
    open: false,
    recordId: '',
    itemId: '',
    draft: {
      evaluationIntent: 'SELL',
      projectRef: '',
      productRef: '',
      exposureType: '',
      views: '',
      likes: '',
      comments: '',
      shares: '',
      clicks: '',
      orders: '',
      pay: '',
      gmv: '',
      recommendation: '',
      recommendationReason: '',
      noDataReason: '',
    },
  }
}

function resetCreateDraft(): void {
  state.createDraft = { ...initialCreateDraft }
}

function syncDetailState(recordId: string): void {
  const routeKey = appStore.getState().pathname
  if (state.detail.routeKey === routeKey && state.detail.recordId === recordId) return
  state.detail.routeKey = routeKey
  state.detail.recordId = recordId
  state.detail.activeTab = normalizeDetailTab(getCurrentQueryParams().get('tab'))
}

function getFilteredRecords(): VideoRecordViewModel[] {
  const keyword = state.list.search.trim().toLowerCase()
  return getRecords().filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        record.id,
        record.title,
        record.account,
        record.creator,
        record.owner,
        ...record.items.map((item) => item.productRef),
        ...record.items.map((item) => item.projectRef || ''),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    if (!matchesKeyword) return false
    if (state.list.status !== 'all' && record.status !== state.list.status) return false
    if (state.list.purpose !== 'all' && !record.purposes.includes(state.list.purpose)) return false
    if (state.list.platform !== 'all' && record.platformCode !== state.list.platform) return false
    if (state.list.accounting !== 'all' && record.testAccountingStatus !== state.list.accounting) return false
    if (state.list.quickFilter === 'reconciling' && record.status !== 'RECONCILING') return false
    if (state.list.quickFilter === 'canClose' && !(record.status === 'RECONCILING' && record.itemCount > 0)) return false
    if (state.list.quickFilter === 'pendingAccounting' && record.testAccountingStatus !== 'PENDING') return false
    if (state.list.quickFilter === 'accounted' && record.testAccountingStatus !== 'ACCOUNTED') return false
    return true
  })
}

function getPagedRecords(): { items: VideoRecordViewModel[]; total: number; totalPages: number } {
  const filtered = getFilteredRecords()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.list.pageSize))
  if (state.list.currentPage > totalPages) state.list.currentPage = totalPages
  if (state.list.currentPage < 1) state.list.currentPage = 1
  const start = (state.list.currentPage - 1) * state.list.pageSize
  return {
    items: filtered.slice(start, start + state.list.pageSize),
    total: filtered.length,
    totalPages,
  }
}

function getKpis() {
  const records = getRecords()
  return {
    reconciling: records.filter((item) => item.status === 'RECONCILING').length,
    canClose: records.filter((item) => item.status === 'RECONCILING' && item.itemCount > 0).length,
    pendingAccounting: records.filter((item) => item.testAccountingStatus === 'PENDING').length,
    accounted: records.filter((item) => item.testAccountingStatus === 'ACCOUNTED').length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-video-testing-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderModalShell(title: string, description: string, body: string, footer: string, sizeClass = 'max-w-lg'): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/45" data-pcs-video-testing-action="close-dialogs" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full ${escapeHtml(sizeClass)} flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="close-dialogs">关闭</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto space-y-4 px-4 py-4">${body}</div>
        <div class="flex items-center justify-end gap-2 border-t px-6 py-4">${footer}</div>
      </aside>
    </div>
  `
}

function renderDrawerShell(title: string, body: string, closeAction: string): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-video-testing-action="${escapeHtml(closeAction)}"></button>
      <aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
            <p class="mt-1 text-sm text-slate-500">演示数据仅用于页面表达，不接真实内容平台接口。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="${escapeHtml(closeAction)}">关闭</button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">${body}</div>
      </aside>
    </div>
  `
}

function renderStatusBadge(status: SessionStatus): string {
  const meta = SESSION_STATUS_META[status]
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${meta.color}">${escapeHtml(meta.label)}</span>`
}

function renderAccountingBadge(status: AccountingStatus): string {
  const meta = ACCOUNTING_STATUS_META[status]
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${meta.color}">${escapeHtml(meta.label)}</span>`
}

function renderPurposeBadges(purposes: string[]): string {
  return purposes
    .map((purpose) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${getPurposeClass(purpose)}">${escapeHtml(purpose)}</span>`)
    .join('')
}

function renderPlatformBadge(platform: VideoPlatformCode): string {
  const meta = VIDEO_PLATFORM_META[platform]
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${meta.color}">${escapeHtml(meta.label)}</span>`
}

function renderPager(totalPages: number): string {
  const pages = new Set<number>([1, totalPages, state.list.currentPage, state.list.currentPage - 1, state.list.currentPage + 1])
  const visiblePages = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <p>第 ${state.list.currentPage} / ${totalPages} 页</p>
      <div class="flex items-center gap-1">
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-video-testing-action="set-page" data-page="${state.list.currentPage - 1}" ${state.list.currentPage === 1 ? 'disabled' : ''}>上一页</button>
        ${visiblePages
          .map(
            (page) => `<button type="button" class="${toClassName(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs',
              page === state.list.currentPage ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}" data-pcs-video-testing-action="set-page" data-page="${page}">${page}</button>`,
          )
          .join('')}
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-video-testing-action="set-page" data-page="${state.list.currentPage + 1}" ${state.list.currentPage === totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderListHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 测款与渠道管理</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">短视频记录</h1>
        <p class="mt-1 text-sm text-slate-500">管理短视频内容资产、条目指标、证据素材和测款入账回写。</p>
      </div>
      <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="open-create-drawer">
        <i data-lucide="plus" class="h-4 w-4"></i>新建记录
      </button>
    </section>
  `
}

function renderListFilters(): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索记录</span>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
            <input class="h-10 w-full rounded-md border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索记录编号 / 标题 / 账号 / 达人 / 项目 / 款号" value="${escapeHtml(state.list.search)}" data-pcs-video-testing-field="list-search" />
          </div>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="list-status">
            <option value="all" ${state.list.status === 'all' ? 'selected' : ''}>全部状态</option>
            ${(Object.keys(SESSION_STATUS_META) as SessionStatus[])
              .map((status) => `<option value="${status}" ${state.list.status === status ? 'selected' : ''}>${escapeHtml(SESSION_STATUS_META[status].label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">用途</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="list-purpose">
            <option value="all" ${state.list.purpose === 'all' ? 'selected' : ''}>全部用途</option>
            ${Object.values(VIDEO_PURPOSE_META)
              .map((purpose) => `<option value="${escapeHtml(purpose.label)}" ${state.list.purpose === purpose.label ? 'selected' : ''}>${escapeHtml(purpose.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">平台</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="list-platform">
            <option value="all" ${state.list.platform === 'all' ? 'selected' : ''}>全部平台</option>
            ${(Object.keys(VIDEO_PLATFORM_META) as VideoPlatformCode[])
              .map((platform) => `<option value="${platform}" ${state.list.platform === platform ? 'selected' : ''}>${escapeHtml(VIDEO_PLATFORM_META[platform].label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">测款入账</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="list-accounting">
            <option value="all" ${state.list.accounting === 'all' ? 'selected' : ''}>全部入账状态</option>
            ${(Object.keys(ACCOUNTING_STATUS_META) as AccountingStatus[])
              .map((status) => `<option value="${status}" ${state.list.accounting === status ? 'selected' : ''}>${escapeHtml(ACCOUNTING_STATUS_META[status].label)}</option>`)
              .join('')}
          </select>
        </label>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="query">查询</button>
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderKpis(): string {
  const kpis = getKpis()
  const cards: Array<{ key: QuickFilterKey; label: string; value: number; helper: string; tone: string }> = [
    { key: 'reconciling', label: '待核对', value: kpis.reconciling, helper: '发布时间已落地，待补录和复核', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { key: 'canClose', label: '可关账', value: kpis.canClose, helper: '条目齐全，可完成关账', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { key: 'pendingAccounting', label: 'TEST 待入账', value: kpis.pendingAccounting, helper: 'TEST 条目尚未回写结论', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { key: 'accounted', label: '已入账', value: kpis.accounted, helper: '已完成测款结论回写', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
  ]
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
            <button type="button" class="${toClassName(
              'rounded-lg border p-4 text-left transition hover:shadow-sm',
              card.tone,
              state.list.quickFilter === card.key ? 'ring-2 ring-blue-500' : '',
            )}" data-pcs-video-testing-action="set-quick-filter" data-value="${card.key}">
              <p class="text-xs">${escapeHtml(card.label)}</p>
              <p class="mt-2 text-2xl font-semibold">${card.value}</p>
              <p class="mt-2 text-xs opacity-80">${escapeHtml(card.helper)}</p>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderRecordActions(record: VideoRecordViewModel): string {
  const actions: string[] = [
    `<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/video/${escapeHtml(record.id)}">查看</button>`,
  ]
  if (record.status === 'RECONCILING') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="open-close-dialog" data-record-id="${escapeHtml(record.id)}">完成关账</button>`)
  }
  if ((record.status === 'RECONCILING' || record.status === 'COMPLETED') && record.testAccountingStatus === 'PENDING') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700" data-pcs-video-testing-action="open-accounting-dialog" data-record-id="${escapeHtml(record.id)}">完成入账</button>`)
  }
  if (record.status === 'COMPLETED') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="export-record" data-record-id="${escapeHtml(record.id)}">导出</button>`)
  }
  return actions.join('')
}

function renderListTable(): string {
  const { items, total, totalPages } = getPagedRecords()
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-slate-900">记录列表</p>
          <p class="mt-1 text-xs text-slate-500">当前共筛选出 ${total} 条短视频记录，支持平台内容、条目、样衣和测款结论联查。</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">记录</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">用途</th>
              <th class="px-4 py-3">平台 / 账号</th>
              <th class="px-4 py-3">发布人 / 达人</th>
              <th class="px-4 py-3">发布时间</th>
              <th class="px-4 py-3 text-center">条目数</th>
              <th class="px-4 py-3 text-center">TEST 条目</th>
              <th class="px-4 py-3">测款入账</th>
              <th class="px-4 py-3 text-right">播放 / 点赞</th>
              <th class="px-4 py-3 text-center">样衣</th>
              <th class="px-4 py-3">最近更新</th>
              <th class="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              items.length === 0
                ? '<tr><td colspan="13" class="px-4 py-10 text-center text-sm text-slate-500">暂无匹配的短视频记录，请调整筛选条件后重试。</td></tr>'
                : items
                    .map(
                      (record) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/testing/video/${escapeHtml(record.id)}">${escapeHtml(record.id)}</button>
                              <p class="text-xs text-slate-500">${escapeHtml(record.title)}</p>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">${renderStatusBadge(record.status)}</td>
                          <td class="px-4 py-3 align-top"><div class="flex flex-wrap gap-1">${renderPurposeBadges(record.purposes)}</div></td>
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              ${renderPlatformBadge(record.platformCode)}
                              <p class="text-xs text-slate-500">${escapeHtml(record.account)}</p>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(record.creator)}</td>
                          <td class="px-4 py-3 align-top text-xs text-slate-500">${escapeHtml(record.publishedAt ? formatDateTime(record.publishedAt) : '-')}</td>
                          <td class="px-4 py-3 align-top text-center text-slate-700">${record.itemCount}</td>
                          <td class="px-4 py-3 align-top text-center">${record.testItemCount > 0 ? `<span class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">${record.testItemCount}</span>` : '-'}</td>
                          <td class="px-4 py-3 align-top">${renderAccountingBadge(record.testAccountingStatus)}</td>
                          <td class="px-4 py-3 align-top text-right text-slate-700">
                            <div>${record.views > 0 ? `${(record.views / 1000).toFixed(1)}k` : '-'}</div>
                            <div class="text-xs text-slate-500">${record.likes > 0 ? `${(record.likes / 1000).toFixed(1)}k` : '-'}</div>
                          </td>
                          <td class="px-4 py-3 align-top text-center text-slate-700">${record.sampleCount}</td>
                          <td class="px-4 py-3 align-top text-xs text-slate-500">${escapeHtml(formatDateTime(record.updatedAt))}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap justify-center gap-1">${renderRecordActions(record)}</div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      ${renderPager(totalPages)}
    </section>
  `
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  const draft = state.createDraft
  return renderDrawerShell(
    '新建短视频记录',
    `
      <div class="space-y-6">
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">基础信息</h4>
            <p class="mt-1 text-xs text-slate-500">用于定义内容记录主档和后续测款结论回写对象。</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs text-slate-500">标题</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="短视频-{{日期}}-{{账号}}" value="${escapeHtml(draft.title)}" data-pcs-video-testing-field="create-title" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">负责人</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.owner)}" placeholder="张三" data-pcs-video-testing-field="create-owner" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">录入人</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.recorder)}" placeholder="李四" data-pcs-video-testing-field="create-recorder" />
            </label>
          </div>
        </section>
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">发布信息</h4>
            <p class="mt-1 text-xs text-slate-500">补充平台、账号、达人和发布时间，作为后续核对依据。</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">平台</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="create-platform">
                <option value="" ${draft.platform === '' ? 'selected' : ''}>选择平台</option>
                ${(Object.keys(VIDEO_PLATFORM_META) as VideoPlatformCode[])
                  .map((platform) => `<option value="${platform}" ${draft.platform === platform ? 'selected' : ''}>${escapeHtml(VIDEO_PLATFORM_META[platform].label)}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">发布账号</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.account)}" placeholder="IDN-Store-A" data-pcs-video-testing-field="create-account" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">达人 / 运营</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.creator)}" placeholder="达人-小美" data-pcs-video-testing-field="create-creator" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">发布时间</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.publishedAt)}" placeholder="2026-04-13 11:30" data-pcs-video-testing-field="create-published-at" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs text-slate-500">视频链接</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.videoUrl)}" placeholder="https://tiktok.com/..." data-pcs-video-testing-field="create-video-url" />
            </label>
          </div>
        </section>
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">用途与测款</h4>
            <p class="mt-1 text-xs text-slate-500">内容用途可多选；勾选测款入账后，TEST 条目会进入待入账清单。</p>
          </div>
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              ${(Object.keys(VIDEO_PURPOSE_META) as VideoPurpose[])
                .map(
                  (purpose) => `
                    <button type="button" class="${toClassName(
                      'inline-flex rounded-full border px-3 py-1 text-xs transition',
                      draft.purposes.includes(purpose) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}" data-pcs-video-testing-action="toggle-create-purpose" data-value="${purpose}">${escapeHtml(VIDEO_PURPOSE_META[purpose].label)}</button>
                  `,
                )
                .join('')}
            </div>
            <button type="button" class="${toClassName(
              'inline-flex h-9 items-center rounded-md border px-3 text-sm',
              draft.isTestAccountingEnabled ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}" data-pcs-video-testing-action="toggle-create-accounting">
              <i data-lucide="${draft.isTestAccountingEnabled ? 'check-circle-2' : 'circle'}" class="mr-2 h-4 w-4"></i>
              启用测款入账
            </button>
          </div>
        </section>
        <section class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-900">备注</h4>
          <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="补充内容目标、数据背景或风险提醒" data-pcs-video-testing-field="create-note">${escapeHtml(draft.note)}</textarea>
        </section>
        <div class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="close-create-drawer">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="create-record-draft">保存草稿</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="create-record-reconciling">保存并进入核对</button>
        </div>
      </div>
    `,
    'close-create-drawer',
  )
}

function renderCloseDialog(): string {
  if (!state.closeDialog.open) return ''
  const record = getRecord(state.closeDialog.recordId)
  if (!record) return ''
  return renderModalShell(
    '完成记录（关账）',
    `确认完成「${record.title}」的关账动作，关账后记录将只读，仅可补充证据。`,
    `
      <div class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <p><span class="font-medium text-slate-900">记录编号：</span>${escapeHtml(record.id)}</p>
        <p class="mt-1"><span class="font-medium text-slate-900">条目数：</span>${record.items.length}</p>
      </div>
      ${
        !record.publishedAt
          ? `
            <label class="space-y-1">
              <span class="text-sm font-medium text-slate-900">未发布原因</span>
              <textarea class="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="说明未发布原因" data-pcs-video-testing-field="close-unpublished-reason">${escapeHtml(state.closeDialog.unpublishedReason)}</textarea>
            </label>
          `
          : ''
      }
      <label class="space-y-1">
        <span class="text-sm font-medium text-slate-900">关账备注</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="请输入关账备注" data-pcs-video-testing-field="close-note">${escapeHtml(state.closeDialog.completionNote)}</textarea>
      </label>
      <div class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <i data-lucide="alert-triangle" class="mt-0.5 h-4 w-4"></i>
        <p>关账后记录将只读，仅可补充证据素材和查看历史日志。</p>
      </div>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="confirm-close-record">确认关账</button>
    `,
  )
}

function renderAccountingDialog(): string {
  if (!state.accountingDialog.open) return ''
  const record = getRecord(state.accountingDialog.recordId)
  if (!record) return ''
  const testItems = record.items.filter((item) => item.evaluationIntent === 'TEST')
  return renderModalShell(
    '完成测款核对（入账）',
    `确认对「${record.title}」的 TEST 条目完成核对并写入测款结论。`,
    `
      <div class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <p><span class="font-medium text-slate-900">记录编号：</span>${escapeHtml(record.id)}</p>
        <p class="mt-1"><span class="font-medium text-slate-900">TEST 条目数：</span>${testItems.length}</p>
      </div>
      <section class="space-y-2">
        <p class="text-sm font-medium text-slate-900">入账预览</p>
        <div class="space-y-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
          ${testItems
            .map(
              (item) => `<div class="rounded-md bg-blue-50 px-3 py-2 text-blue-800">• ${escapeHtml(item.projectRef ? `项目维度：${item.projectRef}` : `商品维度：${item.productRef}`)}</div>`,
            )
            .join('')}
        </div>
      </section>
      <label class="space-y-1">
        <span class="text-sm font-medium text-slate-900">入账备注</span>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="请输入入账备注" data-pcs-video-testing-field="accounting-note">${escapeHtml(state.accountingDialog.accountedNote)}</textarea>
      </label>
      <button type="button" class="${toClassName(
        'inline-flex h-9 items-center rounded-md border px-3 text-sm',
        state.accountingDialog.confirmed ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}" data-pcs-video-testing-action="toggle-accounting-confirmed">
        <i data-lucide="${state.accountingDialog.confirmed ? 'check-circle-2' : 'circle'}" class="mr-2 h-4 w-4"></i>我已确认 TEST 条目绑定正确，数据完整
      </button>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="confirm-accounting">确认入账</button>
    `,
  )
}

function renderEditDrawer(): string {
  if (!state.editDrawer.open) return ''
  const record = getRecord(state.editDrawer.recordId)
  const item = record?.items.find((candidate) => candidate.id === state.editDrawer.itemId)
  if (!record || !item) return ''
  const draft = state.editDrawer.draft
  return renderDrawerShell(
    `编辑条目 - ${item.id}`,
    `
      <div class="space-y-6">
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">基础字段</h4>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">评估意图</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="edit-intent">
                ${(Object.keys(ITEM_INTENT_META) as VideoIntent[])
                  .map((intent) => `<option value="${intent}" ${draft.evaluationIntent === intent ? 'selected' : ''}>${escapeHtml(ITEM_INTENT_META[intent].label)}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">关联项目</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.projectRef)}" placeholder="输入项目编号" data-pcs-video-testing-field="edit-project-ref" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">关联商品</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.productRef)}" placeholder="输入款号 / SPU / SKU" data-pcs-video-testing-field="edit-product-ref" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">露出方式</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.exposureType)}" placeholder="上身展示 / 试穿讲解" data-pcs-video-testing-field="edit-exposure-type" />
            </label>
          </div>
        </section>
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">指标数据</h4>
          <div class="grid gap-4 md:grid-cols-3">
            ${[
              ['播放量', 'edit-views', draft.views],
              ['点赞', 'edit-likes', draft.likes],
              ['评论', 'edit-comments', draft.comments],
              ['分享', 'edit-shares', draft.shares],
              ['点击', 'edit-clicks', draft.clicks],
              ['订单', 'edit-orders', draft.orders],
              ['支付', 'edit-pay', draft.pay],
              ['GMV', 'edit-gmv', draft.gmv],
            ]
              .map(
                ([label, field, value]) => `
                  <label class="space-y-1">
                    <span class="text-xs text-slate-500">${escapeHtml(label)}</span>
                    <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(value)}" data-pcs-video-testing-field="${escapeHtml(field)}" />
                  </label>
                `,
              )
              .join('')}
          </div>
          ${
            draft.evaluationIntent === 'TEST'
              ? `
                <label class="space-y-1">
                  <span class="text-xs text-slate-500">无数据原因</span>
                  <textarea class="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="TEST 条目指标全空时说明原因" data-pcs-video-testing-field="edit-no-data-reason">${escapeHtml(draft.noDataReason)}</textarea>
                </label>
              `
              : ''
          }
        </section>
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">建议</h4>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">推荐建议</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-video-testing-field="edit-recommendation">
              <option value="" ${draft.recommendation === '' ? 'selected' : ''}>未判定</option>
              <option value="继续" ${draft.recommendation === '继续' ? 'selected' : ''}>继续</option>
              <option value="改版" ${draft.recommendation === '改版' ? 'selected' : ''}>改版</option>
              <option value="补测" ${draft.recommendation === '补测' ? 'selected' : ''}>补测</option>
              <option value="淘汰" ${draft.recommendation === '淘汰' ? 'selected' : ''}>淘汰</option>
            </select>
          </label>
          <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="输入建议原因" data-pcs-video-testing-field="edit-recommendation-reason">${escapeHtml(draft.recommendationReason)}</textarea>
        </section>
        ${
          item.decisionRef
            ? `<div class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><i data-lucide="check-circle-2" class="mr-2 inline h-4 w-4"></i>已入账，关联决策实例：${escapeHtml(item.decisionRef)}</div>`
            : ''
        }
        <div class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="close-dialogs">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="save-edit-item">保存</button>
        </div>
      </div>
    `,
    'close-dialogs',
  )
}

function renderListPageDialogs(): string {
  return [renderCreateDrawer(), renderCloseDialog(), renderAccountingDialog(), renderEditDrawer()].join('')
}

function renderDetailHeader(record: VideoRecordViewModel, relatedProjects: Array<{ projectId: string; label: string }>): string {
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
        <div class="space-y-3">
          <div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/video">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
            </button>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(record.title)}</h1>
              ${renderStatusBadge(record.status)}
              ${renderAccountingBadge(record.testAccountingStatus)}
            </div>
            <p class="mt-2 text-sm text-slate-500">${escapeHtml(record.id)} · ${escapeHtml(record.platformLabel)} · ${escapeHtml(record.account)} · ${escapeHtml(record.creator)} · ${escapeHtml(record.publishedAt ? formatDateTime(record.publishedAt) : '-')}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${
            record.status === 'RECONCILING'
              ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="open-close-dialog" data-record-id="${escapeHtml(record.id)}"><i data-lucide="check-circle-2" class="h-4 w-4"></i>完成关账</button>`
              : ''
          }
          ${
            (record.status === 'RECONCILING' || record.status === 'COMPLETED') && record.testAccountingStatus === 'PENDING'
              ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-video-testing-action="open-accounting-dialog" data-record-id="${escapeHtml(record.id)}"><i data-lucide="calculator" class="h-4 w-4"></i>完成测款入账</button>`
              : ''
          }
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="export-record" data-record-id="${escapeHtml(record.id)}">
            <i data-lucide="download" class="h-4 w-4"></i>导出
          </button>
        </div>
      </div>
      ${
        relatedProjects.length > 0
          ? `
            <div class="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
              关联项目：${relatedProjects
                .map((project) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(project.projectId)}">${escapeHtml(project.label)}</button>`)
                .join('、')}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderOverviewTab(record: VideoRecordViewModel): string {
  return `
    <div class="space-y-6">
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${[
          ['播放量', record.views > 0 ? `${(record.views / 1000).toFixed(1)}k` : '-'],
          ['完播率', record.completionRate > 0 ? `${record.completionRate}%` : '-'],
          ['点赞', record.likes > 0 ? `${(record.likes / 1000).toFixed(1)}k` : '-'],
          ['评论 / 分享', `${record.comments}/${record.shares}`],
          ['GMV', record.gmv > 0 ? `¥${formatCurrency(record.gmv)}` : '-'],
        ]
          .map(
            ([label, value]) => `
              <article class="rounded-lg border bg-white p-4 text-center">
                <p class="text-sm text-slate-500">${escapeHtml(label)}</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(value)}</p>
              </article>
            `,
          )
          .join('')}
      </section>
      ${
        record.videoUrl
          ? `
            <section class="rounded-lg border bg-white p-4">
              <h2 class="text-lg font-semibold text-slate-900">视频链接</h2>
              <a href="${escapeHtml(record.videoUrl)}" target="_blank" rel="noreferrer" class="mt-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
                <i data-lucide="play" class="h-4 w-4"></i>${escapeHtml(record.videoUrl)}
                <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
              </a>
            </section>
          `
          : ''
      }
      ${
        record.items.length === 0
          ? `
            <section class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div class="flex items-center gap-3">
                <i data-lucide="alert-triangle" class="h-5 w-5"></i>
                <p>暂无内容条目，请添加条目或导入平台数据后再继续核对。</p>
              </div>
            </section>
          `
          : ''
      }
    </div>
  `
}

function renderItemsTab(record: VideoRecordViewModel): string {
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-medium text-slate-900">内容条目（${record.items.length}）</h3>
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="open-edit-item" data-record-id="${escapeHtml(record.id)}" data-item-id="${escapeHtml(record.items[0]?.id || '')}" ${record.items[0] ? '' : 'disabled'}>
          <i data-lucide="plus" class="h-4 w-4"></i>添加条目
        </button>
      </div>
      <section class="rounded-lg border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">意图</th>
                <th class="px-4 py-3">绑定对象</th>
                <th class="px-4 py-3">商品</th>
                <th class="px-4 py-3">露出方式</th>
                <th class="px-4 py-3 text-right">播放</th>
                <th class="px-4 py-3 text-right">点赞</th>
                <th class="px-4 py-3 text-right">订单 / GMV</th>
                <th class="px-4 py-3">建议</th>
                <th class="px-4 py-3">决策关联</th>
                <th class="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${record.items
                .map(
                  (item) => `
                    <tr class="hover:bg-slate-50/80">
                      <td class="px-4 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ITEM_INTENT_META[item.evaluationIntent].className}">${escapeHtml(ITEM_INTENT_META[item.evaluationIntent].label)}</span></td>
                      <td class="px-4 py-3">${
                        item.evaluationIntent === 'TEST'
                          ? item.projectRef && item.relatedProjectId
                            ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.relatedProjectId)}">${escapeHtml(item.projectRef)}</button>`
                            : '<span class="text-rose-600">待绑定商品项目</span>'
                          : '-'
                      }</td>
                      <td class="px-4 py-3"><p class="font-medium text-slate-900">${escapeHtml(item.productRef)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(item.productName)}</p></td>
                      <td class="px-4 py-3">${escapeHtml(item.exposureType)}</td>
                      <td class="px-4 py-3 text-right">${item.views > 0 ? `${(item.views / 1000).toFixed(1)}k` : '-'}</td>
                      <td class="px-4 py-3 text-right">${item.likes > 0 ? `${(item.likes / 1000).toFixed(1)}k` : '-'}</td>
                      <td class="px-4 py-3 text-right">${item.orders}/¥${formatCurrency(item.gmv)}</td>
                      <td class="px-4 py-3">${item.recommendation ? `<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">${escapeHtml(item.recommendation)}</span>` : '-'}</td>
                      <td class="px-4 py-3">${item.decisionRef ? `<span class="text-blue-700">${escapeHtml(item.decisionRef)}</span>` : '-'}</td>
                      <td class="px-4 py-3 text-center"><button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="open-edit-item" data-record-id="${escapeHtml(record.id)}" data-item-id="${escapeHtml(item.id)}">编辑</button></td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderReconcileTab(record: VideoRecordViewModel): string {
  const checks = [
    { ok: Boolean(record.publishedAt), label: '发布时间已填写' },
    { ok: record.items.length > 0, label: '条目数据完整' },
    { ok: record.items.filter((item) => item.evaluationIntent === 'TEST').every((item) => item.projectRef || item.productRef), label: 'TEST 条目已绑定对象' },
  ]
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <h2 class="text-lg font-semibold text-slate-900">数据来源</h2>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <i data-lucide="upload" class="h-4 w-4"></i>CSV 导入
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <i data-lucide="download" class="h-4 w-4"></i>下载模板
          </button>
        </div>
        <div class="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">平台 API 对接（v1）：暂未开放，当前原型使用导入和补录方式演示。</div>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <h2 class="text-lg font-semibold text-slate-900">核对清单</h2>
        <div class="mt-4 space-y-2">
          ${checks
            .map(
              (check) => `
                <div class="flex items-center gap-2 text-sm ${check.ok ? 'text-slate-700' : 'text-rose-700'}">
                  <i data-lucide="${check.ok ? 'check-circle-2' : 'x-circle'}" class="h-4 w-4"></i>
                  <span>${escapeHtml(check.label)}</span>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `
}

function renderEvidenceTab(record: VideoRecordViewModel): string {
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-medium text-slate-900">证据与素材（${record.evidence.length}）</h3>
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
          <i data-lucide="plus" class="h-4 w-4"></i>上传素材
        </button>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        ${record.evidence
          .map(
            (evidence) => `
              <article class="rounded-lg border bg-white p-4 transition hover:shadow-sm">
                <div class="flex items-center gap-3">
                  <i data-lucide="${evidence.type === '视频片段' ? 'play' : evidence.type === '链接' ? 'link-2' : 'image'}" class="h-8 w-8 text-blue-500"></i>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-900">${escapeHtml(evidence.name)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(formatDateTime(evidence.createdAt))}</p>
                  </div>
                  <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50">
                    <i data-lucide="eye" class="h-4 w-4"></i>
                  </button>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </div>
  `
}

function renderAccountingTab(record: VideoRecordViewModel, testItems: VideoItemViewModel[]): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-lg font-semibold text-slate-900">TEST 条目聚合（${testItems.length}条）</h2>
        </div>
        <div class="overflow-x-auto">
          ${
            testItems.length === 0
              ? '<div class="px-6 py-10 text-center text-sm text-slate-500">暂无 TEST 条目，无需测款入账。</div>'
              : `
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                  <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th class="px-4 py-3">条目</th>
                      <th class="px-4 py-3">绑定对象</th>
                      <th class="px-4 py-3">商品</th>
                      <th class="px-4 py-3 text-right">核心指标</th>
                      <th class="px-4 py-3">建议</th>
                      <th class="px-4 py-3">决策实例</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${testItems
                      .map(
                        (item) => `
                          <tr>
                            <td class="px-4 py-3">${escapeHtml(item.id)}</td>
                            <td class="px-4 py-3">${item.projectRef ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.relatedProjectId || '')}">${escapeHtml(item.projectRef)}</button>` : '<span class="text-slate-500">仅商品</span>'}</td>
                            <td class="px-4 py-3">${escapeHtml(item.productRef)}</td>
                            <td class="px-4 py-3 text-right">播放 ${(item.views / 1000).toFixed(1)}k / GMV ¥${formatCurrency(item.gmv)}</td>
                            <td class="px-4 py-3">${item.recommendation ? `<span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">${escapeHtml(item.recommendation)}</span>` : '-'}</td>
                            <td class="px-4 py-3">${item.decisionRef ? `<span class="text-blue-700">${escapeHtml(item.decisionRef)}</span>` : '-'}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `
          }
        </div>
      </section>
      ${
        record.testAccountingStatus === 'ACCOUNTED'
          ? `
            <section class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div class="flex items-center gap-3">
                <i data-lucide="check-circle-2" class="h-5 w-5 text-emerald-600"></i>
                <div>
                  <p class="font-medium text-emerald-800">已完成测款入账</p>
                  <p class="mt-1 text-sm text-emerald-700">入账人：${escapeHtml(record.accountedBy || '-')} · 入账时间：${escapeHtml(record.accountedAt || '-')}</p>
                  <p class="mt-1 text-sm text-emerald-700">备注：${escapeHtml(record.accountedNote || '-')}</p>
                </div>
              </div>
            </section>
          `
          : ''
      }
    </div>
  `
}

function renderSamplesTab(record: VideoRecordViewModel): string {
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-medium text-slate-900">使用样衣（${record.samples.length}）</h3>
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
          <i data-lucide="shirt" class="h-4 w-4"></i>发起样衣使用申请
        </button>
      </div>
      <section class="rounded-lg border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">样衣编号</th>
                <th class="px-4 py-3">名称</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3">位置</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${record.samples
                .map(
                  (sample) => `
                    <tr>
                      <td class="px-4 py-3 text-blue-700">${escapeHtml(sample.id)}</td>
                      <td class="px-4 py-3">${escapeHtml(sample.name)}</td>
                      <td class="px-4 py-3"><span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">${escapeHtml(sample.status)}</span></td>
                      <td class="px-4 py-3">${escapeHtml(sample.location)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderLogsTab(record: VideoRecordViewModel): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">操作</th>
                <th class="px-4 py-3">操作人</th>
                <th class="px-4 py-3">时间</th>
                <th class="px-4 py-3">详情</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${record.logs
                .map(
                  (log) => `
                    <tr>
                      <td class="px-4 py-3 font-medium text-slate-900">${escapeHtml(log.action)}</td>
                      <td class="px-4 py-3">${escapeHtml(log.user)}</td>
                      <td class="px-4 py-3 text-slate-500">${escapeHtml(formatDateTime(log.time))}</td>
                      <td class="px-4 py-3 text-slate-600">${escapeHtml(log.detail)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderDetailSidebar(record: VideoRecordViewModel, relatedProjects: Array<{ projectId: string; label: string }>): string {
  const workItemSnapshot = getVideoWorkItemSnapshot(record)
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">负责人信息</h3>
        <div class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between gap-3"><span class="text-slate-500">负责人</span><span>${escapeHtml(record.owner)}</span></div>
          <div class="flex justify-between gap-3"><span class="text-slate-500">录入人</span><span>${escapeHtml(record.recorder)}</span></div>
        </div>
      </section>
      ${
        record.status === 'COMPLETED'
          ? `
            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-sm font-semibold text-slate-900">关账信息</h3>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex justify-between gap-3"><span class="text-slate-500">关账人</span><span>${escapeHtml(record.completedBy || '-')}</span></div>
                <div class="flex justify-between gap-3"><span class="text-slate-500">关账时间</span><span>${escapeHtml(record.completedAt || '-')}</span></div>
              </div>
            </section>
          `
          : ''
      }
      ${
        record.testAccountingStatus === 'ACCOUNTED'
          ? `
            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-sm font-semibold text-slate-900">入账信息</h3>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex justify-between gap-3"><span class="text-slate-500">入账人</span><span>${escapeHtml(record.accountedBy || '-')}</span></div>
                <div class="flex justify-between gap-3"><span class="text-slate-500">入账时间</span><span>${escapeHtml(record.accountedAt || '-')}</span></div>
              </div>
            </section>
          `
          : ''
      }
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">工作项定义核对</h3>
        <div class="mt-4 space-y-3 text-sm">
          ${workItemSnapshot.rows
            .map(
              (row) => `<div class="flex justify-between gap-3"><span class="text-slate-500">${escapeHtml(row.label)}</span><span class="max-w-[150px] text-right text-slate-900">${escapeHtml(row.value)}</span></div>`,
            )
            .join('')}
        </div>
        <div class="mt-4">
          <button
            type="button"
            class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
            data-pcs-video-testing-action="open-edit-item"
            data-record-id="${escapeHtml(record.id)}"
            data-item-id="${escapeHtml(workItemSnapshot.actionItem?.id || '')}"
            ${workItemSnapshot.actionItem ? '' : 'disabled'}
          >
            <i data-lucide="link-2" class="h-4 w-4"></i>关联短视频测款记录
          </button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">快捷联查</h3>
        <div class="mt-4 space-y-2">
          <button type="button" class="inline-flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(relatedProjects[0] ? `/pcs/projects/${relatedProjects[0].projectId}` : '/pcs/projects')}">
            <i data-lucide="link-2" class="h-4 w-4"></i>查看关联项目
          </button>
          <button type="button" class="inline-flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-video-testing-action="set-detail-tab" data-tab="accounting">
            <i data-lucide="file-text" class="h-4 w-4"></i>查看测款结论
          </button>
        </div>
      </section>
    </div>
  `
}

function renderDetailContent(record: VideoRecordViewModel): string {
  const relatedProjects = Array.from(
    new Map(
      listProjectRelationsByVideoRecord(record.id).map((relation) => [
        relation.projectId,
        { projectId: relation.projectId, label: getProjectRelationProjectLabel(relation.projectId) },
      ]),
    ).values(),
  )
  const testItems = record.items.filter((item) => item.evaluationIntent === 'TEST')

  let activeContent = renderOverviewTab(record)
  if (state.detail.activeTab === 'items') activeContent = renderItemsTab(record)
  if (state.detail.activeTab === 'reconcile') activeContent = renderReconcileTab(record)
  if (state.detail.activeTab === 'evidence') activeContent = renderEvidenceTab(record)
  if (state.detail.activeTab === 'accounting') activeContent = renderAccountingTab(record, testItems)
  if (state.detail.activeTab === 'samples') activeContent = renderSamplesTab(record)
  if (state.detail.activeTab === 'logs') activeContent = renderLogsTab(record)

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderDetailHeader(record, relatedProjects)}
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div class="space-y-4">
          <section class="rounded-lg border bg-white p-2">
            <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
              ${DETAIL_TAB_OPTIONS
                .map(
                  (tab) => `
                    <button type="button" class="${toClassName(
                      'inline-flex h-10 items-center justify-center rounded-md px-3 text-sm transition',
                      state.detail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}" data-pcs-video-testing-action="set-detail-tab" data-tab="${tab.key}">${escapeHtml(tab.label)}</button>
                  `,
                )
                .join('')}
            </div>
          </section>
          ${activeContent}
        </div>
        ${renderDetailSidebar(record, relatedProjects)}
      </div>
      ${renderCloseDialog()}
      ${renderAccountingDialog()}
      ${renderEditDrawer()}
    </div>
  `
}

function createRecord(status: SessionStatus): void {
  ensureRecordStore()
  const draft = state.createDraft
  const recordId = `SV-${todayCompact()}-${String(recordStore.size + 1).padStart(3, '0')}`
  const purposes = draft.purposes.length > 0 ? draft.purposes.map((item) => VIDEO_PURPOSE_META[item].label) : [VIDEO_PURPOSE_META.PROMOTION.label]
  const record: VideoRecordViewModel = {
    id: recordId,
    title: draft.title.trim() || `短视频记录 ${recordId}`,
    status,
    purposes,
    platformCode: draft.platform || 'OTHER',
    platformLabel: draft.platform ? VIDEO_PLATFORM_META[draft.platform].label : VIDEO_PLATFORM_META.OTHER.label,
    account: draft.account.trim() || '待补录账号',
    creator: draft.creator.trim() || '达人-待分配',
    publishedAt: draft.publishedAt.trim() || null,
    owner: draft.owner.trim() || '内容运营',
    recorder: draft.recorder.trim() || '数据助理',
    itemCount: 0,
    testItemCount: 0,
    testAccountingStatus: draft.isTestAccountingEnabled ? 'PENDING' : 'NONE',
    sampleCount: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    orders: 0,
    gmv: 0,
    watchTime: 0,
    completionRate: 0,
    isTestAccountingEnabled: draft.isTestAccountingEnabled,
    videoUrl: draft.videoUrl.trim(),
    note: draft.note.trim(),
    createdAt: nowText(),
    updatedAt: nowText(),
    completedBy: null,
    completedAt: null,
    completionNote: '',
    accountedBy: null,
    accountedAt: null,
    accountedNote: '',
    items: [],
    evidence: [],
    samples: [],
    logs: [
      {
        time: nowText(),
        action: '创建记录',
        user: '当前用户',
        detail: status === 'DRAFT' ? '记录已保存为草稿。' : '记录已创建并进入核对中。',
      },
    ],
  }
  recordStore.set(recordId, record)
  state.notice = `短视频记录「${record.title}」已创建。`
  closeAllDialogs()
  resetCreateDraft()
  appStore.navigate(`/pcs/testing/video/${recordId}`)
}

export function renderPcsVideoTestingListPage(): string {
  ensureRecordStore()
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderListHeader()}
      ${renderListFilters()}
      ${renderKpis()}
      ${renderListTable()}
      ${renderListPageDialogs()}
    </div>
  `
}

export function renderPcsVideoTestingDetailPage(recordId: string): string {
  ensureRecordStore()
  syncDetailState(recordId)
  const record = getRecord(recordId)

  if (!record) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">短视频记录不存在</h1>
              <p class="mt-1 text-sm text-slate-500">未找到对应的短视频记录，请返回列表重新选择。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/video">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回短视频记录
            </button>
          </div>
        </section>
      </div>
    `
  }

  return renderDetailContent(record)
}

export function handlePcsVideoTestingInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-video-testing-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsVideoTestingField
  if (!field) return false

  if (field === 'list-search' && fieldNode instanceof HTMLInputElement) {
    state.list.search = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-status' && fieldNode instanceof HTMLSelectElement) {
    state.list.status = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-purpose' && fieldNode instanceof HTMLSelectElement) {
    state.list.purpose = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-platform' && fieldNode instanceof HTMLSelectElement) {
    state.list.platform = fieldNode.value
    state.list.currentPage = 1
    return true
  }
  if (field === 'list-accounting' && fieldNode instanceof HTMLSelectElement) {
    state.list.accounting = fieldNode.value
    state.list.currentPage = 1
    return true
  }

  const createInputFields: Record<string, keyof CreateDraftState> = {
    'create-title': 'title',
    'create-owner': 'owner',
    'create-recorder': 'recorder',
    'create-account': 'account',
    'create-creator': 'creator',
    'create-published-at': 'publishedAt',
    'create-video-url': 'videoUrl',
  }
  if (field in createInputFields && fieldNode instanceof HTMLInputElement) {
    ;(state.createDraft as Record<string, string>)[createInputFields[field]] = fieldNode.value
    return true
  }
  if (field === 'create-platform' && fieldNode instanceof HTMLSelectElement) {
    state.createDraft.platform = (fieldNode.value || '') as VideoPlatformCode | ''
    return true
  }
  if (field === 'create-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.createDraft.note = fieldNode.value
    return true
  }

  if (field === 'close-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.closeDialog.completionNote = fieldNode.value
    return true
  }
  if (field === 'close-unpublished-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.closeDialog.unpublishedReason = fieldNode.value
    return true
  }
  if (field === 'accounting-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.accountingDialog.accountedNote = fieldNode.value
    return true
  }

  if (field === 'edit-intent' && fieldNode instanceof HTMLSelectElement) {
    state.editDrawer.draft.evaluationIntent = fieldNode.value as VideoIntent
    return true
  }
  if (field === 'edit-recommendation' && fieldNode instanceof HTMLSelectElement) {
    state.editDrawer.draft.recommendation = fieldNode.value
    return true
  }

  const editInputFields: Record<string, keyof EditDrawerState['draft']> = {
    'edit-project-ref': 'projectRef',
    'edit-product-ref': 'productRef',
    'edit-exposure-type': 'exposureType',
    'edit-views': 'views',
    'edit-likes': 'likes',
    'edit-comments': 'comments',
    'edit-shares': 'shares',
    'edit-clicks': 'clicks',
    'edit-orders': 'orders',
    'edit-pay': 'pay',
    'edit-gmv': 'gmv',
  }
  if (field in editInputFields && fieldNode instanceof HTMLInputElement) {
    ;(state.editDrawer.draft as Record<string, string>)[editInputFields[field]] = fieldNode.value
    return true
  }
  if (field === 'edit-recommendation-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.editDrawer.draft.recommendationReason = fieldNode.value
    return true
  }
  if (field === 'edit-no-data-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.editDrawer.draft.noDataReason = fieldNode.value
    return true
  }

  return false
}

export function handlePcsVideoTestingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-video-testing-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsVideoTestingAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'query') {
    state.list.currentPage = 1
    return true
  }
  if (action === 'reset') {
    state.list = { search: '', status: 'all', purpose: 'all', platform: 'all', accounting: 'all', quickFilter: 'all', currentPage: 1, pageSize: 8 }
    return true
  }
  if (action === 'set-quick-filter') {
    const value = (actionNode.dataset.value as QuickFilterKey) || 'all'
    state.list.quickFilter = state.list.quickFilter === value ? 'all' : value
    state.list.currentPage = 1
    return true
  }
  if (action === 'set-page') {
    const page = Number.parseInt(actionNode.dataset.page ?? '', 10)
    if (Number.isFinite(page) && page > 0) {
      state.list.currentPage = page
    }
    return true
  }
  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    return true
  }
  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    return true
  }
  if (action === 'toggle-create-purpose') {
    const value = actionNode.dataset.value as VideoPurpose | undefined
    if (!value) return true
    state.createDraft.purposes = state.createDraft.purposes.includes(value)
      ? state.createDraft.purposes.filter((item) => item !== value)
      : [...state.createDraft.purposes, value]
    return true
  }
  if (action === 'toggle-create-accounting') {
    state.createDraft.isTestAccountingEnabled = !state.createDraft.isTestAccountingEnabled
    return true
  }
  if (action === 'create-record-draft') {
    createRecord('DRAFT')
    return true
  }
  if (action === 'create-record-reconciling') {
    createRecord('RECONCILING')
    return true
  }
  if (action === 'open-close-dialog') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    state.closeDialog = { open: true, recordId, completionNote: '', unpublishedReason: '' }
    return true
  }
  if (action === 'confirm-close-record') {
    const recordId = state.closeDialog.recordId
    if (!recordId) return true
    updateRecord(recordId, (record) =>
      appendLog(
        {
          ...record,
          status: 'COMPLETED',
          completedBy: '当前用户',
          completedAt: nowText(),
          completionNote: state.closeDialog.completionNote.trim(),
        },
        {
          time: nowText(),
          action: '完成关账',
          user: '当前用户',
          detail: state.closeDialog.completionNote.trim() || '数据核对完成，已完成关账。',
        },
      ),
    )
    state.notice = '短视频记录已完成关账。'
    closeAllDialogs()
    return true
  }
  if (action === 'open-accounting-dialog') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    state.accountingDialog = { open: true, recordId, accountedNote: '', confirmed: false }
    return true
  }
  if (action === 'toggle-accounting-confirmed') {
    state.accountingDialog.confirmed = !state.accountingDialog.confirmed
    return true
  }
  if (action === 'confirm-accounting') {
    const recordId = state.accountingDialog.recordId
    if (!recordId) return true
    updateRecord(recordId, (record) =>
      appendLog(
        {
          ...record,
          testAccountingStatus: 'ACCOUNTED',
          accountedBy: '当前用户',
          accountedAt: nowText(),
          accountedNote: state.accountingDialog.accountedNote.trim() || 'TEST 条目已入账。',
        },
        {
          time: nowText(),
          action: '完成测款入账',
          user: '当前用户',
          detail: state.accountingDialog.accountedNote.trim() || 'TEST 条目已完成入账，生成决策实例。',
        },
      ),
    )
    state.notice = '短视频记录测款数据已入账。'
    closeAllDialogs()
    return true
  }
  if (action === 'open-edit-item') {
    const recordId = actionNode.dataset.recordId
    const itemId = actionNode.dataset.itemId
    const record = recordId ? getRecord(recordId) : null
    const item = record?.items.find((candidate) => candidate.id === itemId)
    if (!recordId || !itemId || !item) return true
    state.editDrawer = {
      open: true,
      recordId,
      itemId,
      draft: {
        evaluationIntent: item.evaluationIntent,
        projectRef: item.projectRef || '',
        productRef: item.productRef,
        exposureType: item.exposureType,
        views: String(item.views),
        likes: String(item.likes),
        comments: String(item.comments),
        shares: String(item.shares),
        clicks: String(item.clicks),
        orders: String(item.orders),
        pay: String(item.pay),
        gmv: String(item.gmv),
        recommendation: item.recommendation || '',
        recommendationReason: item.recommendationReason || '',
        noDataReason: '',
      },
    }
    return true
  }
  if (action === 'save-edit-item') {
    const { recordId, itemId, draft } = state.editDrawer
    if (!recordId || !itemId) return true
    const candidateMap = new Map(
      listVideoRecordProjectRelationCandidates(recordId).map((item) => [item.projectId, item]),
    )
    let notice = '短视频条目已保存。'
    updateRecord(recordId, (record) => {
      const items = record.items.map((item) => {
        const baseItem =
          item.id === itemId
            ? {
                ...item,
                evaluationIntent: draft.evaluationIntent,
                projectRef: draft.projectRef.trim() || null,
                exposureType: draft.exposureType.trim() || item.exposureType,
                productRef: draft.productRef.trim() || item.productRef,
                views: toNumber(draft.views, item.views),
                likes: toNumber(draft.likes, item.likes),
                comments: toNumber(draft.comments, item.comments),
                shares: toNumber(draft.shares, item.shares),
                clicks: toNumber(draft.clicks, item.clicks),
                orders: toNumber(draft.orders, item.orders),
                pay: toNumber(draft.pay, item.pay),
                gmv: toNumber(draft.gmv, item.gmv),
                recommendation: draft.recommendation.trim() || null,
                recommendationReason: draft.recommendationReason.trim() || null,
              }
            : item
        const resolvedProject = resolveProjectIdentity(baseItem.projectRef)
        const normalizedProjectRef = resolvedProject?.projectCode ?? baseItem.projectRef
        return {
          ...baseItem,
          projectRef: normalizedProjectRef,
          relatedProjectId: resolvedProject?.projectId ?? null,
          decisionRef: buildDecisionRef(normalizedProjectRef || null, record.testAccountingStatus === 'ACCOUNTED'),
        }
      })
      const blockedReasons: string[] = []
      const nextProjectIds = Array.from(
        new Set(
          items.flatMap((item) => {
            const resolvedProject = resolveProjectIdentity(item.projectRef)
            if (!item.projectRef || !resolvedProject) {
              if (item.projectRef) blockedReasons.push(`未找到项目 ${item.projectRef}`)
              return []
            }
            const candidate = candidateMap.get(resolvedProject.projectId)
            if (candidate && !candidate.eligible) {
              blockedReasons.push(candidate.disabledReason || `项目 ${resolvedProject.projectCode} 不满足短视频测款关联条件。`)
              return []
            }
            return [resolvedProject.projectId]
          }),
        ),
      )
      const relationResult = replaceVideoRecordProjectRelations(recordId, nextProjectIds, '当前用户')
      notice =
        nextProjectIds.length === 0 && blockedReasons.length === 0 && !items.some((item) => item.projectRef)
          ? '短视频条目已保存，并已同步清空短视频测款正式关联。'
          : blockedReasons.length > 0 || relationResult.errors.length > 0
            ? `短视频条目已保存；短视频测款正式关联未回写：${[...blockedReasons, ...relationResult.errors].join('；')}`
            : '短视频条目已保存，并已回写“关联短视频测款记录”。'
      return appendLog(
        {
          ...record,
          items,
        },
        {
          time: nowText(),
          action: '编辑条目',
          user: '当前用户',
          detail: `已更新条目 ${itemId} 的指标与建议字段。`,
        },
      )
    })
    state.notice = notice
    closeAllDialogs()
    return true
  }
  if (action === 'set-detail-tab') {
    state.detail.activeTab = normalizeDetailTab(actionNode.dataset.tab ?? null)
    return true
  }
  if (action === 'export-record') {
    const recordId = actionNode.dataset.recordId || state.detail.recordId
    state.notice = recordId ? `短视频记录 ${recordId} 的导出入口已准备，当前原型仅展示交互。` : '导出入口已触发。'
    return true
  }
  if (action === 'close-dialogs') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsVideoTestingDialogOpen(): boolean {
  return Boolean(
    state.createDrawerOpen ||
      state.closeDialog.open ||
      state.accountingDialog.open ||
      state.editDrawer.open,
  )
}
