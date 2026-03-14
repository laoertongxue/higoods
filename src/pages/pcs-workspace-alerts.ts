import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

type RiskType =
  | 'WORKITEM_OVERDUE'
  | 'WORKITEM_BLOCKED'
  | 'SAMPLE_OVERDUE_RETURN'
  | 'SAMPLE_IN_TRANSIT_UNRECEIVED'
  | 'SAMPLE_STOCK_MISMATCH'
  | 'STORE_AUTH_EXPIRED'
  | 'STORE_AUTH_EXPIRING'
  | 'LISTING_FAILED'
  | 'LISTING_TIMEOUT'
  | 'MAPPING_CONFLICT'
  | 'MAPPING_MISSING_SKU'
  | 'TEST_ACCOUNTING_PENDING'

type Severity = 'P0' | 'P1' | 'P2' | 'P3'
type RiskStatus = 'OPEN' | 'ACKED' | 'IN_PROGRESS' | 'RESOLVED' | 'SUPPRESSED'
type ViewFilter = 'mine' | 'collab' | 'all'
type SiteFilter = 'all' | '深圳' | '雅加达'

interface EvidenceRef {
  type: string
  content: string
}

interface RiskItem {
  id: string
  riskType: RiskType
  severity: Severity
  status: RiskStatus
  title: string
  description: string
  sourceType: string
  sourceId: string
  sourceName: string
  projectId: string | null
  projectName: string | null
  owner: string
  ownerId: string
  collaborators: string[]
  escalationTo: string
  detectedAt: string
  dueAt: string
  lastNotifiedAt: string
  escalationEta: string | null
  site: '深圳' | '雅加达' | null
  channel?: string
  store?: string
  blocker?: string
  progressNote?: string
  ackedAt?: string
  ackedBy?: string
  ackNote?: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionNote?: string
  evidenceRefs: EvidenceRef[]
}

interface PcsAlertsState {
  risks: RiskItem[]
  selectedRiskId: string | null
  detailOpen: boolean
  ackDialogOpen: boolean
  assignDialogOpen: boolean
  suppressDialogOpen: boolean
  resolveDialogOpen: boolean
  viewFilter: ViewFilter
  severityFilter: 'all' | Severity
  statusFilter: 'all' | RiskStatus
  siteFilter: SiteFilter
  searchTerm: string
  ackNote: string
  ackEta: string
  assignTo: string
  assignNote: string
  suppressReason: string
  suppressDuration: '1' | '3' | '7' | '30'
  resolveNote: string
  notice: string | null
}

const RISK_TYPE_META: Record<RiskType, { label: string; icon: string; textClass: string; bgClass: string }> = {
  WORKITEM_OVERDUE: { label: '工作项超期', icon: 'clock-3', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  WORKITEM_BLOCKED: { label: '工作项阻塞', icon: 'alert-circle', textClass: 'text-orange-600', bgClass: 'bg-orange-50' },
  SAMPLE_OVERDUE_RETURN: { label: '样衣超期未归还', icon: 'package', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  SAMPLE_IN_TRANSIT_UNRECEIVED: { label: '在途未签收', icon: 'package', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
  SAMPLE_STOCK_MISMATCH: { label: '账实不一致', icon: 'triangle-alert', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  STORE_AUTH_EXPIRED: { label: '店铺授权过期', icon: 'store', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  STORE_AUTH_EXPIRING: { label: '店铺授权将过期', icon: 'store', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
  LISTING_FAILED: { label: '上架失败', icon: 'shopping-cart', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  LISTING_TIMEOUT: { label: '上架超时', icon: 'shopping-cart', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
  MAPPING_CONFLICT: { label: '映射冲突', icon: 'link-2', textClass: 'text-red-600', bgClass: 'bg-red-50' },
  MAPPING_MISSING_SKU: { label: '缺SKU映射', icon: 'link-2', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
  TEST_ACCOUNTING_PENDING: { label: '测款待入账', icon: 'video', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
}

const SEVERITY_META: Record<Severity, { label: string; className: string }> = {
  P0: { label: 'P0 致命', className: 'border-red-600 bg-red-600 text-white' },
  P1: { label: 'P1 高', className: 'border-orange-500 bg-orange-500 text-white' },
  P2: { label: 'P2 中', className: 'border-amber-500 bg-amber-500 text-white' },
  P3: { label: 'P3 低', className: 'border-slate-400 bg-slate-400 text-white' },
}

const STATUS_META: Record<RiskStatus, { label: string; className: string }> = {
  OPEN: { label: '待处理', className: 'border-red-200 bg-red-50 text-red-700' },
  ACKED: { label: '已确认', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: '处理中', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  RESOLVED: { label: '已解决', className: 'border-green-200 bg-green-50 text-green-700' },
  SUPPRESSED: { label: '已抑制', className: 'border-slate-200 bg-slate-50 text-slate-700' },
}

const RISK_SEEDS: RiskItem[] = [
  {
    id: 'RSK-20260114-001',
    riskType: 'WORKITEM_OVERDUE',
    severity: 'P0',
    status: 'OPEN',
    title: '制版任务超期3天未完成',
    description: '印尼风格碎花连衣裙制版任务已超期3天，阻塞后续打样流程',
    sourceType: 'WorkItemInstance',
    sourceId: 'WI-PRJ001-005',
    sourceName: '制版准备',
    projectId: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    owner: '王版师',
    ownerId: 'user_003',
    collaborators: ['李打样'],
    escalationTo: '张经理',
    detectedAt: '2026-01-14 08:00',
    dueAt: '2026-01-14 18:00',
    lastNotifiedAt: '2026-01-14 10:00',
    escalationEta: '2小时',
    site: '深圳',
    evidenceRefs: [{ type: '工作项状态', content: '状态=进行中，截止=2026-01-11' }],
  },
  {
    id: 'RSK-20260114-002',
    riskType: 'SAMPLE_OVERDUE_RETURN',
    severity: 'P1',
    status: 'ACKED',
    title: '样衣超期未归还5天',
    description: 'SPL-20260108-001 印尼碎花裙样衣A已超期5天未归还',
    sourceType: 'SampleUseRequest',
    sourceId: 'SUR-20260103-001',
    sourceName: '样衣使用申请#SUR-001',
    projectId: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    owner: '陈测款',
    ownerId: 'user_005',
    collaborators: ['深圳仓管'],
    escalationTo: '运营主管',
    detectedAt: '2026-01-13 09:00',
    dueAt: '2026-01-14 12:00',
    lastNotifiedAt: '2026-01-14 09:00',
    escalationEta: '已确认',
    site: '深圳',
    ackedAt: '2026-01-14 09:30',
    ackedBy: '陈测款',
    ackNote: '已联系测款团队，今日归还',
    evidenceRefs: [
      { type: '申请单', content: '预计归还2026-01-09，实际未归还' },
      { type: '样衣', content: 'SPL-20260108-001，当前位置=测款间' },
    ],
  },
  {
    id: 'RSK-20260114-003',
    riskType: 'STORE_AUTH_EXPIRING',
    severity: 'P2',
    status: 'OPEN',
    title: 'TikTok店铺授权将于5天后过期',
    description: 'TikTok印尼站-HiGood旗舰店授权将于2026-01-19过期',
    sourceType: 'ChannelStore',
    sourceId: 'STORE-TK-ID-001',
    sourceName: 'TikTok印尼站-HiGood旗舰店',
    projectId: null,
    projectName: null,
    owner: '王渠道',
    ownerId: 'user_007',
    collaborators: [],
    escalationTo: '渠道主管',
    detectedAt: '2026-01-14 06:00',
    dueAt: '2026-01-17 18:00',
    lastNotifiedAt: '2026-01-14 06:00',
    escalationEta: '3天',
    site: null,
    channel: 'TikTok',
    store: 'HiGood旗舰店',
    evidenceRefs: [{ type: '授权状态', content: 'token_expires_at=2026-01-19 00:00' }],
  },
  {
    id: 'RSK-20260114-004',
    riskType: 'LISTING_FAILED',
    severity: 'P1',
    status: 'IN_PROGRESS',
    title: '商品上架失败-缺少必填属性',
    description: '印尼碎花裙TikTok上架失败：缺少颜色、尺码属性',
    sourceType: 'ListingInstance',
    sourceId: 'LST-20260113-001',
    sourceName: '商品上架#LST-001',
    projectId: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    owner: '李运营',
    ownerId: 'user_008',
    collaborators: ['王渠道'],
    escalationTo: '运营主管',
    detectedAt: '2026-01-13 16:00',
    dueAt: '2026-01-14 16:00',
    lastNotifiedAt: '2026-01-14 08:00',
    escalationEta: '6小时',
    site: null,
    channel: 'TikTok',
    store: 'HiGood旗舰店',
    progressNote: '正在补充商品属性',
    evidenceRefs: [{ type: '平台回执', content: 'error_code=MISSING_ATTR, fields=[color,size]' }],
  },
  {
    id: 'RSK-20260114-005',
    riskType: 'MAPPING_CONFLICT',
    severity: 'P1',
    status: 'OPEN',
    title: 'SKU映射冲突-重复绑定',
    description: '渠道商品CP-TK-001的SKU映射与CP-TK-003冲突',
    sourceType: 'CodeMapping',
    sourceId: 'MAP-20260114-001',
    sourceName: 'SKU映射#MAP-001',
    projectId: null,
    projectName: null,
    owner: '张数据',
    ownerId: 'user_009',
    collaborators: ['王渠道'],
    escalationTo: '数据主管',
    detectedAt: '2026-01-14 07:00',
    dueAt: '2026-01-14 18:00',
    lastNotifiedAt: '2026-01-14 07:00',
    escalationEta: '8小时',
    site: null,
    channel: 'TikTok',
    evidenceRefs: [{ type: '冲突详情', content: 'internal_sku=SKU-001 被 CP-TK-001 和 CP-TK-003 同时映射' }],
  },
  {
    id: 'RSK-20260114-006',
    riskType: 'TEST_ACCOUNTING_PENDING',
    severity: 'P2',
    status: 'OPEN',
    title: '直播测款入账待处理超48小时',
    description: '直播场次LS-20260112-001存在3个TEST条目超48小时未入账',
    sourceType: 'LiveSession',
    sourceId: 'LS-20260112-001',
    sourceName: '直播场次#LS-001',
    projectId: null,
    projectName: null,
    owner: '刘测款',
    ownerId: 'user_010',
    collaborators: ['测款主管'],
    escalationTo: '测款主管',
    detectedAt: '2026-01-14 06:00',
    dueAt: '2026-01-16 18:00',
    lastNotifiedAt: '2026-01-14 06:00',
    escalationEta: '2天',
    site: null,
    evidenceRefs: [{ type: '待入账条目', content: '3个TEST条目，总GMV=¥12,500' }],
  },
  {
    id: 'RSK-20260114-007',
    riskType: 'WORKITEM_BLOCKED',
    severity: 'P1',
    status: 'OPEN',
    title: '花型任务阻塞-等待面料确认',
    description: '花型调色任务因面料供应商未确认色卡而阻塞2天',
    sourceType: 'WorkItemInstance',
    sourceId: 'WI-PRJ001-008',
    sourceName: '花型调色',
    projectId: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    owner: '赵花型',
    ownerId: 'user_011',
    collaborators: ['采购'],
    escalationTo: '设计主管',
    detectedAt: '2026-01-12 14:00',
    dueAt: '2026-01-14 14:00',
    lastNotifiedAt: '2026-01-14 08:00',
    escalationEta: '4小时',
    site: '深圳',
    blocker: '等待面料供应商确认色卡',
    evidenceRefs: [{ type: '阻塞原因', content: 'blocker=等待面料供应商确认色卡' }],
  },
  {
    id: 'RSK-20260113-008',
    riskType: 'SAMPLE_IN_TRANSIT_UNRECEIVED',
    severity: 'P2',
    status: 'RESOLVED',
    title: '样衣在途超时未签收',
    description: 'SPL-20260105-002寄往雅加达超过5天未签收',
    sourceType: 'SampleTransfer',
    sourceId: 'TRF-20260108-001',
    sourceName: '样衣流转#TRF-001',
    projectId: 'PRJ-20251216-001',
    projectName: '印尼风格碎花连衣裙',
    owner: '雅加达仓管',
    ownerId: 'user_012',
    collaborators: ['深圳仓管'],
    escalationTo: '仓管主管',
    detectedAt: '2026-01-13 09:00',
    dueAt: '2026-01-13 18:00',
    lastNotifiedAt: '2026-01-13 09:00',
    escalationEta: null,
    site: '雅加达',
    resolvedAt: '2026-01-13 15:00',
    resolvedBy: '雅加达仓管',
    resolutionNote: '已签收入库，物流延误导致',
    evidenceRefs: [{ type: '运单', content: 'SF1234567890，状态=已签收' }],
  },
]

const state: PcsAlertsState = {
  risks: [...RISK_SEEDS],
  selectedRiskId: null,
  detailOpen: false,
  ackDialogOpen: false,
  assignDialogOpen: false,
  suppressDialogOpen: false,
  resolveDialogOpen: false,
  viewFilter: 'mine',
  severityFilter: 'all',
  statusFilter: 'all',
  siteFilter: 'all',
  searchTerm: '',
  ackNote: '',
  ackEta: '',
  assignTo: '',
  assignNote: '',
  suppressReason: '',
  suppressDuration: '1',
  resolveNote: '',
  notice: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function nowText(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function getRiskById(riskId: string | null): RiskItem | null {
  if (!riskId) return null
  return state.risks.find((item) => item.id === riskId) ?? null
}

function getProcessPath(risk: RiskItem): string {
  if (risk.riskType === 'WORKITEM_OVERDUE' || risk.riskType === 'WORKITEM_BLOCKED') return '/pcs/work-items'
  if (risk.riskType === 'SAMPLE_OVERDUE_RETURN') return '/pcs/samples/application'
  if (risk.riskType === 'SAMPLE_IN_TRANSIT_UNRECEIVED') return '/pcs/samples/transfer'
  if (risk.riskType === 'SAMPLE_STOCK_MISMATCH') return '/pcs/samples/inventory'
  if (risk.riskType === 'STORE_AUTH_EXPIRED' || risk.riskType === 'STORE_AUTH_EXPIRING') return '/pcs/channels/stores'
  if (risk.riskType === 'LISTING_FAILED' || risk.riskType === 'LISTING_TIMEOUT') return '/pcs/channels/products'
  if (risk.riskType === 'MAPPING_CONFLICT' || risk.riskType === 'MAPPING_MISSING_SKU') return '/pcs/channels/products'
  if (risk.riskType === 'TEST_ACCOUNTING_PENDING') {
    return risk.sourceType === 'LiveSession' ? '/pcs/testing/live' : '/pcs/testing/video'
  }
  return '/pcs/workspace/overview'
}

function getFilteredRisks(): RiskItem[] {
  const severityOrder: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const statusOrder: Record<RiskStatus, number> = { OPEN: 0, ACKED: 1, IN_PROGRESS: 2, RESOLVED: 3, SUPPRESSED: 4 }
  const keyword = state.searchTerm.trim().toLowerCase()

  const rows = state.risks.filter((risk) => {
    if (state.viewFilter === 'mine' && risk.owner !== '王版师' && !risk.collaborators.includes('王版师')) return false
    if (state.viewFilter === 'collab' && !risk.collaborators.includes('王版师')) return false
    if (state.severityFilter !== 'all' && risk.severity !== state.severityFilter) return false
    if (state.statusFilter !== 'all' && risk.status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && risk.site !== state.siteFilter) return false

    if (!keyword) return true
    const haystack = `${risk.title} ${risk.id} ${risk.sourceName}`.toLowerCase()
    return haystack.includes(keyword)
  })

  rows.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return statusOrder[a.status] - statusOrder[b.status]
  })

  return rows
}

function getStats() {
  return {
    open: state.risks.filter((risk) => risk.status === 'OPEN').length,
    p0: state.risks.filter((risk) => risk.severity === 'P0' && risk.status !== 'RESOLVED' && risk.status !== 'SUPPRESSED').length,
    todayNew: state.risks.filter((risk) => risk.detectedAt.startsWith('2026-01-14')).length,
    escalated: state.risks.filter((risk) => risk.escalationEta === '已升级').length,
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-alert-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold">风险提醒</h1>
        <p class="text-sm text-muted-foreground">跨域风控与异常处置聚合中心</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="refresh"><i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新</button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="export"><i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出</button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="open-settings"><i data-lucide="settings" class="mr-1 h-3.5 w-3.5"></i>规则配置</button>
      </div>
    </header>
  `
}

function renderKpis(): string {
  const stats = getStats()
  return `
    <section class="grid gap-3 md:grid-cols-4">
      <button class="rounded-lg border bg-card px-4 py-3 text-left hover:border-red-300" data-pcs-alert-action="quick-set-status" data-status="OPEN">
        <div class="flex items-center justify-between">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-600"><i data-lucide="alert-triangle" class="h-4 w-4"></i></span>
          <span class="text-2xl font-semibold text-red-700">${stats.open}</span>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">待处理</p>
      </button>
      <button class="rounded-lg border bg-card px-4 py-3 text-left hover:border-red-300" data-pcs-alert-action="quick-set-severity" data-severity="P0">
        <div class="flex items-center justify-between">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-100 text-red-700"><i data-lucide="circle-x" class="h-4 w-4"></i></span>
          <span class="text-2xl font-semibold text-red-700">${stats.p0}</span>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">P0 致命</p>
      </button>
      <article class="rounded-lg border bg-card px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600"><i data-lucide="trending-up" class="h-4 w-4"></i></span>
          <span class="text-2xl font-semibold">${stats.todayNew}</span>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">今日新增</p>
      </article>
      <article class="rounded-lg border bg-card px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-orange-50 text-orange-600"><i data-lucide="arrow-up-right" class="h-4 w-4"></i></span>
          <span class="text-2xl font-semibold">${stats.escalated}</span>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">已升级</p>
      </article>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex items-center rounded-md border bg-muted/20 p-1">
          ${([
            ['mine', '我负责'],
            ['collab', '我协同'],
            ['all', '全部可见'],
          ] as Array<[ViewFilter, string]>)
            .map(
              ([value, label]) => `
                <button
                  class="inline-flex h-7 items-center rounded-md px-3 text-xs ${state.viewFilter === value ? 'bg-background text-foreground shadow-sm border' : 'text-muted-foreground hover:text-foreground'}"
                  data-pcs-alert-action="set-view"
                  data-view="${value}"
                >
                  ${label}
                </button>
              `,
            )
            .join('')}
        </div>

        <div class="min-w-[220px] flex-1">
          <label class="mb-1 block text-xs text-muted-foreground">搜索</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input
              class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              placeholder="搜索风险标题/编号/来源..."
              value="${escapeHtml(state.searchTerm)}"
              data-pcs-alert-field="searchTerm"
            />
          </div>
        </div>

        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">严重等级</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="severityFilter">
            <option value="all" ${state.severityFilter === 'all' ? 'selected' : ''}>全部等级</option>
            <option value="P0" ${state.severityFilter === 'P0' ? 'selected' : ''}>P0 致命</option>
            <option value="P1" ${state.severityFilter === 'P1' ? 'selected' : ''}>P1 高</option>
            <option value="P2" ${state.severityFilter === 'P2' ? 'selected' : ''}>P2 中</option>
            <option value="P3" ${state.severityFilter === 'P3' ? 'selected' : ''}>P3 低</option>
          </select>
        </div>

        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="OPEN" ${state.statusFilter === 'OPEN' ? 'selected' : ''}>待处理</option>
            <option value="ACKED" ${state.statusFilter === 'ACKED' ? 'selected' : ''}>已确认</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>处理中</option>
            <option value="RESOLVED" ${state.statusFilter === 'RESOLVED' ? 'selected' : ''}>已解决</option>
            <option value="SUPPRESSED" ${state.statusFilter === 'SUPPRESSED' ? 'selected' : ''}>已抑制</option>
          </select>
        </div>

        <div class="w-[130px]">
          <label class="mb-1 block text-xs text-muted-foreground">站点</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="siteFilter">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            <option value="深圳" ${state.siteFilter === '深圳' ? 'selected' : ''}>深圳</option>
            <option value="雅加达" ${state.siteFilter === '雅加达' ? 'selected' : ''}>雅加达</option>
          </select>
        </div>

        ${
          state.severityFilter !== 'all' || state.statusFilter !== 'all' || state.siteFilter !== 'all'
            ? '<button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-alert-action="clear-filters">清除筛选</button>'
            : ''
        }
      </div>
    </section>
  `
}

function renderRiskTable(): string {
  const rows = getFilteredRisks()

  return `
    <section class="rounded-lg border bg-card">
      <header class="border-b px-4 py-3">
        <h3 class="text-base font-semibold">风险列表 <span class="text-sm font-normal text-muted-foreground">(${rows.length})</span></h3>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1220px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">严重度</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">风险标题</th>
              <th class="px-3 py-2 font-medium">风险类型</th>
              <th class="px-3 py-2 font-medium">来源对象</th>
              <th class="px-3 py-2 font-medium">责任人</th>
              <th class="px-3 py-2 font-medium">建议截止</th>
              <th class="px-3 py-2 font-medium">升级倒计时</th>
              <th class="px-3 py-2 font-medium">最近提醒</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="10" class="px-4 py-12 text-center text-muted-foreground">
                      <i data-lucide="check-circle-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
                      <p class="mt-2">暂无风险提醒</p>
                    </td>
                  </tr>
                `
                : rows
                    .map((risk) => {
                      const typeMeta = RISK_TYPE_META[risk.riskType]
                      const severityMeta = SEVERITY_META[risk.severity]
                      const statusMeta = STATUS_META[risk.status]
                      const opacityClass = risk.status === 'RESOLVED' || risk.status === 'SUPPRESSED' ? 'opacity-60' : ''
                      const etaNode =
                        risk.status === 'RESOLVED' || risk.status === 'SUPPRESSED'
                          ? '-'
                          : risk.escalationEta === '已升级'
                            ? renderBadge('已升级', 'border-red-300 bg-red-50 text-red-700')
                            : escapeHtml(risk.escalationEta ?? '-')

                      return `
                        <tr class="border-b last:border-b-0 ${opacityClass}">
                          <td class="px-3 py-2">${renderBadge(risk.severity, severityMeta.className)}</td>
                          <td class="px-3 py-2">${renderBadge(statusMeta.label, statusMeta.className)}</td>
                          <td class="px-3 py-2">
                            <button class="text-left font-medium hover:text-blue-700" data-pcs-alert-action="open-detail" data-risk-id="${escapeHtml(risk.id)}">${escapeHtml(risk.title)}</button>
                          </td>
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${typeMeta.bgClass} ${typeMeta.textClass}">
                              <i data-lucide="${typeMeta.icon}" class="h-3.5 w-3.5"></i>
                              ${escapeHtml(typeMeta.label)}
                            </span>
                          </td>
                          <td class="px-3 py-2">
                            <button class="text-blue-700 hover:underline" data-pcs-alert-action="go-process" data-risk-id="${escapeHtml(risk.id)}">${escapeHtml(risk.sourceName)}</button>
                          </td>
                          <td class="px-3 py-2">${escapeHtml(risk.owner)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(risk.dueAt)}</td>
                          <td class="px-3 py-2 text-xs">${etaNode}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(risk.lastNotifiedAt)}</td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-alert-action="open-detail" data-risk-id="${escapeHtml(risk.id)}">详情</button>
                              ${
                                risk.status === 'OPEN'
                                  ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-alert-action="open-ack" data-risk-id="${escapeHtml(risk.id)}">确认</button>`
                                  : ''
                              }
                              <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-50" data-pcs-alert-action="go-process" data-risk-id="${escapeHtml(risk.id)}">去处理</button>
                              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-alert-action="open-assign" data-risk-id="${escapeHtml(risk.id)}">分派</button>
                              ${
                                risk.status !== 'RESOLVED' && risk.status !== 'SUPPRESSED'
                                  ? `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-alert-action="open-suppress" data-risk-id="${escapeHtml(risk.id)}">抑制</button>`
                                  : ''
                              }
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailOpen) return ''
  const risk = getRiskById(state.selectedRiskId)
  if (!risk) return ''

  const severityMeta = SEVERITY_META[risk.severity]
  const statusMeta = STATUS_META[risk.status]

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pcs-alert-action="close-detail" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[680px]">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                ${renderBadge(risk.severity, severityMeta.className)}
                ${renderBadge(statusMeta.label, statusMeta.className)}
              </div>
              <h2 class="text-base font-semibold">${escapeHtml(risk.title)}</h2>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-alert-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-4">
          ${
            risk.status !== 'RESOLVED' && risk.status !== 'SUPPRESSED'
              ? `
                <section class="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
                  ${
                    risk.status === 'OPEN'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="open-ack" data-risk-id="${escapeHtml(risk.id)}"><i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>确认</button>`
                      : ''
                  }
                  <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-alert-action="go-process" data-risk-id="${escapeHtml(risk.id)}"><i data-lucide="external-link" class="mr-1 h-3.5 w-3.5"></i>去处理</button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="open-assign" data-risk-id="${escapeHtml(risk.id)}"><i data-lucide="user-plus" class="mr-1 h-3.5 w-3.5"></i>分派</button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="open-suppress" data-risk-id="${escapeHtml(risk.id)}"><i data-lucide="bell-off" class="mr-1 h-3.5 w-3.5"></i>抑制</button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-alert-action="open-resolve" data-risk-id="${escapeHtml(risk.id)}"><i data-lucide="check-check" class="mr-1 h-3.5 w-3.5"></i>标记已解决</button>
                </section>
              `
              : ''
          }

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-2 text-sm font-semibold">风险摘要</h3>
            <p class="text-sm text-muted-foreground">${escapeHtml(risk.description)}</p>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">影响范围</h3>
            <div class="grid gap-3 text-sm sm:grid-cols-2">
              ${
                risk.projectName
                  ? `<div><span class="text-muted-foreground">关联项目：</span><button class="text-blue-700 hover:underline" data-pcs-alert-action="go-project">${escapeHtml(risk.projectName)}</button></div>`
                  : ''
              }
              ${risk.site ? `<div><span class="text-muted-foreground">站点：</span>${escapeHtml(risk.site)}</div>` : ''}
              ${risk.channel ? `<div><span class="text-muted-foreground">渠道：</span>${escapeHtml(risk.channel)}</div>` : ''}
              ${risk.store ? `<div><span class="text-muted-foreground">店铺：</span>${escapeHtml(risk.store)}</div>` : ''}
              ${!risk.projectName && !risk.site && !risk.channel && !risk.store ? '<p class="sm:col-span-2 text-muted-foreground">暂无扩展影响信息</p>' : ''}
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">证据与日志</h3>
            <div class="space-y-2">
              ${risk.evidenceRefs.map((item) => `<div class="rounded-md border px-3 py-2 text-sm"><span class="font-medium">${escapeHtml(item.type)}：</span><span class="text-muted-foreground">${escapeHtml(item.content)}</span></div>`).join('')}
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">责任链</h3>
            <div class="space-y-2 text-sm">
              <div><span class="text-muted-foreground">责任人：</span>${escapeHtml(risk.owner)}</div>
              <div><span class="text-muted-foreground">协同人：</span>${risk.collaborators.length > 0 ? escapeHtml(risk.collaborators.join('、')) : '无'}</div>
              <div><span class="text-muted-foreground">升级对象：</span>${escapeHtml(risk.escalationTo)}</div>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">处置记录</h3>
            <div class="space-y-3 text-sm">
              <div class="flex items-start gap-2">
                <span class="mt-1 h-2 w-2 rounded-full bg-blue-500"></span>
                <div>
                  <p class="font-medium">发现风险</p>
                  <p class="text-xs text-muted-foreground">${escapeHtml(risk.detectedAt)} · 系统检测</p>
                </div>
              </div>
              ${
                risk.ackedAt
                  ? `
                    <div class="flex items-start gap-2">
                      <span class="mt-1 h-2 w-2 rounded-full bg-green-500"></span>
                      <div>
                        <p class="font-medium">已确认</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(risk.ackedAt)} · ${escapeHtml(risk.ackedBy ?? '-')}</p>
                        ${risk.ackNote ? `<p class="text-xs text-muted-foreground">"${escapeHtml(risk.ackNote)}"</p>` : ''}
                      </div>
                    </div>
                  `
                  : ''
              }
              ${
                risk.progressNote
                  ? `
                    <div class="flex items-start gap-2">
                      <span class="mt-1 h-2 w-2 rounded-full bg-amber-500"></span>
                      <div>
                        <p class="font-medium">处理中</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(risk.progressNote)}</p>
                      </div>
                    </div>
                  `
                  : ''
              }
              ${
                risk.resolvedAt
                  ? `
                    <div class="flex items-start gap-2">
                      <span class="mt-1 h-2 w-2 rounded-full bg-green-700"></span>
                      <div>
                        <p class="font-medium">已解决</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(risk.resolvedAt)} · ${escapeHtml(risk.resolvedBy ?? '-')}</p>
                        ${risk.resolutionNote ? `<p class="text-xs text-muted-foreground">"${escapeHtml(risk.resolutionNote)}"</p>` : ''}
                      </div>
                    </div>
                  `
                  : ''
              }
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">基本信息</h3>
            <div class="grid gap-3 text-sm sm:grid-cols-2">
              <div><span class="text-muted-foreground">风险编号：</span>${escapeHtml(risk.id)}</div>
              <div><span class="text-muted-foreground">风险类型：</span>${escapeHtml(RISK_TYPE_META[risk.riskType].label)}</div>
              <div><span class="text-muted-foreground">发现时间：</span>${escapeHtml(risk.detectedAt)}</div>
              <div><span class="text-muted-foreground">建议截止：</span>${escapeHtml(risk.dueAt)}</div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  `
}

function renderAckDialog(): string {
  if (!state.ackDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">确认风险</h3>
        </header>
        <div class="space-y-4 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">预计处理时间（可选）</label>
            <input type="datetime-local" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.ackEta)}" data-pcs-alert-field="ackEta" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">备注（可选）</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="填写处理计划或备注..." data-pcs-alert-field="ackNote">${escapeHtml(state.ackNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-alert-action="close-ack">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-alert-action="submit-ack">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderAssignDialog(): string {
  if (!state.assignDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">分派风险</h3>
        </header>
        <div class="space-y-4 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">分派给 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="assignTo">
              <option value="" ${state.assignTo === '' ? 'selected' : ''}>选择责任人</option>
              <option value="王版师" ${state.assignTo === '王版师' ? 'selected' : ''}>王版师</option>
              <option value="李打样" ${state.assignTo === '李打样' ? 'selected' : ''}>李打样</option>
              <option value="陈测款" ${state.assignTo === '陈测款' ? 'selected' : ''}>陈测款</option>
              <option value="张经理" ${state.assignTo === '张经理' ? 'selected' : ''}>张经理</option>
              <option value="王渠道" ${state.assignTo === '王渠道' ? 'selected' : ''}>王渠道</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">分派原因 *</label>
            <textarea class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="填写分派原因..." data-pcs-alert-field="assignNote">${escapeHtml(state.assignNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-alert-action="close-assign">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${!state.assignTo || !state.assignNote.trim() ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-alert-action="submit-assign" ${!state.assignTo || !state.assignNote.trim() ? 'disabled' : ''}>分派</button>
        </footer>
      </section>
    </div>
  `
}

function renderSuppressDialog(): string {
  if (!state.suppressDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">抑制风险</h3>
        </header>
        <div class="space-y-4 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">抑制原因 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="suppressReason">
              <option value="" ${state.suppressReason === '' ? 'selected' : ''}>选择抑制原因</option>
              <option value="known_issue" ${state.suppressReason === 'known_issue' ? 'selected' : ''}>已知问题</option>
              <option value="no_action_needed" ${state.suppressReason === 'no_action_needed' ? 'selected' : ''}>无需处理</option>
              <option value="false_positive" ${state.suppressReason === 'false_positive' ? 'selected' : ''}>误报</option>
              <option value="external_reason" ${state.suppressReason === 'external_reason' ? 'selected' : ''}>外部原因</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">抑制期限 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-alert-field="suppressDuration">
              <option value="1" ${state.suppressDuration === '1' ? 'selected' : ''}>1天</option>
              <option value="3" ${state.suppressDuration === '3' ? 'selected' : ''}>3天</option>
              <option value="7" ${state.suppressDuration === '7' ? 'selected' : ''}>7天</option>
              <option value="30" ${state.suppressDuration === '30' ? 'selected' : ''}>30天</option>
            </select>
            <p class="mt-1 text-xs text-muted-foreground">到期后自动恢复检测</p>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-alert-action="close-suppress">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${!state.suppressReason ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-alert-action="submit-suppress" ${!state.suppressReason ? 'disabled' : ''}>抑制</button>
        </footer>
      </section>
    </div>
  `
}

function renderResolveDialog(): string {
  if (!state.resolveDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">标记已解决</h3>
        </header>
        <div class="space-y-4 p-4">
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">处理结论 *</label>
            <textarea class="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="填写处理结论..." data-pcs-alert-field="resolveNote">${escapeHtml(state.resolveNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-alert-action="close-resolve">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${!state.resolveNote.trim() ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-alert-action="submit-resolve" ${!state.resolveNote.trim() ? 'disabled' : ''}>确认解决</button>
        </footer>
      </section>
    </div>
  `
}

export function renderPcsAlertsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderKpis()}
      ${renderFilters()}
      ${renderRiskTable()}
      ${renderDetailDrawer()}
      ${renderAckDialog()}
      ${renderAssignDialog()}
      ${renderSuppressDialog()}
      ${renderResolveDialog()}
    </div>
  `
}

function setRiskStatus(riskId: string, updater: (risk: RiskItem) => RiskItem): void {
  state.risks = state.risks.map((risk) => (risk.id === riskId ? updater(risk) : risk))
}

function closeAllDialogs(): void {
  if (state.ackDialogOpen) {
    state.ackDialogOpen = false
    return
  }
  if (state.assignDialogOpen) {
    state.assignDialogOpen = false
    return
  }
  if (state.suppressDialogOpen) {
    state.suppressDialogOpen = false
    return
  }
  if (state.resolveDialogOpen) {
    state.resolveDialogOpen = false
    return
  }
  if (state.detailOpen) {
    state.detailOpen = false
  }
}

function openDialog(type: 'ack' | 'assign' | 'suppress' | 'resolve', riskId: string): void {
  state.selectedRiskId = riskId
  if (type === 'ack') state.ackDialogOpen = true
  if (type === 'assign') state.assignDialogOpen = true
  if (type === 'suppress') state.suppressDialogOpen = true
  if (type === 'resolve') state.resolveDialogOpen = true
}

function openDetail(riskId: string): void {
  state.selectedRiskId = riskId
  state.detailOpen = true
}

function navigateRiskProcess(riskId: string): void {
  const risk = getRiskById(riskId)
  if (!risk) return
  appStore.navigate(getProcessPath(risk))
}

export function handlePcsAlertsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-alert-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsAlertField
    if (field === 'searchTerm') {
      state.searchTerm = fieldNode.value
      return true
    }
    if (field === 'ackEta') {
      state.ackEta = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.pcsAlertField
    if (field === 'ackNote') {
      state.ackNote = fieldNode.value
      return true
    }
    if (field === 'assignNote') {
      state.assignNote = fieldNode.value
      return true
    }
    if (field === 'resolveNote') {
      state.resolveNote = fieldNode.value
      return true
    }
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsAlertField
    if (field === 'severityFilter') {
      state.severityFilter = fieldNode.value as PcsAlertsState['severityFilter']
      return true
    }
    if (field === 'statusFilter') {
      state.statusFilter = fieldNode.value as PcsAlertsState['statusFilter']
      return true
    }
    if (field === 'siteFilter') {
      state.siteFilter = fieldNode.value as SiteFilter
      return true
    }
    if (field === 'assignTo') {
      state.assignTo = fieldNode.value
      return true
    }
    if (field === 'suppressReason') {
      state.suppressReason = fieldNode.value
      return true
    }
    if (field === 'suppressDuration') {
      state.suppressDuration = fieldNode.value as PcsAlertsState['suppressDuration']
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-alert-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsAlertAction
  if (!action) return false

  if (action === 'refresh') {
    state.notice = `刷新成功，风险列表已更新（${nowText()}）。`
    return true
  }

  if (action === 'export') {
    state.notice = '导出任务已创建（演示态），请前往下载中心查看。'
    return true
  }

  if (action === 'open-settings') {
    appStore.navigate('/pcs/settings/config-workspace')
    return true
  }

  if (action === 'set-view') {
    const view = actionNode.dataset.view as ViewFilter | undefined
    if (view) state.viewFilter = view
    return true
  }

  if (action === 'quick-set-status') {
    const status = actionNode.dataset.status as RiskStatus | undefined
    if (status) state.statusFilter = status
    return true
  }

  if (action === 'quick-set-severity') {
    const severity = actionNode.dataset.severity as Severity | undefined
    if (severity) state.severityFilter = severity
    return true
  }

  if (action === 'clear-filters') {
    state.severityFilter = 'all'
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    return true
  }

  if (action === 'open-detail') {
    const riskId = actionNode.dataset.riskId
    if (riskId) openDetail(riskId)
    return true
  }

  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }

  if (action === 'go-process') {
    const riskId = actionNode.dataset.riskId
    if (riskId) navigateRiskProcess(riskId)
    return true
  }

  if (action === 'go-project') {
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'open-ack') {
    const riskId = actionNode.dataset.riskId
    if (riskId) openDialog('ack', riskId)
    return true
  }

  if (action === 'open-assign') {
    const riskId = actionNode.dataset.riskId
    if (riskId) openDialog('assign', riskId)
    return true
  }

  if (action === 'open-suppress') {
    const riskId = actionNode.dataset.riskId
    if (riskId) openDialog('suppress', riskId)
    return true
  }

  if (action === 'open-resolve') {
    const riskId = actionNode.dataset.riskId
    if (riskId) openDialog('resolve', riskId)
    return true
  }

  if (action === 'close-ack') {
    state.ackDialogOpen = false
    return true
  }

  if (action === 'close-assign') {
    state.assignDialogOpen = false
    return true
  }

  if (action === 'close-suppress') {
    state.suppressDialogOpen = false
    return true
  }

  if (action === 'close-resolve') {
    state.resolveDialogOpen = false
    return true
  }

  if (action === 'submit-ack') {
    const riskId = state.selectedRiskId
    if (!riskId) return true
    setRiskStatus(riskId, (risk) => ({
      ...risk,
      status: 'ACKED',
      ackedAt: nowText(),
      ackedBy: '当前用户',
      ackNote: state.ackNote.trim() || undefined,
      escalationEta: state.ackEta ? `预计 ${state.ackEta.replace('T', ' ')}` : '已确认',
    }))
    state.ackDialogOpen = false
    state.notice = `风险 ${riskId} 已确认。`
    state.ackNote = ''
    state.ackEta = ''
    return true
  }

  if (action === 'submit-assign') {
    const riskId = state.selectedRiskId
    if (!riskId || !state.assignTo || !state.assignNote.trim()) return true
    setRiskStatus(riskId, (risk) => ({
      ...risk,
      owner: state.assignTo,
      status: risk.status === 'OPEN' ? 'IN_PROGRESS' : risk.status,
      progressNote: `已分派：${state.assignNote.trim()}`,
    }))
    state.assignDialogOpen = false
    state.notice = `风险 ${riskId} 已分派给 ${state.assignTo}。`
    state.assignTo = ''
    state.assignNote = ''
    return true
  }

  if (action === 'submit-suppress') {
    const riskId = state.selectedRiskId
    if (!riskId || !state.suppressReason) return true
    setRiskStatus(riskId, (risk) => ({
      ...risk,
      status: 'SUPPRESSED',
      progressNote: `已抑制（${state.suppressReason}），期限 ${state.suppressDuration} 天`,
    }))
    state.suppressDialogOpen = false
    state.notice = `风险 ${riskId} 已抑制，${state.suppressDuration} 天后恢复检测。`
    state.suppressReason = ''
    state.suppressDuration = '1'
    return true
  }

  if (action === 'submit-resolve') {
    const riskId = state.selectedRiskId
    if (!riskId || !state.resolveNote.trim()) return true
    setRiskStatus(riskId, (risk) => ({
      ...risk,
      status: 'RESOLVED',
      resolvedAt: nowText(),
      resolvedBy: '当前用户',
      resolutionNote: state.resolveNote.trim(),
    }))
    state.resolveDialogOpen = false
    state.detailOpen = false
    state.notice = `风险 ${riskId} 已标记为已解决。`
    state.resolveNote = ''
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'close-all') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsAlertsDialogOpen(): boolean {
  return (
    state.detailOpen ||
    state.ackDialogOpen ||
    state.assignDialogOpen ||
    state.suppressDialogOpen ||
    state.resolveDialogOpen
  )
}
