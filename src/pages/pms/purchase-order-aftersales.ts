// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import {
  type PmsAftersaleStatus,
  type PmsPurchaseOrderAftersale,
  addPmsAftersaleReturnTracking,
  batchApprovePmsAftersales,
  batchStartPmsAftersales,
  batchUpdatePmsAftersaleStatus,
  filterPmsPurchaseOrderAftersales,
  getPmsPurchaseOrderAftersale,
  rejectPmsAftersale,
  startPmsAftersale,
  updatePmsAftersaleRemark,
  updatePmsAftersaleReturnAddress,
  updatePmsAftersaleStatus,
} from '../../data/pms/purchase-order-aftersales.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { hydratePmsSurface, renderPmsFeedback, renderPmsOverlayError } from './shared.ts'

const EVENT_PREFIX = 'pms-posa'
const ROOT_SELECTOR = '[data-pms-posa-root]'

interface AftersalePageState extends ProcessOrderListControllerState {
  productCode: string
  status: '' | PmsAftersaleStatus
  platform: '' | PmsPurchaseOrderAftersale['platform']
  selectedIds: string[]
  overlay:
    | null
    | { kind: 'address'; aftersaleId: string; clientActionId: string; address: string }
    | { kind: 'tracking'; aftersaleId: string; clientActionId: string; carrier: string; trackingNo: string }
    | { kind: 'status'; aftersaleId: string; clientActionId: string; status: PmsAftersaleStatus; remark: string }
    | { kind: 'remark'; aftersaleId: string; clientActionId: string; remark: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const state: AftersalePageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  productCode: '',
  status: '',
  platform: '',
  selectedIds: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsPurchaseOrderAftersale[] {
  return filterPmsPurchaseOrderAftersales({
    productCode: state.productCode,
    status: state.status,
    platform: state.platform,
  })
}

function statusTone(status: PmsAftersaleStatus): 'blue' | 'green' | 'yellow' | 'slate' | 'red' {
  if (status === '待处理') return 'yellow'
  if (status === '售后中') return 'blue'
  if (status === '已完成') return 'green'
  return 'red'
}

function formatTracking(entries: PmsPurchaseOrderAftersale['inboundTrackings']): string {
  if (!entries.length) return '—'
  return entries
    .map((entry) => {
      const pickedUp = entry.pickedUpAt ? `揽收：${entry.pickedUpAt.replace('T', ' ').slice(0, 16)}` : ''
      const signed = entry.signedAt ? `签收：${entry.signedAt.replace('T', ' ').slice(0, 16)}` : ''
      const timing = [pickedUp, signed].filter(Boolean).join('<br/>')
      return `${escapeHtml(entry.carrier)} : ${escapeHtml(entry.trackingNo)}${timing ? `<br/>${timing}` : ''}`
    })
    .join('<br/>')
}

const columns: StandardListColumn<PmsPurchaseOrderAftersale>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((r) => r.id), new Set(state.selectedIds), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.id)}" data-${EVENT_PREFIX}-field="select-row" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true" />`,
  },
  {
    key: 'serial',
    title: '序号',
    width: 90,
    render: (row) => `<span class="tabular-nums">${escapeHtml(row.id)}</span>`,
  },
  {
    key: 'product',
    title: '商品信息',
    width: 220,
    required: true,
    freezeable: true,
    render: (row) => `<div><div class="font-medium">SPU：${escapeHtml(row.spu)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.productName)}</div><div class="mt-1 text-xs text-slate-500">成本价：<strong class="tabular-nums">${row.costPrice.toFixed(2)}</strong></div></div>`,
  },
  {
    key: 'purchaseOrder',
    title: '关联采购单',
    width: 240,
    render: (row) => `<div class="space-y-1 text-xs"><div>供应商：<strong>${escapeHtml(row.supplierName)}</strong></div><div>收件人：${escapeHtml(row.recipientName)} · ${escapeHtml(row.platform)}</div><div>采购类型：${escapeHtml(row.purchaseType)} · 采购单：${escapeHtml(row.purchaseOrderNo)}</div><div>采购备注：<pre class="whitespace-pre-wrap text-xs text-slate-500">${escapeHtml(row.purchaseRemark)}</pre></div><div>规格：<pre class="whitespace-pre-wrap text-xs text-slate-500">${escapeHtml(row.specs)}</pre></div><div>采购员：${escapeHtml(row.purchaser)}</div></div>`,
  },
  {
    key: 'status',
    title: '售后状态',
    width: 100,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs ${row.status === '待处理' ? 'bg-amber-50 text-amber-700' : row.status === '售后中' ? 'bg-blue-50 text-blue-700' : row.status === '已完成' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${escapeHtml(row.status)}</span>`,
  },
  {
    key: 'reason',
    title: '售后原因',
    width: 120,
    render: (row) => `<span class="text-xs">${escapeHtml(row.reason) || '—'}</span>`,
  },
  {
    key: 'inboundTracking',
    title: '收货快递信息',
    width: 200,
    render: (row) => `<div class="text-xs text-slate-600">${formatTracking(row.inboundTrackings)}</div>`,
  },
  {
    key: 'returnAddress',
    title: '退货地址',
    width: 180,
    render: (row) => row.returnAddress ? `<span class="text-xs">${escapeHtml(row.returnAddress)}</span>` : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'returnTracking',
    title: '退货快递信息',
    width: 160,
    render: (row) => row.returnTrackings.length ? formatTracking(row.returnTrackings) : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'time',
    title: '时间',
    width: 150,
    render: (row) => `<div class="text-xs text-slate-600">创建：${escapeHtml(row.createdAt)}</div>`,
  },
  {
    key: 'applicant',
    title: '售后申请人',
    width: 100,
    render: (row) => `<span class="text-xs">${escapeHtml(row.applicant)}</span>`,
  },
  {
    key: 'remark',
    title: '备注',
    width: 140,
    render: (row) => row.remark ? `<span class="text-xs text-slate-600">${escapeHtml(row.remark)}</span>` : '<span class="text-xs text-slate-400">—</span>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 180,
    actionColumn: true,
    render: (row) => {
      const actions: string[] = []
      if (row.status === '待处理') {
        actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50" data-${EVENT_PREFIX}-action="start" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">开始售后</button>`)
        actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-rose-700 hover:bg-rose-50" data-${EVENT_PREFIX}-action="reject" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">驳回</button>`)
      } else if (row.status === '售后中') {
        actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-address" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">完善信息</button>`)
        actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-tracking" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">更新退货快递</button>`)
        actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-status" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">更新状态</button>`)
      }
      actions.push(`<button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-remark" data-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">备注</button>`)
      return `<div class="flex flex-wrap items-center justify-end gap-1.5">${actions.join('')}</div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/product-purchase-order-aftersales',
  pageSizeOptions: [10, 20, 50, 100],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-posa-table-surface]',
  paginationSurfaceSelector: '[data-pms-posa-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-posa-overlays]',
  defaultFrozenKeys: ['product', 'purchaseOrder'],
  columnSettingsTitle: '商品采购售后列设置',
  emptyText: '当前条件下暂无售后单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function syncSelectionButtons(): void {
  const root = rootElement()
  if (!root) return
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedIds.length ? ` · 已选 ${state.selectedIds.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function rootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statusOptions = ['', '待处理', '售后中', '已完成', '已驳回']
    .map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部'}</option>`)
    .join('')
  const platformOptions = ['', '淘宝', '天猫', '拼多多', '1688', '其他']
    .map((value) => `<option value="${value}" ${state.platform === value ? 'selected' : ''}>${value || '全部'}</option>`)
    .join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">商品识别码</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="SPU / 采购单 / 售后单号" value="${escapeHtml(state.productCode)}" data-${EVENT_PREFIX}-field="productCode" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">售后状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购平台</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="platform" data-skip-page-rerender="true">${platformOptions}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('批量开始售后', { prefix: EVENT_PREFIX, action: 'batch-start' }, 'play')}
    ${renderSecondaryButton('批量同意退货', { prefix: EVENT_PREFIX, action: 'batch-approve' }, 'check')}
    ${renderSecondaryButton('批量更新状态', { prefix: EVENT_PREFIX, action: 'batch-status' }, 'refresh-ccw')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const items = [
    { label: '售后单数', value: rows.length },
    { label: '待处理', value: rows.filter((r) => r.status === '待处理').length },
    { label: '售后中', value: rows.filter((r) => r.status === '售后中').length },
    { label: '总成本', value: rows.reduce((sum, r) => sum + r.costPrice, 0).toFixed(2) },
  ]
  return renderProcessOrderStats(items)
}

function renderAddressOverlay(aftersaleId: string, address: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="完善退货地址"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[520px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">完善退货地址</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(aftersaleId)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">退货地址
      <textarea class="min-h-32 rounded-md border bg-background p-2 text-sm" placeholder="详细地址" data-${EVENT_PREFIX}-address-input="1" data-skip-page-rerender="true">${escapeHtml(address)}</textarea>
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-posa-address="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存地址', { prefix: EVENT_PREFIX, action: 'submit-address' }, 'check-check')}</footer></section></div>`
}

function renderTrackingOverlay(aftersaleId: string, carrier: string, trackingNo: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="更新退货快递"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[520px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">更新退货快递</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(aftersaleId)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">快递公司
      <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="如 STO / ZTO / YTO / YT" value="${escapeHtml(carrier)}" data-${EVENT_PREFIX}-tracking-carrier="1" data-skip-page-rerender="true" />
    </label>
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">快递单号
      <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="快递单号" value="${escapeHtml(trackingNo)}" data-${EVENT_PREFIX}-tracking-no="1" data-skip-page-rerender="true" />
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-posa-tracking="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存快递', { prefix: EVENT_PREFIX, action: 'submit-tracking' }, 'check-check')}</footer></section></div>`
}

function renderStatusOverlay(aftersaleId: string, status: PmsAftersaleStatus, remark: string, clientActionId: string): string {
  const statusOptions = ['待处理', '售后中', '已完成', '已驳回']
    .map((value) => `<option value="${value}" ${status === value ? 'selected' : ''}>${value}</option>`)
    .join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="更新售后状态"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[520px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">更新售后状态</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(aftersaleId)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标状态
      <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-status-select="1" data-skip-page-rerender="true">${statusOptions}</select>
    </label>
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">说明
      <textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" placeholder="状态切换原因" data-${EVENT_PREFIX}-status-remark="1" data-skip-page-rerender="true">${escapeHtml(remark)}</textarea>
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-posa-status-overlay="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存状态', { prefix: EVENT_PREFIX, action: 'submit-status' }, 'check-check')}</footer></section></div>`
}

function renderRemarkOverlay(aftersaleId: string, remark: string, clientActionId: string): string {
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="售后备注"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 flex h-full w-[480px] max-w-[92vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">售后备注</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(aftersaleId)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    ${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注
      <textarea class="min-h-32 rounded-md border bg-background p-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-remark-input="1" data-skip-page-rerender="true">${escapeHtml(remark)}</textarea>
    </label>
    </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3" data-pms-posa-remark="${escapeHtml(clientActionId)}">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存备注', { prefix: EVENT_PREFIX, action: 'submit-remark' }, 'check-check')}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-posa-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  const clientActionId = state.overlay.clientActionId
  if (state.overlay.kind === 'address') return `${columnSettings}${renderAddressOverlay(state.overlay.aftersaleId, state.overlay.address, clientActionId)}`
  if (state.overlay.kind === 'tracking') return `${columnSettings}${renderTrackingOverlay(state.overlay.aftersaleId, state.overlay.carrier, state.overlay.trackingNo, clientActionId)}`
  if (state.overlay.kind === 'status') return `${columnSettings}${renderStatusOverlay(state.overlay.aftersaleId, state.overlay.status, state.overlay.remark, clientActionId)}`
  return `${columnSettings}${renderRemarkOverlay(state.overlay.aftersaleId, state.overlay.remark, clientActionId)}`
}

function renderBody(): string {
  const stats = renderStats()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    showHeader: false,
    title: '商品采购售后',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: stats,
    listTitle: `共 ${filteredRows().length} 条${state.selectedIds.length ? ` · 已选 ${state.selectedIds.length} 条` : ''}`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-posa-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-posa-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-posa-overlays>${renderOverlays()}</div>`,
  })
}

function handleFieldEvent(target: HTMLElement): void {
  const field = target.dataset[`${EVENT_PREFIX}Field`]
  if (!field || field === 'select-row') return
  const value = (target as HTMLInputElement).value
  switch (field) {
    case 'productCode': state.productCode = value; break
    case 'status': state.status = value as '' | PmsAftersaleStatus; break
    case 'platform': state.platform = value as '' | PmsPurchaseOrderAftersale['platform']; break
  }
}

function handleChangeEvent(target: HTMLElement): void {
  if (target.dataset[`${EVENT_PREFIX}Field`] === 'select-row') {
    const id = target.dataset.id ?? ''
    if (target instanceof HTMLInputElement && target.checked) {
      if (!state.selectedIds.includes(id)) state.selectedIds.push(id)
    } else {
      state.selectedIds = state.selectedIds.filter((s) => s !== id)
    }
    syncSelectionButtons()
  }
}

function readOverlayValue(selector: string): string {
  const overlayEl = state.overlay ? document.querySelector<HTMLElement>(`[data-pms-posa-${state.overlay.kind}="${state.overlay.clientActionId}"]`) : null
  const parent = overlayEl?.parentElement
  const inputEl = parent?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
  return inputEl?.value ?? ''
}

function handleActionEvent(target: HTMLElement): void {
  const action = target.dataset[`${EVENT_PREFIX}Action`]
  if (!action) return
  const id = target.dataset.id ?? ''
  switch (action) {
    case 'query':
      state.currentPage = 1
      state.feedback = '已应用筛选条件'
      state.feedbackOk = true
      break
    case 'reset': {
      state.productCode = ''
      state.status = ''
      state.platform = ''
      state.currentPage = 1
      state.feedback = '已重置筛选'
      state.feedbackOk = true
      break
    }
    case 'export': {
      const rows = filteredRows()
      downloadPmsCsv(
        'higood-pms-purchase-order-aftersales.csv',
        ['售后单号', 'SPU', '商品名称', '采购单号', '供应商', '状态', '原因', '申请人'],
        rows.map((r) => [r.id, r.spu, r.productName, r.purchaseOrderNo, r.supplierName, r.status, r.reason, r.applicant]),
      )
      state.feedback = '已导出商品采购售后 CSV'
      state.feedbackOk = true
      break
    }
    case 'batch-start': {
      if (state.selectedIds.length === 0) {
        state.feedback = '请先勾选售后单'
        state.feedbackOk = false
        break
      }
      const result = batchStartPmsAftersales(state.selectedIds, '批量操作', '')
      state.feedback = `批量开始售后:已更新 ${result.updatedCount} 张,驳回 ${result.rejectedCount} 张`
      state.feedbackOk = result.rejectedCount === 0
      state.selectedIds = []
      break
    }
    case 'batch-approve': {
      if (state.selectedIds.length === 0) {
        state.feedback = '请先勾选售后单'
        state.feedbackOk = false
        break
      }
      const result = batchApprovePmsAftersales(state.selectedIds, '批量操作', '')
      state.feedback = `批量同意退货:已更新 ${result.updatedCount} 张,拒绝 ${result.rejectedCount} 张`
      state.feedbackOk = result.rejectedCount === 0
      state.selectedIds = []
      break
    }
    case 'batch-status': {
      if (state.selectedIds.length === 0) {
        state.feedback = '请先勾选售后单'
        state.feedbackOk = false
        break
      }
      const result = batchUpdatePmsAftersaleStatus(state.selectedIds, '已完成', '批量操作', '由批量更新完成')
      state.feedback = `批量更新状态为已完成:已更新 ${result.updatedCount} 张,拒绝 ${result.rejectedCount} 张`
      state.feedbackOk = result.rejectedCount === 0
      state.selectedIds = []
      break
    }
    case 'start': {
      try {
        startPmsAftersale(id, '管理员', '')
        state.feedback = `已开始售后 ${id}`
        state.feedbackOk = true
      } catch (error) {
        state.feedback = error instanceof Error ? error.message : '开始售后失败'
        state.feedbackOk = false
      }
      break
    }
    case 'reject': {
      try {
        rejectPmsAftersale(id, '管理员', '不满足售后条件')
        state.feedback = `已驳回售后 ${id}`
        state.feedbackOk = true
      } catch (error) {
        state.feedback = error instanceof Error ? error.message : '驳回失败'
        state.feedbackOk = false
      }
      break
    }
    case 'open-address': {
      const row = getPmsPurchaseOrderAftersale(id)
      state.overlay = { kind: 'address', aftersaleId: id, clientActionId: `posa-${Date.now()}`, address: row?.returnAddress ?? '' }
      state.overlayError = ''
      break
    }
    case 'open-tracking': {
      state.overlay = { kind: 'tracking', aftersaleId: id, clientActionId: `posa-${Date.now()}`, carrier: '', trackingNo: '' }
      state.overlayError = ''
      break
    }
    case 'open-status': {
      const row = getPmsPurchaseOrderAftersale(id)
      state.overlay = { kind: 'status', aftersaleId: id, clientActionId: `posa-${Date.now()}`, status: row?.status ?? '售后中', remark: '' }
      state.overlayError = ''
      break
    }
    case 'open-remark': {
      const row = getPmsPurchaseOrderAftersale(id)
      state.overlay = { kind: 'remark', aftersaleId: id, clientActionId: `posa-${Date.now()}`, remark: row?.remark ?? '' }
      state.overlayError = ''
      break
    }
    case 'submit-address': {
      if (!state.overlay || state.overlay.kind !== 'address') return
      const value = readOverlayValue(`[data-${EVENT_PREFIX}-address-input]`)
      if (!value.trim()) {
        state.overlayError = '请填写退货地址'
        break
      }
      try {
        updatePmsAftersaleReturnAddress(state.overlay.aftersaleId, value.trim(), '管理员')
        state.feedback = `已更新 ${state.overlay.aftersaleId} 退货地址`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'submit-tracking': {
      if (!state.overlay || state.overlay.kind !== 'tracking') return
      const carrier = readOverlayValue(`[data-${EVENT_PREFIX}-tracking-carrier]`)
      const trackingNo = readOverlayValue(`[data-${EVENT_PREFIX}-tracking-no]`)
      if (!carrier.trim() || !trackingNo.trim()) {
        state.overlayError = '请填写快递公司与单号'
        break
      }
      try {
        addPmsAftersaleReturnTracking(state.overlay.aftersaleId, carrier.trim(), trackingNo.trim(), '管理员')
        state.feedback = `已添加退货快递 ${carrier} : ${trackingNo}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'submit-status': {
      if (!state.overlay || state.overlay.kind !== 'status') return
      const statusSelect = document.querySelector<HTMLSelectElement>(`[data-pms-posa-status-overlay="${state.overlay.clientActionId}"]`)
        ?.parentElement?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-status-select]`)
      const remarkInput = document.querySelector<HTMLTextAreaElement>(`[data-pms-posa-status-overlay="${state.overlay.clientActionId}"]`)
        ?.parentElement?.querySelector<HTMLTextAreaElement>(`[data-${EVENT_PREFIX}-status-remark]`)
      const newStatus = (statusSelect?.value ?? state.overlay.status) as PmsAftersaleStatus
      try {
        updatePmsAftersaleStatus(state.overlay.aftersaleId, newStatus, '管理员', remarkInput?.value ?? '')
        state.feedback = `已更新 ${state.overlay.aftersaleId} 状态为 ${newStatus}`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'submit-remark': {
      if (!state.overlay || state.overlay.kind !== 'remark') return
      const value = readOverlayValue(`[data-${EVENT_PREFIX}-remark-input]`)
      try {
        updatePmsAftersaleRemark(state.overlay.aftersaleId, value, '管理员')
        state.feedback = `已保存 ${state.overlay.aftersaleId} 备注`
        state.feedbackOk = true
        state.overlay = null
      } catch (error) {
        state.overlayError = error instanceof Error ? error.message : '保存失败'
      }
      break
    }
    case 'close-overlay':
      state.overlay = null
      state.overlayError = ''
      break
  }
}

export function renderPmsPurchaseOrderAftersalesPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, false)
  const html = renderBody()
  queueMicrotask(() => {
    const root = rootElement()
    hydratePmsSurface(root)
    syncSelectionButtons()
  })
  return html
}

export function handlePmsPurchaseOrderAftersalesEvent(event: Event): void {
  const target = event.target as HTMLElement
  if (!target || typeof target.closest !== 'function') return
  const actionable = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-field], [data-${EVENT_PREFIX}-action]`)
  if (!actionable || !rootElement()?.contains(actionable)) return
  if (actionable.dataset[`${EVENT_PREFIX}Action`]) {
    handleActionEvent(actionable)
  } else if (actionable.dataset[`${EVENT_PREFIX}Field`]) {
    if (event.type === 'change') handleChangeEvent(actionable)
    else handleFieldEvent(actionable)
  }
}

export function closePmsPurchaseOrderAftersalesOverlays(): void {
  state.overlay = null
  state.overlayError = ''
}

void statusTone
