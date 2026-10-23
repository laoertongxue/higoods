import { centralSpecialWarehouseHistory, renderCentralSpecialWarehouseHistory } from './special-warehouse-history.ts'
import { woolPieceName } from './wool-ui.ts'
import { centralWoolCraftContexts } from './wool-craft-model.ts'
import { listFactoryInternalWarehouses, listFactoryWaitProcessStockItems, listFactoryWaitHandoverStockItems } from '../../data/fcs/factory-internal-warehouse.ts'
import { listCentralSpecialOrders, centralSpecialIdentity, centralBusinessLabel, centralUnit } from './special-model.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, cn, ct, centralTime, centralFormalName, centralNotice } from './ui.ts'

export interface CentralWarehouseSelection {
  view: 'locations' | 'receiveRecords' | 'handoffRecords'
  kind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  locationId?: string
  pieceUnitLabel?: string
  showStockLocation?: boolean
  limit: number
}

export function renderCentralSpecialWarehouse(factoryId: string, operationId: string, lang: CentralPdaLanguage, selection: CentralWarehouseSelection): string {
  const woolContexts = centralWoolCraftContexts(factoryId, operationId)
  const orders = [...listCentralSpecialOrders(factoryId, operationId), ...woolContexts.map(context => context.task)]
  const quantityUnit = (unit: string) => unit === '片' && selection.pieceUnitLabel ? selection.pieceUnitLabel : centralUnit(unit, lang)
  const ids = new Set(orders.map(order => order.taskOrderId))
  const operations = new Set(orders.map(order => order.operationName))
  const craftCodes = new Set(orders.map(order => order.craftCode).filter(Boolean))
  const top = `<div class="grid grid-cols-3 gap-2">${(['locations', 'receiveRecords', 'handoffRecords'] as const).map(view => cb(ct(lang, view), 'warehouse-view', view, view === selection.view)).join('')}</div>`
  if (selection.view !== 'locations') {
    const rows = centralSpecialWarehouseHistory(factoryId, operationId, selection.view, lang)
    return top + (renderCentralSpecialWarehouseHistory(rows, factoryId, selection.view, lang, selection.limit) || centralNotice(ct(lang, 'noRecords')))
      + (rows.length > selection.limit || rows.slice(0, selection.limit).some(row => (row.receipts?.length || 0) > selection.limit) ? cb(ct(lang, 'more'), 'warehouse-more') : '')
  }
  const warehouses = listFactoryInternalWarehouses().filter(row => row.factoryId === factoryId && row.warehouseKind === selection.kind && row.isEnabled)
  const stock = (selection.kind === 'WAIT_PROCESS' ? listFactoryWaitProcessStockItems().map(item => ({ ...item, qty: item.availableQty ?? Math.max(0, item.receivedQty - (item.issuedQty || 0)) }))
    : listFactoryWaitHandoverStockItems().map(item => ({ ...item, qty: item.waitHandoverQty })))
    .filter(item => item.factoryId === factoryId && !!item.craftCode && craftCodes.has(item.craftCode))
  return top + `<div class="my-3 grid grid-cols-2 gap-2">${(['WAIT_PROCESS', 'WAIT_HANDOVER'] as const).map(kind => cb(ct(lang, kind === 'WAIT_PROCESS' ? 'waitProcess' : 'waitHandover'), 'warehouse-kind', kind, kind === selection.kind)).join('')}</div>`
    + (warehouses.map(warehouse => warehouse.areaList.filter(area => [...operations].some(name => area.areaName.startsWith(`${name}-`)) || stock.some(item => item.warehouseId === warehouse.warehouseId && item.areaName === area.areaName)).map(area => `<section class="mb-4"><h2 class="mb-2 break-words text-lg font-bold">${ct(lang, 'area')} · ${ce(centralFormalName(area.areaName, area.code || area.areaId, lang))}</h2>${area.shelfList.map(shelf => `<div class="mb-3"><h3 class="mb-1 text-sm text-slate-600">${ct(lang, 'shelf')} ${ce(shelf.shelfNo)}</h3><div class="grid grid-cols-2 gap-2">${shelf.locationList.map(location => cb(`${location.locationNo}${location.status === 'STOPPED' ? ` · ${ct(lang, 'locationStopped')}` : ''}`, 'warehouse-location', location.locationId, location.locationId === selection.locationId)).join('')}</div>${shelf.locationList.filter(location => location.locationId === selection.locationId).map(location => {
      const items = stock.filter(item => item.warehouseId === warehouse.warehouseId && item.areaName === area.areaName && item.shelfNo === shelf.shelfNo && item.locationNo === location.locationNo && item.qty > 0)
      return `<div class="mt-2 space-y-2">${items.map(item => {
        const wool = woolContexts.find(context => context.task.taskOrderId === item.taskId)
        const owner = wool?.task || orders.find(order => order.warehouseLinks.some(link => link.waitProcessStockItemId === item.stockItemId || link.waitHandoverStockItemId === item.stockItemId))
        const photo = wool ? wool.owner.styleImageUrl : owner ? centralSpecialIdentity(owner, lang).photo : item.photoList[0]
        const identity = wool ? `${woolPieceName(wool.piece, lang)} · ${wool.piece.skuCode}` : item.feiTicketNo || item.materialSku || centralBusinessLabel(item.partName, lang, item.stockItemId)
        return `<article class="rounded-xl border border-blue-200 bg-white p-3" data-central-stock>${selection.showStockLocation ? `<p class="mb-2 font-bold">${ct(lang, 'location')} · ${ce(location.locationNo)}</p>` : ''}<div class="flex items-start gap-2">${photo ? `<button type="button" data-central-action="photo" data-central-value="${ce(photo)}" aria-label="${ct(lang, 'photo')}" class="h-16 w-16 shrink-0 rounded-lg border"><img src="${ce(photo)}" alt="${ce(wool ? identity : centralFormalName(item.itemName, item.materialSku || item.stockItemId, lang))}" class="h-full w-full object-contain" data-central-photo></button>` : ''}<div class="min-w-0"><strong class="break-words">${ce(owner?.taskOrderNo || item.taskNo || item.stockItemId)}</strong><p class="break-words">${ce(identity)}</p><p class="text-lg font-bold">${cn(item.qty, lang)} ${ce(quantityUnit(item.unit))}</p></div></div>${photo ? '' : centralNotice(ct(lang, 'noPhoto'), true)}</article>`
      }).join('') || centralNotice(ct(lang, 'noStock'))}</div>`
    }).join('')}</div>`).join('')}</section>`).join('')).join('') || centralNotice(ct(lang, 'noRecords')))
}
