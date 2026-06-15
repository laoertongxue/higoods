import { listCutOrderCloseRecords } from './cut-order-close-records.ts'
import { listGeneratedFeiTickets } from './generated-fei-tickets.ts'
import {
  listHandoverRecords,
  listSpecialCraftReturnRecords,
} from './handover-orders.ts'
import { listCuttingMaterialLedgerEvents } from './material-ledger.ts'
import { listRuntimePdaExecutionEventProjections } from './cutting-runtime-event-ledger.ts'
import { listSpreadingDifferences } from './spreading-differences.ts'

export type CuttingMainlineLedgerEventStage =
  | '数量账'
  | 'PDA执行写回'
  | '铺布裁剪差异'
  | '裁片单关闭'
  | '菲票生成'
  | '交出记录'
  | '特殊工艺回仓'

export interface CuttingMainlineLedgerEvent {
  eventId: string
  eventStage: CuttingMainlineLedgerEventStage
  eventType: string
  sourceObjectType: string
  sourceObjectId: string
  sourceObjectNo: string
  productionOrderIds: string[]
  cutOrderIds: string[]
  occurredAt: string
  operatorName: string
  quantity: number
  unit: string
  ledgerEventIds: string[]
  traceText: string
}

function compact(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => `${value || ''}`.trim()).filter(Boolean)))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function buildPdaRuntimeEvents(): CuttingMainlineLedgerEvent[] {
  const store = listRuntimePdaExecutionEventProjections()
  const pdaEvents = [
    ...store.pickupEvents,
    ...store.inboundEvents,
    ...store.handoverEvents,
  ]
  if (!pdaEvents.length) {
    return [{
      eventId: 'PDA-RUNTIME-DEMO-WRITEBACK',
      eventStage: 'PDA执行写回',
      eventType: 'PDA现场扫码写回',
      sourceObjectType: 'CUTTING_RUNTIME_EVENT',
      sourceObjectId: 'PDA-RUNTIME-DEMO-WRITEBACK',
      sourceObjectNo: 'PDA-DEMO-CUTTING',
      productionOrderIds: ['PO-202603-0102'],
      cutOrderIds: ['CUT-260307-102-01'],
      occurredAt: '2026-05-23 10:30',
      operatorName: 'PDA 裁片仓操作员',
      quantity: 1,
      unit: '次',
      ledgerEventIds: ['PDA-RUNTIME-DEMO-WRITEBACK'],
      traceText: 'PDA现场扫码写回 / 裁床待交出仓 / 同一事实账',
    }]
  }

  return pdaEvents.map((record) => ({
    eventId: record.runtimeEventId,
    eventStage: 'PDA执行写回',
    eventType: record.actionType,
    sourceObjectType: 'CUTTING_RUNTIME_EVENT',
    sourceObjectId: record.sourceEventId || record.runtimeEventId,
    sourceObjectNo: record.executionOrderNo,
    productionOrderIds: compact([record.productionOrderId]),
    cutOrderIds: compact([record.cutOrderId]),
    occurredAt: record.actionAt || record.submittedAt,
    operatorName: record.operatorName,
    quantity: 0,
    unit: '',
    ledgerEventIds: [record.runtimeEventId],
    traceText: `${record.taskNo} / ${record.executionOrderNo} / ${record.actionType}`,
  }))
}

export function listCuttingMainlineLedgerEvents(): CuttingMainlineLedgerEvent[] {
  const materialEvents: CuttingMainlineLedgerEvent[] = listCuttingMaterialLedgerEvents().map((event) => ({
    eventId: event.eventId,
    eventStage: '数量账',
    eventType: event.eventType,
    sourceObjectType: event.sourceObjectType,
    sourceObjectId: event.sourceObjectId,
    sourceObjectNo: event.cutOrderNo,
    productionOrderIds: compact([event.productionOrderId]),
    cutOrderIds: compact([event.cutOrderId]),
    occurredAt: event.occurredAt,
    operatorName: event.operatorName,
    quantity: event.quantity,
    unit: event.unit,
    ledgerEventIds: [event.eventId],
    traceText: `${event.cutOrderNo} / ${event.materialAlias} / ${event.quantity} ${event.unit}`,
  }))

  const differenceEvents: CuttingMainlineLedgerEvent[] = listSpreadingDifferences().map((difference) => ({
    eventId: difference.differenceId,
    eventStage: '铺布裁剪差异',
    eventType: difference.differenceType,
    sourceObjectType: difference.sourceType,
    sourceObjectId: difference.sourceObjectId,
    sourceObjectNo: difference.spreadingOrderNo,
    productionOrderIds: difference.productionOrderIds,
    cutOrderIds: difference.cutOrderIds,
    occurredAt: difference.detectedAt,
    operatorName: difference.detectedBy,
    quantity: difference.differenceValue,
    unit: difference.unit,
    ledgerEventIds: difference.linkedLedgerEventIds,
    traceText: `${difference.spreadingOrderNo} / ${difference.differenceType} / ${difference.differenceValue} ${difference.unit}`,
  }))

  const closeEvents: CuttingMainlineLedgerEvent[] = listCutOrderCloseRecords().map((record) => ({
    eventId: record.closeRecordId,
    eventStage: '裁片单关闭',
    eventType: record.closeReasonText,
    sourceObjectType: record.closeSourceType,
    sourceObjectId: record.sourceDifferenceId || record.cutOrderId,
    sourceObjectNo: record.closeRecordNo,
    productionOrderIds: compact([record.productionOrderId]),
    cutOrderIds: compact([record.cutOrderId]),
    occurredAt: record.closedAt,
    operatorName: record.closedBy,
    quantity: record.ledgerSnapshotBeforeClose.availableQty,
    unit: record.ledgerSnapshotBeforeClose.unit,
    ledgerEventIds: record.linkedLedgerEventIds,
    traceText: `${record.cutOrderNo} / ${record.closeReasonText} / 关闭前可用余额 ${record.ledgerSnapshotBeforeClose.availableQty} ${record.ledgerSnapshotBeforeClose.unit}`,
  }))

  const feiTicketEvents: CuttingMainlineLedgerEvent[] = listGeneratedFeiTickets().map((ticket) => ({
    eventId: ticket.feiTicketId,
    eventStage: '菲票生成',
    eventType: ticket.sourceBasis,
    sourceObjectType: ticket.sourceBasisType,
    sourceObjectId: ticket.sourceOutputLineId,
    sourceObjectNo: ticket.feiTicketNo,
    productionOrderIds: compact([ticket.productionOrderId]),
    cutOrderIds: compact([ticket.cutOrderId]),
    occurredAt: ticket.issuedAt,
    operatorName: ticket.cuttingCompletedBy || '系统投影',
    quantity: ticket.actualCutPieceQty,
    unit: '片',
    ledgerEventIds: [ticket.sourceOutputLineId],
    traceText: `${ticket.feiTicketNo} / ${ticket.partName} / ${ticket.pieceSequenceLabel}`,
  }))

  const handoverEvents: CuttingMainlineLedgerEvent[] = listHandoverRecords().map((record) => ({
    eventId: record.handoverRecordId,
    eventStage: '交出记录',
    eventType: record.recordStatus,
    sourceObjectType: 'HANDOVER_RECORD',
    sourceObjectId: record.handoverRecordId,
    sourceObjectNo: record.handoverRecordNo,
    productionOrderIds: record.relatedProductionOrderIds,
    cutOrderIds: record.relatedCutOrderIds,
    occurredAt: record.handedOverAt,
    operatorName: record.handedOverBy,
    quantity: sum(record.currentHandedOverSummary.map((item) => item.pieceQty)),
    unit: '片',
    ledgerEventIds: [record.handoverRecordId],
    traceText: `${record.handoverOrderNo} / ${record.receiverName} / ${record.recordStatus}`,
  }))

  const specialCraftReturnEvents: CuttingMainlineLedgerEvent[] = listSpecialCraftReturnRecords().map((record) => ({
    eventId: record.returnRecordId,
    eventStage: '特殊工艺回仓',
    eventType: record.returnStatus,
    sourceObjectType: 'SPECIAL_CRAFT_RETURN',
    sourceObjectId: record.sourceHandoverRecordId,
    sourceObjectNo: record.returnRecordNo,
    productionOrderIds: compact(record.returnedFeiTicketItems.map((item) => item.productionOrderNo)),
    cutOrderIds: compact(record.returnedFeiTicketItems.map((item) => item.cutOrderNo)),
    occurredAt: record.returnedAt,
    operatorName: record.returnedBy,
    quantity: sum(record.returnedFeiTicketItems.map((item) => item.returnedQty)),
    unit: '片',
    ledgerEventIds: [record.sourceHandoverOrderId, record.sourceHandoverRecordId, record.returnRecordId],
    traceText: `${record.receiverFactoryName} / ${record.craftName} / ${record.returnStatus}`,
  }))

  return [
    ...materialEvents,
    ...buildPdaRuntimeEvents(),
    ...differenceEvents,
    ...closeEvents,
    ...feiTicketEvents,
    ...handoverEvents,
    ...specialCraftReturnEvents,
  ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'))
}

export function summarizeCuttingMainlineLedgerEvents() {
  const events = listCuttingMainlineLedgerEvents()
  return {
    totalEventCount: events.length,
    stageCounts: events.reduce<Record<CuttingMainlineLedgerEventStage, number>>((result, event) => {
      result[event.eventStage] = (result[event.eventStage] || 0) + 1
      return result
    }, {} as Record<CuttingMainlineLedgerEventStage, number>),
    productionOrderCount: compact(events.flatMap((event) => event.productionOrderIds)).length,
    cutOrderCount: compact(events.flatMap((event) => event.cutOrderIds)).length,
  }
}
