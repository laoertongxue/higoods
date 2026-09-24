// @page-pattern: list
import { renderTmfPurchaseReturns } from './purchase-returns.ts'
import { dispatchTmfPurchaseReturn, receiveTmfPurchaseReturn, resolveTmfBasePurchaseChange } from '../../../../data/pms/tmf-material-purchases.ts'

import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml } from '../../../../utils.ts'
import { getTmfPurchaseState, dispatchTmfBaseMaterial, receiveTmfBaseMaterialReturn, getTmfBaseMaterialBalance, receiveTmfBaseMaterial, consumeTmfBaseMaterial, dispatchTmfBaseMaterialReturn, acceptTmfBaseOrder, reportTmfBaseProduction, dispatchTmfBaseProduction, receiveTmfBaseProduction, type TmfBaseHandover, type TmfPurchaseActor, type TmfMaterialPurchaseOrder, type TmfBaseProductionOrder } from '../../../../data/pms/tmf-material-purchases.ts'
import { TMF_DEMO_SUPERVISOR } from '../../../../data/fcs/tmf-base-demo.ts'

type Mode = 'purchase-demands' | 'semi-finished-orders' | 'base-receipts' | 'raw-warehouse'
type Row = { purchase: TmfMaterialPurchaseOrder; base?: TmfBaseProductionOrder; handover?: TmfBaseHandover; dispatched: number; received: number; status: string }
const pages = new Map<Mode, ReturnType<typeof createPage>>()
const quantityText = (value: number) => `${Math.round(value * 1000) / 1000}`

function createPage(mode: Mode) {
  const rawWarehouse=mode==='raw-warehouse'
  const receiving = mode === 'base-receipts'
  const actor: TmfPurchaseActor = receiving || rawWarehouse ? { id: 'TMF-DEMO-WAREHOUSE-CLERK', name: '辅料仓管（演示）', role: '仓管' } : TMF_DEMO_SUPERVISOR
  const rowId = (row: Row) => row.handover?.id ?? row.purchase.purchaseOrderNo
  const prefix = `tmf-${mode}`
  const rootSelector = `[data-tmf-base-page="${mode}"]`
  const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
  const purchasePage = mode === 'purchase-demands'
  const title = rawWarehouse?'织带基础原料收发':receiving ? '织带／绳子基础半成品收货' : purchasePage ? '织带采购需求' : '半成品加工单'
  const action = (name: string, label: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs ${['query', 'confirm'].includes(name) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-slate-50'}" data-${prefix}-action="${name}" data-id="${escapeHtml(id)}" data-skip-page-rerender="true">${label}</button>`
  const allRows = (): Row[] => {
    const data = getTmfPurchaseState()
    if (receiving) return data.handovers.flatMap((handover) => {
      const purchase = data.orders.find((item) => item.purchaseOrderNo === handover.purchaseOrderNo)
      const base = data.baseOrders.find((item) => item.id === handover.baseOrderId)
      if (!purchase || !base) return []
      return [{ purchase, base, handover, dispatched: handover.dispatchedMeters, received: handover.receivedMeters,
        status: handover.receivedMeters >= handover.dispatchedMeters ? '已收齐' : handover.receivedMeters > 0 ? '部分实收' : '待实收' }]
    })
    return (purchasePage ? data.orders : data.orders.filter((purchase) => purchase.status !== '待采购')).map((purchase) => {
      const base = data.baseOrders.find((item) => item.purchaseLineId === purchase.purchaseLineId)
      const handovers = data.handovers.filter((item) => item.baseOrderId === base?.id)
      const dispatched = handovers.reduce((sum, item) => sum + item.dispatchedMeters, 0)
      const received = handovers.reduce((sum, item) => sum + item.receivedMeters, 0)
      const status = base?.cancelledAt || purchase.status === '已关闭' ? '已终止' : base?.changePending ? '变更待处理' : !base ? '待生成' : !base.acceptedAt ? '待确认接受' : base.producedMeters < base.plannedMeters ? '加工中' : received < dispatched ? '交出待实收' : dispatched < base.producedMeters ? '待交出' : '已收齐'
      return { purchase, base, dispatched, received, status }
    }).filter((row) => mode === 'purchase-demands' || row.base)
  }
  const filteredRows = () => allRows().filter((row) => (!state.keyword || [row.purchase.purchaseOrderNo, row.purchase.materialCode, row.purchase.materialName, row.base?.id, row.handover?.id, row.handover?.batchId].join(' ').toLowerCase().includes(state.keyword.toLowerCase())) && (!state.status || row.status === state.status))
  const legacyColumns: StandardListColumn<Row>[] = [
    { key: 'source', title: receiving ? '交出 / 采购 / 批次' : '采购 / 半成品加工单', width: 245, required: true, freezeable: true, sortable: true, sortValue: (r) => r.purchase.purchaseOrderNo, render: (r) => `<div class="font-medium">${escapeHtml(r.purchase.purchaseOrderNo)}</div>${r.handover ? `<div class="text-xs break-all">交出 ${escapeHtml(r.handover.id)}<br>批次 ${escapeHtml(r.handover.batchId)}</div>` : ''}<div class="mt-1 text-xs text-slate-500 break-all">${escapeHtml(r.base?.id ?? '尚未生成半成品加工单')}</div>` },
    { key: 'material', title: '半成品', width: 275, required: true, render: (r) => `<div class="flex gap-2 items-center">${r.purchase.materialImageUrl ? `<button type="button" data-${prefix}-action="image" data-id="${escapeHtml(rowId(r))}" data-skip-page-rerender="true"><img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(r.purchase.materialImageUrl)}" alt="${escapeHtml(r.purchase.materialName)}"></button>` : '<span class="text-amber-700">缺实物图</span>'}<div><div>${escapeHtml(r.purchase.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.materialCode)}</div></div></div>` },
    { key: 'due', title: '交期', width: 120, sortable: true, sortValue: (r) => r.base?.dueDate ?? r.purchase.expectedArrivalDate, render: (r) => escapeHtml(r.base?.dueDate ?? r.purchase.expectedArrivalDate) },
    { key: 'state', title: '当前进度', width: 115, render: (r) => `<span class="text-sm ${r.status === '变更待处理' ? 'text-amber-700' : ''}">${r.status}</span>` },
    { key: 'quantities', title: receiving ? '交出 / 已实收 / 待实收' : '计划 / 产出 / 交出 / 实收', width: 265, required: true, render: (r) => receiving ? `<div>${r.dispatched} / ${r.received} / ${Math.round((r.dispatched - r.received) * 1000) / 1000} 米</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.warehouse)}</div>` : `<div>${r.base?.plannedMeters ?? r.purchase.orderedQty} / ${r.base?.producedMeters ?? 0} / ${r.dispatched} / ${r.received} 米</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.warehouse)}</div>` },
    { key: 'actions', title: '操作', width: 205, required: true, actionColumn: true, render: (r) => rawWarehouse?`<div class="flex gap-1">${action('raw','原料收发',r.purchase.purchaseOrderNo)}</div>`:receiving ? `<div class="flex gap-1">${action('detail', '详情', rowId(r))}${r.received < r.dispatched ? action('receive', '登记实收', rowId(r)) : ''}</div>` : '' },
  ]
  const f = (label: string, value: string) => `<div class="leading-5"><span class="text-slate-500">${escapeHtml(label)}：</span>${value}</div>`
  const purchaseColumns: StandardListColumn<Row>[] = [
    { key: 'purchase', title: '采购需求', width: 215, required: true, freezeable: true, sortable: true, sortValue: r => r.purchase.purchaseOrderNo, render: r => `<div class="font-semibold">采购单 ${escapeHtml(r.purchase.purchaseOrderNo)}</div><div class="text-xs text-slate-500">V${r.purchase.version} · ${escapeHtml(r.purchase.orderDate)}</div><div class="text-xs">采购员：${escapeHtml(r.purchase.buyerName)}</div>` },
    { key: 'style', title: '款式', width: 210, required: true, render: r => `<div class="flex gap-2 items-center">${r.purchase.styleImageUrl ? `<img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(r.purchase.styleImageUrl)}" alt="${escapeHtml(r.purchase.styleName || r.purchase.styleCode)}">` : '<span class="text-amber-700">缺款式实图</span>'}<div><div>${escapeHtml(r.purchase.styleName || '款式待补齐')}</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.styleCode || '款号待补齐')}</div></div></div>` },
    { key: 'material', title: '织带／绳子 SKU', width: 260, required: true, render: r => `<div class="flex gap-2 items-center"><button data-${prefix}-action="image" data-id="${escapeHtml(rowId(r))}" data-skip-page-rerender="true"><img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(r.purchase.materialImageUrl)}" alt="${escapeHtml(r.purchase.materialName)}"></button><div><div>${escapeHtml(r.purchase.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.materialCode)}</div><div class="text-xs">${escapeHtml(r.purchase.accessoryType)} · ${escapeHtml(r.purchase.productionStandard)}</div></div></div>` },
    { key: 'quantity', title: '采购数量', width: 130, align: 'right', sortable: true, sortValue: r => r.purchase.orderedQty, render: r => `<strong>${r.purchase.orderedQty} 米</strong><div class="text-xs text-slate-500">实收 ${r.purchase.receivedQty} 米</div>` },
    { key: 'delivery', title: '交期／目标仓库', width: 210, sortable: true, sortValue: r => r.purchase.expectedArrivalDate, render: r => `<div>${escapeHtml(r.purchase.expectedArrivalDate)}</div><div class="text-xs text-slate-500">${escapeHtml(r.purchase.warehouse)}</div>` },
    { key: 'factory', title: '采购供应方／生产责任', width: 210, render: r => `<div>采购供应方：${escapeHtml(r.purchase.supplierName)}</div><div class="text-xs text-slate-500">半成品生产责任：TMF - 辅料厂</div>` },
    { key: 'change', title: '采购变更', width: 150, render: r => r.base?.changePending ? '<span class="text-amber-700">变更待处理</span>' : `V${r.purchase.version} · 无待处理变更` },
    { key: 'result', title: '半成品加工单／生成结果', width: 250, render: r => r.base ? `<div class="font-medium break-all">${escapeHtml(r.base.id)}</div><div class="text-xs text-slate-500">${escapeHtml(r.status)}</div>` : '<span class="text-amber-700">等待系统自动生成</span>' },
    { key: 'actions', title: '操作', width: 150, required: true, actionColumn: true, render: r => `<div class="flex flex-col gap-1 items-start">${action('detail', '查看采购来源', r.purchase.purchaseOrderNo)}${r.base ? action('raw', '查看原料账', r.purchase.purchaseOrderNo) : ''}</div>` },
  ]
  const semiColumns: StandardListColumn<Row>[] = [
    { key: 'order', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true, sortValue: r => r.base?.id ?? '', render: r => `<div class="space-y-1 text-xs">${f('加工厂','TMF - 辅料厂')}${f('半成品加工单',`<strong>${escapeHtml(r.base?.id ?? '')}</strong>`)}${f('采购单',escapeHtml(r.purchase.purchaseOrderNo))}<div class="flex gap-2 pt-2"><button data-${prefix}-action="image" data-id="${escapeHtml(rowId(r))}" data-skip-page-rerender="true"><img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(r.purchase.materialImageUrl)}" alt="${escapeHtml(r.purchase.materialName)}"></button><div>${escapeHtml(r.purchase.materialName)}<div class="break-all text-slate-500">${escapeHtml(r.purchase.materialCode)}</div></div></div></div>` },
    { key: 'input', title: '加工投入／上游', width: 300, required: true, render: r => { const data=getTmfPurchaseState(),issues=data.baseMaterialIssues.filter(issue=>issue.baseOrderId===r.base?.id); return `<div class="text-xs space-y-2">${f('上游采购',escapeHtml(r.purchase.purchaseOrderNo))}${f('PMS需求行',`${escapeHtml(r.purchase.requirementNo)} / ${escapeHtml(r.purchase.sourceRequirementLineNo)}`)}${issues.map(issue=>{const lot=data.baseMaterialLots.find(item=>item.id===issue.lotId);return `<section class="border-t pt-1">${f('原料SKU',escapeHtml(lot?.materialSkuId??'来源待发'))}${f('来源批次',escapeHtml(lot?.id??'尚未形成'))}${f('发出／实收',`${quantityText(issue.dispatchedQty)} / ${quantityText(issue.receivedQty)} ${escapeHtml(lot?.unit??'')}`)}${f('耗用／损耗',`${quantityText(issue.consumedQty)} / ${quantityText(issue.scrapQty)} ${escapeHtml(lot?.unit??'')}`)}</section>`}).join('')||'<span class="text-amber-700">等待原料仓按本单发出实际原料</span>'}${f('目标半成品',escapeHtml(r.purchase.materialCode))}</div>` } },
    { key: 'requirement', title: '加工要求', width: 275, render: r => `<div class="text-xs space-y-1">${f('类型',escapeHtml(r.purchase.accessoryType))}${f('品质要求','按采购行规格与确认样')}</div>` },
    { key: 'progress', title: '处理进度', width: 140, required: true, render: r => `<div class="space-y-2 text-xs"><div>接收：${r.base?.acceptedAt ? '已确认' : '待确认'}</div><div>加工：${r.base?.producedMeters ? (r.base.producedMeters >= r.base.plannedMeters ? '已完成' : '加工中') : '未填报'}</div><div>交出：${r.dispatched ? (r.dispatched >= (r.base?.producedMeters ?? 0) ? '已交出' : '部分交出') : '未交出'}</div></div>` },
    { key: 'output', title: '加工产出／下游', width: 235, required: true, render: r => `<div class="text-xs space-y-1">${f('产出 SKU',escapeHtml(r.purchase.materialCode))}${f('下游',escapeHtml(r.purchase.warehouse))}${f('交出批次',escapeHtml(getTmfPurchaseState().handovers.filter(h => h.baseOrderId === r.base?.id).map(h => h.batchId).join('、') || '尚未形成'))}</div>` },
    { key: 'time', title: '时间', width: 230, sortable: true, sortValue: r => r.base?.dueDate ?? '', render: r => `<div class="text-xs space-y-1">${f('采购下达',escapeHtml(r.purchase.orderDate))}${f('计划完成',escapeHtml(r.base?.dueDate ?? r.purchase.expectedArrivalDate))}${f('确认接受',escapeHtml(r.base?.acceptedAt ?? '尚未确认'))}${f('加工完成',escapeHtml(r.base?.completedAt ?? '尚未完成'))}</div>` },
    { key: 'quantity', title: '数量', width: 210, required: true, sortable: true, sortValue: r => r.base?.plannedMeters ?? 0, render: r => `<div class="text-xs space-y-1">${f('计划数量',`${r.base?.plannedMeters ?? 0} 米`)}${f('完成数量',`${r.base?.producedMeters ?? 0} 米`)}${f('交出数量',`${r.dispatched} 米`)}${f('下游实收',`${r.received} 米`)}</div>` },
    { key: 'actions', title: '操作', width: 170, required: true, actionColumn: true, render: r => `<div class="flex flex-col gap-1 items-start">${!r.base?.acceptedAt ? action('accept','确认接受',r.purchase.purchaseOrderNo) : ''}${r.base?.acceptedAt && !r.base.cancelledAt ? action('report','加工填报',r.purchase.purchaseOrderNo) : ''}${r.base && !r.base.changePending && !r.base.cancelledAt && r.base.producedMeters > r.dispatched ? action('dispatch','发起交出',r.purchase.purchaseOrderNo) : ''}${action('detail','查看详情',r.purchase.purchaseOrderNo)}</div>` },
  ]
  const columns = rawWarehouse || receiving ? legacyColumns : purchasePage ? purchaseColumns : semiColumns
  const controller = createProcessOrderListController({ state, columns, preferenceKey: receiving ? 'higood:list:/wls/accessory-receipts:tmf-base' : `higood:list:/fcs/craft/accessory/webbing/${mode}`, pageSizeOptions: [10, 20, 50], eventPrefix: prefix, rootSelector,
    tableSurfaceSelector: '[data-tmf-table]', paginationSurfaceSelector: '[data-tmf-pagination]', overlaysSurfaceSelector: '[data-tmf-columns]', defaultFrozenKeys: ['source'], columnSettingsTitle: `${title}列设置`, emptyText: receiving ? '暂无已实际交出的织带／绳子基础半成品。' : '暂无符合条件的 TMF 采购需求，请从 PMS 下达采购。', getRows: filteredRows, locallyManagedEvents: true })
  const stats = () => { const rows = filteredRows(); return renderStandardListStats([{ label: '当前查询', value: `${rows.length} 单` }, { label: receiving ? '交出应收' : '计划', value: `${rows.reduce((n, r) => n + (receiving ? r.dispatched : (r.base?.plannedMeters ?? r.purchase.orderedQty)), 0)} 米` }, { label: receiving ? '待实收' : '已产出', value: `${rows.reduce((n, r) => n + (receiving ? Math.round((r.dispatched - r.received) * 1000) / 1000 : (r.base?.producedMeters ?? 0)), 0)} 米` }, { label: '仓库实收', value: `${rows.reduce((n, r) => n + r.received, 0)} 米` }]) }
  let dialogAction = '', dialogId = '', operationId = '', rawIssueId = ''
  const root = () => document.querySelector<HTMLElement>(rootSelector)
  const feedback = (message: string) => { const el = root()?.querySelector('[data-tmf-feedback]'); if (el) el.textContent = message }
  const refresh = () => { controller.refresh({ overlays: true }); const el = root()?.querySelector('[data-tmf-stats]'); if (el) el.innerHTML = stats(); const count = root()?.querySelector('[data-standard-list-table-section] > header h2'); if (count) count.textContent = `数据列表 · ${filteredRows().length} 条` }
  const closeDialog = () => { const el = root()?.querySelector('[data-tmf-dialog]'); if (el) el.innerHTML = ''; dialogAction = ''; dialogId = ''; operationId = '' }
  const previewImage = (id: string) => {
    const row = allRows().find((r) => rowId(r) === id)
    const surface = root()?.querySelector('[data-tmf-preview]')
    if (!row || !surface) return
    surface.innerHTML = `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="半成品实物图"><button type="button" class="absolute inset-0" data-${prefix}-action="close-image" aria-label="关闭大图" data-skip-page-rerender="true"></button><div class="relative max-w-[90vw] rounded bg-white p-3"><div class="flex items-center justify-between gap-4 mb-2"><span>${escapeHtml(row.purchase.materialName)}</span>${action('close-image', '关闭')}</div><img class="max-h-[75vh] max-w-full object-contain" src="${escapeHtml(row.purchase.materialImageUrl)}" alt="${escapeHtml(row.purchase.materialName)}"></div></div>`
  }
  const openDialog = (name: string, id: string, issueId = '') => {
    const row = allRows().find((r) => rowId(r) === id)
    if (!row) throw new Error('来源采购不存在，请刷新后重试。')
    rawIssueId = issueId; dialogAction = name; dialogId = id; operationId = `tmf-ui:${crypto.randomUUID()}`
    const headers: Record<string, string> = { 'purchase-return':'交出未用采购退货','purchase-return-receive':'TMF登记退货实收','purchase-resolve':'核对采购变更处置', 'raw-issue':'基础原料实际发出','raw-return-receive':'原料退回实收',raw:'半成品加工原料账', 'raw-receive':'基础原料实际接收', 'raw-consume':'基础原料实际耗用', 'raw-return':'未用原料交回', detail: '采购及半成品加工详情', accept: '确认接受', report: '加工填报', dispatch: '发起交出', receive: '登记本次实际收货' }
    // 弹窗字段只更新弹窗自身；若让全局输入处理器触发整页重绘，现场连续录入时确认按钮会脱离 DOM。
    const input = (field: string, label: string, type = 'text') => `<label class="block text-sm mt-3">${label}<input name="${field}" type="${type}" data-skip-page-rerender="true" ${type === 'number' ? `min="${name==='raw-consume'?'0':'0.001'}" step="0.001"` : ''} class="mt-1 w-full rounded border p-2" required></label>`
    let content = `<div class="text-sm space-y-2"><p>${escapeHtml(row.purchase.purchaseOrderNo)} · V${row.purchase.version}</p><div class="flex gap-2 items-center">${row.purchase.materialImageUrl ? `<button type="button" data-${prefix}-action="image" data-id="${escapeHtml(id)}" data-skip-page-rerender="true"><img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(row.purchase.materialImageUrl)}" alt="${escapeHtml(row.purchase.materialName)}"></button>` : '缺实物图'}<span>${escapeHtml(row.purchase.materialName)} · ${escapeHtml(row.purchase.materialCode)}</span></div><p>计划 ${row.base?.plannedMeters ?? row.purchase.orderedQty} 米；已产出 ${row.base?.producedMeters ?? 0} 米；交出 ${row.dispatched} 米；实收 ${row.received} 米</p><p>${escapeHtml(row.purchase.productionStandard)}</p><p>操作身份：${escapeHtml(actor.name)}</p></div>`
    if (name === 'raw' || name.startsWith('raw-')) {
      const data=getTmfPurchaseState(),issues=data.baseMaterialIssues.filter(i=>i.baseOrderId===row.base?.id)
      content=`<p class="text-sm">半成品加工单 ${escapeHtml(row.base?.id??'')} · 来源采购 ${escapeHtml(row.purchase.purchaseOrderNo)}</p><p class="text-sm mt-2">原料重量独立核算，不能按半成品产出米数推算耗用。</p>`
      if(name==='raw'&&rawWarehouse)content+=`<p class="mt-2 text-xs">接收工厂：TMF－辅料厂；生产标准 ${escapeHtml(row.purchase.productionStandard)}</p><div class="mt-3">${row.base?.acceptedAt&&!row.base.cancelledAt&&!row.base.changePending?action('raw-issue','按原料批次发出',JSON.stringify([id,''])):''}</div>`
      if(name==='raw')content+=issues.map(i=>{const lot=data.baseMaterialLots.find(l=>l.id===i.lotId)!,balance=getTmfBaseMaterialBalance(i.id),key=JSON.stringify([id,i.id]);return `<article class="border rounded p-3 mt-3"><h3 class="font-medium">${escapeHtml(lot.materialSkuId)} · ${lot.unit}</h3><p class="text-xs text-amber-700">原料实物图待补，请核对实际物料，不以半成品图代替</p><p class="text-xs break-all">来源 ${escapeHtml(lot.sourceReceiptNo)} / ${escapeHtml(lot.sourceReceiptLineId)}；批次 ${escapeHtml(lot.id)}；${escapeHtml(lot.warehouseId)} / ${escapeHtml(lot.location)}</p><p class="text-sm mt-2">仓库发出 ${i.dispatchedQty}；本厂实收 ${i.receivedQty}；在途 ${balance.inboundTransitQty} ${lot.unit}</p><p class="text-sm">耗用 ${i.consumedQty}；损耗 ${i.scrapQty}；交回 ${balance.returnedQty}；厂内剩余 ${balance.availableQty} ${lot.unit}</p><p class="text-sm">原仓已收退料 ${balance.returnReceivedQty} ${lot.unit}</p><div class="flex flex-wrap gap-2 mt-2">${!rawWarehouse&&balance.inboundTransitQty>0?action('raw-receive','登记原料实收',key):''}${!rawWarehouse&&balance.availableQty>0?action('raw-consume','登记实际耗用',key)+action('raw-return','交回未用原料',key):''}</div>${data.baseMaterialReturns.filter(r=>r.issueId===i.id).map(r=>`<p class="text-xs mt-2">退料 ${escapeHtml(r.id)}：交出 ${r.dispatchedQty} / 原仓实收 ${r.receivedQty} ${lot.unit} · ${escapeHtml(r.reason)}${rawWarehouse&&r.receivedQty<r.dispatchedQty?action('raw-return-receive','登记退回实收',JSON.stringify([id,r.id])):''}</p>`).join('')}</article>`}).join('')||'<p class="mt-3 text-sm">暂无原料实际发出，请由原料仓按半成品加工单发料；不能在此直接增加厂内库存。</p>'
      else if(name==='raw-issue'){
        if(!rawWarehouse)throw new Error('请由原料仓登记实际发出。')
        content+=`<label class="block mt-3 text-sm">来源实收批次<select name="rawLot" class="border rounded p-2 w-full"><option value="">请选择实际原料批次</option>${data.baseMaterialLots.filter(l=>l.onHandQty>0).map(l=>`<option value="${escapeHtml(l.id)}">${escapeHtml(l.materialSkuId)} · ${escapeHtml(l.id)} · ${escapeHtml(l.warehouseId)} / ${escapeHtml(l.location)} · 可用 ${l.onHandQty} ${l.unit}</option>`).join('')}</select></label><p class="text-amber-700 text-xs mt-2">原料实物图及配方待确认，请按基础生产标准核对品种；不能用半成品图片替代。</p>`+input('rawSku','扫描原料SKU')+input('rawScan','扫描实收批次号')+input('rawIssue','本次发料单号')+input('quantity','本次实际发出（单位见所选批次，不自动换算）','number')+'<label class="flex gap-2 mt-3 text-sm"><input name="rawConfirmed" type="checkbox">确认原料符合本半成品加工单生产标准，数量与交给TMF的实物一致</label>'
      } else if(name==='raw-return-receive'){
        const returned=data.baseMaterialReturns.find(r=>r.id===issueId),issue=issues.find(i=>i.id===returned?.issueId),lot=data.baseMaterialLots.find(l=>l.id===issue?.lotId)
        if(!rawWarehouse||!returned||!issue||!lot)throw new Error('退料不属于当前半成品加工单或当前不是原料仓操作。')
        content+=`<p class="mt-3">${escapeHtml(lot.materialSkuId)} · 待收 ${returned.dispatchedQty-returned.receivedQty} ${lot.unit}</p><p class="text-xs">退回原仓 ${escapeHtml(lot.warehouseId)} / ${escapeHtml(lot.location)}；原批次 ${escapeHtml(lot.id)}</p><p class="text-xs text-amber-700">原料实物图待补</p>`+input('rawSku','扫描原料SKU')+input('rawScan','扫描退料交出单号')+input('quantity',`本次实收（${lot.unit}）`,'number')+'<label class="flex gap-2 mt-3 text-sm"><input name="rawConfirmed" type="checkbox">确认未用原料已实际回原仓原库位，规格与数量一致</label>'
      } else {
        const issue=issues.find(i=>i.id===issueId),lot=data.baseMaterialLots.find(l=>l.id===issue?.lotId)
        if(!issue||!lot)throw new Error('原料发出不属于当前半成品加工单。')
        const balance=getTmfBaseMaterialBalance(issue.id)
        content+=`<p class="mt-3">${escapeHtml(lot.materialSkuId)} · ${lot.unit}</p><p class="text-xs text-amber-700">原料实图待补</p><p class="text-xs break-all">发料 ${escapeHtml(issue.id)}；来源批次 ${escapeHtml(lot.id)}</p><p class="text-sm">在途 ${balance.inboundTransitQty}；厂内可用 ${balance.availableQty} ${lot.unit}</p>`+input('rawSku','扫描原料SKU')
        if(name==='raw-receive')content+=input('rawScan','扫描原料发料单号')+input('quantity',`本次实收（${lot.unit}）`,'number')
        if(name==='raw-consume')content+=input('quantity',`本次实际耗用（${lot.unit}，可填0）`,'number')+input('rawScrap',`本次实际损耗（${lot.unit}，可填0）`,'number')+input('rawReason','实际称量与耗用依据')
        if(name==='raw-return')content+=input('rawReturn','退料交出单号')+input('quantity',`本次未用原料交回（${lot.unit}）`,'number')+input('rawReason','退料原因')
        content+='<label class="flex gap-2 mt-3 text-sm"><input name="rawConfirmed" type="checkbox">已核对原料、来源及本次实际数量</label>'
      }
    }
    if(name==='purchase-return'){
      if(!receiving||!row.handover)throw new Error('请从仓库原基础实收批次办理退货。')
      const lot=getTmfPurchaseState().lots.find(l=>l.sourceHandoverId===row.handover!.id)
      if(!lot)throw new Error('尚未实际收货，没有可退库存。')
      content+=`<p class="mt-3">原实收批次 ${escapeHtml(lot.id)}；当前可退 ${Math.round((lot.onHandMeters-lot.reservedMeters-lot.frozenMeters)*1000)/1000} 米；退至TMF－辅料厂。</p>`+input('returnId','退货交出单号')+input('scanBatch','扫描原实收批次')+input('scanSku','扫描半成品SKU')+input('quantity','本次实际退货（米）','number')+input('returnReason','退货原因')+'<label class="flex gap-2 mt-3 text-sm"><input name="returnConfirmed" type="checkbox">确认未用实物已交出；TMF实收前采购净实收不减少</label>'
    }
    if(name==='purchase-return-receive'){
      const returned=getTmfPurchaseState().purchaseReturns.find(r=>r.id===issueId&&r.baseOrderId===row.base?.id)
      if(receiving||!returned)throw new Error('请在TMF核对所属半成品加工单的退货交出。')
      content+=`<p class="mt-3">退货 ${escapeHtml(returned.id)} · ${escapeHtml(returned.materialSkuId)}；待收 ${Math.round((returned.dispatchedMeters-returned.receivedMeters)*1000)/1000} 米</p>`+input('returnId','扫描退货交出单号')+input('scanSku','扫描半成品SKU')+input('quantity','本次实际收到（米）','number')+'<label class="flex gap-2 mt-3 text-sm"><input name="returnConfirmed" type="checkbox">确认退回物已实际收到，由TMF单独保留</label>'
    }
    if(name==='purchase-resolve'){
      if(receiving)throw new Error('请由织带厂主管核对处置。')
      content+=renderTmfPurchaseReturns(row.purchase.purchaseOrderNo,false,()=>'',id)+`<p class="mt-3">采购当前 V${row.purchase.version}，计划 ${row.purchase.orderedQty} 米；基础原计划 V${row.base?.purchaseVersion}，${row.base?.plannedMeters} 米。</p>`+input('returnReason','处置依据')+'<label class="flex gap-2 mt-3 text-sm"><input name="returnConfirmed" type="checkbox">确认原实收及产出保留，已收退货与调整后的采购计划一致</label>'
    }
    if (name === 'report') content += input('quantity', '本次实际产出（米）', 'number')
      + '<p class="mt-2 text-xs text-slate-500">超过基础生产计划时，须由织带厂主管核对实物、填写原因并二次确认；计划数量不会自动扩大。</p>'
      + input('overPlanReason', '超产原因（超计划时必填）')
      + '<label class="flex gap-2 mt-3 text-sm"><input name="overPlanConfirmed" type="checkbox">本次为超计划实际产出，已核对实物并二次确认</label>'
    if (name === 'dispatch') content += input('quantity', '本次实际交出（米）', 'number') + input('batch', '实物批次号') + '<p class="mt-2 text-xs text-slate-500">交出后等待辅料仓确认实收，不提前增加仓库库存。</p>'
    if (name === 'receive') {
      const lot = getTmfPurchaseState().lots.find((item) => item.sourceHandoverId === row.handover?.id)
      content += `<p class="mt-3 text-sm">应收批次：${escapeHtml(row.handover!.batchId)}；尚未实收 ${Math.round((row.dispatched - row.received) * 1000) / 1000} 米</p>`
        + input('scanBatch', '扫描或输入实物批次号') + input('scanSku', '扫描或输入实物 SKU 编码') + input('quantity', '本次清点实收（米）', 'number')
        + `<label class="block text-sm mt-3">实收库位<input name="location" value="${escapeHtml(lot?.location ?? '')}" class="mt-1 w-full rounded border p-2" required></label><p class="mt-2 text-xs text-slate-500">分批实收只累计本次数量；未到部分保留在途。超出交出量请先由主管核实来源。</p>`
        + `<label class="block text-sm mt-3">收货身份<select name="receiveRole" class="mt-1 w-full rounded border p-2" data-skip-page-rerender="true"><option value="仓管">辅料仓管</option><option value="仓库主管">仓库主管（超收确认）</option></select></label>`
        + input('overReceiptReason', '超收原因（超过采购计划量时必填）')
        + '<label class="flex gap-2 mt-3 text-sm"><input name="overReceiptConfirmed" type="checkbox">本次实收超过采购计划量，仓库主管已核对来源并二次确认</label><p class="mt-2 text-xs text-slate-500">实收仍不得超过上游实际交出量；计划数量不会自动扩大。</p>'
    }
    if (name === 'detail') content += `<p class="mt-3 text-sm">供应方：${escapeHtml(row.purchase.supplierName)}；目标仓：${escapeHtml(row.purchase.warehouse)}</p><p class="mt-2 text-xs">${escapeHtml(row.purchase.remark)}</p><div class="max-h-48 overflow-y-auto mt-3 text-xs space-y-2">${getTmfPurchaseState().operations.filter((op) => [row.purchase.purchaseOrderNo, row.base?.id, row.handover?.id].includes(op.objectId)).map((op) => `<p>${escapeHtml(op.occurredAt)} · ${escapeHtml(op.action)} · ${escapeHtml(op.actor.name)} ${op.quantity ?? ''} ${op.unit ?? ''}</p>`).join('')}</div>`
    if (name === 'detail') {
      const refs = row.purchase.masterRefs
      content += refs
        ? `<div class="mt-3 border-t pt-3 text-sm"><h3 class="font-medium">主档映射</h3><p>供应方 ${escapeHtml(refs.supplier.name)}（${escapeHtml(refs.supplier.code)}）· ${escapeHtml(refs.supplier.source)}</p><p>物料 ${escapeHtml(refs.material.name)}（${escapeHtml(refs.material.code)}）· ${escapeHtml(refs.material.source)}</p><p>目标仓 ${escapeHtml(refs.warehouse.name)}（${escapeHtml(refs.warehouse.code)}）· ${escapeHtml(refs.warehouse.source)}</p><p class="text-xs text-slate-500">映射时间 ${escapeHtml(refs.resolvedAt)}</p></div>`
        : '<div class="mt-3 border-t pt-3 text-sm"><h3 class="font-medium">主档映射</h3><p class="text-amber-700">未映射（历史记录）：保留原快照，不批量改写；后续动作将要求重新映射。</p></div>'
    }
    if (name === 'detail') {
      const overReceipts = row.purchase.overReceipts ?? [], overProductions = row.base?.overProductions ?? []
      if (overReceipts.length || overProductions.length) content += `<div class="mt-3 border-t pt-3 text-sm"><h3 class="font-medium">超计划记录（计划不扩）</h3>${overReceipts.map((item) => `<p>超收 ${item.meters} 米 · ${escapeHtml(item.reason)} · ${escapeHtml(item.confirmedBy)} · ${escapeHtml(item.confirmedAt)}</p>`).join('')}${overProductions.map((item) => `<p>超产 ${item.meters} 米 · ${escapeHtml(item.reason)} · ${escapeHtml(item.confirmedBy)} · ${escapeHtml(item.confirmedAt)}</p>`).join('')}</div>`
    }
    if (name === 'detail' && row.handover) {
      const lot = getTmfPurchaseState().lots.find((item) => item.sourceHandoverId === row.handover!.id)
      content += `<div class="mt-3 border-t pt-3 text-sm"><p>上游交出批次：${escapeHtml(row.handover.batchId)}</p><p>目标仓：${escapeHtml(row.purchase.warehouse)}</p>${lot ? `<p>实收库位：${escapeHtml(lot.location)}</p><p>该批次累计实收 ${lot.receivedMeters} 米；仓内实存 ${lot.onHandMeters} 米；已占用 ${lot.reservedMeters} 米</p>` : '<p>尚未实际收货，未形成仓库库存。</p>'}</div>`
    }
    if(name==='detail'&&!rawWarehouse)content+=renderTmfPurchaseReturns(row.purchase.purchaseOrderNo,receiving,action,id)
    const el = root()?.querySelector('[data-tmf-dialog]')
    if (el) { el.innerHTML = renderDialog({ title: headers[name], width: 'md', closeAction: { prefix, action: 'close-dialog', skipPageRerender: true } }, `<div role="alert" class="text-red-700 text-sm" data-tmf-dialog-error></div><div class="max-h-[68vh] overflow-y-auto">${content}</div>`, action('close-dialog', '关闭') + (['detail','raw'].includes(name) ? '' : action('confirm', '确认'))); hydrateIcons(el);el.setAttribute('tabindex','-1');(el as HTMLElement).focus({preventScroll:true}) }
  }
  const bind = () => {
    const el = root(); if (!el || el.dataset.bound) return; el.dataset.bound = 'true'
    controller.installColumnDragEvents()
    el.addEventListener('input', (event) => event.stopPropagation())
    el.addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement) { const text = document.createElement('span'); text.textContent = '图片加载失败'; text.className = 'text-amber-700 text-xs'; event.target.replaceWith(text) } }, true)
    el.addEventListener('change', (event) => { const field = event.target as HTMLSelectElement; if (field.getAttribute(`data-${prefix}-field`) === 'pageSize') { controller.setPageSize(Number(field.value)); refresh() } })
    el.addEventListener('keydown', (event) => { if (event.key === 'Escape') { const preview = el.querySelector('[data-tmf-preview]'); if (preview?.innerHTML) { preview.innerHTML = ''; return }; closeDialog(); state.showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }) } })
    el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`); if (!target) return
      event.stopPropagation()
      const name = target.getAttribute(`data-${prefix}-action`)!
      try {
        if (name === 'query') { state.keyword = el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim(); state.status = el.querySelector<HTMLSelectElement>('[name="status"]')!.value; state.currentPage = 1; refresh() }
        else if (name === 'reset') { state.keyword = state.status = ''; el.querySelector<HTMLInputElement>('[name="keyword"]')!.value = ''; el.querySelector<HTMLSelectElement>('[name="status"]')!.value = ''; state.currentPage = 1; state.sort = null; refresh() }
        else if (name === 'export') exportStandardListRows({ fileName: title, columns, rows: filteredRows() })
        else if (name === 'prev-page' || name === 'next-page') { controller.stepPage(name === 'prev-page' ? -1 : 1); refresh() }
        else if (name === 'sort-column') { controller.cycleSort(target.dataset.columnKey || ''); refresh() }
        else if (name === 'open-column-settings' || name === 'close-column-settings') { state.showColumnSettings = name === 'open-column-settings'; controller.refresh({ table: false, pagination: false, overlays: true }) }
        else if (name === 'restore-column-settings') { controller.restorePreferences(); refresh() }
        else if (name === 'toggle-column-visibility' || name === 'toggle-column-freeze') { controller.updateColumnPreference(name, target.getAttribute(`data-${prefix}-column-key`) || target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`) || '', target instanceof HTMLInputElement ? target.checked : undefined); refresh() }
        else if (name === 'image') previewImage(target.dataset.id || '')
        else if (name === 'close-image') { el.querySelector('[data-tmf-preview]')!.innerHTML = '' }
        else if (name === 'close-dialog') closeDialog()
        else if (name === 'confirm') {
          const row = allRows().find((r) => rowId(r) === dialogId); if (!row) throw new Error('采购记录不存在。')
          const quantity = Number(el.querySelector<HTMLInputElement>('[data-tmf-dialog] [name="quantity"]')?.value)
          if(dialogAction.startsWith('purchase-')){
            const value=(field:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-dialog] [name="${field}"]`)!.value.trim()
            const confirmed=!!el.querySelector<HTMLInputElement>('[name="returnConfirmed"]')?.checked
            if(dialogAction==='purchase-return'){
              const lot=getTmfPurchaseState().lots.find(l=>l.sourceHandoverId===row.handover?.id)
              if(!receiving||!lot||value('scanBatch')!==lot.id)throw new Error('请在仓库扫描正确的原实收批次。')
              dispatchTmfPurchaseReturn({returnId:value('returnId'),lotId:lot.id,warehouseId:lot.warehouseId,materialSkuId:value('scanSku'),dispatchedMeters:quantity,reason:value('returnReason'),confirmed},actor,operationId)
            }else if(dialogAction==='purchase-return-receive'){
              if(receiving||value('returnId')!==rawIssueId)throw new Error('请扫描当前TMF退货交出单号。')
              receiveTmfPurchaseReturn({returnId:rawIssueId,factoryId:'FAC-TMF',materialSkuId:value('scanSku'),receivedMeters:quantity,confirmed},actor,operationId)
            }else resolveTmfBasePurchaseChange(row.base!.id,{reason:value('returnReason'),confirmed},actor,operationId)
            const id=dialogId;refresh();openDialog('detail',id);feedback('已保存采购关联退货或处置，原实收保留，采购净实收按实际退货核对。');return
          }
          if(dialogAction==='raw-issue'||dialogAction==='raw-return-receive'){
            const data=getTmfPurchaseState(),value=(field:string)=>el.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-tmf-dialog] [name="${field}"]`)!.value.trim()
            if(!rawWarehouse||!row.base||!value('quantity')||!el.querySelector<HTMLInputElement>('[name="rawConfirmed"]')?.checked)throw new Error('请由仓库核对原料、实际数量及收发信息后确认。')
            if(dialogAction==='raw-issue'){
              const lot=data.baseMaterialLots.find(l=>l.id===value('rawLot'))
              if(!lot||value('rawScan')!==lot.id||value('rawSku')!==lot.materialSkuId)throw new Error('所扫实收批次或原料SKU不符。')
              dispatchTmfBaseMaterial({id:value('rawIssue'),baseOrderId:row.base.id,lotId:lot.id,quantity},actor,operationId)
            }else{
              const returned=data.baseMaterialReturns.find(r=>r.id===rawIssueId),issue=data.baseMaterialIssues.find(i=>i.id===returned?.issueId&&i.baseOrderId===row.base!.id),lot=data.baseMaterialLots.find(l=>l.id===issue?.lotId)
              if(!returned||!issue||!lot||value('rawScan')!==returned.id||value('rawSku')!==lot.materialSkuId)throw new Error('所扫退料单或原料SKU与当前半成品加工单不符。')
              receiveTmfBaseMaterialReturn({returnId:returned.id,warehouseId:lot.warehouseId,materialSkuId:lot.materialSkuId,unit:lot.unit,quantity},actor,operationId)
            }
            const purchaseId=dialogId;refresh();openDialog('raw',purchaseId);feedback('已保存本次仓库实际收发；工厂实收与耗用独立登记。');return
          }
          if(dialogAction.startsWith('raw-')){
            const data=getTmfPurchaseState(),issue=data.baseMaterialIssues.find(i=>i.id===rawIssueId&&i.baseOrderId===row.base?.id),lot=data.baseMaterialLots.find(l=>l.id===issue?.lotId)
            const value=(field:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-dialog] [name="${field}"]`)!.value.trim()
            if(!value('quantity')||(dialogAction==='raw-consume'&&!value('rawScrap')))throw new Error('请填写本次实际数量；没有耗用或损耗时明确填0。')
            if(receiving||!issue||!lot||value('rawSku')!==lot.materialSkuId||!el.querySelector<HTMLInputElement>('[name="rawConfirmed"]')?.checked)throw new Error('请核对原料SKU、所属半成品加工单及实际数量后确认。')
            if(dialogAction==='raw-receive'){
              if(value('rawScan')!==issue.id)throw new Error('所扫发料单不符，请核对本次来料。')
              receiveTmfBaseMaterial({issueId:issue.id,materialSkuId:lot.materialSkuId,unit:lot.unit,quantity},actor,operationId)
            }
            if(dialogAction==='raw-consume')consumeTmfBaseMaterial({issueId:issue.id,consumedQty:quantity,scrapQty:Number(value('rawScrap')),reason:value('rawReason')},actor,operationId)
            if(dialogAction==='raw-return')dispatchTmfBaseMaterialReturn({id:value('rawReturn'),issueId:issue.id,quantity,reason:value('rawReason')},actor,operationId)
            const purchaseId=dialogId;refresh();openDialog('raw',purchaseId);feedback('已保存原料实际记录；退回交出不代表原仓已实收。');return
          }
          if (dialogAction === 'receive') {
            if (el.querySelector<HTMLInputElement>('[name="scanBatch"]')!.value.trim() !== row.handover!.batchId) throw new Error('实物批次不符，请扫描本次交出的正确批次。')
            const scanned = el.querySelector<HTMLInputElement>('[name="scanSku"]')!.value.trim()
            const supervisorRole = el.querySelector<HTMLSelectElement>('[name="receiveRole"]')?.value === '仓库主管'
            const receiptActor: TmfPurchaseActor = supervisorRole
              ? { id: 'TMF-DEMO-WAREHOUSE-SUPERVISOR', name: '仓库主管（演示）', role: '仓库主管' }
              : actor
            receiveTmfBaseProduction({ handoverId: row.handover!.id, materialSkuId: scanned === row.purchase.materialCode ? row.purchase.materialSkuId : scanned,
              warehouseId: row.handover!.warehouseId, location: el.querySelector<HTMLInputElement>('[name="location"]')!.value.trim(), receivedMeters: quantity,
              overReceipt: { reason: el.querySelector<HTMLInputElement>('[name="overReceiptReason"]')?.value.trim() || '', confirmed: !!el.querySelector<HTMLInputElement>('[name="overReceiptConfirmed"]')?.checked } }, receiptActor, operationId)
          } else if (dialogAction === 'accept') acceptTmfBaseOrder(row.base!.id, TMF_DEMO_SUPERVISOR, operationId)
          else if (dialogAction === 'report') reportTmfBaseProduction(row.base!.id, quantity, TMF_DEMO_SUPERVISOR, operationId,
            { reason: el.querySelector<HTMLInputElement>('[name="overPlanReason"]')?.value.trim() || '', confirmed: !!el.querySelector<HTMLInputElement>('[name="overPlanConfirmed"]')?.checked })
          else if (dialogAction === 'dispatch') dispatchTmfBaseProduction({ baseOrderId: row.base!.id, handoverId: `${operationId}:handover`, batchId: el.querySelector<HTMLInputElement>('[name="batch"]')!.value.trim(), dispatchedMeters: quantity }, TMF_DEMO_SUPERVISOR, operationId)
          closeDialog(); refresh(); feedback(receiving ? '本次实收已保存，采购实收与连续料批次库存已同步。' : '已保存。交出与仓库实收分别记录，请按实物继续交接。')
        } else if(name==='purchase-return-receive'){const [id,returnId]=JSON.parse(target.dataset.id!);openDialog(name,id,returnId)} else if(name.startsWith('raw-')){const [purchaseId,issueId]=JSON.parse(target.dataset.id!);openDialog(name,purchaseId,issueId)} else openDialog(name, target.dataset.id || '')
      } catch (error) { const message = error instanceof Error ? error.message : '操作失败，请重试'; const errorEl = el.querySelector('[data-tmf-dialog-error]'); if (errorEl) errorEl.textContent = message; else feedback(message) }
    })
  }
  return { render: () => {
      state.currentPage = 1; state.sort = null
    controller.ensurePreferencesLoaded(); const view = controller.getView()
    if (typeof window !== 'undefined') requestAnimationFrame(bind)
    return `<div data-tmf-base-page="${mode}">${renderStandardListPage({ title, primaryActionsHtml: `<div class="flex gap-2 items-center"><span class="text-xs text-slate-500">${receiving || rawWarehouse ? '原料／辅料仓 · 仓管演示身份' : 'TMF - 辅料厂 · 主管演示身份'}</span>${purchasePage ? '<button class="rounded border px-3 py-1.5 text-sm" data-nav="/pms/material-purchase-orders">PMS 面辅料采购</button>' : ''}</div>`,
      feedbackHtml: '<p class="text-sm text-blue-700" role="status" data-tmf-feedback></p>',
      filtersHtml: `<div class="rounded-lg border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">采购单 / 物料 / ${purchasePage ? '款式 / 半成品加工单' : '半成品加工单 / 批次'}<input name="keyword" value="${escapeHtml(state.keyword)}" class="block rounded border p-2 mt-1 w-72 text-sm"></label><label class="text-xs">进度<select name="status" class="block rounded border p-2 mt-1 text-sm"><option value="">全部</option>${(receiving ? ['待实收','部分实收','已收齐'] : ['待生成','待确认接受','加工中','待交出','交出待实收','已收齐','变更待处理','已终止']).map((s) => `<option ${s === state.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div><div class="mt-3 flex gap-2">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,
      statsHtml: `<div data-tmf-stats>${stats()}</div>`, listTitle: `数据列表 · ${filteredRows().length} 条`, listActionsHtml: action('open-column-settings', '列设置'),
      tableHtml: `<div data-tmf-table>${view.tableHtml}</div>`, paginationHtml: `<div data-tmf-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-tmf-columns>${controller.renderColumnSettings()}</div><div data-tmf-dialog></div><div data-tmf-preview></div>`,
    })}</div>`
  } }
}
export function renderTmfSemiFinishedFlowPage(mode: Mode): string {
  if (!pages.has(mode)) pages.set(mode, createPage(mode))
  return pages.get(mode)!.render()
}
