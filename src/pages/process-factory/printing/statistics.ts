import {
  PRINTING_HANDOVER_STATUSES,
  PRINTING_PROCESSING_STATUSES,
  formatPrintingQty,
  getPrintingWorkOrderSummary,
  listPrintingWorkOrders,
} from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'

function metric(label: string, value: string): string {
  return `<article class="flex h-16 items-center justify-between rounded-lg border bg-white px-4"><span class="text-xs text-slate-500">${escapeHtml(label)}</span><strong class="text-lg tabular-nums">${escapeHtml(value)}</strong></article>`
}
export function renderCraftPrintingStatisticsPage(): string {
  const rows = listPrintingWorkOrders()
  const summary = getPrintingWorkOrderSummary(rows)
  const factories = [...new Set(rows.map((row) => row.printFactoryName))].map((factory) => {
    const matched = rows.filter((row) => row.printFactoryName === factory)
    const data = getPrintingWorkOrderSummary(matched)
    return `<tr class="border-t"><td class="p-3">${escapeHtml(factory)}</td><td class="p-3 text-right">${data.orderCount}</td><td class="p-3 text-right">${formatPrintingQty(data.plannedInputQty)}</td><td class="p-3 text-right">${formatPrintingQty(data.usedInputQty)}</td><td class="p-3 text-right">${formatPrintingQty(data.completedOutputQty)}</td><td class="p-3 text-right">${formatPrintingQty(data.handedOverQty)}</td><td class="p-3 text-right">${formatPrintingQty(data.receivedQty)}</td></tr>`
  }).join('')
  return `<div class="space-y-4 p-4"><header><h1 class="text-xl font-semibold">印花统计</h1><p class="mt-1 text-sm text-slate-500">加工状态与交出状态分别统计；不使用旧花型/打印/转印细分状态作为现场指标。</p></header>
    <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">${metric('印花加工单', String(summary.orderCount))}${metric('计划投入', `${formatPrintingQty(summary.plannedInputQty)} Yard`)}${metric('实际使用', `${formatPrintingQty(summary.usedInputQty)} Yard`)}${metric('完成', `${formatPrintingQty(summary.completedOutputQty)} Yard`)}${metric('已交出', `${formatPrintingQty(summary.handedOverQty)} Yard`)}${metric('已接收', `${formatPrintingQty(summary.receivedQty)} Yard`)}</section>
    <div class="grid gap-4 xl:grid-cols-2"><section class="rounded-xl border bg-white p-4"><h2 class="font-semibold">加工状态分布</h2><div class="mt-3 grid gap-2 sm:grid-cols-2">${PRINTING_PROCESSING_STATUSES.map((status) => metric(status.label, String(rows.filter((row) => row.processingStatus === status.value).length))).join('')}</div></section><section class="rounded-xl border bg-white p-4"><h2 class="font-semibold">交出状态分布</h2><div class="mt-3 grid gap-2 sm:grid-cols-2">${PRINTING_HANDOVER_STATUSES.map((status) => metric(status.label, String(rows.filter((row) => row.handoverStatus === status.value).length))).join('')}</div></section></div>
    <section class="overflow-hidden rounded-xl border bg-white"><header class="border-b p-4"><h2 class="font-semibold">按加工厂</h2></header><div class="overflow-x-auto"><table class="min-w-[900px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">加工厂</th><th class="p-3 text-right">单量</th><th class="p-3 text-right">计划投入(Yard)</th><th class="p-3 text-right">实际使用(Yard)</th><th class="p-3 text-right">完成(Yard)</th><th class="p-3 text-right">已交出(Yard)</th><th class="p-3 text-right">已接收(Yard)</th></tr></thead><tbody>${factories}</tbody></table></div></section>
  </div>`
}
