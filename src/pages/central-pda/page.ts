// @page-pattern: pda
import { centralWoolCraftContexts } from './wool-craft-model.ts'
import { appStore } from '../../state/store.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword, type FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand, runSpecialCraftRecordCommand } from '../../data/fcs/special-craft-records.ts'
import { getSpecialCraftActionRevision, type SpecialCraftTaskOrder } from '../../data/fcs/special-craft-task-orders.ts'
import { executeMobileProcessAction, listProcessActionOperationRecords, type ProcessActionPayload } from '../../data/fcs/process-action-writeback-service.ts'
import { listProcessHandoverRecords } from '../../data/fcs/process-warehouse-domain.ts'
import { renderCentralPdaFrame, centralPdaTabPath, type CentralPdaFrameInput, type CentralPdaLanguage, type CentralPdaTab } from './frame.ts'
import { centralSpecialActions, centralSpecialQuantityRows, centralSpecialAvailableActions, centralSpecialIdentity, centralOperationLabel, centralBusinessLabel,
  centralUnit, centralSpecialScanOrders, centralSpecialScanKey, getCentralSpecialOrder, listCentralSpecialOrders, listCentralSpecialFactories, listCentralSpecialOperations, validateCentralSpecialQuantity,
  type CentralSpecialView, type CentralSpecialAction, type CentralQuantityRow } from './special-model.ts'
import { renderCentralSpecialWarehouse, type CentralWarehouseSelection } from './warehouse.ts'
import { cb, ce, cn, ct, centralTime, centralErrorText, centralFormalName, centralNotice } from './ui.ts'
import { centralSession, saveCentralSessionPreference, registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'

let saving = false, message = '', messageError = false
let currentPath = '', scanValue = '', formRevision = '', activeRowKey = ''
let loginName = ''
let selectedLimit = 15
let currentViewOverride: { orderId: string; view: CentralSpecialView } | undefined
let storeRoutePath = ''
let renderGeneration = 0
const loadedPhotos = new Set<string>(), failedPhotos = new Set<string>()
const drafts = new Map<string, { raw: string; operationId: string; revision: string; intent?: string; committed?: boolean }>()
const rowChoices = new Map<string, string>()
const warehouseChoices = new Map<string, CentralWarehouseSelection>()
registerCentralDraftDiscard(() => { drafts.clear(); rowChoices.clear(); warehouseChoices.clear(); scanValue = ''; message = ''; messageError = false }, () => [...drafts.values()].some(draft => !draft.committed && !!draft.raw.trim()))
type Location = { tab: CentralPdaTab; order?: SpecialCraftTaskOrder; view: CentralSpecialView }
function context() {
  const factories = listCentralSpecialFactories(centralSession.currentFactory || centralSession.preference.factoryId)
  if (!factories.some(factory => factory.id === centralSession.currentFactory)) centralSession.currentFactory = factories.find(factory => factory.id === centralSession.preference.factoryId)?.id || factories.find(factory => factory.id === 'FAC-APF')?.id || factories[0]?.id || ''
  if (!centralSession.signedOut && (!centralSession.account || centralSession.account.factoryId !== centralSession.currentFactory)) {
    const users = readFactoryPdaExecutionUsers(centralSession.currentFactory).filter(user => user.status === 'ACTIVE')
    centralSession.account = users.find(user => user.userId === centralSession.preference.accountId) || users.find(user => user.roleId === 'ROLE_ADMIN')
  }
  const operations = listCentralSpecialOperations(centralSession.currentFactory)
  if (!operations.some(operation => operation.operationId === centralSession.currentOperation)) centralSession.currentOperation = operations.find(operation => operation.operationId === centralSession.preference.operationId)?.operationId || operations[0]?.operationId || ''
  return { factories, factory: factories.find(factory => factory.id === centralSession.currentFactory), operations, operation: operations.find(operation => operation.operationId === centralSession.currentOperation) }
}
function locate(path = currentPath): Location {
  const url = new URL(path || centralPdaTabPath('receive'), 'https://pda.local')
  const parts = url.pathname.split('/').filter(Boolean)
  const tab: CentralPdaTab = ['receive', 'execute', 'warehouse'].includes(parts[3]) ? parts[3] as CentralPdaTab : 'receive'
  let id = ''
  try { id = decodeURIComponent(parts[4] || '') } catch { /* Invalid direct links cannot select an order. */ }
  const order = id ? getCentralSpecialOrder(id, centralSession.currentFactory, centralSession.currentOperation) : undefined
  const requested = currentViewOverride?.orderId === id ? currentViewOverride.view : url.searchParams.get('view') || 'detail'
  const view = tab === 'receive' ? 'receive' : ['detail', 'work', 'handoff', 'finish', 'receipt'].includes(requested) ? requested as CentralSpecialView : 'detail'
  return { tab, order, view }
}
function orderPath(order: SpecialCraftTaskOrder, tab: CentralPdaTab, view: CentralSpecialView = 'detail') {
  return `${centralPdaTabPath(tab)}/${encodeURIComponent(order.taskOrderId)}?view=${view}`
}
function draftPrefix(order: SpecialCraftTaskOrder, view: string) {
  return [centralSession.currentFactory, centralSession.account?.userId, centralSession.currentOperation, order.taskOrderId, view].join('|')
}
function draftKey(order: SpecialCraftTaskOrder, view: string, row: CentralQuantityRow) { return `${draftPrefix(order, view)}|${row.key}` }
function selectedRow(order: SpecialCraftTaskOrder, action: CentralSpecialAction) {
  const rows = centralSpecialQuantityRows(order, action, centralSession.language)
  const selected = rowChoices.get(draftPrefix(order, action))
  const row = rows.find(row => row.key === selected) || rows.find(row => row.max === null || row.max > 0) || rows[0]
  if (row && !selected) rowChoices.set(draftPrefix(order, action), row.key)
  return { rows, row }
}
function quantityFooter(order: SpecialCraftTaskOrder, action: CentralSpecialAction): CentralPdaFrameInput['primary'] {
  const { row } = selectedRow(order, action)
  const raw = row?.ticket ? '1' : row ? drafts.get(draftKey(order, action, row))?.raw || '' : ''
  let qty = 0
  try { if (row) qty = validateCentralSpecialQuantity(raw, row) } catch { /* Invalid field never enables saving. */ }
  const photo = centralSpecialIdentity(order, centralSession.language).photo
  return { label: saving ? ct(centralSession.language, 'saving') : `${ct(centralSession.language, action)}${qty && row ? ` ${cn(qty, centralSession.language)} ${centralUnit(row.unit, centralSession.language)}` : ''}`, action: 'save', disabled: saving || !!(row && drafts.get(draftKey(order, action, row))?.committed) || !centralSession.account || !qty || !photo || !loadedPhotos.has(photo) || failedPhotos.has(photo) }
}
function identityCard(order: SpecialCraftTaskOrder) {
  const identity = centralSpecialIdentity(order, centralSession.language)
  return `<article class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">${identity.photo ? `<button type="button" data-central-action="photo" data-central-value="${ce(identity.photo)}" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200" aria-label="${ct(centralSession.language, 'photo')}"><img src="${ce(identity.photo)}" alt="${ce(identity.name)}" class="h-full w-full object-contain" data-central-photo></button>` : ''}<div class="min-w-0"><strong class="break-words text-sm leading-5">${ce(identity.name)}</strong><p class="break-words text-xs leading-5 text-slate-600">${ce(order.taskOrderNo)}</p><p class="break-words text-sm">${ce(identity.object)}</p></div></article>${identity.photo ? '' : centralNotice(ct(centralSession.language, 'noPhoto'), true)}`
}
function direction(order: SpecialCraftTaskOrder, receiving: boolean) {
  const identity = centralSpecialIdentity(order, centralSession.language)
  const flowNames: Record<string, string> = { '裁床待交出仓': 'Gudang potong siap kirim', '面辅料仓': 'Gudang bahan', '成衣仓': 'Gudang pakaian', '后道待加工仓': 'Gudang finishing masuk', '中央辅料仓': 'Gudang aksesori pusat', '公司中转仓': 'Gudang transit' }
  const name = receiving ? identity.source : identity.target
  const label = centralSession.language === 'id' ? flowNames[name] || centralFormalName(name, receiving ? order.sourceFactoryId || identity.sourceNo : order.factoryId, centralSession.language) : name
  return `<div class="my-2 break-words rounded-xl border border-slate-200 bg-white px-3 py-2"><p><span class="mr-2 text-sm text-slate-600">${ct(centralSession.language, receiving ? 'source' : 'target')}</span><strong>${ce(label)}</strong></p>${receiving ? `<p class="text-sm text-slate-600">${ce(identity.sourceNo)}</p>` : ''}</div>`
}
function statusLabel(order: SpecialCraftTaskOrder) { return ct(centralSession.language, order.status === '已完结' ? 'closed' : order.status === '待接收' ? 'pending' : 'processing') }
function actionModes(order: SpecialCraftTaskOrder, view: CentralSpecialView) {
  const available = centralSpecialAvailableActions(order).filter(action => action !== 'receive')
  return `<div class="my-3 grid grid-cols-2 gap-2">${available.map(action => cb(ct(centralSession.language, action), 'view', action, action === view)).join('')}${cb(ct(centralSession.language, 'receipt'), 'view', 'receipt', view === 'receipt')}</div>`
}
function quantityForm(order: SpecialCraftTaskOrder, action: CentralSpecialAction) {
  if (!centralSpecialAvailableActions(order).includes(action)) return centralNotice(ct(centralSession.language, 'notAvailable'))
  const { rows, row } = selectedRow(order, action)
  if (!row) return centralNotice(ct(centralSession.language, 'noRows'))
  activeRowKey = row.key
  formRevision = getSpecialCraftActionRevision(order)
  const draft = drafts.get(draftKey(order, action, row))
  const raw = draft?.raw || ''
  const unit = centralUnit(row.unit, centralSession.language)
  return `${draft?.committed && !message ? centralNotice(ct(centralSession.language, 'committed'), true) + cb(ct(centralSession.language, 'reload'), 'reload') : ''}${rows.length > 1 ? `<label class="sr-only" for="central-item">${ct(centralSession.language, 'choose')}</label><select id="central-item" data-central-field="row" class="mb-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-base">${rows.filter(item => item.key === row.key || item.max === null || item.max > 0).map(item => `<option value="${ce(item.key)}"${item.key === row.key ? ' selected' : ''}>${ce(item.label)}</option>`).join('')}</select>` : `<p class="my-3 break-words text-base font-semibold" data-central-current-object>${ce(row.label)}</p>`}
    ${row.max === null ? '' : `<p class="mb-3 text-base">${ct(centralSession.language, 'remaining')} <strong data-central-remaining>${cn(row.max, centralSession.language)} ${ce(unit)}</strong></p>`}
    <label class="mb-2 block text-base font-bold" for="central-qty">${ct(centralSession.language, 'thisQty')} · ${ce(unit)}</label>
    ${row.ticket ? `<p class="rounded-xl bg-white p-3 text-2xl font-bold">1 ${ce(unit)}</p>` : `<div class="flex items-start gap-2"><input id="central-qty" data-central-field="quantity" type="text" inputmode="${['片', '件', '张', '条', '个'].includes(row.unit) ? 'numeric' : 'decimal'}" enterkeyhint="done" autocomplete="off" value="${ce(raw)}" class="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-400 bg-white px-3 py-3 text-2xl font-bold" aria-describedby="central-quantity-error"${saving || draft?.committed || row.max === 0 ? ' disabled' : ''}>${cb(ct(centralSession.language, 'clear'), 'clear')}</div>`}<p id="central-quantity-error" role="alert" class="mt-2 text-base text-red-700" data-central-field-error></p>`
}
function operationLog(order: SpecialCraftTaskOrder) {
  const records = listProcessActionOperationRecords({ sourceId: order.taskOrderId }).slice(-15).reverse()
  return `<details class="mt-4 rounded-xl border border-slate-200 bg-white p-3"><summary class="min-h-11 cursor-pointer py-2 font-semibold">${ct(centralSession.language, 'record')}</summary><div class="space-y-3">${records.map(record => {
    const action = (Object.keys(centralSpecialActions) as CentralSpecialAction[]).find(key => centralSpecialActions[key] === record.actionCode)
    return `<p class="break-words border-t border-slate-100 pt-2">${ce(action ? ct(centralSession.language, action) : centralFormalName(record.actionLabel, record.operationRecordId, centralSession.language))} · ${cn(record.objectQty, centralSession.language)} ${ce(centralUnit(record.qtyUnit, centralSession.language))}<br><span class="text-sm text-slate-600">${ce(centralFormalName(record.operatorName, record.operatorUserId, centralSession.language))} · ${ce(centralTime(record.operatedAt, centralSession.language))}</span></p>`
  }).join('') || `<p>${ct(centralSession.language, 'noRecords')}</p>`}</div></details>`
}
function receiptView(order: SpecialCraftTaskOrder) {
  const rows = listProcessHandoverRecords().filter(record => record.workOrderId === order.taskOrderId)
  return rows.map(row => `<article class="my-3 rounded-xl border border-slate-200 bg-white p-3"><strong class="break-words">${ce(row.handoverRecordNo)}</strong><p class="mt-2">${ct(centralSession.language, 'handed')} <strong>${cn(row.handoverObjectQty, centralSession.language)} ${ce(centralUnit(row.qtyUnit, centralSession.language))}</strong></p><p>${ct(centralSession.language, 'sender')} · ${ce(centralFormalName(row.handoverPerson, row.operatorUserId, centralSession.language))}</p><p class="text-sm text-slate-600">${ce(centralTime(row.handoverAt, centralSession.language))}</p><p class="mt-2">${ct(centralSession.language, 'actual')} <strong>${cn(row.receiveObjectQty || 0, centralSession.language)} ${ce(centralUnit(row.qtyUnit, centralSession.language))}</strong></p><p class="break-words text-sm">${row.receiveAt ? `${ct(centralSession.language, 'receiver')} · ${ce(centralFormalName(row.receivePerson, row.receiveFactoryId, centralSession.language))} · ${ce(centralTime(row.receiveAt, centralSession.language))}` : ct(centralSession.language, 'awaiting')}</p></article>`).join('') || centralNotice(ct(centralSession.language, 'noRecords'))
}
function listContent(tab: CentralPdaTab) {
  const rows = listCentralSpecialOrders(centralSession.currentFactory, centralSession.currentOperation).filter(order => tab !== 'receive' || centralSpecialAvailableActions(order).includes('receive'))
  const wool = centralWoolCraftContexts(centralSession.currentFactory, centralSession.currentOperation).filter(context => tab !== 'receive' || context.incoming.some(row => row.canReceive))
  const woolLink = wool.length ? `<a class="my-3 block min-h-12 rounded-xl border border-blue-300 bg-white p-3 font-bold text-blue-700" data-central-nav="/fcs/pda/central/wool-craft/${tab}?factoryId=${ce(centralSession.currentFactory)}&operationId=${ce(centralSession.currentOperation)}">${centralSession.language==='zh'?'毛织片':'Potongan rajut'} · ${wool.length}</a>` : ''
  return woolLink + `<label for="central-scan" class="mb-2 block font-semibold">${ct(centralSession.language, 'scan')}</label><div class="mb-3 flex items-start gap-2"><input id="central-scan" data-central-field="scan" type="text" inputmode="text" enterkeyhint="search" autocomplete="off" placeholder="${ct(centralSession.language, 'scanHint')}" value="${ce(scanValue)}" class="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-400 bg-white p-3 text-base">${cb(ct(centralSession.language, 'identify'), 'scan')}</div><div class="space-y-3">${rows.slice(0, selectedLimit).map(order => {
    const identity = centralSpecialIdentity(order, centralSession.language)
    return `<button type="button" data-central-action="order" data-central-value="${ce(order.taskOrderId)}" class="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left">${identity.photo ? `<img src="${ce(identity.photo)}" alt="${ce(identity.name)}" class="h-14 w-14 shrink-0 rounded-lg object-contain" loading="lazy">` : ''}<span class="min-w-0"><strong class="block break-words text-base">${ce(order.taskOrderNo)}</strong><span class="mt-1 block break-words text-sm">${ce(identity.name)} · ${ce(identity.object)}</span><span class="mt-1 block text-sm text-blue-700">${statusLabel(order)}${[...drafts.keys()].some(key => key.startsWith(draftPrefix(order, ''))) ? ` · ${ct(centralSession.language, 'keepInput')}` : ''}</span></span></button>`
  }).join('') || centralNotice(ct(centralSession.language, 'empty'))}${rows.length > selectedLimit ? cb(ct(centralSession.language, 'more'), 'more') : ''}</div>`
}
function loginContent() {
  return `<div class="space-y-3"><h2 class="text-xl font-bold">${ct(centralSession.language, 'login')}</h2><label class="block" for="central-login">${ct(centralSession.language, 'account')}</label><input id="central-login" data-central-login="account" autocomplete="username" value="${ce(loginName)}" class="min-h-12 w-full rounded-xl border border-slate-400 bg-white p-3"><label class="block" for="central-password">${ct(centralSession.language, 'password')}</label><input id="central-password" data-central-login="password" type="password" autocomplete="current-password" class="min-h-12 w-full rounded-xl border border-slate-400 bg-white p-3">${cb(ct(centralSession.language, 'login'), 'login', undefined, true)}</div>`
}
function buildFrame(): CentralPdaFrameInput {
  const { factory, operation } = context()
  const location = locate()
  const base: CentralPdaFrameInput = {
    accountName: centralSession.account ? centralFormalName(centralSession.account.name, centralSession.account.loginId, centralSession.language) : ct(centralSession.language, 'account'), accountNo: '',
    factoryName: centralFormalName(factory?.name, centralSession.currentFactory, centralSession.language), operationName: centralOperationLabel(operation?.operationName || '', centralSession.language),
    language: centralSession.language, tab: location.tab, content: '',
  }
  if (centralSession.signedOut || !centralSession.account) return { ...base, content: (message ? centralNotice(message, messageError) : '') + loginContent(), heading: ct(centralSession.language, 'login'), backPath: centralPdaTabPath('receive') }
  let content = message ? `<div class="mb-3" data-central-feedback>${centralNotice(message, messageError)}${messageError ? cb(ct(centralSession.language, 'reload'), 'reload') : ''}</div>` : ''
  if (location.order) {
    const order = location.order
    const closed = order.status === '已完结'
    const view = closed && location.view !== 'handoff' && location.view !== 'receipt' ? 'detail' : location.view
    content += identityCard(order)
    if (location.tab === 'receive') {
      content += direction(order, true) + quantityForm(order, 'receive')
      base.primary = quantityFooter(order, 'receive')
    } else {
      content += `<p class="mt-3 font-semibold text-blue-800">${statusLabel(order)}</p>`
      content += actionModes(order, view)
      if (view === 'work' || view === 'handoff') {
        if (view === 'handoff') content += direction(order, false)
        content += quantityForm(order, view)
        base.primary = quantityFooter(order, view)
      } else if (view === 'finish') {
        content += centralNotice(ct(centralSession.language, 'finishWarning'))
        base.primary = { label: ct(centralSession.language, 'finish'), action: 'save', disabled: saving || !centralSpecialAvailableActions(order).includes('finish') }
      } else {
        content += `<div class="my-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-base"><span>${ct(centralSession.language, 'received')}</span><strong>${cn(order.quantityMode === 'TICKET_INPUT_OUTPUT' ? order.receivedTicketCount || 0 : order.inputReceivedQty ?? order.receivedQty, centralSession.language)} ${ce(centralUnit(order.quantityMode === 'TICKET_INPUT_OUTPUT' ? '张' : order.inputUnit || order.unit, centralSession.language))}</strong><span>${ct(centralSession.language, 'produced')}</span><strong>${cn(order.completedQty, centralSession.language)} ${ce(centralUnit(order.outputUnit || order.unit, centralSession.language))}</strong><span>${ct(centralSession.language, 'handed')}</span><strong>${cn(order.returnedQty || 0, centralSession.language)} ${ce(centralUnit(order.outputUnit || order.unit, centralSession.language))}</strong></div>`
        content += direction(order, false) + receiptView(order)
      }
    }
    content += operationLog(order)
    if (!saving) content += `<div class="mt-3">${cb(ct(centralSession.language, 'next'), 'next')}</div>`
    base.heading = ct(centralSession.language, closed ? 'detail' : view === 'detail' ? 'detail' : view)
    base.backPath = centralPdaTabPath(location.tab)
  } else if (location.tab === 'warehouse') {
    const scope = `${centralSession.currentFactory}|${centralSession.currentOperation}`
    if (!warehouseChoices.has(scope)) warehouseChoices.set(scope, { view: 'locations', kind: 'WAIT_PROCESS', limit: 15 })
    content += renderCentralSpecialWarehouse(centralSession.currentFactory, centralSession.currentOperation, centralSession.language, warehouseChoices.get(scope)!)
  } else content += listContent(location.tab)
  base.content = content
  return base
}

/** Root route changes replace the frame; field edits update only field feedback and the primary button. */
export async function renderCentralPdaPage(path: string, isCurrent = () => true): Promise<string> {
  const generation = ++renderGeneration
  try {
    await ensureSpecialCraftRecords()
    if (generation !== renderGeneration || !isCurrent()) return ''
    if (storeRoutePath !== path) currentViewOverride = undefined
    storeRoutePath = path
    currentPath = path
    const url = new URL(path, 'https://pda.local')
    const requestedFactory = url.searchParams.get('factoryId')
    if (requestedFactory && listCentralSpecialFactories(requestedFactory).some(factory => factory.id === requestedFactory)) {
      if (centralSession.currentFactory !== requestedFactory) { centralSession.account = undefined; centralSession.currentFactory = requestedFactory }
    }
    context()
    const requestedOperation = url.searchParams.get('operationId')
    if (requestedOperation && listCentralSpecialOperations(centralSession.currentFactory).some(operation => operation.operationId === requestedOperation)) centralSession.currentOperation = requestedOperation
    return renderCentralPdaFrame(buildFrame())
  } catch (error) {
    return renderCentralPdaFrame({ accountName: ct(centralSession.language, 'account'), accountNo: '', factoryName: centralSession.language === 'zh' ? '中央工厂' : 'Pabrik pusat', operationName: '', language: centralSession.language, tab: 'receive', content: centralNotice(centralErrorText(error, centralSession.language), true) + cb(ct(centralSession.language, 'reload'), 'reload') })
  }
}
function patchFrame() {
  const root = document.querySelector<HTMLElement>('[data-central-pda-root][data-central-family="special"]')
  if (!root) return
  const scroll = root.querySelector('[data-central-content]')?.scrollTop || 0
  const template = document.createElement('template')
  template.innerHTML = renderCentralPdaFrame(buildFrame())
  const next = template.content.firstElementChild!
  const languageChanged = root.lang !== next.getAttribute('lang')
  root.lang = next.getAttribute('lang') || ''
  const changed: Element[] = []
  const header = root.querySelector(':scope > header'), nextHeader = next.querySelector(':scope > header')!
  if (header && (languageChanged || header.textContent !== nextHeader.textContent)) { header.replaceWith(nextHeader); changed.push(nextHeader) }
  const heading = root.querySelector('[data-central-heading]'), nextHeading = next.querySelector('[data-central-heading]')!
  if (heading && (languageChanged || heading.textContent !== nextHeading.textContent)) { heading.replaceWith(nextHeading); changed.push(nextHeading) }
  const main = root.querySelector('[data-central-content]')!, nextMain = next.querySelector('[data-central-content]')!
  main.replaceChildren(...nextMain.childNodes); changed.push(main)
  const footer = root.querySelector('[data-central-footer]'), nextFooter = next.querySelector('[data-central-footer]')
  if (nextFooter) {
    if (footer) footer.replaceWith(nextFooter)
    else root.insertBefore(nextFooter, root.querySelector(':scope > nav'))
    changed.push(nextFooter)
  } else footer?.remove()
  const nav = root.querySelector(':scope > nav'), nextNav = next.querySelector(':scope > nav')
  if (nextNav && !nav) { root.append(nextNav); changed.push(nextNav) }
  else if (!nextNav) nav?.remove()
  else if (nav && languageChanged) { nav.replaceWith(nextNav); changed.push(nextNav) }
  const content = root.querySelector('[data-central-content]')
  if (content) content.scrollTop = scroll
  changed.forEach(element => hydrateIcons(element as HTMLElement))
  mountCentralPdaPage()
}
function updateFooter() {
  if (!document.querySelector('[data-central-pda-root][data-central-family="special"]')) return
  const location = locate()
  const action = location.tab === 'receive' ? 'receive' : location.view
  if (!location.order || !['receive', 'work', 'handoff'].includes(action)) return
  const footer = quantityFooter(location.order, action as CentralSpecialAction)!
  const button = document.querySelector<HTMLButtonElement>('[data-central-pda-root] [data-central-action="save"]')
  if (button) { button.disabled = !!footer.disabled; button.textContent = footer.label }
}
function setQuantity(raw: string) {
  const location = locate(), action = location.tab === 'receive' ? 'receive' : location.view
  if (!location.order || !['receive', 'work', 'handoff'].includes(action)) return
  const { row } = selectedRow(location.order, action as CentralSpecialAction)
  if (!row) return
  const key = draftKey(location.order, action, row)
  if (drafts.get(key)?.committed) return
  if (!raw.trim()) drafts.delete(key)
  else drafts.set(key, { raw, operationId: drafts.get(key)?.operationId || crypto.randomUUID(), revision: drafts.get(key)?.revision || formRevision })
  const error = document.querySelector('[data-central-field-error]')
  if (error) {
    try { if (raw.trim()) validateCentralSpecialQuantity(raw, row); error.textContent = '' }
    catch (reason) { error.textContent = centralErrorText(reason, centralSession.language) }
  }
  message = ''; messageError = false
  document.querySelector('[data-central-feedback]')?.remove()
  updateFooter()
}
function navigate(path: string) {
  closeCentralPdaOverlay()
  message = ''; messageError = false; scanValue = ''; currentPath = path; currentViewOverride = undefined
  if (appStore.getState().pathname === path) { patchFrame(); return }
  const root = document.querySelector<HTMLElement>('[data-central-pda-root]')
  if (root) {
    root.dataset.centralNavigating = 'true'
    root.setAttribute('aria-busy', 'true')
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select').forEach(control => { control.disabled = true })
  }
  appStore.navigate(path)
}
function showOverlay(content: string) {
  closeCentralPdaOverlay()
  const overlay = document.createElement('div')
  overlay.dataset.centralOverlay = ''
  overlay.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'
  overlay.innerHTML = `<section role="dialog" aria-modal="true" class="flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white"><div class="min-h-0 overflow-y-auto p-3">${content}</div><div class="border-t p-3">${cb(ct(centralSession.language, 'close'), 'overlay-close')}</div></section>`
  document.querySelector('[data-central-pda-root]')?.append(overlay)
  hydrateIcons(overlay)
  overlay.querySelector<HTMLButtonElement>('button')?.focus()
}
export function closeCentralPdaOverlay(): boolean {
  const overlay = document.querySelector('[data-central-overlay]')
  if (!overlay) return false
  overlay.remove(); return true
}
async function submit() {
  if (saving || !centralSession.account) return
  const actor = centralSession.account, factoryId = centralSession.currentFactory, operation = centralSession.currentOperation, startedPath = currentPath
  const same = () => !!document.querySelector('[data-central-pda-root][data-central-family="special"]') && currentPath === startedPath && centralSession.account?.userId === actor.userId && centralSession.currentFactory === factoryId && centralSession.currentOperation === operation
  const location = locate(), order = location.order
  const action = location.tab === 'receive' ? 'receive' : location.view as CentralSpecialAction
  if (!order || !Object.hasOwn(centralSpecialActions, action)) return
  const { row } = selectedRow(order, action)
  if (row?.ticket && !drafts.has(draftKey(order, action, row))) drafts.set(draftKey(order, action, row), { raw: '1', operationId: crypto.randomUUID(), revision: formRevision })
  const draft = row ? drafts.get(draftKey(order, action, row)) : undefined
  if (draft?.committed) return
  const capturedDraftKey = row ? draftKey(order, action, row) : ''
  const revision = draft?.revision || getSpecialCraftActionRevision(order)
  const operationId = draft?.operationId || crypto.randomUUID()
  try {
    const qty = action === 'finish' ? undefined : row ? validateCentralSpecialQuantity(draft?.raw || '', row) : 0
    const intent = JSON.stringify({ order: order.taskOrderId, action, qty, row: row?.key, account: actor.userId })
    if (draft) draft.intent = intent
    saving = true; updateFooter()
    const button = document.querySelector<HTMLButtonElement>('[data-central-action="save"]')
    if (button) { button.disabled = true; button.textContent = ct(centralSession.language, 'saving') }
    await ensureSpecialCraftRecords(true)
    if (hasSavedSpecialCraftCommand(operationId, intent)) {
      if (row) drafts.delete(capturedDraftKey)
      if (same()) { message = ct(centralSession.language, 'saved'); messageError = false }
      return
    }
    const fresh = getCentralSpecialOrder(order.taskOrderId, factoryId, operation)
    if (!fresh || revision !== getSpecialCraftActionRevision(fresh) || !centralSpecialAvailableActions(fresh).includes(action)) throw new Error('CHANGED')
    const freshRow = row ? centralSpecialQuantityRows(fresh, action, centralSession.language).find(item => item.key === row.key) : undefined
    if (row && (!freshRow || freshRow.key !== row.key || validateCentralSpecialQuantity(draft?.raw || '', freshRow) !== qty)) throw new Error('CHANGED')
    const payload: Omit<ProcessActionPayload, 'sourceChannel'> = {
      sourceType: 'SPECIAL_CRAFT', sourceId: fresh.taskOrderId, taskId: fresh.sourceTaskId,
      actionCode: centralSpecialActions[action], operatorName: actor.name, operatorUserId: actor.userId,
      operatorFactoryId: actor.factoryId, operatorRoleId: actor.roleId,
      operatedAt: new Date().toISOString(), objectQty: qty, qtyUnit: row?.unit || fresh.outputUnit || fresh.unit,
      objectType: fresh.targetObject, confirmationKey: operationId,
    }
    // Current garment preflight requires every SKU key. Unselected lines are zero for this submission.
    if (row?.skuCode && qty !== undefined) payload.skuQtyBySkuCode = { ...Object.fromEntries((fresh.demandLines || []).map(line => [line.skuCode, 0])), [row.skuCode]: qty }
    if (row?.feiTicketNo && qty !== undefined) payload.feiQtyByTicketNo = { [row.feiTicketNo]: qty }
    await runSpecialCraftRecordCommand(fresh.taskOrderId, () => executeMobileProcessAction(payload), operationId, intent)
    if (row) drafts.delete(capturedDraftKey)
    if (same()) { message = `${ct(centralSession.language, 'saved')}${qty !== undefined && row ? ` · ${cn(qty, centralSession.language)} ${centralUnit(row.unit, centralSession.language)}` : ''}`; messageError = false }
    if (action === 'finish') {
      for (const key of drafts.keys()) if (key.startsWith([factoryId, actor.userId, operation, order.taskOrderId].join('|') + '|')) drafts.delete(key)
    }
  } catch (error) {
    if (draft && error instanceof Error && /已保存.*(?:未能更新|未更新)/.test(error.message)) draft.committed = true
    if (same()) { message = centralErrorText(error, centralSession.language); messageError = true }
  }
  finally { saving = false; patchFrame() }
}
function identify() {
  const code = scanValue.trim()
  if (!code) { message = ct(centralSession.language, 'noScan'); messageError = true; patchFrame(); return }
  const location = locate()
  const matches = centralSpecialScanOrders(code, centralSession.currentFactory, centralSession.currentOperation)
  if (!matches.length) { message = ct(centralSession.language, 'wrongScan'); messageError = true; patchFrame(); document.querySelector<HTMLInputElement>('[data-central-field="scan"]')?.select(); return }
  if (matches.length > 1) { showOverlay(matches.map(order => cb(order.taskOrderNo, 'order', order.taskOrderId)).join('')); return }
  const order = matches[0]
  const action = location.tab === 'receive' ? 'receive' : 'work'
  const row = centralSpecialQuantityRows(order, action, centralSession.language).find(row => [row.skuCode, row.feiTicketNo].some(value => value?.toLowerCase() === centralSpecialScanKey(code)))
  if (row) rowChoices.set(draftPrefix(order, action), row.key)
  navigate(orderPath(order, location.tab === 'warehouse' ? 'execute' : location.tab, action))
}
export async function handleCentralPdaEvent(target: Element, event?: Event): Promise<boolean> {
  if (!target.closest('[data-central-pda-root]')) return false
  if (target.closest('[data-central-navigating="true"]')) return true
  if (event?.type === 'keydown') {
    const key = (event as KeyboardEvent).key
    if (key === 'F1') { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus() }
    else if (key === 'Enter' && target.matches('[data-central-login="account"]')) { event.preventDefault(); document.querySelector<HTMLInputElement>('[data-central-login="password"]')?.focus() }
    else if (key === 'Enter' && target.matches('[data-central-login="password"]')) {
      event.preventDefault()
      const button = document.querySelector<HTMLButtonElement>('[data-central-action="login"]')
      if (!saving && button) await handleCentralPdaEvent(button, new Event('click'))
    }
    else if (key === 'Escape') {
      event.preventDefault()
      if (!closeCentralPdaOverlay() && locate().order && !saving) navigate(centralPdaTabPath(locate().tab))
    } else if (key === 'Enter' && target.matches('[data-central-field="scan"]')) { event.preventDefault(); if (!saving) identify() }
    else if (key === 'Enter' && target.matches('[data-central-field="quantity"]')) { event.preventDefault(); document.querySelector<HTMLButtonElement>('[data-central-action="save"]')?.focus() }
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-central-field]')
  if (field && (event?.type === 'input' || event?.type === 'change')) {
    if (saving) return true
    if (field.dataset.centralField === 'scan') scanValue = field.value
    if (field.dataset.centralField === 'quantity') setQuantity(field.value)
    if (field.dataset.centralField === 'row' && event.type === 'change') {
      const location = locate(), action = location.tab === 'receive' ? 'receive' : location.view
      if (location.order) rowChoices.set(draftPrefix(location.order, action), field.value)
      message = ''; patchFrame()
      document.querySelector<HTMLInputElement>('[data-central-field="quantity"]')?.focus()
    }
    return true
  }
  if (event?.type !== 'click') return true
  const nav = target.closest<HTMLElement>('[data-central-nav]')
  if (nav && !saving) { navigate(nav.dataset.centralNav!); return true }
  const control = target.closest<HTMLElement>('[data-central-action]')
  if (!control || (control instanceof HTMLButtonElement && control.disabled)) return true
  const action = control.dataset.centralAction, value = control.dataset.centralValue || ''
  if (saving && action !== 'photo' && action !== 'overlay-close') return true
  switch (action) {
    case 'language': centralSession.language = centralSession.language === 'zh' ? 'id' : 'zh'; message = ''; saveCentralSessionPreference(); patchFrame(); break
    case 'operation': {
      const { factories, operations } = context()
      {
        const language = centralSession.language, accessoryNames = ['盘扣', '花朵']
        const accessory = operations.filter(operation => accessoryNames.some(name => operation.operationName.includes(name)))
        const others = operations.filter(operation => !accessory.includes(operation))
        const direct = (path: string, zh: string, id: string) => `<button type="button" class="min-h-12 rounded-xl border bg-white p-3 text-base font-semibold" data-central-nav="${path}">${language === 'zh' ? zh : id}</button>`
        const select = (operation: typeof operations[number]) => cb(centralOperationLabel(operation.operationName, language), 'operation-select', operation.operationId, operation.operationId === centralSession.currentOperation)
        showOverlay(`<h2 class="mb-2 text-lg font-bold">${ct(language, 'factory')}</h2><div class="grid gap-2">${factories.map(factory => cb(centralFormalName(factory.name, factory.id, language), 'factory', factory.id, factory.id === centralSession.currentFactory)).join('')}</div>
          <h2 class="my-3 text-lg font-bold">${language === 'zh' ? '辅料' : 'Aksesori'}</h2>
          <div class="grid gap-2">${accessory.map(select).join('')}${direct(`/fcs/pda/central/lace/${locate().tab}`, '花边', 'Renda')}${direct(`/fcs/pda/central/webbing/${locate().tab}`, '织带', 'Bis')}${direct(`/fcs/pda/central/post/${locate().tab}`, '后整', 'Finishing')}</div>
          <h2 class="my-3 text-lg font-bold">${language === 'zh' ? '其他工序' : 'Proses lain'}</h2>
          <div class="grid gap-2">${others.map(select).join('')}${direct(`/fcs/pda/central/cut/${locate().tab}?factoryId=${ce(centralSession.currentFactory)}`, '裁床', 'Potong')}${direct(`/fcs/pda/central/binding/${locate().tab}`, '捆条', 'Bis')}${direct('/fcs/pda/central/wool/receive', '毛织', 'Rajut')}${direct('/fcs/pda/central/dye/receive', '染色', 'Pencelupan')}${direct(`/fcs/pda/central/print/${locate().tab}`, '印花', 'Pencetakan')}${direct(`/fcs/pda/central/wash/${locate().tab}`, '洗水', 'Pencucian')}</div>`)
        break
      }
    }
    case 'factory': {
      if (!listCentralSpecialFactories(value).some(factory => factory.id === value)) break
      centralSession.currentFactory = value; centralSession.account = undefined; centralSession.currentOperation = ''; context(); saveCentralSessionPreference(); selectedLimit = 15
      navigate(centralPdaTabPath(locate().tab)); break
    }
    case 'operation-select': {
      if (!listCentralSpecialOperations(centralSession.currentFactory).some(operation => operation.operationId === value)) break
      centralSession.currentOperation = value; saveCentralSessionPreference(); selectedLimit = 15; navigate(centralPdaTabPath(locate().tab)); break
    }
    case 'order': {
      const order = getCentralSpecialOrder(value, centralSession.currentFactory, centralSession.currentOperation)
      if (order) navigate(orderPath(order, locate().tab, locate().tab === 'receive' ? 'receive' : 'detail'))
      break
    }
    case 'view': {
      const location = locate()
      if (location.order && location.tab !== 'receive' && ['work', 'handoff', 'finish', 'receipt'].includes(value)) {
        message = ''; currentViewOverride = { orderId: location.order.taskOrderId, view: value as CentralSpecialView }
        // Modes stay in the same order and history entry; business inputs remain keyed by object/action.
        patchFrame()
        if (value === 'work' || value === 'handoff') document.querySelector<HTMLInputElement>('[data-central-field="quantity"]')?.focus()
      }
      break
    }
    case 'scan': identify(); break
    case 'save': await submit(); break
    case 'clear': {
      const input = document.querySelector<HTMLInputElement>('[data-central-field="quantity"]')
      if (input && !input.disabled) { input.value = ''; setQuantity(''); input.focus() }
      break
    }
    case 'next': navigate(centralPdaTabPath(locate().tab)); break
    case 'more': selectedLimit += 15; patchFrame(); break
    case 'reload':
      try {
        await ensureSpecialCraftRecords(true); message = ''
        const location = locate()
        if (location.order) {
          formRevision = getSpecialCraftActionRevision(location.order)
          for (const action of ['receive', 'work', 'handoff'] as const) {
            for (const row of centralSpecialQuantityRows(location.order, action, centralSession.language)) {
              const draft = drafts.get(draftKey(location.order, action, row))
              if (draft?.committed && draft.intent && hasSavedSpecialCraftCommand(draft.operationId, draft.intent)) drafts.delete(draftKey(location.order, action, row))
              else if (draft && !draft.committed) draft.revision = formRevision
            }
          }
        }
        patchFrame()
      }
      catch (error) { message = centralErrorText(error, centralSession.language); messageError = true; patchFrame() }
      break
    case 'warehouse-view': case 'warehouse-kind': case 'warehouse-location': case 'warehouse-more': {
      const selection = warehouseChoices.get(`${centralSession.currentFactory}|${centralSession.currentOperation}`)
      if (!selection) break
      if (action === 'warehouse-view' && ['locations', 'receiveRecords', 'handoffRecords'].includes(value)) selection.view = value as CentralWarehouseSelection['view']
      if (action === 'warehouse-kind' && ['WAIT_PROCESS', 'WAIT_HANDOVER'].includes(value)) { selection.kind = value as CentralWarehouseSelection['kind']; selection.locationId = undefined }
      if (action === 'warehouse-location') selection.locationId = selection.locationId === value ? undefined : value
      if (action === 'warehouse-more') selection.limit += 15
      patchFrame(); break
    }
    case 'photo':
      if (failedPhotos.has(value)) {
        failedPhotos.delete(value)
        const img = [...document.querySelectorAll<HTMLImageElement>('[data-central-photo]')].find(img => img.getAttribute('src') === value)
        if (img) { img.src = value; img.hidden = false }
        control.querySelector('[data-central-photo-error]')?.remove()
      } else if (/^(?:https?:\/\/|\/)/.test(value)) showOverlay(`<img src="${ce(value)}" alt="${ct(centralSession.language, 'photo')}" class="max-h-[70dvh] w-full object-contain">`)
      break
    case 'overlay-close': closeCentralPdaOverlay(); break
    case 'logout':
      if (hasCentralDrafts()) showOverlay(`<p class="mb-3">${ct(centralSession.language, 'unsent')}</p><div class="grid gap-2">${cb(ct(centralSession.language, 'cancel'), 'overlay-close')}${cb(ct(centralSession.language, 'discard'), 'logout-confirm')}</div>`)
      else logout()
      break
    case 'logout-confirm': logout(); break
    case 'login': {
      const login = document.querySelector<HTMLInputElement>('[data-central-login="account"]')?.value || ''
      loginName = login
      const password = document.querySelector<HTMLInputElement>('[data-central-login="password"]')?.value || ''
      const user = readFactoryPdaExecutionUsers().find(user => normalizePdaLoginId(user.loginId) === normalizePdaLoginId(login))
      if (!user || !verifyPdaPassword(password, user.passwordHash)) { message = ct(centralSession.language, 'loginFail'); messageError = true; patchFrame(); break }
      if (user.status !== 'ACTIVE') { message = ct(centralSession.language, 'locked'); messageError = true; patchFrame(); break }
      if (!listCentralSpecialFactories(user.factoryId).some(factory => factory.id === user.factoryId)) { message = ct(centralSession.language, 'centralOnly'); messageError = true; patchFrame(); break }
      discardCentralDrafts(); centralSession.account = user; centralSession.currentFactory = centralSession.account.factoryId; centralSession.signedOut = false; loginName = ''; drafts.clear(); rowChoices.clear(); context(); saveCentralSessionPreference(); navigate(centralPdaTabPath('receive')); break
    }
  }
  return true
}
function logout() {
  discardCentralDrafts()
  centralSession.signedOut = true; centralSession.account = undefined; drafts.clear(); rowChoices.clear(); warehouseChoices.clear(); scanValue = ''; message = ''; messageError = false
  loginName = ''; saveCentralSessionPreference(); navigate(centralPdaTabPath('receive'))
}
let mounted = false
export function mountCentralPdaPage() {
  const size = () => {
    const root = document.querySelector<HTMLElement>('[data-central-pda-root]')
    if (root) root.style.height = `${Math.round(window.visualViewport?.height || window.innerHeight)}px`
  }
  if (!mounted) {
    mounted = true
    window.visualViewport?.addEventListener('resize', size)
    window.addEventListener('resize', size)
    window.addEventListener('beforeunload', event => {
      if ([...drafts.values()].some(draft => !draft.committed && !!draft.raw.trim()) && document.querySelector('[data-central-pda-root]')) { event.preventDefault(); event.returnValue = '' }
    })
  }
  document.querySelectorAll<HTMLImageElement>('[data-central-photo]').forEach(img => {
    const src = img.getAttribute('src') || ''
    const loaded = () => { loadedPhotos.add(src); failedPhotos.delete(src); updateFooter() }
    const failed = () => {
      loadedPhotos.delete(src); failedPhotos.add(src); img.hidden = true
      const button = img.closest('button')
      if (button && !button.querySelector('[data-central-photo-error]')) {
        button.insertAdjacentHTML('beforeend', `<span data-central-photo-error class="text-xs text-red-700">${ct(centralSession.language, 'photoFailed')}</span>`)
      }
      updateFooter()
    }
    img.onload = loaded; img.onerror = failed
    if (img.complete) { if (img.naturalWidth) loaded(); else failed() }
  })
  size()
  const scan = document.querySelector<HTMLInputElement>('[data-central-field="scan"]')
  if (scan && !scan.disabled && !document.querySelector('[data-central-overlay]')) scan.focus({ preventScroll: true })
  else if (!messageError && document.activeElement === document.body && !document.querySelector('[data-central-overlay]')) document.querySelector<HTMLInputElement>('[data-central-field="quantity"]:not(:disabled)')?.focus()
}
