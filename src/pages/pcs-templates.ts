import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  copyProjectTemplate,
  countTemplateStages,
  countTemplateWorkItems,
  getStatusLabel,
  listProjectTemplates,
  toggleProjectTemplateStatus,
  type ProjectTemplate,
  type TemplateStyleType,
} from '../data/pcs-templates'

type StatusFilter = 'all' | 'active' | 'inactive'
type StyleFilter = 'all' | TemplateStyleType

interface ConfirmDialogState {
  open: boolean
  templateId: string | null
  nextStatusLabel: '启用' | '停用'
}

interface ListPageState {
  searchQuery: string
  styleTypeFilter: StyleFilter
  statusFilter: StatusFilter
  page: number
  pageSize: number
  notice: string | null
  confirmDialog: ConfirmDialogState
}

const STYLE_OPTIONS: Array<{ value: StyleFilter; label: string }> = [
  { value: 'all', label: '全部款式类型' },
  { value: '基础款', label: '基础款' },
  { value: '快时尚款', label: '快时尚款' },
  { value: '改版款', label: '改版款' },
  { value: '设计款', label: '设计款' },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: ListPageState = {
  searchQuery: '',
  styleTypeFilter: 'all',
  statusFilter: 'all',
  page: 1,
  pageSize: 10,
  notice: '已恢复“列表 + 弹窗 + 内页”结构：详情、新建、编辑均为独立内页。',
  confirmDialog: {
    open: false,
    templateId: null,
    nextStatusLabel: '停用',
  },
}

function getStatusBadge(status: 'active' | 'inactive'): string {
  if (status === 'active') {
    return '<span class="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">启用</span>'
  }
  return '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">停用</span>'
}

function getFilteredTemplates(): ProjectTemplate[] {
  const keyword = state.searchQuery.trim().toLowerCase()

  return listProjectTemplates().filter((template) => {
    const matchKeyword =
      keyword.length === 0 ||
      template.name.toLowerCase().includes(keyword) ||
      template.id.toLowerCase().includes(keyword) ||
      template.description.toLowerCase().includes(keyword)

    const matchStyle =
      state.styleTypeFilter === 'all' || template.styleType.includes(state.styleTypeFilter)

    const matchStatus =
      state.statusFilter === 'all' || template.status === state.statusFilter

    return matchKeyword && matchStyle && matchStatus
  })
}

function getPagination(templates: ProjectTemplate[]) {
  const total = templates.length
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
  const currentPage = Math.min(Math.max(1, state.page), totalPages)
  const start = (currentPage - 1) * state.pageSize
  const end = start + state.pageSize

  return {
    rows: templates.slice(start, end),
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
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-template-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  const all = listProjectTemplates()
  const active = all.filter((template) => template.status === 'active').length
  const inactive = all.length - active
  const avgStage = all.length
    ? Math.round(all.reduce((sum, template) => sum + countTemplateStages(template), 0) / all.length)
    : 0

  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">项目模板管理</h1>
          <p class="mt-1 text-sm text-muted-foreground">迁移旧版 PCS 的模板管理结构与 Mock 数据，保留弹窗与内页交互链路。</p>
        </div>
        <button class="inline-flex h-8 items-center rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-50" data-pcs-template-action="go-create">
          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>新增模板
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">模板总数</p>
          <p class="mt-1 text-xl font-semibold">${all.length}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">启用模板</p>
          <p class="mt-1 text-xl font-semibold text-emerald-700">${active}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">停用模板</p>
          <p class="mt-1 text-xl font-semibold text-slate-600">${inactive}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">平均阶段数</p>
          <p class="mt-1 text-xl font-semibold">${avgStage}</p>
        </article>
      </div>
    </header>
  `
}

function renderFilters(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
          <div class="relative">
            <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
            <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="搜索模板名称、编码或说明" value="${escapeHtml(state.searchQuery)}" data-pcs-template-field="searchQuery" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">适用款式类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-template-field="styleTypeFilter">
            ${STYLE_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === state.styleTypeFilter ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">状态</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-pcs-template-field="statusFilter">
            ${STATUS_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === state.statusFilter ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-action="reset-filters">重置筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderRows(rows: ProjectTemplate[]): string {
  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-14 text-center text-muted-foreground">
          <i data-lucide="file-search-2" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
          <p class="mt-2">暂无模板数据</p>
        </td>
      </tr>
    `
  }

  return rows
    .map((template) => {
      const stageCount = countTemplateStages(template)
      const workItemCount = countTemplateWorkItems(template)
      return `
        <tr class="border-b last:border-b-0 hover:bg-muted/40">
          <td class="px-3 py-3 align-top">
            <button class="text-left font-medium text-blue-700 hover:underline" data-pcs-template-action="go-detail" data-template-id="${escapeHtml(template.id)}">${escapeHtml(template.name)}</button>
            <p class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(template.id)}</p>
          </td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              ${template.styleType.map((item) => `<span class="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs">${escapeHtml(item)}</span>`).join('')}
            </div>
          </td>
          <td class="px-3 py-3 text-center align-top">${stageCount}</td>
          <td class="px-3 py-3 text-center align-top">${workItemCount}</td>
          <td class="px-3 py-3 align-top">${escapeHtml(template.creator)}</td>
          <td class="px-3 py-3 align-top text-xs text-muted-foreground">${escapeHtml(template.updatedAt)}</td>
          <td class="px-3 py-3 text-center align-top">${getStatusBadge(template.status)}</td>
          <td class="px-3 py-3 align-top">
            <div class="flex flex-wrap gap-1">
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-action="go-detail" data-template-id="${escapeHtml(template.id)}">详情</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-action="go-edit" data-template-id="${escapeHtml(template.id)}">编辑</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-pcs-template-action="copy-template" data-template-id="${escapeHtml(template.id)}">复制</button>
              <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs ${template.status === 'active' ? 'text-orange-700 hover:bg-orange-50' : 'text-emerald-700 hover:bg-emerald-50'}" data-pcs-template-action="open-toggle-dialog" data-template-id="${escapeHtml(template.id)}">${template.status === 'active' ? '停用' : '启用'}</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderTable(): string {
  const filtered = getFilteredTemplates()
  const paging = getPagination(filtered)

  state.page = paging.currentPage

  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1000px] text-sm">
          <thead>
            <tr class="border-b bg-muted/30 text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">模板名称</th>
              <th class="px-3 py-2 font-medium">适用款式类型</th>
              <th class="px-3 py-2 text-center font-medium">阶段数量</th>
              <th class="px-3 py-2 text-center font-medium">工作项数量</th>
              <th class="px-3 py-2 font-medium">创建人</th>
              <th class="px-3 py-2 font-medium">最近更新时间</th>
              <th class="px-3 py-2 text-center font-medium">状态</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${renderRows(paging.rows)}</tbody>
        </table>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
        <p class="text-xs text-muted-foreground">共 ${paging.total} 条${paging.total > 0 ? `，当前 ${paging.from}-${paging.to}` : ''}</p>
        <div class="flex flex-wrap items-center gap-2">
          <select class="h-8 rounded-md border bg-background px-2 text-xs" data-pcs-template-field="pageSize">
            ${PAGE_SIZE_OPTIONS.map((option) => `<option value="${option}" ${option === state.pageSize ? 'selected' : ''}>${option} 条/页</option>`).join('')}
          </select>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage <= 1 ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-template-action="prev-page" ${paging.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="text-xs text-muted-foreground">${paging.currentPage} / ${paging.totalPages}</span>
          <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${paging.currentPage >= paging.totalPages ? 'cursor-not-allowed opacity-60' : ''}" data-pcs-template-action="next-page" ${paging.currentPage >= paging.totalPages ? 'disabled' : ''}>下一页</button>
        </div>
      </footer>
    </section>
  `
}

function renderConfirmDialog(): string {
  if (!state.confirmDialog.open || !state.confirmDialog.templateId) return ''
  const template = listProjectTemplates().find((item) => item.id === state.confirmDialog.templateId)
  if (!template) return ''

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section class="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">${state.confirmDialog.nextStatusLabel}模板</h3>
          <p class="mt-1 text-xs text-muted-foreground">${state.confirmDialog.nextStatusLabel === '停用' ? '停用后将不能用于新建商品项目。' : '启用后可再次用于新建商品项目。'}</p>
        </header>
        <div class="space-y-2 p-4 text-sm">
          <p>模板：<span class="font-medium">${escapeHtml(template.name)}</span></p>
          <p>当前状态：${getStatusLabel(template.status)}</p>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-template-action="close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50" data-pcs-template-action="confirm-toggle">${state.confirmDialog.nextStatusLabel}</button>
        </footer>
      </section>
    </div>
  `
}

function resetFilters(): void {
  state.searchQuery = ''
  state.styleTypeFilter = 'all'
  state.statusFilter = 'all'
  state.page = 1
}

function openToggleDialog(templateId: string): void {
  const template = listProjectTemplates().find((item) => item.id === templateId)
  if (!template) return

  state.confirmDialog.open = true
  state.confirmDialog.templateId = template.id
  state.confirmDialog.nextStatusLabel = template.status === 'active' ? '停用' : '启用'
}

function closeDialog(): void {
  state.confirmDialog = {
    open: false,
    templateId: null,
    nextStatusLabel: '停用',
  }
}

function toggleStatus(): void {
  if (!state.confirmDialog.templateId) return
  const changed = toggleProjectTemplateStatus(state.confirmDialog.templateId)
  if (changed) {
    state.notice = `模板 ${changed.name} 已${getStatusLabel(changed.status)}（演示态）。`
  }
  closeDialog()
}

export function renderPcsTemplatesPage(): string {
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderFilters()}
      ${renderTable()}
      ${renderConfirmDialog()}
    </div>
  `
}

export function handlePcsTemplatesEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-template-field]')
  if (fieldNode instanceof HTMLInputElement && fieldNode.dataset.pcsTemplateField === 'searchQuery') {
    state.searchQuery = fieldNode.value
    state.page = 1
    return true
  }

  if (fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pcsTemplateField
    if (field === 'styleTypeFilter') {
      state.styleTypeFilter = fieldNode.value as StyleFilter
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

  const actionNode = target.closest<HTMLElement>('[data-pcs-template-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pcsTemplateAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'go-create') {
    appStore.navigate('/pcs/templates/new')
    return true
  }

  if (action === 'go-detail') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return false
    appStore.navigate(`/pcs/templates/${templateId}`)
    return true
  }

  if (action === 'go-edit') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return false
    appStore.navigate(`/pcs/templates/${templateId}/edit`)
    return true
  }

  if (action === 'copy-template') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return false
    const copied = copyProjectTemplate(templateId)
    if (copied) {
      state.notice = `模板 ${copied.name} 已创建（演示态）。`
      state.page = 1
    }
    return true
  }

  if (action === 'open-toggle-dialog') {
    const templateId = actionNode.dataset.templateId
    if (!templateId) return false
    openToggleDialog(templateId)
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  if (action === 'confirm-toggle') {
    toggleStatus()
    return true
  }

  if (action === 'reset-filters') {
    resetFilters()
    return true
  }

  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.max(1, Math.ceil(getFilteredTemplates().length / state.pageSize))
    state.page = Math.min(totalPages, state.page + 1)
    return true
  }

  return false
}

export function isPcsTemplatesDialogOpen(): boolean {
  return state.confirmDialog.open
}

