import type { TransferBagTicketFactSnapshot } from './cutting-runtime-event-ledger.ts'
import type { ReplacementFabricTicket } from './replacement-fabric-fei-tickets.ts'

export function isFabricBagTicket(ticket: Pick<TransferBagTicketFactSnapshot, 'ticketKind'>): boolean {
  return ticket.ticketKind === 'REPLACEMENT_FABRIC' || ticket.ticketKind === 'BINDING_STRIP'
}
export function validBagTicketQuantity(ticket: TransferBagTicketFactSnapshot): boolean {
  if (ticket.ticketKind === 'REPLACEMENT_FABRIC') return ticket.quantity === 5 && ticket.quantityUnit === 'Yard'
    && ticket.pieceQty === 0 && !!ticket.materialKey && !!ticket.materialCode && !!ticket.materialName
    && Number.isSafeInteger(ticket.replacementSequence) && Number(ticket.replacementSequence) > 0
  if (ticket.ticketKind === 'BINDING_STRIP') return Number.isFinite(ticket.quantity) && Number(ticket.quantity) > 0
    && !!ticket.quantityUnit && ticket.pieceQty === 0 && !!ticket.materialCode && !!ticket.materialName
  return (!ticket.ticketKind || ['CUT_PIECE', 'WOOL_PIECE'].includes(ticket.ticketKind))
    && Number.isFinite(ticket.pieceQty) && ticket.pieceQty > 0
}
export const MIXED_BAG_EXTRA_FIELDS = ['ticketKind', 'materialKey', 'materialCode', 'materialName', 'materialImageUrl', 'quantity', 'quantityUnit', 'replacementSequence'] as const
export function mixedBagTicketFields(value: Record<string, unknown>): Partial<TransferBagTicketFactSnapshot> {
  return Object.fromEntries(MIXED_BAG_EXTRA_FIELDS.filter(key => value[key] !== undefined).map(key => [key, value[key]]))
}
export function bagTicketFieldMissing(ticket: TransferBagTicketFactSnapshot, field: keyof TransferBagTicketFactSnapshot): boolean {
  if (field === 'pieceQty') return !validBagTicketQuantity(ticket)
  if (isFabricBagTicket(ticket) && ['cutOrderId', 'cutOrderNo', 'size', 'partCode', 'partName'].includes(field)) return false
  if (['cutOrderId', 'cutOrderNo'].includes(field) && ticket.feiTicketNo.startsWith('WOOL-PANEL:')) return false
  return !String(ticket[field] ?? '').trim()
}
export function replacementFabricBagTicket(ticket: ReplacementFabricTicket): TransferBagTicketFactSnapshot {
  return { ticketKind: 'REPLACEMENT_FABRIC', feiTicketId: ticket.id, feiTicketNo: ticket.ticketNo,
    productionOrderId: ticket.productionOrderId, productionOrderNo: ticket.productionOrderNo,
    materialKey: ticket.material.key, materialCode: ticket.material.code, materialName: ticket.material.name,
    materialImageUrl: ticket.material.imageUrl, color: ticket.material.color, replacementSequence: ticket.sequence,
    quantity: 5, quantityUnit: 'Yard', pieceQty: 0,
    cutOrderId: '', cutOrderNo: '', size: '', partCode: '', partName: '',
    sewingTaskId: '', sewingTaskNo: '', receiverFactoryId: '', receiverFactoryName: '' }
}
export function bagTicketQuantityLabel(ticket: TransferBagTicketFactSnapshot): string {
  return isFabricBagTicket(ticket) ? `${ticket.quantity} ${ticket.quantityUnit}` : `${ticket.pieceQty} 片`
}
export function bagTicketKindLabel(ticket: TransferBagTicketFactSnapshot): string {
  return ticket.ticketKind === 'REPLACEMENT_FABRIC' ? '换片布' : ticket.ticketKind === 'BINDING_STRIP' ? '捆条' : ticket.feiTicketNo.startsWith('WOOL-PANEL:') ? '毛织片' : '部位裁片'
}
