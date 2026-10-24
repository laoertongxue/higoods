// @page-pattern: list
import { handleFinishedInventoryQualityEvent } from './inventory-quality.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { FINISHED_OUTBOUND_SEED, OUTBOUND_STATUSES, emptyFinishedOutboundFilters, filterFinishedOutboundOrders, outboundQuantity, loadFinishedOutboundOrders, saveFinishedOutboundAction, type FinishedOutboundOrder, type FinishedOutboundProduct, type FinishedOutboundFilters, type FinishedOutboundAction } from '../../../data/wls/finished-outbound-orders.ts'
import { listFinishedInventoryOutboundOrders } from '../../../data/wls/finished-inventory-quality.ts'
import { createOutboundWaybillPdf } from './outbound-waybill.ts'

const PREFIX = 'wls-outbound-orders'
const PATH = '/wls/finished/outbound-orders'
// 少量有界偏好，无业务数据；读取和写入均允许 storage 不可用。
const PREFERENCE_KEY = `${PATH}:online-columns-v1`
const PAGE_SIZES = [10, 15, 20, 50, 100, 200, 300, 500, 1000]
const state = {
  rows: FINISHED_OUTBOUND_SEED,
  loaded: false, hasReadRecords: false, loading: false, readError: '', busy: false,
  draft: emptyFinishedOutboundFilters(), filters: emptyFinishedOutboundFilters(), status: '',
  currentPage: 1, selected: new Set<string>(), showColumns: false, detailTab: 'products',
  preferences: null as StandardListColumnPreferences | null,
  confirmation: null as { action: FinishedOutboundAction; ids: string[]; operationId: string; versions: Record<string, number> } | null,
  saveError: '', focusReturn: null as HTMLElement | null,
}
const action = (name: string) => `data-${PREFIX}-action="${name}" data-skip-page-rerender="true"`
const root = () => typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${PREFIX}-root]`)
const orderUrl = (id: string) => `${PATH}?id=${encodeURIComponent(id)}`
const rowData = (row: FinishedOutboundOrder) => `data-order-id="${e(row.id)}"`
const controlClass = 'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm'

const allOutboundRows = (): FinishedOutboundOrder[] => [...listFinishedInventoryOutboundOrders(), ...state.rows]

function thumbnail(product: FinishedOutboundProduct): string {
  return `<div class="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-slate-50"><button type="button" class="h-full w-full" data-pda-image-preview-url="${e(product.imageUrl)}" data-pda-image-preview-title="${e(product.sku)}" data-skip-page-rerender="true" aria-label="查看 ${e(product.sku)} 大图"><img src="${e(product.imageUrl)}" alt="${e(product.spu)} ${e(product.sku)} 商品图" class="h-full w-full object-contain" onload="this.parentElement.nextElementSibling.hidden=true" onerror="this.hidden=true;this.parentElement.nextElementSibling.textContent='图片加载失败';this.parentElement.nextElementSibling.hidden=false"></button><span class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 text-center text-[10px] text-slate-500">加载中</span></div>`
}
function productsHtml(row: FinishedOutboundOrder): string {
  return `<div class="space-y-3">${row.products.map(product => `<div class="flex items-start gap-2">${thumbnail(product)}<div class="min-w-0 flex-1 space-y-1 text-xs"><div class="break-all"><span class="text-slate-500">SPU：</span>${e(product.spu)}</div><div class="break-all"><span class="text-slate-500">SKU：</span>${e(product.sku)} × <span class="rounded bg-blue-500 px-1 text-white">${product.quantity}</span></div><div class="space-y-1 rounded border bg-slate-50 p-2 text-slate-600"><div>待发货：${product.pendingQuantity} 件</div>${product.locations.map(location => `<div>库位：${e(location.name)}　库存：${location.quantity} 件</div>`).join('')}<div>更新时间：${e(product.inventoryUpdatedAt || '—')}</div></div></div></div>`).join('')}</div>`
}
function copyLine(label: string, value: string, order?: FinishedOutboundOrder): string {
  if (!value) return ''
  const display = order?.labelDownloadedAt ? `<button type="button" class="break-all text-left text-blue-700 underline" ${action('view-label')} ${rowData(order)}>${e(value)}</button>` : `<span class="break-all">${e(value)}</span>`
  return `<div class="flex items-start gap-1"><span class="shrink-0 text-slate-500">${label}：</span>${display}<button type="button" class="shrink-0 rounded px-1 text-slate-400 hover:text-blue-600" ${action('copy')} data-copy-value="${e(value)}" aria-label="复制${label} ${e(value)}">⧉</button></div>`
}
const tones: Record<string, string> = { 待处理: 'bg-amber-50 text-amber-700', 待拣货: 'bg-amber-50 text-amber-700', 拣货完成: 'bg-blue-50 text-blue-700', 已打单: 'bg-blue-50 text-blue-700', 已出库: 'bg-emerald-50 text-emerald-700', 已揽收: 'bg-emerald-50 text-emerald-700', 已取消: 'bg-slate-100 text-slate-600' }
function rowActions(row: FinishedOutboundOrder): string {
  const button = (name: string, label: string, tone = 'text-blue-700') => `<button type="button" class="rounded border px-2 py-1 text-xs ${tone} disabled:opacity-40" ${action(name)} ${rowData(row)} ${state.busy || state.readError || !state.loaded ? 'disabled' : ''}>${label}</button>`
  return `<div class="flex flex-col items-start gap-2"><a href="${orderUrl(row.id)}" data-nav="${orderUrl(row.id)}" class="rounded bg-blue-500 px-4 py-1 text-xs text-white">查看</a>${row.platform === 'Tiktok' && row.status !== '待处理' && row.status !== '已取消' ? button('download-label', '重新下载面单') : ''}${row.status === '已打单' ? `${button('print', '打印面单')}${button('cancel-print', '取消打单', 'text-red-700')}` : ''}</div>`
}
const columns: StandardListColumn<FinishedOutboundOrder>[] = [
  { key: 'selection', title: '选择', width: 54, leadingControlColumn: true, render: row => `<input type="checkbox" data-preserve-native-click="true" class="h-4 w-4" aria-label="选择 ${e(row.outboundOrderNo)}" ${action('select-row')} ${rowData(row)} ${state.selected.has(row.id) ? 'checked' : ''}>` },
  { key: 'orderNos', title: '单号', width: 245, required: true, freezeable: true, render: row => `<div class="space-y-1 text-xs">${copyLine('出库单号', row.outboundOrderNo)}${copyLine('关联单号', row.relatedOrderNo)}${copyLine('跟踪单号', row.trackingNo, row)}<div class="break-all text-slate-500">备注：${e(row.remark || '—')}</div></div>` },
  { key: 'products', title: '商品信息', width: 325, required: true, freezeable: true, render: productsHtml },
  { key: 'warehouse', title: '出库仓库', width: 120, freezeable: true, render: row => `<span class="text-xs">${e(row.warehouse)}(${e(row.warehouse)})</span>` },
  { key: 'orderType', title: '出库类型', width: 95, freezeable: true, render: row => `<div class="space-y-1 text-xs"><div>${e(row.orderType)}</div><div>${e(row.platform)}</div></div>` },
  { key: 'quantity', title: '出库数量', width: 90, align: 'center', render: row => `${outboundQuantity(row)} 件` },
  { key: 'printCount', title: '面单打印次数', width: 110, align: 'center', render: row => String(row.printCount) },
  { key: 'status', title: '状态', width: 90, required: true, render: row => `<span class="whitespace-nowrap rounded px-2 py-1 text-xs ${tones[row.status]}">${e(row.status)}</span>` },
  { key: 'time', title: '创建时间', width: 230, render: row => `<div class="space-y-1 text-xs">${([['创建时间', row.createdAt], ['更新时间', row.updatedAt], ['揽收时效', row.deadline], ['发货时间', row.shippedAt], ['面单下载', row.labelDownloadedAt], ['打单时间', row.printedAt], ['取消时间', row.cancelledAt]] as const).filter(([, value]) => value).map(([label, value]) => `<div>${label}：${e(value)}</div>`).join('')}</div>` },
  { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true, render: rowActions },
]
const rules = columns.map(column => ({ key: column.key, required: column.required, freezeable: column.freezeable, actionColumn: column.actionColumn }))
function defaults(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(rules, { order: columns.map(column => column.key), visibleKeys: columns.filter(column => column.key !== 'selection').map(column => column.key), frozenKeys: [], pageSize: 15 }, PAGE_SIZES)
}
function preferences(): StandardListColumnPreferences {
  if (state.preferences) return state.preferences
  try { state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, rules, defaults(), PAGE_SIZES) } catch { state.preferences = defaults() }
  return state.preferences
}
function persistPreferences(): void {
  try { saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, preferences()) } catch { /* 偏好不阻断当前操作。 */ }
}
function visibleColumns(): StandardListColumn<FinishedOutboundOrder>[] {
  return columns.filter(column => column.key !== 'selection' || state.status === '已打单')
}
function field(name: keyof FinishedOutboundFilters, label: string, placeholder = ''): string {
  return `<input class="${controlClass}" value="${e(state.draft[name])}" placeholder="${e(placeholder || label)}" aria-label="${label}" data-${PREFIX}-field="${name}" data-skip-page-rerender="true">`
}
function select(name: keyof FinishedOutboundFilters, label: string, first: string, options: readonly (readonly [string, string])[]): string {
  return `<select class="${controlClass}" aria-label="${label}" data-${PREFIX}-field="${name}" data-skip-page-rerender="true"><option value="">${first}</option>${options.map(([value, text]) => `<option value="${e(value)}" ${state.draft[name] === value ? 'selected' : ''}>${e(text)}</option>`).join('')}</select>`
}
function statusTabs(): string {
  const filtered = filterFinishedOutboundOrders(allOutboundRows(), state.filters)
  return `<div class="flex flex-wrap gap-2" data-outbound-status-tabs>${['', ...OUTBOUND_STATUSES].map(status => `<button type="button" class="min-h-8 rounded border px-3 py-1 text-xs ${state.status === status ? 'border-blue-500 bg-blue-500 font-medium text-white' : 'border-blue-200 bg-white text-slate-600 hover:bg-blue-50'}" ${action('status')} data-status="${e(status)}" aria-pressed="${state.status === status}">${status || '全部'} (${status ? filtered.filter(row => row.status === status).length : filtered.length})</button>`).join('')}</div>`
}
function filtersHtml(): string {
  const range = (label: string, from: keyof FinishedOutboundFilters, to: keyof FinishedOutboundFilters) => `<div class="flex min-w-0 flex-wrap items-center gap-2"><span class="text-xs text-slate-600">${label}</span><div class="flex min-w-0 flex-1 items-center gap-2">${field(from, `${label}开始`, '开始时间')}<span class="text-slate-400">-</span>${field(to, `${label}截止`, '截止时间')}</div></div>`
  return `<div class="space-y-3 rounded-lg border bg-white p-4"><div class="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6"><div class="col-span-2">${field('keyword', '搜索出库单号 / 关联单号 / 跟踪单号')}</div>${field('spu', 'SPU搜索')}${field('sku', 'SKU搜索')}${select('warehouse', '出库仓库', '全部仓库', [...new Set(allOutboundRows().map(row => row.warehouse))].map(name => [name, name] as const))}${select('platform', '平台', '全部平台', [['Tiktok', 'Tiktok'], ['Shopee', 'Shopee']])}${select('hasLabel', '是否已出面单', '是否已出面单', [['yes', '已出面单'], ['no', '未出面单']])}${select('orderType', '出库类型', '全部出库类型', [['现货订单', '现货订单'], ['预售订单', '预售订单'], ['成衣质检', '成衣质检']])}${select('pickType', '拣货类型', '全部拣货类型', [['single', '一票一件'], ['multiple', '一票多件']])}${select('kol', 'KOL订单', '全部订单', [['yes', 'KOL订单'], ['no', '非KOL订单']])}${select('stock', '库存状态', '全部库存状态', [['shortage', '缺货'], ['available', '有货']])}<div class="flex gap-2">${select('sortField', '排序字段', '排序字段', [['createdAt', '创建时间'], ['pickedAt', '拣货时间'], ['deadline', '揽收时效'], ['shippedAt', '发货时间']])}${select('sortDirection', '排序方式', '排序方式', [['asc', '升序'], ['desc', '降序']])}</div></div><div class="grid grid-cols-1 gap-3 xl:grid-cols-3">${range('创建时间', 'createdFrom', 'createdTo')}${range('揽收时效', 'deadlineFrom', 'deadlineTo')}${range('发货时间', 'shippedFrom', 'shippedTo')}</div><div class="flex flex-wrap items-center justify-between gap-3"><div data-outbound-tabs>${statusTabs()}</div><div class="flex gap-2"><button type="button" class="h-9 rounded bg-blue-500 px-4 text-sm text-white" ${action('query')}>搜索</button><button type="button" class="h-9 rounded border px-4 text-sm" ${action('reset')}>清除</button></div></div><p hidden class="text-xs text-red-700" data-outbound-filter-error role="alert"></p></div>`
}
function rowsForPage() {
  const page = paginateStandardListRows(filterFinishedOutboundOrders(allOutboundRows(), state.filters, state.status), state.currentPage, preferences().pageSize)
  state.currentPage = page.currentPage
  return page
}
function tableHtml(): string {
  const prefs = preferences()
  const visibleKeys = state.status === '已打单' ? [...prefs.visibleKeys, 'selection'] : prefs.visibleKeys
  return renderStandardListTable({ columns: visibleColumns(), rows: rowsForPage().rows, preferences: { ...prefs, visibleKeys }, sort: null, eventPrefix: PREFIX, emptyText: '暂无数据', skipPageRerender: true })
}
function pagingHtml(): string {
  const page = rowsForPage()
  return `${renderTablePagination({ ...page, actionPrefix: PREFIX, fieldPrefix: PREFIX, pageSizeOptions: PAGE_SIZES, skipPageRerender: true })}<div class="flex items-center justify-end gap-2 px-3 pb-3 text-xs"><span>跳转到</span><input type="number" min="1" max="${page.totalPages}" class="h-8 w-16 rounded border px-2" aria-label="跳转页码" data-outbound-jump data-skip-page-rerender="true"><span>页</span><button type="button" class="h-8 rounded border px-3" ${action('jump')}>确定</button></div>`
}
function listActions(): string {
  return `<div class="flex flex-wrap items-center gap-2">${state.status === '已打单' ? `<label class="flex items-center gap-1 text-xs"><input type="checkbox" data-preserve-native-click="true" ${action('select-page')} aria-label="选择当前页" ${rowsForPage().rows.length && rowsForPage().rows.every(row => state.selected.has(row.id)) ? 'checked' : ''}>选择当前页</label><span class="text-xs">已选 ${state.selected.size} 单</span><button type="button" class="h-8 rounded bg-blue-500 px-3 text-xs text-white disabled:opacity-40" ${action('batch-outbound')} ${!state.selected.size || state.busy || state.readError || !state.loaded ? 'disabled' : ''}>批量出库</button>` : ''}<button type="button" class="h-8 rounded border px-3 text-xs" ${action('open-columns')}>列设置</button></div>`
}
function feedbackHtml(): string {
  if (state.saveError && !state.confirmation) return `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">${e(state.saveError)} <button type="button" class="underline" ${action('reload')}>重新读取</button></div>`
  return state.readError ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">${e(state.readError)} <button type="button" class="underline" ${action('reload')}>重新读取</button></div>` : state.loading || readScheduled ? '<p class="text-xs text-slate-500" role="status">正在读取已保存的出库单</p>' : ''
}
function detailOrder(): FinishedOutboundOrder | undefined {
  if (typeof window === 'undefined') return undefined
  const id = new URLSearchParams(window.location.search).get('id')
  return id ? allOutboundRows().find(row => row.id === id) : undefined
}
function detailPanel(row: FinishedOutboundOrder): string {
  if (state.detailTab === 'logs') return row.logs.length ? `<div class="space-y-2">${row.logs.map(log => `<div class="rounded border p-3 text-sm"><div>${e(log.at)} · ${e(log.action)} · ${e(log.operator)}</div><p class="mt-1 text-xs text-slate-500">${e(log.remark)}</p></div>`).join('')}</div>` : '<p class="p-6 text-center text-sm text-slate-500">暂无日志</p>'
  return `<div class="overflow-x-auto"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-slate-50"><tr>${['出库单号', 'SPU', 'SKU', '产品名称', '计划出库数量'].map(label => `<th class="border-b p-3 font-medium">${label}</th>`).join('')}</tr></thead><tbody>${row.products.map(product => `<tr><td class="p-3 text-xs">${e(row.outboundOrderNo)}</td><td class="p-3">${thumbnail(product)}<span class="text-xs">${e(product.spu)}</span></td><td class="p-3 text-xs">${e(product.sku)}</td><td class="p-3">—</td><td class="p-3">${product.quantity} 件</td></tr>`).join('')}</tbody></table></div>`
}
function detailHtml(): string {
  const row = detailOrder()
  if (!row) return `<section class="space-y-3 p-4"><h1 class="text-xl font-semibold">出库单详情</h1>${feedbackHtml()}<p>未找到该出库单</p><a href="${PATH}" data-nav="${PATH}" class="text-blue-700">返回出库单列表</a></section>`
  const info = [['出库单号', row.outboundOrderNo], ['拣货单号', row.pickOrderNo], ['关联单号', row.relatedOrderNo], ['平台单号', row.relatedOrderNo], ['跟踪单号', row.trackingNo], ['出库仓库', row.warehouse], ['出库类型', row.orderType], ['状态', row.status], ['收货单位', row.recipientName || '—'], ['出库人', row.operatorName || '—'], ['出库数量', `${outboundQuantity(row)} 件`], ['收货人', '—'], ['联系电话', '—'], ['收货地址', '—'], ['创建时间', row.createdAt], ['更新时间', row.updatedAt], ['取消时间', row.cancelledAt || '—'], ['面单下载', row.labelDownloadedAt || '—'], ['备注', row.remark]]
  return `<section class="space-y-4 p-4"><header class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold">出库单详情</h1><a href="${PATH}" data-nav="${PATH}" class="rounded border bg-white px-3 py-2 text-sm">返回出库单列表</a></header>${feedbackHtml()}${row.inventoryApplicationId ? `<a class="inline-block text-blue-700 underline" href="/wls/finished/inventory-quality?id=${encodeURIComponent(row.inventoryApplicationId)}" data-nav="/wls/finished/inventory-quality?id=${encodeURIComponent(row.inventoryApplicationId)}">查看关联成衣质检流转</a>` : ''}<section class="rounded-lg border bg-white p-4"><h2 class="mb-4 font-semibold">基础信息</h2><dl class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${info.map(([label, value]) => `<div class="min-w-0 text-sm"><dt class="mb-1 text-xs text-slate-500">${label}</dt><dd class="break-all">${label === '面单下载' && row.labelDownloadedAt ? `<button type="button" class="text-blue-700 underline" ${action('download-file')} ${rowData(row)}>下载面单</button><span class="ml-2 text-xs text-slate-500">${e(value)}</span>` : e(value || '—')}</dd></div>`).join('')}</dl></section><section class="overflow-hidden rounded-lg border bg-white"><div class="flex border-b" role="tablist" aria-label="出库单内容">${[['products', '订单产品'], ['logs', '订单日志']].map(([tab, text]) => `<button type="button" role="tab" aria-selected="${state.detailTab === tab}" class="border-b-2 px-5 py-3 text-sm ${state.detailTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent'}" ${action('detail-tab')} data-tab="${tab}">${text}</button>`).join('')}</div><div class="p-3" data-outbound-detail-panel role="tabpanel">${detailPanel(row)}</div></section></section>`
}
function overlayHtml(): string {
  if (state.showColumns) return renderStandardListColumnSettings({ title: '出库单列设置', columns: visibleColumns(), preferences: preferences(), eventPrefix: PREFIX, maxFrozenWidth: 400, skipPageRerender: true }).replace(/<input\s/g, '<input data-preserve-native-click="true" ')
  const confirmation = state.confirmation
  if (!confirmation) return ''
  const rows = confirmation.ids.map(id => allOutboundRows().find(row => row.id === id)).filter((row): row is FinishedOutboundOrder => Boolean(row))
  const cancel = confirmation.action === 'cancel-print'
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="${cancel ? '取消打单' : '批量出库'}"><button type="button" class="absolute inset-0 bg-black/45" aria-label="关闭确认" ${action('close-overlay')}></button><section class="relative w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><h2 class="mb-3 text-lg font-semibold">${cancel ? '取消打单' : '批量出库'}</h2><p class="mb-3 text-sm">${cancel ? '确认取消本单打单，出库单将标记为已取消，停止后续打印和出库。打印次数和操作记录保留。' : `确认将 ${rows.length} 张出库单、共 ${rows.reduce((sum, row) => sum + outboundQuantity(row), 0)} 件登记为已出库。`}</p><ul class="max-h-40 overflow-auto text-xs">${rows.map(row => `<li class="py-1">${e(row.outboundOrderNo)} · ${outboundQuantity(row)} 件</li>`).join('')}</ul>${state.saveError ? `<p class="mt-3 text-sm text-red-700" role="alert">${e(state.saveError)} <button type="button" class="underline" ${action('reload')}>重新读取</button></p>` : ''}<div class="mt-5 flex justify-end gap-2"><button type="button" class="rounded border px-4 py-2 text-sm" ${action('close-overlay')} ${state.busy ? 'disabled' : ''}>返回</button><button type="button" class="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40" ${action('confirm')} ${state.busy ? 'disabled' : ''}>${state.busy ? '正在保存' : state.saveError ? '重试保存' : cancel ? '确认取消打单' : '确认出库'}</button></div></section></div>`
}
function refreshOverlay(): void {
  const host = root()?.querySelector<HTMLElement>('[data-outbound-overlay]')
  if (host) { host.innerHTML = overlayHtml(); hydrateIcons(host) }
}
function refreshResults(): void {
  const host = root()
  if (!host) return
  const detail = host.querySelector<HTMLElement>('[data-outbound-content]')
  if (new URLSearchParams(window.location.search).has('id')) { if (detail) detail.innerHTML = detailHtml(); return }
  const table = host.querySelector<HTMLElement>('[data-standard-list-table-section] > .overflow-x-auto')
  if (table) table.innerHTML = tableHtml()
  const paging = host.querySelector<HTMLElement>('[data-standard-list-table-section] > .border-t')
  if (paging) paging.innerHTML = pagingHtml()
  const header = host.querySelector<HTMLElement>('[data-outbound-list-actions]')
  if (header) header.innerHTML = listActions()
  const tabs = host.querySelector<HTMLElement>('[data-outbound-tabs]')
  if (tabs) tabs.innerHTML = statusTabs()
  const feedback = host.querySelector<HTMLElement>('[data-outbound-feedback]')
  if (feedback) feedback.innerHTML = feedbackHtml()
  hydrateIcons(host.querySelector<HTMLElement>('[data-standard-list-table-section]') || host)
}
async function reload(): Promise<void> {
  if (state.loading) return
  state.loading = true
  try { state.rows = await loadFinishedOutboundOrders(); state.loaded = true; state.hasReadRecords = true; state.readError = ''; state.saveError = '' }
  catch { state.readError = `已保存的出库单读取失败，当前${state.hasReadRecords ? '保留上次读取结果' : '仅展示静态样本'}，无法保存操作。`; state.loaded = true }
  finally {
    state.loading = false
    const feedback = root()?.querySelector<HTMLElement>('[data-outbound-feedback]')
    if (state.readError && feedback) {
      // 读取失败未改变记录：保留已绘制的表格和图片，只更新错误及受阻动作。
      feedback.innerHTML = feedbackHtml()
      root()?.querySelectorAll<HTMLButtonElement>(`button[data-${PREFIX}-action]`).forEach(button => {
        if (['print', 'cancel-print', 'download-label', 'batch-outbound'].includes(button.dataset.wlsOutboundOrdersAction || '')) button.disabled = true
      })
    } else refreshResults()
  }
}
let keysBound = false
let readScheduled = false
function readAfterMount(): void {
  if (window.location.pathname !== PATH) { readScheduled = false; return }
  if (!root()) { requestAnimationFrame(readAfterMount); return }
  readScheduled = false
  void reload()
}
function renderListWorkspace(): string {
  return renderStandardListPage({ title: '出库单列表', filtersHtml: filtersHtml(), feedbackHtml: `<div data-outbound-feedback>${feedbackHtml()}</div>`, listTitle: '出库单列表', listActionsHtml: `<div data-outbound-list-actions>${listActions()}</div>`, tableHtml: tableHtml(), paginationHtml: pagingHtml() })
}
export function renderFinishedOutboundOrders(): string {
  if (!keysBound && typeof document !== 'undefined') {
    keysBound = true
    document.addEventListener('keydown', event => {
      if (!root()) return
      if (event.key === 'Escape' && !document.querySelector('[data-pda-image-preview-root]') && (state.confirmation || state.showColumns) && !state.busy) { state.confirmation = null; state.showColumns = false; state.saveError = ''; refreshOverlay(); state.focusReturn?.focus(); event.preventDefault() }
      if (event.key === 'Enter' && (event.target as HTMLElement)?.matches(`[data-${PREFIX}-field], [data-outbound-jump]`)) { event.preventDefault(); if ((event.target as HTMLElement).matches('[data-outbound-jump]')) jump(); else applyFilters() }
    })
  }
  const detail = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('id')
  if (!state.loaded && !state.loading && !readScheduled && typeof document !== 'undefined') { readScheduled = true; requestAnimationFrame(readAfterMount) }
  if (detail) return `<div data-${PREFIX}-root data-skip-page-rerender="true"><div data-outbound-content>${detailHtml()}</div><div data-outbound-overlay>${overlayHtml()}</div></div>`
  return `<div data-${PREFIX}-root data-skip-page-rerender="true"><div data-outbound-content>${renderListWorkspace()}</div><div data-outbound-overlay>${overlayHtml()}</div></div>`
}
function applyFilters(): void {
  root()?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-${PREFIX}-field]`).forEach(input => { const key = input.dataset.wlsOutboundOrdersField as keyof FinishedOutboundFilters; if (key in state.draft) state.draft[key] = input.value })
  const error = root()?.querySelector<HTMLElement>('[data-outbound-filter-error]')
  for (const [from, to] of [['createdFrom', 'createdTo'], ['deadlineFrom', 'deadlineTo'], ['shippedFrom', 'shippedTo']] as const) {
    const bound = (value: string, end: boolean) => { const text = value.trim().replace('T', ' '); return text.length === 10 ? `${text} ${end ? '23:59:59' : '00:00:00'}` : text.length === 16 ? `${text}:${end ? '59' : '00'}` : text }
    const valid = (value: string) => { if (!value.trim()) return true; const text = bound(value, false); if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return false; const parsed = new Date(`${text.replace(' ', 'T')}Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19).replace('T', ' ') === text }
    if (!valid(state.draft[from]) || !valid(state.draft[to]) || state.draft[from].trim() && state.draft[to].trim() && bound(state.draft[from], false) > bound(state.draft[to], true)) { if (error) { error.hidden = false; error.textContent = '时间格式为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm，开始时间不能晚于截止时间' }; return }
  }
  if (error) error.hidden = true
  state.filters = { ...state.draft }; state.currentPage = 1; state.selected.clear(); refreshResults()
}
function jump(): void {
  const value = Number(root()?.querySelector<HTMLInputElement>('[data-outbound-jump]')?.value)
  if (!Number.isInteger(value) || value < 1 || value > rowsForPage().totalPages) { showListFeedback('请输入有效页码', 'warning'); return }
  state.currentPage = value; state.selected.clear(); refreshResults()
}
function openConfirmation(actionName: FinishedOutboundAction, ids: string[], target: HTMLElement): void {
  if (!ids.length || state.readError || state.loading || !state.loaded) return
  state.focusReturn = target
  state.confirmation = { action: actionName, ids, operationId: crypto.randomUUID(), versions: Object.fromEntries(ids.map(id => [id, allOutboundRows().find(row => row.id === id)?.version ?? -1])) }
  state.saveError = ''; refreshOverlay(); root()?.querySelector<HTMLButtonElement>(`[data-${PREFIX}-action="confirm"]`)?.focus()
}
function download(orders: FinishedOutboundOrder[]): void {
  const url = URL.createObjectURL(new Blob([createOutboundWaybillPdf(orders) as BlobPart], { type: 'application/pdf' }))
  const link = document.createElement('a'); link.href = url; link.download = orders.length === 1 ? `${orders[0].outboundOrderNo}-演示面单.pdf` : '出库单-批量演示面单.pdf'; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
async function perform(actionName: FinishedOutboundAction, ids: string[], printWindow?: Window | null): Promise<void> {
  if (state.busy || state.readError || !state.loaded) { printWindow?.close(); return }
  const confirmation = state.confirmation
  const versions = confirmation?.versions ?? Object.fromEntries(ids.map(id => [id, allOutboundRows().find(row => row.id === id)?.version ?? -1]))
  state.busy = true; state.saveError = ''; refreshOverlay()
  try {
    state.rows = await saveFinishedOutboundAction(ids, versions, actionName, confirmation?.operationId || crypto.randomUUID())
    const orders = ids.map(id => allOutboundRows().find(row => row.id === id)).filter((row): row is FinishedOutboundOrder => Boolean(row))
    if (actionName === 'download-label') download(orders)
    if (actionName === 'print' && printWindow) {
      const url = URL.createObjectURL(new Blob([createOutboundWaybillPdf(orders) as BlobPart], { type: 'application/pdf' })); printWindow.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
    state.confirmation = null; state.selected.clear(); refreshResults(); showListFeedback(actionName === 'print' ? '已生成演示面单，打印登记已保存' : actionName === 'download-label' ? '演示面单已生成，下载记录已保存' : actionName === 'cancel-print' ? '出库单已取消' : '已登记出库')
  } catch (error) {
    printWindow?.close()
    state.saveError = `未保存：${error instanceof Error ? error.message : '保存失败，请重试'}`
    if (!state.confirmation) showListFeedback(state.saveError, 'warning')
  } finally { state.busy = false; refreshResults(); refreshOverlay() }
}
export function handleFinishedOutboundOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (handleFinishedInventoryQualityEvent(target, event)) return true
  if (!root()) return false
  if (event?.type === 'drop' || event?.type.startsWith('drag')) {
    const drag = event as DragEvent & { higoodStandardListColumnKey?: string }
    if (event.type === 'drop') {
      const from = drag.higoodStandardListColumnKey || ''
      const to = target.closest<HTMLElement>('[data-standard-list-column-key]')?.dataset.standardListColumnKey || ''
      if (from && to && from !== to && from !== 'actions' && to !== 'actions' && from !== 'selection' && to !== 'selection') { const order = preferences().order.filter(key => key !== from); order.splice(order.indexOf(to), 0, from); preferences().order = order; persistPreferences(); refreshResults(); refreshOverlay() }
    }
    return true
  }
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${PREFIX}-field]`)
  if (fieldNode) {
    if (event?.type === 'click') return true
    const key = fieldNode.dataset.wlsOutboundOrdersField || ''
    if (key === 'pageSize' && event?.type === 'change') { preferences().pageSize = Number(fieldNode.value); state.currentPage = 1; state.selected.clear(); persistPreferences(); refreshResults(); return true }
    if (key in state.draft) state.draft[key as keyof FinishedOutboundFilters] = fieldNode.value
    return true
  }
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`)
  const name = node?.dataset.wlsOutboundOrdersAction
  if (!node || !name) return false
  if (event?.type !== 'click' && !(event?.type === 'change' && name.startsWith('toggle-column'))) return true
  if (name.startsWith('toggle-column') && event?.type === 'click') return true
  if (name !== 'select-row' && name !== 'select-page') event?.preventDefault()
  if (name === 'query') { applyFilters(); return true }
  if (name === 'reset') { state.draft = emptyFinishedOutboundFilters(); state.filters = emptyFinishedOutboundFilters(); state.status = ''; state.currentPage = 1; state.selected.clear(); const host = root()?.querySelector<HTMLElement>('[data-standard-list-filters]'); if (host) host.innerHTML = filtersHtml(); refreshResults(); return true }
  if (name === 'status') { state.status = node.dataset.status || ''; state.currentPage = 1; state.selected.clear(); applyFilters(); return true }
  if (name === 'prev-page' || name === 'next-page') { state.currentPage += name === 'next-page' ? 1 : -1; state.selected.clear(); refreshResults(); return true }
  if (name === 'jump') { jump(); return true }
  if (name === 'reload') { state.confirmation = null; state.selected.clear(); refreshOverlay(); void reload(); return true }
  if (name === 'copy') { void navigator.clipboard.writeText(node.dataset.copyValue || '').then(() => showListFeedback('已复制'), () => showListFeedback('复制失败，请手动选择单号复制', 'warning')); return true }
  if (name === 'detail-tab') { state.detailTab = node.dataset.tab || 'products'; const row = detailOrder(); const panel = root()?.querySelector<HTMLElement>('[data-outbound-detail-panel]'); if (row && panel) panel.innerHTML = detailPanel(row); root()?.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab => { const active = tab.dataset.tab === state.detailTab; tab.setAttribute('aria-selected', String(active)); tab.classList.toggle('border-blue-500', active); tab.classList.toggle('text-blue-600', active) }); return true }
  if (name === 'open-columns') { state.showColumns = true; state.focusReturn = node; refreshOverlay(); return true }
  if (name === 'close-column-settings' || name === 'close-overlay') { if (state.busy) return true; state.showColumns = false; state.confirmation = null; state.saveError = ''; refreshOverlay(); state.focusReturn?.focus(); return true }
  if (name === 'restore-column-settings') { state.preferences = defaults(); persistPreferences(); refreshResults(); refreshOverlay(); return true }
  if (name.startsWith('toggle-column')) { const key = node.dataset.wlsOutboundOrdersColumnKey || ''; const column = columns.find(column => column.key === key); if (!column || column.actionColumn || column.leadingControlColumn || name === 'toggle-column-visibility' && column.required) return true; const prop = name === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'; if (prop === 'frozenKeys' && !column.freezeable) return true; const value = preferences()[prop]; preferences()[prop] = value.includes(key) ? value.filter(item => item !== key) : [...value, key]; persistPreferences(); refreshResults(); refreshOverlay(); return true }
  if (name === 'select-row' || name === 'select-page') { const ids = name === 'select-page' ? rowsForPage().rows.map(row => row.id) : [node.dataset.orderId || '']; ids.forEach(id => { if ((node as HTMLInputElement).checked) state.selected.add(id); else state.selected.delete(id) }); const header = root()?.querySelector<HTMLElement>('[data-outbound-list-actions]'); if (header) header.innerHTML = listActions(); if (name === 'select-page') refreshResults(); return true }
  if (name === 'cancel-print' || name === 'batch-outbound') { openConfirmation(name === 'cancel-print' ? 'cancel-print' : 'outbound', name === 'cancel-print' ? [node.dataset.orderId || ''] : [...state.selected], node); return true }
  if (name === 'confirm' && state.confirmation) { void perform(state.confirmation.action, state.confirmation.ids); return true }
  if (name === 'view-label' || name === 'download-file') { const row = state.rows.find(row => row.id === node.dataset.orderId); if (!row?.labelDownloadedAt) return true; if (name === 'download-file') download([row]); else { const url = URL.createObjectURL(new Blob([createOutboundWaybillPdf([row]) as BlobPart], { type: 'application/pdf' })); const popup = window.open(url, '_blank'); if (!popup) showListFeedback('请允许打开演示面单窗口', 'warning'); window.setTimeout(() => URL.revokeObjectURL(url), 60000) }; return true }
  if (name === 'download-label') { void perform('download-label', [node.dataset.orderId || '']); return true }
  if (name === 'print') { const popup = window.open('', '_blank'); if (!popup) { showListFeedback('请允许打开演示面单窗口', 'warning'); return true }; void perform('print', [node.dataset.orderId || ''], popup); return true }
  return false
}
