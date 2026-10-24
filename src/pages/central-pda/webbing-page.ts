// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { TMF_FACTORY_ID } from '../../data/fcs/central-craft-factories.ts'
import { hydratePmsTmfPurchaseStateFromIdb, hydratePmsTmfPurchaseReferencesFromIdb, getTmfPurchaseState } from '../../data/pms/tmf-material-purchases.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { listCentralSpecialOperations } from './special-model.ts'
import { centralOperationLabel } from './operation-label.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { cb, ce, ct, centralNotice, centralFormalName } from './ui.ts'
import { renderCentralOperationMenu } from './operation-menu.ts'
import { translateDyeNumber, dyeNumber } from './dye-ui.ts'
import { centralWebbingOrders, centralWebbingOrder, centralWebbingScan, webbingInputs, webbingTipIssues, centralWebbingActions, saveCentralWebbingReceipt, saveCentralWebbingExecution, webbingTipMaterials, webbingTipEndCount, webbingTipReturnCandidates, type CentralWebbingReceipt, type CentralWebbingAction, type CentralWebbingExecution, type WebbingOrder, type WebbingTipIssue } from './webbing-model.ts'
import { wt, webbingIdentity, webbingFacts, webbingPending, webbingHistory, webbingStatus, webbingError, webbingActionLabel, webbingExecutionRows, webbingBaseLedger } from './webbing-view.ts'
const prefix = '/fcs/pda/central/webbing'
type Draft = { qty: string; operationId: string; committed?: boolean }
type Selection = { kind: 'input' | 'tip'; id: string; unit: string }
type ExecDraft = { pieces: string; length: string; finished: string; defective: string; loss: string; reason: string; packageNo: string; operationId: string; committed?: boolean }
let path = '', generation = 0, saving = false, entryError: unknown, message: unknown, success = '', scan = '', limit = 15, login = { account: '', password: '' }, currentAction: CentralWebbingAction = 'receive'
const drafts = new Map<string, Draft>(), selections = new Map<string, Selection>(), execModes = new Map<string, CentralWebbingAction>(), execSelections = new Map<string, string>(), execDrafts = new Map<string, ExecDraft>(), loadedPhotos = new Set<string>(), failedPhotos = new Set<string>()
const lang = () => session.language, t = (key: Parameters<typeof ct>[1]) => ct(lang(), key), root = () => document.querySelector<HTMLElement>('[data-central-family="webbing"]')
const route = () => { const url = new URL(path || prefix + '/receive', 'https://pda.local'), parts = url.pathname.split('/'); let id = ''; try { id = decodeURIComponent(parts[6] || '') } catch {} return { tab: (['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] : 'receive') as CentralPdaTab, id } }
const order = () => centralWebbingOrder(session.currentFactory, route().id)
const scope = () => [session.currentFactory, session.account?.userId, route().id, route().tab, selectionKey()].join('|')
const selectionKey = () => { const s = selections.get([session.currentFactory, session.account?.userId, route().id, route().tab].join('|')); return s ? `${s.kind}:${s.id}` : '' }
function selectRow(kind: 'input' | 'tip', id: string, unit: string) { selections.set([session.currentFactory, session.account?.userId, route().id, route().tab].join('|'), { kind, id, unit }); message = undefined; success = '' }
function selected() { return selections.get([session.currentFactory, session.account?.userId, route().id, route().tab].join('|')) }
function draft(create = false) { const key = scope(); if (create && !drafts.has(key)) drafts.set(key, { qty: '', operationId: crypto.randomUUID() }); return drafts.get(key) }
const filled = (d: Draft) => !!d.qty.trim()
registerCentralDraftDiscard(() => { drafts.clear(); selections.clear(); execModes.clear(); execSelections.clear(); execDrafts.clear(); scan = ''; message = undefined; success = '' }, () => [...drafts.values()].some(d => !d.committed && filled(d)) || [...execDrafts.values()].some(d => !d.committed && execFilled(d)))
function field(label: string, value: string) { return `<label class="mb-3 block text-base font-semibold">${ce(label)}<input class="mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white p-3 text-xl font-semibold" data-webbing-field="qty" value="${ce(value)}" inputmode="decimal" autocomplete="off"${saving || draft()?.committed ? ' disabled' : ''}></label>` }
const execModeKey = () => [session.currentFactory, session.account?.userId, route().id, route().tab].join('|')
const execSelectionKey = () => [...execModeKey().split('|'), execAction()].join('|')
const execSelection = () => execSelections.get(execSelectionKey())
function execAction(): CentralWebbingAction { return currentAction }
function execDraft(create = false) { const key = execSelectionKey() + '|' + (execSelection() || ''); if (create && !execDrafts.has(key)) execDrafts.set(key, { pieces: '', length: '', finished: '', defective: '', loss: '', reason: '', packageNo: '', operationId: crypto.randomUUID() }); return execDrafts.get(key) }
const execFilled = (d: ExecDraft | undefined) => !!d && [d.pieces, d.reason, d.packageNo].some(value => !!value.trim())
function execField(name: string, label: string, value: string, numeric = true) { return `<label class="mb-3 block text-base font-semibold">${ce(label)}<input class="mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white p-3 text-xl font-semibold" data-webbing-field="${ce(name)}" value="${ce(value)}" inputmode="${numeric ? 'decimal' : 'text'}" autocomplete="off"${saving || execDraft()?.committed ? ' disabled' : ''}></label>` }
function actions() { const o = order(); return o ? centralWebbingActions(o) : [] }
function resolveAction() { if (route().tab !== 'execute') { currentAction = 'receive'; return } const available = actions(), key = execModeKey(); currentAction = (execModes.get(key) as CentralWebbingAction) || currentAction; if (!available.includes(currentAction)) currentAction = available[0] || 'receive'; execModes.set(key, currentAction) }
function stateNotice() { return message ? centralNotice(webbingError(message, lang()), true) : success ? centralNotice(success) : '' }
function receivePanel(o: WebbingOrder, tips: WebbingTipIssue[]) {
  let content = webbingPending(o, tips, lang(), selected()?.id)
  const pick = selected()
  if (pick && draft()?.committed) content += centralNotice(t('committed')) + cb(t('reload'), 'webbing-reload')
  if (pick) content += field(wt(lang(), 'thisQty') + ' · ' + (pick.unit === '米' && lang() === 'id' ? 'm' : pick.unit), draft()?.qty || '')
  if (draft() && filled(draft()!) && !draft()!.committed) content += cb(t('clear'), 'webbing-clear')
  return { content, primary: { label: saving ? t('saving') : wt(lang(), 'confirm'), action: 'webbing-save', disabled: saving || !pick || draft()?.committed || !o.material?.materialImageUrl || !loadedPhotos.has(o.material?.materialImageUrl || '') || failedPhotos.has(o.material?.materialImageUrl || '') || !draft()?.qty.trim(), context: pick && draft()?.qty.trim() ? `${draft()!.qty} ${pick.unit === '米' && lang() === 'id' ? 'm' : pick.unit}` : undefined } }
}
function executionPanel(o: WebbingOrder) {
  const action = execAction(), pick = execSelection(), d = execDraft()
  let content = webbingExecutionRows(o, action, lang(), pick)
  if (pick && d?.committed) content += centralNotice(t('committed')) + cb(t('reload'), 'webbing-reload')
  if (pick && action === 'cut') {
    const input = o.inputs.find(row => row.id === pick), spec = o.demands.find(row => row.id === input?.demandId)?.specification
    if (spec) content += execField('pieces', wt(lang(), 'cutQty') + ' · ' + spec.garmentSize, d?.pieces || '')
      + execField('length', wt(lang(), 'length'), d?.length || String(spec.cutLengthMm))
      + (spec.tippingRequired ? '' : execField('finished', wt(lang(), 'finished'), d?.finished || String(spec.finishedLengthMm)))
      + execField('defective', wt(lang(), 'defective'), d?.defective || '0')
      + execField('loss', wt(lang(), 'loss'), d?.loss || '0')
      + execField('reason', wt(lang(), 'reason'), d?.reason || '', false)
  }
  if (pick && action === 'tip') {
    const output = o.outputs.find(row => row.id === pick), materials = output ? webbingTipMaterials(o, output) : []
    content += execField('pieces', wt(lang(), 'cutQty'), d?.pieces || '')
      + execField('finished', wt(lang(), 'finished'), d?.finished || String(output?.specification.finishedLengthMm ?? ''))
      + execField('defective', wt(lang(), 'defective'), d?.defective || '0')
      + execField('reason', wt(lang(), 'reason'), d?.reason || '', false)
      + materials.map(issue => issue.unit === 'kg'
        ? execField('tip:' + issue.id, `${issue.materialSkuId} · kg (${issue.availableQty})`, (d as unknown as Record<string, string>)?.['tip:' + issue.id] || '')
        : `<p class="mb-3 rounded-xl border bg-white p-3 text-sm">${ce(issue.materialSkuId)} · ${issue.availableQty} ${ce(issue.unit)} · 自动 ${((d?.pieces ? Number(d.pieces) : 0) * (output ? webbingTipEndCount(output, issue.materialBomItemId) : 0))} ${ce(issue.unit)}</p>`).join('')
  }
  if (pick && action === 'tipReturn') {
    const issue = webbingTipReturnCandidates(o).find(row => row.id === pick)
    content += execField('pieces', `${wt(lang(), 'returnQty')} · ${issue?.unit || ''}`, d?.pieces || '') + execField('reason', wt(lang(), 'reason'), d?.reason || '', false)
  }
  if (pick && action === 'pack') content += execField('pieces', wt(lang(), 'pack'), d?.pieces || '') + execField('packageNo', wt(lang(), 'packageNo'), d?.packageNo || '', false)
  if (pick && action === 'dispatch') content += centralNotice(wt(lang(), 'dispatchConfirm'))
  if (pick && action === 'return') content += execField('pieces', wt(lang(), 'returnQty'), d?.pieces || '') + execField('reason', wt(lang(), 'reason'), d?.reason || '', false)
  if (d && execFilled(d) && !d.committed) content += cb(t('clear'), 'webbing-exec-clear')
  const tipOutput = action === 'tip' ? o.outputs.find(row => row.id === pick) : undefined
  const missing = action === 'cut' ? !d?.pieces.trim()
    : action === 'tip' ? !d?.pieces.trim() || !d?.finished.trim() || (tipOutput ? webbingTipMaterials(o, tipOutput).some(issue => issue.unit === 'kg' && !(d as unknown as Record<string, string>)?.['tip:' + issue.id]?.trim()) : true)
    : action === 'pack' ? !d?.pieces.trim() || !d?.packageNo.trim()
    : action === 'return' || action === 'tipReturn' ? !d?.pieces.trim() || !d?.reason.trim()
    : false
  return { content, primary: { label: saving ? t('saving') : webbingActionLabel(action, lang()), action: 'webbing-exec-save', disabled: saving || !pick || d?.committed || missing || !o.material?.materialImageUrl || !loadedPhotos.has(o.material?.materialImageUrl || '') || failedPhotos.has(o.material?.materialImageUrl || ''), context: pick && d?.pieces.trim() ? `${d.pieces} ${action === 'return' ? (lang() === 'id' ? 'm' : '米') : (lang() === 'id' ? 'buah' : '条/根')}` : undefined } }
}
function frame(): CentralPdaFrameInput {
  const r = route(), o = entryError ? undefined : order(), factory = getFactoryMasterRecordById(session.currentFactory)
  const base: CentralPdaFrameInput = { family: 'webbing', language: lang(), tab: r.tab, tabPathPrefix: prefix, accountName: centralFormalName(session.account?.name, session.account?.loginId || '', lang()), accountNo: '', factoryName: centralFormalName(factory?.name, factory?.code || '', lang()), operationName: wt(lang(), 'webbing'), content: '' }
  let content = stateNotice()
  if (entryError) { base.content = content + centralNotice(webbingError(entryError, lang()), true); base.primary = { label: t('reload'), action: 'webbing-reload' }; return base }
  if (!session.account) {
    base.heading = t('login')
    base.content = content + `<label class="mb-3 block">${t('account')}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-webbing-login="account" value="${ce(login.account)}" autocomplete="username"></label><label class="mb-3 block">${t('password')}<input type="password" class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-webbing-login="password" value="${ce(login.password)}" autocomplete="current-password"></label>`
    base.primary = { label: t('login'), action: 'webbing-login' }; return base
  }
  if (r.id) {
    base.backPath = prefix + '/' + r.tab; base.heading = o?.workOrderNo || wt(lang(), 'webbing')
    if (!o) { base.content = content + centralNotice(t('wrongScan'), true); return base }
    content += webbingIdentity(o, lang()) + (!o.material?.materialImageUrl ? centralNotice(t('noPhoto'), true) : '') + webbingFacts(o, lang())
    const tips = webbingTipIssues(o)
    if (r.tab === 'warehouse') content += webbingHistory(o, tips, lang(), limit)
    else if (r.tab === 'execute') {
      resolveAction()
      content += `<div class="mb-3 flex flex-wrap gap-2">${actions().map(action => cb(webbingActionLabel(action, lang()), 'webbing-action', action, action === currentAction)).join('')}</div>`
      const panel = currentAction === 'receive' ? receivePanel(o, tips) : executionPanel(o)
      content += panel.content; base.primary = panel.primary
      content += webbingHistory(o, tips, lang(), limit)
    } else {
      const panel = receivePanel(o, tips); content += panel.content; base.primary = panel.primary
      content += webbingHistory(o, tips, lang(), limit)
    }
    content += `<div class="mt-3">${cb(t('next'), 'webbing-next')}</div>`; base.content = content; return base
  }
  const rows = centralWebbingOrders(session.currentFactory)
  if (r.tab === 'receive') {
    content += `<label class="mb-3 block font-semibold">${t('scan')}<div class="mt-2 flex gap-2"><input class="min-h-14 min-w-0 flex-1 rounded-xl border bg-white p-3 text-lg" data-webbing-field="scan" value="${ce(scan)}" placeholder="${ce(wt(lang(), 'scanHint'))}" autocomplete="off">${cb(t('identify'), 'webbing-identify')}</div></label>`
  }
  const visible = rows.filter(o => r.tab === 'receive' ? centralWebbingActions(o).length > 0 : true)
  content += visible.slice(0, limit).map(o => `<button class="mb-3 flex min-h-20 w-full items-center gap-3 rounded-xl border bg-white p-3 text-left" data-central-action="webbing-order" data-central-value="${ce(o.id)}">${o.material?.materialImageUrl ? `<img class="h-14 w-14 shrink-0 object-contain" src="${ce(o.material.materialImageUrl)}" alt="${ce(o.material.materialSkuId)}" loading="lazy">` : ''}<span class="min-w-0"><strong class="block break-words">${ce(o.material?.materialName || o.demands[0]?.materialSkuId || o.workOrderNo)}</strong><span class="block break-words text-sm">${ce(o.workOrderNo)}</span><span>${ce(webbingStatus(o, lang()))}</span></span></button>`).join('') || centralNotice(t('empty'))
  if (r.tab === 'warehouse') content += webbingBaseLedger(lang(), limit)
  if (visible.length > limit) content += cb(t('more'), 'webbing-more')
  base.content = content; return base
}
function patch() { const host = root(); if (!host) return; const main = host.querySelector<HTMLElement>('[data-central-content]')!, top = main.scrollTop, template = document.createElement('template'); template.innerHTML = renderCentralPdaFrame(frame()); const next = template.content.firstElementChild!; host.lang = next.getAttribute('lang') || ''; host.querySelector('header')!.replaceWith(next.querySelector('header')!); host.querySelector('[data-central-heading]')!.replaceWith(next.querySelector('[data-central-heading]')!); main.replaceChildren(...next.querySelector('[data-central-content]')!.childNodes); host.querySelector('[data-central-footer]')?.remove(); host.querySelector('nav')?.remove(); for (const selector of ['[data-central-footer]', 'nav']) { const el = next.querySelector(selector); if (el) host.append(el) } main.scrollTop = top; mountCentralWebbingPage(); hydrateIcons(host); if (message) host.querySelector('[role="alert"]')?.scrollIntoView({ block: 'start' }) }
function navigate(next: string) { closeCentralWebbingOverlay(); message = undefined; success = ''; scan = ''; path = next; if (appStore.getState().pathname === next) patch(); else appStore.navigate(next) }
function openOverlay(content: string) { closeCentralWebbingOverlay(); const el = document.createElement('div'); el.dataset.webbingOverlay = ''; el.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'; el.innerHTML = `<section role="dialog" aria-modal="true" class="max-h-[90dvh] w-full max-w-[420px] overflow-auto rounded-2xl bg-white p-3">${content}<div class="mt-3">${cb(t('close'), 'webbing-close')}</div></section>`; el.addEventListener('click', e => { if (e.target === el) closeCentralWebbingOverlay() }); (root()?.parentElement ?? document.body).append(el); hydrateIcons(el) }
export function closeCentralWebbingOverlay() { document.querySelector('[data-webbing-overlay]')?.remove() }
function signOut() { discardCentralDrafts(); session.signedOut = true; session.account = undefined; login = { account: '', password: '' }; saveCentralSessionPreference(); message = undefined; success = ''; closeCentralWebbingOverlay(); patch() }
function identify() { const found = centralWebbingScan(scan, session.currentFactory); if (found.length === 1) navigate(prefix + '/' + route().tab + '/' + encodeURIComponent(found[0].id)); else if (found.length > 1) openOverlay(found.map(o => cb(o.workOrderNo, 'webbing-order', o.id)).join('')); else { message = new Error(t('wrongScan')); success = ''; patch(); root()?.querySelector<HTMLInputElement>('[data-webbing-field="scan"]')?.select() } }
async function save() { const o = order(), user = session.account, pick = selected(); if (!o || !user || saving || !pick || draft()?.committed) return; const key = scope(), d = draft(true)!; message = undefined; success = ''
  try {
    if (!o.material?.materialImageUrl || !loadedPhotos.has(o.material.materialImageUrl) || failedPhotos.has(o.material.materialImageUrl)) throw new Error(t('noPhoto'))
    const command: CentralWebbingReceipt = { workOrderId: o.id, operationId: d.operationId, quantity: dyeNumber(d.qty, lang(), 3), ...(pick.kind === 'input' ? { inputId: pick.id } : { tipIssueId: pick.id }) }
    saving = true; patch(); await saveCentralWebbingReceipt(command, user); drafts.delete(key); selections.delete([session.currentFactory, user.userId, o.id, route().tab].join('|')); entryError = undefined
    if (root() && session.account?.userId === user.userId) { success = t('saved'); patch() }
  } catch (error) {
    if (error instanceof Error && /已保存.*未能更新/.test(error.message)) d.committed = true
    if (root() && order()?.id === o.id) message = error
  } finally { saving = false; if (root()) patch() }
}
async function saveExec() {
  const o = order(), user = session.account, action = execAction(), pick = execSelection()
  if (!o || !user || saving || action === 'receive' || !pick) return
  const key = execSelectionKey() + '|' + pick, d = execDraft(true)!; message = undefined; success = ''
  try {
    if (!o.material?.materialImageUrl || !loadedPhotos.has(o.material.materialImageUrl) || failedPhotos.has(o.material.materialImageUrl)) throw new Error(t('noPhoto'))
    const qty = action === 'dispatch' ? 0 : dyeNumber(d.pieces, lang(), action === 'return' ? 3 : 0)
    const cutInput = action === 'cut' ? o.inputs.find(row => row.id === pick) : undefined
    const cutSpec = cutInput ? o.demands.find(row => row.id === cutInput.demandId)?.specification : undefined
    const command: CentralWebbingExecution = { workOrderId: o.id, action, operationId: d.operationId, quantity: qty,
      ...(action === 'cut' ? { inputId: pick, lengthMm: dyeNumber(d.length || String(cutSpec?.cutLengthMm ?? ''), lang(), 0), finishedMm: cutSpec?.tippingRequired ? undefined : dyeNumber(d.finished || String(cutSpec?.finishedLengthMm ?? ''), lang(), 0), defectivePieces: dyeNumber(d.defective || '0', lang(), 0, true), lossMeters: dyeNumber(d.loss || '0', lang(), 3, true), reason: d.reason } : {}),
      ...(action === 'tip' ? { cutOutputId: pick, finishedMm: dyeNumber(d.finished, lang(), 0), defectivePieces: dyeNumber(d.defective || '0', lang(), 0, true), reason: d.reason, tipUsed: Object.fromEntries(Object.entries(d as unknown as Record<string, string>).filter(([key]) => key.startsWith('tip:')).map(([key, value]) => [key.slice(4), dyeNumber(value, lang(), 3)])) } : {}),
      ...(action === 'tipReturn' ? { tipIssueId: pick, reason: d.reason } : {}),
      ...(action === 'pack' ? { cutOutputId: pick, packageNo: d.packageNo } : {}),
      ...(action === 'dispatch' ? { packageId: pick } : {}),
      ...(action === 'return' ? { inputId: pick, reason: d.reason } : {}) }
    saving = true; patch(); await saveCentralWebbingExecution(command, user); execDrafts.delete(key)
    execSelections.delete(execModeKey() + '|' + action); entryError = undefined
    if (root() && session.account?.userId === user.userId) { success = t('saved'); resolveAction(); patch() }
  } catch (error) {
    if (error instanceof Error && /已保存.*未能更新/.test(error.message)) d.committed = true
    if (root() && order()?.id === o.id) message = error
  } finally { saving = false; if (root()) patch() }
}
export async function renderCentralWebbingPage(next: string, isCurrent = () => true) {
  const token = ++generation; path = next
  try {
    await hydratePmsTmfPurchaseStateFromIdb(); await hydratePmsTmfPurchaseReferencesFromIdb(true)
    if (token !== generation || !isCurrent()) return ''
    entryError = undefined
    const preferred = session.currentFactory || session.preference.factoryId || TMF_FACTORY_ID
    const valid = listFactoryMasterRecords().some(factory => factory.id === preferred && factory.status === 'active' && isCentralPdaFactory(factory) && factory.id === TMF_FACTORY_ID)
    ensureCentralSessionAccount(valid ? preferred : TMF_FACTORY_ID)
    return renderCentralPdaFrame(frame())
  } catch (error) { if (token !== generation || !isCurrent()) return ''; entryError = error; return renderCentralPdaFrame(frame()) }
}
export async function handleCentralWebbingEvent(target: Element, event?: Event): Promise<boolean> {
  if (!root()) return false
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); if (document.querySelector('[data-webbing-overlay]')) closeCentralWebbingOverlay(); else if (route().id) navigate(prefix + '/' + route().tab); return true }
    if (event.key === 'F1') { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-footer] button:not(:disabled)')?.focus(); return true }
    if (event.key === 'Enter' && !event.isComposing) {
      if (target.matches('[data-webbing-field="scan"]')) { event.preventDefault(); identify(); return true }
      if (target.matches('[data-webbing-login="account"]')) { event.preventDefault(); root()?.querySelector<HTMLInputElement>('[data-webbing-login="password"]')?.focus(); return true }
      if (target.matches('[data-webbing-login="password"]')) { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-action="webbing-login"]')?.click(); return true }
      if (target.matches('[data-webbing-field="qty"]')) { event.preventDefault(); root()?.querySelector<HTMLButtonElement>('[data-central-footer] button:not(:disabled)')?.focus(); return true }
    }
  }
  const input = target.closest<HTMLInputElement>('[data-webbing-field],[data-webbing-login]')
  if (input && (event?.type === 'input' || event?.type === 'change')) {
    if (saving) return true
    if (input.dataset.webbingLogin) { login[input.dataset.webbingLogin as 'account' | 'password'] = input.value; return true }
    if (input.dataset.webbingField === 'scan') { scan = input.value; return true }
    const fieldName = input.dataset.webbingField
    if (fieldName && (['pieces', 'length', 'finished', 'defective', 'loss', 'reason', 'packageNo'].includes(fieldName) || fieldName.startsWith('tip:'))) {
      if (!execSelection() || execDraft()?.committed) return true
      const draftValue = execDraft(true)!; (draftValue as unknown as Record<string, string>)[fieldName] = input.value
      if (!execFilled(draftValue)) execDrafts.delete(execSelectionKey() + '|' + (execSelection() || ''))
      message = undefined; success = ''
      const button = root()?.querySelector<HTMLButtonElement>('[data-central-footer] button'), primary = frame().primary
      if (button && primary) { button.disabled = !!primary.disabled; button.textContent = primary.label + (primary.context ? ' ' + primary.context : '') }
      return true
    }
    if (!selected() || draft()?.committed) return true
    const d = draft(true)!; d.qty = input.value; if (!filled(d)) drafts.delete(scope()); message = undefined; success = ''
    const button = root()?.querySelector<HTMLButtonElement>('[data-central-footer] button'), primary = frame().primary
    if (button && primary) { button.disabled = !!primary.disabled; button.textContent = primary.label + (primary.context ? ' ' + primary.context : '') }
    return true
  }
  const control = target.closest<HTMLElement>('[data-central-action]'), action = control?.dataset.centralAction, value = control?.dataset.centralValue
  if (saving) return !!action
  const nav = target.closest<HTMLElement>('[data-central-nav]')?.dataset.centralNav
  if (nav) { navigate(nav); return true }
  if (!action) return false
  switch (action) {
    case 'webbing-close': closeCentralWebbingOverlay(); break
    case 'language': { const old = lang(); session.language = old === 'id' ? 'zh' : 'id'; for (const d of drafts.values()) d.qty = translateDyeNumber(d.qty, old, lang()); for (const d of execDrafts.values()) { d.pieces = translateDyeNumber(d.pieces, old, lang()); d.length = translateDyeNumber(d.length, old, lang()); d.finished = translateDyeNumber(d.finished, old, lang()); d.defective = translateDyeNumber(d.defective, old, lang()); d.loss = translateDyeNumber(d.loss, old, lang()) } message = undefined; saveCentralSessionPreference(); patch(); break }
    case 'logout': if (hasCentralDrafts()) openOverlay(`<p class="mb-3">${t('unsent')}</p>${cb(t('cancel'), 'webbing-close')}${cb(t('discard'), 'webbing-logout')}`); else signOut(); break
    case 'webbing-logout': signOut(); break
    case 'webbing-login': { const user = readFactoryPdaExecutionUsers().find(row => normalizePdaLoginId(row.loginId) === normalizePdaLoginId(login.account)); if (!user || !verifyPdaPassword(login.password, user.passwordHash) || user.status !== 'ACTIVE' || !listFactoryMasterRecords().some(factory => factory.id === user.factoryId && factory.status === 'active' && isCentralPdaFactory(factory) && factory.id === TMF_FACTORY_ID)) { message = new Error(t('loginFail')); patch(); break } discardCentralDrafts(); session.account = user; session.currentFactory = user.factoryId; session.signedOut = false; login = { account: '', password: '' }; saveCentralSessionPreference(); navigate(prefix + '/' + route().tab); break }
    case 'webbing-identify': identify(); break
    case 'webbing-order': navigate(prefix + '/' + route().tab + '/' + encodeURIComponent(value || '')); break
    case 'webbing-select-input': { const o = order(), row = o && webbingInputs(o).find(item => item.id === value); if (row) selectRow('input', row.id, '米'); patch(); break }
    case 'webbing-select-tip': { const o = order(), row = o && webbingTipIssues(o).find(item => item.id === value); if (row) selectRow('tip', row.id, row.unit); patch(); break }
    case 'webbing-save': await save(); break
    case 'webbing-exec-save': await saveExec(); break
    case 'webbing-action': currentAction = value as CentralWebbingAction; execModes.set(execModeKey(), currentAction); message = undefined; success = ''; patch(); break
    case 'webbing-select-cut': case 'webbing-select-tipping': case 'webbing-select-tipReturn': case 'webbing-select-pack': case 'webbing-select-dispatch': case 'webbing-select-return': {
      const mapped = (action === 'webbing-select-tipping' ? 'tip' : action === 'webbing-select-tipReturn' ? 'tipReturn' : action.replace('webbing-select-', '')) as 'cut' | 'tip' | 'tipReturn' | 'pack' | 'dispatch' | 'return'
      execSelections.set(execModeKey() + '|' + mapped, value || ''); message = undefined; success = ''; patch(); break
    }
    case 'webbing-exec-clear': if (!execDraft()?.committed) { execDrafts.delete(execSelectionKey() + '|' + (execSelection() || '')); message = undefined; success = ''; patch() } break
    case 'webbing-clear': if (!draft()?.committed) { drafts.delete(scope()); message = undefined; success = ''; patch() } break
    case 'webbing-next': navigate(prefix + '/' + route().tab); break
    case 'webbing-more': limit += 15; patch(); break
    case 'webbing-reload': try { await hydratePmsTmfPurchaseStateFromIdb(); await hydratePmsTmfPurchaseReferencesFromIdb(true); for (const [key, d] of drafts) { if (d.committed) drafts.delete(key); else if (key.startsWith([session.currentFactory, session.account?.userId, route().id].join('|') + '|')) d.operationId = crypto.randomUUID() } for (const [key, d] of execDrafts) { if (d.committed) execDrafts.delete(key); else if (key.startsWith([session.currentFactory, session.account?.userId, route().id].join('|') + '|')) d.operationId = crypto.randomUUID() } entryError = undefined; message = undefined; resolveAction(); patch() } catch (error) { message = error; patch() } break
    case 'webbing-photo': if (value) { if (failedPhotos.has(value)) { const img = root()?.querySelector<HTMLImageElement>('[data-webbing-photo]'); if (img) { img.hidden = false; img.parentElement?.querySelector('[data-webbing-photo-error]')?.remove(); img.src = value + (value.includes('?') ? '&' : '?') + 'pdaRetry=' + Date.now() } } else openOverlay(`<img class="max-h-[75dvh] w-full object-contain" src="${ce(value)}" alt="${ce(order()?.material?.materialName || t('photo'))}">`) } break
    case 'operation': {
      const specials = listCentralSpecialOperations(session.currentFactory).filter(operation => /盘扣|花朵/.test(operation.operationName))
      openOverlay(renderCentralOperationMenu({ language: lang(), tab: route().tab, factoryId: session.currentFactory, currentPath: appStore.getState().pathname, accessoryOperations: specials.map(operation => ({ id: operation.operationId, label: centralOperationLabel(operation.operationName, lang()) })) }))
      break
    }
    case 'webbing-accessory': session.currentOperation = value || ''; saveCentralSessionPreference(); navigate('/fcs/pda/central/receive'); break
    case 'webbing-lace': navigate(`/fcs/pda/central/lace/${route().tab}`); break
    case 'webbing-other': navigate('/fcs/pda/central/receive'); break
  }
  return true
}
let mounted = false
export function mountCentralWebbingPage() {
  const host = root(); if (!host) return
  const size = () => { if (root()) root()!.style.height = `${Math.round(window.visualViewport?.height || innerHeight)}px` }
  if (!mounted) { mounted = true; window.visualViewport?.addEventListener('resize', size); window.addEventListener('beforeunload', e => { if (root() && [...drafts.values()].some(d => !d.committed && filled(d))) { e.preventDefault(); e.returnValue = '' } }) }
  size()
  host.querySelectorAll<HTMLImageElement>('[data-webbing-photo]').forEach(img => {
    const src = img.getAttribute('src') || ''
    const done = () => { loadedPhotos.add(src); failedPhotos.delete(src); const button = host.querySelector<HTMLButtonElement>('[data-central-footer] button'); if (button) button.disabled = !!frame().primary?.disabled }
    const failed = () => { loadedPhotos.delete(src); failedPhotos.add(src); img.hidden = true; const parent = img.parentElement; if (parent && !parent.querySelector('[data-webbing-photo-error]')) parent.insertAdjacentHTML('beforeend', `<span class="text-xs text-red-700" data-webbing-photo-error>${t('photoFailed')}</span>`); const button = host.querySelector<HTMLButtonElement>('[data-central-footer] button'); if (button) button.disabled = true }
    img.onload = done; img.onerror = failed
    if (img.complete) { if (img.naturalWidth) done(); else failed() }
  })
  if (saving) { host.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = true }); return }
  if (!document.querySelector('[data-webbing-overlay]')) { const scanInput = host.querySelector<HTMLInputElement>('[data-webbing-field="scan"]'), qty = host.querySelector<HTMLInputElement>('[data-webbing-field="qty"]:not(:disabled), [data-webbing-field="pieces"]:not(:disabled)'); const active = qty || scanInput || host.querySelector<HTMLInputElement>('[data-webbing-login="account"]'); active?.focus({ preventScroll: true }); if (active && !scanInput) active.scrollIntoView({ block: 'nearest' }) }
}
export function readCentralWebbingState() { return getTmfPurchaseState() }
