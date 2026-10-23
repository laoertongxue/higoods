import type { GeneratedFeiTicketSourceRecord } from './generated-fei-tickets.ts'

/** A print record can change the display state only for the same current physical ticket. */
export function projectReleaseTicketPrintState(
  tickets: readonly GeneratedFeiTicketSourceRecord[],
  records: readonly Record<string, unknown>[],
): GeneratedFeiTicketSourceRecord[] {
  const byId = new Map(records.map(record => [record.ticketRecordId, record]))
  return tickets.map(ticket => {
    const saved = byId.get(ticket.feiTicketId)
    if (!saved || ticket.sourceBasisType !== 'ACTUAL_CUTTING_OUTPUT' || ticket.printStatus === 'VOIDED'
      || saved.ticketNo !== ticket.feiTicketNo
      || saved.sourceBasisType !== ticket.sourceBasisType
      || saved.productionOrderId !== ticket.productionOrderId
      || saved.cutOrderId !== ticket.cutOrderId
      || saved.sourceSpreadingSessionId !== ticket.sourceSpreadingSessionId
      || saved.sourceOutputLineId !== ticket.sourceOutputLineId
      || saved.skuCode !== ticket.skuCode
      || saved.skuColor !== ticket.skuColor || saved.skuSize !== ticket.skuSize
      || saved.fabricColor !== ticket.fabricColor || saved.materialSku !== ticket.materialSku
      || saved.qrValue !== ticket.qrValue
      || saved.partCode !== ticket.partCode
      || (saved.partInstanceNo || '') !== (ticket.partInstanceNo || '')
      || saved.actualCutPieceQty !== ticket.actualCutPieceQty
      || saved.quantity !== ticket.actualCutPieceQty) return ticket
    if (saved.status === 'VOIDED') return { ...ticket, printStatus: 'VOIDED' }
    if (saved.status !== 'PRINTED' || !['PRINTED', 'REPRINTED'].includes(String(saved.printStatus))) return ticket
    return { ...ticket, printStatus: saved.printStatus as 'PRINTED' | 'REPRINTED' }
  })
}
