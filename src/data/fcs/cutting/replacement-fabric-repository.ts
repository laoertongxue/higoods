import { hydratePartTicketRecords, partTicketInitializationRecords, assertPartTicketLegacyUnchanged } from './part-ticket-records.ts'
import { cuttingRecordFingerprint } from './cutting-record-identity.ts'
import { hydrateProductionContextRecords, productionContextInitializationRecords } from '../production-context-records.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, diffCuttingRecords,
  type CuttingStoredRecord, type CuttingRecordSnapshot } from './cutting-record-repository.ts'
import { reconcileReplacementFabricAssignment, createReplacementFabricTickets, confirmReplacementFabricPrint,
  type ReplacementFabricState, type ReplacementFabricCommand, type ReplacementFabricScope,
  type ReplacementFabricTicket, type ReplacementFabricPrintRecord, type ReplacementFabricReceipt } from './replacement-fabric-fei-tickets.ts'
import { captureReplacementFabricSourceGuard, listReplacementFabricOrderRows } from './replacement-fabric-source.ts'

const collections = { tickets: 'replacement-tickets', prints: 'replacement-prints', receipts: 'replacement-receipts' } as const
let cache: ReplacementFabricState | null = null
export function publishReplacementFabricState(state: ReplacementFabricState): void { cache = state }
export function readReplacementFabricState(): ReplacementFabricState {
  if (!cache) throw new Error('换片布记录尚未读取，请刷新后重试。')
  return cache
}
export async function replacementStateFromRecords(snapshot: CuttingRecordSnapshot): Promise<ReplacementFabricState> {
  const state: ReplacementFabricState = {
    tickets: snapshot.records.filter(row => row.collection === collections.tickets).map(row => row.value as ReplacementFabricTicket),
    prints: snapshot.records.filter(row => row.collection === collections.prints).map(row => row.value as ReplacementFabricPrintRecord),
    receipts: snapshot.records.filter(row => row.collection === collections.receipts).map(row => row.value as ReplacementFabricReceipt),
  }
  const scopes = listReplacementFabricOrderRows().flatMap(row => row.scopes)
  // 分配事实的默认视图：读取不落盘；稳定身份保证跨页面、刷新和打印选中一致。
  for (const scope of scopes) {
    if (scope.issues.length) continue
    for (const material of scope.materials) {
      if (state.tickets.some(ticket => !ticket.invalidatedAt && ticket.productionOrderId === scope.productionOrderId
        && ticket.cuttingFactoryId === scope.factoryId && ticket.assignmentKey === scope.assignmentKey && ticket.material.key === material.key)) continue
      const identity = JSON.stringify([scope.productionOrderId, scope.factoryId, scope.assignmentKey, material.key])
      const id = `HPB-${await cuttingRecordFingerprint(identity)}`
      const sequence = Math.max(0, ...state.tickets.filter(ticket => ticket.productionOrderId === scope.productionOrderId
        && ticket.material.key === material.key).map(ticket => ticket.sequence)) + 1
      const assignmentDates = scope.assignmentKey.match(/\d{4}-\d{2}-\d{2}[T ][0-9:.+Z-]+/g) || []
      state.tickets.push({ id, ticketNo: `HPB/${encodeURIComponent(scope.productionOrderNo)}/${encodeURIComponent(material.code)}/${encodeURIComponent(material.color)}/${String(sequence).padStart(3, '0')}`,
        productionOrderId: scope.productionOrderId, productionOrderNo: scope.productionOrderNo, cuttingFactoryId: scope.factoryId,
        assignmentKey: scope.assignmentKey, material: structuredClone(material), sequence, length: 5, unit: 'Yard',
        createdAt: assignmentDates.sort().at(-1) || '', createdBy: '裁床分配自动生成', creationCommandId: `assignment-default:${identity}` })
    }
  }
  return state
}
export function replacementStateToRecords(state: ReplacementFabricState): CuttingStoredRecord[] {
  const referenced = new Set([...state.prints.map(record => record.ticketId), ...state.receipts.map(receipt => receipt.ticket.id)])
  const persistable = { ...state, tickets: state.tickets.filter(ticket => !ticket.creationCommandId.startsWith('assignment-default:')
    || referenced.has(ticket.id) || state.tickets.some(other => other.id !== ticket.id && other.assignmentKey === ticket.assignmentKey
      && other.productionOrderId === ticket.productionOrderId && other.material.key === ticket.material.key
      && !other.creationCommandId.startsWith('assignment-default:'))) }
  return (Object.keys(collections) as Array<keyof typeof collections>).flatMap(key => persistable[key].map(value => ({
    id: `${collections[key]}:${value.id}`, collection: collections[key], value,
  })))
}
export async function loadReplacementFabricState(): Promise<ReplacementFabricState> {
  const snapshot = await readCuttingRecords()
  await hydrateProductionContextRecords(snapshot)
  await hydratePartTicketRecords(snapshot)
  const state = await replacementStateFromRecords(snapshot)
  publishReplacementFabricState(state)
  return state
}
/** recipe 同步执行并在事务前结束；可追加既有袋事件、任务记录，统一提交。 */
export async function runReplacementFabricCommand<T>(input: {
  command: ReplacementFabricCommand; intent: string
  recipe: (state: ReplacementFabricState, snapshot: CuttingRecordSnapshot) => { result: T; additionalRecords?: CuttingStoredRecord[] }
}): Promise<T> {
  const prior = await readCuttingCommand(input.command.id)
  if (prior) {
    if (prior.intent !== input.intent) throw new Error('本次操作编号已用于不同内容，请重新核对。')
    return prior.result as T
  }
  const snapshot = await readCuttingRecords()
  await hydrateProductionContextRecords(snapshot)
  await hydratePartTicketRecords(snapshot)
  const eventSource = await import('./cutting-event-repository.ts')
  eventSource.prepareManagedScope(snapshot.records)
  const assertSourcesCurrent = captureReplacementFabricSourceGuard()
  const state = await replacementStateFromRecords(structuredClone(snapshot))
  const { result, additionalRecords = [] } = input.recipe(state, snapshot)
  const before = snapshot.records.filter(row => Object.values(collections).includes(row.collection as typeof collections[keyof typeof collections]))
  const change = diffCuttingRecords(before, replacementStateToRecords(state))
  change.puts.push(...additionalRecords)
  change.puts.push(...productionContextInitializationRecords(), ...partTicketInitializationRecords(), ...eventSource.cuttingEventScopeInitializationRecords())
  const saved = await commitCuttingRecords({ revision: snapshot.revision, change, assertSourcesCurrent: () => { assertSourcesCurrent(); assertPartTicketLegacyUnchanged(); eventSource.assertManagedScopeCurrent() },
    command: { id: input.command.id, intent: input.intent, at: input.command.at, result } })
  await loadReplacementFabricState()
  return saved.result
}
export async function initializeReplacementFabricAssignments(scopes: ReplacementFabricScope[], command: ReplacementFabricCommand): Promise<void> {
  await runReplacementFabricCommand({ command, intent: JSON.stringify(['initialize-assignments', scopes]), recipe: state => {
    const orderIds = new Set([...scopes.map(scope => scope.productionOrderId), ...state.tickets.map(ticket => ticket.productionOrderId)])
    for (const id of orderIds) reconcileReplacementFabricAssignment(state, id, scopes, command)
    return { result: undefined }
  } })
}
export async function addReplacementFabricTickets(scope: ReplacementFabricScope, materialKey: string, count: number, command: ReplacementFabricCommand) {
  return runReplacementFabricCommand({ command, intent: JSON.stringify(['add', scope.assignmentKey, materialKey, count]), recipe: state => ({
    result: createReplacementFabricTickets(state, requireCurrentScope(scope), materialKey, count, command),
  }) })
}
export async function saveReplacementFabricPrint(ticketIds: string[], scopes: ReplacementFabricScope[], command: ReplacementFabricCommand) {
  return runReplacementFabricCommand({ command, intent: JSON.stringify(['print', [...new Set(ticketIds)].sort()]), recipe: state => ({
    result: confirmReplacementFabricPrint(state, ticketIds, scopes.map(requireCurrentScope), command),
  }) })
}

export function requireCurrentScope(scope: ReplacementFabricScope): ReplacementFabricScope {
  // 一个分配会按面料拆成多个范围；不能只按分配身份取第一种面料。
  const materialKeys = JSON.stringify([...new Set(scope.materials.map(material => material.key))].sort())
  const current = listReplacementFabricOrderRows().flatMap(row => row.scopes).find(item => item.productionOrderId === scope.productionOrderId
    && item.factoryId === scope.factoryId && item.assignmentKey === scope.assignmentKey
    && JSON.stringify([...new Set(item.materials.map(material => material.key))].sort()) === materialKeys)
  if (!current) throw new Error('裁床分配已变化，本次未新增，请刷新后核对。')
  return current
}
