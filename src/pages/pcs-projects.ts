import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderFormDialog } from '../components/ui/dialog'
import { renderDetailDrawer as uiDetailDrawer } from '../components/ui/drawer'
import { renderSecondaryButton, renderDangerButton } from '../components/ui/button'

type ProjectStatus = '进行中' | '已终止' | '已归档'
type NextWorkItemStatus = '未开始' | '进行中' | '待决策' | '已完成'
type RiskStatus = '正常' | '延期'
type ViewMode = 'grid' | 'list'
type SortBy = 'updatedAt' | 'pendingDecision' | 'risk' | 'progressLow'
type DateRangeFilter = 'all' | 'today' | 'week' | 'month'

interface Project {
  id: string
  code: string
  name: string
  styleType: '基础款' | '快时尚款' | '改版款' | '设计款'
  category: string
  tags: string[]
  status: ProjectStatus
  spuCode?: string
  phaseName: string
  progressDone: number
  progressTotal: number
  nextWorkItemName: string
  nextWorkItemStatus: NextWorkItemStatus
  hasPendingDecision: boolean
  isBlocked: boolean
  gateReason?: string
  riskStatus: RiskStatus
  riskReason?: string
  riskWorkItem?: string
  riskDurationDays?: number
  owner: string
  updatedAt: string
}

interface QuickFilters {
  styleType: '全部' | Project['styleType']
  status: '全部' | ProjectStatus
  pendingDecision: boolean
  riskStatus: '全部' | RiskStatus
}

interface AdvancedFilters {
  owner: 'all' | string
  phase: 'all' | string
  dateRange: DateRangeFilter
}

interface ProjectListState {
  projects: Project[]
  viewMode: ViewMode
  searchTerm: string
  showAdvancedFilters: boolean
  selectedProjects: string[]
  sortBy: SortBy
  quickFilters: QuickFilters
  advancedFilters: AdvancedFilters
  currentPage: number
  itemsPerPage: number
  detailProjectId: string | null
  terminateDialog: { open: boolean; projectId: string | null }
  terminateReason: string
  notice: string | null
}

const PROJECT_SEEDS: Project[] = [
  {
    id: 'prj_20251216_001',
    code: 'PRJ-20251216-001',
    name: '印尼风格碎花连衣裙',
    styleType: '基础款',
    category: '裙装 / 连衣裙',
    tags: ['休闲', '甜美'],
    status: '进行中',
    spuCode: 'SPU-2025-0891',
    phaseName: '测款阶段',
    progressDone: 7,
    progressTotal: 10,
    nextWorkItemName: '测款结论判定',
    nextWorkItemStatus: '待决策',
    hasPendingDecision: true,
    isBlocked: false,
    riskStatus: '正常',
    owner: '张丽',
    updatedAt: '2025-12-16 14:30',
  },
  {
    id: 'prj_20251216_002',
    code: 'PRJ-20251216-002',
    name: '百搭纯色基础T恤',
    styleType: '快时尚款',
    category: '上衣 / T恤',
    tags: ['极简', '通勤'],
    status: '进行中',
    spuCode: 'SPU-2025-0892',
    phaseName: '工程准备',
    progressDone: 8,
    progressTotal: 8,
    nextWorkItemName: '首单样衣打样',
    nextWorkItemStatus: '进行中',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '王明',
    updatedAt: '2025-12-16 12:00',
  },
  {
    id: 'prj_20251216_003',
    code: 'PRJ-20251216-003',
    name: '夏日休闲牛仔短裤',
    styleType: '设计款',
    category: '裤装 / 短裤',
    tags: ['休闲', '运动'],
    status: '进行中',
    phaseName: '打样阶段',
    progressDone: 3,
    progressTotal: 12,
    nextWorkItemName: '样衣评审',
    nextWorkItemStatus: '未开始',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '延期',
    riskReason: '供应商交付延迟',
    riskWorkItem: '外采样品采购',
    riskDurationDays: 5,
    owner: '李娜',
    updatedAt: '2025-12-15 18:45',
  },
  {
    id: 'prj_20251216_004',
    code: 'PRJ-20251216-004',
    name: '复古皮质机车夹克',
    styleType: '改版款',
    category: '外套 / 夹克',
    tags: ['复古', '街头'],
    status: '进行中',
    phaseName: '立项阶段',
    progressDone: 2,
    progressTotal: 7,
    nextWorkItemName: '初步可行性判断',
    nextWorkItemStatus: '待决策',
    hasPendingDecision: true,
    isBlocked: true,
    gateReason: '初步可行性判断待决策',
    riskStatus: '正常',
    owner: '赵云',
    updatedAt: '2025-12-15 16:20',
  },
  {
    id: 'prj_20251216_005',
    code: 'PRJ-20251216-005',
    name: '法式优雅衬衫连衣裙',
    styleType: '设计款',
    category: '裙装 / 连衣裙',
    tags: ['优雅', '通勤'],
    status: '进行中',
    spuCode: 'SPU-2025-0895',
    phaseName: '测款阶段',
    progressDone: 6,
    progressTotal: 10,
    nextWorkItemName: '直播测款',
    nextWorkItemStatus: '进行中',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '延期',
    riskReason: '直播场次安排冲突',
    riskWorkItem: '直播测款',
    riskDurationDays: 3,
    owner: '周芳',
    updatedAt: '2025-12-15 14:10',
  },
  {
    id: 'prj_20251216_006',
    code: 'PRJ-20251216-006',
    name: '运动休闲卫衣套装',
    styleType: '快时尚款',
    category: '套装 / 运动套装',
    tags: ['运动', '休闲'],
    status: '进行中',
    phaseName: '工程准备',
    progressDone: 7,
    progressTotal: 8,
    nextWorkItemName: '制版任务',
    nextWorkItemStatus: '已完成',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '陈刚',
    updatedAt: '2025-12-14 20:30',
  },
  {
    id: 'prj_20251216_007',
    code: 'PRJ-20251216-007',
    name: '碎花雪纺半身裙',
    styleType: '基础款',
    category: '裙装 / 半身裙',
    tags: ['甜美', '清新'],
    status: '已归档',
    spuCode: 'SPU-2025-0788',
    phaseName: '已归档',
    progressDone: 10,
    progressTotal: 10,
    nextWorkItemName: '-',
    nextWorkItemStatus: '已完成',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '张丽',
    updatedAt: '2025-12-10 10:00',
  },
  {
    id: 'prj_20251216_008',
    code: 'PRJ-20251216-008',
    name: '商务休闲西装外套',
    styleType: '改版款',
    category: '外套 / 西装',
    tags: ['商务', '通勤'],
    status: '已终止',
    phaseName: '已终止',
    progressDone: 4,
    progressTotal: 12,
    nextWorkItemName: '-',
    nextWorkItemStatus: '已完成',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '王明',
    updatedAt: '2025-12-08 15:00',
  },
  {
    id: 'prj_20251216_009',
    code: 'PRJ-20251216-009',
    name: '高腰阔腿牛仔裤',
    styleType: '基础款',
    category: '裤装 / 长裤',
    tags: ['休闲', '百搭'],
    status: '进行中',
    phaseName: '打样阶段',
    progressDone: 4,
    progressTotal: 12,
    nextWorkItemName: '样衣拍摄试穿',
    nextWorkItemStatus: '进行中',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '李娜',
    updatedAt: '2025-12-14 11:20',
  },
  {
    id: 'prj_20251216_010',
    code: 'PRJ-20251216-010',
    name: '波西米亚印花长裙',
    styleType: '设计款',
    category: '裙装 / 长裙',
    tags: ['度假', '波西米亚'],
    status: '进行中',
    phaseName: '立项阶段',
    progressDone: 1,
    progressTotal: 12,
    nextWorkItemName: '商品项目立项',
    nextWorkItemStatus: '进行中',
    hasPendingDecision: false,
    isBlocked: false,
    riskStatus: '正常',
    owner: '周芳',
    updatedAt: '2025-12-16 09:00',
  },
]

const STYLE_TYPE_COLORS: Record<Project['styleType'], string> = {
  基础款: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  快时尚款: 'border-blue-200 bg-blue-50 text-blue-700',
  改版款: 'border-amber-200 bg-amber-50 text-amber-700',
  设计款: 'border-purple-200 bg-purple-50 text-purple-700',
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  进行中: 'border-blue-200 bg-blue-50 text-blue-700',
  已终止: 'border-red-200 bg-red-50 text-red-700',
  已归档: 'border-slate-200 bg-slate-50 text-slate-700',
}

const state: ProjectListState = {
  projects: [...PROJECT_SEEDS],
  viewMode: 'list',
  searchTerm: '',
  showAdvancedFilters: false,
  selectedProjects: [],
  sortBy: 'updatedAt',
  quickFilters: {
    styleType: '全部',
    status: '全部',
    pendingDecision: false,
    riskStatus: '全部',
  },
  advancedFilters: {
    owner: 'all',
    phase: 'all',
    dateRange: 'all',
  },
  currentPage: 1,
  itemsPerPage: 10,
  detailProjectId: null,
  terminateDialog: { open: false, projectId: null },
  terminateReason: '',
  notice: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function toDate(value: string): Date {
  return new Date(value.replace(' ', 'T'))
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

function getOwners(): string[] {
  return Array.from(new Set(state.projects.map((project) => project.owner)))
}

function getPhases(): string[] {
  return Array.from(new Set(state.projects.map((project) => project.phaseName)))
}

function getLatestUpdatedAt(): Date | null {
  if (state.projects.length === 0) return null
  return state.projects.map((project) => toDate(project.updatedAt)).sort((a, b) => b.getTime() - a.getTime())[0]
}

function matchesDateRange(project: Project, range: DateRangeFilter): boolean {
  if (range === 'all') return true
  const latest = getLatestUpdatedAt()
  if (!latest) return true
  const updated = toDate(project.updatedAt)
  const diffDays = (latest.getTime() - updated.getTime()) / (24 * 60 * 60 * 1000)

  if (range === 'today') {
    return updated.toISOString().slice(0, 10) === latest.toISOString().slice(0, 10)
  }
  if (range === 'week') {
    return diffDays <= 7
  }
  if (range === 'month') {
    return diffDays <= 30
  }
  return true
}

function getFilteredProjects(): Project[] {
  const search = state.searchTerm.trim().toLowerCase()
  const { styleType, status, pendingDecision, riskStatus } = state.quickFilters
  const { owner, phase, dateRange } = state.advancedFilters

  const rows = state.projects.filter((project) => {
    const matchesSearch =
      !search ||
      project.name.toLowerCase().includes(search) ||
      project.code.toLowerCase().includes(search) ||
      project.tags.some((tag) => tag.toLowerCase().includes(search)) ||
      project.owner.toLowerCase().includes(search)

    const matchesStyle = styleType === '全部' || project.styleType === styleType
    const matchesStatus = status === '全部' || project.status === status
    const matchesPendingDecision = !pendingDecision || project.hasPendingDecision
    const matchesRisk = riskStatus === '全部' || project.riskStatus === riskStatus
    const matchesOwner = owner === 'all' || project.owner === owner
    const matchesPhase = phase === 'all' || project.phaseName === phase
    const matchesRange = matchesDateRange(project, dateRange)

    return (
      matchesSearch &&
      matchesStyle &&
      matchesStatus &&
      matchesPendingDecision &&
      matchesRisk &&
      matchesOwner &&
      matchesPhase &&
      matchesRange
    )
  })

  rows.sort((a, b) => {
    if (state.sortBy === 'updatedAt') {
      return toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime()
    }
    if (state.sortBy === 'pendingDecision') {
      return Number(b.hasPendingDecision) - Number(a.hasPendingDecision)
    }
    if (state.sortBy === 'risk') {
      return Number(b.riskStatus === '延期') - Number(a.riskStatus === '延期')
    }
    if (state.sortBy === 'progressLow') {
      return a.progressDone / a.progressTotal - b.progressDone / b.progressTotal
    }
    return 0
  })

  return rows
}

function getPaginatedProjects() {
  const rows = getFilteredProjects()
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / state.itemsPerPage))
  if (state.currentPage > totalPages) state.currentPage = totalPages
  const currentPage = Math.max(1, state.currentPage)
  const start = (currentPage - 1) * state.itemsPerPage
  const end = start + state.itemsPerPage

  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function getPageNumbers(totalPages: number, currentPage: number): Array<number | '...'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1)
  }

  if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages]
  if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

function getProjectById(projectId: string | null): Project | null {
  if (!projectId) return null
  return state.projects.find((project) => project.id === projectId) ?? null
}

function isSelected(projectId: string): boolean {
  return state.selectedProjects.includes(projectId)
}

function selectProject(projectId: string): void {
  if (isSelected(projectId)) {
    state.selectedProjects = state.selectedProjects.filter((id) => id !== projectId)
    return
  }
  state.selectedProjects = [...state.selectedProjects, projectId]
}

function selectAllOnCurrentPage(): void {
  const pageRows = getPaginatedProjects().rows
  const allSelected = pageRows.length > 0 && pageRows.every((project) => state.selectedProjects.includes(project.id))
  if (allSelected) {
    state.selectedProjects = state.selectedProjects.filter((id) => !pageRows.some((project) => project.id === id))
    return
  }

  const merged = new Set(state.selectedProjects)
  pageRows.forEach((project) => merged.add(project.id))
  state.selectedProjects = Array.from(merged)
}

function clearFilters(): void {
  state.searchTerm = ''
  state.quickFilters = {
    styleType: '全部',
    status: '全部',
    pendingDecision: false,
    riskStatus: '全部',
  }
  state.advancedFilters = {
    owner: 'all',
    phase: 'all',
    dateRange: 'all',
  }
  state.sortBy = 'updatedAt'
  state.currentPage = 1
}

function getCoverAccent(styleType: Project['styleType']): { bg: string; fg: string } {
  if (styleType === '基础款') return { bg: 'bg-emerald-50', fg: 'text-emerald-700' }
  if (styleType === '快时尚款') return { bg: 'bg-blue-50', fg: 'text-blue-700' }
  if (styleType === '改版款') return { bg: 'bg-amber-50', fg: 'text-amber-700' }
  return { bg: 'bg-purple-50', fg: 'text-purple-700' }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-project-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold">商品项目列表</h1>
        <p class="text-sm text-muted-foreground">管理所有商品立项与执行</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${
          state.selectedProjects.length > 0
            ? `
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-action="batch-export">批量导出（${state.selectedProjects.length}）</button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-action="batch-copy">批量复制</button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-red-700 hover:bg-red-50" data-pcs-project-action="batch-delete">批量删除</button>
            `
            : ''
        }
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-project-action="create-project">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新建商品项目
        </button>
      </div>
    </header>
  `
}

function renderToolbar(): string {
  const styleTypes: Array<QuickFilters['styleType']> = ['全部', '基础款', '快时尚款', '改版款', '设计款']
  const statuses: Array<QuickFilters['status']> = ['全部', '进行中', '已终止', '已归档']
  const risks: Array<QuickFilters['riskStatus']> = ['全部', '正常', '延期']
  const owners = getOwners()
  const phases = getPhases()

  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: 'updatedAt', label: '最近更新' },
    { value: 'pendingDecision', label: '待决策优先' },
    { value: 'risk', label: '风险优先' },
    { value: 'progressLow', label: '进度最低优先' },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <div class="min-w-[260px] flex-1">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索项目名称、编码或关键词" value="${escapeHtml(state.searchTerm)}" data-pcs-project-field="searchTerm" />
          </div>
        </div>
        <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-action="query">查询</button>
        <div class="w-[160px]">
          <label class="mb-1 block text-xs text-muted-foreground">排序</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="sortBy">
            ${sortOptions.map((option) => `<option value="${option.value}" ${state.sortBy === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-action="reset-filters">重置筛选</button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-action="toggle-advanced">
            <i data-lucide="${state.showAdvancedFilters ? 'chevron-up' : 'chevron-down'}" class="mr-1 h-4 w-4"></i>
            高级筛选
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">款式类型：</span>
          <div class="flex flex-wrap gap-1">
            ${styleTypes
              .map((type) => {
                const active = state.quickFilters.styleType === type
                return `<button class="inline-flex h-7 items-center rounded-md px-3 text-xs ${active ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}" data-pcs-project-action="set-style-type" data-style-type="${type}">${type}</button>`
              })
              .join('')}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">状态：</span>
          <div class="flex flex-wrap gap-1">
            ${statuses
              .map((status) => {
                const active = state.quickFilters.status === status
                return `<button class="inline-flex h-7 items-center rounded-md px-3 text-xs ${active ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}" data-pcs-project-action="set-status" data-status="${status}">${status}</button>`
              })
              .join('')}
          </div>
        </div>

        <button
          class="inline-flex h-7 items-center rounded-md px-3 text-xs ${state.quickFilters.pendingDecision ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
          data-pcs-project-action="toggle-pending-decision"
        >
          待决策
        </button>

        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">风险：</span>
          <div class="flex flex-wrap gap-1">
            ${risks
              .map((risk) => {
                const active = state.quickFilters.riskStatus === risk
                return `<button class="inline-flex h-7 items-center rounded-md px-3 text-xs ${active ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}" data-pcs-project-action="set-risk-status" data-risk-status="${risk}">${risk}</button>`
              })
              .join('')}
          </div>
        </div>
      </div>

      ${
        state.showAdvancedFilters
          ? `
            <div class="mt-4 grid gap-3 border-t pt-4 md:grid-cols-3">
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">负责人</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="owner">
                  <option value="all" ${state.advancedFilters.owner === 'all' ? 'selected' : ''}>全部</option>
                  ${owners.map((owner) => `<option value="${owner}" ${state.advancedFilters.owner === owner ? 'selected' : ''}>${owner}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">当前阶段</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="phase">
                  <option value="all" ${state.advancedFilters.phase === 'all' ? 'selected' : ''}>全部</option>
                  ${phases.map((phase) => `<option value="${phase}" ${state.advancedFilters.phase === phase ? 'selected' : ''}>${phase}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">最近更新范围</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="dateRange">
                  <option value="all" ${state.advancedFilters.dateRange === 'all' ? 'selected' : ''}>全部</option>
                  <option value="today" ${state.advancedFilters.dateRange === 'today' ? 'selected' : ''}>最近一天</option>
                  <option value="week" ${state.advancedFilters.dateRange === 'week' ? 'selected' : ''}>最近一周</option>
                  <option value="month" ${state.advancedFilters.dateRange === 'month' ? 'selected' : ''}>最近一月</option>
                </select>
              </div>
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderViewToggle(total: number, from: number, to: number): string {
  return `
    <section class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted-foreground">共 ${total} 个项目${total > 0 ? ` · 显示第 ${from}-${to} 项` : ''}</p>
      <div class="inline-flex items-center rounded-md border bg-card p-1">
        <button class="inline-flex h-7 w-7 items-center justify-center rounded ${state.viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:bg-muted'}" data-pcs-project-action="set-view-mode" data-view-mode="grid">
          <i data-lucide="layout-grid" class="h-4 w-4"></i>
        </button>
        <button class="inline-flex h-7 w-7 items-center justify-center rounded ${state.viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-muted'}" data-pcs-project-action="set-view-mode" data-view-mode="list">
          <i data-lucide="list" class="h-4 w-4"></i>
        </button>
      </div>
    </section>
  `
}

function renderProjectListTable(rows: Project[]): string {
  const allSelectedOnPage = rows.length > 0 && rows.every((project) => state.selectedProjects.includes(project.id))

  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1320px] text-sm">
        <thead>
          <tr class="border-b bg-muted/30 text-left text-muted-foreground">
            <th class="px-3 py-2 font-medium">
              <input type="checkbox" class="h-4 w-4 rounded border" ${allSelectedOnPage ? 'checked' : ''} data-pcs-project-action="toggle-select-all-page" />
            </th>
            <th class="px-3 py-2 font-medium">项目名称</th>
            <th class="px-3 py-2 font-medium">项目编码</th>
            <th class="px-3 py-2 font-medium">款式类型</th>
            <th class="px-3 py-2 font-medium">分类</th>
            <th class="px-3 py-2 font-medium">风格</th>
            <th class="px-3 py-2 font-medium">当前阶段</th>
            <th class="px-3 py-2 font-medium">项目进度</th>
            <th class="px-3 py-2 font-medium">风险</th>
            <th class="px-3 py-2 font-medium">负责人</th>
            <th class="px-3 py-2 font-medium">最近更新</th>
            <th class="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length === 0
              ? `
                <tr>
                  <td colspan="12" class="px-4 py-14 text-center text-muted-foreground">
                    <i data-lucide="folder-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
                    <p class="mt-2">暂无匹配项目</p>
                  </td>
                </tr>
              `
              : rows.map((project) => renderProjectListRow(project)).join('')
          }
        </tbody>
      </table>
    </div>
  `
}

function renderProjectListRow(project: Project): string {
  const coverAccent = getCoverAccent(project.styleType)
  const progress = Math.round((project.progressDone / Math.max(project.progressTotal, 1)) * 100)

  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40">
      <td class="px-3 py-2 align-top">
        <input type="checkbox" class="mt-1 h-4 w-4 rounded border" ${isSelected(project.id) ? 'checked' : ''} data-pcs-project-action="toggle-select" data-project-id="${escapeHtml(project.id)}" />
      </td>
      <td class="px-3 py-2 align-top">
        <button class="group flex min-w-[260px] items-start gap-3 text-left" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.id)}">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded ${coverAccent.bg}">
            <span class="text-[10px] font-medium ${coverAccent.fg}">${escapeHtml(project.styleType)}</span>
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate font-medium group-hover:text-blue-700">${escapeHtml(project.name)}</span>
              ${renderBadge(project.status, STATUS_COLORS[project.status])}
            </div>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">${project.spuCode ? `SPU: ${escapeHtml(project.spuCode)} ｜ ` : ''}标签：${project.tags.map((tag) => escapeHtml(tag)).join('、')}</p>
          </div>
        </button>
      </td>
      <td class="px-3 py-2 align-top">
        <div class="flex items-center gap-1">
          <span class="font-mono text-xs">${escapeHtml(project.code)}</span>
          <button class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted" data-pcs-project-action="copy-code" data-project-code="${escapeHtml(project.code)}">
            <i data-lucide="copy" class="h-3 w-3"></i>
          </button>
        </div>
      </td>
      <td class="px-3 py-2 align-top">${renderBadge(project.styleType, STYLE_TYPE_COLORS[project.styleType])}</td>
      <td class="px-3 py-2 align-top">${escapeHtml(project.category)}</td>
      <td class="px-3 py-2 align-top">${project.tags.map((tag) => `<span class="mr-1 inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')}</td>
      <td class="px-3 py-2 align-top">
        <div class="flex flex-wrap items-center gap-1">
          <span>${escapeHtml(project.phaseName)}</span>
          ${project.hasPendingDecision ? renderBadge('待决策', 'border-orange-200 bg-orange-50 text-orange-700') : ''}
          ${project.isBlocked ? renderBadge('生产暂停', 'border-red-200 bg-red-50 text-red-700') : ''}
        </div>
        ${project.isBlocked && project.gateReason ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(project.gateReason)}</p>` : ''}
      </td>
      <td class="px-3 py-2 align-top">
        <div class="w-[170px]">
          <div class="mb-1 flex items-center justify-between text-xs">
            <span>${project.progressDone}/${project.progressTotal}</span>
            <span>${progress}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <span class="block h-full rounded-full bg-blue-600" style="width:${progress}%"></span>
          </div>
          ${project.nextWorkItemName !== '-' ? `<p class="mt-1 text-xs text-muted-foreground">下一步：${escapeHtml(project.nextWorkItemName)}（${escapeHtml(project.nextWorkItemStatus)}）</p>` : ''}
        </div>
      </td>
      <td class="px-3 py-2 align-top">
        ${
          project.riskStatus === '延期'
            ? `<button class="inline-flex items-center gap-1 text-xs text-orange-700 hover:underline" data-pcs-project-action="show-risk" data-project-id="${escapeHtml(project.id)}"><span class="h-2 w-2 rounded-full bg-orange-500"></span>延期 · 查看</button>`
            : `<span class="inline-flex items-center gap-1 text-xs text-green-700"><span class="h-2 w-2 rounded-full bg-green-500"></span>正常</span>`
        }
      </td>
      <td class="px-3 py-2 align-top">${escapeHtml(project.owner)}</td>
      <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(project.updatedAt)}</td>
      <td class="px-3 py-2 align-top">
        <div class="flex flex-wrap gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.id)}">查看</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="duplicate" data-project-id="${escapeHtml(project.id)}">复制</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${project.status === '进行中' ? 'text-red-700 hover:bg-red-50' : 'cursor-not-allowed text-muted-foreground'}" data-pcs-project-action="open-terminate" data-project-id="${escapeHtml(project.id)}" ${project.status === '进行中' ? '' : 'disabled'}>终止</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${project.status === '进行中' ? 'hover:bg-muted' : 'cursor-not-allowed text-muted-foreground'}" data-pcs-project-action="archive" data-project-id="${escapeHtml(project.id)}" ${project.status === '进行中' ? '' : 'disabled'}>归档</button>
        </div>
      </td>
    </tr>
  `
}

function renderProjectGrid(rows: Project[]): string {
  if (rows.length === 0) {
    return `
      <div class="rounded-lg border border-dashed px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="folder-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">暂无匹配项目</p>
      </div>
    `
  }

  return `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      ${rows.map((project) => renderProjectCard(project)).join('')}
    </div>
  `
}

function renderProjectCard(project: Project): string {
  const coverAccent = getCoverAccent(project.styleType)
  const progress = Math.round((project.progressDone / Math.max(project.progressTotal, 1)) * 100)

  return `
    <article class="overflow-hidden rounded-lg border bg-card">
      <button class="w-full text-left" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.id)}">
        <div class="relative px-4 py-4 ${coverAccent.bg}">
          <div class="absolute right-3 top-3">${renderBadge(project.status, STATUS_COLORS[project.status])}</div>
          ${project.hasPendingDecision ? `<div class="absolute left-3 top-3">${renderBadge('待决策', 'border-orange-200 bg-orange-50 text-orange-700')}</div>` : ''}
          <div class="pt-7">
            <h3 class="text-base font-semibold ${coverAccent.fg}">${escapeHtml(project.name)}</h3>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(project.code)}</p>
          </div>
        </div>
      </button>

      <div class="space-y-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderBadge(project.styleType, STYLE_TYPE_COLORS[project.styleType])}
          <span class="inline-flex rounded-md border px-2 py-0.5 text-xs">${escapeHtml(project.category)}</span>
        </div>

        <div class="space-y-1 text-sm">
          <div class="flex items-center justify-between"><span class="text-muted-foreground">当前阶段</span><span>${escapeHtml(project.phaseName)}</span></div>
          <div class="flex items-center justify-between"><span class="text-muted-foreground">项目进度</span><span>${project.progressDone}/${project.progressTotal}</span></div>
          <div class="h-2 overflow-hidden rounded-full bg-muted"><span class="block h-full rounded-full bg-blue-600" style="width:${progress}%"></span></div>
        </div>

        <div class="flex items-center justify-between border-t pt-2 text-xs">
          <div class="flex items-center gap-2">
            ${
              project.riskStatus === '延期'
                ? '<span class="inline-flex items-center gap-1 text-orange-700"><i data-lucide="triangle-alert" class="h-3.5 w-3.5"></i>延期</span>'
                : '<span class="inline-flex items-center gap-1 text-green-700"><span class="h-2 w-2 rounded-full bg-green-500"></span>正常</span>'
            }
            <span class="text-muted-foreground">${escapeHtml(project.owner)}</span>
          </div>
          <span class="text-muted-foreground">${escapeHtml(project.updatedAt)}</span>
        </div>

        <div class="flex flex-wrap gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.id)}">查看</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="duplicate" data-project-id="${escapeHtml(project.id)}">复制</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${project.status === '进行中' ? 'text-red-700 hover:bg-red-50' : 'cursor-not-allowed text-muted-foreground'}" data-pcs-project-action="open-terminate" data-project-id="${escapeHtml(project.id)}" ${project.status === '进行中' ? '' : 'disabled'}>终止</button>
        </div>
      </div>
    </article>
  `
}

function renderPagination(total: number, totalPages: number, currentPage: number, from: number, to: number): string {
  const pages = getPageNumbers(totalPages, currentPage)

  return `
    <footer class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p class="text-sm text-muted-foreground">显示 ${from}-${to} 条，共 ${total} 条</p>
      <div class="flex items-center gap-1">
        <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pcs-project-action="page-prev" ${currentPage <= 1 ? 'disabled' : ''}>
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>
        ${pages
          .map((page) => {
            if (page === '...') {
              return '<span class="px-2 text-muted-foreground">...</span>'
            }
            return `<button class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm ${page === currentPage ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-project-action="page-to" data-page="${page}">${page}</button>`
          })
          .join('')}
        <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-pcs-project-action="page-next" ${currentPage >= totalPages ? 'disabled' : ''}>
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    </footer>
  `
}

function renderDataSection(): string {
  const paging = getPaginatedProjects()

  return `
    <section class="rounded-lg border bg-card shadow-sm">
      ${
        state.viewMode === 'list'
          ? renderProjectListTable(paging.rows)
          : `<div class="p-4">${renderProjectGrid(paging.rows)}</div>`
      }
      ${renderPagination(paging.total, paging.totalPages, paging.currentPage, paging.from, paging.to)}
    </section>
  `
}

function renderDetailDrawer(): string {
  const project = getProjectById(state.detailProjectId)
  if (!project) return ''

  const progress = Math.round((project.progressDone / Math.max(project.progressTotal, 1)) * 100)

  const content = `
    <div class="-mt-4 mb-4 border-b pb-4">
      <h2 class="text-lg font-semibold">${escapeHtml(project.name)}</h2>
      <p class="font-mono text-xs text-muted-foreground">${escapeHtml(project.code)}</p>
    </div>

    <section class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-sm font-semibold">基本情况</h3>
      <div class="grid gap-3 text-sm sm:grid-cols-2">
        <div><span class="text-muted-foreground">项目状态：</span>${renderBadge(project.status, STATUS_COLORS[project.status])}</div>
        <div><span class="text-muted-foreground">款式类型：</span>${renderBadge(project.styleType, STYLE_TYPE_COLORS[project.styleType])}</div>
        <div><span class="text-muted-foreground">当前阶段：</span>${escapeHtml(project.phaseName)}</div>
        <div><span class="text-muted-foreground">负责人：</span>${escapeHtml(project.owner)}</div>
        <div><span class="text-muted-foreground">分类：</span>${escapeHtml(project.category)}</div>
        <div><span class="text-muted-foreground">最近更新：</span>${escapeHtml(project.updatedAt)}</div>
      </div>
    </section>

    <section class="rounded-lg border bg-card p-4 mt-4">
      <h3 class="mb-3 text-sm font-semibold">进度与下一步</h3>
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between"><span class="text-muted-foreground">项目进度</span><span>${project.progressDone}/${project.progressTotal}（${progress}%）</span></div>
        <div class="h-2 overflow-hidden rounded-full bg-muted"><span class="block h-full rounded-full bg-blue-600" style="width:${progress}%"></span></div>
        <div><span class="text-muted-foreground">下一工作项：</span>${escapeHtml(project.nextWorkItemName)}（${escapeHtml(project.nextWorkItemStatus)}）</div>
        ${project.hasPendingDecision ? '<p class="text-xs text-orange-700">当前存在待决策节点，请优先处理。</p>' : ''}
        ${project.isBlocked && project.gateReason ? `<p class="text-xs text-red-700">当前生产暂停：${escapeHtml(project.gateReason)}</p>` : ''}
      </div>
    </section>

    <section class="rounded-lg border bg-card p-4 mt-4">
      <h3 class="mb-3 text-sm font-semibold">风险</h3>
      ${project.riskStatus === '延期'
        ? `<div class="space-y-2 text-sm">
            <div><span class="text-muted-foreground">风险状态：</span><span class="text-orange-700">延期</span></div>
            <div><span class="text-muted-foreground">延期原因：</span>${escapeHtml(project.riskReason ?? '-')}</div>
            <div><span class="text-muted-foreground">关联工作项：</span>${escapeHtml(project.riskWorkItem ?? '-')}</div>
            <div><span class="text-muted-foreground">已持续：</span>${project.riskDurationDays ?? 0} 天</div>
          </div>`
        : '<p class="text-sm text-green-700">当前风险状态正常。</p>'
      }
    </section>

    <section class="rounded-lg border bg-card p-4 mt-4">
      <h3 class="mb-3 text-sm font-semibold">标签</h3>
      <div class="flex flex-wrap gap-2">
        ${project.tags.map((tag) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </section>
  `

  return uiDetailDrawer(
    {
      title: '项目详情',
      closeAction: { prefix: 'pcs-project', action: 'close-detail' },
      width: 'lg',
    },
    content
  )
}

function renderTerminateDialog(): string {
  if (!state.terminateDialog.open) return ''
  const project = getProjectById(state.terminateDialog.projectId)

  const formContent = `
    <div class="space-y-3">
      <p class="text-sm">项目：<span class="font-medium">${escapeHtml(project?.name ?? '-')}</span></p>
      <div>
        <label class="mb-1 block text-xs text-muted-foreground">终止原因</label>
        <textarea class="min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入终止原因..." data-pcs-project-field="terminateReason">${escapeHtml(state.terminateReason)}</textarea>
      </div>
      <p class="text-xs text-muted-foreground">此操作将记录在项目日志中。</p>
    </div>
  `

  return renderFormDialog(
    {
      title: '终止项目',
      closeAction: { prefix: 'pcs-project', action: 'close-terminate' },
      submitAction: { prefix: 'pcs-project', action: 'confirm-terminate', label: '确认终止' },
      width: 'md',
      submitDisabled: !state.terminateReason.trim(),
    },
    formContent
  )
}

export function renderPcsProjectsPage(): string {
  const paging = getPaginatedProjects()
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderToolbar()}
      ${renderViewToggle(paging.total, paging.from, paging.to)}
      ${renderDataSection()}
      ${renderDetailDrawer()}
      ${renderTerminateDialog()}
    </div>
  `
}

function batchCopyCodes(): void {
  const selected = state.projects.filter((project) => state.selectedProjects.includes(project.id))
  const payload = selected.map((project) => project.code).join('\n')
  try {
    void navigator.clipboard.writeText(payload)
    state.notice = `已复制 ${selected.length} 个项目编码。`
  } catch {
    state.notice = '复制失败，请手动复制。'
  }
}

function removeSelectedProjects(): void {
  const selectedCount = state.selectedProjects.length
  if (selectedCount === 0) return
  state.projects = state.projects.filter((project) => !state.selectedProjects.includes(project.id))
  state.selectedProjects = []
  state.notice = `已删除 ${selectedCount} 个项目（演示态）。`
}

function duplicateProject(projectId: string): void {
  const project = getProjectById(projectId)
  if (!project) return

  const serial = state.projects.length + 1
  const cloneId = `${project.id}_copy_${serial}`
  const clone: Project = {
    ...project,
    id: cloneId,
    code: `PRJ-2026${String(1000 + serial).slice(-4)}-C${String(serial).padStart(2, '0')}`,
    name: `${project.name}（复制）`,
    updatedAt: nowText(),
    status: '进行中',
  }
  state.projects = [clone, ...state.projects]
  state.notice = `已复制项目：${project.name}`
}

function archiveProject(projectId: string): void {
  const project = getProjectById(projectId)
  if (!project || project.status !== '进行中') return
  state.projects = state.projects.map((item) =>
    item.id === projectId ? { ...item, status: '已归档', phaseName: '已归档', updatedAt: nowText() } : item,
  )
  state.notice = `项目 ${project.name} 已归档（演示态）。`
}

function terminateProject(projectId: string, reason: string): void {
  const project = getProjectById(projectId)
  if (!project) return

  state.projects = state.projects.map((item) =>
    item.id === projectId
      ? {
          ...item,
          status: '已终止',
          phaseName: '已终止',
          updatedAt: nowText(),
          riskStatus: '延期',
          riskReason: reason,
        }
      : item,
  )
  state.notice = `项目 ${project.name} 已终止（演示态）。`
}

function closePanels(): void {
  if (state.terminateDialog.open) {
    state.terminateDialog = { open: false, projectId: null }
    return
  }
  if (state.detailProjectId) {
    state.detailProjectId = null
  }
}

export function handlePcsProjectsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-field]')
  if (fieldNode instanceof HTMLInputElement) {
    const field = fieldNode.dataset.pcsProjectField
    if (field === 'searchTerm') {
      state.searchTerm = fieldNode.value
      state.currentPage = 1
      return true
    }
  }

  if (fieldNode instanceof HTMLTextAreaElement && fieldNode.dataset.pcsProjectField === 'terminateReason') {
    state.terminateReason = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsProjectField
    if (field === 'sortBy') {
      state.sortBy = fieldNode.value as SortBy
      state.currentPage = 1
      return true
    }
    if (field === 'owner') {
      state.advancedFilters.owner = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'phase') {
      state.advancedFilters.phase = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'dateRange') {
      state.advancedFilters.dateRange = fieldNode.value as DateRangeFilter
      state.currentPage = 1
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-project-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsProjectAction
  if (!action) return false

  if (action === 'query') {
    state.notice = '已按当前条件查询（演示态）。'
    return true
  }

  if (action === 'create-project') {
    state.notice = '新建商品项目入口已触发（演示态），后续可接入新建页。'
    return true
  }

  if (action === 'reset-filters') {
    clearFilters()
    return true
  }

  if (action === 'toggle-advanced') {
    state.showAdvancedFilters = !state.showAdvancedFilters
    return true
  }

  if (action === 'set-style-type') {
    const styleType = actionNode.dataset.styleType as QuickFilters['styleType'] | undefined
    if (styleType) {
      state.quickFilters.styleType = styleType
      state.currentPage = 1
    }
    return true
  }

  if (action === 'set-status') {
    const status = actionNode.dataset.status as QuickFilters['status'] | undefined
    if (status) {
      state.quickFilters.status = status
      state.currentPage = 1
    }
    return true
  }

  if (action === 'toggle-pending-decision') {
    state.quickFilters.pendingDecision = !state.quickFilters.pendingDecision
    state.currentPage = 1
    return true
  }

  if (action === 'set-risk-status') {
    const riskStatus = actionNode.dataset.riskStatus as QuickFilters['riskStatus'] | undefined
    if (riskStatus) {
      state.quickFilters.riskStatus = riskStatus
      state.currentPage = 1
    }
    return true
  }

  if (action === 'set-view-mode') {
    const viewMode = actionNode.dataset.viewMode as ViewMode | undefined
    if (viewMode) state.viewMode = viewMode
    return true
  }

  if (action === 'toggle-select') {
    const projectId = actionNode.dataset.projectId
    if (projectId) selectProject(projectId)
    return true
  }

  if (action === 'toggle-select-all-page') {
    selectAllOnCurrentPage()
    return true
  }

  if (action === 'open-detail') {
    const projectId = actionNode.dataset.projectId
    if (projectId) appStore.navigate(`/pcs/projects/${projectId}`)
    return true
  }

  if (action === 'close-detail') {
    state.detailProjectId = null
    return true
  }

  if (action === 'copy-code') {
    const code = actionNode.dataset.projectCode
    if (code) {
      try {
        void navigator.clipboard.writeText(code)
        state.notice = `项目编码已复制：${code}`
      } catch {
        state.notice = '复制失败，请手动复制。'
      }
    }
    return true
  }

  if (action === 'show-risk') {
    const projectId = actionNode.dataset.projectId
    if (!projectId) return true
    const project = getProjectById(projectId)
    if (!project) return true
    state.notice = `延期原因：${project.riskReason ?? '-'}；关联工作项：${project.riskWorkItem ?? '-'}；已持续：${project.riskDurationDays ?? 0}天`
    return true
  }

  if (action === 'duplicate') {
    const projectId = actionNode.dataset.projectId
    if (projectId) duplicateProject(projectId)
    return true
  }

  if (action === 'archive') {
    const projectId = actionNode.dataset.projectId
    if (projectId) archiveProject(projectId)
    return true
  }

  if (action === 'open-terminate') {
    const projectId = actionNode.dataset.projectId
    if (!projectId) return true
    state.terminateDialog = { open: true, projectId }
    state.terminateReason = ''
    return true
  }

  if (action === 'close-terminate') {
    state.terminateDialog = { open: false, projectId: null }
    state.terminateReason = ''
    return true
  }

  if (action === 'confirm-terminate') {
    if (!state.terminateDialog.projectId || !state.terminateReason.trim()) return true
    terminateProject(state.terminateDialog.projectId, state.terminateReason.trim())
    state.terminateDialog = { open: false, projectId: null }
    state.terminateReason = ''
    return true
  }

  if (action === 'batch-export') {
    state.notice = `已创建批量导出任务（演示态），共 ${state.selectedProjects.length} 个项目。`
    return true
  }

  if (action === 'batch-copy') {
    batchCopyCodes()
    return true
  }

  if (action === 'batch-delete') {
    removeSelectedProjects()
    return true
  }

  if (action === 'page-prev') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'page-next') {
    const totalPages = getPaginatedProjects().totalPages
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'page-to') {
    const page = Number(actionNode.dataset.page)
    if (!Number.isNaN(page)) {
      const totalPages = getPaginatedProjects().totalPages
      state.currentPage = Math.max(1, Math.min(totalPages, page))
    }
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'close-dialog') {
    closePanels()
    return true
  }

  return false
}

export function isPcsProjectsDialogOpen(): boolean {
  return state.detailProjectId !== null || state.terminateDialog.open
}
