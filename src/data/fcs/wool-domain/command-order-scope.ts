import type { WoolDomainStore } from './store.ts'

/** The actual owners of changed persisted wool facts, including automatic paired facts.
 * This is transaction metadata, never a second source of business quantities. */
export function changedWoolCommandOrderIds(before: WoolDomainStore, after: WoolDomainStore): string[] {
  const owners = new Set<string>()
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const record = value as { woolOrderId?: string; fromWoolOrderId?: string; toWoolOrderId?: string }
    for (const id of [record.woolOrderId, record.fromWoolOrderId, record.toWoolOrderId]) if (id) owners.add(id)
  }
  for (const id of new Set([...Object.keys(before.workOrders), ...Object.keys(after.workOrders)])) {
    if (JSON.stringify(before.workOrders[id]) !== JSON.stringify(after.workOrders[id])) owners.add(id)
  }
  for (const group of ['craftRecords', 'internalReceipts', 'pieceReceipts', 'yarnReceipts', 'yarnIssues', 'yarnReturns',
    'processReports', 'handovers', 'qtyChangeLogs', 'warehouseFlows', 'completions',
    'machineAssociations', 'machineAssociationLogs', 'operationLogs'] as const) {
    const left = new Set(before[group].map(record => JSON.stringify(record)))
    const right = new Set(after[group].map(record => JSON.stringify(record)))
    for (const record of before[group]) if (!right.has(JSON.stringify(record))) collect(record)
    for (const record of after[group]) if (!left.has(JSON.stringify(record))) collect(record)
  }
  return [...owners].sort()
}
