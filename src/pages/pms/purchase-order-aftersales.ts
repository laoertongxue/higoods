// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderSecondaryButton, renderPrimaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import { renderProcessOrderStats, renderProcessSelectionHeader, handleProcessFilterPresentation } from '../../components/ui/process-order-list-presentation.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { commitPmsAftersaleBatch, filterPmsPurchaseOrderAftersales, getPmsPurchaseOrderAftersale, hydratePmsPurchaseOrderAftersalesFromIdb, listPmsPurchaseOrderAftersales, type PmsAftersaleStatus, type PmsAftersaleAction, type PmsPurchaseOrderAftersale } from '../../data/pms/purchase-order-aftersales.ts'
import { getPmsProductPurchaseOrder, hydratePmsProductPurchaseOrdersFromIdb } from '../../data/pms/product-purchase-orders.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR } from '../../data/pms/runtime.ts'
import { escapeHtml } from '../../utils.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { formatPmsTime, renderPmsFeedback, renderPmsBusinessImage, renderPmsImagePreview, handlePmsCommonImageEvent, renderPmsOverlayError, renderPmsStatusBadge, readTextField } from './shared.ts'
import { renderPmsCorePagination, renderPmsCoreMulti, refreshPmsCoreOverlay, refreshPmsCoreRegion, setPmsCoreSavePending, handlePmsCoreListControls } from './core-interactions.ts'
const EVENT_PREFIX = 'pms-posa'
const ROOT_SELECTOR = '[data-pms-posa-root]'
type Overlay = { kind: 'action'; action: PmsAftersaleAction; ids: string[]; clientActionId: string; versions: Record<string, number> } | { kind: 'detail' | 'source' | 'logs'; id: string; clientActionId: string } | null
interface State extends ProcessOrderListControllerState { keyword: string; searchField: string; status: '' | PmsAftersaleStatus; recipients: string[]; purchasers: string[]; selectedIds: string[]; overlay: Overlay; overlayError: string; feedback: string; feedbackOk: boolean; saving: boolean }
const state: State = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', searchField: 'spu', status: '', recipients: [], purchasers: [], selectedIds: [], overlay: null, overlayError: '', feedback: '', feedbackOk: true, saving: false }
const rootElement = () => typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
const button = (label: string, action: string, id = '') => `<button type="button" class="min-h-8 rounded px-2 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="${action}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`
function filteredRows(): PmsPurchaseOrderAftersale[] {
  const needle = state.keyword.trim().toLowerCase()
  return filterPmsPurchaseOrderAftersales({ status: state.status, recipients: state.recipients, purchasers: state.purchasers }).filter(row => !needle || (state.searchField === 'sku' ? (row.skuLines ?? []).map(line => line.sku) : state.searchField === 'order' ? [row.purchaseOrderNo] : state.searchField === 'name' ? [row.productName] : [row.spu, row.id]).some(value => value.toLowerCase().includes(needle)))
}
const columns: StandardListColumn<PmsPurchaseOrderAftersale>[] = [
  { key: 'select', title: '', width: 44, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.id), new Set(state.selectedIds), EVENT_PREFIX), render: row => `<input type="checkbox" data-preserve-native-click="true" aria-label="选择 ${escapeHtml(row.id)}" data-${EVENT_PREFIX}-field="select-row" data-id="${escapeHtml(row.id)}" ${state.selectedIds.includes(row.id) ? 'checked' : ''} />` },
  { key: 'id', title: '售后单', width: 160, required: true, freezeable: true, render: row => `${button(row.id, 'detail', row.id)}<div class="mt-1">${renderPmsStatusBadge(row.status, row.status === '已完成' ? 'green' : row.status === '已驳回' ? 'red' : row.status === '待处理' ? 'yellow' : 'blue')}</div>` },
  { key: 'product', title: '商品 / 规格', width: 240, required: true, freezeable: true, render: row => `<div class="flex gap-3">${renderPmsBusinessImage(row.imageUrl, row.productName, 'h-12 w-12')}<div><div>${escapeHtml(row.productName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.spu)}</div><div class="text-xs">${escapeHtml(row.specs)}</div></div></div>` },
  { key: 'source', title: '采购单 / 供应商', width: 220, render: row => `${button(row.purchaseOrderNo, 'source', row.id)}<div>${escapeHtml(row.supplierName)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.purchaseType)} · ${escapeHtml(row.platform)}</div>` },
  { key: 'people', title: '收件人 / 买手', width: 130, render: row => `${escapeHtml(row.recipientName)}<div class="text-xs text-muted-foreground">${escapeHtml(row.purchaser)}</div>` },
  { key: 'reason', title: '原因 / 备注', width: 180, render: row => `<div>${escapeHtml(row.reason)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.remark)}</div>` },
  { key: 'return', title: '退货信息', width: 220, render: row => `${escapeHtml(row.returnAddress || '未填写地址')}<div class="mt-1 text-xs">${row.returnTrackings.map(item => `${escapeHtml(item.carrier)} ${escapeHtml(item.trackingNo)}`).join('<br>') || '暂无退货运单'}</div>` },
  { key: 'time', title: '创建时间', width: 160, sortable: true, sortValue: row => row.createdAt, render: row => formatPmsTime(row.createdAt) },
  { key: 'actions', title: '操作', width: 230, actionColumn: true, render: row => `<div class="flex flex-wrap justify-end gap-1">${row.status === '待处理' ? button('开始售后', 'start', row.id) + button('驳回', 'reject', row.id) : ''}${['待处理', '售后中'].includes(row.status) ? button('退货地址', 'address', row.id) + button('同意退货', 'approve', row.id) : ''}${row.status === '售后中' ? button('退货快递', 'tracking', row.id) + button('更新状态', 'status', row.id) : ''}${button('备注', 'remark', row.id)}${button('日志', 'logs', row.id)}</div>` },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/pms/purchase-order-aftersales', pageSizeOptions: [10,20,50], eventPrefix: EVENT_PREFIX, rootSelector: ROOT_SELECTOR, tableSurfaceSelector: '[data-pms-posa-table-surface]', paginationSurfaceSelector: '[data-pms-posa-pagination-surface]', overlaysSurfaceSelector: '[data-pms-posa-overlays]', defaultFrozenKeys: ['id','product'], columnSettingsTitle: '采购售后列设置', emptyText: '当前条件下暂无售后单', getRows: filteredRows, locallyManagedEvents: true })
function candidates(key: 'recipients'|'purchasers'): string[] { return [...new Set(listPmsPurchaseOrderAftersales().map(row => key === 'recipients' ? row.recipientName : row.purchaser))].filter(Boolean) }
function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 md:grid-cols-5"><label class="text-xs">检索类型<select class="mt-1 h-9 w-full rounded border bg-white px-2" data-${EVENT_PREFIX}-field="searchField">${[['spu','SPU'],['sku','SKU'],['name','商品名称'],['order','采购单']].map(([value,label]) => `<option value="${value}" ${state.searchField===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="text-xs">检索内容<input class="mt-1 h-9 w-full rounded border px-2" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" /></label><label class="text-xs">售后状态<select class="mt-1 h-9 w-full rounded border bg-white px-2" data-${EVENT_PREFIX}-field="status">${['','待处理','售后中','已完成','已驳回'].map(value=>`<option value="${value}" ${state.status===value?'selected':''}>${value||'全部'}</option>`).join('')}</select></label>${renderPmsCoreMulti(EVENT_PREFIX,'recipients','收件人',candidates('recipients'),state.recipients)}${renderPmsCoreMulti(EVENT_PREFIX,'purchasers','买手',candidates('purchasers'),state.purchasers)}</div><div class="mt-3 flex flex-wrap gap-2" data-process-filter-actions>${renderPrimaryButton('查询',{prefix:EVENT_PREFIX,action:'query'},'search')}${renderSecondaryButton('重置',{prefix:EVENT_PREFIX,action:'reset'},'rotate-ccw')}${renderSecondaryButton('导出',{prefix:EVENT_PREFIX,action:'export'},'download')}</div></div>`
}
function renderStats(): string { const rows=filteredRows();return renderProcessOrderStats([{label:'售后单数',value:rows.length},{label:'待处理',value:rows.filter(row=>row.status==='待处理').length},{label:'售后中',value:rows.filter(row=>row.status==='售后中').length},{label:'总成本',value:rows.reduce((sum,row)=>sum+row.costPrice,0).toFixed(2)}]) }
function renderOverlay(): string {
  const overlay=state.overlay
  const settings=controller.renderColumnSettings()
  if(!overlay)return settings+renderPmsImagePreview()
  let title='',body='',submit=''
  if(overlay.kind==='action') {
    title=overlay.action
    const row=getPmsPurchaseOrderAftersale(overlay.ids[0])
    body=`<p class="text-sm">${overlay.ids.map(escapeHtml).join('、')} · ${overlay.ids.length} 张</p>`
    if(overlay.action==='开始售后')body+='<p class="text-sm">所选待处理售后单将进入售后中。</p>'
    if(overlay.action==='同意退货')body+='<p class="text-sm">同意所选售后单退货。所有单据须已填写退货地址。</p>'
    if(overlay.action==='完善退货地址')body+=`<label class="block text-sm">退货地址<textarea class="mt-1 min-h-28 w-full rounded border p-2" data-${EVENT_PREFIX}-input="address">${escapeHtml(row?.returnAddress||'')}</textarea></label>`
    if(overlay.action==='更新退货快递')body+=`<label class="block text-sm">快递公司<input class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-input="carrier" /></label><label class="block text-sm">快递单号<input class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-input="trackingNo" /></label>`
    if(overlay.action==='更新状态')body+=`<label class="block text-sm">目标状态<select class="mt-1 h-9 w-full rounded border px-2" data-${EVENT_PREFIX}-input="status">${['售后中','已完成','已驳回'].map(value=>`<option>${value}</option>`).join('')}</select></label><p class="text-xs text-muted-foreground">已完成与已驳回的售后不能重新变更状态。</p>`
    body+=`<label class="block text-sm">${overlay.action==='驳回'?'驳回原因（必填）':'备注'}<textarea class="mt-1 min-h-24 w-full rounded border p-2" data-${EVENT_PREFIX}-input="remark">${overlay.action==='备注'?escapeHtml(row?.remark||''):''}</textarea></label>`
    submit=renderPrimaryButton(`确认${overlay.action}`,{prefix:EVENT_PREFIX,action:'submit'},'check-check')
  } else {
    const row=getPmsPurchaseOrderAftersale(overlay.id);if(!row)return settings
    title=overlay.kind==='source'?'关联采购单':overlay.kind==='logs'?'售后日志':'售后详情'
    if(overlay.kind==='source') {const order=getPmsProductPurchaseOrder(row.purchaseOrderNo);body=order?`${renderPmsBusinessImage(order.imageUrl,order.productName)}<p>${escapeHtml(order.purchaseOrderNo)} · ${escapeHtml(order.productName)} · ${escapeHtml(order.status)}</p><p>${escapeHtml(order.supplierName)} · ${escapeHtml(order.warehouse)}</p><table class="w-full text-sm"><thead><tr><th>SKU</th><th>采购数量</th><th>到货数量</th></tr></thead><tbody>${order.lines.map(line=>`<tr><td class="p-2">${escapeHtml(line.sku)}</td><td>${line.qty}</td><td>${line.deliveredQty}</td></tr>`).join('')}</tbody></table>`:'<p>此历史采购单当前未载入，请核对单号。</p>'}
    else if(overlay.kind==='logs')body=`<table class="w-full text-sm"><thead><tr><th>动作</th><th>操作人</th><th>时间</th><th>备注</th></tr></thead><tbody>${row.logs.map(log=>`<tr><td class="p-2">${escapeHtml(log.action)}</td><td>${escapeHtml(log.actorName)}</td><td>${formatPmsTime(log.occurredAt)}</td><td>${escapeHtml(log.remark)}</td></tr>`).join('')}</tbody></table>`
    else body=`${renderPmsBusinessImage(row.imageUrl,row.productName)}<p>${escapeHtml(row.id)} · ${escapeHtml(row.productName)} · ${escapeHtml(row.status)}</p><p>${escapeHtml(row.reason)}</p><p>${escapeHtml(row.returnAddress||'未填写退货地址')}</p><p>规格：${escapeHtml(row.specs)}</p><p>收货快递：${row.inboundTrackings.map(item=>`${escapeHtml(item.carrier)} ${escapeHtml(item.trackingNo)}`).join('、')||'暂无'}</p>`
  }
  return `${settings}<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="${title}"><button class="absolute inset-0 bg-slate-900/40" aria-label="关闭" data-${EVENT_PREFIX}-action="close-overlay"></button><section class="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-background shadow-xl"><header class="flex items-center justify-between border-b p-4"><h2 class="font-semibold">${title}</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}</header><div class="space-y-3 overflow-auto p-4">${renderPmsOverlayError(state.overlayError)}${body}</div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'},'x')}${submit}</footer></section></div>${renderPmsImagePreview()}`
}
function refreshOverlay(): void {refreshPmsCoreOverlay(rootElement(),'[data-pms-posa-overlays]',renderOverlay(),state.overlay?.clientActionId||'',state.saving)}
function refresh(): void { const root=rootElement();refreshPmsCoreRegion(root,'[data-pms-posa-filters]',renderFilters());refreshPmsCoreRegion(root,'[data-pms-posa-stats]',renderStats());refreshPmsCoreRegion(root,'[data-pms-posa-feedback]',renderPmsFeedback(state.feedback,state.feedbackOk));controller.refresh({overlays:false});refreshPmsCoreRegion(root,'[data-pms-posa-pagination-surface]',renderPmsCorePagination(controller.getView().paginationHtml,EVENT_PREFIX,state.currentPage));refreshOverlay() }
export async function renderPmsPurchaseOrderAftersalesPage(): Promise<string> {
  resetStandardListEntryTransientStateOnRouteEntry(state,Boolean(rootElement()))
  try{await Promise.all([hydratePmsPurchaseOrderAftersalesFromIdb(),hydratePmsProductPurchaseOrdersFromIdb()])}catch(error){state.feedback=`用户记录读取失败：${error instanceof Error?error.message:'请重试'}`;state.feedbackOk=false}
  controller.ensurePreferencesLoaded();controller.installColumnDragEvents();const view=controller.getView()
  return `<div data-pms-posa-root data-skip-page-rerender="true">${renderStandardListPage({showHeader:true,title:'商品采购售后',feedbackHtml:`<div data-pms-posa-feedback>${renderPmsFeedback(state.feedback,state.feedbackOk)}</div>`,filtersHtml:`<div data-pms-posa-filters>${renderFilters()}</div>`,statsHtml:`<div data-pms-posa-stats>${renderStats()}</div>`,listTitle:`共 ${filteredRows().length} 条`,listActionsHtml:`<div class="flex flex-wrap gap-2">${renderSecondaryButton('批量开始售后',{prefix:EVENT_PREFIX,action:'batch-start'},'play')}${renderSecondaryButton('批量同意退货',{prefix:EVENT_PREFIX,action:'batch-approve'},'check')}${renderSecondaryButton('批量更新状态',{prefix:EVENT_PREFIX,action:'batch-status'},'refresh-ccw')}${renderSecondaryButton('列设置',{prefix:EVENT_PREFIX,action:'open-column-settings'},'settings-2')}</div>`,tableHtml:`<div data-pms-posa-table-surface>${view.tableHtml}</div>`,paginationHtml:`<div data-pms-posa-pagination-surface>${renderPmsCorePagination(view.paginationHtml,EVENT_PREFIX,state.currentPage)}</div>`,overlaysHtml:`<div data-pms-posa-overlays>${renderOverlay()}</div>`})}</div>`
}
export function closePmsPurchaseOrderAftersalesOverlays(): boolean {if(state.saving)return false;if(state.overlay||state.showColumnSettings){state.overlay=null;state.overlayError='';state.showColumnSettings=false;refreshOverlay();return true}return false}
export async function handlePmsPurchaseOrderAftersalesEvent(target: HTMLElement,event?: Event): Promise<boolean> {
  if(!rootElement())return false
  if(target.closest('summary'))return true
 if(state.saving)return true
  if(handlePmsCommonImageEvent(target,event,refreshOverlay)||handlePmsCoreListControls(target,EVENT_PREFIX,state,controller,refreshOverlay)||handleProcessFilterPresentation(rootElement()!,target))return true
  if(event instanceof KeyboardEvent&&event.key==='Escape')return closePmsPurchaseOrderAftersalesOverlays()
  const multi=target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-multi]`)
  if(multi){const key=multi.getAttribute(`data-${EVENT_PREFIX}-multi`) as 'recipients'|'purchasers';state[key]=multi.checked?[...new Set([...state[key],multi.value])]:state[key].filter(value=>value!==multi.value);return true}
  const field=target.closest<HTMLInputElement|HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if(field){const key=field.getAttribute(`data-${EVENT_PREFIX}-field`);if(key==='selection-scope'){const visible=[...rootElement()!.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`)].map(input=>input.dataset.id||'');state.selectedIds=field.value==='all'?filteredRows().map(row=>row.id):field.value==='page'?visible:[];controller.refresh({overlays:false});return true}if(key==='select-row'){const id=field.dataset.id||'';state.selectedIds=(field as HTMLInputElement).checked?[...new Set([...state.selectedIds,id])]:state.selectedIds.filter(value=>value!==id);controller.refresh({overlays:false})}else if(key==='keyword')state.keyword=field.value;else if(key==='searchField')state.searchField=field.value;else if(key==='status')state.status=field.value as State['status'];return true}
  const node=target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`),action=node?.getAttribute(`data-${EVENT_PREFIX}-action`),id=node?.dataset.id||''
  if(!action)return Boolean(target.closest('[role="dialog"]'))
  if(action==='select-page'||action==='toggle-page'){const ids=[...rootElement()!.querySelectorAll<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="select-row"]`)].map(input=>input.dataset.id||'');const checked=node instanceof HTMLInputElement?node.checked:!ids.every(value=>state.selectedIds.includes(value));state.selectedIds=checked?[...new Set([...state.selectedIds,...ids])]:state.selectedIds.filter(value=>!ids.includes(value));controller.refresh({overlays:false});return true}
  if(action==='multi-all'||action==='multi-clear'){const key=node!.dataset.multiKey as 'recipients'|'purchasers';state[key]=action==='multi-all'?candidates(key):[];refreshPmsCoreRegion(rootElement(),'[data-pms-posa-filters]',renderFilters());return true}
  if(action==='query'){state.currentPage=1;state.selectedIds=[];state.feedback='';refresh();return true}
  if(action==='reset'){Object.assign(state,{keyword:'',searchField:'spu',status:'',recipients:[],purchasers:[],selectedIds:[],currentPage:1,feedback:''});refresh();return true}
  if(action==='export'){const rows=filteredRows();if(!rows.length){state.feedback='当前条件下没有可导出的售后单';state.feedbackOk=false}else{downloadPmsCsv('商品采购售后.csv',['售后单号','SPU','商品名称','采购单号','供应商','收件人','买手','状态','原因','备注'],rows.map(row=>[row.id,row.spu,row.productName,row.purchaseOrderNo,row.supplierName,row.recipientName,row.purchaser,row.status,row.reason,row.remark]));state.feedback=`已导出 ${rows.length} 条售后单`;state.feedbackOk=true}refresh();return true}
  if(action==='close-overlay'){closePmsPurchaseOrderAftersalesOverlays();return true}
  if(['detail','source','logs'].includes(action)){state.overlay={kind:action as 'detail'|'source'|'logs',id,clientActionId:nextPmsActionId('posa-view')};state.overlayError='';refreshOverlay();return true}
  const mapping:Record<string,PmsAftersaleAction>={start:'开始售后',reject:'驳回',approve:'同意退货',address:'完善退货地址',tracking:'更新退货快递',status:'更新状态',remark:'备注','batch-start':'开始售后','batch-approve':'同意退货','batch-status':'更新状态'}
  if(mapping[action]){const ids=action.startsWith('batch-')?state.selectedIds.slice():[id];if(!ids.length){state.feedback='请先勾选售后单';state.feedbackOk=false;refresh();return true}state.overlay={kind:'action',action:mapping[action],ids,clientActionId:nextPmsActionId('posa-save'),versions:Object.fromEntries(ids.map(value=>[value,getPmsPurchaseOrderAftersale(value)?._pmsBaseVersion??0]))};state.overlayError='';refreshOverlay();return true}
  if(action==='submit'&&state.overlay?.kind==='action'){
    const overlay=state.overlay;const surface=rootElement()!.querySelector('[role="dialog"]')!;const value=(key:string)=>readTextField(surface,`[data-${EVENT_PREFIX}-input="${key}"]`)
    state.saving=true;setPmsCoreSavePending(rootElement(),true)
    try{await commitPmsAftersaleBatch(overlay.ids,overlay.action,{remark:value('remark'),address:value('address'),carrier:value('carrier'),trackingNo:value('trackingNo'),status:(value('status')||undefined) as PmsAftersaleStatus|undefined},PMS_BUYER_ACTOR.name,overlay.clientActionId,overlay.versions);state.feedback=`${overlay.action}已保存，共 ${overlay.ids.length} 张售后单`;state.feedbackOk=true;state.overlay=null;state.selectedIds=[];state.overlayError=''}catch(error){state.overlayError=error instanceof Error?error.message:'保存失败，输入尚未保存'}finally{state.saving=false;refresh()}
    return true
  }
  return false
}
