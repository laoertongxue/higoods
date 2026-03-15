import { escapeHtml } from '../utils'

type RoleView = 'my' | 'manager' | 'warehouse' | 'channel' | 'testing'
type TodoType = '全部' | '工作项' | '上架' | '入账' | '样衣'

interface KpiCard {
  id: string
  label: string
  value: number
  unit?: string
  trend: string
  trendUp: boolean
}

interface ExceptionGroup {
  type: string
  count: number
  description: string
}

interface TodoItem {
  id: string
  type: Exclude<TodoType, '全部'>
  title: string
  projectName: string
  dueAt: string
  status: string
  isOverdue: boolean
}

interface RiskProject {
  id: string
  name: string
  phase: string
  owner: string
  riskScore: number
  riskTags: string[]
}

interface StoreHealthItem {
  id: string
  channel: string
  store: string
  authStatus: 'CONNECTED' | 'EXPIRING' | 'EXPIRED' | 'FAILED'
  expireAt: string
  successRate: number
}

interface ListingFailedItem {
  id: string
  product: string
  store: string
  reason: string
  createdAt: string
}

interface MappingIssueItem {
  id: string
  platformId: string
  store: string
  internalBinding: string
  issue: string
}

interface ContentPendingItem {
  id: string
  type: string
  name: string
  account: string
  testItems: number
  owner: string
}

interface PcsOverviewState {
  roleView: RoleView
  dateRange: string
  site: string
  team: string
  channel: string
  store: string
  projectPhase: string
  showMoreFilters: boolean
  todoFilter: TodoType
  lastRefresh: string
  notice: string | null
}

const ROLE_LABELS: Array<{ value: RoleView; label: string }> = [
  { value: 'my', label: '我的概览' },
  { value: 'manager', label: '管理概览' },
  { value: 'warehouse', label: '仓管概览' },
  { value: 'channel', label: '渠道概览' },
  { value: 'testing', label: '测款概览' },
]

const KPI_BY_ROLE: Record<RoleView, KpiCard[]> = {
  my: [
    { id: 'projects', label: '进行中项目', value: 24, trend: '+3', trendUp: true },
    { id: 'blocked', label: '暂不能继续项目', value: 2, trend: '-1', trendUp: true },
    { id: 'overdue', label: '逾期待办', value: 5, trend: '+1', trendUp: false },
    { id: 'mapping', label: '映射异常数', value: 8, trend: '-2', trendUp: true },
  ],
  manager: [
    { id: 'projects', label: '进行中项目', value: 24, trend: '+3', trendUp: true },
    { id: 'listing', label: '上架中任务', value: 12, trend: '+4', trendUp: true },
    { id: 'failed', label: '上架失败/受限', value: 3, trend: '-1', trendUp: true },
    { id: 'risk', label: '高风险项目', value: 3, trend: '+1', trendUp: false },
  ],
  warehouse: [
    { id: 'samples', label: '在库样衣总数', value: 245, unit: '件', trend: '+12', trendUp: true },
    { id: 'pending-receipt', label: '待收货', value: 3, unit: '单', trend: '+1', trendUp: false },
    { id: 'pending-stockin', label: '待入库', value: 2, unit: '单', trend: '0', trendUp: true },
    { id: 'overdue-returns', label: '超期未归还', value: 3, unit: '件', trend: '-1', trendUp: true },
  ],
  channel: [
    { id: 'stores', label: '已连接店铺', value: 3, unit: '家', trend: '+1', trendUp: true },
    { id: 'auth-issues', label: '授权异常', value: 2, unit: '家', trend: '0', trendUp: true },
    { id: 'listing', label: '上架中任务', value: 12, trend: '+4', trendUp: true },
    { id: 'failed', label: '上架失败', value: 3, trend: '-1', trendUp: true },
  ],
  testing: [
    { id: 'live', label: '近7天直播场次', value: 15, trend: '+2', trendUp: true },
    { id: 'video', label: '近7天短视频', value: 28, trend: '+5', trendUp: true },
    { id: 'pending', label: '待入账条目', value: 10, trend: '-2', trendUp: true },
    { id: 'potential', label: '高潜项目', value: 4, trend: '+1', trendUp: true },
  ],
}

const EXCEPTIONS: ExceptionGroup[] = [
  { type: '工作项超期', count: 5, description: '制版、花型与上架环节存在逾期任务' },
  { type: '样衣超期未归还', count: 3, description: '样衣借用超时，影响后续测款与拍摄' },
  { type: '店铺授权过期', count: 2, description: '渠道店铺授权到期或失效，影响上架' },
  { type: '映射异常', count: 4, description: '渠道 SKU 与内部档案映射不完整或冲突' },
  { type: '上架失败', count: 3, description: '图片、类目、价格校验失败导致上架异常' },
  { type: '测款待入账', count: 6, description: '直播/短视频测款结果尚未入账' },
]

const TODOS: TodoItem[] = [
  { id: 'TD-001', type: '工作项', title: '测款结论判定', projectName: 'Y2K银色亮片短裙', dueAt: '2026-01-13 18:00', status: '待处理', isOverdue: false },
  { id: 'TD-002', type: '上架', title: '商品上架审核', projectName: '基础打底针织上衣', dueAt: '2026-01-13 14:00', status: '需审核', isOverdue: true },
  { id: 'TD-003', type: '入账', title: '直播测款入账确认', projectName: '印尼风格碎花连衣裙', dueAt: '2026-01-14 12:00', status: '待处理', isOverdue: false },
  { id: 'TD-004', type: '样衣', title: '样衣归还确认', projectName: '立体花朵上衣', dueAt: '2026-01-13 17:00', status: '待处理', isOverdue: false },
  { id: 'TD-005', type: '工作项', title: '制版评审', projectName: '腰围放量短裙', dueAt: '2026-01-15 10:00', status: '待处理', isOverdue: false },
]

const PROJECT_FUNNEL: Array<{ phase: string; count: number; blocked: number }> = [
  { phase: '测款中', count: 8, blocked: 2 },
  { phase: '制版准备', count: 5, blocked: 1 },
  { phase: '首单样衣打样', count: 4, blocked: 0 },
  { phase: '产前版样衣', count: 3, blocked: 1 },
  { phase: '商品上架', count: 6, blocked: 2 },
  { phase: '在售', count: 12, blocked: 0 },
]

const WORK_ITEM_BOARD = {
  NOT_STARTED: { 改版任务: 3, 制版任务: 2, 花型任务: 1, 首单打样: 2, 产前版: 1, 商品上架: 4 },
  IN_PROGRESS: { 改版任务: 5, 制版任务: 4, 花型任务: 3, 首单打样: 3, 产前版: 2, 商品上架: 6 },
  BLOCKED: { 改版任务: 1, 制版任务: 0, 花型任务: 1, 首单打样: 0, 产前版: 1, 商品上架: 2 },
  COMPLETED: { 改版任务: 12, 制版任务: 15, 花型任务: 10, 首单打样: 8, 产前版: 6, 商品上架: 20 },
}

const TOP_RISK_PROJECTS: RiskProject[] = [
  { id: 'PRJ-004', name: '腰围放量短裙', phase: '产前版样衣', owner: '李娜', riskScore: 15, riskTags: ['超期', '缺样衣'] },
  { id: 'PRJ-002', name: 'Y2K银色亮片短裙', phase: '首单样衣打样', owner: '张丽', riskScore: 12, riskTags: ['暂不能继续', '映射异常'] },
  { id: 'PRJ-005', name: '立体花朵上衣', phase: '商品上架', owner: '陈杰', riskScore: 8, riskTags: ['上架失败'] },
]

const SAMPLE_DISTRIBUTION = {
  shenzhen: { onHand: 156, reserved: 23, borrowed: 18, inTransit: 8, disposal: 3 },
  jakarta: { onHand: 89, reserved: 12, borrowed: 25, inTransit: 5, disposal: 2 },
}

const WAREHOUSE_TODOS = {
  pendingReceipt: [
    { id: 'WH-001', source: '首单打样', trackingNo: 'SF998877', expectedAt: '2026-01-13 14:00', site: '深圳' },
    { id: 'WH-002', source: '产前版', trackingNo: 'JD123456', expectedAt: '2026-01-13 16:00', site: '深圳' },
    { id: 'WH-003', source: '寄回归还', trackingNo: 'YT789012', expectedAt: '2026-01-14 10:00', site: '雅加达' },
  ],
  pendingStockIn: [
    { id: 'WH-004', source: '首单打样', receivedAt: '2026-01-12 15:30', site: '深圳', sampleCount: 3 },
    { id: 'WH-005', source: '产前版', receivedAt: '2026-01-13 09:00', site: '雅加达', sampleCount: 2 },
  ],
}

const OVERDUE_RETURNS = [
  { id: 'OR-001', sampleCode: 'SY-QF-102', borrower: '直播团队-Fiona', expectedReturn: '2026-01-08', overdueDays: 5, location: '雅加达直播间' },
  { id: 'OR-002', sampleCode: 'SY-HX-089', borrower: '摄影棚-阿杰', expectedReturn: '2026-01-11', overdueDays: 2, location: '深圳摄影棚' },
  { id: 'OR-003', sampleCode: 'SY-JK-045', borrower: '外部达人-小美', expectedReturn: '2026-01-10', overdueDays: 3, location: '外借' },
]

const STORE_HEALTH: StoreHealthItem[] = [
  { id: 'ST-001', channel: 'TikTok', store: '印尼旗舰店', authStatus: 'EXPIRING', expireAt: '2026-01-20', successRate: 95.2 },
  { id: 'ST-002', channel: 'TikTok', store: '马来主店', authStatus: 'CONNECTED', expireAt: '2026-03-15', successRate: 98.1 },
  { id: 'ST-003', channel: 'Shopee', store: '印尼主店', authStatus: 'EXPIRED', expireAt: '2026-01-10', successRate: 0 },
  { id: 'ST-004', channel: 'Shopee', store: '菲律宾店', authStatus: 'CONNECTED', expireAt: '2026-04-20', successRate: 92.5 },
  { id: 'ST-005', channel: 'Lazada', store: '印尼店', authStatus: 'FAILED', expireAt: '-', successRate: 0 },
]

const LISTING_PIPELINE = {
  inProgress: 12,
  pendingReview: 5,
  failed: 3,
  recentFailed: [
    { id: 'LST-001', product: '针织上衣-白色', store: 'TikTok印尼店', reason: '图片尺寸不合规', createdAt: '2026-01-12' },
    { id: 'LST-002', product: '吊带背心-黑色', store: 'Shopee主店', reason: '类目选择错误', createdAt: '2026-01-11' },
    { id: 'LST-003', product: '短裙-蓝色', store: 'TikTok马来店', reason: '价格超出范围', createdAt: '2026-01-10' },
  ] as ListingFailedItem[],
}

const MAPPING_HEALTH = {
  total: 245,
  abnormal: 8,
  items: [
    { id: 'MAP-001', platformId: 'TK-12345', store: 'TikTok印尼店', internalBinding: '碎花连衣裙-SPU001', issue: '缺SKU映射' },
    { id: 'MAP-002', platformId: 'SP-67890', store: 'Shopee主店', internalBinding: '亮片短裙-SPU002', issue: '编码冲突' },
    { id: 'MAP-003', platformId: 'TK-11111', store: 'TikTok马来店', internalBinding: '针织上衣-SPU003', issue: '未知SKU' },
  ] as MappingIssueItem[],
}

const CONTENT_ACCOUNTING = {
  liveSessions: { total7d: 15, pendingAccounting: 4 },
  shortVideos: { total7d: 28, pendingAccounting: 6 },
  pendingItems: [
    { id: 'LS-001', type: '直播场次', name: 'LS-20260112-001', account: 'Fiona直播间', testItems: 8, owner: '测款组-小王' },
    { id: 'LS-002', type: '直播场次', name: 'LS-20260111-002', account: '印尼主播间', testItems: 5, owner: '测款组-小李' },
    { id: 'SV-001', type: '短视频', name: 'SV-20260112-003', account: '抖音达人-小美', testItems: 3, owner: '测款组-小王' },
    { id: 'SV-002', type: '短视频', name: 'SV-20260110-005', account: 'TikTok红人-Rina', testItems: 4, owner: '测款组-小李' },
  ] as ContentPendingItem[],
}

const state: PcsOverviewState = {
  roleView: 'my',
  dateRange: '近7天',
  site: '全部',
  team: '全部',
  channel: '全部',
  store: '全部',
  projectPhase: '全部',
  showMoreFilters: false,
  todoFilter: '全部',
  lastRefresh: '2026-01-13 10:30',
  notice: null,
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

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderStatusBadge(status: StoreHealthItem['authStatus']): string {
  if (status === 'CONNECTED') return renderBadge('正常', 'border-green-200 bg-green-50 text-green-700')
  if (status === 'EXPIRING') return renderBadge('即将到期', 'border-amber-200 bg-amber-50 text-amber-700')
  if (status === 'EXPIRED') return renderBadge('已过期', 'border-red-200 bg-red-50 text-red-700')
  return renderBadge('连接失败', 'border-slate-200 bg-slate-100 text-slate-700')
}

function renderRoleTabs(): string {
  return `
    <div class="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
      ${ROLE_LABELS.map((item) => `<button class="inline-flex h-7 items-center rounded-md px-3 text-xs ${state.roleView === item.value ? 'bg-background text-foreground shadow-sm border' : 'text-muted-foreground hover:text-foreground'}" data-pcs-overview-action="set-role" data-role="${item.value}">${escapeHtml(item.label)}</button>`).join('')}
    </div>
  `
}

function renderKpiCards(): string {
  const cards = KPI_BY_ROLE[state.roleView]
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map((card) => {
          const trendClass = card.trendUp ? 'text-green-700' : 'text-red-700'
          const trendIcon = card.trendUp ? '↗' : '↘'
          return `
            <article class="rounded-lg border bg-card p-4">
              <p class="text-xs text-muted-foreground">${escapeHtml(card.label)}</p>
              <p class="mt-1 text-2xl font-semibold">${card.value}${card.unit ?? ''}</p>
              <p class="mt-1 text-xs ${trendClass}">${trendIcon} ${escapeHtml(card.trend)}（较上周）</p>
            </article>
          `
        })
        .join('')}
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">时间范围</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="dateRange">
            ${['今天', '近7天', '近30天'].map((item) => `<option value="${item}" ${state.dateRange === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </div>
        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">站点</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="site">
            ${['全部', '深圳', '雅加达'].map((item) => `<option value="${item}" ${state.site === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </div>
        <div class="w-[160px]">
          <label class="mb-1 block text-xs text-muted-foreground">团队</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="team">
            ${['全部', '商品运营', '样衣仓管', '测款团队'].map((item) => `<option value="${item}" ${state.team === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-overview-action="toggle-more-filters">${state.showMoreFilters ? '收起筛选' : '更多筛选'}</button>
      </div>
      ${
        state.showMoreFilters
          ? `
            <div class="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
              <div class="w-[160px]">
                <label class="mb-1 block text-xs text-muted-foreground">渠道</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="channel">
                  ${['全部', 'TikTok', 'Shopee', 'Lazada'].map((item) => `<option value="${item}" ${state.channel === item ? 'selected' : ''}>${item}</option>`).join('')}
                </select>
              </div>
              <div class="w-[180px]">
                <label class="mb-1 block text-xs text-muted-foreground">店铺</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="store">
                  ${['全部', 'TikTok印尼旗舰店', 'Shopee主店', 'TikTok马来主店'].map((item) => `<option value="${item}" ${state.store === item ? 'selected' : ''}>${item}</option>`).join('')}
                </select>
              </div>
              <div class="w-[180px]">
                <label class="mb-1 block text-xs text-muted-foreground">项目阶段</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-overview-field="projectPhase">
                  ${['全部', '测款中', '制版准备', '首单样衣打样', '产前版样衣', '商品上架', '在售'].map((item) => `<option value="${item}" ${state.projectPhase === item ? 'selected' : ''}>${item}</option>`).join('')}
                </select>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderExceptionAndTodo(): string {
  const todos = state.todoFilter === '全部' ? TODOS : TODOS.filter((item) => item.type === state.todoFilter)
  return `
    <section class="grid gap-3 xl:grid-cols-2">
      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">异常监控</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/pcs/workspace/exceptions">查看异常中心</button>
        </div>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[560px] text-sm">
            <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">类型</th><th class="px-3 py-2 font-medium">数量</th><th class="px-3 py-2 font-medium">说明</th></tr></thead>
            <tbody>
              ${EXCEPTIONS.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2">${escapeHtml(item.type)}</td><td class="px-3 py-2"><span class="${item.count > 0 ? 'font-semibold text-red-700' : 'text-muted-foreground'}">${item.count}</span></td><td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.description)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-base font-semibold">我的待办</h3>
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-overview-field="todoFilter">
            ${['全部', '工作项', '上架', '入账', '样衣'].map((item) => `<option value="${item}" ${state.todoFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
        </div>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[620px] text-sm">
            <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">类型</th><th class="px-3 py-2 font-medium">事项</th><th class="px-3 py-2 font-medium">项目</th><th class="px-3 py-2 font-medium">截止时间</th><th class="px-3 py-2 font-medium">状态</th></tr></thead>
            <tbody>
              ${
                todos.length === 0
                  ? '<tr><td colspan="5" class="px-3 py-10 text-center text-muted-foreground">暂无待办</td></tr>'
                  : todos
                      .map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2">${escapeHtml(item.type)}</td><td class="px-3 py-2">${escapeHtml(item.title)}</td><td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.projectName)}</td><td class="px-3 py-2">${escapeHtml(item.dueAt)}</td><td class="px-3 py-2">${item.isOverdue ? renderBadge('已逾期', 'border-red-200 bg-red-50 text-red-700') : renderBadge(escapeHtml(item.status), 'border-slate-200 bg-slate-50 text-slate-700')}</td></tr>`)
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
}

function renderProjectSection(): string {
  const maxFunnel = Math.max(...PROJECT_FUNNEL.map((item) => item.count))
  const phases = ['改版任务', '制版任务', '花型任务', '首单打样', '产前版', '商品上架'] as const
  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">项目阶段分布</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/pcs/projects">查看项目列表</button>
        </div>
        <div class="space-y-2">
          ${PROJECT_FUNNEL.map((item) => {
            const width = maxFunnel === 0 ? 0 : Math.round((item.count / maxFunnel) * 100)
            return `
              <div class="rounded-md border bg-muted/20 p-2">
                <div class="mb-1 flex items-center justify-between text-xs">
                  <span>${escapeHtml(item.phase)}</span>
                  <span class="font-medium">${item.count}（暂不能继续 ${item.blocked}）</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <span class="block h-full rounded-full bg-blue-600" style="width:${width}%"></span>
                </div>
              </div>
            `
          }).join('')}
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">工作项状态看板</h3>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[620px] text-sm">
            <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">状态</th>${phases.map((phase) => `<th class="px-3 py-2 font-medium">${phase}</th>`).join('')}</tr></thead>
            <tbody>
              ${[
                { key: 'NOT_STARTED', label: '未开始', rowClass: 'text-slate-700' },
                { key: 'IN_PROGRESS', label: '进行中', rowClass: 'text-blue-700' },
                { key: 'BLOCKED', label: '暂不能继续', rowClass: 'text-red-700' },
                { key: 'COMPLETED', label: '已完成', rowClass: 'text-green-700' },
              ]
                .map((status) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-medium ${status.rowClass}">${status.label}</td>${phases.map((phase) => `<td class="px-3 py-2">${(WORK_ITEM_BOARD as Record<string, Record<string, number>>)[status.key][phase]}</td>`).join('')}</tr>`)
                .join('')}
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">风险项目</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/pcs/projects">查看全部</button>
        </div>
        <div class="space-y-2">
          ${TOP_RISK_PROJECTS.map((project) => `<div class="rounded-md border p-3"><div class="mb-1 flex items-center justify-between"><p class="font-medium">${escapeHtml(project.name)}</p><span class="text-xs text-red-700">风险分 ${project.riskScore}</span></div><p class="text-xs text-muted-foreground">阶段：${escapeHtml(project.phase)} · 负责人：${escapeHtml(project.owner)}</p><div class="mt-2 flex flex-wrap gap-1">${project.riskTags.map((tag) => renderBadge(tag, 'border-red-200 bg-red-50 text-red-700')).join('')}</div></div>`).join('')}
        </div>
      </article>
    </section>
  `
}

function renderSampleSection(): string {
  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">样衣资产分布</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/pcs/samples/inventory">查看库存</button>
        </div>
        <div class="space-y-3 text-sm">
          <div class="rounded-md border bg-muted/20 p-3">
            <p class="mb-2 text-xs text-muted-foreground">深圳仓</p>
            <div class="grid grid-cols-2 gap-2">
              <p>在库：<span class="font-medium">${SAMPLE_DISTRIBUTION.shenzhen.onHand}</span></p>
              <p>预留：<span class="font-medium">${SAMPLE_DISTRIBUTION.shenzhen.reserved}</span></p>
              <p>借出：<span class="font-medium">${SAMPLE_DISTRIBUTION.shenzhen.borrowed}</span></p>
              <p>在途：<span class="font-medium">${SAMPLE_DISTRIBUTION.shenzhen.inTransit}</span></p>
            </div>
          </div>
          <div class="rounded-md border bg-muted/20 p-3">
            <p class="mb-2 text-xs text-muted-foreground">雅加达仓</p>
            <div class="grid grid-cols-2 gap-2">
              <p>在库：<span class="font-medium">${SAMPLE_DISTRIBUTION.jakarta.onHand}</span></p>
              <p>预留：<span class="font-medium">${SAMPLE_DISTRIBUTION.jakarta.reserved}</span></p>
              <p>借出：<span class="font-medium">${SAMPLE_DISTRIBUTION.jakarta.borrowed}</span></p>
              <p>在途：<span class="font-medium">${SAMPLE_DISTRIBUTION.jakarta.inTransit}</span></p>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">仓管待处理</h3>
        <div class="space-y-3 text-sm">
          <div>
            <p class="mb-2 text-xs text-muted-foreground">待收货</p>
            <div class="space-y-2">
              ${WAREHOUSE_TODOS.pendingReceipt.map((item) => `<div class="rounded-md border p-2"><p class="font-medium">${escapeHtml(item.id)} · ${escapeHtml(item.source)}</p><p class="text-xs text-muted-foreground">运单：${escapeHtml(item.trackingNo)} · 预计：${escapeHtml(item.expectedAt)} · 站点：${escapeHtml(item.site)}</p></div>`).join('')}
            </div>
          </div>
          <div>
            <p class="mb-2 text-xs text-muted-foreground">待入库</p>
            <div class="space-y-2">
              ${WAREHOUSE_TODOS.pendingStockIn.map((item) => `<div class="rounded-md border p-2"><p class="font-medium">${escapeHtml(item.id)} · ${escapeHtml(item.source)}</p><p class="text-xs text-muted-foreground">签收：${escapeHtml(item.receivedAt)} · 样衣数：${item.sampleCount} · 站点：${escapeHtml(item.site)}</p></div>`).join('')}
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">超期未归还样衣</h3>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[560px] text-sm">
            <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">样衣码</th><th class="px-3 py-2 font-medium">借用人</th><th class="px-3 py-2 font-medium">应还日</th><th class="px-3 py-2 font-medium">超期天数</th></tr></thead>
            <tbody>
              ${OVERDUE_RETURNS.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.sampleCode)}</td><td class="px-3 py-2">${escapeHtml(item.borrower)}</td><td class="px-3 py-2">${escapeHtml(item.expectedReturn)}</td><td class="px-3 py-2 font-medium text-red-700">${item.overdueDays}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
}

function renderChannelSection(): string {
  return `
    <section class="grid gap-3 xl:grid-cols-3">
      <article class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">店铺授权</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="/pcs/channels/stores">店铺管理</button>
        </div>
        <div class="overflow-x-auto rounded-md border">
          <table class="w-full min-w-[560px] text-sm">
            <thead><tr class="border-b bg-muted/40 text-left"><th class="px-3 py-2 font-medium">渠道</th><th class="px-3 py-2 font-medium">店铺</th><th class="px-3 py-2 font-medium">授权状态</th><th class="px-3 py-2 font-medium">成功率</th></tr></thead>
            <tbody>
              ${STORE_HEALTH.map((item) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2">${escapeHtml(item.channel)}</td><td class="px-3 py-2">${escapeHtml(item.store)}</td><td class="px-3 py-2">${renderStatusBadge(item.authStatus)}</td><td class="px-3 py-2">${item.successRate}%</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">上架推进</h3>
        <div class="grid grid-cols-3 gap-2 text-center text-sm">
          <div class="rounded-md border bg-muted/20 p-2"><p class="text-xs text-muted-foreground">上架中</p><p class="mt-1 text-lg font-semibold text-blue-700">${LISTING_PIPELINE.inProgress}</p></div>
          <div class="rounded-md border bg-muted/20 p-2"><p class="text-xs text-muted-foreground">待审核</p><p class="mt-1 text-lg font-semibold text-amber-700">${LISTING_PIPELINE.pendingReview}</p></div>
          <div class="rounded-md border bg-muted/20 p-2"><p class="text-xs text-muted-foreground">失败</p><p class="mt-1 text-lg font-semibold text-red-700">${LISTING_PIPELINE.failed}</p></div>
        </div>
        <div class="mt-3 space-y-2 text-sm">
          ${LISTING_PIPELINE.recentFailed.map((item) => `<div class="rounded-md border p-2"><p class="font-medium">${escapeHtml(item.product)}</p><p class="text-xs text-muted-foreground">${escapeHtml(item.store)} · ${escapeHtml(item.reason)} · ${escapeHtml(item.createdAt)}</p></div>`).join('')}
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">映射与内容入账</h3>
        <div class="mb-3 rounded-md border bg-muted/20 p-2 text-sm">
          <p>映射总量：<span class="font-semibold">${MAPPING_HEALTH.total}</span></p>
          <p>异常数：<span class="font-semibold text-red-700">${MAPPING_HEALTH.abnormal}</span></p>
        </div>
        <div class="space-y-2">
          ${MAPPING_HEALTH.items.map((item) => `<div class="rounded-md border p-2 text-xs"><p class="font-medium">${escapeHtml(item.platformId)} · ${escapeHtml(item.store)}</p><p class="text-muted-foreground">${escapeHtml(item.internalBinding)} · ${escapeHtml(item.issue)}</p></div>`).join('')}
        </div>
        <div class="mt-3 rounded-md border border-dashed p-2 text-xs">
          <p>近7天直播：${CONTENT_ACCOUNTING.liveSessions.total7d} 场，待入账 ${CONTENT_ACCOUNTING.liveSessions.pendingAccounting} 场</p>
          <p>近7天短视频：${CONTENT_ACCOUNTING.shortVideos.total7d} 条，待入账 ${CONTENT_ACCOUNTING.shortVideos.pendingAccounting} 条</p>
        </div>
      </article>
    </section>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-overview-action="clear-notice">知道了</button>
      </div>
    </section>
  `
}

export function renderPcsOverviewPage(): string {
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">概览看板</h1>
          <p class="text-sm text-muted-foreground">商品中心全链路概览，聚合项目推进、样衣资产、渠道健康与异常待办</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderRoleTabs()}
          <span class="text-xs text-muted-foreground">上次刷新：${escapeHtml(state.lastRefresh)}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-overview-action="refresh"><i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-overview-action="export"><i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出</button>
        </div>
      </header>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground">快捷创建</span>
          <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-overview-action="quick-create" data-quick-create-type="商品上架"><i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>发起商品上架</button>
          <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-overview-action="quick-create" data-quick-create-type="样衣使用申请"><i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>发起样衣申请</button>
        </div>
      </section>

      ${renderNotice()}
      ${renderFilters()}
      ${renderKpiCards()}
      ${renderExceptionAndTodo()}
      ${renderProjectSection()}
      ${renderSampleSection()}
      ${renderChannelSection()}
    </div>
  `
}

export function handlePcsOverviewEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-overview-field]')
  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsOverviewField
    if (field === 'dateRange') state.dateRange = fieldNode.value
    if (field === 'site') state.site = fieldNode.value
    if (field === 'team') state.team = fieldNode.value
    if (field === 'channel') state.channel = fieldNode.value
    if (field === 'store') state.store = fieldNode.value
    if (field === 'projectPhase') state.projectPhase = fieldNode.value
    if (field === 'todoFilter') state.todoFilter = fieldNode.value as TodoType
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-overview-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsOverviewAction
  if (!action) return false

  if (action === 'set-role') {
    const role = actionNode.dataset.role as RoleView | undefined
    if (role && ROLE_LABELS.some((item) => item.value === role)) {
      state.roleView = role
    }
    return true
  }

  if (action === 'toggle-more-filters') {
    state.showMoreFilters = !state.showMoreFilters
    return true
  }

  if (action === 'refresh') {
    state.lastRefresh = nowText()
    state.notice = '刷新成功，数据已更新（演示态 Mock 数据）'
    return true
  }

  if (action === 'export') {
    state.notice = '导出任务已创建（演示态），请前往下载中心查看。'
    return true
  }

  if (action === 'quick-create') {
    const type = actionNode.dataset.quickCreateType ?? '任务'
    state.notice = `已发起${type}（演示态），后续将接入实际创建流程。`
    return true
  }

  if (action === 'clear-notice') {
    state.notice = null
    return true
  }

  return false
}
