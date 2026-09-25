import { listReplacementFabricOrderRows } from './replacement-fabric-source.ts'
import { readReplacementFabricState } from './replacement-fabric-repository.ts'
import { assertReplacementTicketCurrent, parseReplacementTicketCode } from './replacement-fabric-fei-tickets.ts'
import { listCuttingRuntimeEvents } from './cutting-runtime-event-ledger.ts'
import { resolveTransferBagCurrentUse } from './transfer-bag-operations.ts'
import { hydrateCuttingEventRecords } from './cutting-event-repository.ts'

export async function resolveReplacementFabricScan(raw: string, productionOrderId: string, targetBagCode?: string) {
  await hydrateCuttingEventRecords()
  return resolveReplacementFabricScanFromCurrent(raw, productionOrderId, targetBagCode)
}
export function resolveReplacementFabricScanFromCurrent(raw: string, productionOrderId?: string, targetBagCode?: string) {
  const state = readReplacementFabricState()
  const id = parseReplacementTicketCode(raw.trim())
  const ticket = state.tickets.find(ticket => id ? ticket.id === id : ticket.ticketNo === raw.trim())
  if (!ticket) throw new Error('未识别到换片布菲票，请扫描带 HPB 标识的二维码。')
  if (productionOrderId && ticket.productionOrderId !== productionOrderId) throw new Error('换片布票不属于当前生产单，请核对实物。')
  assertReplacementTicketCurrent(ticket, listReplacementFabricOrderRows().flatMap(row => row.scopes))
  if (!state.prints.some(record => record.ticketId === ticket.id)) throw new Error('这张换片布票尚未确认打印，请先核对出纸结果。')
  if (state.receipts.some(receipt => receipt.ticket.id === ticket.id)) throw new Error('这张换片布票已交出，不能重复使用；需要另一份时请新增独立票。')
  const bagCodes = new Set(listCuttingRuntimeEvents().flatMap(event => [event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || [])]).filter(Boolean))
  for (const code of bagCodes) {
    const current = resolveTransferBagCurrentUse(code)
    if (current.tickets.some(item => item.feiTicketId === ticket.id)) throw new Error(code === targetBagCode ? '本袋已经扫过这张换片布票，无需重复扫描。' : `这张换片布票已在 ${code} 中，请按该袋交出或先移出。`)
  }
  return ticket
}
