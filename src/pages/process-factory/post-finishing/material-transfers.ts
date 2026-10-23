// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { listPostFinishingMaterialTransferOrders, getPostFinishingMaterialTransferOrder, type PostFinishingMaterialTransferOrder } from '../../../data/fcs/post-finishing-full-flow.ts'
import { prepareAccessoryPostFinishing, isManagedAccessoryPostTransfer, receiveAccessoryPostTransfer, listAccessoryPostLocations } from '../../../data/wls/accessory-warehouse-post-finishing.ts'
import {
  createManualAccessoryPostTransfer,
  listManualTransferMaterialCatalog,
  listManualTransferProductionOrderOptions,
  readManualTransferProductionPreview,
  type ManualTransferMaterialRow,
  type ManualTransferProductionPreview,
  type ManualTransferSource,
} from '../../../data/wls/accessory-warehouse-manual-transfer.ts'
import { accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from '../../wls/accessory-warehouses/shared.ts'
import { escapeHtml } from '../../../utils.ts'
const path = '/fcs/craft/post-finishing/material-transfers', prefix = 'post-finishing-material-transfers'
let selectedId = '', dirty = false, busy = false, message = '', error = '', mountedPath = ''
let drafts = new Map<string, string>()
let pending: Parameters<typeof receiveAccessoryPostTransfer>[0] | null = null
let logId = ''
let createOpen = false, createMode: ManualTransferSource = 'PRODUCTION_ORDER'
let createOrderNo = '', createPreview: ManualTransferProductionPreview | null = null
let createProductionQty = new Map<string, string>()
let createGeneralQuery = '', createGeneralSelected = new Map<string, ManualTransferMaterialRow>(), createGeneralQty = new Map<string, string>()
let createActor = '后道计划员', createError = '', createBusy = false, createDirty = false, createCommandId = '', createAt = ''
let generalCatalog: ManualTransferMaterialRow[] | null = null
const root = () => document.querySelector<HTMLElement>('[data-post-material-root]')
const query = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
const qty = (value: number, unit: string) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`
const button = (label: string, action: string, id = '', disabled = false, primary = false) => `<button type="button" class="${primary ? 'rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50' : 'rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50'}" data-${prefix}-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
const actionButton = (label: string, action: string, attributes = '', disabled = false, primary = false) => `<button type="button" class="${primary ? 'rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50' : 'rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50'}" data-${prefix}-action="${escapeHtml(action)}" ${attributes} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
function updateUrl(values: Record<string, string | null>): void { const params = query(); for (const [key, value] of Object.entries(values)) value === null ? params.delete(key) : params.set(key, value); window.history.pushState(null, '', `${path}${params.size ? `?${params}` : ''}`); mountedPath = window.location.pathname + window.location.search }
function totals(record: PostFinishingMaterialTransferOrder): string { return [...new Set(record.lines.map(line => line.unit))].map(unit => qty(record.lines.filter(line => line.unit === unit).reduce((sum, line) => sum + line.preparedQty, 0), unit)).join('<br>') }
function code(value: string): string { return /-bom-|prep-line-|::/.test(value) ? '' : value }
function creationModeLabel(record: PostFinishingMaterialTransferOrder): string { return record.creationMode === 'MANUAL' ? '人工创建' : '系统自动创建' }
function creationModeBadge(record: PostFinishingMaterialTransferOrder): string { const manual = record.creationMode === 'MANUAL'; return `<span class="whitespace-nowrap rounded border px-2 py-1 text-xs ${manual ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}">${creationModeLabel(record)}</span>` }
function materialCell(record: PostFinishingMaterialTransferOrder): string {
  if (!record.lines.length) return '<span class="text-muted-foreground">暂无物料</span>'
  return `<div class="space-y-2">${record.lines.map(line => `<div class="flex items-start gap-2" data-post-material-list-line="${escapeHtml(line.transferLineId)}">${accessoryImage(line.imageUrl, line.materialName)}<div class="min-w-0"><div class="text-sm font-medium">${escapeHtml(line.materialName)}</div><div class="mt-0.5 break-all font-mono text-xs text-muted-foreground">${escapeHtml(code(line.materialCode) || '物料编码待核对')}</div><div class="mt-0.5 text-xs">${qty(line.preparedQty, line.unit)}</div></div></div>`).join('')}</div>`
}
function styleCell(record: PostFinishingMaterialTransferOrder): string {
  if (record.manualSource === 'GENERAL') return `<div class="flex items-center gap-3"><span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-slate-50 text-xs text-slate-600">通用</span><div><strong>通用物料调拨</strong><p class="mt-1 text-xs text-muted-foreground">不关联生产单</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.responsibility.responsibilityLabel)}</p></div></div>`
  return `<div class="flex items-center gap-3">${record.styleImageUrl ? accessoryImage(record.styleImageUrl, record.styleName) : ''}<div><strong>${escapeHtml(record.styleName)}</strong><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.responsibility.responsibilityLabel)}</p></div></div>`
}
const columns: StandardListColumn<PostFinishingMaterialTransferOrder>[] = [
  { key: 'order', title: '调拨单', width: 220, required: true, freezeable: true, render: row => `<strong>${escapeHtml(row.transferOrderNo)}</strong><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)}</p>` },
  { key: 'creationMode', title: '创建方式', width: 130, render: creationModeBadge },
  { key: 'materials', title: '物料', width: 280, required: true, render: materialCell },
  { key: 'style', title: '款式', width: 220, required: true, render: styleCell },
  { key: 'route', title: '来源 → 去向', width: 200, render: row => `<p>${escapeHtml(row.sourceWarehouseName)} → ${escapeHtml(row.targetWarehouseName)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.targetLocationCode)}</p>` },
  { key: 'quantity', title: '整单数量', width: 120, render: totals },
  { key: 'status', title: '当前状态', width: 90, render: row => `<strong>${escapeHtml(row.status)}</strong>` },
  { key: 'actions', title: '操作', width: 250, required: true, actionColumn: true, render: row => `<div class="flex flex-wrap justify-end gap-2">${button(isManagedAccessoryPostTransfer(row.transferOrderId) && row.status === '待入库' ? '查看并收货上架' : '查看详情', 'detail', row.transferOrderId)}${button('查看日志', 'log', row.transferOrderId)}</div>` },
]
function renderList(): string {
  const params = query(), keyword = (params.get('keyword') || '').trim().toLowerCase(), status = params.get('status') || '', source = params.get('sourceWarehouse') || '', createdFrom = params.get('createdFrom') || '', createdTo = params.get('createdTo') || ''
  const all = listPostFinishingMaterialTransferOrders(), rows = all.filter(row => (!keyword || [row.transferOrderNo, row.productionOrderNo, row.styleName, ...row.lines.flatMap(line => [line.materialName, line.materialCode])].join(' ').toLowerCase().includes(keyword)) && (!status || row.status === status) && (!source || row.sourceWarehouseName === source) && (!createdFrom || row.createdAt.slice(0, 10) >= createdFrom) && (!createdTo || row.createdAt.slice(0, 10) <= createdTo))
  const requested = Number(params.get('pageSize') || 10), pageSize = [10, 20, 50].includes(requested) ? requested : 10, page = paginateStandardListRows(rows, Number(params.get('page') || 1), pageSize)
  return renderStandardListPage({
    title: '后道辅料调拨单', primaryActionsHtml: button('新增辅料调拨单', 'create', '', false, true), feedbackHtml: `${message ? `<p role="status" class="rounded bg-green-50 p-3 text-sm">${escapeHtml(message)}</p>` : ''}`,
    filtersHtml: `<form data-post-material-query class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3"><label class="grid gap-1 text-sm">调拨单 / 生产单 / 款式 / 物料<input name="keyword" value="${escapeHtml(params.get('keyword') || '')}" class="h-9 rounded border px-3"></label><label class="grid gap-1 text-sm">来源仓<select name="sourceWarehouse" class="h-9 rounded border px-3"><option value="">全部</option>${[...new Set(all.map(row => row.sourceWarehouseName))].map(value => `<option ${source === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="grid gap-1 text-sm">当前状态<select name="status" class="h-9 rounded border px-3"><option value="">全部</option>${['申请调拨', '待调拨', '待入库', '已入库'].map(value => `<option ${status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="grid gap-1 text-sm">创建开始<input class="h-9 rounded border px-3" name="createdFrom" type="date" value="${escapeHtml(createdFrom)}"></label><label class="grid gap-1 text-sm">创建结束<input class="h-9 rounded border px-3" name="createdTo" type="date" value="${escapeHtml(createdTo)}"></label><div class="flex items-end justify-end gap-2">${button('查询', 'query')}${button('重置', 'reset')}</div></form>`,
    statsHtml: renderStandardListStats([{ label: '筛选调拨单', value: rows.length }, { label: '待调拨', value: rows.filter(row => ['申请调拨', '待调拨'].includes(row.status)).length }, { label: '待入库', value: rows.filter(row => row.status === '待入库').length }, { label: '已入库', value: rows.filter(row => row.status === '已入库').length }]),
    listTitle: '调拨单列表', tableHtml: renderStandardListTable({ columns, rows: page.rows, preferences: { order: columns.map(row => row.key), visibleKeys: columns.map(row => row.key), frozenKeys: ['order'], pageSize }, sort: null, eventPrefix: prefix }), paginationHtml: renderTablePagination({ ...page, actionPrefix: prefix, pageSizeOptions: [10, 20, 50], skipPageRerender: true }),
  })
}
function detailIdentity(record: PostFinishingMaterialTransferOrder): string {
  if (record.manualSource === 'GENERAL') return `<div class="flex items-center gap-3"><span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-slate-50 text-xs text-slate-600">通用</span><div><strong>通用物料调拨</strong><p>不关联生产单</p><p class="mt-1 text-sm">${escapeHtml(record.sourceWarehouseName)} → ${escapeHtml(record.targetWarehouseName)} · ${escapeHtml(record.status)}</p></div></div>`
  return `<div class="flex items-center gap-3">${record.styleImageUrl ? accessoryImage(record.styleImageUrl, record.styleName) : ''}<div><strong>${escapeHtml(record.productionOrderNo)}</strong><p>${escapeHtml(record.styleName)}</p><p class="mt-1 text-sm">${escapeHtml(record.sourceWarehouseName)} → ${escapeHtml(record.targetWarehouseName)} · ${escapeHtml(record.status)}</p></div></div>`
}
function renderDetail(): string {
  const record = getPostFinishingMaterialTransferOrder(selectedId)
  if (!record) return ''
  const managed = isManagedAccessoryPostTransfer(record.transferOrderId), receive = managed && record.status === '待入库'
  const columns: StandardListColumn<PostFinishingMaterialTransferOrder['lines'][number]>[] = [
    { key: 'material', title: '物料', width: 270, required: true, render: line => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div><strong>${escapeHtml(line.materialName)}</strong><p class="text-xs text-muted-foreground">${escapeHtml(code(line.materialCode) || '物料编码待核对')}</p><p class="text-xs text-muted-foreground">${escapeHtml(line.specification)}</p></div></div>` },
    { key: 'expected', title: '应收', width: 120, render: line => qty(line.preparedQty, line.unit) },
    { key: 'received', title: '实收数量', width: 160, render: line => receive ? `<label class="flex items-center gap-2"><input aria-label="${escapeHtml(line.materialName)}实收数量" class="h-10 w-24 rounded border px-2" inputmode="decimal" data-post-material-qty="${escapeHtml(line.transferLineId)}" value="${escapeHtml(drafts.get(`qty:${line.transferLineId}`) || '')}">${escapeHtml(line.unit)}</label>` : record.status === '已入库' ? qty(line.preparedQty, line.unit) : '尚未入库' },
  ]
  if (receive) columns.push({ key: 'location', title: '上架库位', width: 180, render: line => `<select class="h-10 rounded border px-2" aria-label="${escapeHtml(line.materialName)}上架库位" data-post-material-location="${escapeHtml(line.transferLineId)}"><option value="">选择后道库位</option>${listAccessoryPostLocations().map(location => `<option value="${location.id}" ${drafts.get(`location:${line.transferLineId}`) === location.id ? 'selected' : ''}>${escapeHtml(location.locationCode)}</option>`).join('')}</select>` })
  return accessoryOverlay('后道辅料调拨单详情', `<div class="space-y-4">${detailIdentity(record)}${receive ? '<p class="rounded bg-blue-50 p-3 text-sm">逐行登记实际收到的辅料和后道库位，整单一致后一次收货上架。</p>' : ''}<div class="overflow-x-auto">${renderStandardListTable({ columns, rows: record.lines, preferences: { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: record.lines.length }, sort: null, eventPrefix: prefix })}</div>${receive ? `<div class="flex flex-wrap gap-3"><label class="grid gap-1 text-sm">后道仓管<input class="h-10 rounded border px-3" data-post-material-actor value="${escapeHtml(drafts.get('actor') || 'DLN 仓管')}"></label></div>` : ''}<p role="alert" class="whitespace-pre-wrap text-sm text-red-600" data-post-material-error>${escapeHtml(error)}</p><p class="text-xs text-muted-foreground">操作日志请从列表“查看日志”打开。</p></div>`, receive ? button(busy ? '正在保存…' : '确认收货并上架', 'receive', record.transferOrderId, busy, true) : '', 'post-material-close')
}
function renderLogModal(record: PostFinishingMaterialTransferOrder): string {
  const entries = record.statusHistory.map((item, index) => ({ item, index })).sort((left, right) => right.item.operatedAt.localeCompare(left.item.operatedAt) || right.index - left.index)
  const body = `<div class="space-y-4"><div class="rounded-lg border bg-slate-50 p-3 text-sm"><div class="font-mono font-semibold">${escapeHtml(record.transferOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.styleName)} · ${escapeHtml(creationModeLabel(record))}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.sourceWarehouseName)} → ${escapeHtml(record.targetWarehouseName)}</div></div>${entries.length ? `<ol class="relative ml-3 border-l border-slate-200">${entries.map(({ item }) => `<li class="relative mb-4 ml-5" data-post-material-log-entry><span class="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600"></span><div class="flex flex-wrap items-center gap-2"><strong>${escapeHtml(item.action || item.status)}</strong><span class="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(item.status)}</span><time class="text-xs text-muted-foreground">${escapeHtml(new Date(item.operatedAt).toLocaleString('zh-CN'))}</time></div><p class="mt-1 text-sm">${escapeHtml(item.remark)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.operatorName)}</p></li>`).join('')}</ol>` : '<p class="text-sm text-muted-foreground">暂无操作记录。</p>'}</div>`
  return accessoryOverlay('操作日志', body, '', 'post-material-close-log')
}
function refreshList(): void { const host = root()?.querySelector('[data-post-material-workspace]'); if (host) host.innerHTML = renderList() }
function refreshDetail(): void { const host = root()?.querySelector('[data-post-material-detail]'); if (host) host.innerHTML = renderDetail() }
function refreshCreateHost(): void { const host = root()?.querySelector('[data-post-material-create]'); if (host) host.innerHTML = createOpen ? renderCreateModal() : '' }
function refreshLogHost(): void { const host = root()?.querySelector('[data-post-material-log]'); if (host) { const record = logId ? getPostFinishingMaterialTransferOrder(logId) : undefined; host.innerHTML = record ? renderLogModal(record) : '' } }
function closeDetail(): void { if (busy || (dirty && !window.confirm('实收和上架输入尚未保存。关闭将丢弃输入，是否关闭？'))) return; selectedId = ''; dirty = false; drafts.clear(); pending = null; error = ''; updateUrl({ transferId: null }); root()?.querySelector('[data-post-material-detail]')?.replaceChildren(); restoreAccessoryFocus() }
function closeLog(): void { if (!root()?.querySelector('[data-post-material-log]')?.childElementCount) return; logId = ''; root()?.querySelector('[data-post-material-log]')?.replaceChildren(); restoreAccessoryFocus() }
function resetCreatePending(): void { createCommandId = ''; createAt = ''; clearCreateError() }
function clearCreateError(): void { createError = ''; const host = root()?.querySelector<HTMLElement>('[data-post-material-create-error]'); if (host) host.textContent = '' }
function resetCreateState(): void { createOpen = false; createMode = 'PRODUCTION_ORDER'; createOrderNo = ''; createPreview = null; createProductionQty.clear(); createGeneralQuery = ''; createGeneralSelected.clear(); createGeneralQty.clear(); createActor = '后道计划员'; createError = ''; createBusy = false; createDirty = false; createCommandId = ''; createAt = '' }
function openCreate(): void { if (busy) return; resetCreateState(); createOpen = true; refreshCreateHost(); focusAccessoryOverlay(); requestAnimationFrame(() => root()?.querySelector<HTMLInputElement>('[data-post-material-create-order]')?.focus()) }
function closeCreate(): void { if (createBusy) return; if (createDirty && !window.confirm('调拨单内容尚未提交。关闭将丢弃输入，是否关闭？')) return; resetCreateState(); refreshCreateHost(); restoreAccessoryFocus() }
function openLog(id: string): void { const record = getPostFinishingMaterialTransferOrder(id); if (!record) return; logId = id; refreshLogHost(); focusAccessoryOverlay() }
function showError(value: unknown): void { error = value instanceof Error ? value.message : String(value); const host = root()?.querySelector('[data-post-material-error]'); if (host) host.textContent = error; else { message = error; refreshList() } }
function generalMaterials(): ManualTransferMaterialRow[] { generalCatalog ||= listManualTransferMaterialCatalog(); return generalCatalog }
function renderGeneralResults(): string {
  const catalog = generalMaterials(), term = createGeneralQuery.trim().toLowerCase()
  if (!term) return `<p class="rounded border border-dashed p-3 text-sm text-muted-foreground">输入物料名称、编码或规格搜索；当前可调拨 ${catalog.length} 种辅料。</p>`
  const matches = catalog.filter(row => [row.materialName, row.materialSku, row.materialSpec, row.sourceProductionOrderNo].join(' ').toLowerCase().includes(term)).slice(0, 20)
  if (!matches.length) return '<p class="rounded border border-dashed p-3 text-sm text-muted-foreground">没有匹配的可调拨物料。</p>'
  return `<div class="max-h-72 space-y-2 overflow-y-auto">${matches.map(row => { const selected = createGeneralSelected.has(row.key); return `<div class="flex items-center justify-between gap-3 rounded border p-2" data-post-material-general-result="${escapeHtml(row.key)}"><div class="flex min-w-0 items-center gap-2">${accessoryImage(row.imageUrl, row.materialName)}<div class="min-w-0"><div class="text-sm font-medium">${escapeHtml(row.materialName)}</div><div class="break-all font-mono text-xs text-muted-foreground">${escapeHtml(row.materialSku)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.materialSpec || '规格待核对')} · ${escapeHtml(row.unit)}</div></div></div>${actionButton(selected ? '已添加' : '添加', 'create-add', `data-key="${escapeHtml(row.key)}"`, selected)}</div>` }).join('')}</div>`
}
function refreshGeneralResults(): void { const host = root()?.querySelector('[data-post-material-general-results]'); if (host) host.innerHTML = renderGeneralResults() }
function createProductionSection(): string {
  const options = listManualTransferProductionOrderOptions()
  return `<div class="space-y-3"><label class="grid gap-1 text-sm">生产单号<input class="h-10 rounded border px-3 font-mono" list="post-material-production-orders" data-post-material-create-order value="${escapeHtml(createOrderNo)}" placeholder="输入完整生产单号"><datalist id="post-material-production-orders">${options.map(option => `<option value="${escapeHtml(option.productionOrderNo)}">${escapeHtml(option.styleName)} · ${escapeHtml(option.techPackVersionLabel)}</option>`).join('')}</datalist></label><div class="flex items-center gap-2">${button('读取 BOM', 'create-load-order')}<span class="text-xs text-muted-foreground">按技术包版本读取 BOM；只保留可后道调拨的辅料。</span></div>${createPreview ? `<section class="rounded-lg border bg-slate-50 p-3" data-post-material-create-preview="${escapeHtml(createPreview.productionOrderNo)}"><div class="flex flex-wrap items-center justify-between gap-2 text-sm"><div><strong>${escapeHtml(createPreview.productionOrderNo)}</strong> · ${escapeHtml(createPreview.styleName)}</div><div class="text-xs text-muted-foreground">技术包 ${escapeHtml(createPreview.techPackVersionLabel)}</div></div>${createPreview.excludedCount ? `<p class="mt-1 text-xs text-muted-foreground">已排除 ${createPreview.excludedCount} 项：${escapeHtml(createPreview.excludedSummary)}</p>` : ''}<div class="mt-3 overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="border-b text-xs text-muted-foreground"><th class="p-2">物料</th><th class="p-2">编码</th><th class="p-2">规格</th><th class="p-2">单位</th><th class="p-2">调拨数量</th></tr></thead><tbody>${createPreview.rows.map(row => `<tr class="border-b last:border-b-0" data-post-material-bom-row="${escapeHtml(row.key)}"><td class="p-2"><div class="flex items-center gap-2">${accessoryImage(row.imageUrl, row.materialName)}<div><div class="font-medium">${escapeHtml(row.materialName)}</div>${row.imageMissing ? '<div class="text-xs text-red-600">缺物料图，不能创建</div>' : ''}</div></div></td><td class="p-2 break-all font-mono text-xs">${escapeHtml(row.materialSku)}</td><td class="p-2 text-xs">${escapeHtml(row.materialSpec || '—')}</td><td class="p-2">${escapeHtml(row.unit)}</td><td class="p-2"><input type="number" min="0" step="any" class="h-9 w-28 rounded border px-2" aria-label="${escapeHtml(row.materialName)}调拨数量" data-post-material-create-bom-qty="${escapeHtml(row.key)}" value="${escapeHtml(createProductionQty.get(row.key) || '')}" ${row.imageMissing ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table></div></section>` : '<p class="rounded border border-dashed p-3 text-sm text-muted-foreground">输入生产单号后点击“读取 BOM”，再填写要调拨的数量。</p>'}</div>`
}
function createGeneralSection(): string {
  const selected = [...createGeneralSelected.values()]
  return `<div class="space-y-3"><label class="grid gap-1 text-sm">搜索物料<input class="h-10 rounded border px-3" data-post-material-create-search value="${escapeHtml(createGeneralQuery)}" placeholder="输入物料名称、编码或规格"></label><div data-post-material-general-results>${renderGeneralResults()}</div><section class="space-y-2"><div class="flex items-center justify-between"><h3 class="font-semibold">已添加物料</h3><span class="text-xs text-muted-foreground">每个物料只能一行</span></div>${selected.length ? `<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="border-b text-xs text-muted-foreground"><th class="p-2">物料</th><th class="p-2">编码</th><th class="p-2">单位</th><th class="p-2">调拨数量</th><th class="p-2">操作</th></tr></thead><tbody>${selected.map(row => `<tr class="border-b last:border-b-0" data-post-material-general-row="${escapeHtml(row.key)}"><td class="p-2"><div class="flex items-center gap-2">${accessoryImage(row.imageUrl, row.materialName)}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.materialSpec || '规格待核对')}</div></div></div></td><td class="p-2 break-all font-mono text-xs">${escapeHtml(row.materialSku)}</td><td class="p-2">${escapeHtml(row.unit)}</td><td class="p-2"><input type="number" min="0" step="any" class="h-9 w-28 rounded border px-2" aria-label="${escapeHtml(row.materialName)}调拨数量" data-post-material-create-general-qty="${escapeHtml(row.key)}" value="${escapeHtml(createGeneralQty.get(row.key) || '')}"></td><td class="p-2">${actionButton('移除', 'create-remove', `data-key="${escapeHtml(row.key)}"`)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="rounded border border-dashed p-3 text-sm text-muted-foreground">尚未添加物料；从上方搜索结果中添加。</p>'}</section></div>`
}
function renderCreateModal(): string {
  const modeButton = (mode: ManualTransferSource, label: string) => `<button type="button" class="rounded px-3 py-2 text-sm ${createMode === mode ? 'bg-blue-600 font-medium text-white' : 'border hover:bg-muted'}" data-${prefix}-action="create-mode" data-mode="${mode}">${escapeHtml(label)}</button>`
  const body = `<fieldset class="space-y-4" ${createBusy ? 'disabled' : ''}><div class="flex flex-wrap items-end justify-between gap-3"><div class="flex flex-wrap gap-2" role="group" aria-label="调拨创建方式">${modeButton('PRODUCTION_ORDER', '按生产单')} ${modeButton('GENERAL', '不按生产单（通用物料）')}</div><label class="grid w-56 gap-1 text-sm">创建人<input class="h-10 rounded border px-3" data-post-material-create-actor value="${escapeHtml(createActor)}"></label></div><p role="alert" class="whitespace-pre-wrap text-sm text-red-600" data-post-material-create-error>${escapeHtml(createError)}</p><p class="rounded bg-blue-50 p-3 text-sm">提交后先在辅料中央仓创建调拨单并自动审核通过；中央仓保存失败时，后道列表不会生成记录。</p>${createMode === 'PRODUCTION_ORDER' ? createProductionSection() : createGeneralSection()}</fieldset>`
  return accessoryOverlay('新增辅料调拨单', body, `${button('取消', 'create-cancel', '', createBusy)}${button(createBusy ? '正在同步辅料中央仓…' : '确认创建', 'create-submit', '', createBusy, true)}`, 'post-material-close-create')
}
function collectCreateLines(): Array<{ materialKey: string; qty: number }> {
  if (createMode === 'PRODUCTION_ORDER') {
    if (!createPreview) throw new Error('请先读取生产单 BOM。')
    return createPreview.rows.flatMap(row => {
      const raw = (createProductionQty.get(row.key) || '').trim()
      if (!raw) return []
      if (row.imageMissing) throw new Error(`${row.materialName}缺少对应物料图，不能创建调拨单。`)
      const value = Number(raw)
      if (!Number.isFinite(value) || value <= 0) throw new Error(`${row.materialName}调拨数量必须是大于 0 的有效数量。`)
      return [{ materialKey: row.key, qty: value }]
    })
  }
  if (!createGeneralSelected.size) return []
  return [...createGeneralSelected.values()].map(row => {
    const raw = (createGeneralQty.get(row.key) || '').trim()
    const value = Number(raw)
    if (!raw || !Number.isFinite(value) || value <= 0) throw new Error(`${row.materialName}调拨数量必须是大于 0 的有效数量。`)
    return { materialKey: row.key, qty: value }
  })
}
async function submitCreate(): Promise<void> {
  if (createBusy) return
  try {
    const lines = collectCreateLines()
    if (!lines.length) throw new Error('至少填写一项要调拨的物料数量。')
    if (!createActor.trim()) throw new Error('请填写创建人。')
    createCommandId ||= crypto.randomUUID(); createAt ||= new Date().toISOString(); createBusy = true; createError = ''; refreshCreateHost()
    await createManualAccessoryPostTransfer({ source: createMode, productionOrderNo: createMode === 'PRODUCTION_ORDER' ? createPreview!.productionOrderNo : undefined, actorName: createActor.trim(), lines, commandId: createCommandId, at: createAt })
    createBusy = false; createDirty = false; message = '辅料中央仓已创建调拨单并自动审核通过，列表已更新。'; resetCreateState(); refreshCreateHost(); restoreAccessoryFocus(); refreshList()
  } catch (value) { createBusy = false; createError = value instanceof Error ? value.message : String(value); refreshCreateHost() }
}
async function receive(): Promise<void> {
  if (busy) return
  try {
    const record = getPostFinishingMaterialTransferOrder(selectedId)
    if (!record || !isManagedAccessoryPostTransfer(record.transferOrderId)) throw new Error('当前调拨单不属于本仓辅料收货范围，请重新读取。')
    pending ||= { id: record.transferOrderId, actor: { warehouseCode: 'DLN', role: '仓管', name: drafts.has('actor') ? drafts.get('actor')!.trim() : 'DLN 仓管' }, commandId: crypto.randomUUID(), at: new Date().toISOString(), lines: record.lines.map(line => ({ lineId: line.transferLineId, qty: Number(drafts.get(`qty:${line.transferLineId}`) || ''), locationId: drafts.get(`location:${line.transferLineId}`) || '' })) }
    busy = true
    const controls = [...root()!.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('[data-post-material-detail] input,[data-post-material-detail] button,[data-post-material-detail] select')].map(node => ({ node, disabled: node.disabled }))
    controls.forEach(({ node }) => { node.disabled = true })
    try { const result = await receiveAccessoryPostTransfer(pending); busy = false; dirty = false; pending = null; message = result.alreadyInbound ? '该单已收货上架，无需再次提交。' : '整单收货上架已保存，后道辅料库存已更新。'; closeDetail(); refreshList() }
    finally { busy = false; controls.forEach(({ node, disabled }) => { node.disabled = disabled }) }
  } catch (value) { busy = false; showError(value) }
}
export async function renderPostFinishingMaterialTransfersPage(): Promise<string> {
  try {
    await prepareAccessoryPostFinishing()
    mountedPath = typeof window === 'undefined' ? path : window.location.pathname + window.location.search
    selectedId = query().get('transferId') || ''; drafts.clear(); pending = null; dirty = false; error = ''; message = ''
    logId = ''; resetCreateState(); generalCatalog = null
    return `<div data-post-material-root data-skip-page-rerender="true"><div data-post-material-workspace>${renderList()}</div><div data-post-material-detail>${renderDetail()}</div><div data-post-material-create></div><div data-post-material-log></div><div data-post-material-image></div></div>`
  } catch (value) { return `<section role="alert" class="rounded border border-red-200 bg-red-50 p-4"><h1 class="font-semibold">后道辅料资料无法读取</h1><p class="mt-2 text-sm">${escapeHtml(value instanceof Error ? value.message : String(value))}</p><button class="mt-3 rounded border px-3 py-2" data-nav="${path}">重新读取</button></section>` }
}
export function handlePostFinishingMaterialTransfersEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  const image = target.closest<HTMLElement>('[data-accessory-action]')
  if (image && (!event || event.type === 'click')) {
    if (image.dataset.accessoryAction === 'post-material-close') { closeDetail(); return true }
    if (image.dataset.accessoryAction === 'post-material-close-log') { closeLog(); return true }
    if (image.dataset.accessoryAction === 'post-material-close-create') { closeCreate(); return true }
    if (image.dataset.accessoryAction === 'post-material-close-image') { root()?.querySelector('[data-post-material-image]')?.replaceChildren(); restoreAccessoryFocus(); return true }
    if (image.dataset.accessoryAction === 'image') { const host = root()?.querySelector('[data-post-material-image]'); if (host) { host.innerHTML = accessoryOverlay(image.dataset.label || '图片', `<img class="mx-auto max-h-[70vh] max-w-full object-contain" src="${escapeHtml(image.dataset.image || '')}" alt="${escapeHtml(image.dataset.label || '')}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-3 text-sm text-red-600">图片加载失败，关闭后重试。</p>`, '', 'post-material-close-image'); focusAccessoryOverlay() }; return true }
  }
  const orderInput = target.closest<HTMLInputElement>('[data-post-material-create-order]')
  if (orderInput && (event?.type === 'input' || event?.type === 'change')) {
    if (createBusy) return true
    createOrderNo = orderInput.value; createDirty = true; resetCreatePending()
    if (createPreview) { createPreview = null; createProductionQty.clear(); refreshCreateHost(); requestAnimationFrame(() => root()?.querySelector<HTMLInputElement>('[data-post-material-create-order]')?.focus()) }
    return true
  }
  const bomQty = target.closest<HTMLInputElement>('[data-post-material-create-bom-qty]')
  if (bomQty && (event?.type === 'input' || event?.type === 'change')) {
    if (createBusy) return true
    createProductionQty.set(bomQty.dataset.postMaterialCreateBomQty || '', bomQty.value); createDirty = true; resetCreatePending(); return true
  }
  const generalQty = target.closest<HTMLInputElement>('[data-post-material-create-general-qty]')
  if (generalQty && (event?.type === 'input' || event?.type === 'change')) {
    if (createBusy) return true
    createGeneralQty.set(generalQty.dataset.postMaterialCreateGeneralQty || '', generalQty.value); createDirty = true; resetCreatePending(); return true
  }
  const generalSearch = target.closest<HTMLInputElement>('[data-post-material-create-search]')
  if (generalSearch && (event?.type === 'input' || event?.type === 'change')) { createGeneralQuery = generalSearch.value; refreshGeneralResults(); return true }
  const createActorInput = target.closest<HTMLInputElement>('[data-post-material-create-actor]')
  if (createActorInput && (event?.type === 'input' || event?.type === 'change')) { if (createBusy) return true; createActor = createActorInput.value; createDirty = true; resetCreatePending(); return true }
  const input = target.closest<HTMLInputElement | HTMLSelectElement>('[data-post-material-qty],[data-post-material-location],[data-post-material-actor]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (busy) return true
    drafts.set(input.dataset.postMaterialQty ? `qty:${input.dataset.postMaterialQty}` : input.dataset.postMaterialLocation ? `location:${input.dataset.postMaterialLocation}` : 'actor', input.value); dirty = true; pending = null; return true
  }
  const node = target.closest<HTMLElement>(`[data-${prefix}-action]`), action = node?.dataset.postFinishingMaterialTransfersAction
  const size = target.closest<HTMLSelectElement>(`[data-${prefix}-field="pageSize"]`)
  if (size && event?.type === 'change') { updateUrl({ pageSize: size.value, page: null }); refreshList(); return true }
  if (!node || !action || (event && event.type !== 'click')) return false
  if (busy || createBusy) return true
  if (action === 'create') { openCreate(); return true }
  if (action === 'log') { openLog(node.dataset.id || ''); return true }
  if (action === 'create-mode') { createMode = node.dataset.mode === 'GENERAL' ? 'GENERAL' : 'PRODUCTION_ORDER'; resetCreatePending(); refreshCreateHost(); return true }
  if (action === 'create-load-order') { const result = readManualTransferProductionPreview(createOrderNo); if (!result.ok) { createError = result.message; refreshCreateHost() } else { createPreview = result.preview; createProductionQty.clear(); createError = ''; createDirty = true; refreshCreateHost(); requestAnimationFrame(() => root()?.querySelector<HTMLInputElement>('[data-post-material-create-bom-qty]')?.focus()) } return true }
  if (action === 'create-add') { const row = generalMaterials().find(item => item.key === node.dataset.key); if (!row) { createError = '物料目录已变化，请重新搜索。' } else if (createGeneralSelected.has(row.key)) { createError = '该物料已添加，每个物料只能一行。' } else { createGeneralSelected.set(row.key, row); createError = ''; createDirty = true; refreshCreateHost(); requestAnimationFrame(() => root()?.querySelector<HTMLInputElement>(`[data-post-material-create-general-qty="${CSS.escape(row.key)}"]`)?.focus()) } return true }
  if (action === 'create-remove') { const key = node.dataset.key || ''; createGeneralSelected.delete(key); createGeneralQty.delete(key); resetCreatePending(); createDirty = true; refreshCreateHost(); return true }
  if (action === 'create-cancel') { closeCreate(); return true }
  if (action === 'create-submit') { void submitCreate(); return true }
  if (action === 'detail') { selectedId = node.dataset.id || ''; drafts = new Map([['actor', 'DLN 仓管']]); dirty = false; error = ''; pending = null; updateUrl({ transferId: selectedId }); refreshDetail(); focusAccessoryOverlay(); return true }
  if (action === 'receive') { void receive(); return true }
  if (action === 'query' || action === 'reset') { const form = root()?.querySelector<HTMLFormElement>('[data-post-material-query]'); const values = form ? new FormData(form) : new FormData(); updateUrl(Object.fromEntries(['keyword', 'status', 'sourceWarehouse', 'createdFrom', 'createdTo'].map(name => [name, action === 'reset' ? null : String(values.get(name) || '') || null]))); updateUrl({ page: null }); refreshList(); return true }
  if (action === 'prev-page' || action === 'next-page') { updateUrl({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'next-page' ? 1 : -1))) }); refreshList(); return true }
  return false
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', event => { if (!root()) return; trapAccessoryOverlayFocus(event); if (event.key === 'Escape') { if (root()?.querySelector('[data-post-material-image]')?.childElementCount) { root()?.querySelector('[data-post-material-image]')?.replaceChildren(); restoreAccessoryFocus() } else if (root()?.querySelector('[data-post-material-log]')?.childElementCount) closeLog(); else if (createOpen) closeCreate(); else if (selectedId) closeDetail() } })
  window.addEventListener('beforeunload', event => { if (root() && (dirty || busy || createDirty || createBusy)) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('higood:before-history-navigation', event => { if (!root() || (!dirty && !busy && !createDirty && !createBusy)) return; if (busy || createBusy || !window.confirm('未保存的输入将丢弃，是否离开？')) { event.preventDefault(); window.history.pushState(null, '', mountedPath) } else { dirty = false; selectedId = ''; pending = null; drafts.clear(); resetCreateState(); refreshCreateHost(); logId = ''; refreshLogHost() } })
  document.addEventListener('click', event => { if (!root() || (!dirty && !busy && !createDirty && !createBusy)) return; const node = event.target instanceof Element ? event.target.closest('[data-nav],[data-system],[data-system-id],[data-system-switch],a[href]') : null; if (node && (busy || createBusy || !window.confirm('未保存的输入将丢弃，是否离开？'))) { event.preventDefault(); event.stopImmediatePropagation() } else if (node) { dirty = false; selectedId = ''; pending = null; drafts.clear(); resetCreateState(); refreshCreateHost(); logId = ''; refreshLogHost() } }, true)
}
