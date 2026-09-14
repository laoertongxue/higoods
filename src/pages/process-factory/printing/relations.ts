import { getFactoryReceivingSource, getSourceActualReceipts } from '../../../data/fcs/factory-receiving.ts'
import { dyePartnerFields } from '../../../data/fcs/dye-work-order-demo-details.ts'
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
  const source = facts.source ??= getPrintingMaterialReceiptOptions(order.workOrderId)
  facts.names = [...new Set(source.options.map(item => item.sourceWarehouseName || item.predecessorOrderNo || item.label))]
  return facts.names
}
export function renderPrintingRelations(order: PrintingWorkOrderBusinessRecord, direction: 'upstream' | 'downstream'): string {
  const facts = factsFor(order)
  if (!facts.relationRead) {
    const source = facts.source ??= getPrintingMaterialReceiptOptions(order.workOrderId)
    // An explicit warehouse-to-factory-to-warehouse supply already identifies
    // both organizations. Do not infer another route from its product reference.
    const warehouseFlow = source.sourceMode === 'CENTRAL_TRANSFER' && order.receivingTargetId?.startsWith('WH-')
    facts.relation = warehouseFlow ? undefined : getProcessOrderTaskRelationView(order.workOrderId)
    facts.relationRead = true
  }
  const relation = facts.relation
  const refs = direction === 'upstream' ? relation?.predecessors : relation?.successors
  const pending = direction === 'upstream' ? relation?.pendingPredecessors : relation?.pendingSuccessors
  const links = (refs || []).map(ref => ref.href ? `<a class="text-blue-700" href="${escapeHtml(ref.href)}" data-nav="${escapeHtml(ref.href)}">${escapeHtml(ref.processName)} · ${escapeHtml(ref.documentNo)}</a>` : escapeHtml(`${ref.processName} · ${ref.documentNo}`)).join('<br>')
  if (direction === 'downstream') return `<div class="space-y-1"><p class="font-medium text-slate-500">下游</p>下道：${links || (pending?.length ? escapeHtml(pending.map(item => item.processName).join('、')) + ' · 加工单待生成' : '待确定')}<p>接收方：${escapeHtml(order.receivingTargetName || '接收方待确定')}</p>${order.receivingTargetWarehouseName && order.receivingTargetWarehouseName !== order.receivingTargetName ? `<p>接收仓：${escapeHtml(order.receivingTargetWarehouseName)}</p>` : ''}<p>接收方编号：${escapeHtml(order.receivingTargetId || '待确认')}</p><p>接收人：${escapeHtml(order.handover.receivedBy || '待确认')}</p></div>`
  const source = facts.source ??= getPrintingMaterialReceiptOptions(order.workOrderId)
  const ids = new Set([...source.options.map(item => item.recordId), ...(order.actualInput.receipts || []).map(item => item.upstreamRecordId).filter((id): id is string => Boolean(id))])
  const documents = [...ids].flatMap(id => {
    const document = getFactoryReceivingSource(id)
    if (!document) return []
    const receivedLineIds = new Set(getSourceActualReceipts(id).filter(receipt =>
      order.actualInput.receipts?.some(item => item.receiptId === `FRP-${receipt.id}-${order.workOrderId}`),
    ).map(receipt => receipt.sourceLineId))
    const lines = document.lines.filter(line => line.printingOrderId === order.workOrderId || receivedLineIds.has(line.id))
    return lines.length ? [{ document, lines }] : []
  })
  const groups = [...new Set(documents.map(({ document }) => `${document.origin.kind}:${document.origin.id}`))]
  const field = (label: string, value: string) => `<p><span class="text-muted-foreground">${escapeHtml(label)}：</span>${escapeHtml(value)}</p>`
  const body = groups.map(key => {
    const group = documents.filter(({ document }) => `${document.origin.kind}:${document.origin.id}` === key)
    return `<section class="space-y-2" data-printing-upstream-partner>${dyePartnerFields(group[0].document.origin).map(([label,value]) => field(label,value)).join('')}${group.map(({document,lines}) => {
      const type = document.type === 'TRANSFER' ? '调拨单' : document.type === 'ISSUE' ? '出库单' : '交出单'
      const status = document.voidedAt ? '已作废' : document.type === 'TRANSFER' ? (document.approvedAt ? '审核通过' : '待审核') : (document.handedOutAt ? (document.type === 'ISSUE' ? '已出库' : '已实际交出') : '尚未发出')
      const quantity = (kind: 'plannedQty' | 'sentQty') => [...new Set(lines.map(line=>line.unit))].map(unit => `${Number(lines.filter(line=>line.unit===unit).reduce((n,line)=>n+line[kind],0).toFixed(4))} ${unit}`).join(' / ')
      const href = `/fcs/craft/printing/pending-receipts?workOrderId=${encodeURIComponent(order.workOrderId)}&sourceId=${encodeURIComponent(document.id)}`
      return `<div class="space-y-1" data-printing-upstream-document><p><a class="break-all text-blue-700 hover:underline" href="${escapeHtml(href)}" data-nav="${escapeHtml(href)}">${escapeHtml(document.documentNo)}</a> <span class="text-muted-foreground">${type}</span></p>${field('单据状态',status)}${field('计划数量',quantity('plannedQty'))}${field(document.type === 'TRANSFER' ? '调拨数量' : document.type === 'ISSUE' ? '出库数量' : '交出数量',quantity('sentQty'))}</div>`
    }).join('')}</section>`
  }).join('')
  return `<div class="space-y-2"><p class="font-medium text-slate-500">上游</p>${body || `<p>${links || (pending?.length ? escapeHtml(pending.map(item=>item.processName).join('、')) + ' · 加工单待生成' : '供料单据待确定')}</p>`}</div>`
}

export function printingMaterialCode(value: string, output = false): string {
  return !value || /(?:tdv[-_]|techpack)|[\u4e00-\u9fff]/i.test(value) ? (output ? '产出编码待完善' : '物料编码待完善') : value
}
export function printingSpecification(image: { gsm: number; widthCm: number }): string {
  return [image.gsm > 0 ? `克重 ${image.gsm} g/㎡` : '', image.widthCm > 0 ? `幅宽 ${image.widthCm} cm` : ''].filter(Boolean).join(' · ')
}

/** Resolve the actual identity by exact SKU only; unknown historical actuals never borrow the planned image. */
export function printingInputIdentity(order: PrintingWorkOrderBusinessRecord) {
  const actual = order.actualInput.actualSku
  if (!order.historicalInputQuantityUnknown && order.actualInput.receivedQty === 0) return { ...order.plannedInput, identityLabel: '计划投入' }
  const exact = actual === order.plannedInput.sku ? order.plannedInput
    : order.inputChanges.flatMap(change => [change.newInput, change.originalInput]).find(item => item.sku === actual)
  if (actual && exact) return { ...exact, identityLabel: '实际投入' }
  if (!actual && !order.historicalInputQuantityUnknown && order.actualInput.receivedQty === 0) return { ...order.plannedInput, identityLabel: '计划投入' }
  return { ...order.plannedInput, sku: actual || '', materialName: actual && !/[\u4e00-\u9fff]/.test(actual) ? `实际物料 ${actual}（名称待补充）` : actual || '实际投入物料待补录', imageUrl: '', imageAlt: '实际投入物料图片待补充', gsm: 0, widthCm: 0, identityLabel: '实际投入' }
}
