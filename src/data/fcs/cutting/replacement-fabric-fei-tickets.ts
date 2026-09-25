import { cuttingRecordUuid } from './cutting-record-identity.ts'
/** 换片布业务规则。数量、身份及交出集合独立于页面和存储，Web/PDA 共用。 */
export const REPLACEMENT_FABRIC_LENGTH = 5 as const
export const REPLACEMENT_FABRIC_UNIT = 'Yard' as const
export type ReplacementFabricMaterial = {
  key: string; code: string; name: string; color: string; imageUrl: string; skuCodes: string[]
}
export type ReplacementFabricScope = {
  productionOrderId: string; productionOrderNo: string; factoryId: string
  assignmentKey: string; materials: ReplacementFabricMaterial[]; issues: string[]
}
export interface ReplacementFabricTicket {
  id: string; ticketNo: string; sequence: number
  productionOrderId: string; productionOrderNo: string; cuttingFactoryId: string
  assignmentKey: string; material: ReplacementFabricMaterial
  length: 5; unit: 'Yard'; createdAt: string; createdBy: string; creationCommandId: string
  invalidatedAt?: string; invalidReason?: string
}
export interface ReplacementFabricPrintRecord {
  id: string; ticketId: string; commandId: string; printedAt: string; printedBy: string
  kind: 'FIRST_PRINT' | 'REPRINT'
}
export interface ReplacementFabricReceipt {
  id: string; ticket: ReplacementFabricTicket; taskId: string; receiverFactoryId: string
  handoverRecordId: string; confirmedAt: string; confirmedBy: string; bagUseId?: string
}
export interface ReplacementFabricState {
  tickets: ReplacementFabricTicket[]; prints: ReplacementFabricPrintRecord[]
  receipts: ReplacementFabricReceipt[]
}
export interface ReplacementFabricCommand { id: string; at: string; operator: string }

const text = (value: string | undefined) => (value || '').trim()
export function replacementFabricMaterialKey(code: string, color: string): string {
  if (!text(code)) throw new Error('面料编码缺失，请主管核对技术资料。')
  return JSON.stringify([text(code), text(color)])
}
export function isReplacementFabricMaterial(name: string, type: string): boolean {
  if (!text(name)) throw new Error('物料名称缺失，请主管核对后再打印或交出。')
  return type === '面料' && !text(name).includes('朴')
}
export function replacementTicketCode(ticket: Pick<ReplacementFabricTicket, 'id'>): string {
  return `HIG:HPB:1:${encodeURIComponent(ticket.id)}`
}
export function parseReplacementTicketCode(raw: string): string | null {
  if (!raw.startsWith('HIG:HPB:1:')) return null
  try { return decodeURIComponent(raw.slice('HIG:HPB:1:'.length)) || null } catch { return null }
}
function assertCommand(command: ReplacementFabricCommand): void {
  if (!text(command.id) || !text(command.at) || !text(command.operator)) throw new Error('操作信息不完整，请重新进入后重试。')
}
function assertScope(scope: ReplacementFabricScope): void {
  if (!scope.factoryId || !scope.assignmentKey) throw new Error('生产单已改派或尚未分配到裁床，请刷新。')
  if (scope.issues.length) throw new Error(scope.issues.join('；'))
}

/** 新增稳定 commandId 重放必须完全相同；在持久事务内调用并检查范围版本。 */
export function createReplacementFabricTickets(
  state: ReplacementFabricState, scope: ReplacementFabricScope, materialKey: string,
  count: number, command: ReplacementFabricCommand,
): ReplacementFabricTicket[] {
  assertCommand(command); assertScope(scope)
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error('每次新增请填写 1～100 张。每张固定 5 Yard。')
  const material = scope.materials.find(item => item.key === materialKey)
  if (!material) throw new Error('本生产单当前范围没有这种面料，请刷新后核对。')
  const previous = state.tickets.filter(ticket => ticket.creationCommandId === command.id)
  if (previous.length) {
    if (previous.length !== count || previous.some(ticket => ticket.productionOrderId !== scope.productionOrderId || ticket.material.key !== materialKey
      || ticket.assignmentKey !== scope.assignmentKey || ticket.cuttingFactoryId !== scope.factoryId)) {
      throw new Error('本次新增编号已经用于其他内容，请重新核对。')
    }
    return previous
  }
  const ids = Array.from({ length: count }, () => `HPB-${cuttingRecordUuid()}`)
  const sequence = Math.max(0, ...state.tickets.filter(ticket => ticket.productionOrderId === scope.productionOrderId
    && ticket.material.key === materialKey).map(ticket => ticket.sequence))
  if (!Number.isSafeInteger(sequence + count)) throw new Error('票序号超过可用范围，请联系负责人。')
  const created = ids.map((id, index): ReplacementFabricTicket => {
    const n = sequence + index + 1
    // 编码逐项转义，分隔符不能与业务编码混淆；不同类型有独立 HPB 前缀。
    const ticketNo = `HPB/${encodeURIComponent(scope.productionOrderNo)}/${encodeURIComponent(material.code)}/${encodeURIComponent(material.color)}/${String(n).padStart(3, '0')}`
    return { id, ticketNo, sequence: n, productionOrderId: scope.productionOrderId,
      productionOrderNo: scope.productionOrderNo, cuttingFactoryId: scope.factoryId,
      assignmentKey: scope.assignmentKey, material: structuredClone(material),
      length: REPLACEMENT_FABRIC_LENGTH, unit: REPLACEMENT_FABRIC_UNIT, createdAt: command.at, createdBy: command.operator, creationCommandId: command.id }
  })
  state.tickets.push(...created)
  return created
}

/** 只在分配动作／显式历史初始化动作运行；普通列表读取不调用。 */
export function reconcileReplacementFabricAssignment(
  state: ReplacementFabricState, productionOrderId: string, scopes: ReplacementFabricScope[], command: ReplacementFabricCommand,
): void {
  assertCommand(command)
  const relevant = scopes.filter(scope => scope.productionOrderId === productionOrderId)
  const handedOver = new Set(state.receipts.map(receipt => receipt.ticket.id))
  for (const ticket of state.tickets.filter(item => item.productionOrderId === productionOrderId)) {
    const valid = relevant.some(scope => scope.factoryId === ticket.cuttingFactoryId && scope.assignmentKey === ticket.assignmentKey
      && scope.materials.some(material => material.key === ticket.material.key))
    if (!valid && !ticket.invalidatedAt && !handedOver.has(ticket.id)) {
      ticket.invalidatedAt = command.at; ticket.invalidReason = '裁床分配或面料责任范围已变更'
    }
  }
  for (const scope of relevant) {
    if (scope.issues.length) continue
    for (const material of scope.materials) {
      const exists = state.tickets.some(ticket => ticket.productionOrderId === productionOrderId
        && ticket.cuttingFactoryId === scope.factoryId && ticket.assignmentKey === scope.assignmentKey
        && ticket.material.key === material.key && !ticket.invalidatedAt)
      if (!exists) createReplacementFabricTickets(state, scope, material.key, 1,
        { ...command, id: `${command.id}:${encodeURIComponent(scope.assignmentKey)}:${encodeURIComponent(material.key)}` })
    }
  }
}

export function assertReplacementTicketCurrent(ticket: ReplacementFabricTicket, scopes: ReplacementFabricScope[]): void {
  const scope = scopes.find(scope => scope.productionOrderId === ticket.productionOrderId
    && scope.factoryId === ticket.cuttingFactoryId && scope.assignmentKey === ticket.assignmentKey
    && scope.materials.some(material => material.key === ticket.material.key))
  if (ticket.invalidatedAt || !scope) {
    throw new Error(`换片布票 ${ticket.ticketNo} 已失效，请按当前裁床分配重新出票。`)
  }
  if (scope.issues.length) throw new Error(scope.issues.join('；'))
}
export function confirmReplacementFabricPrint(
  state: ReplacementFabricState, ticketIds: string[], scopes: ReplacementFabricScope[], command: ReplacementFabricCommand,
): ReplacementFabricPrintRecord[] {
  assertCommand(command)
  const ids = [...new Set(ticketIds)].sort()
  if (!ids.length) throw new Error('请勾选已经实际打印成功的票。')
  const prior = state.prints.filter(record => record.commandId === command.id)
  if (prior.length) {
    if (JSON.stringify(prior.map(record => record.ticketId).sort()) !== JSON.stringify(ids)) throw new Error('本次打印确认内容已变化，请重新核对。')
    return prior
  }
  const tickets = ids.map(id => {
    const ticket = state.tickets.find(item => item.id === id)
    if (!ticket) throw new Error('所选换片布票不存在，请刷新后重试。')
    // 历史已交票可以补打，补打不会恢复流转资格。
    if (!state.receipts.some(receipt => receipt.ticket.id === id)) assertReplacementTicketCurrent(ticket, scopes)
    return ticket
  })
  const records = tickets.map((ticket): ReplacementFabricPrintRecord => ({
    id: `${command.id}:${encodeURIComponent(ticket.id)}`, ticketId: ticket.id, commandId: command.id,
    printedAt: command.at, printedBy: command.operator,
    kind: state.prints.some(record => record.ticketId === ticket.id) ? 'REPRINT' : 'FIRST_PRINT',
  }))
  state.prints.push(...records)
  return records
}

export interface ReplacementFabricHandoverContext {
  taskId: string; receiverFactoryId: string; productionOrderId: string
  requiredMaterials: ReplacementFabricMaterial[]; issues: string[]; inScope: boolean
}
export function evaluateReplacementFabricCoverage(
  context: ReplacementFabricHandoverContext, receipts: ReplacementFabricReceipt[], currentTickets: ReplacementFabricTicket[],
) {
  const previous = new Set(receipts.filter(receipt => receipt.taskId === context.taskId
    && receipt.receiverFactoryId === context.receiverFactoryId && receipt.ticket.productionOrderId === context.productionOrderId)
    .map(receipt => receipt.ticket.material.key))
  const current = new Set(currentTickets.filter(ticket => ticket.productionOrderId === context.productionOrderId).map(ticket => ticket.material.key))
  const missing = context.inScope ? context.requiredMaterials.filter(material => !previous.has(material.key) && !current.has(material.key)) : []
  return { previous, current, missing, allowed: !context.inScope || (!context.issues.length && !missing.length) }
}

/** 整批（包括全部选中袋）一次检查；不得在单袋循环里各自检查缺料。 */
export function validateReplacementFabricHandover(input: {
  state: ReplacementFabricState; context: ReplacementFabricHandoverContext; scopes: ReplacementFabricScope[]
  ticketIds: string[]; selectedBagUseIds: string[]; locations: Map<string, string>; cutPieceQty: number
}): ReplacementFabricTicket[] {
  const { state, context } = input
  if (!context.inScope) {
    if (input.ticketIds.length) throw new Error('本任务自行裁剪，不适用裁床换片布随交。')
    return []
  }
  if (!context.taskId || !context.receiverFactoryId) throw new Error('任务或接收工厂不完整，请重新核对任务单。')
  if (context.issues.length) throw new Error(context.issues.join('；'))
  if (!(input.cutPieceQty > 0)) throw new Error('换片布必须与裁片同次确认，请加入本次要交出的裁片。')
  if (new Set(input.ticketIds).size !== input.ticketIds.length) throw new Error('同一换片布票在本次清单中重复，请核对装袋情况。')
  const tickets = input.ticketIds.map(id => {
    const ticket = state.tickets.find(item => item.id === id)
    if (!ticket) throw new Error('无法识别换片布票，请重新扫码。')
    assertReplacementTicketCurrent(ticket, input.scopes)
    if (ticket.productionOrderId !== context.productionOrderId) throw new Error('换片布票不属于本生产单。')
    if (!context.requiredMaterials.some(material => material.key === ticket.material.key)) throw new Error(`本任务不使用面料 ${ticket.material.name}，请移出后重新确认。`)
    if (!state.prints.some(record => record.ticketId === id)) throw new Error(`换片布票 ${ticket.ticketNo} 尚未确认打印。`)
    if (state.receipts.some(receipt => receipt.ticket.id === id)) throw new Error(`换片布票 ${ticket.ticketNo} 已交出，不能再次使用。`)
    const bag = input.locations.get(id)
    if (bag && !input.selectedBagUseIds.includes(bag)) throw new Error(`换片布票已装入其他中转袋，请将该袋加入本次交出或先移出。`)
    return ticket
  })
  const coverage = evaluateReplacementFabricCoverage(context, state.receipts, tickets)
  if (coverage.missing.length) throw new Error(`本次不能交出，缺少换片布：${coverage.missing.map(material => `${material.name}（${material.code} ${material.color}）`).join('、')}。请补齐对应菲票后与裁片一起确认。`)
  return tickets
}

export type MixedBagTicketQuantity =
  | { kind: 'CUT_PIECE' | 'WOOL_PIECE'; quantity: number; unit: '片' }
  | { kind: 'BINDING_STRIP'; quantity: number; unit: string }
  | { kind: 'REPLACEMENT_FABRIC'; quantity: 5; unit: 'Yard' }
export function summarizeMixedBagQuantities(items: MixedBagTicketQuantity[]): Array<{ kind: MixedBagTicketQuantity['kind']; quantity: number; unit: string; tickets: number }> {
  const groups = new Map<string, { kind: MixedBagTicketQuantity['kind']; quantity: number; unit: string; tickets: number }>()
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || (item.kind === 'REPLACEMENT_FABRIC' && (item.quantity !== 5 || item.unit !== 'Yard'))) throw new Error('袋内数量或单位不正确，请核对原票。')
    const key = JSON.stringify([item.kind, item.unit]); const group = groups.get(key) || { kind: item.kind, quantity: 0, unit: item.unit, tickets: 0 }
    group.quantity += item.quantity; group.tickets++; groups.set(key, group)
  }
  return [...groups.values()]
}
