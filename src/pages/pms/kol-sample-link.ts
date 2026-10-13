// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsKolLinkRow,
  filterPmsKolLinks,
  invalidatePmsKolLink,
  listPmsKolLinks,
  summarizePmsKolLinks,
} from '../../data/pms/kol-sample-link.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsFeedback } from './shared.ts'

const EVENT_PREFIX = 'pms-kln'
const ROOT_SELECTOR = '[data-pms-kln-root]'

interface KolLinkPageState extends ProcessOrderListControllerState {
  search: string
  status: '' | '全部' | '待提交' | '已提交' | '已作废' | '已过期'
  feedback: string
  feedbackOk: boolean
}

const state: KolLinkPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  search: '',
  status: '全部',
  feedback: '',
  feedbackOk: true,
}

const STATUS_OPTIONS = ['全部', '待提交', '已提交', '已作废', '已过期'] as const

function filteredRows(): PmsKolLinkRow[] {
  return filterPmsKolLinks({ search: state.search, status: state.status })
}

const columns: StandardListColumn<PmsKolLinkRow>[] = [
  {
    key: 'linkInfo',
    title: '链接信息',
    width: 260,
    required: true,
    render: (row) => `<div class="font-medium">${escapeHtml(row.linkName)}</div><div class="mt-1 break-all font-mono text-[11px] text-slate-600">${escapeHtml(row.url)}</div>`,
  },
  {
    key: 'samplePool',
    title: '样品池',
    width: 110,
    render: (row) => row.samplePoolName === '-'
      ? `<span class="text-xs text-slate-400">—</span>`
      : `<div class="font-medium">${escapeHtml(row.samplePoolName)}</div>`,
  },
  {
    key: 'sampleCount',
    title: '最大可选',
    width: 120,
    sortable: true,
    sortValue: (row) => row.sampleCount,
    render: (row) => `<span class="tabular-nums text-base">${row.sampleCount} 个SKU</span>`,
  },
  {
    key: 'maxSelection',
    title: '单次选择',
    width: 110,
    sortable: true,
    sortValue: (row) => row.maxSkuSelection,
    render: (row) => `<span class="tabular-nums text-base font-semibold">${row.maxSkuSelection}</span>`,
  },
  {
    key: 'expiresAt',
    title: '有效期',
    width: 170,
    sortable: true,
    sortValue: (row) => row.expiresAt,
    render: (row) => `<span class="tabular-nums text-xs">${escapeHtml(row.expiresAt)}</span>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.computedStatus,
    render: (row) => {
      const colors: Record<string, string> = {
        '待提交': 'bg-amber-50 text-amber-700',
        '已提交': 'bg-emerald-50 text-emerald-700',
        '已作废': 'bg-rose-50 text-rose-700',
        '已过期': 'bg-slate-200 text-slate-600',
      }
      return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${colors[row.computedStatus] ?? 'bg-slate-100 text-slate-700'}">${escapeHtml(row.computedStatus)}</span>`
    },
  },
  {
    key: 'visitCount',
    title: '访问次数',
    width: 100,
    sortable: true,
    sortValue: (row) => row.visitCount,
    render: (row) => `<span class="tabular-nums">${row.visitCount}</span>`,
  },
  {
    key: 'relatedApply',
    title: '关联申请单',
    width: 200,
    render: (row) => row.relatedApplyId === '-'
      ? '<span class="text-xs text-slate-400">—</span>'
      : `<a class="break-all font-mono text-xs text-blue-700 hover:underline" href="/pms/kol-sample-apply">${escapeHtml(row.relatedApplyId)}</a>`,
  },
  {
    key: 'createdBy',
    title: '创建信息',
    width: 170,
    render: (row) => `<div class="font-medium">${escapeHtml(row.creator)}</div><div class="mt-0.5 text-[11px] text-slate-500 tabular-nums">${escapeHtml(row.createdAt)}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 240,
    actionColumn: true,
    required: true,
    render: (row) => {
      const submitted = row.persistedStatus === '已提交'
      const invalidated = row.persistedStatus === '已作废'
      const applyLink = submitted
        ? `<a class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" href="/pms/kol-sample-apply">查看申请单</a>`
        : ''
      const copyBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="copy-link" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">复制链接</button>`
      const modifyBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs ${invalidated ? 'text-slate-300' : 'text-blue-700 hover:bg-blue-50'}" data-${EVENT_PREFIX}-action="modify-pool" data-id="${escapeHtml(row.id)}" ${invalidated ? 'disabled' : ''} data-skip-page-rerender="true">修改样品池</button>`
      const invalidateBtn = `<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-2 py-1 text-xs ${invalidated ? 'text-slate-300' : 'text-rose-700 hover:bg-rose-50'}" data-${EVENT_PREFIX}-action="invalidate" data-id="${escapeHtml(row.id)}" ${invalidated ? 'disabled' : ''} data-skip-page-rerender="true">作废</button>`
      return `<div class="flex flex-wrap items-center justify-end gap-1.5">${copyBtn}${modifyBtn}${invalidateBtn}${applyLink}</div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/kol-sample-link',
  pageSizeOptions: [10, 20, 50, 100, 200, 300, 500, 1000],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-kln-table-surface]',
  paginationSurfaceSelector: '[data-pms-kln-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-kln-overlays]',
  defaultFrozenKeys: ['linkInfo'],
  columnSettingsTitle: '对外样品池链接列设置',
  emptyText: '当前条件下暂无对外样品池链接',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderTopNav(): string {
  return `<nav class="flex flex-wrap gap-2 rounded-lg border bg-white p-3" aria-label="KOL 样衣申请导航">
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock">« 返回 KOL库存</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" href="/pms/kol-sample-apply">手动寄样申请</a>
    <a class="inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href="/pms/kol-sample-stock/lock-log">锁定操作记录</a>
  </nav>`
}

function renderFilters(): string {
  const statusOptions = STATUS_OPTIONS.map((opt) => `<option value="${opt}" ${state.status === opt ? 'selected' : ''}>${opt}</option>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">检索</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="链接名称 / 链接 / 关联申请单" value="${escapeHtml(state.search)}" data-${EVENT_PREFIX}-field="search" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
  </div>
  <div class="mt-3 flex w-full flex-wrap items-center gap-2">
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
  </div>
  </div>`
}

function renderStats(): string {
  const stats = summarizePmsKolLinks({ search: state.search, status: state.status })
  const items = [
    { label: '链接总数', value: stats.totalLinks },
    { label: '待提交', value: stats.pending },
    { label: '已提交', value: stats.submitted },
    { label: '已过期', value: stats.expired },
    { label: '已作废', value: stats.invalidated },
  ]
  return renderProcessOrderStats(items)
}

function renderOverlays(): string {
  return ''
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: false,
    title: '对外样品池链接',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: `<div class="space-y-2">${renderTopNav()}${renderFilters()}</div>`,
    statsHtml: stats,
    listTitle: `共 ${filteredRows().length} 条对外样品池链接`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-kln-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-kln-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-kln-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field) return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'search': state.search = value; break
    case 'status':
      state.status = (value as KolLinkPageState['status'])
      break
  }
}

function handleActionEvent(target: HTMLElement): void {
  const action = target.dataset[`${EVENT_PREFIX}Action`]
  if (!action) return
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset':
      state.search = ''
      state.status = '全部'
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    case 'export': {
      const rows = listPmsKolLinks()
      downloadPmsCsv(
        'higood-pms-kol-sample-link.csv',
        ['链接', '链接名称', '样品池', 'SKU数', '最大可选', '有效期', '状态', '访问次数', '关联申请单', '创建人', '创建时间'],
        rows.map((r) => [r.url, r.linkName, r.samplePoolName, r.sampleCount, r.maxSkuSelection, r.expiresAt, r.computedStatus, r.visitCount, r.relatedApplyId, r.creator, r.createdAt]),
      )
      state.feedback = '已导出当前数据为 CSV'
      state.feedbackOk = true
      break
    }
    case 'copy-link': {
      const id = target.dataset.id ?? ''
      const row = listPmsKolLinks().find((r) => r.id === id)
      if (!row) {
        state.feedback = '链接不存在'
        state.feedbackOk = false
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(row.url).catch(() => undefined)
      }
      state.feedback = `已复制链接 ${row.linkName === '-' ? row.url : row.linkName} 到剪贴板(原型)`
      state.feedbackOk = true
      break
    }
    case 'modify-pool': {
      const id = target.dataset.id ?? ''
      const row = listPmsKolLinks().find((r) => r.id === id)
      if (!row || row.persistedStatus === '已作废') {
        state.feedback = '已作废链接不允许修改样品池'
        state.feedbackOk = false
        return
      }
      state.feedback = `修改样品池 ${row.linkName} 由 manage.higood.ai 后台处理,原型仅记录意图`
      state.feedbackOk = true
      break
    }
    case 'invalidate': {
      const id = target.dataset.id ?? ''
      try {
        const row = invalidatePmsKolLink(id)
        state.feedback = `已将链接 ${row.linkName} 作废`
        state.feedbackOk = true
      } catch (error) {
        state.feedback = error instanceof Error ? error.message : '作废失败'
        state.feedbackOk = false
      }
      break
    }
  }
}

export function renderPmsKolLinkPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
  })
  return html
}

export function handlePmsKolLinkEvent(event: Event): void {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable || !rootElement()?.contains(actionable)) return
  if (actionable.dataset[`${EVENT_PREFIX}Action`]) {
    handleActionEvent(actionable)
  } else if (actionable.dataset[`${EVENT_PREFIX}Field`]) {
    handleFieldEvent(actionable)
  }
}

export function closePmsKolLinkOverlays(): void {
  // no-op: 当前页面没有弹出层
}
