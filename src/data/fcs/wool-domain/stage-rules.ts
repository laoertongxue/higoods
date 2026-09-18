import type { WoolDomainStore } from './store.ts'
import type { WoolWorkOrder } from './types.ts'

export function woolSkuGenerationIssues(order: WoolWorkOrder, sku: string): string[] {
  return [...order.generationIssues, ...(order.generationIssuesBySku?.[sku] ?? [])]
}

export function woolOrderGenerationIssues(order: WoolWorkOrder): string[] {
  return [...new Set([...order.generationIssues, ...Object.values(order.generationIssuesBySku ?? {}).flat(),
    ...order.externalPieces.flatMap(piece => piece.issues)])]
}

/** Stage quantities use effective facts. Non-outsourced progress is garment-equivalent, never physical pieces. */
export function stageReportedQty(store: WoolDomainStore, orderId: string, sku: string): number {
  return store.processReports.filter(r => r.woolOrderId === orderId && r.outputSkuCode === sku).reduce((sum, r) =>
    sum + ([...store.qtyChangeLogs].reverse().find(c => c.recordType === 'PROCESS_REPORT' && c.recordId === r.reportId)?.afterQty ?? r.reportedQty), 0)
}

export function stageHandoverQty(store: WoolDomainStore, orderId: string, sku: string): number {
  return store.handovers.filter(h => h.woolOrderId === orderId && h.outputSkuCode === sku && !h.pieceKey).reduce((sum, h) =>
    sum + ([...store.qtyChangeLogs].reverse().find(c => c.recordType === 'HANDOVER' && c.recordId === h.handoverId)?.afterQty ?? h.handoverQty), 0)
}

export function linkingCapacity(store: WoolDomainStore, order: WoolWorkOrder, sku: string): number {
  const horizontal = store.workOrders[order.pairedWorkOrderId]
  if (!horizontal || horizontal.stage !== 'KNITTING') return 0
  const pieces = order.externalPieces.filter(p => p.skuCode === sku)
  if (woolSkuGenerationIssues(order, sku).length || pieces.some(p => p.issues.length)) return 0
  const internal = store.internalReceipts.filter(r => r.woolOrderId === order.woolOrderId && r.outputSkuCode === sku).reduce((n, r) => n + r.qty, 0)
  return Math.min(stageReportedQty(store, horizontal.woolOrderId, sku), internal, ...pieces.map(piece =>
    Math.floor(store.pieceReceipts.filter(r => r.woolOrderId === order.woolOrderId && r.pieceKey === piece.pieceKey).reduce((n, r) => n + r.qty, 0) / piece.pieceCountPerGarment)))
}

export function pieceAvailableQty(store: WoolDomainStore, order: WoolWorkOrder, pieceKey: string): number {
  const piece = order.externalPieces.find(p => p.pieceKey === pieceKey)
  if (!piece || order.stage !== 'KNITTING' || piece.issues.length || woolSkuGenerationIssues(order, piece.skuCode).length) return 0
  return Math.max(0, stageReportedQty(store, order.woolOrderId, piece.skuCode) * piece.pieceCountPerGarment
    - store.handovers.filter(h => h.woolOrderId === order.woolOrderId && h.pieceKey === pieceKey).reduce((n, h) => n + h.handoverQty, 0))
}

export function stageCompletionBlock(store: WoolDomainStore, order: WoolWorkOrder): string {
  const issues = woolOrderGenerationIssues(order)
  if (issues.length) return issues.join('；')
  if (order.outputPlanLines.some(l => stageReportedQty(store, order.woolOrderId, l.outputSkuCode) < l.plannedQty)) return '各 SKU 尚未达到计划加工数量'
  if (order.stage === 'KNITTING' && order.externalPieces.some(p => pieceAvailableQty(store, order, p.pieceKey) > 0 || p.issues.length)) return '仍有外发片未交出或路线未确定'
  if (order.outputPlanLines.some(l => stageHandoverQty(store, order.woolOrderId, l.outputSkuCode) < stageReportedQty(store, order.woolOrderId, l.outputSkuCode))) return '仍有已加工数量未交出'
  if (store.handovers.some(h => h.woolOrderId === order.woolOrderId &&
    (h.downstreamReceipt?.status !== 'CONFIRMED' || h.downstreamReceipt.actualReceivedQty !== ([...store.qtyChangeLogs].reverse().find(c=>c.recordType==='HANDOVER'&&c.recordId===h.handoverId)?.afterQty??h.handoverQty)))) return '直接下游尚未收齐，请核对交接差异'
  return ''
}
