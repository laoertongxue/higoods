import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, ct, centralFormalName, centralTime, centralNotice } from './ui.ts'
import { dyeLocationLabel, dyePartnerLabel } from './dye-ui.ts'
import { pt, printUnit, printNumber as n } from './print-ui.ts'
import { printCard, printPhoto } from './print-material-view.ts'
import { preparationWords } from './print-preparation-view.ts'
import { centralPrintPreparation } from './print-preparation-model.ts'
import { readCentralPrintWarehouse, type CentralPrintWarehouse } from './print-warehouse-model.ts'

export interface PrintWarehouseUi {
  view: 'locations' | 'receive' | 'usage' | 'output' | 'preparation'
  kind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  location: string
  area?: string
  factoryId?: string
  pendingLimit?: number
  limit: number
}
const words = {
  zh: { stock: '在仓实物', reserved: '交出单占用', available: '可交出', missing: '未记录', received: '实收明细', pending: '待整理产出', openOutput: '查看产出', inputLabel: '打印原卷标签' },
  id: { stock: 'Barang di gudang', reserved: 'Dalam surat kirim', available: 'Bisa dikirim', missing: 'Tidak tercatat', received: 'Rincian diterima', pending: 'Hasil belum dikemas', openOutput: 'Buka hasil', inputLabel: 'Cetak label rol asal' },
} as const
const locationText = (value: string, lang: CentralPdaLanguage) =>
  /未记录|待登记/.test(value) ? pt(lang, 'notLocated') : dyeLocationLabel(value, lang)
function person(name: string | undefined, id: string | undefined, lang: CentralPdaLanguage) {
  if (!name || (!id && /^(历史操作人未记录|未记录|接收方扫码员|加工厂操作员)$/.test(name))) return words[lang].missing
  return centralFormalName(name, id || name, lang)
}
function amount(value: number | undefined, unit: string, lang: CentralPdaLanguage) {
  return value === undefined ? words[lang].missing : n(value, lang) + ' ' + printUnit(unit, lang)
}
function inputCard(row: CentralPrintWarehouse['input'][number], lang: CentralPdaLanguage) {
  return printCard('<div class="flex items-start gap-3">' + printPhoto(row.stock.imageUrl, row.stock.materialSku || '') +
    '<div class="min-w-0"><strong class="block break-words">' + ce(row.stock.materialSku) + '</strong><p class="mt-1 text-xl font-bold">' +
    ce(amount(row.quantity, row.stock.unit, lang)) + '</p></div></div><p class="mt-2 break-all">' + ce(row.barcode) +
    '</p><p class="break-words text-sm text-slate-600">' + ce(row.stock.sourceRecordNo) + '</p>' +
    (row.stock.rolls.some(roll => roll.barcode === row.barcode) ? '<div class="mt-3">' + cb(words[lang].inputLabel, 'print-input-label', row.key) + '</div>' : ''))
}
function outputCard(row: CentralPrintWarehouse['output'][number], lang: CentralPdaLanguage) {
  const stock = row.stock
  return printCard('<div class="flex items-start gap-3">' + printPhoto(stock.imageUrl, stock.materialSku || '') +
    '<div class="min-w-0"><strong class="block break-words">' + ce(stock.materialSku) + '</strong><p class="mt-1 text-xl font-bold">' +
    ce(amount(row.quantity, stock.unit, lang)) + '</p></div></div><p class="mt-2 break-all">' + ce(row.barcode) +
    '</p>' + (stock.reservedQty > 0 ? '<p class="mt-2 text-sm">' + words[lang].reserved + ' ' + ce(amount(stock.reservedQty, stock.unit, lang)) +
      '<br>' + words[lang].available + ' ' + ce(amount(stock.availableQty, stock.unit, lang)) + '</p>' : ''))
}

export function renderPrintWarehouse(factoryId: string, ui: PrintWarehouseUi, lang: CentralPdaLanguage) {
  const view = readCentralPrintWarehouse(factoryId)
  if (ui.factoryId !== factoryId) {
    ui.factoryId = factoryId; ui.area = ''; ui.location = ''; ui.limit = 15; ui.pendingLimit = 15
  }
  let html = '<div class="grid grid-cols-3 gap-2">' + (['locations', 'receive', 'output'] as const).map(key =>
    cb(ct(lang, ({ locations: 'locations', receive: 'receiveRecords', output: 'handoffRecords' } as const)[key]),
      'print-wh-view', key, key === 'receive' ? ui.view === 'receive' || ui.view === 'usage' : ui.view === key)).join('') + '</div>'
  const more = (size: number) => size > ui.limit ? cb(ct(lang, 'more'), 'print-more') : ''
  if (ui.view === 'receive' || ui.view === 'usage') {
    html += '<div class="my-3 grid grid-cols-2 gap-2">' + cb(ct(lang, 'receiveRecords'), 'print-wh-view', 'receive', ui.view === 'receive') +
      cb(pt(lang, 'usage'), 'print-wh-view', 'usage', ui.view === 'usage') + '</div>'
    if (ui.view === 'receive') {
      html += view.inboundRecords.slice(0, ui.limit).map(row => printCard('<strong class="block break-words">' + ce(row.inboundRecordNo) +
        '</strong><p class="break-words">' + ce(row.sourceRecordNo) + '</p><p class="break-words">' + ce(row.materialSku) +
        '</p><p class="my-2 text-lg font-bold">' + ce(amount(row.receivedQty, row.unit, lang)) + '</p><p class="break-words">' +
        ce(locationText(row.areaName + ' / ' + row.shelfNo + ' / ' + row.locationNo, lang)) + '</p><p class="mt-2 text-sm">' +
        ce(person(row.receiverName, row.receiverUserId, lang)) + ' · ' + ce(centralTime(row.receivedAt, lang)) + '</p>')).join('') ||
        centralNotice(ct(lang, 'noRecords'))
      html += more(view.inboundRecords.length)
    } else {
      html += view.usageRecords.slice(0, ui.limit).map(row => printCard('<strong class="block break-words">' + ce(row.materialSku) +
        '</strong><p class="break-all">' + ce(row.barcode || row.sourceNo) + '</p><p class="my-2 text-lg font-bold">' +
        ce(amount(row.qty, row.unit, lang)) + '</p><p class="break-words text-sm">' + ce(row.sourceNo) + '</p><p class="mt-2 text-sm">' +
        ce(person(row.operatorName, row.operatorUserId, lang)) + ' · ' + ce(centralTime(row.at, lang)) + '</p>')).join('') || centralNotice(ct(lang, 'noRecords'))
      html += more(view.usageRecords.length)
    }
  } else if (ui.view === 'output') {
    html += view.outboundRecords.slice(0, ui.limit).map(row => {
      const target = row.targetId ? dyePartnerLabel({ id: row.targetId, name: row.receiverName }, lang) : row.receiverName
      const actual = row.receiverWrittenQty === undefined ? ct(lang, 'awaiting') : ct(lang, 'actual') + ' ' + amount(row.receiverWrittenQty, row.unit, lang)
      const children = row.actualReceipts.map(receipt => '<p class="mt-2">' + ce(amount(receipt.quantity ?? receipt.rawQuantity,
        receipt.quantity === undefined ? receipt.rawUnit : row.unit, lang)) + '<br>' + ce(person(receipt.by, receipt.userId, lang)) +
        ' · ' + ce(centralTime(receipt.at, lang)) + '</p>').join('')
      return printCard('<strong class="block break-words">' + ce(row.sourceRecordNo) + '</strong><p class="break-words text-sm">' +
        ce(row.outboundRecordNo) + '</p><p class="my-2 break-words">' + ct(lang, 'target') + ' · ' + ce(target) +
        '</p><p class="font-bold">' + ct(lang, 'handed') + ' ' + ce(amount(row.outboundQty, row.unit, lang)) + '</p><p class="my-2">' +
        ce(actual) + '</p><p class="break-words text-sm">' + ct(lang, 'sender') + ' · ' + ce(person(row.operatorName, row.senderUserId, lang)) +
        '<br>' + ce(centralTime(row.outboundAt, lang)) + '</p>' + (children ? '<details class="mt-2"><summary class="min-h-12 py-3 font-semibold">' +
          words[lang].received + '</summary>' + children + '</details>' : row.actualBy ? '<p class="mt-2 break-words text-sm">' +
          ct(lang, 'receiver') + ' · ' + ce(person(row.actualBy, undefined, lang)) + '<br>' + ce(centralTime(row.actualAt || '', lang)) + '</p>' : ''))
    }).join('') || centralNotice(ct(lang, 'noRecords'))
    html += more(view.outboundRecords.length)
  } else {
    html += '<div class="my-3 grid grid-cols-2 gap-2">' + (['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map(kind =>
      cb(ct(lang, kind === 'WAIT_PROCESS' ? 'waitProcess' : 'waitHandover'), 'print-wh-kind', kind, ui.kind === kind)).join('') + '</div>'
    if (ui.kind === 'WAIT_PROCESS' && centralPrintPreparation(factoryId).length) html += '<div class="my-3">' + cb(preparationWords[lang].title, 'print-preparation') + '</div>'
    if (ui.kind === 'WAIT_HANDOVER' && view.pendingOutput.length) {
      html += '<section data-central-print-pending-output class="my-3"><h2 class="mb-2 font-bold">' + words[lang].pending + '</h2>' +
        view.pendingOutput.slice(0, ui.pendingLimit || 15).map(({ order, quantity }) => printCard('<div class="flex items-start gap-3">' +
          printPhoto(order.output.imageUrl, order.output.sku) + '<div class="min-w-0"><strong class="block break-words">' + ce(order.printOrderNo) +
          '</strong><p class="break-words">' + ce(order.output.sku) + '</p><p class="mt-2 text-xl font-bold">' + ce(amount(quantity, order.output.qtyUnit, lang)) +
          '</p></div></div><div class="mt-3">' + cb(words[lang].openOutput, 'print-wh-output', order.workOrderId) + '</div>')).join('') +
        (view.pendingOutput.length > (ui.pendingLimit || 15) ? cb(ct(lang, 'more'), 'print-wh-pending-more') : '') + '</section>'
    }
    const warehouses = view.warehouses.filter(warehouse => warehouse.warehouseKind === ui.kind)
    const positions = view.positions.filter(position => position.warehouse.warehouseKind === ui.kind)
    const areas = warehouses.flatMap(warehouse => warehouse.areaList.map(area => ({ warehouse, area, key: JSON.stringify([warehouse.warehouseId, area.areaId]) })))
    if (!areas.some(area => area.key === ui.area)) ui.area = areas[0]?.key || ''
    const input = ui.kind === 'WAIT_PROCESS', stocks = input ? view.input : view.output
    html += areas.map(({ warehouse, area, key }) => {
      const active = ui.area === key
      const stopped = !warehouse.isEnabled || area.status === 'STOPPED'
      let content = cb(ct(lang, 'area') + ' · ' + dyeLocationLabel(area.areaName, lang) + (stopped ? ' · ' + ct(lang, 'locationStopped') : ''),
        'print-wh-area', key, active)
      if (active) for (const shelf of area.shelfList) {
        content += '<p class="mb-2 mt-3 break-words font-semibold">' + ct(lang, 'shelf') + ' · ' + ce(dyeLocationLabel(shelf.shelfNo, lang)) +
          (shelf.status === 'STOPPED' ? ' · ' + ct(lang, 'locationStopped') : '') + '</p><div class="grid grid-cols-2 gap-2">' +
          shelf.locationList.map(location => {
            const position = positions.find(row => row.warehouse.warehouseId === warehouse.warehouseId && row.location.locationId === location.locationId)!
            return cb(dyeLocationLabel(location.locationNo, lang) + (location.status === 'STOPPED' ? ' · ' + ct(lang, 'locationStopped') : ''),
              'print-wh-location', position.key, ui.location === position.key)
          }).join('') + '</div>'
      }
      if (active && positions.some(position => position.areaKey === key && position.key === ui.location)) {
        const selected = stocks.filter(stock => stock.position?.key === ui.location)
        content += '<div data-central-print-wh-stock class="mt-3">' +
          (selected.slice(0, ui.limit).map(stock => input ? inputCard(stock as CentralPrintWarehouse['input'][number], lang) :
            outputCard(stock as CentralPrintWarehouse['output'][number], lang)).join('') || centralNotice(ct(lang, 'noStock'))) + more(selected.length) + '</div>'
      }
      return '<section class="my-3 rounded-xl border border-slate-200 bg-white p-3">' + content + '</section>'
    }).join('') || centralNotice(ct(lang, 'noRecords'))
    const unlocated = stocks.filter(stock => !stock.position)
    if (unlocated.length) html += '<section class="my-3"><h2 class="font-bold">' + pt(lang, 'notLocated') + '</h2>' +
      unlocated.slice(0, ui.limit).map(stock => '<p class="mt-2 break-words text-sm">' + ce(locationText(stock.recordedLocation, lang)) + '</p>' +
        (input ? inputCard(stock as CentralPrintWarehouse['input'][number], lang) : outputCard(stock as CentralPrintWarehouse['output'][number], lang))).join('') +
      more(unlocated.length) + '</section>'
  }
  return '<section data-central-print-warehouse>' + html + '</section>'
}
