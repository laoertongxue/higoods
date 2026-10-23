import type { CentralPdaLanguage } from './frame.ts'
import { centralDyeWarehouse } from './dye-warehouse-model.ts'
import { ce, cn, ct, centralFormalName, centralNotice, centralTime } from './ui.ts'
import { dyeLocationLabel, dyeSpecification } from './dye-ui.ts'
import { outputUnit } from './dye-output-text.ts'

const labels = {
  zh: { input: '待加工仓', output: '待交出仓', inventory: '库存', uses: '用料记录', byOrder: '包装产出 · 按加工单', history: '原记录未分库位', stopped: '停用', packed: '包装完成', left: '剩余可交出', used: '已投入', inputLeft: '剩余可投入', rolls: '产出卷', yarn: '纱线交出', noLocation: '尚未记录库位' },
  id: { input: 'Gudang bahan', output: 'Gudang hasil', inventory: 'Stok', uses: 'Bahan dipakai', byOrder: 'Hasil kemasan · per order', history: 'Catatan lama tanpa lokasi', stopped: 'Nonaktif', packed: 'Selesai kemas', left: 'Sisa siap kirim', used: 'Sudah dipakai', inputLeft: 'Sisa bahan', rolls: 'Rol hasil', yarn: 'Kirim benang', noLocation: 'Lokasi belum tercatat' },
} as const
export const wt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh) => labels[lang][key]
export type DyeWarehouseUi = { kind: 'input' | 'output'; area: string; location: string; view: 'locations' | 'receiveRecords' | 'handoffRecords' | 'uses' }
const button = (lang: CentralPdaLanguage, label: string, action: string, value: string, selected = false) => `<button type="button" data-central-action="${action}" data-central-value="${ce(value)}"${selected ? ' aria-pressed="true"' : ''} class="min-h-12 w-full break-words rounded-xl border px-2 py-3 text-base font-semibold ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-700'}">${ce(label)}</button>`
function photo(src: string, sku: string, lang: CentralPdaLanguage) {
  return src ? `<button type="button" data-central-action="photo" data-central-value="${ce(src)}" aria-label="${ct(lang, 'photo')}" class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border"><img data-central-dye-photo src="${ce(src)}" alt="${ce(sku)}" class="h-full w-full object-contain"></button>` : centralNotice(ct(lang, 'noPhoto'), true)
}
export function renderCentralDyeWarehouse(factoryId: string, ui: DyeWarehouseUi, lang: CentralPdaLanguage, limit: number, history: (kind: 'receive' | 'handoff') => string) {
  const state = centralDyeWarehouse(factoryId), warehouse = state.warehouses.find(item => item.warehouseKind === (ui.kind === 'input' ? 'WAIT_PROCESS' : 'WAIT_HANDOVER'))
  let html = `<div data-central-dye-warehouse-kind class="mb-3 grid grid-cols-2 gap-2">${(['input', 'output'] as const).map(kind => button(lang, wt(lang, kind), 'warehouse-kind', kind, ui.kind === kind)).join('')}</div>`
  const tabs = ui.kind === 'input' ? ['locations', 'receiveRecords', 'uses'] as const : ['locations', 'handoffRecords'] as const
  html += `<div class="mb-3 grid ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2">${tabs.map(view => button(lang, view === 'uses' ? wt(lang, 'uses') : ct(lang, view), 'warehouse-view', view, ui.view === view)).join('')}</div>`
  if (ui.view === 'receiveRecords' || ui.view === 'handoffRecords') return html + history(ui.view === 'receiveRecords' ? 'receive' : 'handoff')
  if (ui.view === 'uses') {
    const uses = state.uses.slice().sort((a, b) => Date.parse(b.usedAt.replace(' ', 'T')) - Date.parse(a.usedAt.replace(' ', 'T')))
    html += uses.slice(0, limit).map(use => `<article class="mb-3 rounded-xl border bg-white p-3"><strong class="break-words">${ce(state.facts.find(fact => fact.order.dyeOrderId === use.sourceRecordId)?.order.dyeOrderNo || use.sourceRecordNo)}</strong><p class="break-words">${ce(use.materialSku || use.itemName)}</p><p class="mt-2 font-bold">${cn(use.issuedQty || 0, lang)} ${ce(outputUnit(use.unit, lang))}</p>${use.fabricRollNo ? `<p class="break-all">${ce(dyeSpecification(use.fabricRollNo, wt(lang, 'history'), lang))}</p>` : ''}<p class="mt-2 text-sm">${ce(dyeLocationLabel(use.areaName, lang))} / ${ce(dyeLocationLabel(use.shelfNo, lang))} / ${ce(dyeLocationLabel(use.locationNo, lang))}</p><p class="mt-2">${ce(centralFormalName(use.usedBy, use.usedByUserId || use.usedBy, lang))}</p><p class="text-sm">${ce(centralTime(use.usedAt, lang))}</p></article>`).join('') || centralNotice(ct(lang, 'noRecords'))
    return html + (uses.length > limit ? button(lang, ct(lang, 'more'), 'more', '') : '')
  }
  let registry = ''
  if (warehouse) registry += warehouse.areaList.map(area => {
    const active = ui.area === area.areaId
    return `<section class="mb-3 rounded-xl border bg-white p-3">${button(lang, `${ct(lang, 'area')} · ${dyeLocationLabel(area.areaName, lang)}${area.status === 'STOPPED' ? ' · ' + wt(lang, 'stopped') : ''}`, 'warehouse-area', area.areaId, active)}${active ? area.shelfList.map(shelf => `<p class="mb-2 mt-3 break-words font-semibold">${ct(lang, 'shelf')} ${ce(dyeLocationLabel(shelf.shelfNo, lang))}${shelf.status === 'STOPPED' ? ' · ' + wt(lang, 'stopped') : ''}</p><div class="grid grid-cols-2 gap-2">${shelf.locationList.map(location => button(lang, `${dyeLocationLabel(location.locationNo, lang)}${location.status === 'STOPPED' ? ' · ' + wt(lang, 'stopped') : ''}`, 'warehouse-location', location.locationId, ui.location === location.locationId)).join('')}</div>${shelf.locationList.filter(location => location.locationId === ui.location).map(location => {
      const stocks = ui.kind === 'input' ? state.input.filter(stock => (stock.availableQty ?? 0) > 0 && stock.warehouseId === warehouse.warehouseId && stock.areaName === area.areaName && stock.shelfNo === shelf.shelfNo && stock.locationNo === location.locationNo) : []
      return `<div data-central-dye-location-stock class="mt-3">${stocks.slice(0, limit).map(stock => inputCard(stock, lang)).join('') || centralNotice(ct(lang, 'noStock'))}${stocks.length > limit ? button(lang, ct(lang, 'more'), 'more', '') : ''}</div>`
    }).join('')}`).join('') : ''}</section>`
  }).join('')
  else registry += centralNotice(wt(lang, 'noLocation'))
  if (ui.kind === 'input') {
    html += registry
    const unlocated = state.input.filter(stock => (stock.availableQty ?? 0) > 0 && !warehouse?.areaList.some(area => area.areaName === stock.areaName && area.shelfList.some(shelf => shelf.shelfNo === stock.shelfNo && shelf.locationList.some(location => location.locationNo === stock.locationNo))))
    if (unlocated.length) html += `<h2 class="my-3 font-bold">${wt(lang, 'history')}</h2>${unlocated.slice(0, limit).map(stock => inputCard(stock, lang)).join('')}${unlocated.length > limit ? button(lang, ct(lang, 'more'), 'more', '') : ''}`
  } else {
    html += `<h2 class="my-3 font-bold">${wt(lang, 'byOrder')}</h2>`
    html += state.output.slice(0, limit).map(stock => {
      const fact = state.facts.find(fact => stock.stockItemId === 'DYE-OUTPUT-' + fact.order.dyeOrderId)!, order = fact.order
      return `<article data-central-dye-output-stock class="mb-3 rounded-xl border bg-white p-3"><div class="flex gap-2">${photo(stock.photoList[0], stock.materialSku || stock.itemName, lang)}<div class="min-w-0"><strong class="break-words">${ce(order.dyeOrderNo)}</strong><p class="break-words text-sm">${ce(stock.materialSku || stock.itemName)}</p></div></div><dl class="my-3 grid grid-cols-2 gap-2"><dt>${wt(lang, 'packed')}</dt><dd>${cn(stock.completedQty, lang)} ${ce(outputUnit(stock.unit, lang))}</dd><dt>${wt(lang, 'left')}</dt><dd class="font-bold">${cn(stock.waitHandoverQty, lang)} ${ce(outputUnit(stock.unit, lang))}</dd><dt>${ct(lang, 'actual')}</dt><dd>${cn(fact.downstreamReceived, lang)} ${ce(outputUnit(stock.unit, lang))}</dd></dl>${button(lang, ct(lang, 'detail'), 'warehouse-order', order.dyeOrderId)}</article>`
    }).join('') || centralNotice(ct(lang, 'noStock'))
    if (state.output.length > limit) html += button(lang, ct(lang, 'more'), 'more', '')
    html += `<h2 class="my-3 font-bold">${ct(lang, 'locations')}</h2>` + registry
  }
  return html
}
function inputCard(stock: ReturnType<typeof centralDyeWarehouse>['input'][number], lang: CentralPdaLanguage) {
  return `<article class="mt-3 border-t pt-3"><div class="flex gap-2">${photo(stock.photoList[0], stock.materialSku || stock.itemName, lang)}<div class="min-w-0"><strong class="break-words">${ce(stock.materialSku || stock.itemName)}</strong><p class="break-words text-sm">${ce(stock.orderNo)} · ${ce(stock.sourceRecordNo)}</p><p class="mt-2 font-bold">${cn(stock.availableQty ?? 0, lang)} ${ce(outputUnit(stock.unit, lang))}</p></div></div>${stock.fabricRollNo ? `<p class="mt-2 break-all text-sm">${ce(dyeSpecification(stock.fabricRollNo, wt(lang, 'history'), lang))}</p>` : ''}</article>`
}
