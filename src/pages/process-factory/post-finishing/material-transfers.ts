// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { listPostFinishingMaterialTransferOrders, getPostFinishingMaterialTransferOrder, type PostFinishingMaterialTransferOrder } from '../../../data/fcs/post-finishing-full-flow.ts'
import { prepareAccessoryPostFinishing, isManagedAccessoryPostTransfer, receiveAccessoryPostTransfer, listAccessoryPostLocations } from '../../../data/wls/accessory-warehouse-post-finishing.ts'
import { accessoryImage, accessoryOverlay, focusAccessoryOverlay, restoreAccessoryFocus, trapAccessoryOverlayFocus } from '../../wls/accessory-warehouses/shared.ts'
import { escapeHtml } from '../../../utils.ts'
const path = '/fcs/craft/post-finishing/material-transfers', prefix = 'post-finishing-material-transfers'
let selectedId = '', dirty = false, busy = false, message = '', error = '', mountedPath = ''
let drafts = new Map<string, string>()
let pending: Parameters<typeof receiveAccessoryPostTransfer>[0] | null = null
const root = () => document.querySelector<HTMLElement>('[data-post-material-root]')
const query = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
const qty = (value: number, unit: string) => `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${escapeHtml(unit)}`
const button = (label: string, action: string, id = '', disabled = false) => `<button type="button" class="rounded border px-3 py-2 text-sm disabled:opacity-50" data-${prefix}-action="${action}" data-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`
function updateUrl(values: Record<string, string | null>): void { const params = query(); for (const [key, value] of Object.entries(values)) value === null ? params.delete(key) : params.set(key, value); window.history.pushState(null, '', `${path}${params.size ? `?${params}` : ''}`); mountedPath = window.location.pathname + window.location.search }
function totals(record: PostFinishingMaterialTransferOrder): string { return [...new Set(record.lines.map(line => line.unit))].map(unit => qty(record.lines.filter(line => line.unit === unit).reduce((sum, line) => sum + line.preparedQty, 0), unit)).join('<br>') }
function code(value: string): string { return /-bom-|prep-line-|::/.test(value) ? '' : value }
const columns: StandardListColumn<PostFinishingMaterialTransferOrder>[] = [
  { key: 'order', title: '调拨单', width: 230, required: true, render: row => `<strong>${escapeHtml(row.transferOrderNo)}</strong><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)}</p>` },
  { key: 'style', title: '款式', width: 270, required: true, render: row => `<div class="flex items-center gap-3">${accessoryImage(row.styleImageUrl, row.styleName)}<div>${escapeHtml(row.styleName)}<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.responsibility.responsibilityLabel)}</p></div></div>` },
  { key: 'route', title: '来源 → 去向', width: 240, render: row => `<p>${escapeHtml(row.sourceWarehouseName)} → ${escapeHtml(row.targetWarehouseName)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.targetLocationCode)}</p>` },
  { key: 'quantity', title: '整单数量', width: 140, render: totals },
  { key: 'status', title: '当前状态', width: 100, render: row => `<strong>${escapeHtml(row.status)}</strong>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: row => button(isManagedAccessoryPostTransfer(row.transferOrderId) && row.status === '待入库' ? '查看并收货上架' : '查看详情', 'detail', row.transferOrderId) },
]
function renderList(): string {
  const params = query(), keyword = (params.get('keyword') || '').trim().toLowerCase(), status = params.get('status') || '', source = params.get('sourceWarehouse') || '', createdFrom = params.get('createdFrom') || '', createdTo = params.get('createdTo') || ''
  const all = listPostFinishingMaterialTransferOrders(), rows = all.filter(row => (!keyword || [row.transferOrderNo, row.productionOrderNo, row.styleName, ...row.lines.map(line => line.materialName)].join(' ').toLowerCase().includes(keyword)) && (!status || row.status === status) && (!source || row.sourceWarehouseName === source) && (!createdFrom || row.createdAt.slice(0, 10) >= createdFrom) && (!createdTo || row.createdAt.slice(0, 10) <= createdTo))
  const requested = Number(params.get('pageSize') || 10), pageSize = [10, 20, 50].includes(requested) ? requested : 10, page = paginateStandardListRows(rows, Number(params.get('page') || 1), pageSize)
  return renderStandardListPage({
    title: '后道辅料调拨单', feedbackHtml: `${message ? `<p role="status" class="rounded bg-green-50 p-3 text-sm">${escapeHtml(message)}</p>` : ''}`,
    filtersHtml: `<form data-post-material-query class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3"><label class="grid gap-1 text-sm">调拨单 / 生产单 / 款式 / 物料<input name="keyword" value="${escapeHtml(params.get('keyword') || '')}" class="h-9 rounded border px-3"></label><label class="grid gap-1 text-sm">来源仓<select name="sourceWarehouse" class="h-9 rounded border px-3"><option value="">全部</option>${[...new Set(all.map(row => row.sourceWarehouseName))].map(value => `<option ${source === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="grid gap-1 text-sm">当前状态<select name="status" class="h-9 rounded border px-3"><option value="">全部</option>${['申请调拨', '待调拨', '待入库', '已入库'].map(value => `<option ${status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="grid gap-1 text-sm">创建开始<input class="h-9 rounded border px-3" name="createdFrom" type="date" value="${escapeHtml(createdFrom)}"></label><label class="grid gap-1 text-sm">创建结束<input class="h-9 rounded border px-3" name="createdTo" type="date" value="${escapeHtml(createdTo)}"></label><div class="flex items-end justify-end gap-2">${button('查询', 'query')}${button('重置', 'reset')}</div></form>`,
    statsHtml: renderStandardListStats([{ label: '筛选调拨单', value: rows.length }, { label: '待调拨', value: rows.filter(row => ['申请调拨', '待调拨'].includes(row.status)).length }, { label: '待入库', value: rows.filter(row => row.status === '待入库').length }, { label: '已入库', value: rows.filter(row => row.status === '已入库').length }]),
    listTitle: '调拨单列表', tableHtml: renderStandardListTable({ columns, rows: page.rows, preferences: { order: columns.map(row => row.key), visibleKeys: columns.map(row => row.key), frozenKeys: [], pageSize }, sort: null, eventPrefix: prefix }), paginationHtml: renderTablePagination({ ...page, actionPrefix: prefix, pageSizeOptions: [10, 20, 50], skipPageRerender: true }),
  })
}
function renderDetail(): string {
  const record = getPostFinishingMaterialTransferOrder(selectedId)
  if (!record) return ''
  const managed = isManagedAccessoryPostTransfer(record.transferOrderId), receive = managed && record.status === '待入库'
  const columns: StandardListColumn<PostFinishingMaterialTransferOrder['lines'][number]>[] = [
    { key: 'material', title: '物料', width: 270, required: true, render: line => `<div class="flex items-center gap-3">${accessoryImage(line.imageUrl, line.materialName)}<div><strong>${escapeHtml(line.materialName)}</strong><p class="text-xs text-muted-foreground">${escapeHtml(code(line.materialCode))}</p><p class="text-xs text-muted-foreground">${escapeHtml(line.specification)}</p></div></div>` },
    { key: 'expected', title: '应收', width: 120, render: line => qty(line.preparedQty, line.unit) },
    { key: 'received', title: '实收数量', width: 160, render: line => receive ? `<label class="flex items-center gap-2"><input aria-label="${escapeHtml(line.materialName)}实收数量" class="h-10 w-24 rounded border px-2" inputmode="decimal" data-post-material-qty="${escapeHtml(line.transferLineId)}" value="${escapeHtml(drafts.get(`qty:${line.transferLineId}`) || '')}">${escapeHtml(line.unit)}</label>` : record.status === '已入库' ? qty(line.preparedQty, line.unit) : '尚未入库' },
  ]
  if (receive) columns.push({ key: 'location', title: '上架库位', width: 180, render: line => `<select class="h-10 rounded border px-2" aria-label="${escapeHtml(line.materialName)}上架库位" data-post-material-location="${escapeHtml(line.transferLineId)}"><option value="">选择后道库位</option>${listAccessoryPostLocations().map(location => `<option value="${location.id}" ${drafts.get(`location:${line.transferLineId}`) === location.id ? 'selected' : ''}>${location.locationCode}</option>`).join('')}</select>` })
  return accessoryOverlay('后道辅料调拨单详情', `<div class="space-y-4"><div class="flex items-center gap-3">${accessoryImage(record.styleImageUrl, record.styleName)}<div><strong>${escapeHtml(record.productionOrderNo)}</strong><p>${escapeHtml(record.styleName)}</p><p class="mt-1 text-sm">${escapeHtml(record.sourceWarehouseName)} → ${escapeHtml(record.targetWarehouseName)} · ${escapeHtml(record.status)}</p></div></div>${receive ? '<p class="rounded bg-blue-50 p-3 text-sm">逐行登记实际收到的辅料和后道库位，整单一致后一次收货上架。</p>' : ''}<div class="overflow-x-auto">${renderStandardListTable({ columns, rows: record.lines, preferences: { order: columns.map(column => column.key), visibleKeys: columns.map(column => column.key), frozenKeys: [], pageSize: record.lines.length }, sort: null, eventPrefix: prefix })}</div>${receive ? `<div class="flex flex-wrap gap-3"><label class="grid gap-1 text-sm">后道仓管<input class="h-10 rounded border px-3" data-post-material-actor value="${escapeHtml(drafts.get('actor') || 'DLN 仓管')}"></label></div>` : ''}<p role="alert" class="whitespace-pre-wrap text-sm text-red-600" data-post-material-error>${escapeHtml(error)}</p><section><h3 class="font-semibold">操作记录</h3><ol class="mt-2 space-y-2">${record.statusHistory.map(item => `<li class="rounded border p-3 text-sm"><strong>${escapeHtml(item.status)}</strong><p>${escapeHtml(item.remark)}</p><p class="text-xs text-muted-foreground">${escapeHtml(item.operatorName)} · ${escapeHtml(item.operatedAt)}</p></li>`).join('')}</ol></section></div>`, receive ? button(busy ? '正在保存…' : '确认收货并上架', 'receive', record.transferOrderId, busy) : '', 'post-material-close')
}
function refreshList(): void { const host = root()?.querySelector('[data-post-material-workspace]'); if (host) host.innerHTML = renderList() }
function refreshDetail(): void { const host = root()?.querySelector('[data-post-material-detail]'); if (host) host.innerHTML = renderDetail() }
function closeDetail(): void { if (busy || (dirty && !window.confirm('实收和上架输入尚未保存。关闭将丢弃输入，是否关闭？'))) return; selectedId = ''; dirty = false; drafts.clear(); pending = null; error = ''; updateUrl({ transferId: null }); root()?.querySelector('[data-post-material-detail]')?.replaceChildren(); restoreAccessoryFocus() }
function showError(value: unknown): void { error = value instanceof Error ? value.message : String(value); const host = root()?.querySelector('[data-post-material-error]'); if (host) host.textContent = error; else { message = error; refreshList() } }
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
    selectedId = query().get('transferId') || ''; drafts.clear(); pending = null; dirty = false; error = ''
    return `<div data-post-material-root data-skip-page-rerender="true"><div data-post-material-workspace>${renderList()}</div><div data-post-material-detail>${renderDetail()}</div><div data-post-material-image></div></div>`
  } catch (value) { return `<section role="alert" class="rounded border border-red-200 bg-red-50 p-4"><h1 class="font-semibold">后道辅料资料无法读取</h1><p class="mt-2 text-sm">${escapeHtml(value instanceof Error ? value.message : String(value))}</p><button class="mt-3 rounded border px-3 py-2" data-nav="${path}">重新读取</button></section>` }
}
export function handlePostFinishingMaterialTransfersEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  const input = target.closest<HTMLInputElement | HTMLSelectElement>('[data-post-material-qty],[data-post-material-location],[data-post-material-actor]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (busy) return true
    drafts.set(input.dataset.postMaterialQty ? `qty:${input.dataset.postMaterialQty}` : input.dataset.postMaterialLocation ? `location:${input.dataset.postMaterialLocation}` : 'actor', input.value); dirty = true; pending = null; return true
  }
  const image = target.closest<HTMLElement>('[data-accessory-action]')
  if (image && (!event || event.type === 'click')) {
    if (image.dataset.accessoryAction === 'post-material-close') { closeDetail(); return true }
    if (image.dataset.accessoryAction === 'post-material-close-image') { root()?.querySelector('[data-post-material-image]')?.replaceChildren(); restoreAccessoryFocus(); return true }
    if (image.dataset.accessoryAction === 'image') { const host = root()?.querySelector('[data-post-material-image]'); if (host) { host.innerHTML = accessoryOverlay(image.dataset.label || '图片', `<img class="mx-auto max-h-[70vh] max-w-full object-contain" src="${escapeHtml(image.dataset.image || '')}" alt="${escapeHtml(image.dataset.label || '')}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-3 text-sm text-red-600">图片加载失败，关闭后重试。</p>`, '', 'post-material-close-image'); focusAccessoryOverlay() }; return true }
  }
  const node = target.closest<HTMLElement>(`[data-${prefix}-action]`), action = node?.dataset.postFinishingMaterialTransfersAction
  const size = target.closest<HTMLSelectElement>(`[data-${prefix}-field="pageSize"]`)
  if (size && event?.type === 'change') { updateUrl({ pageSize: size.value, page: null }); refreshList(); return true }
  if (!node || !action || (event && event.type !== 'click')) return false
  if (busy) return true
  if (action === 'detail') { selectedId = node.dataset.id || ''; drafts = new Map([['actor', 'DLN 仓管']]); dirty = false; error = ''; pending = null; updateUrl({ transferId: selectedId }); refreshDetail(); focusAccessoryOverlay(); return true }
  if (action === 'receive') { void receive(); return true }
  if (action === 'query' || action === 'reset') { const form = root()?.querySelector<HTMLFormElement>('[data-post-material-query]'); const values = form ? new FormData(form) : new FormData(); updateUrl(Object.fromEntries(['keyword', 'status', 'sourceWarehouse', 'createdFrom', 'createdTo'].map(name => [name, action === 'reset' ? null : String(values.get(name) || '') || null]))); updateUrl({ page: null }); refreshList(); return true }
  if (action === 'prev-page' || action === 'next-page') { updateUrl({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'next-page' ? 1 : -1))) }); refreshList(); return true }
  return false
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', event => { if (!root()) return; trapAccessoryOverlayFocus(event); if (event.key === 'Escape') { if (root()?.querySelector('[data-post-material-image]')?.childElementCount) { root()?.querySelector('[data-post-material-image]')?.replaceChildren(); restoreAccessoryFocus() } else if (selectedId) closeDetail() } })
  window.addEventListener('beforeunload', event => { if (root() && (dirty || busy)) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('higood:before-history-navigation', event => { if (!root() || (!dirty && !busy)) return; if (busy || !window.confirm('实收和上架输入尚未保存。离开将丢弃输入，是否离开？')) { event.preventDefault(); window.history.pushState(null, '', mountedPath) } else { dirty = false; selectedId = ''; pending = null; drafts.clear() } })
  document.addEventListener('click', event => { if (!root() || (!dirty && !busy)) return; const node = event.target instanceof Element ? event.target.closest('[data-nav],[data-system],[data-system-id],[data-system-switch],a[href]') : null; if (node && (busy || !window.confirm('实收和上架输入尚未保存。离开将丢弃输入，是否离开？'))) { event.preventDefault(); event.stopImmediatePropagation() } else if (node) { dirty = false; selectedId = ''; pending = null; drafts.clear() } }, true)
}
