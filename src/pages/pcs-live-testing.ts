import { appStore } from '../state/store.ts'
import {
  ACCOUNTING_STATUS_META,
  LIVE_PURPOSE_META,
  SESSION_STATUS_META,
  getLiveSessionById,
  getLiveSessionItems,
  getLiveSessionLogs,
  getLiveSessionSamples,
  type AccountingStatus,
  type LiveLog,
  type LiveSample,
  type LiveSessionItem,
  type LivePurpose,
  type SessionStatus,
} from '../data/pcs-testing.ts'
import {
  getLiveSessionRecordById,
  listLiveProductLinesBySession,
  listLiveSessionRecords,
} from '../data/pcs-live-testing-repository.ts'
import {
  findProjectChannelProductByLiveLine,
} from '../data/pcs-channel-product-project-repository.ts'
import {
  findProjectByCode,
  getProjectById,
  listProjects,
} from '../data/pcs-project-repository.ts'
import {
  getProjectRelationProjectLabel,
  listLiveProductLineProjectRelationCandidates,
  listProjectRelationsByLiveProductLine,
  replaceLiveProductLineProjectRelations,
} from '../data/pcs-project-relation-repository.ts'
import { ensurePcsProjectDemoDataReady } from './pcs-projects.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type QuickFilterKey = 'all' | 'reconciling' | 'readyToClose' | 'pendingAccounting' | 'accounted' | 'abnormal'
type DetailTabKey = 'overview' | 'items' | 'reconcile' | 'evidence' | 'accounting' | 'samples' | 'logs'
type ItemIntent = 'SELL' | 'TEST' | 'REVIEW'

interface SessionItemViewModel {
  id: string
  liveLineId: string | null
  liveLineCode: string | null
  intent: ItemIntent
  projectRef: string | null
  relatedProjectId: string | null
  productRef: string
  productName: string
  sku: string
  styleCode: string
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
  decisionLink: string | null
}

interface SessionViewModel {
  id: string
  title: string
  status: SessionStatus
  purposes: string[]
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
  completedBy: string | null
  completedAt: string | null
  accountedBy: string | null
  accountedAt: string | null
  items: SessionItemViewModel[]
  samples: LiveSample[]
  logs: LiveLog[]
}

interface CreateDraftState {
  title: string
  owner: string
  site: string
  liveAccount: string
  anchor: string
  startAt: string
  endAt: string
  operator: string
  recorder: string
  reviewer: string
  purposes: LivePurpose[]
  isTestAccountingEnabled: boolean
  note: string
}

interface CloseDialogState {
  open: boolean
  sessionId: string
  completionType: 'normal' | 'abnormal'
  note: string
}

interface AccountingDialogState {
  open: boolean
  sessionId: string
  note: string
}

interface EditDrawerState {
  open: boolean
  sessionId: string
  itemId: string
  draft: {
    intent: ItemIntent
    projectRef: string
    productRef: string
    segmentStart: string
    segmentEnd: string
    exposure: string
    click: string
    cart: string
    order: string
    pay: string
    gmv: string
    recommendation: string
    recommendationReason: string
  }
}

interface LiveTestingPageState {
  notice: string | null
  list: {
    search: string
    status: string
    purpose: string
    accounting: string
    quickFilter: QuickFilterKey
    currentPage: number
    pageSize: number
  }
  detail: {
    routeKey: string
    sessionId: string | null
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
  { key: 'items', label: '场次明细' },
  { key: 'reconcile', label: '数据核对' },
  { key: 'evidence', label: '证据素材' },
  { key: 'accounting', label: '测款入账' },
  { key: 'samples', label: '样衣关联' },
  { key: 'logs', label: '日志审计' },
]

const STATUS_OPTIONS = ['all', 'DRAFT', 'RECONCILING', 'COMPLETED', 'CANCELLED'] as const
const PURPOSE_OPTIONS = ['all', ...Object.values(LIVE_PURPOSE_META).map((item) => item.label)] as const
const ACCOUNTING_OPTIONS = ['all', 'NONE', 'PENDING', 'ACCOUNTED'] as const

const ITEM_INTENT_META: Record<ItemIntent, { label: string; className: string }> = {
  SELL: { label: '带货', className: 'bg-blue-100 text-blue-700' },
  TEST: { label: '测款', className: 'bg-violet-100 text-violet-700' },
  REVIEW: { label: '复测', className: 'bg-cyan-100 text-cyan-700' },
}

const initialCreateDraft: CreateDraftState = {
  title: '',
  owner: '',
  site: '',
  liveAccount: '',
  anchor: '',
  startAt: '',
  endAt: '',
  operator: '',
  recorder: '',
  reviewer: '',
  purposes: [],
  isTestAccountingEnabled: false,
  note: '',
}

const state: LiveTestingPageState = {
  notice: null,
  list: {
    search: '',
    status: 'all',
    purpose: 'all',
    accounting: 'all',
    quickFilter: 'all',
    currentPage: 1,
    pageSize: 8,
  },
  detail: {
    routeKey: '',
    sessionId: null,
    activeTab: 'overview',
  },
  createDrawerOpen: false,
  createDraft: { ...initialCreateDraft },
  closeDialog: {
    open: false,
    sessionId: '',
    completionType: 'normal',
    note: '',
  },
  accountingDialog: {
    open: false,
    sessionId: '',
    note: '',
  },
  editDrawer: {
    open: false,
    sessionId: '',
    itemId: '',
    draft: {
      intent: 'SELL',
      projectRef: '',
      productRef: '',
      segmentStart: '',
      segmentEnd: '',
      exposure: '',
      click: '',
      cart: '',
      order: '',
      pay: '',
      gmv: '',
      recommendation: '',
      recommendationReason: '',
    },
  },
}

const sessionStore = new Map<string, SessionViewModel>()

function getCurrentQueryParams(): URLSearchParams {
  const [, search = ''] = appStore.getState().pathname.split('?')
  return new URLSearchParams(search)
}

function normalizeDetailTab(value: string | null): DetailTabKey {
  return DETAIL_TAB_OPTIONS.find((item) => item.key === value)?.key ?? 'overview'
}

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

function toNumber(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
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
  const matched = Object.values(LIVE_PURPOSE_META).find((item) => item.label === label)
  return matched?.color ?? 'bg-slate-100 text-slate-600'
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN')
}

function formatInteger(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('zh-CN')
}

function buildSegmentTime(dateTime: string, offsetMinutes: number): string {
  const matched = dateTime.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/)
  if (!matched) return ''
  const date = new Date(`${matched[1]}T${matched[2]}:${matched[3]}:00`)
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function buildRecommendation(intent: ItemIntent, orderQty: number, clickQty: number, gmvAmount: number): {
  value: string | null
  reason: string | null
} {
  if (intent !== 'TEST') {
    return { value: null, reason: null }
  }
  const conversion = clickQty > 0 ? orderQty / clickQty : 0
  if (orderQty >= 25 || gmvAmount >= 5000 || conversion >= 0.05) {
    return { value: '继续', reason: '点击转化和成交表现稳定，可继续放量验证。' }
  }
  if (orderQty >= 10 || gmvAmount >= 2500) {
    return { value: '补测', reason: '已有基础反馈，建议继续补充样本后再定结论。' }
  }
  return { value: '改版', reason: '点击承接和订单表现偏弱，建议先做改版优化。' }
}

function buildDecisionLink(projectId: string | null): string | null {
  return projectId ? `/pcs/projects/${projectId}` : null
}

function resolveProjectIdentity(projectRef: string | null | undefined): { projectId: string; projectCode: string } | null {
  const normalized = projectRef?.trim() || ''
  if (!normalized) return null
  const project = getProjectById(normalized) ?? findProjectByCode(normalized)
  return project ? { projectId: project.projectId, projectCode: project.projectCode } : null
}

function inferTestingProjectIdentity(item: Pick<SessionItemViewModel, 'intent' | 'productRef' | 'productName' | 'projectRef'>): {
  projectId: string
  projectCode: string
} | null {
  if (item.intent !== 'TEST') return null
  const resolvedProject = resolveProjectIdentity(item.projectRef)
  if (resolvedProject) return resolvedProject
  ensurePcsProjectDemoDataReady()
  const searchText = `${item.productRef} ${item.productName}`
  const projectNamePart =
    searchText.includes('SPU-A001') || searchText.includes('印尼风格碎花连衣裙')
      ? '印尼风格碎花连衣裙测款项目'
      : searchText.includes('SPU-B002') || searchText.includes('CAND-20260108-001') || searchText.includes('波西米亚风')
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

function getLiveWorkItemSnapshot(session: SessionViewModel): {
  actionItem: SessionItemViewModel | null
  rows: Array<{ label: string; value: string }>
} {
  const actionItem = session.items.find((item) => item.intent === 'TEST') ?? session.items[0] ?? null
  const linkedChannelProduct =
    actionItem?.relatedProjectId && actionItem.liveLineId
      ? findProjectChannelProductByLiveLine(actionItem.relatedProjectId, actionItem.liveLineId)
      : null
  const gmvValue = actionItem?.gmv ?? session.gmvTotal ?? 0
  const orderValue = actionItem?.order ?? session.orderTotal ?? 0
  return {
    actionItem,
    rows: [
      { label: '工作项状态', value: getWorkItemStatusLabel(session.status) },
      { label: '正式操作', value: '关联直播测款记录' },
      { label: '渠道商品', value: linkedChannelProduct?.channelProductId || actionItem?.productRef || '-' },
      { label: '渠道商品编码', value: linkedChannelProduct?.channelProductCode || actionItem?.productRef || '-' },
      { label: '上游渠道商品编码', value: linkedChannelProduct?.upstreamChannelProductCode || '-' },
      { label: '直播场次', value: session.id },
      { label: '直播挂车明细', value: actionItem?.liveLineCode || actionItem?.liveLineId || '-' },
      { label: '曝光量', value: formatInteger(actionItem?.exposure ?? session.exposureTotal) },
      { label: '点击量', value: formatInteger(actionItem?.click ?? session.clickTotal) },
      { label: '下单量', value: formatInteger(orderValue) },
      { label: '销售额', value: `¥${formatCurrency(gmvValue)}` },
      {
        label: '结果说明',
        value: actionItem?.recommendationReason || actionItem?.recommendation || session.note || '-',
      },
    ],
  }
}

function buildDefaultSamples(session: {
  id: string
  site: string
  anchor: string
  items: SessionItemViewModel[]
}): LiveSample[] {
  return session.items.slice(0, Math.max(1, Math.min(4, session.items.length))).map((item, index) => ({
    id: `${session.id}-SAM-${String(index + 1).padStart(3, '0')}`,
    name: `${item.productName} / ${item.sku}`,
    site: session.site || '深圳',
    status: index === 0 ? '使用中' : '可用',
    location: index === 0 ? '直播间 A' : '样衣库 2F',
    holder: index === 0 ? session.anchor || '-' : '样衣管理员',
  }))
}

function buildDefaultLogs(session: {
  id: string
  title: string
  owner: string
  startAt: string
  endAt: string | null
  createdAt: string
  updatedAt: string
}): LiveLog[] {
  return [
    { time: session.updatedAt, action: '更新场次数据', user: session.owner || '系统演示', detail: `同步直播场次「${session.title}」的挂车和指标明细。` },
    {
      time: session.endAt || session.startAt,
      action: session.endAt ? '下播' : '直播进行中',
      user: '系统',
      detail: session.endAt ? '直播结束，等待核对或入账。' : '直播场次已进入执行中，请持续补录明细。',
    },
    { time: session.createdAt, action: '创建场次', user: session.owner || '系统演示', detail: `创建直播场次 ${session.id}。` },
  ]
}

function cloneItem(item: SessionItemViewModel): SessionItemViewModel {
  return {
    ...item,
    evidence: [...item.evidence],
  }
}

function cloneSession(session: SessionViewModel): SessionViewModel {
  return {
    ...session,
    purposes: [...session.purposes],
    items: session.items.map(cloneItem),
    samples: session.samples.map((sample) => ({ ...sample })),
    logs: session.logs.map((log) => ({ ...log })),
  }
}

function recalculateSession(session: SessionViewModel): SessionViewModel {
  const next = cloneSession(session)
  next.itemCount = next.items.length
  next.testItemCount = next.items.filter((item) => item.intent === 'TEST').length
  next.sampleCount = next.samples.length
  next.exposureTotal = sum(next.items.map((item) => item.exposure))
  next.clickTotal = sum(next.items.map((item) => item.click))
  next.cartTotal = sum(next.items.map((item) => item.cart))
  next.orderTotal = sum(next.items.map((item) => item.order))
  next.gmvTotal = sum(next.items.map((item) => item.gmv))
  if (!next.isTestAccountingEnabled || next.testItemCount === 0) {
    next.testAccountingStatus = 'NONE'
  } else if (next.accountedAt) {
    next.testAccountingStatus = 'ACCOUNTED'
  } else {
    next.testAccountingStatus = 'PENDING'
  }
  return next
}

function buildSessionItemsFromBase(
  sessionId: string,
  baseItems: LiveSessionItem[],
  startedAt: string,
): SessionItemViewModel[] {
  const lines = listLiveProductLinesBySession(sessionId)
  return baseItems.map((item, index) => {
    const line = lines[index] ?? null
    const relations = line ? listProjectRelationsByLiveProductLine(line.liveLineId) : []
    const primaryRelation = relations[0] ?? null
    const inferredProject = inferTestingProjectIdentity({
      intent: item.intent,
      productRef: item.productRef,
      productName: item.productName,
      projectRef: item.projectRef,
    })
    const relatedProjectId = primaryRelation?.projectId ?? inferredProject?.projectId ?? null
    return {
      id: item.id,
      liveLineId: line?.liveLineId ?? null,
      liveLineCode: line?.liveLineCode ?? null,
      intent: item.intent,
      projectRef: item.projectRef ?? primaryRelation?.projectCode ?? inferredProject?.projectCode ?? null,
      relatedProjectId,
      productRef: item.productRef || line?.spuCode || '',
      productName: item.productName,
      sku: item.sku,
      styleCode: line?.styleCode ?? '',
      segmentStart: item.segmentStart || buildSegmentTime(startedAt, index * 22),
      segmentEnd: item.segmentEnd || buildSegmentTime(startedAt, index * 22 + 18),
      exposure: item.exposure,
      click: item.click,
      cart: item.cart,
      order: item.order,
      pay: item.pay,
      gmv: item.gmv,
      listPrice: item.listPrice,
      payPrice: item.payPrice,
      recommendation: item.recommendation,
      recommendationReason: item.recommendationReason,
      evidence: [...item.evidence],
      decisionLink: buildDecisionLink(relatedProjectId),
    }
  })
}

function buildSessionItemsFromLines(sessionId: string, startedAt: string, testItemCount: number): SessionItemViewModel[] {
  return listLiveProductLinesBySession(sessionId).map((line, index) => {
    const relations = listProjectRelationsByLiveProductLine(line.liveLineId)
    const primaryRelation = relations[0] ?? null
    const intent: ItemIntent = index < testItemCount ? 'TEST' : 'SELL'
    const inferredProject = inferTestingProjectIdentity({
      intent,
      productRef: line.spuCode || line.styleCode,
      productName: line.productTitle,
      projectRef: primaryRelation?.projectCode ?? null,
    })
    const pricingBase = line.orderQty > 0 ? Math.round(line.gmvAmount / line.orderQty) : 0
    const recommendation = buildRecommendation(intent, line.orderQty, line.clickQty, line.gmvAmount)
    return {
      id: line.liveLineId,
      liveLineId: line.liveLineId,
      liveLineCode: line.liveLineCode,
      intent,
      projectRef: primaryRelation?.projectCode ?? inferredProject?.projectCode ?? null,
      relatedProjectId: primaryRelation?.projectId ?? inferredProject?.projectId ?? null,
      productRef: line.spuCode || line.styleCode,
      productName: line.productTitle,
      sku: line.skuCode,
      styleCode: line.styleCode,
      segmentStart: buildSegmentTime(startedAt, index * 22),
      segmentEnd: buildSegmentTime(startedAt, index * 22 + 18),
      exposure: line.exposureQty,
      click: line.clickQty,
      cart: Math.max(line.orderQty, Math.round(line.clickQty * 0.18)),
      order: line.orderQty,
      pay: Math.max(line.orderQty - 1, 0),
      gmv: line.gmvAmount,
      listPrice: pricingBase > 0 ? Math.round(pricingBase * 1.18) : 0,
      payPrice: pricingBase,
      recommendation: recommendation.value,
      recommendationReason: recommendation.reason,
      evidence: intent === 'TEST' ? [`${line.liveLineCode}-截图.png`] : [],
      decisionLink: buildDecisionLink(primaryRelation?.projectId ?? inferredProject?.projectId ?? null),
    }
  })
}

function buildSessionFromRepository(sessionId: string): SessionViewModel | null {
  const record = getLiveSessionRecordById(sessionId)
  if (!record) return null

  const base = getLiveSessionById(sessionId)
  const items = base
    ? buildSessionItemsFromBase(sessionId, getLiveSessionItems(sessionId), base.startAt)
    : buildSessionItemsFromLines(sessionId, record.startedAt, record.testItemCount)

  const samples = base ? getLiveSessionSamples(sessionId) : buildDefaultSamples({
    id: sessionId,
    site: inferSite(record.channelName),
    anchor: record.hostName,
    items,
  })
  const logs = base
    ? getLiveSessionLogs(sessionId)
    : buildDefaultLogs({
      id: sessionId,
      title: record.sessionTitle,
      owner: record.ownerName,
      startAt: record.startedAt,
      endAt: record.endedAt || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })

  const session: SessionViewModel = {
    id: record.liveSessionId,
    title: record.sessionTitle,
    status: base?.status ?? getStatusCodeByLabel(record.sessionStatus),
    purposes: base ? base.purposes.map((item) => LIVE_PURPOSE_META[item].label) : [...record.purposes],
    liveAccount: base?.liveAccount ?? record.channelName,
    anchor: base?.anchor ?? record.hostName,
    startAt: base?.startAt ?? record.startedAt,
    endAt: base?.endAt ?? (record.endedAt || null),
    owner: base?.owner ?? record.ownerName,
    operator: base?.operator ?? '直播运营',
    recorder: base?.recorder ?? '数据助理',
    reviewer: base?.reviewer ?? '商品负责人',
    site: base?.site ?? inferSite(record.channelName),
    itemCount: record.itemCount,
    testItemCount: record.testItemCount,
    testAccountingStatus: base?.testAccountingStatus ?? getAccountingCodeByValue(record.testAccountingStatus),
    sampleCount: base?.sampleCount ?? samples.length,
    gmvTotal: base?.gmvTotal ?? record.gmvAmount ?? sum(items.map((item) => item.gmv)),
    orderTotal: base?.orderTotal ?? sum(items.map((item) => item.order)),
    exposureTotal: base?.exposureTotal ?? sum(items.map((item) => item.exposure)),
    clickTotal: base?.clickTotal ?? sum(items.map((item) => item.click)),
    cartTotal: base?.cartTotal ?? sum(items.map((item) => item.cart)),
    isTestAccountingEnabled: base?.isTestAccountingEnabled ?? getAccountingCodeByValue(record.testAccountingStatus) !== 'NONE',
    note: base?.note ?? '',
    createdAt: base?.createdAt ?? record.createdAt,
    updatedAt: base?.updatedAt ?? record.updatedAt,
    completedBy: base?.status === 'COMPLETED' ? '系统演示' : null,
    completedAt: base?.status === 'COMPLETED' ? base.updatedAt : null,
    accountedBy: base?.testAccountingStatus === 'ACCOUNTED' ? '系统演示' : null,
    accountedAt: base?.testAccountingStatus === 'ACCOUNTED' ? base.updatedAt : null,
    items,
    samples,
    logs,
  }

  return recalculateSession(session)
}

function inferSite(channelName: string): string {
  if (channelName.includes('雅加达') || channelName.includes('ID') || channelName.includes('TikTok / 商品中心直播间')) return '雅加达'
  if (channelName.includes('MY')) return '吉隆坡'
  if (channelName.includes('VN')) return '胡志明'
  return '深圳'
}

function ensureSessionStore(): void {
  if (sessionStore.size > 0) return
  listLiveSessionRecords().forEach((record) => {
    const session = buildSessionFromRepository(record.liveSessionId)
    if (session) {
      sessionStore.set(session.id, session)
    }
  })
}

function getSessions(): SessionViewModel[] {
  ensureSessionStore()
  return Array.from(sessionStore.values())
    .map(cloneSession)
    .sort((a, b) => (b.startAt || b.createdAt).localeCompare(a.startAt || a.createdAt))
}

function getSession(sessionId: string): SessionViewModel | null {
  ensureSessionStore()
  const session = sessionStore.get(sessionId)
  return session ? cloneSession(session) : null
}

function updateSession(sessionId: string, updater: (session: SessionViewModel) => SessionViewModel): void {
  ensureSessionStore()
  const current = sessionStore.get(sessionId)
  if (!current) return
  sessionStore.set(sessionId, recalculateSession(updater(cloneSession(current))))
}

function appendSessionLog(session: SessionViewModel, log: LiveLog): SessionViewModel {
  return {
    ...session,
    updatedAt: log.time,
    logs: [log, ...session.logs],
  }
}

function resetCreateDraft(): void {
  state.createDraft = { ...initialCreateDraft }
}

function closeAllDialogs(): void {
  state.createDrawerOpen = false
  state.closeDialog = { open: false, sessionId: '', completionType: 'normal', note: '' }
  state.accountingDialog = { open: false, sessionId: '', note: '' }
  state.editDrawer = {
    open: false,
    sessionId: '',
    itemId: '',
    draft: {
      intent: 'SELL',
      projectRef: '',
      productRef: '',
      segmentStart: '',
      segmentEnd: '',
      exposure: '',
      click: '',
      cart: '',
      order: '',
      pay: '',
      gmv: '',
      recommendation: '',
      recommendationReason: '',
    },
  }
}

function syncDetailState(sessionId: string): void {
  const routeKey = appStore.getState().pathname
  if (state.detail.routeKey === routeKey && state.detail.sessionId === sessionId) return
  state.detail.routeKey = routeKey
  state.detail.sessionId = sessionId
  state.detail.activeTab = normalizeDetailTab(getCurrentQueryParams().get('tab'))
}

function getFilteredSessions(): SessionViewModel[] {
  const keyword = state.list.search.trim().toLowerCase()
  return getSessions().filter((session) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        session.id,
        session.title,
        session.liveAccount,
        session.anchor,
        session.owner,
        session.purposes.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    if (!matchesKeyword) return false
    if (state.list.status !== 'all' && session.status !== state.list.status) return false
    if (state.list.purpose !== 'all' && !session.purposes.includes(state.list.purpose)) return false
    if (state.list.accounting !== 'all' && session.testAccountingStatus !== state.list.accounting) return false
    if (state.list.quickFilter === 'reconciling' && session.status !== 'RECONCILING') return false
    if (state.list.quickFilter === 'readyToClose' && !(session.status === 'RECONCILING' && session.endAt)) return false
    if (state.list.quickFilter === 'pendingAccounting' && session.testAccountingStatus !== 'PENDING') return false
    if (state.list.quickFilter === 'accounted' && session.testAccountingStatus !== 'ACCOUNTED') return false
    if (state.list.quickFilter === 'abnormal' && !(!session.endAt && session.status !== 'DRAFT' && session.status !== 'CANCELLED')) return false
    return true
  })
}

function getPagedSessions(): {
  items: SessionViewModel[]
  total: number
  totalPages: number
} {
  const filtered = getFilteredSessions()
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
  const sessions = getSessions()
  return {
    reconciling: sessions.filter((item) => item.status === 'RECONCILING').length,
    readyToClose: sessions.filter((item) => item.status === 'RECONCILING' && item.endAt).length,
    pendingAccounting: sessions.filter((item) => item.testAccountingStatus === 'PENDING').length,
    accounted: sessions.filter((item) => item.testAccountingStatus === 'ACCOUNTED').length,
    abnormal: sessions.filter((item) => !item.endAt && item.status !== 'DRAFT' && item.status !== 'CANCELLED').length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-live-testing-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderModalShell(title: string, description: string, body: string, footer: string, sizeClass = 'max-w-lg'): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/45" data-pcs-live-testing-action="close-dialogs" aria-label="关闭侧栏"></button>
      <aside class="absolute inset-y-0 right-0 flex h-full w-full ${escapeHtml(sizeClass)} flex-col border-l bg-white shadow-2xl">
        <div class="border-b px-6 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="close-dialogs">关闭</button>
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
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-live-testing-action="${escapeHtml(closeAction)}"></button>
      <aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h3>
            <p class="mt-1 text-sm text-slate-500">演示数据仅用于页面表达，不涉及真实后端入库。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="${escapeHtml(closeAction)}">关闭</button>
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

function renderPager(totalPages: number): string {
  const pages = new Set<number>([1, totalPages, state.list.currentPage, state.list.currentPage - 1, state.list.currentPage + 1])
  const visiblePages = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <p>第 ${state.list.currentPage} / ${totalPages} 页</p>
      <div class="flex items-center gap-1">
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === 1 ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-live-testing-action="set-page" data-page="${state.list.currentPage - 1}" ${state.list.currentPage === 1 ? 'disabled' : ''}>上一页</button>
        ${visiblePages
          .map(
            (page) => `<button type="button" class="${toClassName(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs',
              page === state.list.currentPage ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}" data-pcs-live-testing-action="set-page" data-page="${page}">${page}</button>`,
          )
          .join('')}
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 ${state.list.currentPage === totalPages ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-live-testing-action="set-page" data-page="${state.list.currentPage + 1}" ${state.list.currentPage === totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `
}

function renderListHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 测款与渠道管理</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">直播场次</h1>
        <p class="mt-1 text-sm text-slate-500">统一管理直播场次、挂车明细、测款入账和样衣关联，关账与测款入账分离。</p>
      </div>
      <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="open-create-drawer">
        <i data-lucide="plus" class="h-4 w-4"></i>新建场次
      </button>
    </section>
  `
}

function renderListFilters(): string {
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label class="space-y-1">
          <span class="text-xs text-slate-500">搜索场次</span>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
            <input class="h-10 w-full rounded-md border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="搜索场次编号 / 标题 / 账号 / 主播" value="${escapeHtml(state.list.search)}" data-pcs-live-testing-field="list-search" />
          </div>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">场次状态</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-live-testing-field="list-status">
            ${STATUS_OPTIONS.map((status) => {
              const label = status === 'all' ? '全部状态' : SESSION_STATUS_META[status].label
              return `<option value="${status}" ${state.list.status === status ? 'selected' : ''}>${escapeHtml(label)}</option>`
            }).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">场次用途</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-live-testing-field="list-purpose">
            ${PURPOSE_OPTIONS.map((purpose) => `<option value="${purpose}" ${state.list.purpose === purpose ? 'selected' : ''}>${escapeHtml(purpose === 'all' ? '全部用途' : purpose)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-slate-500">测款入账</span>
          <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-live-testing-field="list-accounting">
            ${ACCOUNTING_OPTIONS.map((status) => {
              const label = status === 'all' ? '全部入账状态' : ACCOUNTING_STATUS_META[status].label
              return `<option value="${status}" ${state.list.accounting === status ? 'selected' : ''}>${escapeHtml(label)}</option>`
            }).join('')}
          </select>
        </label>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="query">查询</button>
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="reset">重置</button>
      </div>
    </section>
  `
}

function renderKpis(): string {
  const kpis = getKpis()
  const cards: Array<{ key: QuickFilterKey; label: string; value: number; helper: string; tone: string }> = [
    { key: 'reconciling', label: '核对中', value: kpis.reconciling, helper: '待补录或复核的场次', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { key: 'readyToClose', label: '待关账', value: kpis.readyToClose, helper: '已下播可直接关账', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { key: 'pendingAccounting', label: '待入账', value: kpis.pendingAccounting, helper: 'TEST 行尚未完成入账', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { key: 'accounted', label: '已入账', value: kpis.accounted, helper: '测款结论已回写', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { key: 'abnormal', label: '异常场次', value: kpis.abnormal, helper: '未填写下播时间或状态异常', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  ]
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${cards
        .map(
          (card) => `
            <button type="button" class="${toClassName(
              'rounded-lg border p-4 text-left transition hover:shadow-sm',
              card.tone,
              state.list.quickFilter === card.key ? 'ring-2 ring-blue-500' : '',
            )}" data-pcs-live-testing-action="set-quick-filter" data-value="${card.key}">
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

function renderSessionActions(session: SessionViewModel): string {
  const actions: string[] = [
    `<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/live/${escapeHtml(session.id)}">查看</button>`,
  ]
  if (session.status === 'RECONCILING') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="open-close-dialog" data-session-id="${escapeHtml(session.id)}">完成关账</button>`)
  }
  if ((session.status === 'RECONCILING' || session.status === 'COMPLETED') && session.testAccountingStatus === 'PENDING') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md bg-blue-600 px-2.5 text-xs text-white hover:bg-blue-700" data-pcs-live-testing-action="open-accounting-dialog" data-session-id="${escapeHtml(session.id)}">完成入账</button>`)
  }
  if (session.status === 'COMPLETED') {
    actions.push(`<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="export-session" data-session-id="${escapeHtml(session.id)}">导出</button>`)
  }
  return actions.join('')
}

function renderListTable(): string {
  const { items, total, totalPages } = getPagedSessions()
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p class="text-sm font-medium text-slate-900">场次列表</p>
          <p class="mt-1 text-xs text-slate-500">当前共筛选出 ${total} 个场次，支持挂车明细、样衣和测款入账联查。</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">场次</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">用途</th>
              <th class="px-4 py-3">账号 / 主播</th>
              <th class="px-4 py-3">开播 - 下播</th>
              <th class="px-4 py-3">负责人</th>
              <th class="px-4 py-3 text-center">明细</th>
              <th class="px-4 py-3 text-center">TEST 行</th>
              <th class="px-4 py-3">测款入账</th>
              <th class="px-4 py-3 text-center">样衣</th>
              <th class="px-4 py-3 text-right">GMV</th>
              <th class="px-4 py-3 text-right">订单</th>
              <th class="px-4 py-3">最近更新</th>
              <th class="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              items.length === 0
                ? `
                  <tr>
                    <td colspan="14" class="px-4 py-10 text-center text-sm text-slate-500">暂无匹配的直播场次，请调整筛选条件后重试。</td>
                  </tr>
                `
                : items
                    .map(
                      (session) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top">
                            <div class="space-y-1">
                              <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/testing/live/${escapeHtml(session.id)}">${escapeHtml(session.title)}</button>
                              <p class="text-xs text-slate-500">${escapeHtml(session.id)}</p>
                            </div>
                          </td>
                          <td class="px-4 py-3 align-top">${renderStatusBadge(session.status)}</td>
                          <td class="px-4 py-3 align-top"><div class="flex flex-wrap gap-1">${renderPurposeBadges(session.purposes)}</div></td>
                          <td class="px-4 py-3 align-top">
                            <p class="font-medium text-slate-900">${escapeHtml(session.liveAccount)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(session.anchor)}</p>
                          </td>
                          <td class="px-4 py-3 align-top text-xs text-slate-600">
                            <p>${escapeHtml(formatDateTime(session.startAt))}</p>
                            <p class="mt-1">${escapeHtml(session.endAt ? formatDateTime(session.endAt) : '进行中')}</p>
                          </td>
                          <td class="px-4 py-3 align-top text-slate-700">${escapeHtml(session.owner)}</td>
                          <td class="px-4 py-3 align-top text-center text-slate-700">${session.itemCount}</td>
                          <td class="px-4 py-3 align-top text-center text-slate-700">${session.testItemCount}</td>
                          <td class="px-4 py-3 align-top">${renderAccountingBadge(session.testAccountingStatus)}</td>
                          <td class="px-4 py-3 align-top text-center text-slate-700">${session.sampleCount}</td>
                          <td class="px-4 py-3 align-top text-right font-medium text-slate-900">${session.gmvTotal == null ? '-' : `¥${formatCurrency(session.gmvTotal)}`}</td>
                          <td class="px-4 py-3 align-top text-right text-slate-700">${session.orderTotal == null ? '-' : formatInteger(session.orderTotal)}</td>
                          <td class="px-4 py-3 align-top text-xs text-slate-500">${escapeHtml(formatDateTime(session.updatedAt))}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap justify-center gap-1">${renderSessionActions(session)}</div>
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
    '新建场次',
    `
      <div class="space-y-6">
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">A. 基础信息</h4>
            <p class="mt-1 text-xs text-slate-500">先补齐场次标题、负责人和站点，保证后续明细和样衣能挂靠。</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs text-slate-500">场次标题</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.title)}" placeholder="直播-2026-04-13-TikTok 新款测试专场" data-pcs-live-testing-field="create-title" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">负责人</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.owner)}" placeholder="商品运营" data-pcs-live-testing-field="create-owner" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">站点</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.site)}" placeholder="雅加达 / 深圳" data-pcs-live-testing-field="create-site" />
            </label>
          </div>
        </section>
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">B. 直播信息</h4>
            <p class="mt-1 text-xs text-slate-500">账号、主播和时间决定场次主记录，也会回写到后续测款执行节点。</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">直播账号</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.liveAccount)}" placeholder="TikTok / 商品中心直播间" data-pcs-live-testing-field="create-live-account" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">主播</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.anchor)}" placeholder="家播-小N" data-pcs-live-testing-field="create-anchor" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">开播时间</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.startAt)}" placeholder="2026-04-13 19:00" data-pcs-live-testing-field="create-start-at" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">下播时间</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.endAt)}" placeholder="2026-04-13 22:00" data-pcs-live-testing-field="create-end-at" />
            </label>
          </div>
        </section>
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">C. 团队分工</h4>
            <p class="mt-1 text-xs text-slate-500">用于详情右侧关键人卡片和日志追溯。</p>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">场控 / 运营</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.operator)}" placeholder="直播运营" data-pcs-live-testing-field="create-operator" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">录入人</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.recorder)}" placeholder="数据助理" data-pcs-live-testing-field="create-recorder" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">审核人</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.reviewer)}" placeholder="商品负责人" data-pcs-live-testing-field="create-reviewer" />
            </label>
          </div>
        </section>
        <section class="space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">D. 用途与测款开关</h4>
            <p class="mt-1 text-xs text-slate-500">场次用途支持多选；勾选测款入账后，TEST 行会进入待入账清单。</p>
          </div>
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              ${Object.entries(LIVE_PURPOSE_META)
                .map(
                  ([key, meta]) => `
                    <button type="button" class="${toClassName(
                      'inline-flex rounded-full border px-3 py-1 text-xs transition',
                      draft.purposes.includes(key as LivePurpose) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}" data-pcs-live-testing-action="toggle-create-purpose" data-value="${escapeHtml(key)}">${escapeHtml(meta.label)}</button>
                  `,
                )
                .join('')}
            </div>
            <button type="button" class="${toClassName(
              'inline-flex h-9 items-center rounded-md border px-3 text-sm',
              draft.isTestAccountingEnabled ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}" data-pcs-live-testing-action="toggle-create-accounting">
              <i data-lucide="${draft.isTestAccountingEnabled ? 'check-circle-2' : 'circle'}" class="mr-2 h-4 w-4"></i>
              启用测款入账
            </button>
          </div>
        </section>
        <section class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-900">E. 备注</h4>
          <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="补充直播目标、货盘说明或风险提示" data-pcs-live-testing-field="create-note">${escapeHtml(draft.note)}</textarea>
        </section>
        <div class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="close-create-drawer">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="create-session-draft">保存草稿</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="create-session-reconciling">保存并进入核对</button>
        </div>
      </div>
    `,
    'close-create-drawer',
  )
}

function renderListPageDialogs(): string {
  return [renderCreateDrawer(), renderCloseDialog(), renderAccountingDialog(), renderEditDrawer()].join('')
}

function renderSessionDetailHeader(session: SessionViewModel, relatedProjects: Array<{ projectId: string; label: string }>): string {
  const showClose = session.status === 'RECONCILING'
  const showAccounting = (session.status === 'RECONCILING' || session.status === 'COMPLETED') && session.testAccountingStatus === 'PENDING'
  return `
    <section class="rounded-lg border bg-white">
      <div class="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/live">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
            </button>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(session.title)}</h1>
              ${renderStatusBadge(session.status)}
              ${renderAccountingBadge(session.testAccountingStatus)}
            </div>
            <p class="mt-2 text-sm text-slate-500">${escapeHtml(session.liveAccount)} · ${escapeHtml(session.anchor)} · ${escapeHtml(formatDateTime(session.startAt))} - ${escapeHtml(session.endAt ? formatDateTime(session.endAt) : '进行中')}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${showClose ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="open-close-dialog" data-session-id="${escapeHtml(session.id)}"><i data-lucide="check-circle-2" class="h-4 w-4"></i>完成关账</button>` : ''}
          ${showAccounting ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="open-accounting-dialog" data-session-id="${escapeHtml(session.id)}"><i data-lucide="calculator" class="h-4 w-4"></i>完成测款入账</button>` : ''}
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="export-session" data-session-id="${escapeHtml(session.id)}">
            <i data-lucide="download" class="h-4 w-4"></i>导出报告
          </button>
        </div>
      </div>
      ${
        session.testAccountingStatus === 'PENDING' && session.status === 'COMPLETED'
          ? `
            <div class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
              <i data-lucide="alert-triangle" class="h-4 w-4"></i>
              <span>存在 TEST 行待入账，请尽快完成测款核对并回写项目执行流转。</span>
            </div>
          `
          : ''
      }
      ${
        relatedProjects.length > 0
          ? `
            <div class="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
              关联项目：${relatedProjects
                .map(
                  (project) =>
                    `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(project.projectId)}">${escapeHtml(project.label)}</button>`,
                )
                .join('、')}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderOverviewTab(session: SessionViewModel, testItems: SessionItemViewModel[]): string {
  const checks = [
    { ok: Boolean(session.endAt), label: '下播时间已填写' },
    { ok: session.items.length > 0, label: `明细行数 >= 1（当前 ${session.items.length}）` },
    { ok: testItems.every((item) => Boolean(item.projectRef || item.productRef)), label: '所有 TEST 行已绑定项目或商品' },
  ]
  const cards = [
    { label: 'GMV', value: session.gmvTotal == null ? '-' : `¥${formatCurrency(session.gmvTotal)}` },
    { label: '订单数', value: session.orderTotal == null ? '-' : formatInteger(session.orderTotal) },
    { label: '曝光', value: formatInteger(session.exposureTotal) },
    { label: '点击', value: formatInteger(session.clickTotal) },
    { label: '加购', value: formatInteger(session.cartTotal) },
    { label: '点击率', value: session.exposureTotal > 0 ? `${((session.clickTotal / session.exposureTotal) * 100).toFixed(2)}%` : '-' },
  ]
  return `
    <div class="space-y-6">
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        ${cards
          .map(
            (card) => `
              <article class="rounded-lg border bg-white p-4 text-center">
                <p class="text-2xl font-semibold text-slate-900">${escapeHtml(card.value)}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(card.label)}</p>
              </article>
            `,
          )
          .join('')}
      </section>
      <section class="rounded-lg border bg-white p-4">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-slate-900">健康检查</h2>
          <p class="mt-1 text-sm text-slate-500">对照参照系统的关账前检查口径，快速确认当前场次是否满足流转条件。</p>
        </div>
        <div class="space-y-3">
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

function renderItemsTab(session: SessionViewModel): string {
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-500">共 ${session.items.length} 条明细，其中 TEST 行 ${session.items.filter((item) => item.intent === 'TEST').length} 条。</p>
        <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="open-edit-item" data-session-id="${escapeHtml(session.id)}" data-item-id="${escapeHtml(session.items[0]?.id || '')}" ${session.items[0] ? '' : 'disabled'}>
          <i data-lucide="plus" class="h-4 w-4"></i>补录首条明细
        </button>
      </div>
      <section class="rounded-lg border bg-white">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">意图</th>
                <th class="px-4 py-3">绑定对象</th>
                <th class="px-4 py-3">款信息</th>
                <th class="px-4 py-3">讲解时段</th>
                <th class="px-4 py-3 text-right">曝光</th>
                <th class="px-4 py-3 text-right">点击</th>
                <th class="px-4 py-3 text-right">加购</th>
                <th class="px-4 py-3 text-right">订单</th>
                <th class="px-4 py-3 text-right">GMV</th>
                <th class="px-4 py-3">建议</th>
                <th class="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${session.items
                .map(
                  (item) => `
                    <tr class="${item.intent === 'TEST' ? 'bg-violet-50/30' : ''}">
                      <td class="px-4 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${ITEM_INTENT_META[item.intent].className}">${ITEM_INTENT_META[item.intent].label}</span></td>
                      <td class="px-4 py-3">
                        ${
                          item.intent === 'TEST'
                            ? item.projectRef && item.relatedProjectId
                              ? `<button type="button" class="text-left text-xs font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.relatedProjectId)}">${escapeHtml(item.projectRef)}</button>`
                              : '<span class="text-xs text-rose-600">待绑定商品项目</span>'
                            : item.productRef
                              ? `<span class="text-xs text-slate-500">${escapeHtml(item.productRef)}</span>`
                              : '<span class="text-xs text-rose-600">未绑定</span>'
                        }
                      </td>
                      <td class="px-4 py-3">
                        <p class="font-medium text-slate-900">${escapeHtml(item.productName)}</p>
                        <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.sku)}</p>
                      </td>
                      <td class="px-4 py-3 text-xs text-slate-600">${escapeHtml(item.segmentStart)} - ${escapeHtml(item.segmentEnd)}</td>
                      <td class="px-4 py-3 text-right">${formatInteger(item.exposure)}</td>
                      <td class="px-4 py-3 text-right">${formatInteger(item.click)}</td>
                      <td class="px-4 py-3 text-right">${formatInteger(item.cart)}</td>
                      <td class="px-4 py-3 text-right">${formatInteger(item.order)}</td>
                      <td class="px-4 py-3 text-right font-medium">${item.gmv ? `¥${formatCurrency(item.gmv)}` : '-'}</td>
                      <td class="px-4 py-3">${item.recommendation ? `<span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">${escapeHtml(item.recommendation)}</span>` : '-'}</td>
                      <td class="px-4 py-3 text-center">
                        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="open-edit-item" data-session-id="${escapeHtml(session.id)}" data-item-id="${escapeHtml(item.id)}">编辑</button>
                      </td>
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

function renderReconcileTab(): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-slate-900">数据导入</h2>
          <p class="mt-1 text-sm text-slate-500">支持从 TikTok / Shopee 后台导出的文件补录曝光、点击、下单和支付表现。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <i data-lucide="download" class="h-4 w-4"></i>下载模板
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
            <i data-lucide="upload" class="h-4 w-4"></i>上传 CSV 文件
          </button>
        </div>
        <div class="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">当前原型仅演示核对入口和字段承载，不接真实上传服务。</div>
      </section>
    </div>
  `
}

function renderEvidenceTab(session: SessionViewModel): string {
  const evidenceItems = session.items.filter((item) => item.evidence.length > 0)
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">场次级证据</h2>
            <p class="mt-1 text-sm text-slate-500">沉淀直播录屏、截图、讲解节点和后续测款入账依据。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <i data-lucide="plus" class="h-4 w-4"></i>上传素材
          </button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${
            evidenceItems.length === 0
              ? '<div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">当前暂无证据素材，可从下播录屏或截图补录。</div>'
              : evidenceItems
                  .flatMap((item) =>
                    item.evidence.map(
                      (evidence) => `
                        <article class="rounded-lg border bg-slate-50 p-4">
                          <div class="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white">
                            <i data-lucide="image" class="h-8 w-8 text-slate-400"></i>
                          </div>
                          <p class="mt-3 text-sm font-medium text-slate-900">${escapeHtml(evidence)}</p>
                          <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.productName)}</p>
                        </article>
                      `,
                    ),
                  )
                  .join('')
          }
        </div>
      </section>
    </div>
  `
}

function renderAccountingTab(session: SessionViewModel, testItems: SessionItemViewModel[]): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">TEST 行清单</h2>
            <p class="mt-1 text-sm text-slate-500">对需要入账的 TEST 行统一核查项目绑定、商品引用和结果建议。</p>
          </div>
          ${
            session.testAccountingStatus === 'PENDING'
              ? `<button type="button" class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="open-accounting-dialog" data-session-id="${escapeHtml(session.id)}"><i data-lucide="calculator" class="h-4 w-4"></i>完成测款入账</button>`
              : ''
          }
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">款信息</th>
                <th class="px-4 py-3">绑定项目</th>
                <th class="px-4 py-3">绑定商品</th>
                <th class="px-4 py-3">GMV</th>
                <th class="px-4 py-3">建议</th>
                <th class="px-4 py-3">决策实例</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${
                testItems.length === 0
                  ? '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">当前场次没有 TEST 行，无需入账。</td></tr>'
                  : testItems
                      .map(
                        (item) => `
                          <tr>
                            <td class="px-4 py-3">
                              <p class="font-medium text-slate-900">${escapeHtml(item.productName)}</p>
                              <p class="mt-1 text-xs text-slate-500">${escapeHtml(item.sku)}</p>
                            </td>
                            <td class="px-4 py-3">${item.projectRef ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(item.relatedProjectId || '')}">${escapeHtml(item.projectRef)}</button>` : '<span class="text-rose-600">未绑定</span>'}</td>
                            <td class="px-4 py-3">${escapeHtml(item.productRef || '-')}</td>
                            <td class="px-4 py-3">${item.gmv ? `¥${formatCurrency(item.gmv)}` : '-'}</td>
                            <td class="px-4 py-3">${escapeHtml(item.recommendation || '-')}</td>
                            <td class="px-4 py-3">${item.decisionLink ? `<button type="button" class="text-blue-700 hover:underline" data-nav="${escapeHtml(item.decisionLink)}">查看</button>` : '<span class="text-slate-400">待入账</span>'}</td>
                          </tr>
                        `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderSamplesTab(session: SessionViewModel): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">本场关联样衣</h2>
            <p class="mt-1 text-sm text-slate-500">展示直播间使用样衣、库存位置和保管人，承接样衣台账链路。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
            <i data-lucide="plus" class="h-4 w-4"></i>发起样衣使用申请
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">样衣编号</th>
                <th class="px-4 py-3">名称</th>
                <th class="px-4 py-3">站点</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3">位置</th>
                <th class="px-4 py-3">保管人</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${session.samples
                .map(
                  (sample) => `
                    <tr>
                      <td class="px-4 py-3 text-blue-700">${escapeHtml(sample.id)}</td>
                      <td class="px-4 py-3">${escapeHtml(sample.name)}</td>
                      <td class="px-4 py-3">${escapeHtml(sample.site)}</td>
                      <td class="px-4 py-3"><span class="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">${escapeHtml(sample.status)}</span></td>
                      <td class="px-4 py-3">${escapeHtml(sample.location)}</td>
                      <td class="px-4 py-3">${escapeHtml(sample.holder)}</td>
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

function renderLogsTab(session: SessionViewModel): string {
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-slate-900">操作日志</h2>
          <p class="mt-1 text-sm text-slate-500">保留创建、下播、关账、入账和明细编辑记录，用于原型演示。</p>
        </div>
        <div class="space-y-4">
          ${session.logs
            .map(
              (log) => `
                <article class="flex gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                  <div class="mt-2 h-2 w-2 rounded-full bg-blue-600"></div>
                  <div class="flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(log.action)}</p>
                      <span class="text-xs text-slate-500">by ${escapeHtml(log.user)}</span>
                    </div>
                    <p class="mt-1 text-sm text-slate-600">${escapeHtml(log.detail)}</p>
                    <p class="mt-1 text-xs text-slate-400">${escapeHtml(log.time)}</p>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `
}

function renderDetailSidebar(session: SessionViewModel, relatedProjects: Array<{ projectId: string; label: string }>): string {
  const workItemSnapshot = getLiveWorkItemSnapshot(session)
  return `
    <div class="space-y-4">
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">关键人</h3>
        <div class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between gap-3"><span class="text-slate-500">负责人</span><span>${escapeHtml(session.owner || '-')}</span></div>
          <div class="flex justify-between gap-3"><span class="text-slate-500">场控</span><span>${escapeHtml(session.operator || '-')}</span></div>
          <div class="flex justify-between gap-3"><span class="text-slate-500">录入人</span><span>${escapeHtml(session.recorder || '-')}</span></div>
          <div class="flex justify-between gap-3"><span class="text-slate-500">审核人</span><span>${escapeHtml(session.reviewer || '-')}</span></div>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">关账信息</h3>
        <div class="mt-4 space-y-3 text-sm">
          ${
            session.completedBy
              ? `<div class="flex justify-between gap-3"><span class="text-slate-500">关账人</span><span>${escapeHtml(session.completedBy)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">关账时间</span><span>${escapeHtml(session.completedAt || '-')}</span></div>`
              : '<p class="text-slate-500">未关账</p>'
          }
        </div>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">入账信息</h3>
        <div class="mt-4 space-y-3 text-sm">
          ${
            session.accountedBy
              ? `<div class="flex justify-between gap-3"><span class="text-slate-500">入账人</span><span>${escapeHtml(session.accountedBy)}</span></div><div class="flex justify-between gap-3"><span class="text-slate-500">入账时间</span><span>${escapeHtml(session.accountedAt || '-')}</span></div>`
              : '<p class="text-slate-500">未入账</p>'
          }
        </div>
      </section>
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
            data-pcs-live-testing-action="open-edit-item"
            data-session-id="${escapeHtml(session.id)}"
            data-item-id="${escapeHtml(workItemSnapshot.actionItem?.id || '')}"
            ${workItemSnapshot.actionItem ? '' : 'disabled'}
          >
            <i data-lucide="link-2" class="h-4 w-4"></i>关联直播测款记录
          </button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-900">快捷联查</h3>
        <div class="mt-4 space-y-2">
          <button type="button" class="inline-flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="${escapeHtml(relatedProjects[0] ? `/pcs/projects/${relatedProjects[0].projectId}` : '/pcs/projects')}">
            <i data-lucide="package" class="h-4 w-4"></i>相关项目
          </button>
          <button type="button" class="inline-flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="set-detail-tab" data-tab="accounting">
            <i data-lucide="file-text" class="h-4 w-4"></i>相关决策实例
          </button>
          <button type="button" class="inline-flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/inventory">
            <i data-lucide="shirt" class="h-4 w-4"></i>样衣库存与台账
          </button>
        </div>
      </section>
    </div>
  `
}

function renderDetailContent(session: SessionViewModel): string {
  const testItems = session.items.filter((item) => item.intent === 'TEST')
  const relatedProjects = Array.from(
    new Map(
      session.items
        .filter((item) => item.relatedProjectId && item.projectRef)
        .map((item) => [item.relatedProjectId as string, { projectId: item.relatedProjectId as string, label: getProjectRelationProjectLabel(item.relatedProjectId as string) }]),
    ).values(),
  )

  let activeContent = renderOverviewTab(session, testItems)
  if (state.detail.activeTab === 'items') activeContent = renderItemsTab(session)
  if (state.detail.activeTab === 'reconcile') activeContent = renderReconcileTab()
  if (state.detail.activeTab === 'evidence') activeContent = renderEvidenceTab(session)
  if (state.detail.activeTab === 'accounting') activeContent = renderAccountingTab(session, testItems)
  if (state.detail.activeTab === 'samples') activeContent = renderSamplesTab(session)
  if (state.detail.activeTab === 'logs') activeContent = renderLogsTab(session)

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderSessionDetailHeader(session, relatedProjects)}
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
                    )}" data-pcs-live-testing-action="set-detail-tab" data-tab="${tab.key}">${escapeHtml(tab.label)}</button>
                  `,
                )
                .join('')}
            </div>
          </section>
          ${activeContent}
        </div>
        ${renderDetailSidebar(session, relatedProjects)}
      </div>
      ${renderCloseDialog()}
      ${renderAccountingDialog()}
      ${renderEditDrawer()}
    </div>
  `
}

function renderCloseDialog(): string {
  if (!state.closeDialog.open) return ''
  const session = getSession(state.closeDialog.sessionId)
  if (!session) return ''
  const testItems = session.items.filter((item) => item.intent === 'TEST')
  const checks = [
    { ok: Boolean(session.endAt), label: '下播时间已填写' },
    { ok: session.items.length > 0, label: '明细行数 >= 1' },
    { ok: testItems.every((item) => item.projectRef || item.productRef), label: 'TEST 行已绑定项目 / 商品' },
  ]
  return renderModalShell(
    '完成场次（关账）',
    `确认完成「${session.title}」的关账动作，状态将流转为“已关账”。`,
    `
      <section class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-900">Step1 完成前检查</h4>
        <div class="space-y-2">
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
      <section class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-900">Step2 关账信息</h4>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="${toClassName(
            'inline-flex h-9 items-center rounded-md border px-3 text-sm',
            state.closeDialog.completionType === 'normal' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}" data-pcs-live-testing-action="set-completion-type" data-value="normal">正常完成</button>
          <button type="button" class="${toClassName(
            'inline-flex h-9 items-center rounded-md border px-3 text-sm',
            state.closeDialog.completionType === 'abnormal' ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          )}" data-pcs-live-testing-action="set-completion-type" data-value="abnormal">异常完成</button>
        </div>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="填写关账说明" data-pcs-live-testing-field="close-note">${escapeHtml(state.closeDialog.note)}</textarea>
      </section>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="confirm-close-session">确认关账</button>
    `,
  )
}

function renderAccountingDialog(): string {
  if (!state.accountingDialog.open) return ''
  const session = getSession(state.accountingDialog.sessionId)
  if (!session) return ''
  const testItems = session.items.filter((item) => item.intent === 'TEST')
  const checks = [
    { ok: testItems.length > 0, label: `至少存在 1 条 TEST 行（当前 ${testItems.length}）` },
    { ok: testItems.every((item) => item.projectRef || item.productRef), label: '每条 TEST 行已绑定项目 / 商品' },
    { ok: testItems.every((item) => item.pay || item.order || item.gmv), label: '每条 TEST 行已有最小指标数据' },
  ]
  return renderModalShell(
    '完成测款核对（入账）',
    `确认对「${session.title}」的 TEST 行完成核对并回写入账结果。`,
    `
      <section class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-900">Step1 TEST 行校验</h4>
        <div class="space-y-2">
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
      <section class="space-y-3">
        <h4 class="text-sm font-semibold text-slate-900">Step2 入账预览</h4>
        <div class="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          <p>将生成 / 更新的测款结论实例：</p>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            ${testItems
              .map(
                (item) => `<li>${escapeHtml(item.projectRef || item.productRef || item.productName)}：追加 1 条直播证据与结果建议。</li>`,
              )
              .join('')}
          </ul>
        </div>
      </section>
      <section class="space-y-2">
        <h4 class="text-sm font-semibold text-slate-900">Step3 入账确认</h4>
        <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="填写入账说明" data-pcs-live-testing-field="accounting-note">${escapeHtml(state.accountingDialog.note)}</textarea>
      </section>
    `,
    `
      <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="close-dialogs">取消</button>
      <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="confirm-accounting">确认入账</button>
    `,
  )
}

function renderEditDrawer(): string {
  if (!state.editDrawer.open) return ''
  const session = getSession(state.editDrawer.sessionId)
  const item = session?.items.find((candidate) => candidate.id === state.editDrawer.itemId)
  if (!session || !item) return ''
  const draft = state.editDrawer.draft
  return renderDrawerShell(
    '编辑明细行',
    `
      <div class="space-y-6">
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">基础字段</h4>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">评估意图</span>
              <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-live-testing-field="edit-intent">
                ${(['SELL', 'TEST', 'REVIEW'] as ItemIntent[]).map((intent) => `<option value="${intent}" ${draft.intent === intent ? 'selected' : ''}>${escapeHtml(`${ITEM_INTENT_META[intent].label} (${intent})`)}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">关联项目</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.projectRef)}" placeholder="PRJ-xxxx" data-pcs-live-testing-field="edit-project-ref" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">关联商品</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.productRef)}" placeholder="SPU-xxxx" data-pcs-live-testing-field="edit-product-ref" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">款式档案</span>
              <input class="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" value="${escapeHtml(item.styleCode || '-')}" disabled />
            </label>
          </div>
        </section>
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">讲解时段</h4>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-slate-500">讲解开始</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.segmentStart)}" data-pcs-live-testing-field="edit-segment-start" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-slate-500">讲解结束</span>
              <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(draft.segmentEnd)}" data-pcs-live-testing-field="edit-segment-end" />
            </label>
          </div>
        </section>
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">核心指标</h4>
          <div class="grid gap-4 md:grid-cols-3">
            ${[
              ['曝光', 'edit-exposure', draft.exposure],
              ['点击', 'edit-click', draft.click],
              ['加购', 'edit-cart', draft.cart],
              ['订单', 'edit-order', draft.order],
              ['支付', 'edit-pay', draft.pay],
              ['GMV', 'edit-gmv', draft.gmv],
            ]
              .map(
                ([label, field, value]) => `
                  <label class="space-y-1">
                    <span class="text-xs text-slate-500">${escapeHtml(label)}</span>
                    <input class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value="${escapeHtml(value)}" data-pcs-live-testing-field="${escapeHtml(field)}" />
                  </label>
                `,
              )
              .join('')}
          </div>
        </section>
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">建议与说明</h4>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">建议</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-live-testing-field="edit-recommendation">
              <option value="" ${draft.recommendation === '' ? 'selected' : ''}>未判定</option>
              <option value="继续" ${draft.recommendation === '继续' ? 'selected' : ''}>继续</option>
              <option value="改版" ${draft.recommendation === '改版' ? 'selected' : ''}>改版</option>
              <option value="补测" ${draft.recommendation === '补测' ? 'selected' : ''}>补测</option>
              <option value="淘汰" ${draft.recommendation === '淘汰' ? 'selected' : ''}>淘汰</option>
            </select>
          </label>
          <textarea class="min-h-[120px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="说明当前建议和补充结论" data-pcs-live-testing-field="edit-recommendation-reason">${escapeHtml(draft.recommendationReason)}</textarea>
        </section>
        <div class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white py-4">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-live-testing-action="close-dialogs">取消</button>
          <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-live-testing-action="save-edit-item">保存</button>
        </div>
      </div>
    `,
    'close-dialogs',
  )
}

function createSession(status: SessionStatus): void {
  ensureSessionStore()
  const draft = state.createDraft
  const sessionId = `LS-${todayCompact()}-${String(sessionStore.size + 1).padStart(3, '0')}`
  const purposes = draft.purposes.length > 0 ? draft.purposes.map((item) => LIVE_PURPOSE_META[item].label) : ['带货']
  const session: SessionViewModel = {
    id: sessionId,
    title: draft.title.trim() || `直播场次 ${sessionId}`,
    status,
    purposes,
    liveAccount: draft.liveAccount.trim() || 'TikTok / 商品中心直播间',
    anchor: draft.anchor.trim() || '家播-待分配',
    startAt: draft.startAt.trim() || nowText(),
    endAt: draft.endAt.trim() || null,
    owner: draft.owner.trim() || '商品运营',
    operator: draft.operator.trim() || '直播运营',
    recorder: draft.recorder.trim() || '数据助理',
    reviewer: draft.reviewer.trim() || '商品负责人',
    site: draft.site.trim() || '深圳',
    itemCount: 0,
    testItemCount: 0,
    testAccountingStatus: draft.isTestAccountingEnabled ? 'PENDING' : 'NONE',
    sampleCount: 0,
    gmvTotal: 0,
    orderTotal: 0,
    exposureTotal: 0,
    clickTotal: 0,
    cartTotal: 0,
    isTestAccountingEnabled: draft.isTestAccountingEnabled,
    note: draft.note.trim(),
    createdAt: nowText(),
    updatedAt: nowText(),
    completedBy: null,
    completedAt: null,
    accountedBy: null,
    accountedAt: null,
    items: [],
    samples: [],
    logs: [
      {
        time: nowText(),
        action: '创建场次',
        user: '当前用户',
        detail: status === 'DRAFT' ? '保存为草稿。' : '已创建并进入核对中。',
      },
    ],
  }
  sessionStore.set(sessionId, session)
  state.notice = `直播场次「${session.title}」已创建。`
  closeAllDialogs()
  resetCreateDraft()
  appStore.navigate(`/pcs/testing/live/${sessionId}`)
}

export function renderPcsLiveTestingListPage(): string {
  ensureSessionStore()
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

export function renderPcsLiveTestingDetailPage(sessionId: string): string {
  ensureSessionStore()
  syncDetailState(sessionId)
  const session = getSession(sessionId)

  if (!session) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-slate-900">直播场次不存在</h1>
              <p class="mt-1 text-sm text-slate-500">未找到对应的直播场次记录，请返回列表重新选择。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/live">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>返回直播场次
            </button>
          </div>
        </section>
      </div>
    `
  }

  return renderDetailContent(session)
}

export function handlePcsLiveTestingInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-live-testing-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsLiveTestingField
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
  if (field === 'list-accounting' && fieldNode instanceof HTMLSelectElement) {
    state.list.accounting = fieldNode.value
    state.list.currentPage = 1
    return true
  }

  const textFields = new Set([
    'create-title',
    'create-owner',
    'create-site',
    'create-live-account',
    'create-anchor',
    'create-start-at',
    'create-end-at',
    'create-operator',
    'create-recorder',
    'create-reviewer',
  ])
  if (textFields.has(field) && fieldNode instanceof HTMLInputElement) {
    const key = field.replace(/^create-/, '').replaceAll('-', '') as string
    if (field === 'create-title') state.createDraft.title = fieldNode.value
    if (field === 'create-owner') state.createDraft.owner = fieldNode.value
    if (field === 'create-site') state.createDraft.site = fieldNode.value
    if (field === 'create-live-account') state.createDraft.liveAccount = fieldNode.value
    if (field === 'create-anchor') state.createDraft.anchor = fieldNode.value
    if (field === 'create-start-at') state.createDraft.startAt = fieldNode.value
    if (field === 'create-end-at') state.createDraft.endAt = fieldNode.value
    if (field === 'create-operator') state.createDraft.operator = fieldNode.value
    if (field === 'create-recorder') state.createDraft.recorder = fieldNode.value
    if (field === 'create-reviewer') state.createDraft.reviewer = fieldNode.value
    void key
    return true
  }
  if (field === 'create-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.createDraft.note = fieldNode.value
    return true
  }
  if (field === 'close-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.closeDialog.note = fieldNode.value
    return true
  }
  if (field === 'accounting-note' && fieldNode instanceof HTMLTextAreaElement) {
    state.accountingDialog.note = fieldNode.value
    return true
  }

  if (field === 'edit-intent' && fieldNode instanceof HTMLSelectElement) {
    state.editDrawer.draft.intent = fieldNode.value as ItemIntent
    return true
  }
  if (field === 'edit-recommendation' && fieldNode instanceof HTMLSelectElement) {
    state.editDrawer.draft.recommendation = fieldNode.value
    return true
  }
  if (field === 'edit-recommendation-reason' && fieldNode instanceof HTMLTextAreaElement) {
    state.editDrawer.draft.recommendationReason = fieldNode.value
    return true
  }

  const editTextFields: Record<string, keyof EditDrawerState['draft']> = {
    'edit-project-ref': 'projectRef',
    'edit-product-ref': 'productRef',
    'edit-segment-start': 'segmentStart',
    'edit-segment-end': 'segmentEnd',
    'edit-exposure': 'exposure',
    'edit-click': 'click',
    'edit-cart': 'cart',
    'edit-order': 'order',
    'edit-pay': 'pay',
    'edit-gmv': 'gmv',
  }
  if (field in editTextFields && fieldNode instanceof HTMLInputElement) {
    state.editDrawer.draft[editTextFields[field]] = fieldNode.value
    return true
  }

  return false
}

export function handlePcsLiveTestingEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-live-testing-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsLiveTestingAction
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
    state.list = { search: '', status: 'all', purpose: 'all', accounting: 'all', quickFilter: 'all', currentPage: 1, pageSize: 8 }
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
    const value = actionNode.dataset.value as LivePurpose | undefined
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
  if (action === 'create-session-draft') {
    createSession('DRAFT')
    return true
  }
  if (action === 'create-session-reconciling') {
    createSession('RECONCILING')
    return true
  }
  if (action === 'open-close-dialog') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return true
    state.closeDialog = { open: true, sessionId, completionType: 'normal', note: '' }
    return true
  }
  if (action === 'set-completion-type') {
    state.closeDialog.completionType = actionNode.dataset.value === 'abnormal' ? 'abnormal' : 'normal'
    return true
  }
  if (action === 'confirm-close-session') {
    const sessionId = state.closeDialog.sessionId
    if (!sessionId) return true
    updateSession(sessionId, (session) =>
      appendSessionLog(
        {
          ...session,
          status: 'COMPLETED',
          endAt: session.endAt || nowText(),
          completedBy: '当前用户',
          completedAt: nowText(),
        },
        {
          time: nowText(),
          action: '完成关账',
          user: '当前用户',
          detail: state.closeDialog.note.trim() || (state.closeDialog.completionType === 'abnormal' ? '按异常完成方式关账。' : '按正常流程完成关账。'),
        },
      ),
    )
    state.notice = '直播场次已完成关账。'
    closeAllDialogs()
    return true
  }
  if (action === 'open-accounting-dialog') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return true
    state.accountingDialog = { open: true, sessionId, note: '' }
    return true
  }
  if (action === 'confirm-accounting') {
    const sessionId = state.accountingDialog.sessionId
    if (!sessionId) return true
    updateSession(sessionId, (session) =>
      appendSessionLog(
        {
          ...session,
          testAccountingStatus: 'ACCOUNTED',
          accountedBy: '当前用户',
          accountedAt: nowText(),
        },
        {
          time: nowText(),
          action: '完成测款入账',
          user: '当前用户',
          detail: state.accountingDialog.note.trim() || '已完成 TEST 行核对并回写入账结论。',
        },
      ),
    )
    state.notice = '测款入账已完成。'
    closeAllDialogs()
    return true
  }
  if (action === 'open-edit-item') {
    const sessionId = actionNode.dataset.sessionId
    const itemId = actionNode.dataset.itemId
    const session = sessionId ? getSession(sessionId) : null
    const item = session?.items.find((candidate) => candidate.id === itemId)
    if (!sessionId || !itemId || !item) return true
    state.editDrawer = {
      open: true,
      sessionId,
      itemId,
      draft: {
        intent: item.intent,
        projectRef: item.projectRef || '',
        productRef: item.productRef || '',
        segmentStart: item.segmentStart,
        segmentEnd: item.segmentEnd,
        exposure: String(item.exposure),
        click: String(item.click),
        cart: String(item.cart),
        order: String(item.order),
        pay: String(item.pay),
        gmv: String(item.gmv),
        recommendation: item.recommendation || '',
        recommendationReason: item.recommendationReason || '',
      },
    }
    return true
  }
  if (action === 'save-edit-item') {
    const { sessionId, itemId, draft } = state.editDrawer
    if (!sessionId || !itemId) return true
    const session = getSession(sessionId)
    const currentItem = session?.items.find((candidate) => candidate.id === itemId) ?? null
    if (!session || !currentItem) return true
    const resolvedProject = resolveProjectIdentity(draft.projectRef)
    let notice = '明细行已保存。'
    if (currentItem.liveLineId) {
      if (!draft.projectRef.trim()) {
        replaceLiveProductLineProjectRelations(currentItem.liveLineId, [], '当前用户')
        notice = '明细行已保存，并已解除直播测款正式关联。'
      } else if (!resolvedProject) {
        notice = `明细行已保存；直播测款正式关联未回写：未找到项目 ${draft.projectRef.trim()}。`
      } else {
        const candidate = listLiveProductLineProjectRelationCandidates(currentItem.liveLineId).find(
          (item) => item.projectId === resolvedProject.projectId,
        )
        if (candidate && !candidate.eligible) {
          notice = `明细行已保存；直播测款正式关联未回写：${candidate.disabledReason || '当前项目不满足关联条件。'}`
        } else {
          const result = replaceLiveProductLineProjectRelations(
            currentItem.liveLineId,
            [resolvedProject.projectId],
            '当前用户',
          )
          notice = result.errors.length > 0
            ? `明细行已保存；直播测款正式关联未回写：${result.errors.join('；')}`
            : '明细行已保存，并已回写“关联直播测款记录”。'
        }
      }
    }
    updateSession(sessionId, (session) => {
      const items = session.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              intent: draft.intent,
              projectRef: resolvedProject?.projectCode ?? (draft.projectRef.trim() || null),
              relatedProjectId: resolvedProject?.projectId ?? null,
              productRef: draft.productRef.trim(),
              segmentStart: draft.segmentStart.trim(),
              segmentEnd: draft.segmentEnd.trim(),
              exposure: toNumber(draft.exposure, item.exposure),
              click: toNumber(draft.click, item.click),
              cart: toNumber(draft.cart, item.cart),
              order: toNumber(draft.order, item.order),
              pay: toNumber(draft.pay, item.pay),
              gmv: toNumber(draft.gmv, item.gmv),
              recommendation: draft.recommendation.trim() || null,
              recommendationReason: draft.recommendationReason.trim() || null,
              decisionLink: buildDecisionLink(resolvedProject?.projectId ?? null),
            }
          : item,
      )
      return appendSessionLog(
        {
          ...session,
          items,
        },
        {
          time: nowText(),
          action: '编辑明细行',
          user: '当前用户',
          detail: `已更新明细 ${itemId} 的指标和建议字段。`,
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
  if (action === 'export-session') {
    const sessionId = actionNode.dataset.sessionId || state.detail.sessionId
    state.notice = sessionId ? `直播场次 ${sessionId} 的导出入口已准备，当前原型仅展示交互。` : '导出入口已触发。'
    return true
  }
  if (action === 'close-dialogs') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsLiveTestingDialogOpen(): boolean {
  return Boolean(
    state.createDrawerOpen ||
      state.closeDialog.open ||
      state.accountingDialog.open ||
      state.editDrawer.open,
  )
}
