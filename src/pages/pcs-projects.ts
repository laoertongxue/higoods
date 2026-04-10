import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  buildProjectListViewModels,
  getProjectListFilterCatalog,
  type ProjectListItemViewModel,
} from '../data/pcs-project-view-model'

type ViewMode = 'grid' | 'list'
type SortBy = 'updatedAt' | 'pendingNode' | 'issue' | 'progressLow'

interface ProjectListState {
  viewMode: ViewMode
  searchTerm: string
  ownerFilter: string
  phaseFilter: string
  statusFilter: string
  showAdvancedFilters: boolean
  selectedProjects: string[]
  sortBy: SortBy
  currentPage: number
  itemsPerPage: number
  notice: string | null
}

const state: ProjectListState = {
  viewMode: 'list',
  searchTerm: '',
  ownerFilter: 'all',
  phaseFilter: 'all',
  statusFilter: 'all',
  showAdvancedFilters: false,
  selectedProjects: [],
  sortBy: 'updatedAt',
  currentPage: 1,
  itemsPerPage: 10,
  notice: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getProjectStatusClass(status: string): string {
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '已立项') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === '已终止') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getNodeStatusClass(status: string): string {
  if (status === '已完成') return 'border-green-200 bg-green-50 text-green-700'
  if (status === '进行中') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === '待确认') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (status === '已取消') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getCoverAccent(styleType: string): { bg: string; fg: string } {
  if (styleType === '基础款') return { bg: 'bg-emerald-50', fg: 'text-emerald-700' }
  if (styleType === '快时尚款') return { bg: 'bg-blue-50', fg: 'text-blue-700' }
  if (styleType === '改版款') return { bg: 'bg-amber-50', fg: 'text-amber-700' }
  return { bg: 'bg-purple-50', fg: 'text-purple-700' }
}

function refreshSelection(rows: ProjectListItemViewModel[]): void {
  const ids = new Set(rows.map((item) => item.projectId))
  state.selectedProjects = state.selectedProjects.filter((projectId) => ids.has(projectId))
}

function getFilteredProjects(): ProjectListItemViewModel[] {
  const rows = buildProjectListViewModels()
  const search = state.searchTerm.trim().toLowerCase()

  const filtered = rows.filter((project) => {
    const matchesSearch =
      !search ||
      project.projectCode.toLowerCase().includes(search) ||
      project.projectName.toLowerCase().includes(search) ||
      project.ownerName.toLowerCase().includes(search) ||
      project.categoryPath.toLowerCase().includes(search)

    const matchesOwner = state.ownerFilter === 'all' || project.ownerName === state.ownerFilter
    const matchesPhase = state.phaseFilter === 'all' || project.currentPhaseCode === state.phaseFilter
    const matchesStatus = state.statusFilter === 'all' || project.projectStatus === state.statusFilter

    return matchesSearch && matchesOwner && matchesPhase && matchesStatus
  })

  filtered.sort((a, b) => {
    if (state.sortBy === 'updatedAt') return b.updatedAt.localeCompare(a.updatedAt)
    if (state.sortBy === 'pendingNode') {
      const pendingDiff = Number(Boolean(b.currentPendingNodeName)) - Number(Boolean(a.currentPendingNodeName))
      if (pendingDiff !== 0) return pendingDiff
      return b.updatedAt.localeCompare(a.updatedAt)
    }
    if (state.sortBy === 'issue') {
      const issueDiff = Number(Boolean(b.currentIssueText)) - Number(Boolean(a.currentIssueText))
      if (issueDiff !== 0) return issueDiff
      return b.updatedAt.localeCompare(a.updatedAt)
    }
    return a.progressPercent - b.progressPercent
  })

  refreshSelection(filtered)
  return filtered
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
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages]
  if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

function selectProject(projectId: string): void {
  if (state.selectedProjects.includes(projectId)) {
    state.selectedProjects = state.selectedProjects.filter((id) => id !== projectId)
    return
  }
  state.selectedProjects = [...state.selectedProjects, projectId]
}

function selectAllOnCurrentPage(): void {
  const pageRows = getPaginatedProjects().rows
  const allSelected = pageRows.length > 0 && pageRows.every((project) => state.selectedProjects.includes(project.projectId))
  if (allSelected) {
    state.selectedProjects = state.selectedProjects.filter((id) => !pageRows.some((project) => project.projectId === id))
    return
  }

  const next = new Set(state.selectedProjects)
  pageRows.forEach((project) => next.add(project.projectId))
  state.selectedProjects = Array.from(next)
}

function clearFilters(): void {
  state.searchTerm = ''
  state.ownerFilter = 'all'
  state.phaseFilter = 'all'
  state.statusFilter = 'all'
  state.sortBy = 'updatedAt'
  state.currentPage = 1
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
        <p class="text-sm text-muted-foreground">列表、详情和节点详情统一读取项目主记录、阶段记录和工作项节点。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${
          state.selectedProjects.length > 0
            ? `
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-action="batch-export">批量导出（${state.selectedProjects.length}）</button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-action="batch-copy">批量复制</button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-action="batch-delete">批量移除</button>
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
  const catalog = getProjectListFilterCatalog()
  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: 'updatedAt', label: '最近更新时间' },
    { value: 'pendingNode', label: '当前待处理工作项优先' },
    { value: 'issue', label: '当前问题优先' },
    { value: 'progressLow', label: '完成情况从低到高' },
  ]

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <div class="min-w-[260px] flex-1">
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索项目编号、项目名称、负责人、分类" value="${escapeHtml(state.searchTerm)}" data-pcs-project-field="searchTerm" />
          </div>
        </div>
        <div class="w-[190px]">
          <label class="mb-1 block text-xs text-muted-foreground">排序</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="sortBy">
            ${sortOptions
              .map((option) => `<option value="${option.value}" ${state.sortBy === option.value ? 'selected' : ''}>${option.label}</option>`)
              .join('')}
          </select>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-action="reset-filters">重置筛选</button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-action="toggle-advanced">
            <i data-lucide="${state.showAdvancedFilters ? 'chevron-up' : 'chevron-down'}" class="mr-1 h-4 w-4"></i>高级筛选
          </button>
        </div>
      </div>

      ${
        state.showAdvancedFilters
          ? `
            <div class="grid gap-3 border-t pt-4 md:grid-cols-3">
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">负责人</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="ownerFilter">
                  <option value="all" ${state.ownerFilter === 'all' ? 'selected' : ''}>全部</option>
                  ${catalog.owners
                    .map((owner) => `<option value="${escapeHtml(owner)}" ${state.ownerFilter === owner ? 'selected' : ''}>${escapeHtml(owner)}</option>`)
                    .join('')}
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">当前阶段</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="phaseFilter">
                  <option value="all" ${state.phaseFilter === 'all' ? 'selected' : ''}>全部</option>
                  ${catalog.phases
                    .map((phase) => `<option value="${escapeHtml(phase.code)}" ${state.phaseFilter === phase.code ? 'selected' : ''}>${escapeHtml(phase.name)}</option>`)
                    .join('')}
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">项目状态</label>
                <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-project-field="statusFilter">
                  <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部</option>
                  ${catalog.statuses
                    .map((status) => `<option value="${escapeHtml(status)}" ${state.statusFilter === status ? 'selected' : ''}>${escapeHtml(status)}</option>`)
                    .join('')}
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

function renderProjectListRow(project: ProjectListItemViewModel): string {
  const coverAccent = getCoverAccent(project.styleType)
  const allSelected = state.selectedProjects.includes(project.projectId)

  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40">
      <td class="px-3 py-2 align-top">
        <input type="checkbox" class="mt-1 h-4 w-4 rounded border" ${allSelected ? 'checked' : ''} data-pcs-project-action="toggle-select" data-project-id="${escapeHtml(project.projectId)}" />
      </td>
      <td class="px-3 py-2 align-top">
        <button class="group flex min-w-[240px] items-start gap-3 text-left" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.projectId)}">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded ${coverAccent.bg}">
            <span class="text-[10px] font-medium ${coverAccent.fg}">${escapeHtml(project.styleType)}</span>
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate font-medium group-hover:text-blue-700">${escapeHtml(project.projectName)}</span>
              ${renderBadge(project.projectStatus, getProjectStatusClass(project.projectStatus))}
            </div>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">标签：${project.tags.map((tag) => escapeHtml(tag)).join('、') || '无'}</p>
          </div>
        </button>
      </td>
      <td class="px-3 py-2 align-top font-mono text-xs">${escapeHtml(project.projectCode)}</td>
      <td class="px-3 py-2 align-top">
        <div class="space-y-1">
          <div>${escapeHtml(project.projectType)}</div>
          <div>${renderBadge(project.styleType, `${coverAccent.bg} ${coverAccent.fg} border-transparent`)}</div>
        </div>
      </td>
      <td class="px-3 py-2 align-top">${escapeHtml(project.categoryPath)}</td>
      <td class="px-3 py-2 align-top">${escapeHtml(project.currentPhaseName)}</td>
      <td class="px-3 py-2 align-top">
        ${
          project.currentPendingNodeName
            ? `
              <div class="space-y-1">
                <div class="font-medium">${escapeHtml(project.currentPendingNodeName)}</div>
                ${project.currentPendingNodeStatus ? renderBadge(project.currentPendingNodeStatus, getNodeStatusClass(project.currentPendingNodeStatus)) : ''}
              </div>
            `
            : '<span class="text-muted-foreground">无</span>'
        }
      </td>
      <td class="px-3 py-2 align-top">
        ${project.currentIssueText ? `<span class="text-orange-700">${escapeHtml(project.currentIssueText)}</span>` : '<span class="text-muted-foreground">无</span>'}
      </td>
      <td class="px-3 py-2 align-top">
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>${project.completedNodeCount}/${project.totalNodeCount}</span>
            <span>${project.progressPercent}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <span class="block h-full rounded-full bg-blue-600" style="width:${project.progressPercent}%"></span>
          </div>
        </div>
      </td>
      <td class="px-3 py-2 align-top">${escapeHtml(project.ownerName)}</td>
      <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(project.updatedAt)}</td>
      <td class="px-3 py-2 align-top">
        <div class="flex flex-wrap gap-1">
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.projectId)}">查看详情</button>
          <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-project-action="duplicate" data-project-id="${escapeHtml(project.projectId)}">复制项目</button>
        </div>
      </td>
    </tr>
  `
}

function renderProjectListTable(rows: ProjectListItemViewModel[]): string {
  const allSelectedOnPage = rows.length > 0 && rows.every((project) => state.selectedProjects.includes(project.projectId))

  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1400px] text-sm">
        <thead>
          <tr class="border-b bg-muted/30 text-left text-muted-foreground">
            <th class="px-3 py-2 font-medium"><input type="checkbox" class="h-4 w-4 rounded border" ${allSelectedOnPage ? 'checked' : ''} data-pcs-project-action="toggle-select-all-page" /></th>
            <th class="px-3 py-2 font-medium">项目名称</th>
            <th class="px-3 py-2 font-medium">项目编号</th>
            <th class="px-3 py-2 font-medium">项目类型</th>
            <th class="px-3 py-2 font-medium">分类</th>
            <th class="px-3 py-2 font-medium">当前阶段</th>
            <th class="px-3 py-2 font-medium">当前待处理工作项</th>
            <th class="px-3 py-2 font-medium">当前问题</th>
            <th class="px-3 py-2 font-medium">完成情况</th>
            <th class="px-3 py-2 font-medium">负责人</th>
            <th class="px-3 py-2 font-medium">更新时间</th>
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

function renderProjectCard(project: ProjectListItemViewModel): string {
  const coverAccent = getCoverAccent(project.styleType)
  return `
    <article class="overflow-hidden rounded-lg border bg-card">
      <button class="w-full text-left" data-pcs-project-action="open-detail" data-project-id="${escapeHtml(project.projectId)}">
        <div class="relative px-4 py-4 ${coverAccent.bg}">
          <div class="absolute right-3 top-3">${renderBadge(project.projectStatus, getProjectStatusClass(project.projectStatus))}</div>
          <div class="pt-7">
            <h3 class="text-base font-semibold ${coverAccent.fg}">${escapeHtml(project.projectName)}</h3>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(project.projectCode)}</p>
          </div>
        </div>
      </button>

      <div class="space-y-3 p-4 text-sm">
        <div class="space-y-1">
          <div class="flex items-center justify-between"><span class="text-muted-foreground">项目类型</span><span>${escapeHtml(project.projectType)}</span></div>
          <div class="flex items-center justify-between"><span class="text-muted-foreground">分类</span><span>${escapeHtml(project.categoryPath)}</span></div>
          <div class="flex items-center justify-between"><span class="text-muted-foreground">当前阶段</span><span>${escapeHtml(project.currentPhaseName)}</span></div>
          <div class="flex items-center justify-between"><span class="text-muted-foreground">负责人</span><span>${escapeHtml(project.ownerName)}</span></div>
        </div>
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>${project.completedNodeCount}/${project.totalNodeCount}</span>
            <span>${project.progressPercent}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-muted">
            <span class="block h-full rounded-full bg-blue-600" style="width:${project.progressPercent}%"></span>
          </div>
        </div>
        <div class="rounded-lg border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">当前待处理工作项</p>
          <p class="mt-1 text-sm font-medium">${escapeHtml(project.currentPendingNodeName || '无')}</p>
          ${project.currentPendingNodeStatus ? `<div class="mt-2">${renderBadge(project.currentPendingNodeStatus, getNodeStatusClass(project.currentPendingNodeStatus))}</div>` : ''}
        </div>
        <div class="rounded-lg border bg-muted/20 p-3">
          <p class="text-xs text-muted-foreground">当前问题</p>
          <p class="mt-1 text-sm ${project.currentIssueText ? 'text-orange-700' : 'text-muted-foreground'}">${escapeHtml(project.currentIssueText || '无')}</p>
        </div>
      </div>
    </article>
  `
}

function renderProjectGrid(rows: ProjectListItemViewModel[]): string {
  if (rows.length === 0) {
    return `
      <div class="rounded-lg border border-dashed px-4 py-14 text-center text-muted-foreground">
        <i data-lucide="folder-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <p class="mt-2">暂无匹配项目</p>
      </div>
    `
  }

  return `<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${rows.map((project) => renderProjectCard(project)).join('')}</div>`
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
          .map((page) =>
            page === '...'
              ? '<span class="px-2 text-muted-foreground">...</span>'
              : `<button class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm ${page === currentPage ? 'border-blue-300 bg-blue-50 text-blue-700' : 'hover:bg-muted'}" data-pcs-project-action="page-to" data-page="${page}">${page}</button>`,
          )
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
      ${state.viewMode === 'list' ? renderProjectListTable(paging.rows) : `<div class="p-4">${renderProjectGrid(paging.rows)}</div>`}
      ${renderPagination(paging.total, paging.totalPages, paging.currentPage, paging.from, paging.to)}
    </section>
  `
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
    </div>
  `
}

function closePanels(): void {
  if (state.selectedProjects.length > 0) {
    state.selectedProjects = []
  }
}

export function handlePcsProjectsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.pcsProjectField === 'searchTerm') {
    state.searchTerm = fieldNode.value
    state.currentPage = 1
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsProjectField
    if (field === 'sortBy') {
      state.sortBy = fieldNode.value as SortBy
      state.currentPage = 1
      return true
    }
    if (field === 'ownerFilter') {
      state.ownerFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'phaseFilter') {
      state.phaseFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'statusFilter') {
      state.statusFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-project-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectAction
  if (!action) return false

  if (action === 'create-project') {
    appStore.navigate('/pcs/projects/create')
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
  if (action === 'duplicate') {
    const projectId = actionNode.dataset.projectId
    const project = buildProjectListViewModels().find((item) => item.projectId === projectId)
    state.notice = project ? `项目 ${project.projectName} 的复制能力留待下一步补齐。` : '复制能力留待下一步补齐。'
    return true
  }
  if (action === 'batch-export') {
    state.notice = `已选 ${state.selectedProjects.length} 个项目，批量导出留待下一步补齐。`
    return true
  }
  if (action === 'batch-copy') {
    const selected = buildProjectListViewModels().filter((item) => state.selectedProjects.includes(item.projectId))
    const payload = selected.map((item) => item.projectCode).join('\n')
    if (!payload) return true
    try {
      void navigator.clipboard.writeText(payload)
      state.notice = `已复制 ${selected.length} 个项目编号。`
    } catch {
      state.notice = '复制失败，请手动复制。'
    }
    return true
  }
  if (action === 'batch-delete') {
    state.notice = `已选 ${state.selectedProjects.length} 个项目，批量移除留待下一步补齐。`
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
  return false
}
