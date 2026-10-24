// @page-pattern: pda
import { centralWoolStockOperationRequest, centralWoolTransferBackRequest, saveCentralWoolStockOperation, centralWoolStockTargets, centralWoolPublicBalances, woolStockPositionKey, type CentralWoolStockOperationRequest } from './wool-stock-operation-model.ts'
import { resolveEnabledFactoryWarehouseLocation, resolveFactoryWarehouseLocation } from '../../data/fcs/factory-internal-warehouse-locations.ts'
import { wot, woolStockPositionLabel, woolStockOperationError } from './wool-stock-operation-view.ts'
import { centralWoolWarehouseReceipts, centralWoolStockSource } from './wool-warehouse-model.ts'
import { getWoolProcessReportEffectiveQty } from '../../data/fcs/wool-domain/queries.ts'
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput } from './frame.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { ct, cb, ce, centralFormalName, centralTime, centralNotice, centralErrorText } from './ui.ts'
import { wt, woolColorName, woolPieceName } from './wool-ui.ts'
import { dyeNumber, translateDyeNumber, dyeLocationLabel } from './dye-ui.ts'
import { centralWoolInitialFactory, centralWoolFactories, prepareCentralWool, assertCentralWoolActor } from './wool-model.ts'
import { centralWoolWarehouseHandovers, centralWoolWarehouseFacts, centralWoolYarnRequest, saveCentralWoolYarn, centralWoolAllocationRequest, saveCentralWoolAllocation,
  type CentralWoolStock, type CentralWoolPreparation, type CentralWoolYarnRequest, type CentralWoolAllocationRequest } from './wool-warehouse-model.ts'

const words = {
  zh: { issue:'纱线领用', return:'余纱退回', allocate:'纱线备料分配', preparation:'未关联备料', allocated:'已分配', left:'可分配', target:'分配到横机单', issueMax:'可领用', returnMax:'未退领用', confirmIssue:'确认领用', confirmReturn:'确认退回', confirmAllocate:'确认分配', amount:'本次数量 · kg', batch:'批次', choose:'选择加工单', history:'领退记录', noTarget:'暂无需要此纱线的未完单横机单', empty:'此库位暂无库存', source:'原接收单', sourceMissing:'实物已变化，重新读取。', quantity:'填写大于0的有效 kg 数量。', blocked:'当前实物不能进行此操作。', targetChanged:'目标单已变化，重新选择本厂同纱线横机单。', unassigned:'未关联加工单', originalPosition:'原默认库位', noLocation:'暂无库位库存', inputWarehouse:'待加工仓', outputWarehouse:'待交出仓', loadFailed:'资料未能读取，请重新读取。' },
  id: { issue:'Ambil benang', return:'Kembalikan sisa', allocate:'Alokasikan benang', preparation:'Stok belum dialokasikan', allocated:'Dialokasikan', left:'Sisa alokasi', target:'Order rajut tujuan', issueMax:'Bisa diambil', returnMax:'Belum dikembalikan', confirmIssue:'Konfirmasi ambil', confirmReturn:'Konfirmasi kembali', confirmAllocate:'Konfirmasi alokasi', amount:'Jumlah kali ini · kg', batch:'Lot', choose:'Pilih order', history:'Riwayat ambil & kembali', noTarget:'Belum ada order aktif yang membutuhkan benang ini', empty:'Belum ada stok di lokasi ini', source:'Penerimaan asal', sourceMissing:'Barang berubah. Muat ulang.', quantity:'Isi jumlah kg yang valid, lebih dari 0.', blocked:'Tindakan tidak tersedia untuk barang ini.', targetChanged:'Order tujuan berubah. Pilih order aktif dengan benang yang sama.', unassigned:'Belum terkait order', originalPosition:'Lokasi bawaan asal', noLocation:'Belum ada stok lokasi', inputWarehouse:'Bahan masuk', outputWarehouse:'Siap kirim', loadFailed:'Data belum terbaca. Muat ulang.' },
} as const
const lang = () => session.language, t = (key: keyof typeof words.zh) => words[lang()][key]
const qty = (n:number) => new Intl.NumberFormat(lang()==='id'?'id-ID':'zh-CN', { maximumSignificantDigits: 15 }).format(n)
const prefix='/fcs/pda/central/wool', base=prefix+'/warehouse'
type Pending = { kind:'allocate'; value:CentralWoolAllocationRequest } | { kind:'yarn'; value:CentralWoolYarnRequest } | { kind:'stock'; value:CentralWoolStockOperationRequest }
type Draft = { raw:string; reason?:string; position?:string; source?:string; positionSource?:string; pending?:Pending; committed?:boolean }
type View = { path:string; factoryId:string; actorId:string; facts?:ReturnType<typeof centralWoolWarehouseFacts>; error?:unknown;
  feedback?:string; feedbackError?:boolean; feedbackReason?:unknown; local?:URLSearchParams; busy:boolean; scan:string; blocked:boolean; limit:number; account:string; password:string; scanning?:boolean; scanIntent?:string; locationSearch?:string; locationLimit?:number; choosingPosition?:boolean; choosingStock?:boolean }
let view:View|undefined, sequence=0, listening=false, discardGeneration=0
const targetSelections=new Map<string,string>(), rootSelections=new Map<string,string>()
const drafts=new Map<string,Draft>(), root=()=>document.querySelector<HTMLElement>('[data-central-family="wool-stock"]')
const current=(v:View)=>view===v && appStore.getState().pathname===v.path
const params=(v:View)=>v.local||new URL(v.path,'https://pda.local').searchParams
const balance=(v:View)=>v.facts&&centralWoolPublicBalances(v.facts).find(b=>b.key===params(v).get('balance'))
const row=(v:View)=>balance(v)?.row||v.facts?.stocks.find(row=>row.stock.stockKey===params(v).get('stock'))
const prep=(v:View)=>v.facts?.preparation.find(row=>row.line.id===params(v).get('line'))
const action=(v:View)=>{const a=params(v).get('action');return a==='return'||a==='adjust'||a==='transfer'||a==='transferBack'?a:'issue'}
const stockOperation=(v:View)=>['adjust','transfer','transferBack'].includes(action(v))
const opText=(v:View)=>wot(lang(),action(v) as 'adjust'|'transfer'|'transferBack')
const locked=(v:View)=>[...drafts.entries()].find(([key,d])=>{const scope=JSON.parse(key);return scope[0]===v.factoryId&&scope[1]===v.actorId&&d.committed})
const target=(v:View)=>params(v).get('target')||''
const detailed=(v:View)=>!!params(v).get('stock')||!!params(v).get('line')||!!params(v).get('balance')
const draftKey=(v:View)=>JSON.stringify([v.factoryId,v.actorId,params(v).get('stock'),params(v).get('line'),prep(v)?'allocate':action(v),target(v),params(v).get('balance')])
const draft=(v:View)=>drafts.get(draftKey(v))||{raw:''}
const unsent=()=>[...drafts.values()].some(d=>!d.committed&&!!(d.raw.trim()||d.reason?.trim()||d.position))
registerCentralDraftDiscard(()=>{discardGeneration++;drafts.clear();targetSelections.clear();rootSelections.clear();if(view){view.scan='';view.scanIntent=undefined;view.scanning=false;view.blocked=false;view.feedback=undefined;view.account='';view.password=''}},unsent)
function url(v:View, values:Record<string,string|undefined>={}) {
  const u=new URL(base,'https://pda.local');const stage=params(v).get('stage');if(stage)u.searchParams.set('stage',stage)
  const detail=!!values.stock||!!values.line||!!values.balance
  if(detail)u.searchParams.set('from',params(v).get('from')||params(v).get('view')||'locations')
  else if(!Object.keys(values).length&&params(v).get('from'))u.searchParams.set('view',params(v).get('from')!)
  for(const [key,value] of Object.entries(values))if(value)u.searchParams.set(key,value)
  return u.pathname+u.search
}
function label(name:string,id?:string){if(lang()==='id'&&name==='毛织仓管（演示）')return 'Petugas gudang rajut (demo)';const actor=readFactoryPdaExecutionUsers(id?undefined:view?.factoryId).find(a=>id?a.userId===id:a.name===name);return centralFormalName(name,actor?.loginId||id||name,lang())}
function message(error:unknown) {
  const m=error instanceof Error?error.message:''
  if((error as {committed?:boolean})?.committed)return ct(lang(),'committed')
  if(m==='WST_quantity'||/DYE_(invalidQuantity|quantityRequired)/.test(m))return stockOperation(view!)?wot(lang(),'quantity'):t('quantity')
  if(m==='WST_limit'||/领用数量不能超过|累计退回不能超过|尚未分配的实收量/.test(m))return ct(lang(),'quantityMax')
  if(m==='WST_blocked')return t('blocked')
  if(m==='WST_source')return t('sourceMissing')
  if(m==='WST_target')return t('targetChanged')
  if(m==='WOOL_actor'||/分配人与当前账号/.test(m))return wt(lang(),'actor')
  if(m==='WOOL_changed')return ct(lang(),'changed')
  return woolStockOperationError(error,lang())
}
function field(label:string,value:string,key:string,password=false) {
  return `<label class="my-3 block text-[15px] font-semibold leading-6 text-[#1a293c]">${ce(label)}<input data-wst-field="${key}" type="${password?'password':'text'}" inputmode="${key==='quantity'?'decimal':'text'}" autocomplete="off" value="${ce(value)}" class="mt-1 h-[52px] w-full rounded-xl border border-[#bdcadb] bg-white px-3 text-[20px] font-semibold text-[#1a293c] outline-none focus:border-[#2461ed]"></label>`
}
function photo(url:string|undefined,name:string){return url?`<button type="button" data-central-action="wst-photo" data-central-value="${ce(url)}" class="h-20 w-20 shrink-0 rounded-lg border bg-white" aria-label="${ct(lang(),'photo')}"><img data-wst-photo src="${ce(url)}" alt="${ce(name)}" class="h-full w-full object-contain"></button>`:centralNotice(ct(lang(),'noPhoto'),true)}
function identity(v:View,r?:CentralWoolStock,p?:CentralWoolPreparation) {
  const code=r?.code||p!.line.material.sku,name=r?stockName(r):centralFormalName(p!.line.material.name,code,lang())
  return `<section class="my-3 rounded-xl border bg-white p-3"><div class="flex gap-3">${photo(r?.imageUrl||p?.line.material.imageUrl,name)}<div class="min-w-0"><strong class="break-words">${ce(name)}</strong><p class="mt-1 break-words">${ce(code)}</p>${p?`<p>${ce(lang()==='id'&&p.line.material.color==='奶油色系'?'Nuansa krem':centralFormalName(woolColorName(p.line.material.color,lang()),p.line.material.sku,lang()))}</p>`:''}</div></div>${r?.order?`<p class="mt-3 break-words">${ce(r.order.woolOrderNo)} · ${ce(r.order.productionOrderNo)}</p>`:''}<p class="mt-2 break-words">${t('batch')} · ${ce(r?.stock.batchNo||p?.line.material.batchNo||'—')}</p>${r?`<p class="mt-1 break-words">${ce(positionLabel(r))}</p>`:`<p class="mt-1 break-words">${t('source')} · ${ce(p!.line.sourceDocumentNo)}</p>`}</section>`
}
function stockName(r:CentralWoolStock){const piece=r.order?.externalPieces.find(p=>p.pieceKey===r.stock.objectSkuCode);return piece?woolPieceName(piece,lang()):centralFormalName(r.name,r.code,lang())}
function positionLabel(r:CentralWoolStock) {
  const p=r.position
  if(p)return [dyeLocationLabel(p.area.areaName,lang()),dyeLocationLabel(p.shelf.shelfNo,lang()),dyeLocationLabel(p.location.locationNo,lang())].filter(Boolean).join(' / ')
  return lang()==='id'?({'WOOL-WP-YARN-DEFAULT':'Lokasi bawaan benang','WOOL-WH-CUT-DEFAULT':'Lokasi bawaan potongan','WOOL-WH-GARMENT-DEFAULT':'Lokasi bawaan pakaian'}[r.stock.defaultLocationId]):({'WOOL-WP-YARN-DEFAULT':'纱线默认库位','WOOL-WH-CUT-DEFAULT':'裁片默认库位','WOOL-WH-GARMENT-DEFAULT':'成衣默认库位'}[r.stock.defaultLocationId])
}
function unit(r:CentralWoolStock){return r.stock.unit==='kg'?'kg':r.stock.unit==='片'?(lang()==='id'?'potong':'片'):(lang()==='id'?'pcs':'件')}
function request(v:View):Pending {
  const a=session.account;if(!a||a.factoryId!==v.factoryId||a.userId!==v.actorId)throw Error('WOOL_actor')
  const d=draft(v),n=dyeNumber(d.raw,lang(),null,action(v)==='adjust'),id=d.pending?.value.input
  const commandId=id&&('id' in id?id.id:id.commandId)||crypto.randomUUID(),at=id&&('at' in id?id.at: 'issuedAt' in id?id.issuedAt:'returnedAt' in id?id.returnedAt:id.operatedAt)||new Date().toISOString()
  const p=prep(v);if(p)return{kind:'allocate',value:centralWoolAllocationRequest(p,target(v),n,a,commandId,at)}
  const r=row(v);if(!r)throw Error('WST_source')
  if(stockOperation(v)){
    const b=balance(v),position=d.position?JSON.parse(d.position) as string[]:undefined
    if(action(v)==='transferBack'&&!b)throw Error('WST_source')
    const value=action(v)==='transferBack'&&b?centralWoolTransferBackRequest(b,n,d.reason||'',a,commandId,at)
      :centralWoolStockOperationRequest(r,action(v) as 'adjust'|'transfer',n,d.reason||'',position?{warehouseId:position[0],locationId:position[1]}:undefined,a,commandId,at)
    if(d.source&&d.source!==value.expectedSource||d.positionSource&&d.positionSource!==value.expectedTarget)throw Error('WOOL_changed')
    return{kind:'stock',value}
  }
  return{kind:'yarn',value:centralWoolYarnRequest(r,action(v) as 'issue'|'return',n,a,commandId,at)}
}

function primary(v:View):CentralPdaFrameInput['primary'] {
  if(session.signedOut)return{label:ct(lang(),'login'),action:'wst-login',disabled:v.busy||!v.account.trim()||!v.password}
  if(v.error||locked(v)||v.feedbackReason instanceof Error&&v.feedbackReason.message==='WOOL_changed')return{label:ct(lang(),'reload'),action:'wst-reload',disabled:v.busy}
  if(!session.account||!detailed(v))return
  const r=row(v),p=prep(v);if(!stockOperation(v)&&!p&&(!r||(action(v)==='issue'?!r.canIssue:!r.canReturn)))return
  if(p&&(!target(v)||!p.targets.some(o=>o.woolOrderId===target(v))||p.remainingQty<=0))return
  if(action(v)==='transferBack'&&balance(v)?.quantity===0)return{label:ct(lang(),'next'),action:'wst-next',disabled:v.busy}
  let valid=true,n=0;try{request(v);n=dyeNumber(draft(v).raw,lang(),null,action(v)==='adjust')}catch{valid=false}
  const allPhotos=[...root()?.querySelectorAll<HTMLImageElement>('[data-wst-photo]')||[]]
  valid=valid&&allPhotos.length>0&&allPhotos.every(img=>img.complete&&img.naturalWidth>0)
  if(stockOperation(v))return{label:wot(lang(),action(v)==='adjust'?'confirmAdjust':action(v)==='transferBack'?'confirmBack':'confirmTransfer')+(valid?' · '+qty(n)+' '+(r?unit(r):''):''),context:r?.order?.woolOrderNo,action:'wst-save',disabled:v.busy||!valid||v.blocked||!!v.scan.trim()}
  return{label:t(p?'confirmAllocate':action(v)==='issue'?'confirmIssue':'confirmReturn')+(n?' · '+qty(n)+' kg':''),
    context:p?p.targets.find(o=>o.woolOrderId===target(v))?.woolOrderNo:r?.order?.woolOrderNo,action:'wst-save',disabled:v.busy||!valid||v.blocked||!!v.scan.trim()}
}
function scanHtml(v:View){return `<div class="mb-3 flex gap-2"><input id="wst-scan" aria-label="${ct(lang(),'scan')}" placeholder="${ct(lang(),'scan')}" data-wst-field="scan" value="${ce(v.scan)}" autocomplete="off" enterkeyhint="search" class="h-14 min-w-0 flex-1 rounded-xl border border-[#bdcadb] bg-white px-3 text-[15px] text-[#1a293c] outline-none focus:border-[#2461ed]"><button type="button" class="min-h-14 shrink-0 rounded-xl bg-[#2461ed] px-4 text-[15px] font-semibold text-white" data-central-action="wst-scan">${ct(lang(),'identify')}</button></div>`}
function stockCard(v:View,r:CentralWoolStock){return `<article class="my-2 rounded-xl border bg-white p-3"><div class="flex gap-3">${photo(r.imageUrl,r.stock.objectType==='YARN'?r.code:wt(lang(),'reference')+' · '+r.code)}<div class="min-w-0"><strong class="block break-words">${ce(stockName(r))}</strong><p class="break-words">${ce(r.code)} · ${ce(r.stock.batchNo||'—')}</p>${r.stock.objectType!=='YARN'?`<p class="text-sm">${wt(lang(),'reference')}</p>`:''}</div></div><p class="mt-1 break-words">${ce(r.order?.woolOrderNo||t('unassigned'))}</p><p class="my-2">${ct(lang(),'stock')} · <strong>${qty(r.stock.currentQty)} ${unit(r)}</strong></p><div class="grid grid-cols-2 gap-2">${r.canIssue?cb(t('issue'),'wst-row',r.stock.stockKey):''}${r.canReturn?cb(t('return'),'wst-return',r.stock.stockKey):''}${r.order&&r.stock.currentQty>0?cb(wot(lang(),'transfer'),'wst-transfer',r.stock.stockKey):''}${r.order&&!r.stock.physicalLocationId?cb(wot(lang(),'adjust'),'wst-adjust',r.stock.stockKey):''}</div></article>`}
function chosenPosition(v:View){const key=draft(v).position;if(!key)return;const [warehouseId,locationId]=JSON.parse(key);return resolveFactoryWarehouseLocation(warehouseId,locationId)}
function operationFields(v:View,r:CentralWoolStock){
  const d=draft(v),b=balance(v),pos=chosenPosition(v),source=b&&resolveFactoryWarehouseLocation(b.flow.toWarehouseId!,b.flow.toLocationId!)
  if(action(v)==='transferBack'&&b?.quantity===0)return `<p class="my-3 font-bold">${wot(lang(),'left')} · 0 ${unit(r)}</p>`
  return `<p class="my-3">${wot(lang(),b?'left':'before')} · <strong>${qty(b?.quantity??r.stock.currentQty)} ${unit(r)}</strong></p>`
    +(source?`<p class="my-3 break-words">${wot(lang(),'source')} · ${ce(woolStockPositionLabel(source,lang()))}</p>`:'')
    +(action(v)==='transfer'?`<div class="my-3"><p class="mb-2 font-bold">${wot(lang(),'destination')}</p>${cb(pos?woolStockPositionLabel(pos,lang()):wot(lang(),'choose'),'wst-position-open')}</div>`:action(v)==='transferBack'?`<p class="my-3 break-words">${wot(lang(),'destination')} · ${ce(positionLabel(r))}</p>`:'')
    +field((action(v)==='adjust'?wot(lang(),'after'):ct(lang(),'thisQty'))+' · '+unit(r),d.raw,'quantity')
    +field(wot(lang(),'reason'),d.reason||'','reason')+`<p data-wst-field-error role="alert" class="my-2 text-red-700"></p>`
    +(d.raw||d.reason||d.position?cb(ct(lang(),'clear'),'wst-clear'):'')
}
function publicBalances(v:View){
 const rows=centralWoolPublicBalances(v.facts!).filter(b=>b.quantity>0)
 return rows.slice(0,v.limit).map(b=>{
  const p=resolveFactoryWarehouseLocation(b.flow.toWarehouseId!,b.flow.toLocationId!)
  return `<article class="my-3 rounded-xl border bg-white p-3"><strong class="block break-words">${ce(b.row.order!.woolOrderNo)} · ${ce(stockName(b.row))}</strong><p class="my-2 break-words">${p?ce(woolStockPositionLabel(p,lang())):ce(b.flow.toLocationId!)}</p><p>${ce(b.row.stock.batchNo||'—')}</p><p class="my-3">${wot(lang(),'left')} · ${qty(b.quantity)} ${unit(b.row)}</p>${cb(wot(lang(),'transferBack'),'wst-transfer-back',b.key)}</article>`
 }).join('')+(rows.length>v.limit?cb(ct(lang(),'more'),'wst-more'):'')||centralNotice(ct(lang(),'noRecords'))
}
function positionOptions(v:View){
 const r=row(v);if(!r)return'';const search=(v.locationSearch||'').trim().toLowerCase(),all=centralWoolStockTargets(r),matches=all.filter(p=>!search||[p.warehouse.factoryName,p.warehouse.warehouseId,p.location.locationId,p.location.locationNo,woolStockPositionLabel(p,lang())].some(s=>s.toLowerCase().includes(search)))
 return `<div class="flex items-start justify-between gap-2"><h2 class="my-2 text-xl font-bold">${wot(lang(),'choose')}</h2><button type="button" data-central-action="language" class="min-h-12 shrink-0 rounded-xl border p-3">${lang()==='id'?'ID':'中文'}</button></div><input data-wst-field="positionSearch" aria-label="${wot(lang(),'search')}" placeholder="${wot(lang(),'search')}" value="${ce(v.locationSearch||'')}" class="my-2 min-h-14 w-full rounded-xl border p-3" autocomplete="off"><div data-wst-position-options>${matches.slice(0,v.locationLimit||15).map(p=>cb(woolStockPositionLabel(p,lang()),'wst-position',woolStockPositionKey(p.warehouse.warehouseId,p.location.locationId))).join('')||centralNotice(wot(lang(),'noTarget'))}${matches.length>(v.locationLimit||15)?cb(ct(lang(),'more'),'wst-position-more'):''}</div>`
}
function showStockChoices(v:View){
 const scan=v.scan.trim().toUpperCase(),f=v.facts;if(!f)return
 const stocks=f.stocks.filter(r=>r.order&&[r.stock.stockKey,r.code,r.stock.batchNo,r.order.woolOrderNo,r.order.productionOrderNo,r.stock.physicalLocationId,r.position?.location.locationNo].some(x=>x?.toUpperCase()===scan))
 const preparation=f.preparation.filter(p=>[p.line.material.sku,p.line.material.batchNo,p.line.sourceDocumentNo,p.line.id,p.receipt.id].some(x=>x?.toUpperCase()===scan))
 const cards=[...stocks.map(r=>`<article data-wst-candidate class="my-2 flex items-start gap-2 rounded-xl border p-2">${photo(r.imageUrl,r.code)}<div class="min-w-0 flex-1">${r.stock.objectType!=='YARN'?`<p class="text-sm">${wt(lang(),'reference')}</p>`:''}${cb([r.order!.woolOrderNo,stockName(r)===r.code?r.code:stockName(r)+' · '+r.code,r.stock.batchNo,positionLabel(r),qty(r.stock.currentQty)+' '+unit(r)].filter(Boolean).join(' · '),'wst-row',r.stock.stockKey)}</div></article>`),
 ...preparation.map(p=>`<article data-wst-candidate class="my-2 flex items-start gap-2 rounded-xl border p-2">${photo(p.line.material.imageUrl,p.line.material.sku)}<div class="min-w-0 flex-1">${cb(t('preparation')+' · '+p.line.material.sku+' · '+(p.line.material.batchNo||'')+' · '+p.line.sourceDocumentNo+' · '+qty(p.remainingQty)+' kg','wst-preparation',p.line.id)}</div></article>`)]
 v.choosingStock=true
 overlay(v,`<div class="flex items-start justify-between gap-2"><h2 class="my-2 text-xl font-bold">${ct(lang(),'choose')}</h2><button type="button" data-central-action="language" class="min-h-12 shrink-0 rounded-xl border p-3">${lang()==='id'?'ID':'中文'}</button></div>`+cards.slice(0,v.limit).join('')+(cards.length>v.limit?cb(ct(lang(),'more'),'wst-scan-more'):'')||centralNotice(ct(lang(),'noRows')))
}
function showPositions(v:View){v.choosingPosition=true;overlay(v,positionOptions(v));const input=root()?.querySelector<HTMLInputElement>('[data-wst-field=positionSearch]');input?.focus()}
function stockLocations(v:View) {
  const kind=params(v).get('kind')==='out'?'out':'in',selected=params(v).get('location')
  const stocks=v.facts!.stocks.filter(r=>(kind==='in'?r.stock.objectType==='YARN':r.stock.objectType!=='YARN')&&(r.stock.currentQty>0||r.canReturn||r.stock.currentQty===0&&!!r.order&&!r.stock.physicalLocationId))
  const positionKey=(r:CentralWoolStock)=>r.stock.physicalLocationId?JSON.stringify([r.stock.physicalWarehouseId,r.stock.physicalLocationId]):JSON.stringify([r.stock.defaultLocationId])
  const locations=v.facts!.warehouses.filter(w=>w.warehouseKind===(kind==='in'?'WAIT_PROCESS':'WAIT_HANDOVER')&&w.isEnabled)
    .flatMap(w=>w.areaList.flatMap(a=>a.shelfList.flatMap(s=>s.locationList.map(l=>({key:JSON.stringify([w.warehouseId,l.locationId]),label:[dyeLocationLabel(a.areaName,lang()),dyeLocationLabel(s.shelfNo,lang()),dyeLocationLabel(l.locationNo,lang())].join(' / '),stopped:a.status==='STOPPED'||s.status==='STOPPED'||l.status==='STOPPED'})))))
  for(const r of stocks)if(!locations.some(l=>l.key===positionKey(r)))locations.push({key:positionKey(r),label:positionLabel(r),stopped:false})
  const occupied=new Set(stocks.map(positionKey));locations.sort((a,b)=>Number(occupied.has(b.key))-Number(occupied.has(a.key)))
  return `<div class="grid grid-cols-2 gap-2">${cb(t('inputWarehouse'),'wst-kind','in',kind==='in')}${cb(t('outputWarehouse'),'wst-kind','out',kind==='out')}</div>${locations.slice(0,v.limit).map(l=>`<section${selected===l.key?' data-wst-active-location':''} class="my-3 rounded-xl border bg-white p-3"><div class="grid">${cb(l.label+(l.stopped?' · '+ct(lang(),'locationStopped'):''),'wst-location',l.key,selected===l.key)}</div>${selected===l.key?stocks.filter(s=>positionKey(s)===l.key).slice(0,v.limit).map(s=>stockCard(v,s)).join('')||`<p class="mt-3">${t('empty')}</p>`:''}</section>`).join('')||centralNotice(t('noLocation'))}${locations.length>v.limit||stocks.filter(s=>positionKey(s)===selected).length>v.limit?cb(ct(lang(),'more'),'wst-more'):''}`
}
function allocations(v:View){return v.facts!.preparation.slice(0,v.limit).map(p=>`<article class="my-3 rounded-xl border bg-white p-3"><strong>${ce(centralFormalName(p.line.material.name,p.line.material.sku,lang()))}</strong><p class="break-words">${ce(p.line.material.sku)} · ${ce(p.line.material.batchNo)}</p><p class="mt-1 break-words">${t('source')} · ${ce(p.line.sourceDocumentNo)}</p><p class="my-2">${t('left')} · <strong>${qty(p.remainingQty)} kg</strong></p>${p.remainingQty>0?cb(t('allocate'),'wst-preparation',p.line.id):''}</article>`).join('')+(v.facts!.preparation.length>v.limit?cb(ct(lang(),'more'),'wst-more'):'')||centralNotice(ct(lang(),'noRows'))}
function factsOrder(id:string,v:View){return v.facts?.store.workOrders[id]?.woolOrderNo||'—'}
function records(v:View) {
  const which=params(v).get('view'),f=v.facts!
  if(which==='publicStock')return publicBalances(v)
  if(which==='productionRecords'){
   const rows=f.flows.filter(flow=>flow.businessType==='PROCESS_REPORT').slice().sort((a,b)=>b.operatedAt.localeCompare(a.operatedAt)||a.flowId.localeCompare(b.flowId))
   return rows.slice(0,v.limit).map(flow=>{const order=f.store.workOrders[flow.woolOrderId],piece=order?.externalPieces.find(p=>p.pieceKey===flow.objectSkuCode),report=f.store.processReports.find(r=>r.reportId===flow.sourceRecordId),amount=report?getWoolProcessReportEffectiveQty(f.store,report):flow.qty;return `<article data-wst-record class="my-3 space-y-2 rounded-xl border bg-white p-3"><strong>${ce(order?.woolOrderNo||'—')}</strong><p class="break-words">${ce(piece?woolPieceName(piece,lang()):flow.objectSkuCode)}</p><p>${qty(amount)} ${flow.unit==='片'?(lang()==='id'?'potong':'片'):flow.unit==='件'?(lang()==='id'?'pcs':'件'):'kg'}</p><p>${ce(label(flow.operatedBy))} · ${centralTime(flow.operatedAt,lang())}</p></article>`}).join('')+(rows.length>v.limit?cb(ct(lang(),'more'),'wst-more'):'')||centralNotice(ct(lang(),'noRecords'))
  }
  if(which==='operations')return f.flows.filter(f=>(f.businessType==='STOCK_TRANSFER'||f.businessType==='STOCK_ADJUSTMENT')&&f.physicalTransferDirection!=='IN').slice().sort((a,b)=>b.operatedAt.localeCompare(a.operatedAt)).slice(0,v.limit).map(f=>{const position=(w?:string,l?:string)=>{const p=w&&l&&resolveFactoryWarehouseLocation(w,l);return p?woolStockPositionLabel(p,lang()):({ 'WOOL-WP-YARN-DEFAULT':lang()==='id'?'Lokasi bawaan benang':'纱线默认库位','WOOL-WH-CUT-DEFAULT':lang()==='id'?'Lokasi bawaan potongan':'裁片默认库位','WOOL-WH-GARMENT-DEFAULT':lang()==='id'?'Lokasi bawaan pakaian':'成衣默认库位' }[l||'']||l||'—')};return `<article data-wst-record class="my-3 space-y-2 rounded-xl border bg-white p-3"><strong>${wot(lang(),f.businessType==='STOCK_ADJUSTMENT'?'adjust':'transfer')} · ${qty(f.qty)} ${f.unit==='片'?(lang()==='id'?'potong':'片'):f.unit==='件'?(lang()==='id'?'pcs':'件'):'kg'}</strong><p class="break-words">${ce(factsOrder(f.woolOrderId,v))} · ${ce(f.objectSkuCode)}</p><p>${ce(f.batchNo||'—')}</p>${f.flowType==='TRANSFER'?`<p class="break-words">${wot(lang(),'source')} · ${ce(position(f.fromWarehouseId,f.fromLocationId))}</p><p class="break-words">${wot(lang(),'destination')} · ${ce(position(f.toWarehouseId,f.toLocationId))}</p>`:''}<p class="break-words">${ce(f.reason||'')}</p><p>${ce(label(f.operatedBy))} · ${centralTime(f.operatedAt,lang())}</p></article>`}).join('')+(f.flows.filter(f=>f.businessType==='STOCK_TRANSFER'||f.businessType==='STOCK_ADJUSTMENT').length>v.limit?cb(ct(lang(),'more'),'wst-more'):'')||centralNotice(ct(lang(),'noRecords'))
  const rows=which==='receiveRecords'?centralWoolWarehouseReceipts(f,v.factoryId).map(r=>({at:r.at,id:r.id,html:`<strong>${ce(r.orderNo||t('unassigned'))} · ${ce(r.code)}</strong>${r.unit==='片'?`<p>${ce(r.piece?woolPieceName(r.piece,lang()):r.name)}</p>`:''}<p>${ce(r.batch||'—')}</p><p>${qty(r.quantity)} ${r.unit==='片'?(lang()==='id'?'potong':'片'):'kg'}</p><p class="break-words">${ct(lang(),'source')} · ${ce(r.source)}</p>${r.origin?`<p class="break-words">${ce(centralFormalName(r.origin.name,getFactoryMasterRecordById(r.origin.id)?.code||r.origin.id,lang()))}</p>`:''}<p>${ce(label(r.actorName,r.actorId))} · ${centralTime(r.at,lang())}</p>`}))
    :which==='handoffRecords'?centralWoolWarehouseHandovers(f).map(({record:r,quantity,receiptActor})=>{
      const unit=r.qtyUnit==='片'?(lang()==='id'?'potong':'片'):(lang()==='id'?'pcs':'件'),receipt=r.downstreamReceipt
      const piece=f.store.workOrders[r.woolOrderId]?.externalPieces.find(p=>p.pieceKey===r.pieceKey)
      const actual=receipt?.actualReceivedQty===undefined?(receipt?.status==='CONFIRMED'?wt(lang(),'actualUnknown'):ct(lang(),'awaiting')):qty(receipt.actualReceivedQty)+' '+unit
      return{at:r.handedOverAt,id:r.handoverId,html:`<strong>${ce(f.store.workOrders[r.woolOrderId].woolOrderNo)}</strong><p class="break-words">${ce(r.handoverId)}</p>${piece?`<p>${ce(woolPieceName(piece,lang()))}</p>`:''}<p>${qty(quantity)} ${unit}</p><p>${ct(lang(),'target')} · ${ce(centralFormalName(r.receiverName,r.receiverId,lang()))}</p><p>${wt(lang(),'handoverWorker')} · ${ce(label(r.handedOverBy))} · ${centralTime(r.handedOverAt,lang())}</p><p>${ct(lang(),'actual')} · ${actual}</p>${receipt?.status==='PENDING'&&receipt.actualReceivedQty!==undefined?`<p>${ct(lang(),'awaiting')} · ${qty(Math.max(0,quantity-receipt.actualReceivedQty))} ${unit}</p>`:''}${receipt?.receivedBy?`<p class="break-words">${wt(lang(),'receivedBy')} · ${ce(label(receipt.receivedBy,receiptActor?.operatorId))}</p>`:''}${receipt?.receivedAt?`<p>${centralTime(receipt.receivedAt,lang())}</p>`:''}`}
    })
    :f.flows.filter(r=>r.businessType==='YARN_ISSUE'||r.businessType==='YARN_RETURN').map(r=>({at:r.operatedAt,id:r.flowId,html:`<strong>${t(r.businessType==='YARN_ISSUE'?'issue':'return')} · ${qty(r.qty)} kg</strong><p class="break-words">${ce(f.store.workOrders[r.woolOrderId]?.woolOrderNo||'')} · ${ce(r.objectSkuCode)}</p><p>${t('batch')} · ${ce(r.batchNo||'—')}</p><p>${ce(label(r.operatedBy))} · ${centralTime(r.operatedAt,lang())}</p>`}))
  rows.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id))
  return rows.slice(0,v.limit).map(r=>`<article class="my-3 space-y-1 rounded-xl border bg-white p-3" data-wst-record>${r.html}</article>`).join('')+(rows.length>v.limit?cb(ct(lang(),'more'),'wst-more'):'')||centralNotice(ct(lang(),'noRecords'))
}
function content(v:View) {
  if(session.signedOut)return field(ct(lang(),'account'),v.account,'account')+field(ct(lang(),'password'),v.password,'password',true)+`<div data-wst-feedback>${v.feedback?centralNotice(v.feedback,true):''}</div>`
  if(v.error)return centralNotice(t('loadFailed'),true)
  if(!v.facts)return ''
  if(locked(v))return `<div data-wst-feedback>${centralNotice(ct(lang(),'committed'),true)}</div>`
  const r=row(v),p=prep(v),d=draft(v),feedback=`<div data-wst-feedback>${v.feedback?centralNotice(v.feedback,!!v.feedbackError):d.committed?centralNotice(ct(lang(),'committed'),true):''}</div>`
  if(detailed(v)&&stockOperation(v))return scanHtml(v)+feedback+(r?identity(v,r)+operationFields(v,r):centralNotice(t('sourceMissing'),true))
  if(detailed(v))return scanHtml(v)+feedback+(!r&&!p?centralNotice(t('sourceMissing'),true):identity(v,r,p)+(p?`<p class="my-3">${t('left')} · <strong>${qty(p.remainingQty)} kg</strong></p>${p.targets.length?`<label class="my-3 block font-bold">${t('target')}<select data-wst-field="target" class="mt-2 min-h-14 w-full rounded-xl border border-slate-400 bg-white p-3"><option value="">${t('choose')}</option>${p.targets.map(o=>`<option value="${ce(o.woolOrderId)}"${o.woolOrderId===target(v)?' selected':''}>${ce(o.woolOrderNo+' · '+o.styleNo)}</option>`).join('')}</select></label>`:centralNotice(t('noTarget'))}${target(v)?(()=>{const o=p.targets.find(o=>o.woolOrderId===target(v));return o?`<section class="my-3 flex gap-3 rounded-xl border bg-white p-3">${photo(o.styleImageUrl,o.styleNo)}<div class="min-w-0"><strong class="break-words">${ce(o.woolOrderNo)}</strong><p class="break-words">${ce(centralFormalName(o.styleName,o.styleNo,lang()))}</p><p>${ce(o.styleNo)}</p></div></section>`:''})():''}`:`<div class="my-3 grid grid-cols-2 gap-2">${r!.canIssue?cb(t('issue'),'wst-mode','issue',action(v)==='issue'):''}${r!.canReturn?cb(t('return'),'wst-mode','return',action(v)==='return'):''}</div><p class="my-3">${t(action(v)==='issue'?'issueMax':'returnMax')} · <strong>${qty(action(v)==='issue'?r!.stock.currentQty:r!.returnableQty)} kg</strong></p>`)+(!d.committed&&(p?p.remainingQty>0&&p.targets.some(o=>o.woolOrderId===target(v)):r&&(action(v)==='issue'?r.canIssue:r.canReturn))?field(t('amount'),d.raw,'quantity'):'')+`<p data-wst-field-error role="alert" class="my-2 text-red-700"></p>`+(d.raw&&!d.committed?cb(ct(lang(),'clear'),'wst-clear'):'')+(p&&p.allocations.length?`<details class="my-3 rounded-xl border bg-white p-3"><summary class="min-h-12 font-bold">${t('allocated')}</summary>${p.allocations.slice(0,v.limit).map(a=>`<p class="my-3">${ce(v.facts!.store.workOrders[a.woolOrderId||'']?.woolOrderNo||'—')} · ${qty(a.qty)} kg<br>${ce(label(a.operatorName))} · ${centralTime(a.at,lang())}</p>`).join('')}</details>`:''))
  const which=params(v).get('view')||'locations'
  return scanHtml(v)+feedback+`<label class="mb-3 block"><span class="sr-only">${ct(lang(),'locations')}</span><select data-wst-field="view" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 font-semibold">${[['locations',ct(lang(),'locations')],['allocation',t('allocate')],['receiveRecords',ct(lang(),'receiveRecords')],['history',t('history')],['productionRecords',lang()==='id'?'Riwayat hasil masuk':'加工入仓记录'],['operations',wot(lang(),'operations')],['publicStock',wot(lang(),'publicStock')],['handoffRecords',ct(lang(),'handoffRecords')]].map(([value,text])=>`<option value="${value}"${which===value?' selected':''}>${ce(text)}</option>`).join('')}</select></label>`+(which==='allocation'?allocations(v):which==='locations'?stockLocations(v):records(v))
}
function frame(v:View):CentralPdaFrameInput {
  const f=getFactoryMasterRecordById(v.factoryId),r=row(v),p=prep(v)
  return{family:'wool-stock',accountName:session.account?(lang()==='id'&&/[\u3400-\u9fff]/.test(session.account.name)&&session.account.loginId.startsWith(session.account.factoryId+'_')?session.account.loginId.slice(session.account.factoryId.length+1):label(session.account.name,session.account.userId)):'',accountNo:session.account&&label(session.account.name,session.account.userId)!==session.account.loginId?session.account.loginId:'',factoryName:centralFormalName(f?.name,f?.code||v.factoryId,lang()),operationName:wt(lang(),'wool'),language:lang(),tab:'warehouse',tabPathPrefix:prefix,
    heading:detailed(v)?stockOperation(v)?opText(v):t(p?'allocate':action(v)==='return'?'return':'issue'):undefined,backPath:detailed(v)?url(v):undefined,content:content(v),primary:primary(v)}
}
function patch(v:View,bodyOnly=false) {
  if(!current(v))return;const old=root();if(!old)return
  const scroll=old.querySelector('[data-central-content]')?.scrollTop||0,holder=document.createElement('div');holder.innerHTML=renderCentralPdaFrame(frame(v));const fresh=holder.firstElementChild as HTMLElement
  for(const selector of (bodyOnly?['[data-central-content]']:['header','[data-central-heading]','[data-central-content]','[data-central-footer]','nav'])){const a=old.querySelector(selector),b=fresh.querySelector(selector);if(a&&b)a.replaceWith(b);else if(a)a.remove();else if(b)old.append(b)}
  old.lang=fresh.lang;const main=old.querySelector('[data-central-content]');if(main)main.scrollTop=scroll
  hydrateIcons(old);mountCentralWoolWarehousePage();update(v)
}
function update(v:View) {
  if(!current(v))return;const host=root();if(host){host.dataset.wstBusy=String(v.busy);host.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-wst-field]').forEach(input=>input.disabled=v.busy&&!(v.scanning&&input.dataset.wstField==='scan'))}const p=primary(v),button=host?.querySelector<HTMLButtonElement>('[data-central-footer] button')
  if(p&&button){button.disabled=!!p.disabled;const text=button.firstChild;if(text?.nodeType===Node.TEXT_NODE)text.nodeValue=p.label;let span=button.querySelector('span');if(p.context){if(!span){span=document.createElement('span');span.className='block text-base leading-6';button.append(span)}span.textContent=p.context}else span?.remove()}
  const error=root()?.querySelector('[data-wst-field-error]');if(error){try{if(draft(v).raw)request(v);error.textContent=''}catch(e){error.textContent=message(e)}}
}
export async function renderCentralWoolWarehousePage(path:string,isCurrent=()=>true) {
  const n=++sequence,actual=appStore.getState().pathname;path=actual.split('?')[0]===path.split('?')[0]?actual:path
  const v:View={path,factoryId:session.currentFactory,actorId:session.account?.userId||'',busy:false,scan:'',blocked:false,limit:15,account:'',password:''};view=v
  try{await prepareCentralWool();if(n!==sequence||!isCurrent())return'';const requested=params(v).get('factoryId'),f=centralWoolInitialFactory([requested||'',session.currentFactory,session.preference.factoryId||'']);if(!f)throw Error('WOOL_actor');ensureCentralSessionAccount(f.id);v.factoryId=f.id;v.actorId=session.account?.userId||'';v.facts=centralWoolWarehouseFacts(f.id);const remembered=rootSelections.get(v.factoryId+'|'+v.actorId);if(!detailed(v)&&remembered){const requestedParams=params(v),previous=new URLSearchParams(remembered);if(!requestedParams.has('view')||requestedParams.get('view')===previous.get('view')){for(const [key,value]of requestedParams)previous.set(key,value);v.local=previous}}const p=prep(v),selected=p&&targetSelections.get(JSON.stringify([v.factoryId,v.actorId,p.line.id]));if(p&&!target(v)&&selected&&p.targets.some(o=>o.woolOrderId===selected)){v.local=new URLSearchParams(params(v));v.local.set('target',selected)}saveCentralSessionPreference()}catch(error){v.error=error}
  return n===sequence&&isCurrent()?renderCentralPdaFrame(frame(v)):''
}
function navigate(v:View,path:string){if(!current(v)||v.busy)return;closeCentralWoolWarehouseOverlay();if(path===v.path){v.scan='';v.blocked=false;v.feedback=v.feedbackReason=undefined;patch(v);return}if(root())root()!.dataset.wstBusy='true';root()?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button').forEach(el=>el.disabled=true);appStore.navigate(path)}
function focusScan(){const position=root()?.querySelector<HTMLInputElement>('[data-wst-overlay] [data-wst-field=positionSearch]');if(!position)closeCentralWoolWarehouseOverlay();const input=position||root()?.querySelector<HTMLInputElement>('[data-wst-field=scan]');input?.focus();input?.select()}
function overlay(v:View,html:string,returnAction='wst-close'){if(!current(v))return;document.querySelector('[data-wst-overlay]')?.remove();const el=document.createElement('div');el.dataset.wstOverlay='';el.dataset.wstReturn=returnAction;el.className='fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2';el.innerHTML=`<section role="dialog" aria-modal="true" class="flex max-h-[calc(100dvh-16px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white p-3"><div class="min-h-0 overflow-y-auto" data-wst-overlay-body>${html}</div><footer class="mt-3 shrink-0 border-t pt-3">${cb(ct(lang(),'back'),returnAction)}</footer></section>`;root()?.append(el);el.querySelector<HTMLButtonElement>('button')?.focus()}
export function closeCentralWoolWarehouseOverlay(){const el=document.querySelector('[data-wst-overlay]');if(!el)return false;el.remove();if(view){view.choosingPosition=false;view.choosingStock=false}return true}
async function refresh(v:View){await prepareCentralWool();const facts=centralWoolWarehouseFacts(v.factoryId);if(current(v)){v.facts=facts;v.error=undefined}return facts}
async function localChange(v:View,values:Record<string,string|undefined>,bodyOnly=false){
  if(!current(v)||v.busy)return;v.busy=true;if(root())root()!.dataset.wstBusy='true';root()?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('main input,main select,main button').forEach(el=>el.disabled=true)
  try{await refresh(v);if(!current(v))return;v.local=new URLSearchParams(params(v));for(const [key,value]of Object.entries(values)){if(value)v.local.set(key,value);else v.local.delete(key)}v.scan='';v.blocked=false;v.feedback=v.feedbackReason=undefined;v.limit=15
    const p=prep(v);if(p&&target(v))targetSelections.set(JSON.stringify([v.factoryId,v.actorId,p.line.id]),target(v));if(!detailed(v))rootSelections.set(v.factoryId+'|'+v.actorId,params(v).toString())
  }catch(e){if(current(v))v.error=e}finally{if(current(v)){v.busy=false;patch(v,bodyOnly&&!v.error);if(bodyOnly&&!v.error){if('view'in values||'kind'in values)root()?.querySelector('[data-central-content]')?.scrollTo({top:0});else if(values.location)root()?.querySelector('[data-wst-active-location]')?.scrollIntoView({block:'start'})}}}
}
async function identify(v:View){
 const scan=v.scan.trim().toUpperCase();if(!scan)return
 // Only the latest explicitly submitted scan selects an item. It never submits
 // a stock command or persists a queue. Keep scanner input live during this read.
 if(v.busy){if(v.scanning)v.scanIntent=scan;return}
 v.scanIntent=undefined;v.limit=15;v.scanning=true;v.busy=true;update(v);let readComplete=false
 try{
  const f=await refresh(v);readComplete=true;if(!current(v)||v.scanIntent&&v.scanIntent!==scan)return;v.busy=false
  const stocks=f.stocks.filter(r=>[r.stock.stockKey,r.code,r.stock.batchNo,r.order?.woolOrderNo,r.order?.productionOrderNo,r.stock.physicalLocationId,r.position?.location.locationNo].some(x=>x?.toUpperCase()===scan))
  const preparations=f.preparation.filter(p=>[p.line.material.sku,p.line.material.batchNo,p.line.sourceDocumentNo,p.line.id,p.receipt.id].some(x=>x?.toUpperCase()===scan))
  if(!stocks.length&&!preparations.length){v.blocked=true;v.feedback=ct(lang(),'wrongScan');v.feedbackError=true;patch(v);focusScan();return}
  const nextAction=(r:CentralWoolStock)=>r.canIssue?'issue':r.canReturn?'return':r.stock.currentQty>0?'transfer':'adjust'
  if(stocks.length===1&&stocks[0].order){
   const r=stocks[0],same=row(v)?.stock.stockKey===r.stock.stockKey
   navigate(v,url(v,{stock:r.stock.stockKey,action:same?action(v):nextAction(r)}));return
  }
  if(!stocks.some(r=>r.order)&&preparations.length===1){navigate(v,url(v,{line:preparations[0].line.id}));return}
  showStockChoices(v)
 }catch(e){if(current(v)&&!v.scanIntent){v.feedback=message(e);v.feedbackError=true;v.feedbackReason=e;patch(v)}}finally{if(current(v)){const next=v.scanIntent;v.scanIntent=undefined;v.busy=false;v.scanning=false;if(next&&(next!==scan||!readComplete)){v.scan=next;await identify(v)}else update(v)}}
}
async function save(v:View){const actor=session.account;if(!actor||v.busy||v.blocked)return;const recovery=locked(v),key=recovery?.[0]||draftKey(v),d=recovery?.[1]||draft(v),generation=discardGeneration;try{if(!d.pending){d.pending=request(v);drafts.set(key,d)}v.busy=true;v.feedback=undefined;patch(v);if(d.pending.kind==='allocate')await saveCentralWoolAllocation(d.pending.value,actor);else if(d.pending.kind==='stock')await saveCentralWoolStockOperation(d.pending.value,actor);else await saveCentralWoolYarn(d.pending.value,actor);d.committed=true;await refresh(v);drafts.delete(key);if(current(v)){v.feedback=ct(lang(),'saved');v.feedbackError=false;v.feedbackReason=undefined}}catch(e){if((e as{committed?:boolean})?.committed)d.committed=true;if(generation===discardGeneration)drafts.set(key,d);if(current(v)){v.feedback=d.committed?ct(lang(),'committed'):message(e);v.feedbackError=true;v.feedbackReason=e}}finally{if(current(v)){v.busy=false;patch(v)}}}
function logout(v:View){discardCentralDrafts();session.account=undefined;session.signedOut=true;saveCentralSessionPreference();v.actorId='';v.account='';v.password='';v.feedback=undefined;patch(v)}
export async function handleCentralWoolWarehouseEvent(target:Element,event?:Event) {
  const v=view;if(!v||!target.closest('[data-central-family="wool-stock"]')||!current(v))return false;if(root()?.dataset.wstPath!==v.path)return true
  const input=target.closest<HTMLInputElement|HTMLSelectElement>('[data-wst-field]'),key=input?.dataset.wstField
  if(event?.type==='keydown'){const e=event as KeyboardEvent;const dialog=root()?.querySelector('[data-wst-overlay]');if(e.key==='Tab'&&dialog){const nodes=[...dialog.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),select:not(:disabled)')],i=nodes.indexOf(document.activeElement as HTMLElement);if(e.shiftKey&&i<=0||!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[e.shiftKey?nodes.length-1:0]?.focus()}return true}if(e.key==='Escape'){e.preventDefault();if(dialog instanceof HTMLElement&&dialog.dataset.wstReturn==='wst-choice-return'){showStockChoices(v);return true}if(!closeCentralWoolWarehouseOverlay()&&!v.busy&&detailed(v))navigate(v,url(v))}else if(e.key==='F1'){e.preventDefault();focusScan()}else if(key==='quantity'&&e.key.length===1&&/[A-Za-z]/.test(e.key)){e.preventDefault();v.scan=e.key;const scan=root()?.querySelector<HTMLInputElement>('[data-wst-field=scan]');if(scan){scan.value=v.scan;scan.focus()}}else if(e.key==='Enter'&&input){e.preventDefault();if(key==='positionSearch'){const r=row(v),text=(v.locationSearch||'').trim().toLowerCase(),matches=r?centralWoolStockTargets(r).filter(p=>[p.location.locationId,p.location.locationNo].some(code=>code.toLowerCase()===text)):[];if(matches.length===1){const p=matches[0],d=draft(v);d.position=woolStockPositionKey(p.warehouse.warehouseId,p.location.locationId);d.positionSource=JSON.stringify(resolveEnabledFactoryWarehouseLocation(p.warehouse.warehouseId,p.location.locationId));d.source??=centralWoolStockSource(r!);delete d.pending;drafts.set(draftKey(v),d);v.blocked=false;v.feedback=v.feedbackReason=undefined;closeCentralWoolWarehouseOverlay();patch(v)}else{v.locationSearch=text;v.blocked=true;v.feedbackReason=Error('WOP_scan');v.feedback=message(v.feedbackReason);v.feedbackError=true;patch(v);showPositions(v)}}else if(key==='scan')await identify(v);else if(key==='password')await login(v);else root()?.querySelector<HTMLButtonElement>('[data-central-footer] button:not(:disabled)')?.focus()}return true}
  if(input&&(event?.type==='input'||event?.type==='change')){if(v.busy&&!(v.scanning&&key==='scan'))return true;if(key==='scan'&&event.type==='input')v.scan=input.value;if(key==='account')v.account=input.value;if(key==='password')v.password=input.value;if(key==='view'&&event.type==='change'){await localChange(v,{view:input.value,location:undefined},true);return true}if(key==='target'&&event.type==='change'){await localChange(v,{target:input.value});return true}if(key==='reason'){const d=draft(v);if(d.committed)return true;d.reason=input.value;d.source??=balance(v)?.expectedSource||(row(v)&&centralWoolStockSource(row(v)!));delete d.pending;if(d.raw||d.reason||d.position)drafts.set(draftKey(v),d);else drafts.delete(draftKey(v));v.feedback=v.feedbackReason=undefined}
    if(key==='positionSearch'){if(event.type!=='input')return true;v.locationSearch=input.value;v.locationLimit=15;const options=root()?.querySelector('[data-wst-position-options]');if(options){const holder=document.createElement('div');holder.innerHTML=positionOptions(v);options.replaceWith(holder.querySelector('[data-wst-position-options]')!)}return true}
    if(key==='quantity'){const d=draft(v);if(d.committed)return true;if(/[A-Za-z]/.test(input.value)){v.scan=input.value;input.value=d.raw;const scan=root()?.querySelector<HTMLInputElement>('[data-wst-field=scan]');if(scan){scan.value=v.scan;scan.focus()}return true}d.raw=input.value;delete d.pending;d.source??=balance(v)?.expectedSource||(row(v)&&centralWoolStockSource(row(v)!));if(d.raw.trim()||d.reason?.trim()||d.position)drafts.set(draftKey(v),d);else drafts.delete(draftKey(v));v.feedback=undefined;v.feedbackReason=undefined;const f=root()?.querySelector('[data-wst-feedback]');if(f)f.replaceChildren()}update(v);return true}
  if(event?.type!=='click')return true
  const nav=target.closest<HTMLElement>('[data-central-nav]');if(nav){const path=nav.dataset.centralNav!;navigate(v,params(v).get('stage')&&!path.includes('?')?path+'?stage='+params(v).get('stage'):path);return true}
  const button=target.closest<HTMLButtonElement>('[data-central-action]');if(!button||button.disabled||v.busy)return true
  const name=button.dataset.centralAction,value=button.dataset.centralValue||''
  try{switch(name){
    case'language':{const before=lang();session.language=before==='zh'?'id':'zh';for(const d of drafts.values())d.raw=translateDyeNumber(d.raw,before,lang());saveCentralSessionPreference();v.feedback=draft(v).committed?ct(lang(),'committed'):v.blocked?ct(lang(),'wrongScan'):v.feedbackReason?message(v.feedbackReason):undefined;patch(v);if(v.choosingPosition)showPositions(v);else if(v.choosingStock)showStockChoices(v);break}
    case'logout':if(hasCentralDrafts())overlay(v,centralNotice(ct(lang(),'unsent'))+cb(ct(lang(),'cancel'),'wst-close')+cb(ct(lang(),'discard'),'wst-logout'));else logout(v);break
    case'wst-logout':logout(v);break
    case'wst-login':await login(v);break
    case'wst-close':closeCentralWoolWarehouseOverlay();break
    case'wst-choice-return':showStockChoices(v);break
    case'wst-scan-more':v.limit+=15;showStockChoices(v);break
    case'wst-save':await save(v);break
    case'wst-next':navigate(v,url(v));break
    case'wst-reload':if(locked(v)){await save(v);break}await refresh(v);{const d=draft(v);d.pending=undefined;d.source=balance(v)?.expectedSource||(row(v)&&centralWoolStockSource(row(v)!));const p=chosenPosition(v);if(p)d.positionSource=JSON.stringify(resolveEnabledFactoryWarehouseLocation(p.warehouse.warehouseId,p.location.locationId))}v.feedback=v.feedbackReason=undefined;patch(v);break
    case'wst-scan':await identify(v);break
    case'wst-adjust':case'wst-transfer':{const r=v.facts?.stocks.find(r=>r.stock.stockKey===value);if(r)navigate(v,url(v,{stock:value,action:name==='wst-adjust'?'adjust':'transfer'}));break}
    case'wst-transfer-back':navigate(v,url(v,{balance:value,action:'transferBack'}));break
    case'wst-position-open':v.locationSearch='';v.locationLimit=15;showPositions(v);break
    case'wst-position-more':v.locationLimit=(v.locationLimit||15)+15;showPositions(v);break
    case'wst-position':{const r=row(v),p=r&&centralWoolStockTargets(r).find(p=>woolStockPositionKey(p.warehouse.warehouseId,p.location.locationId)===value);if(p){const d=draft(v);d.position=value;d.positionSource=JSON.stringify(resolveEnabledFactoryWarehouseLocation(p.warehouse.warehouseId,p.location.locationId));d.source??=centralWoolStockSource(r!);delete d.pending;drafts.set(draftKey(v),d);closeCentralWoolWarehouseOverlay();v.blocked=false;v.feedback=v.feedbackReason=undefined;patch(v)}break}
    case'wst-row':case'wst-return':{const r=v.facts?.stocks.find(r=>r.stock.stockKey===value);if(r)navigate(v,url(v,{stock:value,action:name==='wst-return'?'return':row(v)?.stock.stockKey===r.stock.stockKey?action(v):r.canIssue?'issue':r.canReturn?'return':r.stock.currentQty>0?'transfer':'adjust'}));break}
    case'wst-preparation':navigate(v,url(v,{line:value}));break
    case'wst-target':await localChange(v,{target:value});break
    case'wst-mode':await localChange(v,{action:value});break
    case'wst-clear':if(!draft(v).committed){drafts.delete(draftKey(v));v.blocked=false;v.feedback=v.feedbackReason=undefined;patch(v)}break
    case'wst-view':await localChange(v,{view:value,location:undefined},true);break
    case'wst-kind':await localChange(v,{kind:value,location:undefined},true);break
    case'wst-location':await localChange(v,{location:params(v).get('location')===value?undefined:value},true);break
    case'wst-more':v.limit+=15;patch(v);break
    case'wst-photo':{const img=[...root()?.querySelectorAll<HTMLImageElement>('[data-wst-photo]')||[]].find(img=>img.getAttribute('src')===value);if(img&&!img.naturalWidth){img.src=value;break}const returning=v.choosingStock;v.choosingStock=false;overlay(v,`<img src="${ce(value)}" alt="${ct(lang(),'photo')}" class="max-h-[70dvh] w-full object-contain">`,returning?'wst-choice-return':'wst-close');break}
    case'operation':overlay(v,centralWoolFactories().map(f=>cb(centralFormalName(f.name,f.code,lang()),'wst-factory',f.id)).join('')+`<button type="button" class="my-3 min-h-12 w-full rounded-xl border p-3" data-central-nav="/fcs/pda/central/warehouse">${ct(lang(),'back')}</button>`);break
    case'wst-factory':if(centralWoolFactories().some(f=>f.id===value))navigate(v,url(v,{factoryId:value}));break
  }}catch(e){if(current(v)){v.feedback=message(e);v.feedbackError=true;v.feedbackReason=e;patch(v)}}return true
}
async function login(v:View){if(v.error){try{await refresh(v)}catch(e){v.feedback=message(e);patch(v);return}}const a=readFactoryPdaExecutionUsers().find(a=>normalizePdaLoginId(a.loginId)===normalizePdaLoginId(v.account));if(!a||!verifyPdaPassword(v.password,a.passwordHash)){v.feedback=ct(lang(),'loginFail');patch(v);return}assertCentralWoolActor(a);discardCentralDrafts();session.account=a;session.currentFactory=a.factoryId;session.signedOut=false;saveCentralSessionPreference();navigate(v,url(v,{factoryId:a.factoryId}))}
export function mountCentralWoolWarehousePage(){const v=view,r=root();if(!v||!r||!current(v))return;r.dataset.wstPath=v.path;r.dataset.wstBusy=String(v.busy);r.dataset.wstView=params(v).get('view')||'locations';r.dataset.wstMode=action(v);r.dataset.wstTarget=target(v)
  if(v.busy)r.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button').forEach(el=>el.disabled=true)
  r.querySelectorAll<HTMLImageElement>('[data-wst-photo]').forEach(img=>{img.onload=()=>update(v);img.onerror=()=>{img.alt=ct(lang(),'photoFailed');update(v)};if(img.complete)update(v)})
  const resize=()=>{const r=root();if(r)r.style.height=Math.round(window.visualViewport?.height||innerHeight)+'px'}
  if(!listening){listening=true;window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('beforeunload',e=>{if(root()&&unsent()){e.preventDefault();e.returnValue=''}});window.addEventListener('keydown',e=>{const r=root();if(r&&!(e.target instanceof Element&&e.target.closest('[data-central-family="wool-stock"]'))&&['Escape','F1'].includes(e.key)){e.stopPropagation();void handleCentralWoolWarehouseEvent(r,e)}},true)}resize()
  if(!v.busy&&!document.querySelector('[data-wst-overlay]')&&(!document.activeElement||document.activeElement===document.body)){const input=r.querySelector<HTMLInputElement>(session.signedOut?'[data-wst-field=account]':detailed(v)&&r.querySelector('[data-wst-field=quantity]')?'[data-wst-field=quantity]':'[data-wst-field=scan]');input?.focus({preventScroll:true});if(detailed(v))input?.scrollIntoView({block:'center'})}
}
