import { getPrintOrderHandoverRecords } from '../../../data/fcs/printing-task-domain.ts'
import { renderPrintingRelations, printingPatternLabel, printingMaterialCode, printingInputIdentity } from './relations.ts'
import {
  PRINTING_DEMAND_SOURCE_LABEL,
  PRINTING_HANDOVER_STATUS_LABEL,
  PRINTING_PROCESSING_STATUS_LABEL,
  PRINTING_RECEIPT_STATUS_LABEL,
  formatPrintingQty,
  formatPrintingUsage,
  formatPrintingWeightKg,
  getPrintingWorkOrderById,
  isPrintingWorkOrderBusinessCompleted,
  type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPrintingDialog } from './dialogs.ts'

let currentWorkOrderId = ''

function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-20 w-20'): string {
  if (!image.imageUrl) return `<span class="${size} flex shrink-0 items-center justify-center rounded border border-amber-200 bg-amber-50 p-1 text-center text-xs text-amber-800" role="img" aria-label="${escapeHtml(image.imageAlt)}：缺少对应图片">缺少对应图片</span>`
  if (/花型/.test(image.imageAlt) && /sample[.-]/.test(image.imageUrl)) return `<span class="text-sm text-amber-700">正式花型图待补充；样衣图不能作为花型</span>`
  return `<button type="button" class="${size} shrink-0 overflow-hidden rounded-lg border bg-slate-50" data-printing-action="preview-image" data-image-url="${escapeHtml(image.imageUrl)}" data-image-alt="${escapeHtml(image.imageAlt)}" aria-label="查看${escapeHtml(image.imageAlt)}大图">
    <img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageAlt)}" class="h-full w-full object-cover" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span hidden class="flex h-full w-full items-center justify-center p-2 text-xs text-red-600">图片加载失败</span>
  </button>${/花型|成品|产出/.test(image.imageAlt) ? '<span class="text-xs text-amber-700">参考图待核验</span>' : ''}`
}

function badge(label: string, tone: 'blue' | 'amber' | 'green' | 'slate' | 'red' = 'slate'): string {
  const classes = { blue: 'border-blue-200 bg-blue-50 text-blue-700', amber: 'border-amber-200 bg-amber-50 text-amber-700', green: 'border-green-200 bg-green-50 text-green-700', slate: 'border-slate-200 bg-slate-50 text-slate-600', red: 'border-red-200 bg-red-50 text-red-700' }
  return `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[tone]}">${escapeHtml(label)}</span>`
}

function field(label: string, value: string, helper = ''): string {
  return `<div><p class="text-xs text-slate-500">${escapeHtml(label)}</p><p class="mt-1 break-words text-sm font-medium">${escapeHtml(value || '—')}</p>${helper ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(helper)}</p>` : ''}</div>`
}

function section(title: string, body: string, action = ''): string {
  return `<section class="rounded-xl border bg-white"><header class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"><h2 class="font-semibold">${escapeHtml(title)}</h2>${action}</header><div class="p-5">${body}</div></section>`
}

function actionButton(label: string, action: string, order: PrintingWorkOrderBusinessRecord, tone: 'primary' | 'normal' | 'danger' = 'normal'): string {
  const style = tone === 'primary' ? 'border-blue-600 bg-blue-600 text-white' : tone === 'danger' ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700'
  return `<button type="button" class="rounded-md border px-3 py-2 text-sm font-medium ${style}" data-printing-action="${escapeHtml(action)}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function printButton(label: string, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION', order: PrintingWorkOrderBusinessRecord): string {
  return `<button type="button" class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700" data-printing-action="open-print" data-document-type="${documentType}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function renderCurrentActions(order: PrintingWorkOrderBusinessRecord): string {
  if (order.historicalInputQuantityUnknown) return actionButton('补录历史累计投入', 'receive-input', order, 'primary')
    + '<span class="self-center text-sm text-amber-800">请先补录累计投入，再继续填报加工完成。</span>'
  const actions: string[] = []
  if (order.processingStatus === 'WAIT_ASSIGN') actions.push(actionButton('分配加工厂', 'assign', order, 'primary'))
  if (order.processingStatus === 'WAIT_INPUT_RECEIPT') {
    actions.push(actionButton('接收加工投入', 'receive-input', order, 'primary'))
    actions.push(actionButton('调整加工投入', 'change-input', order))
    actions.push(actionButton('取消', 'cancel', order, 'danger'))
  }
  const canContinue = !isPrintingWorkOrderBusinessCompleted(order) && ['PROCESSING', 'PROCESS_COMPLETED'].includes(order.processingStatus)
  const canHandOver = canContinue && order.output.completedQty > order.handover.handedOverQty
  const canCompleteDocument = order.handoverStatus === 'FULL_HANDOVER'
    && order.handover.receivedQty >= order.handover.handedOverQty
    && order.handover.diffQty === 0
    && order.handover.objectionQty === 0
    && !isPrintingWorkOrderBusinessCompleted(order)
  const primaryAction = canHandOver ? 'handover'
    : canContinue && order.actualInput.usedQty < order.actualInput.receivedQty ? 'complete'
      : canCompleteDocument ? 'complete-document' : 'complete'
  const tone = (action: string) => action === primaryAction ? 'primary' as const : 'normal' as const
  if (canContinue) {
    actions.push(actionButton('继续接收投入', 'receive-input', order))
    actions.push(actionButton('填报加工完成', 'complete', order, tone('complete')))
    if (order.output.completedQty === 0) actions.push(actionButton('调整加工投入', 'change-input', order))
  }
  if (canHandOver) actions.push(actionButton('交出', 'handover', order, tone('handover')))
  if (canCompleteDocument) actions.push(actionButton('完成单据', 'complete-document', order, tone('complete-document')))
  actions.push(actionButton('产出卷条码', 'open-barcodes', order))
  return actions.join('')
}

function renderInputIdentity(order: PrintingWorkOrderBusinessRecord): string {
  const specification = ['面料', '花边', '织带'].includes(order.plannedInput.objectType)
    ? `<p class="text-xs text-slate-500">${order.plannedInput.gsm}g/㎡ · 幅宽 ${order.plannedInput.widthCm}cm</p>`
    : ''
  return `<div class="flex gap-4">${imageButton(order.plannedInput)}<div class="min-w-0 space-y-1 text-sm"><p class="font-semibold">[${escapeHtml(order.plannedInput.objectType)}] ${escapeHtml(order.plannedInput.materialName)}</p><p>物料标识：${escapeHtml(order.plannedInput.spu)}</p><p class="break-all font-mono text-xs">计划物料编码：${escapeHtml(printingMaterialCode(order.plannedInput.sku))}</p><p class="break-all font-mono text-xs">实际 SKU：${escapeHtml(printingMaterialCode(order.actualInput.actualSku) || (order.historicalInputQuantityUnknown ? '历史未记录' : '未接收'))}</p>${specification}</div></div>`
}

function renderOutputIdentity(order: PrintingWorkOrderBusinessRecord): string {
  const specification = ['面料', '花边', '织带'].includes(order.output.objectType)
    ? `<p class="text-xs text-slate-500">${order.output.gsm}g/㎡ · 幅宽 ${order.output.widthCm}cm</p>`
    : ''
  return `<div class="flex gap-4">${imageButton(order.output)}<div class="min-w-0 space-y-1 text-sm"><p class="font-semibold">[${escapeHtml(order.output.objectType)}] ${escapeHtml(order.output.materialName)}</p><p>产出来源标识：${escapeHtml(order.output.spu)}</p><p class="break-all font-mono text-xs font-medium text-emerald-700">产出编码：${escapeHtml(printingMaterialCode(order.output.sku, true))}</p>${specification}</div></div>`
}

function renderReceiptBatches(order: PrintingWorkOrderBusinessRecord): string {
  const receipts = order.actualInput.receipts ?? []
  if (receipts.length === 0) return '<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500">暂无接收批次。</p>'
  return `<div class="overflow-x-auto"><table class="min-w-[760px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">来源记录</th><th class="p-3">接收确认号</th><th class="p-3 text-right">接收数量</th><th class="p-3">实际投入 SKU</th><th class="p-3">接收人／时间</th></tr></thead><tbody>${receipts.map((receipt) => `<tr class="border-t"><td class="p-3 font-mono text-xs">${escapeHtml(receipt.upstreamRecordId || '历史记录')}</td><td class="p-3 font-mono text-xs">${escapeHtml(receipt.receiptId)}</td><td class="p-3 text-right">${formatPrintingQty(receipt.qty)} ${escapeHtml(order.plannedInput.qtyUnit)}</td><td class="p-3 font-mono text-xs">${escapeHtml(receipt.actualSku)}</td><td class="p-3">${escapeHtml(receipt.receiverName || '历史未记录')}<br>${escapeHtml(receipt.receivedAt || '历史未记录')}</td></tr>`).join('')}</tbody></table></div>`
}

function renderHandoverBatches(order: PrintingWorkOrderBusinessRecord): string {
  const rows = getPrintOrderHandoverRecords(order.workOrderId)
  return `<details class="my-3"><summary class="cursor-pointer text-blue-700">交接记录 ${rows.length} 笔</summary>${rows.length ? `<div class="overflow-x-auto"><table class="min-w-[900px] w-full border-collapse text-sm [&_th]:border [&_td]:border [&_th]:p-2 [&_td]:p-2"><thead><tr><th>交出单据</th><th>物料</th><th>交出数量</th><th>下游已收</th><th>交出人／时间</th><th>接收人／时间</th><th>差异处理</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.handoverRecordNo || row.recordId)}</td><td>${escapeHtml(row.materialName || row.handoutItemLabel || order.output.materialName)}</td><td>${row.submittedQty ?? 0} ${escapeHtml(row.qtyUnit || order.output.qtyUnit)}</td><td>${row.receiverWrittenQty ?? row.warehouseWrittenQty ?? '待接收'}</td><td>${escapeHtml(row.factorySubmittedBy || '历史未记录')}<br>${escapeHtml(row.factorySubmittedAt)}</td><td>${escapeHtml(row.receiverWrittenBy || '未记录')}<br>${escapeHtml(row.receiverWrittenAt || row.warehouseWrittenAt || '未接收')}</td><td>${escapeHtml(row.resolvedRemark || row.diffReason || (row.factoryDiffDecision === 'ACCEPT_DIFF' ? '差异已接受' : row.objectionStatus === 'RESOLVED' ? '差异已关闭' : '—'))}</td></tr>`).join('')}</tbody></table></div>` : '<p>尚无逐笔交出记录；历史汇总不代表已补齐原始单据。</p>'}</details>`
}

function renderChangeHistory(order: PrintingWorkOrderBusinessRecord): string {
  if (!order.inputChanges.length) return '<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500">暂无投入调整记录。</p>'
  return `<div class="overflow-x-auto"><table class="min-w-[1100px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">变更时间/人</th><th class="p-3">原投入</th><th class="p-3">新投入</th><th class="p-3">标准用量</th><th class="p-3">加工单用量</th><th class="p-3">计划投入</th><th class="p-3">原因</th></tr></thead><tbody>${order.inputChanges.map((change) => `<tr class="border-t"><td class="p-3">${escapeHtml(change.changedAt)}<br>${escapeHtml(change.operatorName)}</td><td class="p-3"><p>${escapeHtml(change.originalInput.materialName)}</p><p class="font-mono text-xs">${escapeHtml(change.originalInput.sku)}</p></td><td class="p-3"><p>${escapeHtml(change.newInput.materialName)}</p><p class="font-mono text-xs">${escapeHtml(change.newInput.sku)}</p>${change.crossSpecification ? badge('跨规格', 'amber') : badge('同规格', 'blue')}</td><td class="p-3">${formatPrintingUsage(change.originalStandardUnitUsage)} → ${formatPrintingUsage(change.newStandardUnitUsage)}</td><td class="p-3">${formatPrintingUsage(change.originalOrderUnitUsage)} → ${formatPrintingUsage(change.newOrderUnitUsage)}</td><td class="p-3">${formatPrintingQty(change.originalInput.plannedQty)} → ${formatPrintingQty(change.newInput.plannedQty)} ${escapeHtml(change.newInput.qtyUnit)}</td><td class="p-3">${escapeHtml(change.reason)}</td></tr>`).join('')}</tbody></table></div>`
}

function renderRequirement(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="grid gap-5 lg:grid-cols-[1fr_1.4fr]"><div class="grid gap-4 sm:grid-cols-2">${field('工艺名称', order.requirement.craftName)}${field('类型', order.requirement.type)}${field('深浅', order.requirement.shade)}${field('温度', order.requirement.temperature)}${field('印花面别', order.requirement.printSide)}</div><div class="flex flex-wrap gap-5"><div><p class="mb-2 text-xs text-slate-500">正面花型</p><div class="flex items-center gap-3">${imageButton(order.requirement.frontPattern, 'h-24 w-24')}<div><p class="font-medium">${escapeHtml(order.requirement.frontPattern.patternName)}</p><p class="font-mono text-xs">${escapeHtml(printingPatternLabel(order.requirement.frontPattern.patternNo))} · ${escapeHtml(order.requirement.frontPattern.patternVersion)}</p></div></div></div>${order.requirement.insidePattern ? `<div><p class="mb-2 text-xs text-slate-500">里面花型</p><div class="flex items-center gap-3">${imageButton(order.requirement.insidePattern, 'h-24 w-24')}<div><p class="font-medium">${escapeHtml(order.requirement.insidePattern.patternName)}</p><p class="font-mono text-xs">${escapeHtml(printingPatternLabel(order.requirement.insidePattern.patternNo))} · ${escapeHtml(order.requirement.insidePattern.patternVersion)}</p></div></div></div>` : ''}</div></div>`
}

function renderBarcodes(order: PrintingWorkOrderBusinessRecord): string {
  const rows = order.barcodes.slice(0, 5).map((barcode) => `<tr class="border-t"><td class="p-3 font-mono text-xs">${escapeHtml(barcode.barcode)}</td><td class="p-3 font-mono text-xs">${escapeHtml(printingMaterialCode(barcode.sku, true))}</td><td class="p-3">${escapeHtml(barcode.rollNo)}</td><td class="p-3 text-right">${formatPrintingQty(barcode.lengthY)}</td><td class="p-3 text-right">${formatPrintingWeightKg(barcode.weightKg)}</td><td class="p-3">${escapeHtml(barcode.status)}</td><td class="p-3">${escapeHtml(barcode.warehouseName)} · ${escapeHtml(barcode.inboundStatus)}</td></tr>`).join('')
  return `<div class="overflow-x-auto"><table class="min-w-[900px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">条码</th><th class="p-3">产出编码</th><th class="p-3">卷号</th><th class="p-3 text-right">数量(${escapeHtml(order.output.qtyUnit)})</th><th class="p-3 text-right">重量(KG)</th><th class="p-3">状态</th><th class="p-3">仓库/入库</th></tr></thead><tbody>${rows}</tbody></table></div>${order.barcodes.length > 5 ? `<p class="mt-3 text-xs text-slate-500">仅预览前 5 卷；共 ${order.barcodes.length} 卷。</p>` : ''}`
}

function renderProcessingBatches(order: PrintingWorkOrderBusinessRecord): string {
  const records = order.operationLogs.filter(item => /加工完成|开工|历史累计投入/.test(item.action))
  return records.length ? records.map(item => `<p class="border-b py-2 text-sm">${escapeHtml(item.action)} · ${escapeHtml(item.operatorName)} · ${escapeHtml(item.operatedAt)}<br>${escapeHtml(item.remark)}</p>`).join('') : '<p class="mt-2 text-sm text-slate-500">暂无逐批加工记录；已有历史累计数量仍予保留。</p>'
}

function renderHistory(order: PrintingWorkOrderBusinessRecord): string {
  if (!order.documentHistory.length) return '<p class="text-sm text-slate-500">暂无打印历史。</p>'
  return `<div class="space-y-2">${order.documentHistory.map((item) => `<div class="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[140px_80px_1fr_150px]"><strong>${escapeHtml(item.documentName)}</strong><span>${escapeHtml(item.action)}</span><span>${escapeHtml(item.versionNo)} · ${escapeHtml(item.remark || '—')}</span><span class="text-xs text-slate-500">${escapeHtml(item.operatorName)}<br>${escapeHtml(item.operatedAt)}</span></div>`).join('')}</div>`
}

function renderLogs(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="space-y-2">${order.operationLogs.map((log) => `<div class="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[150px_150px_1fr_160px]"><strong>${escapeHtml(log.action)}</strong><span>${escapeHtml(log.operatorName)}</span><span>${escapeHtml(log.remark || '—')}</span><span class="text-xs text-slate-500">${escapeHtml(log.operatedAt)}</span></div>`).join('')}</div>`
}

function renderDetail(order: PrintingWorkOrderBusinessRecord): string {
  const processTone: Parameters<typeof badge>[1] = order.processingStatus === 'PROCESS_COMPLETED' ? 'green' : order.processingStatus === 'PROCESSING' ? 'blue' : order.processingStatus === 'CANCELLED' ? 'red' : 'amber'
  const receiptTone: Parameters<typeof badge>[1] = order.receiptStatus === 'RECEIVED' ? 'green' : order.receiptStatus === 'RECEIPT_DIFFERENCE' ? 'red' : order.receiptStatus === 'WAIT_SOURCE' ? 'slate' : 'amber'
  const handoverTone: Parameters<typeof badge>[1] = order.handoverStatus === 'FULL_HANDOVER' ? 'green' : order.handoverStatus === 'NOT_READY' ? 'slate' : order.handoverStatus === 'PARTIAL_HANDOVER' ? 'amber' : 'blue'
  const inputUnit = escapeHtml(order.plannedInput.qtyUnit)
  const outputUnit = escapeHtml(order.output.qtyUnit)
  return `<div class="space-y-4 p-4" data-printing-detail-workspace>
    <header class="rounded-xl border bg-white p-5"><div class="flex flex-wrap items-start justify-between gap-4"><div class="flex items-start gap-4">${imageButton(order.product)}<div><div class="flex flex-wrap items-center gap-2"><h1 class="text-xl font-semibold">印花加工单 ${escapeHtml(order.printOrderNo)}</h1>${isPrintingWorkOrderBusinessCompleted(order) ? badge('已完成', 'green') : ''}</div><p class="mt-2 text-sm text-slate-600">任务 ${escapeHtml(order.taskNo)} · ${escapeHtml(order.product.spu)} · ${escapeHtml(order.product.productName)}</p><p class="mt-1 text-sm text-slate-600">接收方：${escapeHtml(order.receivingTargetName || '待生成')} · ${escapeHtml(order.receivingTargetWarehouseName || '—')}</p></div></div><a class="rounded-md border px-3 py-2 text-sm" href="/fcs/craft/printing/work-orders" data-nav="/fcs/craft/printing/work-orders">返回列表</a></div>
      <div class="mt-5 flex flex-wrap gap-2">${renderCurrentActions(order)}</div>
      <div class="mt-4 flex flex-wrap gap-2 border-t pt-4">${printButton('印花信息单', 'PRINTING_INFO_SHEET', order)}${printButton('印花确认单', 'PRINTING_CONFIRMATION', order)}${order.printingDocumentsNeedReprint ? badge('投入已变更，信息单/确认单需重印', 'amber') : ''}</div>
    </header>
    <section class="flex flex-wrap gap-4 rounded-lg border bg-white p-3 text-sm" aria-label="加工单三个状态维度"><span>接收 ${badge(order.historicalInputQuantityUnknown ? '历史接收待补录' : PRINTING_RECEIPT_STATUS_LABEL[order.receiptStatus], receiptTone)}</span><span>加工 ${badge(PRINTING_PROCESSING_STATUS_LABEL[order.processingStatus], processTone)}</span><span>交出 ${badge(PRINTING_HANDOVER_STATUS_LABEL[order.handoverStatus], handoverTone)}</span></section>
    ${section('1. 基本信息', `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${field('来源类型', PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type])}${field('来源单据', order.demandSource.sourceLabel)}${field('需求单', order.demandSource.demandNo || '—')}${field('生产单', order.demandSource.productionOrderNo || order.demandSource.originalProductionOrderNo || '—')}${field('采购单', order.demandSource.purchaseOrderNo || '—')}${field('备货计划', order.demandSource.stockPlanNo || '—')}${field('补料单', order.demandSource.supplementOrderNo || '—')}${field('加工厂', order.printFactoryName)}${field('下单时间', order.orderedAt)}${field('预计完成', order.plannedFinishAt || '待确定')}</div>`)}
    ${section('2. 加工投入／上游', `${renderPrintingRelations(order, 'upstream')}<div class="grid gap-6 lg:grid-cols-2"><div><h3 class="mb-3 text-sm font-semibold">计划加工投入</h3>${renderInputIdentity(order)}<div class="mt-4 grid gap-3 sm:grid-cols-2">${field('计划投入', `${formatPrintingQty(order.plannedInput.plannedQty)} ${inputUnit}`)}${field('来源仓', order.plannedInput.sourceWarehouseName)}${field('当前库存', `${formatPrintingQty(order.plannedInput.currentStockQty)} ${inputUnit}`)}${field('待印数量', `${formatPrintingQty(order.plannedInput.pendingPrintQty)} ${inputUnit}`)}</div></div><div><h3 class="mb-3 text-sm font-semibold">实际加工投入</h3><div class="mb-3 flex items-center gap-3">${imageButton(printingInputIdentity(order))}<span>${escapeHtml(printingInputIdentity(order).identityLabel)}：${escapeHtml(printingInputIdentity(order).materialName)}</span></div><div class="grid gap-3 sm:grid-cols-2">${field('实际物料编码', printingMaterialCode(order.actualInput.actualSku) || (order.historicalInputQuantityUnknown ? '历史未记录' : '未接收'))}${field('接收数量/卷', order.historicalInputQuantityUnknown ? '历史未记录' : `${formatPrintingQty(order.actualInput.receivedQty)} ${inputUnit} / ${order.actualInput.receivedRollCount} 卷`)}${field('接收人', order.actualInput.receiverName)}${field('接收时间', order.actualInput.receivedAt || '—')}</div></div></div><details class="mt-4"><summary class="cursor-pointer text-blue-700">用量依据</summary><div class="mt-3"><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">${field('计算方式', order.usage.calculationMode === 'BY_USAGE' ? '按单位用量计算' : '直接计划数量')}${field('需求基数', `${formatPrintingQty(order.usage.demandBaseQty)} ${order.usage.demandBaseUnit}`)}${field('标准单位用量', `${formatPrintingUsage(order.usage.standardUnitUsage)} ${order.usage.orderUnitUsage === null ? '' : order.usage.usageUnit}`)}${field('加工单单位用量', `${formatPrintingUsage(order.usage.orderUnitUsage)} ${order.usage.orderUnitUsage === null ? '' : order.usage.usageUnit}`)}${field('计划投入计算', order.usage.formulaLabel)}</div></div></details><details class="mt-4"><summary class="cursor-pointer text-blue-700">接收批次</summary>${renderReceiptBatches(order)}</details><details class="mt-4"><summary class="cursor-pointer text-blue-700">投入调整历史</summary>${renderChangeHistory(order)}</details>`)}
    ${section('3. 加工要求', renderRequirement(order))}
    ${section('4. 加工记录', `<div class="mb-4 grid gap-4 sm:grid-cols-2">${field('实际使用投入', `${formatPrintingQty(order.actualInput.usedQty)} ${inputUnit}`)}${field('使用卷数', order.historicalRollQuantitiesUnknown ? '历史未记录' : `${order.actualInput.usedRollCount} 卷`)}${field('转印完成', `${formatPrintingQty(order.transferCompletedQty)} ${outputUnit}`)}</div><div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${field('打印机', order.printerNo)}${field('加工完成时间', order.completedAt || '—')}</div><details class="mt-4"><summary class="cursor-pointer text-blue-700">加工批次记录</summary>${renderProcessingBatches(order)}</details>`)}
    ${section('5. 加工产出／下游', `<div class="grid gap-6 lg:grid-cols-2">${renderOutputIdentity(order)}<div class="grid gap-4 sm:grid-cols-2">${field('计划完成', `${formatPrintingQty(order.output.plannedQty)} ${outputUnit}`)}${field('实际完成', `${formatPrintingQty(order.output.completedQty)} ${outputUnit}`)}${field('完成卷数', order.historicalRollQuantitiesUnknown ? '历史未记录' : `${order.output.completedRollCount} 卷`)}</div></div><div class="mt-4">${renderPrintingRelations(order, 'downstream')}${renderHandoverBatches(order)}<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${field('交出单', order.handover.handoverNo || '—')}${field('交出时间', order.handover.handedOverAt || '—')}${field('累计交出', `${formatPrintingQty(order.handover.handedOverQty)} ${outputUnit}`)}${field('下游实收', `${formatPrintingQty(order.handover.receivedQty)} ${outputUnit}`)}${field('下游接收时间', order.handover.receivedAt || '—')}${field('差异说明', order.handover.differenceReason || '无')}</div>${field('下游待接收', `${formatPrintingQty(order.pendingWritebackQty)} ${outputUnit}`)}${field('差异／异议', `${order.confirmedReceiptDifference ? formatPrintingQty(order.handover.diffQty) : '无已确认差异'} / ${order.handover.objectionQty} 条异议`)}</div><details class="mt-4"><summary class="cursor-pointer text-blue-700">卷记录（含草稿）${order.barcodes.length} 条</summary>${renderBarcodes(order)}${actionButton('管理卷记录／草稿', 'open-barcodes', order)}</details>`)}
    ${section('6. 日志与单据', `<details><summary class="cursor-pointer text-blue-700">打印历史</summary>${renderHistory(order)}</details><details class="mt-4"><summary class="cursor-pointer text-blue-700">操作日志</summary>${renderLogs(order)}</details><p class="mt-4 text-sm">备注：${escapeHtml(order.remark || '无')}</p>`)}
  </div>`
}

export function renderCraftPrintingWorkOrderDetailPage(printOrderId: string): string {
  currentWorkOrderId = printOrderId
  const order = getPrintingWorkOrderById(printOrderId)
  if (!order) return `<div class="space-y-4 p-4"><h1 class="text-xl font-semibold">印花加工单详情</h1><p class="rounded-lg border bg-white p-6 text-sm text-slate-500">未找到对应印花加工单。</p><a class="inline-flex rounded-md border px-3 py-2 text-sm" href="/fcs/craft/printing/work-orders" data-nav="/fcs/craft/printing/work-orders">返回列表</a></div>`
  return `<div data-printing-work-order-detail-root data-work-order-id="${escapeHtml(order.workOrderId)}" data-skip-page-rerender="true"><div data-printing-detail-surface>${renderDetail(order)}</div><div data-printing-dialog-surface>${renderPrintingDialog()}</div></div>`
}

export function refreshPrintingWorkOrderDetailPage(): void {
  if (typeof document === 'undefined') return
  const order = getPrintingWorkOrderById(currentWorkOrderId)
  const surface = document.querySelector<HTMLElement>('[data-printing-detail-surface]')
  if (order && surface) surface.innerHTML = renderDetail(order)
}
