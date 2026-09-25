import { productionOrders, getProductionOrderTechPackSnapshot } from '../../data/fcs/production-orders.ts'
import { escapeHtml as e } from '../../utils.ts'
import type { TransferBagTicketFactSnapshot } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { bagTicketKindLabel, bagTicketQuantityLabel, isFabricBagTicket } from '../../data/fcs/cutting/mixed-transfer-bag-ticket.ts'

export function renderMixedBagTicket(ticket: TransferBagTicketFactSnapshot): string {
  const fabric = isFabricBagTicket(ticket)
  const order = fabric ? undefined : productionOrders.find(order => [order.productionOrderId, order.productionOrderNo].includes(ticket.productionOrderId)
    || order.productionOrderNo === ticket.productionOrderNo)
  const style = order ? getProductionOrderTechPackSnapshot(order.productionOrderId) : undefined
  const title = fabric ? ticket.materialName || '' : `${order?.demandSnapshot.spuCode || ''} ${ticket.partName}`
  const url = fabric ? ticket.materialImageUrl : style?.imageSnapshot.styleImages?.[0]
  const thumbnail = url ? `<div class="relative h-12 w-12 shrink-0 overflow-hidden rounded border"><button type="button" class="h-full w-full" data-pda-image-preview-url="${e(url)}" data-pda-image-preview-title="${e(title)}"><img src="${e(url)}" alt="${e(title)} ${e(ticket.color)}" class="h-full w-full object-cover" onload="this.parentElement.nextElementSibling.hidden=true" onerror="this.hidden=true;this.parentElement.nextElementSibling.textContent='图片失败';this.parentElement.nextElementSibling.hidden=false"></button><span class="pointer-events-none absolute inset-0 bg-white/80 text-[10px]">加载中</span></div>` : `<span class="text-xs text-red-700">缺少${fabric ? '面料' : '款式'}图</span>`
  const image = `<div class="flex items-center gap-2">${thumbnail}<div><strong>${e(title)}</strong><div>${fabric ? `${e(ticket.materialCode || '')} · ${e(ticket.color)}` : `${e(ticket.color)} / ${e(ticket.size)}`}</div></div></div>`
  return `<article class="space-y-2 rounded border bg-white p-3 text-sm" data-mixed-bag-kind="${e(ticket.ticketKind || 'CUT_PIECE')}"><div class="flex items-center justify-between gap-2"><strong>${bagTicketKindLabel(ticket)}${ticket.replacementSequence ? ` · 第 ${ticket.replacementSequence} 张` : ''}</strong><b>${e(bagTicketQuantityLabel(ticket))}</b></div>${image}<p class="break-all text-xs">${e(ticket.feiTicketNo)}</p><p class="text-xs text-slate-500">生产单 ${e(ticket.productionOrderNo)}</p><p class="text-xs text-slate-500">车缝任务 ${e(ticket.sewingTaskNo || '未分配')} · 接收工厂 ${e(ticket.receiverFactoryName || '未分配')}</p></article>`
}
export function mixedBagSummary(tickets: TransferBagTicketFactSnapshot[]): string {
  const groups = new Map<string, { label: string; qty: number; unit: string; count: number }>()
  for (const ticket of tickets) {
    const label = bagTicketKindLabel(ticket); const unit = isFabricBagTicket(ticket) ? ticket.quantityUnit || '' : '片'
    const key = JSON.stringify([label, unit]); const value = groups.get(key) || { label, qty: 0, unit, count: 0 }
    value.qty += isFabricBagTicket(ticket) ? Number(ticket.quantity || 0) : ticket.pieceQty; value.count++; groups.set(key, value)
  }
  return [...groups.values()].map(group => `${group.label} ${group.count} 张 / ${group.qty} ${group.unit}`).join('；') || '空袋'
}
