import type { CentralPdaFrameInput, CentralPdaLanguage } from './frame.ts'
import type { CentralDyeRollInput } from './dye-output-model.ts'
import { centralDyeOutput, centralDyeDispatch } from './dye-output-model.ts'
import { ce, cn, ct, centralNotice, centralFormalName, centralTime } from './ui.ts'
import { dyePartnerLabel, dyeNumber } from './dye-ui.ts'
import { ot, outputUnit } from './dye-output-text.ts'

export type RollFields = Record<'qty' | 'weightKg' | 'widthCm' | 'gsm' | 'vatNo' | 'remark', string>
export type RollEditor = { id?: string; fields: RollFields; initial: string; revision?: string; operationId: string }
export type OutputUi = { panel: 'list' | 'roll' | 'edit' | 'dispatch' | 'print'; rollId?: string; docId?: string; lastBarcode?: string; editor?: RollEditor; limit: number; scan: string; print?: { revision: string; attempted: boolean; operationId: string } }
export type TransportDraft = { fields: { driver: string; vehicle: string; plate: string; note: string }; initial: string; operationId: string }
export const outputButton = (label: string, action: string, value = '', primary = false) => `<button type="button" data-central-output-action="${ce(action)}" data-central-output-value="${ce(value)}" class="min-h-12 w-full break-words rounded-xl border px-3 py-3 text-base font-semibold ${primary ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-blue-700'}">${ce(label)}</button>`
export function rollEditorInput(editor: RollEditor, lang: CentralPdaLanguage): CentralDyeRollInput {
  const f = editor.fields
  return { id: editor.id, qty: dyeNumber(f.qty, lang, 2, true), weightKg: f.weightKg.trim() ? dyeNumber(f.weightKg, lang, 3, true) : 0,
    widthCm: dyeNumber(f.widthCm || '0', lang, null, true), gsm: dyeNumber(f.gsm || '0', lang, null, true), vatNo: f.vatNo, remark: f.remark }
}
function field(name: string, label: string, raw: string, numeric = false) {
  return `<label class="mb-2 mt-3 block font-semibold" for="output-${ce(name)}">${ce(label)}</label><input id="output-${ce(name)}" data-central-output-field="${ce(name)}" value="${ce(raw)}" type="text" inputmode="${numeric ? 'decimal' : 'text'}" autocomplete="off" enterkeyhint="next" class="min-h-14 w-full rounded-xl border border-slate-400 bg-white px-3 py-3 ${numeric ? 'text-2xl font-bold' : 'text-lg'}">`
}
function scanner(ui: OutputUi, lang: CentralPdaLanguage) {
  return `<label class="mb-2 block font-semibold" for="output-scan">${ot(lang, 'scan')}</label><div class="mb-3 flex items-stretch gap-2"><input id="output-scan" data-central-output-field="scan" value="${ce(ui.scan)}" placeholder="${ot(lang, 'scanHint')}" autocomplete="off" enterkeyhint="search" class="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-400 bg-white p-3"><button type="button" data-central-output-action="scan" class="min-h-14 shrink-0 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-blue-700">${ot(lang, 'identify')}</button></div>`
}
function photo(src: string, sku: string, lang: CentralPdaLanguage) {
  return `<button type="button" data-central-action="photo" data-central-value="${ce(src)}" aria-label="${ct(lang, 'photo')}" class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border"><img data-central-dye-photo src="${ce(src)}" alt="${ce(sku)}" class="h-full w-full object-contain"></button>`
}
export function renderCentralDyeOutput(orderId: string, factoryId: string, ui: OutputUi, transport: TransportDraft | undefined, lang: CentralPdaLanguage) {
  const state = centralDyeOutput(orderId, factoryId)
  if (!state) return centralNotice(ct(lang, 'wrongScan'), true)
  if (state.isYarn) return centralNotice(ot(lang, 'yarnSeparate'))
  const unit = outputUnit(state.fact.order.qtyUnit, lang), roll = state.rolls.find(r => r.id === ui.rollId)
  const status = (r: typeof state.rolls[number]) => r.dispatchId ? 'handed' as const : r.reservedBy ? 'reserved' as const : r.canDispatch && state.partner ? 'ready' as const : r.printedAt ? 'printed' as const : 'notPrinted' as const
  const back = outputButton(ot(lang, 'continue'), 'list')
  if (ui.panel === 'edit' && ui.editor) {
    const f = ui.editor.fields
    return `<h2 class="my-3 text-lg font-bold">${ot(lang, ui.editor.id ? 'edit' : 'add')}</h2>${roll ? `<p class="break-all font-bold">${ce(roll.barcode)}</p>` : ''}${field('qty', `${ot(lang, 'qty')} · ${unit}`, f.qty, true)}${field('weightKg', ot(lang, 'weight'), f.weightKg, true)}${field('vatNo', ot(lang, 'vat'), f.vatNo)}<details class="my-3"><summary class="min-h-12 py-3 font-bold">${ot(lang, 'dimensions')}</summary>${field('widthCm', ot(lang, 'width'), f.widthCm, true)}${field('gsm', ot(lang, 'gsm'), f.gsm, true)}</details>${field('remark', ot(lang, 'remark'), f.remark)}<p data-central-output-error role="alert" class="my-2 text-red-700"></p><div class="my-3 grid grid-cols-2 gap-2">${outputButton(ct(lang, 'clear'), 'clear')}${back}</div>`
  }
  if (ui.panel === 'print' && roll && ui.print) {
    return `<h2 class="my-3 text-lg font-bold">${ot(lang, 'printPreview')}</h2><p class="mb-2 break-all font-semibold">${ce(roll.barcode)}</p><iframe data-central-output-label title="${ot(lang, 'printPreview')}" class="h-[390px] w-full rounded-xl border bg-white"></iframe><div class="my-3">${ui.print.attempted ? outputButton(ot(lang, 'print'), 'print-browser') : ''}${outputButton(ot(lang, 'printCancelled'), 'roll', roll.id)}</div>`
  }
  if (ui.panel === 'dispatch') {
    const doc = centralDyeDispatch(ui.docId || '', factoryId)
    if (!doc) return centralNotice(ot(lang, 'wrongDocument'), true) + back
    const editable = doc.status === '草稿', total = doc.lines.reduce((sum, l) => sum + l.rolls.length, 0)
    let html = `<h2 class="my-3 break-all text-lg font-bold">${ce(doc.id)}</h2><p class="mb-3 font-bold">${ot(lang, editable ? 'drafts' : doc.status === '已交出' ? 'handed' : 'voided')}</p>${editable ? scanner(ui, lang) : ''}<p class="mb-3 text-lg font-bold">${ot(lang, 'scanned')} ${cn(doc.scans.length, lang)} / ${cn(total, lang)} ${ot(lang, 'rolls')}</p>`
    if (ui.lastBarcode && editable) {
      const line = doc.lines.find(line => line.rolls.some(roll => roll.barcode === ui.lastBarcode)), roll = line?.rolls.find(roll => roll.barcode === ui.lastBarcode)
      if (line && roll) html += `<article data-central-output-last-scan class="mb-3 rounded-xl border border-green-200 bg-green-50 p-3"><strong>${ot(lang, 'lastScan')}</strong><p class="break-all font-bold">${ce(roll.barcode)}</p><p class="break-words">${ce(line.orderNo)} · ${ce(line.sku)}</p><p class="font-bold">${cn(roll.qty, lang)} ${ce(outputUnit(line.unit, lang))}</p></article>`
    }
    for (const line of doc.lines) {
      const source = centralDyeOutput(line.orderId, factoryId)
      html += `<section class="mb-3 rounded-xl border bg-white p-3"><div class="flex gap-2">${source ? photo(source.material.imageUrl, line.sku, lang) : ''}<div class="min-w-0"><strong class="break-words">${ce(line.orderNo)}</strong><p class="break-words text-sm">${ce(line.sku)}</p><p class="break-words">${ct(lang, 'target')} · ${ce(dyePartnerLabel(line.partner, lang))}</p></div></div>${line.rolls.slice(0, ui.limit).map(r => `<div class="mt-3 border-t pt-2"><strong class="block break-all">${ce(r.barcode)}</strong><p>${cn(r.qty, lang)} ${ce(outputUnit(line.unit, lang))} · ${ot(lang, doc.scans.some(s => s.barcode === r.barcode) ? 'scanDone' : 'scanPending')}</p></div>`).join('')}${line.rolls.length > ui.limit ? outputButton(ct(lang, 'more'), 'more') : ''}</section>`
    }
    if (editable && transport) {
      html += field('driver', ot(lang, 'driver'), transport.fields.driver) + field('vehicle', ot(lang, 'vehicle'), transport.fields.vehicle) + field('plate', ot(lang, 'plate'), transport.fields.plate) + `<details class="my-3"><summary class="min-h-12 py-3 font-semibold">${ot(lang, 'note')}</summary>${field('note', ot(lang, 'note'), transport.fields.note)}</details>`
      html += `<div class="my-3">${outputButton(ot(lang, 'void'), 'void-request', doc.id)}</div>`
    } else {
      html += `<p class="my-3 break-words">${ot(lang, 'driver')} · ${ce(doc.transport.driver)}<br>${ot(lang, 'vehicle')} · ${ce(doc.transport.vehicle)}<br>${ot(lang, 'plate')} · ${ce(doc.transport.plate)}</p>`
      if (doc.status === '已交出') html += `<p class="my-3">${ot(lang, 'handoverBy')} · ${ce(centralFormalName(doc.handedOverBy || doc.operator, doc.handedOverByUserId || doc.operatorUserId || '', lang))}<br>${ce(centralTime(doc.handedOverAt || '', lang))}</p>`
    }
    html += `<p class="my-3 text-sm">${ot(lang, 'createdBy')} · ${ce(centralFormalName(doc.operator, doc.operatorUserId || '', lang))}</p>${back}`
    return html
  }
  if (ui.panel === 'roll' && roll) {
    const busy = !!(roll.dispatchId || roll.reservedBy)
    return `<article class="my-3 rounded-xl border bg-white p-3"><strong class="break-all">${ce(roll.barcode)}</strong><p class="my-2 text-2xl font-bold">${cn(roll.qty, lang)} ${ce(unit)}</p><p>${ot(lang, 'weight')} ${cn(roll.weightKg, lang)}</p><p>${ot(lang, 'vat')} · ${ce(roll.vatNo || '—')}</p>${roll.stagedAt ? `<p class="mt-2">${ot(lang, 'staged')}</p>` : ''}<p class="mt-3">${ot(lang, status(roll))}</p></article>${roll.printedAt && !busy && !roll.canDispatch ? centralNotice(ot(lang, 'unavailable')) : ''}${!busy && !state.partner && state.partnerError ? centralNotice(ot(lang, 'noDestination')) : ''}${busy ? outputButton(ot(lang, 'openDocument'), 'document', roll.dispatchId || roll.reservedBy) : `<div class="my-3 grid grid-cols-2 gap-2">${outputButton(ot(lang, 'edit'), 'edit', roll.id)}${outputButton(ot(lang, 'delete'), 'delete-request', roll.id)}</div>${roll.printedAt && roll.qty > 0 ? outputButton(ot(lang, 'print'), 'preview', roll.id) : ''}`}${roll.qty > 0 && !roll.dispatchId && !roll.stagedAt ? `<div class="my-3">${outputButton(`${ot(lang, 'stage')} · ${cn(roll.qty, lang)} ${unit}`, 'stage', roll.id)}</div>` : ''}${back}`
  }
  let html = scanner(ui, lang) + `<div class="my-3">${outputButton(ot(lang, 'add'), 'add', '', true)}</div>`
  html += state.rolls.slice(0, ui.limit).map(r => `<button type="button" data-central-output-action="roll" data-central-output-value="${ce(r.id)}" class="mb-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-left"><strong class="block break-all">${ce(r.barcode)}</strong><p class="my-1 text-xl font-bold">${cn(r.qty, lang)} ${ce(unit)}</p><p>${ot(lang, status(r))}</p></button>`).join('') || centralNotice(ot(lang, 'empty'))
  if (state.rolls.length > ui.limit) html += outputButton(ct(lang, 'more'), 'more')
  if (state.documents.length) html += `<details class="my-3"><summary class="min-h-12 py-3 font-bold">${ot(lang, 'documents')}</summary>${state.documents.map(doc => outputButton(`${doc.id} · ${ot(lang, doc.status === '草稿' ? 'drafts' : doc.status === '已交出' ? 'handed' : 'voided')}`, 'document', doc.id)).join('')}</details>`
  return html
}
export function centralDyeOutputFooter(orderId: string, factoryId: string, ui: OutputUi, transport: TransportDraft | undefined, lang: CentralPdaLanguage, busy: boolean, photoReady: boolean): CentralPdaFrameInput['primary'] {
  const state = centralDyeOutput(orderId, factoryId), roll = state?.rolls.find(row => row.id === ui.rollId)
  if (!state || state.isYarn) return undefined
  if (ui.panel === 'edit' && ui.editor) {
    let valid = JSON.stringify(ui.editor.fields) !== ui.editor.initial
    try { rollEditorInput(ui.editor, lang) } catch { valid = false }
    return { action: 'output-save', label: busy ? ct(lang, 'saving') : ot(lang, 'save'), disabled: busy || !valid || !photoReady }
  }
  if (ui.panel === 'print' && roll && ui.print) return { action: ui.print.attempted ? 'output-print-confirm' : 'output-print-browser', label: busy ? ct(lang, 'saving') : ot(lang, ui.print.attempted ? 'printResult' : 'print'), disabled: busy || !photoReady }
  if (ui.panel === 'roll' && roll && !roll.dispatchId && !roll.reservedBy) {
    if (!roll.printedAt && roll.qty > 0) return { action: 'output-preview', label: ot(lang, 'print'), disabled: busy || !photoReady }
    if (roll.canDispatch && state.partner) return { action: 'output-dispatch', label: ot(lang, 'startDispatch'), disabled: busy || !photoReady }
  }
  const doc = ui.panel === 'dispatch' ? centralDyeDispatch(ui.docId || '', factoryId) : undefined
  if (doc?.status === '草稿') {
    const n = doc.lines.reduce((sum, line) => sum + line.rolls.length, 0), t = transport?.fields
    return { action: 'output-confirm-dispatch', label: busy ? ct(lang, 'saving') : `${ot(lang, 'confirmDispatch')} · ${cn(n, lang)} ${ot(lang, 'rolls')}`, disabled: busy || !photoReady || !t?.driver.trim() || !t.vehicle.trim() || !t.plate.trim() || !n || !doc.lines.every(line => line.rolls.every(r => doc.scans.some(s => s.barcode === r.barcode))) }
  }
  return undefined
}
