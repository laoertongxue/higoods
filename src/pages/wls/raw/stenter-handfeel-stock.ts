import { readFactoryQcState } from '../../../data/fcs/factory-qc-records.ts'
import { listFactoryReceipts, getReceiptMaterialUsed } from '../../../data/fcs/factory-receiving.ts'
import { stenterImage, installStenterImages, STENTER_ROUTE, STENTER_PDA_ROUTE } from '../../process-factory/dyeing/stenter-handfeel/presentation.ts'
import { escapeHtml as e } from '../../../utils.ts'

/** Project physical stock from actual receipt/use/output facts without a second inventory ledger. */
export function renderStenterFactoryStockSection(factoryId: string | undefined, kind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'): string {
  if (!factoryId) return ''
  const orders = readFactoryQcState().handfeelOrders
  const rows = kind === 'WAIT_HANDOVER'
    ? orders.filter(order => order.factoryId === factoryId).flatMap(order => order.rolls.filter(roll => roll.completedAt && !roll.handedOutAt).map(roll => ({ id: order.id, no: order.no, image: order.source.imageUrl, name: order.source.materialName, sku: order.source.materialSku, barcode: roll.outputBarcode || roll.barcode, qty: roll.outputQty!, unit: roll.unit, label: '手感完成待交出' })))
    : listFactoryReceipts(factoryId).flatMap(receipt => receipt.lines.filter(line => !!line.stenterHandfeelOrderId).flatMap(line => {
      const remaining = line.qty - getReceiptMaterialUsed(line.id), order = orders.find(item => item.id === line.stenterHandfeelOrderId)
      return remaining > 0 && order ? [{ id: order.id, no: order.no, image: line.material.imageUrl, name: line.material.name, sku: line.material.sku, barcode: line.rolls?.map(roll => roll.barcode).join('、') || '', qty: remaining, unit: line.unit, label: line.handfeelDirection === 'TO_HANDFEEL' ? '手感待投入' : '手感后待领用' }] : []
    }))
  if (!rows.length) return ''
  installStenterImages()
  return `<section class="space-y-3 rounded-xl border bg-white p-3" data-stenter-handfeel-factory-stock="${kind}"><h2 class="font-semibold">定型机手感面料${kind === 'WAIT_HANDOVER' ? '待交出' : '待加工'}</h2>${rows.map(row => `<article class="flex gap-3 rounded border p-3">${stenterImage(row.image, row.name)}<div class="min-w-0 break-words"><strong>${e(row.name)}</strong><p>${e(row.sku)}</p><p>${e(row.barcode)}</p><p>${e(row.label)} · ${row.qty} ${e(row.unit)}</p><a class="text-blue-700 hover:underline" href="${STENTER_PDA_ROUTE}/${encodeURIComponent(row.id)}" data-nav="${STENTER_PDA_ROUTE}/${encodeURIComponent(row.id)}">${e(row.no)}</a></div></article>`).join('')}</section>`
}

export function renderStenterWarehouseSection(): string {
  const orders = readFactoryQcState().handfeelOrders.filter(order => order.source.target.kind === 'WAREHOUSE' && order.source.target.warehouseId && order.rolls.some(roll => !!roll.handedOutAt))
  if (!orders.length) return ''
  installStenterImages()
  const received = orders.reduce((total, order) => total + order.rolls.filter(roll => !!roll.downstreamReceivedAt).length, 0)
  return `<section class="m-4 space-y-3 rounded-lg border bg-white p-4" data-stenter-handfeel-warehouse-section><h2 class="font-semibold">定型机手感面料交出与本仓实收</h2>${orders.map(order => `<article class="flex flex-wrap items-start gap-3 rounded border p-3">${stenterImage(order.source.imageUrl, order.source.materialName)}<div class="min-w-0 break-words"><a class="text-blue-700" href="${STENTER_ROUTE}/${encodeURIComponent(order.id)}" data-nav="${STENTER_ROUTE}/${encodeURIComponent(order.id)}">${e(order.no)}</a><p>${e(order.source.materialName)} · ${e(order.source.materialSku)}</p><p>目标仓：${e(order.source.target.name)} · ${e(order.handFeel || '目标手感待补充')}</p>${order.rolls.filter(roll => !!roll.handedOutAt).map(roll => `<p>${e(roll.outputBarcode || roll.barcode)} · 交出 ${roll.outputQty} ${e(roll.unit)} · ${roll.downstreamReceivedAt ? `实际接收 ${roll.downstreamQty} ${e(roll.unit)}` : '待本仓逐卷实收'}</p>`).join('')}</div></article>`).join('')}<p class="text-sm">已登记本仓实收 ${received} 卷；按各卷原单位展示，未实收不计为本仓已收。</p></section>`
}
