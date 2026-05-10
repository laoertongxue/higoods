function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

export interface NormalizedTransferCarrierSeedTicket {
  feiTicketId: string
  feiTicketNo: string
}

export interface NormalizedTransferCarrierRecord {
  carrierId: string
  carrierCode: string
  latestCycleId: string
  latestCycleNo: string
  currentCycleId: string
  currentOwnerTaskId: string
}

export interface NormalizedTransferCarrierCycleRecord {
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  carrierType: 'bag' | 'box'
  cycleStatus: string
  status: string
}

export interface NormalizedCarrierCycleItemBinding {
  cycleId: string
  cycleNo: string
  carrierId: string
  carrierCode: string
  feiTicketId: string
  feiTicketNo: string
  operator: string
  status: string
}

export interface NormalizedTransferBagDispatchManifest {
  cycleId: string
  carrierCode: string
}

export function normalizeTransferCarrierSeedTicket(record: Record<string, unknown>): NormalizedTransferCarrierSeedTicket {
  return {
    feiTicketId: text(record.feiTicketId),
    feiTicketNo: text(record.feiTicketNo),
  }
}

export function normalizeTransferCarrierRecord(record: Record<string, unknown>): NormalizedTransferCarrierRecord {
  return {
    carrierId: text(record.carrierId),
    carrierCode: text(record.carrierCode),
    currentCycleId: text(record.currentCycleId),
    currentOwnerTaskId: text(record.currentOwnerTaskId),
    latestCycleId: text(record.latestCycleId),
    latestCycleNo: text(record.latestCycleNo),
  }
}

export function normalizeTransferCarrierCycleRecord(record: Record<string, unknown>): NormalizedTransferCarrierCycleRecord {
  const carrierCode = text(record.carrierCode)
  return {
    cycleId: text(record.cycleId),
    cycleNo: text(record.cycleNo),
    carrierId: text(record.carrierId),
    carrierCode,
    carrierType: record.carrierType === 'box' || carrierCode.startsWith('BOX') ? 'box' : 'bag',
    cycleStatus: text(record.cycleStatus),
    status: text(record.status),
  }
}

export function normalizeCarrierCycleItemBinding(
  record: Record<string, unknown>,
  cyclesById: Record<string, Record<string, unknown>>,
): NormalizedCarrierCycleItemBinding {
  const cycleId = text(record.cycleId)
  const cycle = cyclesById[cycleId] || {}
  return {
    cycleId,
    cycleNo:
      text(record.cycleNo) ||
      text(cycle.cycleNo),
    carrierId: text(record.carrierId),
    carrierCode: text(record.carrierCode),
    feiTicketId: text(record.feiTicketId),
    feiTicketNo: text(record.feiTicketNo),
    operator: text(record.operator),
    status: text(record.status) || 'BOUND',
  }
}

export function normalizeTransferBagDispatchManifest(record: Record<string, unknown>): NormalizedTransferBagDispatchManifest {
  return {
    cycleId: text(record.cycleId),
    carrierCode: text(record.carrierCode),
  }
}
