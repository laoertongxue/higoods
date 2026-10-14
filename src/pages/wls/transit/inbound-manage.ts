// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'

type InboundStage = '待收货' | '收货完成' | '待上架' | '上架完成'

type InboundRow = {
  receiveNo: string; sourceNo: string; demandNo: string; productionNo: string
  spu: string; sku: string
  expectedQty: number; receivedQty: number
  receiveStatus: '待收货' | '收货完成'
  kitType: '已配齐' | '未配齐' | '可配齐'
  taskStatus: '待处理' | '未配齐' | '已配齐'
  stage: InboundStage
}

const receiveStatusClass: Record<string, string> = {
  '待收货': 'bg-orange-50 text-orange-700', '收货完成': 'bg-emerald-50 text-emerald-700',
}

const TAB_STAGES: Array<'ALL' | InboundStage> = ['ALL', '待收货', '收货完成', '待上架', '上架完成']

const seedRows: InboundRow[] = [
  { receiveNo: 'TR-RC-20260716-001', sourceNo: 'TR-IN-20260716-001', demandNo: 'REQ-PO14954', productionNo: 'PO14954', spu: 'FAB-14954', sku: 'FAB-PO14954-A', expectedQty: 8, receivedQty: 8, receiveStatus: '收货完成', kitType: '已配齐', taskStatus: '已配齐', stage: '待上架' },
  { receiveNo: 'TR-RC-20260716-001', sourceNo: 'TR-IN-20260716-004', demandNo: 'REQ-PO14957', productionNo: 'PO14957', spu: 'FAB-14957', sku: 'FAB-PO14957-A', expectedQty: 7, receivedQty: 7, receiveStatus: '收货完成', kitType: '已配齐', taskStatus: '已配齐', stage: '上架完成' },
  { receiveNo: 'TR-RC-20260716-002', sourceNo: 'TR-IN-20260716-002', demandNo: 'REQ-PO14955', productionNo: 'PO14955', spu: 'FAB-14955', sku: 'FAB-PO14955-A', expectedQty: 11, receivedQty: 8, receiveStatus: '收货完成', kitType: '未配齐', taskStatus: '未配齐', stage: '待上架' },
  { receiveNo: 'TR-RC-20260716-003', sourceNo: 'TR-IN-20260716-003', demandNo: 'REQ-PO14956', productionNo: 'PO14956', spu: 'FAB-14956', sku: 'FAB-PO14956-A', expectedQty: 13, receivedQty: 5, receiveStatus: '收货完成', kitType: '未配齐', taskStatus: '未配齐', stage: '待上架' },
  { receiveNo: 'TR-RC-20260716-004', sourceNo: 'TR-IN-20260716-006', demandNo: 'REQ-PO14959', productionNo: 'PO14959', spu: 'FAB-14959', sku: 'FAB-PO14959-A', expectedQty: 8, receivedQty: 0, receiveStatus: '待收货', kitType: '未配齐', taskStatus: '待处理', stage: '待收货' },
  { receiveNo: 'TR-RC-20260716-004', sourceNo: 'TR-IN-20260716-007', demandNo: 'REQ-PO14960', productionNo: 'PO14960', spu: 'FAB-14960', sku: 'FAB-PO14960-A', expectedQty: 10, receivedQty: 0, receiveStatus: '待收货', kitType: '未配齐', taskStatus: '待处理', stage: '待收货' },
  { receiveNo: 'TR-RC-20260716-004', sourceNo: 'TR-IN-20260716-008', demandNo: 'REQ-PO14961', productionNo: 'PO14961', spu: 'ACC-14961', sku: 'ACC-PO14961-B', expectedQty: 6, receivedQty: 0, receiveStatus: '待收货', kitType: '未配齐', taskStatus: '待处理', stage: '待收货' },
  { receiveNo: 'TR-RC-20260716-005', sourceNo: 'TR-IN-20260716-009', demandNo: 'REQ-PO14962', productionNo: 'PO14962', spu: 'FAB-14962', sku: 'FAB-PO14962-A', expectedQty: 8, receivedQty: 8, receiveStatus: '收货完成', kitType: '已配齐', taskStatus: '已配齐', stage: '上架完成' },
  { receiveNo: 'TR-RC-20260716-005', sourceNo: 'TR-IN-20260716-010', demandNo: 'REQ-PO14963', productionNo: 'PO14963', spu: 'FAB-14963', sku: 'FAB-PO14963-A', expectedQty: 9, receivedQty: 8, receiveStatus: '收货完成', kitType: '可配齐', taskStatus: '待处理', stage: '待上架' },
  { receiveNo: 'TR-RC-20260716-005', sourceNo: 'TR-IN-20260716-011', demandNo: 'REQ-PO14964', productionNo: 'PO14964', spu: 'FAB-14964', sku: 'FAB-PO14964-A', expectedQty: 13, receivedQty: 5, receiveStatus: '收货完成', kitType: '未配齐', taskStatus: '未配齐', stage: '待上架' },
]

const EVENT_PREFIX = 'wls-transit-inbound'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/inbound-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  confirmIdx: -1,
  showColumnSettings: false,
  keyword: '',
  taskStatusFilter: '' as string,
  tab: 'ALL' as (typeof TAB_STAGES)[number],
}

const columns: StandardListColumn<InboundRow>[] = [
  { key: 'select', title: '勾选', width: 50, required: true, leadingControlColumn: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'receiveNo', title: '收货单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.receiveNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.receiveNo)}">${escapeHtml(r.receiveNo)}</span>` },
  { key: 'sourceNo', title: '来源单号', width: 170, sortable: true, sortValue: r => r.sourceNo,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sourceNo)}</span>` },
  { key: 'demandNo', title: '需求单号', width: 130, sortable: true, sortValue: r => r.demandNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.demandNo)}</span>` },
  { key: 'productionNo', title: '生产单号', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'fabricInfo', title: '面料信息', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<div class="space-y-0.5"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.spu)}</div><div class="font-mono text-[11px] text-slate-500">${escapeHtml(r.sku)}</div></div>` },
  { key: 'expectedQty', title: '应收数量', width: 90, align: 'right', sortable: true, sortValue: r => r.expectedQty,
    render: r => `<span class="text-slate-600">${r.expectedQty}</span>` },
  { key: 'receivedQty', title: '实收数量', width: 90, align: 'right', sortable: true, sortValue: r => r.receivedQty,
    render: r => `<span class="text-slate-700 font-medium">${r.receivedQty}</span>` },
  { key: 'receiveStatus', title: '收货状态', width: 100, sortable: true, sortValue: r => r.receiveStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${receiveStatusClass[r.receiveStatus] || ''}">${escapeHtml(r.receiveStatus)}</span>` },
  { key: 'kitType', title: '齐套类型', width: 90, sortable: true, sortValue: r => r.kitType,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.kitType)}</span>` },
  { key: 'taskStatus', title: '任务状态', width: 90, sortable: true, sortValue: r => r.taskStatus,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'actions', title: '操作', width: 300, required: true, actionColumn: true,
    render: r => {
      const idx = seedRows.indexOf(r)
      const buttons: string[] = [
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-log" data-${EVENT_PREFIX}-idx="${ idx }">查看日志</button>`,
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-barcode" data-${EVENT_PREFIX}-idx="${ idx }">查看条码</button>`,
      ]
      if (r.receiveStatus === '待收货') buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="receive" data-${EVENT_PREFIX}-idx="${ idx }">收货</button>`)
      if (r.kitType === '未配齐') buttons.push(
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-unmatched-putaway" data-${EVENT_PREFIX}-idx="${ idx }">查看未配齐上架任务</button>`,
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="print-unmatched-putaway" data-${EVENT_PREFIX}-idx="${ idx }">打印未配齐的上架任务单</button>`,
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="complete-unmatched" data-${EVENT_PREFIX}-idx="${ idx }">完成</button>`,
      )
      if (r.kitType === '可配齐') buttons.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-kitted-allocation" data-${EVENT_PREFIX}-idx="${ idx }">查看可配齐配料任务单</button>`)
      return `<div class="flex flex-wrap items-center gap-1">${buttons.join('')}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['receiveNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(r: InboundRow): boolean {
  return state.tab === 'ALL' || r.stage === state.tab
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: TAB_STAGES.map(stage => ({
      key: stage,
      label: stage === 'ALL' ? '全部' : stage,
      count: stage === 'ALL' ? seedRows.length : seedRows.filter(r => r.stage === stage).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): InboundRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (!tabMatches(r)) return false
    if (state.taskStatusFilter && r.taskStatus !== state.taskStatusFilter) return false
    if (!kw) return true
    return `${r.receiveNo} ${r.sourceNo} ${r.demandNo} ${r.productionNo} ${r.spu} ${r.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="收货单号 / 来源单号 / 需求单号 / 生产单号 / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">全部任务状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="taskStatus"><option value="">全部</option><option value="待处理" ${state.taskStatusFilter === '待处理' ? 'selected' : ''}>待处理</option><option value="未配齐" ${state.taskStatusFilter === '未配齐' ? 'selected' : ''}>未配齐</option><option value="已配齐" ${state.taskStatusFilter === '已配齐' ? 'selected' : ''}>已配齐</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转收货单管理',
    description: '中转收货单管理列表（独立于中转回货），支持按仓库、状态筛选',
    statusTabsHtml: renderTabsHtml(),
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('创建收货单', { prefix: EVENT_PREFIX, action: 'create-receive' }, 'plus')}${renderSecondaryButton('打印收货后任务单', { prefix: EVENT_PREFIX, action: 'print-after-task' }, 'printer')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待收货', value: `${seedRows.filter(r => r.stage === '待收货').length} 条` },
      { label: '待上架', value: `${seedRows.filter(r => r.stage === '待上架').length} 条` },
      { label: '上架完成', value: `${seedRows.filter(r => r.stage === '上架完成').length} 条` },
    ]),
    listTitle: '收货单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的收货单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '收货单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.confirmIdx >= 0 && seedRows[state.confirmIdx] ? renderSimpleConfirmDialog({
      prefix: EVENT_PREFIX,
      closeAction: 'cancel-confirm',
      confirmAction: 'run-confirm',
      title: '确认收货',
      description: `确认已收到收货单 ${seedRows[state.confirmIdx].receiveNo} 的 ${seedRows[state.confirmIdx].expectedQty} 件物料？确认后库存入账，不可撤销。`,
      confirmLabel: '确认收货',
    }) : ''].join(''),
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

export function renderTransitInboundManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitInboundManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'taskStatus') { state.taskStatusFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as (typeof TAB_STAGES)[number]
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const root = rootElement()
    const read = (name: string) => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${name}"]`)?.value ?? ''
    state.keyword = read('keyword')
    state.taskStatusFilter = read('taskStatus')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.taskStatusFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${DATASET_PREFIX}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${DATASET_PREFIX}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'receive') {
    state.confirmIdx = Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-confirm') {
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'run-confirm') {
    const row = seedRows[state.confirmIdx]
    if (row && row.receiveStatus !== '收货完成') {
      row.receiveStatus = '收货完成'
      row.receivedQty = row.expectedQty
      row.stage = '待上架'
      showListFeedback(`收货单 ${row.receiveNo} 已确认收货 ${row.receivedQty} 件`)
    }
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'complete-unmatched') {
    const row = seedRows[Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])]
    if (row) { row.stage = '上架完成'; showListFeedback(`未配齐上架任务已完成：${row.receiveNo}`) }
    refreshWorkspace()
    return true
  }
  if (action === 'create-receive') { showListFeedback('创建收货单为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'print-after-task') { showListFeedback(`已生成 ${filteredRows().length} 张收货后任务单打印任务`); return true }
  if (action === 'view-log') { const row = seedRows[Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])]; if (row) showListFeedback(`收货单 ${row.receiveNo} 的操作日志为演示内容`, 'info'); return true }
  if (action === 'view-barcode') { const row = seedRows[Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])]; if (row) showListFeedback(`收货单 ${row.receiveNo} 的条码为演示内容`, 'info'); return true }
  if (action === 'view-unmatched-putaway') { showListFeedback('查看未配齐上架任务为演示入口', 'info'); return true }
  if (action === 'print-unmatched-putaway') { showListFeedback('已生成未配齐的上架任务单打印任务'); return true }
  if (action === 'view-kitted-allocation') { showListFeedback('查看可配齐配料任务单为演示入口', 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓收货单管理', columns, rows: filteredRows() }); return true }
  return false
}
