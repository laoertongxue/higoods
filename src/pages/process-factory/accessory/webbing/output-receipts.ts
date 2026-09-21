// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState, getTmfOutputPackageBalance, receiveTmfOutputPackage } from '../../../../data/pms/tmf-material-purchases.ts'
import type { WebbingEndRequirement } from '../../../../data/fcs/webbing-specifications.ts'

const prefix = 'tmf-output-receipts'
const selector = '[data-tmf-output-receipts]'
const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
const actor = { id: 'TMF-DEMO-WAREHOUSE-CLERK', name: '辅料仓管（演示）', role: '仓管' as const }
const action = (name: string, text: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs ${['query','confirm','receive'].includes(name) ? 'bg-blue-600 text-white' : ''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${text}</button>`
function endLabel(end: WebbingEndRequirement): string {
  return ({ NONE: '无端头', METAL: '金属头', PLASTIC_WRAP: '塑料包头', SILICONE_DIP: '硅胶浸头' }[end.method]) + (end.specification ? ` · ${end.specification}` : '')
}
/** 只读投影：按已交出包关联实际规格，不能按SKU合并库存。 */
export function getTmfOutputReceiptRows() {
  const data = getTmfPurchaseState()
  return data.outputHandovers.flatMap((handover) => {
    const pkg = data.packages.find((item) => item.id === handover.packageId)
    const demand = data.demands.find((item) => item.id === pkg?.demandId)
    if (!pkg || !demand || pkg.splitAt) return []
    const purchase = data.orders.find((item) => item.materialSkuId === pkg.materialSkuId)
    const control = data.productionControls.find((item) => item.productionOrderId === demand.productionOrderId)
    return [{ handover, pkg, demand, purchase, balance: getTmfOutputPackageBalance(pkg.id), blocked: control && control.status !== 'ACTIVE',
      status: handover.receivedPieces === handover.dispatchedPieces ? '已收齐' : handover.receivedPieces ? '部分实收' : '待实收' }]
  })
}
type Row = ReturnType<typeof getTmfOutputReceiptRows>[number]
const filtered = () => getTmfOutputReceiptRows().filter((r) => (!state.status || r.status === state.status) && (!state.keyword || [r.handover.id,r.pkg.id,r.pkg.materialSkuId,r.demand.productionOrderNo,r.demand.specification.usage].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const specification = (r: Row) => `<div>下料 ${r.pkg.actualCutLengthMm}mm；成品 ${r.pkg.actualFinishedLengthMm}mm</div><div class="text-xs">A端：${e(endLabel(r.pkg.endA))}<br>B端：${e(endLabel(r.pkg.endB))}</div>`
const columns: StandardListColumn<Row>[] = [
  { key: 'package', title: '包号 / 交出单', width: 220, required: true, freezeable: true, sortable: true, sortValue: r => r.pkg.id, render: r => `<strong class="break-all">${e(r.pkg.id)}</strong><div class="text-xs break-all">${e(r.handover.id)}</div>` },
  { key: 'demand', title: '生产单 / 需求用途', width: 230, required: true, render: r => `<div>${e(r.demand.productionOrderNo)}</div><div class="text-xs">${e(r.demand.specification.usage)} · ${e(r.demand.garmentSize)}</div><div class="text-xs text-slate-500">技术包 ${e(r.demand.techPackVersionId)}</div>${r.blocked ? '<div class="text-amber-700 text-xs">生产单受限：实收后不可发料</div>' : ''}` },
  { key: 'material', title: '半成品身份 / 实物识别', width: 245, required: true, render: r => `<div class="flex gap-2">${r.purchase?.materialImageUrl ? `<button data-${prefix}-action="image" data-id="${e(r.handover.id)}" data-skip-page-rerender="true"><img class="h-12 w-12 object-cover rounded border" src="${e(r.purchase.materialImageUrl)}" alt="${e(r.purchase.materialName)}半成品参考图"></button>` : ''}<div>${e(r.pkg.materialSkuId)}<div class="text-xs text-amber-700">${r.purchase?.materialImageUrl ? '半成品参考图；真实实拍替代图' : '缺该规格实物图'}</div></div></div>` },
  { key: 'specification', title: '实际长度 / 端头', width: 250, required: true, render: specification },
  { key: 'quantity', title: '交出 / 实收 / 待收', width: 180, required: true, render: r => `${r.handover.dispatchedPieces} / ${r.handover.receivedPieces} / ${r.handover.dispatchedPieces-r.handover.receivedPieces} ${r.pkg.unit}` },
  { key: 'location', title: '库位 / 仓内实存', width: 175, render: r => `${e(r.pkg.location ?? '未上架')}<div class="text-xs">实存 ${r.balance.onHandPieces} ${r.pkg.unit}；可发 ${r.balance.availablePieces} ${r.pkg.unit}</div>` },
  { key: 'status', title: '收货状态', width: 100, render: r => r.status },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true, render: r => action('detail','详情',r.handover.id)+(r.handover.receivedPieces<r.handover.dispatchedPieces?action('receive','登记实收',r.handover.id):'') },
]
const controller = createProcessOrderListController({ state, columns, preferenceKey: 'higood:list:/wls/accessory-receipts:tmf-output', eventPrefix: prefix, rootSelector: selector, tableSurfaceSelector: '[data-tmf-output-table]', paginationSurfaceSelector: '[data-tmf-output-pagination]', overlaysSurfaceSelector: '[data-tmf-output-columns]', defaultFrozenKeys: ['package'], pageSizeOptions: [10,20,50], getRows: filtered, locallyManagedEvents: true, emptyText: '暂无已交出的织带／绳子加工产出包。', columnSettingsTitle: '加工产出收货列设置' })
const stats = () => { const rows=filtered(); return renderStandardListStats([{label:'当前查询',value:`${rows.length} 包`},{label:'待收齐',value:`${rows.filter(r=>r.status!=='已收齐').length} 包`},{label:'已收齐',value:`${rows.filter(r=>r.status==='已收齐').length} 包`}]) }
let selected='', operationId=''
const root=()=>document.querySelector<HTMLElement>(selector)
const refresh=()=>{controller.refresh({overlays:true});const el=root();if(!el)return;el.querySelector('[data-tmf-output-stats]')!.innerHTML=stats();const title=el.querySelector('[data-standard-list-table-section] > header h2');if(title)title.textContent=`加工产出 · ${filtered().length} 包`}
const close=()=>{const el=root()?.querySelector('[data-tmf-output-dialog]');if(el)el.innerHTML='';selected='';operationId=''}
function showDialog(id:string, receive:boolean) {
  const row=getTmfOutputReceiptRows().find(r=>r.handover.id===id);if(!row)throw new Error('交出包不存在，请刷新核对。')
  selected=id;operationId=`tmf-output-ui:${crypto.randomUUID()}`
  const input=(name:string,label:string,type='text',value='')=>`<label class="block mt-3 text-sm">${label}<input name="${name}" type="${type}" value="${e(value)}" class="mt-1 w-full rounded border p-2" ${type==='number'?'min="1" step="1"':''}></label>`
  const content=`<div class="max-h-[60vh] overflow-y-auto"><p class="break-all">包号 ${e(row.pkg.id)}</p><p>生产单 ${e(row.demand.productionOrderNo)} · ${e(row.demand.specification.usage)} · ${e(row.demand.garmentSize)}</p>${specification(row)}<p class="mt-2">应收 ${row.handover.dispatchedPieces} ${row.pkg.unit}，已收 ${row.handover.receivedPieces} ${row.pkg.unit}</p><p class="text-xs text-slate-500">半成品 SKU：${e(row.pkg.materialSkuId)}；本次入条料账，不增加米料或采购实收。</p>${receive?input('package','扫描或输入实物包号')+input('production','扫描或输入生产单号')+input('pieces',`本次实际收到（${row.pkg.unit}）`,'number')+input('location','实际库位','text',row.pkg.location??'')+'<label class="flex gap-2 mt-3 text-sm"><input name="checked" type="checkbox">已核对实物长度、两端方式及合格状态与本包一致</label>':`<p>库位 ${e(row.pkg.location??'未上架')}；仓内实存 ${row.balance.onHandPieces} ${row.pkg.unit}</p><p>占用 ${row.balance.reservedPieces}；可发 ${row.balance.availablePieces} ${row.pkg.unit}</p>${getTmfPurchaseState().operations.filter(op=>op.objectId===row.pkg.id).map(op=>`<p class="mt-2 text-xs">${e(op.occurredAt)} · ${e(op.action)} · ${e(op.actor.name)} · ${op.quantity??''} ${e(op.unit??'')}</p>`).join('')}`}</div><p role="alert" data-tmf-output-error class="text-sm text-red-700"></p>`
  const el=root()!.querySelector('[data-tmf-output-dialog]')!;el.innerHTML=renderDialog({title:receive?'加工产出实收':'加工产出收货详情',width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},content,action('close','关闭')+(receive?action('confirm','确认实收'):''));hydrateIcons(el)
}
function bind(){
  const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true';controller.installColumnDragEvents()
  el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
  el.addEventListener('change',event=>{const field=event.target as HTMLSelectElement;if(field.getAttribute(`data-${prefix}-field`)==='pageSize'){controller.setPageSize(Number(field.value));refresh()}})
  el.addEventListener('keydown',event=>{if(event.key==='Escape'){const image=el.querySelector('[data-tmf-output-image]')!;if(image.innerHTML){image.innerHTML='';return}close();state.showColumnSettings=false;controller.refresh({table:false,pagination:false,overlays:true})}})
  el.addEventListener('click',event=>{
    const target=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!target)return;event.stopPropagation();const name=target.getAttribute(`data-${prefix}-action`)
    try{
      if(name==='query'){state.keyword=el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim();state.status=el.querySelector<HTMLSelectElement>('[name="status"]')!.value;state.currentPage=1;refresh()}
      else if(name==='reset'){state.keyword=state.status='';el.querySelector<HTMLInputElement>('[name="keyword"]')!.value='';el.querySelector<HTMLSelectElement>('[name="status"]')!.value='';state.currentPage=1;state.sort=null;refresh()}
      else if(name==='export')exportStandardListRows({fileName:'织带加工产出收货',columns,rows:filtered()})
      else if(name==='prev-page'||name==='next-page'){controller.stepPage(name==='prev-page'?-1:1);refresh()}
      else if(name==='sort-column'){controller.cycleSort(target.dataset.columnKey||'');refresh()}
      else if(name==='open-column-settings'||name==='close-column-settings'){state.showColumnSettings=name==='open-column-settings';controller.refresh({table:false,pagination:false,overlays:true})}
      else if(name==='restore-column-settings'){controller.restorePreferences();refresh()}
      else if(name==='toggle-column-visibility'||name==='toggle-column-freeze'){controller.updateColumnPreference(name,target.getAttribute(`data-${prefix}-column-key`)||target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`)||'',target instanceof HTMLInputElement?target.checked:undefined);refresh()}
      else if(name==='receive'||name==='detail')showDialog(target.dataset.id||'',name==='receive')
      else if(name==='close')close()
      else if(name==='close-image')el.querySelector('[data-tmf-output-image]')!.innerHTML=''
      else if(name==='image'){const row=getTmfOutputReceiptRows().find(r=>r.handover.id===target.dataset.id);if(row?.purchase?.materialImageUrl)el.querySelector('[data-tmf-output-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative bg-white p-3 rounded"><p>半成品参考图；不代表已截断或打头的实际产出 ${action('close-image','关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(row.purchase.materialImageUrl)}" alt="${e(row.purchase.materialName)}半成品参考图"></div></div>`}
      else if(name==='confirm'){
        const row=getTmfOutputReceiptRows().find(r=>r.handover.id===selected);if(!row)throw new Error('原交出记录不存在。')
        const value=(field:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-output-dialog] [name="${field}"]`)!.value.trim()
        if(value('production')!==row.demand.productionOrderNo)throw new Error('生产单不符，不能收作其他生产单产出。')
        if(!el.querySelector<HTMLInputElement>('[name="checked"]')!.checked)throw new Error('请核对实物长度、端头和合格状态；不一致时交主管处理。')
        receiveTmfOutputPackage({handoverId:row.handover.id,packageId:value('package'),demandId:row.demand.id,warehouseId:row.handover.warehouseId,location:value('location'),receivedPieces:Number(value('pieces'))},actor,operationId)
        close();refresh();el.querySelector('[data-tmf-output-feedback]')!.textContent='本次产出实收已保存；基础采购实收及连续料库存保持原账。'
      }
    }catch(error){const message=error instanceof Error?error.message:'保存失败';const feedback=el.querySelector('[data-tmf-output-error]')??el.querySelector('[data-tmf-output-feedback]');if(feedback)feedback.textContent=message}
  })
}
export function renderTmfOutputReceiptsPage(): string {
  state.currentPage=1;state.sort=null;controller.ensurePreferencesLoaded();const view=controller.getView();if(typeof window!=='undefined')requestAnimationFrame(bind)
  return `<div data-tmf-output-receipts>${renderStandardListPage({title:'织带／绳子加工产出收货',primaryActionsHtml:'<span class="text-xs text-slate-500">辅料仓 · 仓管演示身份</span>',feedbackHtml:'<p role="status" data-tmf-output-feedback class="text-sm text-blue-700"></p>',filtersHtml:`<div class="rounded border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">生产单 / 包号 / 交出单 / SKU<input name="keyword" value="${e(state.keyword)}" class="block rounded border p-2 mt-1 w-72 text-sm"></label><label class="text-xs">收货进度<select name="status" class="block border rounded p-2 mt-1 text-sm"><option value="">全部</option>${['待实收','部分实收','已收齐'].map(v=>`<option ${state.status===v?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="flex gap-2 mt-3">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,statsHtml:`<div data-tmf-output-stats>${stats()}</div>`,listTitle:`加工产出 · ${filtered().length} 包`,listActionsHtml:action('open-column-settings','列设置'),tableHtml:`<div data-tmf-output-table>${view.tableHtml}</div>`,paginationHtml:`<div data-tmf-output-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-tmf-output-columns>${controller.renderColumnSettings()}</div><div data-tmf-output-dialog></div><div data-tmf-output-image></div>`})}</div>`
}
