// @page-pattern: list
// POST-010/014/021/025: 外部成衣仓原 FCK 接收。身份选择仅用于原型演示。
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderDialog } from '../components/ui/dialog.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { listPostFinishingFullFlowOutboundOrders, getPostFinishingFullFlowOutboundOrder, listPostFinishingWarehouseReceipts, receivePostFinishingOutboundOrder, type PostFinishingOutboundOrder } from '../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../utils.ts'

type Row = PostFinishingOutboundOrder
interface State extends ProcessOrderListControllerState {
  rows: Row[]; keyword: string; actorRole: string; actorName: string; selected: Row | null
  quantities: Record<string, string>; authorizationCode: string; reason: string; feedback: string; busy: boolean
  image: { url: string; label: string } | null
}
const PREFIX = 'wls-finished-inbound', ROOT = '[data-wls-finished-inbound-root]'
const state: State = {
  currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false, showColumnSettings: false, rows: [], keyword: '', actorRole: 'READONLY', actorName: '',
  selected: null, quantities: {}, authorizationCode: '', reason: '', feedback: '', busy: false, image: null,
}
const action = (name: string) => `data-wls-finished-inbound-action="${name}" data-skip-page-rerender="true"`
function root(): HTMLElement | null { return typeof document === 'undefined' ? null : document.querySelector(ROOT) }
function blocked(row: Row | undefined): string {
  if (!row || !row.outboundOrderNo.startsWith('FCK-')) return '未找到完整成衣仓出货单，请重新查询。'
  if (row.status !== '待仓库接收') return '该单已确认接收入库，不能重复收货。'
  if (!row.lines.length || new Set(row.lines.map(l => l.sku.skuId)).size !== row.lines.length
    || row.lines.some(l => !l.sku.skuId || !l.sku.skuCode || !l.sku.qtyUnit || !Number.isInteger(l.outboundQty) || l.outboundQty < 0)) return '原单 SKU、数量或单位不完整，请联系交出方核对。'
  return ''
}
function filteredRows(): Row[] {
  const key = state.keyword.trim().toLowerCase()
  return state.rows.filter(row => !key || [row.outboundOrderNo, row.productionOrderNo, ...row.lines.map(l => l.sku.skuCode)].some(v => v.toLowerCase().includes(key)))
}
function sku(line: Row['lines'][number]): string {
  const s = line.sku, label = `${s.skuCode} · ${s.colorName} / ${s.sizeName}`
  return `<div class="flex items-start gap-2">${s.imageUrl ? `<button class="relative h-10 w-10 shrink-0 overflow-hidden rounded border" ${action('image')} data-image-url="${escapeHtml(s.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"><span class="text-[10px]">加载中</span></button>` : '<span class="text-xs text-amber-800">准确图片待补充</span>'}<div class="min-w-0"><div class="font-medium">${escapeHtml(s.skuCode)}</div><div class="text-xs">${escapeHtml(s.spuName)}</div><div class="text-xs text-slate-500">${escapeHtml(s.colorName)} / ${escapeHtml(s.sizeName)}</div></div></div>`
}
const columns: StandardListColumn<Row>[] = [
  { key: 'source', title: '成衣仓出货单 / 来源', width: 230, required: true, freezeable: true, sortable: true, sortValue: r => r.createdAt, render: r => `<div class="font-medium">${escapeHtml(r.outboundOrderNo)}</div><div class="text-xs">${escapeHtml(r.productionOrderNo)} · ${escapeHtml(r.sourceType)}</div><div class="text-xs text-slate-500">${escapeHtml(r.responsibility.taskTypeLabel)} · ${escapeHtml(r.responsibility.responsibilityLabel)}</div>` },
  { key: 'sku', title: '成衣 SKU / 数量', width: 340, required: true, render: r => r.lines.map(l => `<div class="mb-2">${sku(l)}<div class="ml-12 text-xs">应收 ${l.outboundQty} ${escapeHtml(l.sku.qtyUnit || '')} · ${l.receivedQty === undefined ? '待实际清点' : `实收 ${l.receivedQty} ${escapeHtml(l.sku.qtyUnit || '')}`}</div></div>`).join('') },
  { key: 'status', title: '接收状态', width: 140, render: r => escapeHtml(r.status) },
  { key: 'actor', title: '成衣仓收货人 / 时间', width: 200, render: r => `<div>${escapeHtml(r.receivedBy?.actorName || '待接收')}</div><div class="text-xs">${r.receivedAt ? escapeHtml(new Date(r.receivedAt).toLocaleString('zh-CN')) : ''}</div>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true, render: r => `${blocked(r) ? `<span class="text-xs">${escapeHtml(blocked(r))}</span>` : `<button class="rounded border px-3 py-2 disabled:opacity-40" ${action('open')} data-order-no="${escapeHtml(r.outboundOrderNo)}" ${state.actorRole === 'GARMENT_RECEIVER' ? '' : 'disabled'}>确认成衣仓实收</button>`}<button class="mt-2 block text-xs text-blue-700" data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(r.outboundOrderId)}">查看原出货单</button>` },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/wls/finished-inbound', pageSizeOptions: [10, 20, 50], eventPrefix: PREFIX, rootSelector: ROOT, tableSurfaceSelector: '[data-finished-inbound-table]', paginationSurfaceSelector: '[data-finished-inbound-pagination]', overlaysSurfaceSelector: '[data-finished-inbound-columns]', defaultFrozenKeys: ['source'], columnSettingsTitle: '成衣仓收货列设置', emptyText: '暂无成衣仓出货单', getRows: filteredRows, locallyManagedEvents: true })
function stats(): string { return renderStandardListStats([{ label: '出货单', value: state.rows.length }, { label: '待仓库接收', value: state.rows.filter(r => r.status === '待仓库接收').length }, { label: '已接收入库', value: state.rows.filter(r => r.status === '已接收入库').length }]) }
function overlays(): string {
  const r = state.selected
  const dialog = r ? renderDialog({ title: '确认成衣仓实收', description: '逐 SKU 清点后确认；只保存本次实际数量。', width: 'lg', closeAction: { prefix: PREFIX, action: 'close' } }, `<div class="space-y-3" data-skip-page-rerender="true"><strong>${escapeHtml(r.outboundOrderNo)}</strong><p class="text-sm">接收方：成衣仓 · ${escapeHtml(state.actorName || '请先填写收货人')}</p>${r.lines.map(l => `<label class="block rounded border p-3">${sku(l)}<span class="mt-2 block text-xs">应收 ${l.outboundQty} ${escapeHtml(l.sku.qtyUnit || '')}</span><input class="mt-1 w-full rounded border p-2" type="number" min="0" step="1" data-wls-finished-inbound-field="qty" data-sku-id="${escapeHtml(l.sku.skuId)}" value="${escapeHtml(state.quantities[l.sku.skuId] || '')}" aria-label="${escapeHtml(l.sku.skuCode)} 实收数量"></label>`).join('')}<details><summary class="cursor-pointer text-sm">数量有差异：扫描主管授权码并填写原因</summary><input class="mt-2 w-full rounded border p-2" data-wls-finished-inbound-field="authorization" value="${escapeHtml(state.authorizationCode)}" placeholder="原动态授权码"><textarea class="mt-2 w-full rounded border p-2" data-wls-finished-inbound-field="reason" placeholder="实际差异原因">${escapeHtml(state.reason)}</textarea></details><p role="status" data-finished-inbound-dialog-feedback>${escapeHtml(state.feedback)}</p></div>`, `<button class="rounded border px-3 py-2" ${action('close')}>取消</button><button class="rounded bg-blue-600 px-3 py-2 text-white" ${action('save')} ${state.busy ? 'disabled' : ''}>${state.busy ? '正在确认…' : '确认并保存实收'}</button>`) : ''
  const picture = state.image ? `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" ${action('close-image')}><button class="absolute right-4 top-4 rounded bg-white px-3 py-2" ${action('close-image')}>关闭大图</button><div class="relative"><img class="max-h-[85vh] max-w-[90vw] object-contain" src="${escapeHtml(state.image.url)}" alt="${escapeHtml(state.image.label)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图';this.nextElementSibling.hidden=false"><span class="rounded bg-white p-3">图片加载中…</span></div></div>` : ''
  return `<div data-finished-inbound-columns>${controller.renderColumnSettings()}</div>${dialog}${picture}`
}
function refreshOverlays(): void { const e = root()?.querySelector('[data-finished-inbound-overlays]'); if (e) e.innerHTML = overlays() }
function feedback(): void { const e = root()?.querySelector('[data-finished-inbound-feedback]'); if (e) e.textContent = state.feedback }
function validate(row: Row | undefined, role: string, name: string, values: Record<string, string>, authorizationCode: string, reason: string): Array<{ skuId: string; receivedQty: number }> {
  if (role !== 'GARMENT_RECEIVER') throw new Error('请使用原型成衣仓收货员身份，不允许其他角色代收。')
  if (!name.trim()) throw new Error('请填写实际收货人姓名。')
  const error = blocked(row); if (error) throw new Error(error)
  const result = row!.lines.map(l => {
    const raw = values[l.sku.skuId], qty = Number(raw)
    if (!raw?.trim() || !Number.isInteger(qty) || qty < 0) throw new Error(`请填写 ${l.sku.skuCode} 的非负整数实收数量。`)
    return { skuId: l.sku.skuId, receivedQty: qty }
  })
  if (result.some((l, i) => l.receivedQty !== row!.lines[i].outboundQty) && (!authorizationCode.trim() || !reason.trim())) throw new Error('实际数量有差异，请扫描主管动态授权码并填写原因，不能按应收量代填。')
  return result
}
function save(): void {
  if (state.busy || !state.selected) return
  const selected = state.selected, role = state.actorRole, name = state.actorName.trim(), values = { ...state.quantities }, code = state.authorizationCode.trim(), reason = state.reason.trim()
  try { validate(selected, role, name, values, code, reason) } catch (error) { state.feedback = (error as Error).message; refreshOverlays(); return }
  state.busy = true; state.feedback = '正在确认成衣仓实际收货…'; refreshOverlays(); feedback()
  requestAnimationFrame(() => setTimeout(() => {
    let submitted = false
    try {
      const current = getPostFinishingFullFlowOutboundOrder(selected.outboundOrderNo)
      const quantities = validate(current, state.actorRole, state.actorName, values, code, reason)
      if (role !== state.actorRole || name !== state.actorName.trim() || JSON.stringify(current!.lines.map(l => [l.sku.skuId, l.sku.skuCode, l.sku.qtyUnit, l.outboundQty])) !== JSON.stringify(selected.lines.map(l => [l.sku.skuId, l.sku.skuCode, l.sku.qtyUnit, l.outboundQty]))) throw new Error('收货身份或原出货数量已变化，请重新打开确认。')
      const result = receivePostFinishingOutboundOrder({ outboundOrderNo: current!.outboundOrderNo, actor: { actorId: `WLS-GARMENT:${name}`, actorName: name, roleName: '成衣仓收货员' }, receivedQuantities: quantities, authorization: code ? { scanValue: code, differenceReason: reason } : undefined })
      submitted = true
      const saved = getPostFinishingFullFlowOutboundOrder(current!.outboundOrderNo)
      const receipts = listPostFinishingWarehouseReceipts().filter(r => r.outboundOrderId === current!.outboundOrderId)
      if (!saved || saved.status !== '已接收入库' || receipts.length !== 1 || saved.receivedBy?.actorName !== name || saved.receivedAt !== result.receipt.receivedAt || quantities.some(q => saved.lines.find(l => l.sku.skuId === q.skuId)?.receivedQty !== q.receivedQty || receipts[0].lines.find(l => l.sku.skuId === q.skuId)?.receivedQty !== q.receivedQty)) throw new Error('原出货单与收货记录未核对一致，请查看原单，不要重复提交。')
      state.selected = null; state.feedback = '成衣仓实收已保存，原出货单及收货记录已核对一致。'
      state.rows = listPostFinishingFullFlowOutboundOrders(); controller.refresh()
      const e = root()?.querySelector('[data-finished-inbound-stats]'); if (e) e.innerHTML = stats()
    } catch (error) { state.feedback = `${submitted ? '已提交，请核对原单，勿重复收货' : '未保存'}：${(error as Error).message}` }
    finally { state.busy = false; refreshOverlays(); feedback() }
  }, 0))
}
export function renderWlsFinishedInboundPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(root())); state.selected = null; state.image = null; state.busy = false
  controller.installColumnDragEvents(); state.rows = listPostFinishingFullFlowOutboundOrders()
  const view = controller.getView()
  return `<div data-wls-finished-inbound-root data-skip-page-rerender="true">${renderStandardListPage({ title: '成衣仓收货', primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2 text-sm"><span>原型操作身份</span><select class="rounded border p-2" data-wls-finished-inbound-field="role"><option value="READONLY" ${state.actorRole === 'READONLY' ? 'selected' : ''}>只读查看</option><option value="GARMENT_RECEIVER" ${state.actorRole === 'GARMENT_RECEIVER' ? 'selected' : ''}>成衣仓收货员</option></select><input class="rounded border p-2" data-wls-finished-inbound-field="name" value="${escapeHtml(state.actorName)}" placeholder="实际收货人姓名"></div>`, feedbackHtml: `<p role="status" data-finished-inbound-feedback>${escapeHtml(state.feedback)}</p>`, filtersHtml: `<div class="flex gap-2"><input class="min-w-0 flex-1 rounded border p-2" data-wls-finished-inbound-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="完整FCK单号、生产单或SKU"><button class="rounded border px-3" ${action('query')}>查询</button><button class="rounded border px-3" ${action('reload')}>刷新记录</button></div>`, statsHtml: `<div data-finished-inbound-stats>${stats()}</div>`, listTitle: '原成衣仓出货单', listActionsHtml: `<button ${action('open-column-settings')}>列设置</button>`, tableHtml: `<div data-finished-inbound-table>${view.tableHtml}</div>`, paginationHtml: `<div data-finished-inbound-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-finished-inbound-overlays>${overlays()}</div>` })}</div>`
}
export function closeWlsFinishedInboundOverlays(): boolean {
  if (!root() || (!state.selected && !state.image && !state.showColumnSettings)) return false
  if (state.busy) return true
  if (state.image) state.image = null
  else { state.selected = null; state.showColumnSettings = false }
  refreshOverlays(); return true
}
export function handleWlsFinishedInboundEvent(target: HTMLElement, event?: Event): boolean {
  if (!root()) return false
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') return closeWlsFinishedInboundOverlays()
  const field = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-wls-finished-inbound-field]')
  if (field) {
    if (state.busy) return true
    const key = field.dataset.wlsFinishedInboundField
    if (key === 'keyword') state.keyword = field.value
    if (key === 'name') state.actorName = field.value
    if (key === 'qty' && field.dataset.skuId) state.quantities[field.dataset.skuId] = field.value
    if (key === 'authorization') state.authorizationCode = field.value
    if (key === 'reason') state.reason = field.value
    if (key === 'pageSize' && event?.type === 'change') { controller.setPageSize(Number(field.value)); controller.refresh() }
    if (key === 'role' && event?.type === 'change') { state.actorRole = field.value; state.selected = null; controller.refresh(); refreshOverlays() }
    return true
  }
  const node = target.closest<HTMLElement>('[data-wls-finished-inbound-action]'), name = node?.dataset.wlsFinishedInboundAction
  if (!node || !name) return false
  if (state.busy) return true
  if (name === 'save') { save(); return true }
  if (name === 'image') { state.image = { url: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '' }; refreshOverlays(); return true }
  if (name === 'close-image') { state.image = null; refreshOverlays(); return true }
  if (name === 'open') { state.selected = state.rows.find(r => r.outboundOrderNo === node.dataset.orderNo) || null; state.quantities = {}; state.authorizationCode = ''; state.reason = ''; state.feedback = ''; refreshOverlays(); feedback(); return true }
  if (name === 'close') { state.selected = null; refreshOverlays(); return true }
  if (name === 'query' || name === 'reload') { if (name === 'reload') { state.rows = listPostFinishingFullFlowOutboundOrders(); const e = root()?.querySelector('[data-finished-inbound-stats]'); if (e) e.innerHTML = stats() }; state.currentPage = 1; controller.refresh(); return true }
  if (name === 'page-size') { controller.setPageSize(Number((target as HTMLSelectElement).value)); controller.refresh(); return true }
  if (name === 'prev-page' || name === 'next-page') controller.stepPage(name === 'prev-page' ? -1 : 1)
  if (name === 'sort-column') controller.cycleSort(node.dataset.columnKey || '')
  if (name === 'open-column-settings') state.showColumnSettings = true
  if (name === 'close-column-settings') state.showColumnSettings = false
  if (name === 'restore-column-settings') controller.restorePreferences()
  if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') controller.updateColumnPreference(name, node.dataset.wlsFinishedInboundColumnKey || '', (node as HTMLInputElement).checked)
  controller.refresh(); refreshOverlays(); return true
}
