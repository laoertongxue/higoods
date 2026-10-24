// @page-pattern: pda
import { appStore } from '../../state/store.ts'
import { localDateTimeText } from '../../utils.ts'
import { hydrateIcons } from '../../components/shell.ts'
import { readFactoryPdaExecutionUsers, normalizePdaLoginId, verifyPdaPassword } from '../../data/fcs/store-domain-pda.ts'
import { listFactoryReceipts, type FactoryReceiptInput } from '../../data/fcs/factory-receiving.ts'
import { withFactoryProcessStaticRead } from '../../data/fcs/factory-process-storage.ts'
import { calculateYarnWeight } from '../../data/fcs/yarn-weight.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { isCentralPdaFactory } from '../../data/fcs/pda-experience-scope.ts'
import { ensureSpecialCraftRecords, hasSavedSpecialCraftCommand } from '../../data/fcs/special-craft-records.ts'
import { listCentralDyeFactories, listCentralDyeFacts, listCentralDyeIncoming, getCentralDyeFact,
  centralDyeReceiptLocations, prepareCentralDyeReceipt, saveCentralDyeReceipt, centralDyeProcessingChoice, centralDyeProcessingRevision,
  saveCentralDyeProcessing, centralDyeVatOptions, centralDyeDownstream, centralDyeReceiver, type CentralDyeIncoming } from './dye-model.ts'
import { renderCentralPdaFrame, type CentralPdaFrameInput, type CentralPdaTab } from './frame.ts'
import { centralSession as session, ensureCentralSessionAccount, saveCentralSessionPreference,
  registerCentralDraftDiscard, discardCentralDrafts, hasCentralDrafts } from './session.ts'
import { cb, ce, cn, ct, centralFormalName, centralTime, centralNotice } from './ui.ts'
import { renderCentralOperationMenu } from './operation-menu.ts'
import { pdaEmpty, pdaUi } from '../pda-mobile-ui.ts'
import { dt, dyeErrorText, dyeNumber, translateDyeNumber, dyeLocationLabel, dyeSpecification, dyeSourcePerson, dyeProcessingLabel, dyePartnerLabel } from './dye-ui.ts'
import { centralDyeOutput, centralDyeDispatch, centralDyeLabelRevision, resolveCentralDyeOutputScan, saveCentralDyeRoll,
  printCentralDyeRolls, deleteCentralDyeRoll, stageCentralDyeRoll, addCentralDyeDispatchRoll, confirmCentralDyeDispatch, voidCentralDyeDispatch } from './dye-output-model.ts'
import { renderCentralDyeOutput, centralDyeOutputFooter, rollEditorInput, outputButton, type OutputUi, type TransportDraft, type RollFields, type RollEditor } from './dye-output-view.ts'
import { renderCentralDyeRollLabel } from './dye-output-label.ts'
import { ot, outputError, outputUnit } from './dye-output-text.ts'
import { renderCentralDyeWarehouse, type DyeWarehouseUi } from './dye-warehouse-view.ts'
import { isDyeYarnOrder } from '../../data/fcs/dyeing-task-domain.ts'
import { centralDyeYarn, prepareCentralDyeYarn, saveCentralDyeYarn } from './dye-yarn-model.ts'
import { centralDyeCompletion, saveCentralDyeCompletion } from './dye-completion-model.ts'
import { centralDyeWater, saveCentralDyeWater } from './dye-water-model.ts'
import { dwt, renderCentralDyeWater, centralDyeWaterFooter, dyeWaterInput, dyeWaterError, dyeWaterReasonNeeded, renderDyeWaterHistory, type DyeWaterUi } from './dye-water-view.ts'
import { yt, yarnError, yarnInput, yarnSummary, renderCentralDyeYarn, centralDyeYarnFooter, renderCentralDyeYarnLabel, type YarnUi } from './dye-yarn-view.ts'

const prefix = '/fcs/pda/central/dye'
const drafts = new Map<string, { fields: Record<string, string>; operationId: string; receivedAt: string; input?: FactoryReceiptInput }>()
const choices = new Map<string, { sourceKey?: string; barcode?: string }>()
const receiptPositions = new Map<string, string>()
const processingDrafts = new Map<string, { raw: string; operationId: string; revision: string; intent?: string }>()
const vatChoices = new Map<string, string>(), executionViews = new Map<string, 'work' | 'output' | 'receipt'>()
const outputStates = new Map<string, OutputUi & { pending?: { key: string; id: string } }>(), outputTransports = new Map<string, TransportDraft>()
const outputEditors = new Map<string, RollEditor>(), outputRecoveries = new Map<string, () => Promise<void>>()
const yarnStates = new Map<string, YarnUi>()
const completionStates = new Map<string, { operationId: string; completedAt: string; revision: string }>()
const waterStates = new Map<string, DyeWaterUi>(), waterViews = new Set<string>()
const loadedPhotos = new Set<string>(), failedPhotos = new Set<string>()
let path = '', scan = '', message = '', errorMessage = false, saving = false, limit = 15
const warehouseUi: DyeWarehouseUi = { kind: 'input', area: '', location: '', view: 'locations' }
let mounted = false, generation = 0
registerCentralDraftDiscard(() => { drafts.clear(); choices.clear(); receiptPositions.clear(); processingDrafts.clear(); vatChoices.clear(); executionViews.clear(); scan = ''; message = ''; warehouseUi.area = ''; warehouseUi.location = '' }, () => drafts.size > 0 || processingDrafts.size > 0)
registerCentralDraftDiscard(() => { outputStates.clear(); outputTransports.clear(); outputEditors.clear(); outputRecoveries.clear() }, () => [...outputEditors.values()].some(editor => JSON.stringify(editor.fields) !== editor.initial) || [...outputTransports.values()].some(draft => JSON.stringify(draft.fields) !== draft.initial))
registerCentralDraftDiscard(() => yarnStates.clear(), () => [...yarnStates.values()].some(ui => Object.values(ui.fields).some(raw => raw.trim())))
registerCentralDraftDiscard(() => completionStates.clear(), () => false)
registerCentralDraftDiscard(() => { waterStates.clear(); waterViews.clear() }, () => [...waterStates.values()].some(ui => !!(ui.raw.trim() || ui.reason.trim() || ui.decision)))
const lang = () => session.language
const tabPath = (tab: CentralPdaTab) => `${prefix}/${tab}`
const text = (key: Parameters<typeof ct>[1]) => ct(lang(), key)
const dyeText = (key: Parameters<typeof dt>[1]) => dt(lang(), key)
// A confirmation must retain the original quantity's precision, unlike summaries.
const exactQuantity = (value: number) => new Intl.NumberFormat(lang() === 'id' ? 'id-ID' : 'zh-CN', { maximumFractionDigits: 20 }).format(value)
function route() {
  const url = new URL(path || tabPath('receive'), 'https://pda.local'), parts = url.pathname.split('/')
  const tab: CentralPdaTab = ['receive', 'execute', 'warehouse'].includes(parts[5]) ? parts[5] as CentralPdaTab : 'receive'
  let orderId = ''
  try { orderId = decodeURIComponent(parts[6] || '') } catch { /* Invalid links never identify an order. */ }
  return { tab, orderId, fact: getCentralDyeFact(orderId, session.currentFactory) }
}
function scope(orderId: string) { return [session.currentFactory, session.account?.userId, 'DYE', orderId].join('|') }
const activeRoot = () => document.querySelector<HTMLElement>('[data-central-pda-root][data-central-family="dye"]')
function outputUi() {
  const key = scope(route().orderId)
  if (!outputStates.has(key)) outputStates.set(key, { panel: 'list', limit: 15, scan: '' })
  return outputStates.get(key)!
}
function yarnUi() {
  const key = scope(route().orderId)
  if (!yarnStates.has(key)) yarnStates.set(key, { fields: { gross: '', PAPER: '', CONICAL: '', PAGODA: '' }, showingLabel: false, labelVersion: 0 })
  return yarnStates.get(key)!
}
function waterContext() {
  const state = centralDyeWater(route().orderId, session.currentFactory)
  const key = state ? [scope(route().orderId), 'water', state.batch, state.phase, state.node?.startedAt || ''].join('|') : ''
  const active = !!state?.phase && (state.mandatory || waterViews.has(scope(route().orderId)))
  if (active && !waterStates.has(key)) waterStates.set(key, { raw: '', reason: '', decision: '', revision: state!.revision })
  return { state, key, active, ui: waterStates.get(key) }
}
function transportDraft() {
  const doc = centralDyeDispatch(outputUi().docId || '', session.currentFactory)
  if (!doc || doc.status !== '草稿') return undefined
  const key = [session.currentFactory, session.account?.userId, doc.id].join('|')
  if (!outputTransports.has(key)) { const fields = { ...doc.transport }; outputTransports.set(key, { fields, initial: JSON.stringify(fields), operationId: crypto.randomUUID() }) }
  return outputTransports.get(key)!
}
function outputFooter() {
  if (outputRecoveries.has(scope(route().orderId))) return { action: 'output-recover', label: text('reload'), disabled: saving }
  const fact = route().fact, ui = outputUi(), state = centralDyeOutput(route().orderId, session.currentFactory)
  const images = ui.panel === 'dispatch' ? centralDyeDispatch(ui.docId || '', session.currentFactory)?.lines.map(line => centralDyeOutput(line.orderId, session.currentFactory)?.material.imageUrl || '') || [] : [state?.material.imageUrl || '']
  if (state?.isYarn) return centralDyeYarnFooter(route().orderId, session.currentFactory, yarnUi(), lang(), saving, images.every(src => !!src && loadedPhotos.has(src) && !failedPhotos.has(src)))
  return fact ? centralDyeOutputFooter(route().orderId, session.currentFactory, outputUi(), transportDraft(), lang(), saving,
    images.length > 0 && images.every(src => !!src && loadedPhotos.has(src) && !failedPhotos.has(src))) : undefined
}
function selection() {
  const { orderId } = route(), key = scope(orderId)
  const sources = listCentralDyeIncoming(session.currentFactory, orderId)
  if (!choices.has(key)) choices.set(key, {})
  const choice = choices.get(key)!
  const source = sources.find(item => item.key === choice.sourceKey) || (!choice.sourceKey ? sources.find(item => item.remainingRolls.length || item.line.material.kind !== 'FABRIC') || sources[0] : undefined)
  if (source && !choice.sourceKey) choice.sourceKey = source.key
  const roll = source?.line.rolls.find(item => item.barcode === choice.barcode)
    || (!choice.barcode ? source?.remainingRolls[0] : undefined)
  if (roll && !choice.barcode) choice.barcode = roll.barcode
  const keyPhysical = source ? [key, source.key, roll?.barcode || source.line.material.sku].join('|') : ''
  const draft = drafts.get(keyPhysical)
  return { source, sources, choice, roll, key: keyPhysical, position: receiptPositions.get(keyPhysical), draft }
}
function positions() { return centralDyeReceiptLocations(session.currentFactory) }
function positionKey(position: ReturnType<typeof positions>[number]) { return position.warehouse.warehouseId + '|' + position.location.locationId }
function numberField(name: string, label: string, value: string, integer = false) {
  return `<label class="my-3 block text-base font-semibold" for="dye-${ce(name)}">${ce(label)}</label><input id="dye-${ce(name)}" data-central-dye-field="${ce(name)}" inputmode="${integer ? 'numeric' : 'decimal'}" enterkeyhint="next" autocomplete="off" type="text" value="${ce(value)}" class="min-h-14 w-full rounded-xl border border-slate-400 bg-white px-3 py-3 text-2xl font-bold"${saving ? ' disabled' : ''}>`
}
function sourceIdentity(source: CentralDyeIncoming) {
  const material = source.line.material
  const name = centralFormalName(material.name, material.sku, lang())
  return `<article class="mb-3 rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-start gap-3">${material.imageUrl ? `<button type="button" data-central-action="photo" data-central-value="${ce(material.imageUrl)}" aria-label="${text('photo')}" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border"><img data-central-dye-photo src="${ce(material.imageUrl)}" alt="${ce(name)}" class="h-full w-full object-contain"></button>` : ''}<div class="min-w-0"><strong class="break-words">${ce(name)}</strong><p class="break-words text-sm text-slate-600">${ce(material.sku)}</p><p class="break-words text-sm">${dyeText('batch')} · ${ce(material.batchNo)}</p><p class="break-words text-sm">${dyeText('specification')} · ${ce(dyeSpecification(material.specification, material.sku, lang()))}</p></div></div><p class="mt-2 break-words text-sm">${text('source')} · <strong>${ce(dyePartnerLabel(source.source.origin, lang()))}</strong><br>${ce(source.source.documentNo)} · ${ce(dyeSourcePerson(source.source.createdBy, lang()))}</p></article>${material.imageUrl ? '' : centralNotice(text('noPhoto'), true)}`
}
function scanForm() {
  return `<label class="block px-1 text-[13px] font-medium leading-5 text-[#62748a]" for="dye-scan">${text('scan')}</label><div class="flex gap-2"><input id="dye-scan" data-central-dye-field="scan" autocomplete="off" inputmode="text" enterkeyhint="search" placeholder="${dyeText('scanHint')}" value="${ce(scan)}" class="h-14 min-w-0 flex-1 rounded-xl border border-[#bdcadb] bg-white px-3 text-[15px] text-[#1a293c] outline-none focus:border-[#2461ed]"><button type="button" class="min-h-14 shrink-0 rounded-xl bg-[#2461ed] px-4 text-[15px] font-semibold text-white" data-central-action="scan">${text('identify')}</button></div>`
}
function receiptInput(): FactoryReceiptInput {
  const { source, roll, position: selectedPosition, draft } = selection(), actor = session.account
  if (!source || !actor || !draft) throw new Error('DYE_quantityRequired')
  if (draft.input) return draft.input
  const position = positions().find(item => positionKey(item) === selectedPosition)
  if (!position) throw new Error('DYE_locationRequired')
  const location = { warehouseId: position.warehouse.warehouseId, locationId: position.location.locationId }
  const line: FactoryReceiptInput['lines'][number] = { sourceId: source.source.id, sourceLineId: source.line.id, ...location }
  const parse = (key: string, decimals: number | null = 3, zero = false) => dyeNumber(draft.fields[key] || '', lang(), decimals, zero)
  if (source.line.material.kind === 'FABRIC') {
    if (!roll) throw new Error('DYE_wrongRoll')
    if (!source.remainingRolls.some(item => item.barcode === roll.barcode)) throw new Error('DYE_duplicateRoll')
    line.rolls = [{ barcode: roll.barcode, ...location, yard: parse('quantity', null) }]
  } else if (source.line.material.kind === 'WOOL_PIECE') {
    line.businessQty = parse('quantity', 0); line.businessUnit = '片'
  } else if (source.line.material.kind === 'YARN') {
    line.grossKg = parse('gross', 3, true)
    line.tubes = Object.fromEntries(['paper', 'conical', 'pagoda'].map(key => [key.toUpperCase(), dyeNumber(draft.fields[key] || '0', lang(), 0, true)])) as NonNullable<typeof line.tubes>
    line.pcs = line.tubes.PAPER + line.tubes.CONICAL + line.tubes.PAGODA
    calculateYarnWeight(line.grossKg, line.tubes, line.pcs)
  } else if (source.line.measurementBasis === 'CONTINUOUS_LENGTH') {
    line.businessQty = parse('quantity', 3, true); line.businessUnit = '米'
  } else {
    line.weightKg = parse('quantity', 3, true)
    if (!['kg', '公斤', '千克'].includes(source.line.unit)) {
      line.businessQty = parse('businessQty', null, true); line.businessUnit = source.line.unit
    }
  }
  return { id: draft.operationId, factoryId: session.currentFactory, operatorName: actor.name, operatorId: actor.userId,
    receivedAt: draft.receivedAt, remark: '', lines: [line] }
}
function footer(): CentralPdaFrameInput['primary'] {
  if (outputRecoveries.has(scope(route().orderId))) return { action: 'output-recover', label: text('reload'), disabled: saving }
  if (route().tab === 'execute' && executionViews.get(scope(route().orderId)) !== 'output'
    && centralDyeCompletion(route().orderId, session.currentFactory)?.ready) return { action: 'complete-request', label: dyeText('completeDocument'), disabled: saving }
  if (route().tab === 'execute' && executionViews.get(scope(route().orderId)) === 'output') return outputFooter()
  if (route().tab === 'execute') return processingFooter()
  const { source } = selection()
  let valid = false
  let context: string | undefined
  try {
    if (route().tab === 'receive' && source && !saving && session.account && loadedPhotos.has(source.line.material.imageUrl) && !failedPhotos.has(source.line.material.imageUrl)) {
      const line = prepareCentralDyeReceipt(route().orderId, receiptInput(), session.account).lines[0]
      const actual = `${exactQuantity(line.qty)} ${centralDyeUnit(line.unit)}`
      context = line.businessQty !== undefined && line.businessUnit && line.businessUnit !== line.unit
        ? `${exactQuantity(line.businessQty)} ${centralDyeUnit(line.businessUnit)} · ${actual}`
        : `${line.material.kind === 'YARN' ? dyeText('net').split(' · ')[0] + ' ' : ''}${actual}`
      valid = true
    }
  } catch { /* The field/submit guard retains the original input. */ }
  return { action: 'save', label: saving ? text('saving') : dyeText('onlyReceive'), context, disabled: !valid }
}
function processing() {
  const { orderId } = route(), choice = centralDyeProcessingChoice(orderId, session.currentFactory)
  const key = choice ? [scope(orderId), choice.expectedBatch, choice.nodeCode, choice.phase].join('|') : ''
  return { choice, key, draft: processingDrafts.get(key) }
}
function processingFooter(): CentralPdaFrameInput['primary'] {
  const water = waterContext()
  if (water.active && water.state && water.ui && executionViews.get(scope(route().orderId)) !== 'receipt') return centralDyeWaterFooter(water.state, water.ui, lang(), saving,
    !!route().fact?.imageUrl && loadedPhotos.has(route().fact!.imageUrl) && !failedPhotos.has(route().fact!.imageUrl))
  const { choice, draft } = processing(), fact = route().fact
  if (!choice || !fact || executionViews.get(scope(fact.order.dyeOrderId)) === 'receipt') return undefined
  let valid = !saving && !!session.account && loadedPhotos.has(fact.imageUrl) && !failedPhotos.has(fact.imageUrl)
  let amount: number | undefined = choice.max
  if (choice.phase === 'COMPLETE' || choice.nodeCode === 'DYE') {
    try { const qty = dyeNumber(draft?.raw || '', lang(), null, choice.phase === 'COMPLETE'); valid = valid && qty <= choice.max; amount = qty <= choice.max ? qty : undefined }
    catch { valid = false; amount = undefined }
  }
  if (choice.nodeCode === 'DYE' && choice.phase === 'START') valid = valid && !!vatChoices.get(scope(fact.order.dyeOrderId))
  return { action: 'save', label: saving ? text('saving') : dyeProcessingLabel(lang(), choice.nodeCode, choice.phase), context: amount === undefined ? undefined : `${exactQuantity(amount)} ${centralDyeUnit(fact.order.qtyUnit)}`, disabled: !valid }
}
function processingForm() {
  const water = waterContext()
  if (water.active && water.state && water.ui) return renderCentralDyeWater(water.state, water.ui, lang())
    + (water.state.mandatory ? '' : `<div class="my-3">${cb(dwt(lang(), 'back'), 'water-back')}</div>`)
  const { choice, draft } = processing(), { fact } = route()
  if (fact?.order.status === 'COMPLETED') return `<article data-central-dye-completed class="my-3 rounded-xl border bg-white p-3"><strong>${dyeText('completedDocument')}</strong><p class="mt-2 break-words">${dyeText('completedBy')} · ${ce(centralFormalName(fact.order.documentCompletedBy, fact.order.documentCompletedByUserId || fact.order.documentCompletedBy || '—', lang()))}</p><p>${ce(centralTime(fact.order.documentCompletedAt || '', lang()))}</p></article>`
  const completion = fact && centralDyeCompletion(fact.order.dyeOrderId, session.currentFactory)
  if (completion?.ready) return `<p data-central-dye-completion-ready class="my-3 text-lg">${text('actual')} <strong>${cn(completion.receivedQty, lang())} ${ce(centralDyeUnit(fact!.order.qtyUnit))}</strong></p>`
  if (!choice || !fact) return (water.state?.phase === 'START' ? `<div class="my-3">${cb(dwt(lang(), 'newInput'), 'water-next', undefined, true)}</div>` : centralNotice(fact && ['WAIT_SAMPLE', 'SAMPLE_TESTING', 'SAMPLE_DONE', 'WAIT_MATERIAL', 'INPUT_RECEIVED'].includes(fact.order.status) ? dyeText('waitPreparation') : text('notAvailable')))
  // The original command archives the finished batch only when the next DYE starts.
  const currentNodes = fact.nodes.slice(fact.order.completedExecutionBatches?.flat().length || 0)
  const nextBatch = choice.nodeCode === 'DYE' && choice.phase === 'START' && currentNodes.some(node => node.nodeCode === 'PACK' && node.finishedAt)
  const batchNumber = choice.expectedBatch + (nextBatch ? 2 : 1)
  let content = `<h2 class="my-3 text-lg font-bold" data-central-dye-node="${choice.nodeCode}" data-central-dye-phase="${choice.phase}">${dyeProcessingLabel(lang(), choice.nodeCode, choice.phase)}</h2><p class="mb-2">${dyeText('currentBatch')} ${cn(batchNumber, lang())}</p>`
  if (choice.nodeCode === 'DYE' && choice.phase === 'START') content += `<label class="my-2 block font-bold" for="dye-vat">${dyeText('vat')}</label><select id="dye-vat" data-central-dye-field="vat" class="min-h-12 w-full rounded-xl border bg-white p-3"><option value="">${dyeText('vat')}</option>${centralDyeVatOptions(session.currentFactory).map(vat => `<option value="${ce(vat.dyeVatNo)}"${vatChoices.get(scope(fact.order.dyeOrderId)) === vat.dyeVatNo ? ' selected' : ''}>${ce(vat.dyeVatNo)}</option>`).join('')}</select>`
  content += `<p class="my-3">${text('remaining')} <strong data-central-dye-processing-remaining>${cn(choice.max, lang())} ${ce(centralDyeUnit(fact.order.qtyUnit))}</strong></p>`
  if (choice.phase === 'COMPLETE' || choice.nodeCode === 'DYE') content += numberField('workQuantity', `${dyeText(choice.phase === 'START' ? 'batchInput' : 'batchOutput')} · ${centralDyeUnit(fact.order.qtyUnit)}`, draft?.raw || '') + `<div class="my-3">${cb(text('clear'), 'clear')}</div>`
  content += `<p data-central-dye-field-error role="alert" class="my-2 text-red-700"></p>`
  return content + (water.state?.phase === 'START' && !water.state.mandatory ? `<div class="my-3">${cb(dwt(lang(), 'newInput'), 'water-next')}</div>` : '')
}
function receiveForm() {
  const { source, sources, position: selectedPosition, roll, draft } = selection()
  if (!source) return centralNotice(dyeText('emptyIncoming'))
  const values = draft?.fields || {}, fabric = source.line.material.kind === 'FABRIC'
  let html = sourceIdentity(source)
  if (sources.length > 1) html += `<label class="mb-2 block font-semibold" for="dye-source">${dyeText('chooseSource')}</label><select id="dye-source" data-central-dye-field="source" class="mb-3 min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3">${sources.map(item => `<option value="${ce(item.key)}"${source.key === item.key ? ' selected' : ''}>${ce(item.source.documentNo)} · ${ce(item.line.material.sku)}</option>`).join('')}</select>`
  if (fabric) {
    html += `<label class="mb-2 block font-semibold" for="dye-roll">${dyeText('origin')}</label><select id="dye-roll" data-central-dye-field="roll" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3">${source.line.rolls.filter(item => item.barcode === roll?.barcode || source.remainingRolls.some(row => row.barcode === item.barcode)).map(item => `<option value="${ce(item.barcode)}"${roll?.barcode === item.barcode ? ' selected' : ''}>${ce(item.barcode)}</option>`).join('')}</select>`
    if (roll && !source.remainingRolls.some(item => item.barcode === roll.barcode)) return html + centralNotice(dyeText('receivedRoll')) + `<div class="mt-3">${cb(text('next'), 'next')}</div>`
    html += numberField('quantity', dyeText('actualYard'), values.quantity || '')
  } else if (source.line.material.kind === 'WOOL_PIECE') {
    html += numberField('quantity', `${text('thisQty')} · ${centralDyeUnit('片')}`, values.quantity || '', true)
  } else if (source.line.material.kind === 'YARN') {
    html += numberField('gross', dyeText('gross'), values.gross || '')
    for (const key of ['paper', 'conical', 'pagoda'] as const) html += numberField(key, dyeText(key), values[key] || '0', true)
    html += `<p class="mt-2 text-lg font-bold" data-central-dye-net></p>`
  } else {
    html += numberField('quantity', dyeText(source.line.measurementBasis === 'CONTINUOUS_LENGTH' ? 'meters' : 'weight'), values.quantity || '')
    if (source.line.measurementBasis !== 'CONTINUOUS_LENGTH' && !['kg', '公斤', '千克'].includes(source.line.unit)) html += numberField('businessQty', `${dyeText('businessQty')} · ${centralDyeUnit(source.line.unit)}`, values.businessQty || '')
  }
  html += `<label class="my-3 block text-base font-semibold" for="dye-position">${text('location')}</label><select id="dye-position" data-central-dye-field="position" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">${dyeText('locationRequired')}</option>${positions().map(item => `<option value="${ce(positionKey(item))}"${positionKey(item) === selectedPosition ? ' selected' : ''}>${ce(dyeLocationLabel(item.area.areaName, lang()))} / ${ce(dyeLocationLabel(item.shelf.shelfNo, lang()))} / ${ce(dyeLocationLabel(item.location.locationNo, lang()))}</option>`).join('')}</select><p role="alert" data-central-dye-field-error class="mt-2 text-base text-red-700"></p><div class="my-3 grid grid-cols-2 gap-2">${cb(text('clear'), 'clear')}${cb(text('next'), 'next')}</div>`
  return html
}
function centralDyeUnit(unit: string) {
  return outputUnit(unit, lang())
}
function receipts(orderId?: string) {
  return withFactoryProcessStaticRead(() => listFactoryReceipts(session.currentFactory).flatMap(receipt => receipt.lines.filter(line => line.dyeOrderId && (!orderId || line.dyeOrderId === orderId)).map(line => ({ receipt, line }))))
}
function receiveHistory(orderId?: string, locationId?: string) {
  const rows = receipts(orderId).filter(({ line }) => !locationId || line.locationId === locationId).sort((a, b) => Date.parse(b.receipt.receivedAt.replace(' ', 'T')) - Date.parse(a.receipt.receivedAt.replace(' ', 'T')))
  return (rows.slice(0, limit).map(({ receipt, line }) => `<article class="my-3 rounded-xl border border-slate-200 bg-white p-3"><strong class="break-words">${ce(line.sourceDocumentNo)}</strong><p class="break-words">${ce(line.material.sku)} · ${ce(line.material.batchNo)}</p><p class="text-lg font-bold">${cn(line.qty, lang())} ${ce(centralDyeUnit(line.unit))}</p>${line.rolls?.map(roll => `<p class="break-words text-sm">${ce(roll.barcode)} · ${cn(roll.yard, lang())} Yard</p>`).join('') || ''}<p class="break-words text-sm">${text('receiver')} · ${ce(centralFormalName(receipt.operatorName, receipt.operatorId, lang()))}</p><p class="text-sm text-slate-600">${ce(centralTime(receipt.receivedAt, lang()))}</p></article>`).join('') || centralNotice(text('noRecords'))) + (rows.length > limit ? cb(text('more'), 'more') : '')
}
function receiptView(orderId?: string) {
  const facts = listCentralDyeFacts(session.currentFactory).filter(fact => !orderId || fact.order.dyeOrderId === orderId)
  return facts.flatMap(fact => fact.records.map(record => `<article class="my-3 rounded-xl border border-slate-200 bg-white p-3"><strong>${ce(fact.order.dyeOrderNo)}</strong><p class="break-words">${ce(record.handoverRecordNo || record.handoverRecordId || record.recordId)}</p><p class="mt-2">${text('handed')} <strong>${cn(record.submittedQty || 0, lang())} ${ce(centralDyeUnit(fact.order.qtyUnit))}</strong></p><p>${text('sender')} · ${ce(centralFormalName(record.factorySubmittedBy, record.factorySubmittedByUserId || record.factorySubmittedBy || '—', lang()))}</p><p class="text-sm text-slate-600">${ce(centralTime(record.factorySubmittedAt || '', lang()))}</p><p class="mt-2">${text('actual')} <strong>${cn(record.receiverWrittenQty || 0, lang())} ${ce(centralDyeUnit(fact.order.qtyUnit))}</strong></p><p class="break-words text-sm">${record.receiverWrittenAt ? `${text('receiver')} · ${ce(centralFormalName(record.receiverWrittenBy, centralDyeReceiver(record).id, lang()))} · ${ce(centralTime(record.receiverWrittenAt, lang()))}` : text('awaiting')}</p></article>`)).join('') || centralNotice(text('noRecords'))
}
function warehouseContent() {
  return renderCentralDyeWarehouse(session.currentFactory, warehouseUi, lang(), limit, kind => kind === 'receive' ? receiveHistory() : receiptView())
}
function loginForm() {
  return `<label class="my-2 block" for="dye-login">${text('account')}</label><input id="dye-login" data-central-login="account" autocomplete="username" class="min-h-12 w-full rounded-xl border bg-white p-3"><label class="my-2 block" for="dye-password">${text('password')}</label><input id="dye-password" data-central-login="password" autocomplete="current-password" type="password" class="min-h-12 w-full rounded-xl border bg-white p-3"><div class="mt-3">${cb(text('login'), 'login', undefined, true)}</div>`
}
function frame(): CentralPdaFrameInput {
  const { tab, orderId, fact } = route(), factory = getFactoryMasterRecordById(session.currentFactory)
  const base: CentralPdaFrameInput = { family: 'dye', language: lang(), accountName: session.account ? centralFormalName(session.account.name, session.account.loginId, lang()) : text('account'), accountNo: '', factoryName: centralFormalName(factory?.name, factory?.code || session.currentFactory, lang()), operationName: dyeText('dye'), tab, tabPathPrefix: prefix, content: '' }
  const recovering = outputRecoveries.has(scope(orderId))
  const feedback = recovering ? dyeErrorText(new Error('操作已保存，但页面未能更新，请重新读取后查看。'), lang()) : message
  let content = feedback ? `<div data-central-feedback class="mb-3">${centralNotice(feedback, recovering || errorMessage)}${errorMessage && !recovering ? cb(text('reload'), 'reload') : ''}</div>` : ''
  if (session.signedOut || !session.account) return { ...base, heading: text('login'), backPath: tabPath('receive'), content: content + loginForm() }
  if (orderId) {
    base.backPath = tabPath(tab); base.heading = tab === 'receive' ? dyeText('onlyReceive') : text('detail')
    if (!fact) return { ...base, content: centralNotice(text('wrongScan'), true) }
    content += `<p class="mb-3 break-words text-base font-bold">${ce(fact.order.dyeOrderNo)}</p>`
    if (tab === 'receive') { content += scanForm() + receiveForm(); base.primary = footer() }
    else {
      const view = executionViews.get(scope(orderId)) || 'work'
      const output = view === 'output' ? centralDyeOutput(orderId, session.currentFactory) : undefined
      const image = output ? output.material.imageUrl : fact.imageUrl, sku = output ? output.material.sku : fact.outputSku || fact.rawSku, name = output ? output.material.name : fact.materialName
      content += `<article class="mb-3 rounded-xl border bg-white p-3">${view === 'work' ? `<p class="mb-2 text-sm font-semibold">${dyeText('targetMaterial')}</p>` : ''}<div class="flex items-start gap-3">${image ? `<button type="button" data-central-action="photo" data-central-value="${ce(image)}" aria-label="${text('photo')}" class="h-14 w-14 shrink-0 rounded border"><img data-central-dye-photo src="${ce(image)}" alt="${ce(sku)}" class="h-full w-full object-contain"></button>` : centralNotice(text('noPhoto'), true)}<div class="min-w-0"><strong class="block break-words">${ce(centralFormalName(name, sku, lang()))}</strong>${centralFormalName(name, sku, lang()) === sku ? '' : `<p class="break-words text-sm">${ce(sku)}</p>`}</div></div>${view === 'work' && fact.rawSku !== sku ? `<p class="mt-2 break-words text-sm text-slate-600">${dyeText('inputMaterial')} · ${ce(fact.rawSku)}</p>` : ''}</article>`
      if (!(view === 'work' && waterContext().active) && (view !== 'output' || !isDyeYarnOrder(fact.order))) content += `<dl class="grid grid-cols-2 gap-2 rounded-xl border bg-white p-3">${(view === 'output' ? [['outputLeft', fact.availableOutput]] : [['received', fact.received], ['used', fact.used], ['inputLeft', fact.availableInput], ['outputLeft', fact.availableOutput]]).map(([key, value]) => `<dt>${dyeText(key as 'received')}</dt><dd class="font-bold">${cn(Number(value), lang())} ${ce(centralDyeUnit(fact.order.qtyUnit))}</dd>`).join('')}</dl>`
      content += `<div class="my-3 grid grid-cols-3 gap-2">${cb(text('work'), 'execution-view', 'work', view === 'work')}${cb(isDyeYarnOrder(fact.order) ? yt(lang(), 'title') : ot(lang(), 'output'), 'execution-view', 'output', view === 'output')}${cb(text('receipt'), 'execution-view', 'receipt', view === 'receipt')}</div>`
      if (view !== 'output') {
        try { const target = centralDyeDownstream(orderId); content += `<p class="my-3 break-words">${text('target')} · <strong>${ce(dyePartnerLabel(target, lang()))}</strong></p>` } catch { /* No fabricated destination. Actual handoff remains blocked by the domain. */ }
      }
      if (view === 'output' && !isDyeYarnOrder(fact.order) && outputUi().panel !== 'dispatch') {
        try { content += `<p class="my-3 break-words">${text('target')} · <strong>${ce(dyePartnerLabel(centralDyeDownstream(orderId), lang()))}</strong></p>` } catch { /* No invented destination. */ }
      }
      content += view === 'work' ? processingForm() : view === 'output' ? isDyeYarnOrder(fact.order) ? renderCentralDyeYarn(orderId, session.currentFactory, yarnUi(), lang()) : renderCentralDyeOutput(orderId, session.currentFactory, outputUi(), transportDraft(), lang()) : receiptView(orderId)
      if (view === 'work') {
        const water = waterContext()
        if (water.active && water.state?.phase === 'COMPLETE') content += `<div class="my-3">${cb(text('clear'), 'water-clear')}</div>`
        if (water.state) content += renderDyeWaterHistory(water.state, lang())
      }
      base.primary = footer()
      content += `<details class="mt-3"><summary class="min-h-12 py-3 font-bold">${dyeText('receiptDetails')}</summary>${receiveHistory(orderId)}</details>`
    }
  } else if (tab === 'warehouse') content += warehouseContent()
  else {
    content += scanForm()
    const incoming = listCentralDyeIncoming(session.currentFactory)
    const rows = listCentralDyeFacts(session.currentFactory).filter(row => tab !== 'receive' || incoming.some(item => item.orderId === row.order.dyeOrderId && (item.line.material.kind !== 'FABRIC' || item.remainingRolls.length)))
    content += rows.slice(0, limit).map(row => {
      const sources = incoming.filter(item => item.orderId === row.order.dyeOrderId)
      const material = tab === 'receive' ? sources[0]?.line.material : undefined
      const name = material?.name || row.materialName, sku = material?.sku || row.outputSku || row.rawSku
      const fabric = sources.some(item => item.line.material.kind === 'FABRIC')
      const summary = tab === 'receive' && fabric
        ? `${dyeText('rollCount')} ${cn(sources.reduce((n, item) => n + item.remainingRolls.length, 0), lang())}`
        : `${dyeText(tab === 'receive' ? 'received' : 'inputLeft')} ${cn(tab === 'receive' ? row.received : row.availableInput, lang())} ${ce(centralDyeUnit(row.order.qtyUnit))}`
      return `<button type="button" data-central-action="order" data-central-value="${ce(row.order.dyeOrderId)}" class="${pdaUi.card} mb-2 flex w-full items-start gap-3 p-3 text-left"><img src="${ce(material?.imageUrl || row.imageUrl)}" alt="${ce(sku)}" class="h-16 w-16 shrink-0 rounded-lg border border-[#e2e6ec] bg-[#f1f3f6] object-contain"><span class="min-w-0 flex-1"><strong class="block break-words text-[16px] font-semibold leading-6 text-[#1a293c]">${ce(row.order.dyeOrderNo)}</strong><span class="mt-1 block break-words text-[13px] leading-5 text-[#62748a]">${ce(centralFormalName(name, sku, lang()))}</span><span class="mt-2 block text-[14px] leading-5 text-[#1a293c]">${summary}</span></span><span class="shrink-0 self-center text-[#8090a4]" aria-hidden="true">›</span></button>`
    }).join('') || pdaEmpty(text('empty'))
    if (rows.length > limit) content += `<button type="button" class="${pdaUi.secondaryButton}" data-central-action="more">${text('more')}</button>`
  }
  base.content = content
  return base
}
function patch() {
  const root = activeRoot()
  if (!root) return
  const focused = document.activeElement as HTMLInputElement | null, focusAttribute = focused?.dataset.centralWaterField ? 'data-central-water-field' : focused?.dataset.centralYarnField ? 'data-central-yarn-field' : focused?.dataset.centralDyeField ? 'data-central-dye-field' : 'data-central-output-field'
  const focusName = focused?.getAttribute(focusAttribute), caret = focused?.selectionStart
  const template = document.createElement('template'); template.innerHTML = renderCentralPdaFrame(frame())
  const next = template.content.firstElementChild!, scroll = root.querySelector('[data-central-content]')!.scrollTop
  root.lang = next.getAttribute('lang') || ''
  for (const selector of [':scope > header', '[data-central-heading]', '[data-central-content]', '[data-central-footer]', ':scope > nav']) {
    const old = root.querySelector(selector), replacement = next.querySelector(selector)
    if (replacement && old) old.replaceWith(replacement)
    else if (old) old.remove()
    else if (replacement) root.append(replacement)
  }
  root.querySelector('[data-central-content]')!.scrollTop = scroll
  hydrateIcons(root); mountCentralDyePage()
  if (focusName) { const next = root.querySelector<HTMLInputElement>(`[${focusAttribute}="${focusName}"]`); next?.focus({ preventScroll: true }); if (caret !== null && caret !== undefined) next?.setSelectionRange(caret, caret) }
}
function refreshFooter() {
  if (!activeRoot()) return
  const button = activeRoot()!.querySelector<HTMLButtonElement>('[data-central-footer] button'), value = footer()
  if (button && value) {
    button.disabled = !!value.disabled
    if (button.firstChild?.textContent !== value.label || (button.querySelector(':scope > span')?.textContent || '') !== (value.context || '')) {
      button.textContent = value.label
      if (value.context) {
        const quantity = document.createElement('span'); quantity.className = 'block text-base leading-6'; quantity.textContent = value.context
        button.append(quantity)
      }
    }
  }
  const water = waterContext(), waterError = activeRoot()!.querySelector('[data-central-water-error]')
  if (waterError && water.state && water.ui) {
    waterError.textContent = ''
    const note = activeRoot()!.querySelector<HTMLElement>('[data-central-water-reason]')
    if (note) note.hidden = !dyeWaterReasonNeeded(water.state, water.ui.raw, lang())
    if (water.ui.raw.trim() || water.ui.decision) try { dyeWaterInput(water.state, water.ui, lang()) }
    catch (error) { waterError.textContent = dyeWaterError(error, lang()) || dyeErrorText(error, lang()) }
  }
  const outputFeedback = activeRoot()!.querySelector('[data-central-output-error]'), editor = outputStates.get(scope(route().orderId))?.editor
  if (outputFeedback) {
    outputFeedback.textContent = ''
    if (editor?.fields.qty.trim()) try { rollEditorInput(editor, lang()) } catch (error) { outputFeedback.textContent = outputError(error, lang()) }
  }
  const yarnFeedback = activeRoot()!.querySelector('[data-central-yarn-error]'), yarnState = yarnStates.get(scope(route().orderId))
  if (yarnFeedback && yarnState) {
    yarnFeedback.textContent = ''; const summary = activeRoot()!.querySelector('[data-central-yarn-summary]')
    if (summary) summary.innerHTML = ''
    if (yarnState.fields.gross.trim()) try {
      if (summary) summary.innerHTML = yarnSummary(yarnState, lang())
      prepareCentralDyeYarn(route().orderId, yarnInput(yarnState, lang()), session.currentFactory)
    } catch (error) { yarnFeedback.textContent = yarnError(error, lang()) || dyeErrorText(error, lang()) }
  }
  if (route().tab === 'receive' && selection().source?.line.material.kind === 'YARN') {
    const output = document.querySelector('[data-central-dye-net]')
    try {
      const input = receiptInput().lines[0], weight = calculateYarnWeight(input.grossKg!, input.tubes!, input.pcs)
      if (output) output.textContent = `${dyeText('net')} ${cn(weight.netGrams / 1000, lang())}`
    } catch { if (output) output.textContent = '' }
  }
  const feedback = document.querySelector('[data-central-dye-field-error]')
  if (feedback) {
    feedback.textContent = ''
    try {
      if (route().tab === 'execute') {
        const { choice, draft } = processing()
        if (choice && draft?.raw.trim()) {
          const qty = dyeNumber(draft.raw, lang(), null, choice.phase === 'COMPLETE')
          if (qty > choice.max) throw new Error('QUANTITY_MAX')
        }
      } else if (route().tab === 'receive') {
        const { source, draft, position } = selection(), fields = draft?.fields
        if (fields && source) {
          if (fields.quantity?.trim()) dyeNumber(fields.quantity, lang(), source.line.material.kind === 'WOOL_PIECE' ? 0 : source.line.material.kind === 'FABRIC' ? null : 3, !['FABRIC', 'WOOL_PIECE'].includes(source.line.material.kind))
          if (fields.gross?.trim()) dyeNumber(fields.gross, lang(), 3, true)
          for (const key of ['paper', 'conical', 'pagoda']) if (fields[key]?.trim()) dyeNumber(fields[key], lang(), 0, true)
          if (fields.businessQty?.trim()) dyeNumber(fields.businessQty, lang(), null, true)
          if (position && session.account) {
            try { prepareCentralDyeReceipt(route().orderId, receiptInput(), session.account) }
            catch (error) { if (!(error instanceof Error) || error.message !== 'DYE_quantityRequired') throw error }
          }
        }
      }
    } catch (error) { feedback.textContent = dyeErrorText(error, lang()) }
  }
  const focused = document.activeElement, content = activeRoot()?.querySelector('[data-central-content]')
  if (focused instanceof HTMLElement && focused.matches('[data-central-dye-field]') && content?.contains(focused) && focused.getClientRects().length) {
    const input = focused.getBoundingClientRect(), visible = content.getBoundingClientRect()
    if (input.top < visible.top || input.bottom > visible.bottom) focused.scrollIntoView({ block: 'nearest' })
  }
}
function navigate(next: string) {
  closeCentralDyeOverlay(); message = ''; errorMessage = false; scan = ''; path = next
  if (appStore.getState().pathname === next) { patch(); return }
  const root = activeRoot()
  if (root) {
    root.dataset.centralNavigating = 'true'; root.setAttribute('aria-busy', 'true')
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select').forEach(control => { control.disabled = true })
  }
  appStore.navigate(next)
}
function overlay(content: string, footerClose = true) {
  closeCentralDyeOverlay()
  const element = document.createElement('div'); element.dataset.centralOverlay = ''
  element.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-2'
  element.innerHTML = `<section role="dialog" aria-modal="true" class="flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white"><div class="min-h-0 space-y-2 overflow-y-auto p-3">${content}</div>${footerClose ? `<div class="border-t p-3">${cb(text('close'), 'overlay-close')}</div>` : ''}</section>`
  document.querySelector('[data-central-pda-root]')?.append(element); element.querySelector<HTMLButtonElement>('button')?.focus()
}
export function closeCentralDyeOverlay() { const node = document.querySelector('[data-central-overlay]'); if (!node) return false; node.remove(); return true }
function identify() {
  const code = scan.trim()
  if (!code) { message = text('noScan'); errorMessage = true; patch(); return }
  if (route().tab === 'execute') {
    const yarn = listCentralDyeFacts(session.currentFactory).filter(fact => isDyeYarnOrder(fact.order) && code === `YARN:${fact.order.dyeOrderNo}`)
    if (yarn.length === 1) { executionViews.set(scope(yarn[0].order.dyeOrderId), 'output'); navigate(`${tabPath('execute')}/${encodeURIComponent(yarn[0].order.dyeOrderId)}`); return }
    const outputs = resolveCentralDyeOutputScan(code, session.currentFactory)
    if (outputs.length === 1) {
      const next = outputs[0], key = scope(next.orderId)
      outputStates.set(key, { ...(outputStates.get(key) || { limit: 15, scan: '' }), panel: 'roll', rollId: next.roll.id })
      executionViews.set(key, 'output'); navigate(`${tabPath('execute')}/${encodeURIComponent(next.orderId)}`); return
    }
  }
  const incoming = listCentralDyeIncoming(session.currentFactory)
  const facts = listCentralDyeFacts(session.currentFactory)
  const matches = incoming.filter(item => item.source.id === code || item.source.documentNo === code || item.source.workOrderNo === code || item.line.rolls.some(roll => roll.barcode === code)
    || facts.some(fact => fact.order.dyeOrderId === item.orderId && [fact.order.dyeOrderId, fact.order.dyeOrderNo].includes(code)))
  const ids = [...new Set(matches.map(item => item.orderId))]
  if (!ids.length) { message = text('wrongScan'); errorMessage = true; patch(); document.querySelector<HTMLInputElement>('[data-central-dye-field="scan"]')?.select(); return }
  if (ids.length > 1) { overlay(ids.map(id => cb(facts.find(fact => fact.order.dyeOrderId === id)!.order.dyeOrderNo, 'order', id)).join('')); return }
  const source = matches.find(item => item.line.rolls.some(roll => roll.barcode === code)) || matches[0]
  const key = scope(source.orderId), choice = choices.get(key) || {}
  choice.sourceKey = source.key
  const roll = source.line.rolls.find(roll => roll.barcode === code)
  choice.barcode = roll?.barcode; choices.set(key, choice)
  navigate(`${tabPath(route().tab === 'warehouse' ? 'receive' : route().tab)}/${encodeURIComponent(source.orderId)}`)
}
function setField(name: string, raw: string) {
  const { key, draft } = selection()
  if (!key) return
  if ((draft?.fields[name] || '') === raw) return
  const values = { ...(draft?.fields || {}), [name]: raw }
  if (Object.values(values).some(value => value.trim())) drafts.set(key, { fields: values, operationId: draft?.operationId || `FRP-${crypto.randomUUID()}`, receivedAt: draft?.receivedAt || localDateTimeText() })
  else drafts.delete(key)
  message = ''; errorMessage = false; document.querySelector('[data-central-feedback]')?.remove()
  const error = document.querySelector('[data-central-dye-field-error]'); if (error) error.textContent = ''
  refreshFooter()
}
function setBusy(value: boolean) {
  saving = value
  const root = activeRoot()
  root?.setAttribute('aria-busy', String(value))
  if (value) root?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(control => { control.disabled = true })
  refreshFooter()
}
function clearOutputFeedback() {
  message = ''; errorMessage = false; activeRoot()?.querySelector('[data-central-feedback]')?.remove()
}
function openRollEditor(id?: string) {
  const state = centralDyeOutput(route().orderId, session.currentFactory), ui = outputUi(), roll = state?.rolls.find(r => r.id === id)
  if (!state || (id && !roll)) throw new Error('DYE_OUTPUT_wrongRoll')
  if (roll?.dispatchId || roll?.reservedBy) throw new Error('DYE_OUTPUT_unavailable')
  // Returning to the same editor restores input; selecting a different physical roll never copies it.
  const editorKey = scope(route().orderId) + '|' + (id || 'new')
  if (!outputEditors.has(editorKey)) {
    const number = (value: number) => String(value).replace('.', lang() === 'id' ? ',' : '.')
    const fields: RollFields = { qty: roll ? number(roll.qty) : '', weightKg: roll ? number(roll.weightKg) : '',
      widthCm: number(roll?.widthCm ?? state.defaults.widthCm), gsm: number(roll?.gsm ?? state.defaults.gsm),
      vatNo: roll?.vatNo ?? state.fact.nodes.filter(node => node.nodeCode === 'DYE').at(-1)?.dyeVatNo ?? '', remark: roll?.remark || '' }
    outputEditors.set(editorKey, { id, fields, initial: JSON.stringify(fields), revision: id ? centralDyeLabelRevision(route().orderId, id, session.currentFactory) : undefined, operationId: crypto.randomUUID() })
  }
  ui.editor = outputEditors.get(editorKey)
  ui.rollId = id; ui.panel = 'edit'; clearOutputFeedback(); patch()
  activeRoot()?.querySelector<HTMLInputElement>('[data-central-output-field="qty"]')?.focus()
}
function outputPending(action: string, input: unknown) {
  const ui = outputUi(), key = JSON.stringify([action, input])
  if (ui.pending?.key !== key) ui.pending = { key, id: crypto.randomUUID() }
  return ui.pending!.id
}
async function commitOutput<T>(run: () => Promise<T>, done: (value: T) => void, formatError = outputError) {
  const current = scope(route().orderId), currentPath = path, ui = outputUi()
  const same = () => !!activeRoot() && scope(route().orderId) === current && currentPath === path
  try {
    setBusy(true); const result = await run()
    // Durable success belongs to the captured physical record, even after native Back.
    if (outputStates.get(current) === ui) { done(result); ui.pending = undefined; outputRecoveries.delete(current) }
    if (same()) { message = text('saved'); errorMessage = false }
  } catch (error) {
    if (error instanceof Error && error.message.includes('已保存，但页面未能更新') && outputStates.get(current) === ui) outputRecoveries.set(current, () => commitOutput(run, done, formatError))
    if (same()) { message = formatError(error, lang()); errorMessage = true }
  }
  finally {
    setBusy(false); patch()
    if (same() && errorMessage) activeRoot()?.querySelector<HTMLElement>('[data-central-feedback]')?.scrollIntoView({ block: 'nearest' })
  }
}
async function handleOutputAction(action: string, value = '') {
  const { orderId } = route(), ui = outputUi(), actor = session.account, factoryId = session.currentFactory
  if (!actor || saving) return
  try {
    if (action === 'recover') { await outputRecoveries.get(scope(orderId))?.(); return }
    if (outputRecoveries.has(scope(orderId))) return
    if (action.startsWith('yarn-')) {
      const current = yarnUi()
      if (action === 'yarn-clear') { current.fields = { gross: '', PAPER: '', CONICAL: '', PAGODA: '' }; current.operationId = undefined; current.handedOverAt = undefined; clearOutputFeedback(); patch(); activeRoot()?.querySelector<HTMLInputElement>('[data-central-yarn-field="gross"]')?.focus() }
      if (action === 'yarn-label') { if (!centralDyeYarn(orderId, factoryId)?.records.length) throw new Error('YARN_notReady'); current.showingLabel = true; clearOutputFeedback(); patch() }
      if (action === 'yarn-back') { current.showingLabel = false; clearOutputFeedback(); patch() }
      if (action === 'yarn-save') {
        const input = yarnInput(current, lang()); prepareCentralDyeYarn(orderId, input, factoryId)
        current.operationId ||= `YC-${crypto.randomUUID()}`; current.handedOverAt ||= localDateTimeText()
        const operationId = current.operationId, at = current.handedOverAt
        await commitOutput(() => saveCentralDyeYarn(orderId, input, actor, operationId, at), () => { current.fields = { gross: '', PAPER: '', CONICAL: '', PAGODA: '' }; current.operationId = undefined; current.handedOverAt = undefined }, (error, language) => yarnError(error, language) || dyeErrorText(error, language)); return
      }
      if (action === 'yarn-print') {
        const frame = activeRoot()?.querySelector<HTMLIFrameElement>('[data-central-yarn-label]'), doc = frame?.contentDocument
        if (!doc?.querySelector('svg') || !doc.images.length || [...doc.images].some(img => !img.complete || !img.naturalWidth)) throw new Error('YARN_loadingLabel')
        const originalPath = path, originalScope = scope(orderId), preview = frame!.srcdoc
        try {
          setBusy(true); await ensureSpecialCraftRecords(true)
          if (path !== originalPath || scope(route().orderId) !== originalScope || !frame!.isConnected) return
          if (preview !== renderCentralDyeYarnLabel(orderId, factoryId, current.labelVersion, lang())) throw new Error('YARN_labelChanged')
          frame!.contentWindow!.focus(); frame!.contentWindow!.print()
        } finally { setBusy(false); patch() }
      }
      return
    }
    if (action === 'add' || action === 'edit') { openRollEditor(action === 'edit' ? value || ui.rollId : undefined); return }
    if (action === 'list') { ui.panel = 'list'; ui.scan = ''; ui.lastBarcode = undefined; ui.print = undefined; clearOutputFeedback(); patch(); return }
    if (action === 'roll') { ui.rollId = value; ui.panel = 'roll'; ui.print = undefined; clearOutputFeedback(); patch(); return }
    if (action === 'document') { if (!centralDyeDispatch(value, factoryId)) throw new Error('DYE_OUTPUT_wrongDocument'); ui.docId = value; ui.panel = 'dispatch'; ui.scan = ''; ui.lastBarcode = undefined; clearOutputFeedback(); patch(); return }
    if (action === 'more') { ui.limit += 15; patch(); return }
    if (action === 'clear') {
      if (ui.editor) { for (const key of Object.keys(ui.editor.fields) as (keyof RollFields)[]) ui.editor.fields[key] = ''; ui.editor.initial = JSON.stringify(ui.editor.fields); ui.editor.operationId = crypto.randomUUID() }
      clearOutputFeedback(); patch(); activeRoot()?.querySelector<HTMLInputElement>('[data-central-output-field="qty"]')?.focus(); return
    }
    if (action === 'save' && ui.editor) {
      const editor = ui.editor, input = rollEditorInput(editor, lang())
      const key = scope(orderId) + '|' + (editor.id || 'new')
      await commitOutput(() => saveCentralDyeRoll(orderId, input, actor, editor.operationId, editor.revision), ids => { outputEditors.delete(key); ui.editor = undefined; ui.rollId = ids[0]; ui.panel = 'roll' }); return
    }
    if (action === 'preview') {
      const id = value || ui.rollId || '', roll = centralDyeOutput(orderId, factoryId)?.rolls.find(r => r.id === id)
      if (!roll || !(roll.qty > 0) || roll.reservedBy || roll.dispatchId) throw new Error('DYE_OUTPUT_unavailable')
      ui.rollId = id; ui.print = { revision: centralDyeLabelRevision(orderId, id, factoryId), attempted: false, operationId: crypto.randomUUID() }; ui.panel = 'print'; clearOutputFeedback(); patch(); return
    }
    if (action === 'print-browser') {
      const frame = activeRoot()?.querySelector<HTMLIFrameElement>('[data-central-output-label]'), doc = frame?.contentDocument
      if (!doc?.querySelector('svg') || ![...doc.images].length || [...doc.images].some(img => !img.complete || !img.naturalWidth)) throw new Error('DYE_OUTPUT_printLoading')
      if (!ui.print || ui.print.revision !== centralDyeLabelRevision(orderId, ui.rollId || '', factoryId)) throw new Error('DYE_OUTPUT_printChanged')
      frame!.contentWindow!.focus(); frame!.contentWindow!.print(); ui.print.attempted = true; clearOutputFeedback(); patch(); return
    }
    if (action === 'print-confirm' && ui.print?.attempted && ui.rollId) {
      const print = ui.print, id = ui.rollId
      await commitOutput(() => printCentralDyeRolls(orderId, [id], actor, print.operationId, { [id]: print.revision }), () => { ui.print = undefined; ui.panel = 'roll' }); return
    }
    if (action === 'stage' && value) {
      const operationId = outputPending(action, value)
      await commitOutput(() => stageCentralDyeRoll(orderId, value, actor, operationId), () => {}); return
    }
    if (action === 'dispatch' && ui.rollId) {
      const id = ui.rollId, operationId = outputPending(action, id)
      await commitOutput(() => addCentralDyeDispatchRoll(orderId, id, actor, operationId), docId => { ui.docId = docId; ui.panel = 'dispatch'; ui.scan = ''; ui.lastBarcode = undefined }); return
    }
    if (action === 'scan') {
      const code = ui.scan.trim(), matches = resolveCentralDyeOutputScan(code, factoryId)
      if (!code) throw new Error('DYE_OUTPUT_scanEmpty')
      if (matches.length !== 1) throw new Error('DYE_OUTPUT_wrongRoll')
      const match = matches[0], docId = ui.panel === 'dispatch' ? ui.docId : match.roll.reservedBy
      if (match.roll.dispatchId) throw new Error('DYE_OUTPUT_alreadySent')
      const operationId = outputPending(action, [code, docId || ''])
      await commitOutput(() => addCentralDyeDispatchRoll(match.orderId, match.roll.id, actor, operationId, { docId, scannedBarcode: code }), next => { ui.docId = next; ui.panel = 'dispatch'; ui.scan = ''; ui.lastBarcode = code })
      activeRoot()?.querySelector<HTMLInputElement>('[data-central-output-field="scan"]')?.select(); return
    }
    if (action === 'confirm-dispatch') {
      const docId = ui.docId || '', draft = transportDraft(), transportKey = [factoryId, actor.userId, docId].join('|')
      if (!draft) throw new Error('DYE_OUTPUT_wrongDocument')
      const fields = { ...draft.fields }
      await commitOutput(() => confirmCentralDyeDispatch(docId, fields, actor, draft.operationId), () => { outputTransports.delete(transportKey); ui.scan = '' }); return
    }
    if (action === 'delete-request' || action === 'void-request') {
      overlay(`<h2 class="mb-3 break-all text-lg font-bold">${ce(action === 'delete-request' ? centralDyeOutput(orderId, factoryId)?.rolls.find(r => r.id === value)?.barcode || value : value)}</h2><p class="mb-3">${ot(lang(), action === 'delete-request' ? 'deleteWarning' : 'voidWarning')}</p>${outputButton(ot(lang(), action === 'delete-request' ? 'deleteConfirm' : 'voidConfirm'), action === 'delete-request' ? 'delete-confirm' : 'void-confirm', value, true)}`); return
    }
    if (action === 'delete-confirm') {
      const operationId = outputPending(action, value); closeCentralDyeOverlay()
      const key = scope(orderId) + '|' + value
      await commitOutput(() => deleteCentralDyeRoll(orderId, value, actor, operationId), () => { outputEditors.delete(key); ui.panel = 'list'; if (ui.editor?.id === value) ui.editor = undefined; ui.rollId = undefined }); return
    }
    if (action === 'void-confirm') {
      const operationId = outputPending(action, value); closeCentralDyeOverlay()
      await commitOutput(() => voidCentralDyeDispatch(value, actor, operationId), () => { outputTransports.delete([factoryId, actor.userId, value].join('|')); ui.scan = '' }); return
    }
  } catch (error) { message = action.startsWith('yarn-') ? yarnError(error, lang()) || dyeErrorText(error, lang()) : outputError(error, lang()); errorMessage = true; patch(); activeRoot()?.querySelector<HTMLInputElement>('[data-central-output-field="scan"]')?.select() }
}
function setOutputField(name: string, value: string) {
  if (outputRecoveries.has(scope(route().orderId))) { patch(); return }
  const ui = outputUi()
  if (name === 'scan') { ui.scan = value; ui.pending = undefined; ui.lastBarcode = undefined; activeRoot()?.querySelector('[data-central-output-last-scan]')?.remove() }
  else if (ui.panel === 'edit' && ui.editor && name in ui.editor.fields) { ui.editor.fields[name as keyof RollFields] = value; ui.editor.operationId = crypto.randomUUID() }
  else {
    const draft = transportDraft()
    if (draft && name in draft.fields) { draft.fields[name as keyof TransportDraft['fields']] = value; draft.operationId = crypto.randomUUID() }
  }
  clearOutputFeedback(); refreshFooter()
}
async function submit() {
  if (outputRecoveries.has(scope(route().orderId))) return
  if (route().tab === 'execute') { await submitProcessing(); return }
  const { orderId } = route(), { key, draft } = selection(), actor = session.account
  if (saving || !actor || !draft) return
  try {
    const input = receiptInput()
    prepareCentralDyeReceipt(orderId, input, actor)
    // Freeze the exact physical receipt/timestamp for a committed-readback retry.
    draft.input = input
    await commitOutput(() => saveCentralDyeReceipt(orderId, input, actor), () => drafts.delete(key), dyeErrorText)
  } catch (error) { message = dyeErrorText(error, lang()); errorMessage = true; patch() }
}
async function submitProcessing() {
  const { choice, key, draft } = processing(), actor = session.account
  if (!choice || !actor || saving) return
  try {
    const qty = choice.phase === 'COMPLETE' || choice.nodeCode === 'DYE' ? dyeNumber(draft?.raw || '', lang(), null, choice.phase === 'COMPLETE') : undefined
    if (!processingDrafts.has(key)) processingDrafts.set(key, { raw: '', operationId: crypto.randomUUID(), revision: centralDyeProcessingRevision(choice.dyeOrderId, session.currentFactory) })
    const current = processingDrafts.get(key)!, { max, ...action } = choice
    const input = { ...action, qty, dyeVatNo: choice.nodeCode === 'DYE' && choice.phase === 'START' ? vatChoices.get(scope(choice.dyeOrderId)) : undefined }
    current.intent = JSON.stringify({ input, actorId: actor.userId, revision: current.revision })
    await commitOutput(() => saveCentralDyeProcessing(input, actor, current.operationId, current.revision), () => processingDrafts.delete(key), dyeErrorText)
  } catch (error) { message = dyeErrorText(error, lang()); errorMessage = true; patch() }
}
async function submitWater() {
  const { state, ui, key } = waterContext(), { orderId } = route(), actor = session.account, current = scope(orderId)
  if (!state || !ui || !actor || saving) return
  try {
    const input = dyeWaterInput(state, ui, lang())
    ui.operationId ||= crypto.randomUUID(); ui.revision ||= state.revision
    await commitOutput(() => saveCentralDyeWater(orderId, input, actor, ui.operationId!, ui.revision!), () => { waterStates.delete(key); waterViews.delete(current) }, (error, language) => dyeWaterError(error, language) || dyeErrorText(error, language))
  } catch (error) { message = dyeWaterError(error, lang()) || dyeErrorText(error, lang()); errorMessage = true; patch() }
}
export async function renderCentralDyePage(next: string, isCurrent = () => true) {
  const run = ++generation
  path = next
  try {
    await ensureSpecialCraftRecords()
    if (run !== generation || !isCurrent()) return ''
    const requested = new URL(next, 'https://pda.local').searchParams.get('factoryId'), factories = listCentralDyeFactories()
    const factoryId = [requested, session.currentFactory, session.preference.factoryId, 'ID-F003', ...factories.map(factory => factory.id)].find(id => {
      const factory = id && getFactoryMasterRecordById(id)
      return factory && factory.status === 'active' && isCentralPdaFactory(factory)
    }) || ''
    ensureCentralSessionAccount(factoryId); session.currentOperation = 'DYE'; saveCentralSessionPreference()
    return renderCentralPdaFrame(frame())
  } catch (error) {
    if (run !== generation || !isCurrent()) return ''
    const factory = getFactoryMasterRecordById(session.currentFactory)
    return renderCentralPdaFrame({ family: 'dye', language: lang(),
      accountName: session.account ? centralFormalName(session.account.name, session.account.loginId, lang()) : text('account'), accountNo: '',
      factoryName: centralFormalName(factory?.name, factory?.code || session.currentFactory, lang()), operationName: dyeText('dye'),
      tab: route().tab, tabPathPrefix: prefix, content: centralNotice(dyeText('readFailed'), true),
      primary: { action: 'reload', label: text('reload') } })
  }
}
export async function handleCentralDyeEvent(target: Element, event?: Event) {
  if (!target.closest('[data-central-pda-root]') || target.closest('[data-central-navigating]')) return false
  if (event?.type === 'keydown') {
    const key = (event as KeyboardEvent).key
    if (key === 'F1') {
      event.preventDefault()
      if (saving) return true
      closeCentralDyeOverlay()
      if (outputRecoveries.has(scope(route().orderId))) activeRoot()?.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus()
      else {
        const scan = activeRoot()?.querySelector<HTMLInputElement>('[data-central-dye-field="scan"], [data-central-output-field="scan"]')
        if (scan && !scan.disabled) { scan.focus(); scan.select(); scan.scrollIntoView({ block: 'nearest' }) }
        else if (route().orderId && route().tab !== 'warehouse') navigate(tabPath(route().tab))
      }
      return true
    }
    const modal = activeRoot()?.querySelector('[data-central-overlay]')
    if (key === 'Tab' && modal) {
      const controls = [...modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')].filter(control => control.getClientRects().length)
      const next = (controls.indexOf(document.activeElement as HTMLElement) + ((event as KeyboardEvent).shiftKey ? -1 : 1) + controls.length) % controls.length
      event.preventDefault(); controls[next]?.focus(); return true
    }
    if (key === 'Enter' && target.matches('[data-central-login]')) {
      event.preventDefault()
      if (!(event as KeyboardEvent).repeat && !saving) {
        if (target.matches('[data-central-login="account"]')) {
          const password = activeRoot()?.querySelector<HTMLInputElement>('[data-central-login="password"]')
          password?.focus(); password?.scrollIntoView({ block: 'nearest' })
        } else activeRoot()?.querySelector<HTMLButtonElement>('[data-central-action="login"]')?.click()
      }
      return true
    }
    if (key === 'Escape' && !target.matches('select')) { event.preventDefault(); if (!closeCentralDyeOverlay() && route().orderId && !saving) navigate(tabPath(route().tab)) }
    if (key === 'Enter' && target.matches('[data-central-output-field="scan"]')) { event.preventDefault(); if (!saving) await handleOutputAction('scan') }
    else if (key === 'Enter' && target.matches('[data-central-output-field], [data-central-yarn-field], [data-central-water-field]')) {
      event.preventDefault(); const fields = [...activeRoot()!.querySelectorAll<HTMLInputElement>('[data-central-output-field], [data-central-yarn-field], [data-central-water-field]')].filter(input => !!input.getClientRects().length), index = fields.indexOf(target as HTMLInputElement)
      if (fields[index + 1]) fields[index + 1].focus(); else activeRoot()?.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus()
    }
    else if (key === 'Enter' && target.matches('[data-central-dye-field="scan"]')) { event.preventDefault(); if (!saving) identify() }
    else if (key === 'Enter' && target.matches('input[data-central-dye-field]')) {
      event.preventDefault()
      const fields = [...activeRoot()!.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[data-central-dye-field]:not([data-central-dye-field="scan"]), select[data-central-dye-field]')].filter(field => !field.disabled && field.getClientRects().length)
      const next = fields[fields.indexOf(target as HTMLInputElement) + 1]
      if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }) }
      else activeRoot()?.querySelector<HTMLButtonElement>('[data-central-footer] button')?.focus()
    }
    return true
  }
  const outputField = target.closest<HTMLInputElement>('[data-central-output-field]')
  if (outputField && ['input', 'change'].includes(event?.type || '') && !saving) { setOutputField(outputField.dataset.centralOutputField!, outputField.value); return true }
  const waterField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-central-water-field]')
  if (waterField && ['input', 'change'].includes(event?.type || '') && !saving) {
    const water = waterContext()
    if (outputRecoveries.has(scope(route().orderId)) || !water.ui || !water.state) { patch(); return true }
    const name = waterField.dataset.centralWaterField!
    if (name === 'quantity') {
      water.ui.raw = waterField.value
      try {
        dyeNumber(water.ui.raw, lang(), null, true)
        if (!dyeWaterReasonNeeded(water.state, water.ui.raw, lang())) { water.ui.reason = ''; const input = activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="reason"]'); if (input) input.value = '' }
      } catch { /* An unfinished decimal does not discard an already entered note. */ }
    } else if (name === 'reason' || name === 'decision') water.ui[name] = waterField.value
    water.ui.operationId = undefined; clearOutputFeedback(); refreshFooter(); return true
  }
  const yarnField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-central-yarn-field]')
  if (yarnField && ['input', 'change'].includes(event?.type || '') && !saving) {
    if (outputRecoveries.has(scope(route().orderId))) { patch(); return true }
    const current = yarnUi(), name = yarnField.dataset.centralYarnField!
    if (name === 'version') { if (event?.type === 'change') { current.labelVersion = Number(yarnField.value); clearOutputFeedback(); patch() } }
    else if (name in current.fields) { current.fields[name as keyof YarnUi['fields']] = yarnField.value; current.operationId = undefined; current.handedOverAt = undefined; clearOutputFeedback(); refreshFooter() }
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-central-dye-field]')
  if (field && ['input', 'change'].includes(event?.type || '') && !saving) {
    if (outputRecoveries.has(scope(route().orderId))) { patch(); return true }
    const name = field.dataset.centralDyeField!
    if (name === 'scan') scan = field.value
    else if (name === 'workQuantity') {
      const { key, draft } = processing()
      if ((draft?.raw || '') === field.value) return true
      if (field.value.trim()) processingDrafts.set(key, { raw: field.value, operationId: draft?.operationId || crypto.randomUUID(), revision: draft?.revision || centralDyeProcessingRevision(route().orderId, session.currentFactory) })
      else processingDrafts.delete(key)
      message = ''; errorMessage = false; document.querySelector('[data-central-feedback]')?.remove(); refreshFooter()
    }
    else if (name === 'vat') { vatChoices.set(scope(route().orderId), field.value); refreshFooter() }
    else if (['source', 'roll', 'position'].includes(name) && event?.type === 'change') {
      const { choice } = selection()
      if (name === 'source') { choice.sourceKey = field.value; choice.barcode = undefined }
      if (name === 'roll') choice.barcode = field.value
      if (name === 'position') {
        const current = selection(); receiptPositions.set(current.key, field.value); if (current.draft) current.draft.input = undefined
        message = ''; errorMessage = false; activeRoot()?.querySelector('[data-central-feedback]')?.remove(); refreshFooter(); return true
      }
      message = ''; errorMessage = false; patch()
    } else if (!['source', 'roll', 'position'].includes(name)) setField(name, field.value)
    return true
  }
  if (event?.type !== 'click') return true
  const outputAction = target.closest<HTMLButtonElement>('[data-central-output-action]')
  if (outputAction && !outputAction.disabled && !saving) { await handleOutputAction(outputAction.dataset.centralOutputAction!, outputAction.dataset.centralOutputValue); return true }
  const nav = target.closest<HTMLElement>('[data-central-nav]')
  if (nav && !saving) { navigate(nav.dataset.centralNav!); return true }
  const control = target.closest<HTMLButtonElement>('[data-central-action]')
  if (!control || control.disabled || saving) return true
  const value = control.dataset.centralValue || ''
  if (outputRecoveries.has(scope(route().orderId)) && ['save', 'clear', 'complete-request', 'complete-confirm', 'reload'].includes(control.dataset.centralAction || '')) return true
  if (control.dataset.centralAction?.startsWith('water-') && outputRecoveries.has(scope(route().orderId))) return true
  if (control.dataset.centralAction?.startsWith('output-')) { await handleOutputAction(control.dataset.centralAction.slice(7)); return true }
  switch (control.dataset.centralAction) {
    case 'language': {
      const from = lang(), to = from === 'id' ? 'zh' : 'id'
      for (const draft of drafts.values()) for (const key of Object.keys(draft.fields)) draft.fields[key] = translateDyeNumber(draft.fields[key], from, to)
      for (const draft of processingDrafts.values()) draft.raw = translateDyeNumber(draft.raw, from, to)
      for (const editor of outputEditors.values()) {
        const initial = JSON.parse(editor.initial) as RollFields
        for (const key of ['qty', 'weightKg', 'widthCm', 'gsm'] as const) { editor.fields[key] = translateDyeNumber(editor.fields[key], from, to); initial[key] = translateDyeNumber(initial[key], from, to) }
        editor.initial = JSON.stringify(initial)
      }
      for (const current of yarnStates.values()) for (const key of Object.keys(current.fields) as (keyof YarnUi['fields'])[]) current.fields[key] = translateDyeNumber(current.fields[key], from, to)
      for (const ui of waterStates.values()) ui.raw = translateDyeNumber(ui.raw, from, to)
      session.language = to; message = ''; errorMessage = false; saveCentralSessionPreference(); patch(); break
    }
    case 'operation': overlay(`${renderCentralOperationMenu({ language: lang(), tab: route().tab, factoryId: session.currentFactory, currentPath: appStore.getState().pathname })}
      <details class="mt-3 rounded-xl border border-[#dfe6ee] bg-white px-3">
        <summary class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold text-[#1a293c]"><span>${text('factory')} · ${ce(centralFormalName(getFactoryMasterRecordById(session.currentFactory)?.name, session.currentFactory, lang()))}</span><span class="text-[#62748a]" aria-hidden="true">⌄</span></summary>
        <div class="grid gap-2 border-t border-[#edf0f4] py-3">${listCentralDyeFactories().map(factory => `<button type="button" class="min-h-12 rounded-xl border px-3 py-2 text-left text-[15px] font-semibold ${factory.id === session.currentFactory ? 'border-[#2461ed] bg-[#edf3ff] text-[#2054c0]' : 'border-[#ced9e7] bg-white text-[#1a293c]'}" data-central-action="factory" data-central-value="${ce(factory.id)}">${ce(centralFormalName(factory.name, factory.id, lang()))}</button>`).join('')}</div>
      </details>
      <div class="mt-3">${cb(dyeText('auxSpecial'), 'special')}</div>`); break
    case 'print-entry': navigate('/fcs/pda/central/print/' + route().tab); break
    case 'special': navigate('/fcs/pda/central/' + route().tab); break
    case 'factory': if (listCentralDyeFactories().some(factory => factory.id === value)) { ensureCentralSessionAccount(value); saveCentralSessionPreference(); navigate(tabPath(route().tab) + '?factoryId=' + encodeURIComponent(value)) } break
    case 'scan': identify(); break
    case 'order': if (getCentralDyeFact(value, session.currentFactory)) navigate(`${tabPath(route().tab)}/${encodeURIComponent(value)}`); break
    case 'save': await submit(); break
    case 'water-next': waterViews.add(scope(route().orderId)); clearOutputFeedback(); patch(); break
    case 'water-back': waterViews.delete(scope(route().orderId)); clearOutputFeedback(); patch(); break
    case 'water-clear': waterStates.delete(waterContext().key); clearOutputFeedback(); patch(); activeRoot()?.querySelector<HTMLInputElement>('[data-central-water-field="quantity"]')?.focus(); break
    case 'water-save': await submitWater(); break
    case 'water-decision-request': {
      const { state, ui } = waterContext()
      if (!state || !ui) break
      try {
        const input = dyeWaterInput(state, ui, lang()), warning = input.decision === 'RETURN_FOR_REWORK' ? 'reworkWarning' : input.decision === 'CONTINUE_WITH_ACTUAL_QTY' ? 'actualWarning' : 'continueWarning'
        overlay(`<h2 class="mb-3 break-words text-lg font-bold">${ce(state.fact.order.dyeOrderNo)}</h2><p class="mb-3 font-bold">${dwt(lang(), 'total')} ${cn(state.fact.order.waterSolubleCompletedQty || 0, lang())} ${ce(centralDyeUnit(state.unit))}</p><p class="mb-3">${dwt(lang(), warning)}</p>${cb(dwt(lang(), input.decision!), 'water-decision-confirm', undefined, true)}`)
      } catch (error) { message = dyeWaterError(error, lang()) || dyeErrorText(error, lang()); errorMessage = true; patch() }
      break
    }
    case 'water-decision-confirm': closeCentralDyeOverlay(); await submitWater(); break
    case 'complete-request': {
      const { orderId, fact } = route(), current = centralDyeCompletion(orderId, session.currentFactory)
      if (!fact || !current?.ready) { message = dyeText('completionNotReady'); errorMessage = true; patch(); break }
      const key = scope(orderId), pending = completionStates.get(key)
      if (!pending || pending.revision !== current.revision) completionStates.set(key, { operationId: crypto.randomUUID(), completedAt: localDateTimeText(), revision: current.revision })
      overlay(`<h2 class="mb-3 break-words text-lg font-bold">${ce(fact.order.dyeOrderNo)}</h2><p class="mb-3 text-lg">${text('actual')} <strong>${cn(current.receivedQty, lang())} ${ce(centralDyeUnit(fact.order.qtyUnit))}</strong></p><p class="mb-3">${dyeText('completionWarning')}</p>${cb(dyeText('completeDocument'), 'complete-confirm', undefined, true)}`)
      break
    }
    case 'complete-confirm': {
      const { orderId } = route(), key = scope(orderId), pending = completionStates.get(key), actor = session.account
      if (!pending || !actor) break
      closeCentralDyeOverlay()
      await commitOutput(() => saveCentralDyeCompletion(orderId, actor, pending.operationId, pending.completedAt, pending.revision), () => {
        completionStates.delete(key)
        for (const id of processingDrafts.keys()) if (id.startsWith(key + '|')) processingDrafts.delete(id)
      }, dyeErrorText)
      break
    }
    case 'clear': { if (route().tab === 'execute') processingDrafts.delete(processing().key); else drafts.delete(selection().key); message = ''; errorMessage = false; patch(); document.querySelector<HTMLInputElement>('[data-central-dye-field="quantity"], [data-central-dye-field="gross"], [data-central-dye-field="workQuantity"]')?.focus(); break }
    case 'next': navigate(tabPath(route().tab)); break
    case 'more': limit += 15; patch(); break
    case 'reload':
      setBusy(true)
      try {
        await ensureSpecialCraftRecords(true)
        for (const [key, draft] of processingDrafts) if (draft.intent && hasSavedSpecialCraftCommand(draft.operationId, draft.intent)) processingDrafts.delete(key)
        const current = processing(); if (current.draft) current.draft.revision = centralDyeProcessingRevision(route().orderId, session.currentFactory)
        const water = waterContext(); if (water.ui && water.state) water.ui.revision = water.state.revision
        const ui = outputStates.get(scope(route().orderId))
        if (ui?.editor?.id) ui.editor.revision = centralDyeLabelRevision(route().orderId, ui.editor.id, session.currentFactory)
        if (ui?.panel === 'print' && ui.rollId) ui.print = { revision: centralDyeLabelRevision(route().orderId, ui.rollId, session.currentFactory), attempted: false, operationId: crypto.randomUUID() }
        message = ''; errorMessage = false
      }
      catch (error) { message = dyeErrorText(error, lang()); errorMessage = true }
      finally { setBusy(false); patch() }
      break
    case 'warehouse-view': if (['locations', 'receiveRecords', 'handoffRecords', 'uses'].includes(value)) { warehouseUi.view = value as DyeWarehouseUi['view']; patch() } break
    case 'warehouse-kind': if (value === 'input' || value === 'output') { warehouseUi.kind = value; warehouseUi.view = 'locations'; warehouseUi.area = ''; warehouseUi.location = ''; patch() } break
    case 'warehouse-area': warehouseUi.area = warehouseUi.area === value ? '' : value; warehouseUi.location = ''; patch(); break
    case 'warehouse-location':
      warehouseUi.location = warehouseUi.location === value ? '' : value; patch()
      ;(activeRoot()?.querySelector<HTMLElement>('[data-central-dye-location-stock] article') || activeRoot()?.querySelector<HTMLElement>('[data-central-dye-location-stock]'))?.scrollIntoView({ block: 'nearest' })
      break
    case 'warehouse-order': if (getCentralDyeFact(value, session.currentFactory)) { executionViews.set(scope(value), 'output'); navigate(`${tabPath('execute')}/${encodeURIComponent(value)}`) } break
    case 'execution-view': if (['work', 'output', 'receipt'].includes(value)) { executionViews.set(scope(route().orderId), value as 'work'); message = ''; errorMessage = false; patch() } break
    case 'photo': {
      if (failedPhotos.has(value)) { failedPhotos.delete(value); loadedPhotos.delete(value); patch() }
      else if (/^(?:https?:\/\/|\/)/.test(value)) overlay(`<img src="${ce(value)}" alt="${text('photo')}" class="max-h-[70dvh] w-full object-contain">`)
      break
    }
    case 'overlay-close': closeCentralDyeOverlay(); break
    case 'logout': if (hasCentralDrafts()) overlay(`<p class="mb-3">${text('unsent')}</p>${cb(text('cancel'), 'overlay-close')}${cb(text('discard'), 'logout-confirm')}`, false); else logout(); break
    case 'logout-confirm': logout(); break
    case 'login': {
      const login = document.querySelector<HTMLInputElement>('[data-central-login="account"]')?.value || '', password = document.querySelector<HTMLInputElement>('[data-central-login="password"]')?.value || ''
      const user = readFactoryPdaExecutionUsers().find(user => normalizePdaLoginId(user.loginId) === normalizePdaLoginId(login))
      if (!user || !verifyPdaPassword(password, user.passwordHash)) { message = text('loginFail'); errorMessage = true; patch(); break }
      if (user.status !== 'ACTIVE') { message = text('locked'); errorMessage = true; patch(); break }
      const factory = getFactoryMasterRecordById(user.factoryId)
      if (!factory || factory.status !== 'active' || !isCentralPdaFactory(factory)) { message = text('centralOnly'); errorMessage = true; patch(); break }
      discardCentralDrafts(); session.account = user; session.currentFactory = user.factoryId; session.signedOut = false; saveCentralSessionPreference(); navigate(tabPath('receive')); break
    }
  }
  return true
}
function logout() { discardCentralDrafts(); session.signedOut = true; session.account = undefined; saveCentralSessionPreference(); navigate(tabPath('receive')) }
export function mountCentralDyePage() {
  const size = () => { const root = document.querySelector<HTMLElement>('[data-central-pda-root]'); if (root) root.style.height = `${Math.round(window.visualViewport?.height || window.innerHeight)}px` }
  if (!mounted) { mounted = true; window.visualViewport?.addEventListener('resize', size); window.addEventListener('resize', size); window.addEventListener('beforeunload', event => { if (hasCentralDrafts() && activeRoot()) { event.preventDefault(); event.returnValue = '' } }) }
  if (!activeRoot()) return
  // Cached photos settle together during mounting; validate the footer once below.
  // Later asynchronous image success/failure still changes the actual readiness gate.
  let mountingPhotos = true
  document.querySelectorAll<HTMLImageElement>('[data-central-dye-photo]').forEach(img => {
    const src = img.getAttribute('src') || ''
    const loaded = () => { const changed = !loadedPhotos.has(src) || failedPhotos.has(src); loadedPhotos.add(src); failedPhotos.delete(src); if (!mountingPhotos && changed) refreshFooter() }
    const failed = () => { const changed = loadedPhotos.has(src) || !failedPhotos.has(src); loadedPhotos.delete(src); failedPhotos.add(src); img.hidden = true; const parent = img.closest('button'); if (parent && !parent.querySelector('[data-central-photo-error]')) parent.insertAdjacentHTML('beforeend', `<span data-central-photo-error class="text-xs text-red-700">${text('photoFailed')}</span>`); if (!mountingPhotos && changed) refreshFooter() }
    img.onload = loaded; img.onerror = failed; if (img.complete) { if (img.naturalWidth) loaded(); else failed() }
  })
  mountingPhotos = false
  const label = activeRoot()?.querySelector<HTMLIFrameElement>('[data-central-output-label]'), ui = outputStates.get(scope(route().orderId))
  if (label && ui?.print && !label.dataset.loaded) { label.dataset.loaded = 'true'; label.srcdoc = renderCentralDyeRollLabel(route().orderId, ui.rollId || '', session.currentFactory, lang()) }
  const yarnLabel = activeRoot()?.querySelector<HTMLIFrameElement>('[data-central-yarn-label]'), currentYarn = yarnStates.get(scope(route().orderId))
  if (yarnLabel && currentYarn && !yarnLabel.dataset.loaded) { yarnLabel.dataset.loaded = 'true'; yarnLabel.srcdoc = renderCentralDyeYarnLabel(route().orderId, session.currentFactory, currentYarn.labelVersion, lang()) }
  if (outputRecoveries.has(scope(route().orderId))) activeRoot()?.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-central-dye-field], [data-central-output-field], [data-central-output-action], [data-central-yarn-field], [data-central-action="clear"]').forEach(control => { control.disabled = true })
  if (outputRecoveries.has(scope(route().orderId))) activeRoot()?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-central-water-field]').forEach(control => { control.disabled = true })
  if (outputRecoveries.has(scope(route().orderId))) activeRoot()?.querySelectorAll<HTMLButtonElement>('[data-central-action^="water-"]').forEach(control => { control.disabled = true })
  size(); refreshFooter()
  const input = activeRoot()?.querySelector<HTMLInputElement>('[data-central-dye-field="scan"], [data-central-output-field="scan"], [data-central-water-field="quantity"], [data-central-login="account"]')
  if (input && !input.disabled && !document.querySelector('[data-central-overlay]') && !document.activeElement?.matches('input,select,textarea')) {
    input.focus({ preventScroll: true })
    if (input.dataset.centralWaterField) input.scrollIntoView({ block: 'nearest' })
  }
  const root = activeRoot()
  if (root && !document.querySelector('[data-central-overlay]') && !root.contains(document.activeElement)) {
    const primary = root.querySelector<HTMLButtonElement>('[data-central-footer] button')
    if (primary && !primary.disabled && (outputRecoveries.has(scope(route().orderId)) || !root.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'))) primary.focus({ preventScroll: true })
    else { root.tabIndex = -1; root.focus({ preventScroll: true }) }
  }
}
