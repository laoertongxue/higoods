import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  copyPcsWorkItem,
  listPcsWorkItems,
  togglePcsWorkItemStatus,
  type PcsWorkItemListItem,
  type WorkItemStatus,
} from '../data/pcs-work-items'
import { renderConfirmDialog } from '../components/ui'

type NatureFilter = 'all' | PcsWorkItemListItem['nature']
type StatusFilter = 'all' | WorkItemStatus

interface ToggleDialogState {
  open: boolean
  workItemId: string | null
  nextStatus: WorkItemStatus
}

interface ListPageState {
  searchQuery: string
  natureFilter: NatureFilter
  phaseFilter: 'all' | string
  statusFilter: StatusFilter
  page: number
  pageSize: number
  notice: string | null
  dialog: ToggleDialogState
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: ListPageState = {
  searchQuery: '',
  natureFilter: 'all',
  phaseFilter: 'all',
  statusFilter: 'all',
  page: 1,
  pageSize: 10,
  notice: '工作项库已统一为正式定义来源，模板页只能从这里选择标准工作项。',
  dialog: {
    open: false,
    workItemId: null,
    nextStatus: '停用',
  },
}

function getPhaseOptions(): string[] {
  return Array.from(new Set(listPcsWorkItems().map((item) => item.phaseName))).sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  )
}

function getStatusBadge(status: WorkItemStatus): string {
  if (status === '启用') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">启用</span>'
  }
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">停用</span>'
}

function getNatureBadge(nature: PcsWorkItemListItem['nature']): string {
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

function getFilteredItems(): PcsWorkItemListItem[] {
  const keyword = state.searchQuery.trim().toLowerCase()
  return listPcsWorkItems().filter((item) => {
    const matchKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.id.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      item.desc.toLowerCase().includes(keyword)
    const matchNature = state.natureFilter === 'all' || item.nature === state.natureFilter
    const matchStatus = state.statusFilter === 'all' || item.status === state.statusFilter
    const matchPhase = state.phaseFilter === 'all' || item.phaseName === state.phaseFilter
    return matchKeyword && matchNature && matchStatus && matchPhase
  })
}

function getPagination(items: PcsWorkItemListItem[]) {
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
  const all = listPcsWorkItems()
  const builtin = all.filter((item) => item.isBuiltin).length
  const custom = all.length - builtin
  const selectable = all.filter((item) => item.isSelectableForTemplate && item.status === '启用').length

  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">工作项库</h1>
          <p class="mt-1 text-sm text-muted-foreground">内置工作项和自定义工作项统一收口为正式定义目录。</p>
        </div>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-work-library-action="go-create">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增自定义工作项
        </button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">工作项总数</p>
          <p class="mt-1 text-xl font-semibold">${all.length}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">内置工作项</p>
          <p class="mt-1 text-xl font-semibold text-blue-700">${builtin}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">自定义工作项</p>
          <p class="mt-1 text-xl font-semibold text-slate-700">${custom}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">可供模板选择</p>
          <p class="mt-1 text-xl font-semibold text-emerald-700">${selectable}</p>
        </article>
      </div>
    </header>
  `
}

function renderFilters(): string {
  const phaseOptions = getPhaseOptions()
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px_140px_auto]">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索编号、编码、名称或说明" value="${escapeHtml(state.searchQuery)}" data-pcs-work-library-field="searchQuery" />
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
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-work-library-field="statusFilter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="启用" ${state.statusFilter === '启用' ? 'selected' : ''}>启用</option>
            <option value="停用" ${state.statusFilter === '停用' ? 'selected' : ''}>停用</option>
          </select>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-work-library-action="reset-filters">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(rows: PcsWorkItemListItem[]): string {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="10" class="px-4 py-14 text-center text-muted-foreground">
          <i data-lucide="file-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">暂无工作项数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map(
      (item) => `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-library-action="go-detail" data-work-item-id="${escapeHtml(item.id)}">详情</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-library-action="go-edit" data-work-item-id="${escapeHtml(item.id)}">编辑</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-work-library-action="copy" data-work-item-id="${escapeHtml(item.id)}">复制</button>
              ${
                item.isBuiltin
                  ? '<span class="inline-flex h-7 items-center rounded-md border border-slate-200 px-2 text-xs text-slate-500">内置固定</span>'
                  : `<button class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${item.status === '启用' ? 'text-orange-700 hover:bg-orange-50' : 'text-emerald-700 hover:bg-emerald-50'}" data-pcs-work-library-action="open-toggle-dialog" data-work-item-id="${escapeHtml(item.id)}">${item.status === '启用' ? '停用' : '启用'}</button>`
              }
            </div>
          </td>
          <td class="px-3 py-3 align-top">
            <button class="text-left font-medium text-blue-700 hover:underline" data-pcs-work-library-action="go-detail" data-work-item-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(item.id)} ｜ ${escapeHtml(item.code)}</p>
          </td>
          <td class="px-3 py-3 align-top">${escapeHtml(item.phaseName)}</td>
          <td class="px-3 py-3 align-top">${getNatureBadge(item.nature)}</td>
          <td class="px-3 py-3 align-top">${escapeHtml(item.category)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              ${item.capabilities.map((capability) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(capability)}</span>`).join('')}
            </div>
          </td>
          <td class="px-3 py-3 align-top">${escapeHtml(item.role)}</td>
          <td class="px-3 py-3 align-top">${item.isSelectableForTemplate ? '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">可选</span>' : '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">不可选</span>'}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(item.updatedAt)}</td>
          <td class="px-3 py-3 align-top">${getStatusBadge(item.status)}</td>
        </tr>
      `,
    )
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredItems()
  const paging = getPagination(filtered)
  state.page = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1380px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">操作</th>
              <th class="px-3 py-2 font-medium">正式编号 / 编码</th>
              <th class="px-3 py-2 font-medium">所属阶段</th>
              <th class="px-3 py-2 font-medium">工作项性质</th>
              <th class="px-3 py-2 font-medium">工作项类别</th>
              <th class="px-3 py-2 font-medium">能力</th>
              <th class="px-3 py-2 font-medium">默认角色</th>
              <th class="px-3 py-2 font-medium">模板可选</th>
              <th class="px-3 py-2 font-medium">最近更新时间</th>
              <th class="px-3 py-2 font-medium">状态</th>
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

function renderToggleDialog(): string {
  if (!state.dialog.open || !state.dialog.workItemId) return ''
  const current = listPcsWorkItems().find((item) => item.id === state.dialog.workItemId)
  if (!current) return ''

  return renderConfirmDialog({
    title: `确认${state.dialog.nextStatus}`,
    description: state.dialog.nextStatus === '停用' ? '停用后该自定义工作项将不能继续被模板选择。' : '启用后该自定义工作项可重新用于模板选择。',
    closeAction: { prefix: 'pcs-work-library', action: 'close-toggle-dialog' },
    confirmAction: {
      prefix: 'pcs-work-library',
      action: 'confirm-toggle-dialog',
      label: `确认${state.dialog.nextStatus}`,
      attrs: {
        'data-work-item-id': current.id,
      },
    },
    cancelLabel: '取消',
  })
}

export function renderPcsWorkItemsPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderFilters()}
      ${renderTable()}
      ${renderToggleDialog()}
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
    if (field === 'statusFilter') {
      state.statusFilter = fieldNode.value as StatusFilter
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

  if (action === 'go-create') {
    appStore.navigate('/pcs/work-items/create')
    return true
  }
  if (action === 'go-detail') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    appStore.navigate(`/pcs/work-items/${workItemId}`)
    return true
  }
  if (action === 'go-edit') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    appStore.navigate(`/pcs/work-items/${workItemId}/edit`)
    return true
  }
  if (action === 'copy') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    const copied = copyPcsWorkItem(workItemId)
    if (!copied) return false
    appStore.navigate(`/pcs/work-items/${copied.workItemId}`)
    return true
  }
  if (action === 'open-toggle-dialog') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    const current = listPcsWorkItems().find((item) => item.id === workItemId)
    if (!current || current.isBuiltin) return false
    state.dialog = {
      open: true,
      workItemId,
      nextStatus: current.status === '启用' ? '停用' : '启用',
    }
    return true
  }
  if (action === 'confirm-toggle-dialog') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId) return false
    togglePcsWorkItemStatus(workItemId)
    state.dialog = { open: false, workItemId: null, nextStatus: '停用' }
    return true
  }
  if (action === 'close-toggle-dialog') {
    state.dialog = { open: false, workItemId: null, nextStatus: '停用' }
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
    state.statusFilter = 'all'
    state.page = 1
    return true
  }
  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    return true
  }
  if (action === 'next-page') {
    state.page += 1
    return true
  }

  return false
}

export function isPcsWorkItemsDialogOpen(): boolean {
  return state.dialog.open
}

