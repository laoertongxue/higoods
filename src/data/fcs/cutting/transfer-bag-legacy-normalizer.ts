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
    feiTicketId: text(record.feiTicketId) || text(record.ticketRecordId),
    feiTicketNo: text(record.feiTicketNo) || text(record.ticketNo),
  }
}

export function normalizeTransferCarrierRecord(record: Record<string, unknown>): NormalizedTransferCarrierRecord {
  return {
    carrierId: text(record.carrierId) || text(record.bagId),
    carrierCode: text(record.carrierCode) || text(record.bagCode),
    currentCycleId: text(record.currentCycleId),
    currentOwnerTaskId: text(record.currentOwnerTaskId),
    latestCycleId: text(record.latestCycleId) || text(record.latestUsageId),
    latestCycleNo: text(record.latestCycleNo) || text(record.latestUsageNo),
  }
}

export function normalizeTransferCarrierCycleRecord(record: Record<string, unknown>): NormalizedTransferCarrierCycleRecord {
  const carrierCode = text(record.carrierCode) || text(record.bagCode)
  return {
    cycleId: text(record.cycleId) || text(record.usageId),
    cycleNo: text(record.cycleNo) || text(record.usageNo),
    carrierId: text(record.carrierId) || text(record.bagId),
    carrierCode,
    carrierType: record.carrierType === 'box' || carrierCode.startsWith('BOX') ? 'box' : 'bag',
    cycleStatus: text(record.cycleStatus) || text(record.usageStatus),
    status: text(record.status),
  }
}

export function normalizeCarrierCycleItemBinding(
  record: Record<string, unknown>,
  cyclesById: Record<string, Record<string, unknown>>,
): NormalizedCarrierCycleItemBinding {
  const cycleId = text(record.cycleId) || text(record.usageId)
  const cycle = cyclesById[cycleId] || {}
  return {
    cycleId,
    cycleNo:
      text(record.cycleNo) ||
      text(record.usageNo) ||
      text(cycle.cycleNo) ||
      text(cycle.usageNo),
    carrierId: text(record.carrierId) || text(record.bagId),
    carrierCode: text(record.carrierCode) || text(record.bagCode),
    feiTicketId: text(record.feiTicketId) || text(record.ticketRecordId),
    feiTicketNo: text(record.feiTicketNo) || text(record.ticketNo),
    operator: text(record.operator) || text(record.boundBy),
    status: text(record.status) || 'BOUND',
  }
}

export function normalizeTransferBagDispatchManifest(record: Record<string, unknown>): NormalizedTransferBagDispatchManifest {
  return {
    cycleId: text(record.cycleId) || text(record.usageId),
    carrierCode: text(record.carrierCode) || text(record.bagCode),
  }
}
