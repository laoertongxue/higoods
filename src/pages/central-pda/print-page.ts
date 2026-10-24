// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { retryPcsRecordState, refreshPcsRecordStateAfterExternalChange } from '../../data/pcs-record-runtime.ts'
import { localDateTimeText } from '../../utils.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { ensureSpecialCraftRecords } from '../../data/fcs/special-craft-records.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { prepareFactoryReceipt, type FactoryReceiptInput } from '../../data/fcs/factory-receiving.ts'
import { calculateYarnWeight } from '../../data/fcs/yarn-weight.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { cb, ce, ct, centralNotice, centralFormalName } from './ui.ts'
import { renderCentralOperationMenu } from './operation-menu.ts'
import { pdaEmpty, pdaUi } from '../pda-mobile-ui.ts'
import { dyeNumber, translateDyeNumber, dyePartnerLabel } from './dye-ui.ts'
import { pt, printError, printUsesRolls, printUnit, printNumber as n, printProductionInput, printPrimaryLabel, type PrintWorkDraft } from './print-ui.ts'
import { listCentralPrintFacts, centralPrintFactories, centralPrintEntryFactory, centralPrintFact, centralPrintIncoming, centralPrintChoices, centralPrintUsedPackageCount, centralPrintRevision, saveCentralPrintReceipt, saveCentralPrintProduction } from './print-model.ts'
import { printIdentity, printFacts, printPhoto, renderPrintReceive, renderPrintWork, renderPrintReceipts, renderPrintWarehouse, printIncomingAvailable, type PrintReceiveDraft, type PrintWarehouseUi } from './print-view.ts'
import { centralPrintOutput, centralPrintRollRemaining, centralPrintLabelRevision, addCentralPrintRoll, saveCentralPrintRoll, markCentralPrintRollsPrinted } from './print-output-model.ts'
import { initialPrintRollFields, printRollInput, type PrintRollFields } from './print-roll-ui.ts'
import { prt, renderPrintOutputPanel, type PrintOutputUi, type PrintRollEditor } from './print-output-view.ts'
import { renderCentralPrintLabel } from './print-label.ts'
import { centralPrintDispatch,centralPrintDispatchDocument,centralPrintDispatchRevision,scanCentralPrintDispatch,saveCentralPrintDispatch,type PrintDispatchDraft,type PrintDispatchAction } from './print-dispatch-model.ts'
import { pdt,printDispatchError,renderPrintDispatch } from './print-dispatch-view.ts'
import { centralPrintCompletion, saveCentralPrintCompletion } from './print-completion-model.ts'
import { pct, renderPrintCompletionConfirmation } from './print-completion-view.ts'
import { printIncomingRollMatches, printIncomingSourceRows } from './print-scan.ts'
import { centralPrintInputLabel } from './print-input-label.ts'
import { centralPrintStockIncoming, saveCentralPrintStockReceipt, centralPrintPreparation, centralPrintAllocationRequest, saveCentralPrintAllocation } from './print-preparation-model.ts'
import { renderPrintPreparation, preparationWords, type PrintAllocationDraft } from './print-preparation-view.ts'
const prefix = '/fcs/pda/central/print'
type Ui = { view: 'work' | 'output' | 'receipt'; choice: string; source: string; rolls: Map<string, string>; output:PrintOutputUi;dispatchId?:string;dispatchLimit?:number }
const lastFields = new Map<string, string>()
const allocationDrafts = new Map<string, PrintAllocationDraft>()
let allocationLine = ''
const rollEditors=new Map<string,PrintRollEditor>()
const dispatchDrafts=new Map<string,PrintDispatchDraft>()
let completionRequest:{scope:string;orderId:string;revision:string;operationId:string}|undefined
let dispatchChange:{scope:string;documentId:string;revision:string;action:PrintDispatchAction;operationId:string}|undefined
const states = new Map<string, Ui>(), workDrafts = new Map<string, PrintWorkDraft>(), receiptDrafts = new Map<string, PrintReceiveDraft>(), recoveries = new Map<string, () => Promise<void>>()
let path = '', scan = '', scanOpen = false, limit = 15, saving = false, mounted = false, login = { account: '', password: '' }, message: { error?: unknown; saved?: boolean; text?: string } = {}
let logoutScope: string | undefined
let overlayReturn: HTMLElement | undefined
let inputLabel: { key: string; signature: string; ready: boolean } | undefined
const wh: PrintWarehouseUi = { view: 'locations', kind: 'WAIT_PROCESS', location: '', limit: 15 }
const lang = () => session.language, t = (key: Parameters<typeof ct>[1]) => ct(lang(), key), text = (key: Parameters<typeof pt>[1]) => pt(lang(), key)
const root = () => document.querySelector<HTMLElement>('[data-central-pda-root][data-central-family="print"]')
const tabPath = (tab: CentralPdaTab) => prefix + '/' + tab
function routeIdentity() { const parts = new URL(path || tabPath('receive'), location.origin).pathname.split('/'); let id = ''; try { id = decodeURIComponent(parts[6] || '') } catch { }; const tab = (['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] : 'receive') as CentralPdaTab; return {tab,id,stockSource: tab === 'receive' ? new URL(path || tabPath('receive'), location.origin).searchParams.get('source') || '' : ''} }
function route(){const r=routeIdentity();return {...r,fact:session.account?centralPrintFact(r.id,session.currentFactory):undefined}}
function scope() { return [session.currentFactory, session.account?.userId, routeIdentity().id || routeIdentity().stockSource || routeIdentity().tab].join('|') }
function ui() { const key = scope(); if (!states.has(key)) states.set(key, { view: 'work', choice: '', source: '', rolls: new Map(),output:{panel:'list',labelIds:[],labelRevisions:{},printRequested:false,labelReady:false,operationId:crypto.randomUUID()} }); return states.get(key)! }
function dispatchKey(){return scope()+'|'+(ui().dispatchId||'')}
function dispatchDraft(){
 const id=ui().dispatchId||'',revision=centralPrintDispatchRevision(routeIdentity().id,session.currentFactory,id)
 if(!dispatchDrafts.has(dispatchKey()))dispatchDrafts.set(dispatchKey(),{documentId:id,scan:'',operationId:crypto.randomUUID(),revision})
 const d=dispatchDrafts.get(dispatchKey())!
 if(!d.scan.trim()&&d.revision!==revision){d.revision=revision;d.operationId=crypto.randomUUID()}
 return d
}
function errorText(error:unknown){return ui().output.panel==='dispatch'||error instanceof Error&&/PD_[A-Za-z]+/.test(error.message)?printDispatchError(error,lang()):printError(error,lang())}
function choice() { const choices = route().fact ? centralPrintChoices(route().fact!) : [], state = ui(); if (!choices.some(c => c.key === state.choice)) state.choice = choices[0]?.key || ''; return choices.find(c => c.key === state.choice) }
function workKey() { return scope() + '|' + (choice()?.key || '') }
function workDraft() {
 const c=choice(),fact=route().fact;if(!c||!fact)return undefined
 const key=workKey(),printer=fact.order.printerNo||'',revision=centralPrintRevision(routeIdentity().id)
 if(!workDrafts.has(key))workDrafts.set(key,{raw:'',count:'',loss:'',printer,initialPrinter:printer,revision,operationId:crypto.randomUUID()})
 const d=workDrafts.get(key)!
 if(!d.raw.trim()&&!d.count.trim()&&!d.loss.trim()&&d.printer===(d.initialPrinter??d.printer)&&d.revision!==revision){d.printer=printer;d.initialPrinter=printer;d.revision=revision;d.operationId=crypto.randomUUID()}
 return d
}
function incomingRows() { const r = routeIdentity(); return r.stockSource ? centralPrintStockIncoming(session.currentFactory).filter(row => row.key === r.stockSource) : centralPrintIncoming(session.currentFactory, r.id) }
function selectedIncoming() { const rows = incomingRows().filter(r => printIncomingAvailable(r) > 0), state = ui(); if (!rows.some(r => r.key === state.source)) state.source = rows[0]?.key || ''; const row = rows.find(r => r.key === state.source); if (row?.line.material.kind === 'FABRIC' && !row.remainingRolls.some(r => r.barcode === state.rolls.get(row.key))) state.rolls.set(row.key, row.remainingRolls[0]?.barcode || ''); return row }
function receiptKey() { const row = selectedIncoming(); return row ? scope() + '|' + row.key + '|' + (ui().rolls.get(row.key) || '') : '' }
function receiptDraft() { const key = receiptKey(); if (!key) return undefined; if (!receiptDrafts.has(key)) receiptDrafts.set(key, { raw: '', weight: '', gross: '', PAPER: '', CONICAL: '', PAGODA: '', position: '', operationId: crypto.randomUUID() }); return receiptDrafts.get(key)! }
function allocationKey() { return [session.currentFactory, session.account?.userId, allocationLine].join('|') }
function allocationDraft() {
  if (!allocationLine) return undefined
  const key = allocationKey()
  if (!allocationDrafts.has(key)) allocationDrafts.set(key, { orderId: '', raw: '', operationId: crypto.randomUUID() })
  return allocationDrafts.get(key)!
}
function allocationRequest() {
  const row = centralPrintPreparation(session.currentFactory).find(row => row.line.id === allocationLine), d = allocationDraft(), actor = session.account
  if (!row || !d || !actor) throw Error('PRINT_sourceChanged')
  const quantity = dyeNumber(d.raw, lang(), null), fingerprint = JSON.stringify([d.orderId, quantity, actor.userId])
  if (d.pending?.fingerprint !== fingerprint) {
    if (d.pending) d.operationId = crypto.randomUUID()
    d.pending = { fingerprint, request: centralPrintAllocationRequest(row, d.orderId, quantity, actor, 'PRINT-ALLOC-' + d.operationId, localDateTimeText()) }
  }
  return d.pending.request
}
registerCentralDraftDiscard(() => { states.clear();lastFields.clear();allocationDrafts.clear();allocationLine = '';rollEditors.clear();dispatchDrafts.clear();dispatchChange=undefined;completionRequest=undefined; workDrafts.clear(); receiptDrafts.clear(); recoveries.clear(); scan = ''; scanOpen = false; login = { account: '', password: '' }; message = {}; wh.view = 'locations'; wh.kind = 'WAIT_PROCESS'; wh.location = ''; wh.area = ''; wh.limit = 15; wh.pendingLimit = 15; inputLabel = undefined; logoutScope = undefined }, () => [...allocationDrafts.values()].some(d => !!d.raw.trim()) || [...dispatchDrafts.values()].some(d=>!!d.scan.trim())||[...rollEditors.values()].some(rollEditorDirty)||[...workDrafts].some(([key, d]) => !!(d.raw.trim() || d.count.trim() || d.loss.trim()) || d.printer !== (d.initialPrinter??'')) || [...receiptDrafts.values()].some(d => [d.raw, d.weight, d.gross, d.PAPER, d.CONICAL, d.PAGODA].some(v => !!v.trim())))
function rollKey(id=ui().output.rollId){return scope()+'|'+(id||'')}
function rollEditor(){return rollEditors.get(rollKey())}
function rollEditorDirty(editor:PrintRollEditor){
 const baseline=JSON.parse(editor.initial) as PrintRollFields,f=editor.fields
 const number=(value:string)=>{try{return dyeNumber(value,lang(),null,true)}catch{return value}}
 return (['quantity','weight','gsm','width'] as const).some(key=>!!f[key].trim()&&number(f[key])!==number(baseline[key]))
  ||f.batch!==baseline.batch||f.vat!==baseline.vat||f.remark!==baseline.remark||!!editor.quantities.METERS.trim()
  ||f.measure!==baseline.measure&&!!f.quantity.trim()||f.weightMode!==baseline.weightMode&&!!(f.quantity.trim()||f.weight.trim())
}
function openRoll(id:string){
 const state=centralPrintOutput(route().id,session.currentFactory),roll=state?.rolls.find(r=>r.id===id)
 if(!roll?.editable)throw new Error('PRINT_rollClosed')
 const key=rollKey(id),revision=centralPrintLabelRevision(route().id,id,session.currentFactory)!
 if(!rollEditors.has(key)){const fields=initialPrintRollFields(roll,lang()),initial=JSON.stringify(fields),batches=state?.fact.order.productionBatches||[];if(!fields.batch&&batches.length===1)fields.batch=batches[0].id;rollEditors.set(key,{rollId:id,fields,quantities:{NATIVE:fields.quantity,METERS:''},initial,revision,operationId:crypto.randomUUID(),specOpen:false})}
 ui().output.rollId=id;ui().output.panel='edit';ui().view='output';message={};patch()
}
function rollInput(){
 const state=centralPrintOutput(route().id,session.currentFactory),editor=rollEditor(),roll=state?.rolls.find(r=>r.id===editor?.rollId)
 if(!state||!editor||!roll?.editable)throw new Error('PRINT_rollClosed')
 if(!roll.batchId&&state.fact.order.productionBatches?.length&&!editor.fields.batch)throw new Error('PRINT_chooseBatch')
 if(editor.revision!==centralPrintLabelRevision(route().id,roll.id,session.currentFactory))throw new Error('CHANGED')
 return printRollInput(state.fact.order.output,roll,editor.fields,centralPrintRollRemaining(route().id,roll.id,session.currentFactory),lang())
}
function openLabels(ids:string[]){
 const state=centralPrintOutput(route().id,session.currentFactory)
 if(!state||!ids.length||ids.some(id=>!state.rolls.find(r=>r.id===id)?.printable))throw new Error('PRINT_labelNotReady')
 const out=ui().output;out.labelIds=ids;out.labelRevisions=Object.fromEntries(ids.map(id=>[id,centralPrintLabelRevision(route().id,id,session.currentFactory)!]));out.panel='label';out.operationId=crypto.randomUUID();out.printRequested=false;out.labelReady=false;ui().view='output';patch()
}
function rollFieldChanged(field:HTMLInputElement|HTMLSelectElement){
 const editor=rollEditor();if(!editor||recoveries.has(scope()))return
 const name=field.dataset.centralPrintRollField as keyof PrintRollFields,value=field.value
 message={};refreshFeedback()
 if(name==='measure'){editor.quantities[editor.fields.measure]=editor.fields.quantity;editor.fields.measure=value as PrintRollFields['measure'];editor.fields.quantity=editor.quantities[editor.fields.measure];patch();root()?.querySelector<HTMLInputElement>('[data-central-print-roll-field=quantity]')?.focus()}
 else if(name==='weightMode'){editor.fields.weightMode=value as PrintRollFields['weightMode'];patch();if(value==='ACTUAL')root()?.querySelector<HTMLInputElement>('[data-central-print-roll-field=weight]')?.focus()}
 else{editor.fields[name]=value as never;if(name==='quantity')editor.quantities[editor.fields.measure]=value;refreshFooter()}
}
function receiptInput() {
const row = selectedIncoming(), draft = receiptDraft(), actor = session.account; if (!row || !draft || !actor) throw new Error('PRINT_wrongSource'); const [warehouseId, locationId] = draft.position.split('|'); if (!warehouseId || !locationId) throw new Error('DYE_wrongPosition'); const line: FactoryReceiptInput['lines'][number] = { sourceId: row.source.id, sourceLineId: row.line.id, warehouseId, locationId }
  if (row.line.material.kind === 'FABRIC') line.rolls = [{ barcode: ui().rolls.get(row.key) || '', yard: dyeNumber(draft.raw, lang(), 3), warehouseId, locationId }]
  else if (row.line.material.kind === 'YARN') { line.grossKg = dyeNumber(draft.gross, lang(), 3, true); line.tubes = { PAPER: dyeNumber(draft.PAPER || '0', lang(), 0, true), CONICAL: dyeNumber(draft.CONICAL || '0', lang(), 0, true), PAGODA: dyeNumber(draft.PAGODA || '0', lang(), 0, true) }; line.pcs = Object.values(line.tubes).reduce((sum, v) => sum + v, 0); calculateYarnWeight(line.grossKg, line.tubes, line.pcs) }
  else if (row.line.measurementBasis === 'CONTINUOUS_LENGTH') { line.businessQty = dyeNumber(draft.raw, lang(), 3, true); line.businessUnit = row.line.unit }
  else { line.weightKg = dyeNumber(draft.weight, lang(), 3, true); if (!['kg', '公斤'].includes(row.line.unit)) { line.businessQty = dyeNumber(draft.raw, lang(), 3, true); line.businessUnit = row.line.unit } }
  const fingerprint = JSON.stringify({ line, actor: actor.userId }); if (draft.pending?.fingerprint !== fingerprint) { if (draft.pending) draft.operationId = crypto.randomUUID(); draft.pending = { fingerprint, input: { id: 'FRP-' + draft.operationId, factoryId: actor.factoryId, operatorId: actor.userId, operatorName: actor.name, receivedAt: localDateTimeText(), remark: '', lines: [line] } } }
  withFactoryProcessStaticRead(() => prepareFactoryReceipt(draft.pending!.input)); return draft.pending.input
}
function productionInput() { const c = choice(), draft = workDraft(), fact = route().fact; if (!c || !draft || !fact) throw new Error('CHANGED'); if (draft.revision !== centralPrintRevision(route().id)) throw new Error('CHANGED'); const input = printProductionInput(fact, c, draft, lang()); if (input.kind === 'OUTPUT') input.usedRollCount = centralPrintUsedPackageCount(fact); return input }
function photosReady() { const images = [...(root()?.querySelectorAll<HTMLImageElement>('[data-central-print-photo]') || [])]; return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0) }
function receiptPrimary(): CentralPdaFrameInput['primary'] {
  const row = selectedIncoming(), draft = receiptDraft()
  if (!row) return { label: t('next'), action: 'print-next', disabled: saving }
  const result = { label: t('receive'), action: 'print-save-receipt', disabled: true }
  let error = ''
  try {
    if (draft && [draft.raw, draft.weight, draft.gross].some(value => value.trim())) {
      const input = receiptInput(), receipt = withFactoryProcessStaticRead(() => prepareFactoryReceipt(input)), line = receipt.lines[0]
      result.label += ' · ' + n(line.qty, lang()) + ' ' + printUnit(line.unit, lang())
      if (line.businessQty !== undefined && line.businessUnit && line.businessUnit !== line.unit) result.label += ' / ' + n(line.businessQty, lang()) + ' ' + printUnit(line.businessUnit, lang())
      result.disabled = saving || !photosReady()
    }
  } catch (cause) { error = errorText(cause) }
  const slot = root()?.querySelector('[data-central-print-field-error]'); if (slot) slot.textContent = error
  return result
}
function primary(): CentralPdaFrameInput['primary'] {
const r = route(); if (!session.account) return undefined; if (recoveries.has(scope())) return { label: t('reload'), action: 'print-recover', disabled: saving };
  if (r.tab === 'warehouse' && wh.view === 'preparation' && allocationLine) {
    const row = centralPrintPreparation(session.currentFactory).find(row => row.line.id === allocationLine), d = allocationDraft()
    if (!row || row.remaining <= 0 || !row.targets.length) return undefined
    let disabled = true, error = ''
    try { if (d?.raw.trim()) { allocationRequest(); disabled = saving || !photosReady() } } catch (cause) { error = errorText(cause) }
    const slot = root()?.querySelector('[data-central-print-field-error]'); if (slot) slot.textContent = error
    return { label: preparationWords[lang()].save + (d?.raw.trim() ? ' · ' + d.raw + ' ' + printUnit(row.line.unit, lang()) : ''), action: 'print-allocation-save', disabled }
  }
  if (r.stockSource) return receiptPrimary()
  if (!r.fact) return undefined
  let result: CentralPdaFrameInput['primary'], error = ''; try {
    if (r.tab === 'receive') return receiptPrimary()
    else if(r.tab==='execute'&&ui().view==='output'){
      const out=ui().output
      if(out.panel==='dispatch'&&!r.fact.closed){const d=dispatchDraft(),current=centralPrintDispatchDocument(d.documentId);if(current?.doc.status==='草稿'){result={label:`${pdt(lang(),'confirm')} · ${n(current.total,lang())} ${printUnit(current.unit,lang())}`,action:'print-dispatch-confirm',disabled:saving||!current.canConfirm||!r.fact.order.receivingTargetWarehouseName||!!d.scan.trim()||!photosReady()}}}
      else if(out.panel==='edit'){const editor=rollEditor();result={label:prt(lang(),'save',printUsesRolls(r.fact.order.output.objectType)),action:'print-save-roll',disabled:true};if(editor?.fields.quantity.trim()){rollInput();result.disabled=saving||!photosReady()||!rollEditorDirty(editor)}}
      else if(out.panel==='label'&&!r.fact.closed)result={label:prt(lang(),'printedConfirm'),action:'print-label-done',disabled:saving||!out.printRequested||!out.labelReady}
    }
    else if (r.tab === 'execute' && ui().view === 'work') { const c = choice(), d = workDraft(); if (c && d) { result = { label: printPrimaryLabel(c, lang()), action: 'print-save-work', disabled: true }; if (c.max === undefined || d.raw.trim()) { productionInput(); if (c.max !== undefined) result.label += ' · ' + n(dyeNumber(d.raw, lang(), 2, true), lang()) + ' ' + printUnit(c.unit || r.fact.order.output.qtyUnit, lang()); result.disabled = saving || !photosReady() } } }
    if(!result&&r.tab==='execute'&&!r.fact.closed&&(ui().view==='receipt'||ui().view==='work'&&!choice())){const state=centralPrintCompletion(r.id,session.currentFactory);if(state?.ready)result={label:`${pct(lang(),'complete')} · ${n(state.outputQty,lang())} ${printUnit(r.fact.order.output.qtyUnit,lang())}`,action:'print-complete-open',disabled:saving||!photosReady()}}
  } catch (cause) { error = errorText(cause); if (result) result.disabled = true } const slot = root()?.querySelector('[data-central-print-field-error]'); if (slot) slot.textContent = error; return result
}
function feedback() { return saving ? centralNotice(t('saving')) : message.error ? centralNotice(errorText(message.error), true) + (!recoveries.has(scope()) && /变化|冲突|版本|更新|修改|CHANGED|PW_changed|PD_changed/.test(message.error instanceof Error ? message.error.message : '') ? cb(t('reload'), 'print-reload') : '') : message.saved ? centralNotice(t('saved')) : message.text ? centralNotice(message.text) : '' }
function scanForm() { return `<div class="space-y-1"><label class="block px-1 text-[13px] font-medium leading-5 text-[#62748a]">${t('scan')}</label><div class="flex gap-2"><input data-central-print-field="scan" class="h-14 min-w-0 flex-1 rounded-xl border border-[#bdcadb] bg-white px-3 text-[15px] text-[#1a293c] outline-none focus:border-[#2461ed]" value="${ce(scan)}" autocomplete="off" inputmode="text"><button type="button" class="min-h-14 shrink-0 rounded-xl bg-[#2461ed] px-4 text-[15px] font-semibold text-white" data-central-action="print-identify">${t('identify')}</button></div></div>` }
function frame(): CentralPdaFrameInput {
const r = route(), factory = getFactoryMasterRecordById(session.currentFactory); const base: CentralPdaFrameInput = { family: 'print', accountName: centralFormalName(session.account?.name, session.account?.loginId || '', lang()), accountNo: '', factoryName: centralFormalName(factory?.name, factory?.code || '', lang()), operationName: text('print'), language: lang(), tab: r.tab, tabPathPrefix: prefix, content: '' }; let html = `<div data-central-print-feedback>${feedback()}</div>`
  if (!session.account) { base.content = html + `<label class="my-3 block">${t('account')}<input class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3" data-central-print-login="account" autocomplete="username" value="${ce(login.account)}"></label><label class="my-3 block">${t('password')}<input class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3" data-central-print-login="password" type="password" autocomplete="current-password" value="${ce(login.password)}"></label>${cb(t('login'), 'print-login', undefined, true)}`; return base }
  if (r.stockSource) {
    base.heading = t('receive'); base.backPath = tabPath('receive')
    const row = selectedIncoming()
    html += (scanOpen ? scanForm() : '') + (row ? '<div class="my-3 flex items-start gap-3 rounded-xl border bg-white p-3">' + printPhoto(row.line.material.imageUrl, row.line.material.sku) + '<strong class="min-w-0 break-words">' + ce(row.line.material.sku) + '</strong></div>' : '') + renderPrintReceive(row, row ? ui().rolls.get(row.key) || '' : '', receiptDraft(), lang(), session.currentFactory, '', incomingRows())
    base.primary = primary()
  }
  else if (r.id) { base.heading = r.tab === 'receive' ? t('receive') : text('order'); base.backPath = tabPath(r.tab); if (!r.fact) { base.content = html + centralNotice(t('empty')); return base } const focusedOutput=r.tab==='execute'&&ui().view==='output'&&ui().output.panel!=='list';html += (scanOpen ? scanForm() : '') + (focusedOutput?'':printIdentity(r.fact, lang(),r.tab==='execute'&&ui().view!=='work'?'output':'input')); if (r.tab === 'receive') { const row = selectedIncoming(); html += renderPrintReceive(row, row ? ui().rolls.get(row.key) || '' : '', receiptDraft(), lang(), session.currentFactory, r.id) } else if (r.tab === 'execute') { html += focusedOutput?'':printFacts(r.fact, lang()) + `<div class="my-3 grid grid-cols-3 gap-2">${(['work', 'output', 'receipt'] as const).map(view => cb(text(({ work: 'viewWork', output: 'viewOutput', receipt: 'viewReceipt' } as const)[view]), 'print-view', view, ui().view === view)).join('')}</div>`; const c = choice(); html += ui().view === 'work' ? renderPrintWork(r.fact, c?.key || '', workDraft(), lang()) : ui().view === 'output' ? (ui().output.panel==='dispatch'?renderPrintDispatch(r.id,session.currentFactory,dispatchDraft(),lang(),ui().dispatchLimit||15):renderPrintOutputPanel(r.id,session.currentFactory,ui().output,rollEditor(),lang())) : renderPrintReceipts(r.fact,lang()) } else html += renderPrintReceipts(r.fact,lang()); base.primary = primary() }
  else if (r.tab === 'warehouse') { html += wh.view === 'preparation' ? (allocationLine ? '' : cb(t('back'), 'print-preparation-exit')) + renderPrintPreparation(session.currentFactory, allocationLine, allocationDraft(), wh.limit, lang()) : renderPrintWarehouse(session.currentFactory, wh, lang()); base.primary = primary() }
  else { html += scanForm(); const incoming = centralPrintIncoming(session.currentFactory), facts = listCentralPrintFacts(session.currentFactory).filter(f => r.tab !== 'receive' || incoming.some(row => row.orderId === f.order.workOrderId && printIncomingAvailable(row) > 0)); html += facts.slice(0, limit).map(f => `<button type="button" class="${pdaUi.card} mb-2 flex w-full items-start gap-3 p-3 text-left" data-central-action="print-order" data-central-value="${ce(f.order.workOrderId)}">${f.order.plannedInput.imageUrl ? `<img src="${ce(f.order.plannedInput.imageUrl)}" alt="${ce(f.order.plannedInput.sku)}" class="h-16 w-16 shrink-0 rounded-lg border border-[#e2e6ec] bg-[#f1f3f6] object-contain">` : ''}<span class="min-w-0 flex-1"><strong class="block break-words text-[16px] font-semibold leading-6 text-[#1a293c]">${ce(f.order.printOrderNo)}</strong><span class="mt-1 block break-words text-[13px] leading-5 text-[#62748a]">${ce(f.order.plannedInput.sku)}</span><span class="mt-2 block text-[14px] leading-5 text-[#1a293c]">${n(f.order.actualInput.receivedQty, lang())} ${ce(printUnit(f.order.plannedInput.qtyUnit, lang()))}</span></span><span class="shrink-0 self-center text-[#8090a4]" aria-hidden="true">›</span></button>`).join('') || pdaEmpty(t('empty')); if (facts.length > limit) html += `<button type="button" class="${pdaUi.secondaryButton}" data-central-action="print-more">${t('more')}</button>`; if (r.tab === 'receive') { const stocks = centralPrintStockIncoming(session.currentFactory).filter(row => printIncomingAvailable(row) > 0); if (stocks.length) html += '<h2 class="my-3 font-bold">' + preparationWords[lang()].title + '</h2>' + stocks.slice(0, limit).map(row => '<button type="button" class="my-3 flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left" data-central-action="print-stock-source" data-central-value="' + ce(row.key) + '"><img src="' + ce(row.line.material.imageUrl) + '" alt="' + ce(row.line.material.sku) + '" class="h-14 w-14 shrink-0 object-contain"><span class="min-w-0"><strong class="block break-words">' + ce(row.source.documentNo) + '</strong><span class="block break-words">' + ce(row.line.material.sku) + '</span><span class="block break-words">' + ce(dyePartnerLabel(row.source.origin, lang())) + '</span></span></button>').join('') + (stocks.length > limit ? cb(t('more'), 'print-more') : '') } }
  base.content = html; return base
}
function refreshFeedback() { const slot = root()?.querySelector('[data-central-print-feedback]'); if (slot) slot.innerHTML = feedback() }
/** The business reader is unavailable: retain the visible input rather than rerendering from it. */
function renderRecovery(){
 const active=root();if(!active)return
 active.setAttribute('aria-busy',String(saving));refreshFeedback()
 let footer=active.querySelector<HTMLElement>('[data-central-footer]')
 if(!footer){footer=document.createElement('footer');footer.dataset.centralFooter='';footer.className='shrink-0 border-t border-slate-200 bg-white p-3';active.insertBefore(footer,active.querySelector('nav'))}
 footer.innerHTML=cb(t('reload'),'print-recover',undefined,true)
 active.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,textarea,select,button').forEach(c=>c.disabled=saving||c.dataset.centralAction!=='print-recover')
}
function rereadForRecovery(){return async()=>{
 saving=true;message={};renderRecovery()
 try{await retryPcsRecordState();await ensureSpecialCraftRecords(true);recoveries.delete(scope());message={}}
 catch(error){message={error}}
 finally{saving=false;patch()}
}}
function keepPrintInputVisible() {
  const active = root(), field = document.activeElement
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || !active?.contains(field)) return
  const main = active.querySelector<HTMLElement>('[data-central-content]'), footer = active.querySelector<HTMLElement>('[data-central-footer]')
  if (!main || !footer || !main.contains(field)) return
  const rect = field.getBoundingClientRect(), lower = footer.getBoundingClientRect().top - 8, upper = main.getBoundingClientRect().top + 8
  if (rect.bottom > lower) main.scrollTop += rect.bottom - lower
  else if (rect.top < upper) main.scrollTop -= upper - rect.top
}
function refreshFooter() {
  const active = root(); if (!active) return
  if(recoveries.has(scope())){renderRecovery();return}
  if(ui().output.panel==='dispatch'){const d=dispatchDraft(),button=active.querySelector<HTMLElement>('[data-central-action=print-dispatch-scan]');if(button){button.dataset.centralPrintDispatchDocument=d.documentId;button.dataset.centralPrintDispatchRevision=d.revision}}
  const p = primary(), old = active.querySelector('[data-central-footer]'); if (!p) { old?.remove(); return }
  const bind = (button: HTMLButtonElement) => {
button.textContent = p.label; button.dataset.centralAction = p.action; button.disabled = !!p.disabled
    // Bind the visible intent before any asynchronous reread can advance the order.
    button.dataset.centralPrintChoice = route().tab === 'execute' ? ui().choice : ''
    button.dataset.centralPrintRevision = route().tab === 'execute' ? workDraft()?.revision || '' : ''
    button.dataset.centralPrintReceipt = route().tab === 'receive' ? receiptKey() : ''
    button.dataset.centralPrintCompletionRevision=p.action==='print-complete-open'?centralPrintCompletion(route().id,session.currentFactory)?.revision||'':''
    button.dataset.centralPrintOutputRoll=ui().output.rollId||''
    button.dataset.centralPrintOutputRevision=rollEditor()?.revision||''
    button.dataset.centralPrintDispatchDocument=ui().output.panel==='dispatch'?dispatchDraft().documentId:''
    button.dataset.centralPrintDispatchRevision=ui().output.panel==='dispatch'?dispatchDraft().revision:''
  }
  const button = old?.querySelector<HTMLButtonElement>('button'); if (button) { bind(button); keepPrintInputVisible(); return }
  const temp = document.createElement('template'); temp.innerHTML = renderCentralPdaFrame({ ...frame(), primary: p }); const footer = temp.content.querySelector('[data-central-footer]'); if (footer) { bind(footer.querySelector<HTMLButtonElement>('button')!); active.insertBefore(footer, active.querySelector('nav')); keepPrintInputVisible() }
}
function patch() { const active = root(); if (!active) return;if(recoveries.has(scope())){renderRecovery();return}try{ const main = active.querySelector<HTMLElement>('[data-central-content]')!, top = main.scrollTop, focused = document.activeElement as HTMLInputElement | undefined, field = focused?.dataset.centralPrintField,dispatchField=focused?.dataset.centralPrintDispatchField, start = focused?.selectionStart; const template = document.createElement('template'); template.innerHTML = renderCentralPdaFrame(frame()); const next = template.content.firstElementChild!; active.lang = next.getAttribute('lang')!; active.querySelector('header')!.innerHTML = next.querySelector('header')!.innerHTML; active.querySelector('[data-central-heading]')!.innerHTML = next.querySelector('[data-central-heading]')!.innerHTML; main.innerHTML = next.querySelector('[data-central-content]')!.innerHTML; active.querySelector('[data-central-footer]')?.remove(); active.querySelector('nav')?.remove(); for (const selector of ['[data-central-footer]', 'nav']) { const node = next.querySelector(selector); if (node) active.append(node) } main.scrollTop = top; if (field) { const input = active.querySelector<HTMLInputElement>(`[data-central-print-field="${field}"]`); input?.focus({ preventScroll: true }); if (input && start !== null) try { input.setSelectionRange(start || 0, start || 0) } catch { } } if(dispatchField){const input=active.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]');input?.focus({preventScroll:true});if(input&&start!==null)try{input.setSelectionRange(start||0,start||0)}catch{}}mountCentralPrintPage() }catch(error){if(!(error instanceof Error)||!/无法读取|未能读取|PCS 数据/.test(error.message))throw error;message={error};recoveries.set(scope(),rereadForRecovery());renderRecovery()}}
function patchWarehouse() {
  const container = root()?.querySelector<HTMLElement>('[data-central-print-warehouse]')
  if (!container) { patch(); return }
  const template = document.createElement('template')
  template.innerHTML = renderPrintWarehouse(session.currentFactory, wh, lang())
  container.replaceWith(template.content.firstElementChild!)
  mountCentralPrintPage()
}
function navigate(next: string) { closeCentralPrintOverlay(); message = {}; scan = ''; scanOpen = false; path = next; if (appStore.getState().pathname === next) patch(); else appStore.navigate(next) }
function openOrder(id: string) { navigate(tabPath(route().tab) + '/' + encodeURIComponent(id)) }
function overlay(content: string,cancel=false) { const returnTo = document.activeElement instanceof HTMLElement && root()?.contains(document.activeElement) ? document.activeElement : undefined; closeCentralPrintOverlay(); overlayReturn = returnTo; const node = document.createElement('div'); node.dataset.centralOverlay = ''; node.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'; node.innerHTML = `<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white p-3">${content}<div class="mt-3">${cb(cancel?(lang()==='id'?'Batal':'取消'):t('close'), 'print-close')}</div></section>`; root()?.append(node); node.querySelector<HTMLButtonElement>(cancel?'[data-central-action=print-complete-confirm]':'button:not(:disabled)')?.focus() }
export function closeCentralPrintOverlay() { logoutScope = undefined;dispatchChange=undefined;completionRequest=undefined;inputLabel=undefined; const node = root()?.querySelector('[data-central-overlay]'); if (!node) return false; node.remove(); const returnTo = overlayReturn; overlayReturn = undefined; if (returnTo?.isConnected) returnTo.focus({ preventScroll: true }); return true }
function openInputLabel(key: string) {
  const label = centralPrintInputLabel(session.currentFactory, key, lang())
  const title = lang() === 'id' ? 'Label rol asal' : '原卷标签'
  const printButton = cb(lang() === 'id' ? 'Cetak label' : '打印标签', 'print-input-label-print').replace('type="button"', 'type="button" disabled')
  overlay(`<h2 class="mb-2 break-all font-bold">${ce(label.barcode)}</h2><iframe title="${title}" data-central-print-input-label class="h-[230px] w-full border" srcdoc="${ce(label.html)}"></iframe><div class="mt-3">${printButton}</div>`)
  inputLabel = { key, signature: label.signature, ready: false }
  const frame = root()?.querySelector<HTMLIFrameElement>('[data-central-print-input-label]')
  const button = root()?.querySelector<HTMLButtonElement>('[data-central-action=print-input-label-print]')
  if (button) button.disabled = true
  const ready = () => {
    const images = [...(frame?.contentDocument?.images || [])]
    if (!inputLabel || inputLabel.signature !== label.signature || !frame?.isConnected) return
    inputLabel.ready = images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0) && !!frame.contentDocument?.querySelector('svg')
    if (button) button.disabled = !inputLabel.ready
  }
  frame?.addEventListener('load', () => { for (const image of frame.contentDocument?.images || []) { image.addEventListener('load', ready, { once: true }); image.addEventListener('error', ready, { once: true }) } ready() }, { once: true })
  ready()
}
function logout() { discardCentralDrafts(); session.signedOut = true; session.account = undefined; saveCentralSessionPreference(); closeCentralPrintOverlay(); patch() }
async function commit(run: () => Promise<unknown>, done: () => void) { if (saving) return; const key = scope(); saving = true; message = {}; root()?.setAttribute('aria-busy', 'true'); root()?.querySelectorAll<HTMLInputElement>('input,select,textarea,button').forEach(c => c.disabled = true); refreshFeedback(); try { await run(); recoveries.delete(key); done(); if (key === scope()) message = { saved: true } } catch (error) { if (error instanceof Error && /已保存.*(?:未能更新|未更新)/.test(error.message)) recoveries.set(key, () => commit(run, done)); if (key === scope()) message = { error } } finally { saving = false; if (root()) patch() } }
function selectIncomingRoll(key: string, barcode: string) {
  const row = printIncomingRollMatches([...centralPrintIncoming(session.currentFactory), ...centralPrintStockIncoming(session.currentFactory)], barcode).available.find(row => row.key === key)
  if (!row) throw new Error('PRINT_sourceChanged')
  row.orderId ? openOrder(row.orderId) : navigate(tabPath('receive') + '?source=' + encodeURIComponent(row.key))
  ui().source = row.key; ui().rolls.set(row.key, barcode)
  patch()
}
function selectIncomingSource(key: string) {
  const row = [...centralPrintIncoming(session.currentFactory), ...centralPrintStockIncoming(session.currentFactory)].find(row => row.key === key && printIncomingAvailable(row) > 0)
  if (!row) throw new Error('PRINT_sourceChanged')
  row.orderId ? openOrder(row.orderId) : navigate(tabPath('receive') + '?source=' + encodeURIComponent(row.key)); ui().source = row.key; patch()
}
function identify() {
  const value = scan.trim(); if (!value) throw new Error('PRINT_noScan')
  const rows = [...centralPrintIncoming(session.currentFactory), ...centralPrintStockIncoming(session.currentFactory)], rolls = printIncomingRollMatches(rows, value)
  if (rolls.available.length === 1) { selectIncomingRoll(rolls.available[0].key, value); return }
  if (rolls.available.length > 1) {
    overlay(rolls.available.map(row => cb([(row.orderId ? centralPrintFact(row.orderId, session.currentFactory)!.order.printOrderNo : preparationWords[lang()].title),
      row.source.documentNo, row.line.material.batchNo].join(' · '), 'print-incoming', JSON.stringify([row.key, value]))).join(''))
    return
  }
  if (rolls.received) throw new Error('DYE_duplicateRoll')
  const sourceRows = printIncomingSourceRows(rows, value)
  if (route().tab === 'receive' && sourceRows.length) {
    const available = sourceRows.filter(row => printIncomingAvailable(row) > 0)
    if (!available.length) throw new Error('PRINT_noIncoming')
    if (available.length === 1) { selectIncomingSource(available[0].key); return }
    overlay(available.map(row => cb([(row.orderId ? centralPrintFact(row.orderId, session.currentFactory)!.order.printOrderNo : preparationWords[lang()].title),
      row.source.documentNo, row.line.material.sku, row.line.material.batchNo].join(' · '), 'print-source', row.key)).join(''))
    return
  }
  const facts = listCentralPrintFacts(session.currentFactory).filter(f => [f.order.workOrderId, f.order.printOrderNo, f.order.taskNo, f.order.plannedInput.sku, f.order.output.sku].includes(value)), sourceIds = sourceRows.map(row => row.orderId), ids = [...new Set([...facts.map(f => f.order.workOrderId), ...sourceIds])]
  if (ids.length === 1) { openOrder(ids[0]); return }
  if (ids.length > 1) { overlay(ids.map(id => cb(centralPrintFact(id, session.currentFactory)!.order.printOrderNo, 'print-order', id)).join('')); return }
  throw new Error('PRINT_wrongScan')
}
export async function renderCentralPrintPage(currentPath: string, current: () => boolean = () => true) {
  await refreshPcsRecordStateAfterExternalChange(); await ensureSpecialCraftRecords();
  if (!current()) return ''
  path = currentPath
  const requested = new URL(currentPath, location.origin).searchParams.get('factoryId')
  const factoryId = centralPrintEntryFactory([requested, session.currentFactory, session.preference.factoryId, ...centralPrintFactories().map(factory => factory.id)])
  ensureCentralSessionAccount(factoryId); session.currentOperation = 'PRINT'; saveCentralSessionPreference()
  return renderCentralPdaFrame(frame())
}
function keydown(event: KeyboardEvent) { const active = root(); if (!active || saving || recoveries.has(scope()) || event.isComposing || event.keyCode === 229) return; if (event.key === 'Escape') { event.preventDefault(); if (!closeCentralPrintOverlay() && route().id) navigate(tabPath(route().tab)); return } const modal = active.querySelector<HTMLElement>('[data-central-overlay]'); if (modal) {
    if (event.key === 'F1') { event.preventDefault(); return }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a[href],[tabindex]')].filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1), focused = document.activeElement
      if (first && (event.shiftKey ? focused === first || !modal.contains(focused) : focused === last || !modal.contains(focused))) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
    }
    return
  } if (event.key === 'F1') { event.preventDefault();const dispatch=root()?.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]');if(dispatch){dispatch.focus();dispatch.select();return} let input = active.querySelector<HTMLInputElement>('[data-central-print-field="scan"]'); if (!input) { scanOpen = true; patch(); input = root()?.querySelector<HTMLInputElement>('[data-central-print-field="scan"]') || null } input?.focus(); input?.select(); return } const target = event.target as HTMLInputElement; if (event.key !== 'Enter' || !(target instanceof HTMLInputElement)) return; event.preventDefault(); if (target.dataset.centralPrintLogin === 'account') { active.querySelector<HTMLInputElement>('[data-central-print-login="password"]')?.focus(); return } const p = primary(), field = target.dataset.centralPrintField; let action = target.dataset.centralPrintLogin === 'password' ? 'print-login' : field === 'scan' ? 'print-identify' : target.dataset.centralPrintDispatchField==='scan'?'print-dispatch-scan':undefined; if (!action) { const fields = [...active.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[data-central-print-field],select[data-central-print-field],input[data-central-print-roll-field],select[data-central-print-roll-field]')].filter(i => i.dataset.centralPrintField !== 'scan'), index = fields.indexOf(target); if (index >= 0 && index < fields.length - 1) { fields[index + 1].focus(); return } if (!p?.disabled) active.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus(); return } if(action==='print-dispatch-scan'){active.querySelector<HTMLButtonElement>('[data-central-action=print-dispatch-scan]')?.click();return}const node = document.createElement('button'); node.dataset.centralAction = action; void handleCentralPrintEvent(node, new MouseEvent('click')) }
function mountPrintLabel(){
 const frame=root()?.querySelector<HTMLIFrameElement>('[data-central-print-label]');if(!frame)return
 const out=ui().output,id=route().id,key=scope(),ids=[...out.labelIds]
 out.labelReady=false
 frame.onload=async()=>{
  const doc=frame.contentDocument;if(!doc||key!==scope()||ui().output.panel!=='label')return
  try{const qr=await import('../../components/real-qr.ts');if(!frame.isConnected||doc!==frame.contentDocument)return;qr.hydrateRealQRCodes(doc)
   doc.documentElement.style.setProperty('--label-scale',String(Math.min(1,frame.clientWidth/(100*96/25.4))))
   const check=()=>{if(!frame.isConnected||key!==scope()||doc!==frame.contentDocument)return;out.labelReady=[...doc.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)&&doc.querySelectorAll('[data-real-qr] svg').length===ids.length&&doc.querySelectorAll('.machine>svg').length===ids.length;refreshFooter()}
   new MutationObserver(check).observe(doc.body,{childList:true,subtree:true});doc.querySelectorAll('img').forEach(img=>{img.onload=check;img.onerror=()=>{out.labelReady=false;message={error:new Error('PRINT_labelNotReady')};refreshFeedback();refreshFooter()}});check()
  }catch(error){message={error};out.labelReady=false;refreshFeedback();refreshFooter()}
 }
 frame.srcdoc=renderCentralPrintLabel(id,ids,session.currentFactory,lang())
}
export function mountCentralPrintPage() { const active = root(); if (!active) return; active.setAttribute('aria-busy', String(saving)); hydrateIcons(active);mountPrintLabel(); active.querySelectorAll<HTMLImageElement>('[data-central-print-photo]').forEach(img => { img.onload = () => { img.hidden = false; img.parentElement?.querySelector('[data-print-photo-error]')?.remove(); refreshFooter() }; img.onerror = () => { img.hidden = true; if (!img.parentElement?.querySelector('[data-print-photo-error]')) img.insertAdjacentHTML('afterend', `<span data-print-photo-error class="block text-xs text-red-700">${t('photoFailed')}</span>`); refreshFooter() } }); if (!mounted) { document.addEventListener('keydown', keydown); mounted = true } if (recoveries.has(scope())) active.querySelectorAll<HTMLInputElement>('input,textarea,select,button').forEach(c => { if (!['print-recover'].includes(c.dataset.centralAction || '')) c.disabled = true }); refreshFooter() }
export async function handleCentralPrintEvent(target: Element, event?: Event): Promise<boolean> {
if (saving) return true;if(recoveries.has(scope())&&!target.closest('[data-central-action="print-recover"]'))return true;const dispatchField=target.closest<HTMLInputElement>('[data-central-print-dispatch-field=scan]');if(dispatchField){if(event?.type!=='click'){const d=dispatchDraft();d.scan=dispatchField.value;d.operationId=crypto.randomUUID();message={};refreshFeedback();refreshFooter()}return true}const rollField=target.closest<HTMLInputElement|HTMLSelectElement>('[data-central-print-roll-field]');if(rollField){if(event?.type!=='click')rollFieldChanged(rollField);return true} const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-central-print-field]'), loginField = target.closest<HTMLInputElement>('[data-central-print-login]'); if (loginField) { login[loginField.dataset.centralPrintLogin as keyof typeof login] = loginField.value; message = {}; refreshFeedback(); return true } if (field) { if (event?.type === 'click' || recoveries.has(scope())) return true; message = {}; refreshFeedback(); const key = field.dataset.centralPrintField!; if (key !== 'scan') lastFields.set(scope(), key); if (key === 'allocationOrder' || key === 'allocationQuantity') { const d = allocationDraft(); if (d) { if (key === 'allocationOrder') d.orderId = field.value; else d.raw = field.value } } else if (key === 'scan') scan = field.value; else if (key === 'source') { ui().source = field.value; patch() } else if (key === 'roll') { const row = selectedIncoming(); if (row) ui().rolls.set(row.key, field.value); patch() } else if (['receiveQuantity', 'position', 'weight', 'gross', 'PAPER', 'CONICAL', 'PAGODA'].includes(key)) { const d = receiptDraft(); if (d) (d as unknown as Record<string, string>)[key === 'receiveQuantity' ? 'raw' : key] = field.value } else { const d = workDraft(); if (d) (d as unknown as Record<string, string>)[key === 'workQuantity' ? 'raw' : key] = field.value } refreshFooter(); return true } const nav = target.closest<HTMLElement>('[data-central-nav]'); if (nav) { navigate(nav.dataset.centralNav!); return true } const node = target.closest<HTMLElement>('[data-central-action]'); if (!node) return false; if (event && event.type !== 'click') return true; const action = node.dataset.centralAction, value = node.dataset.centralValue || '', key = scope(), eventPath = path, shown = {completionRevision:node.dataset.centralPrintCompletionRevision,dispatchDocument:node.dataset.centralPrintDispatchDocument,dispatchRevision:node.dataset.centralPrintDispatchRevision,choice: node.dataset.centralPrintChoice, revision: node.dataset.centralPrintRevision, receipt: node.dataset.centralPrintReceipt,outputRoll:node.dataset.centralPrintOutputRoll,outputRevision:node.dataset.centralPrintOutputRevision }; if (recoveries.has(key) && !['print-recover'].includes(action || '')) return true; try {
if (session.account) { await ensureSpecialCraftRecords(); if (key !== scope() || eventPath !== path || !root()) return true } const r = route(), actor = session.account; if (action === 'print-save-receipt' && r.tab !== 'receive' || action === 'print-save-work' && r.tab !== 'execute') throw new Error('CHANGED')
    if (action === 'print-save-work' && (!root()?.contains(node) || !r.fact || !shown.choice || ui().choice !== shown.choice || !centralPrintChoices(r.fact).some(c => c.key === shown.choice) || shown.revision !== centralPrintRevision(r.id))) throw new Error('CHANGED')
    if (action === 'print-save-receipt' && (!root()?.contains(node) || shown.receipt !== receiptKey())) throw new Error('CHANGED')
    if(['print-roll-add','print-roll-add-batch','print-save-roll','print-label-done'].includes(action||'')&&(!root()?.contains(node)||r.tab!=='execute'||ui().view!=='output'))throw new Error('CHANGED')
    if(action==='print-save-roll'&&(!root()?.contains(node)||ui().output.panel!=='edit'||shown.outputRoll!==ui().output.rollId||shown.outputRevision!==rollEditor()?.revision))throw new Error('CHANGED')
    if(['print-dispatch-scan','print-dispatch-confirm'].includes(action||'')&&(!root()?.contains(node)||r.tab!=='execute'||ui().view!=='output'||ui().output.panel!=='dispatch'||shown.dispatchDocument!==dispatchDraft().documentId||shown.dispatchRevision!==dispatchDraft().revision))throw new Error('PD_changed')
    if (action === 'language') { const old = lang(); session.language = old === 'id' ? 'zh' : 'id'; for (const d of allocationDrafts.values()) d.raw = translateDyeNumber(d.raw, old, lang()); for (const d of workDrafts.values()) for (const k of ['raw', 'count', 'loss'] as const) d[k] = translateDyeNumber(d[k], old, lang()); for (const d of receiptDrafts.values()) for (const k of ['raw', 'weight', 'gross', 'PAPER', 'CONICAL', 'PAGODA'] as const) d[k] = translateDyeNumber(d[k], old, lang()); for(const editor of rollEditors.values()){const initial=JSON.parse(editor.initial) as PrintRollFields;for(const key of ['quantity','weight','gsm','width'] as const){editor.fields[key]=translateDyeNumber(editor.fields[key],old,lang());initial[key]=translateDyeNumber(initial[key],old,lang())}for(const key of ['NATIVE','METERS'] as const)editor.quantities[key]=translateDyeNumber(editor.quantities[key],old,lang());editor.initial=JSON.stringify(initial)}if(ui().output.panel==='label'){ui().output.labelReady=false;ui().output.printRequested=false}message = {}; closeCentralPrintOverlay(); saveCentralSessionPreference(); patch(); const previous = lastFields.get(scope()); if (previous) { root()?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-central-print-field="${previous}"]`)?.focus({ preventScroll: true }); keepPrintInputVisible() } }
    else if (action === 'logout') { if (hasCentralDrafts()) { overlay(`<p>${t('unsent')}</p>${cb(t('discard'), 'print-logout-confirm', undefined, true)}${cb(t('cancel'), 'print-close')}`); logoutScope = scope() } else logout() }
    else if (action === 'print-logout-confirm') { if (logoutScope !== scope()) throw new Error('CHANGED'); logout() }
    else if (action === 'print-login') { const user = readFactoryPdaExecutionUsers().find(u => normalizePdaLoginId(u.loginId) === normalizePdaLoginId(login.account)); if (!user || !verifyPdaPassword(login.password, user.passwordHash)) throw new Error('PRINT_loginFail'); if (user.status !== 'ACTIVE') throw new Error('PRINT_locked'); const factory = getFactoryMasterRecordById(user.factoryId); if (!factory || factory.status !== 'active' || !isCentralPdaFactory(factory)) throw new Error('PRINT_centralOnly'); discardCentralDrafts(); session.account = user; session.currentFactory = user.factoryId; session.signedOut = false; saveCentralSessionPreference(); navigate(tabPath('receive')) }
    else if (action === 'operation') overlay(renderCentralOperationMenu({ language: lang(), tab: route().tab, factoryId: session.currentFactory, currentPath: appStore.getState().pathname }) + `<div class="mt-3">${cb(lang() === 'id' ? 'Proses tambahan / khusus' : '辅助 / 特种工艺', 'print-go', 'special')}</div>`)
    else if (action === 'print-go') navigate('/fcs/pda/central/' + (value === 'special' ? '' : value + '/') + r.tab)
    else if (action === 'print-close') closeCentralPrintOverlay()
    else if (action === 'print-order') openOrder(value)
    else if (action === 'print-open-scan') { scanOpen = !scanOpen; patch(); root()?.querySelector<HTMLInputElement>('[data-central-print-field="scan"]')?.focus() }
    else if (action === 'print-identify') identify()
    else if (action === 'print-incoming') { const [key, barcode] = JSON.parse(value); selectIncomingRoll(key, barcode) }
    else if (action === 'print-source' || action === 'print-stock-source') selectIncomingSource(value)
    else if (action === 'print-preparation') { wh.view = 'preparation'; allocationLine = ''; message = {}; patch() }
    else if (action === 'print-preparation-exit') { wh.view = 'locations'; message = {}; patch() }
    else if (action === 'print-preparation-open') { if (!centralPrintPreparation(session.currentFactory).some(row => row.line.id === value)) throw Error('PRINT_sourceChanged'); wh.view = 'preparation'; allocationLine = value; message = {}; patch() }
    else if (action === 'print-preparation-back') { allocationLine = ''; message = {}; patch() }
    else if (action === 'print-preparation-clear') { allocationDrafts.delete(allocationKey()); message = {}; patch() }
    else if (action === 'print-allocation-save' && actor) { if (r.tab !== 'warehouse' || wh.view !== 'preparation' || !root()?.contains(node)) throw Error('CHANGED'); const request = allocationRequest(), draftKey = allocationKey(); await commit(() => saveCentralPrintAllocation(request, actor), () => allocationDrafts.delete(draftKey)) }
    else if (action === 'print-wh-output') { if (!centralPrintFact(value, session.currentFactory)) throw new Error('CHANGED'); navigate(tabPath('execute') + '/' + encodeURIComponent(value)); ui().view = 'output'; ui().output.panel = 'list'; patch() }
    else if (action === 'print-wh-pending-more') { wh.pendingLimit = (wh.pendingLimit || 15) + 15; patchWarehouse() }
    else if (action === 'print-input-label') openInputLabel(value)
    else if (action === 'print-input-label-print') {
      const frame = root()?.querySelector<HTMLIFrameElement>('[data-central-print-input-label]')
      if (!inputLabel?.ready || !frame?.contentWindow) throw new Error('PRINT_labelNotReady')
      const shownLabel = inputLabel, button = node as HTMLButtonElement
      button.disabled = true
      try {
        // Read the original owners before printing current stock, even when a
        // cross-tab notification was unavailable. This does not save records.
        await retryPcsRecordState(); await ensureSpecialCraftRecords(true);
        if (key !== scope() || eventPath !== path || inputLabel !== shownLabel || !frame.isConnected) return true
        if (centralPrintInputLabel(session.currentFactory, shownLabel.key, lang()).signature !== shownLabel.signature) throw new Error('PRINT_sourceChanged')
        frame.contentWindow?.print()
      } finally { if (inputLabel === shownLabel) button.disabled = !shownLabel.ready }
    }
    else if (action === 'print-view') { ui().view = value as Ui['view']; message = {}; patch() }
    else if (action === 'print-choice') { ui().choice = value; message = {}; patch() }
    else if (action === 'print-next') navigate(tabPath(r.tab))
    else if (action === 'print-more') { if (r.tab === 'warehouse') { wh.limit += 15; wh.view === 'preparation' ? patch() : patchWarehouse() } else { limit += 15; patch() } }
    else if (action === 'print-clear') { if (r.tab === 'receive') receiptDrafts.delete(receiptKey()); else workDrafts.delete(workKey()); message = {}; patch() }
    else if (action === 'print-photo') { const image = node.querySelector<HTMLImageElement>('img'); if (image?.complete && !image.naturalWidth) { image.src = value; return true } overlay(`<img src="${ce(value)}" alt="${ce(image?.alt || t('photo'))}" class="max-h-[70dvh] w-full object-contain">`) }
    else if (action === 'print-recover') await recoveries.get(scope())?.()
    else if (action === 'print-reload') { await retryPcsRecordState();await ensureSpecialCraftRecords(true);  const d = workDraft(); if (d) d.revision = centralPrintRevision(r.id);const editor=rollEditor();if(editor)editor.revision=centralPrintLabelRevision(r.id,editor.rollId,session.currentFactory)||''; if(ui().output.panel==='dispatch')dispatchDraft().revision=centralPrintDispatchRevision(r.id,session.currentFactory,dispatchDraft().documentId);message = {}; patch() }
    else if (action === 'print-save-receipt' && actor && (r.fact || r.stockSource)) { const input = receiptInput(), draftKey = receiptKey(), row = selectedIncoming()!, position = receiptDraft()!.position, capturedUi = ui(); await commit(() => r.stockSource ? saveCentralPrintStockReceipt(input, actor) : saveCentralPrintReceipt(r.id, input, actor), () => { receiptDrafts.delete(draftKey); const remaining = (r.stockSource ? centralPrintStockIncoming(actor.factoryId) : centralPrintIncoming(actor.factoryId, r.id)).find(v => v.key === row.key); if (remaining && printIncomingAvailable(remaining) > 0) {
      const barcode = remaining.line.material.kind === 'FABRIC' ? remaining.remainingRolls[0]?.barcode || '' : ''
      if (barcode) capturedUi.rolls.set(row.key, barcode)
      const nextKey = key + '|' + row.key + '|' + barcode
      if (!receiptDrafts.has(nextKey)) receiptDrafts.set(nextKey, { raw: '', weight: '', gross: '', PAPER: '', CONICAL: '', PAGODA: '', position, operationId: crypto.randomUUID() })
      else if (!receiptDrafts.get(nextKey)!.position) receiptDrafts.get(nextKey)!.position = position
    } }) }
    else if (action === 'print-save-work' && actor && r.fact) { const input = productionInput(), draft = workDraft()!, draftKey = workKey(), id = r.id, revision = draft.revision, op = draft.operationId; await commit(() => saveCentralPrintProduction(id, input, actor, op, revision), () => workDrafts.delete(draftKey)) }
    else if(action==='print-complete-open'&&actor&&r.fact){const state=centralPrintCompletion(r.id,session.currentFactory);if(!root()?.contains(node)||r.tab!=='execute'||!state?.ready||shown.completionRevision!==state.revision)throw new Error('CHANGED');const request={scope:key,orderId:r.id,revision:state.revision,operationId:crypto.randomUUID()};overlay(renderPrintCompletionConfirmation(r.fact,state,lang()),true);completionRequest=request}
    else if(action==='print-complete-confirm'&&actor){const request=completionRequest;if(!request||request.scope!==key||request.orderId!==r.id||r.tab!=='execute')throw new Error('CHANGED');const completedUi=ui();closeCentralPrintOverlay();await commit(()=>saveCentralPrintCompletion(request.orderId,actor,request.operationId,request.revision),()=>{for(const map of [workDrafts,receiptDrafts,rollEditors,dispatchDrafts])for(const id of map.keys())if(id.startsWith(key+'|'))map.delete(id);completedUi.view='receipt';completedUi.output.panel='list'})}
    else if(action==='print-dispatch-open'){ui().output.panel='dispatch';ui().view='output';dispatchDraft();message={};patch();root()?.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]')?.focus()}
    else if(action==='print-dispatch-new'){ui().dispatchId='';dispatchDraft();message={};patch();root()?.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]')?.focus()}
    else if(action==='print-dispatch-document'){if(!centralPrintDispatch(r.id,session.currentFactory)?.docs.some(d=>d.id===value))throw new Error('PD_changed');ui().dispatchId=value;ui().dispatchLimit=15;dispatchDraft();message={};patch()}
    else if(action==='print-dispatch-more'){ui().dispatchLimit=(ui().dispatchLimit||15)+15;patch()}
    else if(action==='print-dispatch-clear'){const d=dispatchDraft();d.scan='';d.operationId=crypto.randomUUID();message={};patch();root()?.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]')?.focus()}
    else if(action==='print-dispatch-scan'&&actor){const d=dispatchDraft(),state=ui(),id=r.id,doc=d.documentId,raw=d.scan,op=d.operationId,revision=d.revision,draftKey=dispatchKey();let savedId='';await commit(async()=>{savedId=await scanCentralPrintDispatch(id,doc,raw,actor,op,revision)},()=>{dispatchDrafts.delete(draftKey);state.dispatchId=savedId;dispatchDrafts.set(key+'|'+savedId,{documentId:savedId,scan:'',revision:centralPrintDispatchRevision(id,actor.factoryId,savedId),operationId:crypto.randomUUID()})});if(message.saved&&key===scope())root()?.querySelector<HTMLInputElement>('[data-central-print-dispatch-field=scan]')?.focus()}
    else if(action==='print-dispatch-confirm'&&actor){const d=dispatchDraft();if(d.scan.trim())throw new Error('PD_scanFirst');const id=r.id,doc=d.documentId,revision=d.revision,op=d.operationId,draftKey=dispatchKey();await commit(()=>saveCentralPrintDispatch(id,doc,{kind:'CONFIRM'},actor,op,revision),()=>dispatchDrafts.delete(draftKey))}
    else if((action==='print-dispatch-remove'||action==='print-dispatch-void')&&actor){const d=dispatchDraft(),current=centralPrintDispatchDocument(d.documentId);if(!current||current.doc.status!=='草稿')throw new Error('PD_changed');let change:PrintDispatchAction={kind:'VOID'},quantity=current.total,object=current.doc.id;if(action==='print-dispatch-remove'){const [workOrderId,rollId]=JSON.parse(value),row=current.rows.find(r=>r.workOrderId===workOrderId&&r.roll?.id===rollId);if(!row?.roll)throw new Error('PD_changed');change={kind:'REMOVE',workOrderId,rollId};quantity=row.roll.lengthY;object=row.roll.barcode}const request={scope:key,documentId:d.documentId,revision:d.revision,action:change,operationId:crypto.randomUUID()};overlay(`<strong class="block break-all">${ce(object)}</strong><p class="my-3 font-bold">${n(quantity,lang())} ${printUnit(current.unit,lang())}</p><p class="my-3">${pdt(lang(),change.kind==='VOID'?'voidNote':'removeNote')}</p>${cb(pdt(lang(),change.kind==='VOID'?'void':'remove'),'print-dispatch-change-confirm',undefined,true)}`);dispatchChange=request}
    else if(action==='print-dispatch-change-confirm'&&actor){const request=dispatchChange;if(!request||request.scope!==key||request.documentId!==dispatchDraft().documentId)throw new Error('PD_changed');const id=r.id,draftKey=dispatchKey();closeCentralPrintOverlay();await commit(()=>saveCentralPrintDispatch(id,request.documentId,request.action,actor,request.operationId,request.revision),()=>dispatchDrafts.delete(draftKey))}
    else if(action==='print-output-back'){ui().output.panel='list';message={};patch()}
    else if(action==='print-roll-edit')openRoll(value)
    else if(action==='print-roll-label')openLabels([value])
    else if(action==='print-roll-spec'){const editor=rollEditor();if(editor){editor.specOpen=!editor.specOpen;patch()}}
    else if(action==='print-roll-clear'){const editor=rollEditor(),roll=centralPrintOutput(r.id,session.currentFactory)?.rolls.find(row=>row.id===editor?.rollId);if(editor&&roll){editor.fields=initialPrintRollFields(roll,lang());editor.fields.quantity='';editor.fields.weight='';editor.quantities={NATIVE:'',METERS:''};editor.initial=JSON.stringify(editor.fields);editor.operationId=crypto.randomUUID();message={};patch()}}
    else if((action==='print-roll-add'||action==='print-roll-add-batch')&&actor){const batches=r.fact?.order.productionBatches||[];if(action==='print-roll-add'&&batches.length>1){overlay(`<p class="my-3 font-semibold">${lang()==='id'?'Pilih lot hasil':'选择产出批次'}</p>`+batches.map((b,i)=>cb(`${lang()==='id'?'Lot hasil':'产出批次'} ${i+1} · ${n(b.qty,lang())} ${printUnit(r.fact!.order.output.qtyUnit,lang())}`,'print-roll-add-batch',b.id)).join(''));return true}let id='';const op=crypto.randomUUID(),batchId=action==='print-roll-add-batch'?value:batches[0]?.id;await commit(async()=>{id=await addCentralPrintRoll(r.id,actor,op,batchId)},()=>{});if(id){closeCentralPrintOverlay();openRoll(id)}}
    else if(action==='print-save-roll'&&actor){const editor=rollEditor()!,input=rollInput(),revision=editor.revision,id=r.id,rollId=editor.rollId,op=editor.operationId,editorKey=rollKey();await commit(()=>saveCentralPrintRoll(id,rollId,input,actor,op,revision),()=>{rollEditors.delete(editorKey);ui().output.panel='list'})}
    else if(action==='print-label-print'){const frame=root()?.querySelector<HTMLIFrameElement>('[data-central-print-label]');if(frame&&ui().output.labelReady&&!r.fact?.closed){frame.contentWindow?.print();ui().output.printRequested=true;refreshFooter()}}
    else if(action==='print-label-done'&&actor){const out=ui().output,ids=[...out.labelIds],revisions={...out.labelRevisions},id=r.id,op=out.operationId;if(out.panel!=='label'||!out.printRequested||!out.labelReady)throw new Error('PRINT_labelNotReady');await commit(()=>markCentralPrintRollsPrinted(id,ids,revisions,actor,op),()=>{out.panel='list';out.printRequested=false;out.labelReady=false})}
    else if (action === 'print-wh-view' && ['locations', 'receive', 'usage', 'output'].includes(value)) { wh.view = value as PrintWarehouseUi['view']; wh.limit = 15; patchWarehouse() }
    else if (action === 'print-wh-kind' && ['WAIT_PROCESS', 'WAIT_HANDOVER'].includes(value)) { wh.kind = value as PrintWarehouseUi['kind']; wh.area = ''; wh.location = ''; wh.limit = 15; patchWarehouse() }
    else if (action === 'print-wh-area') { wh.area = value; wh.location = ''; wh.limit = 15; patchWarehouse() }
    else if (action === 'print-wh-location') { wh.location = value; wh.limit = 15; patchWarehouse();root()?.querySelector('[data-central-print-wh-stock]')?.scrollIntoView({block:'nearest'}) }
    else return false
  } catch (error) {
    if (action === 'print-input-label-print') closeCentralPrintOverlay()
    message = { error }; patch()
    if (action === 'print-input-label-print') root()?.querySelector('[data-central-print-feedback]')?.scrollIntoView({ block: 'nearest' })
  } return true
}
