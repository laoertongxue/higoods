import { getPrintingWorkflowFacts } from '../../../data/fcs/printing-task-domain.ts'
import { printingOrderIsOverdue } from '../../../data/fcs/printing-statistics.ts'
import { PRINTING_DEMAND_SOURCE_LABEL, formatPrintingQty, type PrintingWorkOrderBusinessRecord } from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'

const workflowFacts = new WeakMap<PrintingWorkOrderBusinessRecord, ReturnType<typeof getPrintingWorkflowFacts>>()
export function printingPresentationFacts(order: PrintingWorkOrderBusinessRecord): ReturnType<typeof getPrintingWorkflowFacts> {
  let facts = workflowFacts.get(order)
  if (!facts) { facts = getPrintingWorkflowFacts(order.workOrderId); workflowFacts.set(order, facts) }
  return facts
}

export function printingDemandFields(order: PrintingWorkOrderBusinessRecord): Array<[string, string]> {
  const source = order.demandSource
  return [
    ['需求来源', `${PRINTING_DEMAND_SOURCE_LABEL[source.type]} · ${source.sourceNo || source.sourceLabel || '来源待补充'}`],
    ['需求单', source.demandNo || (source.type === 'STOCK' ? '不适用（备货）' : '历史未记录')],
    ['生产单', source.productionOrderNo || source.originalProductionOrderNo || (source.type === 'STOCK' ? '不适用（备货）' : '历史未记录')],
    ['创建方式', order.creationMethod || '历史未记录'], ['售卖类型', order.salesType || (source.type === 'STOCK' ? '不适用（备货）' : '历史未记录')],
    ['是否补料', order.historicalSupplement || Boolean(source.supplementOrderNo) || source.type === 'SUPPLEMENT' ? '是' : '否'],
    ...(source.stockPlanNo ? [['备货计划', source.stockPlanNo] as [string, string]] : []),
    ...(source.purchaseOrderNo ? [['采购单', source.purchaseOrderNo] as [string, string]] : []),
    ...(source.supplementOrderNo ? [['补料单', source.supplementOrderNo] as [string, string]] : []),
  ]
}

export function renderPrintingDemandSource(order: PrintingWorkOrderBusinessRecord): string {
  const fields = printingDemandFields(order)
  return `<div class="rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-800" data-printing-demand-source><p class="font-semibold">${escapeHtml(fields[0][0])}：${escapeHtml(fields[0][1])}</p>${fields.slice(1, 3).map(([label, value]) => `<p class="mt-1">${escapeHtml(label)}：${escapeHtml(value)}</p>`).join('')}</div>`
}

export function printingNeedsTransfer(order: PrintingWorkOrderBusinessRecord): boolean {
  return printingPresentationFacts(order).requiresTransfer
}

export function printingProductionStage(order: PrintingWorkOrderBusinessRecord): string {
  return printingPresentationFacts(order).stageLabel
}

export function printingIsOverdue(order: PrintingWorkOrderBusinessRecord, now = new Date()): boolean {
  return printingOrderIsOverdue(order, now)
}

export function printingDocumentVersion(order: PrintingWorkOrderBusinessRecord): string {
  return `V${order.requirementVersion || 1}`
}

export function printingQuantityGroups(order: PrintingWorkOrderBusinessRecord): Array<{ title: string; fields: Array<[string, string]> }> {
  const input = (value: number) => `${formatPrintingQty(value)} ${order.plannedInput.qtyUnit}`
  const output = (value: number) => `${formatPrintingQty(value)} ${order.output.qtyUnit}`
  const facts = printingPresentationFacts(order)
  const unknownSource = facts.sourceQty === 0 && (order.actualInput.receivedQty > 0 || order.historicalInputQuantityUnknown)
  return [
    { title: '计划', fields: [['计划投入', input(order.plannedInput.plannedQty)], ['计划产出', output(order.output.plannedQty)]] },
    { title: '上游接收', fields: [['上游发出', unknownSource ? '历史未记录' : input(facts.sourceQty)], ['来源未收', unknownSource ? '历史未记录' : input(Math.max(0, facts.sourceQty - facts.receivedQty))], ['本厂实收', order.historicalInputQuantityUnknown ? '历史未记录' : input(order.actualInput.receivedQty)], ['实收包装数', order.historicalRollQuantitiesUnknown ? '历史未记录' : `${order.actualInput.receivedRollCount} ${['面料', '花边', '织带'].includes(order.plannedInput.objectType) ? '卷' : '包'}`]] },
    { title: '加工', fields: [['备料剩余', order.historicalInputQuantityUnknown ? '历史未记录' : input(facts.availableInputQty)], ['实际使用', input(order.actualInput.usedQty)], ['在制/待核算', input(facts.inProcessQty)], ['合格完成', output(order.output.completedQty)], ['已核算损耗', facts.lossQty === undefined ? '尚未核算' : input(facts.lossQty)]] },
    { title: '交出与下游', fields: [['建单占用', output(facts.reservedOutputQty)], ['可建单', output(facts.availableOutputQty)], ['实际交出', output(order.handover.handedOverQty)], ['下游实收', output(order.handover.receivedQty)], ['下游待接收', output(order.pendingWritebackQty)]] },
  ]
}

export function renderPrintingQuantityGroups(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="divide-y divide-slate-200 text-xs" data-printing-quantity-groups>${printingQuantityGroups(order).map(group => `<section class="space-y-1 py-2 first:pt-0 last:pb-0"><p class="font-medium text-slate-500">${group.title}</p>${group.fields.map(([label, value]) => `<p><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="tabular-nums">${escapeHtml(value)}</span></p>`).join('')}</section>`).join('')}</div>`
}

export function renderPrintingObjectImage(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  const missing = !image.imageUrl || (/花型/.test(image.imageAlt) && /sample[.-]/.test(image.imageUrl))
  if (missing) return `<span class="${size} flex shrink-0 items-center justify-center rounded border border-amber-200 bg-amber-50 p-1 text-center text-xs text-amber-800" role="img" aria-label="${escapeHtml(image.imageAlt)}：缺少对应图片">${/花型/.test(image.imageAlt) ? '正式花型待补充' : '缺少对应图片'}</span>`
  return `<button type="button" class="${size} relative shrink-0 overflow-hidden rounded-md border bg-slate-50" data-printing-action="preview-image" data-image-url="${escapeHtml(image.imageUrl)}" data-image-alt="${escapeHtml(image.imageAlt)}" aria-label="查看${escapeHtml(image.imageAlt)}大图"><span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">加载中</span><img class="relative h-full w-full object-cover" src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageAlt)}" loading="lazy" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true;this.previousElementSibling.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 items-center justify-center p-1 text-[10px] text-red-600">图片加载失败</span></button>`
}
