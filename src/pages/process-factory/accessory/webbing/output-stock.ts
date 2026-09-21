// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { exportStandardListRows } from '../../../../components/ui/list-export.ts'
import { renderDialog } from '../../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../../components/shell.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfDemandVersionChange, getTmfPurchaseState, getTmfOutputPackageBalance, getTmfProductionDemandFulfillment, allocateTmfOutputPackage, releaseTmfOutputAllocation, issueTmfProductionPackage, splitTmfOutputPackage, moveTmfOutputPackage, freezeTmfSurplusPackage } from '../../../../data/pms/tmf-material-purchases.ts'

const prefix = 'tmf-output-stock'
const selector = '[data-tmf-output-stock]'
const actor = { id: 'TMF-DEMO-WAREHOUSE-SUPERVISOR', name: '辅料仓主管（演示）', role: '仓库主管' as const }
const state: ProcessOrderListControllerState & { keyword: string; status: string } = { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, keyword: '', status: '' }
const action = (name: string, text: string, id = '') => `<button type="button" class="rounded border px-2 py-1.5 text-xs ${['query','confirm'].includes(name) ? 'bg-blue-600 text-white' : ''}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${text}</button>`
/** 库存从有效包读取；不依赖原交出行，以保留回仓拆包后的子包。 */
export function getTmfOutputStockRows() {
  const data = getTmfPurchaseState()
  return data.packages.flatMap(pkg => {
    if (pkg.splitAt || !pkg.warehouseId || !pkg.location || !(pkg.receivedPieces ?? 0)) return []
    const demand = data.demands.find(d => d.id === pkg.demandId)
    if (!demand) return []
    const control = data.productionControls.find(c => c.productionOrderId === demand.productionOrderId)
    const balance = getTmfOutputPackageBalance(pkg.id)
    const allocations = data.outputAllocations.filter(a => a.packageId === pkg.id).map(a => ({ ...a,
      unissuedPieces: a.allocatedPieces - a.releasedPieces - data.productionIssues.filter(i => i.allocationId === a.id).reduce((sum,i) => sum+i.dispatchedPieces,0) }))
    return [{ pkg, demand, balance, allocations, fulfillment: getTmfProductionDemandFulfillment(demand.id),
      purchase: data.orders.find(p => p.materialSkuId === pkg.materialSkuId),
      status: pkg.surplusFreeze ? '余量冻结待处置' : (control && control.status !== 'ACTIVE') || getTmfDemandVersionChange(demand) ? '受限待处理' : balance.onHandPieces ? '仓内有货' : balance.productionTransitPieces ? '生产领料在途' : '已发完' }]
  })
}
type Row = ReturnType<typeof getTmfOutputStockRows>[number]
const filtered = () => getTmfOutputStockRows().filter(r => (!state.status || r.status===state.status) && (!state.keyword || [r.pkg.id,r.demand.productionOrderNo,r.pkg.materialSkuId,r.pkg.location,r.demand.specification.usage].join(' ').toLowerCase().includes(state.keyword.toLowerCase())))
const tip = (method: string) => ({ NONE:'无端头', METAL:'金属头', PLASTIC_WRAP:'塑料包头', SILICONE_DIP:'硅胶浸头' }[method] ?? method)
const spec = (r: Row) => `<div>下料 ${r.pkg.actualCutLengthMm}mm；成品 ${r.pkg.actualFinishedLengthMm}mm</div><div class="text-xs">A：${e(tip(r.pkg.endA.method))} ${e(r.pkg.endA.specification)}<br>B：${e(tip(r.pkg.endB.method))} ${e(r.pkg.endB.specification)}</div>`
const columns: StandardListColumn<Row>[] = [
  { key:'package',title:'包号 / 库位',width:210,required:true,freezeable:true,sortable:true,sortValue:r=>r.pkg.id,render:r=>`<strong class="break-all">${e(r.pkg.id)}</strong><div>${e(r.pkg.location??'')}</div>${r.pkg.parentPackageId?`<div class="text-xs">拆自 ${e(r.pkg.parentPackageId)}</div>`:''}` },
  { key:'source',title:'生产需求 / 半成品',width:270,required:true,render:r=>`<div>${e(r.demand.productionOrderNo)} · ${e(r.demand.garmentSize)} · ${e(r.demand.specification.usage)}</div><div class="flex gap-2 mt-1">${r.purchase?.materialImageUrl?`<button data-${prefix}-action="image" data-id="${e(r.pkg.id)}" data-skip-page-rerender="true"><img class="w-10 h-10 rounded object-cover border" src="${e(r.purchase.materialImageUrl)}" alt="${e(r.purchase.materialName)}半成品参考图"></button>`:''}<div class="text-xs break-all">${e(r.pkg.materialSkuId)}<div class="text-amber-700">真实实拍替代图${r.purchase?.materialImageUrl?'；图为半成品参考':''}</div></div></div>` },
  { key:'spec',title:'实际长度 / 端头',width:240,required:true,render:spec },
  { key:'stock',title:'实存 / 占用 / 可分配',width:175,required:true,render:r=>`${r.balance.onHandPieces} / ${r.balance.reservedPieces} / ${r.balance.availablePieces} ${r.pkg.unit}` },
  { key:'issue',title:'已发 / 在途 / 生产实收',width:185,required:true,render:r=>`${r.balance.issuedPieces} / ${r.balance.productionTransitPieces} / ${r.balance.productionReceivedPieces} ${r.pkg.unit}` },
  { key:'need',title:'对应需求 / 剩余缺口',width:185,required:true,render:r=>`${r.fulfillment.requiredPieces} / ${r.fulfillment.shortagePieces} ${r.pkg.unit}<div class="text-xs">${e(r.fulfillment.status)}；按生产实收计算</div>` },
  { key:'state',title:'库存状态',width:135,render:r=>r.status },
  { key:'actions',title:'操作',width:220,required:true,actionColumn:true,render:r=>`<div class="flex gap-1 flex-wrap">${action('detail','详情',r.pkg.id)}${r.pkg.receivedPieces===r.pkg.pieces&&r.balance.onHandPieces>0&&!r.balance.reservedPieces&&!r.balance.issuedPieces&&!r.pkg.surplusFreeze?action('freeze','冻结余量',r.pkg.id):''}${r.balance.onHandPieces>0?action('move','移库',r.pkg.id):''}${r.pkg.receivedPieces===r.pkg.pieces&&!r.balance.reservedPieces&&!r.balance.issuedPieces&&r.status!=='受限待处理'&&!r.pkg.surplusFreeze?action('split','拆包',r.pkg.id):''}${r.balance.availablePieces>0?action('allocate','分配',r.pkg.id):''}${r.balance.reservedPieces>0&&r.status!=='受限待处理'?action('issue','发料',r.pkg.id):''}${r.balance.reservedPieces>0?action('release','释放占用',r.pkg.id):''}</div>` },
]
const controller = createProcessOrderListController({state,columns,eventPrefix:prefix,rootSelector:selector,preferenceKey:'higood:list:/wls/accessory-production-stock',tableSurfaceSelector:'[data-tmf-stock-table]',paginationSurfaceSelector:'[data-tmf-stock-pagination]',overlaysSurfaceSelector:'[data-tmf-stock-columns]',getRows:filtered,locallyManagedEvents:true,pageSizeOptions:[10,20,50],defaultFrozenKeys:['package'],columnSettingsTitle:'加工产出库存列设置',emptyText:'暂无已回仓实收的加工产出包。'})
const stats=()=>{const rows=filtered();return renderStandardListStats([{label:'当前查询',value:`${rows.length} 包`},{label:'仓内有货',value:`${rows.filter(r=>r.balance.onHandPieces>0).length} 包`},{label:'领料在途',value:`${rows.filter(r=>r.balance.productionTransitPieces>0).length} 包`}])}
const root=()=>document.querySelector<HTMLElement>(selector)
const refresh=()=>{controller.refresh({overlays:true});const el=root();if(!el)return;el.querySelector('[data-tmf-stock-stats]')!.innerHTML=stats();const heading=el.querySelector('[data-standard-list-table-section] > header h2');if(heading)heading.textContent=`加工产出库存 · ${filtered().length} 包`}
let selected='',currentAction='',operationId='',expectedFreezePieces=0
const close=()=>{const el=root()?.querySelector('[data-tmf-stock-dialog]');if(el)el.innerHTML='';selected=currentAction=operationId=''}
function open(name:string,id:string){
  const row=getTmfOutputStockRows().find(r=>r.pkg.id===id);if(!row)throw new Error('此包已失效或尚未实收，请刷新核对。')
  selected=id;currentAction=name;expectedFreezePieces=row.balance.onHandPieces;operationId=`tmf-stock-ui:${crypto.randomUUID()}`
  const input=(field:string,label:string,type='text')=>`<label class="block text-sm mt-3">${label}<input name="${field}" type="${type}" class="mt-1 w-full rounded border p-2" ${type==='number'?'min="1" step="1"':''}></label>`
  let content=`<div class="max-h-[60vh] overflow-y-auto"><p>${e(row.demand.productionOrderNo)} · ${e(row.demand.garmentSize)} · ${e(row.demand.specification.usage)}</p><p>包 ${e(row.pkg.id)}；库位 ${e(row.pkg.location??'')}</p>${spec(row)}<p class="mt-2">实存 ${row.balance.onHandPieces}，占用 ${row.balance.reservedPieces}，可分配 ${row.balance.availablePieces} ${row.pkg.unit}</p><p class="text-xs text-slate-500">操作身份：${e(actor.name)}</p>`
  if(row.pkg.surplusFreeze)content+=`<p class="mt-2 text-amber-700">余量冻结 ${row.pkg.surplusFreeze.pieces} ${row.pkg.unit} · ${e(row.pkg.surplusFreeze.frozenAt)} · ${e(row.pkg.surplusFreeze.actor.name)}<br>${e(row.pkg.surplusFreeze.reason)}</p>`
  if(name==='freeze')content+=input('package','扫描独立余量包号')+input('reason','余量冻结原因')+`<p class="mt-2 text-xs">仅冻结本包实存 ${row.balance.onHandPieces} ${row.pkg.unit}。须先足额分配正常需求；冻结不减少实存，不转回米料，不能拆包或发料。</p><label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">已核对整包余量与实际规格，确认冻结待处置</label>`
  if(name==='allocate')content+=input('pieces',`本次分配（${row.pkg.unit}）`,'number')+input('receiver','生产接收人员标识')+input('organization','生产接收组织标识')+'<p class="mt-2 text-xs">分配保留原生产单和规格，不自动调剂其他需求。接收组织和人员为演示输入，正式来源仍需接入生产计划。</p>'
  if(name==='issue'||name==='release')content+=`<label class="block mt-3 text-sm">本次分配记录<select name="allocation" class="w-full border rounded p-2">${row.allocations.filter(a=>a.unissuedPieces>0).map(a=>`<option value="${e(a.id)}">${e(a.receiverOrganizationId)} / ${e(a.receiverId)} · 待发 ${a.unissuedPieces}${row.pkg.unit}</option>`).join('')}</select></label>`+input('pieces',`本次数量（${row.pkg.unit}）`,'number')+(name==='issue'?input('package','扫描或输入实物包号')+input('production','扫描或输入生产单号'):'')+(name==='release'?input('reason','释放原因'):'')+`<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">${name==='issue'?'已核对包、规格、实物数量和接收方，确认交出':'确认释放尚未发出的占用，不撤销已发料'}</label>`
  if(name==='split')content+=input('package','扫描原包号')+input('firstPackage','第一子包号')+input('pieces',`第一子包数量（${row.pkg.unit}）`,'number')+input('secondPackage','剩余子包号')+`<p class="mt-2 text-xs">剩余子包数量由系统计算：原包 ${row.pkg.pieces} 减第一子包。原包拆后失效，两子包保留原需求和规格。</p><label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">已核对实物，确认拆为两包</label>`
  if(name==='move')content+=input('package','扫描实物包号')+input('fromLocation','扫描原库位')+input('toLocation','目标库位')+input('reason','移库原因')+'<p class="text-xs mt-2">仅移动本包仓内剩余实物；占用、规格及已发料记录保持。</p><label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">已核对实物和目标库位，确认同仓移库</label>'
  if(name==='detail')content+=`<p>已发 ${row.balance.issuedPieces}；在途 ${row.balance.productionTransitPieces}；生产实收 ${row.balance.productionReceivedPieces} ${row.pkg.unit}</p><p>需求缺口 ${row.fulfillment.shortagePieces} ${row.pkg.unit}，${e(row.fulfillment.status)}</p>${row.allocations.map(a=>`<p class="mt-2 text-xs">${e(a.id)}：分配 ${a.allocatedPieces}，释放 ${a.releasedPieces}，待发 ${a.unissuedPieces}；接收 ${e(a.receiverOrganizationId)} / ${e(a.receiverId)}</p>`).join('')}`
  if(name==='detail')content+=getTmfPurchaseState().operations.filter(op=>op.objectId===row.pkg.id&&op.action==='加工产出同仓移库').map(op=>`<p class="text-xs mt-2">${e(op.occurredAt)} · ${e(op.actor.name)}：${e(op.reason)}；${op.quantity} ${e(op.unit??'')}</p>`).join('')
  content+='</div><p role="alert" class="text-red-700 text-sm" data-tmf-stock-error></p>'
  const el=root()!.querySelector('[data-tmf-stock-dialog]')!;el.innerHTML=renderDialog({title:({allocate:'按生产单分配',issue:'按已分配需求发料',release:'释放未发占用',detail:'加工产出库存详情',split:'按实际数量拆包',move:'加工产出同仓移库',freeze:'冻结超需求余量'} as Record<string,string>)[name],width:'lg',closeAction:{prefix,action:'close',skipPageRerender:true}},content,action('close','关闭')+(name==='detail'?'':action('confirm',name==='issue'?'确认发料':'确认')));hydrateIcons(el);el.setAttribute('tabindex','-1');(el as HTMLElement).focus({preventScroll:true})
}
function bind(){
 const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true';controller.installColumnDragEvents()
 el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
 el.addEventListener('change',event=>{const field=event.target as HTMLSelectElement;if(field.getAttribute(`data-${prefix}-field`)==='pageSize'){controller.setPageSize(Number(field.value));refresh()}})
 el.addEventListener('keydown',event=>{if(event.key==='Escape'){const image=el.querySelector('[data-tmf-stock-image]')!;if(image.innerHTML){image.innerHTML='';return}close();state.showColumnSettings=false;controller.refresh({table:false,pagination:false,overlays:true})}})
 el.addEventListener('click',event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!target)return;event.stopPropagation();const name=target.getAttribute(`data-${prefix}-action`)!
  try{
   if(name==='query'){state.keyword=el.querySelector<HTMLInputElement>('[name="keyword"]')!.value.trim();state.status=el.querySelector<HTMLSelectElement>('[name="status"]')!.value;state.currentPage=1;refresh()}
   else if(name==='reset'){state.keyword=state.status='';el.querySelector<HTMLInputElement>('[name="keyword"]')!.value='';el.querySelector<HTMLSelectElement>('[name="status"]')!.value='';state.currentPage=1;state.sort=null;refresh()}
   else if(name==='export')exportStandardListRows({fileName:'加工产出库存',columns,rows:filtered()})
   else if(name==='prev-page'||name==='next-page'){controller.stepPage(name==='prev-page'?-1:1);refresh()}
   else if(name==='sort-column'){controller.cycleSort(target.dataset.columnKey||'');refresh()}
   else if(name==='open-column-settings'||name==='close-column-settings'){state.showColumnSettings=name==='open-column-settings';controller.refresh({table:false,pagination:false,overlays:true})}
   else if(name==='restore-column-settings'){controller.restorePreferences();refresh()}
   else if(name==='toggle-column-visibility'||name==='toggle-column-freeze'){controller.updateColumnPreference(name,target.getAttribute(`data-${prefix}-column-key`)||target.closest(`[data-${prefix}-column-key]`)?.getAttribute(`data-${prefix}-column-key`)||'',target instanceof HTMLInputElement?target.checked:undefined);refresh()}
   else if(['allocate','issue','release','detail','split','move','freeze'].includes(name))open(name,target.dataset.id||'')
   else if(name==='close')close()
   else if(name==='close-image')el.querySelector('[data-tmf-stock-image]')!.innerHTML=''
   else if(name==='image'){const row=getTmfOutputStockRows().find(r=>r.pkg.id===target.dataset.id);if(row?.purchase?.materialImageUrl)el.querySelector('[data-tmf-stock-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" aria-label="关闭大图" data-skip-page-rerender="true"></button><div class="relative bg-white rounded p-3"><p>半成品参考图；真实实拍替代图 ${action('close-image','关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(row.purchase.materialImageUrl)}" alt="${e(row.purchase.materialName)}半成品参考图"></div></div>`}
   else if(name==='confirm'){
    const row=getTmfOutputStockRows().find(r=>r.pkg.id===selected);if(!row)throw new Error('此包已不存在，请刷新核对。')
    const value=(field:string)=>el.querySelector<HTMLInputElement>(`[data-tmf-stock-dialog] [name="${field}"]`)?.value.trim()??''
    const pieces=Number(value('pieces'))
    if(currentAction==='freeze'){
     if(value('package')!==row.pkg.id)throw new Error('请扫描正确的独立余量包号。')
     freezeTmfSurplusPackage({packageId:row.pkg.id,expectedPieces:expectedFreezePieces,reason:value('reason'),confirmed:!!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked},actor,operationId)
    }
    else if(currentAction==='split'||currentAction==='move'){
     if(value('package')!==row.pkg.id||!el.querySelector<HTMLInputElement>('[name="confirmed"]')?.checked)throw new Error('请扫描正确包号并确认本次实物操作。')
     if(currentAction==='split')splitTmfOutputPackage(row.pkg.id,[{id:value('firstPackage'),pieces},{id:value('secondPackage'),pieces:row.pkg.pieces-pieces}],actor,operationId)
     else moveTmfOutputPackage({packageId:row.pkg.id,warehouseId:row.pkg.warehouseId!,fromLocation:value('fromLocation'),toLocation:value('toLocation'),reason:value('reason')},actor,operationId)
    }
    else if(currentAction==='allocate')allocateTmfOutputPackage({allocationId:`${operationId}:allocation`,packageId:row.pkg.id,demandId:row.demand.id,pieces,receiverId:value('receiver'),receiverOrganizationId:value('organization')},actor,operationId)
    else{
     if(!el.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked)throw new Error('请核对本次数量及接收/释放要求后确认。')
     if(!row.allocations.some(a=>a.id===value('allocation')&&a.unissuedPieces>0))throw new Error('分配记录不属于此包或已无待发数量。')
     if(currentAction==='release')releaseTmfOutputAllocation(value('allocation'),pieces,value('reason'),actor,operationId)
     else if(currentAction==='issue'){
      if(value('production')!==row.demand.productionOrderNo)throw new Error('生产单不符，不能发给其他需求。')
      issueTmfProductionPackage({issueId:`${operationId}:issue`,allocationId:value('allocation'),packageId:value('package'),demandId:row.demand.id,warehouseId:row.pkg.warehouseId!,pieces},actor,operationId)
     }
    }
    close();refresh();el.querySelector('[data-tmf-stock-feedback]')!.textContent='已保存，请核对当前库存与需求。生产满足量仍按领料方实际接收计算。'
   }
  }catch(error){const feedback=el.querySelector('[data-tmf-stock-error]')??el.querySelector('[data-tmf-stock-feedback]');if(feedback)feedback.textContent=error instanceof Error?error.message:'保存失败'}
 })
}
export function renderTmfOutputStockPage():string{
 state.currentPage=1;state.sort=null;controller.ensurePreferencesLoaded();const view=controller.getView();if(typeof window!=='undefined')requestAnimationFrame(bind)
 return `<div data-tmf-output-stock>${renderStandardListPage({title:'辅料生产加工产出库存',primaryActionsHtml:'<span class="text-xs text-slate-500">辅料仓主管 · 演示身份</span><button class="rounded border px-3 py-2 text-sm" data-nav="/wls/accessory-receipts">辅料仓收货</button>',feedbackHtml:'<p role="status" data-tmf-stock-feedback class="text-sm text-blue-700"></p>',filtersHtml:`<div class="rounded border bg-white p-3"><div class="flex gap-3 flex-wrap"><label class="text-xs">生产单 / 包号 / SKU / 库位<input name="keyword" value="${e(state.keyword)}" class="block mt-1 border rounded p-2 w-72 text-sm"></label><label class="text-xs">库存状态<select name="status" class="block mt-1 border rounded p-2 text-sm"><option value="">全部</option>${['仓内有货','生产领料在途','已发完','受限待处理','余量冻结待处置'].map(v=>`<option ${state.status===v?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="flex gap-2 mt-3">${action('query','查询')}${action('reset','重置')}${action('export','导出')}</div></div>`,statsHtml:`<div data-tmf-stock-stats>${stats()}</div>`,listTitle:`加工产出库存 · ${filtered().length} 包`,listActionsHtml:action('open-column-settings','列设置'),tableHtml:`<div data-tmf-stock-table>${view.tableHtml}</div>`,paginationHtml:`<div data-tmf-stock-pagination>${view.paginationHtml}</div>`,overlaysHtml:`<div data-tmf-stock-columns>${controller.renderColumnSettings()}</div><div data-tmf-stock-dialog></div><div data-tmf-stock-image></div>`})}</div>`
}
