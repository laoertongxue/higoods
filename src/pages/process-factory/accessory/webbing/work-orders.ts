// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { renderBadge } from '../../../../components/ui/badge.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { listTmfWorkOrders } from '../../../../data/fcs/tmf-work-order-view.ts'
import { buildUnifiedPrintPreviewLink } from '../../../../data/fcs/print-service.ts'
import { getTmfProcessingInputBalance, getTmfPurchaseState, getTmfWorkCost } from '../../../../data/pms/tmf-material-purchases.ts'
import { appStore } from '../../../../state/store.ts'

const prefix = 'tmf-work-orders'
const selector = '[data-tmf-work-orders]'
const state: ProcessOrderListControllerState & { keyword: string; status: string; selectedIds: Set<string> } = {
  currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '', selectedIds: new Set(),
}
const action = (name: string, label: string) => `<button class="rounded border px-3 py-2 text-sm" data-${prefix}-action="${name}" data-skip-page-rerender="true">${label}</button>`
const field = (label: string, value: string) => `<div class="leading-5"><span class="text-slate-500">${e(label)}：</span>${value}</div>`
const endMethod = (value: string) => ({ NONE: '无', METAL: '金属头', PLASTIC_WRAP: '塑料包头', SILICONE_DIP: '硅胶浸头' }[value] ?? '待核对')

type Row = ReturnType<typeof listTmfWorkOrders>[number]
const allRows = () => listTmfWorkOrders()
const rows = () => allRows().filter((order) => {
  const text = [order.id, order.productionOrderNo, order.versionId, order.material?.materialName, ...order.demands.map((d) => d.materialSkuId)].join(' ').toLowerCase()
  const axes = `${order.receiptStatus}/${order.processingStatus}/${order.handoverStatus}`
  return (!state.keyword || text.includes(state.keyword.toLowerCase())) && (!state.status || axes.includes(state.status))
})

function detailPath(order: Row, tab = ''): string {
  return `/fcs/craft/accessory/webbing/work-orders/${encodeURIComponent(order.id)}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`
}

function statusTone(label: string): 'success' | 'warning' | 'info' | 'neutral' {
  if (/已接收|达量|已交出/.test(label)) return 'success'
  if (/部分|加工中/.test(label)) return 'info'
  if (/待|未/.test(label)) return 'warning'
  return 'neutral'
}

const columns: StandardListColumn<Row>[] = [
  { key: 'selection', title: '选择', width: 64, required: true, leadingControlColumn: true, render: order => `<input type="checkbox" aria-label="选择 ${e(order.workOrderNo)}" ${state.selectedIds.has(order.id) ? 'checked' : ''} data-${prefix}-action="toggle-selection" data-id="${e(order.id)}" data-skip-page-rerender="true">` },
  {
    key: 'order', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: order => order.workOrderNo,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><section class="space-y-1 pb-3">${field('加工厂','TMF - 辅料厂')}<div><span class="text-slate-500">织带加工单：</span><button class="font-medium text-blue-700 hover:underline" data-nav="${e(detailPath(order))}">${e(order.workOrderNo)}</button></div>${field('生产单',e(order.productionOrderNo))}${field('技术包',`${e(order.versionId)} · ${e(order.routeEntryId)}`)}</section><section class="flex gap-2 pt-3">${order.material?.materialImageUrl ? `<button data-${prefix}-action="image" data-id="${e(order.id)}"><img class="h-12 w-12 rounded border object-cover" src="${e(order.material.materialImageUrl)}" alt="${e(order.material.materialName)}"></button>` : '<span class="text-amber-700">缺实物图</span>'}<div><div class="font-medium">${e(order.material?.materialName ?? order.demands[0].materialSkuId)}</div><div class="break-all text-slate-500">${e(order.demands[0].materialSkuId)}</div></div></section></div>`,
  },
  {
    key: 'input', title: '加工投入／上游', width: 280, required: true, freezeable: true,
    render: order => `<div class="space-y-3 text-xs">${order.inputs.map((input) => {
      const lot = getTmfPurchaseState().lots.find((item) => item.id === input.lotId)
      const upstream = input.upstream?.orderNo ?? input.dyeHandover?.recordId ?? input.printHandover?.recordId ?? lot?.sourceHandoverId ?? input.reservationId
      const purchase = order.sourcePurchases.find((item) => item.purchaseOrderNo === lot?.sourcePurchaseOrderNo)
      return `<section class="border-b pb-2 last:border-0">${field('投入单',e(input.id))}${field('物料 SKU',e(input.materialSkuId))}${field('上游单据',e(upstream))}${field('来源采购',e(purchase?.purchaseOrderNo ?? '待形成实际投入'))}${field('批次',e(input.lotId))}</section>`
    }).join('') || '<span class="text-amber-700">等待上游交出与备料</span>'}</div>`,
  },
  {
    key: 'requirement', title: '加工要求', width: 260, freezeable: true,
    render: order => `<div class="space-y-2 text-xs">${order.demands.map((demand) => `<section class="border-b pb-2 last:border-0">${field('用途／尺码',`${e(demand.specification.usage)} · ${e(demand.garmentSize)}`)}${field('截断／成品',`${demand.specification.cutLengthMm} / ${demand.specification.finishedLengthMm} mm`)}${field('公差',`±${demand.specification.toleranceMm} mm`)}${field('切割方式',e(demand.specification.cuttingMethod))}${field('端头',demand.specification.tippingRequired ? `${e(endMethod(demand.specification.endA.method))} / ${e(endMethod(demand.specification.endB.method))}` : '无需打头')}</section>`).join('')}</div>`,
  },
  {
    key: 'progress', title: '处理进度', width: 145, required: true, freezeable: true,
    render: order => `<div class="space-y-2"><div><span class="mr-1 text-xs text-slate-500">接收</span>${renderBadge(order.receiptStatus, statusTone(order.receiptStatus))}</div><div><span class="mr-1 text-xs text-slate-500">加工</span>${renderBadge(order.processingStatus, statusTone(order.processingStatus))}</div><div><span class="mr-1 text-xs text-slate-500">交出</span>${renderBadge(order.handoverStatus, statusTone(order.handoverStatus))}</div></div>`,
  },
  {
    key: 'output', title: '加工产出／下游', width: 245, required: true, freezeable: true,
    render: order => `<div class="space-y-2 text-xs">${order.outputs.length ? order.outputs.map((output) => `<section class="border-b pb-2 last:border-0">${field('产出物料',e(output.materialSkuId))}${field('实际长度',`${output.actualFinishedLengthMm ?? '待打头'} mm`)}${field('合格／不良',`${output.goodPieces} / ${output.defectivePieces} ${e(output.unit)}`)}</section>`).join('') : '<span class="text-slate-500">尚未填报产出</span>'}<section class="pt-1">${field('下游',e(order.material?.warehouse ?? '中央辅料仓'))}${field('交出单',e(order.handovers.map((h) => h.id).join('、') || '尚未发起'))}</section></div>`,
  },
  {
    key: 'time', title: '时间', width: 245, freezeable: true, sortable: true,
    sortValue: order => order.demands[0].requiredDeliveryDate ?? '',
    render: order => `<div class="space-y-1 text-xs">${field('要求交期',e(order.demands[0].requiredDeliveryDate ?? '未提供'))}${field('上游交出',e(order.inputs.map((i) => i.dispatchedAt).sort()[0] ?? '尚未交出'))}${field('首次实收',e(order.firstReceivedAt ?? '尚未实收'))}${field('首次／最近填报',`${e(order.firstReportedAt ?? '尚未填报')} / ${e(order.lastReportedAt ?? '尚未填报')}`)}${field('最近发起交出',e(order.lastHandoverAt ?? '尚未交出'))}${field('下游实收',e(order.downstreamReceivedAt ?? '尚未实收'))}</div>`,
  },
  {
    key: 'cost', title: '费用', width: 155, freezeable: true,
    render: order => { const cost = getTmfWorkCost(order.id); return cost ? `<div class="text-xs">${field('单价',`${cost.unitPrice} ${cost.currency}/${e(cost.pricingUnit)}`)}${field('计价量',`${cost.pricingQuantity} ${e(cost.pricingUnit)}`)}${field('预估金额',`${cost.estimatedAmount} ${cost.currency}`)}</div>` : '<span class="text-xs text-amber-700">待维护计价</span>' },
  },
  {
    key: 'quantity', title: '数量', width: 225, freezeable: true, sortable: true, sortValue: order => order.requiredPieces,
    render: order => {
      const dispatched = order.inputs.reduce((sum, input) => sum + input.dispatchedMeters, 0)
      const received = order.inputs.reduce((sum, input) => sum + getTmfProcessingInputBalance(input.id).receivedMeters, 0)
      const completed = order.outputs.reduce((sum, output) => sum + output.goodPieces, 0)
      const handed = order.handovers.reduce((sum, handover) => sum + handover.dispatchedPieces, 0)
      return `<div class="space-y-1 text-xs">${field('计划投入',`${order.demands.reduce((sum, d) => sum + d.theoreticalCutMeters, 0)} 米`)}${field('上游交出',`${dispatched} 米`)}${field('已接收',`${received} 米`)}${field('需求数量',`${order.requiredPieces} 条／根`)}${field('合格产出',`${completed} 条／根`)}${field('交出数量',`${handed} 条／根`)}</div>`
    },
  },
  {
    key: 'actions', title: '操作', width: 170, required: true, actionColumn: true,
    render: order => {
      const hasPendingReceipt = order.inputs.some((input) => getTmfProcessingInputBalance(input.id).receivedMeters < input.dispatchedMeters)
      const hasReceived = order.inputs.some((input) => getTmfProcessingInputBalance(input.id).receivedMeters > 0)
      const handedPackageIds = new Set(order.handovers.map((handover) => handover.packageId))
      const hasDispatchable = order.packages.some((pkg) => !pkg.splitAt && !pkg.warehouseId && !handedPackageIds.has(pkg.id))
      return `<div class="grid grid-cols-2 gap-1">${hasPendingReceipt ? `<button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'inputs'))}">确认接受</button>` : ''}${hasReceived ? `<button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'inputs'))}">加工填报</button>` : ''}${hasDispatchable ? `<button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'packages'))}">发起交出</button>` : ''}<button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order))}">查看</button><button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'times'))}">编辑计划／费用</button><button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'history'))}">日志</button><button class="rounded border px-2 py-1 text-xs" data-nav="${e(buildUnifiedPrintPreviewLink({ documentType: 'TMF_PROCESS_SHEET', sourceType: 'TMF_WORK_ORDER', sourceId: order.id }))}">打印流程卡</button><button class="rounded border px-2 py-1 text-xs" data-nav="${e(detailPath(order,'packages'))}">打印条码</button></div>`
    },
  },
]

const controller = createProcessOrderListController({ state, columns, eventPrefix: prefix, rootSelector: selector,
  preferenceKey: 'higood:list:/fcs/craft/accessory/webbing/work-orders', tableSurfaceSelector: '[data-tmf-work-table]',
  paginationSurfaceSelector: '[data-tmf-work-pagination]', overlaysSurfaceSelector: '[data-tmf-work-columns]', getRows: rows,
  locallyManagedEvents: true, pageSizeOptions: [10, 20, 50], defaultFrozenKeys: ['order'], columnSettingsTitle: '织带加工单列设置', emptyText: '暂无织带加工单。' })
const stats = () => renderStandardListStats([
  { label: '加工单数', value: `${rows().length} 单` },
  { label: '待确认接受', value: `${rows().filter((o) => o.receiptStatus !== '已接收').length} 单` },
  { label: '加工中', value: `${rows().filter((o) => o.processingStatus === '加工中').length} 单` },
  { label: '已发起交出', value: `${rows().filter((o) => o.handovers.length > 0).length} 单` },
])
const root = () => document.querySelector<HTMLElement>(selector)
function refresh() { controller.refresh({ overlays: true }); const el = root(); if (!el) return; el.querySelector('[data-tmf-work-stats]')!.innerHTML = stats() }
function bind() {
  const el = root(); if (!el || el.dataset.bound) return; el.dataset.bound = 'true'; controller.installColumnDragEvents()
  el.addEventListener('input', (event) => event.stopPropagation())
  el.addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) { const span = document.createElement('span'); span.textContent = '图片加载失败'; event.target.replaceWith(span) } }, true)
  el.addEventListener('keydown', (event) => { if (event.key === 'Escape') { el.querySelector('[data-tmf-work-image]')!.innerHTML = ''; state.showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }) } })
  el.addEventListener('change', (event) => { const input = event.target as HTMLInputElement | HTMLSelectElement; if (input.getAttribute(`data-${prefix}-field`) === 'pageSize') { event.stopPropagation(); controller.setPageSize(Number(input.value)); refresh() } else if (input.getAttribute(`data-${prefix}-action`) === 'toggle-selection') { event.stopPropagation(); const id=(input as HTMLInputElement).dataset.id||''; if ((input as HTMLInputElement).checked) state.selectedIds.add(id); else state.selectedIds.delete(id); refresh() } })
  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
    const name = target.getAttribute(`data-${prefix}-action`); event.stopPropagation()
    if (name === 'query') { state.keyword = el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim(); state.status = el.querySelector<HTMLSelectElement>('[name="status"]')!.value; state.currentPage = 1; refresh() }
    else if (name === 'reset') { state.keyword = state.status = ''; el.querySelector<HTMLInputElement>('[name="keyword"]')!.value = ''; el.querySelector<HTMLSelectElement>('[name="status"]')!.value = ''; state.currentPage = 1; state.sort = null; refresh() }
    else if (name === 'export') exportStandardListRows({ fileName: '织带加工单', columns, rows: rows() })
    else if (name === 'batch-print') { if (!state.selectedIds.size) return; appStore.navigate(buildUnifiedPrintPreviewLink({ documentType: 'TMF_PROCESS_SHEET', sourceType: 'TMF_WORK_ORDER', sourceId: JSON.stringify([...state.selectedIds]) })) }
    else if (name === 'prev-page' || name === 'next-page') { controller.stepPage(name === 'prev-page' ? -1 : 1); refresh() }
    else if (name === 'sort-column') { controller.cycleSort(target.dataset.columnKey || ''); refresh() }
    else if (name === 'open-column-settings' || name === 'close-column-settings') { state.showColumnSettings = name === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
    else if (name === 'restore-column-settings') { controller.restorePreferences(); refresh() }
    else if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { controller.updateColumnPreference(name, target.getAttribute(`data-${prefix}-column-key`) || target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '', target instanceof HTMLInputElement ? target.checked : undefined); refresh() }
    else if (name === 'close-image') el.querySelector('[data-tmf-work-image]')!.innerHTML = ''
    else if (name === 'image') { const order = allRows().find((item) => item.id === target.dataset.id); if (order?.material?.materialImageUrl) el.querySelector('[data-tmf-work-image]')!.innerHTML = `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" aria-label="关闭大图"></button><div class="relative rounded bg-white p-3"><button class="mb-2 rounded border px-2 py-1 text-xs" data-${prefix}-action="close-image">关闭</button><img class="max-h-[75vh] max-w-[85vw] object-contain" src="${e(order.material.materialImageUrl)}" alt="${e(order.material.materialName)}"></div></div>` }
  })
}

export function renderTmfWorkOrdersPage() {
  state.currentPage = 1; state.sort = null; controller.ensurePreferencesLoaded(); const view = controller.getView()
  if (typeof window !== 'undefined') requestAnimationFrame(bind)
  return `<div data-tmf-work-orders>${renderStandardListPage({ title: '织带加工单', primaryActionsHtml: '<span class="text-xs text-slate-500">TMF - 辅料厂 · 主管演示身份</span>', feedbackHtml: '<p role="status" data-tmf-work-feedback class="text-sm text-blue-700"></p>', filtersHtml: `<div class="rounded border bg-white p-3"><div class="flex flex-wrap gap-3"><label class="text-xs">加工单 / 生产单 / 技术包 / SKU<input name="keyword" value="${e(state.keyword)}" class="mt-1 block w-80 max-w-full rounded border p-2 text-sm"></label><label class="text-xs">处理进度<select name="status" class="mt-1 block rounded border p-2 text-sm"><option value="">全部</option>${['待接收','部分接收','已接收','待加工填报','加工中','合格产出达量','未交出','部分交出','合格产出已交出'].map((value) => `<option ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`, statsHtml: `<div data-tmf-work-stats>${stats()}</div>`, listTitle: `织带加工单 · ${rows().length} 单`, listActionsHtml: `<div class="flex gap-2">${action('batch-print',`批量打印流程卡（${state.selectedIds.size}）`)}${action('open-column-settings','列设置')}</div>`, tableHtml: `<div data-tmf-work-table>${view.tableHtml}</div>`, paginationHtml: `<div data-tmf-work-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-tmf-work-columns>${controller.renderColumnSettings()}</div><div data-tmf-work-image></div>` })}</div>`
}
