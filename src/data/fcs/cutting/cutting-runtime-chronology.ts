export interface CuttingRuntimeChronologyItem {
  occurredAt: string
  ledgerSequence?: number
  createdAt?: string
  eventId?: string
  factId?: string
}

export function normalizeCuttingRuntimeLedgerSequence(value: unknown): number | undefined {
  const sequence = Number(value)
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined
}

function stableChronologyId(item: CuttingRuntimeChronologyItem): string {
  return item.eventId || item.factId || ''
}

export function compareCuttingRuntimeChronologyAscending(
  left: CuttingRuntimeChronologyItem,
  right: CuttingRuntimeChronologyItem,
): number {
  return left.occurredAt.localeCompare(right.occurredAt, 'zh-CN')
    || (normalizeCuttingRuntimeLedgerSequence(left.ledgerSequence) || 0)
      - (normalizeCuttingRuntimeLedgerSequence(right.ledgerSequence) || 0)
    || (left.createdAt || left.occurredAt).localeCompare(
      right.createdAt || right.occurredAt,
      'zh-CN',
    )
    || stableChronologyId(left).localeCompare(stableChronologyId(right), 'zh-CN')
}
