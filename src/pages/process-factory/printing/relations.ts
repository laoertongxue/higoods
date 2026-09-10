import { getPreparationMaterialReceiptSources } from '../../../data/fcs/preparation-material-receipt-sources.ts'
import { getPrintingMaterialReceiptOptions } from '../../../data/fcs/printing-material-receipts.ts'
import { getProcessOrderTaskRelationView } from '../../../data/fcs/process-order-task-links.ts'
import type { PrintingWorkOrderBusinessRecord } from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'

// Object-scoped memoization: list rows live only until the next list reload.
// Detail/print readers receive fresh projected objects and never reuse old facts.
const relationFacts = new WeakMap<PrintingWorkOrderBusinessRecord, {
  names?: string[]
  relation?: ReturnType<typeof getProcessOrderTaskRelationView>
  relationRead?: boolean
  source?: ReturnType<typeof getPrintingMaterialReceiptOptions>
}>()
function factsFor(order: PrintingWorkOrderBusinessRecord) {
  let facts = relationFacts.get(order)
  if (!facts) { facts = {}; relationFacts.set(order, facts) }
  return facts
}

export function printingPatternLabel(value: string): string {
  return !value || /^(TDV[-_]|tdv_|techpack)/i.test(value) ? '花型编号待完善' : value
}
export function printingUpstreamNames(order: PrintingWorkOrderBusinessRecord): string[] {
  const facts = factsFor(order)
  if (facts.names) return facts.names
  const source = getPreparationMaterialReceiptSources(order.workOrderId, order.plannedInput.qtyUnit, [], { targetFactoryId: order.printFactoryId, targetTaskId: order.taskNo, materialCodes: [order.plannedInput.sku, order.plannedInput.spu] })
  facts.names = [...new Set(source.options.map(item => item.sourceWarehouseName || item.predecessorOrderNo || item.label))]
  return facts.names
}
export function renderPrintingRelations(order: PrintingWorkOrderBusinessRecord, direction: 'upstream' | 'downstream'): string {
  const facts = factsFor(order)
  if (!facts.relationRead) { facts.relation = getProcessOrderTaskRelationView(order.workOrderId); facts.relationRead = true }
  const relation = facts.relation
  const refs = direction === 'upstream' ? relation?.predecessors : relation?.successors
  const pending = direction === 'upstream' ? relation?.pendingPredecessors : relation?.pendingSuccessors
  const links = (refs || []).map(ref => ref.href ? `<a class="text-blue-700" href="${escapeHtml(ref.href)}" data-nav="${escapeHtml(ref.href)}">${escapeHtml(ref.processName)} · ${escapeHtml(ref.documentNo)}</a>` : escapeHtml(`${ref.processName} · ${ref.documentNo}`)).join('<br>')
  if (direction === 'downstream') return `<div>下道：${links || (pending?.length ? escapeHtml(pending.map(item => item.processName).join('、')) + ' · 加工单待生成' : '待确定')}<p>接收：${escapeHtml(order.receivingTargetName || '接收方待确定')}</p>${order.receivingTargetWarehouseName && order.receivingTargetWarehouseName !== order.receivingTargetName ? `<p>接收仓：${escapeHtml(order.receivingTargetWarehouseName)}</p>` : ''}</div>`
  const source = facts.source ??= getPrintingMaterialReceiptOptions(order.workOrderId)
  const receipts = order.actualInput.receipts || []
  return `<div>上游：${links || (printingUpstreamNames(order).length ? escapeHtml(printingUpstreamNames(order).join('、')) : pending?.length ? escapeHtml(pending.map(item => item.processName).join('、')) + ' · 加工单待生成' : '供料单据待确定')}${source.options.length ? `<details><summary class="cursor-pointer text-blue-700">供料单据 ${source.options.length} 笔</summary>${source.options.map(item => `<p>${escapeHtml(item.documentNo)} · 可收 ${item.availableQty} ${escapeHtml(item.unit)}</p>`).join('')}</details>` : ''}${receipts.length ? `<details><summary class="cursor-pointer text-blue-700">已收记录 ${receipts.length} 笔</summary>${receipts.map(item => `<p>${escapeHtml(item.upstreamRecordId || '历史来源待补录')} · ${item.qty} ${escapeHtml(order.plannedInput.qtyUnit)}</p>`).join('')}</details>` : ''}</div>`
}

export function printingMaterialCode(value: string, output = false): string {
  return !value || /(?:tdv[-_]|techpack)|[\u4e00-\u9fff]/i.test(value) ? (output ? '产出编码待完善' : '物料编码待完善') : value
}
export function printingSpecification(image: { gsm: number; widthCm: number }): string {
  return [image.gsm > 0 ? `${image.gsm} g/㎡` : '', image.widthCm > 0 ? `${image.widthCm} cm` : ''].filter(Boolean).join(' · ')
}

/** Resolve the actual identity by exact SKU only; unknown historical actuals never borrow the planned image. */
export function printingInputIdentity(order: PrintingWorkOrderBusinessRecord) {
  const actual = order.actualInput.actualSku
  const exact = actual === order.plannedInput.sku ? order.plannedInput
    : order.inputChanges.flatMap(change => [change.newInput, change.originalInput]).find(item => item.sku === actual)
  if (actual && exact) return { ...exact, identityLabel: '实际投入' }
  if (!actual && !order.historicalInputQuantityUnknown && order.actualInput.receivedQty === 0) return { ...order.plannedInput, identityLabel: '计划投入' }
  return { ...order.plannedInput, sku: actual || '', materialName: actual && !/[\u4e00-\u9fff]/.test(actual) ? `实际物料 ${actual}（名称待补充）` : actual || '实际投入物料待补录', imageUrl: '', imageAlt: '实际投入物料图片待补充', gsm: 0, widthCm: 0, identityLabel: '实际投入' }
}
