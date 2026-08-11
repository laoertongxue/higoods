import {
  PRINTING_HANDOVER_STATUS_LABEL,
  PRINTING_PROCESSING_STATUS_LABEL,
  formatPrintingQty,
  listPrintingWorkOrders,
} from '../../../data/fcs/printing-work-order-business.ts'
import { buildPrintingWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPrintingDialog } from './dialogs.ts'

export function renderCraftPrintingPendingReviewPage(): string {
  const rows = listPrintingWorkOrders().filter((order) => ['PARTIAL_HANDOVER', 'HANDOVER_WAIT_RECEIVE', 'PARTIAL_RECEIVED'].includes(order.handoverStatus))
  return `<div class="space-y-4 p-4" data-printing-receipt-page data-skip-page-rerender="true">
    <header><h1 class="text-xl font-semibold">印花产出接收</h1><p class="mt-1 text-sm text-slate-500">这里的业务动作是下游清点并接收，不再使用“审核通过/驳回”。加工状态与交出状态分别展示。</p></header>
    <section class="overflow-hidden rounded-xl border bg-white"><div class="overflow-x-auto"><table class="min-w-[1350px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">印花单</th><th class="p-3">加工产出</th><th class="p-3">加工厂</th><th class="p-3">加工状态</th><th class="p-3">交出状态</th><th class="p-3">交出单</th><th class="p-3">交出数量</th><th class="p-3">已接收</th><th class="p-3">差异/异议</th><th class="p-3">接收人</th><th class="sticky right-0 bg-slate-50 p-3">操作</th></tr></thead><tbody>${rows.length ? rows.map((order) => `<tr class="border-t"><td class="p-3"><a class="font-mono font-medium text-blue-700" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">${escapeHtml(order.printOrderNo)}</a><p class="text-xs text-slate-500">${escapeHtml(order.taskNo)}</p></td><td class="p-3"><p>[${order.output.objectType}] ${escapeHtml(order.output.materialName)}</p><p class="font-mono text-xs">${escapeHtml(order.output.sku)}</p></td><td class="p-3">${escapeHtml(order.printFactoryName)}</td><td class="p-3">${escapeHtml(PRINTING_PROCESSING_STATUS_LABEL[order.processingStatus])}</td><td class="p-3 font-medium">${escapeHtml(PRINTING_HANDOVER_STATUS_LABEL[order.handoverStatus])}</td><td class="p-3">${escapeHtml(order.handover.handoverNo || '—')}</td><td class="p-3">${formatPrintingQty(order.handover.handedOverQty)} Yard</td><td class="p-3">${formatPrintingQty(order.handover.receivedQty)} Yard</td><td class="p-3">${formatPrintingQty(order.handover.diffQty)} Yard / ${order.handover.objectionQty} 条</td><td class="p-3">${escapeHtml(order.handover.receiverName)}</td><td class="sticky right-0 bg-white p-3"><div class="flex gap-2"><button class="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white" data-printing-action="receive-handover" data-work-order-id="${escapeHtml(order.workOrderId)}">接收</button><a class="rounded-md border px-3 py-2 text-xs" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">详情</a></div></td></tr>`).join('') : '<tr><td colspan="11" class="p-12 text-center text-slate-500">当前没有待接收的印花产出。</td></tr>'}</tbody></table></div></section>
    <div data-printing-dialog-surface>${renderPrintingDialog()}</div>
  </div>`
}
