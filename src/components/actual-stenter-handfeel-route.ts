import { technicalHandfeelOrders } from '../data/fcs/factory-qc-views.ts'
import { handfeelStatus } from '../data/fcs/factory-qc-model.ts'
import { stenterImage } from '../pages/process-factory/dyeing/stenter-handfeel/presentation.ts'
import { escapeHtml as e } from '../utils.ts'

/** Actual site additions remain outside the published technical route and initial decomposition. */
export function renderActualStenterHandfeelRoute(technicalVersionId: string, productionOrderId?: string): string {
  const orders = technicalHandfeelOrders(technicalVersionId, productionOrderId)
  if (!orders.length) return ''
  return `<article class="rounded-lg border border-blue-200 bg-white" data-actual-stenter-handfeel-route>
    <header class="border-b bg-blue-50 px-4 py-3"><h3 class="font-semibold">现场实际追加定型机手感</h3></header>
    <div class="divide-y">${orders.map(order => `<section class="space-y-2 p-4" data-actual-stenter-handfeel-order="${e(order.id)}">
      <div class="flex flex-wrap items-center gap-3 text-sm">${stenterImage(order.source.imageUrl, order.source.materialName, 'h-12 w-12')}<div class="min-w-0"><p>${e(order.source.materialName)} · ${e(order.source.materialSku)}</p><p>${e(order.source.productionOrderId || order.source.sourceNo || order.source.no)}</p></div></div>
      <div class="flex flex-wrap items-center gap-2"><span class="rounded border px-3 py-2">${order.source.kind === 'PRINTING' ? '印花' : '染色'} ${e(order.source.factoryName)}</span><span aria-hidden="true">→</span><div class="rounded border border-blue-300 bg-blue-50 px-3 py-2"><strong>定型机手感 · ${e(order.factoryName)}</strong><p class="text-sm">${e(order.handFeel || '目标手感待补充')} · ${order.rolls.length} 卷</p><a class="text-sm text-blue-700 hover:underline" href="/fcs/craft/dyeing/stenter-handfeel/work-orders/${encodeURIComponent(order.id)}" data-nav="/fcs/craft/dyeing/stenter-handfeel/work-orders/${encodeURIComponent(order.id)}">${e(order.no)}</a><p class="text-xs text-slate-600">${e(handfeelStatus(order))}</p></div><span aria-hidden="true">→</span><span class="rounded border px-3 py-2">${e(order.source.target.name || '实际下游待核对')}</span></div>
    </section>`).join('')}</div></article>`
}
