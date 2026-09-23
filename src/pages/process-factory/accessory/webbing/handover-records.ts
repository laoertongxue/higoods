// @page-pattern: list
import { buildUnifiedPrintPreviewLink } from '../../../../data/fcs/print-service.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState } from '../../../../data/pms/tmf-material-purchases.ts'
import { ensureTmfConnectedMockData } from '../../../../data/fcs/tmf-base-demo.ts'

const prefix = 'tmf-handover-records', selector = '[data-tmf-handover-records]'
const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
const action = (name: string, label: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`

interface Row { id: string; kind: '基础半成品' | '加工产出' | '连续余料'; source: string; material: string; target: string; dispatched: number; received: number; unit: string; at: string; status: string; workOrderId?: string; packageId?: string }
function rows(): Row[] {
  const data = getTmfPurchaseState()
  const base: Row[] = data.handovers.map((handover) => ({ id: handover.id, kind: '基础半成品', source: handover.purchaseOrderNo, material: handover.materialSkuId, target: handover.warehouseId, dispatched: handover.dispatchedMeters, received: handover.receivedMeters, unit: '米', at: handover.dispatchedAt, status: handover.receivedMeters >= handover.dispatchedMeters ? '已收齐' : handover.receivedMeters > 0 ? '部分实收' : '待实收' }))
  const output: Row[] = data.outputHandovers.map((handover) => {
    const pkg = data.packages.find((item) => item.id === handover.packageId)
    const demand = data.demands.find((item) => item.id === pkg?.demandId)
    const workOrderId = demand ? JSON.stringify([demand.productionOrderId, demand.techPackSnapshotId, demand.routeEntryId]) : undefined
    return { id: handover.id, kind: '加工产出', source: demand?.productionOrderNo ?? handover.packageId, material: pkg?.materialSkuId ?? '待核对', target: handover.warehouseId, dispatched: handover.dispatchedPieces, received: handover.receivedPieces, unit: pkg?.unit ?? '条', at: handover.dispatchedAt, status: handover.receivedPieces >= handover.dispatchedPieces ? '已收齐' : handover.receivedPieces > 0 ? '部分实收' : '待实收', workOrderId, packageId: handover.packageId }
  })
  const returns: Row[] = data.continuousReturns.map((item) => ({ id: item.id, kind: '连续余料', source: `退料 ${item.sourceIssueId}`, material: item.materialSkuId, target: item.warehouseId, dispatched: item.dispatchedMeters, received: item.receivedMeters, unit: '米', at: item.dispatchedAt, status: item.receivedMeters >= item.dispatchedMeters ? '已收齐' : item.receivedMeters > 0 ? '部分实收' : '待实收' }))
  return [...base, ...output, ...returns]
}
const filtered = () => rows().filter((row) => (!state.status || row.status === state.status) && (!state.keyword || [row.id, row.source, row.material, row.target].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const columns: StandardListColumn<Row>[] = [
  { key: 'handover', title: '交出单 / 类型', width: 220, required: true, freezeable: true, sortable: true, sortValue: (r) => r.id, render: (r) => `<div class="font-medium break-all">${e(r.id)}</div><div class="text-xs text-slate-500">${e(r.kind)}</div>` },
  { key: 'source', title: '来源', width: 180, render: (r) => e(r.source) },
  { key: 'material', title: '物料', width: 200, required: true, render: (r) => `<div class="break-all">${e(r.material)}</div>` },
  { key: 'target', title: '去向', width: 160, render: (r) => e(r.target) },
  { key: 'quantity', title: '交出 / 实收', width: 150, required: true, render: (r) => `${r.dispatched} / ${r.received} ${e(r.unit)}` },
  { key: 'status', title: '状态', width: 100, render: (r) => r.status },
  { key: 'at', title: '交出时间', width: 170, sortable: true, sortValue: (r) => r.at, render: (r) => e(r.at) },
  { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: (r) => `${r.kind === '加工产出' ? `<button type="button" class="rounded border px-2 py-1.5 text-xs" data-nav="${e(buildUnifiedPrintPreviewLink({ documentType: 'TMF_HANDOVER_SHEET', sourceType: 'TMF_OUTPUT_HANDOVER', sourceId: r.id }))}">交出单打印</button>` : ''}${r.workOrderId ? `<button class="rounded border px-2 py-1.5 text-xs" data-nav="/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(r.workOrderId)}?packageId=${encodeURIComponent(r.packageId ?? '')}">加工单</button>` : ''}` },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/fcs/craft/accessory/webbing/handover-records', eventPrefix: prefix, rootSelector: selector, tableSurfaceSelector: '[data-tmf-handover-table]', paginationSurfaceSelector: '[data-tmf-handover-pagination]', overlaysSurfaceSelector: '[data-tmf-handover-columns]', getRows: filtered, locallyManagedEvents: true, pageSizeOptions: [10, 20, 50], defaultFrozenKeys: ['handover'], columnSettingsTitle: '交出记录列设置', emptyText: '暂无基础半成品、加工产出或连续余料的交出记录。' })
const stats = () => renderStandardListStats([{ label: '交出单', value: `${filtered().length} 单` }, { label: '待实收', value: `${filtered().filter((r) => r.status !== '已收齐').length} 单` }, { label: '加工产出', value: `${filtered().filter((r) => r.kind === '加工产出').length} 单` }])
const root = () => document.querySelector<HTMLElement>(selector)
function refresh() { controller.refresh({ overlays: true }); const el = root(); if (!el) return; el.querySelector('[data-tmf-handover-stats]')!.innerHTML = stats(); const title = el.querySelector('[data-standard-list-table-section] > header h2'); if (title) title.textContent = `交出记录 · ${filtered().length} 单` }
function bind() {
  const el = root(); if (!el || el.dataset.bound) return; el.dataset.bound = 'true'
  controller.installColumnDragEvents()
  el.addEventListener('change', (event) => { const field = event.target as HTMLSelectElement; if (field.getAttribute(`data-${prefix}-field`) === 'pageSize') { controller.setPageSize(Number(field.value)); refresh() } })
  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
    event.stopPropagation()
    const name = target.getAttribute(`data-${prefix}-action`)!
    try {
      if (name === 'query') { state.keyword = el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim(); state.status = el.querySelector<HTMLSelectElement>('[name="status"]')!.value; state.currentPage = 1; refresh() }
      else if (name === 'reset') { state.keyword = state.status = ''; el.querySelector<HTMLInputElement>('[name="keyword"]')!.value = ''; el.querySelector<HTMLSelectElement>('[name="status"]')!.value = ''; state.currentPage = 1; state.sort = null; refresh() }
      else if (name === 'export') exportStandardListRows({ fileName: '织带交出记录', columns, rows: filtered() })
      else if (name === 'prev-page' || name === 'next-page') { controller.stepPage(name === 'prev-page' ? -1 : 1); refresh() }
      else if (name === 'sort-column') { controller.cycleSort(target.dataset.columnKey || ''); refresh() }
      else if (name === 'open-column-settings' || name === 'close-column-settings') { state.showColumnSettings = name === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
      else if (name === 'restore-column-settings') { controller.restorePreferences(); refresh() }
      else if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { controller.updateColumnPreference(name, target.getAttribute(`data-${prefix}-column-key`) || target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '', target instanceof HTMLInputElement ? target.checked : undefined); refresh() }
    } catch (error) { const feedback = el.querySelector('[data-tmf-handover-feedback]'); if (feedback) feedback.textContent = error instanceof Error ? error.message : '操作失败，请重试。' }
  })
}
export function renderTmfHandoverRecordsPage(): string {
  ensureTmfConnectedMockData()
  state.currentPage = 1; state.sort = null
  controller.ensurePreferencesLoaded(); const view = controller.getView()
  if (typeof window !== 'undefined') requestAnimationFrame(bind)
  return `<div data-tmf-handover-records>${renderStandardListPage({ title: '织带／绳子交出记录', primaryActionsHtml: `<div class="flex gap-2 items-center"><span class="text-xs text-slate-500">TMF - 辅料厂 · 主管演示身份</span><button class="rounded border px-3 py-1.5 text-sm" data-nav="/fcs/craft/accessory/webbing/work-orders">织带加工单</button></div>`, feedbackHtml: '<p role="status" data-tmf-handover-feedback class="text-sm text-blue-700"></p>', filtersHtml: `<div class="rounded-lg border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">交出单 / 来源 / 物料 / 去向<input name="keyword" value="${e(state.keyword)}" class="block rounded border p-2 mt-1 w-72 text-sm"></label><label class="text-xs">接收状态<select name="status" class="block rounded border p-2 mt-1 text-sm"><option value="">全部</option>${['待实收', '部分实收', '已收齐'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${action('query', '查询')}${action('reset', '重置')}${action('export', '导出')}</div></div>`, statsHtml: `<div data-tmf-handover-stats>${stats()}</div>`, listTitle: `交出记录 · ${filtered().length} 单`, listActionsHtml: action('open-column-settings', '列设置'), tableHtml: `<div data-tmf-handover-table>${view.tableHtml}</div>`, paginationHtml: `<div data-tmf-handover-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-tmf-handover-columns>${controller.renderColumnSettings()}</div>` })}</div>`
}
