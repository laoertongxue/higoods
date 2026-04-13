import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  buildPcsWorkItemLibraryOverview,
  listPcsWorkItemLibraryRows,
  type PcsWorkItemLibraryListRow,
} from '../data/pcs-work-item-library-view-model.ts'

type NatureFilter = 'all' | PcsWorkItemLibraryListRow['nature']

interface ListPageState {
  searchQuery: string
  natureFilter: NatureFilter
  phaseFilter: 'all' | string
  page: number
  pageSize: number
  notice: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: ListPageState = {
  searchQuery: '',
  natureFilter: 'all',
  phaseFilter: 'all',
  page: 1,
  pageSize: 10,
  notice: '工作项库已收口为标准只读目录，所有字段、状态、操作和承载方式都以正式定义层为准。',
}

function getPhaseOptions(): string[] {
  return Array.from(new Set(listPcsWorkItemLibraryRows().map((item) => item.phaseName)))
}

function getNatureBadge(nature: PcsWorkItemLibraryListRow['nature']): string {
  if (nature === '决策类') {
    return '<span class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700">决策类</span>'
  }
  if (nature === '里程碑类') {
    return '<span class="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700">里程碑类</span>'
  }
  if (nature === '事实类') {
    return '<span class="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">事实类</span>'
  }
  return '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">执行类</span>'
}

function renderReadonlyBadge(): string {
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">内置固定</span>'
}

function renderDisplayKindBadge(kind: PcsWorkItemLibraryListRow['libraryDisplayKind']): string {
  if (kind === '独立实例模块') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">独立实例模块</span>'
  }
  if (kind === '聚合节点') {
    return '<span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">聚合节点</span>'
  }
  if (kind === '项目内记录') {
    return '<span class="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">项目内记录</span>'
  }
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">项目内单节点</span>'
}

function getFilteredItems(): PcsWorkItemLibraryListRow[] {
  const keyword = state.searchQuery.trim().toLowerCase()
  return listPcsWorkItemLibraryRows().filter((item) => {
    const matchKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.id.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      item.desc.toLowerCase().includes(keyword) ||
      item.primaryModuleOrDisplay.toLowerCase().includes(keyword) ||
      item.primaryModuleHint.toLowerCase().includes(keyword)
    const matchNature = state.natureFilter === 'all' || item.nature === state.natureFilter
    const matchPhase = state.phaseFilter === 'all' || item.phaseName === state.phaseFilter
    return matchKeyword && matchNature && matchPhase
  })
}

function getPagination(items: PcsWorkItemLibraryListRow[]) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.page), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize
  return {
    rows: items.slice(start, end),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : start + 1,
    to: total === 0 ? 0 : Math.min(end, total),
  }
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-work-library-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  const overview = buildPcsWorkItemLibraryOverview()

  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">工作项库</h1>
          <p class="mt-1 text-sm text-muted-foreground">只读指标总览，集中说明每个标准工作项的字段规模、状态数量、操作数量和实例承载方式。</p>
        </div>
        <div class="flex items-center gap-2">${renderReadonlyBadge()}</div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">标准工作项总数</p>
          <p class="mt-1 text-xl font-semibold">${overview.totalCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">覆盖阶段数</p>
          <p class="mt-1 text-xl font-semibold text-blue-700">${overview.phaseCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">有独立实例列表的工作项数</p>
          <p class="mt-1 text-xl font-semibold text-emerald-700">${overview.standaloneCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">项目内执行的工作项数</p>
          <p class="mt-1 text-xl font-semibold text-slate-700">${overview.projectExecutionCount}</p>
        </article>
      </div>
    </header>
  `
}

function renderFilters(): string {
  const phaseOptions = getPhaseOptions()
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索编号、编码、名称、承载模块或项目内展示方式" value="${escapeHtml(state.searchQuery)}" data-pcs-work-library-field="searchQuery" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">工作项性质</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-work-library-field="natureFilter">
            <option value="all" ${state.natureFilter === 'all' ? 'selected' : ''}>全部类型</option>
            <option value="执行类" ${state.natureFilter === '执行类' ? 'selected' : ''}>执行类</option>
            <option value="决策类" ${state.natureFilter === '决策类' ? 'selected' : ''}>决策类</option>
            <option value="里程碑类" ${state.natureFilter === '里程碑类' ? 'selected' : ''}>里程碑类</option>
            <option value="事实类" ${state.natureFilter === '事实类' ? 'selected' : ''}>事实类</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">所属阶段</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-work-library-field="phaseFilter">
            <option value="all" ${state.phaseFilter === 'all' ? 'selected' : ''}>全部阶段</option>
            ${phaseOptions.map((item) => `<option value="${escapeHtml(item)}" ${state.phaseFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-library-action="reset-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(rows: PcsWorkItemLibraryListRow[]): string {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="11" class="px-4 py-14 text-center text-muted-foreground">
          <i data-lucide="file-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">暂无符合条件的工作项</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((item) => {
      const legacyModeText =
        item.legacyReferenceUseMode === 'DIRECT_MAPPING'
          ? '旧版直接映射'
          : item.legacyReferenceUseMode === 'PARTIAL_REFERENCE'
            ? '旧版部分参考'
            : item.legacyReferenceUseMode === 'DISPLAY_ONLY'
              ? '旧版展示参考'
              : '无旧版参考'
      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-library-action="go-detail" data-work-item-id="${escapeHtml(item.id)}">查看</button>
          </td>
          <td class="px-3 py-3 align-top">
            <button class="text-left font-medium text-blue-700 hover:underline" data-pcs-work-library-action="go-detail" data-work-item-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(item.id)} ｜ ${escapeHtml(item.code)}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1">
              ${renderReadonlyBadge()}
              <span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(legacyModeText)}</span>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(item.desc)}</p>
          </td>
          <td class="px-3 py-3 align-top">${escapeHtml(item.phaseName)}</td>
          <td class="px-3 py-3 align-top">${getNatureBadge(item.nature)}</td>
          <td class="px-3 py-3 align-top text-sm">${escapeHtml(item.role)}</td>
          <td class="px-3 py-3 align-top"><span class="text-sm font-medium">${item.fieldCount}</span><span class="ml-1 text-xs text-muted-foreground">个</span></td>
          <td class="px-3 py-3 align-top"><span class="text-sm font-medium">${item.statusCount}</span><span class="ml-1 text-xs text-muted-foreground">个</span></td>
          <td class="px-3 py-3 align-top"><span class="text-sm font-medium">${item.operationCount}</span><span class="ml-1 text-xs text-muted-foreground">个</span></td>
          <td class="px-3 py-3 align-top">
            <div>${renderDisplayKindBadge(item.libraryDisplayKind)}</div>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.runtimeCarrierLabel)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <span class="inline-flex rounded-full border ${item.hasStandaloneInstanceList ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'} px-2 py-0.5 text-xs">${escapeHtml(item.standaloneInstanceText)}</span>
          </td>
          <td class="px-3 py-3 align-top">
            <p class="text-sm font-medium">${escapeHtml(item.primaryModuleOrDisplay)}</p>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.primaryModuleHint)}</p>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredItems()
  const paging = getPagination(filtered)
  state.page = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1560px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">查看</th>
              <th class="px-3 py-2 font-medium">工作项</th>
              <th class="px-3 py-2 font-medium">所属阶段</th>
              <th class="px-3 py-2 font-medium">工作项性质</th>
              <th class="px-3 py-2 font-medium">默认角色</th>
              <th class="px-3 py-2 font-medium">字段</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
              <th class="px-3 py-2 font-medium">实例承载方式</th>
              <th class="px-3 py-2 font-medium">独立实例列表</th>
              <th class="px-3 py-2 font-medium">主实例模块 / 项目内展示方式</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
        <p class="text-muted-foreground">当前显示 ${paging.from}-${paging.to} / 共 ${paging.total} 条</p>
        <div class="flex items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-work-library-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((option) => `<option value="${option}" ${option === state.pageSize ? 'selected' : ''}>${option} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-work-library-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">第 ${paging.currentPage} / ${paging.totalPages} 页</span>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-50' : ''}" data-pcs-work-library-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

export function renderPcsWorkItemsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderFilters()}
      ${renderTable()}
    </div>
  `
}

export function handlePcsWorkItemsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-work-library-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.pcsWorkLibraryField === 'searchQuery') {
    state.searchQuery = fieldNode.value
    state.page = 1
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsWorkLibraryField
    if (field === 'natureFilter') {
      state.natureFilter = fieldNode.value as NatureFilter
      state.page = 1
      return true
    }
    if (field === 'phaseFilter') {
      state.phaseFilter = fieldNode.value
      state.page = 1
      return true
    }
    if (field === 'pageSize') {
      state.pageSize = Number(fieldNode.value) || 10
      state.page = 1
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-work-library-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsWorkLibraryAction
  if (!action) return false

  if (action === 'go-detail') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    appStore.navigate(`/pcs/work-items/${workItemId}`)
    return true
  }
  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'reset-filters') {
    state.searchQuery = ''
    state.natureFilter = 'all'
    state.phaseFilter = 'all'
    state.page = 1
    return true
  }
  if (action === 'prev-page' && state.page > 1) {
    state.page -= 1
    return true
  }
  if (action === 'next-page') {
    state.page += 1
    return true
  }
  return false
}

export function isPcsWorkItemsDialogOpen(): boolean {
  return false
}
