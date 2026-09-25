import { getPdaSession, listFactoryPdaRoles } from '../store-domain-pda.ts'
import type { BrowserStorageLike } from '../../browser-storage.ts'
import type { CuttingRuntimeEvent, TransferBagTicketFactSnapshot } from './cutting-runtime-event-ledger.ts'
import { resolveTransferBagCurrentUse } from './transfer-bag-operations.ts'
import { listReplacementFabricOrderRows, resolveReplacementFabricRuntimeTaskContext } from './replacement-fabric-source.ts'
import { assertReplacementTicketCurrent, validateReplacementFabricHandover, type ReplacementFabricState, type ReplacementFabricTicket } from './replacement-fabric-fei-tickets.ts'
import { replacementFabricBagTicket } from './mixed-transfer-bag-ticket.ts'

/** 提交整个动作后的新事件统一校验；覆盖所有袋的并集，任何失败都还未进入持久事务。 */
export function validateReplacementFabricEventBatch(input: {
  state: ReplacementFabricState; before: CuttingRuntimeEvent[]; after: CuttingRuntimeEvent[]; storage: BrowserStorageLike
}): void {
  const oldIds = new Set(input.before.map(event => event.eventId))
  const added = input.after.filter(event => !oldIds.has(event.eventId) && event.eventStatus !== '已取消')
  const scopes = listReplacementFabricOrderRows().flatMap(row => row.scopes)
  // 重装与交出同一事务时，用已重装、尚未交出的占用事实检查本次袋范围。
  const preHandover = input.after.filter(event => oldIds.has(event.eventId)
    || !['新增交出记录', '简易裁片交出'].includes(event.eventType))
  const bagCodes = new Set(preHandover.flatMap(event => [event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || [])]).filter(Boolean))
  const beforeRaw = JSON.stringify({ events: preHandover })
  const beforeStorage: BrowserStorageLike = { getItem: () => beforeRaw }
  const locations = new Map<string, string>()
  for (const code of bagCodes) {
    const use = resolveTransferBagCurrentUse(code, beforeStorage)
    use.tickets.forEach(ticket => locations.set(ticket.feiTicketId, use.usageCycleId || code))
  }
  const groups = new Map<string, { taskId: string; factoryId: string; ids: string[]; bagUseIds: string[]; pieceQty: number; events: CuttingRuntimeEvent[] }>()
  for (const event of added) {
    const payload = event.payload as unknown as Record<string, unknown>
    const items = event.eventType === '新增交出记录'
      ? ((payload.transferBagUses || []) as Array<{ ticketSnapshot?: TransferBagTicketFactSnapshot[] }>).flatMap(bag => bag.ticketSnapshot || [])
      : event.eventType === '简易裁片交出'
        ? [...((payload.tickets || []) as TransferBagTicketFactSnapshot[]), ...((payload.replacementFabricTickets || []) as TransferBagTicketFactSnapshot[])]
        : event.eventType === '中转袋拆袋重装'
          ? ((payload.resultBags || []) as Array<{ tickets?: TransferBagTicketFactSnapshot[] }>).flatMap(bag => bag.tickets || [])
          : ((payload.feiTicketItems || []) as TransferBagTicketFactSnapshot[])
    for (const item of items.filter(item => item.ticketKind === 'REPLACEMENT_FABRIC')) {
      const ticket = input.state.tickets.find(ticket => ticket.id === item.feiTicketId)
      if (!ticket) throw new Error(`换片布票 ${item.feiTicketNo} 不存在，请重新扫码。`)
      assertReplacementTicketCurrent(ticket, scopes)
      if (!input.state.prints.some(record => record.ticketId === ticket.id)) throw new Error(`换片布票 ${item.feiTicketNo} 尚未确认打印。`)
      const expected = replacementFabricBagTicket(ticket)
      for (const field of ['materialKey', 'materialCode', 'materialName', 'quantity', 'quantityUnit', 'replacementSequence', 'pieceQty', 'productionOrderId', 'productionOrderNo', 'color', 'materialImageUrl', 'feiTicketNo'] as const) {
        if (item[field] !== expected[field]) throw new Error(`换片布票 ${item.feiTicketNo} 的内容与原票不一致，请重新扫描。`)
      }
      if (input.state.receipts.some(receipt => receipt.ticket.id === ticket.id)) throw new Error(`换片布票 ${item.feiTicketNo} 已交出，不能重新装袋或交出。`)
    }
    if (!['新增交出记录', '简易裁片交出'].includes(event.eventType)) continue
    if (event.eventSource === 'PDA' && typeof document !== 'undefined') {
      const session = getPdaSession()
      const role = session && listFactoryPdaRoles(session.factoryId).find(role => role.roleId === session.roleId && role.status === 'ACTIVE')
      if (!role?.permissionKeys.includes('CUTTING_HANDOVER_CONFIRM')) throw new Error('当前账号没有裁床交出权限，请由仓管账号确认。')
    }
    if (!items.length || (event.eventType === '新增交出记录' && items.some(item => !item.sewingTaskId))) throw new Error('交出明细缺少当前车缝任务，请从任务交出入口重新核对。')
    const ids = event.eventType === '简易裁片交出' ? [String(payload.runtimeTaskId || '')] : [...new Set(items.map(item => item.sewingTaskId))]
    for (const taskId of ids) {
      const factoryId = String(payload.factoryId || payload.receiverId || '')
      const key = JSON.stringify([taskId, factoryId])
      const group = groups.get(key) || { taskId, factoryId, ids: [], bagUseIds: [], pieceQty: 0, events: [] }
      const taskItems = event.eventType === '简易裁片交出' ? items : items.filter(item => item.sewingTaskId === taskId)
      group.ids.push(...taskItems.filter(item => item.ticketKind === 'REPLACEMENT_FABRIC').map(item => item.feiTicketId))
      group.pieceQty += taskItems.filter(item => item.ticketKind !== 'REPLACEMENT_FABRIC' && item.ticketKind !== 'BINDING_STRIP').reduce((sum, item) => sum + Number(item.pieceQty || 0), 0)
      if (event.refs.usageCycleId) group.bagUseIds.push(event.refs.usageCycleId)
      group.events.push(event); groups.set(key, group)
    }
  }
  for (const group of groups.values()) {
    const context = resolveReplacementFabricRuntimeTaskContext(group.taskId, group.factoryId)
    const tickets = validateReplacementFabricHandover({ state: input.state, context, scopes, ticketIds: group.ids,
      selectedBagUseIds: group.bagUseIds, locations, cutPieceQty: group.pieceQty })
    for (const ticket of tickets) {
      const event = group.events.find(event => event.refs.feiTicketIds?.includes(ticket.id)
        || ((event.payload as unknown as { replacementFabricTickets?: TransferBagTicketFactSnapshot[] }).replacementFabricTickets || []).some(item => item.feiTicketId === ticket.id))!
      if (!event) throw new Error('换片布未绑定本次交出记录。')
      input.state.receipts.push({ id: `HPB-RECEIPT:${ticket.id}`, ticket: structuredClone(ticket) as ReplacementFabricTicket,
        taskId: group.taskId, receiverFactoryId: group.factoryId, handoverRecordId: event.refs.handoverRecordId || event.eventId,
        confirmedAt: event.occurredAt, confirmedBy: event.operatorName || '', bagUseId: event.refs.usageCycleId })
    }
  }
  // 同次装袋也不能让一张实物票占用两只袋；以最终使用周期检查，重装不误报来源袋。
  const afterBagCodes = new Set(input.after.flatMap(event => [event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || [])]).filter(Boolean))
  const occupied = new Map<string, string>()
  for (const code of afterBagCodes) for (const ticket of resolveTransferBagCurrentUse(code, input.storage).tickets) {
    if (ticket.ticketKind !== 'REPLACEMENT_FABRIC') continue
    const prior = occupied.get(ticket.feiTicketId)
    if (prior && prior !== code) throw new Error(`换片布票已经装入 ${prior}，不能重复装入 ${code}。`)
    occupied.set(ticket.feiTicketId, code)
  }
}
