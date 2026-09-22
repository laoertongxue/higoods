// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import {
  getTmfProcessingInputBalance, getTmfPurchaseState, receiveTmfDyeMaterial, receiveTmfPrintMaterial, receiveTmfProcessingMaterial,
  type TmfProcessingMaterialIssue, type TmfPurchaseActor,
} from '../../../../data/pms/tmf-material-purchases.ts'

const prefix = 'tmf-pending-receipts', selector = '[data-tmf-pending-receipts]'
const actor: TmfPurchaseActor = { id: 'TMF-DEMO-SUPERVISOR', name: '织带厂主管（演示）', role: '织带厂主管' }
const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
const action = (name: string, label: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs ${name === 'confirm' ? 'bg-blue-600 text-white' : ''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`

interface Row { issue: TmfProcessingMaterialIssue; orderNo: string; processName: string; upstreamNo: string; dispatched: number; received: number; remaining: number }
function rows(): Row[] {
  const data = getTmfPurchaseState()
  return data.processingIssues.filter((issue) => issue.targetFactoryId === 'FAC-TMF').map((issue) => {
    const demand = data.demands.find((item) => item.id === issue.demandId)
    const received = issue.printHandover || issue.dyeHandover ? getTmfProcessingInputBalance(issue.id).receivedMeters : issue.receivedMeters
    return { issue, orderNo: demand?.productionOrderNo ?? '来源待核对', processName: data.cutOutputs.some((item) => item.sourceIssueId === issue.id) ? '已截断' : issue.upstream ? (issue.printHandover ? '印花回料' : issue.dyeHandover ? '染色回料' : '印染首道') : '本厂加工',
      upstreamNo: issue.upstream?.orderNo ?? issue.printHandover?.recordId ?? issue.dyeHandover?.recordId ?? issue.reservationId,
      dispatched: issue.dispatchedMeters, received, remaining: Math.round((issue.dispatchedMeters - received) * 1000) / 1000 }
  })
}
const filtered = () => rows().filter((row) => (!state.status || (state.status === '待接收' ? row.received === 0 : state.status === '部分接收' ? row.received > 0 && row.remaining > 0 : row.remaining === 0))
  && (!state.keyword || [row.orderNo, row.issue.materialSkuId, row.issue.id, row.upstreamNo].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const columns: StandardListColumn<Row>[] = [
  { key: 'source', title: '生产单 / 上游', width: 230, required: true, freezeable: true, sortable: true, sortValue: (r) => r.orderNo, render: (r) => `<div class="font-medium">${e(r.orderNo)}</div><div class="text-xs text-slate-500 break-all">${e(r.processName)} · ${e(r.upstreamNo)}</div><div class="text-xs text-slate-500 break-all">投入 ${e(r.issue.id)}</div>` },
  { key: 'material', title: '物料', width: 200, required: true, render: (r) => `<div class="break-all">${e(r.issue.materialSkuId)}</div><div class="text-xs text-slate-500">批次 ${e(r.issue.lotId)}</div>` },
  { key: 'quantity', title: '上游发出 / 已收 / 未收', width: 210, required: true, render: (r) => `${r.dispatched} / ${r.received} / ${r.remaining} 米` },
  { key: 'status', title: '状态', width: 110, render: (r) => r.remaining === 0 ? '已收齐' : r.received > 0 ? '部分接收' : '待接收' },
  { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true, render: (r) => r.remaining > 0 ? action('receive', '登记实收', r.issue.id) : '<span class="text-xs text-slate-400">已完成</span>' },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/fcs/craft/accessory/webbing/pending-receipts', eventPrefix: prefix, rootSelector: selector, tableSurfaceSelector: '[data-tmf-pending-table]', paginationSurfaceSelector: '[data-tmf-pending-pagination]', overlaysSurfaceSelector: '[data-tmf-pending-columns]', getRows: filtered, locallyManagedEvents: true, pageSizeOptions: [10, 20, 50], defaultFrozenKeys: ['source'], columnSettingsTitle: '待接收列设置', emptyText: '当前没有等待本厂接收的上游交出。' })
const stats = () => renderStandardListStats([{ label: '待接收', value: `${filtered().filter((r) => r.remaining > 0).length} 单` }, { label: '未收米数', value: `${Math.round(filtered().reduce((n, r) => n + r.remaining, 0) * 1000) / 1000} 米` }, { label: '已收齐', value: `${filtered().filter((r) => r.remaining === 0).length} 单` }])
const root = () => document.querySelector<HTMLElement>(selector)
let selected = '', operationId = ''
function refresh() { controller.refresh({ overlays: true }); const el = root(); if (!el) return; el.querySelector('[data-tmf-pending-stats]')!.innerHTML = stats(); const title = el.querySelector('[data-standard-list-table-section] > header h2'); if (title) title.textContent = `待接收 · ${filtered().length} 单` }
function open(issueId: string) {
  const row = rows().find((item) => item.issue.id === issueId); if (!row) throw new Error('投入不存在，请刷新核对。')
  selected = issueId; operationId = `${prefix}:${crypto.randomUUID()}`
  const kind = row.issue.printHandover ? '印花回料' : row.issue.dyeHandover ? '染色回料' : '印染首道'
  const content = `<div class="space-y-2 text-sm"><p>${e(row.orderNo)} · ${e(kind)} · 投入 ${e(row.issue.id)}</p><p>${e(row.issue.materialSkuId)} · 上游发出 ${row.dispatched} 米；已收 ${row.received} 米；未收 ${row.remaining} 米</p><label class="block">本次实际接收（米）<input name="quantity" type="number" min="0.001" step="0.001" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"></label><label class="block">实收身份<select name="role" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"><option value="织带厂主管">织带厂主管</option><option value="织带厂员工">织带厂员工</option></select></label><p class="text-xs text-slate-500">实收以原交出记录为唯一数量事实；分批接收，未到部分保留在途。</p><p role="alert" class="text-red-700" data-tmf-pending-error></p></div>`
  const el = root()!.querySelector('[data-tmf-pending-dialog]')!
  el.innerHTML = renderDialog({ title: '登记投入实收', width: 'md', closeAction: { prefix, action: 'close', skipPageRerender: true } }, content, action('close', '关闭') + action('confirm', '确认实收'))
  hydrateIcons(el); el.setAttribute('tabindex', '-1'); (el as HTMLElement).focus({ preventScroll: true })
}
function bind() {
  const el = root(); if (!el || el.dataset.bound) return; el.dataset.bound = 'true'
  controller.installColumnDragEvents()
  el.addEventListener('change', (event) => { const field = event.target as HTMLSelectElement; if (field.getAttribute(`data-${prefix}-field`) === 'pageSize') { controller.setPageSize(Number(field.value)); refresh() } })
  el.addEventListener('keydown', (event) => { if (event.key === 'Escape') { const image = el.querySelector('[data-tmf-pending-image]'); if (image?.innerHTML) { image.innerHTML = ''; return } el.querySelector('[data-tmf-pending-dialog]')!.innerHTML = ''; state.showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }) } })
  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
    event.stopPropagation()
    const name = target.getAttribute(`data-${prefix}-action`)!
    try {
      if (name === 'query') { state.keyword = el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim(); state.status = el.querySelector<HTMLSelectElement>('[name="status"]')!.value; state.currentPage = 1; refresh() }
      else if (name === 'reset') { state.keyword = state.status = ''; el.querySelector<HTMLInputElement>('[name="keyword"]')!.value = ''; el.querySelector<HTMLSelectElement>('[name="status"]')!.value = ''; state.currentPage = 1; state.sort = null; refresh() }
      else if (name === 'export') exportStandardListRows({ fileName: '织带待接收', columns, rows: filtered() })
      else if (name === 'prev-page' || name === 'next-page') { controller.stepPage(name === 'prev-page' ? -1 : 1); refresh() }
      else if (name === 'sort-column') { controller.cycleSort(target.dataset.columnKey || ''); refresh() }
      else if (name === 'open-column-settings' || name === 'close-column-settings') { state.showColumnSettings = name === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
      else if (name === 'restore-column-settings') { controller.restorePreferences(); refresh() }
      else if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { controller.updateColumnPreference(name, target.getAttribute(`data-${prefix}-column-key`) || target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '', target instanceof HTMLInputElement ? target.checked : undefined); refresh() }
      else if (name === 'receive') open(target.dataset.id || '')
      else if (name === 'close') el.querySelector('[data-tmf-pending-dialog]')!.innerHTML = ''
      else if (name === 'confirm') {
        const row = rows().find((item) => item.issue.id === selected); if (!row) throw new Error('投入不存在，请刷新核对。')
        const quantity = Number(el.querySelector<HTMLInputElement>('[data-tmf-pending-dialog] [name="quantity"]')!.value)
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > row.remaining) throw new Error(`本次实收须为 0～${row.remaining} 米之间的正数。`)
        const role = el.querySelector<HTMLSelectElement>('[data-tmf-pending-dialog] [name="role"]')!.value === '织带厂员工' ? '织带厂员工' : '织带厂主管'
        const receiptActor: TmfPurchaseActor = { ...actor, role }
        const issue = row.issue
        if (issue.dyeHandover) void receiveTmfDyeMaterial({ issueId: issue.id, materialSkuId: issue.materialSkuId, receivedMeters: quantity }, receiptActor, operationId).then(() => { refresh(); el.querySelector('[data-tmf-pending-dialog]')!.innerHTML = '' })
        else if (issue.printHandover) void receiveTmfPrintMaterial({ issueId: issue.id, materialSkuId: issue.materialSkuId, receivedMeters: quantity }, receiptActor, operationId).then(() => { refresh(); el.querySelector('[data-tmf-pending-dialog]')!.innerHTML = '' })
        else { receiveTmfProcessingMaterial({ issueId: issue.id, factoryId: 'FAC-TMF', materialSkuId: issue.materialSkuId, receivedMeters: quantity }, receiptActor, operationId); refresh(); el.querySelector('[data-tmf-pending-dialog]')!.innerHTML = '' }
      }
    } catch (error) { const feedback = el.querySelector('[data-tmf-pending-error]') ?? el.querySelector('[data-tmf-pending-feedback]'); if (feedback) feedback.textContent = error instanceof Error ? error.message : '保存失败，请重试。' }
  })
}
export function renderTmfPendingReceiptsPage(): string {
  state.currentPage = 1; state.sort = null
  controller.ensurePreferencesLoaded(); const view = controller.getView()
  if (typeof window !== 'undefined') requestAnimationFrame(bind)
  return `<div data-tmf-pending-receipts>${renderStandardListPage({ title: '织带／绳子待接收', primaryActionsHtml: `<div class="flex gap-2 items-center"><span class="text-xs text-slate-500">TMF - 辅料厂 · 主管演示身份</span><button class="rounded border px-3 py-1.5 text-sm" data-nav="/fcs/craft/accessory/webbing/work-orders">生产加工单</button></div>`, feedbackHtml: '<p role="status" data-tmf-pending-feedback class="text-sm text-blue-700"></p>', filtersHtml: `<div class="rounded-lg border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">生产单 / 投入单 / 物料 / 上游<input name="keyword" value="${e(state.keyword)}" class="block rounded border p-2 mt-1 w-72 text-sm"></label><label class="text-xs">接收状态<select name="status" class="block rounded border p-2 mt-1 text-sm"><option value="">全部</option>${['待接收', '部分接收', '已收齐'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${action('query', '查询')}${action('reset', '重置')}${action('export', '导出')}</div></div>`, statsHtml: `<div data-tmf-pending-stats>${stats()}</div>`, listTitle: `待接收 · ${filtered().length} 单`, listActionsHtml: action('open-column-settings', '列设置'), tableHtml: `<div data-tmf-pending-table>${view.tableHtml}</div>`, paginationHtml: `<div data-tmf-pending-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-tmf-pending-columns>${controller.renderColumnSettings()}</div><div data-tmf-pending-dialog></div><div data-tmf-pending-image></div>` })}</div>`
}
