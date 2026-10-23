import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, ct, centralTime, centralFormalName, centralNotice } from './ui.ts'
import { dyeLocationLabel, dyePartnerLabel } from './dye-ui.ts'
import { waterNumber as cn, wt, waterNumberField, waterUnit, waterStatus, waterNeedsNote, waterNoteField, type WaterWorkDraft } from './water-ui.ts'
import { centralWaterFact, centralWaterIncoming, centralWaterPositions, centralWaterDownstream } from './water-model.ts'
import { centralWaterOutput, centralWaterDispatch, centralWaterReceiptHistory } from './water-output-model.ts'

export type WaterFact = NonNullable<ReturnType<typeof centralWaterFact>>
export interface WaterReceiveDraft { raw: string; position: string; operationId: string; pending?: { fingerprint: string; input: Parameters<typeof import('./water-model.ts').saveCentralWaterReceipt>[1] } }
export interface WaterOutputUi { panel: 'list' | 'roll' | 'label' | 'document'; rollId?: string; raw: string; revision?: string; operationId: string; docId?: string; scan: string;
  transport: { driver: string; vehicle: string; plate: string; note: string }; labelIds: string[]; labelRevisions: Record<string, string>; printRequested: boolean }
const card = (content: string) => `<article class="my-3 rounded-xl border border-slate-200 bg-white p-3">${content}</article>`
const shortButton = (zh: string, id: string, lang: CentralPdaLanguage, action: string, value?: string) => cb(lang === 'id' ? id : zh, action, value)
export function waterIdentity(fact: WaterFact, lang: CentralPdaLanguage) {
  const image = fact.image?.material
  return card(`<div class="flex items-center gap-3">${image ? `<button type="button" data-central-action="water-photo" data-central-value="${ce(image)}" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border"><img data-central-water-photo src="${ce(image)}" alt="${ce(fact.order.materialCode)}" class="h-full w-full object-contain"></button>` : ''}<div class="min-w-0"><strong class="block break-words text-lg">${ce(fact.order.waterOrderNo)}</strong><span class="block break-words">${ce(fact.order.materialCode)}</span><span class="block text-sm text-slate-600">${waterStatus(fact.order.status, lang)}</span></div></div>`)
}
export function renderWaterReceive(fact: WaterFact, sourceKey: string, draft: WaterReceiveDraft | undefined, lang: CentralPdaLanguage) {
  const incoming = centralWaterIncoming(fact.order.factoryId!, fact.order.waterOrderId),selected = incoming.find(row => row.key === sourceKey)
  let result = incoming.length > 1 ? `<div class="space-y-2">${incoming.map(row => cb(`${row.source.documentNo} · ${row.line.material.batchNo}`, 'water-source', row.key, row.key === sourceKey)).join('')}</div>` : ''
  if (!selected || !draft) return result + centralNotice(wt(lang, 'noReceive'))
  result += card(`<p class="text-sm text-slate-600">${ct(lang, 'source')}</p><strong class="block break-words">${ce(dyePartnerLabel(selected.source.origin, lang))}</strong><p class="break-words">${ce(selected.source.documentNo)}</p><p class="break-words">${ce(selected.line.material.batchNo)}</p><p class="mt-2 font-bold">${ct(lang, 'remaining')} ${cn(selected.remaining, lang)} ${ce(waterUnit(selected.line.unit))}</p>`)
  if (!selected.remaining) return result + centralNotice(wt(lang, 'zeroRemaining')) + cb(wt(lang, 'receiveNext'), 'water-next-receipt')
  result += waterNumberField(`${wt(lang, 'receiveQty')} · ${waterUnit(selected.line.unit)}`, draft.raw, 'receiveQuantity')
  const positions = centralWaterPositions(fact.order.factoryId!)
  result += `<label class="my-3 block font-semibold">${wt(lang, 'position')}<select class="mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white p-3 text-base" data-central-water-field="position"><option value="">${wt(lang, 'positionRequired')}</option>${positions.map(pos => {
    const value = pos.warehouse.warehouseId + '|' + pos.location.locationId
    return `<option value="${ce(value)}"${value === draft.position ? ' selected' : ''}>${ce(dyeLocationLabel(pos.area.areaName + ' / ' + pos.shelf.shelfNo + ' / ' + pos.location.locationNo, lang))}</option>`
  }).join('')}</select></label><p data-central-water-field-error role="alert" class="my-2 break-words text-base text-red-700"></p>`
  return result + `<div class="grid grid-cols-2 gap-2">${cb(ct(lang, 'clear'), 'water-clear')}${cb(wt(lang, 'receiveNext'), 'water-next-receipt')}</div>`
}
export function renderWaterWork(fact: WaterFact, draft: WaterWorkDraft, lang: CentralPdaLanguage) {
  const unit = ce(waterUnit(fact.order.qtyUnit)),destination = centralWaterDownstream(fact.order.waterOrderId, fact.order.factoryId!)
  let result = destination ? `<p class="my-3 break-words">${ct(lang, 'target')} · <strong>${ce(dyePartnerLabel({ id: destination.targetBusinessId, name: destination.targetName }, lang))}</strong></p>` : ''
  if (fact.canComplete) {
    result += waterNumberField(`${wt(lang, 'cumulative')} · ${unit}`, draft.raw, 'workQuantity')
    result += `<div data-central-water-note>${waterNeedsNote(fact, draft) ? waterNoteField(draft.reason, lang) : ''}</div>`
    result += `<p data-central-water-field-error role="alert" class="my-2 break-words text-base text-red-700"></p><div class="grid grid-cols-2 gap-2">${cb(ct(lang, 'clear'), 'water-clear')}${cb(wt(lang, draft.pause ? 'normal' : 'pauseChoice'), 'water-pause-toggle')}</div>`
    if (fact.canStart) result += `<div class="mt-3">${cb(`${wt(lang, 'inputNew')} ${cn(fact.availableInput, lang)} ${unit}`, 'water-input')}</div>`
  } else if (fact.canResolve) {
    const choices = [['CONTINUE_PROCESSING', 'continue', 'continueWarning'], ['CONTINUE_WITH_ACTUAL_QTY', 'actual', 'actualWarning'], ['RETURN_FOR_REWORK', 'rework', 'reworkWarning']] as const
    result += `<div class="space-y-2">${choices.filter(([value]) => value !== 'RETURN_FOR_REWORK' || !fact.reworkBlocked).map(([value, key, warning]) => `<div>${cb(wt(lang, key), 'water-decision', value, value === draft.decision)}${value === draft.decision ? `<p class="my-2 text-base">${wt(lang, warning)}</p>` : ''}</div>`).join('')}</div><p data-central-water-field-error role="alert" class="my-2 break-words text-base text-red-700"></p>`
  } else if (fact.canStart) result += card(`<p>${wt(lang, fact.availableInput ? 'inputLeft' : 'input')}</p><strong class="text-2xl">${cn(fact.availableInput || fact.input, lang)} ${unit}</strong>`)
  else if (fact.order.status !== 'DONE') result += centralNotice(waterStatus(fact.order.status, lang))
  return result
}
export function renderWaterReceipts(orderId: string, factoryId: string, selectedDoc: string, lang: CentralPdaLanguage) {
  const fact = centralWaterFact(orderId, factoryId),rows = centralWaterReceiptHistory(orderId, factoryId)
  if (!fact) return ''
  const docs = [...new Map(rows.map(row => [row.doc.id, row.doc])).values()]
  const selector = `<label class="my-3 block font-semibold">${wt(lang, 'receipts')}<select class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3" data-central-water-field="receiptScope"><option value="">${wt(lang, 'whole')}</option>${docs.map((doc, index) => `<option value="${ce(doc.id)}"${doc.id === selectedDoc ? ' selected' : ''}>${wt(lang, 'thisBatch')} ${index + 1} · ${ce(doc.id)}</option>`).join('')}</select></label>`
  const shown = selectedDoc ? rows.filter(row => row.doc.id === selectedDoc) : rows
  const amount = selectedDoc ? shown.reduce((sum, row) => sum + (row.actual || 0), 0) : fact.order.receivedQty || 0
  return selector + card(`<p>${ct(lang, 'actual')}</p><strong class="text-2xl">${cn(amount, lang)} ${ce(waterUnit(fact.order.qtyUnit))}</strong>`) + (shown.map(row => card(`<strong class="block break-words">${ce(row.doc.id)}</strong><p>${ct(lang, 'target')} · ${ce(dyePartnerLabel(row.line.partner, lang))}</p><p>${ct(lang, 'handed')} ${cn(row.sent, lang)} ${ce(waterUnit(row.line.unit))}</p><p>${row.actual === undefined ? wt(lang, 'awaiting') : `${ct(lang, 'actual')} ${cn(row.actual, lang)} ${ce(waterUnit(row.line.unit))}`}</p><p class="mt-2 text-sm">${ct(lang, 'sender')} · ${ce(centralFormalName(row.sender, row.senderId || '—', lang))}</p>${row.receivedAt ? `<p class="text-sm">${ct(lang, 'receiver')} · ${ce(centralFormalName(row.receiver, '—', lang))} · ${ce(centralTime(row.receivedAt, lang))}</p>` : ''}`)).join('') || centralNotice(ct(lang, 'noRecords')))
}
export function renderWaterOutput(orderId: string, factoryId: string, ui: WaterOutputUi, lang: CentralPdaLanguage) {
  const state = centralWaterOutput(orderId, factoryId)
  if (!state) return ''
  const locked = state.fact.order.status === 'DONE',unit = waterUnit(state.fact.order.qtyUnit)
  if(locked&&(ui.panel==='roll'||ui.panel==='label'))return centralNotice(wt(lang,'finished'))+cb(ct(lang,'back'),'water-output-back')
  if (ui.panel === 'roll') {
    const roll=state.rolls.find(row=>row.id===ui.rollId)
    return (roll?`<p class="my-2 break-all text-sm">${ce(roll.barcode)}</p><p>${lang==='id'?'Panjang tersimpan':'已登记卷长'} · ${cn(roll.qty,lang)} ${ce(unit)}</p>`:'')+waterNumberField(`${lang === 'id' ? 'Panjang rol' : '本卷长度'} · ${unit}`, ui.raw, 'rollQuantity') + `<p data-central-water-field-error role="alert" class="my-2 text-base text-red-700"></p><div class="grid grid-cols-2 gap-2">` + cb(ct(lang, 'clear'), 'water-clear') + cb(ct(lang, 'back'), 'water-output-back')+'</div>'
  }
  if (ui.panel === 'label') return `<iframe title="${lang === 'id' ? 'Label rol' : '卷标签'}" data-central-water-label class="h-[52dvh] w-full rounded-xl border bg-white"></iframe><div class="mt-3 grid grid-cols-2 gap-2">${shortButton('打印', 'Cetak', lang, 'water-print')}${cb(ct(lang, 'back'), 'water-output-back')}</div>`
  if (ui.panel === 'document') {
    const doc = centralWaterDispatch(ui.docId || '', factoryId)
    if (!doc) return centralNotice(ct(lang, 'changed'), true)
    let result = `<strong class="my-3 block break-all">${ce(doc.id)}</strong>`
    if (doc.status === '草稿' && !locked) result += `<div class="flex items-end gap-2">${waterNumberField(lang === 'id' ? 'Pindai / ketik kode rol' : '扫卷码 / 输卷码', ui.scan, 'outputScan', 'text')}${shortButton('识别', 'Cari', lang, 'water-output-scan')}</div>`
    result += doc.lines.map(line => {
      const fact=centralWaterFact(line.orderId,factoryId),image=fact?.image?.material
      return card(`<div class="flex items-center gap-2">${image?`<button type="button" class="h-14 w-14 shrink-0 border" data-central-action="water-photo" data-central-value="${ce(image)}"><img data-central-water-photo class="h-full w-full object-contain" src="${ce(image)}" alt="${ce(line.sku)}"></button>`:''}<div class="min-w-0"><strong class="block break-words">${ce(line.orderNo)}</strong><span class="block break-words text-sm">${ce(line.sku)}</span></div></div><p class="mt-1">${ct(lang, 'target')} · ${ce(dyePartnerLabel(line.partner, lang))}</p>${line.historicalQty!==undefined?`<p class="mt-2 font-bold">${cn(line.historicalQty,lang)} ${ce(waterUnit(line.unit))}</p>`:line.rolls.map(roll => `<div class="my-2 border-t pt-2"><p class="break-all text-sm">${ce(roll.barcode)}</p><strong>${cn(roll.qty, lang)} ${ce(waterUnit(line.unit))}</strong><span class="ml-2">${doc.scans.some(scan => scan.barcode === roll.barcode) ? lang === 'id' ? 'Sudah dipindai' : '已扫码' : lang === 'id' ? 'Belum dipindai' : '待扫码'}</span></div>`).join('')}`)
    }).join('')
    if (doc.status === '草稿' && !locked) result += (['driver', 'vehicle', 'plate'] as const).map(field => `<label class="my-3 block font-semibold">${({ driver: ['司机', 'Pengemudi'], vehicle: ['车型', 'Jenis kendaraan'], plate: ['车牌', 'Nomor kendaraan'] })[field][lang === 'id' ? 1 : 0]}<input class="mt-2 min-h-12 w-full rounded-xl border bg-white p-3 text-base" data-central-water-field="${field}" value="${ce(ui.transport[field])}"></label>`).join('') + shortButton('作废交出单', 'Batalkan kiriman', lang, 'water-void')
    else result += centralNotice(doc.status === '已交出' ? wt(lang, 'waitActual') : lang === 'id' ? 'Kiriman dibatalkan' : '交出单已作废')
    return result + `<div class="mt-3">${cb(ct(lang, 'back'), 'water-output-back')}</div>`
  }
  return `${locked || state.fact.order.status!=='WAIT_HANDOVER' || state.available<=0 ? '' : shortButton('新增产出卷', 'Tambah rol hasil', lang, 'water-roll-add')}${state.rolls.map(roll => card(`<p class="break-all text-sm">${ce(roll.barcode)}</p><strong class="text-xl">${cn(roll.qty, lang)} ${ce(unit)}</strong><p class="my-1 text-sm">${roll.dispatchId ? ct(lang, 'handed') : roll.reservedBy ? lang === 'id' ? 'Ada di dokumen kirim' : '已加入交出单' : roll.printedAt ? lang === 'id' ? 'Label sudah dicetak' : '标签已打印' : lang === 'id' ? 'Label belum dicetak' : '待打印标签'}</p>${locked ? '' : `<div class="mt-2 flex flex-wrap gap-2">${!roll.dispatchId && !roll.reservedBy ? shortButton('改卷长', 'Ubah panjang', lang, 'water-roll-edit', roll.id) + shortButton('打印标签', 'Cetak label', lang, 'water-label', roll.id) : ''}${roll.canDispatch ? shortButton('加入交出', 'Siapkan kiriman', lang, 'water-roll-send', roll.id) : ''}</div>`}`)).join('')}${state.documents.map(doc => `<div class="my-3">${cb(`${doc.id} · ${doc.status === '草稿' ? lang === 'id' ? 'Draf' : '草稿' : doc.status === '已交出' ? ct(lang, 'handed') : lang === 'id' ? 'Dibatalkan' : '已作废'}`, 'water-document', doc.id)}</div>`).join('')}`
}
