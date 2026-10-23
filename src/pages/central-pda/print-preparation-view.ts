import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, ct, centralNotice, centralTime, centralFormalName } from './ui.ts'
import { dyePartnerLabel } from './dye-ui.ts'
import { printCard, printPhoto } from './print-material-view.ts'
import { printField, printFieldError, printNumber, printUnit } from './print-ui.ts'
import { centralPrintPreparation, type PrintAllocationRequest } from './print-preparation-model.ts'
export const preparationWords = {
  zh: { title: '备料关联', left: '未分配', target: '加工单', select: '选择加工单', quantity: '本次分配', save: '确认分配', noTarget: '暂无同物料、同上游的有效印花加工单', done: '已全部分配', record: '分配记录', open: '查看备料' },
  id: { title: 'Alokasi bahan', left: 'Belum dialokasikan', target: 'Order cetak', select: 'Pilih order', quantity: 'Jumlah alokasi', save: 'Alokasikan', noTarget: 'Belum ada order cetak aktif dengan bahan dan asal yang sama', done: 'Sudah dialokasikan semua', record: 'Riwayat alokasi', open: 'Buka bahan' },
} as const
export interface PrintAllocationDraft { orderId: string; raw: string; operationId: string; pending?: { fingerprint: string; request: PrintAllocationRequest } }
export function renderPrintPreparation(factoryId: string, lineId: string, draft: PrintAllocationDraft | undefined, limit: number, lang: CentralPdaLanguage) {
  const rows = centralPrintPreparation(factoryId), selected = rows.find(row => row.line.id === lineId), words = preparationWords[lang]
  if (!selected) return '<h2 class="my-3 font-bold">' + words.title + '</h2>' + (rows.slice(0, limit).map(row => printCard(
    '<div class="flex items-start gap-3">' + printPhoto(row.line.material.imageUrl, row.line.material.sku) +
    '<div class="min-w-0"><strong class="block break-words">' + ce(row.line.material.sku) + '</strong><p class="break-words">' +
    ce(row.line.material.batchNo) + '</p><p class="mt-2 font-bold">' + words.left + ' ' + printNumber(row.remaining, lang) + ' ' + ce(printUnit(row.line.unit, lang)) +
    '</p></div></div><p class="my-2 break-words">' + ct(lang, 'source') + ' · ' + ce(dyePartnerLabel(row.line.origin, lang)) +
    '<br>' + ce(row.line.sourceDocumentNo) + '</p>' + cb(words.open, 'print-preparation-open', row.line.id))).join('') || centralNotice(ct(lang, 'noRecords'))) +
    (rows.length > limit ? cb(ct(lang, 'more'), 'print-more') : '')
  const row = selected, unit = printUnit(row.line.unit, lang)
  let html = cb(ct(lang, 'back'), 'print-preparation-back') + printCard('<div class="flex items-start gap-3">' +
    printPhoto(row.line.material.imageUrl, row.line.material.sku) + '<div class="min-w-0"><strong class="block break-words">' +
    ce(row.line.material.sku) + '</strong><p class="break-words">' + ce(row.line.material.batchNo) + '</p></div></div><p class="my-2 break-words">' +
    ct(lang, 'source') + ' · ' + ce(dyePartnerLabel(row.line.origin, lang)) + '<br>' + ce(row.line.sourceDocumentNo) +
    '</p><p class="text-xl font-bold">' + words.left + ' ' + printNumber(row.remaining, lang) + ' ' + ce(unit) + '</p>')
  if (row.remaining <= 0) html += centralNotice(words.done)
  else if (!row.targets.length) html += centralNotice(words.noTarget)
  else if (draft) html += '<label class="my-3 block font-semibold">' + words.target + '<select class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3" data-central-print-field="allocationOrder"><option value="">' + words.select + '</option>' +
    row.targets.map(fact => '<option value="' + ce(fact.order.workOrderId) + '"' + (fact.order.workOrderId === draft.orderId ? ' selected' : '') + '>' + ce(fact.order.printOrderNo) + '</option>').join('') +
    '</select></label>' + printField(words.quantity + ' · ' + unit, draft.raw, 'allocationQuantity') + printFieldError() + cb(ct(lang, 'clear'), 'print-preparation-clear')
  if (row.allocations.length) html += '<details class="my-3 rounded-xl border bg-white p-3"><summary class="min-h-12 py-3 font-semibold">' + words.record + '</summary>' + row.allocations.map(a => '<p class="my-3 break-words">' +
    ce(row.targets.find(fact => fact.order.workOrderId === a.printingOrderId)?.order.printOrderNo || a.printingOrderId || a.dyeOrderId || a.waterOrderId || a.woolOrderId || '') +
    ' · ' + printNumber(a.qty, lang) + ' ' + ce(unit) + '<br>' + ce(centralFormalName(a.operatorName, a.operatorName, lang)) + ' · ' + ce(centralTime(a.at, lang)) + '</p>').join('') + '</details>'
  return html
}
