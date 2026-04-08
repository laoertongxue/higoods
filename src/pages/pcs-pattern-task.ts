import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderSecondaryButton,
} from '../components/ui'
import { listPatternAssetsForSelect } from '../data/pcs-pattern-library'

// ============ 常量定义 ============

const STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  PENDING_REVIEW: '待评审',
  APPROVED: '已确认',
  COMPLETED: '已完成',
  BLOCKED: '阻塞',
  CANCELLED: '已取消',
}

// ============ Mock 数据 ============

const mockTasks = [
  {
    id: 'AT-20260109-001',
    instance_code: 'AT-20260109-001',
    title: '花型-印尼碎花连衣裙（定位印 A1）',
    status: STATUS.APPROVED,
    project_ref: { id: 'PRJ-20251216-001', name: '印尼风格碎花连衣裙' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260109-003', name: '改版任务-印尼碎花' },
    product_ref: { id: 'SPU-001', name: '印尼碎花连衣裙' },
    artwork_type: '印花',
    pattern_mode: '定位印',
    artwork_name: 'Bunga Tropis A1',
    color_scheme: 'Pantone 17-1937 主花 + 11-0608 底色',
    color_card_status: '已确认',
    owner: '林小美',
    due_at: '2025-12-25',
    artwork_version: 'A1',
    frozen_at: '2025-12-20',
    downstream_count: 1,
    updated_at: '2025-12-20 14:30',
  },
  {
    id: 'AT-20260109-002',
    instance_code: 'AT-20260109-002',
    title: '花型-波西米亚风长裙（满印）',
    status: STATUS.IN_PROGRESS,
    project_ref: { id: 'PRJ-20251218-002', name: '波西米亚风长裙' },
    source_type: '项目模板阶段',
    upstream_instance_ref: null,
    product_ref: { id: 'SPU-002', name: '波西米亚风长裙' },
    artwork_type: '印花',
    pattern_mode: '满印',
    artwork_name: 'Bohemian Paisley',
    color_scheme: '多色-渐变',
    color_card_status: '已做未确认',
    owner: '王设计',
    due_at: '2025-12-30',
    artwork_version: '-',
    frozen_at: null,
    downstream_count: 0,
    updated_at: '2025-12-22 10:15',
  },
  {
    id: 'AT-20260108-003',
    instance_code: 'AT-20260108-003',
    title: '花型-民族风刺绣上衣（绣花）',
    status: STATUS.PENDING_REVIEW,
    project_ref: { id: 'PRJ-20251215-003', name: '民族风刺绣上衣' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260108-005', name: '改版任务-民族风刺绣' },
    product_ref: { id: 'SPU-003', name: '民族风刺绣上衣' },
    artwork_type: '绣花',
    pattern_mode: '局部',
    artwork_name: 'Ethnic Embroidery V2',
    color_scheme: '金线+红线',
    color_card_status: '未做',
    owner: '张设计',
    due_at: '2025-12-28',
    artwork_version: '-',
    frozen_at: null,
    downstream_count: 0,
    updated_at: '2025-12-21 16:45',
  },
  {
    id: 'AT-20260107-004',
    instance_code: 'AT-20260107-004',
    title: '花型-运动风卫衣（烫画）',
    status: STATUS.COMPLETED,
    project_ref: { id: 'PRJ-20251210-004', name: '运动休闲卫衣' },
    source_type: '花型复用调色',
    upstream_instance_ref: null,
    product_ref: { id: 'SPU-004', name: '运动休闲卫衣' },
    artwork_type: '烫画',
    pattern_mode: '定位印',
    artwork_name: 'Sport Logo Heat Transfer',
    color_scheme: '黑白双色',
    color_card_status: '已确认',
    owner: '林小美',
    due_at: '2025-12-18',
    artwork_version: 'A2',
    frozen_at: '2025-12-17',
    downstream_count: 2,
    updated_at: '2025-12-18 09:20',
  },
  {
    id: 'AT-20260107-005',
    instance_code: 'AT-20260107-005',
    title: '花型-复古皮衣夹克（贴布）',
    status: STATUS.BLOCKED,
    project_ref: { id: 'PRJ-20251208-005', name: '复古皮衣夹克' },
    source_type: '项目模板阶段',
    upstream_instance_ref: null,
    product_ref: { id: 'SPU-005', name: '复古皮衣夹克' },
    artwork_type: '贴布',
    pattern_mode: '局部',
    artwork_name: 'Vintage Patch Set',
    color_scheme: '多色贴布',
    color_card_status: '未做',
    owner: '王设计',
    due_at: '2025-12-15',
    artwork_version: '-',
    frozen_at: null,
    downstream_count: 0,
    updated_at: '2025-12-14 11:30',
  },
  {
    id: 'AT-20260106-006',
    instance_code: 'AT-20260106-006',
    title: '花型-夏日沙滩裙（印花）',
    status: STATUS.NOT_STARTED,
    project_ref: { id: 'PRJ-20251205-006', name: '夏日沙滩裙' },
    source_type: '改版任务',
    upstream_instance_ref: { id: 'RT-20260106-010', name: '改版任务-夏日沙滩' },
    product_ref: { id: 'SPU-006', name: '夏日沙滩裙' },
    artwork_type: '印花',
    pattern_mode: '满印',
    artwork_name: 'Tropical Beach',
    color_scheme: '待定',
    color_card_status: '未做',
    owner: '张设计',
    due_at: '2026-01-05',
    artwork_version: '-',
    frozen_at: null,
    downstream_count: 0,
    updated_at: '2025-12-20 08:00',
  },
]

// ============ 类型定义 ============

interface PatternTaskState {
  search: string
  filters: {
    status: string
    owner: string
    source_type: string
    artwork_type: string
  }
  selectedTasks: string[]
  quickFilter: string
  createDrawerOpen: boolean
}

let state: PatternTaskState = {
  search: '',
  filters: {
    status: 'all',
    owner: 'all',
    source_type: 'all',
    artwork_type: 'all',
  },
  selectedTasks: [],
  quickFilter: 'all',
  createDrawerOpen: false,
}

// ============ 工具函数 ============

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    NOT_STARTED: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    PENDING_REVIEW: 'bg-orange-100 text-orange-700',
    APPROVED: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    BLOCKED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

function getFilteredTasks() {
  return mockTasks.filter((task) => {
    const matchSearch =
      state.search === '' ||
      task.instance_code.toLowerCase().includes(state.search.toLowerCase()) ||
      task.title.toLowerCase().includes(state.search.toLowerCase()) ||
      task.project_ref.name.toLowerCase().includes(state.search.toLowerCase())

    const matchStatus = state.filters.status === 'all' || task.status === state.filters.status
    const matchOwner = state.filters.owner === 'all' || task.owner === state.filters.owner
    const matchSource = state.filters.source_type === 'all' || task.source_type === state.filters.source_type
    const matchType = state.filters.artwork_type === 'all' || task.artwork_type === state.filters.artwork_type

    // Quick filters
    if (state.quickFilter === 'my')
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.owner === '林小美'
    if (state.quickFilter === 'pending_review')
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.status === STATUS.PENDING_REVIEW
    if (state.quickFilter === 'frozen_no_downstream')
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.status === STATUS.APPROVED && task.downstream_count === 0
    if (state.quickFilter === 'blocked')
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && task.status === STATUS.BLOCKED
    if (state.quickFilter === 'overdue') {
      const now = new Date()
      const dueDate = new Date(task.due_at)
      return matchSearch && matchStatus && matchOwner && matchSource && matchType && dueDate < now && task.status !== STATUS.COMPLETED
    }

    return matchSearch && matchStatus && matchOwner && matchSource && matchType
  })
}

function getKpiStats() {
  return {
    all: mockTasks.length,
    my: mockTasks.filter((t) => t.owner === '林小美').length,
    pending_review: mockTasks.filter((t) => t.status === STATUS.PENDING_REVIEW).length,
    frozen_no_downstream: mockTasks.filter((t) => t.status === STATUS.APPROVED && t.downstream_count === 0).length,
    blocked: mockTasks.filter((t) => t.status === STATUS.BLOCKED).length,
    overdue: 1,
  }
}

// ============ 渲染函数 ============

function renderPatternCreateDrawer() {
  const patternOptions = listPatternAssetsForSelect()
  if (!state.createDrawerOpen) return ''

  const formContent = `
    <div class="space-y-6">
      <!-- 基本信息 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-gray-500">一、基本信息</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">标题 <span class="text-red-500">*</span></label>
          <input type="text" class="w-full h-9 px-3 border rounded-md text-sm" placeholder="花型-{{款号/项目名}}" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">优先级 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="高">高</option>
              <option value="中" selected>中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">负责人 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择负责人</option>
              <option value="林小美">林小美</option>
              <option value="王设计">王设计</option>
              <option value="张设计">张设计</option>
            </select>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">截止时间</label>
          <input type="date" class="w-full h-9 px-3 border rounded-md text-sm" />
        </div>
      </div>

      <!-- 来源与绑定 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-gray-500">二、来源与绑定</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">来源类型 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择来源</option>
            <option value="改版任务">改版任务</option>
            <option value="项目模板阶段">项目模板阶段</option>
            <option value="花型复用调色">花型复用调色</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">项目 <span class="text-red-500">*</span></label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择项目</option>
            <option value="PRJ-20251216-001">印尼风格碎花连衣裙</option>
          </select>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">上游实例 (条件必填)</label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择上游实例</option>
            <option value="RT-20260109-003">改版任务-印尼碎花</option>
          </select>
        </div>
      </div>

      <!-- 花型需求 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-gray-500">三、花型需求</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">花型类型 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择类型</option>
              <option value="印花">印花</option>
              <option value="绣花">绣花</option>
              <option value="烫画">烫画</option>
              <option value="贴布">贴布</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium">图案方式 <span class="text-red-500">*</span></label>
            <select class="w-full h-9 px-3 border rounded-md text-sm">
              <option value="">选择方式</option>
              <option value="定位印">定位印</option>
              <option value="满印">满印</option>
              <option value="局部">局部</option>
              <option value="拼版">拼版</option>
            </select>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">色彩方案</label>
          <textarea class="w-full px-3 py-2 border rounded-md text-sm min-h-[80px]" placeholder="描述色彩方案"></textarea>
        </div>
      </div>

      <!-- 参考资料与关联样衣 -->
      <div class="space-y-4">
        <h3 class="font-medium text-sm text-gray-500">四、参考资料与关联样衣</h3>
        <div class="space-y-2">
          <label class="block text-sm font-medium">引用花型库</label>
          <select class="w-full h-9 px-3 border rounded-md text-sm">
            <option value="">选择花型库记录（可选）</option>
            ${patternOptions.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join('')}
          </select>
          <p class="text-xs text-gray-500">花型任务可以直接引用花型库记录，完成后也可沉淀为花型库新版本。</p>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">关联样衣 (可选，多选)</label>
          <div class="border rounded-lg p-3 bg-gray-50 text-center">
            <p class="text-xs text-gray-500">选择需要参考的样衣</p>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium">备注</label>
          <textarea class="w-full px-3 py-2 border rounded-md text-sm min-h-[60px]" placeholder="其他说明"></textarea>
        </div>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建花型任务',
      closeAction: { prefix: 'pattern', action: 'close-create-drawer' },
      width: 'sm',
    },
    formContent,
    {
      extra: renderSecondaryButton('保存草稿', { prefix: 'pattern', action: 'close-create-drawer' }),
      confirm: { prefix: 'pattern', action: 'submit-create', label: '创建并开始', variant: 'primary' as const },
    }
  )
}

function renderTaskRow(task: typeof mockTasks[0]) {
  const statusClass = getStatusBadge(task.status)
  const isSelected = state.selectedTasks.includes(task.id)
  return `
    <tr class="border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}">
      <td class="px-3 py-3">
        <input type="checkbox" class="h-4 w-4 rounded border" ${isSelected ? 'checked' : ''} data-pattern-action="toggle-task" data-task-id="${task.id}" />
      </td>
      <td class="px-3 py-3">
        <button class="text-sm font-medium text-blue-600 hover:underline" data-pattern-action="view-task" data-task-id="${task.id}">${task.instance_code}</button>
        <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(task.title)}</p>
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs rounded ${statusClass}">${STATUS_LABELS[task.status] || task.status}</span>
      </td>
      <td class="px-3 py-3">
        <button class="text-sm text-blue-600 hover:underline">${escapeHtml(task.project_ref.name)}</button>
      </td>
      <td class="px-3 py-3 text-sm">${task.source_type}</td>
      <td class="px-3 py-3">
        ${task.product_ref ? `
          <div>
            <p class="text-sm">${escapeHtml(task.product_ref.name)}</p>
            <p class="text-xs text-gray-500">${task.product_ref.id}</p>
          </div>
        ` : '<span class="text-gray-400 text-xs">-</span>'}
      </td>
      <td class="px-3 py-3">
        <span class="inline-flex px-2 py-0.5 text-xs border rounded">${task.artwork_type}</span>
      </td>
      <td class="px-3 py-3 text-sm">${escapeHtml(task.artwork_name)}</td>
      <td class="px-3 py-3 text-sm text-gray-500">${escapeHtml(task.color_scheme)}</td>
      <td class="px-3 py-3 text-sm">${task.owner}</td>
      <td class="px-3 py-3 text-xs text-gray-500">${task.due_at}</td>
      <td class="px-3 py-3">
        ${task.artwork_version === '-' ? '<span class="text-gray-400 text-xs">-</span>' : `<span class="inline-flex px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">${task.artwork_version}</span>`}
      </td>
      <td class="px-3 py-3 text-sm">${task.downstream_count}</td>
      <td class="px-3 py-3 text-xs text-gray-500">${task.updated_at}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          <button class="h-8 px-3 text-xs border rounded-md hover:bg-gray-50" data-pattern-action="deposit-to-library" data-task-id="${task.id}">沉淀花型库</button>
          <button class="h-8 px-3 text-xs border rounded-md hover:bg-gray-50" data-pattern-action="go-pattern-library">花型库</button>
        </div>
      </td>
    </tr>
  `
}

function renderPage(): string {
  const filteredTasks = getFilteredTasks()
  const kpiStats = getKpiStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">花型任务</h1>
          <p class="mt-1 text-sm text-gray-500">管理花型设计、印花、绣花、烫画等图案资产交付</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="h-9 px-4 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-2" data-pattern-action="go-pattern-library">
            <i data-lucide="library" class="h-4 w-4"></i>
            花型库
          </button>
          <button class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2" data-pattern-action="open-create-drawer">
            <i data-lucide="plus" class="h-4 w-4"></i>
            新建花型任务
          </button>
        </div>
      </header>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-white p-4 space-y-4">
        <div class="grid grid-cols-5 gap-4">
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"></i>
            <input
              type="text"
              class="w-full h-9 pl-10 pr-3 border rounded-md text-sm"
              placeholder="搜索任务编号/标题/项目..."
              value="${escapeHtml(state.search)}"
              data-pattern-field="search"
            />
          </div>
          <select class="h-9 px-3 border rounded-md text-sm" data-pattern-field="status">
            <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>全部状态</option>
            ${Object.entries(STATUS_LABELS).map(([key, label]) => `<option value="${key}" ${state.filters.status === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-pattern-field="owner">
            <option value="all" ${state.filters.owner === 'all' ? 'selected' : ''}>全部</option>
            <option value="林小美" ${state.filters.owner === '林小美' ? 'selected' : ''}>林小美</option>
            <option value="王设计" ${state.filters.owner === '王设计' ? 'selected' : ''}>王设计</option>
            <option value="张设计" ${state.filters.owner === '张设计' ? 'selected' : ''}>张设计</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-pattern-field="source_type">
            <option value="all" ${state.filters.source_type === 'all' ? 'selected' : ''}>全部来源</option>
            <option value="改版任务" ${state.filters.source_type === '改版任务' ? 'selected' : ''}>改版任务</option>
            <option value="项目模板阶段" ${state.filters.source_type === '项目模板阶段' ? 'selected' : ''}>项目模板阶段</option>
            <option value="花型复用调色" ${state.filters.source_type === '花型复用调色' ? 'selected' : ''}>花型复用调色</option>
          </select>
          <select class="h-9 px-3 border rounded-md text-sm" data-pattern-field="artwork_type">
            <option value="all" ${state.filters.artwork_type === 'all' ? 'selected' : ''}>全部类型</option>
            <option value="印花" ${state.filters.artwork_type === '印花' ? 'selected' : ''}>印花</option>
            <option value="绣花" ${state.filters.artwork_type === '绣花' ? 'selected' : ''}>绣花</option>
            <option value="烫画" ${state.filters.artwork_type === '烫画' ? 'selected' : ''}>烫画</option>
            <option value="贴布" ${state.filters.artwork_type === '贴布' ? 'selected' : ''}>贴布</option>
          </select>
        </div>

        <!-- KPI Quick Filters -->
        <div class="flex items-center gap-2">
          ${[
            { value: 'all', label: '全部', count: kpiStats.all },
            { value: 'my', label: '我的', count: kpiStats.my },
            { value: 'pending_review', label: '待评审', count: kpiStats.pending_review },
            { value: 'frozen_no_downstream', label: '已冻结未建下游', count: kpiStats.frozen_no_downstream },
            { value: 'blocked', label: '阻塞', count: kpiStats.blocked },
            { value: 'overdue', label: '超期', count: kpiStats.overdue },
          ].map((kpi) => `
            <button
              class="h-8 px-3 text-sm rounded-md ${state.quickFilter === kpi.value ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}"
              data-pattern-action="set-quick-filter"
              data-filter="${kpi.value}"
            >
              ${kpi.label} (${kpi.count})
            </button>
          `).join('')}
        </div>
      </section>

      <!-- Batch Actions -->
      ${state.selectedTasks.length > 0 ? `
        <section class="bg-gray-100 border rounded-lg p-3 flex items-center gap-3">
          <span class="text-sm text-gray-600">已选 ${state.selectedTasks.length} 项</span>
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-white">批量分派</button>
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-white">批量截止</button>
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-white">批量阻塞</button>
          <button class="h-8 px-3 text-sm border rounded-md hover:bg-white flex items-center gap-1">
            <i data-lucide="download" class="h-4 w-4"></i>
            导出
          </button>
        </section>
      ` : ''}

      <!-- Table -->
      <section class="rounded-lg border bg-white overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1600px] text-sm">
            <thead>
              <tr class="border-b bg-gray-50 text-left text-gray-600">
                <th class="px-3 py-3 w-12">
                  <input type="checkbox" class="h-4 w-4 rounded border" data-pattern-action="toggle-all" ${state.selectedTasks.length === filteredTasks.length && filteredTasks.length > 0 ? 'checked' : ''} />
                </th>
                <th class="px-3 py-3 font-medium">任务</th>
                <th class="px-3 py-3 font-medium">状态</th>
                <th class="px-3 py-3 font-medium">项目</th>
                <th class="px-3 py-3 font-medium">来源</th>
                <th class="px-3 py-3 font-medium">商品</th>
                <th class="px-3 py-3 font-medium">花型类型</th>
                <th class="px-3 py-3 font-medium">花型名称</th>
                <th class="px-3 py-3 font-medium">色彩方案</th>
                <th class="px-3 py-3 font-medium">负责人</th>
                <th class="px-3 py-3 font-medium">截止时间</th>
                <th class="px-3 py-3 font-medium">花型版本</th>
                <th class="px-3 py-3 font-medium">下游任务</th>
                <th class="px-3 py-3 font-medium">最近更新</th>
                <th class="px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks.length > 0 ? filteredTasks.map(renderTaskRow).join('') : `
                <tr>
                  <td colspan="15" class="px-4 py-12 text-center text-gray-500">暂无数据</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    ${renderPatternCreateDrawer()}
  `
}

// ============ 事件处理 ============

export function handlePatternTaskEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pattern-action]')
  const action = actionNode?.dataset.patternAction

  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    return true
  }

  if (action === 'submit-create') {
    state.createDrawerOpen = false
    console.log('花型任务已创建')
    return true
  }

  if (action === 'set-quick-filter') {
    state.quickFilter = actionNode?.dataset.filter || 'all'
    return true
  }

  if (action === 'toggle-task') {
    const taskId = actionNode?.dataset.taskId
    if (taskId) {
      if (state.selectedTasks.includes(taskId)) {
        state.selectedTasks = state.selectedTasks.filter((id) => id !== taskId)
      } else {
        state.selectedTasks = [...state.selectedTasks, taskId]
      }
      return true
    }
  }

  if (action === 'toggle-all') {
    const filteredTasks = getFilteredTasks()
    if (state.selectedTasks.length === filteredTasks.length) {
      state.selectedTasks = []
    } else {
      state.selectedTasks = filteredTasks.map((t) => t.id)
    }
    return true
  }

  if (action === 'view-task') {
    const taskId = actionNode?.dataset.taskId
    console.log(`查看任务: ${taskId}`)
    return true
  }

  if (action === 'go-pattern-library') {
    appStore.navigate('/pcs/pattern-library')
    return true
  }

  if (action === 'deposit-to-library') {
    const taskId = actionNode?.dataset.taskId
    if (!taskId) return false
    appStore.navigate(`/pcs/pattern-library/create?sourceTaskId=${encodeURIComponent(taskId)}`)
    return true
  }

  return false
}

export function handlePatternTaskInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.patternField
  if (!field) return false

  if (field === 'search') {
    state.search = (target as HTMLInputElement).value
    return true
  }

  if (field === 'status') {
    state.filters.status = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'owner') {
    state.filters.owner = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'source_type') {
    state.filters.source_type = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'artwork_type') {
    state.filters.artwork_type = (target as HTMLSelectElement).value
    return true
  }

  return false
}

export function isPatternTaskDialogOpen(): boolean {
  return state.createDrawerOpen
}

export function renderPatternTaskPage(): string {
  return renderPage()
}
