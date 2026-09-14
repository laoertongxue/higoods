import type { PrintingWorkOrderBusinessRecord } from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'
import { printingNeedsTransfer, printingPresentationFacts } from './presentation.ts'

export function printingWorkOrderTimeGroups(order: PrintingWorkOrderBusinessRecord): Array<{ title: string; fields: Array<[string, string]> }> {
  const facts = printingPresentationFacts(order)
  const documents = (order.dispatchDocuments || []).filter(doc => doc.status !== '已作废' && doc.lines.some(line => line.workOrderId === order.workOrderId))
  return [
    { title: '单据创建', fields: [['需求创建', facts.demandCreatedAt || (order.demandSource.type === 'STOCK' ? '不适用（备货）' : '历史未记录')], ['生产单生成', facts.productionOrderCreatedAt || (order.demandSource.type === 'STOCK' ? '不适用（备货）' : '历史未记录')], ['加工单创建', order.orderedAt || '历史未记录']] },
    { title: '上游接收', fields: [['待接收生成', facts.sourceCreatedAt || (order.actualInput.receivedQty > 0 || order.historicalInputQuantityUnknown ? '历史未记录' : '尚无来源单据')], ['上游发出', facts.upstreamSentAt || (order.actualInput.receivedQty > 0 || order.historicalInputQuantityUnknown ? '历史未记录' : '尚未发出')], ['首次实收', facts.firstReceivedAt || (order.historicalInputQuantityUnknown ? '历史未记录' : '尚未接收')], ['最近实收', facts.lastReceivedAt || (order.historicalInputQuantityUnknown ? '历史未记录' : '尚未接收')], ['接收次数', `${facts.receiptCount} 次`]] },
    { title: '印花生产', fields: [['计划完成', order.plannedFinishAt || '尚未安排'], ['实际开工', facts.startedAt || (order.historicalInputQuantityUnknown ? '历史未记录' : '尚未开工')], ['打印完成', facts.printFinishedAt || (order.output.completedQty > 0 ? '历史未记录' : '尚未完成')], ...(printingNeedsTransfer(order) ? [['转印完成', facts.transferFinishedAt || (order.output.completedQty > 0 ? '历史未记录' : '尚未完成')] as [string, string]] : []), ['最近批次完成', order.completedAt || '尚未完成'], ['整单加工完成', facts.completedAt || '尚未完成']] },
    { title: '下游交出', fields: [['首次建交出单', facts.dispatchCreatedAt || (order.handover.handedOverQty > 0 ? '历史未记录' : '尚未建单')], ['工厂扫齐卷', facts.scanCompletedAt || (order.handover.handedOverQty > 0 ? '历史未记录' : '尚未扫齐')], ['最近实际交出', order.handover.handedOverAt || (order.handover.handedOverQty > 0 ? '历史未记录' : '尚未交出')], ['最近下游实收', facts.downstreamReceivedAt || (order.handover.receivedQty > 0 ? '历史未记录' : '尚未接收')], ['交出单数', `${documents.length} 张`]] },
  ]
}

export function renderPrintingWorkOrderTimes(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="divide-y divide-slate-200 text-xs" data-printing-time-groups>${printingWorkOrderTimeGroups(order).map(group => `<section class="space-y-1 py-2 first:pt-0 last:pb-0"><p class="font-medium text-slate-500">${escapeHtml(group.title)}</p>${group.fields.map(([label, value]) => `<p><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="tabular-nums">${escapeHtml(value)}</span></p>`).join('')}</section>`).join('')}</div>`
}
