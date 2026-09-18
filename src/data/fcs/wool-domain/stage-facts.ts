import { woolSkuGenerationIssues } from './stage-rules.ts'
import type { WoolDomainStore } from './store.ts'
import type { WoolProcessReportRecord, WoolWorkOrder, WoolWarehouseFlow } from './types.ts'

export function appendStageReport(store: WoolDomainStore, order: WoolWorkOrder, report: WoolProcessReportRecord): void {
  const line = order.outputPlanLines.find(l => l.outputSkuCode === report.outputSkuCode)!
  const location = line.outputObjectType === 'GARMENT'
    ? { defaultLocationType: 'GARMENT' as const, defaultLocationId: 'WOOL-WH-GARMENT-DEFAULT' as const }
    : { defaultLocationType: 'CUT_PIECE' as const, defaultLocationId: 'WOOL-WH-CUT-DEFAULT' as const }
  const base: WoolWarehouseFlow = {
    flowId: report.warehouseInboundFlowId, woolOrderId: order.woolOrderId,
    flowType: 'INBOUND', businessType: 'PROCESS_REPORT', warehouseMode: 'WAIT_HANDOVER', ...location,
    objectSkuCode: line.outputSkuCode, qty: report.reportedQty, unit: '件',
    sourceRecordType: 'PROCESS_REPORT', sourceRecordId: report.reportId,
    operatedAt: report.reportedAt, operatedBy: report.reportedBy,
  }
  store.processReports.push(report)
  store.warehouseFlows.push(base)
  const pieces = order.externalPieces.filter(p => p.skuCode === line.outputSkuCode)
  if (order.stage === 'LINKING') {
    for (const p of pieces) store.warehouseFlows.push({
      ...base, flowId: `${base.flowId}:consume:${p.pieceKey}`, flowType: 'OUTBOUND', objectSkuCode: p.pieceKey,
      unit: '片', qty: report.reportedQty * p.pieceCountPerGarment,
      defaultLocationType: 'CUT_PIECE', defaultLocationId: 'WOOL-WH-CUT-DEFAULT',
    })
    return
  }
  const linking = store.workOrders[order.pairedWorkOrderId]
  if (!linking || linking.stage !== 'LINKING') throw new Error('缺少对应缝盘加工单')
  const handoverId = `${report.reportId}:internal`
  store.handovers.push({
    handoverId, woolOrderId: order.woolOrderId, outputSkuCode: line.outputSkuCode,
    handoverQty: report.reportedQty, qtyUnit: '件', automatic: true, sourceReportId: report.reportId,
    targetWorkOrderId: linking.woolOrderId, receiverType: 'DOWNSTREAM_FACTORY',
    receiverId: linking.factoryId, receiverName: `${linking.factoryName} · ${linking.woolOrderNo}`,
    handedOverAt: report.reportedAt, handedOverBy: report.reportedBy,
    warehouseOutboundFlowId: `WF-${handoverId}`, createdAt: report.createdAt, updatedAt: report.updatedAt,
    downstreamReceipt: { receiptConfirmationId: `${handoverId}:receipt`, status: 'CONFIRMED',
      actualReceivedQty: report.reportedQty, differenceQty: 0, receivedAt: report.reportedAt, receivedBy: report.reportedBy },
    remark: pieces.length ? '不外发片对应件数，随横机填报内部衔接' : '无外加工，横机填报自动交出',
  })
  store.warehouseFlows.push({ ...base, flowId: `WF-${handoverId}`, flowType: 'OUTBOUND', businessType: 'HANDOVER', sourceRecordType: 'HANDOVER', sourceRecordId: handoverId })
  store.internalReceipts.push({ receiptId: `${handoverId}:receipt`, woolOrderId: linking.woolOrderId,
    sourceReportId: report.reportId, sourceHandoverId: handoverId, outputSkuCode: line.outputSkuCode,
    qty: report.reportedQty, receivedAt: report.reportedAt, receivedBy: report.reportedBy })
  for (const p of pieces) store.warehouseFlows.push({ ...base,
    flowId: `${base.flowId}:piece:${p.pieceKey}`, objectSkuCode: p.pieceKey, unit: '片',
    qty: report.reportedQty * p.pieceCountPerGarment,
    defaultLocationType: 'CUT_PIECE', defaultLocationId: 'WOOL-WH-CUT-DEFAULT',
  })
  if (!pieces.length && !woolSkuGenerationIssues(order, line.outputSkuCode).length) appendStageReport(store, linking, {
    ...report, reportId: `${report.reportId}:linking`, woolOrderId: linking.woolOrderId,
    warehouseInboundFlowId: `${report.warehouseInboundFlowId}:linking`, sourceReportId: report.reportId,
    remark: '无外加工，随横机填报自动缝盘',
  })
}
