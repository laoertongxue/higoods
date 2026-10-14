// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { renderStatusBadge, renderStatusTabs, parseActionKey, type StatusTone } from './shared.ts'
import {
  loanSeed,
  LOAN_BORROW_TYPES,
  LOAN_STATUSES,
  ONLINE_PRODUCTS,
  ONLINE_WAREHOUSE_OPTIONS,
  type LoanRow,
  type LoanStatus,
} from './seed.ts'

const EVENT_PREFIX = 'wls-online-loan'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const STATUS_TONES: Record<LoanStatus, StatusTone> = {
  待借出: 'amber',
  已借出: 'blue',
  已归还: 'green',
  已取消: 'slate',
}

const PUSH_TONES: Record<string, StatusTone> = { 未推单: 'slate', 已推单: 'blue' }
const PRINT_TONES: Record<string, StatusTone> = { 未下载: 'slate', 已下载: 'amber', 已打印: 'green' }

type CreateLine = { key: number; sku: string; quantity: number }

const state = {
  currentPage: 1,
  pageSize: 10,
  sort: null as StandardListSortState | null,
  keyword: '',
  sourceNo: '',
  sku: '',
  borrower: '',
  purpose: '',
  carrier: '',
  waybillNo: '',
  warehouse: '',
  borrowType: '',
  status: '' as string,
  pushStatus: '',
  printStatus: '',
  selected: new Set<string>(),
  showCreate: false,
  create: {
    warehouse: ONLINE_WAREHOUSE_OPTIONS[1] as string,
    borrowType: '跟单',
    borrower: '',
    recipientInfo: '',
    purpose: '',
    carrier: 'J&T Express',
  },
  createLines: [{ key: 1, sku: ONLINE_PRODUCTS[0].sku, quantity: 1 }] as CreateLine[],
  nextLineKey: 2,
}

const columns: StandardListColumn<LoanRow>[] = [
  { key: 'selection', title: '', width: 44, leadingControlColumn: true,
    render: r => `<input type="checkbox" class="h-4 w-4 cursor-pointer accent-blue-600" data-${EVENT_PREFIX}-field="row-select" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}" ${state.selected.has(r.id) ? 'checked' : ''}>` },
  { key: 'orderNos', title: '单号', width: 200, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">借出单号：</span><span class="text-slate-700">${escapeHtml(r.loanOrderNo)}</span></div>
      <div><span class="text-slate-400">来源号：</span><span class="text-slate-700">${escapeHtml(r.sourceOrderNo)}</span></div>
    </div>` },
  { key: 'warehouse', title: '仓库', width: 100, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'sku', title: 'SKU', width: 140, sortable: true, sortValue: r => r.product.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.product.sku)}</span>` },
  { key: 'quantity', title: '借出数量', width: 90, align: 'right', sortable: true, sortValue: r => r.quantity,
    render: r => `<span class="text-slate-600">${r.quantity}</span>` },
  { key: 'borrower', title: '借用人', width: 100, sortable: true, sortValue: r => r.borrower,
    render: r => `<span class="text-slate-600">${escapeHtml(r.borrower)}</span>` },
  { key: 'borrowType', title: '借出类别', width: 100, sortable: true, sortValue: r => r.borrowType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.borrowType)}</span>` },
  { key: 'recipientInfo', title: '收件信息', width: 240,
    render: r => `<span class="text-xs text-slate-600" title="${escapeHtml(r.recipientInfo)}">${escapeHtml(r.recipientInfo)}</span>` },
  { key: 'operator', title: '人员', width: 100,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operator)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => renderStatusBadge(r.status, STATUS_TONES[r.status]) },
  { key: 'pushStatus', title: '推单状态', width: 100, sortable: true, sortValue: r => r.pushStatus,
    render: r => renderStatusBadge(r.pushStatus, PUSH_TONES[r.pushStatus] ?? 'slate') },
  { key: 'printStatus', title: '打印状态', width: 100, sortable: true, sortValue: r => r.printStatus,
    render: r => renderStatusBadge(r.printStatus, PRINT_TONES[r.printStatus] ?? 'slate') },
  { key: 'createdAt', title: '时间', width: 150, sortable: true, sortValue: r => r.createdAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.createdAt)}</span>` },
  { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1">
      <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 ${r.printStatus === '已打印' ? 'cursor-not-allowed opacity-50' : ''}" data-${EVENT_PREFIX}-action="row-print" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}" ${r.printStatus === '已打印' ? 'disabled' : ''}>打单</button>
      <button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 ${r.status !== '待借出' ? 'cursor-not-allowed opacity-50' : ''}" data-${EVENT_PREFIX}-action="row-ship" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}" ${r.status !== '待借出' ? 'disabled' : ''}>发货</button>
    </div>` },
]

function preferences(): StandardListColumnPreferences {
  return {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['orderNos'],
    pageSize: state.pageSize,
  }
}

function filteredRows(): LoanRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const sourceNo = state.sourceNo.trim().toLowerCase()
  const sku = state.sku.trim().toLowerCase()
  return loanSeed.filter(r => {
    if (state.warehouse && r.warehouse !== state.warehouse) return false
    if (state.borrowType && r.borrowType !== state.borrowType) return false
    if (state.status && r.status !== state.status) return false
    if (state.pushStatus && r.pushStatus !== state.pushStatus) return false
    if (state.printStatus && r.printStatus !== state.printStatus) return false
    if (state.borrower && !`${r.borrower} ${r.operator}`.toLowerCase().includes(state.borrower.trim().toLowerCase())) return false
    if (state.purpose && !r.borrowType.toLowerCase().includes(state.purpose.trim().toLowerCase())) return false
    if (state.carrier && r.carrier !== state.carrier) return false
    if (state.waybillNo && !r.waybillNo.toLowerCase().includes(state.waybillNo.trim().toLowerCase())) return false
    if (sourceNo && !r.sourceOrderNo.toLowerCase().includes(sourceNo)) return false
    if (sku && !r.product.sku.toLowerCase().includes(sku)) return false
    if (!kw) return true
    return `${r.loanOrderNo} ${r.sourceOrderNo} ${r.product.sku} ${r.borrower} ${r.recipientInfo}`.toLowerCase().includes(kw)
  })
}

function selectOptions(options: readonly string[], current: string): string {
  return options.map(option => `<option value="${escapeHtml(option)}" ${current === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label><span class="mb-1 block text-xs text-muted-foreground">借出单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索借出单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">来源号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sourceNo)}" data-${EVENT_PREFIX}-field="sourceNo"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">物品SKU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sku)}" placeholder="搜索物品SKU" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">借用人</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.borrower)}" data-${EVENT_PREFIX}-field="borrower"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">借出用途 / 原因</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.purpose)}" data-${EVENT_PREFIX}-field="purpose"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">快递公司</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="carrier"><option value="">全部</option>${selectOptions(['J&T Express', 'SICEPAT'], state.carrier)}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">快递单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.waybillNo)}" data-${EVENT_PREFIX}-field="waybillNo"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse">${selectOptions(ONLINE_WAREHOUSE_OPTIONS, state.warehouse || '全部仓库')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">借出类别</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="borrowType">${selectOptions(LOAN_BORROW_TYPES, state.borrowType || '全部借出类别')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">推单状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="pushStatus">${selectOptions(['未推单', '已推单'], state.pushStatus)}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">打印状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="printStatus">${selectOptions(['未下载', '已下载', '已打印'], state.printStatus)}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderTabs(): string {
  const tabs = [{ key: 'all', label: '全部', count: loanSeed.length }].concat(
    LOAN_STATUSES.map(status => ({ key: status, label: status, count: loanSeed.filter(r => r.status === status).length })),
  )
  return renderStatusTabs({ prefix: EVENT_PREFIX, action: 'tab', activeKey: state.status || 'all', tabs })
}

function renderCreateDialog(): string {
  const linesHtml = state.createLines.map((line, index) => `<div class="flex items-center gap-2" data-${EVENT_PREFIX}-line="${line.key}">
    <select class="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="lineSku" data-${EVENT_PREFIX}-line-index="${index}">${ONLINE_PRODUCTS.map(p => `<option value="${escapeHtml(p.sku)}" ${line.sku === p.sku ? 'selected' : ''}>${escapeHtml(p.sku)} · ${escapeHtml(p.name)}</option>`).join('')}</select>
    <input type="number" min="1" class="h-9 w-24 rounded-md border border-input bg-background px-2 text-right text-sm" value="${line.quantity}" data-${EVENT_PREFIX}-field="lineQty" data-${EVENT_PREFIX}-line-index="${index}">
  </div>`).join('')

  const content = `<div class="space-y-3">
    <div class="grid grid-cols-2 gap-x-4 gap-y-3">
      <label><span class="mb-1 block text-xs text-muted-foreground">仓库 (必填)</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="create-warehouse">${selectOptions(ONLINE_WAREHOUSE_OPTIONS.slice(1), state.create.warehouse)}</select></label>
      <label><span class="mb-1 block text-xs text-muted-foreground">借出类别 (必填)</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="create-borrowType">${selectOptions(LOAN_BORROW_TYPES.slice(1), state.create.borrowType)}</select></label>
      <label><span class="mb-1 block text-xs text-muted-foreground">借用人 (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.create.borrower)}" data-${EVENT_PREFIX}-field="create-borrower"></label>
      <label><span class="mb-1 block text-xs text-muted-foreground">快递公司</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="create-carrier">${selectOptions(['J&T Express', 'SICEPAT', 'JNE'], state.create.carrier)}</select></label>
      <label class="col-span-2"><span class="mb-1 block text-xs text-muted-foreground">收件信息 (必填)</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.create.recipientInfo)}" placeholder="收件人 / 电话 / 地址" data-${EVENT_PREFIX}-field="create-recipientInfo"></label>
      <label class="col-span-2"><span class="mb-1 block text-xs text-muted-foreground">用途</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.create.purpose)}" placeholder="借出用途或原因" data-${EVENT_PREFIX}-field="create-purpose"></label>
    </div>
    <div>
      <div class="mb-2 flex items-center justify-between"><span class="text-xs font-medium text-slate-600">借出商品行</span>${renderSecondaryButton('+ 添加商品行', { prefix: EVENT_PREFIX, action: 'add-line', skipPageRerender: true })}</div>
      <div class="space-y-2">${linesHtml}</div>
    </div>
  </div>`

  return renderDialog(
    { title: '创建借出单', description: '填写借出信息并添加商品行，保存后进入待借出。', closeAction: { prefix: EVENT_PREFIX, action: 'cancel-create', skipPageRerender: true }, width: 'lg' },
    content,
    `<div class="flex justify-end gap-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'cancel-create', skipPageRerender: true })}${renderPrimaryButton('保存借出单', { prefix: EVENT_PREFIX, action: 'submit-create', skipPageRerender: true })}</div>`,
  )
}

function renderWorkspace(): string {
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.pageSize)
  state.currentPage = paging.currentPage
  const selectedCount = state.selected.size
  const primaryActions = `<div class="flex flex-wrap items-center gap-2">
    ${renderSecondaryButton('批量打单', { prefix: EVENT_PREFIX, action: 'bulk-print', skipPageRerender: true })}
    ${renderSecondaryButton('批量发货', { prefix: EVENT_PREFIX, action: 'bulk-ship', skipPageRerender: true })}
    ${renderPrimaryButton('创建借出单', { prefix: EVENT_PREFIX, action: 'open-create', skipPageRerender: true })}
    ${selectedCount ? `<span class="text-xs text-muted-foreground">已选 ${selectedCount} 条</span>` : ''}
  </div>`
  return renderStandardListPage({
    title: '借出单管理',
    primaryActionsHtml: primaryActions,
    filtersHtml: renderFilters(),
    statusTabsHtml: renderTabs(),
    statsHtml: renderStandardListStats([
      { label: '总借出单', value: `${loanSeed.length} 条` },
      { label: '待借出', value: `${loanSeed.filter(r => r.status === '待借出').length} 条` },
      { label: '已借出', value: `${loanSeed.filter(r => r.status === '已借出').length} 条` },
      { label: '已归还', value: `${loanSeed.filter(r => r.status === '已归还').length} 条` },
    ]),
    listTitle: '借出单列表',
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: preferences(), sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的借出单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showCreate ? renderCreateDialog() : '',
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

function syncCreateForm(): void {
  const root = rootElement()
  if (!root) return
  const value = (field: string): string => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${field}"]`)?.value ?? ''
  state.create.warehouse = value('create-warehouse') || state.create.warehouse
  state.create.borrowType = value('create-borrowType') || state.create.borrowType
  state.create.borrower = value('create-borrower')
  state.create.carrier = value('create-carrier') || state.create.carrier
  state.create.recipientInfo = value('create-recipientInfo')
  state.create.purpose = value('create-purpose')
  root.querySelectorAll<HTMLElement>(`[data-${EVENT_PREFIX}-line]`).forEach((lineNode, index) => {
    const line = state.createLines[index]
    if (!line) return
    const sku = lineNode.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="lineSku"]`)
    const qty = lineNode.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="lineQty"]`)
    if (sku) line.sku = sku.value
    if (qty) line.quantity = Math.max(1, Number(qty.value) || 1)
  })
}

export function renderWlsOnlineLoan(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

function rowById(id: string): LoanRow | undefined {
  return loanSeed.find(r => r.id === id)
}

export function handleWlsOnlineLoanEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'row-select') {
      const id = field.dataset[`${DATASET_PREFIX}Id`] || ''
      if ((field as HTMLInputElement).checked) state.selected.add(id)
      else state.selected.delete(id)
      refreshWorkspace()
      return true
    }
    if (name === 'pageSize' && event?.type === 'change') {
      state.pageSize = Number(field.value) || 10
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    if (name && name.startsWith('create-')) {
      if (name === 'create-warehouse') state.create.warehouse = field.value
      else if (name === 'create-borrowType') state.create.borrowType = field.value
      else if (name === 'create-borrower') state.create.borrower = field.value
      else if (name === 'create-carrier') state.create.carrier = field.value
      else if (name === 'create-recipientInfo') state.create.recipientInfo = field.value
      else if (name === 'create-purpose') state.create.purpose = field.value
      return true
    }
    if (name === 'lineSku' || name === 'lineQty') {
      const index = Number(field.dataset[`${DATASET_PREFIX}LineIndex`])
      const line = state.createLines[index]
      if (line) {
        if (name === 'lineSku') line.sku = field.value
        else line.quantity = Math.max(1, Number(field.value) || 1)
      }
      return true
    }
    if (name === 'carrier') { state.carrier = field.value; return true }
    if (name === 'pushStatus') { state.pushStatus = field.value; return true }
    if (name === 'printStatus') { state.printStatus = field.value; return true }
    if (name === 'borrower') { state.borrower = field.value; return true }
    if (name === 'purpose') { state.purpose = field.value; return true }
    if (name === 'waybillNo') { state.waybillNo = field.value; return true }
    if (name === 'sourceNo') { state.sourceNo = field.value; return true }
    if (name === 'sku') { state.sku = field.value; return true }
    if (name === 'keyword') { state.keyword = field.value; return true }
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change') return true
  const tabKey = parseActionKey(action, 'tab')
  if (tabKey !== null) {
    state.status = tabKey === 'all' ? '' : tabKey
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
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const root = rootElement()
    const read = (field: string): string => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${field}"]`)?.value ?? ''
    const normalized = (value: string, all: string): string => (value === all ? '' : value)
    state.keyword = read('keyword')
    state.sourceNo = read('sourceNo')
    state.sku = read('sku')
    state.borrower = read('borrower')
    state.purpose = read('purpose')
    state.carrier = read('carrier')
    state.waybillNo = read('waybillNo')
    state.warehouse = normalized(read('warehouse'), '全部仓库')
    state.borrowType = normalized(read('borrowType'), '全部借出类别')
    state.pushStatus = read('pushStatus')
    state.printStatus = read('printStatus')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.sourceNo = ''
    state.sku = ''
    state.borrower = ''
    state.purpose = ''
    state.carrier = ''
    state.waybillNo = ''
    state.warehouse = ''
    state.borrowType = ''
    state.status = ''
    state.pushStatus = ''
    state.printStatus = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'bulk-print') {
    if (state.selected.size === 0) { showListFeedback('请先勾选需要打单的借出单', 'warning'); return true }
    let count = 0
    state.selected.forEach(id => { const row = rowById(id); if (row && row.printStatus !== '已打印') { row.printStatus = '已打印'; count += 1 } })
    showListFeedback(count > 0 ? `已对 ${count} 条借出单完成打单` : '所选借出单均已打单，无需重复操作', count > 0 ? 'success' : 'info')
    refreshWorkspace()
    return true
  }
  if (action === 'bulk-ship') {
    if (state.selected.size === 0) { showListFeedback('请先勾选需要发货的借出单', 'warning'); return true }
    let count = 0
    state.selected.forEach(id => { const row = rowById(id); if (row && row.status === '待借出') { row.status = '已借出'; count += 1 } })
    showListFeedback(count > 0 ? `已发货 ${count} 条借出单` : '所选借出单中没有待借出记录，未发货', count > 0 ? 'success' : 'info')
    refreshWorkspace()
    return true
  }
  if (action === 'open-create') {
    state.showCreate = true
    state.create = { warehouse: ONLINE_WAREHOUSE_OPTIONS[1], borrowType: '跟单', borrower: '', recipientInfo: '', purpose: '', carrier: 'J&T Express' }
    state.createLines = [{ key: 1, sku: ONLINE_PRODUCTS[0].sku, quantity: 1 }]
    state.nextLineKey = 2
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-create') { state.showCreate = false; refreshWorkspace(); return true }
  if (action === 'add-line') {
    syncCreateForm()
    state.createLines.push({ key: state.nextLineKey++, sku: ONLINE_PRODUCTS[0].sku, quantity: 1 })
    const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
    if (host) { host.innerHTML = renderWorkspace(); hydrateIcons(host) }
    return true
  }
  if (action === 'submit-create') {
    syncCreateForm()
    if (!state.create.borrower.trim()) { showListFeedback('请填写借用人', 'warning'); return true }
    if (!state.create.recipientInfo.trim()) { showListFeedback('请填写收件信息', 'warning'); return true }
    const validLines = state.createLines.filter(line => line.quantity > 0)
    if (validLines.length === 0) { showListFeedback('请至少添加一行借出商品', 'warning'); return true }
    const product = ONLINE_PRODUCTS.find(p => p.sku === validLines[0].sku) ?? ONLINE_PRODUCTS[0]
    const seq = loanSeed.length + 1
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const row: LoanRow = {
      id: `LOAN-${String(seq).padStart(4, '0')}`,
      loanOrderNo: `JC-20261015-${String(5000 + seq).padStart(4, '0')}`,
      sourceOrderNo: `LY-NEW-${String(seq).padStart(4, '0')}`,
      warehouse: state.create.warehouse,
      product,
      quantity: validLines.reduce((sum, line) => sum + line.quantity, 0),
      borrower: state.create.borrower.trim(),
      borrowType: state.create.borrowType,
      recipientInfo: state.create.recipientInfo.trim(),
      operator: '待分配',
      status: '待借出',
      pushStatus: '未推单',
      printStatus: '未下载',
      createdAt: stamp,
      waybillNo: `SP${String(59000000 + seq * 97).padStart(12, '0')}`,
      carrier: state.create.carrier,
    }
    loanSeed.unshift(row)
    state.showCreate = false
    state.currentPage = 1
    showListFeedback(`借出单 ${row.loanOrderNo} 已创建，共 ${row.quantity} 件`)
    refreshWorkspace()
    return true
  }
  if (action === 'row-print') {
    const row = rowById(actionNode.dataset[`${DATASET_PREFIX}Id`] || '')
    if (!row) return true
    if (row.printStatus === '已打印') { showListFeedback('该借出单已打印，无需重复打印', 'info'); return true }
    row.printStatus = '已打印'
    showListFeedback(`${row.loanOrderNo} 面单已打印`)
    refreshWorkspace()
    return true
  }
  if (action === 'row-ship') {
    const row = rowById(actionNode.dataset[`${DATASET_PREFIX}Id`] || '')
    if (!row) return true
    if (row.status !== '待借出') { showListFeedback('只有待借出的借出单可以发货', 'info'); return true }
    row.status = '已借出'
    showListFeedback(`${row.loanOrderNo} 已发货，状态进入已借出`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '借出单管理', columns, rows: filteredRows() }); return true }
  return false
}
