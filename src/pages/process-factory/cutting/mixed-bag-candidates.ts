import { readReplacementFabricState } from '../../../data/fcs/cutting/replacement-fabric-repository.ts'
import { listReplacementFabricOrderRows } from '../../../data/fcs/cutting/replacement-fabric-source.ts'
import { replacementTicketCode, assertReplacementTicketCurrent } from '../../../data/fcs/cutting/replacement-fabric-fei-tickets.ts'
import { replacementFabricBagTicket, mixedBagTicketFields } from '../../../data/fcs/cutting/mixed-transfer-bag-ticket.ts'
import type { TransferBagTicketFactSnapshot } from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { TransferBagTicketCandidate } from './transfer-bags-model.ts'
import { buildBindingProcessOrders } from './binding-strip-orders.ts'
import type { WaitHandoverRuntimeTicketInput } from './wait-handover-runtime.ts'

function candidateFromFabric(ticket: TransferBagTicketFactSnapshot): TransferBagTicketCandidate {
  return { ...mixedBagTicketFields(ticket as unknown as Record<string, unknown>),
    ticketRecordId: ticket.feiTicketId, feiTicketId: ticket.feiTicketId, ticketNo: ticket.feiTicketNo,
    productionOrderId: ticket.productionOrderId, productionOrderNo: ticket.productionOrderNo,
    sourceSpreadingSessionId: '', sourceSpreadingSessionNo: '', sourceMarkerId: '', sourceMarkerNo: '',
    cutOrderId: '', cutOrderNo: '', markerPlanId: '', markerPlanNo: '', styleCode: '', spuCode: '',
    fabricRollNo: '', fabricColor: ticket.color, color: ticket.color, size: '', partCode: '', partName: '', bundleNo: '',
    qty: 0, actualCutPieceQty: 0, garmentQty: 0, materialSku: ticket.materialCode || '', materialAlias: ticket.materialName,
    materialImageUrl: ticket.materialImageUrl, sourceContextType: ticket.ticketKind || '', ticketStatus: 'PRINTED', printStatus: 'PRINTED' }
}
export function listMixedFabricBagCandidates(): TransferBagTicketCandidate[] {
  const binding = buildBindingProcessOrders().filter(order => order.status !== '已取消' && order.processMode === '裁床内部加工')
    .flatMap(order => order.bindingDetails.filter(detail => detail.actualLength > 0 && detail.printStatus === '已打印' && detail.handoverStatus !== '已交出')
      .map(detail => candidateFromFabric({ ticketKind: 'BINDING_STRIP', feiTicketId: detail.feiTicketId, feiTicketNo: detail.feiTicketNo,
        productionOrderId: order.sourceProductionOrderId, productionOrderNo: order.sourceProductionOrderNo,
        materialCode: order.materialIdentity.materialSku, materialName: order.materialIdentity.materialName,
        materialImageUrl: order.materialIdentity.materialImageUrl, color: order.materialIdentity.materialColor,
        quantity: detail.actualLength, quantityUnit: '米', pieceQty: 0, cutOrderId: '', cutOrderNo: '', size: '', partCode: '', partName: '',
        sewingTaskId: '', sewingTaskNo: '', receiverFactoryId: '', receiverFactoryName: '' })))
  let state
  try { state = readReplacementFabricState() } catch { return binding } // 非裁床调用和 Node 夹具不初始化数据库；命名页面入口已等待读取。
  const scopes = listReplacementFabricOrderRows().flatMap(row => row.scopes)
  const replacement = state.tickets.filter(ticket => {
    try { assertReplacementTicketCurrent(ticket, scopes) } catch { return false }
    return state.prints.some(record => record.ticketId === ticket.id) && !state.receipts.some(receipt => receipt.ticket.id === ticket.id)
  }).map(ticket => ({ ...candidateFromFabric(replacementFabricBagTicket(ticket)), scanValue: replacementTicketCode(ticket) }))
  return [...binding, ...replacement]
}
export function fabricCandidateRuntimeTicket(ticket: TransferBagTicketCandidate): WaitHandoverRuntimeTicketInput {
  return { ...mixedBagTicketFields(ticket as unknown as Record<string, unknown>), feiTicketId: ticket.feiTicketId, feiTicketNo: ticket.ticketNo,
    productionOrderId: ticket.productionOrderId, productionOrderNo: ticket.productionOrderNo,
    cutOrderId: '', cutOrderNo: '', spreadingOrderId: '', spreadingOrderNo: '', spuCode: ticket.spuCode,
    color: ticket.color, size: '', partCode: '', partName: '', pieceQty: 0, pieceSequenceLabel: '',
    hasSpecialCraft: false, specialCraftDisplay: '无', receiverFactoryDisplay: '', printStatus: '已打印', voidStatus: '有效' }
}
