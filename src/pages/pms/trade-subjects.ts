// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { listPmsTradeSubjects, type PmsTradeSubject } from '../../data/pms/trade-subjects.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsFeedback, renderPmsStatusBadge } from './shared.ts'

interface TradeSubjectPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | '启用' | '停用'
  overlay: null | { kind: 'detail'; subjectCode: string }
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-ts'
const ROOT_SELECTOR = '[data-pms-ts-root]'

const state: TradeSubjectPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  overlay: null,
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsTradeSubject[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsTradeSubjects().filter((subject) => {
    if (state.status && subject.status !== state.status) return false
    if (!keyword) return true
    return [subject.subjectCode, subject.subjectName, subject.shortName, subject.legalPerson, subject.taxNo].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsTradeSubject>[] = [
  {
    key: 'subject',
    title: '贸易主体',
    width: 260,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.subjectName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.subjectName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.subjectCode)} · ${escapeHtml(row.shortName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.countryOrRegion)}</div>`,
  },
  {
    key: 'settlement',
    title: '结算币种',
    width: 140,
    sortable: true,
    sortValue: (row) => row.settlementCurrency,
    render: (row) => `<div class="text-sm font-medium">${escapeHtml(row.settlementCurrency)}</div><div class="mt-1 text-xs text-slate-500">已用于 ${row.usedInPurchaseOrders} 张采购单</div>`,
  },
  {
    key: 'tax',
    title: '税号 / 法人',
    width: 220,
    render: (row) => `<div class="text-sm">${escapeHtml(row.taxNo)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.legalPerson)}</div>`,
  },
  {
    key: 'bank',
    title: '开户行 / 账号',
    width: 220,
    render: (row) => `<div class="text-sm">${escapeHtml(row.bankName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.bankAccount)}</div>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    actionColumn: true,
    render: (row) => `<div class="flex items-center justify-end"><button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-${EVENT_PREFIX}-action="open-detail" data-subject-code="${escapeHtml(row.subjectCode)}" data-skip-page-rerender="true">查看</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/trade-subjects',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-ts-table-surface]',
  paginationSurfaceSelector: '[data-pms-ts-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-ts-overlays]',
  defaultFrozenKeys: ['subject'],
  columnSettingsTitle: '贸易主体列设置',
  emptyText: '当前条件下暂无贸易主体',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '启用', '停用'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="主体编码 / 名称 / 法人 / 税号" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">贸易主体由财务主数据维护，采购侧只读引用</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '主体总数', value: rows.length },
    { label: '启用主体', value: rows.filter((row) => row.status === '启用').length },
    { label: '已用于采购单', value: rows.reduce((sum, row) => sum + row.usedInPurchaseOrders, 0) },
    { label: '结算币种', value: [...new Set(rows.map((row) => row.settlementCurrency))].join(' / ') || '—' },
  ])
}

function renderDetailOverlay(subjectCode: string): string {
  const subject = listPmsTradeSubjects().find((row) => row.subjectCode === subjectCode)
  if (!subject) return ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="贸易主体详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[560px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(subject.subjectName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(subject.subjectCode)} · ${escapeHtml(subject.shortName)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay', skipPageRerender: true }, 'x')}</header><div class="space-y-4 p-4">
    <dl class="grid grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(subject.status, subject.status === '启用' ? 'green' : 'slate')}</dd></div><div><dt class="text-xs text-muted-foreground">国家/地区</dt><dd class="mt-1">${escapeHtml(subject.countryOrRegion)}</dd></div><div><dt class="text-xs text-muted-foreground">结算币种</dt><dd class="mt-1">${escapeHtml(subject.settlementCurrency)}</dd></div><div><dt class="text-xs text-muted-foreground">已用于采购单</dt><dd class="mt-1">${subject.usedInPurchaseOrders} 张</dd></div><div><dt class="text-xs text-muted-foreground">税号</dt><dd class="mt-1">${escapeHtml(subject.taxNo)}</dd></div><div><dt class="text-xs text-muted-foreground">法人</dt><dd class="mt-1">${escapeHtml(subject.legalPerson)}</dd></div><div><dt class="text-xs text-muted-foreground">开户行</dt><dd class="mt-1">${escapeHtml(subject.bankName)}</dd></div><div><dt class="text-xs text-muted-foreground">账号</dt><dd class="mt-1">${escapeHtml(subject.bankAccount)}</dd></div><div><dt class="text-xs text-muted-foreground">联系人</dt><dd class="mt-1">${escapeHtml(subject.contactName)}</dd></div><div><dt class="text-xs text-muted-foreground">电话</dt><dd class="mt-1">${escapeHtml(subject.contactPhone)}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(subject.remark || '—')}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">最近更新</dt><dd class="mt-1 text-slate-600">${escapeHtml(subject.updatedAt)}</dd></div></dl>
  </div></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-ts-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  return `${columnSettings}${renderDetailOverlay(state.overlay.subjectCode)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '贸易主体管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}`,
    tableHtml: `<div data-pms-ts-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-ts-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-ts-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ts-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的贸易主体。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '贸易主体.csv',
    ['主体编码', '主体名称', '简称', '国家/地区', '结算币种', '税号', '法人', '开户行', '账号', '联系人', '电话', '状态', '已用于采购单'],
    rows.map((row) => [row.subjectCode, row.subjectName, row.shortName, row.countryOrRegion, row.settlementCurrency, row.taxNo, row.legalPerson, row.bankName, row.bankAccount, row.contactName, row.contactPhone, row.status, row.usedInPurchaseOrders]),
  )
  state.feedback = `已导出 ${rows.length} 个贸易主体（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsTradeSubjectsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-ts-root data-skip-page-rerender="true"><style>[data-pms-ts-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsTradeSubjectOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsTradeSubjectsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsTsField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as TradeSubjectPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsTsAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-ts-column-key]')?.dataset.pmsTsColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-detail') {
    state.overlay = { kind: 'detail', subjectCode: actionNode?.dataset.subjectCode || '' }
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    refreshOverlays()
    return true
  }
  return false
}
