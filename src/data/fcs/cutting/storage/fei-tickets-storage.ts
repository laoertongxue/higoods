export const CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY = 'cuttingFeiTicketDrafts'
export const CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY = 'cuttingFeiTicketRecords'
export const CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY = 'cuttingFeiTicketPrintJobs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePrintableUnitRecord<T extends Record<string, unknown>>(record: T): T {
  if (record.printableUnitId && record.printableUnitNo && record.printableUnitType) return record

  if (record.sourceContextType === 'merge-batch' && typeof record.sourceMergeBatchId === 'string' && record.sourceMergeBatchId) {
    return {
      ...record,
      printableUnitId: record.printableUnitId || `batch:${record.sourceMergeBatchId}`,
      printableUnitNo: record.printableUnitNo || record.sourceMergeBatchNo || '',
      printableUnitType: record.printableUnitType || 'BATCH',
    }
  }

  const fallbackCutOrderId = typeof record.originalCutOrderId === 'string' ? record.originalCutOrderId : Array.isArray(record.originalCutOrderIds) ? String(record.originalCutOrderIds[0] || '') : ''
  const fallbackCutOrderNo = typeof record.originalCutOrderNo === 'string' ? record.originalCutOrderNo : Array.isArray(record.originalCutOrderNos) ? String(record.originalCutOrderNos[0] || '') : ''

  return {
    ...record,
    printableUnitId: record.printableUnitId || (fallbackCutOrderId ? `cut-order:${fallbackCutOrderId}` : ''),
    printableUnitNo: record.printableUnitNo || fallbackCutOrderNo,
    printableUnitType: record.printableUnitType || 'CUT_ORDER',
  }
}

export function deserializeFeiTicketDraftsStorage(raw: string | null): Record<string, Record<string, unknown>> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed as Record<string, Record<string, unknown>> : {}
  } catch {
    return {}
  }
}

export function deserializeFeiTicketRecordsStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : []
  } catch {
    return []
  }
}

export function deserializeFeiTicketPrintJobsStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : []
  } catch {
    return []
  }
}
