// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { localDateTimeText } from '../../utils.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { ensureSpecialCraftRecords } from '../../data/fcs/special-craft-records.ts'
import { type FactoryReceiptInput } from '../../data/fcs/factory-receiving.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { cb, ce, ct, centralNotice, centralFormalName } from './ui.ts'
import { dyeNumber, translateDyeNumber } from './dye-ui.ts'
import { waterNumber as cn, wt, waterUnit, waterStatus, waterErrorText, waterCompletionInput, waterFactsSummary, waterNeedsNote, waterNoteField, type WaterWorkDraft } from './water-ui.ts'
import { listCentralWaterFacts, centralWaterFactories, centralWaterFact, centralWaterIncoming, centralWaterRevision, saveCentralWaterReceipt, saveCentralWaterAction, type CentralWaterAction } from './water-model.ts'
import { centralWaterOutput, centralWaterDispatch, centralWaterLabelRevision, saveCentralWaterRoll, markCentralWaterRollsPrinted, createCentralWaterDispatch, scanCentralWaterDispatch, confirmCentralWaterDispatch, voidCentralWaterDispatch, resolveCentralWaterRoll, centralWaterReceiptHistory } from './water-output-model.ts'
import { waterIdentity, renderWaterReceive, renderWaterWork, renderWaterReceipts, renderWaterOutput, type WaterReceiveDraft, type WaterOutputUi } from './water-view.ts'
import { renderCentralWaterLabel } from './water-label.ts'
import { renderCentralWaterWarehouse, type WaterWarehouseUi } from './water-warehouse-view.ts'

const prefix = '/fcs/pda/central/water'
type Ui = { view: 'work' | 'output' | 'receipt'; sourceKey: string; receiptScope: string; output: WaterOutputUi }
const uiStates = new Map<string, Ui>(),workDrafts = new Map<string, WaterWorkDraft>(),receiveDrafts = new Map<string, WaterReceiveDraft>()
const rollDrafts = new Map<string,{raw:string;revision?:string}>()
const commandIds = new Map<string, { intent: string; id: string }>(),recoveries = new Map<string, () => Promise<void>>()
const loadedPhotos = new Set<string>()
const failedPhotos = new Set<string>()
let confirmation: { action: 'over' | 'finish' | 'void' | 'logout'; scope: string; revision: string; input?: CentralWaterAction; docId?: string } | undefined
let path = '',scan = '',scanOpen = false,limit = 15,message: { text?: string; error?: unknown; saved?: boolean } = {},saving = false,mounted = false
let login = { account: '', password: '' }
let scanCandidates: string[] | undefined
const wh:WaterWarehouseUi = { view: 'locations', kind: 'WAIT_PROCESS', location: '', limit: 15 }
let warehouseOwner=''
const lang = () => session.language
const t = (key: Parameters<typeof ct>[1]) => ct(lang(), key)
const text = (key: Parameters<typeof wt>[1]) => wt(lang(), key)
const activeRoot = () => document.querySelector<HTMLElement>('[data-central-pda-root][data-central-family="water"]')
const tabPath = (tab: CentralPdaTab) => prefix + '/' + tab
let frameRoute: ReturnType<typeof readRoute> | undefined
function readRoute() {
  const url = new URL(path || tabPath('receive'), location.origin),parts = url.pathname.split('/'),tab = (['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] : 'receive') as CentralPdaTab
  let orderId = '';try { orderId = decodeURIComponent(parts[6] || '') } catch { /* An invalid code does not select a physical object. */ }
  return { tab, orderId, fact: session.account ? centralWaterFact(orderId, session.currentFactory) : undefined }
}
function route() { return frameRoute || readRoute() }
function scope(id = route().orderId) { return [session.currentFactory, session.account?.userId, id].join('|') }
function ui() {
  const key = scope()
  if (!uiStates.has(key)) uiStates.set(key, { view: 'work', sourceKey: '', receiptScope: '', output: { panel: 'list', raw: '', operationId: crypto.randomUUID(), scan: '', transport: { driver: '', vehicle: '', plate: '', note: '' }, labelIds: [], labelRevisions: {}, printRequested: false } })
  return uiStates.get(key)!
}
function workDraft() {
  const key = scope()
  if (!workDrafts.has(key)) workDrafts.set(key, { raw: '', reason: '', pause: false, decision: '', revision: centralWaterRevision(route().orderId, session.currentFactory), operationId: crypto.randomUUID() })
  const draft=workDrafts.get(key)!
  if(!draft.raw.trim()&&!draft.reason.trim()&&!draft.decision&&!draft.pause)draft.revision=centralWaterRevision(route().orderId,session.currentFactory)
  return draft
}
function incoming() {
  const rows = centralWaterIncoming(session.currentFactory, route().orderId),state = ui()
  if (!state.sourceKey && rows.length) state.sourceKey = (rows.find(row => row.remaining > 0) || rows[0]).key
  return { rows, selected: rows.find(row => row.key === state.sourceKey) }
}
function receiveDraft() {
  const selected = incoming().selected
  if (!selected) return undefined
  const key = scope() + '|' + selected.key
  if (!receiveDrafts.has(key)) receiveDrafts.set(key, { raw: '', position: '', operationId: crypto.randomUUID() })
  return receiveDrafts.get(key)!
}
registerCentralDraftDiscard(() => { uiStates.clear();workDrafts.clear();receiveDrafts.clear();rollDrafts.clear();commandIds.clear();recoveries.clear();scan='';message={};confirmation=undefined;login={account:'',password:''};wh.location='';warehouseOwner='' }, () => [...rollDrafts.values()].some(d=>!!d.raw.trim()) || [...workDrafts.values()].some(d => !!(d.raw.trim() || d.reason.trim() || d.decision)) || [...receiveDrafts.values()].some(d => !!d.raw.trim()) || [...uiStates.values()].some(s => {
  const doc = s.output.docId ? centralWaterDispatch(s.output.docId, session.currentFactory) : undefined
  const transportChanged = (['driver','vehicle','plate','note'] as const).some(key => s.output.transport[key] !== (doc?.transport[key] || ''))
  const roll = s.output.rollId ? listCentralWaterFacts(session.currentFactory).flatMap(f => centralWaterOutput(f.order.waterOrderId, session.currentFactory)?.rolls || []).find(r => r.id === s.output.rollId) : undefined
  const rollChanged = !!s.output.raw.trim() && Number(s.output.raw.replace(',', '.')) !== roll?.qty
  return transportChanged || rollChanged || !!s.output.scan.trim()
}))
function token(kind: string, value: unknown) {
  const key = scope() + '|' + kind,intent = JSON.stringify(value)
  if (commandIds.get(key)?.intent !== intent) commandIds.set(key, { intent, id: crypto.randomUUID() })
  return commandIds.get(key)!.id
}
function photosReady() { return !!route().fact?.image?.material && [...(activeRoot()?.querySelectorAll<HTMLImageElement>('[data-central-water-photo]') || [])].every(img => img.complete && img.naturalWidth > 0) }
function inputForReceipt() {
  const selected = incoming().selected,draft = receiveDraft(),actor = session.account
  if (!selected || !draft || !actor) throw new Error('WATER_wrongSource')
  const quantity = dyeNumber(draft.raw, lang(), 3, true)
  if (quantity > selected.remaining + 0.000001) throw new Error('QUANTITY_MAX')
  const [warehouseId, locationId] = draft.position.split('|')
  if (!warehouseId || !locationId) throw new Error('WATER_position')
  const fingerprint = JSON.stringify({ source: selected.key, quantity, warehouseId, locationId, actor: actor.userId })
  if (draft.pending?.fingerprint !== fingerprint) {
    if (draft.pending) draft.operationId=crypto.randomUUID()
    const input: FactoryReceiptInput = { id: 'FRP-' + draft.operationId, factoryId: actor.factoryId, operatorId: actor.userId, operatorName: actor.name,
      receivedAt: localDateTimeText(), remark: '', lines: [{ sourceId: selected.source.id, sourceLineId: selected.line.id, warehouseId, locationId, businessQty: quantity, businessUnit: selected.line.unit }] }
    draft.pending={fingerprint,input}
  }
  return draft.pending.input
}
function primary(): CentralPdaFrameInput['primary'] {
  if (!session.account) return undefined
  if (recoveries.has(scope())) return { label: t('reload'), action: 'water-recover', disabled: saving }
  const { fact, tab } = route()
  if (!fact) return undefined
  let error = '',ready = !saving && photosReady(),result: CentralPdaFrameInput['primary']
  try {
    if (tab === 'receive') {
      const row = incoming().selected
      if (!row || !row.remaining) return { label: text('receiveNext'), action: 'water-next-receipt', disabled: saving }
      result={label:t('receive'),action:'water-save-receipt',disabled:true}
      const draft=receiveDraft();if (!draft?.raw.trim()) ready=false
      else { dyeNumber(draft.raw,lang(),3,true);if(Number(draft.raw.replace(',','.'))>row.remaining+.000001)throw new Error('QUANTITY_MAX');if(!draft.position)ready=false }
      result={label:t('receive'),action:'water-save-receipt',disabled:!ready}
    } else if (tab === 'execute' && ui().view === 'output') {
      const output=ui().output
      if(fact.order.status==='DONE')return {label:t('next'),action:'water-next-task',disabled:saving}
      if(output.panel==='roll'){
        result={label:lang()==='id'?'Simpan panjang rol':'保存卷长',action:'water-save-roll',disabled:true}
        if(!output.raw.trim())ready=false
        else{
          const quantity=dyeNumber(output.raw,lang(),2),state=centralWaterOutput(fact.order.waterOrderId,session.currentFactory)
          const otherRolls=state?.rolls.filter(roll=>!roll.dispatchId&&roll.id!==output.rollId).reduce((sum,roll)=>sum+roll.qty,0)||0
          if(!state||otherRolls+quantity>state.available+.000001)throw new Error('QUANTITY_MAX')
        }
        result.disabled=!ready
      }
      else if(output.panel==='label')result={label:lang()==='id'?'Label sudah dicetak':'确认标签已打印',action:'water-label-done',disabled:!ready||!output.printRequested}
      else if(output.panel==='document'){
        const doc=centralWaterDispatch(output.docId||'',session.currentFactory)
        if(doc?.status==='草稿'){const scanned=doc.lines.every(line=>line.rolls.every(roll=>doc.scans.some(scan=>scan.barcode===roll.barcode))),amount=doc.lines.reduce((sum,line)=>sum+line.rolls.reduce((n,roll)=>n+roll.qty,0),0)
          result={label:`${t('handoff')} ${cn(amount,lang())} ${waterUnit(doc.lines[0].unit)}`,action:'water-send',disabled:!ready||!scanned||!output.transport.driver.trim()||!output.transport.vehicle.trim()||!output.transport.plate.trim()}}
        else result={label:t('next'),action:'water-next-task',disabled:saving}
      }
    } else if(tab==='execute'&&ui().view==='work') {
      const draft=workDraft()
      if(fact.canComplete){result={label:text(draft.pause?'pause':'complete'),action:'water-work-save',disabled:true};if(!draft.raw.trim())ready=false;else waterCompletionInput(fact,draft,lang());result.disabled=!ready}
      else if(fact.canResolve){result={label:lang()==='id'?'Konfirmasi pilihan':'确认本次选择',action:'water-work-save',disabled:!ready||!draft.decision};if(draft.decision==='RETURN_FOR_REWORK'&&fact.reworkBlocked)throw new Error(fact.reworkBlocked)}
      else if(fact.canStart)result={label:text(fact.availableInput?'inputNew':'continue'),action:'water-input',disabled:!ready}
      else if(fact.canFinish)result={label:text('finish'),action:'water-finish',disabled:!ready}
      else result={label:t('next'),action:'water-next-task',disabled:saving}
    }
  }catch(cause){error=waterErrorText(cause,lang());if(result)result.disabled=true}
  const feedback=activeRoot()?.querySelector('[data-central-water-field-error]');if(feedback)feedback.textContent=error
  if(error&&result)result.disabled=true
  return result
}
function scanForm() { return `<div class="my-3 flex items-end gap-2"><label class="min-w-0 flex-1 text-base font-semibold">${t('scan')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-central-water-field="scan" value="${ce(scan)}" autocomplete="off" inputmode="text"></label>${cb(t('identify'),'water-identify')}</div>` }
function loginForm() { return `<label class="my-3 block">${t('account')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-central-water-login="account" autocomplete="username" value="${ce(login.account)}"></label><label class="my-3 block">${t('password')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-central-water-login="password" type="password" autocomplete="current-password" value="${ce(login.password)}"></label>${cb(t('login'),'water-login',undefined,true)}` }
function warehouseContent() {
  const owner=session.currentFactory+'|'+session.account?.userId
  if(owner!==warehouseOwner){warehouseOwner=owner;wh.view='locations';wh.kind='WAIT_PROCESS';wh.location='';wh.limit=15}
  return renderCentralWaterWarehouse(session.currentFactory,wh,lang())
}
function feedback(){
  if(saving)return centralNotice(lang()==='id'?'Menyimpan…':'正在保存…')
  let html=message.error?centralNotice(waterErrorText(message.error,lang()),true):message.saved?centralNotice(t('saved')):message.text?centralNotice(message.text):''
  if(message.error instanceof Error&&/CHANGED|变化|冲突|更新|已被其他页面修改/.test(message.error.message)&&!recoveries.has(scope()))html+=cb(t('reload'),'water-reload')
  return html
}
function refreshFeedback(){const slot=activeRoot()?.querySelector('[data-central-water-feedback]');if(slot)slot.innerHTML=feedback()}
function frame():CentralPdaFrameInput {
  // A render is synchronous. Reuse its selected order only until it returns;
  // the next event, render or business command reads the current facts again.
  const previous=frameRoute;frameRoute=readRoute()
  try{return frameContent()}finally{frameRoute=previous}
}
function frameContent():CentralPdaFrameInput {
  const r=route(),factory=getFactoryMasterRecordById(session.currentFactory)
  const base:CentralPdaFrameInput={family:'water',accountName:centralFormalName(session.account?.name,session.account?.loginId||'',lang()),accountNo:'',factoryName:centralFormalName(factory?.name,factory?.code||'',lang()),operationName:text('water'),language:lang(),tab:r.tab,tabPathPrefix:prefix,content:''}
  if(!session.account){base.content=`<div data-central-water-feedback>${feedback()}</div>`+loginForm();return base}
  let content=`<div data-central-water-feedback>${feedback()}</div>`
  if(r.orderId){base.heading=r.tab==='receive'?text('receiving'):text('order');base.backPath=tabPath(r.tab)
    if(!r.fact){base.content=content+centralNotice(t('empty'));return base}
    content+=cb(lang()==='id'?'Pindai order berikutnya':'扫下一单','water-open-scan')+(scanOpen?scanForm():'')+waterIdentity(r.fact,lang())
    if(r.tab==='receive')content+=renderWaterReceive(r.fact,ui().sourceKey||incoming().selected?.key||'',receiveDraft(),lang())
    else if(r.tab==='warehouse')content+=waterFactsSummary(r.fact,lang())+renderWaterReceipts(r.orderId,session.currentFactory,ui().receiptScope,lang())
    else{content+=waterFactsSummary(r.fact,lang())+`<div class="mb-3 grid grid-cols-3 gap-2">${(['work','output','receipt'] as const).map(view=>cb(lang()==='id'?({work:'Proses',output:'Kirim',receipt:'Diterima'})[view]:({work:'加工',output:'交出',receipt:'实收'})[view],'water-view',view,ui().view===view)).join('')}</div>`
      content+=ui().view==='work'?renderWaterWork(r.fact,workDraft(),lang()):ui().view==='output'?renderWaterOutput(r.orderId,session.currentFactory,ui().output,lang()):renderWaterReceipts(r.orderId,session.currentFactory,ui().receiptScope,lang())}
    base.primary=r.tab==='warehouse'?undefined:primary()
  }else if(r.tab==='warehouse')content+=warehouseContent()
  else{content+=scanForm();const incomingRows=centralWaterIncoming(session.currentFactory),matches=scan.trim().toLowerCase(),facts=listCentralWaterFacts(session.currentFactory).filter(f=>r.tab!=='receive'||incomingRows.some(row=>row.orderId===f.order.waterOrderId&&row.remaining>0)).filter(f=>scanCandidates?scanCandidates.includes(f.order.waterOrderId):!matches||[f.order.waterOrderNo,f.order.taskNo,f.order.materialCode].some(v=>v.toLowerCase().includes(matches)))
    content+=facts.slice(0,limit).map(f=>`<button type="button" data-central-action="water-order" data-central-value="${ce(f.order.waterOrderId)}" class="mb-3 flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left">${f.image?.material?`<img src="${ce(f.image.material)}" alt="${ce(f.order.materialCode)}" class="h-14 w-14 shrink-0 object-contain">`:''}<span class="min-w-0"><strong class="block break-words">${ce(f.order.waterOrderNo)}</strong><span class="block break-words text-sm">${ce(f.order.materialCode)}</span><span class="block text-sm">${waterStatus(f.order.status,lang())}</span></span></button>`).join('')||centralNotice(t('empty'));if(facts.length>limit)content+=cb(t('more'),'water-more')}
  base.content=content;return base
}
function refreshFooter(){
  const root=activeRoot();if(!root)return
  const footer=primary(),old=root.querySelector('[data-central-footer]')
  if(!footer){old?.remove();return}
  const button=old?.querySelector<HTMLButtonElement>('button')
  // A blur/change can fire between pointerdown and click. Keep the same button
  // node so entering the next receipt cannot consume the first tap on Save.
  if(button){button.textContent=footer.label;button.dataset.centralAction=footer.action;button.disabled=!!footer.disabled;return}
  const html=renderCentralPdaFrame({...frameBase(),primary:footer}).match(/<footer[\s\S]*?<\/footer>/)?.[0]||''
  const nav=root.querySelector('nav');if(nav)nav.insertAdjacentHTML('beforebegin',html);else root.insertAdjacentHTML('beforeend',html)
}
function frameBase():CentralPdaFrameInput{return{family:'water',accountName:'',accountNo:'',factoryName:'',operationName:text('water'),language:lang(),tab:route().tab,content:''}}
function rootPhotoRetry(value:string){const url=new URL(value,location.origin).href;failedPhotos.delete(url);activeRoot()?.querySelectorAll<HTMLImageElement>('[data-central-water-photo]').forEach(img=>{if(img.src===url)img.src=value})}
function patch(){const root=activeRoot();if(!root)return;const main=root.querySelector<HTMLElement>('[data-central-content]')!,top=main.scrollTop,focused=document.activeElement as HTMLInputElement|undefined,field=focused?.dataset.centralWaterField,selection=focused?.selectionStart
  const holder=document.createElement('template');holder.innerHTML=renderCentralPdaFrame(frame());const next=holder.content.firstElementChild!
  root.lang=next.getAttribute('lang')!;root.querySelector('header')!.innerHTML=next.querySelector('header')!.innerHTML;root.querySelector('[data-central-heading]')!.innerHTML=next.querySelector('[data-central-heading]')!.innerHTML;main.innerHTML=next.querySelector('[data-central-content]')!.innerHTML
  root.querySelector('[data-central-footer]')?.remove();root.querySelector('nav')?.remove();next.querySelector('[data-central-footer]')&&root.append(next.querySelector('[data-central-footer]')!);next.querySelector('nav')&&root.append(next.querySelector('nav')!);main.scrollTop=top
  if(field){const input=root.querySelector<HTMLInputElement>(`[data-central-water-field="${field}"]`);input?.focus({preventScroll:true});if(input&&selection!==null)try{input.setSelectionRange(selection||0,selection||0)}catch{/* Selects have no text cursor. */}}
  mountCentralWaterPage();refreshFooter()
  if(message.error)root.querySelector<HTMLElement>('[data-central-water-feedback]')?.scrollIntoView({block:'start'})
}
function navigate(next:string){closeCentralWaterOverlay();message={};scan='';scanCandidates=undefined;scanOpen=false;path=next;if(appStore.getState().pathname===next)patch();else appStore.navigate(next)}
function openOrder(id:string,tab=route().tab){navigate(tabPath(tab)+'/'+encodeURIComponent(id))}
function overlay(content:string){closeCentralWaterOverlay();const node=document.createElement('div');node.dataset.centralOverlay='';node.className='fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2';node.innerHTML=`<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-3">${content}<div class="mt-3">${cb(t('close'),'water-overlay-close')}</div></section>`;activeRoot()?.append(node);node.querySelector<HTMLButtonElement>('button')?.focus()}
export function closeCentralWaterOverlay(){confirmation=undefined;const node=activeRoot()?.querySelector('[data-central-overlay]');if(!node)return false;node.remove();return true}
function requestConfirmation(action: NonNullable<typeof confirmation>['action'], content: string, input?: CentralWaterAction) {
  overlay(content)
  confirmation={action,scope:scope(),revision:centralWaterRevision(route().orderId,session.currentFactory),input,docId:ui().output.docId}
}
function takeConfirmation(action: NonNullable<typeof confirmation>['action']) {
  const pending=confirmation
  if(!pending||pending.action!==action||pending.scope!==scope()||pending.revision!==centralWaterRevision(route().orderId,session.currentFactory)||pending.docId!==ui().output.docId)throw new Error('CHANGED')
  closeCentralWaterOverlay();return pending
}
function logout(){discardCentralDrafts();session.signedOut=true;session.account=undefined;saveCentralSessionPreference();closeCentralWaterOverlay();patch()}
async function commit(fn:()=>Promise<unknown>,done:()=>void){if(saving)return;const key=scope();saving=true;message={};refreshFeedback();activeRoot()?.setAttribute('aria-busy','true');activeRoot()?.querySelectorAll<HTMLInputElement>('input,textarea,select,button').forEach(control=>control.disabled=true)
  try{await fn();recoveries.delete(key);done();if(key===scope())message={saved:true}}
  catch(error){if(error instanceof Error&&/已保存.*(?:未能更新|未更新)/.test(error.message))recoveries.set(key,()=>commit(fn,done));if(key===scope())message={error}}
  finally{saving=false;if(activeRoot()){activeRoot()!.setAttribute('aria-busy','false');patch()}}
}
async function saveWork(input:CentralWaterAction){const {orderId}=route(),actor=session.account!,key=scope(),draft=workDraft(),state=ui(),revision=draft.revision,op=token('work',{input,revision})
  await commit(()=>saveCentralWaterAction(orderId,input,actor,op,revision),()=>{if(input.action==='START')draft.revision=centralWaterRevision(orderId,actor.factoryId);else workDrafts.delete(key);if(input.action==='COMPLETE'){const f=centralWaterFact(orderId,actor.factoryId);if(f?.order.status==='WAIT_HANDOVER'&&f.availableOutput>0){state.view='output';state.output.panel='list'}}})}
function openDocument(id:string){const doc=centralWaterDispatch(id,session.currentFactory);if(!doc)throw new Error('WATER_wrongDocument');const out=ui().output;out.panel='document';if(out.docId!==id){out.docId=id;out.scan='';out.transport={...doc.transport}};ui().view='output';patch()}
function rollDraftKey(id?:string){return scope()+'|'+(id||'new')}
function openRoll(id?:string){
  const state=centralWaterOutput(route().orderId,session.currentFactory),roll=state?.rolls.find(r=>r.id===id),out=ui().output
  if(state?.fact.order.status==='DONE'||id&&(!roll||roll.dispatchId||roll.reservedBy))throw new Error('CHANGED')
  const saved=rollDrafts.get(rollDraftKey(id))
  out.rollId=id;out.raw=saved?.raw??(roll?String(roll.qty).replace('.',lang()==='id'?',':'.'):'')
  out.revision=saved?.revision??(id?centralWaterLabelRevision(route().orderId,id,session.currentFactory):undefined)
  out.operationId=crypto.randomUUID();out.panel='roll';patch()
}
function openLabel(ids:string[]){const out=ui().output;out.labelIds=ids;out.labelRevisions=Object.fromEntries(ids.map(id=>[id,centralWaterLabelRevision(route().orderId,id,session.currentFactory)]));out.panel='label';out.printRequested=false;patch()}
function identify(){const value=scan.trim();if(!value){message={text:t('noScan')};patch();return}const tab=route().tab,rolls=tab==='execute'?resolveCentralWaterRoll(value,session.currentFactory):[];if(rolls.length===1){openOrder(rolls[0].orderId,'execute');ui().view='output';ui().output.panel='list';ui().output.rollId=rolls[0].roll.id;patch();return}
  const sources=centralWaterIncoming(session.currentFactory).filter(row=>[row.source.id,row.source.documentNo,row.line.material.batchNo,row.line.label].includes(value)),ids=[...new Set([...sources.map(row=>row.orderId),...listCentralWaterFacts(session.currentFactory).filter(f=>[f.order.waterOrderId,f.order.waterOrderNo,f.order.taskNo,f.order.taskQrValue,f.order.materialCode].includes(value)).map(f=>f.order.waterOrderId)])]
  if(ids.length===1){openOrder(ids[0]);if(sources.length===1)ui().sourceKey=sources[0].key;patch();return}scanCandidates=ids.length?ids:undefined;message={text:ids.length?lang()==='id'?'Pilih order yang sesuai':'选择对应加工单':t('wrongScan')};patch();activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="scan"]')?.select()}
export async function renderCentralWaterPage(next:string,current:()=>boolean=()=>true){await ensureSpecialCraftRecords(true);if(!current())return'';path=next;const query=new URL(next,location.origin).searchParams,explicit=query.get('factoryId')||new URL(location.href).searchParams.get('factoryId'),candidate=explicit||session.currentFactory||session.preference.factoryId||centralWaterFactories()[0]?.id||'',factory=getFactoryMasterRecordById(candidate)
  if(factory&&factory.status==='active'&&isCentralPdaFactory(factory)){ensureCentralSessionAccount(factory.id);session.currentOperation='WATER_SOLUBLE';saveCentralSessionPreference()}else{session.account=undefined;session.currentFactory=''}
  message={};return renderCentralPdaFrame(frame())}
function handleWaterKeydown(event:KeyboardEvent){
  const root=activeRoot(),target=event.target as HTMLElement
  if(!root||saving||event.isComposing||event.keyCode===229)return
  if(event.key==='Escape'){event.preventDefault();if(!closeCentralWaterOverlay()&&route().orderId)navigate(tabPath(route().tab));return}
  if(root.querySelector('[data-central-overlay]')){if(event.key==='F1')event.preventDefault();return}
  if(event.key==='F1'){
    event.preventDefault()
    const rollScan=root.querySelector<HTMLInputElement>('[data-central-water-field="outputScan"]')
    if(rollScan){rollScan.focus();rollScan.select();return}
    const orderScan=root.querySelector<HTMLInputElement>('[data-central-water-field="scan"]')
    if(orderScan){orderScan.focus();orderScan.select();return}
    if(route().tab==='warehouse')return
    scanOpen=true;patch();activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="scan"]')?.focus();return
  }
  if(event.key!=='Enter'||!(target instanceof HTMLElement)||!target.matches('input'))return
  event.preventDefault()
  if(target.dataset.centralWaterLogin==='account'){root.querySelector<HTMLInputElement>('[data-central-water-login="password"]')?.focus();return}
  const field=target.dataset.centralWaterField
  if(field==='driver'||field==='vehicle'){root.querySelector<HTMLInputElement>(`[data-central-water-field="${field==='driver'?'vehicle':'plate'}"]`)?.focus();return}
  if(field==='plate'){root.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus();return}
  const direct=target.dataset.centralWaterLogin==='password'?'water-login':field==='scan'?'water-identify':field==='outputScan'?'water-output-scan':undefined
  const current=primary(),action=direct||(['receiveQuantity','workQuantity','rollQuantity'].includes(field||'')&&!current?.disabled?current?.action:undefined)
  if(action){const button=document.createElement('button');button.dataset.centralAction=action;void handleCentralWaterEvent(button,new MouseEvent('click'))}
}
export function mountCentralWaterPage(){const root=activeRoot();if(!root)return;root.setAttribute('aria-busy',String(saving));hydrateIcons(root);root.querySelectorAll<HTMLImageElement>('[data-central-water-photo]').forEach(img=>{if(img.complete&&img.naturalWidth)loadedPhotos.add(img.src);img.onload=()=>{loadedPhotos.add(img.src);failedPhotos.delete(img.src);img.hidden=false;img.parentElement?.querySelector('[data-water-photo-error]')?.remove();refreshFooter()};img.onerror=()=>{loadedPhotos.delete(img.src);failedPhotos.add(img.src);img.hidden=true;if(!img.parentElement?.querySelector('[data-water-photo-error]'))img.insertAdjacentHTML('afterend',`<span data-water-photo-error class="block text-xs text-red-700">${lang()==='id'?'Coba foto':'重试图片'}</span>`);refreshFooter()}})
  const frame=root.querySelector<HTMLIFrameElement>('[data-central-water-label]');if(frame){frame.srcdoc=renderCentralWaterLabel(route().orderId,ui().output.labelIds,session.currentFactory,lang())}
  if(!mounted){mounted=true;document.addEventListener('keydown',handleWaterKeydown)}
  if(recoveries.has(scope()))root.querySelectorAll<HTMLInputElement>('input,textarea,select,button').forEach(control=>{if(!['water-recover','language'].includes(control.dataset.centralAction||''))control.disabled=true})
  refreshFooter()
}
export async function handleCentralWaterEvent(target:Element,event?:Event):Promise<boolean>{if(saving)return true;const field=target.closest<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-central-water-field]'),loginField=target.closest<HTMLInputElement>('[data-central-water-login]')
  if(loginField){login[loginField.dataset.centralWaterLogin as keyof typeof login]=loginField.value;message={};refreshFeedback();return true}
  if(field){if(event?.type==='click')return true;if(recoveries.has(scope()))return true;const key=field.dataset.centralWaterField!,out=ui().output;message={};refreshFeedback();if(key==='scan'){scan=field.value;scanCandidates=undefined}else if(key==='receiveQuantity')receiveDraft()!.raw=field.value;else if(key==='position')receiveDraft()!.position=field.value;else if(key==='workQuantity'||key==='reason'){const draft=workDraft();if(key==='workQuantity')draft.raw=field.value;else draft.reason=field.value;const slot=activeRoot()?.querySelector('[data-central-water-note]'),needed=route().fact&&waterNeedsNote(route().fact!,draft);if(slot&&Boolean(slot.firstElementChild)!==Boolean(needed))slot.innerHTML=needed?waterNoteField(draft.reason,lang()):''}else if(key==='receiptScope'){ui().receiptScope=field.value;patch()}else if(key==='rollQuantity'){out.raw=field.value;const roll=centralWaterOutput(route().orderId,session.currentFactory)?.rolls.find(r=>r.id===out.rollId);if(!out.raw.trim()||Number(out.raw.replace(',','.'))===roll?.qty)rollDrafts.delete(rollDraftKey(out.rollId));else rollDrafts.set(rollDraftKey(out.rollId),{raw:out.raw,revision:out.revision})}else if(key==='outputScan')out.scan=field.value;else if(['driver','vehicle','plate','note'].includes(key))out.transport[key as keyof typeof out.transport]=field.value;refreshFooter();return true}
  const nav=target.closest<HTMLElement>('[data-central-nav]');if(nav){navigate(nav.dataset.centralNav!);return true}const node=target.closest<HTMLElement>('[data-central-action]');if(!node)return false;if(event&&event.type!=='click')return true
  const action=node.dataset.centralAction,value=node.dataset.centralValue||'',eventScope=scope(),eventPath=path
  if(recoveries.has(scope())&&!['water-recover','language'].includes(action||''))return true
  try{
    if(session.account){await ensureSpecialCraftRecords();if(eventScope!==scope()||eventPath!==path||!activeRoot())return true}
    const r=route(),state=ui(),out=state.output,actor=session.account
    const executionWrites=['water-input','water-work-save','water-over-confirm','water-finish','water-finish-confirm','water-save-roll','water-label-done','water-roll-send','water-output-scan','water-send','water-void-confirm']
    if(executionWrites.includes(action||'')&&r.tab!=='execute'||action==='water-save-receipt'&&r.tab!=='receive')throw new Error('CHANGED')
    if(action==='language'){const old=lang();session.language=old==='id'?'zh':'id';for(const d of workDrafts.values())d.raw=translateDyeNumber(d.raw,old,lang());for(const d of receiveDrafts.values())d.raw=translateDyeNumber(d.raw,old,lang());for(const d of rollDrafts.values())d.raw=translateDyeNumber(d.raw,old,lang());for(const s of uiStates.values())s.output.raw=translateDyeNumber(s.output.raw,old,lang());message={};closeCentralWaterOverlay();saveCentralSessionPreference();patch()}
    else if(action==='logout'){if(hasCentralDrafts())requestConfirmation('logout',`<p>${t('unsent')}</p>${cb(t('discard'),'water-logout-confirm',undefined,true)}${cb(t('cancel'),'water-overlay-close')}`);else logout()}
    else if(action==='water-logout-confirm'){takeConfirmation('logout');logout()}
    else if(action==='water-login'){const user=readFactoryPdaExecutionUsers().find(u=>normalizePdaLoginId(u.loginId)===normalizePdaLoginId(login.account));if(!user||!verifyPdaPassword(login.password,user.passwordHash))throw new Error('WATER_loginFail');if(user.status!=='ACTIVE')throw new Error('WATER_locked');const factory=getFactoryMasterRecordById(user.factoryId);if(!factory||factory.status!=='active'||!isCentralPdaFactory(factory))throw new Error('WATER_centralOnly');discardCentralDrafts();session.currentFactory=user.factoryId;session.account=user;session.signedOut=false;login={account:'',password:''};saveCentralSessionPreference();navigate(tabPath('receive'))}
    else if(action==='operation')overlay(cb(text('water'),'water-overlay-close')+cb(lang()==='id'?'Pencelupan':'染色','water-go-dye')+cb(lang()==='id'?'Proses tambahan / khusus':'辅助 / 特种工艺','water-go-special')+cb(lang()==='id'?'Pencetakan':'印花','water-go-print') + `<button type="button" class="min-h-12 w-full rounded-xl border bg-white p-3" data-central-nav="/fcs/pda/central/wash/receive">${lang()==='id'?'Pencucian':'洗水'}</button>`)
    else if(action==='water-go-print')navigate('/fcs/pda/central/print/'+r.tab)
    else if(action==='water-go-dye')navigate('/fcs/pda/central/dye/'+r.tab)
    else if(action==='water-go-special')navigate('/fcs/pda/central/'+r.tab)
    else if(action==='water-overlay-close')closeCentralWaterOverlay()
    else if(action==='water-photo'){if(failedPhotos.has(new URL(value,location.origin).href)){rootPhotoRetry(value)}else overlay(`<img src="${ce(value)}" alt="${ce(node.dataset.centralPhotoLabel||r.fact?.order.materialCode||t('photo'))}" class="max-h-[70dvh] w-full object-contain">`)}
    else if(action==='water-more'){limit+=15;patch()}
    else if(action==='water-order')openOrder(value)
    else if(action==='water-open-scan'){scanOpen=!scanOpen;patch();activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="scan"]')?.focus()}
    else if(action==='water-identify')identify()
    else if(action==='water-view'){state.view=value as Ui['view'];message={};patch()}
    else if(action==='water-source'){state.sourceKey=value;message={};patch()}
    else if(action==='water-clear'){if(r.tab==='receive'){const d=receiveDraft();if(d){d.raw='';d.pending=undefined;d.operationId=crypto.randomUUID()}}else if(state.view==='output'&&out.panel==='roll'){rollDrafts.delete(rollDraftKey(out.rollId));out.raw=''}else workDrafts.delete(scope());message={};patch()}
    else if(action==='water-pause-toggle'){workDraft().pause=!workDraft().pause;patch()}
    else if(action==='water-decision'){if(value==='RETURN_FOR_REWORK'&&r.fact?.reworkBlocked)throw new Error(r.fact.reworkBlocked);workDraft().decision=value as WaterWorkDraft['decision'];patch()}
    else if(action==='water-next-receipt'||action==='water-next-task')navigate(tabPath(r.tab))
    else if(action==='water-recover')await recoveries.get(scope())?.()
    else if(action==='water-reload'){
      await ensureSpecialCraftRecords(true)
      const draft=workDraft();draft.revision=centralWaterRevision(r.orderId,session.currentFactory)
      if(out.rollId){out.revision=centralWaterLabelRevision(r.orderId,out.rollId,session.currentFactory);const saved=rollDrafts.get(rollDraftKey(out.rollId));if(saved)saved.revision=out.revision}
      if(out.panel==='label'){out.panel='list';out.printRequested=false}
      message={};patch()
    }
    else if(action==='water-save-receipt'&&actor&&r.fact){const input=inputForReceipt(),key=scope()+'|'+incoming().selected!.key,draft=receiveDraft()!;await commit(()=>saveCentralWaterReceipt(r.orderId,input,actor),()=>{receiveDrafts.delete(key);const next={raw:'',position:draft.position,operationId:crypto.randomUUID()};receiveDrafts.set(key,next)})}
    else if(action==='water-input'&&actor&&r.fact)await saveWork({action:'START'})
    else if(action==='water-work-save'&&actor&&r.fact){const input=r.fact.canResolve?{action:'RESOLVE_PAUSE',decision:workDraft().decision} as CentralWaterAction:waterCompletionInput(r.fact,workDraft(),lang());if(input.action==='COMPLETE'&&input.completedQty>r.fact.order.plannedQty)requestConfirmation('over',`<strong>${ce(r.fact.order.waterOrderNo)}</strong><p>${text('cumulative')} ${cn(input.completedQty,lang())} ${waterUnit(r.fact.order.qtyUnit)}</p><p>${text('plan')} ${cn(r.fact.order.plannedQty,lang())}</p><p>${ce(input.reason)}</p>${cb(text('confirmOver'),'water-over-confirm',undefined,true)}`,input);else await saveWork(input)}
    else if(action==='water-over-confirm'&&actor&&r.fact){const pending=takeConfirmation('over');if(!pending.input||JSON.stringify(pending.input)!==JSON.stringify(waterCompletionInput(r.fact,workDraft(),lang())))throw new Error('CHANGED');await saveWork(pending.input)}
    else if(action==='water-finish'&&r.fact?.canFinish)requestConfirmation('finish',`<strong>${ce(r.fact.order.waterOrderNo)}</strong><p class="my-3">${text('finishWarning')}</p>${cb(text('finish'),'water-finish-confirm',undefined,true)}`)
    else if(action==='water-finish-confirm'&&actor){takeConfirmation('finish');await saveWork({action:'FINISH_DOCUMENT'})}
    else if(action==='water-output-back'){out.panel='list';message={};patch()}
    else if(action==='water-roll-add')openRoll()
    else if(action==='water-roll-edit')openRoll(value)
    else if(action==='water-save-roll'&&actor){const input={id:out.rollId,qty:dyeNumber(out.raw,lang(),2)},op=token('roll',{input,revision:out.revision}),draftKey=rollDraftKey(out.rollId);let ids:string[]=[];await commit(async()=>{ids=await saveCentralWaterRoll(r.orderId,input,actor,op,out.revision)},()=>{rollDrafts.delete(draftKey);out.raw='';out.panel='list'});if(!message.error&&ids.length)openLabel(ids)}
    else if(action==='water-label')openLabel([value])
    else if(action==='water-print'){const frame=activeRoot()?.querySelector<HTMLIFrameElement>('[data-central-water-label]');if(frame){frame.contentWindow?.print();out.printRequested=true;refreshFooter()}}
    else if(action==='water-label-done'&&actor){const ids=[...out.labelIds],revisions={...out.labelRevisions},op=token('print',{ids,revisions});await commit(()=>markCentralWaterRollsPrinted(r.orderId,ids,revisions,actor,op),()=>{out.panel='list';out.printRequested=false})}
    else if(action==='water-roll-send'&&actor){const op=token('create',{roll:value});let id='';await commit(async()=>{id=await createCentralWaterDispatch([{orderId:r.orderId,rollIds:[value]}],actor,op)},()=>{});if(id)openDocument(id)}
    else if(action==='water-document')openDocument(value)
    else if(action==='water-output-scan'&&actor){const doc=centralWaterDispatch(out.docId||'',actor.factoryId),code=out.scan.trim();if(!doc||!code)throw new Error(t('noScan'));const op=token('scan',{doc:doc.id,code}),inDocument=doc.lines.some(line=>line.rolls.some(roll=>roll.barcode===code));if(inDocument)await commit(()=>scanCentralWaterDispatch(doc.id,code,actor,op),()=>{out.scan=''});else{const matches=resolveCentralWaterRoll(code,actor.factoryId);if(matches.length!==1)throw new Error('WATER_wrongRoll');const found=matches[0];await commit(()=>createCentralWaterDispatch([{orderId:found.orderId,rollIds:[found.roll.id]}],actor,op,{docId:doc.id,scannedBarcode:code}),()=>{out.scan=''})}const scanner=activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="outputScan"]');scanner?.focus();if(message.error)scanner?.select()}
    else if(action==='water-send'&&actor){const id=out.docId!,transport={...out.transport},op=token('send',{id,transport});await commit(()=>confirmCentralWaterDispatch(id,transport,actor,op),()=>{})}
    else if(action==='water-void')requestConfirmation('void',`<p class="break-all">${ce(out.docId)}</p><p>${lang()==='id'?'Batalkan kiriman dan lepas rol yang dipilih?':'作废本单并释放已选卷？'}</p>${cb(lang()==='id'?'Batalkan kiriman':'作废交出单','water-void-confirm',undefined,true)}`)
    else if(action==='water-void-confirm'&&actor){const id=takeConfirmation('void').docId!;await commit(()=>voidCentralWaterDispatch(id,actor,token('void',id)),()=>{out.panel='list'})}
    else if(action==='water-wh-view'&&['locations','receiveRecords','handoffRecords'].includes(value)){wh.view=value as WaterWarehouseUi['view'];wh.limit=15;patch()}
    else if(action==='water-wh-kind'&&['WAIT_PROCESS','WAIT_HANDOVER'].includes(value)){wh.kind=value as WaterWarehouseUi['kind'];wh.location='';wh.limit=15;patch()}
    else if(action==='water-wh-more'){wh.limit+=15;patch()}
    else if(action==='water-wh-location'){wh.location=value===wh.location?'':value;patch()}
    else return false
  }catch(error){message={error};patch()}
  return true
}
