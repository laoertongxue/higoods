import { technicalWashingOrders, washingOrderStatus } from '../data/fcs/fabric-washing-views.ts'
import { escapeHtml as e } from '../utils.ts'

/** Actual additions are outside the editable/published baseline and initial task decomposition. */
export function renderActualWashingRoute(technicalVersionId:string,productionOrderId?:string):string {
  const orders=technicalWashingOrders(technicalVersionId,productionOrderId)
  if(!orders.length)return ''
  return `<article class="rounded-lg border border-blue-200 bg-white" data-actual-washing-route>
    <header class="border-b bg-blue-50 px-4 py-3"><h3 class="font-semibold">印花后实际追加</h3></header>
    <div class="divide-y">${orders.map(order=>`<section class="space-y-2 p-4" data-actual-washing-order="${e(order.id)}">
      <div class="flex flex-wrap items-center gap-2 text-sm"><span>${e(order.source.materialName)} · ${e(order.source.materialSku)}</span><span>${e(order.source.productionOrderId||order.source.sourceNo)} · ${e(order.source.batchId)}</span></div>
      <div class="flex flex-wrap items-center gap-2"><span class="rounded border px-3 py-2">印花 ${e(order.source.factoryName)}</span><span aria-hidden="true">→</span><div class="rounded border border-blue-300 bg-blue-50 px-3 py-2"><strong>洗水 · ${e(order.assignedFactoryName||'待确认')}</strong><p class="text-sm">${e(order.handFeel)} · ${order.rolls.length} 卷</p><a class="text-sm text-blue-700 hover:underline" href="/fcs/craft/dyeing/washing/work-orders/${encodeURIComponent(order.id)}" target="_blank" rel="noopener">${e(order.no)}</a><p class="text-xs text-slate-600">${e(washingOrderStatus(order))}</p></div><span aria-hidden="true">→</span><span class="rounded border px-3 py-2">${e(order.source.target?.name||'原下游待核对')}</span></div>
    </section>`).join('')}</div></article>`
}
