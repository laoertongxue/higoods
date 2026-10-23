// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { readWashingState } from '../../data/fcs/fabric-washing-repository.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { cb, ce, ct, centralNotice, centralFormalName, centralTime } from './ui.ts'
import { translateDyeNumber } from './dye-ui.ts'
import { cwt, washingError, washingNumber as n, washingUnit } from './washing-ui.ts'
import { washingIdentity, washingPhoto, washingCard, washingInputField, renderWashingForm, renderWashingReceipts, renderWashingRollSummary, washingTotals } from './washing-view.ts'
import { renderWashingPrintPreview, renderWashingPrintDocument } from './washing-print.ts'
import type { WashingOrder } from '../../data/fcs/fabric-washing-model.ts'
import { renderWashingWarehouse, type WashingWarehouseUi } from './washing-warehouse.ts'
import { prepareCentralWashing, centralWashingOrders, centralWashingOrder, centralWashingFactories, centralWashingRevision, centralWashingRolls, centralWashingCanComplete, centralWashingInput, centralWashingQuantityChanges, scanCentralWashingRoll, findCentralWashingOrders, saveCentralWashing, assertCentralWashingActor, type CentralWashingAction, type CentralWashingCommand, type CentralWashingDraft } from './washing-model.ts'

const prefix='/fcs/pda/central/wash'
type Ui={view:'work'|'handoff'|'receipt';action:'start'|'output';receiptScope:string;limit:number}
type Notice={error?:unknown;saved?:boolean}
type PrintPreview={scope:string;snapshot:WashingOrder;revision:string;document:string;ready:boolean;pending:boolean}
let printPreview:PrintPreview|undefined
type Confirmation={scope:string;command:CentralWashingCommand;operationId:string;revision:string;action?:CentralWashingAction;draftKey?:string;selected:string[]}
let pendingRoll:{factoryId:string;accountId:string;orderId:string;code:string}|undefined
let draftEpoch=0
let path='',scan='',mounted=false,saving=false,reading=false,patching=false,login={account:'',password:''},confirmation:Confirmation|undefined,logoutScope=''
const states=new Map<string,Ui>(),drafts=new Map<string,CentralWashingDraft>(),messages=new Map<string,Notice>(),recoveries=new Map<string,{run?:()=>Promise<unknown>;done?:()=>void}>(),warehouses=new Map<string,WashingWarehouseUi>()
const root=()=>document.querySelector<HTMLElement>('[data-central-family="washing"]')
const focusedRoots=new WeakSet<HTMLElement>()
const lang=()=>session.language
const busy=()=>saving||reading
const text=(key:Parameters<typeof cwt>[1])=>cwt(lang(),key)
const tabPath=(tab:CentralPdaTab)=>prefix+'/'+tab
function route(){const match=path.split(/[?#]/)[0].match(/^\/fcs\/pda\/central\/wash\/(receive|execute|warehouse)(?:\/(.+))?$/);return{tab:(match?.[1]||'receive')as CentralPdaTab,id:match?.[2]?decodeURIComponent(match[2]):''}}
const scope=()=>session.currentFactory+'|'+(session.account?.userId||'')+'|'+route().id
function ui(){const key=scope();if(!states.has(key))states.set(key,{view:'work',action:'output',receiptScope:'',limit:15});return states.get(key)!}
function action():CentralWashingAction|undefined {
 const {tab,id}=route(),o=centralWashingOrder(id,session.currentFactory)
 if(!o||tab==='warehouse')return undefined
 if(tab==='receive')return centralWashingRolls(o,'receive',session.currentFactory).length?'receive':centralWashingRolls(o,'downstream-receive',session.currentFactory).length?'downstream-receive':undefined
 if(ui().view==='handoff')return centralWashingRolls(o,'handout',session.currentFactory).length?'handout':undefined
 if(ui().view==='receipt')return undefined
 const ready=(['output','start']as const).filter(a=>centralWashingRolls(o,a,session.currentFactory).length)
 if(!ready.includes(ui().action))ui().action=ready[0]||'output'
 return ready.length?ui().action:undefined
}
const draftKey=(a:CentralWashingAction)=>scope()+'|'+a
function draft(a:CentralWashingAction,beginSelection=false){const key=draftKey(a),o=centralWashingOrder(route().id,session.currentFactory)!;if(!drafts.has(key))drafts.set(key,{selected:[],quantities:{},newCodes:{},scans:[],scan:'',position:'',revision:centralWashingRevision(o),operationId:crypto.randomUUID()});const d=drafts.get(key)!;
 // A new physical selection may use freshly read facts; an existing quantity/selection keeps its guard.
 if(beginSelection&&!d.selected.length&&!dirty({...d,scan:''},key))d.revision=centralWashingRevision(o)
 return d}
function dirty(d:CentralWashingDraft,key:string){return d.scans.length>0||d.scan.trim()!==''||Object.values(d.quantities).some(v=>v.trim())||Object.values(d.newCodes).some(v=>v.trim())||key.endsWith('|start')&&d.selected.length>0}
registerCentralDraftDiscard(()=>{draftEpoch++;states.clear();drafts.clear();messages.clear();recoveries.clear();warehouses.clear();scan='';pendingRoll=undefined;printPreview=undefined;confirmation=undefined;logoutScope='';login={account:'',password:''}},()=>[...drafts].some(([key,d])=>dirty(d,key)))
function warehouseUi(){const key=session.currentFactory+'|'+session.account?.userId;if(!warehouses.has(key))warehouses.set(key,{view:'locations',kind:'WAIT_PROCESS',position:'',limit:15});return warehouses.get(key)!}
function actionText(a:CentralWashingAction){return text(a==='downstream-receive'?'receive':a==='handout'?'handoff':a)}
function feedback(){const value=messages.get(scope());return reading?centralNotice(text('reading')):saving?centralNotice(text('saving')):value?.error?centralNotice(washingError(value.error,lang()),true)+(recoveries.has(scope())?'':cb(text('reload'),'washing-reload')):value?.saved?centralNotice(text('saved')):''}
function photosReady(){const photos=[...root()?.querySelectorAll<HTMLImageElement>('[data-central-washing-photo]')||[]];return photos.length>0&&photos.every(img=>img.complete&&img.naturalWidth>0)}
function feedbackSlot(){return '<div data-central-washing-feedback>'+feedback()+'</div>'}
function refreshFeedback(){const el=root()?.querySelector('[data-central-washing-feedback]');if(el)el.innerHTML=feedback()}

function primary():CentralPdaFrameInput['primary'] {
 if(!session.account)return undefined
 if(recoveries.has(scope()))return{label:text('reload'),action:'washing-recover',disabled:busy()}
 const o=centralWashingOrder(route().id,session.currentFactory);if(!o)return undefined
 const a=action();let error=''
 if(a){const d=draft(a),measured=['receive','output','downstream-receive'].includes(a);let disabled=busy()||!d.selected.length||(!o.source.imageUrl||!photosReady())||!!d.scan.trim()
  if(measured&&d.selected.some(id=>!(d.quantities[id]||'').trim()))disabled=true
  else if(d.selected.length)try{centralWashingInput(o,a,d,session.currentFactory,lang(),true)}catch(e){disabled=true;if(!(e instanceof Error)||e.message!=='CW_position'||d.position)error=washingError(e,lang())}
  const slot=root()?.querySelector('[data-central-washing-field-error]');if(slot)slot.textContent=error
  return{label:actionText(a),action:'washing-submit',disabled}
 }
 if(route().tab==='execute'&&centralWashingCanComplete(o,session.currentFactory))return{label:text('complete'),action:'washing-complete',disabled:busy()||!o.source.imageUrl||!photosReady()}
 return{label:text('next'),action:'washing-next',disabled:busy()}
}
function list(){let rows=centralWashingOrders(session.currentFactory)
 if(route().tab==='receive')rows=rows.filter(o=>centralWashingRolls(o,'receive',session.currentFactory).length||centralWashingRolls(o,'downstream-receive',session.currentFactory).length)
 return `<div class="flex items-end gap-2"><div class="min-w-0 flex-1">${washingInputField(text('scan'),scan,'listScan')}</div>${cb(text('identify'),'washing-identify')}</div>`+(rows.slice(0,ui().limit).map(o=>`<button type="button" class="my-3 flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left" data-central-action="washing-order" data-central-value="${ce(o.id)}"><span class="h-14 w-14 shrink-0"><img data-central-washing-photo class="h-full w-full object-contain" src="${ce(o.source.imageUrl)}" alt="${ce(o.source.materialSku)}"></span><span class="min-w-0"><strong class="block break-words">${ce(o.no)}</strong><span class="block break-words text-sm">${ce(o.source.materialSku)}</span><span class="block text-sm">${o.completedAt?text('closed'):o.cancelledAt?text('cancelled'):o.exception?text('blocked'):o.assignedFactoryName||''}</span></span></button>`).join('')||centralNotice(text('empty')))+(rows.length>ui().limit?cb(ct(lang(),'more'),'washing-more'):'')
}
function frame():CentralPdaFrameInput {
 const r=route(),factory=getFactoryMasterRecordById(session.currentFactory),base:CentralPdaFrameInput={family:'washing',accountName:session.account?centralFormalName(session.account.name,session.account.loginId,lang()):text('account'),accountNo:'',factoryName:centralFormalName(factory?.name,session.currentFactory,lang()),operationName:text('washing'),language:lang(),tab:r.tab,tabPathPrefix:prefix,content:''}
 if(session.signedOut||!session.account)return{...base,heading:text('login'),backPath:tabPath('receive'),content:feedbackSlot()+washingInputField(text('account'),login.account,'loginAccount')+`<label class="my-3 block font-semibold">${text('password')}<input type="password" autocomplete="current-password" data-central-washing-field="loginPassword" value="${ce(login.password)}" class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3"></label>`+cb(text('login'),'washing-login',undefined,true)}
 if(r.tab==='warehouse')return{...base,content:feedbackSlot()+renderWashingWarehouse(session.currentFactory,warehouseUi(),lang())}
 if(!r.id)return{...base,content:feedbackSlot()+list()}
 const o=centralWashingOrder(r.id,session.currentFactory)
 if(!o)return{...base,heading:text('order'),backPath:tabPath(r.tab),content:centralNotice(text('changed'),true)}
 let content=feedbackSlot()+washingIdentity(o,lang())
 if(o.completedAt){const completed=readWashingState().actions.find(a=>a.orderId===o.id&&a.action==='COMPLETE');content+=centralNotice(text('closed'))+(completed?`<p class="my-2 text-sm">${ce(centralFormalName(completed.actor.name,completed.actor.id,lang()))} · ${ce(centralTime(completed.at,lang()))}</p>`:'')}
 else if(o.cancelledAt||o.exception)content+=centralNotice(text(o.cancelledAt?'cancelled':'blocked'))+(o.exception?cb(text('reload'),'washing-reload'):'')
 if(r.tab==='execute')content+=`<div data-central-washing-task-tabs class="sticky top-0 z-10 my-3 grid grid-cols-3 gap-2 bg-slate-100 py-2">${(['work','handoff','receipt']as const).map(v=>cb(text(v==='handoff'?'return':v==='receipt'?'receiptTab':'work'),'washing-view',v,ui().view===v).replace('class="','class="min-w-0 break-words ')).join('')}</div>`
 if(r.tab==='execute'&&o.assignedFactoryId===session.currentFactory&&o.source.imageUrl)content+=`<div class="my-3">${cb(text('printPreview'),'washing-print-preview')}</div>`
 const a=action()
 if(r.tab==='execute'&&ui().view==='receipt')content+=renderWashingReceipts(o,readWashingState().actions,ui().receiptScope,lang())
 else if(a){
  if(a==='start'||a==='output'){const choices=(['output','start']as const).filter(v=>centralWashingRolls(o,v,session.currentFactory).length);if(choices.length>1)content+=`<div class="my-3 grid grid-cols-2 gap-2">${choices.map(v=>cb(actionText(v),'washing-action',v,a===v)).join('')}</div>`}
  content+=renderWashingForm(o,a,draft(a),session.currentFactory,lang())
 }else content+=o.rolls.map(roll=>renderWashingRollSummary(roll,lang())).join('')
 return{...base,heading:o.no,backPath:tabPath(r.tab),content,primary:primary()}
}
function disable(){root()?.setAttribute('aria-busy',String(busy()));root()?.querySelectorAll<HTMLInputElement>('input,select,textarea,button').forEach(el=>{if(busy()||recoveries.has(scope()))el.disabled=busy()||el.dataset.centralAction!=='washing-recover'})}
function recoveryFrame(){const current=root();if(!current)return;const holder=document.createElement('template');holder.innerHTML=renderCentralPdaFrame({...frameBase(),primary:{label:text('reload'),action:'washing-recover'}});const footer=holder.content.querySelector<HTMLElement>('footer')!;const previous=current.querySelector('[data-central-footer]');if(previous)previous.replaceWith(footer);else current.append(footer);refreshFeedback();current.querySelector('[data-central-washing-feedback]')?.scrollIntoView({block:'start'});disable()}
function refreshFooter(){
 const active=root();if(!active)return;const p=primary();let footer=active.querySelector<HTMLElement>('[data-central-footer]')
 if(!p){footer?.remove();disable();return}
 const button=footer?.querySelector<HTMLButtonElement>('button')
 if(button?.dataset.centralAction===p.action){if(button.textContent!==p.label)button.textContent=p.label;button.disabled=!!p.disabled}
 else{const holder=document.createElement('template');holder.innerHTML=renderCentralPdaFrame({...frameBase(),primary:p});const next=holder.content.querySelector<HTMLElement>('footer')!;if(footer)footer.replaceWith(next);else active.insertBefore(next,active.querySelector('nav'))}
 disable()
}
function frameBase():CentralPdaFrameInput{return{family:'washing',accountName:'',accountNo:'',factoryName:'',operationName:'',language:lang(),tab:route().tab,content:'',backPath:'/'}}
function patch(){const active=root();if(!active)return;patching=true;try{const main=active.querySelector<HTMLElement>('main')!,scroll=main.scrollTop,focus=document.activeElement as HTMLInputElement,field=focus?.dataset.centralWashingField,roll=focus?.dataset.centralWashingRoll;const holder=document.createElement('template');holder.innerHTML=renderCentralPdaFrame(frame());const next=holder.content.firstElementChild!;active.lang=next.getAttribute('lang')!;for(const selector of ['header','[data-central-heading]','main'])active.querySelector(selector)!.innerHTML=next.querySelector(selector)!.innerHTML;active.querySelector('footer')?.remove();active.querySelector('nav')?.remove();for(const selector of ['footer','nav']){const el=next.querySelector(selector);if(el)active.append(el)}main.scrollTop=scroll;mountCentralWashingPage();if(field){const el=active.querySelector<HTMLInputElement>(`[data-central-washing-field="${CSS.escape(field)}"]${roll?'[data-central-washing-roll="'+CSS.escape(roll)+'"]':''}`);el?.focus({preventScroll:true})}}catch(error){if(!recoveries.has(scope())){messages.set(scope(),{error});recoveries.set(scope(),{})}recoveryFrame()}finally{patching=false}}
function navigate(next:string){closeCentralWashingOverlay();scan='';path=next;if(appStore.getState().pathname===next)patch();else appStore.navigate(next)}
function openOrder(id:string){const key=session.currentFactory+'|'+session.account?.userId+'|'+id;if(!recoveries.has(key))messages.delete(key);navigate(tabPath(route().tab)+'/'+encodeURIComponent(id))}
function overlay(content:string,focus='button',showCancel=true){closeCentralWashingOverlay();const el=document.createElement('div');el.dataset.centralOverlay='';el.className='fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2';el.innerHTML=`<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-3">${content}${showCancel?`<div class="mt-3">${cb(text('cancel'),'washing-close')}</div>`:''}</section>`;root()?.append(el);el.querySelector<HTMLButtonElement>(focus)?.focus()}
export function closeCentralWashingOverlay(){printPreview=undefined;confirmation=undefined;logoutScope='';const el=root()?.querySelector('[data-central-overlay]');if(!el)return false;el.remove();return true}
function mountPrintPreview(context:PrintPreview){
 const frame=root()?.querySelector<HTMLIFrameElement>('[data-central-washing-print-frame]'),button=root()?.querySelector<HTMLButtonElement>('[data-central-action=washing-print-browser]')
 if(!frame||!button)return
 const current=()=>frame.isConnected&&printPreview===context&&context.scope===scope()
 frame.onload=async()=>{try{const doc=frame.contentDocument;if(!doc)throw new Error('CW_printNotReady');await doc.fonts.ready;await Promise.all([...doc.images,...root()?.querySelectorAll<HTMLImageElement>('[data-central-overlay] img')||[]].map(img=>img.decode()));if(!current())return;context.ready=true;button.disabled=false;button.focus()}catch(error){if(current()){const slot=root()?.querySelector('[data-central-washing-print-error]');if(slot)slot.textContent=text('printNotReady')}}}
 frame.srcdoc=context.document
}
function openPrintPreview(snapshot:WashingOrder,revision:string,key:string,html:string,document:string){
 if(key!==scope())return
 const context:PrintPreview={scope:key,snapshot,revision,document,ready:false,pending:false}
 overlay(html,'[data-central-action=washing-close]');printPreview=context
 const panel=root()?.querySelector<HTMLElement>('[data-central-overlay] section');if(panel){panel.className='flex h-[94dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white p-3';panel.querySelector('[data-central-action=washing-close]')?.classList.add('w-full')}
 mountPrintPreview(context)
}
async function printCurrentPreview(){
 const context=printPreview,frame=root()?.querySelector<HTMLIFrameElement>('[data-central-washing-print-frame]'),button=root()?.querySelector<HTMLButtonElement>('[data-central-action=washing-print-browser]')
 if(!context||context.scope!==scope()||!context.ready||context.pending||!frame||!button)return
 context.pending=true;button.disabled=true
 try{await prepareCentralWashing();if(context!==printPreview||!frame.isConnected||context.scope!==scope())return;const current=centralWashingOrder(context.snapshot.id,session.currentFactory);if(!current||centralWashingRevision(current)!==context.revision){context.ready=false;throw new Error('CW_previewChanged')};if(!frame.contentWindow||!frame.contentDocument||[...frame.contentDocument.images].some(img=>!img.complete||!img.naturalWidth))throw new Error('CW_printNotReady');frame.contentWindow.focus();frame.contentWindow.print()}
 catch(error){if(context===printPreview){const slot=root()?.querySelector('[data-central-washing-print-error]');if(slot)slot.textContent=error instanceof Error&&error.message==='CW_previewChanged'?(lang()==='id'?'Data berubah. Tutup dan buat pratinjau baru.':'资料已变化，关闭后重新生成预览'):error instanceof Error&&error.message==='CW_printNotReady'?text('printNotReady'):washingError(error,lang())}}
 finally{context.pending=false;if(context===printPreview&&frame.isConnected)button.disabled=!context.ready}
}
function logout(){discardCentralDrafts();session.account=undefined;session.signedOut=true;saveCentralSessionPreference();closeCentralWashingOverlay();patch();focusCurrentView()}
async function commit(run:()=>Promise<unknown>,done:()=>void){
 if(busy())return
 const key=scope(),epoch=draftEpoch;let succeeded=false
 saving=true;messages.delete(key);disable();refreshFeedback()
 try{await run();if(epoch===draftEpoch){recoveries.delete(key);done();messages.set(key,{saved:true});succeeded=true}}
 catch(error){if(epoch===draftEpoch){messages.set(key,{error});if(error instanceof Error&&/已保存/.test(error.message))recoveries.set(key,{run,done})}}
 finally{saving=false;patch();if(succeeded&&key===scope()&&root()&&!recoveries.has(key)&&!root()?.querySelector('[data-central-overlay]')){const next=action();if(next)focusField(next==='output'?'quantity':'scan');else root()?.querySelector<HTMLButtonElement>('footer button:not(:disabled)')?.focus()}}
}
async function readCurrentView(update:()=>void,focus?:string,afterRead?:()=>void){
 if(busy())return false
 const key=scope(),requestedPath=path,requestedLocation=location.href,epoch=draftEpoch
 const current=()=>epoch===draftEpoch&&key===scope()&&requestedPath===path&&requestedLocation===location.href&&!!root()
 let loaded=false;update();reading=true;messages.delete(key);disable();refreshFeedback()
 try{await prepareCentralWashing();if(epoch===draftEpoch){afterRead?.();recoveries.delete(key);loaded=true}}
 catch(error){if(epoch===draftEpoch){messages.set(key,{error:new Error('CW_read',{cause:error})});if(!recoveries.has(key))recoveries.set(key,{})}}
 finally{reading=false;patch();if(current()){if(recoveries.has(key))root()?.querySelector('[data-central-washing-feedback]')?.scrollIntoView({block:'start'});else if(focus)focusField(focus)}}
 return loaded&&current()
}
function readReceipts(){const state=ui();return readCurrentView(()=>{state.view='receipt'},'receiptScope')}
function readWarehouse(update:(state:WashingWarehouseUi)=>void){const state=warehouseUi();return readCurrentView(()=>update(state))}
function submit(request:Confirmation){const actor=session.account!,state=ui(),savedDraft=request.draftKey?drafts.get(request.draftKey):undefined;closeCentralWashingOverlay();return commit(()=>saveCentralWashing(request.command,actor,request.operationId,request.revision),()=>{
 if(request.draftKey&&savedDraft){
  const submitted=new Set(request.selected),o=centralWashingOrder(request.command.orderId,actor.factoryId)
  for(const id of submitted){delete savedDraft.quantities[id];delete savedDraft.newCodes[id]}
  savedDraft.selected=savedDraft.selected.filter(id=>!submitted.has(id));savedDraft.scans=[];savedDraft.scan=''
  if(o)savedDraft.revision=centralWashingRevision(o)
  savedDraft.operationId=crypto.randomUUID()
 }
 if(request.action==='start'){
  state.view='work';state.action='output'
  const key=request.scope+'|output',o=centralWashingOrder(request.command.orderId,actor.factoryId)
  if(o){if(!drafts.has(key))drafts.set(key,{selected:[],quantities:{},newCodes:{},scans:[],scan:'',position:'',revision:centralWashingRevision(o),operationId:crypto.randomUUID()});const d=drafts.get(key)!,allowed=centralWashingRolls(o,'output',actor.factoryId);d.selected=[...new Set([...d.selected,...request.selected.filter(id=>allowed.some(r=>r.id===id))])]}
 }
 if(request.action==='output')state.view='handoff'
 if(request.command.type==='COMPLETE'){state.view='receipt';for(const key of drafts.keys())if(key.startsWith(request.scope+'|'))drafts.delete(key)}
 if(request.scope===scope()&&savedDraft&&(request.action==='receive'||request.action==='downstream-receive')){const next=action();if(next){const d=draft(next);if(!d.position)d.position=savedDraft.position}}
})}
function prepareSubmit(){const o=centralWashingOrder(route().id,session.currentFactory)!,a=action();if(!o||!a)throw new Error('CW_changed');const d=draft(a),command=centralWashingInput(o,a,d,session.currentFactory,lang(),true),changes=centralWashingQuantityChanges(o,a,d,lang()),request:Confirmation={scope:scope(),command,operationId:d.operationId,revision:d.revision,action:a,draftKey:draftKey(a),selected:[...d.selected]};if(changes.length){overlay(`<h2 class="mb-3 text-lg font-bold">${text('confirmAmounts')}</h2><strong>${ce(o.no)}</strong>${changes.map(change=>washingCard(`<p class="break-all">${ce(o.rolls.find(r=>r.id===change.id)!.barcode)}</p><p>${text('reference')} · ${n(change.expected!,lang())} ${ce(washingUnit(change.unit))}</p><p class="font-bold">${text(a==='output'?'outputQty':'qty')} · ${n(change.qty,lang())} ${ce(washingUnit(change.unit))}</p>`)).join('')}${cb(text('confirm'),'washing-confirm',undefined,true)}`,'[data-central-action=washing-confirm]');confirmation=request;return}return submit(request)}
function focusField(field:string){const el=root()?.querySelector<HTMLInputElement>(`[data-central-washing-field="${field}"]`);el?.focus();if(field==='scan'||field==='listScan')el?.select();el?.scrollIntoView({block:'center'})}
function focusCurrentView(){const active=root();if(!active||busy()||active.querySelector('[data-central-overlay]'))return;if(session.signedOut||!session.account)focusField('loginAccount');else if(recoveries.has(scope()))active.querySelector<HTMLButtonElement>('footer button:not(:disabled)')?.focus();else if(route().tab!=='warehouse'){if(!route().id)focusField('listScan');else if(route().tab==='execute'&&ui().view==='receipt')focusField('receiptScope');else{const next=action();if(next)focusField(['receive','output','downstream-receive'].includes(next)&&draft(next).selected.length?'quantity':'scan');else active.querySelector<HTMLButtonElement>('footer button:not(:disabled)')?.focus()}}}
function keydown(event:KeyboardEvent){if(!root()||busy()||event.isComposing||event.keyCode===229)return;if(event.key==='Escape'){closeCentralWashingOverlay();return}if(root()?.querySelector('[data-central-overlay]'))return;if(event.key==='F1'){event.preventDefault();focusField(route().id?'scan':'listScan');return}if(event.key!=='Enter')return;const field=(event.target as HTMLElement)?.dataset.centralWashingField;if(field==='scan'&&!(event.target as HTMLInputElement).value.trim()){const primary=root()?.querySelector<HTMLButtonElement>('footer button[data-central-action=washing-submit]:not(:disabled)');if(primary){event.preventDefault();primary.focus();return}}if(field==='scan'||field==='listScan'){event.preventDefault();void handleCentralWashingEvent(root()!.querySelector(`[data-central-action="${field==='scan'?'washing-scan':'washing-identify'}"]`)!,new Event('click'))}else if(field==='quantity'){event.preventDefault();root()?.querySelector<HTMLButtonElement>('footer button:not(:disabled)')?.focus()}else if(field==='newCode'){event.preventDefault();root()?.querySelector<HTMLButtonElement>('footer button:not(:disabled)')?.focus()}else if(field==='loginPassword'){event.preventDefault();root()?.querySelector<HTMLButtonElement>('[data-central-action=washing-login]')?.click()}}
export async function renderCentralWashingPage(next:string,current:()=>boolean=()=>true){try{await prepareCentralWashing();if(!current())return'';path=next;const candidates=centralWashingFactories(),explicit=new URL(next,location.origin).searchParams.get('factoryId'),factory=candidates.find(f=>f.id===(explicit||session.currentFactory||session.preference.factoryId))||candidates.find(f=>f.id==='ID-F003')||candidates[0];if(explicit&&!candidates.some(f=>f.id===explicit))throw new Error('CW_actor');if(factory){ensureCentralSessionAccount(factory.id);session.currentOperation='WASH';saveCentralSessionPreference()}
 const scanned=pendingRoll;pendingRoll=undefined
 if(scanned&&scanned.factoryId===session.currentFactory&&scanned.accountId===session.account?.userId&&scanned.orderId===route().id){const o=centralWashingOrder(scanned.orderId,session.currentFactory),roll=o?.rolls.find(r=>r.barcode===scanned.code||r.outputBarcode===scanned.code);if(o&&roll){if(route().tab==='execute'&&centralWashingRolls(o,'handout',session.currentFactory).some(r=>r.id===roll.id))ui().view='handoff';const a=action();if(a&&centralWashingRolls(o,a,session.currentFactory).some(r=>r.id===roll.id)){const d=draft(a,true);if(!d.selected.includes(roll.id))scanCentralWashingRoll(o,a,d,session.currentFactory,scanned.code)}}}
 return renderCentralPdaFrame(frame())}catch(error){path=next;if(!recoveries.has(scope())){recoveries.set(scope(),{});messages.set(scope(),{error})}return renderCentralPdaFrame({...frameBase(),heading:text('order'),content:feedbackSlot(),primary:{label:text('reload'),action:'washing-recover'}})}}
export function mountCentralWashingPage(){const active=root();if(!active)return;hydrateIcons(active);active.querySelectorAll<HTMLImageElement>('[data-central-washing-photo]').forEach(img=>{img.onload=()=>{if(root()?.contains(img))refreshFooter()};img.onerror=()=>{img.alt=text('noImage');if(root()?.contains(img))refreshFooter()};});if(!mounted){document.addEventListener('keydown',keydown);mounted=true}refreshFooter();if(!focusedRoots.has(active)&&!busy()){focusedRoots.add(active);focusCurrentView()}}
export async function handleCentralWashingEvent(target:Element,event?:Event):Promise<boolean>{
 if(!root()||busy())return !!root();const field=target.closest<HTMLInputElement|HTMLSelectElement>('[data-central-washing-field]');if(field){if(patching||!root()?.contains(field)||event?.type==='click'||event?.type==='keydown'||recoveries.has(scope()))return true;const key=field.dataset.centralWashingField!,id=field.dataset.centralWashingRoll!;messages.delete(scope());refreshFeedback();if(key==='listScan')scan=field.value;else if(key==='loginAccount')login.account=field.value;else if(key==='loginPassword')login.password=field.value;else if(key==='receiptScope'){ui().receiptScope=field.value;await readReceipts()}else{const a=action();if(a){const d=draft(a);if(key==='quantity')d.quantities[id]=field.value;else if(key==='newCode')d.newCodes[id]=field.value;else if(key==='position')d.position=field.value;else if(key==='scan')d.scan=field.value;d.operationId=crypto.randomUUID()}}refreshFooter();return true}
 const node=target.closest<HTMLElement>('[data-central-action],[data-central-nav]');if(!node)return false;if(event&&event.type!=='click')return true;const key=scope(),value=node.dataset.centralValue||'',a=node.dataset.centralAction;if(recoveries.has(key)&&!['washing-recover'].includes(a||''))return true
 try{if(node.dataset.centralNav){navigate(node.dataset.centralNav);return true}if(a!=='washing-close'&&!root()?.contains(node))return true
 switch(a){
  case 'washing-close':{const resume=logoutScope===key;closeCentralWashingOverlay();if(resume)focusCurrentView();break}
  case 'washing-order':openOrder(value);break
  case 'washing-next':navigate(tabPath(route().tab));break
  case 'washing-identify':{const code=scan.trim();let matches=findCentralWashingOrders(session.currentFactory,code);if(!matches.length){if(!await readCurrentView(()=>{},'listScan'))break;matches=findCentralWashingOrders(session.currentFactory,code)}if(!matches.length)throw new Error('CW_scan');if(matches.length===1){pendingRoll={factoryId:session.currentFactory,accountId:session.account!.userId,orderId:matches[0].id,code};openOrder(matches[0].id)}else overlay(matches.map(o=>cb(o.no,'washing-order',o.id)).join(''));break}
  case 'washing-view':if(['work','handoff','receipt'].includes(value)){if(value==='receipt')await readReceipts();else{ui().view=value as Ui['view'];messages.delete(key);patch()}}break
  case 'washing-action':if(value==='start'||value==='output'){ui().action=value;messages.delete(key);patch()}break
  case 'washing-select':{const current=action(),o=centralWashingOrder(route().id,session.currentFactory);if(!current||!o||!centralWashingRolls(o,current,session.currentFactory).some(r=>r.id===value))throw new Error('CW_changed');const d=draft(current,true);if(d.selected.includes(value)){d.selected=d.selected.filter(id=>id!==value);d.scans=d.scans.filter(code=>code!==(o.rolls.find(r=>r.id===value)!.outputBarcode||o.rolls.find(r=>r.id===value)!.barcode))}else if(current!=='handout')d.selected.push(value);d.operationId=crypto.randomUUID();messages.delete(key);patch();focusField('quantity');break}
  case 'washing-scan':{const current=action(),o=centralWashingOrder(route().id,session.currentFactory);if(!current||!o)throw new Error('CW_changed');const d=draft(current,true);scanCentralWashingRoll(o,current,d,session.currentFactory,d.scan);d.operationId=crypto.randomUUID();messages.delete(key);patch();focusField(current==='handout'?'scan':'quantity');break}
  case 'washing-print-preview':{const order=centralWashingOrder(route().id,session.currentFactory),actor=session.account;if(!order||!actor||order.assignedFactoryId!==actor.factoryId||!photosReady())throw new Error('CW_changed');const snapshot=structuredClone(order),revision=centralWashingRevision(order),html=renderWashingPrintPreview(snapshot,lang()),document=renderWashingPrintDocument(snapshot,lang()),operationId=crypto.randomUUID();await commit(()=>saveCentralWashing({type:'PRINT',orderId:order.id},actor,operationId,revision),()=>openPrintPreview(snapshot,revision,key,html,document));break}
  case 'washing-print-browser':await printCurrentPreview();break
  case 'washing-submit':await prepareSubmit();break
  case 'washing-confirm':{const request=confirmation;if(!request||request.scope!==key)throw new Error('CW_changed');await submit(request);break}
  case 'washing-complete':{const o=centralWashingOrder(route().id,session.currentFactory);if(!o||!centralWashingCanComplete(o,session.currentFactory))throw new Error('CW_changed');const request:Confirmation={scope:key,command:{type:'COMPLETE',orderId:o.id},operationId:crypto.randomUUID(),revision:centralWashingRevision(o),selected:[]};overlay(washingIdentity(o,lang())+`<p class="my-3 font-semibold">${text('completeWarning')}</p><p>${text('received')} · ${washingTotals(o.rolls,'downstreamQty',lang())}</p>`+cb(text('confirmComplete'),'washing-confirm',undefined,true),'[data-central-action=washing-confirm]');confirmation=request;break}
  case 'washing-clear':{const current=action();if(current)drafts.delete(draftKey(current));messages.delete(key);patch();break}
  case 'washing-reload':case 'washing-recover':{const recovery=recoveries.get(key);if(recovery?.run&&recovery.done){await commit(recovery.run,recovery.done);break}const id=route().id,factoryId=session.currentFactory;const loaded=await readCurrentView(()=>{},undefined,()=>{const o=centralWashingOrder(id,factoryId);if(o)for(const [name,d]of drafts)if(name.startsWith(key+'|'))d.revision=centralWashingRevision(o)});if(loaded)focusCurrentView();break}
  case 'language':{const from=lang(),to=from==='zh'?'id':'zh';closeCentralWashingOverlay();for(const d of drafts.values())for(const id of Object.keys(d.quantities))d.quantities[id]=translateDyeNumber(d.quantities[id],from,to);session.language=to;saveCentralSessionPreference();patch();break}
  case 'operation':overlay(`<div class="space-y-2">${centralWashingFactories().map(f=>cb(f.id==='ID-F003'?'GTG':centralFormalName(f.name,f.id,lang()),'washing-factory',f.id,session.currentFactory===f.id)).join('')}${(['dye','print','water','special']as const).map(f=>`<button type="button" class="min-h-12 w-full rounded-xl border p-3" data-central-nav="/fcs/pda/central/${f==='special'?'':f+'/'}${route().tab}">${({dye:lang()==='id'?'Pencelupan':'染色',print:lang()==='id'?'Pencetakan':'印花',water:lang()==='id'?'Larut air':'水溶',special:lang()==='id'?'Proses tambahan / khusus':'辅助 / 特种工艺'})[f]}</button>`).join('')}</div>`);break
  case 'washing-factory':if(centralWashingFactories().some(f=>f.id===value)){ensureCentralSessionAccount(value);saveCentralSessionPreference();navigate(tabPath(route().tab))}break
  case 'washing-photo':overlay(`<img src="${ce(value)}" alt="" class="max-h-[75dvh] w-full object-contain">`);break
  case 'logout':if(hasCentralDrafts()){overlay(`<p class="my-3">${text('notSubmitted')}</p>${cb(text('continue'),'washing-close')}${cb(text('discardLogout'),'washing-logout-confirm')}`,'button',false);logoutScope=key}else logout();break
  case 'washing-logout-confirm':if(logoutScope===key)logout();break
  case 'washing-login':{const user=readFactoryPdaExecutionUsers().find(u=>normalizePdaLoginId(u.loginId)===normalizePdaLoginId(login.account));if(!user||!verifyPdaPassword(login.password,user.passwordHash))throw new Error('CW_login');assertCentralWashingActor(user);discardCentralDrafts();session.account=user;session.currentFactory=user.factoryId;session.signedOut=false;saveCentralSessionPreference();navigate(tabPath('receive'));focusCurrentView();break}
  case 'washing-wh-view':if(['locations','receive','handoff'].includes(value))await readWarehouse(state=>{state.view=value as WashingWarehouseUi['view'];state.limit=15});break
  case 'washing-wh-kind':if(value==='WAIT_PROCESS'||value==='WAIT_HANDOVER')await readWarehouse(state=>{state.kind=value;state.position='';state.limit=15});break
  case 'washing-wh-position':await readWarehouse(state=>{state.position=value;state.limit=15});break
  case 'washing-more':if(route().tab==='warehouse')await readWarehouse(state=>{state.limit+=15});else{ui().limit+=15;patch()}break
 }
 }catch(error){messages.set(key,{error});patch();if(a==='washing-scan')root()?.querySelector<HTMLInputElement>('[data-central-washing-field=scan]')?.select();if(a==='washing-identify')root()?.querySelector<HTMLInputElement>('[data-central-washing-field=listScan]')?.select()}
 return true
}
