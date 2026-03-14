import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

type TodoType = 'WORK_ITEM' | 'APPROVAL' | 'SAMPLE' | 'LISTING' | 'STORE_AUTH' | 'MAPPING' | 'TEST_ACCOUNTING'
type Priority = 'P0' | 'P1' | 'P2' | 'P3'
type RoleKey = 'PM' | 'TESTING' | 'PATTERN' | 'CHANNEL' | 'WAREHOUSE' | 'MANAGER'
type TabId = 'all' | 'mine' | 'approval' | 'overdue' | 'blocked' | 'warehouse' | 'channel' | 'accounting'
type SiteFilter = 'all' | '深圳' | '雅加达'

interface TodoAction {
  label: string
  url: string
}

interface TodoItem {
  id: string
  todoType: TodoType
  title: string
  sourceType: string
  sourceId: string
  sourceCode: string
  sourceStatus: string
  priority: Priority
  dueAt: string | null
  overdueDays: number
  owner?: string
  assignee?: string
  project?: string
  projectId?: string
  phase?: string
  site?: '深圳' | '雅加达'
  primaryAction: TodoAction
  secondaryActions: Array<{ label: string; code: string }>
  createdAt: string
  tags: string[]
  channel?: string
  store?: string
  account?: string
}

interface QueueDef {
  label: string
  icon: string
  roles: Array<RoleKey | 'all'>
}

type QueueKey = keyof typeof QUEUES

interface ViewComponentSetting {
  id: 'kpi' | 'queue' | 'list'
  label: string
  enabled: boolean
}

interface PcsTodosState {
  currentRole: RoleKey
  activeTab: TabId
  activeQueue: QueueKey | null
  searchTerm: string
  typeFilter: 'all' | TodoType
  priorityFilter: 'all' | Priority
  siteFilter: SiteFilter
  selectedTodoIds: string[]
  detailTodoId: string | null
  configOpen: boolean
  lastRefresh: string
  notice: string | null
  showQueue: boolean
  configComponents: ViewComponentSetting[]
  defaultSite: SiteFilter
  defaultPriority: 'all' | Priority
}

const TODO_TYPE_META: Record<TodoType, { label: string; icon: string; className: string }> = {
  WORK_ITEM: { label: '工作项', icon: 'file-text', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  APPROVAL: { label: '审核', icon: 'shield', className: 'border-purple-200 bg-purple-50 text-purple-700' },
  SAMPLE: { label: '样衣', icon: 'package', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  LISTING: { label: '上架', icon: 'store', className: 'border-green-200 bg-green-50 text-green-700' },
  STORE_AUTH: { label: '店铺授权', icon: 'store', className: 'border-red-200 bg-red-50 text-red-700' },
  MAPPING: { label: '映射', icon: 'git-branch', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  TEST_ACCOUNTING: { label: '入账', icon: 'receipt', className: 'border-pink-200 bg-pink-50 text-pink-700' },
}

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  P0: { label: 'P0', className: 'border-red-600 bg-red-600 text-white' },
  P1: { label: 'P1', className: 'border-orange-500 bg-orange-500 text-white' },
  P2: { label: 'P2', className: 'border-amber-500 bg-amber-500 text-white' },
  P3: { label: 'P3', className: 'border-slate-400 bg-slate-400 text-white' },
}

const ROLES: Record<RoleKey, { label: string; defaultTab: TabId; defaultQueue: QueueKey | null }> = {
  PM: { label: '项目负责人', defaultTab: 'all', defaultQueue: 'today' },
  TESTING: { label: '测款团队', defaultTab: 'accounting', defaultQueue: 'live_accounting' },
  PATTERN: { label: '版房/制版/花型', defaultTab: 'mine', defaultQueue: null },
  CHANNEL: { label: '渠道运营', defaultTab: 'channel', defaultQueue: 'auth_error' },
  WAREHOUSE: { label: '仓管', defaultTab: 'warehouse', defaultQueue: 'to_receive' },
  MANAGER: { label: '管理层', defaultTab: 'approval', defaultQueue: 'urgent' },
}

const QUEUES = {
  urgent: { label: 'P0 紧急', icon: 'alert-circle', roles: ['all'] },
  today: { label: '今日到期', icon: 'timer', roles: ['all'] },
  this_week: { label: '本周到期', icon: 'calendar', roles: ['all'] },
  approval: { label: '待我审核', icon: 'shield', roles: ['all'] },
  to_receive: { label: '待到样签收', icon: 'package', roles: ['WAREHOUSE'] },
  to_stock_in: { label: '待核对入库', icon: 'package', roles: ['WAREHOUSE'] },
  to_ship: { label: '待寄出', icon: 'package', roles: ['WAREHOUSE'] },
  to_confirm: { label: '待签收', icon: 'package', roles: ['WAREHOUSE'] },
  to_dispose: { label: '待处置', icon: 'package', roles: ['WAREHOUSE'] },
  return_processing: { label: '退货处理中', icon: 'package', roles: ['WAREHOUSE'] },
  auth_error: { label: '店铺授权异常', icon: 'triangle-alert', roles: ['CHANNEL'] },
  listing_failed: { label: '上架失败', icon: 'circle-x', roles: ['CHANNEL'] },
  listing_pending: { label: '上架中待跟进', icon: 'clock-3', roles: ['CHANNEL'] },
  mapping_error: { label: '映射异常', icon: 'git-branch', roles: ['CHANNEL'] },
  live_accounting: { label: '直播待入账', icon: 'receipt', roles: ['TESTING'] },
  video_accounting: { label: '短视频待入账', icon: 'receipt', roles: ['TESTING'] },
  test_decision: { label: '测款结论待决策', icon: 'file-text', roles: ['TESTING'] },
} as const satisfies Record<string, QueueDef>

const TODOS: TodoItem[] = [
  {
    id: 'TD-001',
    todoType: 'WORK_ITEM',
    title: '改版任务：V领印花连衣裙-袖笼弧线优化',
    sourceType: 'RevisionTask',
    sourceId: 'RT-20260115-001',
    sourceCode: 'RT-20260115-001',
    sourceStatus: '进行中',
    priority: 'P1',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '王版师',
    assignee: '王版师',
    project: '印尼风格碎花连衣裙',
    projectId: 'PRJ-20251216-001',
    phase: '制版与生产准备',
    site: '深圳',
    primaryAction: { label: '去处理', url: '/patterns/revision' },
    secondaryActions: [{ label: '提交评审', code: 'submit_review' }],
    createdAt: '2026-01-10 09:00',
    tags: ['改版', '制版'],
  },
  {
    id: 'TD-002',
    todoType: 'WORK_ITEM',
    title: '花型任务：热带花卉印花-色彩方案确认',
    sourceType: 'ArtworkTask',
    sourceId: 'AT-20260112-001',
    sourceCode: 'AT-20260112-001',
    sourceStatus: '待评审',
    priority: 'P0',
    dueAt: '2026-01-13',
    overdueDays: 1,
    owner: '花型设计师',
    assignee: '花型设计师',
    project: '印尼风格碎花连衣裙',
    projectId: 'PRJ-20251216-001',
    phase: '制版与生产准备',
    site: '深圳',
    primaryAction: { label: '去处理', url: '/patterns/colors' },
    secondaryActions: [{ label: '冻结通过', code: 'freeze' }],
    createdAt: '2026-01-08 10:30',
    tags: ['花型', '设计'],
  },
  {
    id: 'TD-003',
    todoType: 'APPROVAL',
    title: '审核：首单样衣打样-FS-20260110-001',
    sourceType: 'FirstSampleTask',
    sourceId: 'FS-20260110-001',
    sourceCode: 'FS-20260110-001',
    sourceStatus: '待审核',
    priority: 'P1',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '李明',
    project: '基础款白色T恤',
    projectId: 'PRJ-20251218-002',
    phase: '制版与生产准备',
    site: '深圳',
    primaryAction: { label: '去审核', url: '/samples/first-order/FS-20260110-001' },
    secondaryActions: [
      { label: '同意', code: 'approve' },
      { label: '驳回', code: 'reject' },
    ],
    createdAt: '2026-01-12 14:00',
    tags: ['审核', '打样'],
  },
  {
    id: 'TD-004',
    todoType: 'SAMPLE',
    title: '待到样签收：样衣 SMP-20260108-001',
    sourceType: 'SampleAsset',
    sourceId: 'SMP-20260108-001',
    sourceCode: 'SMP-20260108-001',
    sourceStatus: '在途',
    priority: 'P1',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '仓管员A',
    site: '深圳',
    primaryAction: { label: '到样签收', url: '/samples/inventory' },
    secondaryActions: [],
    createdAt: '2026-01-10 08:00',
    tags: ['样衣', '签收'],
  },
  {
    id: 'TD-005',
    todoType: 'SAMPLE',
    title: '待核对入库：样衣 SMP-20260105-002',
    sourceType: 'SampleAsset',
    sourceId: 'SMP-20260105-002',
    sourceCode: 'SMP-20260105-002',
    sourceStatus: '已签收待入库',
    priority: 'P2',
    dueAt: '2026-01-15',
    overdueDays: 0,
    owner: '仓管员A',
    site: '深圳',
    primaryAction: { label: '核对入库', url: '/samples/inventory' },
    secondaryActions: [],
    createdAt: '2026-01-08 16:00',
    tags: ['样衣', '入库'],
  },
  {
    id: 'TD-006',
    todoType: 'SAMPLE',
    title: '超期未归还：样衣 SMP-20251220-003',
    sourceType: 'SampleAsset',
    sourceId: 'SMP-20251220-003',
    sourceCode: 'SMP-20251220-003',
    sourceStatus: '使用中',
    priority: 'P0',
    dueAt: '2026-01-10',
    overdueDays: 4,
    owner: '测款团队A',
    site: '雅加达',
    primaryAction: { label: '发起归还', url: '/samples/application' },
    secondaryActions: [],
    createdAt: '2025-12-20 10:00',
    tags: ['样衣', '逾期'],
  },
  {
    id: 'TD-007',
    todoType: 'TEST_ACCOUNTING',
    title: '直播待入账：LS-20260112-001 印尼专场',
    sourceType: 'LiveSession',
    sourceId: 'LS-20260112-001',
    sourceCode: 'LS-20260112-001',
    sourceStatus: '已关账',
    priority: 'P1',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '直播运营A',
    account: '@indo_fashion',
    primaryAction: { label: '去入账', url: '/testing/live/LS-20260112-001' },
    secondaryActions: [],
    createdAt: '2026-01-12 22:00',
    tags: ['直播', '入账'],
  },
  {
    id: 'TD-008',
    todoType: 'TEST_ACCOUNTING',
    title: '短视频待入账：SV-20260111-002 穿搭分享',
    sourceType: 'ShortVideoRecord',
    sourceId: 'SV-20260111-002',
    sourceCode: 'SV-20260111-002',
    sourceStatus: '已关账',
    priority: 'P2',
    dueAt: '2026-01-16',
    overdueDays: 0,
    owner: '短视频运营B',
    account: '@fashion_daily',
    primaryAction: { label: '去入账', url: '/testing/video/SV-20260111-002' },
    secondaryActions: [],
    createdAt: '2026-01-11 18:00',
    tags: ['短视频', '入账'],
  },
  {
    id: 'TD-009',
    todoType: 'STORE_AUTH',
    title: '授权将过期：TikTok Shop Indo-01',
    sourceType: 'ChannelStore',
    sourceId: 'STORE-TK-001',
    sourceCode: 'STORE-TK-001',
    sourceStatus: '授权将过期',
    priority: 'P1',
    dueAt: '2026-01-20',
    overdueDays: 0,
    owner: '渠道运营A',
    channel: 'TikTok',
    store: 'Indo Fashion Official',
    primaryAction: { label: '去授权', url: '/channels/stores/STORE-TK-001' },
    secondaryActions: [{ label: '刷新授权', code: 'refresh' }],
    createdAt: '2026-01-10 09:00',
    tags: ['店铺', '授权'],
  },
  {
    id: 'TD-010',
    todoType: 'STORE_AUTH',
    title: '授权已过期：Shopee MY-02',
    sourceType: 'ChannelStore',
    sourceId: 'STORE-SP-002',
    sourceCode: 'STORE-SP-002',
    sourceStatus: '授权已过期',
    priority: 'P0',
    dueAt: '2026-01-12',
    overdueDays: 2,
    owner: '渠道运营B',
    channel: 'Shopee',
    store: 'Fashion Hub MY',
    primaryAction: { label: '去授权', url: '/channels/stores/STORE-SP-002' },
    secondaryActions: [],
    createdAt: '2026-01-08 10:00',
    tags: ['店铺', '过期'],
  },
  {
    id: 'TD-011',
    todoType: 'MAPPING',
    title: '映射异常：SKU缺失 - CP-20260110-001',
    sourceType: 'ChannelProduct',
    sourceId: 'CP-20260110-001',
    sourceCode: 'CP-20260110-001',
    sourceStatus: '映射不完整',
    priority: 'P2',
    dueAt: null,
    overdueDays: 0,
    owner: '渠道运营A',
    channel: 'TikTok',
    store: 'Indo Fashion Official',
    primaryAction: { label: '去修复', url: '/channels/products/mapping' },
    secondaryActions: [],
    createdAt: '2026-01-10 14:00',
    tags: ['映射', 'SKU'],
  },
  {
    id: 'TD-012',
    todoType: 'MAPPING',
    title: '映射冲突：编码重复 - CP-20260109-003',
    sourceType: 'CodeMapping',
    sourceId: 'MAP-CONFLICT-001',
    sourceCode: 'MAP-CONFLICT-001',
    sourceStatus: '冲突待处理',
    priority: 'P1',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '渠道运营B',
    channel: 'Shopee',
    primaryAction: { label: '去修复', url: '/channels/products/mapping' },
    secondaryActions: [],
    createdAt: '2026-01-09 11:00',
    tags: ['映射', '冲突'],
  },
  {
    id: 'TD-013',
    todoType: 'WORK_ITEM',
    title: '制版任务：夏季牛仔短裤-初版制版',
    sourceType: 'PatternTask',
    sourceId: 'PT-20260108-001',
    sourceCode: 'PT-20260108-001',
    sourceStatus: '未开始',
    priority: 'P3',
    dueAt: '2026-01-18',
    overdueDays: 0,
    owner: '王版师',
    assignee: '王版师',
    project: '夏季牛仔短裤',
    projectId: 'PRJ-20251215-003',
    phase: '制版与生产准备',
    site: '深圳',
    primaryAction: { label: '去处理', url: '/patterns' },
    secondaryActions: [{ label: '开始', code: 'start' }],
    createdAt: '2026-01-08 09:00',
    tags: ['制版'],
  },
  {
    id: 'TD-014',
    todoType: 'WORK_ITEM',
    title: '产前版样衣：复古风皮夹克-产前验收',
    sourceType: 'PreProductionSample',
    sourceId: 'PP-20260105-001',
    sourceCode: 'PP-20260105-001',
    sourceStatus: '验收中',
    priority: 'P2',
    dueAt: '2026-01-16',
    overdueDays: 0,
    owner: '李品控',
    assignee: '李品控',
    project: '复古风皮夹克',
    projectId: 'PRJ-20251210-004',
    phase: '制版与生产准备',
    site: '深圳',
    primaryAction: { label: '去处理', url: '/production/pre-check/PP-20260105-001' },
    secondaryActions: [{ label: '填写结论', code: 'conclusion' }],
    createdAt: '2026-01-05 14:00',
    tags: ['产前', '验收'],
  },
  {
    id: 'TD-015',
    todoType: 'LISTING',
    title: '上架失败：基础款白色T恤-TikTok',
    sourceType: 'ListingTask',
    sourceId: 'LT-20260112-001',
    sourceCode: 'LT-20260112-001',
    sourceStatus: '上架失败',
    priority: 'P0',
    dueAt: '2026-01-14',
    overdueDays: 0,
    owner: '渠道运营A',
    channel: 'TikTok',
    store: 'Indo Fashion Official',
    primaryAction: { label: '去处理', url: '/channels/products/CP-20260112-001' },
    secondaryActions: [{ label: '重新上架', code: 'retry' }],
    createdAt: '2026-01-12 16:00',
    tags: ['上架', '失败'],
  },
]

const state: PcsTodosState = {
  currentRole: 'PM',
  activeTab: 'all',
  activeQueue: null,
  searchTerm: '',
  typeFilter: 'all',
  priorityFilter: 'all',
  siteFilter: 'all',
  selectedTodoIds: [],
  detailTodoId: null,
  configOpen: false,
  lastRefresh: nowText(),
  notice: null,
  showQueue: true,
  configComponents: [
    { id: 'kpi', label: 'KPI统计', enabled: true },
    { id: 'queue', label: '队列导航', enabled: true },
    { id: 'list', label: '待办列表', enabled: true },
  ],
  defaultSite: 'all',
  defaultPriority: 'all',
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

function resolveDemoPath(url: string): string {
  const raw = url.trim()
  const lower = raw.toLowerCase()

  if (lower.startsWith('/pcs/')) return raw
  if (lower.startsWith('/projects')) return '/pcs/projects'
  if (lower.startsWith('/work-items')) return '/pcs/work-items'
  if (lower.startsWith('/patterns/revision')) return '/pcs/patterns/revision'
  if (lower.startsWith('/patterns/colors')) return '/pcs/patterns/colors'
  if (lower.startsWith('/patterns')) return '/pcs/patterns'
  if (lower.startsWith('/testing/live')) return '/pcs/testing/live'
  if (lower.startsWith('/testing/video')) return '/pcs/testing/video'
  if (lower.startsWith('/channels/stores')) return '/pcs/channels/stores'
  if (lower.startsWith('/channels/products')) return '/pcs/channels/products'
  if (lower.startsWith('/samples/inventory')) return '/pcs/samples/inventory'
  if (lower.startsWith('/samples/transfer')) return '/pcs/samples/transfer'
  if (lower.startsWith('/samples/application')) return '/pcs/samples/application'
  if (lower.startsWith('/samples/first-order')) return '/pcs/samples/first-order'
  if (lower.startsWith('/production/pre-check')) return '/pcs/production/pre-check'

  return '/pcs/workspace/overview'
}

function hasEnabledComponent(componentId: ViewComponentSetting['id']): boolean {
  return state.configComponents.find((item) => item.id === componentId)?.enabled ?? false
}

function getTabsByRole(role: RoleKey): Array<{ id: TabId; label: string }> {
  const base: Array<{ id: TabId; label: string }> = [
    { id: 'all', label: '全部待办' },
    { id: 'mine', label: '我负责' },
    { id: 'approval', label: '待我审核' },
    { id: 'overdue', label: '即将逾期/已逾期' },
    { id: 'blocked', label: '阻塞我' },
  ]
  if (role === 'WAREHOUSE') base.push({ id: 'warehouse', label: '仓管队列' })
  if (role === 'CHANNEL') base.push({ id: 'channel', label: '渠道队列' })
  if (role === 'TESTING') base.push({ id: 'accounting', label: '测款入账' })
  return base
}

function getVisibleQueues(role: RoleKey): Array<[QueueKey, QueueDef]> {
  return (Object.entries(QUEUES) as Array<[QueueKey, QueueDef]>).filter(
    ([, queue]) => queue.roles.includes('all') || queue.roles.includes(role),
  )
}

function isTodoInTab(todo: TodoItem, tab: TabId): boolean {
  if (tab === 'all') return true
  if (tab === 'mine') return todo.todoType === 'WORK_ITEM'
  if (tab === 'approval') return todo.todoType === 'APPROVAL'
  if (tab === 'overdue') return todo.overdueDays > 0
  if (tab === 'blocked') return todo.sourceStatus === '阻塞' || todo.sourceStatus === '上架失败'
  if (tab === 'warehouse') return todo.todoType === 'SAMPLE'
  if (tab === 'channel') return todo.todoType === 'STORE_AUTH' || todo.todoType === 'MAPPING' || todo.todoType === 'LISTING'
  if (tab === 'accounting') return todo.todoType === 'TEST_ACCOUNTING'
  return true
}

function isTodoInQueue(todo: TodoItem, queueKey: QueueKey): boolean {
  if (queueKey === 'urgent') return todo.priority === 'P0'
  if (queueKey === 'today') return todo.dueAt === '2026-01-14'
  if (queueKey === 'this_week') return !!todo.dueAt && todo.dueAt >= '2026-01-14' && todo.dueAt <= '2026-01-20'
  if (queueKey === 'approval') return todo.todoType === 'APPROVAL'
  if (queueKey === 'to_receive') return todo.title.includes('待到样签收')
  if (queueKey === 'to_stock_in') return todo.title.includes('待核对入库')
  if (queueKey === 'to_ship') return todo.title.includes('待寄出')
  if (queueKey === 'to_confirm') return todo.title.includes('待签收')
  if (queueKey === 'to_dispose') return todo.title.includes('待处置')
  if (queueKey === 'return_processing') return todo.title.includes('退货处理')
  if (queueKey === 'auth_error') return todo.todoType === 'STORE_AUTH'
  if (queueKey === 'listing_failed') return todo.sourceStatus === '上架失败'
  if (queueKey === 'listing_pending') return todo.todoType === 'LISTING'
  if (queueKey === 'mapping_error') return todo.todoType === 'MAPPING'
  if (queueKey === 'live_accounting') return todo.sourceType === 'LiveSession'
  if (queueKey === 'video_accounting') return todo.sourceType === 'ShortVideoRecord'
  if (queueKey === 'test_decision') return todo.title.includes('测款结论')
  return true
}

function getFilteredTodos(): TodoItem[] {
  const keyword = state.searchTerm.trim().toLowerCase()
  const priorityOrder: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

  const rows = TODOS.filter((todo) => {
    if (!isTodoInTab(todo, state.activeTab)) return false
    if (state.activeQueue && !isTodoInQueue(todo, state.activeQueue)) return false
    if (state.typeFilter !== 'all' && todo.todoType !== state.typeFilter) return false
    if (state.priorityFilter !== 'all' && todo.priority !== state.priorityFilter) return false
    if (state.siteFilter !== 'all' && todo.site !== state.siteFilter) return false

    if (!keyword) return true
    const haystack = `${todo.title} ${todo.sourceCode} ${todo.project ?? ''}`.toLowerCase()
    return haystack.includes(keyword)
  })

  rows.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }

    if (a.dueAt && b.dueAt) {
      return a.dueAt.localeCompare(b.dueAt)
    }
    if (a.dueAt && !b.dueAt) return -1
    if (!a.dueAt && b.dueAt) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })

  return rows
}

function getQueueCount(queueKey: QueueKey): number {
  return TODOS.filter((todo) => isTodoInQueue(todo, queueKey)).length
}

function getStats() {
  return {
    total: TODOS.length,
    p0: TODOS.filter((item) => item.priority === 'P0').length,
    p1: TODOS.filter((item) => item.priority === 'P1').length,
    overdue: TODOS.filter((item) => item.overdueDays > 0).length,
    approval: TODOS.filter((item) => item.todoType === 'APPROVAL').length,
    sample: TODOS.filter((item) => item.todoType === 'SAMPLE').length,
    accounting: TODOS.filter((item) => item.todoType === 'TEST_ACCOUNTING').length,
    channel: TODOS.filter((item) => item.todoType === 'STORE_AUTH' || item.todoType === 'MAPPING' || item.todoType === 'LISTING').length,
  }
}

function getTodoById(todoId: string | null): TodoItem | null {
  if (!todoId) return null
  return TODOS.find((item) => item.id === todoId) ?? null
}

function isTodoSelected(todoId: string): boolean {
  return state.selectedTodoIds.includes(todoId)
}

function setRole(role: RoleKey): void {
  state.currentRole = role
  const roleConfig = ROLES[role]
  state.activeTab = roleConfig.defaultTab
  state.activeQueue = roleConfig.defaultQueue
  state.selectedTodoIds = []
}

function resetFilters(): void {
  state.searchTerm = ''
  state.typeFilter = 'all'
  state.priorityFilter = 'all'
  state.siteFilter = 'all'
}

function closeDetail(): void {
  state.detailTodoId = null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-todo-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderKpiSection(): string {
  if (!hasEnabledComponent('kpi')) return ''
  const stats = getStats()
  return `
    <section class="grid gap-3 md:grid-cols-5">
      <article class="rounded-lg border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">全部待办</p>
        <p class="mt-1 text-2xl font-semibold">${stats.total}</p>
      </article>
      <article class="rounded-lg border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">P0 紧急</p>
        <p class="mt-1 text-2xl font-semibold text-red-700">${stats.p0}</p>
      </article>
      <article class="rounded-lg border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">待审核</p>
        <p class="mt-1 text-2xl font-semibold text-blue-700">${stats.approval}</p>
      </article>
      <article class="rounded-lg border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">逾期待办</p>
        <p class="mt-1 text-2xl font-semibold text-amber-700">${stats.overdue}</p>
      </article>
      <article class="rounded-lg border bg-card px-4 py-3">
        <p class="text-xs text-muted-foreground">渠道异常</p>
        <p class="mt-1 text-2xl font-semibold text-cyan-700">${stats.channel}</p>
      </article>
    </section>
  `
}

function renderTabs(): string {
  const stats = getStats()
  const tabs = getTabsByRole(state.currentRole)

  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="flex flex-wrap items-center gap-1">
        ${tabs
          .map((tab) => {
            const active = state.activeTab === tab.id
            return `
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-transparent hover:bg-muted'}"
                data-pcs-todo-action="set-tab"
                data-tab-id="${tab.id}"
              >
                ${escapeHtml(tab.label)}
                ${
                  tab.id === 'overdue' && stats.overdue > 0
                    ? `<span class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-red-300 bg-red-50 px-1 text-[11px] text-red-700">${stats.overdue}</span>`
                    : ''
                }
                ${
                  tab.id === 'approval' && stats.approval > 0
                    ? `<span class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-1 text-[11px] text-slate-700">${stats.approval}</span>`
                    : ''
                }
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderFilters(): string {
  const typeOptions: Array<{ value: PcsTodosState['typeFilter']; label: string }> = [
    { value: 'all', label: '全部类型' },
    { value: 'WORK_ITEM', label: '工作项' },
    { value: 'APPROVAL', label: '审核' },
    { value: 'SAMPLE', label: '样衣' },
    { value: 'LISTING', label: '上架' },
    { value: 'STORE_AUTH', label: '店铺授权' },
    { value: 'MAPPING', label: '映射' },
    { value: 'TEST_ACCOUNTING', label: '入账' },
  ]

  const priorityOptions: Array<{ value: PcsTodosState['priorityFilter']; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'P0', label: 'P0 紧急' },
    { value: 'P1', label: 'P1 高' },
    { value: 'P2', label: 'P2 中' },
    { value: 'P3', label: 'P3 低' },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[220px] flex-1">
          <label class="mb-1 block text-xs text-muted-foreground">搜索</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input
              class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              value="${escapeHtml(state.searchTerm)}"
              placeholder="搜索标题、编号、项目..."
              data-pcs-todo-field="searchTerm"
            />
          </div>
        </div>
        <div class="w-[170px]">
          <label class="mb-1 block text-xs text-muted-foreground">待办类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-todo-field="typeFilter">
            ${typeOptions.map((option) => `<option value="${option.value}" ${state.typeFilter === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">优先级</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-todo-field="priorityFilter">
            ${priorityOptions.map((option) => `<option value="${option.value}" ${state.priorityFilter === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="w-[140px]">
          <label class="mb-1 block text-xs text-muted-foreground">站点</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-todo-field="siteFilter">
            <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
            <option value="深圳" ${state.siteFilter === '深圳' ? 'selected' : ''}>深圳</option>
            <option value="雅加达" ${state.siteFilter === '雅加达' ? 'selected' : ''}>雅加达</option>
          </select>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-todo-action="reset-filters">重置</button>
      </div>
    </section>
  `
}

function renderQueuePanel(): string {
  if (!state.showQueue || !hasEnabledComponent('queue')) return ''

  const visibleQueues = getVisibleQueues(state.currentRole)
  return `
    <aside class="w-full rounded-lg border bg-card p-2 xl:w-60">
      <h3 class="px-2 pb-2 text-sm font-medium">队列</h3>
      <div class="space-y-1">
        <button
          class="flex h-8 w-full items-center rounded-md px-2 text-sm ${state.activeQueue === null ? 'bg-muted font-medium' : 'hover:bg-muted'}"
          data-pcs-todo-action="set-queue"
          data-queue-key=""
        >
          <i data-lucide="inbox" class="mr-2 h-4 w-4"></i>
          全部
          <span class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border bg-background px-1 text-[11px]">${TODOS.length}</span>
        </button>
        ${visibleQueues
          .map(([key, queue]) => {
            const count = getQueueCount(key)
            return `
              <button
                class="flex h-8 w-full items-center rounded-md px-2 text-sm ${state.activeQueue === key ? 'bg-muted font-medium' : 'hover:bg-muted'}"
                data-pcs-todo-action="set-queue"
                data-queue-key="${key}"
              >
                <i data-lucide="${queue.icon}" class="mr-2 h-4 w-4"></i>
                ${escapeHtml(queue.label)}
                ${
                  count > 0
                    ? `<span class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border ${key === 'urgent' ? 'border-red-300 bg-red-50 text-red-700' : 'bg-background'} px-1 text-[11px]">${count}</span>`
                    : ''
                }
              </button>
            `
          })
          .join('')}
      </div>
    </aside>
  `
}

function renderTodoRow(todo: TodoItem): string {
  const typeMeta = TODO_TYPE_META[todo.todoType]
  const priorityMeta = PRIORITY_META[todo.priority]
  const selected = isTodoSelected(todo.id)

  return `
    <article
      class="rounded-lg border p-4 transition-colors ${selected ? 'border-blue-300 bg-blue-50/60' : 'bg-card hover:bg-muted/40'}"
      data-pcs-todo-action="open-detail"
      data-todo-id="${escapeHtml(todo.id)}"
    >
      <div class="flex items-start gap-3">
        <input
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border"
          ${selected ? 'checked' : ''}
          data-pcs-todo-action="toggle-select"
          data-todo-id="${escapeHtml(todo.id)}"
        />
        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-2">
            ${renderBadge(priorityMeta.label, priorityMeta.className)}
            <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${typeMeta.className}">
              <i data-lucide="${typeMeta.icon}" class="h-3 w-3"></i>
              ${escapeHtml(typeMeta.label)}
            </span>
            <h4 class="text-sm font-medium">${escapeHtml(todo.title)}</h4>
            ${
              todo.overdueDays > 0
                ? renderBadge(`逾期${todo.overdueDays}天`, 'border-red-300 bg-red-50 text-red-700')
                : ''
            }
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1"><i data-lucide="file-text" class="h-3 w-3"></i>${escapeHtml(todo.sourceCode)}</span>
            ${renderBadge(todo.sourceStatus, 'border-slate-200 bg-slate-50 text-slate-700')}
            ${todo.dueAt ? `<span class="inline-flex items-center gap-1"><i data-lucide="calendar" class="h-3 w-3"></i>截止：${escapeHtml(todo.dueAt)}</span>` : ''}
            ${todo.project ? `<span class="inline-flex items-center gap-1"><i data-lucide="folder-kanban" class="h-3 w-3"></i>${escapeHtml(todo.project)}</span>` : ''}
            ${todo.owner ? `<span class="inline-flex items-center gap-1"><i data-lucide="user" class="h-3 w-3"></i>${escapeHtml(todo.owner)}</span>` : ''}
            ${todo.site ? `<span>${escapeHtml(todo.site)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50"
            data-pcs-todo-action="go-process"
            data-url="${escapeHtml(todo.primaryAction.url)}"
          >
            ${escapeHtml(todo.primaryAction.label)}
            <i data-lucide="arrow-right" class="ml-1 h-3 w-3"></i>
          </button>
          <button
            class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted"
            data-pcs-todo-action="open-detail"
            data-todo-id="${escapeHtml(todo.id)}"
          >
            详情
          </button>
        </div>
      </div>
    </article>
  `
}

function renderTodoListSection(): string {
  if (!hasEnabledComponent('list')) {
    return '<section class="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">待办列表组件已在视图配置中关闭。</section>'
  }

  const rows = getFilteredTodos()
  const allSelected = rows.length > 0 && rows.every((item) => state.selectedTodoIds.includes(item.id))

  return `
    <section class="flex-1 rounded-lg border bg-card">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 class="text-base font-semibold">待办列表 <span class="text-sm font-normal text-muted-foreground">(${rows.length})</span></h3>
        <div class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border"
            ${allSelected ? 'checked' : ''}
            data-pcs-todo-action="toggle-select-all"
          />
          <span class="text-muted-foreground">全选</span>
          ${
            state.selectedTodoIds.length > 0
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="export-selected">批量导出（${state.selectedTodoIds.length}）</button>`
              : ''
          }
        </div>
      </header>
      <div class="space-y-2 p-4">
        ${
          rows.length === 0
            ? `
              <div class="rounded-lg border border-dashed px-4 py-12 text-center">
                <i data-lucide="check-circle-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
                <p class="mt-3 text-sm text-muted-foreground">当前没有待办</p>
                <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="go-process" data-url="/testing/live">新建直播场次</button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="go-process" data-url="/channels/products">发起上架</button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="go-process" data-url="/projects">查看项目</button>
                </div>
              </div>
            `
            : rows.map((todo) => renderTodoRow(todo)).join('')
        }
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const todo = getTodoById(state.detailTodoId)
  if (!todo) return ''

  const typeMeta = TODO_TYPE_META[todo.todoType]
  const priorityMeta = PRIORITY_META[todo.priority]

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pcs-todo-action="close-detail" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[560px]">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                ${renderBadge(priorityMeta.label, priorityMeta.className)}
                <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${typeMeta.className}">
                  <i data-lucide="${typeMeta.icon}" class="h-3 w-3"></i>
                  ${escapeHtml(typeMeta.label)}
                </span>
              </div>
              <h2 class="text-base font-semibold">${escapeHtml(todo.title)}</h2>
              <p class="text-xs text-muted-foreground">
                ${escapeHtml(todo.sourceCode)}
                <button class="ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted" data-pcs-todo-action="copy-code" data-source-code="${escapeHtml(todo.sourceCode)}" aria-label="复制编号">
                  <i data-lucide="copy" class="h-3 w-3"></i>
                </button>
              </p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-todo-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-4">
          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">关键信息</h3>
            <div class="grid gap-3 text-sm sm:grid-cols-2">
              <div><p class="text-xs text-muted-foreground">状态</p><p class="mt-1 font-medium">${escapeHtml(todo.sourceStatus)}</p></div>
              <div><p class="text-xs text-muted-foreground">截止时间</p><p class="mt-1 font-medium">${escapeHtml(todo.dueAt ?? '-')}</p></div>
              <div><p class="text-xs text-muted-foreground">负责人</p><p class="mt-1 font-medium">${escapeHtml(todo.owner ?? todo.assignee ?? '-')}</p></div>
              <div><p class="text-xs text-muted-foreground">站点</p><p class="mt-1 font-medium">${escapeHtml(todo.site ?? '-')}</p></div>
              ${
                todo.overdueDays > 0
                  ? `<div class="sm:col-span-2"><p class="text-xs text-muted-foreground">逾期</p><p class="mt-1 font-medium text-red-700">${todo.overdueDays} 天</p></div>`
                  : ''
              }
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">关联对象</h3>
            <div class="space-y-2 text-sm">
              ${
                todo.project
                  ? `
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-muted-foreground">关联项目</span>
                      <button class="text-blue-700 hover:underline" data-pcs-todo-action="go-process" data-url="/projects">${escapeHtml(todo.project)}</button>
                    </div>
                  `
                  : ''
              }
              ${todo.channel ? `<div class="flex items-center justify-between gap-2"><span class="text-muted-foreground">渠道</span><span>${escapeHtml(todo.channel)}</span></div>` : ''}
              ${todo.store ? `<div class="flex items-center justify-between gap-2"><span class="text-muted-foreground">店铺</span><span>${escapeHtml(todo.store)}</span></div>` : ''}
              ${todo.account ? `<div class="flex items-center justify-between gap-2"><span class="text-muted-foreground">账号</span><span>${escapeHtml(todo.account)}</span></div>` : ''}
              ${
                !todo.project && !todo.channel && !todo.store && !todo.account
                  ? '<p class="text-sm text-muted-foreground">暂无关联对象</p>'
                  : ''
              }
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">标签</h3>
            <div class="flex flex-wrap gap-2">
              ${
                todo.tags.length > 0
                  ? todo.tags.map((tag) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')
                  : '<span class="text-sm text-muted-foreground">暂无标签</span>'
              }
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">最近动态</h3>
            <div class="flex items-start gap-2 text-sm">
              <span class="mt-1 h-2 w-2 rounded-full bg-blue-500"></span>
              <div>
                <p class="font-medium">创建待办</p>
                <p class="text-xs text-muted-foreground">${escapeHtml(todo.createdAt)}</p>
              </div>
            </div>
          </section>
        </div>

        <footer class="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background px-5 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-todo-action="copy-code" data-source-code="${escapeHtml(todo.sourceCode)}">
            <i data-lucide="copy" class="mr-1.5 h-4 w-4"></i>复制编号
          </button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-todo-action="go-process" data-url="${escapeHtml(todo.primaryAction.url)}">
            ${escapeHtml(todo.primaryAction.label)}
            <i data-lucide="external-link" class="ml-1.5 h-4 w-4"></i>
          </button>
        </footer>
      </aside>
    </div>
  `
}

function renderConfigDrawer(): string {
  if (!state.configOpen) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pcs-todo-action="close-config" aria-label="关闭"></button>
      <aside class="absolute inset-y-0 right-0 w-full overflow-y-auto border-l bg-background shadow-2xl sm:max-w-[440px]">
        <header class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">视图配置</h2>
              <p class="mt-1 text-xs text-muted-foreground">自定义待办看板的显示方式</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-pcs-todo-action="close-config" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-4 px-5 py-4">
          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">组件显示</h3>
            <div class="space-y-2">
              ${state.configComponents
                .map(
                  (component) => `
                    <div class="flex items-center justify-between rounded-md border px-3 py-2">
                      <div class="flex items-center gap-2 text-sm">
                        <i data-lucide="grip-vertical" class="h-4 w-4 text-muted-foreground"></i>
                        <span>${escapeHtml(component.label)}</span>
                      </div>
                      <button
                        class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${component.enabled ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                        data-pcs-todo-action="toggle-component"
                        data-component-id="${component.id}"
                      >
                        ${component.enabled ? '开启' : '关闭'}
                      </button>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">显示队列导航</h3>
              <button
                class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${state.showQueue ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                data-pcs-todo-action="toggle-show-queue"
              >
                ${state.showQueue ? '开启' : '关闭'}
              </button>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4">
            <h3 class="mb-3 text-sm font-semibold">默认筛选条件</h3>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">默认站点</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-todo-field="defaultSite">
                  <option value="all" ${state.defaultSite === 'all' ? 'selected' : ''}>全部站点</option>
                  <option value="深圳" ${state.defaultSite === '深圳' ? 'selected' : ''}>深圳</option>
                  <option value="雅加达" ${state.defaultSite === '雅加达' ? 'selected' : ''}>雅加达</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">默认优先级</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-todo-field="defaultPriority">
                  <option value="all" ${state.defaultPriority === 'all' ? 'selected' : ''}>全部</option>
                  <option value="P0" ${state.defaultPriority === 'P0' ? 'selected' : ''}>P0 紧急</option>
                  <option value="P1" ${state.defaultPriority === 'P1' ? 'selected' : ''}>P1 高</option>
                  <option value="P2" ${state.defaultPriority === 'P2' ? 'selected' : ''}>P2 中</option>
                  <option value="P3" ${state.defaultPriority === 'P3' ? 'selected' : ''}>P3 低</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <footer class="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t bg-background px-5 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-todo-action="reset-config">恢复默认</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-todo-action="save-config">保存配置</button>
        </footer>
      </aside>
    </div>
  `
}

export function renderPcsTodosPage(): string {
  const roleOptions = Object.entries(ROLES) as Array<[RoleKey, { label: string }]>
  const rows = getFilteredTodos()
  const stats = getStats()

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold">我的待办</h1>
          <p class="text-sm text-muted-foreground">多角色统一待办入口，支持队列导航、优先级筛选与协同处理</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-3 text-xs" data-pcs-todo-field="role">
            ${roleOptions.map(([key, role]) => `<option value="${key}" ${state.currentRole === key ? 'selected' : ''}>${role.label}</option>`).join('')}
          </select>
          <span class="text-xs text-muted-foreground">上次刷新：${escapeHtml(state.lastRefresh)}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="refresh"><i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="export"><i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-todo-action="open-config"><i data-lucide="settings-2" class="mr-1 h-3.5 w-3.5"></i>视图配置</button>
        </div>
      </header>

      ${renderNotice()}
      ${renderKpiSection()}
      ${renderTabs()}
      ${renderFilters()}

      <section class="flex flex-col gap-4 xl:flex-row">
        ${renderQueuePanel()}
        ${renderTodoListSection()}
      </section>

      ${
        rows.length > 0
          ? `<section class="rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">当前角色：${escapeHtml(ROLES[state.currentRole].label)} · 待办总数：${stats.total} · 已筛选：${rows.length}</section>`
          : ''
      }

      ${renderDetailDrawer()}
      ${renderConfigDrawer()}
    </div>
  `
}

function copyCode(value: string): void {
  try {
    void navigator.clipboard.writeText(value)
    state.notice = `已复制编号：${value}`
  } catch {
    state.notice = '复制失败，请手动复制。'
  }
}

function closeAllDialogs(): void {
  if (state.configOpen) {
    state.configOpen = false
    return
  }
  if (state.detailTodoId) {
    state.detailTodoId = null
    return
  }
}

function toggleTodoSelection(todoId: string): void {
  if (state.selectedTodoIds.includes(todoId)) {
    state.selectedTodoIds = state.selectedTodoIds.filter((item) => item !== todoId)
    return
  }
  state.selectedTodoIds = [...state.selectedTodoIds, todoId]
}

function toggleAllSelection(): void {
  const rows = getFilteredTodos()
  const allSelected = rows.length > 0 && rows.every((item) => state.selectedTodoIds.includes(item.id))
  if (allSelected) {
    state.selectedTodoIds = []
    return
  }
  state.selectedTodoIds = rows.map((item) => item.id)
}

function openTodoDetail(todoId: string): void {
  state.detailTodoId = todoId
}

function navigateToDemo(url: string): void {
  const targetPath = resolveDemoPath(url)
  appStore.navigate(targetPath)
}

export function handlePcsTodosEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-todo-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.pcsTodoField === 'searchTerm') {
    state.searchTerm = fieldNode.value
    state.selectedTodoIds = []
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsTodoField
    if (field === 'role') {
      const role = fieldNode.value as RoleKey
      if (role in ROLES) {
        setRole(role)
      }
      return true
    }
    if (field === 'typeFilter') {
      state.typeFilter = fieldNode.value as PcsTodosState['typeFilter']
      state.selectedTodoIds = []
      return true
    }
    if (field === 'priorityFilter') {
      state.priorityFilter = fieldNode.value as PcsTodosState['priorityFilter']
      state.selectedTodoIds = []
      return true
    }
    if (field === 'siteFilter') {
      state.siteFilter = fieldNode.value as SiteFilter
      state.selectedTodoIds = []
      return true
    }
    if (field === 'defaultSite') {
      state.defaultSite = fieldNode.value as SiteFilter
      return true
    }
    if (field === 'defaultPriority') {
      state.defaultPriority = fieldNode.value as PcsTodosState['defaultPriority']
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-todo-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsTodoAction
  if (!action) return false

  if (action === 'set-tab') {
    const tabId = actionNode.dataset.tabId as TabId | undefined
    if (tabId) {
      state.activeTab = tabId
      state.activeQueue = null
      state.selectedTodoIds = []
    }
    return true
  }

  if (action === 'set-queue') {
    const queueKey = actionNode.dataset.queueKey as QueueKey | ''
    state.activeQueue = queueKey ? queueKey : null
    state.selectedTodoIds = []
    return true
  }

  if (action === 'refresh') {
    state.lastRefresh = nowText()
    state.notice = '刷新成功，待办列表已更新（演示态 Mock 数据）。'
    return true
  }

  if (action === 'export') {
    state.notice = '导出任务已创建（演示态），请前往下载中心查看。'
    return true
  }

  if (action === 'open-config') {
    state.configOpen = true
    return true
  }

  if (action === 'close-config') {
    state.configOpen = false
    return true
  }

  if (action === 'toggle-component') {
    const componentId = actionNode.dataset.componentId as ViewComponentSetting['id'] | undefined
    if (!componentId) return true
    state.configComponents = state.configComponents.map((component) =>
      component.id === componentId ? { ...component, enabled: !component.enabled } : component,
    )
    return true
  }

  if (action === 'toggle-show-queue') {
    state.showQueue = !state.showQueue
    return true
  }

  if (action === 'reset-config') {
    state.showQueue = true
    state.configComponents = [
      { id: 'kpi', label: 'KPI统计', enabled: true },
      { id: 'queue', label: '队列导航', enabled: true },
      { id: 'list', label: '待办列表', enabled: true },
    ]
    state.defaultSite = 'all'
    state.defaultPriority = 'all'
    state.notice = '已恢复默认视图配置。'
    return true
  }

  if (action === 'save-config') {
    state.configOpen = false
    state.notice = '视图配置已保存（演示态）。'
    return true
  }

  if (action === 'reset-filters') {
    resetFilters()
    state.selectedTodoIds = []
    return true
  }

  if (action === 'open-detail') {
    const todoId = actionNode.dataset.todoId
    if (todoId) {
      openTodoDetail(todoId)
    }
    return true
  }

  if (action === 'close-detail') {
    closeDetail()
    return true
  }

  if (action === 'toggle-select') {
    const todoId = actionNode.dataset.todoId
    if (todoId) {
      toggleTodoSelection(todoId)
    }
    return true
  }

  if (action === 'toggle-select-all') {
    toggleAllSelection()
    return true
  }

  if (action === 'export-selected') {
    state.notice = `已创建批量导出任务（演示态），共 ${state.selectedTodoIds.length} 条。`
    return true
  }

  if (action === 'go-process') {
    const url = actionNode.dataset.url
    if (url) {
      navigateToDemo(url)
    }
    return true
  }

  if (action === 'copy-code') {
    const sourceCode = actionNode.dataset.sourceCode
    if (sourceCode) {
      copyCode(sourceCode)
    }
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsTodosDialogOpen(): boolean {
  return state.detailTodoId !== null || state.configOpen
}
