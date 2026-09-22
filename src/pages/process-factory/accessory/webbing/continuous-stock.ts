// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState, type TmfContinuousLot } from '../../../../data/pms/tmf-material-purchases.ts'
import { resolveTmfDyeOutputReference, TMF_REFERENCE_IMAGES } from '../../../../data/fcs/tmf-reference-images.ts'

const prefix = 'tmf-continuous-stock', selector = '[data-tmf-continuous-stock]'
const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
const action = (name: string, label: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
const round = (value: number) => Math.round(value * 1000) / 1000

interface Row { lot: TmfContinuousLot; source: string; kind: string; available: number; status: string; imageUrl: string }
function rows(): Row[] {
  const data = getTmfPurchaseState()
  return data.lots.map((lot) => {
    const purchase = data.orders.find((item) => item.purchaseOrderNo === lot.sourcePurchaseOrderNo)
    const available = round(lot.onHandMeters - lot.reservedMeters - lot.frozenMeters)
    const imageUrl = purchase?.materialImageUrl || (/CBL|PATTERN|P\d/i.test(lot.materialSkuId) ? resolveTmfDyeOutputReference(lot.materialSkuId) : TMF_REFERENCE_IMAGES.webbingRealBox)
    return { lot, source: lot.receiptKind === 'PROCESS_RETURN' ? `加工余料回仓 ${lot.sourceHandoverId}` : `采购 ${lot.sourcePurchaseOrderNo}`, kind: lot.receiptKind === 'PROCESS_RETURN' ? '加工回料' : '基础采购', available,
      status: lot.frozenMeters > 0 ? '冻结' : available > 0.000001 ? (lot.reservedMeters > 0 ? '有占用' : '有可用') : lot.onHandMeters > 0 ? '已占满' : '已发完', imageUrl }
  })
}
const filtered = () => rows().filter((row) => (!state.status || row.status === state.status) && (!state.keyword || [row.lot.id, row.lot.materialSkuId, row.source, row.lot.location].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const columns: StandardListColumn<Row>[] = [
  { key: 'lot', title: '批次 / 来源', width: 230, required: true, freezeable: true, sortable: true, sortValue: (r) => r.lot.id, render: (r) => `<div class="font-medium break-all">${e(r.lot.id)}</div><div class="text-xs text-slate-500">${e(r.kind)} · ${e(r.source)}</div>` },
  { key: 'material', title: '物料', width: 260, required: true, render: (r) => `<div class="flex gap-2 items-center"><button type="button" data-${prefix}-action="image" data-id="${e(r.lot.id)}" data-skip-page-rerender="true"><img class="h-12 w-12 rounded border object-cover" src="${e(r.imageUrl)}" alt="${e(r.lot.materialSkuId)}连续料参考图"></button><div><div class="break-all">${e(r.lot.materialSkuId)}</div><div class="text-xs text-amber-700">参考图；颜色/花型以技术包为准</div></div></div>` },
  { key: 'location', title: '仓库 / 库位', width: 200, required: true, render: (r) => `${e(r.lot.warehouseId)} / ${e(r.lot.location)}` },
  { key: 'stock', title: '实收 / 实存 / 占用 / 冻结', width: 230, required: true, render: (r) => `${round(r.lot.receivedMeters)} / ${round(r.lot.onHandMeters)} / ${round(r.lot.reservedMeters)} / ${round(r.lot.frozenMeters)} 米` },
  { key: 'available', title: '可分配', width: 120, required: true, render: (r) => `${r.available} 米` },
  { key: 'status', title: '状态', width: 100, render: (r) => r.status },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true, render: (r) => action('detail', '批次详情', r.lot.id) },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/wls/accessory-continuous-stock', eventPrefix: prefix, rootSelector: selector, tableSurfaceSelector: '[data-tmf-continuous-table]', paginationSurfaceSelector: '[data-tmf-continuous-pagination]', overlaysSurfaceSelector: '[data-tmf-continuous-columns]', getRows: filtered, locallyManagedEvents: true, pageSizeOptions: [10, 20, 50], defaultFrozenKeys: ['lot'], columnSettingsTitle: '半成品库存列设置', emptyText: '暂无织带／绳子半成品批次库存。' })
const stats = () => renderStandardListStats([{ label: '批次数', value: `${filtered().length} 批` }, { label: '仓内实存', value: `${round(filtered().reduce((n, r) => n + r.lot.onHandMeters, 0))} 米` }, { label: '已占用', value: `${round(filtered().reduce((n, r) => n + r.lot.reservedMeters, 0))} 米` }])
const root = () => document.querySelector<HTMLElement>(selector)
function refresh() { controller.refresh({ overlays: true }); const el = root(); if (!el) return; el.querySelector('[data-tmf-continuous-stats]')!.innerHTML = stats(); const title = el.querySelector('[data-standard-list-table-section] > header h2'); if (title) title.textContent = `半成品库存 · ${filtered().length} 批` }
function open(id: string) {
  const row = rows().find((item) => item.lot.id === id); if (!row) throw new Error('批次已不存在，请刷新核对。')
  const data = getTmfPurchaseState()
  const events = data.operations.filter((operation) => [row.lot.id, row.lot.sourceHandoverId, row.lot.sourcePurchaseOrderNo].includes(operation.objectId)).slice(-12).reverse()
  const content = `<div class="max-h-[60vh] overflow-y-auto space-y-2 text-sm"><p class="break-all">批次 ${e(row.lot.id)}；${e(row.kind)}；来源 ${e(row.source)}</p><p>${e(row.lot.materialSkuId)} · ${e(row.lot.warehouseId)} / ${e(row.lot.location)}</p><p>实收 ${round(row.lot.receivedMeters)} 米；实存 ${round(row.lot.onHandMeters)} 米；占用 ${round(row.lot.reservedMeters)} 米；冻结 ${round(row.lot.frozenMeters)} 米；可分配 ${row.available} 米</p><p class="text-xs text-slate-500">占用是实存的子集，不从物理库存重复扣减；连续料不能直接充当定长条料。</p><h3 class="font-medium pt-2">最近操作</h3>${events.map((operation) => `<p class="text-xs">${e(operation.occurredAt)} · ${e(operation.action)} · ${e(operation.actor.name)} ${operation.quantity ?? ''} ${e(operation.unit ?? '')}</p>`).join('') || '<p class="text-xs text-slate-500">暂无相关操作记录。</p>'}</div>`
  const el = root()!.querySelector('[data-tmf-continuous-dialog]')!
  el.innerHTML = renderDialog({ title: '半成品批次详情', width: 'md', closeAction: { prefix, action: 'close', skipPageRerender: true } }, content, action('close', '关闭'))
  hydrateIcons(el); el.setAttribute('tabindex', '-1'); (el as HTMLElement).focus({ preventScroll: true })
}
function bind() {
  const el = root(); if (!el || el.dataset.bound) return; el.dataset.bound = 'true'
  controller.installColumnDragEvents()
  el.addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) { const text = document.createElement('span'); text.textContent = '图片加载失败'; text.className = 'text-amber-700 text-xs'; event.target.replaceWith(text) } }, true)
  el.addEventListener('change', (event) => { const field = event.target as HTMLSelectElement; if (field.getAttribute(`data-${prefix}-field`) === 'pageSize') { controller.setPageSize(Number(field.value)); refresh() } })
  el.addEventListener('keydown', (event) => { if (event.key === 'Escape') { el.querySelector('[data-tmf-continuous-dialog]')!.innerHTML = ''; state.showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }) } })
  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
    event.stopPropagation()
    const name = target.getAttribute(`data-${prefix}-action`)!
    try {
      if (name === 'query') { state.keyword = el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim(); state.status = el.querySelector<HTMLSelectElement>('[name="status"]')!.value; state.currentPage = 1; refresh() }
      else if (name === 'reset') { state.keyword = state.status = ''; el.querySelector<HTMLInputElement>('[name="keyword"]')!.value = ''; el.querySelector<HTMLSelectElement>('[name="status"]')!.value = ''; state.currentPage = 1; state.sort = null; refresh() }
      else if (name === 'export') exportStandardListRows({ fileName: '织带半成品库存', columns, rows: filtered() })
      else if (name === 'prev-page' || name === 'next-page') { controller.stepPage(name === 'prev-page' ? -1 : 1); refresh() }
      else if (name === 'sort-column') { controller.cycleSort(target.dataset.columnKey || ''); refresh() }
      else if (name === 'open-column-settings' || name === 'close-column-settings') { state.showColumnSettings = name === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
      else if (name === 'restore-column-settings') { controller.restorePreferences(); refresh() }
      else if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { controller.updateColumnPreference(name, target.getAttribute(`data-${prefix}-column-key`) || target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '', target instanceof HTMLInputElement ? target.checked : undefined); refresh() }
      else if (name === 'detail') open(target.dataset.id || '')
      else if (name === 'close') el.querySelector('[data-tmf-continuous-dialog]')!.innerHTML = ''
      else if (name === 'close-image') el.querySelector('[data-tmf-continuous-image]')!.innerHTML = ''
      else if (name === 'image') { const row = rows().find((item) => item.lot.id === target.dataset.id); if (row) el.querySelector('[data-tmf-continuous-image]')!.innerHTML = `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative rounded bg-white p-3"><p>${e(row.lot.materialSkuId)} ${action('close-image', '关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(row.imageUrl)}" alt="${e(row.lot.materialSkuId)}连续料参考图"><p class="text-xs text-slate-500 mt-2">参考图（厂商/公共来源）；实物以技术包与批次记录为准</p></div></div>` }
    } catch (error) { const feedback = el.querySelector('[data-tmf-continuous-feedback]'); if (feedback) feedback.textContent = error instanceof Error ? error.message : '操作失败，请重试。' }
  })
}
export function renderTmfContinuousStockPage(): string {
  state.currentPage = 1; state.sort = null
  controller.ensurePreferencesLoaded(); const view = controller.getView()
  if (typeof window !== 'undefined') requestAnimationFrame(bind)
  return `<div data-tmf-continuous-stock>${renderStandardListPage({ title: '织带／绳子半成品库存', primaryActionsHtml: `<div class="flex gap-2 items-center"><span class="text-xs text-slate-500">辅料仓 · 仓管演示身份</span><button class="rounded border px-3 py-1.5 text-sm" data-nav="/wls/accessory-material-preparation">连续料备料</button></div>`, feedbackHtml: '<p role="status" data-tmf-continuous-feedback class="text-sm text-blue-700"></p>', filtersHtml: `<div class="rounded-lg border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">批次 / 物料 / 来源 / 库位<input name="keyword" value="${e(state.keyword)}" class="block rounded border p-2 mt-1 w-72 text-sm"></label><label class="text-xs">库存状态<select name="status" class="block rounded border p-2 mt-1 text-sm"><option value="">全部</option>${['有可用', '有占用', '已占满', '已发完', '冻结'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${action('query', '查询')}${action('reset', '重置')}${action('export', '导出')}</div></div>`, statsHtml: `<div data-tmf-continuous-stats>${stats()}</div>`, listTitle: `半成品库存 · ${filtered().length} 批`, listActionsHtml: action('open-column-settings', '列设置'), tableHtml: `<div data-tmf-continuous-table>${view.tableHtml}</div>`, paginationHtml: `<div data-tmf-continuous-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-tmf-continuous-columns>${controller.renderColumnSettings()}</div><div data-tmf-continuous-dialog></div><div data-tmf-continuous-image></div>` })}</div>`
}
